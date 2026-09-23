-- Alliance Codex / knowledge expansion
-- Typed relations for rates, spawns, progression, activities, economy and change history.
-- These tables start deny-by-default. Public pages consume curated build output, not raw rows.

alter type public.entity_type add value if not exists 'activity';
alter type public.entity_type add value if not exists 'progression_milestone';

alter table public.drop_relations
  add column rate_kind text not null default 'unknown',
  add column probability numeric,
  add column probability_min numeric,
  add column probability_max numeric,
  add column quantity_min numeric,
  add column quantity_max numeric,
  add column effective_from timestamptz,
  add column effective_to timestamptz,
  add constraint drop_rate_kind_allowed check (
    rate_kind in ('unknown', 'exact', 'range', 'conditional')
  ),
  add constraint drop_probability_range check (
    probability is null or probability between 0 and 1
  ),
  add constraint drop_probability_min_range check (
    probability_min is null or probability_min between 0 and 1
  ),
  add constraint drop_probability_max_range check (
    probability_max is null or probability_max between 0 and 1
  ),
  add constraint drop_probability_order check (
    probability_min is null or probability_max is null or probability_max >= probability_min
  ),
  add constraint drop_quantity_min_positive check (quantity_min is null or quantity_min > 0),
  add constraint drop_quantity_max_positive check (quantity_max is null or quantity_max > 0),
  add constraint drop_quantity_order check (
    quantity_min is null or quantity_max is null or quantity_max >= quantity_min
  ),
  add constraint drop_effective_order check (
    effective_to is null or effective_from is null or effective_to >= effective_from
  );

create index drop_relations_source_rate_idx
  on public.drop_relations (source_entity_id, rate_kind, probability desc nulls last);

create index drop_relations_effective_idx
  on public.drop_relations (effective_from desc, effective_to)
  where effective_from is not null or effective_to is not null;

create table public.spawn_relations (
  spawn_relation_id uuid primary key default gen_random_uuid(),
  variant_entity_id uuid not null references public.pokemon_variants(variant_entity_id) on delete cascade,
  location_entity_id uuid not null references public.locations(location_entity_id) on delete cascade,
  hunt_entity_id uuid references public.hunts(hunt_entity_id) on delete cascade,
  relationship_key text not null default 'default',
  spawn_kind text not null default 'unknown',
  rate_kind text not null default 'unknown',
  probability numeric,
  probability_min numeric,
  probability_max numeric,
  respawn_seconds_min numeric,
  respawn_seconds_max numeric,
  conditions jsonb not null default '{}'::jsonb,
  effective_from timestamptz,
  effective_to timestamptz,
  created_at timestamptz not null default now(),
  unique nulls not distinct (variant_entity_id, location_entity_id, hunt_entity_id, relationship_key),
  constraint spawn_relationship_key_not_blank check (length(trim(relationship_key)) > 0),
  constraint spawn_rate_kind_allowed check (
    rate_kind in ('unknown', 'exact', 'range', 'conditional')
  ),
  constraint spawn_probability_range check (probability is null or probability between 0 and 1),
  constraint spawn_probability_min_range check (
    probability_min is null or probability_min between 0 and 1
  ),
  constraint spawn_probability_max_range check (
    probability_max is null or probability_max between 0 and 1
  ),
  constraint spawn_probability_order check (
    probability_min is null or probability_max is null or probability_max >= probability_min
  ),
  constraint spawn_respawn_min_nonnegative check (
    respawn_seconds_min is null or respawn_seconds_min >= 0
  ),
  constraint spawn_respawn_max_nonnegative check (
    respawn_seconds_max is null or respawn_seconds_max >= 0
  ),
  constraint spawn_respawn_order check (
    respawn_seconds_min is null
    or respawn_seconds_max is null
    or respawn_seconds_max >= respawn_seconds_min
  ),
  constraint spawn_effective_order check (
    effective_to is null or effective_from is null or effective_to >= effective_from
  )
);

create index spawn_relations_location_variant_idx
  on public.spawn_relations (location_entity_id, variant_entity_id);

create index spawn_relations_hunt_idx
  on public.spawn_relations (hunt_entity_id, variant_entity_id)
  where hunt_entity_id is not null;

create table public.progression_milestones (
  milestone_entity_id uuid primary key references public.entities(entity_id) on delete cascade,
  system_entity_id uuid references public.entities(entity_id),
  milestone_kind text not null,
  ordinal integer,
  requirements jsonb not null default '{}'::jsonb,
  unlocks jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  constraint progression_kind_not_blank check (length(trim(milestone_kind)) > 0),
  constraint progression_ordinal_nonnegative check (ordinal is null or ordinal >= 0)
);

create index progression_milestones_system_idx
  on public.progression_milestones (system_entity_id, ordinal);

create table public.progression_dependencies (
  milestone_entity_id uuid not null references public.progression_milestones(milestone_entity_id) on delete cascade,
  prerequisite_milestone_entity_id uuid not null references public.progression_milestones(milestone_entity_id) on delete cascade,
  dependency_kind text not null default 'required',
  conditions jsonb not null default '{}'::jsonb,
  primary key (milestone_entity_id, prerequisite_milestone_entity_id, dependency_kind),
  constraint progression_dependency_no_self check (
    milestone_entity_id <> prerequisite_milestone_entity_id
  )
);

create index progression_dependencies_prerequisite_idx
  on public.progression_dependencies (prerequisite_milestone_entity_id, milestone_entity_id);

create table public.activities (
  activity_entity_id uuid primary key references public.entities(entity_id) on delete cascade,
  activity_kind text not null,
  location_entity_id uuid references public.locations(location_entity_id),
  schedule_rule_key text references public.game_schedule_rules(rule_key),
  requirements jsonb not null default '{}'::jsonb,
  mechanics jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  constraint activity_kind_not_blank check (length(trim(activity_kind)) > 0)
);

create index activities_location_kind_idx
  on public.activities (location_entity_id, activity_kind);

create table public.activity_rewards (
  activity_reward_id uuid primary key default gen_random_uuid(),
  activity_entity_id uuid not null references public.activities(activity_entity_id) on delete cascade,
  reward_entity_id uuid references public.entities(entity_id),
  reward_key text,
  quantity_min numeric,
  quantity_max numeric,
  probability numeric,
  conditions jsonb not null default '{}'::jsonb,
  ordinal integer not null default 1,
  unique nulls not distinct (activity_entity_id, ordinal, reward_entity_id, reward_key),
  constraint activity_reward_has_reference check (
    reward_entity_id is not null or reward_key is not null
  ),
  constraint activity_reward_quantity_min_positive check (
    quantity_min is null or quantity_min > 0
  ),
  constraint activity_reward_quantity_max_positive check (
    quantity_max is null or quantity_max > 0
  ),
  constraint activity_reward_quantity_order check (
    quantity_min is null or quantity_max is null or quantity_max >= quantity_min
  ),
  constraint activity_reward_probability_range check (
    probability is null or probability between 0 and 1
  ),
  constraint activity_reward_ordinal_positive check (ordinal > 0)
);

create index activity_rewards_reward_idx
  on public.activity_rewards (reward_entity_id, activity_entity_id)
  where reward_entity_id is not null;

create table public.economy_entries (
  economy_entry_id uuid primary key default gen_random_uuid(),
  subject_entity_id uuid not null references public.entities(entity_id) on delete cascade,
  vendor_npc_entity_id uuid references public.npcs(npc_entity_id),
  location_entity_id uuid references public.locations(location_entity_id),
  currency_item_entity_id uuid references public.items(item_entity_id),
  entry_kind text not null,
  amount numeric,
  quantity numeric not null default 1,
  conditions jsonb not null default '{}'::jsonb,
  effective_from timestamptz,
  effective_to timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint economy_entry_kind_allowed check (
    entry_kind in ('purchase', 'sale', 'exchange', 'fee', 'reward', 'other')
  ),
  constraint economy_amount_positive check (amount is null or amount > 0),
  constraint economy_quantity_positive check (quantity > 0),
  constraint economy_effective_order check (
    effective_to is null or effective_from is null or effective_to >= effective_from
  )
);

create index economy_entries_subject_kind_idx
  on public.economy_entries (subject_entity_id, entry_kind, effective_from desc);

create index economy_entries_vendor_idx
  on public.economy_entries (vendor_npc_entity_id, location_entity_id)
  where vendor_npc_entity_id is not null;

create table public.change_events (
  change_event_id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  event_kind text not null default 'update',
  title text not null,
  summary text,
  published_at timestamptz,
  effective_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint change_event_key_not_blank check (length(trim(event_key)) > 0),
  constraint change_event_title_not_blank check (length(trim(title)) > 0)
);

create index change_events_effective_idx
  on public.change_events (coalesce(effective_at, published_at) desc);

create table public.change_event_entities (
  change_event_id uuid not null references public.change_events(change_event_id) on delete cascade,
  entity_id uuid not null references public.entities(entity_id) on delete cascade,
  relation_kind text not null default 'affected',
  details jsonb not null default '{}'::jsonb,
  primary key (change_event_id, entity_id, relation_kind)
);

create index change_event_entities_entity_idx
  on public.change_event_entities (entity_id, change_event_id);

alter table public.spawn_relations enable row level security;
alter table public.progression_milestones enable row level security;
alter table public.progression_dependencies enable row level security;
alter table public.activities enable row level security;
alter table public.activity_rewards enable row level security;
alter table public.economy_entries enable row level security;
alter table public.change_events enable row level security;
alter table public.change_event_entities enable row level security;
alter table public.drop_relations enable row level security;

revoke all on table public.spawn_relations from public, anon, authenticated;
revoke all on table public.progression_milestones from public, anon, authenticated;
revoke all on table public.progression_dependencies from public, anon, authenticated;
revoke all on table public.activities from public, anon, authenticated;
revoke all on table public.activity_rewards from public, anon, authenticated;
revoke all on table public.economy_entries from public, anon, authenticated;
revoke all on table public.change_events from public, anon, authenticated;
revoke all on table public.change_event_entities from public, anon, authenticated;
revoke all on table public.drop_relations from public, anon, authenticated;
