import type { SpriteProps } from '@/components/game/Sprite';
import type { Locale } from '@/i18n/config';
import type { TipData } from '@/lib/game/tips';
import { PENDING_ATTRIBUTE, paramName } from '@/lib/lists/state';
import type { ListConfig, ListGroup } from '@/lib/lists/state';
import { normalizeQuery } from '@/lib/search/normalize';
import { rankSearch, scoreEntry, searchKinds } from '@/lib/search/rank';
import type { SearchEntry, SearchKind } from '@/lib/search/rank';

// The `buscar` list of spec 8.0.6 and 8.6, shared by the build and the island: its
// `ListConfig`, the order of its results, the reader of `/{l}/buscar/indice.json` and the
// inline script of PR4 for the root of the page. Nothing here imports the registry, Zod or a
// component at run time (the component imports are types only), so what the island takes
// from it is only what it runs.
//
// State (8.0.6): 24 results a page, the text `q` and no other filter, one order and the groups
// of the index (the `SearchKind` of each entry, in the order of the table of 8.6). `q` lives in
// the URL like the `q` of every list (U1 to U5): the island types it through the controller
// and the URL takes it 300 ms after the last key.
//
// Order (8.6 step 4): «resultados con el orden de §7.9.4, 24 por página y agrupados después de
// paginar». The order of 7.9.4 depends on the query — the score of each entry for it — and a
// `ListConfig` sorts with a comparator that never sees the query, so the controller cannot
// write it: `rankResults` does, with the scoring and the tie-breaks of src/lib/search/rank.ts,
// the ones the palette ranks with. The island cuts the ranked results into pages and groups
// them with `applyListState` itself.
//
// The controller still filters with its own text (`controllerText`) for the one thing it
// computes from its page: the upper bound of `page` when it writes the canonical URL (U4). That
// text holds every field the scoring reads, so its matches are never fewer than the ranked
// results and the bound it computes never cuts a page the ranking has (see `controllerText`).

/** Key of the saved view, `ac:vista:buscar` (U6), and the `data-ac-list` of the root. */
export const SEARCH_LIST_ID = 'buscar';

/** Results per page (8.0.6). */
export const SEARCH_PAGE_SIZE = 24;

/** Longest query the field takes (8.6 step 2), the same bound as the palette's. */
export const SEARCH_MAX_QUERY = 100;

/**
 * `q` as the field takes it (8.6 step 2): its first `SEARCH_MAX_QUERY` UTF-16 units, the ones
 * `maxlength` counts, never half of a surrogate pair, and without the spaces the cut leaves at
 * its end. A query the field could hold comes back unchanged. The typed query never needs it
 * (the field stops at the bound); a `q` in the URL can be longer, and the island cuts it there.
 */
export function capSearchQuery(q: string): string {
  if (q.length <= SEARCH_MAX_QUERY) return q;
  const high = q.charCodeAt(SEARCH_MAX_QUERY - 1);
  const end = high >= 0xd800 && high <= 0xdbff ? SEARCH_MAX_QUERY - 1 : SEARCH_MAX_QUERY;
  return q.slice(0, end).trimEnd();
}

/** `id` of the h1 «Buscar», which names the search field (8.6 steps 1 and 2). */
export const SEARCH_TITLE_ID = 'buscar-t';

/**
 * E5: the groups the design system has no card family for. Sistemas, Actividades and Páginas
 * are link lists (`IndexLinks`) that look the same in Cards, Slots and Lista.
 */
export const LINK_KINDS: ReadonlySet<SearchKind> = new Set<SearchKind>([
  'sistema',
  'actividad',
  'pagina',
]);

/** `/{l}/buscar/indice.json`: the index the palette downloads too (7.9.1, 8.6 step 7). */
export function searchIndexUrl(locale: Locale): string {
  return `/${locale}/buscar/indice.json`;
}

// ------------------------------------------------------------------------------ reading

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value !== '';
}

const KINDS: ReadonlySet<string> = new Set(searchKinds);

/** One entry of the index, or `null` when it does not have the shape of `SearchEntry`. */
function readEntry(raw: unknown): SearchEntry | null {
  if (!isRecord(raw)) return null;
  const { kind, id, name, href, icon, meta, dex, terms } = raw;
  if (typeof kind !== 'string' || !KINDS.has(kind)) return null;
  if (!isText(id) || !isText(name) || !isText(href) || !href.startsWith('/')) return null;
  if (icon !== null && !(isRecord(icon) && isText(icon.src))) return null;
  if (meta !== undefined && typeof meta !== 'string') return null;
  if (dex !== undefined && !(typeof dex === 'number' && Number.isInteger(dex))) return null;
  if (terms !== undefined && !(Array.isArray(terms) && terms.every((term) => isText(term)))) {
    return null;
  }
  return raw as unknown as SearchEntry;
}

/**
 * The entries of `/{l}/buscar/indice.json` (7.9.1). A file that is not a list of
 * `SearchEntry` throws, and the list controller then reports the search as not loaded (PR5,
 * 8.6 step 7): an index the build wrote wrong is never searched half.
 */
export function decodeSearchIndex(data: unknown): SearchEntry[] {
  if (!Array.isArray(data)) throw new Error('buscar/indice.json: not a list');
  return data.map((raw, index) => {
    const entry = readEntry(raw);
    if (entry === null) throw new Error(`buscar/indice.json: bad entry ${index}`);
    return entry;
  });
}

// ------------------------------------------------------------------------------ order

/**
 * The results of `query` in the order of 7.9.4: the score first, then the order of the types
 * (`searchKinds`), then the name with `Intl.Collator(locale, { numeric: true })`. What matches
 * and every tie-break are `rankSearch`'s, with no cap per group: it returns the groups in the
 * order of the types, each sorted by score and name, so a stable sort of their concatenation by
 * the score alone gives score, type and name. An empty query matches nothing.
 */
export function rankResults(
  entries: readonly SearchEntry[],
  query: string,
  locale: Locale,
): SearchEntry[] {
  const groups = rankSearch(entries, query, locale, Number.POSITIVE_INFINITY);
  const normalized = normalizeQuery(query);
  const scores = new Map<SearchEntry, number>();
  const ordered = groups.flatMap((group) => group.entries);
  for (const entry of ordered) scores.set(entry, scoreEntry(entry, normalized) ?? 0);
  // `Array.prototype.sort` is stable: equal scores keep the type and name order.
  return ordered.sort((a, b) => (scores.get(a) ?? 0) - (scores.get(b) ?? 0));
}

/** The text of each entry, built once: the index is read once per page (PR5). */
const TEXTS = new WeakMap<SearchEntry, string>();

/**
 * The text the list controller filters `q` with (7.7.1 `text`). The island never shows what
 * that filter finds (see the head of this file); the controller only takes from it the number
 * of pages, the bound of `page` in the canonical URL (U4). So the text holds every field the
 * scoring of 7.9.4 reads — the name, `meta`, the `id` and `terms` — and the Pokédex number
 * written plain and on three digits («6», «006»): every fragment of a query that scores is a
 * substring of it, the controller never finds fewer entries than the ranking and never lowers
 * a page the ranking has. A number written with its prefix («#6», «nº 6») finds the one
 * variant of that number and its Shiny, one page, which no bound can cut.
 */
export function controllerText(entry: SearchEntry): string {
  let text = TEXTS.get(entry);
  if (text === undefined) {
    const parts = [entry.name, entry.meta ?? '', entry.id, ...(entry.terms ?? [])];
    if (entry.dex !== undefined) parts.push(String(entry.dex), String(entry.dex).padStart(3, '0'));
    text = parts.join('\n');
    TEXTS.set(entry, text);
  }
  return text;
}

/** The one order (8.0.6): the order `rankResults` already gave the rows. */
function keepOrder(): number {
  return 0;
}

/**
 * The configuration of the `buscar` list (8.0.6): 24 a page, `q` over `controllerText`, one
 * order and the groups of the index in the order of the table of 8.6. No `anchorId`: nothing
 * links to a result of this page (H7). `dataUrl` is the index, which the controller asks for
 * when the island hydrates (PR5, BU5). The island memoises it.
 */
export function searchConfig(dataUrl: string): ListConfig<SearchEntry> {
  return {
    id: SEARCH_LIST_ID,
    pageSize: SEARCH_PAGE_SIZE,
    // One order, so no `SortSelect` shows its label (V6, 8.0.6).
    sorts: [{ id: 'relevancia', label: '', compare: keepOrder }],
    filters: [],
    text: controllerText,
    groupBy: (entry) => entry.kind,
    groupOrder: searchKinds,
    dataUrl,
  };
}

/** The groups of a page in the order of the table of 8.6, typed by their kind. */
export function kindOf(group: ListGroup<SearchEntry>): SearchKind {
  return group.items[0]?.kind ?? (group.key as SearchKind);
}

// ------------------------------------------------------------------------------ PR4

/**
 * PR4 for the root of the page: the inline classic script that runs before the first paint,
 * as the first thing inside the root (in a hidden `span`, the way `EntityList` prints the one
 * of every list). The prerendered page is the state without `q`: the field and Destacados
 * (8.6 step 3). A URL with a query shows other content — its results, or the empty line — so
 * the script marks the root `data-ac-pending` and the island takes the attribute off once the
 * query is applied and its data are here; after 5 s the script takes it off by itself. The
 * view and the page only change the results, which the prerendered page never has: without
 * `q` they change nothing it shows, so they never hide it. Generated from the configuration:
 * the parameter is `q`, or `<prefix>.q`.
 */
export function searchPendingScript(config: ListConfig<SearchEntry>): string {
  // JSON inside a script: `<` is escaped so no value can close the element.
  const json = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');
  const attribute = json(PENDING_ATTRIBUTE);
  return (
    '(function(){try{var r=document.currentScript.parentNode.parentNode,' +
    `q=new URLSearchParams(location.search).get(${json(paramName(config, 'q'))});` +
    `if(q&&q.trim()){r.setAttribute(${attribute},"");` +
    `setTimeout(function(){r.removeAttribute(${attribute})},5e3)}}catch(e){}})()`
  );
}

// ------------------------------------------------------------------------------ props

/**
 * A system page of the «Sistemas» group (8.4, 8.6): its sprite as the adapter resolved it
 * (DP2), the one the systems index draws, and the rows of its panel when the record has tooltip
 * rows (`systemTip`, R2). The page builds both; the index only carries a static frame of the
 * sprite, which is the fallback. Only the rows travel (13.6: the props are at their budget):
 * `systemPanel` puts the head and the title the page already has around them.
 */
export interface SearchSystem {
  sprite: SpriteProps | null;
  rows?: TipData['rows'];
}

/** `size-tt`, the width of a system panel (`systemTip`, 7.5.2). */
const SYSTEM_TIP_WIDTH = 282;

/** The panel of a system page, as `systemTip` builds it: its sprite, its title and its rows. */
export function systemPanel(id: string, title: string, system: SearchSystem): TipData | undefined {
  if (system.rows === undefined) return undefined;
  return {
    key: `sistema:${id}`,
    title,
    width: SYSTEM_TIP_WIDTH,
    head: { type: 'sprite', sprite: system.sprite },
    rows: system.rows,
  };
}

/**
 * An item of `content/system-items.json` whose system page exists (E16): what its card, its
 * slot and its row need besides the index — its sprite (DP2), «Uso», its `descripcion`, which
 * exists in English only (L-04), with the language to mark it with on a page of the other
 * locale (T22, WA4), and its panel (`systemItemTip`), built by the page with its «Uso» row
 * marked the same way.
 */
export interface SearchSystemItem {
  sprite: SpriteProps | null;
  use: string | null;
  useLang?: Locale;
  tip: TipData;
}
