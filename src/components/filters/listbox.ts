import { useCallback, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

import { moveIndex } from './menu-model';

// The keyboard of a menu's listbox (plan «Dirección C», WAI-ARIA listbox): one option in the
// tab order at a time (roving `tabIndex`), the arrow keys, Home and End move the focus by the
// layout of the menu (`moveIndex`), and Enter or Space toggles the focused option. Esc belongs
// to the panel, which closes and gives the focus back to its button.

export interface OptionBinding {
  ref: (element: HTMLElement | null) => void;
  tabIndex: 0 | -1;
  onFocus: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
}

/**
 * `rows` is the length of each row of the menu and `initial` the option that takes the tab
 * stop first (the first chosen one, else the first). `bind(index, activate)` gives the props
 * of one option.
 */
export function useRovingOptions(rows: readonly number[], initial: number) {
  const refs = useRef<(HTMLElement | null)[]>([]);
  const [current, setCurrent] = useState(Math.max(0, initial));

  const bind = useCallback(
    (index: number, activate: () => void): OptionBinding => ({
      ref: (element) => {
        refs.current[index] = element;
      },
      tabIndex: index === current ? 0 : -1,
      onFocus: () => setCurrent(index),
      onKeyDown: (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          activate();
          return;
        }
        const next = moveIndex(index, event.key, rows);
        if (next === null) return;
        event.preventDefault();
        setCurrent(next);
        refs.current[next]?.focus();
      },
    }),
    [current, rows],
  );

  return bind;
}
