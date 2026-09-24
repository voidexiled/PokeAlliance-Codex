import { Children, isValidElement, useId } from 'react';
import type { HTMLAttributes, Key, ReactNode } from 'react';

// SlotsPanel (spec 7.2.6, 7.7.4 V3; DS:SlotsPanel): the panel of the Slots view. A
// `bg-secondary` panel of radius 12 with the slots of the entities in a list that wraps,
// or split in groups: by asset type with an 88 px label column and a 1 px line between
// groups (`side`, Comercio) or by generation with a 12/16 700 heading over each group
// (`stacked`, Pokédex). Drops use the single list.
//
// Markup of the reference (`bundle.js` SlotsPanel): the single list is a `ul` named by
// `label`; the grouped panel is a `div role="group"` named by `label`, with one
// `ac-slots-panel__group` per group whose `p` names its `ul`. Every slot sits in an `li`.
//
// The slots are `EntitySlot` elements, the only thing in this view that opens the in-game
// tooltip; the panel itself opens nothing and never writes a name next to a slot (the name
// is the slot's accessible name and the title of its panel). No empty slot is added to
// fill a line.
//
// Inventory (plan «Slots»): with `inventory` the slots are a grid that ends flush, as the
// inventory of the game — 12 columns of 72 on a desktop (board Main), 8 and then 6 as the
// panel narrows, and 6 of 52 on a phone (board Pokedex-movil), every count a divisor of the
// 48 / 96 / 144 per page, so a full page is always full rows. The panel is the container the
// columns are measured against, so the single list gets a `div` around its `ul` there.
//
// Site addition (7.7.3 H7): a slot that has to carry the anchor of its entity goes inside
// `SlotsPanelItem`, which is the `li` itself with its `id`; any other child gets an `li` of
// its own. The list controller then finds `#item-{id}` and focuses the slot inside it.

export interface SlotsGroup {
  /** «Pokémon», «Generación 1»: the name of the group's list. */
  label: ReactNode;
  /** The slots of the group, in the order of the list (V5). */
  children?: ReactNode;
  key?: Key;
}

export interface SlotsPanelProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  /** Accessible name of the list or of the grouped panel («Drops», «Anuncios»). */
  label: string;
  /** Groups, in the order the list fixes; without them the children form one list. */
  groups?: SlotsGroup[];
  /** `side` (Comercio, the default) or `stacked` (Pokédex). */
  layout?: 'side' | 'stacked';
  /**
   * The inventory grid of the Pokédex Slots view (plan «Slots»): 12 / 8 / 6 columns that end
   * flush, for slots of 72. Without it the slots wrap as before.
   */
  inventory?: boolean;
  /** The slots of the single list. */
  children?: ReactNode;
}

export interface SlotsPanelItemProps {
  /** Anchor of the entity in the Slots view, `item-{id}` (H7). */
  id?: string;
  /** One slot. */
  children: ReactNode;
}

/** The `li` of one slot, with the anchor of its entity (H7). */
export function SlotsPanelItem({ id, children }: SlotsPanelItemProps) {
  return (
    <li id={id} className="ac-slots-panel__li">
      {children}
    </li>
  );
}

/** Every child in an `li`: a `SlotsPanelItem` already is one. */
function items(children: ReactNode): ReactNode[] {
  return Children.toArray(children).map((child, index) => {
    if (isValidElement(child) && child.type === SlotsPanelItem) return child;
    const key = isValidElement(child) && child.key !== null ? child.key : index;
    return (
      <li key={key} className="ac-slots-panel__li">
        {child}
      </li>
    );
  });
}

export function SlotsPanel({
  label,
  groups,
  layout = 'side',
  inventory = false,
  children,
  className,
  ...rest
}: SlotsPanelProps) {
  // C-R4: the ids that tie each group label to its list.
  const baseId = useId();

  if (inventory && (!groups || groups.length === 0)) {
    const classes = ['ac-slots-panel', 'ac-slots-panel--inventory'];
    if (className) classes.push(className);
    return (
      <div {...rest} className={classes.join(' ')}>
        <ul aria-label={label} className="ac-slots-panel__slots">
          {items(children)}
        </ul>
      </div>
    );
  }

  if (!groups || groups.length === 0) {
    const classes = ['ac-slots-panel', 'ac-slots-panel__list'];
    if (className) classes.push(className);
    return (
      <ul {...rest} aria-label={label} className={classes.join(' ')}>
        {items(children)}
      </ul>
    );
  }

  const classes = [
    'ac-slots-panel',
    layout === 'stacked' ? 'ac-slots-panel--stacked' : 'ac-slots-panel--side',
  ];
  if (inventory) classes.push('ac-slots-panel--inventory');
  if (className) classes.push(className);

  return (
    <div {...rest} role="group" aria-label={label} className={classes.join(' ')}>
      {groups.map((group, index) => {
        const id = `${baseId}-g${index}`;
        return (
          <div key={group.key ?? index} className="ac-slots-panel__group">
            <p id={id} className="ac-slots-panel__label">
              {group.label}
            </p>
            <ul aria-labelledby={id} className="ac-slots-panel__slots">
              {items(group.children)}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
