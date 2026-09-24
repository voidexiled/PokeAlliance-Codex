import '@/styles/components/entity-slot-marks.css';

import type { ReactNode } from 'react';

import { NestedEntity } from '@/components/game/NestedEntity';
import { ShinyMark } from '@/components/game/ShinyMark';
import { Sprite } from '@/components/game/Sprite';
import type { SpriteProps } from '@/components/game/Sprite';
import { SpriteStage } from '@/components/game/SpriteStage';
import { TierBadge } from '@/components/game/TierBadge';
import type { Locale } from '@/i18n/config';
import type { PokemonTier } from '@/lib/content/types';
import { formatInteger } from '@/lib/format/numbers';
import type { TipData } from '@/lib/game/tips';
import { uiSprite } from '@/lib/pickers/sprites';

// EntitySlot (spec 7.2.6, 7.4.4, 7.5.5, 7.5.10, 16.3.1; DS:EntitySlot): the game slot. A dark
// square with a 1 px frame and the sprite centred at an integer scale; it opens the entity's
// game tooltip at its side.
//
// The slot is a `NestedEntity` with `variant="plain"`: the frame, the size and the hover are
// this file's, and the trigger, the panel and every behaviour of 7.5.4 come from there. Its
// placement is fixed (`side`, spec 7.2 table). Without `tip` the slot is a static frame: the
// pickers draw it inside their own `option`, where the docked detail pane replaces the
// floating tooltip (16.3.2).
//
// The name is never written inside the slot: it is the accessible name of the trigger and the
// title of the panel (DS:EntitySlot §No hacer).
//
// States (16.3.1): rest, hover (lighter frame), focus ring (base.css), `selected` (accent frame
// and inner glow, as the chosen slot of the game), `unavailable` (dimmed, with a padlock).
// Corner marks, each optional: check top right (chosen in a multiple choice), ShinyMark top
// right when there is no check, mini TierBadge top left, stack count bottom right.

export type EntitySlotSize = 32 | 40 | 44 | 48 | 56 | 64 | 72;

export interface EntitySlotFaceProps {
  /**
   * Sprite of the entity, already resolved by the adapter (DP2). `null` is an entity with no
   * image in the registry: the missing mark, or an empty frame when `known` is false. A sprite
   * with `smooth` is an illustration and is drawn 8 px smaller than the slot.
   */
  sprite: SpriteProps | null;
  locale: Locale;
  size?: EntitySlotSize;
  /** Stack count, bottom right. A count of zero and an empty text draw nothing. */
  qty?: number | string;
  known?: boolean;
  shiny?: boolean;
  /** Check mark, top right: chosen in a multiple choice. It hides the Shiny mark. */
  check?: boolean;
  /** Mini tier badge, top left. */
  tier?: PokemonTier | null;
  /** The «none» slot of a picker: the no-choice icon instead of a sprite. */
  none?: boolean;
}

export interface EntitySlotProps extends EntitySlotFaceProps {
  /** Name of the entity: the accessible name of the slot (7.5.7). */
  name: string;
  /**
   * Panel the slot opens, built by a constructor of `src/lib/game/tips.ts` (7.5.3). Without it
   * the slot is a static, decorative frame.
   */
  tip?: TipData;
  /** Listing price, read after the name: «150.000.000 Pokédólares o 400 Diamonds» (§9). */
  price?: string;
  /** Page of the entity; without it the trigger is a button (7.5.7). */
  href?: string;
  /** Strip of the panel, `ui.pinHint`: «Mantén Shift para fijar» / «Hold Shift to pin». */
  hint?: string;
  /** Accessible name of the Shiny mark in the panel head (13.4). */
  shinyLabel?: string;
  /** The word between two price options in the panel, `ui.or`: «o» / «or» (13.3). */
  orLabel?: string;
  selected?: boolean;
  unavailable?: boolean;
  /** Utilities added by the caller, after the component's own classes (3.8). */
  className?: string;
}

/** Classes of the slot frame, shared with the picker options. */
export function entitySlotClasses(
  size: EntitySlotSize,
  state: { selected?: boolean; unavailable?: boolean; none?: boolean; className?: string } = {},
): string {
  const classes = ['ac-entity-slot', `ac-entity-slot--${size}`];
  if (state.selected) classes.push('ac-entity-slot--selected');
  if (state.unavailable) classes.push('ac-entity-slot--unavailable');
  if (state.none) classes.push('ac-entity-slot--none');
  if (state.className) classes.push(state.className);
  return classes.join(' ');
}

/** Everything inside the frame: the sprite and the corner marks. */
export function EntitySlotFace({
  sprite,
  locale,
  size = 40,
  qty,
  known = true,
  shiny = false,
  check = false,
  tier,
  none = false,
}: EntitySlotFaceProps) {
  let cell: ReactNode;
  if (none) {
    const icon = uiSprite('ui/none');
    cell = icon ? (
      <Sprite {...icon} cell />
    ) : (
      <span className="ac-entity-slot__none" aria-hidden="true" />
    );
  } else if (sprite !== null && sprite.smooth === true) {
    // Pokémon art is an illustration: 8 px less than the slot, smooth and unframed.
    cell = <Sprite {...sprite} width={size - 8} height={size - 8} alt="" />;
  } else {
    // A bare game cell inside the slot's own frame: 1x, or 2x in the 72.
    cell = <SpriteStage sprite={sprite} size={size >= 72 ? 64 : 32} framed={false} known={known} />;
  }

  // The badge is the count of the stack, so zero and an empty text are nothing to show.
  const count = typeof qty === 'number' ? formatInteger(qty, locale) : qty;
  const stack = qty === undefined || qty === 0 || qty === '' ? null : count;

  return (
    <>
      {cell}
      {tier !== undefined && tier !== null ? (
        <span className="ac-entity-slot__tier" aria-hidden="true">
          <TierBadge tier={tier} size="mini" />
        </span>
      ) : null}
      {stack === null ? null : (
        <span className="ac-entity-slot__qty" aria-hidden="true">
          {stack}
        </span>
      )}
      {check ? <span className="ac-entity-slot__check" aria-hidden="true" /> : null}
      {/* The mark needs no name here: the word «Shiny» is already in the name of the slot. */}
      {shiny && !check ? <ShinyMark corner="slot" /> : null}
      <span className="ac-entity-slot__lock" aria-hidden="true" />
    </>
  );
}

export function EntitySlot({
  name,
  tip,
  price,
  href,
  hint = '',
  shinyLabel,
  orLabel,
  selected = false,
  unavailable = false,
  className,
  size = 40,
  ...face
}: EntitySlotProps) {
  const classes = entitySlotClasses(size, { selected, unavailable, none: face.none, className });
  const content = <EntitySlotFace {...face} size={size} />;

  if (tip === undefined) {
    return (
      <span className={classes} role="img" aria-label={price ? `${name}, ${price}` : name}>
        {content}
      </span>
    );
  }

  return (
    <NestedEntity
      tip={tip}
      locale={face.locale}
      href={href}
      variant="plain"
      placement="side"
      block
      ariaLabel={price ? `${name}, ${price}` : name}
      className={classes}
      hint={hint}
      shinyLabel={shinyLabel}
      orLabel={orLabel}
    >
      {content}
    </NestedEntity>
  );
}
