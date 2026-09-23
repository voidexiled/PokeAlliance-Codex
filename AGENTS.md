# Alliance Codex Agent Guide

Read this file and the current phase documents before substantial work. Chat history is not authoritative.

## Mandatory continuity reading

For a new chat or resumed session, read in this order:

1. `docs/PROJECT_SPEC.md`
2. `docs/CURRENT_STATUS.md`
3. the active phase plan and exit criteria
4. `docs/RISKS_AND_UNKNOWNS.md`
5. the relevant files under `content/`

The complete original requirements are preserved verbatim under `docs/requirements/`. Consult them before scope, phase-transition, architecture, data, localization, security, deployment or Definition-of-Done decisions. Update `docs/CURRENT_STATUS.md` before handing work to another chat.

The project owner has authorized read-only research of the locally installed PokeAlliance client for community wiki and tool development. Read `docs/LOCAL_CLIENT_RESEARCH.md` before accessing it. Protect credentials and unrelated personal data; do not modify or execute the client, bypass protections or assume blanket redistribution rights.

## Mission and current phase

Alliance Codex is an independent bilingual PokeAlliance knowledge platform and future tool/account/marketplace product. Information quality is more important than interface volume. The current execution order is mandatory:

1. master planning;
2. deep PokeAlliance research;
3. data model consolidation;
4. application foundation;
5. wiki core;
6. tools;
7. accounts;
8. marketplace.

Do not implement a later phase because its future existence is known. Check `docs/ROADMAP.md` and the active phase exit criteria.

## Proposed stack

Astro, strict TypeScript, selective React, Tailwind CSS, Zod, Supabase, Vercel and pnpm. Quality tooling will use ESLint, Prettier, Vitest and Playwright. This stack is provisional until research/data consolidation completes. Do not add an ORM, state framework, alternate backend/auth/storage, search service, monorepo or microservice without a demonstrated need and documented decision.

## Architecture rules

- Game data lives in owner-editable JSON under `content/`; the site reads it at build time. There is no staging or normalized layer.
- Keep domain logic framework-independent.
- Astro owns mostly static pages; React is reserved for genuine client state and complex tools.
- UI components never become the source of game facts.
- Stable entity IDs/slugs do not depend on display names or locale.
- External data is untrusted and validated at boundaries.
- Synthetic fixtures are isolated and unmistakably labeled.

## Data rules

- No provenance (D-012). Do not add sources, evidence, claims, verification status, confidence, retrieval/verification timestamps or source hashes to data, UI, schemas, scripts or the database.
- Unknown values are `null` and the UI shows `—`. Never store `0` for an unknown value, and never fill a gap with general Pokémon knowledge: it is not PokeAlliance behavior.
- Placeholder records carry `"borrador": true`.
- Canonical game names stay in English, exactly as the game shows them.
- Market items, outfits/addons, auras and sprites are the D-011 registries (`content/items/`, `content/outfits.json`, `content/auras.json`, `public/sprites/sprites.json`). Owner guide: `docs/REGISTROS.md`.
- Every JSON file under `content/` and `public/sprites/sprites.json` starts with `"$schema"` pointing at its JSON Schema in `content/schemas/` (`additionalProperties: false`). The Zod mirrors are `src/lib/content/registry-schema.ts` and `src/lib/content/content-schema.ts`; change a schema and its mirror together (tests check they agree). Value lists (Market categories, tiers, variants, elements) live only in the JSON Schemas; the Zod mirrors read them from there. `pnpm content:check` validates everything and the build parses every file with Zod.
- Zod stays on the server. React islands receive content as props or read it through a client-safe module (`src/lib/sprites/registry.ts`, `src/lib/tools/pokemon-roster.ts`, `src/lib/content/format.ts`); never import `repository.ts`, `registry.ts`, `content-schema.ts` or `src/lib/map/map-data.ts` from an island.
- Show game images through the sprite registry and the `Sprite` components, not hard-coded image paths. Pokémon portraits are the exception: they come from `imagen` in `content/pokemon.json` through `resolvePokemonImage`.

Targeted read-only research of the project owner's local PokeAlliance client is authorized. Before searching outside the repository, read `docs/LOCAL_CLIENT_RESEARCH.md`. Limit discovery to likely game paths, protect credentials and unrelated personal data, and never modify or automate the game client.

## Localization rules

1. Never translate canonical game entity names without explicit evidence that PokeAlliance uses that translation.
2. Always distinguish game data from editorial/UI content.
3. Editorial/UI content may be translated; canonical entities generally are not.
4. Do not substitute official Pokémon franchise localization for PokeAlliance terminology.
5. Research ambiguous terms before changing them.
6. Never modify canonical IDs because the content locale changes.
7. Spanish prose may naturally contain English canonical game terms.

The conceptual model is one domain entity plus localized presentation. Initial content locales are `es` and `en`; canonical game terminology is the default. Keep `canonicalName`, aliases and search keywords distinct.

Correct: `Necesitas 50 Oran Berry.`

Incorrect without PokeAlliance evidence: `Necesitas 50 Bayas Aranja.`

## Domain caution

“Rotation,” tier, tactical role, variant/form, AoE, Held, Lucky, Boost, Stars, utilities, hunts, drops, quests, economy and CACs are PokeAlliance-specific concepts. Do not impose mainline Pokémon semantics. Keep Alliance Codex analysis (recommendations, tactical roles) in editorial content, not in game data fields.

## Adding knowledge

1. Edit or add the record in the matching `content/` file; keep its `id` stable.
2. Leave unknown fields as `null`; mark placeholders with `"borrador": true`.
3. Reconcile canonical names and aliases before adding a new entity.
4. Run `pnpm content:check`, `pnpm check`, `pnpm test` and `pnpm build`.

Importers (for example `pnpm content:roster`) write to `content/` directly, never delete records and keep hand-edited values unless told to overwrite them.

## Migrations and security

Database migrations begin only after Phase 2. Once enabled, use ordered Supabase SQL migrations; never rewrite an applied migration. User-owned data defaults to RLS-deny and must have SQL policy tests. Service-role credentials are server-only. Validate writes, sanitize untrusted content, constrain uploads and keep secrets out of Git/client bundles.

## Working procedure

- Inspect the repository and dirty worktree before changes.
- Read the relevant plan, data strategy, risks and domain research.
- Use structural CodeGraph queries once the project has an index; use literal search for text.
- Keep changes scoped; preserve unrelated user work.
- Document significant decisions and update affected domain docs/data.
- Run checks appropriate to the current phase and report manual/runtime gaps honestly.
- Do not commit, push, deploy or mutate external services without explicit authorization.

## Commands

No application commands exist yet because the project is still before application initialization. Add and maintain exact commands here only after the toolchain is initialized. Never claim a check ran when the command does not yet exist.

## Before consequential changes

Confirm the active phase permits the change, identify the evidence/requirement, compare the simplest viable alternatives, document the decision, inspect affected contracts and risks, then implement and verify. If a credential is missing, add only the documented environment contract and continue with work that does not require the secret.
