import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import relativeTime from 'dayjs/plugin/relativeTime';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import duration from 'dayjs/plugin/duration';
import isBetween from 'dayjs/plugin/isBetween';
import customParseFormat from 'dayjs/plugin/customParseFormat';

import 'dayjs/locale/ru';
import 'dayjs/locale/en';
import 'dayjs/locale/kk';
import 'dayjs/locale/tr';

// Extend dayjs with plugins
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);
dayjs.extend(localizedFormat);
dayjs.extend(duration);
dayjs.extend(isBetween);
dayjs.extend(customParseFormat);

export { dayjs };

/**
 * Set dayjs locale globally.
 */
export function setDateLocale(locale: string) {
  dayjs.locale(locale);
}

/**
 * Format a date for display (localized).
 */
export function formatDate(date: Date | string | number, format = 'DD.MM.YYYY'): string {
  return dayjs(date).format(format);
}

/**
 * Format a date-time for display.
 */
export function formatDateTime(date: Date | string | number, format = 'DD.MM.YYYY HH:mm'): string {
  return dayjs(date).format(format);
}

/**
 * Get relative time string (e.g. "2 hours ago").
 */
export function fromNow(date: Date | string | number): string {
  return dayjs(date).fromNow();
}
