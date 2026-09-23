import { useMemo } from 'react';
import type { ReactNode } from 'react';

import '@/styles/components/drops.css';

import { CardGrid } from '@/components/cards/CardGrid';
import { ListRow } from '@/components/cards/ListRow';
import { LootCard } from '@/components/cards/LootCard';
import type { LootCardDrop, LootCardEntity } from '@/components/cards/LootCard';
import { SlotsPanel, SlotsPanelItem } from '@/components/cards/SlotsPanel';
import { DataTable } from '@/components/content/DataTable';
import type { DataTableColumn } from '@/components/content/DataTable';
import { ElementChip } from '@/components/game/ElementChip';
import type { ElementChipEntry } from '@/components/game/ElementChip';
import { EntitySlot } from '@/components/game/EntitySlot';
import { NestedEntity } from '@/components/game/NestedEntity';
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
import type { TipData } from '@/lib/game/tips';
import type { EntityView, ListConfig, ListPage } from '@/lib/lists/state';

// DropsList (spec 8.3 «Drops», 8.0.6, 7.7; E15's sibling): the island of the `drops` list of
// the Pokémon page, one row per entry of `drops` of the record, in the three views. The page
// prerenders it and hydrates it with `client:visible`, inside its `Section` «Drops»
// (`id="drops"`), so the titles of its cards are `h3` (8.0.6).
//
// State (8.0.6): every row on one page (no pagination), no filter, one order — the order of
// the registry — and the parameters under the prefix `drops` (`drops.view=slots`), so they
// never mix with the Tier list of the same page (U1). The view is saved as `ac:vista:drops`.
//
// Views (8.3):
//   - Cards: `CardGrid family="loot"` of `LootCard` with the keys of the union (7.6.3) in
//     the order Drop de, Elemento, Uso, Cantidad, Precio NPC. The title is text: items have
//     no page in this cut (§15).
//   - Slots: `SlotsPanel` of one list with an `EntitySlot` of 40 (44 on a coarse pointer)
//     per drop; the trigger is a button that opens the item panel (`itemTip`).
//   - Lista: `DataTable` with the columns Sprite · Ítem · Drop de · Elemento · Uso — the three
//     last ones when a drop of the list has a value (V4, 7.6.3) — and a `ListRow` per drop
//     whose name opens the same panel.
//   Every view gives each drop the anchor `item-{id}` (H7).
//
// Values. The page reads the registries (§3.13) and hands each drop over already resolved:
// the sprite as `SpriteProps` (DP2), the panels as `TipData` (DP3), the element as
// `ElementChip` takes it. Two values are composed here, because they need the dictionary
// and the page's number format (DP1, 13.3): «Cantidad», «2» or «1 a 3» from
// `drops[].cantidad`, and «Drop de» of an item more than one Pokémon drops, «44 Pokémon».
// «Drop de» with a single Pokémon links to its page with its panel, in Cards and in Lista.
// Nothing is invented: a value the registry does not have is absent, and the card or the
// cell shows «—» only while another drop of the list has it (8.0.5).

/** One drop of the record (`drops` of `content/pokemon.json`, §3.13), already resolved. */
export interface DropEntry {
  /** `id` of the item: the React key and the anchor `item-{id}` (H7). */
  id: string;
  /** Name of the item, as the game writes it (13.4). */
  name: string;
  /** Sprite of the item, resolved by the adapter (DP2); `null` draws the missing mark. */
  sprite: SpriteProps | null;
  /** Panel of the item, `itemTip` (7.5.3): its slot and its Lista name open it. */
  tip: TipData;
  /**
   * «Drop de» (7.5.3): how many Pokémon of the registry drop the item, and the one that does
   * when there is only one, with its page and its panel (`pokemonTip`).
   */
  droppedBy: { count: number; pokemon: LootCardEntity | null };
  /** «Elemento»: the element of the item, as `ElementChip` takes it. */
  element: ElementChipEntry | null;
  /** «Uso» in the page's language, or in the other one with `useLang` (8.0.5, T22). */
  use: string | null;
  useLang?: Locale;
  /** `drops[].cantidad`. */
  quantity: { min: number; max: number } | null;
  /** «Precio NPC»: `precioNpc.vende` of the item, whole Pokédólares (S8). */
  npcPrice: number | null;
}

/** Every text of the list (DP1), from `ui` and the page's namespace. */
export interface DropsListLabels {
  /** `ui.views`, `ui.pagination`, `ui.prev`, `ui.next`, `ui.page` and `ui.dataError`. */
  list: EntityListLabels;
  /** «{n} drops», singular «1 drop» (8.3). */
  count: MessageLeaf;
  /** «Vista de drops» / «Drop view»: the name of the view group (8.3). */
  view: string;
  /** «Drops»: the name of the Slots list (`ui.cards.drops`). */
  slots: string;
  /** «Sprite»: header of the sprite column, for screen readers. */
  sprite: string;
  /** «Ítem» / «Item»: header of the name column. */
  item: string;
  /**
   * The label of each fact of the cards and the header of each Lista column: «Drop de»,
   * «Elemento», «Uso», «Precio NPC», «Precio de tienda» (`ui.tooltip`) and «Cantidad».
   */
  facts: Readonly<Record<LootKey, string>>;
  /** «{min} a {max}» / «{min} to {max}»: «Cantidad» of a range (§3.13). */
  quantityRange: string;
  /** «{n} Pokémon»: «Drop de» of an item that more than one Pokémon drops. */
  pokemonCount: MessageLeaf;
  /** Strip of every panel, `ui.pinHint`. */
  pinHint: string;
}

export interface DropsListProps {
  /** Picks the format of the figures, here and in the panels (C-R3). */
  locale: Locale;
  /** `/es/pokedex/charizard/`: the base of the list's URLs (H6). A prerendered page has no query. */
  path: string;
  /** The drops of the record, in its order. The page renders the list only with one or more. */
  drops: readonly DropEntry[];
  /** Caption of the Lista table, already written: «Drops de Charizard» / «Charizard drops». */
  caption: string;
  labels: DropsListLabels;
}

/** Cards from this index on load their sprite lazily (7.4.2). */
const EAGER_ART = 4;

/** The keys of the Lista view after Sprite and Ítem, in the order of 8.3. */
const LIST_KEYS: readonly LootKey[] = ['droppedBy', 'element', 'use'];

/** Widths of the Lista columns, from `Lienzo:Pokedex-Shiny-Charizard`. Ítem takes what is left. */
const LIST_WIDTHS: Partial<Record<LootKey | 'sprite', number>> = {
  sprite: 72,
  droppedBy: 180,
  element: 130,
  use: 240,
};

/**
 * The `drops` list of 8.0.6: every row on one page, no filter, the registry's order (a stable
 * sort that keeps it) and the prefix of the second list of a page (U1). Built once: it has no
 * input, and the list controller keys its effects on it.
 */
const CONFIG: ListConfig<DropEntry> = {
  id: 'drops',
  prefix: 'drops',
  pageSize: Number.POSITIVE_INFINITY,
  sorts: [{ id: 'registro', label: '', compare: () => 0 }],
  filters: [],
  anchorId: (drop) => `item-${drop.id}`,
};

/** R2: a panel with nothing to show below its title is not a tooltip. */
function hasContent(tip: TipData | null | undefined): tip is TipData {
  if (!tip) return false;
  return tip.rows.length > 0 || Boolean(tip.sections?.length) || Boolean(tip.market?.length);
}

/** A plural or a plain template, filled with the figure already formatted (13.2, 13.3). */
function counted(template: MessageLeaf, n: number, locale: Locale): string {
  const chosen = isPluralMessage(template) ? plural(locale, n, template) : template;
  return fill(chosen, { n: formatInteger(n, locale) });
}

/** «Cantidad» (8.3): «2» when both ends match, «1 a 3» otherwise. */
function quantityText(
  quantity: DropEntry['quantity'],
  locale: Locale,
  range: string,
): string | null {
  if (quantity === null) return null;
  const min = formatInteger(quantity.min, locale);
  if (quantity.max === quantity.min) return min;
  return fill(range, { min, max: formatInteger(quantity.max, locale) });
}

/** «Drop de» (7.5.3): the one Pokémon, «44 Pokémon», or nothing. */
function droppedByValue(
  drop: DropEntry,
  locale: Locale,
  labels: DropsListLabels,
): LootCardEntity | string | null {
  const { count, pokemon } = drop.droppedBy;
  if (count === 1 && pokemon !== null) return pokemon;
  if (count < 1) return null;
  return counted(labels.pokemonCount, count, locale);
}

/** A slot that opens nothing (R2): the frame of `EntitySlot` with the name for screen readers. */
function StaticSlot({ drop }: { drop: DropEntry }) {
  return (
    <span className="ac-entity-slot ac-entity-slot--40 ac-drops__static">
      <SpriteStage sprite={drop.sprite} size={32} framed={false} />
      <span className="sr-only">{drop.name}</span>
    </span>
  );
}

export function DropsList({ locale, path, drops, caption, labels }: DropsListProps) {
  const controller = useListState(CONFIG, { items: drops, path });
  const shown = controller.page.items;

  // The drops as `LootCard` reads them, and the keys of the union over the page (7.6.3).
  const cards = useMemo(
    () =>
      new Map(
        drops.map((drop): [string, LootCardDrop] => [
          drop.id,
          {
            name: drop.name,
            sprite: drop.sprite,
            dropDe: droppedByValue(drop, locale, labels),
            element: drop.element,
            use: drop.use,
            useLang: drop.useLang,
            qty: quantityText(drop.quantity, locale, labels.quantityRange),
            npcPrice: drop.npcPrice,
          },
        ]),
      ),
    [drops, locale, labels],
  );
  const keys = useMemo(
    () => lootKeys(shown.flatMap((drop) => cards.get(drop.id) ?? [])),
    [shown, cards],
  );

  const anchor = (drop: DropEntry) => CONFIG.anchorId?.(drop);

  /** A Lista cell of one of the keys of `LIST_KEYS`. */
  const listCell = (drop: DropEntry, key: LootKey): ReactNode => {
    const card = cards.get(drop.id);
    if (key === 'droppedBy') {
      const value = card?.dropDe ?? null;
      if (value === null || typeof value === 'string') return value;
      if (!hasContent(value.tip)) return value.name;
      return (
        <NestedEntity
          tip={value.tip}
          href={value.href}
          variant="link"
          placement="down"
          align="auto"
          locale={locale}
          hint={labels.pinHint}
        >
          {value.name}
        </NestedEntity>
      );
    }
    if (key === 'element') {
      // The Lista cell of an element is its label: it never opens a panel (DS:ElementChip).
      return drop.element === null ? null : (
        <ElementChip element={drop.element} variant="label" locale={locale} hint={labels.pinHint} />
      );
    }
    if (drop.use === null) return null;
    return drop.useLang === undefined ? drop.use : <span lang={drop.useLang}>{drop.use}</span>;
  };

  const views: Record<EntityView, (page: ListPage<DropEntry>) => ReactNode> = {
    cards: (page) => (
      <CardGrid family="loot" headingLevel={3}>
        {page.items.map((drop, index) => {
          const card = cards.get(drop.id);
          if (card === undefined) return null;
          return (
            <LootCard
              key={drop.id}
              id={anchor(drop)}
              drop={card}
              keys={keys}
              labels={labels.facts}
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
        {page.items.map((drop) => (
          <SlotsPanelItem key={drop.id} id={anchor(drop)}>
            {hasContent(drop.tip) ? (
              <EntitySlot
                size={40}
                name={drop.name}
                sprite={drop.sprite}
                tip={drop.tip}
                locale={locale}
                hint={labels.pinHint}
              />
            ) : (
              <StaticSlot drop={drop} />
            )}
          </SlotsPanelItem>
        ))}
      </SlotsPanel>
    ),
    list: (page) => {
      const listKeys = LIST_KEYS.filter((key) => keys.includes(key));
      const columns: DataTableColumn[] = [
        { key: 'sprite', label: labels.sprite, srOnly: true, width: LIST_WIDTHS.sprite },
        { key: 'item', label: labels.item },
        ...listKeys.map((key) => ({ key, label: labels.facts[key], width: LIST_WIDTHS[key] })),
      ];
      return (
        <DataTable caption={caption} columns={columns} hover scroll>
          {page.items.map((drop) => {
            const row = {
              id: anchor(drop),
              variant: 'drops' as const,
              nameAlign: 'center' as const,
              sprite: <SpriteStage sprite={drop.sprite} size={40} />,
              name: drop.name,
              locale,
              cells: listKeys.map((key) => listCell(drop, key)),
            };
            return hasContent(drop.tip) ? (
              <ListRow key={drop.id} {...row} tip={drop.tip} hint={labels.pinHint} />
            ) : (
              <ListRow key={drop.id} {...row} />
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
      // The list has no filter and the page renders it only with drops (8.3): nothing to say.
      empty={() => null}
      views={views}
      viewLabel={labels.view}
    />
  );
}
