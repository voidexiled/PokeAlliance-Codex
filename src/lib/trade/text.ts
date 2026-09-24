// The copied text of a listing (spec 9.7.7): what «Copiar anuncio» puts on the clipboard in
// phase A, and what the read-only «Texto del anuncio» shows when the copy fails. Plain text in
// the page's language, one line per declared datum in the order of the listing's sheet (9.6).
import type { Locale } from '@/i18n/config';
import { formatTier } from '@/lib/content/format';
import {
  formatDiamonds,
  formatInteger,
  formatPercent,
  formatRealMoney,
  formatSigned,
} from '@/lib/format/numbers';
import { present } from '@/lib/format/unknown';

import { compactKks, parsePrice } from './draft';
import { entityName, knownAmount, listingTitle, pokedolaresText } from './title';
import type { ListingNames } from './title';
import { HABILIDADES } from './types';
import type { Anuncio, Precio, PrecioReal, UnidadPokemon } from './types';

/**
 * The labels of the lines, from the dictionary of the page (13.2). The game terms (Nickname,
 * Ball, Aura, Boost, Memory Slots, Star Level, NPC Price, Unsellable, Addon, Next Boost
 * chance, Held Items, Ditto Memory) are the same in both languages (T23).
 */
export interface ListingTextLabels {
  /** «Vendo» / «Selling». */
  selling: string;
  nickname: string;
  ball: string;
  aura: string;
  boost: string;
  memorySlots: string;
  starLevel: string;
  npcPrice: string;
  /** The value of an NPC Price the NPC does not pay. */
  unsellable: string;
  addon: string;
  nextBoostChance: string;
  heldItems: string;
  /** «Mega Stone»; the canonical game term when absent. */
  mega?: string;
  /** «Entrenamiento» / «Training». */
  training: string;
  dittoMemory: string;
  /** «Cantidad» / «Quantity», the amount of an items listing. */
  quantity: string;
  /** «Precio» / «Price», the line of a listing «A convenir». */
  price: string;
  /** «A convenir» / «Negotiable». */
  negotiable: string;
  /** «Dinero real» / «Real money». */
  fiat: string;
  /** «En el juego» / «In-game». */
  game: string;
  /** «Mundo» / «World». */
  world: string;
  /** «o» / «or», between two in-game options (13.3). */
  or: string;
}

/** What the text reads of a listing; the draft of the form has all of it (9.7.7). */
export type ListingTextInput = Pick<
  Anuncio,
  'tipo' | 'pokemon' | 'item' | 'cantidad' | 'precio' | 'mundo'
>;

/**
 * An amount of Pokédólares in the text: the short form only when it is exact, otherwise the
 * exact figure grouped in the language (E12). The text has no accessible figure, so it never
 * rounds.
 */
function pokedolaresFigure(units: number, locale: Locale): string {
  return compactKks(units) ?? formatInteger(units, locale);
}

/**
 * A declared percentage («53», «12.5»; 9.4) with the decimals it was declared with, in the
 * format of the language: «53%», «12,5%».
 */
function percentText(value: string | null, locale: Locale): string | null {
  if (value === null) return null;
  const text = value.trim().replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return null;
  const decimals = text.split('.')[1]?.length ?? 0;
  return formatPercent(Number(text), locale, { decimals });
}

/**
 * A real price. On the page `formatRealMoney` keeps the symbol and the figure together with a
 * hard space; plain text has no line to break, so it carries an ordinary space: «R$ 90».
 */
function realMoneyText(real: PrecioReal, locale: Locale): string | null {
  const value = parsePrice(real.importe, real.moneda, locale);
  if (value === null) return null;
  return formatRealMoney(value, real.moneda, locale).replace('\u00a0', ' ');
}

/** The registry names the text reads; phase A has no seller (9.7.6). */
export type ListingTextNames = Pick<
  ListingNames,
  'pokemon' | 'item' | 'addon' | 'aura' | 'mundo' | 'heldTier'
>;

/** «Vendo: …»: the title of 9.4, with the exact amount of Pokédólares (E12). */
function sellingTitle(anuncio: ListingTextInput, locale: Locale, names: ListingTextNames): string {
  const units = knownAmount(anuncio.cantidad);
  if (anuncio.tipo === 'pokedolares' && units !== null) {
    return pokedolaresText(pokedolaresFigure(units, locale), units, locale);
  }
  return listingTitle(anuncio, locale, names).texto;
}

type AddLine = (label: string, value: string | null | undefined) => void;

/** The registry names of a list of ids, joined; ids without a record are left out. */
function namesOf(
  ids: readonly string[],
  lookup: (id: string) => string | null | undefined,
): string {
  return ids.flatMap((id) => (present(lookup(id)) ? [lookup(id) as string] : [])).join(', ');
}

/** The declared Pokémon, in the order of its sheet (9.6): rows first, then the sections. */
function pokemonLines(
  unit: UnidadPokemon,
  locale: Locale,
  names: ListingTextNames,
  labels: ListingTextLabels,
  add: AddLine,
): void {
  add(labels.nickname, unit.nickname);
  add(labels.ball, entityName(unit.ball, names.item));
  add(labels.aura, namesOf(unit.auras, names.aura));
  if (unit.boost !== null) add(labels.boost, formatSigned(unit.boost, locale));
  if (unit.memorySlots !== null) add(labels.memorySlots, formatInteger(unit.memorySlots, locale));
  if (unit.starLevel !== null) add(labels.starLevel, formatInteger(unit.starLevel, locale));
  const npc = unit.precioNpc;
  if (npc?.tipo === 'unsellable') add(labels.npcPrice, labels.unsellable);
  if (npc?.tipo === 'pokedolares') {
    const units = knownAmount(npc.cantidad);
    if (units !== null) add(labels.npcPrice, pokedolaresFigure(units, locale));
  }
  add(labels.addon, namesOf(unit.addons, names.addon));
  add(labels.nextBoostChance, percentText(unit.nextBoostChance, locale));

  const helds = [unit.heldX, unit.heldY].flatMap((id) => {
    const name = entityName(id, names.item);
    if (name === null || id === null) return [];
    const tier = names.heldTier?.(id);
    return [typeof tier === 'number' ? `${name} ${formatTier(tier)}` : name];
  });
  add(labels.heldItems, helds.join(', '));
  add(labels.mega ?? 'Mega Stone', entityName(unit.mega, names.item));

  const training = unit.entrenamiento
    .slice()
    .sort((a, b) => HABILIDADES.indexOf(a.habilidad) - HABILIDADES.indexOf(b.habilidad))
    .flatMap(({ habilidad, nivel, progreso }) => {
      const percent = percentText(progreso, locale);
      if (nivel === null && percent === null) return [];
      const words: string[] = [habilidad];
      if (nivel !== null) words.push(formatInteger(nivel, locale));
      if (percent !== null) words.push(`(${percent})`);
      return [words.join(' ')];
    });
  add(labels.training, training.join(', '));

  const memories = unit.memorias.flatMap((id) => {
    const name = id === null ? null : names.pokemon(id);
    return present(name) ? [name as string] : [];
  });
  add(labels.dittoMemory, memories.join(', '));
}

/** «Dinero real» and «En el juego», or the «A convenir» line. */
function priceLines(precio: Precio, locale: Locale, labels: ListingTextLabels, add: AddLine): void {
  if (precio.aConvenir) {
    add(labels.price, labels.negotiable);
    return;
  }
  if (precio.real !== null) add(labels.fiat, realMoneyText(precio.real, locale));
  const options = precio.juego.flatMap((option) => {
    const units = knownAmount(option.cantidad);
    if (units === null) return [];
    return [
      option.tipo === 'pokedolares'
        ? pokedolaresFigure(units, locale)
        : formatDiamonds(units, locale),
    ];
  });
  add(labels.game, options.join(` ${labels.or} `));
}

/**
 * `listingText` of 9.7.7: the lines of a listing, joined by line breaks.
 *
 * ```
 * Vendo: {título}
 * {the declared data of the asset, in the order of its sheet}
 * Dinero real: R$ 90
 * En el juego: 150kk o 400 Diamonds
 * Mundo: Sun
 * ```
 *
 * A datum the seller did not declare has no line. The amount of an items listing is its
 * «Cantidad» line; the one of Diamonds and Pokédólares is in the title. Pokédólares are
 * written in the short form only when it is exact, otherwise as the exact grouped figure (E12).
 */
export function listingText(
  anuncio: ListingTextInput,
  locale: Locale,
  names: ListingTextNames,
  labels: ListingTextLabels,
): string {
  const lines: string[] = [];
  const add: AddLine = (label, value) => {
    if (present(value)) lines.push(`${label}: ${value as string}`);
  };

  add(labels.selling, sellingTitle(anuncio, locale, names));
  if (anuncio.tipo === 'pokemon' && anuncio.pokemon !== undefined) {
    pokemonLines(anuncio.pokemon, locale, names, labels, add);
  }
  if (anuncio.tipo === 'items' && anuncio.item !== undefined) {
    const units = knownAmount(anuncio.item.cantidad);
    if (units !== null) add(labels.quantity, formatInteger(units, locale));
  }
  priceLines(anuncio.precio, locale, labels, add);
  add(labels.world, names.mundo(anuncio.mundo));
  return lines.join('\n');
}
