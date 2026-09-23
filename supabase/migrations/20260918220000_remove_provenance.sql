-- Alliance Codex / D-012
-- Removes the source, evidence, claim, import and staging model.
-- Order: the guild import RPC stops taking source arguments, provenance
-- columns are dropped, then tables from the most dependent to the least, then
-- the enums only those tables used. No CASCADE: an unknown dependent must stop
-- the migration instead of being dropped silently.

-- 1. Drop the guild import RPC that still accepts p_source_locator and
--    p_source_snapshot_id. Step 3 recreates it without them. The web client
--    calls the new signature and, while this migration is not applied, retries
--    with a fixed p_source_locator (src/lib/supabase/guilds.ts).
drop function if exists public.replace_guild_daily_export(
  uuid, timestamptz, text, text, jsonb, uuid
);
drop function if exists public.replace_guild_daily_export(
  uuid, timestamptz, text, text, jsonb
);

-- 2. Provenance columns. Dropping source_locator also drops its
--    "not blank" check constraints.
alter table public.guild_daily_exports
  drop column if exists source_snapshot_id,
  drop column if exists source_locator;

alter table public.guild_daily_export_revisions drop column if exists source_locator;

alter table public.guild_snapshots
  drop column if exists source_snapshot_id,
  drop column if exists source_kind,
  drop column if exists source_locator,
  drop column if exists client_version;

alter table public.map_features drop column if exists source_snapshot_id;
alter table public.game_schedule_rules drop column if exists source_key;
alter table public.pokemon_variants drop column if exists source_variant_key;

-- 3. Guild import RPC without source arguments. The payload digest stays: it
--    keeps the same export from being logged twice.
create function public.replace_guild_daily_export(
  p_guild_id uuid,
  p_exported_at timestamptz,
  p_payload_digest text,
  p_members jsonb
)
returns public.guild_daily_exports
language plpgsql
security definer
set search_path = public
as $$
declare
  current_export public.guild_daily_exports;
  member_value jsonb;
  member_name text;
  member_id uuid;
  observation_date_value date;
  week_start_date_value date;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to import a guild export' using errcode = '28000';
  end if;

  if not exists (
    select 1
    from public.guild_memberships as membership
    where membership.guild_id = p_guild_id
      and membership.user_id = auth.uid()
      and membership.role in ('owner', 'officer')
  ) then
    raise exception 'Only a guild owner or officer can import daily exports' using errcode = '42501';
  end if;

  if p_exported_at is null
     or p_payload_digest !~ '^[A-Fa-f0-9]{64}$'
     or jsonb_typeof(p_members) <> 'array' then
    raise exception 'The guild export payload is incomplete or invalid' using errcode = '22023';
  end if;

  observation_date_value := (p_exported_at at time zone 'America/Sao_Paulo')::date;
  week_start_date_value := date_trunc('week', observation_date_value::timestamp)::date;

  insert into public.guild_daily_exports (
    guild_id,
    observation_date,
    week_start_date,
    exported_at,
    payload_digest,
    member_count
  )
  values (
    p_guild_id,
    observation_date_value,
    week_start_date_value,
    p_exported_at,
    lower(p_payload_digest),
    jsonb_array_length(p_members)
  )
  on conflict (guild_id, observation_date) do update set
    week_start_date = excluded.week_start_date,
    exported_at = excluded.exported_at,
    payload_digest = excluded.payload_digest,
    member_count = excluded.member_count,
    replaced_count = public.guild_daily_exports.replaced_count + 1,
    updated_at = now()
  returning * into current_export;

  insert into public.guild_daily_export_revisions (
    daily_export_id,
    payload_digest,
    member_count
  )
  values (
    current_export.daily_export_id,
    lower(p_payload_digest),
    jsonb_array_length(p_members)
  )
  on conflict (daily_export_id, payload_digest) do nothing;

  delete from public.guild_daily_member_totals
  where daily_export_id = current_export.daily_export_id;

  for member_value in select value from jsonb_array_elements(p_members) loop
    member_name := nullif(trim(member_value->>'name'), '');
    if member_name is null then
      raise exception 'Every guild export member must have a name' using errcode = '22023';
    end if;

    insert into public.guild_members (guild_id, member_key, last_seen_at, active)
    values (p_guild_id, member_name, now(), true)
    on conflict (guild_id, member_key_normalized) do update set
      last_seen_at = now(),
      active = true
    returning guild_member_id into member_id;

    insert into public.guild_daily_member_totals (
      guild_id,
      daily_export_id,
      guild_member_id,
      source_member_key,
      observed_display_name,
      level,
      dailies_completed,
      rank,
      status,
      contribution,
      last_login_label
    )
    values (
      p_guild_id,
      current_export.daily_export_id,
      member_id,
      member_name,
      member_name,
      nullif(member_value->>'level', '')::integer,
      coalesce(nullif(member_value->>'dailiesCompleted', '')::integer, 0),
      member_value->>'rank',
      member_value->>'status',
      coalesce(nullif(member_value->>'contribution', '')::numeric, 0),
      member_value->>'lastLogin'
    );
  end loop;

  return current_export;
end;
$$;

revoke execute on function public.replace_guild_daily_export(uuid, timestamptz, text, jsonb)
  from public, anon;
grant execute on function public.replace_guild_daily_export(uuid, timestamptz, text, jsonb)
  to authenticated;

-- 4. Provenance tables, most dependent first.
drop table if exists public.claim_evidence;
drop table if exists public.content_revision_evidence;
drop table if exists public.claims;
drop table if exists public.entity_source_keys;
drop table if exists public.sync_events;
drop table if exists public.staging_records;
drop table if exists public.import_runs;
drop table if exists public.evidence_records;
drop table if exists public.source_snapshots;
drop table if exists public.source_registry;
drop table if exists public.unknowns;
drop table if exists public.conflicts;

-- 5. Enums that only the dropped tables used.
drop type if exists public.claim_status;
drop type if exists public.authority_level;
drop type if exists public.import_status;
drop type if exists public.staging_state;
