import { Temporal } from '@js-temporal/polyfill';

import { UNKNOWN } from '@/lib/format/unknown';
import { SERVER_SAVE_ZONE } from '@/lib/time/server-save';
import {
  DEFAULT_GUILD_DIFFICULTY_TIERS,
  estimateGuildDifficultyAllocation,
  getGuildDifficultyForLevel,
  isValidGuildDifficultyAllocation,
  pointsForGuildDifficultyAllocation,
  type GuildDifficultyAllocation,
  type GuildDifficultyConfidence,
  type GuildDifficultyTier,
  type GuildDifficultyTransition,
} from './guild-difficulty';

export const GUILD_WEEK_DAYS = 7;

export const GUILD_DAILY_VALUE_TIERS = [
  { band: 'standard', difficulty: 'normal', minimumLevel: 0, maximumLevel: 149, points: 150 },
  {
    band: 'wildscape',
    difficulty: 'wildscape',
    minimumLevel: 150,
    maximumLevel: 349,
    points: 300,
  },
  { band: 'primal', difficulty: 'primal', minimumLevel: 350, maximumLevel: null, points: 600 },
] as const satisfies readonly (GuildDifficultyTier & { band: string })[];

export type GuildDailyValueBand = (typeof GUILD_DAILY_VALUE_TIERS)[number]['band'] | 'unknown';

export type GuildGoalMetric = 'totalPoints' | 'dailies' | 'contribution';

export type GuildGoalTarget = {
  daily: number | null;
  weekly: number | null;
};

export type GuildGoalSet = Record<GuildGoalMetric, GuildGoalTarget>;

export type GuildPacingSettings = {
  standard: GuildGoalSet;
  premium: GuildGoalSet;
};

export const DEFAULT_GUILD_PACING: GuildPacingSettings = {
  standard: {
    totalPoints: { daily: null, weekly: 2950 },
    dailies: { daily: 1, weekly: null },
    contribution: { daily: null, weekly: null },
  },
  premium: {
    totalPoints: { daily: null, weekly: 5900 },
    dailies: { daily: null, weekly: null },
    contribution: { daily: null, weekly: null },
  },
};

export type GuildMemberExport = {
  level?: number | null;
  dailiesCompleted?: number | null;
  rank?: string | null;
  status?: string | null;
  contribution?: number | null;
  name: string;
  lastLogin?: string | null;
};

export type GuildExportPayload = {
  exportedAt?: string | null;
  members: GuildMemberExport[];
  guild?: string | null;
};

export type GuildWeekContext = {
  sourceTimeZone: string;
  sourceInstant: string;
  sourceLocalDateTime: string;
  weekStartDate: string;
  weekEndDate: string;
  dayIndex: number;
  elapsedDays: number;
  remainingDays: number;
};

export type RankedGuildMember = GuildMemberExport & {
  level: number | null;
  dailiesCompleted: number;
  contribution: number;
  pointsPerDaily: number | null;
  dailyValueBand: GuildDailyValueBand;
  dailyPoints: number;
  difficultyAllocation: GuildDifficultyAllocation;
  difficultyConfidence: GuildDifficultyConfidence;
  difficultyTransition: GuildDifficultyTransition | null;
  derivedContributionPerDay: number | null;
  levelsGained?: number;
  goalPacing?: GuildMemberGoalPacing;
  total: number;
  position: number;
};

export type GuildMemberBand = 'below' | 'goal' | 'premium' | 'neutral';

export type GuildMemberGoalPacing = Partial<Record<GuildGoalMetric, number>>;

export type GuildGoalEvaluation = {
  metric: GuildGoalMetric;
  observed: number;
  expected: number;
  meets: boolean;
};

export type GuildRanking = {
  payload: GuildExportPayload;
  settings: GuildPacingSettings;
  week: GuildWeekContext;
  members: RankedGuildMember[];
  totalPoints: number;
  totalDailyPoints: number;
  totalContribution: number;
  weeklyMinimumPoints: number | null;
  expectedDailies: number | null;
  expectedContribution: number | null;
  expectedMinimumPoints: number | null;
};

/** What goal evaluation reads from a member: the week totals and, optionally, their pacing. */
export type GuildGoalSubject = Pick<
  RankedGuildMember,
  'total' | 'dailiesCompleted' | 'contribution' | 'goalPacing'
>;

/** The goals and the elapsed days that a member's week is evaluated against. */
export type GuildGoalContext = {
  settings: GuildPacingSettings;
  week: Pick<GuildWeekContext, 'elapsedDays'>;
};

export type GuildSortKey =
  | 'position'
  | 'name'
  | 'rank'
  | 'level'
  | 'lastLogin'
  | 'contribution'
  | 'dailiesCompleted'
  | 'dailyPoints'
  | 'total';

export type GuildSortDirection = 'asc' | 'desc';

export type GuildRankingOptions = {
  difficultyTiers?: readonly GuildDifficultyTier[];
  difficultyOverrides?: Record<string, GuildDifficultyAllocation | undefined>;
};

type ParseErrorCode =
  | 'invalid_json'
  | 'invalid_root'
  | 'members_missing'
  | 'member_name_missing'
  | 'member_number_invalid'
  | 'duplicate_member';

export type GuildParseResult =
  | { ok: true; payload: GuildExportPayload }
  | { ok: false; code: ParseErrorCode; memberIndex?: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readOptionalNumber(value: unknown, allowNull = true): number | null | undefined {
  if (value === undefined || (allowNull && value === null)) return value as null | undefined;
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value < 0
  ) {
    return undefined;
  }
  return value;
}

function isValidOptionalNumber(value: unknown, allowNull = true): boolean {
  return (
    value === undefined ||
    (allowNull && value === null) ||
    (typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value >= 0)
  );
}

function normalizeName(value: string): string {
  return value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase();
}

export function parseGuildExport(value: unknown): GuildParseResult {
  if (!isRecord(value)) return { ok: false, code: 'invalid_root' };
  if (!Array.isArray(value.members)) return { ok: false, code: 'members_missing' };

  const names = new Set<string>();
  const members: GuildMemberExport[] = [];

  for (const [memberIndex, candidate] of value.members.entries()) {
    if (!isRecord(candidate) || typeof candidate.name !== 'string' || !candidate.name.trim()) {
      return { ok: false, code: 'member_name_missing', memberIndex };
    }

    const name = candidate.name.trim();
    const normalizedName = normalizeName(name);
    if (names.has(normalizedName)) return { ok: false, code: 'duplicate_member', memberIndex };
    names.add(normalizedName);

    const level = readOptionalNumber(candidate.level);
    const dailiesCompleted = readOptionalNumber(candidate.dailiesCompleted);
    const contribution = readOptionalNumber(candidate.contribution);
    if (
      !isValidOptionalNumber(candidate.level) ||
      !isValidOptionalNumber(candidate.dailiesCompleted) ||
      !isValidOptionalNumber(candidate.contribution)
    ) {
      return { ok: false, code: 'member_number_invalid', memberIndex };
    }

    members.push({
      name,
      level: level ?? null,
      dailiesCompleted: dailiesCompleted ?? 0,
      contribution: contribution ?? 0,
      rank: typeof candidate.rank === 'string' ? candidate.rank : null,
      status: typeof candidate.status === 'string' ? candidate.status : null,
      lastLogin: typeof candidate.lastLogin === 'string' ? candidate.lastLogin : null,
    });
  }

  return {
    ok: true,
    payload: {
      members,
      exportedAt: typeof value.exportedAt === 'string' ? value.exportedAt : null,
      guild: typeof value.guild === 'string' ? value.guild : null,
    },
  };
}

export function parseGuildExportText(text: string): GuildParseResult {
  try {
    return parseGuildExport(JSON.parse(text));
  } catch {
    return { ok: false, code: 'invalid_json' };
  }
}

/**
 * The instant of an export's `exportedAt`. A value without a zone is read in the
 * Server Save zone (A12). Null when it is missing or is not a date.
 */
export function parseGuildExportedAt(
  value: string | null | undefined,
  timeZone = SERVER_SAVE_ZONE,
): Temporal.Instant | null {
  if (!value) return null;

  try {
    if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(value)) return Temporal.Instant.from(value);
    const normalized = value.replace(' ', 'T');
    return Temporal.PlainDateTime.from(normalized).toZonedDateTime(timeZone).toInstant();
  } catch {
    return null;
  }
}

function parseSourceDateTime(value: string | null | undefined, timeZone: string): Temporal.Instant {
  return parseGuildExportedAt(value, timeZone) ?? Temporal.Now.instant();
}

export function getGuildWeekContext(
  exportedAt: string | null | undefined,
  sourceTimeZone = SERVER_SAVE_ZONE,
): GuildWeekContext {
  const sourceInstant = parseSourceDateTime(exportedAt, sourceTimeZone);
  const local = sourceInstant.toZonedDateTimeISO(sourceTimeZone);
  const localDate = local.toPlainDate();
  const daysFromMonday = localDate.dayOfWeek - 1;
  const weekStart = localDate.subtract({ days: daysFromMonday });
  const weekEnd = weekStart.add({ days: GUILD_WEEK_DAYS - 1 });
  const dayIndex = daysFromMonday + 1;

  return {
    sourceTimeZone,
    sourceInstant: sourceInstant.toString(),
    sourceLocalDateTime: local.toPlainDateTime().toString({ smallestUnit: 'second' }),
    weekStartDate: weekStart.toString(),
    weekEndDate: weekEnd.toString(),
    dayIndex,
    elapsedDays: dayIndex,
    remainingDays: GUILD_WEEK_DAYS - dayIndex,
  };
}

export function normalizePacingSettings(
  settings: Partial<GuildPacingSettings>,
): GuildPacingSettings {
  const normalizeTarget = (
    value: Partial<GuildGoalTarget> | null | undefined,
    fallback: GuildGoalTarget,
  ): GuildGoalTarget => ({
    daily: normalizeGoalValue(value?.daily, fallback.daily),
    weekly: normalizeGoalValue(value?.weekly, fallback.weekly),
  });
  const normalizeSet = (
    value: Partial<GuildGoalSet> | null | undefined,
    fallback: GuildGoalSet,
  ): GuildGoalSet => ({
    totalPoints: normalizeTarget(value?.totalPoints, fallback.totalPoints),
    dailies: normalizeTarget(value?.dailies, fallback.dailies),
    contribution: normalizeTarget(value?.contribution, fallback.contribution),
  });

  return {
    standard: normalizeSet(settings.standard, DEFAULT_GUILD_PACING.standard),
    premium: normalizeSet(settings.premium, DEFAULT_GUILD_PACING.premium),
  };
}

function normalizeGoalValue(value: unknown, fallback: number | null): number | null {
  if (value === null) return null;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}

export function getGuildDailyValue(
  level: number | null | undefined,
  tiers: readonly GuildDifficultyTier[] = GUILD_DAILY_VALUE_TIERS,
): {
  band: GuildDailyValueBand;
  points: number | null;
  difficulty: GuildDifficultyTier['difficulty'] | null;
} {
  if (level === null || level === undefined || !Number.isFinite(level) || level < 0) {
    return { band: 'unknown', points: null, difficulty: null };
  }

  const tier = getGuildDifficultyForLevel(level, tiers);
  return tier
    ? {
        band: tier.difficulty === 'normal' ? 'standard' : tier.difficulty,
        points: tier.points,
        difficulty: tier.difficulty,
      }
    : { band: 'unknown', points: null, difficulty: null };
}

export function getGuildGoalWeeklyValue(target: GuildGoalTarget): number | null {
  const candidates = [
    target.weekly,
    target.daily === null ? null : target.daily * GUILD_WEEK_DAYS,
  ].filter((value): value is number => value !== null);
  return candidates.length ? Math.max(...candidates) : null;
}

export function getGuildGoalElapsedValue(
  target: GuildGoalTarget,
  elapsedDays: number,
): number | null {
  const candidates = [
    target.daily === null ? null : target.daily * elapsedDays,
    target.weekly === null ? null : (target.weekly * elapsedDays) / GUILD_WEEK_DAYS,
  ].filter((value): value is number => value !== null);
  return candidates.length ? Math.max(...candidates) : null;
}

export function getGuildDerivedContributionPerDay(
  level: number | null | undefined,
  settings: GuildPacingSettings,
  tiers: readonly GuildDifficultyTier[] = DEFAULT_GUILD_DIFFICULTY_TIERS,
): number | null {
  const totalGoal = getGuildGoalWeeklyValue(settings.standard.totalPoints);
  const dailiesGoal = getGuildGoalWeeklyValue(settings.standard.dailies);
  const dailyValue = getGuildDifficultyForLevel(level, tiers)?.points ?? null;
  if (totalGoal === null || dailiesGoal === null || dailyValue === null) return null;
  return Math.max(0, (totalGoal - dailiesGoal * dailyValue) / GUILD_WEEK_DAYS);
}

function hasGoalTarget(target: GuildGoalTarget): boolean {
  return target.daily !== null || target.weekly !== null;
}

function hasGoalSet(goals: GuildGoalSet): boolean {
  return Object.values(goals).some(hasGoalTarget);
}

export function getGuildMemberGoalEvaluations(
  member: GuildGoalSubject,
  goals: GuildGoalSet,
  week: GuildGoalContext['week'],
  elapsedDaysByMetric?: GuildMemberGoalPacing,
): GuildGoalEvaluation[] {
  const observed: Record<GuildGoalMetric, number> = {
    totalPoints: member.total,
    dailies: member.dailiesCompleted,
    contribution: member.contribution,
  };
  return (Object.entries(goals) as Array<[GuildGoalMetric, GuildGoalTarget]>)
    .filter(([, target]) => hasGoalTarget(target))
    .flatMap(([metric, target]) => {
      const expected = getGuildGoalElapsedValue(
        target,
        elapsedDaysByMetric?.[metric] ?? week.elapsedDays,
      );
      return expected === null
        ? []
        : [{ metric, observed: observed[metric], expected, meets: observed[metric] >= expected }];
    });
}

function memberMeetsGoals(
  member: GuildGoalSubject,
  goals: GuildGoalSet,
  week: GuildGoalContext['week'],
  elapsedDaysByMetric?: GuildMemberGoalPacing,
): boolean {
  return getGuildMemberGoalEvaluations(member, goals, week, elapsedDaysByMetric).every(
    ({ meets }) => meets,
  );
}

function hasMeasurableGoal(
  goals: GuildGoalSet,
  week: GuildGoalContext['week'],
  elapsedDaysByMetric?: GuildMemberGoalPacing,
): boolean {
  return (Object.entries(goals) as Array<[GuildGoalMetric, GuildGoalTarget]>).some(
    ([metric, target]) =>
      hasGoalTarget(target) &&
      (getGuildGoalElapsedValue(target, elapsedDaysByMetric?.[metric] ?? week.elapsedDays) ?? 0) >
        0,
  );
}

export function calculateGuildRanking(
  payload: GuildExportPayload,
  rawSettings: Partial<GuildPacingSettings> = {},
  sourceTimeZone = SERVER_SAVE_ZONE,
  options: GuildRankingOptions = {},
): GuildRanking {
  const settings = normalizePacingSettings(rawSettings);
  const week = getGuildWeekContext(payload.exportedAt, sourceTimeZone);
  const difficultyTiers = options.difficultyTiers ?? DEFAULT_GUILD_DIFFICULTY_TIERS;
  const observationDate = week.sourceLocalDateTime.slice(0, 10);
  const weeklyMinimumPoints = getGuildGoalWeeklyValue(settings.standard.totalPoints);
  const expectedDailies = getGuildGoalElapsedValue(settings.standard.dailies, week.elapsedDays);
  const expectedContribution = getGuildGoalElapsedValue(
    settings.standard.contribution,
    week.elapsedDays,
  );
  const expectedMinimumPoints = getGuildGoalElapsedValue(
    settings.standard.totalPoints,
    week.elapsedDays,
  );
  const members = [...payload.members]
    .map((member) => {
      const level = member.level ?? null;
      const dailyValue = getGuildDailyValue(level, difficultyTiers);
      const dailiesCompleted = member.dailiesCompleted ?? 0;
      const contribution = member.contribution ?? 0;
      const overrideKey = `${observationDate}:${member.name
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase()}`;
      const override = options.difficultyOverrides?.[overrideKey];
      const automatic = estimateGuildDifficultyAllocation(
        dailiesCompleted,
        level,
        null,
        'current',
        difficultyTiers,
      );
      const difficultyAllocation = isValidGuildDifficultyAllocation(override, dailiesCompleted)
        ? override
        : automatic.allocation;
      const difficultyConfidence = isValidGuildDifficultyAllocation(override, dailiesCompleted)
        ? 'manual'
        : automatic.confidence;
      const dailyPoints = pointsForGuildDifficultyAllocation(difficultyAllocation, difficultyTiers);
      return {
        ...member,
        level,
        dailiesCompleted,
        contribution,
        pointsPerDaily: dailyValue.points,
        dailyValueBand: dailyValue.band,
        dailyPoints,
        difficultyAllocation,
        difficultyConfidence,
        difficultyTransition: automatic.transition,
        derivedContributionPerDay: getGuildDerivedContributionPerDay(
          level,
          settings,
          difficultyTiers,
        ),
        total: dailyPoints + contribution,
        position: 0,
      };
    })
    .sort(
      (a, b) =>
        b.total - a.total || b.contribution - a.contribution || a.name.localeCompare(b.name),
    );

  members.forEach((member, index) => {
    member.position = index + 1;
  });

  return {
    payload,
    settings,
    week,
    members,
    totalPoints: members.reduce((total, member) => total + member.total, 0),
    totalDailyPoints: members.reduce((total, member) => total + member.dailyPoints, 0),
    totalContribution: members.reduce((total, member) => total + member.contribution, 0),
    weeklyMinimumPoints,
    expectedDailies,
    expectedContribution,
    expectedMinimumPoints,
  };
}

export function sortGuildMembers(
  members: RankedGuildMember[],
  key: GuildSortKey,
  direction: GuildSortDirection,
): RankedGuildMember[] {
  const factor = direction === 'asc' ? 1 : -1;
  return [...members].sort((a, b) => {
    if (key === 'name' || key === 'rank' || key === 'lastLogin') {
      return factor * String(a[key] ?? '').localeCompare(String(b[key] ?? ''), 'es');
    }
    return factor * (Number(a[key] ?? 0) - Number(b[key] ?? 0));
  });
}

/**
 * The goal band of a member's week. Pass the member's pacing (eligible days per
 * metric) so a member who joined mid-week is judged on the days they could play;
 * the Guild interface, its member dialog and the PNG all read it this way.
 */
export function getGuildMemberBand(
  member: GuildGoalSubject,
  ranking: GuildGoalContext,
  elapsedDaysByMetric?: GuildMemberGoalPacing,
): GuildMemberBand {
  const goalPacing = elapsedDaysByMetric ?? member.goalPacing;
  if (
    hasGoalSet(ranking.settings.premium) &&
    hasMeasurableGoal(ranking.settings.premium, ranking.week, goalPacing) &&
    memberMeetsGoals(member, ranking.settings.premium, ranking.week, goalPacing)
  ) {
    return 'premium';
  }
  if (hasGoalSet(ranking.settings.standard)) {
    if (!hasMeasurableGoal(ranking.settings.standard, ranking.week, goalPacing)) {
      return 'neutral';
    }
    return memberMeetsGoals(member, ranking.settings.standard, ranking.week, goalPacing)
      ? 'goal'
      : 'below';
  }
  return 'neutral';
}

/** The ranks the export writes with an article, as the game client shows them. */
const CLIENT_RANKS: Record<string, string> = {
  'the Leader': 'Leader',
  'a Vice-Leader': 'Vice-Leader',
  'a Member': 'Member',
};

/**
 * The rank as the game client names it, without the export's article. The same
 * words in es and en (E13): never «Líder» nor «Membro». Any other value is shown
 * as it came; a missing one is the dash.
 */
export function formatGuildRank(rank: string | null | undefined): string {
  const value = rank?.trim();
  if (!value) return UNKNOWN;
  return CLIENT_RANKS[value] ?? value;
}
