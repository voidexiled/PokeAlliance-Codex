// Pure rules of the access and registration cards (Direction D, spec 9.15.1): the code boxes,
// the resend countdown, the password checks, the birth date of step 3 and what a return to
// `/{l}/cuenta/` brought (a confirmation link, a provider that refused a link). No DOM, no
// Supabase: tests/account/auth-logic.test.ts covers them.

/** The code of the confirmation mail (`otp_length`, supabase/config.toml). */
export const CODE_LENGTH = 6;
/** Seconds before «Reenviar código» / «Reenviar enlace» come back (Auth `max_frequency`). */
export const RESEND_SECONDS = 60;
/** After this long without leaving for the provider, step 2 says it is slow. */
export const SLOW_LINK_MS = 10_000;
/** The query mark of the confirmation link: `emailRedirectTo` carries it (9.15.1). */
export const CONFIRMED_PARAM = 'confirmado';

/** The digits of what was typed or pasted into the code input, at most six. */
export function codeDigits(value: string): string {
  return value.replace(/\D/g, '').slice(0, CODE_LENGTH);
}

/** Whole seconds from `now` until `until` (both in ms), never below zero. */
export function secondsLeft(until: number, now: number): number {
  return Math.max(0, Math.ceil((until - now) / 1000));
}

/** «0:42», «1:05»: the countdown of «Reenviar código en …». */
export function formatCountdown(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const rest = whole % 60;
  return `${Math.floor(whole / 60)}:${rest < 10 ? '0' : ''}${rest}`;
}

/** Characters as a person counts them (code points), for «10 caracteres o más». */
export function passwordLength(password: string): number {
  return [...password].length;
}

/**
 * The `YYYY-MM-DD` of the day, month (1–12) and year fields of step 3, or null while they do
 * not make a calendar date (31 April, a two-digit year, an empty field).
 */
export function composeBirthDate(day: string, month: string, year: string): string | null {
  if (!/^\d{1,2}$/.test(day.trim()) || !/^\d{1,2}$/.test(month.trim())) return null;
  if (!/^\d{4}$/.test(year.trim())) return null;
  const d = Number(day);
  const m = Number(month);
  const y = Number(year);
  if (m < 1 || m > 12 || d < 1) return null;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  if (d > last) return null;
  return `${String(y)}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export type ReturnProvider = 'discord' | 'google' | 'twitch';

/**
 * What a return to the page means, from the `error_code` (or `error`) of the address and the
 * provider of a pending link:
 * - `taken`: that provider account is already on another account (`identity_already_exists`);
 * - `cancelled`: the person pressed «Cancel» at the provider (`access_denied` after a link);
 * - `linkUsed`: a mail link that expired or was used (`otp_expired`, or `access_denied` with no
 *   pending link);
 * - `down`: the provider did not answer (`server_error`, `temporarily_unavailable`,
 *   `bad_oauth_callback`, `unexpected_failure` after a link);
 * - `other`: any other code, shown with the §12.14.1 text.
 */
export type ReturnKind = 'taken' | 'cancelled' | 'linkUsed' | 'down' | 'other';

const PROVIDER_DOWN: ReadonlySet<string> = new Set([
  'server_error',
  'temporarily_unavailable',
  'bad_oauth_callback',
  'bad_oauth_state',
  'unexpected_failure',
]);

export function classifyReturn(
  code: string | null,
  provider: ReturnProvider | null,
): ReturnKind | null {
  if (code === null || code === '') return null;
  if (code === 'identity_already_exists') return provider === null ? 'other' : 'taken';
  if (code === 'otp_expired') return 'linkUsed';
  if (code === 'access_denied') return provider === null ? 'linkUsed' : 'cancelled';
  if (provider !== null && PROVIDER_DOWN.has(code)) return 'down';
  return 'other';
}

/** How the page was opened from a confirmation link: confirmed, or a link that no longer works. */
export type ConfirmationArrival = 'confirmed' | 'linkUsed' | null;

/** Reads a confirmation return from an address (the mark and any error the link brought). */
export function confirmationArrival(href: string): ConfirmationArrival {
  const url = new URL(href);
  const hash = new URLSearchParams(url.hash.slice(1));
  if (url.searchParams.get(CONFIRMED_PARAM) !== '1') return null;
  const failed =
    url.searchParams.has('error') ||
    url.searchParams.has('error_code') ||
    hash.has('error') ||
    hash.has('error_code');
  return failed ? 'linkUsed' : 'confirmed';
}

/** The address without the confirmation mark (the rest, `code` included, stays). */
export function withoutConfirmedMark(href: string): string {
  const url = new URL(href);
  url.searchParams.delete(CONFIRMED_PARAM);
  return url.toString();
}
