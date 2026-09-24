// The header account entry in the browser (spec 9.16.1, 9.16.4): the client half of
// src/components/layout/AccountEntry.astro. Plain TypeScript, no React and no supabase-js: it
// reads the session supabase-js keeps in localStorage and the small profile cache
// `alliance-codex:cuenta:v1` through src/lib/account/session-cache.ts, synchronously, and shows
// one of the three states the server drew (unknown, without a session, with a session). Every
// storage access of that module sits in try/catch: without storage the entry shows «Iniciar
// sesión».
//
// What it adds to the page:
//
//   - the state of every `[data-ac-account]` root (the full and the compact instance), again on
//     every change of the session or the cache, in this tab or in another one (9.16.4), and when
//     a page comes back from the bfcache;
//   - the menu button of 9.16.2: a click, Enter or Space toggle the menu, ArrowDown opens it on
//     its first item and ArrowUp on its last. The menu is src/scripts/account-menu.ts, loaded
//     with `import()` on the first open together with its stylesheet and supabase-js (D-025);
//   - with COMERCIO_PUBLICO and a finished registration, the heartbeat of 9.15.6
//     (src/scripts/presence.ts, loaded on demand), stopped when the session ends.
//
// A session with no cached profile (a sign-in that no page of this browser has described yet)
// keeps the empty slot and asks the menu module, once per page, to refresh the cache: the only
// case in which the entry loads supabase-js without a click.
//
// The derivation of the state is exported for tests/account/account-entry.test.ts; the module
// touches the DOM only when a document exists.
import {
  onCachedAccountChange,
  readAccountSnapshot,
  type AccountSnapshot,
  type CachedAccount,
} from '@/lib/account/session-cache';

import type * as AccountMenu from './account-menu';

/** The online status an account chooses (9.15.6). */
export type Presence = NonNullable<CachedAccount['presence']>;

/** The three states of 9.16.1. `unknown` is the empty slot of the HTML. */
export type EntryState =
  { kind: 'unknown' } | { kind: 'signed-out' } | { kind: 'signed-in'; account: CachedAccount };

/** The dot of the chip: the status and its label. */
export interface EntryPresence {
  state: Presence;
  label: string;
}

/** The texts the server wrote into `data-texts`: the script builds none of its own. */
export interface EntryTexts {
  /** The chip's name, «Cuenta de {user}». */
  label: string;
  /** «Registro sin terminar»: what the «!» mark says. */
  incomplete: string;
  /** «Completar registro»: the chip's text while the account has no username. */
  finish: string;
  /** The label of each status, or `null` without COMERCIO_PUBLICO. */
  presence: Readonly<Record<Presence, string>> | null;
}

/**
 * The state of 9.16.1 from what the browser keeps: without a stored session «Iniciar sesión»;
 * with one and its cached profile the chip; with a session the cache does not describe (none, or
 * another account's, which `readCachedAccount` already drops) the empty slot.
 */
export function entryState({ session, account }: AccountSnapshot): EntryState {
  if (session === null) return { kind: 'signed-out' };
  if (account === null) return { kind: 'unknown' };
  return { kind: 'signed-in', account };
}

/**
 * The status dot (9.15.6): only with COMERCIO_PUBLICO (`labels`) and a finished registration. A
 * cache that does not know the status shows «Desconectado», what the others see of an account
 * that has not sent a heartbeat yet.
 */
export function entryPresence(
  account: CachedAccount,
  labels: EntryTexts['presence'],
): EntryPresence | null {
  if (labels === null || !account.registrationComplete) return null;
  const state = account.presence ?? 'desconectado';
  return { state, label: labels[state] };
}

/**
 * The accessible name of the chip (9.16.1): «Cuenta de {user}», then the label of the status dot
 * and «Registro sin terminar» when they are drawn, joined with commas; «Completar registro», its
 * visible text, while the account has no username.
 */
export function chipName(
  account: CachedAccount,
  texts: EntryTexts,
  presence: EntryPresence | null,
): string {
  if (account.username === null) return texts.finish;
  const parts = [texts.label.replace('{user}', account.username)];
  if (presence !== null) parts.push(presence.label);
  if (!account.registrationComplete) parts.push(texts.incomplete);
  return parts.join(', ');
}

/** The first letter of the username, upper case, for the disc of an account with no picture. */
export function initialOf(username: string | null): string {
  const first = username?.trim().codePointAt(0);
  return first === undefined ? '' : String.fromCodePoint(first).toLocaleUpperCase();
}

// ------------------------------------------------------------------------------------ DOM

const ROOT = '[data-ac-account]';

type MenuModule = typeof AccountMenu;

let menuModule: Promise<MenuModule> | null = null;

/** The menu module, loaded once; a failed load is asked for again on the next open. */
function loadMenu(): Promise<MenuModule> {
  menuModule ??= import('./account-menu').catch((error: unknown) => {
    menuModule = null;
    throw error;
  });
  return menuModule;
}

function textsOf(root: HTMLElement): EntryTexts {
  try {
    return JSON.parse(root.dataset.texts ?? '') as EntryTexts;
  } catch {
    return { label: '{user}', incomplete: '', finish: '', presence: null };
  }
}

function show(element: Element | null, visible: boolean): void {
  if (element instanceof HTMLElement) element.hidden = !visible;
}

function render(root: HTMLElement, state: EntryState): void {
  root.dataset.state = state.kind;
  show(root.querySelector('.ac-account-entry__signin'), state.kind === 'signed-out');
  const chip = root.querySelector<HTMLButtonElement>('[data-ac-account-chip]');
  show(chip, state.kind === 'signed-in');
  if (chip === null || state.kind !== 'signed-in') return;

  const { account } = state;
  const texts = textsOf(root);
  const img = chip.querySelector<HTMLImageElement>('.ac-account-entry__avatar > img');
  if (img !== null) {
    if (account.avatar !== null && img.getAttribute('src') !== account.avatar) {
      img.src = account.avatar;
    }
    img.hidden = account.avatar === null;
  }
  const initial = chip.querySelector('.ac-account-entry__initial');
  if (initial !== null) {
    initial.textContent = account.avatar === null ? initialOf(account.username) : '';
  }
  const name = chip.querySelector('.ac-account-entry__label');
  if (name !== null) name.textContent = account.username ?? texts.finish;

  // One badge on the corner of the avatar: the status dot, or the «!» of an unfinished
  // registration (the dot needs a finished one).
  const presence = entryPresence(account, texts.presence);
  const unfinished = !account.registrationComplete;
  const badge = chip.querySelector<HTMLElement>('.ac-account-entry__badge');
  if (badge !== null) {
    badge.hidden = presence === null && !unfinished;
    badge.textContent = unfinished ? '!' : '';
  }
  root.toggleAttribute('data-unfinished', unfinished);
  if (presence === null) delete root.dataset.presence;
  else root.dataset.presence = presence.state;
  chip.setAttribute('aria-label', chipName(account, texts, presence));
}

let stopBeat: (() => void) | null = null;
let beatWanted = false;

/** Starts or stops the heartbeat; `startPresence` returns the running loop when there is one. */
function heartbeat(on: boolean): void {
  beatWanted = on;
  if (!on) {
    stopBeat?.();
    stopBeat = null;
    return;
  }
  void import('./presence').then(
    ({ startPresence }) => {
      if (beatWanted) stopBeat = startPresence();
    },
    () => undefined,
  );
}

let refreshAsked = false;

/** Draws every instance from `snapshot`, or from the storage when none is given. */
function update(snapshot: AccountSnapshot = readAccountSnapshot()): void {
  const state = entryState(snapshot);
  const roots = document.querySelectorAll<HTMLElement>(ROOT);
  for (const root of roots) render(root, state);

  const comercio = roots[0]?.dataset.comercio !== undefined;
  heartbeat(comercio && state.kind === 'signed-in' && state.account.registrationComplete);

  if (state.kind === 'unknown' && !refreshAsked) {
    refreshAsked = true;
    void loadMenu().then(
      (menu) => menu.refreshAccount(),
      () => undefined,
    );
  }
}

function chipOf(target: EventTarget | null): HTMLButtonElement | null {
  return target instanceof Element
    ? target.closest<HTMLButtonElement>(`${ROOT} [data-ac-account-chip]`)
    : null;
}

function init(): void {
  if (document.querySelector(ROOT) === null) return;
  update();
  // Also this tab's own writes: `writeCachedAccount` and `clearCachedAccount` announce them.
  onCachedAccountChange((snapshot) => update(snapshot));
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) update();
  });

  document.addEventListener('click', (event) => {
    const chip = chipOf(event.target);
    if (chip === null) return;
    void loadMenu().then(
      (menu) => menu.toggleMenu(chip),
      () => undefined,
    );
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const chip = chipOf(event.target);
    if (chip === null) return;
    event.preventDefault();
    const focus = event.key === 'ArrowDown' ? 'first' : 'last';
    void loadMenu().then(
      (menu) => menu.openMenu(chip, focus),
      () => undefined,
    );
  });
}

if (typeof document !== 'undefined') init();
