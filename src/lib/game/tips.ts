// Tooltip builders of spec §7.5.3. Each one turns records the page has already
// read into the serializable `TipData` of §7.5.2, so the very same call runs in
// an Astro frontmatter and inside a React island with the same result (DP3,
// PR5). Nothing here imports Zod, `fs` or `content/`.
//
// Two rules shape every builder:
//
//   - X13 / T32. A row exists only when its value does: inside a tooltip the
//     whole row is dropped instead, and a key that no record carries simply
//     never appears. The dash belongs to cards, tables and lists (§8.0.5); a
//     builder may still pass `{ unknown: true }` for a value every entity of its
//     kind has, which the panel writes as «—».
//   - X4 / R7. No copy and no figure is invented. Names, amounts and lists come
//     from the registries; labels come from the dictionary.
//
// Labels arrive as a `TipLabels` argument instead of being read here: a builder
// must not pick text by locale (DP1, §13.2). Whoever composes the page passes
// `messages.ui.tooltip` of `src/i18n/messages/{es,en}.ts`, the same way every
// design-system component receives its text. `locale` picks the language of the `Texto` values of §3.13 and formats
// the numbers (§13.3).
import type { SpriteProps } from '@/components/game/Sprite';
import type { Locale } from '@/i18n/config';
import { fill } from '@/i18n/messages/types';
import { formatTier } from '@/lib/content/format';
import { DROPPER_NAMES_MAX } from '@/lib/game/dropper-limit';
import { resolvePokemonImage } from '@/lib/content/pokemon-media';
import { tierInfo } from '@/lib/content/tiers';
import type { PokemonRecord, SystemItemRecord } from '@/lib/content/types';
import { formatDecimal, formatInteger } from '@/lib/format/numbers';
import { present } from '@/lib/format/unknown';
import type { TipExtraLabels } from '@/lib/game/tip-labels';

export {
  TIP_EXTRA_LABELS,
  leanTipLabels,
  tipExtraLabels,
  withTipLabels,
  type TipExtraLabels,
} from '@/lib/game/tip-labels';

/** `Texto` of §3.13: a registry value written in both locales. */
export type LocalizedText = Record<Locale, string>;

/**
 * The four panel widths of §7.5.2, the `size-tt*` tokens: 282 by default (balls
 * too, since they show their game text), 240 narrow (elements, currencies), 300
 * wide (held items) and 200 for the compact chart panel of §10.
 */
export type TipWidth = 282 | 240 | 300 | 200;

/**
 * The sprite a tooltip carries: the `SpriteProps` of §7.4.2 that the adapter
 * already resolved from `public/sprites/sprites.json` (DP2). It is plain data
 * and never a React node, because `TipData` travels as island props and inside
 * the prerendered `datos.json` (DP3, PR5). The cell and the scale of the head
 * are the panel's decision, not the builder's.
 */
export type TipSprite = SpriteProps;

/** Head of the panel (§7.5.2). */
export type TipHead =
  /** Item cell of 64 at 2x; `null` draws the missing-sprite mark of 32. */
  | { type: 'sprite'; sprite: TipSprite | null }
  /** Pokémon art of 70, with the aura ball over its corner when it has one. */
  | { type: 'art'; src: string | null; aura?: { sprite: TipSprite; label: string } }
  /** Element icon of 32, smooth. */
  | { type: 'icon'; sprite: TipSprite | null }
  /** Compact chart panel (§10). */
  | { type: 'none' };

/** An element drawn as its icon in a row (a Pokémon's effectiveness), named for screen readers. */
export type TipIcon = { name: string; sprite: TipSprite | null };

/**
 * Value of a row (§7.5.2). A plain string never wraps; a list wraps only between its entries;
 * `icons` is a row of small element icons (the name stands in for a missing sprite).
 * `{ unknown: true }` is a value every entity of its kind has and the registry does not know
 * yet, which the panel writes as «—» (AGENTS.md: unknown is «—») instead of dropping the row.
 */
export type TipValue =
  | string
  | { list: string[] }
  | { icons: TipIcon[] }
  | { pd: number }
  | { dia: number }
  | { price: { kind: 'pd' | 'dia'; amount: number }[] }
  | { unknown: true };

/**
 * One row. `label` carries no colon: `GameTooltip` adds it. `lang` is the language of a
 * value that exists in one language only and differs from the page's (T22, WA4, 8.0.5).
 */
export type TipRow = { label: string; value: TipValue; lang?: Locale };

/** One trained skill of a «Entrenamiento: N» section: «Attack 16 (53%)» and its meter. */
export type TipTraining = { stat: string; level: number; percent: number };

/**
 * A collapsible section of the panel (§7.5.2); no builder of this file emits one. A listing
 * panel lists every trained skill under «Entrenamiento: N» (§9.5.9).
 */
export type TipSection =
  | {
      kind: 'held';
      label: string;
      /** Each held item; `text` is the game's text of what it does, when the registry has it. */
      items: { name: string; sprite: TipSprite | null; text?: TipText }[];
    }
  | { kind: 'train'; label: string; skills: TipTraining[] };

/**
 * The game's own text of an entity, drawn under the head and over the rows: an item's
 * inspection text («Increase the Pokémon attack by 8%.»). Unlike a row value it wraps. `lang`
 * is its language when it differs from the page's (the registry holds most of them in English
 * only, T22).
 */
export type TipText = { value: string; lang?: Locale };

/** Everything `GameTooltip` needs to paint a panel (§7.5.2). */
export type TipData = {
  /**
   * `<tipo>:<id>` (§7.5.2) with the registry vocabulary of `Ref` (§3.13) where the entity
   * has one — `pokemon:charizard`, `item:fire-stone` — and the registry's own name where it
   * does not: `elemento:fuego`, `item-sistema:<id>`, and `moneda:diamonds` /
   * `moneda:pokedolares` for the currency panels, whose rows come from a `moneda` object.
   */
  key: string;
  title: string;
  width: TipWidth;
  head: TipHead;
  shiny?: boolean;
  /** The game's text of the entity, when the registry has one (see `TipText`). */
  text?: TipText;
  /** Only rows that have a value (X13/T32). */
  rows: TipRow[];
  /** Listing panels lay their rows out in two columns (§9). */
  grid?: boolean;
  sections?: TipSection[];
  /** Market block of a listing panel (§9). */
  market?: TipRow[];
  /** Compact chart panel of Guild (§10). */
  dayTitle?: string;
};

/**
 * The labels the builders need, the `ui.tooltip` leaves of the dictionary
 * (§13.2). They are copy, so they arrive in the page's language already; a
 * builder never chooses between `es` and `en` (DP1).
 *
 * `level` is the only template: it is `formatLevelRequirement` of §13.3,
 * «Nivel {n}» / «Level {n}», and the row that carries it is labelled
 * `requirement` («Requisito» / «Requirement»).
 */
export type TipLabels = {
  /** «Requisito» / «Requirement» (§7.5.3, pokemonTip). */
  requirement: string;
  /** «Nivel {n}» / «Level {n}»: the value of the `requirement` row (§13.3). */
  level: string;
  /** «Tier», a game term, the same in both locales (§13.4). */
  tier: string;
  /** «Elementos» / «Elements». */
  elements: string;
  /** «Generación» / «Generation». */
  generation: string;
  /** «Rol» / «Role». */
  role: string;
  /** «Stone», a game term (§13.4). */
  stone: string;
  /** «Fragment», a game term (§13.4). */
  fragment: string;
  /** «Categoría» / «Category». */
  category: string;
  /** «Drop de» / «Dropped by». */
  droppedBy: string;
  /**
   * «{n} Pokémon»: the value of «Drop de» when more than `DROPPER_NAMES_MAX` Pokémon drop the
   * item (an Evolution Stone drops from a hundred). Without it the row lists every name.
   */
  pokemonCount?: string;
  /** «Elemento» / «Element». */
  element: string;
  /** «Uso» / «Use». */
  use: string;
  /** «Precio NPC» / «NPC Price» (§8.5). */
  npcPrice: string;
  /** «Precio de tienda» / «Shop price» (§8.5). */
  shopPrice: string;
  /** «Sistema» / «System» (§8.4.2, E16). */
  system: string;
  /** «Se compran en» / «Bought at» (§8.5). */
  boughtAt: string;
  /** «Se usan en» / «Used for» (§8.5). */
  usedFor: string;
  /** «Diamonds», a game term, the same in both locales (§13.4). */
  diamonds: string;
  /** «Pokédólares» / «Pokédollars» (R5). */
  pokedolares: string;
} & Partial<TipExtraLabels>;

/** `size-tt` (§3, §7.5.2). */
const WIDTH_DEFAULT = 282;
/** `size-tt-narrow`: elements and currencies. */
const WIDTH_NARROW = 240;
/** `size-tt-wide`: held items. */
const WIDTH_WIDE = 300;

/**
 * Item categories whose panel is not the default width (§7.5.3). A Poké Ball takes the default
 * since it shows its game text, what it favours and where to get it (owner rule 2026-09-25):
 * at 240 each of those rows broke into three or four lines.
 */
const ITEM_WIDTHS: Record<string, TipWidth | undefined> = {
  diamantes: WIDTH_NARROW,
  helds: WIDTH_WIDE,
};

/** Pokémon elements read as one value: «Fuego / Volador» (§8.0.5). */
const ELEMENT_JOINER = ' / ';

/** The `variante` of a shiny Pokémon in `content/pokemon.json`. */
const SHINY = 'shiny';

/** A `Texto` in the page's language, or `null` when the registry has none. */
function text(value: LocalizedText | null | undefined, locale: Locale): string | null {
  const picked = value?.[locale];
  return picked !== undefined && present(picked) ? picked : null;
}

/**
 * The value a row would show, or `null` when there is nothing to show (X13).
 * `present()` already rejects `null`, `undefined`, the empty string, the dash
 * itself and empty lists, so a registry that carries "—" is as unknown as one
 * that carries nothing.
 */
function rowValue(value: TipValue | null | undefined): TipValue | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return present(value) ? value : null;
  if ('list' in value) {
    const list = value.list.filter((entry) => present(entry));
    return list.length > 0 ? { list } : null;
  }
  if ('icons' in value) return value.icons.length > 0 ? value : null;
  if ('price' in value) return value.price.length > 0 ? value : null;
  if ('unknown' in value) return value;
  if ('pd' in value) return Number.isFinite(value.pd) ? value : null;
  return Number.isFinite(value.dia) ? value : null;
}

/** A row per pair that has both a label and a value; the rest are dropped (T32). */
function tipRows(
  entries: readonly (readonly [label: string, value: TipValue | null | undefined])[],
): TipRow[] {
  const rows: TipRow[] = [];
  for (const [label, value] of entries) {
    const kept = rowValue(value);
    if (kept !== null && present(label)) rows.push({ label, value: kept });
  }
  return rows;
}

/**
 * Requisito: «Nivel 120» (§13.3, `formatLevelRequirement`). The number is
 * grouped by `formatInteger`, so no builder calls `Intl` on its own (V4-6).
 */
function levelRequirement(
  level: number | null | undefined,
  locale: Locale,
  labels: TipLabels,
): string | null {
  if (level === null || level === undefined || !Number.isFinite(level)) return null;
  return fill(labels.level, { n: formatInteger(level, locale) });
}

/** A sprite that holds frame 0: the Diamond only animates in Comercio (§7.5.3). */
function stillSprite(sprite: TipSprite | null | undefined): TipSprite | null {
  if (!sprite) return null;
  if (sprite.durations === undefined) return sprite;
  const still = { ...sprite };
  delete still.durations;
  return still;
}

/**
 * A Pokémon as the pages read it, plus the two things the tooltip needs that
 * the record only names: the element records of its `elementos` ids, in the
 * order of §8.0.5, and the aura ball drawn over the art.
 */
export type PokemonTipRecord = Pick<
  PokemonRecord,
  'id' | 'nombre' | 'variante' | 'nivel' | 'tier' | 'generacion' | 'funcion' | 'imagen'
> & {
  /** Element records of `content/elementos.json`, in registry order (§8.0.5). */
  elementos: readonly { nombre: LocalizedText }[];
  /** Aura ball over the corner of the art, when the Pokémon has one. */
  aura?: { sprite: TipSprite; label: string } | null;
  /** `numero`: its number in the Pokédex. */
  numero?: number | null;
  /** The element record of its `elementoMoveset` (16.2.2), the element of its area moves. */
  moveset?: { nombre: LocalizedText } | null;
  /** `rapido` and `pesado` of its Pokédex: the traits Fast and Heavy (a Fast / Heavy Ball's). */
  rapido?: boolean | null;
  pesado?: boolean | null;
  /** `habilidades`: its field abilities, game terms (Fly, Surf, Dig…). */
  habilidades?: readonly string[] | null;
  /** A Mega form: the name of the Mega Stone that gives it (`megaStoneByForm`). */
  megaStone?: string | null;
  /**
   * Its `efectividad` as element icons, grouped compactly: Débil a (×2 and ×1,5), Resiste
   * (×0,5 and ×0,4) and Inmune (×0). Lists read it from `/{l}/paneles.json` (`pokemonPanel`).
   */
  efectividadIconos?: TipEffectiveness | null;
};

/** An element of an effectiveness group: its name and its icon (`ui/elementos/<id>`). */
export type TipElementIcon = { nombre: LocalizedText; sprite: TipSprite | null };

/** The three effectiveness rows of a Pokémon panel, each one its elements. */
export type TipEffectiveness = {
  debil: readonly TipElementIcon[];
  resiste: readonly TipElementIcon[];
  inmune: readonly TipElementIcon[];
};

/** A row of element icons named in `locale`, or nothing for an empty group. */
function iconRow(icons: readonly TipElementIcon[] | undefined, locale: Locale): TipValue | null {
  const shown = (icons ?? []).flatMap((icon) => {
    const name = text(icon.nombre, locale);
    return name === null ? [] : [{ name, sprite: icon.sprite }];
  });
  return shown.length === 0 ? null : { icons: shown };
}

/** The game's names of the two traits of its Pokédex, the same in both locales (13.4). */
export const TRAIT_NAMES = { rapido: 'Fast', pesado: 'Heavy' } as const;

/**
 * Pokémon panel (§7.5.3): art of 70, the Shiny mark on a shiny variant and the
 * rows Requisito, Tier, Elementos, Moveset, its effectiveness as element icons (Débil a, Resiste,
 * Inmune), Nº, Generación, Rol, Rasgos, Habilidades and, for a Mega form, its Mega Stone.
 */
export function pokemonTip(pokemon: PokemonTipRecord, locale: Locale, labels: TipLabels): TipData {
  const elements = pokemon.elementos
    .map((element) => text(element.nombre, locale))
    .filter((name): name is string => name !== null);
  const head: Extract<TipHead, { type: 'art' }> = {
    type: 'art',
    src: resolvePokemonImage(pokemon.imagen),
    ...(pokemon.aura ? { aura: pokemon.aura } : {}),
  };
  const traits: string[] = [];
  if (pokemon.rapido === true) traits.push(TRAIT_NAMES.rapido);
  if (pokemon.pesado === true) traits.push(TRAIT_NAMES.pesado);
  return {
    key: `pokemon:${pokemon.id}`,
    title: pokemon.nombre,
    width: WIDTH_DEFAULT,
    head,
    ...(pokemon.variante === SHINY ? { shiny: true } : {}),
    rows: tipRows([
      [labels.requirement, levelRequirement(pokemon.nivel, locale, labels)],
      // A tier content/tiers.json hides (ULTIMATE for now) reads as an unknown one: «—».
      [labels.tier, formatTier(tierInfo(pokemon.tier)?.visible === false ? null : pokemon.tier)],
      [labels.elements, elements.join(ELEMENT_JOINER)],
      [labels.moveset ?? '', text(pokemon.moveset?.nombre, locale)],
      [labels.weakTo ?? '', iconRow(pokemon.efectividadIconos?.debil, locale)],
      [labels.resists ?? '', iconRow(pokemon.efectividadIconos?.resiste, locale)],
      [labels.immune ?? '', iconRow(pokemon.efectividadIconos?.inmune, locale)],
      [labels.number ?? '', present(pokemon.numero) ? String(pokemon.numero) : null],
      [labels.generation, present(pokemon.generacion) ? String(pokemon.generacion) : null],
      [labels.role, pokemon.funcion],
      [labels.traits ?? '', { list: traits }],
      [labels.abilities ?? '', { list: [...(pokemon.habilidades ?? [])] }],
      [labels.megaStone ?? '', pokemon.megaStone ?? null],
    ]),
  };
}

/** An element of `content/elementos.json` (§3.13, §8.0.5). */
export type ElementTipRecord = {
  id: string;
  nombre: LocalizedText;
  /** Icon of 100 px drawn smooth at 32, or `null` while the registry has none. */
  icono: TipSprite | null;
  /** Name of the item in the registry's `stone` id, or `null`. Item names do not translate (§13.4). */
  stone: string | null;
  /** Name of the item in the registry's `fragment` id, or `null`. */
  fragment: string | null;
  /** Names of the Balls whose `ball.elementos` name it (a Magu Ball for Fire). */
  balls?: readonly string[] | null;
};

/** Element panel (§7.5.3): icon head, 240 wide, rows Stone, Fragment and Ball. */
export function elementTip(element: ElementTipRecord, locale: Locale, labels: TipLabels): TipData {
  return {
    key: `elemento:${element.id}`,
    title: text(element.nombre, locale) ?? element.id,
    width: WIDTH_NARROW,
    head: { type: 'icon', sprite: element.icono },
    rows: tipRows([
      [labels.stone, element.stone],
      [labels.fragment, element.fragment],
      [labels.ball ?? '', { list: [...(element.balls ?? [])] }],
    ]),
  };
}

/**
 * An item of `content/items/<categoria>.json` (§3.13) with the values its
 * tooltip needs from other registries: the name of its category, the Pokémon
 * whose `drops` include it — the inverse of the `drops` field (§7.5.3) — and
 * the name of its element.
 */
export type ItemTipRecord = {
  id: string;
  nombre: string;
  /** Category id; it picks the panel width (§7.5.3). */
  categoria: string;
  sprite: TipSprite | null;
  precioNpc: { vende: number | null; compra: number | null };
  /** `nombre` of the category in `content/items/categorias.json`. */
  nombreCategoria?: LocalizedText | null;
  /**
   * Names of the Pokémon that drop it, in the order of §8.0.5 (Pokémon names do not translate,
   * §13.4), or how many they are when a list gives only that (`DROPPER_NAMES_MAX`).
   */
  dropDe?: readonly string[] | number;
  /** `nombre` of the element in the item's `elemento` id (§3.13). */
  nombreElemento?: LocalizedText | null;
  /** `uso` of the item (§3.13). */
  uso?: LocalizedText | null;
} & ItemTipFacts;

/**
 * What an item panel shows besides its name, category, sprite, «Drop de» and NPC prices: the
 * facts of `content/items/` and those derived from the other registries, every name already
 * in the page's language (Pokémon and item names do not translate, 13.4). The server derives
 * them once (`itemTipFacts` of src/lib/game/item-facts.ts) and the data files and props carry
 * them as they are, so each surface draws the same panel. A missing fact makes no row.
 */
export type ItemTipFacts = {
  /** `descripcion`: the game's inspection text (what the item does), in the languages it has. */
  descripcion?: Partial<Record<Locale, string>> | null;
  /** `held` of a held item (16.2.3): its slot and tier; the effect is in `descripcion`. */
  held?: { ranura: 'x' | 'y'; tier: number } | null;
  /** The names of the Pokémon a Mega Stone evolves (`mega.pokemon`). */
  megaDe?: readonly string[] | null;
  /**
   * The Pokémon whose evolution asks for the item (`evolucion[].items` of content/pokemon.json),
   * by name, or how many they are past `DROPPER_NAMES_MAX`.
   */
  evoluciona?: readonly string[] | number | null;
  /** The elements whose Stone or Fragment it is (content/elementos.json), by name. */
  elementos?: readonly string[] | null;
  /** `mercado`: whether the game's Market takes it. */
  mercado?: boolean | null;
  /**
   * `obtencion`, by kind: each game shop with its offers, the tasks by their names, the Battle
   * Pass levels, the calendar days and each crafting recipe with its workshop and materials.
   */
  obtencion?: {
    tiendas?: readonly ItemTipShop[];
    tareas?: readonly string[];
    /** The Battle Pass levels that give it, ascending; empty when the registry has none. */
    pase?: readonly number[];
    /** The calendar days that give it, and whether every day after the 21st does. */
    calendario?: { dias: readonly number[]; trasDia21?: boolean };
    recetas?: readonly ItemTipRecipe[];
  } | null;
  /** A currency item: the shops that sell for it (the Diamond: «Se usan en: Diamond Shop»). */
  seUsaEn?: readonly string[] | null;
  /**
   * `ball` of a Poké Ball: its multiplier, the elements it favours by name or the trait of the
   * Pokémon it favours, and the name of the aura it unlocks.
   */
  ball?: {
    tasa?: number | null;
    elementos?: readonly string[];
    condicion?: 'rapido' | 'pesado' | null;
    aura?: string | null;
  } | null;
};

/** A game shop of `obtencion.tiendas` and what it asks for the item: «100 por 5 Diamonds». */
export type ItemTipShop = {
  /** The shop as the game writes it: «Diamond Shop». */
  tienda: string;
  /** Each offer: price, the game's currency («Diamonds», «Online Points») and the quantity. */
  ofertas: readonly { precio: number | null; moneda: string | null; cantidad: number | null }[];
};

/** A crafting recipe of `obtencion.recetas`: its workshop and its materials by name. */
export type ItemTipRecipe = {
  /** The workshop as the game writes it («Boost Stone Workshop»), or `null`. */
  taller: string | null;
  materiales: readonly { nombre: string; cantidad: number | null }[];
};

/**
 * `value` in the page's language, or in the other one with its `lang` (T22): a game text the
 * registry holds in English only is still shown on a Spanish page, marked as English.
 */
export function gameText(
  value: Partial<Record<Locale, string>> | null | undefined,
  locale: Locale,
): TipText | null {
  if (!value) return null;
  const own = value[locale];
  if (own !== undefined && present(own)) return { value: own };
  for (const [other, candidate] of Object.entries(value) as [Locale, string | undefined][]) {
    if (other !== locale && candidate !== undefined && present(candidate))
      return { value: candidate, lang: other };
  }
  return null;
}

/** A list of Pokémon names, or «{n} Pokémon» past `DROPPER_NAMES_MAX` (an Evolution Stone). */
function pokemonList(
  names: readonly string[] | number | null | undefined,
  locale: Locale,
  labels: TipLabels,
): TipValue | null {
  const all = names ?? [];
  const count = typeof all === 'number' ? all : all.length;
  if (count > DROPPER_NAMES_MAX && labels.pokemonCount !== undefined)
    return fill(labels.pokemonCount, { n: formatInteger(count, locale) });
  return { list: typeof all === 'number' ? [] : [...all] };
}

/** One offer of a shop: «5 Diamonds», or «100 por 5 Diamonds» for a pack; `null` without a price. */
function offerText(
  offer: ItemTipShop['ofertas'][number],
  locale: Locale,
  labels: TipLabels,
): string | null {
  if (offer.precio === null || !Number.isFinite(offer.precio)) return null;
  const price = [formatInteger(offer.precio, locale), offer.moneda ?? ''].join(' ').trim();
  if (offer.cantidad === null || offer.cantidad <= 1 || labels.offer === undefined) return price;
  return fill(labels.offer, { count: formatInteger(offer.cantidad, locale), price });
}

/** «Nivel 4, 18»: the Battle Pass levels, the first one with its word (13.3). */
function passLevels(levels: readonly number[], locale: Locale, labels: TipLabels): string | null {
  if (levels.length === 0) return null;
  const [first, ...rest] = levels.map((level) => formatInteger(level, locale));
  return [fill(labels.level, { n: first }), ...rest].join(', ');
}

/** «Día 7, 16, tras el día 21»: the calendar days, the first one with its word. */
function calendarDays(
  calendario: { dias: readonly number[]; trasDia21?: boolean },
  locale: Locale,
  labels: TipLabels,
): string | null {
  const parts: string[] = [];
  if (calendario.dias.length > 0 && labels.day !== undefined) {
    const [first, ...rest] = calendario.dias.map((day) => formatInteger(day, locale));
    parts.push(fill(labels.day, { n: first }), ...rest);
  }
  if (calendario.trasDia21 === true && labels.afterDay21 !== undefined)
    parts.push(labels.afterDay21);
  return parts.length > 0 ? parts.join(', ') : null;
}

/**
 * The rows of how an item is obtained besides its droppers (§8.5): one per game shop with its
 * offers («Diamond Shop: 100 por 5 Diamonds, 1000 por 45 Diamonds»), the Battle Pass levels,
 * the calendar days, one per crafting recipe with its materials, and «Se obtiene en» with the
 * tasks and every way whose details the registry lacks.
 */
function obtainRows(
  obtencion: ItemTipFacts['obtencion'],
  locale: Locale,
  labels: TipLabels,
): (readonly [string, TipValue | null])[] {
  if (!obtencion) return [];
  const rows: (readonly [string, TipValue | null])[] = [];
  const bare: string[] = [];
  for (const shop of obtencion.tiendas ?? []) {
    const offers = shop.ofertas.flatMap((offer) => offerText(offer, locale, labels) ?? []);
    if (offers.length > 0) rows.push([shop.tienda, { list: offers }]);
    else bare.push(shop.tienda);
  }
  if (obtencion.pase !== undefined && labels.battlePass !== undefined) {
    const levels = passLevels(obtencion.pase, locale, labels);
    if (levels === null) bare.push(labels.battlePass);
    else rows.push([labels.battlePass, levels]);
  }
  if (obtencion.calendario !== undefined && labels.calendar !== undefined) {
    const days = calendarDays(obtencion.calendario, locale, labels);
    if (days === null) bare.push(labels.calendar);
    else rows.push([labels.calendar, days]);
  }
  for (const recipe of obtencion.recetas ?? []) {
    const materials = recipe.materiales.map((material) =>
      material.cantidad === null
        ? material.nombre
        : `${formatInteger(material.cantidad, locale)} ${material.nombre}`,
    );
    const label = recipe.taller ?? labels.crafting;
    if (label === undefined) continue;
    if (materials.length > 0) rows.push([label, { list: materials }]);
    else bare.push(label);
  }
  bare.push(...(obtencion.tareas ?? []));
  rows.push([labels.obtainedFrom ?? '', { list: [...new Set(bare)] }]);
  return rows;
}

/**
 * «Tasa de captura» of a Ball: «×4»; no row while the registry does not know it (neither the
 * client nor the export carries catch rates, so the owner fills `ball.tasa` by hand).
 */
function catchRate(ball: ItemTipFacts['ball'], locale: Locale): TipValue | null {
  const tasa = ball?.tasa;
  if (tasa === null || tasa === undefined || !Number.isFinite(tasa)) return null;
  return `×${Number.isInteger(tasa) ? formatInteger(tasa, locale) : formatDecimal(tasa, locale)}`;
}

/** «Más efectiva con» of a Ball: its elements, or «Pokémon Fast» / «Heavy Pokémon». */
function bestAgainst(ball: ItemTipFacts['ball'], labels: TipLabels): TipValue | null {
  if (!ball) return null;
  if ((ball.elementos ?? []).length > 0) return { list: [...(ball.elementos ?? [])] };
  if (!ball.condicion || labels.traitPokemon === undefined) return null;
  return fill(labels.traitPokemon, { trait: TRAIT_NAMES[ball.condicion] });
}

/** «Mercado»: «Comercializable» or «No vendible»; nothing while the registry does not know. */
function marketValue(mercado: boolean | null | undefined, labels: TipLabels): string | null {
  if (mercado === true) return labels.tradeable ?? null;
  if (mercado === false) return labels.notTradeable ?? null;
  return null;
}

/**
 * Item panel (§7.5.3, §8.5): item cell at 2x, the game's text of the item (what it does) and
 * the rows that have a value, in every category the same order (Q12), the six of §8.5 in
 * theirs: Categoría; Ranura and Tier of a held item; Mega Evolución de; Evoluciona; Drop de;
 * each shop with its offers, Battle Pass, Calendario, each recipe and Se obtiene en; Elemento;
 * a currency's Se usan en; the Ball's Tasa de captura (only once the registry knows it),
 * Más efectiva con and Aura; Uso; Precio NPC; Precio de tienda; Mercado.
 */
export function itemTip(item: ItemTipRecord, locale: Locale, labels: TipLabels): TipData {
  const elements =
    (item.elementos ?? []).length > 0
      ? (item.elementos ?? []).join(ELEMENT_JOINER)
      : text(item.nombreElemento, locale);
  const description = gameText(item.descripcion, locale);
  return {
    key: `item:${item.id}`,
    title: item.nombre,
    width: ITEM_WIDTHS[item.categoria] ?? WIDTH_DEFAULT,
    head: { type: 'sprite', sprite: item.sprite },
    ...(description === null ? {} : { text: description }),
    rows: tipRows([
      [labels.category, text(item.nombreCategoria, locale)],
      [labels.slot ?? '', item.held ? item.held.ranura.toUpperCase() : null],
      [labels.tier, item.held ? formatInteger(item.held.tier, locale) : null],
      [labels.megaOf ?? '', { list: [...(item.megaDe ?? [])] }],
      [labels.evolves ?? '', pokemonList(item.evoluciona, locale, labels)],
      [labels.droppedBy, pokemonList(item.dropDe, locale, labels)],
      ...obtainRows(item.obtencion, locale, labels),
      [labels.element, elements],
      [labels.usedFor, { list: [...(item.seUsaEn ?? [])] }],
      [labels.catchRate ?? '', catchRate(item.ball, locale)],
      [labels.bestAgainst ?? '', bestAgainst(item.ball, labels)],
      [labels.aura ?? '', item.ball?.aura ?? null],
      [labels.use, text(item.uso, locale)],
      [labels.npcPrice, item.precioNpc.vende === null ? null : { pd: item.precioNpc.vende }],
      [labels.shopPrice, item.precioNpc.compra === null ? null : { pd: item.precioNpc.compra }],
      [labels.market ?? '', marketValue(item.mercado, labels)],
    ]),
  };
}

/** A system item of `content/system-items.json` with the title of its system page (E16). */
export type SystemItemTipRecord = Pick<
  SystemItemRecord,
  'id' | 'nombre' | 'descripcion' | 'sistema'
> & {
  /** `sprite` of §3.13, while the registry has one. */
  sprite?: TipSprite | null;
  /** `titulo` of the system page of `sistema` (`content/sistemas/<id>.json`). */
  tituloSistema?: LocalizedText | null;
};

/**
 * System-item panel (§7.5.3, E16): rows Sistema and Uso. `descripcion` is one
 * string because the registry only holds the English one today; the page marks
 * it with `lang="en"` inside `es` (§8.0.5, T22).
 */
export function systemItemTip(
  item: SystemItemTipRecord,
  locale: Locale,
  labels: TipLabels,
): TipData {
  return {
    key: `item-sistema:${item.id}`,
    title: item.nombre,
    width: WIDTH_DEFAULT,
    head: { type: 'sprite', sprite: item.sprite ?? null },
    rows: tipRows([
      [labels.system, text(item.tituloSistema, locale)],
      [labels.use, item.descripcion],
    ]),
  };
}

/** A system page of `content/sistemas/<id>.json` (§3.13, §8.4). */
export type SystemTipRecord = {
  id: string;
  titulo: LocalizedText;
  sprite: TipSprite | null;
  /** The `tooltip` array of the record: this panel's rows, labels included. */
  tooltip: readonly { etiqueta: LocalizedText; valor: LocalizedText }[];
};

/**
 * System panel (§7.5.3): the rows are the registry's own, so its labels come
 * from `content/sistemas/<id>.json` and not from the dictionary — which is why
 * this builder takes no `TipLabels`.
 */
export function systemTip(system: SystemTipRecord, locale: Locale): TipData {
  return {
    key: `sistema:${system.id}`,
    title: text(system.titulo, locale) ?? system.id,
    width: WIDTH_DEFAULT,
    head: { type: 'sprite', sprite: system.sprite },
    rows: tipRows(
      system.tooltip.map(
        (row) => [text(row.etiqueta, locale) ?? '', text(row.valor, locale)] as const,
      ),
    ),
  };
}

/**
 * An aura of content/auras.json (16.4.5) or an addon of content/outfits.json, as a slot of the
 * equipment shows it: its name, its sprite (the aura's ball, the addon's outfit), and what the
 * registries say of it besides — the Balls that unlock an aura, the Pokémon an addon dresses.
 */
export type GearTipRecord = {
  id: string;
  nombre: string;
  sprite: TipSprite | null;
  /** An aura: the names of the Balls whose `ball.aura` is it (a Premier Ball for Premier). */
  balls?: readonly string[] | null;
  /** An addon: the name of the Pokémon of its outfit. */
  pokemon?: string | null;
};

/**
 * Aura or addon panel (16.4.5), 300 wide like a held item: the sprite at 2x, the name and,
 * with a value, «Viene con: Premier Ball» (an aura) or «Pokémon: Bulbasaur» (an addon). The
 * game's own tooltip of an aura is its name only.
 */
export function gearTip(kind: 'aura' | 'addon', gear: GearTipRecord, labels: TipLabels): TipData {
  return {
    key: `${kind}:${gear.id}`,
    title: gear.nombre,
    width: WIDTH_WIDE,
    head: { type: 'sprite', sprite: gear.sprite },
    rows: tipRows([
      [labels.comesWith ?? '', { list: [...(gear.balls ?? [])] }],
      [labels.pokemon ?? '', gear.pokemon ?? null],
    ]),
  };
}

/**
 * The `moneda` object of a currency registry (§3.13): where players buy it and
 * what they spend it on, one list per locale. Only
 * `content/items/diamantes.json` carries one today (`getMonedaDiamantes`). A
 * list is `null` while the owner has not filled it, and makes no row, as an
 * empty one.
 */
export type CurrencyTipRecord = {
  seCompranEn: Readonly<Record<Locale, readonly string[]>> | null;
  seUsanEn: Readonly<Record<Locale, readonly string[]>> | null;
};

/** Head of a currency panel: the coin sprite the adapter resolved for the fixed key. */
export type CurrencyTipOptions = {
  /** `ui/diamond` or `ui/pokedolares` as `SpriteProps`, or `null` while the key is missing. */
  sprite?: TipSprite | null;
  /** The Diamond animates only in Comercio (§7.5.3); everywhere else it holds frame 0. */
  animated?: boolean;
};

function currencyTip(
  key: string,
  title: string,
  moneda: CurrencyTipRecord | null | undefined,
  locale: Locale,
  labels: TipLabels,
  options: CurrencyTipOptions,
): TipData | null {
  const rows = tipRows([
    [labels.boughtAt, { list: [...(moneda?.seCompranEn?.[locale] ?? [])] }],
    [labels.usedFor, { list: [...(moneda?.seUsanEn?.[locale] ?? [])] }],
  ]);
  // R2: with no row the mention is not a trigger at all, so there is no panel
  // to build — an empty list makes no row, and no row makes no tooltip (§8.5).
  if (rows.length === 0) return null;
  const sprite = options.animated === true ? (options.sprite ?? null) : stillSprite(options.sprite);
  return { key, title, width: WIDTH_NARROW, head: { type: 'sprite', sprite }, rows };
}

/**
 * Diamonds panel (§7.5.3, §8.5): rows «Se compran en» and «Se usan en», whose
 * values the code never writes — they are the two lists of the `moneda` object
 * of `content/items/diamantes.json`. Returns `null` when neither list has an
 * entry, because then the mention is not a trigger (R2).
 */
export function diamondsTip(
  moneda: CurrencyTipRecord | null | undefined,
  locale: Locale,
  labels: TipLabels,
  options: CurrencyTipOptions = {},
): TipData | null {
  return currencyTip('moneda:diamonds', labels.diamonds, moneda, locale, labels, options);
}

/**
 * Pokédólares panel: the same two rows as Diamonds, from the `moneda` object of
 * the Pokédólares registry. No registry writes one yet, so this returns `null`
 * today and every mention of the currency stays plain text (R2, R5) — the rows
 * appear by themselves the day the owner fills the object.
 */
export function pokedolaresTip(
  moneda: CurrencyTipRecord | null | undefined,
  locale: Locale,
  labels: TipLabels,
  options: CurrencyTipOptions = {},
): TipData | null {
  return currencyTip('moneda:pokedolares', labels.pokedolares, moneda, locale, labels, options);
}
