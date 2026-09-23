// Client-safe access to public/sprites/sprites.json. The file is validated by
// `pnpm content:check` and by src/lib/content/registry.ts at build time, so
// React islands read it without bundling the Zod schemas.
import spriteFile from '../../../public/sprites/sprites.json';
import { getSpriteEntry, spriteUrl, type SpriteDirection, type SpriteRegistry } from './resolve';

export const spriteRegistry = spriteFile.sprites as unknown as SpriteRegistry;

export function hasSprite(key: string): boolean {
  return Object.hasOwn(spriteRegistry, key);
}

export function getSprite(key: string) {
  return getSpriteEntry(spriteRegistry, key);
}

/** URL of a sprite's image (a direction's image for outfits). */
export function spriteSrc(key: string, direccion?: SpriteDirection): string {
  const entry = getSpriteEntry(spriteRegistry, key);
  return spriteUrl(direccion && entry.direcciones ? entry.direcciones[direccion] : entry.archivo);
}
