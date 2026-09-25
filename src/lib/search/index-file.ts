// The file form of the search index (`/{l}/buscar/indice.json`, spec 7.9.1): the build packs
// the entries with `packSearchIndex` and every reader unpacks them with `expandSearchIndex`
// before it ranks or validates them, so the entries a reader sees are the ones the build made.
//
// Why a packed form (§13.6, BU5: at most 60 KB gzip): an item of a category page repeats what
// its category already says — the route of the category page, the category name as `meta` and
// as its one search term — and its id is, most of the time, the slug of its name. With the
// 1,080 toys of 2026-09-25 the plain list went past 74 KB gzip. The packed file writes an item
// of a category page as a row, `[name, category, page, icon, id?]`, against a table of its
// categories; every other entry stays as it is, in its place, so the order of the index (which
// breaks the ties of 7.9.4) does not change.
//
// Client-safe: no registry, no Zod. The palette loads this module with its first index.

import { normalize } from './normalize';
import type { SearchEntry, SearchIcon } from './rank';

/** A category of the packed rows: the route of its page and its name (`meta`), if any. */
export interface PackedCategory {
  href: string;
  meta?: string;
}

/**
 * A packed item: its name, the index of its category, its page of the category list (1 is the
 * first), its icon (a client item id, «id x frames» for an animated one, the icon itself or
 * `null`) and, only when it is not the slug of its name, its id.
 */
export type PackedItem =
  | [name: string, category: number, page: number, icon: SearchIcon | number | string | null]
  | [
      name: string,
      category: number,
      page: number,
      icon: SearchIcon | number | string | null,
      id: string,
    ];

/** `/{l}/buscar/indice.json`: `v` 2, the categories of the packed items and every entry. */
export interface SearchIndexFile {
  v: 2;
  categorias: PackedCategory[];
  entradas: (SearchEntry | PackedItem)[];
}

/** The file of an item sprite of the client, as the icon of its entry names it. */
const CLIENT_ITEM = /^\/sprites\/items\/cliente\/(\d+)\.png$/;
/** The cell of the game, the size the icon of a client item always has. */
const CELL = 32;

/**
 * The id the importer gives an item of this name (scripts/content/lib/datamine.mjs `slugify`):
 * NFD without diacritics, lowercase, and every run of other characters one hyphen.
 */
export function nameSlug(name: string): string {
  return normalize(name)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** The icon of a client item as a number (still) or «id x frames» (a strip); else as it is. */
function packIcon(icon: SearchIcon | null): SearchIcon | number | string | null {
  if (icon === null) return null;
  const match = CLIENT_ITEM.exec(icon.src);
  const keys = Object.keys(icon).sort().join();
  if (
    match?.[1] === undefined ||
    keys !== 'cell,frames,size,src' ||
    icon.cell !== true ||
    icon.size?.[0] !== CELL ||
    icon.size[1] !== CELL ||
    icon.frames === undefined
  )
    return icon;
  const id = Number(match[1]);
  return icon.frames === 1 ? id : `${id}x${icon.frames}`;
}

function expandIcon(icon: SearchIcon | number | string | null): SearchIcon | null {
  if (typeof icon === 'number') return clientIcon(icon, 1);
  if (typeof icon === 'string') {
    const [id, frames] = icon.split('x');
    return clientIcon(Number(id), Number(frames));
  }
  return icon;
}

function clientIcon(id: number, frames: number): SearchIcon {
  return { src: `/sprites/items/cliente/${id}.png`, size: [CELL, CELL], frames, cell: true };
}

/**
 * The route of an item on its category page (8.6): the page, then `?page={p}` past the first
 * and the anchor `#item-{id}` (H7).
 */
function itemHref(category: string, page: number, id: string): string {
  return `${category}${page > 1 ? `?page=${page}` : ''}#item-${id}`;
}

/** An entry as a packed row, or `null` when it is not an item of a category page. */
function packItem(entry: SearchEntry, categories: PackedCategory[]): PackedItem | null {
  if (entry.kind !== 'item' || entry.dex !== undefined) return null;
  const match = /^(\/[a-z]+\/items\/c\/[a-z0-9-]+\/)(?:\?page=(\d+))?#item-(.+)$/.exec(entry.href);
  if (!match?.[1] || match[3] !== entry.id) return null;
  const page = match[2] === undefined ? 1 : Number(match[2]);
  if (page === 1 && match[2] !== undefined) return null;
  // `terms` is the normalised category name, or nothing without one: anything else stays plain.
  const terms = entry.meta === undefined ? undefined : [normalize(entry.meta)];
  if (JSON.stringify(entry.terms) !== JSON.stringify(terms)) return null;
  let index = categories.findIndex(
    (category) => category.href === match[1] && category.meta === entry.meta,
  );
  if (index === -1) {
    index = categories.length;
    categories.push(
      entry.meta === undefined ? { href: match[1] } : { href: match[1], meta: entry.meta },
    );
  }
  const row: PackedItem = [entry.name, index, page, packIcon(entry.icon)];
  return nameSlug(entry.name) === entry.id ? row : [...row, entry.id];
}

/** The file the build writes (`packSearchIndex(buildSearchIndex(locale))`). */
export function packSearchIndex(entries: readonly SearchEntry[]): SearchIndexFile {
  const categorias: PackedCategory[] = [];
  const entradas = entries.map((entry) => packItem(entry, categorias) ?? entry);
  return { v: 2, categorias, entradas };
}

/**
 * The entries of the file, as the build made them. Anything that is not a packed file comes
 * back as it is, so a reader validates it the way it always has (`decodeSearchIndex`).
 */
export function expandSearchIndex(data: unknown): unknown {
  const file = data as Partial<SearchIndexFile> | null;
  if (
    file === null ||
    typeof file !== 'object' ||
    file.v !== 2 ||
    !Array.isArray(file.categorias) ||
    !Array.isArray(file.entradas)
  )
    return data;
  const categories = file.categorias;
  return file.entradas.map((raw) => {
    if (!Array.isArray(raw)) return raw;
    const [name, index, page, icon, own] = raw;
    const category = categories[index];
    if (category === undefined || typeof name !== 'string') return raw;
    const id = own ?? nameSlug(name);
    const entry: SearchEntry = {
      kind: 'item',
      id,
      name,
      href: itemHref(category.href, page, id),
      icon: expandIcon(icon),
    };
    if (category.meta !== undefined) {
      entry.meta = category.meta;
      entry.terms = [normalize(category.meta)];
    }
    return entry;
  });
}
