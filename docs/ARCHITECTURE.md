# Alliance Codex architecture

Status: definitive Phase 2 architecture (2026-09-09), updated 2026-09-18 for D-011 and D-012 (owner-editable `content/` JSON, no provenance). The earlier `ARCHITECTURE_PROPOSAL.md` is retained as historical planning context; this file is the implementation contract for Phase 3 onward.

## Product boundary

Alliance Codex is a community knowledge product with three different trust surfaces:

1. public wiki knowledge;
2. interactive tools and map projections built from the same data;
3. private, user-controlled workflows such as guild snapshots and future marketplace/profile features.

The architecture keeps those surfaces separate in data, authorization and publication. A user contribution does not become public data until the owner accepts it.

## Runtime shape

```text
Owner edits / small importers
        |
        v
content/*.json  ----------------------->  Astro pages + React islands (prerendered)

Supabase PostgreSQL  ------------------>  server routes/actions + RLS (accounts, guilds)
```

The intended deployment remains one Astro application on Vercel and one Supabase backend. This is a bounded architecture, not a commitment to an ORM, GraphQL layer, microservices, separate search cluster or PostGIS before measured need.

## Data boundaries

- `content/` holds the game data the site reads: owner-editable JSON with Spanish keys, `null` for unknown values and `"borrador": true` for placeholders.
- `content/items/`, `content/outfits.json` and `content/auras.json` are the owner-editable registries of D-011; `src/lib/content/registry.ts` loads them through a Zod mirror at build time. See [REGISTROS.md](REGISTROS.md).
- Every JSON file under `content/` has a JSON Schema in `content/schemas/` and is checked by `pnpm content:check`. At build time `src/lib/content/repository.ts` and `src/lib/map/map-data.ts` parse the game data with the Zod mirrors in `src/lib/content/content-schema.ts`, so a malformed file stops the build. These modules are server-only: the map page passes markers and floors to `MapExplorer` as props, and `src/lib/tools/pokemon-roster.ts` gives the Pokémon explorer island the roster without Zod.
- `public/sprites/` holds game images and `public/sprites/sprites.json` registers them by key (frame size, frame count, mode). `src/lib/sprites/resolve.ts` is the pure frame math; `src/components/sprites/Sprite.astro` and `Sprite.tsx` render a key without animation JavaScript. React islands receive resolved data or read the sprite registry directly; they never bundle the Zod schemas.
- `knowledge/` contains the game rules text, the glossary and the open questions.
- `supabase/migrations/` defines the relational model for accounts, guilds and future marketplace features.
- `scripts/` owns asset extraction and small importers that write `content/`. Scripts never place service-role credentials in browser code.
- `src/lib/domain/` will expose application-safe domain functions and DTOs. Pages and components will not depend on raw Supabase response shapes.
- Protected client assets and raw guild exports remain outside public build inputs unless their reuse and retention scope has been reviewed.

## Read and write paths

### Public wiki and tools

Build-time data from `content/` is used for Pokémon, moves, items, quests, guides, terminology and stable map layers. Pages receive narrow DTOs, not whole JSON files. An interactive tool loads only the data required for the current view and can read public, published projections through an anonymous Supabase client or generated assets.

The initial search index is generated from canonical slugs, names, aliases and localized keywords. A provider interface is allowed, but an external search service is not introduced until corpus size and latency are measured.

### Authenticated state

Profiles, favorites, saved teams, guild data and future marketplace actions use request-scoped server access and RLS. Every write is validated at the boundary, authorized in the database and recorded when it changes trust-sensitive data. Service-role credentials are limited to maintenance/import jobs.

### Contributions

Map/NPC/quest/travel contributions enter as pending records with contributor, coordinate system and moderation state. They are published only after the owner accepts them. The map never treats a player-provided coordinate as canonical solely because it was submitted.

## Build and synchronization strategy

Importers are idempotent and write `content/` directly; the build prerenders from it. They never delete records and keep hand-edited values unless told to overwrite them.

A daily launcher-feed job and a live `/api/mundos` endpoint are future roadmap items. Discord changelog updates are manual. Editorial revisions are immutable by revision number.

Public pages are built from repository data in `content/`. Dynamic/private features should not be simulated by client-only local state once they are released.

## Localization and time

Locale is part of the route (`/es/`, `/en/`) and the content resolver, not an incidental browser setting. Entity identity and canonical game terminology stay locale-independent. Missing translations are explicit and reviewable.

Instants are UTC. Recurring schedules use civil time plus IANA zone. The Server Save rule is stored as `00:00:00` in `America/Sao_Paulo` and converted with Temporal before display. Date-only labels are created from the resulting `Temporal.Instant` in the visitor's zone; no fixed offset is hardcoded.

## Security and privacy

- Public read models expose only published rows.
- Supabase Auth owns account identity; application tables reference `auth.users` only where needed.
- Guild tables have RLS enabled from the initial migration and default-deny behavior until Phase 3 policies are tested.
- Guild member names are functional in-game identifiers, but guild observations remain private to authorized guild users.
- Raw export paths, account/profile caches, cookies, tokens and unrelated personal data are excluded from canonical/public data.
- Uploads, future marketplace listings and user content require allowlisted types/sizes, sanitization, rate limits, abuse reports and audit trails.
- Client assets are used only within the owner-authorized community-tool/wiki scope and are not assumed freely redistributable.

## Failure and quality strategy

Incomplete data is a normal state: unknown values are `null` and render as `—`, and a block with no data is omitted. The UI never shows sources, verification status or confidence labels (D-012). Import failures stop the importer instead of writing empty data.

Phase 3 CI is expected to run:

- formatting, lint, strict type checking and Astro checks;
- unit tests for domain normalization, Temporal conversion, locale fallback and comparison logic;
- `content/` schema validation (`pnpm content:check`, D-011);
- browser smoke tests for the public shell and keyboard/accessibility behavior;
- production build and generated-data drift checks.

Local migrations are reviewed before any remote run; a migration counts as applied only after it has run on the linked project.

## Planned source tree after Phase 3

```text
src/
  components/{ui,layout,common}/
  features/{pokemon,systems,map,search,tools,guild,auth,marketplace}/
  content/{guides,systems,mechanics}/
  i18n/
  lib/{content,domain,map,supabase,time,tools,trade}/
  pages/[locale]/
  styles/
content/{items,map}/ + pokemon.json, moves.json, quests.json, locations.json, rotations.json, outfits.json, auras.json
knowledge/{rules,unknowns,localization}/
scripts/{assets,content,map}/
supabase/{migrations,tests,seed.sql}/
```

This tree is a Phase 3 target, not an assertion that the application already exists.
