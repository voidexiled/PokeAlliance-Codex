import { describe, expect, it } from 'vitest';

import { LISTING_ORDERS, listingComparator, sortListings } from '@/lib/trade/sort';
import type { SellerScore, SortableListing } from '@/lib/trade/sort';
import { sellerRating } from '@/lib/trade/types';
import type { Precio } from '@/lib/trade/types';

// The three orders of the Comercio list (spec 9.5.5, CA-9.4). Every listing is written with
// the fields the orders read; the times carry different offsets on purpose, so an order that
// compared the ISO strings instead of the instants would fail.

type Listing = SortableListing & { id: string };

function precio(declared: Partial<Precio> = {}): Precio {
  return { real: null, juego: [], aConvenir: false, ...declared };
}

function listing(
  id: string,
  publicado: string,
  price: Precio,
  vendedor = 'vendedor-alfa',
): Listing {
  return { id, publicado, precio: price, vendedor };
}

function ids(listings: readonly Listing[]): string[] {
  return listings.map((anuncio) => anuncio.id);
}

describe('LISTING_ORDERS', () => {
  it('starts with «Recientes», the default order', () => {
    expect(LISTING_ORDERS).toEqual(['recientes', 'valoracion', 'precio']);
  });
});

describe('sortListings: «Recientes»', () => {
  it('puts the latest publication first, comparing instants and not texts', () => {
    const listings = [
      listing('noon-utc', '2026-09-18T12:00:00Z', precio()),
      listing('ten-brasilia', '2026-09-18T10:00:00-03:00', precio()),
      listing('previous-day', '2026-09-17T23:59:00-03:00', precio()),
      listing('unreadable', 'ayer', precio()),
    ];
    expect(ids(sortListings(listings, 'recientes'))).toEqual([
      'ten-brasilia',
      'noon-utc',
      'previous-day',
      'unreadable',
    ]);
  });

  it('keeps the incoming order of a tie and never mutates its input', () => {
    const listings = [
      listing('first', '2026-09-18T12:00:00Z', precio()),
      listing('second', '2026-09-18T12:00:00Z', precio()),
    ];
    const before = ids(listings);
    expect(ids(sortListings(listings, 'recientes'))).toEqual(['first', 'second']);
    expect(ids(listings)).toEqual(before);
  });
});

describe('sortListings: «Mejor valorados»', () => {
  const scores: Record<string, SellerScore> = {
    'vendedor-alfa': { valoracion: 4.6, resenas: 23 },
    'vendedor-beta': { valoracion: 4.6, resenas: 3 },
    'vendedor-gamma': { valoracion: 5, resenas: 1 },
    'vendedor-delta': { valoracion: 0, resenas: 2 },
    'vendedor-epsilon': { valoracion: null, resenas: 0 },
  };
  const rating = (handle: string) => scores[handle];

  it('orders by rating, then number of reviews, then publication; no reviews go last', () => {
    const listings = [
      listing('epsilon', '2026-09-18T12:00:00Z', precio(), 'vendedor-epsilon'),
      listing('unknown-seller', '2026-09-18T13:00:00Z', precio(), 'vendedor-omega'),
      listing('beta', '2026-09-18T12:00:00Z', precio(), 'vendedor-beta'),
      listing('delta', '2026-09-18T12:00:00Z', precio(), 'vendedor-delta'),
      listing('alfa-older', '2026-09-10T12:00:00Z', precio(), 'vendedor-alfa'),
      listing('gamma', '2026-09-01T12:00:00Z', precio(), 'vendedor-gamma'),
      listing('alfa-newer', '2026-09-18T12:00:00Z', precio(), 'vendedor-alfa'),
    ];
    expect(ids(sortListings(listings, 'valoracion', rating))).toEqual([
      'gamma',
      'alfa-newer',
      'alfa-older',
      'beta',
      'delta',
      'unknown-seller',
      'epsilon',
    ]);
  });

  it('reads the rating that sellerRating computes from the reviews (9.10)', () => {
    const reviews: Record<string, number[]> = {
      'vendedor-alfa': [4, 5],
      'vendedor-beta': [5, 5, 4],
      'vendedor-gamma': [],
    };
    const byHandle = (handle: string) =>
      sellerRating((reviews[handle] ?? []).map((puntuacion) => ({ puntuacion })));
    const listings = [
      listing('gamma', '2026-09-18T12:00:00Z', precio(), 'vendedor-gamma'),
      listing('alfa', '2026-09-17T12:00:00Z', precio(), 'vendedor-alfa'),
      listing('beta', '2026-09-16T12:00:00Z', precio(), 'vendedor-beta'),
    ];
    expect(ids(sortListings(listings, 'valoracion', byHandle))).toEqual(['beta', 'alfa', 'gamma']);
  });

  it('is the order of the publications when no seller has reviews', () => {
    const listings = [
      listing('older', '2026-09-10T12:00:00Z', precio()),
      listing('newer', '2026-09-18T12:00:00Z', precio()),
    ];
    expect(ids(sortListings(listings, 'valoracion'))).toEqual(['newer', 'older']);
  });
});

describe('sortListings: «Precio, menor primero» (CA-9.4)', () => {
  const day = (n: number) => `2026-09-${String(n).padStart(2, '0')}T12:00:00-03:00`;

  const listings = [
    listing('negotiable-older', day(1), precio({ aConvenir: true })),
    listing('diamonds-400', day(2), precio({ juego: [{ tipo: 'diamonds', cantidad: 400 }] })),
    listing('usd-10', day(3), precio({ real: { moneda: 'USD', importe: '10' } })),
    listing(
      'pd-150kk',
      day(4),
      precio({ juego: [{ tipo: 'pokedolares', cantidad: 150_000_000 }] }),
    ),
    listing(
      'brl-90-older',
      day(5),
      precio({
        real: { moneda: 'BRL', importe: '90' },
        juego: [{ tipo: 'pokedolares', cantidad: 1_000 }],
      }),
    ),
    listing('mxn-1800', day(6), precio({ real: { moneda: 'MXN', importe: '1800' } })),
    listing(
      'diamonds-then-pd',
      day(7),
      precio({
        juego: [
          { tipo: 'diamonds', cantidad: 100 },
          { tipo: 'pokedolares', cantidad: 1 },
        ],
      }),
    ),
    listing('brl-35.5', day(8), precio({ real: { moneda: 'BRL', importe: '35.5' } })),
    listing('pd-30kk', day(9), precio({ juego: [{ tipo: 'pokedolares', cantidad: 30_000_000 }] })),
    listing('brl-90-newer', day(10), precio({ real: { moneda: 'BRL', importe: '90.00' } })),
    listing('brl-35.50', day(11), precio({ real: { moneda: 'BRL', importe: '35.50' } })),
    listing('negotiable-newer', day(12), precio({ aConvenir: true })),
    listing('brl-100', day(13), precio({ real: { moneda: 'BRL', importe: '100' } })),
  ];

  it('groups R$, US$, MX$, Pokédólares and Diamonds, ascending inside each', () => {
    expect(ids(sortListings(listings, 'precio'))).toEqual([
      'brl-35.50',
      'brl-35.5',
      'brl-90-newer',
      'brl-90-older',
      'brl-100',
      'usd-10',
      'mxn-1800',
      'pd-30kk',
      'pd-150kk',
      'diamonds-then-pd',
      'diamonds-400',
      'negotiable-newer',
      'negotiable-older',
    ]);
  });

  it('keys a listing on its real money before its in-game options, never converted', () => {
    const cheapGame = listing(
      'brl-500',
      day(1),
      precio({
        real: { moneda: 'BRL', importe: '500' },
        juego: [{ tipo: 'pokedolares', cantidad: 1 }],
      }),
    );
    const gameOnly = listing(
      'pd-1',
      day(2),
      precio({ juego: [{ tipo: 'pokedolares', cantidad: 1 }] }),
    );
    expect(ids(sortListings([gameOnly, cheapGame], 'precio'))).toEqual(['brl-500', 'pd-1']);
  });

  it('is the same comparator the list configuration takes', () => {
    const compare = listingComparator('precio');
    expect(ids(listings.slice().sort(compare))).toEqual(ids(sortListings(listings, 'precio')));
  });
});
