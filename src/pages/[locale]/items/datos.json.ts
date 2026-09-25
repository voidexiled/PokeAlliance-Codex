// `/{l}/items/datos.json` (spec 7.7.5 PR5, 8.0.6, 8.5): every row of the item lists, one
// prerendered JSON per locale. `/{l}/items/` and each `/{l}/items/c/{categoria}/` print their
// first page and give their island only those rows; the island asks for this file when it
// hydrates and its list has more rows than its first page, so a view or a page that needs the
// others has them. A category page keeps the rows of its category (`ItemsRoot`).
//
// Shape (PR5): `{ "v": 1, "campos": string[], "filas": unknown[][], "refs": { "elementos",
// "pokemon" } }`. One row per item of `content/items/<categoria>.json` that the build keeps
// (`getItems`, which already leaves the drafts out under OCULTAR_BORRADORES=1), in the Market
// order of `content/items/categorias.json` and, inside a category, in the order of its file
// (8.5). The values are in the order of `campos`, which are `ITEMS_FIELDS` of
// src/components/items/config.ts: the island reads them back with `decodeItems` from the same
// list, so the two cannot drift apart. The sprite is already resolved by the adapter (DP2);
// `uso` is the `Texto` of the record in the language of the file; `dropDe` is the inverse of the
// loot of every Pokémon in any zone (7.5.3), in the Pokémon order of 8.0.5. `refs` holds what
// the panels of the rows need besides the row (7.5.3): each element an item names, with its icon
// and the names of its Stone and Fragment, and each Pokémon that drops an item, with what its
// panel shows. The rest of each panel (the game text, the Ball facts…) is in `/{l}/paneles.json`,
// which every list loads once (src/lib/game/panels.ts). Names and data are the registries'; the
// labels are not here, they come from the dictionary (DP1). An optional field of §3.13 that a
// record does not write is `null`, like the registry's unknown: the views show neither (8.0.5);
// a row leaves out its trailing `null` cells, which `decodeItems` reads back as `null`.
//
// Budget (13.6): at most 60 KB gzip and 400 KB uncompressed; `pnpm perf:budget` measures it.
//
// The pages import the builders from here, so what only the build needs — the registries, the
// sprite adapter and the tooltip builders — stays out of the island, whose exports all reach
// the browser.

import type { APIRoute } from 'astro';

import type { LootCardEntity } from '@/components/cards/LootCard';
import type { ElementChipEntry } from '@/components/game/ElementChip';
import {
  ALL_CATEGORY,
  ITEMS_FIELDS,
  ITEMS_PROPS_ROWS,
  decodeItems,
  dropperEntity,
  elementChip,
  refsOf,
  type ItemsData,
  type ItemsElementRef,
  type ItemsPokemonRef,
  type ItemsRow,
  type ItemsTab,
} from '@/components/items/config';
import { getLocale, locales, type Locale } from '@/i18n/config';
import {
  getCategorias,
  getElementos,
  getItem,
  getItems,
  getSpriteRegistry,
} from '@/lib/content/registry';
import type { Elemento } from '@/lib/content/registry-schema';
import type { PokemonRecord } from '@/lib/content/types';
import { DROPPER_NAMES_MAX } from '@/lib/game/dropper-limit';
import { droppersOf } from '@/lib/game/item-facts';
import { tipIndex } from '@/lib/game/tip-records';
import { elementTip, pokemonTip, type TipLabels } from '@/lib/game/tips';
import { listItemSprite, spriteOrNull } from '@/lib/sprites/resolve';

export const prerender = true;

export function getStaticPaths() {
  return locales.map((locale) => ({ params: { locale } }));
}

type ItemsField = (typeof ITEMS_FIELDS)[number];

/** The name of the item of an id, which does not translate (13.4), or the unknown. */
function itemName(id: string | null): string | null {
  return id === null ? null : (getItem(id)?.nombre ?? null);
}

/** An element as the rows' panels need it, in the language of `locale`. */
function elementRef(element: Elemento, locale: Locale): ItemsElementRef {
  return {
    nombre: element.nombre[locale],
    icono: spriteOrNull(getSpriteRegistry(), element.icono),
    stone: itemName(element.stone),
    fragment: itemName(element.fragment),
  };
}

/** A Pokémon that drops an item, as its panel needs it, in the language of `locale`. */
function pokemonRef(
  record: PokemonRecord,
  elements: ReadonlyMap<string, Elemento>,
  locale: Locale,
): ItemsPokemonRef {
  return {
    nombre: record.nombre,
    variante: record.variante,
    nivel: record.nivel,
    tier: record.tier,
    generacion: record.generacion,
    funcion: record.funcion,
    imagen: record.imagen,
    elementos: record.elementos.flatMap((id) => elements.get(id)?.nombre[locale] ?? []),
  };
}

/**
 * Every item of one locale, in the Market order (8.5). The pages take their first page from
 * here as well, so the prerendered rows are the first rows of this file (or of its category).
 */
export function buildItemsData(locale: Locale): ItemsData {
  const registry = getSpriteRegistry();
  const elements = new Map(getElementos().map((element) => [element.id, element]));
  const index = tipIndex(locale);
  const records = getItems();

  const elementIds = new Set<string>();
  const pokemon = new Map<string, PokemonRecord>();
  const filas = records.map((record) => {
    const elemento =
      record.elemento !== undefined && record.elemento !== null && elements.has(record.elemento)
        ? record.elemento
        : null;
    if (elemento !== null) elementIds.add(elemento);
    // «Drop de»: the Pokémon whose loot holds it in any zone, in the order of 8.0.5.
    const by = droppersOf(record.id, index);
    // Past DROPPER_NAMES_MAX the row carries how many they are, not who (config.ts, `dropDe`).
    const many = by.length > DROPPER_NAMES_MAX;
    if (!many) for (const entry of by) pokemon.set(entry.id, entry);
    const values: Record<ItemsField, unknown> = {
      id: record.id,
      nombre: record.nombre,
      categoria: record.categoria,
      sprite: listItemSprite(registry, record.sprite),
      vende: record.precioNpc.vende,
      compra: record.precioNpc.compra,
      elemento,
      uso: record.uso?.[locale] ?? null,
      dropDe: many ? by.length : by.length > 0 ? by.map((entry) => entry.id) : null,
      held: record.held ?? null,
      mega: record.mega ?? null,
    };
    // The trailing unknowns are left out (§13.6: 2,650 rows since the toys of 2026-09-25):
    // `decodeItems` reads a cell past the end of a row as `null`.
    const fila = ITEMS_FIELDS.map((field) => values[field]);
    while (fila.length > 0 && fila[fila.length - 1] === null) fila.pop();
    return fila;
  });

  return {
    v: 1,
    campos: ITEMS_FIELDS,
    filas,
    refs: {
      // In the order of 8.0.5, the order of `content/elementos.json`.
      elementos: Object.fromEntries(
        [...elements.values()]
          .filter((element) => elementIds.has(element.id))
          .map((element) => [element.id, elementRef(element, locale)]),
      ),
      pokemon: Object.fromEntries(
        [...pokemon.values()].map((record) => [record.id, pokemonRef(record, elements, locale)]),
      ),
    },
  };
}

/**
 * The 14 tabs of the category navigation (8.5 step 3) in the order of the registry: «Todo»,
 * the virtual category, links to `/{l}/items/` and each of the 13 real ones to
 * `/{l}/items/c/{id}/`, each one with its `icono` at 1x and its name in the page's language.
 */
export function itemTabs(locale: Locale): ItemsTab[] {
  const registry = getSpriteRegistry();
  return getCategorias().map((category) => ({
    id: category.id,
    nombre: category.nombre[locale],
    icono: spriteOrNull(registry, category.icono),
    href: category.virtual ? `/${locale}/items/` : `/${locale}/items/c/${category.id}/`,
  }));
}

/** What a page of the list gives its island (PR5): the first page of its default state. */
export interface ItemsFirstPage {
  /** The first rows of the list in the shape of `datos.json`, with the `refs` they name. */
  data: ItemsData;
  /** The rows of `data`, decoded. */
  rows: ItemsRow[];
  /** Rows of the whole list: every item in «Todo», the items of the category otherwise. */
  total: number;
}

/**
 * The first page of the list of `category` (`todo` or the id of a real category): the rows the
 * page prerenders and its island hydrates, and the length of its whole list.
 */
export function itemsFirstPage(data: ItemsData, category: string): ItemsFirstPage {
  const all = decodeItems(data);
  const kept = all.flatMap((row, index) =>
    category === ALL_CATEGORY || row.categoria === category
      ? [{ row, fila: data.filas[index] }]
      : [],
  );
  const first = kept.slice(0, ITEMS_PROPS_ROWS);
  const rows = first.map((entry) => entry.row);
  return {
    data: {
      v: data.v,
      campos: data.campos,
      filas: first.flatMap((entry) => (entry.fila === undefined ? [] : [entry.fila])),
      refs: refsOf(rows, data.refs),
    },
    rows,
    total: kept.length,
  };
}

/**
 * The element chips of `rows`, in the order of 8.0.5: what the prerendered first page and the
 * hydration draw in the «Elemento» facts of the cards. Their panels are built here with
 * `elementTip` (7.5.3) and travel in the props (DP3), so the tooltip builders stay out of the
 * first render of the island (13.6); the island builds the other elements' panels from `refs`
 * with the same builder. An element with neither Stone nor Fragment gets a panel without rows,
 * which `ElementChip` draws as a plain chip (R2).
 */
export function itemsElements(
  rows: readonly ItemsRow[],
  refs: ItemsData['refs'],
  locale: Locale,
  labels: TipLabels,
): ElementChipEntry[] {
  const used = new Set(rows.flatMap((row) => (row.elemento === null ? [] : [row.elemento])));
  return Object.entries(refs.elementos)
    .filter(([id]) => used.has(id))
    .map(([id, ref]) => elementChip(id, ref, locale, labels, elementTip));
}

/**
 * The «Drop de» of each row of `rows` that one Pokémon alone drops, by the id of that Pokémon:
 * its page and its panel (`pokemonTip`), built here for the first page like the element chips.
 * An item that several Pokémon drop shows their count and needs no panel.
 */
export function itemsDroppers(
  rows: readonly ItemsRow[],
  refs: ItemsData['refs'],
  locale: Locale,
  labels: TipLabels,
): Record<string, LootCardEntity> {
  const single = rows.flatMap((row) =>
    Array.isArray(row.dropDe) && row.dropDe.length === 1 ? row.dropDe : [],
  );
  return Object.fromEntries(
    single.flatMap((id) => {
      const ref = refs.pokemon[id];
      return ref === undefined ? [] : [[id, dropperEntity(id, ref, locale, labels, pokemonTip)]];
    }),
  );
}

export const GET: APIRoute = ({ params }) => {
  const locale = getLocale(params.locale);
  return new Response(JSON.stringify(buildItemsData(locale)), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
};
