// The single text normaliser of the site's search (spec 7.9.1): NFD, diacritics
// removed, lowercase. It replaces the private copies of the old search components: the
// one of PokedexGrid.tsx left with it in M7, and the ones of ContentSearch.tsx and of
// `searchRecords` in src/lib/content/repository.ts left with them in M10.
//
// Both sides of the search use it: the build writes the index of
// src/pages/[locale]/buscar/indice.json.ts with it, and the browser normalises
// the query with it before scoring (src/lib/search/rank.ts).

/** Combining marks of the Unicode block that NFD leaves behind. */
const DIACRITICS = /[̀-ͯ]/g;

/** Any run of whitespace, collapsed to one space inside a query. */
const SPACES = /\s+/g;

/** Anything that is neither a letter nor a digit separates two words. */
const WORD_BREAK = /[^\p{L}\p{N}]+/u;

/**
 * `Charizard`, `charizard` and `CHARIZARD` normalise to the same text, and so do
 * `Pokédex` and `pokedex`.
 *
 * `toLowerCase` and not `toLocaleLowerCase`: the index is written in the build
 * (Node) and matched in the browser, so the result cannot depend on the locale
 * of the host that runs the code.
 */
export function normalize(value: string): string {
  return value.normalize('NFD').replace(DIACRITICS, '').toLowerCase();
}

/**
 * The query as it is compared: normalised, with the outer whitespace gone and
 * the inner runs collapsed, so `  nº  6 ` and `nº 6` are one query.
 */
export function normalizeQuery(value: string): string {
  return normalize(value).replace(SPACES, ' ').trim();
}

/**
 * The words of a text, already normalised, for the «prefix of a word of the
 * name» score of spec 7.9.4: `Shiny Charizard` is matched by `char`.
 */
export function words(value: string): string[] {
  return normalize(value)
    .split(WORD_BREAK)
    .filter((word) => word.length > 0);
}
