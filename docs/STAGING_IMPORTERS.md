# Phase 1 Staging Importer Specifications

Status: draft contracts for research extraction. These importers do not write normalized or application data.

## Shared contract

Every importer writes a collection conforming to `data/schemas/staging-record.schema.json` and records:

- exact `sourceId` and source locator;
- extractor ID and version;
- input digest when a stable source artifact exists;
- source-native fields under `raw`, without silently renaming or completing values;
- parse, ambiguity and validation problems under `issues`.

Rejected records remain countable in the importer run report. Retrieval failure never deletes the last successful staging output. Importers must not infer canonical IDs, translations, tier meaning or gameplay relationships.

## Administrator wiki manual/page importer

Source: `source:pka-admin-wiki`.

Input is one explicit page URL and a human-recorded locator. Until a stable export is found, extraction is manual and stores only concise structured facts needed for research. The importer must preserve page terminology exactly and attach the page-level evidence ID during normalization.

Current demonstration: `data/staging/pka-admin-wiki.pokemon.sample.json` → `data/normalized/pokemon.sample.json`.

The public roster endpoint was profiled separately with `scripts/research/profile-public-map-sources.ps1`. Its current payload is suitable for identity/variant staging, but the profile intentionally rejects it as a map-coordinate source because no `x`, `y`, `z`, floor or location fields are present. Pokémon detail pages remain page-level evidence until a structured location payload is found.

Current quest demonstration: `data/staging/pka-admin-wiki.quest.sample.json` → `data/normalized/quests.sample.json`. The sample preserves requirements, steps, rewards and system context while leaving coordinates out because the source page does not provide them.

## Community repository profiler/importer

Source: `source:thiagobfo-repository` pinned to commit `0135ccdef08109ff04dfc3343dbeb8fdfe9989b1`.

Initial source shapes:

| File | Records | Observed source fields | Candidate domain |
|---|---:|---|---|
| `tierList.json` | 847 | `pokemon`, `tier`, `moveset` | Pokémon, move, tier leads |
| `drops.json` | 802 | `pokemon`, `drops` | item/drop leads |
| `locations.json` | 426 | `wildscape`, `pokemon`, `normal` | Pokémon/location leads |
| `hoennHunts.json` | 137 | `pokemon`, `location`, `types` | hunt/location leads |
| `tasks.json` | 43 | `pokemon`, `npc`, `location` | quest/NPC leads |
| `boost.json` | 18 | `stone`, `items`, `type`, `fragment` | Boost/item leads |

The first implementation should profile and reject malformed records before copying selected samples into staging. Repository values remain community leads until corroborated. No bulk normalized import is permitted while reuse terms and per-record provenance remain unresolved.

The same profile records that the community `locations.json`, `hoennHunts.json` and `tasks.json` files are useful leads but do not contain coordinate-level records. Their links and area labels can be preserved in staging as claims, never silently promoted to map points.

The same profile records that the community `locations.json`, `hoennHunts.json` and `tasks.json` files are useful leads but do not contain coordinate-level records. Their links and area labels can be preserved in staging as claims, never silently promoted to map points.

## Local OTMM importer

Source: `source:local-pka-client-2026-09-09`.

Input must be a stable copied snapshot with SHA-256, never the actively changing runtime file. `scripts/research/inspect-otmm.ps1` extracts format metadata, block/floor extents and tile flag counts. It does not assign place names or publish source artwork.

A future semantic importer may accept separately verified `(x, y, z)` markers. Those markers must identify how the coordinate was observed and must not be inferred solely from colored tile geometry.

## Discord manual changelog importer

Source: `source:pka-discord` or a specific owner-provided transcription source.

Input is manual while authorized bot access is unavailable. Required fields are message/channel ID or permalink when available, publication and edit timestamps, author role, captured text or compliant summary, locale and capture timestamp. A later edit creates a new evidence revision; it does not overwrite history.

## Run report

Each implemented importer must report `sourceId`, input locator and digest, extractor version, records read/accepted/rejected, warnings, timestamps, output path and output digest. Repeated execution on identical input must produce equivalent records apart from generation timestamps.
