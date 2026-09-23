// Number formatting for the whole site (spec 4.3 and 13.3). No component calls
// toLocaleString, toFixed or Intl.NumberFormat on its own (V4-6).
import type { Locale } from '@/i18n/config';

import { UNKNOWN } from './unknown';

/** Always the real minus sign; Intl returns the hyphen U+002D. */
const MINUS = '\u2212';
/** Between a currency symbol and its figure, so they never wrap apart. */
const HARD_SPACE = '\u00a0';

/** Numbers use es-ES: the approved design system groups thousands with a dot (A8). */
const NUMBER_LOCALE: Record<Locale, string> = { es: 'es-ES', en: 'en-US' };

const GROUP_SEPARATOR: Record<Locale, string> = { es: '.', en: ',' };
const DECIMAL_SEPARATOR: Record<Locale, string> = { es: ',', en: '.' };

/** Boost bands: "+15 a +20" / "+15 to +20". */
const BAND_JOINER: Record<Locale, string> = { es: 'a', en: 'to' };

const POKEDOLARES: Record<Locale, { one: string; other: string }> = {
  es: { one: 'Pokédólar', other: 'Pokédólares' },
  en: { one: 'Pokédollar', other: 'Pokédollars' },
};

const RATING: Record<Locale, { outOf: string; one: string; other: string }> = {
  es: { outOf: 'de 5', one: 'reseña de operaciones', other: 'reseñas de operaciones' },
  en: { outOf: 'out of 5', one: 'trade review', other: 'trade reviews' },
};

/** Real money currencies of a listing (spec 9.4). The in-game ones are not money. */
export type RealCurrency = 'BRL' | 'USD' | 'MXN';

const CURRENCY_SYMBOL: Record<RealCurrency, string> = { BRL: 'R$', USD: 'US$', MXN: 'MX$' };

/** 15 digits: the largest amount a listing accepts (spec 9.4). */
const POKEDOLARES_MAX = 999_999_999_999_999n;

const numberFormats = new Map<string, Intl.NumberFormat>();
const pluralRules = new Map<Locale, Intl.PluralRules>();

function numberFormat(locale: Locale, decimals: number): Intl.NumberFormat {
  const key = `${locale}:${decimals}`;
  let format = numberFormats.get(key);
  if (!format) {
    // useGrouping: 'always' is required; without it es-ES leaves "1800" ungrouped.
    format = new Intl.NumberFormat(NUMBER_LOCALE[locale], {
      useGrouping: 'always',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    numberFormats.set(key, format);
  }
  return format;
}

function plural(locale: Locale, count: number): 'one' | 'other' {
  let rules = pluralRules.get(locale);
  if (!rules) {
    rules = new Intl.PluralRules(NUMBER_LOCALE[locale]);
    pluralRules.set(locale, rules);
  }
  return rules.select(count) === 'one' ? 'one' : 'other';
}

function isKnown<Value extends number | bigint>(value: Value | null | undefined): value is Value {
  if (value === null || value === undefined) return false;
  return typeof value === 'bigint' || Number.isFinite(value);
}

function withMinusSign(text: string): string {
  return text.startsWith('-') ? MINUS + text.slice(1) : text;
}

function toUnits(value: number | bigint): bigint {
  return typeof value === 'bigint' ? value : BigInt(Math.round(value));
}

/** Groups always: "57.960", "1.200", "850" in es; "57,960" in en. */
export function formatInteger(value: number | bigint | null | undefined, locale: Locale): string {
  if (!isKnown(value)) return UNKNOWN;
  const rounded = typeof value === 'bigint' ? value : Math.round(value);
  return withMinusSign(numberFormat(locale, 0).format(rounded));
}

/** A fixed number of decimals: "1,5" in es, "1.5" in en. */
export function formatDecimal(
  value: number | null | undefined,
  locale: Locale,
  decimals = 1,
): string {
  if (!isKnown(value)) return UNKNOWN;
  return withMinusSign(numberFormat(locale, decimals).format(value));
}

export interface PercentOptions {
  decimals?: number;
  /** A variation always carries its sign: "+12,0%", "-8,4%" with the real minus. */
  signed?: boolean;
}

/** Figure and "%" with no space between them, in both languages. */
export function formatPercent(
  value: number | null | undefined,
  locale: Locale,
  options: PercentOptions = {},
): string {
  if (!isKnown(value)) return UNKNOWN;
  const { decimals = 0, signed = false } = options;
  // style: 'percent' is not used: in es Intl would insert a space before the sign.
  const digits = numberFormat(locale, decimals).format(Math.abs(value));
  const sign = value < 0 ? MINUS : signed ? '+' : '';
  return `${sign}${digits}%`;
}

function signedNumber(value: number, locale: Locale): string {
  const sign = value < 0 ? MINUS : '+';
  return sign + numberFormat(locale, 0).format(Math.abs(Math.round(value)));
}

/** Boost and its bands: "+20", "+15 a +20". */
export function formatSigned(
  value: number | readonly [number, number] | null | undefined,
  locale: Locale,
): string {
  if (value === null || value === undefined) return UNKNOWN;
  if (typeof value === 'number') {
    return isKnown(value) ? signedNumber(value, locale) : UNKNOWN;
  }
  const [min, max] = value;
  if (!isKnown(min) || !isKnown(max)) return UNKNOWN;
  return `${signedNumber(min, locale)} ${BAND_JOINER[locale]} ${signedNumber(max, locale)}`;
}

/**
 * The players' short form, on integer arithmetic so a large amount keeps every
 * digit: k under a million, kk from a million, one decimal rounded half up and
 * no trailing ",0".
 */
function shortForm(units: bigint, locale: Locale): string {
  if (units < 1000n) return String(units);
  const big = units >= 1_000_000n;
  const step = big ? 100_000n : 100n;
  const tenths = (units + step / 2n) / step;
  // 999.950 rounds to 1.000,0k, which the players write as 1kk.
  if (!big && tenths >= 10_000n) return shortForm(tenths * 100n, locale);
  const whole = numberFormat(locale, 0).format(tenths / 10n);
  const tenth = tenths % 10n;
  const decimals = tenth === 0n ? '' : DECIMAL_SEPARATOR[locale] + tenth;
  return `${whole}${decimals}${big ? 'kk' : 'k'}`;
}

/** The visible amount of in-game money: "850", "2,5k", "1,5kk", "1.200kk". */
export function formatPokedolares(
  value: number | bigint | null | undefined,
  locale: Locale,
): string {
  if (!isKnown(value)) return UNKNOWN;
  const units = toUnits(value);
  return units < 0n ? MINUS + shortForm(-units, locale) : shortForm(units, locale);
}

/**
 * What the screen reader hears while the short form stays aria-hidden (R5):
 * the exact grouped figure with the currency, "150.000.000 Pokédólares".
 */
export function formatPokedolaresLabel(
  value: number | bigint | null | undefined,
  locale: Locale,
): string {
  if (!isKnown(value)) return UNKNOWN;
  const units = toUnits(value);
  const count = Number(units < 0n ? -units : units);
  return `${formatInteger(units, locale)} ${POKEDOLARES[locale][plural(locale, count)]}`;
}

/** Why a typed amount is not a Pokédólares figure. */
export type PokedolaresError = 'formato' | 'fraccion' | 'rango';

export type ParsedPokedolares =
  { ok: true; valor: number } | { ok: false; motivo: PokedolaresError };

// Ungrouped digits, or digits grouped with the locale's thousands separator,
// then an optional decimal part and an optional k / kk suffix.
const AMOUNT_PATTERN: Record<Locale, RegExp> = {
  es: /^(\d+|\d{1,3}(?:\.\d{3})+)(?:,(\d+))?(kk?)?$/,
  en: /^(\d+|\d{1,3}(?:,\d{3})+)(?:\.(\d+))?(kk?)?$/,
};

/**
 * The inverse of formatPokedolares, which never rounds: an amount that is not a
 * whole number of Pokédólares is rejected instead of being rounded away.
 */
export function parsePokedolares(text: string, locale: Locale): ParsedPokedolares {
  const match = AMOUNT_PATTERN[locale].exec(text.trim());
  if (!match) return { ok: false, motivo: 'formato' };

  const [, grouped, fraction = '', suffix = ''] = match;
  const digits = grouped.replaceAll(GROUP_SEPARATOR[locale], '');
  const unit = suffix === 'kk' ? 1_000_000n : suffix === 'k' ? 1_000n : 1n;
  const scale = 10n ** BigInt(fraction.length);
  const scaled = (BigInt(digits) * scale + BigInt(fraction || '0')) * unit;

  if (scaled % scale !== 0n) return { ok: false, motivo: 'fraccion' };
  const units = scaled / scale;
  if (units <= 0n || units > POKEDOLARES_MAX) return { ok: false, motivo: 'rango' };
  return { ok: true, valor: Number(units) };
}

/** The premium currency keeps its game name in both languages: "2.400 Diamonds". */
export function formatDiamonds(value: number | bigint | null | undefined, locale: Locale): string {
  if (!isKnown(value)) return UNKNOWN;
  return `${formatInteger(value, locale)} Diamonds`;
}

/** Symbol, hard space and figure; cents only when they are not zero. */
export function formatRealMoney(
  value: number | null | undefined,
  currency: RealCurrency,
  locale: Locale,
): string {
  if (!isKnown(value)) return UNKNOWN;
  const cents = Math.round(value * 100) % 100;
  const amount = cents === 0 ? formatInteger(value, locale) : formatDecimal(value, locale, 2);
  return `${CURRENCY_SYMBOL[currency]}${HARD_SPACE}${amount}`;
}

/** A seller rating: one decimal with a point in both languages (X5). */
export function formatRating(value: number | null | undefined): string {
  if (!isKnown(value)) return UNKNOWN;
  return value.toFixed(1);
}

/** The accessible name of a rating: "4.6 de 5 (23 reseñas de operaciones)". */
export function formatRatingLabel(
  value: number | null | undefined,
  reviews: number | null | undefined,
  locale: Locale,
): string {
  const rating = formatRating(value);
  if (rating === UNKNOWN) return UNKNOWN;
  const words = RATING[locale];
  if (!isKnown(reviews)) return `${rating} ${words.outOf}`;
  const count = Math.round(reviews);
  return `${rating} ${words.outOf} (${formatInteger(count, locale)} ${words[plural(locale, count)]})`;
}
