// The orders of the Comercio list (spec 9.5.5): «Recientes», «Mejor valorados» and «Precio,
// menor primero». Pure comparators, so the build, the list controller of an island
// (`ListConfig.sorts`) and the tests order the same rows the same way. `Array.prototype.sort`
// is stable: rows that tie on every key keep the order they came in.
import type { PriceCurrency } from './draft';
import { MONEDAS_JUEGO, MONEDAS_REALES } from './types';
import type { Anuncio, Precio, SellerRating } from './types';

/** The orders of `SortSelect`, the ids `sort` takes in the URL (U3). The first is the default. */
export const LISTING_ORDERS = ['recientes', 'valoracion', 'precio'] as const;

export type ListingOrder = (typeof LISTING_ORDERS)[number];

/**
 * What «Mejor valorados» reads of a seller's rating (9.10): the mean rounded half up to one
 * decimal, `null` without reviews, and the number of reviews. `sellerRating` of ./types.ts gives
 * it in phase A; phase B reads it from `trade_seller_stats`.
 */
export type SellerScore = Pick<SellerRating, 'valoracion' | 'resenas'>;

/** The rating of a seller by handle; nothing for a seller without reviews. */
export type SellerScores = (handle: string) => SellerScore | null | undefined;

/** What the orders read of a listing. */
export type SortableListing = Pick<Anuncio, 'publicado' | 'precio' | 'vendedor'>;

export type ListingComparator = (a: SortableListing, b: SortableListing) => number;

/**
 * The price groups of «Precio, menor primero», in order: the real currencies of 9.4 (R$, US$,
 * MX$), then Pokédólares and Diamonds (9.5.5, DS:guias/40).
 */
const PRICE_GROUPS: readonly PriceCurrency[] = [...MONEDAS_REALES, ...MONEDAS_JUEGO];

/** The group of a currency; one the list does not know goes after the known ones. */
function groupOf(currency: PriceCurrency): number {
  const group = PRICE_GROUPS.indexOf(currency);
  return group === -1 ? PRICE_GROUPS.length : group;
}

/** A real amount as stored («90», «35.50»), in cents, so two amounts compare exactly. */
function cents(importe: string): number {
  const match = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(importe.trim());
  if (match === null) return Number.POSITIVE_INFINITY;
  return Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
}

/**
 * The key of the price order (9.5.5): the real money when there is some and otherwise the first
 * in-game option, never converted. `null` for a listing «A convenir», which goes last.
 */
function priceKey(precio: Precio): { group: number; amount: number } | null {
  if (precio.aConvenir) return null;
  if (precio.real !== null) {
    return { group: groupOf(precio.real.moneda), amount: cents(precio.real.importe) };
  }
  const first = precio.juego[0];
  if (first === undefined) return null;
  return { group: groupOf(first.tipo), amount: first.cantidad };
}

/** The instant of publication; a date that does not read is the oldest. */
function publishedAt(anuncio: SortableListing): number {
  const time = Date.parse(anuncio.publicado);
  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
}

/** Ascending order of two keys. */
function ascending(a: number, b: number): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/** «Recientes»: `publicado` descending. It also breaks the ties of the other two orders. */
function byRecent(a: SortableListing, b: SortableListing): number {
  return ascending(publishedAt(b), publishedAt(a));
}

/** The rating of a seller with reviews, or `null`. */
function rating(
  score: SellerScore | null | undefined,
): { valoracion: number; resenas: number } | null {
  if (score === null || score === undefined || score.valoracion === null) return null;
  return score.resenas > 0 ? { valoracion: score.valoracion, resenas: score.resenas } : null;
}

/** Without a rating lookup every seller counts as one without reviews. */
const NO_SCORES: SellerScores = () => null;

/**
 * The comparator of one order (9.5.5), as `ListConfig.sorts` takes it:
 *
 * - `recientes`: `publicado` descending;
 * - `valoracion`: rating descending, then number of reviews descending, then `publicado`
 *   descending; sellers without reviews go last;
 * - `precio`: by the price key, in the groups R$, US$, MX$, Pokédólares, Diamonds and
 *   ascending inside each, with no conversion between them; «A convenir» last; ties by
 *   `publicado` descending.
 */
export function listingComparator(
  order: ListingOrder,
  scores: SellerScores = NO_SCORES,
): ListingComparator {
  if (order === 'valoracion') {
    return (a, b) => {
      const first = rating(scores(a.vendedor));
      const second = rating(scores(b.vendedor));
      if (first === null || second === null) {
        if (first !== second) return first === null ? 1 : -1;
        return byRecent(a, b);
      }
      const score = ascending(second.valoracion, first.valoracion);
      if (score !== 0) return score;
      const reviews = ascending(second.resenas, first.resenas);
      if (reviews !== 0) return reviews;
      return byRecent(a, b);
    };
  }
  if (order === 'precio') {
    return (a, b) => {
      const first = priceKey(a.precio);
      const second = priceKey(b.precio);
      if (first === null || second === null) {
        if (first !== second) return first === null ? 1 : -1;
        return byRecent(a, b);
      }
      const group = ascending(first.group, second.group);
      if (group !== 0) return group;
      const amount = ascending(first.amount, second.amount);
      if (amount !== 0) return amount;
      return byRecent(a, b);
    };
  }
  return byRecent;
}

/**
 * `sortListings` of 9.5.5: a new array with `anuncios` in `order`. `scores` gives the rating of
 * each seller for «Mejor valorados». Sorting happens before the page is cut and grouped (9.5.6),
 * so in Slots and in Cards with «Todos» each type keeps this order.
 */
export function sortListings<Listing extends SortableListing>(
  anuncios: readonly Listing[],
  order: ListingOrder,
  scores?: SellerScores,
): Listing[] {
  return anuncios.slice().sort(listingComparator(order, scores));
}
