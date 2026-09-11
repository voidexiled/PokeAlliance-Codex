-- Alliance Codex / Phase 2
-- Canonical identity, typed game domains, claims and map projections.

create or replace function public.set_entity_alias_normalized_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.normalized_alias := lower(trim(new.alias));
  new.locale_key := coalesce(new.locale::text, 'und');
  return new;
end;
$$;

create table public.entities (
  entity_id uuid primary key default gen_random_uuid(),
  entity_type public.entity_type not null,
  canonical_slug text not null unique,
  canonical_name text not null,
  state public.entity_state not null default 'pending',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint entity_slug_format check (canonical_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint entity_name_not_blank check (length(trim(canonical_name)) > 0)
);

create index entities_type_state_idx
  on public.entities (entity_type, state, canonical_name);

create table public.entity_aliases (
  alias_id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.entities(entity_id) on delete cascade,
  alias text not null,
  normalized_alias text not null,
  locale public.locale_code,
  locale_key text not null default 'und',
  alias_kind text not null default 'source',
  created_at timestamptz not null default now(),
  constraint entity_alias_not_blank check (length(trim(alias)) > 0),
  unique (entity_id, normalized_alias, locale_key)
);

create trigger entity_aliases_normalize_fields
before insert or update of alias, locale on public.entity_aliases
for each row execute function public.set_entity_alias_normalized_fields();

create index entity_aliases_lookup_idx
  on public.entity_aliases (normalized_alias, locale);

create table public.entity_localizations (
  entity_id uuid not null references public.entities(entity_id) on delete cascade,
  locale public.locale_code not null,
  display_name text,
  summary text,
  translation_state public.translation_status not null default 'needs_review',
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (entity_id, locale),
  constraint entity_localization_has_text check (
    display_name is not null or summary is not null
  )
);

create table public.pokemon_species (
  species_entity_id uuid primary key references public.entities(entity_id) on delete cascade,
  national_dex_number integer,
  generation integer,
  constraint pokemon_dex_positive check (
    national_dex_number is null or national_dex_number > 0
  ),
  constraint pokemon_generation_positive check (generation is null or generation > 0)
);

create index pokemon_species_dex_idx
  on public.pokemon_species (national_dex_number);

create table public.pokemon_variants (
  variant_entity_id uuid primary key references public.entities(entity_id) on delete cascade,
  species_entity_id uuid not null references public.pokemon_species(species_entity_id),
  variant_kind public.variant_kind not null,
  source_variant_key text,
  is_default boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  unique (species_entity_id, variant_entity_id)
);

create index pokemon_variants_species_kind_idx
  on public.pokemon_variants (species_entity_id, variant_kind);

create table public.elements (
  element_key text primary key,
  canonical_name text not null,
  constraint element_key_not_blank check (length(trim(element_key)) > 0)
);

create table public.pokemon_variant_elements (
  variant_entity_id uuid not null references public.pokemon_variants(variant_entity_id) on delete cascade,
  element_key text not null references public.elements(element_key),
  is_primary boolean not null default false,
  primary key (variant_entity_id, element_key)
);

create unique index pokemon_variant_one_primary_element_uidx
  on public.pokemon_variant_elements (variant_entity_id)
  where is_primary;

create table public.moves (
  move_entity_id uuid primary key references public.entities(entity_id) on delete cascade,
  move_kind text not null default 'combat',
  metadata jsonb not null default '{}'::jsonb
);

create table public.pokemon_variant_moves (
  variant_entity_id uuid not null references public.pokemon_variants(variant_entity_id) on delete cascade,
  move_entity_id uuid not null references public.moves(move_entity_id),
  combat_mode public.combat_mode not null default 'unknown',
  relationship_key text not null default 'default',
  slot smallint,
  cooldown_seconds numeric,
  conditions jsonb not null default '{}'::jsonb,
  effect jsonb not null default '{}'::jsonb,
  damage_model jsonb not null default '{}'::jsonb,
  primary key (variant_entity_id, move_entity_id, combat_mode, relationship_key),
  constraint move_slot_positive check (slot is null or slot > 0),
  constraint move_cooldown_nonnegative check (cooldown_seconds is null or cooldown_seconds >= 0)
);

create index pokemon_variant_moves_move_idx
  on public.pokemon_variant_moves (move_entity_id, combat_mode);

create table public.items (
  item_entity_id uuid primary key references public.entities(entity_id) on delete cascade,
  item_kind text not null default 'unknown',
  metadata jsonb not null default '{}'::jsonb
);

create table public.locations (
  location_entity_id uuid primary key references public.entities(entity_id) on delete cascade,
  location_kind text not null,
  parent_location_entity_id uuid references public.locations(location_entity_id),
  region_key text,
  metadata jsonb not null default '{}'::jsonb
);

create index locations_parent_kind_idx
  on public.locations (parent_location_entity_id, location_kind);

create table public.npcs (
  npc_entity_id uuid primary key references public.entities(entity_id) on delete cascade,
  location_entity_id uuid references public.locations(location_entity_id),
  metadata jsonb not null default '{}'::jsonb
);

create index npcs_location_idx on public.npcs (location_entity_id);

create table public.hunts (
  hunt_entity_id uuid primary key references public.entities(entity_id) on delete cascade,
  location_entity_id uuid references public.locations(location_entity_id),
  metadata jsonb not null default '{}'::jsonb
);

create table public.hunt_pokemon (
  hunt_entity_id uuid not null references public.hunts(hunt_entity_id) on delete cascade,
  variant_entity_id uuid not null references public.pokemon_variants(variant_entity_id),
  relationship_key text not null default 'default',
  conditions jsonb not null default '{}'::jsonb,
  primary key (hunt_entity_id, variant_entity_id, relationship_key)
);

create index hunt_pokemon_variant_idx on public.hunt_pokemon (variant_entity_id);

create table public.quests (
  quest_entity_id uuid primary key references public.entities(entity_id) on delete cascade,
  required_level integer,
  repeatability text,
  metadata jsonb not null default '{}'::jsonb,
  constraint quest_required_level_positive check (
    required_level is null or required_level >= 0
  ),
  constraint quest_repeatability_allowed check (
    repeatability is null or repeatability in ('one_time', 'repeatable', 'unknown')
  )
);

create table public.quest_steps (
  quest_step_id uuid primary key default gen_random_uuid(),
  quest_entity_id uuid not null references public.quests(quest_entity_id) on delete cascade,
  ordinal integer not null,
  title text,
  instructions text,
  location_entity_id uuid references public.locations(location_entity_id),
  npc_entity_id uuid references public.npcs(npc_entity_id),
  conditions jsonb not null default '{}'::jsonb,
  unique (quest_entity_id, ordinal),
  constraint quest_step_ordinal_positive check (ordinal > 0)
);

create table public.quest_rewards (
  quest_reward_id uuid primary key default gen_random_uuid(),
  quest_entity_id uuid not null references public.quests(quest_entity_id) on delete cascade,
  ordinal integer not null,
  reward_entity_id uuid references public.entities(entity_id),
  reward_key text,
  quantity numeric,
  description text,
  unique (quest_entity_id, ordinal),
  constraint quest_reward_ordinal_positive check (ordinal > 0),
  constraint quest_reward_has_reference check (
    reward_entity_id is not null or reward_key is not null or description is not null
  ),
  constraint quest_reward_quantity_positive check (quantity is null or quantity > 0)
);

create table public.drop_relations (
  source_entity_id uuid not null references public.entities(entity_id) on delete cascade,
  item_entity_id uuid not null references public.items(item_entity_id),
  relationship_key text not null default 'default',
  quantity jsonb not null default '{}'::jsonb,
  conditions jsonb not null default '{}'::jsonb,
  primary key (source_entity_id, item_entity_id, relationship_key)
);

create index drop_relations_item_idx on public.drop_relations (item_entity_id);

create table public.evolution_edges (
  from_entity_id uuid not null references public.entities(entity_id) on delete cascade,
  to_entity_id uuid not null references public.entities(entity_id),
  relationship_key text not null default 'default',
  requirements jsonb not null default '{}'::jsonb,
  primary key (from_entity_id, to_entity_id, relationship_key),
  constraint evolution_no_self_edge check (from_entity_id <> to_entity_id)
);

create table public.travel_connections (
  travel_connection_id uuid primary key default gen_random_uuid(),
  from_location_entity_id uuid not null references public.locations(location_entity_id),
  to_location_entity_id uuid not null references public.locations(location_entity_id),
  travel_mode text not null,
  requirements jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  constraint travel_connection_no_self_edge check (
    from_location_entity_id <> to_location_entity_id
  )
);

create index travel_connections_route_idx
  on public.travel_connections (from_location_entity_id, to_location_entity_id, travel_mode);

create table public.game_schedule_rules (
  rule_key text primary key,
  label text not null,
  local_time time not null,
  iana_time_zone text not null,
  recurrence text not null default 'daily',
  source_key text references public.source_registry(source_key),
  active boolean not null default true,
  notes text,
  constraint schedule_rule_key_not_blank check (length(trim(rule_key)) > 0),
  constraint schedule_rule_zone_not_blank check (length(trim(iana_time_zone)) > 0),
  constraint schedule_rule_recurrence_allowed check (recurrence in ('daily', 'weekly', 'event'))
);

create table public.claims (
  claim_id uuid primary key default gen_random_uuid(),
  subject_entity_id uuid references public.entities(entity_id) on delete cascade,
  predicate text not null,
  value jsonb not null,
  status public.claim_status not null,
  confidence numeric,
  rationale text,
  observed_at timestamptz,
  effective_from timestamptz,
  effective_to timestamptz,
  normalizer_version text not null,
  curated_override boolean not null default false,
  published_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint claim_predicate_not_blank check (length(trim(predicate)) > 0),
  constraint claim_confidence_range check (confidence is null or confidence between 0 and 1),
  constraint claim_effective_order check (
    effective_to is null or effective_from is null or effective_to >= effective_from
  ),
  constraint claim_reviewed_order check (reviewed_at is null or reviewed_at >= created_at)
);

create index claims_subject_predicate_status_idx
  on public.claims (subject_entity_id, predicate, status, effective_from desc);

create index claims_published_idx
  on public.claims (status, published_at desc)
  where published_at is not null;

create table public.claim_evidence (
  claim_id uuid not null references public.claims(claim_id) on delete cascade,
  evidence_key text not null references public.evidence_records(evidence_key),
  primary key (claim_id, evidence_key)
);

create table public.entity_source_keys (
  source_key text not null references public.source_registry(source_key),
  source_record_key text not null,
  entity_id uuid not null references public.entities(entity_id) on delete cascade,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  state public.entity_state not null default 'active',
  primary key (source_key, source_record_key),
  constraint entity_source_record_key_not_blank check (length(trim(source_record_key)) > 0),
  constraint entity_source_seen_order check (last_seen_at >= first_seen_at)
);

create index entity_source_keys_entity_idx
  on public.entity_source_keys (entity_id, source_key);

create table public.sync_events (
  sync_event_id uuid primary key default gen_random_uuid(),
  run_id uuid references public.import_runs(run_id),
  target_type text not null,
  target_id uuid,
  action text not null,
  before_value jsonb,
  after_value jsonb,
  curated_override boolean not null default false,
  created_at timestamptz not null default now(),
  constraint sync_event_action_allowed check (
    action in ('insert', 'update', 'deprecate', 'reject', 'restore', 'review')
  )
);

create index sync_events_target_created_idx
  on public.sync_events (target_type, target_id, created_at desc);

create table public.map_features (
  map_feature_id uuid primary key default gen_random_uuid(),
  feature_kind text not null,
  map_key text,
  world_key text,
  geometry_type public.feature_geometry not null default 'point',
  coordinate_system text not null default 'pokealliance-game',
  x integer,
  y integer,
  z integer,
  geometry_payload jsonb not null default '{}'::jsonb,
  icon_key text,
  label text,
  visibility public.map_visibility not null default 'pending',
  source_snapshot_id uuid references public.source_snapshots(snapshot_id),
  contributor_user_id uuid references auth.users(id),
  reviewed_by_user_id uuid references auth.users(id),
  captured_at timestamptz,
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint map_feature_coordinate_system_not_blank check (length(trim(coordinate_system)) > 0),
  constraint map_feature_review_order check (reviewed_at is null or captured_at is null or reviewed_at >= captured_at)
);

create index map_features_lookup_idx
  on public.map_features (world_key, map_key, z, feature_kind, visibility);

create index map_features_coordinates_idx
  on public.map_features (x, y, z)
  where x is not null and y is not null;

create table public.map_feature_relations (
  map_feature_id uuid not null references public.map_features(map_feature_id) on delete cascade,
  entity_id uuid not null references public.entities(entity_id) on delete cascade,
  relation_kind text not null,
  primary key (map_feature_id, entity_id, relation_kind),
  constraint map_relation_kind_allowed check (
    relation_kind in ('location', 'hunt', 'npc', 'quest', 'travel_connection', 'pokemon_variant', 'other')
  )
);

create index map_feature_relations_entity_idx
  on public.map_feature_relations (entity_id, relation_kind);
