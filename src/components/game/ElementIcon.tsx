import '@/styles/components/element-icon.css';

import { useId } from 'react';

import type { ElementChipEntry } from '@/components/game/ElementChip';
import type { NestedEntityPlacement } from '@/components/game/NestedEntity';
import { Sprite } from '@/components/game/Sprite';

// ElementIcon (plan «Cards» and «Filtros», boards Pokedex-Cards and Direccion-C): an element
// drawn as its icon alone — the 100 px illustration of `ui/elementos/<id>`, smooth at 24 —
// whose name is a small game tooltip on hover and keyboard focus. It is the «Tipo» and
// «Moveset» value of a Pokédex card and of a Lista row.
//
// The name panel is a `.ac-game-tooltip` popover of the delegated controller of 7.5.4
// (src/scripts/game-tooltip.ts), like every panel of the site, so it lives in the top layer,
// out of card and table overflow, and closes on Escape. The trigger's accessible name is the
// element's name, so the panel repeats it for sighted users only and is not a description.
// An element whose registry has no icon yet falls back to its name as text.

export interface ElementIconProps {
  /** The element as the page adapter hands it over (`ElementChipEntry`). */
  element: Pick<ElementChipEntry, 'id' | 'name' | 'icon'>;
  /** Page of the element; without it the trigger is a button (7.5.7). */
  href?: string;
  /** Size of the icon: 24 in the card facts and the Lista, as the boards draw it. */
  size?: number;
  /** Where the name opens (7.5.5). Default `above-center`. */
  placement?: NestedEntityPlacement;
  /** `false`: a static icon named by `aria-label`, with no tooltip. */
  interactive?: boolean;
  className?: string;
}

export function ElementIcon({
  element,
  href,
  size = 24,
  placement = 'above-center',
  interactive = true,
  className,
}: ElementIconProps) {
  const tipId = useId();
  const face = element.icon ? (
    <Sprite
      {...element.icon}
      smooth
      width={size}
      height={size}
      alt=""
      className="ac-element-icon__img"
    />
  ) : (
    <span className="ac-element-icon__text">{element.name}</span>
  );
  const classes = ['ac-element-icon'];
  if (!element.icon) classes.push('ac-element-icon--text');
  if (className) classes.push(className);

  // Without an icon the name is already written: no tooltip to open.
  if (!interactive || !element.icon) {
    return element.icon ? (
      <span className={classes.join(' ')} role="img" aria-label={element.name}>
        {face}
      </span>
    ) : (
      <span className={classes.join(' ')}>{face}</span>
    );
  }

  const trigger = ['ac-nested-entity__trigger', ...classes].join(' ');
  return (
    <span
      className="ac-nested-entity"
      data-ac-tt=""
      data-ac-tt-placement={placement}
      data-ac-tt-align="auto"
    >
      {href === undefined ? (
        <button type="button" className={trigger} aria-label={element.name}>
          {face}
        </button>
      ) : (
        <a href={href} className={trigger} aria-label={element.name}>
          {face}
        </a>
      )}
      <span
        id={tipId}
        role="tooltip"
        popover="manual"
        className="ac-game-tooltip ac-game-tooltip--name ac-game-tooltip--animate"
      >
        {element.name}
      </span>
    </span>
  );
}
