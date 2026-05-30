import type { TransitionConfig } from 'svelte/transition';
import { cubicOut } from 'svelte/easing';

/**
 * Overlay transitions for the kit (dialogs, drawers, sheets).
 *
 * Each is a Svelte transition function — use directly with `transition:`,
 * `in:`, or `out:`. They read `prefers-reduced-motion` at the moment the
 * transition starts and collapse to an instant opacity fade when it's set,
 * so callers never have to branch. Easing follows the M3 standard curve.
 */

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Scrim / backdrop fade. */
export function overlayFade(_node: Element, { duration = 200 } = {}): TransitionConfig {
  return {
    duration: prefersReducedMotion() ? 0 : duration,
    easing: cubicOut,
    css: (t) => `opacity:${t}`,
  };
}

/** Centered dialog: fade with a subtle rise + scale (M3 dialog enter). */
export function dialogPop(_node: Element, { duration = 220 } = {}): TransitionConfig {
  if (prefersReducedMotion()) return { duration: 0, css: (t) => `opacity:${t}` };
  return {
    duration,
    easing: cubicOut,
    // u = 1 - t (1 = pre-enter / fully displaced, 0 = settled).
    css: (t, u) => `opacity:${t};transform:translateY(${8 * u}px) scale(${0.96 + 0.04 * t})`,
  };
}

export type SheetSide = 'left' | 'right' | 'top' | 'bottom';

/** Edge sheet: slide in/out from a side (drawer, fullscreen mobile dialog). */
export function sheet(
  _node: Element,
  { duration = 260, side = 'right' as SheetSide } = {},
): TransitionConfig {
  if (prefersReducedMotion()) return { duration: 0, css: (t) => `opacity:${t}` };
  const axis = side === 'left' || side === 'right' ? 'X' : 'Y';
  const sign = side === 'right' || side === 'bottom' ? 1 : -1;
  return {
    duration,
    easing: cubicOut,
    // u = 1 - t: starts fully off-screen toward `side`, settles at 0.
    css: (_t, u) => `transform:translate${axis}(${sign * 100 * u}%)`,
  };
}
