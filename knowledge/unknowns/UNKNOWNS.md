# Open Questions

Game facts that are still unknown. The matching values stay `null` in `content/` until the owner decides them.

## UK-001 — Structured export from the official wiki

The administrator-maintained wiki exposes `/api/pokemon`, `/api/page/:path` and `/api/search`. `/api/pokemon` returns the 910-row roster used by `pnpm content:roster`. There is no documented, versioned export for locations, coordinates or the game systems.

## UK-002 — Variant identity rules

Whether Shiny, Mega and other forms have their own game ids, inherit fields, or follow separate availability and tier rules.

## UK-003 — Tier semantics

The exact current tier labels, whether they come from the game or from community analysis, and how variant or tactical context changes them.

## UK-004 — Move and AoE mechanics

Exact move identity, shape, range, cooldown, target and effect semantics.

## UK-005 — Trade rules

Which assets and channels are allowed, what is prohibited, dispute and moderation rules, and whether a third-party listing directory is allowed. See U-006 in `docs/RISKS_AND_UNKNOWNS.md` and D-009.

## UK-006 — Reuse rights

Discord rule 6 allows using client and wiki information to build community wikis and tools (`knowledge/rules/discord-rules.md`). Redistribution rights for complete client files, logos, music, sprites, maps and other third-party assets are not established.

## UK-007 — Localized game names

Which entity names PokeAlliance itself localizes, and in which context.

## UK-008 — Discord changelog access

Changelog entries are entered by hand because bot access to the official Discord is not available. Automation would need the guild and channel ids, message-history scope and administrator authorization.

## UK-009 — Server Save rule

The site uses `00:00` in `America/Sao_Paulo` (currently `21:00` of the previous day in `America/Monterrey`). A change announced by the game must be applied in `src/lib/time/server-save.ts`.

## UK-010 — Pokémon location payload behind “Buscar localização”

The client has separate Pokédex, Hunt Finder, Item Locator and Minimap surfaces. Read-only sweeps of the installed resources, client-binary strings and `config.otml` found no readable Pokémon `(x, y, z)` payload, and neither the public roster, sampled detail pages nor community location datasets contain one. The teleport guide gives names and travel rules, not coordinates. An area label, screenshot link or colored OTMM tile is not a coordinate-level spawn.
