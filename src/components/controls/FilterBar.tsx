import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';

// FilterBar (spec 7.2.2, 7.7.4 V6; DS:FilterBar): the row of filters above a result list,
// between the search or the type tabs and the results bar, 16 from each. It draws nothing
// of its own and has no text: it only places the controls its caller passes, each with its
// visible label, in the order of the page.
//
// Two layouts. `grid` (Comercio, §9.5.4): `columns` equal columns, 16 apart, controls
// aligned on their bottom edge. `fill` (Pokédex, Tier list, §8): the selects share the
// width the toggle groups leave, and a toggle group keeps its own width. Below 768 both
// stack one filter per row (`filter-bar.css`).
//
// There is no «Aplicar» or «Limpiar» button: the filters act on change (DS:FilterBar).

export interface FilterBarProps extends HTMLAttributes<HTMLDivElement> {
  /** Columns of the `grid` layout. Without it the stylesheet's 4. */
  columns?: number;
  layout?: 'grid' | 'fill';
  /** The filters: Select, RangeField, TextField, NumberField, ToggleGroup. */
  children?: ReactNode;
}

export function FilterBar({
  columns,
  layout = 'grid',
  className,
  style,
  children,
  ...rest
}: FilterBarProps) {
  const fill = layout === 'fill';

  const classes = ['ac-filter-bar'];
  if (fill) classes.push('ac-filter-bar--fill');
  if (className) classes.push(className);

  // The column count is data, so it travels as a local `--ac-*` property (C-R2, 3.7).
  const ownStyle =
    !fill && columns ? ({ '--ac-filter-cols': String(columns), ...style } as CSSProperties) : style;

  return (
    <div {...rest} className={classes.join(' ')} style={ownStyle}>
      {children}
    </div>
  );
}
