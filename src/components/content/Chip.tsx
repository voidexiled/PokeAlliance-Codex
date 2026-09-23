import type { ReactNode } from 'react';

import { NestedEntity } from '@/components/game/NestedEntity';
import type { NestedEntityAlign, NestedEntityPlacement } from '@/components/game/NestedEntity';
import { ShinyMark } from '@/components/game/ShinyMark';
import { Sprite } from '@/components/game/Sprite';
import type { SpriteProps } from '@/components/game/Sprite';
import type { Locale } from '@/i18n/config';
import type { TipData } from '@/lib/game/tips';

// Chip (spec 7.2.3, 7.5.5, 7.5.10; DS:Chip): the 24 px pill for short facts, the Shiny
// variant and entities of the game — «45 minutos», «T1», «50 Empty Alliance Ball».
//
// Three shapes, the markup of the reference (`bundle.js` Chip):
//   - a fact: `<span class="ac-chip">` with the text;
//   - a link without a tooltip: `<a class="ac-chip ac-chip--link" href>`;
//   - an entity: with `tip` the chip is a `NestedEntity` (variant `chip` with a sprite or
//     the Shiny mark, `chip-text` without), which draws the chip-shaped trigger and owns
//     the tooltip. The trigger rules of nested-entity.css carry zero specificity, so the
//     `ac-chip--shiny` gap still applies on top of them, as in the reference.
//
// A sprite or the Shiny mark adds `ac-chip--sprite` (10 px on the right) and the sprite
// sits in its own `ac-chip__sprite` box. The mark is decorative here: the text of the
// chip says «Shiny».
//
// R2 (spec 8.0.5): a mention opens a tooltip only when its entity has at least one row
// to show. A `tip` without rows, sections or market block is dropped and the chip is
// plain text without a link, the same fallback `ElementChip` takes. A plain `href` with
// no `tip` is a link chip; there is no `#` fallback, a link that leads nowhere is not a
// link (C-R5).
//
// DP3: there is no `open`, `defaultOpen` or `onOpenChange`; the delegated controller of
// 7.5.4 (`src/scripts/game-tooltip.ts`) owns the state of every panel.

interface ChipBaseProps {
  /** The text, already formatted by the caller («4 Enhanced Normal Stone»). */
  children: ReactNode;
  /**
   * Sprite of 16 before the text, as the adapter resolves it (DP2). `null` is an entity
   * the registry knows but has no sprite for: the chip keeps its text only.
   */
  sprite?: SpriteProps | null;
  /** Draws the Shiny mark before the text; the caller writes «Shiny» as the text. */
  shiny?: boolean;
  /** Page of the entity or of the fact. */
  href?: string;
  /** Utilities added by the caller, after the component's classes (3.8). */
  className?: string;
}

/** A fact, a variant or a link: no tooltip. */
export interface ChipPlainProps extends ChipBaseProps {
  tip?: undefined;
}

/** An entity of the game: the chip opens its tooltip (7.5.10). */
export interface ChipEntityProps extends ChipBaseProps {
  /** Panel to open, built by a constructor of `src/lib/game/tips.ts` (7.5.3). */
  tip: TipData;
  /** 7.5.5: `up` + `start` is the `up-left` of the design system, the default of a chip. */
  placement?: NestedEntityPlacement;
  align?: NestedEntityAlign;
  /** Picks the format of the amounts inside the panel. It never picks a text (C-R3). */
  locale: Locale;
  /** Strip of the panel, `ui.pinHint`: «Mantén Shift para fijar» / «Hold Shift to pin». */
  hint: string;
  /** Accessible name of the Shiny mark in the panel head. «Shiny» is a game term (13.4). */
  shinyLabel?: string;
  /** The word between two price options in the panel, `ui.or`: «o» / «or» (13.3). */
  orLabel?: string;
}

export type ChipProps = ChipPlainProps | ChipEntityProps;

/** R2: a panel with nothing to show below its title is not a tooltip. */
function hasContent(tip: TipData): boolean {
  return tip.rows.length > 0 || Boolean(tip.sections?.length) || Boolean(tip.market?.length);
}

function classes(...values: (string | false | undefined)[]): string {
  return values.filter(Boolean).join(' ');
}

export function Chip(props: ChipProps) {
  const { children, sprite, shiny = false, href, className } = props;

  const art = sprite ? (
    <span className="ac-chip__sprite" aria-hidden="true">
      <Sprite {...sprite} />
    </span>
  ) : null;
  const mark = shiny ? <ShinyMark /> : null;

  if (props.tip !== undefined && hasContent(props.tip)) {
    return (
      <NestedEntity
        tip={props.tip}
        href={href}
        variant={art || mark ? 'chip' : 'chip-text'}
        placement={props.placement ?? 'up'}
        align={props.align ?? 'start'}
        locale={props.locale}
        hint={props.hint}
        shinyLabel={props.shinyLabel}
        orLabel={props.orLabel}
        className={classes(Boolean(mark) && 'ac-chip--shiny', className) || undefined}
      >
        {art}
        {mark}
        {children}
      </NestedEntity>
    );
  }

  // R2: an entity whose panel would be empty is text without a link.
  const link = props.tip === undefined && href !== undefined;
  const chipClass = classes(
    'ac-chip',
    Boolean(art || mark) && 'ac-chip--sprite',
    Boolean(mark) && 'ac-chip--shiny',
    link && 'ac-chip--link',
    className,
  );

  if (link) {
    return (
      <a className={chipClass} href={href}>
        {art}
        {mark}
        {children}
      </a>
    );
  }

  return (
    <span className={chipClass}>
      {art}
      {mark}
      {children}
    </span>
  );
}
