import type { ReactNode } from 'react';

import { Select } from '@/components/controls/Select';
import type { SelectOption, SelectProps } from '@/components/controls/Select';

// SortSelect (spec 7.2.2, 7.7.2, V6; DS:SortSelect): the order of a list of results —
// «Ordenar por» in 12/16 `text-tertiary` to the left of a compact 208 px `Select`. It
// sits in the results bar, between `Count` and `ViewToggle`.
//
// It is `Select` with `inline` and `compact` and the extra class `ac-sort-select`, as
// in the reference; the same delegated controller works it (`src/scripts/select.ts`).
//
// Site differences (C-R3): `options` is required — the list gives its own orders
// (7.7.2), so the three orders of Comercio are not a default — and so is `label`,
// «Ordenar por» / «Sort by» from the dictionary (DP1). The 208 px default lives in
// `sort-select.css`; `width` overrides it through `--ac-select-width`. With fewer than
// two orders there is nothing to choose, and the control is not rendered (V6, C-R5).

export interface SortSelectProps extends Omit<
  SelectProps,
  'label' | 'options' | 'inline' | 'compact'
> {
  /** Inline label, «Ordenar por» / «Sort by» (DP1). */
  label: ReactNode;
  /** The orders of the list; the first one is its default (7.7.1). */
  options: SelectOption[];
  /** Initial order when uncontrolled. Default: the first option. */
  defaultValue?: string;
}

export function SortSelect({ label, options, defaultValue, className, ...rest }: SortSelectProps) {
  if (options.length < 2) return null;

  return (
    <Select
      {...rest}
      label={label}
      options={options}
      defaultValue={defaultValue ?? options[0]?.value}
      inline
      compact
      className={className ? `ac-sort-select ${className}` : 'ac-sort-select'}
    />
  );
}
