// The listbox helpers that `Select` and `Combobox` share (spec 7.2.2, 7.2.8, C-R2).
//
// Both lists are a `popover="manual"` that lives in the DOM next to its field and
// opens in the top layer, so no `overflow` of a filter bar, a card or a dialog can
// clip it. This module shows, hides and places such a list; it has no side effects
// of its own. `src/scripts/select.ts` imports it for the delegated `Select`
// controller and `src/components/controls/Combobox.tsx` imports it inside its
// island. `PageLayout` never imports it directly.
//
// @floating-ui/dom is loaded on the first open, not on every page (`floating.ts`,
// spec 13.6), so `anchorListbox` hides the list until its first placement lands.
//
// Placement is the one of spec 7.2.2: `bottom-start` under the field, flipped
// above it when there is no room below, never closer than 8 px to the edge of the
// window. The list takes the width of its field (the reference hangs it from the
// field with `left: 0; right: 0`), and it scrolls inside itself when it does not
// fit. What the stylesheets read, written here as the inline values C-R2 allows
// for a popover:
//
//   style.left, style.top      the coordinates of `computePosition` (fixed strategy)
//   --ac-listbox-width         the width of the field
//   --ac-listbox-room          the height left between the field and the edge
//
// Where `popover` is not supported (spec 6.5) the list is shown and hidden with
// `data-open` alone; `select.css` and `combobox.css` hide it behind
// `@supports not selector(:popover-open)` and show it again on that attribute.

import { anchor, hideUntilPlaced, shown, type Floating } from './floating';

/** `space-4` between the field and its list: `top: calc(100% + var(--space-4))` in the reference. */
const GAP = 4;
/** The 8 px a floating panel keeps from the edge of the window (7.5.5). */
const EDGE = 8;

const WIDTH = '--ac-listbox-width';
const ROOM = '--ac-listbox-room';

const supportsPopover = typeof HTMLElement !== 'undefined' && 'popover' in HTMLElement.prototype;

/** Opens `list`: `data-open` first, so the attribute and the open state never disagree. */
export function showListbox(list: HTMLElement): void {
  list.setAttribute('data-open', '');
  if (!supportsPopover || !list.hasAttribute('popover')) return;
  try {
    list.showPopover();
  } catch {
    // Already open, or not connected: `data-open` is enough either way.
  }
}

/** Closes `list` and forgets where it was placed. */
export function hideListbox(list: HTMLElement): void {
  list.removeAttribute('data-open');
  for (const property of ['left', 'top', WIDTH, ROOM]) list.style.removeProperty(property);
  shown(list);
  if (!supportsPopover || !list.hasAttribute('popover')) return;
  try {
    list.hidePopover();
  } catch {
    // Already closed.
  }
}

/**
 * Places `list` under `field` now and again on every scroll and resize, until the
 * returned function is called.
 */
export function anchorListbox(field: HTMLElement, list: HTMLElement): () => void {
  function place(floatingUi: Floating): void {
    // An island that repainted took the field or the list with it.
    if (!field.isConnected || !list.isConnected) return;
    const { computePosition, offset, flip, size, shift } = floatingUi;
    void computePosition(field, list, {
      strategy: 'fixed',
      placement: 'bottom-start',
      middleware: [
        offset(GAP),
        flip({ padding: EDGE }),
        size({
          padding: EDGE,
          apply({ rects, availableHeight }) {
            list.style.setProperty(WIDTH, `${Math.round(rects.reference.width)}px`);
            list.style.setProperty(ROOM, `${Math.max(0, Math.floor(availableHeight))}px`);
          },
        }),
        shift({ padding: EDGE }),
      ],
    }).then(({ x, y }) => {
      if (!list.hasAttribute('data-open')) return;
      list.style.left = `${Math.round(x)}px`;
      list.style.top = `${Math.round(y)}px`;
      shown(list);
    });
  }

  // Hidden until the first placement lands, so a list whose library is still on its way
  // never shows up centred in the window (`floating.ts`).
  hideUntilPlaced(list);
  return anchor(field, list, place);
}

/**
 * Scrolls `list` just enough to show `option` whole, for the keyboard: the pointer
 * never scrolls the list under itself. Only the list moves, never the page.
 *
 * Layout offsets, not client rects: the list may still be scaled by its entry
 * animation. The list is positioned, so it is the `offsetParent` of its options.
 */
export function revealOption(list: HTMLElement, option: HTMLElement): void {
  const inset = Number.parseFloat(getComputedStyle(list).paddingTop) || 0;
  const top = option.offsetTop - inset;
  const bottom = option.offsetTop + option.offsetHeight + inset;
  if (top < list.scrollTop) {
    list.scrollTop = top;
  } else if (bottom > list.scrollTop + list.clientHeight) {
    list.scrollTop = bottom - list.clientHeight;
  }
}
