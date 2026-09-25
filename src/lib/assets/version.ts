// The content versions of the game images (spec 7.4.1), written by astro.config.mjs from the
// bytes of public/sprites/ and public/pokemon/ (scripts/lib/asset-versions.mjs). Client-safe:
// two constants and two functions, so every island carries them for a few bytes.
//
// A sprite that changes under the same name (ui/diamond went from a 7-frame coin to a 22-frame
// gem) must be a new URL, or a cached copy of the old strip is drawn with the frames of the new
// one. The version is added where a URL meets the page, in the components that write an `<img>`
// (`Sprite`, `PokemonArt`, the money amounts, the Shiny mark, the sidebar, the palette), with
// `assetSrc`: the data (`sprites.json`, `datos.json`, `paneles.json`, the search index, the
// props of the lists) keeps the bare path, so the version costs them nothing (§13.6). The data
// files are fetched with the sprites' version (`versioned`), so the frames a row carries
// (`"3028x22"`) and the version the island adds to its URL always come from the same build.

/** Version of public/sprites/, or `''` where the build defines none. */
export const SPRITES_VERSION: string =
  typeof __AC_SPRITES_VERSION__ === 'string' ? __AC_SPRITES_VERSION__ : '';

/** Version of public/pokemon/, or `''` where the build defines none. */
export const POKEMON_ART_VERSION: string =
  typeof __AC_POKEMON_ART_VERSION__ === 'string' ? __AC_POKEMON_ART_VERSION__ : '';

/** `url` with `?v=<version>` (the sprites' version by default); unchanged without a version. */
export function versioned(url: string, version: string = SPRITES_VERSION): string {
  return version ? `${url}?v=${version}` : url;
}

/**
 * The URL an `<img>` loads for a path of public/sprites/ or public/pokemon/: the path with its
 * folder's version. Any other URL (an absolute one, a path that already has a query) is
 * returned as it is, so applying it twice changes nothing.
 */
export function assetSrc(src: string): string {
  if (src.includes('?')) return src;
  if (src.startsWith('/sprites/')) return versioned(src, SPRITES_VERSION);
  if (src.startsWith('/pokemon/')) return versioned(src, POKEMON_ART_VERSION);
  return src;
}
