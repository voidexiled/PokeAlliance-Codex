# Alliance Codex — Master Plan

## Product direction

Alliance Codex is an independent, bilingual community companion for PokeAlliance. Its long-term product surface combines a trustworthy knowledge base, a fast wiki/Pokédex, player tools, accounts and—only after current server rules are revalidated—a moderated marketplace. The descriptor “PokeAlliance Wiki & Tools” explains the product but is not the primary brand.

The project optimizes, in order, for information quality, maintainability, speed and safe growth. UI work must consume researched domain data; it must never become a second, untracked source of game facts.

## Non-negotiable principles

1. PokeAlliance-specific evidence outranks general Pokémon knowledge.
2. Unknown and conflicting facts are first-class data, never filled by assumption.
3. One domain entity has one stable identity; localized presentation is separate.
4. Canonical in-game terminology remains canonical unless a PokeAlliance source proves a localized name.
5. Research precedes final domain/database design; final design precedes application implementation.
6. Static-first Astro pages and selective React hydration keep the wiki fast.
7. Future phases influence seams and identifiers, not premature implementation.

## Delivery phases and gates

### Phase 0 — Master planning

Produces the planning set, source taxonomy, confidence model, research domains, risks and research exit criteria. No application dependencies, database, UI or deployment.

### Phase 1 — Deep PokeAlliance research

Discovers official and community sources, captures raw evidence, normalizes machine-readable research candidates, records provenance/conflicts/unknowns, validates schemas and publishes a coverage report. Research is breadth-first before depth-first so the team can see whole-domain gaps early.

### Phase 2 — Data model consolidation

Turns demonstrated research shapes into stable domain contracts, IDs, localized-content rules, provenance links, validation schemas and a justified PostgreSQL model. The model is reviewed against import, correction and stale-data workflows before migrations are written.

### Phase 3 — Application foundation

Initializes Astro, strict TypeScript, React islands, Tailwind, customized shadcn/ui, Supabase integration, Vercel adapter, quality tooling, CI and the bilingual routing/design foundation.

### Phase 4 — Wiki core

Builds Home, Pokémon index/detail, Wiki, Rotations, Tiers, Guides, Sources and Search from normalized datasets—not literals embedded in components.

### Phase 5 — Player tools

Introduces tools only where researched formulas and fields support them: Rotation Builder, Team Builder, Compare, Tier Explorer, Hunt Finder and calculators.

### Phase 6 — Accounts

Adds Supabase Auth, profiles, favorites, saved teams and seller profiles with RLS and abuse controls.

### Phase 7 — Marketplace

Rechecks current server rules, then implements permitted listings, media, reports, moderation and trust controls. Messaging/reputation are separate decisions requiring demonstrated need.

Each phase starts only when the prior exit criteria are met. A partially completed phase stays explicitly partial.

## Conceptual architecture

The product has four boundaries:

- Knowledge pipeline: raw evidence → staging extracts → normalized datasets → application database/build input.
- Domain layer: stable canonical entities, relationships, confidence, temporal validity and provenance.
- Content layer: bilingual editorial material with structured entity references and explicit fallback status.
- Delivery layer: mostly prerendered Astro, interactive React islands, and Supabase-backed dynamic/account surfaces.

Astro, React, Tailwind, shadcn/ui, Supabase and Vercel remain the proposed stack until Phase 2 confirms no domain finding invalidates it. There will be no monorepo, ORM, GraphQL, alternate auth/backend/storage, search server or cache service without an architecture decision tied to measured need.

## Data and localization strategy

Canonical entity IDs and slugs are locale-independent. Game entities store `canonicalName`, aliases and search keywords as distinct concepts. Editorial content is localized into `es` and `en`; missing translations fall back explicitly and are never silently machine-generated. Initial configuration is `defaultLocale=es`, `supportedLocales=[es,en]`, and an explicit fallback locale. Canonical game terminology is the default terminology mode.

Entity references in editorial content should use IDs when practical so names, links and tooltips remain consistent. Localized URL prefixes (`/es/`, `/en/`) are the preferred proposal; entity slugs remain stable while purely editorial slugs may be localized after Phase 2 review.

## Source and confidence strategy

Source authority is contextual, not a single global score. The initial order is: current official PokeAlliance material; current first-party announcements/game-visible evidence; current well-supported community evidence; historical repositories as hypothesis generators; general Pokémon knowledge only as a lead, never proof.

Every accepted fact must be traceable to source, retrieval time and evidence location. Confidence is separated from freshness and from lifecycle status. Contradictions remain visible until resolved.

## Development strategy

- Keep domain logic independent from UI and Supabase transport.
- Validate external and authored data at boundaries with Zod/JSON Schema.
- Prefer generated indexes over duplicated hand-maintained facts.
- Build vertical slices only after research/model gates.
- Use fixtures clearly labeled as synthetic UI data; never merge fixtures into researched datasets.
- Record consequential decisions as ADRs once implementation starts.

## Security and privacy

Secrets live only in environment variables and platform secret stores. Browser-exposed variables are intentionally public and narrowly scoped. Supabase tables default to RLS-deny for user data, privileged writes remain server-side, uploads are type/size/path constrained, and user-authored content is treated as untrusted. Marketplace design requires abuse cases, report/moderation workflows, rate limits and current rule verification before launch.

## Quality strategy

The foundation will include linting, formatting, strict type checking, Vitest and Playwright. Data validation and provenance integrity receive unit/contract tests; routes, localization and critical user flows receive browser tests. Accessibility, responsive behavior, metadata and performance budgets are release gates. Build/lint/typecheck success is technical verification, not evidence that game facts are correct.

## Deployment and operations

Vercel Preview is the target for review and Production only after explicit publication authorization. Most wiki routes should prerender. Supabase migrations are ordered, reproducible and environment-aware. Observability begins with actionable server errors and deployment logs; additional vendors require a concrete need. Backups, migration rollback/recovery and source refresh cadence must be documented before user data becomes material.

## Decisions intentionally deferred

- Final PostgreSQL tables, cardinalities and indexes.
- Exact content authoring format and entity-reference syntax.
- Search implementation beyond a small static/local index.
- Tier/rotation formulas and ranking presentation.
- Auth providers, profile fields and social features.
- Marketplace transaction/contact model and media policy.
- Automated extraction frequency and any source-specific scraper.

These depend on Phase 1 evidence or later product validation and must not be guessed during planning.
