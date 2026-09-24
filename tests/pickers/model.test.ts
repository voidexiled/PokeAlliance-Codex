import { describe, expect, it } from 'vitest';

import { compareTierRank, tierKey, tierRank } from '@/lib/content/tier-rank';
import { fill } from '@/lib/pickers/labels';
import { filterOptions, gridMove, heldMatrix, matchesSearch } from '@/lib/pickers/model';
import type { HeldInfo, PickerOption } from '@/lib/pickers/model';

const tip = { title: 'x' } as unknown as PickerOption['tip'];
const opt = (
  id: string,
  name: string,
  facets: Record<string, string[]> = {},
  number?: number,
): PickerOption => ({
  id,
  name,
  number,
  sprite: null,
  tip,
  facets,
});

describe('tier rank', () => {
  it('orders ULTIMATE first and T7 last; unknown after everything', () => {
    const tiers = [7, 'Super Rare', 'T1', null, 'ULTIMATE', 'Mythic', 3];
    expect([...tiers].sort(compareTierRank)).toEqual([
      'ULTIMATE',
      'Mythic',
      'Super Rare',
      'T1',
      3,
      7,
      null,
    ]);
    expect(tierRank('ultra rare')).toBe(3);
    expect(tierKey('Ultra Rare')).toBe('ultra-rare');
    expect(tierKey('T4')).toBe('t4');
    expect(tierKey('nope')).toBeNull();
  });
});

describe('search', () => {
  const charizard = { ...opt('charizard', 'Charizard', {}, 6), aliases: ['Lizardon'] };
  it('matches name without accents or case, alias and number', () => {
    expect(matchesSearch(opt('flabebe', 'Flabébé'), 'FLABEBE')).toBe(true);
    expect(matchesSearch(charizard, 'lizard')).toBe(true);
    expect(matchesSearch(charizard, '#6')).toBe(true);
    expect(matchesSearch(charizard, '006')).toBe(true);
    expect(matchesSearch(charizard, '#60')).toBe(false);
  });
});

describe('filter combination', () => {
  const options = [
    opt('a', 'A', { tipo: ['fire', 'flying'], tier: ['t3'] }),
    opt('b', 'B', { tipo: ['water'], tier: ['t3'] }),
    opt('c', 'C', { tipo: ['fire'], tier: ['t5'] }),
  ];
  it('is OR within a filter and AND across filters', () => {
    expect(filterOptions(options, '', { tipo: ['fire', 'water'] }).map((o) => o.id)).toEqual([
      'a',
      'b',
      'c',
    ]);
    expect(
      filterOptions(options, '', { tipo: ['fire', 'water'], tier: ['t3'] }).map((o) => o.id),
    ).toEqual(['a', 'b']);
    expect(filterOptions(options, '', { tipo: [], tier: ['t5'] }).map((o) => o.id)).toEqual(['c']);
    expect(filterOptions(options, 'b', { tier: ['t3'] }).map((o) => o.id)).toEqual(['b']);
  });
});

describe('keyboard grid', () => {
  it('moves by row and column and clamps at the edges', () => {
    // 10 cells in 4 columns: rows 0-3, 4-7, 8-9.
    expect(gridMove(-1, 'ArrowDown', 10, 4)).toBe(0);
    expect(gridMove(1, 'ArrowDown', 10, 4)).toBe(5);
    expect(gridMove(6, 'ArrowDown', 10, 4)).toBe(6);
    expect(gridMove(3, 'ArrowRight', 10, 4)).toBe(4);
    expect(gridMove(9, 'ArrowRight', 10, 4)).toBe(9);
    expect(gridMove(5, 'Home', 10, 4)).toBe(0);
    expect(gridMove(5, 'End', 10, 4)).toBe(9);
    expect(gridMove(1, 'PageDown', 10, 4, 4)).toBe(9);
    expect(gridMove(9, 'PageUp', 10, 4, 4)).toBe(1);
  });

  it('skips the holes of the matrix', () => {
    const holes = new Set([1, 5]);
    expect(gridMove(0, 'ArrowRight', 8, 4, 4, (i) => !holes.has(i))).toBe(2);
    expect(gridMove(9 - 8, 'ArrowDown', 8, 4, 4, (i) => !holes.has(i))).toBe(1);
    expect(gridMove(4, 'ArrowRight', 8, 4, 4, (i) => !holes.has(i))).toBe(6);
  });
});

describe('held matrix', () => {
  const items: HeldInfo[] = [
    { ranura: 'x', efecto: 'X-Attack', tier: 1 },
    { ranura: 'x', efecto: 'X-Attack', tier: 3 },
    { ranura: 'x', efecto: 'X-Defense', tier: 3 },
  ];
  it('builds effect rows and only the tier columns present', () => {
    const m = heldMatrix(items, (item) => item);
    expect(m.rows).toEqual(['X-Attack', 'X-Defense']);
    expect(m.tiers).toEqual([1, 3]);
    expect(m.cells).toEqual([items[0], items[1], null, items[2]]);
  });
});

describe('labels', () => {
  it('fills templates', () => {
    expect(fill('{n} elegidas', { n: 3 })).toBe('3 elegidas');
    expect(fill('Quitar {name}', {})).toBe('Quitar {name}');
  });
});
