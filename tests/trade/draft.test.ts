import { describe, expect, it } from 'vitest';

import type { Locale } from '@/i18n/config';
import {
  compactKks,
  isDittoSlug,
  isValidOptionalPercent,
  isValidPrice,
  parsePositiveWhole,
  parsePrice,
} from '@/lib/trade/draft';

// The draft rules that §9.1 keeps from the old composer: whole amounts in the grouping of the
// page's language (§9.7.3), the Ditto test (§9.7.2), optional percentages, prices in the
// currencies of §9.4 (§9.7.4) and the exact short form of the copied text (§9.7.7, E12).

const LOCALES: readonly Locale[] = ['es', 'en'];

describe('parsePositiveWhole', () => {
  it('reads ungrouped digits in both languages', () => {
    for (const locale of LOCALES) {
      expect(parsePositiveWhole('1', locale)).toBe(1);
      expect(parsePositiveWhole('1500', locale)).toBe(1500);
      expect(parsePositiveWhole('50000000', locale)).toBe(50_000_000);
    }
  });

  it('reads the thousands separator of the language: a dot in es and a comma in en (9.1)', () => {
    expect(parsePositiveWhole('1.500', 'es')).toBe(1500);
    expect(parsePositiveWhole('1.000.000', 'es')).toBe(1_000_000);
    expect(parsePositiveWhole('57.960', 'es')).toBe(57_960);
    expect(parsePositiveWhole('1,500', 'en')).toBe(1500);
    expect(parsePositiveWhole('1,000,000', 'en')).toBe(1_000_000);
    expect(parsePositiveWhole('57,960', 'en')).toBe(57_960);
  });

  it('rejects the separator of the other language, which is its decimal separator', () => {
    expect(parsePositiveWhole('1,500', 'es')).toBeNull();
    expect(parsePositiveWhole('1,5', 'es')).toBeNull();
    expect(parsePositiveWhole('1.500', 'en')).toBeNull();
    expect(parsePositiveWhole('1.5', 'en')).toBeNull();
  });

  it('rejects groups that are not of three digits', () => {
    for (const raw of ['1.50', '1.5000', '15.00.000', '1500.000', '.500', '1.', '1..500']) {
      expect(parsePositiveWhole(raw, 'es'), raw).toBeNull();
    }
    for (const raw of ['1,50', '1,5000', '15,00,000', '1500,000', ',500', '1,', '1,,500']) {
      expect(parsePositiveWhole(raw, 'en'), raw).toBeNull();
    }
  });

  it('rejects zero, signs, decimals, suffixes, inner spaces and empty text', () => {
    for (const locale of LOCALES) {
      for (const raw of ['0', '000', '-1', '+1', '1e3', '1k', '1kk', '1 500', '', '   ', 'abc']) {
        expect(parsePositiveWhole(raw, locale), raw).toBeNull();
      }
    }
    expect(parsePositiveWhole('0.000', 'es')).toBeNull();
    expect(parsePositiveWhole('0,000', 'en')).toBeNull();
    expect(parsePositiveWhole('1.500,00', 'es')).toBeNull();
    expect(parsePositiveWhole('1,500.00', 'en')).toBeNull();
  });

  it('accepts at most 15 digits, grouped or not (9.4)', () => {
    expect(parsePositiveWhole('999999999999999', 'es')).toBe(999_999_999_999_999);
    expect(parsePositiveWhole('999.999.999.999.999', 'es')).toBe(999_999_999_999_999);
    expect(parsePositiveWhole('999,999,999,999,999', 'en')).toBe(999_999_999_999_999);
    expect(parsePositiveWhole('1000000000000000', 'es')).toBeNull();
    expect(parsePositiveWhole('1.000.000.000.000.000', 'es')).toBeNull();
    expect(parsePositiveWhole('1,000,000,000,000,000', 'en')).toBeNull();
  });

  it('ignores the whitespace around the figure', () => {
    expect(parsePositiveWhole(' 1.500 ', 'es')).toBe(1500);
    expect(parsePositiveWhole('\t1,500\n', 'en')).toBe(1500);
  });
});

describe('compactKks', () => {
  it('shortens only exact multiples of a thousand or a million, for the copied text (E12)', () => {
    expect(compactKks(1_000)).toBe('1k');
    expect(compactKks(150_000)).toBe('150k');
    expect(compactKks(1_000_000)).toBe('1kk');
    expect(compactKks(50_000_000)).toBe('50kk');
    expect(compactKks(1_200_000_000)).toBe('1200kk');
    expect(compactKks(1_500_000)).toBe('1500k');
    expect(compactKks(150_000_000n)).toBe('150kk');
  });

  it('gives no short form when it would round', () => {
    for (const value of [0, 1, 850, 999, 1_050, 2_500, 1_234_567]) {
      expect(compactKks(value), String(value)).toBeNull();
    }
  });
});

describe('isDittoSlug', () => {
  it('opens Memory Slots only for Ditto and Shiny Ditto (9.7.2)', () => {
    expect(isDittoSlug('ditto')).toBe(true);
    expect(isDittoSlug('shiny-ditto')).toBe(true);
    expect(isDittoSlug('bulbasaur')).toBe(false);
    expect(isDittoSlug('shiny-charizard')).toBe(false);
    expect(isDittoSlug(null)).toBe(false);
    expect(isDittoSlug(undefined)).toBe(false);
  });
});

describe('isValidOptionalPercent', () => {
  it('accepts an empty field and 0 to 100 with up to 2 decimals, point or comma', () => {
    for (const raw of ['', '   ', '0', '53', '53.5', '53,25', '100', '100.00', ' 12 ']) {
      expect(isValidOptionalPercent(raw), raw).toBe(true);
    }
  });

  it('rejects values over 100, three decimals, signs and text', () => {
    for (const raw of ['101', '100.01', '53.123', '-1', '+5', '5%', 'abc', '.5', '5.']) {
      expect(isValidOptionalPercent(raw), raw).toBe(false);
    }
  });
});

describe('isValidPrice', () => {
  it('takes real money above zero with up to 10 whole digits and 2 decimals (9.7.4)', () => {
    for (const locale of LOCALES) {
      for (const currency of ['BRL', 'USD', 'MXN'] as const) {
        expect(isValidPrice('90', currency, locale)).toBe(true);
        expect(isValidPrice('35.50', currency, locale)).toBe(true);
        expect(isValidPrice('35,5', currency, locale)).toBe(true);
        expect(isValidPrice('1234567890.99', currency, locale)).toBe(true);
        expect(isValidPrice(' 90 ', currency, locale)).toBe(true);
      }
      for (const raw of ['0', '0.00', '12.345', '12345678901', '-5', '', 'R$ 90', '1.800']) {
        expect(isValidPrice(raw, 'BRL', locale), raw).toBe(false);
      }
    }
  });

  it('takes Pokédólares in the short form or grouped in the language, never rounded', () => {
    expect(isValidPrice('50kk', 'pokedolares', 'es')).toBe(true);
    expect(isValidPrice('2,5k', 'pokedolares', 'es')).toBe(true);
    expect(isValidPrice('1.500', 'pokedolares', 'es')).toBe(true);
    expect(isValidPrice('2.5k', 'pokedolares', 'en')).toBe(true);
    expect(isValidPrice('1,500', 'pokedolares', 'en')).toBe(true);
    expect(isValidPrice('1,2345k', 'pokedolares', 'es')).toBe(false);
    expect(isValidPrice('0', 'pokedolares', 'es')).toBe(false);
    expect(isValidPrice('50 KK', 'pokedolares', 'es')).toBe(false);
  });

  it('takes Diamonds as whole numbers grouped in the language', () => {
    expect(isValidPrice('400', 'diamonds', 'es')).toBe(true);
    expect(isValidPrice('2.400', 'diamonds', 'es')).toBe(true);
    expect(isValidPrice('2,400', 'diamonds', 'en')).toBe(true);
    expect(isValidPrice('2,400', 'diamonds', 'es')).toBe(false);
    expect(isValidPrice('1.5', 'diamonds', 'en')).toBe(false);
    expect(isValidPrice('2k', 'diamonds', 'es')).toBe(false);
    expect(isValidPrice('0', 'diamonds', 'es')).toBe(false);
  });
});

describe('parsePrice', () => {
  it('gives the amount of a valid price in its currency, and null otherwise', () => {
    expect(parsePrice('35,50', 'BRL', 'es')).toBe(35.5);
    expect(parsePrice('35.50', 'MXN', 'en')).toBe(35.5);
    expect(parsePrice('90', 'USD', 'es')).toBe(90);
    expect(parsePrice('50kk', 'pokedolares', 'es')).toBe(50_000_000);
    expect(parsePrice('2,5k', 'pokedolares', 'es')).toBe(2_500);
    expect(parsePrice('2.5k', 'pokedolares', 'en')).toBe(2_500);
    expect(parsePrice('1.500', 'diamonds', 'es')).toBe(1_500);
    expect(parsePrice('1,500', 'diamonds', 'en')).toBe(1_500);
    expect(parsePrice('0', 'USD', 'es')).toBeNull();
    expect(parsePrice('1,2345k', 'pokedolares', 'es')).toBeNull();
    expect(parsePrice('2.5', 'diamonds', 'en')).toBeNull();
  });
});
