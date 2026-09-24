import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

import { Glyph } from '@/components/icons/Glyph';

// MobileFilterSheet (plan «Dirección C», board Pokedex-movil): on a phone a filter's menu opens
// as a bottom sheet — a modal `dialog` docked to the bottom over the dimmed page, with the
// menu's head (name, counter, «Limpiar» and ×), its rule line, the menu itself stretched to the
// width, and a footer button with the list's count that closes it. Esc, the ×, the footer
// button and a tap on the dimmed page close it; the menu button takes the focus back.

export interface MobileFilterSheetProps {
  id: string;
  title: string;
  /** «2 de 2», or nothing. */
  counter?: string;
  hint?: string;
  /** «Limpiar», drawn while the filter has a value. */
  clear?: { label: string; onClear: () => void };
  /** «Cerrar filtros». */
  closeLabel: string;
  /** «Ver 37 variantes»; no footer without it. */
  show?: string;
  onClose: () => void;
  children: ReactNode;
}

export function MobileFilterSheet({
  id,
  title,
  counter,
  hint,
  clear,
  closeLabel,
  show,
  onClose,
  children,
}: MobileFilterSheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    const dialog = ref.current;
    if (dialog === null) return undefined;
    if (!dialog.open) dialog.showModal();
    dialog.querySelector<HTMLElement>('[role="option"][tabindex="0"]')?.focus();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      id={id}
      aria-label={title}
      className="ac-filter-sheet"
      onCancel={(event) => {
        event.preventDefault();
        closeRef.current();
      }}
      onClick={(event) => {
        // The dialog itself only receives the click on its backdrop.
        if (event.target === event.currentTarget) closeRef.current();
      }}
    >
      <div className="ac-filter-panel__head">
        <p className="ac-filter-panel__title">
          {title}
          {counter ? <span className="ac-filter-panel__counter">{counter}</span> : null}
        </p>
        <div className="ac-filter-sheet__actions">
          {clear ? (
            <button type="button" className="ac-filter-panel__clear" onClick={clear.onClear}>
              {clear.label}
            </button>
          ) : null}
          <button
            type="button"
            className="ac-filter-sheet__close"
            aria-label={closeLabel}
            onClick={() => closeRef.current()}
          >
            <Glyph name="close" size={16} />
          </button>
        </div>
      </div>
      {hint ? <p className="ac-filter-panel__hint">{hint}</p> : null}
      <div className="ac-filter-panel__body">{children}</div>
      {show ? (
        <div className="ac-filter-sheet__foot">
          <button
            type="button"
            className="ac-filter-sheet__show"
            onClick={() => closeRef.current()}
          >
            {show}
          </button>
        </div>
      ) : null}
    </dialog>
  );
}
