import {
  pokedexConfig,
  tierId,
  type PokedexElementRefs,
  type PokedexIds,
  type PokedexRow,
} from '@/components/pokedex/config';
import type { Locale } from '@/i18n/config';
import { compareTierRank, tierKey } from '@/lib/content/tier-rank';
import type { ListConfig } from '@/lib/lists/state';
import type { SpriteData } from '@/lib/sprites/resolve';

// The `tiers` list of spec 8.0.6 and 8.8, shared by the build and the island: its
// `ListConfig` and the order of its rows. The Tier list reads the rows of the Pokédex
// (`/{l}/pokedex/datos.json`, PR5), so the shape of the data, its decoder and the values of
// the filters are the ones of src/components/pokedex/config.ts; this module only adds what
// the Tier list does differently. Like that one, it imports no registry, no Zod and no
// component, so what the island takes from it is only what it runs.
//
// State (8.0.6, 8.8):
//   - «Ranuras» (default, §16.4.3) draws every filtered row as the classic tier list, one
//     row per tier, with no pages (`unpagedViews`); Cards and Lista keep 48 rows a page.
//   - The filters of the Pokédex (`gen`, `tipo`, `moveset`, `variante`), the same objects in
//     the same URL order (U1) with the same registry ids (U3). No `tier`: the rows are the
//     tiers (8.8 step 3, §16.4.3).
//   - Only the variants with a tier: a row whose `tier` is `null` is not on this page
//     (8.8 step 4), so `tiersRows` leaves it out before anything counts it.
//   - One order (V6, no `SortSelect`): best tier first, ULTIMATE … T7 (`compareTierRank`,
//     §16.2.1), and inside a tier the Pokémon order of 8.0.5. `tiersRows` applies it once, to
//     rows that already come in the order of 8.0.5, with a stable sort; the list keeps it on
//     every change of state.
//   - Grouped by tier (`groupBy`); the rows of a tier are contiguous, so the groups come in
//     the order of the list and need no `groupOrder`. In the paged views the page is cut
//     first and grouped after (CGS 2.1).

/** Rows per page of the Tier list (8.0.6). */
export const TIERS_PAGE_SIZE = 48;

/**
 * Rows the prerendered page and its props carry (13.6: props within 20 KB); the island takes
 * the rest from `datos.json` as it hydrates (PR5).
 */
export const TIERS_PROPS_ROWS = 32;

/**
 * The values each filter accepts (U3, U4), read from the rows with a tier. No tiers: the
 * Tier list has no «Tier» filter (8.8 step 3) and orders its groups by `compareTiers`.
 */
export type TiersIds = Omit<PokedexIds, 'tiers'>;

/**
 * The group of a row (8.8): the URL id of its tier, `t1`…`t7`, `super-rare`… The rows of
 * this list always have a tier (`tiersRows`); `''` only answers a row that would not.
 */
export function tierGroup(row: PokedexRow): string {
  return tierKey(row.tier) ?? tierId(row.tier) ?? '';
}

/** The order of the tiers, best first (§16.2.1), for a stable sort. */
export function compareTiers(a: PokedexRow, b: PokedexRow): number {
  return compareTierRank(a.tier, b.tier);
}

/**
 * The rows of the Tier list (8.8 steps 4 and 5): the ones with a tier, in tier order, and
 * inside a tier in the order they come in — the Pokémon order of 8.0.5 of `datos.json`
 * (`Array.prototype.sort` is stable).
 */
export function tiersRows(rows: readonly PokedexRow[]): PokedexRow[] {
  return rows.filter((row) => row.tier !== null).sort(compareTiers);
}

/**
 * The icons of the elements of `rows` that have one (DP2), by id: what the element chips of
 * the prerendered first page draw before `datos.json` arrives. An element without an icon
 * is not here; its chip is its name (DS:ElementChip).
 */
export function tierIcons(
  rows: readonly PokedexRow[],
  elements: PokedexElementRefs,
): Record<string, SpriteData> {
  const used = new Set(rows.flatMap((row) => row.elementos));
  return Object.fromEntries(
    Object.entries(elements).flatMap(([id, element]) =>
      used.has(id) && element.icono !== null ? [[id, element.icono]] : [],
    ),
  );
}

/** Its own order is `tiersRows`'s (a no-op, stable sort keeps it): no `sort` label needed. */
function keepOrder(): number {
  return 0;
}

/**
 * The configuration of the `tiers` list (§16.4.3). The island memoises it; the tests build
 * it over the registry, so the filters and the inline script of PR4 are the page's. The
 * Pokédex's four sorts do not apply here — the Tier list orders by tier, best first, via
 * `tiersRows` and its own groups — so only its filters (all but «Tier») are reused;
 * `locale` and the (unused) sort labels only satisfy `pokedexConfig`'s signature.
 */
export function tiersConfig(
  dataUrl: string,
  ids: TiersIds,
  locale: Locale,
): ListConfig<PokedexRow> {
  const pokedex = pokedexConfig(dataUrl, { ...ids, tiers: [] }, locale, {
    numero: '',
    nombre: '',
    tier: '',
    requisito: '',
  });
  return {
    id: 'tiers',
    pageSize: TIERS_PAGE_SIZE,
    // One order, the one `tiersRows` gave the rows, so no `SortSelect` (V6).
    sorts: [{ id: 'tier', label: '', compare: keepOrder }],
    filters: pokedex.filters.filter((filter) => filter.key !== 'tier'),
    groupBy: tierGroup,
    // §16.4.3: «Ranuras» is the classic tier list, one row per tier with every Pokémon of the
    // filtered list (no pages); Cards and Lista keep 48 a page.
    defaultView: 'slots',
    unpagedViews: ['slots'],
    anchorId: (row) => `pokemon-${row.id}`,
    dataUrl,
  };
}
