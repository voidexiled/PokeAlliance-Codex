import { useId } from 'react';
import type { ChangeEvent, HTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';

import { Glyph } from '@/components/icons/Glyph';

import { describedBy, fieldId } from './TextField';

// Checkbox (spec 7.2.8): one yes-or-no choice — «A convenir» of the listing price (9.7.4) and
// the choices of the account (9.9). The design system has no component for it, so it is a
// native `<input type="checkbox">` inside its `<label>` (spec 3.8, E8), composed only from
// tokens, text styles and the `check` Glyph (R16, C-R7).
//
// The whole row is the target: the input lies over the row, transparent, so a click or a tap
// anywhere on it toggles the box, the row grows to `size-touch` with a coarse pointer (13.7,
// S14) and the keyboard, the form and the screen reader meet the real element. What the eye
// sees is `span.ac-checkbox__box`, which takes the states of spec 5.2 from the input next to
// it: `border-primary` at rest like every control, `bg-tertiary` on hover, the focus ring,
// the selection (`selected` border plus `ring-selected`, no fill, with the 12 px check) and
// the disabled look.
//
// Controlled with `checked`, or uncontrolled from `defaultChecked`: from an .astro page the
// box renders on the server and the browser keeps its state; inside an island `onChange`
// reports each change. The label and the helper arrive by props from the dictionary (DP1).

export interface CheckboxProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'onChange' | 'defaultChecked' | 'defaultValue'
> {
  /** Text of the choice, 14/22 to the right of the box. */
  label: ReactNode;
  /** Controlled state. */
  checked?: boolean;
  /** Initial state when uncontrolled. */
  defaultChecked?: boolean;
  /** The new state and the change event. */
  onChange?: (checked: boolean, event: ChangeEvent<HTMLInputElement>) => void;
  /** Helper 12/16 in `helper` under the label, joined with `aria-describedby`. */
  helper?: ReactNode;
  /** Id of the input (generated when absent). */
  id?: string;
  name?: string;
  /** Value the form sends when checked. */
  value?: string;
  disabled?: boolean;
  /** Extra attributes of the `<input>` (required, aria-invalid, form…). */
  inputProps?: InputHTMLAttributes<HTMLInputElement>;
}

export function Checkbox({
  label,
  checked,
  defaultChecked,
  onChange,
  helper,
  id,
  name,
  value,
  disabled,
  inputProps,
  className,
  ...rest
}: CheckboxProps) {
  const uid = fieldId(useId());
  const inputId = id ?? `ac-cb-${uid}`;
  const helperId = `${inputId}-helper`;
  const controlled = checked !== undefined;

  return (
    <div {...rest} className={className ? `ac-checkbox ${className}` : 'ac-checkbox'}>
      <label className="ac-checkbox__row">
        <input
          {...inputProps}
          id={inputId}
          className="ac-checkbox__input"
          type="checkbox"
          name={name}
          value={value}
          checked={controlled ? checked : undefined}
          defaultChecked={controlled ? undefined : defaultChecked}
          disabled={disabled}
          onChange={(event) => onChange?.(event.target.checked, event)}
          aria-describedby={describedBy(
            inputProps?.['aria-describedby'],
            helper ? helperId : undefined,
          )}
        />
        <span className="ac-checkbox__box">
          <Glyph name="check" size={12} className="ac-checkbox__mark" />
        </span>
        <span className="ac-checkbox__label">{label}</span>
      </label>
      {helper ? (
        <p id={helperId} className="ac-checkbox__helper">
          {helper}
        </p>
      ) : null}
    </div>
  );
}
