import type { ReactNode } from 'react';

import '@/styles/components/index-links.css';

import { NestedEntity } from '@/components/game/NestedEntity';
import { Sprite } from '@/components/game/Sprite';
import type { SpriteProps } from '@/components/game/Sprite';
import type { Locale } from '@/i18n/config';
import type { TipData } from '@/lib/game/tips';

// IndexLinks (spec 7.2.8, 8.0.2 template D, 8.4.1, 8.6; DS:IndexPanel): the grid of links
// of `IndexPanel` without its title strip, for the index of a menu group — Sistemas,
// Actividades, Herramientas — and for the groups of Buscar that have no card family (E5).
// The page title is the heading, so the grid carries none of its own.
//
// Markup of the reference (`bundle.js` IndexPanel, `IndexLink`): a `ul` of `li`, each one
// a 40 px link with the 32 px icon cell and a label of at most two lines. The cell is always
// there, with or without a sprite, so every label starts at one x (DS:IndexPanel «No
// hacer»). No description, state or count goes under a link (8.0.2 D, TI-09).
//
// A link whose entity has tooltip rows — a system (8.4.1) — is a `NestedEntity` with the
// link's own shape (`plain`): the panel opens above it, anchored to its left edge, as the
// reference's `up-left`, and Shift pins it and Escape closes it like every other panel.
// A link with no rows is a plain `<a>` (R2).
//
// TSX and not Astro because the Buscar island paints it too (C-R1, 8.6); from a page it
// renders on the server with no client directive and ships no JavaScript. Columns and row
// heights are index-links.css.

/** One entry of the grid, already resolved by the page (DP1, DP2, DP3). */
export interface IndexLinkEntry {
  /** Stable id of the entry (the registry `id`): the React key. */
  id: string;
  /** Visible name of the page. */
  label: string;
  /** Language of a label that exists only in the other locale (8.0.5, T22, WA4). */
  labelLang?: Locale;
  /** Route of the page, with its locale segment and trailing slash (8.0.1). */
  href: string;
  /** Sprite at 1x from the adapter (`spriteOrNull`); `null` leaves the 32 cell empty. */
  sprite: SpriteProps | null;
  /** Panel of the entity (`systemTip`, 7.5.3), only when it has at least one row (R2). */
  tip?: TipData;
}

export interface IndexLinksProps {
  links: IndexLinkEntry[];
  /** Picks the format of the amounts inside a panel (C-R3). */
  locale: Locale;
  /**
   * Strip of the panels, `ui.pinHint`. Required as soon as one link carries a `tip`:
   * every panel a link opens can be pinned with Shift and shows the strip (7.5.2).
   */
  hint?: string;
  /** Utilities added by the caller on the root, after the component's class (3.8). */
  className?: string;
}

/** Icon cell and label: the body of every link, with or without a panel. */
function linkBody(entry: IndexLinkEntry): ReactNode {
  return (
    <>
      <span className="ac-index-links__icon" aria-hidden="true">
        {entry.sprite ? <Sprite {...entry.sprite} cell /> : null}
      </span>
      <span className="ac-index-links__label" lang={entry.labelLang}>
        {entry.label}
      </span>
    </>
  );
}

export function IndexLinks({ links, locale, hint, className }: IndexLinksProps) {
  return (
    <div className={className ? `ac-index-links ${className}` : 'ac-index-links'}>
      <ul className="ac-index-links__list">
        {links.map((entry) => {
          if (entry.tip === undefined) {
            return (
              <li key={entry.id} className="ac-index-links__item">
                <a href={entry.href} className="ac-index-links__link">
                  {linkBody(entry)}
                </a>
              </li>
            );
          }
          if (hint === undefined) {
            throw new Error(
              `IndexLinks: el enlace «${entry.id}» abre un panel y falta \`hint\` (ui.pinHint).`,
            );
          }
          return (
            <li key={entry.id} className="ac-index-links__item">
              <NestedEntity
                tip={entry.tip}
                href={entry.href}
                variant="plain"
                placement="up"
                align="start"
                block
                locale={locale}
                hint={hint}
                className="ac-index-links__link"
                wrapperClassName="ac-index-links__tip"
              >
                {linkBody(entry)}
              </NestedEntity>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
