import '@/styles/components/tier-badge.css';
import '@/styles/components/tier-rows.css';

import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import type { DexCardDrop, DexCardEntry } from '@/components/cards/DexCard';
import { EmptyState } from '@/components/content/EmptyState';
import type { ElementChipEntry } from '@/components/game/ElementChip';
import { FilterToolbar } from '@/components/filters/FilterToolbar';
import { PerPageSelect } from '@/components/filters/PerPageSelect';
import { filterText } from '@/components/filters/text';
import type { FilterText } from '@/components/filters/text';
import { TierTip, hasTierTip } from '@/components/filters/TierTip';
import { EntitySlot } from '@/components/game/EntitySlot';
import { EntityList } from '@/components/lists/EntityList';
import type { EntityListLabels } from '@/components/lists/EntityList';
import { useListState } from '@/components/lists/useListState';
import type { ListController } from '@/components/lists/useListState';
import {
  decodePokedex,
  decodeRefs,
  pokedexFilterDefs,
  type PokedexData,
  type PokedexRow,
  type PokedexRows,
} from '@/components/pokedex/config';
import type * as ViewsModule from '@/components/pokedex/PokedexViews';
import { tiersConfig, tiersRows, type TiersIds } from '@/components/tiers/config';
import type { Locale } from '@/i18n/config';
import type { Messages } from '@/i18n/messages/en';
import type { MessageLeaf } from '@/i18n/messages/types';
import { fill, isPluralMessage, plural } from '@/i18n/messages/types';
import { dexLayout } from '@/lib/cards/layout';
import type { DexLayout } from '@/lib/cards/layout';
import { formatTier } from '@/lib/content/format';
import { resolvePokemonImage } from '@/lib/content/pokemon-media';
import { formatInteger } from '@/lib/format/numbers';
import { usePanels } from '@/lib/game/panels';
import { withTipLabels, type ListUi } from '@/lib/game/tip-labels';
import { pageSizeOf, perPageSpec } from '@/lib/lists/state';
import type { EntityView, ListPage, ListState } from '@/lib/lists/state';
import type { SpriteData } from '@/lib/sprites/resolve';

// TiersRoot (spec 7.3, 7.7, 8.0.6, 8.8): the island of the `tiers` list, the Tier list of
// `/{l}/pokedex/tiers/`. It has no board of its own: the bar and the three views are the
// ones of `Lienzo:Pokedex` and the groups the `DS:CardGroup` of `Lienzo:Tarjetas`. It owns
// what 7.7.1 leaves to a list root — the filters, the three views and the texts of the
// results bar — and hands the rest to `useListState` and `EntityList`, as the Pokédex does.
// The `ListConfig` and the order of the rows live in ./config.ts, which the build shares.
//
// Data (PR5). The Tier list reads the rows of the Pokédex, `/{l}/pokedex/datos.json`, and
// keeps the ones with a tier, in tier order (`tiersRows`). The page prerenders the first
// page of the default state and the props carry only its rows, in the shape of that file,
// with the drops of that page already written with their panels (DP3), as on the Pokédex.
// Every text arrives by props (DP1): `ui` and `pokedex` of the page's locale, because the
// bar, the filters, the count, the empty state and the columns of the Lista are the ones of
// 8.2 (8.8 steps 3 to 5).
//
// Elements. A page of 48 variants names most of the 18 elements, and their panels in the
// props would take the island over its 20 KB (13.6). So the props bring only the icons of
// the elements of the first page (`icons`), and their chips are drawn from the name and the
// icon; the panels are built with `elementTip` (7.5.3, PR5: «TipData se construye en el
// cliente») when `datos.json` and the deferred part below are here, the moment every chip
// whose element has Stone or Fragment becomes its trigger (R2). The static chip and the
// trigger have the same geometry (element-chip.css), so nothing moves.
//
// Filters (§16.4.3, plan «Dirección C»): the `FilterToolbar` of the Pokédex without the search
// and without «Tier»: the rows are the tiers. A filter with fewer than two values is not drawn
// (C-R5).
//
// «Slots» (default, §16.4.3) is the classic tier list: one row per visible tier, best first,
// and every filtered Pokémon with no pages; Lista has the rows per page of U7. A hidden tier
// (ULTIMATE for now) is no row (`tiersRows`).
//
// Views (7.7.4, 8.8 step 5). The page is cut first and grouped by tier after (CGS 2.1):
//   - Slots: the classic tier list (`tierRows`), one row per visible tier, best first.
//   - Lista: one `DataTable` with the caption «Tier list» — the h1 — and the columns of 8.2,
//     from the same deferred views; its Tier column names the group of each row.
//   Both views show the same variants and, inside each tier, in the same order
//   (TL4, S4), because they all read the same page. Every view gives each row the anchor
//   `pokemon-{id}` (H7).

/** Cards and slots from this index of the page on load their art lazily (7.4.2). */
const EAGER_ART = 4;

export interface TiersRootProps {
  /** Picks the format of the figures and the order of the names (C-R3, 8.0.5). */
  locale: Locale;
  /** `/es/pokedex/tiers/`: the base of every page link (H6). A prerendered page has no query (PR2). */
  path: string;
  /** `/es/pokedex/datos.json`: every row of the Pokédex, which this list narrows (PR5). */
  dataUrl: string;
  /** The first page of the default state, in the shape of `datos.json` and in tier order (PR5). */
  data: PokedexRows;
  /** Rows of the whole list: the variants with a tier. */
  total: number;
  /** The values each filter accepts, read from the rows with a tier (`TiersIds`). */
  ids: TiersIds;
  /** The icons of the elements of `data` that have one, by id (`tierIcons`). */
  icons: Readonly<Record<string, SpriteData>>;
  /**
   * The items the rows of `data` drop, by id, as the zone «Drops» of `DexCard` takes them,
   * panels included (DP3). The other pages' items come in `refs` (PR5).
   */
  drops: Readonly<Record<string, DexCardDrop>>;
  /** «Tier list», the h1: the name of the Slots panel and the caption of the Lista (8.8). */
  title: string;
  /** `messages.ui` of the page's locale: the components' texts, the card texts in `cards`. */
  ui: ListUi<Messages['ui']>;
  /**
   * `messages.pokedex` of the page's locale: the texts of 8.2 this list shares (8.8) — the
   * label and first option of each filter, the count by Variante, the empty state and the
   * fixed column headers of the Lista.
   */
  pokedex: Messages['pokedex'];
}

/** A row as `DexCard` reads it (8.0.5, 8.2): the registry values, already written. */
function dexEntry(
  row: PokedexRow,
  locale: Locale,
  elements: readonly ElementChipEntry[],
  drops: ReadonlyMap<string, DexCardDrop>,
): DexCardEntry {
  return {
    name: row.nombre,
    href: `/${locale}/pokedex/${row.id}/`,
    number: row.numero,
    generation: row.generacion,
    art: resolvePokemonImage(row.imagen),
    level: row.nivel,
    tier: row.tier === null ? null : formatTier(row.tier),
    role: row.funcion,
    variant: row.variante === 'shiny' || row.variante === 'normal' ? row.variante : null,
    elements,
    drops: row.drops?.flatMap((id) => drops.get(id) ?? []),
  };
}

/** The elements of a row, in the order of its record (the order of `Lienzo:Pokedex`). */
function rowElements(
  row: PokedexRow,
  byId: ReadonlyMap<string, ElementChipEntry>,
): ElementChipEntry[] {
  return row.elementos.flatMap((id) => {
    const element = byId.get(id);
    return element === undefined ? [] : [element];
  });
}

/**
 * The chip of an element before its panel is built (see «Elements»): the entry `elementTip`
 * writes for an element without Stone and Fragment, whose panel has no row, so `ElementChip`
 * draws it as a static chip and reads nothing else of it (R2).
 */
function staticElement(id: string, name: string, icon: SpriteData | null): ElementChipEntry {
  return {
    id,
    name,
    icon,
    tip: {
      key: `elemento:${id}`,
      title: name,
      width: 240,
      head: { type: 'icon', sprite: icon },
      rows: [],
    },
  };
}

/** A plural or a plain template, filled with the figure already formatted (13.2, 13.3). */
function counted(template: MessageLeaf, n: number, locale: Locale): string {
  const chosen = isPluralMessage(template) ? plural(locale, n, template) : template;
  return fill(chosen, { n: formatInteger(n, locale) });
}

/** The title of a tier group: the tier of its rows, which all share it (8.8). */
function groupTitle(rows: readonly PokedexRow[]): string {
  return formatTier(rows[0]?.tier);
}

interface TierLabelProps {
  tierKey: string;
  name: string;
  count: string;
  maxBrokes: number | null;
  text: FilterText;
}

/**
 * The label cell of a tier row (plan board Tier-list): the tier's name with a dotted underline
 * over the count, on the row colour of its tier; hover or focus shows the tier tooltip at its
 * right («LEGENDARY · Max brokes: 3»). While the «Max brokes» is unknown the tooltip would only
 * repeat the name, so the label is plain text: no button, no underline.
 */
function TierLabel({ tierKey, name, count, maxBrokes, text }: TierLabelProps) {
  const tipId = useId();
  if (!hasTierTip(maxBrokes))
    return (
      <h2 className={`ac-tier-rows__label ac-tier-rows__label--${tierKey}`}>
        <span className="ac-tier-rows__trigger ac-tier-rows__trigger--plain">
          <span className="ac-tier-rows__name">{name}</span>
          <span className="ac-tier-rows__count">{count}</span>
        </span>
      </h2>
    );
  return (
    <h2 className={`ac-tier-rows__label ac-tier-rows__label--${tierKey}`}>
      <button type="button" className="ac-tier-rows__trigger" aria-describedby={tipId}>
        <span className="ac-tier-rows__name">{name}</span>
        <span className="ac-tier-rows__count">{count}</span>
        <TierTip
          id={tipId}
          name={name}
          maxBrokes={maxBrokes}
          label={text.maxBrokes}
          placement="right"
        />
      </button>
    </h2>
  );
}

// --------------------------------------------------------------------- the deferred part
//
// The Slots and Lista views, the panels of the elements and of an item the props did not
// bring and the button of the `EmptyState` are the deferred views of the Pokédex
// (../pokedex/PokedexViews.tsx): the same `import()`, so the same chunk of 13.6, and the
// initial JS of this page carries only the Cards view. It is asked for as soon as the island
// is idle after hydrating, and at once when the state of the URL or the saved view needs it
// (PR4): until it is here the root is not `ready`, so it keeps `data-ac-pending` and nothing
// of the default state shows. A chunk that does not load is the data error of PR5.

let deferred: typeof ViewsModule | undefined;
let request: Promise<void> | undefined;

function loadDeferred(): Promise<void> {
  request ??= import('@/components/pokedex/PokedexViews').then(
    (module) => {
      deferred = module;
    },
    (error: unknown) => {
      // A chunk that failed is asked for again the next time the state needs it.
      request = undefined;
      throw error;
    },
  );
  return request;
}

export function TiersRoot({
  locale,
  path,
  dataUrl,
  data,
  total,
  ids,
  icons,
  drops,
  title,
  ui,
  pokedex,
}: TiersRootProps) {
  // `refs` of `datos.json` and every row of it, taken when they arrive (PR5): the «Drop de»
  // of an item is the inverse of the `drops` of every Pokémon, the ones without a tier too.
  const [refs, setRefs] = useState<(PokedexData['refs'] & { rows: PokedexRow[] }) | null>(null);
  // A tier the registry hides (ULTIMATE for now) is no row of this list (`tiersRows`).
  const decode = useCallback(
    (json: unknown) => {
      const rows = decodePokedex(json);
      setRefs({ ...decodeRefs(json), rows });
      return tiersRows(rows, ids.tierMeta);
    },
    [ids.tierMeta],
  );
  const config = useMemo(() => tiersConfig(dataUrl, ids, locale), [dataUrl, ids, locale]);
  const items = useMemo(() => tiersRows(decodePokedex(data), ids.tierMeta), [data, ids.tierMeta]);
  const controller = useListState(config, { items, total, decode, path });
  const page = controller.page;
  const shown = page.items;
  const filters = controller.state.filters;
  const view = page.state.view;

  // Elements and drops. The first page draws the static chips of its elements (see
  // «Elements») and the drops of the props, panels included (DP3). Once `refs` and the
  // deferred part are here, every element and every other item gets its panel, built with
  // `elementTip` or `itemTip` (7.5.3). The name of an element, for the filter, the chip and
  // the Pokémon panel, is always in `ids`.
  const later = deferred;
  const names = useMemo(() => new Map(ids.elements), [ids]);
  // The rest of every panel (`/{l}/paneles.json`) and the labels of its rows, once here.
  const panels = usePanels(locale);
  const tipUi = useMemo(
    () => (panels === null ? ui : { ...ui, tooltip: withTipLabels(ui.tooltip, panels.etiquetas) }),
    [ui, panels],
  );
  const [byId, byItem] = useMemo(() => {
    const own = new Map<string, ElementChipEntry>();
    for (const id of new Set(items.flatMap((row) => row.elementos))) {
      const name = names.get(id);
      if (name !== undefined) own.set(id, staticElement(id, name, icons[id] ?? null));
    }
    const dropped = new Map(Object.entries(drops));
    if (refs !== null && later !== undefined) {
      const labels = tipUi.tooltip;
      for (const [id, ref] of Object.entries(refs.elementos))
        own.set(id, later.elementEntry(id, ref, locale, labels, panels?.elementos[id]));
      for (const [id, ref] of Object.entries(refs.items))
        if (!dropped.has(id) || panels !== null)
          dropped.set(id, later.itemEntry(id, ref, refs.rows, locale, labels, panels?.items[id]));
    }
    return [own, dropped] as const;
  }, [items, names, icons, drops, refs, later, locale, tipUi, panels]);
  const elementsOf = (row: PokedexRow) => rowElements(row, byId);

  // Whether the state needs the deferred part (see above), and whether it is here.
  const absent =
    later === undefined &&
    (view === 'list' ||
      page.total === 0 ||
      (view === 'cards' &&
        shown.some(
          (row) =>
            row.elementos.some((id) => !byId.has(id) && refs?.elementos[id]) ||
            row.drops?.some((id) => !byItem.has(id) && refs?.items[id]),
        )));
  const [, setLoaded] = useState(0);
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    if (!absent) return undefined;
    let live = true;
    loadDeferred().then(
      () => {
        if (!live) return;
        setBroken(false);
        setLoaded((count) => count + 1);
      },
      () => {
        if (live) setBroken(true);
      },
    );
    return () => {
      live = false;
    };
  }, [absent]);
  useEffect(() => {
    let live = true;
    const prefetch = () => {
      // Loaded on idle, the chunk still has to reach the render: the first page's element
      // chips take their panels from it (see «Elements»).
      loadDeferred().then(
        () => {
          if (live) setLoaded((count) => count + 1);
        },
        () => {},
      );
    };
    if (typeof window.requestIdleCallback === 'function') {
      const handle = window.requestIdleCallback(prefetch);
      return () => {
        live = false;
        window.cancelIdleCallback(handle);
      };
    }
    const handle = window.setTimeout(prefetch);
    return () => {
      live = false;
      window.clearTimeout(handle);
    };
  }, []);
  let list: ListController<PokedexRow> = controller;
  if (absent) list = broken ? { ...controller, failed: true } : { ...controller, ready: false };

  const anchor = (row: PokedexRow) => config.anchorId?.(row);

  // The union of the page (7.6.3), a `useMemo` over the page after filtering and paginating:
  // the columns of the Lista.
  const pageLayout: DexLayout = useMemo(
    () => dexLayout(page.items.map((row) => dexEntry(row, locale, rowElements(row, byId), byItem))),
    [page, locale, byId, byItem],
  );

  const lazy = (index: number) => (index >= EAGER_ART ? 'lazy' : undefined);
  const context: ViewsModule.PokedexViewContext = {
    locale,
    ui: tipUi,
    panels,
    pokedex,
    title,
    names,
    layout: pageLayout,
    elementsOf,
    anchor,
    lazy,
    // Lista: one table whatever the Variante, with the caption «Tier list» (8.8 step 5).
    caption: title,
  };

  // §16.4.3 and the plan's board Tier-list: the classic tier list, one row per visible tier best
  // first, the label cell (`TierLabel`) on the row colour of its tier and the Pokémon slots
  // flowing right. Every filtered row, no pages; the art from the fifth slot on loads lazily.
  // The Pokémon panel comes with the deferred part.
  const tierRows = (current: ListPage<PokedexRow>): ReactNode => {
    let position = 0;
    return (
      <div className="ac-tier-rows">
        {current.groups.map((group) => (
          <section
            key={group.key}
            className="ac-tier-rows__row"
            aria-label={groupTitle(group.items)}
          >
            <TierLabel
              tierKey={group.key}
              name={groupTitle(group.items)}
              count={formatInteger(group.items.length, locale)}
              maxBrokes={ids.tierMeta[group.key]?.maxBrokes ?? null}
              text={text}
            />
            <ul className="ac-tier-rows__slots">
              {group.items.map((row) => {
                const source = resolvePokemonImage(row.imagen);
                const index = position;
                position += 1;
                return (
                  <li key={row.id} id={anchor(row)}>
                    <EntitySlot
                      size={72}
                      name={row.nombre}
                      sprite={
                        source === null ? null : { src: source, smooth: true, loading: lazy(index) }
                      }
                      art
                      tip={later?.tipOf(row, context)}
                      shiny={row.variante === 'shiny'}
                      href={`/${locale}/pokedex/${row.id}/`}
                      locale={locale}
                      hint={ui.pinHint}
                      shinyLabel={ui.shiny}
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    );
  };

  // The Tier list has no Cards view (plan board Tier-list): `views` of its config leave it out.
  const views: Record<EntityView, (current: ListPage<PokedexRow>) => ReactNode> = {
    cards: () => null,
    slots: tierRows,
    list: (current) => later?.pokedexList(current, context) ?? null,
  };

  // `ui` carries every text of `EntityListLabels` under the same keys (13.2).
  const labels: EntityListLabels = ui;

  // 8.8 step 4: the count of 8.2, which follows Variante; `n` is the filtered total of the
  // variants with a tier, not the page's.
  const count = (n: number, state: ListState) => {
    const chosen = state.filters.variante;
    const template =
      chosen === 'shiny'
        ? pokedex.countShiny
        : chosen === 'normal'
          ? pokedex.countNormal
          : pokedex.count;
    return counted(template, n, locale);
  };

  // ------------------------------------------------------------------------------ filters
  // Plan «Dirección C» (board Tier-list): the filter buttons of the Pokédex without the search
  // and without «Tier» — the rows are the tiers — and the active filter tokens under them.
  const text = useMemo(() => filterText(ui), [ui]);
  const filterDefs = useMemo(
    () =>
      pokedexFilterDefs(
        ids,
        { ...pokedex.filters, normal: ui.cards.normal, shiny: ui.shiny },
        text,
      ),
    [ids, pokedex.filters, ui.cards.normal, ui.shiny, text],
  );
  const controls = (
    <FilterToolbar
      filters={filterDefs}
      values={filters}
      onChange={controller.setFilter}
      onClearAll={controller.clearFilters}
      text={text}
      count={count(page.total, page.state)}
    />
  );
  // U7: only Lista has pages (25/50/100); the tier rows draw every row.
  const perPage = (
    <PerPageSelect
      label={text.perPage}
      spec={perPageSpec(config, view)}
      value={pageSizeOf(config, page.state)}
      onChange={controller.setPerPage}
    />
  );

  // V7 and 8.8: with no match the bar stays and the one action goes back to the whole list.
  const empty = () =>
    later === undefined ? null : (
      <EmptyState action={later.clearFilters(path, pokedex.clearFilters)}>
        {pokedex.empty}
      </EmptyState>
    );

  return (
    <EntityList
      controller={list}
      labels={labels}
      count={count}
      empty={empty}
      views={views}
      controls={controls}
      perPage={perPage}
      paginationAlign="center"
    />
  );
}
