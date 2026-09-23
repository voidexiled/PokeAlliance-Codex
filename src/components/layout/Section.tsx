import type { ReactNode } from 'react';

// Section (spec 5.9, 7.2.1, 7.11, DS:Section): one block of an inner page, with
// its h2, the rule under it and a 16 px rhythm between its children.
//
// It is a TSX server component (C-R1) because the account page of 9.9 and the
// Guild dialogs of 10.10 render sections inside an island. From an .astro page
// it is used without a `client:*` directive and ships no JavaScript.
//
// `id` is required, unlike the design system's generated one: it is the anchor
// the Toc entry points at, and the build check of 7.11 compares ids, titles and
// order between the Toc and the sections of the page.
interface Props {
  /** Anchor id, the same as its Toc entry. The heading gets `${id}-t`. */
  id: string;
  /** Heading text. */
  title: ReactNode;
  /** 2 for a page section, 3 for a section inside another. Same look. */
  level?: 2 | 3;
  children?: ReactNode;
  /** Utilities added by the caller, after the component's own classes (3.8). */
  className?: string;
}

export function Section({ id, title, level = 2, children, className }: Props) {
  const Heading = level === 3 ? 'h3' : 'h2';
  return (
    <section
      id={id}
      aria-labelledby={`${id}-t`}
      className={className ? `ac-section ${className}` : 'ac-section'}
    >
      <div className="ac-section__head">
        <Heading id={`${id}-t`} className="ac-section__title">
          {title}
        </Heading>
        <div role="none" className="ac-section__rule" />
      </div>
      {children}
    </section>
  );
}
