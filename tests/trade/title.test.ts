import { describe, expect, it } from 'vitest';

import type { Locale } from '@/i18n/config';
import { UNKNOWN } from '@/lib/format/unknown';
import { listingTitle } from '@/lib/trade/title';
import type { ListingNames, ListingTitleInput } from '@/lib/trade/title';
import type { UnidadPokemon } from '@/lib/trade/types';

// listingTitle of spec 9.4, one case per asset type (CA-9.19): `texto` is what the page shows
// and `accesible` what a screen reader hears; they differ only for Pokédólares (R5).

const POKEMON: Record<string, string> = { 'shiny-ditto': 'Shiny Ditto', charizard: 'Charizard' };
const ITEMS: Record<string, string> = { 'fire-stone': 'Fire Stone' };

const NAMES: Pick<ListingNames, 'pokemon' | 'item'> = {
  pokemon: (id) => POKEMON[id],
  item: (id) => ITEMS[id],
};

const LOCALES: readonly Locale[] = ['es', 'en'];

function unidad(pokemon: string, nickname: string | null = null): UnidadPokemon {
  return {
    pokemon,
    ball: null,
    aura: null,
    boost: null,
    starLevel: null,
    nickname,
    memorySlots: null,
    memorias: [],
    helds: [],
    addon: null,
    nextBoostChance: null,
    entrenamiento: [],
    precioNpc: null,
  };
}

function title(anuncio: ListingTitleInput, locale: Locale) {
  return listingTitle(anuncio, locale, NAMES);
}

describe('listingTitle', () => {
  it('names a Pokémon by its registry name, never by its nickname', () => {
    for (const locale of LOCALES) {
      expect(title({ tipo: 'pokemon', pokemon: unidad('shiny-ditto') }, locale)).toEqual({
        texto: 'Shiny Ditto',
        accesible: 'Shiny Ditto',
      });
      expect(
        title({ tipo: 'pokemon', pokemon: unidad('shiny-ditto', 'S U S A N O O') }, locale).texto,
      ).toBe('Shiny Ditto');
    }
  });

  it('names an item by its registry name when matched, without its quantity', () => {
    const matched: ListingTitleInput = {
      tipo: 'items',
      item: { item: 'fire-stone', nombre: 'fire stone', cantidad: 1500 },
    };
    const declared: ListingTitleInput = {
      tipo: 'items',
      item: { item: null, nombre: 'Declared Item', cantidad: 3 },
    };
    for (const locale of LOCALES) {
      expect(title(matched, locale)).toEqual({ texto: 'Fire Stone', accesible: 'Fire Stone' });
      expect(title(declared, locale)).toEqual({
        texto: 'Declared Item',
        accesible: 'Declared Item',
      });
    }
  });

  it('writes Diamonds as the grouped figure and the game term', () => {
    expect(title({ tipo: 'diamonds', cantidad: 300 }, 'es')).toEqual({
      texto: '300 Diamonds',
      accesible: '300 Diamonds',
    });
    expect(title({ tipo: 'diamonds', cantidad: 2400 }, 'es').texto).toBe('2.400 Diamonds');
    expect(title({ tipo: 'diamonds', cantidad: 2400 }, 'en').texto).toBe('2,400 Diamonds');
  });

  it('shows Pokédólares in the short form and gives the screen reader the exact figure', () => {
    const anuncio: ListingTitleInput = { tipo: 'pokedolares', cantidad: 50_000_000 };
    expect(title(anuncio, 'es')).toEqual({
      texto: '50kk Pokédólares',
      accesible: '50.000.000 Pokédólares',
    });
    expect(title(anuncio, 'en')).toEqual({
      texto: '50kk Pokédollars',
      accesible: '50,000,000 Pokédollars',
    });
  });

  it('rounds the visible short form of Pokédólares as the design system does (E12)', () => {
    expect(title({ tipo: 'pokedolares', cantidad: 1_234_567 }, 'es')).toEqual({
      texto: '1,2kk Pokédólares',
      accesible: '1.234.567 Pokédólares',
    });
    expect(title({ tipo: 'pokedolares', cantidad: 2_500 }, 'en')).toEqual({
      texto: '2.5k Pokédollars',
      accesible: '2,500 Pokédollars',
    });
  });

  it('keeps the singular of the currency word for a single Pokédólar', () => {
    expect(title({ tipo: 'pokedolares', cantidad: 1 }, 'es')).toEqual({
      texto: '1 Pokédólar',
      accesible: '1 Pokédólar',
    });
    expect(title({ tipo: 'pokedolares', cantidad: 1 }, 'en').texto).toBe('1 Pokédollar');
  });

  it('gives the dash for what the listing or the registry does not have (G7)', () => {
    const unknown = { texto: UNKNOWN, accesible: UNKNOWN };
    expect(title({ tipo: 'pokemon', pokemon: unidad('sin-registro') }, 'es')).toEqual(unknown);
    expect(title({ tipo: 'pokemon', pokemon: unidad('') }, 'es')).toEqual(unknown);
    expect(title({ tipo: 'pokemon' }, 'es')).toEqual(unknown);
    expect(title({ tipo: 'items', item: { item: null, nombre: ' ', cantidad: 1 } }, 'es')).toEqual(
      unknown,
    );
    expect(title({ tipo: 'diamonds' }, 'es')).toEqual(unknown);
    expect(title({ tipo: 'pokedolares', cantidad: 0 }, 'es')).toEqual(unknown);
  });
});
