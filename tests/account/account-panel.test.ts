import { describe, expect, it } from 'vitest';

import { monthYear } from '@/components/account/panel/format';

import {
  accountAge,
  availableSections,
  comercioReady,
  comercioRequirements,
  connectionRows,
  guildsSummary,
  initialOf,
  sectionFromHash,
  visibleGroups,
  type RequirementFacts,
} from '@/components/account/panel/model';

const ALL = { discord: true, google: true, twitch: true };
const NONE = { discord: false, google: false, twitch: false };

describe('account panel sections', () => {
  it('drops the Comercio sections the build or the account does not have', () => {
    expect(availableSections({ comercio: false, presence: false })).toEqual([
      'resumen',
      'perfil',
      'conexiones',
      'seguridad',
      'guilds',
      'eliminar',
    ]);
    expect(availableSections({ comercio: true, presence: false })).toContain('canales');
    expect(availableSections({ comercio: true, presence: false })).not.toContain('estado');
    const groups = visibleGroups(availableSections({ comercio: false, presence: false }));
    expect(groups.map(({ group }) => group)).toEqual(['cuenta', 'guild']);
  });

  it('reads the section of the fragment, and nothing else', () => {
    const available = availableSections({ comercio: false, presence: false });
    expect(sectionFromHash('#conexiones', available)).toBe('conexiones');
    expect(sectionFromHash('#Perfil', available)).toBe('perfil');
    expect(sectionFromHash('#canales', available)).toBeNull();
    expect(sectionFromHash('#invitacion=abc', available)).toBeNull();
    expect(sectionFromHash('', available)).toBeNull();
  });

  it('draws the initial of the name', () => {
    expect(initialOf('kaiser_lugia')).toBe('K');
    expect(initialOf('  ñandú')).toBe('Ñ');
    expect(initialOf(null)).toBe('?');
  });
});

describe('account panel connections', () => {
  const discord = { provider: 'discord', identity_data: { user_name: 'kaiser' } };
  const google = { provider: 'google', identity_data: { email: 'k@example.com' } };
  const email = { provider: 'email', identity_data: { email: 'k@example.com' } };

  it('keeps the only anchor, frees it once a second anchor is linked', () => {
    const one = connectionRows([email, discord], ALL);
    expect(one.map((row) => row.provider)).toEqual(['discord', 'google', 'twitch']);
    expect(one[0]).toMatchObject({ name: 'kaiser', onlyAnchor: true, unlinkable: false });
    const two = connectionRows([discord, google], ALL);
    expect(two.filter((row) => row.unlinkable).map((row) => row.provider)).toEqual([
      'discord',
      'google',
    ]);
  });

  it('shows a provider only when it is linked or switched on', () => {
    expect(connectionRows([discord], NONE).map((row) => row.provider)).toEqual(['discord']);
  });

  it('says an account age in days, months or years', () => {
    expect(accountAge(12)).toEqual({ unit: 'days', n: 12 });
    expect(accountAge(90)).toEqual({ unit: 'months', n: 3 });
    expect(accountAge(800)).toEqual({ unit: 'years', n: 2 });
  });
});

describe('account panel Comercio requirements', () => {
  const ready: RequirementFacts = {
    registrationComplete: true,
    adult: true,
    suspendedUntil: null,
    consentCurrent: false,
    comercioBlock: null,
    discordAgeDays: 700,
    visibleChannels: 1,
  };

  it('is ready without the consent, which is asked at the first real-money action', () => {
    const requirements = comercioRequirements(ready);
    expect(requirements.find((item) => item.key === 'consent')?.done).toBe(false);
    expect(comercioReady(requirements)).toBe(true);
  });

  it('is not ready with a young Discord, no visible channel or a suspension', () => {
    expect(comercioReady(comercioRequirements({ ...ready, discordAgeDays: 20 }))).toBe(false);
    expect(
      comercioReady(comercioRequirements({ ...ready, comercioBlock: 'discord_too_new' })),
    ).toBe(false);
    expect(comercioReady(comercioRequirements({ ...ready, visibleChannels: 0 }))).toBe(false);
    expect(comercioReady(comercioRequirements({ ...ready, visibleChannels: null }))).toBe(false);
    expect(comercioReady(comercioRequirements({ ...ready, suspendedUntil: 'infinity' }))).toBe(
      false,
    );
  });

  it('summarises the guilds of the index', () => {
    expect(guildsSummary([])).toBeNull();
    expect(guildsSummary(['Los Kaiser', 'Sun Rockets'])).toEqual({ first: 'Los Kaiser', more: 1 });
  });
});

describe('monthYear', () => {
  it('always prints a two-digit month, in both locales', () => {
    expect(monthYear('2026-09-24T21:18:36Z', 'es', 'UTC')).toBe('09/2026');
    expect(monthYear('2026-09-24T21:18:36Z', 'en', 'UTC')).toBe('09/2026');
    expect(monthYear('not a date', 'es', 'UTC')).toBeNull();
  });
});
