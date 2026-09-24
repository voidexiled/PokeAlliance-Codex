import type { SpriteProps } from '@/components/game/Sprite';
import uiSprites from 'virtual:ac-ui-sprites';

import { getSpriteEntry, spriteUrl } from './resolve';

// The sprites the game layer draws on every list — the Shiny mark, the client Pokédex «?» and
// the no-choice icon of a picker slot — read from `virtual:ac-ui-sprites`, the registry cut
// down to those three keys in the build (astro.config.mjs). Importing
// src/lib/sprites/registry.ts in a list island would put the whole registry in its first load
// (D-015, 13.6).

export type UiSpriteKey = 'ui/shiny' | 'ui/pokemon-desconocido' | 'ui/none';

export function hasUiSprite(key: UiSpriteKey): boolean {
  return Object.hasOwn(uiSprites, key);
}

/** The registry entry of a key `hasUiSprite` answered for. */
export function uiSpriteEntry(key: UiSpriteKey) {
  return getSpriteEntry(uiSprites, key);
}

/** URL of the image of a key `hasUiSprite` answered for. */
export function uiSpriteSrc(key: UiSpriteKey): string {
  return spriteUrl(getSpriteEntry(uiSprites, key).archivo);
}

/** The sprite of a key as `Sprite` takes it, or `null` while the registry has none. */
export function uiSpriteProps(key: UiSpriteKey): SpriteProps | null {
  if (!hasUiSprite(key)) return null;
  const entry = getSpriteEntry(uiSprites, key);
  return {
    src: spriteUrl(entry.archivo),
    size: entry.frame,
    frames: entry.frames,
    mode: entry.modo,
  };
}
