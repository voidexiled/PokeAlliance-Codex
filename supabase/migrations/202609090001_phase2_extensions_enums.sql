-- Alliance Codex / Phase 2
-- Shared primitives only. Apply before the dependent domain migrations.

create extension if not exists pgcrypto;

create type public.entity_type as enum (
  'pokemon_species',
  'pokemon_variant',
  'move',
  'item',
  'location',
  'npc',
  'quest',
  'hunt',
  'system',
  'guide'
);

create type public.entity_state as enum ('pending', 'active', 'deprecated');

create type public.variant_kind as enum ('normal', 'shiny', 'mega', 'other');

create type public.combat_mode as enum ('wild', 'pvp', 'training', 'unknown');

create type public.authority_level as enum (
  'first_party',
  'official_candidate',
  'community',
  'historical',
  'discovery_only'
);

create type public.claim_status as enum (
  'confirmed',
  'supported',
  'inferred',
  'unknown',
  'conflicted',
  'deprecated',
  'rejected'
);

create type public.import_status as enum ('queued', 'running', 'completed', 'failed', 'superseded');

create type public.staging_state as enum (
  'received',
  'validated',
  'needs_review',
  'accepted',
  'rejected',
  'superseded'
);

create type public.snapshot_phase as enum ('before_server_save', 'after_server_save');

create type public.snapshot_completeness as enum ('complete', 'partial', 'unknown', 'failed');

create type public.feature_geometry as enum ('point', 'area', 'line');

create type public.map_visibility as enum (
  'pending',
  'approved',
  'stale',
  'rejected',
  'client_minimap_flag'
);

create type public.content_status as enum ('draft', 'in_review', 'published', 'archived');

create type public.translation_status as enum (
  'canonical',
  'human_reviewed',
  'proposed',
  'missing',
  'needs_review',
  'outdated'
);

create type public.locale_code as enum ('es', 'en', 'pt');

create type public.membership_role as enum ('owner', 'officer', 'member');
