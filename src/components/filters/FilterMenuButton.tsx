import { Suspense, lazy, useCallback, useId, useRef, useState } from 'react';

import { Glyph } from '@/components/icons/Glyph';

import { joinValues } from './model';
import type { FilterDef } from './model';
import type { FilterText } from './text';

// FilterMenuButton (plan «Dirección C»): a 40 px button with the filter's name, a small count
// while it has values («Tipo 2») and a chevron; open, it takes the raised surface and the
// chevron points up. It opens its menu panel (./FilterMenuPanel.tsx), which is a chunk of its
// own asked for on the first open: until someone opens a menu the page carries only the
// buttons. Closing the menu, by Esc, the × of the phone sheet or a click outside, brings the
// focus back here.

const FilterMenuPanel = lazy(() => import('./FilterMenuPanel'));

export interface FilterMenuButtonProps {
  filter: FilterDef;
  /** The chosen ids, in their order. */
  values: readonly string[];
  /** The new comma-joined value, `null` for none. */
  onChange: (value: string | null) => void;
  text: FilterText;
  /** The list's count («37 variantes»), the footer of the phone sheet. */
  count?: string;
}

export function FilterMenuButton({ filter, values, onChange, text, count }: FilterMenuButtonProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  const chosen = values.length;
  const countLabel = chosen > 0 && text.chosen ? text.chosen.replace('{n}', String(chosen)) : '';
  return (
    <div
      className="ac-filter-menu-anchor"
      onBlur={(event) => {
        // Tabbing past the menu closes it; a click on its own text (no new focus) does not.
        const next = event.relatedTarget;
        if (open && next instanceof Node && !event.currentTarget.contains(next)) close(false);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className="ac-filter-button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        data-active={chosen > 0 ? '' : undefined}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && open) {
            event.preventDefault();
            close(true);
          } else if (event.key === 'ArrowDown' && !open) {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span>{filter.label}</span>
        {chosen > 0 ? (
          <span className="ac-filter-button__count">
            <span aria-hidden={countLabel ? true : undefined}>{chosen}</span>
            {countLabel ? <span className="sr-only">{countLabel}</span> : null}
          </span>
        ) : null}
        <Glyph
          name={open ? 'chevron-up' : 'chevron-down'}
          size={12}
          className="ac-filter-button__chevron"
        />
      </button>
      {open ? (
        <Suspense fallback={null}>
          <FilterMenuPanel
            id={menuId}
            anchor={triggerRef}
            filter={filter}
            values={values}
            onChange={(next) => onChange(joinValues(next))}
            onClose={close}
            text={text}
            count={count}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
