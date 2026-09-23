import { useId, useState } from 'react';
import type { ChangeEvent, HTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';

import { describedBy, fieldId } from './TextField';

// Textarea (spec 7.2.8): long text — the «Detalle» of a report (9.11), the JSON pasted into
// the Guild import (10.10), the text of a listing to copy (9.7.7). The design system has no
// component for it, so it is a native `<textarea>` with the look of a TextField (spec 3.8,
// E8, R16): the same 14/22 label 8 above, a field of radius 11 with `border-secondary` on
// `bg-primary` in `type-field`, and the same 12/16 helper 4 below, joined with
// `aria-describedby`.
//
// The props follow TextField's, so a form writes both the same way; the height is `rows`, and
// the extra attributes of the element (maxLength, required, aria-invalid…) go in
// `textareaProps`. Every text arrives by props from the dictionary (DP1).

export interface TextareaProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'onChange' | 'defaultValue'
> {
  /** Label 14/22, 8 px above the field. Always set: it is the accessible name even hidden. */
  label?: ReactNode;
  /** Keeps the label for screen readers only. */
  labelHidden?: boolean;
  /** Helper 12/16 in `helper`, 4 px under the field, joined with `aria-describedby`. */
  helper?: ReactNode;
  /** Controlled value. */
  value?: string;
  /** Initial value when uncontrolled. */
  defaultValue?: string;
  /** New text and the change event. */
  onChange?: (value: string, event: ChangeEvent<HTMLTextAreaElement>) => void;
  /** A real example in `text-quaternary`, never in place of the label. */
  placeholder?: string;
  /** Visible lines of text. */
  rows?: number;
  /** Id of the field (generated when absent). */
  id?: string;
  name?: string;
  disabled?: boolean;
  /** Extra attributes of the `<textarea>` (maxLength, required, aria-invalid…). */
  textareaProps?: TextareaHTMLAttributes<HTMLTextAreaElement>;
}

export function Textarea({
  label,
  labelHidden = false,
  helper,
  value,
  defaultValue,
  onChange,
  placeholder,
  rows,
  id,
  name,
  disabled,
  textareaProps,
  className,
  ...rest
}: TextareaProps) {
  const uid = fieldId(useId());
  const areaId = id ?? `ac-ta-${uid}`;
  const helperId = `${areaId}-helper`;

  const controlled = value !== undefined;
  const [inner, setInner] = useState(defaultValue ?? '');

  function handle(event: ChangeEvent<HTMLTextAreaElement>) {
    if (!controlled) setInner(event.target.value);
    onChange?.(event.target.value, event);
  }

  return (
    <div {...rest} className={className ? `ac-textarea ${className}` : 'ac-textarea'}>
      {label != null ? (
        <label htmlFor={areaId} className={labelHidden ? 'sr-only' : 'ac-textarea__label'}>
          {label}
        </label>
      ) : null}
      <textarea
        {...textareaProps}
        id={areaId}
        className="ac-textarea__input"
        name={name}
        rows={rows}
        value={controlled ? value : inner}
        onChange={handle}
        placeholder={placeholder}
        disabled={disabled}
        aria-describedby={describedBy(
          textareaProps?.['aria-describedby'],
          helper ? helperId : undefined,
        )}
      />
      {helper ? (
        <p id={helperId} className="ac-textarea__helper">
          {helper}
        </p>
      ) : null}
    </div>
  );
}
