import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent, Ref } from 'react';

import type { ChipOption } from '@/components/controls/ChipChoice';
import { Sprite } from '@/components/game/Sprite';
import { fill } from '@/lib/pickers/labels';
import type { PickerLabels } from '@/lib/pickers/labels';
import { isCapped, toggleLimited } from '@/lib/pickers/model';
import type { ActiveFilters } from '@/lib/pickers/model';

import type { PickerFilter } from './EntityPicker';

// The filter bar of the picker panel, Direction C (`Lienzo:Direccion-C`, `Lienzo:Selector-Pokemon`):
// one row of 40 px menu buttons («Tipo», «Tipo de moveset», «Tier», «Variante»; an active one
// shows only its count) and the result count at its end. A button opens its menu under it: the
// name, «n de max», «Limpiar» top-right, the rule line, then 40 px slots (amber ring = chosen,
// one hover tint). Options with a sprite are a 6-column grid of icon-only slots (the name in a
// small game tooltip); the rest are text slots, the numbered tiers («T3») on a row of their own
// under the named ones. Under the row, the active filters as removable tokens that spell the
// rule with their joining word («Tipo [Volador] y [Psíquico] ×»).

interface PickerFilterBarProps {
  filters: readonly PickerFilter[];
  active: ActiveFilters;
  onChange: (id: string, next: string[]) => void;
  /** Clears the filters and the search. */
  onClearAll: () => void;
  /** A search or a filter is active: the tokens row ends with «Limpiar filtros». */
  filtered: boolean;
  /** «910 variantes», already filled. */
  count: string;
  labels: PickerLabels;
  /** «o» / «or»: the joining word of an `any` filter. */
  orLabel?: string;
}

/** A numbered tier («T3»): the second row of the ladder. */
const NUMBERED = /^T\d+$/;

const hasSprite = (filter: PickerFilter) =>
  filter.options.every((option) => option.sprite !== undefined && option.sprite !== null);

export function PickerFilterBar({
  filters,
  active,
  onChange,
  onClearAll,
  filtered,
  count,
  labels,
  orLabel,
}: PickerFilterBarProps) {
  const [open, setOpen] = useState<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const baseId = useId();
  const menuId = `${baseId}-menu`;
  const current = filters.find((filter) => filter.id === open) ?? null;

  // Under its button, kept inside the bar.
  useLayoutEffect(() => {
    const bar = barRef.current;
    const menu = menuRef.current;
    const button = open ? buttons.current.get(open) : undefined;
    if (!bar || !menu || !button) return;
    // On a phone the menu takes the whole width of the sheet (CSS).
    const phone = window.matchMedia('(width < 48rem)').matches;
    const left = Math.max(0, Math.min(button.offsetLeft, bar.clientWidth - menu.offsetWidth));
    menu.style.left = phone ? '' : `${left}px`;
    menu.style.top = `${button.offsetTop + button.offsetHeight + 4}px`;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      const button = buttons.current.get(open);
      if (!menuRef.current?.contains(target) && !button?.contains(target)) setOpen(null);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);

  function close(event: KeyboardEvent) {
    if (event.key !== 'Escape' || !open) return;
    // The picker closes on Escape too: this one only closes the menu.
    event.preventDefault();
    event.stopPropagation();
    buttons.current.get(open)?.focus();
    setOpen(null);
  }

  const shown = filters.filter((filter) => (active[filter.id] ?? []).length > 0);
  const nameOf = (filter: PickerFilter, value: string) =>
    filter.options.find((option) => option.value === value);

  return (
    <>
      <div ref={barRef} className="ac-picker__filterbar" onKeyDown={close}>
        {filters.map((filter) => {
          const n = (active[filter.id] ?? []).length;
          const expanded = open === filter.id;
          return (
            <button
              key={filter.id}
              ref={(node) => {
                if (node) buttons.current.set(filter.id, node);
                else buttons.current.delete(filter.id);
              }}
              type="button"
              className="ac-picker__filter-button"
              aria-expanded={expanded}
              aria-controls={expanded ? menuId : undefined}
              data-active={n > 0 || undefined}
              onClick={() => setOpen((was) => (was === filter.id ? null : filter.id))}
            >
              <span>{filter.label}</span>
              {n > 0 ? <span className="ac-picker__filter-n">{n}</span> : null}
              <span className="ac-picker__filter-chevron" aria-hidden="true" />
            </button>
          );
        })}
        <span className="ac-picker__count" role="status">
          {count}
        </span>
        {current ? (
          <FilterMenu
            ref={menuRef}
            id={menuId}
            filter={current}
            value={active[current.id] ?? []}
            labels={labels}
            onChange={(next) => onChange(current.id, next)}
          />
        ) : null}
      </div>

      {filtered ? (
        <ul className="ac-picker__tokens">
          {shown.map((filter) => {
            const values = active[filter.id] ?? [];
            const joiner = filter.match === 'all' ? labels.and : orLabel;
            const icons = hasSprite(filter);
            return (
              <li key={filter.id} className="ac-picker__token">
                <span>{filter.label}</span>
                <span className="ac-picker__token-values">
                  {values.map((value, index) => {
                    const option = nameOf(filter, value);
                    return (
                      <Fragment key={value}>
                        {index > 0 ? (
                          <span className="ac-picker__token-join">{joiner ?? ','}</span>
                        ) : null}
                        {icons && option?.sprite ? (
                          <span
                            className="ac-picker__token-icon"
                            role="img"
                            aria-label={option.label}
                          >
                            <Sprite {...option.sprite} alt="" />
                          </span>
                        ) : (
                          <span className="ac-picker__token-value">{option?.label ?? value}</span>
                        )}
                      </Fragment>
                    );
                  })}
                </span>
                <button
                  type="button"
                  className="ac-picker__token-x"
                  aria-label={fill(labels.removeItem, { name: filter.label })}
                  onClick={() => onChange(filter.id, [])}
                >
                  <span aria-hidden="true" />
                </button>
              </li>
            );
          })}
          <li>
            <button type="button" className="ac-picker__link" onClick={onClearAll}>
              {labels.clearFilters}
            </button>
          </li>
        </ul>
      ) : null}
    </>
  );
}

interface FilterMenuProps {
  ref: Ref<HTMLDivElement>;
  id: string;
  filter: PickerFilter;
  value: readonly string[];
  labels: PickerLabels;
  onChange: (next: string[]) => void;
}

function FilterMenu({ ref, id, filter, value, labels, onChange }: FilterMenuProps) {
  const titleId = `${id}-title`;
  const icons = hasSprite(filter);
  const { max } = filter;
  const capHint =
    max !== undefined && labels.maxHint ? fill(labels.maxHint, { n: max, max }) : undefined;

  const cell = (option: ChipOption) => {
    const pressed = value.includes(option.value);
    const dimmed = isCapped(value, option.value, max);
    const tip = dimmed && capHint ? capHint : icons ? option.label : filter.tips?.[option.value];
    return (
      <button
        key={option.value}
        type="button"
        className={
          icons ? 'ac-picker__menu-cell' : 'ac-picker__menu-cell ac-picker__menu-cell--text'
        }
        aria-pressed={pressed}
        aria-disabled={dimmed || undefined}
        aria-label={icons ? option.label : undefined}
        data-tip={tip}
        onClick={() => {
          if (!dimmed) onChange(toggleLimited(value, option.value, max));
        }}
      >
        {icons && option.sprite ? <Sprite {...option.sprite} alt="" /> : option.label}
      </button>
    );
  };

  const named = icons ? filter.options : filter.options.filter((o) => !NUMBERED.test(o.label));
  const numbered = icons ? [] : filter.options.filter((o) => NUMBERED.test(o.label));

  return (
    <div ref={ref} id={id} role="group" aria-labelledby={titleId} className="ac-picker__menu">
      <div className="ac-picker__menu-head">
        <p id={titleId} className="ac-picker__menu-title">
          {filter.label}
          {max !== undefined && labels.ofMax ? (
            <span className="ac-picker__menu-count">
              {fill(labels.ofMax, { n: value.length, count: value.length, max })}
            </span>
          ) : null}
        </p>
        {value.length > 0 && labels.menuClear ? (
          <button type="button" className="ac-picker__link" onClick={() => onChange([])}>
            {labels.menuClear}
          </button>
        ) : null}
      </div>
      {filter.rule ? (
        <p className="ac-picker__menu-rule">{fill(filter.rule, { max: max ?? '' })}</p>
      ) : null}
      {named.length > 0 ? (
        <div className={icons ? 'ac-picker__menu-grid' : 'ac-picker__menu-row'}>
          {filter.all && !icons ? (
            <button
              type="button"
              className="ac-picker__menu-cell ac-picker__menu-cell--text"
              aria-pressed={value.length === 0}
              onClick={() => onChange([])}
            >
              {filter.all}
            </button>
          ) : null}
          {named.map(cell)}
        </div>
      ) : null}
      {numbered.length > 0 ? (
        <div className="ac-picker__menu-row ac-picker__menu-row--ladder">{numbered.map(cell)}</div>
      ) : null}
    </div>
  );
}
