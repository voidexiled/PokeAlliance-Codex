// The module `moneySpritesModule` of astro.config.mjs serves for the game layer:
// public/sprites/sprites.json cut down in the build to the entries of `ui/shiny`,
// `ui/pokemon-desconocido` and `ui/none`. A key the registry does not have yet is absent.
declare module 'virtual:ac-ui-sprites' {
  import type { SpriteRegistry } from '@/lib/sprites/resolve';

  const registry: SpriteRegistry;
  export default registry;
}
