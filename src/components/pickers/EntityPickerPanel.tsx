import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode, RefObject } from 'react';

import { EntitySlotFace, entitySlotClasses } from '@/components/game/EntitySlot';
import { GameTooltip } from '@/components/game/GameTooltip';
import { fill } from '@/lib/pickers/labels';
import {
  filterOptions,
  gridMove,
  hasActiveFilters,
  heldMatrix,
  isGridKey,
  toggleValue,
} from '@/lib/pickers/model';
import type { ActiveFilters, FilterModes, PickerOption } from '@/lib/pickers/model';

import type { EntityPickerProps } from './EntityPicker';
import { PickerFilterBar } from './PickerFilterBar';

// The panel of EntityPicker (spec 16.3.2, `Lienzo:Selector-Pokemon`), loaded with import() on
// first open. From 768 it is a popover anchored to the trigger by @floating-ui/dom; below, a
// full-screen bottom sheet (CSS). Left: the search and its close, the Direction C filter bar
// (menu buttons, the result count, the active filter tokens; PickerFilterBar) and the slot grid
// (no tier badge on a slot). Right, from 1280: the docked detail pane, the
// game tooltip of the slot under the pointer, the active one or the chosen one, with the
// «Elegir» button and the keyboard strip.
// Keyboard: arrows move between slots (row and column), Home/End, PageUp/PageDown, Enter or
// Space choose, typing goes to the search, Esc closes and returns the focus to the trigger.

interface PanelProps extends Omit<EntityPickerProps, 'options'> {
  options: readonly PickerOption[] | null;
  anchor: RefObject<HTMLButtonElement | null>;
  root: RefObject<HTMLDivElement | null>;
  onClose: () => void;
}

const BATCH = 120;
const GAP = 4;
const NONE_ID = '';

export default function EntityPickerPanel({
  label,
  options,
  value,
  onChange,
  multiple = false,
  optional = false,
  filters = [],
  layout = 'grid',
  held,
  slotSize = 48,
  locale,
  labels,
  hint,
  shinyLabel,
  orLabel,
  anchor,
  root,
  onClose,
}: PanelProps) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<ActiveFilters>({});
  const [cursor, setCursor] = useState(-1);
  const [hover, setHover] = useState<string | null>(null);
  const [limit, setLimit] = useState(BATCH);
  const [cols, setCols] = useState(8);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const baseId = useId();

  const all = useMemo(() => options ?? [], [options]);
  const shownFilters = useMemo(
    () =>
      (typeof filters === 'function' ? filters(all) : filters).filter(
        (filter) => filter.options.length >= 2,
      ),
    [filters, all],
  );
  const modes = useMemo(() => {
    const byId: Record<string, 'any' | 'all'> = {};
    for (const filter of shownFilters) if (filter.match) byId[filter.id] = filter.match;
    return byId as FilterModes;
  }, [shownFilters]);
  const results = useMemo(
    () => filterOptions(all, query, active, modes),
    [all, query, active, modes],
  );

  // Cells of the listbox, row-major. `null` is a hole of the held matrix; NONE_ID is «none».
  const matrix = useMemo(
    () => (layout === 'matrix' && held ? heldMatrix(results, held) : null),
    [layout, held, results],
  );
  const cells: (PickerOption | null)[] = useMemo(() => {
    if (matrix) return matrix.cells;
    const none =
      !multiple && optional
        ? [{ id: NONE_ID, name: labels.none, sprite: null, tip: null as never }]
        : [];
    return [...none, ...results];
  }, [matrix, results, multiple, optional, labels.none]);
  const columns = matrix ? Math.max(1, matrix.tiers.length) : cols;
  const rendered = matrix ? cells.length : Math.min(cells.length, limit);

  // Anchor the popover from 768; the sheet below is pure CSS.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    const reference = anchor.current;
    if (!panel || !reference || !window.matchMedia('(min-width: 768px)').matches) return;
    let cleanup: (() => void) | undefined;
    let alive = true;
    void import('@floating-ui/dom').then(
      ({ autoUpdate, computePosition, flip, offset, shift, size }) => {
        if (!alive) return;
        cleanup = autoUpdate(reference, panel, () => {
          void computePosition(reference, panel, {
            strategy: 'fixed',
            placement: 'bottom-start',
            middleware: [
              offset(4),
              flip({ padding: 8 }),
              shift({ padding: 8 }),
              size({
                padding: 8,
                apply({ availableHeight }) {
                  panel.style.maxHeight = `${Math.max(280, Math.min(560, availableHeight))}px`;
                },
              }),
            ],
          }).then(({ x, y }) => {
            panel.style.left = `${x}px`;
            panel.style.top = `${y}px`;
          });
        });
      },
    );
    return () => {
      alive = false;
      cleanup?.();
    };
  }, [anchor]);

  useEffect(() => {
    searchRef.current?.focus();
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!root.current?.contains(target)) onClose();
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [root, onClose]);

  // Columns of the auto grid, from its width.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list || matrix) return;
    const measure = () =>
      setCols(Math.max(1, Math.floor((list.clientWidth + GAP) / (slotSize + GAP))));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [matrix, slotSize]);

  // Paint the rest of the grid in batches as the sentinel scrolls into view.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || rendered >= cells.length) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) setLimit((was) => was + BATCH);
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [rendered, cells.length]);

  // A new search or filter starts over at the top.
  useEffect(() => {
    setCursor(-1);
    setLimit(BATCH);
  }, [query, active]);

  useEffect(() => {
    if (cursor < 0) return;
    if (cursor >= limit) setLimit(cursor + BATCH);
    document.getElementById(optionId(cursor))?.scrollIntoView({ block: 'nearest' });
  }, [cursor, limit]);

  function optionId(index: number) {
    return `${baseId}-o${index}`;
  }

  function choose(option: PickerOption) {
    if (option.unavailable) return;
    if (option.id === NONE_ID) {
      onChange([]);
      onClose();
    } else if (multiple) {
      onChange(toggleValue(value, option.id));
    } else {
      onChange([option.id]);
      onClose();
    }
  }

  function onListKey(event: KeyboardEvent<HTMLDivElement>) {
    if (isGridKey(event.key)) {
      event.preventDefault();
      setCursor((was) =>
        gridMove(was, event.key as never, cells.length, columns, 4, (i) => cells[i] !== null),
      );
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const option = cells[cursor];
      if (option) choose(option);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    } else if (
      event.key === 'Backspace' ||
      (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey)
    ) {
      event.preventDefault();
      setQuery((was) => (event.key === 'Backspace' ? was.slice(0, -1) : was + event.key));
      searchRef.current?.focus();
    }
  }

  function onSearchKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      listRef.current?.focus();
      setCursor((was) =>
        was < 0 ? gridMove(-1, 'Home', cells.length, columns, 4, (i) => cells[i] !== null) : was,
      );
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const option = cells[cursor] ?? cells.find((cell) => cell !== null && cell.id !== NONE_ID);
      if (option) choose(option);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  }

  const chosen = value
    .map((id) => all.find((option) => option.id === id))
    .filter((option): option is PickerOption => option !== undefined);
  const count = results.length;
  const detail =
    all.find((option) => option.id === hover) ??
    (cursor >= 0 ? cells[cursor] : null) ??
    chosen[0] ??
    null;

  function slot(option: PickerOption, index: number) {
    const selected = option.id === NONE_ID ? value.length === 0 : value.includes(option.id);
    return (
      <div
        key={option.id || 'none'}
        id={optionId(index)}
        role="option"
        aria-selected={selected}
        aria-disabled={option.unavailable || undefined}
        aria-label={option.name}
        className="ac-picker__option"
        data-active={index === cursor || undefined}
        onPointerEnter={() => setHover(option.id === NONE_ID ? null : option.id)}
        onPointerLeave={() => setHover(null)}
        onClick={() => {
          setCursor(index);
          choose(option);
        }}
      >
        <span
          className={entitySlotClasses(slotSize, {
            selected,
            unavailable: option.unavailable,
            none: option.id === NONE_ID,
          })}
        >
          <EntitySlotFace
            sprite={option.sprite}
            locale={locale}
            size={slotSize}
            none={option.id === NONE_ID}
            shiny={option.shiny}
            art={option.tip?.head.type === 'art'}
            check={multiple && selected}
          />
        </span>
      </div>
    );
  }

  const listbox = (
    <div
      ref={listRef}
      role="listbox"
      tabIndex={0}
      aria-label={label}
      aria-multiselectable={multiple || undefined}
      aria-activedescendant={cursor >= 0 && cells[cursor] ? optionId(cursor) : undefined}
      className={matrix ? 'ac-picker__matrix' : 'ac-picker__grid'}
      style={
        matrix
          ? { gridTemplateColumns: `minmax(96px, max-content) repeat(${columns}, ${slotSize}px)` }
          : { gridTemplateColumns: `repeat(auto-fill, ${slotSize}px)` }
      }
      onKeyDown={onListKey}
      onFocus={() => {
        if (cursor < 0)
          setCursor(gridMove(-1, 'Home', cells.length, columns, 4, (i) => cells[i] !== null));
      }}
    >
      {matrix ? (
        <>
          <span role="presentation" />
          {matrix.tiers.map((tier) => (
            <span key={tier} role="presentation" className="ac-picker__matrix-head">
              T{tier}
            </span>
          ))}
          {matrix.rows.map((row, r) => (
            <MatrixRow key={row} row={row}>
              {matrix.tiers.map((tier, c) => {
                const index = r * columns + c;
                const option = cells[index];
                return option ? (
                  slot(option, index)
                ) : (
                  <span key={tier} role="presentation" className="ac-picker__hole" />
                );
              })}
            </MatrixRow>
          ))}
        </>
      ) : (
        cells.slice(0, rendered).map((option, index) => (option ? slot(option, index) : null))
      )}
    </div>
  );

  const setFilter = (id: string, next: string[]) => setActive((was) => ({ ...was, [id]: next }));
  const filtered = hasActiveFilters(active) || query !== '';

  return (
    <>
      <div className="ac-picker__scrim" aria-hidden="true" onClick={onClose} />
      <div
        ref={panelRef}
        className="ac-picker__panel"
        role="dialog"
        aria-label={label}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            onClose();
          }
        }}
      >
        <div className="ac-picker__main">
          <div className="ac-picker__head">
            <label className="ac-picker__search-box">
              <span className="ac-picker__search-icon" aria-hidden="true" />
              <input
                ref={searchRef}
                type="search"
                className="ac-picker__search"
                placeholder={labels.search}
                aria-label={labels.search}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={onSearchKey}
              />
            </label>
            <button
              type="button"
              className="ac-picker__close"
              aria-label={labels.close}
              onClick={onClose}
            >
              <span aria-hidden="true" />
            </button>
          </div>

          <PickerFilterBar
            filters={shownFilters}
            active={active}
            onChange={setFilter}
            onClearAll={() => {
              setActive({});
              setQuery('');
            }}
            filtered={filtered}
            count={options ? fill(labels.results, { n: count }) : ''}
            labels={labels}
            orLabel={orLabel}
          />

          {multiple ? (
            <div className="ac-picker__tray">
              <span className="ac-picker__tray-count">
                {fill(labels.selectedCount, { n: chosen.length })}
              </span>
              <ul className="ac-picker__tray-slots">
                {chosen.map((option) => (
                  <li key={option.id}>
                    <button
                      type="button"
                      className={entitySlotClasses(40, { className: 'ac-picker__tray-slot' })}
                      aria-label={fill(labels.removeItem, { name: option.name })}
                      title={fill(labels.removeItem, { name: option.name })}
                      onClick={() => onChange(value.filter((id) => id !== option.id))}
                    >
                      <EntitySlotFace
                        sprite={option.sprite}
                        locale={locale}
                        size={40}
                        shiny={option.shiny}
                        art={option.tip?.head.type === 'art'}
                      />
                      <span className="ac-picker__tray-x" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
              <button type="button" className="ac-picker__done" onClick={onClose}>
                {labels.done}
              </button>
            </div>
          ) : null}

          <div className="ac-picker__scroll">
            {options === null ? (
              <div className="ac-picker__skeleton" aria-busy="true" />
            ) : count === 0 ? (
              <div className="ac-picker__empty">
                <p>{labels.noMatches}</p>
              </div>
            ) : (
              listbox
            )}
            {rendered < cells.length ? (
              <div ref={sentinelRef} className="ac-picker__sentinel" />
            ) : null}
          </div>
        </div>

        <aside className="ac-picker__detail" aria-live="polite">
          {detail && detail.id !== NONE_ID ? (
            <>
              <div className="ac-picker__detail-tip">
                <GameTooltip
                  tip={detail.tip}
                  variant="sheet"
                  locale={locale}
                  hint={labels.keysHint ? undefined : hint}
                  ariaLabel={detail.name}
                  shinyLabel={shinyLabel}
                  orLabel={orLabel}
                />
              </div>
              {labels.choose && !detail.unavailable ? (
                <div className="ac-picker__detail-action">
                  <button
                    type="button"
                    className="ac-picker__choose"
                    onClick={() => choose(detail)}
                  >
                    {labels.choose}
                  </button>
                </div>
              ) : null}
            </>
          ) : null}
          {labels.keysHint ? <p className="ac-picker__keys">{labels.keysHint}</p> : null}
        </aside>
      </div>
    </>
  );
}

/** A row of the held matrix: the effect name, then its tier cells (grid children). */
function MatrixRow({ row, children }: { row: string; children: ReactNode }) {
  return (
    <>
      <span role="presentation" className="ac-picker__matrix-row">
        {row}
      </span>
      {children}
    </>
  );
}
