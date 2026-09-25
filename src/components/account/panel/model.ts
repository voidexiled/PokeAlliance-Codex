// The pure pieces of the account pages (`/{l}/cuenta/` and its Comercio pages, Cuenta-panel.dc.html):
// which sections and pages a build and an account have, the section of an address fragment, the
// link of each nav entry, the rows of «Conexiones», the Comercio requirements of «Resumen» and the
// short values of the phone index. No React, no supabase-js: tests/account/account-panel.test.ts
// reads them as they are.
import { isAnchorProvider, type IdentityLike } from '@/lib/account/registration';
import { DISCORD_EDAD_MIN_DIAS } from '@/lib/trade/limits';

/** The sections, in the order of the section nav; each is also its address fragment. */
export const PANEL_SECTIONS = [
  'resumen',
  'perfil',
  'personajes',
  'conexiones',
  'seguridad',
  'canales',
  'estado',
  'guilds',
  'eliminar',
] as const;
export type PanelSection = (typeof PANEL_SECTIONS)[number];

/**
 * The Comercio pages of the account, each a route of its own under `/{l}/cuenta/` in the same
 * frame (the card and the section nav): «Reputación» is «Mi perfil» (`/{l}/cuenta/perfil/`, the
 * reputation and the reviews), «Anuncios» the account's listings and «Operaciones» its deals.
 */
export const PANEL_PAGES = ['reputacion', 'anuncios', 'operaciones'] as const;
export type PanelPage = (typeof PANEL_PAGES)[number];

/** An entry of the nav: a section of `/{l}/cuenta/` or a page of its own. */
export type PanelEntry = PanelSection | PanelPage;

/** The folder of each page under `/{l}/cuenta/`. */
export const PAGE_SLUGS: Readonly<Record<PanelPage, string>> = {
  reputacion: 'perfil',
  anuncios: 'anuncios',
  operaciones: 'operaciones',
};

export type PanelGroup = 'cuenta' | 'comercio' | 'guild';

/** The groups of the nav; «Eliminar cuenta» stands apart, after them. */
export const PANEL_GROUPS: readonly { group: PanelGroup; sections: readonly PanelEntry[] }[] = [
  { group: 'cuenta', sections: ['resumen', 'perfil', 'personajes', 'conexiones', 'seguridad'] },
  {
    group: 'comercio',
    sections: ['reputacion', 'anuncios', 'operaciones', 'canales', 'estado'],
  },
  { group: 'guild', sections: ['guilds'] },
];

export interface PanelFeatures {
  /** COMERCIO_PUBLICO: the contact channels. */
  comercio: boolean;
  /**
   * COMERCIO_PUBLICO and an account of 18 or more: the online status (9.15.6) and the Comercio
   * pages (reputation, listings, deals).
   */
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

/** The pages this build and this account have: Comercio's, for an account of 18 or more. */
export function availablePages(features: PanelFeatures): PanelPage[] {
  return features.presence ? [...PANEL_PAGES] : [];
}

/** Every nav entry this build and this account have: the sections and the pages. */
export function availableEntries(features: PanelFeatures): PanelEntry[] {
  return [...availableSections(features), ...availablePages(features)];
}

/** The groups with at least one available entry, each in nav order. */
export function visibleGroups(
  available: readonly PanelEntry[],
): { group: PanelGroup; sections: PanelEntry[] }[] {
  return PANEL_GROUPS.map(({ group, sections }) => ({
    group,
    sections: sections.filter((section) => available.includes(section)),
  })).filter(({ sections }) => sections.length > 0);
}

export function isPanelPage(entry: PanelEntry): entry is PanelPage {
  return (PANEL_PAGES as readonly string[]).includes(entry);
}

/** `/{l}/cuenta/perfil/`: the route of a page. */
export function pageHref(page: PanelPage, locale: string): string {
  return `/${locale}/cuenta/${PAGE_SLUGS[page]}/`;
}

/**
 * The link of a nav entry: a page is its route; a section is its fragment on `/{l}/cuenta/`
 * itself (`onRoot`) and `/{l}/cuenta/#perfil` from a page.
 */
export function entryHref(entry: PanelEntry, locale: string, onRoot: boolean): string {
  if (isPanelPage(entry)) return pageHref(entry, locale);
  return onRoot ? `#${entry}` : `/${locale}/cuenta/#${entry}`;
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
