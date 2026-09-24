import '@/styles/components/chip-choice.css';

import type { ReactNode } from 'react';

import { Sprite } from '@/components/game/Sprite';
import type { SpriteProps } from '@/components/game/Sprite';

// ChipChoice (spec 16.3.2, 16.3.4): a group of toggle chips with an optional sprite or badge.
// Multiple by default (any chosen value matches: OR within the filter); `multiple={false}` makes
// it a single choice that a second press clears. A group with fewer than two options is not
// drawn (C-R5, 16.1.6).

export interface ChipOption {
  value: string;
  label: string;
  sprite?: SpriteProps | null;
  /** Drawn before the label instead of a sprite (TierBadge, ShinyMark). */
  badge?: ReactNode;
  /** The badge already says the label: the label becomes the accessible name only. */
  badgeOnly?: boolean;
}

interface ChipChoiceProps {
  label: string;
  options: readonly ChipOption[];
  value: readonly string[];
  onChange: (value: string[]) => void;
  multiple?: boolean;
  /** Keep the group label for screen readers only. */
  hideLabel?: boolean;
  className?: string;
}

export function ChipChoice({
  label,
  options,
  value,
  onChange,
  multiple = true,
  hideLabel = false,
  className,
}: ChipChoiceProps) {
  if (options.length < 2) return null;
  const toggle = (option: string) => {
    const on = value.includes(option);
    if (multiple) onChange(on ? value.filter((v) => v !== option) : [...value, option]);
    else onChange(on ? [] : [option]);
  };
  return (
    <div
      className={['ac-chip-choice', className].filter(Boolean).join(' ')}
      role="group"
      aria-label={label}
    >
      {hideLabel ? null : (
        <span className="ac-chip-choice__label" aria-hidden="true">
          {label}
        </span>
      )}
      <div className="ac-chip-choice__chips">
        {options.map((option) => {
          const on = value.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              className="ac-chip-choice__chip"
              aria-pressed={on}
              aria-label={option.badgeOnly ? option.label : undefined}
              title={option.badgeOnly || option.sprite ? option.label : undefined}
              onClick={() => toggle(option.value)}
            >
              {option.badge ??
                (option.sprite ? (
                  <Sprite {...option.sprite} alt="" className="ac-chip-choice__icon" />
                ) : null)}
              {option.badgeOnly ? null : <span>{option.label}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
