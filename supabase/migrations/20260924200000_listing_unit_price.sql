-- Alliance Codex — Comercio: price per unit and the buyer's world (owner rules
-- of 2026-09-24).
--
-- Local only: it is never applied to the remote project from the repository
-- (OG-1); the owner applies it. It runs after 20260924190000_account_characters.sql
-- and never rewrites an earlier migration: the functions it changes are
-- replaced with create or replace, which keeps their privileges.
--
-- 1. Price per unit. A listing with a quantity (Items, Diamonds, Pokédólares)
--    may be priced per unit, with the unit its seller chooses: 50kk of
--    Pokédólares at MX$ 1.80 per 1kk, 120 Diamonds at 300k Pokédólares per 10.
--    The payload of trade_publish_listing and trade_update_listing takes
--    «unit_quantity» (the unit, in the base units of the asset: 1000000 for
--    1kk); with it, «fiat_amount» and each «game_prices» amount are the price
--    of one unit. The listing keeps what the seller wrote (unit_quantity,
--    unit_fiat_amount, unit_game_prices) and the totals the database computes
--    from it in the columns every reader already uses (fiat_amount,
--    game_prices), so the order by price, the price filter and a deal read the
--    total as before. The total of each part is
--        round(unit price × quantity / unit)
--    half up, to the cent for real money and to a whole unit in the game
--    (trade_unit_total; src/lib/trade/unit-price.ts computes the same). A
--    change of the quantity (sold 60 of 120 Diamonds: «Editar», 60) recomputes
--    the totals. Without «unit_quantity» the price is the total, as before.
--
-- 2. «Vendes como» is required. The composer and this migration ship together:
--    trade_publish_listing and trade_update_listing take «character_id» for
--    every type, Pokédólares included (22023 character_required without it);
--    the fallback of 20260924190000_account_characters.sql to a character of
--    the payload's world is no longer reached. Pokédólares still sell to every
--    world (the interface lists them under every «Mundo»).
--
-- 3. The buyer's world. Pokémon, Items and Diamonds trade only inside the world
--    of the seller's character: «Contactar al vendedor» (trade_start_transaction)
--    needs a character of the buyer in the listing's world (42501
--    buyer_world_required, which the interface translates and links to «Añadir
--    personaje»). Pokédólares sell to every world: any character of the buyer
--    will do.
--
-- Errors keep the model of 20260923150200_trade_marketplace.sql: 42501
-- (permission) or 22023 (value) with a fixed message.

-- 1. The columns. The functions below are the only writers, and they keep the
--    totals in step with the unit price; the check keeps the shape.
alter table public.trade_listings
  add column unit_quantity bigint check (unit_quantity between 1 and 999999999999999),
  add column unit_fiat_amount numeric(12, 2) check (unit_fiat_amount > 0),
  add column unit_game_prices jsonb;

alter table public.trade_listings
  add constraint trade_listings_unit_price_shape check (
    (unit_quantity is null and unit_fiat_amount is null and unit_game_prices is null)
    or (
      unit_quantity is not null
      and asset_type <> 'pokemon'
      and not negotiable
      and jsonb_typeof(unit_game_prices) = 'array'
      and (unit_fiat_amount is null) = (fiat_amount is null)
      and jsonb_array_length(unit_game_prices) = jsonb_array_length(game_prices)
    )
  );

-- The total of a price per unit: round(p_unit_price × p_quantity / p_unit),
-- half up, with p_scale decimals (2 for real money, 0 in the game).
create function public.trade_unit_total(p_unit_price numeric, p_quantity numeric, p_unit numeric, p_scale integer)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select round(p_unit_price * p_quantity / p_unit, p_scale);
$$;

-- 2. The listing a payload describes: 20260924190000_account_characters.sql
--    plus «unit_quantity».
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
  quantity numeric;
  option jsonb;
  total numeric;
  totals jsonb := '[]'::jsonb;
begin
  if p_listing is null
     or not public.trade_json_keys_within(
       p_listing,
       array[
         'character_id', 'asset_type', 'world_key', 'asset', 'fiat_currency', 'fiat_amount', 'game_prices',
         'negotiable', 'unit_quantity'
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

  -- A price per unit: the amounts written are the unit's; the totals are computed.
  if not public.trade_json_absent(p_listing -> 'unit_quantity') then
    if draft.asset_type = 'pokemon'
       or draft.negotiable
       or not public.trade_json_int(p_listing -> 'unit_quantity', 1, 999999999999999)
       or jsonb_typeof(draft.game_prices) is distinct from 'array' then
      raise exception 'price_invalid' using errcode = '22023';
    end if;
    draft.unit_quantity := (p_listing ->> 'unit_quantity')::bigint;
    quantity := (draft.asset ->> 'cantidad')::numeric;

    -- The unit amounts follow the rules of any price (types, repeats, bounds).
    problem := public.trade_price_problem(
      draft.asset_type, draft.fiat_currency, draft.fiat_amount, draft.game_prices, false
    );
    if problem is not null then
      raise exception '%', problem using errcode = '22023';
    end if;

    draft.unit_fiat_amount := draft.fiat_amount;
    draft.unit_game_prices := draft.game_prices;

    if draft.unit_fiat_amount is not null then
      total := public.trade_unit_total(draft.unit_fiat_amount, quantity, draft.unit_quantity, 2);
      if total <= 0 or total > 9999999999.99 then
        raise exception 'price_invalid' using errcode = '22023';
      end if;
      draft.fiat_amount := total;
    end if;

    for option in select game.value from jsonb_array_elements(draft.unit_game_prices) as game loop
      total := public.trade_unit_total((option ->> 'cantidad')::numeric, quantity, draft.unit_quantity, 0);
      if total < 1 or total > 999999999999999 then
        raise exception 'price_invalid' using errcode = '22023';
      end if;
      totals := totals || jsonb_build_array(jsonb_build_object('tipo', option ->> 'tipo', 'cantidad', total));
    end loop;
    draft.game_prices := totals;
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

-- 3. «Publicar» (§9.7.8): 20260924190000_account_characters.sql plus the unit price.
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

  -- «Vendes como» is required for every type (Pokédólares included).
  if draft.character_id is null then
    raise exception 'character_required' using errcode = '22023';
  end if;
  chosen := public.trade_resolve_character(caller, draft.character_id, draft.world_key, draft.asset_type);

  insert into public.trade_listings (
    seller_id, character_id, asset_type, world_key, asset, fiat_currency, fiat_amount, game_prices, negotiable,
    unit_quantity, unit_fiat_amount, unit_game_prices, published_at, expires_at
  )
  values (
    caller, chosen.id, draft.asset_type, chosen.world_key, draft.asset, draft.fiat_currency, draft.fiat_amount,
    draft.game_prices, draft.negotiable, draft.unit_quantity, draft.unit_fiat_amount, draft.unit_game_prices,
    now(), now() + make_interval(days => public.app_parameter_int('ANUNCIO_DIAS_VIGENCIA'))
  )
  returning listing_id into result_id;

  perform public.trade_detect_device_flags(caller);
  return result_id;
end;
$$;

-- 4. «Editar»: 20260924190000_account_characters.sql plus the unit price. The
--    seller edits a published or reserved listing at any time, the quantity
--    included; a price per unit gives new totals.
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

  if draft.character_id is null then
    raise exception 'character_required' using errcode = '22023';
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
      negotiable = draft.negotiable,
      unit_quantity = draft.unit_quantity,
      unit_fiat_amount = draft.unit_fiat_amount,
      unit_game_prices = draft.unit_game_prices
  where listing.listing_id = p_listing_id;
  return true;
end;
$$;

-- 5. «Contactar al vendedor» (§9.10): 20260923150200_trade_marketplace.sql plus
--    the buyer's world. An open deal is returned as before, whatever the
--    buyer's characters are now.
create or replace function public.trade_start_transaction(p_listing_id uuid, p_device_id uuid default null)
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

  -- The buyer receives in the game: a character in the listing's world, or any
  -- character for Pokédólares.
  if not exists (
    select 1
    from public.account_characters as owned
    where owned.user_id = caller
      and (listing.asset_type = 'pokedolares' or owned.world_key = listing.world_key)
  ) then
    raise exception 'buyer_world_required' using errcode = '42501';
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

revoke all on function public.trade_unit_total(numeric, numeric, numeric, integer) from public, anon, authenticated;

notify pgrst, 'reload schema';
