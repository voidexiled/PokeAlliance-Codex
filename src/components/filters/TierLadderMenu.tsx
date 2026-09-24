import { useId } from 'react';

import { useRovingOptions } from './listbox';
import { tierLadderRows } from './menu-model';
import type { FilterOption } from './model';
import { TierTip } from './TierTip';

// TierLadderMenu (plan «Dirección C», «Tier»): one ladder, best to worst — the named tiers
// (Mythic, Legendary, Ultra Rare, Super Rare) on the first row and T1 … T7 on the second, the
// row's slots sharing its width. Plain text slots, no chip colours; the chosen ones have the
// amber ring. Each tier has its tooltip in the game style, «Max brokes: —» until
// content/tiers.json has the number. The options are the visible tiers only: the page leaves
// a hidden one (ULTIMATE for now) out before it gets here.

export interface TierLadderMenuProps {
  label: string;
  /** The visible tiers present, best first, each with its «Max brokes». */
  options: readonly FilterOption[];
  values: readonly string[];
  onToggle: (id: string) => void;
  /** «Max brokes». */
  maxBrokesLabel: string;
}

export function TierLadderMenu({
  label,
  options,
  values,
  onToggle,
  maxBrokesLabel,
}: TierLadderMenuProps) {
  const baseId = useId();
  const rows = tierLadderRows(options);
  const flat = rows.flat();
  const first = flat.findIndex((option) => values.includes(option.id));
  const bind = useRovingOptions(
    rows.map((row) => row.length),
    first,
  );
  let index = 0;
  return (
    <div role="listbox" aria-label={label} aria-multiselectable="true" className="ac-filter-ladder">
      {rows.map((row, rowIndex) => (
        <div
          key={rowIndex}
          role="presentation"
          className="ac-filter-ladder__row"
          style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}
        >
          {row.map((option) => {
            const position = index;
            index += 1;
            const selected = values.includes(option.id);
            const tipId = `${baseId}-${position}`;
            return (
              <div
                key={option.id}
                role="option"
                aria-selected={selected}
                aria-describedby={tipId}
                className="ac-filter-slot ac-filter-slot--text"
                onClick={() => onToggle(option.id)}
                {...bind(position, () => onToggle(option.id))}
              >
                {option.label}
                <TierTip
                  id={tipId}
                  name={option.label}
                  maxBrokes={option.maxBrokes ?? null}
                  label={maxBrokesLabel}
                  placement="down"
                />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
