// The `buscar` list of spec 8.0.6 and 8.6 (M10): src/components/search/config.ts, what the
// island of `/{l}/buscar/` (SearchResultsRoot.tsx) and the build share.
//
//  - The order of 8.6 step 4 (`rankResults`): the scoring and the tie-breaks of 7.9.4, the ones
//    of the palette (tests/search/rank.test.ts), with no cap per kind, cut 24 a page and grouped
//    by kind after the cut (8.0.6, CGS 2.1).
//  - U4: the list controller bounds `page` with its own filter (`controllerText`), which must
//    never find fewer entries than the ranking, or the canonical URL would lower a page the
//    ranking has. Measured over the index the build writes, in both locales.
//  - The URL of 8.0.6 (U1, U2): `q`, `view` and `page`, no other filter.
//  - PR5 and 8.6 step 7: `decodeSearchIndex` reads the index the build writes and refuses a file
//    that is not one, so the island reports the search as not loaded instead of searching half.
//  - PR4: `searchPendingScript` hides the root before the first paint only when the URL carries
//    a query, and shows it again by itself after 5 s.
//  - 8.6 step 2: `capSearchQuery`, the 100 characters the field holds, for a `q` of the URL.
//
// The index expectations are properties of whatever the registries hold, never figures of a
// board (X4): an owner edit of `content/` changes the entries, not what this file expects.

import { describe, expect, it } from 'vitest';

import {
  LINK_KINDS,
  SEARCH_LIST_ID,
  SEARCH_MAX_QUERY,
  SEARCH_PAGE_SIZE,
  capSearchQuery,
  controllerText,
  decodeSearchIndex,
  kindOf,
  rankResults,
  searchConfig,
  searchIndexUrl,
  searchPendingScript,
} from '@/components/search/config';
import type { Locale } from '@/i18n/config';
import {
  PENDING_ATTRIBUTE,
  applyListState,
  defaultListState,
  listSearch,
  parseListState,
  serializeListState,
} from '@/lib/lists/state';
import { normalizeQuery } from '@/lib/search/normalize';
import { rankSearch, scoreEntry, searchKinds } from '@/lib/search/rank';
import type { SearchEntry, SearchKind } from '@/lib/search/rank';
import { buildSearchIndex } from '../../src/pages/[locale]/buscar/indice.json';

const LOCALES: Locale[] = ['es', 'en'];

/** The index of a locale as the island reads it: the JSON the build writes, decoded. */
function indexOf(locale: Locale): SearchEntry[] {
  return decodeSearchIndex(JSON.parse(JSON.stringify(buildSearchIndex(locale))));
}

const INDEX: Record<Locale, SearchEntry[]> = { es: indexOf('es'), en: indexOf('en') };

const config = searchConfig(searchIndexUrl('es'));

function entry(kind: SearchKind, id: string, name: string, extra: Partial<SearchEntry> = {}) {
  return { kind, id, name, href: `/es/${kind}/${id}/`, icon: null, ...extra } satisfies SearchEntry;
}

describe('rankResults: the order of 7.9.4 for the results page (8.6 step 4)', () => {
  it('orders by score across the kinds, then by the order of the kinds, then by name', () => {
    const exact = entry('pagina', 'tier', 'Tier'); // exact name: 0
    const token = entry('item', 'tier-token', 'Tier token'); // name prefix: 1
    const tierList = entry('pagina', 'tiers', 'Tier list'); // name prefix: 1
    const word = entry('sistema', 'gran-tier', 'Gran tier'); // prefix of a word: 2
    const inMeta = entry('pokemon', 'xatu', 'Xatu', { meta: 'Tier 3' }); // meta: 4
    const ranked = rankResults([inMeta, tierList, word, token, exact], 'tier', 'es');

    // «Tier token» (item) before «Tier list» (pagina): same score, the order of the kinds.
    expect(ranked.map((found) => found.name)).toEqual([
      'Tier',
      'Tier token',
      'Tier list',
      'Gran tier',
      'Xatu',
    ]);
  });

  it('breaks a tie of score and kind by name, with the numbers in order', () => {
    const names = ['Char 10', 'Char 2', 'Char 1'];
    const ranked = rankResults(
      names.map((name, index) => entry('pokemon', `c${index}`, name)),
      'char',
      'es',
    );
    expect(ranked.map((found) => found.name)).toEqual(['Char 1', 'Char 2', 'Char 10']);
  });

  it('keeps every match, with no cap per kind, and nothing for an empty or blank query', () => {
    const many = Array.from({ length: 30 }, (_, index) =>
      entry('pokemon', `char-${index}`, `Char ${index}`),
    );
    expect(rankResults(many, 'char', 'es')).toHaveLength(30);
    expect(rankResults(many, '', 'es')).toEqual([]);
    expect(rankResults(many, '   ', 'es')).toEqual([]);
    expect(rankResults(many, 'zzzz', 'es')).toEqual([]);
  });

  it.each(LOCALES)('%s: finds what the palette finds, with scores that never go down', (l) => {
    for (const query of ['char', 'fuego', 'fire', '006', 'nº 6', 'legendary', 'a', 'stone']) {
      const palette = rankSearch(INDEX[l], query, l, Number.POSITIVE_INFINITY).flatMap(
        (group) => group.entries,
      );
      const results = rankResults(INDEX[l], query, l);
      expect(new Set(results), `«${query}»`).toEqual(new Set(palette));
      const normalized = normalizeQuery(query);
      const scores = results.map((found) => scoreEntry(found, normalized));
      expect(
        scores.every((score) => score !== null),
        `«${query}»: only matches`,
      ).toBe(true);
      expect(scores, `«${query}»`).toEqual([...scores].sort((a, b) => (a ?? 0) - (b ?? 0)));
    }
  });
});

describe('U4: the controller never finds fewer entries than the ranking (controllerText)', () => {
  const queries = [
    'char',
    'fuego',
    'fire',
    '006',
    '6',
    '1',
    '01',
    '001',
    'nº 6',
    '#6',
    'legendary',
    't3',
    'shiny',
    'stone',
    'boost',
    'pokedex',
    'pokédex',
    'a',
    'e',
    'bulba',
    'nivel 1',
    'shiny char',
  ];
  const everything = { ...config, pageSize: Number.POSITIVE_INFINITY };

  for (const locale of LOCALES) {
    it.each(queries)(`${locale}: «%s»`, (query) => {
      const results = rankResults(INDEX[locale], query, locale);
      const state = { ...defaultListState(config), q: query };
      const found = new Set(applyListState(everything, INDEX[locale], state).items);
      const missed = results.filter((result) => !found.has(result));
      if (missed.length === 0) return;
      // A number written with its prefix («#6», «nº 6») finds one number, its variants and
      // their Shiny: one page, which no bound can cut.
      expect(results.length, `«${query}» misses ${missed.length}`).toBeLessThanOrEqual(
        SEARCH_PAGE_SIZE,
      );
    });
  }

  it('holds every field the scoring reads, and the number plain and on three digits', () => {
    const bulbasaur = entry('pokemon', 'bulbasaur', 'Bulbasaur', {
      meta: 'Nivel 5 · T1',
      dex: 1,
      terms: ['planta', 'grass'],
    });
    const text = controllerText(bulbasaur);
    for (const part of ['Bulbasaur', 'Nivel 5 · T1', 'bulbasaur', 'planta', 'grass', '1', '001'])
      expect(text).toContain(part);
    // Built once per entry: the index is read once per page (PR5).
    expect(controllerText(bulbasaur)).toBe(text);
  });
});

describe('the configuration of the `buscar` list (8.0.6)', () => {
  it('is 24 a page, one order, `q` and no other filter, grouped by kind', () => {
    expect(config).toMatchObject({
      id: SEARCH_LIST_ID,
      pageSize: SEARCH_PAGE_SIZE,
      filters: [],
      groupOrder: searchKinds,
      dataUrl: '/es/buscar/indice.json',
    });
    expect(SEARCH_PAGE_SIZE).toBe(24);
    expect(config.sorts).toHaveLength(1);
    expect(searchIndexUrl('en')).toBe('/en/buscar/indice.json');
  });

  it('reads `q`, `view` and `page` from the URL and writes them back in the order of U1', () => {
    const state = parseListState(config, '?page=2&view=list&q=bulba');
    expect(state).toMatchObject({ q: 'bulba', view: 'list', page: 2 });
    expect(serializeListState(config, state)).toBe('q=bulba&view=list&page=2');
    // U2: the default state is the empty query string.
    expect(serializeListState(config, defaultListState(config))).toBe('');
    // U1: a parameter of no list keeps its place.
    expect(listSearch(config, '?x=1', { ...state, page: 1 })).toBe('?x=1&q=bulba&view=list');
  });

  it('cuts the ranked results into pages of 24 and groups a page by kind after the cut', () => {
    const kinds: SearchKind[] = ['pagina', 'pokemon', 'item', 'sistema'];
    const entries = Array.from({ length: 60 }, (_, index) =>
      entry(kinds[index % kinds.length], `e${index}`, `Stone ${index}`),
    );
    const results = rankResults(entries, 'stone', 'es');
    expect(results).toHaveLength(60);

    const second = applyListState(config, results, { ...defaultListState(config), page: 2 });
    expect(second.items).toEqual(results.slice(SEARCH_PAGE_SIZE, SEARCH_PAGE_SIZE * 2));
    expect(second.total).toBe(60);
    expect(second.pageCount).toBe(3);
    // 8.6 step 4: a `CardGroup` per kind with results on this page, in the order of the table.
    const shown = second.groups.map(kindOf);
    expect(shown).toEqual(searchKinds.filter((kind) => shown.includes(kind)));
    for (const group of second.groups) {
      for (const result of group.items) expect(result.kind).toBe(kindOf(group));
    }
    expect(second.groups.flatMap((group) => group.items)).toHaveLength(SEARCH_PAGE_SIZE);

    // U4: a page past the last one is the last one.
    const past = applyListState(config, results, { ...defaultListState(config), page: 99 });
    expect(past.state.page).toBe(3);
    expect(past.items).toEqual(results.slice(SEARCH_PAGE_SIZE * 2));
  });

  it('names the kinds drawn as link lists in the three views (E5)', () => {
    expect([...LINK_KINDS].sort()).toEqual(['actividad', 'pagina', 'sistema']);
  });
});

describe('decodeSearchIndex (PR5, 8.6 step 7)', () => {
  it.each(LOCALES)('%s: reads the index the build writes, entry for entry', (l) => {
    expect(INDEX[l]).toEqual(buildSearchIndex(l));
    expect(INDEX[l].length).toBeGreaterThan(0);
  });

  it('gives both locales the same entries', () => {
    const ids = (l: Locale) => INDEX[l].map((found) => `${found.kind}:${found.id}`).sort();
    expect(ids('en')).toEqual(ids('es'));
  });

  it('refuses a file that is not an index', () => {
    const good = { kind: 'pokemon', id: 'a', name: 'A', href: '/es/pokedex/a/', icon: null };
    expect(decodeSearchIndex([])).toEqual([]);
    expect(decodeSearchIndex([good])).toEqual([good]);
    for (const bad of [
      {},
      'indice',
      [null],
      [{ ...good, kind: 'mapa' }],
      [{ ...good, id: '' }],
      [{ ...good, name: 7 }],
      [{ ...good, href: 'es/pokedex/a/' }],
      [{ ...good, icon: { src: '' } }],
      [{ ...good, meta: 3 }],
      [{ ...good, dex: 'x' }],
      [{ ...good, dex: 1.5 }],
      [{ ...good, terms: ['ok', ''] }],
    ]) {
      expect(() => decodeSearchIndex(bad), JSON.stringify(bad)).toThrow(/buscar\/indice\.json/);
    }
  });
});

describe('PR4: the inline script of the results page (searchPendingScript)', () => {
  interface Sandbox {
    pending: boolean;
    timers: (() => void)[];
  }

  function run(script: string, searchText: string): Sandbox {
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
    const setTimeoutStub = (callback: () => void) => {
      sandbox.timers.push(callback);
      return sandbox.timers.length;
    };
    const execute = new Function('document', 'location', 'setTimeout', script) as (
      document: unknown,
      location: unknown,
      setTimeout: unknown,
    ) => void;
    execute(documentStub, { search: searchText }, setTimeoutStub);
    return sandbox;
  }

  const script = searchPendingScript(config);

  it('hides the root only when the URL carries a query', () => {
    expect(run(script, '?q=bulba').pending).toBe(true);
    expect(run(script, '?view=list&q=char&page=2').pending).toBe(true);
    // The prerendered page is the state without `q`: the view and the page change nothing it
    // shows, so they never hide it.
    expect(run(script, '').pending).toBe(false);
    expect(run(script, '?q=%20%20').pending).toBe(false);
    expect(run(script, '?view=list&page=3').pending).toBe(false);
  });

  it('shows the root again by itself after 5 s', () => {
    const sandbox = run(script, '?q=char');
    expect(sandbox.timers).toHaveLength(1);
    sandbox.timers[0]?.();
    expect(sandbox.pending).toBe(false);
  });

  it('reads the prefix of its list, stays under 1 KB and cannot close its element', () => {
    const prefixed = searchPendingScript({ ...config, prefix: 'buscar' });
    expect(run(prefixed, '?buscar.q=char').pending).toBe(true);
    expect(run(prefixed, '?q=char').pending).toBe(false);
    expect(new TextEncoder().encode(script).byteLength).toBeLessThan(1024);
    expect(script).not.toContain('<');
  });
});

describe('capSearchQuery: the 100 characters of the field (8.6 step 2)', () => {
  it('keeps a query the field can hold', () => {
    const full = 'x'.repeat(SEARCH_MAX_QUERY);
    expect(SEARCH_MAX_QUERY).toBe(100);
    expect(capSearchQuery('')).toBe('');
    expect(capSearchQuery('charizard')).toBe('charizard');
    expect(capSearchQuery(full)).toBe(full);
  });

  it('cuts a longer one to its first 100 characters', () => {
    expect(capSearchQuery('x'.repeat(150))).toBe('x'.repeat(100));
    expect(capSearchQuery(`${'ab'.repeat(50)}zzz`)).toBe('ab'.repeat(50));
  });

  it('never keeps half of a surrogate pair nor the spaces the cut leaves', () => {
    const emoji = '\u{1F525}'; // two UTF-16 units
    const cut = capSearchQuery(`${'x'.repeat(99)}${emoji}y`);
    expect(cut).toBe('x'.repeat(99));
    expect(capSearchQuery(`${'x'.repeat(98)}${emoji}y`)).toBe(`${'x'.repeat(98)}${emoji}`);
    expect(capSearchQuery(`${'x'.repeat(97)}   ${'y'.repeat(10)}`)).toBe('x'.repeat(97));
  });
});
