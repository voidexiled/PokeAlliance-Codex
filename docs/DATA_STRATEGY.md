# Data Strategy

Status: rewritten on 2026-09-18 for D-011 (owner-editable registries) and D-012 (no provenance). The relational model is in [DATA_MODEL.md](DATA_MODEL.md).

## Where game data lives

Game data is JSON under `content/`, edited by hand by the owner or updated by small importers. The site reads it at build time through typed readers in `src/lib/content/` and `src/lib/map/`. There is no raw, staging or normalized layer in between.

```text
content/*.json  →  src/lib/content, src/lib/map  →  prerendered pages
```

Current files:

| File | Contents |
| --- | --- |
| `content/pokemon.json` | 910 Pokémon variants: `id`, `nombre`, `numero`, `generacion`, `variante`, `nivel`, `tier`, `funcion`, `elementos`, `imagen` |
| `content/moves.json` | Moves: element, slot, cooldown in seconds, mode and the Pokémon that learn them |
| `content/system-items.json` | Items tied to a game system |
| `content/quests.json` | Quests: required level, steps, rewards, NPCs, places |
| `content/locations.json` | Places and travel connections |
| `content/rotations.json` | Availability of Pokémon categories by area |
| `content/map/markers.json` | Minimap markers (`x`, `y`, `z`, icon, description) |
| `content/map/floors.json` | Map base floors: image, size and coordinate bounds |
| `content/items/categorias.json` | The 14 Market categories in client order; `todo` is virtual |
| `content/items/<categoria>.json` | Items of one Market category: `id`, `nombre`, `clientId`, `categoria`, `sprite`, `apilable`, `precioNpc` |
| `content/outfits.json` | Outfit id of each Pokémon and its addons (addons are outfits) |
| `content/auras.json` | Auras of the outfit preview and the client shader each one uses |
| `public/sprites/sprites.json` | Sprite registry: image, frame size, frame count and mode per key |

Every file in the table carries `"$schema"` pointing at `content/schemas/*.schema.json` (JSON Schema 2020-12, no unknown fields) so VS Code autocompletes it. `pnpm content:check` validates all of them: schemas, unique ids, the 14 Market categories and their order, category, sprite and Pokémon references, image files and PNG sizes (sprites and map floors); it prints record and draft counts per file. The build parses every file again with the Zod mirrors, so a malformed file stops it. The owner's guide is [REGISTROS.md](REGISTROS.md).

## Record rules

- Keys are in Spanish. Canonical game names stay in English, exactly as the game shows them.
- `id` is a stable lowercase kebab-case slug. It does not depend on locale and does not change after publication; a corrected name becomes an alias.
- Unknown values are `null`; the UI shows `—`. Never store `0`, an empty string or a guess for an unknown value. An empty array means "none" only when that is known.
- Placeholder records carry `"borrador": true`. They are shown by default; a build flag can hide them in production.
- No provenance (D-012): no source, evidence, claim, status, confidence, retrieval/verification timestamps or source hashes in any record.
- Game data and Alliance Codex analysis stay apart: recommendations and tactical opinions go into editorial content, not into game fields.

## Identity

Entities use stable slugs. Names are attributes, never keys. Variants and forms are explicit records (`normal`, `shiny`, later `mega` and others); they are not flattened into display strings. Two entities of different types may share a name; the non-Pokémon one then gets a type qualifier in its slug (`kecleon-shop`).

## Localization architecture

The system separates `contentLocale` from `gameTerminologyMode`. Initial locales are `es` and `en`; canonical terminology is the only initial terminology mode. Configuration owns `defaultLocale`, `supportedLocales` and `fallbackLocale`.

One entity is shared by all locales. Editorial resources use translations keyed by locale and can track `original`, `translated`, `reviewed`, `needs_review` or `outdated`. Fallback returns existing authored content and can disclose the mismatch; it never synthesizes a translation silently. A localized game name is used only when the game itself uses it.

Entity slugs remain canonical across `/es/` and `/en/`. HTML language, localized metadata, canonical links, hreflang, Open Graph and sitemap alternates are generated centrally.

## Structured editorial references

Editorial content references game entities by stable id when it adds navigational or correctness value, for example `item:oran-berry`. Plain text remains acceptable where structure adds no value. Broken references fail validation once the authoring format is selected.

## Imports

Importers are small Node scripts that write to `content/` directly. They are idempotent, never remove records and keep values edited by hand unless the owner asks to overwrite them. `scripts/content/import-roster.mjs` (`pnpm content:roster`) follows this rule for the Pokémon roster; `--overwrite` replaces imported fields and `--dry-run` only prints the counts.

## Fixtures

Synthetic test fixtures live under `tests/fixtures/`, are visibly labeled and use invented values. They never enter `content/`.

## Validation

- `pnpm check`, `pnpm lint` and `pnpm test` (the content readers have unit tests).
- `pnpm build` prerenders every page from `content/`.
- `pnpm content:check` validates every file in `content/` and the sprite registry against its JSON Schema, plus unique ids and cross-file references. It is the first step of `pnpm ci`.
