import type { HTMLAttributes, ReactNode } from 'react';

import { CardHeadingContext } from '@/components/cards/Card';
import { Sprite } from '@/components/game/Sprite';
import type { SpriteProps } from '@/components/game/Sprite';
import type { Locale } from '@/i18n/config';
import { formatInteger } from '@/lib/format/numbers';

// CardGroup (spec 7.2.6, 7.6.2, 9.5.8; CARD_GRID_SYSTEM §2.1; DS:CardGroup, DS:guias/30
// «Grupos»): a titled group of one card type — the sprite of the type in a 32 cell, its name
// and how many cards it holds on this page — then its `CardGrid`. Comercio «Todos» shows one
// per asset type in the fixed order Pokémon, Items, Diamonds, Pokédólares, and so do the tier
// groups of the Tier list; a type without results on the page draws no group. Two groups in
// a row sit 32 apart (card-group.css), so no wrapper around them adds a gap of its own.
//
// Markup and `ac-card-group*` classes are the reference's (`bundle.js` CardGroup). What the
// site does differently:
//
//   - `sprite` is the `SpriteProps` the adapter resolved (DP2), drawn at 1x on whole pixels
//     in the 32 game cell (7.4.3). The cell is `aria-hidden`: the heading names the type.
//   - `count` is a number grouped with `formatInteger` in the page's locale (13.3); a text
//     arrives written. No count draws nothing.
//   - Heading levels (7.6.2, WA2). `level` is the group's own heading, h2 when the groups are
//     the sections of the page (§8.0.6, Comercio «Todos») and h3 inside a `Section` h2 (the
//     seller profile), 3 by default as in the reference. The titles of the cards inside are
//     always one level more — never a skip — and reach the cards of an island through
//     `CardHeadingContext`. From an `.astro` page each card is its own React root and cannot
//     see this context, so there every card takes `headingLevel={level + 1}` itself.
//
// Every visible text is the caller's (DP1): `label` is the name of the type.

export interface CardGroupProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Name of the group: the asset type in Comercio «Todos» («Pokémon», «Items»…). */
  label: ReactNode;
  /** Cards in the group on this page, in `ui` and `text-quaternary`, tabular. */
  count?: number | string | null;
  /** Sprite of the type (DP2): the outfit of Charmander, Fire Stone, Diamond, Pokédólares. */
  sprite?: SpriteProps | null;
  /** Heading level of the group; its cards take one more. Default 3. */
  level?: 2 | 3;
  /** Picks the grouping of the count (C-R3). */
  locale: Locale;
  /** The group's `CardGrid`. */
  children?: ReactNode;
}

const HEADINGS = { 2: 'h2', 3: 'h3' } as const;

export function CardGroup({
  label,
  count,
  sprite,
  level = 3,
  locale,
  className,
  children,
  ...rest
}: CardGroupProps) {
  const Heading = HEADINGS[level];
  const shown =
    typeof count === 'number'
      ? Number.isFinite(count)
        ? formatInteger(count, locale)
        : null
      : count !== null && count !== undefined && count !== ''
        ? count
        : null;

  return (
    <div {...rest} className={className ? `ac-card-group ${className}` : 'ac-card-group'}>
      <Heading className="ac-card-group__head">
        {sprite ? (
          <span className="ac-card-group__sprite" aria-hidden="true">
            <Sprite {...sprite} cell alt="" />
          </span>
        ) : null}
        {label}
        {shown === null ? null : <span className="ac-card-group__count">{shown}</span>}
      </Heading>
      <CardHeadingContext.Provider value={level === 2 ? 3 : 4}>
        {children}
      </CardHeadingContext.Provider>
    </div>
  );
}
