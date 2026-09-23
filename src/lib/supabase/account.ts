// The Supabase calls of `/{locale}/cuenta/`, «Guilds» section (§10.4): the
// account's guilds, creating and deleting one, joining with an invitation link
// and, for an owner, its invitations and accounts. The database functions of
// supabase/migrations/20260923150000_guild_admin.sql enforce every permission;
// nothing here is trusted for it.
import type { SupabaseClient } from '@supabase/supabase-js';

import { callRpc, firstRow } from '@/lib/supabase/client';
import { operationFailed, type SupabaseOperation } from '@/lib/supabase/errors';

// This module never imports guilds.ts, which loads the Temporal polyfill that only the Guild
// island may ship (§3.13): guilds.ts takes the guild list from here instead.

/** Site roles (X9): the game ranks of an account cannot be checked. */
export type GuildRole = 'owner' | 'officer' | 'member';

export type SupabaseGuild = {
  guild_id: string;
  guild_key: string;
  /** World id of content/mundos.json; guilds created before M13 may hold another value. */
  world_key: string;
  display_name: string | null;
  /** The signed-in account's role in this guild. */
  role: GuildRole;
};

/** Guilds of the signed-in account, each with its role. */
export async function listUserGuilds(
  client: SupabaseClient,
): Promise<SupabaseOperation<SupabaseGuild[]>> {
  const { data, error, status } = await client
    .from('guilds')
    .select('guild_id,guild_key,world_key,display_name,guild_memberships(role)')
    .order('updated_at', { ascending: false });

  if (error) return operationFailed(error, status);

  const guilds: SupabaseGuild[] = [];
  for (const row of (data ?? []) as Array<
    Omit<SupabaseGuild, 'role'> & { guild_memberships: Array<{ role: GuildRole }> | null }
  >) {
    // RLS shows an account only its own membership row.
    const role = row.guild_memberships?.[0]?.role;
    if (!role) continue;
    guilds.push({
      guild_id: row.guild_id,
      guild_key: row.guild_key,
      world_key: row.world_key,
      display_name: row.display_name,
      role,
    });
  }

  return { data: guilds, error: null };
}

export type GuildInvitationRole = Exclude<GuildRole, 'owner'>;

export type GuildInvitation = {
  invitationId: string;
  role: GuildInvitationRole;
  expiresAt: string;
};

/** `token` exists only in this answer: the database keeps its SHA-256. */
export type CreatedGuildInvitation = GuildInvitation & { token: string };

export type AcceptedGuildInvitation = {
  guildId: string;
  /** The display name, or the key of a guild created without one before M13. */
  displayName: string;
  /** World id of content/mundos.json; a guild created before M13 may hold another value. */
  worldId: string;
  /** The account's role in the guild after accepting. */
  role: GuildRole;
};

/** An account with access to a guild, as its owner sees it. */
export type GuildAccount = {
  userId: string;
  role: GuildRole;
  joinedAt: string;
  /** Masked e-mail (`j•••@example.com`); null when the account has none. */
  accountLabel: string | null;
};

/**
 * «Crear guild»: the world id comes from content/mundos.json. The same name
 * twice in one world fails with code 23505.
 */
export async function createUserGuild(
  client: SupabaseClient,
  input: { name: string; worldId: string },
): Promise<SupabaseOperation<SupabaseGuild | null>> {
  return callRpc<unknown, SupabaseGuild | null>(
    client,
    'create_guild',
    { p_display_name: input.name, p_world_id: input.worldId },
    (data) => {
      const row = firstRow<Omit<SupabaseGuild, 'role'>>(data);
      return row
        ? {
            guild_id: row.guild_id,
            guild_key: row.guild_key,
            world_key: row.world_key,
            display_name: row.display_name,
            role: 'owner',
          }
        : null;
    },
  );
}

/** «Eliminar guild» (owner): its snapshots, settings and every account's access go with it. */
export async function deleteUserGuild(
  client: SupabaseClient,
  guildId: string,
): Promise<SupabaseOperation<boolean>> {
  return callRpc<boolean | null, boolean>(client, 'delete_guild', { p_guild_id: guildId }, Boolean);
}

/**
 * Joins the guild of an invitation link. An account already in that guild
 * keeps its role and the link stays unused. An unknown, used or expired
 * token fails with code P0002.
 */
export async function acceptGuildInvitation(
  client: SupabaseClient,
  token: string,
): Promise<SupabaseOperation<AcceptedGuildInvitation | null>> {
  return callRpc<unknown, AcceptedGuildInvitation | null>(
    client,
    'accept_guild_invitation',
    { p_token: token },
    (data) => {
      const row = firstRow<{
        guild_id: string;
        guild_key: string;
        display_name: string | null;
        world_key: string;
        role: GuildRole;
      }>(data);
      return row
        ? {
            guildId: row.guild_id,
            displayName: row.display_name || row.guild_key,
            worldId: row.world_key,
            role: row.role,
          }
        : null;
    },
  );
}

/** «Invitar oficial» / «Invitar miembro» (owner): a single-use link valid for 7 days. */
export async function createGuildInvitation(
  client: SupabaseClient,
  guildId: string,
  role: GuildInvitationRole,
): Promise<SupabaseOperation<CreatedGuildInvitation | null>> {
  return callRpc<unknown, CreatedGuildInvitation | null>(
    client,
    'create_guild_invitation',
    { p_guild_id: guildId, p_role: role },
    (data) => {
      const row = firstRow<{ invitation_id: string; token: string; expires_at: string }>(data);
      return row
        ? { invitationId: row.invitation_id, role, expiresAt: row.expires_at, token: row.token }
        : null;
    },
  );
}

/** Pending invitations of a guild; only its owner can read them. */
export async function listGuildInvitations(
  client: SupabaseClient,
  guildId: string,
): Promise<SupabaseOperation<GuildInvitation[]>> {
  const { data, error, status } = await client
    .from('guild_invitations')
    .select('invitation_id,role,expires_at')
    .eq('guild_id', guildId)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: true });

  if (error) return operationFailed(error, status);

  const rows = (data ?? []) as Array<{
    invitation_id: string;
    role: GuildInvitationRole;
    expires_at: string;
  }>;
  return {
    data: rows.map((row) => ({
      invitationId: row.invitation_id,
      role: row.role,
      expiresAt: row.expires_at,
    })),
    error: null,
  };
}

/** Deletes a pending invitation (owner). False when it no longer exists or was used. */
export async function revokeGuildInvitation(
  client: SupabaseClient,
  invitationId: string,
): Promise<SupabaseOperation<boolean>> {
  return callRpc<boolean | null, boolean>(
    client,
    'revoke_guild_invitation',
    { p_invitation_id: invitationId },
    Boolean,
  );
}

/** The accounts of a guild with their roles, owner first (owner only). */
export async function listGuildAccounts(
  client: SupabaseClient,
  guildId: string,
): Promise<SupabaseOperation<GuildAccount[]>> {
  return callRpc<unknown, GuildAccount[]>(
    client,
    'list_guild_accounts',
    { p_guild_id: guildId },
    (data) =>
      (
        (data ?? []) as Array<{
          user_id: string;
          role: GuildRole;
          joined_at: string;
          account_label: string | null;
        }>
      ).map((row) => ({
        userId: row.user_id,
        role: row.role,
        joinedAt: row.joined_at,
        accountLabel: row.account_label,
      })),
  );
}

/** Moves an account between officer and member (owner). False for the owner or a stranger. */
export async function setGuildMemberRole(
  client: SupabaseClient,
  guildId: string,
  userId: string,
  role: GuildInvitationRole,
): Promise<SupabaseOperation<boolean>> {
  return callRpc<boolean | null, boolean>(
    client,
    'set_guild_member_role',
    { p_guild_id: guildId, p_user_id: userId, p_role: role },
    Boolean,
  );
}

/** «Quitar» (owner): the account loses access; the snapshots do not change. */
export async function removeGuildMember(
  client: SupabaseClient,
  guildId: string,
  userId: string,
): Promise<SupabaseOperation<boolean>> {
  return callRpc<boolean | null, boolean>(
    client,
    'remove_guild_member',
    { p_guild_id: guildId, p_user_id: userId },
    Boolean,
  );
}
