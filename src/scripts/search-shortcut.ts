// Ctrl + K, ⌘ + K and clicks on a search trigger (spec 7.9.1, 7.9.2). PageLayout
// ships it as a plain module script on every page, so the shortcut and the
// trigger answer before React hydrates the palette island (`client:idle`).
//
// A request made too early is parked in `documentElement.dataset.acSearchPending`
// and src/components/search/SearchPalette.tsx picks it up when it mounts, which
// is what keeps a click before hydration from doing nothing (C7-11) and the
// trigger from being a fake control (S11, R12).
//
// The four names below are the contract between this script, the palette and
// `SearchTrigger` (spec 7.10.1); SearchPalette.tsx repeats them with the same
// comment. `data-ac-search-open` carries the variant of the trigger — 'header',
// 'home', 'mobile' or 'icon' — which the palette needs to place itself
// (spec 7.9.3): a request parked here before hydration reopens on the trigger of
// that variant, and the panel of an `icon` trigger is not the panel of a `header`
// one.

const OPEN_EVENT = 'ac:search-open';
const TRIGGER = '[data-ac-search-open]';
const READY = 'acSearch';
const PENDING = 'acSearchPending';

const root = document.documentElement;

/** `checkVisibility()` of spec 7.9.2, with the rectangle test where it is missing. */
function isVisible(element: HTMLElement): boolean {
  return typeof element.checkVisibility === 'function'
    ? element.checkVisibility()
    : element.getClientRects().length > 0;
}

/** The trigger the shortcut opens: the first visible one on the page. */
function visibleTrigger(): HTMLElement | null {
  for (const element of document.querySelectorAll<HTMLElement>(TRIGGER)) {
    if (isVisible(element)) return element;
  }
  return null;
}

/**
 * Asks for the palette. Mounted, it answers the event; not mounted yet, the
 * request waits in the dataset with the variant of the trigger that made it.
 */
function request(trigger: HTMLElement | null): void {
  if (root.dataset[READY] !== 'ready') {
    root.dataset[PENDING] = trigger?.dataset.acSearchOpen ?? '';
    return;
  }
  document.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { trigger } }));
}

document.addEventListener('click', (event) => {
  // A modified click on a trigger that is a link keeps its own meaning.
  if (event.defaultPrevented || event.button !== 0) return;
  if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;

  const target =
    event.target instanceof Element ? event.target.closest<HTMLElement>(TRIGGER) : null;
  if (!target) return;

  event.preventDefault();
  request(target);
});

document.addEventListener('keydown', (event) => {
  if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
  if (event.key.toLowerCase() !== 'k') return;

  // Spec 7.9.2: the shortcut only works where a trigger is visible. Without one
  // the browser keeps Ctrl + K for itself.
  const trigger = visibleTrigger();
  if (!trigger) return;

  event.preventDefault();
  // With the palette already open, the same combination closes it: the palette
  // treats the event as a toggle.
  request(trigger);
});
