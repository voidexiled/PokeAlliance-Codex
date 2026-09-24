// The `tiers` list of spec 8.0.6 and 8.8 over the registry the build reads: the rows of the
// Tier list out of `/{l}/pokedex/datos.json` (PR5), their tier order, the count and the groups
// of a page (TL1, TL4, WD1), the filters without «Tier» (8.8 step 3) and the icons the first
// page carries. Every expectation is computed from the registry, never copied from a board
// (X4), so a change of `content/` changes it (S19).
import { describe, expect, it } from 'vitest';

import { decodePokedex, type PokedexRow } from '@/components/pokedex/config';
import {
  TIERS_PAGE_SIZE,
  compareTiers,
  tierGroup,
  tierIcons,
  tiersConfig,
  tiersRows,
} from '@/components/tiers/config';
import { getPokemon } from '@/lib/content/repository';
import { tierRank } from '@/lib/content/tier-rank';
import { applyListState, pageCountOf, parseListState, pendingScript } from '@/lib/lists/state';
import { buildPokedexData, pokedexIds } from '../../src/pages/[locale]/pokedex/datos.json';

const data = buildPokedexData('es');
const all = decodePokedex(data);
const rows = tiersRows(all);
const { generations, elements, movesets, variants } = pokedexIds(rows, data.refs.elementos);
const config = tiersConfig(
  '/es/pokedex/datos.json',
  { generations, elements, movesets, variants },
  'es',
);

/** §16.2.1: best first, ULTIMATE … T7. */
function rank(row: PokedexRow): number {
  return tierRank(row.tier);
}

describe('the rows of the Tier list (8.8 steps 4 and 5)', () => {
  it('keeps every variant with a tier and no other', () => {
    expect(rows).toHaveLength(getPokemon().filter((record) => record.tier !== null).length);
    expect(rows.every((row) => row.tier !== null)).toBe(true);
  });

  it('orders by tier, best first (ULTIMATE … T7), and by 8.0.5 inside a tier', () => {
    const ranks = rows.map(rank);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    // `datos.json` writes the rows in the order of 8.0.5 (tests/lists/pokedex.test.ts), and
    // inside a tier the list keeps it.
    const position = new Map(all.map((row, index) => [row.id, index]));
    for (const group of new Set(rows.map(tierGroup))) {
      const members = rows.filter((row) => tierGroup(row) === group);
      const places = members.map((row) => position.get(row.id) ?? -1);
      expect(places, group).toEqual([...places].sort((a, b) => a - b));
    }
    expect([...rows].sort(compareTiers)).toEqual(rows);
  });

  it('TL1: counts every variant with a tier, and page 1 is the first tier while it fills it', () => {
    const page = applyListState(config, rows, parseListState(config, '?view=cards'));
    expect(page.total).toBe(rows.length);
    expect(page.pageCount).toBe(pageCountOf(TIERS_PAGE_SIZE, rows.length));
    expect(page.items.map((row) => row.id)).toEqual(
      rows.slice(0, TIERS_PAGE_SIZE).map((row) => row.id),
    );
    const first = tierGroup(rows[0]);
    const firstTier = rows.filter((row) => tierGroup(row) === first).length;
    if (firstTier >= TIERS_PAGE_SIZE) {
      expect(page.groups.map((group) => group.key)).toEqual([first]);
    }
  });
});

describe('the tiers list (8.0.6)', () => {
  it('«Ranuras» is the default and shows the whole filtered list, one group per tier (16.4.3)', () => {
    expect(config.defaultView).toBe('slots');
    const page = applyListState(config, rows, parseListState(config, ''));
    expect(page.pageCount).toBe(1);
    expect(page.items).toHaveLength(rows.length);
    const keys = page.groups.map((group) => group.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('has 48 rows a page, one order, the anchor of H7 and the Pokédex data', () => {
    expect(config.id).toBe('tiers');
    expect(config.pageSize).toBe(48);
    expect(config.sorts).toHaveLength(1);
    expect(config.anchorId?.(rows[0])).toBe(`pokemon-${rows[0].id}`);
    expect(config.dataUrl).toBe('/es/pokedex/datos.json');
  });

  it('filters by generation, element and variant, never by tier (8.8 step 3)', () => {
    expect(config.filters.map((filter) => filter.key)).toEqual([
      'gen',
      'tipo',
      'moveset',
      'variante',
    ]);
    expect(parseListState(config, '?tier=t1').filters).toEqual({});
  });

  it('takes the filter values of the rows with a tier only (U4)', () => {
    const withTier = getPokemon().filter((record) => record.tier !== null);
    expect(generations).toEqual(
      [
        ...new Set(
          withTier.flatMap((record) => (record.generacion === null ? [] : [record.generacion])),
        ),
      ]
        .sort((a, b) => a - b)
        .map(String),
    );
    expect(variants).toEqual(
      ['normal', 'shiny'].filter((variant) =>
        withTier.some((record) => record.variante === variant),
      ),
    );
  });

  it('U3: elemento=fire&variante=shiny keeps the Shiny Fire variants, in tier order', () => {
    const page = applyListState(
      config,
      rows,
      parseListState(config, '?elemento=fire&variante=shiny&view=slots&page=2'),
    );
    const expected = rows.filter(
      (row) => row.variante === 'shiny' && row.elementos.includes('fire'),
    );
    expect(page.total).toBe(expected.length);
    // U4: a page past the last one is the last one.
    expect(page.state.page).toBe(Math.min(2, pageCountOf(TIERS_PAGE_SIZE, expected.length)));
    expect(page.state.view).toBe('slots');
  });

  it('groups every page by tier after cutting it (CGS 2.1, TL4)', () => {
    const pages = pageCountOf(TIERS_PAGE_SIZE, rows.length);
    for (let number = 1; number <= pages; number += 1) {
      const page = applyListState(config, rows, parseListState(config, `?page=${number}`));
      expect(page.groups.flatMap((group) => group.items)).toEqual(page.items);
      for (const group of page.groups) {
        expect(group.items.every((row) => tierGroup(row) === group.key)).toBe(true);
      }
    }
  });

  it('PR4: the inline script of the real configuration stays under 1 KB', () => {
    const script = pendingScript(config, pageCountOf(TIERS_PAGE_SIZE, rows.length));
    expect(new TextEncoder().encode(script).length).toBeLessThan(1024);
  });
});

describe('the element icons of the first page', () => {
  it('carries the icon of each element of the rows that has one, and no other', () => {
    const first = rows.slice(0, TIERS_PAGE_SIZE);
    const icons = tierIcons(first, data.refs.elementos);
    const used = new Set(first.flatMap((row) => row.elementos));
    expect(Object.keys(icons)).toEqual(
      Object.keys(data.refs.elementos).filter(
        (id) => used.has(id) && data.refs.elementos[id].icono !== null,
      ),
    );
  });
});
