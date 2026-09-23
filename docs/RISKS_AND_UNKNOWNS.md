# Risks and Unknowns

This is a living planning registry. Unknown game values themselves are stored as `null` in `content/` (D-012).

## Critical unknowns

### U-001 — Data coverage per domain

- Status: `OPEN`
- Question: Which domains still have no usable data (drops rates, spawn coordinates, NPC locations, NPC prices)?
- Risk: Pages built around empty data.
- Handling: unknown values stay `null` and render as `—`; blocks without data are omitted; the owner fills the D-011 registries by hand.

### U-002 — Canonical entity identity and variants

- Status: `UNKNOWN`
- Question: How does PokeAlliance distinguish base Pokémon, shiny, mega and other forms internally?
- Risk: Premature IDs could force migrations and broken URLs.
- Decision held: Final entity/form PostgreSQL model.

### U-003 — Rotation definition and evaluation

- Status: `UNKNOWN`
- Question: Which mechanics make a Pokémon eligible for a rotation, and which criteria are facts versus community analysis?
- Risk: Publishing subjective ranks as game facts.
- Decision held: Rotation score/formula and tier model.

### U-004 — Move AoE representation

- Status: `UNKNOWN`
- Question: Which shapes, ranges, target rules and cooldown semantics occur in current PokeAlliance?
- Risk: A conventional Pokémon move schema may not fit PokéTibia combat.

### U-005 — Utility eligibility lists

- Status: `UNKNOWN`
- Example: Current Teleport-compatible Pokémon list.
- Risk: Official mechanics descriptions may omit current species membership.

### U-006 — Trading and marketplace rules

- Status: `CHANGED 2026-09-17 / HIGH VOLATILITY`
- Question: What may be listed, advertised or exchanged, and what moderation obligations exist?
- Risk: Facilitating prohibited conduct or designing unusable listing fields.
- Current state: official `https://www.pokealliance.com/terms` (text dated 11/06/2026, checked 2026-09-16) allows RMT outside official channels and forbids RMT advertising in in-game chat, official Discord and forums; the server disclaims responsibility for external trades. Its homepage presents RMT as enabled. No specific rule for resale of Diamonds or the independent site's exact moderation obligations was established. **Update 2026-09-18:** terms version `v1789689677` (published 2026-09-17, visible date unchanged) removed the explicit RMT permission and the RMT wording in §7.2; in-game trade of items/Pokémon and account sharing remain permitted, advertising real-money sales in official channels remains prohibited, and the homepage no longer shows the "RMT Liberado" card. RMT outside official channels is now neither explicitly permitted nor prohibited. The owner chose to keep a real-money lane without a payment gateway (D-009).
- Gate: Reverify immediately before publishing listings and before any payment/contact workflow. First local compositor is documented in `TRADE_PRODUCT_PLAN.md` and does not publish or transact.

### U-007 — Content and asset rights

- Status: `PARTIALLY SUPPORTED / SCOPE UNCLEAR`
- Question: What text, images, sprites, maps and logos may be stored, transformed or redistributed?
- Risk: Copyright/trademark or source-license violations.
- Current state: owner-provided Discord rule 6 permits using client and wiki information to build community wikis/tools and encourages community knowledge contributions. Targeted 2026-09-17 inspection found that nominal sprite `.png` files in the installed client begin with `PKA1`, not a browser-readable PNG signature. The official public wiki serves ordinary PNGs for Ditto and Fire Stone, but this does not establish blanket redistribution rights for client or wiki imagery.
- Mitigation: use that permission for factual research and tool construction, while avoiding an unsupported assumption that every client asset or third-party Pokémon work may be redistributed wholesale. Link individually verified public sprites where identity matches, keep editorial fallbacks clearly distinct, seek ordinary approved Diamonds/KKs/Balls images and web-use permission before packaging client sprites, and preserve the independent-community disclaimer.

### U-008 — Existing localization

- Status: `UNKNOWN`
- Question: Which in-game terms have reliable PokeAlliance-localized equivalents?
- Risk: Invented translations prevent users matching the game UI.
- Default: Canonical terminology only; a localized name is used only where the game itself uses it.

### U-009 — Per-task difficulty timing in guild exports

- Status: `KNOWN LIMITATION / PARTIALLY MITIGATED`
- Question: At what exact point during an export interval did each member complete a daily relative to a level transition?
- Risk: A cumulative export contains totals, current level and contribution, but no task timestamps or per-task difficulty. Assigning every interval daily to the current level can overstate Primal points after a late-week level-up.
- Mitigation: compare consecutive snapshots, mark tier-crossing intervals as estimated, allow a current/previous/review policy and require a manual Normal/Wildscape/Primal allocation when the owner knows the split. Durable correction storage remains a future guild-account schema task.

### U-010 — Guild join-time precision

- Status: `PARTIALLY OBSERVED`
- Question: At what exact instant did a member join or return to the guild?
- Risk: The guild export contains the current roster but no join timestamp. A first appearance only proves that membership changed between two snapshots; presenting it as an exact join time could incorrectly shift the 24-hour daily and 48-hour contribution windows.
- Current handling: record `observed_between_snapshots`, use the first visible Server Save date as a conservative estimate, enable dailies on the next Server Save date and contribution on the second, and adjust goal pacing while access is pending. Members in the first historical snapshot are treated as pre-existing with unknown join date.
- Decision held: Exact join timestamps and retrospective penalties until direct client evidence or an explicit reviewed manual join-date override exists.

## Engineering and operational risks

| ID | Risk | Mitigation / gate |
|---|---|---|
| R-001 | Scrapers break or violate source expectations | Prefer public structured endpoints, rate limit, identify terms/robots, isolate importers |
| R-002 | Stale values look current | Recheck affected `content/` records from the changelog (daily feed job planned in the roadmap) |
| R-004 | UI literals diverge from data | Components read typed `content/` repositories; no game values hardcoded in components |
| R-005 | Static builds become too large | Measure first; partition payloads and selectively render only when needed |
| R-006 | Supabase free-tier/operational constraints | Static-first wiki, keep-alive only if permitted/needed, backups and usage monitoring |
| R-007 | RLS or secret leakage in future account work | Deny-by-default RLS, SQL tests, environment separation and server-only privileged clients |
| R-008 | Marketplace abuse/scams | Rules gate, reporting, moderation, rate limits, minimal personal data, no premature payments |
| R-009 | Translation becomes silently outdated | Translation status per content revision |
| R-010 | Old server code is mistaken for current behavior | Values from old repositories are not copied into `content/` without checking the current game |
| R-011 | Overengineering slows the knowledge base | Add infrastructure only from measured constraints and ADRs |
| R-012 | Prototype shortcuts become permanent | Phase gates, strict data contracts, CI and explicit technical debt registry |
| R-013 | Email/phone checks shown in UI but not enforced | Enable real email confirmation and SMS provider; enforce both at server/database write boundary; test incomplete and changed contacts |
| R-014 | Fake or retaliatory trade reviews | Bind one review to a confirmed transaction, disallow self-review, preserve disputes/moderation history and show sample size with ratings |
| R-015 | Review screenshots expose private data | Private storage, file validation and metadata removal, least-privilege signed access, redaction/consent before public display |

## Decisions not yet made

- Exact database schema and migrations.
- Exact Astro content model.
- Automated harvesting from third-party sites.
- Tier labels, numeric rankings and rotation recommendations.
- Production brand assets derived from PokeAlliance/Pokémon material.
- Auth providers beyond Supabase Auth.
- Marketplace transaction, contact, messaging or reputation behavior.
