import { useRovingOptions } from './listbox';
import type { FilterOption } from './model';

// SegmentMenu (plan «Dirección C», «Variante» and «Generación»): one row of 40 px text slots
// led by «Todas», which is chosen while the filter has no value and clears it. The other slots
// toggle their value (any one of them matches, «o»).

export interface SegmentMenuProps {
  label: string;
  options: readonly FilterOption[];
  values: readonly string[];
  onToggle: (id: string) => void;
  onClear: () => void;
  /** «Todas». */
  allLabel: string;
}

export function SegmentMenu({
  label,
  options,
  values,
  onToggle,
  onClear,
  allLabel,
}: SegmentMenuProps) {
  const first = options.findIndex((option) => values.includes(option.id));
  const bind = useRovingOptions([options.length + 1], first + 1);
  return (
    <div
      role="listbox"
      aria-label={label}
      aria-multiselectable="true"
      className="ac-filter-segments"
    >
      <div
        role="option"
        aria-selected={values.length === 0}
        className="ac-filter-slot ac-filter-slot--text"
        onClick={onClear}
        {...bind(0, onClear)}
      >
        {allLabel}
      </div>
      {options.map((option, index) => (
        <div
          key={option.id}
          role="option"
          aria-selected={values.includes(option.id)}
          className="ac-filter-slot ac-filter-slot--text"
          onClick={() => onToggle(option.id)}
          {...bind(index + 1, () => onToggle(option.id))}
        >
          {option.label}
        </div>
      ))}
    </div>
  );
}
