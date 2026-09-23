# Supabase migrations

These are the Phase 2 and Phase 5 migrations for Alliance Codex. They define the model, guild daily-history contract and production hardening order. The current remote project is linked through `supabase/config.toml`; migrations 1–7 below have been applied there, 8 to 10 are local only.

Apply in filename order through the Supabase CLI after the project and environment contract are created in Phase 3:

1. `202609090001_phase2_extensions_enums.sql` — `pgcrypto` and shared enums.
2. `202609090002_phase2_governance_imports.sql` — the former provenance tables (dropped by `20260918220000`).
3. `202609090003_phase2_domain_model.sql` — entities, typed game data and map.
4. `202609090004_phase2_content_guild_rls.sql` — editorial content, guild snapshots and initial RLS boundary.
5. `202609100001_phase5_guild_daily_history.sql` — replaceable daily cumulative exports, revision audit, delta view, guild creation/import RPCs and authenticated read policies.
6. `20260910084452_restrict_guild_rpc_execute.sql` — removes anonymous execution from authenticated-only guild RPCs.
7. `20260910084612_optimize_guild_rls_and_event_trigger.sql` — hardens the platform event-trigger function and uses initplan-friendly RLS predicates.
8. `20260915192641_knowledge_expansion_relations.sql` — drops, spawns, progression, activities, economy and change events (not applied).
9. `20260918220000_remove_provenance.sql` — D-012: drops `replace_guild_daily_export` and recreates it as `(p_guild_id, p_exported_at, p_payload_digest, p_members)`, without `p_source_locator` or `p_source_snapshot_id`; drops the provenance columns (including `source_locator` in `guild_daily_exports` and `guild_daily_export_revisions`), tables (`claim_evidence`, `content_revision_evidence`, `claims`, `entity_source_keys`, `sync_events`, `staging_records`, `import_runs`, `evidence_records`, `source_snapshots`, `source_registry`, `unknowns`, `conflicts`) and enums (not applied). The browser client calls the new signature; while the migration is not applied, PostgREST answers `PGRST202` and the client retries once with a fixed `p_source_locator` (`guild-export`, never the file name). Remove that retry in `src/lib/supabase/guilds.ts` after applying the migration.
10. `20260923150000_guild_admin.sql` — M13, Guild administration (spec §10.13): `guild_settings` and `guild_invitations` with their RLS (members read the settings, only the owner reads the invitations), the RPCs `create_guild` (display name and a world id of `content/mundos.json`), `delete_guild`, `set_guild_settings`, `create_guild_invitation` (single-use token, 7 days, only its SHA-256 is kept), `accept_guild_invitation`, `revoke_guild_invitation`, `set_guild_member_role`, `remove_guild_member`, `guild_access_summary`, `list_guild_accounts` and `delete_guild_daily_export`; at most 25 owned guilds per account and 100 pending invitations per guild (not applied). tests/supabase/guild-rls.test.ts runs its permission cases against the local stack.

Apart from the D-012 removal in migration 9, the migrations contain no destructive reset, raw client asset seed, raw guild export, or unreviewed scrape seed. Curated seed data will be added only after the Phase 3 Supabase environment and import/review path are tested.

RLS is enabled for private guild tables in migrations 0004 and 0005. Daily imports must go through `replace_guild_daily_export`: it calculates the canonical Brazil-local observation date, replaces the current export for that date, preserves the previous digest in the revision log and rebuilds the current member totals transactionally. The browser integration uses only the public Supabase key, signs users in through Auth, lists authorized guilds and rehydrates exports/member totals through authenticated reads. The remote schema and anonymous access boundary are verified; owner-controlled account/import acceptance remains separate work.
