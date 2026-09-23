# Roadmap

## Phase 0 — Master planning

- [x] Master plan
- [x] Research plan and exit criteria
- [x] Data strategy
- [x] Provisional architecture
- [x] Risk/unknown registry
- [x] Initial agent rules
- [x] Cross-document consistency review

## Phase 1 — Knowledge base research

- [x] Discover and register official/community/historical sources
- [x] Establish evidence, confidence and freshness conventions (removed by D-012)
- [x] Inventory all required domains breadth-first
- [x] Capture raw research and provenance (removed by D-012)
- [x] Produce representative staging and normalized datasets (replaced by `content/` in D-012)
- [x] Build canonical terminology glossary
- [x] Validate schemas and references
- [x] Publish conflicts, unknowns, research log and coverage report
- [x] Meet research exit criteria

Exit report: [PHASE_1_EXIT_REPORT.md](PHASE_1_EXIT_REPORT.md)

## Phase 2 — Data model consolidation

- [x] Resolve identity and variant rules
- [x] Finalize normalized contracts
- [x] Finalize localization/fallback/SEO model
- [x] Finalize provenance and temporal model (provenance removed by D-012)
- [x] Design PostgreSQL and migration strategy from evidence
- [x] Validate representative imports and correction workflows

Exit report: [PHASE_2_EXIT_REPORT.md](PHASE_2_EXIT_REPORT.md)

## Phase 3A — Wiki design direction (required correction)

- [x] Confirm the exact modern wiki/template reference
- [x] Approve wiki information architecture and desktop/mobile shell
- [x] Define and approve the design system before visual implementation
- [x] Re-audit and rebuild the provisional visual shell without breaking the technical foundation

Design gate: [DESIGN_DIRECTION.md](DESIGN_DIRECTION.md)
Exit report: [PHASE_3A_EXIT_REPORT.md](PHASE_3A_EXIT_REPORT.md)

Corte 0 (D-014) reopened this gate on 2026-09-19; see «Corte 0 — Redesign (D-014)» below.

## Phase 3 — Application foundation

- [x] Astro/React/strict TypeScript/pnpm
- [x] Tailwind and customized shadcn/ui (the shadcn kit was removed by Corte 0 in M13 and M15)
- [x] Locale routing and metadata foundation
- [x] Supabase/Vercel integration and environment contract
- [x] Lint, format, unit, browser and data checks
- [x] CI and development documentation
- [x] Accessible responsive shell and navigation

Exit report: [PHASE_3_EXIT_REPORT.md](PHASE_3_EXIT_REPORT.md)

The technical foundation is complete; since Corte 0 its visual shell is `PageLayout` (D-014).

## Phase 4 — Wiki core

- [x] Home and discovery
- [x] Pokémon index and detail
- [x] Wiki systems and guides
- [x] Rotations and tiers
- [x] Sources/provenance views (removed by D-006 and D-012)
- [x] Search

Exit report: [PHASE_4_EXIT_REPORT.md](PHASE_4_EXIT_REPORT.md)

Corte 0 rebuilt the Wiki Core on `PageLayout` (M7–M11); Guías and Rotaciones now redirect to Actividades and the Tier list. Its content coverage remains intentionally partial.

## Data registries (D-011, D-012)

- [x] Remove provenance from data, UI, scripts, tests and the database model (D-012; migration `20260918220000_remove_provenance.sql` pending remote application)
- [x] Move site data to owner-editable JSON under `content/`
- [x] Item categories and per-category item files, `content/outfits.json`, `content/auras.json` (placeholder records marked `borrador`)
- [x] Sprite registry `public/sprites/sprites.json`, `Sprite` components and in-game Diamond sheet in Comercio
- [x] JSON Schemas with `$schema` and `pnpm content:check` (part of `pnpm run ci`) for every file in `content/`, with the 14 Market categories fixed in their schema; the build parses every file with Zod
- [ ] Apply `20260918220000_remove_provenance.sql` (with authorization) and then remove the `p_source_locator` retry in `src/lib/supabase/guilds.ts`
- [x] `pnpm assets:outfits -- --registrar` publishes dumped outfit frames into the registry
- [ ] Owner fills real values (NPC prices, client ids, names, sheets) and removes `borrador`

## Corte 0 — Redesign (D-014)

Specification: [CORTE_0_CODEX_TOOLTIP_SPEC.md](CORTE_0_CODEX_TOOLTIP_SPEC.md). Milestones: [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md). Technical decisions: D-015 to D-026.

- [x] F0 base: tokens, CSS layers, fonts, formats, dictionaries, the `@content` alias, the test harness, the gates and CI (M1, M2)
- [x] F1 components: frame, game layer, Design System controls, cards, grids, the three views and Pokédólares (M3–M6)
- [x] F2 wiki: Pokédex and Pokémon sheet, systems, items per Market category, Tier list, Inicio, Buscar, Cambios, activities, tools index, the map and Compare placeholders and the 404 (M7–M11)
- [x] F3 Comercio phase A: list, listing detail, seller profile and «Crear anuncio» over sample data (M12)
- [x] F4 Guild and the account page (M13)
- [x] Closure: old layout, legacy CSS, old variables and classes, the shadcn kit and its dependencies deleted; every gate covers every route (M15)
- [ ] F3 Comercio phase B: local Supabase, verification, trades, reviews and moderation (M14, in progress)
- [ ] F5 Compare Pokémon (M16, deferred by the owner on 2026-09-23; `/{l}/herramientas/pokemon/` stays a placeholder)
- [ ] Owner visual acceptance, page by page against the boards (S22)

## Phase 5 — Tools

- [x] Coordinate preview from client Minimap.flags with floor/category filters
- [x] Client-style map controls: legend, layer visibility, zoom, recenter, panning and cursor coordinates
- [x] OTMM-backed base preview derived from the current owner-authorized local snapshot
- [x] Manual map contribution protocol and review-state guide
- [x] Tier list (`/{l}/pokedex/tiers/`, Corte 0 M9)
- [ ] Compare Pokémon: the first explorer was retired in M11; the new tool is M16, deferred by the owner
- [x] Guild weekly ranking, daily/donation pacing and complete exports
- [x] Guild daily history contract with same-day replacement and cumulative deltas
- [x] Guild rewrite: summary, per day, per week, members, inactivity, CSV and PNG exports, local and account modes (M13)
- [ ] Rotation and Team Builders
- [ ] Hunt Finder
- [ ] Boost/material/shiny calculators supported by verified data

Since M11, `/{l}/mapa/` is a placeholder and `/{l}/mapa/aportar` redirects to it; the map explorer and its data are kept unused for the map's own cut (R9, spec §15).

## Phase 6 — Accounts

- [x] Account page `/{l}/cuenta/` with «Acceso» and «Guilds», only in a build with the public Supabase settings (M13)
- [x] Authenticated guild creation, one-use invitations, owner/officer/member roles, «Quitar» and «Eliminar guild» (M13; `20260923150000_guild_admin.sql` applied to the local stack only, remote application pending)
- [ ] Verified phone, Comercio profile, contact channels and «Eliminar cuenta» (M14, in progress)
- [ ] Favorites and saved teams

## Phase 7 — Marketplace

- [x] Comercio phase A (M12): list, listing detail, seller profile and «Crear anuncio» over the sample registry `content/comercio/`, read only with `COMERCIO_DEMO=1`; a production build shows the empty list and «Crear anuncio». It replaced the local trade composer and is not a Phase 7 exit.
- [ ] Reverify current PokeAlliance trading rules
- [ ] Threat/abuse model and moderation workflows (moderation in M14)
- [ ] Permitted Pokémon/CAC listings and media
- [ ] Reports and seller trust surfaces (M14)
- [ ] Evaluate messaging/reputation separately
- [ ] General account flow with verified email and phone, enforced for publishing and reviews (M14)
- [ ] Transaction-bound 0–5 reviews, private evidence and dispute/moderation workflow (M14)

Comercio phase B (M14, in progress) is built and tested only against the local Supabase stack and stays behind `COMERCIO_PUBLICO`; its public launch is the gate of spec §9.2.

## Future (not scheduled)

- [ ] Daily GitHub Action that reads the launcher changelog feed (`https://pokealliance.com/launcher/feed`) and adds new entries to Cambios by feed `id` (see `CHANGELOG_INGESTION.md`).
- [ ] Live `/api/mundos` endpoint with online players per world from `/launcher/players`, cached for 5 minutes.
- [ ] Optional Supabase history of online players per world.
