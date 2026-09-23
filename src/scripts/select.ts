// The delegated controller of `Select` and `SortSelect` (spec 7.2.2, C-R2; DS:Select).
//
// `PageLayout` imports this module once, in its script block (7.3). There is no React
// here and nothing to hydrate: `Select.tsx` prints the trigger and the whole listbox in
// the HTML, and this file opens, closes, places and works them. Every listener sits on
// `document`, so a page with no Select pays a handful of listeners and no work, and the
// markup an island paints is served the same way as the static one.
//
// Markup it reads (Select.tsx):
//
//   <div class="ac-select" data-ac-select>
//     <p class="ac-select__label">                      ← or `sr-only`
//     <div class="ac-select__control">
//       <button class="ac-select__trigger" role="combobox" aria-expanded aria-controls>
//         <span class="ac-select__value">  <svg class="ac-select__chevron">
//       <ul class="ac-select__listbox" role="listbox" popover="manual">
//         <li class="ac-select__option" role="option" aria-selected data-value> … check
//
// What it writes:
//
//   trigger[aria-expanded]           `true` while the list is open
//   trigger[aria-activedescendant]   the id of the active option while the list is open
//   option[data-active="true"]       the active option: pointer and keyboard are one state
//   list[data-open], list.style      through src/scripts/listbox.ts
//
// Behaviour of the reference (`bundle.js` Select, DS:Select §Estados):
//
// - A click opens with no active option until the pointer rests on one; the keyboard
//   (↓, ↑, Intro, Espacio) opens on the chosen one, Inicio and Fin on the first and the
//   last, and a letter on the next option that starts with it.
// - Open: ↓ ↑ Inicio Fin RePág AvPág move the active option; Intro or Espacio choose it
//   (with none active they close); Escape closes; Tab closes and lets the focus go; a
//   letter moves to the next match, and letters typed within 500 ms search together.
// - The focus stays on the trigger: a press inside the list never takes it.
// - A press outside the control closes without choosing. So does a modal that opens
//   elsewhere (`ac:modal-open`, TT12).
//
// Choosing dispatches `ac:select-change` on the root, cancelable. A `Select` rendered by
// an island cancels it and updates itself through React; when nobody cancels it (a
// static page) this file moves `aria-selected`, the text of the trigger and the check.
// Either way it closes the list and puts the focus back on the trigger.

import { anchorListbox, hideListbox, revealOption, showListbox } from './listbox';

const ROOT = '[data-ac-select]';
const TRIGGER = '.ac-select__trigger';
const LIST = '.ac-select__listbox';
const OPTION = '.ac-select__option';
const VALUE = '.ac-select__value';
const CHECK = '.ac-select__check';
const PLACEHOLDER = 'ac-select__value--placeholder';

/**
 * Contract with src/components/controls/Select.tsx, which listens for this event on the
 * root. The component repeats the name and the detail with the same comment.
 */
const CHANGE_EVENT = 'ac:select-change';

interface SelectChangeDetail {
  value: string;
  index: number;
}

/** Letters typed within this time search together (DS:Select, the reference). */
const TYPEAHEAD_MS = 500;

interface Parts {
  root: HTMLElement;
  trigger: HTMLButtonElement;
  list: HTMLElement;
  options: HTMLElement[];
}

interface State {
  /** The active option, -1 for none. */
  active: number;
  typed: string;
  typedAt: number;
  /** Stops the `autoUpdate` loop of an open list. */
  stop: (() => void) | null;
}

const states = new WeakMap<HTMLElement, State>();
/** The roots whose list is open. */
const open = new Set<HTMLElement>();

function stateOf(root: HTMLElement): State {
  let state = states.get(root);
  if (state === undefined) {
    state = { active: -1, typed: '', typedAt: 0, stop: null };
    states.set(root, state);
  }
  return state;
}

/** The parts of a root, read again on every event: an island may have repainted them. */
function partsOf(root: HTMLElement): Parts | null {
  const trigger = root.querySelector<HTMLButtonElement>(TRIGGER);
  const list = root.querySelector<HTMLElement>(LIST);
  if (trigger === null || list === null) return null;
  return { root, trigger, list, options: [...list.querySelectorAll<HTMLElement>(OPTION)] };
}

function partsAt(target: EventTarget | null, part: string): Parts | null {
  if (!(target instanceof Element)) return null;
  const element = target.closest(part);
  const root = element?.closest<HTMLElement>(ROOT) ?? null;
  return root === null ? null : partsOf(root);
}

function isOpen(parts: Parts): boolean {
  return open.has(parts.root) && parts.list.hasAttribute('data-open');
}

function labelOf(option: HTMLElement): string {
  return (option.textContent ?? '').trim();
}

function selectedIndex(parts: Parts): number {
  return parts.options.findIndex((option) => option.getAttribute('aria-selected') === 'true');
}

function setActive(parts: Parts, index: number, reveal: boolean): void {
  stateOf(parts.root).active = index;
  parts.options.forEach((option, n) => {
    if (n === index) option.setAttribute('data-active', 'true');
    else option.removeAttribute('data-active');
  });
  const option = parts.options[index];
  if (option === undefined) {
    parts.trigger.removeAttribute('aria-activedescendant');
    return;
  }
  parts.trigger.setAttribute('aria-activedescendant', option.id);
  if (reveal) revealOption(parts.list, option);
}

function openAt(parts: Parts, index: number): void {
  const last = parts.options.length - 1;
  const target = index < 0 ? -1 : Math.max(0, Math.min(last, index));
  if (isOpen(parts)) {
    setActive(parts, target, true);
    return;
  }
  const state = stateOf(parts.root);
  open.add(parts.root);
  showListbox(parts.list);
  parts.trigger.setAttribute('aria-expanded', 'true');
  state.stop?.();
  state.stop = anchorListbox(parts.trigger, parts.list);
  setActive(parts, target, false);
  // The list has its height once it is placed, just before the next paint.
  if (target >= 0) {
    requestAnimationFrame(() => {
      const option = parts.options[target];
      if (option !== undefined && isOpen(parts)) revealOption(parts.list, option);
    });
  }
}

function close(root: HTMLElement, focusTrigger: boolean): void {
  open.delete(root);
  const state = stateOf(root);
  state.stop?.();
  state.stop = null;
  const parts = partsOf(root);
  if (parts === null) return;
  hideListbox(parts.list);
  parts.trigger.setAttribute('aria-expanded', 'false');
  setActive(parts, -1, false);
  if (focusTrigger && parts.trigger.isConnected) parts.trigger.focus();
}

/** A static page: nobody owns the selection, so it moves in the DOM. */
function applySelection(parts: Parts, index: number): void {
  const option = parts.options[index];
  if (option === undefined) return;
  parts.options.forEach((candidate, n) => {
    candidate.setAttribute('aria-selected', n === index ? 'true' : 'false');
  });
  const check = parts.list.querySelector(CHECK);
  if (check !== null) option.append(check);
  const value = parts.trigger.querySelector(VALUE);
  if (value !== null) {
    value.textContent = labelOf(option);
    value.classList.remove(PLACEHOLDER);
  }
}

function choose(parts: Parts, index: number): void {
  const option = parts.options[index];
  if (option === undefined) return;
  if (index !== selectedIndex(parts)) {
    const detail: SelectChangeDetail = { value: option.getAttribute('data-value') ?? '', index };
    const event = new CustomEvent<SelectChangeDetail>(CHANGE_EVENT, {
      bubbles: true,
      cancelable: true,
      detail,
    });
    // `false` when an island cancelled it: React owns the selection.
    if (parts.root.dispatchEvent(event)) applySelection(parts, index);
  }
  close(parts.root, true);
}

/** The option a typed letter leads to, or -1. */
function typeahead(parts: Parts, key: string): number {
  const state = stateOf(parts.root);
  const now = Date.now();
  state.typed = now - state.typedAt > TYPEAHEAD_MS ? key : state.typed + key;
  state.typedAt = now;
  const query = state.typed.toLowerCase();
  const count = parts.options.length;
  const start = isOpen(parts) && state.active >= 0 ? state.active : selectedIndex(parts);
  // A repeated or growing query keeps matching from the current option; a new letter
  // starts after it.
  const shift = state.typed.length > 1 ? 0 : 1;
  for (let n = 0; n < count; n += 1) {
    const index = (((start + shift + n) % count) + count) % count;
    const option = parts.options[index];
    if (option !== undefined && labelOf(option).toLowerCase().startsWith(query)) return index;
  }
  return -1;
}

function isLetter(event: KeyboardEvent): boolean {
  return event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;
}

// ------------------------------------------------------------------------ keyboard

document.addEventListener('keydown', (event) => {
  const parts = partsAt(event.target, TRIGGER);
  if (parts === null || parts.trigger.disabled || event.isComposing) return;
  const last = parts.options.length - 1;
  const selected = selectedIndex(parts);
  const current = selected >= 0 ? selected : 0;

  if (!isOpen(parts)) {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
      event.preventDefault();
      openAt(parts, current);
    } else if (event.key === 'Home') {
      event.preventDefault();
      openAt(parts, 0);
    } else if (event.key === 'End') {
      event.preventDefault();
      openAt(parts, last);
    } else if (isLetter(event)) {
      const found = typeahead(parts, event.key);
      if (found >= 0) {
        event.preventDefault();
        openAt(parts, found);
      }
    }
    return;
  }

  const active = stateOf(parts.root).active;
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      setActive(parts, active < 0 ? current : Math.min(last, active + 1), true);
      break;
    case 'ArrowUp':
      event.preventDefault();
      setActive(parts, active < 0 ? current : Math.max(0, active - 1), true);
      break;
    case 'Home':
    case 'PageUp':
      event.preventDefault();
      setActive(parts, 0, true);
      break;
    case 'End':
    case 'PageDown':
      event.preventDefault();
      setActive(parts, last, true);
      break;
    case 'Enter':
    case ' ':
      event.preventDefault();
      if (active >= 0) choose(parts, active);
      else close(parts.root, false);
      break;
    case 'Escape':
      event.preventDefault();
      close(parts.root, false);
      break;
    case 'Tab':
      close(parts.root, false);
      break;
    default:
      if (isLetter(event)) {
        const found = typeahead(parts, event.key);
        if (found >= 0) {
          event.preventDefault();
          setActive(parts, found, true);
        }
      }
  }
});

// A button activates on the release of Space: the press already opened or chose.
document.addEventListener('keyup', (event) => {
  if (event.key !== ' ') return;
  if (partsAt(event.target, TRIGGER) !== null) event.preventDefault();
});

// ------------------------------------------------------------------------- pointer

document.addEventListener('click', (event) => {
  const option = event.target instanceof Element ? event.target.closest(OPTION) : null;
  if (option !== null) {
    const parts = partsAt(option, OPTION);
    if (parts === null || !isOpen(parts)) return;
    choose(parts, parts.options.indexOf(option as HTMLElement));
    return;
  }

  const parts = partsAt(event.target, TRIGGER);
  if (parts === null || parts.trigger.disabled) return;
  if (isOpen(parts)) {
    close(parts.root, false);
    return;
  }
  // WebKit does not focus a button on click; the keyboard needs the focus here.
  if (document.activeElement !== parts.trigger) parts.trigger.focus({ preventScroll: true });
  openAt(parts, -1);
});

// The pointer moves the active option; the list never scrolls under it.
document.addEventListener('pointermove', (event) => {
  const parts = partsAt(event.target, OPTION);
  if (parts === null || !isOpen(parts)) return;
  const option = (event.target as Element).closest<HTMLElement>(OPTION);
  const index = option === null ? -1 : parts.options.indexOf(option);
  if (index >= 0 && index !== stateOf(parts.root).active) setActive(parts, index, false);
});

// Leaving the list with a mouse or a pen clears the active option; a finger that lifts
// has not left anything.
document.addEventListener('pointerout', (event) => {
  if (event.pointerType === 'touch') return;
  const parts = partsAt(event.target, LIST);
  if (parts === null || !isOpen(parts)) return;
  const next = event.relatedTarget;
  if (next instanceof Node && parts.list.contains(next)) return;
  setActive(parts, -1, false);
});

// Keep the focus on the trigger while the pointer works the list.
document.addEventListener('mousedown', (event) => {
  if (partsAt(event.target, LIST) !== null) event.preventDefault();
});

// A press outside the control closes without choosing.
document.addEventListener(
  'pointerdown',
  (event) => {
    const target = event.target instanceof Node ? event.target : null;
    for (const root of [...open]) {
      if (!root.isConnected || target === null || !root.contains(target)) close(root, false);
    }
  },
  true,
);

// TT12: a modal that opens elsewhere closes every list outside it.
document.addEventListener(
  'ac:modal-open',
  (event) => {
    const modal = event.target instanceof Node ? event.target : null;
    for (const root of [...open]) {
      if (modal === null || !modal.contains(root)) close(root, false);
    }
  },
  true,
);
