# PokeAlliance Research Plan

> **Updated 2026-09-18 (D-011, D-012):** research results go straight into the owner-editable JSON under `content/`. There is no provenance: no source registry, evidence records, claims, confidence, retrieval dates or hashes.

## Goal

Build an accurate, structured representation of PokeAlliance that the site and future agents can use. The output is data in `content/`, not a prose game summary. Values nobody knows yet stay `null`.

## Research workflow

1. Search broadly: the official wiki, community wikis and repositories, videos and, within `docs/LOCAL_CLIENT_RESEARCH.md`, the owner's client.
2. Settle identity and terminology before adding records: stable slug ids, canonical English names exactly as the game shows them.
3. When two descriptions of the game disagree, the owner decides which value goes into `content/`. The file keeps only that value.
4. Write the records into `content/`, by hand or with a small importer, and run `pnpm content:check`.
5. Leave gaps as `null` and list open questions in `knowledge/unknowns/UNKNOWNS.md`.

Research is breadth-first across all domains, then depth-first according to player value, how much is unknown and how often the game changes.

## Where to look

| Place                                                | Use                                                                   |
| ---------------------------------------------------- | --------------------------------------------------------------------- |
| `https://wiki.pokealliance.com`                      | Core systems, rules, guides and terminology                           |
| `https://wiki.pokealliance.com/pokemon`              | Pokémon roster and attributes; `pnpm content:roster` imports it       |
| `https://pokealliance-wiki.vercel.app`               | Leads and cross-checks                                                |
| `https://github.com/thiagobfo/pokealliance-wiki`     | Field discovery                                                       |
| `https://github.com/tanjirokamadoserver/PokeMonster` | Historical code: ideas about mechanisms, never proof of current rules |

Material may be in Spanish, English, Portuguese or other languages; the language of a page never decides canonical terminology.

The owner has authorized targeted read-only research of their local PokeAlliance client installation and related files. `docs/LOCAL_CLIENT_RESEARCH.md` is the scope and safety policy.

## Acquisition surfaces

1. PokeAlliance-related wikis and their public web applications: rendered pages, public JavaScript bundles, route manifests, network/API contracts and static datasets. Hidden or unlinked public routes may be found, but authentication, access controls, encryption and technical protections must not be bypassed.
2. Owner-authorized PokeAlliance files on the local computer or supplied through `research-inbox/client-files/`, following `docs/LOCAL_CLIENT_RESEARCH.md`. What the client shows can differ between versions.

## Research domains and target breadth

| Domain                         | Questions                                                                    | Breadth target                                     |
| ------------------------------ | ---------------------------------------------------------------------------- | -------------------------------------------------: |
| Pokémon and variants           | identities, forms, shiny/mega/other variants, stats, elements, availability  | 95% roster identity; ≥80% core fields              |
| Moves and AoE                  | exact names, learnsets, geometry/range, cooldowns, effects                   | 90% identity; ≥70% mechanics                       |
| Rotations and tiers            | game/community meaning, eligibility, tactical roles, how often they change   | taxonomy complete                                  |
| Held/Lucky/Boost/Stars         | slots, constraints, values, upgrade rules                                    | 85% system concepts; unknown values `null`         |
| Pokéballs/materials/items/drops | identities, acquisition, use, quantities, dependencies                      | 85% identity; ≥70% relationships                   |
| Hunts/locations/NPCs           | canonical place identity, level/access, spawns, travel and rewards           | 80% known locations                                |
| Quests/systems                 | prerequisites, ordered steps, rewards, repeatability                         | 75% discovered; published steps complete           |
| Economy/trading/CACs           | currencies, player practices, permitted/prohibited conduct                   | current rules checked before any product model     |
| Utilities                      | Teleport and other utility capabilities and eligible entities                | taxonomy complete; lists may stay unknown          |
| Localization                   | canonical terms, aliases, translatable UI labels, official localizations     | glossary entry for every entity type               |

Coverage is measured per file against its required fields, not by impression. `pnpm content:check` prints the record and draft counts of every file.

## Outputs

```text
content/                 game data (JSON), one JSON Schema per file in content/schemas/
public/sprites/          game images and sprites.json
knowledge/
  unknowns/UNKNOWNS.md   open questions
  localization/GLOSSARY.md
  rules/                 server rules text
```

## Automation

Importers are small, deterministic Node scripts that respect robots, terms and licensing. They write to `content/`, never remove records and keep values edited by hand unless asked to overwrite them (`scripts/content/import-roster.mjs` is the model). `pnpm content:check` checks ids, uniqueness, allowed values, references between files and images.

## Keeping data current

The game changes with updates. Re-run the importers and read the launcher changelog after each update (a daily changelog job is a future item in `ROADMAP.md`). A failed fetch never erases data that is already in `content/`.

## Done criteria for a research pass

A research pass on a domain is done when:

- its records are in `content/` and pass `pnpm content:check`;
- values nobody knows are `null` and the open questions are in `knowledge/unknowns/UNKNOWNS.md`;
- new entity types have canonical names and glossary entries.

A pass does not need 100% coverage. It needs enough breadth to separate stable model requirements from unknowns.
