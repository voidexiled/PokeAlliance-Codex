// Tooltip builders of spec §7.5.3. Each one turns records the page has already
// read into the serializable `TipData` of §7.5.2, so the very same call runs in
// an Astro frontmatter and inside a React island with the same result (DP3,
// PR5). Nothing here imports Zod, `fs` or `content/`.
//
// Two rules shape every builder:
//
//   - X13 / T32. A row exists only when its value does. No builder ever writes
//     "—": inside a tooltip the whole row is dropped instead, and a key that no
//     record carries simply never appears. The dash belongs to cards, tables
//     and lists (§8.0.5), where the grid keeps a key some other entity has.
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
import { formatInteger } from '@/lib/format/numbers';
import { present } from '@/lib/format/unknown';

/** `Texto` of §3.13: a registry value written in both locales. */
export type LocalizedText = Record<Locale, string>;

/**
 * The four panel widths of §7.5.2, the `size-tt*` tokens: 282 by default, 240
 * narrow (elements, balls, currencies), 300 wide (held items) and 200 for the
 * compact chart panel of §10.
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

/** Value of a row (§7.5.2). A plain string never wraps; a list wraps only between its entries. */
export type TipValue =
  | string
  | { list: string[] }
  | { pd: number }
  | { dia: number }
  | { price: { kind: 'pd' | 'dia'; amount: number }[] };

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
  | { kind: 'held'; label: string; items: { name: string; sprite: TipSprite | null }[] }
  | { kind: 'train'; label: string; skills: TipTraining[] };

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
};

/** `size-tt` (§3, §7.5.2). */
const WIDTH_DEFAULT = 282;
/** `size-tt-narrow`: elements, balls and currencies. */
const WIDTH_NARROW = 240;
/** `size-tt-wide`: held items. */
const WIDTH_WIDE = 300;

/** Item categories whose panel is not the default width (§7.5.3). */
const ITEM_WIDTHS: Record<string, TipWidth | undefined> = {
  'poke-balls': WIDTH_NARROW,
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
  if ('price' in value) return value.price.length > 0 ? value : null;
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
};

/**
 * Pokémon panel (§7.5.3): art of 70, the Shiny mark on a shiny variant and the
 * rows Requisito, Tier, Elementos, Generación and Rol.
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
      [labels.generation, present(pokemon.generacion) ? String(pokemon.generacion) : null],
      [labels.role, pokemon.funcion],
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
};

/** Element panel (§7.5.3): icon head, 240 wide, rows Stone and Fragment. */
export function elementTip(element: ElementTipRecord, locale: Locale, labels: TipLabels): TipData {
  return {
    key: `elemento:${element.id}`,
    title: text(element.nombre, locale) ?? element.id,
    width: WIDTH_NARROW,
    head: { type: 'icon', sprite: element.icono },
    rows: tipRows([
      [labels.stone, element.stone],
      [labels.fragment, element.fragment],
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
};

/**
 * Item panel (§7.5.3, §8.5): item cell at 2x and the same six rows in every
 * category (Q12). With today's registry — every price `null` and none of the
 * new fields written — the panel is the sprite and the name, and not one row.
 */
export function itemTip(item: ItemTipRecord, locale: Locale, labels: TipLabels): TipData {
  const droppers = item.dropDe ?? [];
  const count = typeof droppers === 'number' ? droppers : droppers.length;
  const droppedBy =
    count > DROPPER_NAMES_MAX && labels.pokemonCount !== undefined
      ? fill(labels.pokemonCount, { n: formatInteger(count, locale) })
      : { list: typeof droppers === 'number' ? [] : [...droppers] };
  return {
    key: `item:${item.id}`,
    title: item.nombre,
    width: ITEM_WIDTHS[item.categoria] ?? WIDTH_DEFAULT,
    head: { type: 'sprite', sprite: item.sprite },
    rows: tipRows([
      [labels.category, text(item.nombreCategoria, locale)],
      [labels.droppedBy, droppedBy],
      [labels.element, text(item.nombreElemento, locale)],
      [labels.use, text(item.uso, locale)],
      [labels.npcPrice, item.precioNpc.vende === null ? null : { pd: item.precioNpc.vende }],
      [labels.shopPrice, item.precioNpc.compra === null ? null : { pd: item.precioNpc.compra }],
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
