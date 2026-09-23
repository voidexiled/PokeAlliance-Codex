import type { ReactNode } from 'react';

import { NestedEntity } from '@/components/game/NestedEntity';
import { ShinyMark } from '@/components/game/ShinyMark';
import { Sprite } from '@/components/game/Sprite';
import type { SpriteProps } from '@/components/game/Sprite';
import { SpriteStage } from '@/components/game/SpriteStage';
import type { Locale } from '@/i18n/config';
import { formatInteger } from '@/lib/format/numbers';
import type { TipData } from '@/lib/game/tips';

// EntitySlot (spec 7.2.6, 7.4.4, 7.5.5, 7.5.10; DS:EntitySlot): one inventory slot of the
// Slots view. A square frame with the sprite of the entity, its stack count and, when it
// applies, the Shiny mark; it opens the entity's game tooltip at its side.
//
// The slot is a `NestedEntity` with `variant="plain"`: the frame, the size and the hover
// are this file's, and the trigger, the panel and every behaviour of 7.5.4 come from
// there. Its placement is fixed (`side`, spec 7.2 table): the controller opens the panel
// to the right of the slot, flips it to the left when there is no room and drops it below
// the slot on a phone (7.5.5), so no caller picks a side.
//
// The name is never written inside the slot: it is the accessible name of the trigger and
// the title of the panel (DS:EntitySlot §No hacer). On a listing the price is read after
// the name, with the exact figure (§9).
//
// Sizes (7.4.4): 72 for the Pokédex and Comercio — a 64 cell at 2x, or the art 8 px
// smaller than the slot — and 40 for drops and system items, a 32 cell at 1x. The 40 grows
// to the 44 touch target on a coarse pointer through `entity-slot.css`, with the sprite
// left at 1x; `size={44}` asks for that width on every pointer.

export interface EntitySlotProps {
  /** Name of the entity: the accessible name of the slot (7.5.7). */
  name: string;
  /**
   * Sprite of the entity, already resolved by the adapter (DP2). `null` is an entity with
   * no image in the registry: the missing mark, or an empty frame when `known` is false.
   * A sprite with `smooth` is an illustration and is drawn 8 px smaller than the slot.
   */
  sprite: SpriteProps | null;
  /** Panel the slot opens, built by a constructor of `src/lib/game/tips.ts` (7.5.3). */
  tip: TipData;
  /** Picks the format of the stack count and of the amounts inside the panel (C-R3). */
  locale: Locale;
  size?: 72 | 44 | 40;
  /** Stack count, bottom right. A count of zero and an empty text draw nothing. */
  qty?: number | string;
  /** Listing price, read after the name: «150.000.000 Pokédólares o 400 Diamonds» (§9). */
  price?: string;
  /**
   * An entity with no sprite shows the missing mark; `false` leaves the frame empty, and
   * that is only used when the empty capacity is information of the game (7.4.4).
   */
  known?: boolean;
  shiny?: boolean;
  /** Page of the entity; without it the trigger is a button (7.5.7). */
  href?: string;
  /** Strip of the panel, `ui.pinHint`: «Mantén Shift para fijar» / «Hold Shift to pin». */
  hint: string;
  /** Accessible name of the Shiny mark in the panel head (13.4). */
  shinyLabel?: string;
  /** The word between two price options in the panel, `ui.or`: «o» / «or» (13.3). */
  orLabel?: string;
  /** Utilities added by the caller, after the component's own classes (3.8). */
  className?: string;
}

export function EntitySlot({
  name,
  sprite,
  tip,
  locale,
  size = 40,
  qty,
  price,
  known = true,
  shiny = false,
  href,
  hint,
  shinyLabel,
  orLabel,
  className,
}: EntitySlotProps) {
  let cell: ReactNode;
  if (sprite !== null && sprite.smooth === true) {
    // Pokémon art is an illustration: 8 px less than the slot (64 in the 72 one), smooth
    // and without a frame of its own.
    cell = <Sprite {...sprite} width={size - 8} height={size - 8} alt="" />;
  } else {
    // A bare game cell inside the slot's own frame: the pixel sprite at 1x, 2x in the 72.
    cell = <SpriteStage sprite={sprite} size={size >= 72 ? 64 : 32} framed={false} known={known} />;
  }

  // The badge is the count of the stack, so zero and an empty text are nothing to show.
  const count = typeof qty === 'number' ? formatInteger(qty, locale) : qty;
  const stack = qty === undefined || qty === 0 || qty === '' ? null : count;

  const classes = ['ac-entity-slot', `ac-entity-slot--${size}`];
  if (className) classes.push(className);

  return (
    <NestedEntity
      tip={tip}
      locale={locale}
      href={href}
      variant="plain"
      placement="side"
      block
      ariaLabel={price ? `${name}, ${price}` : name}
      className={classes.join(' ')}
      hint={hint}
      shinyLabel={shinyLabel}
      orLabel={orLabel}
    >
      {cell}
      {stack === null ? null : (
        <span className="ac-entity-slot__qty" aria-hidden="true">
          {stack}
        </span>
      )}
      {/* The mark needs no name here: the word «Shiny» is already in the name of the slot. */}
      {shiny ? <ShinyMark corner="slot" /> : null}
    </NestedEntity>
  );
}
