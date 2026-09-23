// The module `moneySpritesModule` of astro.config.mjs serves: public/sprites/sprites.json
// cut down in the build to the entries of `ui/pokedolares` and `ui/diamond`, the sprites
// `PokedolaresAmount` and `DiamondsAmount` draw before every amount (7.8, S8). A key the
// registry does not have yet is absent, and `spriteOrNull` answers `null` for it.
declare module 'virtual:ac-money-sprites' {
  import type { SpriteRegistry } from '@/lib/sprites/resolve';

  const registry: SpriteRegistry;
  export default registry;
}
