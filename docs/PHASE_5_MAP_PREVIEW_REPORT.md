# Phase 5 — Map coordinate preview

Date: 2026-09-09  
Status: coordinate preview and client-style interaction slice complete; semantic map remains in progress

## Delivered

- Replaced the map placeholder with a localized interactive preview at `/es/mapa/` and `/en/mapa/`.
- Loaded the 119 marker observations extracted from the owner-authorized local `config.otml` `Minimap.flags` snapshot.
- Added floor selection for floors 1, 3, 4, 5, 6, 7, 8 and 9.
- Added marker-category filters for Pokémon Center, Poke Mart, Fisherman, other client flags and unlabeled records. Non-empty labels that are not a known client category remain explicitly unclassified.
- Added text filtering, coordinate-plane positioning, selectable markers and a details panel for `x`, `y`, `z`, `icon` and `flagId`.
- Preserved the source snapshot hash in the UI and kept the map boundary visible.
- Added a client-style map legend with counts and independently toggleable categories derived from the collected records.
- Added a reproducible OTMM extraction script and a lightweight base-map thumbnail per reviewed floor, derived from the current owner-authorized `PokeAllianceV3/minimap854.otmm` snapshot.
- Aligned marker positions with the OTMM block bounds instead of the marker-only extent, so the base surface and client flags share the same coordinate space.
- Added zoom, recenter, pointer-drag panning, floor up/down controls and a cursor coordinate readout without presenting them as a full OTMM renderer.
- Kept the map viewport as an accessible labeled region so its controls and layers remain discoverable to assistive technology.
- Kept the tool inside the wiki shell under Herramientas, with breadcrumbs and the same documentary visual language.
- Added the map contribution guide at `/es/mapa/aportar/` and its localized equivalent, documenting manual capture fields, Temporal-preserved instants and review states without pretending that automatic submission exists.
- Registered the community Hoenn Hunts index as a visual map-lead source: 137 Pokémon/hunt entries with external map albums, staged for manual review rather than automatic coordinate import.

## Reference behavior captured from the client

The owner-provided screenshots establish the target interaction model: the map occupies the main surface, a compact legend sits over the upper-left corner, zoom/floor controls and a coordinate readout sit over the lower-right corner, and map markers can represent different gameplay layers such as houses, dungeons, instance hunts and Pokémon spawns. Those screenshots are treated as behavioral and visual references; they are not used as the map's base raster or as evidence for new coordinates.

The current web slice reproduces the interaction chrome and a derived OTMM base for the layers that are actually present in the local `Minimap.flags` snapshot. The house, dungeon, instance-hunt and Pokémon-spawn layers remain unavailable until their data path and provenance are resolved.

The official teleport guide is now registered as a semantic-only source for future region, city and destination aliases. It can improve labels and travel context, but it contains no structured coordinate fields and cannot place a marker by itself. The community Hoenn Hunts index adds map-image evidence for a subset of hunts, but each image still needs manual alignment with the OTMM coordinate system.

## Deliberate boundary

This is a client-snapshot preview, not a claim that the project has reconstructed the complete or canonical world map. The base is a downsampled derivation of the current OTMM cache and may represent only explored or preloaded tiles. The current points are client-observed flags; their labels do not automatically prove the semantic identity of a city, NPC, quest, hunt or Pokémon spawn area. The Pokémon “Buscar localização” payload is still unresolved under `UK-010`.

Community contributions remain separate: a player observation must enter as `pending_review` and only become visible as canonical after manual review.

## Verification

- `pnpm run ci`: passed with 50 Astro files, zero Astro diagnostics, research/Phase 2 validators clean, Vitest 12/12 and production build complete.
- Playwright smoke suite: passed 3/3, including floor switching, zoom/recenter, layer visibility and marker selection.
- Visual browser inspection: completed at 1440px for the Spanish map route.
- OTMM extraction: passed against the current roaming snapshot; 33,538 records parsed, floors 1/3/4/5/6/7/8/9 derived, and source hash retained in `data/staging/local-otmm-preview.json`.
- No Supabase migration, deployment or automatic community submission workflow was introduced.

## Next map work

The current local-file investigation is now exhausted for this snapshot: the second read-only sweep did not find a readable semantic layer or Pokémon-to-coordinate payload. The contribution contract is now visible in the wiki, but it is documentation-only until a reviewed submission channel and moderation flow exist. Continue with selected-coordinate visual comparison and, as a future optional path, follow the scoped [Pokédex location capture protocol](POKEDEX_LOCATION_CAPTURE_PROTOCOL.md) when an ordinary client-visible observation is authorized.
