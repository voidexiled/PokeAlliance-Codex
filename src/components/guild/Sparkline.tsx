import type { HTMLAttributes, ReactNode } from 'react';

import '@/styles/components/sparkline.css';

// Sparkline (spec 10.9; DS:Sparkline): the 14-day trend of a row of the Guild members table.
// A 68 × 20 svg with one 3 px bar per day, 5 px apart, and a 1 px tick on a day without
// activity or without an export; with `change`, the variation as text on its right.
//
// Markup and `ac-sparkline*` classes are the reference's (`bundle.js` Sparkline), so
// sparkline.css ports `bundle.css` unchanged. Presentational: the values and the variation
// arrive computed by `guild-analytics.ts` and formatted by the caller; this only draws them.
// The svg is hidden from assistive technology: the figure next to it is the text.

export interface SparklineProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  /** One value per day, oldest first. `null` (no export) and `0` draw the 1 px tick. */
  values: readonly (number | null)[];
  /**
   * The value that fills the 18 px, from the caller: the members table passes one scale for
   * every row. The 1200 of the design system is a sample of its board (X4), not a default.
   */
  max: number;
  /** The variation, already formatted («−13,3%», «+8,2%», «—»). */
  change?: ReactNode;
}

/** Bar heights land on whole pixels, a half going to the even one (DS:Sparkline). */
function roundEven(x: number): number {
  return Math.abs(x % 1) === 0.5 ? 2 * Math.round(x / 2) : Math.round(x);
}

export function Sparkline({ values, max, change, className, ...rest }: SparklineProps) {
  const top = max > 0 ? max : 1;
  let on = '';
  let off = '';
  values.forEach((value, index) => {
    const x = index * 5;
    const n = value ?? 0;
    if (n > 0) {
      const height = Math.min(Math.max(roundEven((18 * n) / top), 2), 18);
      on += `M${x} 20v-${height}h3v${height}z`;
    } else {
      off += `M${x} 20v-1h3v1z`;
    }
  });

  return (
    <span {...rest} className={className ? `ac-sparkline ${className}` : 'ac-sparkline'}>
      <svg
        className="ac-sparkline__svg"
        width={68}
        height={20}
        viewBox="0 0 68 20"
        aria-hidden="true"
        focusable="false"
      >
        {on ? <path className="ac-sparkline__on" d={on} /> : null}
        {off ? <path className="ac-sparkline__off" d={off} /> : null}
      </svg>
      {change != null ? <span className="ac-sparkline__change">{change}</span> : null}
    </span>
  );
}
