import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { GameTooltip } from '@/components/game/GameTooltip';
import type { Locale } from '@/i18n/config';
import {
  diamondsTip,
  elementTip,
  itemTip,
  pokedolaresTip,
  pokemonTip,
  systemItemTip,
  systemTip,
  type CurrencyTipRecord,
  type ElementTipRecord,
  type ItemTipRecord,
  type PokemonTipRecord,
  type SystemItemTipRecord,
  type SystemTipRecord,
  type TipData,
  type TipLabels,
  type TipRow,
  type TipSprite,
} from '@/lib/game/tips';

// A copy of the `ui.tooltip` leaves of the dictionary (§13.2). The builders receive
// their labels, so a test can assert that each row carries the label of its locale
// and never a Spanish default inside `en`.
const LABELS: Record<Locale, TipLabels> = {
  es: {
    requirement: 'Requisito',
    level: 'Nivel {n}',
    tier: 'Tier',
    elements: 'Elementos',
    generation: 'Generación',
    role: 'Rol',
    stone: 'Stone',
    fragment: 'Fragment',
    category: 'Categoría',
    droppedBy: 'Drop de',
    element: 'Elemento',
    use: 'Uso',
    npcPrice: 'Precio NPC',
    shopPrice: 'Precio de tienda',
    system: 'Sistema',
    boughtAt: 'Se compran en',
    usedFor: 'Se usan en',
    diamonds: 'Diamonds',
    pokedolares: 'Pokédólares',
  },
  en: {
    requirement: 'Requirement',
    level: 'Level {n}',
    tier: 'Tier',
    elements: 'Elements',
    generation: 'Generation',
    role: 'Role',
    stone: 'Stone',
    fragment: 'Fragment',
    category: 'Category',
    droppedBy: 'Dropped by',
    element: 'Element',
    use: 'Use',
    npcPrice: 'NPC Price',
    shopPrice: 'Shop price',
    system: 'System',
    boughtAt: 'Bought at',
    usedFor: 'Used for',
    diamonds: 'Diamonds',
    pokedolares: 'Pokédollars',
  },
};

const UNKNOWN = '—';

const FIRE: ElementTipRecord = {
  id: 'fire',
  nombre: { es: 'Fuego', en: 'Fire' },
  icono: { src: '/sprites/elementos/fire.png', smooth: true },
  stone: 'Fire Stone',
  fragment: 'Fire Fragment',
};

const FLYING = { nombre: { es: 'Volador', en: 'Flying' } };

const CHARIZARD: PokemonTipRecord = {
  id: 'shiny-charizard',
  nombre: 'Shiny Charizard',
  variante: 'shiny',
  nivel: 120,
  tier: 3,
  generacion: 1,
  funcion: 'PVE',
  imagen: '/pokemon/006-shiny.png',
  elementos: [{ nombre: FIRE.nombre }, FLYING],
};

const FIRE_STONE: ItemTipRecord = {
  id: 'fire-stone',
  nombre: 'Fire Stone',
  categoria: 'stones',
  sprite: { src: '/sprites/items/stones/fire-stone.png', frames: 8, mode: 'variante', frame: 0 },
  precioNpc: { vende: 150_000_000, compra: 2500 },
  nombreCategoria: { es: 'Stones', en: 'Stones' },
  dropDe: ['Charmander', 'Charizard'],
  nombreElemento: { es: 'Fuego', en: 'Fire' },
  uso: { es: 'Evoluciona Pokémon de fuego.', en: 'Evolves fire Pokémon.' },
};

const CHARGER: SystemItemTipRecord = {
  id: 'normal-training-charger',
  nombre: 'Normal charger',
  descripcion: 'Adds 20,000 standard-progress charges to the Punching Bag',
  sistema: 'punching-bag-training',
  sprite: { src: '/sprites/items/charger.png' },
  tituloSistema: { es: 'Punching Bag', en: 'Punching Bag' },
};

const BOOST: SystemTipRecord = {
  id: 'boost',
  titulo: { es: 'Boost', en: 'Boost' },
  sprite: { src: '/sprites/sistemas/boost.png' },
  tooltip: [
    { etiqueta: { es: 'Máximo', en: 'Maximum' }, valor: { es: '+20', en: '+20' } },
    {
      etiqueta: { es: 'Coste', en: 'Cost' },
      valor: { es: '2.400 Diamonds', en: '2,400 Diamonds' },
    },
  ],
};

const MONEDA: CurrencyTipRecord = {
  seCompranEn: { es: ['Tienda de Diamonds'], en: ['Diamond shop'] },
  seUsanEn: { es: ['Boost', 'Outfits'], en: ['Boost', 'Outfits'] },
};

const DIAMOND_SPRITE: TipSprite = {
  src: '/sprites/ui/diamond.png',
  frames: 7,
  mode: 'animacion',
  durations: [110, 110, 110, 110, 110, 110, 110],
};

const locales: Locale[] = ['es', 'en'];

function labelsOf(tip: TipData | null): string[] {
  return (tip?.rows ?? []).map((row) => row.label);
}

function rowOf(tip: TipData | null, label: string): TipRow | undefined {
  return tip?.rows.find((row) => row.label === label);
}

/** Every string a panel would paint, so one walk can look for the dash (T32). */
function tipStrings(tip: TipData): string[] {
  const strings = [tip.title, ...tip.rows.map((row) => row.label)];
  for (const { value } of tip.rows) {
    if (typeof value === 'string') strings.push(value);
    else if ('list' in value) strings.push(...value.list);
  }
  return strings;
}

describe('pokemonTip', () => {
  it('builds the five rows of §7.5.3 with the labels of each locale', () => {
    for (const locale of locales) {
      const tip = pokemonTip(CHARIZARD, locale, LABELS[locale]);
      const labels = LABELS[locale];
      expect(labelsOf(tip)).toEqual([
        labels.requirement,
        labels.tier,
        labels.elements,
        labels.generation,
        labels.role,
      ]);
      expect(rowOf(tip, labels.requirement)?.value).toBe(
        locale === 'es' ? 'Nivel 120' : 'Level 120',
      );
      expect(rowOf(tip, labels.tier)?.value).toBe('T3');
      expect(rowOf(tip, labels.generation)?.value).toBe('1');
      expect(rowOf(tip, labels.role)?.value).toBe('PVE');
    }
  });

  it('joins the element names of the locale with " / " (§8.0.5)', () => {
    expect(rowOf(pokemonTip(CHARIZARD, 'es', LABELS.es), 'Elementos')?.value).toBe(
      'Fuego / Volador',
    );
    expect(rowOf(pokemonTip(CHARIZARD, 'en', LABELS.en), 'Elements')?.value).toBe('Fire / Flying');
  });

  it('carries the key, the width, the art head and the Shiny mark', () => {
    const tip = pokemonTip(CHARIZARD, 'es', LABELS.es);
    expect(tip.key).toBe('pokemon:shiny-charizard');
    expect(tip.width).toBe(282);
    expect(tip.shiny).toBe(true);
    expect(tip.head).toEqual({
      type: 'art',
      src: 'https://wiki.pokealliance.com/pokemon/006-shiny.png',
    });
  });

  it('leaves out the Shiny mark and the art of a normal Pokémon with no image', () => {
    const tip = pokemonTip(
      { ...CHARIZARD, id: 'charizard', variante: 'normal', imagen: null },
      'es',
      LABELS.es,
    );
    expect(tip.shiny).toBeUndefined();
    expect(tip.head).toEqual({ type: 'art', src: null });
  });

  it('adds the aura ball to the head only when the Pokémon has one', () => {
    const aura = { sprite: { src: '/sprites/auras/gold.png' }, label: 'Gold' };
    expect(pokemonTip({ ...CHARIZARD, aura }, 'es', LABELS.es).head).toEqual({
      type: 'art',
      src: 'https://wiki.pokealliance.com/pokemon/006-shiny.png',
      aura,
    });
  });

  it('omits the rows the record has no value for and never writes the dash (X13/T32)', () => {
    const tip = pokemonTip(
      {
        ...CHARIZARD,
        nivel: null,
        tier: null,
        generacion: null,
        funcion: null,
        elementos: [],
      },
      'es',
      LABELS.es,
    );
    expect(tip.rows).toEqual([]);
    expect(tip.title).toBe('Shiny Charizard');
  });

  it('keeps a tier written as text and groups a four-digit level', () => {
    const tip = pokemonTip({ ...CHARIZARD, tier: 'Legendary', nivel: 1200 }, 'es', LABELS.es);
    expect(rowOf(tip, 'Tier')?.value).toBe('Legendary');
    expect(rowOf(tip, 'Requisito')?.value).toBe('Nivel 1.200');
    expect(
      rowOf(pokemonTip({ ...CHARIZARD, nivel: 1200 }, 'en', LABELS.en), 'Requirement')?.value,
    ).toBe('Level 1,200');
  });
});

describe('elementTip', () => {
  it('is 240 wide, has the icon head and the two game-term rows', () => {
    for (const locale of locales) {
      const tip = elementTip(FIRE, locale, LABELS[locale]);
      expect(tip.key).toBe('elemento:fire');
      expect(tip.width).toBe(240);
      expect(tip.title).toBe(locale === 'es' ? 'Fuego' : 'Fire');
      expect(tip.head).toEqual({ type: 'icon', sprite: FIRE.icono });
      expect(labelsOf(tip)).toEqual(['Stone', 'Fragment']);
      expect(rowOf(tip, 'Stone')?.value).toBe('Fire Stone');
    }
  });

  it('drops the row of a missing stone or fragment', () => {
    const tip = elementTip({ ...FIRE, fragment: null }, 'es', LABELS.es);
    expect(labelsOf(tip)).toEqual(['Stone']);
  });

  it('keeps the icon null while the registry has none and still paints the name', () => {
    const tip = elementTip({ ...FIRE, icono: null, stone: null, fragment: null }, 'en', LABELS.en);
    expect(tip.head).toEqual({ type: 'icon', sprite: null });
    expect(tip.rows).toEqual([]);
    expect(tip.title).toBe('Fire');
  });
});

describe('itemTip', () => {
  it('builds the six rows of §8.5 in order, the same in every category', () => {
    for (const locale of locales) {
      const labels = LABELS[locale];
      const tip = itemTip(FIRE_STONE, locale, labels);
      expect(labelsOf(tip)).toEqual([
        labels.category,
        labels.droppedBy,
        labels.element,
        labels.use,
        labels.npcPrice,
        labels.shopPrice,
      ]);
      expect(rowOf(tip, labels.droppedBy)?.value).toEqual({ list: ['Charmander', 'Charizard'] });
      expect(rowOf(tip, labels.npcPrice)?.value).toEqual({ pd: 150_000_000 });
      expect(rowOf(tip, labels.shopPrice)?.value).toEqual({ pd: 2500 });
      expect(rowOf(tip, labels.element)?.value).toBe(locale === 'es' ? 'Fuego' : 'Fire');
    }
    expect(itemTip(FIRE_STONE, 'es', LABELS.es).key).toBe('item:fire-stone');
  });

  it('picks the width from the category (§7.5.3)', () => {
    const width = (categoria: string) =>
      itemTip({ ...FIRE_STONE, categoria }, 'es', LABELS.es).width;
    expect(width('stones')).toBe(282);
    expect(width('general-items')).toBe(282);
    expect(width('poke-balls')).toBe(240);
    expect(width('diamantes')).toBe(240);
    expect(width('helds')).toBe(300);
  });

  it('leaves the panel with only the head and the name for today’s registry', () => {
    // Every item of content/items/ has null prices and none of the new fields.
    const tip = itemTip(
      {
        id: 'diamond',
        nombre: 'Diamond',
        categoria: 'diamantes',
        sprite: { src: '/sprites/ui/diamond.png' },
        precioNpc: { vende: null, compra: null },
      },
      'es',
      LABELS.es,
    );
    expect(tip.rows).toEqual([]);
    expect(tip.title).toBe('Diamond');
  });

  it('keeps a price of zero, which is a value, and drops an empty drop list', () => {
    const tip = itemTip(
      { ...FIRE_STONE, precioNpc: { vende: 0, compra: null }, dropDe: [] },
      'es',
      LABELS.es,
    );
    expect(rowOf(tip, 'Precio NPC')?.value).toEqual({ pd: 0 });
    expect(rowOf(tip, 'Precio de tienda')).toBeUndefined();
    expect(rowOf(tip, 'Drop de')).toBeUndefined();
  });

  it('drops a drop name that the registry left unknown', () => {
    const tip = itemTip({ ...FIRE_STONE, dropDe: ['Charmander', '', UNKNOWN] }, 'es', LABELS.es);
    expect(rowOf(tip, 'Drop de')?.value).toEqual({ list: ['Charmander'] });
  });

  it('renders the missing-sprite head as null, never as an invented URL', () => {
    expect(itemTip({ ...FIRE_STONE, sprite: null }, 'es', LABELS.es).head).toEqual({
      type: 'sprite',
      sprite: null,
    });
  });
});

describe('systemItemTip', () => {
  it('builds the System and Use rows of E16', () => {
    for (const locale of locales) {
      const labels = LABELS[locale];
      const tip = systemItemTip(CHARGER, locale, labels);
      expect(tip.key).toBe('item-sistema:normal-training-charger');
      expect(tip.width).toBe(282);
      expect(tip.head).toEqual({ type: 'sprite', sprite: CHARGER.sprite });
      expect(labelsOf(tip)).toEqual([labels.system, labels.use]);
      expect(rowOf(tip, labels.system)?.value).toBe('Punching Bag');
      expect(rowOf(tip, labels.use)?.value).toBe(CHARGER.descripcion);
    }
  });

  it('drops both rows while the registry has neither system nor description', () => {
    const tip = systemItemTip(
      { ...CHARGER, descripcion: null, sistema: null, tituloSistema: null, sprite: undefined },
      'es',
      LABELS.es,
    );
    expect(tip.rows).toEqual([]);
    expect(tip.head).toEqual({ type: 'sprite', sprite: null });
  });
});

describe('systemTip', () => {
  it('takes its rows, labels included, from the record of the locale', () => {
    expect(labelsOf(systemTip(BOOST, 'es'))).toEqual(['Máximo', 'Coste']);
    expect(labelsOf(systemTip(BOOST, 'en'))).toEqual(['Maximum', 'Cost']);
    expect(rowOf(systemTip(BOOST, 'en'), 'Cost')?.value).toBe('2,400 Diamonds');
    expect(systemTip(BOOST, 'es').key).toBe('sistema:boost');
    expect(systemTip(BOOST, 'es').width).toBe(282);
    expect(systemTip(BOOST, 'es').head).toEqual({ type: 'sprite', sprite: BOOST.sprite });
  });

  it('drops a record row with no value and one with no label', () => {
    const tip = systemTip(
      {
        ...BOOST,
        tooltip: [
          { etiqueta: { es: 'Máximo', en: 'Maximum' }, valor: { es: '', en: '' } },
          { etiqueta: { es: '', en: '' }, valor: { es: '+20', en: '+20' } },
          { etiqueta: { es: 'Coste', en: 'Cost' }, valor: { es: UNKNOWN, en: UNKNOWN } },
        ],
      },
      'es',
    );
    expect(tip.rows).toEqual([]);
  });

  it('paints an empty panel for a system with no tooltip rows yet', () => {
    expect(systemTip({ ...BOOST, tooltip: [] }, 'es').rows).toEqual([]);
  });
});

describe('diamondsTip', () => {
  it('builds the two rows of §8.5 from the moneda object, never from the code', () => {
    for (const locale of locales) {
      const labels = LABELS[locale];
      const tip = diamondsTip(MONEDA, locale, labels, { sprite: DIAMOND_SPRITE, animated: true });
      expect(tip?.key).toBe('moneda:diamonds');
      expect(tip?.title).toBe('Diamonds');
      expect(tip?.width).toBe(240);
      expect(labelsOf(tip)).toEqual([labels.boughtAt, labels.usedFor]);
      expect(rowOf(tip, labels.boughtAt)?.value).toEqual({
        list: locale === 'es' ? ['Tienda de Diamonds'] : ['Diamond shop'],
      });
    }
  });

  it('animates the Diamond only where the caller asks for it (§7.5.3)', () => {
    const inTrade = diamondsTip(MONEDA, 'es', LABELS.es, {
      sprite: DIAMOND_SPRITE,
      animated: true,
    });
    const elsewhere = diamondsTip(MONEDA, 'es', LABELS.es, { sprite: DIAMOND_SPRITE });
    expect(inTrade?.head).toEqual({ type: 'sprite', sprite: DIAMOND_SPRITE });
    expect(elsewhere?.head).toEqual({
      type: 'sprite',
      sprite: { src: DIAMOND_SPRITE.src, frames: 7, mode: 'animacion' },
    });
    // The record the caller passed is never mutated.
    expect(DIAMOND_SPRITE.durations).toHaveLength(7);
  });

  it('drops the row of an empty list and the whole panel when no row is left (R2)', () => {
    const half = diamondsTip(
      { seCompranEn: { es: [], en: [] }, seUsanEn: MONEDA.seUsanEn },
      'es',
      LABELS.es,
    );
    expect(labelsOf(half)).toEqual(['Se usan en']);
    expect(
      diamondsTip(
        { seCompranEn: { es: [], en: [] }, seUsanEn: { es: [], en: [] } },
        'es',
        LABELS.es,
      ),
    ).toBeNull();
    expect(diamondsTip(null, 'es', LABELS.es)).toBeNull();
  });
});

describe('pokedolaresTip', () => {
  it('has the currency name of the locale and the same two rows', () => {
    expect(pokedolaresTip(MONEDA, 'es', LABELS.es)?.title).toBe('Pokédólares');
    expect(pokedolaresTip(MONEDA, 'en', LABELS.en)?.title).toBe('Pokédollars');
    expect(pokedolaresTip(MONEDA, 'es', LABELS.es)?.key).toBe('moneda:pokedolares');
    expect(pokedolaresTip(MONEDA, 'es', LABELS.es)?.width).toBe(240);
    expect(labelsOf(pokedolaresTip(MONEDA, 'en', LABELS.en))).toEqual(['Bought at', 'Used for']);
  });

  it('is null while no registry writes a moneda object for it (R2, R5)', () => {
    expect(pokedolaresTip(null, 'es', LABELS.es)).toBeNull();
    expect(pokedolaresTip(undefined, 'en', LABELS.en)).toBeNull();
  });
});

describe('every builder', () => {
  const built = (locale: Locale): TipData[] =>
    [
      pokemonTip(CHARIZARD, locale, LABELS[locale]),
      elementTip(FIRE, locale, LABELS[locale]),
      itemTip(FIRE_STONE, locale, LABELS[locale]),
      systemItemTip(CHARGER, locale, LABELS[locale]),
      systemTip(BOOST, locale),
      diamondsTip(MONEDA, locale, LABELS[locale], { sprite: DIAMOND_SPRITE }),
      pokedolaresTip(MONEDA, locale, LABELS[locale]),
    ].filter((tip): tip is TipData => tip !== null);

  it('never emits a null value nor the dash inside a row (X13/T32)', () => {
    for (const locale of locales) {
      for (const tip of built(locale)) {
        for (const row of tip.rows) {
          expect(row.value).not.toBeNull();
          expect(row.label).not.toBe(UNKNOWN);
        }
        expect(tipStrings(tip)).not.toContain(UNKNOWN);
      }
    }
  });

  it('only emits the four widths of §7.5.2', () => {
    for (const locale of locales) {
      for (const tip of built(locale)) expect([282, 240, 300, 200]).toContain(tip.width);
    }
  });

  it('keys every panel as "<tipo>:<id>" (§7.5.2), the currencies included', () => {
    for (const tip of built('es')) expect(tip.key).toMatch(/^[a-z-]+:[a-z0-9-]+$/);
  });

  it('paints no Spanish label inside en', () => {
    const spanishOnly = Object.entries(LABELS.es)
      .filter(([key]) => LABELS.en[key as keyof TipLabels] !== LABELS.es[key as keyof TipLabels])
      .map(([, value]) => value);
    for (const tip of built('en')) {
      for (const row of tip.rows) expect(spanishOnly).not.toContain(row.label);
    }
  });

  it('stays serializable, so the same data travels to an island and to datos.json (DP3, PR5)', () => {
    for (const locale of locales) {
      for (const tip of built(locale)) {
        expect(JSON.parse(JSON.stringify(tip))).toEqual(tip);
      }
    }
  });
});

describe('GameTooltip paints the sections of a TipData', () => {
  it('draws the section chevrons with Glyph, the only SVG of the site (C-R7)', () => {
    const tip: TipData = {
      key: 'item:fire-stone',
      title: 'Fire Stone',
      width: 282,
      head: { type: 'sprite', sprite: null },
      rows: [],
      sections: [
        { kind: 'held', label: 'Held Items: 1', items: [{ name: 'X-Attack', sprite: null }] },
      ],
    };
    const html = renderToStaticMarkup(
      createElement(GameTooltip, { tip, locale: 'es', hint: 'Mantén Shift para fijar' }),
    );
    const svgs = html.match(/<svg[^>]*>/g) ?? [];
    expect(svgs, 'down while open, right while closed').toHaveLength(2);
    for (const svg of svgs) expect(svg).toMatch(/class="lucide /);
    expect(html).toContain('ac-game-tooltip__chevron-open');
    expect(html).toContain('ac-game-tooltip__chevron-closed');
  });
});
