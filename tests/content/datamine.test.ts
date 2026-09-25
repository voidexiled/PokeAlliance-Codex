// `pnpm content:datamine` (scripts/content/lib/datamine.mjs) over synthetic exports: name
// matching, branched evolutions, the moveset element, items outside the Market categories,
// elements outside the enum, prices with separators, hand values kept and idempotency.
import { describe, expect, it } from 'vitest';

import {
  applyExport,
  evolutionTargets,
  inspectDescription,
  inspectPrice,
  movesetElement,
  parseHeld,
} from '../../scripts/content/lib/datamine.mjs';

// Synthetic fixture (not game data): the shapes of the export, with made-up values.
const ELEMENTS = ['normal', 'fire', 'water', 'grass', 'poison', 'psychic'];

type Rec = Record<string, unknown>;

function emptyTypes(): Record<string, Rec[]> {
  return {
    pokedex_list: [],
    pokedex_detail: [],
    items: [],
    market_catalog: [],
    npc_trade: [],
    megastones: [],
    movebar: [],
    shop_items: [],
    pass_rewards: [],
    calendar_rewards: [],
    craft_recipes: [],
    quest_rewards: [],
    market_listings: [],
  };
}

const pokemon = (id: string, nombre: string, extra: Rec = {}): Rec => ({
  id,
  nombre,
  numero: 1,
  generacion: 1,
  variante: nombre.startsWith('Shiny ') ? 'shiny' : 'normal',
  nivel: null,
  tier: null,
  funcion: null,
  elementos: [],
  imagen: null,
  ...extra,
});

const move = (name: string, element: string, tags: string[], extra: Rec = {}): Rec => ({
  name,
  element,
  tags,
  effects: ['damage'],
  desc: `Descripción de ${name}.`,
  icon: 1,
  cooldownPve: 10,
  cooldownPvp: 12,
  ...extra,
});

const detail = (name: string, extra: Rec = {}): Rec => ({
  id: 1,
  name,
  shinyId: 1,
  shinyIds: [name],
  firstElement: 'grass',
  secondElement: '',
  level: 20,
  tier: '5',
  worldCount: 1,
  role: 0,
  heavy: false,
  fast: true,
  evolutions: [],
  evoNote: '',
  stones: [],
  habilities: ['cut', 'rocksmash'],
  effectiveness: {
    super: [],
    effective: ['fire'],
    ineffective: [],
    superIneffective: [],
    immune: [],
  },
  description: 'Texto de prueba.',
  moves: [],
  loot: [
    {
      region: 'Base',
      drops: [{ itemId: 100, name: 'Test Leaf', countMin: 0, countMax: 2, chance: 33000 }],
    },
    { region: 'Wildscape', drops: [] },
    { region: 'Primal', drops: [] },
  ],
  ...extra,
});

function content(extra: { pokemon?: Rec[]; items?: Record<string, Rec[]> } = {}) {
  return {
    pokemon: extra.pokemon ?? [pokemon('test-a', 'Test A')],
    moves: [] as Rec[],
    items: extra.items ?? { stones: [], 'creature-items': [], helds: [] },
    elements: ELEMENTS,
    quests: [],
  };
}

describe('datamine helpers', () => {
  it('parses held titles, inspection prices and descriptions', () => {
    expect(parseHeld('X-Attack (Tier: 3)')).toEqual({ ranura: 'x', efecto: 'X-Attack', tier: 3 });
    expect(parseHeld('Venusaurite')).toBeNull();
    const rows = [{ section: 'header', text: 'You see Test.\nPrice: $1,500.\nA test item.' }];
    expect(inspectPrice(rows)).toBe(1500);
    expect(inspectDescription(rows)).toBe('A test item.');
    expect(inspectDescription([{ section: 'header', text: 'You see Test.' }])).toBeNull();
  });

  it('takes the moveset element from the area moves, the first one on a tie', () => {
    expect(movesetElement([move('A', 'fire', ['target']), move('B', 'water', ['aoe'])])).toEqual({
      element: 'water',
      mixed: false,
    });
    expect(movesetElement([move('A', 'fire', ['aoe']), move('B', 'water', ['aoe'])])).toEqual({
      element: 'fire',
      mixed: true,
    });
    expect(
      movesetElement([
        move('A', 'fire', ['aoe']),
        move('B', 'water', ['aoe']),
        move('C', 'water', ['aoe']),
      ]),
    ).toEqual({ element: 'water', mixed: true });
    expect(movesetElement([move('A', 'fire', ['target'])]).element).toBeNull();
  });

  it('reads branched chains: siblings share a stage, stones can add a target', () => {
    const chain = [
      { name: 'Seed', branch: false, current: false, requiredLevel: 1 },
      { name: 'Bud', branch: false, current: true, requiredLevel: 20 },
      { name: 'Rose', branch: true, current: false, requiredLevel: 50 },
      { name: 'Lily', branch: true, current: false, requiredLevel: 0 },
    ];
    expect(evolutionTargets({ evolutions: chain, stones: [] })).toEqual([
      { name: 'Rose', nivel: 50 },
      { name: 'Lily', nivel: null },
    ]);
    const cocoon = [
      { name: 'Worm', branch: false, current: false, requiredLevel: 1 },
      { name: 'Cocoon', branch: true, current: true, requiredLevel: 1 },
    ];
    expect(
      evolutionTargets({ evolutions: cocoon, stones: [{ evolution: 'Moth', stones: [] }] }),
    ).toEqual([{ name: 'Moth', nivel: null }]);
  });
});

describe('applyExport', () => {
  it('matches normal and shiny records by name and fills the Pokédex fields', () => {
    const types = emptyTypes();
    types.market_catalog = [
      { category: 'Creature Items', categoryId: 8, clientId: 100, id: 1, name: 'Test Leaf' },
    ];
    types.pokedex_detail = [
      detail('Test A', {
        moves: [move('Leaf Hit', 'grass', ['aoe']), move('Calm', 'psychic', ['passive'])],
      }),
      detail('Shiny Test A', { level: 0, tier: 'Legendary' }),
      detail('Mega Test A'),
    ];
    const data = content({
      pokemon: [pokemon('test-a', 'Test A'), pokemon('shiny-test-a', 'Shiny Test A')],
      items: { 'creature-items': [] },
    });
    const report = applyExport(types, data);
    const [normal, shiny] = data.pokemon as Rec[];

    expect(normal).toMatchObject({
      nivel: 20,
      tier: 5,
      elementos: ['grass'],
      descripcion: { es: 'Texto de prueba.' },
      rapido: true,
      pesado: false,
      habilidades: ['Cut', 'Rock Smash'],
      elementoMoveset: 'grass',
      drops: [{ item: 'test-leaf', cantidad: { min: 1, max: 2 }, probabilidad: 33 }],
      dropsPorZona: { wildscape: [], primal: [] },
      movimientos: [
        { movimiento: 'leaf-hit', slot: 'M1', cooldownPve: 10, cooldownPvp: 12 },
        { movimiento: 'calm', slot: null, cooldownPve: 10, cooldownPvp: 12 },
      ],
    });
    expect(normal.efectividad).toEqual({
      muyDebil: [],
      debil: ['fire'],
      resiste: [],
      muyResistente: [],
      inmune: [],
    });
    expect(shiny).toMatchObject({ nivel: null, tier: 'Legendary' });
    expect(report.unmatchedPokemon).toEqual([]);
    expect(report.createdPokemon).toEqual(['mega-test-a']);
    // A Mega has its own look: no species art, the «?».
    expect(data.pokemon.find((entry) => entry.id === 'mega-test-a')).toMatchObject({
      numero: 1,
      variante: 'normal',
      imagen: null,
      nivel: 20,
      tier: 5,
    });
    expect(data.moves.map((entry) => entry.id)).toEqual(['leaf-hit', 'calm']);
    expect(data.moves[1]).toMatchObject({ alcance: 'pasivo', pokemon: ['test-a'] });
  });

  it('keeps per-Pokémon element differences on the Pokémon move', () => {
    const types = emptyTypes();
    types.pokedex_detail = [
      detail('Test A', { moves: [move('Hit', 'normal', ['target'])], loot: [] }),
      detail('Test B', { moves: [move('Hit', 'normal', ['target'])], loot: [] }),
      detail('Test C', { moves: [move('Hit', 'fire', ['aoe'])], loot: [] }),
    ];
    const data = content({
      pokemon: [
        pokemon('test-a', 'Test A'),
        pokemon('test-b', 'Test B'),
        pokemon('test-c', 'Test C'),
      ],
    });
    applyExport(types, data);
    expect(data.moves[0]).toMatchObject({ elemento: 'normal', alcance: 'objetivo' });
    expect((data.pokemon[2] as Rec).movimientos).toEqual([
      {
        movimiento: 'hit',
        slot: 'M1',
        cooldownPve: 10,
        cooldownPvp: 12,
        elemento: 'fire',
        alcance: 'area',
      },
    ]);
    expect((data.pokemon[0] as Rec).movimientos).toEqual([
      { movimiento: 'hit', slot: 'M1', cooldownPve: 10, cooldownPvp: 12 },
    ]);
  });

  it('reports elements outside the enum instead of writing them', () => {
    const types = emptyTypes();
    types.pokedex_detail = [
      detail('Test A', { firstElement: 'crystal', secondElement: 'fire', loot: [] }),
    ];
    const data = content();
    const report = applyExport(types, data);
    expect((data.pokemon[0] as Rec).elementos).toEqual(['fire']);
    expect([...report.unknownElements.keys()]).toEqual(['crystal']);
  });

  it('writes evolutions only when the target and every item are known', () => {
    const types = emptyTypes();
    types.market_catalog = [
      { category: 'Stones', categoryId: 5, clientId: 200, id: 2, name: 'Test Stone' },
    ];
    const chain = [
      { id: 1, name: 'Seed', branch: false, current: true, requiredLevel: 1 },
      { id: 2, name: 'Rose', branch: true, current: false, requiredLevel: 50 },
      { id: 3, name: 'Lily', branch: true, current: false, requiredLevel: 60 },
    ];
    types.pokedex_detail = [
      detail('Seed', {
        loot: [],
        evolutions: chain,
        stones: [
          { evolution: 'Rose', stones: [{ itemId: 200, count: 2, name: 'Test Stone' }] },
          { evolution: 'Lily', stones: [{ itemId: 999, count: 1, name: 'Unknown Thing' }] },
        ],
      }),
    ];
    const data = content({
      pokemon: [pokemon('seed', 'Seed'), pokemon('rose', 'Rose'), pokemon('lily', 'Lily')],
    });
    const report = applyExport(types, data, { createItems: false });
    expect((data.pokemon[0] as Rec).evolucion).toEqual([
      { a: 'rose', nivel: 50, items: [{ item: 'test-stone', cantidad: 2 }] },
    ]);
    expect(report.skippedEvolutions).toEqual(['Seed → Lily (Unknown Thing)']);
  });

  it('creates Market items with their category, held and prices; never an item without one', () => {
    const types = emptyTypes();
    types.market_catalog = [
      { category: 'Helds', categoryId: 6, clientId: 300, id: 3, name: 'X-Test (Tier: 2)' },
      { category: 'Mystery', categoryId: 99, clientId: 301, id: 4, name: 'Odd Thing' },
      { category: 'Creature Items', categoryId: 8, clientId: 302, id: 5, name: 'Priced Tail' },
    ];
    types.items = [
      {
        clientId: 302,
        title: 'Priced Tail',
        rows: [{ section: 'header', text: 'You see Priced Tail.\nPrice: $2,500.' }],
      },
    ];
    types.npc_trade = [
      { clientId: 300, name: 'X-Test (Tier: 2)', weight: 0, buyPrice: 9000, sellPrice: 0 },
    ];
    const data = content({ items: { helds: [], 'creature-items': [] } });
    const report = applyExport(types, data);
    expect(data.items.helds).toEqual([
      {
        id: 'x-test-t2',
        nombre: 'X-Test (Tier: 2)',
        clientId: 300,
        categoria: 'helds',
        sprite: 'ui/comercio/item',
        apilable: null,
        precioNpc: { vende: null, compra: 9000 },
        held: { ranura: 'x', efecto: 'X-Test', tier: 2 },
        mercado: true,
      },
    ]);
    expect(data.items['creature-items'][0]).toMatchObject({
      id: 'priced-tail',
      precioNpc: { vende: 2500, compra: null },
      mercado: true,
    });
    expect(report.catalogWithoutCategory.map((entry: Rec) => entry.name)).toEqual(['Odd Thing']);
  });

  it('lets the client win on game facts, keeps owner fields and the other language, and is idempotent', () => {
    const types = emptyTypes();
    types.market_catalog = [
      { category: 'Creature Items', categoryId: 8, clientId: 100, id: 1, name: 'Test Leaf' },
    ];
    types.pokedex_detail = [
      detail('Test A', { level: 0, moves: [move('Leaf Hit', 'grass', ['aoe'])] }),
    ];
    const data = content({
      pokemon: [
        pokemon('test-a', 'Test A', {
          nivel: 30,
          tier: 'ULTIMATE',
          funcion: 'PVP',
          imagen: '/pokemon/001.png',
          descripcion: { en: 'Mine.' },
        }),
      ],
      items: { 'creature-items': [] },
    });
    const first = applyExport(types, data);
    expect(data.pokemon[0]).toMatchObject({
      tier: 5,
      // An unknown level (0) never erases a known one; owner fields stay.
      nivel: 30,
      funcion: 'PVP',
      imagen: '/pokemon/001.png',
      descripcion: { en: 'Mine.', es: 'Texto de prueba.' },
    });
    expect(first.replaced.map((entry: Rec) => entry.field)).toEqual(['tier', 'descripcion']);

    const snapshot = JSON.stringify(data);
    const second = applyExport(types, data);
    expect(JSON.stringify(data)).toBe(snapshot);
    expect(second.created.items).toEqual([]);
    expect(second.replaced).toEqual([]);
    expect([...second.changes.pokemon.values()]).toEqual([]);
  });

  it('creates the items the game names outside the catalog in «otros»; a listing marks the Market', () => {
    const types = emptyTypes();
    types.pokedex_detail = [detail('Test A')];
    types.items = [
      {
        clientId: 100,
        title: 'test leaf',
        rows: [{ section: 'header', text: 'You see test leaf.\nPrice: $15.' }],
      },
    ];
    types.market_listings = [{ clientId: 100 }];
    const data = content();
    const report = applyExport(types, data);
    expect(report.created.items.map((item: Rec) => item.id)).toEqual(['test-leaf']);
    expect(data.items.otros).toEqual([
      {
        id: 'test-leaf',
        nombre: 'test leaf',
        clientId: 100,
        categoria: 'otros',
        sprite: 'ui/comercio/item',
        apilable: null,
        precioNpc: { vende: 15, compra: null },
        mercado: true,
      },
    ]);
    expect((data.pokemon[0] as Rec).drops).toEqual([
      { item: 'test-leaf', cantidad: { min: 1, max: 2 }, probabilidad: 33 },
    ]);
  });

  it('keeps an owner mark and the fields of `keep`', () => {
    const types = emptyTypes();
    types.market_catalog = [
      { category: 'Creature Items', categoryId: 8, clientId: 100, id: 1, name: 'Test Leaf' },
    ];
    types.pokedex_detail = [detail('Test A', { loot: [] })];
    const leaf = {
      id: 'test-leaf',
      nombre: 'Test Leaf',
      clientId: 100,
      categoria: 'otros',
      sprite: 'items/x',
      apilable: null,
      precioNpc: { vende: null, compra: null },
      mercado: false,
    };
    const data = content({
      pokemon: [pokemon('test-a', 'Test A', { tier: 'ULTIMATE' })],
      items: { otros: [leaf], 'creature-items': [] },
    });
    const report = applyExport(types, data, { keep: new Set(['tier']) });
    expect((data.pokemon[0] as Rec).tier).toBe('ULTIMATE');
    expect(data.items.otros[0]).toMatchObject({ categoria: 'otros', mercado: false });
    expect(report.differences.map((entry: Rec) => entry.field)).toEqual(['mercado', 'tier']);
  });
});
