import '@/styles/components/entity-slot-marks.css';

import { getSprite, hasSprite, spriteSrc } from '@/lib/sprites/registry';

// ShinyMark (spec 7.4, 16.3.5, DS:ShinyMark): the client's Shiny icon (`ui/shiny`, from
// game_pokedex/images/shiny_icon.png), drawn at its natural pixel size. While the registry has
// no `ui/shiny` entry it falls back to the two blue squares of DS:ShinyMark.
//
// It is TSX and not Astro because every place that draws it — the card variant line, the
// «Shiny» chip, the tooltip head and the slots — is painted by a card or by an island. From an
// .astro page it renders on the server with no client directive and ships no JavaScript.
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
  const sprite = hasSprite(SHINY_KEY);
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
    const [width, height] = getSprite(SHINY_KEY).frame;
    return (
      <span className={classes.join(' ')} {...a11y}>
        <img
          className="ac-shiny-mark__icon"
          src={spriteSrc(SHINY_KEY)}
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
