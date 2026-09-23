import type { HTMLAttributes, ReactNode } from 'react';

// EmptyState (spec 7.2.3, 7.7.4 V7, 8.0.5; DS:EmptyState): one plain line in
// `text-secondary` when a list has nothing to show — «Sin resultados para «zzzz».» — with
// no card, illustration, icon or cheering copy. When one action fills the list («Importar»,
// «Limpiar filtros»), it shares the row on the right.
//
// Markup of the reference (`bundle.js` EmptyState): the line alone is a `<p>`; with an
// action it is a flex row with the line in `ac-empty-state__text` and the action in
// `ac-empty-state__action`. The line is inline content, since it is always drawn inside a
// `<p>`. It is never a heading (spec 12.6, C-05).
//
// The caller writes the line (DP1) and passes the action as a `Button` or a link only when
// it really fills the list (C-R5); an action that does nothing is not rendered.

export interface EmptyStateProps extends Omit<
  HTMLAttributes<HTMLElement>,
  'children' | 'className' | 'style'
> {
  /** The line, inline content only, with the query in angle quotes. */
  children: ReactNode;
  /** The one action that fills the list: a `Button` («Importar») or its link form. */
  action?: ReactNode;
  /** Utilities added by the caller, after the component's classes (3.8). */
  className?: string;
}

export function EmptyState({ children, action, className, ...attributes }: EmptyStateProps) {
  if (!action) {
    return (
      <p {...attributes} className={className ? `ac-empty-state ${className}` : 'ac-empty-state'}>
        {children}
      </p>
    );
  }

  const classes = ['ac-empty-state', 'ac-empty-state--action'];
  if (className) classes.push(className);
  return (
    <div {...attributes} className={classes.join(' ')}>
      <p className="ac-empty-state__text">{children}</p>
      <div className="ac-empty-state__action">{action}</div>
    </div>
  );
}
