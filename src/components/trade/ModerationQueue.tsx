import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';

import type { Locale } from '@/i18n/config';
import { fill } from '@/i18n/messages/types';
import { formatDate } from '@/lib/format/dates';
import { formatInteger } from '@/lib/format/numbers';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { mapSupabaseError, type SupabaseFailure } from '@/lib/supabase/errors';
import {
  TRADE_MODERATION_ACTIONS,
  TRADE_MODERATION_TARGETS,
  isTradeModerator,
  listModerationFlags,
  listModerationReports,
  listPendingChannels,
  moderateTrade,
  verifyTradeChannel,
  type ModerationFlagRow,
  type ModerationReportRow,
  type PendingChannelRow,
  type TradeModerationInput,
} from '@/lib/supabase/trade';
import { REPORTE_DETALLE_MAX } from '@/lib/trade/limits';

import { DataTable, type DataTableColumn } from '@/components/content/DataTable';
import { EmptyState } from '@/components/content/EmptyState';
import { Notice } from '@/components/content/Notice';
import { Button } from '@/components/controls/Button';
import { Dialog } from '@/components/controls/Dialog';
import { RadioGroup } from '@/components/controls/RadioGroup';
import { Select } from '@/components/controls/Select';
import { TextLink } from '@/components/controls/TextLink';
import { Textarea } from '@/components/controls/Textarea';
import { ToggleGroup } from '@/components/controls/ToggleGroup';
import { PageTitle } from '@/components/layout/PageTitle';
import { Section } from '@/components/layout/Section';

import {
  formatOperationNumber,
  reportReasonLabel,
  type ReportMessages,
  type ReportReason,
  type ReportTargetType,
} from './ReportDialog';
import { characterCount } from './ReviewForm';

// The moderation queue of Comercio (spec 9.11 with 9.15.5; template H): the island of
// `/{l}/comercio/moderacion/`, a page rendered on demand that src/integrations/comercio-fases.ts
// injects only with COMERCIO_PUBLICO (9.3).
//
// Who sees it. The session lives in the browser (src/lib/supabase/client.ts), so the server
// that renders the page cannot tell a moderator: the page is the same frame for everyone and this
// island asks the database (`isTradeModerator`, a row in `trade_moderators`). Without a session or
// without that row it shows what the 404 shows (9.3: «404 si la cuenta no es moderadora») and
// reads nothing else. That is presentation only: every read and every action of this page is a
// security definer function or a table under RLS that refuses an account that is not a moderator
// (9.12.2, 9.12.3), so no moderation data can reach any other account.
//
// Sections, in order:
// 1. «Reportes»: `ToggleGroup` «Abiertos» / «Resueltos» and a `DataTable` with «Fecha»,
//    «Objetivo» (with its link), «Motivo», «Reportes» (the open ones on that target),
//    «Detalle» (with the deal number of a scam report, 9.15.5) and «Acciones». A disputed deal
//    (9.10) arrives here too, as a report on the deal («Operación OP-000123», no reason, the
//    detail its party wrote): a moderator settles it, «Dar por confirmada» or «Dar por
//    cancelada» (9.11), and it cannot be dismissed.
// 2. «Alertas»: the automatic flags of 9.15.5, each with its evidence in plain words — the
//    accounts, the dates, the deals and the matching device — and «Descartar», «Ocultar reseña»
//    (the kinds that involve reviews), «Advertir» and «Suspender en Comercio».
// 3. «Canales pendientes»: the manual verifications of 9.9, «Aprobar» or «Rechazar».
//
// Every moderation action asks for a «Motivo» (required, at most 1000 characters) in a `Dialog`
// and writes one row of `trade_moderation_events`, which only takes inserts (9.11). A suspension
// asks for its length: 7 days, 30 days or indefinite, which is the Comercio ban of 9.15.5 (the
// account keeps its identifiers taken; the wiki and Guild keep working). A failure stays inside
// the dialog (10.4) with `mapSupabaseError` (12.14.1).

/** The four kinds of automatic alert of 9.15.5, in its order. */
export type FlagKind =
  'dispositivo_contrapartes' | 'dispositivo_cuentas' | 'resenas_cuentas_nuevas' | 'tope_resenas';

/** The moderation actions of 9.11 and 9.15.5; `confirm_deal` and `cancel_deal` settle a dispute. */
export type ModerationAction =
  | 'dismiss'
  | 'withdraw_listing'
  | 'hide_review'
  | 'restore_review'
  | 'confirm_deal'
  | 'cancel_deal'
  | 'warn'
  | 'suspend'
  | 'lift_suspension';

/** The actions that name an account rather than the target itself. */
const ACCOUNT_ACTIONS: ReadonlySet<ModerationAction> = new Set([
  'warn',
  'suspend',
  'lift_suspension',
]);

/** What a moderator acts on: what an account reports, or a disputed deal (9.10). */
export type ModerationTargetType = ReportTargetType | 'transaction';

/**
 * Whether src/lib/supabase/trade.ts sends this action and this target. The dispute actions and
 * the `transaction` target are this queue's (9.11: a moderator settles a disputed deal); the data
 * module lists what the database takes and checks every call against those lists, so an action
 * or a target it does not list never leaves the browser.
 */
function sendableAction(action: ModerationAction): action is TradeModerationInput['action'] {
  return (TRADE_MODERATION_ACTIONS as readonly string[]).includes(action);
}

function sendableTarget(
  type: ModerationTargetType | 'user' | 'flag',
): type is TradeModerationInput['targetType'] {
  return (
    type === 'user' ||
    type === 'flag' ||
    (TRADE_MODERATION_TARGETS as readonly string[]).includes(type)
  );
}

/** «Suspender en Comercio»: 7 days, 30 days or indefinite (9.15.5). */
export const SUSPENSION_LENGTHS = ['7', '30', 'indefinida'] as const;
export type SuspensionLength = (typeof SUSPENSION_LENGTHS)[number];

/** An account named by a report or an alert. */
export interface ModerationAccount {
  id: string;
  /** Its handle; `null` when the account has no profile any more. */
  handle: string | null;
  /** The end of its Comercio suspension: `null` without one, `'infinity'` for a ban. */
  suspendedUntil: string | null;
}

/** A report as the queue shows it. */
export interface ModerationReport {
  id: string;
  createdAt: string;
  targetType: ModerationTargetType;
  targetId: string;
  /**
   * The seller of a listing or the reported seller; the author of a reported review; in a
   * disputed deal, the party that gave it as completed.
   */
  owner: ModerationAccount | null;
  /** The seller whose profile shows a reported review. */
  reviewedHandle: string | null;
  /** A reported review is hidden. */
  hidden: boolean;
  /** A reported listing still has a public detail. */
  listingPublic: boolean;
  /** The reason of a report; `null` for a disputed deal, which reaches moderation on its own. */
  reason: ReportReason | null;
  detail: string | null;
  /** The deal number of a scam report (9.15.5) or of a disputed deal. */
  operation: number | null;
  /** Open reports on the same target. */
  openCount: number;
  status: 'open' | 'resolved' | 'dismissed';
}

/** An automatic alert as the queue shows it (9.15.5). */
export interface ModerationFlag {
  id: string;
  kind: FlagKind;
  createdAt: string;
  /** The accounts it names; in `resenas_cuentas_nuevas` the first one received the reviews. */
  accounts: ModerationAccount[];
  /** The matching device (`device_id`) of the two device kinds. */
  device: string | null;
  /** The deals behind it, by number. */
  operations: number[];
  /** The first and the last action it counts. */
  from: string | null;
  to: string | null;
  /** The reviews it counts (`resenas_cuentas_nuevas`) or the days in a row (`tope_resenas`). */
  count: number | null;
}

/** A channel waiting for a moderator (9.9, D-B5). */
export interface PendingChannel {
  id: string;
  createdAt: string;
  handle: string | null;
  platform: string;
  /** The user on that platform. */
  value: string;
  /** The code the account had to put on its public profile, when the server gives it. */
  code: string | null;
}

/** What a moderation action is applied to. */
export type ModerationTarget =
  { type: 'report'; report: ModerationReport } | { type: 'flag'; flag: ModerationFlag };

/** The alert kinds whose evidence involves reviews, which «Ocultar reseña» hides. */
const REVIEW_FLAGS: ReadonlySet<FlagKind> = new Set([
  'dispositivo_contrapartes',
  'resenas_cuentas_nuevas',
  'tope_resenas',
]);

function suspended(account: ModerationAccount | null, now: Date): boolean {
  if (account === null || account.suspendedUntil === null) return false;
  if (account.suspendedUntil === 'infinity') return true;
  const until = Date.parse(account.suspendedUntil);
  return Number.isNaN(until) || until > now.getTime();
}

/**
 * The accounts an action may name: every one to warn, the ones not suspended to suspend, the
 * suspended ones to lift; an action on the target itself names none.
 */
export function accountsFor(
  action: ModerationAction,
  accounts: readonly ModerationAccount[],
  now: Date,
): ModerationAccount[] {
  if (action === 'warn') return [...accounts];
  if (action === 'suspend') return accounts.filter((account) => !suspended(account, now));
  if (action === 'lift_suspension') return accounts.filter((account) => suspended(account, now));
  return [];
}

/**
 * The actions of an open report (9.11): a listing can be withdrawn while it is public, a review
 * hidden or restored, a disputed deal confirmed or cancelled, the account behind the target
 * warned, suspended or lifted. Every report but a dispute can be dismissed: a dispute only ends
 * with a decision. A resolved report has none.
 */
export function reportActions(report: ModerationReport, now: Date): ModerationAction[] {
  if (report.status !== 'open') return [];
  const actions: ModerationAction[] = [];
  if (report.targetType === 'listing' && report.listingPublic) actions.push('withdraw_listing');
  if (report.targetType === 'review')
    actions.push(report.hidden ? 'restore_review' : 'hide_review');
  if (report.targetType === 'transaction') actions.push('confirm_deal', 'cancel_deal');
  if (report.owner !== null) {
    actions.push('warn');
    actions.push(suspended(report.owner, now) ? 'lift_suspension' : 'suspend');
  }
  if (report.targetType !== 'transaction') actions.push('dismiss');
  return actions;
}

/** The actions of an alert (9.15.5): «Descartar», «Ocultar reseña», «Advertir», «Suspender». */
export function flagActions(flag: ModerationFlag, now: Date): ModerationAction[] {
  const actions: ModerationAction[] = ['dismiss'];
  if (REVIEW_FLAGS.has(flag.kind)) actions.push('hide_review');
  if (flag.accounts.length > 0) actions.push('warn');
  if (accountsFor('suspend', flag.accounts, now).length > 0) actions.push('suspend');
  return actions;
}

/**
 * The end of a suspension of `length` from `now`, as `trade_moderate` takes it: an ISO instant, or
 * `null` for the indefinite one (the Comercio ban of 9.15.5).
 */
export function suspensionUntil(length: SuspensionLength, now: Date): string | null {
  if (length === 'indefinida') return null;
  return new Date(now.getTime() + Number(length) * 86_400_000).toISOString();
}

/** 9.11: the reason of every action is required and at most `REPORTE_DETALLE_MAX` characters. */
export function validModerationReason(text: string): boolean {
  const trimmed = text.trim();
  return trimmed !== '' && characterCount(trimmed) <= REPORTE_DETALLE_MAX;
}

// ------------------------------------------------------------------------------ messages

export interface ModerationMessages {
  title: string;
  reports: string;
  /** Name of the «Abiertos» / «Resueltos» group. */
  filter: string;
  open: string;
  resolved: string;
  reportsCaption: string;
  columns: {
    date: string;
    target: string;
    reason: string;
    count: string;
    detail: string;
    actions: string;
    kind: string;
    evidence: string;
    account: string;
    platform: string;
    user: string;
    code: string;
  };
  /** «Objetivo»: a listing, an account, a review. */
  targets: {
    listing: string;
    seller: string;
    review: string;
  };
  /** «Operación {number}», in «Detalle» of a scam report. */
  operation: string;
  /** The state of a resolved report. */
  statuses: {
    resolved: string;
    dismissed: string;
  };
  noOpenReports: string;
  noResolvedReports: string;
  alerts: string;
  alertsCaption: string;
  noAlerts: string;
  kinds: {
    dispositivo_contrapartes: string;
    dispositivo_cuentas: string;
    resenas_cuentas_nuevas: string;
    tope_resenas: string;
  };
  /** The evidence of each kind in plain words. */
  evidence: {
    dispositivo_contrapartes: string;
    dispositivo_cuentas: string;
    resenas_cuentas_nuevas: string;
    tope_resenas: string;
  };
  /** «Operaciones: {operations}.», appended when the alert names deals. */
  evidenceOperations: string;
  channels: string;
  channelsCaption: string;
  noChannels: string;
  approve: string;
  reject: string;
  approved: string;
  rejected: string;
  actions: {
    dismiss: string;
    withdraw_listing: string;
    hide_review: string;
    restore_review: string;
    confirm_deal: string;
    cancel_deal: string;
    warn: string;
    suspend: string;
    lift_suspension: string;
  };
  /** The dialog of an action. */
  reason: string;
  reasonHelp: string;
  reasonRequired: string;
  account: string;
  duration: string;
  durations: {
    d7: string;
    d30: string;
    indefinida: string;
  };
  apply: string;
  applying: string;
  done: string;
  cancel: string;
  retry: string;
  /** The author of a target whose account no longer exists: «Cuenta eliminada». */
  deletedAccount: string;
}

function actionLabel(action: ModerationAction, labels: ModerationMessages['actions']): string {
  switch (action) {
    case 'dismiss':
      return labels.dismiss;
    case 'withdraw_listing':
      return labels.withdraw_listing;
    case 'hide_review':
      return labels.hide_review;
    case 'restore_review':
      return labels.restore_review;
    case 'confirm_deal':
      return labels.confirm_deal;
    case 'cancel_deal':
      return labels.cancel_deal;
    case 'warn':
      return labels.warn;
    case 'suspend':
      return labels.suspend;
    case 'lift_suspension':
      return labels.lift_suspension;
  }
}

function kindLabel(kind: FlagKind, labels: ModerationMessages['kinds']): string {
  switch (kind) {
    case 'dispositivo_contrapartes':
      return labels.dispositivo_contrapartes;
    case 'dispositivo_cuentas':
      return labels.dispositivo_cuentas;
    case 'resenas_cuentas_nuevas':
      return labels.resenas_cuentas_nuevas;
    case 'tope_resenas':
      return labels.tope_resenas;
  }
}

function evidenceTemplate(kind: FlagKind, labels: ModerationMessages['evidence']): string {
  switch (kind) {
    case 'dispositivo_contrapartes':
      return labels.dispositivo_contrapartes;
    case 'dispositivo_cuentas':
      return labels.dispositivo_cuentas;
    case 'resenas_cuentas_nuevas':
      return labels.resenas_cuentas_nuevas;
    case 'tope_resenas':
      return labels.tope_resenas;
  }
}

function durationLabel(length: SuspensionLength, labels: ModerationMessages['durations']): string {
  switch (length) {
    case '7':
      return labels.d7;
    case '30':
      return labels.d30;
    case 'indefinida':
      return labels.indefinida;
  }
}

/** A handle, or «Cuenta eliminada». */
function accountName(account: ModerationAccount | null, messages: ModerationMessages): string {
  return account?.handle ?? messages.deletedAccount;
}

/**
 * The evidence of an alert in plain words (9.15.5): the accounts, the device, the dates and the
 * count of its kind, then the deals behind it. Every value comes from the alert row; a value the
 * row lacks is «—».
 */
export function flagEvidence(
  flag: ModerationFlag,
  messages: ModerationMessages,
  locale: Locale,
): string {
  const names = flag.accounts.map((account) => accountName(account, messages));
  const list = new Intl.ListFormat(locale, { type: 'conjunction' });
  const others = flag.kind === 'resenas_cuentas_nuevas' ? names.slice(1) : names;
  // «{n} cuentas usaron el mismo dispositivo»: the accounts the alert names, when the row has no count.
  const count = flag.count ?? (flag.kind === 'dispositivo_cuentas' ? names.length : null);
  const text = fill(evidenceTemplate(flag.kind, messages.evidence), {
    a: names[0] ?? '—',
    b: names[1] ?? '—',
    accounts: others.length === 0 ? '—' : list.format(others),
    account: names[0] ?? '—',
    device: flag.device ?? '—',
    from: flag.from === null ? '—' : formatDate(flag.from, locale),
    to: flag.to === null ? '—' : formatDate(flag.to, locale),
    n: count === null ? '—' : formatInteger(count, locale),
  });
  if (flag.operations.length === 0) return text;
  return `${text} ${fill(messages.evidenceOperations, {
    operations: list.format(flag.operations.map(formatOperationNumber)),
  })}`;
}

// ------------------------------------------------------------------------------ data

/** Rows of src/lib/supabase/trade.ts as the queue reads them. */
export function toModerationReport(row: ModerationReportRow): ModerationReport {
  return { ...row };
}

export function toModerationFlag(row: ModerationFlagRow): ModerationFlag {
  return { ...row };
}

export function toPendingChannel(row: PendingChannelRow): PendingChannel {
  return { ...row };
}

// ------------------------------------------------------------------------------ component

interface UiLabels {
  close: string;
  dismiss: string;
}

export interface ModerationQueueProps {
  locale: Locale;
  messages: ModerationMessages;
  /** `trade.report`: the reason labels of the reports. */
  report: Pick<ReportMessages, 'reasons'>;
  /** What a non-moderator sees: `errors.notFound` and its line, filled with the path. */
  notFound: { title: string; line: string };
  ui: UiLabels;
}

interface Pending {
  action: ModerationAction;
  target: ModerationTarget;
}

function listingHref(locale: Locale, id: string): string {
  return `/${locale}/comercio/anuncio/${encodeURIComponent(id)}/`;
}

function profileHref(locale: Locale, handle: string): string {
  return `/${locale}/comercio/vendedor/${encodeURIComponent(handle)}/`;
}

export function ModerationQueue({ locale, messages, report, notFound, ui }: ModerationQueueProps) {
  const [client, setClient] = useState<SupabaseClient | null | undefined>(undefined);
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [moderator, setModerator] = useState<boolean | undefined>(undefined);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [filter, setFilter] = useState<'open' | 'closed'>('open');
  const [reports, setReports] = useState<ModerationReport[] | undefined>(undefined);
  const [flags, setFlags] = useState<ModerationFlag[] | undefined>(undefined);
  const [channels, setChannels] = useState<PendingChannel[] | undefined>(undefined);
  const [now, setNow] = useState<Date>(() => new Date());
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [pendingOpen, setPendingOpen] = useState(false);
  const [pendingError, setPendingError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonInvalid, setReasonInvalid] = useState(false);
  const [length, setLength] = useState<SuspensionLength>('7');
  const [accountId, setAccountId] = useState('');

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
  // The moderator row depends on the account, not on the session object, which every token
  // refresh replaces: a refresh must not take the queue, or an open dialog, off the page.
  const sessionKnown = session !== undefined;

  // Whether the account is a moderator: the one read an account that is not makes here.
  useEffect(() => {
    if (client === undefined || !sessionKnown) return undefined;
    if (!client || userId === null) {
      setModerator(false);
      return undefined;
    }
    let active = true;
    setModerator(undefined);
    isTradeModerator(client).then(
      (result) => {
        if (!active) return;
        if (result.error) setLoadError(result.error);
        else setModerator(result.data === true);
      },
      (error: unknown) => {
        if (active) setLoadError(error);
      },
    );
    return () => {
      active = false;
    };
  }, [client, sessionKnown, userId, attempt]);

  // The three lists, again after every action.
  useEffect(() => {
    if (!client || moderator !== true) return undefined;
    let active = true;
    setLoadError(null);
    Promise.all([
      listModerationReports(client, filter),
      listModerationFlags(client),
      listPendingChannels(client),
    ]).then(
      ([reportRows, flagRows, channelRows]) => {
        if (!active) return;
        const failure = reportRows.error ?? flagRows.error ?? channelRows.error;
        if (failure) {
          setLoadError(failure);
          return;
        }
        setNow(new Date());
        setReports((reportRows.data ?? []).map(toModerationReport));
        setFlags((flagRows.data ?? []).map(toModerationFlag));
        setChannels((channelRows.data ?? []).map(toPendingChannel));
      },
      (error: unknown) => {
        if (active) setLoadError(error);
      },
    );
    return () => {
      active = false;
    };
  }, [client, moderator, filter, attempt, refresh]);

  function failureText(error: SupabaseFailure | unknown): string {
    return mapSupabaseError(error, locale);
  }

  function targetAccounts(target: ModerationTarget): ModerationAccount[] {
    if (target.type === 'flag') return target.flag.accounts;
    return target.report.owner === null ? [] : [target.report.owner];
  }

  function open(action: ModerationAction, target: ModerationTarget) {
    setPending({ action, target });
    setPendingError(null);
    setReason('');
    setReasonInvalid(false);
    setLength('7');
    setAccountId(accountsFor(action, targetAccounts(target), now)[0]?.id ?? '');
    setPendingOpen(true);
  }

  function closePending() {
    setPendingOpen(false);
    setPending(null);
  }

  async function apply() {
    if (!client || pending === null || working) return;
    if (!validModerationReason(reason)) {
      setReasonInvalid(true);
      document.getElementById('ac-moderation-reason')?.focus();
      return;
    }
    const { action, target } = pending;
    const onAccount = ACCOUNT_ACTIONS.has(action);
    // An action on an account names it; the others act on the report's target or the alert.
    const targetType = onAccount
      ? 'user'
      : target.type === 'flag'
        ? 'flag'
        : target.report.targetType;
    if (!sendableAction(action) || !sendableTarget(targetType)) {
      setPendingError(failureText({ code: '22023', network: false }));
      return;
    }
    setWorking(true);
    setPendingError(null);
    try {
      const { error } = await moderateTrade(client, {
        action,
        targetType,
        targetId: onAccount
          ? accountId
          : target.type === 'flag'
            ? target.flag.id
            : target.report.targetId,
        reason: reason.trim(),
        until: action === 'suspend' ? suspensionUntil(length, new Date()) : null,
        reportId: target.type === 'report' ? target.report.id : null,
        flagId: target.type === 'flag' ? target.flag.id : null,
      });
      if (error) {
        setPendingError(failureText(error));
        return;
      }
      closePending();
      setNotice(messages.done);
      setRefresh((value) => value + 1);
    } catch (caught) {
      setPendingError(failureText(caught));
    } finally {
      setWorking(false);
    }
  }

  async function verify(channel: PendingChannel, approve: boolean) {
    if (!client) return;
    try {
      const { error } = await verifyTradeChannel(client, channel.id, approve);
      if (error) {
        setNotice(failureText(error));
        return;
      }
      setNotice(approve ? messages.approved : messages.rejected);
      setRefresh((value) => value + 1);
    } catch (caught) {
      setNotice(failureText(caught));
    }
  }

  // ------------------------------------------------------------------------ cells

  function targetCell(row: ModerationReport): ReactNode {
    const owner = accountName(row.owner, messages);
    if (row.targetType === 'listing') {
      const text = fill(messages.targets.listing, { handle: owner });
      return row.listingPublic ? (
        <TextLink href={listingHref(locale, row.targetId)}>{text}</TextLink>
      ) : (
        text
      );
    }
    if (row.targetType === 'transaction') {
      return (
        <div className="ac-trade-mod__lines">
          <p className="ac-trade-mod__line">
            {row.operation === null
              ? null
              : fill(messages.operation, { number: formatOperationNumber(row.operation) })}
          </p>
          {row.owner?.handle ? (
            <p className="ac-trade-mod__line">
              <TextLink href={profileHref(locale, row.owner.handle)}>{row.owner.handle}</TextLink>
            </p>
          ) : null}
        </div>
      );
    }
    if (row.targetType === 'seller') {
      return row.owner?.handle ? (
        <TextLink href={profileHref(locale, row.owner.handle)}>{owner}</TextLink>
      ) : (
        owner
      );
    }
    const text = fill(messages.targets.review, {
      author: owner,
      handle: row.reviewedHandle ?? messages.deletedAccount,
    });
    return row.reviewedHandle ? (
      <TextLink href={profileHref(locale, row.reviewedHandle)}>{text}</TextLink>
    ) : (
      text
    );
  }

  function detailCell(row: ModerationReport): ReactNode {
    const parts: string[] = [];
    // The deal a scam report names (9.15.5); a disputed deal already names it as its target.
    if (row.operation !== null && row.targetType !== 'transaction') {
      parts.push(fill(messages.operation, { number: formatOperationNumber(row.operation) }));
    }
    if (row.detail !== null) parts.push(row.detail);
    if (parts.length === 0) return null;
    return (
      <div className="ac-trade-mod__lines">
        {parts.map((part, index) => (
          <p key={index} className="ac-trade-mod__line">
            {part}
          </p>
        ))}
      </div>
    );
  }

  function actionButtons(actions: ModerationAction[], target: ModerationTarget): ReactNode {
    if (actions.length === 0) return null;
    return (
      <div className="ac-trade-mod__actions">
        {actions.map((action) => (
          <Button key={action} onClick={() => open(action, target)}>
            {actionLabel(action, messages.actions)}
          </Button>
        ))}
      </div>
    );
  }

  // ------------------------------------------------------------------------ render

  const pendingCheck = client === undefined || session === undefined || moderator === undefined;
  const busy = pendingCheck && loadError === null;

  const errorNotice =
    loadError !== null ? (
      <Notice open onClose={() => setLoadError(null)} closeLabel={ui.dismiss}>
        {failureText(loadError)}{' '}
        <Button
          onClick={() => {
            setLoadError(null);
            setAttempt((value) => value + 1);
          }}
        >
          {messages.retry}
        </Button>
      </Notice>
    ) : null;

  if (moderator === false) {
    return (
      <div className="ac-trade-mod">
        <PageTitle title={notFound.title} />
        <p className="ac-trade-mod__line">{notFound.line}</p>
      </div>
    );
  }

  if (moderator !== true) {
    return (
      <div className="ac-trade-mod" aria-busy={busy ? 'true' : undefined}>
        {errorNotice}
      </div>
    );
  }

  const reportColumns: DataTableColumn[] = [
    { key: 'date', label: messages.columns.date, align: 'left', nowrap: true, text: 'ui' },
    { key: 'target', label: messages.columns.target, align: 'left' },
    { key: 'reason', label: messages.columns.reason, align: 'left' },
    { key: 'count', label: messages.columns.count, numeric: true },
    { key: 'detail', label: messages.columns.detail, align: 'left' },
    { key: 'actions', label: messages.columns.actions, align: 'left' },
  ];
  const flagColumns: DataTableColumn[] = [
    { key: 'date', label: messages.columns.date, align: 'left', nowrap: true, text: 'ui' },
    { key: 'kind', label: messages.columns.kind, align: 'left' },
    { key: 'evidence', label: messages.columns.evidence, align: 'left' },
    { key: 'actions', label: messages.columns.actions, align: 'left' },
  ];
  const channelColumns: DataTableColumn[] = [
    { key: 'date', label: messages.columns.date, align: 'left', nowrap: true, text: 'ui' },
    { key: 'account', label: messages.columns.account, align: 'left' },
    { key: 'platform', label: messages.columns.platform, align: 'left' },
    { key: 'user', label: messages.columns.user, align: 'left' },
    { key: 'code', label: messages.columns.code, align: 'left' },
    { key: 'actions', label: messages.columns.actions, align: 'left' },
  ];

  const pendingAccounts =
    pending === null ? [] : accountsFor(pending.action, targetAccounts(pending.target), now);
  const onAccount = pending !== null && ACCOUNT_ACTIONS.has(pending.action);

  return (
    <div className="ac-trade-mod">
      <PageTitle title={messages.title} />
      {errorNotice}
      {notice !== null ? (
        <Notice open onClose={() => setNotice(null)} closeLabel={ui.dismiss}>
          {notice}
        </Notice>
      ) : null}

      <Section id="reportes" title={messages.reports}>
        <ToggleGroup
          label={messages.filter}
          options={[
            { value: 'open', label: messages.open },
            { value: 'closed', label: messages.resolved },
          ]}
          value={filter}
          onChange={(value) => {
            setReports(undefined);
            setFilter(value === 'closed' ? 'closed' : 'open');
          }}
        />
        {reports === undefined ? null : reports.length === 0 ? (
          <EmptyState>
            {filter === 'open' ? messages.noOpenReports : messages.noResolvedReports}
          </EmptyState>
        ) : (
          <DataTable
            caption={messages.reportsCaption}
            columns={reportColumns}
            rows={reports.map((row) => ({
              key: row.id,
              cells: {
                date: formatDate(row.createdAt, locale),
                target: targetCell(row),
                reason: row.reason === null ? null : reportReasonLabel(row.reason, report),
                count: formatInteger(row.openCount, locale),
                detail: detailCell(row),
                actions:
                  row.status === 'open'
                    ? actionButtons(reportActions(row, now), { type: 'report', report: row })
                    : row.status === 'dismissed'
                      ? messages.statuses.dismissed
                      : messages.statuses.resolved,
              },
            }))}
            locale={locale}
            scroll
            wrap
          />
        )}
      </Section>

      <Section id="alertas" title={messages.alerts}>
        {flags === undefined ? null : flags.length === 0 ? (
          <EmptyState>{messages.noAlerts}</EmptyState>
        ) : (
          <DataTable
            caption={messages.alertsCaption}
            columns={flagColumns}
            rows={flags.map((flag) => ({
              key: flag.id,
              cells: {
                date: formatDate(flag.createdAt, locale),
                kind: kindLabel(flag.kind, messages.kinds),
                evidence: flagEvidence(flag, messages, locale),
                actions: actionButtons(flagActions(flag, now), { type: 'flag', flag }),
              },
            }))}
            locale={locale}
            scroll
            wrap
          />
        )}
      </Section>

      <Section id="canales" title={messages.channels}>
        {channels === undefined ? null : channels.length === 0 ? (
          <EmptyState>{messages.noChannels}</EmptyState>
        ) : (
          <DataTable
            caption={messages.channelsCaption}
            columns={channelColumns}
            rows={channels.map((channel) => ({
              key: channel.id,
              cells: {
                date: formatDate(channel.createdAt, locale),
                account:
                  channel.handle === null ? (
                    messages.deletedAccount
                  ) : (
                    <TextLink href={profileHref(locale, channel.handle)}>{channel.handle}</TextLink>
                  ),
                platform: channel.platform,
                user: (
                  <span className="ac-trade-mod__value" translate="no">
                    {channel.value}
                  </span>
                ),
                code:
                  channel.code === null ? null : (
                    <span className="ac-trade-mod__value" translate="no">
                      {channel.code}
                    </span>
                  ),
                actions: (
                  <div className="ac-trade-mod__actions">
                    <Button onClick={() => void verify(channel, true)}>{messages.approve}</Button>
                    <Button onClick={() => void verify(channel, false)}>{messages.reject}</Button>
                  </div>
                ),
              },
            }))}
            locale={locale}
            scroll
            wrap
          />
        )}
      </Section>

      {pending !== null ? (
        <Dialog
          open={pendingOpen}
          onClose={closePending}
          title={actionLabel(pending.action, messages.actions)}
          closeLabel={ui.close}
          actions={
            <>
              <Button onClick={closePending}>{messages.cancel}</Button>
              <Button variant="solid" disabled={working} onClick={() => void apply()}>
                {working ? messages.applying : messages.apply}
              </Button>
            </>
          }
        >
          {onAccount && pendingAccounts.length > 1 ? (
            <Select
              label={messages.account}
              options={pendingAccounts.map((account) => ({
                value: account.id,
                label: accountName(account, messages),
              }))}
              value={accountId}
              onChange={(value) => setAccountId(value)}
            />
          ) : null}
          {onAccount && pendingAccounts.length === 1 ? (
            <p className="ac-trade-mod__line">
              {messages.account}: {accountName(pendingAccounts[0] ?? null, messages)}
            </p>
          ) : null}
          {pending.action === 'suspend' ? (
            <RadioGroup
              legend={messages.duration}
              options={SUSPENSION_LENGTHS.map((value) => ({
                value,
                label: durationLabel(value, messages.durations),
              }))}
              value={length}
              onChange={(value) => setLength(value as SuspensionLength)}
            />
          ) : null}
          <Textarea
            id="ac-moderation-reason"
            label={messages.reason}
            helper={
              reasonInvalid
                ? messages.reasonRequired
                : fill(messages.reasonHelp, { max: formatInteger(REPORTE_DETALLE_MAX, locale) })
            }
            value={reason}
            onChange={(value) => {
              setReason(value);
              if (reasonInvalid) setReasonInvalid(false);
            }}
            rows={4}
            textareaProps={{
              maxLength: REPORTE_DETALLE_MAX,
              required: true,
              'aria-invalid': reasonInvalid ? true : undefined,
            }}
          />
          {pendingError !== null ? (
            <Notice open onClose={() => setPendingError(null)} closeLabel={ui.dismiss}>
              {pendingError}
            </Notice>
          ) : null}
        </Dialog>
      ) : null}
    </div>
  );
}
