import type { Locale } from '@/i18n/config';
import { fill, plural } from '@/i18n/messages/types';
import type { GuildRole, SupabaseGuild } from '@/lib/supabase/account';
import type { TradeChannel } from '@/lib/supabase/trade';

import type { AccountMessages, AccountTradeTexts } from '../AccountPanel';
import { accountAge } from './model';
import type { AccountPanelTexts } from './texts';

/** «cuenta de 2 años» / «2-year-old account». */
export function accountAgeText(
  days: number,
  texts: AccountPanelTexts['connections'],
  locale: Locale,
): string {
  const { unit, n } = accountAge(days);
  const entry =
    unit === 'days' ? texts.ageDays : unit === 'months' ? texts.ageMonths : texts.ageYears;
  return fill(plural(locale, n, entry), { n: new Intl.NumberFormat(locale).format(n) });
}

/** Guilds created before M13 may have no display name: their key is what the account typed. */
export function guildName(guild: SupabaseGuild): string {
  return guild.display_name ?? guild.guild_key;
}

export function roleLabel(role: GuildRole, roles: AccountMessages['guilds']['roles']): string {
  switch (role) {
    case 'owner':
      return roles.owner;
    case 'officer':
      return roles.officer;
    default:
      return roles.member;
  }
}

/** The short name of a channel in «Resumen»: the kind, or the platform of another one. */
export function channelName(channel: TradeChannel, labels: AccountTradeTexts['channels']): string {
  switch (channel.kind) {
    case 'email':
      return labels.correo;
    case 'phone':
      return fill(labels.telefono, { code: '' }).trim();
    case 'discord':
    case 'google':
    case 'twitch':
      return labels[channel.kind];
    default:
      return channel.platform ?? channel.label ?? '—';
  }
}

/** «09/2026»: the month an account was created, in the game's zone. */
export function monthYear(value: string, locale: Locale, timeZone: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  // formatToParts: some locales (es in ICU) drop the month's leading zero from the pattern.
  const parts = new Intl.DateTimeFormat(locale, {
    month: 'numeric',
    year: 'numeric',
    timeZone,
  }).formatToParts(date);
  const month = parts.find((part) => part.type === 'month')?.value ?? '';
  const year = parts.find((part) => part.type === 'year')?.value ?? '';
  return `${month.padStart(2, '0')}/${year}`;
}

/** A country code by its name in the page's language (Intl.DisplayNames); the code otherwise. */
export function countryName(code: string, locale: Locale): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}
