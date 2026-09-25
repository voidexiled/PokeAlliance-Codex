import { createContext, useContext } from 'react';
import type { CSSProperties, HTMLAttributes, ReactNode, Ref } from 'react';

import { ShinyMark } from '@/components/game/ShinyMark';
import { present, UNKNOWN } from '@/lib/format/unknown';
import type { TipHead, TipSprite } from '@/lib/game/tips';

// Card kit (spec 7.2.6, 7.6.2, 7.6.4; CARD_GRID_SYSTEM §5; DS:CardGrid «cardKit»): the pieces
// every card of the fixed-anatomy system shares — the `article` box on subgrid tracks, its zones,
// the head, the title, the meta line and the Shiny line — plus `tipHead`, the head of an item's
// game tooltip. `ListingCard`, `DexCard` and `LootCard` are built from them. Markup and `ac-card*`
// classes are the reference's (`bundle.js` CardGrid block), so card.css ports `bundle.css`.
//
// Site differences (C-R3):
//   - No `compact` on `Card` or `Head`, no `center` on `Title`, `Meta` or `ShinyLine`: the compact
//     anatomy comes from a container query on the grid, never from JS or a prop (7.6.4), so the DOM
//     is the same in both anatomies and card.css restacks it.
//   - `Title` without `href` is text, never `href="#"` (WG5): a card whose entity has no page of
//     its own (the items of §8.3 and §8.5) has a plain title. `current` marks the entry of the
//     page itself: no link and `aria-current="page"` on its name (§8.3).
//   - The heading level of the title is 2, 3 or 4, one more than the heading right above the list
//     (7.6.2, WA2). `CardGrid` and `Card` take `headingLevel` and hand it down through
//     `CardHeadingContext`, which a `CardGroup` can provide the same way; `Title` reads it. A grid
//     of cards written in an `.astro` page renders each card as its own React root, which cannot
//     see the grid's context, so there the card takes `headingLevel` itself.
//   - `tipHead` returns the `TipHead` data of 7.5.2, not a node: `TipData` travels as island
//     props and inside `datos.json` (DP3).
//   - Every visible text arrives by props (DP1): `ShinyLine.label` is `ui.shiny`.
//
// The card is not a link and takes no focus: its title is the link (7.6.2). It opens no tooltip;
// the entities nested in it do (7.5.10).

/** Level of a card title (7.6.2). It never changes the look: always `body-strong`. */
export type CardHeadingLevel = 2 | 3 | 4;

/** `data-anat` of the card types built on this kit. `KpiCard` draws its own box. */
export type CardAnatomy = 'listing' | 'dex' | 'loot';

/** `data-zone` of a zone: one direct child of the card per track (CARD_GRID_SYSTEM §5.2). */
export type CardZoneName =
  'head' | 'facts' | 'gear' | 'auras' | 'addons' | 'train' | 'footer' | 'elements' | 'drops';

/**
 * Level of the card titles below it. `CardGrid` (and a `CardGroup` around it) provide it for the
 * cards of an island; a card may override it. Default 3: cards under an h2 section.
 */
export const CardHeadingContext = createContext<CardHeadingLevel>(3);

const HEADINGS = { 2: 'h2', 3: 'h3', 4: 'h4' } as const;

function join(base: string, extra: string | undefined): string {
  return extra ? `${base} ${extra}` : base;
}

export interface CardProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  /** `data-anat` of the card type. */
  anat: CardAnatomy;
  /**
   * Row tracks the card spans: `trackCount(family, layout)` of `src/lib/cards/layout.ts`, the
   * same for every card of one grid (7.6.2). It is the only inline style of a card (C-R2) and a
   * `style` prop cannot override it.
   */
  span: number;
  /** Level of the title, when this card must not take the one of its grid. */
  headingLevel?: CardHeadingLevel;
  /** Reaches the `article` element. */
  cardRef?: Ref<HTMLElement>;
  children?: ReactNode;
}

/** The article box: 1 px `border-secondary`, radius 12, padding 16, zones on subgrid tracks. */
export function Card({
  anat,
  span,
  headingLevel,
  cardRef,
  className,
  style,
  children,
  ...rest
}: CardProps) {
  const inherited = useContext(CardHeadingContext);
  const tracks = Number.isFinite(span) && span >= 1 ? Math.floor(span) : 1;
  const box: CSSProperties = { ...style, gridRow: `span ${tracks}` };
  return (
    <article
      {...rest}
      ref={cardRef}
      className={join('ac-card', className)}
      data-anat={anat}
      style={box}
    >
      <CardHeadingContext.Provider value={headingLevel ?? inherited}>
        {children}
      </CardHeadingContext.Provider>
    </article>
  );
}

export interface ZoneProps {
  /** `data-zone` of the track. */
  name: CardZoneName;
  className?: string;
  children?: ReactNode;
}

/** One zone = one direct child of the card on one track. */
export function Zone({ name, className, children }: ZoneProps) {
  return (
    <div data-zone={name} className={join('ac-card__zone', className)}>
      {children}
    </div>
  );
}

export interface HeadProps {
  /** The stage: a `SpriteStage` (the 72 of a listing, the 64 art of the Pokédex, the 40 slot). */
  stage?: ReactNode;
  /** The `Title`. */
  title: ReactNode;
  /** Lines under the title: `ShinyLine`, `Meta`. */
  lines?: ReactNode;
}

/**
 * Head zone: the stage, then the title and its lines. In the compact anatomy card.css stacks the
 * three and centres them, with the same DOM.
 */
export function Head({ stage, title, lines }: HeadProps) {
  return (
    <Zone name="head" className="ac-card__head">
      {stage}
      <div className="ac-card__text">
        {title}
        {lines}
      </div>
    </Zone>
  );
}

export interface TitleProps {
  /** Page of the entity. Without it the title is text. */
  href?: string;
  /** Lines before the ellipsis: 2 (listing, loot), 1 (Pokédex; 2 in the compact anatomy). */
  clamp?: 1 | 2;
  /** Heading level; default the card's (`CardHeadingContext`). */
  level?: CardHeadingLevel;
  /** The entry of the page itself: no link, `aria-current="page"` on its name (§8.3). */
  current?: boolean;
  children: ReactNode;
}

/** Card title: `body-strong`, the card's only link, underlined on hover. */
export function Title({ href, clamp = 2, level, current = false, children }: TitleProps) {
  const inherited = useContext(CardHeadingContext);
  const Heading = HEADINGS[level ?? inherited];
  let name: ReactNode = children;
  if (current) {
    name = <span aria-current="page">{children}</span>;
  } else if (href !== undefined) {
    name = (
      <a className="ac-card__title-link" href={href}>
        {children}
      </a>
    );
  }
  return (
    <Heading className={clamp === 1 ? 'ac-card__title ac-card__title--clamp1' : 'ac-card__title'}>
      {name}
    </Heading>
  );
}

export interface MetaProps {
  children: ReactNode;
}

/** Meta line: `ui` in `text-tertiary`, one line with an ellipsis («Sun · hace 12 min»). */
export function Meta({ children }: MetaProps) {
  return <p className="ac-card__meta">{children}</p>;
}

export interface ShinyLineProps {
  /** The word next to the mark, `ui.shiny` («Shiny», a game term: 13.4). */
  label: string;
}

/** The Shiny mark and «Shiny» on one `ui` line. The mark is `aria-hidden`: the word names it. */
export function ShinyLine({ label }: ShinyLineProps) {
  return (
    <p className="ac-card__shiny">
      <ShinyMark />
      {label}
    </p>
  );
}

/**
 * Head of an item's game tooltip: its sprite at 2x in the 64 cell, or the missing-sprite mark of
 * 32 when the registry has none (`null`).
 */
export function tipHead(sprite: TipSprite | null | undefined): TipHead {
  return { type: 'sprite', sprite: sprite ?? null };
}

/**
 * The kit as the design system names it (`AC.cardKit`), for new cards of the same system.
 * `DASH` and `present` are the unknown value and its test of `src/lib/format/unknown.ts`.
 */
export const cardKit = {
  DASH: UNKNOWN,
  present,
  Card,
  Zone,
  Head,
  Title,
  Meta,
  ShinyLine,
  tipHead,
} as const;
