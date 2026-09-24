-- Alliance Codex / M14 — Accounts and trust (spec §9.15, §9.16).
--
-- Local only: it is never applied to the remote project from the repository
-- (OG-1); the owner applies it.
--
-- What it adds:
--   * the parameters of §9.15.8 in one table, app_parameters, which the owner
--     changes by SQL together with src/lib/trade/limits.ts (D-B6);
--   * the account of §9.15.1: the three registration steps, the profile
--     (username, player name and world, country, birth date, accepted terms)
--     and the completeness and age rules;
--   * the normalized e-mail, unique among all accounts (suspended ones
--     included), and the disposable domains of blocked_email_domains. The Auth
--     hook before_user_created refuses both with a readable error; a trigger on
--     auth.users is the guarantee (admin-created users, confirmations and
--     e-mail changes included);
--   * the Comercio gate of §9.15.2 that replaces trade_is_verified (complete
--     account, age, Discord age, suspension and the real-money consent), and
--     the technical evidence of §9.15.3;
--   * the Comercio suspension of §9.15.5 and the deletion of an account;
--   * the online status of §9.15.6 and §9.16.2.
--
-- Security model: every table is deny-by-default. RLS is on everywhere, anon
-- has no table privilege and authenticated only reads its own rows (the
-- evidence, only moderators). Every write is a security definer function with
-- search_path = '' that checks the caller and validates its input, and fails
-- with 42501 (permission) or 22023 (value) and a fixed message the interface
-- translates. The helpers that only other functions call are not executable
-- by the API roles.
--
-- Contract for the trade migration (its security definer functions call these):
--   * trade_authorize(action, real_money, device_id) at the start of every
--     Comercio action: the gate, the evidence and the username lock;
--   * trade_is_eligible(user_id) / trade_eligibility(user_id), in place of
--     trade_is_verified;
--   * trade_suspend_account(user_id, until) and trade_lift_suspension(user_id);
--   * trade_hold_evidence(case_kind, case_id, user_ids) when a report or an
--     alert opens, trade_release_evidence(case_kind, case_id) when it closes;
--   * account_profiles.username is the public handle; app_parameters holds
--     RESENAS_PAR_DIA.

-- 1. Parameters (§9.15.8). One row each; a change goes here and in
--    src/lib/trade/limits.ts together.
create table public.app_parameters (
  name text primary key check (name ~ '^[A-Z][A-Z0-9_]*$'),
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.app_parameters (name, value) values
  ('EDAD_MINIMA_CUENTA', '13'),
  ('EDAD_MINIMA_COMERCIO', '18'),
  ('DISCORD_EDAD_MIN_DIAS', '60'),
  -- Auth enforces it (minimum_password_length in supabase/config.toml and in
  -- the dashboard); it is listed so the module has every parameter.
  ('CONTRASENA_MIN', '10'),
  ('TELEFONO_OBLIGATORIO', 'false'),
  -- The trade functions read it (reviewable deals per pair and day, §9.15.4).
  ('RESENAS_PAR_DIA', '3'),
  ('EVIDENCIA_DIAS', '90'),
  ('PRESENCIA_SIN_SENAL_MIN', '10'),
  ('PRESENCIA_INACTIVO_HORAS', '6'),
  -- The versions of the texts an account accepts (TERMINOS_VERSION and
  -- CONSENTIMIENTO_DINERO_REAL_VERSION of limits.ts): a new one asks again.
  ('TERMINOS_VERSION', '"2026-09-23"'),
  ('CONSENTIMIENTO_DINERO_REAL_VERSION', '"2026-09-23"');

create function public.app_parameter(p_name text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  parameter_value jsonb;
begin
  select parameter.value into parameter_value
  from public.app_parameters as parameter
  where parameter.name = p_name;

  if parameter_value is null then
    raise exception 'Missing parameter %', p_name using errcode = 'P0002';
  end if;
  return parameter_value;
end;
$$;

create function public.app_parameter_int(p_name text)
returns integer
language sql
stable
set search_path = ''
as $$
  select (public.app_parameter(p_name) #>> '{}')::integer;
$$;

create function public.app_parameter_bool(p_name text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select (public.app_parameter(p_name) #>> '{}')::boolean;
$$;

create function public.app_parameter_text(p_name text)
returns text
language sql
stable
set search_path = ''
as $$
  select public.app_parameter(p_name) #>> '{}';
$$;

-- 2. Pure helpers.

-- §9.15.1: lower case, without the +tag, and for gmail.com and googlemail.com
-- (one mailbox) also without dots, under gmail.com. Null when it is no e-mail.
create function public.account_normalize_email(p_email text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  email_value text := lower(btrim(coalesce(p_email, '')));
  at_position integer;
  local_part text;
  domain_part text;
begin
  if position('@' in email_value) = 0 then
    return null;
  end if;

  -- The last @ separates the domain.
  at_position := char_length(email_value) - position('@' in reverse(email_value)) + 1;
  local_part := left(email_value, at_position - 1);
  domain_part := rtrim(substr(email_value, at_position + 1), '.');
  if local_part = '' or domain_part = '' then
    return null;
  end if;

  if position('+' in local_part) > 1 then
    local_part := split_part(local_part, '+', 1);
  end if;

  if domain_part in ('gmail.com', 'googlemail.com') then
    local_part := replace(local_part, '.', '');
    domain_part := 'gmail.com';
    if local_part = '' then
      return null;
    end if;
  end if;

  return local_part || '@' || domain_part;
end;
$$;

-- Whole years between a birth date and a day.
create function public.account_age_years(p_birth_date date, p_on date)
returns integer
language sql
immutable
set search_path = ''
as $$
  select extract(year from age(p_on::timestamp, p_birth_date::timestamp))::integer;
$$;

-- When a Discord account was created, from its id (a snowflake): (id >> 22) +
-- 1420070400000 ms (§9.15.2). Null when the id is not one.
create function public.account_discord_created_at(p_discord_id text)
returns timestamptz
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_discord_id is null or p_discord_id !~ '^[0-9]{1,19}$' then
    return null;
  end if;
  return to_timestamp(((p_discord_id::bigint >> 22) + 1420070400000) / 1000.0);
exception
  when numeric_value_out_of_range then
    return null;
end;
$$;

-- The IP of the request (§9.15.3): the first address of x-forwarded-for in the
-- headers PostgREST exposes. Null outside a request or when it is no address.
create function public.account_request_ip()
returns inet
language plpgsql
stable
set search_path = ''
as $$
declare
  headers text := current_setting('request.headers', true);
  forwarded text;
begin
  if headers is null or headers = '' then
    return null;
  end if;
  forwarded := btrim(split_part(headers::jsonb ->> 'x-forwarded-for', ',', 1));
  if forwarded is null or forwarded = '' then
    return null;
  end if;
  return forwarded::inet;
exception
  when others then
    return null;
end;
$$;

-- 3. Disposable e-mail domains (§9.15.1). A short hand-written seed; the owner
--    loads a longer list with public.load_blocked_email_domains (see
--    docs/LANZAMIENTO.md).
create table public.blocked_email_domains (
  domain text primary key
    check (
      char_length(domain) <= 253
      and domain ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'
    ),
  created_at timestamptz not null default now()
);

insert into public.blocked_email_domains (domain) values
  ('10minutemail.com'),
  ('discard.email'),
  ('dispostable.com'),
  ('emailondeck.com'),
  ('fakeinbox.com'),
  ('getnada.com'),
  ('guerrillamail.com'),
  ('maildrop.cc'),
  ('mailinator.com'),
  ('mailnesia.com'),
  ('mintemail.com'),
  ('sharklasers.com'),
  ('spamgourmet.com'),
  ('temp-mail.org'),
  ('tempr.email'),
  ('throwawaymail.com'),
  ('trashmail.com'),
  ('yopmail.com');

-- Loads a list pasted as text: one domain per line (or separated by spaces,
-- commas or semicolons); text after # is a comment and anything that is not a
-- domain is skipped. Returns how many domains were new. Only the owner runs it
-- (SQL editor); the API roles cannot.
create function public.load_blocked_email_domains(p_domains text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted integer;
begin
  insert into public.blocked_email_domains (domain)
  select distinct candidate
  from (
    select lower(rtrim(btrim(entry), '.')) as candidate
    from regexp_split_to_table(coalesce(p_domains, ''), '\r?\n') as line,
      regexp_split_to_table(regexp_replace(line, '#.*$', ''), '[\s,;]+') as entry
  ) as entries
  where char_length(candidate) <= 253
    and candidate ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'
  on conflict (domain) do nothing;

  get diagnostics inserted = row_count;
  return inserted;
end;
$$;

-- A domain is blocked when it or one of its parent domains is listed.
create function public.account_email_domain_blocked(p_email text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  domain_part text := lower(rtrim(substring(btrim(coalesce(p_email, '')) from '@([^@]+)$'), '.'));
  labels text[];
  candidates text[] := array[]::text[];
begin
  if domain_part is null or domain_part = '' then
    return false;
  end if;

  labels := string_to_array(domain_part, '.');
  for position_index in 1 .. coalesce(array_length(labels, 1), 0) - 1 loop
    candidates := candidates || array_to_string(labels[position_index:], '.');
  end loop;

  return exists (
    select 1 from public.blocked_email_domains as blocked where blocked.domain = any (candidates)
  );
end;
$$;

-- 4. The normalized e-mail of each account with a confirmed e-mail, unique. An
--    unconfirmed sign-up reserves nothing: only the owner of a mailbox confirms
--    any of its forms, so nobody can hold someone else's address. The row lives
--    as long as the Auth user, so a suspended account keeps its address, also
--    after it deletes itself (§9.15.5).
create table public.account_email_keys (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email_key text not null unique check (char_length(email_key) between 3 and 320),
  updated_at timestamptz not null default now()
);

insert into public.account_email_keys (user_id, email_key)
select account.id, public.account_normalize_email(account.email)
from auth.users as account
where account.email_confirmed_at is not null
  and public.account_normalize_email(account.email) is not null
order by account.created_at
on conflict do nothing;

-- 5. The account profile (§9.15.1). The row exists from step 3 on, or when a
--    moderator suspends an account without one.
create table public.account_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- «Nombre de usuario»: the public handle (§9.9).
  username text check (username ~ '^[a-z0-9_-]{3,24}$'),
  -- «Nombre del jugador» and «Mundo» (an id of content/mundos.json).
  player_name text
    check (
      char_length(player_name) between 1 and 32
      and player_name = btrim(player_name)
      and player_name !~ '[[:cntrl:]]'
    ),
  world_key text check (char_length(world_key) <= 32 and world_key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  -- ISO 3166-1 alpha-2.
  country_code text check (country_code ~ '^[A-Z]{2}$'),
  -- Never shown and never readable through the API; it cannot change once saved.
  birth_date date check (birth_date >= date '1900-01-01'),
  terms_version text check (char_length(terms_version) between 1 and 32),
  terms_accepted_at timestamptz,
  -- Set by the first listing: the username no longer changes (§9.16.3).
  username_locked_at timestamptz,
  -- Comercio suspension (§9.15.5): active while in the future; 'infinity' is
  -- the indefinite one (the ban).
  trade_suspended_until timestamptz,
  -- Set when a suspended account deletes itself: the row keeps only the player
  -- name and world (§9.15.5).
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_profiles_player_world_pair check ((player_name is null) = (world_key is null)),
  constraint account_profiles_terms_pair check ((terms_version is null) = (terms_accepted_at is null))
);

-- Both unique without regard to case (§9.15.1).
create unique index account_profiles_username_key
  on public.account_profiles (lower(username))
  where username is not null;

create unique index account_profiles_player_world_key
  on public.account_profiles (lower(player_name), world_key)
  where player_name is not null;

create function public.account_is_trade_suspended(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.account_profiles as profile
    where profile.user_id = p_user_id
      and profile.trade_suspended_until > now()
  );
$$;

-- The rules no write may break, whichever function makes it: the birth date
-- and a locked username do not change, and a suspended account keeps its
-- username, player name and world (so it cannot free them). Deleting a
-- suspended account (deleted_at) is the one exception.
create function public.account_profiles_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.deleted_at is null then
    if old.birth_date is not null and new.birth_date is distinct from old.birth_date then
      raise exception 'birth_date_locked' using errcode = '22023';
    end if;

    if old.username_locked_at is not null and new.username is distinct from old.username then
      raise exception 'username_locked' using errcode = '22023';
    end if;

    if old.trade_suspended_until > now()
       and (
         new.username is distinct from old.username
         or new.player_name is distinct from old.player_name
         or new.world_key is distinct from old.world_key
       ) then
      raise exception 'suspended' using errcode = '42501';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger account_profiles_guard
before update on public.account_profiles
for each row execute function public.account_profiles_guard();

-- 6. Auth: the e-mail rules on every write of auth.users, and the identities
--    of a suspended account.
create function public.account_users_sync()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  email_changed boolean := tg_op = 'INSERT' or new.email is distinct from old.email;
  normalized_key text;
begin
  if tg_op = 'UPDATE' and email_changed and public.account_is_trade_suspended(new.id) then
    raise exception 'suspended' using errcode = '42501';
  end if;

  if email_changed and new.email is not null and public.account_email_domain_blocked(new.email) then
    raise exception 'email_domain_blocked' using errcode = '23514';
  end if;

  if email_changed or new.email_confirmed_at is distinct from old.email_confirmed_at then
    if new.email_confirmed_at is not null then
      normalized_key := public.account_normalize_email(new.email);
    end if;

    if normalized_key is null then
      delete from public.account_email_keys as taken where taken.user_id = new.id;
    else
      begin
        insert into public.account_email_keys as taken (user_id, email_key)
        values (new.id, normalized_key)
        on conflict (user_id) do update
          set email_key = excluded.email_key, updated_at = now()
          where taken.email_key is distinct from excluded.email_key;
      exception
        when unique_violation then
          raise exception 'email_taken' using errcode = '23505';
      end;
    end if;
  end if;

  return null;
end;
$$;

create trigger account_users_sync
after insert or update of email, email_confirmed_at on auth.users
for each row execute function public.account_users_sync();

-- Unlinking an identity of a suspended account would free it; deleting the
-- whole user (the owner, with the service role) still cascades, because the
-- user row is already gone when its identities are deleted.
create function public.account_identities_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from auth.users as account where account.id = old.user_id)
     and public.account_is_trade_suspended(old.user_id) then
    raise exception 'suspended' using errcode = '42501';
  end if;
  return old;
end;
$$;

create trigger account_identities_guard
before delete on auth.identities
for each row execute function public.account_identities_guard();

-- 7. The Auth hook before_user_created (§9.15.1), registered in
--    supabase/config.toml ([auth.hook.before_user_created]) and, on the remote
--    project, in the dashboard. It answers {} to allow and an error object to
--    refuse; the interface reads the message.
create function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  email_value text := nullif(btrim(event -> 'user' ->> 'email'), '');
  normalized_key text;
begin
  if email_value is null then
    return jsonb_build_object(
      'error', jsonb_build_object('http_code', 400, 'message', 'email_required')
    );
  end if;

  if public.account_email_domain_blocked(email_value) then
    return jsonb_build_object(
      'error', jsonb_build_object('http_code', 403, 'message', 'email_domain_blocked')
    );
  end if;

  normalized_key := public.account_normalize_email(email_value);
  if normalized_key is null then
    return jsonb_build_object(
      'error', jsonb_build_object('http_code', 400, 'message', 'email_invalid')
    );
  end if;

  if exists (select 1 from public.account_email_keys as taken where taken.email_key = normalized_key) then
    return jsonb_build_object(
      'error', jsonb_build_object('http_code', 409, 'message', 'email_taken')
    );
  end if;

  return '{}'::jsonb;
end;
$$;

-- 8. Registration steps and completeness (§9.15.1). Step 1: e-mail confirmed;
--    step 2: Discord or Google linked (and the phone, only with
--    TELEFONO_OBLIGATORIO); step 3: the whole profile with the current terms
--    and at least EDAD_MINIMA_CUENTA years.
create function public.account_registration_steps(p_user_id uuid)
returns table (email boolean, identity boolean, phone boolean, profile boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    account.email_confirmed_at is not null,
    exists (
      select 1
      from auth.identities as linked
      where linked.user_id = account.id
        and linked.provider in ('discord', 'google')
    ),
    not public.app_parameter_bool('TELEFONO_OBLIGATORIO') or account.phone_confirmed_at is not null,
    coalesce(
      profile.deleted_at is null
        and profile.username is not null
        and profile.player_name is not null
        and profile.country_code is not null
        and profile.birth_date is not null
        and profile.terms_version = public.app_parameter_text('TERMINOS_VERSION')
        and public.account_age_years(profile.birth_date, current_date)
          >= public.app_parameter_int('EDAD_MINIMA_CUENTA'),
      false
    )
  from auth.users as account
  left join public.account_profiles as profile on profile.user_id = account.id
  where account.id = p_user_id;
$$;

create function public.account_is_complete(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select steps.email and steps.identity and steps.phone and steps.profile
      from public.account_registration_steps(p_user_id) as steps
    ),
    false
  );
$$;

-- Whether the caller is a moderator. trade_moderators belongs to the trade
-- migration, so it is looked up by name: without that table nobody is one.
create function public.account_is_moderator()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  result boolean := false;
begin
  if caller is null or to_regclass('public.trade_moderators') is null then
    return false;
  end if;
  execute 'select exists (select 1 from public.trade_moderators where user_id = $1)'
    into result
    using caller;
  return coalesce(result, false);
end;
$$;

-- 9. Real-money consent (§9.15.2): one row per accepted version.
create table public.trade_consents (
  user_id uuid not null references auth.users (id) on delete cascade,
  version text not null check (char_length(version) between 1 and 32),
  accepted_at timestamptz not null default now(),
  primary key (user_id, version)
);

create function public.trade_has_current_consent(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.trade_consents as consent
    where consent.user_id = p_user_id
      and consent.version = public.app_parameter_text('CONSENTIMIENTO_DINERO_REAL_VERSION')
  );
$$;

-- 10. Comercio eligibility (§9.15.2), in place of trade_is_verified. Null when
--     the account may act; otherwise the first requirement it misses.
create function public.trade_eligibility(p_user_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  profile public.account_profiles;
begin
  if p_user_id is null or not public.account_is_complete(p_user_id) then
    return 'account_incomplete';
  end if;

  select * into profile from public.account_profiles as row_profile where row_profile.user_id = p_user_id;

  if profile.trade_suspended_until > now() then
    return 'suspended';
  end if;

  if public.account_age_years(profile.birth_date, current_date)
     < public.app_parameter_int('EDAD_MINIMA_COMERCIO') then
    return 'underage';
  end if;

  if not exists (
    select 1 from auth.identities as linked
    where linked.user_id = p_user_id and linked.provider = 'discord'
  ) then
    return 'discord_missing';
  end if;

  if not exists (
    select 1
    from auth.identities as linked
    where linked.user_id = p_user_id
      and linked.provider = 'discord'
      and public.account_discord_created_at(linked.provider_id)
        <= now() - make_interval(days => public.app_parameter_int('DISCORD_EDAD_MIN_DIAS'))
  ) then
    return 'discord_too_new';
  end if;

  return null;
end;
$$;

create function public.trade_is_eligible(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.trade_eligibility(p_user_id) is null;
$$;

-- 11. Technical evidence (§9.15.3): the IP and the browser id of the Comercio
--     actions of an account that accepted the current consent. Only moderators
--     read it. It has no foreign key on purpose: the record outlives a deleted
--     account until the purge, EVIDENCIA_DIAS after it was written, unless an
--     open report or alert holds its account.
create table public.trade_action_evidence (
  evidence_id bigint generated always as identity primary key,
  user_id uuid not null,
  action text not null
    check (action in ('publicar', 'contactar', 'confirmar', 'cancelar', 'disputar', 'resenar', 'reportar')),
  ip inet,
  device_id uuid,
  created_at timestamptz not null default now()
);

create index trade_action_evidence_user_idx on public.trade_action_evidence (user_id, created_at desc);
create index trade_action_evidence_device_idx
  on public.trade_action_evidence (device_id, created_at desc)
  where device_id is not null;
create index trade_action_evidence_created_idx on public.trade_action_evidence (created_at);

-- The accounts an open report or alert involves: their evidence is not purged.
create table public.trade_evidence_holds (
  case_kind text not null check (case_kind in ('report', 'flag')),
  case_id text not null check (char_length(case_id) between 1 and 64),
  user_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (case_kind, case_id, user_id)
);

create index trade_evidence_holds_user_idx on public.trade_evidence_holds (user_id);

create function public.trade_hold_evidence(p_case_kind text, p_case_id text, p_user_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.trade_evidence_holds (case_kind, case_id, user_id)
  select p_case_kind, p_case_id, involved.user_id
  from unnest(coalesce(p_user_ids, array[]::uuid[])) as involved (user_id)
  where involved.user_id is not null
  on conflict do nothing;
end;
$$;

create function public.trade_release_evidence(p_case_kind text, p_case_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.trade_evidence_holds as held
  where held.case_kind = p_case_kind
    and held.case_id = p_case_id;
end;
$$;

-- The lazy purge (§9.15.3): it runs whenever evidence is written.
create function public.trade_purge_evidence()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed integer;
begin
  delete from public.trade_action_evidence as evidence
  where evidence.created_at
      < now() - make_interval(days => public.app_parameter_int('EVIDENCIA_DIAS'))
    and not exists (
      select 1 from public.trade_evidence_holds as held where held.user_id = evidence.user_id
    );

  get diagnostics removed = row_count;
  return removed;
end;
$$;

-- 12. The gate every Comercio action of the trade migration calls first
--     (§9.15.2, §9.15.3). p_action: publicar, editar, renovar, contactar,
--     confirmar, cancelar, disputar, resenar or reportar; p_real_money: the
--     action touches a listing priced in real money; p_device_id: the browser
--     id the client sends. It returns the caller and, after the current
--     consent, records the evidence of the actions §9.15.3 lists. Publishing
--     locks the username (§9.16.3); the caller's transaction undoes both if the
--     action fails.
create function public.trade_authorize(
  p_action text,
  p_real_money boolean default false,
  p_device_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  reason text;
begin
  if caller is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if p_action is null
     or p_action not in (
       'publicar', 'editar', 'renovar', 'contactar', 'confirmar', 'cancelar', 'disputar', 'resenar', 'reportar'
     ) then
    raise exception 'action_invalid' using errcode = '22023';
  end if;

  reason := public.trade_eligibility(caller);
  if reason is not null then
    raise exception '%', reason using errcode = '42501';
  end if;

  if coalesce(p_real_money, false) and not public.trade_has_current_consent(caller) then
    raise exception 'consent_required' using errcode = '42501';
  end if;

  if p_action in ('publicar', 'contactar', 'confirmar', 'cancelar', 'disputar', 'resenar', 'reportar')
     and public.trade_has_current_consent(caller) then
    perform public.trade_purge_evidence();
    insert into public.trade_action_evidence (user_id, action, ip, device_id)
    values (caller, p_action, public.account_request_ip(), p_device_id);
  end if;

  if p_action = 'publicar' then
    update public.account_profiles as profile
    set username_locked_at = now()
    where profile.user_id = caller
      and profile.username_locked_at is null;
  end if;

  return caller;
end;
$$;

-- What the interface asks before offering an action: true, or 42501 with the
-- missing requirement (the same messages as trade_authorize).
create function public.trade_check_eligibility(p_real_money boolean default false)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  reason text;
begin
  if caller is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  reason := public.trade_eligibility(caller);
  if reason is not null then
    raise exception '%', reason using errcode = '42501';
  end if;

  if coalesce(p_real_money, false) and not public.trade_has_current_consent(caller) then
    raise exception 'consent_required' using errcode = '42501';
  end if;

  return true;
end;
$$;

-- «Entiendo y acepto» (§9.15.2): a complete adult account accepts the current
-- version; accepting it again changes nothing.
create function public.trade_accept_consent(p_version text)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  accepted timestamptz;
begin
  if caller is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if not public.account_is_complete(caller) then
    raise exception 'account_incomplete' using errcode = '42501';
  end if;

  if (
    select public.account_age_years(profile.birth_date, current_date)
    from public.account_profiles as profile
    where profile.user_id = caller
  ) < public.app_parameter_int('EDAD_MINIMA_COMERCIO') then
    raise exception 'underage' using errcode = '42501';
  end if;

  if p_version is distinct from public.app_parameter_text('CONSENTIMIENTO_DINERO_REAL_VERSION') then
    raise exception 'consent_version_invalid' using errcode = '22023';
  end if;

  insert into public.trade_consents (user_id, version)
  values (caller, p_version)
  on conflict (user_id, version) do nothing;

  select consent.accepted_at into accepted
  from public.trade_consents as consent
  where consent.user_id = caller
    and consent.version = p_version;

  return accepted;
end;
$$;

-- 13. Online status (§9.15.6, §9.16.2).
create type public.trade_presence_state as enum ('en_juego', 'ausente', 'desconectado');

create table public.trade_presence (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- The state the account chose.
  estado public.trade_presence_state not null default 'desconectado',
  -- The last heartbeat, and the last one that reported keyboard or pointer input.
  last_seen_at timestamptz,
  last_input_at timestamptz,
  updated_at timestamptz not null default now()
);

-- The rule of the state the others see, with the clock as an argument:
-- desconectado without a session or after PRESENCIA_SIN_SENAL_MIN minutes
-- without a heartbeat; ausente when the account chose en_juego and sent no
-- input for PRESENCIA_INACTIVO_HORAS hours; otherwise the chosen one. It
-- matches effectivePresence of src/lib/trade/limits.ts.
create function public.trade_presence_effective_state(
  p_estado public.trade_presence_state,
  p_last_seen_at timestamptz,
  p_last_input_at timestamptz,
  p_has_session boolean,
  p_now timestamptz
)
returns public.trade_presence_state
language sql
stable
set search_path = ''
as $$
  select case
    when p_estado is null
      or not coalesce(p_has_session, false)
      or p_last_seen_at is null
      or p_now - p_last_seen_at
        > make_interval(mins => public.app_parameter_int('PRESENCIA_SIN_SENAL_MIN'))
      then 'desconectado'::public.trade_presence_state
    when p_estado = 'en_juego'
      and (
        p_last_input_at is null
        or p_now - p_last_input_at
          > make_interval(hours => public.app_parameter_int('PRESENCIA_INACTIVO_HORAS'))
      )
      then 'ausente'::public.trade_presence_state
    else p_estado
  end;
$$;

create function public.account_has_session(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.sessions as auth_session
    where auth_session.user_id = p_user_id
      and (auth_session.not_after is null or auth_session.not_after > now())
  );
$$;

-- Presence is part of Comercio: a complete account of EDAD_MINIMA_COMERCIO years.
create function public.trade_require_presence_account(p_user_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if not public.account_is_complete(p_user_id) then
    raise exception 'account_incomplete' using errcode = '42501';
  end if;

  if (
    select public.account_age_years(profile.birth_date, current_date)
    from public.account_profiles as profile
    where profile.user_id = p_user_id
  ) < public.app_parameter_int('EDAD_MINIMA_COMERCIO') then
    raise exception 'underage' using errcode = '42501';
  end if;
end;
$$;

-- The heartbeat of every open tab, each 60 s (§9.15.6): p_activo says whether
-- there was keyboard or pointer input since the previous one. It returns the
-- state the others see now.
create function public.trade_heartbeat(p_activo boolean)
returns public.trade_presence_state
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  result public.trade_presence_state;
begin
  perform public.trade_require_presence_account(caller);

  insert into public.trade_presence as presence (user_id, last_seen_at, last_input_at)
  values (caller, now(), case when coalesce(p_activo, false) then now() end)
  on conflict (user_id) do update
    set last_seen_at = excluded.last_seen_at,
        last_input_at = coalesce(excluded.last_input_at, presence.last_input_at),
        updated_at = now()
  returning public.trade_presence_effective_state(
    presence.estado, presence.last_seen_at, presence.last_input_at, true, now()
  ) into result;

  return result;
end;
$$;

-- «En el juego», «Ausente» or «Desconectado» from the header menu, the account
-- page and Comercio (§9.16.2). Choosing counts as input. «Cerrar sesión» sets
-- desconectado first, and that works for any signed-in account, so signing out
-- never fails here.
create function public.trade_set_presence(p_estado text)
returns public.trade_presence_state
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  chosen public.trade_presence_state;
  result public.trade_presence_state;
begin
  if caller is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if p_estado is null or p_estado not in ('en_juego', 'ausente', 'desconectado') then
    raise exception 'presence_invalid' using errcode = '22023';
  end if;
  chosen := p_estado::public.trade_presence_state;

  if chosen = 'desconectado' then
    update public.trade_presence as presence
    set estado = 'desconectado', updated_at = now()
    where presence.user_id = caller;
    return 'desconectado';
  end if;

  perform public.trade_require_presence_account(caller);

  insert into public.trade_presence as presence (user_id, estado, last_seen_at, last_input_at)
  values (caller, chosen, now(), now())
  on conflict (user_id) do update
    set estado = excluded.estado,
        last_seen_at = excluded.last_seen_at,
        last_input_at = excluded.last_input_at,
        updated_at = now()
  returning public.trade_presence_effective_state(
    presence.estado, presence.last_seen_at, presence.last_input_at, true, now()
  ) into result;

  return result;
end;
$$;

-- The state the others see (§9.15.6), for up to 100 accounts at once; an
-- account without presence is desconectado. Anyone may read it, as Comercio
-- shows it next to each seller.
create function public.trade_effective_presence(p_user_ids uuid[])
returns table (user_id uuid, estado public.trade_presence_state)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_user_ids is null then
    return;
  end if;

  if cardinality(p_user_ids) > 100 then
    raise exception 'too_many_accounts' using errcode = '22023';
  end if;

  return query
  select
    requested.id,
    public.trade_presence_effective_state(
      presence.estado,
      presence.last_seen_at,
      presence.last_input_at,
      public.account_has_session(requested.id),
      now()
    )
  from (select distinct unnest(p_user_ids) as id) as requested
  left join public.trade_presence as presence on presence.user_id = requested.id
  where requested.id is not null;
end;
$$;

-- 14. Step 3 and «Editar perfil» (§9.15.1, §9.16.3). Steps 1 and 2 come
--     first. p_birth_date and p_terms_version may be null once saved (they
--     keep their value); a different birth date, a locked username or a
--     suspended account's identifiers are refused by account_profiles_guard.
--     Returns account_registration_state().
create function public.account_save_profile(
  p_username text,
  p_player_name text,
  p_world_key text,
  p_country_code text,
  p_birth_date date default null,
  p_terms_version text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  steps record;
  saved public.account_profiles;
  username_value text := lower(btrim(coalesce(p_username, '')));
  player_value text := regexp_replace(btrim(coalesce(p_player_name, '')), '\s+', ' ', 'g');
  world_value text := btrim(coalesce(p_world_key, ''));
  country_value text := upper(btrim(coalesce(p_country_code, '')));
  birth_value date;
  terms_value text;
  terms_at timestamptz;
  violated text;
begin
  if caller is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select * into steps from public.account_registration_steps(caller);
  if not found then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if not steps.email then
    raise exception 'email_unconfirmed' using errcode = '42501';
  end if;
  if not steps.identity then
    raise exception 'identity_missing' using errcode = '42501';
  end if;

  select * into saved
  from public.account_profiles as profile
  where profile.user_id = caller
  for update;

  if saved.deleted_at is not null then
    raise exception 'account_deleted' using errcode = '42501';
  end if;

  if username_value !~ '^[a-z0-9_-]{3,24}$' then
    raise exception 'username_invalid' using errcode = '22023';
  end if;

  if char_length(player_value) not between 1 and 32 or player_value ~ '[[:cntrl:]]' then
    raise exception 'player_name_invalid' using errcode = '22023';
  end if;

  -- The database cannot read content/mundos.json: the form only offers its
  -- ids, and here the value must at least have the shape of one.
  if char_length(world_value) > 32 or world_value !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'world_invalid' using errcode = '22023';
  end if;

  if country_value !~ '^[A-Z]{2}$' then
    raise exception 'country_invalid' using errcode = '22023';
  end if;

  if saved.birth_date is not null then
    birth_value := coalesce(p_birth_date, saved.birth_date);
  elsif p_birth_date is null then
    raise exception 'birth_date_required' using errcode = '22023';
  elsif p_birth_date > current_date or p_birth_date < date '1900-01-01' then
    raise exception 'birth_date_invalid' using errcode = '22023';
  elsif public.account_age_years(p_birth_date, current_date)
        < public.app_parameter_int('EDAD_MINIMA_CUENTA') then
    raise exception 'birth_date_underage' using errcode = '22023';
  else
    birth_value := p_birth_date;
  end if;

  if p_terms_version is not null then
    if p_terms_version is distinct from public.app_parameter_text('TERMINOS_VERSION') then
      raise exception 'terms_version_invalid' using errcode = '22023';
    end if;
    terms_value := p_terms_version;
    terms_at := case
      when saved.terms_version = p_terms_version then saved.terms_accepted_at
      else now()
    end;
  elsif saved.terms_version is null then
    raise exception 'terms_required' using errcode = '22023';
  else
    terms_value := saved.terms_version;
    terms_at := saved.terms_accepted_at;
  end if;

  begin
    insert into public.account_profiles as profile (
      user_id, username, player_name, world_key, country_code, birth_date, terms_version, terms_accepted_at
    )
    values (
      caller, username_value, player_value, world_value, country_value, birth_value, terms_value, terms_at
    )
    on conflict (user_id) do update
      set username = excluded.username,
          player_name = excluded.player_name,
          world_key = excluded.world_key,
          country_code = excluded.country_code,
          birth_date = excluded.birth_date,
          terms_version = excluded.terms_version,
          terms_accepted_at = excluded.terms_accepted_at;
  exception
    when unique_violation then
      get stacked diagnostics violated = constraint_name;
      if violated = 'account_profiles_username_key' then
        raise exception 'username_taken' using errcode = '23505';
      elsif violated = 'account_profiles_player_world_key' then
        raise exception 'player_name_taken' using errcode = '23505';
      end if;
      raise;
  end;

  return public.account_registration_state();
end;
$$;

-- 15. What the account page, the header entry and «Mi perfil» read about the
--     caller (§9.15.1, §9.16): the steps, the profile (never the birth date),
--     the Comercio requirements and the presence. It answers before the
--     registration is complete, since it is how the page knows which step to
--     show.
create function public.account_registration_state()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  account auth.users;
  steps record;
  profile public.account_profiles;
  providers text[];
  presence public.trade_presence;
  adult boolean;
  reason text;
begin
  if caller is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select * into account from auth.users as row_account where row_account.id = caller;
  if not found then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select * into steps from public.account_registration_steps(caller);
  select * into profile from public.account_profiles as row_profile where row_profile.user_id = caller;
  select * into presence from public.trade_presence as row_presence where row_presence.user_id = caller;

  select coalesce(array_agg(distinct linked.provider order by linked.provider), array[]::text[])
  into providers
  from auth.identities as linked
  where linked.user_id = caller;

  adult := public.account_age_years(profile.birth_date, current_date)
    >= public.app_parameter_int('EDAD_MINIMA_COMERCIO');
  reason := public.trade_eligibility(caller);

  return jsonb_build_object(
    'steps', jsonb_build_object(
      'email', steps.email,
      'identity', steps.identity,
      'phone', steps.phone,
      'profile', steps.profile
    ),
    'phone_required', public.app_parameter_bool('TELEFONO_OBLIGATORIO'),
    'complete', steps.email and steps.identity and steps.phone and steps.profile,
    'identities', to_jsonb(providers),
    'member_since', account.created_at,
    'profile', case
      when profile.user_id is null or profile.deleted_at is not null then null
      else jsonb_build_object(
        'username', profile.username,
        'player_name', profile.player_name,
        'world_key', profile.world_key,
        'country_code', profile.country_code,
        'birth_date_saved', profile.birth_date is not null,
        'terms_version', profile.terms_version,
        'terms_accepted_at', profile.terms_accepted_at,
        'terms_current', profile.terms_version = public.app_parameter_text('TERMINOS_VERSION'),
        'username_locked', profile.username_locked_at is not null
      )
    end,
    'comercio', jsonb_build_object(
      'eligible', reason is null,
      'reason', reason,
      'adult', adult,
      'consent_current', public.trade_has_current_consent(caller),
      'suspended_until', case
        when profile.trade_suspended_until > now() then to_jsonb(profile.trade_suspended_until)
        else 'null'::jsonb
      end,
      'moderator', public.account_is_moderator()
    ),
    'presence', jsonb_build_object(
      'estado', coalesce(presence.estado, 'desconectado'),
      'efectivo', public.trade_presence_effective_state(
        presence.estado, presence.last_seen_at, presence.last_input_at, true, now()
      )
    )
  );
end;
$$;

-- 16. Comercio suspension (§9.11, §9.15.5), for trade_moderate: p_until null is
--     the indefinite one, the ban. The account and its identifiers stay.
create function public.trade_suspend_account(p_user_id uuid, p_until timestamptz)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  suspended_until timestamptz := coalesce(p_until, 'infinity'::timestamptz);
begin
  if p_user_id is null or not exists (select 1 from auth.users as account where account.id = p_user_id) then
    raise exception 'account_missing' using errcode = '22023';
  end if;

  if suspended_until <= now() then
    raise exception 'suspension_until_invalid' using errcode = '22023';
  end if;

  insert into public.account_profiles as profile (user_id, trade_suspended_until)
  values (p_user_id, suspended_until)
  on conflict (user_id) do update
    set trade_suspended_until = excluded.trade_suspended_until;

  return suspended_until;
end;
$$;

create function public.trade_lift_suspension(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.account_profiles as profile
  set trade_suspended_until = null
  where profile.user_id = p_user_id
    and profile.trade_suspended_until is not null;
  return found;
end;
$$;

-- 17. «Eliminar cuenta» (§9.9, §9.15.5). The guilds the account owns go first
--     (guilds.owner_user_id has no cascade); their snapshots cascade.
--     * Not suspended: the Auth user is deleted, and with it the profile, the
--       presence, the consents, the e-mail key, the identities, the sessions
--       and the guild memberships. Returns 'deleted'.
--     * Suspended: everything goes except the normalized e-mail, the
--       identities and the player name and world. The Auth user stays with
--       its e-mail and identities, blocked (banned_until) and without
--       sessions. Returns 'reserved'.
--     The evidence stays until its purge (§9.15.3).
create function public.account_delete()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
begin
  if caller is null or not exists (select 1 from auth.users as account where account.id = caller) then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  delete from public.guilds as guild where guild.owner_user_id = caller;

  if not public.account_is_trade_suspended(caller) then
    delete from auth.users as account where account.id = caller;
    return 'deleted';
  end if;

  delete from public.guild_memberships as membership where membership.user_id = caller;
  delete from public.trade_presence as presence where presence.user_id = caller;
  delete from public.trade_consents as consent where consent.user_id = caller;

  update public.account_profiles as profile
  set username = null,
      country_code = null,
      birth_date = null,
      terms_version = null,
      terms_accepted_at = null,
      username_locked_at = null,
      deleted_at = now()
  where profile.user_id = caller;

  update auth.users as account
  set banned_until = now() + interval '100 years',
      raw_user_meta_data = '{}'::jsonb,
      updated_at = now()
  where account.id = caller;

  -- Refresh tokens cascade from their sessions.
  delete from auth.sessions as auth_session where auth_session.user_id = caller;

  return 'reserved';
end;
$$;

-- 18. Row level security and privileges. The platform's default privileges
--     grant everything to anon and authenticated (TRUNCATE included, which RLS
--     does not cover), so every table starts from nothing.
alter table public.app_parameters enable row level security;
alter table public.blocked_email_domains enable row level security;
alter table public.account_email_keys enable row level security;
alter table public.account_profiles enable row level security;
alter table public.trade_consents enable row level security;
alter table public.trade_action_evidence enable row level security;
alter table public.trade_evidence_holds enable row level security;
alter table public.trade_presence enable row level security;

revoke all on table
  public.app_parameters,
  public.blocked_email_domains,
  public.account_email_keys,
  public.account_profiles,
  public.trade_consents,
  public.trade_action_evidence,
  public.trade_evidence_holds,
  public.trade_presence
from anon, authenticated;

-- The owner reads its profile, without the birth date (column privilege).
grant select (
  user_id,
  username,
  player_name,
  world_key,
  country_code,
  terms_version,
  terms_accepted_at,
  username_locked_at,
  trade_suspended_until,
  deleted_at,
  created_at,
  updated_at
) on table public.account_profiles to authenticated;

create policy account_profiles_select_own on public.account_profiles
  for select
  to authenticated
  using (user_id = (select auth.uid()));

grant select on table public.trade_consents to authenticated;

create policy trade_consents_select_own on public.trade_consents
  for select
  to authenticated
  using (user_id = (select auth.uid()));

grant select on table public.trade_presence to authenticated;

create policy trade_presence_select_own on public.trade_presence
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- Only moderators read the evidence; nobody else, not even its account.
grant select on table public.trade_action_evidence to authenticated;

create policy trade_action_evidence_select_moderators on public.trade_action_evidence
  for select
  to authenticated
  using ((select public.account_is_moderator()));

-- Functions: helpers for the other functions only; the Auth hook for Auth only.
revoke all on function public.app_parameter(text) from public, anon, authenticated;
revoke all on function public.app_parameter_int(text) from public, anon, authenticated;
revoke all on function public.app_parameter_bool(text) from public, anon, authenticated;
revoke all on function public.app_parameter_text(text) from public, anon, authenticated;
revoke all on function public.account_normalize_email(text) from public, anon, authenticated;
revoke all on function public.account_age_years(date, date) from public, anon, authenticated;
revoke all on function public.account_discord_created_at(text) from public, anon, authenticated;
revoke all on function public.account_request_ip() from public, anon, authenticated;
revoke all on function public.load_blocked_email_domains(text) from public, anon, authenticated;
revoke all on function public.account_email_domain_blocked(text) from public, anon, authenticated;
revoke all on function public.account_is_trade_suspended(uuid) from public, anon, authenticated;
revoke all on function public.account_profiles_guard() from public, anon, authenticated;
revoke all on function public.account_users_sync() from public, anon, authenticated;
revoke all on function public.account_identities_guard() from public, anon, authenticated;
revoke all on function public.hook_before_user_created(jsonb) from public, anon, authenticated;
revoke all on function public.account_registration_steps(uuid) from public, anon, authenticated;
revoke all on function public.account_is_complete(uuid) from public, anon, authenticated;
revoke all on function public.trade_has_current_consent(uuid) from public, anon, authenticated;
revoke all on function public.trade_eligibility(uuid) from public, anon, authenticated;
revoke all on function public.trade_is_eligible(uuid) from public, anon, authenticated;
revoke all on function public.trade_hold_evidence(text, text, uuid[]) from public, anon, authenticated;
revoke all on function public.trade_release_evidence(text, text) from public, anon, authenticated;
revoke all on function public.trade_purge_evidence() from public, anon, authenticated;
revoke all on function public.trade_authorize(text, boolean, uuid) from public, anon, authenticated;
revoke all on function public.trade_presence_effective_state(public.trade_presence_state, timestamptz, timestamptz, boolean, timestamptz) from public, anon, authenticated;
revoke all on function public.account_has_session(uuid) from public, anon, authenticated;
revoke all on function public.trade_require_presence_account(uuid) from public, anon, authenticated;
revoke all on function public.trade_suspend_account(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.trade_lift_suspension(uuid) from public, anon, authenticated;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;

-- The API of the signed-in account.
revoke all on function public.account_is_moderator() from public, anon;
revoke all on function public.trade_check_eligibility(boolean) from public, anon;
revoke all on function public.trade_accept_consent(text) from public, anon;
revoke all on function public.trade_heartbeat(boolean) from public, anon;
revoke all on function public.trade_set_presence(text) from public, anon;
revoke all on function public.account_save_profile(text, text, text, text, date, text) from public, anon;
revoke all on function public.account_registration_state() from public, anon;
revoke all on function public.account_delete() from public, anon;

grant execute on function public.account_is_moderator() to authenticated;
grant execute on function public.trade_check_eligibility(boolean) to authenticated;
grant execute on function public.trade_accept_consent(text) to authenticated;
grant execute on function public.trade_heartbeat(boolean) to authenticated;
grant execute on function public.trade_set_presence(text) to authenticated;
grant execute on function public.account_save_profile(text, text, text, text, date, text) to authenticated;
grant execute on function public.account_registration_state() to authenticated;
grant execute on function public.account_delete() to authenticated;

-- Public read: Comercio shows each seller's state to every visitor.
revoke all on function public.trade_effective_presence(uuid[]) from public;
grant execute on function public.trade_effective_presence(uuid[]) to anon, authenticated;

notify pgrst, 'reload schema';
