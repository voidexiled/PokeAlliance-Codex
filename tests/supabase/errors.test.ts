import { describe, expect, it } from 'vitest';

import {
  classifySupabaseError,
  mapSupabaseError,
  operationFailed,
  toSupabaseFailure,
} from '@/lib/supabase/errors';

// §12.14.1: code → Spanish and English text.
const CODES: Array<[code: string, es: string, en: string]> = [
  ['invalid_credentials', 'Correo o contraseña incorrectos.', 'Wrong email or password.'],
  [
    'user_already_exists',
    'Ya existe una cuenta con ese correo.',
    'An account with that email already exists.',
  ],
  ['weak_password', 'La contraseña es demasiado corta.', 'The password is too short.'],
  [
    'email_not_confirmed',
    'Confirma tu correo antes de iniciar sesión.',
    'Confirm your email before signing in.',
  ],
  [
    'over_email_send_rate_limit',
    'Demasiados intentos. Espera un momento.',
    'Too many attempts. Please wait a moment.',
  ],
  [
    'over_request_rate_limit',
    'Demasiados intentos. Espera un momento.',
    'Too many attempts. Please wait a moment.',
  ],
  [
    '42501',
    'Tu sesión expiró o no tienes permiso. Vuelve a iniciar sesión.',
    'Your session expired or you lack permission. Sign in again.',
  ],
  [
    'PGRST301',
    'Tu sesión expiró o no tienes permiso. Vuelve a iniciar sesión.',
    'Your session expired or you lack permission. Sign in again.',
  ],
];

const GENERIC = {
  es: 'No se pudo completar la operación.',
  en: 'The operation could not be completed.',
};
const NETWORK = { es: 'Sin conexión con el servidor.', en: "Can't reach the server." };

describe('mapSupabaseError', () => {
  it.each(CODES)('maps %s', (code, es, en) => {
    // The message is the server's and never decides the text.
    const error = { name: 'AuthApiError', code, message: 'duplicate key value', status: 400 };
    expect(mapSupabaseError(error, 'es')).toBe(es);
    expect(mapSupabaseError(error, 'en')).toBe(en);
  });

  it('names the guild for 23505 only when creating one', () => {
    const error = { code: '23505', message: 'duplicate key value violates unique constraint' };
    expect(mapSupabaseError(error, 'es', 'createGuild')).toBe(
      'Ya existe una guild con ese nombre.',
    );
    expect(mapSupabaseError(error, 'en', 'createGuild')).toBe(
      'A guild with that name already exists.',
    );
    expect(mapSupabaseError(error, 'es')).toBe(GENERIC.es);
  });

  it('reports a failed fetch as a network error', () => {
    const fetchError = new TypeError('Failed to fetch');
    expect(mapSupabaseError(fetchError, 'es')).toBe(NETWORK.es);
    expect(mapSupabaseError(fetchError, 'en')).toBe(NETWORK.en);

    // PostgREST answers a failed fetch with status 0 and an empty code.
    const postgrest = { code: '', message: 'TypeError: Failed to fetch', details: '', hint: '' };
    expect(mapSupabaseError(toSupabaseFailure(postgrest, 0), 'es')).toBe(NETWORK.es);

    // Supabase Auth throws AuthRetryableFetchError with status 0.
    const auth = { name: 'AuthRetryableFetchError', message: 'Load failed', status: 0 };
    expect(mapSupabaseError(auth, 'en')).toBe(NETWORK.en);
  });

  it.each([
    ['another code', { code: 'P0002', message: 'The invitation is not valid or has expired' }],
    ['a validation code', { code: '22023', message: 'The guild settings are not valid' }],
    ['a message without code', { message: 'Invalid login credentials' }],
    ['a blank code', { code: '  ', message: 'x' }],
    ['an Error', new Error('boom')],
    ['a string', 'boom'],
    ['null', null],
    ['undefined', undefined],
  ])('falls back to the generic text for %s', (_label, error) => {
    expect(mapSupabaseError(error, 'es')).toBe(GENERIC.es);
    expect(mapSupabaseError(error, 'en')).toBe(GENERIC.en);
  });
});

describe('toSupabaseFailure', () => {
  it('keeps the code and nothing of the message', () => {
    expect(toSupabaseFailure({ code: ' 42501 ', message: 'permission denied' }, 403)).toEqual({
      code: '42501',
      network: false,
    });
  });

  it('passes a reduced failure through unchanged', () => {
    const failure = { code: '42501', network: false };
    expect(toSupabaseFailure(failure)).toBe(failure);
    expect(classifySupabaseError(failure)).toBe('sessionOrPermission');
    expect(classifySupabaseError({ code: null, network: true })).toBe('network');
  });

  it('builds the failed operation', () => {
    expect(operationFailed({ code: 'PGRST301' }, 401)).toEqual({
      data: null,
      error: { code: 'PGRST301', network: false },
    });
  });
});
