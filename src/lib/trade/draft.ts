// The rules of a listing draft that spec 9.1 keeps from the old composer: whole amounts
// typed in the grouping of the page's language (9.7.3), the Ditto test (9.7.2), optional
// percentages, prices in the currencies of 9.4 (9.7.4, 9.5.4) and the exact short form of
// the copied text (9.7.7, E12). The screen formats (`formatInteger`, `formatPokedolares`…)
// live in src/lib/format/ (4.3); nothing here formats an amount for the screen.
import type { Locale } from '@/i18n/config';
import { parsePokedolares } from '@/lib/format/numbers';

import type { MonedaJuego, MonedaReal } from './types';

/** A currency a price is typed in: the real ones of 9.4 and the two of the game. */
export type PriceCurrency = MonedaReal | MonedaJuego;

/** 999.999.999.999.999 is the largest amount a listing accepts (9.4). */
const MAX_DIGITS = 15;

/**
 * Ungrouped digits, or digits grouped by three with the thousands separator of the language:
 * the dot in es and the comma in en (A8). The separator of the other language is its decimal
 * separator, so «1,500» in es is one and a half and is not a whole amount.
 */
const WHOLE: Record<Locale, RegExp> = {
  es: /^(?:\d+|\d{1,3}(?:\.\d{3})+)$/,
  en: /^(?:\d+|\d{1,3}(?:,\d{3})+)$/,
};

/** Real money: up to 10 whole digits and 2 decimals, with a point or a comma (9.7.4). */
const REAL_PRICE = /^\d{1,10}(?:[.,]\d{1,2})?$/;

/** A percentage: digits and up to 2 decimals, with a point or a comma. */
const PERCENT = /^\d+(?:[.,]\d{1,2})?$/;

/** The decimal value of a figure typed with a point or a comma. */
function decimalValue(text: string): number {
  return Number(text.replace(',', '.'));
}

/**
 * A whole amount above zero of at most 15 digits, ungrouped or grouped in the language of the
 * page («1.500» in es, «1,500» in en; 9.7.3), or `null`. The result is exact: 15 digits stay
 * under `Number.MAX_SAFE_INTEGER`.
 */
export function parsePositiveWhole(text: string, locale: Locale): number | null {
  const input = text.trim();
  if (!WHOLE[locale].test(input)) return null;
  const digits = input.replace(/\D/g, '');
  if (digits.length > MAX_DIGITS) return null;
  const value = Number(digits);
  return value > 0 ? value : null;
}

/**
 * The exact short form of an amount of Pokédólares: «k» or «kk» only when nothing is rounded,
 * `null` otherwise. The copied text uses it, which has no exact figure for a screen reader
 * (9.7.7, E12), and so does the search text (9.5.2). On the screen the design system's rounded
 * form is `formatPokedolares` (4.3), with the exact figure for the screen reader.
 */
export function compactKks(value: number | bigint): string | null {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) return null;
  const units = BigInt(value);
  if (units >= 1_000_000n && units % 1_000_000n === 0n) return `${units / 1_000_000n}kk`;
  if (units >= 1_000n && units % 1_000n === 0n) return `${units / 1_000n}k`;
  return null;
}

/** Memory Slots and the memories exist only for Ditto and Shiny Ditto (9.7.2). */
export function isDittoSlug(slug: string | null | undefined): boolean {
  return slug === 'ditto' || slug === 'shiny-ditto';
}

/**
 * An optional percentage (Next Boost chance, training progress; 9.7.2): empty, or 0 to 100
 * with up to 2 decimals and a point or a comma.
 */
export function isValidOptionalPercent(text: string): boolean {
  const input = text.trim();
  if (input === '') return true;
  return PERCENT.test(input) && decimalValue(input) <= 100;
}

/**
 * The amount of a typed price in its currency, or `null` when it is not one (9.7.4, 9.5.4):
 *
 * - real money, above zero with up to 10 whole digits and 2 decimals, point or comma;
 * - Pokédólares as `parsePokedolares` reads them (4.3): «50kk», «2,5k» or the grouped figure,
 *   never rounded, in whole units;
 * - Diamonds, a whole amount (`parsePositiveWhole`).
 */
export function parsePrice(text: string, currency: PriceCurrency, locale: Locale): number | null {
  const input = text.trim();
  if (currency === 'pokedolares') {
    const read = parsePokedolares(input, locale);
    return read.ok ? read.valor : null;
  }
  if (currency === 'diamonds') return parsePositiveWhole(input, locale);
  if (!REAL_PRICE.test(input)) return null;
  const value = decimalValue(input);
  return value > 0 ? value : null;
}

/** Whether a typed price is valid in its currency (9.7.4): see `parsePrice`. */
export function isValidPrice(text: string, currency: PriceCurrency, locale: Locale): boolean {
  return parsePrice(text, currency, locale) !== null;
}
