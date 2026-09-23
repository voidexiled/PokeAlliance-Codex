import { useId } from 'react';
import type { ReactNode } from 'react';

import '@/styles/components/period-filter.css';

import { ToggleGroup } from '@/components/controls/ToggleGroup';

// PeriodFilter (spec 10.6; DS:PeriodFilter): the period of the Guild «Resumen». «Hoy»,
// «7 días», «30 días» and «Rango» as a text ToggleGroup, the «Desde» / «Hasta» fields only
// while «Rango» is chosen, and on the right the period written out, announced when it changes.
//
// Markup and `ac-period-filter*` classes are the reference's (`bundle.js` PeriodFilter), so
// period-filter.css ports `bundle.css`. Site differences:
//   - it is controlled only: the island owns the period, because it drives the KPIs;
//   - the dates are validated by the island (dd/mm/aaaa, at most 366 days, «Hasta» ≤ D,
//     «Desde» ≤ «Hasta»); a field it rejects arrives in `invalid` and gets `aria-invalid`,
//     while the island keeps the previous period (10.6);
//   - every text arrives by props (DP1), and there is no «Aplicar»: the period changes when
//     it is chosen (DS:PeriodFilter «No hacer»).

/** The four periods of 10.6; `7d` is the default of the page. */
export type GuildPeriod = 'hoy' | '7d' | '30d' | 'rango';

export interface GuildRange {
  /** «Desde» as typed, dd/mm/aaaa. */
  from: string;
  /** «Hasta» as typed, dd/mm/aaaa. */
  to: string;
}

/** The texts of the filter, from `guild.summary` of the dictionary (DP1). */
export interface PeriodFilterLabels {
  /** Name of the group: «Periodo» / «Period». */
  group: string;
  /** «Hoy» / «Today». */
  today: string;
  /** «7 días» / «7 days». */
  days7: string;
  /** «30 días» / «30 days». */
  days30: string;
  /** «Rango» / «Range». */
  range: string;
  /** «Desde» / «From». */
  from: string;
  /** «Hasta» / «To». */
  to: string;
}

export interface PeriodFilterProps {
  value: GuildPeriod;
  onChange: (value: GuildPeriod) => void;
  /** The «Rango» fields as typed. */
  range: GuildRange;
  /** Every keystroke in «Desde» or «Hasta». */
  onRangeChange: (range: GuildRange) => void;
  /** Fields the island rejected: they are marked and the previous period stays (10.6). */
  invalid?: { from?: boolean; to?: boolean };
  /**
   * The period written out, with real dates: «12/09 a 18/09», «Hoy, 18/09 hasta las 14:32»,
   * «01/09 a 18/09, 18 días». Server time is «hora de Brasilia», never the browser's zone.
   */
  rangeText: ReactNode;
  labels: PeriodFilterLabels;
  className?: string;
}

const PERIODS: readonly GuildPeriod[] = ['hoy', '7d', '30d', 'rango'];

function isPeriod(value: string): value is GuildPeriod {
  return (PERIODS as readonly string[]).includes(value);
}

export function PeriodFilter({
  value,
  onChange,
  range,
  onRangeChange,
  invalid,
  rangeText,
  labels,
  className,
}: PeriodFilterProps) {
  const uid = useId().replace(/[^A-Za-z0-9_-]/g, '');
  const text: Record<GuildPeriod, string> = {
    hoy: labels.today,
    '7d': labels.days7,
    '30d': labels.days30,
    rango: labels.range,
  };

  function field(key: keyof GuildRange) {
    const id = `ac-pf-${uid}-${key}`;
    return (
      <>
        <label htmlFor={id} className="ac-period-filter__label">
          {labels[key]}
        </label>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          maxLength={10}
          className="ac-period-filter__input"
          value={range[key]}
          aria-invalid={invalid?.[key] ? true : undefined}
          onChange={(event) => onRangeChange({ ...range, [key]: event.target.value })}
        />
      </>
    );
  }

  return (
    <div className={className ? `ac-period-filter ${className}` : 'ac-period-filter'}>
      <div className="ac-period-filter__controls">
        <ToggleGroup
          label={labels.group}
          variant="text"
          value={value}
          onChange={(next) => {
            if (isPeriod(next)) onChange(next);
          }}
          options={PERIODS.map((period) => ({ value: period, label: text[period] }))}
        />
        {value === 'rango' ? (
          <div className="ac-period-filter__range">
            {field('from')}
            {field('to')}
          </div>
        ) : null}
      </div>
      <p className="ac-period-filter__summary" aria-live="polite">
        {rangeText}
      </p>
    </div>
  );
}
