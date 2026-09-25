import type { LootCardEntity } from '@/components/cards/LootCard';
import type { ElementChipEntry } from '@/components/game/ElementChip';
import type { Locale } from '@/i18n/config';
import type { PokemonRecord } from '@/lib/content/types';
import type { PanelElement, PanelItem, PanelPokemon } from '@/lib/game/panels';
import { pokemonPanel } from '@/lib/game/pokemon-panel';
import type {
  LocalizedText,
  TipData,
  TipLabels,
  elementTip,
  itemTip,
  pokemonTip,
} from '@/lib/game/tips';
import type { ListConfig } from '@/lib/lists/state';
import { expandListSprite, type SpriteData } from '@/lib/sprites/resolve';

// The `items` list of spec 8.0.6 and 8.5, shared by the build and the island: its
// `ListConfig`, the shape of `/{l}/items/datos.json` (PR5) and the reading half of that shape.
//
// Two sides import this module. src/pages/[locale]/items/datos.json.ts writes the data and
// the two item pages take their first page from it; ItemsRoot.tsx, the island, reads the rows
// back and builds the configuration. Nothing here imports the registry, Zod, a component or a
// tooltip builder at run time (the imports are types only, and the builders arrive as
// arguments), so what the island takes from it is only what it runs.
//
// State (8.0.6): 24 rows a page and no filter — the category is the route, not a parameter.
// One order, the order the build writes the rows in (the Market order of the categories and,
// inside each one, the order of its file, 8.5), so no `SortSelect` (V6). In «Todo» the page is
// cut first and grouped by category after (CGS 2.1), in the Market order; a category page has
// no groups. Every view gives each item the anchor `item-{id}` (H7), where the search index
// sends a reader (`/{l}/items/c/{categoria}/?page={p}#item-{id}`).

/** Rows per page of an item list (8.0.6). */
export const ITEMS_PAGE_SIZE = 96;

/**
 * Rows the prerendered page and its props carry (13.6: props within 20 KB). A longer list takes
 * the rest of its first page from `datos.json` as the island hydrates (PR5). 20 since the items
 * carry their «Drop de» (the imported loot): 28 rows went past the 20 KB.
 */
export const ITEMS_PROPS_ROWS = 20;

/** The virtual category of content/items/categorias.json: `/{l}/items/` (8.5). */
export const ALL_CATEGORY = 'todo';

/**
 * The fields of a row of `datos.json`, in the order of `campos` (PR5): what the three views
 * show and what the item panel (`itemTip`, 7.5.3) needs besides `refs`.
 */
export const ITEMS_FIELDS = [
  'id',
  'nombre',
  'categoria',
  'sprite',
  'vende',
  'compra',
  'elemento',
  'uso',
  'dropDe',
  'held',
  'mega',
] as const;

type ItemsField = (typeof ITEMS_FIELDS)[number];

/**
 * An item of `content/items/<categoria>.json` as the island reads it (§3.13, 8.5):
 *
 * - `nombre`, the game's name, which does not translate (13.4);
 * - `sprite`, the record's key already resolved by the adapter (DP2);
 * - `vende` and `compra`, `precioNpc.vende` («Precio NPC») and `precioNpc.compra` («Precio de
 *   tienda»), whole Pokédólares (S8);
 * - `elemento`, the id of its element in `refs.elementos`, and `uso`, in the language of the
 *   file (both optional fields of §3.13);
 * - `dropDe`, the ids of the Pokémon whose loot holds it in any zone (`drops` and
 *   `dropsPorZona`), in the order of 8.0.5 and each one in `refs.pokemon`: «Drop de» is the
 *   inverse of those fields (7.5.3). Past
 *   `DROPPER_NAMES_MAX` Pokémon it is their number: «Drop de» only counts them (an Evolution
 *   Stone drops from a hundred), and the ids would only weigh on the props and the file.
 *
 * `null` is the registry's unknown, and a field the registry does not write is `null` as well.
 */
export interface ItemsRow {
  id: string;
  nombre: string;
  categoria: string;
  sprite: SpriteData | null;
  vende: number | null;
  compra: number | null;
  elemento: string | null;
  uso: string | null;
  dropDe: readonly string[] | number | null;
  /** `held` of a held item (16.2.3): its slot, effect and tier. */
  held?: { ranura: 'x' | 'y'; efecto: string; tier: number } | null;
  /** `mega` of a Mega Stone (16.2.3): the Pokémon ids it evolves. */
  mega?: { pokemon: readonly string[] } | null;
}

/** The rows of the list: the part of `datos.json` the island decodes (PR5). */
export interface ItemsRows {
  v: 1;
  campos: readonly string[];
  filas: readonly (readonly unknown[])[];
}

/**
 * An element of `content/elementos.json` that an item names, as `refs` carries it: the name in
 * the language of the file, the icon resolved by the adapter (DP2) and the item names of its
 * `stone` and `fragment` (13.4). The same shape as the Pokédex's (`PokedexElementRef`).
 */
export interface ItemsElementRef {
  nombre: string;
  icono: SpriteData | null;
  stone: string | null;
  fragment: string | null;
}

/**
 * A Pokémon that drops an item, as `refs` carries it: what `pokemonTip` (7.5.3) needs to draw
 * its panel when it is the only one that drops the item — the «Drop de» of the card and of the
 * Lista is then that Pokémon, with its page and its panel — and its name, which «Drop de» of
 * the item panel lists. `elementos` are the names of its elements in the language of the file,
 * in the order of its record.
 */
export type ItemsPokemonRef = Pick<
  PokemonRecord,
  'nombre' | 'variante' | 'nivel' | 'tier' | 'generacion' | 'funcion' | 'imagen'
> & { elementos: readonly string[] };

/**
 * `/{l}/items/datos.json` (PR5): one row per item of every category, in the Market order, and
 * in `refs` what the panels need besides the row: the elements the items name and the Pokémon
 * that drop them. The category names are not here: both pages carry the 13 of them for the
 * category navigation, and the island takes them from there.
 */
export interface ItemsData extends ItemsRows {
  refs: {
    elementos: Record<string, ItemsElementRef>;
    pokemon: Record<string, ItemsPokemonRef>;
  };
}

/** A real Market category as the island shows it: its name and its 32 px icon (8.5). */
export interface ItemsCategory {
  id: string;
  /** `nombre` of content/items/categorias.json in the page's language. */
  nombre: string;
  /** `icono` resolved by the adapter (DP2); `null` leaves the cell empty. */
  icono: SpriteData | null;
}

/** A tab of the category navigation (8.5 step 3): «Todo» and the 13 categories. */
export interface ItemsTab extends ItemsCategory {
  /** `/es/items/` for «Todo», `/es/items/c/{id}/` for a category. */
  href: string;
}

// ------------------------------------------------------------------------------ reading

/**
 * What a value of each field may be: a text (`s`), an integer (`i`), a list of texts (`l`), a
 * list of texts or an integer (`L`) or a resolved sprite (`p`); `?` also takes `null`.
 */
const SHAPES: Record<ItemsField, string> = {
  id: 's',
  nombre: 's',
  categoria: 's',
  sprite: 'p?',
  vende: 'i?',
  compra: 'i?',
  elemento: 's?',
  uso: 's?',
  dropDe: 'L?',
  held: 'o?',
  mega: 'o?',
};

function fits(value: unknown, shape: string): boolean {
  if (value === null || (value === undefined && shape === 'o?')) return shape.endsWith('?');
  if (typeof value === 'string') return shape[0] === 's' && value !== '';
  if (typeof value === 'number')
    return (shape[0] === 'i' || shape[0] === 'L') && Number.isInteger(value) && value >= 0;
  if (shape[0] === 'o') return typeof value === 'object' && !Array.isArray(value);
  if (Array.isArray(value)) {
    return (
      (shape[0] === 'l' || shape[0] === 'L') && value.every((entry) => typeof entry === 'string')
    );
  }
  return (
    shape[0] === 'p' &&
    typeof value === 'object' &&
    typeof (value as Partial<SpriteData>).src === 'string'
  );
}

/**
 * The rows of a `datos.json`, or of the props, which have its shape. The columns are read by
 * the names of `campos`, so their order is the file's. A missing column or a value of the
 * wrong type throws, and the list controller then reports the data as not loaded (PR5).
 */
export function decodeItems(data: unknown): ItemsRow[] {
  const file = data as Partial<ItemsRows> | null;
  const { campos, filas } = file ?? {};
  if (file?.v !== 1 || !Array.isArray(campos) || !Array.isArray(filas)) {
    throw new Error('items/datos.json: unknown shape');
  }
  const columns = ITEMS_FIELDS.map((field) => [field, campos.indexOf(field)] as const);
  return filas.map((fila) => {
    const row: Partial<Record<ItemsField, unknown>> = {};
    for (const [field, index] of columns) {
      const cell = !Array.isArray(fila)
        ? undefined
        : index >= 0
          ? fila[index]
          : SHAPES[field] === 'o?'
            ? null
            : undefined;
      // The file writes a client item sprite as its client id, and frames (`listItemSprite`).
      const value =
        field === 'sprite' && (typeof cell === 'number' || typeof cell === 'string')
          ? expandListSprite(cell)
          : cell;
      if (!fits(value, SHAPES[field])) throw new Error(`items/datos.json: bad «${field}»`);
      row[field] = value;
    }
    return row as unknown as ItemsRow;
  });
}

/** `refs` of a `datos.json`; a file without one of its tables throws, as a bad row does (PR5). */
export function decodeItemsRefs(data: unknown): ItemsData['refs'] {
  const refs = (data as Partial<ItemsData> | null)?.refs;
  for (const table of [refs?.elementos, refs?.pokemon]) {
    if (table === null || typeof table !== 'object') throw new Error('items/datos.json: refs');
  }
  return refs as ItemsData['refs'];
}

// -------------------------------------------------------------------------------- panels
//
// The panels of 7.5.3 an item list draws, written once for both sides. The build calls them
// with the builders of src/lib/game/tips.ts for the first page, whose panels travel in the
// props (DP3); the island calls them with the same builders once its deferred part has
// loaded them, for every other row (13.6). A name here is already in the language of the
// page, the only one the builders read.

/** A name of the page's language as the `Texto` a builder reads (13.4). */
function localized(text: string, locale: Locale): LocalizedText {
  return { [locale]: text } as LocalizedText;
}

/**
 * An element of `refs` as `ElementChip` takes it, with its panel (`elementTip`). `balls` are the
 * Balls that favour it, from `/{l}/paneles.json` once it is here.
 */
export function elementChip(
  id: string,
  ref: ItemsElementRef,
  locale: Locale,
  labels: TipLabels,
  build: typeof elementTip,
  balls?: readonly string[],
): ElementChipEntry {
  return {
    id,
    name: ref.nombre,
    icon: ref.icono,
    tip: build(
      {
        id,
        nombre: localized(ref.nombre, locale),
        icono: ref.icono,
        stone: ref.stone,
        fragment: ref.fragment,
        balls,
      },
      locale,
      labels,
    ),
  };
}

/**
 * The «Drop de» of an item that one Pokémon alone drops (7.5.3, LootCard): its name, its page
 * and its panel (`pokemonTip`), completed by its facts of `/{l}/paneles.json` once it is here.
 */
export function dropperEntity(
  id: string,
  ref: ItemsPokemonRef,
  locale: Locale,
  labels: TipLabels,
  build: typeof pokemonTip,
  extra?: PanelPokemon,
  tipos?: readonly PanelElement[],
): LootCardEntity {
  return {
    name: ref.nombre,
    href: `/${locale}/pokedex/${id}/`,
    tip: build(
      {
        ...ref,
        id,
        elementos: ref.elementos.map((nombre) => ({ nombre: localized(nombre, locale) })),
        ...pokemonPanel(extra, locale, tipos),
      },
      locale,
      labels,
    ),
  };
}

/**
 * The panel of an item (`itemTip`, 7.5.3, 8.5): its game text and the same rows in every
 * category — Categoría, the held slot and tier, the Mega Stone's Pokémon, Evoluciona, Elemento,
 * the Ball's facts, Drop de, Se obtiene en, Uso, Precio NPC, Precio de tienda and Mercado — each
 * one only with a value. `category` is the name of its Market category in the page's language;
 * `extra` its facts of `/{l}/paneles.json` once it is here (the held slot and tier are the row's).
 */
export function itemPanel(
  row: ItemsRow,
  refs: ItemsData['refs'],
  category: string | null,
  locale: Locale,
  labels: TipLabels,
  build: typeof itemTip,
  extra?: PanelItem,
): TipData {
  const element = row.elemento === null ? undefined : refs.elementos[row.elemento];
  return build(
    {
      id: row.id,
      nombre: row.nombre,
      categoria: row.categoria,
      sprite: row.sprite,
      precioNpc: { vende: row.vende, compra: row.compra },
      nombreCategoria: category === null ? null : localized(category, locale),
      // A number: past DROPPER_NAMES_MAX the panel only counts them.
      dropDe:
        typeof row.dropDe === 'number'
          ? row.dropDe
          : (row.dropDe ?? []).flatMap((id) => refs.pokemon[id]?.nombre ?? []),
      nombreElemento: element === undefined ? null : localized(element.nombre, locale),
      uso: row.uso === null ? null : localized(row.uso, locale),
      ...extra,
      held: row.held ?? extra?.held ?? null,
    },
    locale,
    labels,
  );
}

/**
 * The part of `refs` that `rows` name: the props of the first page carry only that (PR5,
 * 13.6), and the island reads it like the whole `refs` of `datos.json`.
 */
export function refsOf(rows: readonly ItemsRow[], refs: ItemsData['refs']): ItemsData['refs'] {
  const elementos: ItemsData['refs']['elementos'] = {};
  const pokemon: ItemsData['refs']['pokemon'] = {};
  for (const row of rows) {
    const element = row.elemento === null ? undefined : refs.elementos[row.elemento];
    if (row.elemento !== null && element !== undefined) elementos[row.elemento] = element;
    for (const id of Array.isArray(row.dropDe) ? row.dropDe : []) {
      const ref = refs.pokemon[id];
      if (ref !== undefined) pokemon[id] = ref;
    }
  }
  return { elementos, pokemon };
}

// -------------------------------------------------------------------------------- config

/**
 * The one order of the list (8.0.6): the order the rows already have. The build writes them
 * in the Market order and, inside a category, in the order of its file (8.5); the sort is
 * stable, so the island never sorts them again.
 */
function keepOrder(): number {
  return 0;
}

/**
 * The configuration of the `items` list (8.0.6) of one page: `category` is `todo` on
 * `/{l}/items/` and the id of the category on `/{l}/items/c/{id}/`. Only «Todo» groups, by
 * category, in `categories` order (the Market order). The saved view is one for both pages
 * (`ac:vista:items`, U6). The island memoises it; the tests build it the same way, so the
 * inline script of PR4 is the page's.
 */
export function itemsConfig(
  dataUrl: string,
  category: string,
  categories: readonly string[],
): ListConfig<ItemsRow> {
  const grouped = category === ALL_CATEGORY;
  return {
    id: 'items',
    pageSize: ITEMS_PAGE_SIZE,
    // One order, so no `SortSelect` shows its label (V6, 8.0.6).
    sorts: [{ id: 'mercado', label: '', compare: keepOrder }],
    filters: [],
    // «Buscar ítem» (§16.4.1): the name, live.
    text: (row: ItemsRow) => row.nombre,
    // Ranuras (the game inventory) and Lista; a stored or linked «cards» falls back to Ranuras.
    defaultView: 'slots',
    views: ['slots', 'list'],
    ...(grouped ? { groupBy: (row: ItemsRow) => row.categoria, groupOrder: categories } : {}),
    anchorId: (row) => `item-${row.id}`,
    dataUrl,
  };
}
