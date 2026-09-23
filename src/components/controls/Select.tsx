import { useEffect, useId, useRef, useState } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import { flushSync } from 'react-dom';

import { fieldId, widthStyle } from '@/components/controls/TextField';
import { Glyph } from '@/components/icons/Glyph';

// Select (spec 7.2.2, C-R2; DS:Select): the select-only combobox of the reference — a
// 40 px `<button role="combobox">` with a 16 px chevron at half opacity, and a listbox on
// `bg-tertiary` whose chosen option carries a 16 px check. Focus stays on the trigger and
// the active option travels in `aria-activedescendant`; a letter jumps to the option that
// starts with it.
//
// Markup of the reference (`bundle.js` Select) with the one exception of C-R2: the list is
// a `ul[role="listbox"][popover="manual"]` that is always in the DOM, not one that only
// exists while open. It opens in the top layer, so no `overflow` of a filter bar or a
// dialog clips it.
//
// Nothing here opens, closes or moves anything. What does is the delegated controller
// `src/scripts/select.ts`, which `PageLayout` imports once: it reads `data-ac-select`,
// works the list with the keyboard and the pointer, places it with @floating-ui/dom and
// writes `aria-expanded`, `aria-activedescendant` and `data-active`. So the same markup
// works on a static page, without hydrating React, and inside an island.
//
// When the reader picks an option the controller dispatches `ac:select-change` on the
// root. Rendered by an island, this component answers it: it cancels the event, which
// tells the controller that React owns the selection, and updates its state or calls
// `onChange`. On a static page nobody cancels it and the controller moves the selection
// in the DOM itself: `aria-selected`, the text of the trigger and the check.
//
// Site differences (C-R3): the label, the options and the placeholder arrive by props
// (DP1); the glyphs are `Glyph` (C-R7); `width` travels as the local property
// `--ac-select-width` (spec 3.7). There are no `open`, `defaultOpen` or `onOpenChange`
// (DP3, DP5): the open state belongs to the controller. The check is always in the DOM
// exactly once — in the chosen option, or in the first one while nothing is chosen —
// and `select.css` shows it only in an option with `aria-selected="true"`, so a static
// page can move it without building an SVG.

/**
 * Contract with src/scripts/select.ts, which dispatches this event on the root when an
 * option is picked. The script repeats the name and the detail with the same comment.
 */
const CHANGE_EVENT = 'ac:select-change';

interface SelectChangeDetail {
  value: string;
  index: number;
}

export interface SelectOption {
  /** Value reported by `onChange`: a registry id, never a translated label (U3). */
  value: string;
  /** Visible text («Generación 1», «Todas»). */
  label: string;
}

export interface SelectProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'onChange' | 'defaultValue' | 'children'
> {
  /** Label («Tier», «Generación»); it names the combobox and the listbox. */
  label: ReactNode;
  /** Keeps the label for screen readers only. */
  labelHidden?: boolean;
  /** Label to the left of the control in 12/16 `text-tertiary` (SortSelect). */
  inline?: boolean;
  /** 12/16 trigger with padding 6 12 (SortSelect). The listbox keeps 14/20. */
  compact?: boolean;
  /** The options, with «Todas» or «Todos» first when the filter can be left open. */
  options: SelectOption[];
  /** Controlled value. */
  value?: string;
  /** Initial value when uncontrolled. */
  defaultValue?: string;
  /** Called with the chosen value and option, inside an island. */
  onChange?: (value: string, option: SelectOption) => void;
  /** Width (px number or CSS length): of the whole field, or of the control when `inline`. */
  width?: number | string;
  /** Text in `text-quaternary` while nothing is chosen. */
  placeholder?: string;
  disabled?: boolean;
  /** Id of the trigger; the label, the listbox and the options derive theirs from it. */
  id?: string;
}

export function Select({
  label,
  labelHidden = false,
  inline = false,
  compact = false,
  options,
  value,
  defaultValue,
  onChange,
  width,
  placeholder,
  disabled,
  id,
  className,
  style,
  ...rest
}: SelectProps) {
  // C-R4: `useId` without the characters an id selector would have to escape.
  const uid = fieldId(useId());
  const base = id ?? `ac-sel-${uid}`;
  const labelId = `${base}-label`;
  const listId = `${base}-list`;

  const controlled = value !== undefined;
  const [inner, setInner] = useState(defaultValue);
  const current = controlled ? value : inner;
  const selected = options.findIndex((option) => option.value === current);
  const empty = options.length === 0;

  // The props the listener needs, as of the last render.
  const rootRef = useRef<HTMLDivElement>(null);
  const latest = useRef({ options, controlled, onChange });
  useEffect(() => {
    latest.current = { options, controlled, onChange };
  });

  // Inside an island: take the pick from the controller and keep the DOM React's. The
  // update is flushed before the event returns, so the trigger already reads the new
  // value when the controller gives it the focus back. It listens again when the root
  // appears, since a Select without options renders nothing.
  useEffect(() => {
    const root = rootRef.current;
    if (root === null) return undefined;
    function onPick(event: Event) {
      const { value: next } = (event as CustomEvent<SelectChangeDetail>).detail;
      const option = latest.current.options.find((candidate) => candidate.value === next);
      if (option === undefined) return;
      event.preventDefault();
      flushSync(() => {
        if (!latest.current.controlled) setInner(option.value);
        latest.current.onChange?.(option.value, option);
      });
    }
    root.addEventListener(CHANGE_EVENT, onPick);
    return () => root.removeEventListener(CHANGE_EVENT, onPick);
  }, [empty]);

  // No option, nothing to choose: a control without an action is not rendered (C-R5).
  if (empty) return null;

  const classes = ['ac-select'];
  if (inline) classes.push('ac-select--inline');
  if (compact) classes.push('ac-select--compact');
  if (className) classes.push(className);

  const chosen = selected >= 0 ? options[selected] : undefined;
  const checkAt = selected >= 0 ? selected : 0;

  return (
    <div
      {...rest}
      ref={rootRef}
      className={classes.join(' ')}
      style={widthStyle('--ac-select-width', width, style)}
      data-ac-select=""
    >
      <p id={labelId} className={labelHidden ? 'sr-only' : 'ac-select__label'}>
        {label}
      </p>
      <div className="ac-select__control">
        <button
          id={base}
          type="button"
          role="combobox"
          className="ac-select__trigger"
          disabled={disabled}
          aria-labelledby={labelId}
          aria-haspopup="listbox"
          aria-expanded="false"
          aria-controls={listId}
        >
          <span
            className={
              chosen ? 'ac-select__value' : 'ac-select__value ac-select__value--placeholder'
            }
          >
            {chosen ? chosen.label : (placeholder ?? '')}
          </span>
          <Glyph name="chevron-down" size={16} className="ac-select__chevron" />
        </button>
        <ul
          id={listId}
          role="listbox"
          tabIndex={-1}
          className="ac-select__listbox"
          aria-labelledby={labelId}
          popover="manual"
        >
          {options.map((option, index) => (
            <li
              key={option.value}
              id={`${base}-opt-${index}`}
              role="option"
              className="ac-select__option"
              aria-selected={index === selected ? 'true' : 'false'}
              data-value={option.value}
            >
              {option.label}
              {index === checkAt ? (
                <Glyph name="check" size={16} className="ac-select__check" />
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
