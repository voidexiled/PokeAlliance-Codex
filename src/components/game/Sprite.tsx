import type { CSSProperties, ReactElement } from 'react';

import { assetSrc } from '@/lib/assets/version';
import {
  CELL,
  assertRegisteredAnimation,
  cellPlacement,
  frameForQuantity,
  frameObjectPosition,
  animationName,
  spriteMode,
  type SpriteMode,
  type SpriteRegistry,
} from '@/lib/sprites/resolve';

// The registry, on the server alone, to fail an animation it does not declare (7.4.2).
// The client build folds the condition to `null` and drops the import with it, so no
// island ever carries the sprite registry because it draws a sprite (DP2); a static import
// would, because src/lib/sprites/registry.ts reads the file at its top level.
const buildRegistry: SpriteRegistry | null = import.meta.env.SSR
  ? (await import('@/lib/sprites/registry')).spriteRegistry
  : null;

// Sprite (spec 7.4, DS:Sprite): every image of the game the site draws. Pixel sprites
// at integer scale with `image-rendering: pixelated`; illustrations (Pokémon art of
// 140 px, element icons of 100) scale smoothly with `smooth`.
//
// Markup (E9, C-R2). The reference draws a sheet as a `span` window with the strip
// inside and writes its keyframes into `document` from the client; those keyframes
// would not exist in the prerendered HTML. Here a sheet is one `<img class="ac-sprite">`
// whose frame is chosen with `object-position` over `object-fit: cover`, and the
// keyframes of every animated sheet of the registry come from `SpriteStyles.astro`,
// written in the build. So the frame and the animation need no JavaScript at all.
//
// Props are the `SpriteProps` of the design system plus `half` and `loading` (7.4.2).
// They arrive already translated from a registry key by the adapter, `spriteData` /
// `spriteOrNull` of src/lib/sprites/resolve.ts: no component takes its data from the
// registry and none writes a sprite URL (DP2, C7-15). This one only reads it in the
// build, through src/lib/sprites/registry.ts, to fail an animation the registry does
// not declare (7.4.2).
//
// The name of the entity never lives here: `alt` is empty by default and the sprite is
// `aria-hidden`, with the name in visible text or in the `aria-label` of the trigger.

export interface SpriteProps {
  /** Image URL, a horizontal strip of `frames` frames for sheets. */
  src: string;
  /** Natural size of one frame. Default [32, 32]. */
  size?: [number, number];
  frames?: number;
  /** Registry mode; inferred from `durations` / `thresholds` when omitted. */
  mode?: SpriteMode;
  /** Frame of a `variante` sheet (0-based). */
  frame?: number;
  /** Stack size of a `cantidad` sheet: shows the frame of the last threshold it reaches. */
  quantity?: number;
  thresholds?: number[];
  /** Per-frame duration in ms; present only when the sheet has to animate. */
  durations?: number[];
  /** Default true. */
  loop?: boolean;
  /** Integer scale of a pixel sprite. Default 1. */
  scale?: number;
  /** Illustration: smooth scaling to `width` × `height`. */
  smooth?: boolean;
  width?: number;
  height?: number;
  /** Centre the sprite on whole pixels inside a game cell of 32, or 64 (7.4.3). */
  cell?: boolean;
  /** Empty (the default) makes the sprite decorative and `aria-hidden`. */
  alt?: string;
  /** The 5 s bounce of the pinned sidebar sprites and of Destacados (6.2). */
  bounce?: boolean;
  /**
   * Draw the sprite at half its size. The only pixel sprite the site shrinks is the
   * Diamond of the sidebar's «Destacados» group (R11, S7); C7-15 checks that no other
   * file passes it.
   */
  half?: true;
  loading?: 'lazy' | 'eager';
  className?: string;
}

function classes(...values: (string | false | undefined)[]): string {
  return values.filter(Boolean).join(' ');
}

export function Sprite({
  src,
  size = [CELL, CELL],
  frames = 1,
  mode,
  frame = 0,
  quantity,
  thresholds,
  durations,
  loop,
  scale = 1,
  smooth = false,
  width,
  height,
  cell = false,
  alt = '',
  bounce = false,
  half,
  loading,
  className,
}: SpriteProps): ReactElement {
  const [frameWidth, frameHeight] = size;
  const sheet = Math.max(1, Math.trunc(frames));
  const k = Math.max(1, Math.trunc(scale));
  const hidden = alt ? undefined : true;

  if (smooth) {
    // `data-state` of an illustration belongs to src/scripts/art-loading.ts, which writes it
    // on the prerendered image before its island hydrates (7.4.2): React never renders it,
    // so hydration must not report it as a difference with the server.
    return (
      <img
        suppressHydrationWarning
        className={classes('ac-sprite', 'ac-sprite--smooth', bounce && 'ac-bounce', className)}
        src={assetSrc(src)}
        width={width ?? (cell ? CELL * k : frameWidth * k)}
        height={height ?? (cell ? CELL * k : frameHeight * k)}
        alt={alt}
        aria-hidden={hidden}
        loading={loading}
        decoding="async"
        draggable={false}
      />
    );
  }

  const kind = mode ?? spriteMode(sheet, { durations, thresholds });
  // A `cantidad` sheet with no quantity yet rests on frame 0, like a stack of none.
  const asked =
    kind === 'cantidad' && thresholds
      ? frameForQuantity(thresholds, quantity ?? 0)
      : kind === 'variante'
        ? frame
        : 0;
  const shown = Math.min(Math.max(0, Math.trunc(asked)), sheet - 1);

  const animates = kind === 'animacion' && durations?.length === sheet;
  const anim = animates
    ? animationName({ frames: sheet, durations: durations ?? [], loop: loop !== false })
    : undefined;
  // 7.4.2: the keyframes exist only for the signatures of the registry, so any other one
  // fails the build instead of resting on frame 0 without a word. The check runs on the
  // server alone: the client build drops it, and the registry with it.
  if (buildRegistry !== null && anim !== undefined) assertRegisteredAnimation(buildRegistry, anim);

  // Half is the one fractional size of the site; every other sprite is an integer scale.
  const factor = half ? 0.5 : k;
  const shownWidth = Math.round(frameWidth * factor);
  const shownHeight = Math.round(frameHeight * factor);
  const style: CSSProperties = {
    // Data, not design: the geometry of this frame and the frame of the sheet it shows
    // (C-R2). The size is written here as well as in the attributes because the base
    // reset `img { height: auto }` beats a `height` attribute, and `auto` gives a sheet
    // the ratio of its whole strip: an 8-frame stone at 2x would draw 64 × 8, not 64 × 64.
    width: shownWidth,
    height: shownHeight,
    objectPosition: frameObjectPosition(sheet, animates ? 0 : shown),
  };
  // The class list and the bounce belong to the root, which is the cell when there is one.
  const image = (
    <img
      className={classes('ac-sprite', !cell && bounce && 'ac-bounce', !cell && className)}
      src={assetSrc(src)}
      width={shownWidth}
      height={shownHeight}
      alt={alt}
      aria-hidden={hidden}
      loading={loading}
      decoding="async"
      draggable={false}
      data-anim={anim}
      style={style}
    />
  );

  if (!cell) return image;

  const place = cellPlacement(size, k);
  return (
    <span
      className={classes('ac-sprite-cell', bounce && 'ac-bounce', className)}
      style={{ width: place.size, height: place.size }}
      aria-hidden={hidden}
    >
      <span className="ac-sprite-cell__at" style={{ left: place.left, top: place.top }}>
        {image}
      </span>
    </span>
  );
}
