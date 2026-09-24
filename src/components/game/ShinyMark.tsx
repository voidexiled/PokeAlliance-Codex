import '@/styles/components/entity-slot-marks.css';

import { Sprite } from '@/components/game/Sprite';
import { pokemonUnknownSize, pokemonUnknownSrc } from '@/lib/content/pokemon-media';
import { hasUiSprite, uiSpriteEntry, uiSpriteSrc } from '@/lib/sprites/ui-sprites';

// The Shiny treatment of the site (plan of the redesign). A shiny Pokémon is told apart by a
// golden glow on its art (`ac-shiny-glow`, token `shiny-glow`), never by a mark over it: slots,
// cards, Lista rows and tooltip heads draw `PokemonArt` with `shiny`, and the word «Shiny»
// stays in the facts and in the accessible name. `PokemonArt` also owns the client Pokédex
// «?» (`ui/pokemon-desconocido`), drawn where a Pokémon has no art or its art fails.
//
// ShinyMark (spec 7.4, 16.3.5, DS:ShinyMark): the client's Shiny icon (`ui/shiny`, from
// game_pokedex/images/shiny_icon.png), drawn at its natural pixel size. While the registry has
// no `ui/shiny` entry it falls back to the two blue squares of DS:ShinyMark. It is no longer
// drawn over art; it stays for the controls that name the Shiny variant (a filter toggle).
//
// Both are TSX and not Astro because every place that draws them is painted by a card or by
// an island. From an .astro page they render on the server and ship no JavaScript.
//
// The mark is never the only signal on its own: either the word «Shiny» sits next to it, or
// `label` gives it a name, and then the mark is a `role="img"`.

const SHINY_KEY = 'ui/shiny';

interface ShinyMarkProps {
  /**
   * Absolute placement: `true` or 'tooltip' pins the mark to the top right corner of its box
   * (head of the game tooltip); 'slot' insets it from that corner (EntitySlot). Omitted, the
   * mark stays in the flow, next to its text. The box that receives a corner mark is the one
   * that carries `position: relative`.
   */
  corner?: boolean | 'tooltip' | 'slot';
  /**
   * Accessible name («Shiny»), which turns the mark into `role="img"`. Omitted, the mark is
   * `aria-hidden` because the visible text already says «Shiny».
   */
  label?: string;
  /** Utilities added by the caller, after the component's own classes (3.8). */
  className?: string;
}

export function ShinyMark({ corner, label, className }: ShinyMarkProps) {
  const placement = corner === true ? 'tooltip' : corner;
  const sprite = hasUiSprite(SHINY_KEY);
  const classes = ['ac-shiny-mark'];
  if (sprite) classes.push('ac-shiny-mark--sprite');
  if (placement) classes.push(`ac-shiny-mark--${placement}`);
  if (className) classes.push(className);
  const a11y = {
    role: label ? 'img' : undefined,
    'aria-label': label,
    'aria-hidden': label ? undefined : true,
  } as const;
  if (sprite) {
    const [width, height] = uiSpriteEntry(SHINY_KEY).frame;
    return (
      <span className={classes.join(' ')} {...a11y}>
        <img
          className="ac-shiny-mark__icon"
          src={uiSpriteSrc(SHINY_KEY)}
          width={width}
          height={height}
          alt=""
          draggable={false}
        />
      </span>
    );
  }
  return (
    <span className={classes.join(' ')} {...a11y}>
      <span className="ac-shiny-mark__back" />
      <span className="ac-shiny-mark__front" />
    </span>
  );
}

/** Class of the golden glow of a shiny Pokémon's art (token `shiny-glow`). */
export const SHINY_GLOW_CLASS = 'ac-shiny-glow';

export interface PokemonArtProps {
  /** URL of the art (`resolvePokemonImage`), or `null`: the «?» of the client Pokédex. */
  src: string | null;
  /**
   * Size the art is drawn at: 64 in the 72 slot and the card head, 70 in the tooltip head,
   * 40 in a Lista row. The «?» is drawn at three quarters of it (`pokemonUnknownSize`).
   */
  size: number;
  /** A shiny variant: the golden glow on the art. The «?» never glows (it is not the art). */
  shiny?: boolean;
  /** Accessible name of the art. Omitted, it is decorative: the name around it says it. */
  label?: string;
  loading?: 'lazy' | 'eager';
  /** Classes added to the art image (the tooltip head places it). */
  className?: string;
}

/** The «?» of the client Pokédex: an illustration, smooth, never watched by art-loading.ts. */
function Unknown({ px, fallback, label }: { px: number; fallback: boolean; label?: string }) {
  const src = pokemonUnknownSrc();
  if (src === null) return null;
  const named = !fallback && label !== undefined && label !== '';
  return (
    <img
      className={fallback ? 'ac-unknown-art ac-unknown-art--fallback' : 'ac-unknown-art'}
      src={src}
      width={px}
      height={px}
      alt={named ? label : ''}
      aria-hidden={named ? undefined : true}
      // A fallback is `display: none` until the art beside it fails, and a lazy image that is
      // not rendered is never fetched.
      loading={fallback ? 'lazy' : undefined}
      decoding="async"
      draggable={false}
    />
  );
}

/**
 * The art of a Pokémon with the Shiny glow and the «?» fallback, as direct children of the
 * caller's box (a slot, a `SpriteStage`, the tooltip art box, a Lista sprite cell), which is
 * `position: relative` and centres its content. With `src` it draws the art and a hidden «?»
 * that entity-slot-marks.css shows when art-loading.ts marks the art `error`; without it,
 * the «?». While the registry has no «?», a missing art draws nothing and a failed one the
 * missing mark of its box.
 */
export function PokemonArt({
  src,
  size,
  shiny = false,
  label,
  loading,
  className,
}: PokemonArtProps) {
  const px = pokemonUnknownSize(size);
  if (src === null || src === '') return <Unknown px={px} fallback={false} label={label} />;
  const classes = [shiny ? SHINY_GLOW_CLASS : '', className ?? ''].filter(Boolean).join(' ');
  return (
    <>
      <Sprite
        src={src}
        smooth
        width={size}
        height={size}
        alt={label ?? ''}
        loading={loading}
        className={classes === '' ? undefined : classes}
      />
      <Unknown px={px} fallback />
    </>
  );
}
