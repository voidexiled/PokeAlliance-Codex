import type { HTMLAttributes, ReactNode } from 'react';

// KpiCard (spec 7.2.6, 7.6.2; CARD_GRID_SYSTEM §6.6; DS:KpiCard): a figure of the Guild
// summary on three subgrid tracks — label, value and comparison — so the values of a row sit
// on one line although a label or a comparison takes two (`kpi` family, `trackCount('kpi')`
// = 3, inside `CardGrid family="kpi"`: 4 columns at 944, 2 from 416, 1 below).
//
// Markup and `ac-kpi-card*` classes are the reference's (`bundle.js` KpiCard), and
// kpi-card.css ports its block. The card draws its own box instead of the card kit's
// `article`: it is a figure, not an entity, so it has no title, no link and no hover. Its
// three tracks are always there, the comparison one included, so the values of a row stay
// level when a card has no comparison; the span of 3 lives in the stylesheet, as in the
// reference, because it never depends on the data.
//
// The figures arrive written by the caller (DP1, 13.3): «13.860» with `formatInteger`, the
// comparison as its text «7 días anteriores: 14.460 (−4,1%)» with `formatPercent`. Nothing is
// invented and nothing is coloured by its sign (DS:KpiCard «No hacer»).

export interface KpiCardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** «Miembros con actividad»: `body` in `text-secondary`. */
  label: ReactNode;
  /** «23», «13.860»: `figure`, tabular. */
  value: ReactNode;
  /** Total after the value, 14 px in `text-tertiary` («de 25»). */
  of?: ReactNode;
  /** «7 días anteriores: 131 (−8,4%)»: `ui` in `text-tertiary`, tabular. */
  comparison?: ReactNode;
}

export function KpiCard({ label, value, of, comparison, className, ...rest }: KpiCardProps) {
  const total = of !== undefined && of !== null && of !== false && of !== '';
  return (
    <div
      {...rest}
      data-anat="kpi"
      className={className ? `ac-kpi-card ${className}` : 'ac-kpi-card'}
    >
      <p className="ac-kpi-card__label">{label}</p>
      <p className="ac-kpi-card__value">
        {value}
        {total ? ' ' : null}
        {total ? <span className="ac-kpi-card__of">{of}</span> : null}
      </p>
      <p className="ac-kpi-card__comparison">{comparison}</p>
    </div>
  );
}
