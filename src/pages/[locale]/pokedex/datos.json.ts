// `/{l}/pokedex/datos.json` (spec 7.7.5 PR5, 8.0.6, 8.2): every row of the Pokédex list, one
// prerendered JSON per locale. The page prints the first page of the default state and its
// island asks for this file when it hydrates, so a filter, a view or a page that needs the
// other rows has them. The Tier list of M9 reads the same file (8.0.6).
//
// Shape (PR5): `{ "v": 1, "campos": string[], "filas": unknown[][], "refs": { "elementos",
// "items" } }`. One row per record of `content/pokemon.json`, in the order of every Pokémon
// list (8.0.5), with the values the registry writes in the order of `campos`, which are
// `POKEDEX_FIELDS` of src/components/pokedex/config.ts: the island reads them back with
// `decodePokedex` from the same list, so the two cannot drift apart. `drops` is the one column
// in a shape of its own: the item ids of the record's `drops`, in its order, or `null` without
// any — the card shows no quantity (8.2). `refs` holds what the panels of the rows need besides
// the row (7.5.3): each element of `content/elementos.json`, by id and in the order of 8.0.5,
// with its name in the language of the file, its icon already resolved by the sprite adapter
// (DP2) and the item names of its `stone` and `fragment`; and each item a row drops, with its
// sprite resolved, its prices and the name of its category, while its «Drop de» is the inverse
// of the rows' `drops`. A drop whose item the registry does not give (a draft hidden by
// `OCULTAR_BORRADORES`) is left out of the row, as it is left out of the Pokémon page. Names and
// data are the registries'; the labels are not here, they come from the dictionary (DP1).
//
// Budget (13.6): at most 60 KB gzip and 400 KB uncompressed; `pnpm perf:budget` measures it.
//
// The page imports the builders from here, so what only the build needs — the registries, the
// sprite adapter and the tooltip builders — stays out of the island, whose exports all reach
// the browser.

import type { APIRoute } from 'astro';

import type { DexCardDrop } from '@/components/cards/DexCard';
import type { ElementChipEntry } from '@/components/game/ElementChip';
import {
  POKEDEX_FIELDS,
  SPECIAL_TIERS,
  VARIANTS,
  pokedexOrder,
  tierId,
  type PokedexData,
  type PokedexElementRef,
  type PokedexIds,
  type PokedexItemRef,
  type PokedexOption,
  type PokedexRow,
} from '@/components/pokedex/config';
import { getLocale, locales, type Locale } from '@/i18n/config';
import { formatTier } from '@/lib/content/format';
import { getCategorias, getElementos, getItem, getSpriteRegistry } from '@/lib/content/registry';
import type { Elemento } from '@/lib/content/registry-schema';
import { getPokemon } from '@/lib/content/repository';
import type { PokemonRecord } from '@/lib/content/types';
import { elementTip, itemTip, type LocalizedText, type TipLabels } from '@/lib/game/tips';
import { spriteOrNull } from '@/lib/sprites/resolve';

export const prerender = true;

export function getStaticPaths() {
  return locales.map((locale) => ({ params: { locale } }));
}

/** An element of `content/elementos.json` (3.13): `stone` and `fragment` are item ids. */
type ElementRecord = Elemento;

/** The element registry, in the order of 8.0.5 (the order of every filter and list of them). */
const ELEMENT_RECORDS: readonly ElementRecord[] = getElementos();

/** The name of the item of an id, which does not translate (13.4), or the unknown. */
function itemName(id: string | null): string | null {
  return id === null ? null : (getItem(id)?.nombre ?? null);
}

/** An element as the rows' panels need it, in the language of `locale`. */
function elementRef(element: ElementRecord, locale: Locale): PokedexElementRef {
  return {
    nombre: element.nombre[locale],
    icono: spriteOrNull(getSpriteRegistry(), element.icono),
    stone: itemName(element.stone),
    fragment: itemName(element.fragment),
  };
}

/** The item ids of a record's `drops` that the registry gives, or `null` without any. */
function dropIds(record: PokemonRecord): string[] | null {
  const ids = (record.drops ?? [])
    .map((drop) => drop.item)
    .filter((id) => getItem(id) !== undefined);
  return ids.length > 0 ? ids : null;
}

/** An item a row drops, as `refs.items` carries it (PR5), or `null` when it is not in the registry. */
function itemRef(id: string, locale: Locale): PokedexItemRef | null {
  const item = getItem(id);
  if (item === undefined) return null;
  const category = getCategorias().find((entry) => entry.id === item.categoria);
  return {
    nombre: item.nombre,
    categoria: item.categoria,
    sprite: spriteOrNull(getSpriteRegistry(), item.sprite),
    precioNpc: item.precioNpc,
    nombreCategoria: category?.nombre[locale] ?? null,
  };
}

/**
 * The whole list of one locale in the order of 8.0.5. The page takes its first page from here
 * as well, so the prerendered rows are the first rows of this file.
 */
export function buildPokedexData(locale: Locale): PokedexData {
  const records = [...getPokemon()].sort(pokedexOrder(locale));
  const filas = records.map((record) =>
    POKEDEX_FIELDS.map((field) => (field === 'drops' ? dropIds(record) : record[field])),
  );
  const dropped = [...new Set(records.flatMap((record) => dropIds(record) ?? []))];
  return {
    v: 1,
    campos: POKEDEX_FIELDS,
    filas,
    refs: {
      elementos: Object.fromEntries(
        ELEMENT_RECORDS.map((element) => [element.id, elementRef(element, locale)]),
      ),
      items: Object.fromEntries(
        dropped.flatMap((id) => {
          const ref = itemRef(id, locale);
          return ref === null ? [] : [[id, ref]];
        }),
      ),
    },
  };
}

/**
 * The drops of `rows` (8.2), by item id, as the zone «Drops» of `DexCard` takes them: what the
 * prerendered first page and the hydration draw. Their panels are built here with `itemTip`
 * (7.5.3) and travel in the props (DP3), as the element chips of the first page do; the island
 * builds the panels of the other pages' items from `refs.items` with the same builder and the
 * same «Drop de», the inverse of the `drops` of every row (`all`), in the order of 8.0.5.
 */
export function pokedexDrops(
  rows: readonly PokedexRow[],
  all: readonly PokedexRow[],
  items: PokedexData['refs']['items'],
  locale: Locale,
  labels: TipLabels,
): Record<string, DexCardDrop> {
  const ids = new Set(rows.flatMap((row) => row.drops ?? []));
  return Object.fromEntries(
    [...ids].flatMap((id) => {
      const ref = items[id];
      if (ref === undefined) return [];
      const tip = itemTip(
        {
          ...ref,
          id,
          nombreCategoria:
            ref.nombreCategoria === null
              ? null
              : ({ [locale]: ref.nombreCategoria } as LocalizedText),
          dropDe: all.filter((row) => row.drops?.includes(id)).map((row) => row.nombre),
        },
        locale,
        labels,
      );
      return [[id, { name: ref.nombre, sprite: ref.sprite, tip }]];
    }),
  );
}

/**
 * The element chips of `rows` (8.2), in the order of 8.0.5: what the prerendered first page
 * and the hydration of the island draw, the chip of a card and the cell of the Lista. Their
 * panels are built here with `elementTip` (7.5.3) and travel in the props (DP3), so the
 * tooltip builders stay out of the first render of the island (13.6); the island builds the
 * other elements' panels from `refs` with the same builder. An element with neither Stone
 * nor Fragment gets a panel without rows, which `ElementChip` draws as a plain chip (R2).
 */
export function pokedexElements(
  rows: readonly PokedexRow[],
  locale: Locale,
  labels: TipLabels,
): ElementChipEntry[] {
  const used = new Set(rows.flatMap((row) => row.elementos));
  return ELEMENT_RECORDS.filter((element) => used.has(element.id)).map((element) => {
    const ref = elementRef(element, locale);
    return {
      id: element.id,
      name: ref.nombre,
      icon: ref.icono,
      tip: elementTip(
        {
          id: element.id,
          nombre: element.nombre,
          icono: ref.icono,
          stone: ref.stone,
          fragment: ref.fragment,
        },
        locale,
        labels,
      ),
    };
  });
}

/** Where a special tier goes among the others: the order of 8.0.6, the unknown ones after. */
function specialRank(id: string): number {
  const rank = SPECIAL_TIERS.indexOf(id);
  return rank < 0 ? SPECIAL_TIERS.length : rank;
}

/**
 * The values each filter of the list accepts (8.0.6, U3), from every record of the registry:
 * a generation, a tier or a variant no record has is not an option, and U4 drops it from the
 * URL. The elements are the registry's, all of them (8.2).
 */
export function pokedexIds(
  records: readonly PokedexRow[],
  elements: PokedexData['refs']['elementos'],
): PokedexIds {
  const generations = new Set<number>();
  const numbered = new Map<number, PokedexOption>();
  const special = new Map<string, PokedexOption>();
  const variants = new Set<string>();
  for (const record of records) {
    if (record.generacion !== null) generations.add(record.generacion);
    const tier = tierId(record.tier);
    if (tier !== null && record.tier !== null) {
      const option: PokedexOption = [tier, formatTier(record.tier)];
      if (typeof record.tier === 'number') numbered.set(record.tier, option);
      else special.set(tier, option);
    }
    variants.add(record.variante);
  }
  const ascending = (a: number, b: number) => a - b;
  return {
    generations: [...generations].sort(ascending).map(String),
    tiers: [
      ...[...numbered.entries()].sort(([a], [b]) => a - b).map(([, option]) => option),
      ...[...special.values()].sort(([a], [b]) => specialRank(a) - specialRank(b)),
    ],
    elements: Object.entries(elements).map(([id, element]) => [id, element.nombre]),
    variants: VARIANTS.filter((variant) => variants.has(variant)),
  };
}

export const GET: APIRoute = ({ params }) => {
  const locale = getLocale(params.locale);
  return new Response(JSON.stringify(buildPokedexData(locale)), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
};
