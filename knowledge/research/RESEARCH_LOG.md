# Research Log

## 2026-09-09 — Breadth pass 1

- Inspected the empty project repository and completed Phase 0 documents.
- Searched for official, community, repository, guide, Discord and tool surfaces in multiple language contexts.
- Confirmed that `wiki.pokealliance.com` currently exposes an administrator-maintained wiki claim, a 530-Pokémon/7-generation summary and 25+ guides.
- Confirmed that `pokealliance.com` links game download/account surfaces, describes game systems and explicitly advertises RMT as enabled; rules and operational limits still require direct current rule evidence before marketplace design.
- Inspected `pokealliance-wiki.vercel.app` and cloned its public source repository at commit `0135ccdef08109ff04dfc3343dbeb8fdfe9989b1` (2026-06-22).
- Counted community repository datasets: 847 tier/moveset rows, 802 drop rows, 426 location rows, 151 medal rows, 137 Hoenn hunt rows, 85 FAQ rows and smaller domain datasets.
- Observed that these JSON records do not carry per-record provenance or verified-at metadata and therefore qualify as staging candidates only.
- Cloned the historical `PokeMonster` repository at its current default-branch head for schema/data inventory. Its README identifies it as a Forgotten Server fork; it remains `historical` and cannot establish current PokeAlliance behavior.
- Discovered an additional player-maintained guide at `wiki-pka.netlify.app` and the public Discord invite. Discord content was not publicly inspectable without an authenticated interactive session.

### Early observations

- The official-candidate wiki reports 530 Pokémon, while the inspected community Pokédex page reports 425. This is a coverage/scope conflict, not proof that either individual roster record is wrong.
- The official-candidate Generation 5 page demonstrates variant rows sharing a National Pokédex number (for example normal and Shiny rows) and tier/level fields. The exact identity model still requires broader extraction.
- The first-steps guide describes rotation as maintaining useful combat options while cooldowns recover and explicitly frames its team composition as recommendation rather than server obligation. This supports separating game mechanics from editorial/tactical analysis.
- Canonical terminology visible across first-party surfaces is predominantly Portuguese/English mixed. Canonical names must be captured exactly per entity instead of translated from franchise terminology.

### Access/quality limits

- Search-engine rendering exposed text from the main wiki, but a reproducible structured endpoint/export has not yet been identified.
- No source license was found during this first pass for bulk reuse of the community JSON or game imagery.
- Search results are discovery aids; normalized claims must point to the underlying page/repository commit.

## 2026-09-09 — Breadth pass 2

- Extracted the client route inventory from the public wiki application bundle because `/robots.txt` and sitemap paths return the SPA shell rather than a route manifest.
- Identified explicit routes for seven generations, Pokémon detail, Shiny tiers, Boost, Helds, Star Machine, training, talents, Hazard/Mega Dens, PokéLog, Prey, Analyzer, weekly systems, economy surfaces and three quest groups.
- The all-Pokémon route currently reports 910 rows including normal/Shiny and other variants. The 530 home-page number therefore appears to use a different counting unit; this is recorded as an unresolved scope issue rather than a factual contradiction.
- Sampled the current Shiny-tier guide: `Ultra Rare`, `Legendary` and `Mythic` are PokeAlliance rarity classifications and do not imply traditional Pokédex legendary status. The guide says these special Shinies occur naturally only in compatible Primal Areas and does not disclose exact rates.
- Sampled Star Machine: supported tiers are T3 through Legendary, material compatibility depends on species/tier/current Stars, the maximum is five Stars, and Star-bearing Pokémon cannot receive Mega Stone. Exact rules remain source-versioned facts.
- Sampled a Pokémon detail (`Chimchar`) showing HP, experience, required level, tier, function, evolution cost and separate PVE/PVP move presentation. This provides the first representative field shape but not a final schema.
- Sampled Training and Hunt Stash guides, confirming that game systems contain numeric rules and eligibility conditions whose provenance/freshness must be field-level.
- Checked `pokealliance.com/robots.txt`; it defines content-signal meanings but currently contains no crawler directives or affirmative/negative content-signal values. This does not grant a reuse license.

### Next pass

- Enumerate the official wiki route inventory and update metadata.
- Inspect representative Pokémon, move, Held, Boost, Star, quest, hunt and economy pages.
- Profile community dataset schemas and cross-reference sampled records against current official pages.
- Locate current rules/changelog surfaces and clarify first-party ownership signals.
- Create source-specific staging importer specifications after licensing/access review.

## 2026-09-09 — Local client discovery pass 1

- Project owner explicitly authorized read-only discovery and analysis of the PokeAlliance client and related files for community wiki/tool research, including future interactive-map investigation.
- Located the current installation at `C:\Users\jalom\AppData\Local\PokeAlliance Games\PokeAlliance`.
- Inventory: 8,075 files totaling approximately 809,687,912 bytes. Dominant formats include 7,100 PNG, 291 OTUI, 250 Lua, 136 OTMOD, 114 OGG and 107 fragment shader files.
- Identified `data/things`, `data/locales`, `data/images`, `modules` and updater surfaces. No binary was executed and no client file was changed.
- Relevant modules include Pokédex, Pokémon, moves, item drops/locator, NPC dialog/trade, quest log, tasks, hunts, minimap, market, medals, Stars, berries, cooldowns, calendar and training.
- Located `data/images/minimap.png` (672,128 bytes, modified 2026-09-08). Its role appears presentational until dimensions, coordinate mapping and supporting minimap/cache files are inspected.
- This client inventory is version-specific local evidence. Exact client version and update manifest semantics remain to be determined.

## 2026-09-09 — Local minimap format pass

- Confirmed that sampled packaged `.lua`, `.otml` and `.png`-labeled client assets use protected or nonstandard encodings. Research stopped at that protection boundary; no decoding bypass, client execution or modification was attempted.
- Located the active runtime minimap at `C:\Users\jalom\AppData\Roaming\PokeAlliance\PokeAllianceV3\minimap854.otmm`.
- The active file changed during an initial read, so analysis was moved to a stable point-in-time copy at `C:\Users\jalom\AppData\Local\Temp\alliance-codex-minimap854-20260909.otmm`, SHA-256 `E3E0FE7BF1C18A89EA391EB9DF2B3C73CB2EF20DD26EED76AA2152186AD05933`.
- Added `scripts/research/inspect-otmm.ps1`, a read-only parser based on the open OTClient minimap format implementation.
- Confirmed OTMM v1, 64×64 blocks, zlib-compressed block payloads and three-byte tile records (`flags`, `color`, `speed`).
- Parsed 33,501 blocks across floors 0–15, with 30,094,994 `WasSeen` tile flags and 23,970,804 colored records. These counts describe cache records and must not be treated as unique playable area.
- The map cache proves that a coordinate/floor-aware interactive map is technically plausible. It does not yet provide semantic labels for cities, hunts, NPCs, quests or travel points.
- Persisted the reproducible result in `data/reports/local-client-otmm-profile.json` and registered both local evidence and the format reference.

### Next local-client pass

- Search only safe runtime metadata and waypoint/marker surfaces for coordinate labels without reading credentials, sessions or unrelated personal data.
- Correlate a small set of independently known locations with `(x, y, z)` before attempting map rendering or geographic claims.
- Keep game artwork reuse separate from factual extraction and licensing review.

## 2026-09-09 — Staging and measured-coverage baseline

- Profiled the pinned community repository without bulk-copying its content. Representative shapes were confirmed for tier/moveset, drops, locations, hunts, tasks and Boost data.
- Added shared staging and normalized research schemas plus a source-specific administrator-wiki staging example for Chimchar.
- Added `docs/STAGING_IMPORTERS.md` with deterministic contracts for the administrator wiki, pinned community repository, local OTMM and manual Discord changelog flows.
- Added `scripts/research/validate-research.ps1`. It validates JSON parsing, source authority values, source/evidence uniqueness and references, normalized fact provenance, and computes field coverage from the Phase 1 matrices.
- The first measured baseline contains one normalized Pokémon record: 3 of 17 required field instances are present (17.65%). Other domains report zero records rather than fabricated completeness.
- Runtime metadata inspection was restricted to filenames, sizes and timestamps. Potentially sensitive configuration, character and session-like files were not opened.

## 2026-09-09 — Representative official extraction pass 3

- Rechecked the administrator-maintained wiki and added current page-level evidence for Chimchar's PVE move table, the Teleport guide and the Training system.
- Added normalized research samples for `Scratch`, `Saffron` and `Normal charger`. Unsupported move damage/AoE, location coordinates and item tradeability remain absent rather than inferred.
- The measured baseline now reports: Pokémon 17.65%, move 66.67%, location 46.67% and item 46.15% required-field coverage for one sample each.
- Search discovery exposed quest category titles but not enough directly retrievable step/reward detail for a defensible normalized quest sample. Quest coverage remains zero pending an inspectable page.

## 2026-09-09 — Owner-supplied client inbox pass 1

- Inventoried 8,882 supplied files totaling 925,966,608 bytes. The inbox includes a full 8,075-file client copy, runtime state and launcher/WebView data.
- Excluded the launcher WebView profile and files associated with login databases, browser history, sessions, account settings, characters and guild-member exports from content inspection.
- Identified public-style launcher caches for feed, livestreams, ranking and Terms of Service and recorded their hashes and field shapes in `data/reports/owner-client-inbox-profile.json`.
- `feed.json` contains 20 structured news records. It establishes a practical local official-changelog ingestion path independent of Discord bot access.
- Changelog evidence confirms client terminology policy: interface content was translated into Portuguese and Spanish while move, item and tier names intentionally remain in English.
- Changelog evidence also identifies minimap semantics that should exist in this client generation: Nurse, Mark and Fisherman markers, a marker legend, and clickable city names for Teleport.
- Launcher-cached Terms of Service version `1781216239` was last updated 2026-06-11. Its Section 6 concerns accounts, while the owner-provided Discord transcription uses Rule 6 for community-tool/wiki permission. This document-scope difference is now conflict `C-003`, not treated as a revocation.

## 2026-09-09 — Guild snapshot research pass 1

- The owner explicitly authorized analysis of the previously excluded guild/ranking/player-related files for a future guild contribution system.
- The export `GuildMembers_Void_Exiled_2026-09-09_071522.json` contains 25 members and complete fields for level, daily completions, rank, status, contribution, display name and last login.
- The launcher cache exposes player totals by server and ranking aggregates by world, including experience, gain experience, deaths and guild-related ranking data. These are candidate aggregate signals, not yet a member-contribution measurement.
- Added a future snapshot schema and privacy-preserving export profile. Member names and raw export values remain outside the repository.
- Defined the intended comparison as immutable `before_server_save` and `after_server_save` snapshots around `00:00[America/Sao_Paulo]`, with completeness and missing-observation states.
- Contribution points alone are not treated as total effort; future guild metrics require an officer-defined period, weighting, retention and visibility policy.
- Owner clarification accepted as decision `D-004`: the unique in-game name is the functional guild-member identifier within guild/world scope. Rename continuity remains an explicit alias-transition concern, not a reason to reject name-based joins.

## 2026-09-09 — Minimap marker inventory pass 2

- Literal search of the supplied module files produced no readable source text because the client assets are protected/nonstandard.
- Filename metadata nevertheless identified a dedicated `game_minimap` module with `waypoint`, `searchcoords`, `flagwindow` and `waypoints` resources.
- The client also includes nine named NPC/activity marker assets: `catch`, `duel`, `event`, `gyms`, `item`, `kill`, `mark`, `nurse` and `requirement`, plus 20 numbered minimap flag assets and floor/zoom controls.
- Added `data/reports/local-client-minimap-marker-inventory.json`. These names are capability leads only; they do not yet establish coordinate placements or a publishable map layer.
- Visual inspection of sampled image bytes was not possible because the packaged image encoding is protected/nonstandard; no bypass was attempted.

## 2026-09-09 — Minimap semantic extraction pass 3

- Read only the `Minimap.flags` block from the owner-supplied runtime `config.otml`.
- Extracted 119 records with numeric flag ID, description, `(x, y, z)` position and icon index. The snapshot contains 57 `Pokemon Center`, 44 `Poke Mart`, 11 `Fisherman`, three named Pokémon marker descriptions and four blank descriptions.
- Coordinates span floors 1–9. The extracted dataset is stored under `data/staging/local-minimap-flags.json` with the source config hash.
- Added one normalized map-feature sample for a `Pokemon Center` marker while leaving city/NPC identity unresolved. It is a staging/model demonstration, not a complete location map.

## 2026-09-09 — Interactive map layer model pass 4

- Confirmed separate client affordance modules for minimap, Pokédex, Pokémon search/lupa, item locator, hunt finder, PokéTask and quest log.
- This supports a layered map architecture: OTMM base → client markers → official/server-derived location relations → reviewed community contributions.
- The presence of `game_pokedex` and `game_huntfinder` does not prove that Pokémon coordinates are stored locally. The next decisive evidence is a permitted client-visible lookup capture or a public endpoint/resource used by that lookup.
- Added `docs/MAP_RESEARCH_AND_CONTRIBUTIONS.md` and `data/reports/local-client-location-module-inventory.json`.

## 2026-09-09 — Launcher feed importer pass 1

- Added a deterministic launcher-feed profiler that records source hash, feed freshness, stable news IDs, category, title, creation time, body hash, headings and character counts.
- Persisted the current profile for 20 news records and two banners without copying raw HTML into the repository.
- This establishes a local changelog pipeline that can later produce reviewed candidate changes and detect source updates by stable IDs/content hashes.

## 2026-09-09 — Phase 1 exit audit

- Audited the written Phase 1 exit criteria against the repository artifacts.
- Confirmed broad source registration, authority/freshness conventions, domain field matrices, raw/staging/normalized boundaries, terminology, provenance, conflict/unknown registries, measured coverage, research log and automated structural validation.
- Published `docs/PHASE_1_EXIT_REPORT.md` with the evidence inventory, safe-to-model areas, weak areas, carry-forward unknowns and Phase 2 handoff.
- Marked Phase 1 complete in `docs/ROADMAP.md` and `docs/CURRENT_STATUS.md`. No application dependencies, database, UI or deployment were initialized.

## 2026-09-09 — Pokémon location payload pass 1

- Inspected the public wiki application bundle and confirmed that the public roster path calls `/api/pokemon`; its 910 records expose identity, variant, level, tier, role, element and route fields, with no coordinate/location fields.
- Inspected sampled public detail payloads for Abra, Lunatone and PokéLog. They contain prose/system content but no structured Pokémon spawn-coordinate table.
- Re-profiled the pinned community datasets: `locations.json` has 426 area/image-link records, `hoennHunts.json` has 137 location-link records and `tasks.json` has 43 NPC/location-link leads; none contains x/y/z coordinate records or floor values.
- Added `scripts/research/profile-public-map-sources.ps1` and `data/reports/public-map-source-profile.json` so this boundary can be rechecked without persisting raw page HTML or community bulk data.
- Registered `UK-010` for the still-unknown payload behind the in-game “Buscar localização” action.
- Added a manual contribution protocol that accepts coordinates from an ordinary in-game coordinate lookup while keeping area-only claims and unreviewed markers visibly provisional.

## 2026-09-09 — Official quest extraction pass 1

- Extracted a current official-wiki quest sample for `Porygon Quest: Dr. Vektor`.
- Captured level 200 requirement, Dr. Vektor entry flow, 45-minute limit, computer puzzle, Giant Porygon encounter, listed rewards and permanent Porygon-area access.
- Preserved missing repeatability/prerequisite-graph and coordinate fields as issues instead of guessing them.
- Added `data/staging/pka-admin-wiki.quest.sample.json`, `data/normalized/quests.sample.json` and quest evidence. The validator now measures quest-field coverage.

## 2026-09-09 — Tier/rotation assertion extraction pass 1

- Normalized one current Shiny-tier availability assertion from the administrator-wiki guide: Ultra Rare, Legendary and Mythic Shiny variants are restricted to compatible Primal Areas and do not naturally appear in common respawns or Wildscape.
- Preserved the compatibility condition and comparison set as evidence-backed fields; exact rates remain undisclosed and are not inferred.
- Added `data/normalized/rotation-tier-assertions.sample.json`; the validator now measures this domain too.

## 2026-09-09 — OTMM base preview and Pokémon location payload pass 2

- Reprofiled the current owner-authorized roaming `minimap854.otmm` snapshot without modifying the client. It is OTMM v1 with 33,538 valid compressed records, 64×64 blocks and 3-byte tiles across floors 0–15.
- Confirmed the loader structure against the permissively licensed OTClient reference: header, zlib-compressed blocks, compact color palette and coordinate-aligned floor blocks. The project stores only downsampled floor derivatives and the source hash, not the raw cache.
- Generated a reproducible visual base preview for floors 1, 3, 4, 5, 6, 7, 8 and 9 at `public/data/map/otmm/`, with metadata in `data/staging/local-otmm-preview.json`.
- Rechecked the installed Pokédex, minimap coordinate-search and Hunt Finder modules. Their packaged bytes remain protected/nonstandard and expose no readable location payload without crossing the authorized research boundary.
- Completed a second read-only local sweep across those resources, readable strings in client binaries and the roaming `config.otml`; profile/move state, chat text and `Minimap.flags` were present, but no Pokémon-to-coordinate relation or serialized lookup result was found. Binary-only matches were excluded as non-inspectable evidence.
- Updated `UK-010`: the visual OTMM layer is now available, but the Pokémon “Buscar localização” relation remains unknown and must come from an ordinary permitted lookup capture, public resource or reviewed contribution.

## 2026-09-09 — Public semantic-location pass 2

- Rechecked the official public wiki surface and its visible map-related leads. The roster route and sampled detail payloads still expose no structured Pokémon spawn coordinates.
- The official `Como usar TP` guide provides useful region, city, destination, unlock-condition and teleport-command semantics. It is registered as a semantic-only source for future aliases and travel labels, not as a coordinate source.
- Rechecked the local `game_minimap`, Pokédex and Pokémon location assets: the helper modules and location image files remain protected/nonstandard, so no additional readable placement or lookup payload was promoted.
- The map contract now explicitly separates `semanticOnlySources` from coordinate-bearing profiles. A city name, teleport command, area label or screenshot can guide a later reviewed relation but cannot place a marker by itself.
- A second community source was confirmed at `https://pokealliance-wiki.vercel.app/hunts`: 137 Hoenn/Tubos Pokémon hunt entries each link to an external map album. These are now tracked as visual map leads; the linked images must be reviewed and tied to the OTMM coordinate system before publication.
