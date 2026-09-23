// Guild administration analytics (spec §10.3, §10.6 to §10.12). Pure functions over the
// daily history of the current engine (guild-daily-history.ts), the goals and today's
// Server Save date `hoy`, which tests inject. The engine keeps its rules: one export per
// Server Save date, Monday-to-Sunday weeks that start at the 00:00 Server Save of
// America/Sao_Paulo, deltas against the previous export of the same week, dailies eligible
// from the day after a member joins and contribution from two days after. This module only
// aggregates those deltas by day, week, period and member.
//
// The interface formats what these functions return and computes nothing (§10.3). Every
// figure is a number and every date an ISO date (`YYYY-MM-DD`); a value the data does not
// have is null (G7), never 0. The shapes mirror the props of src/components/guild/*, so the
// island passes them through.
import { Temporal } from '@js-temporal/polyfill';

import { SERVER_SAVE_ZONE } from '@/lib/time/server-save';

import type {
  GuildDailyHistory,
  GuildDailyMemberDelta,
  GuildDailySummary,
  GuildDeltaStatus,
} from './guild-daily-history';
import type {
  GuildDifficultyAllocation,
  GuildDifficultyConfidence,
  GuildDifficultyTransition,
} from './guild-difficulty';
import {
  GUILD_WEEK_DAYS,
  formatGuildRank,
  getGuildGoalElapsedValue,
  getGuildGoalWeeklyValue,
  getGuildMemberBand,
  parseGuildExportedAt,
  type GuildGoalTarget,
  type GuildMemberBand,
  type GuildMemberGoalPacing,
  type GuildPacingSettings,
} from './guild-ranking';

// ---------------------------------------------------------------------------- dates

const DAY_MS = 86_400_000;

/** Days since 1970-01-01 of an ISO date. Plain arithmetic: the loops below run per member. */
function toDay(iso: string): number {
  return (
    Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) /
    DAY_MS
  );
}

function toIso(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  return toIso(toDay(iso) + days);
}

/** `end − start` in days. */
function daysBetween(start: string, end: string): number {
  return toDay(end) - toDay(start);
}

/** 1 for Monday to 7 for Sunday. 1970-01-01 was a Thursday. */
function dayOfWeek(iso: string): number {
  return ((((toDay(iso) + 3) % 7) + 7) % 7) + 1;
}

function mondayOf(iso: string): string {
  return addDays(iso, 1 - dayOfWeek(iso));
}

/** The days from `start` to `end`, both included, oldest first. */
function daysFrom(start: string, end: string): string[] {
  const count = daysBetween(start, end) + 1;
  return Array.from({ length: Math.max(0, count) }, (_, index) => addDays(start, index));
}

// ------------------------------------------------------------------------ settings

export type GuildMetric = 'points' | 'dailies' | 'contribution';

/** The sums of a set of deltas: points `P`, dailies `Δd` and contribution `Δc`. */
export type GuildFigures = Record<GuildMetric, number>;

/** «Días sin actividad para marcar inactivo» (§10.11): 1 to 30, 3 by default. */
export const DEFAULT_GUILD_INACTIVITY_DAYS = 3;
export const GUILD_INACTIVITY_DAYS_MIN = 1;
export const GUILD_INACTIVITY_DAYS_MAX = 30;

/** The inactivity threshold as stored: an integer from 1 to 30, or the default. */
export function normalizeGuildInactivityDays(value: unknown): number {
  return typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= GUILD_INACTIVITY_DAYS_MIN &&
    value <= GUILD_INACTIVITY_DAYS_MAX
    ? value
    : DEFAULT_GUILD_INACTIVITY_DAYS;
}

// --------------------------------------------------------------------------- today

/** D: the Server Save date of an instant, read on the clock of America/Sao_Paulo (§10.6). */
export function getGuildToday(now: Temporal.Instant): Temporal.PlainDate {
  return now.toZonedDateTimeISO(SERVER_SAVE_ZONE).toPlainDate();
}

/**
 * The first date account mode loads (§10.13): the Monday of the week of D − 34, so the
 * 30 days, the 14-day chart and the five weeks all have their exports and their bases.
 */
export function getGuildHistoryFrom(hoy: Temporal.PlainDate): string {
  return mondayOf(addDays(hoy.toString(), -34));
}

/** The week of a date: Monday, Sunday and the day k of 7 (§10.5, «Semana»). */
export type GuildWeekSpan = { start: string; end: string; day: number };

export function getGuildWeekOf(date: Temporal.PlainDate): GuildWeekSpan {
  const iso = date.toString();
  const start = mondayOf(iso);
  return { start, end: addDays(start, GUILD_WEEK_DAYS - 1), day: dayOfWeek(iso) };
}

// ---------------------------------------------------------------------------- cuts

/** One export of the history with the interval `I(s)` its deltas cover (§10.6). */
type Cut = {
  /** `o(s)`, the Server Save date of the export. */
  date: string;
  /** First day of `I(s)`: the day after the previous export of the week, or its Monday. */
  from: string;
  weekStart: string;
  /** First export of its week, whose deltas count from Monday. */
  isBase: boolean;
  summary: GuildDailySummary;
  members: Map<string, GuildDailyMemberDelta>;
};

type Analysis = {
  today: string;
  cuts: Cut[];
  byDate: Map<string, Cut>;
};

/** The exports dated on or before D, oldest first. A later one cannot be read yet. */
function analyse(history: GuildDailyHistory, hoy: Temporal.PlainDate): Analysis {
  const today = hoy.toString();
  const cuts: Cut[] = [];
  for (const week of history.weeks) {
    const summaries = [...week.summaries].sort((a, b) =>
      a.snapshot.observationDate.localeCompare(b.snapshot.observationDate),
    );
    summaries.forEach((summary, index) => {
      const previous = summaries[index - 1];
      cuts.push({
        date: summary.snapshot.observationDate,
        from: previous ? addDays(previous.snapshot.observationDate, 1) : week.weekStartDate,
        weekStart: week.weekStartDate,
        isBase: !previous,
        summary,
        members: new Map(summary.memberDeltas.map((delta) => [delta.memberKey, delta])),
      });
    });
  }
  const visible = cuts
    .filter((cut) => cut.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  return { today, cuts: visible, byDate: new Map(visible.map((cut) => [cut.date, cut])) };
}

function cutsIn(analysis: Analysis, start: string, end: string): Cut[] {
  return analysis.cuts.filter((cut) => cut.date >= start && cut.date <= end);
}

/** Days of `[start, end]` with an export dated on them. */
function coveredDays(analysis: Analysis, start: string, end: string): number {
  return cutsIn(analysis, start, end).length;
}

function figuresOf(cuts: readonly Cut[]): GuildFigures {
  return cuts.reduce<GuildFigures>(
    (total, cut) => ({
      points: total.points + cut.summary.dailyPoints,
      dailies: total.dailies + cut.summary.dailyDailies,
      contribution: total.contribution + cut.summary.dailyContribution,
    }),
    { points: 0, dailies: 0, contribution: 0 },
  );
}

/** `P` of a member in an export: points of their dailies plus their contribution. */
function memberPoints(delta: GuildDailyMemberDelta): number {
  return delta.dailyPoints + delta.dailyContribution;
}

function memberFigures(delta: GuildDailyMemberDelta): GuildFigures {
  return {
    points: memberPoints(delta),
    dailies: delta.dailyDailies,
    contribution: delta.dailyContribution,
  };
}

/** Activity is any daily or any contribution: `Δd + Δc > 0` (§10.6, §10.9). */
function isActive(delta: GuildDailyMemberDelta): boolean {
  return delta.dailyDailies + delta.dailyContribution > 0;
}

/**
 * Days of `I(s)` on which a member could do dailies, by the rule of the engine
 * (`eligibleDailyDays`): from the day after they joined or returned, and for a member
 * already there when tracking began, from their first export.
 */
function eligibleDailyDaysIn(delta: GuildDailyMemberDelta, cut: Cut): number {
  const eligibleFrom = delta.dailyEligibleDate ?? delta.firstObservedDate;
  const start = eligibleFrom > cut.from ? eligibleFrom : cut.from;
  return start > cut.date ? 0 : daysBetween(start, cut.date) + 1;
}

/** Per member of a goal set, the value of one day of that goal: `max(daily, weekly / 7)`. */
function dailyRate(target: GuildGoalTarget): number | null {
  return getGuildGoalElapsedValue(target, 1);
}

function percentChange(current: number, previous: number): number | null {
  return previous === 0 ? null : ((current - previous) / previous) * 100;
}

// -------------------------------------------------------------------------- head

/** The head row of the page (§10.5): members and date of the last export. */
export type GuildHead = {
  /** Members of the last export dated on or before D. */
  members: number;
  lastExport: {
    /** Server Save date of the last export. */
    date: string;
    /** Its `exportedAt` as an ISO instant, to show in Brasília time (A12); null without one. */
    exportedAt: string | null;
  };
  /** The week of D. */
  week: GuildWeekSpan;
};

/** Null while there is no export dated on or before D. */
export function getGuildHead(
  history: GuildDailyHistory,
  hoy: Temporal.PlainDate,
): GuildHead | null {
  const last = analyse(history, hoy).cuts.at(-1);
  if (!last) return null;
  const snapshot = last.summary.snapshot;
  return {
    members: last.summary.memberCount,
    lastExport: {
      date: last.date,
      exportedAt:
        parseGuildExportedAt(snapshot.payload.exportedAt, snapshot.sourceTimeZone)?.toString() ??
        null,
    },
    week: getGuildWeekOf(hoy),
  };
}

// ------------------------------------------------------------------------ periods

/** The `PeriodFilter` values (DS:PeriodFilter). */
export type GuildPeriod = 'hoy' | '7d' | '30d' | 'rango';

export type GuildPeriodSelection =
  | { period: Exclude<GuildPeriod, 'rango'> }
  | { period: 'rango'; from: Temporal.PlainDate; to: Temporal.PlainDate };

/** What a KPI is compared with: the previous period of the same length (§10.6). */
export type GuildComparisonBase =
  { kind: 'days7' } | { kind: 'days30' } | { kind: 'yesterday' } | { kind: 'days'; days: number };

export type GuildResolvedPeriod = {
  start: string;
  end: string;
  days: number;
  base: GuildComparisonBase;
};

/** «Rango» spans at most 366 days (§10.6). */
export const GUILD_RANGE_MAX_DAYS = 366;

/** The dates of a period. A «Rango» is one that `validateGuildRange` accepted. */
export function resolveGuildPeriod(
  selection: GuildPeriodSelection,
  hoy: Temporal.PlainDate,
): GuildResolvedPeriod {
  const end = hoy.toString();
  switch (selection.period) {
    case 'hoy':
      return { start: end, end, days: 1, base: { kind: 'yesterday' } };
    case '7d':
      return { start: addDays(end, -6), end, days: 7, base: { kind: 'days7' } };
    case '30d':
      return { start: addDays(end, -29), end, days: 30, base: { kind: 'days30' } };
    case 'rango': {
      const start = selection.from.toString();
      const last = selection.to.toString();
      const days = daysBetween(start, last) + 1;
      return { start, end: last, days, base: { kind: 'days', days } };
    }
  }
}

/** A «Desde» or «Hasta» as typed, dd/mm/aaaa; null when it is not a real date. */
export function parseGuildDate(text: string): Temporal.PlainDate | null {
  const match = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/.exec(text);
  if (!match) return null;
  try {
    return Temporal.PlainDate.from(
      { year: Number(match[3]), month: Number(match[2]), day: Number(match[1]) },
      { overflow: 'reject' },
    );
  } catch {
    return null;
  }
}

/** A date as the «Rango» fields show it: dd/mm/aaaa. */
export function formatGuildDateInput(date: Temporal.PlainDate): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.day)}/${pad(date.month)}/${String(date.year).padStart(4, '0')}`;
}

export type GuildRangeValidation =
  | { ok: true; from: Temporal.PlainDate; to: Temporal.PlainDate }
  | { ok: false; invalid: { from?: true; to?: true } };

/**
 * «Desde» and «Hasta» (§10.6): real dates, «Hasta» ≤ D, «Desde» ≤ «Hasta» and at most
 * 366 days. A rejected range names the fields to mark; the island keeps the previous period.
 */
export function validateGuildRange(
  fromText: string,
  toText: string,
  hoy: Temporal.PlainDate,
): GuildRangeValidation {
  const from = parseGuildDate(fromText);
  const to = parseGuildDate(toText);
  const invalid: { from?: true; to?: true } = {};
  if (!from) invalid.from = true;
  if (!to || Temporal.PlainDate.compare(to, hoy) > 0) invalid.to = true;
  if (from && to && !invalid.to) {
    if (Temporal.PlainDate.compare(from, to) > 0) invalid.from = true;
    else if (daysBetween(from.toString(), to.toString()) + 1 > GUILD_RANGE_MAX_DAYS) {
      invalid.from = true;
    }
  }
  return from && to && !invalid.from && !invalid.to
    ? { ok: true, from, to }
    : { ok: false, invalid };
}

// ------------------------------------------------------------------------ summary

/**
 * The comparison line of a KPI (§10.6, CA-10.4). `complete` when both periods have an
 * export on every day: the previous value, with its variation unless it was 0. Otherwise
 * how many of the `days` days of the previous period had an export.
 */
export type GuildKpiComparison =
  | { complete: true; previous: number; percent: number | null }
  | { complete: false; covered: number; days: number };

export type GuildSummaryFigures = {
  base: GuildComparisonBase;
  /** Members of the last export of the period with dailies or contribution in it. */
  active: {
    value: number;
    /** Members of the last export of the period. */
    of: number;
    /** Inactive members of §10.9 and the threshold they are counted with. */
    inactive: number;
    threshold: number;
  };
  /** `of` is null when the goal of dailies is empty: the «de» is omitted. */
  dailies: { value: number; of: number | null; comparison: GuildKpiComparison };
  contribution: { value: number; comparison: GuildKpiComparison };
  points: { value: number; comparison: GuildKpiComparison };
};

export type GuildSummaryData = {
  /** The four figures, or null when the period has no export. */
  figures: GuildSummaryFigures | null;
  /** Date of the last export on or before D, for «Sin exports en este periodo…». */
  lastExportDate: string | null;
};

/** «Resumen» (§10.6): the four KPI of a period and their comparison. */
export function getGuildSummary(
  history: GuildDailyHistory,
  settings: GuildPacingSettings,
  hoy: Temporal.PlainDate,
  selection: GuildPeriodSelection,
  inactivityDays: number = DEFAULT_GUILD_INACTIVITY_DAYS,
): GuildSummaryData {
  const analysis = analyse(history, hoy);
  const lastExportDate = analysis.cuts.at(-1)?.date ?? null;
  const period = resolveGuildPeriod(selection, hoy);
  const current = cutsIn(analysis, period.start, period.end);
  const last = current.at(-1);
  if (!last) return { figures: null, lastExportDate };

  const previousStart = addDays(period.start, -period.days);
  const previousEnd = addDays(period.start, -1);
  const previousFigures = figuresOf(cutsIn(analysis, previousStart, previousEnd));
  const previousCovered = coveredDays(analysis, previousStart, previousEnd);
  const complete = current.length === period.days && previousCovered === period.days;
  const comparison = (value: number, previous: number): GuildKpiComparison =>
    complete
      ? { complete: true, previous, percent: percentChange(value, previous) }
      : { complete: false, covered: previousCovered, days: period.days };

  const activeKeys = new Set<string>();
  let eligibleDays = 0;
  for (const cut of current) {
    for (const delta of cut.summary.memberDeltas) {
      if (isActive(delta)) activeKeys.add(delta.memberKey);
      eligibleDays += eligibleDailyDaysIn(delta, cut);
    }
  }
  const dailiesRate = dailyRate(settings.standard.dailies);
  const figures = figuresOf(current);
  const inactive = memberRows(analysis, settings, inactivityDays).filter(
    (row) => row.inactive,
  ).length;

  return {
    lastExportDate,
    figures: {
      base: period.base,
      active: {
        value: [...last.members.keys()].filter((key) => activeKeys.has(key)).length,
        of: last.summary.memberCount,
        inactive,
        threshold: inactivityDays,
      },
      dailies: {
        value: figures.dailies,
        of: dailiesRate === null ? null : Math.round(dailiesRate * eligibleDays),
        comparison: comparison(figures.dailies, previousFigures.dailies),
      },
      contribution: {
        value: figures.contribution,
        comparison: comparison(figures.contribution, previousFigures.contribution),
      },
      points: {
        value: figures.points,
        comparison: comparison(figures.points, previousFigures.points),
      },
    },
  };
}

// --------------------------------------------------------------------------- days

/** A day of the chart (§10.7). */
export type GuildDay = {
  date: string;
  /** Totals of the export dated that day; null when the day has no export (never a 0 bar). */
  figures: GuildFigures | null;
  /** Members of that export with `Δd + Δc > 0`, and its members. */
  active: { count: number; of: number } | null;
  /** First day of `I(s)` when the export covers more than one day, else null. */
  from: string | null;
  /** The export is the base of its week, so `from` is that Monday. */
  fromWeekStart: boolean;
};

/** The chart's days `[D − 13, D]`, oldest first (§10.7). */
export function getGuildDays(
  history: GuildDailyHistory,
  hoy: Temporal.PlainDate,
  count = 14,
): GuildDay[] {
  const analysis = analyse(history, hoy);
  return daysFrom(addDays(analysis.today, 1 - count), analysis.today).map((date) => {
    const cut = analysis.byDate.get(date);
    if (!cut) return { date, figures: null, active: null, from: null, fromWeekStart: false };
    const from = cut.from < cut.date ? cut.from : null;
    return {
      date,
      figures: figuresOf([cut]),
      active: {
        count: cut.summary.memberDeltas.filter(isActive).length,
        of: cut.summary.memberCount,
      },
      from,
      fromWeekStart: from !== null && cut.isBase,
    };
  });
}

/**
 * The daily goal line of each metric (§10.7), from the normal goals only: per member of the
 * last export, the weekly points goal / 7, the daily goal of dailies, and the contribution
 * goal when there is one. Null draws no line.
 */
export function getGuildDailyGoals(
  history: GuildDailyHistory,
  settings: GuildPacingSettings,
  hoy: Temporal.PlainDate,
): Record<GuildMetric, number | null> {
  const members = analyse(history, hoy).cuts.at(-1)?.summary.memberCount ?? 0;
  const line = (target: GuildGoalTarget): number | null => {
    const rate = dailyRate(target);
    const value = rate === null ? 0 : Math.round(members * rate);
    return value > 0 ? value : null;
  };
  return {
    points: line(settings.standard.totalPoints),
    dailies: line(settings.standard.dailies),
    contribution: line(settings.standard.contribution),
  };
}

/**
 * The axis of the chart (§10.7): the step is the smallest of {1, 2, 2.5, 5} × 10^k (2.5 only
 * from k = 1, so every step is an integer) with floor(value / step) + 1 ≤ 6 intervals, and
 * the top is (floor(value / step) + 1) × step. Returns every tick from 0 to the top.
 */
export function niceTicks(value: number): number[] {
  const top = Number.isFinite(value) && value > 0 ? value : 0;
  let step = 1;
  for (let exponent = 0; ; exponent += 1) {
    const scale = 10 ** exponent;
    const factors = exponent >= 1 ? [1, 2, 2.5, 5] : [1, 2, 5];
    const found = factors
      .map((factor) => factor * scale)
      .find((candidate) => {
        return Math.floor(top / candidate) + 1 <= 6;
      });
    if (found !== undefined) {
      step = found;
      break;
    }
  }
  const intervals = Math.floor(top / step) + 1;
  return Array.from({ length: intervals + 1 }, (_, index) => index * step);
}

export type GuildDaysScale = {
  /** From 0 to the top of the axis, `niceTicks(max(value, goal))`. */
  ticks: number[];
  /** Daily goal of the guild in this metric, or null: no line. */
  goal: number | null;
};

export function getGuildDayScales(
  days: readonly GuildDay[],
  goals: Record<GuildMetric, number | null>,
): Record<GuildMetric, GuildDaysScale> {
  const scale = (metric: GuildMetric): GuildDaysScale => {
    const peak = Math.max(0, ...days.map((day) => day.figures?.[metric] ?? 0));
    return { ticks: niceTicks(Math.max(peak, goals[metric] ?? 0)), goal: goals[metric] };
  };
  return {
    points: scale('points'),
    dailies: scale('dailies'),
    contribution: scale('contribution'),
  };
}

// -------------------------------------------------------------------------- weeks

export type GuildWeekRow = {
  /** Monday and Sunday of the week. */
  start: string;
  end: string;
  /** Day k of 7 of D when this is the current week; null for a closed week. */
  currentDay: number | null;
  /**
   * Days with an export when some are missing (of 7, or of the days elapsed in the current
   * week); null when none is.
   */
  coveredDays: number | null;
  /** Σ of the week, or null when it has no export. */
  totals: GuildFigures | null;
  /** Members of the last export of the week with activity in it, of its members. */
  active: { active: number; members: number } | null;
  /**
   * «Meta semanal»: members whose points reach the weekly points goal prorated by their
   * eligible days (`goalPacing`); «en ritmo» in the current week. Null without a weekly
   * goal of points or without exports.
   */
  goal: { kind: 'closed'; met: number; members: number } | { kind: 'pace'; onPace: number } | null;
  /** Σ max(0, levelDelta), or null without exports. */
  levelsGained: number | null;
};

export type GuildWeeksComparison = {
  /** D − 1: the two weeks are compared from Monday to this day. */
  lastDay: string;
  points: { current: number; previous: number; percent: number | null };
  dailies: { current: number; previous: number };
  contribution: { current: number; previous: number };
};

export type GuildWeeksData = {
  /** Null on Monday, or when either week misses an export from Monday to D − 1. */
  comparison: GuildWeeksComparison | null;
  /** The weeks ending with the week of D, oldest first. */
  rows: GuildWeekRow[];
};

/** A member's week so far: their sums and the goal pacing of the engine. */
type MemberWeek = {
  figures: GuildFigures;
  /** The member's delta in the last export of the week where they appear. */
  last: GuildDailyMemberDelta;
  lastCut: Cut;
  goalPacing: GuildMemberGoalPacing;
};

function memberWeek(cuts: readonly Cut[], key: string): MemberWeek | null {
  let result: MemberWeek | null = null;
  for (const cut of cuts) {
    const delta = cut.members.get(key);
    if (!delta) continue;
    const figures = memberFigures(delta);
    result = {
      figures: result
        ? {
            points: result.figures.points + figures.points,
            dailies: result.figures.dailies + figures.dailies,
            contribution: result.figures.contribution + figures.contribution,
          }
        : figures,
      last: delta,
      lastCut: cut,
      goalPacing: {
        totalPoints: delta.eligibleDailyDays,
        dailies: delta.eligibleDailyDays,
        contribution: delta.eligibleContributionDays,
      },
    };
  }
  return result;
}

/** «Por semana» (§10.8): the weeks ending with the week of D and the same-days comparison. */
export function getGuildWeeks(
  history: GuildDailyHistory,
  settings: GuildPacingSettings,
  hoy: Temporal.PlainDate,
  count = 5,
): GuildWeeksData {
  const analysis = analyse(history, hoy);
  const today = analysis.today;
  const currentMonday = mondayOf(today);
  const weeklyGoal = getGuildGoalWeeklyValue(settings.standard.totalPoints);

  const rows = Array.from({ length: count }, (_, index): GuildWeekRow => {
    const start = addDays(currentMonday, -GUILD_WEEK_DAYS * (count - 1 - index));
    const end = addDays(start, GUILD_WEEK_DAYS - 1);
    const current = start === currentMonday;
    const cuts = cutsIn(analysis, start, current ? today : end);
    const expectedDays = current ? dayOfWeek(today) : GUILD_WEEK_DAYS;
    const last = cuts.at(-1);
    const row: GuildWeekRow = {
      start,
      end,
      currentDay: current ? dayOfWeek(today) : null,
      coveredDays: cuts.length < expectedDays ? cuts.length : null,
      totals: null,
      active: null,
      goal: null,
      levelsGained: null,
    };
    if (!last) return row;

    const weeks = [...last.members.keys()].map((key) => memberWeek(cuts, key));
    let active = 0;
    let met = 0;
    for (const week of weeks) {
      if (!week) continue;
      if (week.figures.dailies + week.figures.contribution > 0) active += 1;
      const expected = getGuildGoalElapsedValue(
        settings.standard.totalPoints,
        week.goalPacing.totalPoints ?? 0,
      );
      if (expected !== null && week.figures.points >= expected) met += 1;
    }
    const members = last.summary.memberCount;
    return {
      ...row,
      totals: figuresOf(cuts),
      active: { active, members },
      goal:
        weeklyGoal === null
          ? null
          : current
            ? { kind: 'pace', onPace: met }
            : { kind: 'closed', met, members },
      levelsGained: cuts.reduce((total, cut) => total + cut.summary.levelsGained, 0),
    };
  });

  return { comparison: weekComparison(analysis, currentMonday), rows };
}

function weekComparison(analysis: Analysis, monday: string): GuildWeeksComparison | null {
  const lastDay = addDays(analysis.today, -1);
  if (lastDay < monday) return null;
  const days = daysBetween(monday, lastDay) + 1;
  const previousMonday = addDays(monday, -GUILD_WEEK_DAYS);
  const previousLastDay = addDays(lastDay, -GUILD_WEEK_DAYS);
  const current = cutsIn(analysis, monday, lastDay);
  const previous = cutsIn(analysis, previousMonday, previousLastDay);
  if (current.length < days || previous.length < days) return null;
  const now = figuresOf(current);
  const before = figuresOf(previous);
  return {
    lastDay,
    points: {
      current: now.points,
      previous: before.points,
      percent: percentChange(now.points, before.points),
    },
    dailies: { current: now.dailies, previous: before.dailies },
    contribution: { current: now.contribution, previous: before.contribution },
  };
}

// ------------------------------------------------------------------------ members

/** «Última actividad» (§10.9): the latest export where the member had `Δd + Δc > 0`. */
export type GuildLastActivity = {
  /** `o(s)` of that export. */
  date: string;
  /** First day of `I(s)` when that export covers more than one day: «entre {from} y {date}». */
  from: string | null;
  /** D − date: 0 is «hoy», 1 «ayer», N «hace N días». */
  daysAgo: number;
};

/** The dailies of one export that the member dialog can split by difficulty (§10.9). */
export type GuildMemberSplit = {
  /** Server Save date of the export. */
  date: string;
  /** Key of the engine's `difficultyOverrides` for this export and member. */
  overrideKey: string;
  dailies: number;
  allocation: GuildDifficultyAllocation;
  confidence: GuildDifficultyConfidence;
  transition: GuildDifficultyTransition | null;
};

/** The member's week of D, as the member dialog, the table and the PNG read it. */
export type GuildMemberWeek = {
  start: string;
  end: string;
  figures: GuildFigures;
  /** Weekly points goal of the normal goals, or null. */
  goal: number | null;
  /** That goal prorated to the member's eligible days so far, or null. */
  expected: number | null;
  /** Eligible days per metric, from the engine (the day after joining, two days after). */
  goalPacing: GuildMemberGoalPacing;
  /** The goal band, evaluated with `goalPacing` (CA-10.8). */
  band: GuildMemberBand;
  /**
   * The member could play fewer days of the week than it has run (they joined or came back
   * after its Monday), so `expected` is prorated to their days: the dialog says so (§10.9).
   */
  prorated: boolean;
  /** The latest export of the week whose dailies were split by estimate or by hand. */
  split: GuildMemberSplit | null;
};

export type GuildMemberRow = {
  /** Normalized name: the engine's member key, also what «Buscar miembro» matches. */
  key: string;
  name: string;
  /** The rank as the game client names it (E13): Leader, Vice-Leader or Member. */
  rank: string | null;
  level: number | null;
  lastLogin: string | null;
  /** `P` of the export of D, or null without an export of D. */
  today: number | null;
  /** Σ `P` in `[D − 6, D]`; null when no export falls in it. */
  days7: number | null;
  /** Σ `P` in `[D − 29, D]`; null when no export falls in it. */
  days30: number | null;
  /** `P` of each day `[D − 13, D]`, oldest first; null without an export or without the member. */
  trend: (number | null)[];
  /**
   * (Σ7 − Σ7 before) / Σ7 before, in percent. Null when the 7 days before miss an export
   * or add up to 0.
   */
  change: number | null;
  lastActivity: GuildLastActivity | null;
  /** Days since the last activity, or since the member first appeared without one. */
  idleDays: number;
  inactive: boolean;
  /** The week of D; null when the member has no export in it yet. */
  week: GuildMemberWeek | null;
};

/** The key the engine gives a member: trimmed, without diacritics, lowercase. */
export function normalizeGuildMemberName(value: string): string {
  return value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase();
}

/** The key of `difficultyOverrides` in the engine (guild-daily-history.ts). */
export function getGuildDifficultyOverrideKey(date: string, memberKey: string): string {
  return `${date}:${memberKey}`;
}

function sumPoints(cuts: readonly Cut[], key: string): number {
  return cuts.reduce((total, cut) => {
    const delta = cut.members.get(key);
    return total + (delta ? memberPoints(delta) : 0);
  }, 0);
}

function memberRows(
  analysis: Analysis,
  settings: GuildPacingSettings,
  inactivityDays: number,
): GuildMemberRow[] {
  const last = analysis.cuts.at(-1);
  if (!last) return [];
  const today = analysis.today;
  const threshold = normalizeGuildInactivityDays(inactivityDays);
  const window7 = cutsIn(analysis, addDays(today, -6), today);
  const window30 = cutsIn(analysis, addDays(today, -29), today);
  const before7Start = addDays(today, -13);
  const before7End = addDays(today, -7);
  const before7 = cutsIn(analysis, before7Start, before7End);
  const before7Complete = before7.length === GUILD_WEEK_DAYS;
  const trendDays = daysFrom(before7Start, today);
  const todayCut = analysis.byDate.get(today);
  const monday = mondayOf(today);
  const weekCuts = cutsIn(analysis, monday, today);
  const weeklyGoal = getGuildGoalWeeklyValue(settings.standard.totalPoints);

  return last.summary.memberDeltas.map((latest): GuildMemberRow => {
    const key = latest.memberKey;
    const todayDelta = todayCut?.members.get(key);
    const days7 = window7.length ? sumPoints(window7, key) : null;
    const previous7 = sumPoints(before7, key);

    let lastActivity: GuildLastActivity | null = null;
    for (let index = analysis.cuts.length - 1; index >= 0 && !lastActivity; index -= 1) {
      const cut = analysis.cuts[index];
      const delta = cut.members.get(key);
      if (delta && isActive(delta)) {
        lastActivity = {
          date: cut.date,
          from: cut.from < cut.date ? cut.from : null,
          daysAgo: daysBetween(cut.date, today),
        };
      }
    }
    const idleDays = lastActivity?.daysAgo ?? daysBetween(latest.firstObservedDate, today);
    // A member who joined or came back less than X days ago is not inactive yet (§10.9).
    const inactive =
      idleDays >= threshold && daysBetween(latest.membershipObservedDate, today) >= threshold;

    return {
      key,
      name: latest.displayName,
      rank: latest.rank?.trim() ? formatGuildRank(latest.rank) : null,
      level: latest.level,
      lastLogin: latest.lastLogin,
      today: todayDelta ? memberPoints(todayDelta) : null,
      days7,
      days30: window30.length ? sumPoints(window30, key) : null,
      trend: trendDays.map((date) => {
        const delta = analysis.byDate.get(date)?.members.get(key);
        return delta ? memberPoints(delta) : null;
      }),
      change:
        before7Complete && previous7 > 0 && days7 !== null ? percentChange(days7, previous7) : null,
      lastActivity,
      idleDays,
      inactive,
      week: memberWeekOfD(weekCuts, key, settings, weeklyGoal, monday),
    };
  });
}

function memberWeekOfD(
  cuts: readonly Cut[],
  key: string,
  settings: GuildPacingSettings,
  weeklyGoal: number | null,
  monday: string,
): GuildMemberWeek | null {
  const week = memberWeek(cuts, key);
  if (!week) return null;
  const { figures, goalPacing, lastCut } = week;
  const elapsedDays = lastCut.summary.snapshot.dayIndex;
  const band = getGuildMemberBand(
    {
      total: figures.points,
      dailiesCompleted: figures.dailies,
      contribution: figures.contribution,
      goalPacing,
    },
    { settings, week: { elapsedDays } },
    goalPacing,
  );

  let split: GuildMemberSplit | null = null;
  for (const cut of cuts) {
    const delta = cut.members.get(key);
    if (
      delta &&
      delta.dailyDailies > 0 &&
      (delta.difficultyTransition !== null || delta.difficultyConfidence === 'manual')
    ) {
      split = {
        date: cut.date,
        overrideKey: getGuildDifficultyOverrideKey(cut.date, key),
        dailies: delta.dailyDailies,
        allocation: delta.difficultyAllocation,
        confidence: delta.difficultyConfidence,
        transition: delta.difficultyTransition,
      };
    }
  }

  return {
    start: monday,
    end: addDays(monday, GUILD_WEEK_DAYS - 1),
    figures,
    goal: weeklyGoal,
    expected: getGuildGoalElapsedValue(settings.standard.totalPoints, goalPacing.totalPoints ?? 0),
    goalPacing,
    band,
    prorated: (goalPacing.totalPoints ?? 0) < elapsedDays,
    split,
  };
}

/**
 * «Miembros» (§10.9): one row per member of the last export on or before D, in the order of
 * that export. Sort and filter them with `sortGuildMemberRows` and `filterGuildMemberRows`.
 */
export function getGuildMembers(
  history: GuildDailyHistory,
  settings: GuildPacingSettings,
  hoy: Temporal.PlainDate,
  inactivityDays: number = DEFAULT_GUILD_INACTIVITY_DAYS,
): GuildMemberRow[] {
  return memberRows(analyse(history, hoy), settings, inactivityDays);
}

export type GuildMemberSortKey = 'name' | 'level' | 'today' | 'days7' | 'days30' | 'lastActivity';

export type GuildSortDirection = 'asc' | 'desc';

/** The order of each column (§10.9); «7 días» is the default. */
export const GUILD_MEMBER_SORT_DIRECTION: Record<GuildMemberSortKey, GuildSortDirection> = {
  name: 'asc',
  level: 'desc',
  today: 'desc',
  days7: 'desc',
  days30: 'desc',
  // «Más inactivos primero»: the most idle days first.
  lastActivity: 'desc',
};

export const DEFAULT_GUILD_MEMBER_SORT: GuildMemberSortKey = 'days7';

const nameCollator = new Intl.Collator('es', { sensitivity: 'base', numeric: true });

function sortValue(row: GuildMemberRow, key: Exclude<GuildMemberSortKey, 'name'>): number | null {
  return key === 'lastActivity' ? row.idleDays : row[key];
}

/** The rows in a column's order. Unknown values go last in either direction; ties by name. */
export function sortGuildMemberRows(
  rows: readonly GuildMemberRow[],
  key: GuildMemberSortKey = DEFAULT_GUILD_MEMBER_SORT,
  direction: GuildSortDirection = GUILD_MEMBER_SORT_DIRECTION[key],
): GuildMemberRow[] {
  const factor = direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const byName = nameCollator.compare(a.name, b.name);
    if (key === 'name') return factor * byName || a.key.localeCompare(b.key);
    const left = sortValue(a, key);
    const right = sortValue(b, key);
    if (left === null || right === null) {
      return left === right ? byName : left === null ? 1 : -1;
    }
    return factor * (left - right) || byName;
  });
}

/** «Buscar miembro» on the normalized name, and the «Inactivos» filter (§10.9). */
export function filterGuildMemberRows(
  rows: readonly GuildMemberRow[],
  filter: { query?: string; inactiveOnly?: boolean } = {},
): GuildMemberRow[] {
  const needle = normalizeGuildMemberName(filter.query ?? '');
  return rows.filter(
    (row) => (!filter.inactiveOnly || row.inactive) && (!needle || row.key.includes(needle)),
  );
}

/** The value that fills a sparkline, shared by every row of the table and by the PNG. */
export function getGuildTrendMax(rows: readonly GuildMemberRow[]): number {
  return Math.max(1, ...rows.flatMap((row) => row.trend.map((value) => value ?? 0)));
}

/** A day of «Últimos 14 días» in the member dialog (§10.9). */
export type GuildMemberDay = {
  date: string;
  /** The guild has an export dated that day. */
  exported: boolean;
  /** The member's deltas in it; null without an export or when the member was not in it. */
  figures: GuildFigures | null;
  /** First day of `I(s)` when that export covers more than one day. */
  from: string | null;
  /** «Primer corte de la semana» (`baseline`), «Total menor que el anterior» (`decrease_detected`). */
  status: GuildDeltaStatus | null;
};

export function getGuildMemberDays(
  history: GuildDailyHistory,
  hoy: Temporal.PlainDate,
  memberKey: string,
  count = 14,
): GuildMemberDay[] {
  const analysis = analyse(history, hoy);
  return daysFrom(addDays(analysis.today, 1 - count), analysis.today).map((date) => {
    const cut = analysis.byDate.get(date);
    const delta = cut?.members.get(memberKey);
    return {
      date,
      exported: Boolean(cut),
      figures: delta ? memberFigures(delta) : null,
      from: cut && cut.from < cut.date ? cut.from : null,
      status: delta?.statusKind ?? null,
    };
  });
}

// ------------------------------------------------------------------------ exports

/**
 * The goals the PNG writes under its head (§12.14, G-50), per member: «Meta hoy» (the normal
 * points goal elapsed to D's day of the week), «Dailies» (the same for dailies) and «Meta
 * premium» (the weekly premium points goal). Null when that goal is empty.
 */
export function getGuildImageGoals(
  settings: GuildPacingSettings,
  hoy: Temporal.PlainDate,
): { todayPoints: number | null; dailies: number | null; premiumPoints: number | null } {
  const day = dayOfWeek(hoy.toString());
  return {
    todayPoints: getGuildGoalElapsedValue(settings.standard.totalPoints, day),
    dailies: getGuildGoalElapsedValue(settings.standard.dailies, day),
    premiumPoints: getGuildGoalWeeklyValue(settings.premium.totalPoints),
  };
}

/** `guild-{slug}-{AAAA-MM-DD}.{csv|png}` (§10.12). */
export function getGuildExportFileName(
  guild: string | null | undefined,
  date: string,
  extension: 'csv' | 'png',
): string {
  const slug = normalizeGuildMemberName(guild ?? '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug ? `guild-${slug}-${date}.${extension}` : `guild-${date}.${extension}`;
}

/** The byte order mark that tells a spreadsheet the CSV is UTF-8 (U+FEFF). */
const BOM = String.fromCharCode(0xfeff);

/** The CSV texts that change with the language: its header and «sí»/«no» (§10.12). */
export type GuildCsvLabels = { header: string; yes: string; no: string };

/** RFC 4180: a field with a comma, a quote or a line break goes between quotes. */
function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * A name or a rank from the export. A spreadsheet would run a text that starts with
 * = + - @ or a control character as a formula, so it gets a leading apostrophe.
 */
function csvText(value: string | null): string {
  if (!value) return '';
  return csvField(/^[=+\-@\t\r]/.test(value) ? `'${value}` : value);
}

function csvNumber(value: number | null): string {
  return value === null ? '' : String(Math.round(value));
}

/** One decimal, a point and the sign: «-13.3», «+8.2», «0.0». */
function csvChange(value: number | null): string {
  if (value === null) return '';
  const rounded = Math.round(value * 10) / 10;
  if (rounded === 0) return '0.0';
  return `${rounded > 0 ? '+' : '-'}${Math.abs(rounded).toFixed(1)}`;
}

/**
 * «Exportar CSV» (§10.12): the rows as given (the current filter and order, every page),
 * UTF-8 with BOM, comma, CRLF. Figures ungrouped, dates ISO, unknown values empty.
 */
export function buildGuildMembersCsv(
  rows: readonly GuildMemberRow[],
  labels: GuildCsvLabels,
): string {
  const lines = rows.map((row) =>
    [
      csvText(row.name),
      csvText(row.rank),
      csvNumber(row.level),
      csvNumber(row.today),
      csvNumber(row.days7),
      csvNumber(row.days30),
      csvChange(row.change),
      row.lastActivity?.date ?? '',
      row.inactive ? labels.yes : labels.no,
    ].join(','),
  );
  return `${BOM}${[labels.header, ...lines].join('\r\n')}\r\n`;
}
