# Alliance Codex architecture

Status: definitive Phase 2 architecture (2026-09-09). The earlier `ARCHITECTURE_PROPOSAL.md` is retained as historical planning context; this file is the implementation contract for Phase 3 onward.

## Product boundary

Alliance Codex is a community knowledge product with three different trust surfaces:

1. reviewed public wiki knowledge;
2. interactive tools and map projections built from reviewed data;
3. private, user-controlled workflows such as guild snapshots and future marketplace/profile features.

The architecture keeps those surfaces separate in data, authorization and publication. A user contribution can be useful evidence without becoming a public fact automatically.

## Runtime shape

```text
Public source surfaces / local owner-authorized files
        |
        v
Import + validation scripts  --->  staging + evidence + import history
        |                                      |
        v                                      v
Reviewed claims / typed model  ----------> Supabase PostgreSQL
        |                                      |
        +--> generated static wiki payloads   +--> authenticated dynamic data
                         |                                  |
                         v                                  v
                 Astro pages + React islands       server routes/actions + RLS
```

The intended deployment remains one Astro application on Vercel and one Supabase backend. This is a bounded architecture, not a commitment to an ORM, GraphQL layer, microservices, separate search cluster or PostGIS before measured need.

## Source and data boundaries

- `knowledge/` contains human-readable research, conflicts, unknowns and glossary material.
- `data/research/` and `data/staging/` are provenance-preserving interchange/lead datasets.
- `data/normalized/` contains reviewed sample contracts and later build inputs; it is not an unreviewed scrape dump.
- `supabase/migrations/` defines the canonical relational serving model.
- `scripts/` owns extraction, validation, profiling and synchronization. Scripts never place service-role credentials in browser code.
- `src/lib/domain/` will expose application-safe domain functions and DTOs. Pages and components will not depend on raw Supabase response shapes.
- Protected client assets and raw guild exports remain outside public build inputs unless their reuse and retention scope has been reviewed.

## Read and write paths

### Public wiki and tools

Reviewed static or build-time data is preferred for Pokémon, moves, items, quests, guides, terminology, sources and stable map layers. Pages receive narrow DTOs, not entire source payloads. An interactive tool loads only the data required for the current view and can read public, published projections through an anonymous Supabase client or generated assets.

The initial search index is generated from canonical slugs, names, aliases and localized keywords. A provider interface is allowed, but an external search service is not introduced until corpus size and latency are measured.

### Authenticated state

Profiles, favorites, saved teams, guild data and future marketplace actions use request-scoped server access and RLS. Every write is validated at the boundary, authorized in the database and recorded when it changes trust-sensitive data. Service-role credentials are limited to maintenance/import jobs.

### Contributions

Map/NPC/quest/travel observations enter as pending contribution records or claims with contributor, capture time, coordinate system, source locator and moderation state. Reviewed projections are published only through an explicit moderation/import step. The map never treats a player-provided coordinate as canonical solely because it was submitted.

## Build and synchronization strategy

The importer pipeline is idempotent and digest-based:

```text
discover -> capture snapshot -> stage -> validate -> map source keys
   -> propose claims/relations -> review -> project -> build/revalidate
```

The launcher feed is a structured local source that can be refreshed by digest. Discord changelog updates are manual until official bot access is authorized. A changed source creates a new import run; stale facts are deprecated or reconciled, never silently removed. Editorial revisions are immutable by revision number.

The first application version can build public pages from reviewed repository data while the Supabase project is configured. Dynamic/private features should not be simulated by client-only local state once they are released.

## Localization and time

Locale is part of the route (`/es/`, `/en/`) and the content resolver, not an incidental browser setting. Entity identity and canonical game terminology stay locale-independent. Missing translations are explicit and reviewable.

Instants are UTC. Recurring schedules use civil time plus IANA zone. The Server Save rule is stored as `00:00:00` in `America/Sao_Paulo` and converted with Temporal before display. Date-only labels are created from the resulting `Temporal.Instant` in the visitor's zone; no fixed offset is hardcoded.

## Security and privacy

- Public read models expose only published rows and approved source metadata.
- Supabase Auth owns account identity; application tables reference `auth.users` only where needed.
- Guild tables have RLS enabled from the initial migration and default-deny behavior until Phase 3 policies are tested.
- Guild member names are functional in-game identifiers, but guild observations remain private to authorized guild users.
- Raw export paths, account/profile caches, cookies, tokens and unrelated personal data are excluded from canonical/public data.
- Uploads, future marketplace listings and user content require allowlisted types/sizes, sanitization, rate limits, abuse reports and audit trails.
- Client assets are used only within the owner-authorized community-tool/wiki scope and are not assumed freely redistributable.

## Failure and quality strategy

The system treats incomplete evidence as a normal state. UI status labels should distinguish confirmed/supported, inferred, conflicted, unknown and outdated. Source freshness and import failures should be visible in maintenance surfaces, not silently converted into empty public data.

Phase 3 CI is expected to run:

- formatting, lint, strict type checking and Astro checks;
- unit tests for domain normalization, Temporal conversion, locale fallback and comparison logic;
- JSON/schema and relational-contract validation;
- browser smoke tests for the public shell and keyboard/accessibility behavior;
- production build and generated-data drift checks.

The Phase 2 static model audit is separate from a live Supabase migration run. It proves contract coverage and migration ordering; it does not claim that a remote database has been provisioned.

## Planned source tree after Phase 3

```text
src/
  components/{ui,layout,common}/
  features/{pokemon,systems,map,search,tools,guild,auth,marketplace}/
  content/{guides,systems,mechanics}/
  i18n/
  lib/{domain,data,sources,supabase,validation,time}/
  pages/[locale]/
  styles/
data/{raw,staging,normalized,schemas,fixtures,reports}/
knowledge/{sources,research,conflicts,unknowns,localization}/
scripts/{research,imports,validation}/
supabase/{migrations,tests,seed.sql}/
```

This tree is a Phase 3 target, not an assertion that the application already exists.
