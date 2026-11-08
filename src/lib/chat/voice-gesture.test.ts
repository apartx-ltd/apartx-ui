import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createVoiceGesture, SLIDE_CANCEL_PX, SLIDE_LOCK_PX, TAP_MS, HINT_MS } from './voice-gesture.svelte';
import type { VoiceRecorder } from './types';

// The gesture is driven with plain event objects: what it reads is clientX/clientY/button/key and
// `currentTarget.setPointerCapture` when present.

function makeVoice(over: Partial<VoiceRecorder> = {}) {
  const voice = {
    recording: false,
    seconds: 0,
    start: vi.fn(() => { voice.recording = true; }),
    stop: vi.fn(async () => { voice.recording = false; }),
    cancel: vi.fn(() => { voice.recording = false; }),
    ...over,
  };
  return voice;
}

const ev = (over: Record<string, unknown> = {}) =>
  ({ clientX: 100, clientY: 500, button: 0, preventDefault: vi.fn(), currentTarget: null, ...over }) as unknown as PointerEvent;

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('voice gesture — hold recorder', () => {
  it('pointerdown starts the recording; a release after TAP_MS sends it', async () => {
    const voice = makeVoice();
    const g = createVoiceGesture(() => voice);
    g.onpointerdown(ev());
    expect(voice.start).toHaveBeenCalledTimes(1);
    expect(g.phase).toBe('holding');

    vi.advanceTimersByTime(TAP_MS);
    g.onpointerup(ev());
    expect(g.phase).toBe('idle');
    expect(g.sending).toBe(true);
    expect(voice.stop).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(0);
    expect(g.sending).toBe(false);
    expect(voice.cancel).not.toHaveBeenCalled();
  });

  it('a short tap drops the recording and shows the "hold to record" hint for HINT_MS', () => {
    const voice = makeVoice();
    const g = createVoiceGesture(() => voice);
    g.onpointerdown(ev());
    vi.advanceTimersByTime(TAP_MS - 1);
    g.onpointerup(ev());
    expect(voice.cancel).toHaveBeenCalledTimes(1);
    expect(voice.stop).not.toHaveBeenCalled();
    expect(g.phase).toBe('idle');
    expect(g.hint).toBe(true);
    vi.advanceTimersByTime(HINT_MS);
    expect(g.hint).toBe(false);
  });

  it('sliding left by SLIDE_CANCEL_PX cancels; the release afterwards does nothing', () => {
    const voice = makeVoice();
    const g = createVoiceGesture(() => voice);
    g.onpointerdown(ev());
    g.onpointermove(ev({ clientX: 100 - SLIDE_CANCEL_PX / 2 }));
    expect(g.dx).toBe(-SLIDE_CANCEL_PX / 2);
    expect(g.phase).toBe('holding');
    g.onpointermove(ev({ clientX: 100 - SLIDE_CANCEL_PX }));
    expect(g.phase).toBe('idle');
    expect(g.dx).toBe(0);
    expect(voice.cancel).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(TAP_MS);
    g.onpointerup(ev());
    expect(voice.stop).not.toHaveBeenCalled();
    expect(g.hint).toBe(false);
  });

  it('sliding up by SLIDE_LOCK_PX locks: the release does nothing, send()/cancel() finish it', async () => {
    const voice = makeVoice();
    const g = createVoiceGesture(() => voice);
    g.onpointerdown(ev());
    g.onpointermove(ev({ clientX: 90, clientY: 500 - SLIDE_LOCK_PX }));
    expect(g.phase).toBe('locked');
    expect(g.dx).toBe(0);
    g.onpointerup(ev());
    expect(g.phase).toBe('locked');
    expect(voice.stop).not.toHaveBeenCalled();

    await g.send();
    expect(voice.stop).toHaveBeenCalledTimes(1);
    expect(g.phase).toBe('idle');

    g.onpointerdown(ev());
    g.onpointermove(ev({ clientY: 500 - SLIDE_LOCK_PX }));
    g.cancel();
    expect(voice.cancel).toHaveBeenCalledTimes(1);
    expect(g.phase).toBe('idle');
  });

  it('a horizontal drag to the right or a small one keeps holding; dx never goes positive', () => {
    const voice = makeVoice();
    const g = createVoiceGesture(() => voice);
    g.onpointerdown(ev());
    g.onpointermove(ev({ clientX: 140 }));
    expect(g.dx).toBe(0);
    g.onpointermove(ev({ clientX: 80, clientY: 520 }));
    expect(g.dx).toBe(-20);
    expect(g.phase).toBe('holding');
  });

  it('Enter / Space on the mic start a locked recording and swallow the key', () => {
    const voice = makeVoice();
    const g = createVoiceGesture(() => voice);
    const e = { key: 'Enter', preventDefault: vi.fn() } as unknown as KeyboardEvent;
    g.onkeydown(e);
    expect(e.preventDefault).toHaveBeenCalled();
    expect(g.phase).toBe('locked');
    expect(voice.start).toHaveBeenCalledTimes(1);
    // Other keys are ignored while idle or locked.
    g.cancel();
    g.onkeydown({ key: 'a', preventDefault: vi.fn() } as unknown as KeyboardEvent);
    expect(g.phase).toBe('idle');
  });

  it('pointercancel while holding drops the recording', () => {
    const voice = makeVoice();
    const g = createVoiceGesture(() => voice);
    g.onpointerdown(ev());
    g.onpointercancel(ev());
    expect(voice.cancel).toHaveBeenCalledTimes(1);
    expect(g.phase).toBe('idle');
  });

  it('a second pointer, a non-primary button, a missing recorder or a send in flight do not start', async () => {
    const voice = makeVoice({ stop: vi.fn(() => new Promise<void>(() => {})) });
    const g = createVoiceGesture(() => voice);
    g.onpointerdown(ev({ button: 2 }));
    expect(voice.start).not.toHaveBeenCalled();
    g.onpointerdown(ev());
    g.onpointerdown(ev());
    expect(voice.start).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(TAP_MS);
    g.onpointerup(ev());
    expect(g.sending).toBe(true);
    g.onpointerdown(ev());
    expect(voice.start).toHaveBeenCalledTimes(1);

    const none = createVoiceGesture(() => null);
    none.onpointerdown(ev());
    expect(none.phase).toBe('idle');
  });

  it('sync(false) — the host stopped on its own — returns to idle without calling cancel()', () => {
    const voice = makeVoice();
    const g = createVoiceGesture(() => voice);
    g.onpointerdown(ev());
    g.sync(true);
    expect(g.phase).toBe('holding');
    g.sync(false);
    expect(g.phase).toBe('idle');
    expect(voice.cancel).not.toHaveBeenCalled();
    expect(voice.stop).not.toHaveBeenCalled();
  });

  it('dispose() drops a recording in progress and the pending hint', () => {
    const voice = makeVoice();
    const g = createVoiceGesture(() => voice);
    g.onpointerdown(ev());
    g.onpointerup(ev());
    expect(g.hint).toBe(true);
    g.onpointerdown(ev());
    g.dispose();
    expect(voice.cancel).toHaveBeenCalledTimes(2);
    expect(g.phase).toBe('idle');
    vi.advanceTimersByTime(HINT_MS);
  });

  it('captures the pointer on the mic and releases it when the gesture ends', () => {
    const voice = makeVoice();
    const g = createVoiceGesture(() => voice);
    const el = { setPointerCapture: vi.fn(), releasePointerCapture: vi.fn() };
    g.onpointerdown(ev({ currentTarget: el, pointerId: 7 }));
    expect(el.setPointerCapture).toHaveBeenCalledWith(7);
    g.onpointermove(ev({ clientY: 500 - SLIDE_LOCK_PX }));
    expect(el.releasePointerCapture).toHaveBeenCalledWith(7);
  });
});

describe('voice gesture — tap recorder (native modal)', () => {
  it('pointer and keys are ignored; a click starts a locked recording; send()/cancel() finish it', async () => {
    const voice = makeVoice({ interaction: 'tap' });
    const g = createVoiceGesture(() => voice);
    g.onpointerdown(ev());
    g.onkeydown({ key: 'Enter', preventDefault: vi.fn() } as unknown as KeyboardEvent);
    expect(voice.start).not.toHaveBeenCalled();
    g.onclick();
    expect(voice.start).toHaveBeenCalledTimes(1);
    expect(g.phase).toBe('locked');
    g.onclick();
    expect(voice.start).toHaveBeenCalledTimes(1);
    await g.send();
    expect(voice.stop).toHaveBeenCalledTimes(1);
    expect(g.phase).toBe('idle');
  });

  it('a hold recorder ignores the click that follows pointerup', () => {
    const voice = makeVoice();
    const g = createVoiceGesture(() => voice);
    g.onclick();
    expect(voice.start).not.toHaveBeenCalled();
  });
});
