import '@/styles/components/tier-badge.css';
import '@/styles/components/tier-rows.css';

import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';

import { CardGrid } from '@/components/cards/CardGrid';
import { CardGroup } from '@/components/cards/CardGroup';
import { DexCard } from '@/components/cards/DexCard';
import type { DexCardDrop, DexCardEntry, DexCardLabels } from '@/components/cards/DexCard';
import { EmptyState } from '@/components/content/EmptyState';
import type { ElementChipEntry } from '@/components/game/ElementChip';
import { EntitySlot } from '@/components/game/EntitySlot';
import { EntityList } from '@/components/lists/EntityList';
import type { EntityListLabels } from '@/components/lists/EntityList';
import { useListState } from '@/components/lists/useListState';
import type { ListController } from '@/components/lists/useListState';
import {
  decodePokedex,
  decodeRefs,
  tierId,
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
// Filters (§16.4.3): the chips of the Pokédex (../pokedex/PokedexFilters.tsx) without «Tier»:
// the rows are the tiers. A filter with fewer than two values is not drawn (C-R5).
//
// «Ranuras» (default, §16.4.3) is the classic tier list: one row per tier, best first, and
// every filtered Pokémon with no pages; Cards and Lista keep 48 a page.
//
// Views (7.7.4, 8.8 step 5). The page is cut first and grouped by tier after (CGS 2.1):
//   - Cards: one `CardGroup level={2}` per tier of the page, titled with `formatTier` and
//     the number of its cards on this page, each with its `CardGrid family="pokedex"` of
//     `DexCard` whose titles are h3 (7.6.2). Each grid takes the union of its own cards
//     (7.6.3: the keys of a grid are the ones its cards have).
//   - Slots: `SlotsPanel layout="stacked"` with one group per tier, from the deferred
//     views of the Pokédex (../pokedex/PokedexViews.tsx), titled with the tier.
//   - Lista: one `DataTable` with the caption «Tier list» — the h1 — and the columns of 8.2,
//     from the same deferred views; its Tier column names the group of each row.
//   The three views show the same 48 variants and, inside each tier, in the same order
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
  ui: Messages['ui'];
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

/** The filter chips (§16.4.2), a chunk of their own that the server still renders (13.6). */
const PokedexFilters = lazy(() => import('@/components/pokedex/PokedexFilters'));

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
  const decode = useCallback((json: unknown) => {
    const rows = decodePokedex(json);
    setRefs({ ...decodeRefs(json), rows });
    return tiersRows(rows);
  }, []);
  const config = useMemo(() => tiersConfig(dataUrl, ids, locale), [dataUrl, ids, locale]);
  const items = useMemo(() => tiersRows(decodePokedex(data)), [data]);
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
  const [byId, byItem] = useMemo(() => {
    const own = new Map<string, ElementChipEntry>();
    for (const id of new Set(items.flatMap((row) => row.elementos))) {
      const name = names.get(id);
      if (name !== undefined) own.set(id, staticElement(id, name, icons[id] ?? null));
    }
    const dropped = new Map(Object.entries(drops));
    if (refs !== null && later !== undefined) {
      for (const [id, ref] of Object.entries(refs.elementos))
        own.set(id, later.elementEntry(id, ref, locale, ui.tooltip));
      for (const [id, ref] of Object.entries(refs.items))
        if (!dropped.has(id))
          dropped.set(id, later.itemEntry(id, ref, refs.rows, locale, ui.tooltip));
    }
    return [own, dropped] as const;
  }, [items, names, icons, drops, refs, later, locale, ui.tooltip]);
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

  // The union of the cards (7.6.3), a `useMemo` over the page after filtering and paginating:
  // one per tier group, the keys of each grid being the ones its own cards have, and one for
  // the whole page, the columns of the Lista.
  const [pageLayout, groupLayouts] = useMemo(() => {
    const layoutOf = (rows: readonly PokedexRow[]): DexLayout =>
      dexLayout(rows.map((row) => dexEntry(row, locale, rowElements(row, byId), byItem)));
    return [
      layoutOf(page.items),
      new Map(page.groups.map((group) => [group.key, layoutOf(group.items)])),
    ] as const;
  }, [page, locale, byId, byItem]);

  const dexLabels: DexCardLabels = {
    ...ui.cards,
    requirement: ui.tooltip.requirement,
    level: ui.tooltip.level,
    tier: ui.tooltip.tier,
    moveset: pokedex.moveset,
    role: ui.tooltip.role,
    shiny: ui.shiny,
  };

  // ------------------------------------------------------------------------------ filters
  const text = pokedex.filters;
  // §16.4.2 and §16.4.3: the chips of the Pokédex, several values each, without «Tier».
  const controls = (
    <Suspense fallback={null}>
      <PokedexFilters
        ids={ids}
        filters={filters}
        onChange={controller.setFilter}
        text={text}
        normalLabel={ui.cards.normal}
      />
    </Suspense>
  );

  const lazy = (index: number) => (index >= EAGER_ART ? 'lazy' : undefined);
  const context: ViewsModule.PokedexViewContext = {
    locale,
    ui,
    pokedex,
    title,
    names,
    layout: pageLayout,
    elementsOf,
    anchor,
    lazy,
    // Slots: one group per tier, titled with its tier (8.8 step 5).
    groupLabel: (group) => groupTitle(group.items),
    // Lista: one table whatever the Variante, with the caption «Tier list» (8.8 step 5).
    caption: title,
  };

  // The art is lazy from the fifth card of the page on, whatever its group (7.4.2).
  const cards = (current: ListPage<PokedexRow>): ReactNode => {
    const index = new Map(current.items.map((row, position) => [row.id, position]));
    return current.groups.map((group) => (
      <CardGroup
        key={group.key}
        label={groupTitle(group.items)}
        count={group.items.length}
        level={2}
        locale={locale}
      >
        <CardGrid family="pokedex">
          {group.items.map((row) => (
            <DexCard
              key={row.id}
              id={anchor(row)}
              entry={dexEntry(row, locale, elementsOf(row), byItem)}
              layout={groupLayouts.get(group.key) ?? pageLayout}
              labels={dexLabels}
              locale={locale}
              hint={ui.pinHint}
              loading={lazy(index.get(row.id) ?? 0)}
            />
          ))}
        </CardGrid>
      </CardGroup>
    ));
  };

  // §16.4.3: the classic tier list, one row per tier best first, the label cell in the colour
  // of its `TierBadge` and the Pokémon slots flowing right. Every filtered row, no pages; the
  // art from the fifth slot on loads lazily. The Pokémon panel comes with the deferred part.
  const tierRows = (current: ListPage<PokedexRow>): ReactNode => {
    let position = 0;
    return (
      <div className="ac-tier-rows">
        {current.groups.map((group) => {
          const tier = group.items[0]?.tier ?? null;
          const key = tierId(tier) ?? group.key;
          const cell = { '--tier-c': `var(--tier-${key})` } as CSSProperties;
          return (
            <section
              key={group.key}
              className="ac-tier-rows__row"
              aria-label={groupTitle(group.items)}
            >
              <div className="ac-tier-rows__label" style={cell}>
                <span className={`ac-tier-badge ac-tier-badge--${key}`}>
                  {groupTitle(group.items)}
                </span>
              </div>
              <ul className="ac-tier-rows__slots">
                {group.items.map((row) => {
                  const source = resolvePokemonImage(row.imagen);
                  const index = position;
                  position += 1;
                  return (
                    <li key={row.id} id={anchor(row)}>
                      <EntitySlot
                        size={56}
                        name={row.nombre}
                        sprite={
                          source === null
                            ? null
                            : { src: source, smooth: true, loading: lazy(index) }
                        }
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
          );
        })}
      </div>
    );
  };

  const views: Record<EntityView, (current: ListPage<PokedexRow>) => ReactNode> = {
    cards,
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
      paginationAlign="center"
    />
  );
}
