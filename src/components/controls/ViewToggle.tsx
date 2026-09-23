import { ToggleGroup } from '@/components/controls/ToggleGroup';
import type { EntityView } from '@/lib/lists/state';

// ViewToggle (spec 7.2.2, 7.7, S4, DS:ViewToggle): the Cards / Slots / Lista switch
// every list of entities carries at the right of its results bar (7.7.4 V6). Three
// text buttons with `aria-pressed` in one group named «Vista»: the text variant of
// `ToggleGroup`, which the three buttons never leave for a second line.
//
// Markup of the reference (`bundle.js` ViewToggle): a `ToggleGroup` with a hidden label,
// `variant="text"`, the three views in this order and the extra class `ac-view-toggle`.
//
// Every text arrives by props (DP1, 13.2): `labels` and `ariaLabel` are mandatory and
// come from `ui.views` of the page's locale (`ariaLabel` is `ui.views.label`, or the
// name of a second list on the same page, «Vista de la Tier list»). The Spanish
// defaults of the design system are not used on the site. The three views are read as
// `labels.cards`, `labels.slots` and `labels.list`, so `ui.views` needs no entry in
// src/i18n/dynamic-keys.ts.
//
// The value is a view id, never a translated label (7.7.2 U3); the list controller of
// 7.7 owns the state, the URL and the saved view.

// The three views of a list of entities (7.7.1) are declared with the list state in
// src/lib/lists/state.ts; they are re-exported here for the callers of the toggle.
export type { EntityView };

/** The views in the order the toggle draws them. */
export const ENTITY_VIEWS: readonly EntityView[] = ['cards', 'slots', 'list'];

/** The button texts, `ui.views` of the dictionary. */
export interface ViewToggleLabels {
  cards: string;
  slots: string;
  list: string;
}

export interface ViewToggleProps {
  /** Controlled view. */
  value?: EntityView;
  /** Initial view when uncontrolled. Default `cards`. */
  defaultValue?: EntityView;
  /** Called with the new view. */
  onChange?: (value: EntityView) => void;
  /** Button texts: `ui.views` of the page's locale. */
  labels: ViewToggleLabels;
  /** Group name: `ui.views.label`, or the name of a second list on the page. */
  ariaLabel: string;
  /** Id of the group; generated when absent. */
  id?: string;
  /** Utilities added by the caller, after the component's own classes (3.8). */
  className?: string;
}

function isEntityView(value: string): value is EntityView {
  return (ENTITY_VIEWS as readonly string[]).includes(value);
}

export function ViewToggle({
  value,
  defaultValue,
  onChange,
  labels,
  ariaLabel,
  id,
  className,
}: ViewToggleProps) {
  const options = [
    { value: 'cards', label: labels.cards },
    { value: 'slots', label: labels.slots },
    { value: 'list', label: labels.list },
  ];
  return (
    <ToggleGroup
      label={ariaLabel}
      labelHidden
      variant="text"
      options={options}
      value={value}
      defaultValue={value === undefined ? (defaultValue ?? 'cards') : undefined}
      onChange={
        onChange
          ? (next) => {
              if (isEntityView(next)) onChange(next);
            }
          : undefined
      }
      id={id}
      className={className ? `ac-view-toggle ${className}` : 'ac-view-toggle'}
    />
  );
}
