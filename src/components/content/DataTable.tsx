import { isValidElement, useId, useState } from 'react';
import type { CSSProperties, HTMLAttributes, Key, ReactNode } from 'react';

import { Glyph } from '@/components/icons/Glyph';
import type { Locale } from '@/i18n/config';

// DataTable (spec 7.2.3, 4.5, 7.7.4 V4; DS:DataTable): the bordered table of the site. A
// `bg-tertiary` header row, 40 px body rows, 1 px dividers in `border-secondary`, optional
// sortable headers with `aria-sort`, the inactive rows of the Guild, a secondary line under
// a value and the row of the page's own entity. Markup and `ac-data-table*` classes are the
// reference's (`bundle.js` DataTable), so data-table.css ports `bundle.css` unchanged.
//
// Render (C-R1, 7.2.3): server TSX. From an `.astro` page it becomes HTML with no client
// JavaScript, so a table there never passes `sortable`: a sort button nobody hydrates is a
// fake control (C-R5, S11). Sortable headers work inside an island — the Guild tool (§10),
// the Lista view of a list root (7.7.4) — where the table either sorts its own rows
// (`defaultSort`) or receives them already sorted (`sort` + `onSort`).
//
// The rows are either `rows` (cells by column key) or `children`: the `ListRow` rows of a
// Lista view (7.7.4 V4), which draw their own cells.
//
// Site differences from the reference, none of which touches a class:
//   - `.ac-sr` is Tailwind's `sr-only` (spec 3.7), on the caption and on `srOnly` headers.
//   - The sort glyphs are `Glyph` (`sort`, `sort-up`, `sort-down`, 12 px, stroke 2.5; C-R7).
//   - A column `width` travels as the local property `--ac-col-width` (spec 3.7: no literal
//     measure in `style`); data-table.css reads it as the header cell's width.
//   - With `scroll` the wrapper is a named, focusable region (`role="region"`, labelled by
//     the caption, `tabindex="0"`): the table scrolls inside its border at 390 (WG1,
//     CA-11.7) and a keyboard user can scroll it too (WCAG 2.1.1).
//   - No Spanish default for the inactive chip (DP1): an inactive row needs
//     `labels.inactive` from the composer, and a table without it fails at render time
//     instead of shipping the design system's «Inactivo» in `en`.
//
// Empty values (C-R5, spec 8.0.5): a cell with `undefined` or `null` shows «—». That is the
// only place besides card facts where the dash exists; a caller never writes «0», «N/D» or
// «Desconocido» in its place.

export type DataTableSortDir = 'ascending' | 'descending';

export interface DataTableSort {
  key: string;
  dir: DataTableSortDir;
}

export type DataTableAlign = 'left' | 'center' | 'right';

export interface DataTableColumn {
  /** Key into each row's cells. */
  key: string;
  /** Header text, without a colon (T33). */
  label: ReactNode;
  /** Column width in px; the table spreads what is left. */
  width?: number;
  /** Alignment of the cells, and of the header unless `headAlign` is set. Default centre. */
  align?: DataTableAlign;
  /** Header alignment when it differs from the cells (Guild «Última actividad»). */
  headAlign?: DataTableAlign;
  /** The header becomes a sort button and its `th` gets `aria-sort` when active. Islands only. */
  sortable?: boolean;
  /** Direction of the first press on this column: numbers go down, names go up. Default up. */
  sortDir?: DataTableSortDir;
  /** The header text is only for screen readers (the sprite column of a Lista). */
  srOnly?: boolean;
  /** Tabular figures for counts, levels and percentages (spec 4.5). */
  numeric?: boolean;
  /** `ui` draws the cells at 12/16 (dates, relative times), `ui-loose` at 12/20. */
  text?: 'body' | 'ui' | 'ui-loose';
  /** The cells never wrap («Vice-Leader»). */
  nowrap?: boolean;
  /** The cells are row headers, `<th scope="row">`, drawn like the other cells. */
  rowHeader?: boolean;
  /** Column that carries the chip of an inactive row. Default: the last column. */
  badge?: boolean;
}

/** A value with a 12/16 secondary line under it; the row grows to 48 («en curso, día 5 de 7»). */
export interface DataTableCellValue {
  value: ReactNode;
  sub?: ReactNode;
}

/** A cell: a node, or a value with its secondary line. */
export type DataTableCell = ReactNode | DataTableCellValue;

export interface DataTableRow {
  key?: Key;
  /** Cells by column key. A missing value (`undefined` or `null`) shows «—». */
  cells: Record<string, DataTableCell>;
  /** Sort values by column key, for self-sorting tables whose cells are not plain text. */
  values?: Record<string, string | number | null>;
  /** The page's own entity: bold cells and `aria-current` («page» unless another value). */
  current?: boolean | 'page' | 'location' | 'date' | 'true';
  /** `inactive` tints the row, bolds its first cell and adds the inactive chip. */
  tone?: 'inactive';
}

export interface DataTableLabels {
  /** Text of the chip of an inactive row: «Inactivo» / «Inactive». */
  inactive: string;
}

export interface DataTableProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Visually hidden caption of the table. Every table has one (WA2). */
  caption: ReactNode;
  columns: DataTableColumn[];
  /** Data rows. Omit them and pass `ListRow` rows as `children` instead. */
  rows?: DataTableRow[];
  /** Rows drawn by another component (`ListRow`), used when `rows` is omitted. */
  children?: ReactNode;
  /** Controlled sort: the rows arrive already sorted and `onSort` asks for another order. */
  sort?: DataTableSort | null;
  /** Initial sort of a self-sorting table. */
  defaultSort?: DataTableSort | null;
  /** Called with the column key and the new direction when a sortable header is pressed. */
  onSort?: (key: string, dir: DataTableSortDir) => void;
  /** 48 for rows with a stacked chip or a sprite slot (Guild members). Default 40. */
  rowHeight?: 40 | 48;
  /** Rows take `bg-secondary` under the pointer. Lista views only, never reference tables. */
  hover?: boolean;
  /** The table keeps its column widths and scrolls sideways inside its border. */
  scroll?: boolean;
  /** 8 px above and below cell content that wraps to several lines. */
  wrap?: boolean;
  /** 12 px of side padding instead of 16 (the Comercio Lista). */
  dense?: boolean;
  /** Collation of a self-sorting table. Default `es`, as in the design system. */
  locale?: Locale;
  /** Visible strings. Required as soon as a row is inactive (DP1). */
  labels?: DataTableLabels;
}

const DASH = '—';

function classes(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(' ');
}

/** A cell object `{ value, sub }`, as opposed to a node. */
function isCellValue(cell: DataTableCell): cell is DataTableCellValue {
  return (
    cell !== null &&
    typeof cell === 'object' &&
    !Array.isArray(cell) &&
    !isValidElement(cell) &&
    ('value' in cell || 'sub' in cell)
  );
}

function sortValue(row: DataTableRow, key: string): string | number | null {
  const own = row.values?.[key];
  if (own !== undefined) return own;
  let cell = row.cells[key];
  if (isCellValue(cell)) cell = cell.value;
  return typeof cell === 'number' || typeof cell === 'string' ? cell : null;
}

/**
 * Stable sort of the rows of a self-sorting table (reference `sortRows`). Numbers compare
 * as numbers, text with a numeric collator of the locale, and a row without a value for the
 * key goes last in both directions.
 */
function sortRows(
  rows: DataTableRow[],
  sort: DataTableSort | null,
  locale: Locale,
): DataTableRow[] {
  if (!sort?.key) return rows;
  const sign = sort.dir === 'descending' ? -1 : 1;
  const collator = new Intl.Collator(locale, { numeric: true, sensitivity: 'base' });
  return rows
    .map((row, index) => ({ row, index, value: sortValue(row, sort.key) }))
    .sort((a, b) => {
      const aEmpty = a.value === null || a.value === '';
      const bEmpty = b.value === null || b.value === '';
      if (aEmpty || bEmpty) return aEmpty === bEmpty ? a.index - b.index : aEmpty ? 1 : -1;
      const x = a.value as string | number;
      const y = b.value as string | number;
      const order =
        typeof x === 'number' && typeof y === 'number'
          ? x - y
          : collator.compare(String(x), String(y));
      return order ? order * sign : a.index - b.index;
    })
    .map(({ row }) => row);
}

function alignClass(base: string, align: DataTableAlign | undefined): string | null {
  return align === 'left' || align === 'right' ? `${base}--${align}` : null;
}

function SortGlyph({ dir }: { dir: DataTableSortDir | null }) {
  if (dir === 'ascending') return <Glyph name="sort-up" size={12} />;
  if (dir === 'descending') return <Glyph name="sort-down" size={12} />;
  return <Glyph name="sort" size={12} className="ac-data-table__sort-idle" />;
}

export function DataTable({
  caption,
  columns,
  rows,
  children,
  sort: controlledSort,
  defaultSort = null,
  onSort,
  rowHeight = 40,
  hover = false,
  scroll = false,
  wrap = false,
  dense = false,
  locale = 'es',
  labels,
  className,
  ...rest
}: DataTableProps) {
  const [ownSort, setOwnSort] = useState<DataTableSort | null>(defaultSort);
  const captionId = useId();
  const controlled = controlledSort !== undefined;
  const sort = controlled ? controlledSort : ownSort;
  const sortable = columns.some((column) => column.sortable);
  const badgeKey = (columns.find((column) => column.badge) ?? columns[columns.length - 1])?.key;

  if (rows?.some((row) => row.tone === 'inactive') && !labels?.inactive) {
    throw new Error(
      'DataTable: an inactive row needs `labels.inactive` from the dictionary (DP1).',
    );
  }

  function sortBy(column: DataTableColumn) {
    // The first press uses the column's own direction; the next one flips it.
    const dir: DataTableSortDir =
      sort?.key === column.key
        ? sort.dir === 'ascending'
          ? 'descending'
          : 'ascending'
        : (column.sortDir ?? 'ascending');
    if (!controlled) setOwnSort({ key: column.key, dir });
    onSort?.(column.key, dir);
  }

  const head = columns.map((column) => {
    const active = sort?.key === column.key ? sort.dir : null;
    const label = column.srOnly ? <span className="sr-only">{column.label}</span> : column.label;
    const style =
      column.width === undefined
        ? undefined
        : ({ '--ac-col-width': `${column.width}px` } as CSSProperties);
    const th = {
      scope: 'col' as const,
      className: classes(
        'ac-data-table__th',
        alignClass('ac-data-table__th', column.headAlign ?? column.align),
      ),
      style,
    };
    if (!column.sortable) {
      return (
        <th key={column.key} {...th}>
          {label}
        </th>
      );
    }
    return (
      <th key={column.key} {...th} aria-sort={active ?? undefined}>
        <button type="button" className="ac-data-table__sort" onClick={() => sortBy(column)}>
          {label}
          <SortGlyph dir={active} />
        </button>
      </th>
    );
  });

  let body: ReactNode = children;
  if (rows) {
    const ordered = controlled ? rows : sortRows(rows, sort, locale);
    body = ordered.map((row, rowIndex) => {
      const inactive = row.tone === 'inactive';
      let tall = false;
      const cells = columns.map((column) => {
        const raw = row.cells[column.key];
        let value: ReactNode = isCellValue(raw) ? raw.value : raw;
        const subValue = isCellValue(raw) ? raw.sub : undefined;
        if (value === undefined || value === null) value = DASH;
        let sub: ReactNode = null;
        if (subValue !== undefined && subValue !== null) {
          tall = true;
          sub = <span className="ac-data-table__sub">{subValue}</span>;
        }
        const content =
          inactive && column.key === badgeKey ? (
            <span className="ac-data-table__stack">
              <span className="ac-data-table__badge">{labels?.inactive}</span>
              {value}
              {sub}
            </span>
          ) : null;
        const Cell = column.rowHeader ? 'th' : 'td';
        return (
          <Cell
            key={column.key}
            scope={column.rowHeader ? 'row' : undefined}
            className={classes(
              'ac-data-table__cell',
              alignClass('ac-data-table__cell', column.align),
              column.numeric && 'ac-data-table__cell--num',
              column.text === 'ui' && 'ac-data-table__cell--ui',
              column.text === 'ui-loose' && 'ac-data-table__cell--ui-loose',
              column.nowrap && 'ac-data-table__cell--nowrap',
            )}
          >
            {content ?? (
              <>
                {value}
                {sub}
              </>
            )}
          </Cell>
        );
      });
      return (
        <tr
          key={row.key ?? rowIndex}
          className={classes(
            'ac-data-table__row',
            inactive && 'ac-data-table__row--inactive',
            tall && 'ac-data-table__row--tall',
            Boolean(row.current) && 'ac-data-table__row--current',
          )}
          aria-current={
            row.current ? (typeof row.current === 'string' ? row.current : 'page') : undefined
          }
        >
          {cells}
        </tr>
      );
    });
  }

  const region = scroll ? { role: 'region', 'aria-labelledby': captionId, tabIndex: 0 } : undefined;

  return (
    <div
      {...rest}
      {...region}
      className={classes(
        'ac-data-table',
        sortable && 'ac-data-table--sortable',
        rowHeight === 48 && 'ac-data-table--rows-48',
        hover && 'ac-data-table--hover',
        scroll && 'ac-data-table--scroll',
        wrap && 'ac-data-table--wrap',
        dense && 'ac-data-table--dense',
        className,
      )}
    >
      <table className="ac-data-table__table">
        <caption id={scroll ? captionId : undefined} className="sr-only">
          {caption}
        </caption>
        <thead>
          <tr className="ac-data-table__head">{head}</tr>
        </thead>
        <tbody>{body}</tbody>
      </table>
    </div>
  );
}
