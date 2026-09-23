import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { CardGrid } from '@/components/cards/CardGrid';
import { DexCard } from '@/components/cards/DexCard';
import type { DexCardDrop, DexCardEntry, DexCardLabels } from '@/components/cards/DexCard';
import { EmptyState } from '@/components/content/EmptyState';
import { FilterBar } from '@/components/controls/FilterBar';
import { Select } from '@/components/controls/Select';
import type { SelectOption } from '@/components/controls/Select';
import { ToggleGroup } from '@/components/controls/ToggleGroup';
import type { ToggleGroupOption } from '@/components/controls/ToggleGroup';
import type { ElementChipEntry } from '@/components/game/ElementChip';
import { EntityList } from '@/components/lists/EntityList';
import type { EntityListLabels } from '@/components/lists/EntityList';
import { useListState } from '@/components/lists/useListState';
import type { ListController } from '@/components/lists/useListState';
import {
  decodePokedex,
  decodeRefs,
  pokedexConfig,
  type PokedexData,
  type PokedexIds,
  type PokedexOption,
  type PokedexRow,
  type PokedexRows,
} from '@/components/pokedex/config';
import type * as ViewsModule from '@/components/pokedex/PokedexViews';
import type { Locale } from '@/i18n/config';
import type { Messages } from '@/i18n/messages/en';
import type { MessageLeaf } from '@/i18n/messages/types';
import { fill, isPluralMessage, plural } from '@/i18n/messages/types';
import { dexLayout } from '@/lib/cards/layout';
import type { DexLayout } from '@/lib/cards/layout';
import { formatTier } from '@/lib/content/format';
import { resolvePokemonImage } from '@/lib/content/pokemon-media';
import { formatInteger } from '@/lib/format/numbers';
import type { EntityView, ListPage, ListState } from '@/lib/lists/state';

// PokedexRoot (spec 7.3, 7.7, 8.0.6, 8.2; `Lienzo:Pokedex`): the island of the `pokedex`
// list. It owns what 7.7.1 leaves to a list root — the filters, the three views and the
// texts of the results bar — and hands the rest to `useListState` and `EntityList`. The
// `ListConfig`, the shape of the data and its decoder live in ./config.ts, which the build
// shares.
//
// Data (PR5). The page prerenders the first page of the default state, and the props carry
// only its rows, in the shape of `/{l}/pokedex/datos.json`; the island asks for that file
// when it hydrates, so a filter, a view or a page that needs other rows has them. A row is
// a record of `content/pokemon.json` with the registry's own keys (3.13); the labels are
// not in it, they arrive by props (DP1). The elements and the dropped items are in the
// `refs` of the file; the props only bring the ones of the first page, already written with
// their panels.
//
// Filters (8.2 step 3): `FilterBar layout="fill"` with the selects «Generación», «Tier» and
// «Elemento» and the toggle group «Variante», whose values are the ids of `ids` (U3). Each
// one acts on change through the controller (H1, H3); there is no «Aplicar» and no search
// field (E3, A22). A filter with fewer than two values narrows nothing and is not drawn
// (C-R5).
//
// Views (7.7.4):
//   - Cards: `CardGrid family="pokedex"` of `DexCard`, titles `h2` under the h1 (7.6.2), the
//     layout the union of the page (`dexLayout`, 7.6.3), the element chips and the drops of
//     each entry — the zone «Drops» only when an entry of the page has one (8.2 step 5) — and
//     the art lazy from the fifth card on (7.4.2). The list is not grouped here (8.0.6).
//   - Slots and Lista: ./PokedexViews.tsx, the deferred part of the island (see below).
//   Every view gives each row the anchor `pokemon-{id}` (H7).

/** Cards and slots from this index on load their art lazily (7.4.2). */
const EAGER_ART = 4;

export interface PokedexRootProps {
  /** Picks the format of the figures and the order of the names (C-R3, 8.0.5). */
  locale: Locale;
  /** `/es/pokedex/`: the base of every page link (H6). A prerendered page has no query (PR2). */
  path: string;
  /** `/es/pokedex/datos.json`: every row of the list (PR5). */
  dataUrl: string;
  /** The first page of the default state, in the shape of `datos.json` (PR5). */
  data: PokedexRows;
  /** Rows of the whole list. */
  total: number;
  /** The values each filter accepts, with the registry's text for each one. */
  ids: PokedexIds;
  /**
   * The elements of the rows of `data`, as `ElementChip` takes them, panels included (DP3):
   * the ones the prerendered page and the hydration draw. The rest come in `refs` (PR5).
   */
  elements: readonly ElementChipEntry[];
  /**
   * The items the rows of `data` drop, by id, as the zone «Drops» of `DexCard` takes them,
   * panels included (DP3). The other pages' items come in `refs` (PR5).
   */
  drops: Readonly<Record<string, DexCardDrop>>;
  /** «Pokédex», the name of the page: the name of the Slots panel. */
  title: string;
  /** `messages.ui` of the page's locale: the components' texts, the card texts in `cards`. */
  ui: Messages['ui'];
  /**
   * `messages.pokedex` of the page's locale (8.2): the label and the first option of each
   * filter, the count by Variante, the empty state, and the captions and fixed column headers
   * of the Lista.
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

/** A plural or a plain template, filled with the figure already formatted (13.2, 13.3). */
function counted(template: MessageLeaf, n: number, locale: Locale): string {
  const chosen = isPluralMessage(template) ? plural(locale, n, template) : template;
  return fill(chosen, { n: formatInteger(n, locale) });
}

/** The first option, which leaves the filter open («Todas», «Todos»), then the registry's. */
function selectOptions(all: string, options: readonly PokedexOption[]): SelectOption[] {
  return [{ value: '', label: all }, ...options.map(([value, label]) => ({ value, label }))];
}

// --------------------------------------------------------------------- the deferred part
//
// Cards is the view the page prerenders and hydrates, so its pieces are part of the island.
// The rest is only drawn when the state asks for it, so it lives in ./PokedexViews.tsx and
// loads as one deferred chunk of 13.6 (`import()`), which keeps the initial JS of the page
// within its budget: the Slots and Lista views with their components and the Pokémon panel
// they open, the panel of an element the props did not bring (see «Elements» in the
// component) and the button of the `EmptyState` that only a filter with no match shows (the
// `EmptyState` itself is part of `EntityList`). It is asked for as soon as the island is
// idle after hydrating, so a switch finds it ready, and at once when the state of the URL or
// the saved view needs it (PR4): until it is here the root is not `ready`, so it keeps
// `data-ac-pending` and nothing of the default state shows. A chunk that does not load is
// the data error of PR5.

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

export function PokedexRoot({
  locale,
  path,
  dataUrl,
  data,
  total,
  ids,
  elements,
  drops,
  title,
  ui,
  pokedex,
}: PokedexRootProps) {
  // `refs` of `datos.json` and its rows, taken when they arrive (PR5): the rows give the
  // «Drop de» of an item, the inverse of their `drops`.
  const [refs, setRefs] = useState<(PokedexData['refs'] & { rows: PokedexRow[] }) | null>(null);
  const decode = useCallback((json: unknown) => {
    const rows = decodePokedex(json);
    setRefs({ ...decodeRefs(json), rows });
    return rows;
  }, []);
  const config = useMemo(() => pokedexConfig(dataUrl, ids), [dataUrl, ids]);
  const items = useMemo(() => decodePokedex(data), [data]);
  const controller = useListState(config, { items, total, decode, path });
  const shown = controller.page.items;
  const filters = controller.state.filters;
  const view = controller.page.state.view;

  // Elements and drops. The props bring the chips of the elements and the drops of the first
  // page, panels included, built in the build (DP3): that is all the prerendered page and the
  // hydration draw. Every other element and item comes in `refs` with the rows, and its panel
  // is built with `elementTip` or `itemTip` (7.5.3) once the deferred part is here. The name
  // of an element, for the filter and for the Pokémon panel, is always in `ids`.
  const later = deferred;
  const names = useMemo(() => new Map(ids.elements), [ids]);
  const [byId, byItem] = useMemo(() => {
    const own = new Map(elements.map((element) => [element.id, element]));
    const dropped = new Map(Object.entries(drops));
    if (refs !== null && later !== undefined) {
      for (const [id, ref] of Object.entries(refs.elementos))
        if (!own.has(id)) own.set(id, later.elementEntry(id, ref, locale, ui.tooltip));
      for (const [id, ref] of Object.entries(refs.items))
        if (!dropped.has(id))
          dropped.set(id, later.itemEntry(id, ref, refs.rows, locale, ui.tooltip));
    }
    return [own, dropped] as const;
  }, [elements, drops, refs, later, locale, ui.tooltip]);
  const elementsOf = (row: PokedexRow) => rowElements(row, byId);

  // Whether the state needs the deferred part (see above), and whether it is here.
  const absent =
    later === undefined &&
    (view !== 'cards' ||
      controller.page.total === 0 ||
      shown.some(
        (row) =>
          row.elementos.some((id) => !byId.has(id) && refs?.elementos[id]) ||
          row.drops?.some((id) => !byItem.has(id) && refs?.items[id]),
      ));
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
    const prefetch = () => {
      loadDeferred().catch(() => {});
    };
    if (typeof window.requestIdleCallback === 'function') {
      const handle = window.requestIdleCallback(prefetch);
      return () => window.cancelIdleCallback(handle);
    }
    const handle = window.setTimeout(prefetch);
    return () => window.clearTimeout(handle);
  }, []);
  let list: ListController<PokedexRow> = controller;
  if (absent) list = broken ? { ...controller, failed: true } : { ...controller, ready: false };

  const anchor = (row: PokedexRow) => config.anchorId?.(row);

  // The union of the cards of the page (7.6.3): `useMemo` over the page after filtering,
  // sorting and paginating, the same call the build makes for a static grid. The Lista
  // takes its columns from it too.
  const layout: DexLayout = useMemo(
    () => dexLayout(shown.map((row) => dexEntry(row, locale, rowElements(row, byId), byItem))),
    [shown, locale, byId, byItem],
  );

  const dexLabels: DexCardLabels = {
    ...ui.cards,
    requirement: ui.tooltip.requirement,
    level: ui.tooltip.level,
    tier: ui.tooltip.tier,
    role: ui.tooltip.role,
    shiny: ui.shiny,
  };

  // ------------------------------------------------------------------------------ filters
  const text = pokedex.filters;
  const variantOptions: ToggleGroupOption[] = [
    { value: '', label: text.allVariants },
    ...ids.variants.map((variant): ToggleGroupOption =>
      variant === 'shiny'
        ? { value: variant, label: ui.shiny, sprite: 'shiny' }
        : { value: variant, label: ui.cards.normal },
    ),
  ];
  const select = (key: string, label: string, all: string, options: readonly PokedexOption[]) =>
    options.length > 1 ? (
      <Select
        label={label}
        options={selectOptions(all, options)}
        value={filters[key] ?? ''}
        onChange={(value) => controller.setFilter(key, value || null)}
      />
    ) : null;
  const controls = (
    <FilterBar layout="fill">
      {select(
        'gen',
        text.generation,
        text.allGenerations,
        ids.generations.map((n): PokedexOption => [n, fill(ui.cards.generation, { n })]),
      )}
      {select('tier', text.tier, text.allTiers, ids.tiers)}
      {select('elemento', text.element, text.allElements, ids.elements)}
      {ids.variants.length > 1 ? (
        <ToggleGroup
          label={text.variant}
          labelHidden={false}
          options={variantOptions}
          value={filters.variante ?? ''}
          onChange={(value) => controller.setFilter('variante', value || null)}
        />
      ) : null}
    </FilterBar>
  );

  const lazy = (index: number) => (index >= EAGER_ART ? 'lazy' : undefined);
  const viewContext: ViewsModule.PokedexViewContext = {
    locale,
    ui,
    pokedex,
    title,
    names,
    layout,
    elementsOf,
    anchor,
    lazy,
  };

  const views: Record<EntityView, (page: ListPage<PokedexRow>) => ReactNode> = {
    cards: (page) => (
      <CardGrid family="pokedex" headingLevel={2}>
        {page.items.map((row, index) => (
          <DexCard
            key={row.id}
            id={anchor(row)}
            entry={dexEntry(row, locale, elementsOf(row), byItem)}
            layout={layout}
            labels={dexLabels}
            locale={locale}
            hint={ui.pinHint}
            loading={lazy(index)}
          />
        ))}
      </CardGrid>
    ),
    slots: (page) => later?.pokedexSlots(page, viewContext) ?? null,
    list: (page) => later?.pokedexList(page, viewContext) ?? null,
  };

  // `ui` carries every text of `EntityListLabels` under the same keys (13.2).
  const labels: EntityListLabels = ui;

  // 8.2 step 4: the count follows Variante; `n` is the filtered total, not the page's.
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

  // V7 and 8.2: with no match the bar stays and the one action goes back to the whole list.
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
      paginationAlign="center"
    />
  );
}
