# Architecture Proposal (historical)

> **Updated 2026-09-18 (D-011, D-012):** the provenance parts of this proposal were removed. Game data lives in owner-editable JSON under `content/`; see `ARCHITECTURE.md` and `DATA_STRATEGY.md`.

Status: superseded by [ARCHITECTURE.md](ARCHITECTURE.md), consolidated in Phase 2 on 2026-09-09. Retained to preserve the original pre-research proposal.

## Stack

- Astro with strict TypeScript for pages, content and static generation.
- React only for stateful tools and complex interactive islands.
- Tailwind CSS and customized shadcn/ui for a coherent accessible system.
- Zod for runtime/input contracts.
- Supabase for PostgreSQL, Auth, Data API and Storage when required.
- Vercel with the official Astro adapter for on-demand routes.
- pnpm, ESLint, Prettier, Vitest and Playwright.

This is deliberately one deployable application and one managed backend. No ORM, monorepo, separate API, alternate auth/storage or dedicated search engine is currently justified.

## Proposed boundaries

```text
src/
  components/{ui,layout,common}/
  features/{pokemon,rotations,hunts,search,tools,auth,marketplace}/
  content/{guides,systems,mechanics}/
  i18n/
  lib/{domain,data,supabase,validation}/
  pages/[locale]/
  styles/
content/
knowledge/{unknowns,localization}/
scripts/{imports,validation}/
supabase/{migrations,tests,seed.sql}/
docs/
```

## Rendering model

Pokémon, guide and taxonomy pages should be prerendered from the versioned JSON in `content/` wherever feasible. Locale route generation and metadata are centralized. Interactive filters use the smallest viable client payload and hydrate on visibility/idle unless immediate interaction requires otherwise. Authenticated/profile/marketplace surfaces can use on-demand server rendering later.

React is not the page shell. Domain functions are framework-independent and testable without rendering.

## Data access

During early wiki phases, the JSON in `content/` feeds static builds directly. Supabase becomes the authoritative serving layer only for data that benefits from database workflows, dynamic updates or user state. A repository/domain boundary prevents pages from depending directly on Supabase response shapes.

Environment clients are separated: anonymous browser client, request-scoped server client and privileged maintenance scripts. Service-role credentials never enter client bundles.

## Localization and SEO

Use explicit locale prefixes (`/es/...`, `/en/...`) and persist a user-selected locale. Browser preference is only an initial suggestion. Canonical game entity slugs do not change by locale. A central route/content resolver implements fallback, `lang`, canonical, hreflang, localized metadata, Open Graph and sitemap alternates.

## Search

Initial search should be generated from IDs, canonical names, aliases and locale-specific keywords. The architecture exposes a search-provider interface, but no external engine is introduced until corpus size and latency demonstrate need.

## Time and changelog ingestion

Recurring game times are modeled as civil time plus an IANA zone, then converted through `Temporal` instants for viewer-local display. See `docs/TEMPORAL_ARCHITECTURE.md`.

Official Discord changelogs can be ingested through a narrowly permissioned bot when PokeAlliance administrators authorize it. Manual moderated ingestion remains the fallback. Both paths end as reviewed changelog entries; see `docs/CHANGELOG_INGESTION.md`.

## Design system direction

Alliance Codex should feel like a fast, information-dense game companion rather than a promotional landing page. The system will use a distinctive but restrained palette, strong information hierarchy, keyboard-accessible controls and responsive layouts. Pokémon trademarks/artwork or PokeAlliance assets are not assumed available; asset rights are checked first.

## Security boundary

Static public knowledge is read-only. Future user writes enter through validated server actions/endpoints, RLS and rate limits. User content is escaped/sanitized, uploads use allowlisted MIME/size/path rules and marketplace actions gain reporting/moderation/audit records. Authorization is tested in SQL as well as application code.

## Quality and CI

CI will run format check, lint, Astro/type check, unit tests, data validation, Playwright smoke tests and production build. Generated-data drift is detected. Preview deployment follows successful checks; production publication remains an explicit action.

## Decisions to revisit after research

- Content Collections versus a custom editorial representation.
- Exact entity-reference authoring syntax.
- Dataset/database split and refresh cadence.
- Form/variant identity and relationship model.
- Rotation/tier assertion schema.
- Static search payload partitioning.
- Image source, transformations and licensing.
