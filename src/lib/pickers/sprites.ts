// Island-safe helpers that turn a sprite registry key into Sprite props, or null while the
// registry has no entry for it (the caller then draws its CSS fallback).
import type { SpriteProps } from '@/components/game/Sprite';
import { getSpriteEntry, spriteUrl } from '@/lib/sprites/resolve';
import pickerSprites from 'virtual:ac-picker-sprites';

// The registry cut down in the build to the `ui/elementos/`, `ui/categorias/` and
// `ui/estrellas/` entries (astro.config.mjs): importing src/lib/sprites/registry.ts here would
// put every item and outfit sprite of the registry in the islands that draw a filter.

export function uiSprite(key: string): SpriteProps | null {
  if (!Object.hasOwn(pickerSprites, key)) return null;
  const entry = getSpriteEntry(pickerSprites, key);
  return {
    src: spriteUrl(entry.archivo),
    size: entry.frame,
    frames: entry.frames,
    mode: entry.modo,
  };
}

/** Icon of an element type (`ui/elementos/<id>`). */
export function elementSprite(id: string, px = 18): SpriteProps | null {
  const sprite = uiSprite(`ui/elementos/${id}`);
  // Element icons are illustrations (ElementChip): smooth, drawn to a size.
  return sprite ? { ...sprite, smooth: true, width: px, height: px } : null;
}

/** Icon of a Market category (`ui/categorias/<id>`). */
export function categorySprite(id: string): SpriteProps | null {
  return uiSprite(`ui/categorias/${id}`);
}
