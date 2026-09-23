import { useId, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';

import { ShinyMark } from '@/components/game/ShinyMark';
import { Sprite } from '@/components/game/Sprite';
import type { SpriteProps } from '@/components/game/Sprite';

// ToggleGroup (spec 7.2.2, 7.2.8, DS:ToggleGroup): a single-choice group of buttons
// with `aria-pressed` (T10). The chosen option carries the `selected` border plus
// `ring-selected`; the others `border-primary` with the `bg-tertiary` hover. It is the
// control of filters, periods, views and auras across the site.
//
// Markup of the reference (`bundle.js` ToggleGroup): a `div.ac-toggle-group` with its
// variant and direction modifiers; an optional visible `p.ac-toggle-group__label`; a
// `div.ac-toggle-group__items` with `role="group"` and the group's name; and one
// `button.ac-toggle-group__item` per option — `--text` when it has no sprite — with the
// sprite or Shiny mark first and the text in `span.ac-toggle-group__text`.
//
// Site differences:
// - `sprite` of an option is data, not a node (DP2, 7.2.2): the `SpriteProps` the
//   adapter gives for a registry key, drawn with `Sprite`, or `'shiny'` for `ShinyMark`.
// - The group's name is a mandatory string from the dictionary (DP1): a group with no
//   accessible name is one of the «No hacer» of DS:ToggleGroup.
// - The link tab of 7.2.8: when the options carry `href` (only with `variant="tab"`),
//   each one is an `<a>` with the shape of the tab and the group is a `<nav>` named by
//   the label. The option whose `value` is the group's `value` is the current page:
//   `aria-current="page"` and the «Actual» state of 5.2 (`bg-tertiary`), never the amber
//   selection nor `aria-pressed` — the amber does not mark a link (T9).
//
// TSX because the lists, Guild and the outfit panel draw it inside their islands, where
// `onChange` acts. From an .astro page it renders on the server with no client
// directive; only the link tab needs no island to work.

/** The leading mark of an option: a game sprite (32 px in `sprite` and `tab`) or the Shiny mark. */
export type ToggleGroupSprite = SpriteProps | 'shiny';

/** An option of a group of `aria-pressed` buttons. */
export interface ToggleGroupOption {
  /** Value reported by `onChange`: a registry id, never a translated label (7.7.2 U3). */
  value: string;
  /** Visible text («Todos», «Premier», «7 días»). */
  label: ReactNode;
  sprite?: ToggleGroupSprite;
  /** Accessible name when the label alone is not enough. */
  ariaLabel?: string;
  disabled?: boolean;
  href?: never;
}

/** An option of the link tab (7.2.8): a page of its own. */
export interface ToggleGroupLink {
  value: string;
  label: ReactNode;
  sprite?: ToggleGroupSprite;
  ariaLabel?: string;
  href: string;
}

interface CommonProps {
  /** Group name («Vista», «Aura», «Tipo de activo»), from the dictionary. */
  label: string;
  /** Default `true`: the name is the group's `aria-label`. `false` shows it 8 px above, in 14/22. */
  labelHidden?: boolean;
  /** Visible label in 14/22 700 (the «Aura» block of the Pokémon page). */
  strong?: boolean;
  /** Id of an external label; overrides `label` as the group's name. */
  labelledBy?: string;
  /** `row` wraps with 8 px gaps (default); `column` stacks; `grid` sets `columns` columns. */
  direction?: 'row' | 'column' | 'grid';
  /** Column count for `direction="grid"`. Default 2 (in the stylesheet). */
  columns?: number;
  /** Id of the group and prefix of its visible label's id; generated when absent. */
  id?: string;
  /** Utilities added by the caller, after the component's own classes (3.8). */
  className?: string;
}

/** A group of `aria-pressed` buttons. */
export interface ToggleButtonsProps extends CommonProps {
  options: ToggleGroupOption[];
  /**
   * `text` (default): 40 tall, padding 0 12, radius 8, 12/16 700.
   * `sprite`: 32 px sprite 12 px before 14/22 700 text, padding 8 24 8 12, at least 50 tall.
   * `tab`: like `sprite` with 16 px between sprite and text; a text-only tab has padding 8 20.
   */
  variant?: 'text' | 'sprite' | 'tab';
  /** Controlled value. */
  value?: string;
  /** Initial value when uncontrolled. Default: the first option. */
  defaultValue?: string;
  /** Called with the new value and its option; pressing the current option does nothing. */
  onChange?: (value: string, option: ToggleGroupOption) => void;
}

/** The link tab of 7.2.8: every option is a link. */
export interface ToggleLinksProps extends CommonProps {
  options: ToggleGroupLink[];
  variant: 'tab';
  /** Value of the option that is the current page. With none, no link is current. */
  value?: string;
}

export type ToggleGroupProps = ToggleButtonsProps | ToggleLinksProps;

function isLinkGroup(props: ToggleGroupProps): props is ToggleLinksProps {
  return props.options.some((option) => option.href !== undefined);
}

function Mark({ sprite }: { sprite: ToggleGroupSprite | undefined }) {
  if (sprite === 'shiny') return <ShinyMark />;
  if (sprite) return <Sprite {...sprite} />;
  return null;
}

function itemClass(sprite: ToggleGroupSprite | undefined): string {
  return sprite ? 'ac-toggle-group__item' : 'ac-toggle-group__item ac-toggle-group__item--text';
}

export function ToggleGroup(props: ToggleGroupProps) {
  const {
    label,
    labelHidden = true,
    strong = false,
    labelledBy,
    direction = 'row',
    columns,
    id,
    className,
  } = props;
  const variant = props.variant ?? 'text';
  const uid = useId().replace(/[^A-Za-z0-9_-]/g, '');
  const labelId = `${id ?? `ac-tg-${uid}`}-label`;
  const links = isLinkGroup(props);

  const initial = links ? undefined : (props.defaultValue ?? props.options[0]?.value);
  const [inner, setInner] = useState(initial);

  const classes = ['ac-toggle-group', `ac-toggle-group--${variant}`];
  if (direction !== 'row') classes.push(`ac-toggle-group--${direction}`);
  if (className) classes.push(className);
  // A local property of the component (3.4): the column count is data of the instance.
  const style =
    columns === undefined ? undefined : ({ '--ac-toggle-cols': String(columns) } as CSSProperties);

  const showLabel = !labelHidden;
  const name = labelledBy
    ? { 'aria-labelledby': labelledBy }
    : showLabel
      ? { 'aria-labelledby': labelId }
      : { 'aria-label': label };
  const visibleLabel = showLabel ? (
    <p
      id={labelId}
      className={
        strong ? 'ac-toggle-group__label ac-toggle-group__label--strong' : 'ac-toggle-group__label'
      }
    >
      {label}
    </p>
  ) : null;

  if (links) {
    return (
      <nav id={id} className={classes.join(' ')} style={style} {...name}>
        {visibleLabel}
        <div className="ac-toggle-group__items">
          {props.options.map((option) => (
            <a
              key={option.value}
              className={itemClass(option.sprite)}
              href={option.href}
              aria-current={option.value === props.value ? 'page' : undefined}
              aria-label={option.ariaLabel}
            >
              <Mark sprite={option.sprite} />
              <span className="ac-toggle-group__text">{option.label}</span>
            </a>
          ))}
        </div>
      </nav>
    );
  }

  const controlled = props.value !== undefined;
  const value = controlled ? props.value : inner;
  const pick = (option: ToggleGroupOption) => {
    if (option.value === value) return;
    if (!controlled) setInner(option.value);
    props.onChange?.(option.value, option);
  };

  return (
    <div id={id} className={classes.join(' ')} style={style}>
      {visibleLabel}
      <div role="group" className="ac-toggle-group__items" {...name}>
        {props.options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={itemClass(option.sprite)}
            aria-pressed={option.value === value}
            aria-label={option.ariaLabel}
            disabled={option.disabled}
            onClick={() => pick(option)}
          >
            <Mark sprite={option.sprite} />
            <span className="ac-toggle-group__text">{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
