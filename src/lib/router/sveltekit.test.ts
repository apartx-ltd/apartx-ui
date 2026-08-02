// projects/apartx-ui/src/lib/router/sveltekit.test.ts
// @vitest-environment jsdom
//
// createSvelteKitHistoryAdapter() (private, only reachable via useSvelteKitNavigation())
// has three guards in its beforeNavigate callback plus a resync in afterNavigate, and none
// of it was covered by anything. Review found that deleting the popstate/depthFromHistory
// guard left 277 unit tests + 7 e2e specs + the build all green — yet that exact line was
// added to fix a real regression (keepOverlays breaking on the back path). These tests pin
// the guards directly against the mocked $app/navigation callbacks so a future refactor
// gets caught here instead of in a demo on a phone.
//
// $app/navigation and $app/state are mocked below; sveltekit.ts is the ONLY file allowed
// to import them (see CLAUDE.md's SvelteKit carve-out) — this test file is an accepted
// exception to that grep gate (see CLAUDE.md for the *.test.ts carve-out).
import { describe, it, expect, vi } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';

// Колбэки, которые адаптер регистрирует внутри createSvelteKitHistoryAdapter() при
// каждом создании — перехватываем их, чтобы гонять напрямую, как это делает SvelteKit.
let beforeCb: ((nav: { type: string; delta?: number; willUnload?: boolean }) => void) | null = null;
let afterCb: (() => void) | null = null;

const goto = vi.fn(() => Promise.resolve());
const pushState = vi.fn();

vi.mock('$app/navigation', () => ({
  goto: (...a: unknown[]) => goto(...a),
  beforeNavigate: (cb: typeof beforeCb) => { beforeCb = cb; },
  afterNavigate: (cb: typeof afterCb) => { afterCb = cb; },
  pushState: (...a: unknown[]) => pushState(...a),
}));

// Один и тот же объект на весь файл: sveltekit.ts делает `page.url`/`page.state` каждый
// раз заново, так что мутировать его поля между тестами достаточно — не нужно
// пересоздавать модуль-мок ради нового "снимка" страницы.
const mockPage: { url: URL; state: Record<string, unknown> } = {
  url: new URL('http://localhost/'),
  state: {},
};
vi.mock('$app/state', () => ({ page: mockPage }));

/**
 * createSvelteKitHistoryAdapter() мемоизирован модульным `let skAdapter` (см. sveltekit.ts),
 * так что между тестами нужен ПОЛНОСТЬЮ свежий граф модулей: sveltekit.ts, overlay-stack.ts
 * (там свой module-singleton `defaultOverlayStack`) и registry.ts (свой `active`). Без
 * resetModules второй тест наследовал бы adapter/stack первого.
 */
async function setup() {
  vi.resetModules();
  beforeCb = null;
  afterCb = null;
  goto.mockClear();
  pushState.mockClear();
  mockPage.url = new URL('http://localhost/');
  mockPage.state = {};
  history.replaceState(null, '', '/');

  // Тот же граф модулей, что подтянет sveltekit.ts изнутри (общий кэш в рамках одного
  // resetModules-цикла) — так overlayStack ниже это ТА ЖЕ инстанция, которой владеет
  // адаптер, создаваемый пробником.
  const { defaultOverlayStack } = await import('./overlay/overlay-stack');
  const probeMod = await import('./sveltekit.probe.svelte');
  const Probe = probeMod.default;

  let nav: unknown;
  const target = document.createElement('div');
  document.body.appendChild(target);
  const handle = mount(Probe, { target, props: { onready: (n: unknown) => { nav = n; } } });
  flushSync();

  return {
    nav,
    overlayStack: defaultOverlayStack,
    dispose: () => { unmount(handle); target.remove(); },
  };
}

describe('SvelteKit history adapter — beforeNavigate guards', () => {
  it('хостовая навигация (plain <a>, адресная строка, host goto) снимает открытые оверлеи логически', async () => {
    const { overlayStack, dispose } = await setup();
    let closed = false;
    overlayStack.registerOverlay({ close: () => { closed = true; } });
    expect(overlayStack.overlayCount()).toBe(1);

    beforeCb!({ type: 'link', willUnload: false });

    expect(closed).toBe(true);
    expect(overlayStack.overlayCount()).toBe(0);
    dispose();
  });

  it('selfNav: навигацию инициировал сам кит (push/replace) — dismiss глушится, оверлей выживает', async () => {
    const { overlayStack, dispose } = await setup();
    const { getHistory } = await import('./history/registry');
    let closed = false;
    overlayStack.registerOverlay({ close: () => { closed = true; } });

    // adapter.push() ставит selfNav=true и зовёт goto() — ту самую навигацию, что тут же
    // прогоняет beforeNavigate. Это НЕ хостовая навигация мимо кита, а его собственная.
    getHistory().push('/x');
    beforeCb!({ type: 'link', willUnload: false });

    expect(closed).toBe(false);
    expect(overlayStack.overlayCount()).toBe(1);

    // Флаг одноразовый (сбрасывается при первом же beforeNavigate) — следующая
    // навигация уже настоящая хостовая и снимает оверлей как обычно.
    beforeCb!({ type: 'link', willUnload: false });
    expect(closed).toBe(true);
    dispose();
  });

  it('willUnload (закрытие вкладки/внешняя ссылка/beforeunload) — dismiss не вызывается, оверлей выживает', async () => {
    const { overlayStack, dispose } = await setup();
    let closed = false;
    overlayStack.registerOverlay({ close: () => { closed = true; } });

    beforeCb!({ type: 'leave', willUnload: true });

    expect(closed).toBe(false);
    expect(overlayStack.overlayCount()).toBe(1);
    dispose();
  });

  it('back, приземляющийся на синтетическую запись оверлея, — restore-on-back (keepOverlays), оверлей выживает', async () => {
    // Это ТОТ САМЫЙ гард, ради которого написан весь файл: без него `beforeNavigate`
    // видит обычный popstate назад и снимает оверлей, хотя браузер вернулся ровно НА
    // его синтетическую запись (шторка карты, пережившая уход на детальную страницу и
    // обратно, должна остаться открытой).
    const { overlayStack, dispose } = await setup();
    let closed = false;
    overlayStack.registerOverlay({ close: () => { closed = true; } });

    // На popstate history.state уже обновлён браузером СИНХРОННО (в отличие от
    // реактивного page.state у SvelteKit) — depthFromHistory() читает его напрямую.
    history.replaceState({ 'sveltekit:states': { __overlayDepth: 1 } }, '');
    beforeCb!({ type: 'popstate', delta: -1 });

    expect(closed).toBe(false);
    expect(overlayStack.overlayCount()).toBe(1);
    dispose();
  });

  it('РЕГРЕССИЯ: без гарда depthFromHistory()>0 предыдущий тест обязан падать', async () => {
    // Явная проверка, что тест выше не бесполезен: воспроизводим ТОЧНО ТЕ ЖЕ условия
    // (back-popstate, приземлившийся на оверлейную запись) БЕЗ помощи гарда — вызывая
    // dismissForHostNavigation() напрямую, как это делал бы beforeNavigate, если бы
    // строка `if (nav.type === 'popstate' && depthFromHistory() > 0) return;` была
    // удалена. Если это утверждение перестанет быть верным, тест выше нужно пересмотреть.
    const { overlayStack, dispose } = await setup();
    let closed = false;
    overlayStack.registerOverlay({ close: () => { closed = true; } });
    history.replaceState({ 'sveltekit:states': { __overlayDepth: 1 } }, '');

    overlayStack.dismissForHostNavigation(); // то, что случилось бы без гарда

    expect(closed).toBe(true);
    expect(overlayStack.overlayCount()).toBe(0);
    dispose();
  });
});

// НЕ ПОКРЫТО НАМЕРЕННО: afterNavigate's `depth = depthFromHistory()` resync.
//
// Расследовано и отклонено, а не забыто. Приватный `depth` виден ТОЛЬКО одному
// потребителю — window-уровневому popstate-слушателю (closed = depth - landed).
// Он self-heal'ится на каждом pushOverlay() (тот пишет `depth` заново ИЗ
// page.state, а не инкрементирует старое значение) — значит устареть `depth`
// может только в окне между хостовой навигацией (dismissForHostNavigation
// чистит stack, но НЕ трогает depth) и следующим {pushOverlay | popstate |
// afterNavigate}. Единственный вред протухшего `depth` в этом окне — лишний
// вызов backInterceptor() на уже ПУСТОМ stack: handleBack() там сразу
// `return false` без единого побочного эффекта, а возврат popstate-слушателем
// вообще не читается (fire-and-forget цикл). Проверено эмпирически: закомментировал
// строку резинка в sveltekit.ts, прогнал этот файл — все тесты выше остаются
// зелёными, ни один наблюдаемый сигнал (overlayCount, close()-вызовы,
// pushOverlay/goBack-счётчики) не меняется. Значит любой тест на эту строку либо
// не про неё (проверяет что-то ещё), либо про приватную переменную напрямую —
// а до неё снаружи адаптера нет пути. По правилам задачи («если наблюдаемого
// способа нет — пропусти, не выдумывай») тест сюда не добавлен.
