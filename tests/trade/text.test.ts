import { describe, expect, it } from 'vitest';

import type { Locale } from '@/i18n/config';
import { listingText } from '@/lib/trade/text';
import type { ListingTextInput, ListingTextLabels, ListingTextNames } from '@/lib/trade/text';
import type { Precio, UnidadPokemon } from '@/lib/trade/types';

// The copied text of spec 9.7.7 (CA-9.12): one line per declared datum, in the order of the
// listing's sheet, in the page's language; Pokédólares in the short form only when exact (E12).

const LABELS: Record<Locale, ListingTextLabels> = {
  es: {
    selling: 'Vendo',
    nickname: 'Nickname',
    ball: 'Ball',
    aura: 'Aura',
    boost: 'Boost',
    memorySlots: 'Memory Slots',
    starLevel: 'Star Level',
    npcPrice: 'NPC Price',
    unsellable: 'Unsellable',
    addon: 'Addon',
    nextBoostChance: 'Next Boost chance',
    heldItems: 'Held Items',
    training: 'Entrenamiento',
    dittoMemory: 'Ditto Memory',
    quantity: 'Cantidad',
    price: 'Precio',
    negotiable: 'A convenir',
    fiat: 'Dinero real',
    game: 'En el juego',
    world: 'Mundo',
    or: 'o',
  },
  en: {
    selling: 'Selling',
    nickname: 'Nickname',
    ball: 'Ball',
    aura: 'Aura',
    boost: 'Boost',
    memorySlots: 'Memory Slots',
    starLevel: 'Star Level',
    npcPrice: 'NPC Price',
    unsellable: 'Unsellable',
    addon: 'Addon',
    nextBoostChance: 'Next Boost chance',
    heldItems: 'Held Items',
    training: 'Training',
    dittoMemory: 'Ditto Memory',
    quantity: 'Quantity',
    price: 'Price',
    negotiable: 'Negotiable',
    fiat: 'Real money',
    game: 'In-game',
    world: 'World',
    or: 'or',
  },
};

const POKEMON: Record<string, string> = {
  'shiny-ditto': 'Shiny Ditto',
  charizard: 'Charizard',
  gengar: 'Gengar',
  bulbasaur: 'Bulbasaur',
};
const ITEMS: Record<string, string> = {
  'premier-ball': 'Premier Ball',
  'fire-stone': 'Fire Stone',
  'x-attack': 'X-Attack',
  'x-lucky': 'X-Lucky',
};
const ADDONS: Record<string, string> = { 'bulbasaur-addon-1': 'Addon de prueba' };
const AURAS: Record<string, string> = { premier: 'Premier' };
const MUNDOS: Record<string, string> = { sun: 'Sun' };

const NAMES: ListingTextNames = {
  pokemon: (id) => POKEMON[id],
  item: (id) => ITEMS[id],
  addon: (id) => ADDONS[id],
  aura: (id) => AURAS[id],
  mundo: (id) => MUNDOS[id],
  heldTier: (id) => ({ 'x-attack': 5, 'x-lucky': 3 })[id],
};

function unidad(pokemon: string, declared: Partial<UnidadPokemon> = {}): UnidadPokemon {
  return {
    pokemon,
    ball: null,
    auras: [],
    addons: [],
    heldX: null,
    heldY: null,
    mega: null,
    boost: null,
    starLevel: null,
    nickname: null,
    memorySlots: null,
    memorias: [],
    nextBoostChance: null,
    entrenamiento: [],
    precioNpc: null,
    ...declared,
  };
}

function precio(declared: Partial<Precio> = {}): Precio {
  return { real: null, juego: [], aConvenir: false, ...declared };
}

function text(anuncio: ListingTextInput, locale: Locale): string {
  return listingText(anuncio, locale, NAMES, LABELS[locale]);
}

// The format example of 9.7.7, as the test listing.
const EXAMPLE: ListingTextInput = {
  tipo: 'pokemon',
  mundo: 'sun',
  pokemon: unidad('shiny-ditto', {
    nickname: 'S U S A N O O',
    ball: 'premier-ball',
    auras: ['premier'],
    boost: 20,
    memorySlots: 6,
    memorias: ['charizard', 'gengar', null, null, null, null],
    heldX: 'x-attack',
    heldY: 'x-lucky',
    entrenamiento: [{ habilidad: 'Attack', nivel: 16, progreso: '53' }],
  }),
  precio: precio({
    real: { moneda: 'BRL', importe: '90' },
    juego: [
      { tipo: 'pokedolares', cantidad: 150_000_000 },
      { tipo: 'diamonds', cantidad: 400 },
    ],
  }),
};

describe('listingText (CA-9.12)', () => {
  it('writes the example of 9.7.7 line by line in es', () => {
    expect(text(EXAMPLE, 'es')).toBe(
      [
        'Vendo: Shiny Ditto',
        'Nickname: S U S A N O O',
        'Ball: Premier Ball',
        'Aura: Premier',
        'Boost: +20',
        'Memory Slots: 6',
        'Held Items: X-Attack T5, X-Lucky T3',
        'Entrenamiento: Attack 16 (53%)',
        'Ditto Memory: Charizard, Gengar',
        'Dinero real: R$ 90',
        'En el juego: 150kk o 400 Diamonds',
        'Mundo: Sun',
      ].join('\n'),
    );
  });

  it('writes the same lines in en', () => {
    expect(text(EXAMPLE, 'en')).toBe(
      [
        'Selling: Shiny Ditto',
        'Nickname: S U S A N O O',
        'Ball: Premier Ball',
        'Aura: Premier',
        'Boost: +20',
        'Memory Slots: 6',
        'Held Items: X-Attack T5, X-Lucky T3',
        'Training: Attack 16 (53%)',
        'Ditto Memory: Charizard, Gengar',
        'Real money: R$ 90',
        'In-game: 150kk or 400 Diamonds',
        'World: Sun',
      ].join('\n'),
    );
  });

  it('gives no line to what the seller did not declare', () => {
    const bare: ListingTextInput = {
      tipo: 'pokemon',
      mundo: 'sun',
      pokemon: unidad('charizard'),
      precio: precio({ juego: [{ tipo: 'diamonds', cantidad: 2400 }] }),
    };
    expect(text(bare, 'es')).toBe('Vendo: Charizard\nEn el juego: 2.400 Diamonds\nMundo: Sun');
  });

  it('writes the other rows of the sheet in order: Star Level, NPC Price, Addon…', () => {
    const full: ListingTextInput = {
      tipo: 'pokemon',
      mundo: 'sun',
      pokemon: unidad('bulbasaur', {
        ball: 'premier-ball',
        starLevel: 5,
        precioNpc: { tipo: 'pokedolares', cantidad: 2_500 },
        addons: ['bulbasaur-addon-1'],
        nextBoostChance: '12.5',
        entrenamiento: [
          { habilidad: 'Evasion', nivel: 1_200, progreso: null },
          { habilidad: 'Defense', nivel: null, progreso: '0.25' },
          { habilidad: 'Attack', nivel: null, progreso: null },
        ],
      }),
      precio: precio({ aConvenir: true }),
    };
    expect(text(full, 'es')).toBe(
      [
        'Vendo: Bulbasaur',
        'Ball: Premier Ball',
        'Star Level: 5',
        'NPC Price: 2.500',
        'Addon: Addon de prueba',
        'Next Boost chance: 12,5%',
        'Entrenamiento: Defense (0,25%), Evasion 1.200',
        'Precio: A convenir',
        'Mundo: Sun',
      ].join('\n'),
    );
    expect(text(full, 'en')).toContain('Next Boost chance: 12.5%\n');
    expect(text(full, 'en')).toContain('Training: Defense (0.25%), Evasion 1,200\n');
    expect(text(full, 'en')).toContain('Price: Negotiable\n');
    const unsellable: ListingTextInput = {
      ...full,
      pokemon: unidad('bulbasaur', { precioNpc: { tipo: 'unsellable' } }),
    };
    expect(text(unsellable, 'es')).toContain('\nNPC Price: Unsellable\n');
  });

  it('keeps Pokédólares short only when exact, otherwise the exact grouped figure (E12)', () => {
    const exact: ListingTextInput = {
      tipo: 'pokedolares',
      cantidad: 50_000_000,
      mundo: 'sun',
      precio: precio({ real: { moneda: 'USD', importe: '12.5' } }),
    };
    expect(text(exact, 'es')).toBe('Vendo: 50kk Pokédólares\nDinero real: US$ 12,50\nMundo: Sun');
    expect(text(exact, 'en')).toBe('Selling: 50kk Pokédollars\nReal money: US$ 12.50\nWorld: Sun');

    const inexact: ListingTextInput = { ...exact, cantidad: 1_234_567 };
    expect(text(inexact, 'es')).toMatch(/^Vendo: 1\.234\.567 Pokédólares\n/);
    expect(text(inexact, 'en')).toMatch(/^Selling: 1,234,567 Pokédollars\n/);

    const options: ListingTextInput = {
      tipo: 'diamonds',
      cantidad: 300,
      mundo: 'sun',
      precio: precio({
        juego: [
          { tipo: 'pokedolares', cantidad: 1_500_000 },
          { tipo: 'diamonds', cantidad: 1 },
        ],
      }),
    };
    expect(text(options, 'es')).toBe(
      'Vendo: 300 Diamonds\nEn el juego: 1500k o 1 Diamonds\nMundo: Sun',
    );
    const rounded = {
      ...options,
      precio: precio({ juego: [{ tipo: 'pokedolares' as const, cantidad: 999_950 }] }),
    };
    expect(text(rounded, 'es')).toContain('En el juego: 999.950\n');
    expect(text(rounded, 'es')).not.toContain('1kk');
  });

  it('writes the quantity of an items listing on its own line, and the title without it', () => {
    const items: ListingTextInput = {
      tipo: 'items',
      item: { item: 'fire-stone', cantidad: 1_500 },
      mundo: 'sun',
      precio: precio({ real: { moneda: 'MXN', importe: '1800' } }),
    };
    expect(text(items, 'es')).toBe(
      'Vendo: Fire Stone\nCantidad: 1.500\nDinero real: MX$ 1.800\nMundo: Sun',
    );
    expect(text(items, 'en')).toBe(
      'Selling: Fire Stone\nQuantity: 1,500\nReal money: MX$ 1,800\nWorld: Sun',
    );
  });

  it('is plain text: an ordinary space after the currency symbol and no dash', () => {
    const copied = text(EXAMPLE, 'es');
    expect(copied).not.toContain(String.fromCodePoint(0xa0));
    expect(copied).not.toContain('—');
    expect(copied).not.toMatch(/KKs?\b|gold/);
  });
});
