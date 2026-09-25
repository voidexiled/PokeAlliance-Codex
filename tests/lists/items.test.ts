// The `items` list of spec 8.0.6 and 8.5 over the registry the build reads: the rows and
// `refs` of `/{l}/items/datos.json` (PR5), the first page and the count each item page prints
// (WD1), the 14 tabs of the category navigation, the state the list controller derives from a
// URL, and the Market half of the search index (8.6). Every expectation is computed from the
// registry, never copied from a board (X4), so a change of `content/` changes it (S19).
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ALL_CATEGORY,
  ITEMS_FIELDS,
  ITEMS_PAGE_SIZE,
  ITEMS_PROPS_ROWS,
  decodeItems,
  decodeItemsRefs,
  itemPanel,
  itemsConfig,
  refsOf,
  type ItemsData,
  type ItemsRow,
} from '@/components/items/config';
import { pokedexOrder } from '@/components/pokedex/config';
import { es } from '@/i18n/messages/es';
import { lootZonesOf } from '@/lib/content/item-sources';
import { getCategorias, getElementos, getItems } from '@/lib/content/registry';
import { getPokemon } from '@/lib/content/repository';
import { DROPPER_NAMES_MAX } from '@/lib/game/dropper-limit';
import { itemTip } from '@/lib/game/tips';
import { applyListState, pageCountOf, parseListState, pendingScript } from '@/lib/lists/state';
import { buildSearchIndex } from '../../src/pages/[locale]/buscar/indice.json';
import {
  buildItemsData,
  itemTabs,
  itemsFirstPage,
} from '../../src/pages/[locale]/items/datos.json';

/** The 13 real Market categories in the order of the registry (8.5). */
const REAL = getCategorias().filter((category) => category.virtual !== true);
const CATEGORY_IDS = REAL.map((category) => category.id);

/** Every item the build keeps, in the Market order and, inside a category, its file's. */
function marketOrder(): string[] {
  return REAL.flatMap((category) => getItems(category.id).map((item) => item.id));
}

/** «Drop de» of an item (7.5.3): the Pokémon whose `drops` name it, in the order of 8.0.5. */
/** The Pokémon whose loot holds `id` in any zone (Base, Wildscape, Primal), in the order of 8.0.5. */
function droppersOf(id: string): string[] {
  return [...getPokemon()]
    .sort(pokedexOrder('es'))
    .filter((record) =>
      lootZonesOf(record).some(({ drops }) => drops.some((drop) => drop.item === id)),
    )
    .map((record) => record.id);
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('datos.json (PR5)', () => {
  const data = buildItemsData('es');
  const rows = decodeItems(data);

  it('writes every item once, in the Market order and the order of its file', () => {
    expect(data.campos).toEqual(ITEMS_FIELDS);
    expect(rows.map((row) => row.id)).toEqual(marketOrder());
  });

  it('writes the values of each record, `null` for what it does not have', () => {
    const elementIds = new Set(getElementos().map((element) => element.id));
    const records = new Map(getItems().map((item) => [item.id, item]));
    for (const row of rows) {
      const record = records.get(row.id);
      expect(record, row.id).toBeDefined();
      if (record === undefined) continue;
      expect(row.nombre).toBe(record.nombre);
      expect(row.categoria).toBe(record.categoria);
      expect(row.vende).toBe(record.precioNpc.vende);
      expect(row.compra).toBe(record.precioNpc.compra);
      const elemento = record.elemento ?? null;
      expect(row.elemento).toBe(elemento !== null && elementIds.has(elemento) ? elemento : null);
      expect(row.uso).toBe(record.uso?.es ?? null);
      const droppers = droppersOf(row.id);
      // Past DROPPER_NAMES_MAX the row carries how many they are (an Evolution Stone).
      expect(row.dropDe).toEqual(
        droppers.length > DROPPER_NAMES_MAX
          ? droppers.length
          : droppers.length > 0
            ? droppers
            : null,
      );
    }
    const english = decodeItems(buildItemsData('en'));
    for (const row of english) {
      expect(row.uso).toBe(getItems().find((item) => item.id === row.id)?.uso?.en ?? null);
    }
  });

  it('carries in `refs` each element and each Pokémon the rows name, and no other', () => {
    const named = new Set(rows.flatMap((row) => (row.elemento === null ? [] : [row.elemento])));
    // In the order of 8.0.5, the order of content/elementos.json.
    expect(Object.keys(data.refs.elementos)).toEqual(
      getElementos()
        .map((element) => element.id)
        .filter((id) => named.has(id)),
    );
    // A row past DROPPER_NAMES_MAX carries a count and names no Pokémon in `refs`.
    const droppers = new Set(rows.flatMap((row) => (Array.isArray(row.dropDe) ? row.dropDe : [])));
    expect(Object.keys(data.refs.pokemon).sort()).toEqual([...droppers].sort());
  });

  it('decodes its own refs and refuses a file with a bad shape', () => {
    expect(decodeItemsRefs(data)).toEqual(data.refs);
    expect(() => decodeItemsRefs({ ...data, refs: { elementos: {} } })).toThrow();
    expect(() => decodeItems({ ...data, v: 2 })).toThrow();
    if (data.filas.length > 0) {
      expect(() => decodeItems({ ...data, filas: [[...data.filas[0]].fill(1)] })).toThrow();
    }
  });
});

describe('the first page of each item page (8.5, WD1)', () => {
  const data = buildItemsData('es');

  it('«Todo» prints the first items of the Market (ITEMS_PROPS_ROWS) and counts them all', () => {
    const first = itemsFirstPage(data, ALL_CATEGORY);
    expect(first.total).toBe(getItems().length);
    expect(first.rows.map((row) => row.id)).toEqual(marketOrder().slice(0, ITEMS_PROPS_ROWS));
    expect(first.data.filas).toHaveLength(first.rows.length);
    expect(decodeItems(first.data)).toEqual(first.rows);
    expect(first.data.refs).toEqual(refsOf(first.rows, data.refs));
  });

  it('a category prints its own items and counts only those', () => {
    for (const category of CATEGORY_IDS) {
      const first = itemsFirstPage(data, category);
      const ids = getItems(category).map((item) => item.id);
      expect(first.total, category).toBe(ids.length);
      expect(first.rows.map((row) => row.id)).toEqual(ids.slice(0, ITEMS_PROPS_ROWS));
    }
  });

  it('IT2: with OCULTAR_BORRADORES=1 a draft is on no page and in no count', () => {
    vi.stubEnv('OCULTAR_BORRADORES', '1');
    const hidden = buildItemsData('es');
    const visible = getItems().filter((item) => item.borrador !== true);
    expect(decodeItems(hidden).map((row) => row.id)).toEqual(visible.map((item) => item.id));
    for (const category of [ALL_CATEGORY, ...CATEGORY_IDS]) {
      const first = itemsFirstPage(hidden, category);
      const expected =
        category === ALL_CATEGORY ? visible : visible.filter((item) => item.categoria === category);
      // A category without a visible item is the empty state of 8.5: no count, no view.
      expect(first.total, category).toBe(expected.length);
    }
    // The navigation counts pages, not items (IT2): the 14 tabs stay.
    expect(itemTabs('es')).toHaveLength(getCategorias().length);
  });
});

describe('the category navigation (8.5 step 3)', () => {
  it('has «Todo» and the 13 categories in the order of the registry, with their routes', () => {
    for (const locale of ['es', 'en'] as const) {
      const tabs = itemTabs(locale);
      expect(tabs.map((tab) => tab.id)).toEqual(getCategorias().map((category) => category.id));
      for (const [index, tab] of tabs.entries()) {
        const category = getCategorias()[index];
        expect(tab.nombre).toBe(category.nombre[locale]);
        expect(tab.href).toBe(
          category.virtual === true ? `/${locale}/items/` : `/${locale}/items/c/${category.id}/`,
        );
      }
    }
  });
});

describe('the items list (8.0.6)', () => {
  // A list of its own, so the page cut and the groups are measured past 96 rows whatever
  // the registry holds: 102 rows spread over three categories, in the Market order.
  const row = (id: string, categoria: string): ItemsRow => ({
    id,
    nombre: id,
    categoria,
    sprite: null,
    vende: null,
    compra: null,
    elemento: null,
    uso: null,
    dropDe: null,
  });
  const [a, b, c] = CATEGORY_IDS;
  const rows = [
    ...Array.from({ length: 92 }, (_, index) => row(`a-${index}`, a)),
    ...Array.from({ length: 6 }, (_, index) => row(`b-${index}`, b)),
    ...Array.from({ length: 4 }, (_, index) => row(`c-${index}`, c)),
  ];
  const all = itemsConfig('/es/items/datos.json', ALL_CATEGORY, CATEGORY_IDS);
  const one = itemsConfig('/es/items/datos.json', a, CATEGORY_IDS);

  it('has 96 rows a page, one order, no filter, and the anchor of H7', () => {
    for (const config of [all, one]) {
      expect(config.id).toBe('items');
      expect(config.pageSize).toBe(96);
      expect(config.sorts).toHaveLength(1);
      expect(config.filters).toEqual([]);
      expect(config.anchorId?.(rows[0])).toBe('item-a-0');
      expect(config.defaultView).toBe('slots');
      expect(config.views).toEqual(['slots', 'list']);
      expect(config.dataUrl).toBe('/es/items/datos.json');
    }
  });

  it('only «Todo» groups, by category, cutting the page first (CGS 2.1)', () => {
    expect(one.groupBy).toBeUndefined();
    const first = applyListState(all, rows, parseListState(all, ''));
    expect(first.items.map((item) => item.id)).toEqual(rows.slice(0, 96).map((item) => item.id));
    expect(first.groups.map((group) => [group.key, group.items.length])).toEqual([
      [a, 92],
      [b, 4],
    ]);
    const second = applyListState(all, rows, parseListState(all, '?page=2'));
    expect(second.groups.map((group) => [group.key, group.items.length])).toEqual([
      [b, 2],
      [c, 4],
    ]);
    expect(second.pageCount).toBe(pageCountOf(96, rows.length));
  });

  it('offers Ranuras and Lista only: a «cards» view falls back to Ranuras (16.4.1)', () => {
    expect(parseListState(all, '?view=cards').view).toBe('slots');
    expect(parseListState(all, '', 'cards').view).toBe('slots');
    expect(parseListState(all, '?view=list').view).toBe('list');
  });

  it('«Buscar ítem» filters by name (16.4.1)', () => {
    const page = applyListState(all, rows, parseListState(all, '?q=c-3'));
    expect(page.items.map((item) => item.id)).toEqual(['c-3']);
  });

  it('keeps the order the build wrote on every state (V5)', () => {
    const page = applyListState(all, [...rows].reverse(), parseListState(all, '?view=list'));
    expect(page.items[0].id).toBe('c-3');
  });

  it('PR4: the inline script of each page stays under 1 KB', () => {
    for (const config of [all, one]) {
      const script = pendingScript(config, pageCountOf(96, rows.length));
      expect(new TextEncoder().encode(script).length).toBeLessThan(1024);
    }
  });
});

describe('the panels and refs of the rows (7.5.3)', () => {
  const refs: ItemsData['refs'] = {
    elementos: {
      fire: { nombre: 'Fuego', icono: null, stone: 'Fire Stone', fragment: null },
      water: { nombre: 'Agua', icono: null, stone: null, fragment: null },
    },
    pokemon: {
      charmander: {
        nombre: 'Charmander',
        variante: 'normal',
        nivel: 5,
        tier: 7,
        generacion: 1,
        funcion: null,
        imagen: null,
        elementos: ['Fuego'],
      },
      squirtle: {
        nombre: 'Squirtle',
        variante: 'normal',
        nivel: 5,
        tier: 7,
        generacion: 1,
        funcion: null,
        imagen: null,
        elementos: ['Agua'],
      },
    },
  };
  const stone: ItemsRow = {
    id: 'stone',
    nombre: 'Stone',
    categoria: 'stones',
    sprite: null,
    vende: 1500,
    compra: null,
    elemento: 'fire',
    uso: 'Evolución',
    dropDe: ['charmander'],
  };

  it('refsOf keeps only what the rows name', () => {
    expect(refsOf([stone], refs)).toEqual({
      elementos: { fire: refs.elementos.fire },
      pokemon: { charmander: refs.pokemon.charmander },
    });
    expect(refsOf([], refs)).toEqual({ elementos: {}, pokemon: {} });
  });

  it('the item panel has the rows of 8.5 with a value, in their order', () => {
    const tip = itemPanel(stone, refs, 'Stones', 'es', es.ui.tooltip, itemTip);
    const labels = es.ui.tooltip;
    expect(tip.rows.map((entry) => entry.label)).toEqual([
      labels.category,
      labels.droppedBy,
      labels.element,
      labels.use,
      labels.npcPrice,
    ]);
    const values = Object.fromEntries(tip.rows.map((entry) => [entry.label, entry.value]));
    expect(values[labels.droppedBy]).toEqual({ list: ['Charmander'] });
    expect(values[labels.npcPrice]).toEqual({ pd: 1500 });
  });
});

describe('search index: the Market items (8.6)', () => {
  it('writes one entry per item, with the page and the anchor of its category list', () => {
    for (const locale of ['es', 'en'] as const) {
      const entries = buildSearchIndex(locale).filter(
        (entry) => entry.kind === 'item' && entry.href.includes('/items/c/'),
      );
      expect(entries.map((entry) => entry.id)).toEqual(marketOrder());
      for (const category of REAL) {
        getItems(category.id).forEach((item, index) => {
          const entry = entries.find((candidate) => candidate.id === item.id);
          const page = Math.floor(index / ITEMS_PAGE_SIZE) + 1;
          const query = page > 1 ? `?page=${page}` : '';
          expect(entry?.href).toBe(`/${locale}/items/c/${category.id}/${query}#item-${item.id}`);
          expect(entry?.meta).toBe(category.nombre[locale]);
        });
      }
    }
  });

  it('IT2: with OCULTAR_BORRADORES=1 a draft item has no entry', () => {
    // Read before the flag: `getItems` leaves the drafts out once it is set.
    const all = REAL.flatMap((category) => getItems(category.id));
    vi.stubEnv('OCULTAR_BORRADORES', '1');
    const ids = buildSearchIndex('es')
      .filter((entry) => entry.kind === 'item' && entry.href.includes('/items/c/'))
      .map((entry) => entry.id);
    expect(ids).toEqual(all.filter((item) => item.borrador !== true).map((item) => item.id));
  });
});
