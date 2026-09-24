import {
  Suspense,
  lazy as lazyComponent,
  useCallback,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import type { ReactNode } from 'react';

import '@/styles/components/search-results.css';

import { CardGrid } from '@/components/cards/CardGrid';
import { CardGroup } from '@/components/cards/CardGroup';
import { DexCard } from '@/components/cards/DexCard';
import type { DexCardDrop, DexCardEntry, DexCardLabels } from '@/components/cards/DexCard';
import type * as ListRowModule from '@/components/cards/ListRow';
import type { LootCardDrop, LootCardEntity } from '@/components/cards/LootCard';
import type * as SlotsPanelModule from '@/components/cards/SlotsPanel';
import type * as DataTableModule from '@/components/content/DataTable';
import type { DataTableColumn } from '@/components/content/DataTable';
import { EmptyState } from '@/components/content/EmptyState';
import { TextField } from '@/components/controls/TextField';
import { ElementChip } from '@/components/game/ElementChip';
import type { ElementChipEntry } from '@/components/game/ElementChip';
import type * as EntitySlotModule from '@/components/game/EntitySlot';
import { NestedEntity } from '@/components/game/NestedEntity';
import type { SpriteProps } from '@/components/game/Sprite';
import { SpriteStage } from '@/components/game/SpriteStage';
import { IndexLinks } from '@/components/home/IndexLinks';
import type { IndexLinkEntry } from '@/components/home/IndexLinks';
import type * as ItemsConfigModule from '@/components/items/config';
import type { ItemsData, ItemsRow } from '@/components/items/config';
import { EntityList } from '@/components/lists/EntityList';
import type { EntityListLabels } from '@/components/lists/EntityList';
import { URL_EVENT, useListState } from '@/components/lists/useListState';
import type { ListController } from '@/components/lists/useListState';
import { PokedolaresAmount } from '@/components/money/PokedolaresAmount';
import type { PokedexData, PokedexRow } from '@/components/pokedex/config';
import type * as PokedexViewsModule from '@/components/pokedex/PokedexViews';
import {
  LINK_KINDS,
  SEARCH_MAX_QUERY,
  SEARCH_TITLE_ID,
  capSearchQuery,
  decodeSearchIndex,
  kindOf,
  rankResults,
  searchConfig,
  searchPendingScript,
} from '@/components/search/config';
import type { SearchSystem, SearchSystemItem } from '@/components/search/config';
import type { Locale } from '@/i18n/config';
import type { Messages } from '@/i18n/messages/en';
import type { MessageLeaf } from '@/i18n/messages/types';
import { fill, isPluralMessage, plural } from '@/i18n/messages/types';
import { dexLayout, lootKeys } from '@/lib/cards/layout';
import type { LootKey } from '@/lib/cards/layout';
import { formatTier } from '@/lib/content/format';
import { resolvePokemonImage } from '@/lib/content/pokemon-media';
import { formatInteger } from '@/lib/format/numbers';
import type * as TipsModule from '@/lib/game/tips';
import type { LocalizedText, TipData } from '@/lib/game/tips';
import { PENDING_ATTRIBUTE, applyListState, listSearch, parseListState } from '@/lib/lists/state';
import type { EntityView, ListPage } from '@/lib/lists/state';
import type { SearchEntry, SearchIcon, SearchKind } from '@/lib/search/rank';

// SearchResultsRoot (spec 7.3, 7.7, 8.0.6, 8.6): the island of the `buscar` list, the page
// `/{l}/buscar/`. Template B without crumbs (8.0.2, E4): the page draws the h1 «Buscar»
// (`id="buscar-t"`) and this root draws everything under it.
//
// Markup, top to bottom:
//
//   <div class="ac-search-results">                    the root; PR4 marks it pending
//     <span hidden><script>…</script></span>          PR4, the first thing parsed
//     <div role="search">  TextField variant=search    8.6 step 2, always the same element
//     EntityList                                       only with a query (8.6 step 4)
//     <div class="ac-search-results__featured">        Destacados (8.6 steps 3 and 6)
//
// States (8.6):
//   - Without `q` (step 3): the field and Destacados; no count and no list. It is the state
//     the build prerenders, so the page is useful before anything loads.
//   - With `q` (step 4): `EntityList` with `Count` «{n} resultados», `ViewToggle`, the
//     results and `Pagination` when there is more than one page (step 5). The results are
//     the ones of the index for `q` in the order of 7.9.4, 24 a page, grouped after the cut
//     (8.0.6, CGS 2.1): a `CardGroup` (h2) per kind with results, in the order of the table
//     of 8.6, card titles h3.
//   - No match (step 6, V7): the bar stays, «Sin resultados para «{q}».» takes the place of
//     the results, and Destacados comes under it.
//   - Loading (step 7): the index is the palette's file, asked for when the island hydrates
//     (BU5); until it is here the results zone is empty. A request that fails is the line
//     «No se pudo cargar la búsqueda.» in an `EmptyState` (BU4).
//
// The field (8.6 step 2, U5, v1 point 1). A `TextField variant="search"` named by the h1
// (`aria-labelledby="buscar-t"`), of at most 100 characters, with no button: it filters on
// every key and the URL takes `q` 300 ms after the last one, with `replaceState`. It stays at
// one place of the tree whatever the state, so typing the first letter never remounts it and
// never takes its focus away. Nothing is disabled while the island hydrates (v1 point 2). A `q`
// in the URL longer than the field holds (a link written by hand) is cut to its 100 characters
// in the URL itself, with `replaceState`, before the root shows (`capSearchQuery`): the field,
// the ranking and the empty line then read the same query.
//
// State (7.7). `useListState` owns the URL — `q`, `view` and `page`, the history of H1 to H3,
// the saved view of U6 — and asks for the index (PR5, `dataUrl`). The order of 7.9.4 depends
// on the query and a `ListConfig` cannot write it (./config.ts), so this root ranks the index
// for the query itself (`rankResults`), cuts the page and groups it with `applyListState`, and
// hands `EntityList` the controller with that page. The controller's own page only bounds the
// page of the canonical URL (U4); this root lowers it further when the ranking has fewer
// pages. Like the controller, the results follow the field through `useDeferredValue`.
//
// First render (PR1, PR4). The prerendered HTML and the hydration paint the state without `q`.
// A URL with a query hides the root before the first paint (`searchPendingScript`, printed as
// its first child, as `EntityList` prints the script of every list), and the root shows again
// once the query is applied and everything its page draws is here.
//
// Views (7.7.4, 8.6 step 4). Each group is a `CardGroup` (h2) with its label and its count on
// this page, in the three views:
//   - Pokémon (the views of 8.2): Cards is `CardGrid family="pokedex"` of `DexCard`, with the
//     union of the group (7.6.3), its element chips and its drops; Slots one list of
//     `EntitySlot` of 72 with the art, the Shiny mark, the link to the sheet and the panel of
//     `pokemonTip`; Lista the Lista of the Pokédex (`pokedexList`).
//   - Ítems (the views of 8.5): `LootCard` in `CardGrid family="loot"`, `EntitySlot` of 40 and
//     a `DataTable` of `ListRow variant="drops"`, the item panel on the slot and on the name.
//     The Market items take their data from `/{l}/items/datos.json` and their category from the
//     `meta` of the index; the items of a system (E16) take theirs from the props.
//   - Sistemas, Actividades and Páginas: `IndexLinks`, the same in the three views (E5); a
//     system with tooltip rows opens its panel (`systemTip`).
//   No slot group is split further: the groups of this list are the kinds (V5), so the Slots of
//   the Pokémon are one list in the order of the results.
//
// Data. The index gives what matches and in which order; what the cards of a Pokémon and of a
// Market item draw is the data of their own lists (PR5): `/{l}/pokedex/datos.json` and
// `/{l}/items/datos.json`, asked for when the page needs them and, before that, as soon as the
// island is idle. Until the pieces a page needs are here, its results zone is empty (8.6 step 7)
// and, on load, the root keeps `data-ac-pending`; a piece that does not load is the error line
// of step 7.
//
// JavaScript (13.6). The cards, the game pieces and `IndexLinks` are static imports: they are
// the kit the other list islands load initially, and the bundler keeps a module in the chunk of
// the islands it serves only while the same entries reach it. An `import()` of one of them
// would be a new entry that reaches part of that kit, which splits the shared chunk of every
// list page into small ones: measured, the Pokédex loads about 4 KB more. What loads later is
// only what the other lists already load later — the Slots and Lista components and the tooltip
// builders (as `ItemsRoot` does), the deferred views of the Pokédex (`PokedexViews`) — and the
// two list configurations that decode the data of PR5 and build the item panels, each one a
// module of its own.
//
// Text (DP1, 13.2): `ui` and `search` of the page's locale; `pokedex`, which the Lista of the
// Pokédex reads its captions and headers from (the precedent of the Tier list, D-021); and the
// three item labels the page composes from `items`. Destacados arrives rendered by the page, as
// `children`: it is the same HTML in every state, and it works before the island hydrates.

/** Cards, slots and rows from this index of their group on load their art lazily (7.4.2). */
const EAGER_ART = 4;

/** The keys of the Lista of items after Sprite, Ítem and Categoría, in the order of 8.5. */
const ITEM_LIST_KEYS: readonly LootKey[] = ['droppedBy', 'element', 'use', 'npcPrice', 'shopPrice'];

/**
 * Widths of the Lista of items: those of the item lists (8.5), the drops table of
 * `Lienzo:Pokedex-Shiny-Charizard`. «Ítem» and the columns that table does not draw take what
 * is left.
 */
const ITEM_LIST_WIDTHS: Partial<Record<LootKey | 'sprite', number>> = {
  sprite: 72,
  droppedBy: 180,
  element: 130,
  use: 240,
};

/** The rows of the props: none, the index arrives from `indexUrl` (PR5). */
const NO_ENTRIES: readonly SearchEntry[] = [];

/** The item texts the page composes from `messages.items` (8.5), as `ItemsRoot` takes them. */
export interface SearchItemsLabels {
  /** «Sprite»: header of the sprite column of the Lista, for screen readers. */
  sprite: string;
  /** «Ítem» / «Item»: header of the name column. */
  item: string;
  /** «{n} Pokémon»: «Drop de» of an item that more than one Pokémon drops. */
  droppedByCount: MessageLeaf;
}

export interface SearchResultsRootProps {
  /** Picks the format of the figures, the collation of the names and the language (C-R3). */
  locale: Locale;
  /** `/es/buscar/`: the base of every page link (H6). A prerendered page has no query (PR2). */
  path: string;
  /** `/es/buscar/indice.json`: the index of 7.9.1, the rows of this list (PR5). */
  indexUrl: string;
  /** Entries of the index: the length of the whole list (PR5). */
  total: number;
  /** `/es/pokedex/datos.json`: what the cards of a Pokémon draw (8.2, PR5). */
  pokedexUrl: string;
  /** `/es/items/datos.json`: what the cards of a Market item draw (8.5, PR5). */
  itemsUrl: string;
  /** Every system page by `id`, with its sprite and its panel (8.4, `systemTip`). */
  systems: Readonly<Record<string, SearchSystem>>;
  /** Every item of a system whose page exists, by `id` (E16). */
  systemItems: Readonly<Record<string, SearchSystemItem>>;
  /** «Busca Pokémon, ítems, sistemas…»: `shell.searchHome`, the placeholder of B-06. */
  placeholder: string;
  /** `messages.ui` of the page's locale: the components' texts and the panel labels. */
  ui: Messages['ui'];
  /** `messages.search`: the count, the empty and error lines and the group labels (8.6). */
  search: Messages['search'];
  /** `messages.pokedex`: the captions and headers of the Lista of the Pokédex (8.2). */
  pokedex: Messages['pokedex'];
  items: SearchItemsLabels;
  /** Destacados (`FeaturedSection`), rendered by the page; absent without entries (8.1). */
  children?: ReactNode;
}

/** A plural or a plain template, filled with the figure already formatted (13.2, 13.3). */
function counted(template: MessageLeaf, n: number, locale: Locale): string {
  const chosen = isPluralMessage(template) ? plural(locale, n, template) : template;
  return fill(chosen, { n: formatInteger(n, locale) });
}

/** A text of the page's language as the `Texto` a tooltip builder reads (13.4). */
function localized(text: string, locale: Locale): LocalizedText {
  return { [locale]: text } as LocalizedText;
}

/** The icon of an index entry (7.9.1) as the 32 cell of `IndexLinks` draws it. */
function iconSprite(icon: SearchIcon | null): SpriteProps | null {
  return icon === null ? null : { ...icon };
}

// --------------------------------------------------------------------- the deferred parts
//
// What only the Slots and Lista views and the panels need, loaded with `import()` as deferred
// chunks of 13.6: the modules the Pokédex and the item lists already load that way, not copies
// (see «JavaScript» above), and the item configuration with its panel helpers. They are asked
// for when the island is idle and at once when a page of results needs them; a chunk that
// failed is asked for again the next time the query changes.

interface Parts {
  SlotsPanel: typeof SlotsPanelModule.SlotsPanel;
  SlotsPanelItem: typeof SlotsPanelModule.SlotsPanelItem;
  EntitySlot: typeof EntitySlotModule.EntitySlot;
  DataTable: typeof DataTableModule.DataTable;
  ListRow: typeof ListRowModule.ListRow;
  views: Pick<typeof PokedexViewsModule, 'pokedexList' | 'elementEntry' | 'itemEntry'>;
  tips: Pick<typeof TipsModule, 'elementTip' | 'itemTip' | 'pokemonTip'>;
  items: Pick<typeof ItemsConfigModule, 'dropperEntity' | 'elementChip' | 'itemPanel'>;
}

let loadedParts: Parts | undefined;
let partsRequest: Promise<Parts> | undefined;

function loadParts(): Promise<Parts> {
  partsRequest ??= Promise.all([
    import('@/components/cards/SlotsPanel'),
    import('@/components/game/EntitySlot'),
    import('@/components/content/DataTable'),
    import('@/components/cards/ListRow'),
    import('@/components/pokedex/PokedexViews'),
    import('@/lib/game/tips'),
    import('@/components/items/config'),
  ]).then(
    ([slots, slot, table, row, views, tips, items]) => {
      loadedParts = {
        SlotsPanel: slots.SlotsPanel,
        SlotsPanelItem: slots.SlotsPanelItem,
        EntitySlot: slot.EntitySlot,
        DataTable: table.DataTable,
        ListRow: row.ListRow,
        views,
        tips,
        items,
      };
      return loadedParts;
    },
    (error: unknown) => {
      // Asked for again the next time a page needs it.
      partsRequest = undefined;
      throw error;
    },
  );
  return partsRequest;
}

/** The Pokédex data (PR5) as this list reads it: its rows by id and its `refs`. */
interface PokedexFile {
  rows: readonly PokedexRow[];
  byId: ReadonlyMap<string, PokedexRow>;
  refs: PokedexData['refs'];
}

/** The item data (PR5) as this list reads it: its rows by id and its `refs`. */
interface ItemsFile {
  byId: ReadonlyMap<string, ItemsRow>;
  refs: ItemsData['refs'];
}

/** `/{l}/pokedex/datos.json`, read with the decoders of the Pokédex list, a deferred module. */
async function readPokedex(json: unknown): Promise<PokedexFile> {
  const { decodePokedex, decodeRefs } = await import('@/components/pokedex/config');
  const rows = decodePokedex(json);
  return { rows, byId: new Map(rows.map((row) => [row.id, row])), refs: decodeRefs(json) };
}

/** `/{l}/items/datos.json`, read with the decoders of the item lists, a deferred module. */
async function readItems(json: unknown): Promise<ItemsFile> {
  const { decodeItems, decodeItemsRefs } = await import('@/components/items/config');
  const rows = decodeItems(json);
  return { byId: new Map(rows.map((row) => [row.id, row])), refs: decodeItemsRefs(json) };
}

// The JSON files of PR5 this list reads besides the index, kept in the memory of the module by
// URL. A failed request leaves nothing behind, so the next attempt asks again.
const jsonValues = new Map<string, unknown>();
const jsonRequests = new Map<string, Promise<unknown>>();

function loadJson<T>(url: string, read: (json: unknown) => Promise<T>): Promise<T> {
  if (jsonValues.has(url)) return Promise.resolve(jsonValues.get(url) as T);
  let request = jsonRequests.get(url) as Promise<T> | undefined;
  if (request === undefined) {
    request = fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`${url}: ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then(read)
      .then(
        (value) => {
          jsonValues.set(url, value);
          return value;
        },
        (error: unknown) => {
          jsonRequests.delete(url);
          throw error;
        },
      );
    jsonRequests.set(url, request);
  }
  return request;
}

/** One deferred resource: its value once it is here, and whether the last request failed. */
interface Resource<T> {
  value: T | undefined;
  failed: boolean;
}

/**
 * Asks for a resource while `wanted` holds and it is not here yet, and again after a failure
 * each time `attempt` changes. `load` is stable; `peek` reads what an earlier mount loaded.
 */
function useResource<T>(
  load: () => Promise<T>,
  peek: () => T | undefined,
  wanted: boolean,
  attempt: unknown,
): Resource<T> {
  const [value, setValue] = useState<T | undefined>(peek);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!wanted || value !== undefined) return undefined;
    let live = true;
    load().then(
      (result) => {
        if (!live) return;
        setFailed(false);
        setValue(result);
      },
      () => {
        if (live) setFailed(true);
      },
    );
    return () => {
      live = false;
    };
  }, [wanted, value, load, attempt]);
  return { value, failed };
}

function noSubscription(): () => void {
  return () => {};
}

/** One result of the «Ítems» group as the three views draw it (8.5, E16). */
interface ItemResult {
  id: string;
  card: LootCardDrop;
  sprite: SpriteProps | null;
  tip: TipData;
  /** The Categoría cell of the Lista: its Market category, `null` for the item of a system. */
  category: string | null;
}

/** The item cards, a chunk of their own: results only exist once the reader types (13.6). */
const LootCard = lazyComponent(() =>
  import('@/components/cards/LootCard').then((module) => ({ default: module.LootCard })),
);

export function SearchResultsRoot({
  locale,
  path,
  indexUrl,
  total,
  pokedexUrl,
  itemsUrl,
  systems,
  systemItems,
  placeholder,
  ui,
  search,
  pokedex,
  items,
  children,
}: SearchResultsRootProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  // ------------------------------------------------------------------------------ state
  const config = useMemo(() => searchConfig(indexUrl), [indexUrl]);
  const script = useMemo(() => searchPendingScript(config), [config]);

  // The entries of the index, taken when the controller decodes them (PR5).
  const [entries, setEntries] = useState<readonly SearchEntry[] | null>(() =>
    total > 0 ? null : NO_ENTRIES,
  );
  const decode = useCallback((json: unknown) => {
    const rows = decodeSearchIndex(json);
    setEntries(rows);
    return rows;
  }, []);
  const controller = useListState(config, { items: NO_ENTRIES, total, decode, path });
  const { state } = controller;

  const hydrated = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );

  // U5: the results follow the field without blocking it, as the controller's do.
  const deferredQuery = useDeferredValue(state.q);
  const settled = deferredQuery === state.q;

  // 7.9.4, 8.0.6: the ranked results, then the page of the state, grouped after the cut.
  const ranked = useMemo(
    () => (entries === null ? NO_ENTRIES : rankResults(entries, deferredQuery, locale)),
    [entries, deferredQuery, locale],
  );
  const shown: ListPage<SearchEntry> = useMemo(() => {
    const page = applyListState(config, ranked, { ...state, q: '' });
    return { ...page, state: { ...page.state, q: deferredQuery } };
  }, [config, ranked, state, deferredQuery]);

  // The list shows with the query its results are for, so a key never paints the empty line
  // of a query that is not ranked yet.
  const hasQuery = deferredQuery !== '';
  const loading = hasQuery && entries === null && !controller.failed;

  // --------------------------------------------------------------------- deferred parts
  const needsParts = hasQuery && shown.total > 0;
  const needsPokedex = shown.items.some((entry) => entry.kind === 'pokemon');
  const needsItems = shown.items.some(
    (entry) => entry.kind === 'item' && systemItems[entry.id] === undefined,
  );

  const [idle, setIdle] = useState(false);
  useEffect(() => {
    const prefetch = () => setIdle(true);
    if (typeof window.requestIdleCallback === 'function') {
      const handle = window.requestIdleCallback(prefetch);
      return () => window.cancelIdleCallback(handle);
    }
    const handle = window.setTimeout(prefetch);
    return () => window.clearTimeout(handle);
  }, []);

  const loadPokedex = useCallback(() => loadJson(pokedexUrl, readPokedex), [pokedexUrl]);
  const loadItems = useCallback(() => loadJson(itemsUrl, readItems), [itemsUrl]);
  const partsResource = useResource(
    loadParts,
    () => loadedParts,
    idle || needsParts,
    deferredQuery,
  );
  const pokedexResource = useResource(
    loadPokedex,
    () => jsonValues.get(pokedexUrl) as PokedexFile | undefined,
    idle || needsPokedex,
    deferredQuery,
  );
  const itemsResource = useResource(
    loadItems,
    () => jsonValues.get(itemsUrl) as ItemsFile | undefined,
    idle || needsItems,
    deferredQuery,
  );
  const parts = partsResource.value;
  const dexData = pokedexResource.value;
  const itemData = itemsResource.value;

  const missing =
    (needsParts && parts === undefined) ||
    (needsPokedex && dexData === undefined) ||
    (needsItems && itemData === undefined);
  const broken =
    (needsParts && parts === undefined && partsResource.failed) ||
    (needsPokedex && dexData === undefined && pokedexResource.failed) ||
    (needsItems && itemData === undefined && itemsResource.failed);
  const failed = hasQuery && (controller.failed || broken);
  // 8.6 step 2: a `q` of the URL longer than the field holds waits for the cut below.
  const overlong = state.q.length > SEARCH_MAX_QUERY;
  // PR4: the state of the URL is applied and what its page draws is here.
  const ready =
    hydrated && settled && !overlong && (!hasQuery || (controller.ready && (failed || !missing)));

  useLayoutEffect(() => {
    if (ready) rootRef.current?.removeAttribute(PENDING_ATTRIBUTE);
  }, [ready]);

  // 8.6 step 2: the field holds 100 characters, so a longer `q` of the URL is cut to them in
  // the URL, which every reader of the state follows (`URL_EVENT`). The root stays pending
  // until then, so the longer query never shows.
  useEffect(() => {
    if (!hydrated || !overlong) return;
    const { pathname, search: query, hash } = window.location;
    const url = parseListState(config, query);
    const q = capSearchQuery(url.q);
    if (q === url.q) return;
    const next = listSearch(config, query, { ...url, q, page: 1 });
    window.history.replaceState(window.history.state, '', `${pathname}${next}${hash}`);
    window.dispatchEvent(new Event(URL_EVENT));
  }, [hydrated, overlong, config]);

  // U4: the controller bounds `page` with the pages of its own filter, which are never fewer
  // than the ranking's; the page of the URL takes the bound of the ranking here. Without a
  // query there is no list, so no page either. Never while the URL still waits for the query
  // being typed (U5).
  const shownPage = shown.state.page;
  useEffect(() => {
    if (!ready || failed) return;
    const { pathname, search: query, hash } = window.location;
    const url = parseListState(config, query);
    if (url.q !== state.q) return;
    const page = hasQuery ? shownPage : 1;
    if (url.page === page) return;
    const next = listSearch(config, query, { ...url, page });
    window.history.replaceState(window.history.state, '', `${pathname}${next}${hash}`);
    window.dispatchEvent(new Event(URL_EVENT));
  }, [ready, failed, config, state.q, hasQuery, shownPage]);

  // --------------------------------------------------------------------- panels and cards
  const dexLabels: DexCardLabels = {
    ...ui.cards,
    requirement: ui.tooltip.requirement,
    level: ui.tooltip.level,
    tier: ui.tooltip.tier,
    role: ui.tooltip.role,
    shiny: ui.shiny,
  };

  // Every element chip and every drop of the Pokédex data, each with its panel (7.5.3).
  const [elementChips, dropEntries] = useMemo(() => {
    const chips = new Map<string, ElementChipEntry>();
    const drops = new Map<string, DexCardDrop>();
    if (parts !== undefined && dexData !== undefined) {
      for (const [id, ref] of Object.entries(dexData.refs.elementos))
        chips.set(id, parts.views.elementEntry(id, ref, locale, ui.tooltip));
      for (const [id, ref] of Object.entries(dexData.refs.items))
        drops.set(id, parts.views.itemEntry(id, ref, dexData.rows, locale, ui.tooltip));
    }
    return [chips, drops] as const;
  }, [parts, dexData, locale, ui.tooltip]);

  const elementNames = useMemo(
    () =>
      new Map(Object.entries(dexData?.refs.elementos ?? {}).map(([id, ref]) => [id, ref.nombre])),
    [dexData],
  );

  // ------------------------------------------------------------------------------ views
  function renderGroups(page: ListPage<SearchEntry>, view: EntityView): ReactNode {
    if (parts === undefined || missing) return null;
    const { SlotsPanel, SlotsPanelItem, EntitySlot, DataTable, ListRow } = parts;
    const lazy = (index: number) => (index >= EAGER_ART ? ('lazy' as const) : undefined);
    const pokemonHref = (row: PokedexRow) => `/${locale}/pokedex/${row.id}/`;

    /** The Pokémon of the group, as the Pokédex data gives them (8.2). */
    const pokemonView = (group: readonly SearchEntry[], label: string): ReactNode => {
      const rows = group.flatMap((entry) => dexData?.byId.get(entry.id) ?? []);
      const elementsOf = (row: PokedexRow) =>
        row.elementos.flatMap((id) => elementChips.get(id) ?? []);
      // A row as `DexCard` reads it (8.0.5, 8.2): the registry values, already written.
      const cards = rows.map((row): [PokedexRow, DexCardEntry] => [
        row,
        {
          name: row.nombre,
          href: pokemonHref(row),
          number: row.numero,
          generation: row.generacion,
          art: resolvePokemonImage(row.imagen),
          level: row.nivel,
          tier: row.tier === null ? null : formatTier(row.tier),
          role: row.funcion,
          variant: row.variante === 'shiny' || row.variante === 'normal' ? row.variante : null,
          elements: elementsOf(row),
          drops: row.drops?.flatMap((id) => dropEntries.get(id) ?? []),
        },
      ]);
      // The union of the group (7.6.3); the Lista takes its columns from it too.
      const layout = dexLayout(cards.map(([, entry]) => entry));

      if (view === 'cards') {
        return (
          <CardGrid family="pokedex">
            {cards.map(([row, entry], index) => (
              <DexCard
                key={row.id}
                entry={entry}
                layout={layout}
                labels={dexLabels}
                locale={locale}
                hint={ui.pinHint}
                loading={lazy(index)}
              />
            ))}
          </CardGrid>
        );
      }

      if (view === 'slots') {
        // The panel of a slot (7.5.3): Requisito, Tier, Elementos, Generación and Rol.
        const panelOf = (row: PokedexRow): TipData =>
          parts.tips.pokemonTip(
            {
              ...row,
              elementos: row.elementos.flatMap((id) => {
                const name = elementNames.get(id);
                return name === undefined ? [] : [{ nombre: localized(name, locale) }];
              }),
            },
            locale,
            ui.tooltip,
          );
        return (
          <SlotsPanel label={label}>
            {rows.map((row, index) => {
              const source = resolvePokemonImage(row.imagen);
              return (
                <SlotsPanelItem key={row.id}>
                  <EntitySlot
                    size={72}
                    name={row.nombre}
                    sprite={
                      source === null ? null : { src: source, smooth: true, loading: lazy(index) }
                    }
                    tip={panelOf(row)}
                    shiny={row.variante === 'shiny'}
                    href={pokemonHref(row)}
                    locale={locale}
                    hint={ui.pinHint}
                    shinyLabel={ui.shiny}
                  />
                </SlotsPanelItem>
              );
            })}
          </SlotsPanel>
        );
      }

      return parts.views.pokedexList(
        { state: page.state, items: rows, groups: [], total: rows.length, pageCount: 1 },
        {
          locale,
          ui,
          pokedex,
          title: label,
          names: elementNames,
          layout,
          elementsOf,
          anchor: () => undefined,
          lazy,
          caption: label,
        },
      );
    };

    /** «Drop de» of a Market item (7.5.3): the one Pokémon with its panel, «{n} Pokémon». */
    const droppedBy = (row: ItemsRow, refs: ItemsData['refs']): LootCardEntity | string | null => {
      const ids = row.dropDe ?? [];
      if (ids.length === 0) return null;
      if (ids.length > 1) return counted(items.droppedByCount, ids.length, locale);
      const [one] = ids;
      const ref = one === undefined ? undefined : refs.pokemon[one];
      if (one === undefined || ref === undefined) return null;
      return parts.items.dropperEntity(one, ref, locale, ui.tooltip, parts.tips.pokemonTip);
    };

    /** The items of the group: Market items from their data, system items from the props. */
    const itemResults = (group: readonly SearchEntry[]): ItemResult[] =>
      group.flatMap((entry): ItemResult[] => {
        const own = systemItems[entry.id];
        if (own !== undefined) {
          return [
            {
              id: entry.id,
              card: { name: entry.name, sprite: own.sprite, use: own.use, useLang: own.useLang },
              sprite: own.sprite,
              tip: own.tip,
              category: null,
            },
          ];
        }
        const row = itemData?.byId.get(entry.id);
        const refs = itemData?.refs;
        if (row === undefined || refs === undefined) return [];
        const element = row.elemento === null ? undefined : refs.elementos[row.elemento];
        const category = entry.meta ?? null;
        return [
          {
            id: row.id,
            card: {
              name: row.nombre,
              sprite: row.sprite,
              dropDe: droppedBy(row, refs),
              element:
                row.elemento === null || element === undefined
                  ? null
                  : parts.items.elementChip(
                      row.elemento,
                      element,
                      locale,
                      ui.tooltip,
                      parts.tips.elementTip,
                    ),
              use: row.uso,
              npcPrice: row.vende,
              shopPrice: row.compra,
            },
            sprite: row.sprite,
            tip: parts.items.itemPanel(row, refs, category, locale, ui.tooltip, parts.tips.itemTip),
            category,
          },
        ];
      });

    const itemView = (group: readonly SearchEntry[], label: string): ReactNode => {
      const results = itemResults(group);
      const keys = lootKeys(results.map((result) => result.card));

      if (view === 'cards') {
        return (
          <Suspense fallback={null}>
            <CardGrid family="loot">
              {results.map((result, index) => (
                <LootCard
                  key={result.id}
                  drop={result.card}
                  keys={keys}
                  labels={ui.tooltip}
                  locale={locale}
                  hint={ui.pinHint}
                  loading={lazy(index)}
                />
              ))}
            </CardGrid>
          </Suspense>
        );
      }

      if (view === 'slots') {
        return (
          <SlotsPanel label={label}>
            {results.map((result, index) => (
              <SlotsPanelItem key={result.id}>
                <EntitySlot
                  size={40}
                  name={result.card.name}
                  sprite={result.sprite ? { ...result.sprite, loading: lazy(index) } : null}
                  tip={result.tip}
                  locale={locale}
                  hint={ui.pinHint}
                />
              </SlotsPanelItem>
            ))}
          </SlotsPanel>
        );
      }

      const listKeys = ITEM_LIST_KEYS.filter((key) => keys.includes(key));
      const withCategory = results.some((result) => result.category !== null);

      /** A Lista cell of one of the keys of `ITEM_LIST_KEYS`; `null` is «—» (ListRow). */
      const cell = (card: LootCardDrop, key: LootKey): ReactNode => {
        switch (key) {
          case 'droppedBy': {
            const value = card.dropDe ?? null;
            if (value === null || typeof value === 'string') return value;
            if (value.tip === null || value.tip.rows.length === 0) return value.name;
            return (
              <NestedEntity
                tip={value.tip}
                href={value.href}
                variant="link"
                placement="down"
                align="auto"
                locale={locale}
                hint={ui.pinHint}
              >
                {value.name}
              </NestedEntity>
            );
          }
          case 'element': {
            // The Lista cell of an element is its label: it never opens a panel (DS:ElementChip).
            const value = card.element ?? null;
            if (value === null || typeof value === 'string') return value;
            return (
              <ElementChip element={value} variant="label" locale={locale} hint={ui.pinHint} />
            );
          }
          case 'use':
            return card.use === null || card.use === undefined ? null : (
              <span lang={card.useLang}>{card.use}</span>
            );
          case 'npcPrice':
            return card.npcPrice === null || card.npcPrice === undefined ? null : (
              <PokedolaresAmount amount={card.npcPrice} locale={locale} />
            );
          case 'shopPrice':
            return card.shopPrice === null || card.shopPrice === undefined ? null : (
              <PokedolaresAmount amount={card.shopPrice} locale={locale} />
            );
          case 'quantity':
            return null;
        }
      };

      const columns: DataTableColumn[] = [
        { key: 'sprite', label: items.sprite, srOnly: true, width: ITEM_LIST_WIDTHS.sprite },
        { key: 'item', label: items.item },
        ...(withCategory ? [{ key: 'category', label: ui.tooltip.category }] : []),
        ...listKeys.map((key) => ({
          key,
          label: ui.tooltip[key],
          width: ITEM_LIST_WIDTHS[key],
        })),
      ];
      // A «Uso» runs over several lines in its 240 px: `wrap` gives those cells their 8 px
      // above and below (DS:DataTable).
      return (
        <DataTable caption={label} columns={columns} hover scroll wrap={listKeys.includes('use')}>
          {results.map((result, index) => {
            const values = listKeys.map((key) => cell(result.card, key));
            return (
              <ListRow
                key={result.id}
                variant="drops"
                nameAlign="center"
                sprite={
                  <SpriteStage
                    sprite={result.sprite ? { ...result.sprite, loading: lazy(index) } : null}
                    size={40}
                  />
                }
                name={result.card.name}
                tip={result.tip}
                hint={ui.pinHint}
                locale={locale}
                cells={withCategory ? [result.category, ...values] : values}
              />
            );
          })}
        </DataTable>
      );
    };

    /** E5: a link of the index with its sprite and, for a system, its panel (8.4). */
    const linkOf = (entry: SearchEntry): IndexLinkEntry => {
      const system = entry.kind === 'sistema' ? systems[entry.id] : undefined;
      return {
        id: entry.id,
        label: entry.name,
        href: entry.href,
        sprite: system === undefined ? iconSprite(entry.icon) : system.sprite,
        ...(system?.tip === undefined ? {} : { tip: system.tip }),
      };
    };

    return page.groups.map((group) => {
      const kind: SearchKind = kindOf(group);
      const label = search.groups[kind];
      let body: ReactNode;
      if (LINK_KINDS.has(kind)) {
        body = <IndexLinks links={group.items.map(linkOf)} locale={locale} hint={ui.pinHint} />;
      } else if (kind === 'pokemon') {
        body = pokemonView(group.items, label);
      } else {
        body = itemView(group.items, label);
      }
      return (
        <CardGroup key={kind} label={label} count={group.items.length} level={2} locale={locale}>
          {body}
        </CardGroup>
      );
    });
  }

  const views: Record<EntityView, (page: ListPage<SearchEntry>) => ReactNode> = {
    cards: (page) => renderGroups(page, 'cards'),
    slots: (page) => renderGroups(page, 'slots'),
    list: (page) => renderGroups(page, 'list'),
  };

  // `ui` carries every text of `EntityListLabels` under the same keys (13.2); the error of a
  // search that did not load is the palette's line (8.6 step 7, BU4).
  const labels: EntityListLabels = { ...ui, dataError: search.error };
  const list: ListController<SearchEntry> = { ...controller, page: shown, ready, failed };

  // 8.6 steps 3 and 6: Destacados without a query and under the empty line.
  const featured =
    children !== undefined &&
    children !== null &&
    (!hasQuery || (!loading && !failed && shown.total === 0));

  return (
    <div ref={rootRef} className="ac-search-results" suppressHydrationWarning>
      <span hidden dangerouslySetInnerHTML={{ __html: `<script>${script}</script>` }} />
      <div role="search" className="ac-search-results__field">
        <TextField
          variant="search"
          value={controller.query}
          onChange={(value) => controller.setQuery(value)}
          placeholder={placeholder}
          inputProps={{
            'aria-labelledby': SEARCH_TITLE_ID,
            maxLength: SEARCH_MAX_QUERY,
            autoComplete: 'off',
            spellCheck: false,
            enterKeyHint: 'search',
          }}
        />
      </div>
      {hasQuery ? (
        <EntityList
          controller={list}
          labels={labels}
          count={(n) => (loading ? '' : counted(search.count, n, locale))}
          empty={(shownState) =>
            loading ? null : <EmptyState>{fill(search.empty, { q: shownState.q })}</EmptyState>
          }
          views={views}
          paginationAlign="center"
        />
      ) : null}
      {featured ? <div className="ac-search-results__featured">{children}</div> : null}
    </div>
  );
}
