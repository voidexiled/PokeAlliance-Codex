import { describe, expect, it } from 'vitest';

import { getAlternateLocale, getLocale, getPathLocale, isLocale, locales } from '@/i18n/config';

describe('locale contract', () => {
  it('only publishes the configured locale routes', () => {
    expect(locales).toEqual(['es', 'en']);
    expect(isLocale('es')).toBe(true);
    expect(isLocale('pt')).toBe(false);
  });

  it('alternates between supported locales', () => {
    expect(getAlternateLocale('es')).toBe('en');
    expect(getAlternateLocale('en')).toBe('es');
  });

  // §8.0.1: a `[locale]` route is generated for `es` and `en` alone, and `/xx/…` reaches the
  // 404 instead of falling back to `es`, so an unknown value is an error, not Spanish.
  it('reads a supported locale and refuses any other value', () => {
    expect(getLocale('es')).toBe('es');
    expect(getLocale('en')).toBe('en');
    expect(() => getLocale('unknown')).toThrow();
    expect(() => getLocale('xx')).toThrow();
    expect(() => getLocale('')).toThrow();
    expect(() => getLocale(undefined)).toThrow();
  });

  // §8.12: the 404 speaks the language its path starts with: `/en` and `/en/…` read English,
  // any other path Spanish, `/xx/…` included.
  it('picks the language of a requested path for the 404', () => {
    expect(getPathLocale('/en')).toBe('en');
    expect(getPathLocale('/en/')).toBe('en');
    expect(getPathLocale('/en/does-not-exist/')).toBe('en');
    expect(getPathLocale('/es/no-existe/')).toBe('es');
    expect(getPathLocale('/xx/')).toBe('es');
    expect(getPathLocale('/xx/pokedex/')).toBe('es');
    expect(getPathLocale('/english/')).toBe('es');
    expect(getPathLocale('/enx/')).toBe('es');
    expect(getPathLocale('/')).toBe('es');
    expect(getPathLocale('')).toBe('es');
  });
});
