import type { Messages } from '@/i18n/messages/en';

// The texts of the structured account page (Cuenta-panel.dc.html): `account.panel` of the
// dictionaries (13.2). `{date}` is «09/2026», `{n}` a count, `{days}` DISCORD_EDAD_MIN_DIAS,
// `{provider}` Discord, Google or Twitch, `{name}` the user name at the provider, `{hours}`
// PRESENCIA_INACTIVO_HORAS and `{minutes}` PRESENCIA_SIN_SENAL_MIN.
export type AccountPanelTexts = Messages['account']['panel'];
