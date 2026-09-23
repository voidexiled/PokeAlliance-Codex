// Date and time formatting (spec 4.4 and 13.3). Built on Intl.DateTimeFormat
// with an explicit timeZone; nothing here depends on @js-temporal/polyfill.
import type { Locale } from '@/i18n/config';

import { UNKNOWN } from './unknown';

/** Game data (Server Save, Guild days and weeks) is read in Brasília time (A12). */
export const GAME_ZONE = 'America/Sao_Paulo';

/** Dates use es-MX, the locale of the site's Spanish. */
const DATE_LOCALE: Record<Locale, string> = { es: 'es-MX', en: 'en-US' };

const SERVER_TIME_SUFFIX: Record<Locale, string> = {
  es: '(hora de Brasilia)',
  en: '(Brasília time)',
};

/** "14/09 a 20/09" in es; en uses Intl's own range format. */
const RANGE_JOINER = 'a';

const DATE_OPTIONS: Record<Locale, Intl.DateTimeFormatOptions> = {
  es: { day: '2-digit', month: '2-digit', year: 'numeric' },
  en: { month: 'short', day: 'numeric', year: 'numeric' },
};

const TIME_OPTIONS: Record<Locale, Intl.DateTimeFormatOptions> = {
  // hourCycle is required: es-MX would otherwise print a 12 h clock.
  es: { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' },
  en: { hour: 'numeric', minute: '2-digit' },
};

const DAY_MONTH_OPTIONS: Record<Locale, Intl.DateTimeFormatOptions> = {
  es: { day: '2-digit', month: '2-digit' },
  en: { month: 'short', day: 'numeric' },
};

const WEEKDAY_OPTIONS: Record<Locale, Intl.DateTimeFormatOptions> = {
  es: { weekday: 'long' },
  en: { weekday: 'long', month: 'short', day: 'numeric' },
};

export type DateInput = Date | string | number | null | undefined;

const dateFormats = new Map<string, Intl.DateTimeFormat>();
const relativeFormats = new Map<Locale, Intl.RelativeTimeFormat>();

function dateFormat(
  kind: string,
  locale: Locale,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = `${kind}:${locale}:${timeZone}`;
  let format = dateFormats.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(DATE_LOCALE[locale], { ...options, timeZone });
    dateFormats.set(key, format);
  }
  return format;
}

function relativeFormat(locale: Locale): Intl.RelativeTimeFormat {
  let format = relativeFormats.get(locale);
  if (!format) {
    format = new Intl.RelativeTimeFormat(DATE_LOCALE[locale], { style: 'short' });
    relativeFormats.set(locale, format);
  }
  return format;
}

function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Weekday names come lowercase in es; the source text keeps its initial capital. */
function capitalize(text: string, locale: Locale): string {
  return text.charAt(0).toLocaleUpperCase(DATE_LOCALE[locale]) + text.slice(1);
}

/** "18/09/2026" in es, "Sep 18, 2026" in en. */
export function formatDate(value: DateInput, locale: Locale, timeZone = GAME_ZONE): string {
  const date = toDate(value);
  if (!date) return UNKNOWN;
  return dateFormat('date', locale, timeZone, DATE_OPTIONS[locale]).format(date);
}

/** "14:32" in es (24 h), "2:32 PM" in en. */
export function formatTime(value: DateInput, locale: Locale, timeZone = GAME_ZONE): string {
  const date = toDate(value);
  if (!date) return UNKNOWN;
  return dateFormat('time', locale, timeZone, TIME_OPTIONS[locale]).format(date);
}

/** "18/09/2026, 14:32" in es, "Sep 18, 2026, 2:32 PM" in en. */
export function formatDateTime(value: DateInput, locale: Locale, timeZone = GAME_ZONE): string {
  const date = toDate(value);
  if (!date) return UNKNOWN;
  const options = { ...DATE_OPTIONS[locale], ...TIME_OPTIONS[locale] };
  return dateFormat('dateTime', locale, timeZone, options).format(date);
}

/** A game clock reading, always in Brasília time and named as such. */
export function formatServerTime(value: DateInput, locale: Locale): string {
  const stamp = formatDateTime(value, locale, GAME_ZONE);
  return stamp === UNKNOWN ? UNKNOWN : `${stamp} ${SERVER_TIME_SUFFIX[locale]}`;
}

/** Axis of the Guild chart: "18/09" in es, "Sep 18" in en. */
export function formatDayMonth(value: DateInput, locale: Locale, timeZone = GAME_ZONE): string {
  const date = toDate(value);
  if (!date) return UNKNOWN;
  return dateFormat('dayMonth', locale, timeZone, DAY_MONTH_OPTIONS[locale]).format(date);
}

/** Compact tooltip of the Guild chart: "Viernes 18/09" in es, "Friday, Sep 18" in en. */
export function formatWeekday(value: DateInput, locale: Locale, timeZone = GAME_ZONE): string {
  const date = toDate(value);
  if (!date) return UNKNOWN;
  const weekday = dateFormat('weekday', locale, timeZone, WEEKDAY_OPTIONS[locale]).format(date);
  if (locale === 'en') return weekday;
  return `${capitalize(weekday, locale)} ${formatDayMonth(date, locale, timeZone)}`;
}

/** An interval: "14/09 a 20/09" in es, "Sep 14 – 20" in en. */
export function formatDateRange(
  from: DateInput,
  to: DateInput,
  locale: Locale,
  timeZone = GAME_ZONE,
): string {
  const start = toDate(from);
  const end = toDate(to);
  if (!start || !end) return UNKNOWN;
  if (locale === 'en') {
    return dateFormat('dayMonth', locale, timeZone, DAY_MONTH_OPTIONS[locale]).formatRange(
      start,
      end,
    );
  }
  const first = formatDayMonth(start, locale, timeZone);
  return `${first} ${RANGE_JOINER} ${formatDayMonth(end, locale, timeZone)}`;
}

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/** Relative up to 24 h ("hace 12 min", "hace 1 h"); from there on, the date. */
export function formatRelative(value: DateInput, locale: Locale, now: Date = new Date()): string {
  const date = toDate(value);
  if (!date) return UNKNOWN;
  const elapsed = date.getTime() - now.getTime();
  if (Math.abs(elapsed) >= DAY_MS) return formatDate(date, locale);

  const relative = relativeFormat(locale);
  if (Math.abs(elapsed) < MINUTE_MS) {
    return relative.format(Math.trunc(elapsed / 1000), 'second');
  }
  if (Math.abs(elapsed) < HOUR_MS) {
    return relative.format(Math.trunc(elapsed / MINUTE_MS), 'minute');
  }
  return relative.format(Math.trunc(elapsed / HOUR_MS), 'hour');
}
