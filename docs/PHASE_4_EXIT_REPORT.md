# Phase 4 Exit Report — Wiki Core

Date: 2026-09-09  
Status: complete for the current evidence-backed sample

## Scope

Phase 4 connected reviewed normalized records to real user-facing Wiki Core surfaces. The implementation intentionally reads from the repository/domain boundary; research records are not copied into Astro or React components. The current dataset is a functional sample, not a claim of complete game coverage.

## Delivered

- Home discovery with catalog metrics and collection links derived from the content repository.
- Pokémon index with client-side search and localized route support.
- Pokémon detail pages generated from canonical slugs, with fact-level status and evidence counts.
- Guides surface for the reviewed Porygon quest and Saffron travel/location record.
- Systems surface for the reviewed training item and Scratch move.
- Rotations and tiers surface for the current Shiny availability assertion, including context and comparison set.
- Sources and provenance registry with authority, scope, freshness, evidence counts and safe external links.
- Global catalog search across Pokémon, moves, locations, items, quests and rotation assertions.
- Spanish and English copy for navigation and all Wiki Core page-level UI; source-derived game names and claims retain their recorded language where appropriate.
- Evidence trails that expose source locator, retrieval date, claims and source URL.

## Implemented routes

For both `es` and `en`:

- `/[locale]/`
- `/[locale]/pokedex/`
- `/[locale]/pokedex/chimchar/`
- `/[locale]/guias/`
- `/[locale]/sistemas/`
- `/[locale]/rotaciones/`
- `/[locale]/fuentes/`
- `/[locale]/buscar/`

The map route remains a foundation placeholder because semantic coordinate mapping and Pokémon spawn payload provenance are still unresolved.

## Validation evidence

- `pnpm run ci`: passed format check, ESLint, Astro diagnostics, research validation, Phase 2 validation, Vitest and Astro/Vercel build.
- `pnpm test`: 4 files and 9 tests passed, including repository loading, evidence joins, accent-insensitive search, catalog metrics, Temporal behavior and domain/i18n contracts.
- `pnpm check`: 0 errors, 0 warnings and 0 hints across 43 files.
- `pnpm test:e2e`: 3/3 passed, covering localized Home, Pokédex search/detail/evidence, Guides, Sources, global Search, browser console errors and runtime error overlays.
- `pnpm build`: passed with 19 prerendered routes and the Vercel server adapter.
- CI-mode Playwright verification passed with the Windows PowerShell Astro wrapper.

## Data and product boundary

The current application catalog contains 6 normalized records across 6 collections, 10 registered sources and 19 evidence records. The research validator still reports the measured domain coverage baseline: Pokémon 17.65%, moves 66.67%, locations 46.67%, items 46.15%, quests 87.5%, rotation/tier 76.92% and map features 78.57%. These percentages measure populated reviewed fields in the repository, not completion percentages for the game.

No remote Supabase project was provisioned, so live migrations, RLS behavior, authentication and production data reads remain pending. No production deployment or owner visual/runtime acceptance was performed.

## Handoff to Phase 5

Build Compare Pokémon and Tier Explorer over the same repository contract. Require at least two reviewed comparable Pokémon records before presenting comparison conclusions; otherwise show a precise empty state. Keep source/evidence links and uncertainty visible in tool results, and continue expanding normalized records without inventing missing fields.
