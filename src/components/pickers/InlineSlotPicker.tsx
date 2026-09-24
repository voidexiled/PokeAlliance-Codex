import '@/styles/components/picker.css';

import { useId, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

import { EntitySlotFace, entitySlotClasses } from '@/components/game/EntitySlot';
import { GameTooltip } from '@/components/game/GameTooltip';
import type { Locale } from '@/i18n/config';
import { gridMove, isGridKey, toggleValue } from '@/lib/pickers/model';
import type { PickerOption } from '@/lib/pickers/model';

// Inline slot grid (spec 16.3.3): the pickers with few options (auras, addons) draw their 56 px
// slots under the label, without a popover, like the «Auras» panel of the game. The first slot,
// «none», empties the choice; the chosen ones carry the accent frame and the check. The docked
// detail under the grid shows the game tooltip of the slot under the pointer or the focus.

export interface InlineSlotPickerProps {
  label: string;
  options: readonly PickerOption[];
  value: readonly string[];
  onChange: (ids: string[]) => void;
  /** «Ninguna» / «None»: the first slot. */
  noneLabel: string;
  locale: Locale;
  hint?: string;
  shinyLabel?: string;
  orLabel?: string;
  /** Form field name: a hidden input carries the ids, comma separated. */
  name?: string;
  className?: string;
}

const SLOT = 56;
const GAP = 6;

export function InlineSlotPicker({
  label,
  options,
  value,
  onChange,
  noneLabel,
  locale,
  hint,
  shinyLabel,
  orLabel,
  name,
  className,
}: InlineSlotPickerProps) {
  const [cursor, setCursor] = useState(-1);
  const [hover, setHover] = useState<number | null>(null);
  const [cols, setCols] = useState(6);
  const listRef = useRef<HTMLDivElement>(null);
  const labelId = useId();
  const baseId = useId();
  const count = options.length + 1;

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const measure = () => setCols(Math.max(1, Math.floor((list.clientWidth + GAP) / (SLOT + GAP))));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, []);

  const choose = (index: number) => {
    if (index === 0) onChange([]);
    else {
      const option = options[index - 1];
      if (!option.unavailable) onChange(toggleValue(value, option.id));
    }
  };

  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (isGridKey(event.key)) {
      event.preventDefault();
      setCursor((was) => gridMove(was, event.key as never, count, cols));
    } else if ((event.key === 'Enter' || event.key === ' ') && cursor >= 0) {
      event.preventDefault();
      choose(cursor);
    }
  };

  const shown = hover ?? cursor;
  const detail = shown > 0 ? options[shown - 1] : null;

  return (
    <div className={['ac-picker', className].filter(Boolean).join(' ')}>
      <span id={labelId} className="ac-picker__label">
        {label}
      </span>
      <div
        ref={listRef}
        role="listbox"
        tabIndex={0}
        aria-labelledby={labelId}
        aria-multiselectable="true"
        aria-activedescendant={cursor >= 0 ? `${baseId}-${cursor}` : undefined}
        className="ac-slot-grid"
        onKeyDown={onKey}
        onFocus={() => {
          if (cursor < 0) setCursor(0);
        }}
      >
        {[null, ...options].map((option, index) => {
          const selected = option === null ? value.length === 0 : value.includes(option.id);
          return (
            <div
              key={option?.id ?? 'none'}
              id={`${baseId}-${index}`}
              role="option"
              aria-selected={selected}
              aria-disabled={option?.unavailable || undefined}
              aria-label={option?.name ?? noneLabel}
              className="ac-picker__option"
              data-active={index === cursor || undefined}
              onPointerEnter={() => setHover(index)}
              onPointerLeave={() => setHover(null)}
              onClick={() => {
                setCursor(index);
                choose(index);
              }}
            >
              <span
                className={entitySlotClasses(56, {
                  selected,
                  unavailable: option?.unavailable,
                  none: option === null,
                })}
              >
                <EntitySlotFace
                  sprite={option?.sprite ?? null}
                  locale={locale}
                  size={56}
                  none={option === null}
                  shiny={option?.shiny}
                  check={option !== null && selected}
                />
              </span>
            </div>
          );
        })}
      </div>
      <div className="ac-slot-grid__detail">
        {detail ? (
          <GameTooltip
            tip={detail.tip}
            variant="sheet"
            locale={locale}
            hint={hint}
            ariaLabel={detail.name}
            shinyLabel={shinyLabel}
            orLabel={orLabel}
          />
        ) : null}
      </div>
      {name ? <input type="hidden" name={name} value={value.join(',')} /> : null}
    </div>
  );
}
