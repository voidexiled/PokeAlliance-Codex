import { Temporal } from '@js-temporal/polyfill';

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

export type GuildExportLocale = 'es' | 'en';

export type GuildDiscordHistorySummary = {
  observationDate: string;
  weekStartDate: string;
  dayIndex: number;
  dailyDailies: number;
  dailyContribution: number;
  dailyPoints: number;
  levelsGained?: number;
  membersJoined?: number;
  membersLeft?: number;
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

function parseSourceDateTime(value: string | null | undefined, timeZone: string): Temporal.Instant {
  if (!value) return Temporal.Now.instant();

  try {
    if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(value)) return Temporal.Instant.from(value);
    const normalized = value.replace(' ', 'T');
    return Temporal.PlainDateTime.from(normalized).toZonedDateTime(timeZone).toInstant();
  } catch {
    return Temporal.Now.instant();
  }
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

function memberMeetsGoals(
  member: RankedGuildMember,
  goals: GuildGoalSet,
  week: GuildWeekContext,
  elapsedDaysByMetric?: GuildMemberGoalPacing,
): boolean {
  const observed: Record<GuildGoalMetric, number> = {
    totalPoints: member.total,
    dailies: member.dailiesCompleted,
    contribution: member.contribution,
  };
  return (Object.entries(goals) as Array<[GuildGoalMetric, GuildGoalTarget]>)
    .filter(([, target]) => hasGoalTarget(target))
    .every(([metric, target]) => {
      const expected = getGuildGoalElapsedValue(
        target,
        elapsedDaysByMetric?.[metric] ?? week.elapsedDays,
      );
      return expected === null || observed[metric] >= expected;
    });
}

function hasMeasurableGoal(
  goals: GuildGoalSet,
  week: GuildWeekContext,
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

export function getGuildMemberBand(
  member: RankedGuildMember,
  ranking: Pick<GuildRanking, 'settings' | 'week'>,
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

export function formatGuildNumber(value: number, locale = 'pt-BR'): string {
  return value.toLocaleString(locale, { maximumFractionDigits: 2 });
}

export function formatGuildExportDate(value: string | null | undefined, locale = 'pt-BR'): string {
  const match = value?.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (match) return `${match[3].padStart(2, '0')}/${match[2].padStart(2, '0')}/${match[1]}`;
  if (!value) return new Intl.DateTimeFormat(locale, { dateStyle: 'short' }).format(new Date());
  return value;
}

export function formatGuildRank(rank: string | null | undefined): string {
  const labels: Record<string, string> = {
    'the Leader': 'Líder',
    'a Vice-Leader': 'Vice-Líder',
    'a Member': 'Membro',
    Leader: 'Líder',
    'Vice-Leader': 'Vice-Líder',
    Member: 'Membro',
  };
  return labels[rank ?? ''] ?? rank ?? '—';
}

function formatExportRank(rank: string | null | undefined, locale: GuildExportLocale): string {
  const formatted = formatGuildRank(rank);
  if (locale === 'es') {
    return formatted === 'Membro'
      ? 'Miembro'
      : formatted === 'Vice-Líder'
        ? 'Vice-líder'
        : formatted;
  }
  return formatted === 'Membro' ? 'Member' : formatted === 'Líder' ? 'Leader' : formatted;
}

function escapeWhatsAppText(value: string): string {
  return value.replace(/([*_~])/g, '\\$1');
}

function escapeDiscordMarkdown(value: string): string {
  return value.replace(/([\\`*_~|>])/g, '\\$1');
}

function formatExportDate(value: string | null | undefined, locale: GuildExportLocale): string {
  return formatGuildExportDate(value, locale === 'en' ? 'en-US' : 'es-ES');
}

function exportLabels(locale: GuildExportLocale) {
  return locale === 'es'
    ? {
        ranking: 'Ranking de guild',
        exportDate: 'Fecha del export',
        week: 'Semana',
        day: 'Día',
        timeZone: 'Zona horaria',
        members: 'Miembros',
        totalPoints: 'Puntos totales',
        dailyPoints: 'Puntos de dailies',
        contribution: 'Contribución',
        totalContribution: 'Contribución total',
        goals: 'Metas activas',
        standard: 'Normal',
        premium: 'Premium',
        dailyValue: 'Valor de cada daily',
        difficultyBreakdown: 'Desglose',
        normal: 'Normal',
        wildscape: 'Wildscape',
        primal: 'Primal',
        estimated: 'estimado',
        derivedContribution: 'Contribución calculada por nivel',
        accumulatedGoal: 'Meta acumulada al día',
        levelCalculated: 'contribución por nivel',
        rankingWeek: 'Ranking acumulado de la semana',
        level: 'Nivel',
        dailies: 'dailies',
        lastAccess: 'Último acceso',
        noRecord: 'Sin registro',
        online: 'En línea',
        generated: 'Generado por Alliance Codex · Ranking de guild',
        dailyRecord: 'Registro diario cargado',
        monthlyRecord: 'Resumen mensual con snapshots cargados',
        monthlyPending:
          'El ranking mensual aparecerá cuando existan snapshots diarios suficientes.',
        snapshots: 'snapshots',
        levelsGained: 'niveles ganados',
        membersJoined: 'altas/reingresos',
        membersLeft: 'bajas',
        block: 'Bloque',
      }
    : {
        ranking: 'Guild ranking',
        exportDate: 'Export date',
        week: 'Week',
        day: 'Day',
        timeZone: 'Time zone',
        members: 'Members',
        totalPoints: 'Total points',
        dailyPoints: 'Daily points',
        contribution: 'Contribution',
        totalContribution: 'Total contribution',
        goals: 'Active goals',
        standard: 'Standard',
        premium: 'Premium',
        dailyValue: 'Daily value',
        difficultyBreakdown: 'Breakdown',
        normal: 'Normal',
        wildscape: 'Wildscape',
        primal: 'Primal',
        estimated: 'estimated',
        derivedContribution: 'Contribution calculated by level',
        accumulatedGoal: 'Accumulated goal on day',
        levelCalculated: 'contribution by level',
        rankingWeek: 'Weekly accumulated ranking',
        level: 'Level',
        dailies: 'dailies',
        lastAccess: 'Last access',
        noRecord: 'No record',
        online: 'Online',
        generated: 'Generated by Alliance Codex · Guild ranking',
        dailyRecord: 'Loaded daily record',
        monthlyRecord: 'Monthly summary from loaded snapshots',
        monthlyPending: 'The monthly ranking will appear after enough daily snapshots exist.',
        snapshots: 'snapshots',
        levelsGained: 'levels gained',
        membersJoined: 'joins/returns',
        membersLeft: 'departures',
        block: 'Block',
      };
}

function formatExportGoalSet(goals: GuildGoalSet, locale: GuildExportLocale): string {
  return formatGuildGoalSet(goals, locale);
}

function formatExportTierSummary(
  locale: GuildExportLocale,
  tiers: readonly GuildDifficultyTier[] = GUILD_DAILY_VALUE_TIERS,
): string {
  const numberLocale = locale === 'en' ? 'en-US' : 'es-ES';
  const suffix = locale === 'en' ? 'level' : 'nivel';
  return tiers
    .map((tier) => {
      const range = `${tier.minimumLevel}${tier.maximumLevel === null ? '+' : `-${tier.maximumLevel}`}`;
      return `${suffix} ${range}: ${formatGuildNumber(tier.points, numberLocale)} pts`;
    })
    .join(' · ');
}

function formatExportDerivedContributionSummary(
  settings: GuildPacingSettings,
  locale: GuildExportLocale,
  tiers: readonly GuildDifficultyTier[] = GUILD_DAILY_VALUE_TIERS,
): string {
  const numberLocale = locale === 'en' ? 'en-US' : 'es-ES';
  const suffix = locale === 'en' ? '/day' : '/día';
  return tiers
    .map((tier) => {
      const derived = getGuildDerivedContributionPerDay(tier.minimumLevel, settings, tiers);
      const range = `${tier.minimumLevel}${tier.maximumLevel === null ? '+' : `-${tier.maximumLevel}`}`;
      return `${range}: ${derived === null ? '—' : `${formatGuildNumber(derived, numberLocale)}${suffix}`}`;
    })
    .join(' · ');
}

function formatExportDifficultyBreakdown(
  member: RankedGuildMember,
  locale: GuildExportLocale,
): string {
  const labels = exportLabels(locale);
  const numberLocale = locale === 'en' ? 'en-US' : 'es-ES';
  const parts = (['normal', 'wildscape', 'primal'] as const)
    .filter((difficulty) => member.difficultyAllocation[difficulty] > 0)
    .map(
      (difficulty) =>
        `${labels[difficulty]} ${formatGuildNumber(member.difficultyAllocation[difficulty], numberLocale)}`,
    );
  if (member.difficultyConfidence === 'estimated') parts.push(`(${labels.estimated})`);
  return parts.join(' · ') || '—';
}

function memberBandIcon(member: RankedGuildMember, ranking: GuildRanking): string {
  const band = getGuildMemberBand(member, ranking);
  return band === 'below' ? '🔴' : band === 'premium' ? '🔵' : '🟢';
}

export function buildGuildWhatsAppText(
  ranking: GuildRanking,
  locale: GuildExportLocale = 'es',
  difficultyTiers: readonly GuildDifficultyTier[] = GUILD_DAILY_VALUE_TIERS,
): string {
  const { payload, members, settings, week } = ranking;
  const labels = exportLabels(locale);
  const numberLocale = locale === 'en' ? 'en-US' : 'es-ES';
  const number = (value: number) => formatGuildNumber(value, numberLocale);
  const standardGoals = formatExportGoalSet(settings.standard, locale);
  const premiumGoals = formatExportGoalSet(settings.premium, locale);
  const weekStart = formatExportDate(week.weekStartDate, locale);
  const weekEnd = formatExportDate(week.weekEndDate, locale);
  const accumulatedContribution =
    ranking.expectedContribution === null
      ? labels.levelCalculated
      : `${number(ranking.expectedContribution)} ${labels.contribution.toLowerCase()}`;
  const lines = [
    `🏆 *${labels.ranking}: ${escapeWhatsAppText(payload.guild || 'Guild')}*`,
    `📅 *${labels.exportDate}:* ${formatExportDate(payload.exportedAt, locale)}`,
    `📆 *${labels.week}:* ${weekStart} → ${weekEnd} · *${labels.day}:* ${week.dayIndex}/${GUILD_WEEK_DAYS}`,
    `👥 *${labels.members}:* ${members.length} · *${labels.totalPoints}:* ${number(ranking.totalPoints)}`,
    `🎯 *${labels.dailyPoints}:* ${number(ranking.totalDailyPoints)} · 💰 *${labels.totalContribution}:* ${number(ranking.totalContribution)}`,
    '',
    `🎯 *${labels.goals}*`,
    `• 🟢 *${labels.standard}:* ${standardGoals || '—'}`,
    `• 🔵 *${labels.premium}:* ${premiumGoals || '—'}`,
    `• 🧮 *${labels.dailyValue}:* ${formatExportTierSummary(locale, difficultyTiers)}`,
    `• 💰 *${labels.derivedContribution}:* ${formatExportDerivedContributionSummary(settings, locale, difficultyTiers)}`,
    `• 📈 *${labels.accumulatedGoal} ${week.dayIndex}:* ${ranking.expectedMinimumPoints === null ? '—' : `${number(ranking.expectedMinimumPoints)} pts`} · ${ranking.expectedDailies === null ? '—' : `${number(ranking.expectedDailies)} ${labels.dailies}`} · ${accumulatedContribution}`,
    '',
    `📊 *${labels.rankingWeek}*`,
  ];

  for (const member of members) {
    const lastAccess =
      member.status === 'online' ? labels.online : member.lastLogin || labels.noRecord;
    const dailyValue =
      member.pointsPerDaily === null ? '—' : `${number(member.pointsPerDaily)} pts`;
    lines.push(
      `${memberBandIcon(member, ranking)} *#${member.position} · ${escapeWhatsAppText(member.name)}* — *${number(member.total)} pts*`,
      `   ${labels.level} ${member.level ?? '—'} · ${member.dailiesCompleted} ${labels.dailies} × ${dailyValue} · ${number(member.contribution)} ${labels.contribution.toLowerCase()}`,
      ...(member.levelsGained === undefined
        ? []
        : [`   +${number(member.levelsGained)} ${labels.levelsGained}`]),
      `   ${labels.difficultyBreakdown}: ${formatExportDifficultyBreakdown(member, locale)}`,
      `   ${formatExportRank(member.rank, locale)} · ${labels.lastAccess}: ${escapeWhatsAppText(lastAccess)}`,
    );
  }

  lines.push('', `_${labels.generated}_`);
  return lines.join('\n');
}

export function buildGuildDiscordText(
  ranking: GuildRanking,
  history: GuildDiscordHistorySummary[] = [],
  locale: GuildExportLocale = 'es',
  difficultyTiers: readonly GuildDifficultyTier[] = GUILD_DAILY_VALUE_TIERS,
): string {
  const { payload, members, settings, week } = ranking;
  const labels = exportLabels(locale);
  const numberLocale = locale === 'en' ? 'en-US' : 'es-ES';
  const number = (value: number) => formatGuildNumber(value, numberLocale);
  const weekStart = formatExportDate(week.weekStartDate, locale);
  const weekEnd = formatExportDate(week.weekEndDate, locale);
  const orderedHistory = [...history].sort((a, b) =>
    a.observationDate.localeCompare(b.observationDate),
  );
  const currentWeekHistory = orderedHistory.filter(
    (summary) => summary.weekStartDate === week.weekStartDate,
  );
  const latest = currentWeekHistory.at(-1);
  const monthKey = latest?.observationDate.slice(0, 7);
  const monthHistory = monthKey
    ? orderedHistory.filter((summary) => summary.observationDate.startsWith(monthKey))
    : [];
  const monthlyDailies = monthHistory.reduce((total, summary) => total + summary.dailyDailies, 0);
  const monthlyContribution = monthHistory.reduce(
    (total, summary) => total + summary.dailyContribution,
    0,
  );
  const monthlyPoints = monthHistory.reduce((total, summary) => total + summary.dailyPoints, 0);
  const lines = [
    `# 🏆 ${escapeDiscordMarkdown(payload.guild || 'Guild')} · ${labels.ranking}`,
    `> **${labels.week}:** ${weekStart} → ${weekEnd} · **${labels.day}:** ${week.dayIndex}/${GUILD_WEEK_DAYS}`,
    `> **${labels.exportDate}:** ${formatExportDate(payload.exportedAt, locale)} · **${labels.timeZone}:** ${week.sourceTimeZone}`,
    '',
    `## ${labels.ranking}`,
    `- **${labels.members}:** ${members.length} · **${labels.totalPoints}:** ${number(ranking.totalPoints)}`,
    `- **${labels.dailyPoints}:** ${number(ranking.totalDailyPoints)} · **${labels.totalContribution}:** ${number(ranking.totalContribution)}`,
    `- **${labels.accumulatedGoal} ${week.dayIndex}:** ${ranking.expectedMinimumPoints === null ? '—' : `${number(ranking.expectedMinimumPoints)} pts`} · ${ranking.expectedDailies === null ? '—' : `${number(ranking.expectedDailies)} ${labels.dailies}`} · ${ranking.expectedContribution === null ? labels.levelCalculated : `${number(ranking.expectedContribution)} ${labels.contribution.toLowerCase()}`}`,
    '',
    `## ${labels.goals}`,
    `- **${labels.standard}:** ${formatExportGoalSet(settings.standard, locale) || '—'}`,
    `- **${labels.premium}:** ${formatExportGoalSet(settings.premium, locale) || '—'}`,
    `- **${labels.dailyValue}:** ${formatExportTierSummary(locale, difficultyTiers)}`,
    `- **${labels.derivedContribution}:** ${formatExportDerivedContributionSummary(settings, locale, difficultyTiers)}`,
  ];

  if (latest) {
    lines.push('', `## ${labels.dailyRecord}`);
    for (const summary of currentWeekHistory.slice(-7)) {
      lines.push(
        `- **${formatExportDate(summary.observationDate, locale)} · ${labels.day} ${summary.dayIndex}:** ${summary.dailyDailies} ${labels.dailies} · ${number(summary.dailyContribution)} ${labels.contribution.toLowerCase()} · ${number(summary.dailyPoints)} pts · +${number(summary.levelsGained ?? 0)} ${labels.levelsGained} · ${summary.membersJoined ?? 0} ${labels.membersJoined} · ${summary.membersLeft ?? 0} ${labels.membersLeft}`,
      );
    }
    lines.push(
      '',
      `## ${labels.monthlyRecord}`,
      `- **${monthKey}:** ${monthHistory.length} ${labels.snapshots} · ${monthlyDailies} ${labels.dailies} · ${number(monthlyContribution)} ${labels.contribution.toLowerCase()} · ${number(monthlyPoints)} pts`,
    );
  } else {
    lines.push('', `> ${labels.monthlyPending}`);
  }

  lines.push('', `## ${labels.rankingWeek}`);
  for (const member of members) {
    const rank = formatExportRank(member.rank, locale);
    lines.push(
      `- ${memberBandIcon(member, ranking)} **#${member.position} · ${escapeDiscordMarkdown(member.name)}** — **${number(member.total)} pts** · ${member.dailiesCompleted} ${labels.dailies} · ${number(member.contribution)} ${labels.contribution.toLowerCase()} · +${number(member.levelsGained ?? 0)} ${labels.levelsGained} · ${labels.difficultyBreakdown}: ${formatExportDifficultyBreakdown(member, locale)} · ${labels.level} ${member.level ?? '—'} · ${escapeDiscordMarkdown(rank)}`,
    );
  }

  const chunks = splitDiscordLines(lines, 1800);
  const guildName = escapeDiscordMarkdown(payload.guild || 'Guild');
  return chunks
    .map((chunk, index) => {
      if (chunks.length === 1) return chunk;
      return `*${labels.block} ${index + 1}/${chunks.length} · ${guildName}*\n${chunk}`;
    })
    .join('\n\n---\n\n');
}

function splitDiscordLines(lines: string[], maxLength: number): string[] {
  const chunks: string[] = [];
  let current = '';
  for (const line of lines) {
    const candidate = current ? `${current}\n${line}` : line;
    if (current && candidate.length > maxLength) {
      chunks.push(current);
      current = line;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export function formatGuildGoalSet(
  goals: GuildGoalSet,
  locale: GuildExportLocale | 'pt-BR' = 'pt-BR',
): string {
  const labels: Record<GuildGoalMetric, string> =
    locale === 'es'
      ? {
          totalPoints: 'puntos totales',
          dailies: 'dailies',
          contribution: 'contribución',
        }
      : locale === 'en'
        ? {
            totalPoints: 'total points',
            dailies: 'dailies',
            contribution: 'contribution',
          }
        : {
            totalPoints: 'pontos totais',
            dailies: 'dailies',
            contribution: 'contribuição',
          };
  const numberLocale = locale === 'en' ? 'en-US' : locale === 'es' ? 'es-ES' : 'pt-BR';
  const dailySuffix = locale === 'en' ? '/day' : locale === 'es' ? '/día' : '/dia';
  const weeklySuffixLocalized = locale === 'en' ? '/week' : '/semana';
  return (Object.entries(goals) as Array<[GuildGoalMetric, GuildGoalTarget]>)
    .filter(([, target]) => target.daily !== null || target.weekly !== null)
    .map(([metric, target]) => {
      const values = [
        target.daily === null
          ? null
          : `${formatGuildNumber(target.daily, numberLocale)}${dailySuffix}`,
        target.weekly === null
          ? null
          : `${formatGuildNumber(target.weekly, numberLocale)}${weeklySuffixLocalized}`,
      ].filter((value): value is string => value !== null);
      return `${labels[metric]}: ${values.join(' + ')}`;
    })
    .join(' · ');
}
