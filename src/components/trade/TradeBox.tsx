import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

import { Notice } from '@/components/content/Notice';
import { Button } from '@/components/controls/Button';
import { Dialog, initialFocus } from '@/components/controls/Dialog';
import { TextLink } from '@/components/controls/TextLink';
import { Glyph } from '@/components/icons/Glyph';
import type { Locale } from '@/i18n/config';
import { fill } from '@/i18n/messages/types';
import { readAccountSnapshot } from '@/lib/account/session-cache';
import { formatDate } from '@/lib/format/dates';
import { formatInteger } from '@/lib/format/numbers';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { AccountCharacter, TradeContact } from '@/lib/supabase/trade';
import type { EstadoAnuncio } from '@/lib/trade/types';

import { contactBlocker, RealMoneyConsent } from './RealMoneyConsent';
import type { ContactMessage, ContactSellerLabels } from './RealMoneyConsent';
import { refusalFor, type RefusalLabels } from './refusals';

// The actions of the trade box of a listing page (board Anuncio-detalle, Variante 1; owner rules
// of 2026-09-24). The price and the seller above it are the page's HTML; this island decides who
// is looking and draws what that reader may do:
//
//   - a visitor without a session: «Contactar al vendedor» (the press says to sign in) and
//     «Copiar enlace»;
//   - a buyer: «Compras como {personaje} · {mundo}» and «Contactar al vendedor». Pokémon, Items
//     and Diamonds trade inside the listing's world, so a buyer without a character there gets the
//     line «Ninguno de tus personajes está en {mundo}. Añadir personaje» and the button disabled;
//     the database refuses it too (`buyer_world_required`). Pokédólares take any character. With
//     a deal open on this listing: «Operación abierta con {vendedor}», the seller's channels with
//     «Copiar», and «Ver operación»;
//   - the seller: the state and its end («Publicado · vence el …»), «Publicado como», the open
//     deals, «Editar anuncio» (the quantity included), «Marcar como reservado» or «Quitar
//     reserva», «Marcar como completado», «Renovar» once expired, and «Retirar anuncio» after a
//     confirmation. The island marks the box `data-ac-owner`, which hides the buyer-only rows.
//
// The owner is known without a request: the header's cache names the account's username
// (src/lib/account/session-cache.ts). supabase-js loads only for a signed-in reader. Nothing here
// decides a permission: the database functions check everything again.

/** Every text of the box's actions (DP1), `trade.box`, `trade.manage` and the rest. */
export interface TradeBoxLabels {
  buyingAs: string;
  noCharacter: string;
  addCharacter: string;
  dealOpen: string;
  viewDeal: string;
  copy: string;
  copied: string;
  copyLink: string;
  linkCopied: string;
  copyFailed: string;
  published: string;
  expires: string;
  completedOn: string;
  publishedAs: string;
  openDeals: string;
  view: string;
  edit: string;
  reserve: string;
  release: string;
  complete: string;
  renew: string;
  withdraw: string;
  withdrawTitle: string;
  withdrawText: string;
  cancel: string;
  /** «Reservado», «Completado», «Expirado». */
  states: { reservado: string; completado: string; expirado: string };
  /** The public labels of the channel kinds: «Correo», «Discord»… */
  channels: Readonly<Record<'email' | 'phone' | 'discord' | 'google' | 'twitch', string>>;
  refusals: RefusalLabels;
}

export interface TradeBoxProps {
  locale: Locale;
  listingId: string;
  /** The seller's handle (its username): the owner view is for that account. */
  seller: string;
  /** The seller's character («Void Exiled»), or its handle without one. */
  sellerName: string;
  /** The listing's world id and name. */
  world: string;
  worldName: string | null;
  /** Pokédólares: any character of the buyer will do. */
  anyWorld: boolean;
  /** The state the build saw; the island recomputes the expiry with the reader's clock. */
  status: EstadoAnuncio;
  expira: string;
  realMoney: boolean;
  /** World names by id: «Compras como Kaiserin · Titan 1». */
  worlds: Readonly<Record<string, string>>;
  hrefs: { characters: string; edit: string; deals: string };
  labels: TradeBoxLabels;
  contact: ContactSellerLabels;
  /** `ui.close` and `ui.dismiss`. */
  ui: { close: string; dismiss: string };
}

type Viewer =
  | { kind: 'loading' }
  | { kind: 'visitor' }
  | { kind: 'owner'; openDeals: number | null }
  | { kind: 'buyer'; characters: AccountCharacter[] | null };

interface OpenDeal {
  id: string;
  createdAt: string;
  contacts: TradeContact[];
}

type Copy = 'idle' | 'copied' | 'failed';

const OPEN = ['contacto', 'confirmada_vendedor', 'confirmada_comprador'];
const COPIED_MS = 2000;

function tradeModules() {
  return Promise.all([import('@/lib/supabase/trade'), import('@/lib/supabase/errors')]);
}

export function TradeBox(props: TradeBoxProps) {
  const { locale, labels, listingId } = props;
  const [viewer, setViewer] = useState<Viewer>({ kind: 'loading' });
  const [deal, setDeal] = useState<OpenDeal | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<ContactMessage | null>(null);
  const [consentOpen, setConsentOpen] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [linkCopy, setLinkCopy] = useState<Copy>('idle');
  const [copiedContact, setCopiedContact] = useState<number | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const client = useRef<SupabaseClient | null>(null);
  const root = useRef<HTMLDivElement>(null);

  // Who is looking: no session, the seller (the cached username), or a buyer with characters.
  useEffect(() => {
    setNow(Date.now());
    const { session, account } = readAccountSnapshot();
    if (session === null) {
      setViewer({ kind: 'visitor' });
      return undefined;
    }
    const owner = account?.username === props.seller;
    let alive = true;
    void (async () => {
      try {
        const loaded = await getSupabaseBrowserClient();
        const current = loaded === null ? null : (await loaded.auth.getSession()).data.session;
        if (loaded === null || current === null) {
          if (alive) setViewer({ kind: 'visitor' });
          return;
        }
        client.current = loaded;
        const [trade] = await tradeModules();
        const deals = await trade.listMyTransactions(loaded);
        const mine = (deals.data ?? []).filter(
          (entry) => entry.listing.id === listingId && OPEN.includes(entry.status),
        );
        if (owner) {
          if (alive) {
            setViewer({
              kind: 'owner',
              openDeals:
                deals.data === null ? null : mine.filter((d) => d.role === 'seller').length,
            });
          }
          return;
        }
        const listed = await trade.listMyCharacters(loaded);
        const open = mine.find((entry) => entry.role === 'buyer');
        if (open !== undefined) {
          const contacts = await trade.transactionContacts(loaded, open.id);
          if (alive)
            setDeal({ id: open.id, createdAt: open.createdAt, contacts: contacts.data ?? [] });
        }
        if (alive) setViewer({ kind: 'buyer', characters: listed.data });
      } catch {
        if (alive) setViewer({ kind: 'visitor' });
      }
    })();
    return () => {
      alive = false;
    };
  }, [listingId, props.seller]);

  // The seller sees its own box: the rows meant for a buyer hide (trade-detail.css).
  useLayoutEffect(() => {
    const box = root.current?.closest('.ac-trade-box');
    if (!(box instanceof HTMLElement)) return;
    if (viewer.kind === 'owner') box.dataset.acOwner = '';
    else delete box.dataset.acOwner;
  }, [viewer.kind]);

  useEffect(() => {
    if (linkCopy !== 'copied') return undefined;
    const timer = window.setTimeout(() => setLinkCopy('idle'), COPIED_MS);
    return () => window.clearTimeout(timer);
  }, [linkCopy]);

  useEffect(() => {
    if (copiedContact === null) return undefined;
    const timer = window.setTimeout(() => setCopiedContact(null), COPIED_MS);
    return () => window.clearTimeout(timer);
  }, [copiedContact]);

  useEffect(() => {
    if (linkCopy !== 'failed') return;
    const field = root.current?.querySelector<HTMLInputElement>('.ac-trade-box__url');
    field?.focus();
    field?.select();
  }, [linkCopy]);

  // The state the reader sees: a public listing past `expira` is «Expirado» (9.4).
  const expiresAt = Date.parse(props.expira);
  const status: EstadoAnuncio =
    (props.status === 'publicado' || props.status === 'reservado') &&
    now !== null &&
    !Number.isNaN(expiresAt) &&
    expiresAt <= now
      ? 'expirado'
      : props.status;
  const contactable = status === 'publicado' || status === 'reservado';

  // ---------------------------------------------------------------------------- contact
  const buyerCharacter =
    viewer.kind === 'buyer' && viewer.characters !== null
      ? (viewer.characters.find(
          (entry) => entry.isMain && (props.anyWorld || entry.worldKey === props.world),
        ) ??
        viewer.characters.find((entry) => props.anyWorld || entry.worldKey === props.world) ??
        null)
      : null;
  const noCharacterHere =
    viewer.kind === 'buyer' && viewer.characters !== null && buyerCharacter === null;

  const toAccount = { href: `/${locale}/cuenta/`, label: props.contact.goToAccount };

  async function start(loaded: SupabaseClient): Promise<void> {
    const [trade, errors] = await tradeModules();
    const started = await trade.startTransaction(loaded, listingId);
    if (started.error !== null || started.data === null) {
      const known = refusalFor(started.reason, labels.refusals, '');
      if (started.reason === 'buyer_world_required') {
        setMessage({
          text: known?.text ?? '',
          link: { href: props.hrefs.characters, label: labels.addCharacter },
        });
      } else if (started.error?.code === '23505') {
        setMessage({ text: props.contact.openDeal, link: null });
      } else if (started.error?.code === '42501') {
        setMessage({ text: props.contact.account, link: toAccount });
      } else {
        setMessage({
          text: known?.text ?? errors.mapSupabaseError(started.error, locale),
          link: null,
        });
      }
      return;
    }
    const contacts = await trade.transactionContacts(loaded, started.data);
    setDeal({
      id: started.data,
      createdAt: new Date().toISOString(),
      contacts: contacts.data ?? [],
    });
  }

  async function contact(): Promise<void> {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const loaded = client.current ?? (await getSupabaseBrowserClient());
      const [trade, errors] = await tradeModules();
      const session = loaded === null ? null : (await loaded.auth.getSession()).data.session;
      if (loaded === null || session === null) {
        setMessage({ text: props.contact.signIn, link: toAccount });
        return;
      }
      client.current = loaded;
      const account = await trade.getMyAccount(loaded);
      if (account.error !== null) {
        setMessage({ text: errors.mapSupabaseError(account.error, locale), link: null });
        return;
      }
      if (account.data === null) {
        setMessage({ text: props.contact.signIn, link: toAccount });
        return;
      }
      const blocker = contactBlocker(account.data, locale, props.contact);
      if (blocker !== null) {
        setMessage(blocker);
        return;
      }
      if (props.realMoney && !account.data.consentCurrent) {
        setConsentError(null);
        setConsentOpen(true);
        return;
      }
      await start(loaded);
    } catch {
      setMessage({ text: labels.refusals.network, link: null });
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
      const [trade, errors] = await tradeModules();
      const accepted = await trade.acceptRealMoneyConsent(loaded);
      if (accepted.error !== null) {
        setConsentError(errors.mapSupabaseError(accepted.error, locale));
        return;
      }
      setConsentOpen(false);
      await start(loaded);
    } catch {
      setConsentError(labels.refusals.network);
    } finally {
      setBusy(false);
    }
  }

  // ------------------------------------------------------------------------------ owner
  async function setStatus(next: 'publicado' | 'reservado' | 'completado' | 'retirado') {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const loaded = client.current ?? (await getSupabaseBrowserClient());
      if (loaded === null) throw new Error('no client');
      const [trade, errors] = await tradeModules();
      const done = await trade.setListingStatus(loaded, listingId, next);
      if (done.error !== null) {
        const known = refusalFor(done.reason, labels.refusals, '');
        setMessage({
          text: known?.text ?? errors.mapSupabaseError(done.error, locale),
          link: null,
        });
        return;
      }
      window.location.reload();
    } catch {
      setMessage({ text: labels.refusals.network, link: null });
    } finally {
      setBusy(false);
    }
  }

  // ------------------------------------------------------------------------------- copy
  const url = typeof window === 'undefined' ? '' : window.location.href.split('#')[0];

  async function copyLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopy('copied');
    } catch {
      setLinkCopy('failed');
    }
  }

  async function copyContact(index: number, value: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedContact(index);
    } catch {
      // The value is on screen: the reader copies it by hand.
    }
  }

  const copyButton = (
    <>
      <Button onClick={() => void copyLink()}>
        {linkCopy === 'copied' ? (
          <>
            <Glyph name="check" size={14} /> {labels.linkCopied}
          </>
        ) : (
          labels.copyLink
        )}
      </Button>
      {linkCopy === 'failed' ? (
        <>
          <input
            className="ac-trade-box__url"
            type="text"
            readOnly
            value={url}
            aria-label={labels.copyLink}
          />
          <p className="ac-trade-box__line" role="status">
            {labels.copyFailed}
          </p>
        </>
      ) : null}
    </>
  );

  const notice =
    message === null ? null : (
      <Notice open onClose={() => setMessage(null)} closeLabel={props.ui.dismiss}>
        {message.text}
        {message.link === null ? null : (
          <>
            {message.text === '' ? null : ' '}
            <TextLink href={message.link.href}>{message.link.label}</TextLink>
          </>
        )}
      </Notice>
    );

  const worldOf = (id: string) => props.worlds[id] ?? id;
  const dateOf = (value: string) => formatDate(value, locale);

  let body: ReactNode;
  if (viewer.kind === 'owner') {
    const stateLine =
      status === 'publicado'
        ? `${labels.published} · ${fill(labels.expires, { date: dateOf(props.expira) })}`
        : status === 'reservado'
          ? `${labels.states.reservado} · ${fill(labels.expires, { date: dateOf(props.expira) })}`
          : status === 'expirado'
            ? labels.states.expirado
            : labels.states.completado;
    body = (
      <>
        <p className="ac-trade-box__state" data-state={status}>
          <span className="ac-trade-box__dot" aria-hidden="true" />
          {stateLine}
        </p>
        {viewer.openDeals !== null ? (
          <p className="ac-trade-box__row">
            <span>{labels.openDeals}</span>
            <span>
              {formatInteger(viewer.openDeals, locale)}{' '}
              <TextLink href={props.hrefs.deals}>{labels.view}</TextLink>
            </span>
          </p>
        ) : null}
        <div className="ac-trade-box__buttons">
          {contactable ? (
            <Button variant="solid" href={props.hrefs.edit}>
              {labels.edit}
            </Button>
          ) : null}
          {status === 'publicado' ? (
            <Button disabled={busy} onClick={() => void setStatus('reservado')}>
              {labels.reserve}
            </Button>
          ) : null}
          {status === 'reservado' ? (
            <Button disabled={busy} onClick={() => void setStatus('publicado')}>
              {labels.release}
            </Button>
          ) : null}
          {contactable ? (
            <Button disabled={busy} onClick={() => void setStatus('completado')}>
              {labels.complete}
            </Button>
          ) : null}
          {status === 'expirado' ? (
            <Button variant="solid" disabled={busy} onClick={() => void setStatus('publicado')}>
              {labels.renew}
            </Button>
          ) : null}
          {copyButton}
        </div>
        {notice}
        {contactable ? (
          <button
            type="button"
            className="ac-trade-box__quiet"
            onClick={() => setWithdrawOpen(true)}
          >
            {labels.withdraw}
          </button>
        ) : null}
        <Dialog
          open={withdrawOpen}
          onClose={() => setWithdrawOpen(false)}
          title={labels.withdrawTitle}
          closeLabel={props.ui.close}
          alert
          actions={
            <>
              <Button {...initialFocus} onClick={() => setWithdrawOpen(false)}>
                {labels.cancel}
              </Button>
              <Button
                variant="solid"
                disabled={busy}
                onClick={() => {
                  setWithdrawOpen(false);
                  void setStatus('retirado');
                }}
              >
                {labels.withdraw}
              </Button>
            </>
          }
        >
          <p>{labels.withdrawText}</p>
        </Dialog>
      </>
    );
  } else if (deal !== null) {
    const channelName = (entry: TradeContact) =>
      entry.kind === 'other'
        ? (entry.label ?? '')
        : `${labels.channels[entry.kind]}${entry.label ? ` ${entry.label}` : ''}`;
    body = (
      <>
        <p className="ac-trade-box__deal">
          <Glyph name="check" size={14} />
          <span>
            <strong>{fill(labels.dealOpen, { name: props.sellerName })}</strong>
            <br />
            <span className="ac-trade-box__muted">{dateOf(deal.createdAt)}</span>
          </span>
        </p>
        {deal.contacts.length > 0 ? (
          <ul className="ac-trade-box__contacts">
            {deal.contacts.map((entry, index) => (
              <li key={`${entry.kind}-${entry.value}`} className="ac-trade-box__contact">
                <span>
                  <span className="ac-trade-box__muted">{channelName(entry)}</span>
                  <br />
                  <strong>{entry.value}</strong>
                </span>
                <button
                  type="button"
                  className="ac-trade-box__copy"
                  onClick={() => void copyContact(index, entry.value)}
                >
                  {copiedContact === index ? labels.copied : labels.copy}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="ac-trade-box__buttons">
          <Button variant="solid" href={props.hrefs.deals}>
            {labels.viewDeal}
          </Button>
        </div>
      </>
    );
  } else {
    body = (
      <>
        {buyerCharacter !== null ? (
          <p className="ac-trade-box__muted">
            {labels.buyingAs} <strong>{buyerCharacter.playerName}</strong> ·{' '}
            {worldOf(buyerCharacter.worldKey)}
          </p>
        ) : null}
        {noCharacterHere && contactable ? (
          <p className="ac-trade-box__note">
            {fill(labels.noCharacter, { world: props.worldName ?? props.world })}{' '}
            <TextLink href={props.hrefs.characters}>{labels.addCharacter}</TextLink>
          </p>
        ) : null}
        <div className="ac-trade-box__buttons">
          {contactable ? (
            <Button
              variant="solid"
              disabled={busy || viewer.kind === 'loading' || noCharacterHere}
              onClick={() => void contact()}
            >
              {props.contact.contact}
            </Button>
          ) : null}
          {copyButton}
        </div>
        {notice}
        <RealMoneyConsent
          open={consentOpen}
          onAccept={() => void accept()}
          onClose={() => setConsentOpen(false)}
          labels={props.contact.consent}
          ui={props.ui}
          busy={busy}
          error={consentError}
          onErrorClose={() => setConsentError(null)}
        />
      </>
    );
  }

  return (
    <div ref={root} className="ac-trade-box__actions">
      {body}
    </div>
  );
}
