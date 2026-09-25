import type { Messages } from '@/i18n/messages/en';

// The texts of the structured account page (Cuenta-panel.dc.html): `account.panel` of the
// dictionaries (13.2). `{date}` is «09/2026», `{n}` a count, `{days}` DISCORD_EDAD_MIN_DIAS,
// `{provider}` Discord, Google or Twitch, `{name}` the user name at the provider, `{hours}`
// PRESENCIA_INACTIVO_HORAS and `{minutes}` PRESENCIA_SIN_SENAL_MIN.
export type AccountPanelTexts = Omit<
  Messages['account']['panel'],
  'characters' | 'security' | 'channelsIntro' | 'channelsFooter'
>;

/** «Personajes» (`account.panel.characters`). */
export type CharacterTexts = Messages['account']['panel']['characters'];

/** «Canales de contacto»: `account.channels` with the section's intro and footer lines. */
export type ChannelTexts = Messages['account']['channels'] & { intro: string; footer: string };

/** «Seguridad» (`account.panel.security`). */
export type SecurityTexts = Messages['account']['panel']['security'];

/**
 * The texts that only sections loaded on demand read: «Personajes» (and «Perfil», which shows the
 * main character), «Canales de contacto» and «Seguridad». The page writes them as JSON beside the
 * island (`SECTION_TEXTS_ID`) instead of in its props, each section reads them when it opens, and
 * the props of /cuenta/ stay within 13.6.
 */
export interface SectionTexts {
  characters: CharacterTexts;
  channels: ChannelTexts;
  security: SecurityTexts;
}

export const SECTION_TEXTS_ID = 'cuenta-textos';

/** The texts of the JSON beside the island, from the `account` namespace. */
export function sectionTexts(account: Messages['account']): SectionTexts {
  return {
    characters: account.panel.characters,
    channels: {
      ...account.channels,
      intro: account.panel.channelsIntro,
      footer: account.panel.channelsFooter,
    },
    security: account.panel.security,
  };
}

let sidecar: SectionTexts | null = null;

/** The texts of the JSON beside the island; null when the page has none. */
export function readSectionTexts(): SectionTexts | null {
  if (sidecar !== null || typeof document === 'undefined') return sidecar;
  try {
    const json = document.getElementById(SECTION_TEXTS_ID)?.textContent;
    sidecar = json ? (JSON.parse(json) as SectionTexts) : null;
  } catch {
    sidecar = null;
  }
  return sidecar;
}

/** The «Personajes» texts of the page; null when the page has none. */
export function readCharacterTexts(): CharacterTexts | null {
  return readSectionTexts()?.characters ?? null;
}

/** `account.panel` without the texts of the JSON beside the island, for its props (13.6). */
export function panelWithoutCharacters(panel: Messages['account']['panel']): AccountPanelTexts {
  const { characters, security, channelsIntro, channelsFooter, ...rest } = panel;
  void characters;
  void security;
  void channelsIntro;
  void channelsFooter;
  return rest;
}
