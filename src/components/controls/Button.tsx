import type { HTMLAttributes, MouseEventHandler, ReactNode } from 'react';

import { Glyph } from '@/components/icons/Glyph';
import type { GlyphName } from '@/components/icons/Glyph';

// Button (spec 7.2.2, DS:Button): the bordered 40 px button of almost every action,
// the white solid one for the single main action of a view, and the 40 × 40 icon
// button. With `pressed` it becomes a toggle with the amber selection («Por semana»
// / «Por día»); a group of options is a `ToggleGroup`, not a row of these.
//
// Markup of the reference (`bundle.js` Button): a `<button class="ac-button">` with
// its modifiers, the glyph first inside `span.ac-button__icon` (hidden from assistive
// tech) and then the text. With `href` it is an `<a>` with the same look — a
// navigation or a file link — and a disabled link falls back to a disabled button,
// since a link cannot be disabled.
//
// It is TSX and not Astro because islands draw it (Guild, Comercio, the dialogs). From
// an .astro page it renders on the server with no client directive, and then it only
// acts through `href`, `type="submit"` or the `data-*` attribute a script listens to:
// a button that does nothing is not rendered at all (C-R5).
//
// Site differences (C-R3): `icon` names a `Glyph` (C-R7), so no other SVG can reach a
// button; the text arrives by props (DP1); there is no `style` prop, because no value
// of a button depends on data (C-R2), and a single instance is adjusted with utilities
// in `className`, which win over `ac-button` from their later layer (3.8, V3-7).

/** DS:Button: the glyph of the icon variant is 18 px («Icono · 40 × 40, glifo 18»). */
const ICON_BUTTON_GLYPH = 18;

type SharedAttributes = Omit<
  HTMLAttributes<HTMLElement>,
  'children' | 'className' | 'style' | 'onClick' | 'aria-label' | 'aria-pressed'
>;

interface BaseButtonProps extends SharedAttributes {
  /**
   * Sets `aria-pressed`; `true` draws the `selected` border and `ring-selected`. Leave it
   * undefined for a plain action. Never on a link: the amber does not mark a link (T9).
   */
  pressed?: boolean;
  /** 44 px target (`size-touch`) regardless of the pointer, as in the 390 layout. */
  touch?: boolean;
  /** `border-secondary`, `text-quaternary`, not-allowed. A disabled link is a button. */
  disabled?: boolean;
  /** Default `button`. */
  type?: 'button' | 'submit' | 'reset';
  /** Draws an `<a>` with the same look. Ignored while `disabled`. */
  href?: string;
  /** The action, inside an island. */
  onClick?: MouseEventHandler<HTMLElement>;
  /** Form attributes of a submit button; a link ignores them. */
  form?: string;
  name?: string;
  value?: string;
  /** Utilities added by the caller, after the component's own classes (3.8). */
  className?: string;
}

interface TextButtonProps extends BaseButtonProps {
  /** `default`: 1 px `border-primary`, radius 11, 14/22. `solid`: white fill, black 12/16, radius 10. */
  variant?: 'default' | 'solid';
  /** Glyph before the text, hidden from assistive tech. */
  icon?: GlyphName;
  /** Accessible name when the visible text is not enough. */
  ariaLabel?: string;
  /** The text of the button («Importar», «Copiar coordenadas»), from the dictionary. */
  children: ReactNode;
}

interface IconButtonProps extends BaseButtonProps {
  /** 40 × 40, no border, an 18 px glyph. */
  variant: 'icon';
  icon: GlyphName;
  /** The accessible name is mandatory here: the button has no text. */
  ariaLabel: string;
  children?: never;
}

export type ButtonProps = TextButtonProps | IconButtonProps;

export function Button({
  variant = 'default',
  pressed,
  touch = false,
  icon,
  ariaLabel,
  disabled = false,
  type = 'button',
  href,
  onClick,
  form,
  name,
  value,
  className,
  children,
  ...attributes
}: ButtonProps) {
  const classes = ['ac-button'];
  if (variant !== 'default') classes.push(`ac-button--${variant}`);
  if (touch) classes.push('ac-button--touch');
  if (className) classes.push(className);

  const glyph = icon ? (
    <span className="ac-button__icon" aria-hidden="true">
      <Glyph name={icon} size={variant === 'icon' ? ICON_BUTTON_GLYPH : undefined} />
    </span>
  ) : null;

  if (href && !disabled) {
    return (
      <a
        {...attributes}
        className={classes.join(' ')}
        href={href}
        aria-label={ariaLabel}
        onClick={onClick}
      >
        {glyph}
        {children}
      </a>
    );
  }

  return (
    <button
      {...attributes}
      className={classes.join(' ')}
      type={type}
      disabled={disabled}
      form={form}
      name={name}
      value={value}
      aria-label={ariaLabel}
      aria-pressed={pressed}
      onClick={onClick}
    >
      {glyph}
      {children}
    </button>
  );
}
