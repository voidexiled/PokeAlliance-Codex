import {
  useCallback,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import {
  VIEW_STORAGE_PREFIX,
  applyListState,
  defaultListState,
  filterValue,
  firstListPage,
  isView,
  listSearch,
  pageCountOf,
  paramName,
  parseListState,
  sameResultSet,
} from '@/lib/lists/state';
import type { EntityView, ListConfig, ListPage, ListState } from '@/lib/lists/state';

// useListState (spec 7.7.1): the hook that joins the state of a list to the URL, to the
// saved view and to the rows of the list. The pure rules live in src/lib/lists/state.ts;
// this file owns what needs a browser: the two stores, the history entries, the debounce
// of `q` and the fetch of the data of PR5. `EntityList` draws what it returns.
//
// First render (PR1). The URL and the saved view are external stores read with
// `useSyncExternalStore`, whose server snapshots are the empty search and no saved view.
// So the prerendered HTML and the hydration both paint the default state, and the state of
// the URL is applied right after, with no hydration error. The inline script of PR4 has
// hidden the root before the first paint when that state differs; `ready` tells
// `EntityList` when it can show it again.
//
// History (7.7.3). A page change is a `pushState`; everything else — filters, sort, `q`,
// view — a `replaceState` (H1), so Back and Forward walk the visited pages only. After
// every write the hook dispatches `ac:url`, which makes the stores read the URL again;
// `popstate` does the same for Back and Forward (H2). A filter, `q` or sort change goes
// back to page 1; a view change keeps the page (H3).
//
// Data (PR5). With `config.dataUrl` the props only carry the first page of the default
// state, and `total` says how long the whole list is. The hook asks for the rest when it
// hydrates. Until it arrives, a state that needs other rows is not applied: the view keeps
// the first page (hidden by PR4 on load), and if the request fails the list says so only
// for that state (`failed`).

/**
 * Contract with every writer of the URL of a list: the event that makes the stores read
 * `location.search` again (PR1). The controller dispatches it on `window`.
 */
export const URL_EVENT = 'ac:url';

/** U5: the URL takes `q` this long after the last key. */
export const QUERY_DELAY_MS = 300;

/** A write that waits: the pending write of `q` (U5). */
export interface DelayedWrite {
  /** Drops the write still waiting, if any, and runs `write` `delay` ms from now. */
  schedule: (write: () => void) => void;
  /** Drops the write still waiting: Back, Forward, clearing the filters, unmounting. */
  cancel: () => void;
}

/**
 * U5: every key schedules the write of `q` again, so the URL takes the field once, `delay`
 * ms after the last key, with the last value. The rows do not wait for it: they follow the
 * field through `useDeferredValue`.
 */
export function delayedWrite(delay: number): DelayedWrite {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const cancel = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  return {
    schedule(write) {
      cancel();
      timer = setTimeout(() => {
        timer = null;
        write();
      }, delay);
    },
    cancel,
  };
}

function subscribeUrl(onChange: () => void): () => void {
  window.addEventListener('popstate', onChange);
  window.addEventListener(URL_EVENT, onChange);
  return () => {
    window.removeEventListener('popstate', onChange);
    window.removeEventListener(URL_EVENT, onChange);
  };
}

function readSearch(): string {
  return window.location.search;
}

function serverSearch(): string {
  return '';
}

/** The saved view changes in this tab through the controller and in another one by `storage`. */
function subscribeSaved(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  window.addEventListener(URL_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(URL_EVENT, onChange);
  };
}

/** U6: reads and writes of the saved view never throw; a failure means no saved view. */
function readSavedView(id: string): string | null {
  try {
    return window.localStorage.getItem(VIEW_STORAGE_PREFIX + id);
  } catch {
    return null;
  }
}

function saveView(id: string, view: EntityView): void {
  try {
    window.localStorage.setItem(VIEW_STORAGE_PREFIX + id, view);
  } catch {
    // Storage is blocked or full: the view still changes, it is only not remembered (U6).
  }
}

function noSubscription(): () => void {
  return () => {};
}

/**
 * Writes the URL of `state`, keeping the parameters of any other list of the page. A page
 * change is a new entry and leaves the fragment behind; any other change replaces the
 * entry and keeps it (H1, H7). An unchanged URL is not written, so the link of the current
 * page never adds an entry. Returns whether it wrote.
 */
function writeUrl<T>(config: ListConfig<T>, state: ListState, mode: 'push' | 'replace'): boolean {
  const { pathname, search, hash } = window.location;
  const next = listSearch(config, search, state);
  if (next === search) return false;
  const url = `${pathname}${next}${mode === 'push' ? '' : hash}`;
  if (mode === 'push') window.history.pushState(window.history.state, '', url);
  else window.history.replaceState(window.history.state, '', url);
  window.dispatchEvent(new Event(URL_EVENT));
  return true;
}

export interface ListControllerOptions<T> {
  /**
   * The rows of the island's props: every row of the list, or, with `config.dataUrl`, the
   * first page of the default state as the build sorted it (PR5).
   */
  items: readonly T[];
  /** Length of the whole list when `items` is only its first page (PR5). */
  total?: number;
  /** Turns the JSON of `config.dataUrl` into the rows (PR5). It may throw on bad data. */
  decode?: (data: unknown) => readonly T[];
  /**
   * Path of the page without a query (`/es/pokedex/`): the base of the page links, which
   * the build prints before any script runs (H6). A prerendered page never reads its
   * query (PR2), so the path is all it can know.
   */
  path: string;
}

export interface ListController<T> {
  config: ListConfig<T>;
  /** The chosen state, what the controls show; `q` trimmed. */
  state: ListState;
  /** The search field as typed, spaces included (U5). */
  query: string;
  /** What the active view draws. */
  page: ListPage<T>;
  /**
   * The state of the URL is applied and the rows it needs are loaded (PR4, PR5); false in
   * the prerendered HTML and during the hydration.
   */
  ready: boolean;
  /** The rows of `dataUrl` could not be loaded and the chosen state needs them (PR5). */
  failed: boolean;
  /** Page count of the default state: the one of the prerendered pagination (PR4). */
  defaultPageCount: number;
  /** U5: filters on every key and writes the URL 300 ms after the last one. */
  setQuery: (value: string) => void;
  /** `null` or an invalid value removes the filter. Back to page 1 (H3). */
  setFilter: (key: string, value: string | null) => void;
  setSort: (id: string) => void;
  /** Saves the view (U6) and keeps the page (H3). */
  setView: (view: EntityView) => void;
  /** A new history entry (H1). */
  goToPage: (page: number) => void;
  /** Empties `q` and every filter; keeps the sort and the view (9.5.10). */
  clearFilters: () => void;
  /** Canonical URL of a page of the chosen state (H6). */
  hrefFor: (page: number) => string;
}

type DataState<T> =
  | { status: 'none' }
  | { status: 'loading' }
  | { status: 'loaded'; rows: readonly T[] }
  | { status: 'failed' };

export function useListState<T>(
  config: ListConfig<T>,
  options: ListControllerOptions<T>,
): ListController<T> {
  const { items, decode, path } = options;
  const total = Math.max(options.total ?? items.length, items.length);
  // The props carry every row, so there is nothing to ask for.
  const complete = config.dataUrl === undefined || total <= items.length;
  if (!complete && decode === undefined) {
    throw new Error(`useListState(${config.id}): \`dataUrl\` needs \`decode\` (PR5).`);
  }

  const search = useSyncExternalStore(subscribeUrl, readSearch, serverSearch);
  const saved = useSyncExternalStore(
    subscribeSaved,
    () => readSavedView(config.id),
    () => null,
  );
  const hydrated = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );

  // U5: the text of the field while the reader types, ahead of the URL.
  const [draft, setDraft] = useState<string | null>(null);
  const [data, setData] = useState<DataState<T>>(() =>
    complete ? { status: 'none' } : { status: 'loading' },
  );

  const defaults = useMemo(() => defaultListState(config), [config]);
  const chosen = useMemo(() => parseListState(config, search, saved), [config, search, saved]);
  // The view the URL itself carries: the saved one is never written back on its own (U2).
  const urlView = useMemo(() => parseListState(config, search).view, [config, search]);

  const state = useMemo(() => {
    if (draft === null) return chosen;
    const q = draft.trim();
    return q === chosen.q ? chosen : { ...chosen, q, page: 1 };
  }, [chosen, draft]);

  // U5: the rows follow the keys without blocking them.
  const deferredQuery = useDeferredValue(state.q);
  const resultState = useMemo(
    () => (deferredQuery === state.q ? state : { ...state, q: deferredQuery }),
    [state, deferredQuery],
  );

  const haveAll = complete || data.status === 'loaded';
  const rows = data.status === 'loaded' ? data.rows : items;
  const canApply = haveAll || sameResultSet(resultState, defaults);
  // Until the rows arrive, a state that needs them shows the first page in its view.
  const fallback = useMemo(
    () => ({ ...defaults, view: resultState.view }),
    [defaults, resultState.view],
  );
  const shownState = canApply ? resultState : fallback;
  const failed = !canApply && data.status === 'failed';
  const ready = hydrated && deferredQuery === state.q && (canApply || failed);

  const page = useMemo(
    () =>
      haveAll
        ? applyListState(config, rows, shownState)
        : firstListPage(config, items, total, shownState),
    [config, haveAll, rows, items, total, shownState],
  );

  // PR5: the rest of the rows, once, when the island hydrates.
  const decodeRef = useRef(decode);
  useLayoutEffect(() => {
    decodeRef.current = decode;
  });
  const dataUrl = config.dataUrl;
  useEffect(() => {
    if (complete || dataUrl === undefined) return undefined;
    const abort = new AbortController();
    fetch(dataUrl, { signal: abort.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`${dataUrl}: ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((json) => {
        const read = decodeRef.current;
        if (read === undefined) throw new Error(`${dataUrl}: no decoder`);
        setData({ status: 'loaded', rows: read(json) });
      })
      .catch(() => {
        if (!abort.signal.aborted) setData({ status: 'failed' });
      });
    return () => abort.abort();
  }, [complete, dataUrl]);

  // The latest chosen state, for the handlers and the write of `q` that run after the
  // render (U5). Updated before the paint, so no event can see an older one.
  const latest = useRef(state);
  useLayoutEffect(() => {
    latest.current = state;
  });

  // U5: the pending write of `q`; Back and Forward drop it, so the URL wins (H2).
  const [queryWrite] = useState(() => delayedWrite(QUERY_DELAY_MS));
  useEffect(() => {
    const onPop = () => {
      queryWrite.cancel();
      setDraft(null);
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      queryWrite.cancel();
    };
  }, [queryWrite]);

  // U4: once the state of the URL is applied, the URL takes its canonical form. The
  // controller's own writes are canonical already, so this only acts after a load or a
  // Back or Forward to a URL that was not; never while the field is being typed.
  //
  // U6: the view the URL names wins over the saved one. When it is the default view, U2
  // leaves it out of the canonical URL, and once the URL is rewritten without it the saved
  // view would take over. So a different saved view is first replaced by the view of the
  // URL: it is the view the reader now sees, and U6 saves every change of view.
  const canonical = listSearch(config, search, { ...page.state, view: urlView });
  const namedView = useMemo(() => {
    const raw = new URLSearchParams(search).get(paramName(config, 'view'));
    return isView(raw) ? raw : null;
  }, [config, search]);
  useEffect(() => {
    if (!ready || failed || draft !== null) return;
    if (canonical === window.location.search) return;
    const keeps = new URLSearchParams(canonical).has(paramName(config, 'view'));
    if (namedView !== null && !keeps && isView(saved) && saved !== namedView) {
      saveView(config.id, namedView);
    }
    const { pathname, hash } = window.location;
    window.history.replaceState(window.history.state, '', `${pathname}${canonical}${hash}`);
    window.dispatchEvent(new Event(URL_EVENT));
  }, [ready, failed, draft, canonical, config, namedView, saved]);

  const setQuery = useCallback(
    (value: string) => {
      setDraft(value);
      queryWrite.schedule(() => {
        writeUrl(config, { ...latest.current, q: value.trim(), page: 1 }, 'replace');
      });
    },
    [config, queryWrite],
  );

  const setFilter = useCallback(
    (key: string, value: string | null) => {
      const filter = config.filters.find((candidate) => candidate.key === key);
      if (filter === undefined) return;
      const filters = { ...latest.current.filters };
      const valid = value === null ? undefined : filterValue(filter.values, value);
      if (valid === undefined) delete filters[key];
      else filters[key] = valid;
      writeUrl(config, { ...latest.current, filters, page: 1 }, 'replace');
    },
    [config],
  );

  const setSort = useCallback(
    (id: string) => {
      if (!config.sorts.some((option) => option.id === id)) return;
      writeUrl(config, { ...latest.current, sort: id, page: 1 }, 'replace');
    },
    [config],
  );

  const setView = useCallback(
    (view: EntityView) => {
      saveView(config.id, view);
      // Back to the default view the URL may not change, and the saved view is then the
      // only thing that did: the stores still have to read it again.
      if (!writeUrl(config, { ...latest.current, view }, 'replace')) {
        window.dispatchEvent(new Event(URL_EVENT));
      }
    },
    [config],
  );

  const goToPage = useCallback(
    (target: number) => {
      writeUrl(config, { ...latest.current, page: Math.max(1, Math.floor(target)) }, 'push');
    },
    [config],
  );

  const clearFilters = useCallback(() => {
    queryWrite.cancel();
    setDraft(null);
    writeUrl(config, { ...latest.current, q: '', filters: {}, page: 1 }, 'replace');
  }, [config, queryWrite]);

  const hrefFor = useCallback(
    (target: number) => `${path}${listSearch(config, search, { ...state, page: target })}`,
    [config, path, search, state],
  );

  return {
    config,
    state,
    query: draft ?? state.q,
    page,
    ready,
    failed,
    defaultPageCount: pageCountOf(config.pageSize, total),
    setQuery,
    setFilter,
    setSort,
    setView,
    goToPage,
    clearFilters,
    hrefFor,
  };
}
