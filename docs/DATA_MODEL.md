# Definitive data model

Status: consolidated in Phase 2 (2026-09-09); updated 2026-09-18 for D-012. The provenance model (source registry, snapshots, evidence, claims, import runs, staging, sync events, conflicts and unknowns) was removed; migration `20260918220000_remove_provenance.sql` drops it from the database. This document replaces the provisional choices in `ARCHITECTURE_PROPOSAL.md`; `DATA_STRATEGY.md` describes the `content/` files the public site reads.

## 1. Modeling choices

The model is deliberately more conservative than the original product brief:

- A Pokémon species and a playable/observed variant are different identities. `normal`, `shiny`, `mega` and future forms are explicit variants; they are never silently merged because a public route, a display name or a sprite looks similar.
- Names are attributes and aliases, not primary keys. Canonical slugs are stable, lowercase and locale-independent. The unresolved difference between the administrator wiki's 530 headline and its 910 variant-inclusive rows remains a scope conflict rather than a forced count.
- Locations, NPCs, quests and Pokémon spawn points are separate domains. A location page can exist without a coordinate, and a map feature can exist without a semantic label.
- The client minimap currently proves game coordinates and marker records, but not the meaning of every tile or the payload behind Pokédex location search. The schema therefore supports coordinates with explicit coordinate-system metadata and keeps unresolved relations pending.
- The guild export proves a useful observation shape but not a stable account/member ID. The in-game name is the functional member key within a guild/world scope; aliases preserve continuity when a name is changed or corrected.
- Unknown values are `null`, never `0` or a guess.

Public wiki pages are built from the JSON in `content/`. The database serves accounts, guilds and future marketplace features; seeding it from `content/` is later work.

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
| `system` | Game-system concept such as Stars or Server Save | `entities` plus `metadata` |
| `guide` | Editorial subject when it is useful to link it as an entity | `content_documents` |

Every entity has one global canonical slug and one canonical name. Localized names live in `entity_localizations`; alternate spellings live in `entity_aliases`.

`pokemon_variants.species_entity_id` points to the species. `pokemon_variant_elements`, `pokemon_variant_moves`, `hunt_pokemon`, `drop_relations`, `evolution_edges`, `travel_connections` and `map_feature_relations` provide typed relationships without encoding game facts in unbounded JSON.

The database does not impose “one normal variant per species” or “one location per Pokémon”. Variants and many-to-many locations already exist; future forms can be added without a destructive migration.

### 2.2 Irregular fields

Core queryable relationships use typed tables. Irregular values that do not justify a column (for example `damage_model` or move `conditions`) go into the owning table's `metadata` or typed JSONB column under a documented key. JSONB is an escape hatch, not a replacement for the entity model.

## 3. Corrections

A correction edits the value in `content/` (or the row, for database-backed features). Git history is the only change log for game data. No source, evidence, claim status, confidence or verification date is stored (D-012).

## 4. Editorial, localization and SEO

`content_documents` is the stable editorial identity. `content_revisions` is versioned, localized content. `content_entity_refs` links a revision to entities for internal navigation and validation.

- Product publication starts with `/es/` and `/en/`; Portuguese remains a source language and can be added as a product locale later.
- Entity IDs and canonical slugs never change with locale.
- A resolver tries requested locale, reviewed canonical game terminology, then an explicit “not translated/review required” state. It never silently invents a translation for a gameplay value.
- Every published revision has localized title/summary/body and SEO metadata. `hreflang`, canonical URLs, Open Graph and sitemap entries are generated from the same locale resolver.
- Game names, tiers, item names and move names remain canonical terms unless an approved localization is stored.
- Editorial prose does not become gameplay data; game values live in `content/` or in typed relations.

## 5. Temporal model

All instants are stored as `timestamptz` and interpreted in UTC. Civil schedules are stored as a local wall-clock time plus an IANA zone in `game_schedule_rules`.

Server Save is represented as:

```text
localTime = 00:00:00
ianaTimeZone = America/Sao_Paulo
recurrence = daily
```

The application must use Temporal for conversion and formatting. It must calculate the instant from the schedule and requested date, then render the viewer's zone. A guild snapshot stores both the absolute `captured_at` and the canonical server-save date/phase used for comparison. The visitor zone is metadata, never the source of truth.

No date is stored as a locale-formatted string. `last_login_label` in guild observations is retained only as the export's display text; a future parsed `last_login_at` is nullable and is never fabricated from an ambiguous label.

## 6. Map model

`map_features` stores a coordinate-aware feature independent of its meaning:

- `x`, `y`, `z` are game coordinates, not latitude/longitude;
- `map_key`/`world_key` disambiguate maps or worlds;
- `geometry_type` supports point now and area/line later;
- `geometry_payload` carries irregular geometry only after the coordinate system is known;
- `visibility` controls publication (`pending`, `approved`, `stale`, `rejected`, `client_minimap_flag`);
- `map_feature_relations` connects the feature to a location, NPC, quest, hunt, travel point or Pokémon variant.

The current markers and floor images live in `content/map/`. Colored minimap tiles do not become named places automatically. Player contributions enter as pending features and are published only after the owner accepts them. No readable payload behind the Pokémon “Buscar localização” action has been found, so spawn coordinates stay unknown.

## 7. Guild snapshots and comparison

Guild data is private user data, not public wiki content:

```text
guilds
  -> guild_memberships (auth user access and role)
  -> guild_members (functional in-game name key)
      -> guild_member_aliases (rename history)
      -> guild_member_observations <- guild_snapshots
```

`guild_snapshots` stores completeness (`complete`, `partial`, `unknown`, `failed`), capture instant, phase (`before_server_save` or `after_server_save`) and canonical Server Save details. The raw JSON export stays outside Git; the database stores structured observations, not the raw export.

The comparison engine joins observations by `guild_member_id`, which is stable inside the application. A first sighting creates the member from the normalized in-game name. A reviewed rename creates a `guild_member_aliases` row. Missing from one snapshot, unavailable source fields and a genuine zero are distinct states through `field_availability` and snapshot completeness.

For the daily guild workflow, `guild_daily_exports` is the current replaceable cumulative export for one guild and one canonical Brazil-local observation date. A second import for the same date updates that current row and rebuilds `guild_daily_member_totals` in one transaction; `guild_daily_export_revisions` keeps one row per distinct payload digest so importing the same file twice is a no-op. The file name is not stored (D-012; migration `20260918220000` drops the old `source_locator` column). `guild_daily_member_deltas` compares cumulative dailies/contribution with the previous observed export in the same week. The first export in a week is a `baseline`, a lower cumulative value is `decrease_detected` rather than invented negative activity, and normal increases are `delta` rows. The application must show gaps and baselines instead of pretending that a late first export contains historical daily data.

RLS is enabled for guild tables in the initial migration. Phase 3 will add tested policies for owner/officer/member access; until those policies exist, the default deny behavior is intentional.

## 8. Imports

Importers are small scripts that write the JSON in `content/` (see `DATA_STRATEGY.md`). They are idempotent, never delete records and keep hand-edited values unless told to overwrite them. There are no import-run, staging or sync-event tables.

Discord changelog messages are entered by hand. A scheduled launcher-feed importer is a future roadmap item. No Discord bot is a dependency.

## 9. Initial PostgreSQL shape and indexes

The migrations are in `supabase/migrations/` and execute in filename order:

1. `0001`: `pgcrypto` and shared enums.
2. `0002`: the former provenance tables (dropped again by the D-012 migration).
3. `0003`: entities, typed game domains and map features.
4. `0004`: editorial content, guild snapshots and deny-by-default RLS.
5. Phase 5 guild daily history and RPC hardening (`202609100001`, `20260910084452`, `20260910084612`).
6. `20260915192641`: drops, spawns, progression, activities, economy and change events (local, not applied).
7. `20260918220000`: removes the provenance tables, columns and enums, drops `source_locator` from the guild daily exports and their revisions, and recreates `replace_guild_daily_export(p_guild_id, p_exported_at, p_payload_digest, p_members)` without source arguments (local, not applied).

Important uniqueness and access paths:

- unique `entities.canonical_slug`;
- case-folded alias lookup and `(entity_id, alias, locale)` uniqueness;
- location/hunt, variant/move, hunt/Pokémon and map-feature/entity join indexes;
- unique `(guild_id, member_key_normalized)` and `(guild_id, snapshot_id, member_id)` observation keys;
- snapshot indexes by `(guild_id, server_save_date, phase)` and `captured_at`;
- content uniqueness by `(document_id, locale, revision_number)` and entity references.

PostGIS is intentionally deferred. The measured input is a game-coordinate grid and a 64x64 OTMM tile container; integer x/y/z plus JSON geometry is sufficient for the first map. Add PostGIS only after real area/line queries justify the dependency.

## 10. Phase 2 contract boundary

Included now: identity rules, typed relations, Temporal storage semantics, localization/content revision model, map contributions, guild observation model and the migrations.

Deferred: Astro initialization, Supabase project application, auth screens and RLS policy UX, live Discord ingestion, exact Pokémon spawn payload extraction, complete NPC/quest coordinate coverage, marketplace workflows and production deployment. Those are later phases or explicit research unknowns.
