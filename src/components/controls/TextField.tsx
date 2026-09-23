import { useId, useState } from 'react';
import type {
  ChangeEvent,
  CSSProperties,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from 'react';

import { Glyph } from '@/components/icons/Glyph';

// TextField (spec 7.2.2, DS:TextField): a labelled 40 px text input with an optional helper
// line under it, and the two search variants that add the 16 px magnifier on the left —
// `search`, the page search of radius 12 («Buscar anuncios» in Comercio), and `filter`, the
// search inside a toolbar that keeps the field radius 11 («Buscar miembro» in Guild).
//
// Markup of the reference (`bundle.js` TextField): `div.ac-text-field` with its variant
// modifier, the `<label>`, the input (inside `div.ac-text-field__control` next to the glyph in
// the search variants) and `p.ac-text-field__helper`, joined to the input with
// `aria-describedby`. A hidden label is the `sr-only` utility, the site's port of `.ac-sr`
// (spec 3.7).
//
// Site differences (C-R3): the label, the placeholder and the helper arrive by props from the
// dictionary (DP1); the magnifier is the `search` Glyph (C-R7); `width` travels as the local
// property `--ac-text-field-width`, because a length written in `style` must be data and go
// through an `--ac-*` property (spec 3.7). The value logic is the reference's: controlled with
// `value`, or uncontrolled from `defaultValue`. From an .astro page the field renders on the
// server without a client directive and the browser keeps what the reader types; inside an
// island `onChange` reports each change.

export interface TextFieldProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'onChange' | 'defaultValue'
> {
  /** Label 14/22, 8 px above the input. Always set: it is the accessible name even hidden. */
  label?: ReactNode;
  /** Keeps the label for screen readers only. Default `true` in `search` and `filter`. */
  labelHidden?: boolean;
  /** Helper 12/16 in `helper`, 4 px under the input, joined with `aria-describedby`. */
  helper?: ReactNode;
  /** `default`; `search`: the page search, radius 12; `filter`: a toolbar search, radius 11. */
  variant?: 'default' | 'search' | 'filter';
  /** Input type. Default `text`, or `search` in the search variants. */
  type?: string;
  /** Controlled value. */
  value?: string;
  /** Initial value when uncontrolled. */
  defaultValue?: string;
  /** New text and the change event. */
  onChange?: (value: string, event: ChangeEvent<HTMLInputElement>) => void;
  /** A real example in `text-quaternary`, never in place of the label. */
  placeholder?: string;
  /** Root width (px number or CSS length). Default: the container's width. */
  width?: number | string;
  inputMode?: HTMLAttributes<HTMLInputElement>['inputMode'];
  /** Id of the input (generated when absent). */
  id?: string;
  name?: string;
  disabled?: boolean;
  /** Extra attributes of the `<input>` (autoComplete, maxLength, aria-invalid…). */
  inputProps?: InputHTMLAttributes<HTMLInputElement>;
}

/** C-R4: `useId` without the characters an id selector would have to escape. */
export function fieldId(raw: string): string {
  return raw.replace(/[^A-Za-z0-9_-]/g, '');
}

/**
 * The helper and any id the caller already points at — the error line of spec 9.7.5, which is
 * text under the field joined with `aria-describedby` — in one attribute.
 */
export function describedBy(...ids: (string | undefined)[]): string | undefined {
  const list = ids.filter(Boolean);
  return list.length > 0 ? list.join(' ') : undefined;
}

/** `width` as the local property the stylesheet reads (C-R2, spec 3.7). */
export function widthStyle(
  property: string,
  width: number | string | undefined,
  style: CSSProperties | undefined,
): CSSProperties | undefined {
  if (width == null) return style;
  return {
    [property]: typeof width === 'number' ? `${width}px` : width,
    ...style,
  } as CSSProperties;
}

export function TextField({
  label,
  labelHidden,
  helper,
  variant = 'default',
  type,
  value,
  defaultValue,
  onChange,
  placeholder,
  width,
  inputMode,
  id,
  name,
  disabled,
  inputProps,
  className,
  style,
  ...rest
}: TextFieldProps) {
  const searchy = variant === 'search' || variant === 'filter';
  const uid = fieldId(useId());
  const inputId = id ?? `ac-tf-${uid}`;
  const helperId = `${inputId}-helper`;
  const hidden = labelHidden ?? searchy;

  const controlled = value !== undefined;
  const [inner, setInner] = useState(defaultValue ?? '');

  function handle(event: ChangeEvent<HTMLInputElement>) {
    if (!controlled) setInner(event.target.value);
    onChange?.(event.target.value, event);
  }

  const classes = ['ac-text-field'];
  if (variant !== 'default') classes.push(`ac-text-field--${variant}`);
  if (className) classes.push(className);

  const input = (
    <input
      {...inputProps}
      id={inputId}
      className="ac-text-field__input"
      type={type ?? (searchy ? 'search' : 'text')}
      name={name}
      value={controlled ? value : inner}
      onChange={handle}
      placeholder={placeholder}
      inputMode={inputMode}
      disabled={disabled}
      aria-describedby={describedBy(
        inputProps?.['aria-describedby'],
        helper ? helperId : undefined,
      )}
    />
  );

  return (
    <div
      {...rest}
      className={classes.join(' ')}
      style={widthStyle('--ac-text-field-width', width, style)}
    >
      {label != null ? (
        <label htmlFor={inputId} className={hidden ? 'sr-only' : 'ac-text-field__label'}>
          {label}
        </label>
      ) : null}
      {searchy ? (
        <div className="ac-text-field__control">
          <Glyph name="search" size={16} className="ac-text-field__icon" />
          {input}
        </div>
      ) : (
        input
      )}
      {helper ? (
        <p id={helperId} className="ac-text-field__helper">
          {helper}
        </p>
      ) : null}
    </div>
  );
}
