// The picker records of the Comercio composer and filters (spec 16.3.3, 16.4.4, 16.4.6), built
// from the rows of `/{l}/pokedex/datos.json` and `/{l}/items/datos.json` (PR5). Island-safe: no
// Zod, no repository. `held` and `mega` are read from an item row once the Items file carries
// them (16.2.3); until then no item is a held or a Mega Stone and those pickers stay hidden.
import type { SpriteProps } from '@/components/game/Sprite';
import { resolvePokemonImage } from '@/lib/content/pokemon-media';
import type { PokemonTier } from '@/lib/content/types';
import type { TipData } from '@/lib/game/tips';
import type { HeldInfo } from '@/lib/pickers/model';
import type { ItemPickerRecord, PokemonPickerRecord } from '@/lib/pickers/options';

/** The part of a Pokédex row a Pokémon slot reads. */
export interface RosterRow {
  id: string;
  nombre: string;
  numero: number | null;
  generacion: number | null;
  variante: string;
  tier: PokemonTier | null;
  elementos: readonly string[];
  imagen: string | null;
  elementoMoveset?: string | null;
}

/** The part of an Items row an item slot reads, with `held` and `mega` when present. */
export interface ItemRow {
  id: string;
  nombre: string;
  categoria: string;
  sprite: SpriteProps | null;
}

/** The Market category of the Balls (content/items/categorias.json). */
export const BALL_CATEGORY = 'poke-balls';

/** The portrait of a Pokémon as a slot sprite (16.3.3: the outfit is used where it exists). */
export function portraitSprite(imagen: string | null): SpriteProps | null {
  const src = resolvePokemonImage(imagen);
  return src === null ? null : { src, smooth: true };
}

export function rosterPickerRecords(
  rows: readonly RosterRow[],
  tip: (row: RosterRow) => TipData,
  outfit?: (id: string) => SpriteProps | null | undefined,
): PokemonPickerRecord[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.nombre,
    number: row.numero,
    types: [...row.elementos],
    elementoMoveset: row.elementoMoveset ?? null,
    tier: row.tier,
    shiny: row.variante === 'shiny',
    generation: row.generacion,
    sprite: outfit?.(row.id) ?? portraitSprite(row.imagen),
    tip: tip(row),
  }));
}

/** `held` of an item row (16.2.3), or `null`. */
export function heldOf(row: object): HeldInfo | null {
  const held = (row as { held?: unknown }).held;
  if (typeof held !== 'object' || held === null) return null;
  const { ranura, efecto, tier } = held as Record<string, unknown>;
  return (ranura === 'x' || ranura === 'y') &&
    typeof efecto === 'string' &&
    typeof tier === 'number'
    ? { ranura, efecto, tier }
    : null;
}

/** `mega` of an item row (16.2.3), or `null`. */
export function megaOf(row: object): { pokemon: string[] } | null {
  const mega = (row as { mega?: unknown }).mega;
  if (typeof mega !== 'object' || mega === null) return null;
  const pokemon = (mega as { pokemon?: unknown }).pokemon;
  return {
    pokemon: Array.isArray(pokemon)
      ? pokemon.filter((id): id is string => typeof id === 'string')
      : [],
  };
}

export function itemPickerRecords(
  rows: readonly ItemRow[],
  tip: (row: ItemRow) => TipData,
): ItemPickerRecord[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.nombre,
    categoria: row.categoria,
    sprite: row.sprite,
    tip: tip(row),
    held: heldOf(row),
    mega: megaOf(row),
  }));
}

/** An aura or an addon as an inline slot (16.3.3). */
export interface SlotEntity {
  id: string;
  nombre: string;
  icono: SpriteProps | null;
}

export function slotRecords(entities: readonly SlotEntity[]) {
  return entities.map((entity) => ({
    id: entity.id,
    name: entity.nombre,
    sprite: entity.icono,
    tip: {
      key: `slot:${entity.id}`,
      title: entity.nombre,
      width: 300,
      head: { type: 'sprite' as const, sprite: entity.icono },
      rows: [],
    } satisfies TipData,
  }));
}

/** The URL filters of the Comercio list (16.4.6): `?pokemon=a,b&item=c`. */
export function readIdList(value: string | null): string[] {
  if (value === null) return [];
  const ids = value
    .split(',')
    .map((id) => id.trim())
    .filter((id) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id));
  return [...new Set(ids)];
}

export function writeIdList(ids: readonly string[]): string | null {
  return ids.length === 0 ? null : ids.join(',');
}

/**
 * Whether a listing matches the Pokémon and Ítem filters (16.4.6): with none chosen, every one;
 * otherwise a listing of one of the chosen Pokémon or of one of the chosen items.
 */
export function matchesEntityFilters(
  listing: { pokemon: { pokemon: string } | null; item: { item: string } | null },
  pokemon: readonly string[],
  items: readonly string[],
): boolean {
  if (pokemon.length === 0 && items.length === 0) return true;
  if (listing.pokemon !== null && pokemon.includes(listing.pokemon.pokemon)) return true;
  return listing.item !== null && items.includes(listing.item.item);
}
