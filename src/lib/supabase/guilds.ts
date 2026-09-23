// The Guild page's Supabase calls (§10.4, §10.13): the account's guilds, their
// snapshots, «Metas y cálculo», the access header and snapshot import and
// deletion. The account page's calls (creating a guild, invitations, accounts)
// live in `account.ts`. The database enforces every permission
// (supabase/migrations/20260923150000_guild_admin.sql).
import { Temporal } from '@js-temporal/polyfill';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { SupabaseGuild } from '@/lib/supabase/account';
import { callRpc, firstRow } from '@/lib/supabase/client';
import { operationFailed, type SupabaseOperation } from '@/lib/supabase/errors';
import { SERVER_SAVE_ZONE } from '@/lib/time/server-save';
import { createGuildDailySnapshot, type GuildDailySnapshot } from '@/lib/tools/guild-daily-history';
import type { GuildDifficultyPolicy, GuildDifficultyTier } from '@/lib/tools/guild-difficulty';
import type {
  GuildExportPayload,
  GuildGoalSet,
  GuildPacingSettings,
} from '@/lib/tools/guild-ranking';

export type { SupabaseFailure, SupabaseOperation } from '@/lib/supabase/errors';

// The guilds of an account are read by both pages. They live in account.ts, which the account
// page loads without the Temporal polyfill that this module needs (§3.13).
export { listUserGuilds } from '@/lib/supabase/account';
export type { GuildRole, SupabaseGuild } from '@/lib/supabase/account';

export type SupabaseDailyExport = {
  daily_export_id: string;
  guild_id: string;
  observation_date: string;
  week_start_date: string;
  exported_at: string;
  server_save_zone: string;
  payload_digest: string;
  member_count: number;
  replaced_count: number;
};

/** A snapshot read from Supabase; `snapshotId` is its `daily_export_id`. */
export type RemoteGuildDailySnapshot = GuildDailySnapshot & { payloadDigest: string };

/** «Metas y cálculo» (§10.11) as `guild_settings` keeps it. */
export type GuildSettings = {
  goals: GuildPacingSettings;
  difficultyTiers: GuildDifficultyTier[];
  transitionPolicy: GuildDifficultyPolicy;
  /** 1 to 30. */
  inactivityDays: number;
};

export type SavedGuildSettings = GuildSettings & { updatedAt: string };

export type GuildAccessSummary = { owners: number; officers: number; members: number };

/** Failure codes of replaceUserGuildDailyExport that never reach the server. */
export const GUILD_EXPORT_DATE_ERRORS = {
  missing: 'missing_exported_at',
  invalid: 'invalid_exported_at',
} as const;

const EXPORT_COLUMNS =
  'daily_export_id,guild_id,observation_date,week_start_date,exported_at,server_save_zone,payload_digest,member_count,replaced_count';
const MEMBER_COLUMNS =
  'daily_export_id,source_member_key,observed_display_name,level,dailies_completed,rank,status,contribution,last_login_label';
const SETTINGS_COLUMNS = 'goals,difficulty_tiers,transition_policy,inactivity_days,updated_at';
/** PostgREST `max_rows` (supabase/config.toml and hosted projects): one page per request. */
const PAGE_SIZE = 1000;
/** Snapshot ids per request, so the `in` filter keeps the URL short. */
const EXPORT_ID_CHUNK = 100;

type MemberTotalRow = {
  daily_export_id: string;
  source_member_key: string;
  observed_display_name: string | null;
  level: number | null;
  dailies_completed: number;
  rank: string | null;
  status: string | null;
  contribution: number | string;
  last_login_label: string | null;
};

type SettingsRow = {
  goals: GuildPacingSettings;
  difficulty_tiers: GuildDifficultyTier[];
  transition_policy: GuildDifficultyPolicy;
  inactivity_days: number;
  updated_at: string;
};

function assertPlainDate(value: string, name: string): void {
  try {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      Temporal.PlainDate.from(value, { overflow: 'reject' });
      return;
    }
  } catch {
    // Reported below.
  }
  throw new RangeError(`${name} must be an ISO date (YYYY-MM-DD), got "${value}".`);
}

// The table's check constraints enforce the shape.
function toSavedSettings(row: SettingsRow): SavedGuildSettings {
  return {
    goals: row.goals,
    difficultyTiers: row.difficulty_tiers,
    transitionPolicy: row.transition_policy,
    inactivityDays: row.inactivity_days,
    updatedAt: row.updated_at,
  };
}

/**
 * Snapshots of a guild with `observation_date >= from` (§10.13 «Carga»: the
 * caller passes the Monday of the week of D−34, and an earlier date when
 * «Rango» asks for more). Throws a RangeError when `from` is not an ISO date.
 */
export async function listGuildDailySnapshots(
  client: SupabaseClient,
  guild: Pick<SupabaseGuild, 'guild_id' | 'guild_key' | 'display_name'>,
  { from }: { from: string },
): Promise<SupabaseOperation<RemoteGuildDailySnapshot[]>> {
  assertPlainDate(from, 'from');

  const exportsResult = await client
    .from('guild_daily_exports')
    .select(EXPORT_COLUMNS)
    .eq('guild_id', guild.guild_id)
    .gte('observation_date', from)
    .order('observation_date', { ascending: true });

  if (exportsResult.error) return operationFailed(exportsResult.error, exportsResult.status);

  const exports = (exportsResult.data ?? []) as SupabaseDailyExport[];
  if (!exports.length) return { data: [], error: null };

  const exportIds = exports.map((dailyExport) => dailyExport.daily_export_id);
  const memberRows: MemberTotalRow[] = [];
  for (let start = 0; start < exportIds.length; start += EXPORT_ID_CHUNK) {
    const chunk = exportIds.slice(start, start + EXPORT_ID_CHUNK);
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const page = await client
        .from('guild_daily_member_totals')
        .select(MEMBER_COLUMNS)
        .eq('guild_id', guild.guild_id)
        .in('daily_export_id', chunk)
        .order('daily_export_id', { ascending: true })
        .order('guild_member_id', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);

      if (page.error) return operationFailed(page.error, page.status);

      const rows = (page.data ?? []) as MemberTotalRow[];
      memberRows.push(...rows);
      if (rows.length < PAGE_SIZE) break;
    }
  }

  const membersByExport = new Map<string, GuildExportPayload['members']>();
  for (const row of memberRows) {
    const members = membersByExport.get(row.daily_export_id) ?? [];
    const contribution = Number(row.contribution);
    members.push({
      name: row.observed_display_name || row.source_member_key,
      level: row.level,
      dailiesCompleted: row.dailies_completed,
      rank: row.rank,
      status: row.status,
      contribution: Number.isFinite(contribution) ? contribution : 0,
      lastLogin: row.last_login_label,
    });
    membersByExport.set(row.daily_export_id, members);
  }

  return {
    data: exports.map((dailyExport) => ({
      ...createGuildDailySnapshot(
        dailyExport.daily_export_id,
        {
          exportedAt: dailyExport.exported_at,
          guild: guild.display_name || guild.guild_key,
          members: membersByExport.get(dailyExport.daily_export_id) ?? [],
        },
        dailyExport.server_save_zone,
      ),
      payloadDigest: dailyExport.payload_digest,
    })),
    error: null,
  };
}

/** Saved settings, or null when the guild still uses the defaults. */
export async function getGuildSettings(
  client: SupabaseClient,
  guildId: string,
): Promise<SupabaseOperation<SavedGuildSettings | null>> {
  const { data, error, status } = await client
    .from('guild_settings')
    .select(SETTINGS_COLUMNS)
    .eq('guild_id', guildId)
    .maybeSingle();

  if (error) return operationFailed(error, status);
  return { data: data ? toSavedSettings(data as SettingsRow) : null, error: null };
}

function goalSetPayload(set: GuildGoalSet): GuildGoalSet {
  return {
    totalPoints: { daily: set.totalPoints.daily ?? null, weekly: set.totalPoints.weekly ?? null },
    dailies: { daily: set.dailies.daily ?? null, weekly: set.dailies.weekly ?? null },
    contribution: {
      daily: set.contribution.daily ?? null,
      weekly: set.contribution.weekly ?? null,
    },
  };
}

/** «Guardar» in «Metas y cálculo» (owner and officer). The database validates every field. */
export async function saveGuildSettings(
  client: SupabaseClient,
  guildId: string,
  settings: GuildSettings,
): Promise<SupabaseOperation<SavedGuildSettings | null>> {
  return callRpc<unknown, SavedGuildSettings | null>(
    client,
    'set_guild_settings',
    {
      p_guild_id: guildId,
      // Rebuilt key by key: the database accepts exactly these keys.
      p_goals: {
        standard: goalSetPayload(settings.goals.standard),
        premium: goalSetPayload(settings.goals.premium),
      },
      p_difficulty_tiers: settings.difficultyTiers.map((tier) => ({
        difficulty: tier.difficulty,
        minimumLevel: tier.minimumLevel,
        maximumLevel: tier.maximumLevel ?? null,
        points: tier.points,
      })),
      p_transition_policy: settings.transitionPolicy,
      p_inactivity_days: settings.inactivityDays,
    },
    (data) => {
      const row = firstRow<SettingsRow>(data);
      return row ? toSavedSettings(row) : null;
    },
  );
}

/** Accounts per role for «Acceso: propietario y N oficiales»; null outside the guild. */
export async function getGuildAccessSummary(
  client: SupabaseClient,
  guildId: string,
): Promise<SupabaseOperation<GuildAccessSummary | null>> {
  return callRpc<unknown, GuildAccessSummary | null>(
    client,
    'guild_access_summary',
    { p_guild_id: guildId },
    (data) => {
      const row = firstRow<GuildAccessSummary>(data);
      return row ? { owners: row.owners, officers: row.officers, members: row.members } : null;
    },
  );
}

/**
 * «Eliminar» in «Cortes» (owner and officer). False when that date has no
 * snapshot. Throws a RangeError when the date is not an ISO date.
 */
export async function deleteGuildDailyExport(
  client: SupabaseClient,
  guildId: string,
  observationDate: string,
): Promise<SupabaseOperation<boolean>> {
  assertPlainDate(observationDate, 'observationDate');
  return callRpc<boolean | null, boolean>(
    client,
    'delete_guild_daily_export',
    { p_guild_id: guildId, p_observation_date: observationDate },
    Boolean,
  );
}

const LEGACY_SIGNATURE_ERROR = 'PGRST202';
const LEGACY_SOURCE_LOCATOR = 'guild-export';

/**
 * Saves an export as the guild's snapshot of its Server Save date (owner and
 * officer), replacing the one of that date. An `exportedAt` without an offset
 * is read in `sourceTimeZone`, America/Sao_Paulo unless given (§10.10).
 */
export async function replaceUserGuildDailyExport(
  client: SupabaseClient,
  input: {
    guildId: string;
    payload: GuildExportPayload;
    payloadDigest: string;
    sourceTimeZone?: string;
  },
): Promise<SupabaseOperation<SupabaseDailyExport>> {
  if (!input.payload.exportedAt) {
    return { data: null, error: { code: GUILD_EXPORT_DATE_ERRORS.missing, network: false } };
  }

  const exportedAt = toSupabaseInstant(
    input.payload.exportedAt,
    input.sourceTimeZone ?? SERVER_SAVE_ZONE,
  );
  if (!exportedAt) {
    return { data: null, error: { code: GUILD_EXPORT_DATE_ERRORS.invalid, network: false } };
  }

  const args = {
    p_guild_id: input.guildId,
    p_exported_at: exportedAt,
    p_payload_digest: input.payloadDigest,
    p_members: input.payload.members.map((member) => ({
      name: member.name,
      level: member.level ?? null,
      dailiesCompleted: member.dailiesCompleted ?? 0,
      rank: member.rank ?? null,
      status: member.status ?? null,
      contribution: member.contribution ?? 0,
      lastLogin: member.lastLogin ?? null,
    })),
  };
  let { data, error, status } = await client.rpc('replace_guild_daily_export', args);
  // Until supabase/migrations/20260918220000_remove_provenance.sql is applied,
  // the database function still requires p_source_locator (PostgREST answers
  // PGRST202). It gets a fixed label, never the file name. Remove this retry
  // once the migration is live (OG-1).
  if (error?.code === LEGACY_SIGNATURE_ERROR) {
    ({ data, error, status } = await client.rpc('replace_guild_daily_export', {
      ...args,
      p_source_locator: LEGACY_SOURCE_LOCATOR,
    }));
  }

  if (error) return operationFailed(error, status);
  return { data: firstRow<SupabaseDailyExport>(data), error: null };
}

/**
 * Server Save date the database files an export under (the same conversion
 * replace_guild_daily_export does), or null when exportedAt is missing or
 * unreadable.
 */
export function serverSaveDateOf(
  exportedAt: string | null | undefined,
  sourceTimeZone: string = SERVER_SAVE_ZONE,
): string | null {
  if (!exportedAt) return null;
  const instant = toSupabaseInstant(exportedAt, sourceTimeZone);
  if (!instant) return null;
  try {
    return Temporal.Instant.from(instant)
      .toZonedDateTimeISO(SERVER_SAVE_ZONE)
      .toPlainDate()
      .toString();
  } catch {
    return null;
  }
}

function toSupabaseInstant(value: string, timeZone: string): string | null {
  if (/(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(value.trim())) return value.trim();

  try {
    return Temporal.PlainDateTime.from(value.trim().replace(' ', 'T'))
      .toZonedDateTime(timeZone)
      .toInstant()
      .toString();
  } catch {
    return null;
  }
}

export async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);

  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
