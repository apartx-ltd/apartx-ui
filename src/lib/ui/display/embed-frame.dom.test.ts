// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import Host from './__fixtures__/EmbedFrameHost.svelte';
import { originOf } from './embed-frame';

const SRC = 'https://widget.test/verify?sessionId=s1';
const READY = { type: 'x', status: 'ready' };

let comp: any = null;
let target: HTMLElement;
const byTestId = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;

function setup(props: Record<string, unknown> = {}) {
  target = document.createElement('div');
  document.body.appendChild(target);
  comp = mount(Host as any, {
    target,
    props: { src: SRC, isReady: (d: any) => d?.status === 'ready', ...props } as any,
  });
  flushSync();
  return comp;
}

function message(data: unknown, origin = 'https://widget.test') {
  window.dispatchEvent(new MessageEvent('message', { data, origin }));
  flushSync();
}

afterEach(() => {
  vi.useRealTimers();
  if (comp) unmount(comp);
  comp = null;
  target?.remove();
});

describe('originOf', () => {
  it('origin из src, пусто для null и битого URL', () => {
    expect(originOf(SRC)).toBe('https://widget.test');
    expect(originOf(null)).toBe('');
    expect(originOf('::nope')).toBe('');
    expect(originOf('/verify?sessionId=s1')).toBe(''); // относительный — не доверяем
  });
});

describe('EmbedFrame', () => {
  it('без src кадра нет, лоадер стоит', () => {
    setup({ src: null });
    expect(byTestId('embed-iframe')).toBeNull();
    expect(byTestId('embed-loading')).not.toBeNull();
  });

  it('src задан — кадр есть, лоадер поверх до рукопожатия', () => {
    setup();
    const iframe = byTestId('embed-iframe') as HTMLIFrameElement;
    expect(iframe?.getAttribute('src')).toBe(SRC);
    expect(byTestId('embed-loading')).not.toBeNull();
  });

  it('сообщение с чужого origin отброшено: лоадер остаётся, onMessage не зван', () => {
    const onMessage = vi.fn();
    setup({ onMessage });
    message(READY, 'https://evil.test');
    expect(byTestId('embed-loading')).not.toBeNull();
    expect(onMessage).not.toHaveBeenCalled();
  });

  it('рукопожатие снимает лоадер и уходит в onStatusChange, в onMessage не попадает', () => {
    const onMessage = vi.fn();
    const onStatusChange = vi.fn();
    setup({ onMessage, onStatusChange });
    message(READY);
    expect(byTestId('embed-loading')).toBeNull();
    expect(onStatusChange).toHaveBeenLastCalledWith('ready');
    expect(onMessage).not.toHaveBeenCalled();
  });

  it('доменное сообщение со своего origin доходит до onMessage вместе с post', () => {
    const onMessage = vi.fn();
    setup({ onMessage });
    message({ type: 'x', status: 'closed' });
    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(onMessage.mock.calls[0][0]).toEqual({ type: 'x', status: 'closed' });
    expect(typeof onMessage.mock.calls[0][1]).toBe('function');
  });

  it('таймаут без рукопожатия показывает снипет timeout; поздний ready снимает его', () => {
    vi.useFakeTimers();
    const onStatusChange = vi.fn();
    setup({ timeoutMs: 1000, onStatusChange });
    vi.advanceTimersByTime(1001);
    flushSync();
    expect(byTestId('embed-retry')).not.toBeNull();
    expect(onStatusChange).toHaveBeenLastCalledWith('timeout');
    message(READY);
    expect(byTestId('embed-retry')).toBeNull();
    expect(onStatusChange).toHaveBeenLastCalledWith('ready');
  });

  it('timeoutMs=0 — таймаута нет', () => {
    vi.useFakeTimers();
    setup({ timeoutMs: 0 });
    vi.advanceTimersByTime(60_000);
    flushSync();
    expect(byTestId('embed-retry')).toBeNull();
    expect(byTestId('embed-loading')).not.toBeNull();
  });

  it('retry() пересоздаёт кадр и возвращает лоадер', () => {
    vi.useFakeTimers();
    const host = setup({ timeoutMs: 1000 });
    const before = byTestId('embed-iframe');
    vi.advanceTimersByTime(1001);
    flushSync();
    host.retry();
    flushSync();
    const after = byTestId('embed-iframe');
    expect(after).not.toBe(before);
    expect(byTestId('embed-loading')).not.toBeNull();
    expect(byTestId('embed-retry')).toBeNull();
  });

  it('post() шлёт в contentWindow кадра на его origin', () => {
    const host = setup();
    const iframe = byTestId('embed-iframe') as HTMLIFrameElement;
    const spy = vi.spyOn(iframe.contentWindow as Window, 'postMessage');
    host.post({ type: 'help:back' });
    expect(spy).toHaveBeenCalledWith({ type: 'help:back' }, 'https://widget.test');
  });
});
