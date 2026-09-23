import {
  SPECIAL_TIERS,
  pokedexConfig,
  tierId,
  type PokedexElementRefs,
  type PokedexIds,
  type PokedexRow,
} from '@/components/pokedex/config';
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
//   - 48 rows a page.
//   - The filters `gen`, `elemento` and `variante` of the Pokédex, the same objects in the
//     same URL order (U1) with the same registry ids (U3): `?elemento=fire&variante=shiny`
//     means the same on both pages. No `tier`: the groups are the tiers (8.8 step 3).
//   - Only the variants with a tier: a row whose `tier` is `null` is not on this page
//     (8.8 step 4), so `tiersRows` leaves it out before anything counts it.
//   - One order (V6, no `SortSelect`): by tier, T1…T7 and then the special tiers in the
//     order of `$defs.tierEspecial` (`SPECIAL_TIERS`, the order of the schema, not a
//     ranking), and inside a tier the Pokémon order of 8.0.5. `tiersRows` applies it once, to
//     rows that already come in the order of 8.0.5, with a stable sort; the list keeps it on
//     every change of state.
//   - Grouped by tier (`groupBy`), which Cards and Slots draw and the Lista does not (8.8
//     step 5). The rows of a tier are contiguous, so the groups of a page come in the order
//     of the list and need no `groupOrder`. The page is cut first and grouped after
//     (CGS 2.1): page 1 of the whole list holds only «T1» while T1 has more than 48
//     variants (TL1).

/** Rows per page of the Tier list (8.0.6). */
export const TIERS_PAGE_SIZE = 48;

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
  return tierId(row.tier) ?? '';
}

/**
 * Where a tier goes (8.8 step 5): the numbered tiers by their number, then the special
 * ones in the order of `SPECIAL_TIERS`, then any other text by its id, so that the rows
 * of one tier are always together.
 */
function tierPlace(row: PokedexRow): readonly [number, number, string] {
  if (typeof row.tier === 'number') return [0, row.tier, ''];
  const id = tierGroup(row);
  const special = SPECIAL_TIERS.indexOf(id);
  return special < 0 ? [2, 0, id] : [1, special, ''];
}

/** The order of the tiers (8.8 step 5), for a stable sort. */
export function compareTiers(a: PokedexRow, b: PokedexRow): number {
  const [bucketA, placeA, idA] = tierPlace(a);
  const [bucketB, placeB, idB] = tierPlace(b);
  if (bucketA !== bucketB) return bucketA - bucketB;
  if (placeA !== placeB) return placeA - placeB;
  return idA < idB ? -1 : idA > idB ? 1 : 0;
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

/**
 * The configuration of the `tiers` list (8.0.6). The island memoises it; the tests build it
 * over the registry, so the filters and the inline script of PR4 are the page's.
 */
export function tiersConfig(dataUrl: string, ids: TiersIds): ListConfig<PokedexRow> {
  const pokedex = pokedexConfig(dataUrl, { ...ids, tiers: [] });
  return {
    id: 'tiers',
    pageSize: TIERS_PAGE_SIZE,
    // One order, the one `tiersRows` gave the rows, so no `SortSelect` (V6).
    sorts: pokedex.sorts,
    filters: pokedex.filters.filter((filter) => filter.key !== 'tier'),
    groupBy: tierGroup,
    anchorId: (row) => `pokemon-${row.id}`,
    dataUrl,
  };
}
