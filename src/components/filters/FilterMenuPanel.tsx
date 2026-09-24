import '@/styles/components/filter-menu.css';
import '@/styles/components/filter-tip.css';

import { autoUpdate, computePosition, flip, offset, shift } from '@floating-ui/dom';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';

import { ElementGridMenu } from './ElementGridMenu';
import { MobileFilterSheet } from './MobileFilterSheet';
import { isCapped, toggleValue } from './menu-model';
import type { FilterDef } from './model';
import { SegmentMenu } from './SegmentMenu';
import type { FilterText } from './text';
import { TierLadderMenu } from './TierLadderMenu';

// FilterMenuPanel (plan «Dirección C», the «Desplegables abiertos» band): the dark panel a
// filter button opens, 4 px under it — the filter's name with its counter («2 de 2») and
// «Limpiar» top-right while it has a value, the grey rule line, then its menu of 40 px slots
// (./ElementGridMenu.tsx, ./TierLadderMenu.tsx, ./SegmentMenu.tsx). Placed with
// @floating-ui/dom so it flips and shifts inside the viewport. Esc closes it and gives the focus
// back to the button; a click outside it closes it too. Under 48 rem the same content opens as
// the bottom sheet of ./MobileFilterSheet.tsx.
//
// The default export is the chunk `FilterMenuButton` loads with `import()` on the first open,
// so neither this module nor @floating-ui/dom is part of a page until a menu is opened.

export interface FilterMenuPanelProps {
  id: string;
  anchor: RefObject<HTMLButtonElement | null>;
  filter: FilterDef;
  values: readonly string[];
  onChange: (values: string[]) => void;
  /** `true` gives the focus back to the button. */
  onClose: (returnFocus: boolean) => void;
  text: FilterText;
  /** «37 variantes», the phone sheet's footer. */
  count?: string;
}

const PHONE = '(width < 48rem)';

function isPhone(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(PHONE).matches;
}

export default function FilterMenuPanel({
  id,
  anchor,
  filter,
  values,
  onChange,
  onClose,
  text,
  count,
}: FilterMenuPanelProps) {
  const [phone] = useState(isPhone);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  // Desktop: placed under the button, kept in place while the page scrolls or resizes.
  useEffect(() => {
    const reference = anchor.current;
    const floating = panelRef.current;
    if (phone || reference === null || floating === null) return undefined;
    // A menu wider than the room right of its button ends flush with the toolbar row, not past
    // the column (the Tier ladder under the last buttons).
    const row = reference.closest<HTMLElement>('.ac-filter-toolbar__row, .ac-picker__filterbar');
    const place = () => {
      void computePosition(reference, floating, {
        placement: 'bottom-start',
        strategy: 'fixed',
        middleware: [
          offset(4),
          flip({ padding: 8 }),
          row ? shift({ boundary: row, padding: 0 }) : shift({ padding: 8 }),
        ],
      }).then(({ x, y }) => {
        floating.style.left = `${x}px`;
        floating.style.top = `${y}px`;
      });
    };
    const stop = autoUpdate(reference, floating, place);
    floating.querySelector<HTMLElement>('[role="option"][tabindex="0"]')?.focus();
    return stop;
  }, [anchor, phone]);

  // Desktop: a press outside the panel and its button closes it without moving the focus.
  useEffect(() => {
    if (phone) return undefined;
    const outside = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target === null) return;
      if (panelRef.current?.contains(target) || anchor.current?.contains(target)) return;
      closeRef.current(false);
    };
    document.addEventListener('pointerdown', outside, true);
    return () => document.removeEventListener('pointerdown', outside, true);
  }, [anchor, phone]);

  const toggle = (optionId: string) => onChange(toggleValue(values, optionId, filter.max));
  const clear = () => onChange([]);
  const chosen = values.length;
  const counter =
    filter.max !== undefined
      ? text.countOfMax.replace('{count}', String(chosen)).replace('{max}', String(filter.max))
      : undefined;
  const clearAction = chosen > 0 ? { label: text.clear, onClear: clear } : undefined;
  const maxHint = text.maxHint.replace('{max}', String(filter.max ?? ''));

  let menu: ReactNode;
  if (filter.kind === 'elements') {
    menu = (
      <ElementGridMenu
        label={filter.label}
        options={filter.options}
        values={values}
        onToggle={toggle}
        max={filter.max}
        maxHint={maxHint}
      />
    );
  } else if (filter.kind === 'tiers') {
    menu = (
      <TierLadderMenu
        label={filter.label}
        options={filter.options}
        values={values}
        onToggle={toggle}
        maxBrokesLabel={text.maxBrokes}
      />
    );
  } else {
    menu = (
      <SegmentMenu
        label={filter.label}
        options={filter.options}
        values={values}
        onToggle={toggle}
        onClear={clear}
        allLabel={text.all}
      />
    );
  }

  if (phone) {
    return (
      <MobileFilterSheet
        id={id}
        title={filter.label}
        counter={counter}
        hint={filter.hint}
        clear={clearAction}
        closeLabel={text.close}
        show={count ? (text.show ? text.show.replace('{count}', count) : count) : undefined}
        onClose={() => closeRef.current(true)}
      >
        {menu}
      </MobileFilterSheet>
    );
  }

  return (
    <div
      ref={panelRef}
      id={id}
      role="dialog"
      aria-label={filter.label}
      className={`ac-filter-panel ac-filter-panel--${filter.kind}`}
      data-capped={isCapped(values, filter.max) ? '' : undefined}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          closeRef.current(true);
        }
      }}
    >
      <div className="ac-filter-panel__head">
        <p className="ac-filter-panel__title">
          {filter.label}
          {counter ? <span className="ac-filter-panel__counter">{counter}</span> : null}
        </p>
        {clearAction ? (
          <button type="button" className="ac-filter-panel__clear" onClick={clear}>
            {text.clear}
          </button>
        ) : null}
      </div>
      {filter.hint ? <p className="ac-filter-panel__hint">{filter.hint}</p> : null}
      <div className="ac-filter-panel__body">{menu}</div>
    </div>
  );
}
