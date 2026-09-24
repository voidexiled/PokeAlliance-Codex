import type { Locale } from '@/i18n/config';
import type { SpriteData } from '@/lib/sprites/resolve';
import type { PokemonRecord } from '@/lib/content/types';
import { compareTierRank } from '@/lib/content/tier-rank';
import { UNKNOWN } from '@/lib/format/unknown';
import type { ListConfig } from '@/lib/lists/state';

// The `pokedex` list of spec 8.0.6, shared by the build and the island: its `ListConfig`,
// the shape of `/{l}/pokedex/datos.json` (PR5) and the reading half of that shape.
//
// Two sides import this module. src/pages/[locale]/pokedex/datos.json.ts writes the data
// and the page reads the ids of the filters from the whole registry; PokedexRoot.tsx, the
// island, reads the rows back and builds the configuration. Nothing here imports the
// registry, Zod or a component, so what the island takes from it is only what it runs.
//
// State (8.0.6, §16.4.2): 12 rows a page; the filters `gen`, `tier`, `tipo` (old name
// `elemento`), `moveset` and `variante`, in that URL order (U1), each of several values
// joined with commas (`multi`: OR within a filter, AND between them), whose values are
// registry ids (U3) the page passes in `PokedexIds`; four orders for `SortSelect` —
// «Número» (the order of 8.0.5 the build writes the rows in), «Nombre», «Tier (mejor
// primero)» and «Requisito»; groups by generation, which only the Slots view draws, with a
// last «—» group for the variants without one (8.2). No `text`: a name is searched with
// Ctrl + K (E3, A22), so the list has no `q`.

/** Rows per page of the Pokédex (8.0.6). */
export const POKEDEX_PAGE_SIZE = 12;

/**
 * The fields of a row of `datos.json`, in the order of `campos` (PR5): the keys of a record
 * of `content/pokemon.json` that the three views show or filter on. `drops` is the one the
 * build writes in its own shape (see `PokedexRow`).
 */
export const POKEDEX_FIELDS = [
  'id',
  'nombre',
  'numero',
  'generacion',
  'variante',
  'nivel',
  'tier',
  'funcion',
  'elementos',
  'imagen',
  'drops',
  'elementoMoveset',
] as const satisfies readonly (keyof PokemonRecord)[];

type PokedexField = (typeof POKEDEX_FIELDS)[number];

/**
 * A Pokémon as the island reads it: the record, with the registry's keys (3.13). `drops`
 * carries the item ids of the record's `drops`, in its order, and `null` when it has none:
 * the zone «Drops» of a card names each item and shows no quantity (8.2), and what each id
 * names travels once, in `refs.items`.
 */
export type PokedexRow = Pick<PokemonRecord, Exclude<PokedexField, 'drops'>> & {
  drops: readonly string[] | null;
};

/** `elementoMoveset` (§16.2.2), the element of a Pokémon's hunting moveset; `null` = «—». */
export type PokedexMoveset = PokedexRow['elementoMoveset'];

/**
 * An element of `content/elementos.json` as `datos.json` carries it in `refs` (PR5): the
 * name in the language of the file, the icon already resolved by the sprite adapter (DP2),
 * and the names of the items of its `stone` and `fragment` ids, which do not translate
 * (13.4). `null` is the registry's unknown.
 */
export interface PokedexElementRef {
  nombre: string;
  icono: SpriteData | null;
  stone: string | null;
  fragment: string | null;
}

/** The rows of the list: the part of `datos.json` the island decodes (PR5). */
export interface PokedexRows {
  v: 1;
  campos: readonly string[];
  filas: readonly (readonly unknown[])[];
}

/** The elements of `refs`, by id, in the order of 8.0.5. */
export type PokedexElementRefs = Record<string, PokedexElementRef>;

/**
 * An item of `content/items/` that a row drops, as `datos.json` carries it in `refs` (PR5):
 * what `itemTip` (7.5.3) needs besides the rows, whose `drops` give its «Drop de». The sprite
 * is already resolved by the adapter (DP2) and the category name is in the language of the
 * file; the name of an item does not translate (13.4). `null` is the registry's unknown.
 */
export interface PokedexItemRef {
  nombre: string;
  categoria: string;
  sprite: SpriteData | null;
  precioNpc: { vende: number | null; compra: number | null };
  nombreCategoria: string | null;
}

/** The items of `refs`, by id. */
export type PokedexItemRefs = Record<string, PokedexItemRef>;

/**
 * `/{l}/pokedex/datos.json` (PR5): one row per variant with its values in the order of
 * `campos`, and in `refs` what the panels of the rows need besides the row: the elements and
 * the items of their drops.
 */
export interface PokedexData extends PokedexRows {
  refs: { elementos: PokedexElementRefs; items: PokedexItemRefs };
}

/** An option of a filter: the id the URL writes (U3) and the registry's own text for it. */
export type PokedexOption = readonly [id: string, label: string];

/** The values each filter accepts (U3, U4), read by the page from the whole registry. */
export interface PokedexIds {
  /** Every generation present, ascending: the options of «Generación» and the Slots groups. */
  generations: readonly string[];
  /**
   * The tiers present, `t1`…`t7` and then the special ones in the order of 8.0.6, each with
   * the text `formatTier` writes for it («T3», «Legendary»).
   */
  tiers: readonly PokedexOption[];
  /**
   * Every element of the registry, in the order of 8.0.5, with its name: the options of
   * «Elemento» and the names of the «Elementos» row of a Pokémon panel.
   */
  elements: readonly PokedexOption[];
  /**
   * §16.2.2: the elements at least one record's `elementoMoveset` names, in the order of
   * `elements`. Empty while the importer has not written the field, so «Tipo de moveset»
   * has fewer than two options and the filter chips do not draw it (C-R5).
   */
  movesets: readonly PokedexOption[];
  /** The variants present: `normal`, then `shiny`. */
  variants: readonly string[];
}

/**
 * The special tiers in the order of 8.0.6 (the order of `$defs.tierEspecial` of
 * content/schemas/pokemon.schema.json), as URL ids. A tier the registry adds later goes
 * after these, in the order the registry gives it.
 */
export const SPECIAL_TIERS: readonly string[] = [
  'super-rare',
  'ultra-rare',
  'legendary',
  'mythic',
  'ultimate',
];

/** The two variants of 8.0.5, in their order. */
export const VARIANTS: readonly string[] = ['normal', 'shiny'];

// ------------------------------------------------------------------------------ reading

/**
 * What a value of each field may be: a text (`s`), an integer (`i`) or a list of texts (`l`);
 * `?` also takes `null`, the registry's unknown (3.13).
 */
const SHAPES: Record<PokedexField, string> = {
  id: 's',
  nombre: 's',
  numero: 'i?',
  generacion: 'i?',
  variante: 's',
  nivel: 'i?',
  tier: 'si?',
  funcion: 's?',
  elementos: 'l',
  imagen: 's?',
  drops: 'l?',
  elementoMoveset: 's?',
};

function fits(value: unknown, shape: string): boolean {
  if (value === null) return shape.endsWith('?');
  if (typeof value === 'string') return shape.includes('s') && value !== '';
  if (typeof value === 'number') return shape.includes('i') && Number.isInteger(value);
  return (
    shape[0] === 'l' && Array.isArray(value) && value.every((entry) => typeof entry === 'string')
  );
}

/**
 * The rows of a `datos.json`, or of the props, which have its shape. The columns are read by
 * the names of `campos`, so their order is the file's. A missing column or a value of the
 * wrong type throws, and the list controller then reports the data as not loaded (PR5).
 */
export function decodePokedex(data: unknown): PokedexRow[] {
  const file = data as Partial<PokedexRows> | null;
  const { campos, filas } = file ?? {};
  if (file?.v !== 1 || !Array.isArray(campos) || !Array.isArray(filas)) {
    throw new Error('pokedex/datos.json: unknown shape');
  }
  const columns = POKEDEX_FIELDS.map((field) => [field, campos.indexOf(field)] as const);
  return filas.map((fila) => {
    const row: Partial<Record<PokedexField, unknown>> = {};
    for (const [field, index] of columns) {
      const value = Array.isArray(fila) && index >= 0 ? fila[index] : undefined;
      if (!fits(value, SHAPES[field])) throw new Error(`pokedex/datos.json: bad «${field}»`);
      row[field] = value;
    }
    return row as PokedexRow;
  });
}

/** `refs` of a `datos.json`; a file without one of its tables throws, as a bad row does (PR5). */
export function decodeRefs(data: unknown): PokedexData['refs'] {
  const refs = (data as Partial<PokedexData> | null)?.refs;
  for (const table of [refs?.elementos, refs?.items]) {
    if (table === null || typeof table !== 'object') throw new Error('pokedex/datos.json: refs');
  }
  return refs as PokedexData['refs'];
}

// -------------------------------------------------------------------------------- order

/** `variante` of 8.0.5: `normal` before `shiny`, any other value after both. */
function variantRank(variante: string): number {
  const rank = VARIANTS.indexOf(variante);
  return rank < 0 ? VARIANTS.length : rank;
}

/**
 * The order of Pokémon in every list (8.0.5): `numero` ascending with the unknown ones last,
 * `normal` before `shiny`, then `nombre` compared in the page's language. The build writes
 * `datos.json` in this order, and so the first page of the props.
 */
export function pokedexOrder(
  locale: Locale,
): (a: Pick<PokedexRow, 'numero' | 'variante' | 'nombre'>, b: typeof a) => number {
  const collator = new Intl.Collator(locale);
  return (a, b) => {
    if (a.numero !== b.numero) {
      if (a.numero === null) return 1;
      if (b.numero === null) return -1;
      return a.numero - b.numero;
    }
    const variant = variantRank(a.variante) - variantRank(b.variante);
    return variant !== 0 ? variant : collator.compare(a.nombre, b.nombre);
  };
}

/** The URL id of a tier (8.0.6, U3): 3 → `t3`, «Super Rare» → `super-rare`. */
export function tierId(tier: PokedexRow['tier']): string | null {
  if (tier === null) return null;
  return typeof tier === 'number' ? `t${tier}` : tier.toLowerCase().replace(/\s+/g, '-');
}

/** The Slots group of a row (8.2): its generation, or «—» for the variants without one. */
export function generationGroup(row: PokedexRow): string {
  return row.generacion === null ? UNKNOWN : String(row.generacion);
}

/** The ids of a list of options, the values a filter accepts (U3). */
function optionIds(options: readonly PokedexOption[]): string[] {
  return options.map(([id]) => id);
}

/** «Tier (mejor primero)»: the one order of §16.2.1 (`compareTierRank`), ties by Pokédex order. */
function tierRankCompare(a: PokedexRow, b: PokedexRow): number {
  return compareTierRank(a.tier, b.tier);
}

/** «Requisito»: the level to obtain it ascending, unknown last. */
function requisitoCompare(a: PokedexRow, b: PokedexRow): number {
  if (a.nivel === b.nivel) return 0;
  if (a.nivel === null) return 1;
  if (b.nivel === null) return -1;
  return a.nivel - b.nivel;
}

/**
 * «Número», the default order: the order the rows already have. Every row reaches the island
 * in the order of 8.0.5 (`pokedexOrder`, applied by the build), filtering keeps it and the
 * sort is stable, so the island never sorts 910 rows again for it.
 */
function keepOrder(): number {
  return 0;
}

/** The four orders of §16.4.2, in `SortSelect`'s order; `numero` is the default. */
export const POKEDEX_SORTS = ['numero', 'nombre', 'tier', 'requisito'] as const;
export type PokedexSortId = (typeof POKEDEX_SORTS)[number];

/**
 * `SortSelect`'s option texts (DP1), one per `POKEDEX_SORTS` id, in the page's language —
 * the island builds this from `messages.pokedex.sort` the way `TradeListRoot` builds
 * `labels.sorts` from `messages.trade.list.sort` (see `sorts` in src/lib/trade/sort.ts).
 */
export type PokedexSortLabels = Record<PokedexSortId, string>;

/**
 * The configuration of the `pokedex` list (§16.4.2). The island memoises it; the tests
 * build it over the registry, so the filters and the inline script of PR4 are the page's.
 * `locale` only orders «Nombre» (Requisito and Tier need no collator); the island passes
 * the page's.
 */
export function pokedexConfig(
  dataUrl: string,
  ids: PokedexIds,
  locale: Locale,
  sortLabels: PokedexSortLabels,
): ListConfig<PokedexRow> {
  const collator = new Intl.Collator(locale);
  return {
    id: 'pokedex',
    pageSize: POKEDEX_PAGE_SIZE,
    sorts: [
      { id: 'numero', label: sortLabels.numero, compare: keepOrder },
      {
        id: 'nombre',
        label: sortLabels.nombre,
        compare: (a, b) => collator.compare(a.nombre, b.nombre),
      },
      { id: 'tier', label: sortLabels.tier, compare: tierRankCompare },
      { id: 'requisito', label: sortLabels.requisito, compare: requisitoCompare },
    ],
    filters: [
      // The generations the registry has, as the other filters take their ids from it: a
      // generation no record has would leave «Generación» with no option to show, so U4
      // drops it from the URL like any other unknown value.
      {
        key: 'gen',
        values: ids.generations,
        multi: true,
        test: (row, value) => row.generacion === Number(value),
      },
      {
        key: 'tier',
        values: optionIds(ids.tiers),
        multi: true,
        test: (row, value) => tierId(row.tier) === value,
      },
      // A Pokémon matches when the element is one of its own (8.2). `elemento` is the
      // parameter's old name (§16.4.2): a URL still written with it keeps working.
      {
        key: 'tipo',
        values: optionIds(ids.elements),
        multi: true,
        aliasKeys: ['elemento'],
        test: (row, value) => row.elementos.includes(value),
      },
      // Hidden by the filter chips (C-R5) while `ids.movesets` has fewer than two options.
      {
        key: 'moveset',
        values: optionIds(ids.movesets),
        multi: true,
        test: (row, value) => row.elementoMoveset === value,
      },
      {
        key: 'variante',
        values: ids.variants,
        multi: true,
        test: (row, value) => row.variante === value,
      },
    ],
    groupBy: generationGroup,
    groupOrder: ids.generations,
    anchorId: (row) => `pokemon-${row.id}`,
    dataUrl,
  };
}
