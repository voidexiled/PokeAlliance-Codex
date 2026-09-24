import '@/styles/components/stepper.css';

import { useId } from 'react';
import type { CSSProperties } from 'react';

// Stepper (spec 16.3.4, Boost): − value + with an optional slider across the same range.
// The value is always an integer clamped to [min, max].

interface StepperProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max: number;
  step?: number;
  /** Draws the slider under the buttons. */
  slider?: boolean;
  /** «Menos» / «Less» and «Más» / «More», the names of the − and + buttons. */
  decrementLabel: string;
  incrementLabel: string;
  name?: string;
  className?: string;
}

export function Stepper({
  label,
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  slider = false,
  decrementLabel,
  incrementLabel,
  name,
  className,
}: StepperProps) {
  const id = useId();
  const clamp = (n: number) =>
    Math.min(max, Math.max(min, Math.round(Number.isFinite(n) ? n : min)));
  const set = (n: number) => onChange(clamp(n));
  return (
    <div className={['ac-stepper', className].filter(Boolean).join(' ')}>
      <label htmlFor={id} className="ac-stepper__label">
        {label}
      </label>
      <div className="ac-stepper__row">
        <button
          type="button"
          className="ac-stepper__btn"
          aria-label={decrementLabel}
          disabled={value <= min}
          onClick={() => set(value - step)}
        >
          <span aria-hidden="true" className="ac-stepper__minus" />
        </button>
        <input
          id={id}
          className="ac-stepper__input"
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={step}
          name={name}
          value={value}
          onChange={(event) => set(event.target.valueAsNumber)}
        />
        <button
          type="button"
          className="ac-stepper__btn"
          aria-label={incrementLabel}
          disabled={value >= max}
          onClick={() => set(value + step)}
        >
          <span aria-hidden="true" className="ac-stepper__plus" />
        </button>
      </div>
      {slider ? (
        <input
          className="ac-stepper__slider"
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-label={label}
          style={
            { '--fill': `${((value - min) / Math.max(1, max - min)) * 100}%` } as CSSProperties
          }
          onChange={(event) => set(event.target.valueAsNumber)}
        />
      ) : null}
    </div>
  );
}
