import '@/styles/components/picker.css';

import { lazy, Suspense, useCallback, useEffect, useId, useRef, useState } from 'react';

import type { ChipOption } from '@/components/controls/ChipChoice';
import { EntitySlotFace, entitySlotClasses } from '@/components/game/EntitySlot';
import type { Locale } from '@/i18n/config';
import type { PickerLabels } from '@/lib/pickers/labels';
import type { HeldInfo, PickerOption } from '@/lib/pickers/model';

// EntityPicker (spec 16.3.2): choosing a game entity is opening a grid of slots. The trigger
// looks like a field and shows the choice with its sprites; the panel (search, filters, a
// 48 px slot grid, the docked detail and, for a multiple choice, the tray) is loaded with
// import() on first open and anchored to the trigger from 768, a bottom sheet below.

export interface PickerFilter {
  /** Facet id of `PickerOption.facets`. */
  id: string;
  label: string;
  options: ChipOption[];
}

export type PickerSource = readonly PickerOption[] | (() => Promise<readonly PickerOption[]>);

export interface EntityPickerProps {
  /** Field label, above the trigger. */
  label: string;
  /** Text of the empty trigger: «Elegir Pokémon» / «Choose Pokémon». */
  placeholder: string;
  /** The options, or a loader (the entity's datos.json) called on first need. */
  options: PickerSource;
  /** Chosen ids. */
  value: readonly string[];
  onChange: (ids: string[]) => void;
  multiple?: boolean;
  /** Allows an empty choice: the «none» slot and the × of the trigger. */
  optional?: boolean;
  /**
   * Filters of the entity, or a builder over the loaded options; one with fewer than two
   * options is not drawn (C-R5).
   */
  filters?: readonly PickerFilter[] | ((options: readonly PickerOption[]) => PickerFilter[]);
  /** 'matrix' lays the options out as effect × tier (HeldPicker). */
  layout?: 'grid' | 'matrix';
  /** Required by the matrix layout. */
  held?: (option: PickerOption) => HeldInfo | null;
  locale: Locale;
  labels: PickerLabels;
  /** `ui.pinHint`, shown in the detail sheet strip. */
  hint?: string;
  shinyLabel?: string;
  orLabel?: string;
  /** Form field name: a hidden input carries the ids, comma separated. */
  name?: string;
  disabled?: boolean;
  className?: string;
}

const EntityPickerPanel = lazy(() => import('./EntityPickerPanel'));

/**
 * Options of a picker source. A static list is used as is; a loader is called once, the first
 * time the options are wanted, so an inline loader never refetches on a re-render.
 */
export function usePickerOptions(
  source: PickerSource,
  wanted: boolean,
): readonly PickerOption[] | null {
  const [loaded, setLoaded] = useState<readonly PickerOption[] | null>(null);
  const requested = useRef(false);
  const latest = useRef(source);
  latest.current = source;
  const isLoader = typeof source === 'function';
  useEffect(() => {
    const load = latest.current;
    if (!isLoader || !wanted || requested.current || typeof load !== 'function') return;
    requested.current = true;
    void load().then(setLoaded, () => {
      requested.current = false;
    });
  }, [isLoader, wanted]);
  return typeof source === 'function' ? loaded : source;
}

const TRIGGER_SLOTS = 6;

export function EntityPicker(props: EntityPickerProps) {
  const {
    label,
    placeholder,
    value,
    onChange,
    multiple = false,
    optional = false,
    name,
    disabled,
    className,
    locale,
    labels,
  } = props;
  const [open, setOpen] = useState(false);
  const [opened, setOpened] = useState(false);
  const options = usePickerOptions(props.options, opened || value.length > 0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const labelId = useId();
  const valueId = useId();

  const chosen = value
    .map((id) => options?.find((option) => option.id === id))
    .filter((option): option is PickerOption => option !== undefined);

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  const toggle = () => {
    if (disabled) return;
    setOpened(true);
    setOpen((was) => !was);
  };

  let summary;
  if (chosen.length === 0) {
    summary = (
      <>
        <span
          className={entitySlotClasses(40, { className: 'ac-picker__slot-empty' })}
          aria-hidden="true"
        />
        <span className="ac-picker__placeholder">{placeholder}</span>
      </>
    );
  } else if (!multiple) {
    const option = chosen[0];
    summary = (
      <>
        <span className={entitySlotClasses(40)} aria-hidden="true">
          <EntitySlotFace sprite={option.sprite} locale={locale} size={40} shiny={option.shiny} />
        </span>
        <span className="ac-picker__value">{option.name}</span>
      </>
    );
  } else {
    const shown = chosen.slice(0, TRIGGER_SLOTS);
    summary = (
      <span className="ac-picker__row" aria-hidden="true">
        {shown.map((option) => (
          <span key={option.id} className={entitySlotClasses(40)}>
            <EntitySlotFace sprite={option.sprite} locale={locale} size={40} shiny={option.shiny} />
          </span>
        ))}
        {chosen.length > shown.length ? (
          <span className="ac-picker__more">+{chosen.length - shown.length}</span>
        ) : null}
      </span>
    );
  }

  return (
    <div ref={rootRef} className={['ac-picker', className].filter(Boolean).join(' ')}>
      <span id={labelId} className="ac-picker__label">
        {label}
      </span>
      <div className="ac-picker__field">
        <button
          ref={triggerRef}
          type="button"
          className="ac-picker__trigger"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-labelledby={`${labelId} ${valueId}`}
          disabled={disabled}
          onClick={toggle}
        >
          {summary}
          <span id={valueId} className="sr-only">
            {chosen.length === 0 ? placeholder : chosen.map((option) => option.name).join(', ')}
          </span>
          <span className="ac-picker__chevron" aria-hidden="true" />
        </button>
        {optional && chosen.length > 0 && !disabled ? (
          <button
            type="button"
            className="ac-picker__clear"
            aria-label={labels.clear}
            title={labels.clear}
            onClick={() => onChange([])}
          >
            <span aria-hidden="true" />
          </button>
        ) : null}
      </div>
      {name ? <input type="hidden" name={name} value={value.join(',')} /> : null}
      {open ? (
        <Suspense
          fallback={<div className="ac-picker__panel ac-picker__panel--loading" aria-busy="true" />}
        >
          <EntityPickerPanel
            {...props}
            options={options}
            anchor={triggerRef}
            root={rootRef}
            onClose={close}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
