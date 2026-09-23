import { useEffect, useId, useState } from 'react';
import type { ChangeEvent, HTMLAttributes, KeyboardEvent, ReactNode } from 'react';

import { Glyph } from '@/components/icons/Glyph';

import { describedBy, fieldId, widthStyle } from './TextField';

// NumberField (spec 7.2.2, DS:NumberField): a whole number with limits that the reader moves
// one step at a time — «Boost mínimo» from +0 to +50, Star Level, Memory Slots, the Guild
// inactivity days. A 40 px group with a `border-primary` border and radius 12, the figure in
// tabular numerals and the two 40 px steppers on the right.
//
// Markup of the reference (`bundle.js` NumberField): `div.ac-number-field` with its `<label>`,
// `div.ac-number-field__group` (`role="group"` named by the label), the text input with
// `role="spinbutton"` and its `aria-value*`, the two `button.ac-number-field__step` and
// `p.ac-number-field__helper`. The behaviour is the reference's too: only digits (and a
// leading minus when `min` allows negatives) reach the field, the steppers and the arrow keys
// move one `step` within the limits, Home and End jump to `min` and `max`, and leaving the
// field clamps what was typed.
//
// Site differences (C-R3): the stepper names arrive by props from the dictionary (DP1), so
// there is no «Disminuir …» default; the chevrons are Glyphs of 12 (C-R7); `width` travels as
// `--ac-number-field-width` (spec 3.7). The steppers act through React, so a NumberField is
// only interactive inside an island: from a static .astro page its buttons would do nothing
// (S11), and the page must hydrate the block that holds it.

export interface NumberFieldProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'onChange' | 'defaultValue'
> {
  /** Label 14/22 («Boost mínimo»); a text label also names the group. */
  label?: ReactNode;
  /** Controlled value; `null` is empty. */
  value?: number | null;
  /** Initial value when uncontrolled. */
  defaultValue?: number | null;
  /** Lower bound: steppers, arrow keys and blur clamp to it; Home jumps to it. */
  min?: number;
  /** Upper bound: steppers, arrow keys and blur clamp to it; End jumps to it. */
  max?: number;
  /** Step of the steppers and the arrow keys. Default 1. */
  step?: number;
  /** The new number, or `null` when the field is emptied. */
  onChange?: (value: number | null) => void;
  /** Helper 12/16 under the group that states the limits («De +0 a +50.»). */
  helper?: ReactNode;
  /** Accessible name of the decrement button, from the dictionary (DP1). */
  decrementLabel: string;
  /** Accessible name of the increment button, from the dictionary (DP1). */
  incrementLabel: string;
  placeholder?: string;
  /** Root width (px number or CSS length). Default: the container's width. */
  width?: number | string;
  /** Id of the input (generated when absent). */
  id?: string;
  name?: string;
  /** Disables the field and both steppers. */
  disabled?: boolean;
}

/** The figure as the field shows it; empty for `null`. */
function toText(value: number | null | undefined): string {
  return value == null || Number.isNaN(value) ? '' : String(value);
}

export function NumberField({
  label,
  value,
  defaultValue,
  min,
  max,
  step = 1,
  onChange,
  helper,
  decrementLabel,
  incrementLabel,
  placeholder,
  width,
  id,
  name,
  disabled,
  className,
  style,
  ...rest
}: NumberFieldProps) {
  const uid = fieldId(useId());
  const inputId = id ?? `ac-nf-${uid}`;
  const helperId = `${inputId}-helper`;
  const controlled = value !== undefined;
  const [text, setText] = useState(toText(controlled ? value : defaultValue));

  // Keep the typed text in step with a controlled value changed from outside.
  useEffect(() => {
    if (!controlled) return;
    setText((typed) => {
      const current = typed === '' || typed === '-' ? null : Number(typed);
      const next = value ?? null;
      return current === next ? typed : toText(value);
    });
  }, [controlled, value]);

  function clamp(n: number): number {
    if (min != null && n < min) return min;
    if (max != null && n > max) return max;
    return n;
  }

  function current(): number | null {
    return text === '' || text === '-' ? null : Number(text);
  }

  function commit(n: number) {
    setText(toText(n));
    onChange?.(n);
  }

  function stepBy(direction: 1 | -1) {
    const now = current();
    if (now == null) commit(clamp(min ?? 0));
    else commit(clamp(now + direction * step));
  }

  function onInput(event: ChangeEvent<HTMLInputElement>) {
    const raw = event.target.value.replace(/\s/g, '');
    const pattern = min != null && min >= 0 ? /^\d*$/ : /^-?\d*$/;
    if (!pattern.test(raw)) return;
    setText(raw);
    onChange?.(raw === '' || raw === '-' ? null : Number(raw));
  }

  function onBlur() {
    const now = current();
    if (now != null && clamp(now) !== now) commit(clamp(now));
  }

  function onKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      stepBy(1);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      stepBy(-1);
    } else if (event.key === 'Home' && min != null) {
      event.preventDefault();
      commit(min);
    } else if (event.key === 'End' && max != null) {
      event.preventDefault();
      commit(max);
    }
  }

  const groupLabel = typeof label === 'string' && label !== '' ? label : undefined;
  const now = current();

  return (
    <div
      {...rest}
      className={className ? `ac-number-field ${className}` : 'ac-number-field'}
      style={widthStyle('--ac-number-field-width', width, style)}
    >
      {label != null ? (
        <label htmlFor={inputId} className="ac-number-field__label">
          {label}
        </label>
      ) : null}
      <div className="ac-number-field__group" role="group" aria-label={groupLabel}>
        <input
          id={inputId}
          className="ac-number-field__input"
          type="text"
          inputMode="numeric"
          role="spinbutton"
          name={name}
          value={text}
          placeholder={placeholder}
          disabled={disabled}
          onChange={onInput}
          onBlur={onBlur}
          onKeyDown={onKey}
          aria-valuenow={now ?? undefined}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-describedby={describedBy(helper ? helperId : undefined)}
        />
        <button
          type="button"
          className="ac-number-field__step"
          disabled={disabled}
          aria-label={decrementLabel}
          onClick={() => stepBy(-1)}
        >
          <Glyph name="chevron-down" size={12} />
        </button>
        <button
          type="button"
          className="ac-number-field__step"
          disabled={disabled}
          aria-label={incrementLabel}
          onClick={() => stepBy(1)}
        >
          <Glyph name="chevron-up" size={12} />
        </button>
      </div>
      {helper ? (
        <p id={helperId} className="ac-number-field__helper">
          {helper}
        </p>
      ) : null}
    </div>
  );
}
