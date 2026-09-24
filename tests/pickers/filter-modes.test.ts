import { describe, expect, it } from 'vitest';

import { filterOptions, isCapped, toggleLimited } from '@/lib/pickers/model';
import type { PickerOption } from '@/lib/pickers/model';

const option = (id: string, tipo: string[], moveset: string[]): PickerOption => ({
  id,
  name: id,
  sprite: null,
  tip: { title: id, rows: [] } as never,
  facets: { tipo, moveset },
});

const options = [
  option('a', ['flying', 'psychic'], ['psychic']),
  option('b', ['flying'], ['water']),
  option('c', ['psychic'], ['fire']),
];

describe('filter modes', () => {
  it('combines «all» values with AND and the rest with OR', () => {
    const ids = (active: Record<string, string[]>) =>
      filterOptions(options, '', active, { tipo: 'all' }).map((o) => o.id);
    expect(ids({ tipo: ['flying', 'psychic'] })).toEqual(['a']);
    expect(ids({ tipo: ['flying'] })).toEqual(['a', 'b']);
    expect(ids({ moveset: ['psychic', 'water'] })).toEqual(['a', 'b']);
    expect(ids({ tipo: ['flying'], moveset: ['water', 'fire'] })).toEqual(['b']);
  });

  it('keeps OR as the default', () => {
    expect(filterOptions(options, '', { tipo: ['flying', 'psychic'] })).toHaveLength(3);
  });
});

describe('toggleLimited', () => {
  it('stops at the maximum and still removes', () => {
    expect(toggleLimited(['fire'], 'water', 2)).toEqual(['fire', 'water']);
    expect(toggleLimited(['fire', 'water'], 'ice', 2)).toEqual(['fire', 'water']);
    expect(toggleLimited(['fire', 'water'], 'fire', 2)).toEqual(['water']);
    expect(toggleLimited(['fire', 'water'], 'ice')).toEqual(['fire', 'water', 'ice']);
    expect(isCapped(['fire', 'water'], 'ice', 2)).toBe(true);
    expect(isCapped(['fire', 'water'], 'fire', 2)).toBe(false);
  });
});
