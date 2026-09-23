# Alliance Codex — Authoritative Project Specification

This file is the stable entry point for the original project brief. The complete requirements are preserved verbatim in three version-controlled documents:

1. [`requirements/01_PRODUCT_SPEC.md`](requirements/01_PRODUCT_SPEC.md) — product vision, mandatory stack, knowledge/data/security/design requirements, Definition of Done and long-term roadmap.
2. [`requirements/02_EXECUTION_ORDER.md`](requirements/02_EXECUTION_ORDER.md) — controlling phase order, research requirements and exit gates. Where an earlier requirement appears to request application initialization immediately, this later and more explicit execution order controls: do not initialize the application before research and data-model consolidation.
3. [`requirements/03_BRAND_AND_LOCALIZATION.md`](requirements/03_BRAND_AND_LOCALIZATION.md) — official Alliance Codex identity and complete bilingual/canonical-terminology policy.

These three files are normative. Planning documents under `docs/`, notes under `knowledge/` and game data under `content/` implement or refine them but may not silently weaken them. D-012 in `docs/DECISION_LOG.md` removes their provenance requirements: sources, evidence, claim status, verification dates and source hashes are not stored or shown anywhere.

## Precedence

If project documents disagree, use this order:

1. the most recent explicit user instruction committed to the repository;
2. `requirements/02_EXECUTION_ORDER.md` for phase sequencing and gates;
3. `requirements/03_BRAND_AND_LOCALIZATION.md` for identity/localization;
4. `requirements/01_PRODUCT_SPEC.md` for the full product and engineering contract;
5. approved ADRs and phase consolidation documents;
6. plans and proposals;
7. implementation details.

Owner-granted operational authorizations that extend the original brief are recorded in dedicated policy files. Current local-client research authorization is defined in `docs/LOCAL_CLIENT_RESEARCH.md`.

Never resolve a conflict silently. Record it in `docs/DECISION_LOG.md`.

## Mandatory reading for a new chat

Read, in order:

1. `AGENTS.md`
2. `docs/PROJECT_SPEC.md`
3. `docs/CURRENT_STATUS.md`
4. the active phase plan and its exit criteria
5. `docs/RISKS_AND_UNKNOWNS.md`
6. the relevant `content/` files for the task

The three full requirement documents need not be loaded on every small task after this index has been read, but they must be consulted for scope, phase transitions, architecture, localization, data, security, publishing or Definition-of-Done decisions.

## Continuity rule

Chat history is never the source of truth. Before ending a substantial work session, update `docs/CURRENT_STATUS.md` with checkout state, active phase, completed evidence, unresolved blockers, exact next action and validation status. A future agent should be able to resume using repository files alone.
