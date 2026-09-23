// Placement and behaviour of the language list of `LanguageMenu` (spec 7.10.1).
//
// `PageLayout` imports this module once, in its script block (7.3). It works by
// delegation over the markup the component prints, so it serves the header list
// and the one inside the menu sheet with the same listeners, and it costs nothing
// on a page that has neither.
//
// What it does:
//
// - places the list against its trigger with @floating-ui/dom — `bottom-end` in
//   the header, `bottom-start` in the sheet — and follows it while it is open;
//   the library is loaded on the first open (`floating.ts`, 13.6);
// - keeps `aria-expanded` of the trigger in step with the list, which a
//   `popovertarget` button does not expose as an attribute of its own;
// - adds the `location.search` and `location.hash` of the current page to the
//   link that is clicked, so a language change keeps query and anchor (U3, 13.1).
//   The prerendered `href` stays the bare route, which is what works without
//   JavaScript;
// - opens and closes the list by hand where `popover` is not supported (6.5).
//   `language-menu.css` hides it behind `@supports not selector(:popover-open)`
//   and shows it again on `[data-ac-open]`, so nothing flashes before this runs.
//
// The two popover events do not bubble, so both listeners sit on the document in
// the capture phase, which a non-bubbling event still travels through. `<details>`
// fires `toggle` as well, hence the selector check on every handler.

import { anchor, hideUntilPlaced, shown, type Floating } from './floating';

const LIST = '.ac-language-menu';
const OPTION = '.ac-language-menu__option';
const TOUCH = 'ac-language-menu--touch';

/** `space-4` between the trigger and the list, as in the Select listbox. */
const GAP = 4;
/** The 8 px a floating panel keeps from the edge of the window (7.5.5). */
const EDGE = 8;

const supportsPopover = typeof HTMLElement !== 'undefined' && 'popover' in HTMLElement.prototype;

/** Stops the `autoUpdate` loop of a list that is open. */
const following = new WeakMap<HTMLElement, () => void>();
/** The `href` the page was rendered with, before a click appended the query. */
const baseHrefs = new WeakMap<HTMLAnchorElement, string>();

function asElement(value: EventTarget | null): Element | null {
  return value instanceof Element ? value : null;
}

function isList(value: EventTarget | null): value is HTMLElement {
  return value instanceof HTMLElement && value.matches(LIST);
}

/** The `<button popovertarget>` that opens this list. */
function triggerOf(list: HTMLElement): HTMLElement | null {
  if (list.id === '') return null;
  return document.querySelector<HTMLElement>(`[popovertarget="${CSS.escape(list.id)}"]`);
}

function place(floatingUi: Floating, trigger: HTMLElement, list: HTMLElement): void {
  const { computePosition, offset, flip, shift } = floatingUi;
  void computePosition(trigger, list, {
    // In the top layer the popover is `position: fixed`; measured as `absolute`, the
    // list lands off by the page scroll.
    strategy: getComputedStyle(list).position === 'fixed' ? 'fixed' : 'absolute',
    placement: list.classList.contains(TOUCH) ? 'bottom-start' : 'bottom-end',
    middleware: [offset(GAP), flip(), shift({ padding: EDGE })],
  }).then(({ x, y }) => {
    list.style.left = `${x}px`;
    list.style.top = `${y}px`;
    shown(list);
  });
}

function follow(list: HTMLElement): void {
  const trigger = triggerOf(list);
  if (trigger === null) return;
  unfollow(list);
  // `anchor` places the list as soon as the library is there and again on every scroll
  // or resize; until then the list stays hidden instead of centred.
  hideUntilPlaced(list);
  following.set(
    list,
    anchor(trigger, list, (floatingUi) => place(floatingUi, trigger, list)),
  );
}

function unfollow(list: HTMLElement): void {
  const stop = following.get(list);
  if (stop === undefined) return;
  stop();
  following.delete(list);
  shown(list);
}

function setExpanded(list: HTMLElement, open: boolean): void {
  triggerOf(list)?.setAttribute('aria-expanded', open ? 'true' : 'false');
}

// --------------------------------------------------------------- native popover

document.addEventListener(
  'beforetoggle',
  (event) => {
    const list = event.target;
    if (!isList(list)) return;
    // Placed before the list paints, so it never shows up centred first.
    if ((event as ToggleEvent).newState === 'open') follow(list);
  },
  true,
);

document.addEventListener(
  'toggle',
  (event) => {
    const list = event.target;
    if (!isList(list)) return;
    const open = (event as ToggleEvent).newState === 'open';
    if (!open) unfollow(list);
    setExpanded(list, open);
  },
  true,
);

// ------------------------------------------------------- language change (U3)

document.addEventListener('click', (event) => {
  const option = asElement(event.target)?.closest(OPTION);
  if (!(option instanceof HTMLAnchorElement)) return;
  let base = baseHrefs.get(option);
  if (base === undefined) {
    base = option.getAttribute('href') ?? '';
    baseHrefs.set(option, base);
  }
  option.setAttribute('href', base + window.location.search + window.location.hash);
});

// ------------------------------------------------------------------- fallback

function openList(list: HTMLElement): void {
  list.setAttribute('data-ac-open', '');
  follow(list);
  setExpanded(list, true);
}

function closeList(list: HTMLElement, focusTrigger = false): void {
  list.removeAttribute('data-ac-open');
  unfollow(list);
  setExpanded(list, false);
  if (focusTrigger) triggerOf(list)?.focus();
}

function openLists(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>(`${LIST}[data-ac-open]`)];
}

if (!supportsPopover) {
  document.addEventListener('click', (event) => {
    const target = asElement(event.target);
    const opener = target?.closest<HTMLElement>('[popovertarget]') ?? null;

    if (opener !== null) {
      const list = document.getElementById(opener.getAttribute('popovertarget') ?? '');
      if (list !== null && list.matches(LIST)) {
        event.preventDefault();
        if (list.hasAttribute('data-ac-open')) closeList(list);
        else openList(list);
        return;
      }
    }

    // Light dismiss: a click anywhere but inside an open list closes it.
    for (const list of openLists()) {
      if (target === null || !list.contains(target)) closeList(list);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    for (const list of openLists()) closeList(list, true);
  });
}
