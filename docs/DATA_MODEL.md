# Definitive data model

Status: consolidated in Phase 2 (2026-09-09). This document replaces the database assumptions in `DATA_STRATEGY.md` and the provisional choices in `ARCHITECTURE_PROPOSAL.md`.

## 1. What the evidence changed

The model is deliberately more conservative than the original product brief:

- A Pokémon species and a playable/observed variant are different identities. `normal`, `shiny`, `mega` and future forms are explicit variants; they are never silently merged because a public route, a display name or a sprite looks similar.
- Names are attributes and aliases, not primary keys. Canonical slugs are stable, lowercase and locale-independent. The unresolved difference between the administrator wiki's 530 headline and its 910 variant-inclusive rows remains a scope conflict rather than a forced count.
- Locations, NPCs, quests and Pokémon spawn points are separate domains. A location page can exist without a coordinate, and a map feature can exist without a semantic label.
- The client minimap currently proves game coordinates and marker records, but not the meaning of every tile or the payload behind Pokédex location search. The schema therefore supports coordinates with explicit coordinate-system metadata and keeps unresolved relations pending.
- The guild export proves a useful observation shape but not a stable account/member ID. The in-game name is the functional member key within a guild/world scope; aliases preserve continuity when a name is changed or corrected.
- Evidence is field-level. A row cannot become “official” merely because the page containing it is official-candidate; each published fact retains evidence, status, observation time and normalizer version.

The database is the curated serving model. Raw pages, client files and exports do not become public database rows automatically.

## 2. Identity and relationships

### 2.1 Shared identity registry

`entities` is the small, typed registry used by cross-domain references:

| Entity type | Purpose | Canonical child table |
| --- | --- | --- |
| `pokemon_species` | Species-level identity and optional Pokédex number | `pokemon_species` |
| `pokemon_variant` | A normal, shiny, mega or future observed form | `pokemon_variants` |
| `move` | Move identity | `moves` |
| `item` | Item identity | `items` |
| `location` | Region, city, area, hunt, dungeon or service place | `locations` |
| `npc` | NPC identity | `npcs` |
| `quest` | Quest identity | `quests` |
| `hunt` | Hunt/task activity | `hunts` |
| `system` | Game-system concept such as Stars or Server Save | `entities` plus claims |
| `guide` | Editorial subject when it is useful to link it as an entity | `content_documents` |

Every entity has one global canonical slug and one canonical name. Localized names live in `entity_localizations`; alternate source spellings live in `entity_aliases`.

`pokemon_variants.species_entity_id` points to the species. `pokemon_variant_elements`, `pokemon_variant_moves`, `hunt_pokemon`, `drop_relations`, `evolution_edges`, `travel_connections` and `map_feature_relations` provide typed relationships without encoding game facts in unbounded JSON.

The database does not impose “one normal variant per species” or “one location per Pokémon”. The evidence already shows variants and many-to-many locations; future forms can be added without a destructive migration.

### 2.2 Facts and irregular fields

Core queryable relationships use typed tables. Uncertain, changing, source-specific or irregular values use `claims.value` as JSONB with a named `predicate`. Examples:

- `tier`, `role`, `required_level`, `cooldown_seconds`, `conditions`, `damage_model`;
- exact shiny/rotation assertions and their effective dates;
- quest reward text that has not yet been normalized into an item/entity;
- an API field that is observed but whose semantics are not established.

JSONB is an escape hatch for irregular facts, not a replacement for the entity model. A predicate must be documented in the relevant domain contract and must have evidence.

## 3. Provenance, review and correction

The provenance chain is:

```text
source_registry
  -> source_snapshots / evidence_records
      -> claims and/or staging_records
          -> curated entities, typed relations and published content
```

- `source_registry` describes a source, its authority classification, scope, languages and freshness.
- `source_snapshots` records a point-in-time digest/locator for a feed, local file snapshot, OTMM/config observation or guild export.
- `evidence_records` stores a short locator and digest, with optional excerpt only when retention is permitted. It is not a raw copyrighted-content vault.
- `claims` store one asserted fact with `subject`, `predicate`, JSON value, confidence, status, observation/effective dates, rationale and normalizer version.
- `claim_evidence` is many-to-many because one fact can be triangulated and one evidence record can support several facts.
- `conflicts` and `unknowns` are first-class registries. A disagreement is not erased by overwriting one source; a correction adds a new claim and deprecates the old one when reviewed.

Canonical domain tables are projections of reviewed claims. They may contain a `source_snapshot_id` where a whole structured observation is the direct origin, while field-level claims remain the audit trail for disputed or evolving values.

Status mapping from Phase 1 interchange records:

| Research status | Canonical handling |
| --- | --- |
| `supported` | `claims.status = supported`; publish only when review rules allow it |
| `conflicted` | `claims.status = conflicted`; surface conflict and do not present as settled |
| `unverified` | staging issue or `claims.status = unknown`; never silently upgrade |
| `outdated` | new observation plus old claim `deprecated` |
| `confirmed` | reserved for reviewed, directly attributable evidence |
| `inferred` | explicit inference with rationale and lower confidence |

## 4. Editorial, localization and SEO

`content_documents` is the stable editorial identity. `content_revisions` is versioned, localized content. `content_entity_refs` links a revision to entities for internal navigation and validation.

- Product publication starts with `/es/` and `/en/`; Portuguese remains a source language and can be added as a product locale later.
- Entity IDs and canonical slugs never change with locale.
- A resolver tries requested locale, reviewed canonical game terminology, then an explicit “not translated/review required” state. It never silently invents a translation for a gameplay value.
- Every published revision has localized title/summary/body and SEO metadata. `hreflang`, canonical URLs, Open Graph and sitemap entries are generated from the same locale resolver.
- Game names, tiers, item names and move names remain canonical terms unless an approved localization is stored.
- Content can cite evidence through `content_revision_evidence`; editorial prose does not become authoritative gameplay data without a claim or typed relation.

## 5. Temporal model

All instants are stored as `timestamptz` and interpreted in UTC. Civil schedules are stored as a local wall-clock time plus an IANA zone in `game_schedule_rules`.

The current Server Save candidate is represented as:

```text
localTime = 00:00:00
ianaTimeZone = America/Sao_Paulo
recurrence = daily
```

The application must use Temporal for conversion and formatting. It must calculate the instant from the schedule and requested date, then render the viewer's zone. A guild snapshot stores both the absolute `captured_at` and the canonical server-save date/phase used for comparison. The visitor zone is metadata, never the source of truth.

No date is stored as a locale-formatted string. `last_login_label` in guild observations is retained only as source display text; a future parsed `last_login_at` is nullable and is never fabricated from an ambiguous label.

## 6. Map model

`map_features` stores a coordinate-aware feature independent of its meaning:

- `x`, `y`, `z` are game coordinates, not latitude/longitude;
- `map_key`/`world_key` disambiguate maps or worlds;
- `geometry_type` supports point now and area/line later;
- `geometry_payload` carries irregular geometry only after the coordinate system is known;
- `visibility` differentiates client-observed, approved, stale, rejected and pending data;
- `map_feature_relations` connects the feature to a location, NPC, quest, hunt, travel point or Pokémon variant.

The current OTMM/config records can enter as reviewed client observations with a source snapshot. Colored minimap tiles do not become named places automatically. Player contributions enter as pending features/claims, retain capture instant and contributor review metadata, and require manual review before publication. The Pokémon “Buscar localização” payload is an explicit future source, not assumed to exist in the current normalized data.

## 7. Guild snapshots and comparison

Guild data is private user data, not public wiki content:

```text
guilds
  -> guild_memberships (auth user access and role)
  -> guild_members (functional in-game name key)
      -> guild_member_aliases (rename history)
      -> guild_member_observations <- guild_snapshots
```

`guild_snapshots` stores the source digest/locator, completeness (`complete`, `partial`, `unknown`, `failed`), client version, capture instant, phase (`before_server_save` or `after_server_save`) and canonical Server Save details. The raw JSON export stays outside Git in the owner-authorized, Git-ignored inbox; the database stores structured observations and hashes, not an unrestricted raw export.

The comparison engine joins observations by `guild_member_id`, which is stable inside the application. A first sighting creates the member from the normalized in-game name. A reviewed rename creates a `guild_member_aliases` row. Missing from one snapshot, unavailable source fields and a genuine zero are distinct states through `field_availability` and snapshot completeness.

For the daily guild workflow, `guild_daily_exports` is the current replaceable cumulative export for one guild and one canonical Brazil-local observation date. A second import for the same date updates that current row and rebuilds `guild_daily_member_totals` in one transaction; `guild_daily_export_revisions` retains the previous payload digest and import locator for audit. `guild_daily_member_deltas` compares cumulative dailies/contribution with the previous observed export in the same week. The first export in a week is a `baseline`, a lower cumulative value is `decrease_detected` rather than invented negative activity, and normal increases are `delta` rows. The application must show gaps and baselines instead of pretending that a late first export contains historical daily data.

RLS is enabled for guild tables in the initial migration. Phase 3 will add tested policies for owner/officer/member access; until those policies exist, the default deny behavior is intentional.

## 8. Imports and synchronization

Every importer creates an `import_runs` row and idempotent `staging_records` keyed by `(run_id, staging_key)` with a record hash. Importers must:

1. identify source and input digest;
2. validate structure and retain issues;
3. map source keys through `entity_source_keys`;
4. propose entities/claims/relations;
5. require review for conflicts, inferred values, asset reuse and map contributions;
6. upsert only the reviewed projection;
7. record `sync_events` with before/after JSON and never silently delete a fact.

Repeated imports of the same digest are no-ops. A changed source creates a new run and deprecates stale projections only after reconciliation. Manual editorial overrides survive re-import and are identified in sync events.

Discord changelog messages remain a manual evidence path. Launcher `cache/feed.json` can use the same importer contract when its digest changes. No Discord bot is a Phase 2 dependency.

## 9. Initial PostgreSQL shape and indexes

The initial migrations are in `supabase/migrations/` and execute in this order:

1. `0001`: `pgcrypto` and shared enums.
2. `0002`: source registry, evidence, snapshots, import and staging governance.
3. `0003`: entities, typed game domains, claims and map features.
4. `0004`: editorial content, guild snapshots and deny-by-default RLS.

Important uniqueness and access paths:

- unique `entities.canonical_slug`;
- case-folded alias lookup and `(entity_id, alias, locale)` uniqueness;
- unique source keys and source-local keys for idempotent imports;
- `(subject_entity_id, predicate, status, effective_from)` claim index;
- location/hunt, variant/move, hunt/Pokémon and map-feature/entity join indexes;
- unique `(guild_id, member_key_normalized)` and `(guild_id, snapshot_id, member_id)` observation keys;
- snapshot indexes by `(guild_id, server_save_date, phase)` and `captured_at`;
- content uniqueness by `(document_id, locale, revision_number)` and entity references.

PostGIS is intentionally deferred. The measured input is a game-coordinate grid and a 64x64 OTMM tile container; integer x/y/z plus JSON geometry is sufficient for the first map. Add PostGIS only after real area/line queries justify the dependency.

## 10. Phase 2 contract boundary

Included now: definitive identity rules, typed relations, claims/provenance, Temporal storage semantics, localization/content revision model, map contributions, guild observation model, import/sync rules and initial migrations.

Deferred: Astro initialization, Supabase project application, auth screens and RLS policy UX, live Discord ingestion, exact Pokémon spawn payload extraction, complete NPC/quest coordinate coverage, marketplace workflows and production deployment. Those are later phases or explicit research unknowns.
