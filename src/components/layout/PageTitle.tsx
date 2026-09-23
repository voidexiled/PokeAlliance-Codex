import type { ReactNode } from 'react';

// PageTitle (spec 5.9, DS:PageTitle): the single h1 of a page, with an optional subtitle
// beside it — the translation of a system, «Boost (Potenciación)», or the Pokédex number,
// «Shiny Charizard Nº 6» — and its 1 px divider. TSX and not Astro because the Guild
// island repaints the h1 (C-R1, spec 10.5).
//
// The design system also accepts `children` as the title; the site keeps the one way in,
// `title`. Below 460 the subtitle is hidden by page-title.css.

interface PageTitleProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** 'en' or 'es' when the subtitle is not in the language of the page (spec 8.0.5, T22). */
  subtitleLang?: string;
  className?: string;
}

export function PageTitle({ title, subtitle, subtitleLang, className }: PageTitleProps) {
  return (
    <div className={className ? `ac-page-title ${className}` : 'ac-page-title'}>
      <div className="ac-page-title__row">
        <h1 className="ac-page-title__h1">{title}</h1>
        {subtitle ? (
          <p className="ac-page-title__sub" lang={subtitleLang}>
            {subtitle}
          </p>
        ) : null}
      </div>
      <div role="none" className="ac-page-title__rule"></div>
    </div>
  );
}
