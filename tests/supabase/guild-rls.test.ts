// §10.13 permission cases against the LOCAL Supabase stack, with real local
// accounts: an owner, an officer, a member and a stranger. The keys come from
// `supabase status` and the address must be a loopback one, so this file can
// never reach the remote project. It skips, with the reason in its title, only
// when the local stack does not answer.
import { execFileSync } from 'node:child_process';

import mundos from '@content/mundos.json';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  acceptGuildInvitation,
  createGuildInvitation,
  createUserGuild,
  deleteUserGuild,
  listGuildAccounts,
  listGuildInvitations,
  listUserGuilds,
  removeGuildMember,
  revokeGuildInvitation,
  setGuildMemberRole,
  type SupabaseGuild,
} from '@/lib/supabase/account';
import {
  deleteGuildDailyExport,
  getGuildAccessSummary,
  getGuildSettings,
  listGuildDailySnapshots,
  replaceUserGuildDailyExport,
  saveGuildSettings,
  sha256Hex,
  type GuildSettings,
} from '@/lib/supabase/guilds';
import { DEFAULT_GUILD_DIFFICULTY_TIERS } from '@/lib/tools/guild-difficulty';
import { DEFAULT_GUILD_PACING } from '@/lib/tools/guild-ranking';

type LocalStack = { url: string; anonKey: string; serviceRoleKey: string };

function readLocalStack(): LocalStack | string {
  let output: string;
  try {
    output = execFileSync('supabase', ['status', '-o', 'env'], {
      encoding: 'utf8',
      timeout: 30_000,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return 'no local stack reported by `supabase status` (run `supabase start`)';
  }

  const values = new Map<string, string>();
  for (const line of output.split(/\r?\n/)) {
    const match = /^([A-Z_]+)="?([^"]*)"?$/.exec(line.trim());
    if (match) values.set(match[1], match[2]);
  }
  const url = values.get('API_URL');
  const anonKey = values.get('ANON_KEY');
  const serviceRoleKey = values.get('SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceRoleKey) {
    return '`supabase status` printed no API_URL, ANON_KEY or SERVICE_ROLE_KEY';
  }
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(url).hostname)) {
    return `API_URL ${url} is not a loopback address`;
  }
  return { url, anonKey, serviceRoleKey };
}

async function detectLocalStack(): Promise<LocalStack | string> {
  const stack = readLocalStack();
  if (typeof stack === 'string') return stack;
  try {
    const health = await fetch(`${stack.url}/auth/v1/health`, {
      headers: { apikey: stack.anonKey },
      signal: AbortSignal.timeout(5_000),
    });
    return health.ok ? stack : `the local stack answered ${health.status}`;
  } catch {
    return `the local stack at ${stack.url} does not answer`;
  }
}

const detected = await detectLocalStack();
const stack = typeof detected === 'string' ? null : detected;
const title =
  typeof detected === 'string'
    ? `guild permissions (§10.13), skipped: ${detected}`
    : 'guild permissions (§10.13)';

const clientOptions = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
};

type Account = { id: string; client: SupabaseClient };

const run = crypto.randomUUID().slice(0, 8);
const password = `Local-${crypto.randomUUID()}`;
const worldId = mundos.mundos[0].id;
const guildName = `RLS ${run}`;
const settings: GuildSettings = {
  goals: DEFAULT_GUILD_PACING,
  difficultyTiers: [...DEFAULT_GUILD_DIFFICULTY_TIERS],
  transitionPolicy: 'review',
  inactivityDays: 4,
};

function exportOf(exportedAt: string) {
  return {
    exportedAt,
    guild: guildName,
    members: [{ name: 'Member A', level: 120, dailiesCompleted: 2, contribution: 15 }],
  };
}

async function importExport(account: Account, guildId: string, exportedAt: string) {
  const payload = exportOf(exportedAt);
  return replaceUserGuildDailyExport(account.client, {
    guildId,
    payload,
    payloadDigest: await sha256Hex(JSON.stringify(payload)),
  });
}

describe.skipIf(stack === null)(title, () => {
  const admin = stack ? createClient(stack.url, stack.serviceRoleKey, clientOptions) : null!;
  const accounts: Account[] = [];
  let owner: Account;
  let officer: Account;
  let member: Account;
  let stranger: Account;
  let guild: SupabaseGuild;

  async function createAccount(role: string): Promise<Account> {
    const email = `guild-rls-${role}-${run}@example.com`;
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error || !created.data.user) throw created.error ?? new Error('No user');
    const account = {
      id: created.data.user.id,
      client: createClient(stack!.url, stack!.anonKey, clientOptions),
    };
    accounts.push(account);
    const signedIn = await account.client.auth.signInWithPassword({ email, password });
    if (signedIn.error) throw signedIn.error;
    return account;
  }

  async function join(account: Account, role: 'officer' | 'member') {
    const invitation = await createGuildInvitation(owner.client, guild.guild_id, role);
    expect(invitation.error).toBeNull();
    const accepted = await acceptGuildInvitation(account.client, invitation.data!.token);
    expect(accepted.error).toBeNull();
    expect(accepted.data).toMatchObject({ guildId: guild.guild_id, displayName: guildName, role });
  }

  beforeAll(async () => {
    owner = await createAccount('owner');
    officer = await createAccount('officer');
    member = await createAccount('member');
    stranger = await createAccount('stranger');

    const created = await createUserGuild(owner.client, { name: guildName, worldId });
    expect(created.error).toBeNull();
    guild = created.data!;
    expect(guild).toMatchObject({ display_name: guildName, world_key: worldId, role: 'owner' });

    await join(officer, 'officer');
    await join(member, 'member');
    expect((await importExport(owner, guild.guild_id, '2026-09-21T15:00:00Z')).error).toBeNull();
  }, 60_000);

  afterAll(async () => {
    if (!stack) return;
    // Guilds block their owner's deletion (guilds.owner_user_id has no cascade).
    for (const account of accounts) {
      await admin.from('guilds').delete().eq('owner_user_id', account.id);
      await admin.auth.admin.deleteUser(account.id);
    }
  }, 60_000);

  it('a member reads the guild, its snapshots, its settings and the access summary', async () => {
    const guilds = await listUserGuilds(member.client);
    expect(guilds.data).toEqual([{ ...guild, role: 'member' }]);

    const snapshots = await listGuildDailySnapshots(member.client, guild, { from: '2026-09-01' });
    expect(snapshots.error).toBeNull();
    expect(snapshots.data?.map((snapshot) => snapshot.observationDate)).toEqual(['2026-09-21']);

    expect((await getGuildSettings(member.client, guild.guild_id)).error).toBeNull();
    expect((await getGuildAccessSummary(member.client, guild.guild_id)).data).toEqual({
      owners: 1,
      officers: 1,
      members: 1,
    });
  });

  it('a member does not import, delete snapshots or edit the goals', async () => {
    const imported = await importExport(member, guild.guild_id, '2026-09-22T15:00:00Z');
    expect(imported.error?.code).toBe('42501');

    const deleted = await deleteGuildDailyExport(member.client, guild.guild_id, '2026-09-21');
    expect(deleted.error?.code).toBe('42501');

    const saved = await saveGuildSettings(member.client, guild.guild_id, settings);
    expect(saved.error?.code).toBe('42501');
    expect((await getGuildSettings(member.client, guild.guild_id)).data).toBeNull();
  });

  it('an officer imports, edits the goals and deletes snapshots', async () => {
    expect((await importExport(officer, guild.guild_id, '2026-09-22T15:00:00Z')).error).toBeNull();

    const saved = await saveGuildSettings(officer.client, guild.guild_id, settings);
    expect(saved.error).toBeNull();
    expect(saved.data).toMatchObject({ transitionPolicy: 'review', inactivityDays: 4 });
    expect((await getGuildSettings(member.client, guild.guild_id)).data?.goals).toEqual(
      DEFAULT_GUILD_PACING,
    );

    const deleted = await deleteGuildDailyExport(officer.client, guild.guild_id, '2026-09-22');
    expect(deleted).toEqual({ data: true, error: null });
  });

  it('an officer does not invite, manage accounts or delete the guild', async () => {
    const invited = await createGuildInvitation(officer.client, guild.guild_id, 'member');
    expect(invited.error?.code).toBe('42501');
    expect((await listGuildAccounts(officer.client, guild.guild_id)).error?.code).toBe('42501');
    expect((await listGuildInvitations(officer.client, guild.guild_id)).data).toEqual([]);

    const promoted = await setGuildMemberRole(officer.client, guild.guild_id, member.id, 'officer');
    expect(promoted.error?.code).toBe('42501');

    const removed = await removeGuildMember(officer.client, guild.guild_id, member.id);
    expect(removed.error?.code).toBe('42501');

    expect((await deleteUserGuild(officer.client, guild.guild_id)).error?.code).toBe('42501');
    expect((await listUserGuilds(owner.client)).data).toHaveLength(1);
  });

  it('a stranger reads nothing and writes nothing', async () => {
    const { client } = stranger;
    expect((await listUserGuilds(client)).data).toEqual([]);
    for (const table of [
      'guilds',
      'guild_memberships',
      'guild_daily_exports',
      'guild_daily_export_revisions',
      'guild_daily_member_totals',
      'guild_daily_member_deltas',
      'guild_settings',
    ]) {
      const read = await client.from(table).select('*');
      expect({ table, ...read }).toMatchObject({ table, data: [], error: null });
    }
    const invitations = await client.from('guild_invitations').select('invitation_id');
    expect(invitations.data).toEqual([]);

    expect((await getGuildAccessSummary(client, guild.guild_id)).data).toBeNull();
    expect((await getGuildSettings(client, guild.guild_id)).data).toBeNull();
    const snapshots = await listGuildDailySnapshots(client, guild, { from: '2026-09-01' });
    expect(snapshots.data).toEqual([]);

    expect((await importExport(stranger, guild.guild_id, '2026-09-23T15:00:00Z')).error?.code).toBe(
      '42501',
    );
    expect((await saveGuildSettings(client, guild.guild_id, settings)).error?.code).toBe('42501');
    expect((await deleteGuildDailyExport(client, guild.guild_id, '2026-09-21')).error?.code).toBe(
      '42501',
    );
    expect((await createGuildInvitation(client, guild.guild_id, 'officer')).error?.code).toBe(
      '42501',
    );
    expect((await deleteUserGuild(client, guild.guild_id)).error?.code).toBe('42501');
  });

  it('without a session nothing is readable or callable', async () => {
    const anonymous = createClient(stack!.url, stack!.anonKey, clientOptions);
    for (const table of ['guilds', 'guild_daily_exports', 'guild_settings', 'guild_invitations']) {
      const read = await anonymous.from(table).select('guild_id');
      expect({ table, code: read.error?.code }).toEqual({ table, code: '42501' });
    }
    const created = await createUserGuild(anonymous, { name: `Anon ${run}`, worldId });
    expect(created.error?.code).toBe('42501');
    const accepted = await acceptGuildInvitation(anonymous, 'a'.repeat(64));
    expect(accepted.error?.code).toBe('42501');
  });

  it('no account writes the tables directly', async () => {
    const { client } = owner;
    const writes = [
      client.from('guilds').update({ world_key: 'anything' }).eq('guild_id', guild.guild_id),
      client.from('guild_memberships').insert({ guild_id: guild.guild_id, user_id: stranger.id }),
      client.from('guild_memberships').delete().eq('guild_id', guild.guild_id),
      client.from('guild_daily_exports').delete().eq('guild_id', guild.guild_id),
      client.from('guild_settings').upsert({ guild_id: guild.guild_id, inactivity_days: 9 }),
      client.from('guild_invitations').delete().eq('guild_id', guild.guild_id),
    ];
    for (const write of writes) {
      expect((await write).error?.code).toBe('42501');
    }
    // The token hash is never readable, not even by the owner.
    const hashes = await client.from('guild_invitations').select('token_hash');
    expect(hashes.error?.code).toBe('42501');
  });

  it('every write is validated', async () => {
    const { client } = owner;
    expect((await createUserGuild(client, { name: guildName, worldId })).error?.code).toBe('23505');
    expect((await createUserGuild(client, { name: '   ', worldId })).error?.code).toBe('22023');
    expect((await createUserGuild(client, { name: 'Other', worldId: 'Moon!' })).error?.code).toBe(
      '22023',
    );

    const invalid: GuildSettings[] = [
      { ...settings, inactivityDays: 0 },
      {
        ...settings,
        goals: {
          ...settings.goals,
          standard: { ...settings.goals.standard, dailies: { daily: -1, weekly: null } },
        },
      },
      { ...settings, difficultyTiers: settings.difficultyTiers.slice(0, 2) },
      { ...settings, transitionPolicy: 'latest' as GuildSettings['transitionPolicy'] },
    ];
    for (const value of invalid) {
      expect((await saveGuildSettings(client, guild.guild_id, value)).error?.code).toBe('22023');
    }

    expect((await acceptGuildInvitation(stranger.client, 'not-a-token')).error?.code).toBe('P0002');
  });

  it('the owner lists the accounts and moves them between officer and member', async () => {
    const listed = await listGuildAccounts(owner.client, guild.guild_id);
    expect(listed.data?.map((account) => [account.userId, account.role])).toEqual([
      [owner.id, 'owner'],
      [officer.id, 'officer'],
      [member.id, 'member'],
    ]);
    expect(listed.data?.[0].accountLabel).toBe('g•••@example.com');

    const { client } = owner;
    expect((await setGuildMemberRole(client, guild.guild_id, member.id, 'officer')).data).toBe(
      true,
    );
    expect((await getGuildAccessSummary(member.client, guild.guild_id)).data?.officers).toBe(2);
    expect((await setGuildMemberRole(client, guild.guild_id, member.id, 'member')).data).toBe(true);

    // The owner's own membership never changes here.
    expect((await setGuildMemberRole(client, guild.guild_id, owner.id, 'member')).data).toBe(false);
    expect((await removeGuildMember(client, guild.guild_id, owner.id)).data).toBe(false);
  });

  it('an invitation link works once; a revoked or expired one never', async () => {
    const used = await createGuildInvitation(owner.client, guild.guild_id, 'member');
    expect((await acceptGuildInvitation(stranger.client, used.data!.token)).data?.role).toBe(
      'member',
    );
    expect((await acceptGuildInvitation(officer.client, used.data!.token)).error?.code).toBe(
      'P0002',
    );

    // «Quitar»: the account loses access and the snapshots stay.
    const removed = await removeGuildMember(owner.client, guild.guild_id, stranger.id);
    expect(removed.data).toBe(true);
    expect((await listUserGuilds(stranger.client)).data).toEqual([]);
    expect((await stranger.client.from('guild_daily_exports').select('guild_id')).data).toEqual([]);

    const revoked = await createGuildInvitation(owner.client, guild.guild_id, 'officer');
    const pending = await listGuildInvitations(owner.client, guild.guild_id);
    expect(pending.data?.map((invitation) => invitation.invitationId)).toContain(
      revoked.data!.invitationId,
    );
    expect((await revokeGuildInvitation(owner.client, revoked.data!.invitationId)).data).toBe(true);
    expect((await acceptGuildInvitation(stranger.client, revoked.data!.token)).error?.code).toBe(
      'P0002',
    );

    const expired = await createGuildInvitation(owner.client, guild.guild_id, 'officer');
    const aged = await admin
      .from('guild_invitations')
      .update({ expires_at: new Date(Date.now() - 60_000).toISOString() })
      .eq('invitation_id', expired.data!.invitationId);
    expect(aged.error).toBeNull();
    expect((await acceptGuildInvitation(stranger.client, expired.data!.token)).error?.code).toBe(
      'P0002',
    );
    expect((await listUserGuilds(stranger.client)).data).toEqual([]);
  });

  it('deleting the guild takes its snapshots, settings, invitations and access', async () => {
    expect(await deleteUserGuild(owner.client, guild.guild_id)).toEqual({
      data: true,
      error: null,
    });
    expect((await listUserGuilds(member.client)).data).toEqual([]);
    for (const table of [
      'guild_memberships',
      'guild_daily_exports',
      'guild_settings',
      'guild_invitations',
    ]) {
      const left = await admin
        .from(table)
        .select('guild_id', { count: 'exact', head: true })
        .eq('guild_id', guild.guild_id);
      expect({ table, count: left.count }).toEqual({ table, count: 0 });
    }
  });
});
