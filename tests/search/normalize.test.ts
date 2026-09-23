// §7.9.1: `src/lib/search/normalize.ts` is the single `normalize` of the site — NFD,
// diacritics removed, lowercase — and it replaces the private copies of the old search
// components (`PokedexGrid.tsx` left in M7; `ContentSearch.tsx` and `searchRecords` in M10).
//
// Three functions, three jobs: `normalize` is the transformation §7.9.1 names and
// nothing else (it does not trim, so the index keeps the text it was given),
// `normalizeQuery` is what a typed query goes through before it is scored, and `words`
// is what the «prefix of a word of the name» score of §7.9.4 reads.

import { describe, expect, it } from 'vitest';

import { normalize, normalizeQuery, words } from '@/lib/search/normalize';

/** «é» written as one code point and as `e` plus U+0301, the two forms a keyboard emits. */
const PRECOMPOSED = 'é';
const DECOMPOSED = 'é';

describe('normalize', () => {
  it('lowercases the text', () => {
    expect(normalize('Charizard')).toBe('charizard');
    expect(normalize('MEWTWO')).toBe('mewtwo');
    expect(normalize('Tier List')).toBe('tier list');
  });

  it('drops the diacritics', () => {
    expect(normalize('Pokédex')).toBe('pokedex');
    expect(normalize('Pokémon')).toBe('pokemon');
    expect(normalize('ÁÉÍÓÚ')).toBe('aeiou');
    expect(normalize('Ü')).toBe('u');
    expect(normalize('Ç')).toBe('c');
  });

  it('treats the tilde of ñ as one more diacritic, so «nino» finds «Niño»', () => {
    expect(normalize('Niño')).toBe('nino');
    expect(normalize('Español')).toBe('espanol');
  });

  it('gives the same string for the precomposed and the decomposed form', () => {
    expect(normalize(PRECOMPOSED)).toBe(normalize(DECOMPOSED));
    expect(normalize(`caf${PRECOMPOSED}`)).toBe('cafe');
    expect(normalize(`caf${DECOMPOSED}`)).toBe('cafe');
  });

  it('leaves the digits and the marks a Pokédex number is written with', () => {
    // §8.6: «6», «006», «#6» and «nº 6» are four ways of writing one number, so the
    // ordinal indicator and the hash have to survive the normalisation.
    expect(normalize('006')).toBe('006');
    expect(normalize('#6')).toBe('#6');
    expect(normalize('Nº 6')).toBe('nº 6');
    expect(normalize('T3')).toBe('t3');
  });

  it('keeps the whitespace it was given: trimming is the query’s job', () => {
    expect(normalize('  Charizard  ')).toBe('  charizard  ');
  });

  it('is idempotent and answers an empty string with an empty string', () => {
    expect(normalize('')).toBe('');
    const once = normalize('Shiny Charizard · Nivel 90');
    expect(normalize(once)).toBe(once);
  });
});

describe('normalizeQuery', () => {
  it('normalises, trims and collapses the inner runs of whitespace', () => {
    expect(normalizeQuery('  Charizard  ')).toBe('charizard');
    expect(normalizeQuery('  nº  6 ')).toBe('nº 6');
    expect(normalizeQuery('Shiny\tCharizard')).toBe('shiny charizard');
  });

  it('answers a query of only whitespace with an empty string', () => {
    expect(normalizeQuery('   ')).toBe('');
    expect(normalizeQuery('')).toBe('');
  });
});

describe('words', () => {
  it('splits the normalised text on everything that is not a letter or a digit', () => {
    expect(words('Shiny Charizard')).toEqual(['shiny', 'charizard']);
    expect(words('Nivel 90 · T3')).toEqual(['nivel', '90', 't3']);
    expect(words('Mime Jr.')).toEqual(['mime', 'jr']);
    expect(words('Unown-A')).toEqual(['unown', 'a']);
  });

  it('drops the empty pieces the separators leave', () => {
    expect(words('  ·  ')).toEqual([]);
    expect(words('')).toEqual([]);
  });
});
