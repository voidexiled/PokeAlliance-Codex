import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabasePublicConfig } from './env';
import { operationFailed, type SupabaseOperation } from './errors';

let browserClient: Promise<SupabaseClient | null> | undefined;

/**
 * The browser's only Supabase client, shared by Guild, `/{locale}/cuenta/` and
 * Comercio. It carries the anon key alone; what an account may read or write
 * is decided by RLS and the database functions. Null during server rendering
 * and when the public configuration is missing.
 *
 * supabase-js is loaded on demand, only when the build has the public settings
 * (§9.3): it is not part of the initial JS of any page (§13.6), and a build
 * without account mode never downloads it. The promise rejects when that chunk
 * cannot be loaded; the callers stay in local mode then.
 */
export function getSupabaseBrowserClient(): Promise<SupabaseClient | null> {
  if (typeof window === 'undefined') {
    return Promise.resolve(null);
  }

  if (browserClient === undefined) {
    const config = getSupabasePublicConfig();
    browserClient =
      config === null
        ? Promise.resolve(null)
        : import('@supabase/supabase-js').then(({ createClient }) =>
            createClient(config.url, config.anonKey, {
              auth: {
                // PKCE keeps tokens out of the URL of confirmation and reset links.
                flowType: 'pkce',
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true,
              },
            }),
          );
    // A failed load is not kept: the next call tries again.
    browserClient.catch(() => {
      browserClient = undefined;
    });
  }
  return browserClient;
}

/**
 * Calls a database function. A failure comes back reduced to its code
 * (§12.14.1); `toData` shapes a successful answer.
 */
export async function callRpc<Row, T>(
  client: SupabaseClient,
  name: string,
  args: Record<string, unknown>,
  toData: (data: Row) => T,
): Promise<SupabaseOperation<T>> {
  const { data, error, status } = await client.rpc(name, args);
  if (error) return operationFailed(error, status);
  return { data: toData(data as Row), error: null };
}

/**
 * The row of a function answer: PostgREST sends an array for `returns table`
 * and an object for a function that returns one composite row.
 */
export function firstRow<T>(data: unknown): T | null {
  if (Array.isArray(data)) return (data[0] as T | undefined) ?? null;
  return (data as T | null) ?? null;
}
