-- Alliance Codex / M13 — Guild administration (spec §10.13).
--
-- Local only: it is never applied to the remote project from the repository
-- (OG-1); the owner applies it.
--
-- Security model:
--   * Every guild table is deny-by-default. anon has no privilege at all and
--     authenticated only reads, through RLS policies scoped to the guild's
--     accounts. The platform's default privileges had granted everything to
--     both roles, TRUNCATE included, which RLS does not cover.
--   * Every write is a security definer function that checks the caller's
--     guild role and validates its input: the owner manages access; owner and
--     officer import, delete snapshots and edit settings; a member only reads.

-- 1. Least privilege on the existing guild tables. The reads the client needs
--    are granted again; writes only happen inside the functions below.
revoke all on table
  public.guilds,
  public.guild_memberships,
  public.guild_members,
  public.guild_member_aliases,
  public.guild_snapshots,
  public.guild_member_observations,
  public.guild_daily_exports,
  public.guild_daily_export_revisions,
  public.guild_daily_member_totals,
  public.guild_daily_member_deltas
from anon, authenticated;

grant select on table
  public.guilds,
  public.guild_memberships,
  public.guild_daily_exports,
  public.guild_daily_export_revisions,
  public.guild_daily_member_totals,
  public.guild_daily_member_deltas
to authenticated;

-- A direct update skipped every validation (world_key took any text).
drop policy if exists guilds_update_owner on public.guilds;

-- 2. Private helpers: only the security definer functions call them.
create function public.guild_role_of_caller(p_guild_id uuid)
returns public.membership_role
language sql
stable
set search_path = ''
as $$
  select membership.role
  from public.guild_memberships as membership
  where membership.guild_id = p_guild_id
    and membership.user_id = (select auth.uid());
$$;

-- Goals are the D-005 matrix: { standard | premium } x { totalPoints | dailies
-- | contribution } x { daily | weekly }, each a number >= 0 or null (not
-- evaluated). The keys must match exactly.
create function public.guild_goals_are_valid(p_goals jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  plan_name text;
  metric_name text;
  bound_name text;
  target jsonb;
begin
  if jsonb_typeof(p_goals) is distinct from 'object'
     or (select array_agg(key order by key collate "C") from jsonb_object_keys(p_goals) as key)
        is distinct from array['premium', 'standard'] then
    return false;
  end if;

  foreach plan_name in array array['standard', 'premium'] loop
    if jsonb_typeof(p_goals -> plan_name) is distinct from 'object'
       or (select array_agg(key order by key collate "C") from jsonb_object_keys(p_goals -> plan_name) as key)
          is distinct from array['contribution', 'dailies', 'totalPoints'] then
      return false;
    end if;

    foreach metric_name in array array['totalPoints', 'dailies', 'contribution'] loop
      target := p_goals -> plan_name -> metric_name;
      if jsonb_typeof(target) is distinct from 'object'
         or (select array_agg(key order by key collate "C") from jsonb_object_keys(target) as key)
            is distinct from array['daily', 'weekly'] then
        return false;
      end if;

      foreach bound_name in array array['daily', 'weekly'] loop
        continue when jsonb_typeof(target -> bound_name) = 'null';
        if jsonb_typeof(target -> bound_name) is distinct from 'number'
           or (target ->> bound_name)::numeric < 0
           or (target ->> bound_name)::numeric > 1000000000000 then
          return false;
        end if;
      end loop;
    end loop;
  end loop;

  return true;
end;
$$;

-- Points per daily: the three difficulty tiers of the engine
-- (GUILD_DAILY_VALUE_TIERS), each with integer level bounds and points.
create function public.guild_difficulty_tiers_are_valid(p_tiers jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  tier jsonb;
  seen text[] := array[]::text[];
  minimum_level numeric;
begin
  if jsonb_typeof(p_tiers) is distinct from 'array' or jsonb_array_length(p_tiers) <> 3 then
    return false;
  end if;

  for tier in select value from jsonb_array_elements(p_tiers) loop
    if jsonb_typeof(tier) is distinct from 'object'
       or (select array_agg(key order by key collate "C") from jsonb_object_keys(tier) as key)
          is distinct from array['difficulty', 'maximumLevel', 'minimumLevel', 'points']
       or jsonb_typeof(tier -> 'difficulty') is distinct from 'string'
       or (tier ->> 'difficulty') not in ('normal', 'wildscape', 'primal')
       or (tier ->> 'difficulty') = any (seen)
       or jsonb_typeof(tier -> 'minimumLevel') is distinct from 'number'
       or jsonb_typeof(tier -> 'points') is distinct from 'number'
       or jsonb_typeof(tier -> 'maximumLevel') not in ('number', 'null') then
      return false;
    end if;

    seen := seen || (tier ->> 'difficulty');
    minimum_level := (tier ->> 'minimumLevel')::numeric;

    if minimum_level < 0 or minimum_level > 100000 or minimum_level <> trunc(minimum_level)
       or (tier ->> 'points')::numeric < 0 or (tier ->> 'points')::numeric > 1000000
       or (tier ->> 'points')::numeric <> trunc((tier ->> 'points')::numeric) then
      return false;
    end if;

    if jsonb_typeof(tier -> 'maximumLevel') = 'number'
       and ((tier ->> 'maximumLevel')::numeric < minimum_level
            or (tier ->> 'maximumLevel')::numeric > 100000
            or (tier ->> 'maximumLevel')::numeric <> trunc((tier ->> 'maximumLevel')::numeric)) then
      return false;
    end if;
  end loop;

  return true;
end;
$$;

revoke all on function public.guild_role_of_caller(uuid) from public, anon, authenticated;
revoke all on function public.guild_goals_are_valid(jsonb) from public, anon, authenticated;
revoke all on function public.guild_difficulty_tiers_are_valid(jsonb) from public, anon, authenticated;

-- 3. Settings and invitations.
create table public.guild_settings (
  guild_id uuid primary key references public.guilds(guild_id) on delete cascade,
  goals jsonb not null,
  difficulty_tiers jsonb not null,
  transition_policy text not null,
  inactivity_days smallint not null default 3,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint guild_settings_goals_valid check (public.guild_goals_are_valid(goals)),
  constraint guild_settings_tiers_valid check (public.guild_difficulty_tiers_are_valid(difficulty_tiers)),
  constraint guild_settings_transition_policy check (transition_policy in ('current', 'previous', 'review')),
  constraint guild_settings_inactivity_days check (inactivity_days between 1 and 30)
);

-- Only the SHA-256 of a token is stored; the token itself is returned once.
create table public.guild_invitations (
  invitation_id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(guild_id) on delete cascade,
  role public.membership_role not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  constraint guild_invitation_role check (role in ('officer', 'member')),
  constraint guild_invitation_token_hash check (token_hash ~ '^[a-f0-9]{64}$'),
  constraint guild_invitation_accepted check (accepted_by is null or accepted_at is not null)
);

create index guild_invitations_guild_idx on public.guild_invitations (guild_id, expires_at desc);
-- Deleting an account touches these foreign keys.
create index guild_invitations_created_by_idx on public.guild_invitations (created_by);
create index guild_invitations_accepted_by_idx on public.guild_invitations (accepted_by)
  where accepted_by is not null;
create index guild_settings_updated_by_idx on public.guild_settings (updated_by)
  where updated_by is not null;

alter table public.guild_settings enable row level security;
alter table public.guild_invitations enable row level security;

revoke all on table public.guild_settings, public.guild_invitations from anon, authenticated;
grant select on table public.guild_settings to authenticated;
-- token_hash is never readable through the API.
grant select (invitation_id, guild_id, role, expires_at, created_by, accepted_by, accepted_at)
  on table public.guild_invitations to authenticated;

create policy guild_settings_select_members on public.guild_settings
  for select to authenticated
  using (
    exists (
      select 1
      from public.guild_memberships as membership
      where membership.guild_id = guild_settings.guild_id
        and membership.user_id = (select auth.uid())
    )
  );

create policy guild_invitations_select_owner on public.guild_invitations
  for select to authenticated
  using (
    exists (
      select 1
      from public.guild_memberships as membership
      where membership.guild_id = guild_invitations.guild_id
        and membership.user_id = (select auth.uid())
        and membership.role = 'owner'
    )
  );

-- 4. Guild creation with the world id of content/mundos.json (§8.1).
drop function if exists public.create_guild(text, text, text);

create function public.create_guild(p_display_name text, p_world_id text)
returns public.guilds
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  name_value text := regexp_replace(btrim(coalesce(p_display_name, '')), '\s+', ' ', 'g');
  created_guild public.guilds;
begin
  if caller is null then
    raise exception 'Authentication is required to create a guild' using errcode = '42501';
  end if;

  if char_length(name_value) not between 1 and 64 or name_value ~ '[[:cntrl:]]' then
    raise exception 'The guild name must have 1 to 64 printable characters' using errcode = '22023';
  end if;

  -- The database cannot read content/mundos.json: the form only offers its
  -- ids, and here the value must at least have the shape of one.
  if p_world_id is null
     or char_length(p_world_id) > 32
     or p_world_id !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'The world id is not valid' using errcode = '22023';
  end if;

  -- A bound on what one account can create.
  if (select count(*) from public.guilds as guild where guild.owner_user_id = caller) >= 25 then
    raise exception 'An account can own at most 25 guilds' using errcode = '54000';
  end if;

  -- (owner_user_id, guild_key, world_key) is unique: the same name twice in a
  -- world answers 23505.
  insert into public.guilds (owner_user_id, guild_key, world_key, display_name)
  values (caller, lower(name_value), p_world_id, name_value)
  returning * into created_guild;

  insert into public.guild_memberships (guild_id, user_id, role)
  values (created_guild.guild_id, caller, 'owner');

  return created_guild;
end;
$$;

create function public.delete_guild(p_guild_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.guild_role_of_caller(p_guild_id) is distinct from 'owner' then
    raise exception 'Only the guild owner can delete the guild' using errcode = '42501';
  end if;

  -- Snapshots, members, settings, invitations and memberships cascade.
  delete from public.guilds as guild
  where guild.guild_id = p_guild_id
    and guild.owner_user_id = (select auth.uid());

  return found;
end;
$$;

-- 5. Settings (owner and officer).
create function public.set_guild_settings(
  p_guild_id uuid,
  p_goals jsonb,
  p_difficulty_tiers jsonb,
  p_transition_policy text,
  p_inactivity_days integer
)
returns public.guild_settings
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved public.guild_settings;
begin
  if coalesce(public.guild_role_of_caller(p_guild_id)::text, '') not in ('owner', 'officer') then
    raise exception 'Only a guild owner or officer can edit the settings' using errcode = '42501';
  end if;

  if p_inactivity_days is null
     or p_inactivity_days not between 1 and 30
     or p_transition_policy is null
     or p_transition_policy not in ('current', 'previous', 'review')
     or not public.guild_goals_are_valid(p_goals)
     or not public.guild_difficulty_tiers_are_valid(p_difficulty_tiers) then
    raise exception 'The guild settings are not valid' using errcode = '22023';
  end if;

  insert into public.guild_settings (
    guild_id,
    goals,
    difficulty_tiers,
    transition_policy,
    inactivity_days,
    updated_by,
    updated_at
  )
  values (
    p_guild_id,
    p_goals,
    p_difficulty_tiers,
    p_transition_policy,
    p_inactivity_days,
    (select auth.uid()),
    now()
  )
  on conflict (guild_id) do update set
    goals = excluded.goals,
    difficulty_tiers = excluded.difficulty_tiers,
    transition_policy = excluded.transition_policy,
    inactivity_days = excluded.inactivity_days,
    updated_by = excluded.updated_by,
    updated_at = excluded.updated_at
  returning * into saved;

  return saved;
end;
$$;

-- 6. Invitations (owner creates and revokes; any account accepts once).
create function public.create_guild_invitation(p_guild_id uuid, p_role text)
returns table (invitation_id uuid, token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  new_token text := encode(extensions.gen_random_bytes(32), 'hex');
  created public.guild_invitations;
begin
  if public.guild_role_of_caller(p_guild_id) is distinct from 'owner' then
    raise exception 'Only the guild owner can invite' using errcode = '42501';
  end if;

  if p_role is null or p_role not in ('officer', 'member') then
    raise exception 'An invitation is for an officer or a member' using errcode = '22023';
  end if;

  -- Expired links of the guild go away; the pending ones are bounded.
  delete from public.guild_invitations as expired
  where expired.guild_id = p_guild_id
    and expired.accepted_at is null
    and expired.expires_at <= now();

  if (
    select count(*)
    from public.guild_invitations as pending
    where pending.guild_id = p_guild_id
      and pending.accepted_at is null
  ) >= 100 then
    raise exception 'A guild can have at most 100 pending invitations' using errcode = '54000';
  end if;

  insert into public.guild_invitations (guild_id, role, token_hash, expires_at, created_by)
  values (
    p_guild_id,
    p_role::public.membership_role,
    encode(sha256(convert_to(new_token, 'UTF8')), 'hex'),
    now() + interval '7 days',
    (select auth.uid())
  )
  returning * into created;

  return query select created.invitation_id, new_token, created.expires_at;
end;
$$;

create function public.accept_guild_invitation(p_token text)
returns table (
  guild_id uuid,
  guild_key text,
  display_name text,
  world_key text,
  role public.membership_role
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  caller uuid := (select auth.uid());
  invitation public.guild_invitations;
  caller_role public.membership_role;
begin
  if caller is null then
    raise exception 'Authentication is required to accept an invitation' using errcode = '42501';
  end if;

  if p_token is null or p_token !~ '^[a-f0-9]{64}$' then
    raise exception 'The invitation is not valid or has expired' using errcode = 'P0002';
  end if;

  select * into invitation
  from public.guild_invitations as pending
  where pending.token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
  for update;

  if not found or invitation.accepted_at is not null or invitation.expires_at <= now() then
    raise exception 'The invitation is not valid or has expired' using errcode = 'P0002';
  end if;

  select membership.role into caller_role
  from public.guild_memberships as membership
  where membership.guild_id = invitation.guild_id
    and membership.user_id = caller;

  -- An account that already belongs to the guild keeps its role and leaves
  -- the link unused; the owner changes roles with set_guild_member_role.
  if caller_role is null then
    insert into public.guild_memberships (guild_id, user_id, role)
    values (invitation.guild_id, caller, invitation.role);

    update public.guild_invitations as pending
    set accepted_by = caller,
        accepted_at = now()
    where pending.invitation_id = invitation.invitation_id;

    caller_role := invitation.role;
  end if;

  return query
  select guild.guild_id, guild.guild_key, guild.display_name, guild.world_key, caller_role
  from public.guilds as guild
  where guild.guild_id = invitation.guild_id;
end;
$$;

create function public.revoke_guild_invitation(p_invitation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.guild_invitations;
begin
  select * into target
  from public.guild_invitations as pending
  where pending.invitation_id = p_invitation_id
  for update;

  if not found then
    return false;
  end if;

  if public.guild_role_of_caller(target.guild_id) is distinct from 'owner' then
    raise exception 'Only the guild owner can revoke an invitation' using errcode = '42501';
  end if;

  if target.accepted_at is not null then
    return false;
  end if;

  delete from public.guild_invitations as pending
  where pending.invitation_id = target.invitation_id;

  return true;
end;
$$;

-- 7. Access (owner). The owner's own membership never changes here.
create function public.set_guild_member_role(p_guild_id uuid, p_user_id uuid, p_role text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.guild_role_of_caller(p_guild_id) is distinct from 'owner' then
    raise exception 'Only the guild owner can change roles' using errcode = '42501';
  end if;

  if p_role is null or p_role not in ('officer', 'member') then
    raise exception 'The role must be officer or member' using errcode = '22023';
  end if;

  update public.guild_memberships as membership
  set role = p_role::public.membership_role
  where membership.guild_id = p_guild_id
    and membership.user_id = p_user_id
    and membership.role <> 'owner';

  return found;
end;
$$;

create function public.remove_guild_member(p_guild_id uuid, p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.guild_role_of_caller(p_guild_id) is distinct from 'owner' then
    raise exception 'Only the guild owner can remove an account' using errcode = '42501';
  end if;

  -- Snapshots stay: they belong to the guild, not to the account.
  delete from public.guild_memberships as membership
  where membership.guild_id = p_guild_id
    and membership.user_id = p_user_id
    and membership.role <> 'owner';

  return found;
end;
$$;

-- Accounts per role for the header «Acceso: …»; any account of the guild may
-- read it because guild_memberships only shows its own row. No row otherwise.
create function public.guild_access_summary(p_guild_id uuid)
returns table (owners integer, officers integer, members integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (count(*) filter (where membership.role = 'owner'))::integer,
    (count(*) filter (where membership.role = 'officer'))::integer,
    (count(*) filter (where membership.role = 'member'))::integer
  from public.guild_memberships as membership
  where membership.guild_id = p_guild_id
  having public.guild_role_of_caller(p_guild_id) is not null;
$$;

-- The owner's list of accounts. The label masks the e-mail (first character
-- and domain): the owner tells accounts apart without collecting addresses.
create function public.list_guild_accounts(p_guild_id uuid)
returns table (user_id uuid, role public.membership_role, joined_at timestamptz, account_label text)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if public.guild_role_of_caller(p_guild_id) is distinct from 'owner' then
    raise exception 'Only the guild owner can list its accounts' using errcode = '42501';
  end if;

  return query
  select
    membership.user_id,
    membership.role,
    membership.created_at,
    case
      when account.email is null or position('@' in account.email) < 2 then null
      else left(account.email, 1) || '•••@' || split_part(account.email, '@', 2)
    end
  from public.guild_memberships as membership
  join auth.users as account on account.id = membership.user_id
  where membership.guild_id = p_guild_id
  order by
    case membership.role when 'owner' then 0 when 'officer' then 1 else 2 end,
    membership.created_at;
end;
$$;

-- 8. Snapshot deletion (owner and officer). Member totals and revisions
--    cascade; the view recalculates that week's deltas on the next read.
create function public.delete_guild_daily_export(p_guild_id uuid, p_observation_date date)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(public.guild_role_of_caller(p_guild_id)::text, '') not in ('owner', 'officer') then
    raise exception 'Only a guild owner or officer can delete a snapshot' using errcode = '42501';
  end if;

  if p_observation_date is null then
    raise exception 'The snapshot date is required' using errcode = '22023';
  end if;

  delete from public.guild_daily_exports as exports
  where exports.guild_id = p_guild_id
    and exports.observation_date = p_observation_date;

  return found;
end;
$$;

-- 9. Execution rights: authenticated only.
revoke all on function public.create_guild(text, text) from public, anon;
revoke all on function public.delete_guild(uuid) from public, anon;
revoke all on function public.set_guild_settings(uuid, jsonb, jsonb, text, integer) from public, anon;
revoke all on function public.create_guild_invitation(uuid, text) from public, anon;
revoke all on function public.accept_guild_invitation(text) from public, anon;
revoke all on function public.revoke_guild_invitation(uuid) from public, anon;
revoke all on function public.set_guild_member_role(uuid, uuid, text) from public, anon;
revoke all on function public.remove_guild_member(uuid, uuid) from public, anon;
revoke all on function public.guild_access_summary(uuid) from public, anon;
revoke all on function public.list_guild_accounts(uuid) from public, anon;
revoke all on function public.delete_guild_daily_export(uuid, date) from public, anon;

grant execute on function public.create_guild(text, text) to authenticated;
grant execute on function public.delete_guild(uuid) to authenticated;
grant execute on function public.set_guild_settings(uuid, jsonb, jsonb, text, integer) to authenticated;
grant execute on function public.create_guild_invitation(uuid, text) to authenticated;
grant execute on function public.accept_guild_invitation(text) to authenticated;
grant execute on function public.revoke_guild_invitation(uuid) to authenticated;
grant execute on function public.set_guild_member_role(uuid, uuid, text) to authenticated;
grant execute on function public.remove_guild_member(uuid, uuid) to authenticated;
grant execute on function public.guild_access_summary(uuid) to authenticated;
grant execute on function public.list_guild_accounts(uuid) to authenticated;
grant execute on function public.delete_guild_daily_export(uuid, date) to authenticated;
