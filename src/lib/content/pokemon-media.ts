import { hasUiSprite, uiSpriteSrc } from '@/lib/sprites/ui-sprites';

/**
 * Sizes of the local WebP copies of the Pokémon art (scripts/assets/pokemon-thumbs.py): 128
 * serves every slot, card and row (64 px or less, sharp at 2x), 140 the portrait of the
 * Pokémon page. The originals are 140 px PNGs of about 21 KB; these weigh 3 to 6 KB.
 */
export type PokemonImageSize = 128 | 140;

/**
 * URL of a Pokémon's art from its `imagen` («/pokemon/001.png»): the local WebP copy of that
 * size, or the value itself when it is already an absolute URL. A copy that does not exist
 * (art the client lacks) fails to load, and the callers then draw the Pokédex «?».
 */
export function resolvePokemonImage(
  source: string | null | undefined,
  size: PokemonImageSize = 128,
): string | null {
  if (!source) return null;
  if (/^https?:\/\//i.test(source)) return source;
  const file = source
    .split('/')
    .pop()
    ?.replace(/\.png$/i, '');
  return file ? `/pokemon/${size}/${file}.webp` : null;
}

/**
 * Registry key of the client Pokédex «?», the 140 px illustration the client draws for a
 * Pokémon it has no art for. The site draws it where a Pokémon has no art or its art fails.
 */
export const POKEMON_UNKNOWN_KEY = 'ui/pokemon-desconocido' as const;

/**
 * URL of the «?» illustration, or `null` while the registry has no entry for it (then the
 * caller keeps the missing mark). Client-safe: it reads `virtual:ac-ui-sprites`, not the whole registry (D-015).
 */
export function pokemonUnknownSrc(): string | null {
  return hasUiSprite(POKEMON_UNKNOWN_KEY) ? uiSpriteSrc(POKEMON_UNKNOWN_KEY) : null;
}

/**
 * Size of the «?» where a Pokémon's art would be drawn at `art` px: three quarters of it, as
 * the boards draw it (48 for the 64 art of a 72 slot or a card, 33 for the 44 of a phone
 * slot, 30 for the 40 of a Lista row), never under 16.
 */
export function pokemonUnknownSize(art: number): number {
  return Math.max(16, Math.round(art * 0.75));
}
