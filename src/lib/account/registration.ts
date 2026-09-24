// The registration of every account (spec 9.15.1): the three steps and their order, the email
// normalization of the database, the rules of the fields, the age helpers and the age of a Discord
// account read from its id (9.15.2).
//
// Each rule here mirrors one that the database enforces again (the `before_user_created` hook and
// the account functions of the account_trust migration): the page only says a problem before the
// server refuses it. There is deliberately no list of email domains in the client: a disposable
// mail domain is refused by the hook and reported by its error (9.15.1).
//
// Client-safe: plain functions over plain values, no supabase-js import.
import {
  CONTRASENA_MIN,
  DISCORD_EDAD_MIN_DIAS,
  EDAD_MINIMA_COMERCIO,
  EDAD_MINIMA_CUENTA,
  NOMBRE_JUGADOR_MAX,
  NOMBRE_USUARIO_MAX,
  NOMBRE_USUARIO_MIN,
  TELEFONO_OBLIGATORIO,
  type Moment,
} from '@/lib/trade/limits';

import { httpsUrl } from './session-cache';

const DAY_MS = 86_400_000;

function epoch(value: Moment): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Date.parse(value);
  return value.getTime();
}

function characters(value: string): number {
  return Array.from(value).length;
}

// ------------------------------------------------------------------------------- steps

/**
 * The steps of 9.15.1, in order: email and password (confirmed with the 6-digit code), the linked
 * identity, the phone (step 2b, only with `TELEFONO_OBLIGATORIO`) and the profile.
 */
export const REGISTRATION_STEPS = ['credentials', 'identity', 'phone', 'profile'] as const;
export type RegistrationStep = (typeof REGISTRATION_STEPS)[number];

/** The identities that anchor an account (step 2): one of the two is enough. Twitch is a badge. */
export const ANCHOR_PROVIDERS = ['discord', 'google'] as const;
export type AnchorProvider = (typeof ANCHOR_PROVIDERS)[number];

export function isAnchorProvider(value: unknown): value is AnchorProvider {
  return ANCHOR_PROVIDERS.includes(value as AnchorProvider);
}

/** What the account page knows of an account: its session, its identities and its profile. */
export interface RegistrationFacts {
  /** A session is open. */
  signedIn: boolean;
  /** The address a sign-up code went to while there is no session yet. */
  pendingEmail: string | null;
  /** `email_confirmed_at` is set. */
  emailConfirmed: boolean;
  /** Providers of the account's identities (`auth.identities.provider`), `email` included. */
  providers: readonly string[];
  /** `phone_confirmed_at` is set. */
  phoneConfirmed: boolean;
  /** Step 3 was saved, with the accepted terms. */
  profileSaved: boolean;
}

export const NO_REGISTRATION: RegistrationFacts = {
  signedIn: false,
  pendingEmail: null,
  emailConfirmed: false,
  providers: [],
  phoneConfirmed: false,
  profileSaved: false,
};

/**
 * Where an account stands: without a session (sign in or create an account), on a step, or
 * complete. «Solo se ven los pasos» until the account is complete (9.15.1).
 */
export type RegistrationState =
  { kind: 'signedOut' } | { kind: 'incomplete'; step: RegistrationStep } | { kind: 'complete' };

export interface RegistrationOptions {
  /** `TELEFONO_OBLIGATORIO` of the build (`telefonoObligatorio` of limits.ts); off by default. */
  phoneRequired?: boolean;
}

/** Whether the providers hold a Discord or Google identity. */
export function hasAnchorIdentity(providers: readonly string[]): boolean {
  return providers.some(isAnchorProvider);
}

/** The steps of this build: the phone only when it is required. */
export function registrationSteps(options?: RegistrationOptions): RegistrationStep[] {
  const phoneRequired = options?.phoneRequired ?? TELEFONO_OBLIGATORIO;
  return REGISTRATION_STEPS.filter((step) => step !== 'phone' || phoneRequired);
}

/** Whether one step is done, whatever the others say. */
export function stepDone(step: RegistrationStep, facts: RegistrationFacts): boolean {
  switch (step) {
    case 'credentials':
      return facts.signedIn && facts.emailConfirmed;
    case 'identity':
      return facts.signedIn && hasAnchorIdentity(facts.providers);
    case 'phone':
      return facts.signedIn && facts.phoneConfirmed;
    case 'profile':
      return facts.signedIn && facts.profileSaved;
  }
}

/**
 * The state of an account: the first step it has not done, in the order of 9.15.1, so a step is
 * never skipped (a saved profile does not stand for a missing identity).
 */
export function registrationState(
  facts: RegistrationFacts,
  options?: RegistrationOptions,
): RegistrationState {
  if (!facts.signedIn) {
    return facts.pendingEmail === null
      ? { kind: 'signedOut' }
      : { kind: 'incomplete', step: 'credentials' };
  }
  const step = registrationSteps(options).find((candidate) => !stepDone(candidate, facts));
  return step === undefined ? { kind: 'complete' } : { kind: 'incomplete', step };
}

export type StepStatus = 'done' | 'current' | 'todo';

/** The step list of the page with the status of each step; the current one is the first not done. */
export function registrationProgress(
  facts: RegistrationFacts,
  options?: RegistrationOptions,
): { step: RegistrationStep; status: StepStatus }[] {
  const state = registrationState(facts, options);
  const current =
    state.kind === 'incomplete' ? state.step : state.kind === 'signedOut' ? 'credentials' : null;
  return registrationSteps(options).map((step) => ({
    step,
    status: step === current ? 'current' : stepDone(step, facts) ? 'done' : 'todo',
  }));
}

/** An identity as supabase-js returns it in `user.identities`. */
export interface IdentityLike {
  provider: string;
  /** The provider's user id in the identities of supabase-js. */
  id?: string | null;
  identity_data?: Record<string, unknown> | null;
}

/** The parts of a supabase-js `User` the registration reads. */
export interface SessionUserLike {
  email_confirmed_at?: string | null;
  phone_confirmed_at?: string | null;
  identities?: readonly IdentityLike[] | null;
}

/** The facts of a signed-in account from its session user and whether its profile exists. */
export function factsFromUser(user: SessionUserLike, profileSaved: boolean): RegistrationFacts {
  return {
    signedIn: true,
    pendingEmail: null,
    emailConfirmed: Boolean(user.email_confirmed_at),
    providers: (user.identities ?? []).map((identity) => identity.provider),
    phoneConfirmed: Boolean(user.phone_confirmed_at),
    profileSaved,
  };
}

/** What happens on the account page. */
export type RegistrationEvent =
  /** `signUp` answered without a session: the 6-digit code went to `email`. */
  | { type: 'codeSent'; email: string }
  /** A session was opened or read again (sign-in, the code, the return from a provider). */
  | { type: 'session'; user: SessionUserLike; profileSaved: boolean }
  | { type: 'identityLinked'; provider: string }
  | { type: 'identityUnlinked'; provider: string }
  | { type: 'phoneConfirmed' }
  | { type: 'profileSaved' }
  | { type: 'signedOut' };

/**
 * The transition of the registration: the facts after an event. The step then follows from
 * `registrationState`. An event that needs a session changes nothing without one.
 */
export function applyRegistrationEvent(
  facts: RegistrationFacts,
  event: RegistrationEvent,
): RegistrationFacts {
  switch (event.type) {
    case 'codeSent':
      return facts.signedIn ? facts : { ...NO_REGISTRATION, pendingEmail: event.email };
    case 'session':
      return factsFromUser(event.user, event.profileSaved);
    case 'signedOut':
      return NO_REGISTRATION;
  }
  if (!facts.signedIn) return facts;
  switch (event.type) {
    case 'identityLinked':
      return facts.providers.includes(event.provider)
        ? facts
        : { ...facts, providers: [...facts.providers, event.provider] };
    case 'identityUnlinked':
      return { ...facts, providers: facts.providers.filter((p) => p !== event.provider) };
    case 'phoneConfirmed':
      return { ...facts, phoneConfirmed: true };
    case 'profileSaved':
      return { ...facts, profileSaved: true };
  }
}

// ------------------------------------------------------------------------------- email

/** RFC 5321: the longest address a mailbox can have. */
export const EMAIL_MAX = 254;
/** One `@`, no spaces, and a domain with at least one dot. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;
/** The domains of one mailbox whose local part ignores dots (9.15.1); both become gmail.com. */
const GMAIL_DOMAINS: ReadonlySet<string> = new Set(['gmail.com', 'googlemail.com']);

export type EmailProblem = 'empty' | 'invalid' | 'long';

export function emailProblem(raw: string): EmailProblem | null {
  const email = raw.trim();
  if (email === '') return 'empty';
  if (email.length > EMAIL_MAX) return 'long';
  return EMAIL_SHAPE.test(email) && normalizeEmail(email) !== null ? null : 'invalid';
}

/**
 * The normalized address the database keeps unique across every account, suspended ones included
 * (9.15.1), as `account_normalize_email` of the account_trust migration writes it: lowercase, the
 * domain after the last `@` without trailing dots, the local part without its `+tag` (a `+` that
 * starts it stays) and, for gmail.com and googlemail.com, without dots and under gmail.com. Null
 * when it is not an address. `A.B+x@googlemail.com` and `ab@gmail.com` are the same.
 */
export function normalizeEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  const at = email.lastIndexOf('@');
  if (at < 0) return null;
  let local = email.slice(0, at);
  let domain = email.slice(at + 1).replace(/\.+$/, '');
  if (local === '' || domain === '') return null;
  const plus = local.indexOf('+');
  if (plus > 0) local = local.slice(0, plus);
  if (GMAIL_DOMAINS.has(domain)) {
    local = local.replaceAll('.', '');
    domain = 'gmail.com';
    if (local === '') return null;
  }
  return `${local}@${domain}`;
}

/** The domain of an address, lowercase; null when it is not an address. */
export function emailDomain(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  return EMAIL_SHAPE.test(email) ? email.slice(email.lastIndexOf('@') + 1) : null;
}

// ---------------------------------------------------------------------------- password

/** bcrypt, with which Supabase Auth keeps passwords, reads 72 bytes; Auth refuses a longer one. */
export const CONTRASENA_MAX_BYTES = 72;

export type PasswordProblem = 'short' | 'long';

/** «Contraseña»: at least `CONTRASENA_MIN` characters (9.15.1) and at most 72 bytes. */
export function passwordProblem(password: string): PasswordProblem | null {
  if (characters(password) < CONTRASENA_MIN) return 'short';
  if (new TextEncoder().encode(password).length > CONTRASENA_MAX_BYTES) return 'long';
  return null;
}

// ----------------------------------------------------------------------------- profile

const USERNAME_CHARACTERS = /^[a-z0-9_-]+$/;

/** «Nombre de usuario» as the database stores it: lowercase, without surrounding spaces. */
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export type UsernameProblem = 'empty' | 'characters' | 'length';

/** 3 to 24 of `[a-z0-9_-]` once lowercased (9.9, 9.15.1); unique case-insensitively (server). */
export function usernameProblem(raw: string): UsernameProblem | null {
  const username = normalizeUsername(raw);
  if (username === '') return 'empty';
  if (!USERNAME_CHARACTERS.test(username)) return 'characters';
  if (username.length < NOMBRE_USUARIO_MIN || username.length > NOMBRE_USUARIO_MAX) return 'length';
  return null;
}

export type PlayerNameProblem = 'empty' | 'characters' | 'long';

/** «Nombre del jugador» as the database stores it: trimmed, each run of spaces made one. */
export function normalizePlayerName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

/** «Nombre del jugador»: 1 to 32 characters, no control characters (9.15.1). */
export function playerNameProblem(raw: string): PlayerNameProblem | null {
  const name = normalizePlayerName(raw);
  if (name === '') return 'empty';
  if (/\p{Cc}/u.test(name)) return 'characters';
  return characters(name) > NOMBRE_JUGADOR_MAX ? 'long' : null;
}

/** «País»: an ISO 3166-1 alpha-2 code, uppercase; null when it cannot be one. */
export function normalizeCountry(raw: string): string | null {
  const code = raw.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

// -------------------------------------------------------------------------------- ages

/** A calendar date. */
export interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function isoDate({ year, month, day }: CalendarDate): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** A `YYYY-MM-DD` date that exists in the calendar, or null. */
export function parseIsoDate(value: string): CalendarDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

/**
 * The date of `now` in UTC, as `current_date` gives it in the database, which decides the age.
 * Null when `now` cannot be read.
 */
function utcDate(now: Moment): CalendarDate | null {
  const at = epoch(now);
  if (Number.isNaN(at)) return null;
  const date = new Date(at);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function compareDates(a: CalendarDate, b: CalendarDate): number {
  return a.year - b.year || a.month - b.month || a.day - b.day;
}

/**
 * Whole years from a birth date to the date of `now`, as Postgres `age()` counts them: a 29
 * February birthday is reached on 1 March in a common year. Null for an invalid date.
 */
export function ageOn(birthDate: string, now: Moment): number | null {
  const birth = parseIsoDate(birthDate);
  const today = utcDate(now);
  if (birth === null || today === null) return null;
  const beforeBirthday =
    today.month < birth.month || (today.month === birth.month && today.day < birth.day);
  return today.year - birth.year - (beforeBirthday ? 1 : 0);
}

/** Whether a birth date gives at least `minimum` years at `now`. */
export function meetsAge(birthDate: string, minimum: number, now: Moment): boolean {
  const age = ageOn(birthDate, now);
  return age !== null && age >= minimum;
}

/** Comercio asks for `EDAD_MINIMA_COMERCIO` years (9.15.2). */
export function isComercioAge(birthDate: string, now: Moment): boolean {
  return meetsAge(birthDate, EDAD_MINIMA_COMERCIO, now);
}

/** The earliest birth date the database takes. */
export const BIRTH_DATE_MIN = '1900-01-01';

export type BirthDateProblem = 'invalid' | 'future' | 'young';

/**
 * «Fecha de nacimiento»: a real date from `BIRTH_DATE_MIN` on, not after today, of an account of
 * `EDAD_MINIMA_CUENTA` years.
 */
export function birthDateProblem(value: string, now: Moment): BirthDateProblem | null {
  const birth = parseIsoDate(value);
  const today = utcDate(now);
  if (birth === null || today === null || value.trim() < BIRTH_DATE_MIN) return 'invalid';
  if (compareDates(birth, today) > 0) return 'future';
  return meetsAge(value, EDAD_MINIMA_CUENTA, now) ? null : 'young';
}

/**
 * The latest birth date that has `minimumAge` years at `now`, `YYYY-MM-DD`: the `max` of the date
 * field. A 29 February that does not exist that year becomes the 28th.
 */
export function latestBirthDate(minimumAge: number, now: Moment): string | null {
  const today = utcDate(now);
  if (today === null) return null;
  const year = today.year - minimumAge;
  return isoDate({
    year,
    month: today.month,
    day: Math.min(today.day, daysInMonth(year, today.month)),
  });
}

// ----------------------------------------------------------------------------- discord

/** The first instant of 2015 UTC, from which Discord ids count their time (9.15.2). */
export const DISCORD_EPOCH_MS = 1_420_070_400_000;
/** The largest id the database reads (a `bigint`). */
const SNOWFLAKE_MAX = (BigInt(1) << BigInt(63)) - BigInt(1);

/**
 * When a Discord account was created, from its id (a snowflake): `(id >> 22) + 1420070400000` ms,
 * as `account_discord_created_at` computes it. Null when the id is not one.
 */
export function discordCreatedAt(id: string): Date | null {
  const value = id.trim();
  if (!/^\d{1,19}$/.test(value)) return null;
  const snowflake = BigInt(value);
  if (snowflake > SNOWFLAKE_MAX) return null;
  return new Date(Number(snowflake >> BigInt(22)) + DISCORD_EPOCH_MS);
}

/** Whole days since the Discord account was created; null for an id that is not a snowflake. */
export function discordAccountAgeDays(id: string, now: Moment): number | null {
  const created = discordCreatedAt(id);
  const at = epoch(now);
  if (created === null || Number.isNaN(at)) return null;
  return Math.floor((at - created.getTime()) / DAY_MS);
}

/** Comercio asks for a Discord account of at least `DISCORD_EDAD_MIN_DIAS` days (9.15.2). */
export function discordOldEnough(id: string, now: Moment): boolean {
  const created = discordCreatedAt(id);
  const at = epoch(now);
  return created !== null && at - created.getTime() >= DISCORD_EDAD_MIN_DIAS * DAY_MS;
}

// -------------------------------------------------------------------------- identities

function identityText(identity: IdentityLike, key: string): string | null {
  const value = identity.identity_data?.[key];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

/** The providers of a list of identities. */
export function providersOf(identities: readonly IdentityLike[] | null | undefined): string[] {
  return (identities ?? []).map((identity) => identity.provider);
}

/** The Discord user id of the account's Discord identity, or null. */
export function discordIdOf(identities: readonly IdentityLike[] | null | undefined): string | null {
  const discord = (identities ?? []).find((identity) => identity.provider === 'discord');
  if (!discord) return null;
  const id = identityText(discord, 'provider_id') ?? identityText(discord, 'sub') ?? discord.id;
  return id && /^\d{1,19}$/.test(id) ? id : null;
}

/**
 * The avatar of the header entry (9.16.1): the picture of the Discord identity, else the Google
 * one; null without them (the entry then draws the initial).
 */
export function identityAvatar(
  identities: readonly IdentityLike[] | null | undefined,
): string | null {
  for (const provider of ANCHOR_PROVIDERS) {
    const identity = (identities ?? []).find((candidate) => candidate.provider === provider);
    if (!identity) continue;
    const avatar = httpsUrl(
      identityText(identity, 'avatar_url') ?? identityText(identity, 'picture'),
    );
    if (avatar !== null) return avatar;
  }
  return null;
}
