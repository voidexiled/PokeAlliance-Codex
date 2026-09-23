// ShinyMark (spec 7.4, DS:ShinyMark): the two blue squares that say a Pokémon is
// Shiny. 13 × 14 px: a 9 × 10 back square in `tt-shiny` at `opacity-shiny-back`
// and an identical front one 4 px to the right and 4 px up. It replaces the «✦»
// glyph of the current Pokédex grid (P-24).
//
// It is TSX and not Astro because every place that draws it — the card variant
// line, the «Shiny» chip, the tooltip head and the Pokédex slot — is painted by a
// card or by an island. From an .astro page it renders on the server with no
// client directive and ships no JavaScript.
//
// The mark is never the only signal on its own: either the word «Shiny» sits next
// to it, or `label` gives it a name, and then the mark is a `role="img"`.

interface ShinyMarkProps {
  /**
   * Absolute placement: `true` or 'tooltip' pins the mark to the top right corner
   * of its box (head of the game tooltip); 'slot' insets it 4 px from that corner
   * (Pokédex slot). Omitted, the mark stays in the flow, next to its text.
   * The box that receives a corner mark is the one that carries `position: relative`.
   */
  corner?: boolean | 'tooltip' | 'slot';
  /**
   * Accessible name («Shiny»), which turns the mark into `role="img"`. Omitted,
   * the mark is `aria-hidden` because the visible text already says «Shiny».
   */
  label?: string;
  /** Utilities added by the caller, after the component's own classes (3.8). */
  className?: string;
}

export function ShinyMark({ corner, label, className }: ShinyMarkProps) {
  const placement = corner === true ? 'tooltip' : corner;
  const classes = ['ac-shiny-mark'];
  if (placement) classes.push(`ac-shiny-mark--${placement}`);
  if (className) classes.push(className);
  return (
    <span
      className={classes.join(' ')}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <span className="ac-shiny-mark__back" />
      <span className="ac-shiny-mark__front" />
    </span>
  );
}
