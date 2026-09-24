import { describe, expect, it } from 'vitest';

import { classifySupabaseError, mapSupabaseError, toSupabaseFailure } from '@/lib/supabase/errors';

// GoTrue answers a mail it could not send with 500 and this message; supabase-js throws it as
// an AuthRetryableFetchError that keeps the status and drops `error_code: unexpected_failure`.
const SEND_FAILED = {
  name: 'AuthRetryableFetchError',
  message: 'Error sending confirmation email',
  status: 500,
};

describe('a confirmation mail that was not sent', () => {
  it('is not a network failure and has its own text', () => {
    expect(toSupabaseFailure(SEND_FAILED).network).toBe(false);
    expect(classifySupabaseError(SEND_FAILED)).toBe('confirmationEmail');
    expect(mapSupabaseError(SEND_FAILED, 'es')).toBe(
      'No pudimos enviar el correo de confirmación. Inténtalo más tarde.',
    );
    expect(mapSupabaseError(SEND_FAILED, 'en')).toBe(
      "We couldn't send the confirmation email. Try again later.",
    );
  });

  it('is recognised with the Auth code too', () => {
    const api = {
      name: 'AuthApiError',
      code: 'unexpected_failure',
      message: 'Error sending confirmation email',
      status: 500,
    };
    expect(classifySupabaseError(api)).toBe('confirmationEmail');
  });

  it('keeps other server errors out of the network text', () => {
    const other = { name: 'AuthRetryableFetchError', message: 'Bad Gateway', status: 502 };
    expect(classifySupabaseError(other)).toBe('generic');
    expect(classifySupabaseError({ ...other, status: 0 })).toBe('network');
    expect(classifySupabaseError({ name: 'AuthRetryableFetchError', message: 'x' })).toBe(
      'network',
    );
  });
});
