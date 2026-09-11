# Phase 2 exit report — Data Model Consolidation

Date: 2026-09-09
Status: complete
Repository: `C:\Users\jalom\Documents\ChatGPT\PokeAlliance-Codex`

## Outcome

Phase 2 converted the Phase 1 evidence into an implementation-ready relational model without treating unresolved research as fact. The application itself was intentionally not initialized; that begins in Phase 3.

## Completed deliverables

- Definitive model: [DATA_MODEL.md](DATA_MODEL.md).
- Definitive architecture: [ARCHITECTURE.md](ARCHITECTURE.md).
- Historical pre-research reference retained: [ARCHITECTURE_PROPOSAL.md](ARCHITECTURE_PROPOSAL.md).
- Canonical entity/claim interchange contract: `data/schemas/canonical-record.schema.json`.
- Migration README: `supabase/README.md`.
- Four ordered initial migrations under `supabase/migrations/`:
  - shared enums and `pgcrypto`;
  - source/evidence/import/staging governance;
  - entities, variants, typed game relations, claims and map features;
  - editorial revisions, private guild snapshots and RLS boundary.
- Static contract audit: `scripts/research/validate-phase2-model.ps1`.
- Audit output: `data/reports/phase2-model-validation.json`.

## Decisions made from evidence

1. Species, playable variants and source rows are distinct identities. Variant scope is explicit and the 530-vs-910 roster conflict remains visible.
2. Names are searchable attributes; stable slugs and source keys identify records. Guild names are unique functional keys within guild/world scope, with rename aliases.
3. Core queries use typed relational tables. Claims with JSON values preserve uncertain, evolving and irregular fields without turning the entire database into untyped EAV.
4. Every material fact can retain evidence, status, confidence/rationale, observed/effective dates and normalizer version.
5. The map stores game x/y/z coordinates and map/world keys; it does not pretend they are geographic coordinates. Pending community observations and client minimap observations have separate visibility states.
6. Editorial localization is revision-based with explicit `es`/`en` publication paths; Portuguese source language is preserved without automatically translating game terminology.
7. Server Save is modeled as civil `00:00:00` plus `America/Sao_Paulo`; the app will convert with Temporal for each visitor.
8. Guild exports are modeled as private before/after observations, storing hashes/locators and structured fields rather than raw exports in the public repository or build.

## Validation evidence

`data/reports/phase2-model-validation.json` reports:

- 4 migrations found in the expected order;
- 8 required Phase 2 artifacts found;
- required entities, provenance, import, map, content and guild tables detected;
- destructive schema/data operations absent;
- Phase 1 research validator exit code `0`;
- total validation issues: `0`.

The host does not have `psql`, and there is no remote Supabase project yet. Therefore SQL parser execution and live migration application remain Phase 3 environment checks; they are not claimed here.

## Explicitly not completed in this phase

- Astro, React, Tailwind, pnpm or application source initialization;
- Supabase project creation, environment variables or remote migration execution;
- production RLS policies and authenticated guild UI;
- exact Pokémon spawn payload extraction from the protected client;
- complete NPC/quest/travel coordinates;
- automated Discord changelog ingestion;
- marketplace, deployment or owner runtime acceptance.

## Handoff to Phase 3

Start application foundation from [ARCHITECTURE.md](ARCHITECTURE.md) and [DATA_MODEL.md](DATA_MODEL.md). Preserve `UK-010`, source reuse/licensing uncertainty, manual Discord changelog ingestion, and the single guild export limitation. Apply the SQL only after the Supabase environment contract and migration execution checks exist.
