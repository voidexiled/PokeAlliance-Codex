// Price per unit (owner rule 2026-09-24, src/lib/trade/unit-price.ts): the totals the database
// computes (supabase/migrations/20260924200000_listing_unit_price.sql, round half up to the cent or
// to a whole unit), the price the composer sends, and the line every price shows.
import { describe, expect, it } from 'vitest';

import {
  fiatTotal,
  gameTotal,
  hasUnitPrice,
  priceFromUnit,
  unitPriceText,
  unitText,
} from '@/lib/trade/unit-price';
import { listingPayload } from '@/lib/supabase/trade';

const LABELS = {
  es: { per: '{price} por {unit}', one: 'unidad' },
  en: { per: '{price} per {unit}', one: 'unit' },
};

describe('unit price totals', () => {
  it('multiplies the unit price by the quantity over the unit', () => {
    expect(fiatTotal('10', 120, 10)).toBe('120');
    expect(fiatTotal('1.80', 50_000_000, 1_000_000)).toBe('90');
    expect(gameTotal(300_000, 120, 10)).toBe(3_600_000);
    expect(gameTotal(3, 50_000_000, 1_000_000)).toBe(150);
  });

  it('rounds half up, to the cent and to a whole unit', () => {
    expect(fiatTotal('3.33', 125, 10)).toBe('41.63');
    expect(fiatTotal('0.01', 1, 3)).toBeNull();
    expect(fiatTotal('0.01', 2, 3)).toBe('0.01');
    expect(gameTotal(7, 125, 10)).toBe(88);
    expect(gameTotal(1, 10, 1000)).toBeNull();
  });

  it('refuses what is not an amount and totals out of range', () => {
    expect(fiatTotal('abc', 10, 1)).toBeNull();
    expect(fiatTotal('9999999999.99', 2, 1)).toBeNull();
    expect(gameTotal(0, 10, 1)).toBeNull();
    expect(gameTotal(1, 10, 0)).toBeNull();
    expect(gameTotal(999_999_999_999_999, 2, 1)).toBeNull();
  });

  it('applies to the types with a quantity only', () => {
    expect(hasUnitPrice('pokemon')).toBe(false);
    expect(hasUnitPrice('items')).toBe(true);
    expect(hasUnitPrice('diamonds')).toBe(true);
    expect(hasUnitPrice('pokedolares')).toBe(true);
  });
});

describe('the price of a unit price', () => {
  const precio = priceFromUnit(
    1_000_000,
    { moneda: 'MXN', importe: '1.80' },
    [{ tipo: 'diamonds', cantidad: 3 }],
    50_000_000,
  );

  it('keeps the unit price and the totals', () => {
    expect(precio).toEqual({
      real: { moneda: 'MXN', importe: '90' },
      juego: [{ tipo: 'diamonds', cantidad: 150 }],
      aConvenir: false,
      porUnidad: {
        cantidad: 1_000_000,
        real: { moneda: 'MXN', importe: '1.80' },
        juego: [{ tipo: 'diamonds', cantidad: 3 }],
      },
    });
  });

  it('is sent as the unit and its amounts; the database computes the totals', () => {
    expect(
      listingPayload({
        tipo: 'pokedolares',
        mundo: 'titan-1',
        cantidad: 50_000_000,
        precio: precio!,
        characterId: '0b8f1c2e-8b4d-4c1e-9a7f-2d5b8e0c4a91',
      }),
    ).toEqual({
      character_id: '0b8f1c2e-8b4d-4c1e-9a7f-2d5b8e0c4a91',
      asset_type: 'pokedolares',
      world_key: 'titan-1',
      asset: { cantidad: 50_000_000 },
      fiat_currency: 'MXN',
      fiat_amount: '1.80',
      game_prices: [{ tipo: 'diamonds', cantidad: 3 }],
      negotiable: false,
      unit_quantity: 1_000_000,
    });
  });

  it('writes the unit price with its unit', () => {
    expect(unitPriceText('pokedolares', precio!, 'es', LABELS.es, 'o')).toBe(
      'MX$ 1,80 o 3 Diamonds por 1kk',
    );
    expect(unitText('diamonds', 10, 'en', LABELS.en)).toBe('10 Diamonds');
    expect(unitText('items', 1, 'es', LABELS.es)).toBe('unidad');
    expect(unitText('items', 500, 'es', LABELS.es)).toBe('500');
    expect(
      unitPriceText(
        'pokedolares',
        { real: null, juego: [], aConvenir: false },
        'es',
        LABELS.es,
        'o',
      ),
    ).toBeNull();
  });
});
