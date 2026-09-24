import '@/styles/components/picker.css';

import { useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

import { EntitySlotFace } from '@/components/game/EntitySlot';
import type { Locale } from '@/i18n/config';
import { gridMove, isGridKey, toggleValue } from '@/lib/pickers/model';
import type { PickerOption } from '@/lib/pickers/model';

// Inline ring grid (spec 16.3.3, `Lienzo:Crear-anuncio`): the pickers with few options (auras,
// addons) draw one well of cells of 40 next to their label, without a popover: «Ninguna» as a
// text cell first, which empties the choice, then each option at 1x. A chosen cell carries the
// accent frame and the check; the name of the cell under the pointer or the keyboard shows in a
// small tooltip over it. There is no detail card.

export interface InlineSlotPickerProps {
  label: string;
  /** Keeps the label for assistive technology only (a form row draws its own). */
  labelHidden?: boolean;
  options: readonly PickerOption[];
  value: readonly string[];
  onChange: (ids: string[]) => void;
  /** «Ninguna» / «None»: the first cell. */
  noneLabel: string;
  locale: Locale;
  /** Kept for the callers; the ring grid has no detail card. */
  hint?: string;
  shinyLabel?: string;
  orLabel?: string;
  /** Form field name: a hidden input carries the ids, comma separated. */
  name?: string;
  className?: string;
}

export function InlineSlotPicker({
  label,
  labelHidden = false,
  options,
  value,
  onChange,
  noneLabel,
  locale,
  name,
  className,
}: InlineSlotPickerProps) {
  const [cursor, setCursor] = useState(-1);
  const listRef = useRef<HTMLDivElement>(null);
  const labelId = useId();
  const baseId = useId();
  const count = options.length + 1;

  const choose = (index: number) => {
    if (index === 0) onChange([]);
    else {
      const option = options[index - 1];
      if (!option.unavailable) onChange(toggleValue(value, option.id));
    }
  };

  // One row: the arrows move along it (the well wraps only when the column is narrow).
  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (isGridKey(event.key)) {
      event.preventDefault();
      setCursor((was) => gridMove(was, event.key as never, count, count));
    } else if ((event.key === 'Enter' || event.key === ' ') && cursor >= 0) {
      event.preventDefault();
      choose(cursor);
    }
  };

  return (
    <div className={['ac-picker', 'ac-picker--inline', className].filter(Boolean).join(' ')}>
      <span id={labelId} className={labelHidden ? 'sr-only' : 'ac-picker__label'}>
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
              className={
                option === null ? 'ac-slot-grid__cell ac-slot-grid__none' : 'ac-slot-grid__cell'
              }
              data-active={index === cursor || undefined}
              data-tip={option?.name}
              onClick={() => {
                setCursor(index);
                choose(index);
              }}
            >
              {option === null ? (
                noneLabel
              ) : (
                <>
                  <EntitySlotFace
                    sprite={option.sprite}
                    locale={locale}
                    size={40}
                    shiny={option.shiny}
                  />
                  {selected ? <span className="ac-slot-grid__check" aria-hidden="true" /> : null}
                </>
              )}
            </div>
          );
        })}
      </div>
      {name ? <input type="hidden" name={name} value={value.join(',')} /> : null}
    </div>
  );
}
