import { useMemo } from 'react';
import type { ReactNode } from 'react';

import { CardGrid } from '@/components/cards/CardGrid';
import { ListRow } from '@/components/cards/ListRow';
import { LootCard } from '@/components/cards/LootCard';
import type { LootCardDrop } from '@/components/cards/LootCard';
import { SlotsPanel, SlotsPanelItem } from '@/components/cards/SlotsPanel';
import { DataTable } from '@/components/content/DataTable';
import type { DataTableColumn } from '@/components/content/DataTable';
import { ElementChip } from '@/components/game/ElementChip';
import { EntitySlot } from '@/components/game/EntitySlot';
import { SpriteStage } from '@/components/game/SpriteStage';
import { EntityList } from '@/components/lists/EntityList';
import type { EntityListLabels } from '@/components/lists/EntityList';
import { useListState } from '@/components/lists/useListState';
import type { Locale } from '@/i18n/config';
import type { PluralMessage } from '@/i18n/messages/types';
import { fill, plural } from '@/i18n/messages/types';
import { lootKeys } from '@/lib/cards/layout';
import type { LootKey } from '@/lib/cards/layout';
import { formatInteger } from '@/lib/format/numbers';
import type { TipData } from '@/lib/game/tips';
import type { EntityView, ListConfig, ListPage } from '@/lib/lists/state';

// The island of `/_paridad/tarjetas/` (src/routes/_paridad/tarjetas.astro): the «Drops ·
// Cards, Slots y Lista» section of the Tarjetas board as the list it stands for, the `drops`
// list of 8.0.6 that the Pokémon sheet of M7 shows. The board draws its three views one under
// the other; a list mounts one of them (V1), so here they are the three views of one
// `EntityList`, switched by its `ViewToggle` and remembered in `ac:vista:drops` (U6). This is
// the `EntityList` on a parity route that S4 asks of F1 (§2), and the list tests/e2e/lists.spec.ts
// walks there.
//
// The list follows 8.0.6: every row on one page (no pagination), no filter and one order, the
// order of the rows as the page passes them; the parameters carry the `drops` prefix, as on the
// sheet, where another list shares the URL (U1). Views (7.7.4, 8.3):
//   - Cards: `CardGrid family="loot"` of `LootCard`, titles `h3` under the section's h2
//     (7.6.2), keys the union of the rows (`lootKeys`, 7.6.3);
//   - Slots: `SlotsPanel` of one list with an `EntitySlot` of 40 per drop (44 on touch);
//   - Lista: `DataTable` with its caption and the columns Sprite (screen readers only), Ítem,
//     Drop de, Elemento and Uso, one `ListRow` per drop.
// Every view gives a drop the anchor `item-{id}` (H7).
//
// Nothing here is a design of its own and nothing ships: this file lives beside the parity
// route, which only the visual build and the development server inject (astro.config.mjs).
// Every text arrives by props from the page, which reads the dictionary (DP1) and the board
// samples of tests/visual/fixtures/tarjetas.json (X4).

/** One drop of the list: the card model, and the panel its slot and its row open. */
export interface ParityDrop {
  /** Id of the item: the anchor `item-{id}` (H7). */
  id: string;
  /** What `LootCard` reads; its `sprite` is the slot's and the row's too. */
  drop: LootCardDrop;
  /** `itemTip` of the item (7.5.3): the panel of the slot and of the name in the Lista. */
  tip: TipData;
}

export interface DropsListLabels {
  /** `ui` of the page: views, pagination and the data error (PR5). */
  list: EntityListLabels;
  /** Visible label of each loot key: `ui.tooltip` plus «Cantidad». */
  loot: Readonly<Record<LootKey, string>>;
  /** «{n} drops» / «1 drop» (8.3). */
  count: PluralMessage;
  /** «Vista de drops» / «Drop view»: the name of the view group (8.3). */
  view: string;
  /** Name of the Slots panel and caption of the Lista. */
  caption: string;
  /** Header of the sprite column, for screen readers only. */
  sprite: string;
  /** «Ítem» / «Item». */
  item: string;
}

export interface DropsListProps {
  locale: Locale;
  /** Path of the page without a query: the base of its links (PR2, H6). */
  path: string;
  rows: readonly ParityDrop[];
  labels: DropsListLabels;
  /** Strip of the panels, `ui.pinHint`. */
  hint: string;
}

/** 8.0.6: the `drops` list. Every row on one page and the order of the page. */
const DROPS: ListConfig<ParityDrop> = {
  id: 'drops',
  prefix: 'drops',
  pageSize: Number.POSITIVE_INFINITY,
  sorts: [{ id: 'registro', label: '', compare: () => 0 }],
  filters: [],
  anchorId: (row) => `item-${row.id}`,
};

/** Widths of the Lista columns, from `Lienzo:Tarjetas`; Ítem takes what is left (272 at 896). */
const WIDTHS = { sprite: 72, droppedBy: 180, element: 130, use: 242 };

const anchor = (row: ParityDrop) => `item-${row.id}`;

export function DropsList({ locale, path, rows, labels, hint }: DropsListProps) {
  const controller = useListState(DROPS, { items: rows, path });

  // The keys of the grid: the union of the drops it shows (7.6.3).
  const keys: LootKey[] = useMemo(() => lootKeys(rows.map((row) => row.drop)), [rows]);

  // The Lista cells: text, the element as the static label of 7.2.4 (no panel in a cell
  // before or after the name, TT10), and «Uso» in the language it exists in (8.0.5, T22).
  const dropDeText = (drop: LootCardDrop): ReactNode => {
    const value = drop.dropDe;
    if (value === null || value === undefined) return null;
    return typeof value === 'string' ? value : value.name;
  };
  const elementCell = (drop: LootCardDrop): ReactNode => {
    const element = drop.element;
    if (element === null || element === undefined) return null;
    if (typeof element === 'string') return element;
    return <ElementChip element={element} variant="label" locale={locale} hint={hint} />;
  };
  const useCell = (drop: LootCardDrop): ReactNode => {
    if (drop.use === null || drop.use === undefined) return null;
    return drop.useLang ? <span lang={drop.useLang}>{drop.use}</span> : drop.use;
  };

  const views: Record<EntityView, (page: ListPage<ParityDrop>) => ReactNode> = {
    cards: (page) => (
      <CardGrid family="loot" headingLevel={3}>
        {page.items.map((row) => (
          <LootCard
            key={row.id}
            id={anchor(row)}
            drop={row.drop}
            keys={keys}
            labels={labels.loot}
            locale={locale}
            hint={hint}
          />
        ))}
      </CardGrid>
    ),
    slots: (page) => (
      <SlotsPanel label={labels.caption}>
        {page.items.map((row) => (
          <SlotsPanelItem key={row.id} id={anchor(row)}>
            <EntitySlot
              size={40}
              name={row.drop.name}
              sprite={row.drop.sprite}
              tip={row.tip}
              locale={locale}
              hint={hint}
            />
          </SlotsPanelItem>
        ))}
      </SlotsPanel>
    ),
    list: (page) => {
      const columns: DataTableColumn[] = [
        { key: 'sprite', label: labels.sprite, srOnly: true, width: WIDTHS.sprite },
        { key: 'item', label: labels.item },
        { key: 'droppedBy', label: labels.loot.droppedBy, width: WIDTHS.droppedBy },
        { key: 'element', label: labels.loot.element, width: WIDTHS.element },
        { key: 'use', label: labels.loot.use, width: WIDTHS.use },
      ];
      return (
        <DataTable caption={labels.caption} columns={columns} hover scroll>
          {page.items.map((row) => (
            <ListRow
              key={row.id}
              id={anchor(row)}
              sprite={<SpriteStage sprite={row.drop.sprite} size={40} tone="primary" />}
              name={row.drop.name}
              tip={row.tip}
              hint={hint}
              locale={locale}
              cells={[dropDeText(row.drop), elementCell(row.drop), useCell(row.drop)]}
            />
          ))}
        </DataTable>
      );
    },
  };

  const count = (total: number) =>
    fill(plural(locale, total, labels.count), { n: formatInteger(total, locale) });

  return (
    <EntityList
      controller={controller}
      labels={labels.list}
      count={count}
      empty={() => null}
      views={views}
      viewLabel={labels.view}
    />
  );
}
