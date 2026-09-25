// The account menu of the header (spec 9.16.2, 9.16.4). src/scripts/account-entry.ts loads this
// module with `import()` on the first open, so its stylesheet and supabase-js stay out of the
// initial JS and CSS of every page (13.6, D-025).
//
// The menu is the `<template data-ac-account-menu>` of AccountEntry.astro, cloned once and moved
// into the instance of the entry whose chip opened it (the full one from 1280, the compact one
// below). The server wrote its items with their texts and links; this module fills in the account
// (the head, the checked status, the items that depend on the account) and acts.
//
// Menu button pattern (APG): the chip opens the menu with a click, Enter, Space or ArrowDown on the
// first item, ArrowUp on the last; inside, ArrowDown and ArrowUp move through the items and wrap,
// Home and End go to the ends, Escape closes and gives the focus back to the chip, Tab closes and
// lets the focus move on, and a pointer outside the entry or the focus leaving it close it.
//
// Actions:
//
//   - «En el juego», «Ausente», «Desconectado» (`menuitemradio`, with COMERCIO_PUBLICO): the chip
//     dot and the check change at once, then the database is told (9.15.6); if it refuses, both
//     go back and the menu says why. A click or Enter closes the menu once the database agreed,
//     Space keeps it open.
//   - «Cerrar sesión»: puts the account in `desconectado`, signs out with the shared client and
//     clears the cache, which turns every instance of the entry into «Iniciar sesión» and gives
//     it the focus. The islands of the page hear the same sign-out through `onAuthStateChange`.
//
// Every open also refreshes the cache from the server (9.16.4): a session the server no longer
// accepts ends here, and the chip shows «Iniciar sesión».
import '@/styles/components/account-menu.css';

import { isLocale, type Locale } from '@/i18n/config';
import {
  onCachedAccountChange,
  readAccountSnapshot,
  writeCachedAccount,
} from '@/lib/account/session-cache';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { mapSupabaseError, type SupabaseFailure } from '@/lib/supabase/errors';
import { refreshCachedAccount, setPresenceState, signOutAccount } from '@/lib/supabase/trade';

// Types only: account-entry.ts is the page's module and this one never runs it again.
import type { EntryTexts, Presence } from './account-entry';

const ROOT = '[data-ac-account]';
const ITEM = '[role="menuitem"], [role="menuitemradio"]';

let menu: HTMLElement | null = null;
/** The chip of the open menu, or of the last one. */
let chip: HTMLButtonElement | null = null;
let locale: Locale = 'es';
let worlds: Readonly<Record<string, string>> = {};
let busy = false;

function slot(name: string): HTMLElement | null {
  return menu?.querySelector<HTMLElement>(`[data-ac-slot="${name}"]`) ?? null;
}

function rootOf(element: Element | null): HTMLElement | null {
  return element?.closest<HTMLElement>(ROOT) ?? null;
}

function textsOf(root: HTMLElement | null): EntryTexts {
  try {
    return JSON.parse(root?.dataset.texts ?? '') as EntryTexts;
  } catch {
    return { label: '{user}', incomplete: '', finish: '', presence: null };
  }
}

/** The first letter of the username on the disc of an account with no picture. */
function initialOf(username: string | null): string {
  const first = username?.trim().codePointAt(0);
  return first === undefined ? '' : String.fromCodePoint(first).toLocaleUpperCase();
}

function isOpen(): boolean {
  return menu !== null && !menu.hidden;
}

/** The items that can take the focus, in order. */
function items(): HTMLElement[] {
  if (menu === null) return [];
  return [...menu.querySelectorAll<HTMLElement>(ITEM)].filter((item) => !item.hidden);
}

function showError(failure: SupabaseFailure | null): void {
  const error = slot('error');
  if (error !== null) error.textContent = failure === null ? '' : mapSupabaseError(failure, locale);
}

/** The head, the checked status and the items that depend on the account, from the cache. */
function fill(): void {
  const { account } = readAccountSnapshot();
  if (menu === null || account === null) return;
  const texts = textsOf(rootOf(chip));

  const avatar = slot('avatar');
  if (avatar !== null) {
    avatar.replaceChildren();
    if (account.avatar === null) {
      avatar.textContent = initialOf(account.username);
    } else {
      const img = document.createElement('img');
      img.src = account.avatar;
      img.alt = '';
      img.width = 28;
      img.height = 28;
      avatar.append(img);
    }
  }
  const name = slot('name');
  if (name !== null) name.textContent = account.username ?? texts.finish;
  const player = slot('player');
  if (player !== null) {
    const world = account.world === null ? null : (worlds[account.world] ?? account.world);
    player.textContent = [account.player, world].filter((part) => part !== null).join(' · ');
    const line = player.parentElement;
    if (line !== null) line.hidden = player.textContent === '';
  }
  // «+N personajes» (variant 3): the other characters, only when there are any.
  const more = slot('more');
  if (more !== null) {
    const others = (account.characters ?? 0) - 1;
    more.hidden = others < 1;
    const template =
      new Intl.PluralRules(locale).select(others) === 'one' ? more.dataset.one : more.dataset.other;
    more.textContent = others < 1 ? '' : (template ?? '').replace('{n}', String(others));
  }

  const presence = account.registrationComplete ? (account.presence ?? 'desconectado') : null;
  for (const radio of menu.querySelectorAll<HTMLElement>('[data-ac-presence]')) {
    radio.setAttribute('aria-checked', String(radio.dataset.acPresence === presence));
  }
  const group = menu.querySelector<HTMLElement>('[role="group"]');
  if (group !== null) group.hidden = presence === null;
  const separator = group?.nextElementSibling;
  if (separator instanceof HTMLElement && separator.matches('[role="separator"]')) {
    separator.hidden = presence === null;
  }

  for (const item of menu.querySelectorAll<HTMLElement>('[data-ac-only]')) {
    item.hidden =
      item.dataset.acOnly === 'unfinished' ? account.registrationComplete : !account.moderator;
  }
}

function close(returnFocus: boolean): void {
  if (!isOpen() || menu === null) return;
  menu.hidden = true;
  chip?.setAttribute('aria-expanded', 'false');
  if (returnFocus) chip?.focus();
}

function focusItem(which: 'first' | 'last'): void {
  const list = items();
  list[which === 'first' ? 0 : list.length - 1]?.focus();
}

// --------------------------------------------------------------------------- actions

let refreshing: Promise<void> | null = null;

/**
 * Loads the account from the server and writes the cache (9.16.4) with `refreshCachedAccount` of
 * trade.ts, which also ends on this browser a session the server no longer accepts; the entry
 * redraws itself from the cache's change event. One request at a time.
 */
export function refreshAccount(): Promise<void> {
  refreshing ??= (async () => {
    const client = await getSupabaseBrowserClient();
    if (client === null) return;
    // The cache's change event redraws the menu, or closes it when the session ended.
    await refreshCachedAccount(client);
  })()
    .catch(() => undefined)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

async function choose(state: Presence, closeAfter: boolean): Promise<void> {
  const { account } = readAccountSnapshot();
  if (busy || account === null || !account.registrationComplete) return;
  busy = true;
  showError(null);
  const previous = account.presence;
  writeCachedAccount({ ...account, presence: state });
  fill();
  try {
    const client = await getSupabaseBrowserClient().catch(() => null);
    const result =
      client === null
        ? { error: { code: null, network: true } satisfies SupabaseFailure }
        : await setPresenceState(client, state);
    if (result.error !== null) {
      const current = readAccountSnapshot().account;
      if (current !== null) writeCachedAccount({ ...current, presence: previous });
      fill();
      showError(result.error);
    } else if (closeAfter) {
      close(menu?.contains(document.activeElement) ?? false);
    }
  } finally {
    busy = false;
  }
}

async function signOut(item: HTMLElement): Promise<void> {
  if (busy) return;
  busy = true;
  item.setAttribute('aria-disabled', 'true');
  showError(null);
  try {
    const client = await getSupabaseBrowserClient().catch(() => null);
    if (client === null) {
      showError({ code: null, network: true });
      return;
    }
    const { account } = readAccountSnapshot();
    const comercio = rootOf(chip)?.dataset.comercio !== undefined;
    // «Desconectado» first (9.15.6); `signOutAccount` also clears the cache, which turns every
    // instance of the entry into «Iniciar sesión».
    const root = rootOf(chip);
    const result = await signOutAccount(client, {
      presence: comercio && account?.registrationComplete === true,
    });
    if (result.error !== null) {
      showError(result.error);
      return;
    }
    close(false);
    root?.querySelector<HTMLElement>('.ac-account-entry__signin')?.focus();
  } finally {
    busy = false;
    item.removeAttribute('aria-disabled');
  }
}

// ----------------------------------------------------------------------------- build

function onKeydown(event: KeyboardEvent): void {
  const list = items();
  const current = list.indexOf(document.activeElement as HTMLElement);
  let next: number;
  switch (event.key) {
    case 'ArrowDown':
      next = (current + 1) % list.length;
      break;
    case 'ArrowUp':
      next = current <= 0 ? list.length - 1 : current - 1;
      break;
    case 'Home':
      next = 0;
      break;
    case 'End':
      next = list.length - 1;
      break;
    case 'Escape':
      event.preventDefault();
      close(true);
      return;
    case 'Tab':
      close(false);
      return;
    case ' ': {
      const item = event.target instanceof Element ? event.target.closest<HTMLElement>(ITEM) : null;
      if (item === null) return;
      event.preventDefault();
      const state = item.dataset.acPresence as Presence | undefined;
      if (state !== undefined) void choose(state, false);
      else item.click();
      return;
    }
    default:
      return;
  }
  event.preventDefault();
  list[next]?.focus();
}

function onClick(event: MouseEvent): void {
  const item = event.target instanceof Element ? event.target.closest<HTMLElement>(ITEM) : null;
  if (item === null || item.getAttribute('aria-disabled') === 'true') return;
  const state = item.dataset.acPresence as Presence | undefined;
  if (state !== undefined) void choose(state, true);
  else if (item.dataset.acAction === 'sign-out') void signOut(item);
  else close(false);
}

function build(): HTMLElement | null {
  if (menu !== null) return menu;
  const template = document.querySelector<HTMLTemplateElement>('template[data-ac-account-menu]');
  const element = template?.content.firstElementChild?.cloneNode(true);
  if (!(element instanceof HTMLElement) || template === null || template === undefined) {
    return null;
  }
  const lang = template.dataset.locale ?? '';
  if (isLocale(lang)) locale = lang;
  try {
    worlds = JSON.parse(template.dataset.worlds ?? '{}') as Record<string, string>;
  } catch {
    worlds = {};
  }
  element.addEventListener('keydown', onKeydown);
  element.addEventListener('click', onClick);
  element.addEventListener('focusout', (event) => {
    const next = event.relatedTarget;
    // No target: the focus left the window or a click landed on a part that takes none.
    if (!(next instanceof Node)) return;
    if (rootOf(chip)?.contains(next)) return;
    close(false);
  });
  document.addEventListener(
    'pointerdown',
    (event) => {
      if (!isOpen()) return;
      if (event.target instanceof Node && rootOf(chip)?.contains(event.target)) return;
      close(false);
    },
    true,
  );
  // A session that ends while the menu is open (here or in another tab) closes it; the focus
  // goes to «Iniciar sesión», which replaces the chip.
  onCachedAccountChange(({ account }) => {
    if (!isOpen()) return;
    if (account !== null) {
      fill();
      return;
    }
    const hadFocus = menu?.contains(document.activeElement) === true;
    close(false);
    if (hadFocus) rootOf(chip)?.querySelector<HTMLElement>('.ac-account-entry__signin')?.focus();
  });
  menu = element;
  return menu;
}

/** Opens the menu under `trigger` and focuses its first or last item. */
export function openMenu(trigger: HTMLButtonElement, focus: 'first' | 'last' = 'first'): void {
  const element = build();
  const root = rootOf(trigger);
  if (element === null || root === null) return;
  if (chip !== trigger) {
    close(false);
    chip?.removeAttribute('aria-controls');
    chip = trigger;
  }
  if (element.parentElement !== root) root.append(element);
  trigger.setAttribute('aria-controls', element.id);
  showError(null);
  fill();
  element.hidden = false;
  trigger.setAttribute('aria-expanded', 'true');
  focusItem(focus);
  void refreshAccount();
}

/** A click, Enter or Space on the chip: opens the menu, or closes the one it opened. */
export function toggleMenu(trigger: HTMLButtonElement): void {
  if (isOpen() && chip === trigger) close(true);
  else openMenu(trigger, 'first');
}
