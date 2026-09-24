import { useId } from 'react';

import { Sprite } from '@/components/game/Sprite';
import { elementSprite } from '@/lib/pickers/sprites';

import { useRovingOptions } from './listbox';
import { isCapped, menuRows } from './menu-model';
import type { FilterOption } from './model';

// ElementGridMenu (plan «Dirección C», «Tipo» and «Tipo de moveset»): the 6 × 3 grid of 40 px
// square slots, each only the element's sprite; its name is a small game tooltip on hover or
// focus, and its accessible name. A chosen slot has the amber ring. With a cap (Tipo: 2) and
// the cap reached, every other slot dims with `aria-disabled` and its tooltip says why
// («Máx. 2: quita uno.»). On a phone sheet the grid stretches to the sheet (fluid columns).

export interface ElementGridMenuProps {
  /** The menu's name, the listbox's accessible name. */
  label: string;
  options: readonly FilterOption[];
  values: readonly string[];
  onToggle: (id: string) => void;
  max?: number;
  /** «Máx. {max}: quita uno.», already filled. */
  maxHint: string;
}

export function ElementGridMenu({
  label,
  options,
  values,
  onToggle,
  max,
  maxHint,
}: ElementGridMenuProps) {
  const baseId = useId();
  const capped = isCapped(values, max);
  const first = options.findIndex((option) => values.includes(option.id));
  const bind = useRovingOptions(menuRows('elements', options.length), first);
  return (
    <div
      role="listbox"
      aria-label={label}
      aria-multiselectable="true"
      className="ac-filter-grid ac-filter-grid--elements"
    >
      {options.map((option, index) => {
        const selected = values.includes(option.id);
        const dim = capped && !selected;
        const sprite = elementSprite(option.id, 24);
        const hintId = `${baseId}-${index}`;
        return (
          <div
            key={option.id}
            role="option"
            aria-selected={selected}
            aria-disabled={dim || undefined}
            aria-label={option.label}
            aria-describedby={dim ? hintId : undefined}
            className="ac-filter-slot"
            onClick={() => {
              if (!dim) onToggle(option.id);
            }}
            {...bind(index, () => {
              if (!dim) onToggle(option.id);
            })}
          >
            {sprite ? (
              <Sprite {...sprite} alt="" className="ac-filter-slot__icon" />
            ) : (
              <span className="ac-filter-slot__text" aria-hidden="true">
                {option.label.slice(0, 2)}
              </span>
            )}
            <span className="ac-filter-tip" aria-hidden="true">
              {option.label}
              {dim ? (
                <span id={hintId} className="ac-filter-tip__hint">
                  {maxHint}
                </span>
              ) : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}
