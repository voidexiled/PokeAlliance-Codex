# Current Status

Last updated: 2026-09-11  
Repository: `C:\Users\jalom\Documents\ChatGPT\PokeAlliance-Codex`  
Branch: `master`  
Git history: no commits yet

## Active phase

**Phase 5 — Tools inside the approved wiki shell.**

Phase 0 planning, Phase 1 research, Phase 2 data-model consolidation, Phase 3 technical foundation, Phase 3A visual correction and the first Phase 4 Wiki Core content slice are complete with documented limitations. The owner-approved reference is a quiet modern wiki: global search, grouped sidebar, documentary portal, article layouts, contextual summaries, tools and changes inside the same shell. The Supabase project `PokeAlliance Codex` is now linked and its seven migration files are applied; the first authenticated guild persistence slice is implemented and owner acceptance remains pending.

## Completed

- Preserved all three original prompts verbatim under `docs/requirements/`.
- Added the authoritative specification index and precedence rules.
- Created Phase 0 planning documents and initial `AGENTS.md`.
- Created initial knowledge/research directory structure.
- Registered ten source surfaces and nineteen evidence records in machine-readable form, including the owner-provided Discord transcription, local-client observation, public map-source profile, official quest sample and the OTMM format reference.
- Inventoried the official-candidate wiki route surface and representative pages.
- Inspected the community wiki repository at commit `0135ccdef08109ff04dfc3343dbeb8fdfe9989b1` (2026-06-22).

- Inventoried community datasets and classified them as staging candidates/lead data due to missing per-record provenance.
- Classified `tanjirokamadoserver/PokeMonster` as historical hypothesis material only.
- Created evidence, conflicts, unknowns, glossary, terminology sample and initial coverage report.
- Validated that all repository JSON parses, source IDs are unique and evidence source references resolve.
- Preserved a user-provided transcription of the current Discord rules as high-volatility, not-yet-directly-verified evidence.
- Set Discord changelog ingestion to manual-only for now because bot access to the official Discord is unavailable; authorized automation is documented as optional future work and does not block Phase 1.
- Defined Server Save as a recurring civil-time rule at `00:00[America/Sao_Paulo]`, converted to visitor-local time through a centralized Temporal adapter.
- Added supplied Discord rule 6: client/wiki information may be used to build community wikis and tools, and community knowledge contributions are encouraged. Wholesale redistribution rights for individual copyrighted assets remain a separate scope question.
- Recorded explicit owner authorization for read-only local-client research and found the installation at `C:\Users\jalom\AppData\Local\PokeAlliance Games\PokeAlliance`.
- Completed a metadata-only first inventory: 8,075 files (~810 MB), including Lua/OTUI modules for Pokédex, moves, item drops, quests, hunts, NPCs, minimap, market, Stars and other game systems, plus a 672,128-byte `minimap.png`.
- Recorded owner authorization for targeted read-only research of local PokeAlliance client files, including map formats and data relevant to a future interactive map, under `docs/LOCAL_CLIENT_RESEARCH.md`.
- Added a read-only OTMM parser and a stable, hashed profile of the historical `minimap854.otmm` snapshot: OTMM v1, 33,501 blocks and floors 0–15. A current local roaming refresh was separately parsed at 33,538 records and is used only for the derived Phase 5 preview.
- Established the protected-client boundary: sampled packaged Lua/OTML/PNG-labeled assets were not bypassed or decoded.
- Added draft required-field matrices for Pokémon variants, moves, locations/hunts, items, quests, tier/rotation assertions and map features.
- Added shared staging/normalized research schemas, a wiki-to-staging demonstration and source-specific importer contracts.
- Added an automated research validator and generated the first measured normalized-data coverage baseline.
- Added supported normalized samples for one move (`Scratch`), one location (`Saffron`) and one item (`Normal charger`) from current administrator-wiki evidence.
- Formalized the two primary Phase 1 acquisition families: publicly delivered wiki pages/application resources and owner-authorized local or supplied PokeAlliance client files.
- Added a Git-ignored `research-inbox/client-files/` for owner-supplied client research inputs.
- Inventoried the supplied inbox: 8,882 files (~926 MB), including the full client, launcher caches and runtime state; sensitive WebView/account/profile branches were explicitly excluded, with the specifically authorized guild export inspected structurally.
- Discovered a structured 20-record launcher news feed suitable for local changelog ingestion and a versioned launcher Terms of Service cache.
- Updated changelog architecture: local launcher-feed ingestion is available now; Discord remains manual-only.
- Implemented and verified the launcher-feed profiler; its current source hash reproduces 20 news records and 2 banners without persisting raw HTML.
- Inventoried minimap module and marker assets: waypoints, coordinate search, map flags, floor/zoom controls and nine named marker categories. Their placement data remains unresolved because module/image bytes are protected.
- Extracted 119 actual `Minimap.flags` records from runtime `config.otml`, including descriptions, icon IDs and `(x, y, z)` coordinates across floors 1–9. Added a conservative normalized map-feature sample.
- Formalized the interactive-map layers and community-contribution workflow. The client has separate Pokédex, hunt-finder and item-locator affordances, but the Pokémon coordinate payload source is still unverified.
- Re-profiled the public map-related sources: the official roster API has no coordinate fields, sampled official detail payloads have no structured spawn table, and pinned community location/hunt/task datasets have no x/y/z records. Added a reproducible profile and registered `UK-010`.
- Added the manual map-contribution capture protocol for Pokémon, NPC, quest and travel-point observations, with explicit pending/reviewed states and Temporal-preserved capture instants.
- Added and measured an official quest sample for `Porygon Quest: Dr. Vektor`, preserving its requirements, steps, rewards and missing coordinate/repeatability fields.
- Added and measured a tier/rotation assertion sample for special Shiny availability, keeping exact appearance rates explicitly unknown.
- Published the complete Phase 1 exit audit: [PHASE_1_EXIT_REPORT.md](PHASE_1_EXIT_REPORT.md). It records all met criteria, measured coverage, safe-to-model areas, weak areas and the Phase 2 handoff.
- Registered the Rule 6 scope/numbering difference between the supplied Discord rules and launcher Terms of Service as conflict `C-003`.
- With explicit owner authorization, inspected the structure of the guild export and related player/ranking caches. The guild export contains 25 members with contribution, dailies, level, rank, status and last-login fields, but no stable member ID.
- Added the future guild snapshot contract and privacy-preserving profile: [GUILD_SYSTEM_RESEARCH.md](GUILD_SYSTEM_RESEARCH.md), `data/schemas/guild-snapshot.schema.json` and `data/research/guild-export-profile.json`.
- Consolidated the definitive data model in [DATA_MODEL.md](DATA_MODEL.md), including identity/variant rules, claims/provenance, localization, Temporal semantics, map contributions, guild snapshots, import idempotency and correction workflow.
- Replaced the provisional architecture with [ARCHITECTURE.md](ARCHITECTURE.md), keeping `ARCHITECTURE_PROPOSAL.md` as historical context.
- Added the Phase 2 canonical interchange schema at `data/schemas/canonical-record.schema.json` so reviewed records can project into typed entities and field-level claims without confusing staging statuses with publication statuses.
- Designed the Supabase migration set in `supabase/migrations/`, documented its order and safety boundary in `supabase/README.md`, linked the remote `PokeAlliance Codex` project and applied all seven migrations.
- Added `scripts/research/validate-phase2-model.ps1` and generated `data/reports/phase2-model-validation.json`; the audit found zero issues and reran the Phase 1 research validator successfully.
- Initialized the Astro 7 application with React, strict TypeScript, pnpm, Tailwind v4, customized shadcn/ui components and the Vercel server adapter.
- Added localized `/es/` and `/en/` routing, metadata, responsive accessible navigation, product design tokens and the Server Save Temporal display.
- Added the Supabase public environment/client contract while keeping the service-role key server-only; the browser now uses the public client for account sessions and the protected guild RPCs.
- Added Prettier, ESLint, Astro type checking, Vitest, Playwright, data validators, CI workflow and Vercel configuration.
- Added Phase 3 foundation routes for Home, Pokédex, Guías, Mapa and Sistemas; the map route now contains the verified client-coordinate preview while the reviewed Wiki Core surfaces consume real sample records.
- Published the Phase 3 exit audit: [PHASE_3_EXIT_REPORT.md](PHASE_3_EXIT_REPORT.md).
- Added the typed content repository at `src/lib/content/`, reading normalized datasets plus source/evidence registries without embedding research records in UI components.
- Implemented the first Wiki Core slice: localized Home discovery, Pokémon index/detail, guides, systems, rotations/tiers, provenance views and catalog search.
- Added evidence trails and per-fact status indicators to keep supported claims, source links and record-level uncertainty visible in the UI.
- Added content-repository unit coverage and expanded browser smoke coverage to detail navigation, search, guides and sources; the Playwright server wrapper now works in local reuse and CI mode on Windows.
- Published the Phase 4 exit audit: [PHASE_4_EXIT_REPORT.md](PHASE_4_EXIT_REPORT.md).
- Recorded the owner correction and design gate in [DESIGN_DIRECTION.md](DESIGN_DIRECTION.md): Alliance Codex is a modern wiki, not a landing page; tools belong inside a wiki section; no visual system is approved yet.
- Added the owner's anti-AI quality requirement to the design gate: authored wiki voice, concrete source-backed copy, no generic marketing language or decorative generated-UI patterns, and an editorial review checklist for every screen.
- Recorded the three owner-provided modern-wiki screenshots as the visual reference and completed the Phase 3A exit report.
- Rebuilt the provisional landing-like shell as a wiki: grouped sidebar, global search, compact portal, breadcrumbs, article summary, documentary result lists, evidence trail, responsive navigation and quiet neutral tokens.
- Continued the owner-approved RubinoT wiki reference across the shared shell and localized home portal: the sidebar now uses restrained route iconography, the global/home search is a reusable shadcn `Input` + `Kbd` composition, and the home inventory uses reusable shadcn `Card` panels with dense collection, tool and community indexes instead of tall generic feature cards. Existing routes, reviewed counts, provenance boundaries and bilingual copy remain intact; no generated imagery was needed.
- Added the first wiki-native Tools and Changes routes; Changes is explicitly manual-only until official Discord access changes.
- Added the first Phase 5 tool: a localized coordinate preview with 119 client-observed minimap markers, floor/category filters, selection details and an explicit semantic-data boundary.
- Extended the map preview with client-style legend/layer visibility, zoom, recenter, pointer-drag panning, floor controls and cursor coordinates; the provided client screenshots are documented as interaction references, not map data.
- Added the current OTMM-backed base preview for floors 1/3/4/5/6/7/8/9, with a reproducible extraction script, source hash and coordinate bounds; semantic layers remain unresolved.
- Removed semantic overreach from the map legend: labels outside the known client categories now appear as “Otro marcador del cliente” until a reviewed relation identifies them as Pokémon, NPC, quest or another feature.
- Added the localized map contribution guide at `/es/mapa/aportar/` and `/en/mapa/aportar/`, with required evidence, Temporal-aware capture instants and explicit pending/approved/rejected/stale states. It is documentation-only until moderation and submission infrastructure exist.
- Registered the official teleport guide as a semantic-only map source for region/city/destination aliases; it is explicitly excluded from coordinate placement because it contains no structured x/y/z data.
- Confirmed the community Hoenn Hunts index as a second semantic/visual map source: 137 Pokémon entries with external map-album links are now tracked as reviewable leads, not automatic coordinate records.
- Added the future [Pokédex location capture protocol](POKEDEX_LOCATION_CAPTURE_PROTOCOL.md): a narrow, read-only observation around “Buscar Ubicación”, with credentials/session data excluded and no gameplay automation. It is planned research, not an active dependency.
- Added the public roster importer at `scripts/research/import-public-pokemon-roster.ps1` and its auditable staging snapshot at `data/staging/pka-admin-wiki.pokemon-roster.json`: 910 public variant rows, SHA-256 `69EDE079ED185E3EB1E7C8679DDC1C6D75AABC61CC811D26830F261F716DD8CD`, status `public_staging_snapshot`.
- Implemented the wiki-native Compare Pokémon and Tier Explorer at `/es/herramientas/pokemon/` and `/en/herramientas/pokemon/`. It compares published identity/tier/role/element fields, filters the public roster and keeps missing fields visible as “—”; it does not imply damage formulas, recommendations, movesets or spawn coordinates. See [PHASE_5_POKEMON_EXPLORER_REPORT.md](PHASE_5_POKEMON_EXPLORER_REPORT.md).
- Implemented the localized Guild Ranking tool at `/es/herramientas/guild/` and `/en/herramientas/guild/`. It validates client JSON exports, derives the Monday-to-Sunday week from `exportedAt` using `00:00[America/Sao_Paulo]`, separates daily and donation pace, includes contribution in WhatsApp/PNG exports and preserves the local history path. See [PHASE_5_GUILD_RANKING_REPORT.md](PHASE_5_GUILD_RANKING_REPORT.md).
- Updated the guild ranking calculation with owner-provided level bands (`0–149 Normal = 150`, `150–349 Wildscape = 300`, `350+ Primal = 600`), independent normal/premium goal matrices for total points, dailies and contribution, optional daily/weekly targets, and per-level residual contribution pacing. Direct game corroboration and owner visual acceptance remain pending.
- Added the daily-history engine, authenticated account panel and ordered Supabase foundation for guild administration: the tool accepts multiple cumulative exports with one row per canonical local date, can create/select a guild, saves through the owner/officer RPC and rehydrates saved daily exports/member totals after login. The remote schema, RLS boundary and anonymous RPC denial are verified; invitations, deletion policy and owner acceptance remain later work.
- Added an explicit guild-calculation workflow: imported exports remain a visible preview until confirmation, the action identifies the local weekday and switches between “Añadir cálculo de…” and “Actualizar cálculo de…”, and same-day replacements recalculate weekly deltas.
- Added a history overview for loaded records, covered weeks and months, with real date ranges, observed-day coverage and incomplete-period labels. Baseline exports are labeled as cumulative rather than being presented as invented daily deltas.
- Added configurable guild difficulty allocation: the tool calculates Normal/Wildscape/Primal counts per snapshot interval, detects tier transitions, exposes current/previous/review estimation policy, and lets the operator correct a member's interval through a validated table editor. The correction updates ranking totals and WhatsApp/Discord breakdowns; it is session-local until durable correction storage is added to the account schema.
- Added deterministic guild member lifecycle analysis over the saved snapshots: per-player level gains, observed joins, departures and returns, plus daily eligibility from the next Server Save and contribution eligibility from the second. Goal bands now use each member's eligible days, the UI exposes a weekly activity panel and per-row access state, Discord daily history includes the aggregate movements, and replacing a same-date snapshot rebuilds the derived lifecycle. Existing Supabase snapshot/member-total persistence already contains the required facts, so no parallel remote table or migration was added.
- Applied the second visual correction of the shared wiki shell from the owner's RubiOT reference: the home route now uses an in-content identity/search block, compact featured links and restrained catalog panels; deep pages keep a centered topbar search, persistent grouped navigation and the same neutral dark panel system. The guild tool remains inside the wiki shell without changing its data or interaction contracts.

## Important findings so far

- The administrator-maintained wiki home reports 530 Pokémon, while its all-Pokémon route reports 910 rows including variants. Counting unit/identity rules remain unresolved.
- The community site reports 425 Pokémon while its repository contains 847 tier/moveset rows; headline counts cannot be compared directly.
- PokeAlliance Shiny tiers such as `Legendary` and `Mythic` are game-specific rarity classifications, not traditional franchise species categories.
- Current Star guidance indicates a five-Star maximum and incompatibility between Stars and Mega Stone.
- The official-candidate wiki is a client-rendered SPA and does not expose a working sitemap at the conventional paths tested.
- User-provided Discord rules permit RMT outside official channels but prohibit price-based RMT advertisements in official game/Discord/forum channels; this does not by itself authorize every Alliance Codex marketplace design.
- The local minimap cache supports a future coordinate/floor-aware map, but it does not currently identify cities, hunts, NPCs, quests or teleport points.
- The official public Pokémon roster and the inspected community location datasets do not currently supply coordinate-level spawn markers; this is a documented research boundary, not a claim that the game lacks the feature.
- The official teleport guide can improve map labels and travel semantics, but it does not solve the Pokémon-location payload or justify coordinate inference.
- The community Hoenn Hunts index can supply map-image evidence for a meaningful subset of hunts; each image still needs manual coordinate alignment and provenance review.
- A future client-visible network observation may identify the Pokémon-location relation, but it must remain scrubbed, one-action scoped and pending review; no network interception or replay has been performed.
- The application currently exposes 6 normalized records across 6 collections, backed by 10 registered sources and 20 evidence records; this is a functional sample, not production-wide Pokédex coverage.
- The current shell follows the owner-provided wiki reference; it is visually verified at desktop width, while live content coverage remains a reviewed sample rather than production-wide coverage.

## Validation status

- `git diff --check`: passed.
- Research validation: passed with zero issues across JSON parsing, source/evidence IDs and references, authority values and normalized-fact provenance.
- Phase 2 model validation: passed with zero issues across required artifacts, migration order, required relational contract tokens, destructive-operation guard and Phase 1 validator rerun.
- Measured sample coverage: Pokémon 17.65%, move 66.67%, location 46.67%, item 46.15%, quest 87.5%, rotation/tier 76.92%; map feature 78.57%.
- Source ID uniqueness: passed.
- Evidence-to-source references: passed.
- OTMM reproducibility: passed against the stable snapshot; SHA-256 and summary metrics match the saved report.
- `pnpm run ci`: passed through format check, ESLint, Astro check, research validation, Phase 2 validation, Vitest and Astro/Vercel build after the guild-ranking slice.
- Application checks: `pnpm format:check`, `pnpm lint`, `pnpm check` (58 files, 0 errors), `pnpm test` (6 files, 18 tests), `pnpm build` and `pnpm test:e2e` (3/3) passed after the guild daily-history slice. Astro reports one deprecation hint for the browser-only `document.execCommand` clipboard fallback; it is not a build or type error.
- After the level-based guild goal update: `pnpm check` passed with 0 errors and one existing clipboard deprecation hint; `pnpm test` passed with 6 files and 20 tests.
- After the level-based guild goal update: `pnpm run ci` passed through build, and `pnpm test:e2e` passed 3/3 with parallel workers; the guild route was also verified against the real owner-provided export with no browser console errors.
- Guild sharing update: WhatsApp export is now localized per route (Spanish on `/es/`) and formatted as readable member blocks with level, dailies, contribution, total points, rank and last access. Discord export now uses Markdown, includes loaded daily/monthly aggregates without inventing missing history, and splits long rankings into ordered blocks under Discord's message limit.
- Guild sharing validation: `pnpm test` passed with 6 files and 21 tests, `pnpm check` passed with 0 errors and the existing `document.execCommand` deprecation hint, `pnpm lint` passed, `pnpm build` passed and `pnpm exec playwright test --workers=1` passed 3/3. The live browser was also checked with the real owner-provided JSON: both export buttons render and the copy actions now fall back when Clipboard API permission is unavailable.
- Guild history and difficulty workflow validation: `pnpm run ci` passed through format, lint, Astro check, research/Phase 2 validation, Vitest (6 files, 23 tests) and Astro/Vercel build; `pnpm exec playwright test tests/e2e/smoke.spec.ts --workers=1` passed 3/3, including opening and saving a manual difficulty breakdown. Astro reports the existing `document.execCommand` clipboard deprecation hint only.
- Guild lifecycle readiness validation: `pnpm run ci` passed through format, lint, Astro check, both data validators, Vitest (6 files, 27 tests) and the Astro/Vercel build; `pnpm exec playwright test tests/e2e/smoke.spec.ts --workers=1` passed 4/4. The dedicated Monday-to-Tuesday scenario verifies observed joins, per-member level gains, daily access on `d+1`, contribution access on `d+2`, eligibility-adjusted goal bands and same-date recalculation. The loaded state was visually inspected at desktop width; the existing clipboard deprecation hint remains the only diagnostic.
- Browser checks: Playwright smoke suite passed 3/3, including localized routing, Pokédex search/detail, guides, sources, guild JSON file loading, contribution table coverage, console/page-error checks and absence of the Astro error overlay. `agent-browser` verified the live guild route, screenshot, interactive snapshot, no console errors, no framework overlay and successful local JSON rendering.
- Visual shell correction validation: `agent-browser` inspected the Spanish home and Pokémon detail at 1440×900, the home at 375px, and the guild route after the shared CSS/layout update. The intended wiki hierarchy is visible in all three states; no new console or page errors were observed. Owner visual acceptance remains pending.
- RubinoT-reference continuation validation: the Spanish home was inspected at 1440×900 and 390×844, and the shared Pokédex shell at 1440×900. `pnpm run ci` passed (format, lint, Astro check, both data validators, 6 Vitest files / 27 tests and production build); `pnpm exec playwright test --workers=1` passed 4/4. The pre-existing `document.execCommand` deprecation hint remains the only Astro diagnostic. Owner visual acceptance remains pending.
- PostgreSQL/Supabase verification: the linked remote project has all seven migrations applied; RLS/advisor checks and anonymous RPC denial passed. Authenticated account creation/import acceptance still requires a real owner-controlled account and fixture.
- Production deployment, clean-machine install and owner visual/runtime acceptance: not performed.

## Carry-forward items for Phase 5 and later

- Continue the map work by comparing the derived OTMM surface with the client and correlating semantic coordinate boundaries; the coordinate, base-preview and client-style interaction slices are now verified.
- Keep the public Pokémon snapshot refreshable and separate from canonical content until field-level provenance, variant semantics and a permitted location payload are reviewed.
- Expand normalized records and aliases before enabling tools that would imply complete roster coverage; keep measured coverage and `UK-010` visible.
- Complete owner-controlled Auth acceptance with a disposable account and anonymized fixture; verify sign-in, guild creation, same-day replacement and rehydrated history against the linked project.
- Determine reuse/licensing boundaries for source text, datasets and media before production asset copying.
- Capture Discord changelog messages manually with links/IDs and timestamps when available; bot authorization is not an active dependency.
- The second read-only local sweep did not locate a readable data path behind the in-game Pokédex “Buscar localização” action; use a permitted client-visible capture/public resource or reviewed community capture when one becomes available.
- The dedicated local location helper modules and image files remain protected/nonstandard; no additional placement data was promoted from them.
- Correlate semantic map labels with the OTMM/config marker coordinates without treating colored tiles as place names.
- Validate a before/after guild export pair around `00:00[America/Sao_Paulo]`; only one structural owner export has been profiled so far. The tool now supports the multi-snapshot calculation path, but real longitudinal guild history still requires owner-provided exports from additional Server Save dates.
- Begin the live guild history on Monday with a consistent one-export-per-Server-Save-date cadence. The first loaded roster is an explicit baseline; exact join instants cannot be recovered from the JSON, so first appearances remain conservative observed intervals under `U-010`.
- Add guild invitations, officer management, retention/deletion workflows and an explicit member-consent policy before treating the guild dashboard as production-ready.
- Expand the map reader only after semantic coordinate labels are available; the current map route is a verified client-observation preview and the contribution guide is intentionally not a submission endpoint.

## Exact next action

Obtain owner visual acceptance for the RubinoT-reference shell continuation, then start the live guild history on Monday, 2026-09-14, with one export taken at a consistent point after each Server Save. Monday's first export is the baseline; a Sunday/boundary export is required only if Monday's pre-baseline level gains must also be measured. Validate that cadence through an owner-controlled account in the linked Supabase project, including same-day replacement and rehydration, and then continue Phase 5 with guild governance (invitations, officer access and deletion) before Rotation and Team Builders, followed by Hunt Finder. Keep the map-location capture protocol available for a permitted Pokémon lookup observation or reviewed community contribution, and keep `UK-010` open while preserving the published unknowns for cache completeness, licensing scope and Discord metadata.

## Worktree note

The worktree contains uncommitted project files and an untracked `.codegraph/` directory. Preserve all of them. Do not commit, push or publish without explicit authorization.
