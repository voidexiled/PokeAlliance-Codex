import { describe, expect, it } from 'vitest';

import { getAlternatePath, locales } from '@/i18n/config';

describe('getAlternatePath', () => {
  it('keeps the route and swaps the locale segment', () => {
    expect(getAlternatePath('/es/pokedex/charizard/', 'en')).toBe('/en/pokedex/charizard/');
    expect(getAlternatePath('/en/pokedex/charizard/', 'es')).toBe('/es/pokedex/charizard/');
    expect(getAlternatePath('/es/', 'en')).toBe('/en/');
    expect(getAlternatePath('/en/', 'es')).toBe('/es/');
  });

  it('prefixes a route that carries no locale', () => {
    expect(getAlternatePath('/pokedex/', 'es')).toBe('/es/pokedex/');
    expect(getAlternatePath('/pokedex/charizard/', 'en')).toBe('/en/pokedex/charizard/');
    expect(getAlternatePath('/', 'es')).toBe('/es/');
    expect(getAlternatePath('', 'es')).toBe('/es/');
  });

  it('normalises the trailing slash and leaves file routes alone', () => {
    expect(getAlternatePath('/es/pokedex', 'en')).toBe('/en/pokedex/');
    expect(getAlternatePath('/es/buscar/indice.json', 'en')).toBe('/en/buscar/indice.json');
  });

  it('drops query and hash: the prerendered link goes to the plain route', () => {
    expect(getAlternatePath('/es/pokedex/?elemento=fire#drops', 'en')).toBe('/en/pokedex/');
    expect(getAlternatePath('/es/pokedex/#drops', 'en')).toBe('/en/pokedex/');
  });

  it('round-trips every locale', () => {
    for (const locale of locales) {
      const path = getAlternatePath('/es/sistemas/boost/', locale);
      expect(getAlternatePath(path, 'es')).toBe('/es/sistemas/boost/');
    }
  });
});
