// @floating-ui/dom, loaded on the first open instead of on every page (spec 13.6).
//
// Three delegated controllers place a floating element: the game tooltip
// (`game-tooltip.ts`), the language list (`popover-anchor.ts`) and the listbox of
// `Select` and `Combobox` (`listbox.ts`). All three run on every page from the
// script block of `PageLayout` (7.3), and all three do nothing at all until the
// reader hovers, focuses or clicks something. A static import of the library put
// its two chunks — 5.972 B and 1.052 B gzip — in the initial JS of every page, a
// seventh of what the «lista» budget of §13.6 leaves for the islands, for code no
// first paint runs.
//
// So the library is imported the first time a panel opens and shared from then on:
// one fetch per session, and every later placement resolves as fast as it did when
// the import was static. `computePosition` was already a promise, so nothing here
// turns synchronous placement into asynchronous placement; what changes is that the
// very first one also waits for the module.
//
// A panel that is open but not yet placed would sit where the user-agent sheet puts
// a popover — centred in the window — so the controllers hide it until the first
// placement lands (`hideUntilPlaced` / `shown`). The attribute-driven states of the
// stylesheets are untouched: this is an inline `visibility`, the panel keeps its box
// (the `size` middleware measures it) and the reader never sees the centred frame.
//
// A module loaded on demand can fail to arrive, which a static import never did once the
// page had loaded: the reader went offline, or a deploy replaced the chunk. Then a list
// shows unplaced instead of staying open and invisible, and a game tooltip closes
// (`anchor`). The next open asks for the module again (`loadFloating`); a browser that
// remembers the failed module answers that at once, and the same fallback runs.

import type * as FloatingUiDom from '@floating-ui/dom';
import type { ReferenceElement } from '@floating-ui/dom';

/** The library, once loaded. */
export type Floating = typeof FloatingUiDom;

let pending: Promise<Floating> | null = null;

/**
 * Loads @floating-ui/dom once; every later call gets the same promise. A load that failed
 * is not kept, so the next open asks for the module again.
 */
export function loadFloating(): Promise<Floating> {
  pending ??= import('@floating-ui/dom').catch((error: unknown) => {
    pending = null;
    throw error;
  });
  return pending;
}

/**
 * `autoUpdate` over the library loaded on demand: `place` runs as soon as the module
 * arrives and again on every scroll and resize of the reference, until the returned
 * function is called. Calling it before the module arrives cancels the placement, so a
 * panel closed in that window never starts a loop that would outlive it.
 *
 * When the module does not arrive, `failed` runs instead. By default the panel is shown
 * unplaced, where its stylesheet puts it: an open list the reader cannot see would be a
 * control that does nothing (S11).
 */
export function anchor(
  reference: ReferenceElement,
  floating: HTMLElement,
  place: (floatingUi: Floating) => void,
  failed: () => void = () => shown(floating),
): () => void {
  let stop: (() => void) | null = null;
  let cancelled = false;
  void loadFloating().then(
    (floatingUi) => {
      if (cancelled) return;
      stop = floatingUi.autoUpdate(reference, floating, () => place(floatingUi));
    },
    () => {
      if (!cancelled) failed();
    },
  );
  return () => {
    cancelled = true;
    stop?.();
    stop = null;
  };
}

/** Hides a panel that is open but not placed yet, so it never shows up centred. */
export function hideUntilPlaced(floating: HTMLElement): void {
  floating.style.visibility = 'hidden';
}

/** Shows a panel whose placement has landed. */
export function shown(floating: HTMLElement): void {
  floating.style.removeProperty('visibility');
}
