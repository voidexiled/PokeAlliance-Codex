import { useState } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';

import { Glyph } from '@/components/icons/Glyph';

// Notice (spec 7.2.3; DS:Notice): the one-line status that confirms what the user just did
// — «Anuncio copiado.», «Importados: 17/09, 18/09.» — with its close button. It is a
// `role="status"` region, so a screen reader reads it without the focus moving. It sits in
// the flow of the page, above or below the block that changed; it never floats and never
// goes away on its own.
//
// It keeps the reference's state: uncontrolled it hides itself when closed, controlled it
// shows while `open` is true and `onClose` decides. Closing needs React in the client, so a
// Notice lives inside an island (Comercio, Guild, the account; §9, §10): rendered as static
// HTML its button would do nothing, which S11 forbids. When the button had the focus, the
// caller's `onClose` moves it back to the control the notice came from (DS:Notice).
//
// DP5: `defaultOpen` is a preview prop of the design system and is not implemented; an
// uncontrolled notice starts open. DP1: `closeLabel` is required and comes from `ui`
// («Cerrar aviso» / «Dismiss»), so the Spanish default of the reference never reaches the
// `en` markup.
//
// The cross is the 14 px `close` glyph (C-R7), the only SVG a component may draw.

export interface NoticeProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'children' | 'className' | 'style' | 'role'
> {
  /** The message, inline content only: it is drawn inside a `<p>`. */
  children: ReactNode;
  /** Controlled visibility. Omitted, the notice starts open and closes itself. */
  open?: boolean;
  /** Called when the close button is pressed. */
  onClose?: () => void;
  /** Accessible name of the close button, from `ui`: «Cerrar aviso» / «Dismiss». */
  closeLabel: string;
  /** Utilities added by the caller, after the component's class (3.8). */
  className?: string;
}

export function Notice({
  children,
  open,
  onClose,
  closeLabel,
  className,
  ...attributes
}: NoticeProps) {
  const [shown, setShown] = useState(true);
  const controlled = open !== undefined;
  if (!(controlled ? open : shown)) return null;

  function close() {
    if (!controlled) setShown(false);
    onClose?.();
  }

  return (
    <div
      {...attributes}
      role="status"
      className={className ? `ac-notice ${className}` : 'ac-notice'}
    >
      <p className="ac-notice__text">{children}</p>
      <button type="button" className="ac-notice__close" aria-label={closeLabel} onClick={close}>
        <Glyph name="close" size={14} />
      </button>
    </div>
  );
}
