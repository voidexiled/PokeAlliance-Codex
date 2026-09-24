import { useEffect, useId, useMemo, useState } from 'react';
import type { ReactNode, SubmitEvent } from 'react';
import type { SupabaseClient, User } from '@supabase/supabase-js';

import type { Locale } from '@/i18n/config';
import { fill } from '@/i18n/messages/types';
import {
  CONTRASENA_MAX_BYTES,
  EMAIL_MAX,
  birthDateProblem,
  latestBirthDate,
  playerNameProblem,
  registrationSteps,
  usernameProblem,
  type RegistrationStep,
} from '@/lib/account/registration';
import { classifySupabaseError, mapSupabaseError, toSupabaseFailure } from '@/lib/supabase/errors';
import type { SupabaseFailure } from '@/lib/supabase/errors';
import {
  CONTRASENA_MIN,
  EDAD_MINIMA_CUENTA,
  NOMBRE_JUGADOR_MAX,
  NOMBRE_USUARIO_MAX,
} from '@/lib/trade/limits';

import { FactLine } from '@/components/content/FactLine';
import { Notice } from '@/components/content/Notice';
import { Button } from '@/components/controls/Button';
import { Checkbox } from '@/components/controls/Checkbox';
import { Select } from '@/components/controls/Select';
import type { SelectOption } from '@/components/controls/Select';
import { TextField, fieldId } from '@/components/controls/TextField';
import { TextLink } from '@/components/controls/TextLink';
import { ToggleGroup } from '@/components/controls/ToggleGroup';

import type {
  AccountMessages,
  AccountWorld,
  AuthProviders,
  LegalLinks,
  UiLabels,
} from './AccountPanel';
import { TurnstileWidget } from './TurnstileWidget';

// The access and registration forms of `/{l}/cuenta/` (spec 9.9 «Acceso», 9.15.1), which
// AccountPanel composes. Registration applies to every account (9.15.1): until its three steps
// are done the page shows only the steps.
//
// - `AccessForm`: «Entrar» / «Crear cuenta» with the Turnstile check, «¿Olvidaste tu
//   contraseña?», and step 1: email and password, then the 6-digit code of the confirmation
//   mail (`EmailCodeForm`, `verifyOtp`) with «Reenviar código».
// - `RegistrationSteps`: the steps a signed-in account has not done: the code (only when the
//   session came without a confirmed email), «Vincular Discord» / «Vincular Google»
//   (`linkIdentity`, back to this page), the phone with TELEFONO_OBLIGATORIO (step 2b) and the
//   profile form.
// - `ProfileForm`: step 3 and, in «Perfil», the fields 9.16.3 lets the account change (country,
//   player and world, and the username until the first listing; never the birth date).
// - `PhoneVerification` / `PhoneForm`: the phone rows of «Verificación» (9.9), only with
//   TELEFONO_OBLIGATORIO: the country Select with its calling code, «Número», «Enviar código»
//   (`updateUser({ phone })`), «Código» and «Verificar» (`verifyOtp` with `phone_change`).
// - `NewPasswordForm`: the new password after a «¿Olvidaste tu contraseña?» link.
//
// Every limit comes from src/lib/trade/limits.ts and the database enforces it again (9.12.3):
// a form only says a limit before the server refuses it. The data calls that are not Supabase
// Auth arrive by props from AccountPanel. Every error is shown with `mapSupabaseError`
// (12.14.1); the few codes that name a field of these forms get their own dictionary line,
// decided by code, never by message.

// --------------------------------------------------------------------------- limits

/** The code of the confirmation mail and of the SMS (`otp_length`, supabase/config.toml). */
const CODE = /^\d{6}$/;
const CODE_LENGTH = 6;
/** The oldest birth date the date field offers. */
const BIRTH_MIN = '1900-01-01';
/** E.164: at most 15 digits with the country code. */
const E164_DIGITS_MAX = 15;
/** The shortest national number the phone form accepts. */
const NATIONAL_DIGITS_MIN = 4;

// ------------------------------------------------------------------------ countries

/** ISO 3166-1 alpha-2, the 249 officially assigned codes (9.15.1 «País»). */
const COUNTRY_CODES =
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(
    ' ',
  );

/**
 * E.164 country calling codes by ISO code (ITU-T E.164 assignments), for the phone form of 9.9.
 * Bouvet Island and Heard Island have no telephone code and are absent; the countries of the
 * North American plan share `1` and dial their area code as part of the number.
 */
const DIAL_CODES =
  'AD376 AE971 AF93 AG1 AI1 AL355 AM374 AO244 AQ672 AR54 AS1 AT43 AU61 AW297 AX358 AZ994 BA387 BB1 BD880 BE32 BF226 BG359 BH973 BI257 BJ229 BL590 BM1 BN673 BO591 BQ599 BR55 BS1 BT975 BW267 BY375 BZ501 CA1 CC61 CD243 CF236 CG242 CH41 CI225 CK682 CL56 CM237 CN86 CO57 CR506 CU53 CV238 CW599 CX61 CY357 CZ420 DE49 DJ253 DK45 DM1 DO1 DZ213 EC593 EE372 EG20 EH212 ER291 ES34 ET251 FI358 FJ679 FK500 FM691 FO298 FR33 GA241 GB44 GD1 GE995 GF594 GG44 GH233 GI350 GL299 GM220 GN224 GP590 GQ240 GR30 GS500 GT502 GU1 GW245 GY592 HK852 HN504 HR385 HT509 HU36 ID62 IE353 IL972 IM44 IN91 IO246 IQ964 IR98 IS354 IT39 JE44 JM1 JO962 JP81 KE254 KG996 KH855 KI686 KM269 KN1 KP850 KR82 KW965 KY1 KZ7 LA856 LB961 LC1 LI423 LK94 LR231 LS266 LT370 LU352 LV371 LY218 MA212 MC377 MD373 ME382 MF590 MG261 MH692 MK389 ML223 MM95 MN976 MO853 MP1 MQ596 MR222 MS1 MT356 MU230 MV960 MW265 MX52 MY60 MZ258 NA264 NC687 NE227 NF672 NG234 NI505 NL31 NO47 NP977 NR674 NU683 NZ64 OM968 PA507 PE51 PF689 PG675 PH63 PK92 PL48 PM508 PN64 PR1 PS970 PT351 PW680 PY595 QA974 RE262 RO40 RS381 RU7 RW250 SA966 SB677 SC248 SD249 SE46 SG65 SH290 SI386 SJ47 SK421 SL232 SM378 SN221 SO252 SR597 SS211 ST239 SV503 SX1 SY963 SZ268 TC1 TD235 TF262 TG228 TH66 TJ992 TK690 TL670 TM993 TN216 TO676 TR90 TT1 TV688 TW886 TZ255 UA380 UG256 UM1 US1 UY598 UZ998 VA39 VC1 VE58 VG1 VI1 VN84 VU678 WF681 WS685 YE967 YT262 ZA27 ZM260 ZW263';

let dialTable: Map<string, string> | undefined;

function dialCodes(): Map<string, string> {
  dialTable ??= new Map(DIAL_CODES.split(' ').map((entry) => [entry.slice(0, 2), entry.slice(2)]));
  return dialTable;
}

/** The countries by their name in the page's language (Intl.DisplayNames), sorted by it. */
function countryNames(locale: Locale): { code: string; name: string }[] {
  const names = new Intl.DisplayNames([locale], { type: 'region' });
  return COUNTRY_CODES.map((code) => ({ code, name: names.of(code) ?? code })).sort((a, b) =>
    a.name.localeCompare(b.name, locale),
  );
}

/**
 * «+55 ••• ••• 1234» (9.9): the calling code and the last four digits of a phone that GoTrue
 * keeps as E.164 without the plus. The calling code is the longest one the number starts with.
 */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  let code = '';
  for (const dial of dialCodes().values()) {
    if (dial.length > code.length && digits.startsWith(dial)) code = dial;
  }
  const last = digits.slice(-4);
  return code === '' ? `••• ••• ${last}` : `+${code} ••• ••• ${last}`;
}

/** E.164 of a national number typed in any format, or null when it cannot be one. */
function toE164(dial: string | undefined, typed: string): string | null {
  if (!dial) return null;
  // The trunk prefix (0) of a national number is not dialled after the calling code.
  const national = typed.replace(/\D/g, '').replace(/^0+/, '');
  const total = dial.length + national.length;
  if (national.length < NATIONAL_DIGITS_MIN || total > E164_DIGITS_MAX) return null;
  return `+${dial}${national}`;
}

/** The calling code of a phone in E.164 («+55»): the longest code it starts with, or null. */
export function dialCodeOf(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  let code = '';
  for (const dial of dialCodes().values()) {
    if (dial.length > code.length && digits.startsWith(dial)) code = dial;
  }
  return code === '' ? null : `+${code}`;
}

/** Whether a value is an ISO 3166-1 alpha-2 code of the «País» Select (9.15.1). */
export function isCountryCode(value: string): boolean {
  return COUNTRY_CODES.includes(value);
}

// -------------------------------------------------------------------------- helpers

export function accountUrl(locale: Locale): string {
  return new URL(`/${locale}/cuenta/`, window.location.origin).toString();
}

function errorId(id: string): string {
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
function markSelect(id: string, error: string | undefined): void {
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
function codeError(error: unknown, locale: Locale, messages: AccountMessages): string {
  const failure = toSupabaseFailure(error);
  if (failure.code === 'otp_expired') return messages.register.errors.codeExpired;
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

/**
 * The line of a refused sign-up: an address that already has an account (GoTrue, or the
 * `before_user_created` hook with the normalized address of 9.15.1) or a disposable domain (the
 * hook), else the §12.14.1 text.
 */
function signUpError(error: unknown, locale: Locale, messages: AccountMessages): string {
  const failure = toSupabaseFailure(error);
  const text = messages.register.errors;
  const reasons = [failure.code, refusalToken(error)];
  if (reasons.some((reason) => reason !== null && EMAIL_TAKEN.has(reason))) return text.emailTaken;
  if (reasons.some((reason) => reason !== null && EMAIL_BLOCKED.has(reason))) {
    return text.disposableEmail;
  }
  return mapSupabaseError(failure, locale);
}

/** An address already in use: GoTrue's codes and the hook's token (9.15.1). */
const EMAIL_TAKEN: ReadonlySet<string> = new Set([
  'user_already_exists',
  'email_exists',
  'email_taken',
]);
/** An address whose domain the hook refuses (`blocked_email_domains`, 9.15.1). */
const EMAIL_BLOCKED: ReadonlySet<string> = new Set(['email_domain_blocked']);

// ------------------------------------------------------------------ linked identities

export type LinkProvider = 'discord' | 'google' | 'twitch';

/** The provider of a pending `linkIdentity`, kept across its redirect (sessionStorage). */
const LINKING_KEY = 'alliance-codex:vinculando';

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
  return value === 'discord' || value === 'google' || value === 'twitch' ? value : null;
}

// ------------------------------------------------------------------------ the captcha

/**
 * The Turnstile token of a form (D-B3): null while it loads, after each request (a token works
 * once) and without a site key, where no request needs one.
 */
function useCaptcha(siteKey: string | null) {
  const [token, setToken] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  return {
    missing: siteKey !== null && token === null,
    failed,
    /** The `captchaToken` option of an Auth call. */
    options: token === null ? {} : { captchaToken: token },
    /** After a request: the token is spent, ask for another. */
    spend: () => {
      if (siteKey === null) return;
      setToken(null);
      setResetKey((value) => value + 1);
    },
    retry: () => {
      setFailed(false);
      setAttempt((value) => value + 1);
    },
    widget: (locale: Locale) =>
      siteKey === null ? null : (
        <TurnstileWidget
          key={attempt}
          siteKey={siteKey}
          locale={locale}
          resetKey={resetKey}
          onToken={(next) => {
            setToken(next);
            if (next !== null) setFailed(false);
          }}
          onError={() => setFailed(true)}
        />
      ),
  };
}

type Captcha = ReturnType<typeof useCaptcha>;

function CaptchaNotice({
  captcha,
  messages,
  ui,
}: {
  captcha: Captcha;
  messages: AccountMessages;
  ui: UiLabels;
}) {
  if (!captcha.failed) return null;
  return (
    <Notice open onClose={captcha.retry} closeLabel={ui.dismiss}>
      {messages.access.captchaError} <Button onClick={captcha.retry}>{messages.retry}</Button>
    </Notice>
  );
}

function FormNotice({
  text,
  onClose,
  ui,
}: {
  text: string | null;
  onClose: () => void;
  ui: UiLabels;
}) {
  if (text === null) return null;
  return (
    <Notice open onClose={onClose} closeLabel={ui.dismiss}>
      {text}
    </Notice>
  );
}

// ------------------------------------------------------------------------- the steps

export type { RegistrationStep };

/** 9.15.1: three steps; with TELEFONO_OBLIGATORIO the phone is step 2b. */
const STEP_NUMBER: Readonly<Record<RegistrationStep, string>> = {
  credentials: '1',
  identity: '2',
  phone: '2b',
  profile: '3',
};

/**
 * The steps of 9.15.1 as an ordered list, the done ones marked and the current one with
 * `aria-current="step"`; the phone only with TELEFONO_OBLIGATORIO.
 */
export function StepList({
  messages,
  phoneRequired,
  current,
}: {
  messages: AccountMessages;
  phoneRequired: boolean;
  current: RegistrationStep;
}) {
  const text = messages.register;
  const labels: Record<RegistrationStep, string> = {
    credentials: text.credentials,
    identity: text.identity,
    phone: text.phone,
    profile: text.profile,
  };
  const steps = registrationSteps({ phoneRequired });
  const at = steps.indexOf(current);
  return (
    <ol className="ac-account-steps" aria-label={text.steps}>
      {steps.map((step, index) => (
        <li
          key={step}
          className={
            index < at
              ? 'ac-account-steps__item ac-account-steps__item--done'
              : 'ac-account-steps__item'
          }
          aria-current={index === at ? 'step' : undefined}
        >
          <span className="ac-account-steps__number">{STEP_NUMBER[step]}</span>
          {labels[step]}
        </li>
      ))}
    </ol>
  );
}

// --------------------------------------------------------------------- «Acceso» form

type AccessMode = 'signIn' | 'signUp';

interface FormBaseProps {
  client: SupabaseClient;
  locale: Locale;
  messages: AccountMessages;
  ui: UiLabels;
}

export interface AccessFormProps extends FormBaseProps {
  /** PUBLIC_TURNSTILE_SITE_KEY; null renders no check and sends no token (S11). */
  captchaSiteKey: string | null;
  /** TELEFONO_OBLIGATORIO: the phone is a step of the list. */
  phoneRequired: boolean;
}

export function AccessForm({
  client,
  locale,
  messages,
  ui,
  captchaSiteKey,
  phoneRequired,
}: AccessFormProps) {
  const { access } = messages;
  const uid = fieldId(useId());
  const emailId = `${uid}-email`;
  const [mode, setMode] = useState<AccessMode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // Step 1 of 9.15.1: the address the code went to, once the account exists.
  const [confirming, setConfirming] = useState<{ email: string; notice: string | null } | null>(
    null,
  );
  const captcha = useCaptcha(captchaSiteKey);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || captcha.missing) return;
    setPending(true);
    setNotice(null);
    const address = email.trim();
    try {
      if (mode === 'signIn') {
        const { error } = await client.auth.signInWithPassword({
          email: address,
          password,
          options: captcha.options,
        });
        if (error) {
          // An account whose code was never entered goes back to that step.
          if (classifySupabaseError(error) === 'emailNotConfirmed') {
            setPassword('');
            setConfirming({ email: address, notice: mapSupabaseError(error, locale) });
          } else {
            setNotice(mapSupabaseError(error, locale));
          }
        }
      } else {
        const { data, error } = await client.auth.signUp({
          email: address,
          password,
          // A confirmation link in the same mail comes back to this page.
          options: { emailRedirectTo: accountUrl(locale), ...captcha.options },
        });
        if (error) {
          setNotice(signUpError(error, locale, messages));
        } else if (data.session === null) {
          // With confirmations on, GoTrue answers an address it already has with a user
          // without identities instead of an error.
          if (data.user?.identities?.length === 0) {
            setNotice(messages.register.errors.emailTaken);
          } else {
            setPassword('');
            setConfirming({ email: address, notice: null });
          }
        }
        // With a session (confirmations off) the page moves to the next step by itself.
      }
    } catch (caught) {
      setNotice(mapSupabaseError(caught, locale));
    } finally {
      captcha.spend();
      setPending(false);
    }
  }

  async function forgot() {
    const input = document.getElementById(emailId);
    if (input instanceof HTMLInputElement && !input.reportValidity()) return;
    if (pending || captcha.missing) return;
    setPending(true);
    setNotice(null);
    const address = email.trim();
    try {
      const { error } = await client.auth.resetPasswordForEmail(address, {
        redirectTo: accountUrl(locale),
        ...captcha.options,
      });
      setNotice(error ? mapSupabaseError(error, locale) : access.resetSent);
    } catch (caught) {
      setNotice(mapSupabaseError(caught, locale));
    } finally {
      captcha.spend();
      setPending(false);
    }
  }

  if (confirming !== null) {
    return (
      <EmailCodeForm
        client={client}
        locale={locale}
        messages={messages}
        ui={ui}
        email={confirming.email}
        captchaSiteKey={captchaSiteKey}
        phoneRequired={phoneRequired}
        initialNotice={confirming.notice}
        onCancel={() => setConfirming(null)}
      />
    );
  }

  const signIn = mode === 'signIn';
  let submitLabel = signIn ? access.signIn : access.signUp;
  if (pending) submitLabel = signIn ? access.signingIn : messages.creating;

  return (
    <form className="ac-account-form" onSubmit={submit}>
      <ToggleGroup
        label={access.title}
        labelHidden
        options={[
          { value: 'signIn', label: access.signIn },
          { value: 'signUp', label: access.signUp },
        ]}
        value={mode}
        onChange={(value) => {
          setMode(value === 'signUp' ? 'signUp' : 'signIn');
          setNotice(null);
        }}
      />
      {signIn ? null : (
        <StepList messages={messages} phoneRequired={phoneRequired} current="credentials" />
      )}
      <TextField
        id={emailId}
        label={access.email}
        type="email"
        name="email"
        value={email}
        onChange={setEmail}
        inputProps={{ autoComplete: 'email', required: true, maxLength: EMAIL_MAX }}
      />
      <TextField
        label={access.password}
        type="password"
        name="password"
        value={password}
        onChange={setPassword}
        helper={signIn ? undefined : access.passwordHelp}
        inputProps={{
          autoComplete: signIn ? 'current-password' : 'new-password',
          required: true,
          minLength: signIn ? undefined : CONTRASENA_MIN,
          maxLength: CONTRASENA_MAX_BYTES,
        }}
      />
      {captcha.widget(locale)}
      <div className="ac-account-row">
        <Button type="submit" variant="solid" disabled={pending || captcha.missing}>
          {submitLabel}
        </Button>
        {signIn ? (
          <Button onClick={forgot} disabled={pending || captcha.missing}>
            {access.forgot}
          </Button>
        ) : null}
      </div>
      <CaptchaNotice captcha={captcha} messages={messages} ui={ui} />
      <FormNotice text={notice} onClose={() => setNotice(null)} ui={ui} />
    </form>
  );
}

export interface EmailCodeFormProps extends FormBaseProps {
  /** The address the code went to. */
  email: string;
  captchaSiteKey: string | null;
  phoneRequired: boolean;
  /** A line to show from the start (the refused sign-in of an unconfirmed account). */
  initialNotice?: string | null;
  /** Back to the «Acceso» form; absent for a signed-in account. */
  onCancel?: () => void;
  /** The code was accepted: the session that follows moves the page on by itself. */
  onVerified?: () => void;
}

/** Step 1 (9.15.1): the 6-digit code of the confirmation mail, with «Reenviar código». */
export function EmailCodeForm({
  client,
  locale,
  messages,
  ui,
  email,
  captchaSiteKey,
  phoneRequired,
  initialNotice = null,
  onCancel,
  onVerified,
}: EmailCodeFormProps) {
  const text = messages.register;
  const codeId = `${fieldId(useId())}-code`;
  const [code, setCode] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(initialNotice);
  const captcha = useCaptcha(captchaSiteKey);
  const codeMessage = invalid ? text.errors.code : undefined;

  async function verify(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (!CODE.test(code)) {
      setInvalid(true);
      focusField(codeId);
      return;
    }
    setInvalid(false);
    setPending(true);
    setNotice(null);
    try {
      const { error } = await client.auth.verifyOtp({ email, token: code, type: 'email' });
      if (error) {
        setNotice(codeError(error, locale, messages));
        return;
      }
      onVerified?.();
    } catch (caught) {
      setNotice(mapSupabaseError(caught, locale));
    } finally {
      setPending(false);
    }
  }

  async function resend() {
    if (pending || captcha.missing) return;
    setPending(true);
    setNotice(null);
    try {
      const { error } = await client.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: accountUrl(locale), ...captcha.options },
      });
      setNotice(error ? mapSupabaseError(error, locale) : text.resent);
    } catch (caught) {
      setNotice(mapSupabaseError(caught, locale));
    } finally {
      captcha.spend();
      setPending(false);
    }
  }

  return (
    <form className="ac-account-form" onSubmit={verify} noValidate>
      <StepList messages={messages} phoneRequired={phoneRequired} current="credentials" />
      <p className="ac-account-line">{fill(text.codeSent, { email })}</p>
      <Field id={codeId} error={codeMessage}>
        <TextField
          id={codeId}
          label={text.code}
          name="code"
          value={code}
          onChange={(value) => setCode(value.replace(/\D/g, '').slice(0, CODE_LENGTH))}
          inputMode="numeric"
          inputProps={{
            autoComplete: 'one-time-code',
            maxLength: CODE_LENGTH,
            ...invalidProps(codeMessage, codeId),
          }}
        />
      </Field>
      {captcha.widget(locale)}
      <div className="ac-account-row">
        <Button type="submit" variant="solid" disabled={pending}>
          {text.verify}
        </Button>
        <Button onClick={resend} disabled={pending || captcha.missing}>
          {text.resend}
        </Button>
        {onCancel ? <Button onClick={onCancel}>{text.otherEmail}</Button> : null}
      </div>
      <CaptchaNotice captcha={captcha} messages={messages} ui={ui} />
      <FormNotice text={notice} onClose={() => setNotice(null)} ui={ui} />
    </form>
  );
}

// ------------------------------------------------------------- after a password link

export interface NewPasswordFormProps extends FormBaseProps {
  /** The password was changed: the page leaves the recovery state. */
  onDone: () => void;
}

/** The new password of a «¿Olvidaste tu contraseña?» link (`PASSWORD_RECOVERY`). */
export function NewPasswordForm({ client, locale, messages, ui, onDone }: NewPasswordFormProps) {
  const { access } = messages;
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setNotice(null);
    try {
      const { error } = await client.auth.updateUser({ password });
      if (error) {
        setNotice(mapSupabaseError(error, locale));
        return;
      }
      setPassword('');
      onDone();
    } catch (caught) {
      setNotice(mapSupabaseError(caught, locale));
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="ac-account-form" onSubmit={submit}>
      <TextField
        label={access.newPassword}
        type="password"
        name="new-password"
        value={password}
        onChange={setPassword}
        helper={access.passwordHelp}
        inputProps={{
          autoComplete: 'new-password',
          required: true,
          minLength: CONTRASENA_MIN,
          maxLength: CONTRASENA_MAX_BYTES,
        }}
      />
      <Button type="submit" variant="solid" disabled={pending}>
        {access.savePassword}
      </Button>
      <FormNotice text={notice} onClose={() => setNotice(null)} ui={ui} />
    </form>
  );
}

// ------------------------------------------------------------ steps of a session

export interface RegistrationStepsProps extends FormBaseProps {
  user: User;
  /** The first step the account has not done (AccountPanel reads it from the account). */
  stage: RegistrationStep;
  providers: AuthProviders;
  captchaSiteKey: string | null;
  /** content/mundos.json in the page's language: the «Mundo» Select. */
  worlds: AccountWorld[];
  legal: LegalLinks | null;
  /** TELEFONO_OBLIGATORIO: the phone is step 2b. */
  phoneRequired: boolean;
  /** What step 3 saved before, when the account has to accept new terms. */
  savedProfile: RegisterProfileFormProps['saved'];
  /** Step 3: the account's profile function (AccountPanel). */
  onCompleteProfile: (values: NewProfileValues) => Promise<ProfileSaveOutcome>;
  /** A step was done: the page reads the account again. */
  onChanged: () => void;
}

export function RegistrationSteps({
  client,
  locale,
  messages,
  ui,
  user,
  stage,
  providers,
  captchaSiteKey,
  worlds,
  legal,
  phoneRequired,
  savedProfile,
  onCompleteProfile,
  onChanged,
}: RegistrationStepsProps) {
  if (stage === 'credentials') {
    return (
      <EmailCodeForm
        client={client}
        locale={locale}
        messages={messages}
        ui={ui}
        email={user.email ?? ''}
        captchaSiteKey={captchaSiteKey}
        phoneRequired={phoneRequired}
        onVerified={onChanged}
      />
    );
  }
  return (
    <div className="ac-account-form">
      <StepList messages={messages} phoneRequired={phoneRequired} current={stage} />
      {stage === 'identity' ? (
        <IdentityStep
          client={client}
          locale={locale}
          messages={messages}
          ui={ui}
          providers={providers}
        />
      ) : null}
      {stage === 'phone' ? (
        <PhoneForm
          client={client}
          locale={locale}
          messages={messages}
          ui={ui}
          onVerified={onChanged}
        />
      ) : null}
      {stage === 'profile' ? (
        <ProfileForm
          mode="register"
          locale={locale}
          messages={messages}
          ui={ui}
          worlds={worlds}
          legal={legal}
          saved={savedProfile}
          onSubmit={onCompleteProfile}
          onSaved={onChanged}
        />
      ) : null}
    </div>
  );
}

/**
 * Step 2: Discord or Google, one is enough (9.15.1). Only the providers the build switches on
 * render a button (S11); `linkIdentity` leaves for the provider and comes back to this page,
 * where AccountPanel reads a refused link from the address.
 */
function IdentityStep({
  client,
  locale,
  messages,
  ui,
  providers,
}: FormBaseProps & { providers: AuthProviders }) {
  const { register } = messages;
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function link(provider: 'discord' | 'google') {
    if (pending) return;
    setPending(true);
    setNotice(null);
    try {
      const error = await linkProvider(client, provider, locale);
      // Without an error the browser is already on its way to the provider.
      if (error) {
        setNotice(mapSupabaseError(error, locale));
        setPending(false);
      }
    } catch (caught) {
      setNotice(mapSupabaseError(caught, locale));
      setPending(false);
    }
  }

  return (
    <>
      <p className="ac-account-line">{register.identityText}</p>
      {providers.discord || providers.google ? (
        <div className="ac-account-row">
          {providers.discord ? (
            <Button variant="solid" onClick={() => link('discord')} disabled={pending}>
              {register.linkDiscord}
            </Button>
          ) : null}
          {providers.google ? (
            <Button onClick={() => link('google')} disabled={pending}>
              {register.linkGoogle}
            </Button>
          ) : null}
        </div>
      ) : null}
      <FormNotice text={notice} onClose={() => setNotice(null)} ui={ui} />
    </>
  );
}

// ----------------------------------------------------------------------- the profile

export type ProfileField = 'username' | 'player' | 'world' | 'country' | 'birthDate' | 'terms';

const PROFILE_FIELDS: readonly ProfileField[] = [
  'username',
  'player',
  'world',
  'country',
  'birthDate',
  'terms',
];

/** What «Perfil» may change (9.16.3). */
export interface ProfileValues {
  username: string;
  player: string;
  /** World id of content/mundos.json. */
  world: string;
  /** ISO 3166-1 alpha-2. */
  country: string;
}

/**
 * Step 3 (9.15.1): the profile, the birth date (kept, never shown; null once saved, since it
 * does not change) and the accepted terms.
 */
export interface NewProfileValues extends ProfileValues {
  /** `YYYY-MM-DD`, or null when the account saved it before. */
  birthDate: string | null;
}

/** Why the server refused a field: used by another account, invalid, fixed, or under the age. */
export type ProfileRefusal = 'taken' | 'invalid' | 'locked' | 'underage';

/**
 * The answer of a profile save. A refusal names the field it concerns when the server says
 * which, else only the failure.
 */
export type ProfileSaveOutcome =
  | { ok: true }
  | {
      ok: false;
      failure: SupabaseFailure;
      field: ProfileField | null;
      reason: ProfileRefusal;
    };

interface ProfileDraft extends ProfileValues {
  birthDate: string;
  terms: boolean;
}

interface ProfileRules {
  /** Step 3: the terms, and the birth date unless it was saved before. */
  register: boolean;
  birthDate: boolean;
  usernameLocked: boolean;
}

function profileErrors(
  draft: ProfileDraft,
  rules: ProfileRules,
  worlds: AccountWorld[],
  now: number,
  messages: AccountMessages,
): Partial<Record<ProfileField, string>> {
  const text = messages.register.errors;
  const errors: Partial<Record<ProfileField, string>> = {};
  if (!rules.usernameLocked && usernameProblem(draft.username) !== null) {
    errors.username = text.username;
  }
  if (playerNameProblem(draft.player) !== null) errors.player = text.player;
  if (!worlds.some((world) => world.id === draft.world)) errors.world = text.world;
  if (!isCountryCode(draft.country)) errors.country = text.country;
  if (rules.birthDate) {
    // The database counts the age on its own (UTC) date; the form does the same (9.15.1).
    const birth = draft.birthDate < BIRTH_MIN ? 'invalid' : birthDateProblem(draft.birthDate, now);
    if (birth === 'young') errors.birthDate = fill(text.age, { n: EDAD_MINIMA_CUENTA });
    else if (birth !== null) errors.birthDate = text.birthDate;
  }
  if (rules.register && !draft.terms) errors.terms = text.terms;
  return errors;
}

/** The line of a field the server refused. */
function refusedMessage(
  field: ProfileField,
  reason: ProfileRefusal,
  messages: AccountMessages,
): string {
  const text = messages.register.errors;
  switch (field) {
    case 'username':
      if (reason === 'taken') return text.usernameTaken;
      return reason === 'locked' ? messages.profile.usernameLocked : text.username;
    case 'player':
      return reason === 'taken' ? text.playerTaken : text.player;
    case 'world':
      return text.world;
    case 'country':
      return text.country;
    case 'birthDate':
      if (reason === 'underage') return fill(text.age, { n: EDAD_MINIMA_CUENTA });
      return reason === 'locked' ? messages.profile.birthDateLocked : text.birthDate;
    default:
      return text.terms;
  }
}

interface ProfileFormBaseProps {
  locale: Locale;
  messages: AccountMessages;
  ui: UiLabels;
  worlds: AccountWorld[];
  onSaved: () => void;
}

export interface RegisterProfileFormProps extends ProfileFormBaseProps {
  mode: 'register';
  legal: LegalLinks | null;
  /**
   * What the account saved before, when step 3 is asked again (new terms, 9.15.1): the fields
   * start from it and a saved birth date is not asked again.
   */
  saved: (ProfileValues & { birthDateSaved: boolean }) | null;
  onSubmit: (values: NewProfileValues) => Promise<ProfileSaveOutcome>;
}

export interface EditProfileFormProps extends ProfileFormBaseProps {
  mode: 'edit';
  initial: ProfileValues;
  /** 9.9: the username does not change after the first listing. */
  usernameLocked: boolean;
  onSubmit: (values: ProfileValues) => Promise<ProfileSaveOutcome>;
}

/**
 * Step 3 (9.15.1) and «Perfil» (9.16.3). Step 3 asks the public «Nombre de usuario» (the handle
 * of 9.9), «Nombre del jugador» and «Mundo» (unique together), «País», «Fecha de nacimiento»
 * (kept, never shown) and the terms, with the non-affiliation line of 9.15.2. «Perfil» changes
 * the country, the player and the world, and the username until the first listing; the birth
 * date never changes once saved, so it is not there.
 */
export function ProfileForm(props: RegisterProfileFormProps | EditProfileFormProps) {
  const { locale, messages, ui, worlds, onSaved } = props;
  const register = props.mode === 'register';
  const usernameLocked = props.mode === 'edit' && props.usernameLocked;
  const rules: ProfileRules = {
    register,
    birthDate: props.mode === 'register' && !(props.saved?.birthDateSaved ?? false),
    usernameLocked,
  };
  const text = messages.register;
  const uid = fieldId(useId());
  const ids: Record<ProfileField, string> = {
    username: `${uid}-username`,
    player: `${uid}-player`,
    world: `${uid}-world`,
    country: `${uid}-country`,
    birthDate: `${uid}-birth`,
    terms: `${uid}-terms`,
  };
  const initial = props.mode === 'edit' ? props.initial : null;
  const start = props.mode === 'edit' ? props.initial : props.saved;
  const [draft, setDraft] = useState<ProfileDraft>({
    username: start?.username ?? '',
    player: start?.player ?? '',
    world: start?.world ?? '',
    country: start?.country ?? '',
    birthDate: '',
    terms: false,
  });
  // Errors show once the form was sent, then follow every change (9.7.5, A16).
  const [shown, setShown] = useState(false);
  const [refused, setRefused] = useState<{ field: ProfileField; message: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  // The last day the date field offers: today, on the date the database counts ages with.
  const today = useMemo(() => latestBirthDate(0, now) ?? undefined, [now]);
  const countries = useMemo<SelectOption[]>(
    () => countryNames(locale).map((country) => ({ value: country.code, label: country.name })),
    [locale],
  );
  const worldOptions = useMemo<SelectOption[]>(
    () => worlds.map((world) => ({ value: world.id, label: world.nombre })),
    [worlds],
  );

  const errors = shown ? profileErrors(draft, rules, worlds, now, messages) : {};
  if (refused !== null && errors[refused.field] === undefined) {
    errors[refused.field] = refused.message;
  }

  useEffect(() => {
    markSelect(ids.world, errors.world);
    markSelect(ids.country, errors.country);
  });

  const changed =
    initial === null ||
    draft.player.trim() !== initial.player ||
    draft.world !== initial.world ||
    draft.country !== initial.country ||
    (!usernameLocked && draft.username !== initial.username);

  function update<K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    if (refused?.field === key) setRefused(null);
    setNotice(null);
  }

  /** Whether the form draws a field: the birth date and the terms only belong to step 3. */
  function drawn(field: ProfileField): boolean {
    if (field === 'birthDate') return rules.birthDate;
    if (field === 'terms') return register;
    return true;
  }

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setShown(true);
    const found = profileErrors(draft, rules, worlds, now, messages);
    const first = PROFILE_FIELDS.find((field) => found[field] !== undefined);
    if (first !== undefined) {
      focusField(ids[first]);
      return;
    }
    setPending(true);
    setNotice(null);
    setRefused(null);
    const values: ProfileValues = {
      username: usernameLocked && initial !== null ? initial.username : draft.username,
      player: draft.player.trim(),
      world: draft.world,
      country: draft.country,
    };
    try {
      const outcome =
        props.mode === 'register'
          ? await props.onSubmit({ ...values, birthDate: rules.birthDate ? draft.birthDate : null })
          : await props.onSubmit(values);
      if (outcome.ok) {
        if (!register) setNotice(messages.saved);
        onSaved();
        return;
      }
      if (outcome.field === null) {
        setNotice(mapSupabaseError(outcome.failure, locale));
        return;
      }
      const message = refusedMessage(outcome.field, outcome.reason, messages);
      // A field this form does not draw (the birth date of «Perfil») is said in the notice.
      if (!drawn(outcome.field)) {
        setNotice(message);
        return;
      }
      setRefused({ field: outcome.field, message });
      focusField(ids[outcome.field]);
    } catch (caught) {
      setNotice(mapSupabaseError(caught, locale));
    } finally {
      setPending(false);
    }
  }

  let submitLabel = register ? text.finish : messages.save;
  if (pending && !register) submitLabel = messages.saving;

  return (
    <form className="ac-account-form" onSubmit={submit} noValidate>
      <Field id={ids.username} error={errors.username}>
        <TextField
          id={ids.username}
          label={text.username}
          name="username"
          value={draft.username}
          // The handle is lowercase (9.9): typed capitals become lowercase as they come.
          onChange={(value) => update('username', value.toLowerCase())}
          helper={usernameLocked ? messages.profile.usernameLocked : text.usernameHelp}
          inputProps={{
            autoComplete: 'username',
            maxLength: NOMBRE_USUARIO_MAX,
            spellCheck: false,
            readOnly: usernameLocked,
            ...invalidProps(errors.username, ids.username),
          }}
        />
      </Field>
      <Field id={ids.player} error={errors.player}>
        <TextField
          id={ids.player}
          label={text.player}
          name="player"
          value={draft.player}
          onChange={(value) => update('player', value)}
          inputProps={{
            autoComplete: 'off',
            maxLength: NOMBRE_JUGADOR_MAX,
            spellCheck: false,
            ...invalidProps(errors.player, ids.player),
          }}
        />
      </Field>
      <Field id={ids.world} error={errors.world}>
        <Select
          id={ids.world}
          label={text.world}
          options={worldOptions}
          value={draft.world}
          onChange={(value) => update('world', value)}
        />
      </Field>
      <Field id={ids.country} error={errors.country}>
        <Select
          id={ids.country}
          label={text.country}
          options={countries}
          value={draft.country}
          onChange={(value) => update('country', value)}
        />
      </Field>
      {rules.birthDate ? (
        <Field id={ids.birthDate} error={errors.birthDate}>
          <TextField
            id={ids.birthDate}
            label={text.birthDate}
            type="date"
            name="birth-date"
            value={draft.birthDate}
            onChange={(value) => update('birthDate', value)}
            helper={text.birthDateHelp}
            inputProps={{
              autoComplete: 'bday',
              min: BIRTH_MIN,
              max: today,
              ...invalidProps(errors.birthDate, ids.birthDate),
            }}
          />
        </Field>
      ) : null}
      {props.mode === 'register' ? (
        <>
          <Field id={ids.terms} error={errors.terms}>
            <Checkbox
              id={ids.terms}
              label={text.terms}
              checked={draft.terms}
              onChange={(checked) => update('terms', checked)}
              helper={
                props.legal === null ? undefined : (
                  <>
                    <TextLink href={props.legal.terms} variant="prose">
                      {text.termsLink}
                    </TextLink>
                    {' · '}
                    <TextLink href={props.legal.privacy} variant="prose">
                      {text.privacyLink}
                    </TextLink>
                  </>
                )
              }
              inputProps={invalidProps(errors.terms, ids.terms)}
            />
          </Field>
          <p className="ac-account-legal">{text.nonAffiliation}</p>
        </>
      ) : null}
      <Button type="submit" variant="solid" disabled={pending || !changed}>
        {submitLabel}
      </Button>
      <FormNotice text={notice} onClose={() => setNotice(null)} ui={ui} />
    </form>
  );
}

// --------------------------------------------------------------------------- the phone

export interface PhoneFormProps extends FormBaseProps {
  /** The phone was verified: the page reads the account again. */
  onVerified: () => void;
}

/** Step 2b and «Cambiar teléfono» (9.9): a code by SMS to the new number, then the code. */
export function PhoneForm({ client, locale, messages, ui, onVerified }: PhoneFormProps) {
  const text = messages.verification;
  const uid = fieldId(useId());
  const ids = { country: `${uid}-country`, number: `${uid}-number`, code: `${uid}-code` };
  const countries = useMemo<SelectOption[]>(() => {
    const dial = dialCodes();
    return countryNames(locale)
      .filter((country) => dial.has(country.code))
      .map((country) => ({
        value: country.code,
        label: `${country.name} (+${dial.get(country.code)})`,
      }));
  }, [locale]);
  const [country, setCountry] = useState('');
  const [number, setNumber] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [invalid, setInvalid] = useState<'country' | 'number' | 'code' | null>(null);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const errors = {
    country: invalid === 'country' ? messages.register.errors.country : undefined,
    number: invalid === 'number' ? messages.register.errors.phone : undefined,
    code: invalid === 'code' ? messages.register.errors.code : undefined,
  };

  useEffect(() => {
    markSelect(ids.country, errors.country);
  });

  async function send() {
    if (pending) return;
    if (country === '') {
      setInvalid('country');
      focusField(ids.country);
      return;
    }
    const phone = toE164(dialCodes().get(country), number);
    if (phone === null) {
      setInvalid('number');
      focusField(ids.number);
      return;
    }
    setInvalid(null);
    setPending(true);
    setNotice(null);
    try {
      const { error } = await client.auth.updateUser({ phone });
      if (error) {
        setNotice(mapSupabaseError(error, locale));
        return;
      }
      setSentTo(phone);
      setCode('');
      setNotice(text.codeSent);
    } catch (caught) {
      setNotice(mapSupabaseError(caught, locale));
    } finally {
      setPending(false);
    }
  }

  async function verify() {
    if (pending || sentTo === null) return;
    if (!CODE.test(code)) {
      setInvalid('code');
      focusField(ids.code);
      return;
    }
    setInvalid(null);
    setPending(true);
    setNotice(null);
    try {
      const { error } = await client.auth.verifyOtp({
        phone: sentTo,
        token: code,
        type: 'phone_change',
      });
      if (error) {
        setNotice(codeError(error, locale, messages));
        return;
      }
      onVerified();
    } catch (caught) {
      setNotice(mapSupabaseError(caught, locale));
    } finally {
      setPending(false);
    }
  }

  // Enter sends the code until one was sent, and verifies it after.
  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sentTo === null) void send();
    else void verify();
  }

  return (
    <form className="ac-account-form" onSubmit={submit} noValidate>
      <Field id={ids.country} error={errors.country}>
        <Select
          id={ids.country}
          label={text.country}
          options={countries}
          value={country}
          onChange={(value) => {
            setCountry(value);
            if (invalid === 'country') setInvalid(null);
          }}
        />
      </Field>
      <Field id={ids.number} error={errors.number}>
        <TextField
          id={ids.number}
          label={text.number}
          type="tel"
          name="phone"
          value={number}
          onChange={setNumber}
          inputMode="tel"
          inputProps={{ autoComplete: 'tel-national', ...invalidProps(errors.number, ids.number) }}
        />
      </Field>
      <Button onClick={send} disabled={pending}>
        {text.sendCode}
      </Button>
      {sentTo === null ? null : (
        <>
          <Field id={ids.code} error={errors.code}>
            <TextField
              id={ids.code}
              label={text.code}
              name="code"
              value={code}
              onChange={(value) => setCode(value.replace(/\D/g, '').slice(0, CODE_LENGTH))}
              inputMode="numeric"
              inputProps={{
                autoComplete: 'one-time-code',
                maxLength: CODE_LENGTH,
                ...invalidProps(errors.code, ids.code),
              }}
            />
          </Field>
          <Button type="submit" variant="solid" disabled={pending}>
            {messages.register.verify}
          </Button>
        </>
      )}
      <FormNotice text={notice} onClose={() => setNotice(null)} ui={ui} />
    </form>
  );
}

export interface PhoneVerificationProps extends FormBaseProps {
  user: User;
  onVerified: () => void;
}

/**
 * The phone rows of «Verificación» (9.9), only with TELEFONO_OBLIGATORIO: «Teléfono: verificado
 * (+55 ••• ••• 1234)» with «Cambiar teléfono», or «Teléfono: sin verificar» with the form.
 */
export function PhoneVerification({
  client,
  locale,
  messages,
  ui,
  user,
  onVerified,
}: PhoneVerificationProps) {
  const text = messages.verification;
  const verified = Boolean(user.phone && user.phone_confirmed_at);
  const [changing, setChanging] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <div className="ac-account-block">
      <div className="ac-account-row">
        <FactLine label={text.phone}>
          {verified
            ? fill(text.phoneVerified, { number: maskPhone(user.phone ?? '') })
            : text.unverified}
        </FactLine>
        {verified && !changing ? (
          <Button
            onClick={() => {
              setNotice(null);
              setChanging(true);
            }}
          >
            {text.changePhone}
          </Button>
        ) : null}
      </div>
      {!verified || changing ? (
        <PhoneForm
          client={client}
          locale={locale}
          messages={messages}
          ui={ui}
          onVerified={() => {
            setChanging(false);
            setNotice(text.phoneSaved);
            onVerified();
          }}
        />
      ) : null}
      <FormNotice text={notice} onClose={() => setNotice(null)} ui={ui} />
    </div>
  );
}
