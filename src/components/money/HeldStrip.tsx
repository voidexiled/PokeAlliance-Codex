import { EquipmentStrip } from './EquipmentStrip';
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

/**
 * Since 16.4.5 the held items are drawn by `EquipmentStrip`: 32 px slots without names, each with
 * its tooltip and its tier as the mini badge. `columns` and `shinyLabel` are kept for old callers.
 */
export function HeldStrip({ items, labels, locale, hint, orLabel, className }: HeldStripProps) {
  const label = fill(labels.heldItems, { n: formatInteger(items.length, locale) });
  return (
    <div className={className ? `ac-held-strip ${className}` : 'ac-held-strip'}>
      <p className="ac-held-strip__label">{label}</p>
      <EquipmentStrip items={items} label={label} locale={locale} hint={hint} orLabel={orLabel} />
    </div>
  );
}
