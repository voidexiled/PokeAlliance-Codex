# Alliance Codex

Alliance Codex is a community wiki and tools foundation for PokeAlliance. The project is built on Astro, React islands, Tailwind CSS v4, Supabase contracts and Temporal-based time handling.

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
- `content/` — owner-editable game data (JSON) that the site reads at build time; `pnpm content:roster` refreshes the Pokémon roster.
- `knowledge/` — game rules text, glossary and open questions.
- `supabase/migrations/` — database model for accounts, guilds and future features.
- `docs/` — phase reports and implementation contracts.
