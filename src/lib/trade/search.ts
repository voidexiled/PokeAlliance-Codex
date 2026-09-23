// The search of the Comercio list (spec 9.5.2): the text a listing is found by and the rule a
// query follows. The list controller (`applyListState`, src/lib/lists/state.ts) applies the
// same rule to `ListConfig.text`, so `matches` and the list never disagree.
import type { Locale } from '@/i18n/config';
import { formatDiamonds, formatInteger, formatRealMoney } from '@/lib/format/numbers';
import { present } from '@/lib/format/unknown';
import { queryFragments } from '@/lib/lists/state';
import { normalize } from '@/lib/search/normalize';

import { compactKks, parsePrice } from './draft';
import { entityName, knownAmount, listingTitle } from './title';
import type { ListingNames } from './title';
import type { Anuncio, Precio, UnidadPokemon } from './types';

/** What the search reads of a listing. */
export type ListingSearchInput = Pick<
  Anuncio,
  'tipo' | 'pokemon' | 'item' | 'cantidad' | 'precio' | 'mundo' | 'vendedor'
>;

type Term = string | null | undefined;

/** Pokédólares as players type them: «50000000 50kk», the short form only if exact. */
function pokedolaresTerms(units: number): string[] {
  const short = compactKks(units);
  return short === null ? [String(units)] : [String(units), short];
}

/** Diamonds with their name, exact and grouped as the page writes them: «2.400 Diamonds». */
function diamondsTerms(units: number, locale: Locale): string[] {
  return [`${units} Diamonds`, formatDiamonds(units, locale)];
}

/**
 * The declared Pokémon: its name, the nickname as written and without spaces («S U S A N O O»
 * is also «susanoo»), Ball, aura, each held item as «x-attack t5», addon, the names of the
 * memories, and «boost +N», «star level N», «memory slots N».
 */
function pokemonTerms(unit: UnidadPokemon, names: ListingNames): Term[] {
  const terms: Term[] = [names.pokemon(unit.pokemon)];
  if (present(unit.nickname)) {
    const nickname = unit.nickname as string;
    terms.push(nickname, nickname.replace(/\s+/g, ''));
  }
  if (unit.ball !== null) terms.push(entityName(unit.ball.item, unit.ball.nombre, names.item));
  if (unit.aura !== null) terms.push(names.aura(unit.aura));
  for (const held of unit.helds) {
    const name = entityName(held.item, held.nombre, names.item);
    if (name !== null) terms.push(`${name} t${held.tier}`);
  }
  if (unit.addon !== null) terms.push(entityName(unit.addon.id, unit.addon.nombre, names.addon));
  for (const id of unit.memorias) {
    if (id !== null) terms.push(names.pokemon(id));
  }
  if (unit.boost !== null) terms.push(`boost +${unit.boost}`);
  if (unit.starLevel !== null) terms.push(`star level ${unit.starLevel}`);
  if (unit.memorySlots !== null) terms.push(`memory slots ${unit.memorySlots}`);
  return terms;
}

/**
 * The price: the real amount as stored and as the page writes it («90», «R$ 90»), each
 * Pokédólares option exact and in its exact short form («150000000 150kk») and each Diamonds
 * option with its name («400 diamonds»).
 */
function priceTerms(precio: Precio, locale: Locale): Term[] {
  const terms: Term[] = [];
  if (precio.real !== null) {
    const { moneda, importe } = precio.real;
    const value = parsePrice(importe, moneda, locale);
    terms.push(importe);
    if (value !== null) terms.push(formatRealMoney(value, moneda, locale));
  }
  for (const option of precio.juego) {
    const units = knownAmount(option.cantidad);
    if (units === null) continue;
    if (option.tipo === 'pokedolares') terms.push(...pokedolaresTerms(units));
    else terms.push(...diamondsTerms(units, locale));
  }
  return terms;
}

/**
 * `searchText(anuncio, locale)` of 9.5.2: every text a listing is found by, normalised (NFD
 * without diacritics, lowercase) and joined by spaces. A query fragment never holds a space
 * (9.5.2), so no fragment matches across two terms. It carries:
 *
 * - both forms of the title (`listingTitle`, 9.4);
 * - the declared Pokémon (`pokemonTerms`);
 * - the item's name and «×N»;
 * - the amounts, exact and in their exact short form («50000000 50kk»);
 * - the price (`priceTerms`);
 * - the names of the world and of the seller.
 */
export function searchText(
  anuncio: ListingSearchInput,
  locale: Locale,
  names: ListingNames,
): string {
  const title = listingTitle(anuncio, locale, names);
  const terms: Term[] = [title.texto, title.accesible];

  if (anuncio.tipo === 'pokemon' && anuncio.pokemon !== undefined) {
    terms.push(...pokemonTerms(anuncio.pokemon, names));
  }
  if (anuncio.tipo === 'items' && anuncio.item !== undefined) {
    const item = anuncio.item;
    const quantity = knownAmount(item.cantidad);
    terms.push(entityName(item.item, item.nombre, names.item));
    if (quantity !== null) terms.push(`×${quantity}`, `×${formatInteger(quantity, locale)}`);
  }
  const units = knownAmount(anuncio.cantidad);
  if (units !== null && anuncio.tipo === 'pokedolares') terms.push(...pokedolaresTerms(units));
  if (units !== null && anuncio.tipo === 'diamonds') terms.push(...diamondsTerms(units, locale));

  terms.push(...priceTerms(anuncio.precio, locale));
  terms.push(names.mundo(anuncio.mundo), names.vendedor(anuncio.vendedor));

  const text = new Set<string>();
  for (const term of terms) {
    if (present(term)) text.add(normalize((term as string).trim()));
  }
  return [...text].join(' ');
}

/**
 * Whether a listing whose `searchText` is `text` answers `query` (9.5.2): the query is split on
 * spaces and commas, and every fragment is a substring of the text. An empty query does not
 * filter.
 */
export function matches(text: string, query: string): boolean {
  const fragments = queryFragments(query);
  if (fragments.length === 0) return true;
  const haystack = normalize(text);
  return fragments.every((fragment) => haystack.includes(fragment));
}
