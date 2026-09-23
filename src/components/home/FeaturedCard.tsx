import '@/styles/components/featured.css';

import { Sprite, type SpriteProps } from '@/components/game/Sprite';
import { Glyph } from '@/components/icons/Glyph';
import { CELL } from '@/lib/sprites/resolve';

// FeaturedCard (spec 7.2.7, 8.1 step 3; DS:FeaturedCard; CARD_GRID_SYSTEM §6.4): one link card
// of «Destacados», the pages content/destacados.json pins (the pinned group of the menu links the
// same ones): the sprite of the page in its box of 36, the name of the page on one line and the
// arrow of 12. The whole card is the link. It opens no tooltip (a page is not a game entity) and
// carries no description under the name (DS:FeaturedCard «No hacer»).
//
// Markup and classes of the reference (`bundle.js` FeaturedCard, C-R2): `a.ac-featured-card`
// with the `aria-hidden` sprite box, the bounce wrapper, the label and the arrow. The arrow is
// the `arrow-right` Glyph (C-R7), drawn at 12 with the stroke the design system gives its 12 px
// glyphs (`DS:README §Iconografía`).
//
// The sprite (DS:guias/20 «Tamaños por lugar»): up to 32 at integer scale, centred in the box —
// a sprite of 16 or 15 at 2x, one of 20 × 26 or of 32 at 1x — and never above 3x, the largest
// scale S7 allows (a sprite of 8 is drawn at 3x, 24). The card picks that scale from the frame
// of the sprite, so the composer passes what the adapter returns (DP2) and never a scale of its
// own. An illustration (a smooth image) is drawn to fit the same 32. A pixel sprite wider
// or taller than 32 has no integer scale that fits and fails the build: the owner picked a sprite
// that cannot go in «Destacados» (D-011). A sheet in `animacion` mode moves when the adapter
// resolved it animated (the Diamond, DS:guias/40); the bounce is on its own wrapper, so the two
// animations never meet on one element.
//
// TSX and not Astro because the Buscar island paints «Destacados» too (C-R1, 8.6); from a page it
// renders on the server with no client directive and ships no JavaScript. Styles:
// featured.css, a per-page sheet this module imports (D-018).

/** The largest side of a sprite in «Destacados» (DS:guias/20): one game cell. */
const FEATURED_MAX = CELL;

/** The largest scale of a pixel sprite (S7: 1x, 2x or 3x). */
const MAX_SCALE = 3;

export interface FeaturedCardProps {
  /** Name of the page, in the page's language (`etiqueta` of content/destacados.json). */
  label: string;
  /** Route of the page, with its locale segment and trailing slash (8.0.1). */
  href: string;
  /** The sprite as the adapter resolves it (`spriteOrNull`); `null` leaves the box empty. */
  sprite: SpriteProps | null;
  /** The 5 s bounce of Destacados (6.2). Default true. */
  bounce?: boolean;
  /** Utilities added by the caller on the link, after the component's class (3.8). */
  className?: string;
}

/**
 * The integer scale of a pixel sprite in «Destacados»: the largest one that keeps both sides
 * within 32, and 3 at most (S7). A side above 32 has none, and the build fails with the reason.
 */
export function featuredScale(size: readonly [number, number]): number {
  const side = Math.max(size[0], size[1]);
  if (side > FEATURED_MAX) {
    const limit = `hasta ${FEATURED_MAX} a escala entera`;
    throw new Error(
      `FeaturedCard: un sprite de ${size[0]} × ${size[1]} no cabe en Destacados (${limit}).`,
    );
  }
  return Math.min(MAX_SCALE, Math.max(1, Math.floor(FEATURED_MAX / side)));
}

/**
 * The sprite at the size of «Destacados»: an integer scale, or 32 for an illustration. The
 * bounce belongs to the wrapper of the card, never to the image.
 */
function fitted(sprite: SpriteProps): SpriteProps {
  const size = sprite.size ?? [CELL, CELL];
  if (sprite.smooth) {
    const side = Math.max(size[0], size[1]);
    return {
      ...sprite,
      width: Math.round((size[0] * FEATURED_MAX) / side),
      height: Math.round((size[1] * FEATURED_MAX) / side),
      bounce: false,
    };
  }
  return { ...sprite, scale: featuredScale(size), cell: false, bounce: false };
}

export function FeaturedCard({ label, href, sprite, bounce = true, className }: FeaturedCardProps) {
  const image = sprite === null ? null : <Sprite {...fitted(sprite)} />;
  return (
    <a className={className ? `ac-featured-card ${className}` : 'ac-featured-card'} href={href}>
      <span className="ac-featured-card__sprite" aria-hidden="true">
        {image !== null && bounce ? (
          <span className="ac-featured-card__bounce ac-bounce">{image}</span>
        ) : (
          image
        )}
      </span>
      <span className="ac-featured-card__label">{label}</span>
      <Glyph name="arrow-right" size={12} className="ac-featured-card__arrow" />
    </a>
  );
}
