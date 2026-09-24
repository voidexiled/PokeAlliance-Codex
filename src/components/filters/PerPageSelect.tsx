import '@/styles/components/filter-toolbar.css';

import { Select } from '@/components/controls/Select';
import type { PerPageSpec } from '@/lib/lists/state';

// PerPageSelect (the plan's «Por página»): the rows per page of the active view, one of the
// options its `PerPageSpec` gives (Slots 48/96/144, Cards 12/24/48, Lista 25/50/100). The list
// controller keeps it in `?porPagina=` (U7); a view without a spec draws nothing.

export interface PerPageSelectProps {
  /** «Por página» (`ui.filterBar.perPage`). */
  label: string;
  spec: PerPageSpec | undefined;
  /** The size shown now: the chosen one or the view's default. */
  value: number;
  /** The new size; `null` for the view's default. */
  onChange: (size: number | null) => void;
}

export function PerPageSelect({ label, spec, value, onChange }: PerPageSelectProps) {
  if (spec === undefined || spec.options.length < 2) return null;
  return (
    <Select
      label={label}
      inline
      compact
      width={72}
      className="ac-per-page"
      options={spec.options.map((size) => ({ value: String(size), label: String(size) }))}
      value={String(value)}
      onChange={(next) => {
        const size = Number(next);
        onChange(size === spec.default ? null : size);
      }}
    />
  );
}
