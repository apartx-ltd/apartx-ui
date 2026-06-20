/**
 * Coarse mobile-OS detection for choosing a native-feeling page-transition style.
 *
 * Pure and SSR-safe: pass a UA string (defaults to `navigator.userAgent`, or `''`
 * on the server). iPadOS 13+ reports a desktop "Macintosh" UA — those iPads fall
 * through to `'other'`, which maps to the Material shared-axis slide (a safe,
 * documented degrade; classic iPad UAs still resolve to `'ios'`).
 */
export type MobileOS = 'ios' | 'android' | 'other';

export function detectMobileOS(
  ua: string = typeof navigator !== 'undefined' ? navigator.userAgent : '',
): MobileOS {
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'other';
}
