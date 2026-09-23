// Build-time outfit lookup for Astro pages: content/outfits.json gives the
// outfit id of each Pokémon and public/sprites/sprites.json its idle frame per
// direction ("outfits/<outfitId>"). Islands receive the resolved result.
import { getOutfitForPokemon, getSpriteRegistry } from './registry';
import { spriteUrl, type SpriteDirection } from '@/lib/sprites/resolve';

export type OutfitDirection = 'north' | 'east' | 'south' | 'west';

export const outfitDirections: OutfitDirection[] = ['north', 'east', 'south', 'west'];

const spriteDirection: Record<OutfitDirection, SpriteDirection> = {
  north: 'norte',
  east: 'este',
  south: 'sur',
  west: 'oeste',
};

export type PokemonOutfit = {
  slug: string;
  outfitId: number;
  width: number;
  height: number;
  frames: Record<OutfitDirection, string>;
};

export function outfitSpriteKey(outfitId: number): string {
  return `outfits/${outfitId}`;
}

/** The Pokémon's outfit with its four idle frames, or null when not registered. */
export function getPokemonOutfit(slug: string): PokemonOutfit | null {
  const record = getOutfitForPokemon(slug);
  if (!record) return null;
  const registry = getSpriteRegistry();
  const key = outfitSpriteKey(record.outfitId);
  const entry = Object.hasOwn(registry, key) ? registry[key] : undefined;
  if (!entry?.direcciones) return null;
  const { direcciones } = entry;
  return {
    slug,
    outfitId: record.outfitId,
    width: entry.frame[0],
    height: entry.frame[1],
    frames: Object.fromEntries(
      outfitDirections.map((direction) => [
        direction,
        spriteUrl(direcciones[spriteDirection[direction]]),
      ]),
    ) as Record<OutfitDirection, string>,
  };
}
