# Alliance Codex — Master Plan

> **Updated 2026-09-18 (D-011, D-012):** game data lives in owner-editable JSON under `content/`, validated by `pnpm content:check` (see `DATA_STRATEGY.md`). There is no provenance: no sources, evidence, claims, confidence or verification dates in data, UI, scripts or the database.

## Product direction

Alliance Codex is an independent, bilingual community companion for PokeAlliance. Its long-term product surface combines a trustworthy knowledge base, a fast wiki/Pokédex, player tools, accounts and—only after current server rules are revalidated—a moderated marketplace. The descriptor “PokeAlliance Wiki & Tools” explains the product but is not the primary brand.

The project optimizes, in order, for information quality, maintainability, speed and safe growth. UI work reads game data from `content/`; components never hard-code game facts.

## Non-negotiable principles

1. PokeAlliance-specific data outranks general Pokémon knowledge.
2. Unknown values stay `null` (the UI shows `—`); they are never filled by assumption.
3. One domain entity has one stable identity; localized presentation is separate.
4. Canonical in-game terminology remains canonical unless the game itself uses a localized name.
5. Research precedes final domain/database design; final design precedes application implementation.
6. Static-first Astro pages and selective React hydration keep the wiki fast.
7. Future phases influence seams and identifiers, not premature implementation.

## Delivery phases and gates

### Phase 0 — Master planning

Produces the planning set, research domains, risks and research exit criteria. No application dependencies, database, UI or deployment.

### Phase 1 — Deep PokeAlliance research

Researches the game across official and community material and the owner's client, and turns the results into machine-readable data with unknown values left `null`. Research is breadth-first before depth-first so the team can see whole-domain gaps early.

### Phase 2 — Data model consolidation

Turns demonstrated research shapes into stable domain contracts, IDs, localized-content rules, validation schemas and a justified PostgreSQL model. The model is reviewed against import, correction and stale-data workflows before migrations are written.

### Phase 3 — Application foundation

Initializes Astro, strict TypeScript, React islands, Tailwind, customized shadcn/ui, Supabase integration, Vercel adapter, quality tooling, CI and the bilingual routing/design foundation.

### Phase 4 — Wiki core

Builds Home, Pokémon index/detail, Wiki, Rotations, Tiers, Guides and Search from the `content/` data—not literals embedded in components.

### Phase 5 — Player tools

Introduces tools only where researched formulas and fields support them: Rotation Builder, Team Builder, Compare, Tier Explorer, Hunt Finder and calculators.

### Phase 6 — Accounts

Adds Supabase Auth, profiles, favorites, saved teams and seller profiles with RLS and abuse controls.

### Phase 7 — Marketplace

Rechecks current server rules, then implements permitted listings, media, reports, moderation and trust controls. Messaging/reputation are separate decisions requiring demonstrated need.

Each phase starts only when the prior exit criteria are met. A partially completed phase stays explicitly partial.

## Conceptual architecture

The product has four boundaries:

- Knowledge pipeline (since D-011/D-012): owner-editable JSON in `content/` → build input; the database serves accounts and guilds.
- Domain layer: stable canonical entities, relationships and temporal validity. No provenance (D-012).
- Content layer: bilingual editorial material with structured entity references and explicit fallback status.
- Delivery layer: mostly prerendered Astro, interactive React islands, and Supabase-backed dynamic/account surfaces.

Astro, React, Tailwind, shadcn/ui, Supabase and Vercel remain the proposed stack until Phase 2 confirms no domain finding invalidates it. There will be no monorepo, ORM, GraphQL, alternate auth/backend/storage, search server or cache service without an architecture decision tied to measured need.

## Data and localization strategy

Canonical entity IDs and slugs are locale-independent. Game entities store `canonicalName`, aliases and search keywords as distinct concepts. Editorial content is localized into `es` and `en`; missing translations fall back explicitly and are never silently machine-generated. Initial configuration is `defaultLocale=es`, `supportedLocales=[es,en]`, and an explicit fallback locale. Canonical game terminology is the default terminology mode.

Entity references in editorial content should use IDs when practical so names, links and tooltips remain consistent. Localized URL prefixes (`/es/`, `/en/`) are the preferred proposal; entity slugs remain stable while purely editorial slugs may be localized after Phase 2 review.

## Game data

Game data lives in owner-editable JSON under `content/` (D-011). Each file has a JSON Schema in `content/schemas/`, and `pnpm content:check` validates every file. When two descriptions of the game disagree, the owner decides which value goes into the file; the file keeps only that value. Records carry no source, evidence, confidence or verification dates (D-012). Placeholder records carry `"borrador": true`.

## Development strategy

- Keep domain logic independent from UI and Supabase transport.
- Validate external and authored data at boundaries with Zod/JSON Schema.
- Prefer generated indexes over duplicated hand-maintained facts.
- Build vertical slices only after research/model gates.
- Use fixtures clearly labeled as synthetic UI data; never merge fixtures into `content/`.
- Record consequential decisions as ADRs once implementation starts.

## Security and privacy

Secrets live only in environment variables and platform secret stores. Browser-exposed variables are intentionally public and narrowly scoped. Supabase tables default to RLS-deny for user data, privileged writes remain server-side, uploads are type/size/path constrained, and user-authored content is treated as untrusted. Marketplace design requires abuse cases, report/moderation workflows, rate limits and current rule verification before launch.

## Quality strategy

The foundation will include linting, formatting, strict type checking, Vitest and Playwright. Content validation (`pnpm content:check`) and the content readers receive unit/contract tests; routes, localization and critical user flows receive browser tests. Accessibility, responsive behavior, metadata and performance budgets are release gates. Build/lint/typecheck success is technical verification, not evidence that game facts are correct.

## Deployment and operations

Vercel Preview is the target for review and Production only after explicit publication authorization. Most wiki routes should prerender. Supabase migrations are ordered, reproducible and environment-aware. Observability begins with actionable server errors and deployment logs; additional vendors require a concrete need. Backups, migration rollback/recovery and the content refresh cadence must be documented before user data becomes material.

## Decisions intentionally deferred

- Final PostgreSQL tables, cardinalities and indexes.
- Exact content authoring format and entity-reference syntax.
- Search implementation beyond a small static/local index.
- Tier/rotation formulas and ranking presentation.
- Auth providers, profile fields and social features.
- Marketplace transaction/contact model and media policy.
- Automated extraction frequency and any source-specific scraper.

These depend on Phase 1 research or later product validation and must not be guessed during planning.
