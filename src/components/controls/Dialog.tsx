import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { flushSync } from 'react-dom';

import { Glyph } from '@/components/icons/Glyph';

// Dialog (spec 7.2.8, 3.8, E8): the modal of the site. The design system has no dialog,
// so this piece is composed only with its tokens, its text styles and the close button
// shape its containers already use (DS:Notice, DS:MobileMenu) — R16. Its users are the
// report dialog of Comercio (9.11), the confirmations of the account and of Guild (9.9,
// 10.4) and the member, import and goals dialogs of Guild (10.9–10.11).
//
// It is the native `<dialog>` opened with `showModal()`, never `<dialog open>`: the user
// agent traps the focus inside it, makes the rest of the page inert and turns Escape into
// the `cancel` event that closes it. What the element does not do on its own, this
// component adds:
//
// - the focus contract. When it opens, the focus goes to the element inside that carries
//   `data-ac-dialog-initial` (spread `initialFocus` on it); without one it stays where
//   `showModal()` puts it, the first focusable element, which is the close button of the
//   head. A confirmation marks its «Cancelar», so a stray Enter never confirms a deletion
//   (9.9, 10.4, CA-10.14). When it closes, the focus goes back to the element that had it
//   before it opened (13.7), if that element is still in the document. WebKit does not
//   focus a button on a click or a tap, so on Safari the trigger never had the focus: the
//   control pressed just before the dialog opened stands in for it;
// - the `ac:modal-open` notice (TT12): it bubbles from the dialog to the document, where
//   the game tooltip controller closes every panel, pinned ones included;
// - the close button, whose accessible name `closeLabel` is required and comes from
//   `ui.close` («Cerrar» / «Close»; U-01, DP1).
//
// A click on the veil does not close it. The spec gives the veil click to the search
// palette and to the phone sheet (7.9.2, 7.10.3), which only navigate; these dialogs hold
// forms — a report, an import, the goals — and a click that misses the panel would throw
// away what was typed. Escape and the close button are the ways out, plus whatever the
// island does with `open`.
//
// It is TSX and renders inside an island (7.2.8), which owns `open`. `onClose` runs after
// every close, whichever way it came, and must set `open` back to false: the dialog only
// reacts to `open` changing. The server markup is the closed dialog — `open` is never an
// attribute, because `<dialog open>` would be a non-modal panel with the page still live —
// and the island opens it once it hydrates.
//
// Why the close is watched on the `open` attribute and not on the `close` event: the
// event is queued as a task after the dialog has already closed, and the browser runs
// input first. A click or an Enter on the trigger that lands in between would find the
// island still believing the dialog open, and that open would be lost. The attribute
// changes in the same task that closes the dialog, its observer runs as a microtask
// before any other input, and `onClose` is flushed there, so the island's state is back
// to `false` before the next event.

/** TT12: a modal that opens closes every game tooltip, pinned ones included. */
const MODAL_OPEN_EVENT = 'ac:modal-open';

/** The attribute that names the element that takes the focus when the dialog opens. */
const INITIAL_FOCUS_ATTRIBUTE = 'data-ac-dialog-initial';

/** What a press on the page counts as when it stands in for the trigger. */
const PRESSABLE = 'button, a[href], [role="button"], summary';

/**
 * How long a press may precede the opening and still count as its trigger. The island
 * opens the dialog in the render that follows the click, well inside this.
 */
const PRESS_WINDOW_MS = 1000;

/**
 * Spread on the element that takes the focus when the dialog opens:
 * `<Button {...initialFocus} onClick={cancel}>{messages.cancel}</Button>`. Every
 * confirmation puts it on «Cancelar» (9.9, 10.4).
 */
export const initialFocus = { [INITIAL_FOCUS_ATTRIBUTE]: '' } as const;

export interface DialogProps {
  /** Shown or not. The island owns it; `onClose` must set it back to `false`. */
  open: boolean;
  /**
   * Runs once the dialog has closed, whatever closed it: Escape, the close button, or
   * `open` turning `false`. The island resets its state here (a «Cancelar» that reverts).
   */
  onClose: () => void;
  /** The h2 of the panel, which also names the dialog. From the page's dictionary. */
  title: string;
  /** Accessible name of the close button, from `ui.close`: «Cerrar» / «Close» (U-01). */
  closeLabel: string;
  /**
   * A confirmation (9.9, 10.4): `role="alertdialog"`, described by its body. Mark its
   * «Cancelar» with `initialFocus`.
   */
  alert?: boolean;
  /** The buttons at the foot of the panel, in reading order. */
  actions?: ReactNode;
  /** A fixed id, when a trigger needs it for `aria-controls` (C-R4). */
  id?: string;
  /** Utilities added by the caller, after the component's class (3.8). */
  className?: string;
  /** The body: text, fields, a `Notice` with the error of the operation (10.4). */
  children?: ReactNode;
}

export function Dialog({
  open,
  onClose,
  title,
  closeLabel,
  alert = false,
  actions,
  id,
  className,
  children,
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  /** The element that had the focus before the dialog opened (13.7). */
  const returnFocusRef = useRef<HTMLElement | null>(null);
  /** The last control pressed on the page and when: the trigger where WebKit gave it no focus. */
  const pressedRef = useRef<{ element: HTMLElement; at: number } | null>(null);
  /** The latest `onClose`, read by the observer that lives as long as the dialog. */
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Every way out ends here: Escape, the close button, `open` turning false.
  useEffect(() => {
    function remember(event: Event) {
      const target = event.target instanceof Element ? event.target.closest(PRESSABLE) : null;
      if (target instanceof HTMLElement && !dialogRef.current?.contains(target)) {
        pressedRef.current = { element: target, at: event.timeStamp };
      }
    }
    document.addEventListener('click', remember, true);
    return () => document.removeEventListener('click', remember, true);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return undefined;

    const observer = new MutationObserver(() => {
      // The records of one task arrive together, and only where they left the dialog
      // counts: a close followed by a new open in the same task is no close at all.
      if (dialog.open) return;
      const target = returnFocusRef.current;
      returnFocusRef.current = null;
      if (target?.isConnected) target.focus();
      flushSync(() => onCloseRef.current());
    });
    observer.observe(dialog, { attributes: true, attributeFilter: ['open'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;

    if (!open) {
      if (dialog.open) dialog.close();
      return;
    }
    if (dialog.open) return;

    const focused = document.activeElement;
    const pressed = pressedRef.current;
    const recent = pressed !== null && performance.now() - pressed.at < PRESS_WINDOW_MS;
    returnFocusRef.current =
      focused instanceof HTMLElement && focused !== document.body
        ? focused
        : recent
          ? pressed.element
          : null;

    dialog.showModal();
    dialog.querySelector<HTMLElement>(`[${INITIAL_FOCUS_ATTRIBUTE}]`)?.focus();
    dialog.dispatchEvent(new CustomEvent(MODAL_OPEN_EVENT, { bubbles: true }));
  }, [open]);

  const hasBody = children !== undefined && children !== null && children !== false;

  return (
    <dialog
      ref={dialogRef}
      id={id}
      className={className ? `ac-dialog ${className}` : 'ac-dialog'}
      role={alert ? 'alertdialog' : undefined}
      aria-labelledby={titleId}
      aria-describedby={alert && hasBody ? bodyId : undefined}
    >
      <div className="ac-dialog__head">
        <h2 id={titleId} className="ac-dialog__title">
          {title}
        </h2>
        <button
          type="button"
          className="ac-dialog__close"
          aria-label={closeLabel}
          onClick={() => dialogRef.current?.close()}
        >
          <Glyph name="close" size={14} />
        </button>
      </div>
      {hasBody ? (
        <div id={bodyId} className="ac-dialog__body">
          {children}
        </div>
      ) : null}
      {actions ? <div className="ac-dialog__actions">{actions}</div> : null}
    </dialog>
  );
}
