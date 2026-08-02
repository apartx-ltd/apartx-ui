// LIFO открытых оверлеев. Открытие кладёт синтетическую history-запись (pushOverlay);
// единственный back-interceptor (history.ts) на backward-popstate закрывает верхний.
// Закрытие НЕ через back (бэкдроп/Escape/X/программно) снимает лишнюю history-запись
// одним guard'ованным history.back(). Идемпотентно: токен уже снят → no-op.
import type { HistoryAdapter } from '../history/adapter';

type Close = () => void;
interface Entry {
  token: number;
  close: Close;
  exitMs: number;
  /** Оверлей зарегистрирован, пока guarded back закрывающегося оверлея ещё в полёте:
   *  его синтетическая запись ОТЛОЖЕНА (создастся в popstate-обработчике, когда браузер
   *  осядет на до-оверлейной записи). Пока флаг стоит — записи в history НЕТ, и close
   *  не должен снимать её через back. */
  deferredEntry?: boolean;
}

const Z_BASE = 60;
const Z_STEP = 10;
// Fallback close-animation duration (ms) for overlays that don't declare one. Overlays with a
// known exit (Popover 120, Dialog 220 / sheet 260 — see ui/utils/motion.ts) pass their own via
// registerOverlay/useOverlay; dismissForNavigation waits the longest so variant-A navigation
// doesn't tear a still-animating overlay off the page.
const DEFAULT_EXIT_MS = 200;

export interface OverlayHandle {
  token: number;
  z: number;
  close: () => void;
}

export interface OverlayStack {
  overlayCount(): number;
  subscribeOverlay(cb: () => void): () => void;
  registerOverlay(opts: { close: Close; scrim?: boolean; exitMs?: number }): OverlayHandle;
  openOverlay(close: Close): number; // back-compat
  closeOverlay(token: number, opts?: { viaBack?: boolean }): void;
  /** Навигацию инициирует САМ КИТ через navigate() (вариант A — см. core/nav.ts).
   *  Закрывает все оверлеи; возвращает max exit-длительность (ms) — сколько подождать
   *  перед сменой роута, чтобы уходящая анимация успела проиграть (0 = стек пуст).
   *  Верхнюю синтетическую запись съест последующий replace самой навигации — в отличие
   *  от dismissForHostNavigation (навигация МИМО кита), history здесь трогать не нужно.
   *
   *  Не гарантия для ЛЮБОГО `<Link>` — их два. `router/core/Link.svelte` идёт через
   *  `use:link` → navigate() всегда, это чистый вариант A. `ui/display/Link.svelte`
   *  (framework-agnostic) зовёт вместо этого инжектированный Navigator — сюда он
   *  попадает, только если ХОСТ собрал этот Navigator через `createNavigatorFromRouter()`
   *  (её push/replace сами идут через navigate() — см. router/navigator.ts). Хосты, что
   *  подключают `Navigator.push` напрямую к своему адаптеру в обход navigate() (так
   *  делает `useSvelteKitNavigation()` в sveltekit.ts), этот метод для клика по
   *  `ui/display/Link.svelte` вообще не вызывают. */
  dismissForNavigation(): number;
  /** Хост навигирует МИМО кита (plain <a>, адресная строка, host goto): снять оверлеи
   *  логически, history НЕ трогать — наша синтетическая запись уже не вершина, слепой
   *  back() снёс бы чужую запись (откат навигации хоста). Синтетическая запись бросается:
   *  её URL совпадает со страницей, первый back корректен, мёртв только следующий.
   *  Дизайн: docs/plans/2026-08-02-kit-overlay-host-navigation (оркестратор). */
  dismissForHostNavigation(): void;
  initOverlayStack(): void;
}

export function createOverlayStack(adapter: HistoryAdapter): OverlayStack {
  const stack: Entry[] = [];
  let seq = 0;
  let suppressNextPop = false;
  let inited = false;

  const subs = new Set<() => void>();
  const notify = () => subs.forEach((f) => f());

  /** Вызывается history.ts на backward-popstate. true = back поглощён (роутер не нотифать). */
  function handleBack(): boolean {
    if (suppressNextPop) {
      suppressNextPop = false;
      // Догнать отложенные синтетические записи (register во время pending-pop, см.
      // registerOverlay): браузер ТОЛЬКО ЧТО осел на до-оверлейной записи, так что эти
      // pushState ложатся поверх route-записи — оверлей получает НАСТОЯЩУЮ запись,
      // которую его close корректно снимет одним back. Раньше нельзя: back(),
      // выпущенный closeOverlay, резолвит цель в момент ВЫЗОВА (Chrome), и запись,
      // запушенная до его приземления, не спасает — траверс всё равно уносит на
      // до-оверлейную, а следующий close-back съедает уже route-запись (about:blank).
      // Закрытые до приземления оверлеи уже выбыли из stack → для них пуша не будет.
      for (const e of stack) {
        if (e.deferredEntry) {
          e.deferredEntry = false;
          adapter.pushOverlay();
        }
      }
      // The synthetic overlay entry has now been popped, so history.position is back
      // to its pre-overlay depth. closeOverlay() already fired notify() BEFORE this
      // popstate — while canGoBack was still inflated by this entry — so any subscriber
      // that reads canGoBack (the superapp back-button controller) computed a stale
      // value and, because this back is consumed (router not notified), would never
      // re-run on its own. Re-notify HERE, after the correction, so a non-back close at
      // the history root (e.g. closing the map bottom-sheet) updates the native back
      // button immediately instead of staying until the next unrelated history change.
      notify();
      return true;
    }
    if (stack.length === 0) return false;
    const top = stack.pop()!;
    notify();
    // close() ставит isOpen=false; хук useOverlayBack увидит переход и вызовет
    // closeOverlay(token), но токен уже снят → no-op (без второго history.back).
    top.close();
    return true;
  }

  function overlayCount(): number {
    return stack.length;
  }

  function subscribeOverlay(cb: () => void): () => void {
    subs.add(cb);
    return () => {
      subs.delete(cb);
    };
  }

  function registerOverlay({ close, exitMs }: { close: Close; scrim?: boolean; exitMs?: number }): OverlayHandle {
    initOverlayStack(); // idempotent, SSR no-op — guarantees the back-interceptor is installed
    const token = ++seq;
    const z = Z_BASE + stack.length * Z_STEP; // depth = длина стека ДО push
    const entry: Entry = { token, close, exitMs: exitMs ?? DEFAULT_EXIT_MS };
    stack.push(entry);
    // ADOPT vs PUSH. Normally opening an overlay pushes a synthetic history entry so a
    // back closes it. But on a BACK-DRIVEN remount (the map sheet survives a property
    // round-trip and reopens from the survival store), the browser is already SITTING on
    // the surviving overlay entry — pushing another one there is a programmatic pushState
    // with NO user gesture, which Chrome's history-manipulation intervention flags
    // skip-on-back → the next back skips it (and the map) and exits the app. So when this
    // is the only overlay AND the current entry is already synthetic, ADOPT it (no push);
    // `position` already matches that entry.
    //
    // НО: register во время pending-pop (suppressNextPop взведён) — особый режим.
    // closeOverlay() уже вызвал guarded history.back() (это ЗАДАЧА), а новый оверлей
    // регистрируется Svelte-эффектом МИКРОТАСКОЙ — раньше. history.state ещё показывает
    // __overlay, но запись вот-вот схлопнется: адопт получил бы «ничьё» место. Push
    // прямо сейчас тоже НЕ спасает: back() резолвит цель в момент вызова (Chrome), и
    // траверс всё равно уносит НИЖЕ свежезапушенной записи — она остаётся мёртвым
    // forward-хвостом, а close нового оверлея снимает уже НАСТОЯЩУЮ route-запись
    // (Escape в confirm → уход на about:blank). Поэтому запись ОТКЛАДЫВАЕТСЯ
    // (deferredEntry): оверлей сразу в стеке (z, back-interceptor), а его pushState
    // выполнит popstate-обработчик, когда pending-pop приземлится и браузер осядет на
    // route-записи. Настоящий adopt-кейс (back-driven remount выжившей шторки) не
    // задет — там никакой close не в полёте и suppressNextPop снят.
    if (suppressNextPop) {
      entry.deferredEntry = true;
    } else {
      const adopt = stack.length === 1 && adapter.onOverlayEntry;
      if (!adopt) adapter.pushOverlay();
    }
    notify();
    return { token, z, close };
  }

  function openOverlay(close: Close): number {
    return registerOverlay({ close }).token;
  }

  function closeOverlay(token: number, opts?: { viaBack?: boolean }): void {
    const i = stack.findIndex((e) => e.token === token);
    if (i < 0) return; // уже снят (закрыт через back) → no-op, без двойного history.back
    const wasTop = i === stack.length - 1;
    const [entry] = stack.splice(i, 1);
    notify();
    // Запись оверлея ещё отложена (pending-pop не приземлился) → её просто НЕ существует:
    // снимать нечего, back выпускать нельзя (он бы съел чужую запись). Выбытие из stack
    // уже гарантирует, что flush в popstate-обработчике её не создаст.
    if (entry.deferredEntry) return;
    // Закрыли не через back и это была верхняя → снять синтетическую history-запись.
    // suppressNextPop гасит вызванный этим popstate, чтобы не закрыть ещё раз.
    if (!opts?.viaBack && wasTop) {
      suppressNextPop = true;
      adapter.goBack();
    }
    // Не-верхнее не-back закрытие: history может на шаг разойтись — известное
    // ограничение (почти все модалки LIFO), не усложняем (YAGNI).
  }

  function dismissForNavigation(): number {
    const entries = stack.splice(0, stack.length); // очистить логический стек
    notify();
    // close() флипает open=false → useOverlay-effect позовёт closeOverlay(token),
    // но токен уже снят → no-op (без лишнего history.back). replace съест верхнюю
    // синтетическую запись; для k>1 нижние k-1 остаются (YAGNI, как non-top закрытия).
    let wait = 0;
    for (let i = entries.length - 1; i >= 0; i--) {
      if (entries[i].exitMs > wait) wait = entries[i].exitMs;
      entries[i].close();
    }
    return wait;
  }

  function dismissForHostNavigation(): void {
    // suppressNextPop взведён из closeOverlay() СИНХРОННО перед adapter.goBack() —
    // popstate уже выпущен и обязательно приземлится, отменить его нельзя. Сброс флага
    // не отменяет этот pop, а меняет его судьбу: вместо «молча поглощён» он дойдёт до
    // handleBack на уже пустом стеке и будет доложен роутеру как обычный back (false) —
    // безобидно, запись same-URL. Не сбросить было бы хуже: залипший флаг молча съел бы
    // СЛЕДУЮЩИЙ настоящий back пользователя.
    suppressNextPop = false;
    const entries = stack.splice(0, stack.length);
    if (entries.length === 0) return;
    notify();
    // close() флипает open=false → useOverlay-effect позовёт closeOverlay(token),
    // но токен уже снят → no-op. Deferred-записи выбыли из stack → flush в handleBack
    // их не создаст. exitMs не ждём: хостовую навигацию не задержать.
    for (let i = entries.length - 1; i >= 0; i--) entries[i].close();
  }

  /** Один раз на клиенте: подключить back-interceptor. SSR — no-op. */
  function initOverlayStack(): void {
    if (inited || typeof window === 'undefined') return;
    inited = true;
    adapter.setBackInterceptor(handleBack);
  }

  return {
    overlayCount, subscribeOverlay, registerOverlay, openOverlay, closeOverlay,
    dismissForNavigation, dismissForHostNavigation, initOverlayStack,
  };
}

// Default instance for kit consumers. Reads the ACTIVE history adapter from the
// registry lazily (per call), so overlay-back shares the SAME backend the router
// uses (SvelteKit/Meteor/browser) instead of the import-time hardcoded browser one.
import { getHistory } from '../history/registry';

const lazyAdapter: HistoryAdapter = new Proxy({} as HistoryAdapter, {
  get(_t, prop) {
    const a = getHistory() as any;
    const v = a[prop];
    return typeof v === 'function' ? v.bind(a) : v;
  },
});

const defaultStack = createOverlayStack(lazyAdapter);
/** The single stack every kit component uses (useOverlay → registerOverlay). SvelteKit
 *  hosts return THIS from useSvelteKitNavigation so their `overlay` matches components. */
export const defaultOverlayStack: OverlayStack = defaultStack;
export const overlayCount = defaultStack.overlayCount;
export const subscribeOverlay = defaultStack.subscribeOverlay;
export const registerOverlay = defaultStack.registerOverlay;
export const openOverlay = defaultStack.openOverlay;
export const closeOverlay = defaultStack.closeOverlay;
export const dismissForNavigation = defaultStack.dismissForNavigation;
export const dismissForHostNavigation = defaultStack.dismissForHostNavigation;
export const initOverlayStack = defaultStack.initOverlayStack;
