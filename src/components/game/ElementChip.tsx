import type { ComponentProps } from 'react';

import type { Locale } from '@/i18n/config';

import { NestedEntity } from './NestedEntity';
import { Sprite } from './Sprite';

// ElementChip (spec 7.2.4, 7.5.3, 7.6.4; DS:ElementChip): one element of a Pokémon with its
// game icon — a chip in a card, a link in a fact value or the static cell of the Lista view.
// The interactive forms are a NestedEntity that opens the element's tooltip (240 wide, icon
// of 32, rows «Stone:» and «Fragment:»); their look comes from NestedEntity, so this file
// only adds the `ac-element-chip` hook and the icon and name of the trigger.
//
// The icon-only round chip of the compact Pokédex card is not a prop: the container query of
// element-chip.css hides the name and shrinks the chip to 24 (spec 7.6.4). The DOM is the
// same in both anatomies, and an element without an icon keeps its text.
//
// R2 (spec 8.0.5): a mention only opens a tooltip when the entity has at least one row, so an
// element whose registry entry has neither Stone nor Fragment is a plain chip and not a
// trigger. content/elementos.json fills those two fields (D-011); the component never
// invents them, and the tooltip itself is built by the tip constructors (spec 7.5.3).

type SpriteProps = ComponentProps<typeof Sprite>;
type NestedEntityProps = ComponentProps<typeof NestedEntity>;

/** An element as the page adapter hands it over: the registry entry plus its built tooltip. */
export interface ElementChipEntry {
  id: string;
  /** Localised name of content/elementos.json; never written in the code (spec 8.0.5). */
  name: string;
  /** Resolved icon sprite, or null while the registry has no key for it. */
  icon: SpriteProps | null;
  /** `TipData` of spec 7.5.2, as the tip constructor of the element registry builds it. */
  tip: NestedEntityProps['tip'];
}

interface ElementChipProps {
  element: ElementChipEntry;
  /**
   * `chip` in the cards of the Pokédex, `link` in the «Elemento» value of a card or a listing,
   * `label` in the cell of the Lista view, which never opens a tooltip.
   */
  variant?: 'chip' | 'link' | 'label';
  /** false keeps the static look without the tooltip. */
  interactive?: boolean;
  placement?: NestedEntityProps['placement'];
  align?: NestedEntityProps['align'];
  /** Destination when the element has a page; without it the trigger is a button (spec 7.5.7). */
  href?: string;
  /** Picks the format of the figures inside the panel; it never picks a text (C-R3). */
  locale: Locale;
  /** Strip of the panel, `ui.pinHint`: «Mantén Shift para fijar» / «Hold Shift to pin». */
  hint: string;
  className?: string;
}

export function ElementChip({
  element,
  variant = 'chip',
  interactive = true,
  placement = 'down',
  align = 'auto',
  href,
  locale,
  hint,
  className,
}: ElementChipProps) {
  // Element icons are illustrations of 100 px: the adapter resolves them with smooth scaling
  // and element-chip.css draws them at 16, the size of every chip sprite.
  const icon = element.icon ? <Sprite {...element.icon} className="ac-element-chip__icon" /> : null;
  const name = <span className="ac-element-chip__name">{element.name}</span>;
  const classes = (...parts: (string | false | undefined)[]) =>
    ['ac-element-chip', ...parts.filter(Boolean), className].filter(Boolean).join(' ');

  if (variant === 'label' || !interactive || element.tip.rows.length === 0) {
    // «Texto sin enlace» (R2): the Lista cell, and any element the registry cannot describe.
    if (variant === 'chip')
      return (
        <span className={classes('ac-element-chip--chip', !icon && 'ac-element-chip--text')}>
          {icon}
          {name}
        </span>
      );
    return (
      <span className={classes('ac-element-chip--label')}>
        {icon}
        {name}
      </span>
    );
  }

  return (
    <NestedEntity
      tip={element.tip}
      variant={variant === 'link' ? 'link' : icon ? 'chip' : 'chip-text'}
      placement={placement}
      align={align}
      href={href}
      locale={locale}
      hint={hint}
      className={classes()}
    >
      {icon}
      {name}
    </NestedEntity>
  );
}
