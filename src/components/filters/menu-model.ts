import type { FilterKind } from './model';

// The pure half of the filter menus (plan «Dirección C»): how a click changes a filter's values,
// how the arrow keys move inside a menu and how the Tier ladder splits in two rows. Apart from
// ./model.ts so it loads with the menus, not with the toolbar (13.6).

/** Whether a filter with `max` already holds as many values as it takes. */
export function isCapped(values: readonly string[], max?: number): boolean {
  return max !== undefined && values.length >= max;
}

/**
 * The values after a click on `id`: a chosen one leaves, another one joins at the end unless
 * the cap is reached, in which case nothing changes (the option is dimmed).
 */
export function toggleValue(values: readonly string[], id: string, max?: number): string[] {
  if (values.includes(id)) return values.filter((value) => value !== id);
  return isCapped(values, max) ? values.slice() : [...values, id];
}

/** The keys that move the focus inside a menu. */
const MOVES = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']);

/**
 * The option the focus goes to from `index` for `key`, in a menu laid out in `rows` (the length
 * of each row: `[6, 6, 6]` for the element grid, `[4, 7]` for the Tier ladder, `[n]` for a
 * segment row). Left and Right step through every option and stop at both ends; Up and Down go
 * to the row above or below, to the option under the same point of the row (so T4 goes up to
 * Ultra Rare), and stay put on the first or the last row; Home and End go to the first and the
 * last option. `null` for any other key.
 */
export function moveIndex(index: number, key: string, rows: readonly number[]): number | null {
  if (!MOVES.has(key)) return null;
  const total = rows.reduce((sum, length) => sum + length, 0);
  if (total === 0) return null;
  const current = Math.min(Math.max(0, index), total - 1);
  if (key === 'Home') return 0;
  if (key === 'End') return total - 1;
  if (key === 'ArrowLeft') return Math.max(0, current - 1);
  if (key === 'ArrowRight') return Math.min(total - 1, current + 1);

  let row = 0;
  let start = 0;
  while (current >= start + (rows[row] ?? 0)) {
    start += rows[row] ?? 0;
    row += 1;
  }
  const target = key === 'ArrowUp' ? row - 1 : row + 1;
  if (target < 0 || target >= rows.length) return current;
  const from = rows[row] ?? 1;
  const to = rows[target] ?? 1;
  const column = Math.min(
    to - 1,
    Math.max(0, Math.round(((current - start + 0.5) * to) / from - 0.5)),
  );
  const targetStart = rows.slice(0, target).reduce((sum, length) => sum + length, 0);
  return targetStart + column;
}

/**
 * The two rows of the Tier ladder, best to worst: the named tiers (Mythic … Super Rare) on the
 * first and the numbered ones (T1 … T7) on the second, each in the order it is given. A
 * ladder of one kind only keeps one row.
 */
export function tierLadderRows<T extends { id: string }>(options: readonly T[]): T[][] {
  const numbered = options.filter((option) => /^t\d+$/.test(option.id));
  const named = options.filter((option) => !/^t\d+$/.test(option.id));
  return [named, numbered].filter((row) => row.length > 0);
}

/** The row lengths of a menu, for `moveIndex`. */
export function menuRows(kind: FilterKind, count: number, tiers?: readonly { id: string }[]) {
  if (kind === 'elements') {
    const rows: number[] = [];
    for (let left = count; left > 0; left -= 6) rows.push(Math.min(6, left));
    return rows;
  }
  if (kind === 'tiers' && tiers) return tierLadderRows(tiers).map((row) => row.length);
  return [count];
}
