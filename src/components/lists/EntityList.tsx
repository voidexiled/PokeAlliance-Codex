import { useLayoutEffect, useMemo, useRef } from 'react';
import type { MouseEvent, ReactNode } from 'react';

import { Count } from '@/components/content/Count';
import { EmptyState } from '@/components/content/EmptyState';
import { Pagination } from '@/components/controls/Pagination';
import { ViewToggle } from '@/components/controls/ViewToggle';
import type { ViewToggleLabels } from '@/components/controls/ViewToggle';
import type { ListController } from '@/components/lists/useListState';
import { PENDING_ATTRIBUTE, pendingScript } from '@/lib/lists/state';
import type { EntityView, ListPage, ListState } from '@/lib/lists/state';

// EntityList (spec 7.7.1, 7.7.3–7.7.5): what every list of entities shares — the controls
// its root passes, the results bar (`Count` on the left; `SortSelect` and `ViewToggle` on
// the right, V6), the active view and the pagination — driven by the controller that
// `useListState` returns. The root of the island owns the configuration, the controls
// and the three views: this file only places them and keeps the rules of 7.7.
//
// Markup, top to bottom, 16 apart (V6, `Lienzo:Pokedex`, `Lienzo:Comercio`):
//
//   <div class="ac-entity-list" data-ac-list="<id>">      the root; PR4 marks it pending
//     <span hidden><script>…</script></span>              PR4, the first thing parsed
//     {controls}                                           search, type tabs, FilterBar
//     <div class="ac-entity-list__bar">                    Count · SortSelect ViewToggle
//     <div class="ac-entity-list__results" tabindex="-1"> the focus target of H4
//       <div data-card-grid | data-slots | data-list>     the active view only (V1, V8)
//       | EmptyState                                       no results (V7) or no data (PR5)
//     Pagination                                           real links (H6, P-28)
//
// PR4. The inline script is printed by this component so it runs as the first thing
// inside the root, before any row is parsed: the root exists already, so the attribute
// lands on it before the first paint. It sits in a hidden `span` through `innerHTML`, which
// the browser runs while it parses the prerendered HTML and never again: React does not
// create a live `<script>` on the client, and a remounted list does not run it twice. The
// root keeps the attribute through the hydration (`suppressHydrationWarning` covers that
// one attribute of this element), and a layout effect takes it off, before the paint, in
// the render that shows the applied state.
//
// Pagination (H6, WG5). Every page is an `<a href>` with the canonical URL of that page,
// so the links work before the island hydrates and in a new tab; a plain click is
// intercepted, becomes a `pushState` (H1) and then moves the focus to the results (H4).
//
// Every visible text arrives by props (DP1): `labels` is `ui` of the page's locale, and
// `count` and `empty` are written by the root.
//
// The order (V6). A list with more than one order has a `SortSelect` in the bar, which its
// root composes (`sort`) with the controller's `state.sort` and `setSort` and the label of
// its own namespace, and this component places before the `ViewToggle`. It is not imported
// here: most lists have one order (8.0.6), and every island would otherwise carry `Select`
// in its initial JavaScript (13.6), the Pokédex included.

/** H7: where the focus goes inside an anchored element — the title, the slot, the name. */
const ANCHOR_TRIGGER =
  '[data-zone="head"] a[href], [data-zone="head"] button, .ac-list-row__name a[href], .ac-list-row__name button';
const ANY_TRIGGER = 'a[href], button';
/**
 * H7: an anchored card (`article[data-anat]`, 7.6.2). Only the link or button of its title is
 * its trigger: an entity nested in its facts — the one Pokémon of «Drop de», an element — is
 * another entity, and focusing it would open that entity's panel (7.5.10).
 */
const ANCHORED_CARD = '[data-anat]';

export interface EntityListLabels {
  /** `ui.views`: the name of the group and the text of each view. */
  views: ViewToggleLabels & { label: string };
  /** `ui.pagination`: the name of the `nav`. */
  pagination: string;
  /** `ui.prev`, `ui.next` and `ui.page` (the prefix of each number's name). */
  prev: string;
  next: string;
  page: string;
  /** `ui.dataError`: «No se pudieron cargar los datos.» / «Couldn't load the data.» (PR5). */
  dataError: string;
}

export interface EntityListProps<T> {
  /** What `useListState` returned for this list. */
  controller: ListController<T>;
  labels: EntityListLabels;
  /** The count of the results, pluralised by the root: «910 variantes» (H5). */
  count: (total: number, state: ListState) => ReactNode;
  /**
   * V7: the `EmptyState` that takes the place of the view when nothing matches — «Sin
   * resultados para «q».» with a query, the text of the list's section without one.
   */
  empty: (state: ListState) => ReactNode;
  /** The three views. Only the active one is called and mounted (V1). */
  views: Record<EntityView, (page: ListPage<T>) => ReactNode>;
  /** Search row, type tabs and `FilterBar`, above the results bar (V6). */
  controls?: ReactNode;
  /**
   * The `SortSelect` of a list with more than one order, bound to `controller.state.sort`
   * and `controller.setSort` (V6). Required then; a list with one order has none.
   */
  sort?: ReactNode;
  /** Name of the view group when the page has another list («Vista de drops»). */
  viewLabel?: string;
  /** Name of the pagination when the page has another one. */
  paginationLabel?: string;
  /** `center` under the Pokédex (8.2). */
  paginationAlign?: 'start' | 'center';
  /** Utilities added by the caller, after the component's class (3.8). */
  className?: string;
}

export function EntityList<T>({
  controller,
  labels,
  count,
  empty,
  views,
  controls,
  sort,
  viewLabel,
  paginationLabel,
  paginationAlign = 'start',
  className,
}: EntityListProps<T>) {
  const { config, state, page, ready, failed } = controller;
  const rootRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const sorted = config.sorts.length > 1;
  if (sorted && (sort === undefined || sort === null)) {
    throw new Error(
      `EntityList(${config.id}): a list with several orders needs its \`sort\` (V6).`,
    );
  }

  const script = useMemo(
    () => pendingScript(config, controller.defaultPageCount),
    [config, controller.defaultPageCount],
  );

  // PR4: the state is applied and its rows are loaded, so the root shows again.
  useLayoutEffect(() => {
    if (ready) rootRef.current?.removeAttribute(PENDING_ATTRIBUTE);
  }, [ready]);

  // H7: the fragment names an element of the active view once the state is applied.
  const anchored = useRef(false);
  useLayoutEffect(() => {
    if (anchored.current || !ready) return;
    anchored.current = true;
    const raw = window.location.hash.slice(1);
    if (raw === '') return;
    let id = raw;
    try {
      id = decodeURIComponent(raw);
    } catch {
      // A malformed escape is looked up as written.
    }
    const target = document.getElementById(id);
    if (target === null || !resultsRef.current?.contains(target)) return;
    target.scrollIntoView({ block: 'start' });
    // The `li` of a slot and the name of a family row hold their trigger inside; a card never
    // falls back to the first trigger of its facts.
    const trigger =
      target.querySelector<HTMLElement>(ANCHOR_TRIGGER) ??
      (target.matches(ANCHORED_CARD) ? null : target.querySelector<HTMLElement>(ANY_TRIGGER));
    if (trigger !== null) {
      trigger.focus({ preventScroll: true });
      return;
    }
    // An element with no link or button of its own — the card of an item without a page, whose
    // title is text and which opens nothing (7.5.10) — takes the focus itself, out of the tab
    // order (SI5, IT5).
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  }, [ready]);

  // H4: after a page change the results take the focus and come 16 px under the header.
  const focusPage = useRef<number | null>(null);
  useLayoutEffect(() => {
    const wanted = focusPage.current;
    if (wanted === null || !ready || page.state.page !== wanted) return;
    focusPage.current = null;
    const results = resultsRef.current;
    if (results === null) return;
    results.focus({ preventScroll: true });
    results.scrollIntoView({ block: 'start' });
  });

  function onPage(target: number, event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    if (target === page.state.page) return;
    focusPage.current = target;
    controller.goToPage(target);
  }

  // V8: the container of the active view carries its attribute, which the grid CLS of 13.6
  // measures; the other two do not exist (V1).
  const view = page.state.view;
  let results: ReactNode;
  if (failed) results = <EmptyState>{labels.dataError}</EmptyState>;
  else if (page.total === 0) results = empty(page.state);
  else {
    results = (
      <div
        data-card-grid={view === 'cards' ? '' : undefined}
        data-slots={view === 'slots' ? '' : undefined}
        data-list={view === 'list' ? '' : undefined}
      >
        {views[view](page)}
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className={className ? `ac-entity-list ${className}` : 'ac-entity-list'}
      data-ac-list={config.id}
      suppressHydrationWarning
    >
      <span hidden dangerouslySetInnerHTML={{ __html: `<script>${script}</script>` }} />
      {controls}
      <div className="ac-entity-list__bar">
        {failed ? null : <Count>{count(page.total, page.state)}</Count>}
        <div className="ac-entity-list__tools">
          {sorted ? sort : null}
          <ViewToggle
            labels={labels.views}
            ariaLabel={viewLabel ?? labels.views.label}
            value={state.view}
            options={config.views}
            onChange={(next) => controller.setView(next)}
          />
        </div>
      </div>
      <div ref={resultsRef} className="ac-entity-list__results" tabIndex={-1}>
        {results}
      </div>
      {failed || page.total === 0 ? null : (
        <Pagination
          page={page.state.page}
          pageCount={page.pageCount}
          hrefFor={controller.hrefFor}
          onPage={onPage}
          labels={{ prev: labels.prev, next: labels.next, page: labels.page }}
          ariaLabel={paginationLabel ?? labels.pagination}
          align={paginationAlign}
        />
      )}
    </div>
  );
}
