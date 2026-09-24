// The heartbeat of the online status (9.15.6, 9.16.4): when a beat is due and what it reports, the
// request it sends, one beat per browser across tabs, the token renewal and when it stops. The
// clock is injected; no request leaves the test.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  BEAT_INTERVAL_MS,
  DEVICE_ID_KEY,
  PRESENCE_SHARED_KEY,
  beatOutcome,
  getDeviceId,
  planBeat,
  postHeartbeat,
  readSharedPresence,
  startPresence,
} from '@/scripts/presence';

const refreshSession = vi.fn();
const getSession = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  getSupabaseBrowserClient: async () => ({ auth: { refreshSession, getSession } }),
}));

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

const USER = '8c7f1f3e-2a55-4d8e-9d0e-6f1b2c3d4e5f';
const SESSION_KEY = 'sb-127-auth-token';
const T0 = Date.parse('2026-09-23T12:00:00Z');
const CONFIG = { url: 'http://127.0.0.1:54321', anonKey: 'sb_publishable_local_test' };

let storage: MemoryStorage;
let win: EventTarget;
let fetchMock: ReturnType<typeof vi.fn>;

function storeSession(token = 'token-1', expiresAtSeconds = T0 / 1000 + 3600): void {
  storage.setItem(
    SESSION_KEY,
    JSON.stringify({ access_token: token, expires_at: expiresAtSeconds, user: { id: USER } }),
  );
}

/** The `p_activo` and the token of each request sent so far. */
function sent(): { active: unknown; token: unknown }[] {
  return fetchMock.mock.calls.map((call) => {
    const init = call[1] as RequestInit;
    return {
      active: (JSON.parse(String(init.body)) as Record<string, unknown>).p_activo,
      token: (init.headers as Record<string, string>).Authorization,
    };
  });
}

beforeEach(() => {
  vi.useFakeTimers({ now: T0 });
  storage = new MemoryStorage();
  win = new EventTarget();
  fetchMock = vi.fn(async () => ({ status: 200 }));
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('window', win);
  vi.stubGlobal('document', Object.assign(new EventTarget(), { visibilityState: 'visible' }));
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('PUBLIC_SUPABASE_URL', CONFIG.url);
  vi.stubEnv('PUBLIC_SUPABASE_ANON_KEY', CONFIG.anonKey);
  refreshSession.mockReset();
  getSession.mockReset();
});

afterEach(() => {
  // A loop a failed test left running: without a session, startPresence returns its stop.
  storage.removeItem(SESSION_KEY);
  startPresence()();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('planBeat', () => {
  it('is due without a known beat and after about one interval', () => {
    expect(planBeat({ now: T0, lastBeatAt: null, lastInputAt: null }).send).toBe(true);
    expect(planBeat({ now: T0, lastBeatAt: T0 - 30_000, lastInputAt: null }).send).toBe(false);
    expect(
      planBeat({ now: T0, lastBeatAt: T0 - (BEAT_INTERVAL_MS - 4_000), lastInputAt: null }).send,
    ).toBe(true);
    // A beat in the future: the clock went back.
    expect(planBeat({ now: T0, lastBeatAt: T0 + 600_000, lastInputAt: null }).send).toBe(true);
  });

  it('is active only with input after the previous beat', () => {
    const beat = T0 - BEAT_INTERVAL_MS;
    expect(planBeat({ now: T0, lastBeatAt: beat, lastInputAt: beat + 1 }).active).toBe(true);
    expect(planBeat({ now: T0, lastBeatAt: beat, lastInputAt: beat - 1 }).active).toBe(false);
    expect(planBeat({ now: T0, lastBeatAt: beat, lastInputAt: null }).active).toBe(false);
    // Before the first beat, input of the last interval counts; older input does not.
    expect(planBeat({ now: T0, lastBeatAt: null, lastInputAt: T0 - 5_000 }).active).toBe(true);
    expect(planBeat({ now: T0, lastBeatAt: null, lastInputAt: T0 - 3_600_000 }).active).toBe(false);
  });
});

describe('beat request', () => {
  it('posts p_activo to trade_heartbeat with the token in a header', async () => {
    expect(await postHeartbeat(CONFIG, 'token-1', true, fetchMock as typeof fetch)).toBe(200);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://127.0.0.1:54321/rest/v1/rpc/trade_heartbeat');
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"p_activo":true}');
    expect(init.headers).toEqual({
      apikey: CONFIG.anonKey,
      Authorization: 'Bearer token-1',
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    });
    expect(init.credentials).toBe('omit');
    expect(init.keepalive).toBe(true);
  });

  it('answers 0 when the server cannot be reached', async () => {
    const failing = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    expect(await postHeartbeat(CONFIG, 't', false, failing as typeof fetch)).toBe(0);
  });

  it('stops only for answers that repeating cannot fix', () => {
    expect(beatOutcome(200)).toBe('continue');
    expect(beatOutcome(204)).toBe('continue');
    expect(beatOutcome(0)).toBe('continue');
    expect(beatOutcome(503)).toBe('continue');
    expect(beatOutcome(401)).toBe('continue');
    expect(beatOutcome(400)).toBe('stop');
    expect(beatOutcome(403)).toBe('stop');
    expect(beatOutcome(404)).toBe('stop');
  });
});

describe('device id (9.15.3)', () => {
  it('is created once and kept', () => {
    const id = getDeviceId();
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(getDeviceId()).toBe(id);
    expect(storage.getItem(DEVICE_ID_KEY)).toBe(id);
  });

  it('replaces a stored value that is not a UUID', () => {
    storage.setItem(DEVICE_ID_KEY, 'not-a-uuid');
    expect(getDeviceId()).not.toBe('not-a-uuid');
  });

  it('is null without storage', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('SecurityError');
      },
    });
    expect(getDeviceId()).toBeNull();
  });
});

describe('startPresence', () => {
  it('beats at once, every minute, reports input, and one tab covers the others', async () => {
    storeSession();
    const stop = startPresence();
    await vi.advanceTimersByTimeAsync(0);
    expect(sent()).toEqual([{ active: false, token: 'Bearer token-1' }]);
    expect(startPresence()).toBe(stop);

    await vi.advanceTimersByTimeAsync(1_000);
    win.dispatchEvent(new Event('pointerdown'));
    await vi.advanceTimersByTimeAsync(BEAT_INTERVAL_MS - 1_000);
    expect(sent().map(({ active }) => active)).toEqual([false, true]);

    // Another tab of the browser beats 30 s later: this one skips its next tick.
    storage.setItem(
      PRESENCE_SHARED_KEY,
      JSON.stringify({ userId: USER, beatAt: Date.now() + 30_000, inputAt: null }),
    );
    await vi.advanceTimersByTimeAsync(BEAT_INTERVAL_MS);
    expect(sent()).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(BEAT_INTERVAL_MS);
    expect(sent()).toHaveLength(3);
    expect(readSharedPresence(USER).beatAt).toBe(Date.now());
    stop();
  });

  it('counts the input another tab wrote, like the click that opened this page', async () => {
    storeSession();
    storage.setItem(
      PRESENCE_SHARED_KEY,
      JSON.stringify({ userId: USER, beatAt: T0 - 130_000, inputAt: T0 - 2_000 }),
    );
    const stop = startPresence();
    await vi.advanceTimersByTimeAsync(0);
    expect(sent()).toEqual([{ active: true, token: 'Bearer token-1' }]);
    stop();
  });

  it('stops when the session is gone and can start again', async () => {
    storeSession();
    const stop = startPresence();
    await vi.advanceTimersByTimeAsync(0);
    storage.removeItem(SESSION_KEY);
    await vi.advanceTimersByTimeAsync(BEAT_INTERVAL_MS * 3);
    expect(sent()).toHaveLength(1);

    storeSession();
    const again = startPresence();
    expect(again).not.toBe(stop);
    await vi.advanceTimersByTimeAsync(0);
    expect(sent()).toHaveLength(2);
    again();
    await vi.advanceTimersByTimeAsync(BEAT_INTERVAL_MS * 2);
    expect(sent()).toHaveLength(2);
  });

  it('does nothing without a session or without account mode', async () => {
    startPresence()();
    storeSession();
    vi.stubEnv('PUBLIC_SUPABASE_URL', '');
    startPresence()();
    await vi.advanceTimersByTimeAsync(BEAT_INTERVAL_MS);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('stops when the database refuses the account', async () => {
    fetchMock.mockResolvedValue({ status: 403 });
    storeSession();
    startPresence();
    await vi.advanceTimersByTimeAsync(BEAT_INTERVAL_MS * 3);
    expect(sent()).toHaveLength(1);
  });

  it('renews a refused token once through supabase-js and beats again', async () => {
    fetchMock.mockResolvedValueOnce({ status: 401 }).mockResolvedValue({ status: 200 });
    refreshSession.mockResolvedValue({
      data: {
        session: { access_token: 'token-2', expires_at: T0 / 1000 + 3600, user: { id: USER } },
      },
    });
    storeSession();
    const stop = startPresence();
    await vi.advanceTimersByTimeAsync(0);
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(sent().map(({ token }) => token)).toEqual(['Bearer token-1', 'Bearer token-2']);
    stop();
  });

  it('renews a token that is about to expire before the beat', async () => {
    getSession.mockResolvedValue({
      data: {
        session: { access_token: 'token-3', expires_at: T0 / 1000 + 3600, user: { id: USER } },
      },
    });
    storeSession('token-old', T0 / 1000 + 10);
    const stop = startPresence();
    await vi.advanceTimersByTimeAsync(0);
    expect(getSession).toHaveBeenCalledTimes(1);
    expect(sent()).toEqual([{ active: false, token: 'Bearer token-3' }]);
    stop();
  });
});
