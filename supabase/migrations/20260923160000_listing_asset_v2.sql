-- Comercio: the asset of a listing in the shape of §16.2.5 (M17).
--
-- Every piece of equipment of a Pokémon is now a registry id chosen in a picker (ball, auras[],
-- addons[], heldX, heldY, mega), and a traded item is { item, cantidad } without a declared name.
-- This replaces the asset validation of 20260923150200_trade_marketplace.sql, which is never
-- rewritten. The check constraint trade_listings_asset_valid calls the function by name, so new
-- and updated rows follow the new shape; rows written before keep loading (R2 is only for them).
-- The search text reads the ids of the new shape.

-- A JSON array of 0 to p_max distinct ids.
create or replace function public.trade_json_id_set(p_value jsonb, p_max integer)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(p_value) is distinct from 'array' or jsonb_array_length(p_value) > p_max then false
    else not exists (
        select 1 from jsonb_array_elements(p_value) as entry where not public.trade_json_id(entry.value)
      )
      and (select count(distinct entry.value) from jsonb_array_elements(p_value) as entry)
        = jsonb_array_length(p_value)
  end;
$$;

create or replace function public.trade_asset_problem(p_type public.trade_asset_type, p_asset jsonb)
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
    if not public.trade_json_keys_within(p_asset, array['item', 'cantidad'])
       or not public.trade_json_id(p_asset -> 'item')
       or not public.trade_json_int(p_asset -> 'cantidad', 1, count_max) then
      return 'asset_invalid';
    end if;
    return null;
  end if;

  -- pokemon
  if not public.trade_json_keys_within(
       p_asset,
       array[
         'pokemon', 'ball', 'auras', 'addons', 'heldX', 'heldY', 'mega', 'boost', 'starLevel', 'nickname',
         'memorySlots', 'memorias', 'nextBoostChance', 'entrenamiento', 'precioNpc'
       ]
     )
     or not public.trade_json_id(p_asset -> 'pokemon')
     or not (public.trade_json_absent(p_asset -> 'ball') or public.trade_json_id(p_asset -> 'ball'))
     or not (public.trade_json_absent(p_asset -> 'heldX') or public.trade_json_id(p_asset -> 'heldX'))
     or not (public.trade_json_absent(p_asset -> 'heldY') or public.trade_json_id(p_asset -> 'heldY'))
     or not (public.trade_json_absent(p_asset -> 'mega') or public.trade_json_id(p_asset -> 'mega'))
     or not (public.trade_json_absent(p_asset -> 'auras') or public.trade_json_id_set(p_asset -> 'auras', 32))
     or not (public.trade_json_absent(p_asset -> 'addons') or public.trade_json_id_set(p_asset -> 'addons', 32))
     or not (public.trade_json_absent(p_asset -> 'boost') or public.trade_json_int(p_asset -> 'boost', 0, 50))
     or not (public.trade_json_absent(p_asset -> 'starLevel') or public.trade_json_int(p_asset -> 'starLevel', 0, 5))
     or not (public.trade_json_absent(p_asset -> 'nickname') or public.trade_json_name(p_asset -> 'nickname', 40))
     or not (
       public.trade_json_absent(p_asset -> 'nextBoostChance') or public.trade_json_percent(p_asset -> 'nextBoostChance')
     ) then
    return 'asset_invalid';
  end if;

  -- Memory Slots: only Ditto and Shiny Ditto, 1 to 6, one memory (or null) per slot.
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

create or replace function public.trade_listing_search_text(
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
    case when jsonb_typeof(p_asset -> 'ball') = 'string' then p_asset ->> 'ball' end,
    case when jsonb_typeof(p_asset -> 'auras') = 'array' then
      (select string_agg(entry.value #>> '{}', ' ') from jsonb_array_elements(p_asset -> 'auras') as entry)
    end,
    case when jsonb_typeof(p_asset -> 'addons') = 'array' then
      (select string_agg(entry.value #>> '{}', ' ') from jsonb_array_elements(p_asset -> 'addons') as entry)
    end,
    case when jsonb_typeof(p_asset -> 'heldX') = 'string' then p_asset ->> 'heldX' end,
    case when jsonb_typeof(p_asset -> 'heldY') = 'string' then p_asset ->> 'heldY' end,
    case when jsonb_typeof(p_asset -> 'mega') = 'string' then p_asset ->> 'mega' end,
    case when jsonb_typeof(p_asset -> 'boost') = 'number' then '+' || (p_asset ->> 'boost') end,
    case when jsonb_typeof(p_asset -> 'item') = 'string' then p_asset ->> 'item' end,
    p_asset ->> 'cantidad'
  ));
$$;

-- Internal helper, like the M14 ones: never callable through the API.
revoke all on function public.trade_json_id_set(jsonb, integer) from public, anon, authenticated;
