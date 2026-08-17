import { getContext, setContext } from 'svelte';

/**
 * Host-provided locale for the UI Kit.
 *
 * The kit never owns i18n — all user-facing text is a prop with an English
 * default. But locale-driven *formatting* (date segment order in the pickers,
 * weekday names, month headings) needs a BCP 47 tag. A host injects it once
 * near the root via `setLocale`; locale-aware components (`DatePicker`,
 * `DateRangePicker`, `RangeCalendar`) read it through `getLocale` and fall
 * back to English when none was provided. Pass a getter so the value stays
 * reactive when the user switches language at runtime.
 */

const LOCALE_KEY = Symbol('apartx-ui:locale');

/** Reactive accessor for the host's current locale (BCP 47, e.g. 'ru'). */
export type LocaleGetter = () => string | undefined;

/** Call during component init (e.g. a root layout) to wire the kit to your i18n. */
export function setLocale(get: LocaleGetter): void {
  setContext(LOCALE_KEY, get);
}

/** Read the locale getter, if a host provided one. */
export function getLocale(): LocaleGetter | undefined {
  return getContext<LocaleGetter | undefined>(LOCALE_KEY);
}
