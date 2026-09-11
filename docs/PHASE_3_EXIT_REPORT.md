# Phase 3 Exit Report — Application Foundation

Date: 2026-09-09  
Status: complete

## Scope

Phase 3 established the production-oriented application foundation described by the execution order. It did not implement the Wiki Core content itself; those pages begin in Phase 4 and must consume reviewed, traceable data through the domain boundary.

## Delivered

- Astro 7 server application with React, strict TypeScript and pnpm.
- Tailwind v4 and customized shadcn/ui primitives using the Alliance Codex semantic token system.
- Vercel adapter and deployment configuration, with an explicit `.env.example` contract.
- Localized `/es/` and `/en/` route foundation, language metadata and alternate-language links.
- Accessible responsive application shell with desktop navigation, mobile navigation and shared footer.
- Centralized Temporal adapter for the recurring Server Save rule at `00:00[America/Sao_Paulo]`, rendered in the visitor's local time zone.
- Supabase browser configuration boundary using only public URL/anonymous key values; service-role credentials are not exposed to the client.
- Home readiness panel and foundation routes for Pokédex, Guías, Mapa and Sistemas.
- Prettier, ESLint, Astro diagnostics, Vitest, Playwright, research validation and Phase 2 validation wired into the project scripts.
- GitHub Actions quality/browser workflow and Vercel build configuration.

## Routes verified

The following localized routes build successfully for both `es` and `en`:

- `/es/`, `/en/`
- `/es/pokedex/`, `/en/pokedex/`
- `/es/guias/`, `/en/guias/`
- `/es/mapa/`, `/en/mapa/`
- `/es/sistemas/`, `/en/sistemas/`

The root route redirects to `/es/`.

## Validation evidence

- `pnpm run ci`: passed. This includes format checking, ESLint, Astro check, research validation, Phase 2 validation, Vitest and Astro/Vercel build.
- `pnpm check`: passed with 0 errors, 0 warnings and 0 hints across 32 files.
- `pnpm test`: passed with 3 test files and 6 tests.
- `pnpm test:e2e`: passed with 2/2 browser smoke tests. Assertions cover localized routing, navigation, Server Save rendering, browser console/page errors and absence of the Astro error overlay.
- Local browser inspection completed through the CUA fallback because the `agent-browser` CLI was not installed. Spanish and English pages rendered with meaningful accessible content; the browser reported the visitor time as Mexico City local time.
- `pnpm build`: passed with the `@astrojs/vercel` server adapter and 11 prerendered foundation routes.
- `pnpm validate:data`: passed with zero issues across the current research repository.
- `pnpm validate:phase2`: passed with zero issues, four migrations and four workflow scenarios. The Phase 2 validator was also hardened so nested PowerShell validation reports its exit status reliably.

## Explicit limitations

- No remote Supabase project was provisioned, so migrations, live RLS behavior and authenticated flows remain unexecuted.
- The actual Wiki Core is not yet implemented; current content routes are foundation placeholders.
- The permitted client data boundary, Pokémon location payload (`UK-010`), source licensing and community map contribution review remain open research/product constraints.
- No production deployment, clean-machine install/update test or owner acceptance has been performed.
- Browser verification used Playwright and the CUA fallback; the optional `agent-browser` CLI was unavailable in this environment.

## Handoff to Phase 4

Start by building the repository/domain read layer over the canonical records and reviewed claims. Then implement the Wiki Core surfaces: Home/discovery, Pokémon index/detail, rotations, tiers, guides, systems, sources/provenance and search. Keep source references, confidence, freshness, localization fallback and Temporal display semantics visible in the UI where relevant; do not embed research records directly in Astro or React components.
