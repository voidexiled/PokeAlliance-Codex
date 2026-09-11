# Alliance Codex Agent Guide

Read this file and the current phase documents before substantial work. Chat history is not authoritative.

## Mandatory continuity reading

For a new chat or resumed session, read in this order:

1. `docs/PROJECT_SPEC.md`
2. `docs/CURRENT_STATUS.md`
3. the active phase plan and exit criteria
4. `docs/RISKS_AND_UNKNOWNS.md`
5. relevant knowledge/data files

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

Astro, strict TypeScript, selective React, Tailwind CSS, customized shadcn/ui, Zod, Supabase, Vercel and pnpm. Quality tooling will use ESLint, Prettier, Vitest and Playwright. This stack is provisional until research/data consolidation completes. Do not add an ORM, state framework, alternate backend/auth/storage, search service, monorepo or microservice without a demonstrated need and documented decision.

## Architecture rules

- Keep raw evidence, staging records, normalized knowledge and serving/database representations separate.
- Keep domain logic framework-independent.
- Astro owns mostly static pages; React is reserved for genuine client state and complex tools.
- UI components never become the source of game facts.
- Stable entity IDs/slugs do not depend on display names or locale.
- External data is untrusted and validated at boundaries.
- Synthetic fixtures are isolated and unmistakably labeled.

## Source priority and evidence

Evaluate authority per claim. Prefer current direct PokeAlliance official evidence, then current corroborated PokeAlliance community evidence. Treat `tanjirokamadoserver/PokeMonster` and similar repositories as historical hypothesis sources unless current evidence confirms a claim. General Pokémon knowledge is never proof of PokeAlliance behavior.

Every normalized material fact needs provenance, retrieval/verification time and status. Preserve contradictions. Unknown facts remain `null`/`unknown`; never infer silently.

Targeted read-only research of the project owner's local PokeAlliance client is authorized. Before searching outside the repository, read `docs/LOCAL_CLIENT_RESEARCH.md`. Limit discovery to likely game paths, protect credentials and unrelated personal data, record client version/path/hash provenance, and never modify or automate the game client.

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

“Rotation,” tier, tactical role, variant/form, AoE, Held, Lucky, Boost, Stars, utilities, hunts, drops, quests, economy and CACs are PokeAlliance-specific concepts. Do not impose mainline Pokémon semantics. Document whether classifications are game facts, sourced community consensus or Alliance Codex analysis.

## Adding knowledge

1. Register/check the source and its authority/freshness.
2. Capture raw evidence or a compliant evidence pointer.
3. Extract into source-specific staging.
4. Reconcile canonical identity and terminology.
5. Add normalized records with evidence references and status.
6. Run schema, uniqueness, reference, provenance and localization checks.
7. Update coverage, conflict/unknown registries and research log.

Never edit generated normalized output without an explicit curated override workflow.

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
