// The state of the header account entry (spec 9.16.1, 9.16.4): src/scripts/account-entry.ts
// derives what the entry shows from the stored session and the cached profile of
// src/lib/account/session-cache.ts. These are the pure parts; the module touches the DOM only in
// a browser, so importing it here runs nothing.
import { describe, expect, it } from 'vitest';

import type { CachedAccount, StoredSession } from '@/lib/account/session-cache';
import {
  chipName,
  entryPresence,
  entryState,
  initialOf,
  type EntryTexts,
} from '@/scripts/account-entry';

const session: StoredSession = {
  accessToken: 'token',
  expiresAt: null,
  userId: '11111111-1111-4111-8111-111111111111',
};

function account(overrides: Partial<CachedAccount> = {}): CachedAccount {
  return {
    userId: session.userId,
    username: 'kaiser',
    player: 'Kaiser',
    world: 'moon',
    avatar: null,
    presence: 'en_juego',
    moderator: false,
    registrationComplete: true,
    ...overrides,
  };
}

const presence = { en_juego: 'En el juego', ausente: 'Ausente', desconectado: 'Desconectado' };

const texts: EntryTexts = {
  label: 'Cuenta de {user}',
  incomplete: 'Registro sin terminar',
  finish: 'Completar registro',
  presence,
};

describe('entryState', () => {
  it('shows «Iniciar sesión» without a stored session, also when storage is unavailable', () => {
    expect(entryState({ session: null, account: null })).toEqual({ kind: 'signed-out' });
    // A cache left behind by a session that ended does not bring the chip back.
    expect(entryState({ session: null, account: account() })).toEqual({ kind: 'signed-out' });
  });

  it('keeps the empty slot for a session the cache does not describe yet', () => {
    expect(entryState({ session, account: null })).toEqual({ kind: 'unknown' });
  });

  it('shows the chip for a session with its cached profile', () => {
    const cached = account();
    expect(entryState({ session, account: cached })).toEqual({
      kind: 'signed-in',
      account: cached,
    });
  });
});

describe('entryPresence', () => {
  it('draws no dot without COMERCIO_PUBLICO', () => {
    expect(entryPresence(account(), null)).toBeNull();
  });

  it('draws no dot while the registration is unfinished', () => {
    expect(entryPresence(account({ registrationComplete: false }), presence)).toBeNull();
  });

  it('labels the chosen status', () => {
    expect(entryPresence(account({ presence: 'ausente' }), presence)).toEqual({
      state: 'ausente',
      label: 'Ausente',
    });
  });

  it('shows «Desconectado» when the cache does not know the status', () => {
    expect(entryPresence(account({ presence: null }), presence)).toEqual({
      state: 'desconectado',
      label: 'Desconectado',
    });
  });
});

describe('chipName', () => {
  it('names the account and its status', () => {
    const cached = account();
    expect(chipName(cached, texts, entryPresence(cached, presence))).toBe(
      'Cuenta de kaiser, En el juego',
    );
  });

  it('names the account alone without COMERCIO_PUBLICO', () => {
    const cached = account();
    expect(chipName(cached, texts, entryPresence(cached, null))).toBe('Cuenta de kaiser');
  });

  it('says an unfinished registration, which draws the «!» mark instead of the dot', () => {
    const cached = account({ registrationComplete: false });
    expect(chipName(cached, texts, entryPresence(cached, presence))).toBe(
      'Cuenta de kaiser, Registro sin terminar',
    );
  });

  it('is «Completar registro», its visible text, before the account has a username', () => {
    const cached = account({ username: null, registrationComplete: false });
    expect(chipName(cached, texts, entryPresence(cached, presence))).toBe('Completar registro');
  });
});

describe('initialOf', () => {
  it('takes the first letter of the username, upper case', () => {
    expect(initialOf('kaiser')).toBe('K');
    expect(initialOf('  émile')).toBe('É');
  });

  it('is empty without a username', () => {
    expect(initialOf(null)).toBe('');
    expect(initialOf('')).toBe('');
  });
});
