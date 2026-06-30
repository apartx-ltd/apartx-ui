import type { ChatT } from './types';

/**
 * i18n seam. The kit never imports an i18n lib (CLAUDE.md). The host injects a translate function once; until then a
 * pass-through default returns the key's `defaultValue` opt or the key itself.
 */
let t: ChatT = (key, opts) => (opts && typeof opts.defaultValue === 'string' ? opts.defaultValue : key);

export function setChatI18n(fn: ChatT): void { t = fn; }
export function chatT(key: string, opts?: Record<string, any>): string { return t(key, opts); }
