# Supabase migrations

These are the Phase 2 and Phase 5 migrations for Alliance Codex. They define the model, guild daily-history contract and production hardening order. The current remote project is linked through `supabase/config.toml` and all migrations below have been applied there.

Apply in filename order through the Supabase CLI after the project and environment contract are created in Phase 3:

1. `202609090001_phase2_extensions_enums.sql` — `pgcrypto` and shared enums.
2. `202609090002_phase2_governance_imports.sql` — sources, evidence, snapshots, imports and staging.
3. `202609090003_phase2_domain_model.sql` — entities, typed game data, claims and map.
4. `202609090004_phase2_content_guild_rls.sql` — editorial content, guild snapshots and initial RLS boundary.
5. `202609100001_phase5_guild_daily_history.sql` — replaceable daily cumulative exports, revision audit, delta view, guild creation/import RPCs and authenticated read policies.
6. `20260910084452_restrict_guild_rpc_execute.sql` — removes anonymous execution from authenticated-only guild RPCs.
7. `20260910084612_optimize_guild_rls_and_event_trigger.sql` — hardens the platform event-trigger function and uses initplan-friendly RLS predicates.

The migrations intentionally contain no destructive reset, raw client asset seed, raw guild export, or unreviewed scrape seed. Curated seed data will be added only after the Phase 3 Supabase environment and import/review path are tested.

RLS is enabled for private guild tables in migrations 0004 and 0005. Daily imports must go through `replace_guild_daily_export`: it calculates the canonical Brazil-local observation date, replaces the current export for that date, preserves the previous digest in the revision log and rebuilds the current member totals transactionally. The browser integration uses only the public Supabase key, signs users in through Auth, lists authorized guilds and rehydrates exports/member totals through authenticated reads. The remote schema and anonymous access boundary are verified; owner-controlled account/import acceptance remains separate work.
