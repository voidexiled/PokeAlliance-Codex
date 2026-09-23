// The LOCAL Supabase stack (`supabase start`) for the account-mode specs (§10.13, OG-1).
//
// Its URL and keys come from `supabase status -o env`: the public development defaults of the
// stack on this machine. Only a loopback address is accepted, so no spec can ever reach the
// remote project that .env names. playwright.config.ts calls `localSupabase()` once in the
// runner and starts the account-mode server with it; the answer is left in the environment,
// which the workers inherit, so the CLI runs once per run. Without a local stack (CI, or
// `supabase start` not run) the answer is null and the account-mode specs skip.
import { execFileSync } from 'node:child_process';

/** The development server of the account-mode specs, pointed at the local stack. */
export const ACCOUNT_ORIGIN = 'http://127.0.0.1:4323';

export interface LocalSupabase {
  url: string;
  anonKey: string;
  /** Server-side only: the specs clean up their test accounts with it, never a page. */
  serviceRoleKey: string;
}

const ENV = {
  url: 'AC_E2E_SUPABASE_URL',
  anonKey: 'AC_E2E_SUPABASE_ANON_KEY',
  serviceRoleKey: 'AC_E2E_SUPABASE_SERVICE_ROLE_KEY',
} as const;

function isLoopback(url: string): boolean {
  try {
    return ['127.0.0.1', 'localhost', '[::1]'].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

function readStatus(): LocalSupabase | null {
  let output: string;
  try {
    output = execFileSync('supabase', ['status', '-o', 'env'], {
      encoding: 'utf8',
      timeout: 30_000,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
  const values = new Map<string, string>();
  for (const line of output.split(/\r?\n/)) {
    const match = /^([A-Z_]+)="?([^"]*)"?$/.exec(line.trim());
    if (match) values.set(match[1], match[2]);
  }
  const url = values.get('API_URL');
  const anonKey = values.get('ANON_KEY');
  const serviceRoleKey = values.get('SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceRoleKey || !isLoopback(url)) return null;
  return { url, anonKey, serviceRoleKey };
}

/** The local stack, or null when `supabase status` reports none on a loopback address. */
export function localSupabase(): LocalSupabase | null {
  if (process.env[ENV.url] === undefined) {
    const stack = readStatus();
    process.env[ENV.url] = stack?.url ?? '';
    process.env[ENV.anonKey] = stack?.anonKey ?? '';
    process.env[ENV.serviceRoleKey] = stack?.serviceRoleKey ?? '';
  }
  const url = process.env[ENV.url] ?? '';
  const anonKey = process.env[ENV.anonKey] ?? '';
  const serviceRoleKey = process.env[ENV.serviceRoleKey] ?? '';
  return url && anonKey && serviceRoleKey && isLoopback(url)
    ? { url, anonKey, serviceRoleKey }
    : null;
}
