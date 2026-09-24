import '@/styles/components/choice-tiles.css';

import { useId, useRef } from 'react';
import type { KeyboardEvent } from 'react';

import { Sprite } from '@/components/game/Sprite';
import type { SpriteProps } from '@/components/game/Sprite';

// ChoiceTiles (spec 16.3.4, the asset type of the listing form): large tiles with a sprite and
// a name, a single choice with radio semantics and arrow-key movement.

export interface ChoiceTile {
  value: string;
  label: string;
  sprite: SpriteProps | null;
}

interface ChoiceTilesProps {
  label: string;
  tiles: readonly ChoiceTile[];
  value: string | null;
  onChange: (value: string) => void;
  name?: string;
  className?: string;
}

export function ChoiceTiles({ label, tiles, value, onChange, name, className }: ChoiceTilesProps) {
  const labelId = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = Math.max(
    0,
    tiles.findIndex((tile) => tile.value === value),
  );
  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const delta =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0;
    if (!delta) return;
    event.preventDefault();
    const next = (current + delta + tiles.length) % tiles.length;
    onChange(tiles[next].value);
    refs.current[next]?.focus();
  };
  return (
    <div className={['ac-choice-tiles', className].filter(Boolean).join(' ')}>
      <span id={labelId} className="ac-choice-tiles__label">
        {label}
      </span>
      <div
        className="ac-choice-tiles__grid"
        role="radiogroup"
        aria-labelledby={labelId}
        onKeyDown={onKey}
      >
        {tiles.map((tile, index) => {
          const on = tile.value === value;
          return (
            <button
              key={tile.value}
              ref={(node) => {
                refs.current[index] = node;
              }}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={index === current ? 0 : -1}
              className="ac-choice-tiles__tile"
              onClick={() => onChange(tile.value)}
            >
              <span className="ac-choice-tiles__art" aria-hidden="true">
                {tile.sprite ? <Sprite {...tile.sprite} alt="" /> : null}
              </span>
              <span className="ac-choice-tiles__name">{tile.label}</span>
            </button>
          );
        })}
      </div>
      {name ? <input type="hidden" name={name} value={value ?? ''} /> : null}
    </div>
  );
}
