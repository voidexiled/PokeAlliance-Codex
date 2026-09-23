// Shape of the search index and the pure scoring and grouping of spec 7.9.1 and
// 7.9.4. No DOM and no data: the palette (src/components/search/SearchPalette.tsx)
// and the results page of spec 8.6 both rank with these functions, and
// tests/search/rank.test.ts covers them.

import type { Locale } from '@/i18n/config';

import { normalize, normalizeQuery, words } from './normalize';

/** Groups of the index, in the fixed order of the menu (spec 7.9.1). */
export const searchKinds = ['pokemon', 'sistema', 'item', 'actividad', 'pagina'] as const;

export type SearchKind = (typeof searchKinds)[number];

/**
 * The serialisable part of the design system's `SpriteProps` that an index entry
 * carries, so the palette can draw the 32 px icon cell of spec 7.9.3 without
 * reading a registry in the browser: a pixel sprite at 1x in its cell, or an
 * illustration (Pokémon art, element icon) drawn smooth at 24.
 */
export interface SearchIcon {
  /** Image URL; a horizontal strip of `frames` frames for a sheet. */
  src: string;
  /** Natural size of one frame, [width, height] in px. */
  size?: [number, number];
  /** Frames of the strip. */
  frames?: number;
  /** Frame to show, 0-based. */
  frame?: number;
  /** Integer scale of a pixel sprite. */
  scale?: number;
  /** Draw inside the game cell, centred on whole pixels. */
  cell?: boolean;
  /** Illustration: smooth scaling to `width` x `height`. */
  smooth?: boolean;
  width?: number;
  height?: number;
}

/**
 * One entry of `/{l}/buscar/indice.json`. `id`, `meta`, `dex` and `terms` are
 * the text spec 8.6 searches besides the name; `terms` arrives **already
 * normalised** from the build, so the browser only normalises the query.
 *
 * `tip` (the tooltip data of spec 7.5.2) is not written yet: the game layer
 * lands in M4 and spec 7.9.5 draws the tooltip of the active option with it.
 */
export interface SearchEntry {
  kind: SearchKind;
  id: string;
  name: string;
  href: string;
  icon: SearchIcon | null;
  /** Second line of the option: tier, category, subtitle (spec 8.6). */
  meta?: string;
  /** Pokédex number, matched by the «6», «006», «#6» and «nº 6» forms. */
  dex?: number;
  /** Extra searchable text, normalised: element ids, `shiny`, category name. */
  terms?: string[];
}

/** Entries of one group, capped and already in display order. */
export interface SearchGroup {
  kind: SearchKind;
  entries: SearchEntry[];
}

/** Results shown per group in the palette (spec 7.9.3). */
export const MAX_PER_KIND = 8;

/**
 * Scores of spec 7.9.4, lowest first. `other` covers everything rule 4 names:
 * a match in `meta`, the exact Pokédex number, and the rest of the searchable
 * text of spec 8.6 (the id and `terms`).
 */
const SCORE = {
  exactName: 0,
  namePrefix: 1,
  wordPrefix: 2,
  nameSubstring: 3,
  other: 4,
} as const;

/** «6», «006», «#6», «nº 6», «no. 6»: the four written forms of spec 8.6. */
const DEX_QUERY = /^(?:#\s*|n[ºo]\.?\s*)?0*(\d{1,4})$/;

const collators = new Map<Locale, Intl.Collator>();

function collator(locale: Locale): Intl.Collator {
  let found = collators.get(locale);
  if (!found) {
    found = new Intl.Collator(locale, { numeric: true });
    collators.set(locale, found);
  }
  return found;
}

/**
 * The Pokédex number a query writes, or `null` when the query is not a number.
 * The query must already be normalised (`nº` keeps its masculine ordinal).
 */
export function parseDexNumber(query: string): number | null {
  const match = DEX_QUERY.exec(query);
  return match ? Number(match[1]) : null;
}

/**
 * The score of one entry for an **already normalised** query, or `null` when the
 * entry does not match at all.
 */
export function scoreEntry(entry: SearchEntry, query: string): number | null {
  if (query.length === 0) return null;

  const name = normalize(entry.name);
  if (name === query) return SCORE.exactName;
  if (name.startsWith(query)) return SCORE.namePrefix;
  if (words(entry.name).some((word) => word.startsWith(query))) return SCORE.wordPrefix;
  if (name.includes(query)) return SCORE.nameSubstring;

  if (entry.meta !== undefined && normalize(entry.meta).includes(query)) return SCORE.other;

  const dex = parseDexNumber(query);
  if (dex !== null && entry.dex === dex) return SCORE.other;

  if (normalize(entry.id).includes(query)) return SCORE.other;
  if (entry.terms?.some((term) => term.includes(query))) return SCORE.other;

  return null;
}

/**
 * Matching entries grouped by kind, in the order of `searchKinds`, with at most
 * `perKind` in each group and no empty group.
 *
 * Order inside a group: score first, then the kind (so a tie keeps the order of
 * the menu when a later step flattens the groups) and then the name with
 * `Intl.Collator(locale, { numeric: true })`, as spec 7.9.4 fixes.
 */
export function rankSearch(
  entries: readonly SearchEntry[],
  query: string,
  locale: Locale,
  perKind: number = MAX_PER_KIND,
): SearchGroup[] {
  const normalized = normalizeQuery(query);
  if (normalized.length === 0) return [];

  const scored: { entry: SearchEntry; score: number }[] = [];
  for (const entry of entries) {
    const score = scoreEntry(entry, normalized);
    if (score !== null) scored.push({ entry, score });
  }

  const compare = collator(locale);
  scored.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    const kinds = searchKinds.indexOf(a.entry.kind) - searchKinds.indexOf(b.entry.kind);
    if (kinds !== 0) return kinds;
    return compare.compare(a.entry.name, b.entry.name);
  });

  const byKind = new Map<SearchKind, SearchEntry[]>();
  for (const { entry } of scored) {
    const group = byKind.get(entry.kind) ?? [];
    if (group.length >= perKind) continue;
    group.push(entry);
    byKind.set(entry.kind, group);
  }

  return searchKinds
    .filter((kind) => byKind.has(kind))
    .map((kind) => ({ kind, entries: byKind.get(kind) ?? [] }));
}
