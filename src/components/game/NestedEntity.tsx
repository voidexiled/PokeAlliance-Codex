import { useId } from 'react';
import type { ReactNode } from 'react';

import { GameTooltip } from '@/components/game/GameTooltip';
import type { Locale } from '@/i18n/config';
import type { TipData } from '@/lib/game/tips';

// NestedEntity (spec 7.5.1, 7.5.5, 7.5.7; DS:NestedEntity): the only trigger of the
// in-game tooltip. It paints a `<span class="ac-nested-entity" data-ac-tt>` wrapper
// with a real link or button inside and, as its sibling, the `GameTooltip` panel with
// its `id`, `role="tooltip"` and `popover="manual"`.
//
// The panel is in the HTML from the server, hidden by the browser while the popover is
// closed, so `aria-describedby` always points at an element that exists and nothing has
// to hydrate. What opens, closes, pins and places it is the single delegated controller
// of 7.5.4, `src/scripts/game-tooltip.ts`, which reads `data-ac-tt`,
// `data-ac-tt-placement` and `data-ac-tt-align` off this wrapper.
//
// The panel is a *descendant of the wrapper* and that is what makes the safe bridge of
// 7.5.6 work: a pointer crossing the gap onto the panel never leaves the wrapper, so the
// 100 ms close of TT2 is never scheduled.
//
// 7.5.10: no card, `article` or whole row is ever a trigger — the entities nested inside
// one are. R2 is the caller's call: a mention whose entity has no registry entry, or no
// row to show, is plain text and never reaches this component (see `ElementChip`).

/** Placement of the panel around its trigger (7.5.5); the controller translates it. */
export type NestedEntityPlacement = 'up' | 'down' | 'side' | 'above-center' | 'row';
/** Which edge of the trigger the panel lines up with (7.5.5). */
export type NestedEntityAlign = 'auto' | 'start' | 'end' | 'column';
/** Shape of the trigger: entity link, chip with a 16 sprite, text chip, or the caller's own. */
export type NestedEntityVariant = 'link' | 'chip' | 'chip-text' | 'plain';

export interface NestedEntityProps {
  /** Panel to open, built by a constructor of `src/lib/game/tips.ts` (7.5.3). */
  tip: TipData;
  /** Content of the trigger: the sprite and the name of the entity. */
  children: ReactNode;
  /**
   * Page of the entity. With it the trigger is an `<a href>`; without it a
   * `<button type="button">`, which is what an entity with no page of its own gets
   * (7.5.7, §15). There is no `#` fallback: a link that leads nowhere is not a link.
   */
  href?: string;
  variant?: NestedEntityVariant;
  placement?: NestedEntityPlacement;
  align?: NestedEntityAlign;
  /** The wrapper becomes flex and may shrink: a slot, a held row, a cell of the Lista. */
  block?: boolean;
  /** Accessible name when the visible content is not one: slots, icon-only chips (7.5.7). */
  ariaLabel?: string;
  /**
   * Phrasing-only panel, for a mention inside a paragraph: a `div` may not sit inside a
   * `<p>` (7.5.2). An inline panel shows no sections.
   */
  inline?: boolean;
  /** Picks the format of the amounts inside the panel. It never picks a text (C-R3). */
  locale: Locale;
  /**
   * Strip of the panel, `ui.pinHint`: «Mantén Shift para fijar» / «Hold Shift to pin».
   * Required: every panel this component opens is one Shift can pin, so it always shows
   * the strip (7.5.2). Only the compact day panel of the Guild chart drops it, and
   * `GameTooltip` does that on its own from the 200 width.
   */
  hint: string;
  /** Accessible name of the Shiny mark in the panel head. «Shiny» is a game term (13.4). */
  shinyLabel?: string;
  /** The word between two price options in the panel, `ui.or`: «o» / «or» (13.3). */
  orLabel?: string;
  /** Utilities added by the caller on the trigger, after the component's classes (3.8). */
  className?: string;
  /** Utilities added by the caller on the wrapper. */
  wrapperClassName?: string;
}

export function NestedEntity({
  tip,
  children,
  href,
  variant = 'link',
  placement = 'up',
  align = 'auto',
  block = false,
  ariaLabel,
  inline = false,
  locale,
  hint,
  shinyLabel,
  orLabel,
  className,
  wrapperClassName,
}: NestedEntityProps) {
  // C-R4: `useId` is unique per page because @astrojs/react gives every React root, static
  // or island, its own `identifierPrefix` and repeats it when it hydrates.
  const tipId = useId();

  const wrapper = ['ac-nested-entity'];
  if (block) wrapper.push('ac-nested-entity--block');
  if (wrapperClassName) wrapper.push(wrapperClassName);

  const trigger = ['ac-nested-entity__trigger', `ac-nested-entity__trigger--${variant}`];
  if (className) trigger.push(className);

  // The two triggers carry the same attributes; only the element and the destination differ.
  const attributes = {
    className: trigger.join(' '),
    'aria-describedby': tipId,
    'aria-label': ariaLabel,
  };

  return (
    <span
      className={wrapper.join(' ')}
      data-ac-tt=""
      data-ac-tt-placement={placement}
      data-ac-tt-align={align}
    >
      {href === undefined ? (
        <button type="button" {...attributes}>
          {children}
        </button>
      ) : (
        <a href={href} {...attributes}>
          {children}
        </a>
      )}
      <GameTooltip
        tip={tip}
        id={tipId}
        popover="manual"
        inline={inline}
        locale={locale}
        hint={hint}
        shinyLabel={shinyLabel}
        orLabel={orLabel}
      />
    </span>
  );
}
