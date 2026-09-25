import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Card } from '@/components/cards/Card';
import { CardGrid } from '@/components/cards/CardGrid';
import {
  DEX_KEYS,
  dexLayout,
  dexValues,
  gridKeys,
  listingKeys,
  listingLayout,
  LOOT_KEYS,
  lootKeys,
  lootValues,
  trackCount,
  type DexLayoutInput,
  type ListingLayoutInput,
  type LootFields,
} from '@/lib/cards/layout';
import { UNKNOWN } from '@/lib/format/unknown';

// C7-04 (spec 7.14): `gridKeys`, `listingLayout`, `lootKeys` and `trackCount` pass the examples of
// DS:guias/30 («Claves de una rejilla», «Familias») and CARD_GRID_SYSTEM §5.3, §6; every card of
// a grid has the same `grid-row`. The values below are test samples, not registry data (X4): only
// their presence decides a layout.

/** A Pokémon listing with the facts, zones and prices it is given, nothing else. */
function pokemon(parts: Partial<ListingLayoutInput> = {}): ListingLayoutInput {
  return { type: 'pokemon', ...parts };
}

/** The four listing cards of a stress row: every key, two held lines, training, both prices. */
const FULL_FACTS = {
  requirement: 'Nivel 1',
  tier: 'T7',
  elements: [{ id: 'normal' }],
  ball: { name: 'Premier Ball' },
  aura: 'Alliance',
  boost: '+20',
  nickname: 'A B C',
  memorySlots: 6,
  starLevel: 3,
  npcPrice: 'Unsellable',
};

describe('gridKeys: the reference signature', () => {
  const canon = ['requirement', 'tier', 'role', 'variant'] as const;

  it('keeps, in canonical order, the keys at least one item has (CGS §5.3)', () => {
    const items = [
      { values: { variant: 'Normal', requirement: 'Nivel 80' } },
      { values: { tier: 'T3' } },
    ];

    expect(gridKeys(canon, items, (item) => item.values)).toEqual([
      'requirement',
      'tier',
      'variant',
    ]);
  });

  it('drops a key that no item of the result set has', () => {
    const items = [{ requirement: 'Nivel 80', role: null }, { requirement: 'Nivel 20' }];

    expect(gridKeys(canon, items)).toEqual(['requirement']);
  });

  it('counts null, undefined, the empty text, the dash and an empty list as unknown', () => {
    const items = [
      { requirement: null, tier: undefined, role: '', variant: UNKNOWN },
      { requirement: [], tier: '   ' },
    ];

    expect(gridKeys(canon, items)).toEqual([]);
  });

  it('keeps zero, which is a value', () => {
    expect(gridKeys(canon, [{ tier: 0 }])).toEqual(['tier']);
  });

  it('reads an item with no values as unknown everywhere', () => {
    expect(gridKeys(canon, [{ values: null }], (item) => item.values)).toEqual([]);
  });
});

describe('listingLayout (DS:guias/30 «Claves de una rejilla»)', () => {
  it('keeps the canonical keys of the type that at least one listing has, in canonical order', () => {
    const layout = listingLayout([
      pokemon({ facts: { nickname: 'S U S A N O O', requirement: 'Nivel 120' } }),
      pokemon({ facts: { tier: 'T1', ball: { name: 'Premier Ball' }, boost: null } }),
    ]);

    expect(layout.type).toBe('pokemon');
    expect(layout.keys).toEqual(['requirement', 'tier', 'ball', 'nickname']);
  });

  it('keeps a key some listing has, so the others show the dash, and drops one no listing has', () => {
    const listings = [
      pokemon({ facts: { requirement: 'Nivel 80', aura: 'Alliance' } }),
      pokemon({ facts: { requirement: 'Nivel 20', aura: null } }),
    ];
    const layout = listingLayout(listings);

    expect(layout.keys).toEqual(['requirement', 'aura']);
    expect(layout.keys).not.toContain('boost');
  });

  it('has the optional zones only when at least one listing has them', () => {
    const none = listingLayout([
      pokemon(),
      pokemon({ equipment: { ball: null, auras: [], addons: [] } }),
    ]);
    const held = listingLayout([
      pokemon({ equipment: { heldX: { name: 'X-Attack' } } }),
      pokemon(),
    ]);
    const both = listingLayout([
      pokemon({ train: { stat: 'Critical Damage', level: 12, percent: 40 } }),
      pokemon({ equipment: { heldY: { name: 'X-Defense' } }, train: null }),
    ]);

    expect(none.zones).toEqual([]);
    expect(none.gear).toEqual([]);
    expect(held.zones).toEqual(['gear']);
    expect(held.gear).toEqual(['held']);
    expect(both.zones).toEqual(['gear', 'train']);
  });

  it('gives each kind of equipment its own place (16.4.5, owner rule 2026-09-25)', () => {
    const layout = listingLayout([
      pokemon({ equipment: { ball: { name: 'Premier Ball' }, auras: [{ name: 'Alliance' }] } }),
      pokemon({ equipment: { mega: { name: 'Charizardite X' }, addons: [{ name: 'Hat' }] } }),
      pokemon(),
    ]);

    // The Ball, the held items and the Mega Stone share one line: one zone, with a column for
    // each group some listing has, in the order of the game.
    expect(layout.zones).toEqual(['gear', 'auras', 'addons']);
    expect(layout.gear).toEqual(['ball', 'mega']);
  });

  it('has the price rows only when at least one listing has that price', () => {
    const game = listingLayout([pokemon({ game: [{ kind: 'pd', amount: 850 }] }), pokemon()]);
    const both = listingLayout([
      pokemon({ fiat: 'R$ 90', game: [] }),
      pokemon({ fiat: null, game: [{ kind: 'dia', amount: 400 }] }),
    ]);
    const neither = listingLayout([pokemon({ fiat: '', game: [] })]);

    expect(game.price).toEqual(['game']);
    expect(both.price).toEqual(['fiat', 'game']);
    expect(neither.price).toEqual([]);
  });

  it('gives «A convenir» the first price row when no listing of the grid has a price (§9.5.8)', () => {
    const alone = listingLayout([pokemon({ negotiable: true }), pokemon()]);
    const withGame = listingLayout([
      pokemon({ negotiable: true }),
      pokemon({ game: [{ kind: 'pd', amount: 850 }] }),
    ]);
    const notNegotiable = listingLayout([pokemon({ negotiable: false })]);

    expect(alone.price).toEqual(['fiat']);
    expect(withGame.price).toEqual(['game']);
    expect(notNegotiable.price).toEqual([]);
  });

  it('is recomputed from the cards a grid shows: another page gives another layout', () => {
    const page1 = [pokemon({ facts: { tier: 'T3' }, equipment: { heldY: { name: 'X-Defense' } } })];
    const page2 = [pokemon({ facts: { requirement: 'Nivel 40' } })];

    expect(listingLayout(page1)).toEqual({
      type: 'pokemon',
      keys: ['tier'],
      zones: ['gear'],
      gear: ['held'],
      price: [],
    });
    expect(listingLayout(page2)).toEqual({
      type: 'pokemon',
      keys: ['requirement'],
      zones: [],
      gear: [],
      price: [],
    });
  });

  it('uses the canonical keys of each type (DS:ListingCard)', () => {
    expect(listingKeys.pokemon).toEqual([
      'requirement',
      'tier',
      'elements',
      'ball',
      'aura',
      'boost',
      'nickname',
      'memorySlots',
      'starLevel',
      'npcPrice',
    ]);
    expect(listingKeys.items).toEqual(['quantity', 'category', 'element', 'use', 'droppedBy']);
    expect(listingKeys.diamonds).toEqual(['quantity', 'boughtAt', 'usedFor']);
    expect(listingKeys.pokedolares).toEqual(['quantity']);

    const items = listingLayout([
      { type: 'items', facts: { droppedBy: '50 Pokémon', quantity: 12, npcPrice: 850 } },
    ]);
    expect(items.keys).toEqual(['quantity', 'droppedBy']);
  });

  it('throws when one grid gets listings of two types (7.6.3)', () => {
    expect(() =>
      listingLayout([pokemon(), { type: 'items', facts: { quantity: 3 } }, pokemon()]),
    ).toThrow(/never mixes listing types/);
  });

  it('throws on a type that is not one of the four', () => {
    const unknown = { type: 'mounts' } as unknown as ListingLayoutInput;

    expect(() => listingLayout([unknown])).toThrow(/not a listing type/);
  });

  it('lays out nothing for an empty set', () => {
    expect(listingLayout([])).toEqual({
      type: 'pokemon',
      keys: [],
      zones: [],
      gear: [],
      price: [],
    });
  });
});

describe('dexLayout (spec 7.6.3, §8.2)', () => {
  const entry = (parts: Partial<DexLayoutInput> = {}): DexLayoutInput => ({
    level: 80,
    tier: 'T3',
    role: 'PVE',
    variant: 'normal',
    elements: [{ id: 'fire' }],
    ...parts,
  });

  it('keeps the four facts in their order when the page has them', () => {
    expect(DEX_KEYS).toEqual(['requirement', 'tier', 'role', 'variant', 'moveset']);
    expect(dexLayout([entry({ role: null }), entry({ tier: null })]).keys).toEqual([
      'requirement',
      'tier',
      'role',
      'variant',
    ]);
  });

  it('with twelve Pokémon without tier or role, has neither track (7.6.2)', () => {
    const page = Array.from({ length: 12 }, (_, index) =>
      entry({ level: index + 1, tier: null, role: undefined }),
    );
    const layout = dexLayout(page);

    expect(layout.keys).toEqual(['requirement', 'variant']);
    expect(trackCount('pokedex', layout)).toBe(1 + 2 + 1);
  });

  it('has the drops zone only when a Pokémon of the page has drops (§8.2)', () => {
    const without = dexLayout([entry(), entry({ drops: [] }), entry({ drops: null })]);
    const withDrops = dexLayout([entry(), entry({ drops: [{ name: 'Fire Stone' }] })]);

    expect(without.zones).toEqual(['elements']);
    expect(withDrops.zones).toEqual(['elements', 'drops']);
  });

  it('has the element zone only when an entry has elements', () => {
    expect(dexLayout([entry({ elements: [] })]).zones).toEqual([]);
  });

  it('reads the Requisito fact from the level', () => {
    expect(dexValues(entry({ level: 120 })).requirement).toBe(120);
    expect(dexLayout([entry({ level: null })]).keys).not.toContain('requirement');
  });
});

describe('lootKeys and lootValues (DS:LootCard, CARD_GRID_SYSTEM §6.3)', () => {
  it('omits Cantidad and Precio NPC when no drop has them, as with the registry of today', () => {
    const drops: LootFields[] = [
      { dropDe: '50 Pokémon', element: { id: 'fire' }, use: 'Evolución y craft' },
      { dropDe: { name: 'Charizard' }, element: null, use: null, qty: null, npcPrice: null },
      { dropDe: null, element: 'Fuego', use: '' },
    ];

    expect(lootKeys(drops)).toEqual(['droppedBy', 'element', 'use']);
  });

  it('keeps the canonical order: Drop de, Elemento, Uso, Cantidad, Precio NPC, Precio de tienda', () => {
    expect(LOOT_KEYS).toEqual(['droppedBy', 'element', 'use', 'quantity', 'npcPrice', 'shopPrice']);
    expect(lootKeys([{ shopPrice: 1500 }, { npcPrice: 850, qty: '1 a 3' }])).toEqual([
      'quantity',
      'npcPrice',
      'shopPrice',
    ]);
  });

  it('gives the values of a drop by key', () => {
    const drop = { dropDe: 'Charizard', element: 'Fuego', use: 'Craft', qty: '2', npcPrice: 850 };

    expect(lootValues(drop)).toEqual({
      droppedBy: 'Charizard',
      element: 'Fuego',
      use: 'Craft',
      quantity: '2',
      npcPrice: 850,
      shopPrice: undefined,
    });
  });

  it('returns no key for an empty grid', () => {
    expect(lootKeys([])).toEqual([]);
  });
});

describe('trackCount (spec 7.6.2)', () => {
  it('spans 17 tracks for the stress Pokémon listing row (Lienzo:Tarjetas)', () => {
    const layout = listingLayout([
      pokemon({
        facts: FULL_FACTS,
        equipment: { heldX: { name: 'X-Attack' }, heldY: { name: 'X-Defense' } },
        train: { stat: 'Critical Damage', level: 12, percent: 40 },
        fiat: 'R$ 90',
        game: [{ kind: 'pd', amount: 150_000_000 }],
      }),
    ]);

    // head 1 + 10 keys + gear line + Entrenamiento + Dinero real + En el juego + Vendedor + Contacto
    expect(trackCount('listing', layout)).toBe(17);
  });

  it('adds one track per line of equipment: gear, Auras and Addons', () => {
    const layout = listingLayout([
      pokemon({
        equipment: {
          ball: { name: 'Premier Ball' },
          heldX: { name: 'X-Attack' },
          auras: [{ name: 'Alliance' }],
          addons: [{ name: 'Hat' }],
        },
      }),
    ]);

    // head 1 + gear + Auras + Addons + Vendedor + Contacto
    expect(trackCount('listing', layout)).toBe(6);
  });

  it('spans 10 for items, 8 for Diamonds and 5 for Pokédólares with the rows of the board', () => {
    const items = listingLayout([
      {
        type: 'items',
        facts: {
          quantity: 12,
          category: 'Stones',
          element: 'Fuego',
          use: 'Evolución',
          droppedBy: '50 Pokémon',
        },
        fiat: 'R$ 12',
        game: [{ kind: 'pd', amount: 2500 }],
      },
    ]);
    const diamonds = listingLayout([
      {
        type: 'diamonds',
        facts: { quantity: 300, boughtAt: ['Online Shop'], usedFor: ['Outfits'] },
        fiat: 'US$ 5',
        game: [{ kind: 'pd', amount: 900_000_000 }],
      },
    ]);
    const pokedolares = listingLayout([
      { type: 'pokedolares', facts: { quantity: 500_000_000 }, fiat: 'R$ 40' },
    ]);

    expect(trackCount('listing', items)).toBe(10);
    expect(trackCount('listing', diamonds)).toBe(8);
    expect(trackCount('listing', pokedolares)).toBe(5);
  });

  it('always keeps the head and the seller and contact rows of a listing', () => {
    expect(trackCount('listing', listingLayout([pokemon()]))).toBe(3);
  });

  it('spans 7 for a Pokédex card with its four facts, element chips and drops', () => {
    const layout = dexLayout([
      { level: 80, tier: 'T3', role: 'PVE', variant: 'normal', elements: [{}], drops: [{}] },
    ]);

    expect(trackCount('pokedex', layout)).toBe(7);
  });

  it('spans 1 + keys for loot, 4 with the three keys of the board', () => {
    expect(trackCount('loot', ['droppedBy', 'element', 'use'])).toBe(4);
    expect(trackCount('loot', [])).toBe(1);
  });

  it('spans 3 for a Guild KPI', () => {
    expect(trackCount('kpi')).toBe(3);
  });
});

describe('every card of a grid has the same grid-row (C7-04)', () => {
  /** The `grid-row` each card of a rendered grid carries. */
  function gridRows(html: string): string[] {
    return [...html.matchAll(/<article[^>]*style="([^"]*)"/g)].map((match) => match[1]);
  }

  it('builds every card of a page from one layout, whatever each card has', () => {
    const page: ListingLayoutInput[] = [
      pokemon({ facts: FULL_FACTS, equipment: { heldX: { name: 'X-Attack' } }, fiat: 'R$ 90' }),
      pokemon({ facts: { requirement: 'Nivel 20' } }),
      pokemon({ train: { stat: 'Attack', level: 16, percent: 53 }, game: [{}] }),
      pokemon(),
    ];
    const span = trackCount('listing', listingLayout(page));
    const html = renderToStaticMarkup(
      createElement(
        CardGrid,
        { family: 'listing' },
        page.map((_, index) => createElement(Card, { key: index, anat: 'listing', span })),
      ),
    );

    expect(gridRows(html)).toEqual(Array.from({ length: page.length }, () => 'grid-row:span 17'));
  });

  it('changes the tracks of every card together when the page changes', () => {
    const page = [
      { level: 80, tier: null, role: null, variant: 'normal', elements: [{}] },
      { level: null, tier: null, role: null, variant: 'shiny', elements: [] },
    ];
    const span = trackCount('pokedex', dexLayout(page));
    const html = renderToStaticMarkup(
      createElement(
        CardGrid,
        { family: 'pokedex' },
        page.map((_, index) => createElement(Card, { key: index, anat: 'dex', span })),
      ),
    );

    expect(span).toBe(4);
    expect(new Set(gridRows(html))).toEqual(new Set(['grid-row:span 4']));
  });

  it('never lets a style prop override the tracks of the layout', () => {
    const html = renderToStaticMarkup(
      createElement(Card, { anat: 'loot', span: 4, style: { gridRow: 'span 1' } }),
    );

    expect(gridRows(html)).toEqual(['grid-row:span 4']);
  });
});
