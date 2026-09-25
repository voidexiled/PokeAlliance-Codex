import type { ReactNode } from 'react';

import { NestedEntity } from '@/components/game/NestedEntity';
import type { NestedEntityAlign, NestedEntityPlacement } from '@/components/game/NestedEntity';
import { Sprite } from '@/components/game/Sprite';
import { MissingSprite } from '@/components/game/SpriteStage';
import type { Locale } from '@/i18n/config';
import { formatDiamonds, formatInteger } from '@/lib/format/numbers';
import { UNKNOWN } from '@/lib/format/unknown';
import type { TipData } from '@/lib/game/tips';
import { spriteOrNull } from '@/lib/sprites/resolve';
import moneySprites from 'virtual:ac-money-sprites';

// DiamondsAmount (spec 7.2.5, 7.8, 7.5.3, R5, S8; DS:DiamondsAmount, DS:guias/40): an amount
// of the premium currency with frame 0 of the Diamond sheet right before the figure,
// «2.400 Diamonds». «Diamonds» is a game term and reads the same in both locales (13.4).
//
// Three uses, as in the design system:
//   - a price option («o 2.400 Diamonds», usually inside `PriceOptions`): with `link` the
//     amount is the `NestedEntity` that opens the Diamonds panel (`diamondsTip`, 7.5.3),
//     placed `up` + `end` by default because a price sits at the right of its row (7.5.5);
//   - the Cantidad of a Diamonds listing: no link, and `word={false}` leaves «Diamonds» to
//     screen readers only («300»);
//   - a row of a game tooltip, without a link («10 Diamonds»).
//
// Markup of the reference (`bundle.js` DiamondsAmount): the `__sprite` box first, then the
// figure. The still Diamond is the reference's own window over the strip — `__frame`, 32
// wide with `overflow: hidden`, around the whole `__sheet` image — so frame 0 needs no
// `object-position`; a spinning one is `Sprite`, whose keyframes `SpriteStyles.astro`
// writes in the build from the registry (7.4.2). It spins only in Comercio (7.8), where the
// caller passes `animated`; with reduced motion `Sprite` stays on frame 0 (S15).
//
// The sprite is the fixed key `ui/diamond`, which this component resolves through the
// adapter on its own (DP2), from the two-entry registry of `virtual:ac-money-sprites`
// (astro.config.mjs); a registry without it gives `null` and the missing mark (R11).
// The figure and the word come from `formatInteger` and `formatDiamonds` (spec 13.3).
//
// R2: the link exists only when the Diamonds panel has something to show. The registry
// feeds its rows (the `moneda` object of content/items/diamantes.json), and `diamondsTip`
// returns `null` while it has none: the amount then stays plain text. DP3: no `open`,
// `defaultOpen` or `onOpenChange`; the controller of 7.5.4 owns the panel.

/** `ui/diamond` through the adapter (DP2): the frame of 32 × 32 (frame 0 of a sheet), still. */
const STILL = spriteOrNull(moneySprites, 'ui/diamond');

/** The Diamonds panel a price opens, with the copy it needs (DP1). */
export interface DiamondsLink {
  /**
   * `diamondsTip(moneda, locale, ui.tooltip, { sprite })` (7.5.3). `null` — no row in the
   * registry — and a panel with nothing below its title keep the amount plain (R2).
   */
  tip: TipData | null;
  /** Strip of the panel, `ui.pinHint`: «Mantén Shift para fijar» / «Hold Shift to pin». */
  hint: string;
  /** Page of the Diamonds. Without it the trigger is a button (7.5.7): no `#` fallback. */
  href?: string;
  /** 7.5.5: `up` + `end`, the `up-right` of the design system, is the default of a price. */
  placement?: NestedEntityPlacement;
  align?: NestedEntityAlign;
}

export interface DiamondsAmountProps {
  /** Number of Diamonds (2400 is «2.400»). `null` or `undefined`: «—», without a sprite. */
  amount: number | null | undefined;
  /** Picks the separators of the figure (C-R3). */
  locale: Locale;
  /** Shows «Diamonds» after the figure (default); `false` keeps the word for screen readers. */
  word?: boolean;
  /** The figure in 700. */
  strong?: boolean;
  /** The Diamond spins when its registry entry is an animation: only in Comercio (7.8). */
  animated?: boolean;
  /** The price link that opens the Diamonds panel (DS `link`). */
  link?: DiamondsLink;
  /** Utilities added by the caller, after the component's own classes (3.8). */
  className?: string;
}

/** R2: a panel with nothing to show below its title is not a tooltip. */
function hasContent(tip: TipData): boolean {
  return tip.rows.length > 0 || Boolean(tip.sections?.length) || Boolean(tip.market?.length);
}

function classes(...values: (string | false | undefined)[]): string {
  return values.filter(Boolean).join(' ');
}

/** Frame 0 of the Diamond at 32, still or spinning. */
function diamond(animated: boolean): ReactNode {
  // The Diamond turns only while its registry entry is an animation: the game's current gem
  // is one still frame. A broken animation still fails the build (7.4.1).
  if (animated && STILL?.mode === 'animacion') {
    const spinning = spriteOrNull(moneySprites, 'ui/diamond', { animado: true });
    if (spinning) return <Sprite {...spinning} alt="" />;
  }
  if (!STILL) return <MissingSprite size={16} />;
  const [width, height] = STILL.size;
  return (
    <span className="ac-diamonds-amount__frame">
      <img
        className="ac-diamonds-amount__sheet"
        src={STILL.src}
        alt=""
        width={width * STILL.frames}
        height={height}
        decoding="async"
        draggable={false}
      />
    </span>
  );
}

export function DiamondsAmount({
  amount,
  locale,
  word = true,
  strong = false,
  animated = false,
  link,
  className,
}: DiamondsAmountProps) {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) {
    return <span className={classes('ac-diamonds-amount', className)}>{UNKNOWN}</span>;
  }

  const figure = formatInteger(amount, locale);
  // The word is the one `formatDiamonds` writes after the figure (spec 13.3), so the game
  // term lives in one place; without `word` only screen readers get it.
  const unit = formatDiamonds(amount, locale).slice(figure.length);
  const content = (
    <>
      <span className="ac-diamonds-amount__sprite" aria-hidden="true">
        {diamond(animated)}
      </span>
      {word ? `${figure}${unit}` : figure}
      {word ? null : <span className="sr-only">{unit}</span>}
    </>
  );

  if (link?.tip && hasContent(link.tip)) {
    return (
      <NestedEntity
        tip={link.tip}
        href={link.href}
        variant="plain"
        placement={link.placement ?? 'up'}
        align={link.align ?? 'end'}
        locale={locale}
        hint={link.hint}
        className={classes(
          'ac-diamonds-amount',
          'ac-diamonds-amount--link',
          strong && 'ac-diamonds-amount--strong',
          className,
        )}
      >
        {content}
      </NestedEntity>
    );
  }

  return (
    <span
      className={classes('ac-diamonds-amount', strong && 'ac-diamonds-amount--strong', className)}
    >
      {content}
    </span>
  );
}
