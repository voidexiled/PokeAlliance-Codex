import { useMemo } from 'react';
import type { ReactNode } from 'react';

import '@/styles/components/drops.css';

import { CardGrid } from '@/components/cards/CardGrid';
import { DexCard } from '@/components/cards/DexCard';
import type { DexCardDrop, DexCardEntry, DexCardLabels } from '@/components/cards/DexCard';
import { SlotsPanel, SlotsPanelItem } from '@/components/cards/SlotsPanel';
import { DataTable } from '@/components/content/DataTable';
import type { DataTableColumn, DataTableRow } from '@/components/content/DataTable';
import { ElementChip } from '@/components/game/ElementChip';
import type { ElementChipEntry } from '@/components/game/ElementChip';
import { EntitySlot } from '@/components/game/EntitySlot';
import { NestedEntity } from '@/components/game/NestedEntity';
import { PokemonArt } from '@/components/game/ShinyMark';
import type { SpriteProps } from '@/components/game/Sprite';
import { EntityList } from '@/components/lists/EntityList';
import type { EntityListLabels } from '@/components/lists/EntityList';
import { useListState } from '@/components/lists/useListState';
import type { Locale } from '@/i18n/config';
import type { MessageLeaf } from '@/i18n/messages/types';
import { fill, isPluralMessage, plural } from '@/i18n/messages/types';
import { dexLayout } from '@/lib/cards/layout';
import { resolvePokemonImage } from '@/lib/content/pokemon-media';
import type { PokemonRecord } from '@/lib/content/types';
import { formatInteger } from '@/lib/format/numbers';
import { pokemonTip } from '@/lib/game/tips';
import type { LocalizedText, TipData, TipLabels } from '@/lib/game/tips';
import type { EntityView, ListConfig, ListPage } from '@/lib/lists/state';

// FamilyList (spec 8.3 «Tier list», E15, 8.0.6, 7.7): the island of the `familia` list of the
// Pokémon page — the evolution line with its variants when the record has `evolucion`, the
// records with the same `numero` when it does not; the page picks the rows and renders the
// list only with two or more (8.3). It is prerendered and hydrated with `client:visible`
// inside its `Section` «Tier list» (`id="tier-list"`), so card titles are `h3` (8.0.6).
//
// State (8.0.6): every row on one page, no filter, one order — the Pokémon order of 8.0.5 —
// the parameters under the prefix `familia` (U1) and Lista as the default view (E15): with
// no view in the URL and none saved in `ac:vista:familia`, the page opens on the table.
//
// Views (8.3):
//   - Lista, the table of `Lienzo:Pokedex-Shiny-Charizard`: the columns Pokémon, Tier and
//     Moveset — Tier only when a row has a tier, Moveset only when a row has `elementoMoveset`
//     (8.0.5) — with 40 px rows and no sprite column. Each name opens `pokemonTip` 12 px to
//     its right. The table has no row hover:
//     the board draws none, and only the name reacts. `ListRow` always draws a sprite cell,
//     which this table does not have, so the rows are `DataTable` rows whose name cell holds
//     the `NestedEntity` that `ListRow` would have put there.
//   - Cards: `CardGrid family="pokedex"` of `DexCard`, as in the Pokédex (8.2).
//   - Slots: `SlotsPanel` of one list with an `EntitySlot` of 72, as in the Pokédex (8.2).
//   Every view gives each row the anchor `pokemon-{id}` (H7).
//
// The entry of the page itself, in the three views: no link and no panel, and
// `aria-current="page"` on its name (8.3). In Lista its name is text with the attribute and
// its row is bold, as DS:DataTable draws the page's own row — but not through the row's
// `current`, which would put the attribute on the `tr` instead of the name (drops.css bolds
// the row that holds it); in Slots its slot is the frame with the art and
// `aria-current="page"`, and opens nothing; in Cards its title is text with
// `aria-current="page"` (`current` of `DexCard`). Its elements and drops stay entities with
// panels: only the entry itself is not.
//
// Values. The page hands every row over with the record's own fields and ids (DP2, DP3), and
// what those ids name once, however many rows share it: each element as `ElementChip` takes
// it, panel included, and each drop as `DexCard` takes it. The panel of each variant
// (`pokemonTip`, 7.5.3) is built here, on the server and on hydration alike, from the record
// and the names of its elements, so the props of a large family stay within the 20 KB of
// 13.6 (21 Smeargle variants carried 32 KB with a panel and the chips per row). Nothing is
// invented: a value the registry does not have is absent, and a table cell or a card fact
// shows «—» only while another row has it (8.0.5).

/** A variant of the family: the fields of its record (§3.13) that its views show. */
export interface FamilyEntry extends Pick<
  PokemonRecord,
  | 'id'
  | 'nombre'
  | 'numero'
  | 'generacion'
  | 'variante'
  | 'nivel'
  | 'tier'
  | 'funcion'
  | 'imagen'
  | 'elementos'
> {
  /** Items of its drops, in the order of the registry: keys of `items` (the card's drop zone). */
  drops?: readonly string[];
  /** `elementoMoveset` (§3.13), a key of `elements`, or `null`: the Moveset column. */
  moveset: string | null;
}

/** Every text of the list (DP1), from `ui` and the page's namespace. */
export interface FamilyListLabels {
  /** `ui.views`, `ui.pagination`, `ui.prev`, `ui.next`, `ui.page` and `ui.dataError`. */
  list: EntityListLabels;
  /** «{n} variantes» / «{n} variants», singular «1 variante» (8.3). */
  count: MessageLeaf;
  /** «Vista de la Tier list» / «Tier list view»: the name of the view group (8.3). */
  view: string;
  /** «Tier list»: the name of the Slots list. */
  slots: string;
  /** Headers of the Lista columns: «Pokémon», «Tier» and «Moveset». */
  pokemon: string;
  tier: string;
  moveset: string;
  /** Every text of `DexCard` (Cards view). */
  card: DexCardLabels;
  /** Strip of every panel, `ui.pinHint`. */
  pinHint: string;
  /** `ui.shiny`: accessible name of the Shiny mark in the panels (13.4). */
  shiny: string;
  /** `ui.tooltip`: the row labels of the Pokémon panel (7.5.3). */
  tooltip: TipLabels;
}

export interface FamilyListProps {
  /** Picks the format of the figures and the order of the names (C-R3, 8.0.5). */
  locale: Locale;
  /** `/es/pokedex/charizard/`: the base of the list's URLs (H6). A prerendered page has no query. */
  path: string;
  /** `id` of the page's own Pokémon, one of `entries`. */
  current: string;
  /** The variants of the family, in any order: the list sorts them (8.0.5). */
  entries: readonly FamilyEntry[];
  /**
   * The elements the rows name — in `elementos` and in `moveset` — by id, as `ElementChip`
   * takes them, panels included. An id without an entry is not shown.
   */
  elements: Readonly<Record<string, ElementChipEntry>>;
  /** The items the rows drop, by id, as the drop zone of `DexCard` takes them. */
  items?: Readonly<Record<string, DexCardDrop>>;
  /**
   * Caption of the Lista table, already written: «Tier list de la familia de Charmander» with
   * `evolucion`, «Variantes de Nº 6» without it (8.3).
   */
  caption: string;
  labels: FamilyListLabels;
}

/** Cards and slots from this index on load their art lazily (7.4.2). */
const EAGER_ART = 4;

/** Widths of the Lista columns, from `Lienzo:Pokedex-Shiny-Charizard`. Pokémon takes the rest. */
const LIST_WIDTHS = { tier: 200, moveset: 240 };

/** Size of the art in the 72 slot: 8 px less than the slot (DS:EntitySlot). */
const SLOT_ART = 64;

/** `variante` of 8.0.5: `normal` before `shiny`, any other value after both. */
function variantRank(variante: string): number {
  if (variante === 'normal') return 0;
  return variante === 'shiny' ? 1 : 2;
}

/**
 * The order of Pokémon in every list (8.0.5): `numero` ascending with the unknown ones last,
 * `normal` before `shiny`, then `nombre` compared in the page's language.
 */
function pokemonOrder(locale: Locale): (a: FamilyEntry, b: FamilyEntry) => number {
  const collator = new Intl.Collator(locale);
  return (a, b) => {
    if (a.numero !== b.numero) {
      if (a.numero === null) return 1;
      if (b.numero === null) return -1;
      return a.numero - b.numero;
    }
    const variant = variantRank(a.variante) - variantRank(b.variante);
    return variant !== 0 ? variant : collator.compare(a.nombre, b.nombre);
  };
}

/** The configuration of the `familia` list (8.0.6, E15), the same on the server and the client. */
function familyConfig(locale: Locale): ListConfig<FamilyEntry> {
  return {
    id: 'familia',
    prefix: 'familia',
    pageSize: Number.POSITIVE_INFINITY,
    sorts: [{ id: 'numero', label: '', compare: pokemonOrder(locale) }],
    filters: [],
    defaultView: 'list',
    anchorId: (entry) => `pokemon-${entry.id}`,
  };
}

/** A plural or a plain template, filled with the figure already formatted (13.2, 13.3). */
function counted(template: MessageLeaf, n: number, locale: Locale): string {
  const chosen = isPluralMessage(template) ? plural(locale, n, template) : template;
  return fill(chosen, { n: formatInteger(n, locale) });
}

/** The values of `ids` that `table` has, in their order: an unknown id is not shown. */
function pick<T>(table: Readonly<Record<string, T>> | undefined, ids: readonly string[]): T[] {
  return ids.flatMap((id) => {
    const value = table?.[id];
    return value === undefined ? [] : [value];
  });
}

/** A variant as `DexCard` reads it (8.0.5, 8.2); the page's own entry has no link. */
function dexEntry(
  entry: FamilyEntry,
  locale: Locale,
  self: boolean,
  elements: FamilyListProps['elements'],
  items: FamilyListProps['items'],
): DexCardEntry {
  return {
    name: entry.nombre,
    href: self ? undefined : `/${locale}/pokedex/${entry.id}/`,
    number: entry.numero,
    generation: entry.generacion,
    art: resolvePokemonImage(entry.imagen),
    level: entry.nivel,
    tierValue: entry.tier,
    role: entry.funcion,
    variant: entry.variante === 'shiny' || entry.variante === 'normal' ? entry.variante : null,
    elements: pick(elements, entry.elementos),
    drops: entry.drops === undefined ? undefined : pick(items, entry.drops),
    ...(self ? { current: true } : {}),
  };
}

/**
 * The slot of the page's own entry: the frame and the art of a 72 `EntitySlot`, with no
 * trigger inside (8.3), `aria-current="page"` and the name for screen readers.
 */
function SelfSlot({ entry, art }: { entry: FamilyEntry; art: SpriteProps | null }) {
  return (
    <span className="ac-entity-slot ac-entity-slot--72 ac-drops__static" aria-current="page">
      {/* The art at 64 with the Shiny glow, or the client Pokédex «?» (plan «Shiny», «?»). */}
      <PokemonArt src={art?.src ?? null} size={SLOT_ART} shiny={entry.variante === 'shiny'} />
      <span className="sr-only">{entry.nombre}</span>
    </span>
  );
}

export function FamilyList({
  locale,
  path,
  current,
  entries,
  elements,
  items,
  caption,
  labels,
}: FamilyListProps) {
  const config = useMemo(() => familyConfig(locale), [locale]);
  const controller = useListState(config, { items: entries, path });
  const shown = controller.page.items;

  // The panel of a variant (7.5.3). A name of `elements` is already in the page's language,
  // the only one the builder reads.
  const tipOf = (entry: FamilyEntry): TipData =>
    pokemonTip(
      {
        ...entry,
        elementos: pick(elements, entry.elementos).map((element) => ({
          nombre: { [locale]: element.name } as LocalizedText,
        })),
      },
      locale,
      labels.tooltip,
    );

  const href = (entry: FamilyEntry) => `/${locale}/pokedex/${entry.id}/`;
  const anchor = (entry: FamilyEntry) => config.anchorId?.(entry);
  const lazy = (index: number) => (index >= EAGER_ART ? 'lazy' : undefined);

  // The union of the cards of the list (7.6.3), over the rows as the view shows them.
  const layout = useMemo(
    () =>
      dexLayout(
        shown.map((entry) => dexEntry(entry, locale, entry.id === current, elements, items)),
      ),
    [shown, locale, current, elements, items],
  );

  const views: Record<EntityView, (page: ListPage<FamilyEntry>) => ReactNode> = {
    list: (page) => {
      const movesetOf = (entry: FamilyEntry) =>
        entry.moveset === null ? undefined : elements[entry.moveset];
      const withMoveset = page.items.some((entry) => movesetOf(entry) !== undefined);
      // 8.0.5: a key no row has disappears, so a family without any tier has no Tier column.
      const withTier = page.items.some((entry) => entry.tier !== null);
      const columns: DataTableColumn[] = [
        { key: 'pokemon', label: labels.pokemon },
        ...(withTier ? [{ key: 'tier', label: labels.tier, width: LIST_WIDTHS.tier }] : []),
        ...(withMoveset
          ? [{ key: 'moveset', label: labels.moveset, width: LIST_WIDTHS.moveset }]
          : []),
      ];
      const rows: DataTableRow[] = page.items.map((entry) => {
        const self = entry.id === current;
        // The anchor wraps the name, whose trigger the list controller focuses (H7): a
        // `DataTable` row carries no attribute of its own.
        const name = self ? (
          <span id={anchor(entry)} className="ac-family__self" aria-current="page">
            {entry.nombre}
          </span>
        ) : (
          <span id={anchor(entry)} className="ac-family__name">
            <NestedEntity
              tip={tipOf(entry)}
              href={href(entry)}
              variant="link"
              placement="row"
              locale={locale}
              hint={labels.pinHint}
              shinyLabel={labels.shiny}
            >
              {entry.nombre}
            </NestedEntity>
          </span>
        );
        const moveset = movesetOf(entry);
        return {
          key: entry.id,
          cells: {
            pokemon: name,
            tierValue: entry.tier,
            moveset:
              moveset === undefined ? null : (
                <ElementChip
                  element={moveset}
                  variant="label"
                  locale={locale}
                  hint={labels.pinHint}
                />
              ),
          },
        };
      });
      return <DataTable caption={caption} columns={columns} rows={rows} scroll />;
    },
    cards: (page) => (
      <CardGrid family="pokedex" headingLevel={3}>
        {page.items.map((entry, index) => {
          const self = entry.id === current;
          return (
            <DexCard
              key={entry.id}
              id={anchor(entry)}
              entry={dexEntry(entry, locale, self, elements, items)}
              layout={layout}
              labels={labels.card}
              locale={locale}
              hint={labels.pinHint}
              loading={lazy(index)}
            />
          );
        })}
      </CardGrid>
    ),
    slots: (page) => (
      <SlotsPanel label={labels.slots}>
        {page.items.map((entry, index) => {
          const source = resolvePokemonImage(entry.imagen);
          const art: SpriteProps | null =
            source === null ? null : { src: source, smooth: true, loading: lazy(index) };
          return (
            <SlotsPanelItem key={entry.id} id={anchor(entry)}>
              {entry.id === current ? (
                <SelfSlot entry={entry} art={art} />
              ) : (
                <EntitySlot
                  size={72}
                  name={entry.nombre}
                  sprite={art}
                  tip={tipOf(entry)}
                  shiny={entry.variante === 'shiny'}
                  href={href(entry)}
                  locale={locale}
                  hint={labels.pinHint}
                  shinyLabel={labels.shiny}
                />
              )}
            </SlotsPanelItem>
          );
        })}
      </SlotsPanel>
    ),
  };

  return (
    <EntityList
      controller={controller}
      labels={labels.list}
      count={(n) => counted(labels.count, n, locale)}
      // The list has no filter and the page renders it only with two variants or more (8.3).
      empty={() => null}
      views={views}
      viewLabel={labels.view}
    />
  );
}
