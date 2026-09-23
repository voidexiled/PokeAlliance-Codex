import type { HTMLAttributes, ReactNode } from 'react';

import { CardHeadingContext, type CardHeadingLevel } from '@/components/cards/Card';
import type { CardFamily } from '@/lib/cards/layout';

export type { CardFamily } from '@/lib/cards/layout';

// CardGrid (spec 7.2.6, 7.6.1, 7.6.5; CARD_GRID_SYSTEM §4, §12; DS:CardGrid, DS:guias/30): the
// fixed-anatomy grid. One card family per grid, rows stretched, and columns that come from the
// width of the grid's own container, never the window, so a grid placed in a narrower column or
// on a phone picks its own column count and gap (card-grid.css). Markup and classes are the
// reference's (`bundle.js` CardGrid): the outer `div.ac-card-grid[data-family]` is the size
// container and the inner `div.ac-card-grid__grid` is the grid.
//
// Site differences (C-R3):
//   - No `columns` and no `gap` (DP6): the columns and the gap always come from the container.
//   - `family` is required: whoever composes the grid always knows it (DS:CardGrid «Qué aporta
//     quien lo usa»).
//   - `headingLevel` (7.6.2): the level of the title of every card in the grid, one more than the
//     heading right above the list, handed to the cards of an island through `CardHeadingContext`.
//     Without it the grid keeps the level of an enclosing `CardGroup`, or 3.
//
// The children are the cards of one type, in the order of the chosen sort (row-major), all built
// from one layout (`src/lib/cards/layout.ts`), so they span the same tracks. Nothing here orders,
// packs or places them (7.6.5): an empty cell at the end of the last row stays empty.

export interface CardGridProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Column rule and phone gap of the family (7.6.1). */
  family: CardFamily;
  /** Level of the card titles: 2 under the h1, 3 under an h2, 4 under an h3 (7.6.2). */
  headingLevel?: CardHeadingLevel;
  /** Cards of one type, in sort order. */
  children?: ReactNode;
}

export function CardGrid({ family, headingLevel, className, children, ...rest }: CardGridProps) {
  const grid = <div className="ac-card-grid__grid">{children}</div>;
  return (
    <div
      {...rest}
      className={className ? `ac-card-grid ${className}` : 'ac-card-grid'}
      data-family={family}
    >
      {headingLevel === undefined ? (
        grid
      ) : (
        <CardHeadingContext.Provider value={headingLevel}>{grid}</CardHeadingContext.Provider>
      )}
    </div>
  );
}
