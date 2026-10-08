// projects/apartx-ui/src/lib/router/history/browser.test.ts
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { browserHistoryAdapter as h } from './browser';

describe('browserHistoryAdapter', () => {
  beforeEach(() => {
    window.history.replaceState({ idx: 0 }, '', '/');
  });

  it('reads the current location', () => {
    window.history.replaceState({ idx: 0 }, '', '/foo?x=1#h');
    expect(h.location).toEqual({ pathname: '/foo', search: '?x=1', hash: '#h' });
  });

  it('push increments position and notifies listeners', () => {
    let hits = 0;
    const off = h.listen(() => { hits += 1; });
    h.push('/bar');
    expect(window.location.pathname).toBe('/bar');
    expect(h.action).toBe('forward');
    expect(h.canGoBack).toBe(true);
    expect(hits).toBe(1);
    off();
  });

  it('replace keeps position and defaults action to none', () => {
    h.push('/a');
    const before = h.canGoBack;
    h.replace('/b');
    expect(window.location.pathname).toBe('/b');
    expect(h.action).toBe('none');
    expect(h.canGoBack).toBe(before);
  });

  it('root push starts a new back stack: nothing to go back to until the next push', () => {
    h.push('/list');
    expect(h.canGoBack).toBe(true);
    h.push('/deep', { root: true });
    expect(h.canGoBack).toBe(false);
    h.push('/deeper');
    expect(h.canGoBack).toBe(true);
    // Корень пишется в state — переживает reload и возврат по истории.
    const st = window.history.state as { idx: number; root: number };
    expect(st.root).toBe(st.idx - 1);
  });

  it('popstate restores the stack root of the landed entry', () => {
    h.push('/deep', { root: true });
    const deep = window.history.state as { idx: number; root: number };
    h.push('/deeper');
    window.dispatchEvent(new PopStateEvent('popstate', { state: deep }));
    expect(h.canGoBack).toBe(false);
    window.dispatchEvent(new PopStateEvent('popstate', { state: { idx: deep.idx + 1, root: deep.root } }));
    expect(h.canGoBack).toBe(true);
  });

  it('root replace makes the current entry a stack root; overlays keep it', () => {
    h.push('/a');
    h.replace('/deep', { root: true });
    expect(h.canGoBack).toBe(false);
    h.pushOverlay();
    // Над корнем — запись оверлея: back закрывает его, а не уходит со страницы.
    expect(h.canGoBack).toBe(true);
    expect((window.history.state as { root: number }).root).toBe(
      (window.history.state as { idx: number }).idx - 1,
    );
  });

  it('pushOverlay marks the entry as an overlay without notifying', () => {
    let hits = 0;
    const off = h.listen(() => { hits += 1; });
    h.pushOverlay();
    expect(h.onOverlayEntry).toBe(true);
    expect(hits).toBe(0);
    off();
  });
});

describe('browserHistoryAdapter — гард ухода', () => {
  let go: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    window.history.replaceState({ idx: 0 }, '', '/');
    go = vi.spyOn(window.history, 'go').mockImplementation(() => {});
  });
  afterEach(() => {
    h.setLeaveGuard!(null);
    h.setBackInterceptor(null);
    go.mockRestore();
  });

  // Приземление траверса, как в браузере: location уже на записи, затем popstate.
  const land = (state: unknown, url: string) => {
    window.history.replaceState(state, '', url);
    window.dispatchEvent(new PopStateEvent('popstate', { state }));
  };

  const block = () => {
    const state = { retry: null as null | (() => void), calls: 0 };
    h.setLeaveGuard!({ blocked: () => true, onBlocked: (r) => { state.calls += 1; state.retry = r; } });
    return state;
  };

  it('push/replace при dirty не пишут историю; retry выполняет их мимо гарда; force — сразу', () => {
    h.push('/page');
    const g = block();
    h.push('/next');
    expect(window.location.pathname).toBe('/page');
    expect(g.calls).toBe(1);
    g.retry!();
    expect(window.location.pathname).toBe('/next');

    h.replace('/other');
    expect(window.location.pathname).toBe('/next');
    g.retry!();
    expect(window.location.pathname).toBe('/other');

    h.push('/forced', { force: true });
    expect(window.location.pathname).toBe('/forced');
    expect(g.calls).toBe(2);
  });

  it('back при dirty: молча откатывает траверс; confirm — после отката; retry повторяет траверс', () => {
    h.push('/list');
    const list = window.history.state;
    h.push('/info');
    const info = window.history.state;
    let hits = 0;
    const off = h.listen(() => { hits += 1; });
    const g = block();

    land(list, '/list'); // браузер ушёл на /list
    expect(go).toHaveBeenLastCalledWith(1);
    expect(g.calls).toBe(0);
    expect(hits).toBe(0);

    land(info, '/info'); // откат осел
    expect(g.calls).toBe(1);
    expect(hits).toBe(0);

    g.retry!();
    expect(go).toHaveBeenLastCalledWith(-1);
    land(list, '/list');
    expect(hits).toBe(1);
    expect(h.action).toBe('back');
    off();
  });

  it('прыжок на несколько записей назад откатывается и повторяется на точную дельту', () => {
    h.push('/a');
    const a = window.history.state;
    h.push('/b');
    h.push('/c');
    const c = window.history.state;
    const g = block();
    land(a, '/a');
    expect(go).toHaveBeenLastCalledWith(2);
    land(c, '/c');
    g.retry!();
    expect(go).toHaveBeenLastCalledWith(-2);
    // Приземлить повтор — иначе модульный leaveRetryIdx протечёт в следующий тест.
    land(a, '/a');
  });

  it('back, поглощённый оверлеем, гард не спрашивает', () => {
    h.push('/x');
    const x = window.history.state;
    h.pushOverlay();
    const g = block();
    h.setBackInterceptor(() => true);
    window.dispatchEvent(new PopStateEvent('popstate', { state: x }));
    expect(go).not.toHaveBeenCalled();
    expect(g.calls).toBe(0);
  });

  it('«вперёд» при dirty: откат; на «Уйти» — назначение новой записью (forward-хвост стёр confirm)', () => {
    h.push('/a');
    const a = window.history.state;
    h.push('/b');
    const b = window.history.state;
    land(a, '/a'); // назад на /a, гарда ещё нет
    let hits = 0;
    const off = h.listen(() => { hits += 1; });
    const g = block();

    land(b, '/b'); // браузер ушёл вперёд — location уже на назначении
    expect(go).toHaveBeenLastCalledWith(-1);
    expect(hits).toBe(0);

    land(a, '/a'); // откат осел
    expect(g.calls).toBe(1);

    g.retry!();
    expect(window.location.pathname).toBe('/b');
    expect(h.action).toBe('forward');
    expect(hits).toBe(1);
    off();
  });

  it('случайный popstate на чужую idx не принимается за приземление отката', () => {
    h.push('/list');
    const list = window.history.state;
    h.push('/info');
    const info = window.history.state;
    let hits = 0;
    const off = h.listen(() => { hits += 1; });
    const g = block();

    land(list, '/list'); // откат запущен
    expect(go).toHaveBeenLastCalledWith(1);
    h.setLeaveGuard!(null);
    land({ idx: 99, root: 0 }, '/elsewhere'); // не откат — обрабатывается штатно
    expect(g.calls).toBe(0);
    expect(hits).toBe(1);

    land(info, '/info'); // флаг сброшен — confirm не открывается
    expect(g.calls).toBe(0);
    off();
  });

  it('popstate на запись без числового idx: гард не срабатывает, роутер уведомлён', () => {
    h.push('/page');
    let hits = 0;
    const off = h.listen(() => { hits += 1; });
    const g = block();
    go.mockClear();

    land(null, '/page#anchor');
    expect(go).not.toHaveBeenCalled();
    expect(g.calls).toBe(0);
    expect(hits).toBe(1);
    off();
  });

  it('приземление повтора обрабатывается раньше back-интерцептора оверлеев', () => {
    h.push('/list');
    const list = window.history.state;
    h.push('/info');
    const info = window.history.state;
    let hits = 0;
    const off = h.listen(() => { hits += 1; });
    const g = block();

    land(list, '/list');
    land(info, '/info');
    g.retry!();
    let asked = 0;
    h.setBackInterceptor(() => { asked += 1; return true; });
    land(list, '/list');
    expect(asked).toBe(0);
    expect(hits).toBe(1);
    off();
  });

  it('«вперёд» на синтетическую запись той же страницы гард не спрашивает', () => {
    h.push('/x');
    const x = window.history.state;
    h.pushOverlay();
    const overlay = window.history.state;
    land(x, '/x'); // оверлей закрыт крестиком — его запись осталась хвостом
    const g = block();
    go.mockClear();

    land(overlay, '/x');
    expect(go).not.toHaveBeenCalled();
    expect(g.calls).toBe(0);
  });

  it('push на ту же страницу (меняется только hash) идёт мимо гарда', () => {
    h.push('/p?q=1');
    const g = block();
    h.push('/p?q=1#h');
    expect(g.calls).toBe(0);
    expect(window.location.hash).toBe('#h');

    h.push('/p?q=2');
    expect(g.calls).toBe(1);
    expect(window.location.search).toBe('?q=1');
  });
});
