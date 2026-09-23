import { useId } from 'react';

import { FeaturedCard, type FeaturedCardProps } from '@/components/home/FeaturedCard';

// FeaturedSection (spec 7.2.7, 8.1 step 3, 8.6 steps 3 and 6, 8.12 step 4; DS:FeaturedCard;
// CARD_GRID_SYSTEM §6.4): the «Destacados» block — its h2 and one `FeaturedCard` per entry of
// content/destacados.json (1 to 4), in the order of the registry. The home draws it under the
// search trigger, the Buscar page without a query and with no results, and the 404 under its
// search trigger; the pinned group of the menu links the same entries.
//
// Markup and classes of the reference (`bundle.js` FeaturedSection, C-R2): a `section` named by
// its h2 (`aria-labelledby`), and a `ul` of `li` with one card each. The id of the h2 is the id
// of the section plus `-t`, as in the reference; with no `id`, `useId` gives one that is unique
// in the page (C-R4).
//
// Data, not nodes (DP1, DP2). Whoever composes the block reads the registry and passes, for each
// entry, the name of the page in its language, the route with its locale segment and the sprite
// as the adapter resolves it; the title is `Destacados` / `Featured` from the dictionary of the
// page. With no entry there is no block at all (8.1 «Estados»): no heading over an empty grid.
//
// Columns (4, 2 or 1) come from the width of the section itself, not from the window: see
// featured.css, which FeaturedCard imports. TSX and not Astro because the Buscar island paints it
// too (C-R1); from a page it renders on the server and ships no JavaScript.

/** One entry of «Destacados», already resolved by the composer (DP1, DP2). */
export type FeaturedEntry = Pick<FeaturedCardProps, 'label' | 'href' | 'sprite'>;

export interface FeaturedSectionProps {
  /** The h2: «Destacados» / «Featured». */
  title: string;
  /** The entries, 1 to 4, in the order of the registry. Each route is unique: it is the key. */
  items: readonly FeaturedEntry[];
  /** Id of the section; its h2 takes this id plus `-t`. */
  id?: string;
  /** Utilities added by the caller on the section, after the component's class (3.8). */
  className?: string;
}

export function FeaturedSection({ title, items, id, className }: FeaturedSectionProps) {
  const autoId = useId();
  if (items.length === 0) return null;

  const titleId = `${id ?? autoId}-t`;
  return (
    <section
      id={id}
      className={className ? `ac-featured-section ${className}` : 'ac-featured-section'}
      aria-labelledby={titleId}
    >
      <h2 id={titleId} className="ac-featured-section__title">
        {title}
      </h2>
      <ul className="ac-featured-section__grid">
        {items.map((item) => (
          <li key={item.href} className="ac-featured-section__item">
            <FeaturedCard label={item.label} href={item.href} sprite={item.sprite} />
          </li>
        ))}
      </ul>
    </section>
  );
}
