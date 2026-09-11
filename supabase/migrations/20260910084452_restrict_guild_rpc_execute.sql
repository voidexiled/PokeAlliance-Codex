-- Alliance Codex / Phase 5 security hardening
-- The Supabase platform may add explicit EXECUTE grants to anon when a public
-- function is created. Keep these authenticated-only RPCs least-privileged.

revoke execute on function public.create_guild(text, text, text) from public, anon;
revoke execute on function public.replace_guild_daily_export(uuid, timestamptz, text, text, jsonb, uuid) from public, anon;

grant execute on function public.create_guild(text, text, text) to authenticated;
grant execute on function public.replace_guild_daily_export(uuid, timestamptz, text, text, jsonb, uuid) to authenticated;
