export interface SupabasePublicConfig {
  url: string;
  anonKey: string;
}

/**
 * The public Supabase settings baked into the build, or null when either is
 * blank: without them the site has no account mode and `/{locale}/cuenta/` is
 * not generated (§9.3).
 */
export function getSupabasePublicConfig(): SupabasePublicConfig | null {
  return readSupabasePublicConfig(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
  );
}

/**
 * Validates the two public values. A malformed URL or a secret key in the
 * public variable throws, so the build that reads it fails instead of
 * shipping the key to every browser.
 */
export function readSupabasePublicConfig(
  rawUrl: string | undefined,
  rawAnonKey: string | undefined,
): SupabasePublicConfig | null {
  const url = rawUrl?.trim();
  const anonKey = rawAnonKey?.trim();

  if (!url || !anonKey) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('PUBLIC_SUPABASE_URL is not a valid URL.');
  }
  // Sessions travel with every request: plain http only reaches a local stack.
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && isLocalHost(parsed))) {
    throw new Error('PUBLIC_SUPABASE_URL must use https (http only for a local stack).');
  }

  if (isSecretKey(anonKey)) {
    throw new Error(
      'PUBLIC_SUPABASE_ANON_KEY holds a secret key. Use the anon or publishable key; the service role key stays on the server.',
    );
  }

  return { url, anonKey };
}

/** Loopback, a private IPv4 address or a local-only name (a container's host, `*.local`). */
function isLocalHost(url: URL): boolean {
  const host = url.hostname;
  if (host === 'localhost' || host === '[::1]' || /\.(localhost|local|internal)$/.test(host)) {
    return true;
  }
  const octets = /^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(host);
  if (!octets) return false;
  const [first, second] = [Number(octets[1]), Number(octets[2])];
  return (
    first === 127 ||
    first === 10 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

/** New-style secret keys, or a legacy JWT whose role is service_role. */
function isSecretKey(key: string): boolean {
  if (key.startsWith('sb_secret_')) return true;

  const payload = key.split('.')[1];
  if (!payload) return false;

  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const claims: unknown = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')));
    return (
      typeof claims === 'object' &&
      claims !== null &&
      (claims as { role?: unknown }).role === 'service_role'
    );
  } catch {
    return false;
  }
}
