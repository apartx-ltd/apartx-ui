// projects/apartx-ui/src/lib/router/guard/leave-guard.test.ts
// @vitest-environment jsdom
//
// Реестр гардов ухода. Свежий граф модулей на каждый тест (resetModules): у реестра и у
// оверлей-стека модульные синглтоны, и тесты не должны наследовать гарды/оверлеи друг друга.
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { HistoryAdapter, Action, LeaveGuardHook } from '../history/adapter';

// resetModules даёт свежий реестр, но window общий: beforeunload-слушатели гардов, которые тест
// не снял (dispose), пережили бы его и сработали в следующих тестах. Снимаем их после каждого.
const unloadListeners: EventListenerOrEventListenerObject[] = [];
const nativeAdd = window.addEventListener.bind(window);
window.addEventListener = ((type: string, fn: EventListenerOrEventListenerObject, opts?: any) => {
  if (type === 'beforeunload') unloadListeners.push(fn);
  return nativeAdd(type, fn, opts);
}) as typeof window.addEventListener;
afterEach(() => {
  for (const fn of unloadListeners.splice(0)) window.removeEventListener('beforeunload', fn);
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
  const guard = await import('./leave-guard');
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
});
