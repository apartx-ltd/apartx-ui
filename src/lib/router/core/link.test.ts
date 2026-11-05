// @vitest-environment jsdom
// <Link>: plain — today's behaviour (href = to, use:link); under <VirtualRouter> — the full
// real href with the fragment, and the click goes through the virtual router.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import Probe from './link.probe.svelte';
import { setHistoryAdapter } from '../history/registry';
import { configureNav, resetNavConfig } from './nav-config';
import type { HistoryAdapter, Action } from '../history/adapter';
import type { RouteSnapshot } from '../../navigation/context';

function fakeAdapter(url: string) {
  const calls: string[] = [];
  const [rest, hashPart] = url.split('#');
  const adapter: HistoryAdapter = {
    location: { pathname: rest, search: '', hash: hashPart ? `#${hashPart}` : '' } as RouteSnapshot,
    action: 'none' as Action,
    canGoBack: true,
    onOverlayEntry: false,
    listen: () => () => {},
    push: (u) => { calls.push(`push:${u}`); },
    replace: (u) => { calls.push(`replace:${u}`); },
    pushOverlay: () => {},
    restoreOverlayEntry: () => {},
    setBackInterceptor: () => {},
    goBack: () => { calls.push('goBack'); },
  };
  return { adapter, calls };
}

function mountProbe(props: { to: string; replace?: boolean; virtual?: boolean }) {
  const target = document.createElement('div');
  document.body.appendChild(target);
  const handle = mount(Probe, { target, props });
  flushSync();
  const a = target.querySelector('a')!;
  return { a, dispose: () => { unmount(handle); target.remove(); } };
}

function click(a: HTMLAnchorElement, init: MouseEventInit = {}) {
  const e = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init });
  a.dispatchEvent(e);
  return e;
}

describe('<Link>', () => {
  beforeEach(() => { setHistoryAdapter(null); resetNavConfig(); });
  afterEach(() => { setHistoryAdapter(null); resetNavConfig(); });

  it('plain Link keeps today behaviour: href = to, click → navigate', () => {
    const f = fakeAdapter('/a');
    setHistoryAdapter(f.adapter);
    const { a, dispose } = mountProbe({ to: '/x' });
    expect(a.getAttribute('href')).toBe('/x');
    expect(a.hasAttribute('data-replace')).toBe(false);
    const e = click(a);
    expect(e.defaultPrevented).toBe(true);
    expect(f.calls).toEqual(['push:/x']);
    dispose();
  });

  it('plain Link with replace sets data-replace and replaces', () => {
    const f = fakeAdapter('/a');
    setHistoryAdapter(f.adapter);
    const { a, dispose } = mountProbe({ to: '/x', replace: true });
    expect(a.hasAttribute('data-replace')).toBe(true);
    click(a);
    expect(f.calls).toEqual(['replace:/x']);
    dispose();
  });

  it('Link under VirtualRouter renders the full href with the fragment and pushes virtually', () => {
    const f = fakeAdapter('/a#panel=/x');
    setHistoryAdapter(f.adapter);
    const origins: (string | undefined)[] = [];
    configureNav({ intercept: (to, from) => { origins.push(from.origin); return to; } });
    const { a, dispose } = mountProbe({ to: '/accounts/properties/p1/info', virtual: true });
    expect(a.href.endsWith('/a#panel=/properties/p1/info')).toBe(true);
    const e = click(a);
    expect(e.defaultPrevented).toBe(true);
    expect(f.calls).toEqual(['push:/a#panel=/properties/p1/info']);
    expect(origins).toEqual(['panel']);
    dispose();
  });

  it('Link under VirtualRouter with replace replaces virtually', () => {
    const f = fakeAdapter('/a#panel=/x');
    setHistoryAdapter(f.adapter);
    const { a, dispose } = mountProbe({ to: '/accounts/properties/p1/info', replace: true, virtual: true });
    click(a);
    expect(f.calls).toEqual(['replace:/a#panel=/properties/p1/info']);
    dispose();
  });

  it('modified clicks under VirtualRouter fall through to the browser', () => {
    const f = fakeAdapter('/a#panel=/x');
    setHistoryAdapter(f.adapter);
    const { a, dispose } = mountProbe({ to: '/accounts/properties/p1/info', virtual: true });
    for (const init of [{ metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { button: 1 }]) {
      const e = click(a, init);
      expect(e.defaultPrevented).toBe(false);
    }
    expect(f.calls).toEqual([]);
    dispose();
  });
});
