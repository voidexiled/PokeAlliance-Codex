import { Temporal } from '@js-temporal/polyfill';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { GuildExportPayload } from '@/lib/tools/guild-ranking';
import { createGuildDailySnapshot, type GuildDailySnapshot } from '@/lib/tools/guild-daily-history';

export type SupabaseGuild = {
  guild_id: string;
  guild_key: string;
  world_key: string;
  display_name: string | null;
};

export type SupabaseDailyExport = {
  daily_export_id: string;
  guild_id: string;
  observation_date: string;
  week_start_date: string;
  exported_at: string;
  server_save_zone: string;
  source_locator: string;
  payload_digest: string;
  member_count: number;
  replaced_count: number;
};

export type SupabaseOperation<T> = {
  data: T | null;
  error: string | null;
};

export async function listUserGuilds(
  client: SupabaseClient,
): Promise<SupabaseOperation<SupabaseGuild[]>> {
  const { data, error } = await client
    .from('guilds')
    .select('guild_id,guild_key,world_key,display_name')
    .order('updated_at', { ascending: false });

  return {
    data: (data ?? []) as SupabaseGuild[],
    error: error?.message ?? null,
  };
}

export async function listGuildDailySnapshots(
  client: SupabaseClient,
  guild: SupabaseGuild,
): Promise<SupabaseOperation<GuildDailySnapshot[]>> {
  const { data: exportRows, error: exportError } = await client
    .from('guild_daily_exports')
    .select(
      'daily_export_id,guild_id,observation_date,week_start_date,exported_at,server_save_zone,source_locator,payload_digest,member_count,replaced_count',
    )
    .eq('guild_id', guild.guild_id)
    .order('observation_date', { ascending: true });

  if (exportError) {
    return { data: null, error: exportError.message };
  }

  const exports = (exportRows ?? []) as SupabaseDailyExport[];
  if (!exports.length) return { data: [], error: null };

  const { data: memberRows, error: memberError } = await client
    .from('guild_daily_member_totals')
    .select(
      'daily_export_id,source_member_key,observed_display_name,level,dailies_completed,rank,status,contribution,last_login_label',
    )
    .eq('guild_id', guild.guild_id)
    .in(
      'daily_export_id',
      exports.map((dailyExport) => dailyExport.daily_export_id),
    );

  if (memberError) {
    return { data: null, error: memberError.message };
  }

  const membersByExport = new Map<string, GuildExportPayload['members']>();
  for (const row of (memberRows ?? []) as Array<{
    daily_export_id: string;
    source_member_key: string;
    observed_display_name: string | null;
    level: number | null;
    dailies_completed: number;
    rank: string | null;
    status: string | null;
    contribution: number | string;
    last_login_label: string | null;
  }>) {
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
    data: exports.map((dailyExport) =>
      createGuildDailySnapshot(
        dailyExport.daily_export_id,
        {
          exportedAt: dailyExport.exported_at,
          guild: guild.display_name || guild.guild_key,
          members: membersByExport.get(dailyExport.daily_export_id) ?? [],
        },
        dailyExport.server_save_zone,
      ),
    ),
    error: null,
  };
}

export async function createUserGuild(
  client: SupabaseClient,
  input: { guildKey: string; worldKey: string; displayName: string },
): Promise<SupabaseOperation<SupabaseGuild>> {
  const { data, error } = await client.rpc('create_guild', {
    p_guild_key: input.guildKey,
    p_world_key: input.worldKey,
    p_display_name: input.displayName,
  });

  const raw = data as SupabaseGuild | SupabaseGuild[] | null;
  const guild = Array.isArray(raw) ? (raw[0] ?? null) : raw;
  return { data: guild, error: error?.message ?? null };
}

export async function replaceUserGuildDailyExport(
  client: SupabaseClient,
  input: {
    guildId: string;
    payload: GuildExportPayload;
    sourceLocator: string;
    payloadDigest: string;
    sourceTimeZone: string;
  },
): Promise<SupabaseOperation<SupabaseDailyExport>> {
  if (!input.payload.exportedAt) {
    return {
      data: null,
      error: 'El JSON necesita exportedAt para poder asociarse a un día de Server Save.',
    };
  }

  const exportedAt = toSupabaseInstant(input.payload.exportedAt, input.sourceTimeZone);
  if (!exportedAt) {
    return {
      data: null,
      error: 'El valor de exportedAt no tiene un formato de fecha reconocido.',
    };
  }

  const { data, error } = await client.rpc('replace_guild_daily_export', {
    p_guild_id: input.guildId,
    p_exported_at: exportedAt,
    p_source_locator: input.sourceLocator,
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
    p_source_snapshot_id: null,
  });

  const raw = data as SupabaseDailyExport | SupabaseDailyExport[] | null;
  const dailyExport = Array.isArray(raw) ? (raw[0] ?? null) : raw;
  return { data: dailyExport, error: error?.message ?? null };
}

function toSupabaseInstant(value: string, timeZone: string): string | null {
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(value.trim())) return value.trim();

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
