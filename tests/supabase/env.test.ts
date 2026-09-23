// The public Supabase settings of the build (§9.3, §13.8): blank means no account mode, and a
// value that would leak a secret or send sessions over plain http to a remote host stops the
// build instead of shipping.
import { describe, expect, it } from 'vitest';

import { readSupabasePublicConfig } from '@/lib/supabase/env';

/** A JWT-shaped key whose payload names a role; the signature is never checked here. */
function jwt(role: string): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ role })}.signature`;
}

describe('readSupabasePublicConfig', () => {
  it('is null when either value is blank: the site has no account mode', () => {
    expect(readSupabasePublicConfig(undefined, undefined)).toBeNull();
    expect(readSupabasePublicConfig('', 'sb_publishable_x')).toBeNull();
    expect(readSupabasePublicConfig('https://example.supabase.co', '  ')).toBeNull();
  });

  it('accepts https and a publishable or anon key', () => {
    expect(readSupabasePublicConfig(' https://example.supabase.co ', 'sb_publishable_x')).toEqual({
      url: 'https://example.supabase.co',
      anonKey: 'sb_publishable_x',
    });
    expect(readSupabasePublicConfig('https://example.supabase.co', jwt('anon'))).not.toBeNull();
  });

  it('accepts plain http only for a local stack', () => {
    for (const url of [
      'http://127.0.0.1:54321',
      'http://localhost:54321',
      'http://192.168.1.20:54321',
      'http://supabase.local:54321',
    ]) {
      expect(readSupabasePublicConfig(url, 'sb_publishable_x')?.url).toBe(url);
    }
    expect(() =>
      readSupabasePublicConfig('http://example.supabase.co', 'sb_publishable_x'),
    ).toThrow(/https/);
    expect(() => readSupabasePublicConfig('http://8.8.8.8', 'sb_publishable_x')).toThrow(/https/);
  });

  it('refuses a malformed URL', () => {
    expect(() => readSupabasePublicConfig('not a url', 'sb_publishable_x')).toThrow(/valid URL/);
  });

  it('refuses a secret or service-role key in the public variable', () => {
    expect(() => readSupabasePublicConfig('https://example.supabase.co', 'sb_secret_abc')).toThrow(
      /secret key/,
    );
    expect(() =>
      readSupabasePublicConfig('https://example.supabase.co', jwt('service_role')),
    ).toThrow(/secret key/);
  });
});
