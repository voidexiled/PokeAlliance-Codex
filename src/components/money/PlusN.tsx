import { useId } from 'react';
import type { ReactNode } from 'react';

// PlusN (spec 7.2.5, 7.5.8; DS:PlusN): the «+N» disclosure that lists in a small popover
// the entries past the cap of a line — the contact channels of a listing, the named drops
// of a Pokédex card, the sixth slot of a compact drop strip.
//
// Its surface is the interface, not the game: `bg-tertiary`, a `border-primary` border and
// radius 8. The game tooltip is only for game entities (R2), and this list is not one.
//
// It has no state of its own: the same delegated controller as the tooltip attends it
// (7.5.8), through `data-ac-plusn` on the button and the `popover="manual"` list it points
// at with `aria-controls`. The controller opens it on click, on touch, on hover and on
// focus, closes it with Escape or a press outside, writes `aria-expanded`, and shares TT9
// with the panels: at most one list or unpinned tooltip is open at a time.

/** Where the list opens (7.5.5); the controller translates it, as it does for a panel. */
export type PlusNPlacement = 'up' | 'down' | 'side';
/** Which edge of the button the list lines up with (7.5.5). */
export type PlusNAlign = 'start' | 'end';

export interface PlusNProps {
  /** The hidden entries, one per line of the list. */
  items: ReactNode[];
  /** Accessible name of the button: «2 drops más: Dark Wing, Mythic Fire Orb» (DP1). */
  label: string;
  /** Number after the «+». Without it, how many entries the list has. */
  count?: number;
  /**
   * Square button of the size of the slot it follows, instead of the pill of a chip line
   * (7.2.5): 36 is the sixth slot of a compact drop strip.
   */
  size?: 32 | 36 | 40 | 44 | 72;
  placement?: PlusNPlacement;
  align?: PlusNAlign;
  /** Utilities added by the caller, after the component's own classes (3.8). */
  className?: string;
}

export function PlusN({
  items,
  label,
  count,
  size,
  placement = 'up',
  align = 'start',
  className,
}: PlusNProps) {
  // C-R4: unique per page, and the controller reads it back with `getElementById`.
  const listId = useId();

  // Nothing hidden, nothing to disclose: a «+0» would be a control with no action (C-R5).
  if (items.length === 0) return null;

  const classes = ['ac-plus-n'];
  if (size !== undefined) classes.push('ac-plus-n--square', `ac-plus-n--s${size}`);
  if (className) classes.push(className);

  // The placement goes on the button, which the controller reads before the wrapper. On the
  // wrapper it would also reach, through `game-tooltip.css`, the gap of any game panel that
  // an entry of the list opens.
  return (
    <span className={classes.join(' ')}>
      <button
        type="button"
        className="ac-plus-n__button"
        data-ac-plusn=""
        data-ac-tt-placement={placement}
        data-ac-tt-align={align}
        aria-label={label}
        aria-expanded="false"
        aria-controls={listId}
      >
        {`+${count ?? items.length}`}
      </button>
      <ul id={listId} className="ac-plus-n__popover" popover="manual">
        {items.map((item, index) => (
          // The entries are a fixed sequence built by the caller, so position is identity.
          <li key={index} className="ac-plus-n__item">
            {item}
          </li>
        ))}
      </ul>
    </span>
  );
}
