import { Temporal } from '@js-temporal/polyfill';
import { describe, expect, it } from 'vitest';

import {
  buildGuildMembersCsv,
  filterGuildMemberRows,
  getGuildDailyGoals,
  getGuildDayScales,
  getGuildDays,
  getGuildExportFileName,
  getGuildHead,
  getGuildHistoryFrom,
  getGuildImageGoals,
  getGuildMemberDays,
  getGuildMembers,
  getGuildSummary,
  getGuildToday,
  getGuildTrendMax,
  getGuildWeeks,
  niceTicks,
  normalizeGuildInactivityDays,
  sortGuildMemberRows,
  validateGuildRange,
  type GuildMemberRow,
} from '@/lib/tools/guild-analytics';
import {
  calculateGuildDailyHistory,
  createGuildDailySnapshot,
} from '@/lib/tools/guild-daily-history';
import {
  DEFAULT_GUILD_PACING,
  getGuildMemberBand,
  type GuildExportPayload,
} from '@/lib/tools/guild-ranking';

// A synthetic history of 35 days (CA-10.2), from Wednesday 2026-08-19, when tracking
// begins mid-week, to Tuesday 2026-09-22, which is D. Friday 2026-09-11 has no export.
// Each export is taken at 23:00 Brasília time and carries the week's running totals, as
// the game client does. Per day:
//   Aria  (the Leader, level 360, primal 600): 1 daily, contribution 100; 150 from 09-14.
//   Brisa (a Vice-Leader): 1 daily and 50 of contribution; level 149 (normal, 150) up to
//         09-18 and 150 (wildscape, 300) from 09-19: she crosses a tier.
//   Ciro  (a Member, level 100, normal 150): 1 daily and 20 up to 09-19, then nothing.
//   Nova  (a Member, level 360): joins on Wednesday 09-16 with nothing done; 1 daily from
//         09-17 and 30 of contribution from 09-18, the days the engine opens to her.
// So a day is worth P = 700 (Aria) + 200 (Brisa) + 170 (Ciro) = 1.070 up to 09-13; Aria is
// worth 750 from 09-14, Nova 600 on 09-17 and 630 from 09-18, Brisa 350 from 09-19 and
// Ciro 0 from 09-20. The export of 09-12 covers 09-11 and 09-12: 2 × 1.070 = 2.140.

type Day = { level: number; dailies: number; contribution: number };
type Plan = { name: string; rank: string; joined?: string; day: (date: string) => Day };

const PLANS: Plan[] = [
  {
    name: 'Aria',
    rank: 'the Leader',
    day: (date) => ({ level: 360, dailies: 1, contribution: date >= '2026-09-14' ? 150 : 100 }),
  },
  {
    name: 'Brisa',
    rank: 'a Vice-Leader',
    day: (date) => ({ level: date >= '2026-09-19' ? 150 : 149, dailies: 1, contribution: 50 }),
  },
  {
    name: 'Ciro',
    rank: 'a Member',
    day: (date) =>
      date <= '2026-09-19'
        ? { level: 100, dailies: 1, contribution: 20 }
        : { level: 100, dailies: 0, contribution: 0 },
  },
  {
    name: 'Nova',
    rank: 'a Member',
    joined: '2026-09-16',
    day: (date) => ({
      level: 360,
      dailies: date >= '2026-09-17' ? 1 : 0,
      contribution: date >= '2026-09-18' ? 30 : 0,
    }),
  },
];

const FIRST_DAY = '2026-08-19';
const D = Temporal.PlainDate.from('2026-09-22');
const MISSING = '2026-09-11';

function exportOf(date: string): GuildExportPayload {
  const day = Temporal.PlainDate.from(date);
  const monday = day.subtract({ days: day.dayOfWeek - 1 });
  const members = PLANS.filter((plan) => !plan.joined || plan.joined <= date).map((plan) => {
    let dailies = 0;
    let contribution = 0;
    for (let cursor = monday; Temporal.PlainDate.compare(cursor, day) <= 0;) {
      const iso = cursor.toString();
      if (!plan.joined || iso >= plan.joined) {
        dailies += plan.day(iso).dailies;
        contribution += plan.day(iso).contribution;
      }
      cursor = cursor.add({ days: 1 });
    }
    return {
      name: plan.name,
      rank: plan.rank,
      level: plan.day(date).level,
      dailiesCompleted: dailies,
      contribution,
      status: 'offline',
      lastLogin: `${date} 22:00:00`,
    };
  });
  return { exportedAt: `${date} 23:00:00`, guild: 'Alba', members };
}

const dates: string[] = [];
for (
  let cursor = Temporal.PlainDate.from(FIRST_DAY);
  Temporal.PlainDate.compare(cursor, D) <= 0;
  cursor = cursor.add({ days: 1 })
) {
  if (cursor.toString() !== MISSING) dates.push(cursor.toString());
}

const history = calculateGuildDailyHistory(
  dates.map((date) => createGuildDailySnapshot(`cut-${date}`, exportOf(date))),
);
const settings = DEFAULT_GUILD_PACING;
const at = (date: string) => Temporal.PlainDate.from(date);
const names = (rows: readonly GuildMemberRow[]) => rows.map((row) => row.name);

describe('guild analytics: the synthetic history', () => {
  it('covers 35 days with one day without export', () => {
    expect(dates).toHaveLength(34);
    expect(Temporal.PlainDate.from(FIRST_DAY).until(D).days + 1).toBe(35);
    expect(Temporal.PlainDate.from(FIRST_DAY).dayOfWeek).toBe(3);
  });
});

describe('guild analytics: today and the head row', () => {
  it('reads D on the Server Save clock of Brasília', () => {
    expect(getGuildToday(Temporal.Instant.from('2026-09-23T02:30:00Z')).toString()).toBe(
      '2026-09-22',
    );
    expect(getGuildToday(Temporal.Instant.from('2026-09-23T03:00:00Z')).toString()).toBe(
      '2026-09-23',
    );
  });

  it('gives the members and the last export of the head row', () => {
    expect(getGuildHead(history, D)).toEqual({
      members: 4,
      lastExport: { date: '2026-09-22', exportedAt: '2026-09-23T02:00:00Z' },
      week: { start: '2026-09-21', end: '2026-09-27', day: 2 },
    });
    expect(getGuildHead(history, at('2026-08-18'))).toBeNull();
  });

  it('loads account mode from the Monday of the week of D − 34', () => {
    // D − 34 is Wednesday 2026-08-19; its Monday is 08-17.
    expect(getGuildHistoryFrom(D)).toBe('2026-08-17');
  });
});

describe('guild analytics: Resumen (§10.6)', () => {
  it('sums the 7 days and compares them only with a complete previous period', () => {
    // [09-16, 09-22]: P = 1.120 + 1.720 + 1.750 + 1.900 + 1.730 × 3 = 11.680; dailies
    // 3 + 4 + 4 + 4 + 3 + 3 + 3 = 24; contribution 220 + 220 + 250 + 250 + 230 × 3 = 1.630.
    // «de»: every member eligible on every day (4 × 7 = 28) except Nova on 09-16 = 27.
    // The 7 days before, [09-09, 09-15], miss 09-11: 6 of 7 days with export.
    const incomplete = { complete: false, covered: 6, days: 7 };
    expect(getGuildSummary(history, settings, D, { period: '7d' })).toEqual({
      lastExportDate: '2026-09-22',
      figures: {
        base: { kind: 'days7' },
        active: { value: 4, of: 4, inactive: 1, threshold: 3 },
        dailies: { value: 24, of: 27, comparison: incomplete },
        contribution: { value: 1630, comparison: incomplete },
        points: { value: 11680, comparison: incomplete },
      },
    });
  });

  it('gives the variation when both periods have every export', () => {
    const range = validateGuildRange('19/09/2026', '20/09/2026', D);
    expect(range.ok).toBe(true);
    if (!range.ok) return;
    const summary = getGuildSummary(history, settings, D, { period: 'rango', ...range });
    // [09-19, 09-20]: 1.900 + 1.730 = 3.630 against [09-17, 09-18]: 1.720 + 1.750 = 3.470.
    expect(summary.figures?.base).toEqual({ kind: 'days', days: 2 });
    expect(summary.figures?.active).toEqual({ value: 4, of: 4, inactive: 1, threshold: 3 });
    expect(summary.figures?.points.value).toBe(3630);
    expect(summary.figures?.points.comparison).toMatchObject({ complete: true, previous: 3470 });
    const points = summary.figures?.points.comparison;
    expect(points?.complete && points.percent).toBeCloseTo((160 / 3470) * 100, 6);
    // Dailies 4 + 3 = 7 against 4 + 4 = 8, −12,5%; contribution 250 + 230 = 480 against 470.
    expect(summary.figures?.dailies).toEqual({
      value: 7,
      of: 8,
      comparison: { complete: true, previous: 8, percent: -12.5 },
    });
    const contribution = summary.figures?.contribution.comparison;
    expect(contribution?.complete && contribution.previous).toBe(470);
    expect(contribution?.complete && contribution.percent).toBeCloseTo((10 / 470) * 100, 6);
  });

  it('compares «Hoy» with yesterday', () => {
    const summary = getGuildSummary(history, settings, D, { period: 'hoy' });
    expect(summary.figures).toEqual({
      base: { kind: 'yesterday' },
      active: { value: 3, of: 4, inactive: 1, threshold: 3 },
      dailies: { value: 3, of: 4, comparison: { complete: true, previous: 3, percent: 0 } },
      contribution: { value: 230, comparison: { complete: true, previous: 230, percent: 0 } },
      points: { value: 1730, comparison: { complete: true, previous: 1730, percent: 0 } },
    });
  });

  it('has no figures for a period without exports', () => {
    const range = validateGuildRange('01/08/2026', '10/08/2026', D);
    expect(range.ok).toBe(true);
    if (!range.ok) return;
    expect(getGuildSummary(history, settings, D, { period: 'rango', ...range })).toEqual({
      figures: null,
      lastExportDate: '2026-09-22',
    });
  });

  it('validates «Desde» and «Hasta»', () => {
    expect(validateGuildRange('20/09/2026', '19/09/2026', D)).toEqual({
      ok: false,
      invalid: { from: true },
    });
    expect(validateGuildRange('19/09/2026', '23/09/2026', D)).toEqual({
      ok: false,
      invalid: { to: true },
    });
    // 2025-09-21 to 2026-09-22 is 367 days.
    expect(validateGuildRange('21/09/2025', '22/09/2026', D)).toEqual({
      ok: false,
      invalid: { from: true },
    });
    expect(validateGuildRange('22/09/2025', '22/09/2026', D).ok).toBe(true);
    expect(validateGuildRange('31/02/2026', 'mañana', D)).toEqual({
      ok: false,
      invalid: { from: true, to: true },
    });
  });
});

describe('guild analytics: Por día (§10.7)', () => {
  it('draws the 14 days with the day without export as null and the next with «Desde»', () => {
    const days = getGuildDays(history, D);
    expect(
      days.map((day) => [
        day.date,
        day.figures?.points ?? null,
        day.figures?.dailies ?? null,
        day.figures?.contribution ?? null,
        day.active ? `${day.active.count}/${day.active.of}` : null,
        day.from,
      ]),
    ).toEqual([
      ['2026-09-09', 1070, 3, 170, '3/3', null],
      ['2026-09-10', 1070, 3, 170, '3/3', null],
      ['2026-09-11', null, null, null, null, null],
      ['2026-09-12', 2140, 6, 340, '3/3', '2026-09-11'],
      ['2026-09-13', 1070, 3, 170, '3/3', null],
      ['2026-09-14', 1120, 3, 220, '3/3', null],
      ['2026-09-15', 1120, 3, 220, '3/3', null],
      ['2026-09-16', 1120, 3, 220, '3/4', null],
      ['2026-09-17', 1720, 4, 220, '4/4', null],
      ['2026-09-18', 1750, 4, 250, '4/4', null],
      ['2026-09-19', 1900, 4, 250, '4/4', null],
      ['2026-09-20', 1730, 3, 230, '3/4', null],
      ['2026-09-21', 1730, 3, 230, '3/4', null],
      ['2026-09-22', 1730, 3, 230, '3/4', null],
    ]);
    expect(days.some((day) => day.fromWeekStart)).toBe(false);
  });

  it('marks the base of a week that starts on Wednesday with «Desde: lunes»', () => {
    const day = getGuildDays(history, at('2026-08-25')).find((item) => item.date === FIRST_DAY);
    // Monday to Wednesday of the first week: 3 × (700 + 200 + 170) = 3.210.
    expect(day).toEqual({
      date: FIRST_DAY,
      figures: { points: 3210, dailies: 9, contribution: 510 },
      active: { count: 3, of: 3 },
      from: '2026-08-17',
      fromWeekStart: true,
    });
  });

  it('scales the axis with niceTicks and draws the normal daily goals', () => {
    expect(niceTicks(10536)).toEqual([0, 2000, 4000, 6000, 8000, 10000, 12000]);
    expect(niceTicks(10536).at(-1)).toBe(12000);
    // 250 / 50 = 5, so 6 intervals of 50 reach 300.
    expect(niceTicks(250)).toEqual([0, 50, 100, 150, 200, 250, 300]);
    expect(niceTicks(0)).toEqual([0, 1]);
    // Points: 4 members × 2.950 / 7 = 1.685,7 → 1.686. Dailies: 4 × 1. No contribution goal.
    const goals = getGuildDailyGoals(history, settings, D);
    expect(goals).toEqual({ points: 1686, dailies: 4, contribution: null });
    expect(getGuildDayScales(getGuildDays(history, D), goals)).toEqual({
      points: { ticks: [0, 500, 1000, 1500, 2000, 2500], goal: 1686 },
      dailies: { ticks: [0, 2, 4, 6, 8], goal: 4 },
      contribution: { ticks: [0, 100, 200, 300, 400], goal: null },
    });
  });
});

describe('guild analytics: Por semana (§10.8)', () => {
  it('gives the five weeks ending with the week of D', () => {
    const closedWeek = { points: 7490, dailies: 21, contribution: 1190 };
    // Aria (4.900) is the only one of three members over 2.950 in a full week.
    const oneOfThree = { kind: 'closed', met: 1, members: 3 };
    expect(getGuildWeeks(history, settings, D).rows).toEqual([
      {
        start: '2026-08-24',
        end: '2026-08-30',
        currentDay: null,
        coveredDays: null,
        totals: closedWeek,
        active: { active: 3, members: 3 },
        goal: oneOfThree,
        levelsGained: 0,
      },
      {
        start: '2026-08-31',
        end: '2026-09-06',
        currentDay: null,
        coveredDays: null,
        totals: closedWeek,
        active: { active: 3, members: 3 },
        goal: oneOfThree,
        levelsGained: 0,
      },
      {
        // 09-11 has no export; 09-12 carries its activity, so the sums are those of a full week.
        start: '2026-09-07',
        end: '2026-09-13',
        currentDay: null,
        coveredDays: 6,
        totals: closedWeek,
        active: { active: 3, members: 3 },
        goal: oneOfThree,
        levelsGained: 0,
      },
      {
        // 1.120 × 3 + 1.720 + 1.750 + 1.900 + 1.730 = 10.460. Aria 5.250 and Nova reach the
        // goal: Nova's 0 + 600 + 630 × 3 = 2.490 against 2.950 × 4 eligible days / 7 = 1.685,7.
        // Brisa (1.700) and Ciro (1.020) do not. Brisa gains a level.
        start: '2026-09-14',
        end: '2026-09-20',
        currentDay: null,
        coveredDays: null,
        totals: { points: 10460, dailies: 24, contribution: 1610 },
        active: { active: 4, members: 4 },
        goal: { kind: 'closed', met: 2, members: 4 },
        levelsGained: 1,
      },
      {
        // Day 2 of 7: pace 2.950 × 2 / 7 = 842,9. Aria (1.500) and Nova (1.260) keep it.
        start: '2026-09-21',
        end: '2026-09-27',
        currentDay: 2,
        coveredDays: null,
        totals: { points: 3460, dailies: 6, contribution: 460 },
        active: { active: 3, members: 4 },
        goal: { kind: 'pace', onPace: 2 },
        levelsGained: 0,
      },
    ]);
  });

  it('compares Monday to D − 1 with the same days of the week before', () => {
    const { comparison } = getGuildWeeks(history, settings, D);
    expect(comparison).toMatchObject({
      lastDay: '2026-09-21',
      points: { current: 1730, previous: 1120 },
      dailies: { current: 3, previous: 3 },
      contribution: { current: 230, previous: 220 },
    });
    expect(comparison?.points.percent).toBeCloseTo((610 / 1120) * 100, 6);
    // On a Monday there is nothing to compare; on 09-12 the week before misses nothing but
    // this one misses 09-11.
    expect(getGuildWeeks(history, settings, at('2026-09-21')).comparison).toBeNull();
    expect(getGuildWeeks(history, settings, at('2026-09-12')).comparison).toBeNull();
  });
});

describe('guild analytics: Miembros (§10.9)', () => {
  const rows = sortGuildMemberRows(getGuildMembers(history, settings, D));

  it('gives the rows of the last export sorted by 7 days', () => {
    expect(names(rows)).toEqual(['Aria', 'Nova', 'Brisa', 'Ciro']);
    expect(
      rows.map(({ name, rank, level, today, days7, days30, change, idleDays, inactive }) => ({
        name,
        rank,
        level,
        today,
        days7,
        days30,
        change,
        idleDays,
        inactive,
      })),
    ).toEqual([
      // 30 days = 18 × 700 + 1.400 + 700 + 9 × 750.
      {
        name: 'Aria',
        rank: 'Leader',
        level: 360,
        today: 750,
        days7: 5250,
        days30: 21450,
        change: null,
        idleDays: 0,
        inactive: false,
      },
      {
        name: 'Nova',
        rank: 'Member',
        level: 360,
        today: 630,
        days7: 3750,
        days30: 3750,
        change: null,
        idleDays: 0,
        inactive: false,
      },
      // 7 days = 200 × 3 + 350 × 4; 30 days = 26 days × 200 + 4 × 350.
      {
        name: 'Brisa',
        rank: 'Vice-Leader',
        level: 150,
        today: 350,
        days7: 2000,
        days30: 6600,
        change: null,
        idleDays: 0,
        inactive: false,
      },
      // Ciro is in the export of D with nothing done: «Hoy» is a real 0.
      {
        name: 'Ciro',
        rank: 'Member',
        level: 100,
        today: 0,
        days7: 680,
        days30: 4590,
        change: null,
        idleDays: 3,
        inactive: true,
      },
    ]);
  });

  it('draws the trend with a mark for the day without export and the days before joining', () => {
    const byName = new Map(rows.map((row) => [row.name, row]));
    expect(byName.get('Brisa')?.trend).toEqual([
      200,
      200,
      null,
      400,
      200,
      200,
      200,
      200,
      200,
      200,
      350,
      350,
      350,
      350,
    ]);
    expect(byName.get('Nova')?.trend).toEqual([
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      0,
      600,
      630,
      630,
      630,
      630,
      630,
    ]);
    expect(byName.get('Ciro')?.lastActivity).toEqual({
      date: '2026-09-19',
      from: null,
      daysAgo: 3,
    });
    expect(getGuildTrendMax(rows)).toBe(1400);
  });

  it('computes the 7-day variation when the 7 days before are complete', () => {
    // D = 09-17: [09-11, 09-17] against [09-04, 09-10]. Aria: 1.400 + 700 + 4 × 750 = 5.100
    // against 7 × 700 = 4.900. Nova had nothing before: no variation.
    const early = new Map(
      getGuildMembers(history, settings, at('2026-09-17')).map((row) => [row.name, row.change]),
    );
    expect(early.get('Aria')).toBeCloseTo((200 / 4900) * 100, 6);
    expect(early.get('Brisa')).toBe(0);
    expect(early.get('Ciro')).toBe(0);
    expect(early.get('Nova')).toBeNull();
  });

  it('marks inactive members with the threshold and filters them', () => {
    expect(names(filterGuildMemberRows(rows, { inactiveOnly: true }))).toEqual(['Ciro']);
    expect(names(filterGuildMemberRows(rows, { query: ' NÓVA ' }))).toEqual(['Nova']);
    // Raising the threshold to 5 days: Ciro's 3 days no longer count (CA-10.5).
    const relaxed = getGuildMembers(history, settings, D, 5);
    expect(relaxed.filter((row) => row.inactive)).toHaveLength(0);
    expect(getGuildSummary(history, settings, D, { period: '7d' }, 5).figures?.active).toEqual({
      value: 4,
      of: 4,
      inactive: 0,
      threshold: 5,
    });
    // A member who joined today is not inactive yet.
    const joined = getGuildMembers(history, settings, at('2026-09-16')).find(
      (row) => row.name === 'Nova',
    );
    expect(joined).toMatchObject({ lastActivity: null, idleDays: 0, inactive: false });
    expect(names(sortGuildMemberRows(rows, 'lastActivity'))).toEqual([
      'Ciro',
      'Aria',
      'Brisa',
      'Nova',
    ]);
    expect(names(sortGuildMemberRows(rows, 'name'))).toEqual(['Aria', 'Brisa', 'Ciro', 'Nova']);
  });

  it('judges a mid-week join on the days she could play (CA-10.8)', () => {
    const sunday = at('2026-09-20');
    const nova = getGuildMembers(history, settings, sunday).find((row) => row.name === 'Nova');
    const week = nova?.week;
    expect(week).toMatchObject({
      start: '2026-09-14',
      end: '2026-09-20',
      figures: { points: 2490, dailies: 4, contribution: 90 },
      goal: 2950,
      goalPacing: { totalPoints: 4, dailies: 4, contribution: 3 },
      band: 'goal',
      prorated: true,
      split: null,
    });
    expect(week?.expected).toBeCloseTo((2950 * 4) / 7, 6);
    // Everyone else could play the whole week: their goal is not prorated.
    const others = getGuildMembers(history, settings, sunday).filter((row) => row.name !== 'Nova');
    expect(others.length).toBeGreaterThan(0);
    expect(others.every((row) => row.week?.prorated === false)).toBe(true);
    // The same week judged on seven days would be below the goal.
    if (!week) return;
    const subject = {
      total: week.figures.points,
      dailiesCompleted: week.figures.dailies,
      contribution: week.figures.contribution,
    };
    expect(getGuildMemberBand(subject, { settings, week: { elapsedDays: 7 } })).toBe('below');
  });

  it('offers the split of the export where a member crossed a tier', () => {
    const brisa = getGuildMembers(history, settings, at('2026-09-20')).find(
      (row) => row.name === 'Brisa',
    );
    expect(brisa?.week?.split).toEqual({
      date: '2026-09-19',
      overrideKey: '2026-09-19:brisa',
      dailies: 1,
      allocation: { normal: 0, wildscape: 1, primal: 0 },
      confidence: 'estimated',
      transition: { from: 'normal', to: 'wildscape' },
    });
    const bands = new Map(rows.map((row) => [row.name, row.week?.band]));
    expect(Object.fromEntries(bands)).toEqual({
      Aria: 'goal',
      Nova: 'goal',
      Brisa: 'below',
      Ciro: 'below',
    });
  });

  it('lists the last 14 days of a member for the dialog', () => {
    const days = getGuildMemberDays(history, D, 'ciro');
    expect(days).toHaveLength(14);
    expect(days[2]).toEqual({
      date: '2026-09-11',
      exported: false,
      figures: null,
      from: null,
      status: null,
    });
    expect(days[3]).toEqual({
      date: '2026-09-12',
      exported: true,
      figures: { points: 340, dailies: 2, contribution: 40 },
      from: '2026-09-11',
      status: 'delta',
    });
    expect(days[5]?.status).toBe('baseline');
    expect(days[13]?.figures).toEqual({ points: 0, dailies: 0, contribution: 0 });
  });
});

describe('guild analytics: exports (§10.12)', () => {
  it('writes the CSV of the rows in their order', () => {
    const rows = sortGuildMemberRows(getGuildMembers(history, settings, D));
    const csv = buildGuildMembersCsv(rows, {
      header:
        'Miembro,Rango,Nivel,Hoy,7 días,30 días,Variación 7 días (%),Última actividad,Inactivo',
      yes: 'sí',
      no: 'no',
    });
    expect(csv).toBe(
      String.fromCharCode(0xfeff) +
        [
          'Miembro,Rango,Nivel,Hoy,7 días,30 días,Variación 7 días (%),Última actividad,Inactivo',
          'Aria,Leader,360,750,5250,21450,,2026-09-22,no',
          'Nova,Member,360,630,3750,3750,,2026-09-22,no',
          'Brisa,Vice-Leader,150,350,2000,6600,,2026-09-22,no',
          'Ciro,Member,100,0,680,4590,,2026-09-19,sí',
        ].join('\r\n') +
        '\r\n',
    );
  });

  it('quotes fields, neutralizes formulas and signs the variation', () => {
    const [base] = getGuildMembers(history, settings, D);
    const rows: GuildMemberRow[] = [
      { ...base, name: '=cmd,"x"', rank: null, level: null, change: -13.333 },
      { ...base, name: 'Zoe', change: 8.2, lastActivity: null, inactive: true },
      { ...base, name: 'Ivo', change: 0.04 },
    ];
    const lines = buildGuildMembersCsv(rows, { header: 'h', yes: 'yes', no: 'no' })
      .slice(1)
      .split('\r\n');
    expect(lines[1]).toBe(`"'=cmd,""x""",,,750,5250,21450,-13.3,2026-09-22,no`);
    expect(lines[2]).toBe('Zoe,Leader,360,750,5250,21450,+8.2,,yes');
    expect(lines[3]).toBe('Ivo,Leader,360,750,5250,21450,0.0,2026-09-22,no');
  });

  it('names the files and gives the goals of the PNG head', () => {
    expect(getGuildExportFileName('Águila Real', '2026-09-22', 'csv')).toBe(
      'guild-aguila-real-2026-09-22.csv',
    );
    expect(getGuildExportFileName(null, '2026-09-22', 'png')).toBe('guild-2026-09-22.png');
    const goals = getGuildImageGoals(settings, D);
    expect(goals.todayPoints).toBeCloseTo((2950 * 2) / 7, 6);
    expect(goals).toMatchObject({ dailies: 2, premiumPoints: 5900 });
  });

  it('keeps the inactivity threshold between 1 and 30', () => {
    expect(normalizeGuildInactivityDays(5)).toBe(5);
    expect(normalizeGuildInactivityDays(0)).toBe(3);
    expect(normalizeGuildInactivityDays(31)).toBe(3);
    expect(normalizeGuildInactivityDays(2.5)).toBe(3);
    expect(normalizeGuildInactivityDays('4')).toBe(3);
  });
});
