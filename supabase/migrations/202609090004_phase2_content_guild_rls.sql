-- Alliance Codex / Phase 2
-- Editorial revisions, private guild observations and the initial RLS boundary.

create or replace function public.set_guild_member_normalized_key()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.member_key_normalized := lower(trim(new.member_key));
  return new;
end;
$$;

create or replace function public.set_guild_member_alias_normalized_key()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.old_member_key_normalized := lower(trim(new.old_member_key));
  return new;
end;
$$;

create table public.content_documents (
  document_id uuid primary key default gen_random_uuid(),
  document_slug text not null unique,
  document_kind text not null,
  canonical_entity_id uuid references public.entities(entity_id),
  status public.content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_document_slug_format check (
    document_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  )
);

create table public.content_revisions (
  revision_id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.content_documents(document_id) on delete cascade,
  revision_number integer not null,
  locale public.locale_code not null,
  title text not null,
  summary text,
  body text not null,
  seo_title text,
  meta_description text,
  status public.content_status not null default 'draft',
  authored_by_user_id uuid references auth.users(id),
  reviewed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (document_id, locale, revision_number),
  constraint content_revision_number_positive check (revision_number > 0),
  constraint content_revision_title_not_blank check (length(trim(title)) > 0),
  constraint content_revision_body_not_blank check (length(trim(body)) > 0),
  constraint content_revision_publish_order check (
    published_at is null or published_at >= created_at
  )
);

create index content_revisions_published_idx
  on public.content_revisions (locale, status, published_at desc);

create table public.content_entity_refs (
  revision_id uuid not null references public.content_revisions(revision_id) on delete cascade,
  entity_id uuid not null references public.entities(entity_id) on delete cascade,
  label text,
  primary key (revision_id, entity_id)
);

create table public.content_revision_evidence (
  revision_id uuid not null references public.content_revisions(revision_id) on delete cascade,
  evidence_key text not null references public.evidence_records(evidence_key),
  primary key (revision_id, evidence_key)
);

create table public.guilds (
  guild_id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id),
  guild_key text not null,
  world_key text not null default 'unknown',
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guild_key_not_blank check (length(trim(guild_key)) > 0),
  constraint guild_world_key_not_blank check (length(trim(world_key)) > 0),
  unique (owner_user_id, guild_key, world_key)
);

create index guilds_owner_idx on public.guilds (owner_user_id, updated_at desc);

create table public.guild_memberships (
  guild_id uuid not null references public.guilds(guild_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.membership_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (guild_id, user_id)
);

create index guild_memberships_user_idx on public.guild_memberships (user_id, guild_id);

create table public.guild_members (
  guild_member_id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(guild_id) on delete cascade,
  member_key text not null,
  member_key_normalized text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  constraint guild_member_key_not_blank check (length(trim(member_key)) > 0),
  constraint guild_member_seen_order check (last_seen_at >= first_seen_at),
  unique (guild_id, member_key_normalized),
  unique (guild_id, guild_member_id)
);

create trigger guild_members_normalize_key
before insert or update of member_key on public.guild_members
for each row execute function public.set_guild_member_normalized_key();

create index guild_members_guild_active_idx
  on public.guild_members (guild_id, active, member_key_normalized);

create table public.guild_member_aliases (
  alias_id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.guilds(guild_id) on delete cascade,
  guild_member_id uuid not null,
  old_member_key text not null,
  old_member_key_normalized text not null,
  new_member_key text not null,
  effective_at timestamptz not null default now(),
  reason text,
  reviewed_by_user_id uuid references auth.users(id),
  constraint guild_alias_keys_not_blank check (
    length(trim(old_member_key)) > 0 and length(trim(new_member_key)) > 0
  ),
  constraint guild_alias_keys_differ check (lower(trim(old_member_key)) <> lower(trim(new_member_key))),
  unique (guild_id, old_member_key_normalized),
  constraint guild_alias_member_scope_fk foreign key (guild_id, guild_member_id)
    references public.guild_members(guild_id, guild_member_id)
);

create trigger guild_member_aliases_normalize_key
before insert or update of old_member_key on public.guild_member_aliases
for each row execute function public.set_guild_member_alias_normalized_key();

create index guild_member_aliases_member_idx
  on public.guild_member_aliases (guild_member_id, effective_at desc);

create table public.guild_snapshots (
  snapshot_id uuid primary key default gen_random_uuid(),
  snapshot_key text not null unique,
  guild_id uuid not null references public.guilds(guild_id) on delete cascade,
  source_snapshot_id uuid references public.source_snapshots(snapshot_id),
  captured_at timestamptz not null,
  phase public.snapshot_phase not null,
  server_save_date date not null,
  server_save_local_time time not null default '00:00:00',
  server_save_zone text not null default 'America/Sao_Paulo',
  visitor_zone text,
  source_kind text not null,
  source_locator text not null,
  payload_digest char(64),
  client_version text,
  completeness public.snapshot_completeness not null,
  member_count integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint guild_snapshot_key_not_blank check (length(trim(snapshot_key)) > 0),
  constraint guild_snapshot_zone_not_blank check (length(trim(server_save_zone)) > 0),
  constraint guild_snapshot_source_not_blank check (length(trim(source_locator)) > 0),
  constraint guild_snapshot_digest_sha256 check (
    payload_digest is null or payload_digest ~ '^[A-Fa-f0-9]{64}$'
  ),
  constraint guild_snapshot_member_count_nonnegative check (member_count is null or member_count >= 0),
  unique (guild_id, snapshot_id)
);

create index guild_snapshots_comparison_idx
  on public.guild_snapshots (guild_id, server_save_date, phase, captured_at desc);

create table public.guild_member_observations (
  guild_id uuid not null references public.guilds(guild_id) on delete cascade,
  snapshot_id uuid not null,
  guild_member_id uuid not null,
  source_member_key text not null,
  observed_display_name text,
  level integer,
  dailies_completed integer,
  rank text,
  status text,
  contribution numeric,
  last_login_label text,
  last_login_at timestamptz,
  field_availability jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  primary key (snapshot_id, guild_member_id),
  constraint guild_observation_snapshot_scope_fk foreign key (guild_id, snapshot_id)
    references public.guild_snapshots(guild_id, snapshot_id) on delete cascade,
  constraint guild_observation_member_scope_fk foreign key (guild_id, guild_member_id)
    references public.guild_members(guild_id, guild_member_id) on delete cascade,
  constraint guild_observation_source_key_not_blank check (length(trim(source_member_key)) > 0),
  constraint guild_observation_level_nonnegative check (level is null or level >= 0),
  constraint guild_observation_dailies_nonnegative check (
    dailies_completed is null or dailies_completed >= 0
  ),
  constraint guild_observation_contribution_nonnegative check (
    contribution is null or contribution >= 0
  )
);

create index guild_member_observations_member_idx
  on public.guild_member_observations (guild_member_id, snapshot_id desc);

-- Private surfaces start deny-by-default. Phase 3 adds and tests policies for
-- owner/officer/member access; enabling RLS now prevents accidental exposure
-- if a table is queried before those policies are installed.
alter table public.guilds enable row level security;
alter table public.guild_memberships enable row level security;
alter table public.guild_members enable row level security;
alter table public.guild_member_aliases enable row level security;
alter table public.guild_snapshots enable row level security;
alter table public.guild_member_observations enable row level security;
