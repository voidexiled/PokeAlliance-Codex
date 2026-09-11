# PokeAlliance Research Plan

## Goal

Build a structured, auditable representation of PokeAlliance that the application and future agents can consume. The goal is not a prose game summary; it is evidence with coverage, provenance, uncertainty and refreshability.

## Research workflow

1. Discover and register sources broadly across official, community, code, video and archive surfaces.
2. Snapshot or record raw evidence without rewriting its claims.
3. Extract candidates into staging records with source pointers.
4. Normalize only after identity and terminology are reconciled.
5. Triangulate material claims and record conflicts rather than selecting silently.
6. Validate datasets mechanically and sample them manually.
7. Publish coverage, freshness, conflicts and unknowns together.

Research is breadth-first across all domains, then depth-first according to user value, uncertainty and source volatility.

## Initial sources

| Source | Initial classification | Intended use |
|---|---|---|
| `https://wiki.pokealliance.com` | official/current candidate | Core systems, rules, guides and terminology |
| `https://wiki.pokealliance.com/pokemon` | official/current candidate | Pokémon roster and game-specific attributes |
| `https://pokealliance-wiki.vercel.app` | community/current candidate | Coverage leads and cross-checks |
| `https://github.com/thiagobfo/pokealliance-wiki` | community code/data | Reproducible data leads and field discovery |
| `https://github.com/tanjirokamadoserver/PokeMonster` | historical | Mechanism/field hypotheses only; never automatic current proof |

“Official” and “current” must be verified from the source itself. Additional sources will be discovered in Spanish, English, Portuguese and other useful languages; source language never determines canonical terminology.

The project owner has also authorized targeted read-only research of their local PokeAlliance client installation and related files. Use `docs/LOCAL_CLIENT_RESEARCH.md` as the controlling scope and safety policy. Local observations must carry client version, path metadata and hashes.

## Primary acquisition surfaces

Phase 1 prioritizes two acquisition families:

1. PokeAlliance-related wikis and their publicly delivered web applications. Research may inspect rendered pages, public JavaScript bundles, route manifests, network/API contracts, static datasets and otherwise publicly accessible application resources. Hidden or unlinked public routes may be discovered, but authentication, access controls, encryption and technical protections must not be bypassed.
2. Owner-authorized PokeAlliance files on the local computer or deliberately supplied through `research-inbox/client-files/`. Local evidence follows `docs/LOCAL_CLIENT_RESEARCH.md`, remains version-specific and is not automatically publishable.

The administrator-maintained wiki is especially valuable because some content appears to have been authored or maintained by PokeAlliance administrators. That increases its authority for scoped claims, but every extracted fact still records its exact page/resource and retrieval date.

## Source registry fields

Every source record includes: stable ID, name, URL, source type, authority, scope, language, access method, last checked, last successful retrieval, observed update date, freshness classification, licensing/usage notes and operational notes. Individual evidence records add locator, captured excerpt or structured payload hash, retrieval timestamp and claim linkage.

## Trust and contradiction policy

Evidence is evaluated on authority for the exact claim, directness, recency, reproducibility and corroboration. A current official Pokémon page can outrank a broad official guide for a Pokémon field; a reproducible current game-visible observation may expose stale documentation. Historical code generates hypotheses but cannot establish current behavior.

For disagreement, create a conflict with all candidate values, sources, dates, affected records, severity and resolution status. Never overwrite the losing value without preserving history.

## Research domains and target breadth

| Domain | Questions | Breadth exit target |
|---|---|---:|
| Pokémon and variants | identities, forms, shiny/mega/other variants, stats, elements, availability | 95% roster identity; ≥80% core fields |
| Moves and AoE | exact names, learnsets, geometry/range, cooldowns, effects | 90% identity; ≥70% verified mechanics |
| Rotations and tiers | game/community meaning, eligibility, tactical roles, evidence and volatility | taxonomy complete; all published claims sourced |
| Held/Lucky/Boost/Stars | slots, constraints, values, upgrade rules | 85% system concepts; unknown values explicit |
| Pokéballs/materials/items/drops | identities, acquisition, use, quantities, dependencies | 85% identity; ≥70% relationships |
| Hunts/locations/NPCs | canonical place identity, level/access, spawns, travel and rewards | 80% known locations; access gaps explicit |
| Quests/systems | prerequisites, ordered steps, rewards, repeatability | 75% discovered; 100% published steps sourced |
| Economy/trading/CACs | currencies, player practices, permitted/prohibited conduct | current rules verified before any product model |
| Utilities | Teleport and other utility capabilities and eligible entities | taxonomy complete; lists may remain unknown |
| Localization | canonical terms, aliases, translatable UI labels, existing official localizations | glossary for every normalized entity type |

Percentages use defined required-field matrices, not subjective impressions. The report will show identity coverage, field coverage, source coverage and freshness separately.

## Raw and machine-readable outputs

```text
knowledge/
  sources/
  research/
    raw/
    notes/
  conflicts/
  unknowns/
  localization/GLOSSARY.md
data/
  staging/
  normalized/
  schemas/
  reports/
```

Raw captures are append-only where licenses and access permit storage. Otherwise records preserve URL, timestamp, locator, digest and a concise claim summary. Generated files carry generation metadata.

## Automation

Source-specific importers must be small, deterministic, rate-limited and respectful of robots, terms and licensing. They write staging—not normalized production data. Fixtures and manual overrides live separately. Each importer reports added/changed/rejected records and stores enough metadata to reproduce the transformation.

Schema validation checks required IDs, uniqueness, enums, referential integrity, locale codes, provenance, date formats and forbidden “invented default” patterns. Semantic checks flag impossible references and suspicious mass changes.

## Freshness and stale-data handling

Sources receive a refresh policy based on volatility. Retrieval failure does not erase the last good capture. Claims store observed/verified dates separately from retrieval dates. Material changes produce a diff and can mark dependent translations or conclusions `needs_review`/`outdated`.

## Phase 1 exit criteria

Phase 1 completes only when:

- a broad source map has been searched beyond the initial links;
- the source registry and authority taxonomy are populated;
- every domain has a field inventory and measured coverage;
- raw/staging/normalized boundaries are demonstrated with validated datasets;
- canonical terminology and localization glossary exist;
- provenance is present for normalized facts;
- conflicts and unknowns are published, not hidden;
- automated schema validation passes;
- a coverage report identifies safe-to-model areas and weak areas;
- the research log records searches, access failures and next leads.

The phase need not achieve 100% factual coverage. It must achieve enough breadth and traceability to distinguish stable model requirements from unknowns.
