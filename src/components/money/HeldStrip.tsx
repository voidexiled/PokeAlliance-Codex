import type { CSSProperties, ReactNode } from 'react';

import { NestedEntity } from '@/components/game/NestedEntity';
import { Sprite } from '@/components/game/Sprite';
import type { SpriteProps } from '@/components/game/Sprite';
import type { Locale } from '@/i18n/config';
import { fill } from '@/i18n/messages/types';
import { formatInteger } from '@/lib/format/numbers';
import type { TipData } from '@/lib/game/tips';

// HeldStrip (spec 7.2.5, 7.5.5, 9.5.8; DS:HeldStrip): the «Held Items: N» zone of a Pokémon
// listing — the held items two per line, each a 32 slot and its name with the tier
// («X-Attack T5»), each opening its own game tooltip, 300 wide (`itemTip` of a held,
// 7.5.3), above the strip.
//
// Markup of the reference (`bundle.js` HeldStrip): the label line, then a `ul` of items
// whose trigger is a `NestedEntity` with `variant="plain"` and the `__link` shape, so the
// slot, the name and the hover are this file's and the panel and every behaviour of 7.5.4
// come from there. 7.5.5 places the panels `up`, the first column lined up with its left
// edge and the second with its right one (`start` / `end`): a card never covers its own
// held items with them.
//
// Only the held items the Pokémon carries are drawn; no empty slot pads the strip
// (DS:HeldStrip §No hacer). With none, the zone is the line «Held Items: 0». A held item
// the registry knows without a sprite shows the dark missing mark of half its slot (R11).
// Its panel, when it has nothing to show below its title, is no tooltip (R2): the item
// is then a plain link to its page, or plain text without one.
//
// Items have no page of their own in this cut (8.0.5, §15), so `href` is optional: without
// it the trigger is a `<button>` (7.5.7). «Held Items» is a game term (13.4); the line
// comes from `ui.money.heldItems` of the page's locale (DP1).

/** One held item of a Pokémon (spec 7.2.5). */
export interface HeldStripItem {
  /** «X-Attack». */
  name: string;
  /** «T5», already written by the caller. */
  tier?: string;
  /** Sprite of the held item as the adapter resolves it (DP2); `null`: the missing mark. */
  sprite: SpriteProps | null;
  /** Its panel, built by `itemTip` (7.5.3): 300 wide. */
  tip: TipData;
  /** Page of the item. Without it the trigger is a button (7.5.7). */
  href?: string;
}

/** The line over the held items, `ui.money` of the dictionary. */
export interface HeldStripLabels {
  /** «Held Items: {n}». */
  heldItems: string;
}

export interface HeldStripProps {
  /** The 0 to 6 held items of the Pokémon, in its order. */
  items: readonly HeldStripItem[];
  labels: HeldStripLabels;
  /** Picks the grouping of the count and the format of the amounts in the panels (C-R3). */
  locale: Locale;
  /** Strip of the panels, `ui.pinHint`: «Mantén Shift para fijar» / «Hold Shift to pin». */
  hint: string;
  /** Accessible name of the Shiny mark in a panel head. «Shiny» is a game term (13.4). */
  shinyLabel?: string;
  /** The word between two price options in a panel, `ui.or`: «o» / «or» (13.3). */
  orLabel?: string;
  /** Items per line. Default 2. */
  columns?: number;
  /** Utilities added by the caller, after the component's own classes (3.8). */
  className?: string;
}

/** R2: a panel with nothing to show below its title is not a tooltip. */
function hasContent(tip: TipData): boolean {
  return tip.rows.length > 0 || Boolean(tip.sections?.length) || Boolean(tip.market?.length);
}

const COLUMNS = 2;

export function HeldStrip({
  items,
  labels,
  locale,
  hint,
  shinyLabel,
  orLabel,
  columns = COLUMNS,
  className,
}: HeldStripProps) {
  const cols = Math.max(1, Math.trunc(columns));
  // The column count is data of the call, so it travels as a local `--ac-*` property
  // (C-R2, 3.7); the stylesheet's own 2 needs none.
  const listStyle =
    cols === COLUMNS ? undefined : ({ '--ac-held-strip-columns': String(cols) } as CSSProperties);

  return (
    <div className={className ? `ac-held-strip ${className}` : 'ac-held-strip'}>
      <p className="ac-held-strip__label">
        {fill(labels.heldItems, { n: formatInteger(items.length, locale) })}
      </p>
      {items.length > 0 ? (
        <ul className="ac-held-strip__list" style={listStyle}>
          {items.map((item, index) => {
            const name = item.tier ? `${item.name} ${item.tier}` : item.name;
            const content: ReactNode = (
              <>
                <span className="ac-held-strip__slot" aria-hidden="true">
                  {item.sprite ? (
                    <Sprite {...item.sprite} alt="" />
                  ) : (
                    <span className="ac-held-strip__missing" />
                  )}
                </span>
                <span className="ac-held-strip__name">
                  {item.name}
                  {item.tier ? (
                    <>
                      {' '}
                      <span className="ac-held-strip__tier">{item.tier}</span>
                    </>
                  ) : null}
                </span>
              </>
            );

            let trigger: ReactNode;
            if (hasContent(item.tip)) {
              trigger = (
                <NestedEntity
                  tip={item.tip}
                  href={item.href}
                  variant="plain"
                  block
                  placement="up"
                  // 7.5.5: the first half of the columns opens from its left edge, the rest
                  // from its right one.
                  align={index % cols < cols / 2 ? 'start' : 'end'}
                  ariaLabel={name}
                  locale={locale}
                  hint={hint}
                  shinyLabel={shinyLabel}
                  orLabel={orLabel}
                  className="ac-held-strip__link"
                >
                  {content}
                </NestedEntity>
              );
            } else if (item.href !== undefined) {
              trigger = (
                <a className="ac-held-strip__link" href={item.href} aria-label={name}>
                  {content}
                </a>
              );
            } else {
              trigger = <span className="ac-held-strip__link">{content}</span>;
            }

            return (
              // The held items are the Pokémon's fixed sequence: position is identity.
              <li key={index} className="ac-held-strip__item">
                {trigger}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
