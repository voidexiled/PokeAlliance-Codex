import type { ReactNode } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Locale } from '@/i18n/config';
import { mapSupabaseError, toSupabaseFailure } from '@/lib/supabase/errors';

import type { AccountMessages, UiLabels } from '../AccountPanel';
import { authTexts } from './texts';
import { CONFIRMED_PARAM } from './logic';

// What every access and registration card shares: the props of a form, the field helpers that
// ChannelsPanel and AccountPanel also import (through RegistrationSteps.tsx), the error lines
// decided by code (12.14.1) and the two things a return to the page brings: the provider of a
// pending `linkIdentity` and the mark of a confirmation link.

export interface FormBaseProps {
  client: SupabaseClient;
  locale: Locale;
  messages: AccountMessages;
  ui: UiLabels;
}

export function accountUrl(locale: Locale): string {
  return new URL(`/${locale}/cuenta/`, window.location.origin).toString();
}

/** `emailRedirectTo` of the confirmation mail: this page with the mark it reads on return. */
export function confirmationUrl(locale: Locale): string {
  const url = new URL(`/${locale}/cuenta/`, window.location.origin);
  url.searchParams.set(CONFIRMED_PARAM, '1');
  return url.toString();
}

/** `redirectTo` of «¿Olvidaste tu contraseña?»: the page that sets the new password. */
export function resetUrl(locale: Locale): string {
  return new URL(`/${locale}/cuenta/restablecer/`, window.location.origin).toString();
}

export function errorId(id: string): string {
  return `${id}-error`;
}

/** `aria-invalid` and the error line of a field that takes them by props. */
export function invalidProps(error: string | undefined, id: string) {
  return error === undefined
    ? {}
    : { 'aria-invalid': true as const, 'aria-describedby': errorId(id) };
}

/** A field and the error line under it, joined with `aria-describedby` (9.7.5, 13.7). */
export function Field({
  id,
  error,
  children,
}: {
  id: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="ac-account-field">
      {children}
      {error === undefined ? null : (
        <p id={errorId(id)} className="ac-account-field__error">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * `aria-invalid` and the error line on the trigger of a `Select`, which spreads its extra props
 * on its root (the same limit ListingForm works around).
 */
export function markSelect(id: string, error: string | undefined): void {
  const trigger = document.getElementById(id);
  if (trigger === null) return;
  if (error === undefined) {
    trigger.removeAttribute('aria-invalid');
    trigger.removeAttribute('aria-describedby');
  } else {
    trigger.setAttribute('aria-invalid', 'true');
    trigger.setAttribute('aria-describedby', errorId(id));
  }
}

export function focusField(id: string): void {
  document.getElementById(id)?.focus();
}

/** The line of a refused code: expired or wrong (`otp_expired`), or the §12.14.1 text. */
export function codeError(error: unknown, locale: Locale, messages: AccountMessages): string {
  const failure = toSupabaseFailure(error);
  if (failure.code === 'otp_expired') return authTexts(messages).codeInvalid;
  return mapSupabaseError(failure, locale);
}

/**
 * The fixed token of a refusal of our own hook or function (`email_taken`…), which Auth passes
 * on as the message; null for any other message (the English prose of Supabase is never read).
 */
function refusalToken(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) return null;
  const message = (error as { message?: unknown }).message;
  return typeof message === 'string' && /^[a-z]+(?:_[a-z]+)*$/.test(message) ? message : null;
}

/** An address already in use: GoTrue's codes and the hook's token (9.15.1). */
const EMAIL_TAKEN: ReadonlySet<string> = new Set([
  'user_already_exists',
  'email_exists',
  'email_taken',
]);
/** An address whose domain the hook refuses (`blocked_email_domains`, 9.15.1). */
const EMAIL_BLOCKED: ReadonlySet<string> = new Set(['email_domain_blocked']);

/**
 * Why a sign-up was refused: an address that already has an account (GoTrue, or the
 * `before_user_created` hook with the normalized address of 9.15.1), a disposable domain (the
 * hook), or anything else (the §12.14.1 text).
 */
export function signUpRefusal(error: unknown): 'taken' | 'disposable' | 'other' {
  const failure = toSupabaseFailure(error);
  const reasons = [failure.code, refusalToken(error)];
  if (reasons.some((reason) => reason !== null && EMAIL_TAKEN.has(reason))) return 'taken';
  if (reasons.some((reason) => reason !== null && EMAIL_BLOCKED.has(reason))) return 'disposable';
  return 'other';
}

// ------------------------------------------------------------------ linked identities

export type LinkProvider = 'discord' | 'google' | 'twitch';

/** The provider of a pending `linkIdentity`, kept across its redirect (sessionStorage). */
const LINKING_KEY = 'alliance-codex:vinculando';

/** The provider the last `takeLinkingProvider` read: step 2 shows its linked row once. */
let returnedFrom: LinkProvider | null = null;

/**
 * Leaves for the provider with `linkIdentity` (9.9, 9.15.1); the browser comes back to this
 * page. It resolves with the error when the redirect could not start.
 */
export async function linkProvider(
  client: SupabaseClient,
  provider: LinkProvider,
  locale: Locale,
): Promise<unknown> {
  try {
    sessionStorage.setItem(LINKING_KEY, provider);
  } catch {
    // Without storage the page cannot name the provider of a refused link: the line is generic.
  }
  const { error } = await client.auth.linkIdentity({
    provider,
    options: { redirectTo: accountUrl(locale) },
  });
  if (error) forgetLinking();
  return error;
}

function forgetLinking(): void {
  try {
    sessionStorage.removeItem(LINKING_KEY);
  } catch {
    // Nothing kept.
  }
}

/** The provider of the `linkIdentity` that brought the browser back, read once. */
export function takeLinkingProvider(): LinkProvider | null {
  let value: string | null;
  try {
    value = sessionStorage.getItem(LINKING_KEY);
  } catch {
    return null;
  }
  forgetLinking();
  returnedFrom = value === 'discord' || value === 'google' || value === 'twitch' ? value : null;
  return returnedFrom;
}

/** The provider this visit came back from (after `takeLinkingProvider`), until step 2 shows it. */
export function returnedProvider(): LinkProvider | null {
  return returnedFrom;
}

export function forgetReturnedProvider(): void {
  returnedFrom = null;
}

// The confirmation link: auth/arrival.ts (tiny, so the page can read it before anything else).
export { confirmationReturn, forgetConfirmationReturn } from './arrival';
