// The pure pieces of the account page (`/{l}/cuenta/`, Cuenta-panel.dc.html): which sections a
// build and an account have, the section of an address fragment, the rows of «Conexiones», the
// Comercio requirements of «Resumen» and the short values of the phone index. No React, no
// supabase-js: tests/account/account-panel.test.ts reads them as they are.
import { isAnchorProvider, type IdentityLike } from '@/lib/account/registration';
import { DISCORD_EDAD_MIN_DIAS } from '@/lib/trade/limits';

/** The sections, in the order of the section nav; each is also its address fragment. */
export const PANEL_SECTIONS = [
  'resumen',
  'perfil',
  'conexiones',
  'seguridad',
  'canales',
  'estado',
  'guilds',
  'eliminar',
] as const;
export type PanelSection = (typeof PANEL_SECTIONS)[number];

export type PanelGroup = 'cuenta' | 'comercio' | 'guild';

/** The groups of the nav; «Eliminar cuenta» stands apart, after them. */
export const PANEL_GROUPS: readonly { group: PanelGroup; sections: readonly PanelSection[] }[] = [
  { group: 'cuenta', sections: ['resumen', 'perfil', 'conexiones', 'seguridad'] },
  { group: 'comercio', sections: ['canales', 'estado'] },
  { group: 'guild', sections: ['guilds'] },
];

export interface PanelFeatures {
  /** COMERCIO_PUBLICO: the contact channels. */
  comercio: boolean;
  /** COMERCIO_PUBLICO and an account of 18 or more: the online status (9.15.6). */
  presence: boolean;
}

/** The sections this build and this account have, in nav order. */
export function availableSections(features: PanelFeatures): PanelSection[] {
  return PANEL_SECTIONS.filter((section) => {
    if (section === 'canales') return features.comercio;
    if (section === 'estado') return features.presence;
    return true;
  });
}

/** The groups with at least one available section. */
export function visibleGroups(
  available: readonly PanelSection[],
): { group: PanelGroup; sections: PanelSection[] }[] {
  return PANEL_GROUPS.map(({ group, sections }) => ({
    group,
    sections: sections.filter((section) => available.includes(section)),
  })).filter(({ sections }) => sections.length > 0);
}

/** The section of `#perfil`…; null for no fragment or one that is no available section. */
export function sectionFromHash(
  hash: string,
  available: readonly PanelSection[],
): PanelSection | null {
  const key = hash.replace(/^#/, '').trim().toLowerCase();
  return (available as readonly string[]).includes(key) ? (key as PanelSection) : null;
}

/** The letter of the avatar without a picture: the first character of the name, upper case. */
export function initialOf(name: string | null | undefined): string {
  const first = Array.from((name ?? '').trim())[0];
  return first === undefined ? '?' : first.toLocaleUpperCase();
}

// -------------------------------------------------------------------------- «Conexiones»

export const PANEL_PROVIDERS = ['discord', 'google', 'twitch'] as const;
export type PanelProvider = (typeof PANEL_PROVIDERS)[number];

/** The name an identity shows: its user name at the provider, else its address. */
export function identityName(identity: IdentityLike): string | null {
  const data = identity.identity_data ?? {};
  for (const key of ['user_name', 'preferred_username', 'full_name', 'name', 'email']) {
    const value: unknown = data[key];
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
  }
  return null;
}

export interface ConnectionRow<I extends IdentityLike = IdentityLike> {
  provider: PanelProvider;
  /** Discord and Google anchor the account (9.15.1); Twitch is an optional badge. */
  anchor: boolean;
  identity: I | null;
  /** The linked identity's name; null when unlinked or unnamed. */
  name: string | null;
  /** «Desvincular» works: a linked identity that is not the last anchor. */
  unlinkable: boolean;
  /** The linked identity is the account's only anchor: «Desvincular» is shown disabled. */
  onlyAnchor: boolean;
}

/**
 * One row per provider that is linked or that the build switches on (PUBLIC_AUTH_*): an
 * unlinked provider without its switch has no row, so it offers no «Vincular» that cannot work.
 */
export function connectionRows<I extends IdentityLike>(
  identities: readonly I[] | null | undefined,
  enabled: Readonly<Record<PanelProvider, boolean>>,
): ConnectionRow<I>[] {
  const list = identities ?? [];
  const anchors = list.filter((identity) => isAnchorProvider(identity.provider)).length;
  return PANEL_PROVIDERS.flatMap((provider) => {
    const identity = list.find((candidate) => candidate.provider === provider) ?? null;
    if (identity === null && !enabled[provider]) return [];
    const anchor = isAnchorProvider(provider);
    const onlyAnchor = identity !== null && anchor && anchors <= 1;
    return [
      {
        provider,
        anchor,
        identity,
        name: identity === null ? null : identityName(identity),
        unlinkable: identity !== null && !onlyAnchor,
        onlyAnchor,
      },
    ];
  });
}

export type AgeUnit = 'days' | 'months' | 'years';

/** An account age for «cuenta de 2 años»: days under 60, months under a year, then years. */
export function accountAge(days: number): { unit: AgeUnit; n: number } {
  const whole = Math.max(0, Math.floor(days));
  if (whole < 60) return { unit: 'days', n: whole };
  if (whole < 365) return { unit: 'months', n: Math.floor(whole / 30) };
  return { unit: 'years', n: Math.floor(whole / 365) };
}

// --------------------------------------------------------------- «Requisitos de Comercio»

export type RequirementKey =
  'registration' | 'age' | 'discord' | 'channel' | 'suspension' | 'consent';

export interface Requirement {
  key: RequirementKey;
  done: boolean;
}

export interface RequirementFacts {
  registrationComplete: boolean;
  /** 18 or older by the stored birth date; null before step 3. */
  adult: boolean | null;
  suspendedUntil: string | null;
  consentCurrent: boolean;
  /** The first requirement the database says is missing (`trade_eligibility`). */
  comercioBlock: string | null;
  /** Days of the linked Discord account; null without one. */
  discordAgeDays: number | null;
  /** Verified channels shown on listings; null while unknown. */
  visibleChannels: number | null;
}

/**
 * The requirements of 9.15.2 in the order of the board. The consent is asked the first time an
 * action touches real money, so it never blocks the headline (`comercioReady`).
 */
export function comercioRequirements(facts: RequirementFacts): Requirement[] {
  const discordBlocked =
    facts.comercioBlock === 'discord_missing' || facts.comercioBlock === 'discord_too_new';
  return [
    { key: 'registration', done: facts.registrationComplete },
    { key: 'age', done: facts.adult === true },
    {
      key: 'discord',
      done:
        !discordBlocked &&
        facts.discordAgeDays !== null &&
        facts.discordAgeDays >= DISCORD_EDAD_MIN_DIAS,
    },
    { key: 'channel', done: (facts.visibleChannels ?? 0) > 0 },
    { key: 'suspension', done: facts.suspendedUntil === null },
    { key: 'consent', done: facts.consentCurrent },
  ];
}

/** Publishing and contacting work: every requirement but the consent is met. */
export function comercioReady(requirements: readonly Requirement[]): boolean {
  return requirements.every((requirement) => requirement.key === 'consent' || requirement.done);
}

/** «Los Kaiser y 1 más»: the first guild and how many more; null without guilds. */
export function guildsSummary(names: readonly string[]): { first: string; more: number } | null {
  if (names.length === 0) return null;
  return { first: names[0], more: names.length - 1 };
}
