import '@/styles/components/listing-preview.css';

import { useState } from 'react';

import { ListingCard } from '@/components/cards/ListingCard';
import type {
  ListingCardEquipment,
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
import type { EquipmentStripItem } from '@/components/money/EquipmentStrip';
import type { PriceOption } from '@/components/money/PriceOptions';
import type { PokedexElementRefs, PokedexRow } from '@/components/pokedex/config';
import type { Locale } from '@/i18n/config';
import { fill } from '@/i18n/messages/types';
import { listingLayout, type ListingKey } from '@/lib/cards/layout';
import { formatTier } from '@/lib/content/format';
import { resolvePokemonImage } from '@/lib/content/pokemon-media';
import { formatInteger, formatRealMoney, formatSigned } from '@/lib/format/numbers';
import { UNKNOWN, present } from '@/lib/format/unknown';
import type { PanelsData } from '@/lib/game/panels';
import {
  elementTip,
  gearTip,
  itemTip,
  pokemonTip,
  type TipData,
  type TipLabels,
} from '@/lib/game/tips';
import type { SpriteData } from '@/lib/sprites/resolve';
import { parsePrice } from '@/lib/trade/draft';
import { knownAmount, listingTitle } from '@/lib/trade/title';
import { tradesAcrossWorlds, type Anuncio, type UnidadPokemon } from '@/lib/trade/types';
import { unitPriceText, type UnitPriceLabels } from '@/lib/trade/unit-price';

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
  /** Each aura of content/auras.json by id: its name and its ball sprite. */
  auras: Readonly<Record<string, ListingPreviewEntity | string>>;
  /** Each addon of content/outfits.json by id: its name and its sprite. */
  addons?: Readonly<Record<string, ListingPreviewEntity | string>>;
  /** `nombre` of each world of content/mundos.json, by id. */
  worlds: Readonly<Record<string, string>>;
  /** Sprites the page resolved with the adapter (DP2). */
  sprites: ListingPreviewSprites;
  /** The Diamonds of the registry: their panel and the two lists of their `moneda` object. */
  diamonds: ListingPreviewDiamonds;
  /**
   * `/{l}/paneles.json` once it is here (src/lib/game/panels.ts): the rest of every panel the
   * card opens — an item's game text and facts, an element's and an aura's Balls, a Pokémon's
   * traits. Without it the panels draw what the two data files give.
   */
  panels?: PanelsData | null;
}

/** An aura or an addon as a slot draws it (16.4.5). */
export interface ListingPreviewEntity {
  nombre: string;
  icono: SpriteData | null;
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
  /** A price per unit, «MX$ 1,80 por 1kk» (owner rule 2026-09-24); without it none is shown. */
  unitPrice?: UnitPriceLabels;
  /** «Cualquier mundo»: the tag of a Pokédólares listing. */
  anyWorld?: string;
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
  /** The seller's character the listing goes as: the meta reads «Void Exiled · Titan 1». */
  character?: string | null;
}

/**
 * The panel of an aura or an addon (16.4.5, `gearTip`): its name over its sprite, and the Balls
 * that unlock the aura or the Pokémon of the addon once the panels file is here.
 */
function gearTipOf(
  kind: 'aura' | 'addon',
  id: string,
  entity: ListingPreviewEntity,
  props: ListingPreviewProps,
): TipData {
  const panels = props.data.panels;
  return gearTip(
    kind,
    {
      id,
      nombre: entity.nombre,
      sprite: entity.icono,
      balls: kind === 'aura' ? panels?.auras[id] : undefined,
      pokemon: kind === 'addon' ? panels?.addons[id] : undefined,
    },
    props.labels.tooltip,
  );
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
  equipment?: ListingCardEquipment;
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
    data.panels?.items[row.id],
  );
}

/** The Pokémon of a listing (§9.5.8): its catalogue facts and what the seller declared. */
function pokemonCard(unit: UnidadPokemon, props: ListingPreviewProps): Built {
  const { data, labels, locale } = props;
  const row = data.pokemon.get(unit.pokemon);
  const art = resolvePokemonImage(row?.imagen);

  const npc = unit.precioNpc;
  const facts: Built['facts'] = {
    requirement:
      row?.nivel === null || row?.nivel === undefined
        ? null
        : fill(labels.tooltip.level, { n: formatInteger(row.nivel, locale) }),
    tier: row === undefined ? null : formatTier(row.tier),
    elements: (row?.elementos ?? []).flatMap((id) => {
      const ref = data.elements[id];
      return ref === undefined
        ? []
        : [elementChip(id, ref, locale, labels.tooltip, elementTip, data.panels?.elementos[id])];
    }),
    boost: unit.boost === null ? null : formatSigned(unit.boost, locale),
    nickname: unit.nickname,
    memorySlots: unit.memorySlots,
    starLevel: unit.starLevel,
    npcPrice:
      npc === null ? null : npc.tipo === 'unsellable' ? labels.unsellable : units(npc.cantidad),
  };

  // 16.4.5: the equipment by kind, as the cards of the list draw it; an id the data of the
  // page does not hold is left out.
  const item = (id: string | null): EquipmentStripItem | null => {
    const record = id === null ? undefined : data.items.get(id);
    return id === null || record === undefined
      ? null
      : { id, name: record.nombre, sprite: record.sprite, tip: itemTipOf(record, data, props) };
  };
  const kind = (key: 'aura' | 'addon', ids: readonly string[]): EquipmentStripItem[] =>
    ids.flatMap((id) => {
      const found = (key === 'aura' ? data.auras : (data.addons ?? {}))[id];
      if (found === undefined) return [];
      const entity = typeof found === 'string' ? { nombre: found, icono: null } : found;
      return [
        {
          id,
          name: entity.nombre,
          sprite: entity.icono,
          tip: gearTipOf(key, id, entity, props),
        },
      ];
    });
  const equipment: ListingCardEquipment = {
    ball: item(unit.ball),
    auras: kind('aura', unit.auras),
    addons: kind('addon', unit.addons),
    heldX: item(unit.heldX),
    heldY: item(unit.heldY),
    mega: item(unit.mega),
  };

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
    equipment,
    train,
  };
}

/** The item of an items listing (§9.5.8): its quantity and the facts of its record. */
function itemsCard(
  item: NonNullable<ListingPreviewDraft['item']>,
  props: ListingPreviewProps,
): Built {
  const { data, labels, locale } = props;
  const record = data.items.get(item.item);
  const quantity = units(item.cantidad);

  let droppedBy: ListingFactValue = null;
  const droppers = record?.dropDe ?? [];
  if (typeof droppers === 'number') {
    // Past DROPPER_NAMES_MAX the list only counts them (items/config.ts, `dropDe`).
    const count = labels.tooltip.pokemonCount;
    droppedBy = count ? fill(count, { n: formatInteger(droppers, locale) }) : droppers;
  } else if (droppers.length === 1) {
    const id = droppers[0];
    const ref = data.itemRefs.pokemon[id];
    if (ref !== undefined)
      droppedBy = dropperEntity(
        id,
        ref,
        locale,
        labels.tooltip,
        pokemonTip,
        data.panels?.pokemon[id],
        data.panels?.tipos,
      );
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
          : elementChip(
              element,
              elementRef,
              locale,
              labels.tooltip,
              elementTip,
              data.panels?.elementos[element],
            ),
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
  const character = props.character ?? null;
  const labels = props.labels;

  return {
    type: draft.tipo,
    title: title.texto,
    titleAccessible: title.accesible,
    sprite: built.sprite,
    qty: built.qty,
    shiny: built.shiny,
    world:
      character !== null
        ? [character, present(world) ? world : null].filter(Boolean).join(' · ')
        : present(world)
          ? world
          : null,
    anyWorld: tradesAcrossWorlds(draft.tipo) ? (labels.anyWorld ?? null) : null,
    posted,
    facts: built.facts,
    equipment: built.equipment,
    train: built.train,
    fiat:
      real === null || fiatValue === null ? null : formatRealMoney(fiatValue, real.moneda, locale),
    game,
    negotiable: precio.aConvenir,
    unit:
      labels.unitPrice === undefined
        ? null
        : unitPriceText(draft.tipo, precio, locale, labels.unitPrice, props.orLabel),
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
