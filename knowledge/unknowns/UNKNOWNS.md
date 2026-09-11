# Unknown Dataset

## UK-001 — Official structured export/API

- Domain: sources/imports
- Status: `partially_supported`
- Known: the administrator-maintained wiki currently exposes public `/api/pokemon`, `/api/page/:path` and `/api/search` resources. The roster resource is suitable for identity/variant staging and currently returns 910 rows.
- Missing: a documented versioned contract, change policy, complete field coverage and structured endpoints for locations, coordinates and all game systems.
- Leads: page payloads, route manifests, public endpoint refresh profiles or administrator-provided exports.

## UK-002 — Variant identity rules

- Domain: Pokémon
- Status: `unknown`
- Need: determine whether Shiny, Mega and other forms have independent game IDs, inherited fields or separate availability/tier rules.

## UK-003 — Tier semantics and ownership

- Domain: tiers
- Status: `unknown`
- Need: exact current tier labels, whether they are official or community analysis, and how variant/tactical context affects them.

## UK-004 — Move/AoE mechanics

- Domain: moves
- Status: `unknown`
- Need: exact move identity, shape, range, cooldown, target and effect semantics.

## UK-005 — Current trade rules

- Domain: marketplace/economy
- Status: `unknown`
- Known lead: main site advertises “RMT Enabled”.
- Missing: current permitted assets, channels, prohibited conduct, dispute/moderation rules and whether a third-party listing directory is allowed.

## UK-006 — Reuse licenses

- Domain: legal/assets/data
- Status: `partially_supported_user_provided`
- Known: supplied Discord rule 6 permits use of the client and wiki information to build community wikis and tools, and encourages contributions to community knowledge.
- Need: direct Discord message metadata and clarification of redistribution rights for complete client files, logos, music, sprites, maps and other third-party assets.

## UK-007 — Canonical localization inventory

- Domain: localization
- Status: `unknown`
- Need: identify any entity names that PokeAlliance itself localizes and the context/version in which each name is used.

## UK-008 — Discord changelog authorization and identity

- Domain: sources/imports
- Status: `deferred_optional`
- Current decision: changelog ingestion is manual because bot access to the official Discord is not available.
- Future need only if automation is revisited: guild ID, changelog channel ID/type, message-history scope and administrator authorization.
- Active path: moderated manual import with message link/ID and timestamps when available.

## UK-009 — Server Save rule verification

- Domain: temporal/game operations
- Status: `supported_user_provided`
- Candidate rule: `00:00` in `America/Sao_Paulo`; currently `21:00` on the previous date in `America/Monterrey`.
- Need: direct official Discord/site evidence, effective date and notice of future changes.

## UK-010 — Pokémon location payload behind “Buscar localização”

- Domain: map/Pokédex/imports
- Status: `unknown`
- Supported boundary: the local client exposes separate Pokédex, Hunt Finder, Item Locator and Minimap surfaces, and the public wiki exposes a roster API plus a semantic teleport/destination guide. A second read-only sweep across the installed resources, client-binary strings and owner-authorized `config.otml` still yielded no inspectable Pokémon `(x, y, z)` payload; public roster records, sampled detail payloads and pinned community location datasets also lack it. The teleport guide supplies aliases and travel semantics, not coordinates.
- Need: a permitted client-visible capture/export, a public endpoint/resource discovered during an ordinary lookup, or a reviewed player contribution containing coordinates and floor.
- Do not infer: an area label, screenshot link or colored OTMM tile is not automatically a coordinate-level spawn claim.
