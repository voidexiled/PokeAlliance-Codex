// The facts of an item panel (`ItemTipFacts` of ./tips.ts) derived from the registries: what
// `content/items/` says of the item (its game text, held slot and tier, Market flag, how it is
// obtained, its Ball facts) and what the other registries say of it — the Pokémon that drop it
// in any zone, the Pokémon its evolution or its Mega Stone is for, the elements whose Stone or
// Fragment it is, the aura a Ball unlocks. Every name comes out in the page's language (13.4:
// Pokémon and item names do not translate; element names do), so a data file or a prop carries
// the facts as they are and each surface draws the same panel.
//
// Pure functions over plain records, like src/lib/content/item-sources.ts: the server builds the
// index once per locale (src/lib/game/tip-records.ts), and Comercio builds it from the catalogue
// its page already reads (`tradeRecords`). Nothing here reads a file, Zod or a dictionary.
import { pokedexOrder } from '@/components/pokedex/config';
import type { Locale } from '@/i18n/config';
import { lootZonesOf } from '@/lib/content/item-sources';
import type { Item } from '@/lib/content/registry-schema';
import type { PokemonRecord } from '@/lib/content/types';
import { DROPPER_NAMES_MAX } from '@/lib/game/dropper-limit';
import type { ItemTipFacts, ItemTipShop } from '@/lib/game/tips';

/** The currency of each currency category of content/items/: the Diamond is spent as «Diamonds». */
const CURRENCY_OF_CATEGORY: Readonly<Record<string, string>> = { diamantes: 'Diamonds' };

/** The registries the facts are derived from, as src/lib/content/ gives them. */
export interface ItemFactsSources {
  pokemon: readonly PokemonRecord[];
  items: readonly Pick<Item, 'id' | 'nombre' | 'ball' | 'obtencion' | 'mega'>[];
  elementos: readonly {
    id: string;
    nombre: Record<Locale, string>;
    stone: string | null;
    fragment: string | null;
  }[];
  auras: readonly { id: string; nombre: string }[];
}

/** The lookups of one locale, built once (`itemFactsIndex`). */
export interface ItemFactsIndex {
  locale: Locale;
  /** The Pokémon that drop an item in any zone (Base, Wildscape, Primal), each once, 8.0.5. */
  droppers: ReadonlyMap<string, readonly PokemonRecord[]>;
  /** The Pokémon whose evolution asks for an item, each once, 8.0.5. */
  evolvers: ReadonlyMap<string, readonly PokemonRecord[]>;
  pokemonName: ReadonlyMap<string, string>;
  elementName: ReadonlyMap<string, string>;
  /** The names of the elements whose `stone` or `fragment` is an item, in registry order. */
  elementsOfItem: ReadonlyMap<string, readonly string[]>;
  auraName: ReadonlyMap<string, string>;
  /** The names of the Balls that favour an element (`ball.elementos`), by element id. */
  ballsByElement: ReadonlyMap<string, readonly string[]>;
  /** The names of the Balls that unlock an aura (`ball.aura`), by aura id. */
  ballsByAura: ReadonlyMap<string, readonly string[]>;
  /** Item names by id: the materials of a recipe. */
  itemName: ReadonlyMap<string, string>;
  /** The shops that sell for a currency («Diamonds» → Diamond Shop), by the game's currency name. */
  shopsByCurrency: ReadonlyMap<string, readonly string[]>;
  /** The name of the Mega Stone that gives a Mega form, by the form's id (`megaStoneByForm`). */
  megaStoneOf: ReadonlyMap<string, string>;
}

/** «-x» / «-y»: the suffix of a Mega Stone and of its form when a Pokémon has two (Charizard). */
const MEGA_SUFFIX = /-([xy])$/;

/**
 * The Mega Stone of each Mega form, by the form's id: a stone's `mega.pokemon` names the base
 * Pokémon (`charizard`), and its form is the record `mega-{base}`, or `mega-{base}-{x|y}` for
 * the stone that ends in the same letter (`charizardite-x` → `mega-charizard-x`). A form no
 * stone names is left out.
 */
export function megaStoneByForm(
  pokemonIds: Iterable<string>,
  items: readonly Pick<Item, 'nombre' | 'id' | 'mega'>[],
): Map<string, string> {
  const ids = new Set(pokemonIds);
  const stones = new Map<string, string>();
  for (const item of items) {
    const suffix = MEGA_SUFFIX.exec(item.id)?.[1];
    for (const base of item.mega?.pokemon ?? []) {
      const form = suffix === undefined ? `mega-${base}` : `mega-${base}-${suffix}`;
      if (ids.has(form) && !stones.has(form)) stones.set(form, item.nombre);
    }
  }
  return stones;
}

function push<T>(map: Map<string, T[]>, key: string, value: T): void {
  const list = map.get(key);
  if (list === undefined) map.set(key, [value]);
  else if (!list.includes(value)) list.push(value);
}

/** The lookups of `sources` for the panels of `locale`. */
export function itemFactsIndex(sources: ItemFactsSources, locale: Locale): ItemFactsIndex {
  const pokemon = [...sources.pokemon].sort(pokedexOrder(locale));
  const droppers = new Map<string, PokemonRecord[]>();
  const evolvers = new Map<string, PokemonRecord[]>();
  for (const record of pokemon) {
    for (const { drops } of lootZonesOf(record)) {
      for (const drop of drops) push(droppers, drop.item, record);
    }
    for (const step of record.evolucion ?? []) {
      for (const use of step.items) push(evolvers, use.item, record);
    }
  }
  const elementName = new Map(
    sources.elementos.map((element) => [element.id, element.nombre[locale]]),
  );
  const elementsOfItem = new Map<string, string[]>();
  for (const element of sources.elementos) {
    const name = element.nombre[locale];
    if (element.stone !== null) push(elementsOfItem, element.stone, name);
    if (element.fragment !== null) push(elementsOfItem, element.fragment, name);
  }
  const ballsByElement = new Map<string, string[]>();
  const ballsByAura = new Map<string, string[]>();
  for (const item of sources.items) {
    for (const element of item.ball?.elementos ?? []) push(ballsByElement, element, item.nombre);
    if (item.ball?.aura) push(ballsByAura, item.ball.aura, item.nombre);
  }
  return {
    locale,
    droppers,
    evolvers,
    pokemonName: new Map(sources.pokemon.map((record) => [record.id, record.nombre])),
    elementName,
    elementsOfItem,
    auraName: new Map(sources.auras.map((aura) => [aura.id, aura.nombre])),
    ballsByElement,
    ballsByAura,
    itemName: new Map(sources.items.map((item) => [item.id, item.nombre])),
    megaStoneOf: megaStoneByForm(
      sources.pokemon.map((record) => record.id),
      sources.items,
    ),
    shopsByCurrency: new Map(
      Object.values(CURRENCY_OF_CATEGORY).map((moneda) => [
        moneda,
        shopsSellingFor(sources.items, moneda),
      ]),
    ),
  };
}

/** The Pokémon that drop `itemId` in any zone, in the order of 8.0.5. */
export function droppersOf(itemId: string, index: ItemFactsIndex): readonly PokemonRecord[] {
  return index.droppers.get(itemId) ?? [];
}

/** Names, or their number past `DROPPER_NAMES_MAX` (what a panel shows of a long list). */
export function namesOrCount(names: readonly string[]): string[] | number {
  return names.length > DROPPER_NAMES_MAX ? names.length : [...names];
}

/**
 * `obtencion` as a panel reads it: each game shop with its offers (price, currency and the
 * quantity a purchase gives), the Battle Pass levels, the calendar days, the tasks by name, the
 * boxes that give it by name and each crafting recipe with its workshop and materials by name;
 * `undefined` when it gives no way at all.
 */
function obtainFacts(
  obtencion: Item['obtencion'],
  index: ItemFactsIndex,
): ItemTipFacts['obtencion'] {
  if (!obtencion) return undefined;
  const shops = new Map<string, ItemTipShop['ofertas'][number][]>();
  for (const shop of obtencion.tiendas ?? []) {
    const offers = shops.get(shop.tienda) ?? [];
    offers.push({ precio: shop.precio, moneda: shop.moneda, cantidad: shop.cantidad });
    shops.set(shop.tienda, offers);
  }
  const tiendas = [...shops].map(([tienda, ofertas]) => ({ tienda, ofertas }));
  const tareas = [...new Set((obtencion.tareas ?? []).map((task) => task.nombre))];
  const cajas = [
    ...new Set((obtencion.cajas ?? []).map((box) => index.itemName.get(box.item) ?? box.item)),
  ];
  const pase = [...new Set((obtencion.pase ?? []).flatMap((reward) => reward.nivel ?? []))].sort(
    (a, b) => a - b,
  );
  const calendar = obtencion.calendario ?? [];
  const dias = [...new Set(calendar.flatMap((reward) => reward.dia ?? []))].sort((a, b) => a - b);
  const trasDia21 = calendar.some((reward) => reward.trasDia21);
  const recetas = (obtencion.recetas ?? []).map((recipe) => ({
    taller: recipe.taller,
    materiales: recipe.materiales.map((material) => ({
      nombre: index.itemName.get(material.item) ?? material.item,
      cantidad: material.cantidad,
    })),
  }));
  const kinds: NonNullable<ItemTipFacts['obtencion']> = {
    ...(tiendas.length > 0 ? { tiendas } : {}),
    ...(tareas.length > 0 ? { tareas } : {}),
    ...(cajas.length > 0 ? { cajas } : {}),
    ...((obtencion.pase ?? []).length > 0 ? { pase } : {}),
    ...(calendar.length > 0 ? { calendario: { dias, ...(trasDia21 ? { trasDia21 } : {}) } } : {}),
    ...(recetas.length > 0 ? { recetas } : {}),
  };
  return Object.keys(kinds).length > 0 ? kinds : undefined;
}

/** The game's names of the shops that sell for `moneda` («Diamonds»), each once, in item order. */
export function shopsSellingFor(
  items: readonly Pick<Item, 'obtencion'>[],
  moneda: string,
): string[] {
  const shops = new Set<string>();
  for (const item of items) {
    for (const shop of item.obtencion?.tiendas ?? []) {
      if (shop.moneda === moneda) shops.add(shop.tienda);
    }
  }
  return [...shops];
}

/**
 * The facts of `item`'s panel, only those it has (a fact the registries do not know is left
 * out, so a data file carries nothing for it): its game text, held slot and tier, Mega Stone
 * Pokémon, evolutions, elements, Ball facts, Market flag and ways to obtain it. «Drop de» is
 * not here: each feed writes it its own way (`droppersOf`).
 */
export function itemTipFacts(item: Item, index: ItemFactsIndex): ItemTipFacts {
  const facts: ItemTipFacts = {};
  if (item.descripcion) facts.descripcion = { ...item.descripcion };
  if (item.held) facts.held = { ranura: item.held.ranura, tier: item.held.tier };
  const mega = (item.mega?.pokemon ?? []).flatMap((id) => index.pokemonName.get(id) ?? []);
  if (mega.length > 0) facts.megaDe = mega;
  const evolvers = (index.evolvers.get(item.id) ?? []).map((record) => record.nombre);
  if (evolvers.length > 0) facts.evoluciona = namesOrCount(evolvers);
  const own = item.elemento ? index.elementName.get(item.elemento) : undefined;
  const elements = [
    ...new Set([...(own === undefined ? [] : [own]), ...(index.elementsOfItem.get(item.id) ?? [])]),
  ];
  if (elements.length > 0) facts.elementos = elements;
  if (typeof item.mercado === 'boolean') facts.mercado = item.mercado;
  const obtencion = obtainFacts(item.obtencion, index);
  if (obtencion !== undefined) facts.obtencion = obtencion;
  // A currency item: the shops of the registries that sell for it (the Diamond: Diamond Shop).
  const currency = CURRENCY_OF_CATEGORY[item.categoria];
  const spentAt = currency === undefined ? [] : (index.shopsByCurrency.get(currency) ?? []);
  if (spentAt.length > 0) facts.seUsaEn = spentAt;
  // A Poké Ball's `ball` facts; its «Tasa de captura» row shows only once `tasa` is known.
  if (item.ball) {
    const ball: NonNullable<ItemTipFacts['ball']> = {};
    if (item.ball.tasa !== null) ball.tasa = item.ball.tasa;
    const favoured = item.ball.elementos.flatMap((id) => index.elementName.get(id) ?? []);
    if (favoured.length > 0) ball.elementos = favoured;
    if (item.ball.condicion !== null) ball.condicion = item.ball.condicion;
    const aura = item.ball.aura === null ? undefined : index.auraName.get(item.ball.aura);
    if (aura !== undefined) ball.aura = aura;
    facts.ball = ball;
  }
  return facts;
}
