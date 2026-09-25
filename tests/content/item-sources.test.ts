import { describe, expect, it } from 'vitest';

import {
  effectivenessRows,
  chanceTier,
  compareChance,
  itemLoot,
  itemUses,
  lootZonesOf,
} from '../../src/lib/content/item-sources';
import type { Item } from '../../src/lib/content/registry-schema';
import type { PokemonRecord } from '../../src/lib/content/types';

// Synthetic fixtures: not PokeAlliance data.
const base: PokemonRecord = {
  id: 'fixture-a',
  nombre: 'Fixture A',
  numero: 1,
  generacion: 1,
  variante: 'normal',
  nivel: 1,
  tier: 6,
  funcion: 'PVE',
  elementos: ['grass'],
  imagen: null,
};

const withLoot: PokemonRecord = {
  ...base,
  drops: [{ item: 'seed', cantidad: { min: 2, max: 3 }, probabilidad: 40 }],
  dropsPorZona: {
    wildscape: [{ item: 'seed', cantidad: { min: 2, max: 3 }, probabilidad: 100 }],
    primal: [],
  },
  evolucion: [{ a: 'fixture-b', nivel: 40, items: [{ item: 'leaf-stone', cantidad: 1 }] }],
};
const target: PokemonRecord = { ...base, id: 'fixture-b', nombre: 'Fixture B', numero: 2 };

const product = {
  id: 'totem',
  nombre: 'Totem',
  clientId: null,
  categoria: 'utilities',
  sprite: 'items/utilities/totem',
  apilable: null,
  precioNpc: { vende: null, compra: null },
  obtencion: {
    recetas: [
      {
        taller: null,
        cantidad: 1,
        tiempoSegundos: null,
        materiales: [{ item: 'seed', cantidad: null }],
      },
    ],
  },
} as Item;

describe('item-sources', () => {
  it('lists the zones the record has, an empty one included', () => {
    expect(lootZonesOf(withLoot).map((zone) => [zone.zone, zone.drops.length])).toEqual([
      ['base', 1],
      ['wildscape', 1],
      ['primal', 0],
    ]);
    expect(lootZonesOf(base)).toEqual([]);
  });

  it('derives who drops an item, zone by zone', () => {
    expect(
      itemLoot('seed', [withLoot, target]).map((row) => [
        row.pokemon.id,
        row.zone,
        row.probabilidad,
      ]),
    ).toEqual([
      ['fixture-a', 'base', 40],
      ['fixture-a', 'wildscape', 100],
    ]);
    expect(itemLoot('missing', [withLoot])).toEqual([]);
  });

  it('orders by chance: known % high to low, then «Muy raro», then unknown', () => {
    const rows = [
      { id: 'unknown', probabilidad: null },
      { id: 'rare', probabilidad: null, muyRaro: true },
      { id: 'low', probabilidad: 1.5 },
      { id: 'high', probabilidad: 40 },
    ];
    expect([...rows].sort(compareChance).map((row) => row.id)).toEqual([
      'high',
      'low',
      'rare',
      'unknown',
    ]);
    expect(rows.map(chanceTier)).toEqual([2, 1, 0, 0]);
    const rare: PokemonRecord = {
      ...target,
      drops: [{ item: 'seed', cantidad: null, probabilidad: null, muyRaro: true }],
    };
    expect(itemLoot('seed', [rare])[0]).toMatchObject({ probabilidad: null, muyRaro: true });
  });

  it('derives the uses: evolutions, recipes and element parts', () => {
    const elementos = [{ id: 'grass', stone: 'leaf-stone', fragment: null }];
    const stone = itemUses('leaf-stone', [withLoot, target], [product], elementos);
    expect(stone.evolutions).toHaveLength(1);
    expect(stone.evolutions[0]?.to?.id).toBe('fixture-b');
    expect(stone.evolutions[0]?.nivel).toBe(40);
    expect(stone.stoneOf).toEqual(['grass']);
    const seed = itemUses('seed', [withLoot], [product], elementos);
    expect(seed.recipes.map((use) => use.product.id)).toEqual(['totem']);
    expect(seed.evolutions).toEqual([]);
  });

  it('adds «Neutro» with every element no group names', () => {
    const rows = effectivenessRows(
      { muyDebil: [], debil: ['fire'], resiste: ['water'], muyResistente: ['grass'], inmune: [] },
      ['normal', 'fire', 'water', 'grass'],
    );
    expect(rows.map((row) => [row.key, row.multiplier, row.elements])).toEqual([
      ['muyDebil', 2, []],
      ['debil', 1.5, ['fire']],
      ['neutro', 1, ['normal']],
      ['resiste', 0.5, ['water']],
      ['muyResistente', 0.4, ['grass']],
      ['inmune', 0, []],
    ]);
  });
});
