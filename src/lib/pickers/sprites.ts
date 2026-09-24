// Island-safe helpers that turn a sprite registry key into Sprite props, or null while the
// registry has no entry for it (the caller then draws its CSS fallback).
import type { SpriteProps } from '@/components/game/Sprite';
import { getSprite, hasSprite, spriteSrc } from '@/lib/sprites/registry';

export function uiSprite(key: string): SpriteProps | null {
  if (!hasSprite(key)) return null;
  const entry = getSprite(key);
  return { src: spriteSrc(key), size: entry.frame, frames: entry.frames, mode: entry.modo };
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
