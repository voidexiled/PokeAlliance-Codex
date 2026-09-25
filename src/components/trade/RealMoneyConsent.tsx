import { Notice } from '@/components/content/Notice';
import { Button } from '@/components/controls/Button';
import { Dialog, initialFocus } from '@/components/controls/Dialog';
import type { Locale } from '@/i18n/config';
import type { Messages } from '@/i18n/messages/en';
import { fill } from '@/i18n/messages/types';
import { formatDate } from '@/lib/format/dates';
import type { AccountSummary } from '@/lib/supabase/trade';

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
//   - `contactBlocker`, the first requirement of 9.15.2 an account misses, in the reader's words:
//     «Contactar al vendedor» (TradeBox.tsx, the listing page) and «Publicar anuncio»
//     (ListingForm.tsx) read it before they call the database.
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
