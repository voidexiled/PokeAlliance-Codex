// The account the header entry shows before supabase-js loads (spec 9.16.4): the session that
// supabase-js keeps in localStorage and a small cache of the profile, `alliance-codex:cuenta:v1`
// (username, player, world, avatar, online status, moderator flag and whether the registration is
// complete), which the account page and the account menu write after they load the account.
//
// - Nothing here imports supabase-js: the entry of every page reads this module alone, and the
//   client loads on demand (D-025) only to act.
// - Every storage access is inside try/catch: without storage (private mode, blocked site data)
//   there is no session to read and the entry shows «Iniciar sesión».
// - The cache is presentation only. It never decides a permission: the database checks the session
//   and the account on every call (9.12.2, 9.12.3), so an edited cache changes nothing but a label.
import { getSupabasePublicConfig } from '@/lib/supabase/env';
import { isEstadoPresencia, type EstadoPresencia } from '@/lib/trade/limits';

export const ACCOUNT_CACHE_KEY = 'alliance-codex:cuenta:v1';
/** Dispatched on `window` after this tab writes or clears the cache: `storage` only reaches the others. */
export const ACCOUNT_CHANGE_EVENT = 'alliance-codex:cuenta';

/** The profile of the signed-in account as the header entry draws it. */
export interface CachedAccount {
  /** `auth.users.id`: the cache belongs to this account and is ignored for any other session. */
  userId: string;
  /** «Nombre de usuario»; null until step 3 of the registration. */
  username: string | null;
  /** «Nombre del jugador». */
  player: string | null;
  /** World id of content/mundos.json. */
  world: string | null;
  /** The picture of the linked Discord or Google identity, an https URL. */
  avatar: string | null;
  /** The state the account chose (9.15.6); null when unknown. */
  presence: EstadoPresencia | null;
  /** A row in `trade_moderators`: the menu shows «Moderación» (9.16.2). */
  moderator: boolean;
  /** The three steps of 9.15.1 are done; otherwise the chip carries «!» (9.16.1). */
  registrationComplete: boolean;
}

/** What the header needs of the session supabase-js keeps. */
export interface StoredSession {
  accessToken: string;
  /** When the access token expires, in epoch milliseconds; null when the session does not say. */
  expiresAt: number | null;
  userId: string;
}

export interface AccountSnapshot {
  session: StoredSession | null;
  /** The cache of `session`'s account; null without a session or for another account. */
  account: CachedAccount | null;
}

/** An https URL, or null: an avatar is drawn as an image and nothing else is accepted. */
export function httpsUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------------------ storage

function store(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function getItem(key: string): string | null {
  try {
    return store()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function setItem(key: string, value: string): boolean {
  try {
    const storage = store();
    if (storage === null) return false;
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function removeItem(key: string): void {
  try {
    store()?.removeItem(key);
  } catch {
    // Nothing stored, nothing to remove.
  }
}

function announce(): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new Event(ACCOUNT_CHANGE_EVENT));
  } catch {
    // A listener that throws does not stop the write.
  }
}

// ------------------------------------------------------------------------------ session

/**
 * The localStorage key under which supabase-js keeps the session of a project:
 * `sb-{first label of the host}-auth-token` (`sb-127-auth-token` for the local stack).
 */
export function sessionStorageKey(supabaseUrl: string): string | null {
  try {
    return `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`;
  } catch {
    return null;
  }
}

/** The session key of this build; null without account mode. */
export function configuredSessionKey(): string | null {
  try {
    const config = getSupabasePublicConfig();
    return config === null ? null : sessionStorageKey(config.url);
  } catch {
    return null;
  }
}

function nonEmpty(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

/** The claims of a JWT, or null; only read to fill what the stored session leaves out. */
function jwtClaims(token: string): Record<string, unknown> | null {
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const claims: unknown = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')));
    return typeof claims === 'object' && claims !== null
      ? (claims as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** The session supabase-js stored (the JSON of its `Session`), or null when it is not one. */
export function parseStoredSession(raw: string | null): StoredSession | null {
  if (raw === null) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null) return null;
  const session = value as Record<string, unknown>;
  const accessToken = nonEmpty(session.access_token);
  if (accessToken === null) return null;

  const claims = jwtClaims(accessToken);
  const user = session.user as Record<string, unknown> | null | undefined;
  const userId = nonEmpty(user?.id) ?? nonEmpty(claims?.sub);
  if (userId === null) return null;

  const seconds =
    typeof session.expires_at === 'number' && Number.isFinite(session.expires_at)
      ? session.expires_at
      : typeof claims?.exp === 'number' && Number.isFinite(claims.exp)
        ? claims.exp
        : null;
  return { accessToken, expiresAt: seconds === null ? null : seconds * 1000, userId };
}

/**
 * The stored session of this build's project, whether or not its access token is still valid:
 * supabase-js renews an expired one with its refresh token when it loads. Null without account
 * mode, without storage or without a session.
 */
export function readStoredSession(): StoredSession | null {
  const key = configuredSessionKey();
  return key === null ? null : parseStoredSession(getItem(key));
}

// -------------------------------------------------------------------------------- cache

function optionalText(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

/** A cache record, cleaned: anything that is not the expected type becomes null or false. */
function toCachedAccount(value: unknown): CachedAccount | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  const userId = nonEmpty(record.userId);
  if (userId === null) return null;
  return {
    userId,
    username: optionalText(record.username),
    player: optionalText(record.player),
    world: optionalText(record.world),
    avatar: httpsUrl(record.avatar),
    presence: isEstadoPresencia(record.presence) ? record.presence : null,
    moderator: record.moderator === true,
    registrationComplete: record.registrationComplete === true,
  };
}

/** The cache as stored, cleaned; null when there is none or it is not a record. */
export function parseCachedAccount(raw: string | null): CachedAccount | null {
  if (raw === null) return null;
  try {
    return toCachedAccount(JSON.parse(raw));
  } catch {
    return null;
  }
}

/**
 * The cache of the signed-in account: null without a stored session, and null when the cache
 * belongs to another account (someone else signed in on this browser), so it never shows a name
 * that is not the session's.
 */
export function readCachedAccount(): CachedAccount | null {
  const session = readStoredSession();
  if (session === null) return null;
  const account = parseCachedAccount(getItem(ACCOUNT_CACHE_KEY));
  return account !== null && account.userId === session.userId ? account : null;
}

/** Writes the cache after the account was loaded or changed. False when storage refused it. */
export function writeCachedAccount(account: CachedAccount): boolean {
  const clean = toCachedAccount(account);
  if (clean === null) return false;
  const written = setItem(ACCOUNT_CACHE_KEY, JSON.stringify(clean));
  if (written) announce();
  return written;
}

/** Forgets the cache: on sign-out and when the session is no longer valid. */
export function clearCachedAccount(): void {
  removeItem(ACCOUNT_CACHE_KEY);
  announce();
}

/** The stored session and the cache that belongs to it. */
export function readAccountSnapshot(): AccountSnapshot {
  return { session: readStoredSession(), account: readCachedAccount() };
}

/**
 * Calls `listener` with a fresh snapshot whenever the session or the cache change: in another tab
 * (the `storage` event, also for `localStorage.clear()`) or in this one (`writeCachedAccount`,
 * `clearCachedAccount`). A sign-in or sign-out that supabase-js writes in this same tab raises no
 * event; the code that performed it writes or clears the cache. Returns the function that stops
 * listening.
 */
export function onCachedAccountChange(listener: (snapshot: AccountSnapshot) => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const sessionKey = configuredSessionKey();
  const notify = () => listener(readAccountSnapshot());
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === ACCOUNT_CACHE_KEY || event.key === sessionKey) notify();
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener(ACCOUNT_CHANGE_EVENT, notify);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(ACCOUNT_CHANGE_EVENT, notify);
  };
}
