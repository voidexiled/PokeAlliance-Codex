// The single delegated controller of the in-game tooltip (spec 7.5.4–7.5.7) and of
// the «+N» popovers that share its one-panel rule (7.5.8).
//
// `PageLayout` imports this module once, in its script block (7.3). There is no React
// here and nothing to hydrate: `NestedEntity` prints the panel in the HTML from the
// server, so `aria-describedby` always points at an element that exists and this file
// only opens, closes, pins and places what is already there. Every listener sits on
// `document` in the capture phase, so the cost on a page with no entity is a handful of
// listeners and no work.
//
// Markup it reads (7.5.1, 7.5.5, 7.6.4) — the other tracks of this milestone print it:
//
//   <span class="ac-nested-entity" data-ac-tt
//         data-ac-tt-placement="up|down|side|above-center|row"
//         data-ac-tt-align="auto|start|end|column">
//     <a href> | <button type="button">        ← the trigger, with aria-describedby
//     …<div role="tooltip" popover="manual" id>  ← the panel, a descendant of the wrapper
//   </span>
//
//   <tr data-ac-tt-row>                        ← a Lista row (TT10)
//   <button data-ac-plusn aria-expanded aria-controls> + <ul popover="manual"> sibling
//
// What it writes, and what the stylesheets of tracks D and E style:
//
//   panel[data-open]      while the panel is open — the entry animation and the
//                         `@supports not selector(:popover-open)` fallback hang off it
//   panel[data-pinned]    while Shift keeps it open
//   panel[data-side]      `top`, `bottom`, `left` or `right`: the final side, which the
//                         safe bridge of 7.5.6 uses to pick the edge it covers. The gap
//                         it has to cover is the placement's, and the placement is on
//                         the wrapper, so the bridge rule reads both.
//   panel[data-ac-tt-scroll]  while its content is taller than that `max-height`: the
//                         panel scrolls inside itself and drops the bridge (7.5.5)
//   panel.style           `inset`, `margin`, `left`, `top` (fixed strategy) and the
//                         `max-height` the `size` middleware computes
//
// The panel is a descendant of its wrapper, which is what makes the safe bridge work:
// a pointer that crosses the gap into the panel never leaves the wrapper, so TT2 never
// fires (7.5.6). The top layer takes the panel out of every `overflow` and every
// stacking context, so a scrolling table cannot clip it.

import type { Middleware, Placement, ReferenceElement } from '@floating-ui/dom';

import { anchor, type Floating } from './floating';

const WRAPPER = '[data-ac-tt]';
const PANEL = '[role="tooltip"]';
const ROW = 'tr[data-ac-tt-row]';
const PLUSN = '[data-ac-plusn]';
/** The card is the container that decides `align: auto` and owns the head zone. */
const CARD = 'article[data-anat]';
const HEAD = '[data-zone="head"]';
/** Fallback container for `align: auto` outside a card (7.5.5). */
const SCOPE = '[data-ac-tt-scope]';

/** TT2: the pointer has this long to come back to the trigger, the bridge or the panel. */
const CLOSE_MS = 100;
/** TT8: a lone Shift press pins or unpins when it is released within this time. */
const PIN_MS = 400;
/** Below this width the panel keeps 16 px from the edge and `side` opens below (7.5.5). */
const PHONE_BP = 768;
const EDGE = 8;
const EDGE_PHONE = 16;
/** A panel shorter than this scrolls inside instead of shrinking further (7.5.5). */
const MIN_HEIGHT = 120;
/** Written on a panel whose content is taller than the `max-height` of `size` (7.5.5). */
const SCROLL_ATTR = 'data-ac-tt-scroll';
/** `up`, `down` and `above-center`: 6 px from the trigger. */
const GAP_V = 6;
/** `side`: 8 px from the slot. */
const GAP_SIDE = 8;
/** `row`: 12 px from the name cell. */
const GAP_ROW = 12;
/** The panel edge sticks out 8 px past the trigger on the alignment axis. */
const OVERHANG = -8;

const supportsPopover = typeof HTMLElement !== 'undefined' && 'popover' in HTMLElement.prototype;

type Reason = 'hover' | 'focus' | 'tap' | 'row';
type Align = 'start' | 'end';

type Entry = {
  kind: 'tooltip' | 'plusn';
  /** `[data-ac-tt]` for a tooltip; the trigger's parent for a «+N». */
  wrapper: HTMLElement;
  trigger: HTMLElement;
  panel: HTMLElement;
  /** What the reference of `computePosition` is: the trigger, or the row's virtual box. */
  reference: ReferenceElement;
  reason: Reason;
  pinned: boolean;
  /** «+N» only: a click keeps it open after the pointer leaves (7.5.8). */
  sticky: boolean;
  /** The `tr[data-ac-tt-row]` that opened it, for TT10. */
  row: HTMLElement | null;
  /** Stops the `autoUpdate` loop. */
  stop: (() => void) | null;
  /** The pending TT2 close. */
  timer: number | null;
  /**
   * TT13: a scroll carried the wrapper away from a pointer that did not move. The panel
   * stays open, and the next real movement of the pointer decides whether it left.
   */
  displaced: boolean;
};

/** The open panels, keyed by panel: at most one unpinned and one pinned (TT9). */
const entries = new Map<HTMLElement, Entry>();
/** The panel opened last: the one a lone Shift press pins (TT8). */
let active: Entry | null = null;
/** The row the pointer is inside, so `pointerover` opens it once (TT10). */
let hoveredRow: HTMLElement | null = null;
/** Rows Escape closed: they stay shut until the pointer leaves and enters again (TT7). */
const suppressedRows = new WeakSet<HTMLElement>();
/** The Shift press being watched (TT8). */
let shiftPress: { time: number; clean: boolean } | null = null;
/** The wrapper the last touch went down on, and whether its panel was already open (TT5). */
let lastTouch: { wrapper: HTMLElement; wasOpen: boolean } | null = null;
/**
 * Where the last `pointermove` put the pointer. A browser fires `pointerout` and
 * `pointerover` when a scroll or a layout change moves the content under a still
 * pointer, and those carry the same coordinates as that last move; a pointer that
 * really left carries new ones, because the boundary events of a movement come before
 * its `pointermove`. That is how TT13 tells a scroll from TT2.
 */
let pointerAt: { x: number; y: number } | null = null;

// ------------------------------------------------------------------ small helpers

function asElement(value: EventTarget | null): Element | null {
  return value instanceof Element ? value : null;
}

function phone(): boolean {
  return window.innerWidth < PHONE_BP;
}

function edgePadding(): number {
  return phone() ? EDGE_PHONE : EDGE;
}

/** The side of a placement, which is what `data-side` carries. */
function sideOf(placement: Placement): string {
  return placement.replace(/-.*$/, '');
}

/**
 * TT8: a text field swallows Shift, so a press that starts there never pins. `input`
 * types that are buttons or sliders are not text, so they do not block it.
 */
function isEditable(node: Element | null): boolean {
  if (!(node instanceof HTMLElement)) return false;
  if (node.isContentEditable) return true;
  if (node instanceof HTMLTextAreaElement || node instanceof HTMLSelectElement) return true;
  if (!(node instanceof HTMLInputElement)) return false;
  const nonText = ['button', 'checkbox', 'radio', 'submit', 'reset', 'range', 'color', 'file'];
  return !nonText.includes(node.type.toLowerCase());
}

/** The trigger of a wrapper: the first real link or button that is not inside the panel. */
function triggerOf(wrapper: HTMLElement): HTMLElement | null {
  const candidates = wrapper.querySelectorAll<HTMLElement>('a[href], button');
  for (const candidate of candidates) {
    if (candidate.closest(PANEL) === null) return candidate;
  }
  return null;
}

function panelOf(wrapper: HTMLElement): HTMLElement | null {
  return wrapper.querySelector<HTMLElement>(PANEL);
}

/** The panel a «+N» button controls: its `aria-controls`, or the sibling popover. */
function plusPanelOf(trigger: HTMLElement): HTMLElement | null {
  const id = trigger.getAttribute('aria-controls');
  if (id !== null && id !== '') {
    const byId = document.getElementById(id);
    if (byId !== null) return byId;
  }
  const sibling = trigger.nextElementSibling;
  return sibling instanceof HTMLElement ? sibling : null;
}

function entryFor(wrapper: HTMLElement): Entry | null {
  for (const entry of entries.values()) {
    if (entry.kind === 'tooltip' && entry.wrapper === wrapper) return entry;
  }
  return null;
}

function plusEntryFor(trigger: HTMLElement): Entry | null {
  for (const entry of entries.values()) {
    if (entry.kind === 'plusn' && entry.trigger === trigger) return entry;
  }
  return null;
}

function entryForRow(row: HTMLElement): Entry | null {
  for (const entry of entries.values()) {
    if (entry.row === row) return entry;
  }
  return null;
}

/** A «+N» keeps its list outside the button, so both count as inside. */
function entryContains(entry: Entry, node: Element | null): boolean {
  if (node === null) return false;
  if (entry.kind === 'plusn') return entry.trigger.contains(node) || entry.panel.contains(node);
  return entry.wrapper.contains(node);
}

function isHovered(entry: Entry): boolean {
  try {
    return entry.wrapper.matches(':hover') || entry.panel.matches(':hover');
  } catch {
    return false;
  }
}

/**
 * TT3: keyboard focus holds a panel open after the pointer leaves; a focus left by a
 * click does not. Focus moved into the panel — a `<summary>` of a section — always does.
 */
function hasKeyboardFocus(entry: Entry): boolean {
  const focused = document.activeElement;
  if (!(focused instanceof HTMLElement) || !entry.wrapper.contains(focused)) return false;
  if (focused !== entry.trigger) return true;
  try {
    return entry.trigger.matches(':focus-visible');
  } catch {
    return false;
  }
}

// ------------------------------------------------------------- Poppins (spec 3.9)

let fontRequested = false;

/**
 * Asks for the two weights of the game font the first time an entity is about to show
 * its panel, so no page pays a preload it never uses (3.9, V3-6). Exported for the
 * Guild chart, whose bars draw the same panel without going through this controller.
 * A panel that opens before the file lands paints in Verdana and swaps.
 */
export function requestGameFont(): void {
  if (fontRequested) return;
  fontRequested = true;
  if (typeof document === 'undefined' || document.fonts === undefined) return;
  void document.fonts.load('600 12px Poppins');
  void document.fonts.load('500 12px Poppins');
}

function scheduleGameFont(): void {
  // Safari has no `requestIdleCallback`, hence the two second timer (3.9).
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(() => requestGameFont());
    return;
  }
  window.setTimeout(requestGameFont, 2000);
}

if (document.readyState === 'complete') scheduleGameFont();
else window.addEventListener('load', scheduleGameFont, { once: true });

// ------------------------------------------------------------- placement (7.5.5)

/**
 * `align: auto` anchors the panel to the half of its container the trigger sits in:
 * left half, left edge of the panel; right half, right edge. The container is the card,
 * then an explicit scope, then the window. `column` measures the card inside its grid
 * instead, which is what the two-column compact anatomy needs (7.6.4).
 */
function alignOf(entry: Entry): Align {
  const raw = declaredAlign(entry);
  if (raw === 'start' || raw === 'end') return raw;

  const card = entry.trigger.closest(CARD);
  if (raw === 'column' && card !== null) {
    const grid = gridOf(card);
    if (grid !== null) return halfOf(card.getBoundingClientRect(), grid.getBoundingClientRect());
  }

  const scope = card ?? entry.trigger.closest(SCOPE);
  const box = entry.trigger.getBoundingClientRect();
  if (scope === null) return box.left + box.width / 2 < window.innerWidth / 2 ? 'start' : 'end';
  return halfOf(box, scope.getBoundingClientRect());
}

function halfOf(box: DOMRect, container: DOMRect): Align {
  return box.left + box.width / 2 < container.left + container.width / 2 ? 'start' : 'end';
}

/** The nearest grid ancestor of a card, which is the `CardGrid` it belongs to. */
function gridOf(card: Element): Element | null {
  let node = card.parentElement;
  for (let depth = 0; node !== null && depth < 4; depth += 1) {
    if (window.getComputedStyle(node).display.includes('grid')) return node;
    node = node.parentElement;
  }
  return null;
}

/**
 * The compact anatomy sets `--ac-tt-align: column` on the card through a container
 * query, and a computed custom property wins over the attribute (7.6.4). Everything
 * else reads the attribute the component wrote.
 */
function declaredAlign(entry: Entry): string {
  const computed = window.getComputedStyle(entry.trigger).getPropertyValue('--ac-tt-align').trim();
  if (computed !== '') return computed;
  const written = attributeOf(entry, 'data-ac-tt-align');
  if (written !== null) return written;
  // A «+N» defaults to `up-left`, a nested entity to `up` with the half it sits in.
  return entry.kind === 'plusn' ? 'start' : 'auto';
}

function attributeOf(entry: Entry, name: string): string | null {
  return entry.trigger.getAttribute(name) ?? entry.wrapper.getAttribute(name);
}

type Positioning = { placement: Placement; middleware: Middleware[] };

function positioningOf(floatingUi: Floating, entry: Entry): Positioning {
  const { offset, shift, size } = floatingUi;
  const align = alignOf(entry);
  const padding = edgePadding();
  const overhang = offset({ mainAxis: GAP_V, alignmentAxis: OVERHANG });

  let placement: Placement;
  let distance: Middleware;
  let fallback: Placement[];
  /** `shift` may also move the panel across its side: only a row opening below does. */
  let crossAxis = false;

  switch (attributeOf(entry, 'data-ac-tt-placement')) {
    case 'down':
      placement = `bottom-${align}`;
      distance = overhang;
      fallback = [`top-${align}`];
      break;
    case 'side':
      // A slot opens at its side on a desktop and below it on a phone, where there is
      // no room beside a 44 px slot for a 282 px panel.
      if (phone()) {
        placement = 'bottom-start';
        distance = offset(GAP_SIDE);
        fallback = ['top-start'];
      } else {
        placement = 'right-start';
        distance = offset({ mainAxis: GAP_SIDE, alignmentAxis: OVERHANG });
        fallback = ['left-start'];
      }
      break;
    case 'above-center':
      placement = 'top';
      distance = offset(GAP_V);
      fallback = ['bottom'];
      break;
    case 'row':
      // Never to the left, where it would cover the sprite cell: the low rows change
      // alignment first and only a row with no room to its right opens below (7.5.5).
      // The room is measured here instead of left to `flip`: when neither the right nor
      // the space below fits — a phone, a low row — its best fit keeps a right placement
      // and `shift`, which only moves a right placement up or down, leaves the panel
      // hanging out of the window.
      distance = offset(GAP_ROW);
      if (hasRoomRight(entry, padding)) {
        placement = 'right-start';
        fallback = ['right-end'];
      } else {
        // Under the name cell. A low row — on a phone, the one the keyboard just scrolled
        // to the bottom edge — has no room below for the panel, so it opens above the row
        // instead: lifted over the row by `shift`, it would hide the name that has the
        // focus (S13, WCAG 2.4.11, D-018). Only when neither side fits does `shift` decide
        // the height (7.5.5) and keep the panel inside the window (S3).
        placement = 'bottom-start';
        fallback = ['top-start'];
        crossAxis = true;
      }
      break;
    default:
      placement = `top-${align}`;
      distance = overhang;
      fallback = [`bottom-${align}`];
  }

  return {
    placement,
    middleware: [
      distance,
      headAwareFlip(floatingUi, fallback, padding),
      avoidHead(padding),
      shift({ padding, crossAxis }),
      size({
        padding,
        apply({ availableHeight, elements }) {
          // A panel that does not fit scrolls inside instead of leaving the window
          // (7.5.5, S3), on every device. `data-ac-tt-scroll` marks the clamped one, and
          // `game-tooltip.css` / `plus-n.css` give it the `overflow-y` and the contained
          // overscroll. Only the clamped one: a scroll container clips the bridge that
          // hangs outside it (7.5.6), and a panel that fits keeps it. The content height
          // is read after the new `max-height`, so a window that grows back unmarks it.
          const floating = elements.floating;
          const height = Math.max(Math.round(availableHeight), MIN_HEIGHT);
          floating.style.maxHeight = `${height}px`;
          floating.toggleAttribute(SCROLL_ATTR, floating.scrollHeight > floating.clientHeight);
        },
      }),
    ],
  };
}

/** `row`: whether the panel fits between the name cell and the right edge of the window. */
function hasRoomRight(entry: Entry, padding: number): boolean {
  const cell = entry.reference.getBoundingClientRect();
  return cell.right + GAP_ROW + entry.panel.offsetWidth <= window.innerWidth - padding;
}

/**
 * `avoidHead` (7.5.5): a panel that would open over the head zone of its own card —
 * the sprite and the name the reader is pointing at — moves below it keeping its
 * alignment. It wins over `flip`, hence the guard in `headAwareFlip`.
 *
 * Unless there is no room below: a trigger at the bottom edge of the window — where the
 * browser leaves one that the keyboard just reached — has less than the smallest panel
 * `size` draws (`MIN_HEIGHT`) between it and the edge, and moving the panel there would
 * put it out of the window. S3 keeps every panel inside the window, so then the panel
 * stays above, over the head.
 *
 * Both coordinates are viewport ones: the strategy is `fixed` and the panel is in the
 * top layer, so `y` and `getBoundingClientRect()` share an origin.
 */
function avoidHead(padding: number): Middleware {
  return {
    name: 'acAvoidHead',
    fn(state) {
      if (state.middlewareData.acAvoidHead?.moved === true) return {};
      if (!state.placement.startsWith('top')) return {};

      const reference = state.elements.reference;
      const node = reference instanceof Element ? reference : (reference.contextElement ?? null);
      const card = node?.closest(CARD) ?? null;
      if (card === null) return {};
      const head = card.querySelector(HEAD);
      if (head === null) return {};
      if (state.y >= head.getBoundingClientRect().bottom) return {};

      const below = state.rects.reference.y + state.rects.reference.height + GAP_V;
      if (window.innerHeight - padding - below < MIN_HEIGHT) return {};

      const moved = state.placement.replace('top', 'bottom') as Placement;
      return { data: { moved: true }, reset: { placement: moved } };
    },
  };
}

/** `flip`, but it never undoes what `avoidHead` decided. */
function headAwareFlip(
  floatingUi: Floating,
  fallbackPlacements: Placement[],
  padding: number,
): Middleware {
  const inner = floatingUi.flip({ fallbackPlacements, padding });
  return {
    name: inner.name,
    options: inner.options,
    fn(state) {
      if (state.middlewareData.acAvoidHead?.moved === true) return {};
      return inner.fn(state);
    },
  };
}

/**
 * The reference of a Lista row: the x of the name cell and the y of the whole row, so
 * the panel lands 12 px to the right of the name and level with the row (7.5.5).
 */
function referenceOf(wrapper: HTMLElement, trigger: HTMLElement): ReferenceElement {
  if (wrapper.getAttribute('data-ac-tt-placement') !== 'row') return trigger;
  const row = wrapper.closest<HTMLElement>(ROW);
  if (row === null) return trigger;
  const cell = trigger.closest('td, th') ?? trigger;

  return {
    contextElement: cell,
    getBoundingClientRect() {
      const name = cell.getBoundingClientRect();
      const line = row.getBoundingClientRect();
      return {
        x: name.x,
        y: line.y,
        width: name.width,
        height: line.height,
        top: line.top,
        bottom: line.bottom,
        left: name.left,
        right: name.right,
      };
    },
  };
}

// --------------------------------------------------------------- open and close

function place(floatingUi: Floating, entry: Entry): void {
  // TT11: an island that repainted took its trigger with it.
  if (!entry.trigger.isConnected || !entry.panel.isConnected) {
    close(entry);
    return;
  }

  // The panel is put in the top layer here and not in `open`, because @floating-ui/dom
  // arrives on the first open of the session (`floating.ts`): a panel shown before it
  // would sit where the user-agent sheet puts a popover until the library answered.
  // From here on the window between the two is the microtask `computePosition` already
  // took, so nothing paints in between. The panel has to be laid out to be measured:
  // `positioningOf` reads its width (`hasRoomRight`) and `size` its content height.
  showPanel(entry.panel);

  const { placement, middleware } = positioningOf(floatingUi, entry);
  void floatingUi
    .computePosition(entry.reference, entry.panel, {
      strategy: 'fixed',
      placement,
      middleware,
    })
    .then((position) => {
      if (!entries.has(entry.panel)) return;
      const style = entry.panel.style;
      // The user-agent sheet centres a popover with `inset: 0` and `margin: auto`, which
      // would ignore these coordinates.
      style.inset = 'auto';
      style.margin = '0';
      style.left = `${Math.round(position.x)}px`;
      style.top = `${Math.round(position.y)}px`;
      entry.panel.setAttribute('data-side', sideOf(position.placement));
    });
}

/** Idempotent: `autoUpdate` calls `place` again on every scroll and resize. */
function showPanel(panel: HTMLElement): void {
  if (panel.hasAttribute('data-open')) return;
  panel.setAttribute('data-open', '');
  if (!supportsPopover || !panel.hasAttribute('popover')) return;
  try {
    panel.showPopover();
  } catch {
    // Already open, or the panel is not connected: `data-open` is enough either way.
  }
}

function hidePanel(panel: HTMLElement): void {
  panel.removeAttribute('data-open');
  panel.removeAttribute('data-pinned');
  panel.removeAttribute('data-side');
  panel.removeAttribute(SCROLL_ATTR);
  panel.style.removeProperty('inset');
  panel.style.removeProperty('margin');
  panel.style.removeProperty('left');
  panel.style.removeProperty('top');
  panel.style.removeProperty('max-height');
  if (!supportsPopover || !panel.hasAttribute('popover')) return;
  try {
    panel.hidePopover();
  } catch {
    // Already closed.
  }
}

/** TT9: opening anything closes every other panel that is not pinned. */
function closeOthers(keep: HTMLElement): void {
  for (const entry of [...entries.values()]) {
    if (entry.panel === keep || entry.pinned) continue;
    close(entry);
  }
}

function open(
  kind: Entry['kind'],
  wrapper: HTMLElement,
  trigger: HTMLElement,
  panel: HTMLElement,
  reason: Reason,
  row: HTMLElement | null,
): Entry | null {
  const existing = entries.get(panel);
  if (existing !== undefined) {
    cancelClose(existing);
    existing.displaced = false;
    if (row !== null) existing.row = row;
    return existing;
  }

  closeOthers(panel);

  const entry: Entry = {
    kind,
    wrapper,
    trigger,
    panel,
    reference: kind === 'tooltip' ? referenceOf(wrapper, trigger) : trigger,
    reason,
    pinned: false,
    sticky: false,
    row,
    stop: null,
    timer: null,
    displaced: false,
  };
  entries.set(panel, entry);

  if (kind === 'plusn') trigger.setAttribute('aria-expanded', 'true');
  // `anchor` shows and places the panel as soon as @floating-ui/dom is there, and places
  // it again on every scroll and resize (TT13, `floating.ts`, 13.6). A panel whose module
  // never arrives is closed rather than shown unplaced over the page; the next opening
  // asks for the module again.
  entry.stop = anchor(
    entry.reference,
    panel,
    (floatingUi) => place(floatingUi, entry),
    () => close(entry),
  );
  // A «+N» is not a game tooltip, so Shift has nothing to pin while one is the last open.
  active = kind === 'tooltip' ? entry : null;
  return entry;
}

function close(entry: Entry): void {
  cancelClose(entry);
  entry.stop?.();
  entry.stop = null;
  entry.pinned = false;
  entry.sticky = false;

  // Closing a panel that holds the focus — a `<summary>` of a section — would drop the
  // focus on the body; it belongs back on the trigger.
  const focused = document.activeElement;
  const returnFocus = focused instanceof HTMLElement && entry.panel.contains(focused);

  hidePanel(entry.panel);
  if (entry.kind === 'plusn') entry.trigger.setAttribute('aria-expanded', 'false');
  entries.delete(entry.panel);
  if (active === entry) active = null;
  if (returnFocus && entry.trigger.isConnected) entry.trigger.focus();
}

function closeAll(includePinned: boolean): void {
  for (const entry of [...entries.values()]) {
    if (!includePinned && entry.pinned) continue;
    close(entry);
  }
}

function cancelClose(entry: Entry): void {
  if (entry.timer === null) return;
  window.clearTimeout(entry.timer);
  entry.timer = null;
}

/** The pointer left: TT2 for a tooltip; a «+N» a click did not open closes at once (7.5.8). */
function leave(entry: Entry): void {
  if (entry.kind === 'plusn') {
    if (!entry.sticky) close(entry);
    return;
  }
  scheduleClose(entry);
}

/** TT2: the 100 ms that cover a pointer crossing a gap the bridge does not reach. */
function scheduleClose(entry: Entry): void {
  if (entry.pinned || hasKeyboardFocus(entry)) return;
  cancelClose(entry);
  entry.timer = window.setTimeout(() => {
    entry.timer = null;
    closeIfIdle(entry);
  }, CLOSE_MS);
}

function closeIfIdle(entry: Entry): void {
  if (entry.pinned || entry.sticky || hasKeyboardFocus(entry) || isHovered(entry)) return;
  // TT10: a panel the row opened belongs to the row, so walking off the name and onto
  // the next cell does not close it. Only leaving the row does, and that clears
  // `hoveredRow` before it asks. Opening another panel of the row still closes it,
  // because TT9 closes without asking.
  if (entry.reason === 'row' && entry.row !== null && entry.row === hoveredRow) return;
  close(entry);
}

/** TT8: Shift pins the panel it opened last, and unpins it on the next press. */
function togglePin(entry: Entry): void {
  if (entry.pinned) {
    entry.pinned = false;
    entry.panel.removeAttribute('data-pinned');
    closeIfIdle(entry);
    return;
  }
  // Only one pinned panel: the one that was pinned lets go and closes.
  for (const other of [...entries.values()]) {
    if (other !== entry && other.pinned) close(other);
  }
  entry.pinned = true;
  entry.panel.setAttribute('data-pinned', '');
}

// ----------------------------------------------------------------- open helpers

function openWrapper(wrapper: HTMLElement, reason: Reason, row: HTMLElement | null): Entry | null {
  const trigger = triggerOf(wrapper);
  const panel = panelOf(wrapper);
  // A mention with no registry entry prints no panel and opens nothing (R2).
  if (trigger === null || panel === null) return null;
  return open('tooltip', wrapper, trigger, panel, reason, row);
}

function openPlus(trigger: HTMLElement, sticky: boolean): Entry | null {
  const panel = plusPanelOf(trigger);
  if (panel === null) return null;
  const entry = open('plusn', trigger.parentElement ?? trigger, trigger, panel, 'hover', null);
  if (entry !== null && sticky) entry.sticky = true;
  return entry;
}

/** TT10: the row opens the panel of its name, which is the first entity inside it. */
function openRow(row: HTMLElement): void {
  const wrapper = row.querySelector<HTMLElement>(WRAPPER);
  if (wrapper === null) return;
  openWrapper(wrapper, 'row', row);
}

// ---------------------------------------------------------------------- pointer

/**
 * An event the browser did not send. React dispatches a copy of the `focusin` and
 * `pointerover` that reached an island before it hydrated, once it has (event replay), and
 * that copy is untrusted: it is not the pointer or the focus arriving now. Answering it
 * would reopen a panel Escape has just closed (TT7) or open one for a focus that has
 * already moved on.
 */
function replayed(event: Event): boolean {
  return !event.isTrusted;
}

document.addEventListener(
  'pointerover',
  (event) => {
    if (event.pointerType === 'touch' || replayed(event)) return;
    const target = asElement(event.target);
    if (target === null) return;
    const related = asElement(event.relatedTarget);

    const row = target.closest<HTMLElement>(ROW);
    if (row !== hoveredRow) {
      hoveredRow = row;
      // TT1 and TT10 both fire while the pointer walks into the name cell; they open
      // the same panel, so the second one only cancels the pending close.
      if (row !== null && !suppressedRows.has(row)) openRow(row);
    }

    // TT1 is the pointer *entering* the wrapper. `pointerover` also fires when it moves
    // between two elements inside it — the frame of a slot onto its sprite — and treating
    // that as an entry would reopen a panel Escape has just closed under a pointer that
    // never left (TT7, WCAG 1.4.13). A row Escape closed stays shut the same way until
    // the pointer leaves it (TT7).
    const wrapper = target.closest<HTMLElement>(WRAPPER);
    if (wrapper !== null && !wrapper.contains(related)) {
      requestGameFont();
      if (row === null || !suppressedRows.has(row)) openWrapper(wrapper, 'hover', row);
    }

    const plus = target.closest<HTMLElement>(PLUSN);
    if (plus !== null && !plus.contains(related)) openPlus(plus, false);
  },
  true,
);

document.addEventListener(
  'pointerout',
  (event) => {
    if (event.pointerType === 'touch') return;
    const target = asElement(event.target);
    const related = asElement(event.relatedTarget);
    if (target === null) return;

    const row = target.closest<HTMLElement>(ROW);
    if (row !== null && !row.contains(related)) {
      if (hoveredRow === row) hoveredRow = null;
      // The row can open again on the next entry, which is what TT7 waits for.
      suppressedRows.delete(row);
      const entry = entryForRow(row);
      if (entry !== null) closeIfIdle(entry);
    }

    // TT13: the content moved and the pointer did not, so nothing has left yet.
    const still =
      pointerAt !== null && event.clientX === pointerAt.x && event.clientY === pointerAt.y;

    for (const entry of [...entries.values()]) {
      if (!entryContains(entry, target) || entryContains(entry, related)) continue;
      if (still) {
        entry.displaced = true;
        continue;
      }
      leave(entry);
    }
  },
  true,
);

document.addEventListener(
  'pointermove',
  (event) => {
    if (event.pointerType === 'touch') return;
    // WebKit follows the boundary events of a scroll with a `pointermove` on the same
    // spot; only a move to a new position is the pointer moving.
    if (pointerAt !== null && event.clientX === pointerAt.x && event.clientY === pointerAt.y)
      return;
    pointerAt = { x: event.clientX, y: event.clientY };

    const target = asElement(event.target);
    for (const entry of [...entries.values()]) {
      if (!entry.displaced) continue;
      entry.displaced = false;
      if (!entryContains(entry, target)) leave(entry);
    }
  },
  { capture: true, passive: true },
);

document.addEventListener(
  'pointerdown',
  (event) => {
    // TT8: Shift + click never pins.
    if (shiftPress !== null) shiftPress.clean = false;

    const target = asElement(event.target);
    if (event.pointerType === 'touch') {
      const wrapper = target?.closest<HTMLElement>(WRAPPER) ?? null;
      lastTouch = wrapper === null ? null : { wrapper, wasOpen: entryFor(wrapper) !== null };
    } else {
      lastTouch = null;
    }

    // TT6: a press outside closes what is not pinned, and any «+N».
    for (const entry of [...entries.values()]) {
      if (entryContains(entry, target)) continue;
      if (entry.kind === 'plusn' || !entry.pinned) close(entry);
    }
  },
  true,
);

document.addEventListener(
  'click',
  (event) => {
    const target = asElement(event.target);
    if (target === null) return;

    const wrapper = target.closest<HTMLElement>(WRAPPER);
    if (wrapper !== null) {
      const touch = lastTouch;
      lastTouch = null;
      // TT5: on a touch screen the first tap opens the panel instead of following the
      // link; the second tap follows it, or closes a panel whose trigger is a button.
      if (touch === null || touch.wrapper !== wrapper) return;
      const trigger = triggerOf(wrapper);
      if (trigger === null || !trigger.contains(target)) return;
      if (!touch.wasOpen) {
        event.preventDefault();
        requestGameFont();
        openWrapper(wrapper, 'tap', wrapper.closest<HTMLElement>(ROW));
        return;
      }
      if (trigger.tagName === 'BUTTON') {
        const entry = entryFor(wrapper);
        if (entry !== null) close(entry);
      }
      return;
    }

    const plus = target.closest<HTMLElement>(PLUSN);
    if (plus === null) return;
    const current = plusEntryFor(plus);
    // A click on a list that a click opened closes it; otherwise it makes it stay.
    if (current !== null && current.sticky) close(current);
    else openPlus(plus, true);
  },
  true,
);

// --------------------------------------------------------------------- keyboard

document.addEventListener(
  'focusin',
  (event) => {
    if (replayed(event)) return;
    const target = asElement(event.target);
    if (target === null) return;

    const wrapper = target.closest<HTMLElement>(WRAPPER);
    if (wrapper !== null) {
      requestGameFont();
      // TT3: the trigger opens it; the focus moving on into the panel's sections does
      // not reopen anything, it only keeps the panel alive through `hasKeyboardFocus`.
      if (target === triggerOf(wrapper)) {
        openWrapper(wrapper, 'focus', wrapper.closest<HTMLElement>(ROW));
      }
    }

    const plus = target.closest<HTMLElement>(PLUSN);
    if (plus !== null) openPlus(plus, false);
  },
  true,
);

document.addEventListener(
  'focusout',
  (event) => {
    const target = asElement(event.target);
    const related = asElement(event.relatedTarget);
    if (target === null) return;

    // TT4: the focus left the wrapper for good.
    for (const entry of [...entries.values()]) {
      if (!entryContains(entry, target) || entryContains(entry, related)) continue;
      closeIfIdle(entry);
    }
  },
  true,
);

document.addEventListener(
  'keydown',
  (event) => {
    if (event.key === 'Escape') {
      // TT7: Escape closes everything, pinned panels included, and the row under the
      // pointer stays shut until the pointer leaves it and comes back.
      const focusedRow = asElement(document.activeElement)?.closest<HTMLElement>(ROW) ?? null;
      if (focusedRow !== null) suppressedRows.add(focusedRow);
      if (hoveredRow !== null) suppressedRows.add(hoveredRow);
      shiftPress = null;
      closeAll(true);
      return;
    }

    if (event.key === 'Shift') {
      // TT8: one press, not a key held down, and not from inside a text field.
      if (!event.repeat && shiftPress === null) {
        // The event's own time stamp, not `Date.now()`: the wall clock can be frozen or
        // moved (a test's fixed clock, a system clock change) and the press would then
        // measure 0 ms or a negative span however long Shift was held.
        shiftPress = { time: event.timeStamp, clean: !isEditable(document.activeElement) };
      }
      return;
    }

    // Shift + Tab, Shift + a letter: any other key voids the press.
    if (shiftPress !== null) shiftPress.clean = false;
  },
  true,
);

document.addEventListener(
  'keyup',
  (event) => {
    if (event.key !== 'Shift') return;
    const press = shiftPress;
    shiftPress = null;
    if (press === null || !press.clean) return;
    if (event.timeStamp - press.time > PIN_MS) return;
    if (isEditable(document.activeElement)) return;
    if (active === null || !entries.has(active.panel)) return;
    togglePin(active);
  },
  true,
);

// ------------------------------------------------------------------------ modals

// TT12: the search palette, the phone sheet and every `Dialog` announce themselves, and
// a tooltip left under a modal would sit over its veil.
document.addEventListener('ac:modal-open', () => closeAll(true), true);
