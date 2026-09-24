-- Legacy content tables from phase 2 were created without row level security. The site reads
-- game data from content/ at build time and never queries them, so RLS is switched on with no
-- policies: anon and authenticated lose every access, the service role keeps it.
do $$
declare t record;
begin
  for t in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
  loop
    execute format('alter table public.%I enable row level security', t.relname);
  end loop;
end $$;
