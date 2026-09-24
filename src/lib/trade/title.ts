// The title of a Comercio listing (spec 9.4): what its card, its detail h1, its last crumb, its
// slot and its tooltip call it. A pure function of the listing and the registry names, so the
// build and an island write the same title.
import type { Locale } from '@/i18n/config';
import {
  formatDiamonds,
  formatInteger,
  formatPokedolares,
  formatPokedolaresLabel,
} from '@/lib/format/numbers';
import { UNKNOWN, present } from '@/lib/format/unknown';

import type { Anuncio } from './types';

/**
 * The registry names a listing shows and never stores (9.4): the build reads them from the
 * registries and an island from the references of its data. `undefined` or `null` means the
 * registry has no such id.
 */
export interface ListingNames {
  /** `nombre` of a Pokémon of content/pokemon.json. */
  pokemon: (id: string) => string | null | undefined;
  /** `nombre` of an item of content/items/: a traded item, a Ball, a held item. */
  item: (id: string) => string | null | undefined;
  /** `nombre` of an addon of content/outfits.json. */
  addon: (id: string) => string | null | undefined;
  /** `nombre` of an aura of content/auras.json. */
  aura: (id: string) => string | null | undefined;
  /** `nombre` of a world of content/mundos.json. */
  mundo: (id: string) => string | null | undefined;
  /** `nombre` of a seller by handle. */
  vendedor: (handle: string) => string | null | undefined;
  /** Tier of a held item of content/items/ (16.2.3); without it a held shows no tier. */
  heldTier?: (id: string) => number | null | undefined;
}

/** The two forms of a title (9.4). */
export interface ListingTitle {
  /** What the page shows. */
  texto: string;
  /** What a screen reader hears: `texto`, except the exact figure of Pokédólares (R5). */
  accesible: string;
}

/** What the title reads of a listing; a draft of the form has it too (9.7.6). */
export type ListingTitleInput = Pick<Anuncio, 'tipo' | 'pokemon' | 'item' | 'cantidad'>;

/** A whole amount of the listing, 1 or more in base units (9.4), or `null`. */
export function knownAmount(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null;
}

/**
 * The registry's name of an entity id (16.2.5): the registry writes the game's name as the client
 * does (13.4). An id without a record has no name.
 */
export function entityName(
  id: string | null,
  lookup: (id: string) => string | null | undefined,
): string | null {
  const known = id === null ? null : lookup(id);
  return present(known) ? (known as string) : null;
}

/**
 * `figure` followed by the currency word that `formatPokedolaresLabel` writes after the exact
 * figure, with its plural for `units`: «50kk Pokédólares», «1.234.567 Pokédólares»,
 * «50kk Pokédollars». The word lives in src/lib/format/numbers.ts only.
 */
export function pokedolaresText(figure: string, units: number, locale: Locale): string {
  const exact = formatInteger(units, locale);
  return figure + formatPokedolaresLabel(units, locale).slice(exact.length);
}

/**
 * `listingTitle(anuncio, locale)` of 9.4, with the registry names it reads:
 *
 * - `pokemon`: the Pokémon's registry name («Shiny Ditto»), never the nickname;
 * - `items`: the item's registry name, or the declared one («Fire Stone»); the quantity is a
 *   fact, not part of the title;
 * - `diamonds`: the grouped figure and the game term («2.400 Diamonds»);
 * - `pokedolares`: the short form of `formatPokedolares` («50kk Pokédólares»), and for the
 *   screen reader the exact figure («50.000.000 Pokédólares»).
 *
 * `texto` and `accesible` are the same except for Pokédólares. A value the listing does not
 * have gives «—» (G7).
 */
export function listingTitle(
  anuncio: ListingTitleInput,
  locale: Locale,
  names: Pick<ListingNames, 'pokemon' | 'item'>,
): ListingTitle {
  let texto: string | null = null;
  let accesible: string | null = null;

  if (anuncio.tipo === 'pokemon') {
    const id = anuncio.pokemon?.pokemon;
    const name = id ? names.pokemon(id) : null;
    texto = present(name) ? (name as string) : null;
  } else if (anuncio.tipo === 'items') {
    const item = anuncio.item;
    texto = item === undefined ? null : entityName(item.item, names.item);
  } else {
    const units = knownAmount(anuncio.cantidad);
    if (units !== null && anuncio.tipo === 'diamonds') texto = formatDiamonds(units, locale);
    if (units !== null && anuncio.tipo === 'pokedolares') {
      texto = pokedolaresText(formatPokedolares(units, locale), units, locale);
      accesible = formatPokedolaresLabel(units, locale);
    }
  }

  const shown = texto ?? UNKNOWN;
  return { texto: shown, accesible: accesible ?? shown };
}
