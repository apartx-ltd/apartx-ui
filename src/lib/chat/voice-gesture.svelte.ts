import type { VoiceRecorder } from './types';

// Telegram-style voice gesture for the composer microphone, kept out of MessageInput.svelte so the
// phases and thresholds are unit-testable with plain event objects. The recorder itself is the
// host's (`VoiceRecorder`); this only decides WHEN to start, send or drop it.
//
//   idle ──pointerdown──▶ holding ──release ≥ TAP_MS──▶ send   → idle
//                           │  ├──release < TAP_MS──▶ cancel + "hold to record" hint → idle
//                           │  ├──slide left ≥ SLIDE_CANCEL_PX──▶ cancel → idle
//                           │  └──slide up ≥ SLIDE_LOCK_PX──▶ locked (finger may leave)
//                           │                                   ├─ send()   → idle
//                           │                                   └─ cancel() → idle
//   Enter/Space on the mic, or a tap for `interaction: 'tap'` recorders → locked straight away.

/** Horizontal drag (px, to the left) that drops the recording. */
export const SLIDE_CANCEL_PX = 80;
/** Vertical drag (px, up) that locks the recording so the finger can leave. */
export const SLIDE_LOCK_PX = 60;
/** A release sooner than this is a tap, not a recording: dropped, with the "hold to record" hint. */
export const TAP_MS = 500;
/** How long the "hold to record" hint stays. */
export const HINT_MS = 1500;

export type VoicePhase = 'idle' | 'holding' | 'locked';

export interface VoiceGesture {
  readonly phase: VoicePhase;
  /** A short tap happened: show the "hold to record" hint until it expires. */
  readonly hint: boolean;
  /** Horizontal drag while holding (≤ 0, px) — moves the slide-to-cancel affordance. */
  readonly dx: number;
  /** `stop()` in flight: the send button is disabled until the host is done. */
  readonly sending: boolean;
  onpointerdown(e: PointerEvent): void;
  onpointermove(e: PointerEvent): void;
  onpointerup(e: PointerEvent): void;
  onpointercancel(e: PointerEvent): void;
  onkeydown(e: KeyboardEvent): void;
  /** Click on the mic: starts a `'tap'` recorder; ignored for hold recorders (their click follows pointerup). */
  onclick(): void;
  cancel(): void;
  send(): Promise<void>;
  /** The host's `recording` flag changed outside the gesture (auto-stop, chat left): `false` returns to idle. */
  sync(recording: boolean): void;
  /** Unmount: a recording in progress is dropped. */
  dispose(): void;
}

export function createVoiceGesture(getVoice: () => VoiceRecorder | null | undefined): VoiceGesture {
  let phase = $state<VoicePhase>('idle');
  let hint = $state(false);
  let dx = $state(0);
  let sending = $state(false);

  let x0 = 0;
  let y0 = 0;
  let downAt = 0;
  let hintTimer: ReturnType<typeof setTimeout> | null = null;
  let captured: { el: any; id: number } | null = null;

  const isTap = () => getVoice()?.interaction === 'tap';

  // Pointer capture keeps move/up coming to the mic while the finger slides off it. Synthetic
  // events (tests) and old engines have no capture — the gesture still works for a finger that
  // stays on the button.
  function capture(e: PointerEvent) {
    const el = e.currentTarget as any;
    if (!el || typeof el.setPointerCapture !== 'function') return;
    try {
      el.setPointerCapture(e.pointerId);
      captured = { el, id: e.pointerId };
    } catch {
      captured = null;
    }
  }
  function release() {
    if (!captured) return;
    try {
      captured.el.releasePointerCapture(captured.id);
    } catch {
      /* already released */
    }
    captured = null;
  }

  function showHint() {
    hint = true;
    if (hintTimer) clearTimeout(hintTimer);
    hintTimer = setTimeout(() => {
      hintTimer = null;
      hint = false;
    }, HINT_MS);
  }

  function begin(next: 'holding' | 'locked'): boolean {
    const voice = getVoice();
    if (!voice || phase !== 'idle' || sending) return false;
    hint = false;
    dx = 0;
    voice.start();
    phase = next;
    return true;
  }

  function cancel() {
    release();
    if (phase === 'idle') return;
    phase = 'idle';
    dx = 0;
    getVoice()?.cancel();
  }

  async function send() {
    release();
    if (phase === 'idle' || sending) return;
    phase = 'idle';
    dx = 0;
    const voice = getVoice();
    if (!voice) return;
    sending = true;
    try {
      await voice.stop();
    } finally {
      sending = false;
    }
  }

  return {
    get phase() { return phase; },
    get hint() { return hint; },
    get dx() { return dx; },
    get sending() { return sending; },

    onpointerdown(e) {
      if (isTap() || (e.button != null && e.button !== 0)) return;
      if (!begin('holding')) return;
      // No focus move, no text selection, no synthetic mouse events behind the touch.
      e.preventDefault();
      x0 = e.clientX;
      y0 = e.clientY;
      downAt = Date.now();
      capture(e);
    },
    onpointermove(e) {
      if (phase !== 'holding') return;
      const moveX = e.clientX - x0;
      const moveY = e.clientY - y0;
      if (moveX <= -SLIDE_CANCEL_PX) return cancel();
      if (moveY <= -SLIDE_LOCK_PX) {
        release();
        dx = 0;
        phase = 'locked';
        return;
      }
      dx = Math.min(0, moveX);
    },
    onpointerup() {
      if (phase !== 'holding') return;
      if (Date.now() - downAt < TAP_MS) {
        cancel();
        showHint();
        return;
      }
      void send();
    },
    onpointercancel() {
      // The browser took the pointer (scroll, system gesture): nothing to send.
      if (phase === 'holding') cancel();
    },
    onkeydown(e) {
      if (isTap() || (e.key !== 'Enter' && e.key !== ' ')) return;
      // Also swallows the synthetic click a button fires on Enter/Space.
      e.preventDefault();
      begin('locked');
    },
    onclick() {
      if (!isTap()) return;
      begin('locked');
    },
    cancel,
    send,
    sync(recording) {
      if (recording || phase === 'idle') return;
      release();
      phase = 'idle';
      dx = 0;
    },
    dispose() {
      if (hintTimer) clearTimeout(hintTimer);
      hintTimer = null;
      cancel();
    },
  };
}
