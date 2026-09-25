import { describe, expect, it } from 'vitest';

import {
  assetPanel,
  listingCard,
  listingTip,
  tradeDiamonds,
  tradeLabels,
  tradeRecords,
  tradeSprites,
  type TradeCatalog,
  type TradeContext,
} from '@/components/trade/TradeListRoot';
import { es } from '@/i18n/messages/es';
import {
  getAuras,
  getCategorias,
  getElementos,
  getItems,
  getMonedaDiamantes,
  getMundos,
  getOutfits,
  getSpriteRegistry,
} from '@/lib/content/registry';
import { getPokemon } from '@/lib/content/repository';
import { readTradeRegistry } from '@/lib/trade/registry';

// The panel of a Comercio listing (9.5.9) under the owner rule of 2026-09-25: a Pokémon listing
// shows every row of the Pokémon's own panel (Nº, Rasgos, Habilidades included) and each held
// item carries the game's text of what it does, never its name alone.

const { anuncios, vendedores } = readTradeRegistry({ COMERCIO_DEMO: '1' });

function contextOf(): { context: TradeContext; rows: ReturnType<typeof tradeRecords>['rows'] } {
  const registry = getSpriteRegistry();
  const catalog: TradeCatalog = {
    pokemon: getPokemon(),
    items: getItems(),
    categorias: getCategorias(),
    elementos: getElementos(),
    auras: getAuras(),
    outfits: getOutfits(),
    mundos: getMundos('es'),
    vendedores,
    sprites: registry,
    channels: es.trade.channels,
  };
  const { rows, refs } = tradeRecords(anuncios, catalog, 'es');
  return {
    rows,
    context: {
      locale: 'es',
      refs,
      sprites: tradeSprites(registry),
      diamonds: tradeDiamonds(getMonedaDiamantes(), 'es'),
      ui: es.ui,
      labels: tradeLabels(es),
    },
  };
}

describe('listingTip', () => {
  it('a Pokémon listing shows the Pokémon rows and what each held item does', () => {
    const { rows, context } = contextOf();
    const row = rows.find((entry) => entry.id === 'ejemplo-shiny-ditto');
    if (row === undefined) throw new Error('the fixture has no ejemplo-shiny-ditto');
    const tip = listingTip(row, context);
    const labels = tip.rows.map((entry) => entry.label);
    expect(labels).toContain(es.ui.tooltip.number);
    const held = tip.sections?.find((section) => section.kind === 'held');
    expect(held?.kind).toBe('held');
    if (held?.kind !== 'held') return;
    expect(held.items.length).toBeGreaterThan(0);
    for (const item of held.items) expect(item.text?.value, item.name).toBeTruthy();
  });

  it('a Mega form listing names the Mega Stone that gives it, once', () => {
    const base = anuncios.find((entry) => entry.pokemon !== null);
    if (base?.pokemon == null) throw new Error('the fixture has no Pokémon listing');
    const mega = {
      ...base,
      id: 'ejemplo-mega-charizard-x',
      pokemon: { ...base.pokemon, pokemon: 'mega-charizard-x', memorias: [] },
    };
    const catalog = contextOf();
    const { rows, refs } = tradeRecords(
      [mega],
      {
        pokemon: getPokemon(),
        items: getItems(),
        categorias: getCategorias(),
        elementos: getElementos(),
        auras: getAuras(),
        outfits: getOutfits(),
        mundos: getMundos('es'),
        vendedores,
        sprites: getSpriteRegistry(),
        channels: es.trade.channels,
      },
      'es',
    );
    const context = { ...catalog.context, refs };
    const [row] = rows;
    if (row === undefined) throw new Error('no row');
    const stones = (tip: ReturnType<typeof listingTip>) =>
      tip.rows.filter((entry) => entry.label === es.ui.tooltip.megaStone);
    expect(stones(listingTip(row, context)).map((entry) => entry.value)).toEqual([
      'Charizardite X',
    ]);
    // The same stone equipped is not a second «Mega Stone» row.
    const equipped = { ...row, pokemon: { ...row.pokemon!, mega: 'charizardite-x' } };
    expect(stones(listingTip(equipped, context))).toHaveLength(1);
  });

  it('a Diamonds listing says where Diamonds are spent', () => {
    const { rows, context } = contextOf();
    const row = rows.find((entry) => entry.tipo === 'diamonds');
    if (row === undefined) throw new Error('the fixture has no Diamonds listing');
    const tip = listingTip(row, context);
    const usedFor = tip.rows.find((entry) => entry.label === context.labels.card.keys.usedFor);
    expect(usedFor?.value).toEqual({ list: ['Diamond Shop'] });
  });
});

describe('the panels a listing opens besides its own (owner rule 2026-09-25)', () => {
  it('a Ditto listing names its memories in its panel', () => {
    const { rows, context } = contextOf();
    const row = rows.find((entry) => entry.id === 'ejemplo-shiny-ditto');
    if (row === undefined) throw new Error('the fixture has no ejemplo-shiny-ditto');
    const memory = listingTip(row, context).rows.find(
      (entry) => entry.label === es.trade.listing.gear.memory,
    );
    expect(memory?.value).toEqual({ list: ['Dragonite', 'Alakazam', 'Snorlax'] });
    // The sheet of the detail draws them as links under it instead.
    const sheet = listingTip(row, context, {
      addon: 'Addon',
      nextBoostChance: 'Next Boost chance',
    });
    expect(sheet.rows.some((entry) => entry.label === es.trade.listing.gear.memory)).toBe(false);
  });

  it('the card of a Ball listing opens the Ball panel', () => {
    const { rows, context } = contextOf();
    const row = rows.find((entry) => entry.id === 'ejemplo-alliance-ball');
    if (row === undefined) throw new Error('the fixture has no ejemplo-alliance-ball');
    const card = listingCard(row, context, '');
    expect(card.tip?.key).toBe('item:alliance-ball');
    expect(assetPanel(row, context)).toEqual(card.tip);
  });

  it('the card of a Pokémon listing opens the Pokémon panel', () => {
    const { rows, context } = contextOf();
    const row = rows.find((entry) => entry.id === 'ejemplo-bulbasaur');
    if (row === undefined) throw new Error('the fixture has no ejemplo-bulbasaur');
    expect(listingCard(row, context, '').tip?.key).toBe('pokemon:bulbasaur');
  });
});
