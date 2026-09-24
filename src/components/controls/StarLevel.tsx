import '@/styles/components/star-level.css';

import { useId } from 'react';

import { Sprite } from '@/components/game/Sprite';
import { uiSprite } from '@/lib/pickers/sprites';

// StarLevel (spec 16.3.4): five stars; pressing a star sets the level, pressing the chosen one
// clears it. The client star sprites (`ui/estrellas/selected`, `ui/estrellas/empty`, from
// selected_star.png and empty_star.png) are used when registered, a CSS star otherwise.

interface StarLevelProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  max?: number;
  /** «{n} estrellas» / «{n} stars», the name of each star. */
  starLabel: string;
  name?: string;
  className?: string;
}

export function StarLevel({
  label,
  value,
  onChange,
  max = 5,
  starLabel,
  name,
  className,
}: StarLevelProps) {
  const labelId = useId();
  const full = uiSprite('ui/estrellas/selected');
  const empty = uiSprite('ui/estrellas/empty');
  return (
    <div className={['ac-star-level', className].filter(Boolean).join(' ')}>
      <span id={labelId} className="ac-star-level__label">
        {label}
      </span>
      <div className="ac-star-level__stars" role="group" aria-labelledby={labelId}>
        {Array.from({ length: max }, (_, i) => {
          const n = i + 1;
          const on = n <= value;
          const sprite = on ? full : empty;
          return (
            <button
              key={n}
              type="button"
              className="ac-star-level__star"
              data-on={on || undefined}
              aria-pressed={n === value}
              aria-label={starLabel.replace('{n}', String(n))}
              onClick={() => onChange(n === value ? 0 : n)}
            >
              {sprite ? (
                <Sprite {...sprite} alt="" />
              ) : (
                <span className="ac-star-level__css" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>
      {name ? <input type="hidden" name={name} value={value} /> : null}
    </div>
  );
}
