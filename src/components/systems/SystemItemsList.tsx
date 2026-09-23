import { useMemo } from 'react';
import type { ReactNode } from 'react';

import { CardGrid } from '@/components/cards/CardGrid';
import { ListRow } from '@/components/cards/ListRow';
import { LootCard } from '@/components/cards/LootCard';
import type { LootCardDrop } from '@/components/cards/LootCard';
import { SlotsPanel, SlotsPanelItem } from '@/components/cards/SlotsPanel';
import { DataTable } from '@/components/content/DataTable';
import type { DataTableColumn } from '@/components/content/DataTable';
import { EntitySlot } from '@/components/game/EntitySlot';
import type { SpriteProps } from '@/components/game/Sprite';
import { SpriteStage } from '@/components/game/SpriteStage';
import { EntityList } from '@/components/lists/EntityList';
import type { EntityListLabels } from '@/components/lists/EntityList';
import { useListState } from '@/components/lists/useListState';
import type { Locale } from '@/i18n/config';
import type { MessageLeaf } from '@/i18n/messages/types';
import { fill, isPluralMessage, plural } from '@/i18n/messages/types';
import { lootKeys } from '@/lib/cards/layout';
import type { LootKey } from '@/lib/cards/layout';
import { formatInteger } from '@/lib/format/numbers';
import { systemItemTip } from '@/lib/game/tips';
import type { LocalizedText, TipData, TipLabels } from '@/lib/game/tips';
import type { EntityView, ListConfig, ListPage } from '@/lib/lists/state';

// SystemItemsList (spec 8.4.2 step 6, 8.0.6, 7.7; E16, R3): the island of the `sistema-items`
// list, the automatic «Ítems» section of a system page (`id="items"`, the last one). The
// page renders it only when `getSystemItemsOf(id)` has one item or more, prerenders it and
// hydrates it with `client:visible` inside its `Section` h2, so card titles are `h3` (8.0.6).
//
// State (8.0.6): every item on one page (no pagination), no filter and one order, the order
// of content/system-items.json. It is the only list of its page, so its parameters carry no
// prefix (`?view=slots`, U1). The view is saved as `ac:vista:sistema-items` (U6).
//
// Views (8.4.2):
//   - Cards: `CardGrid family="loot"` of `LootCard`, one fact «Uso» with `descripcion` when
//     an item of the list has one (7.6.3). The title is text (items have no page, §15) and
//     the card opens nothing (7.5.10).
//   - Slots: `SlotsPanel` of one list with an `EntitySlot` of 40 (44 on a coarse pointer),
//     a `<button>` that opens the item's panel.
//   - Lista: `DataTable` with the caption «Ítems de {titulo}» / «{title} items» and the
//     columns Sprite · Ítem · Uso — Uso only when an item has it (V4) — with a `ListRow`
//     per item whose name opens the same panel.
//   Every view gives each item the anchor `item-{id}` (H7): the search palette leads to
//   `…/sistemas/{sistema}/#item-{id}` and the list focuses its trigger.
//
// Panel (7.5.3, E16): `systemItemTip`, built here from the fields of the record on the server
// and on hydration alike (D-018): the head is the item's sprite (`null` draws the missing
// mark), the rows «Sistema» (the title of this page) and «Uso» (`descripcion`).
//
// Language (8.0.5, T22, WA4): `descripcion` exists in English only (L-04), so in `es` the
// card fact, the Lista cell and the «Uso» row of the panel carry `lang="en"`. Item names are
// the game's and carry no `lang` (13.4). Nothing is invented: an item without `descripcion`
// has no «Uso» row, and its card fact and Lista cell show «—» only while another item of the
// list has one (8.0.5).

/** One entry of content/system-items.json whose `sistema` is this page (E16). */
export interface SystemItemEntry {
  /** `id` of the item: the React key and the anchor `item-{id}` (H7). */
  id: string;
  /** `nombre`, the game's name (13.4). */
  nombre: string;
  /** `descripcion`, in English: «Uso». `null` when the registry has none. */
  descripcion: string | null;
  /** `sprite` of the record resolved by the adapter (DP2); `null` draws the missing mark. */
  sprite: SpriteProps | null;
}

/** Every text of the list (DP1), from `ui` and the `systems` namespace. */
export interface SystemItemsListLabels {
  /** `ui.views`, `ui.pagination`, `ui.prev`, `ui.next`, `ui.page` and `ui.dataError`. */
  list: EntityListLabels;
  /** «{n} ítems» / «{n} items», singular «1 ítem» / «1 item» (8.4.2). */
  count: MessageLeaf;
  /** «Vista de ítems» / «Item view»: the name of the view group (8.4.2). */
  view: string;
  /** «Ítems» / «Items»: the name of the Slots list. */
  slots: string;
  /** «Sprite»: header of the sprite column, for screen readers. */
  sprite: string;
  /** «Ítem» / «Item»: header of the name column. */
  item: string;
  /** Strip of every panel, `ui.pinHint`. */
  pinHint: string;
  /**
   * `ui.tooltip`: the rows «Sistema» and «Uso» of the panel (7.5.3), and the labels of the
   * loot keys of `LootCard`, of which a system item only has «Uso», also the header of the
   * Lista column.
   */
  tooltip: TipLabels & Readonly<Record<LootKey, string>>;
}

export interface SystemItemsListProps {
  /** Picks the format of the figures and the language of `system.titulo` (C-R3). */
  locale: Locale;
  /** `/es/sistemas/punching-bag-training/`: the base of the list's URLs (H6). */
  path: string;
  /** The page's system: its `id` and its `titulo`, the «Sistema» row of every panel. */
  system: { id: string; titulo: LocalizedText };
  /** Its items in the order of the registry. The page renders the list only with one or more. */
  items: readonly SystemItemEntry[];
  /** Caption of the Lista table, already written: «Ítems de Boost» / «Boost items». */
  caption: string;
  labels: SystemItemsListLabels;
}

/** Cards from this index on load their sprite lazily (7.4.2). */
const EAGER_ART = 4;

/** The one language `descripcion` is written in (L-04). */
const DESCRIPTION_LANG: Locale = 'en';

/**
 * Widths of the Lista columns: the drops table of `Lienzo:Pokedex-Shiny-Charizard`, the Lista
 * of an item (8.5). «Ítem» takes what is left.
 */
const LIST_WIDTHS = { sprite: 72, use: 240 } as const;

/**
 * The `sistema-items` list of 8.0.6: every item on one page, no filter, the registry's order
 * (a stable sort that keeps it). Built once: it has no input, and the list controller keys
 * its effects on it.
 */
const CONFIG: ListConfig<SystemItemEntry> = {
  id: 'sistema-items',
  pageSize: Number.POSITIVE_INFINITY,
  sorts: [{ id: 'registro', label: '', compare: () => 0 }],
  filters: [],
  anchorId: (item) => `item-${item.id}`,
};

/** A plural or a plain template, filled with the figure already formatted (13.2, 13.3). */
function counted(template: MessageLeaf, n: number, locale: Locale): string {
  const chosen = isPluralMessage(template) ? plural(locale, n, template) : template;
  return fill(chosen, { n: formatInteger(n, locale) });
}

/** The panel of an item (7.5.3, E16), its «Uso» row marked in the language it is written in. */
function itemPanel(
  item: SystemItemEntry,
  system: SystemItemsListProps['system'],
  locale: Locale,
  labels: TipLabels,
): TipData {
  const tip = systemItemTip(
    {
      id: item.id,
      nombre: item.nombre,
      descripcion: item.descripcion,
      sistema: system.id,
      sprite: item.sprite,
      tituloSistema: system.titulo,
    },
    locale,
    labels,
  );
  if (locale === DESCRIPTION_LANG) return tip;
  return {
    ...tip,
    rows: tip.rows.map((row) =>
      row.label === labels.use ? { ...row, lang: DESCRIPTION_LANG } : row,
    ),
  };
}

export function SystemItemsList({
  locale,
  path,
  system,
  items,
  caption,
  labels,
}: SystemItemsListProps) {
  const controller = useListState(CONFIG, { items, path });
  const shown = controller.page.items;
  const useLang = locale === DESCRIPTION_LANG ? undefined : DESCRIPTION_LANG;

  // Each item once: the card as `LootCard` reads it and its panel.
  const resolved = useMemo(
    () =>
      new Map(
        items.map((item): [string, { card: LootCardDrop; tip: TipData }] => [
          item.id,
          {
            card: { name: item.nombre, sprite: item.sprite, use: item.descripcion, useLang },
            tip: itemPanel(item, system, locale, labels.tooltip),
          },
        ]),
      ),
    [items, system, locale, labels.tooltip, useLang],
  );

  // The union of the keys over the items the view shows (7.6.3): «Uso» or nothing.
  const keys = useMemo(
    () => lootKeys(shown.flatMap((item) => resolved.get(item.id)?.card ?? [])),
    [shown, resolved],
  );

  const anchor = (item: SystemItemEntry) => CONFIG.anchorId?.(item);

  const views: Record<EntityView, (page: ListPage<SystemItemEntry>) => ReactNode> = {
    cards: (page) => (
      <CardGrid family="loot" headingLevel={3}>
        {page.items.map((item, index) => {
          const entry = resolved.get(item.id);
          if (entry === undefined) return null;
          return (
            <LootCard
              key={item.id}
              id={anchor(item)}
              drop={entry.card}
              keys={keys}
              labels={labels.tooltip}
              locale={locale}
              hint={labels.pinHint}
              loading={index >= EAGER_ART ? 'lazy' : undefined}
            />
          );
        })}
      </CardGrid>
    ),
    slots: (page) => (
      <SlotsPanel label={labels.slots}>
        {page.items.map((item) => {
          const entry = resolved.get(item.id);
          if (entry === undefined) return null;
          return (
            <SlotsPanelItem key={item.id} id={anchor(item)}>
              <EntitySlot
                size={40}
                name={item.nombre}
                sprite={item.sprite}
                tip={entry.tip}
                locale={locale}
                hint={labels.pinHint}
              />
            </SlotsPanelItem>
          );
        })}
      </SlotsPanel>
    ),
    list: (page) => {
      const withUse = keys.includes('use');
      const columns: DataTableColumn[] = [
        { key: 'sprite', label: labels.sprite, srOnly: true, width: LIST_WIDTHS.sprite },
        { key: 'item', label: labels.item },
        ...(withUse ? [{ key: 'use', label: labels.tooltip.use, width: LIST_WIDTHS.use }] : []),
      ];
      // A description runs over several lines in its 240 px: `wrap` gives those cells their
      // 8 px above and below (DS:DataTable).
      return (
        <DataTable caption={caption} columns={columns} hover scroll wrap>
          {page.items.map((item) => {
            const entry = resolved.get(item.id);
            if (entry === undefined) return null;
            // `null` is «—» while another item has a description (8.0.5).
            const use =
              item.descripcion === null ? null : <span lang={useLang}>{item.descripcion}</span>;
            return (
              <ListRow
                key={item.id}
                id={anchor(item)}
                variant="drops"
                nameAlign="center"
                sprite={<SpriteStage sprite={item.sprite} size={40} />}
                name={item.nombre}
                locale={locale}
                cells={withUse ? [use] : []}
                tip={entry.tip}
                hint={labels.pinHint}
              />
            );
          })}
        </DataTable>
      );
    },
  };

  return (
    <EntityList
      controller={controller}
      labels={labels.list}
      count={(n) => counted(labels.count, n, locale)}
      // No filter, and the page renders the list only with items (8.4.2): nothing to say.
      empty={() => null}
      views={views}
      viewLabel={labels.view}
    />
  );
}
