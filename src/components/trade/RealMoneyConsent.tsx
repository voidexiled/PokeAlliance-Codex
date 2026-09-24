import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

import { Notice } from '@/components/content/Notice';
import { Button } from '@/components/controls/Button';
import { Dialog, initialFocus } from '@/components/controls/Dialog';
import { TextLink } from '@/components/controls/TextLink';
import type { Locale } from '@/i18n/config';
import type { Messages } from '@/i18n/messages/en';
import { fill } from '@/i18n/messages/types';
import { formatDate } from '@/lib/format/dates';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { mapSupabaseError, toSupabaseFailure } from '@/lib/supabase/errors';
import {
  acceptRealMoneyConsent,
  getMyAccount,
  listMyTransactions,
  startTransaction,
} from '@/lib/supabase/trade';
import type { AccountSummary } from '@/lib/supabase/trade';

import { formatOperationNumber } from './ReportDialog';

// Real money in Comercio (spec 9.15.2), phase B only:
//
//   - `RealMoneyConsent`, the `Dialog` an account accepts the first time it contacts the seller
//     of a listing with a real-money price, or publishes one: the site processes no payment and
//     guarantees no deal; there is a risk of scam, with short advice; on a report, the IP and the
//     browser identifier of its Comercio actions are the evidence moderation reads (9.15.3); the
//     sanctions only reach Comercio. «Cancelar» and «Entiendo y acepto», the focus on «Cancelar»
//     (a stray Enter never accepts). The database keeps the acceptance in `trade_consents` with
//     its version (`CONSENTIMIENTO_DINERO_REAL_VERSION`); a new version asks again. The composer
//     of the next milestone asks it before publishing with the same dialog.
//   - `ContactSeller`, «Contactar al vendedor» on a listing detail (9.6, 9.10): it opens a deal
//     (`startTransaction`). Nothing loads before the press: supabase-js comes then, on demand
//     (D-025). Without a session the notice «Entra o crea una cuenta para usar Comercio.» links to
//     the account. With one, the account (`getMyAccount`) names the first requirement of 9.15.2
//     it misses (`comercioBlock`): an unfinished registration, a Comercio suspension, under 18, no
//     Discord, a Discord younger than `DISCORD_EDAD_MIN_DIAS` days. A real-money listing then
//     asks for the consent when the current version was not accepted (`consentCurrent`), and
//     the deal starts: «Operación OP-000123 iniciada.» with the link to «Mis operaciones». A
//     second deal on the same listing answers «Ya tienes una operación abierta con este anuncio.».
//
// Nothing here decides a permission: the functions of 9.12.3 check the session, the account, the
// age, Discord, the consent and the limits again, and store the evidence of 9.15.3 (the client
// module sends the device id). These checks only spare a call the server would refuse, and say
// why in the visitor's words.

// ------------------------------------------------------------------------ the dialog

/** The texts of the consent (DP1): the title, its points in order and the two buttons. */
export interface RealMoneyConsentLabels {
  /** «Operaciones con dinero real». */
  title: string;
  /** One paragraph each: payments, risk and advice, evidence (with its days filled), sanctions. */
  points: readonly string[];
  /** «Entiendo y acepto». */
  accept: string;
  /** «Cancelar». */
  cancel: string;
}

/**
 * The labels of the consent from the `trade` namespace of the page's dictionary: `days` is
 * EVIDENCIA_DIAS (9.15.3), written by the page, which the evidence paragraph names.
 */
export function realMoneyConsentLabels(
  trade: Pick<Messages['trade'], 'realMoney' | 'cancel'>,
  days: string,
): RealMoneyConsentLabels {
  const { realMoney } = trade;
  return {
    title: realMoney.title,
    points: [
      realMoney.payments,
      realMoney.risk,
      fill(realMoney.data, { days }),
      realMoney.sanctions,
    ],
    accept: realMoney.accept,
    cancel: trade.cancel,
  };
}

export interface RealMoneyConsentProps {
  open: boolean;
  /** «Entiendo y acepto». The caller saves the acceptance and closes the dialog. */
  onAccept: () => void;
  /** «Cancelar», the cross or Escape: every close. It must set `open` back to false. */
  onClose: () => void;
  labels: RealMoneyConsentLabels;
  /** `ui.close` and `ui.dismiss`. */
  ui: { close: string; dismiss: string };
  /** While the acceptance is being saved: «Entiendo y acepto» is disabled. */
  busy?: boolean;
  /** The failure of the last acceptance, shown inside the dialog. */
  error?: string | null;
  onErrorClose?: () => void;
}

/** The consent of 9.15.2 before the first real-money contact or listing. */
export function RealMoneyConsent({
  open,
  onAccept,
  onClose,
  labels,
  ui,
  busy = false,
  error = null,
  onErrorClose,
}: RealMoneyConsentProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={labels.title}
      closeLabel={ui.close}
      actions={
        <>
          <Button {...initialFocus} onClick={onClose}>
            {labels.cancel}
          </Button>
          <Button variant="solid" onClick={onAccept} disabled={busy}>
            {labels.accept}
          </Button>
        </>
      }
    >
      {labels.points.map((point) => (
        <p key={point}>{point}</p>
      ))}
      {error !== null ? (
        <Notice open onClose={onErrorClose} closeLabel={ui.dismiss}>
          {error}
        </Notice>
      ) : null}
    </Dialog>
  );
}

// ------------------------------------------------------------------------ the contact

/** The texts of «Contactar al vendedor» (DP1), with the numbers already written by the page. */
export interface ContactSellerLabels {
  /** «Contactar al vendedor». */
  contact: string;
  /** «Operación {number} iniciada.». */
  started: string;
  /** «Ver mis operaciones». */
  goToDeals: string;
  /** «Entra o crea una cuenta para usar Comercio.». */
  signIn: string;
  /** «Completa tu cuenta para usar Comercio.». */
  account: string;
  /** «Comercio es solo para mayores de 18 años.». */
  adultsOnly: string;
  /** «Vincula Discord para usar Comercio.». */
  discord: string;
  /** «Comercio pide una cuenta de Discord con al menos 60 días.», the days filled. */
  discordAge: string;
  /** «Tu cuenta está suspendida en Comercio hasta el {date}.». */
  suspendedUntil: string;
  /** «Tu cuenta está suspendida en Comercio.». */
  suspended: string;
  /** «Ir a mi cuenta». */
  goToAccount: string;
  /** «Ya tienes una operación abierta con este anuncio.». */
  openDeal: string;
  consent: RealMoneyConsentLabels;
}

export interface ContactSellerProps {
  locale: Locale;
  /** The listing the deal is about. */
  listingId: string;
  /** Whether its price has real money: then the first contact asks for the consent (9.15.2). */
  realMoney: boolean;
  labels: ContactSellerLabels;
  /** `ui.close` and `ui.dismiss`. */
  ui: { close: string; dismiss: string };
}

/** A notice under the button: its text and, for some, a link. */
export interface ContactMessage {
  text: string;
  link: { href: string; label: string } | null;
}

/** The end of a Comercio suspension that means a ban (9.15.5). */
const BANNED = 'infinity';

/**
 * What stops the account from contacting a seller (9.15.2), or `null` when nothing does: the
 * first requirement the database says it misses, in the visitor's words. An account refused for
 * a reason the database does not name is sent to complete its account.
 */
export function contactBlocker(
  account: Pick<AccountSummary, 'comercioBlock' | 'comercioEligible' | 'suspendedUntil'>,
  locale: Locale,
  labels: Pick<
    ContactSellerLabels,
    | 'account'
    | 'adultsOnly'
    | 'discord'
    | 'discordAge'
    | 'suspendedUntil'
    | 'suspended'
    | 'goToAccount'
  >,
): ContactMessage | null {
  const toAccount = { href: `/${locale}/cuenta/`, label: labels.goToAccount };
  switch (account.comercioBlock) {
    case 'account_incomplete':
      return { text: labels.account, link: toAccount };
    case 'underage':
      return { text: labels.adultsOnly, link: null };
    case 'discord_missing':
      return { text: labels.discord, link: toAccount };
    case 'discord_too_new':
      return { text: labels.discordAge, link: null };
    case 'suspended': {
      const until = account.suspendedUntil;
      return until === null || until === BANNED
        ? { text: labels.suspended, link: null }
        : { text: fill(labels.suspendedUntil, { date: formatDate(until, locale) }), link: null };
    }
    case null:
      return account.comercioEligible ? null : { text: labels.account, link: toAccount };
  }
}

/** «Contactar al vendedor» of a listing detail, phase B (9.6, 9.10, 9.15.2). */
export function ContactSeller({ locale, listingId, realMoney, labels, ui }: ContactSellerProps) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<ContactMessage | null>(null);
  const [consentOpen, setConsentOpen] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  const client = useRef<SupabaseClient | null>(null);
  const toAccount = { href: `/${locale}/cuenta/`, label: labels.goToAccount };
  const toDeals = { href: `/${locale}/comercio/operaciones/`, label: labels.goToDeals };

  /** What a refused call shows (9.12.3: 42501 a requirement, 23505 the open deal). */
  function refused(failure: unknown): ContactMessage {
    const { code } = toSupabaseFailure(failure);
    if (code === '42501') return { text: labels.account, link: toAccount };
    if (code === '23505') return { text: labels.openDeal, link: null };
    return { text: mapSupabaseError(failure, locale), link: null };
  }

  async function start(loaded: SupabaseClient): Promise<void> {
    const { data: id, error } = await startTransaction(loaded, listingId);
    if (error !== null || id === null) {
      setMessage(refused(error));
      return;
    }
    // The deal number of 9.15.4 comes with the account's deals; without it the notice is the
    // link to them alone.
    const deals = await listMyTransactions(loaded);
    const deal = deals.data?.find((transaction) => transaction.id === id);
    setMessage(
      deal === undefined
        ? { text: '', link: toDeals }
        : {
            text: fill(labels.started, { number: formatOperationNumber(deal.number) }),
            link: toDeals,
          },
    );
  }

  async function contact(): Promise<void> {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const loaded = await getSupabaseBrowserClient();
      if (loaded === null) {
        setMessage({ text: mapSupabaseError(null, locale), link: null });
        return;
      }
      const { data } = await loaded.auth.getSession();
      if (data.session === null) {
        setMessage({ text: labels.signIn, link: toAccount });
        return;
      }
      client.current = loaded;
      const account = await getMyAccount(loaded);
      if (account.error !== null) {
        setMessage(refused(account.error));
        return;
      }
      if (account.data === null) {
        setMessage({ text: labels.signIn, link: toAccount });
        return;
      }
      const blocker = contactBlocker(account.data, locale, labels);
      if (blocker !== null) {
        setMessage(blocker);
        return;
      }
      if (realMoney && !account.data.consentCurrent) {
        setConsentError(null);
        setConsentOpen(true);
        return;
      }
      await start(loaded);
    } catch (caught) {
      setMessage(refused(caught));
    } finally {
      setBusy(false);
    }
  }

  async function accept(): Promise<void> {
    const loaded = client.current;
    if (loaded === null || busy) return;
    setBusy(true);
    setConsentError(null);
    try {
      const { error } = await acceptRealMoneyConsent(loaded);
      if (error !== null) {
        setConsentError(mapSupabaseError(error, locale));
        return;
      }
      setConsentOpen(false);
      await start(loaded);
    } catch (caught) {
      setConsentError(mapSupabaseError(caught, locale));
    } finally {
      setBusy(false);
    }
  }

  let notice: ReactNode = null;
  if (message !== null) {
    notice = (
      <Notice open onClose={() => setMessage(null)} closeLabel={ui.dismiss}>
        {message.text}
        {message.link === null ? null : (
          <>
            {message.text === '' ? null : ' '}
            <TextLink href={message.link.href}>{message.link.label}</TextLink>
          </>
        )}
      </Notice>
    );
  }

  return (
    <div className="ac-contact-seller">
      <Button variant="solid" onClick={() => void contact()} disabled={busy}>
        {labels.contact}
      </Button>
      {notice}
      <RealMoneyConsent
        open={consentOpen}
        onAccept={() => void accept()}
        onClose={() => setConsentOpen(false)}
        labels={labels.consent}
        ui={ui}
        busy={busy}
        error={consentError}
        onErrorClose={() => setConsentError(null)}
      />
    </div>
  );
}
