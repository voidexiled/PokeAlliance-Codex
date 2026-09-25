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
4. Copy only the minimum research sample into the repository, and only when storage or redistribution scope is justified.
5. A client update can change extracted values; re-extract after updates instead of treating old values as permanent.
6. Do not alter, patch or automate the game client during research.
7. Stop and document the boundary if a file is encrypted, credential-bearing, anti-cheat-sensitive or unrelated to community knowledge.
8. Do not record paths, hashes, versions or timestamps as provenance (D-012); only the extracted game data goes into `content/`.

## Owner-supplied file inbox

The owner may leave copied client research inputs at:

`C:\Users\jalom\Documents\ChatGPT\PokeAlliance-Codex\research-inbox\client-files`

Its contents are ignored by Git except for the directory README. Treat every supplied file as private research input until format, sensitivity and redistribution scope are reviewed. Do not move or delete an owner's original file.

Client files can be stale or incomplete. Compare important gameplay values with the current wiki or changelog before writing them to `content/`.

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

The owner-authorized roaming snapshot `PokeAllianceV3/minimap854.otmm` was reprofiled on 2026-09-09. It is an OTMM v1 file with 33,538 valid compressed records across floors `z=0..15`; the Phase 5 web derivation uses floors `1, 3, 4, 5, 6, 7, 8` and `9` and writes their image, size and bounds to `content/map/floors.json`. The extraction is reproducible with `scripts/map/extract-otmm-preview.mjs` and stores only downsampled PNG derivatives in `public/data/map/otmm/`, not the raw client cache.

The current client-local location flow remains a protected boundary. The packaged files `game_pokedex/pokedex.lua`, `game_pokedex/pokedex.otui`, `game_minimap/searchcoords.otui` and `game_huntfinder/huntfinder.lua` do not expose readable text or a structured payload in their installed form. No protection bypass, client modification or execution-time interception was used. Therefore the web map can now display the OTMM visual base and known `Minimap.flags`, but it cannot yet claim Pokémon spawn coordinates from the in-game “Buscar localização” action.

A second read-only sweep also covered the installed resource tree, readable strings in the client binaries and the owner-authorized roaming `config.otml`. It found profile/move state, chat text and the known minimap flags, but no Pokémon-to-coordinate relation or serialized lookup result. The dedicated location helper modules and location image files are also protected/nonstandard in the installed form. Binary-only matches were not used because they are not an inspectable payload. This closes the current local-file lead without crossing the protection boundary; the next usable data must come from an ordinary permitted lookup capture, a public resource or a contribution the owner accepts.

## Owner-decrypted outfit preview (2026-09-17)

The owner supplied the already-decrypted `data/things/decrypted_objectbuilder/things_objectbuilder.dat` and `things.spr` under the installed-client tree. Read-only extraction by `scripts/assets/extract-outfit-preview.mjs` confirms a reusable mapping, now in `content/outfits.json` (D-011): `2` Bulbasaur, `5` Charmander, `7` Charizard, `8` Squirtle and `509` Shiny Charizard. Each has four directions and three phases in the DAT; only phase `0` is exported as the web `*-idle.png` frame. Phases `1..2` remain recorded as walking candidates and are not used by the Pokédex preview. Shiny Charizard was reconciled against the owner's ObjectBuilder screenshot: its visible label is `OUTFIT #509`; probing `589` from the same DAT produces a different blue creature and is not associated with Charizard. The web derivation contains 20 idle PNG frames, now in `public/sprites/outfits/<outfitId>/` (`norte`, `este`, `sur`, `oeste`) and registered in `public/sprites/sprites.json` (D-011); they are byte-identical to the dump's `default_<direction>_a0_m0_p0.png` frames.

The owner's local `shaders/pokealliance/outline/outfit_alliance.frag` supports the Alliance Ball preview. `outfit_rainbow.frag` is used only as a visibly labeled Premier **hypothesis**: neither the file name nor the owner's recollection confirms its in-game Premier Ball association. The owner supplied two 30 fps, 1920×1080 gameplay clips on 2026-09-17 (`D:\Videos\2026-09-17 18-07-49.mp4` and `D:\Videos\2026-09-17 18-08-06.mp4`). Frame sampling shows a hard pixel outline, not a diffuse glow; Alliance cycles blue/gold/white-blue and Premier cycles rainbow colors at the same continuous vertical-gradient cadence while the Pokémon remains on the phase-0 idle pose. The WebGL adaptation now samples one actual padded-texture texel (one source-pixel contour) instead of assuming a 64/128/256 texture after adding padding, uses a relative shader clock so its initial phase is deterministic and compensates for the browser UV origin so the visible gradient travels top-to-bottom like the supplied clips. This is a visual calibration from clips, not proof of exact engine uniforms or Premier association. The website uses a WebGL adaptation of those outline effects, not copied shader source. This experiment does not establish redistribution rights for the derived client frames; review that scope before committing or deploying them. No game client was modified or executed.

## Owner outfit dump tool (2026-09-18)

The owner asked for a reusable script to dump all or selected outfits, and to choose the folder that holds the client's `things` `.dat`/`.spr`. `scripts/assets/dump-outfits.mjs` (`pnpm assets:outfits`) now does this on top of a shared read-only reader, `scripts/assets/lib/otclient-things.mjs`. The input folder is chosen with `--things <folder>`, or exact files with `--dat`/`--spr`/`--otml`/`--otfi`. Precedence is: those flags, then `--things`, then `PKA_DECRYPTED_THINGS`, then the old default. `scripts/assets/extract-outfit-preview.mjs` accepts the same flags and now uses the shared reader. Its 20 preview PNGs and `manifest.json` were verified byte-identical to the previous implementation's output. Usage is documented in `scripts/assets/README.md`.

Input: the previously documented `data/things/decrypted_objectbuilder` folder no longer existed on 2026-09-18. The owner's current copy at `C:\Users\jalom\Documents\pka_output_decrypt\2026-09-18_17-00-17\data\things` contains `things.dat`, `things.spr`, `things.otml` and `things.otfi`. The OTFI declares `extended: true`, `transparency: true`, `frame-durations: false` and `frame-groups: false`. The installed `data/things` files still begin with `PKA1` and are refused by the tools.

Read-only guarantees:

- The tools abort on any input that starts with `PKA1` and never attempt decryption.
- They refuse output paths inside `...\AppData\Local\PokeAlliance Games` or inside any input folder, including subfolders whose names start with `..`. The `--map` target file gets the same check.
- An existing `--out` folder is reused only when it is empty or an earlier dump by the same tool, so another tool's `README.txt` or `manifest.json` is never overwritten.
- `--map` writes `content/outfits.json` only after the selection and output folder have been validated.
- `--registrar` writes the idle frames of the selected outfits to `public/sprites/outfits/<id>/` and updates `public/sprites/sprites.json`; it validates every outfit first, refuses `--all` and accepts at most 50 outfits per run.
- The dump never writes to `public/`. Only `--preview` regenerates the site previews.
- Every dump hashes its inputs only as an internal fingerprint, so a changed client re-renders its outfits. Input paths, input hashes and file signatures are not written to `outfit.json`, `manifest.json` or the `--list --json` output, which record the DAT/SPR structure instead. `--list` does not need the SPR.
- With `--dat` and no `--things`, the SPR, OTML and OTFI are looked up next to that DAT, never in `PKA_DECRYPTED_THINGS` or the default folder, so files from two clients are not mixed.
- The default output is the Git-ignored `research-inbox/client-files/outfits-dump`, and each output folder states that redistribution rights are not established.

Client-version-specific observations from this DAT:

- The DAT parses exactly to end of file: 50,704 items, 3,887 outfits, 2,882 effects and 251 missiles, using 10.10+ OTClient attribute numbering.
- There are no frame groups and no stored animation durations.
- `patternX` is 4 directions for 3,876 outfits and 1 for 11. `patternY` (addons) and `patternZ` (mount) are 1 for every outfit.
- Layer counts: 3,415 outfits have 1 layer, 471 have 2 (layer 1 is the yellow/red/green/blue colour template), and outfit 3359 has 21.
- 57 outfits have only zero sprite IDs.
- Raw attribute byte `39` carries 16 bytes on 1,055 outfits and never appears together with `displacement` (raw `25`). It is decoded as four signed x/y pairs. A per-direction offset is a hypothesis only.
- The `creatures` section of `things.otml` holds `opacity` or `name-displacement` for 22 outfit IDs; for example, 7 and 509 have `name-displacement: -10 -16`.
- The untouched `_pka_original/things.dat` uses a different attribute numbering and is not supported. No attempt was made to reverse it.

A full `--all --frames idle` run produced 15,280 PNG frames for 3,887 outfits. 235 fully transparent frames were recorded but not written. The frames total 19.8 MB (50.7 MB with the JSON metadata), and the run took about 21 s with about 125 MB peak memory. That output stayed in a temporary folder and is not part of the repository. No game client file was modified or executed.

## Item and Pokémon sprites (2026-09-24)

`scripts/assets/extract-game-sprites.mjs` reads the owner's decrypted copy (`pka_datamine/decrypted/<run>/data/things` and `data/images/pokemons`) and the game_datamine export, read-only, and writes the item inventory frames (`items/cliente/<clientId>`), the south idle frame of each Pokémon outfit (a strip for the 124 `animateAlways` outfits, 1000/phases ms per frame as OTClient's `Creature::internalDrawOutfit` does) and the missing Pokédex portraits. This DAT has 50,730 items and 3,892 outfits and parses to the last byte. 33 item `clientId`s of the export (50743–50801: Gen 4 loot and its coloured variants) are beyond the DAT and keep the placeholder until the decrypted client is refreshed. 62 Gen 4 Pokémon plus Bunnelby and Diggersby are missing from the cyclopedia export; their outfits were matched by eye against the client's own portraits (the DAT runs dex + 1605, + 1604 from Mime Jr., + 1598 from Carnivine) and are listed in the script. Bonsly has no outfit in that run. The shiny legendaries and Shiny Kecleon are only named with their normal form's lookType, so they stay without an outfit. The Mega Clefable, Mega Ampharos, Mega Lucario and Mega Abomasnow portraits are the `.2` files of their dex number, checked by eye. Redistribution rights of the derived frames are not established, as for the earlier outfit previews.
