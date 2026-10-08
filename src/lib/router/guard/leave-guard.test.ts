// projects/apartx-ui/src/lib/router/guard/leave-guard.test.ts
// @vitest-environment jsdom
//
// Реестр гардов ухода. Свежий граф модулей на каждый тест (resetModules): у реестра и у
// оверлей-стека модульные синглтоны, и тесты не должны наследовать гарды/оверлеи друг друга.
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { HistoryAdapter, Action, LeaveGuardHook } from '../history/adapter';

// resetModules даёт свежий реестр, но window общий: beforeunload-слушатель незадиспозенного гарда
// пережил бы тест. Снимаем все гарды после каждого теста (dispose идемпотентен).
const disposers: (() => void)[] = [];
afterEach(() => {
  vi.useRealTimers();
  for (const d of disposers.splice(0)) d();
});

async function setup() {
  vi.resetModules();
  let hook: LeaveGuardHook | null = null;
  let interceptor: (() => boolean) | null = null;
  const adapter: HistoryAdapter = {
    location: null, action: 'none' as Action, canGoBack: true, onOverlayEntry: false,
    listen: () => () => {},
    push: () => {}, replace: () => {},
    pushOverlay: () => {}, restoreOverlayEntry: () => {},
    setBackInterceptor: (fn) => { interceptor = fn; },
    setLeaveGuard: (h) => { hook = h; },
    goBack: () => {},
  };
  const { setHistoryAdapter } = await import('../history/registry');
  setHistoryAdapter(adapter);
  const mod = await import('./leave-guard');
  const guard = {
    ...mod,
    addLeaveGuard: (g: Parameters<typeof mod.addLeaveGuard>[0]) => {
      const d = mod.addLeaveGuard(g);
      disposers.push(d);
      return d;
    },
  };
  const overlays = await import('../overlay/overlay-stack');
  return { guard, overlays, hook: () => hook, fireBack: () => interceptor?.() };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('leave-guard', () => {
  it('без гардов и с чистым гардом — proceed сразу, синхронно', async () => {
    const { guard } = await setup();
    let n = 0;
    void guard.requestLeave(() => { n += 1; });
    expect(n).toBe(1);
    guard.addLeaveGuard({ when: () => false, confirm: async () => true });
    void guard.requestLeave(() => { n += 1; });
    expect(n).toBe(2);
  });

  it('dirty: один confirm первого dirty-гарда; «Уйти» → proceed, «Остаться» → onStay того же гарда', async () => {
    const { guard } = await setup();
    const first = { when: () => true, confirm: vi.fn(async () => false), onStay: vi.fn() };
    const second = { when: () => true, confirm: vi.fn(async () => true), onStay: vi.fn() };
    guard.addLeaveGuard({ when: () => false, confirm: async () => true });
    guard.addLeaveGuard(first);
    guard.addLeaveGuard(second);
    let n = 0;
    await guard.requestLeave(() => { n += 1; });
    expect(first.confirm).toHaveBeenCalledTimes(1);
    expect(second.confirm).not.toHaveBeenCalled();
    expect(first.onStay).toHaveBeenCalledTimes(1);
    expect(n).toBe(0);

    first.confirm.mockResolvedValueOnce(true);
    await guard.requestLeave(() => { n += 1; });
    expect(n).toBe(1);
  });

  it('пока confirm открыт, повторные попытки уйти игнорируются', async () => {
    const { guard } = await setup();
    let answer!: (v: boolean) => void;
    const confirm = vi.fn(() => new Promise<boolean>((r) => { answer = r; }));
    guard.addLeaveGuard({ when: () => true, confirm });
    let n = 0;
    const pending = guard.requestLeave(() => { n += 1; });
    void guard.requestLeave(() => { n += 10; });
    expect(confirm).toHaveBeenCalledTimes(1);
    answer(true);
    await pending;
    expect(n).toBe(1);
  });

  it('«Уйти» ждёт, пока confirm-оверлей закроется и его back приземлится', async () => {
    const { guard, overlays, fireBack } = await setup();
    let token = 0;
    guard.addLeaveGuard({
      when: () => true,
      confirm: async () => {
        token = overlays.openOverlay(() => {});
        // Хост резолвит до того, как его Dialog снимет оверлей ($effect позже).
        setTimeout(() => overlays.closeOverlay(token), 0);
        return true;
      },
    });
    let n = 0;
    const pending = guard.requestLeave(() => { n += 1; });
    await flush();
    expect(n).toBe(0); // оверлей закрыт, guarded back ещё в полёте
    fireBack();
    await pending;
    expect(n).toBe(1);
  });

  it('addLeaveGuard ставит hook в адаптер; blocked() отражает dirty; dispose снимает гард', async () => {
    const { guard, hook } = await setup();
    let dirty = false;
    const dispose = guard.addLeaveGuard({ when: () => dirty, confirm: async () => true });
    expect(hook()).not.toBeNull();
    expect(hook()!.blocked()).toBe(false);
    dirty = true;
    expect(hook()!.blocked()).toBe(true);
    dispose();
    expect(hook()!.blocked()).toBe(false);
  });

  it('beforeunload: preventDefault только при dirty-гарде и только пока гард зарегистрирован', async () => {
    const { guard } = await setup();
    let dirty = true;
    const dispose = guard.addLeaveGuard({ when: () => dirty, confirm: async () => true });
    const fire = () => {
      const e = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(e);
      return e.defaultPrevented;
    };
    expect(fire()).toBe(true);
    dirty = false;
    expect(fire()).toBe(false);
    dirty = true;
    dispose();
    expect(fire()).toBe(false);
  });

  it('ожидание приземления ограничено: back, который не приземлился, не вешает «Уйти»', async () => {
    vi.useFakeTimers();
    const { guard, overlays } = await setup();
    guard.addLeaveGuard({
      when: () => true,
      confirm: async () => {
        const token = overlays.openOverlay(() => {});
        setTimeout(() => overlays.closeOverlay(token), 0);
        return true;
      },
    });
    let n = 0;
    const pending = guard.requestLeave(() => { n += 1; });
    await vi.advanceTimersByTimeAsync(999); // оверлей закрыт, guarded back в полёте и не придёт
    expect(n).toBe(0);
    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(n).toBe(1);
  });

  it('после «Уйти» гард отпущен: тот же dirty-гард пропускает без confirm, новый — спрашивает', async () => {
    const { guard } = await setup();
    const confirm = vi.fn(async () => true);
    const old = { when: () => true, confirm };
    const dispose = guard.addLeaveGuard(old);
    let n = 0;
    await guard.requestLeave(() => { n += 1; });
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(n).toBe(1);

    void guard.requestLeave(() => { n += 1; });
    expect(confirm).toHaveBeenCalledTimes(1); // не спросил второй раз
    expect(n).toBe(2);

    dispose();
    const confirm2 = vi.fn(async () => true);
    guard.addLeaveGuard({ when: () => true, confirm: confirm2 });
    await guard.requestLeave(() => { n += 1; });
    expect(confirm2).toHaveBeenCalledTimes(1);
    expect(n).toBe(3);
  });

  it('отказ confirm (reject) = «Остаться»: onStay, без исключения, proceed не зовётся', async () => {
    const { guard } = await setup();
    const onStay = vi.fn();
    guard.addLeaveGuard({ when: () => true, confirm: async () => { throw new Error('dialog failed'); }, onStay });
    let n = 0;
    await expect(guard.requestLeave(() => { n += 1; })).resolves.toBeUndefined();
    expect(n).toBe(0);
    expect(onStay).toHaveBeenCalledTimes(1);
    // asking сброшен: следующая попытка снова доходит до confirm
    await guard.requestLeave(() => { n += 1; });
    expect(onStay).toHaveBeenCalledTimes(2);
  });
});
