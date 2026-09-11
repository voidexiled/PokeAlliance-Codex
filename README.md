# Alliance Codex

Alliance Codex is a community wiki and tools foundation for PokeAlliance. The project is built on Astro, React islands, Tailwind CSS v4, shadcn/ui, Supabase contracts and Temporal-based time handling.

## Local development

Requirements: Node `>=22.12.0` and pnpm `11.6.0`.

```sh
pnpm install
pnpm dev
```

The local app runs at `http://127.0.0.1:4321/es/`.

## Verification commands

```sh
pnpm format:check
pnpm lint
pnpm check
pnpm validate:data
pnpm validate:phase2
pnpm test
pnpm build
```

`pnpm test:e2e` runs the Playwright smoke suite and may require a local Chromium install. The combined `pnpm ci` command runs the deterministic local checks above.

## Environment

Copy `.env.example` to `.env` when connecting a Supabase project. Public Supabase variables are optional for the public foundation; service-role credentials are maintenance-only and must never be exposed to the browser.

## Project map

- `src/layouts/` — shared localized application shell.
- `src/components/` — reusable UI and React islands.
- `src/i18n/` — explicit locale configuration and copy.
- `src/lib/domain/` — framework-independent contracts.
- `src/lib/time/` — Temporal adapters for Server Save and visitor-local display.
- `data/`, `knowledge/` — researched and provenance-preserving inputs.
- `supabase/migrations/` — Phase 2 database model, ready for a configured remote Supabase project.
- `docs/` — phase reports and implementation contracts.
