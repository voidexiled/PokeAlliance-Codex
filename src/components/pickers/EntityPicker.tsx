import '@/styles/components/picker.css';

import { lazy, Suspense, useCallback, useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import type { ChipOption } from '@/components/controls/ChipChoice';
import { EntitySlotFace, entitySlotClasses } from '@/components/game/EntitySlot';
import type { Locale } from '@/i18n/config';
import type { PickerLabels } from '@/lib/pickers/labels';
import type { FilterMatch, HeldInfo, PickerOption } from '@/lib/pickers/model';

// EntityPicker (spec 16.3.2, `Lienzo:Selector-Pokemon`): choosing a game entity is opening a
// grid of slots. The trigger is a slot trigger of 48 (the sprite in a box of 40, the name and an
// optional second line); the panel (search, the compact filter rows, the results bar, the slot
// grid, the docked detail pane and, for a multiple choice, the tray) is loaded with import() on
// first open and anchored to the trigger from 768, a bottom sheet below.

export interface PickerFilter {
  /** Facet id of `PickerOption.facets`. */
  id: string;
  label: string;
  /**
   * Options with a sprite draw as a grid of icon-only slots (the name in a tooltip), the rest
   * as text slots; a badge is not drawn (no chip colours in the menus).
   */
  options: ChipOption[];
  /** How the chosen values combine: `any` (OR, the default) or `all` (AND). */
  match?: FilterMatch;
  /** The most values that can be chosen; past it the others dim (`aria-disabled`). */
  max?: number;
  /** The rule line of the menu: «Hasta {max}; debe tener ambos.», «De mejor a peor.» */
  rule?: string;
  /** A leading «Todas» slot of a text menu, chosen while nothing is. */
  all?: string;
  /** Tooltip of a text slot by value: the tier's «Max brokes: —». */
  tips?: Readonly<Record<string, string>>;
}

export type PickerSource = readonly PickerOption[] | (() => Promise<readonly PickerOption[]>);

export interface EntityPickerProps {
  /** Field label, above the trigger. */
  label: string;
  /** Keeps the label for assistive technology only (a form row draws its own). */
  labelHidden?: boolean;
  /** Second line of the trigger, under the name or the placeholder: «Held X». */
  meta?: string;
  /** Slots of the grid: 48 (items) or 72 (Pokémon, the art at 64). */
  slotSize?: 48 | 72;
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
    labelHidden = false,
    meta,
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

  const text = (main: ReactNode, empty: boolean) => (
    <span className="ac-picker__text">
      <span className={empty ? 'ac-picker__placeholder' : 'ac-picker__value'}>{main}</span>
      {meta ? <span className="ac-picker__meta">{meta}</span> : null}
    </span>
  );

  let summary;
  if (chosen.length === 0) {
    summary = (
      <>
        <span className="ac-picker__icon" aria-hidden="true" />
        {text(placeholder, true)}
      </>
    );
  } else if (!multiple) {
    const option = chosen[0];
    summary = (
      <>
        <span
          className={entitySlotClasses(40, { className: 'ac-picker__icon' })}
          aria-hidden="true"
        >
          <EntitySlotFace
            sprite={option.sprite}
            locale={locale}
            size={40}
            shiny={option.shiny}
            art={option.tip?.head.type === 'art'}
          />
        </span>
        {text(option.name, false)}
      </>
    );
  } else {
    const shown = chosen.slice(0, TRIGGER_SLOTS);
    summary = (
      <span className="ac-picker__row" aria-hidden="true">
        {shown.map((option) => (
          <span key={option.id} className={entitySlotClasses(40, { className: 'ac-picker__icon' })}>
            <EntitySlotFace
              sprite={option.sprite}
              locale={locale}
              size={40}
              shiny={option.shiny}
              art={option.tip?.head.type === 'art'}
            />
          </span>
        ))}
        {chosen.length > shown.length ? (
          <span className="ac-picker__more">+{chosen.length - shown.length}</span>
        ) : null}
      </span>
    );
  }
  const clearable = optional && chosen.length > 0 && !disabled;

  return (
    <div ref={rootRef} className={['ac-picker', className].filter(Boolean).join(' ')}>
      <span id={labelId} className={labelHidden ? 'sr-only' : 'ac-picker__label'}>
        {label}
      </span>
      <div
        className={clearable ? 'ac-picker__field ac-picker__field--clearable' : 'ac-picker__field'}
      >
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
        </button>
        {clearable ? (
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
