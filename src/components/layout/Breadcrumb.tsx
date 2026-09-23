import { Fragment } from 'react';
import type { ReactNode } from 'react';

import { ChevronRightGlyph } from '@/components/icons/Glyph';

// Breadcrumb (spec 8.0.4, DS:Breadcrumb): the trail from the sidebar group down to the
// current page. TSX and not Astro because the Guild island repaints the current crumb
// (C-R1, spec 10.5); from a page it renders on the server with no client directive.
//
// Every visible text comes from the composer (DP1), `ariaLabel` included: the design
// system's Spanish default is not used on the site.

export interface BreadcrumbItem {
  label: ReactNode;
  /**
   * Index of the group. A group with no index page — «Pokémon», «Comunidad» — is a crumb
   * with no href, never `href="#"` (spec 8.0.4). The last item is the current page and
   * is never a link.
   */
  href?: string;
  /** 'en' for an English label inside a Spanish page (spec 8.0.5, T22). */
  lang?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  /** Name of the nav landmark: `shell.breadcrumb` of the page locale. */
  ariaLabel: string;
  className?: string;
}

/**
 * The chevron between crumbs, 14 px and stroke 2 (C-R7, DS:Breadcrumb). It is the
 * one-glyph export and not `<Glyph name>`: the Guild island repaints this component
 * (C-R1, spec 10.5), and that way it bundles this one shape and not all twelve.
 */
function Separator() {
  return (
    <li role="presentation" aria-hidden="true" className="ac-breadcrumb__sep">
      <ChevronRightGlyph size={14} />
    </li>
  );
}

function Crumb({ item, last }: { item: BreadcrumbItem; last: boolean }) {
  if (last) {
    return (
      <span className="ac-breadcrumb__current" aria-current="page" lang={item.lang}>
        {item.label}
      </span>
    );
  }
  if (item.href) {
    return (
      <a className="ac-breadcrumb__link" href={item.href} lang={item.lang}>
        {item.label}
      </a>
    );
  }
  return <span lang={item.lang}>{item.label}</span>;
}

export function Breadcrumb({ items, ariaLabel, className }: BreadcrumbProps) {
  return (
    <nav
      className={className ? `ac-breadcrumb ${className}` : 'ac-breadcrumb'}
      aria-label={ariaLabel}
    >
      <ol className="ac-breadcrumb__list">
        {items.map((item, index) => (
          // The trail is a fixed list built by the page, so its position is its identity.
          <Fragment key={index}>
            {index > 0 ? <Separator /> : null}
            <li className="ac-breadcrumb__item">
              <Crumb item={item} last={index === items.length - 1} />
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}
