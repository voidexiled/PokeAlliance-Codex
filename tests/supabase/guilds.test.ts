import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

import {
  deleteGuildDailyExport,
  getGuildAccessSummary,
  listGuildDailySnapshots,
  replaceUserGuildDailyExport,
  saveGuildSettings,
  serverSaveDateOf,
} from '@/lib/supabase/guilds';
import { DEFAULT_GUILD_DIFFICULTY_TIERS } from '@/lib/tools/guild-difficulty';
import { DEFAULT_GUILD_PACING } from '@/lib/tools/guild-ranking';

type Response = { data: unknown; error: { code: string; message: string } | null; status?: number };

const savedRow = {
  daily_export_id: 'export-1',
  guild_id: 'guild-1',
  observation_date: '2026-09-18',
  week_start_date: '2026-09-14',
  exported_at: '2026-09-18T15:00:00Z',
  server_save_zone: 'America/Sao_Paulo',
  payload_digest: 'a'.repeat(64),
  member_count: 1,
  replaced_count: 0,
};

/** A client whose `rpc` answers in order and records every call. */
function rpcClient(responses: Response[]) {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const client = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      return { status: 200, ...responses[calls.length - 1] };
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

/** A client whose table queries answer in order per table and record every builder call. */
function queryClient(responses: Record<string, Response[]>) {
  const queries: Array<{ table: string; ops: Array<[string, ...unknown[]]> }> = [];
  const client = {
    from(table: string) {
      const query = { table, ops: [] as Array<[string, ...unknown[]]> };
      queries.push(query);
      const builder: Record<string, unknown> = {
        then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
          const response = responses[table]?.shift() ?? { data: [], error: null };
          return Promise.resolve({ status: 200, ...response }).then(resolve, reject);
        },
      };
      for (const op of ['select', 'eq', 'gte', 'in', 'order', 'range']) {
        builder[op] = (...args: unknown[]) => {
          query.ops.push([op, ...args]);
          return builder;
        };
      }
      return builder;
    },
  } as unknown as SupabaseClient;
  return { client, queries };
}

const input = {
  guildId: 'guild-1',
  payload: {
    exportedAt: '2026-09-18T15:00:00Z',
    guild: 'Family One',
    members: [{ name: 'Ash', level: 100, dailiesCompleted: 3, contribution: 10 }],
  },
  payloadDigest: 'a'.repeat(64),
  sourceTimeZone: 'America/Sao_Paulo',
};

describe('replaceUserGuildDailyExport', () => {
  it('saves without any source argument', async () => {
    const { client, calls } = rpcClient([{ data: savedRow, error: null }]);
    const result = await replaceUserGuildDailyExport(client, input);
    expect(result).toEqual({ data: savedRow, error: null });
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe('replace_guild_daily_export');
    expect(Object.keys(calls[0].args).sort()).toEqual([
      'p_exported_at',
      'p_guild_id',
      'p_members',
      'p_payload_digest',
    ]);
  });

  it('retries with a fixed label while the database still has the old signature', async () => {
    const { client, calls } = rpcClient([
      { data: null, error: { code: 'PGRST202', message: 'Could not find the function' } },
      { data: [savedRow], error: null },
    ]);
    const result = await replaceUserGuildDailyExport(client, input);
    expect(result).toEqual({ data: savedRow, error: null });
    expect(calls).toHaveLength(2);
    expect(calls[1].args).toEqual({ ...calls[0].args, p_source_locator: 'guild-export' });
  });

  it('reports other errors by code, without retrying', async () => {
    const { client, calls } = rpcClient([
      {
        data: null,
        error: { code: '42501', message: 'Only a guild owner or officer can import' },
        status: 403,
      },
    ]);
    const result = await replaceUserGuildDailyExport(client, input);
    expect(result).toEqual({ data: null, error: { code: '42501', network: false } });
    expect(calls).toHaveLength(1);
  });

  it('never calls the server without a readable exportedAt', async () => {
    const { client, calls } = rpcClient([]);
    const missing = await replaceUserGuildDailyExport(client, {
      ...input,
      payload: { ...input.payload, exportedAt: '' },
    });
    const unreadable = await replaceUserGuildDailyExport(client, {
      ...input,
      payload: { ...input.payload, exportedAt: 'ayer' },
    });
    expect(missing.error).toEqual({ code: 'missing_exported_at', network: false });
    expect(unreadable.error).toEqual({ code: 'invalid_exported_at', network: false });
    expect(calls).toHaveLength(0);
  });
});

describe('listGuildDailySnapshots', () => {
  const guild = { guild_id: 'guild-1', guild_key: 'family one', display_name: 'Family One' };

  it('reads the snapshots from the given date with their members', async () => {
    const { client, queries } = queryClient({
      guild_daily_exports: [{ data: [savedRow], error: null }],
      guild_daily_member_totals: [
        {
          data: [
            {
              daily_export_id: 'export-1',
              source_member_key: 'ash',
              observed_display_name: 'Ash',
              level: 100,
              dailies_completed: 3,
              rank: 'Leader',
              status: null,
              contribution: '10',
              last_login_label: null,
            },
          ],
          error: null,
        },
      ],
    });

    const result = await listGuildDailySnapshots(client, guild, { from: '2026-08-10' });

    expect(queries[0].ops).toContainEqual(['gte', 'observation_date', '2026-08-10']);
    expect(queries[1].ops).toContainEqual(['in', 'daily_export_id', ['export-1']]);
    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect(result.data?.[0]).toMatchObject({
      snapshotId: 'export-1',
      observationDate: '2026-09-18',
      payloadDigest: 'a'.repeat(64),
      payload: {
        guild: 'Family One',
        members: [
          { name: 'Ash', level: 100, dailiesCompleted: 3, rank: 'Leader', contribution: 10 },
        ],
      },
    });
  });

  it('asks for the members of at most 100 snapshots per request', async () => {
    const exports = Array.from({ length: 150 }, (_, index) => ({
      ...savedRow,
      daily_export_id: `export-${index}`,
    }));
    const { client, queries } = queryClient({
      guild_daily_exports: [{ data: exports, error: null }],
    });

    await listGuildDailySnapshots(client, guild, { from: '2026-01-05' });

    const chunks = queries
      .filter((query) => query.table === 'guild_daily_member_totals')
      .map((query) => (query.ops.find(([op]) => op === 'in')?.[2] as string[]).length);
    expect(chunks).toEqual([100, 50]);
  });

  it('reports a failed read as a network failure', async () => {
    const { client } = queryClient({
      guild_daily_exports: [
        { data: null, error: { code: '', message: 'TypeError: Failed to fetch' }, status: 0 },
      ],
    });
    const result = await listGuildDailySnapshots(client, guild, { from: '2026-08-10' });
    expect(result).toEqual({ data: null, error: { code: null, network: true } });
  });

  it('rejects a date that is not an ISO date', async () => {
    const { client, queries } = queryClient({});
    await expect(listGuildDailySnapshots(client, guild, { from: '2026-02-30' })).rejects.toThrow(
      RangeError,
    );
    await expect(listGuildDailySnapshots(client, guild, { from: '10/08/2026' })).rejects.toThrow(
      RangeError,
    );
    expect(queries).toHaveLength(0);
  });
});

describe('guild settings and administration calls', () => {
  it('sends exactly the keys the database accepts', async () => {
    const settingsRow = {
      goals: DEFAULT_GUILD_PACING,
      difficulty_tiers: DEFAULT_GUILD_DIFFICULTY_TIERS,
      transition_policy: 'review',
      inactivity_days: 5,
      updated_at: '2026-09-23T15:00:00Z',
    };
    const { client, calls } = rpcClient([{ data: settingsRow, error: null }]);
    const withExtraKeys = {
      standard: { ...DEFAULT_GUILD_PACING.standard, extra: 1 },
      premium: DEFAULT_GUILD_PACING.premium,
    } as typeof DEFAULT_GUILD_PACING;

    const result = await saveGuildSettings(client, 'guild-1', {
      goals: withExtraKeys,
      difficultyTiers: DEFAULT_GUILD_DIFFICULTY_TIERS.map((tier) => ({ ...tier, note: 'x' })),
      transitionPolicy: 'review',
      inactivityDays: 5,
    });

    expect(calls[0].name).toBe('set_guild_settings');
    expect(calls[0].args.p_goals).toEqual(DEFAULT_GUILD_PACING);
    expect(calls[0].args.p_difficulty_tiers).toEqual(DEFAULT_GUILD_DIFFICULTY_TIERS);
    expect(result.data).toEqual({
      goals: DEFAULT_GUILD_PACING,
      difficultyTiers: DEFAULT_GUILD_DIFFICULTY_TIERS,
      transitionPolicy: 'review',
      inactivityDays: 5,
      updatedAt: '2026-09-23T15:00:00Z',
    });
  });

  it('reads the access summary, or null outside the guild', async () => {
    const { client } = rpcClient([
      { data: [{ owners: 1, officers: 2, members: 7 }], error: null },
      { data: [], error: null },
    ]);
    expect((await getGuildAccessSummary(client, 'guild-1')).data).toEqual({
      owners: 1,
      officers: 2,
      members: 7,
    });
    expect((await getGuildAccessSummary(client, 'guild-1')).data).toBeNull();
  });

  it('deletes a snapshot by its Server Save date', async () => {
    const { client, calls } = rpcClient([{ data: true, error: null }]);
    expect(await deleteGuildDailyExport(client, 'guild-1', '2026-09-18')).toEqual({
      data: true,
      error: null,
    });
    expect(calls[0]).toEqual({
      name: 'delete_guild_daily_export',
      args: { p_guild_id: 'guild-1', p_observation_date: '2026-09-18' },
    });
    await expect(deleteGuildDailyExport(client, 'guild-1', '18/09/2026')).rejects.toThrow(
      RangeError,
    );
  });
});

describe('serverSaveDateOf', () => {
  it('uses the Server Save zone like the database', () => {
    expect(serverSaveDateOf('2026-09-18T02:00:00Z', 'UTC')).toBe('2026-09-17');
    expect(serverSaveDateOf('2026-09-18 23:30', 'America/Mexico_City')).toBe('2026-09-19');
    expect(serverSaveDateOf('2026-09-18 10:00', 'America/Sao_Paulo')).toBe('2026-09-18');
  });

  it('returns null when exportedAt is missing or unreadable', () => {
    expect(serverSaveDateOf(undefined, 'America/Sao_Paulo')).toBeNull();
    expect(serverSaveDateOf('', 'America/Sao_Paulo')).toBeNull();
    expect(serverSaveDateOf('ayer', 'America/Sao_Paulo')).toBeNull();
    expect(serverSaveDateOf('2026-13-45T00:00:00Z', 'America/Sao_Paulo')).toBeNull();
  });
});
