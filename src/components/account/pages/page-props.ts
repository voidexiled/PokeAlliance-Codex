import { getAlternatePath, locales, type Locale } from '@/i18n/config';
import type { Messages } from '@/i18n/messages/en';
import { en } from '@/i18n/messages/en';
import { es } from '@/i18n/messages/es';
import { getMundos } from '@/lib/content/registry';
import { getSupabasePublicConfig } from '@/lib/supabase/env';
import { comercioPublico } from '@/lib/trade/registry';

import type { AccountPageProps } from '../AccountPage';

// Build-time helpers of the three Comercio pages of the account (`/{l}/cuenta/perfil/`,
// `/{l}/cuenta/anuncios/`, `/{l}/cuenta/operaciones/`, AccountPage.tsx). Only the .astro pages
// import this module: it reads the dictionaries and the registries (13.2), never an island.

const dictionaries: Record<Locale, Messages> = { es, en };

export function accountDictionary(locale: Locale): Messages {
  return dictionaries[locale];
}

/**
 * The paths of a page: one per locale when the build has the public Supabase settings and
 * COMERCIO_PUBLICO, none otherwise, so the build writes no page (S11, 9.3).
 */
export function accountPagePaths(): { params: { locale: Locale } }[] {
  if (getSupabasePublicConfig() === null || !comercioPublico()) return [];
  return locales.map((locale) => ({ params: { locale } }));
}

export function alternatesOf(path: string): Record<Locale, string> {
  return Object.fromEntries(
    locales.map((option) => [option, getAlternatePath(path, option)]),
  ) as Record<Locale, string>;
}

/** The props every page shares: the frame, the account states and the worlds. */
export function accountPageBase(
  locale: Locale,
  signInNotice: string,
): Omit<AccountPageProps, 'body'> {
  const { account, shell, trade, ui } = dictionaries[locale];
  return {
    locale,
    worlds: getMundos(locale).map((world) => ({ id: world.id, nombre: world.nombre })),
    frame: {
      title: account.title,
      panel: {
        nav: account.panel.nav,
        groups: account.panel.groups,
        sections: account.panel.sections,
        card: account.panel.card,
      },
      presence: {
        label: trade.presence.label,
        en_juego: trade.presence.en_juego,
        ausente: trade.presence.ausente,
        desconectado: trade.presence.desconectado,
      },
    },
    texts: {
      signInNotice,
      signIn: shell.account.signIn,
      unfinished: shell.account.incomplete,
      finish: shell.account.completeRegistration,
      retry: account.retry,
      adultsOnly: trade.adultsOnly,
    },
    ui: { close: ui.close, dismiss: ui.dismiss },
    comercio: comercioPublico(),
  };
}

/** The crumbs «Inicio › Cuenta › {page}»: «Cuenta» links the account page. */
export function accountCrumbs(locale: Locale, title: string): { label: string; href?: string }[] {
  return [
    { label: dictionaries[locale].account.title, href: `/${locale}/cuenta/` },
    { label: title },
  ];
}
