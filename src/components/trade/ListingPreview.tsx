import '@/styles/components/listing-preview.css';

import { useState } from 'react';

import { ListingCard } from '@/components/cards/ListingCard';
import type {
  ListingCardEntity,
  ListingCardLabels,
  ListingCardListing,
  ListingFactValue,
} from '@/components/cards/ListingCard';
import type { SpriteProps } from '@/components/game/Sprite';
import {
  dropperEntity,
  elementChip,
  itemPanel,
  type ItemsData,
  type ItemsRow,
} from '@/components/items/config';
import type { HeldStripItem } from '@/components/money/HeldStrip';
import type { PriceOption } from '@/components/money/PriceOptions';
import type { PokedexElementRefs, PokedexRow } from '@/components/pokedex/config';
import type { Locale } from '@/i18n/config';
import { fill } from '@/i18n/messages/types';
import { listingLayout, type ListingKey } from '@/lib/cards/layout';
import { formatTier } from '@/lib/content/format';
import { resolvePokemonImage } from '@/lib/content/pokemon-media';
import { formatInteger, formatRealMoney, formatSigned } from '@/lib/format/numbers';
import { UNKNOWN, present } from '@/lib/format/unknown';
import { elementTip, itemTip, pokemonTip, type TipData, type TipLabels } from '@/lib/game/tips';
import type { SpriteData } from '@/lib/sprites/resolve';
import { parsePrice } from '@/lib/trade/draft';
import { entityName, knownAmount, listingTitle } from '@/lib/trade/title';
import type { Anuncio, UnidadPokemon } from '@/lib/trade/types';

// ListingPreview (spec 9.7.6, template G of 8.0.2): the live preview of the publish page. It is
// the real `ListingCard` of the list (7.2.6, §9.5.8) with `layout = listingLayout([borrador])`,
// built from the draft of the form on every change. The form (ListingForm.tsx) loads this module
// with `import()` the first time the draft has a title, so the card, its money and game pieces
// and the tooltip builders stay out of the initial JS of the page (13.6); it never renders on
// the server, where the draft is always empty.
//
// What the preview is, against a card of the list (9.7.6):
//
//   - the title does not link, and the meta line is «{Mundo} · ahora», the `<time>` of the
//     moment the preview was drawn;
//   - phase A has no account, so the footer carries the price rows alone: `ListingCard` always
//     closes its footer with «Vendedor» and «Contacto verificado», and listing-preview.css takes
//     both out of the layout and of the accessibility tree;
//   - it is not a live region (§12.20, 59–69): the form announces nothing on each change, and
//     only the Notice of the copy speaks.
//
// The values of the card follow §9.5.8, as the list writes them, from what the form already
// holds in the page's language: the draft (`Anuncio` of 9.4, with only the valid values of the
// fields), the Pokémon of `/{l}/pokedex/datos.json`, the items of `/{l}/items/datos.json` and the
// small registries the page passes in its props. The catalogue data of a Pokémon or an item
// (Requisito, Tier, Elementos, Categoría, Elemento, Uso, Drop de) are read from those registries
// and never stored in the draft (9.4). A declared name that matches no registry record is text,
// with no sprite and no panel (R2).

/** What the preview reads of a draft: the part of `Anuncio` the form writes (9.4). */
export type ListingPreviewDraft = Pick<
  Anuncio,
  'tipo' | 'pokemon' | 'item' | 'cantidad' | 'precio' | 'mundo'
>;

/** The data of the page and of its two data files the card is built from. */
export interface ListingPreviewData {
  /** Rows of `/{l}/pokedex/datos.json` by id (PR5). */
  pokemon: ReadonlyMap<string, PokedexRow>;
  /** `refs.elementos` of that file: every element, in the language of the page. */
  elements: PokedexElementRefs;
  /** Rows of `/{l}/items/datos.json` by id (PR5). */
  items: ReadonlyMap<string, ItemsRow>;
  /** `refs` of that file: the elements the items name and the Pokémon that drop them. */
  itemRefs: ItemsData['refs'];
  /** `nombre` of each Market category of content/items/categorias.json, by id. */
  categories: Readonly<Record<string, string>>;
  /** `nombre` of each aura of content/auras.json, by id. */
  auras: Readonly<Record<string, string>>;
  /** `nombre` of each world of content/mundos.json, by id. */
  worlds: Readonly<Record<string, string>>;
  /** Sprites the page resolved with the adapter (DP2). */
  sprites: ListingPreviewSprites;
  /** The Diamonds of the registry: their panel and the two lists of their `moneda` object. */
  diamonds: ListingPreviewDiamonds;
}

/** The fixed sprites of a preview stage (DP2): `null` while the registry has no key (R11). */
export interface ListingPreviewSprites {
  /** `ui/comercio/item`: an item whose declared name matches no record (9.7.3). */
  item: SpriteData | null;
  /** `ui/diamond`, animated: the Diamond spins in the stage of its listing (7.8). */
  diamond: SpriteData | null;
  /** `ui/pokedolares`. */
  pokedolares: SpriteData | null;
}

/** The `moneda` object of content/items/diamantes.json, in the language of the page (§3.13). */
export interface ListingPreviewDiamonds {
  /** `diamondsTip` (7.5.3), or `null` while the registry gives it no row (R2). */
  tip: TipData | null;
  /** «Se compran en». */
  boughtAt: readonly string[];
  /** «Se usan en». */
  usedFor: readonly string[];
}

/** Every text of the preview (DP1). */
export interface ListingPreviewLabels {
  /** The labels of `ListingCard`: its fact keys, footer rows, «Shiny», `ui.money`… */
  card: ListingCardLabels;
  /** `ui.tooltip`: the rows of the panels the card opens. */
  tooltip: TipLabels;
  /** The meta of a listing that is not published yet (9.7.6): «ahora» / «now». */
  now: string;
  /** The value of an NPC Price the NPC does not pay: «Unsellable», a game term. */
  unsellable: string;
}

export interface ListingPreviewProps {
  draft: ListingPreviewDraft;
  data: ListingPreviewData;
  labels: ListingPreviewLabels;
  locale: Locale;
  /** `ui.pinHint`: the strip of the panels the card opens. */
  hint: string;
  /** `ui.or`: the word between two price options (13.3). */
  orLabel: string;
}

/** The 300 wide panel of a held item (7.5.3). */
const HELD_WIDTH = 300;

/**
 * The panel of a declared name that matches no record: no row, so `HeldStrip` draws it as plain
 * text, without a trigger (R2).
 */
function plainTip(name: string): TipData {
  return {
    key: `item:${name}`,
    title: name,
    width: HELD_WIDTH,
    head: { type: 'sprite', sprite: null },
    rows: [],
  };
}

/** A declared amount of a card: a whole number the draft already checked, or `null`. */
function units(value: number | null | undefined): number | null {
  return knownAmount(value ?? null);
}

interface Built {
  facts: Partial<Record<ListingKey, ListingFactValue>>;
  sprite: SpriteProps | null;
  qty?: number | null;
  shiny?: boolean;
  helds?: HeldStripItem[];
  train?: ListingCardListing['train'];
}

/** The panel of an item row, with the name of its category (`itemPanel` of the Items list). */
function itemTipOf(row: ItemsRow, data: ListingPreviewData, props: ListingPreviewProps): TipData {
  return itemPanel(
    row,
    data.itemRefs,
    data.categories[row.categoria] ?? null,
    props.locale,
    props.labels.tooltip,
    itemTip,
  );
}

/** The Pokémon of a listing (§9.5.8): its catalogue facts and what the seller declared. */
function pokemonCard(unit: UnidadPokemon, props: ListingPreviewProps): Built {
  const { data, labels, locale } = props;
  const row = data.pokemon.get(unit.pokemon);
  const art = resolvePokemonImage(row?.imagen);

  const ball = unit.ball;
  let ballValue: ListingFactValue = null;
  if (ball !== null) {
    const record = ball.item === null ? undefined : data.items.get(ball.item);
    const name = entityName(ball.item, ball.nombre, (id) => data.items.get(id)?.nombre);
    ballValue =
      record === undefined
        ? name
        : ({
            name: record.nombre,
            sprite: record.sprite,
            tip: itemTipOf(record, data, props),
          } satisfies ListingCardEntity);
  }

  const npc = unit.precioNpc;
  const facts: Built['facts'] = {
    requirement:
      row?.nivel === null || row?.nivel === undefined
        ? null
        : fill(labels.tooltip.level, { n: formatInteger(row.nivel, locale) }),
    tier: row === undefined ? null : formatTier(row.tier),
    elements: (row?.elementos ?? []).flatMap((id) => {
      const ref = data.elements[id];
      return ref === undefined ? [] : [elementChip(id, ref, locale, labels.tooltip, elementTip)];
    }),
    ball: ballValue,
    aura: unit.aura === null ? null : (data.auras[unit.aura] ?? null),
    boost: unit.boost === null ? null : formatSigned(unit.boost, locale),
    nickname: unit.nickname,
    memorySlots: unit.memorySlots,
    starLevel: unit.starLevel,
    npcPrice:
      npc === null ? null : npc.tipo === 'unsellable' ? labels.unsellable : units(npc.cantidad),
  };

  const helds = unit.helds.map((held): HeldStripItem => {
    const record = held.item === null ? undefined : data.items.get(held.item);
    const name = record?.nombre ?? held.nombre;
    return {
      name,
      tier: formatTier(held.tier),
      sprite: record?.sprite ?? null,
      tip: record === undefined ? plainTip(name) : itemTipOf(record, data, props),
    };
  });

  // The card shows the first declared skill, in the order of `Habilidad` (§9.5.8), as
  // «Attack 16 (53%)»: the one whose level and progress are both known, since the meter cannot
  // draw a part of it (TrainingMeter).
  let train: ListingCardListing['train'] = null;
  for (const skill of unit.entrenamiento) {
    const percent = skill.progreso === null ? Number.NaN : Number(skill.progreso);
    if (skill.nivel !== null && Number.isFinite(percent)) {
      train = { stat: skill.habilidad, level: skill.nivel, percent };
      break;
    }
  }

  return {
    facts,
    sprite: art === null ? null : { src: art, smooth: true },
    shiny: row?.variante === 'shiny',
    helds,
    train,
  };
}

/** The item of an items listing (§9.5.8): its quantity and the facts of its record. */
function itemsCard(
  item: NonNullable<ListingPreviewDraft['item']>,
  props: ListingPreviewProps,
): Built {
  const { data, labels, locale } = props;
  const record = item.item === null ? undefined : data.items.get(item.item);
  const quantity = units(item.cantidad);

  let droppedBy: ListingFactValue = null;
  const droppers = record?.dropDe ?? [];
  if (droppers.length === 1) {
    const id = droppers[0];
    const ref = data.itemRefs.pokemon[id];
    if (ref !== undefined) droppedBy = dropperEntity(id, ref, locale, labels.tooltip, pokemonTip);
  } else if (droppers.length > 1) {
    droppedBy = droppers.flatMap((id) => data.itemRefs.pokemon[id]?.nombre ?? []);
  }

  const element = record?.elemento ?? null;
  const elementRef = element === null ? undefined : data.itemRefs.elementos[element];
  // The sprite of the record, whose frame follows the quantity on a `cantidad` sheet (9.7.3);
  // without a record, `ui/comercio/item`.
  const sprite: SpriteProps | null =
    record === undefined
      ? data.sprites.item
      : record.sprite === null
        ? null
        : { ...record.sprite, ...(quantity === null ? {} : { quantity }) };

  return {
    facts: {
      quantity,
      category: record === undefined ? null : (data.categories[record.categoria] ?? null),
      element:
        element === null || elementRef === undefined
          ? null
          : elementChip(element, elementRef, locale, labels.tooltip, elementTip),
      use: record?.uso ?? null,
      droppedBy,
    },
    sprite,
    qty: quantity,
  };
}

/** The card of the draft, or `null` while it has no title (9.4). */
export function previewListing(
  props: ListingPreviewProps,
  posted: { datetime: string; text: string },
): ListingCardListing | null {
  const { draft, data, locale } = props;
  const title = listingTitle(draft, locale, {
    pokemon: (id) => data.pokemon.get(id)?.nombre,
    item: (id) => data.items.get(id)?.nombre,
  });
  if (title.texto === UNKNOWN) return null;

  let built: Built;
  if (draft.tipo === 'pokemon' && draft.pokemon !== undefined) {
    built = pokemonCard(draft.pokemon, props);
  } else if (draft.tipo === 'items' && draft.item !== undefined) {
    built = itemsCard(draft.item, props);
  } else if (draft.tipo === 'diamonds') {
    const quantity = units(draft.cantidad);
    built = {
      facts: {
        quantity,
        boughtAt: [...data.diamonds.boughtAt],
        usedFor: [...data.diamonds.usedFor],
      },
      sprite: data.sprites.diamond,
      qty: quantity,
    };
  } else if (draft.tipo === 'pokedolares') {
    built = { facts: { quantity: units(draft.cantidad) }, sprite: data.sprites.pokedolares };
  } else {
    return null;
  }

  const { precio } = draft;
  const real = precio.real;
  const fiatValue = real === null ? null : parsePrice(real.importe, real.moneda, locale);
  const game: PriceOption[] = precio.juego.flatMap((option) => {
    const amount = units(option.cantidad);
    if (amount === null) return [];
    return [{ kind: option.tipo === 'pokedolares' ? 'pd' : 'dia', amount }];
  });
  const world = data.worlds[draft.mundo];

  return {
    type: draft.tipo,
    title: title.texto,
    titleAccessible: title.accesible,
    sprite: built.sprite,
    qty: built.qty,
    shiny: built.shiny,
    world: present(world) ? world : null,
    posted,
    facts: built.facts,
    helds: built.helds,
    train: built.train,
    fiat:
      real === null || fiatValue === null ? null : formatRealMoney(fiatValue, real.moneda, locale),
    game,
    negotiable: precio.aConvenir,
  };
}

/**
 * The preview card of 9.7.6, or nothing while the draft has no title. Its title is an `h2`: the
 * page has the `h1` and the form has no other heading (7.6.2, WA2).
 */
export function ListingPreview(props: ListingPreviewProps) {
  const { labels, locale, hint, orLabel, data } = props;
  // «ahora»: the moment the preview was first drawn. The card is only drawn in the client, so
  // the `<time>` never has to agree with a server render.
  const [now] = useState(() => new Date().toISOString());
  const listing = previewListing(props, { datetime: now, text: labels.now });
  if (listing === null) return null;

  return (
    <div className="ac-listing-preview">
      <ListingCard
        listing={listing}
        layout={listingLayout([listing])}
        labels={labels.card}
        locale={locale}
        hint={hint}
        orLabel={orLabel}
        diamonds={{ tip: data.diamonds.tip }}
        headingLevel={2}
      />
    </div>
  );
}
