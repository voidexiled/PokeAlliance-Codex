# Phase 1 Exit Report — Alliance Codex

Status: **complete**  
Completed: 2026-09-09  
Next phase: Phase 2 — data-model consolidation  
Application status: not initialized by design

## Outcome

Phase 1 has completed its required research gate. The repository now has a broad source map, explicit authority and freshness conventions, source evidence, staging and normalized samples, provenance, measured coverage, conflicts, unknowns, terminology, operational rules and a reproducible validation command.

This is not a claim of 100% factual coverage of PokeAlliance. The exit rule requires enough breadth and traceability to distinguish stable model requirements from unresolved facts. The remaining gaps are published and carried forward instead of being filled by inference.

## Exit-criteria audit

| Criterion | Result | Evidence |
|---|---|---|
| Broad source map searched beyond initial links | Met | `data/research/sources.json`, `knowledge/research/RESEARCH_LOG.md`; official-candidate, community, historical, launcher, Discord transcription and local-client surfaces are registered |
| Source registry and authority taxonomy populated | Met | 10 registered sources using scoped `official_candidate`, `community`, `historical` and `discovery_only` authority values |
| Every domain has field inventory and measured coverage | Met | `data/research/field-matrices.json` and `data/reports/measured-coverage.json` cover Pokémon, moves, locations, items, quests, rotation/tier assertions and map features |
| Raw/staging/normalized boundaries demonstrated | Met | Owner-provided Discord transcription remains under `knowledge/research/raw`; staged wiki/client records and normalized samples are separate and validated |
| Canonical terminology and localization glossary exist | Met | `knowledge/localization/GLOSSARY.md` and `data/normalized/terminology.json`; observed game terms remain distinct from proposed UI translations |
| Provenance present for normalized facts | Met | Every normalized fact currently present has evidence IDs resolved by the validator |
| Conflicts and unknowns published | Met | `knowledge/conflicts/CONFLICTS.md` and `knowledge/unknowns/UNKNOWNS.md`; open roster scope, first-party labeling, Rule 6 scope, licensing, Server Save verification and map payload gaps remain visible |
| Automated validation passes | Met with scope stated | `scripts/research/validate-research.ps1` parsed 29 JSON files and reported 0 issues; structural contracts, IDs, references and normalized provenance passed |
| Coverage report identifies safe and weak areas | Met | `data/reports/COVERAGE.md`, `data/reports/measured-coverage.json` and this report distinguish model-ready system facts from weak coordinate, licensing and mechanics evidence |
| Research log records access failures and next leads | Met | `knowledge/research/RESEARCH_LOG.md` records public API discovery, protected-client boundary, Discord access limitation, launcher-feed path and manual map-capture lead |

The validator is intentionally dependency-free during the pre-application phase. A standards-compliant JSON Schema engine remains a Phase 2 tooling hardening task; it does not invalidate the completed Phase 1 structural/provenance gate.

## Research footprint

- 10 registered sources and 19 evidence records.
- 29 repository JSON files parsed by the validator.
- Supplied client inbox inventoried at 8,882 files; full client copy profiled at 8,075 files.
- Stable OTMM snapshot profiled at 33,501 blocks across floors 0–15.
- Runtime `Minimap.flags` extraction produced 119 coordinate-bearing marker records across floors 1–9.
- Launcher feed profile contains 20 news records and 2 banners.
- Guild export profile contains 25 member rows and the fields required for a future snapshot comparison; raw member values remain outside the repository.

## Measured normalized sample coverage

The percentages below are required-field coverage for normalized research records currently present, not roster completeness or total game coverage.

| Domain | Records | Measured field coverage | Interpretation |
|---|---:|---:|---|
| Pokémon/variant | 1 | 17.65% | Identity and selected core facts demonstrated; roster reconciliation remains open |
| Move | 1 | 66.67% | Slot, element and cooldown demonstrated; damage/AoE semantics remain open |
| Location/hunt | 1 | 46.67% | Saffron travel/access relation demonstrated; coordinate/spawn semantics remain open |
| Item | 1 | 46.15% | Training charger relation demonstrated; broad item identity/tradeability remains open |
| Quest | 1 | 87.5% | Dr. Vektor requirements, steps, rewards and system context demonstrated; coordinates/repeatability remain open |
| Rotation/tier assertion | 1 | 76.92% | Special Shiny tier availability rule demonstrated; exact rates remain undisclosed |
| Map feature | 1 | 78.57% | Client marker coordinates and provenance demonstrated; city/NPC semantics remain open |

## What is safe to model next

- Source/evidence/claim/unknown/conflict records with refresh and provenance metadata.
- Pokémon and variant records as separate identity candidates until the final identity rules are resolved.
- Guide and quest content with source-level citations and explicit missing fields.
- Client minimap as a coordinate/floor-aware base layer using a stable OTMM snapshot, while keeping artwork reuse and redistribution decisions separate.
- Client marker records from `config.otml` with version/config-snapshot provenance.
- Manual changelog imports and launcher-feed change detection; Discord bot access is not a dependency.
- Guild snapshots keyed by unique in-game name within guild/world scope, with immutable before/after observations and explicit completeness states.
- Temporal-aware Server Save display using canonical `00:00[America/Sao_Paulo]` and visitor-local conversion.
- Reviewed community contributions for NPCs, quests, hunts and map points, with pending/approved/stale/rejected states.

## Weak or intentionally unresolved areas

- The payload behind the in-game Pokédex “Buscar localização” action is still unknown. The official public roster API has no coordinate fields; sampled detail payloads and pinned community datasets also lack `x/y/z` records. This is `UK-010`.
- Protected client modules were not decoded. No encryption/protection bypass, client execution or modification was used.
- OTMM tiles establish map geometry/cache data but do not establish city, NPC, hunt, quest or teleport semantics.
- Public community records are useful leads but lack per-record provenance and coordinate-level data; they remain staging candidates.
- Move damage/AoE, exact utility eligibility, complete variant identity, full roster reconciliation, broad item relationships and rotation methodology need Phase 2 modeling and later evidence.
- Direct Discord message metadata for the supplied rules and changelog is unavailable; the transcription remains high-volatility owner-provided evidence.
- Rule 6 supports community wiki/tool research according to the supplied transcription, but wholesale redistribution rights for client sprites, maps, music, logos or third-party material remain unconfirmed.

## Operational decisions carried forward

1. Discord changelog ingestion is manual-only for now. The launcher feed is the currently available structured changelog path.
2. All user-facing dates and Server Save times must be rendered through Temporal from the canonical instant/zone, not hardcoded to Mexico or Brazil time.
3. In-game names are unique and are the guild member key within guild/world scope. Rename continuity requires an explicit alias transition.
4. Community map and knowledge submissions are claims first. A reviewer must promote them before canonical publication.
5. Client artwork and source text are not automatically copied into production assets merely because factual research is permitted.

## Phase 2 handoff

Phase 2 may now consolidate the relational/data contracts from this evidence. It must begin by reading `docs/CURRENT_STATUS.md`, this report, `docs/DATA_STRATEGY.md`, `docs/ARCHITECTURE_PROPOSAL.md`, `data/research/field-matrices.json`, the schemas and the conflict/unknown registries.

Phase 2 must not silently resolve the open entries. It should define migration-safe identity/form records, claim history, temporal fields, map layers, community-review records and import correction behavior around the evidence already captured. Astro, Supabase, UI and deployment remain outside this Phase 1 report and have not been started.

## Verification command

```powershell
& .\scripts\research\validate-research.ps1 -RepositoryRoot (Get-Location).Path -WriteCoverageReport
git diff --check
```

Last run: 29 JSON files, 10 sources, 19 evidence records, 0 validation issues, and clean whitespace diff check.
