import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { CardGrid } from '@/components/cards/CardGrid';
import { CardGroup } from '@/components/cards/CardGroup';
import { LootCard } from '@/components/cards/LootCard';
import type { LootCardDrop, LootCardEntity } from '@/components/cards/LootCard';
import type * as SlotsModule from '@/components/cards/SlotsPanel';
import type * as RowModule from '@/components/cards/ListRow';
import type * as TableModule from '@/components/content/DataTable';
import type { DataTableColumn } from '@/components/content/DataTable';
import { EmptyState } from '@/components/content/EmptyState';
import { ToggleGroup } from '@/components/controls/ToggleGroup';
import { ElementChip } from '@/components/game/ElementChip';
import type { ElementChipEntry } from '@/components/game/ElementChip';
import type * as SlotModule from '@/components/game/EntitySlot';
import { NestedEntity } from '@/components/game/NestedEntity';
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
import type * as TipsModule from '@/lib/game/tips';
import type { TipData } from '@/lib/game/tips';
import type { EntityView, ListPage } from '@/lib/lists/state';

// ItemsRoot (spec 7.3, 7.7, 8.0.6, 8.5): the island of the `items` list, on `/{l}/items/`
// («Todo») and on each `/{l}/items/c/{categoria}/`. It owns what 7.7.1 leaves to a list root —
// the category navigation, the three views and the texts of the results bar — and hands the
// rest to `useListState` and `EntityList`. The `ListConfig`, the shape of the data, its decoder
// and the panel builders live in ./config.ts, which the build shares.
//
// Template B (8.0.2): the page draws the breadcrumb and the h1; the island draws, 16 apart, the
// category navigation (in the place of the FilterBar), the results bar — `Count` «{n} ítems»
// and `ViewToggle` — the active view and `Pagination align="center"` (8.5 steps 3 to 6).
//
// Category navigation (8.5 step 3, 7.2.8): `ItemsNavigation`, at the end of this file, is the
// `ToggleGroup variant="tab"` with `href` options — the pestaña enlace, a `nav` named
// «Categorías del Market» / «Market categories» with the 14 entries of the registry in its
// order, each one a link with its `icono` at 1x and its name, that wraps. The page's own entry
// carries `aria-current="page"` and the «Actual» state of 5.2, never the amber selection nor
// `aria-pressed` (T9, IT6). The page renders it and hands it over as `children`, which this
// root places among the controls of the list, 16 above the results bar like the type tabs of
// `Lienzo:Comercio`: the same links on every page of the list, which nothing of the state
// changes, so they are HTML that works before the island hydrates and no weight in its props.
//
// Data (PR5). The page prerenders the first page of the default state and the props carry
// only its rows, in the shape of `/{l}/items/datos.json`, with the part of `refs` they name.
// When the list is longer than one page the island asks for that file as it hydrates; a
// category page keeps the rows of its category. A row holds the registry values (§3.13); the
// labels are not in it, they arrive by props (DP1).
//
// Views (7.7.4, 8.5 step 5):
//   - Cards: `LootCard` in `CardGrid family="loot"` with the keys of the union (7.6.3) in the
//     order Drop de, Elemento, Uso, Precio NPC, Precio de tienda (Q12). In «Todo» one
//     `CardGroup` (h2) per category of the page, in the Market order, with its icon of 32, its
//     name and its count on this page, and card titles `h3`; each group is its own grid with
//     its own keys (7.6.3). In a category the grid has no groups and its titles are `h2`
//     (7.6.2). The title is text (items have no page, §15) and the card opens nothing
//     (7.5.10, IT4): the triggers are the element chip and the one Pokémon of «Drop de».
//   - Slots: in «Todo» `SlotsPanel layout="side"` with one label column per category; in a
//     category one list. `EntitySlot` of 40 (44 on a coarse pointer), a `<button>` that opens
//     the item panel.
//   - Lista: `DataTable` with its caption and the columns Sprite · Ítem · (in «Todo»)
//     Categoría · the keys of the union; one `ListRow variant="drops"` per item whose name is
//     the button that opens the item panel.
//   Every view gives each item the anchor `item-{id}` (H7): the article, the slot and the row.
//
// Panels (7.5.3). The item panel is `itemTip` with the same rows in every category. The props
// bring the element chips and the one-Pokémon «Drop de» of the first page with their panels,
// built in the build (DP3): that is all the prerendered page and the hydration draw. Everything
// else — the Slots and Lista components, the tooltip builders and the panels of the other
// pages' rows — is the deferred part of the island (see below).

/** Cards and slots from this index on load their sprite lazily (7.4.2). */
const EAGER_ART = 4;

/** The keys of the Lista view after Sprite, Ítem and Categoría, in the order of 8.5. */
const LIST_KEYS: readonly LootKey[] = ['droppedBy', 'element', 'use', 'npcPrice', 'shopPrice'];

/**
 * Widths of the Lista columns: the drops table of `Lienzo:Pokedex-Shiny-Charizard`, the Lista
 * of an item (8.5). «Ítem» and the columns that table does not draw take what is left.
 */
const LIST_WIDTHS: Partial<Record<LootKey | 'sprite', number>> = {
  sprite: 72,
  droppedBy: 180,
  element: 130,
  use: 240,
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

// --------------------------------------------------------------------- the deferred part
//
// Cards is the view the pages prerender and hydrate, so its pieces are part of the island.
// The rest is only drawn when the state asks for it, and loads as deferred chunks of 13.6
// (`import()`), which keeps the initial JS of the pages within their budget: the Slots and
// Lista components, and the tooltip builders that the item panel of those two views and the
// panels of an element or a Pokémon the props did not bring need. The modules are the ones the
// Pokédex already loads the same way, not a copy. They are asked for as soon as the island is
// idle after hydrating, so a switch finds them ready, and at once when the state of the URL or
// the saved view needs them (PR4): until they are here the root is not `ready`, so it keeps
// `data-ac-pending` and nothing of the default state shows. A chunk that does not load is the
// data error of PR5.

interface Deferred {
  SlotsPanel: typeof SlotsModule.SlotsPanel;
  SlotsPanelItem: typeof SlotsModule.SlotsPanelItem;
  EntitySlot: typeof SlotModule.EntitySlot;
  DataTable: typeof TableModule.DataTable;
  ListRow: typeof RowModule.ListRow;
  tips: Pick<typeof TipsModule, 'elementTip' | 'itemTip' | 'pokemonTip'>;
}

let deferred: Deferred | undefined;
let request: Promise<void> | undefined;

function loadDeferred(): Promise<void> {
  request ??= Promise.all([
    import('@/components/cards/SlotsPanel'),
    import('@/components/game/EntitySlot'),
    import('@/components/content/DataTable'),
    import('@/components/cards/ListRow'),
    import('@/lib/game/tips'),
  ]).then(
    ([slots, slot, table, row, tips]) => {
      deferred = {
        SlotsPanel: slots.SlotsPanel,
        SlotsPanelItem: slots.SlotsPanelItem,
        EntitySlot: slot.EntitySlot,
        DataTable: table.DataTable,
        ListRow: row.ListRow,
        tips,
      };
    },
    (error: unknown) => {
      // A chunk that failed is asked for again the next time the state needs it.
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
  const shown = controller.page.items;
  const view = controller.page.state.view;

  // Elements and «Drop de». The props bring those of the first page with their panels; every
  // other one is built from `refs` with the same function once the deferred part is here.
  const later = deferred;
  const [chips, entities] = useMemo(() => {
    const own = new Map(elements.map((element) => [element.id, element]));
    const one = new Map(Object.entries(droppers));
    if (later !== undefined) {
      for (const [id, ref] of Object.entries(refs.elementos))
        if (!own.has(id))
          own.set(id, elementChip(id, ref, locale, ui.tooltip, later.tips.elementTip));
      for (const [id, ref] of Object.entries(refs.pokemon))
        if (!one.has(id))
          one.set(id, dropperEntity(id, ref, locale, ui.tooltip, later.tips.pokemonTip));
    }
    return [own, one] as const;
  }, [elements, droppers, refs, later, locale, ui.tooltip]);

  /** The one Pokémon that drops a row's item, when it is only one. */
  const onlyDropper = (row: ItemsRow): string | undefined =>
    row.dropDe?.length === 1 ? row.dropDe[0] : undefined;

  // Whether the state needs the deferred part (see above), and whether it is here.
  const absent =
    later === undefined &&
    (view !== 'cards' ||
      shown.some((row) => {
        const one = onlyDropper(row);
        return (
          (row.elemento !== null && !chips.has(row.elemento)) ||
          (one !== undefined && !entities.has(one))
        );
      }));
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
    const ids = row.dropDe ?? [];
    if (ids.length === 0) return null;
    const one = onlyDropper(row);
    if (one === undefined) return counted(labels.droppedByCount, ids.length, locale);
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

  /** The item panel of a slot and of a Lista name (7.5.3); only with the deferred part here. */
  const panelOf = (row: ItemsRow, tips: Deferred['tips']): TipData =>
    itemPanel(row, refs, categoryName(row.categoria), locale, ui.tooltip, tips.itemTip);

  // ------------------------------------------------------------------------------ views
  let position = 0;
  const lazy = () => {
    const index = position;
    position += 1;
    return index >= EAGER_ART ? ('lazy' as const) : undefined;
  };

  const grid = (rows: readonly ItemsRow[], headingLevel?: 2) => {
    const cards = rows.map(lootEntry);
    const keys = lootKeys(cards);
    return (
      <CardGrid family="loot" headingLevel={headingLevel}>
        {rows.map((row, index) => (
          <LootCard
            key={row.id}
            id={anchor(row)}
            drop={cards[index] ?? lootEntry(row)}
            keys={keys}
            labels={ui.tooltip}
            locale={locale}
            hint={ui.pinHint}
            loading={lazy()}
          />
        ))}
      </CardGrid>
    );
  };

  const slotsView = (page: ListPage<ItemsRow>, parts: Deferred): ReactNode => {
    const { SlotsPanel, SlotsPanelItem, EntitySlot } = parts;
    const slot = (row: ItemsRow) => (
      <SlotsPanelItem key={row.id} id={anchor(row)}>
        <EntitySlot
          size={40}
          name={row.nombre}
          sprite={row.sprite ? { ...row.sprite, loading: lazy() } : null}
          tip={panelOf(row, parts.tips)}
          locale={locale}
          hint={ui.pinHint}
        />
      </SlotsPanelItem>
    );
    if (!grouped) return <SlotsPanel label={title}>{page.items.map(slot)}</SlotsPanel>;
    return (
      <SlotsPanel
        label={title}
        layout="side"
        groups={page.groups.map((group) => ({
          key: group.key,
          label: categoryName(group.key) ?? group.key,
          children: group.items.map(slot),
        }))}
      />
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
      ...(grouped ? [{ key: 'category', label: ui.tooltip.category }] : []),
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
              tip={panelOf(row, parts.tips)}
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
    cards: (page) =>
      grouped
        ? page.groups.map((group) => {
            const entry = categoryById.get(group.key);
            return (
              <CardGroup
                key={group.key}
                label={entry?.nombre ?? group.key}
                count={group.items.length}
                sprite={entry?.icono ?? null}
                level={2}
                locale={locale}
              >
                {grid(group.items)}
              </CardGroup>
            );
          })
        : grid(page.items, 2),
    slots: (page) => (later === undefined ? null : slotsView(page, later)),
    list: (page) => (later === undefined ? null : listView(page, later)),
  };

  // `ui` carries every text of `EntityListLabels` under the same keys (13.2).
  const listLabels: EntityListLabels = ui;

  return (
    <EntityList
      controller={list}
      labels={listLabels}
      count={(n) => counted(labels.count, n, locale)}
      // No filter, and the pages render the island only with items (8.5): nothing to say.
      empty={() => null}
      views={views}
      controls={children}
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
 * The category navigation of 8.5 step 3: the link tab of 7.2.8, one link per tab with its
 * icon at 1x and its name, that wraps. Both pages render it on the server: a page with items
 * hands it to `ItemsRoot`, which places it among the controls of the list, and a category
 * without items draws it over its `EmptyState`.
 */
export function ItemsNavigation({ tabs, category, label }: ItemsNavigationProps) {
  return (
    <ToggleGroup
      variant="tab"
      label={label}
      value={category}
      options={tabs.map((tab) => ({
        value: tab.id,
        label: tab.nombre,
        href: tab.href,
        ...(tab.icono === null ? {} : { sprite: tab.icono }),
      }))}
    />
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
