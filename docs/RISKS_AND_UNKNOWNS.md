# Risks and Unknowns

This is a living planning registry. Phase 1 will split entries into structured records with owners, evidence and status.

## Critical unknowns

### U-001 — Current authoritative source coverage

- Status: `UNKNOWN`
- Question: Which public PokeAlliance surfaces are official, current and complete for each domain?
- Risk: A single “official” label could hide stale or partial pages.
- Next evidence: Site ownership signals, update dates, cross-links, changelogs and game-visible corroboration.

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

- Status: `UNKNOWN / HIGH VOLATILITY`
- Question: What may be listed, advertised or exchanged, and what moderation obligations exist?
- Risk: Facilitating prohibited conduct or designing unusable listing fields.
- Gate: Must be reverified immediately before Phase 7.

### U-007 — Content and asset rights

- Status: `PARTIALLY SUPPORTED / SCOPE UNCLEAR`
- Question: What text, images, sprites, maps and logos may be stored, transformed or redistributed?
- Risk: Copyright/trademark or source-license violations.
- Current evidence: owner-provided Discord rule 6 permits using client and wiki information to build community wikis/tools and encourages community knowledge contributions.
- Mitigation: use that permission for factual research and tool construction, while avoiding an unsupported assumption that every client asset or third-party Pokémon work may be redistributed wholesale. Preserve the independent-community disclaimer.

### U-008 — Existing localization

- Status: `UNKNOWN`
- Question: Which in-game terms have reliable PokeAlliance-localized equivalents?
- Risk: Invented translations prevent users matching the game UI.
- Default: Canonical terminology only; evidence-backed localized names are optional.

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
| R-002 | Stale facts look current | Store observed/verified dates, refresh classes and stale indicators |
| R-003 | Confidence collapses into an opaque score | Preserve status, rationale, authority, freshness and evidence separately |
| R-004 | UI literals diverge from data | Components consume normalized repositories; validation detects unsourced publishable facts |
| R-005 | Static builds become too large | Measure first; partition payloads and selectively render only when needed |
| R-006 | Supabase free-tier/operational constraints | Static-first wiki, keep-alive only if permitted/needed, backups and usage monitoring |
| R-007 | RLS or secret leakage in future account work | Deny-by-default RLS, SQL tests, environment separation and server-only privileged clients |
| R-008 | Marketplace abuse/scams | Rules gate, reporting, moderation, rate limits, minimal personal data, no premature payments |
| R-009 | Translation becomes silently outdated | Translation status and source-version dependency |
| R-010 | Historical code is mistaken for current truth | Force `historical` authority and prohibit direct normalization without current evidence |
| R-011 | Overengineering slows the knowledge base | Add infrastructure only from measured constraints and ADRs |
| R-012 | Prototype shortcuts become permanent | Phase gates, strict data contracts, CI and explicit technical debt registry |

## Decisions not yet authorized by evidence

- Exact database schema and migrations.
- Exact Astro content model.
- Source-specific automated harvesting.
- Tier labels, numeric rankings and rotation recommendations.
- Production brand assets derived from PokeAlliance/Pokémon material.
- Auth providers beyond Supabase Auth.
- Marketplace transaction, contact, messaging or reputation behavior.
