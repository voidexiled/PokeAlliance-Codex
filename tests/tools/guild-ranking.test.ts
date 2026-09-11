import { describe, expect, it } from 'vitest';

import {
  calculateGuildDailyHistory,
  createGuildDailySnapshot,
  replaceGuildDailySnapshot,
  summarizeGuildMemberWeek,
  summarizeGuildDailyHistory,
} from '@/lib/tools/guild-daily-history';
import {
  buildGuildDiscordText,
  buildGuildWhatsAppText,
  calculateGuildRanking,
  getGuildDailyValue,
  getGuildDerivedContributionPerDay,
  getGuildMemberBand,
  getGuildWeekContext,
  normalizePacingSettings,
  parseGuildExport,
  parseGuildExportText,
} from '@/lib/tools/guild-ranking';

const samplePayload = {
  exportedAt: '2026-09-10 01:03:08',
  guild: 'Test Guild',
  members: [
    {
      name: 'Alpha Player',
      rank: 'a Member',
      level: 120,
      lastLogin: '2026-09-09 23:10:00',
      dailiesCompleted: 4,
      contribution: 700,
      status: 'offline',
    },
    {
      name: 'Beta Player',
      rank: 'a Vice-Leader',
      level: 80,
      lastLogin: '2026-09-10 00:20:00',
      dailiesCompleted: 2,
      contribution: 100,
      status: 'online',
    },
  ],
};

describe('guild ranking', () => {
  it('uses the exported timestamp to calculate the Monday-to-Sunday cycle', () => {
    const week = getGuildWeekContext(samplePayload.exportedAt, 'America/Sao_Paulo');

    expect(week.weekStartDate).toBe('2026-09-07');
    expect(week.weekEndDate).toBe('2026-09-13');
    expect(week.dayIndex).toBe(4);
    expect(week.elapsedDays).toBe(4);
    expect(week.remainingDays).toBe(3);
  });

  it('calculates each daily from the member level', () => {
    expect(getGuildDailyValue(0)).toMatchObject({ band: 'standard', points: 150 });
    expect(getGuildDailyValue(149)).toMatchObject({ band: 'standard', points: 150 });
    expect(getGuildDailyValue(150)).toMatchObject({ band: 'wildscape', points: 300 });
    expect(getGuildDailyValue(349)).toMatchObject({ band: 'wildscape', points: 300 });
    expect(getGuildDailyValue(350)).toMatchObject({ band: 'primal', points: 600 });
    expect(getGuildDailyValue(null)).toMatchObject({ band: 'unknown', points: null });
  });

  it('derives contribution pace by level when total and dailies goals are active', () => {
    expect(getGuildDerivedContributionPerDay(120, normalizePacingSettings({}))).toBeCloseTo(
      1900 / 7,
    );
    expect(getGuildDerivedContributionPerDay(200, normalizePacingSettings({}))).toBeCloseTo(
      850 / 7,
    );
    expect(getGuildDerivedContributionPerDay(400, normalizePacingSettings({}))).toBe(0);
  });

  it('supports independent daily and weekly goals', () => {
    const pace = normalizePacingSettings({
      standard: {
        totalPoints: { daily: null, weekly: 3150 },
        dailies: { daily: 1, weekly: null },
        contribution: { daily: 100, weekly: null },
      },
    });
    expect(pace.standard.totalPoints.weekly).toBe(3150);
    expect(pace.standard.dailies.daily).toBe(1);
    expect(pace.standard.contribution.daily).toBe(100);

    const parsed = parseGuildExport(samplePayload);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const ranking = calculateGuildRanking(
      parsed.payload,
      {
        standard: {
          totalPoints: { daily: null, weekly: 3150 },
          dailies: { daily: 1, weekly: null },
          contribution: { daily: 100, weekly: null },
        },
        premium: {
          totalPoints: { daily: null, weekly: 5900 },
          dailies: { daily: null, weekly: null },
          contribution: { daily: null, weekly: null },
        },
      },
      'America/Sao_Paulo',
    );

    expect(ranking.weeklyMinimumPoints).toBe(3150);
    expect(ranking.expectedDailies).toBe(4);
    expect(ranking.expectedContribution).toBe(400);
    expect(ranking.expectedMinimumPoints).toBe(1800);
    expect(ranking.members[0]).toMatchObject({
      name: 'Alpha Player',
      pointsPerDaily: 150,
      dailyPoints: 600,
      total: 1300,
    });
    expect(ranking.totalContribution).toBe(800);
    expect(ranking.totalPoints).toBe(1700);
  });

  it('keeps contribution in the WhatsApp export', () => {
    const parsed = parseGuildExportText(JSON.stringify(samplePayload));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const text = buildGuildWhatsAppText(
      calculateGuildRanking(parsed.payload, {
        standard: {
          totalPoints: { daily: null, weekly: 2950 },
          dailies: { daily: 1, weekly: null },
          contribution: { daily: null, weekly: null },
        },
      }),
    );

    expect(text).toContain('*Contribución total:* 800');
    expect(text).toContain('700 contribución');
    expect(text).toContain('150 pts');
    expect(text).toContain('Meta acumulada al día 4');
  });

  it('builds a Markdown Discord export with loaded daily and monthly summaries', () => {
    const parsed = parseGuildExportText(JSON.stringify(samplePayload));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const ranking = calculateGuildRanking(parsed.payload);
    const text = buildGuildDiscordText(ranking, [
      {
        observationDate: '2026-09-10',
        weekStartDate: '2026-09-07',
        dayIndex: 4,
        dailyDailies: 6,
        dailyContribution: 800,
        dailyPoints: 900,
      },
    ]);

    expect(text).toContain('# 🏆 Test Guild · Ranking de guild');
    expect(text).toContain('## Metas activas');
    expect(text).toContain('## Registro diario cargado');
    expect(text).toContain('## Resumen mensual con snapshots cargados');
    expect(text).toContain('**#1 · Alpha Player**');
  });

  it('rejects duplicate names and invalid numeric fields', () => {
    expect(
      parseGuildExport({
        ...samplePayload,
        members: [
          samplePayload.members[0],
          { ...samplePayload.members[0], name: ' alpha player ' },
        ],
      }),
    ).toMatchObject({ ok: false, code: 'duplicate_member' });

    expect(
      parseGuildExport({
        ...samplePayload,
        members: [{ ...samplePayload.members[0], contribution: '700' }],
      }),
    ).toMatchObject({ ok: false, code: 'member_number_invalid' });
  });
});

describe('guild daily history', () => {
  it('replaces repeated imports for the same Server Save date', () => {
    const monday = createGuildDailySnapshot('monday', {
      ...samplePayload,
      exportedAt: '2026-09-07 23:00:00',
      members: [{ ...samplePayload.members[0], dailiesCompleted: 2, contribution: 700 }],
    });
    const tuesday = createGuildDailySnapshot('tuesday', {
      ...samplePayload,
      exportedAt: '2026-09-08 22:00:00',
      members: [{ ...samplePayload.members[0], dailiesCompleted: 3, contribution: 1000 }],
    });
    const tuesdayReplacement = createGuildDailySnapshot('tuesday-replacement', {
      ...samplePayload,
      exportedAt: '2026-09-08 23:55:00',
      members: [{ ...samplePayload.members[0], dailiesCompleted: 4, contribution: 1300 }],
    });

    const snapshots = replaceGuildDailySnapshot(
      replaceGuildDailySnapshot([monday], tuesday),
      tuesdayReplacement,
    );
    const history = calculateGuildDailyHistory(snapshots, {
      standard: {
        totalPoints: { daily: null, weekly: null },
        dailies: { daily: null, weekly: null },
        contribution: { daily: null, weekly: null },
      },
    });

    expect(history.snapshots).toHaveLength(2);
    expect(history.snapshots[1]?.snapshotId).toBe('tuesday-replacement');
    expect(history.weeks[0]?.summaries[0]).toMatchObject({
      dailyDailies: 2,
      dailyContribution: 700,
      dailyPoints: 1000,
    });
    expect(history.weeks[0]?.summaries[0]?.memberDeltas[0]).toMatchObject({
      membershipKind: 'baseline',
      dailyEligibility: 'assumed_eligible',
      contributionEligibility: 'assumed_eligible',
      eligibleDailyDays: 1,
      eligibleContributionDays: 1,
    });
    expect(history.weeks[0]?.summaries[1]).toMatchObject({
      dailyDailies: 2,
      dailyContribution: 600,
      dailyPoints: 900,
    });
    expect(history.weeks[0]?.summaries[1]?.memberDeltas[0]).toMatchObject({
      statusKind: 'delta',
      previousObservationDate: '2026-09-07',
      gapDays: 1,
      rawDailyContribution: 600,
    });
  });

  it('starts a new weekly baseline after the Server Save reset', () => {
    const sunday = createGuildDailySnapshot('sunday', {
      ...samplePayload,
      exportedAt: '2026-09-13 23:50:00',
      members: [{ ...samplePayload.members[0], dailiesCompleted: 12, contribution: 4000 }],
    });
    const nextMonday = createGuildDailySnapshot('next-monday', {
      ...samplePayload,
      exportedAt: '2026-09-14 23:00:00',
      members: [{ ...samplePayload.members[0], dailiesCompleted: 1, contribution: 350 }],
    });

    const history = calculateGuildDailyHistory([sunday, nextMonday], {
      standard: {
        totalPoints: { daily: null, weekly: null },
        dailies: { daily: null, weekly: null },
        contribution: { daily: null, weekly: null },
      },
    });

    expect(history.weeks).toHaveLength(2);
    expect(history.weeks[1]?.summaries[0]?.memberDeltas[0]).toMatchObject({
      statusKind: 'baseline',
      dailyDailies: 1,
      dailyContribution: 350,
    });
  });

  it('summarizes loaded coverage without inventing missing days', () => {
    const snapshots = [
      createGuildDailySnapshot('monday', {
        ...samplePayload,
        exportedAt: '2026-09-07 23:00:00',
      }),
      createGuildDailySnapshot('tuesday', {
        ...samplePayload,
        exportedAt: '2026-09-08 23:00:00',
        members: samplePayload.members.map((member) => ({
          ...member,
          dailiesCompleted: (member.dailiesCompleted ?? 0) + 1,
          contribution: (member.contribution ?? 0) + 150,
        })),
      }),
    ];
    const overview = summarizeGuildDailyHistory(calculateGuildDailyHistory(snapshots));

    expect(overview).toMatchObject({
      snapshotCount: 2,
      weekCount: 1,
      monthCount: 1,
      firstObservationDate: '2026-09-07',
      lastObservationDate: '2026-09-08',
    });
    expect(overview.currentWeek).toMatchObject({
      daysObserved: 2,
      complete: false,
      dailyDailies: 8,
      dailyContribution: 1100,
    });
    expect(overview.currentMonth).toMatchObject({
      key: '2026-09',
      daysObserved: 2,
      complete: false,
    });
  });

  it('estimates a tier transition and accepts a manual interval correction', () => {
    const monday = createGuildDailySnapshot('transition-monday', {
      ...samplePayload,
      exportedAt: '2026-09-07 23:00:00',
      members: [{ ...samplePayload.members[0], level: 340, dailiesCompleted: 30, contribution: 0 }],
    });
    const friday = createGuildDailySnapshot('transition-friday', {
      ...samplePayload,
      exportedAt: '2026-09-11 23:00:00',
      members: [{ ...samplePayload.members[0], level: 350, dailiesCompleted: 36, contribution: 0 }],
    });

    const automatic = calculateGuildDailyHistory([monday, friday]);
    const automaticDelta = automatic.weeks[0]?.summaries[1]?.memberDeltas[0];
    expect(automaticDelta).toMatchObject({
      dailyDailies: 6,
      dailyPoints: 3600,
      difficultyConfidence: 'estimated',
      difficultyTransition: { from: 'wildscape', to: 'primal' },
      difficultyAllocation: { normal: 0, wildscape: 0, primal: 6 },
    });

    const corrected = calculateGuildDailyHistory([monday, friday], {}, undefined, {
      difficultyOverrides: {
        '2026-09-11:alpha player': { normal: 0, wildscape: 4, primal: 2 },
      },
    });
    expect(corrected.weeks[0]?.summaries[1]?.memberDeltas[0]).toMatchObject({
      dailyPoints: 2400,
      difficultyConfidence: 'manual',
      difficultyAllocation: { normal: 0, wildscape: 4, primal: 2 },
    });
  });

  it('tracks next-week level gains and a new member eligibility window', () => {
    const monday = createGuildDailySnapshot('next-week-monday', {
      exportedAt: '2026-09-14 23:50:00',
      guild: 'Test Guild',
      members: [
        {
          name: 'Alpha Player',
          level: 120,
          dailiesCompleted: 0,
          contribution: 0,
        },
      ],
    });
    const tuesday = createGuildDailySnapshot('next-week-tuesday', {
      exportedAt: '2026-09-15 23:50:00',
      guild: 'Test Guild',
      members: [
        {
          name: 'Alpha Player',
          level: 122,
          dailiesCompleted: 2,
          contribution: 300,
        },
        {
          name: 'New Player',
          level: 200,
          dailiesCompleted: 0,
          contribution: 0,
        },
      ],
    });
    const wednesday = createGuildDailySnapshot('next-week-wednesday', {
      exportedAt: '2026-09-16 23:50:00',
      guild: 'Test Guild',
      members: [
        {
          name: 'Alpha Player',
          level: 123,
          dailiesCompleted: 3,
          contribution: 450,
        },
        {
          name: 'New Player',
          level: 202,
          dailiesCompleted: 1,
          contribution: 0,
        },
      ],
    });
    const thursday = createGuildDailySnapshot('next-week-thursday', {
      exportedAt: '2026-09-17 23:50:00',
      guild: 'Test Guild',
      members: [
        {
          name: 'Alpha Player',
          level: 124,
          dailiesCompleted: 4,
          contribution: 600,
        },
        {
          name: 'New Player',
          level: 203,
          dailiesCompleted: 2,
          contribution: 300,
        },
      ],
    });

    const history = calculateGuildDailyHistory([monday, tuesday, wednesday, thursday]);
    const summaries = history.weeks[0]?.summaries ?? [];
    const joined = summaries[1]?.memberDeltas.find((member) => member.displayName === 'New Player');
    const dailyEligible = summaries[2]?.memberDeltas.find(
      (member) => member.displayName === 'New Player',
    );
    const fullyEligible = summaries[3]?.memberDeltas.find(
      (member) => member.displayName === 'New Player',
    );

    expect(summaries[1]?.membershipEvents).toEqual([
      expect.objectContaining({
        kind: 'joined',
        displayName: 'New Player',
        observationDate: '2026-09-15',
        dailyEligibleDate: '2026-09-16',
        contributionEligibleDate: '2026-09-17',
        precision: 'observed_between_snapshots',
      }),
    ]);
    expect(joined).toMatchObject({
      membershipKind: 'joined',
      dailyEligibility: 'waiting',
      contributionEligibility: 'waiting',
      eligibleDailyDays: 0,
      eligibleContributionDays: 0,
      levelDelta: null,
    });
    expect(dailyEligible).toMatchObject({
      membershipKind: 'existing',
      dailyEligibility: 'eligible',
      contributionEligibility: 'waiting',
      eligibleDailyDays: 1,
      eligibleContributionDays: 0,
      levelDelta: 2,
    });
    expect(fullyEligible).toMatchObject({
      dailyEligibility: 'eligible',
      contributionEligibility: 'eligible',
      eligibleDailyDays: 2,
      eligibleContributionDays: 1,
      levelDelta: 1,
    });
    expect(summaries.map((summary) => summary.levelsGained)).toEqual([0, 2, 3, 2]);
    expect(summarizeGuildMemberWeek(history, '2026-09-14', '2026-09-17')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          displayName: 'Alpha Player',
          levelsGained: 4,
          levelChange: 4,
        }),
        expect.objectContaining({
          displayName: 'New Player',
          levelsGained: 3,
          membershipKind: 'joined',
          eligibleDailyDays: 2,
          eligibleContributionDays: 1,
        }),
      ]),
    );
  });

  it('records departures and applies fresh waiting periods after a return', () => {
    const monday = createGuildDailySnapshot('membership-monday', {
      exportedAt: '2026-09-14 23:00:00',
      members: [
        { name: 'Alpha Player', level: 120 },
        { name: 'Returning Player', level: 180 },
      ],
    });
    const tuesday = createGuildDailySnapshot('membership-tuesday', {
      exportedAt: '2026-09-15 23:00:00',
      members: [{ name: 'Alpha Player', level: 121 }],
    });
    const wednesday = createGuildDailySnapshot('membership-wednesday', {
      exportedAt: '2026-09-16 23:00:00',
      members: [
        { name: 'Alpha Player', level: 122 },
        { name: 'Returning Player', level: 185 },
      ],
    });

    const summaries = calculateGuildDailyHistory([monday, tuesday, wednesday]).weeks[0]?.summaries;

    expect(summaries?.[1]?.membershipEvents).toEqual([
      expect.objectContaining({ kind: 'left', displayName: 'Returning Player' }),
    ]);
    expect(summaries?.[2]?.membershipEvents).toEqual([
      expect.objectContaining({
        kind: 'returned',
        dailyEligibleDate: '2026-09-17',
        contributionEligibleDate: '2026-09-18',
      }),
    ]);
    expect(
      summaries?.[2]?.memberDeltas.find((member) => member.displayName === 'Returning Player'),
    ).toMatchObject({
      membershipKind: 'returned',
      levelDelta: null,
      dailyEligibility: 'waiting',
      contributionEligibility: 'waiting',
    });
  });

  it('recomputes membership events when a snapshot for the same day is replaced', () => {
    const monday = createGuildDailySnapshot('replace-membership-monday', {
      exportedAt: '2026-09-14 23:00:00',
      members: [{ name: 'Alpha Player', level: 120 }],
    });
    const tuesdayWithJoin = createGuildDailySnapshot('replace-membership-tuesday-old', {
      exportedAt: '2026-09-15 20:00:00',
      members: [
        { name: 'Alpha Player', level: 121 },
        { name: 'New Player', level: 200 },
      ],
    });
    const tuesdayReplacement = createGuildDailySnapshot('replace-membership-tuesday-new', {
      exportedAt: '2026-09-15 23:50:00',
      members: [{ name: 'Alpha Player', level: 122 }],
    });
    const snapshots = replaceGuildDailySnapshot(
      replaceGuildDailySnapshot([monday], tuesdayWithJoin),
      tuesdayReplacement,
    );
    const summaries = calculateGuildDailyHistory(snapshots).weeks[0]?.summaries;

    expect(summaries).toHaveLength(2);
    expect(summaries?.[1]?.snapshot.snapshotId).toBe('replace-membership-tuesday-new');
    expect(summaries?.[1]?.membershipEvents).toEqual([]);
    expect(summaries?.[1]?.levelsGained).toBe(2);
  });

  it('does not classify a newly observed member below goal before access opens', () => {
    const ranking = calculateGuildRanking({
      exportedAt: '2026-09-15 23:00:00',
      members: [
        {
          name: 'New Player',
          level: 200,
          dailiesCompleted: 0,
          contribution: 0,
        },
      ],
    });

    expect(getGuildMemberBand(ranking.members[0]!, ranking)).toBe('below');
    expect(
      getGuildMemberBand(ranking.members[0]!, ranking, {
        totalPoints: 0,
        dailies: 0,
        contribution: 0,
      }),
    ).toBe('neutral');
    expect(
      getGuildMemberBand(ranking.members[0]!, ranking, {
        totalPoints: 1,
        dailies: 1,
        contribution: 0,
      }),
    ).toBe('below');
  });
});
