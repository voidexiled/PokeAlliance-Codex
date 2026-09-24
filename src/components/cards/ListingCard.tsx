import { Fragment } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';

import '@/styles/components/trade-presence.css';

import { Card, Head, Meta, ShinyLine, Title, Zone } from '@/components/cards/Card';
import type { CardHeadingLevel } from '@/components/cards/Card';
import { FactList } from '@/components/cards/FactList';
import type { FactMode, FactRow } from '@/components/cards/FactList';
import { Chip } from '@/components/content/Chip';
import { ElementChip } from '@/components/game/ElementChip';
import type { ElementChipEntry } from '@/components/game/ElementChip';
import { NestedEntity } from '@/components/game/NestedEntity';
import { Sprite } from '@/components/game/Sprite';
import type { SpriteProps } from '@/components/game/Sprite';
import { SpriteStage } from '@/components/game/SpriteStage';
import { ChipRow } from '@/components/money/ChipRow';
import type { ChipRowItem, ChipRowLabels } from '@/components/money/ChipRow';
import { DiamondsAmount } from '@/components/money/DiamondsAmount';
import type { DiamondsLink } from '@/components/money/DiamondsAmount';
import { EquipmentStrip } from '@/components/money/EquipmentStrip';
import type { EquipmentStripItem } from '@/components/money/EquipmentStrip';
import type { HeldStripLabels } from '@/components/money/HeldStrip';
import { PokedolaresAmount } from '@/components/money/PokedolaresAmount';
import { PriceOptions } from '@/components/money/PriceOptions';
import type { PriceOption } from '@/components/money/PriceOptions';
import { Rating } from '@/components/money/Rating';
import type { RatingLabels } from '@/components/money/Rating';
import { TrainingMeter } from '@/components/money/TrainingMeter';
import type { TrainingMeterLabels } from '@/components/money/TrainingMeter';
import type { Locale } from '@/i18n/config';
import { trackCount } from '@/lib/cards/layout';
import type { ListingKey, ListingLayout, ListingType } from '@/lib/cards/layout';
import { fill } from '@/i18n/messages/types';
import { formatInteger } from '@/lib/format/numbers';
import { present } from '@/lib/format/unknown';
import type { TipData } from '@/lib/game/tips';
import type { EstadoPresencia } from '@/lib/trade/types';

// ListingCard (spec 7.2.6, 7.5.5, 7.5.10, 7.6.2, 7.6.3, 9.4, 9.5.8; CARD_GRID_SYSTEM §6.1;
// DS:ListingCard, DS:guias/30, DS:guias/40): the card of a Comercio listing — the 72 stage,
// the title, the Shiny line and the meta «{mundo} · {publicado}», the facts of its asset
// type, Held Items and Entrenamiento in Pokémon grids, and a footer with the price, the
// seller and the verified contact channels — built on the card kit of `Card.tsx`, inside
// `CardGrid family="listing"`, and in Comercio «Todos» inside one `CardGroup` per type.
//
// Markup and classes are the reference's (`bundle.js` ListingCard), so listing-card.css
// ports its block. What the site does differently:
//
//   - `layout` is required (7.2.6): `listingLayout` of the listings of the grid, the same for
//     every card of it (7.6.3), so the card spans `trackCount('listing', layout)` tracks. A
//     listing of another type than its layout throws: a grid never mixes types.
//   - The fact keys are ids (src/lib/cards/layout.ts) and `labels.keys` gives the visible
//     label of each one (DP1); every text of the card arrives in `labels`, and
//     `labels.money` is `ui.money`, the copy of the money components it draws.
//   - Values of the facts (§9.5.8): Ball is `{ name, sprite, tip }` and opens the panel of
//     its item; Elementos and Elemento are `ElementChip` links; the Cantidad of a Diamonds
//     or Pokédólares listing and a numeric NPC Price are the money components, sprite first
//     (S8), and the Diamonds of a Cantidad never open a tooltip (7.5.10); a single Pokémon of
//     «Drop de» opens its Pokédex panel; Nickname keeps its spaces (`pre`); a list is joined
//     with commas (13.3) and a number is grouped. Every panel is `TipData` (DP3), and a
//     panel with nothing below its title leaves plain text (R2, 8.0.5): a declared name
//     without a registry match has no `tip` and no sprite (§9.4).
//   - The title is `listingTitle` of §9.4: when what a screen reader hears differs from the
//     visible text (Pokédólares, «500kk Pokédólares» / «500.000.000 Pokédólares»), the text
//     is `aria-hidden` and the accessible form sits in `sr-only`.
//   - The meta line is the world, the `<time>` of the publication — the absolute date in the
//     prerendered HTML, the relative one after hydration, both written by the island — and
//     «Reservado» when it applies (§9.5.8).
//   - A listing «A convenir» shows `labels.negotiable` in the first price row of its grid
//     and «—» in the other (§9.5.8). `listingLayout` gives a grid with no price at all the
//     «Dinero real» row when one of its listings is «A convenir», so the text always has a
//     row to sit in.
//   - Placement of the panels (7.5.5): the facts open `down` lined up with their right edge;
//     Held Items open `up` (HeldStrip), and in the footer the Diamonds of a price open `up` +
//     `end` and the «+N» of the channels `up` + `start`.
//   - `loading` is the `lazy` of 7.4.2 for a card from index 4 of its list on.
//   - The seller's online status (9.15.6): `SellerPresence`, a small dot with its label, next to
//     the seller in the footer, and under it when the row has no room for both. The Lista row and
//     the detail draw the same piece (TradeListRoot.tsx, SellerCard.tsx); trade-presence.css
//     holds its look, a per-page sheet (D-018) that only the pages drawing a seller load.
//   - «Dinero real» (9.15.2): with `labels.realMoney`, which the page passes only in phase B, a
//     listing with a real-money price carries that tag, a `Chip` under the meta line.
//
// The card is not a link and never opens a tooltip: it already shows what the tooltip of its
// listing would (§9.5.9 is for Slots and Lista); its title links to the detail and its
// nested entities are the triggers (7.5.10). No payment gateway and no buy button: the
// contact goes through the verified channels (DS:ListingCard «No hacer»).

/** A fact that is another entity: the Ball, or the one Pokémon of «Drop de». */
export interface ListingCardEntity {
  name: string;
  /** Page of the entity; without it the trigger is a button (7.5.7). */
  href?: string;
  /** Its panel (7.5.3). `null`, or nothing below its title: plain text (R2). */
  tip: TipData | null;
  /** The Ball: its sprite at 1x before the name (DP2). */
  sprite?: SpriteProps | null;
}

/** A fact value by the shape its key takes (§9.5.8). */
export type ListingFactValue =
  | string
  | number
  | readonly string[]
  | ElementChipEntry
  | readonly ElementChipEntry[]
  | ListingCardEntity
  | null;

/** An online status (9.15.6) and its label in the page's language: «En el juego». */
export interface SellerPresenceData {
  state: EstadoPresencia;
  label: string;
}

/** The seller of a listing, with the score of the confirmed trades (9.10). */
export interface ListingCardSeller {
  name: string;
  /** Profile of the seller (§9.8). */
  href: string;
  score?: number | null;
  reviews?: number | null;
  /** The seller's online status (9.15.6); none draws no dot. */
  presence?: SellerPresenceData | null;
}

export interface SellerPresenceProps extends SellerPresenceData {
  /** Utilities added by the caller, after the component's class (3.8). */
  className?: string;
}

/**
 * The online status next to a seller (9.15.6): a small dot, `aria-hidden` because the label
 * names the state, and the label. The state is a `data-presence` attribute (3.7): «En el juego»
 * in the colour of success, «Ausente» in the one of warning, «Desconectado» dimmed.
 */
export function SellerPresence({ state, label, className }: SellerPresenceProps) {
  return (
    <span className={className ? `ac-presence ${className}` : 'ac-presence'} data-presence={state}>
      <span className="ac-presence__dot" aria-hidden="true" />
      {label}
    </span>
  );
}

/** The first declared training of a Pokémon (§9.5.8): «Attack 16 (53%)». */
export interface ListingCardTraining {
  stat: string;
  level: number;
  percent: number;
}

/**
 * A listing as the card reads it: the `Anuncio` of §9.4 with the catalogue values read from
 * the registries and every text already in the page's language.
 */
export interface ListingCardListing {
  type: ListingType;
  /** `listingTitle(…).texto` (§9.4). */
  title: string;
  /** `listingTitle(…).accesible`, when it differs from the text (Pokédólares). */
  titleAccessible?: string;
  /** Detail of the listing (§9.6). */
  href?: string;
  /**
   * Stage sprite (DP2): the Pokémon art (`smooth`, drawn at 64 without a frame), or a pixel
   * sprite drawn at 2x in the framed stage. `null` draws the missing mark (7.4.4).
   */
  sprite: SpriteProps | null;
  /** Stack count on the stage of an items or Diamonds listing. */
  qty?: number | null;
  shiny?: boolean;
  /** Name of the world. */
  world?: string | null;
  /** The publication, as the island writes it: ISO instant and text. */
  posted?: { datetime: string; text: string } | null;
  /** `estado: 'reservado'`: «Reservado» after the meta. */
  reserved?: boolean;
  /** Facts by key; an unknown value is `null` or absent. */
  facts?: Readonly<Partial<Record<ListingKey, ListingFactValue>>> | null;
  /**
   * Equipment of a Pokémon (16.4.5): ball, auras, addons, held X, held Y and Mega Stone as 32 px
   * slots (EquipmentStrip). The name stays `helds`: the card layout reads it for its zone.
   */
  helds?: readonly EquipmentStripItem[] | null;
  /** Training shown on the card, or `null`: «—». */
  train?: ListingCardTraining | null;
  /** Real-money price, written by `formatRealMoney` («R$ 90»), or `null`. */
  fiat?: string | null;
  /** In-game price options, in the seller's order. */
  game?: readonly PriceOption[] | null;
  /** `precio.aConvenir`. */
  negotiable?: boolean;
  seller?: ListingCardSeller | null;
  /** Verified contact channels, already in the page's language («Teléfono +55», R13). */
  channels?: readonly ChipRowItem[] | null;
}

/** Every text of the card (DP1). */
export interface ListingCardLabels {
  /** Visible label of each fact key: «Requisito», «Memory Slots», «Cantidad»… */
  keys: Readonly<Record<ListingKey, string>>;
  /** «Shiny», a game term (13.4). */
  shiny: string;
  /** «Dinero real» / «Real money». */
  fiat: string;
  /** «En el juego» / «In game». */
  game: string;
  /** «Vendedor» / «Seller». */
  seller: string;
  /** «Contacto verificado» / «Verified contact». */
  contact: string;
  /** «A convenir» / «Negotiable». */
  negotiable: string;
  /** «Reservado» / «Reserved». */
  reserved: string;
  /**
   * «Dinero real» / «Real money», the tag of a listing with a real-money price (9.15.2). Only
   * phase B passes it; without it no card carries the tag.
   */
  realMoney?: string;
  /** «Equipo» / «Equipment»: the accessible name of the equipment row (16.4.5). */
  equipment?: string;
  /** `ui.money`: Held Items, Entrenamiento, the score and the «+N» of the channels. */
  money: HeldStripLabels & TrainingMeterLabels & RatingLabels & ChipRowLabels;
}

export interface ListingCardProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  listing: ListingCardListing;
  /** `listingLayout` of the listings of the grid: the same for every card of it (7.6.3). */
  layout: ListingLayout;
  labels: ListingCardLabels;
  /** Picks the format of k, kk and thousands, here and in the panels (C-R3). */
  locale: Locale;
  /** Strip of the panels, `ui.pinHint`: «Mantén Shift para fijar» / «Hold Shift to pin». */
  hint: string;
  /** The word between two price options, `ui.or`: «o» / «or» (13.3). */
  orLabel: string;
  /**
   * The Diamonds panel of the prices, `diamondsTip` of the page (7.5.3), and the page of the
   * Diamonds. Without a panel the Diamonds of a price are plain text (R2).
   */
  diamonds?: { tip: TipData | null; href?: string } | null;
  /** Contact chips before «+N». Default 3 (CARD_GRID_SYSTEM §9). */
  chipCap?: number;
  /** Level of the title, when the card cannot see the one of its grid (7.6.2). */
  headingLevel?: CardHeadingLevel;
  /** `lazy` for a card from index 4 of its list on (7.4.2). */
  loading?: 'lazy' | 'eager';
}

/** Contact chips of a line before «+N» (CARD_GRID_SYSTEM §9). */
const CHIP_CAP = 3;

function classes(...values: (string | false | undefined)[]): string {
  return values.filter(Boolean).join(' ');
}

/** R2: a panel with nothing to show below its title is not a tooltip. */
function hasContent(tip: TipData | null | undefined): tip is TipData {
  if (!tip) return false;
  return tip.rows.length > 0 || Boolean(tip.sections?.length) || Boolean(tip.market?.length);
}

function isElement(value: unknown): value is ElementChipEntry {
  return typeof value === 'object' && value !== null && 'id' in value && 'icon' in value;
}

function isEntity(value: unknown): value is ListingCardEntity {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    'name' in value &&
    'tip' in value
  );
}

function known(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function ListingCard({
  listing,
  layout,
  labels,
  locale,
  hint,
  orLabel,
  diamonds,
  chipCap = CHIP_CAP,
  headingLevel,
  loading,
  className,
  ...rest
}: ListingCardProps) {
  if (listing.type !== layout.type) {
    throw new Error(
      `ListingCard: a «${listing.type}» listing in a «${layout.type}» grid; one grid never mixes types (7.6.3).`,
    );
  }
  const facts = listing.facts ?? {};

  /** An entity of a fact: its trigger, opening below at the right edge of the value (7.5.5). */
  const entity = (value: ListingCardEntity): ReactNode => {
    const content = (
      <>
        {value.sprite ? <Sprite {...value.sprite} loading={loading} alt="" /> : null}
        {value.name}
      </>
    );
    if (hasContent(value.tip)) {
      return (
        <NestedEntity
          tip={value.tip}
          href={value.href}
          variant="link"
          placement="down"
          align="end"
          locale={locale}
          hint={hint}
          shinyLabel={labels.shiny}
          orLabel={orLabel}
        >
          {content}
        </NestedEntity>
      );
    }
    return value.sprite ? <span className="ac-listing-card__entity">{content}</span> : value.name;
  };

  // --------------------------------------------------------------------------------- facts
  const fact = (key: ListingKey): FactRow => {
    const label = labels.keys[key];
    const value = facts[key];
    const row = (shown: ReactNode, mode: FactMode = 'clip', target = false): FactRow => ({
      key,
      label,
      value: shown,
      mode,
      target,
    });

    if (value === null || value === undefined || !present(value)) return row(null);
    if ((key === 'elements' || key === 'element') && typeof value === 'object') {
      const list: readonly unknown[] = Array.isArray(value) ? value : [value];
      if (list.every(isElement)) {
        return row(
          <span className="ac-listing-card__els">
            {list.map((element) => (
              <ElementChip
                key={element.id}
                element={element}
                variant="link"
                placement="down"
                align="end"
                locale={locale}
                hint={hint}
              />
            ))}
          </span>,
          'node',
          list.some((element) => element.tip.rows.length > 0),
        );
      }
    }
    if (typeof value === 'number') {
      if (key === 'quantity' && listing.type === 'pokedolares') {
        return row(<PokedolaresAmount amount={value} locale={locale} />, 'node');
      }
      if (key === 'quantity' && listing.type === 'diamonds') {
        return row(<DiamondsAmount amount={value} word={false} locale={locale} />, 'node');
      }
      if (key === 'npcPrice')
        return row(<PokedolaresAmount amount={value} locale={locale} />, 'node');
      return row(formatInteger(value, locale));
    }
    if (isEntity(value)) return row(entity(value), 'node', hasContent(value.tip));
    if (typeof value === 'string') return row(value, key === 'nickname' ? 'pre' : 'clip');
    if (Array.isArray(value)) {
      return row(value.filter((entry): entry is string => typeof entry === 'string').join(', '));
    }
    return row(null);
  };

  // ---------------------------------------------------------------------------------- head
  const count = listing.type === 'items' || listing.type === 'diamonds' ? listing.qty : undefined;
  const title =
    listing.titleAccessible !== undefined && listing.titleAccessible !== listing.title ? (
      <>
        <span aria-hidden="true">{listing.title}</span>
        <span className="sr-only">{listing.titleAccessible}</span>
      </>
    ) : (
      listing.title
    );
  const meta: ReactNode[] = [];
  if (present(listing.world)) meta.push(listing.world);
  if (listing.posted) {
    meta.push(<time dateTime={listing.posted.datetime}>{listing.posted.text}</time>);
  }
  if (listing.reserved) meta.push(labels.reserved);
  const head = (
    <Head
      stage={
        <SpriteStage
          sprite={listing.sprite ? { ...listing.sprite, loading } : null}
          size={72}
          qty={known(count) && count > 0 ? formatInteger(count, locale) : undefined}
        />
      }
      title={
        <Title href={listing.href} clamp={2}>
          {title}
        </Title>
      }
      lines={
        <>
          {listing.shiny ? <ShinyLine label={labels.shiny} /> : null}
          {meta.length > 0 ? (
            <Meta>
              {meta.map((part, index) => (
                // The parts are a fixed sequence (world, time, state): position is identity.
                <Fragment key={index}>
                  {index > 0 ? ' · ' : null}
                  {part}
                </Fragment>
              ))}
            </Meta>
          ) : null}
          {labels.realMoney !== undefined && present(listing.fiat) ? (
            <p className="ac-listing-card__tag">
              <Chip>{labels.realMoney}</Chip>
            </p>
          ) : null}
        </>
      }
    />
  );

  // -------------------------------------------------------------------------------- footer
  const diamondsLink: DiamondsLink | undefined = diamonds?.tip
    ? { tip: diamonds.tip, hint, href: diamonds.href }
    : undefined;
  let negotiable = listing.negotiable === true;
  const foot: FactRow[] = [];
  for (const price of layout.price) {
    if (price === 'fiat') {
      const shown = present(listing.fiat) ? (
        <span className="ac-listing-card__fiat">{listing.fiat}</span>
      ) : null;
      if (shown === null && negotiable) {
        negotiable = false;
        foot.push({ key: price, label: labels.fiat, value: labels.negotiable, mode: 'clip' });
      } else {
        foot.push({ key: price, label: labels.fiat, value: shown, mode: 'node' });
      }
    } else {
      const options = listing.game ?? [];
      if (options.length === 0 && negotiable) {
        negotiable = false;
        foot.push({ key: price, label: labels.game, value: labels.negotiable, mode: 'wrap' });
      } else {
        foot.push({
          key: price,
          label: labels.game,
          mode: 'nodetop',
          value:
            options.length > 0 ? (
              <PriceOptions
                options={options}
                locale={locale}
                orLabel={orLabel}
                align="end"
                link={diamondsLink}
              />
            ) : null,
        });
      }
    }
  }
  const seller = listing.seller;
  const rating = seller ? (
    <Rating
      seller={seller.name}
      href={seller.href}
      score={seller.score}
      reviews={seller.reviews}
      locale={locale}
      labels={labels.money}
    />
  ) : null;
  const presence = seller?.presence ?? null;
  foot.push({
    key: 'seller',
    label: labels.seller,
    // With the status the value may take two lines: the label stays on the first (9.15.6).
    mode: presence === null ? 'node' : 'nodetop',
    value:
      rating !== null && presence !== null ? (
        <span className="ac-listing-card__seller">
          {rating}
          <SellerPresence state={presence.state} label={presence.label} />
        </span>
      ) : (
        rating
      ),
  });
  const channels = listing.channels ?? [];
  foot.push({
    key: 'contact',
    label: labels.contact,
    mode: 'below',
    value:
      channels.length > 0 ? (
        <ChipRow
          items={channels}
          cap={chipCap}
          labels={labels.money}
          locale={locale}
          placement="up"
          align="start"
        />
      ) : null,
  });

  return (
    <Card
      {...rest}
      anat="listing"
      span={trackCount('listing', layout)}
      headingLevel={headingLevel}
      className={classes('ac-listing-card', className)}
    >
      {head}
      {layout.keys.length > 0 ? <FactList rows={layout.keys.map(fact)} /> : null}
      {layout.zones.includes('held') ? (
        <Zone name="held">
          <EquipmentStrip
            items={listing.helds ?? []}
            label={
              labels.equipment ??
              fill(labels.money.heldItems, { n: String(listing.helds?.length ?? 0) })
            }
            locale={locale}
            hint={hint}
            orLabel={orLabel}
          />
        </Zone>
      ) : null}
      {layout.zones.includes('train') ? (
        <Zone name="train">
          <TrainingMeter
            variant="card"
            stat={listing.train?.stat}
            level={listing.train?.level}
            percent={listing.train?.percent}
            locale={locale}
            labels={labels.money}
          />
        </Zone>
      ) : null}
      <FactList zone="footer" gap={8} divided rows={foot} />
    </Card>
  );
}
