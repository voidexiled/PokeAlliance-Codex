import type { AnchorHTMLAttributes, ReactNode } from 'react';

// TextLink (spec 7.2.2, DS:TextLink): a link of text in its two forms. `entity`, for
// the name of a Pokémon, an item, a system or a datum inside a row or a list, is
// `link` with no underline until hover; `prose`, for a reference inside a paragraph,
// is `link-prose` and always underlined. Size and line height come from the text
// around it.
//
// Markup of the reference (`bundle.js` TextLink): one `<a class="ac-text-link">`, with
// `ac-text-link--prose` for the prose form.
//
// Site difference (7.2.2): `href` is mandatory and there is no `#` default, so a link
// that goes nowhere cannot be written (C-R5). An entity that opens a game tooltip is a
// `NestedEntity`, not a TextLink, and an action is a `Button`.

export interface TextLinkProps extends Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  'href' | 'children' | 'className' | 'style'
> {
  /** Destination. */
  href: string;
  /** `entity` (default): `link`, underline on hover. `prose`: `link-prose`, always underlined. */
  variant?: 'entity' | 'prose';
  /** Language of the link text when it differs from the page (`en` in the Spanish UI). */
  lang?: string;
  children: ReactNode;
  /** Utilities added by the caller, after the component's own classes (3.8). */
  className?: string;
}

export function TextLink({
  href,
  variant = 'entity',
  lang,
  children,
  className,
  ...attributes
}: TextLinkProps) {
  const classes = ['ac-text-link'];
  if (variant === 'prose') classes.push('ac-text-link--prose');
  if (className) classes.push(className);
  return (
    <a {...attributes} className={classes.join(' ')} href={href} lang={lang}>
      {children}
    </a>
  );
}
