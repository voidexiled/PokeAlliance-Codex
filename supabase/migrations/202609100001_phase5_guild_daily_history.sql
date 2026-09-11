-- Alliance Codex / Phase 5
-- One replaceable cumulative guild export per canonical Server Save date.
-- The current row is query-friendly; the revision log keeps replacement auditability.

create table public.guild_daily_exports (
  daily_export_id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(guild_id) on delete cascade,
  observation_date date not null,
  week_start_date date not null,
  exported_at timestamptz not null,
  server_save_zone text not null default 'America/Sao_Paulo',
  source_snapshot_id uuid references public.source_snapshots(snapshot_id),
  source_locator text not null,
  payload_digest char(64) not null,
  member_count integer not null default 0,
  replaced_count integer not null default 0,
  first_imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guild_daily_export_source_not_blank check (length(trim(source_locator)) > 0),
  constraint guild_daily_export_zone check (server_save_zone = 'America/Sao_Paulo'),
  constraint guild_daily_export_week_start check (
    week_start_date = date_trunc('week', observation_date::timestamp)::date
  ),
  constraint guild_daily_export_digest_sha256 check (
    payload_digest ~ '^[A-Fa-f0-9]{64}$'
  ),
  constraint guild_daily_export_member_count_nonnegative check (member_count >= 0),
  constraint guild_daily_export_replaced_count_nonnegative check (replaced_count >= 0),
  unique (guild_id, daily_export_id),
  unique (guild_id, observation_date)
);

create index guild_daily_exports_week_idx
  on public.guild_daily_exports (guild_id, week_start_date, observation_date desc);

create table public.guild_daily_export_revisions (
  revision_id uuid primary key default gen_random_uuid(),
  daily_export_id uuid not null references public.guild_daily_exports(daily_export_id) on delete cascade,
  payload_digest char(64) not null,
  source_locator text not null,
  member_count integer not null default 0,
  imported_at timestamptz not null default now(),
  constraint guild_daily_revision_source_not_blank check (length(trim(source_locator)) > 0),
  constraint guild_daily_revision_digest_sha256 check (
    payload_digest ~ '^[A-Fa-f0-9]{64}$'
  ),
  constraint guild_daily_revision_member_count_nonnegative check (member_count >= 0),
  unique (daily_export_id, payload_digest)
);

create index guild_daily_export_revisions_history_idx
  on public.guild_daily_export_revisions (daily_export_id, imported_at desc);

create table public.guild_daily_member_totals (
  guild_id uuid not null references public.guilds(guild_id) on delete cascade,
  daily_export_id uuid not null,
  guild_member_id uuid not null,
  source_member_key text not null,
  observed_display_name text,
  level integer,
  dailies_completed integer not null default 0,
  rank text,
  status text,
  contribution numeric not null default 0,
  last_login_label text,
  primary key (daily_export_id, guild_member_id),
  constraint guild_daily_totals_export_scope_fk foreign key (guild_id, daily_export_id)
    references public.guild_daily_exports(guild_id, daily_export_id) on delete cascade,
  constraint guild_daily_totals_member_scope_fk foreign key (guild_id, guild_member_id)
    references public.guild_members(guild_id, guild_member_id) on delete cascade,
  constraint guild_daily_totals_member_key_not_blank check (length(trim(source_member_key)) > 0),
  constraint guild_daily_totals_level_nonnegative check (level is null or level >= 0),
  constraint guild_daily_totals_dailies_nonnegative check (dailies_completed >= 0),
  constraint guild_daily_totals_contribution_nonnegative check (contribution >= 0)
);

create index guild_daily_member_totals_member_idx
  on public.guild_daily_member_totals (guild_member_id, daily_export_id);

create view public.guild_daily_member_deltas
with (security_invoker = true)
as
with ordered as (
  select
    exports.guild_id,
    exports.daily_export_id,
    exports.observation_date,
    exports.week_start_date,
    totals.guild_member_id,
    totals.source_member_key,
    totals.observed_display_name,
    totals.level,
    totals.rank,
    totals.status,
    totals.dailies_completed,
    totals.contribution,
    lag(exports.observation_date) over member_window as previous_observation_date,
    lag(totals.dailies_completed) over member_window as previous_dailies_completed,
    lag(totals.contribution) over member_window as previous_contribution
  from public.guild_daily_exports as exports
  join public.guild_daily_member_totals as totals
    on totals.guild_id = exports.guild_id
   and totals.daily_export_id = exports.daily_export_id
  window member_window as (
    partition by exports.guild_id, exports.week_start_date, totals.guild_member_id
    order by exports.observation_date
  )
)
select
  ordered.guild_id,
  ordered.daily_export_id,
  ordered.observation_date,
  ordered.week_start_date,
  ordered.guild_member_id,
  ordered.source_member_key,
  ordered.observed_display_name,
  ordered.level,
  ordered.rank,
  ordered.status,
  ordered.dailies_completed,
  ordered.contribution,
  ordered.previous_observation_date,
  case
    when ordered.previous_observation_date is null then ordered.dailies_completed
    else greatest(ordered.dailies_completed - ordered.previous_dailies_completed, 0)
  end as daily_dailies,
  case
    when ordered.previous_observation_date is null then ordered.contribution
    else greatest(ordered.contribution - ordered.previous_contribution, 0)
  end as daily_contribution,
  case
    when ordered.previous_observation_date is null then 'baseline'
    when ordered.dailies_completed < ordered.previous_dailies_completed
      or ordered.contribution < ordered.previous_contribution then 'decrease_detected'
    else 'delta'
  end as delta_status
from ordered;

create or replace function public.create_guild(
  p_guild_key text,
  p_world_key text default 'unknown',
  p_display_name text default null
)
returns public.guilds
language plpgsql
security definer
set search_path = public
as $$
declare
  created_guild public.guilds;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to create a guild' using errcode = '28000';
  end if;

  insert into public.guilds (owner_user_id, guild_key, world_key, display_name)
  values (auth.uid(), trim(p_guild_key), coalesce(nullif(trim(p_world_key), ''), 'unknown'), nullif(trim(p_display_name), ''))
  returning * into created_guild;

  insert into public.guild_memberships (guild_id, user_id, role)
  values (created_guild.guild_id, auth.uid(), 'owner');

  return created_guild;
end;
$$;

create or replace function public.replace_guild_daily_export(
  p_guild_id uuid,
  p_exported_at timestamptz,
  p_source_locator text,
  p_payload_digest text,
  p_members jsonb,
  p_source_snapshot_id uuid default null
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
     or nullif(trim(p_source_locator), '') is null
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
    source_snapshot_id,
    source_locator,
    payload_digest,
    member_count
  )
  values (
    p_guild_id,
    observation_date_value,
    week_start_date_value,
    p_exported_at,
    p_source_snapshot_id,
    trim(p_source_locator),
    lower(p_payload_digest),
    jsonb_array_length(p_members)
  )
  on conflict (guild_id, observation_date) do update set
    week_start_date = excluded.week_start_date,
    exported_at = excluded.exported_at,
    source_snapshot_id = excluded.source_snapshot_id,
    source_locator = excluded.source_locator,
    payload_digest = excluded.payload_digest,
    member_count = excluded.member_count,
    replaced_count = public.guild_daily_exports.replaced_count + 1,
    updated_at = now()
  returning * into current_export;

  insert into public.guild_daily_export_revisions (
    daily_export_id,
    payload_digest,
    source_locator,
    member_count
  )
  values (
    current_export.daily_export_id,
    lower(p_payload_digest),
    trim(p_source_locator),
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

revoke all on function public.create_guild(text, text, text) from public;
revoke all on function public.replace_guild_daily_export(uuid, timestamptz, text, text, jsonb, uuid) from public;
grant execute on function public.create_guild(text, text, text) to authenticated;
grant execute on function public.replace_guild_daily_export(uuid, timestamptz, text, text, jsonb, uuid) to authenticated;

alter table public.guild_daily_exports enable row level security;
alter table public.guild_daily_export_revisions enable row level security;
alter table public.guild_daily_member_totals enable row level security;

create policy guilds_select_members on public.guilds
  for select using (
    exists (
      select 1 from public.guild_memberships as membership
      where membership.guild_id = guilds.guild_id and membership.user_id = auth.uid()
    )
  );

create policy guilds_update_owner on public.guilds
  for update using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

create policy guild_memberships_select_self on public.guild_memberships
  for select using (user_id = auth.uid());

create policy guild_daily_exports_select_members on public.guild_daily_exports
  for select using (
    exists (
      select 1 from public.guild_memberships as membership
      where membership.guild_id = guild_daily_exports.guild_id and membership.user_id = auth.uid()
    )
  );

create policy guild_daily_revisions_select_members on public.guild_daily_export_revisions
  for select using (
    exists (
      select 1
      from public.guild_daily_exports as exports
      join public.guild_memberships as membership on membership.guild_id = exports.guild_id
      where exports.daily_export_id = guild_daily_export_revisions.daily_export_id
        and membership.user_id = auth.uid()
    )
  );

create policy guild_daily_totals_select_members on public.guild_daily_member_totals
  for select using (
    exists (
      select 1 from public.guild_memberships as membership
      where membership.guild_id = guild_daily_member_totals.guild_id and membership.user_id = auth.uid()
    )
  );

grant select on public.guilds to authenticated;
grant select on public.guild_memberships to authenticated;
grant select on public.guild_daily_exports to authenticated;
grant select on public.guild_daily_export_revisions to authenticated;
grant select on public.guild_daily_member_totals to authenticated;
grant select on public.guild_daily_member_deltas to authenticated;
