import { useMemo, useState } from 'react';
import type { MouseEvent } from 'react';

import '@/styles/components/guild-members.css';

import { DataTable } from '@/components/content/DataTable';
import type {
  DataTableColumn,
  DataTableRow,
  DataTableSort,
  DataTableSortDir,
} from '@/components/content/DataTable';
import { Button } from '@/components/controls/Button';
import { Pagination } from '@/components/controls/Pagination';
import { TextField } from '@/components/controls/TextField';
import { ToggleGroup } from '@/components/controls/ToggleGroup';
import { MemberDialog } from '@/components/guild/MemberDialog';
import type { GuildMemberDetail } from '@/components/guild/MemberDialog';
import { Sparkline } from '@/components/guild/Sparkline';
import { Section } from '@/components/layout/Section';
import type { Locale } from '@/i18n/config';
import type { Messages } from '@/i18n/messages/en';
import { fill } from '@/i18n/messages/types';
import { formatDayMonth } from '@/lib/format/dates';
import { formatInteger, formatPercent } from '@/lib/format/numbers';
import {
  filterGuildMemberRows,
  getGuildTrendMax,
  sortGuildMemberRows,
} from '@/lib/tools/guild-analytics';
import type {
  GuildLastActivity,
  GuildMemberRow,
  GuildMemberSortKey,
} from '@/lib/tools/guild-analytics';
import type { GuildDifficultyAllocation } from '@/lib/tools/guild-difficulty';

// GuildMembers (spec 10.9; `Lienzo:Guild` «Miembros»): the toolbar — «Buscar miembro», the
// «Filtrar miembros» ToggleGroup «Todos (n)» / «Inactivos (k)» and the two exports — the
// `DataTable` «Puntos por miembro» with 10 rows a page, and the member dialog its names open.
//
// Presentational (10.3): every figure of a row arrives computed by `guild-analytics.ts` —
// today, 7 and 30 days, the 14 daily points of the trend and its variation, the last activity,
// the idle days and the inactive mark (threshold X of 10.11) — and so do the search, the
// filter, the order and the scale of the trend (`filterGuildMemberRows`,
// `sortGuildMemberRows`, `getGuildTrendMax`). This component keeps only the state of the
// view: the search, the filter, the order, the page and the open member.
//
// - Order: «7 días» descending by default (10.9). Numbers go down on their first press, the
//   name goes up, «Última actividad» puts the most idle first (`idleDays`); a row without a
//   value for the column goes last both ways. It is applied before the page is cut, so the
//   ten rows of a page and the exports follow the same order.
// - Exports (10.12): «Exportar PNG» and «Exportar CSV» hand the island the rows of the
//   search and the filter in the current order, every page; the island writes the files.
// - Pages: real links (P-28, WG5) to `?miembros=n#miembros`, so «open in a new tab» lands on
//   that page, which this component reads when it mounts; a plain click changes the page in
//   place.
// - The trend: one `Sparkline` per row on one shared scale, the largest daily points of any
//   member, so the bars of two rows compare; a day without an export draws the 1 px tick.
// - Inactive rows: `tone="inactive"`, the name in 700 and the «Inactivo» chip over the last
//   activity (DataTable). A view without rows draws no empty table: a search says it found
//   nothing (`noMatch`), the «Inactivos» filter keeps only its help line.
//
// The rank is the client's term without its article, the same in es and en (E13). Every text
// is the dictionary's (`guild.members`, `guild.member`, `ui`; DP1).

export type GuildMembersFilter = 'all' | 'inactive';

export interface GuildMembersProps {
  locale: Locale;
  /** `guild` of the dictionary: `members`, `member` and the «sin export» of `days`. */
  messages: Pick<Messages['guild'], 'members' | 'member' | 'days'>;
  /** Leaves of `ui`: the inactive chip, the pagination, the dialog and its number fields. */
  ui: Pick<
    Messages['ui'],
    'inactive' | 'pagination' | 'prev' | 'next' | 'page' | 'close' | 'decrease' | 'increase'
  >;
  /** The members of the last export dated ≤ D (`getGuildMembers`). */
  rows: readonly GuildMemberRow[];
  /** Threshold X of the settings (10.11), for the «Inactivos» help line. */
  inactivityDays: number;
  /** The dialog of a member; `null` keeps a name from opening one. */
  memberDetail: (key: string) => GuildMemberDetail | null;
  /** The rows of the search and the filter, in the current order, every page (10.12). */
  onExportCsv: (rows: readonly GuildMemberRow[], filter: GuildMembersFilter) => void;
  /**
   * The same rows for the PNG. When it resolves, «Imagen descargada.» is announced; the
   * island reports its own errors.
   */
  onExportPng: (
    rows: readonly GuildMemberRow[],
    filter: GuildMembersFilter,
  ) => void | Promise<void>;
  /** «Guardar desglose» of the member dialog. */
  onSaveSplit?: (key: string, date: string, allocation: GuildDifficultyAllocation) => void;
  /** «Volver a automático» of the member dialog. */
  onResetSplit?: (key: string, date: string) => void;
  /** A search without matches: `search.empty`, «Sin resultados para «{q}».». */
  noMatch?: string;
  /** Anchor of the section. */
  id?: string;
}

const PAGE_SIZE = 10;
const PAGE_PARAM = 'miembros';

const DEFAULT_SORT: DataTableSort = { key: 'days7', dir: 'descending' };

/** The column keys of the table and the order keys of `sortGuildMemberRows`. */
const SORT_KEYS: Readonly<Record<string, GuildMemberSortKey>> = {
  member: 'name',
  level: 'level',
  today: 'today',
  days7: 'days7',
  days30: 'days30',
  lastActivity: 'lastActivity',
};

/** The page asked for by a link opened in a new tab: `?miembros=n`. */
function pageFromLocation(): number {
  if (typeof window === 'undefined') return 1;
  const page = Number(new URLSearchParams(window.location.search).get(PAGE_PARAM));
  return Number.isInteger(page) && page > 1 ? page : 1;
}

/** A calendar day of the history as the instant the formatters read in UTC. */
function calendarDay(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

/**
 * «Última actividad» (10.9): «hoy», «ayer», «hace N días (dd/mm)», «entre dd/mm y dd/mm» for an
 * export that covers more than one day, or «sin actividad registrada». The table and the PNG
 * write it the same way.
 */
export function formatGuildLastActivity(
  activity: GuildLastActivity | null,
  locale: Locale,
  text: Messages['guild']['members']['activity'],
): string {
  const dayMonth = (iso: string) => formatDayMonth(calendarDay(iso), locale, 'UTC');
  if (activity === null) return text.none;
  if (activity.from !== null) {
    return fill(text.between, { from: dayMonth(activity.from), to: dayMonth(activity.date) });
  }
  if (activity.daysAgo <= 0) return text.today;
  if (activity.daysAgo === 1) return text.yesterday;
  return fill(text.daysAgo, {
    n: formatInteger(activity.daysAgo, locale),
    date: dayMonth(activity.date),
  });
}

export function GuildMembers({
  locale,
  messages,
  ui,
  rows,
  inactivityDays,
  memberDetail,
  onExportCsv,
  onExportPng,
  onSaveSplit,
  onResetSplit,
  noMatch,
  id = 'miembros',
}: GuildMembersProps) {
  const text = messages.members;
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<GuildMembersFilter>('all');
  const [sort, setSort] = useState<DataTableSort>(DEFAULT_SORT);
  const [page, setPage] = useState(pageFromLocation);
  const [openKey, setOpenKey] = useState<string | null>(null);
  // The last member opened stays in the closed dialog, so its content does not vanish while
  // the focus goes back to the name.
  const [shownKey, setShownKey] = useState<string | null>(null);
  const [status, setStatus] = useState('');

  const number = (value: number) => formatInteger(value, locale);

  const inactiveCount = rows.reduce((count, row) => count + (row.inactive ? 1 : 0), 0);
  // One scale for every sparkline, from all the members, so filtering never rescales them.
  const sparkMax = useMemo(() => getGuildTrendMax(rows), [rows]);

  const searching = query.trim() !== '';
  const visible = useMemo(
    () =>
      sortGuildMemberRows(
        filterGuildMemberRows(rows, { query, inactiveOnly: filter === 'inactive' }),
        SORT_KEYS[sort.key] ?? 'days7',
        sort.dir === 'ascending' ? 'asc' : 'desc',
      ),
    [rows, filter, query, sort],
  );

  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const first = (current - 1) * PAGE_SIZE;
  const pageRows = visible.slice(first, first + PAGE_SIZE);

  function openMember(key: string) {
    if (memberDetail(key) === null) return;
    setShownKey(key);
    setOpenKey(key);
  }

  const columns: DataTableColumn[] = [
    {
      key: 'member',
      label: text.columns.member,
      width: 128,
      align: 'left',
      rowHeader: true,
      sortable: true,
      sortDir: 'ascending',
    },
    { key: 'rank', label: text.columns.rank, width: 124, nowrap: true },
    {
      key: 'level',
      label: text.columns.level,
      width: 88,
      numeric: true,
      sortable: true,
      sortDir: 'descending',
    },
    {
      key: 'today',
      label: text.columns.today,
      width: 80,
      numeric: true,
      sortable: true,
      sortDir: 'descending',
    },
    {
      key: 'days7',
      label: text.columns.days7,
      width: 92,
      numeric: true,
      sortable: true,
      sortDir: 'descending',
    },
    {
      key: 'days30',
      label: text.columns.days30,
      width: 100,
      numeric: true,
      sortable: true,
      sortDir: 'descending',
    },
    { key: 'trend', label: text.columns.trend, width: 170 },
    {
      key: 'lastActivity',
      label: text.columns.lastActivity,
      width: 160,
      align: 'left',
      headAlign: 'center',
      text: 'ui',
      nowrap: true,
      sortable: true,
      sortDir: 'descending',
      badge: true,
    },
  ];

  const tableRows: DataTableRow[] = pageRows.map((row) => ({
    key: row.key,
    tone: row.inactive ? 'inactive' : undefined,
    cells: {
      member: (
        <button
          type="button"
          className="ac-guild-members__name"
          onClick={() => openMember(row.key)}
        >
          {row.name}
        </button>
      ),
      rank: row.rank,
      level: row.level === null ? null : number(row.level),
      today: row.today === null ? null : number(row.today),
      days7: row.days7 === null ? null : number(row.days7),
      days30: row.days30 === null ? null : number(row.days30),
      trend: (
        <Sparkline
          values={row.trend}
          max={sparkMax}
          change={formatPercent(row.change, locale, { decimals: 1, signed: true })}
        />
      ),
      lastActivity: formatGuildLastActivity(row.lastActivity, locale, text.activity),
    },
  }));

  function onSort(key: string, dir: DataTableSortDir) {
    setSort({ key, dir });
    setPage(1);
  }

  function onPage(target: number, event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    setPage(target);
  }

  function exportPng() {
    setStatus('');
    // A failed export announces nothing here: the island reports its own error.
    void new Promise<void>((resolve) => resolve(onExportPng(visible, filter))).then(
      () => setStatus(text.imageDownloaded),
      () => undefined,
    );
  }

  const detail = shownKey === null ? null : memberDetail(shownKey);

  return (
    <Section id={id} title={text.title}>
      <div className="ac-guild-members__toolbar">
        <div className="ac-guild-members__filters">
          <TextField
            variant="filter"
            label={text.search}
            value={query}
            onChange={(value) => {
              setQuery(value);
              setPage(1);
            }}
            width={280}
            inputProps={{ autoComplete: 'off' }}
          />
          <ToggleGroup
            label={text.filter}
            value={filter}
            onChange={(next) => {
              if (next === 'all' || next === 'inactive') {
                setFilter(next);
                setPage(1);
              }
            }}
            options={[
              { value: 'all', label: fill(text.all, { n: number(rows.length) }) },
              { value: 'inactive', label: fill(text.inactive, { k: number(inactiveCount) }) },
            ]}
          />
        </div>
        <div className="ac-guild-members__exports">
          <p role="status" className="ac-guild-members__status">
            {status}
          </p>
          <Button disabled={visible.length === 0} onClick={exportPng}>
            {text.exportPng}
          </Button>
          <Button
            disabled={visible.length === 0}
            onClick={() => {
              setStatus('');
              onExportCsv(visible, filter);
            }}
          >
            {text.exportCsv}
          </Button>
        </div>
      </div>

      {visible.length === 0 ? (
        searching && noMatch ? (
          <p className="ac-guild-members__empty">{fill(noMatch, { q: query.trim() })}</p>
        ) : null
      ) : (
        <DataTable
          caption={filter === 'inactive' ? text.captionInactive : text.caption}
          columns={columns}
          rows={tableRows}
          sort={sort}
          onSort={onSort}
          rowHeight={48}
          scroll
          locale={locale}
          labels={{ inactive: ui.inactive }}
        />
      )}

      {filter === 'inactive' ? (
        <p className="ac-guild-members__help">
          {fill(text.inactiveHelp, { x: number(inactivityDays) })}
        </p>
      ) : null}

      <Pagination
        page={current}
        pageCount={pageCount}
        hrefFor={(n) => `?${PAGE_PARAM}=${n}#${id}`}
        onPage={onPage}
        summary={fill(text.count, {
          a: number(first + 1),
          b: number(first + pageRows.length),
          n: number(visible.length),
        })}
        labels={{ prev: ui.prev, next: ui.next, page: ui.page }}
        ariaLabel={ui.pagination}
      />

      {detail ? (
        <MemberDialog
          open={openKey !== null}
          onClose={() => setOpenKey(null)}
          locale={locale}
          member={detail}
          messages={messages.member}
          noExport={messages.days.noExport}
          ui={ui}
          onSaveSplit={
            onSaveSplit
              ? (date, allocation) => onSaveSplit(detail.key, date, allocation)
              : undefined
          }
          onResetSplit={onResetSplit ? (date) => onResetSplit(detail.key, date) : undefined}
        />
      ) : null}
    </Section>
  );
}
