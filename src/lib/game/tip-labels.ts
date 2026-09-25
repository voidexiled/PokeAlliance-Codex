// The labels of the rows the game tooltips gained with the owner's rule of 2026-09-25 (every
// tooltip complete) and the three helpers that move them between the dictionary, a list's props
// and `/{l}/paneles.json`. A module of its own, with no import, so a list island that only merges
// the labels (PokedexRoot, TiersRoot) does not take the tooltip builders into its initial JS
// (13.6); src/lib/game/tips.ts re-exports it. Its one import is a type.
import type { TipLabels } from '@/lib/game/tips';

/**
 * The labels of the rows the panels gained with the owner's rule of 2026-09-25 (every tooltip
 * complete): what a held item, a Poké Ball, a stone, a Mega Stone, a Pokémon, an element, an
 * aura and an addon show besides the rows of `TipLabels`. They are the `ui.tooltip` leaves listed
 * in `TIP_EXTRA_LABELS`. A list island whose props are at their budget receives them with
 * `/{l}/paneles.json` instead (`etiquetas`, `withTipLabels`), so until the file is here its
 * panels simply have fewer rows; every other caller passes the whole `ui.tooltip`. A missing
 * label drops its row, like a missing value (T32).
 */
export type TipExtraLabels = {
  /** «Ranura» / «Slot»: the held slot, X or Y (16.2.3). */
  slot: string;
  /** «Mega Evolución de» / «Mega Evolution of»: the Pokémon a Mega Stone evolves. */
  megaOf: string;
  /** «Evoluciona» / «Evolves»: the Pokémon an evolution item evolves. */
  evolves: string;
  /** «Mercado» / «Market»: whether the game's Market takes the item. */
  market: string;
  /** «Comercializable» / «Tradeable»: the value of `market` for `mercado: true`. */
  tradeable: string;
  /** «No vendible» / «Not sellable»: the value of `market` for `mercado: false`. */
  notTradeable: string;
  /** «Se obtiene en» / «Obtained from»: the game's shops, the pass, the calendar, tasks, crafting. */
  obtainedFrom: string;
  /** «Battle Pass», a game term. */
  battlePass: string;
  /** «Calendario» / «Calendar». */
  calendar: string;
  /** «Crafteo» / «Crafting». */
  crafting: string;
  /** «{count} por {price}» / «{count} for {price}»: a shop offer of a pack, «100 por 5 Diamonds». */
  offer: string;
  /** «Día {n}» / «Day {n}»: the first calendar day of a «Calendario» row. */
  day: string;
  /** «tras el día 21» / «after day 21»: the calendar reward of every day after the 21st. */
  afterDay21: string;
  /** «Tasa de captura» / «Catch rate»: a Ball's multiplier. */
  catchRate: string;
  /** «Más efectiva con» / «Best against»: the elements or the kind of Pokémon a Ball favours. */
  bestAgainst: string;
  /** «Pokémon {trait}» / «{trait} Pokémon»: a Ball's kind of Pokémon, `{trait}` Fast or Heavy. */
  traitPokemon: string;
  /** «Aura», a game term: the aura a Ball unlocks. */
  aura: string;
  /** «Viene con» / «Comes with»: the Ball that unlocks an aura. */
  comesWith: string;
  /** «Ball», a game term: the elemental Ball of an element. */
  ball: string;
  /** «Nº» / «No.»: a Pokémon's number in the Pokédex. */
  number: string;
  /** «Moveset», a game term: the element of a Pokémon's area moves (16.2.2). */
  moveset: string;
  /** «Rasgos» / «Traits»: Fast and Heavy, the game terms of its Pokédex. */
  traits: string;
  /** «Habilidades» / «Abilities»: its field abilities (Fly, Surf, Dig…), game terms. */
  abilities: string;
  /** «Pokémon», the same in both locales: the Pokémon an addon dresses. */
  pokemon: string;
  /** «Mega Stone», a game term: the stone that gives a Mega form. */
  megaStone: string;
  /** «Débil a» / «Weak to»: the elements that hit a Pokémon for ×2 or ×1,5 (its `efectividad`). */
  weakTo: string;
  /** «Resiste» / «Resists»: the elements that hit it for ×0,5 or ×0,4. */
  resists: string;
  /** «Inmune» / «Immune»: the elements that hit it for ×0. */
  immune: string;
};

/** The keys of `TipExtraLabels`, in the order of the dictionary. */
export const TIP_EXTRA_LABELS = [
  'slot',
  'megaOf',
  'evolves',
  'market',
  'tradeable',
  'notTradeable',
  'obtainedFrom',
  'battlePass',
  'calendar',
  'crafting',
  'offer',
  'day',
  'afterDay21',
  'catchRate',
  'bestAgainst',
  'traitPokemon',
  'aura',
  'comesWith',
  'ball',
  'number',
  'moveset',
  'traits',
  'abilities',
  'pokemon',
  'megaStone',
  'weakTo',
  'resists',
  'immune',
] as const satisfies readonly (keyof TipExtraLabels)[];

/**
 * `messages.ui` as a list island receives it: no `money` (it draws no amount), and a `tooltip`
 * whose labels of `TIP_EXTRA_LABELS` may have been left out of the props (`leanTipLabels`).
 */
export type ListUi<Ui extends { tooltip: object }> = Omit<Ui, 'money' | 'tooltip'> & {
  tooltip: Omit<Ui['tooltip'], keyof TipExtraLabels> & Partial<TipExtraLabels>;
};

/**
 * `ui.tooltip` without the labels of `TIP_EXTRA_LABELS`: what a list island whose props are
 * at their budget receives (13.6); `/{l}/paneles.json` carries the rest (`tipExtraLabels`).
 */
export function leanTipLabels<Labels extends TipLabels>(
  labels: Labels,
): Omit<Labels, keyof TipExtraLabels> {
  const lean: Record<string, unknown> = { ...labels };
  for (const key of TIP_EXTRA_LABELS) delete lean[key];
  return lean as Omit<Labels, keyof TipExtraLabels>;
}

/** The labels of `TIP_EXTRA_LABELS` of `labels`: the `etiquetas` of `/{l}/paneles.json`. */
export function tipExtraLabels(labels: TipLabels): Partial<TipExtraLabels> {
  const extra: Partial<TipExtraLabels> = {};
  for (const key of TIP_EXTRA_LABELS) {
    const value = labels[key];
    if (typeof value === 'string') extra[key] = value;
  }
  return extra;
}

/**
 * The labels of a list island: the ones of its props, plus the `etiquetas` of
 * `/{l}/paneles.json` once it is here (`null` before). An `etiquetas` that is not an object of
 * texts adds nothing.
 */
export function withTipLabels<Labels extends object>(labels: Labels, extra: unknown): Labels {
  if (extra === null || typeof extra !== 'object') return labels;
  // The file writes only the keys of `TIP_EXTRA_LABELS` (`tipExtraLabels`); reading them without
  // the list keeps it out of the islands' initial JS.
  const known = Object.entries(extra).filter(([, value]) => typeof value === 'string');
  return known.length === 0 ? labels : { ...labels, ...Object.fromEntries(known) };
}
