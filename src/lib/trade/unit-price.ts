// Price per unit (owner rule 2026-09-24): a listing with a quantity — Items, Diamonds,
// Pokédólares — may be priced per unit, with the unit its seller chooses («50kk de Pokédólares a
// MX$ 1,80 por 1kk», «120 Diamonds a 300k por 10»). The listing shows the unit price with its unit
// and the total everywhere a price appears; the total is what sorts, filters and a deal read.
//
// The totals follow supabase/migrations/20260924200000_listing_unit_price.sql exactly:
//     total = round(unit price × quantity / unit), half up,
// to the cent for real money and to a whole unit in the game. The arithmetic is exact (bigint
// cents), so the preview of the composer shows what the database will store.
//
// Client-safe: no Zod, no content reads (AGENTS.md).
import type { Locale } from '@/i18n/config';
import { fill } from '@/i18n/messages/types';
import {
  formatDiamonds,
  formatInteger,
  formatPokedolares,
  formatRealMoney,
} from '@/lib/format/numbers';

import {
  CANTIDAD_MAX,
  type OpcionJuego,
  type Precio,
  type PrecioReal,
  type TipoActivo,
} from './types';

/** Highest real-money total: `numeric(12, 2)`. */
const FIAT_TOTAL_MAX_CENTS = 999_999_999_999n;

/** The asset types a price per unit applies to: those that have a quantity. */
export function hasUnitPrice(tipo: TipoActivo): boolean {
  return tipo !== 'pokemon';
}

/** round(a × b / c) half up, for positive whole numbers. */
function roundedRatio(a: bigint, b: bigint, c: bigint): bigint {
  return (2n * a * b + c) / (2n * c);
}

/** «90», «35.50» (the stored shape of `PrecioReal.importe`) as cents; null when it is not one. */
function centsOf(importe: string): bigint | null {
  const match = /^(\d{1,10})(?:[.,](\d{1,2}))?$/.exec(importe.trim());
  if (match === null) return null;
  const [, whole, fraction = ''] = match;
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}

/** Cents as the stored shape: «90», «35.50». */
function importeOf(cents: bigint): string {
  const whole = cents / 100n;
  const rest = cents % 100n;
  return rest === 0n ? String(whole) : `${whole}.${String(rest).padStart(2, '0')}`;
}

function whole(value: number): bigint | null {
  return Number.isSafeInteger(value) && value >= 1 ? BigInt(value) : null;
}

/**
 * The real-money total of a unit price, as stored («90», «35.50»), or null when an input is not a
 * valid amount or the total leaves the range the database keeps.
 */
export function fiatTotal(unitImporte: string, quantity: number, unit: number): string | null {
  const cents = centsOf(unitImporte);
  const count = whole(quantity);
  const per = whole(unit);
  if (cents === null || cents <= 0n || count === null || per === null) return null;
  const total = roundedRatio(cents, count, per);
  return total <= 0n || total > FIAT_TOTAL_MAX_CENTS ? null : importeOf(total);
}

/** The in-game total of a unit price (whole units), or null outside 1…CANTIDAD_MAX. */
export function gameTotal(unitAmount: number, quantity: number, unit: number): number | null {
  const amount = whole(unitAmount);
  const count = whole(quantity);
  const per = whole(unit);
  if (amount === null || count === null || per === null) return null;
  const total = roundedRatio(amount, count, per);
  return total < 1n || total > BigInt(CANTIDAD_MAX) ? null : Number(total);
}

/**
 * The price a listing stores from a price per unit: the unit amounts kept in `porUnidad`, the
 * totals in `real` and `juego`. Null when a total cannot be computed (a quantity or an amount
 * that is not valid, a total out of range).
 */
export function priceFromUnit(
  unit: number,
  real: PrecioReal | null,
  juego: readonly OpcionJuego[],
  quantity: number,
): Precio | null {
  let totalReal: PrecioReal | null = null;
  if (real !== null) {
    const importe = fiatTotal(real.importe, quantity, unit);
    if (importe === null) return null;
    totalReal = { moneda: real.moneda, importe };
  }
  const totalGame: OpcionJuego[] = [];
  for (const option of juego) {
    const cantidad = gameTotal(option.cantidad, quantity, unit);
    if (cantidad === null) return null;
    totalGame.push({ tipo: option.tipo, cantidad });
  }
  return {
    real: totalReal,
    juego: totalGame,
    aConvenir: false,
    porUnidad: { cantidad: unit, real, juego: [...juego] },
  };
}

// -------------------------------------------------------------------------------- text

/** `trade.unitPrice` of the dictionary. */
export interface UnitPriceLabels {
  /** «{price} por {unit}» / «{price} per {unit}». */
  per: string;
  /** «unidad» / «unit»: a unit of 1. */
  one: string;
}

/**
 * The unit of a price per unit as the listing writes it: «unidad» for 1; for Pokédólares their
 * short form («1kk», «500k»); for Diamonds «10 Diamonds»; for items the count («10»).
 */
export function unitText(
  tipo: TipoActivo,
  unit: number,
  locale: Locale,
  labels: UnitPriceLabels,
): string {
  if (unit === 1) return labels.one;
  if (tipo === 'pokedolares') return formatPokedolares(unit, locale);
  if (tipo === 'diamonds') return formatDiamonds(unit, locale);
  return formatInteger(unit, locale);
}

/**
 * The unit price in one line: «MX$ 1,80 por 1kk», «24k por unidad», «US$ 2 o 300k por 10
 * Diamonds». `or` joins the parts (`ui.or`). Null for a price without `porUnidad`.
 */
export function unitPriceText(
  tipo: TipoActivo,
  precio: Precio,
  locale: Locale,
  labels: UnitPriceLabels,
  or: string,
): string | null {
  const per = precio.porUnidad;
  if (per === null || per === undefined) return null;
  const parts: string[] = [];
  if (per.real !== null) {
    const value = Number(per.real.importe);
    if (Number.isFinite(value)) parts.push(formatRealMoney(value, per.real.moneda, locale));
  }
  for (const option of per.juego) {
    parts.push(
      option.tipo === 'pokedolares'
        ? formatPokedolares(option.cantidad, locale)
        : formatDiamonds(option.cantidad, locale),
    );
  }
  if (parts.length === 0) return null;
  return fill(labels.per, {
    price: parts.join(` ${or} `),
    unit: unitText(tipo, per.cantidad, locale, labels),
  });
}
