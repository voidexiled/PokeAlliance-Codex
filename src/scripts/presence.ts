// The heartbeat of the online status (spec 9.15.6, 9.16.4). While an account is signed in and any
// tab of the site is visible, a beat reaches `trade_heartbeat(activo)` every 120 s, where `activo` says
// whether there was keyboard or pointer input since the previous beat. What the others see is
// computed by the database (`trade_effective_presence`: «Desconectado» after 10 minutes without a
// beat, «Ausente» after 6 hours without input); this script only reports.
//
// - No supabase-js on every page: the beat is a plain `fetch` to the function with the access token
//   of the session supabase-js keeps in localStorage (session-cache.ts). The client is imported
//   only to renew an expired or refused token.
// - One beat per browser, not one per tab: the tabs share `alliance-codex:presencia:v1` (the last
//   beat and the last input of the account), so a tab whose beat another tab already sent skips it,
//   and the input of every tab — also the click that opened this page — counts for the next beat.
// - It stops by itself when the session is gone (sign-out here or in another tab), when the
//   function does not exist or when the database refuses the account (an unfinished registration);
//   `startPresence` starts it again.
// - The random id of this browser for the moderation evidence of 9.15.3 lives here too
//   (`alliance-codex:dispositivo`); trade.ts sends it with the seven Comercio actions.
//
// Nothing here runs on import: the header entry (account-entry.ts) calls `startPresence` for a
// signed-in account of a build with COMERCIO_PUBLICO.
import { readStoredSession, type StoredSession } from '@/lib/account/session-cache';
import { getSupabasePublicConfig, type SupabasePublicConfig } from '@/lib/supabase/env';
import { PRESENCIA_LATIDO_S } from '@/lib/trade/limits';

/** The database function of the beat and its argument; trade.ts lists it with the others. */
export const HEARTBEAT_RPC = 'trade_heartbeat';
export const HEARTBEAT_ARG = 'p_activo';

/** The random id of this browser (9.15.3). */
export const DEVICE_ID_KEY = 'alliance-codex:dispositivo';
/** The last beat and the last input of the account, shared by the tabs. */
export const PRESENCE_SHARED_KEY = 'alliance-codex:presencia:v1';

export const BEAT_INTERVAL_MS = PRESENCIA_LATIDO_S * 1000;
/** The timers of two tabs drift: a beat due within this margin is sent. */
const DUE_MARGIN_MS = 5_000;
/** A tab writes its input to the shared record at most this often; the next tick writes the rest. */
const INPUT_WRITE_MS = 10_000;
/** A token that expires this soon is renewed before the beat. */
const EXPIRY_MARGIN_MS = 30_000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ------------------------------------------------------------------------------ device

/**
 * The random id of this browser (`crypto.randomUUID()`), created on first use and kept in
 * localStorage. Null without storage or without `crypto.randomUUID` (an insecure context): the
 * database then records the action without a device, which never matches another one.
 */
export function getDeviceId(): string | null {
  try {
    const storage = globalThis.localStorage;
    const current = storage.getItem(DEVICE_ID_KEY);
    if (current !== null && UUID.test(current)) return current;
    const id = globalThis.crypto.randomUUID();
    storage.setItem(DEVICE_ID_KEY, id);
    return id;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------------------- rules

export interface BeatContext {
  now: number;
  /** The last beat any tab of this browser sent for the account; null when none is known. */
  lastBeatAt: number | null;
  /** The last keyboard or pointer input any tab saw; null when none. */
  lastInputAt: number | null;
}

export interface BeatPlan {
  /** A beat is due. */
  send: boolean;
  /** The `activo` of the beat: input since the previous beat. */
  active: boolean;
}

/**
 * Whether a beat is due at `now` and what it reports. It is due when no beat is known, when the
 * last one is about `BEAT_INTERVAL_MS` old, or when the last one is in the future (the clock went
 * back). It is active when there was input after the last beat; before the first one, input of
 * the last interval counts.
 */
export function planBeat({ now, lastBeatAt, lastInputAt }: BeatContext): BeatPlan {
  const send =
    lastBeatAt === null || lastBeatAt > now || now - lastBeatAt >= BEAT_INTERVAL_MS - DUE_MARGIN_MS;
  const since = lastBeatAt === null || lastBeatAt > now ? now - BEAT_INTERVAL_MS : lastBeatAt;
  return { send, active: lastInputAt !== null && lastInputAt > since };
}

interface SharedPresence {
  userId: string;
  beatAt: number | null;
  inputAt: number | null;
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** The shared record of `userId`; an empty one when it belongs to another account or is unreadable. */
export function readSharedPresence(userId: string): SharedPresence {
  try {
    const raw = globalThis.localStorage.getItem(PRESENCE_SHARED_KEY);
    const value: unknown = raw === null ? null : JSON.parse(raw);
    if (typeof value === 'object' && value !== null) {
      const record = value as Record<string, unknown>;
      if (record.userId === userId) {
        return { userId, beatAt: finite(record.beatAt), inputAt: finite(record.inputAt) };
      }
    }
  } catch {
    // Unreadable: as if empty.
  }
  return { userId, beatAt: null, inputAt: null };
}

function writeSharedPresence(userId: string, patch: Partial<Omit<SharedPresence, 'userId'>>): void {
  try {
    const next = { ...readSharedPresence(userId), ...patch };
    globalThis.localStorage.setItem(PRESENCE_SHARED_KEY, JSON.stringify(next));
  } catch {
    // Without storage every tab beats on its own.
  }
}

// --------------------------------------------------------------------------------- beat

function rpcUrl(baseUrl: string, name: string): string {
  return new URL(`rest/v1/rpc/${name}`, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`).href;
}

/**
 * Sends one beat with `accessToken`. Resolves to the HTTP status, or 0 when the server could not be
 * reached. The token goes only to the project of the build, in a header.
 */
export async function postHeartbeat(
  config: SupabasePublicConfig,
  accessToken: string,
  active: boolean,
  fetcher: typeof fetch = fetch,
): Promise<number> {
  try {
    const response = await fetcher(rpcUrl(config.url, HEARTBEAT_RPC), {
      method: 'POST',
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        // Egress (9.16.4): the function returns no body.
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ [HEARTBEAT_ARG]: active }),
      credentials: 'omit',
      keepalive: true,
    });
    return response.status;
  } catch {
    return 0;
  }
}

/**
 * A valid session from supabase-js: `getSession` renews an access token that expires soon, and
 * `force` asks for a new one after the database refused the current one. A refresh token that is
 * no longer valid makes supabase-js remove the session, and the next tick stops.
 */
async function renewSession(force: boolean): Promise<StoredSession | null> {
  try {
    const { getSupabaseBrowserClient } = await import('@/lib/supabase/client');
    const client = await getSupabaseBrowserClient();
    if (client === null) return null;
    const { data } = force ? await client.auth.refreshSession() : await client.auth.getSession();
    const session = data.session;
    if (!session) return null;
    return {
      accessToken: session.access_token,
      expiresAt: session.expires_at ? session.expires_at * 1000 : null,
      userId: session.user.id,
    };
  } catch {
    return null;
  }
}

/** What the loop does after a beat: go on, or stop because the beat can never succeed. */
export type BeatOutcome = 'continue' | 'stop';

/** The outcome of a beat's HTTP status. */
export function beatOutcome(status: number): BeatOutcome {
  // 400 bad argument, 403 refused account (42501), 404 no such function: repeating cannot help.
  return status === 400 || status === 403 || status === 404 ? 'stop' : 'continue';
}

async function beat(
  config: SupabasePublicConfig,
  session: StoredSession,
  active: boolean,
): Promise<BeatOutcome> {
  let current: StoredSession | null = session;
  if (current.expiresAt !== null && current.expiresAt - Date.now() < EXPIRY_MARGIN_MS) {
    current = await renewSession(false);
    if (current === null) return 'continue';
  }
  let status = await postHeartbeat(config, current.accessToken, active);
  if (status === 401) {
    current = await renewSession(true);
    if (current === null) return 'continue';
    status = await postHeartbeat(config, current.accessToken, active);
  }
  return beatOutcome(status);
}

// --------------------------------------------------------------------------------- loop

let running: (() => void) | null = null;

/**
 * Starts the heartbeat of the signed-in account in this tab and returns the function that stops
 * it. A second call while it runs returns the same function. Without account mode or without a
 * stored session it does nothing.
 */
export function startPresence(): () => void {
  if (running !== null) return running;
  if (typeof window === 'undefined') return () => undefined;
  let config: SupabasePublicConfig | null;
  try {
    config = getSupabasePublicConfig();
  } catch {
    config = null;
  }
  if (config === null || readStoredSession() === null) return () => undefined;
  const project = config;

  let timer: ReturnType<typeof setInterval> | undefined;
  let busy = false;
  let localInputAt: number | null = null;
  let writtenInputAt = 0;
  let owner: string | null = null;

  const onInput = () => {
    const now = Date.now();
    localInputAt = now;
    if (owner !== null && now - writtenInputAt >= INPUT_WRITE_MS) {
      writtenInputAt = now;
      writeSharedPresence(owner, { inputAt: now });
    }
  };

  async function tick(): Promise<void> {
    // Egress (9.16.4): a hidden tab never beats; `visibilitychange` resumes it.
    if (busy || document.visibilityState === 'hidden') return;
    const session = readStoredSession();
    if (session === null) {
      stop();
      return;
    }
    owner = session.userId;
    const now = Date.now();
    const shared = readSharedPresence(session.userId);
    if (localInputAt !== null && (shared.inputAt === null || localInputAt > shared.inputAt)) {
      writeSharedPresence(session.userId, { inputAt: localInputAt });
    }
    const lastInputAt = Math.max(localInputAt ?? -Infinity, shared.inputAt ?? -Infinity);
    const plan = planBeat({
      now,
      lastBeatAt: shared.beatAt,
      lastInputAt: Number.isFinite(lastInputAt) ? lastInputAt : null,
    });
    if (!plan.send) return;
    // Claimed before sending, so the other tabs skip this beat.
    writeSharedPresence(session.userId, { beatAt: now });
    busy = true;
    try {
      if ((await beat(project, session, plan.active)) === 'stop') stop();
    } finally {
      busy = false;
    }
  }

  const run = () => void tick();
  const onVisible = () => {
    if (document.visibilityState === 'visible') run();
  };
  const inputOptions: AddEventListenerOptions = { capture: true, passive: true };
  const inputEvents = ['keydown', 'pointerdown', 'pointermove', 'wheel'] as const;

  function stop(): void {
    if (timer !== undefined) clearInterval(timer);
    timer = undefined;
    for (const type of inputEvents) window.removeEventListener(type, onInput, inputOptions);
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('online', run);
    if (running === stop) running = null;
  }

  for (const type of inputEvents) window.addEventListener(type, onInput, inputOptions);
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('online', run);
  timer = setInterval(run, BEAT_INTERVAL_MS);
  running = stop;
  run();
  return stop;
}
