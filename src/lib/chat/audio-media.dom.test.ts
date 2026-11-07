// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { mount, unmount, flushSync, tick } from 'svelte';
import AudioMedia from './slots/AudioMedia.svelte';
import Harness from './audio-media.harness.svelte';
import type { Message } from './types';

// Real-DOM test of the voice player slot. Pure arithmetic (bars, progress, seek fraction, time label,
// the one-player-at-a-time coordinator) is covered in helpers.test.ts; here — what needs a DOM: which
// controls render, how play/pause drives the <audio>, the waveform seek, and the transcript button.

const mounted: any[] = [];
let target: HTMLElement;

const msg = (file: Record<string, any> = {}, over: Partial<Message> = {}): Message =>
  ({
    _id: 'm1', chatId: 'c', userId: 'u1', type: 'audio', createdAt: new Date('2026-11-07T10:00:00Z'),
    meta: { file: { url: 'https://cdn/voice.m4a', type: 'audio/mp4', duration: 42, ...file } },
    ...over,
  }) as Message;

function render(props: Record<string, any>) {
  target = document.createElement('div');
  document.body.appendChild(target);
  const comp = mount(AudioMedia, { target, props: props as any });
  mounted.push(comp);
  flushSync();
  return { el: target, comp };
}

const q = (el: HTMLElement, id: string) => el.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const click = (node: HTMLElement | null) => {
  node!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  flushSync();
};

// jsdom has no media playback: play()/pause() throw "not implemented". Emulate the element firing
// its own events, the way a browser does.
beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLMediaElement) {
    Object.defineProperty(this, 'paused', { value: false, configurable: true });
    this.dispatchEvent(new Event('play'));
    return Promise.resolve();
  });
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function (this: HTMLMediaElement) {
    if (this.paused) return;
    Object.defineProperty(this, 'paused', { value: true, configurable: true });
    this.dispatchEvent(new Event('pause'));
  });
});

afterEach(() => {
  while (mounted.length) unmount(mounted.pop());
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('AudioMedia — player', () => {
  it('processing file → the stub, no player', () => {
    const { el } = render({ message: msg({ status: 'processing' }) });
    expect(q(el, 'chat-audio-processing')).not.toBe(null);
    expect(q(el, 'chat-audio')).toBe(null);
  });

  it('processing stub is the player skeleton: still bars, the label in the time slot, no controls', () => {
    const { el } = render({ message: msg({ status: 'processing' }) });
    const stub = q(el, 'chat-audio-processing')!;
    expect(stub.getAttribute('role')).toBe('status');
    expect(stub.querySelectorAll('.animate-pulse > span')).toHaveLength(48);
    expect(stub.querySelector('button')).toBe(null);
    expect(stub.textContent).toContain('Processing audio…');
  });

  it('48 bars from the waveform, total duration shown, hidden <audio preload=metadata>', () => {
    const waveform = Array.from({ length: 48 }, (_, i) => (i === 0 ? 31 : 0));
    const { el } = render({ message: msg({ waveform }) });
    const bars = Array.from(el.querySelectorAll('[data-testid="chat-audio-bar"]')) as HTMLElement[];
    expect(bars).toHaveLength(48);
    expect(bars[0].style.height).toBe('20px'); // peak
    expect(bars[1].style.height).toBe('2px'); // silence still a dot
    expect(q(el, 'chat-audio-time')!.textContent).toBe('0:42');
    const audio = el.querySelector('audio')!;
    expect(audio.getAttribute('preload')).toBe('metadata');
    expect(audio.getAttribute('src')).toBe('https://cdn/voice.m4a');
  });

  it('no waveform → uniform low bars', () => {
    const { el } = render({ message: msg() });
    const heights = new Set(Array.from(el.querySelectorAll('[data-testid="chat-audio-bar"]')).map((b) => (b as HTMLElement).style.height));
    expect(heights.size).toBe(1);
  });

  it('play/pause toggles the element and the button state', () => {
    const { el } = render({ message: msg() });
    const btn = q(el, 'chat-audio-play')!;
    expect(btn.getAttribute('aria-label')).toBe('Play');
    click(btn);
    expect(btn.dataset.state).toBe('playing');
    expect(btn.getAttribute('aria-label')).toBe('Pause');
    click(btn);
    expect(btn.dataset.state).toBe('paused');
  });

  it('a press on the player does not reach the row (tap-to-menu)', () => {
    const onRow = vi.fn();
    target = document.createElement('div');
    document.body.appendChild(target);
    mounted.push(mount(Harness, { target, props: { initial: msg(), onRow } }));
    flushSync();
    click(q(target, 'chat-audio-play'));
    click(q(target, 'chat-audio-wave'));
    expect(onRow).not.toHaveBeenCalled();
    click(q(target, 'chat-audio-time')); // sanity: the rest of the bubble still opens the menu
    expect(onRow).toHaveBeenCalledTimes(1);
  });

  it('starting a second player pauses the first', () => {
    const a = render({ message: msg() }).el;
    const b = render({ message: msg({ url: 'https://cdn/other.m4a' }, { _id: 'm2' }) }).el;
    click(q(a, 'chat-audio-play'));
    click(q(b, 'chat-audio-play'));
    expect(q(a, 'chat-audio-play')!.dataset.state).toBe('paused');
    expect(q(b, 'chat-audio-play')!.dataset.state).toBe('playing');
  });

  it('tap on the waveform seeks; elapsed time and played bars follow', () => {
    const { el } = render({ message: msg({ duration: 40 }) });
    const wave = q(el, 'chat-audio-wave')!;
    wave.getBoundingClientRect = () => ({ left: 100, width: 200, top: 0, height: 20, right: 300, bottom: 20, x: 100, y: 0, toJSON() {} }) as DOMRect;
    wave.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 200 }));
    flushSync();
    expect(el.querySelector('audio')!.currentTime).toBe(20);
    expect(q(el, 'chat-audio-time')!.textContent).toBe('0:20');
    expect(el.querySelectorAll('[data-played="true"]')).toHaveLength(24);
    expect(wave.getAttribute('aria-valuenow')).toBe('20');
  });

  it('arrow keys seek by 5s on the slider', () => {
    const { el } = render({ message: msg({ duration: 40 }) });
    const wave = q(el, 'chat-audio-wave')!;
    wave.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    flushSync();
    expect(el.querySelector('audio')!.currentTime).toBe(5);
    wave.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    flushSync();
    expect(el.querySelector('audio')!.currentTime).toBe(40);
  });

  it('an unplayable source → a disabled error button, no spinner', () => {
    const { el } = render({ message: msg() });
    el.querySelector('audio')!.dispatchEvent(new Event('error'));
    flushSync();
    const btn = q(el, 'chat-audio-play') as HTMLButtonElement;
    expect(btn.dataset.state).toBe('error');
    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute('aria-label')).toBe("Couldn't play the voice message");
  });
});

describe('AudioMedia — transcript', () => {
  it('no handler → no button (other kit consumers get just the player)', () => {
    const { el } = render({ message: msg({ transcript: 'hello' }) });
    expect(q(el, 'chat-audio-transcribe')).toBe(null);
  });

  it('ready transcript → toggles without calling the handler', () => {
    const onTranscribe = vi.fn();
    const { el } = render({ message: msg({ transcript: 'Hello there' }), onTranscribe });
    const btn = q(el, 'chat-audio-transcribe')!;
    expect(btn.getAttribute('aria-label')).toBe('Transcribe');
    click(btn);
    expect(q(el, 'chat-audio-transcript')!.textContent).toBe('Hello there');
    expect(btn.getAttribute('aria-label')).toBe('Hide transcript');
    click(btn);
    expect(q(el, 'chat-audio-transcript')).toBe(null);
    expect(onTranscribe).not.toHaveBeenCalled();
  });

  it('no transcript → calls the handler with the message, spinner, then shows the re-pushed text', async () => {
    let resolve!: (v: unknown) => void;
    const onTranscribe = vi.fn(() => new Promise((r) => { resolve = r; }));
    const message = msg();
    const { el } = render({ message, onTranscribe });
    const btn = q(el, 'chat-audio-transcribe') as HTMLButtonElement;
    click(btn);
    expect(onTranscribe).toHaveBeenCalledWith(message);
    expect(btn.disabled).toBe(true); // Button loading
    resolve(undefined);
    await tick();
    flushSync();
    expect(btn.disabled).toBe(false);
    expect(q(el, 'chat-audio-transcript')).toBe(null); // nothing yet — waits for the re-push
  });

  it('re-push with file.transcript after the call → the text appears, kept expanded', async () => {
    const onTranscribe = vi.fn(async () => undefined);
    target = document.createElement('div');
    document.body.appendChild(target);
    const harness: any = mount(Harness, { target, props: { initial: msg(), onTranscribe } });
    mounted.push(harness);
    flushSync();
    click(q(target, 'chat-audio-transcribe'));
    await tick();
    flushSync();
    expect(q(target, 'chat-audio-transcript')).toBe(null);
    harness.push(msg({ transcript: 'From the server' }));
    flushSync();
    expect(q(target, 'chat-audio-transcript')!.textContent).toBe('From the server');
    expect(q(target, 'chat-audio-transcribe')!.getAttribute('aria-label')).toBe('Hide transcript');
  });

  it('handler resolves with { text } → shown before the re-push lands', async () => {
    const { el } = render({ message: msg(), onTranscribe: vi.fn(async () => ({ text: 'Early text' })) });
    click(q(el, 'chat-audio-transcribe'));
    await tick();
    flushSync();
    expect(q(el, 'chat-audio-transcript')!.textContent).toBe('Early text');
  });

  it('handler rejects → inline failure note; a retry clears it', async () => {
    const onTranscribe = vi.fn().mockRejectedValueOnce(new Error('nope')).mockResolvedValueOnce('ok text');
    const { el } = render({ message: msg(), onTranscribe });
    click(q(el, 'chat-audio-transcribe'));
    await tick();
    await Promise.resolve();
    flushSync();
    expect(q(el, 'chat-audio-transcribe-failed')!.textContent).toBe("Couldn't transcribe the voice message");
    click(q(el, 'chat-audio-transcribe'));
    expect(q(el, 'chat-audio-transcribe-failed')).toBe(null);
    await tick();
    await Promise.resolve();
    flushSync();
    expect(q(el, 'chat-audio-transcript')!.textContent).toBe('ok text');
  });
});
