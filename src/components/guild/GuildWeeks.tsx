import '@/styles/components/guild-summary.css';

import { DataTable } from '@/components/content/DataTable';
import type { DataTableColumn, DataTableRow } from '@/components/content/DataTable';
import { Section } from '@/components/layout/Section';
import type { Locale } from '@/i18n/config';
import type { Messages } from '@/i18n/messages/en';
import { fill } from '@/i18n/messages/types';
import { formatDateRange } from '@/lib/format/dates';
import { formatInteger, formatPercent } from '@/lib/format/numbers';

// «Por semana» of the Guild tool (spec 10.8, `Lienzo:Guild`): the comparison with the previous
// week up to yesterday, when it exists, and the `DataTable` of the five weeks that end in the
// week of today, oldest first.
//
// Presentational: the totals arrive computed by src/lib/tools/guild-analytics.ts (10.3) and
// this component only writes them. A week without snapshots has null figures and its cells
// show «—» (DataTable, 8.0.5); nothing here turns a missing week into 0.

export interface GuildWeekRow {
  /** Monday and Sunday of the week, ISO dates (`YYYY-MM-DD`). */
  start: string;
  end: string;
  /** Day k of 7 of today when this is the current week; null for a closed week. */
  currentDay: number | null;
  /** Days of the week with an export when some are missing; null when none is. */
  coveredDays: number | null;
  /** Σ of the week, or null when the week has no snapshot. */
  totals: { points: number; dailies: number; contribution: number } | null;
  /** Members with activity of the n of the last snapshot of the week. */
  active: { active: number; members: number } | null;
  /**
   * «Meta semanal»: members that met the prorated weekly goal in a closed week, members on
   * pace in the current one; null without a weekly goal of points.
   */
  goal: { kind: 'closed'; met: number; members: number } | { kind: 'pace'; onPace: number } | null;
  /** Σ max(0, levelDelta), or null without snapshots. */
  levelsGained: number | null;
}

export interface GuildWeeksComparison {
  /** D − 1, the last day both weeks are compared on (ISO date). */
  lastDay: string;
  /** `percent` in percent units (−5.3 for «−5,3 %»), null when the previous sum was 0. */
  points: { current: number; previous: number; percent: number | null };
  dailies: { current: number; previous: number };
  contribution: { current: number; previous: number };
}

export interface GuildWeeksData {
  /** Null when today is Monday or either week misses an export from Monday to yesterday. */
  comparison: GuildWeeksComparison | null;
  /** The five weeks, from the oldest to the current one. */
  rows: GuildWeekRow[];
}

export interface GuildWeeksProps {
  locale: Locale;
  messages: Messages['guild']['weeks'];
  data: GuildWeeksData;
}

/** A Server Save date written as the calendar day it names, whatever the zone of the reader. */
function isoDay(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

/** «jueves» / «Thursday»: the name of the day alone, lowercase in es as a sentence needs it. */
function weekdayName(date: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(isoDay(date));
}

function Comparison({
  comparison,
  locale,
  messages,
}: {
  comparison: GuildWeeksComparison;
  locale: Locale;
  messages: GuildWeeksProps['messages'];
}) {
  const vars = {
    day: weekdayName(comparison.lastDay, locale),
    q: formatInteger(comparison.points.previous, locale),
    delta: formatPercent(comparison.points.percent, locale, { decimals: 1, signed: true }),
    a: formatInteger(comparison.dailies.current, locale),
    b: formatInteger(comparison.dailies.previous, locale),
    c: formatInteger(comparison.contribution.current, locale),
    d: formatInteger(comparison.contribution.previous, locale),
  };
  // «{points}» is drawn in 700 (the board's <strong>), so the sentence is split around it.
  const [before = '', after = ''] = messages.comparison.split('{points}');
  return (
    <p className="ac-guild-weeks__comparison">
      {fill(before, vars)}
      <strong>
        {fill(messages.comparisonPoints, {
          p: formatInteger(comparison.points.current, locale),
        })}
      </strong>
      {fill(after, vars)}
    </p>
  );
}

export function GuildWeeks({ locale, messages, data }: GuildWeeksProps) {
  const columns: DataTableColumn[] = [
    { key: 'week', label: messages.columns.week, width: 200, align: 'left', headAlign: 'center' },
    { key: 'points', label: messages.columns.points, numeric: true },
    { key: 'dailies', label: messages.columns.dailies, numeric: true },
    { key: 'contribution', label: messages.columns.contribution, numeric: true },
    { key: 'active', label: messages.columns.active, numeric: true, nowrap: true },
    { key: 'goal', label: messages.columns.goal, numeric: true, nowrap: true },
    { key: 'levels', label: messages.columns.levels, numeric: true },
  ];

  const rows: DataTableRow[] = data.rows.map((week) => {
    const range = formatDateRange(isoDay(week.start), isoDay(week.end), locale, 'UTC');
    const sub =
      week.currentDay !== null
        ? fill(messages.current, { k: week.currentDay })
        : week.coveredDays !== null
          ? fill(messages.coverage, { c: week.coveredDays })
          : undefined;
    const goal =
      week.goal === null
        ? null
        : week.goal.kind === 'closed'
          ? fill(messages.ofMembers, {
              a: formatInteger(week.goal.met, locale),
              n: formatInteger(week.goal.members, locale),
            })
          : fill(messages.onPace, { m: formatInteger(week.goal.onPace, locale) });
    return {
      key: week.start,
      cells: {
        week: sub === undefined ? range : { value: range, sub },
        points: week.totals ? formatInteger(week.totals.points, locale) : null,
        dailies: week.totals ? formatInteger(week.totals.dailies, locale) : null,
        contribution: week.totals ? formatInteger(week.totals.contribution, locale) : null,
        active: week.active
          ? fill(messages.ofMembers, {
              a: formatInteger(week.active.active, locale),
              n: formatInteger(week.active.members, locale),
            })
          : null,
        goal,
        levels:
          week.levelsGained === null
            ? null
            : fill(messages.levels, { n: formatInteger(week.levelsGained, locale) }),
      },
    };
  });

  return (
    <Section id="por-semana" title={messages.title}>
      {data.comparison ? (
        <Comparison comparison={data.comparison} locale={locale} messages={messages} />
      ) : null}
      <DataTable caption={messages.caption} columns={columns} rows={rows} locale={locale} scroll />
    </Section>
  );
}
