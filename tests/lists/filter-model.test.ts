import { describe, expect, it } from 'vitest';

import { menuRows, moveIndex, tierLadderRows, toggleValue } from '@/components/filters/menu-model';
import { joinValues, splitValues } from '@/components/filters/model';
import {
  applyListState,
  parseListState,
  serializeListState,
  type ListConfig,
} from '@/lib/lists/state';

// Plan «Dirección C»: the pure logic of the filter toolbar and the list rules it drives —
// «Tipo» AND with at most two values, «Tipo de moveset» OR, and the rows per page of each view.

describe('filter values', () => {
  it('splits and joins comma values', () => {
    expect(splitValues('fire,water')).toEqual(['fire', 'water']);
    expect(splitValues(undefined)).toEqual([]);
    expect(joinValues([])).toBeNull();
    expect(joinValues(['a', 'b'])).toBe('a,b');
  });

  it('toggles a value and keeps the cap', () => {
    expect(toggleValue(['fire'], 'water', 2)).toEqual(['fire', 'water']);
    expect(toggleValue(['fire', 'water'], 'grass', 2)).toEqual(['fire', 'water']);
    expect(toggleValue(['fire', 'water'], 'fire', 2)).toEqual(['water']);
    expect(toggleValue(['fire', 'water'], 'grass')).toEqual(['fire', 'water', 'grass']);
  });
});

describe('menu keyboard', () => {
  const grid = menuRows('elements', 18);

  it('lays the elements out 6 × 3', () => {
    expect(grid).toEqual([6, 6, 6]);
  });

  it('moves by column and row and stops at the ends', () => {
    expect(moveIndex(0, 'ArrowLeft', grid)).toBe(0);
    expect(moveIndex(5, 'ArrowRight', grid)).toBe(6);
    expect(moveIndex(2, 'ArrowDown', grid)).toBe(8);
    expect(moveIndex(14, 'ArrowDown', grid)).toBe(14);
    expect(moveIndex(8, 'ArrowUp', grid)).toBe(2);
    expect(moveIndex(9, 'Home', grid)).toBe(0);
    expect(moveIndex(0, 'End', grid)).toBe(17);
    expect(moveIndex(0, 'Enter', grid)).toBeNull();
  });

  it('maps the Tier ladder rows by position (T4 goes up to Ultra Rare)', () => {
    const ladder = [4, 7];
    expect(moveIndex(4 + 3, 'ArrowUp', ladder)).toBe(2);
    expect(moveIndex(0, 'ArrowDown', ladder)).toBe(4);
    expect(moveIndex(3, 'ArrowDown', ladder)).toBe(10);
  });

  it('splits the ladder into named tiers and T1 … T7', () => {
    const ids = ['mythic', 'legendary', 't1', 't2'].map((id) => ({ id }));
    expect(tierLadderRows(ids).map((row) => row.map((tier) => tier.id))).toEqual([
      ['mythic', 'legendary'],
      ['t1', 't2'],
    ]);
  });
});

interface Row {
  id: string;
  types: string[];
}

const rows: Row[] = [
  { id: 'a', types: ['flying', 'psychic'] },
  { id: 'b', types: ['flying'] },
  { id: 'c', types: ['psychic', 'water'] },
];

const config: ListConfig<Row> = {
  id: 'test',
  pageSize: 12,
  perPage: {
    slots: { options: [48, 96, 144], default: 96 },
    cards: { options: [12, 24, 48], default: 12 },
  },
  sorts: [{ id: 'id', label: '', compare: () => 0 }],
  filters: [
    {
      key: 'tipo',
      values: ['flying', 'psychic', 'water', 'fire'],
      multi: true,
      match: 'all',
      max: 2,
      test: (row, value) => row.types.includes(value),
    },
    {
      key: 'moveset',
      values: ['flying', 'psychic', 'water'],
      multi: true,
      test: (row, value) => row.types.includes(value),
    },
  ],
};

describe('list rules of the toolbar', () => {
  it('Tipo keeps a row with every chosen type, at most two', () => {
    const state = parseListState(config, '?tipo=flying,psychic,water');
    expect(state.filters.tipo).toBe('flying,psychic');
    expect(applyListState(config, rows, state).items.map((row) => row.id)).toEqual(['a']);
  });

  it('Tipo de moveset keeps a row with any chosen type', () => {
    const state = parseListState(config, '?moveset=flying,water');
    expect(applyListState(config, rows, state).items.map((row) => row.id)).toEqual(['a', 'b', 'c']);
  });

  it('reads porPagina per view and drops the default or another view’s size', () => {
    expect(parseListState(config, '?view=slots&porPagina=48').perPage).toBe(48);
    expect(parseListState(config, '?view=slots&porPagina=96').perPage).toBeUndefined();
    expect(parseListState(config, '?view=slots&porPagina=24').perPage).toBeUndefined();
    const state = parseListState(config, '?view=cards&porPagina=24');
    expect(serializeListState(config, state)).toBe('porPagina=24');
  });
});
