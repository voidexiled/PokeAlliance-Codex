import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

import { Sprite, type SpriteProps } from '@/components/game/Sprite';

// SpriteStage and MissingSprite (spec 7.4.3, 7.4.4, DS:SpriteStage): the fixed
// boxes where a sprite is drawn — the 72 stage, the 44 / 40 / 36 slots, the 32
// held slot and the bare 64 and 32 cells — with the stack count, the missing
// mark, the empty slot and the loading box.
//
// The box, not the caller, picks the integer scale: a 32 px sprite fills a 64 cell
// at 2x and a 2 × 2 tile sprite (64 px) already fills it at 1x, so a pixel sprite
// is never scaled down nor smoothed (DS:guias/20 §Escala entera, S7). Pokémon art
// and element icons are illustrations (`smooth`): they are drawn to a size, never
// to a cell, and they carry no frame.
//
// The whole box is `aria-hidden`: the name of the entity lives in the link, the
// label or the tooltip that wraps it, never inside the box (7.4.4).

/** Box sizes of 7.4.4, from the 72 stage down to the 32 held slot. */
type StageSize = 72 | 64 | 44 | 40 | 36 | 32;

interface MissingSpriteProps {
  /** 16 inside a 32 cell (default), 32 inside a 64 cell, 40 for a whole slot. */
  size?: 16 | 32 | 40;
  /** 'tooltip': the empty registry slot inside a game tooltip (radius 4, `inset-tt-empty`). */
  variant?: 'default' | 'tooltip';
  /** Utilities added by the caller, after the component's own classes (3.8). */
  className?: string;
}

/**
 * A known entity whose sprite is not in the registry yet (R7): a dark square at
 * half the cell, never an empty frame and never a fallback initial. The name stays
 * available in the tooltip, in the `aria-label` and in the chip that carries it.
 */
export function MissingSprite({ size = 16, variant, className }: MissingSpriteProps) {
  const box = size === 32 || size === 40 ? size : 16;
  const classes = ['ac-missing-sprite', `ac-missing-sprite--${box}`];
  if (variant === 'tooltip') classes.push('ac-missing-sprite--tooltip');
  if (className) classes.push(className);
  return <span className={classes.join(' ')} aria-hidden="true" />;
}

interface SpriteStageProps {
  /**
   * Props of the sprite to draw, without `scale`: the box picks it. `null` means
   * the entity has no image in the registry — the missing mark, or an empty slot
   * when `known` is false.
   */
  sprite?: SpriteProps | null;
  /**
   * Box size in px (7.4.4). 72: a 64 cell at 2x, 3 px of air and a 1 px frame.
   * 44: touch slot. 40: a 32 cell at 1x, 3 px of air and the frame. 36: the same
   * cell with 1 px of air. 32: the held slot (framed, radius 6) or the bare cell.
   * 64: the bare 2x cell of a tooltip head.
   */
  size?: StageSize;
  /** Stack count in the bottom right corner; 0 and an empty string draw nothing. */
  qty?: number | string;
  /** 1 px `border-secondary` frame, radius 8. Art is never framed. */
  framed?: boolean;
  /** Frame background: 'secondary' (72 stage, 32 held slot) or 'primary' (44 / 40 / 36). */
  tone?: 'secondary' | 'primary';
  /**
   * A known entity with no sprite shows the missing mark; `false` leaves the frame
   * alone, and that empty slot is only used when the empty capacity is information
   * of the game (DS:guias/20 §Vacío).
   */
  known?: boolean;
  /** Loading: a 32 box that pulses; the sprite fades in over 300 ms when it ends. */
  loading?: boolean;
  /** Utilities added by the caller, after the component's own classes (3.8). */
  className?: string;
}

export function SpriteStage({
  sprite = null,
  size = 72,
  qty,
  framed: requestedFrame,
  tone: requestedTone,
  known: requestedKnown,
  loading = false,
  className,
}: SpriteStageProps) {
  // The box holds a 64 cell (the 72 stage and the bare 64) or a 32 cell; the
  // sprite fills its own cell of 32 or 64. k is what is left over, floored, so a
  // pixel sprite is only ever drawn at 1x or 2x.
  const boxCell = size >= 64 ? 64 : 32;
  const frame = sprite?.size ?? [32, 32];
  const spriteCell = Math.max(frame[0], frame[1]) <= 32 ? 32 : 64;
  const k = Math.max(1, Math.floor(boxCell / spriteCell));

  const known = requestedKnown !== false;
  const art = sprite?.smooth === true;
  const framed = art ? false : (requestedFrame ?? size !== 64);
  const bare = !framed && (size === 64 || size === 32);
  const tone =
    requestedTone ?? (size === 72 || size === 32 ? 'secondary' : size === 64 ? 'none' : 'primary');

  // The sprite fades in (300 ms) on the render where a loading box gives way to
  // it, and keeps the class until the box goes back to loading. A page with no
  // island never loads: `loading` is false on both renders and nothing fades.
  const wasLoading = useRef(loading);
  const fade = useRef(false);
  if (loading) fade.current = false;
  else if (wasLoading.current) fade.current = true;
  useEffect(() => {
    wasLoading.current = loading;
  });

  const spriteClass = (extra: string | undefined) => {
    const classes = [];
    if (extra) classes.push(extra);
    if (fade.current) classes.push('ac-sprite-stage__in');
    return classes.length > 0 ? classes.join(' ') : undefined;
  };

  let inner: ReactNode;
  if (loading) {
    inner = <span className="ac-sprite-stage__loading" />;
  } else if (art && sprite) {
    // Illustration: 64 inside the 72 stage (the box minus its air and frame), or
    // the whole bare cell.
    const drawn = bare ? size : size - 8;
    inner = (
      <Sprite
        {...sprite}
        width={drawn}
        height={drawn}
        alt=""
        className={spriteClass(sprite.className)}
      />
    );
  } else if (sprite) {
    // The held slot (32, framed) shows the sprite as it is at 1x; every other box
    // draws a game cell at scale k, centred on whole pixels (7.4.3).
    inner = (
      <Sprite
        {...sprite}
        scale={k}
        cell={!(size === 32 && framed)}
        alt=""
        className={spriteClass(sprite.className)}
      />
    );
  } else if (size === 32 && framed) {
    inner = known ? <MissingSprite size={16} /> : null;
  } else {
    const cellClasses = ['ac-sprite-stage__cell'];
    if (k === 2) cellClasses.push('ac-sprite-stage__cell--2x');
    inner = (
      <span className={cellClasses.join(' ')}>
        {known ? <MissingSprite size={k === 2 ? 32 : 16} /> : null}
      </span>
    );
  }

  const classes = ['ac-sprite-stage', `ac-sprite-stage--${size}`];
  if (framed) {
    classes.push('ac-sprite-stage--framed');
    if (tone !== 'none') classes.push(`ac-sprite-stage--${tone}`);
  }
  if (className) classes.push(className);

  const count = qty !== undefined && qty !== null && qty !== '' && qty !== 0 ? qty : null;

  return (
    <span className={classes.join(' ')} aria-hidden="true">
      {inner}
      {count !== null && <span className="ac-sprite-stage__qty">{count}</span>}
    </span>
  );
}
