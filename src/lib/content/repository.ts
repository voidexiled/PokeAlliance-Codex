import locationData from '@content/locations.json';
import moveData from '@content/moves.json';
import pokemonData from '@content/pokemon.json';
import questData from '@content/quests.json';
import rotationData from '@content/rotations.json';
import systemItemData from '@content/system-items.json';
import type { Locale } from '@/i18n/config';
import {
  locationsFileSchema,
  movesFileSchema,
  parseContent,
  pokemonFileSchema,
  questsFileSchema,
  rotationsFileSchema,
  type Quest,
} from './content-schema';
import { getSistema } from './registry';
import { systemItemsFileSchema, type SystemItem } from './registry-schema';
import type { LocationRecord, MoveRecord, PokemonRecord, RotationRecord } from './types';

// Every file is checked against its schema when the site builds; a field that
// is missing, mistyped or not in the schema stops the build with its path.
const pokemon: PokemonRecord[] = parseContent(
  pokemonFileSchema,
  pokemonData,
  'content/pokemon.json',
).pokemon;
const moves: MoveRecord[] = parseContent(
  movesFileSchema,
  moveData,
  'content/moves.json',
).movimientos;
// System items (E16) are read with the mirror of registry-schema.ts, which has the optional
// `sprite` of §3.13 that their slot, their card and their panel draw.
const systemItems: SystemItem[] = parseContent(
  systemItemsFileSchema,
  systemItemData,
  'content/system-items.json',
).objetos;
// Activities (§3.13, §8.9) are typed by their Zod mirror: each text is a `Texto` by language,
// which `textIn` reads for the page's locale.
const quests: Quest[] = parseContent(questsFileSchema, questData, 'content/quests.json').misiones;
const locations: LocationRecord[] = parseContent(
  locationsFileSchema,
  locationData,
  'content/locations.json',
).ubicaciones;
const rotations: RotationRecord[] = parseContent(
  rotationsFileSchema,
  rotationData,
  'content/rotations.json',
).rotaciones;

const collections = {
  pokemon,
  moves,
  locations,
  items: systemItems,
  quests,
  rotations,
} as const;

export type CollectionKey = keyof typeof collections;

export function getPokemon(): PokemonRecord[] {
  return pokemon;
}

export function getPokemonById(id: string): PokemonRecord | undefined {
  return pokemon.find((record) => record.id === id);
}

export function getMoves(): MoveRecord[] {
  return moves;
}

/** Every entry of content/system-items.json, in the order of the file. */
export function getSystemItems(): SystemItem[] {
  return systemItems;
}

/**
 * The items of one system page, in the order of the file: the `sistema-items` list of its
 * automatic «Ítems» section (8.4.2, E16), which exists only when this list has one or more.
 */
export function getSystemItemsOf(sistema: string): SystemItem[] {
  return systemItems.filter((item) => item.sistema === sistema);
}

/**
 * Where a system item is (7.9.1, E16, H7): `/{l}/sistemas/{sistema}/#item-{id}`, its entry in
 * the «Ítems» section of its system page. `null` while that page does not exist in this build
 * (no `sistema`, no record, or a draft under OCULTAR_BORRADORES=1, SI4): then the item has no
 * page and no search entry.
 */
export function getSystemItemHref(item: SystemItem, locale: Locale): string | null {
  const sistema = item.sistema === null ? undefined : getSistema(item.sistema);
  return sistema === undefined ? null : `/${locale}/sistemas/${sistema.id}/#item-${item.id}`;
}

/** Every activity of content/quests.json, in the order of the file (8.9). */
export function getQuests(): Quest[] {
  return quests;
}

export function getLocations(): LocationRecord[] {
  return locations;
}

export function getRotations(): RotationRecord[] {
  return rotations;
}

export { formatList, formatTier } from './format';

/**
 * The collections a link can point at. Locations have no page in this cut: «Ubicaciones y
 * viaje» left with the retired Guías page (8.9, R9, §15), so no link is built for one.
 */
export type LinkedCollection = Exclude<CollectionKey, 'locations'>;

// The index of each collection. The rotations registry is shown on the Tier list (8.8 step 7,
// E1): one `Section` per record, whose `id` is the record's, so a record's link lands on its
// section. The activities have their index (8.9.1) and one page per record (8.9.2).
const collectionPaths: Record<LinkedCollection, string> = {
  pokemon: 'pokedex',
  moves: 'sistemas',
  items: 'sistemas',
  quests: 'actividades',
  rotations: 'pokedex/tiers',
};

export function getCollectionHref(collection: LinkedCollection, locale: Locale): string {
  return `/${locale}/${collectionPaths[collection]}/`;
}

export function getRecordHref(collection: LinkedCollection, id: string, locale: Locale): string {
  if (collection === 'pokemon') return `/${locale}/pokedex/${id}/`;
  if (collection === 'quests') return `/${locale}/actividades/${id}/`;
  return `${getCollectionHref(collection, locale)}#${id}`;
}

export function getCatalogMetrics() {
  return {
    collections: Object.keys(collections).length,
    records: Object.values(collections).reduce((total, records) => total + records.length, 0),
  };
}
