# Phase 5 — Guild ranking and weekly pace

## Delivered surface

The wiki now includes a local guild-ranking tool:

- Spanish: `/es/herramientas/guild/`
- English: `/en/herramientas/guild/`
- Index: `/es/herramientas/` and `/en/herramientas/`

The tool accepts one or several JSON exports from the PokeAlliance client either as files or pasted text. It validates member names and numeric fields, rejects normalized duplicate names, keeps one in-session export per local date and replaces a repeated date before calculating deltas. Imports are staged as a visible preview: the action identifies the local weekday and explicitly adds or updates the selected date before changing the committed history. Without an account, the analysis remains local; an authenticated owner/officer can explicitly save the current export to the selected guild.

## Weekly cycle

The canonical cycle is Monday through Sunday using the PokeAlliance Server Save boundary at `00:00[America/Sao_Paulo]`. The calculation uses `exportedAt` from the imported JSON. An export without an offset is interpreted in the selected source zone, which defaults to the Brazilian Server Save zone; an ISO timestamp with an offset is converted through Temporal.

The current owner-provided guild rule assigns the daily value per member level. The implementation uses non-overlapping boundaries: level `0–149` (Normal) = `150`, `150–349` (Wildscape) = `300`, and `350+` (Primal) = `600`. This is recorded as owner-supplied game behavior pending direct client/wiki corroboration; it is not inferred from mainline Pokémon rules.

For an export on day `d` of the cycle, where Monday is day 1:

```text
expected dailies       = target dailies per day × d
expected contribution  = explicit contribution target × d, when enabled
expected total         = active total-points target accumulated to day d
member daily points    = completed dailies × value for that member's level
member total           = member daily points + contribution
derived donation pace  = (weekly total target - weekly dailies × member daily value) / 7
```

## Difficulty allocation across snapshots

The table exposes a per-member breakdown action with Normal, Wildscape and Primal counts. The automatic calculation compares the member's level in consecutive exports. An interval that stays within one tier is calculated directly; an interval that crosses a tier is numeric but explicitly marked `estimated`, because the cumulative JSON does not include the timestamp or difficulty of each individual task. The selected transition policy can estimate from the current tier, the previous tier or flag the interval for review.

The editor accepts a manual allocation for the active export date and requires its counts to equal the dailies in that interval. Manual allocations are included in the ranking totals and in the WhatsApp/Discord breakdown. They currently live in the browser session; durable account-level correction storage belongs to the next guild-persistence schema increment.

Each of the three goal families—total points, dailies and contribution—can independently have a daily target, a weekly target, both or neither. If both are filled, both constraints are checked. A weekly-only target is prorated to the current day for pace classification. The interface shows week start/end, control day, elapsed days, remaining days and the active accumulated targets. Premium goals use the same daily/weekly model in a separate goal set.

## Member lifecycle and eligibility

Consecutive snapshots now form a member activity record. The system tracks positive level changes per player and per day, detects a player who first appears after an earlier snapshot as an observed join, records disappearance as an observed departure, and treats a later appearance as a return. Replacing an export for the same Server Save date rebuilds these events and level deltas from the canonical snapshots instead of leaving stale derived rows.

For a join or return first observed on date `d`, the current owner-provided rule is applied as follows:

```text
dailies eligible from       = d + 1 Server Save date
contribution eligible from  = d + 2 Server Save dates
```

The implementation uses Temporal calendar arithmetic in `America/Sao_Paulo`. A member waiting for access is not classified below goal for an unavailable day. Dailies and total-points pacing use the number of daily-eligible days; contribution pacing uses the number of contribution-eligible days. Members already present in the first loaded snapshot are treated as pre-existing and eligible for the full cycle because the export contains no join timestamp; the interface labels that assumption instead of inventing a date.

The activity panel shows weekly levels gained, joins/returns, departures and members still waiting. Each ranking row shows that player's recorded level gain and access status. Discord daily-history output includes the same aggregate counts.

## Exports

The WhatsApp export is localized and organized for direct sharing: it includes the guild totals, source date, week/day context, daily and donation pace, accumulated goal, and each member's position, name, rank, level, last access, dailies, contribution and total points without compressing every field into one unreadable line. The PNG export mirrors those fields in the ranking table and preserves the below-goal/goal/premium bands.

The Discord export uses Markdown headings, blockquotes, emphasis, bullets and goal sections. It includes the current weekly ranking, the loaded daily history and a monthly aggregate based only on the snapshots available in the current history. Because Discord limits one message to 2,000 characters, a long ranking is copied as ordered blocks separated by a divider; the blocks must be pasted in order. A monthly member ranking is not fabricated from a partial history and will require enough daily snapshots from the same month.

The former global `points per daily` and editable `donation per day` controls were removed. The default configuration keeps a standard total target of `2,950` points per week, one daily per day and a premium total target of `5,900` points per week. The form now exposes normal and premium goal matrices with daily/weekly cells, plus configurable points for the three difficulty tiers. When total points and dailies are active without an explicit contribution target, the tool shows the calculated contribution pace separately for each level band because a single `71,43` value would be incorrect across mixed levels.

## Scope boundary

The deterministic daily-history contract is now implemented in `src/lib/tools/guild-daily-history.ts` and the ordered Supabase migration `202609100001_phase5_guild_daily_history.sql`. It keeps one cumulative export per canonical local date, replaces a duplicate date, preserves the replaced digest in an audit table and calculates daily deltas from the previous observation in the same week.

The browser now exposes the first authenticated persistence slice: sign-in/sign-up, guild creation/selection, protected daily import and rehydration of saved exports/member totals. The remote RLS/RPC schema is deployed and its anonymous boundary has been verified. Guild invitations, officer management, deletion/retention workflows and owner acceptance remain future work. The future guild system contract remains documented in [GUILD_SYSTEM_RESEARCH.md](GUILD_SYSTEM_RESEARCH.md); the single supplied export is evidence for the import shape, not a production history dataset.

The local history view now reports the number of loaded records, covered weeks and months, date range, observed days and incomplete periods. The first export of a week is presented as a cumulative baseline; later exports use the stored cumulative values to calculate deltas. The overview does not fill missing dates or claim a complete week/month when the corresponding exports have not been loaded.

Lifecycle and level statistics are derived from the already persisted daily member totals. No parallel membership table or remote migration was added: rehydrating the saved snapshots deterministically reconstructs the same joins, departures, eligibility windows and level deltas. Exact join time remains unavailable until the client export includes it or an explicit reviewed manual override is introduced.

## Verification

- Unit tests cover Monday-to-Sunday derivation, elapsed-day pacing, contribution-preserving WhatsApp output, duplicate names and invalid numeric fields.
- Daily-history tests cover same-day replacement, cumulative-to-daily delta calculation, gaps, weekly reset baselines and coverage summaries without inventing missing dates.
- Difficulty tests cover Normal/Wildscape/Primal boundaries, estimated tier transitions and manual interval allocations. The browser smoke flow also opens the breakdown editor and saves a valid correction.
- Lifecycle tests cover the Monday opening baseline, level gains, join/departure/return detection, the 24/48-hour Server Save windows, eligibility-aware goal bands and same-date replacement recalculation.
- The Playwright smoke flow loads an anonymized fixture through the file input, checks the localized route, table contribution column, sample contribution and day-of-cycle summary, then verifies the new-date confirmation label and same-day replacement label.
- A dedicated Playwright flow loads Monday and Tuesday snapshots, verifies an observed join, the Wednesday daily date, the Thursday contribution date, weekly level gain and the adjusted-goal label in the member row.
