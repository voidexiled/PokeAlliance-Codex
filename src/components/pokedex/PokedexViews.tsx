import type { ReactNode } from 'react';

import type { DexCardDrop } from '@/components/cards/DexCard';
import { ListRow } from '@/components/cards/ListRow';
import { SlotsPanel, SlotsPanelItem } from '@/components/cards/SlotsPanel';
import { DataTable } from '@/components/content/DataTable';
import type { DataTableColumn } from '@/components/content/DataTable';
import { Button } from '@/components/controls/Button';
import type { ElementChipEntry } from '@/components/game/ElementChip';
import { ElementIcon } from '@/components/game/ElementIcon';
import { EntitySlot } from '@/components/game/EntitySlot';
import type { SpriteProps } from '@/components/game/Sprite';
import { TierValue } from '@/components/game/TierBadge';
import type { PokedexElementRef, PokedexItemRef, PokedexRow } from '@/components/pokedex/config';
import type { Locale } from '@/i18n/config';
import type { Messages } from '@/i18n/messages/en';
import { fill } from '@/i18n/messages/types';
import type { DexKey, DexLayout } from '@/lib/cards/layout';
import { resolvePokemonImage } from '@/lib/content/pokemon-media';
import { formatInteger } from '@/lib/format/numbers';
import { elementTip, itemTip, pokemonTip } from '@/lib/game/tips';
import type { LocalizedText, TipData, TipLabels } from '@/lib/game/tips';
import type { ListPage } from '@/lib/lists/state';

// The deferred part of the `pokedex` list (spec 8.2, 7.7.4, 13.6; `Lienzo:Pokedex`): what the
// island only draws when its state asks for it. Cards is the view the page prerenders and
// hydrates, so it lives in PokedexRoot.tsx; the island loads this module as one deferred
// chunk (`import()`) with the components and the tooltip builders it needs, which keeps the
// initial JS of the page within its budget:
//   - the Slots and Lista views (8.2 step 5);
//   - `elementEntry` and `itemEntry`, the chip of an element and the drop of an item that
//     the props did not bring, each with its panel (7.5.3, DP3);
//   - `clearFilters`, the action of the empty state (V7).
//
//   - Slots: one `SlotsPanel inventory`, the 12-column grid of the board that ends flush (plan
//     «Slots»), no generation groups; an `EntitySlot` of 72 with the art (the Shiny glow, the
//     «?» without art), the link to the sheet and the panel of `pokemonTip`.
//   - Lista: `DataTable` with its caption and the columns Sprite (screen readers only), Nº,
//     Nombre, then the keys of the union in the order of 8.2 (Elementos, Tier, Requisito,
//     Rol, Variante); one `ListRow variant="pokedex"` per row with the same panel. The
//     elements are `ElementIcon`s, the Tier a `TierValue` (dotted, «Max brokes: —») and the
//     Variante plain text.
//   Every view gives each row the anchor `pokemon-{id}` (H7).

/** What both views take from the island: its state, its texts and its helpers. */
export interface PokedexViewContext {
  locale: Locale;
  /** `messages.ui` of the page's locale. */
  ui: Messages['ui'];
  /** `messages.pokedex` of the page's locale: the captions and the column headers. */
  pokedex: Messages['pokedex'];
  /** «Pokédex», the name of the page: the name of the Slots panel. */
  title: string;
  /** Every element of the registry by id, with its name: the «Elementos» row of a panel. */
  names: ReadonlyMap<string, string>;
  /** The union of the page (7.6.3): the Lista takes its columns from it. */
  layout: DexLayout;
  /** The element chips of a row, in the order of its record. */
  elementsOf: (row: PokedexRow) => ElementChipEntry[];
  /** The anchor of a row (H7). */
  anchor: (row: PokedexRow) => string | undefined;
  /** Whether the art at `index` of the page loads lazily (7.4.2). */
  lazy: (index: number) => 'lazy' | undefined;
  /**
   * The caption of the Lista. Without it the caption follows «Variante» (8.2); the Tier
   * list keeps one caption, its h1, whatever the variant (8.8 step 5).
   */
  caption?: string;
}

/** The keys of the Lista view after Nº and Nombre, in the order of 8.2. */
const LIST_KEYS: readonly DexKey[] = ['tier', 'requirement', 'role', 'variant'];

/**
 * Widths of the Lista columns as `Lienzo:Pokedex` lays them out at 1440 (944 wide, 942 inside
 * the border). The board declares 64 · 64 · 220 · auto · 120 · 130 · 90 · 130 and its
 * automatic table layout, driven by the element chips it draws, settles them at these, to
 * the hundredth of a pixel. Written as they come out, the table has the board's columns
 * whatever the chips of the page measure. With the Elementos column, it takes what is left
 * (215.58 at 1440); without it, Nombre does.
 */
const LIST_WIDTHS = {
  sprite: 65,
  number: 62.3,
  name: 175.27,
  tier: 114.66,
  requirement: 116.72,
  role: 78.11,
  variant: 114.38,
};

const href = (row: PokedexRow, locale: Locale) => `/${locale}/pokedex/${row.id}/`;

/**
 * An element of `refs` (PR5) as `ElementChip` takes it, with its panel (7.5.3): the name is in
 * the language of the file, the only one the builder reads.
 */
export function elementEntry(
  id: string,
  ref: PokedexElementRef,
  locale: Locale,
  labels: TipLabels,
): ElementChipEntry {
  const nombre = { [locale]: ref.nombre } as LocalizedText;
  return {
    id,
    name: ref.nombre,
    icon: ref.icono,
    tip: elementTip({ ...ref, id, nombre }, locale, labels),
  };
}

/**
 * An item of `refs` (PR5) as the zone «Drops» of `DexCard` takes it, with its panel (7.5.3):
 * its «Drop de» is the names of the rows whose `drops` hold it, in the order of the rows,
 * which is the order of 8.0.5 — the one the build writes into the panels of the first page.
 */
export function itemEntry(
  id: string,
  ref: PokedexItemRef,
  rows: readonly PokedexRow[],
  locale: Locale,
  labels: TipLabels,
): DexCardDrop {
  const nombreCategoria =
    ref.nombreCategoria === null ? null : ({ [locale]: ref.nombreCategoria } as LocalizedText);
  const dropDe = rows.filter((row) => row.drops?.includes(id)).map((row) => row.nombre);
  return {
    name: ref.nombre,
    sprite: ref.sprite,
    tip: itemTip({ ...ref, id, nombreCategoria, dropDe }, locale, labels),
  };
}

/** V7 and 8.2: the one action of the empty state goes back to the whole list. */
export function clearFilters(path: string, label: string): ReactNode {
  return <Button href={path}>{label}</Button>;
}

/**
 * The panel of a slot and of a Lista name (7.5.3): Requisito, Tier, Elementos, Generación and
 * Rol. A name here is already in the page's language, the only one the builder reads.
 */
export function tipOf(row: PokedexRow, context: PokedexViewContext): TipData {
  const { locale, names, ui } = context;
  return pokemonTip(
    {
      ...row,
      elementos: row.elementos.flatMap((id) => {
        const name = names.get(id);
        return name === undefined ? [] : [{ nombre: { [locale]: name } as LocalizedText }];
      }),
    },
    locale,
    ui.tooltip,
  );
}

/** The Slots view (8.2 step 5; plan «Slots»): one inventory grid, the page in its order. */
export function pokedexSlots(page: ListPage<PokedexRow>, context: PokedexViewContext): ReactNode {
  const { locale, ui, title, anchor, lazy } = context;
  return (
    <SlotsPanel label={title} inventory>
      {page.items.map((row, index) => {
        const source = resolvePokemonImage(row.imagen);
        const sprite: SpriteProps | null =
          source === null ? null : { src: source, smooth: true, loading: lazy(index) };
        return (
          <SlotsPanelItem key={row.id} id={anchor(row)}>
            <EntitySlot
              size={72}
              name={row.nombre}
              sprite={sprite}
              art
              tip={tipOf(row, context)}
              shiny={row.variante === 'shiny'}
              href={href(row, locale)}
              locale={locale}
              hint={ui.pinHint}
              shinyLabel={ui.shiny}
            />
          </SlotsPanelItem>
        );
      })}
    </SlotsPanel>
  );
}

/** The Lista view (8.2 step 5). */
export function pokedexList(page: ListPage<PokedexRow>, context: PokedexViewContext): ReactNode {
  const { locale, ui, pokedex, layout, elementsOf, anchor, lazy } = context;

  // Variante as text: «Shiny» names the variant, the glow is on the art (plan «Shiny»).
  const variantValue = (row: PokedexRow): ReactNode =>
    row.variante === 'shiny' ? ui.shiny : row.variante === 'normal' ? ui.cards.normal : null;

  const listValue = (row: PokedexRow, key: DexKey): ReactNode => {
    switch (key) {
      case 'tier':
        // A hidden tier (ULTIMATE) draws nothing: the cell writes «—».
        return (
          <TierValue tier={row.tier} maxBrokesLabel={ui.filterBar.maxBrokes} locale={locale} />
        );
      case 'requirement':
        return row.nivel === null
          ? null
          : fill(ui.tooltip.level, { n: formatInteger(row.nivel, locale) });
      case 'role':
        return row.funcion;
      case 'variant':
        return variantValue(row);
    }
  };

  // The icons of the Elementos cell, 4 apart; a row without elements shows «—» (ListRow).
  const elementCell = (row: PokedexRow): ReactNode => {
    const own = elementsOf(row);
    if (own.length === 0) return null;
    return (
      <span className="inline-flex gap-4">
        {own.map((element) => (
          <ElementIcon key={element.id} element={element} />
        ))}
      </span>
    );
  };

  const headers: Record<DexKey, string> = {
    tier: ui.tooltip.tier,
    requirement: ui.tooltip.requirement,
    role: ui.tooltip.role,
    variant: ui.cards.variant,
    moveset: pokedex.moveset,
  };
  const listKeys = LIST_KEYS.filter((key) => layout.keys.includes(key));
  const withElements = layout.zones.includes('elements');
  const columns: DataTableColumn[] = [
    { key: 'sprite', label: pokedex.columnSprite, srOnly: true, width: LIST_WIDTHS.sprite },
    { key: 'number', label: pokedex.columnNumber, width: LIST_WIDTHS.number },
    {
      key: 'name',
      label: pokedex.columnName,
      width: withElements ? LIST_WIDTHS.name : undefined,
    },
    ...(withElements ? [{ key: 'elements', label: ui.tooltip.elements }] : []),
    ...listKeys.map((key) => ({
      key,
      label: headers[key],
      width: (LIST_WIDTHS as Partial<Record<string, number>>)[key],
    })),
  ];

  const variant = page.state.filters.variante;
  const caption =
    context.caption ??
    (variant === 'shiny'
      ? pokedex.captionShiny
      : variant === 'normal'
        ? pokedex.captionNormal
        : pokedex.caption);
  return (
    <DataTable caption={caption} columns={columns} hover scroll>
      {page.items.map((row, index) => {
        const source = resolvePokemonImage(row.imagen);
        const cells = listKeys.map((key) => listValue(row, key));
        return (
          <ListRow
            key={row.id}
            id={anchor(row)}
            variant="pokedex"
            nameAlign="center"
            art={{ src: source, shiny: row.variante === 'shiny', loading: lazy(index) }}
            name={row.nombre}
            href={href(row, locale)}
            tip={tipOf(row, context)}
            hint={ui.pinHint}
            shinyLabel={ui.shiny}
            locale={locale}
            lead={[row.numero === null ? null : String(row.numero)]}
            cells={withElements ? [elementCell(row), ...cells] : cells}
          />
        );
      })}
    </DataTable>
  );
}
