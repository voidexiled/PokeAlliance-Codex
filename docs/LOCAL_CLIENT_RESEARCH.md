# Local PokeAlliance Client Research

Status: authorized by the project owner on 2026-09-09.

## Authorized scope

The project owner authorizes Alliance Codex research to search their computer for the installed or downloaded PokeAlliance client and related game files when useful for community wiki and tool development. Relevant targets include:

- client installation and update manifests;
- maps, map indexes, minimap data and coordinate systems;
- Pokémon, move, item, NPC, quest, hunt and location data;
- images and metadata needed to understand entities and systems;
- configuration, localization and protocol or schema clues;
- files useful for a future interactive map and other community tools.

This authorization covers read-only discovery and analysis. It does not automatically authorize modification of the installed client, execution of unknown binaries, bypassing protections, accessing accounts or sessions, extracting secrets, publishing proprietary binaries or redistributing third-party assets.

## Search discipline

1. Search likely PokeAlliance paths and filenames first; do not indiscriminately index unrelated personal documents.
2. Prefer metadata inventory before opening large or opaque files.
3. Never print credentials, tokens, session data, personal chat logs or unrelated personal information into outputs or project files.
4. Record source path, file size, modification time and cryptographic hash for research artifacts.
5. Copy only the minimum research sample into the repository, and only when storage or redistribution scope is justified.
6. Treat extracted values as client-version-specific evidence, not timeless facts.
7. Do not alter, patch or automate the game client during research.
8. Stop and document the boundary if a file is encrypted, credential-bearing, anti-cheat-sensitive or unrelated to community knowledge.

## Owner-supplied file inbox

The owner may leave copied client research inputs at:

`C:\Users\jalom\Documents\ChatGPT\PokeAlliance-Codex\research-inbox\client-files`

Its contents are ignored by Git except for the directory README. Treat every supplied file as private research input until format, sensitivity and redistribution scope are reviewed. Do not move or delete an owner's original file. Record hashes and provenance before extracting facts.

## Provenance class

Use `local_client_observation` with:

```text
originalPath
clientVersion
fileHash
fileModifiedAt
observedAt
extractorVersion
licenseOrPermissionBasis
```

Local client evidence can be highly direct, but it may be stale or incomplete. Triangulate material gameplay conclusions with current wiki or changelog evidence where possible.

## Interactive map research

Before proposing the map model, determine:

- map file/container formats and whether they are tiled, raster, vector or proprietary;
- world, floor and region identity plus coordinate origin;
- tile dimensions, zoom levels and floor transitions;
- links between coordinates, locations, NPCs, hunts, teleports and quests;
- whether image extraction/redistribution is permitted or derived overlays need original Alliance Codex assets;
- update and diff strategy across client versions.

Do not design the final map database or viewer until representative files have been inspected.

## Current OTMM and Pokédex follow-up

The owner-authorized roaming snapshot `PokeAllianceV3/minimap854.otmm` was reprofiled on 2026-09-09. It is an OTMM v1 file with 33,538 valid compressed records across floors `z=0..15`; the Phase 5 web derivation uses floors `1, 3, 4, 5, 6, 7, 8` and `9`, preserving the source hash and bounds in `data/staging/local-otmm-preview.json`. The extraction is reproducible with `scripts/map/extract-otmm-preview.mjs` and stores only downsampled PNG derivatives in `public/data/map/otmm/`, not the raw client cache.

The current client-local location flow remains a protected boundary. The packaged files `game_pokedex/pokedex.lua`, `game_pokedex/pokedex.otui`, `game_minimap/searchcoords.otui` and `game_huntfinder/huntfinder.lua` do not expose readable text or a structured payload in their installed form. No protection bypass, client modification or execution-time interception was used. Therefore the web map can now display the OTMM visual base and known `Minimap.flags`, but it cannot yet claim Pokémon spawn coordinates from the in-game “Buscar localização” action.

A second read-only sweep also covered the installed resource tree, readable strings in the client binaries and the owner-authorized roaming `config.otml`. It found profile/move state, chat text and the known minimap flags, but no Pokémon-to-coordinate relation or serialized lookup result. The dedicated location helper modules and location image files are also protected/nonstandard in the installed form. Binary-only matches were not promoted to evidence because they are not an inspectable payload. This closes the current local-file lead without crossing the protection boundary; the next valid evidence must come from an ordinary permitted lookup capture, a public resource or a reviewed contribution.
