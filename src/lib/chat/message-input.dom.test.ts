// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import Harness from './message-input.harness.svelte';
import { createComposer } from './composer.svelte';
import { TAP_MS } from './voice-gesture.svelte';
import type { ChatSession } from './session.svelte';

// Real-DOM test of the composer's microphone ↔ send swap: the mic stands in for the send button only
// with a recorder and an empty draft; a held pointer turns the field into the recording row; without a
// recorder the composer is the text-only one every consumer had.

let comp: any = null;
let target: HTMLElement;

function makeSession() {
  const composer = createComposer({ key: 'test', authorNameOf: () => 'A' });
  const send = vi.fn(async () => { composer.clear(); });
  return { composer, send } as unknown as ChatSession & { send: ReturnType<typeof vi.fn> };
}

function setup(props: Record<string, unknown> = {}) {
  target = document.createElement('div');
  document.body.appendChild(target);
  comp = mount(Harness, { target, props: { session: makeSession(), ...props } as any });
  flushSync();
  return comp as { calls: { start: number; stop: number; cancel: number }; setSeconds(n: number): void; setRecording(v: boolean): void; finishStop(): void };
}

const byTestId = (id: string) => target.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;

function pointer(el: HTMLElement, type: string, init: Record<string, unknown> = {}) {
  el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: 100, clientY: 500, ...init }));
  flushSync();
}
function typeDraft(text: string) {
  const ta = target.querySelector('textarea') as HTMLTextAreaElement;
  ta.value = text;
  ta.dispatchEvent(new Event('input', { bubbles: true }));
  flushSync();
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  if (comp) unmount(comp);
  comp = null;
  target?.remove();
  vi.useRealTimers();
});

describe('MessageInput — microphone instead of send', () => {
  it('without a recorder: the send button, as before', () => {
    setup({ hasVoice: false });
    expect(byTestId('chat-composer-send')).not.toBeNull();
    expect(byTestId('chat-composer-voice')).toBeNull();
  });

  it('with a recorder: mic while the draft is empty, send once there is text, mic again when cleared', () => {
    setup();
    expect(byTestId('chat-composer-voice')).not.toBeNull();
    expect(byTestId('chat-composer-send')).toBeNull();

    typeDraft('hello');
    expect(byTestId('chat-composer-send')).not.toBeNull();
    expect(byTestId('chat-composer-voice')).toBeNull();

    typeDraft('   ');
    expect(byTestId('chat-composer-voice')).not.toBeNull();
  });

  it('holding the mic shows the recording row with the timer; releasing sends through the recorder', async () => {
    const h = setup({ labels: { voiceSlideHint: 'Slide to cancel' } });
    const mic = byTestId('chat-composer-voice')!;
    pointer(mic, 'pointerdown');
    expect(h.calls.start).toBe(1);
    expect(mic.getAttribute('aria-pressed')).toBe('true');
    expect(byTestId('chat-composer-recording')).not.toBeNull();
    expect(target.querySelector('textarea')).toBeNull();
    expect(byTestId('chat-composer-voice-hint')!.textContent).toContain('Slide to cancel');
    expect(byTestId('chat-composer-voice-seconds')!.textContent).toBe('0:00');

    h.setSeconds(7);
    flushSync();
    expect(byTestId('chat-composer-voice-seconds')!.textContent).toBe('0:07');

    vi.advanceTimersByTime(TAP_MS);
    pointer(mic, 'pointerup');
    expect(h.calls.stop).toBe(1);
    // Send in flight: the send button, disabled, until the recorder is done.
    expect(byTestId('chat-composer-recording')).toBeNull();
    expect((byTestId('chat-composer-send') as HTMLButtonElement).disabled).toBe(true);
    h.finishStop();
    await vi.advanceTimersByTimeAsync(0);
    expect(byTestId('chat-composer-voice')).not.toBeNull();
    expect(byTestId('chat-composer-send')).toBeNull();
    expect(target.querySelector('textarea')).not.toBeNull();
    expect(h.calls.cancel).toBe(0);
  });

  it('a short tap drops the recording and shows the hold hint', () => {
    const h = setup({ labels: { voiceHoldHint: 'Hold to record' } });
    const mic = byTestId('chat-composer-voice')!;
    pointer(mic, 'pointerdown');
    pointer(mic, 'pointerup');
    expect(h.calls.cancel).toBe(1);
    expect(h.calls.stop).toBe(0);
    expect(byTestId('chat-composer-recording')).toBeNull();
    expect(byTestId('chat-composer-voice-hold-hint')!.textContent).toBe('Hold to record');
  });

  it('sliding up locks: Cancel in the row and an enabled send button; Cancel drops it', () => {
    const h = setup({ labels: { voiceCancelLabel: 'Cancel' } });
    const mic = byTestId('chat-composer-voice')!;
    pointer(mic, 'pointerdown');
    pointer(mic, 'pointermove', { clientY: 400 });
    expect(byTestId('chat-composer-voice-cancel')!.textContent).toBe('Cancel');
    expect(byTestId('chat-composer-voice-hint')).toBeNull();
    expect((byTestId('chat-composer-send') as HTMLButtonElement).disabled).toBe(false);
    byTestId('chat-composer-voice-cancel')!.click();
    flushSync();
    expect(h.calls.cancel).toBe(1);
    expect(byTestId('chat-composer-recording')).toBeNull();
    expect(byTestId('chat-composer-voice')).not.toBeNull();
  });

  it('the recorder stopping on its own (auto-stop) returns the composer to idle without cancel()', () => {
    const h = setup();
    pointer(byTestId('chat-composer-voice')!, 'pointerdown');
    expect(byTestId('chat-composer-recording')).not.toBeNull();
    h.setRecording(false);
    flushSync();
    expect(byTestId('chat-composer-recording')).toBeNull();
    expect(h.calls.cancel).toBe(0);
  });

  it('a tap recorder starts on click and shows the locked row', () => {
    const h = setup({ interaction: 'tap' });
    const mic = byTestId('chat-composer-voice')!;
    pointer(mic, 'pointerdown');
    expect(h.calls.start).toBe(0);
    mic.click();
    flushSync();
    expect(h.calls.start).toBe(1);
    expect(byTestId('chat-composer-voice-cancel')).not.toBeNull();
  });

  it('the text send button still sends the draft', async () => {
    const session = makeSession();
    setup({ session });
    typeDraft('hi');
    byTestId('chat-composer-send')!.click();
    await vi.advanceTimersByTimeAsync(0);
    expect(session.send).toHaveBeenCalledTimes(1);
  });
});
