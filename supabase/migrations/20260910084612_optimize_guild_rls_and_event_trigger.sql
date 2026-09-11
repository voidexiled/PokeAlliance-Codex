-- Alliance Codex / Phase 5 security and RLS hardening

do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end;
$$;

alter policy guilds_select_members on public.guilds
  using (
    exists (
      select 1
      from public.guild_memberships as membership
      where membership.guild_id = guilds.guild_id
        and membership.user_id = (select auth.uid())
    )
  );

alter policy guilds_update_owner on public.guilds
  using (owner_user_id = (select auth.uid()))
  with check (owner_user_id = (select auth.uid()));

alter policy guild_memberships_select_self on public.guild_memberships
  using (user_id = (select auth.uid()));

alter policy guild_daily_exports_select_members on public.guild_daily_exports
  using (
    exists (
      select 1
      from public.guild_memberships as membership
      where membership.guild_id = guild_daily_exports.guild_id
        and membership.user_id = (select auth.uid())
    )
  );

alter policy guild_daily_revisions_select_members on public.guild_daily_export_revisions
  using (
    exists (
      select 1
      from public.guild_daily_exports as exports
      join public.guild_memberships as membership on membership.guild_id = exports.guild_id
      where exports.daily_export_id = guild_daily_export_revisions.daily_export_id
        and membership.user_id = (select auth.uid())
    )
  );

alter policy guild_daily_totals_select_members on public.guild_daily_member_totals
  using (
    exists (
      select 1
      from public.guild_memberships as membership
      where membership.guild_id = guild_daily_member_totals.guild_id
        and membership.user_id = (select auth.uid())
    )
  );
