# Future Guild System — Research Contract

Status: the local guild-ranking tool and first authenticated daily-history slice are implemented; governance workflows and owner acceptance remain future scope.

The current tool accepts an owner-provided client export, calculates the active weekly cycle and produces a complete table/WhatsApp/PNG summary. It can also save explicitly selected exports to a Supabase guild after authentication; anonymous visitors remain local-only.

## Local export shape

The owner-supplied export `GuildMembers_Void_Exiled_2026-09-09_071522.json` contains 25 member rows and these fields for every row:

`level`, `dailiesCompleted`, `rank`, `status`, `contribution`, `name`, `lastLogin`.

The export also has `exportedAt` and a guild label. The file is private guild data and remains ignored in the research inbox. The repository stores no copy of it; the export format is implemented and tested in `src/lib/tools/guild-ranking.ts` with the synthetic fixture `tests/fixtures/guild-export.sample.json`.

The current export has no separate numeric member ID field. Per the owner's game rule, in-game names are unique, so the normalized in-game name will be the member identifier within a guild/world scope. The display form is still stored as an observation, and a future rename needs an explicit alias transition if historical continuity is required.

## Intended capture model

Each capture is an immutable snapshot with:

- guild identity and world, if available;
- source file or approved API locator;
- capture instant in UTC;
- Server Save reference as `00:00[America/Sao_Paulo]` plus the visitor-local rendering later;
- phase: `before_server_save` or `after_server_save`;
- member observations keyed by the normalized in-game name within the guild/world scope;
- raw source retention policy and reviewer/consent status.

The system must compare snapshots, not overwrite them. A daily cycle can produce:

```text
before save N → server save boundary → after save N
```

The comparison should expose deltas such as contribution change, completed-daily change, level change, rank/status change and last-login movement. It must distinguish “no change observed” from “member absent,” “export failed,” and “field unavailable.”

## Current local ranking implementation

The wiki route `/es/herramientas/guild/` (and its English counterpart) now supports the first calculation slice. It uses the export's `exportedAt` as the observation instant, interprets timestamps without an offset in the selected source zone (default `00:00[America/Sao_Paulo]` Server Save semantics), and derives a Monday-to-Sunday week. The day of control is therefore based on the imported snapshot, not on the browser's current date.

The weekly pace now separates three independently configurable goal families:

- total points;
- completed dailies;
- contribution money.

Each family may have a daily target, a weekly target, both or neither. A premium set mirrors the same structure. Filling both periods means both targets are checked; a weekly-only target is prorated for the current day.

Daily points are no longer a global setting. The owner-provided current rule is modeled as level `0–149` = `150` points, `150–349` (Wildscape) = `300`, and `350+` (Guild Balance) = `600`. These non-overlapping boundaries are an explicit implementation assumption for the overlapping wording in the owner instruction and remain pending direct game evidence.

The accumulated target for the imported day is derived from the active daily/weekly cells. The ranking total remains `dailies × level-based daily value + contribution`, and both exports retain contribution as a separate value. If a total-points goal and dailies goal are active without an explicit contribution goal, the remaining donation pace is calculated per member level; it is not a global value.

The first local implementation now also contains a deterministic history engine. It keeps one cumulative export per canonical local observation date, replaces repeated imports for the same date, and calculates dailies/contribution deltas against the latest prior observation in the same weekly cycle. A first export after the Monday reset is labeled `baseline`; it cannot recover days that were never exported. Lower cumulative values are surfaced as a decrease/reset anomaly and clamped to zero for daily totals instead of being treated as negative effort.

The Supabase migration extends this contract with `guild_daily_exports`, revision audit, member totals, a delta view and transactional `create_guild`/`replace_guild_daily_export` functions. The remote schema, anonymous access boundary and browser session/persistence slice are deployed and verified. The UI rehydrates daily exports and member totals for the selected guild; invitations, deletion/retention governance and owner acceptance are still pending.

## Privacy and guild governance requirements

- Guild members must be informed about collection and the purpose of the dashboard.
- The guild owner/officers decide retention, visibility and deletion rules.
- Member names should be visible only to authorized guild users; public pages use pseudonyms or aggregates.
- Do not publish personal email, account credentials, recovery keys, IPs, device identifiers or browser data.
- Member removal and name changes require an identity policy. Names are unique for joining current snapshots, but a rename must not silently merge histories; record an explicit alias transition after authorized review.
- Historical contribution data must remain auditable but deletable according to the guild's policy.
- A snapshot must carry source freshness and completeness so an incomplete export cannot be interpreted as inactivity.

## Metrics that are safe to design later

- contribution delta per cycle and rolling period;
- completed dailies delta and completion rate;
- active-member rate based on an explicitly chosen observation window;
- level progression;
- rank/status changes;
- missing or stale observation warnings;
- guild aggregate progress.

“Who contributes more or less” is an authorized guild view only after the guild defines the metric, period, weighting and minimum sample size. Contribution points alone must not be treated as a complete measure of effort.

## Open questions before implementation

- Is the export generated manually, from the client UI, or by an official endpoint?
- How should authorized rename/alias transitions be recorded when the source exposes only unique display names?
- Can the guild export be generated consistently before and after Server Save?
- Which guilds/worlds may access snapshots, and who may delete them?
- What happens when a member is offline, absent from an export or has changed name?
- Which time zone and DST behavior should the capture scheduler use? The canonical boundary remains Temporal-based `00:00[America/Sao_Paulo]`.
