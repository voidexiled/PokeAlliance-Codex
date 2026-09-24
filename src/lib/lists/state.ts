import { normalize } from '@/lib/search/normalize';

// The pure half of the list controller of spec 7.7 (7.7.1): what a list root declares
// (`ListConfig`), the state that lives in the URL (`ListState`, 7.7.2), the two functions
// that go between them, and `applyListState`, which turns the rows of a list into the page
// a view draws. No DOM and no React here, so the same code runs in the build, in an island
// and in the unit tests of tests/lists/state.test.ts; `useListState` joins it to the URL.
//
// URL contract (7.7.2):
//   U1. The parameters are `q`, the filter keys in the order of `config.filters`, `sort`,
//       `view` and `page`, serialised in that order. With `prefix` each one is
//       `<prefix>.<key>`, so two lists on one page never share a parameter.
//   U2. A value equal to its default is not written; a URL without parameters is the
//       default state: the list's default view, the first sort, page 1, no filters.
//   U3. Values are registry ids (`slug`, a number, `cards`), never translated labels, so a
//       URL works in both locales.
//   U4. An invalid value falls back to its default. A page over the last one becomes the
//       last one and a page under 1 becomes 1; the upper bound needs the rows, so
//       `applyListState` applies it and returns the canonical state.
//   U6. The view is the URL's; without one, the saved view; without that, `defaultView`.
//   U7. `porPagina` (after `view`, before `page`) is the rows per page of the view, one of
//       the options `config.perPage` gives that view; absent or invalid, the view's default.
//       A list without `perPage` does not own the parameter.
//
// PR4 is here as well: `pendingScript` writes, from the same configuration, the inline
// classic script that hides a list whose URL state differs from the prerendered one
// before the first paint.

/** The three views of a list of entities (7.7.1). */
export type EntityView = 'cards' | 'slots' | 'list';

/** Every view, in the order of `ViewToggle`. */
const VIEWS: readonly EntityView[] = ['cards', 'slots', 'list'];

/** Key of the saved view of a list: `localStorage['ac:vista:<id>']` (U6). */
export const VIEW_STORAGE_PREFIX = 'ac:vista:';

/** The attribute PR4 puts on the root of a list while its URL state is not applied. */
export const PENDING_ATTRIBUTE = 'data-ac-pending';

/** An order of the list. `sorts[0]` of a configuration is its default order. */
export interface ListSort<T> {
  /** Written as `sort` in the URL (U3). */
  id: string;
  /** Option text of `SortSelect`, from the dictionary of the page (DP1). */
  label: string;
  compare: (a: T, b: T) => number;
}

/**
 * What a filter accepts from the URL: one of a list of ids, any text, or a non-negative
 * integer of at most 15 digits (a generation, an amount in whole units).
 */
export type ListFilterValues = readonly string[] | 'text' | 'int';

/** A filter of the list; `test` receives the value already validated. */
export interface ListFilter<T> {
  key: string;
  values: ListFilterValues;
  test: (item: T, value: string) => boolean;
  /**
   * §16.4.1: the URL carries the values comma-separated (`?tipo=fire,water`); an item
   * matches when it matches any one of them (OR within the filter). Filters stay AND
   * across each other, as before. Only meaningful with a list of ids (`values` an array).
   */
  multi?: boolean;
  /**
   * §16.4.2: older parameter names still read into this filter when the current one is
   * absent from the URL (`?elemento=` still read as `?tipo=`). Never written back.
   */
  aliasKeys?: readonly string[];
  /**
   * How the values of a `multi` filter combine: `any` (the default) keeps a row that matches
   * one of them (OR), `all` a row that matches every one (AND: «Tipo», a Pokémon with both
   * chosen types).
   */
  match?: 'any' | 'all';
  /** Most values a `multi` filter keeps; the first ones of the URL win (Tipo: 2). */
  max?: number;
}

/** The rows-per-page choice of one view (U7): its options, ascending, and its default. */
export interface PerPageSpec {
  options: readonly number[];
  default: number;
}

/** The URL key of the rows per page (U7). */
export const PER_PAGE_KEY = 'porPagina';

/**
 * The configuration of one list (7.7.1). The root of the island declares it in its module,
 * with functions, and memoises it: the list controller keys its effects on it.
 */
export interface ListConfig<T> {
  /** 'pokedex', 'comercio', 'drops'…; the key of the saved view (U6). */
  id: string;
  /** Prefix of the parameters when the page carries another list (U1). */
  prefix?: string;
  /**
   * Rows per page, fixed by the section of the list; `Infinity` for a list with no pages. A
   * view with a `perPage` entry takes its rows from there instead (U7).
   */
  pageSize: number;
  /** The rows-per-page choices by view (U7); a view without an entry keeps `pageSize`. */
  perPage?: Partial<Record<EntityView, PerPageSpec>>;
  /** The orders; `[0]` is the default one. */
  sorts: readonly ListSort<T>[];
  filters: readonly ListFilter<T>[];
  /** The text `q` searches. A list without it has no `q` (the Pokédex, E3). */
  text?: (item: T) => string;
  /** Group of an item: Comercio «Todos» and the Slots of the Pokédex. */
  groupBy?: (item: T) => string;
  /** Order of the groups; a group missing from it comes after, in order of appearance. */
  groupOrder?: readonly string[];
  /** `cards` when absent; `list` in the Tier list of the Pokémon page (E15). */
  defaultView?: EntityView;
  /** The views `ViewToggle` offers, in its order; every one when absent (§16.4.1). */
  views?: readonly EntityView[];
  /** Views that draw every row with no pages, such as the tier rows of the Tier list (§16.4.3). */
  unpagedViews?: readonly EntityView[];
  /** Id of the element of an item in the active view, such as `item-${id}` (H7). */
  anchorId?: (item: T) => string;
  /** Prerendered JSON with every row of the list (PR5); without it the props carry them. */
  dataUrl?: string;
}

/** The state of a list (7.7.1): what the URL, the saved view and the controls describe. */
export interface ListState {
  view: EntityView;
  q: string;
  sort: string;
  page: number;
  /** Validated filter values by key; a filter without a value is absent. */
  filters: Record<string, string>;
  /** Rows per page chosen for `view` (U7); absent means the view's default. */
  perPage?: number;
}

/** A group of the page, in the order of `groupOrder` (V2, V3). */
export interface ListGroup<T> {
  key: string;
  items: T[];
}

/** The page a view draws (V1 to V5). */
export interface ListPage<T> {
  /** The state shown, with its page brought inside 1…`pageCount` (U4). */
  state: ListState;
  /** The rows of the page, in the order of the list. */
  items: T[];
  /**
   * The same rows split by `groupBy`, in the order of `groupOrder`, keeping the order of
   * the list inside each group (V5); empty without `groupBy`. The page is cut first and
   * grouped after (8.0.6, CGS 2.1), so a group missing from the page is not there.
   */
  groups: ListGroup<T>[];
  /** Rows after the search and the filters, across every page: what `Count` says (H5). */
  total: number;
  /** At least 1. */
  pageCount: number;
}

/** The name of a parameter of the list in the URL (U1). */
export function paramName<T>(config: ListConfig<T>, key: string): string {
  return config.prefix ? `${config.prefix}.${key}` : key;
}

/** Every parameter the list owns, in the order of U1. */
export function ownParams<T>(config: ListConfig<T>): string[] {
  const perPage = config.perPage ? [PER_PAGE_KEY] : [];
  return [
    'q',
    ...config.filters.map((filter) => filter.key),
    'sort',
    'view',
    ...perPage,
    'page',
  ].map((key) => paramName(config, key));
}

/** The rows-per-page spec of a view (U7), or `undefined` when the view has a fixed size. */
export function perPageSpec<T>(config: ListConfig<T>, view: EntityView): PerPageSpec | undefined {
  if (config.unpagedViews?.includes(view)) return undefined;
  return config.perPage?.[view];
}

/** `value` when it is one of the options of `view` and not its default (U7), else `undefined`. */
export function perPageValue<T>(
  config: ListConfig<T>,
  view: EntityView,
  value: unknown,
): number | undefined {
  const spec = perPageSpec(config, view);
  const size = typeof value === 'string' && /^\d{1,4}$/.test(value) ? Number(value) : value;
  if (spec === undefined || typeof size !== 'number') return undefined;
  return spec.options.includes(size) && size !== spec.default ? size : undefined;
}

/** The rows a page of `state` shows: `Infinity` in an unpaged view (U7, §16.4.3). */
export function pageSizeOf<T>(config: ListConfig<T>, state: Pick<ListState, 'view' | 'perPage'>) {
  if (config.unpagedViews?.includes(state.view)) return Infinity;
  const spec = config.perPage?.[state.view];
  if (spec === undefined) return config.pageSize;
  return perPageValue(config, state.view, state.perPage) ?? spec.default;
}

/** Whether a value read from the URL or from storage is one of the three views (U3, U6). */
export function isView(value: unknown): value is EntityView {
  return typeof value === 'string' && (VIEWS as readonly string[]).includes(value);
}

/** The value of a filter in its canonical form, or `undefined` when it is not valid (U4). */
export function filterValue(values: ListFilterValues, raw: string): string | undefined {
  if (values === 'int') return /^\d{1,15}$/.test(raw) ? String(Number(raw)) : undefined;
  if (values === 'text') {
    const text = raw.trim();
    return text === '' ? undefined : text;
  }
  return values.includes(raw) ? raw : undefined;
}

/**
 * The canonical value of a filter that may carry several ids (`multi`, §16.4.1): `raw` is
 * split on `,`, each id validated against `values` and duplicates dropped, keeping the
 * first order seen; joined back with `,`. `undefined` when nothing valid is left. A
 * non-multi filter, or one whose `values` is not a list of ids, falls back to
 * `filterValue`.
 */
export function filterValues<T>(filter: ListFilter<T>, raw: string): string | undefined {
  if (!filter.multi || filter.values === 'int' || filter.values === 'text') {
    return filterValue(filter.values, raw);
  }
  const seen = new Set<string>();
  const max = filter.max ?? Infinity;
  for (const part of raw.split(',')) {
    const value = filterValue(filter.values, part);
    if (value !== undefined && seen.size < max) seen.add(value);
  }
  return seen.size === 0 ? undefined : [...seen].join(',');
}

/** The state of a URL without parameters (U2). */
export function defaultListState<T>(config: ListConfig<T>): ListState {
  return {
    view: config.defaultView ?? 'cards',
    q: '',
    sort: config.sorts[0]?.id ?? '',
    page: 1,
    filters: {},
  };
}

/**
 * The state a URL describes (U1 to U4, U6). `savedView` is the value read from
 * `localStorage['ac:vista:<id>']`; it only counts when the URL carries no valid view and it
 * is a view itself. The page is not bounded above here: that needs the rows
 * (`applyListState`).
 */
export function parseListState<T>(
  config: ListConfig<T>,
  search: string | URLSearchParams,
  savedView?: string | null,
): ListState {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;
  const read = (key: string) => params.get(paramName(config, key));
  const state = defaultListState(config);

  const q = read('q');
  if (config.text && q !== null) state.q = q.trim();

  for (const filter of config.filters) {
    let raw = read(filter.key);
    if (raw === null) {
      for (const alias of filter.aliasKeys ?? []) {
        raw = params.get(paramName(config, alias));
        if (raw !== null) break;
      }
    }
    const value = raw === null ? undefined : filterValues(filter, raw);
    if (value !== undefined) state.filters[filter.key] = value;
  }

  const sort = read('sort');
  if (sort !== null && config.sorts.some((option) => option.id === sort)) state.sort = sort;

  const allowed = (value: unknown): value is EntityView =>
    isView(value) && (config.views === undefined || config.views.includes(value));
  const view = read('view');
  if (allowed(view)) state.view = view;
  else if (allowed(savedView)) state.view = savedView;

  if (config.perPage) {
    const perPage = perPageValue(config, state.view, read(PER_PAGE_KEY));
    if (perPage !== undefined) state.perPage = perPage;
  }

  const page = read('page');
  if (page !== null && /^\d{1,9}$/.test(page)) state.page = Math.max(1, Number(page));

  return state;
}

/**
 * The query of a state, without `?`: only the parameters that differ from the default, in
 * the order of U1 (U2). The default state gives the empty string.
 */
export function serializeListState<T>(config: ListConfig<T>, state: ListState): string {
  const params = new URLSearchParams();
  const write = (key: string, value: string) => params.set(paramName(config, key), value);
  const defaults = defaultListState(config);

  const q = state.q.trim();
  if (config.text && q !== '') write('q', q);

  for (const filter of config.filters) {
    const raw = state.filters[filter.key];
    const value = raw === undefined ? undefined : filterValues(filter, raw);
    if (value !== undefined) write(filter.key, value);
  }

  if (state.sort !== defaults.sort && config.sorts.some((option) => option.id === state.sort)) {
    write('sort', state.sort);
  }
  if (state.view !== defaults.view && isView(state.view)) write('view', state.view);
  const perPage = perPageValue(config, state.view, state.perPage);
  if (perPage !== undefined) write(PER_PAGE_KEY, String(perPage));

  const page = Math.floor(state.page);
  if (page > 1) write('page', String(page));

  return params.toString();
}

/**
 * The search part of a URL that shows `state`: the parameters this list does not own keep
 * their order, and the list's own follow in the order of U1. `''` when nothing is left.
 */
export function listSearch<T>(config: ListConfig<T>, current: string, state: ListState): string {
  const own = new Set(ownParams(config));
  const merged = new URLSearchParams();
  for (const [key, value] of new URLSearchParams(current)) {
    if (!own.has(key)) merged.append(key, value);
  }
  for (const [key, value] of new URLSearchParams(serializeListState(config, state))) {
    merged.append(key, value);
  }
  const text = merged.toString();
  return text === '' ? '' : `?${text}`;
}

function sameFilters(a: Record<string, string>, b: Record<string, string>): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
}

/** Whether two states select the same rows on the same page, whatever their view. */
export function sameResultSet(a: ListState, b: ListState): boolean {
  return (
    a.q === b.q &&
    a.sort === b.sort &&
    a.page === b.page &&
    a.perPage === b.perPage &&
    sameFilters(a.filters, b.filters)
  );
}

/** Whether two states are the same, view included. */
export function sameListState(a: ListState, b: ListState): boolean {
  return a.view === b.view && sameResultSet(a, b);
}

/** Pages for `total` rows: at least 1, and 1 for a list with no pages. */
export function pageCountOf(pageSize: number, total: number): number {
  if (!Number.isFinite(pageSize) || pageSize < 1) return 1;
  return Math.max(1, Math.ceil(total / Math.floor(pageSize)));
}

/** The fragments of a query: normalised and split on spaces and commas (9.5.2). */
export function queryFragments(q: string): string[] {
  return normalize(q)
    .split(/[\s,]+/)
    .filter((fragment) => fragment !== '');
}

function groupItems<T>(config: ListConfig<T>, items: T[]): ListGroup<T>[] {
  const groupBy = config.groupBy;
  if (!groupBy) return [];
  const buckets = new Map<string, T[]>();
  for (const item of items) {
    const key = groupBy(item);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(item);
    else buckets.set(key, [item]);
  }
  const order = config.groupOrder ?? [];
  const keys = [
    ...order.filter((key) => buckets.has(key)),
    ...[...buckets.keys()].filter((key) => !order.includes(key)),
  ];
  return keys.map((key) => ({ key, items: buckets.get(key) ?? [] }));
}

function cut<T>(config: ListConfig<T>, ordered: readonly T[], total: number, state: ListState) {
  const pageSize = pageSizeOf(config, state);
  const pageCount = pageCountOf(pageSize, total);
  const page = Math.min(Math.max(1, Math.floor(state.page) || 1), pageCount);
  const size = Math.floor(pageSize);
  const items =
    Number.isFinite(pageSize) && size >= 1
      ? ordered.slice((page - 1) * size, page * size)
      : ordered.slice();
  const shown: ListPage<T> = {
    state: { ...state, page },
    items,
    groups: groupItems(config, items),
    total,
    pageCount,
  };
  return shown;
}

/**
 * The page of `state` over every row of the list: `q` (each fragment is a substring of the
 * normalised `text`, 9.5.2), the filters, the order (stable), the page brought inside its
 * bounds (U4) and the groups of the page. The rows are not mutated.
 */
export function applyListState<T>(
  config: ListConfig<T>,
  rows: readonly T[],
  state: ListState,
): ListPage<T> {
  let result: T[] = rows.slice();

  const fragments = config.text ? queryFragments(state.q) : [];
  const text = config.text;
  if (text && fragments.length > 0) {
    result = result.filter((item) => {
      const haystack = normalize(text(item));
      return fragments.every((fragment) => haystack.includes(fragment));
    });
  }

  for (const filter of config.filters) {
    const raw = state.filters[filter.key];
    const value = raw === undefined ? undefined : filterValues(filter, raw);
    if (value !== undefined) {
      const wanted = filter.multi ? value.split(',') : [value];
      result =
        filter.match === 'all'
          ? result.filter((item) => wanted.every((one) => filter.test(item, one)))
          : result.filter((item) => wanted.some((one) => filter.test(item, one)));
    }
  }

  const sort = config.sorts.find((option) => option.id === state.sort) ?? config.sorts[0];
  if (sort) result.sort(sort.compare);

  return cut(config, result, result.length, state);
}

/**
 * The page of the default state when the island only has its rows (PR5): `rows` is the
 * first page as the build sorted it and `total` the size of the whole list, so nothing is
 * filtered or sorted again. `state` must select the default rows; its view is kept.
 */
export function firstListPage<T>(
  config: ListConfig<T>,
  rows: readonly T[],
  total: number,
  state: ListState,
): ListPage<T> {
  return cut(config, rows, Math.max(total, rows.length), { ...state, page: 1 });
}

/**
 * PR4: the inline classic script that runs, before the first paint, as the first thing
 * inside the root of the list (`EntityList` prints it in a hidden `span`, so the root
 * already exists and no list content has been parsed yet). It reads `location.search` and
 * `localStorage['ac:vista:<id>']` with the rules of `parseListState` and, when the result
 * differs from the prerendered default state (view, page, sort, `q` or a filter), puts
 * `data-ac-pending` on the root; after 5 s it takes it off by itself. It is generated from
 * the configuration, so it only carries the checks this list needs: under 1 KB for the
 * Pokédex, which is what tests/lists/state.test.ts measures.
 *
 * `pageCount` is the page count of the prerendered state: a `page` over it is clamped to
 * the last page, so a list of one page is never pending because of `page`.
 */
export function pendingScript<T>(config: ListConfig<T>, pageCount: number): string {
  // JSON inside a script: `<` is escaped so no value can close the element.
  const json = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');
  const checks: string[] = [];

  if (config.text) checks.push('x=g("q");if(x&&x.trim())d=1;');
  // The filters with a list of ids share one loop; the others are one check each.
  const lists: [string, readonly string[]][] = [];
  for (const filter of config.filters) {
    // An alias (§16.4.2) falls back the same way the parser does: `g` tries the current
    // key first, then each alias, in order.
    const keys = [filter.key, ...(filter.aliasKeys ?? [])].map(json);
    const read = `x=null;[${keys.join(',')}].some(function(k){x=g(k);return x!==null});`;
    if (filter.values === 'int') checks.push(`${read}if(/^\\d{1,15}$/.test(x))d=1;`);
    else if (filter.values === 'text' || filter.multi) checks.push(`${read}if(x&&x.trim())d=1;`);
    else lists.push([filter.key, filter.values]);
  }
  if (lists.length > 0) {
    checks.push(`${json(lists)}.forEach(function(f){if(f[1].indexOf(g(f[0]))>-1)d=1});`);
  }
  // Index 0 is the default order: only another valid order differs.
  if (config.sorts.length > 1) {
    checks.push(
      `x=g("sort");if(${json(config.sorts.map((option) => option.id))}.indexOf(x)>0)d=1;`,
    );
  }
  // U7: another valid size of the default view; any other view is pending by itself.
  const sizes = perPageSpec(config, config.defaultView ?? 'cards');
  const other = sizes?.options.filter((size) => size !== sizes.default) ?? [];
  if (other.length > 0) {
    checks.push(`if(${json(other.map(String))}.indexOf(g(${json(PER_PAGE_KEY)}))>-1)d=1;`);
  }
  checks.push(
    `x=g("view");if(!w.test(x))try{x=localStorage.getItem(${json(VIEW_STORAGE_PREFIX + config.id)})}catch(e){x=null}` +
      `if(w.test(x)&&x!==${json(config.defaultView ?? 'cards')})d=1;`,
  );
  const pages = Math.max(1, Math.floor(pageCount));
  if (pages > 1) checks.push(`x=g("page");if(/^\\d{1,9}$/.test(x)&&Math.min(+x,${pages})>1)d=1;`);

  const read = config.prefix ? `u.get(${json(`${config.prefix}.`)}+k)` : 'u.get(k)';
  const attribute = json(PENDING_ATTRIBUTE);
  return (
    '(function(){try{var r=document.currentScript.parentNode.parentNode,' +
    `u=new URLSearchParams(location.search),d=0,x,w=/^(?:${(config.views ?? VIEWS).join('|')})$/,` +
    `g=function(k){return ${read}};` +
    checks.join('') +
    `if(d){r.setAttribute(${attribute},"");` +
    `setTimeout(function(){r.removeAttribute(${attribute})},5e3)}}catch(e){}})()`
  );
}
