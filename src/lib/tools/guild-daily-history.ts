import { Temporal } from '@js-temporal/polyfill';

import {
  calculateGuildRanking,
  getGuildWeekContext,
  type GuildExportPayload,
  type GuildMemberExport,
  type GuildPacingSettings,
} from '@/lib/tools/guild-ranking';
import { SERVER_SAVE_ZONE } from '@/lib/time/server-save';
import {
  DEFAULT_GUILD_DIFFICULTY_TIERS,
  estimateGuildDifficultyAllocation,
  isValidGuildDifficultyAllocation,
  pointsForGuildDifficultyAllocation,
  type GuildDifficultyAllocation,
  type GuildDifficultyConfidence,
  type GuildDifficultyPolicy,
  type GuildDifficultyTier,
  type GuildDifficultyTransition,
} from './guild-difficulty';

export type GuildDailySnapshot = {
  snapshotId: string;
  payload: GuildExportPayload;
  sourceTimeZone: string;
  observationDate: string;
  weekStartDate: string;
  dayIndex: number;
};

export type GuildDeltaStatus = 'baseline' | 'delta' | 'decrease_detected';

export type GuildMembershipKind = 'baseline' | 'existing' | 'joined' | 'returned';

export type GuildEligibilityStatus = 'assumed_eligible' | 'eligible' | 'waiting';

export type GuildMembershipEvent = {
  memberKey: string;
  displayName: string;
  kind: 'joined' | 'left' | 'returned';
  observationDate: string;
  previousObservationDate: string | null;
  firstObservedDate: string;
  dailyEligibleDate: string | null;
  contributionEligibleDate: string | null;
  precision: 'observed_between_snapshots';
};

export type GuildDailyMemberDelta = {
  memberKey: string;
  displayName: string;
  level: number | null;
  rank: string | null;
  status: string | null;
  lastLogin: string | null;
  dailiesCompleted: number;
  contribution: number;
  dailyDailies: number;
  dailyContribution: number;
  dailyPoints: number;
  difficultyAllocation: GuildDifficultyAllocation;
  difficultyConfidence: GuildDifficultyConfidence;
  difficultyTransition: GuildDifficultyTransition | null;
  previousLevel: number | null;
  levelDelta: number | null;
  statusKind: GuildDeltaStatus;
  previousObservationDate: string | null;
  gapDays: number | null;
  rawDailyDailies: number | null;
  rawDailyContribution: number | null;
  membershipKind: GuildMembershipKind;
  firstObservedDate: string;
  membershipObservedDate: string;
  dailyEligibleDate: string | null;
  contributionEligibleDate: string | null;
  dailyEligibility: GuildEligibilityStatus;
  contributionEligibility: GuildEligibilityStatus;
  eligibleDailyDays: number;
  eligibleContributionDays: number;
};

export type GuildDailySummary = {
  snapshot: GuildDailySnapshot;
  memberCount: number;
  dailyDailies: number;
  dailyContribution: number;
  dailyPoints: number;
  levelsGained: number;
  membershipEvents: GuildMembershipEvent[];
  comparisonStatus: GuildDeltaStatus;
  memberDeltas: GuildDailyMemberDelta[];
};

export type GuildDailyHistory = {
  snapshots: GuildDailySnapshot[];
  weeks: Array<{
    weekStartDate: string;
    weekEndDate: string;
    summaries: GuildDailySummary[];
  }>;
};

export type GuildHistoryPeriodSummary = {
  key: string;
  startDate: string;
  endDate: string;
  snapshotCount: number;
  daysObserved: number;
  dailyDailies: number;
  dailyContribution: number;
  dailyPoints: number;
  levelsGained: number;
  membersJoined: number;
  membersLeft: number;
  memberCountAtEnd: number;
  complete: boolean;
};

export type GuildMemberWeekActivity = {
  memberKey: string;
  displayName: string;
  levelsGained: number;
  levelChange: number;
  dailyDailies: number;
  dailyContribution: number;
  dailyPoints: number;
  membershipKind: GuildMembershipKind;
  firstObservedDate: string;
  membershipObservedDate: string;
  dailyEligibleDate: string | null;
  contributionEligibleDate: string | null;
  dailyEligibility: GuildEligibilityStatus;
  contributionEligibility: GuildEligibilityStatus;
  eligibleDailyDays: number;
  eligibleContributionDays: number;
};

export type GuildHistoryOverview = {
  snapshotCount: number;
  weekCount: number;
  monthCount: number;
  firstObservationDate: string | null;
  lastObservationDate: string | null;
  weeks: GuildHistoryPeriodSummary[];
  months: GuildHistoryPeriodSummary[];
  currentWeek: GuildHistoryPeriodSummary | null;
  currentMonth: GuildHistoryPeriodSummary | null;
};

function normalizeMemberKey(value: string): string {
  return value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase();
}

function memberValue(member: GuildMemberExport): {
  dailiesCompleted: number;
  contribution: number;
} {
  return {
    dailiesCompleted: member.dailiesCompleted ?? 0,
    contribution: member.contribution ?? 0,
  };
}

function addDays(date: string, days: number): string {
  return Temporal.PlainDate.from(date).add({ days }).toString();
}

function eligibleDaysInWeek(
  weekStartDate: string,
  observationDate: string,
  eligibleDate: string | null,
  firstObservedDate: string,
): number {
  // A baseline member is assumed to have access, but pacing starts on the first
  // day for which this workspace actually has evidence. This avoids demanding
  // Monday/Tuesday activity when tracking only began on Wednesday.
  const start = Temporal.PlainDate.from(eligibleDate ?? firstObservedDate);
  const weekStart = Temporal.PlainDate.from(weekStartDate);
  const effectiveStart = Temporal.PlainDate.compare(start, weekStart) < 0 ? weekStart : start;
  const observed = Temporal.PlainDate.from(observationDate);
  if (Temporal.PlainDate.compare(observed, effectiveStart) < 0) return 0;
  return effectiveStart.until(observed, { largestUnit: 'days' }).days + 1;
}

function eligibilityStatus(
  observationDate: string,
  eligibleDate: string | null,
): GuildEligibilityStatus {
  if (!eligibleDate) return 'assumed_eligible';
  return Temporal.PlainDate.compare(
    Temporal.PlainDate.from(observationDate),
    Temporal.PlainDate.from(eligibleDate),
  ) >= 0
    ? 'eligible'
    : 'waiting';
}

export function createGuildDailySnapshot(
  snapshotId: string,
  payload: GuildExportPayload,
  sourceTimeZone = SERVER_SAVE_ZONE,
): GuildDailySnapshot {
  const week = getGuildWeekContext(payload.exportedAt, sourceTimeZone);
  return {
    snapshotId,
    payload,
    sourceTimeZone,
    observationDate: week.sourceLocalDateTime.slice(0, 10),
    weekStartDate: week.weekStartDate,
    dayIndex: week.dayIndex,
  };
}

/**
 * Keeps one imported export per local Server Save date. A later import for the
 * same date replaces the earlier one, while callers can still retain the
 * replaced digest in their database import log.
 */
export function replaceGuildDailySnapshot(
  snapshots: GuildDailySnapshot[],
  incoming: GuildDailySnapshot,
): GuildDailySnapshot[] {
  return [
    ...snapshots.filter((snapshot) => snapshot.observationDate !== incoming.observationDate),
    incoming,
  ].sort((a, b) => a.observationDate.localeCompare(b.observationDate));
}

function calculateMemberDelta(
  current: GuildMemberExport,
  previous: { member: GuildMemberExport; observationDate: string } | undefined,
  previousMembershipMember: GuildMemberExport | undefined,
  currentObservationDate: string,
  weekStartDate: string,
  membership: {
    kind: GuildMembershipKind;
    firstObservedDate: string;
    membershipObservedDate: string;
    dailyEligibleDate: string | null;
    contributionEligibleDate: string | null;
  },
  options: GuildDailyHistoryOptions,
): GuildDailyMemberDelta {
  const currentValues = memberValue(current);
  const previousValues = previous ? memberValue(previous.member) : null;
  const rawDailyDailies = previousValues
    ? currentValues.dailiesCompleted - previousValues.dailiesCompleted
    : null;
  const rawDailyContribution = previousValues
    ? currentValues.contribution - previousValues.contribution
    : null;
  const hasDecrease =
    (rawDailyDailies !== null && rawDailyDailies < 0) ||
    (rawDailyContribution !== null && rawDailyContribution < 0);
  const dailyDailies = previousValues
    ? Math.max(0, rawDailyDailies ?? 0)
    : currentValues.dailiesCompleted;
  const dailyContribution = previousValues
    ? Math.max(0, rawDailyContribution ?? 0)
    : currentValues.contribution;
  const gapDays = previous
    ? Temporal.PlainDate.from(previous.observationDate).until(
        Temporal.PlainDate.from(currentObservationDate),
        {
          largestUnit: 'days',
        },
      ).days
    : null;
  const difficultyEstimate = estimateGuildDifficultyAllocation(
    dailyDailies,
    current.level ?? null,
    previous?.member.level ?? null,
    options.transitionPolicy,
    options.difficultyTiers,
  );
  const overrideKey = `${currentObservationDate}:${normalizeMemberKey(current.name)}`;
  const override = options.difficultyOverrides?.[overrideKey];
  const difficultyAllocation = isValidGuildDifficultyAllocation(override, dailyDailies)
    ? override
    : difficultyEstimate.allocation;
  const difficultyConfidence = isValidGuildDifficultyAllocation(override, dailyDailies)
    ? 'manual'
    : difficultyEstimate.confidence;
  const previousLevel = previousMembershipMember?.level ?? null;
  const level = current.level ?? null;
  const levelDelta = previousLevel !== null && level !== null ? level - previousLevel : null;

  return {
    memberKey: normalizeMemberKey(current.name),
    displayName: current.name,
    level,
    rank: current.rank ?? null,
    status: current.status ?? null,
    lastLogin: current.lastLogin ?? null,
    dailiesCompleted: currentValues.dailiesCompleted,
    contribution: currentValues.contribution,
    dailyDailies,
    dailyContribution,
    dailyPoints: pointsForGuildDifficultyAllocation(difficultyAllocation, options.difficultyTiers),
    difficultyAllocation,
    difficultyConfidence,
    difficultyTransition: difficultyEstimate.transition,
    previousLevel,
    levelDelta,
    statusKind: previous ? (hasDecrease ? 'decrease_detected' : 'delta') : 'baseline',
    previousObservationDate: previous?.observationDate ?? null,
    gapDays,
    rawDailyDailies,
    rawDailyContribution,
    membershipKind: membership.kind,
    firstObservedDate: membership.firstObservedDate,
    membershipObservedDate: membership.membershipObservedDate,
    dailyEligibleDate: membership.dailyEligibleDate,
    contributionEligibleDate: membership.contributionEligibleDate,
    dailyEligibility: eligibilityStatus(currentObservationDate, membership.dailyEligibleDate),
    contributionEligibility: eligibilityStatus(
      currentObservationDate,
      membership.contributionEligibleDate,
    ),
    eligibleDailyDays: eligibleDaysInWeek(
      weekStartDate,
      currentObservationDate,
      membership.dailyEligibleDate,
      membership.firstObservedDate,
    ),
    eligibleContributionDays: eligibleDaysInWeek(
      weekStartDate,
      currentObservationDate,
      membership.contributionEligibleDate,
      membership.firstObservedDate,
    ),
  };
}

export type GuildDailyHistoryOptions = {
  difficultyTiers?: readonly GuildDifficultyTier[];
  transitionPolicy?: GuildDifficultyPolicy;
  difficultyOverrides?: Record<string, GuildDifficultyAllocation | undefined>;
};

export function calculateGuildDailyHistory(
  snapshots: GuildDailySnapshot[],
  _rawSettings: Partial<GuildPacingSettings> = {},
  sourceTimeZone = SERVER_SAVE_ZONE,
  options: GuildDailyHistoryOptions = {},
): GuildDailyHistory {
  void _rawSettings;
  const difficultyOptions: Required<
    Pick<GuildDailyHistoryOptions, 'difficultyTiers' | 'transitionPolicy'>
  > &
    GuildDailyHistoryOptions = {
    difficultyTiers: options.difficultyTiers ?? DEFAULT_GUILD_DIFFICULTY_TIERS,
    transitionPolicy: options.transitionPolicy ?? 'current',
    ...options,
  };
  const importedSnapshots = snapshots
    .map((snapshot) =>
      snapshot.sourceTimeZone === sourceTimeZone
        ? snapshot
        : createGuildDailySnapshot(snapshot.snapshotId, snapshot.payload, sourceTimeZone),
    )
    .sort((a, b) => a.observationDate.localeCompare(b.observationDate));
  const normalizedSnapshots = importedSnapshots.reduce<GuildDailySnapshot[]>(
    (current, snapshot) => replaceGuildDailySnapshot(current, snapshot),
    [],
  );
  const weeks = new Map<string, GuildDailySummary[]>();
  const knownMembers = new Map<
    string,
    {
      firstObservedDate: string;
      membershipObservedDate: string;
      dailyEligibleDate: string | null;
      contributionEligibleDate: string | null;
      member: GuildMemberExport;
      active: boolean;
    }
  >();

  for (const [snapshotIndex, snapshot] of normalizedSnapshots.entries()) {
    const previousSnapshot = normalizedSnapshots[snapshotIndex - 1];
    const previousSnapshotMembers = new Map(
      (previousSnapshot?.payload.members ?? []).map((member) => [
        normalizeMemberKey(member.name),
        member,
      ]),
    );
    const currentSnapshotMembers = new Map(
      snapshot.payload.members.map((member) => [normalizeMemberKey(member.name), member]),
    );
    const membershipEvents: GuildMembershipEvent[] = [];

    if (previousSnapshot) {
      for (const [memberKey, member] of previousSnapshotMembers) {
        if (currentSnapshotMembers.has(memberKey)) continue;
        const known = knownMembers.get(memberKey);
        if (!known?.active) continue;
        membershipEvents.push({
          memberKey,
          displayName: member.name,
          kind: 'left',
          observationDate: snapshot.observationDate,
          previousObservationDate: previousSnapshot.observationDate,
          firstObservedDate: known.firstObservedDate,
          dailyEligibleDate: null,
          contributionEligibleDate: null,
          precision: 'observed_between_snapshots',
        });
        knownMembers.set(memberKey, { ...known, member, active: false });
      }
    }

    const previousMembers = new Map<
      string,
      { member: GuildMemberExport; observationDate: string }
    >();
    const previousSnapshots = normalizedSnapshots.filter(
      (candidate) =>
        candidate.weekStartDate === snapshot.weekStartDate &&
        candidate.observationDate < snapshot.observationDate,
    );
    for (const previousSnapshot of previousSnapshots) {
      for (const member of previousSnapshot.payload.members) {
        previousMembers.set(normalizeMemberKey(member.name), {
          member,
          observationDate: previousSnapshot.observationDate,
        });
      }
    }

    const memberDeltas = snapshot.payload.members.map((member) => {
      const memberKey = normalizeMemberKey(member.name);
      const known = knownMembers.get(memberKey);
      const presentPreviously = previousSnapshotMembers.has(memberKey);
      const membershipKind: GuildMembershipKind =
        snapshotIndex === 0
          ? 'baseline'
          : presentPreviously
            ? 'existing'
            : known
              ? 'returned'
              : 'joined';
      const membershipObservedDate =
        membershipKind === 'joined' || membershipKind === 'returned'
          ? snapshot.observationDate
          : (known?.membershipObservedDate ?? snapshot.observationDate);
      const firstObservedDate = known?.firstObservedDate ?? snapshot.observationDate;
      const dailyEligibleDate =
        membershipKind === 'joined' || membershipKind === 'returned'
          ? addDays(snapshot.observationDate, 1)
          : (known?.dailyEligibleDate ?? null);
      const contributionEligibleDate =
        membershipKind === 'joined' || membershipKind === 'returned'
          ? addDays(snapshot.observationDate, 2)
          : (known?.contributionEligibleDate ?? null);

      if (membershipKind === 'joined' || membershipKind === 'returned') {
        membershipEvents.push({
          memberKey,
          displayName: member.name,
          kind: membershipKind,
          observationDate: snapshot.observationDate,
          previousObservationDate: previousSnapshot?.observationDate ?? null,
          firstObservedDate,
          dailyEligibleDate,
          contributionEligibleDate,
          precision: 'observed_between_snapshots',
        });
      }

      const delta = calculateMemberDelta(
        member,
        previousMembers.get(memberKey),
        presentPreviously ? previousSnapshotMembers.get(memberKey) : undefined,
        snapshot.observationDate,
        snapshot.weekStartDate,
        {
          kind: membershipKind,
          firstObservedDate,
          membershipObservedDate,
          dailyEligibleDate,
          contributionEligibleDate,
        },
        difficultyOptions,
      );
      knownMembers.set(memberKey, {
        firstObservedDate,
        membershipObservedDate,
        dailyEligibleDate,
        contributionEligibleDate,
        member,
        active: true,
      });
      return delta;
    });
    const dailyDailies = memberDeltas.reduce((total, member) => total + member.dailyDailies, 0);
    const dailyContribution = memberDeltas.reduce(
      (total, member) => total + member.dailyContribution,
      0,
    );
    const summary: GuildDailySummary = {
      snapshot,
      memberCount: snapshot.payload.members.length,
      dailyDailies,
      dailyContribution,
      dailyPoints:
        memberDeltas.reduce((total, member) => total + member.dailyPoints, 0) + dailyContribution,
      levelsGained: memberDeltas.reduce(
        (total, member) => total + Math.max(0, member.levelDelta ?? 0),
        0,
      ),
      membershipEvents,
      comparisonStatus: memberDeltas.some((member) => member.statusKind === 'decrease_detected')
        ? 'decrease_detected'
        : memberDeltas.some((member) => member.statusKind === 'delta')
          ? 'delta'
          : 'baseline',
      memberDeltas,
    };
    const currentWeek = weeks.get(snapshot.weekStartDate) ?? [];
    currentWeek.push(summary);
    weeks.set(snapshot.weekStartDate, currentWeek);
  }

  return {
    snapshots: normalizedSnapshots,
    weeks: [...weeks.entries()].map(([weekStartDate, summaries]) => ({
      weekStartDate,
      weekEndDate: Temporal.PlainDate.from(weekStartDate).add({ days: 6 }).toString(),
      summaries,
    })),
  };
}

function summarizePeriod(
  key: string,
  summaries: GuildDailySummary[],
  endDate: string,
  expectedDays: number,
): GuildHistoryPeriodSummary {
  const ordered = [...summaries].sort((a, b) =>
    a.snapshot.observationDate.localeCompare(b.snapshot.observationDate),
  );
  return {
    key,
    startDate: ordered[0]?.snapshot.observationDate ?? key,
    endDate,
    snapshotCount: ordered.length,
    daysObserved: new Set(ordered.map((summary) => summary.snapshot.observationDate)).size,
    dailyDailies: ordered.reduce((total, summary) => total + summary.dailyDailies, 0),
    dailyContribution: ordered.reduce((total, summary) => total + summary.dailyContribution, 0),
    dailyPoints: ordered.reduce((total, summary) => total + summary.dailyPoints, 0),
    levelsGained: ordered.reduce((total, summary) => total + summary.levelsGained, 0),
    membersJoined: ordered.reduce(
      (total, summary) =>
        total +
        summary.membershipEvents.filter(
          (event) => event.kind === 'joined' || event.kind === 'returned',
        ).length,
      0,
    ),
    membersLeft: ordered.reduce(
      (total, summary) =>
        total + summary.membershipEvents.filter((event) => event.kind === 'left').length,
      0,
    ),
    memberCountAtEnd: ordered.at(-1)?.memberCount ?? 0,
    complete: ordered.length >= expectedDays,
  };
}

export function summarizeGuildMemberWeek(
  history: GuildDailyHistory,
  weekStartDate: string,
  throughDate?: string | null,
): GuildMemberWeekActivity[] {
  const summaries =
    history.weeks
      .find((week) => week.weekStartDate === weekStartDate)
      ?.summaries.filter(
        (summary) => !throughDate || summary.snapshot.observationDate <= throughDate,
      ) ?? [];
  const activity = new Map<string, GuildMemberWeekActivity>();

  for (const summary of summaries) {
    for (const member of summary.memberDeltas) {
      const current = activity.get(member.memberKey) ?? {
        memberKey: member.memberKey,
        displayName: member.displayName,
        levelsGained: 0,
        levelChange: 0,
        dailyDailies: 0,
        dailyContribution: 0,
        dailyPoints: 0,
        membershipKind: member.membershipKind,
        firstObservedDate: member.firstObservedDate,
        membershipObservedDate: member.membershipObservedDate,
        dailyEligibleDate: member.dailyEligibleDate,
        contributionEligibleDate: member.contributionEligibleDate,
        dailyEligibility: member.dailyEligibility,
        contributionEligibility: member.contributionEligibility,
        eligibleDailyDays: member.eligibleDailyDays,
        eligibleContributionDays: member.eligibleContributionDays,
      };
      current.displayName = member.displayName;
      current.levelsGained += Math.max(0, member.levelDelta ?? 0);
      current.levelChange += member.levelDelta ?? 0;
      current.dailyDailies += member.dailyDailies;
      current.dailyContribution += member.dailyContribution;
      current.dailyPoints += member.dailyPoints;
      if (member.membershipKind !== 'existing') current.membershipKind = member.membershipKind;
      current.firstObservedDate = member.firstObservedDate;
      current.membershipObservedDate = member.membershipObservedDate;
      current.dailyEligibleDate = member.dailyEligibleDate;
      current.contributionEligibleDate = member.contributionEligibleDate;
      current.dailyEligibility = member.dailyEligibility;
      current.contributionEligibility = member.contributionEligibility;
      current.eligibleDailyDays = member.eligibleDailyDays;
      current.eligibleContributionDays = member.eligibleContributionDays;
      activity.set(member.memberKey, current);
    }
  }

  const activeMemberKeys = new Set(
    summaries.at(-1)?.memberDeltas.map((member) => member.memberKey) ?? [],
  );
  return [...activity.values()].filter((member) => activeMemberKeys.has(member.memberKey));
}

export function summarizeGuildDailyHistory(history: GuildDailyHistory): GuildHistoryOverview {
  const allSummaries = history.weeks
    .flatMap((week) => week.summaries)
    .sort((a, b) => a.snapshot.observationDate.localeCompare(b.snapshot.observationDate));
  const weeks = history.weeks
    .map((week) => summarizePeriod(week.weekStartDate, week.summaries, week.weekEndDate, 7))
    .sort((a, b) => a.key.localeCompare(b.key));
  const months = [
    ...new Set(allSummaries.map((summary) => summary.snapshot.observationDate.slice(0, 7))),
  ]
    .map((monthKey) => {
      const monthSummaries = allSummaries.filter((summary) =>
        summary.snapshot.observationDate.startsWith(monthKey),
      );
      const [year, month] = monthKey.split('-').map(Number);
      const monthEndDate = Temporal.PlainDate.from({ year, month, day: 1 })
        .add({ months: 1 })
        .subtract({ days: 1 })
        .toString();
      return summarizePeriod(
        monthKey,
        monthSummaries,
        monthEndDate,
        Number(monthEndDate.slice(8, 10)),
      );
    })
    .sort((a, b) => a.key.localeCompare(b.key));

  return {
    snapshotCount: allSummaries.length,
    weekCount: weeks.length,
    monthCount: months.length,
    firstObservationDate: allSummaries[0]?.snapshot.observationDate ?? null,
    lastObservationDate: allSummaries.at(-1)?.snapshot.observationDate ?? null,
    weeks,
    months,
    currentWeek: weeks.at(-1) ?? null,
    currentMonth: months.at(-1) ?? null,
  };
}

export function getGuildDailyGoalSummary(
  snapshot: GuildDailySnapshot,
  rawSettings: Partial<GuildPacingSettings> = {},
): ReturnType<typeof calculateGuildRanking> {
  return calculateGuildRanking(snapshot.payload, rawSettings, snapshot.sourceTimeZone);
}
