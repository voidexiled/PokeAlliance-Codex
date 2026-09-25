// What the search palette (src/components/search/SearchPalette.tsx) loads with its first index:
// the reader of the packed file and the ranking of 7.9.4. The palette is in the initial
// JavaScript of every page (13.6), so it imports this module with `import()` only when it opens
// for the first time: the ranking travels with the index, not before it.
export { expandSearchIndex } from './index-file';
export { rankSearch } from './rank';
