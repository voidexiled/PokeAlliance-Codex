import { Fragment } from 'react';
import type { CSSProperties } from 'react';

import '@/styles/components/bar-chart.css';

import { NestedEntity } from '@/components/game/NestedEntity';
import type { Locale } from '@/i18n/config';
import { formatInteger } from '@/lib/format/numbers';
import type { TipData } from '@/lib/game/tips';

// BarChart (spec 10.7, 7.5.5; DS:BarChart): the daily bars of the Guild «Por día». Y ticks, the
// dashed daily goal with its legend, «Semana del dd/mm» bands with a line on each Monday, the
// day in progress at 45 %, the compact day tooltip and a hidden table with the same figures.
//
// Markup and `ac-bar-chart*` classes are the reference's (`bundle.js` BarChart), so
// bar-chart.css ports `bundle.css`. Site differences:
//   - A day without an export has no bar and no trigger (CA-10.3, G7): its column keeps the
//     note under the date («sin export») and the hidden table says so. A bar of 0 is only
//     ever a real 0 of an export, drawn 1 px tall as in the reference.
//   - The compact tooltip is the in-game panel at 200 (Q14 default, R2), opened by the
//     delegated controller like every other panel (spec 7.5.5 and the component table): each
//     bar is a `plain` `NestedEntity` whose trigger fills its column, so the tooltip opens with
//     hover of the column and with focus, closes with Escape, leaves at most one panel open
//     (TT9) and requests Poppins on its own. Placement `above-center`; the first two days
//     `up` + `start` and the last two `up` + `end`. `GameTooltip` drops the Shift strip from a
//     200 panel, so `hint` never shows here; the prop is the one `NestedEntity` requires.
//   - Lengths travel as local properties (spec 3.7): `--ac-bar-cols` (the column count),
//     `--ac-y` (a line's height on the axis) and `--ac-bar-h` (a bar's height).
//   - The x axis is hidden from assistive technology: the bars' names, their panels and the
//     hidden table already carry every date and note.
//
// Presentational: ticks, goal and values arrive computed (`niceTicks` and the goal of 10.7 live
// in `guild-analytics.ts`) and every text arrives written (DP1). It holds no state and ships no
// behaviour of its own.

/** The compact panel of one day: «Viernes 18/09, en curso» over its rows. */
export interface BarChartTip {
  title: string;
  /** Label without its colon (`GameTooltip` adds it) and the value already formatted. */
  rows: readonly { label: string; value: string }[];
}

export interface BarChartDay {
  /** Stable key: the ISO date of the column. */
  key: string;
  /** Short weekday over the date: «vi». */
  weekday: string;
  /** «18/09». */
  date: string;
  /** Height of the bar in the metric's units; `null` draws none (no export, G7). */
  value: number | null;
  /** The day in progress with a bar: the bar at `opacity-partial`. */
  partial?: boolean;
  /** Column of the current day: its date in `text-primary`. */
  current?: boolean;
  /** Line under the date: «en curso», «sin export». */
  note?: string;
  /** Band over a Monday, «Semana del 14/09»; it also draws the week line. */
  weekStart?: string;
  /** Accessible name of the bar: «Viernes 18/09, Puntos: 10.070». */
  ariaLabel: string;
  /** Panel of the bar. A day without it has no trigger. */
  tip?: BarChartTip | null;
  /** Cells of the hidden table, one per `columns`. Without them the note spans the row. */
  cells?: readonly string[] | null;
}

export interface BarChartProps {
  /** One column per day, oldest first. */
  days: readonly BarChartDay[];
  /** Grid lines from 0 to the top of the axis; the last one is the top (`niceTicks`). */
  ticks: readonly number[];
  /** Dashed line and its legend, «Meta diaria: 10.536», or nothing. */
  goal?: { value: number; text: string } | null;
  locale: Locale;
  /** Caption of the hidden table: «Actividad diaria de los últimos 14 días». */
  caption: string;
  /** Header of its first column: «Día». */
  dayLabel: string;
  /** Headers of its other columns: «Puntos», «Dailies», «Contribución», «Con actividad». */
  columns: readonly string[];
  /** `ui.pinHint`, required by `NestedEntity`; a 200 panel never shows it. */
  hint: string;
  className?: string;
}

function local(name: string, value: string): CSSProperties {
  return { [name]: value } as CSSProperties;
}

export function BarChart({
  days,
  ticks,
  goal,
  locale,
  caption,
  dayLabel,
  columns,
  hint,
  className,
}: BarChartProps) {
  const count = days.length;
  const scale = ticks.length > 0 ? ticks : [0, 1];
  const top = scale[scale.length - 1] || 1;
  const pct = (value: number) => `${Math.max(0, Math.min(value / top, 1)) * 100}%`;

  return (
    <div
      className={className ? `ac-bar-chart ${className}` : 'ac-bar-chart'}
      style={local('--ac-bar-cols', String(Math.max(count, 1)))}
    >
      {/* One ui line even without a goal, so the plot does not move between metrics. */}
      <div className="ac-bar-chart__legend-row">
        {goal ? (
          <span className="ac-bar-chart__legend">
            <span className="ac-bar-chart__swatch" aria-hidden="true" />
            {goal.text}
          </span>
        ) : null}
      </div>

      <div className="ac-bar-chart__band" aria-hidden="true">
        {days.map((day) => (
          <span key={day.key} className="ac-bar-chart__band-cell">
            {day.weekStart ?? ''}
          </span>
        ))}
      </div>

      <div className="ac-bar-chart__plot">
        {scale.map((tick) => (
          <Fragment key={tick}>
            <div
              className={
                tick === 0 ? 'ac-bar-chart__line ac-bar-chart__line--zero' : 'ac-bar-chart__line'
              }
              style={local('--ac-y', pct(tick))}
              aria-hidden="true"
            />
            <span
              className="ac-bar-chart__tick"
              style={local('--ac-y', pct(tick))}
              aria-hidden="true"
            >
              {formatInteger(tick, locale)}
            </span>
          </Fragment>
        ))}
        {goal ? (
          <div
            className="ac-bar-chart__goal"
            style={local('--ac-y', pct(goal.value))}
            aria-hidden="true"
          />
        ) : null}
        <div className="ac-bar-chart__cols">
          {days.map((day, index) => {
            const bar =
              day.value === null ? null : (
                <span
                  className={
                    day.partial
                      ? 'ac-bar-chart__bar ac-bar-chart__bar--partial'
                      : 'ac-bar-chart__bar'
                  }
                  style={local('--ac-bar-h', pct(day.value))}
                />
              );
            const edge = index < 2 ? 'start' : index >= count - 2 ? 'end' : null;
            const tip: TipData | null = day.tip
              ? {
                  key: `guild-dia:${day.key}`,
                  title: day.tip.title,
                  width: 200,
                  head: { type: 'none' },
                  dayTitle: day.tip.title,
                  rows: day.tip.rows.map((row) => ({ label: row.label, value: row.value })),
                }
              : null;
            return (
              <div key={day.key} className="ac-bar-chart__col">
                {day.weekStart ? <div className="ac-bar-chart__week" aria-hidden="true" /> : null}
                {bar && tip ? (
                  <NestedEntity
                    tip={tip}
                    variant="plain"
                    placement={edge ? 'up' : 'above-center'}
                    align={edge ?? 'auto'}
                    ariaLabel={day.ariaLabel}
                    locale={locale}
                    hint={hint}
                    className="ac-bar-chart__hit"
                    wrapperClassName="ac-bar-chart__tt"
                  >
                    {bar}
                  </NestedEntity>
                ) : bar ? (
                  <span className="ac-bar-chart__hit">{bar}</span>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="ac-bar-chart__x" aria-hidden="true">
        {days.map((day) => (
          <div key={day.key} className="ac-bar-chart__x-cell">
            <span className="ac-bar-chart__weekday">{day.weekday}</span>
            <span
              className={
                day.current
                  ? 'ac-bar-chart__date ac-bar-chart__date--current'
                  : 'ac-bar-chart__date'
              }
            >
              {day.date}
            </span>
            {day.note ? <span className="ac-bar-chart__weekday">{day.note}</span> : null}
          </div>
        ))}
      </div>

      {/* A table ignores the 1 px box of `sr-only`, so the hidden block wraps it (reference). */}
      <div className="sr-only">
        <table>
          <caption>{caption}</caption>
          <thead>
            <tr>
              <th scope="col">{dayLabel}</th>
              {columns.map((column) => (
                <th key={column} scope="col">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((day) => (
              <tr key={day.key}>
                <th scope="row">{day.date}</th>
                {day.cells ? (
                  day.cells.map((cell, index) => <td key={columns[index] ?? index}>{cell}</td>)
                ) : (
                  <td colSpan={Math.max(columns.length, 1)}>{day.note}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
