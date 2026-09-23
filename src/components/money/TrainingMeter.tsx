import { useId } from 'react';
import type { CSSProperties } from 'react';

import type { Locale } from '@/i18n/config';
import { fill } from '@/i18n/messages/types';
import { formatInteger, formatPercent } from '@/lib/format/numbers';
import { UNKNOWN } from '@/lib/format/unknown';

// TrainingMeter (spec 7.2.5, 7.5.2, 9.5.8, 9.5.9, 13.7; DS:TrainingMeter): the training of
// a Pokémon — the trained stat, its level and the percent to the next level — over a 4 px
// meter. Two looks, as in the design system:
//
//   - `card` (default): the «Entrenamiento» zone of a listing card, «Attack 16 (53%)» over
//     a round meter filled in `selected`; without training, «—» and no meter;
//   - `tooltip`: the body of the «Entrenamiento: N» section of a game tooltip (7.5.2), the
//     stat in `tt-label`, «16 (53%)» in `tt-muted` and a square meter of `tt-label` over
//     `tt-track`. The section around it supplies the 2 px / 8 px of padding. A tooltip
//     never shows the dash (T32): without training there is nothing to draw.
//
// The meter is `role="meter"` from 0 to 100 (13.7). Its name is «Attack, progreso al nivel
// 17» from `ui.money.trainingProgress` when the caller passes `labels` (DP1); a panel that
// has no dictionary at hand — the tooltip opened by `NestedEntity` — names it with its own
// row instead («Attack 16 (53%)», `aria-labelledby`), so no meter is ever left unnamed.
//
// The percent is rounded and held between 0 and 100, as in the reference; the level and the
// percent are written by `formatInteger` and `formatPercent` (13.3). The fill width is data,
// so it travels as a local `--ac-*` property (C-R2, 3.7).

/** The text of the meter, `ui.money` of the dictionary. */
export interface TrainingMeterLabels {
  /** «Entrenamiento» / «Training»: the row label of the card. */
  training: string;
  /** «{stat}, progreso al nivel {level}»: the name of the meter. */
  trainingProgress: string;
}

interface TrainingMeterBase {
  /** Trained stat, a game term («Attack», «Critical Damage»). */
  stat?: string | null;
  /** Current training level. */
  level?: number | null;
  /** Progress to the next level, 0 to 100. */
  percent?: number | null;
  /** Picks the format of the level and the percent (C-R3). */
  locale: Locale;
  /** Utilities added by the caller, after the component's own classes (3.8). */
  className?: string;
}

/** The zone of a listing card: its row label is required copy. */
export interface TrainingMeterCardProps extends TrainingMeterBase {
  variant?: 'card';
  labels: TrainingMeterLabels;
}

/** The body of a tooltip section: the stat is the label, so the dictionary is optional. */
export interface TrainingMeterTooltipProps extends TrainingMeterBase {
  variant: 'tooltip';
  labels?: TrainingMeterLabels;
}

export type TrainingMeterProps = TrainingMeterCardProps | TrainingMeterTooltipProps;

function known(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value);
}

export function TrainingMeter(props: TrainingMeterProps) {
  const { stat, level, percent, locale, labels, className } = props;
  const tooltip = props.variant === 'tooltip';
  // C-R4: unique per page; the meter of a tooltip is named by its own row through them.
  const id = useId();

  const trained = typeof stat === 'string' && stat !== '' && known(level) && known(percent);
  if (!trained && tooltip) return null;

  const classes = ['ac-training-meter'];
  if (tooltip) classes.push('ac-training-meter--tooltip');
  if (className) classes.push(className);

  if (!trained) {
    return (
      <div className={classes.join(' ')}>
        <div className="ac-training-meter__row">
          <span className="ac-training-meter__label">{labels?.training}</span>
          <span className="ac-training-meter__value">{UNKNOWN}</span>
        </div>
      </div>
    );
  }

  const shownPercent = Math.max(0, Math.min(100, Math.round(percent)));
  const progress = `${formatInteger(level, locale)} (${formatPercent(shownPercent, locale)})`;
  const meterName = labels
    ? fill(labels.trainingProgress, { stat, level: formatInteger(level + 1, locale) })
    : undefined;
  // Without the dictionary the row names the meter: «Attack» and «16 (53%)».
  const labelId = meterName === undefined ? `${id}-label` : undefined;
  const valueId = meterName === undefined ? `${id}-value` : undefined;

  return (
    <div className={classes.join(' ')}>
      <div className="ac-training-meter__row">
        <span id={labelId} className="ac-training-meter__label">
          {tooltip ? stat : labels?.training}
        </span>
        <span id={valueId} className="ac-training-meter__value">
          {tooltip ? progress : `${stat} ${progress}`}
        </span>
      </div>
      <div
        className="ac-training-meter__track"
        role="meter"
        aria-label={meterName}
        aria-labelledby={meterName === undefined ? `${labelId} ${valueId}` : undefined}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={shownPercent}
      >
        <div
          className="ac-training-meter__fill"
          style={{ '--ac-training-meter-percent': `${shownPercent}%` } as CSSProperties}
        />
      </div>
    </div>
  );
}
