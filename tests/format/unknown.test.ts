import { describe, expect, it } from 'vitest';

import { gridKeys as cardGridKeys, listingLayout } from '@/lib/cards/layout';
import { formatPokedolares } from '@/lib/format/numbers';
import { gridKeys, orUnknown, present, UNKNOWN } from '@/lib/format/unknown';

describe('UNKNOWN', () => {
  it('is the em dash U+2014, never a zero or an abbreviation', () => {
    expect(UNKNOWN).toBe('\u2014');
    expect(UNKNOWN).not.toBe('-');
    expect(UNKNOWN).not.toBe('0');
  });
});

describe('present', () => {
  it('is false for nothing, for an empty text and for an empty list', () => {
    expect(present(null)).toBe(false);
    expect(present(undefined)).toBe(false);
    expect(present('')).toBe(false);
    expect(present('   ')).toBe(false);
    expect(present([])).toBe(false);
  });

  it('is false for the dash itself: a record that already says "—" knows nothing', () => {
    expect(present(UNKNOWN)).toBe(false);
  });

  it('is true for a value, including zero and false', () => {
    expect(present('Fuego')).toBe(true);
    expect(present(0)).toBe(true);
    expect(present(false)).toBe(true);
    expect(present(['Fuego'])).toBe(true);
  });
});

describe('orUnknown', () => {
  it('keeps a value and replaces what is missing with the dash', () => {
    expect(orUnknown('Charizard')).toBe('Charizard');
    expect(orUnknown(null)).toBe(UNKNOWN);
    expect(orUnknown('')).toBe(UNKNOWN);
  });
});

describe('gridKeys', () => {
  const canon = ['requisito', 'tier', 'ball', 'aura', 'boost'] as const;

  it('keeps a key some entity of the set has and drops one no entity has', () => {
    const results = [
      { requisito: 120, tier: 3, ball: 'Premier' },
      { requisito: 80, tier: 1 },
    ];

    expect(gridKeys(canon, results)).toEqual(['requisito', 'tier', 'ball']);
  });

  it('keeps the canonical order, not the order the entities use', () => {
    const results = [{ boost: 20 }, { tier: 5, requisito: 150 }];

    expect(gridKeys(canon, results)).toEqual(['requisito', 'tier', 'boost']);
  });

  it('shows the dash only for a key another entity of the set has', () => {
    const results = [
      { requisito: 120, ball: 'Premier' },
      { requisito: 80, ball: null },
    ];
    const keys = gridKeys(canon, results);

    expect(keys).toContain('ball');
    expect(orUnknown(results[1].ball)).toBe(UNKNOWN);
  });

  it('drops a key every entity leaves unknown, instead of a column of dashes', () => {
    const results = [
      { requisito: 120, aura: null },
      { requisito: 80, aura: undefined },
      { requisito: 60, aura: '' },
    ];

    expect(gridKeys(canon, results)).toEqual(['requisito']);
    expect(gridKeys(canon, results)).not.toContain('aura');
  });

  it('counts a value a formatter already turned into a dash as unknown', () => {
    const results = [
      { tier: formatPokedolares(null, 'es') },
      { tier: formatPokedolares(850, 'es') },
    ];

    expect(gridKeys(canon, results)).toEqual(['tier']);
    expect(gridKeys(canon, [{ tier: formatPokedolares(null, 'es') }])).toEqual([]);
  });

  it('returns no key for an empty result set', () => {
    expect(gridKeys(canon, [])).toEqual([]);
  });
});

// The same union rule as the card grids apply it (spec 14.2, CARD_GRID_SYSTEM §5.3): the
// `gridKeys` of src/lib/cards/layout.ts, which reads each card through a values function, and
// `listingLayout`. A card shows «—» only for a key another card of its grid has; a key no card of
// the grid has is not a row at all.
describe('gridKeys and listingLayout of a card grid', () => {
  type Fact = 'requirement' | 'tier' | 'role';
  type Card = { facts: Partial<Record<Fact, string | null>> };

  /** What one card of a grid shows for a key of its layout. */
  function shown(value: unknown): unknown {
    return present(value) ? value : UNKNOWN;
  }

  it('gives the dash to a card that misses a key another card of the grid has', () => {
    const cards: Card[] = [
      { facts: { tier: 'T3', role: 'PVE' } },
      { facts: { tier: null, role: 'PVP' } },
    ];
    const keys = cardGridKeys<Fact, Card>(
      ['requirement', 'tier', 'role'],
      cards,
      (card) => card.facts,
    );

    expect(keys).toEqual(['tier', 'role']);
    expect(keys.map((key) => shown(cards[1].facts[key]))).toEqual([UNKNOWN, 'PVP']);
  });

  it('never gives the dash to a key that no card of the grid has', () => {
    const cards: Card[] = [{ facts: { tier: 'T3' } }, { facts: { tier: 'T1', role: '' } }];
    const keys = cardGridKeys<Fact, Card>(['tier', 'role'], cards, (card) => card.facts);

    expect(keys).toEqual(['tier']);
    expect(keys.flatMap((key) => cards.map((card) => shown(card.facts[key])))).not.toContain(
      UNKNOWN,
    );
  });

  it('keeps a listing fact for the whole grid when one listing has it', () => {
    const listings = [
      { type: 'pokemon' as const, facts: { requirement: 'Nivel 120', ball: 'Premier Ball' } },
      { type: 'pokemon' as const, facts: { requirement: 'Nivel 80', ball: null } },
    ];
    const layout = listingLayout(listings);

    expect(layout.keys).toEqual(['requirement', 'ball']);
    expect(shown(listings[1].facts.ball)).toBe(UNKNOWN);
  });

  it('drops a listing fact that every listing of the grid leaves unknown', () => {
    const layout = listingLayout([
      { type: 'pokemon', facts: { requirement: 'Nivel 120', nickname: UNKNOWN } },
      { type: 'pokemon', facts: { requirement: 'Nivel 80', nickname: '' } },
      { type: 'pokemon', facts: { requirement: 'Nivel 60', nickname: null } },
    ]);

    expect(layout.keys).toEqual(['requirement']);
  });

  it('counts an amount a formatter already turned into a dash as unknown', () => {
    const layout = listingLayout([
      { type: 'pokedolares', facts: { quantity: formatPokedolares(null, 'es') } },
    ]);

    expect(layout.keys).toEqual([]);
  });
});
