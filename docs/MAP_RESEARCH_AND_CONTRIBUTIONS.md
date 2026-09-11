# Interactive Map — Research Model and Client Reference

Status: research/data contract plus a verified OTMM-backed coordinate-preview UI; semantic map remains in progress.

## Observed client map behavior

The owner-provided client screenshots are reference material for interaction behavior, not a replacement for source data. They show a full map surface with a compact legend, toggles for gameplay layers, zoom controls, floor navigation, a coordinate readout and markers that can represent Pokémon spawn results after using the Pokédex location action. The screenshots also show that the client can move from a world overview into a closer city or dungeon view while retaining the same marker system.

The web preview currently implements the portion that has a reviewable local contract: a downsampled OTMM base per reviewed floor, floor selection, category visibility, marker selection, zoom, recentering, pointer-drag panning and coordinate readout for `Minimap.flags`. Labels that do not match the three known marker categories are shown as “Other client flag”; they are not silently promoted to Pokémon, NPC or city semantics. It deliberately does not claim to be a live OTMM tile loader, a complete canonical world map or the Pokédex spawn layer.

## What the client already provides

The supplied client contains separate modules for:

- `game_minimap`: OTMM rendering, map flags, waypoints, coordinate search, floor and zoom controls;
- `game_pokedex` and `game_pokemons`: Pokédex/location affordances and the search/lupa asset;
- `game_itemlocator`: item-location UI;
- `game_huntfinder`: hunt-location UI;
- `game_poketask` and `game_questlog`: task/quest context that may later link to map features.

This is strong evidence that a map preview can reproduce the client interaction model. The current OTMM snapshot also provides a permitted client-local visual base, but its cache completeness remains explicit. It is not proof that all Pokémon location coordinates are stored in local files. The Pokedex location result may be server-provided or session-provided, so its data path must be captured from a public endpoint, a permitted client-visible export or a manually recorded observation.

## Planned map layers

| Layer                          | First source                                                             | Confidence policy                                                            |
| ------------------------------ | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| Base map and floors            | stable OTMM snapshot                                                     | client-format evidence; cache completeness is explicit                       |
| Client markers                 | `config.otml` `Minimap.flags`                                            | direct client observation; versioned and account/config scoped               |
| Pokémon/hunt/item locations    | official wiki, public launcher/client-visible data, corroborated records | only publish after entity and coordinate provenance                          |
| NPCs, quests and travel points | client markers, official pages, verified player observations             | unknown coordinates stay unknown; textual guidance may exist without a point |
| Community contributions        | reviewed submissions                                                     | pending, approved, rejected and stale are distinct states                    |

The viewer should never imply that a missing marker means the location does not exist. It should distinguish `not_collected`, `unknown`, `not_applicable` and `verified_absent`.

## Current location-data result

The current Phase 1 inspection has separated three facts that must not be conflated:

1. The local client proves that Pokédex, Hunt Finder, Item Locator and Minimap interaction surfaces exist, but the packaged modules are protected/nonstandard and were not decoded.
2. The public wiki roster endpoint exposes Pokémon identity and gameplay-summary fields, but no coordinate or location fields. Sampled detail payloads also did not expose a structured spawn table.
3. The pinned community repository contains useful area/image-link and NPC/task leads, but its location-like records contain no `x`, `y`, `z` coordinate records or floor values.

Therefore the map layers can be implemented incrementally, but Pokémon spawn markers cannot be marked as “official coordinates” until the data path is captured with permission or a reviewed contribution supplies the coordinates.

## Pokémon location flow

The useful target interaction is:

```text
Pokédex entity → Buscar localização → location candidates → map coordinates/areas → marker details
```

A Pokémon can have multiple records, variants, hunts or areas. The normalized relation must therefore support many-to-many links and conditions such as variant, level, time, access quest, hazard, world and freshness. A name-only location such as “Hoenn” is not equivalent to a coordinate point.

## Community contribution workflow

Contributors may submit:

- NPC or map coordinates;
- hunt entrances and Pokémon spawn areas;
- quest steps, requirements and rewards;
- guides and recommended routes;
- corrections to stale or incorrect markers.

Each submission should contain the subject, proposed value, source/evidence, client/world version, capture date, contributor identity, confidence and optional screenshot or guide link. It enters `pending_review`; only a reviewer can make it `approved` and visible as canonical. A later correction creates a revision and preserves the prior claim.

The project owner can manually read and implement approved contributions initially. Automation is optional and should not be introduced until abuse, moderation, attribution and deletion rules are defined.

The current wiki exposes this protocol at `/es/mapa/aportar/` and its localized equivalent. It is intentionally a guide rather than a submission endpoint: there is no contributor account, automatic publication or moderation queue yet.

## Semantic sources are not coordinate sources

The official teleport guide is useful for the map's future semantic layer: it can seed normalized region, city, destination, unlock-condition and teleport-command aliases. It does not provide a structured coordinate payload. A destination such as `Saffron`, an area label such as `Hoenn` or a screenshot without an inspectable coordinate must therefore remain a semantic claim or contribution lead. It cannot create an `x/y/z` marker automatically.

The public-source profile keeps these inputs under `semanticOnlySources`, separate from coordinate-bearing profiles. This separation is intentional: map labels may be added after review without implying that the underlying geometry or Pokémon spawn relation has been verified.

The community wiki's [Hoenn Hunts index](https://pokealliance-wiki.vercel.app/hunts) is a stronger location lead than a plain area label: it lists 137 Pokémon/hunt entries and links each one to a map album. Those albums are visual evidence, not machine-readable coordinates. They can be staged as `map_image_lead` records and manually aligned with the OTMM surface later; they must not be published as exact points merely because an image exists.

If the owner later wants to investigate the in-game lookup path, the scope is documented in [POKEDEX_LOCATION_CAPTURE_PROTOCOL.md](POKEDEX_LOCATION_CAPTURE_PROTOCOL.md). It is intentionally limited to the ordinary `Buscar Ubicación` action, excludes credentials and unrelated traffic, and does not require or authorize client modification, request replay or gameplay automation.

## Manual capture protocol for map contributions

Until the client-visible location payload is identified, a player can submit a map observation manually. The minimum useful record is:

| Field       | Required value                                                                 |
| ----------- | ------------------------------------------------------------------------------ |
| Subject     | Pokémon/species, variant or NPC name exactly as shown in-game                  |
| Coordinate  | `x`, `y`, `z` copied from the in-game coordinate search or map UI              |
| Type        | `spawn_area`, `hunt_entrance`, `npc`, `quest_point`, `travel_point` or `other` |
| Scope       | world/server, client version if known, and access condition                    |
| Evidence    | screenshot, guide link or reproducible in-game steps                           |
| Captured at | ISO timestamp; keep the original instant and derive display time with Temporal |
| Claim state | `pending_review` until manually checked                                        |

An area-only claim such as “Hoenn” or a screenshot link can be stored as a useful lead, but it must remain an area/URL claim and cannot populate a point marker automatically. For a Pokémon with several variants or hunts, each coordinate claim is a separate record with explicit conditions rather than an overwrite.

## Map-specific unknowns

- Whether the Pokédex “Buscar localização” response is embedded in a local dataset or delivered by the game/server.
- Whether a coordinate point represents an entrance, a hunt area centroid, a whole rectangle/polygon or an internal marker.
- Whether client-local `Minimap.flags` differ by world, character progression or account state.
- Whether the OTMM cache covers the full world or only explored/preloaded tiles.
- Which client images may be reused and which layers must be rendered with original Alliance Codex assets.
