import { useId } from 'react';
import type { ChangeEvent, FieldsetHTMLAttributes, ReactNode } from 'react';

import { describedBy, fieldId } from './TextField';

// RadioGroup (spec 7.2.8): one choice among a few, all visible — the «Motivo» of a report
// (9.11). The design system has no component for it, so it is a native `<fieldset>` with its
// `<legend>` and one `<input type="radio">` per option (spec 3.8, E8), composed only from
// tokens and text styles (R16). The browser gives the group its arrow keys and its single
// tab stop.
//
// Each option is a row like the one of Checkbox: a `<label>` with the input lying over the
// whole row, transparent, so the row is the target and grows to `size-touch` with a coarse
// pointer (13.7, S14); `span.ac-radio-group__mark` draws the states of spec 5.2 from the input
// next to it, with a round mark so the choice reads as one among several.
//
// Controlled with `value`, or uncontrolled from `defaultValue`. The legend, the option labels
// and the helper arrive by props from the dictionary (DP1).

export interface RadioGroupOption {
  /** Value the form sends and `onChange` reports. */
  value: string;
  /** Text of the option, 14/22 to the right of the mark. */
  label: ReactNode;
  disabled?: boolean;
}

export interface RadioGroupProps extends Omit<
  FieldsetHTMLAttributes<HTMLFieldSetElement>,
  'onChange' | 'defaultValue'
> {
  /** Visible legend 14/22, 8 px above the options («Motivo»). */
  legend: ReactNode;
  options: RadioGroupOption[];
  /** Controlled choice; `null` is none. */
  value?: string | null;
  /** Initial choice when uncontrolled. */
  defaultValue?: string;
  /** The chosen value and the change event. */
  onChange?: (value: string, event: ChangeEvent<HTMLInputElement>) => void;
  /** Helper 12/16 in `helper` under the options, joined to the group with `aria-describedby`. */
  helper?: ReactNode;
  /** Name shared by the radios (generated when absent). */
  name?: string;
  /** Id prefix of the radios (generated when absent). */
  id?: string;
  /** A choice is required to send the form. */
  required?: boolean;
}

export function RadioGroup({
  legend,
  options,
  value,
  defaultValue,
  onChange,
  helper,
  name,
  id,
  required,
  className,
  ...rest
}: RadioGroupProps) {
  const uid = fieldId(useId());
  const base = id ?? `ac-rg-${uid}`;
  const helperId = `${base}-helper`;
  const controlled = value !== undefined;

  return (
    <fieldset
      {...rest}
      className={className ? `ac-radio-group ${className}` : 'ac-radio-group'}
      aria-describedby={describedBy(rest['aria-describedby'], helper ? helperId : undefined)}
    >
      <legend className="ac-radio-group__legend">{legend}</legend>
      <div className="ac-radio-group__options">
        {options.map((option, index) => (
          <label key={option.value} className="ac-radio-group__option">
            <input
              id={`${base}-${index}`}
              className="ac-radio-group__input"
              type="radio"
              name={name ?? base}
              value={option.value}
              checked={controlled ? value === option.value : undefined}
              defaultChecked={controlled ? undefined : defaultValue === option.value}
              disabled={option.disabled}
              required={required}
              onChange={(event) => onChange?.(option.value, event)}
            />
            <span className="ac-radio-group__mark" />
            <span className="ac-radio-group__label">{option.label}</span>
          </label>
        ))}
      </div>
      {helper ? (
        <p id={helperId} className="ac-radio-group__helper">
          {helper}
        </p>
      ) : null}
    </fieldset>
  );
}
