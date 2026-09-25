-- Alliance Codex — Multi-character accounts (owner rule of 2026-09-24).
--
-- Local only: it is never applied to the remote project from the repository
-- (OG-1); the owner applies it. It runs after 20260923160000_listing_asset_v2.sql
-- and never rewrites an earlier migration: the functions it changes are
-- replaced with create or replace, which keeps their privileges.
--
-- The rule: a site account owns up to PERSONAJES_MAX game characters, each a
-- player name and a world of content/mundos.json; one of them is the main
-- character (the header chip «Void Exiled · Titan 1»). Every listing is
-- published as one of the seller's characters and shows its name and world.
-- Pokémon, Items and Diamonds trade only inside that world; Pokédólares are
-- sold to players of any world, yet the listing still belongs to a character
-- (the interface lists it under every world, «Cualquier mundo»). A character
-- that has any listing cannot be removed or renamed: the account adds a new one.
--
-- What it adds:
--   * account_characters, filled from account_profiles (one main character
--     per profile with a player name); a player name is unique per world
--     among all accounts, without regard to case;
--   * account_profiles.player_name and world_key stay, always equal to the
--     main character (the registration steps, the header and other code read
--     them); account_save_profile keeps registration step 3 and «Editar
--     perfil» working and creates or refreshes the main character;
--   * the account API: account_characters_list, account_character_add,
--     account_character_set_main and account_character_remove (no rename);
--   * trade_listings.character_id, filled with the seller's main character.
--     The listing's world is always its character's (a trigger derives it);
--     trade_publish_listing and trade_update_listing take «character_id» in
--     the payload and, without it, fall back to a character of the caller in
--     the payload's world (the main one first), so the deployed composer keeps
--     working;
--   * trade_listing_character(trade_listings): a PostgREST computed field
--     (select=...,character:trade_listing_character) with the character's id,
--     player name and world for every listing the reader may see.
--
-- The foreign key trade_listings.character_id is «on delete set null», not
-- «restrict»: deleting an account deletes its auth.users row, which cascades to
-- its characters, and a restricting key would make every account with a
-- listing undeletable (account_delete and the dashboard alike). The rule «a
-- character with listings is not deleted» is kept by account_character_remove
-- and by account_characters_guard, which refuses any other delete while the
-- account exists; a listing whose character goes with its account is withdrawn,
-- as the seller foreign key already does.
--
-- Security model, as in 20260923150100_account_trust.sql: RLS on, no table
-- privilege for anon, the owner alone reads its characters, every write is a
-- security definer function with search_path = '' that checks its caller and
-- fails with 42501 (permission), 22023 (value) or 23505 (duplicate) and a fixed
-- message the interface translates.

-- 1. Parameter (§9.15.8 module): a change goes here and in
--    src/lib/trade/limits.ts together (D-B6).
insert into public.app_parameters (name, value) values
  ('PERSONAJES_MAX', '10')
on conflict (name) do nothing;

-- 2. The characters.
create table public.account_characters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- «Nombre del jugador», with the checks of account_profiles.player_name.
  player_name text not null
    check (
      char_length(player_name) between 1 and 32
      and player_name = btrim(player_name)
      and player_name !~ '[[:cntrl:]]'
    ),
  -- «Mundo»: an id of content/mundos.json (the database checks its shape only).
  world_key text not null check (char_length(world_key) <= 32 and world_key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  is_main boolean not null default false,
  created_at timestamptz not null default now()
);

-- One game character belongs to one account (§9.15.1: without regard to case).
create unique index account_characters_player_world_key
  on public.account_characters (lower(player_name), world_key);

-- At most one main character per account.
create unique index account_characters_one_main
  on public.account_characters (user_id)
  where is_main;

create index account_characters_user_idx on public.account_characters (user_id, created_at);

-- Serializes the character writes of one account (the limit and the main flag).
create function public.account_characters_lock(p_user_id uuid)
returns void
language sql
set search_path = ''
as $$
  select pg_advisory_xact_lock(hashtextextended('alliance-codex:characters:' || p_user_id::text, 0));
$$;

-- PERSONAJES_MAX characters per account, whichever function inserts.
create function public.account_characters_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform public.account_characters_lock(new.user_id);
  if (
    select count(*)
    from public.account_characters as owned
    where owned.user_id = new.user_id
  ) >= public.app_parameter_int('PERSONAJES_MAX') then
    raise exception 'character_limit' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- A character keeps its account, and one with listings keeps its name and
-- world and is not deleted. Deleting the whole account (auth.users) still
-- cascades: the user row is already gone when its characters are deleted.
create function public.account_characters_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if exists (select 1 from auth.users as account where account.id = old.user_id)
       and exists (select 1 from public.trade_listings as listing where listing.character_id = old.id) then
      raise exception 'character_has_listings' using errcode = '22023';
    end if;
    return old;
  end if;

  if new.user_id is distinct from old.user_id or new.created_at is distinct from old.created_at then
    raise exception 'character_locked' using errcode = '22023';
  end if;

  if (new.player_name is distinct from old.player_name or new.world_key is distinct from old.world_key)
     and exists (select 1 from public.trade_listings as listing where listing.character_id = old.id) then
    raise exception 'character_has_listings' using errcode = '22023';
  end if;

  return new;
end;
$$;

-- 3. One main character per profile that has a player name (suspended and
--    deleted-while-suspended profiles included, so their names stay taken).
--    account_profiles_player_world_key already makes these unique.
insert into public.account_characters (user_id, player_name, world_key, is_main, created_at)
select profile.user_id, profile.player_name, profile.world_key, true, profile.created_at
from public.account_profiles as profile
where profile.player_name is not null
order by profile.created_at;

create trigger account_characters_limit
before insert on public.account_characters
for each row execute function public.account_characters_limit();

create trigger account_characters_guard
before update or delete on public.account_characters
for each row execute function public.account_characters_guard();

-- 4. The profile mirrors the main character.
create function public.account_characters_sync_profile(p_user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.account_profiles as profile
  set player_name = main.player_name,
      world_key = main.world_key
  from public.account_characters as main
  where main.user_id = p_user_id
    and main.is_main
    and profile.user_id = p_user_id
    and (profile.player_name is distinct from main.player_name or profile.world_key is distinct from main.world_key);
$$;

-- The caller of the character API: signed in, with a profile (registration
-- step 3), not deleted and, for the writes, not suspended (a suspended
-- account keeps its names taken, §9.15.5).
create function public.account_characters_caller(p_write boolean)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  profile public.account_profiles;
begin
  if caller is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select * into profile from public.account_profiles as row_profile where row_profile.user_id = caller;
  if profile.user_id is null or profile.player_name is null then
    raise exception 'profile_required' using errcode = '42501';
  end if;
  if profile.deleted_at is not null then
    raise exception 'account_deleted' using errcode = '42501';
  end if;
  if p_write and profile.trade_suspended_until > now() then
    raise exception 'suspended' using errcode = '42501';
  end if;

  return caller;
end;
$$;

-- What account_save_profile does with the player name and world it receives
-- (the values are already validated): that character becomes the main one.
--   * The account already has it (same name without regard to case, same
--     world): it becomes the main one; a different case renames it, unless it
--     has listings.
--   * The main character has no listings: it is renamed in place (the «Editar
--     perfil» of a single-character account keeps working as before).
--   * Otherwise (no character yet, or a main with listings): a new character
--     is added as the main one.
create function public.account_characters_save_main(p_user_id uuid, p_player_name text, p_world_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  matched public.account_characters;
  main public.account_characters;
  violated text;
begin
  perform public.account_characters_lock(p_user_id);

  select * into matched
  from public.account_characters as owned
  where owned.user_id = p_user_id
    and lower(owned.player_name) = lower(p_player_name)
    and owned.world_key = p_world_key;

  select * into main
  from public.account_characters as owned
  where owned.user_id = p_user_id and owned.is_main;

  if matched.id is not null and matched.player_name = p_player_name and matched.is_main then
    return;
  end if;

  if public.account_is_trade_suspended(p_user_id) then
    raise exception 'suspended' using errcode = '42501';
  end if;

  begin
    if matched.id is not null then
      if matched.player_name <> p_player_name then
        update public.account_characters as owned
        set player_name = p_player_name
        where owned.id = matched.id;
      end if;
      if not matched.is_main then
        update public.account_characters as owned
        set is_main = false
        where owned.user_id = p_user_id and owned.is_main;
        update public.account_characters as owned
        set is_main = true
        where owned.id = matched.id;
      end if;
    elsif main.id is not null
          and not exists (select 1 from public.trade_listings as listing where listing.character_id = main.id) then
      update public.account_characters as owned
      set player_name = p_player_name,
          world_key = p_world_key
      where owned.id = main.id;
    else
      update public.account_characters as owned
      set is_main = false
      where owned.user_id = p_user_id and owned.is_main;
      insert into public.account_characters (user_id, player_name, world_key, is_main)
      values (p_user_id, p_player_name, p_world_key, true);
    end if;
  exception
    when unique_violation then
      get stacked diagnostics violated = constraint_name;
      if violated = 'account_characters_player_world_key' then
        raise exception 'player_name_taken' using errcode = '23505';
      end if;
      raise;
  end;
end;
$$;

-- 5. Step 3 and «Editar perfil» (§9.15.1, §9.16.3), as in
--    20260923150100_account_trust.sql, plus the main character: the player
--    name and world saved are the main character's (account_characters_save_main).
create or replace function public.account_save_profile(
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

  -- The main character first: its name is unique among every character.
  perform public.account_characters_save_main(caller, player_value, world_value);

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

-- 6. The character API of the signed-in account. Every write returns the list,
--    so the interface redraws from one answer.

-- The account's characters, the main one first, each with how many listings
-- (any state) were published as it: a character with listings is not removed.
create function public.account_characters_list()
returns table (
  id uuid,
  player_name text,
  world_key text,
  is_main boolean,
  listings integer,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  caller uuid := (select auth.uid());
begin
  if caller is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  return query
    select
      owned.id,
      owned.player_name,
      owned.world_key,
      owned.is_main,
      (
        select count(*)::integer
        from public.trade_listings as listing
        where listing.character_id = owned.id
      ),
      owned.created_at
    from public.account_characters as owned
    where owned.user_id = caller
    order by owned.is_main desc, owned.created_at, owned.id;
end;
$$;

-- «Añadir personaje»: the first character of an account becomes the main one.
-- A name taken in that world (by any account) answers 23505 player_name_taken;
-- the eleventh, 42501 character_limit.
create function public.account_character_add(p_player_name text, p_world_key text)
returns table (
  id uuid,
  player_name text,
  world_key text,
  is_main boolean,
  listings integer,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  caller uuid := public.account_characters_caller(true);
  player_value text := regexp_replace(btrim(coalesce(p_player_name, '')), '\s+', ' ', 'g');
  world_value text := btrim(coalesce(p_world_key, ''));
  violated text;
begin
  if char_length(player_value) not between 1 and 32 or player_value ~ '[[:cntrl:]]' then
    raise exception 'player_name_invalid' using errcode = '22023';
  end if;
  if char_length(world_value) > 32 or world_value !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'world_invalid' using errcode = '22023';
  end if;

  perform public.account_characters_lock(caller);

  begin
    insert into public.account_characters (user_id, player_name, world_key, is_main)
    values (
      caller,
      player_value,
      world_value,
      not exists (
        select 1 from public.account_characters as owned where owned.user_id = caller and owned.is_main
      )
    );
  exception
    when unique_violation then
      get stacked diagnostics violated = constraint_name;
      if violated = 'account_characters_player_world_key' then
        raise exception 'player_name_taken' using errcode = '23505';
      end if;
      raise;
  end;

  perform public.account_characters_sync_profile(caller);
  return query select * from public.account_characters_list();
end;
$$;

-- «Principal»: the header shows it and the profile columns mirror it.
create function public.account_character_set_main(p_id uuid)
returns table (
  id uuid,
  player_name text,
  world_key text,
  is_main boolean,
  listings integer,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  caller uuid := public.account_characters_caller(true);
  target public.account_characters;
begin
  perform public.account_characters_lock(caller);

  select * into target
  from public.account_characters as owned
  where owned.id = p_id and owned.user_id = caller;
  if target.id is null then
    raise exception 'character_not_found' using errcode = '42501';
  end if;

  if not target.is_main then
    update public.account_characters as owned
    set is_main = false
    where owned.user_id = caller and owned.is_main;
    update public.account_characters as owned
    set is_main = true
    where owned.id = target.id;
    perform public.account_characters_sync_profile(caller);
  end if;

  return query select * from public.account_characters_list();
end;
$$;

-- «Quitar personaje»: refused while any listing (in any state) was published
-- as it (character_has_listings) and for the main character (another one
-- becomes the main first; the only character is always the main one).
create function public.account_character_remove(p_id uuid)
returns table (
  id uuid,
  player_name text,
  world_key text,
  is_main boolean,
  listings integer,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  caller uuid := public.account_characters_caller(true);
  target public.account_characters;
begin
  perform public.account_characters_lock(caller);

  select * into target
  from public.account_characters as owned
  where owned.id = p_id and owned.user_id = caller
  for update;
  if target.id is null then
    raise exception 'character_not_found' using errcode = '42501';
  end if;

  if exists (select 1 from public.trade_listings as listing where listing.character_id = target.id) then
    raise exception 'character_has_listings' using errcode = '22023';
  end if;
  if target.is_main then
    raise exception 'character_is_main' using errcode = '22023';
  end if;

  delete from public.account_characters as owned where owned.id = target.id;

  return query select * from public.account_characters_list();
end;
$$;

-- 7. Listings belong to a character.
alter table public.trade_listings
  add column character_id uuid references public.account_characters (id) on delete set null;

create index trade_listings_character_idx on public.trade_listings (character_id);

-- Each listing gets its seller's main character. Pokédólares take its world
-- (they sell to every world). A Pokémon, Items or Diamonds listing of another
-- world cannot be delivered by that character: if it is still publicado,
-- reservado or expirado (renewable) it is withdrawn; its world stays as it was,
-- and the seller publishes it again as a character of that world. Completed
-- listings keep their world as history. Runs with the trigger of
-- 20260923150200_trade_marketplace.sql, before it is replaced below.
update public.trade_listings as listing
set character_id = main.id,
    world_key = case
      when listing.asset_type = 'pokedolares' then main.world_key
      else listing.world_key
    end,
    status = case
      when listing.asset_type <> 'pokedolares'
           and listing.world_key <> main.world_key
           and listing.status in ('publicado', 'reservado', 'expirado')
        then 'retirado'::public.trade_listing_status
      else listing.status
    end
from public.account_characters as main
where main.user_id = listing.seller_id
  and main.is_main;

alter table public.trade_listings
  add constraint trade_listings_character_or_withdrawn check (character_id is not null or status = 'retirado');

-- The trigger of every listing write: a listing without seller or character is
-- withdrawn (their foreign keys set them to null when the account is deleted);
-- the world is the character's, and the character is the seller's. A row
-- inserted without a character (by SQL, not through the API) takes the
-- seller's main one.
create or replace function public.trade_listings_prepare()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  derive boolean;
  owner_id uuid;
  owner_world text;
begin
  if tg_op = 'INSERT' and new.character_id is null and new.seller_id is not null then
    select owned.id into new.character_id
    from public.account_characters as owned
    where owned.user_id = new.seller_id and owned.is_main;
  end if;

  if new.seller_id is null or new.character_id is null then
    new.status := 'retirado';
  end if;

  if tg_op = 'INSERT' then
    derive := new.character_id is not null;
  else
    derive := new.character_id is not null
      and (new.character_id is distinct from old.character_id or new.world_key is distinct from old.world_key);
  end if;

  if derive then
    select owned.user_id, owned.world_key into owner_id, owner_world
    from public.account_characters as owned
    where owned.id = new.character_id;
    if owner_id is null or (new.seller_id is not null and owner_id <> new.seller_id) then
      raise exception 'character_not_found' using errcode = '42501';
    end if;
    new.world_key := owner_world;
  end if;

  new.search_text := public.trade_listing_search_text(new.asset_type, new.world_key, new.asset);
  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

-- The listing a payload describes (the fields of §9.12.1 plus «character_id»),
-- validated. «character_id» and «world_key» are optional here:
-- trade_resolve_character decides the character and the world comes from it.
create or replace function public.trade_listing_from_payload(p_listing jsonb)
returns public.trade_listings
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  draft public.trade_listings;
  amount_text text;
  problem text;
begin
  if p_listing is null
     or not public.trade_json_keys_within(
       p_listing,
       array[
         'character_id', 'asset_type', 'world_key', 'asset', 'fiat_currency', 'fiat_amount', 'game_prices',
         'negotiable'
       ]
     ) then
    raise exception 'listing_invalid' using errcode = '22023';
  end if;

  if coalesce(p_listing ->> 'asset_type', '') not in ('pokemon', 'items', 'diamonds', 'pokedolares') then
    raise exception 'asset_type_invalid' using errcode = '22023';
  end if;
  draft.asset_type := (p_listing ->> 'asset_type')::public.trade_asset_type;

  if not public.trade_json_absent(p_listing -> 'character_id') then
    if jsonb_typeof(p_listing -> 'character_id') is distinct from 'string'
       or (p_listing ->> 'character_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'character_invalid' using errcode = '22023';
    end if;
    draft.character_id := (p_listing ->> 'character_id')::uuid;
  end if;

  if not public.trade_json_absent(p_listing -> 'world_key') then
    draft.world_key := p_listing ->> 'world_key';
    if jsonb_typeof(p_listing -> 'world_key') is distinct from 'string'
       or char_length(draft.world_key) > 32
       or draft.world_key !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
      raise exception 'world_invalid' using errcode = '22023';
    end if;
  end if;

  draft.asset := p_listing -> 'asset';
  problem := public.trade_asset_problem(draft.asset_type, draft.asset);
  if problem is not null then
    raise exception '%', problem using errcode = '22023';
  end if;

  if not public.trade_json_absent(p_listing -> 'fiat_currency') then
    if jsonb_typeof(p_listing -> 'fiat_currency') <> 'string' then
      raise exception 'price_invalid' using errcode = '22023';
    end if;
    draft.fiat_currency := p_listing ->> 'fiat_currency';
  end if;

  if not public.trade_json_absent(p_listing -> 'fiat_amount') then
    amount_text := p_listing ->> 'fiat_amount';
    if jsonb_typeof(p_listing -> 'fiat_amount') not in ('string', 'number')
       or amount_text !~ '^[0-9]{1,10}([.,][0-9]{1,2})?$' then
      raise exception 'price_invalid' using errcode = '22023';
    end if;
    draft.fiat_amount := replace(amount_text, ',', '.')::numeric(12, 2);
  end if;

  draft.game_prices := case
    when public.trade_json_absent(p_listing -> 'game_prices') then '[]'::jsonb
    else p_listing -> 'game_prices'
  end;

  if public.trade_json_absent(p_listing -> 'negotiable') then
    draft.negotiable := false;
  elsif jsonb_typeof(p_listing -> 'negotiable') = 'boolean' then
    draft.negotiable := (p_listing ->> 'negotiable')::boolean;
  else
    raise exception 'price_invalid' using errcode = '22023';
  end if;

  problem := public.trade_price_problem(
    draft.asset_type, draft.fiat_currency, draft.fiat_amount, draft.game_prices, draft.negotiable
  );
  if problem is not null then
    raise exception '%', problem using errcode = '22023';
  end if;

  return draft;
end;
$$;

-- The character a listing is published as.
--   * «character_id» given: it must be the seller's (42501 character_not_found);
--     a «world_key» that is not its world is refused (22023 world_mismatch).
--   * Not given (the composer before characters): the seller's character in
--     «world_key» (the listing's current one, then the main one, then the
--     oldest); without «world_key», the current or the main one. Pokédólares
--     sell to every world, so with no character in that world they take the
--     current or main one; any other type answers 22023 character_required.
create function public.trade_resolve_character(
  p_seller_id uuid,
  p_character_id uuid,
  p_world_key text,
  p_asset_type public.trade_asset_type,
  p_current_id uuid default null
)
returns public.account_characters
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  chosen public.account_characters;
begin
  if p_character_id is not null then
    select * into chosen
    from public.account_characters as owned
    where owned.id = p_character_id and owned.user_id = p_seller_id;
    if chosen.id is null then
      raise exception 'character_not_found' using errcode = '42501';
    end if;
    if p_world_key is not null and p_world_key <> chosen.world_key then
      raise exception 'world_mismatch' using errcode = '22023';
    end if;
    return chosen;
  end if;

  select * into chosen
  from public.account_characters as owned
  where owned.user_id = p_seller_id
    and (p_world_key is null or owned.world_key = p_world_key)
  order by coalesce(owned.id = p_current_id, false) desc, owned.is_main desc, owned.created_at, owned.id
  limit 1;

  if chosen.id is null and p_asset_type = 'pokedolares' then
    select * into chosen
    from public.account_characters as owned
    where owned.user_id = p_seller_id
    order by coalesce(owned.id = p_current_id, false) desc, owned.is_main desc, owned.created_at, owned.id
    limit 1;
  end if;

  if chosen.id is null then
    raise exception 'character_required' using errcode = '22023';
  end if;
  return chosen;
end;
$$;

-- «Publicar» (§9.7.8), as in 20260923150200_trade_marketplace.sql, as one of
-- the seller's characters.
create or replace function public.trade_publish_listing(p_listing jsonb, p_device_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  draft public.trade_listings := public.trade_listing_from_payload(p_listing);
  caller uuid;
  chosen public.account_characters;
  result_id uuid;
begin
  caller := public.trade_authorize('publicar', draft.fiat_currency is not null, p_device_id);
  perform public.trade_lock(caller::text);

  if not exists (
    select 1
    from public.trade_contact_channels as channel
    where channel.user_id = caller and channel.shared and channel.verified_at is not null
  ) then
    raise exception 'channel_required' using errcode = '42501';
  end if;

  if public.trade_active_listings(caller) >= public.app_parameter_int('ANUNCIOS_ACTIVOS_MAX') then
    raise exception 'listing_limit' using errcode = '42501';
  end if;

  if (
    select count(*)
    from public.trade_listings as listing
    where listing.seller_id = caller and listing.created_at > now() - interval '24 hours'
  ) >= public.app_parameter_int('ANUNCIOS_NUEVOS_24H') then
    raise exception 'rate_limited' using errcode = '42501';
  end if;

  chosen := public.trade_resolve_character(caller, draft.character_id, draft.world_key, draft.asset_type);

  insert into public.trade_listings (
    seller_id, character_id, asset_type, world_key, asset, fiat_currency, fiat_amount, game_prices, negotiable,
    published_at, expires_at
  )
  values (
    caller, chosen.id, draft.asset_type, chosen.world_key, draft.asset, draft.fiat_currency, draft.fiat_amount,
    draft.game_prices, draft.negotiable, now(),
    now() + make_interval(days => public.app_parameter_int('ANUNCIO_DIAS_VIGENCIA'))
  )
  returning listing_id into result_id;

  perform public.trade_detect_device_flags(caller);
  return result_id;
end;
$$;

-- «Editar»: the type and the publication date do not change; the character
-- may (the world follows it).
create or replace function public.trade_update_listing(p_listing_id uuid, p_listing jsonb, p_device_id uuid default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  draft public.trade_listings := public.trade_listing_from_payload(p_listing);
  current_listing public.trade_listings;
  chosen public.account_characters;
  caller uuid;
begin
  select * into current_listing
  from public.trade_listings as listing
  where listing.listing_id = p_listing_id
  for update;

  caller := public.trade_authorize(
    'editar',
    draft.fiat_currency is not null or coalesce(current_listing.fiat_currency is not null, false),
    p_device_id
  );

  if current_listing.listing_id is null or current_listing.seller_id is distinct from caller then
    raise exception 'listing_not_found' using errcode = '42501';
  end if;
  if current_listing.status not in ('publicado', 'reservado') then
    raise exception 'listing_state_invalid' using errcode = '22023';
  end if;
  if draft.asset_type <> current_listing.asset_type then
    raise exception 'asset_type_locked' using errcode = '22023';
  end if;

  chosen := public.trade_resolve_character(
    caller, draft.character_id, draft.world_key, draft.asset_type, current_listing.character_id
  );

  update public.trade_listings as listing
  set character_id = chosen.id,
      world_key = chosen.world_key,
      asset = draft.asset,
      fiat_currency = draft.fiat_currency,
      fiat_amount = draft.fiat_amount,
      game_prices = draft.game_prices,
      negotiable = draft.negotiable
  where listing.listing_id = p_listing_id;
  return true;
end;
$$;

-- 8. The character of a listing for its readers: a PostgREST computed field
--    (select=...,character:trade_listing_character). It reads the stored row
--    again by its id, so a row forged through /rpc shows nothing: only a
--    listing the caller may see (public, its own, or any for a moderator)
--    answers {id, player_name, world_key}; any other, null.
create function public.trade_listing_character(p_listing public.trade_listings)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('id', owned.id, 'player_name', owned.player_name, 'world_key', owned.world_key)
  from public.trade_listings as listing
  join public.account_characters as owned on owned.id = listing.character_id
  where listing.listing_id = p_listing.listing_id
    and (
      public.trade_listing_is_public(listing.status, listing.seller_id)
      or listing.seller_id = (select auth.uid())
      or public.account_is_moderator()
    );
$$;

-- 9. Row level security and privileges. The platform's default privileges
--    grant everything to anon and authenticated, so the table starts from
--    nothing: its owner reads its rows, nobody writes them.
alter table public.account_characters enable row level security;

revoke all on table public.account_characters from anon, authenticated;

grant select on table public.account_characters to authenticated;

create policy account_characters_select_own on public.account_characters
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- Helpers for the other functions and the triggers only.
revoke all on function public.account_characters_lock(uuid) from public, anon, authenticated;
revoke all on function public.account_characters_limit() from public, anon, authenticated;
revoke all on function public.account_characters_guard() from public, anon, authenticated;
revoke all on function public.account_characters_sync_profile(uuid) from public, anon, authenticated;
revoke all on function public.account_characters_caller(boolean) from public, anon, authenticated;
revoke all on function public.account_characters_save_main(uuid, text, text) from public, anon, authenticated;
revoke all on function public.trade_resolve_character(uuid, uuid, text, public.trade_asset_type, uuid)
  from public, anon, authenticated;

-- The API of the signed-in account.
revoke all on function public.account_characters_list() from public, anon;
revoke all on function public.account_character_add(text, text) from public, anon;
revoke all on function public.account_character_set_main(uuid) from public, anon;
revoke all on function public.account_character_remove(uuid) from public, anon;

grant execute on function public.account_characters_list() to authenticated;
grant execute on function public.account_character_add(text, text) to authenticated;
grant execute on function public.account_character_set_main(uuid) to authenticated;
grant execute on function public.account_character_remove(uuid) to authenticated;

-- Public read, like the listings it describes.
revoke all on function public.trade_listing_character(public.trade_listings) from public;
grant execute on function public.trade_listing_character(public.trade_listings) to anon, authenticated;

notify pgrst, 'reload schema';
