import { useId, useState } from 'react';
import type { ChangeEvent, FieldsetHTMLAttributes, HTMLAttributes, ReactNode } from 'react';

import { fieldId } from './TextField';

// RangeField (spec 7.2.2, DS:RangeField): a minimum and maximum pair — a `fieldset` with its
// legend over two 40 px fields joined by a dash in `text-quinary`. It is the «Precio» filter
// of Comercio (spec 9.5.4).
//
// Markup of the reference (`bundle.js` RangeField): `fieldset.ac-range-field`,
// `legend.ac-range-field__legend` and `div.ac-range-field__row` with, for each end, a label for
// screen readers only and `input.ac-range-field__input`, and between them
// `span.ac-range-field__dash`. The hidden labels are the `sr-only` utility, the site's port of
// `.ac-sr` (spec 3.7).
//
// The pair stays text as typed ({ min: '50kk', max: '' }). The component never reads it as a
// number: whoever uses it interprets «50kk», «2,5k» or «1.200kk» with `parsePokedolares` of
// src/lib/format/numbers.ts (spec 4.3, 7.2.2), which also decides what an invalid entry is.
// Pass `inputMode="text"` where amounts with k and kk are typed on a phone.
//
// Site differences (C-R3): the legend, the placeholders and the hidden labels arrive by props
// from the dictionary (DP1), so there is no «Precio», «Mín» or «Máx» default here.

/** The pair as typed; parse it with `parsePokedolares` for money. */
export interface RangeFieldValue {
  min: string;
  max: string;
}

export interface RangeFieldProps extends Omit<
  FieldsetHTMLAttributes<HTMLFieldSetElement>,
  'onChange' | 'defaultValue'
> {
  /** Visible legend 14/22, 8 px above the fields («Precio»). */
  legend: ReactNode;
  /** Controlled pair. */
  value?: RangeFieldValue;
  /** Initial pair when uncontrolled. */
  defaultValue?: Partial<RangeFieldValue>;
  /** The whole pair after either field changes. */
  onChange?: (value: RangeFieldValue) => void;
  /** Placeholders of the two fields («Mín», «Máx»). */
  placeholders: [string, string];
  /** Screen-reader labels of the two fields («Precio mínimo», «Precio máximo»). */
  labels: [string, string];
  /** Phone keyboard. Default `numeric`; `text` where amounts like «50kk» are typed. */
  inputMode?: HTMLAttributes<HTMLInputElement>['inputMode'];
  /** Id prefix of the fields (generated when absent). */
  id?: string;
  /** Form names of the two fields. */
  names?: [string, string];
  /** Disables both fields. */
  disabled?: boolean;
}

const EMPTY: RangeFieldValue = { min: '', max: '' };

export function RangeField({
  legend,
  value,
  defaultValue,
  onChange,
  placeholders,
  labels,
  inputMode = 'numeric',
  id,
  names,
  disabled,
  className,
  ...rest
}: RangeFieldProps) {
  const uid = fieldId(useId());
  const base = id ?? `ac-rf-${uid}`;
  const controlled = value !== undefined;
  const [inner, setInner] = useState<RangeFieldValue>({ ...EMPTY, ...defaultValue });
  const pair: RangeFieldValue = { ...EMPTY, ...(controlled ? value : inner) };

  function set(key: keyof RangeFieldValue) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      const next = { ...pair, [key]: event.target.value };
      if (!controlled) setInner(next);
      onChange?.(next);
    };
  }

  function field(key: keyof RangeFieldValue, index: 0 | 1) {
    const inputId = `${base}-${key}`;
    return (
      <>
        <label htmlFor={inputId} className="sr-only">
          {labels[index]}
        </label>
        <input
          id={inputId}
          name={names?.[index]}
          className="ac-range-field__input"
          type="text"
          inputMode={inputMode}
          placeholder={placeholders[index]}
          value={pair[key]}
          disabled={disabled}
          onChange={set(key)}
        />
      </>
    );
  }

  return (
    <fieldset {...rest} className={className ? `ac-range-field ${className}` : 'ac-range-field'}>
      <legend className="ac-range-field__legend">{legend}</legend>
      <div className="ac-range-field__row">
        {field('min', 0)}
        <span className="ac-range-field__dash" aria-hidden="true">
          –
        </span>
        {field('max', 1)}
      </div>
    </fieldset>
  );
}
