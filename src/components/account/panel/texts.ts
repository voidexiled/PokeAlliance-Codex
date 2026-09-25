import type { Messages } from '@/i18n/messages/en';

// The texts of the structured account page (Cuenta-panel.dc.html): `account.panel` of the
// dictionaries (13.2). `{date}` is «09/2026», `{n}` a count, `{days}` DISCORD_EDAD_MIN_DIAS,
// `{provider}` Discord, Google or Twitch, `{name}` the user name at the provider, `{hours}`
// PRESENCIA_INACTIVO_HORAS and `{minutes}` PRESENCIA_SIN_SENAL_MIN.
export type AccountPanelTexts = Omit<Messages['account']['panel'], 'characters'>;

/**
 * «Personajes» (`account.panel.characters`). The page writes them as JSON beside the island
 * (`CHARACTER_TEXTS_ID`) instead of in its props: only the two sections that show characters read
 * them, when they open, and the props of /cuenta/ stay within 13.6.
 */
export type CharacterTexts = Messages['account']['panel']['characters'];

export const CHARACTER_TEXTS_ID = 'cuenta-personajes-textos';

let characterTexts: CharacterTexts | null = null;

/** The «Personajes» texts of the page; null when the page has none. */
export function readCharacterTexts(): CharacterTexts | null {
  if (characterTexts !== null || typeof document === 'undefined') return characterTexts;
  try {
    const json = document.getElementById(CHARACTER_TEXTS_ID)?.textContent;
    characterTexts = json ? (JSON.parse(json) as CharacterTexts) : null;
  } catch {
    characterTexts = null;
  }
  return characterTexts;
}

/** `account.panel` without «Personajes», for the props of an island (13.6). */
export function panelWithoutCharacters(panel: Messages['account']['panel']): AccountPanelTexts {
  const { characters, ...rest } = panel;
  void characters;
  return rest;
}
