// The header's account without supabase-js (9.16.4): the session supabase-js keeps, the profile
// cache `alliance-codex:cuenta:v1`, its owner check, the change events and storage that fails.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ACCOUNT_CACHE_KEY,
  clearCachedAccount,
  onCachedAccountChange,
  parseCachedAccount,
  parseStoredSession,
  readAccountSnapshot,
  readCachedAccount,
  readStoredSession,
  sessionStorageKey,
  writeCachedAccount,
  type CachedAccount,
} from '@/lib/account/session-cache';

/** An in-memory localStorage. */
class MemoryStorage {
  readonly items = new Map<string, string>();
  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.items.set(key, String(value));
  }
  removeItem(key: string): void {
    this.items.delete(key);
  }
}

/** A token with the shape of a JWT and these claims; nothing here checks a signature. */
function jwtWith(claims: Record<string, unknown>): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(claims)}.signature`;
}

/** Account mode against the local stack (the repository's .env names the remote project). */
function useLocalAccountMode(): void {
  vi.stubEnv('PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321');
  vi.stubEnv('PUBLIC_SUPABASE_ANON_KEY', 'sb_publishable_local_test');
}

const USER = '8c7f1f3e-2a55-4d8e-9d0e-6f1b2c3d4e5f';
const OTHER = '1b2c3d4e-5f60-4a1b-8c2d-3e4f5a6b7c8d';
const SESSION_KEY = 'sb-127-auth-token';

const account: CachedAccount = {
  userId: USER,
  username: 'ash',
  player: 'Ash',
  world: 'kanto',
  characters: 3,
  avatar: 'https://cdn.discordapp.com/avatars/1/a.png',
  presence: 'en_juego',
  moderator: false,
  registrationComplete: true,
};

function storeSession(userId: string, expiresAt = 1_790_000_000): void {
  storage.setItem(
    SESSION_KEY,
    JSON.stringify({
      access_token: jwtWith({ sub: userId }),
      expires_at: expiresAt,
      user: { id: userId },
    }),
  );
}

let storage: MemoryStorage;
let win: EventTarget;

beforeEach(() => {
  storage = new MemoryStorage();
  win = new EventTarget();
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('window', win);
  useLocalAccountMode();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('stored session', () => {
  it('uses the key supabase-js derives from the project URL', () => {
    expect(sessionStorageKey('http://127.0.0.1:54321')).toBe('sb-127-auth-token');
    expect(sessionStorageKey('https://abcd1234.supabase.co')).toBe('sb-abcd1234-auth-token');
    expect(sessionStorageKey('not a url')).toBeNull();
  });

  it('reads the token, its expiry in ms and the user', () => {
    storeSession(USER, 1_790_000_000);
    expect(readStoredSession()).toEqual({
      accessToken: jwtWith({ sub: USER }),
      expiresAt: 1_790_000_000_000,
      userId: USER,
    });
  });

  it('falls back to the claims of the token', () => {
    const token = jwtWith({ sub: USER, exp: 1_790_000_123 });
    expect(parseStoredSession(JSON.stringify({ access_token: token }))).toEqual({
      accessToken: token,
      expiresAt: 1_790_000_123_000,
      userId: USER,
    });
  });

  it('is null for anything that is not a session', () => {
    expect(parseStoredSession(null)).toBeNull();
    expect(parseStoredSession('{broken')).toBeNull();
    expect(parseStoredSession('"text"')).toBeNull();
    expect(parseStoredSession(JSON.stringify({ access_token: '' }))).toBeNull();
    expect(parseStoredSession(JSON.stringify({ access_token: 'opaque' }))).toBeNull();
  });

  it('is null without account mode', () => {
    vi.stubEnv('PUBLIC_SUPABASE_URL', '');
    storeSession(USER);
    expect(readStoredSession()).toBeNull();
  });
});

describe('profile cache', () => {
  it('round-trips for the signed-in account', () => {
    storeSession(USER);
    expect(writeCachedAccount(account)).toBe(true);
    expect(readCachedAccount()).toEqual(account);
    expect(readAccountSnapshot()).toEqual({ session: readStoredSession(), account });
  });

  it('never shows the cache of another account or without a session', () => {
    writeCachedAccount(account);
    expect(readCachedAccount()).toBeNull();
    storeSession(OTHER);
    expect(readCachedAccount()).toBeNull();
  });

  it('cleans what it reads: an avatar that is not https, an unknown state', () => {
    storeSession(USER);
    storage.setItem(
      ACCOUNT_CACHE_KEY,
      JSON.stringify({
        ...account,
        avatar: 'javascript:alert(1)',
        presence: 'online',
        moderator: 'yes',
        username: 42,
        characters: -1,
      }),
    );
    expect(readCachedAccount()).toEqual({
      ...account,
      avatar: null,
      presence: null,
      moderator: false,
      username: null,
      characters: null,
    });
    expect(parseCachedAccount('[]')).toBeNull();
    expect(parseCachedAccount('{"username":"ash"}')).toBeNull();
  });

  it('clears', () => {
    storeSession(USER);
    writeCachedAccount(account);
    clearCachedAccount();
    expect(readCachedAccount()).toBeNull();
    expect(storage.getItem(ACCOUNT_CACHE_KEY)).toBeNull();
  });

  it('survives storage that throws: nothing to read, nothing written', () => {
    const broken = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {
        throw new Error('SecurityError');
      },
    };
    vi.stubGlobal('localStorage', broken);
    expect(readStoredSession()).toBeNull();
    expect(readCachedAccount()).toBeNull();
    expect(writeCachedAccount(account)).toBe(false);
    expect(() => clearCachedAccount()).not.toThrow();
  });
});

describe('change events', () => {
  it('reports writes of this tab and storage events of the others', () => {
    storeSession(USER);
    const seen: (string | null)[] = [];
    const stop = onCachedAccountChange(({ account: current }) =>
      seen.push(current?.username ?? null),
    );

    writeCachedAccount(account);
    clearCachedAccount();
    // Another tab signed out: supabase-js removed the session there.
    storage.removeItem(SESSION_KEY);
    win.dispatchEvent(Object.assign(new Event('storage'), { key: SESSION_KEY }));
    // An unrelated key changes nothing.
    win.dispatchEvent(Object.assign(new Event('storage'), { key: 'alliance-codex:otra' }));

    expect(seen).toEqual(['ash', null, null]);
    stop();
    writeCachedAccount(account);
    expect(seen).toHaveLength(3);
  });
});
