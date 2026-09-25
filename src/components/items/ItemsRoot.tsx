import '@/styles/components/inventory.css';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import type { LootCardDrop, LootCardEntity } from '@/components/cards/LootCard';
import type * as RowModule from '@/components/cards/ListRow';
import type * as TableModule from '@/components/content/DataTable';
import type { DataTableColumn } from '@/components/content/DataTable';
import { EmptyState } from '@/components/content/EmptyState';
import { TextField } from '@/components/controls/TextField';
import { ElementChip } from '@/components/game/ElementChip';
import type { ElementChipEntry } from '@/components/game/ElementChip';
import { EntitySlot } from '@/components/game/EntitySlot';
import { NestedEntity } from '@/components/game/NestedEntity';
import { Sprite } from '@/components/game/Sprite';
import { SpriteStage } from '@/components/game/SpriteStage';
import {
  ALL_CATEGORY,
  decodeItems,
  decodeItemsRefs,
  dropperEntity,
  elementChip,
  itemPanel,
  itemsConfig,
  type ItemsCategory,
  type ItemsData,
  type ItemsRow,
  type ItemsTab,
} from '@/components/items/config';
import { EntityList } from '@/components/lists/EntityList';
import type { EntityListLabels } from '@/components/lists/EntityList';
import { useListState } from '@/components/lists/useListState';
import type { ListController } from '@/components/lists/useListState';
import { PokedolaresAmount } from '@/components/money/PokedolaresAmount';
import type { Locale } from '@/i18n/config';
import type { Messages } from '@/i18n/messages/en';
import type { MessageLeaf } from '@/i18n/messages/types';
import { fill, isPluralMessage, plural } from '@/i18n/messages/types';
import { lootKeys } from '@/lib/cards/layout';
import type { LootKey } from '@/lib/cards/layout';
import { formatInteger } from '@/lib/format/numbers';
import { usePanels } from '@/lib/game/panels';
import { withTipLabels } from '@/lib/game/tip-labels';
import { elementTip, itemTip, pokemonTip } from '@/lib/game/tips';
import type { EntityView, ListPage } from '@/lib/lists/state';

// ItemsRoot (spec 7.3, 7.7, 8.5, 16.4.1): the island of the `items` list, on `/{l}/items/`
// («Todo») and on each `/{l}/items/c/{categoria}/`. The page draws the breadcrumb, the h1 and
// the category navigation (`ItemsNavigation`, handed over as `children`); the island draws the
// «Buscar ítem» field, the results bar, the active view and the pagination (96 a page).
//
// Views (16.4.1): only «Ranuras» (default) and «Lista»; a stored or linked «cards» view falls
// back to Ranuras (`itemsConfig`).
//   - Ranuras is the inventory of `Lienzo:Items`: one panel of `EntitySlot` of 40, 4 apart, on
//     columns that fill the panel and end flush; in «Todo» one block per Market category,
//     headed by its name and its count. Each slot is the sprite only (the client «?» when the
//     item has none) and opens the item's game tooltip (`itemTip`), completed with the facts of
//     `/{l}/paneles.json` once it is here (src/lib/game/panels.ts).
//   - Lista: `DataTable` with Sprite · Ítem · (in «Todo») Categoría · the keys of the union.
//     Its table and row components are the deferred part of the island (13.6).
// Every view gives each item the anchor `item-{id}` (H7).

/** Slots and rows from this index on load their sprite lazily (7.4.2). */
const EAGER_ART = 4;

/** The keys of the Lista view after Sprite, Ítem and Categoría, in the order of 8.5. */
const LIST_KEYS: readonly LootKey[] = ['droppedBy', 'element', 'use', 'npcPrice', 'shopPrice'];

/**
 * Widths of the Lista columns: the drops table of `Lienzo:Pokedex-Shiny-Charizard`, the Lista
 * of an item (8.5). «Ítem» and the columns that table does not draw take what is left.
 */
const LIST_WIDTHS: Partial<Record<LootKey | 'sprite' | 'category', number>> = {
  sprite: 72,
  category: 180,
  droppedBy: 180,
  element: 130,
  npcPrice: 150,
  use: 200,
};

/** Every text of the list besides `ui` (DP1), from the `items` namespace of the page. */
export interface ItemsListLabels {
  /** «{n} ítems» / «{n} items», singular «1 ítem» / «1 item» (8.5 step 4). */
  count: MessageLeaf;
  /** «Sprite»: header of the sprite column of the Lista, for screen readers. */
  sprite: string;
  /** «Ítem» / «Item»: header of the name column. */
  item: string;
  /** «{n} Pokémon»: «Drop de» of an item that more than one Pokémon drops. */
  droppedByCount: MessageLeaf;
  /** «Buscar ítem» / «Search item»: the live search field of the page (16.4.1). */
  search: string;
  /** What the inventory says when «Buscar ítem» finds nothing. */
  noResults: string;
}

export interface ItemsRootProps {
  /** Picks the format of the figures and the language of the names (C-R3). */
  locale: Locale;
  /** `/es/items/`: the base of every page link (H6). A prerendered page has no query (PR2). */
  path: string;
  /** `/es/items/datos.json`: every row of every category (PR5). */
  dataUrl: string;
  /** `todo` on `/{l}/items/`, the id of the category on `/{l}/items/c/{id}/`. */
  category: string;
  /** The first page of the default state, in the shape of `datos.json` (PR5). */
  data: ItemsData;
  /** Rows of the whole list: every item in «Todo», the items of the category otherwise. */
  total: number;
  /**
   * The categories the views name: in «Todo» the 13 real ones in the Market order, which is
   * the order of the groups and of their headings; in a category page, only its own, whose
   * name every item panel of the page carries.
   */
  categories: readonly ItemsCategory[];
  /**
   * The category navigation of 8.5 step 3 (`ItemsNavigation`), rendered by the page: it is
   * the same 14 links on every page of the list and nothing about it changes with the state,
   * so it travels as HTML instead of as props and works before this island hydrates.
   */
  children?: ReactNode;
  /**
   * The elements the rows of `data` name, as `ElementChip` takes them, panels included (DP3).
   * The other pages' elements come in `refs` (PR5).
   */
  elements: readonly ElementChipEntry[];
  /**
   * The «Drop de» of each row of `data` that one Pokémon alone drops, by the id of that
   * Pokémon, panel included (DP3).
   */
  droppers: Readonly<Record<string, LootCardEntity>>;
  /** The h1 of the page, «Ítems» or the name of the category: the name of the Slots panel. */
  title: string;
  /** Caption of the Lista, already written: «Todos los ítems» or «Ítems de Stones». */
  caption: string;
  /** `messages.ui` of the page's locale: the components' texts and the panel labels. */
  ui: Messages['ui'];
  labels: ItemsListLabels;
}

/** A plural or a plain template, filled with the figure already formatted (13.2, 13.3). */
function counted(template: MessageLeaf, n: number, locale: Locale): string {
  const chosen = isPluralMessage(template) ? plural(locale, n, template) : template;
  return fill(chosen, { n: formatInteger(n, locale) });
}

// The deferred part (13.6): the Lista table and its rows load only when that view is drawn,
// and are asked for once the island is idle so a switch finds them ready.

interface Deferred {
  DataTable: typeof TableModule.DataTable;
  ListRow: typeof RowModule.ListRow;
}

let deferred: Deferred | undefined;
let request: Promise<void> | undefined;

function loadDeferred(): Promise<void> {
  request ??= Promise.all([
    import('@/components/content/DataTable'),
    import('@/components/cards/ListRow'),
  ]).then(
    ([table, row]) => {
      deferred = { DataTable: table.DataTable, ListRow: row.ListRow };
    },
    (error: unknown) => {
      request = undefined;
      throw error;
    },
  );
  return request;
}

export function ItemsRoot({
  locale,
  path,
  dataUrl,
  category,
  data,
  total,
  categories,
  children,
  elements,
  droppers,
  title,
  caption,
  ui,
  labels,
}: ItemsRootProps) {
  const grouped = category === ALL_CATEGORY;

  const categoryById = useMemo(
    () => new Map(categories.map((entry) => [entry.id, entry])),
    [categories],
  );

  // `refs` of `datos.json`, taken when it arrives (PR5); until then, the part the props bring.
  const [loaded, setLoaded] = useState<ItemsData['refs'] | null>(null);
  const refs = loaded ?? data.refs;
  const decode = useCallback(
    (json: unknown) => {
      const rows = decodeItems(json);
      setLoaded(decodeItemsRefs(json));
      return grouped ? rows : rows.filter((row) => row.categoria === category);
    },
    [grouped, category],
  );
  const config = useMemo(
    () =>
      itemsConfig(
        dataUrl,
        category,
        categories.map((entry) => entry.id),
      ),
    [dataUrl, category, categories],
  );
  const items = useMemo(() => decodeItems(data), [data]);
  const controller = useListState(config, { items, total, decode, path });
  const view = controller.page.state.view;

  // The rest of every panel (`/{l}/paneles.json`), and the labels of its rows, once here.
  const panels = usePanels(locale);
  const labelsOf = useMemo(
    () => withTipLabels(ui.tooltip, panels?.etiquetas),
    [ui.tooltip, panels],
  );

  // Elements and «Drop de»: the props bring those of the first page; every other one is
  // built from `refs` with the same builders, and every one again once the panels are here.
  const [chips, entities] = useMemo(() => {
    const own = new Map(elements.map((element) => [element.id, element]));
    const one = new Map(Object.entries(droppers));
    for (const [id, ref] of Object.entries(refs.elementos))
      if (!own.has(id) || panels !== null)
        own.set(id, elementChip(id, ref, locale, labelsOf, elementTip, panels?.elementos[id]));
    for (const [id, ref] of Object.entries(refs.pokemon))
      if (!one.has(id) || panels !== null)
        one.set(
          id,
          dropperEntity(id, ref, locale, labelsOf, pokemonTip, panels?.pokemon[id], panels?.tipos),
        );
    return [own, one] as const;
  }, [elements, droppers, refs, locale, labelsOf, panels]);

  /** The one Pokémon that drops a row's item, when it is only one. */
  const onlyDropper = (row: ItemsRow): string | undefined =>
    Array.isArray(row.dropDe) && row.dropDe.length === 1 ? row.dropDe[0] : undefined;

  // Whether the Lista needs its deferred part, and whether it is here.
  const later = deferred;
  const absent = later === undefined && view === 'list';
  const [, setArrived] = useState(0);
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    if (!absent) return undefined;
    let live = true;
    loadDeferred().then(
      () => {
        if (!live) return;
        setBroken(false);
        setArrived((count) => count + 1);
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
  let list: ListController<ItemsRow> = controller;
  if (absent) list = broken ? { ...controller, failed: true } : { ...controller, ready: false };

  const anchor = (row: ItemsRow) => config.anchorId?.(row);
  const categoryName = (id: string) => categoryById.get(id)?.nombre ?? null;

  /**
   * «Drop de» of a row (7.5.3): the one Pokémon with its page and its panel, «{n} Pokémon», or
   * nothing. Until its panel is here the one Pokémon is its name (the list is still pending).
   */
  const droppedBy = (row: ItemsRow): LootCardEntity | string | null => {
    // A number when the list only counts them (`DROPPER_NAMES_MAX`).
    const count = typeof row.dropDe === 'number' ? row.dropDe : (row.dropDe ?? []).length;
    if (count === 0) return null;
    const one = onlyDropper(row);
    if (one === undefined) return counted(labels.droppedByCount, count, locale);
    return entities.get(one) ?? refs.pokemon[one]?.nombre ?? null;
  };

  /** A row as `LootCard` reads it (8.5): the registry values, already written. */
  const lootEntry = (row: ItemsRow): LootCardDrop => ({
    name: row.nombre,
    sprite: row.sprite,
    dropDe: droppedBy(row),
    element:
      row.elemento === null
        ? null
        : (chips.get(row.elemento) ?? refs.elementos[row.elemento]?.nombre ?? null),
    use: row.uso,
    npcPrice: row.vende,
    shopPrice: row.compra,
  });

  /** The page of an item, `/{l}/items/{id}/`. */
  const itemHref = (row: ItemsRow) => `/${locale}/items/${row.id}/`;

  /** The item panel of a slot and of a Lista name (7.5.3), with its facts once they are here. */
  const panelOf = (row: ItemsRow) =>
    itemPanel(
      row,
      refs,
      categoryName(row.categoria),
      locale,
      labelsOf,
      itemTip,
      panels?.items[row.id],
    );

  // ------------------------------------------------------------------------------ views
  let position = 0;
  const lazy = () => {
    const index = position;
    position += 1;
    return index >= EAGER_ART ? ('lazy' as const) : undefined;
  };

  const slotsView = (page: ListPage<ItemsRow>): ReactNode => {
    const grid = (rows: readonly ItemsRow[]) => (
      <ul className="ac-inventory__grid">
        {rows.map((row) => (
          <li key={row.id} id={anchor(row)}>
            <EntitySlot
              size={40}
              name={row.nombre}
              sprite={row.sprite ? { ...row.sprite, loading: lazy() } : null}
              tip={panelOf(row)}
              href={itemHref(row)}
              locale={locale}
              hint={ui.pinHint}
            />
          </li>
        ))}
      </ul>
    );
    if (!grouped) {
      return (
        <div className="ac-inventory" role="group" aria-label={title}>
          {grid(page.items)}
        </div>
      );
    }
    return (
      <div className="ac-inventory">
        {page.groups.map((group) => {
          const entry = categoryById.get(group.key);
          return (
            <section key={group.key} className="ac-inventory__block">
              <h2 className="ac-inventory__head">
                {entry?.nombre ?? group.key}
                <span className="ac-inventory__count">
                  {formatInteger(group.items.length, locale)}
                </span>
              </h2>
              {grid(group.items)}
            </section>
          );
        })}
      </div>
    );
  };

  const listView = (page: ListPage<ItemsRow>, parts: Deferred): ReactNode => {
    const { DataTable, ListRow } = parts;
    const cards = page.items.map(lootEntry);
    const keys = lootKeys(cards);
    const listKeys = LIST_KEYS.filter((key) => keys.includes(key));

    /** A Lista cell of one of the keys of `LIST_KEYS`; `null` is «—» (ListRow). */
    const cell = (row: ItemsRow, card: LootCardDrop, key: LootKey): ReactNode => {
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
          return <ElementChip element={value} variant="label" locale={locale} hint={ui.pinHint} />;
        }
        case 'use':
          return row.uso;
        case 'npcPrice':
          return row.vende === null ? null : (
            <PokedolaresAmount amount={row.vende} locale={locale} />
          );
        case 'shopPrice':
          return row.compra === null ? null : (
            <PokedolaresAmount amount={row.compra} locale={locale} />
          );
        case 'quantity':
          return null;
      }
    };

    const columns: DataTableColumn[] = [
      { key: 'sprite', label: labels.sprite, srOnly: true, width: LIST_WIDTHS.sprite },
      { key: 'item', label: labels.item },
      ...(grouped
        ? [{ key: 'category', label: ui.tooltip.category, width: LIST_WIDTHS.category }]
        : []),
      ...listKeys.map((key) => ({ key, label: ui.tooltip[key], width: LIST_WIDTHS[key] })),
    ];
    return (
      <DataTable caption={caption} columns={columns} hover scroll>
        {page.items.map((row, index) => {
          const card = cards[index] ?? lootEntry(row);
          const values = listKeys.map((key) => cell(row, card, key));
          return (
            <ListRow
              key={row.id}
              id={anchor(row)}
              variant="drops"
              nameAlign="center"
              sprite={
                <SpriteStage
                  sprite={row.sprite ? { ...row.sprite, loading: lazy() } : null}
                  size={40}
                />
              }
              name={row.nombre}
              href={itemHref(row)}
              tip={panelOf(row)}
              hint={ui.pinHint}
              locale={locale}
              cells={grouped ? [categoryName(row.categoria), ...values] : values}
            />
          );
        })}
      </DataTable>
    );
  };

  const views: Record<EntityView, (page: ListPage<ItemsRow>) => ReactNode> = {
    // Cards is not offered here (16.4.1); `itemsConfig` never lets the state name it.
    cards: slotsView,
    slots: slotsView,
    list: (page) => (later === undefined ? null : listView(page, later)),
  };

  // `ui` carries every text of `EntityListLabels` under the same keys (13.2).
  const listLabels: EntityListLabels = ui;

  return (
    <EntityList
      className="ac-items-list"
      controller={list}
      labels={listLabels}
      count={(n) => counted(labels.count, n, locale)}
      empty={() => <EmptyState>{labels.noResults}</EmptyState>}
      views={views}
      controls={
        <>
          {children}
          <TextField
            variant="search"
            label={labels.search}
            labelHidden
            placeholder={labels.search}
            value={controller.query}
            onChange={(value) => controller.setQuery(value)}
            inputProps={{ autoComplete: 'off', spellCheck: false, enterKeyHint: 'search' }}
          />
        </>
      }
      paginationAlign="center"
    />
  );
}

export interface ItemsNavigationProps {
  /** The 14 tabs, «Todo» first, in the order of the registry. */
  tabs: readonly ItemsTab[];
  /** The tab of the page: `aria-current="page"` and the «Actual» state (IT6). */
  category: string;
  /** «Categorías del Market» / «Market categories»: the name of the `nav`. */
  label: string;
}

/**
 * The category navigation of 8.5 step 3, drawn as the tab panel of `Lienzo:Items`: a grid of
 * seven link tabs, each the icon of its category in a cell of 32 and its name; the tab of the
 * page has `aria-current="page"` and the selected frame. Both pages render it on the server: a
 * page with items hands it to `ItemsRoot`, which places it among the controls of the list, and
 * a category without items draws it over its `EmptyState`.
 */
export function ItemsNavigation({ tabs, category, label }: ItemsNavigationProps) {
  return (
    <nav className="ac-inventory-tabs" aria-label={label}>
      <ul className="ac-inventory-tabs__grid">
        {tabs.map((tab) => (
          <li key={tab.id}>
            <a
              className="ac-inventory-tabs__tab"
              href={tab.href}
              aria-current={tab.id === category ? 'page' : undefined}
            >
              <span className="ac-inventory-tabs__icon" aria-hidden="true">
                {tab.icono === null ? null : <Sprite {...tab.icono} cell alt="" />}
              </span>
              <span className="ac-inventory-tabs__name">{tab.nombre}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export interface ItemsEmptyProps extends ItemsNavigationProps {
  /** «No hay ítems en esta categoría.» / «There are no items in this category.» */
  children: ReactNode;
}

/**
 * A category without items, or whose items a build with OCULTAR_BORRADORES=1 hides (8.5
 * «Estados», IT2): the navigation and one `EmptyState`, with no count and no view, 16 apart
 * like the controls and the results of a list. No island: nothing here changes.
 */
export function ItemsEmpty({ children, ...navigation }: ItemsEmptyProps) {
  return (
    <div className="ac-entity-list">
      <ItemsNavigation {...navigation} />
      <EmptyState>{children}</EmptyState>
    </div>
  );
}
