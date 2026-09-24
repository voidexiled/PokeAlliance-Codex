-- Alliance Codex / M14 — Comercio phase B: the marketplace (spec §9.10–§9.12,
-- adjusted by the owner's decisions of §9.15).
--
-- Local only: it is never applied to the remote project from the repository
-- (OG-1); the owner applies it. It runs after 20260923150100_account_trust.sql
-- and uses its contract: trade_authorize (the gate, the evidence and the
-- username lock) first in every Comercio action, trade_eligibility for the
-- reads that need an eligible account, trade_suspend_account and
-- trade_lift_suspension, trade_hold_evidence and trade_release_evidence, and
-- account_profiles.username as the public handle.
--
-- What it adds:
--   * the parameters of §9.12.6 next to those of §9.15.8 (app_parameters);
--   * contact channels, listings, transactions (OP-000123 from a sequence),
--     two-way reviews with revisions (1-5 stars, no images, §9.15.4), reports
--     with the optional transaction number, moderators, the append-only
--     moderation log and the alerts of §9.15.5 (trade_flags);
--   * the pair cap RESENAS_PAR_DIA, decided when a transaction is confirmed;
--   * the reputation of §9.15.4 as seller and as buyer, and the public reviews;
--   * the functions of §9.12.3 with the requirements of §9.15.2.
--
-- Security model: every table is deny-by-default. RLS is on everywhere, no API
-- role may insert, update, delete or truncate anything, and every write is a
-- security definer function with search_path = '' that checks its caller and
-- validates its input. Errors are 42501 (permission), 22023 (value) or 23505
-- (duplicate), with a fixed message the interface translates. Nothing stores
-- provenance (R6).

create extension if not exists pg_trgm with schema extensions;

-- 1. Parameters (§9.12.6), in the same module as §9.15.8. A change goes here
--    and in src/lib/trade/limits.ts together (D-B6).
insert into public.app_parameters (name, value) values
  ('ANUNCIO_DIAS_VIGENCIA', '14'),
  ('ANUNCIOS_ACTIVOS_MAX', '20'),
  ('ANUNCIOS_NUEVOS_24H', '10'),
  ('OPERACIONES_NUEVAS_24H', '20'),
  ('REPORTES_24H', '10'),
  ('RESENA_DIAS', '30'),
  ('RESENA_EDICION_DIAS', '7'),
  ('OPERACION_CADUCIDAD_DIAS', '30')
on conflict (name) do nothing;

-- 2. Value lists.
create type public.trade_asset_type as enum ('pokemon', 'items', 'diamonds', 'pokedolares');
create type public.trade_listing_status as enum ('publicado', 'reservado', 'completado', 'expirado', 'retirado');
create type public.trade_channel_kind as enum ('email', 'phone', 'discord', 'google', 'twitch', 'other');
create type public.trade_transaction_status as enum (
  'contacto', 'confirmada_vendedor', 'confirmada_comprador', 'confirmada', 'cancelada', 'disputada', 'caducada'
);
-- 'transaction' is the case a dispute opens (reason 'disputa'); people report
-- listings, sellers and reviews.
create type public.trade_report_target as enum ('listing', 'seller', 'review', 'transaction');
create type public.trade_report_reason as enum ('estafa', 'datos_personales', 'ofensivo', 'falso', 'otro', 'disputa');
create type public.trade_case_status as enum ('open', 'resolved', 'dismissed');
create type public.trade_moderation_action as enum (
  'dismiss', 'withdraw_listing', 'hide_review', 'restore_review', 'warn', 'suspend', 'lift_suspension',
  'resolve_confirm', 'resolve_cancel', 'verify_channel', 'reject_channel'
);
create type public.trade_flag_kind as enum (
  'dispositivo_contrapartes', 'dispositivo_cuentas', 'resenas_cuentas_nuevas', 'tope_resenas'
);

-- 3. Pure validation helpers (immutable: the check constraints use them).
create function public.trade_json_absent(p_value jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_value is null or jsonb_typeof(p_value) = 'null';
$$;

-- A whole JSON number between p_min and p_max.
create function public.trade_json_int(p_value jsonb, p_min numeric, p_max numeric)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(p_value) = 'number' then
      (p_value::text)::numeric = trunc((p_value::text)::numeric)
      and (p_value::text)::numeric between p_min and p_max
    else false
  end;
$$;

-- A declared name: a string of 1 to p_max characters, not blank, no control
-- characters (inner spaces are kept: «S U S A N O O»).
create function public.trade_json_name(p_value jsonb, p_max integer)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(p_value) = 'string' then
      btrim(p_value #>> '{}') <> ''
      and char_length(p_value #>> '{}') <= p_max
      and (p_value #>> '{}') !~ '[[:cntrl:]]'
    else false
  end;
$$;

-- A registry id (content/*.json): lower-case slug.
create function public.trade_json_id(p_value jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(p_value) = 'string' then
      char_length(p_value #>> '{}') <= 64 and (p_value #>> '{}') ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    else false
  end;
$$;

-- «0» to «100» with at most 2 decimals, as a string.
create function public.trade_json_percent(p_value jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(p_value) = 'string' then
      (p_value #>> '{}') ~ '^(100(\.0{1,2})?|[0-9]{1,2}(\.[0-9]{1,2})?)$'
    else false
  end;
$$;

-- An object whose keys are all in p_keys.
create function public.trade_json_keys_within(p_value jsonb, p_keys text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(p_value) = 'object' then
      not exists (select 1 from jsonb_object_keys(p_value) as present (key) where present.key <> all (p_keys))
    else false
  end;
$$;

-- Trims a free text, turns blank into null and refuses text over p_max
-- characters or with control characters other than tab and line breaks.
create function public.trade_clean_text(p_value text, p_max integer, p_error text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  cleaned text := btrim(p_value, E' \t\r\n');
begin
  if cleaned is null or cleaned = '' then
    return null;
  end if;
  if char_length(cleaned) > p_max or cleaned ~ '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]' then
    raise exception '%', p_error using errcode = '22023';
  end if;
  return cleaned;
end;
$$;

-- The asset of a listing (§9.4, §9.7; src/lib/trade/types.ts). Null when it is
-- valid, otherwise 'asset_invalid'. Catalogue values are never stored.
create function public.trade_asset_problem(p_type public.trade_asset_type, p_asset jsonb)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  count_max constant numeric := 999999999999999;
  skills constant text[] := array[
    'Attack', 'Critical Damage', 'Critical Chance', 'Critical Resistance', 'Defense', 'HP', 'Precision', 'Evasion'
  ];
  slots integer := 0;
  entry jsonb;
  seen text[] := array[]::text[];
begin
  if p_type is null or p_asset is null or jsonb_typeof(p_asset) <> 'object' or octet_length(p_asset::text) > 8192 then
    return 'asset_invalid';
  end if;

  if p_type in ('diamonds', 'pokedolares') then
    if not public.trade_json_keys_within(p_asset, array['cantidad'])
       or not public.trade_json_int(p_asset -> 'cantidad', 1, count_max) then
      return 'asset_invalid';
    end if;
    return null;
  end if;

  if p_type = 'items' then
    if not public.trade_json_keys_within(p_asset, array['item', 'nombre', 'cantidad'])
       or not (public.trade_json_absent(p_asset -> 'item') or public.trade_json_id(p_asset -> 'item'))
       or not public.trade_json_name(p_asset -> 'nombre', 80)
       or not public.trade_json_int(p_asset -> 'cantidad', 1, count_max) then
      return 'asset_invalid';
    end if;
    return null;
  end if;

  -- pokemon
  if not public.trade_json_keys_within(
       p_asset,
       array[
         'pokemon', 'ball', 'aura', 'boost', 'starLevel', 'nickname', 'memorySlots', 'memorias', 'helds', 'addon',
         'nextBoostChance', 'entrenamiento', 'precioNpc'
       ]
     )
     or not public.trade_json_id(p_asset -> 'pokemon') then
    return 'asset_invalid';
  end if;

  if not public.trade_json_absent(p_asset -> 'ball')
     and not (
       public.trade_json_keys_within(p_asset -> 'ball', array['item', 'nombre'])
       and (public.trade_json_absent(p_asset -> 'ball' -> 'item') or public.trade_json_id(p_asset -> 'ball' -> 'item'))
       and public.trade_json_name(p_asset -> 'ball' -> 'nombre', 40)
     ) then
    return 'asset_invalid';
  end if;

  if not (public.trade_json_absent(p_asset -> 'aura') or public.trade_json_id(p_asset -> 'aura'))
     or not (public.trade_json_absent(p_asset -> 'boost') or public.trade_json_int(p_asset -> 'boost', 0, 50))
     or not (public.trade_json_absent(p_asset -> 'starLevel') or public.trade_json_int(p_asset -> 'starLevel', 0, 5))
     or not (public.trade_json_absent(p_asset -> 'nickname') or public.trade_json_name(p_asset -> 'nickname', 40))
     or not (
       public.trade_json_absent(p_asset -> 'nextBoostChance') or public.trade_json_percent(p_asset -> 'nextBoostChance')
     ) then
    return 'asset_invalid';
  end if;

  -- Memory Slots and memories: only Ditto and Shiny Ditto.
  if not public.trade_json_absent(p_asset -> 'memorySlots') then
    if (p_asset ->> 'pokemon') not in ('ditto', 'shiny-ditto')
       or not public.trade_json_int(p_asset -> 'memorySlots', 1, 6) then
      return 'asset_invalid';
    end if;
    slots := (p_asset ->> 'memorySlots')::integer;
  end if;

  if not public.trade_json_absent(p_asset -> 'memorias') then
    if jsonb_typeof(p_asset -> 'memorias') <> 'array' or jsonb_array_length(p_asset -> 'memorias') > slots then
      return 'asset_invalid';
    end if;
    for entry in select memory.value from jsonb_array_elements(p_asset -> 'memorias') as memory loop
      if not (public.trade_json_absent(entry) or public.trade_json_id(entry)) then
        return 'asset_invalid';
      end if;
    end loop;
  end if;

  if not public.trade_json_absent(p_asset -> 'helds') then
    if jsonb_typeof(p_asset -> 'helds') <> 'array' or jsonb_array_length(p_asset -> 'helds') > 2 then
      return 'asset_invalid';
    end if;
    for entry in select held.value from jsonb_array_elements(p_asset -> 'helds') as held loop
      if not public.trade_json_keys_within(entry, array['item', 'nombre', 'tier'])
         or not (public.trade_json_absent(entry -> 'item') or public.trade_json_id(entry -> 'item'))
         or not public.trade_json_name(entry -> 'nombre', 40)
         or not public.trade_json_int(entry -> 'tier', 1, 99) then
        return 'asset_invalid';
      end if;
    end loop;
  end if;

  if not public.trade_json_absent(p_asset -> 'addon')
     and not (
       public.trade_json_keys_within(p_asset -> 'addon', array['id', 'nombre'])
       and (public.trade_json_absent(p_asset -> 'addon' -> 'id') or public.trade_json_id(p_asset -> 'addon' -> 'id'))
       and public.trade_json_name(p_asset -> 'addon' -> 'nombre', 40)
     ) then
    return 'asset_invalid';
  end if;

  if not public.trade_json_absent(p_asset -> 'entrenamiento') then
    if jsonb_typeof(p_asset -> 'entrenamiento') <> 'array' or jsonb_array_length(p_asset -> 'entrenamiento') > 8 then
      return 'asset_invalid';
    end if;
    for entry in select skill.value from jsonb_array_elements(p_asset -> 'entrenamiento') as skill loop
      if not public.trade_json_keys_within(entry, array['habilidad', 'nivel', 'progreso'])
         or jsonb_typeof(entry -> 'habilidad') is distinct from 'string'
         or (entry ->> 'habilidad') <> all (skills)
         or (entry ->> 'habilidad') = any (seen)
         or not (public.trade_json_absent(entry -> 'nivel') or public.trade_json_int(entry -> 'nivel', 0, 999999))
         or not (public.trade_json_absent(entry -> 'progreso') or public.trade_json_percent(entry -> 'progreso')) then
        return 'asset_invalid';
      end if;
      seen := seen || (entry ->> 'habilidad');
    end loop;
  end if;

  if not public.trade_json_absent(p_asset -> 'precioNpc') then
    entry := p_asset -> 'precioNpc';
    if not public.trade_json_keys_within(entry, array['tipo', 'cantidad'])
       or not (
         (coalesce(entry ->> 'tipo', '') = 'unsellable' and public.trade_json_absent(entry -> 'cantidad'))
         or (coalesce(entry ->> 'tipo', '') = 'pokedolares' and public.trade_json_int(entry -> 'cantidad', 1, count_max))
       ) then
      return 'asset_invalid';
    end if;
  end if;

  return null;
end;
$$;

-- The price rules of §9.7.4. Null when valid, otherwise 'price_invalid' or
-- 'price_required'.
create function public.trade_price_problem(
  p_type public.trade_asset_type,
  p_currency text,
  p_amount numeric,
  p_game_prices jsonb,
  p_negotiable boolean
)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  option jsonb;
  seen text[] := array[]::text[];
begin
  if p_game_prices is null or jsonb_typeof(p_game_prices) <> 'array' or jsonb_array_length(p_game_prices) > 2 then
    return 'price_invalid';
  end if;

  for option in select game.value from jsonb_array_elements(p_game_prices) as game loop
    if not public.trade_json_keys_within(option, array['tipo', 'cantidad'])
       or coalesce(option ->> 'tipo', '') not in ('pokedolares', 'diamonds')
       or not public.trade_json_int(option -> 'cantidad', 1, 999999999999999)
       -- Two options are of different types, and never the type the listing sells.
       or (option ->> 'tipo') = any (seen)
       or (p_type = 'diamonds' and option ->> 'tipo' = 'diamonds')
       or (p_type = 'pokedolares' and option ->> 'tipo' = 'pokedolares') then
      return 'price_invalid';
    end if;
    seen := seen || (option ->> 'tipo');
  end loop;

  if (p_currency is null) <> (p_amount is null)
     or (p_currency is not null and (p_currency not in ('BRL', 'USD', 'MXN') or p_amount <= 0)) then
    return 'price_invalid';
  end if;

  if coalesce(p_negotiable, false) then
    if p_currency is not null or jsonb_array_length(p_game_prices) > 0 then
      return 'price_invalid';
    end if;
  elsif p_currency is null and jsonb_array_length(p_game_prices) = 0 then
    return 'price_required';
  end if;

  return null;
end;
$$;

-- The text the search index reads (§9.5.2): the declared names and numbers.
create function public.trade_listing_search_text(
  p_type public.trade_asset_type,
  p_world_key text,
  p_asset jsonb
)
returns text
language sql
stable
set search_path = ''
as $$
  select lower(concat_ws(
    ' ',
    p_type::text,
    p_world_key,
    p_asset ->> 'pokemon',
    p_asset ->> 'nickname',
    replace(p_asset ->> 'nickname', ' ', ''),
    p_asset -> 'ball' ->> 'nombre',
    p_asset ->> 'aura',
    p_asset -> 'addon' ->> 'nombre',
    case when jsonb_typeof(p_asset -> 'boost') = 'number' then '+' || (p_asset ->> 'boost') end,
    case when jsonb_typeof(p_asset -> 'helds') = 'array' then
      (select string_agg(held.value ->> 'nombre', ' ') from jsonb_array_elements(p_asset -> 'helds') as held)
    end,
    p_asset ->> 'item',
    p_asset ->> 'nombre',
    p_asset ->> 'cantidad'
  ));
$$;

-- 4. Moderators (§9.11): the owner adds rows by SQL.
create table public.trade_moderators (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create function public.trade_is_moderator(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.trade_moderators as moderator where moderator.user_id = p_user_id);
$$;

-- An account others may see in Comercio: it has a username, was not deleted
-- and is not suspended (§9.11: a suspension hides its listings and profile).
-- The RLS policies call it, so the API roles may execute it.
create function public.trade_account_visible(p_user_id uuid)
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
      and profile.username is not null
      and profile.deleted_at is null
      and (profile.trade_suspended_until is null or profile.trade_suspended_until <= now())
  );
$$;

-- The public handle of an account; null once it was deleted.
create function public.trade_handle(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select profile.username
  from public.account_profiles as profile
  where profile.user_id = p_user_id
    and profile.deleted_at is null;
$$;

-- 5. Contact channels (§9.9). The value is private: only its account (through
--    trade_my_channels), the counterpart of a transaction (through
--    trade_transaction_contacts) and moderators (pending channels) read it.
create table public.trade_contact_channels (
  channel_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind public.trade_channel_kind not null,
  platform text
    check (
      platform is null
      or (char_length(platform) between 1 and 32 and platform = btrim(platform) and platform !~ '[[:cntrl:]]')
    ),
  value text not null check (char_length(value) between 1 and 320 and value !~ '[[:cntrl:]]'),
  public_label text check (public_label is null or char_length(public_label) between 1 and 40),
  shared boolean not null default false,
  verified_at timestamptz,
  -- «Otras plataformas»: the code the account puts on its public profile there.
  -- It is no secret (it is published), so it is stored as is for the moderator.
  verification_code text check (verification_code is null or verification_code ~ '^AC-[A-F0-9]{8}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trade_contact_channels_platform_pair check ((kind = 'other') = (platform is not null))
);

create unique index trade_contact_channels_key
  on public.trade_contact_channels (user_id, kind, (coalesce(lower(platform), '')));

create index trade_contact_channels_pending_idx
  on public.trade_contact_channels (updated_at)
  where verified_at is null and verification_code is not null;

-- 6. Listings (§9.4, §9.7).
create table public.trade_listings (
  listing_id uuid primary key default gen_random_uuid(),
  -- Null once the seller's account was deleted; the listing is then withdrawn.
  seller_id uuid references auth.users (id) on delete set null,
  asset_type public.trade_asset_type not null,
  world_key text not null check (char_length(world_key) <= 32 and world_key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  status public.trade_listing_status not null default 'publicado',
  asset jsonb not null,
  fiat_currency text check (fiat_currency in ('BRL', 'USD', 'MXN')),
  fiat_amount numeric(12, 2) check (fiat_amount > 0),
  game_prices jsonb not null default '[]'::jsonb,
  negotiable boolean not null default false,
  search_text text not null default '',
  -- «Retirado por moderación: {motivo}», for its seller.
  moderation_note text check (moderation_note is null or char_length(moderation_note) between 1 and 1000),
  created_at timestamptz not null default now(),
  published_at timestamptz not null default now(),
  expires_at timestamptz not null,
  updated_at timestamptz not null default now(),
  constraint trade_listings_asset_valid check (public.trade_asset_problem(asset_type, asset) is null),
  constraint trade_listings_price_valid
    check (public.trade_price_problem(asset_type, fiat_currency, fiat_amount, game_prices, negotiable) is null),
  constraint trade_listings_seller_or_withdrawn check (seller_id is not null or status = 'retirado')
);

create index trade_listings_status_idx on public.trade_listings (status, published_at desc);
create index trade_listings_seller_idx on public.trade_listings (seller_id, created_at desc);
create index trade_listings_search_idx on public.trade_listings using gin (search_text extensions.gin_trgm_ops);

create function public.trade_listings_prepare()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- The foreign key sets seller_id to null when the account is deleted.
  if new.seller_id is null then
    new.status := 'retirado';
  end if;
  new.search_text := public.trade_listing_search_text(new.asset_type, new.world_key, new.asset);
  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create trigger trade_listings_prepare
before insert or update on public.trade_listings
for each row execute function public.trade_listings_prepare();

-- Listings the public sees (§9.12.2). A published listing past expires_at is
-- shown as expirado by the pages; it stays readable.
create function public.trade_listing_is_public(p_status public.trade_listing_status, p_seller_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_status in ('publicado', 'reservado', 'completado', 'expirado')
    and public.trade_account_visible(p_seller_id);
$$;

-- 7. Transactions (§9.10, §9.15.4). number is shown as OP-000123.
create sequence public.trade_transaction_number_seq;

create table public.trade_transactions (
  transaction_id uuid primary key default gen_random_uuid(),
  number bigint not null unique default nextval('public.trade_transaction_number_seq'),
  listing_id uuid references public.trade_listings (listing_id) on delete set null,
  seller_id uuid references auth.users (id) on delete set null,
  buyer_id uuid references auth.users (id) on delete set null,
  status public.trade_transaction_status not null default 'contacto',
  -- The listing had a real-money price when the buyer contacted the seller.
  real_money boolean not null default false,
  -- Decided on confirmation: within RESENAS_PAR_DIA per pair and 24 h.
  reviewable boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  seller_confirmed_at timestamptz,
  buyer_confirmed_at timestamptz,
  closed_at timestamptz,
  constraint trade_transactions_parties check (buyer_id <> seller_id)
);

alter sequence public.trade_transaction_number_seq owned by public.trade_transactions.number;

-- At most one open transaction per listing and buyer.
create unique index trade_transactions_open_key
  on public.trade_transactions (listing_id, buyer_id)
  where status in ('contacto', 'confirmada_vendedor', 'confirmada_comprador');
create index trade_transactions_buyer_idx on public.trade_transactions (buyer_id, created_at desc);
create index trade_transactions_seller_idx on public.trade_transactions (seller_id, created_at desc);
create index trade_transactions_pair_idx
  on public.trade_transactions ((least(seller_id, buyer_id)), (greatest(seller_id, buyer_id)), closed_at)
  where status = 'confirmada';

-- The state people see: an open transaction without a change in
-- OPERACION_CADUCIDAD_DIAS is caducada, without a scheduled task.
create function public.trade_transaction_state(p_status public.trade_transaction_status, p_updated_at timestamptz)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_status in ('contacto', 'confirmada_vendedor', 'confirmada_comprador')
      and p_updated_at <= now() - make_interval(days => public.app_parameter_int('OPERACION_CADUCIDAD_DIAS'))
      then 'caducada'
    else p_status::text
  end;
$$;

-- 8. Reviews (§9.15.4): buyer to seller and seller to buyer, one each per
--    confirmed transaction. The author and the reviewed account become null
--    when their account is deleted («Cuenta eliminada»).
create table public.trade_reviews (
  review_id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.trade_transactions (transaction_id) on delete cascade,
  listing_id uuid references public.trade_listings (listing_id) on delete set null,
  reviewer_id uuid references auth.users (id) on delete set null,
  reviewee_id uuid references auth.users (id) on delete set null,
  -- The author's role in the transaction.
  reviewer_role text not null check (reviewer_role in ('buyer', 'seller')),
  score smallint not null check (score between 1 and 5),
  comment text check (comment is null or char_length(comment) between 1 and 1000),
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trade_reviews_once unique (transaction_id, reviewer_role),
  constraint trade_reviews_not_self check (reviewer_id <> reviewee_id)
);

create index trade_reviews_reviewee_idx on public.trade_reviews (reviewee_id, created_at desc);
create index trade_reviews_reviewer_idx on public.trade_reviews (reviewer_id, created_at desc);

create table public.trade_review_revisions (
  revision_id bigint generated always as identity primary key,
  review_id uuid not null references public.trade_reviews (review_id) on delete cascade,
  score smallint not null check (score between 1 and 5),
  comment text,
  replaced_at timestamptz not null default now()
);

create index trade_review_revisions_review_idx on public.trade_review_revisions (review_id);

-- 9. Reports (§9.11, §9.15.5) and disputes.
create table public.trade_reports (
  report_id uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users (id) on delete set null,
  target_type public.trade_report_target not null,
  target_id uuid not null,
  -- The transaction number the reporter gave (a scam report), or the disputed one.
  transaction_id uuid references public.trade_transactions (transaction_id) on delete set null,
  reason public.trade_report_reason not null,
  detail text check (detail is null or char_length(detail) between 1 and 1000),
  status public.trade_case_status not null default 'open',
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint trade_reports_other_detail check (reason <> 'otro' or detail is not null),
  constraint trade_reports_dispute check ((reason = 'disputa') = (target_type = 'transaction'))
);

create unique index trade_reports_once on public.trade_reports (reporter_id, target_type, target_id);
create index trade_reports_target_idx on public.trade_reports (target_type, target_id) where status = 'open';
create index trade_reports_status_idx on public.trade_reports (status, created_at desc);
create index trade_reports_reporter_idx on public.trade_reports (reporter_id, created_at desc);

-- 10. The moderation log: insert only, for everyone.
create table public.trade_moderation_events (
  event_id bigint generated always as identity primary key,
  moderator_id uuid not null,
  action public.trade_moderation_action not null,
  target_type text not null
    check (target_type in ('listing', 'seller', 'user', 'review', 'transaction', 'flag', 'channel')),
  target_id uuid not null,
  reason text not null check (char_length(reason) between 1 and 1000),
  until timestamptz,
  report_id uuid,
  flag_id uuid,
  created_at timestamptz not null default now()
);

create index trade_moderation_events_target_idx on public.trade_moderation_events (target_type, target_id);

create function public.trade_moderation_events_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'append_only' using errcode = '42501';
end;
$$;

create trigger trade_moderation_events_append_only
before update or delete on public.trade_moderation_events
for each row execute function public.trade_moderation_events_append_only();

-- 11. Alerts (§9.15.5): only strong patterns, computed when the action that
--     triggers them happens; never from a shared IP.
create table public.trade_flags (
  flag_id uuid primary key default gen_random_uuid(),
  kind public.trade_flag_kind not null,
  status public.trade_case_status not null default 'open',
  -- The account the alert is about (resenas_cuentas_nuevas), otherwise null.
  subject_id uuid,
  user_ids uuid[] not null check (cardinality(user_ids) >= 1),
  device_id uuid,
  transaction_ids uuid[] not null default '{}',
  first_at timestamptz,
  last_at timestamptz,
  event_count integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_by uuid,
  resolved_at timestamptz
);

create index trade_flags_status_idx on public.trade_flags (status, created_at desc);
create index trade_flags_users_idx on public.trade_flags using gin (user_ids);

-- Opens an alert, or adds to the open one with the same kind, device, subject
-- and key accounts; holds the evidence of every account it names.
create function public.trade_flag_upsert(
  p_kind public.trade_flag_kind,
  p_key_users uuid[],
  p_device_id uuid,
  p_subject_id uuid,
  p_user_ids uuid[],
  p_transaction_ids uuid[],
  p_first_at timestamptz,
  p_last_at timestamptz,
  p_count integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing public.trade_flags;
  result_id uuid;
  all_users uuid[];
begin
  select * into existing
  from public.trade_flags as flag
  where flag.kind = p_kind
    and flag.status = 'open'
    and flag.device_id is not distinct from p_device_id
    and flag.subject_id is not distinct from p_subject_id
    and flag.user_ids @> coalesce(p_key_users, array[]::uuid[])
  order by flag.created_at desc
  limit 1
  for update;

  if found then
    update public.trade_flags as flag
    set user_ids = (select array_agg(distinct member order by member) from unnest(flag.user_ids || p_user_ids) as member),
        transaction_ids = coalesce(
          (select array_agg(distinct item) from unnest(flag.transaction_ids || coalesce(p_transaction_ids, '{}')) as item),
          '{}'
        ),
        first_at = least(flag.first_at, p_first_at),
        last_at = greatest(flag.last_at, p_last_at),
        event_count = p_count,
        updated_at = now()
    where flag.flag_id = existing.flag_id
    returning flag.flag_id, flag.user_ids into result_id, all_users;
  else
    insert into public.trade_flags (
      kind, subject_id, user_ids, device_id, transaction_ids, first_at, last_at, event_count
    )
    values (
      p_kind,
      p_subject_id,
      (select array_agg(distinct member order by member) from unnest(p_user_ids) as member),
      p_device_id,
      coalesce(p_transaction_ids, '{}'),
      p_first_at,
      p_last_at,
      p_count
    )
    returning flag_id, user_ids into result_id, all_users;
  end if;

  perform public.trade_hold_evidence('flag', result_id::text, all_users);
  return result_id;
end;
$$;

-- Patterns 1 and 2 (§9.15.5) for the devices p_user_id used in the last 30
-- days: (1) it and a counterpart of a confirmed transaction or a review used
-- the same device; (2) three or more accounts used one device.
create function public.trade_detect_device_flags(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  window_start constant timestamptz := now() - interval '30 days';
  device record;
  other uuid;
  pair_transactions uuid[];
begin
  if p_user_id is null then
    return;
  end if;

  for device in
    select
      evidence.device_id,
      array_agg(distinct evidence.user_id order by evidence.user_id) as users,
      min(evidence.created_at) as first_at,
      max(evidence.created_at) as last_at,
      count(*)::integer as uses
    from public.trade_action_evidence as evidence
    where evidence.created_at > window_start
      and evidence.device_id in (
        select mine.device_id
        from public.trade_action_evidence as mine
        where mine.user_id = p_user_id
          and mine.device_id is not null
          and mine.created_at > window_start
      )
    group by evidence.device_id
  loop
    if cardinality(device.users) >= 3 then
      perform public.trade_flag_upsert(
        'dispositivo_cuentas', array[]::uuid[], device.device_id, null, device.users, array[]::uuid[],
        device.first_at, device.last_at, device.uses
      );
    end if;

    foreach other in array device.users loop
      continue when other = p_user_id;

      select coalesce(array_agg(deal.transaction_id order by deal.number), array[]::uuid[])
      into pair_transactions
      from public.trade_transactions as deal
      where deal.status = 'confirmada'
        and (
          (deal.seller_id = p_user_id and deal.buyer_id = other)
          or (deal.seller_id = other and deal.buyer_id = p_user_id)
        );

      if cardinality(pair_transactions) > 0
         or exists (
           select 1
           from public.trade_reviews as review
           where (review.reviewer_id = p_user_id and review.reviewee_id = other)
              or (review.reviewer_id = other and review.reviewee_id = p_user_id)
         ) then
        perform public.trade_flag_upsert(
          'dispositivo_contrapartes',
          array[least(p_user_id, other), greatest(p_user_id, other)],
          device.device_id,
          null,
          array[p_user_id, other],
          pair_transactions,
          device.first_at,
          device.last_at,
          device.uses
        );
      end if;
    end loop;
  end loop;
end;
$$;

-- Pattern 3: in 7 days, 5 or more visible reviews of p_reviewee from accounts
-- younger than 14 days that have traded only with it.
create function public.trade_detect_new_account_reviews(p_reviewee uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  reviewers uuid[];
  reviewed_transactions uuid[];
  total integer;
  first_review timestamptz;
  last_review timestamptz;
begin
  if p_reviewee is null then
    return;
  end if;

  select
    array_agg(distinct review.reviewer_id),
    array_agg(distinct review.transaction_id),
    count(*)::integer,
    min(review.created_at),
    max(review.created_at)
  into reviewers, reviewed_transactions, total, first_review, last_review
  from public.trade_reviews as review
  join auth.users as account on account.id = review.reviewer_id
  where review.reviewee_id = p_reviewee
    and not review.hidden
    and review.created_at > now() - interval '7 days'
    and account.created_at > now() - interval '14 days'
    and not exists (
      select 1
      from public.trade_transactions as deal
      where (deal.buyer_id = review.reviewer_id and deal.seller_id is distinct from p_reviewee)
         or (deal.seller_id = review.reviewer_id and deal.buyer_id is distinct from p_reviewee)
    );

  if total >= 5 then
    perform public.trade_flag_upsert(
      'resenas_cuentas_nuevas', array[p_reviewee], null, p_reviewee, array[p_reviewee] || reviewers,
      reviewed_transactions, first_review, last_review, total
    );
  end if;
end;
$$;

-- Pattern 4: the pair reached RESENAS_PAR_DIA confirmed transactions on each
-- of three consecutive days (UTC), today included.
create function public.trade_detect_pair_cap(p_first uuid, p_second uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  cap constant integer := public.app_parameter_int('RESENAS_PAR_DIA');
  today constant date := (now() at time zone 'UTC')::date;
  days_at_cap integer;
  pair_transactions uuid[];
  first_deal timestamptz;
  last_deal timestamptz;
  total integer;
begin
  if p_first is null or p_second is null then
    return;
  end if;

  with pair_days as (
    select (deal.closed_at at time zone 'UTC')::date as day, count(*) as deals
    from public.trade_transactions as deal
    where deal.status = 'confirmada'
      and least(deal.seller_id, deal.buyer_id) = least(p_first, p_second)
      and greatest(deal.seller_id, deal.buyer_id) = greatest(p_first, p_second)
      and deal.closed_at >= ((today - 2)::timestamp at time zone 'UTC')
    group by 1
  )
  select count(*)::integer into days_at_cap from pair_days where pair_days.deals >= cap;

  if days_at_cap < 3 then
    return;
  end if;

  select array_agg(deal.transaction_id order by deal.number), min(deal.closed_at), max(deal.closed_at), count(*)::integer
  into pair_transactions, first_deal, last_deal, total
  from public.trade_transactions as deal
  where deal.status = 'confirmada'
    and least(deal.seller_id, deal.buyer_id) = least(p_first, p_second)
    and greatest(deal.seller_id, deal.buyer_id) = greatest(p_first, p_second)
    and deal.closed_at >= ((today - 2)::timestamp at time zone 'UTC');

  perform public.trade_flag_upsert(
    'tope_resenas',
    array[least(p_first, p_second), greatest(p_first, p_second)],
    null,
    null,
    array[p_first, p_second],
    pair_transactions,
    first_deal,
    last_deal,
    total
  );
end;
$$;

-- Serializes the limited actions of one account (limits and the pair cap).
create function public.trade_lock(p_key text)
returns void
language sql
set search_path = ''
as $$
  select pg_advisory_xact_lock(hashtextextended('alliance-codex:trade:' || p_key, 0));
$$;

-- 12. Public reads (anon and authenticated).

-- A public profile by its username (§9.8): 404 while suspended or deleted.
create function public.trade_public_profile(p_username text)
returns table (user_id uuid, username text, member_since timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select profile.user_id, profile.username, account.created_at
  from public.account_profiles as profile
  join auth.users as account on account.id = profile.user_id
  where lower(profile.username) = lower(btrim(p_username))
    and public.trade_account_visible(profile.user_id)
  limit 1;
$$;

-- The handles of the sellers of a page of listings (at most 100 ids).
create function public.trade_public_profiles(p_user_ids uuid[])
returns table (user_id uuid, username text, member_since timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select profile.user_id, profile.username, account.created_at
  from public.account_profiles as profile
  join auth.users as account on account.id = profile.user_id
  where profile.user_id = any ((coalesce(p_user_ids, array[]::uuid[]))[1:100])
    and public.trade_account_visible(profile.user_id);
$$;

-- The reputation of §9.15.4 as seller ('seller') or buyer ('buyer'), over the
-- visible reviews: operaciones (confirmed transactions in that role),
-- contrapartes (distinct authors), media (the mean of each author's mean, one
-- decimal, half up) and the distribution 1-5. The reviews of deleted accounts
-- count as one counterpart. No row while the account is not visible.
create function public.trade_reputation(p_user_id uuid, p_role text)
returns table (
  operaciones integer,
  resenas integer,
  contrapartes integer,
  media numeric,
  d1 integer,
  d2 integer,
  d3 integer,
  d4 integer,
  d5 integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with visible as (
    select review.score, coalesce(review.reviewer_id, '00000000-0000-0000-0000-000000000000'::uuid) as author
    from public.trade_reviews as review
    where review.reviewee_id = p_user_id
      and not review.hidden
      and review.reviewer_role = case p_role when 'seller' then 'buyer' else 'seller' end
  ),
  per_author as (
    select visible.author, avg(visible.score) as mean from visible group by visible.author
  )
  select
    (
      select count(*)::integer
      from public.trade_transactions as deal
      where deal.status = 'confirmada'
        and (case p_role when 'seller' then deal.seller_id else deal.buyer_id end) = p_user_id
    ),
    (select count(*)::integer from visible),
    (select count(*)::integer from per_author),
    (select round(avg(per_author.mean), 1) from per_author),
    (select count(*)::integer from visible where visible.score = 1),
    (select count(*)::integer from visible where visible.score = 2),
    (select count(*)::integer from visible where visible.score = 3),
    (select count(*)::integer from visible where visible.score = 4),
    (select count(*)::integer from visible where visible.score = 5)
  where p_role in ('seller', 'buyer')
    and public.trade_account_visible(p_user_id);
$$;

create function public.trade_seller_stats(p_seller_id uuid)
returns table (
  operaciones integer,
  resenas integer,
  contrapartes integer,
  media numeric,
  d1 integer,
  d2 integer,
  d3 integer,
  d4 integer,
  d5 integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.trade_reputation(p_seller_id, 'seller');
$$;

create function public.trade_buyer_stats(p_buyer_id uuid)
returns table (
  operaciones integer,
  resenas integer,
  contrapartes integer,
  media numeric,
  d1 integer,
  d2 integer,
  d3 integer,
  d4 integer,
  d5 integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.trade_reputation(p_buyer_id, 'buyer');
$$;

-- The visible reviews a seller received, newest first. Never the author's id,
-- contacts or evidence; the author's handle is null once deleted.
create function public.trade_public_reviews(p_seller_id uuid, p_limit integer default 10, p_offset integer default 0)
returns table (
  review_id uuid,
  score smallint,
  comment text,
  created_at timestamptz,
  updated_at timestamptz,
  reviewer_handle text,
  asset_type text,
  asset jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    review.review_id,
    review.score,
    review.comment,
    review.created_at,
    case when review.updated_at > review.created_at then review.updated_at end,
    public.trade_handle(review.reviewer_id),
    case when listing.moderation_note is null then listing.asset_type::text end,
    case when listing.moderation_note is null then listing.asset end
  from public.trade_reviews as review
  left join public.trade_listings as listing on listing.listing_id = review.listing_id
  where review.reviewee_id = p_seller_id
    and review.reviewer_role = 'buyer'
    and not review.hidden
    and public.trade_account_visible(p_seller_id)
  order by review.created_at desc, review.review_id
  limit least(greatest(coalesce(p_limit, 10), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

-- 13. Contact channels of the account.

-- A verified channel from the account itself (e-mail, phone, identities).
create function public.trade_put_verified_channel(
  p_user_id uuid,
  p_kind public.trade_channel_kind,
  p_value text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  cleaned text := left(regexp_replace(btrim(coalesce(p_value, '')), '[[:cntrl:]]', '', 'g'), 320);
begin
  if cleaned = '' then
    delete from public.trade_contact_channels as channel
    where channel.user_id = p_user_id and channel.kind = p_kind;
    return;
  end if;

  update public.trade_contact_channels as channel
  set value = cleaned,
      verified_at = coalesce(channel.verified_at, now()),
      updated_at = now()
  where channel.user_id = p_user_id
    and channel.kind = p_kind;

  if not found then
    insert into public.trade_contact_channels (user_id, kind, value, verified_at)
    values (p_user_id, p_kind, cleaned, now());
  end if;
end;
$$;

-- After linking or unlinking (§9.9): the e-mail and phone of the account and
-- its Discord, Google and Twitch identities become verified channels; the ones
-- that are gone are removed. Returns how many verified channels it keeps.
create function public.trade_sync_oauth_channels()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  account record;
  provider_name text;
  linked_data jsonb;
  provider_key text;
  kept integer;
begin
  if caller is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if not public.account_is_complete(caller) then
    raise exception 'account_incomplete' using errcode = '42501';
  end if;

  select users.email, users.email_confirmed_at, users.phone, users.phone_confirmed_at
  into account
  from auth.users as users
  where users.id = caller;

  perform public.trade_put_verified_channel(
    caller, 'email', case when account.email_confirmed_at is not null then account.email end
  );
  perform public.trade_put_verified_channel(
    caller, 'phone',
    case when account.phone_confirmed_at is not null and coalesce(account.phone, '') <> '' then '+' || ltrim(account.phone, '+') end
  );

  foreach provider_name in array array['discord', 'google', 'twitch'] loop
    select linked.identity_data, linked.provider_id
    into linked_data, provider_key
    from auth.identities as linked
    where linked.user_id = caller
      and linked.provider = provider_name
    order by linked.created_at
    limit 1;

    if not found then
      linked_data := null;
      provider_key := null;
    end if;

    perform public.trade_put_verified_channel(
      caller,
      provider_name::public.trade_channel_kind,
      case
        when linked_data is null then null
        when provider_name = 'google' then linked_data ->> 'email'
        else coalesce(
          linked_data -> 'custom_claims' ->> 'global_name',
          linked_data ->> 'preferred_username',
          linked_data ->> 'user_name',
          linked_data ->> 'name',
          linked_data ->> 'full_name',
          provider_key
        )
      end
    );
  end loop;

  select count(*)::integer into kept
  from public.trade_contact_channels as channel
  where channel.user_id = caller and channel.verified_at is not null;
  return kept;
end;
$$;

create function public.trade_my_channels()
returns table (
  channel_id uuid,
  kind text,
  platform text,
  value text,
  public_label text,
  shared boolean,
  verified boolean,
  verified_at timestamptz,
  verification_code text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    channel.channel_id,
    channel.kind::text,
    channel.platform,
    channel.value,
    channel.public_label,
    channel.shared,
    channel.verified_at is not null,
    channel.verified_at,
    channel.verification_code
  from public.trade_contact_channels as channel
  where channel.user_id = (select auth.uid())
  order by channel.kind, channel.created_at;
$$;

-- «Mostrar en mis anuncios» for the automatic channels; for «Otra plataforma»
-- also the platform and user, which (when they change) wait for a new code.
create function public.trade_upsert_channel(p_kind text, p_platform text, p_value text, p_shared boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  platform_value text;
  channel_value text;
  result_id uuid;
  current_value text;
begin
  if caller is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if not public.account_is_complete(caller) then
    raise exception 'account_incomplete' using errcode = '42501';
  end if;
  if p_kind is null or p_kind not in ('email', 'phone', 'discord', 'google', 'twitch', 'other') then
    raise exception 'channel_kind_invalid' using errcode = '22023';
  end if;
  if p_shared is null then
    raise exception 'channel_invalid' using errcode = '22023';
  end if;

  if p_kind <> 'other' then
    perform public.trade_sync_oauth_channels();
    update public.trade_contact_channels as channel
    set shared = p_shared, updated_at = now()
    where channel.user_id = caller
      and channel.kind = p_kind::public.trade_channel_kind
      and channel.verified_at is not null
    returning channel.channel_id into result_id;

    if result_id is null then
      raise exception 'channel_unverifiable' using errcode = '22023';
    end if;
    return result_id;
  end if;

  platform_value := public.trade_clean_text(p_platform, 32, 'platform_invalid');
  channel_value := public.trade_clean_text(p_value, 120, 'channel_invalid');
  if platform_value is null or channel_value is null
     or platform_value ~ '[\t\r\n]' or channel_value ~ '[\t\r\n]' then
    raise exception 'channel_invalid' using errcode = '22023';
  end if;

  select channel.channel_id, channel.value
  into result_id, current_value
  from public.trade_contact_channels as channel
  where channel.user_id = caller
    and channel.kind = 'other'
    and lower(channel.platform) = lower(platform_value);

  if result_id is null then
    if (
      select count(*)
      from public.trade_contact_channels as channel
      where channel.user_id = caller and channel.kind = 'other'
    ) >= 5 then
      raise exception 'channel_limit' using errcode = '42501';
    end if;

    insert into public.trade_contact_channels (user_id, kind, platform, value, public_label, shared)
    values (caller, 'other', platform_value, channel_value, platform_value, p_shared)
    returning channel_id into result_id;
    return result_id;
  end if;

  update public.trade_contact_channels as channel
  set platform = platform_value,
      public_label = platform_value,
      value = channel_value,
      shared = p_shared,
      verified_at = case when current_value = channel_value then channel.verified_at end,
      verification_code = case when current_value = channel_value then channel.verification_code end,
      updated_at = now()
  where channel.channel_id = result_id;
  return result_id;
end;
$$;

create function public.trade_delete_channel(p_channel_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
begin
  if caller is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  delete from public.trade_contact_channels as channel
  where channel.channel_id = p_channel_id
    and channel.user_id = caller;
  return found;
end;
$$;

-- The code a moderator looks for on the other platform (D-B5).
create function public.trade_request_channel_code(p_channel_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  code text := 'AC-' || upper(left(replace(gen_random_uuid()::text, '-', ''), 8));
begin
  if caller is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if not public.account_is_complete(caller) then
    raise exception 'account_incomplete' using errcode = '42501';
  end if;

  update public.trade_contact_channels as channel
  set verification_code = code,
      verified_at = null,
      updated_at = now()
  where channel.channel_id = p_channel_id
    and channel.user_id = caller
    and channel.kind = 'other';

  if not found then
    raise exception 'channel_not_found' using errcode = '42501';
  end if;
  return code;
end;
$$;

-- 14. Listings.

-- The listing a payload describes (the fields of §9.12.1), validated.
create function public.trade_listing_from_payload(p_listing jsonb)
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
       array['asset_type', 'world_key', 'asset', 'fiat_currency', 'fiat_amount', 'game_prices', 'negotiable']
     ) then
    raise exception 'listing_invalid' using errcode = '22023';
  end if;

  if coalesce(p_listing ->> 'asset_type', '') not in ('pokemon', 'items', 'diamonds', 'pokedolares') then
    raise exception 'asset_type_invalid' using errcode = '22023';
  end if;
  draft.asset_type := (p_listing ->> 'asset_type')::public.trade_asset_type;

  draft.world_key := p_listing ->> 'world_key';
  if jsonb_typeof(p_listing -> 'world_key') is distinct from 'string'
     or char_length(draft.world_key) > 32
     or draft.world_key !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'world_invalid' using errcode = '22023';
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

-- The seller's listings that count against ANUNCIOS_ACTIVOS_MAX.
create function public.trade_active_listings(p_seller_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.trade_listings as listing
  where listing.seller_id = p_seller_id
    and listing.status in ('publicado', 'reservado')
    and listing.expires_at > now();
$$;

-- «Publicar» (§9.7.8).
create function public.trade_publish_listing(p_listing jsonb, p_device_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  draft public.trade_listings := public.trade_listing_from_payload(p_listing);
  caller uuid;
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

  insert into public.trade_listings (
    seller_id, asset_type, world_key, asset, fiat_currency, fiat_amount, game_prices, negotiable,
    published_at, expires_at
  )
  values (
    caller, draft.asset_type, draft.world_key, draft.asset, draft.fiat_currency, draft.fiat_amount,
    draft.game_prices, draft.negotiable, now(),
    now() + make_interval(days => public.app_parameter_int('ANUNCIO_DIAS_VIGENCIA'))
  )
  returning listing_id into result_id;

  perform public.trade_detect_device_flags(caller);
  return result_id;
end;
$$;

-- «Editar»: the type and the publication date do not change.
create function public.trade_update_listing(p_listing_id uuid, p_listing jsonb, p_device_id uuid default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  draft public.trade_listings := public.trade_listing_from_payload(p_listing);
  current_listing public.trade_listings;
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

  update public.trade_listings as listing
  set world_key = draft.world_key,
      asset = draft.asset,
      fiat_currency = draft.fiat_currency,
      fiat_amount = draft.fiat_amount,
      game_prices = draft.game_prices,
      negotiable = draft.negotiable
  where listing.listing_id = p_listing_id;
  return true;
end;
$$;

-- The states a seller sets (§9.7.8): publicado <-> reservado; publicado or
-- reservado -> completado or retirado; expirado -> publicado («Renovar»).
create function public.trade_set_listing_status(p_listing_id uuid, p_status text, p_device_id uuid default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_listing public.trade_listings;
  effective text;
  caller uuid;
begin
  if p_status is null or p_status not in ('publicado', 'reservado', 'completado', 'retirado') then
    raise exception 'status_invalid' using errcode = '22023';
  end if;

  select * into current_listing
  from public.trade_listings as listing
  where listing.listing_id = p_listing_id
  for update;

  effective := case
    when current_listing.status in ('publicado', 'reservado') and current_listing.expires_at <= now() then 'expirado'
    else current_listing.status::text
  end;

  caller := public.trade_authorize(
    case when effective = 'expirado' then 'renovar' else 'editar' end,
    coalesce(current_listing.fiat_currency is not null, false),
    p_device_id
  );

  if current_listing.listing_id is null or current_listing.seller_id is distinct from caller then
    raise exception 'listing_not_found' using errcode = '42501';
  end if;

  if not (
    (effective = 'publicado' and p_status in ('reservado', 'completado', 'retirado'))
    or (effective = 'reservado' and p_status in ('publicado', 'completado', 'retirado'))
    or (effective = 'expirado' and p_status = 'publicado')
  ) then
    raise exception 'status_transition_invalid' using errcode = '22023';
  end if;

  if effective = 'expirado' then
    perform public.trade_lock(caller::text);
    if public.trade_active_listings(caller) >= public.app_parameter_int('ANUNCIOS_ACTIVOS_MAX') then
      raise exception 'listing_limit' using errcode = '42501';
    end if;
    update public.trade_listings as listing
    set status = 'publicado',
        published_at = now(),
        expires_at = now() + make_interval(days => public.app_parameter_int('ANUNCIO_DIAS_VIGENCIA'))
    where listing.listing_id = p_listing_id;
  else
    update public.trade_listings as listing
    set status = p_status::public.trade_listing_status
    where listing.listing_id = p_listing_id;
  end if;

  return p_status;
end;
$$;

-- 15. Transactions (§9.10).

-- «Contactar al vendedor»: opens a transaction, or returns the open one.
create function public.trade_start_transaction(p_listing_id uuid, p_device_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  listing public.trade_listings;
  caller uuid;
  result_id uuid;
begin
  select * into listing from public.trade_listings as row_listing where row_listing.listing_id = p_listing_id;

  caller := public.trade_authorize('contactar', coalesce(listing.fiat_currency is not null, false), p_device_id);
  perform public.trade_lock(caller::text);

  if listing.listing_id is null then
    raise exception 'listing_unavailable' using errcode = '22023';
  end if;
  if listing.seller_id = caller then
    raise exception 'self_trade' using errcode = '22023';
  end if;
  if listing.status not in ('publicado', 'reservado')
     or listing.expires_at <= now()
     or not public.trade_account_visible(listing.seller_id)
     or not public.trade_is_eligible(listing.seller_id) then
    raise exception 'listing_unavailable' using errcode = '22023';
  end if;

  -- Expired transactions leave the open-transaction index.
  update public.trade_transactions as deal
  set status = 'caducada', closed_at = now()
  where deal.listing_id = p_listing_id
    and deal.buyer_id = caller
    and public.trade_transaction_state(deal.status, deal.updated_at) = 'caducada'
    and deal.status <> 'caducada';

  select deal.transaction_id into result_id
  from public.trade_transactions as deal
  where deal.listing_id = p_listing_id
    and deal.buyer_id = caller
    and deal.status in ('contacto', 'confirmada_vendedor', 'confirmada_comprador');

  if result_id is not null then
    return result_id;
  end if;

  if (
    select count(*)
    from public.trade_transactions as deal
    where deal.buyer_id = caller and deal.created_at > now() - interval '24 hours'
  ) >= public.app_parameter_int('OPERACIONES_NUEVAS_24H') then
    raise exception 'rate_limited' using errcode = '42501';
  end if;

  insert into public.trade_transactions (listing_id, seller_id, buyer_id, real_money)
  values (p_listing_id, listing.seller_id, caller, listing.fiat_currency is not null)
  returning transaction_id into result_id;

  perform public.trade_detect_device_flags(caller);
  return result_id;
end;
$$;

-- The transaction of a party, locked; 42501 when the caller is not one.
create function public.trade_party_transaction(p_transaction_id uuid, p_caller uuid)
returns public.trade_transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  deal public.trade_transactions;
begin
  select * into deal
  from public.trade_transactions as row_deal
  where row_deal.transaction_id = p_transaction_id
  for update;

  if deal.transaction_id is null or p_caller is null or p_caller not in (deal.seller_id, deal.buyer_id) then
    raise exception 'transaction_not_found' using errcode = '42501';
  end if;
  return deal;
end;
$$;

-- The real-money flag of a transaction before the gate (no party check yet).
create function public.trade_transaction_real_money(p_transaction_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select deal.real_money from public.trade_transactions as deal where deal.transaction_id = p_transaction_id),
    false
  );
$$;

-- Closes a transaction as confirmada: decides whether it admits reviews
-- (RESENAS_PAR_DIA per pair and 24 h) and checks pattern 4.
create function public.trade_close_confirmed(p_transaction_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  deal public.trade_transactions;
  pair_reviewable integer;
begin
  select * into deal from public.trade_transactions as row_deal where row_deal.transaction_id = p_transaction_id;
  perform public.trade_lock(least(deal.seller_id, deal.buyer_id)::text || greatest(deal.seller_id, deal.buyer_id)::text);

  select count(*)::integer into pair_reviewable
  from public.trade_transactions as other
  where other.status = 'confirmada'
    and other.reviewable
    and least(other.seller_id, other.buyer_id) = least(deal.seller_id, deal.buyer_id)
    and greatest(other.seller_id, other.buyer_id) = greatest(deal.seller_id, deal.buyer_id)
    and other.closed_at > now() - interval '24 hours';

  update public.trade_transactions as row_deal
  set status = 'confirmada',
      closed_at = now(),
      updated_at = now(),
      reviewable = pair_reviewable < public.app_parameter_int('RESENAS_PAR_DIA')
  where row_deal.transaction_id = p_transaction_id;

  perform public.trade_detect_pair_cap(deal.seller_id, deal.buyer_id);
end;
$$;

-- «Operación completada»: the second confirmation makes it confirmada.
create function public.trade_confirm_transaction(p_transaction_id uuid, p_device_id uuid default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := public.trade_authorize(
    'confirmar', public.trade_transaction_real_money(p_transaction_id), p_device_id
  );
  deal public.trade_transactions := public.trade_party_transaction(p_transaction_id, caller);
  is_seller boolean := caller = deal.seller_id;
  next_status text;
begin
  if public.trade_transaction_state(deal.status, deal.updated_at) = 'caducada' then
    raise exception 'transaction_expired' using errcode = '22023';
  end if;
  if deal.seller_id is null or deal.buyer_id is null then
    raise exception 'transaction_state_invalid' using errcode = '22023';
  end if;

  next_status := case
    when deal.status = 'contacto' and is_seller then 'confirmada_vendedor'
    when deal.status = 'contacto' then 'confirmada_comprador'
    when deal.status = 'confirmada_vendedor' and not is_seller then 'confirmada'
    when deal.status = 'confirmada_comprador' and is_seller then 'confirmada'
  end;

  if next_status is null then
    raise exception 'transaction_state_invalid' using errcode = '22023';
  end if;

  update public.trade_transactions as row_deal
  set seller_confirmed_at = case when is_seller then now() else row_deal.seller_confirmed_at end,
      buyer_confirmed_at = case when is_seller then row_deal.buyer_confirmed_at else now() end,
      status = case when next_status = 'confirmada' then row_deal.status else next_status::public.trade_transaction_status end,
      updated_at = now()
  where row_deal.transaction_id = p_transaction_id;

  if next_status = 'confirmada' then
    perform public.trade_close_confirmed(p_transaction_id);
  end if;

  perform public.trade_detect_device_flags(caller);
  return next_status;
end;
$$;

-- «Cancelar», before confirmada.
create function public.trade_cancel_transaction(p_transaction_id uuid, p_device_id uuid default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := public.trade_authorize(
    'cancelar', public.trade_transaction_real_money(p_transaction_id), p_device_id
  );
  deal public.trade_transactions := public.trade_party_transaction(p_transaction_id, caller);
begin
  if public.trade_transaction_state(deal.status, deal.updated_at) = 'caducada' then
    raise exception 'transaction_expired' using errcode = '22023';
  end if;
  if deal.status not in ('contacto', 'confirmada_vendedor', 'confirmada_comprador') then
    raise exception 'transaction_state_invalid' using errcode = '22023';
  end if;

  update public.trade_transactions as row_deal
  set status = 'cancelada', closed_at = now(), updated_at = now()
  where row_deal.transaction_id = p_transaction_id;

  perform public.trade_detect_device_flags(caller);
  return 'cancelada';
end;
$$;

-- «No se completó»: the party that did not confirm, once the other did. It
-- opens a moderation case and holds the evidence of both parties.
create function public.trade_dispute_transaction(
  p_transaction_id uuid,
  p_detail text default null,
  p_device_id uuid default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  detail_value text := public.trade_clean_text(p_detail, 1000, 'detail_invalid');
  caller uuid := public.trade_authorize(
    'disputar', public.trade_transaction_real_money(p_transaction_id), p_device_id
  );
  deal public.trade_transactions := public.trade_party_transaction(p_transaction_id, caller);
  report uuid;
begin
  if public.trade_transaction_state(deal.status, deal.updated_at) = 'caducada' then
    raise exception 'transaction_expired' using errcode = '22023';
  end if;
  if not (
    (deal.status = 'confirmada_vendedor' and caller = deal.buyer_id)
    or (deal.status = 'confirmada_comprador' and caller = deal.seller_id)
  ) then
    raise exception 'transaction_state_invalid' using errcode = '22023';
  end if;

  update public.trade_transactions as row_deal
  set status = 'disputada', updated_at = now()
  where row_deal.transaction_id = p_transaction_id;

  insert into public.trade_reports (reporter_id, target_type, target_id, transaction_id, reason, detail)
  values (caller, 'transaction', p_transaction_id, p_transaction_id, 'disputa', detail_value)
  on conflict do nothing
  returning report_id into report;

  if report is not null then
    perform public.trade_hold_evidence('report', report::text, array[deal.seller_id, deal.buyer_id]);
  end if;

  perform public.trade_detect_device_flags(caller);
  return 'disputada';
end;
$$;

-- The values of the other party's visible channels (§9.10), for a party of a
-- transaction that is not cancelled or expired.
create function public.trade_transaction_contacts(p_transaction_id uuid)
returns table (kind text, platform text, public_label text, value text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  reason text;
  deal public.trade_transactions;
  other uuid;
begin
  if caller is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  reason := public.trade_eligibility(caller);
  if reason is not null then
    raise exception '%', reason using errcode = '42501';
  end if;

  select * into deal from public.trade_transactions as row_deal where row_deal.transaction_id = p_transaction_id;
  if deal.transaction_id is null or caller not in (deal.seller_id, deal.buyer_id) then
    raise exception 'transaction_not_found' using errcode = '42501';
  end if;
  if public.trade_transaction_state(deal.status, deal.updated_at) in ('cancelada', 'caducada') then
    return;
  end if;

  other := case when caller = deal.seller_id then deal.buyer_id else deal.seller_id end;
  if other is null or not public.trade_account_visible(other) then
    return;
  end if;

  return query
  select channel.kind::text, channel.platform, channel.public_label, channel.value
  from public.trade_contact_channels as channel
  where channel.user_id = other
    and channel.shared
    and channel.verified_at is not null
  order by channel.kind, channel.created_at;
end;
$$;

-- «Operaciones»: the caller's transactions, newest first (at most 500).
create function public.trade_my_transactions()
returns table (
  transaction_id uuid,
  number bigint,
  role text,
  status text,
  listing_id uuid,
  asset_type text,
  asset jsonb,
  listing_public boolean,
  real_money boolean,
  counterpart_handle text,
  created_at timestamptz,
  updated_at timestamptz,
  confirmed_at timestamptz,
  review_id uuid,
  review_score smallint,
  review_comment text,
  review_created_at timestamptz,
  reviewable boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    deal.transaction_id,
    deal.number,
    case when deal.seller_id = (select auth.uid()) then 'seller' else 'buyer' end,
    public.trade_transaction_state(deal.status, deal.updated_at),
    deal.listing_id,
    listing.asset_type::text,
    listing.asset,
    coalesce(public.trade_listing_is_public(listing.status, listing.seller_id), false),
    deal.real_money,
    public.trade_handle(case when deal.seller_id = (select auth.uid()) then deal.buyer_id else deal.seller_id end),
    deal.created_at,
    deal.updated_at,
    case when deal.status = 'confirmada' then deal.closed_at end,
    own.review_id,
    own.score,
    own.comment,
    own.created_at,
    deal.status = 'confirmada'
      and deal.reviewable
      and own.review_id is null
      and deal.seller_id is not null
      and deal.buyer_id is not null
      and deal.closed_at > now() - make_interval(days => public.app_parameter_int('RESENA_DIAS'))
  from public.trade_transactions as deal
  left join public.trade_listings as listing on listing.listing_id = deal.listing_id
  left join public.trade_reviews as own
    on own.transaction_id = deal.transaction_id and own.reviewer_id = (select auth.uid())
  where (select auth.uid()) in (deal.seller_id, deal.buyer_id)
  order by deal.created_at desc
  limit 500;
$$;

-- 16. Reviews (§9.15.4).

create function public.trade_submit_review(
  p_transaction_id uuid,
  p_score integer,
  p_comment text default null,
  p_device_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid;
  deal public.trade_transactions;
  comment_value text;
  result_id uuid;
  reviewee uuid;
begin
  if p_score is null or p_score not between 1 and 5 then
    raise exception 'score_invalid' using errcode = '22023';
  end if;
  comment_value := public.trade_clean_text(p_comment, 1000, 'comment_invalid');

  caller := public.trade_authorize('resenar', public.trade_transaction_real_money(p_transaction_id), p_device_id);
  deal := public.trade_party_transaction(p_transaction_id, caller);

  if deal.status <> 'confirmada' then
    raise exception 'transaction_not_confirmed' using errcode = '42501';
  end if;
  if deal.seller_id is null or deal.buyer_id is null then
    raise exception 'counterpart_missing' using errcode = '22023';
  end if;
  if not deal.reviewable then
    raise exception 'review_cap_reached' using errcode = '42501';
  end if;
  if deal.closed_at <= now() - make_interval(days => public.app_parameter_int('RESENA_DIAS')) then
    raise exception 'review_window_closed' using errcode = '42501';
  end if;

  reviewee := case when caller = deal.seller_id then deal.buyer_id else deal.seller_id end;

  begin
    insert into public.trade_reviews (
      transaction_id, listing_id, reviewer_id, reviewee_id, reviewer_role, score, comment
    )
    values (
      p_transaction_id, deal.listing_id, caller, reviewee,
      case when caller = deal.seller_id then 'seller' else 'buyer' end,
      p_score, comment_value
    )
    returning review_id into result_id;
  exception
    when unique_violation then
      raise exception 'review_exists' using errcode = '23505';
  end;

  perform public.trade_detect_new_account_reviews(reviewee);
  perform public.trade_detect_device_flags(caller);
  return result_id;
end;
$$;

-- The author edits for RESENA_EDICION_DIAS; the previous version is kept.
create function public.trade_update_review(p_review_id uuid, p_score integer, p_comment text default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  reason text;
  review public.trade_reviews;
  comment_value text;
begin
  if caller is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  reason := public.trade_eligibility(caller);
  if reason is not null then
    raise exception '%', reason using errcode = '42501';
  end if;
  if p_score is null or p_score not between 1 and 5 then
    raise exception 'score_invalid' using errcode = '22023';
  end if;
  comment_value := public.trade_clean_text(p_comment, 1000, 'comment_invalid');

  select * into review from public.trade_reviews as row_review where row_review.review_id = p_review_id for update;
  if review.review_id is null or review.reviewer_id is distinct from caller then
    raise exception 'review_not_found' using errcode = '42501';
  end if;
  if review.hidden then
    raise exception 'review_hidden' using errcode = '42501';
  end if;
  if review.created_at <= now() - make_interval(days => public.app_parameter_int('RESENA_EDICION_DIAS')) then
    raise exception 'review_edit_closed' using errcode = '42501';
  end if;

  insert into public.trade_review_revisions (review_id, score, comment)
  values (review.review_id, review.score, review.comment);

  update public.trade_reviews as row_review
  set score = p_score, comment = comment_value, updated_at = now()
  where row_review.review_id = p_review_id;
  return true;
end;
$$;

-- «Mi perfil»: the reviews the caller received (hidden ones included) or gave.
create function public.trade_my_reviews(p_direction text, p_limit integer default 10, p_offset integer default 0)
returns table (
  review_id uuid,
  transaction_id uuid,
  transaction_number bigint,
  role text,
  score smallint,
  comment text,
  created_at timestamptz,
  updated_at timestamptz,
  counterpart_handle text,
  editable boolean,
  hidden boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
begin
  if caller is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if p_direction is null or p_direction not in ('received', 'given') then
    raise exception 'direction_invalid' using errcode = '22023';
  end if;

  return query
  select
    review.review_id,
    review.transaction_id,
    deal.number,
    case when deal.seller_id = caller then 'seller' else 'buyer' end,
    review.score,
    review.comment,
    review.created_at,
    case when review.updated_at > review.created_at then review.updated_at end,
    public.trade_handle(case when p_direction = 'given' then review.reviewee_id else review.reviewer_id end),
    p_direction = 'given'
      and not review.hidden
      and review.created_at > now() - make_interval(days => public.app_parameter_int('RESENA_EDICION_DIAS')),
    review.hidden
  from public.trade_reviews as review
  join public.trade_transactions as deal on deal.transaction_id = review.transaction_id
  where (p_direction = 'given' and review.reviewer_id = caller)
     or (p_direction = 'received' and review.reviewee_id = caller)
  order by review.created_at desc, review.review_id
  limit least(greatest(coalesce(p_limit, 10), 1), 51)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

-- 17. Reports (§9.11, §9.15.5): one per account and target, REPORTES_24H a
--     day; a scam report may name a transaction of the reporter.
create function public.trade_report(
  p_target_type text,
  p_target_id uuid,
  p_reason text,
  p_detail text default null,
  p_transaction_number bigint default null,
  p_device_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  detail_value text := public.trade_clean_text(p_detail, 1000, 'detail_invalid');
  caller uuid;
  owner uuid;
  deal public.trade_transactions;
  result_id uuid;
begin
  if p_target_type is null or p_target_type not in ('listing', 'seller', 'review') then
    raise exception 'target_invalid' using errcode = '22023';
  end if;
  if p_reason is null or p_reason not in ('estafa', 'datos_personales', 'ofensivo', 'falso', 'otro') then
    raise exception 'reason_invalid' using errcode = '22023';
  end if;
  if p_reason = 'otro' and detail_value is null then
    raise exception 'detail_required' using errcode = '22023';
  end if;

  caller := public.trade_authorize('reportar', false, p_device_id);
  perform public.trade_lock(caller::text);

  owner := case p_target_type
    when 'listing' then (select listing.seller_id from public.trade_listings as listing where listing.listing_id = p_target_id)
    when 'seller' then (select profile.user_id from public.account_profiles as profile where profile.user_id = p_target_id and profile.username is not null)
    when 'review' then (select review.reviewer_id from public.trade_reviews as review where review.review_id = p_target_id)
  end;
  if owner is null then
    raise exception 'target_not_found' using errcode = '22023';
  end if;
  if owner = caller then
    raise exception 'self_report' using errcode = '22023';
  end if;

  if p_transaction_number is not null then
    select * into deal from public.trade_transactions as row_deal where row_deal.number = p_transaction_number;
    if deal.transaction_id is null or caller not in (deal.seller_id, deal.buyer_id) then
      raise exception 'transaction_invalid' using errcode = '22023';
    end if;
  end if;

  if (
    select count(*)
    from public.trade_reports as report
    where report.reporter_id = caller and report.created_at > now() - interval '24 hours'
  ) >= public.app_parameter_int('REPORTES_24H') then
    raise exception 'rate_limited' using errcode = '42501';
  end if;

  begin
    insert into public.trade_reports (reporter_id, target_type, target_id, transaction_id, reason, detail)
    values (
      caller, p_target_type::public.trade_report_target, p_target_id, deal.transaction_id,
      p_reason::public.trade_report_reason, detail_value
    )
    returning report_id into result_id;
  exception
    when unique_violation then
      raise exception 'already_reported' using errcode = '23505';
  end;

  perform public.trade_hold_evidence(
    'report', result_id::text, array[caller, owner, deal.seller_id, deal.buyer_id]
  );
  perform public.trade_detect_device_flags(caller);
  return result_id;
end;
$$;

-- 18. Moderation (§9.11, §9.15.5). Each function checks trade_moderators.

create function public.trade_require_moderator()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
begin
  if caller is null or not public.trade_is_moderator(caller) then
    raise exception 'moderator_required' using errcode = '42501';
  end if;
  return caller;
end;
$$;

-- p_status: 'open' or 'closed' (resolved and dismissed).
create function public.trade_moderation_reports(p_status text)
returns table (
  report_id uuid,
  created_at timestamptz,
  target_type text,
  target_id uuid,
  owner_id uuid,
  owner_handle text,
  owner_suspended_until timestamptz,
  reviewed_handle text,
  hidden boolean,
  listing_public boolean,
  reason text,
  detail text,
  transaction_number bigint,
  open_count integer,
  status text,
  reporter_handle text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.trade_require_moderator();
  if p_status is null or p_status not in ('open', 'closed') then
    raise exception 'status_invalid' using errcode = '22023';
  end if;

  return query
  with cases as (
    select
      report.*,
      case report.target_type
        when 'listing' then listing.seller_id
        when 'seller' then report.target_id
        when 'review' then review.reviewer_id
        when 'transaction' then
          case when deal.seller_id = report.reporter_id then deal.buyer_id else deal.seller_id end
      end as owner,
      listing.status as listing_status,
      listing.seller_id as listing_seller,
      review.hidden as review_hidden,
      review.reviewee_id as review_reviewee
    from public.trade_reports as report
    left join public.trade_listings as listing
      on report.target_type = 'listing' and listing.listing_id = report.target_id
    left join public.trade_reviews as review
      on report.target_type = 'review' and review.review_id = report.target_id
    left join public.trade_transactions as deal
      on deal.transaction_id = report.transaction_id
    where (p_status = 'open' and report.status = 'open')
       or (p_status = 'closed' and report.status <> 'open')
  )
  select
    cases.report_id,
    cases.created_at,
    cases.target_type::text,
    cases.target_id,
    cases.owner,
    profile.username,
    profile.trade_suspended_until,
    public.trade_handle(cases.review_reviewee),
    coalesce(cases.review_hidden, false),
    coalesce(public.trade_listing_is_public(cases.listing_status, cases.listing_seller), false),
    cases.reason::text,
    cases.detail,
    (select deal.number from public.trade_transactions as deal where deal.transaction_id = cases.transaction_id),
    (
      select count(*)::integer
      from public.trade_reports as same
      where same.target_type = cases.target_type and same.target_id = cases.target_id and same.status = 'open'
    ),
    cases.status::text,
    public.trade_handle(cases.reporter_id)
  from cases
  left join public.account_profiles as profile on profile.user_id = cases.owner
  order by cases.created_at desc
  limit 500;
end;
$$;

-- The open alerts, with their evidence in words (accounts, device, dates,
-- transactions).
create function public.trade_moderation_flags()
returns table (
  flag_id uuid,
  kind text,
  created_at timestamptz,
  accounts jsonb,
  device_id uuid,
  transaction_numbers bigint[],
  first_at timestamptz,
  last_at timestamptz,
  count integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.trade_require_moderator();

  return query
  select
    flag.flag_id,
    flag.kind::text,
    flag.created_at,
    (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', member.user_id,
            'handle', profile.username,
            'suspended_until', profile.trade_suspended_until
          )
          order by member.position
        ),
        '[]'::jsonb
      )
      from unnest(flag.user_ids) with ordinality as member (user_id, position)
      left join public.account_profiles as profile on profile.user_id = member.user_id
    ),
    flag.device_id,
    (
      select coalesce(array_agg(deal.number order by deal.number), array[]::bigint[])
      from public.trade_transactions as deal
      where deal.transaction_id = any (flag.transaction_ids)
    ),
    flag.first_at,
    flag.last_at,
    flag.event_count
  from public.trade_flags as flag
  where flag.status = 'open'
  order by flag.created_at desc
  limit 500;
end;
$$;

create function public.trade_pending_channels()
returns table (
  channel_id uuid,
  created_at timestamptz,
  handle text,
  platform text,
  value text,
  code text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.trade_require_moderator();

  return query
  select
    channel.channel_id,
    channel.updated_at,
    public.trade_handle(channel.user_id),
    channel.platform,
    channel.value,
    channel.verification_code
  from public.trade_contact_channels as channel
  where channel.kind = 'other'
    and channel.verified_at is null
    and channel.verification_code is not null
  order by channel.updated_at
  limit 500;
end;
$$;

-- Approves a pending «Otra plataforma» channel, or rejects its code (the
-- account may ask for a new one).
create function public.trade_verify_channel(p_channel_id uuid, p_approve boolean, p_reason text default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := public.trade_require_moderator();
  reason_value text := public.trade_clean_text(p_reason, 1000, 'reason_invalid');
begin
  if p_approve is null then
    raise exception 'channel_invalid' using errcode = '22023';
  end if;

  update public.trade_contact_channels as channel
  set verified_at = case when p_approve then now() end,
      verification_code = case when p_approve then channel.verification_code end,
      updated_at = now()
  where channel.channel_id = p_channel_id
    and channel.kind = 'other'
    and channel.verified_at is null
    and channel.verification_code is not null;

  if not found then
    raise exception 'channel_not_found' using errcode = '22023';
  end if;

  insert into public.trade_moderation_events (moderator_id, action, target_type, target_id, reason)
  values (
    caller,
    case when p_approve then 'verify_channel' else 'reject_channel' end::public.trade_moderation_action,
    'channel',
    p_channel_id,
    coalesce(reason_value, case when p_approve then 'channel_approved' else 'channel_rejected' end)
  );
  return true;
end;
$$;

-- Every moderation action (§9.11, §9.15.5), with a mandatory reason written to
-- trade_moderation_events. p_report_id closes every open report on the same
-- target; p_flag_id closes the alert; both release their held evidence.
--   dismiss                       (a report or an alert)
--   withdraw_listing              target listing
--   hide_review / restore_review  target review
--   warn                          target seller or user
--   suspend                       target seller or user; p_until null = ban
--   lift_suspension               target seller or user
--   resolve_confirm / _cancel     target transaction (disputada)
create function public.trade_moderate(
  p_action text,
  p_target_type text,
  p_target_id uuid,
  p_reason text,
  p_until timestamptz default null,
  p_report_id uuid default null,
  p_flag_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := public.trade_require_moderator();
  reason_value text := public.trade_clean_text(p_reason, 1000, 'reason_invalid');
  action_value public.trade_moderation_action;
  report public.trade_reports;
  closed record;
begin
  if reason_value is null then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  if p_action is null
     or p_action not in (
       'dismiss', 'withdraw_listing', 'hide_review', 'restore_review', 'warn', 'suspend', 'lift_suspension',
       'resolve_confirm', 'resolve_cancel'
     ) then
    raise exception 'action_invalid' using errcode = '22023';
  end if;
  action_value := p_action::public.trade_moderation_action;
  if p_target_id is null
     or p_target_type is null
     or p_target_type not in ('listing', 'seller', 'user', 'review', 'transaction', 'flag') then
    raise exception 'target_invalid' using errcode = '22023';
  end if;

  if action_value = 'dismiss' and p_report_id is null and p_flag_id is null then
    raise exception 'case_required' using errcode = '22023';
  end if;

  if action_value = 'withdraw_listing' then
    if p_target_type <> 'listing' then
      raise exception 'target_invalid' using errcode = '22023';
    end if;
    update public.trade_listings as listing
    set status = 'retirado', moderation_note = reason_value
    where listing.listing_id = p_target_id;
    if not found then
      raise exception 'target_not_found' using errcode = '22023';
    end if;

  elsif action_value in ('hide_review', 'restore_review') then
    if p_target_type <> 'review' then
      raise exception 'target_invalid' using errcode = '22023';
    end if;
    update public.trade_reviews as review
    set hidden = action_value = 'hide_review'
    where review.review_id = p_target_id;
    if not found then
      raise exception 'target_not_found' using errcode = '22023';
    end if;

  elsif action_value in ('warn', 'suspend', 'lift_suspension') then
    if p_target_type not in ('seller', 'user') then
      raise exception 'target_invalid' using errcode = '22023';
    end if;
    if p_target_id = caller then
      raise exception 'self_moderation' using errcode = '42501';
    end if;
    if not exists (select 1 from auth.users as account where account.id = p_target_id) then
      raise exception 'target_not_found' using errcode = '22023';
    end if;

    if action_value = 'suspend' then
      if p_until is not null and p_until <= now() then
        raise exception 'suspension_until_invalid' using errcode = '22023';
      end if;
      perform public.trade_suspend_account(p_target_id, p_until);
      -- A ban withdraws the listings (§9.15.5); a temporary suspension hides them.
      if p_until is null then
        update public.trade_listings as listing
        set status = 'retirado', moderation_note = reason_value
        where listing.seller_id = p_target_id
          and listing.status in ('publicado', 'reservado');
      end if;
    elsif action_value = 'lift_suspension' then
      perform public.trade_lift_suspension(p_target_id);
    end if;

  elsif action_value in ('resolve_confirm', 'resolve_cancel') then
    if p_target_type <> 'transaction' then
      raise exception 'target_invalid' using errcode = '22023';
    end if;
    perform 1
    from public.trade_transactions as deal
    where deal.transaction_id = p_target_id and deal.status = 'disputada'
    for update;
    if not found then
      raise exception 'transaction_state_invalid' using errcode = '22023';
    end if;
    if action_value = 'resolve_confirm' then
      perform public.trade_close_confirmed(p_target_id);
    else
      update public.trade_transactions as deal
      set status = 'cancelada', closed_at = now(), updated_at = now()
      where deal.transaction_id = p_target_id;
    end if;
  end if;

  insert into public.trade_moderation_events (
    moderator_id, action, target_type, target_id, reason, until, report_id, flag_id
  )
  values (
    caller, action_value, p_target_type, p_target_id, reason_value,
    case when action_value = 'suspend' then coalesce(p_until, 'infinity'::timestamptz) end,
    p_report_id, p_flag_id
  );

  if p_report_id is not null then
    select * into report from public.trade_reports as row_report where row_report.report_id = p_report_id;
    if report.report_id is null then
      raise exception 'report_not_found' using errcode = '22023';
    end if;
    for closed in
      update public.trade_reports as row_report
      set status = case when action_value = 'dismiss' then 'dismissed' else 'resolved' end::public.trade_case_status,
          resolved_by = caller,
          resolved_at = now()
      where row_report.status = 'open'
        and row_report.target_type = report.target_type
        and row_report.target_id = report.target_id
      returning row_report.report_id
    loop
      perform public.trade_release_evidence('report', closed.report_id::text);
    end loop;
  end if;

  if p_flag_id is not null then
    update public.trade_flags as flag
    set status = case when action_value = 'dismiss' then 'dismissed' else 'resolved' end::public.trade_case_status,
        resolved_by = caller,
        resolved_at = now(),
        updated_at = now()
    where flag.flag_id = p_flag_id
      and flag.status = 'open';
    if not found then
      raise exception 'flag_not_found' using errcode = '22023';
    end if;
    perform public.trade_release_evidence('flag', p_flag_id::text);
  end if;

  return true;
end;
$$;

-- 19. Row level security and privileges (§9.12.2). The platform's default
--     privileges grant everything to anon and authenticated, so every table
--     starts from nothing.
alter table public.trade_moderators enable row level security;
alter table public.trade_contact_channels enable row level security;
alter table public.trade_listings enable row level security;
alter table public.trade_transactions enable row level security;
alter table public.trade_reviews enable row level security;
alter table public.trade_review_revisions enable row level security;
alter table public.trade_reports enable row level security;
alter table public.trade_moderation_events enable row level security;
alter table public.trade_flags enable row level security;

revoke all on table
  public.trade_moderators,
  public.trade_contact_channels,
  public.trade_listings,
  public.trade_transactions,
  public.trade_reviews,
  public.trade_review_revisions,
  public.trade_reports,
  public.trade_moderation_events,
  public.trade_flags
from anon, authenticated;

revoke all on sequence public.trade_transaction_number_seq from anon, authenticated;

-- Listings: the public states of visible sellers; the seller all of its own;
-- moderators everything.
grant select on table public.trade_listings to anon, authenticated;

create policy trade_listings_select_anon on public.trade_listings
  for select
  to anon
  using (public.trade_listing_is_public(status, seller_id));

create policy trade_listings_select_authenticated on public.trade_listings
  for select
  to authenticated
  using (
    public.trade_listing_is_public(status, seller_id)
    or seller_id = (select auth.uid())
    or (select public.account_is_moderator())
  );

-- Channels: only the public columns, for verified and shared channels of
-- visible accounts. The value is never selectable (column privilege).
grant select (channel_id, user_id, kind, platform, public_label) on table public.trade_contact_channels
  to anon, authenticated;

create policy trade_contact_channels_select_anon on public.trade_contact_channels
  for select
  to anon
  using (shared and verified_at is not null and public.trade_account_visible(user_id));

create policy trade_contact_channels_select_authenticated on public.trade_contact_channels
  for select
  to authenticated
  using (
    (shared and verified_at is not null and public.trade_account_visible(user_id))
    or user_id = (select auth.uid())
    or (select public.account_is_moderator())
  );

-- Transactions: the parties and moderators.
grant select on table public.trade_transactions to authenticated;

create policy trade_transactions_select_party on public.trade_transactions
  for select
  to authenticated
  using (
    (select auth.uid()) in (seller_id, buyer_id)
    or (select public.account_is_moderator())
  );

-- Reviews: author, reviewed account (hidden ones included) and moderators. The
-- public reads trade_public_reviews and trade_seller_stats.
grant select on table public.trade_reviews to authenticated;

create policy trade_reviews_select_involved on public.trade_reviews
  for select
  to authenticated
  using (
    (select auth.uid()) in (reviewer_id, reviewee_id)
    or (select public.account_is_moderator())
  );

grant select on table public.trade_review_revisions to authenticated;

create policy trade_review_revisions_select_moderators on public.trade_review_revisions
  for select
  to authenticated
  using ((select public.account_is_moderator()));

-- Reports: the reporter and moderators.
grant select on table public.trade_reports to authenticated;

create policy trade_reports_select_involved on public.trade_reports
  for select
  to authenticated
  using (
    reporter_id = (select auth.uid())
    or (select public.account_is_moderator())
  );

grant select on table public.trade_moderation_events to authenticated;

create policy trade_moderation_events_select_moderators on public.trade_moderation_events
  for select
  to authenticated
  using ((select public.account_is_moderator()));

grant select on table public.trade_flags to authenticated;

create policy trade_flags_select_moderators on public.trade_flags
  for select
  to authenticated
  using ((select public.account_is_moderator()));

-- Functions: nothing for the API roles unless granted below.
do $$
declare
  routine regprocedure;
begin
  for routine in
    select procedure.oid::regprocedure
    from pg_catalog.pg_proc as procedure
    where procedure.pronamespace = 'public'::regnamespace
      and procedure.proname in (
        'trade_json_absent', 'trade_json_int', 'trade_json_name', 'trade_json_id', 'trade_json_percent',
        'trade_json_keys_within', 'trade_clean_text', 'trade_asset_problem', 'trade_price_problem',
        'trade_listing_search_text', 'trade_is_moderator', 'trade_account_visible', 'trade_handle',
        'trade_listings_prepare', 'trade_listing_is_public', 'trade_transaction_state',
        'trade_moderation_events_append_only', 'trade_flag_upsert', 'trade_detect_device_flags',
        'trade_detect_new_account_reviews', 'trade_detect_pair_cap', 'trade_lock', 'trade_public_profile',
        'trade_public_profiles', 'trade_reputation', 'trade_seller_stats', 'trade_buyer_stats',
        'trade_public_reviews', 'trade_put_verified_channel', 'trade_sync_oauth_channels', 'trade_my_channels',
        'trade_upsert_channel', 'trade_delete_channel', 'trade_request_channel_code',
        'trade_listing_from_payload', 'trade_active_listings', 'trade_publish_listing', 'trade_update_listing',
        'trade_set_listing_status', 'trade_start_transaction', 'trade_party_transaction',
        'trade_transaction_real_money', 'trade_close_confirmed', 'trade_confirm_transaction',
        'trade_cancel_transaction', 'trade_dispute_transaction', 'trade_transaction_contacts',
        'trade_my_transactions', 'trade_submit_review', 'trade_update_review', 'trade_my_reviews',
        'trade_report', 'trade_require_moderator', 'trade_moderation_reports', 'trade_moderation_flags',
        'trade_pending_channels', 'trade_verify_channel', 'trade_moderate'
      )
  loop
    execute format('revoke all on function %s from public, anon, authenticated', routine);
  end loop;
end;
$$;

-- Public reads, and the visibility helper the RLS policies call.
grant execute on function public.trade_account_visible(uuid) to anon, authenticated;
grant execute on function public.trade_listing_is_public(public.trade_listing_status, uuid) to anon, authenticated;
grant execute on function public.trade_public_profile(text) to anon, authenticated;
grant execute on function public.trade_public_profiles(uuid[]) to anon, authenticated;
grant execute on function public.trade_seller_stats(uuid) to anon, authenticated;
grant execute on function public.trade_buyer_stats(uuid) to anon, authenticated;
grant execute on function public.trade_public_reviews(uuid, integer, integer) to anon, authenticated;

-- The account's own actions.
grant execute on function public.trade_sync_oauth_channels() to authenticated;
grant execute on function public.trade_my_channels() to authenticated;
grant execute on function public.trade_upsert_channel(text, text, text, boolean) to authenticated;
grant execute on function public.trade_delete_channel(uuid) to authenticated;
grant execute on function public.trade_request_channel_code(uuid) to authenticated;
grant execute on function public.trade_publish_listing(jsonb, uuid) to authenticated;
grant execute on function public.trade_update_listing(uuid, jsonb, uuid) to authenticated;
grant execute on function public.trade_set_listing_status(uuid, text, uuid) to authenticated;
grant execute on function public.trade_start_transaction(uuid, uuid) to authenticated;
grant execute on function public.trade_confirm_transaction(uuid, uuid) to authenticated;
grant execute on function public.trade_cancel_transaction(uuid, uuid) to authenticated;
grant execute on function public.trade_dispute_transaction(uuid, text, uuid) to authenticated;
grant execute on function public.trade_transaction_contacts(uuid) to authenticated;
grant execute on function public.trade_my_transactions() to authenticated;
grant execute on function public.trade_submit_review(uuid, integer, text, uuid) to authenticated;
grant execute on function public.trade_update_review(uuid, integer, text) to authenticated;
grant execute on function public.trade_my_reviews(text, integer, integer) to authenticated;
grant execute on function public.trade_report(text, uuid, text, text, bigint, uuid) to authenticated;

-- Moderation (each checks trade_moderators).
grant execute on function public.trade_moderation_reports(text) to authenticated;
grant execute on function public.trade_moderation_flags() to authenticated;
grant execute on function public.trade_pending_channels() to authenticated;
grant execute on function public.trade_verify_channel(uuid, boolean, text) to authenticated;
grant execute on function public.trade_moderate(text, text, uuid, text, timestamptz, uuid, uuid) to authenticated;
