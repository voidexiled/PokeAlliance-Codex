import { describe, expect, it } from 'vitest';

import type { Locale } from '@/i18n/config';
import { applyListState, defaultListState } from '@/lib/lists/state';
import type { ListConfig } from '@/lib/lists/state';
import { normalize } from '@/lib/search/normalize';
import { matches, searchText } from '@/lib/trade/search';
import type { ListingSearchInput } from '@/lib/trade/search';
import type { ListingNames } from '@/lib/trade/title';
import type { Precio, UnidadPokemon } from '@/lib/trade/types';

// The search of the Comercio list (spec 9.5.2, CA-9.6): the text of each listing and the
// fragment rule, which has to agree with the list controller's (`applyListState`).

const POKEMON: Record<string, string> = {
  'shiny-ditto': 'Shiny Ditto',
  charizard: 'Charizard',
  gengar: 'Gengar',
  bulbasaur: 'Bulbasaur',
};
const ITEMS: Record<string, string> = {
  'premier-ball': 'Premier Ball',
  'ultra-ball': 'Ultra Ball',
  'fire-stone': 'Fire Stone',
  'x-attack': 'X-Attack',
};
const AURAS: Record<string, string> = { alliance: 'Alliance', premier: 'Premier' };
const MUNDOS: Record<string, string> = { sun: 'Sun', moon: 'Moon' };
// Fictional placeholders (9.4): never the name of a real person or player.
const VENDEDORES: Record<string, string> = {
  'vendedor-alfa': 'Vendedor Alfa',
  'vendedor-beta': 'Vendedor Beta',
};

const NAMES: ListingNames = {
  pokemon: (id) => POKEMON[id],
  item: (id) => ITEMS[id],
  addon: () => undefined,
  aura: (id) => AURAS[id],
  mundo: (id) => MUNDOS[id],
  vendedor: (handle) => VENDEDORES[handle],
};

type Listing = ListingSearchInput & { id: string };

function unidad(pokemon: string, declared: Partial<UnidadPokemon> = {}): UnidadPokemon {
  return {
    pokemon,
    ball: null,
    aura: null,
    boost: null,
    starLevel: null,
    nickname: null,
    memorySlots: null,
    memorias: [],
    helds: [],
    addon: null,
    nextBoostChance: null,
    entrenamiento: [],
    precioNpc: null,
    ...declared,
  };
}

function precio(declared: Partial<Precio> = {}): Precio {
  return { real: null, juego: [], aConvenir: false, ...declared };
}

function listing(id: string, rest: Omit<Listing, 'id' | 'mundo' | 'vendedor'>): Listing {
  return { id, mundo: 'moon', vendedor: 'vendedor-beta', ...rest };
}

const LISTINGS: Listing[] = [
  {
    id: 'ditto-boost-20',
    tipo: 'pokemon',
    mundo: 'sun',
    vendedor: 'vendedor-alfa',
    pokemon: unidad('shiny-ditto', {
      nickname: 'S U S A N O O',
      ball: { item: 'premier-ball', nombre: 'Premier Ball' },
      boost: 20,
      starLevel: 3,
      memorySlots: 6,
      memorias: ['charizard', 'gengar', null, null, null, null],
      helds: [{ item: 'x-attack', nombre: 'X-Attack', tier: 5 }],
    }),
    precio: precio({
      real: { moneda: 'BRL', importe: '90' },
      juego: [
        { tipo: 'pokedolares', cantidad: 150_000_000 },
        { tipo: 'diamonds', cantidad: 400 },
      ],
    }),
  },
  listing('charizard-boost-2', {
    tipo: 'pokemon',
    pokemon: unidad('charizard', { boost: 2, aura: 'premier' }),
    precio: precio({ juego: [{ tipo: 'pokedolares', cantidad: 30_000_000 }] }),
  }),
  listing('charizard-boost-25', {
    tipo: 'pokemon',
    pokemon: unidad('charizard', { boost: 25, ball: { item: 'ultra-ball', nombre: 'Ultra Ball' } }),
    precio: precio({ real: { moneda: 'USD', importe: '20' } }),
  }),
  listing('bulbasaur-boost-0', {
    tipo: 'pokemon',
    pokemon: unidad('bulbasaur', { boost: 0 }),
    precio: precio({ aConvenir: true }),
  }),
  listing('bulbasaur-sin-boost', {
    tipo: 'pokemon',
    pokemon: unidad('bulbasaur', { nickname: 'Planta 20' }),
    precio: precio({ real: { moneda: 'MXN', importe: '35.50' } }),
  }),
  listing('fire-stone', {
    tipo: 'items',
    item: { item: 'fire-stone', nombre: 'fire stone', cantidad: 1500 },
    precio: precio({ juego: [{ tipo: 'diamonds', cantidad: 400 }] }),
  }),
  listing('diamonds-2400', {
    tipo: 'diamonds',
    cantidad: 2400,
    precio: precio({ real: { moneda: 'MXN', importe: '1800' } }),
  }),
  listing('pokedolares-50kk', {
    tipo: 'pokedolares',
    cantidad: 50_000_000,
    precio: precio({ real: { moneda: 'USD', importe: '10' } }),
  }),
  listing('pokedolares-5kk', {
    tipo: 'pokedolares',
    cantidad: 5_000_000,
    precio: precio({ juego: [{ tipo: 'diamonds', cantidad: 90 }] }),
  }),
];

function found(query: string, locale: Locale = 'es'): string[] {
  return LISTINGS.filter((anuncio) => matches(searchText(anuncio, locale, NAMES), query)).map(
    (anuncio) => anuncio.id,
  );
}

describe('searchText', () => {
  it('is normalised: lowercase, without diacritics', () => {
    for (const anuncio of LISTINGS) {
      const text = searchText(anuncio, 'es', NAMES);
      expect(text).toBe(normalize(text));
      expect(text).not.toMatch(/[A-Z]/);
    }
  });

  it('carries both forms of the title, the exact figure and the exact short form', () => {
    const text = searchText(LISTINGS[7], 'es', NAMES);
    expect(text).toContain('50kk pokedolares');
    expect(text).toContain('50.000.000 pokedolares');
    expect(text).toContain('50000000 50kk');
    expect(searchText(LISTINGS[7], 'en', NAMES)).toContain('50,000,000 pokedollars');
  });

  it('writes each held item as «x-attack t5» and the declared figures as the game does', () => {
    const text = searchText(LISTINGS[0], 'es', NAMES);
    for (const term of ['x-attack t5', 'boost +20', 'star level 3', 'memory slots 6']) {
      expect(text).toContain(term);
    }
  });

  it('carries the price as stored and as the page writes it', () => {
    const text = searchText(LISTINGS[0], 'es', NAMES);
    expect(text).toContain('90');
    expect(text).toContain('r$');
    expect(text).toContain('150000000 150kk');
    expect(text).toContain('400 diamonds');
    const cents = searchText(LISTINGS[4], 'es', NAMES);
    expect(cents).toContain('35.50');
    expect(cents).toContain('35,50');
  });

  it('leaves out what the listing does not declare', () => {
    const text = searchText(LISTINGS[3], 'es', NAMES);
    expect(text).not.toContain('star level');
    expect(text).not.toContain('memory slots');
    expect(text).not.toContain('—');
  });
});

describe('matches (CA-9.6)', () => {
  it('«+20» only returns listings with Boost 20', () => {
    expect(found('+20')).toEqual(['ditto-boost-20']);
  });

  it('«susanoo» finds the nickname «S U S A N O O»', () => {
    expect(found('susanoo')).toEqual(['ditto-boost-20']);
    expect(found('SUSANOO')).toEqual(['ditto-boost-20']);
  });

  it('«50kk» finds the listing of 50.000.000 Pokédólares', () => {
    expect(found('50kk')).toContain('pokedolares-50kk');
    expect(found('50kk')).not.toContain('pokedolares-5kk');
    expect(found('50000000')).toContain('pokedolares-50kk');
  });

  it('«premier» finds a Premier Ball and a Premier aura', () => {
    expect(found('premier')).toEqual(['ditto-boost-20', 'charizard-boost-2']);
  });

  it('needs every fragment, split on spaces and commas, as a substring', () => {
    expect(found('Shiny Ditto +20, Premier')).toEqual(['ditto-boost-20']);
    expect(found('charizard premier')).toEqual(['ditto-boost-20', 'charizard-boost-2']);
    expect(found('charizard,ultra')).toEqual(['charizard-boost-25']);
    expect(found('x-attack t5')).toEqual(['ditto-boost-20']);
    expect(found('memory slots 6')).toEqual(['ditto-boost-20']);
  });

  it('finds the memories of a Ditto, the item and its quantity, the world and the seller', () => {
    expect(found('gengar')).toEqual(['ditto-boost-20']);
    expect(found('charizard')).toEqual([
      'ditto-boost-20',
      'charizard-boost-2',
      'charizard-boost-25',
    ]);
    expect(found('fire stone ×1500')).toEqual(['fire-stone']);
    expect(found('×1.500')).toEqual(['fire-stone']);
    expect(found('sun')).toEqual(['ditto-boost-20']);
    expect(found('vendedor alfa')).toEqual(['ditto-boost-20']);
  });

  it('finds the Diamonds of a listing and of a price', () => {
    expect(found('2400')).toEqual(['diamonds-2400']);
    expect(found('2.400 diamonds')).toEqual(['diamonds-2400']);
    expect(found('400 diamonds')).toEqual(['ditto-boost-20', 'fire-stone', 'diamonds-2400']);
  });

  it('ignores case and accents, in both languages', () => {
    expect(found('POKÉDÓLARES')).toEqual(['pokedolares-50kk', 'pokedolares-5kk']);
    expect(found('pokedollars', 'en')).toEqual(['pokedolares-50kk', 'pokedolares-5kk']);
    expect(found('pokedollars', 'es')).toEqual([]);
  });

  it('does not filter with an empty query', () => {
    expect(found('')).toHaveLength(LISTINGS.length);
    expect(found('  , ')).toHaveLength(LISTINGS.length);
  });

  it('agrees with the list controller, which applies the same rule to ListConfig.text', () => {
    const config: ListConfig<Listing> = {
      id: 'comercio',
      pageSize: Infinity,
      sorts: [{ id: 'recientes', label: '', compare: () => 0 }],
      filters: [],
      text: (anuncio) => searchText(anuncio, 'es', NAMES),
    };
    for (const q of ['+20', 'susanoo', '50kk', 'premier', 'charizard, 25', '400 diamonds', '']) {
      const page = applyListState(config, LISTINGS, { ...defaultListState(config), q });
      expect(
        page.items.map((anuncio) => anuncio.id),
        q,
      ).toEqual(found(q));
    }
  });
});
