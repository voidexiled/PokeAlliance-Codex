import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';

import type { Locale } from '@/i18n/config';
import { fill } from '@/i18n/messages/types';
import { formatDate } from '@/lib/format/dates';
import { formatInteger } from '@/lib/format/numbers';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { mapSupabaseError, type SupabaseFailure } from '@/lib/supabase/errors';
import {
  cancelTransaction,
  confirmTransaction,
  disputeTransaction,
  listMyTransactions,
  submitReview,
  transactionContacts,
  updateReview,
  type TradeContact,
  type TradeTransaction,
} from '@/lib/supabase/trade';
import {
  REPORTE_DETALLE_MAX,
  RESENA_EDICION_DIAS,
  RESENAS_PAR_DIA,
  reviewEditable,
  reviewWindowOpen,
  transactionLapsed,
} from '@/lib/trade/limits';
import { listingTitle, type ListingTitle, type ListingTitleInput } from '@/lib/trade/title';
import type { TipoActivo } from '@/lib/trade/types';

import { DataTable, type DataTableColumn, type DataTableRow } from '@/components/content/DataTable';
import { EmptyState } from '@/components/content/EmptyState';
import { Notice } from '@/components/content/Notice';
import { Button } from '@/components/controls/Button';
import { Dialog, initialFocus } from '@/components/controls/Dialog';
import { Textarea } from '@/components/controls/Textarea';
import { TextLink } from '@/components/controls/TextLink';
import { ToggleGroup } from '@/components/controls/ToggleGroup';

import { formatOperationNumber } from './ReportDialog';
import { ReviewForm, pairCapText, type ReviewFormMessages, type ReviewValue } from './ReviewForm';

// «Mis operaciones» (spec 9.10 with 9.15.4; template H): the island of
// `/{l}/comercio/operaciones/`, which src/integrations/comercio-fases.ts injects only with
// COMERCIO_PUBLICO (9.3). The frame is prerendered; the account's deals arrive here, from
// Supabase, once the session is known.
//
// - `ToggleGroup` «Compras» / «Ventas» and one `DataTable`: «Operación» (the deal number,
//   `OP-000123`, 9.15.4), «Anuncio», «Contraparte», «Estado», «Fecha», «Contacto» and
//   «Acciones».
// - «Contacto»: the values of the other party's visible channels, revealed by
//   `trade_transaction_contacts` to the two parties of the deal alone (9.10, RLS of 9.12.2), each
//   one as text with «Copiar». They are text: never a link, never HTML.
// - «Acciones»: only the buttons valid for the state and the role (`operationActions`), and on a
//   confirmed deal the review of 9.15.4 in both directions — «Reseñar» during `RESENA_DIAS`,
//   «Editar reseña» for `RESENA_EDICION_DIAS` after it, or the pair cap line.
// - «Operación completada» and «Cancelar» cannot be undone, so they ask first (alert dialogs with
//   the focus on «Volver»); «No se completó» asks for an optional detail and sends the deal to
//   moderation (9.10). A sent dispute and a saved review leave a notice.
// - «Anuncio» is the listing title (9.4) linking to its detail. The in-game panel of the listing
//   needs the registries in the browser (the catalogue of TradeListRoot), which this island does
//   not carry (13.6): the title of a Pokémon or an item reads its name from the search index,
//   `/{l}/buscar/indice.json`, the file the palette downloads, loaded only when a row needs it.
//
// The server decides everything (9.12.3): who may confirm, cancel, dispute or review, the
// windows, the pair cap, the requirements and the real-money consent of 9.15.2, and it records
// the evidence of 9.15.3 (src/lib/supabase/trade.ts sends the device id). What this island hides
// is only what would fail; a failure shows `mapSupabaseError` (12.14.1) inside the dialog, which
// stays open (10.4), except a second review of the deal (23505) and a review whose window closed
// while the dialog was open, which say so. Until the session is known the region paints nothing
// and carries `aria-busy`.

export type OperationRole = 'buyer' | 'seller';

/** The states of a deal (9.10). `caducada` is also derived with the clock (`effectiveStatus`). */
export type OperationStatus =
  | 'contacto'
  | 'confirmada_vendedor'
  | 'confirmada_comprador'
  | 'confirmada'
  | 'cancelada'
  | 'disputada'
  | 'caducada';

/** The buttons of «Acciones», in their order. */
export type OperationAction = 'confirm' | 'dispute' | 'cancel' | 'review' | 'editReview';

/** What a row needs of its listing to write its title (9.4) and link it. */
export interface OperationListing {
  id: string;
  tipo: TipoActivo;
  /** Registry id of the Pokémon of a Pokémon listing. */
  pokemon: string | null;
  /** The traded item: its registry id when it matched one, and the declared name. */
  item: { item: string | null; nombre: string } | null;
  /** Whole units of a Diamonds or Pokédólares listing. */
  cantidad: number | null;
  /** False when the listing has no public detail any more (withdrawn, 9.4). */
  detail: boolean;
}

/** A deal of the account, as the table reads it. */
export interface OperationRow {
  id: string;
  /** The sequence number of 9.15.4. */
  number: number;
  role: OperationRole;
  status: OperationStatus;
  listing: OperationListing;
  /** Handle of the other party; `null` when that account no longer exists. */
  counterpart: string | null;
  createdAt: string;
  /** The last change of state, for the expiry of 9.10. */
  changedAt: string;
  /** When the second confirmation arrived; `null` before `confirmada`. */
  confirmedAt: string | null;
  /** The account's own review of this deal. */
  review: { id: string; score: number; comment: string | null; createdAt: string } | null;
  /** False when the pair already reached `RESENAS_PAR_DIA` reviewable deals in 24 h (9.15.4). */
  reviewable: boolean;
}

/** «Detalle» of «No se completó»: it goes to moderation like a report, with the same limit. */
const DISPUTE_DETAIL_MAX = REPORTE_DETALLE_MAX;

const DAY_MS = 86_400_000;

const OPEN_STATES: ReadonlySet<OperationStatus> = new Set([
  'contacto',
  'confirmada_vendedor',
  'confirmada_comprador',
]);

/**
 * `now`, or `moment` when the browser's clock is behind the server's: a deal confirmed a second
 * ago is never «in the future», so its windows open at once.
 */
function notBefore(now: Date, moment: string): number {
  return Math.max(now.getTime(), Date.parse(moment));
}

/**
 * The state the account sees (9.10): an open deal with no change for `OPERACION_CADUCIDAD_DIAS`
 * is `caducada`, computed with the clock and no scheduled job, as the server computes it.
 */
export function effectiveStatus(
  row: Pick<OperationRow, 'status' | 'changedAt'>,
  now: Date,
): OperationStatus {
  if (OPEN_STATES.has(row.status) && transactionLapsed(row.changedAt, now)) return 'caducada';
  return row.status;
}

/** The party that already confirmed, in a half-confirmed deal. */
function confirmedBy(status: OperationStatus): OperationRole | null {
  if (status === 'confirmada_vendedor') return 'seller';
  if (status === 'confirmada_comprador') return 'buyer';
  return null;
}

/** 9.15.4: the review window of a confirmed deal is open (`RESENA_DIAS`). */
function canStillReview(confirmedAt: string | null, now: Date): boolean {
  return confirmedAt !== null && reviewWindowOpen(confirmedAt, notBefore(now, confirmedAt));
}

/** 9.10: the author edits a review for `RESENA_EDICION_DIAS` after writing it. */
function canStillEdit(createdAt: string, now: Date): boolean {
  return reviewEditable(createdAt, notBefore(now, createdAt));
}

/**
 * The buttons of «Acciones» for a deal, its state and the account's role (9.10, 9.15.4):
 *
 * - open (`contacto`): «Operación completada» and «Cancelar», for either party;
 * - half confirmed: the party that confirmed may only cancel; the other one confirms, says
 *   «No se completó» (the deal goes to moderation) or cancels;
 * - `confirmada`: «Reseñar» while the window is open, the pair cap allows it and the account has
 *   not reviewed; «Editar reseña» during the edit window;
 * - `cancelada`, `disputada`, `caducada`: nothing.
 */
export function operationActions(row: OperationRow, now: Date): OperationAction[] {
  const status = effectiveStatus(row, now);
  if (status === 'contacto') return ['confirm', 'cancel'];
  const confirmer = confirmedBy(status);
  if (confirmer !== null) {
    return confirmer === row.role ? ['cancel'] : ['confirm', 'dispute', 'cancel'];
  }
  if (status !== 'confirmada') return [];
  if (row.review !== null) return canStillEdit(row.review.createdAt, now) ? ['editReview'] : [];
  return row.reviewable && canStillReview(row.confirmedAt, now) ? ['review'] : [];
}

/** The last moment the author may edit a review written at `createdAt` (9.10). */
export function reviewEditDeadline(createdAt: string): string {
  return new Date(Date.parse(createdAt) + RESENA_EDICION_DIAS * DAY_MS).toISOString();
}

/**
 * Whether the window of a review action closed (9.15.4, 9.10): a new review past `RESENA_DIAS`
 * after the confirmation, an edit past `RESENA_EDICION_DIAS` after writing it.
 */
export function reviewWindowClosed(row: OperationRow, now: Date): boolean {
  return row.review === null
    ? !canStillReview(row.confirmedAt, now)
    : !canStillEdit(row.review.createdAt, now);
}

/** A confirmed deal whose review the pair cap took away (9.15.4), while the window lasts. */
export function pairCapped(row: OperationRow, now: Date): boolean {
  return (
    effectiveStatus(row, now) === 'confirmada' &&
    row.review === null &&
    !row.reviewable &&
    canStillReview(row.confirmedAt, now)
  );
}

/** Registry names of the listings of the table, by id; a missing id is an unknown name. */
export interface OperationNames {
  pokemon: ReadonlyMap<string, string>;
  item: ReadonlyMap<string, string>;
}

const NO_NAMES: OperationNames = { pokemon: new Map(), item: new Map() };

/**
 * The title of a deal's listing (9.4) with `listingTitle`, which reads only the Pokémon id, the
 * item and the amount of the listing it is given.
 */
export function operationTitle(
  listing: OperationListing,
  names: OperationNames,
  locale: Locale,
): ListingTitle {
  const input = {
    tipo: listing.tipo,
    pokemon: listing.pokemon === null ? undefined : { pokemon: listing.pokemon },
    item: listing.item === null ? undefined : { ...listing.item, cantidad: 1 },
    cantidad: listing.cantidad ?? undefined,
  } as ListingTitleInput;
  return listingTitle(input, locale, {
    pokemon: (id) => names.pokemon.get(id),
    item: (id) => names.item.get(id),
  });
}

/** The page of a listing and of an account (9.3). */
function listingHref(locale: Locale, id: string): string {
  return `/${locale}/comercio/anuncio/${encodeURIComponent(id)}/`;
}

function profileHref(locale: Locale, handle: string): string {
  return `/${locale}/comercio/vendedor/${encodeURIComponent(handle)}/`;
}

// ------------------------------------------------------------------------------ messages

export interface OperationsMessages {
  /** Name of the «Compras» / «Ventas» group. */
  roles: string;
  purchases: string;
  sales: string;
  /** Hidden captions of the two tables: «Mis compras», «Mis ventas». */
  captionPurchases: string;
  captionSales: string;
  columns: {
    number: string;
    listing: string;
    counterpart: string;
    status: string;
    date: string;
    contact: string;
    actions: string;
  };
  states: {
    contacto: string;
    confirmada_vendedor: string;
    confirmada_comprador: string;
    confirmada: string;
    cancelada: string;
    disputada: string;
    caducada: string;
  };
  /** The empty tables: «Aún no tienes compras.», «Aún no tienes ventas.». */
  emptyPurchases: string;
  emptySales: string;
  /** Without a session: «Entra en tu cuenta para ver tus operaciones.» and the link. */
  signIn: string;
  account: string;
  /** The author of a deal whose account no longer exists (9.9): «Cuenta eliminada». */
  deletedAccount: string;
  /** «Copiar», its accessible name «Copiar {channel}», and the two notices. */
  copy: string;
  copyLabel: string;
  copied: string;
  copyFailed: string;
  actions: {
    confirm: string;
    dispute: string;
    cancel: string;
    review: string;
    editReview: string;
  };
  /** «Tu reseña: {score} de 5». */
  yourReview: string;
  confirmTitle: string;
  confirmText: string;
  cancelTitle: string;
  cancelText: string;
  cancelConfirm: string;
  disputeTitle: string;
  disputeText: string;
  disputeDetail: string;
  disputeHelp: string;
  disputeConfirm: string;
  /** The notice once the deal went to moderation. */
  disputed: string;
  /** The safe button of the three dialogs: «Volver». */
  back: string;
  /** «Enviando…». */
  sending: string;
  /** «Reintentar». */
  retry: string;
}

/** `trade.review`: the texts of the dialog and the answers the island says after it. */
export interface OperationReviewMessages extends ReviewFormMessages {
  /** «Reseña publicada.», «Reseña guardada.». */
  sent: string;
  saved: string;
  /** The window closed while the dialog was open; a second review of the same deal (23505). */
  closed: string;
  duplicate: string;
}

/** The public labels of 9.9 by kind, `trade.channels` with Google (9.15.1). */
export interface ContactLabels {
  correo: string;
  /** «Teléfono {code}». */
  telefono: string;
  discord: string;
  twitch: string;
  google: string;
}

/** The label a contact value is shown with. */
export function contactLabel(contact: TradeContact, labels: ContactLabels): string {
  switch (contact.kind) {
    case 'email':
      return labels.correo;
    case 'phone':
      return fill(labels.telefono, { code: contact.label ?? '' }).trim();
    case 'discord':
      return labels.discord;
    case 'twitch':
      return labels.twitch;
    case 'google':
      return labels.google;
    default:
      return contact.label ?? '';
  }
}

function statusLabel(status: OperationStatus, states: OperationsMessages['states']): string {
  switch (status) {
    case 'contacto':
      return states.contacto;
    case 'confirmada_vendedor':
      return states.confirmada_vendedor;
    case 'confirmada_comprador':
      return states.confirmada_comprador;
    case 'confirmada':
      return states.confirmada;
    case 'cancelada':
      return states.cancelada;
    case 'disputada':
      return states.disputada;
    case 'caducada':
      return states.caducada;
  }
}

function actionLabel(action: OperationAction, actions: OperationsMessages['actions']): string {
  switch (action) {
    case 'confirm':
      return actions.confirm;
    case 'dispute':
      return actions.dispute;
    case 'cancel':
      return actions.cancel;
    case 'review':
      return actions.review;
    case 'editReview':
      return actions.editReview;
  }
}

// ------------------------------------------------------------------------------ data

/** The row of the table from a row of src/lib/supabase/trade.ts. */
export function toOperationRow(row: TradeTransaction): OperationRow {
  return {
    id: row.id,
    number: row.number,
    role: row.role,
    status: row.status,
    listing: row.listing,
    counterpart: row.counterpart,
    createdAt: row.createdAt,
    changedAt: row.changedAt,
    confirmedAt: row.confirmedAt,
    review: row.review,
    reviewable: row.reviewable,
  };
}

/** The names the titles need, from the search index; only when a row names a Pokémon or item. */
async function loadNames(locale: Locale): Promise<OperationNames> {
  const { decodeSearchIndex, searchIndexUrl } = await import('@/components/search/config');
  const response = await fetch(searchIndexUrl(locale));
  if (!response.ok) throw new Error(`search index: ${response.status}`);
  const entries = decodeSearchIndex(await response.json());
  const pokemon = new Map<string, string>();
  const item = new Map<string, string>();
  for (const entry of entries) {
    if (entry.kind === 'pokemon') pokemon.set(entry.id, entry.name);
    else if (entry.kind === 'item') item.set(entry.id, entry.name);
  }
  return { pokemon, item };
}

function needsNames(rows: readonly OperationRow[]): boolean {
  return rows.some(
    (row) =>
      (row.listing.tipo === 'pokemon' && row.listing.pokemon !== null) ||
      (row.listing.tipo === 'items' && row.listing.item?.item != null),
  );
}

// ------------------------------------------------------------------------------ component

interface UiLabels {
  close: string;
  dismiss: string;
}

export interface OperationsPanelProps {
  locale: Locale;
  messages: OperationsMessages;
  review: OperationReviewMessages;
  channels: ContactLabels;
  ui: UiLabels;
  /** `/{l}/cuenta/`, or `null` when the build has no account page. */
  accountHref: string | null;
}

type Pending =
  | { kind: 'confirm' | 'cancel' | 'dispute'; row: OperationRow }
  | { kind: 'review'; row: OperationRow; title: string };

function ErrorNotice({
  text,
  onClose,
  onRetry,
  retryLabel,
  closeLabel,
}: {
  text: string;
  onClose: () => void;
  onRetry: () => void;
  retryLabel: string;
  closeLabel: string;
}) {
  return (
    <Notice open onClose={onClose} closeLabel={closeLabel}>
      {text} <Button onClick={onRetry}>{retryLabel}</Button>
    </Notice>
  );
}

export function OperationsPanel({
  locale,
  messages,
  review,
  channels,
  ui,
  accountHref,
}: OperationsPanelProps) {
  // `undefined` while supabase-js loads (client.ts loads it on demand).
  const [client, setClient] = useState<SupabaseClient | null | undefined>(undefined);
  // `undefined` while the session is unknown, `null` without one.
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [rows, setRows] = useState<OperationRow[] | undefined>(undefined);
  const [now, setNow] = useState<Date | null>(null);
  const [names, setNames] = useState<OperationNames>(NO_NAMES);
  const [contacts, setContacts] = useState<Record<string, TradeContact[]>>({});
  const [role, setRole] = useState<OperationRole>('buyer');
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [pendingOpen, setPendingOpen] = useState(false);
  const [pendingError, setPendingError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [disputeDetail, setDisputeDetail] = useState('');

  useEffect(() => {
    if (client !== undefined) return undefined;
    let active = true;
    getSupabaseBrowserClient().then(
      (loaded) => {
        if (active) setClient(loaded);
      },
      (error: unknown) => {
        if (active) setLoadError(error);
      },
    );
    return () => {
      active = false;
    };
  }, [client, attempt]);

  useEffect(() => {
    if (client === undefined) return undefined;
    if (client === null) {
      setSession(null);
      return undefined;
    }
    let active = true;
    client.auth.getSession().then(
      ({ data, error }) => {
        if (!active) return;
        if (error) setLoadError(error);
        else setSession(data.session);
      },
      (error: unknown) => {
        if (active) setLoadError(error);
      },
    );
    const { data } = client.auth.onAuthStateChange((_event, next) => {
      if (active) setSession(next);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [client, attempt]);

  const userId = session?.user.id ?? null;

  // The deals of the account; a reload after every action keeps the table the server's.
  useEffect(() => {
    if (!client || userId === null) {
      setRows(undefined);
      return undefined;
    }
    let active = true;
    setLoadError(null);
    listMyTransactions(client).then(
      (result) => {
        if (!active) return;
        if (result.error || result.data === null) {
          setLoadError(result.error ?? { code: null, network: false });
          return;
        }
        setNow(new Date());
        setRows(result.data.map(toOperationRow));
      },
      (error: unknown) => {
        if (active) setLoadError(error);
      },
    );
    return () => {
      active = false;
    };
  }, [client, userId, attempt, refresh]);

  // The names of the titles, once, when a row needs them. Without the index the titles of those
  // rows are «—» and the rest of the table works.
  const wantNames = rows !== undefined && needsNames(rows);
  useEffect(() => {
    if (!wantNames) return undefined;
    let active = true;
    loadNames(locale).then(
      (loaded) => {
        if (active) setNames(loaded);
      },
      () => undefined,
    );
    return () => {
      active = false;
    };
  }, [wantNames, locale]);

  // The revealed contact values of each deal the other party can be reached for.
  useEffect(() => {
    if (!client || rows === undefined || now === null) return undefined;
    let active = true;
    const reachable = rows.filter((row) => {
      const status = effectiveStatus(row, now);
      return status !== 'cancelada' && status !== 'caducada';
    });
    Promise.all(
      reachable.map(async (row) => {
        const result = await transactionContacts(client, row.id);
        return [row.id, result.data ?? []] as const;
      }),
    ).then(
      (entries) => {
        if (active) setContacts(Object.fromEntries(entries));
      },
      () => undefined,
    );
    return () => {
      active = false;
    };
  }, [client, rows, now]);

  const titles = useMemo(() => {
    const map = new Map<string, ListingTitle>();
    for (const row of rows ?? []) map.set(row.id, operationTitle(row.listing, names, locale));
    return map;
  }, [rows, names, locale]);

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice(messages.copied);
    } catch {
      setNotice(messages.copyFailed);
    }
  }

  function open(next: Pending) {
    setPending(next);
    setPendingError(null);
    setDisputeDetail('');
    setPendingOpen(true);
  }

  function failureText(error: SupabaseFailure | unknown): string {
    return mapSupabaseError(error, locale);
  }

  function closePending() {
    setPendingOpen(false);
    setPending(null);
  }

  /** Runs the action of the open dialog; closes it, says `done` and reloads on success. */
  async function run(
    action: (supabase: SupabaseClient) => Promise<{ error: SupabaseFailure | null }>,
    done: string | null = null,
  ) {
    if (working || !client) return;
    setWorking(true);
    setPendingError(null);
    try {
      const { error } = await action(client);
      if (error) {
        setPendingError(failureText(error));
        return;
      }
      setPendingOpen(false);
      if (done !== null) setNotice(done);
      setRefresh((value) => value + 1);
    } catch (caught) {
      setPendingError(failureText(caught));
    } finally {
      setWorking(false);
    }
  }

  async function sendReview(value: ReviewValue): Promise<string | null> {
    if (!client || pending?.kind !== 'review') return null;
    const target = pending.row;
    try {
      const { error } =
        target.review === null
          ? await submitReview(client, target.id, value.score, value.comment)
          : await updateReview(client, target.review.id, value.score, value.comment);
      if (error) {
        // 23505: this account already reviewed this deal.
        if (error.code === '23505') return review.duplicate;
        if (reviewWindowClosed(target, new Date())) return review.closed;
        return failureText(error);
      }
      setPendingOpen(false);
      setNotice(target.review === null ? review.sent : review.saved);
      setRefresh((current) => current + 1);
      return null;
    } catch (caught) {
      return failureText(caught);
    }
  }

  const signedIn = Boolean(client) && Boolean(session);
  const busy =
    (client === undefined || session === undefined || (signedIn && rows === undefined)) &&
    loadError === null;

  const columns: DataTableColumn[] = [
    { key: 'number', label: messages.columns.number, align: 'left', nowrap: true, numeric: true },
    { key: 'listing', label: messages.columns.listing, align: 'left' },
    { key: 'counterpart', label: messages.columns.counterpart, align: 'left' },
    { key: 'status', label: messages.columns.status, align: 'left' },
    { key: 'date', label: messages.columns.date, align: 'left', nowrap: true, text: 'ui' },
    { key: 'contact', label: messages.columns.contact, align: 'left' },
    { key: 'actions', label: messages.columns.actions, align: 'left' },
  ];

  function listingCell(row: OperationRow): ReactNode {
    const title = titles.get(row.id) ?? operationTitle(row.listing, NO_NAMES, locale);
    const text =
      title.accesible === title.texto ? (
        title.texto
      ) : (
        <>
          <span aria-hidden="true">{title.texto}</span>
          <span className="sr-only">{title.accesible}</span>
        </>
      );
    return row.listing.detail ? (
      <TextLink href={listingHref(locale, row.listing.id)}>{text}</TextLink>
    ) : (
      text
    );
  }

  function contactCell(row: OperationRow): ReactNode {
    const list = contacts[row.id];
    if (list === undefined || list.length === 0) return null;
    return (
      <ul className="ac-trade-ops__contacts">
        {list.map((contact, index) => {
          const label = contactLabel(contact, channels);
          return (
            <li key={index} className="ac-trade-ops__contact">
              <span className="ac-trade-ops__contact-text">
                {label ? `${label}: ` : null}
                <span className="ac-trade-ops__contact-value" translate="no">
                  {contact.value}
                </span>
              </span>
              <Button
                ariaLabel={fill(messages.copyLabel, { channel: label || contact.value })}
                onClick={() => void copy(contact.value)}
              >
                {messages.copy}
              </Button>
            </li>
          );
        })}
      </ul>
    );
  }

  function actionsCell(row: OperationRow, current: Date): ReactNode {
    const actions = operationActions(row, current);
    const title = titles.get(row.id)?.texto ?? '';
    const lines: ReactNode[] = [];
    if (row.review !== null) {
      lines.push(
        <p key="review" className="ac-trade-ops__line">
          {fill(messages.yourReview, { score: formatInteger(row.review.score, locale) })}
        </p>,
      );
    }
    if (pairCapped(row, current)) {
      lines.push(
        <p key="cap" className="ac-trade-ops__line">
          {pairCapText(review, RESENAS_PAR_DIA, locale)}
        </p>,
      );
    }
    if (actions.length === 0 && lines.length === 0) return null;
    return (
      <div className="ac-trade-ops__cell">
        {lines}
        {actions.length > 0 ? (
          <div className="ac-trade-ops__actions">
            {actions.map((action) => (
              <Button
                key={action}
                onClick={() =>
                  open(
                    action === 'review' || action === 'editReview'
                      ? { kind: 'review', row, title }
                      : { kind: action, row },
                  )
                }
              >
                {actionLabel(action, messages.actions)}
              </Button>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  const shown = rows?.filter((row) => row.role === role) ?? [];
  const tableRows: DataTableRow[] =
    now === null
      ? []
      : shown.map((row) => ({
          key: row.id,
          cells: {
            number: formatOperationNumber(row.number),
            listing: listingCell(row),
            counterpart:
              row.counterpart === null ? (
                messages.deletedAccount
              ) : (
                <TextLink href={profileHref(locale, row.counterpart)}>{row.counterpart}</TextLink>
              ),
            status: statusLabel(effectiveStatus(row, now), messages.states),
            date: formatDate(row.createdAt, locale),
            contact: contactCell(row),
            actions: actionsCell(row, now),
          },
        }));

  const number = pending ? formatOperationNumber(pending.row.number) : '';
  const back = (
    <Button {...initialFocus} onClick={() => setPendingOpen(false)}>
      {messages.back}
    </Button>
  );
  const pendingNotice =
    pendingError !== null ? (
      <Notice open onClose={() => setPendingError(null)} closeLabel={ui.dismiss}>
        {pendingError}
      </Notice>
    ) : null;

  return (
    <div className="ac-trade-ops" aria-busy={busy ? 'true' : undefined}>
      {loadError !== null ? (
        <ErrorNotice
          text={failureText(loadError)}
          onClose={() => setLoadError(null)}
          onRetry={() => {
            setLoadError(null);
            setAttempt((value) => value + 1);
          }}
          retryLabel={messages.retry}
          closeLabel={ui.dismiss}
        />
      ) : null}
      {client !== undefined && session === null ? (
        <EmptyState
          action={
            accountHref === null ? undefined : (
              <Button href={accountHref}>{messages.account}</Button>
            )
          }
        >
          {messages.signIn}
        </EmptyState>
      ) : null}
      {signedIn ? (
        <>
          <ToggleGroup
            label={messages.roles}
            options={[
              { value: 'buyer', label: messages.purchases },
              { value: 'seller', label: messages.sales },
            ]}
            value={role}
            onChange={(value) => setRole(value === 'seller' ? 'seller' : 'buyer')}
          />
          {notice !== null ? (
            <Notice open onClose={() => setNotice(null)} closeLabel={ui.dismiss}>
              {notice}
            </Notice>
          ) : null}
          {rows === undefined ? null : shown.length === 0 ? (
            <EmptyState>
              {role === 'buyer' ? messages.emptyPurchases : messages.emptySales}
            </EmptyState>
          ) : (
            <DataTable
              caption={role === 'buyer' ? messages.captionPurchases : messages.captionSales}
              columns={columns}
              rows={tableRows}
              locale={locale}
              scroll
              wrap
              className="ac-trade-ops__table"
            />
          )}
        </>
      ) : null}

      {pending !== null && pending.kind === 'confirm' ? (
        <Dialog
          open={pendingOpen}
          onClose={closePending}
          title={fill(messages.confirmTitle, { number })}
          closeLabel={ui.close}
          alert
          actions={
            <>
              {back}
              <Button
                variant="solid"
                disabled={working}
                onClick={() => void run((supabase) => confirmTransaction(supabase, pending.row.id))}
              >
                {working ? messages.sending : messages.actions.confirm}
              </Button>
            </>
          }
        >
          <p>{messages.confirmText}</p>
          {pendingNotice}
        </Dialog>
      ) : null}
      {pending !== null && pending.kind === 'cancel' ? (
        <Dialog
          open={pendingOpen}
          onClose={closePending}
          title={fill(messages.cancelTitle, { number })}
          closeLabel={ui.close}
          alert
          actions={
            <>
              {back}
              <Button
                variant="solid"
                disabled={working}
                onClick={() => void run((supabase) => cancelTransaction(supabase, pending.row.id))}
              >
                {working ? messages.sending : messages.cancelConfirm}
              </Button>
            </>
          }
        >
          <p>{messages.cancelText}</p>
          {pendingNotice}
        </Dialog>
      ) : null}
      {pending !== null && pending.kind === 'dispute' ? (
        <Dialog
          open={pendingOpen}
          onClose={closePending}
          title={fill(messages.disputeTitle, { number })}
          closeLabel={ui.close}
          actions={
            <>
              {back}
              <Button
                variant="solid"
                disabled={working}
                onClick={() => {
                  const detail = disputeDetail.trim();
                  void run(
                    (supabase) =>
                      disputeTransaction(supabase, pending.row.id, detail === '' ? null : detail),
                    messages.disputed,
                  );
                }}
              >
                {working ? messages.sending : messages.disputeConfirm}
              </Button>
            </>
          }
        >
          <p>{messages.disputeText}</p>
          <Textarea
            label={messages.disputeDetail}
            helper={fill(messages.disputeHelp, { max: formatInteger(DISPUTE_DETAIL_MAX, locale) })}
            value={disputeDetail}
            onChange={setDisputeDetail}
            rows={4}
            textareaProps={{ maxLength: DISPUTE_DETAIL_MAX }}
          />
          {pendingNotice}
        </Dialog>
      ) : null}
      {pending !== null && pending.kind === 'review' ? (
        <ReviewForm
          open={pendingOpen}
          onClose={closePending}
          locale={locale}
          messages={review}
          closeLabel={ui.close}
          dismissLabel={ui.dismiss}
          subject={pending.row.role === 'buyer' ? 'seller' : 'buyer'}
          name={pending.row.counterpart}
          number={number}
          listingTitle={pending.title}
          initial={
            pending.row.review === null
              ? null
              : { score: pending.row.review.score, comment: pending.row.review.comment }
          }
          editableUntil={
            pending.row.review === null ? null : reviewEditDeadline(pending.row.review.createdAt)
          }
          allowed={pending.row.review !== null || pending.row.reviewable}
          pairCap={RESENAS_PAR_DIA}
          onSubmit={sendReview}
        />
      ) : null}
    </div>
  );
}
