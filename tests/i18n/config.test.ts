import { describe, expect, it } from 'vitest';

import { getAlternateLocale, getLocale, isLocale, locales } from '@/i18n/config';

describe('locale contract', () => {
  it('only publishes the configured locale routes', () => {
    expect(locales).toEqual(['es', 'en']);
    expect(isLocale('es')).toBe(true);
    expect(isLocale('pt')).toBe(false);
  });

  it('falls back explicitly and alternates between supported locales', () => {
    expect(getLocale('unknown')).toBe('es');
    expect(getAlternateLocale('es')).toBe('en');
    expect(getAlternateLocale('en')).toBe('es');
  });
});
