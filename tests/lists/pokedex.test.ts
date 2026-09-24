// The `pokedex` list of spec 8.0.6 and 8.2 over the registry the build reads: the rows and
// `refs` of `/{l}/pokedex/datos.json` (PR5), the values each filter accepts (U3, U4) and the
// state the list controller derives from a URL (PX1, PX2). Every expectation is computed from
// the registry, never copied from a board (X4), so a change of `content/` changes it (S19).
import { describe, expect, it } from 'vitest';

import {
  POKEDEX_FIELDS,
  decodePokedex,
  decodeRefs,
  pokedexConfig,
  pokedexOrder,
  tierId,
  type PokedexItemRef,
  type PokedexRow,
} from '@/components/pokedex/config';
import { en } from '@/i18n/messages/en';
import { es } from '@/i18n/messages/es';
import { getElementos, getItem } from '@/lib/content/registry';
import { getPokemon } from '@/lib/content/repository';
import { applyListState, pageCountOf, parseListState, pendingScript } from '@/lib/lists/state';
import {
  buildPokedexData,
  pokedexDrops,
  pokedexElements,
  pokedexIds,
} from '../../src/pages/[locale]/pokedex/datos.json';

const data = buildPokedexData('es');
const rows = decodePokedex(data);
const ids = pokedexIds(rows, data.refs.elementos);
const sortLabels = { numero: 'Número', nombre: 'Nombre', tier: 'Tier', requisito: 'Requisito' };
const config = pokedexConfig('/es/pokedex/datos.json', ids, 'es', sortLabels);

describe('datos.json (PR5)', () => {
  it('writes every record once, in the order of 8.0.5', () => {
    expect(rows).toHaveLength(getPokemon().length);
    expect(data.campos).toEqual(POKEDEX_FIELDS);
    expect([...rows].sort(pokedexOrder('es'))).toEqual(rows);
    const english = decodePokedex(buildPokedexData('en'));
    expect([...english].sort(pokedexOrder('en'))).toEqual(english);
  });

  it('writes the item ids of each record’s drops that the registry gives, or null', () => {
    const byId = new Map(getPokemon().map((record) => [record.id, record]));
    for (const row of rows) {
      const expected = (byId.get(row.id)?.drops ?? [])
        .map((drop) => drop.item)
        .filter((id) => getItem(id) !== undefined);
      expect(row.drops).toEqual(expected.length > 0 ? expected : null);
    }
  });

  it('carries the 18 elements in the order of 8.0.5, named per locale', () => {
    expect(Object.keys(data.refs.elementos)).toEqual(getElementos().map((element) => element.id));
    for (const element of getElementos()) {
      expect(data.refs.elementos[element.id].nombre).toBe(element.nombre.es);
      expect(buildPokedexData('en').refs.elementos[element.id].nombre).toBe(element.nombre.en);
    }
  });

  it('carries each dropped item once, and no other', () => {
    const dropped = new Set(rows.flatMap((row) => row.drops ?? []));
    expect(Object.keys(data.refs.items).sort()).toEqual([...dropped].sort());
    for (const [id, ref] of Object.entries(data.refs.items)) {
      expect(ref.nombre).toBe(getItem(id)?.nombre);
      expect(ref.categoria).toBe(getItem(id)?.categoria);
    }
  });

  it('decodes its own refs and refuses a file without them', () => {
    expect(decodeRefs(data)).toEqual(data.refs);
    expect(() => decodeRefs({ ...data, refs: { elementos: data.refs.elementos } })).toThrow();
    expect(() => decodePokedex({ ...data, filas: [[...data.filas[0]].fill(1)] })).toThrow();
  });

  it('builds the element chips of a page with their panels and no invented row', () => {
    const first = rows.slice(0, 12);
    const used = new Set(first.flatMap((row) => row.elementos));
    const chips = pokedexElements(first, 'es', es.ui.tooltip);
    expect(chips.map((chip) => chip.id)).toEqual(
      getElementos()
        .map((element) => element.id)
        .filter((id) => used.has(id)),
    );
    for (const chip of chips) {
      const element = getElementos().find((entry) => entry.id === chip.id);
      expect(chip.name).toBe(element?.nombre.es);
      // R2: Stone and Fragment only when the registry names them.
      expect(chip.tip.rows.length).toBe(
        [element?.stone, element?.fragment].filter((value) => value !== null).length,
      );
    }
    expect(pokedexElements(first, 'en', en.ui.tooltip)[0]?.name).toBe(
      getElementos().find((element) => used.has(element.id))?.nombre.en,
    );
  });
});

describe('the drops of a page (8.2 step 5)', () => {
  // A small list of its own: the registry has no drops yet, and the builder only reads
  // the rows and `refs` it is given.
  const row = (id: string, nombre: string, drops: string[] | null): PokedexRow => ({
    id,
    nombre,
    numero: null,
    generacion: null,
    variante: 'normal',
    nivel: null,
    tier: null,
    funcion: null,
    elementos: [],
    imagen: null,
    drops,
  });
  const stone: PokedexItemRef = {
    nombre: 'Stone',
    categoria: 'stones',
    sprite: null,
    precioNpc: { vende: 1500, compra: null },
    nombreCategoria: 'Stones',
  };
  const all = [row('a', 'Alpha', ['stone']), row('b', 'Beta', null), row('c', 'Gamma', ['stone'])];

  it('names each item of the page once, with «Drop de» over every row', () => {
    const drops = pokedexDrops(all.slice(0, 2), all, { stone }, 'es', es.ui.tooltip);
    expect(Object.keys(drops)).toEqual(['stone']);
    expect(drops.stone.name).toBe('Stone');
    const rowsOf = Object.fromEntries(
      drops.stone.tip?.rows.map((entry) => [entry.label, entry.value]) ?? [],
    );
    expect(rowsOf[es.ui.tooltip.droppedBy]).toEqual({ list: ['Alpha', 'Gamma'] });
    expect(rowsOf[es.ui.tooltip.category]).toBe('Stones');
    expect(rowsOf[es.ui.tooltip.npcPrice]).toEqual({ pd: 1500 });
    // No shop price in the registry: no row (T32).
    expect(es.ui.tooltip.shopPrice in rowsOf).toBe(false);
  });

  it('leaves out an item that `refs` does not carry', () => {
    expect(pokedexDrops([row('x', 'X', ['gone'])], all, { stone }, 'es', es.ui.tooltip)).toEqual(
      {},
    );
  });
});

describe('filter ids (8.0.6, U3)', () => {
  it('lists generations, tiers, elements and variants from the registry', () => {
    const records = getPokemon();
    const generations = [
      ...new Set(
        records.flatMap((record) => (record.generacion === null ? [] : [record.generacion])),
      ),
    ].sort((a, b) => a - b);
    expect(ids.generations).toEqual(generations.map(String));
    const tierIds = ids.tiers.map(([id]) => id);
    // The Tier ladder of plan «Dirección C», best first: the named tiers, then T1 … T7.
    const numbered = tierIds.filter((id) => /^t\d+$/.test(id));
    expect(tierIds.slice(tierIds.length - numbered.length)).toEqual(numbered);
    const special = tierIds.slice(0, tierIds.length - numbered.length);
    const order = ['ultimate', 'mythic', 'legendary', 'ultra-rare', 'super-rare'];
    expect(special).toEqual(order.filter((id) => special.includes(id)));
    for (const record of records) {
      const tier = tierId(record.tier);
      if (tier !== null) expect(tierIds).toContain(tier);
    }
    expect(ids.elements.map(([id]) => id)).toEqual(getElementos().map((element) => element.id));
    expect(ids.variants).toEqual(
      ['normal', 'shiny'].filter((variant) =>
        records.some((record) => record.variante === variant),
      ),
    );
  });
});

describe('the pokedex list', () => {
  it('PX1: elemento=fire&variante=shiny keeps only the Shiny Pokémon with Fire', () => {
    const page = applyListState(
      config,
      rows,
      parseListState(config, '?elemento=fire&variante=shiny'),
    );
    const expected = getPokemon().filter(
      (record) => record.variante === 'shiny' && record.elementos.includes('fire'),
    );
    expect(page.total).toBe(expected.length);
    for (const item of page.items) {
      expect(item.variante).toBe('shiny');
      expect(item.elementos).toContain('fire');
    }
  });

  it('U4: a value the registry does not have falls back to the default', () => {
    const state = parseListState(config, '?elemento=fuego&tier=t99&variante=gold&gen=99');
    expect(state.filters).toEqual({});
    const generation = ids.generations[0];
    expect(parseListState(config, `?gen=${generation}`).filters).toEqual({ gen: generation });
  });

  it('PX2: a page past the last one is the last one', () => {
    const state = parseListState(config, '?page=9999');
    const page = applyListState(config, rows, state);
    expect(page.state.page).toBe(page.pageCount);
    expect(page.pageCount).toBe(pageCountOf(12, rows.length));
  });

  it('groups the Slots view by generation, with «—» last', () => {
    const page = applyListState(config, rows, parseListState(config, '?view=slots'));
    const keys = page.groups.map((group) => group.key);
    const known = keys.filter((key) => key !== '—');
    expect(known).toEqual([...known].sort((a, b) => Number(a) - Number(b)));
    if (keys.includes('—')) expect(keys.at(-1)).toBe('—');
  });

  it('PR4: the inline script of the real configuration stays under 1 KB', () => {
    const script = pendingScript(config, pageCountOf(12, rows.length));
    expect(new TextEncoder().encode(script).length).toBeLessThan(1024);
  });
});
