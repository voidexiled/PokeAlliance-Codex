import { createElement } from 'react';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ListRow } from '@/components/cards/ListRow';
import { SlotsPanel, SlotsPanelItem } from '@/components/cards/SlotsPanel';
import { EntityList } from '@/components/lists/EntityList';
import type { EntityListProps } from '@/components/lists/EntityList';
import { useListState } from '@/components/lists/useListState';
import { es } from '@/i18n/messages/es';
import type { TipData } from '@/lib/game/tips';
import {
  PENDING_ATTRIBUTE,
  VIEW_STORAGE_PREFIX,
  applyListState,
  defaultListState,
  firstListPage,
  listSearch,
  pageCountOf,
  parseListState,
  pendingScript,
  sameListState,
  sameResultSet,
  serializeListState,
} from '@/lib/lists/state';
import type { ListConfig, ListState } from '@/lib/lists/state';

// U1–U6 of spec 7.7.2 over the pure half of the list controller, plus the page a view
// draws (7.7.4 V2–V5, 8.0.6), the inline script of PR4 (7.7.5), which has to agree with
// `parseListState` on every URL, and the prerendered markup of the list and of its Slots
// and Lista pieces (PR1, PR4, H6, V1, V3, V4, V8). What needs a browser — history, focus,
// hydration — is tests/e2e/lists.spec.ts (C7-10). The rows are synthetic: no text or
// figure of a board is used as data (X4).

type Row = {
  id: string;
  name: string;
  numero: number;
  gen: number | null;
  tier: string;
  elements: string[];
  shiny: boolean;
};

const ELEMENTS = [
  'normal',
  'fire',
  'water',
  'grass',
  'electric',
  'ice',
  'fighting',
  'poison',
  'ground',
  'flying',
  'psychic',
  'bug',
  'rock',
  'ghost',
  'dragon',
  'fairy',
  'dark',
  'steel',
] as const;

const TIERS = [
  't1',
  't2',
  't3',
  't4',
  't5',
  't6',
  't7',
  'super-rare',
  'ultra-rare',
  'legendary',
  'mythic',
  'ultimate',
] as const;

/** 30 rows, three generations and a last one without generation. */
const ROWS: Row[] = Array.from({ length: 30 }, (_, index) => ({
  id: `row-${index + 1}`,
  name: `Ñame ${String.fromCharCode(97 + (index % 26))}${index + 1}`,
  numero: index + 1,
  gen: index === 29 ? null : (index % 3) + 1,
  tier: TIERS[index % TIERS.length] ?? 't1',
  elements: [ELEMENTS[index % ELEMENTS.length] ?? 'normal'],
  shiny: index % 2 === 1,
}));

/** The shape of the Pokédex list of 8.0.6: 12 per page, four filters, one order. */
const dex: ListConfig<Row> = {
  id: 'pokedex',
  pageSize: 12,
  sorts: [{ id: 'numero', label: 'Número', compare: (a, b) => a.numero - b.numero }],
  filters: [
    { key: 'gen', values: 'int', test: (row, value) => row.gen === Number(value) },
    { key: 'tier', values: TIERS, test: (row, value) => row.tier === value },
    { key: 'elemento', values: ELEMENTS, test: (row, value) => row.elements.includes(value) },
    {
      key: 'variante',
      values: ['normal', 'shiny'],
      test: (row, value) => (value === 'shiny' ? row.shiny : !row.shiny),
    },
  ],
  groupBy: (row) => (row.gen === null ? '—' : String(row.gen)),
  groupOrder: ['1', '2', '3'],
  anchorId: (row) => `item-${row.id}`,
};

/** A list with a search, two orders and a text filter, like Comercio (9.5.7). */
const search: ListConfig<Row> = {
  id: 'comercio',
  pageSize: 24,
  sorts: [
    { id: 'recientes', label: 'Recientes', compare: (a, b) => b.numero - a.numero },
    { id: 'nombre', label: 'Nombre', compare: (a, b) => a.name.localeCompare(b.name, 'es') },
  ],
  filters: [
    { key: 'tipo', values: ['pokemon', 'items'], test: () => true },
    { key: 'mundo', values: 'text', test: () => true },
    { key: 'min', values: 'int', test: (row, value) => row.numero >= Number(value) },
  ],
  text: (row) => `${row.name} ${row.elements.join(' ')}`,
};

/** A second list on the same page (8.3): prefixed, no pages, Lista by default. */
const familia: ListConfig<Row> = {
  id: 'familia',
  prefix: 'familia',
  pageSize: Infinity,
  sorts: [{ id: 'orden', label: 'Orden', compare: () => 0 }],
  filters: [],
  defaultView: 'list',
};

const drops: ListConfig<Row> = { ...familia, id: 'drops', prefix: 'drops', defaultView: 'cards' };

function state(config: ListConfig<Row>, change: Partial<ListState>): ListState {
  return { ...defaultListState(config), ...change };
}

describe('U1: the parameters and their order', () => {
  it('writes q, the filters in their order, sort, view and page', () => {
    const full = state(search, {
      q: 'fire stone',
      filters: { min: '5', tipo: 'items', mundo: 'Sun' },
      sort: 'nombre',
      view: 'slots',
      page: 3,
    });
    expect(serializeListState(search, full)).toBe(
      'q=fire+stone&tipo=items&mundo=Sun&min=5&sort=nombre&view=slots&page=3',
    );
    expect(parseListState(search, serializeListState(search, full))).toEqual(full);
  });

  it('prefixes every key of a list that shares its page', () => {
    const next = state(drops, { view: 'list', page: 2 });
    expect(serializeListState(drops, next)).toBe('drops.view=list&drops.page=2');
    expect(parseListState(drops, '?drops.view=list&drops.page=2')).toEqual(next);
    // The keys of the other list, or unprefixed ones, are not this list's.
    expect(parseListState(drops, '?view=list&familia.view=slots')).toEqual(defaultListState(drops));
  });

  it('keeps the parameters of another list when it writes its own', () => {
    expect(listSearch(drops, '?familia.view=cards&drops.page=2', state(drops, { page: 3 }))).toBe(
      '?familia.view=cards&drops.page=3',
    );
    expect(listSearch(drops, '?drops.page=2', defaultListState(drops))).toBe('');
  });
});

describe('U2: defaults are not written', () => {
  it('a URL without parameters is the default state, and back', () => {
    expect(parseListState(dex, '')).toEqual({
      view: 'cards',
      q: '',
      sort: 'numero',
      page: 1,
      filters: {},
    });
    expect(serializeListState(dex, defaultListState(dex))).toBe('');
  });

  it('drops the view, sort and page equal to the default', () => {
    const explicit = parseListState(search, '?view=cards&sort=recientes&page=1&tipo=pokemon');
    expect(serializeListState(search, explicit)).toBe('tipo=pokemon');
  });

  it('follows `defaultView`', () => {
    expect(parseListState(familia, '').view).toBe('list');
    expect(serializeListState(familia, state(familia, { view: 'list' }))).toBe('');
    expect(serializeListState(familia, state(familia, { view: 'cards' }))).toBe(
      'familia.view=cards',
    );
  });
});

describe('U3: values are ids, never labels', () => {
  it('reads the same state in both locales from one URL', () => {
    const url = '?elemento=fire&variante=shiny&view=slots&page=2';
    const read = parseListState(dex, url);
    expect(read.filters).toEqual({ elemento: 'fire', variante: 'shiny' });
    expect(serializeListState(dex, read)).toBe(url.slice(1));
  });

  it('does not take a translated label for an id', () => {
    expect(parseListState(dex, '?elemento=Fuego&variante=Shiny&view=Lista').filters).toEqual({});
    expect(parseListState(dex, '?view=Lista').view).toBe('cards');
  });
});

describe('U4: invalid values fall back to the default', () => {
  it('drops unknown views, orders and filter values', () => {
    const read = parseListState(search, '?view=grid&sort=precio&tipo=diamantes&min=abc&mundo=%20');
    expect(read).toEqual(defaultListState(search));
  });

  it('reads integers in their canonical form', () => {
    expect(parseListState(dex, '?gen=01').filters).toEqual({ gen: '1' });
    expect(parseListState(dex, '?gen=-1').filters).toEqual({});
    expect(parseListState(dex, '?gen=1.5').filters).toEqual({});
    expect(parseListState(dex, '?gen=1234567890123456').filters).toEqual({});
  });

  it('brings a page under 1 to 1', () => {
    for (const page of ['0', '-3', 'abc', '2.5', '']) {
      expect(parseListState(dex, `?page=${page}`).page).toBe(1);
    }
  });

  it('brings a page over the last one to the last one (PX2)', () => {
    const rows = ROWS.slice(0, 13);
    const shown = applyListState(dex, rows, parseListState(dex, '?page=9'));
    expect(shown.pageCount).toBe(2);
    expect(shown.state.page).toBe(2);
    expect(shown.items.map((row) => row.numero)).toEqual([13]);
    // The canonical form the URL is rewritten to after the hydration.
    expect(listSearch(dex, '?page=9', shown.state)).toBe('?page=2');
  });

  it('rewrites a URL to its canonical form', () => {
    const current = '?page=02&view=cards&variante=shiny&elemento=fire&tier=bogus';
    const shown = applyListState(dex, ROWS, parseListState(dex, current));
    expect(listSearch(dex, current, shown.state)).toBe('?elemento=fire&variante=shiny');
  });
});

// §16.4.1: multi-value list filters (comma-separated in the URL, OR within a filter, AND
// across filters), plus the alias a renamed parameter keeps reading (§16.4.2).
const multiDex: ListConfig<Row> = {
  ...dex,
  filters: [
    {
      key: 'tipo',
      values: ELEMENTS,
      multi: true,
      aliasKeys: ['elemento'],
      test: (row, value) => row.elements.includes(value),
    },
    { key: 'tier', values: TIERS, multi: true, test: (row, value) => row.tier === value },
  ],
};

describe('§16.4.1: multi-value list filters', () => {
  it('parses and re-serialises a comma-separated value in canonical order', () => {
    const read = parseListState(multiDex, '?tipo=fire,water');
    expect(read.filters).toEqual({ tipo: 'fire,water' });
    expect(serializeListState(multiDex, read)).toBe('tipo=fire%2Cwater');
  });

  it('drops invalid ids and duplicates, keeping first-seen order', () => {
    expect(parseListState(multiDex, '?tipo=water,bogus,fire,water').filters).toEqual({
      tipo: 'water,fire',
    });
  });

  it('drops the filter entirely when nothing in the list is valid', () => {
    expect(parseListState(multiDex, '?tipo=bogus,also-bogus').filters).toEqual({});
  });

  it('matches a row with any one of the values (OR within the filter)', () => {
    const rows = [
      { ...ROWS[0], elements: ['fire'] },
      { ...ROWS[1], elements: ['water'] },
      { ...ROWS[2], elements: ['grass'] },
    ];
    const shown = applyListState(multiDex, rows, parseListState(multiDex, '?tipo=fire,water'));
    expect(shown.items.map((row) => row.elements)).toEqual([['fire'], ['water']]);
  });

  it('combines two filters with AND across them', () => {
    const rows = [
      { ...ROWS[0], elements: ['fire'], tier: 't1' },
      { ...ROWS[1], elements: ['fire'], tier: 't2' },
      { ...ROWS[2], elements: ['water'], tier: 't1' },
    ];
    const shown = applyListState(
      multiDex,
      rows,
      parseListState(multiDex, '?tipo=fire,water&tier=t1'),
    );
    expect(shown.items).toEqual([rows[0], rows[2]]);
  });

  it('still reads the old parameter name as the new one (§16.4.2)', () => {
    expect(parseListState(multiDex, '?elemento=fire,water').filters).toEqual({
      tipo: 'fire,water',
    });
    // The current name wins when both are present.
    expect(parseListState(multiDex, '?tipo=grass&elemento=fire').filters).toEqual({
      tipo: 'grass',
    });
  });

  it('the pending script (PR4) flags a URL with any multi-filter value, aliased or not', () => {
    const script = pendingScript(multiDex, 1);
    expect(runPending(script, '').pending).toBe(false);
    expect(runPending(script, '?tipo=fire').pending).toBe(true);
    expect(runPending(script, '?elemento=fire').pending).toBe(true);
    expect(runPending(script, '?tier=t1,t2').pending).toBe(true);
  });
});

describe('U5: the search', () => {
  it('matches every fragment, split on spaces and commas, without case or accents', () => {
    const find = (q: string) =>
      applyListState(search, ROWS, state(search, { q })).items.map((row) => row.numero);
    expect(find('ñame a1,')).toEqual(find('NAME A1'));
    expect(find('name a1 fire')).toEqual([]);
    expect(find('name  b2 , fire')).toEqual([2]);
    // A query of spaces does not filter: the whole list is counted.
    expect(applyListState(search, ROWS, state(search, { q: '   ' })).total).toBe(ROWS.length);
  });

  it('is not part of a list without `text`', () => {
    expect(parseListState(dex, '?q=fire').q).toBe('');
    expect(serializeListState(dex, state(dex, { q: 'fire' }))).toBe('');
    expect(applyListState(dex, ROWS, state(dex, { q: 'fire' })).total).toBe(ROWS.length);
  });

  it('trims the query it reads and writes', () => {
    expect(parseListState(search, '?q=%20fire%20').q).toBe('fire');
    expect(serializeListState(search, state(search, { q: '  fire ' }))).toBe('q=fire');
  });
});

describe('U6: the view comes from the URL, then the saved view, then the default', () => {
  it('takes the view of the URL over the saved one', () => {
    expect(parseListState(dex, '?view=list', 'slots').view).toBe('list');
  });

  it('takes the saved view when the URL has none, or an invalid one', () => {
    expect(parseListState(dex, '', 'slots').view).toBe('slots');
    expect(parseListState(dex, '?view=grid', 'list').view).toBe('list');
  });

  it('ignores a saved value that is not a view', () => {
    expect(parseListState(dex, '', 'Lista').view).toBe('cards');
    expect(parseListState(dex, '', null).view).toBe('cards');
    expect(parseListState(familia, '', 'mosaic').view).toBe('list');
  });

  it('keys the saved view by the id of the list', () => {
    expect(VIEW_STORAGE_PREFIX + dex.id).toBe('ac:vista:pokedex');
  });
});

describe('applyListState: the page a view draws', () => {
  it('filters, sorts, counts and cuts the page', () => {
    const shown = applyListState(dex, ROWS, parseListState(dex, '?variante=shiny'));
    expect(shown.total).toBe(15);
    expect(shown.pageCount).toBe(2);
    expect(shown.items).toHaveLength(12);
    expect(shown.items.every((row) => row.shiny)).toBe(true);
    expect(pageCountOf(12, 0)).toBe(1);
  });

  it('combines the filters', () => {
    const shown = applyListState(dex, ROWS, parseListState(dex, '?gen=1&variante=normal'));
    expect(shown.items.every((row) => row.gen === 1 && !row.shiny)).toBe(true);
    expect(shown.total).toBe(5);
  });

  it('sorts without changing the rows it was given', () => {
    const before = ROWS.map((row) => row.id);
    const shown = applyListState(search, ROWS, defaultListState(search));
    expect(shown.items[0]?.numero).toBe(30);
    expect(ROWS.map((row) => row.id)).toEqual(before);
  });

  it('keeps the order of equal rows (a stable sort)', () => {
    const shown = applyListState(familia, ROWS, defaultListState(familia));
    expect(shown.items.map((row) => row.id)).toEqual(ROWS.map((row) => row.id));
  });

  it('groups the page after cutting it, in the fixed order (V5, 8.0.6)', () => {
    const second = applyListState(dex, ROWS, parseListState(dex, '?page=3'));
    expect(second.items.map((row) => row.numero)).toEqual([25, 26, 27, 28, 29, 30]);
    expect(second.groups.map((group) => group.key)).toEqual(['1', '2', '3', '—']);
    // Inside every group the rows keep the order of the list, as in the other views.
    for (const group of second.groups) {
      const order = group.items.map((row) => second.items.indexOf(row));
      expect(order).toEqual([...order].sort((a, b) => a - b));
    }
    expect(second.groups.flatMap((group) => group.items)).toHaveLength(second.items.length);
  });

  it('leaves out a group with no row on the page', () => {
    const shown = applyListState(dex, ROWS, parseListState(dex, '?gen=2'));
    expect(shown.groups.map((group) => group.key)).toEqual(['2']);
    expect(applyListState(search, ROWS, defaultListState(search)).groups).toEqual([]);
  });

  it('gives an empty page when nothing matches (V7)', () => {
    const shown = applyListState(dex, ROWS, parseListState(dex, '?gen=9'));
    expect(shown).toMatchObject({ total: 0, pageCount: 1, items: [], groups: [] });
    expect(shown.state.page).toBe(1);
  });

  it('has a single page without a page size (8.0.6, drops)', () => {
    const shown = applyListState(drops, ROWS, parseListState(drops, '?drops.page=4'));
    expect(shown.pageCount).toBe(1);
    expect(shown.state.page).toBe(1);
    expect(shown.items).toHaveLength(ROWS.length);
  });

  it('draws the first page of the props with the total of the whole list (PR5)', () => {
    const first = ROWS.slice(0, 12);
    const shown = firstListPage(dex, first, 910, state(dex, { view: 'slots' }));
    expect(shown.total).toBe(910);
    expect(shown.pageCount).toBe(76);
    expect(shown.state).toEqual(state(dex, { view: 'slots' }));
    expect(shown.items).toEqual(first);
  });

  it('tells a view change from a change of the rows', () => {
    const base = defaultListState(dex);
    expect(sameResultSet(base, { ...base, view: 'list' })).toBe(true);
    expect(sameListState(base, { ...base, view: 'list' })).toBe(false);
    expect(sameResultSet(base, { ...base, filters: { gen: '1' } })).toBe(false);
    expect(sameResultSet(base, { ...base, page: 2 })).toBe(false);
  });
});

// --- PR4

type Sandbox = {
  pending: boolean;
  timers: (() => void)[];
};

/**
 * Runs the inline script the way the browser does, as a classic script inside the hidden
 * `span` that is the first child of the root, with the page's search and storage.
 */
function runPending(
  script: string,
  searchText: string,
  saved: Record<string, string> | 'blocked' = {},
): Sandbox {
  const sandbox: Sandbox = { pending: false, timers: [] };
  const root = {
    setAttribute(name: string) {
      if (name === PENDING_ATTRIBUTE) sandbox.pending = true;
    },
    removeAttribute(name: string) {
      if (name === PENDING_ATTRIBUTE) sandbox.pending = false;
    },
  };
  const documentStub = { currentScript: { parentNode: { parentNode: root } } };
  const storage = {
    getItem(key: string) {
      if (saved === 'blocked') throw new Error('SecurityError');
      return saved[key] ?? null;
    },
  };
  const setTimeoutStub = (callback: () => void) => {
    sandbox.timers.push(callback);
    return sandbox.timers.length;
  };
  const run = new Function('document', 'location', 'localStorage', 'setTimeout', script) as (
    document: unknown,
    location: unknown,
    localStorage: unknown,
    setTimeout: unknown,
  ) => void;
  run(documentStub, { search: searchText }, storage, setTimeoutStub);
  return sandbox;
}

describe('PR4: the inline script of the first render', () => {
  const DEX_PAGES = pageCountOf(dex.pageSize, 910);
  const dexScript = pendingScript(dex, DEX_PAGES);

  it('stays under 1 KB for the Pokédex list', () => {
    expect(new TextEncoder().encode(dexScript).byteLength).toBeLessThan(1024);
  });

  it('hides nothing with the default state', () => {
    expect(runPending(dexScript, '').pending).toBe(false);
    expect(runPending(dexScript, '?view=cards&page=1').pending).toBe(false);
    expect(runPending(dexScript, '?view=grid&elemento=Fuego&page=0').pending).toBe(false);
  });

  it('marks the root when the URL or the saved view differ', () => {
    expect(runPending(dexScript, '?view=list&page=2').pending).toBe(true);
    expect(runPending(dexScript, '?elemento=fire&variante=shiny').pending).toBe(true);
    expect(runPending(dexScript, '?gen=3').pending).toBe(true);
    expect(runPending(dexScript, '', { 'ac:vista:pokedex': 'slots' }).pending).toBe(true);
  });

  it('lets the URL view win over the saved one', () => {
    expect(runPending(dexScript, '?view=cards', { 'ac:vista:pokedex': 'slots' }).pending).toBe(
      false,
    );
    expect(runPending(dexScript, '', { 'ac:vista:drops': 'slots' }).pending).toBe(false);
  });

  it('survives a storage that throws', () => {
    expect(runPending(dexScript, '', 'blocked').pending).toBe(false);
    expect(runPending(dexScript, '?page=2', 'blocked').pending).toBe(true);
  });

  it('takes the attribute off by itself after 5 s', () => {
    const run = runPending(dexScript, '?page=2');
    expect(run.pending).toBe(true);
    expect(run.timers).toHaveLength(1);
    run.timers[0]?.();
    expect(run.pending).toBe(false);
  });

  it('never marks a list of one page because of `page`', () => {
    const one = pendingScript(dex, 1);
    expect(runPending(one, '?page=5').pending).toBe(false);
    expect(runPending(pendingScript(drops, 1), '?drops.page=3').pending).toBe(false);
  });

  it('reads the prefix, the search and the orders of its list', () => {
    const own = pendingScript(drops, 1);
    expect(runPending(own, '?drops.view=list').pending).toBe(true);
    expect(runPending(own, '?view=list').pending).toBe(false);

    const shop = pendingScript(search, 3);
    expect(runPending(shop, '?q=%20').pending).toBe(false);
    expect(runPending(shop, '?q=fire').pending).toBe(true);
    expect(runPending(shop, '?sort=recientes').pending).toBe(false);
    expect(runPending(shop, '?sort=nombre').pending).toBe(true);
    expect(runPending(shop, '?mundo=Sun').pending).toBe(true);
    expect(runPending(shop, '?min=x').pending).toBe(false);
  });

  it('agrees with parseListState on every URL', () => {
    const urls = [
      '',
      '?view=cards',
      '?view=slots',
      '?view=list&page=2',
      '?page=76',
      '?page=77',
      '?page=0',
      '?gen=2',
      '?gen=x',
      '?tier=legendary',
      '?tier=Legendary',
      '?elemento=steel',
      '?variante=normal',
      '?q=fire',
      '?sort=numero',
    ];
    const savedViews: (string | null)[] = [null, 'cards', 'slots', 'list', 'Lista'];
    const defaults = defaultListState(dex);
    for (const url of urls) {
      for (const saved of savedViews) {
        const read = parseListState(dex, url, saved);
        read.page = Math.min(read.page, DEX_PAGES);
        const storage = saved === null ? {} : { [VIEW_STORAGE_PREFIX + dex.id]: saved };
        expect(runPending(dexScript, url, storage).pending, `${url} · ${saved}`).toBe(
          !sameListState(read, defaults),
        );
      }
    }
  });

  it('cannot be closed by a value of the configuration', () => {
    const hostile: ListConfig<Row> = {
      ...dex,
      id: '</script><script>alert(1)</script>',
      filters: [{ key: 'x', values: ['</script>'], test: () => true }],
    };
    const script = pendingScript(hostile, 2);
    expect(script.toLowerCase()).not.toContain('</script');
    expect(runPending(script, '?x=%3C%2Fscript%3E').pending).toBe(true);
  });
});

// --- The prerendered list (PR1, PR4, H6, V1, V8) and its Slots and Lista pieces (V3, V4)

const tip = (row: Row): TipData => ({
  key: `item:${row.id}`,
  title: row.name,
  width: 282,
  head: { type: 'sprite', sprite: null },
  rows: [{ label: 'Número', value: String(row.numero) }],
});

const HINT = es.ui.pinHint;

/** A Pokédex-like island root: the first page of 910 in the props, the rest in `dataUrl`. */
function PrerenderedList(): ReactElement {
  const config = { ...dex, dataUrl: '/es/pokedex/datos.json' };
  const controller = useListState(config, {
    items: ROWS.slice(0, 12),
    total: 910,
    decode: () => ROWS,
    path: '/es/pokedex/',
  });
  const props: EntityListProps<Row> = {
    controller,
    labels: { ...es.ui, dataError: 'No se pudieron cargar los datos.' },
    count: (total) => `${total} variantes`,
    empty: () => 'Sin resultados.',
    paginationAlign: 'center',
    views: {
      cards: (page) =>
        page.items.map((row) =>
          createElement('article', { key: row.id, id: `item-${row.id}` }, row.name),
        ),
      slots: () => null,
      list: () => null,
    },
  };
  return createElement(EntityList<Row>, props);
}

describe('the prerendered list', () => {
  const html = renderToStaticMarkup(createElement(PrerenderedList));

  it('paints the default state and is never pending in the HTML (PR1)', () => {
    expect(html).toContain('910 variantes');
    expect(html).not.toContain(`${PENDING_ATTRIBUTE}=`);
    expect(html.match(/<article/g)).toHaveLength(12);
  });

  it('prints the PR4 script as the first thing inside the root', () => {
    const script = pendingScript({ ...dex, dataUrl: '/es/pokedex/datos.json' }, 76);
    expect(html.startsWith(`<div class="ac-entity-list" data-ac-list="pokedex">`)).toBe(true);
    expect(html).toContain(
      `<div class="ac-entity-list" data-ac-list="pokedex"><span hidden=""><script>${script}</script></span>`,
    );
  });

  it('mounts only the active view, in its container (V1, V8)', () => {
    expect(html).toContain('<div data-card-grid="">');
    expect(html).not.toContain('data-slots');
    expect(html).not.toContain('data-list');
    expect(html).toContain('class="ac-entity-list__results" tabindex="-1"');
  });

  it('links every page with its canonical URL (H6, P-28)', () => {
    const hrefs = [...html.matchAll(/href="([^"]*)"/g)].map((match) => match[1]);
    expect(hrefs).toEqual([
      '/es/pokedex/',
      '/es/pokedex/?page=2',
      '/es/pokedex/?page=3',
      '/es/pokedex/?page=76',
      '/es/pokedex/?page=2',
    ]);
    expect(html).toContain('aria-current="page"');
  });
});

describe('ListRow (V4)', () => {
  const row = ROWS[0] as Row;
  const render = (element: ReactElement) =>
    renderToStaticMarkup(createElement('table', null, createElement('tbody', null, element)));

  it('opens the tooltip from its name, and the row only hands the hover over (TT10)', () => {
    const html = render(
      createElement(ListRow, {
        id: 'item-row-1',
        name: row.name,
        href: '/es/pokedex/row-1/',
        tip: tip(row),
        hint: HINT,
        locale: 'es',
        cells: [null, 'uno'],
      }),
    );
    expect(html).toMatch(
      /^<table><tbody><tr id="item-row-1" class="ac-list-row ac-list-row--drops" data-ac-tt-row="">/,
    );
    // One trigger, the name, with the `row` placement; the row itself describes nothing.
    expect(html.match(/aria-describedby=/g)).toHaveLength(1);
    expect(html).toMatch(
      /<td class="ac-list-row__cell ac-list-row__name"><div class="ac-list-row__name-in"><span class="ac-nested-entity" data-ac-tt="" data-ac-tt-placement="row"/,
    );
    expect(html).toContain(
      '<td class="ac-list-row__cell">—</td><td class="ac-list-row__cell">uno</td>',
    );
  });

  it('is a plain link without a tooltip, and text without a page (R2, WG5)', () => {
    const link = render(createElement(ListRow, { name: 'A', href: '/es/a/', locale: 'es' }));
    expect(link).toContain('<a href="/es/a/" class="ac-list-row__link">A</a>');
    expect(link).not.toContain('data-ac-tt');
    const text = render(createElement(ListRow, { name: 'B', locale: 'es' }));
    expect(text).not.toContain('<a');
    expect(text).not.toContain('href');
  });

  it('draws the 48 box of a listing with its stack count', () => {
    const html = render(
      createElement(ListRow, {
        name: 'C',
        href: '/es/c/',
        frame: 'framed',
        qty: 1500,
        variant: 'listing',
        locale: 'es',
      }),
    );
    expect(html).toContain(
      '<span class="ac-list-row__frame" aria-hidden="true"><span class="ac-list-row__qty">1.500</span></span>',
    );
    expect(html).toContain('class="ac-list-row ac-list-row--listing"');
  });
});

describe('SlotsPanel (V3)', () => {
  it('wraps each slot in an li and keeps the anchor of an item (H7)', () => {
    const html = renderToStaticMarkup(
      createElement(
        SlotsPanel,
        { label: 'Drops' },
        createElement('a', { key: 'a', href: '/a' }, 'a'),
        createElement(SlotsPanelItem, {
          key: 'b',
          id: 'item-b',
          children: createElement('a', { href: '/b' }, 'b'),
        }),
      ),
    );
    expect(html).toBe(
      '<ul aria-label="Drops" class="ac-slots-panel ac-slots-panel__list">' +
        '<li class="ac-slots-panel__li"><a href="/a">a</a></li>' +
        '<li id="item-b" class="ac-slots-panel__li"><a href="/b">b</a></li></ul>',
    );
  });

  it('names each group list by its label', () => {
    const html = renderToStaticMarkup(
      createElement(SlotsPanel, {
        label: 'Pokédex',
        layout: 'stacked',
        groups: [
          {
            key: '1',
            label: 'Generación 1',
            children: [createElement('a', { key: 'x', href: '/x' }, 'x')],
          },
        ],
      }),
    );
    expect(html).toMatch(
      /^<div role="group" aria-label="Pokédex" class="ac-slots-panel ac-slots-panel--stacked"><div class="ac-slots-panel__group"><p id="([^"]+)" class="ac-slots-panel__label">Generación 1<\/p><ul aria-labelledby="\1" class="ac-slots-panel__slots"><li class="ac-slots-panel__li">/,
    );
  });
});
