import type { AnchorHTMLAttributes, HTMLAttributes, MouseEvent, ReactNode } from 'react';

// Pagination (spec 7.2.2, 7.7.3 H6, P-28; DS:Pagination): «Anterior», the page numbers and
// «Siguiente» inside a `nav`, with the current page filled in `bg-tertiary`. It shows the
// first page, the last one and a run of three around the current one; a longer jump is an
// ellipsis hidden from assistive technology.
//
// Every page is a real `<a href>` (P-28, WG5): `hrefFor` is required, so the links work with
// no JavaScript and «open in a new tab» lands on that page. Inside a list island the list
// controller passes `onPage` and intercepts the click (H6); a static page passes only
// `hrefFor` and the browser navigates.
//
// Every visible text arrives through props (DP1): the composer takes `labels` and
// `ariaLabel` from `ui.prev`, `ui.next`, `ui.page` and `ui.pagination`, never the design
// system's Spanish defaults.

export interface PaginationLabels {
  /** «Anterior» / «Previous» (`ui.prev`). */
  prev: string;
  /** «Siguiente» / «Next» (`ui.next`). */
  next: string;
  /**
   * Prefix of each number's accessible name, «Página 2» / «Page 2» (`ui.page`). An empty
   * string leaves the bare number as the name.
   */
  page: string;
}

export interface PaginationProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Current page, from 1. Clamped to 1…`pageCount`. */
  page: number;
  /** Number of pages. With one page or fewer nothing is rendered (spec 7.2.2). */
  pageCount: number;
  /** Canonical URL of page n (7.7.2): every page, «Anterior» and «Siguiente» is a link. */
  hrefFor: (n: number) => string;
  /**
   * Set by the list controller (7.7.3 H6): called with the page chosen on a plain primary
   * click, before navigation, so the controller can `preventDefault` and `pushState`. A
   * click with a modifier key never reaches it, which keeps «open in a new tab» working.
   */
  onPage?: (n: number, event: MouseEvent<HTMLAnchorElement>) => void;
  /** Text left of the pages, already formatted: «1 a 10 de 25 miembros» (§10). */
  summary?: ReactNode;
  labels: PaginationLabels;
  /** Name of the `nav` (`ui.pagination`, or a more specific one when a page has two). */
  ariaLabel: string;
  /** `center` centres the pages under a result list (Pokédex, §8). */
  align?: 'start' | 'center';
}

/** A page number, or the key of an ellipsis between two runs. */
export type PageItem = number | `gap-${number}`;

/**
 * First, last and a window of three around the current page, in order. A one-page hole
 * shows that page; a longer one, an ellipsis. Ported from `pageItems` of the reference
 * (`bundle.js`, Pagination).
 */
export function pageItems(page: number, count: number): PageItem[] {
  const set: number[] = [];
  const add = (n: number) => {
    if (n >= 1 && n <= count && !set.includes(n)) set.push(n);
  };
  const start = Math.max(1, Math.min(page - 1, count - 2));
  add(1);
  for (let n = start; n <= Math.min(count, start + 2); n += 1) add(n);
  add(count);
  set.sort((a, b) => a - b);

  const out: PageItem[] = [];
  set.forEach((n, index) => {
    const previous = set[index - 1];
    if (previous !== undefined && n - previous === 2) out.push(n - 1);
    else if (previous !== undefined && n - previous > 2) out.push(`gap-${index}`);
    out.push(n);
  });
  return out;
}

/** A click the browser should keep: another button, a modifier or a handled event. */
function isPlainClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return (
    !event.defaultPrevented &&
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

export function Pagination({
  page,
  pageCount,
  hrefFor,
  onPage,
  summary,
  labels,
  ariaLabel,
  align = 'start',
  className,
  style,
  ...rest
}: PaginationProps) {
  // A single page has nothing to choose: no control without an action (C-R5).
  const count = Math.floor(pageCount);
  if (!(count > 1)) return null;
  const current = Math.min(count, Math.max(1, Math.floor(page) || 1));

  const link = (
    n: number,
    linkClass: string,
    content: string,
    extra: AnchorHTMLAttributes<HTMLAnchorElement>,
  ) => (
    <a
      className={linkClass}
      {...extra}
      href={hrefFor(n)}
      onClick={
        onPage
          ? (event) => {
              if (isPlainClick(event)) onPage(n, event);
            }
          : undefined
      }
    >
      {content}
    </a>
  );

  // At either end the step stays in place, disabled, so the row does not shift (DS:Pagination).
  const step = (n: number, label: string, enabled: boolean) =>
    enabled ? (
      link(n, 'ac-pagination__step', label, { rel: n < current ? 'prev' : 'next' })
    ) : (
      <button type="button" className="ac-pagination__step" disabled>
        {label}
      </button>
    );

  const classes = ['ac-pagination'];
  if (align === 'center') classes.push('ac-pagination--center');
  if (summary != null) classes.push('ac-pagination--summary');
  if (className) classes.push(className);

  return (
    <div {...rest} className={classes.join(' ')} style={style}>
      {summary != null ? <p className="ac-pagination__summary">{summary}</p> : null}
      <nav className="ac-pagination__nav" aria-label={ariaLabel}>
        <ul className="ac-pagination__list">
          <li>{step(current - 1, labels.prev, current > 1)}</li>
          {pageItems(current, count).map((item) =>
            typeof item === 'string' ? (
              <li key={item} className="ac-pagination__gap" aria-hidden="true">
                …
              </li>
            ) : (
              <li key={item}>
                {link(item, 'ac-pagination__page', String(item), {
                  'aria-current': item === current ? 'page' : undefined,
                  'aria-label': labels.page ? `${labels.page} ${item}` : undefined,
                })}
              </li>
            ),
          )}
          <li>{step(current + 1, labels.next, current < count)}</li>
        </ul>
      </nav>
    </div>
  );
}
