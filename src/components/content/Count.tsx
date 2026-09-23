import type { HTMLAttributes, ReactNode } from 'react';

// Count (spec 7.2.3, 7.7.3 H5, 7.7.4 V6; DS:Count): the result count on the left of the
// bar above a list — «6 anuncios», «910 variantes», «6 drops». One per list, before the
// sort and view controls, and never repeated in the pagination.
//
// The caller writes the whole text, already pluralised and with its figures grouped
// (DP1, 13.3): no «Mostrando…», no «resultados encontrados». While `live` holds, the
// paragraph is an `aria-live="polite"` region, so a list island that re-renders the
// figure after a filter change is announced without moving the focus (H5).
//
// Props are the design system's; `style` is left out because inline style only carries
// values that depend on data (3.7), and a count has none. `aria-live` is `live`'s alone.

export interface CountProps extends Omit<
  HTMLAttributes<HTMLParagraphElement>,
  'children' | 'className' | 'style' | 'aria-live'
> {
  /** The count, pluralised by the caller: «1 anuncio», «6 anuncios», «384 Shiny». */
  children: ReactNode;
  /** `aria-live="polite"`. Default true; false for a count that never changes. */
  live?: boolean;
  /** Utilities added by the caller, after the component's class (3.8). */
  className?: string;
}

export function Count({ children, live = true, className, ...attributes }: CountProps) {
  return (
    <p
      {...attributes}
      className={className ? `ac-count ${className}` : 'ac-count'}
      aria-live={live ? 'polite' : undefined}
    >
      {children}
    </p>
  );
}
