// Pure model of the entity pickers (spec 16.3.2): search, facet filters, the keyboard grid and
// the held matrix. Island-safe: no data, no Zod, no DOM.
import type { SpriteProps } from '@/components/game/Sprite';
import type { PokemonTier } from '@/lib/content/types';
import type { TipData } from '@/lib/game/tips';

export interface PickerOption {
  /** Stable id of the entity (content/ id). */
  id: string;
  /** Canonical name: the accessible name of the option and the title of its detail. */
  name: string;
  aliases?: string[];
  /** Pokédex number, searchable as «6» or «#6». */
  number?: number | null;
  sprite: SpriteProps | null;
  /** Tooltip content, shown in the docked detail pane. */
  tip: TipData;
  shiny?: boolean;
  tier?: PokemonTier | null;
  unavailable?: boolean;
  /** Values per filter id: `{ tipo: ['fire', 'flying'], tier: ['t3'] }`. */
  facets?: Record<string, string[]>;
}

/** Active filter values per filter id. */
export type ActiveFilters = Record<string, readonly string[]>;

/** Lower case, without accents or surrounding space. */
export function normalizeSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

/** Name, alias or Pokédex number («6», «#6», «#006») contains / equals the query. */
export function matchesSearch(option: PickerOption, query: string): boolean {
  const q = normalizeSearch(query);
  if (q === '') return true;
  const digits = /^#?0*(\d+)$/.exec(q);
  if (digits && option.number !== undefined && option.number !== null) {
    if (String(option.number) === digits[1]) return true;
  }
  if (normalizeSearch(option.name).includes(q)) return true;
  return (option.aliases ?? []).some((alias) => normalizeSearch(alias).includes(q));
}

/** Any of the chosen values within a filter (OR); every filter with a choice (AND). */
export function matchesFilters(option: PickerOption, active: ActiveFilters): boolean {
  for (const [facet, chosen] of Object.entries(active)) {
    if (chosen.length === 0) continue;
    const values = option.facets?.[facet] ?? [];
    if (!chosen.some((value) => values.includes(value))) return false;
  }
  return true;
}

export function filterOptions(
  options: readonly PickerOption[],
  query: string,
  active: ActiveFilters,
): PickerOption[] {
  return options.filter((option) => matchesFilters(option, active) && matchesSearch(option, query));
}

/** Distinct values a facet takes across the options, in first-seen order. */
export function facetValues(options: readonly PickerOption[], facet: string): string[] {
  const seen = new Set<string>();
  for (const option of options) for (const value of option.facets?.[facet] ?? []) seen.add(value);
  return [...seen];
}

export function hasActiveFilters(active: ActiveFilters): boolean {
  return Object.values(active).some((values) => values.length > 0);
}

export function toggleValue(values: readonly string[], value: string): string[] {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
}

export type GridKey =
  'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'Home' | 'End' | 'PageUp' | 'PageDown';

const GRID_KEYS = new Set<string>([
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
  'PageUp',
  'PageDown',
]);

export function isGridKey(key: string): key is GridKey {
  return GRID_KEYS.has(key);
}

/**
 * Next active cell of a row-major grid of `count` cells in `cols` columns. `enabled` marks the
 * cells that exist (the holes of the held matrix are skipped in the direction of travel); a move
 * that finds no cell keeps the current one. PageUp/PageDown jump `pageRows` rows.
 */
export function gridMove(
  index: number,
  key: GridKey,
  count: number,
  cols: number,
  pageRows = 4,
  enabled: (i: number) => boolean = () => true,
): number {
  if (count <= 0) return -1;
  const c = Math.max(1, cols);
  const first = firstEnabled(0, 1, count, enabled);
  const last = firstEnabled(count - 1, -1, count, enabled);
  if (index < 0 || index >= count)
    return key === 'End' || key === 'ArrowUp' || key === 'PageUp' ? last : first;
  const scan = (start: number, step: number) => {
    const found = firstEnabled(start, step, count, enabled);
    return found === -1 ? index : found;
  };
  switch (key) {
    case 'ArrowRight':
      return scan(index + 1, 1);
    case 'ArrowLeft':
      return scan(index - 1, -1);
    case 'ArrowDown':
      return scan(index + c, c);
    case 'ArrowUp':
      return scan(index - c, -c);
    case 'PageDown':
      return clampEnabled(index + c * pageRows, count, index, enabled, c);
    case 'PageUp':
      return clampEnabled(index - c * pageRows, count, index, enabled, c);
    case 'Home':
      return first;
    case 'End':
      return last;
  }
}

function firstEnabled(
  start: number,
  step: number,
  count: number,
  enabled: (i: number) => boolean,
): number {
  for (let i = start; i >= 0 && i < count; i += step) if (enabled(i)) return i;
  return -1;
}

function clampEnabled(
  target: number,
  count: number,
  index: number,
  enabled: (i: number) => boolean,
  cols: number,
): number {
  // Stay in the same column: clamp to the first / last row that exists, then look for a cell.
  const column = index % cols;
  let t = target;
  if (t >= count) t = column + cols * Math.floor((count - 1 - column) / cols);
  if (t < 0) t = column;
  if (t >= count || t < 0) return index;
  if (enabled(t)) return t;
  const step = t > index ? -1 : 1;
  const found = firstEnabled(t, step, count, enabled);
  return found === -1 ? index : found;
}

// Held matrix (16.3.3): one row per effect, one column per tier present.

export interface HeldInfo {
  ranura: 'x' | 'y';
  efecto: string;
  tier: number;
}

export interface HeldMatrix<T> {
  /** Effects in first-seen order (the registry order). */
  rows: string[];
  /** Tiers that have at least one item, ascending. A column without items is not drawn. */
  tiers: number[];
  /** Row-major cells, `rows.length × tiers.length`; `null` is a hole. */
  cells: (T | null)[];
}

export function heldMatrix<T>(
  items: readonly T[],
  held: (item: T) => HeldInfo | null | undefined,
): HeldMatrix<T> {
  const rows: string[] = [];
  const tierSet = new Set<number>();
  const byKey = new Map<string, T>();
  for (const item of items) {
    const info = held(item);
    if (!info) continue;
    if (!rows.includes(info.efecto)) rows.push(info.efecto);
    tierSet.add(info.tier);
    const key = `${info.efecto}\u0000${info.tier}`;
    if (!byKey.has(key)) byKey.set(key, item);
  }
  const tiers = [...tierSet].sort((a, b) => a - b);
  const cells = rows.flatMap((row) =>
    tiers.map((tier) => byKey.get(`${row}\u0000${tier}`) ?? null),
  );
  return { rows, tiers, cells };
}
