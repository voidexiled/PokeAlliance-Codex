// The module `moneySpritesModule` of astro.config.mjs serves for the game layer:
// public/sprites/sprites.json cut down in the build to the entries of `ui/shiny`,
// `ui/pokemon-desconocido` and `ui/none`. A key the registry does not have yet is absent.
declare module 'virtual:ac-ui-sprites' {
  import type { SpriteRegistry } from '@/lib/sprites/resolve';

  const registry: SpriteRegistry;
  export default registry;
}

// `ui/elementos/*`, `ui/categorias/*` and `ui/estrellas/*` of public/sprites/sprites.json, for
// src/lib/pickers/sprites.ts (astro.config.mjs, `SPRITE_CUTS`).
declare module 'virtual:ac-picker-sprites' {
  import type { SpriteRegistry } from '@/lib/sprites/resolve';

  const registry: SpriteRegistry;
  export default registry;
}
