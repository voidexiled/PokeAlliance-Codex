// The registration of 9.15.1 and the Comercio ages of 9.15.2: the steps and their order, the
// email normalization of `account_normalize_email`, the field rules, the ages as Postgres `age()`
// counts them and the age of a Discord account from its snowflake id.
import { describe, expect, it } from 'vitest';

import {
  BIRTH_DATE_MIN,
  NO_REGISTRATION,
  ageOn,
  applyRegistrationEvent,
  birthDateProblem,
  discordAccountAgeDays,
  discordCreatedAt,
  discordIdOf,
  discordOldEnough,
  emailDomain,
  emailProblem,
  factsFromUser,
  identityAvatar,
  isComercioAge,
  latestBirthDate,
  normalizeCountry,
  normalizeEmail,
  normalizePlayerName,
  normalizeUsername,
  parseIsoDate,
  passwordProblem,
  playerNameProblem,
  registrationProgress,
  registrationState,
  usernameProblem,
  type RegistrationEvent,
  type RegistrationFacts,
} from '@/lib/account/registration';

/** A Discord id created at `ms` (epoch milliseconds). */
function snowflakeAt(ms: number): string {
  return ((BigInt(ms) - BigInt(1_420_070_400_000)) << BigInt(22)).toString();
}

function run(events: RegistrationEvent[], facts: RegistrationFacts = NO_REGISTRATION) {
  return events.reduce(applyRegistrationEvent, facts);
}

const confirmedUser = {
  email_confirmed_at: '2026-09-20T10:00:00Z',
  phone_confirmed_at: null,
  identities: [{ provider: 'email' }],
};

describe('registration state machine (9.15.1)', () => {
  it('starts signed out and waits for the code after a sign-up', () => {
    expect(registrationState(NO_REGISTRATION)).toEqual({ kind: 'signedOut' });
    const facts = run([{ type: 'codeSent', email: 'jugador@example.com' }]);
    expect(facts.pendingEmail).toBe('jugador@example.com');
    expect(registrationState(facts)).toEqual({ kind: 'incomplete', step: 'credentials' });
  });

  it('walks the three steps in order and completes', () => {
    let facts = run([
      { type: 'codeSent', email: 'jugador@example.com' },
      { type: 'session', user: confirmedUser, profileSaved: false },
    ]);
    expect(facts.pendingEmail).toBeNull();
    expect(registrationState(facts)).toEqual({ kind: 'incomplete', step: 'identity' });

    facts = run([{ type: 'identityLinked', provider: 'discord' }], facts);
    expect(registrationState(facts)).toEqual({ kind: 'incomplete', step: 'profile' });

    facts = run([{ type: 'profileSaved' }], facts);
    expect(registrationState(facts)).toEqual({ kind: 'complete' });
  });

  it('never skips a step: a saved profile does not stand for a missing identity', () => {
    const facts = run([
      { type: 'session', user: confirmedUser, profileSaved: true },
      { type: 'identityLinked', provider: 'twitch' },
    ]);
    expect(registrationState(facts)).toEqual({ kind: 'incomplete', step: 'identity' });
    expect(registrationProgress(facts)).toEqual([
      { step: 'credentials', status: 'done' },
      { step: 'identity', status: 'current' },
      { step: 'profile', status: 'done' },
    ]);
  });

  it('accepts Google as the anchor and loses it when unlinked', () => {
    let facts = run([
      { type: 'session', user: confirmedUser, profileSaved: true },
      { type: 'identityLinked', provider: 'google' },
    ]);
    expect(registrationState(facts)).toEqual({ kind: 'complete' });
    facts = run([{ type: 'identityUnlinked', provider: 'google' }], facts);
    expect(registrationState(facts)).toEqual({ kind: 'incomplete', step: 'identity' });
  });

  it('asks for the phone as step 2b only when the build requires it', () => {
    const facts = run([
      { type: 'session', user: confirmedUser, profileSaved: true },
      { type: 'identityLinked', provider: 'discord' },
    ]);
    expect(registrationState(facts)).toEqual({ kind: 'complete' });
    expect(registrationState(facts, { phoneRequired: true })).toEqual({
      kind: 'incomplete',
      step: 'phone',
    });
    const phoned = run([{ type: 'phoneConfirmed' }], facts);
    expect(registrationState(phoned, { phoneRequired: true })).toEqual({ kind: 'complete' });
    expect(registrationProgress(facts).map(({ step }) => step)).toEqual([
      'credentials',
      'identity',
      'profile',
    ]);
  });

  it('ignores the events that need a session without one, and resets on sign-out', () => {
    expect(run([{ type: 'profileSaved' }])).toEqual(NO_REGISTRATION);
    expect(run([{ type: 'identityLinked', provider: 'discord' }])).toEqual(NO_REGISTRATION);
    const facts = run([
      { type: 'session', user: confirmedUser, profileSaved: true },
      { type: 'signedOut' },
    ]);
    expect(facts).toEqual(NO_REGISTRATION);
  });

  it('keeps an unconfirmed session on the first step', () => {
    const facts = factsFromUser({ email_confirmed_at: null, identities: [] }, false);
    expect(registrationState(facts)).toEqual({ kind: 'incomplete', step: 'credentials' });
  });
});

describe('email (9.15.1)', () => {
  it('normalizes as account_normalize_email', () => {
    expect(normalizeEmail('a.b+x@gmail.com')).toBe('ab@gmail.com');
    expect(normalizeEmail('ab@gmail.com')).toBe('ab@gmail.com');
    expect(normalizeEmail(' A.B+tag@GoogleMail.com ')).toBe('ab@gmail.com');
    expect(normalizeEmail('Nombre.Apellido+comercio@Example.com')).toBe(
      'nombre.apellido@example.com',
    );
    expect(normalizeEmail('user@example.com.')).toBe('user@example.com');
    // A + that starts the local part is not a tag.
    expect(normalizeEmail('+solo@example.com')).toBe('+solo@example.com');
    expect(normalizeEmail('...@gmail.com')).toBeNull();
    expect(normalizeEmail('no-at-sign')).toBeNull();
    expect(normalizeEmail('@example.com')).toBeNull();
  });

  it('says what is wrong with the field', () => {
    expect(emailProblem('')).toBe('empty');
    expect(emailProblem('jugador@example')).toBe('invalid');
    expect(emailProblem('dos@@example.com')).toBe('invalid');
    expect(emailProblem('con espacio@example.com')).toBe('invalid');
    expect(emailProblem(`${'a'.repeat(250)}@example.com`)).toBe('long');
    expect(emailProblem('jugador@example.com')).toBeNull();
    expect(emailDomain('Jugador@Example.COM')).toBe('example.com');
    expect(emailDomain('nope')).toBeNull();
  });
});

describe('fields', () => {
  it('password: 10 characters at least and 72 bytes at most', () => {
    expect(passwordProblem('123456789')).toBe('short');
    expect(passwordProblem('1234567890')).toBeNull();
    expect(passwordProblem('ñ'.repeat(36))).toBeNull();
    expect(passwordProblem('ñ'.repeat(37))).toBe('long');
  });

  it('username: 3 to 24 of [a-z0-9_-], lowercased', () => {
    expect(normalizeUsername('  Ash_Ketchum ')).toBe('ash_ketchum');
    expect(usernameProblem('Ash_Ketchum')).toBeNull();
    expect(usernameProblem('ab')).toBe('length');
    expect(usernameProblem('a'.repeat(25))).toBe('length');
    expect(usernameProblem('ñandú')).toBe('characters');
    expect(usernameProblem('con espacio')).toBe('characters');
    expect(usernameProblem('   ')).toBe('empty');
  });

  it('player name: 1 to 32 characters, one space between words, no control characters', () => {
    expect(normalizePlayerName('  Red   Trainer ')).toBe('Red Trainer');
    expect(playerNameProblem('Red Trainer')).toBeNull();
    expect(playerNameProblem('  ')).toBe('empty');
    expect(playerNameProblem('x'.repeat(33))).toBe('long');
    expect(playerNameProblem('a\u0007b')).toBe('characters');
  });

  it('country: ISO 3166-1 alpha-2', () => {
    expect(normalizeCountry(' br ')).toBe('BR');
    expect(normalizeCountry('BRA')).toBeNull();
    expect(normalizeCountry('1a')).toBeNull();
  });
});

describe('ages (9.15.1, 9.15.2)', () => {
  it('reads only real calendar dates', () => {
    expect(parseIsoDate('2008-02-29')).toEqual({ year: 2008, month: 2, day: 29 });
    expect(parseIsoDate('2007-02-29')).toBeNull();
    expect(parseIsoDate('2008-13-01')).toBeNull();
    expect(parseIsoDate('08-02-2008')).toBeNull();
  });

  it('counts whole years as Postgres age(): 29 February turns on 1 March', () => {
    expect(ageOn('2008-09-23', '2026-09-23T00:00:00Z')).toBe(18);
    expect(ageOn('2008-09-24', '2026-09-23T23:59:59Z')).toBe(17);
    expect(ageOn('2008-02-29', '2026-02-28T12:00:00Z')).toBe(17);
    expect(ageOn('2008-02-29', '2026-03-01T00:00:00Z')).toBe(18);
    expect(ageOn('not a date', '2026-09-23')).toBeNull();
  });

  it('uses the UTC date, like current_date in the database', () => {
    // 23:30 on the 22nd in Mexico City is already the 23rd in UTC.
    expect(isComercioAge('2008-09-23', new Date('2026-09-22T23:30:00-06:00'))).toBe(true);
    expect(isComercioAge('2008-09-23', new Date('2026-09-22T17:00:00-06:00'))).toBe(false);
  });

  it('refuses a birth date that is invalid, future, too old or too young', () => {
    const now = '2026-09-23T12:00:00Z';
    expect(birthDateProblem('2013-09-23', now)).toBeNull();
    expect(birthDateProblem('2013-09-24', now)).toBe('young');
    expect(birthDateProblem('2026-09-24', now)).toBe('future');
    expect(birthDateProblem('1899-12-31', now)).toBe('invalid');
    expect(birthDateProblem(BIRTH_DATE_MIN, now)).toBeNull();
    expect(birthDateProblem('2013-02-30', now)).toBe('invalid');
  });

  it('gives the latest birth date of an age for the date field', () => {
    expect(latestBirthDate(13, '2026-09-23T12:00:00Z')).toBe('2013-09-23');
    expect(latestBirthDate(18, '2028-02-29T12:00:00Z')).toBe('2010-02-28');
    const latest = latestBirthDate(18, '2026-03-01T00:00:00Z');
    expect(latest).toBe('2008-03-01');
    expect(isComercioAge(latest ?? '', '2026-03-01T00:00:00Z')).toBe(true);
  });
});

describe('Discord account age (9.15.2)', () => {
  it('reads the creation instant from the snowflake', () => {
    // Discord's documented example id.
    expect(discordCreatedAt('175928847299117063')?.toISOString()).toBe('2016-04-30T11:18:25.796Z');
    const at = Date.parse('2026-07-01T00:00:00Z');
    expect(discordCreatedAt(snowflakeAt(at))?.getTime()).toBe(at);
  });

  it('refuses what is not a snowflake the database can read', () => {
    expect(discordCreatedAt('abc')).toBeNull();
    expect(discordCreatedAt('')).toBeNull();
    expect(discordCreatedAt('12345678901234567890')).toBeNull();
    expect(discordCreatedAt('9223372036854775808')).toBeNull();
  });

  it('needs 60 days: 59 is not enough', () => {
    const now = Date.parse('2026-09-23T12:00:00Z');
    const day = 86_400_000;
    const sixty = snowflakeAt(now - 60 * day);
    const fiftyNine = snowflakeAt(now - 59 * day - 1000);
    expect(discordAccountAgeDays(sixty, now)).toBe(60);
    expect(discordOldEnough(sixty, now)).toBe(true);
    expect(discordAccountAgeDays(fiftyNine, now)).toBe(59);
    expect(discordOldEnough(fiftyNine, now)).toBe(false);
    expect(discordOldEnough('nope', now)).toBe(false);
  });
});

describe('identities', () => {
  const identities = [
    { provider: 'email', id: 'x', identity_data: { email: 'a@example.com' } },
    {
      provider: 'google',
      id: '1098',
      identity_data: { picture: 'https://lh3.googleusercontent.com/a/photo' },
    },
    {
      provider: 'discord',
      id: '175928847299117063',
      identity_data: {
        provider_id: '175928847299117063',
        avatar_url: 'https://cdn.discordapp.com/avatars/1/abc.png',
      },
    },
  ];

  it('prefers the Discord avatar, then Google, and only https', () => {
    expect(identityAvatar(identities)).toBe('https://cdn.discordapp.com/avatars/1/abc.png');
    expect(identityAvatar(identities.slice(0, 2))).toBe(
      'https://lh3.googleusercontent.com/a/photo',
    );
    expect(
      identityAvatar([
        { provider: 'discord', identity_data: { avatar_url: 'javascript:alert(1)' } },
      ]),
    ).toBeNull();
    expect(identityAvatar([])).toBeNull();
  });

  it('finds the Discord user id', () => {
    expect(discordIdOf(identities)).toBe('175928847299117063');
    expect(discordIdOf([{ provider: 'discord', id: '42', identity_data: { sub: '99' } }])).toBe(
      '99',
    );
    expect(discordIdOf([{ provider: 'google', id: '1' }])).toBeNull();
  });
});
