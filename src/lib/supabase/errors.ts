// Account and remote-data errors (spec §12.14.1). The text a failed Supabase
// call shows is decided by its error code or its error type. The English
// message is read only for the one failure Auth reports without a usable code:
// a confirmation mail it could not send (see `EMAIL_SEND_FAILED`).
import type { Locale } from '@/i18n/config';

/** A failed Supabase call, reduced to what the interface decides on. */
export type SupabaseFailure = {
  /** Postgres SQLSTATE, PostgREST (`PGRST…`) or Supabase Auth code; null when there is none. */
  code: string | null;
  /** True only when there was no HTTP response at all. */
  network: boolean;
};

/** Result of every call in `src/lib/supabase/`: data, or the failure to show. */
export type SupabaseOperation<T> = {
  data: T | null;
  error: SupabaseFailure | null;
};

export type SupabaseErrorKind =
  | 'invalidCredentials'
  | 'userAlreadyExists'
  | 'weakPassword'
  | 'emailNotConfirmed'
  | 'tooManyAttempts'
  | 'sessionOrPermission'
  | 'guildNameTaken'
  | 'confirmationEmail'
  | 'network'
  | 'generic';

/**
 * Our own code for a confirmation mail Auth could not send. GoTrue answers it with a 500,
 * `error_code: unexpected_failure` and the message «Error sending confirmation email» (for
 * example when the mail provider refuses the recipient); supabase-js turns any 5xx into an
 * `AuthRetryableFetchError` that keeps the message and drops the code.
 */
export const EMAIL_SEND_FAILED = 'email_send_failed';

/** The GoTrue messages of a confirmation mail that was not sent (signUp, resend, OTP). */
const EMAIL_SEND_MESSAGE = /^error sending (?:confirmation|signup confirmation) (?:email|otp)/i;

/** Calls whose codes mean something specific: 23505 names a guild only on create. */
export type SupabaseErrorContext = 'createGuild';

const CODE_KINDS: ReadonlyMap<string, SupabaseErrorKind> = new Map([
  ['invalid_credentials', 'invalidCredentials'],
  ['user_already_exists', 'userAlreadyExists'],
  ['weak_password', 'weakPassword'],
  ['email_not_confirmed', 'emailNotConfirmed'],
  ['over_email_send_rate_limit', 'tooManyAttempts'],
  ['over_request_rate_limit', 'tooManyAttempts'],
  ['42501', 'sessionOrPermission'],
  ['PGRST301', 'sessionOrPermission'],
  [EMAIL_SEND_FAILED, 'confirmationEmail'],
]);

const MESSAGES: Readonly<Record<Locale, Readonly<Record<SupabaseErrorKind, string>>>> = {
  es: {
    invalidCredentials: 'Correo o contraseña incorrectos.',
    userAlreadyExists: 'Ya existe una cuenta con ese correo.',
    weakPassword: 'La contraseña es demasiado corta.',
    emailNotConfirmed: 'Confirma tu correo antes de iniciar sesión.',
    tooManyAttempts: 'Demasiados intentos. Espera un momento.',
    sessionOrPermission: 'Tu sesión expiró o no tienes permiso. Vuelve a iniciar sesión.',
    guildNameTaken: 'Ya existe una guild con ese nombre.',
    confirmationEmail: 'No pudimos enviar el correo de confirmación. Inténtalo más tarde.',
    network: 'Sin conexión con el servidor.',
    generic: 'No se pudo completar la operación.',
  },
  en: {
    invalidCredentials: 'Wrong email or password.',
    userAlreadyExists: 'An account with that email already exists.',
    weakPassword: 'The password is too short.',
    emailNotConfirmed: 'Confirm your email before signing in.',
    tooManyAttempts: 'Too many attempts. Please wait a moment.',
    sessionOrPermission: 'Your session expired or you lack permission. Sign in again.',
    guildNameTaken: 'A guild with that name already exists.',
    confirmationEmail: "We couldn't send the confirmation email. Try again later.",
    network: "Can't reach the server.",
    generic: 'The operation could not be completed.',
  },
};

function isSupabaseFailure(value: unknown): value is SupabaseFailure {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<SupabaseFailure>;
  return (
    typeof candidate.network === 'boolean' &&
    (candidate.code === null || typeof candidate.code === 'string')
  );
}

/**
 * Reduces what a Supabase call returned or threw to a {@link SupabaseFailure}.
 * `status` is the HTTP status of a PostgREST response: supabase-js answers a
 * failed fetch with status 0 and no code. Auth reports it as an
 * `AuthRetryableFetchError` with status 0, and a bare fetch throws a `TypeError`.
 * An `AuthRetryableFetchError` with an HTTP status (a 5xx) did reach the server
 * and is not a network failure.
 */
export function toSupabaseFailure(error: unknown, status?: number): SupabaseFailure {
  if (isSupabaseFailure(error)) return error;

  const record =
    typeof error === 'object' && error !== null ? (error as Record<string, unknown>) : {};
  const responseStatus = typeof record.status === 'number' ? record.status : status;
  const network =
    error instanceof TypeError ||
    status === 0 ||
    record.status === 0 ||
    (record.name === 'AuthRetryableFetchError' &&
      !(responseStatus !== undefined && responseStatus > 0));
  if (network) return { code: null, network: true };

  if (typeof record.message === 'string' && EMAIL_SEND_MESSAGE.test(record.message.trim())) {
    return { code: EMAIL_SEND_FAILED, network: false };
  }
  const code = typeof record.code === 'string' && record.code.trim() ? record.code.trim() : null;
  return { code, network: false };
}

/** The failed form of a {@link SupabaseOperation}. */
export function operationFailed<T>(error: unknown, status?: number): SupabaseOperation<T> {
  return { data: null, error: toSupabaseFailure(error, status) };
}

export function classifySupabaseError(
  error: unknown,
  context?: SupabaseErrorContext,
): SupabaseErrorKind {
  const failure = toSupabaseFailure(error);
  if (failure.network) return 'network';
  if (failure.code === null) return 'generic';
  if (failure.code === '23505') return context === 'createGuild' ? 'guildNameTaken' : 'generic';
  return CODE_KINDS.get(failure.code) ?? 'generic';
}

/** The text of §12.14.1 for a failed call, in the page's locale. */
export function mapSupabaseError(
  error: unknown,
  locale: Locale,
  context?: SupabaseErrorContext,
): string {
  return MESSAGES[locale][classifySupabaseError(error, context)];
}
