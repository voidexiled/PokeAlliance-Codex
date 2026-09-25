import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { TierTip } from '@/components/filters/TierTip';
import { GameTooltip } from '@/components/game/GameTooltip';
import { TierTipPanel, TierValue } from '@/components/game/TierBadge';
import { decodeItems, decodeItemsRefs, itemPanel } from '@/components/items/config';
import { decodePokedex, decodeRefs } from '@/components/pokedex/config';
import { itemEntry, tipOf } from '@/components/pokedex/PokedexViews';
import { TierChip } from '@/components/pokemon/TierChip';
import type { Locale } from '@/i18n/config';
import { en } from '@/i18n/messages/en';
import { es } from '@/i18n/messages/es';
import {
  getAuras,
  getCategorias,
  getElementos,
  getItem,
  getItems,
  getMonedaDiamantes,
} from '@/lib/content/registry';
import { getPokemon, getPokemonById } from '@/lib/content/repository';
import { decodePanels } from '@/lib/game/panels';
import {
  auraTipRecord,
  elementTipRecord,
  itemTipRecord,
  pokemonTipRecord,
} from '@/lib/game/tip-records';
import {
  diamondsTip,
  elementTip,
  gearTip,
  itemTip,
  leanTipLabels,
  pokemonTip,
  TIP_EXTRA_LABELS,
  tipExtraLabels,
  withTipLabels,
  type TipData,
  type TipRow,
} from '@/lib/game/tips';
import { buildItemsData } from '@/pages/[locale]/items/datos.json.ts';
import { buildPanelsData } from '@/pages/[locale]/paneles.json.ts';
import { buildPokedexData } from '@/pages/[locale]/pokedex/datos.json.ts';

// Owner rule of 2026-09-25: every game tooltip complete, on every surface. For one real record
// of each kind of entity, its panel carries every row the registries can fill, and a list
// island that builds it from its data file plus `/{l}/paneles.json` draws the same panel as a
// page that builds it on the server.

const UI = { es: es.ui, en: en.ui } as const;
const locales: Locale[] = ['es', 'en'];

function rowOf(tip: TipData | null, label: string | undefined): TipRow | undefined {
  return tip?.rows.find((row) => row.label === label);
}

function valueOf(tip: TipData | null, label: string | undefined): string | undefined {
  const value = rowOf(tip, label)?.value;
  if (value === undefined) return undefined;
  if (typeof value === 'string') return value;
  if ('list' in value) return value.list.join(', ');
  if ('pd' in value) return String(value.pd);
  if ('dia' in value) return String(value.dia);
  if ('unknown' in value) return '—';
  if ('icons' in value) return value.icons.map((icon) => icon.name).join(', ');
  return JSON.stringify(value.price);
}

/** Every text a panel paints: none of them may be the dash (T32). */
function strings(tip: TipData): string[] {
  const all = [tip.title, tip.text?.value ?? '', ...tip.rows.map((row) => row.label)];
  for (const { value } of [...tip.rows, ...(tip.market ?? [])]) {
    if (typeof value === 'string') all.push(value);
    else if ('list' in value) all.push(...value.list);
  }
  return all;
}

function serverItemTip(id: string, locale: Locale = 'es'): TipData {
  const item = getItem(id);
  if (item === undefined) throw new Error(`content has no item ${id}`);
  return itemTip(itemTipRecord(item, locale), locale, UI[locale].tooltip);
}

describe('item panels (server)', () => {
  it('a held item shows its effect, slot and tier (P1, P9)', () => {
    for (const locale of locales) {
      const labels = UI[locale].tooltip;
      const tip = serverItemTip('x-attack-t1', locale);
      expect(tip.width).toBe(300);
      expect(tip.text?.value).toMatch(/attack/i);
      // The game text is English: on a Spanish page it says so (T22).
      expect(tip.text?.lang).toBe(locale === 'es' ? 'en' : undefined);
      expect(valueOf(tip, labels.slot)).toBe('X');
      expect(valueOf(tip, labels.tier)).toBe('1');
      expect(valueOf(tip, labels.category)).toBe('Helds');
      expect(valueOf(tip, labels.market)).toBe(labels.tradeable);
    }
  });

  it('every held item has its game text, slot (when the game says it) and tier', () => {
    const labels = UI.es.tooltip;
    const helds = getItems('helds');
    expect(helds.length).toBeGreaterThan(90);
    for (const held of helds) {
      const tip = serverItemTip(held.id);
      expect(tip.text?.value, held.id).toBeTruthy();
      // «Held Item (Tier: n)» gives a random held: the game does not say its slot.
      if (held.held?.ranura === null) expect(valueOf(tip, labels.slot), held.id).toBeUndefined();
      else expect(valueOf(tip, labels.slot), held.id).toMatch(/^[XY]$/);
      expect(valueOf(tip, labels.tier), held.id).toBe(String(held.held?.tier));
    }
  });

  it('a Poké Ball shows what it favours, how to get it, its price and its aura', () => {
    const labels = UI.es.tooltip;
    const magu = serverItemTip('magu-ball');
    expect(magu.text?.value).toMatch(/FIRE or GROUND/);
    expect(valueOf(magu, labels.bestAgainst)).toBe('Fuego, Tierra');
    // Each shop with its offers, and the Battle Pass levels (owner request 2026-09-25).
    expect(valueOf(magu, 'Diamond Shop')).toBe('100 por 5 Diamonds, 1.000 por 45 Diamonds');
    expect(valueOf(magu, 'Online Shop')).toBe('5 por 100 Online Points');
    expect(valueOf(magu, labels.battlePass)).toBe('Nivel 4');
    expect(valueOf(serverItemTip('magu-ball', 'en'), 'Diamond Shop')).toBe(
      '100 for 5 Diamonds, 1,000 for 45 Diamonds',
    );
    expect(valueOf(magu, labels.market)).toBe('Comercializable');

    expect(valueOf(serverItemTip('fast-ball'), labels.bestAgainst)).toBe('Pokémon Fast');
    expect(valueOf(serverItemTip('fast-ball', 'en'), UI.en.tooltip.bestAgainst)).toBe(
      'Fast Pokémon',
    );
    expect(valueOf(serverItemTip('heavy-ball'), labels.bestAgainst)).toBe('Pokémon Heavy');
    expect(valueOf(serverItemTip('premier-ball'), labels.aura)).toBe('Premier');
    expect(valueOf(serverItemTip('alliance-ball'), labels.aura)).toBe('Alliance');
    // The NPC sells the basic Balls (`precioNpc.compra`).
    expect(valueOf(serverItemTip('poke-ball'), labels.shopPrice)).toBe('5');
    expect(valueOf(serverItemTip('ultra-ball'), labels.shopPrice)).toBe('130');
    const ultra = serverItemTip('ultra-ball');
    expect(valueOf(ultra, labels.obtainedFrom)).toContain('Ratpack Rumble');
    expect(valueOf(ultra, labels.battlePass)).toBe('Nivel 2, 8, 14, 21, 24, 28, 35');
    expect(valueOf(ultra, labels.calendar)).toBe('Día 1');
  });

  it('a Ball shows its catch rate only once the owner types it: no «—» row while unknown', () => {
    const labels = UI.es.tooltip;
    const ball = getItem('great-ball');
    if (ball === undefined) throw new Error('content has no great-ball');
    for (const entry of getItems('poke-balls'))
      if (entry.ball?.tasa == null)
        expect(rowOf(serverItemTip(entry.id), labels.catchRate), entry.id).toBeUndefined();
    const html = renderToStaticMarkup(
      createElement(GameTooltip, { tip: serverItemTip('great-ball'), locale: 'es' }),
    );
    expect(html).not.toContain('Tasa de captura');
    const typed = { ...ball, ball: { tasa: 1.5, elementos: [], condicion: null, aura: null } };
    const tip = itemTip(itemTipRecord(typed, 'es'), 'es', labels);
    expect(valueOf(tip, labels.catchRate)).toBe('×1,5');
    const four = { ...typed, ball: { ...typed.ball, tasa: 4 } };
    expect(valueOf(itemTip(itemTipRecord(four, 'en'), 'en', UI.en.tooltip), 'Catch rate')).toBe(
      '×4',
    );
  });

  it('an evolution stone shows what it evolves, its element, its droppers and its price', () => {
    const labels = UI.es.tooltip;
    const water = serverItemTip('water-stone');
    expect(water.text?.value).toMatch(/evolve/);
    expect(valueOf(water, labels.evolves)).toMatch(/^\d+ Pokémon$/);
    expect(valueOf(water, labels.element)).toBe('Agua');
    expect(valueOf(water, labels.droppedBy)).toMatch(/Pokémon/);
    expect(rowOf(water, labels.npcPrice)?.value).toEqual({ pd: 3000 });
    // Heart Stone is the Stone of two elements.
    expect(valueOf(serverItemTip('heart-stone'), labels.element)).toBe('Normal / Hada');
  });

  it('a Mega Stone names its Pokémon', () => {
    const labels = UI.es.tooltip;
    const tip = serverItemTip('charizardite-y');
    expect(valueOf(tip, labels.megaOf)).toBe('Charizard');
    expect(tip.text?.value).toMatch(/Mega Evolve/);
  });

  it('«Drop de» reads every loot zone: an item only Wildscape or Primal drops has droppers', () => {
    const labels = UI.es.tooltip;
    const base = new Set(getPokemon().flatMap((record) => (record.drops ?? []).map((d) => d.item)));
    const zoned = getPokemon().flatMap((record) => [
      ...(record.dropsPorZona?.wildscape ?? []),
      ...(record.dropsPorZona?.primal ?? []),
    ]);
    const only = zoned.find((drop) => !base.has(drop.item) && getItem(drop.item) !== undefined);
    expect(only).toBeDefined();
    if (only === undefined) return;
    expect(rowOf(serverItemTip(only.item), labels.droppedBy)).toBeDefined();
  });

  it('every item panel shows every fact its record has, and never the dash', () => {
    const labels = UI.es.tooltip;
    for (const item of getItems()) {
      const tip = serverItemTip(item.id);
      expect(strings(tip).includes('—'), item.id).toBe(false);
      if (item.descripcion) expect(tip.text?.value, item.id).toBeTruthy();
      if (typeof item.mercado === 'boolean')
        expect(rowOf(tip, labels.market), item.id).toBeDefined();
      const obtencion = item.obtencion ?? {};
      for (const shop of obtencion.tiendas ?? [])
        expect(rowOf(tip, shop.tienda), `${item.id} ${shop.tienda}`).toBeDefined();
      if ((obtencion.pase ?? []).length > 0)
        expect(rowOf(tip, labels.battlePass), item.id).toBeDefined();
      if ((obtencion.calendario ?? []).length > 0)
        expect(rowOf(tip, labels.calendar), item.id).toBeDefined();
      if ((obtencion.tareas ?? []).length > 0)
        expect(rowOf(tip, labels.obtainedFrom), item.id).toBeDefined();
      for (const recipe of obtencion.recetas ?? [])
        expect(rowOf(tip, recipe.taller ?? labels.crafting), item.id).toBeDefined();
      if (item.ball?.tasa != null) expect(rowOf(tip, labels.catchRate), item.id).toBeDefined();
      if ((item.mega?.pokemon ?? []).length > 0)
        expect(rowOf(tip, labels.megaOf), item.id).toBeDefined();
      if ((item.ball?.elementos ?? []).length > 0 || item.ball?.condicion)
        expect(rowOf(tip, labels.bestAgainst), item.id).toBeDefined();
      if (item.precioNpc.vende !== null) expect(rowOf(tip, labels.npcPrice), item.id).toBeDefined();
      if (item.precioNpc.compra !== null)
        expect(rowOf(tip, labels.shopPrice), item.id).toBeDefined();
    }
  });
});

describe('Pokémon panels', () => {
  it('show number, moveset, traits and field abilities besides the five rows', () => {
    for (const locale of locales) {
      const labels = UI[locale].tooltip;
      const charizard = getPokemonById('charizard');
      if (charizard === undefined) throw new Error('content has no charizard');
      const tip = pokemonTip(pokemonTipRecord(charizard), locale, labels);
      expect(valueOf(tip, labels.requirement)).toBeTruthy();
      expect(valueOf(tip, labels.tier)).toBeTruthy();
      expect(valueOf(tip, labels.elements)).toBe(
        locale === 'es' ? 'Fuego / Volador' : 'Fire / Flying',
      );
      expect(valueOf(tip, labels.moveset)).toBe(locale === 'es' ? 'Fuego' : 'Fire');
      expect(valueOf(tip, labels.number)).toBe('6');
      expect(valueOf(tip, labels.generation)).toBe('1');
      expect(valueOf(tip, labels.role)).toBeTruthy();
      expect(valueOf(tip, labels.abilities)).toContain('Fly');
    }
    const fast = getPokemon().find((record) => record.rapido === true);
    expect(fast).toBeDefined();
    if (fast !== undefined) {
      const tip = pokemonTip(pokemonTipRecord(fast), 'es', UI.es.tooltip);
      expect(valueOf(tip, UI.es.tooltip.traits)).toContain('Fast');
    }
  });
});

describe('Pokémon effectiveness', () => {
  it('draws Débil a, Resiste and Inmune as element icons from the record', () => {
    const labels = UI.es.tooltip;
    const name = (id: string) =>
      getElementos().find((element) => element.id === id)?.nombre.es ?? id;
    const charizard = getPokemonById('charizard');
    if (charizard?.efectividad === undefined) throw new Error('charizard has no efectividad');
    const tip = pokemonTip(pokemonTipRecord(charizard), 'es', labels);
    const { muyDebil, debil, resiste, muyResistente, inmune } = charizard.efectividad;
    expect(valueOf(tip, labels.weakTo)).toBe([...muyDebil, ...debil].map(name).join(', '));
    expect(valueOf(tip, labels.resists)).toBe([...resiste, ...muyResistente].map(name).join(', '));
    expect(valueOf(tip, labels.immune)).toBe(inmune.map(name).join(', '));
    const weak = rowOf(tip, labels.weakTo)?.value;
    expect(weak !== undefined && typeof weak === 'object' && 'icons' in weak).toBe(true);
    const html = renderToStaticMarkup(createElement(GameTooltip, { tip, locale: 'es' }));
    expect(html).toContain('ac-game-tooltip__icons');
    expect(html).toContain(`alt="${name(inmune[0] ?? 'ground')}"`);
    expect(html).not.toMatch(/rel="preload"[^>]*elementos/);
  });

  it('a Pokémon without efectividad has none of the three rows', () => {
    const labels = UI.es.tooltip;
    const without = getPokemon().find((record) => record.efectividad === undefined);
    if (without === undefined) return;
    const tip = pokemonTip(pokemonTipRecord(without), 'es', labels);
    for (const label of [labels.weakTo, labels.resists, labels.immune])
      expect(rowOf(tip, label)).toBeUndefined();
  });

  it('travels in paneles.json as a few letters per Pokémon', () => {
    const panels = decodePanels(JSON.parse(JSON.stringify(buildPanelsData('es'))));
    expect(panels.tipos?.length).toBe(getElementos().length);
    expect(panels.pokemon.charizard?.efectividad).toMatch(/^[a-z]*\|[a-z]*\|[a-z]*$/);
  });
});

describe('element, aura and addon panels', () => {
  it('an element names its Stone, Fragment and Ball', () => {
    const labels = UI.es.tooltip;
    const fire = getElementos().find((element) => element.id === 'fire');
    if (fire === undefined) throw new Error('content has no fire element');
    const tip = elementTip(elementTipRecord(fire, 'es'), 'es', labels);
    expect(valueOf(tip, labels.stone)).toBe('Fire Stone');
    expect(valueOf(tip, labels.fragment)).toBeTruthy();
    expect(valueOf(tip, labels.ball)).toBe('Magu Ball');
  });

  it('an aura names the Ball that unlocks it; an addon its Pokémon', () => {
    const labels = UI.es.tooltip;
    const premier = getAuras().find((aura) => aura.id === 'premier');
    if (premier === undefined) throw new Error('content has no premier aura');
    const aura = gearTip('aura', auraTipRecord(premier, 'es'), labels);
    expect(aura.title).toBe('Premier');
    expect(valueOf(aura, labels.comesWith)).toBe('Premier Ball');
    const addon = gearTip(
      'addon',
      { id: 'hat', nombre: 'Hat', sprite: null, pokemon: 'Bulbasaur' },
      labels,
    );
    expect(valueOf(addon, labels.pokemon)).toBe('Bulbasaur');
  });
});

describe('currencies and tiers', () => {
  it('Diamonds are spent at the shops that price in them, on the amount and on the item', () => {
    expect(diamondsTip(null, 'es', UI.es.tooltip)).toBeNull();
    const panel = diamondsTip(getMonedaDiamantes(), 'es', UI.es.tooltip);
    expect(valueOf(panel, UI.es.tooltip.usedFor)).toContain('Diamond Shop');
    const diamond = serverItemTip('diamond');
    expect(valueOf(diamond, UI.es.tooltip.usedFor)).toContain('Diamond Shop');
    expect(valueOf(diamond, UI.es.tooltip.market)).toBe('Comercializable');
  });

  it('a tier without «Max brokes» has no tooltip and no trigger: it would only repeat the chip', () => {
    const panel = renderToStaticMarkup(
      createElement(TierTipPanel, { id: 't', tier: 3, maxBrokesLabel: 'Max brokes', locale: 'es' }),
    );
    expect(panel).toBe('');
    const value = renderToStaticMarkup(
      createElement(TierValue, { tier: 3, maxBrokesLabel: 'Max brokes', locale: 'es' }),
    );
    expect(value).toBe('<span>T3</span>');
    const chip = renderToStaticMarkup(
      createElement(TierChip, { tier: 3, maxBrokesLabel: 'Max brokes', locale: 'es' }),
    );
    expect(chip).not.toContain('<button');
    expect(chip).not.toContain('aria-describedby');
    expect(chip).toContain('T3');
    const menu = renderToStaticMarkup(
      createElement(TierTip, { id: 't', name: 'T3', maxBrokes: null, label: 'Max brokes' }),
    );
    expect(menu).toBe('');
    expect(
      renderToStaticMarkup(
        createElement(TierTip, { id: 't', name: 'T3', maxBrokes: 700, label: 'Max brokes' }),
      ),
    ).toContain('700');
  });
});

describe('GameTooltip', () => {
  it('writes the game text of each held item of a section under its name', () => {
    const html = renderToStaticMarkup(
      createElement(GameTooltip, {
        tip: {
          key: 'listing:x',
          title: 'Charizard',
          width: 282,
          head: { type: 'none' },
          rows: [],
          sections: [
            {
              kind: 'held',
              label: 'Held Items: 1',
              items: [
                {
                  name: 'X-Attack (Tier: 1)',
                  sprite: null,
                  text: { value: 'Increase the attack by 8%.', lang: 'en' },
                },
              ],
            },
          ],
        },
        locale: 'es',
      }),
    );
    expect(html).toMatch(/X-Attack \(Tier: 1\)<span class="ac-game-tooltip__held-text" lang="en">/);
  });

  it('paints the game text as a wrapping paragraph in its own language', () => {
    const html = renderToStaticMarkup(
      createElement(GameTooltip, { tip: serverItemTip('x-attack-t1'), locale: 'es' }),
    );
    expect(html).toMatch(/<p class="ac-game-tooltip__text" lang="en">[^<]*attack/i);
    expect(html).toContain('Ranura:');
  });
});

describe('list panels = page panels (paneles.json)', () => {
  it('carries the labels of every extra row and nothing else', () => {
    for (const locale of locales) {
      const panels = decodePanels(JSON.parse(JSON.stringify(buildPanelsData(locale))));
      expect(Object.keys(panels.etiquetas).sort()).toEqual([...TIP_EXTRA_LABELS].sort());
      expect(panels.etiquetas).toEqual(tipExtraLabels(UI[locale].tooltip));
      // A lean props object gets them back with the file.
      const lean = leanTipLabels(UI[locale].tooltip);
      expect(withTipLabels(lean, panels.etiquetas)).toEqual(UI[locale].tooltip);
    }
  });

  it('an item of the Items list draws the panel of its page once the file is here', () => {
    const locale: Locale = 'es';
    const labels = UI[locale].tooltip;
    const file = JSON.parse(JSON.stringify(buildItemsData(locale))) as unknown;
    const rows = new Map(decodeItems(file).map((row) => [row.id, row]));
    const refs = decodeItemsRefs(file);
    const panels = decodePanels(JSON.parse(JSON.stringify(buildPanelsData(locale))));
    for (const id of ['x-attack-t1', 'magu-ball', 'water-stone', 'charizardite-y', 'revive']) {
      const row = rows.get(id);
      if (row === undefined) throw new Error(`items/datos.json has no ${id}`);
      const categoryName =
        getCategorias().find((entry) => entry.id === row.categoria)?.nombre[locale] ?? null;
      const list = itemPanel(row, refs, categoryName, locale, labels, itemTip, panels.items[id]);
      const page = serverItemTip(id, locale);
      expect(list.text, id).toEqual(page.text);
      expect(list.rows, id).toEqual(page.rows);
    }
  });

  it('a drop of the Pokédex and a Pokémon slot get the rest of their panel from the file', () => {
    const locale: Locale = 'es';
    const labels = UI[locale].tooltip;
    const file = JSON.parse(JSON.stringify(buildPokedexData(locale))) as unknown;
    const rows = decodePokedex(file);
    const refs = decodeRefs(file);
    const panels = decodePanels(JSON.parse(JSON.stringify(buildPanelsData(locale))));
    const [id, ref] = Object.entries(refs.items).find(([key]) => key === 'water-stone') ?? [];
    if (id === undefined || ref === undefined) throw new Error('no water-stone drop');
    const drop = itemEntry(id, ref, rows, locale, labels, panels.items[id]);
    expect(drop.tip?.text).toEqual(serverItemTip(id).text);
    expect(valueOf(drop.tip ?? null, labels.evolves)).toBe(
      valueOf(serverItemTip(id), labels.evolves),
    );

    const charizard = rows.find((row) => row.id === 'charizard');
    if (charizard === undefined) throw new Error('no charizard row');
    const context = {
      locale,
      ui: es.ui,
      panels,
      pokedex: es.pokedex,
      title: 'Pokédex',
      names: new Map(Object.entries(refs.elementos).map(([key, value]) => [key, value.nombre])),
      layout: { keys: [], drops: false } as never,
      elementsOf: () => [],
      anchor: () => undefined,
      lazy: () => undefined,
    };
    const record = getPokemonById('charizard');
    if (record === undefined) throw new Error('content has no charizard');
    expect(tipOf(charizard, context).rows).toEqual(
      pokemonTip(pokemonTipRecord(record), locale, labels).rows,
    );
    // A Mega form: its Mega Stone reaches the list panel through the file too.
    const megaRow = rows.find((row) => row.id === 'mega-charizard-x');
    const mega = getPokemonById('mega-charizard-x');
    if (megaRow !== undefined && mega !== undefined) {
      expect(tipOf(megaRow, context).rows).toEqual(
        pokemonTip(pokemonTipRecord(mega), locale, labels).rows,
      );
    }
  });
});

describe('Mega forms', () => {
  it('name the Mega Stone that gives them, X and Y apart', () => {
    for (const locale of locales) {
      const labels = UI[locale].tooltip;
      for (const [form, stone] of [
        ['mega-charizard-x', 'Charizardite X'],
        ['mega-charizard-y', 'Charizardite Y'],
        ['mega-venusaur', 'Venusaurite'],
      ] as const) {
        const record = getPokemonById(form);
        if (record === undefined) throw new Error(`content has no ${form}`);
        const tip = pokemonTip(pokemonTipRecord(record), locale, labels);
        expect(valueOf(tip, labels.megaStone), form).toBe(stone);
      }
      // A Pokémon that is no Mega form has no such row.
      const charizard = getPokemonById('charizard');
      if (charizard === undefined) throw new Error('content has no charizard');
      expect(
        rowOf(pokemonTip(pokemonTipRecord(charizard), locale, labels), labels.megaStone),
      ).toBeUndefined();
    }
  });
});
