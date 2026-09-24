import '@/styles/components/combobox.css';
import { useEffect, useId, useRef, useState } from 'react';
import type { FocusEvent, InputHTMLAttributes, KeyboardEvent, MouseEvent, ReactNode } from 'react';

import { fieldId, TextField } from '@/components/controls/TextField';
import { anchorListbox, hideListbox, revealOption, showListbox } from '@/scripts/listbox';

// Combobox (spec 7.2.8): a text field with a list of suggestions, for the forms of
// Comercio (the Pokémon, the Ball, the held items and the item of a listing, 9.7.2 and
// 9.7.3) and for «Añadir Pokémon» in Comparar (11.3). The design system has no such
// component, so it is composed from its pieces (R16): the field *is* `TextField`, and
// the list follows the `Select` list — `bg-tertiary`, radius 8, options of radius 2 with
// the active one on `bg-quaternary` — in the top layer, as a `popover="manual"` placed
// with @floating-ui/dom (src/scripts/listbox.ts), so no `overflow` and no dialog clips it.
//
// It only lives inside an island, so it is React all the way: no delegated script.
//
// ARIA and keyboard are those of the Ctrl + K palette (7.9.3, 7.9.4): the input carries
// `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-autocomplete="list"` and
// `aria-activedescendant`; the focus never leaves it. ↓ and ↑ move the active option and
// wrap around; Intro chooses it; Escape closes; Inicio and Fin stay with the text cursor.
// Typing opens the list and makes its first option active; the pointer makes the option
// under it active, and a click chooses it.
//
// Free text (`freeText`: the Ball, a held item, the item of a listing): the field keeps
// whatever is typed. Typing then leaves no option active, so Intro keeps the text instead
// of replacing it with the first suggestion; ↓ still walks the list.
//
// The caller filters: `options` are the matches of the current text, in their order,
// computed by whoever owns the data (normalized name, number with or without «#»…,
// 11.3). An empty list keeps the list closed. A disabled option — a Pokémon already in
// the comparison — is shown and skipped. Its texts arrive by props (DP1).

export interface ComboboxOption {
  /** Registry id reported by `onSelect`. */
  value: string;
  /** Name shown in the list, and the text of the field once chosen. */
  label: string;
  /** Short line at the end of the row, in `ui`: «Nº 132». */
  meta?: string;
  /**
   * Picture in a 40 px cell before the name: the art at 40 or a sprite of the adapter.
   * `null` keeps the cell empty, so every name of the list starts at one x.
   */
  media?: ReactNode;
  /** A mark right after the name: the `ShinyMark` of a shiny variant. */
  mark?: ReactNode;
  /** Shown, never chosen. */
  disabled?: boolean;
}

export interface ComboboxProps {
  /** Label of the field, which also names the list. */
  label: string;
  /** Keeps the label for screen readers only. */
  labelHidden?: boolean;
  /** Helper line under the field. */
  helper?: ReactNode;
  /** A real example in `text-quaternary`: «Nombre o número». */
  placeholder?: string;
  /** The matches of the current text, in order. */
  options: ComboboxOption[];
  /** Controlled text of the field. */
  value?: string;
  /** Initial text when uncontrolled. */
  defaultValue?: string;
  /** Every change of the text, typed or chosen. */
  onChange?: (text: string) => void;
  /** The option chosen with Intro or a click. */
  onSelect?: (option: ComboboxOption) => void;
  /** The field keeps free text: typing activates no option. */
  freeText?: boolean;
  /** Longest text the field takes. */
  maxLength?: number;
  /** Id of the input; the list and its options derive theirs from it. */
  id?: string;
  name?: string;
  disabled?: boolean;
  required?: boolean;
  /** Extra attributes of the `<input>`: `aria-invalid`, the id of an error line… */
  inputProps?: InputHTMLAttributes<HTMLInputElement>;
  /** Utilities added by the caller, after the component's own classes (3.8). */
  className?: string;
}

/** Active index that means «the first option that can be chosen», set by typing. */
const FIRST = -2;

function firstEnabled(options: ComboboxOption[], from: number, step: 1 | -1): number {
  const count = options.length;
  for (let n = 0; n < count; n += 1) {
    const index = (((from + step * n) % count) + count) % count;
    if (options[index]?.disabled !== true) return index;
  }
  return -1;
}

export function Combobox({
  label,
  labelHidden,
  helper,
  placeholder,
  options,
  value,
  defaultValue,
  onChange,
  onSelect,
  freeText = false,
  maxLength,
  id,
  name,
  disabled,
  required,
  inputProps,
  className,
}: ComboboxProps) {
  // C-R4: `useId` without the characters an id selector would have to escape.
  const uid = fieldId(useId());
  const inputId = id ?? `ac-cb-${uid}`;
  const listId = `${inputId}-list`;
  const optionId = (index: number) => `${inputId}-opt-${index}`;

  const controlled = value !== undefined;
  const [inner, setInner] = useState(defaultValue ?? '');
  const text = controlled ? value : inner;

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  /** Set by the keyboard, so only the keyboard scrolls the list to the active option. */
  const reveal = useRef(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const shown = open && options.length > 0 && disabled !== true;
  let current = -1;
  if (active === FIRST) current = firstEnabled(options, 0, 1);
  else if (active >= 0 && active < options.length && options[active]?.disabled !== true) {
    current = active;
  }

  // Opens the list in the top layer and keeps it under the field while it is open.
  useEffect(() => {
    const list = listRef.current;
    const field = rootRef.current?.querySelector<HTMLElement>('.ac-text-field__input') ?? null;
    if (!shown || list === null || field === null) return undefined;
    showListbox(list);
    const stop = anchorListbox(field, list);
    return () => {
      stop();
      hideListbox(list);
    };
  }, [shown]);

  useEffect(() => {
    if (!reveal.current || !shown || current < 0) return;
    reveal.current = false;
    const list = listRef.current;
    const option = list?.children[current];
    if (list && option instanceof HTMLElement) revealOption(list, option);
  }, [shown, current]);

  function setText(next: string) {
    if (!controlled) setInner(next);
    onChange?.(next);
  }

  function close() {
    setOpen(false);
    setActive(-1);
  }

  function choose(index: number) {
    const option = options[index];
    if (option === undefined || option.disabled === true) return;
    setText(option.label);
    onSelect?.(option);
    close();
  }

  function move(step: 1 | -1) {
    if (options.length === 0) return;
    const from = current < 0 ? (step === 1 ? 0 : options.length - 1) : current + step;
    reveal.current = true;
    setActive(firstEnabled(options, from, step));
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    inputProps?.onKeyDown?.(event);
    if (event.defaultPrevented || event.nativeEvent.isComposing) return;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (event.altKey) {
          // Alt + ↓ only shows the list (APG combobox).
          setOpen(true);
        } else if (shown) {
          move(1);
        } else {
          setOpen(true);
          reveal.current = true;
          setActive(firstEnabled(options, 0, 1));
        }
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (shown) {
          move(-1);
        } else {
          setOpen(true);
          reveal.current = true;
          setActive(firstEnabled(options, options.length - 1, -1));
        }
        break;
      case 'Enter':
        if (shown && current >= 0) {
          event.preventDefault();
          choose(current);
        }
        break;
      case 'Escape':
        if (shown) {
          event.preventDefault();
          close();
        }
        break;
      case 'Tab':
        close();
        break;
    }
  }

  function onBlur(event: FocusEvent<HTMLInputElement>) {
    inputProps?.onBlur?.(event);
    close();
  }

  // A tap on a field that already holds text shows its matches again.
  function onClick(event: MouseEvent<HTMLInputElement>) {
    inputProps?.onClick?.(event);
    if (!shown && text !== '') {
      setOpen(true);
      setActive(freeText ? -1 : FIRST);
    }
  }

  return (
    <div ref={rootRef} className={className ? `ac-combobox ${className}` : 'ac-combobox'}>
      <TextField
        label={label}
        labelHidden={labelHidden}
        helper={helper}
        placeholder={placeholder}
        id={inputId}
        name={name}
        disabled={disabled}
        value={text}
        onChange={(next) => {
          setText(next);
          setOpen(true);
          setActive(freeText ? -1 : FIRST);
        }}
        inputProps={{
          ...inputProps,
          role: 'combobox',
          autoComplete: 'off',
          spellCheck: false,
          maxLength,
          required,
          'aria-expanded': shown,
          'aria-controls': listId,
          'aria-autocomplete': 'list',
          'aria-activedescendant': shown && current >= 0 ? optionId(current) : undefined,
          onKeyDown,
          onBlur,
          onClick,
        }}
      />
      <ul
        ref={listRef}
        id={listId}
        role="listbox"
        aria-label={label}
        className="ac-combobox__listbox"
        popover="manual"
        // The focus stays in the field while the pointer works the list.
        onMouseDown={(event) => event.preventDefault()}
      >
        {options.map((option, index) => (
          <li
            key={option.value}
            id={optionId(index)}
            role="option"
            className="ac-combobox__option"
            aria-selected={index === current}
            aria-disabled={option.disabled === true ? true : undefined}
            onPointerMove={() => {
              if (option.disabled !== true && index !== current) setActive(index);
            }}
            onClick={() => choose(index)}
          >
            {option.media !== undefined ? (
              <span className="ac-combobox__media">{option.media}</span>
            ) : null}
            <span className="ac-combobox__name">{option.label}</span>
            {option.mark ?? null}
            {option.meta ? <span className="ac-combobox__meta">{option.meta}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
