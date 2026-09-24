import { useEffect, useId, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Locale } from '@/i18n/config';
import { fill } from '@/i18n/messages/types';
import { formatInteger } from '@/lib/format/numbers';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { mapSupabaseError } from '@/lib/supabase/errors';
import { reportTradeTarget } from '@/lib/supabase/trade';
import { REPORTE_DETALLE_MAX } from '@/lib/trade/limits';

import { Notice } from '@/components/content/Notice';
import { Button } from '@/components/controls/Button';
import { Dialog } from '@/components/controls/Dialog';
import { RadioGroup } from '@/components/controls/RadioGroup';
import { TextField } from '@/components/controls/TextField';
import { Textarea } from '@/components/controls/Textarea';

import { characterCount } from './ReviewForm';

// «Reportar anuncio», «Reportar vendedor», «Reportar reseña» (spec 9.11, 9.15.5): a `Dialog` with
// the `RadioGroup` «Motivo» (five reasons), the `Textarea` «Detalle» (required with «Otro», at
// most 1000 characters) and, for a scam, the optional «Número de operación» (9.15.5: «El reporte
// de estafa admite el número de operación»), written as the operations table shows it,
// «OP-000123». «Enviar reporte» sends it; then the dialog closes and the page shows «Reporte
// enviado.». One report per account and target: the second one answers «Ya reportaste esto.»
// inside the dialog; at most 10 a day, which the server enforces (9.12.6).
//
// The dialog is controlled: whoever opens it passes `onSubmit`, which resolves to what the
// server said. `ReportAction` is the whole control for a page — the trigger button, the session
// and the call —, so the listing detail and the seller profile only place it.
//
// Security: the reason is one of five fixed values, the texts are length-checked here and again
// by `trade_report` (9.12.3), which also checks the session, the account requirements of 9.15.2
// and the limits. Nothing here decides a permission.

/** The five reasons of 9.11, in their order. The values are the ones `trade_report` takes. */
export const REPORT_REASONS = ['estafa', 'datos_personales', 'ofensivo', 'falso', 'otro'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

/** What can be reported (9.11). */
export type ReportTargetType = 'listing' | 'seller' | 'review';

/** A deal number as the tables write it: `OP-` and at least 6 digits (9.15.4). */
export function formatOperationNumber(value: number): string {
  return `OP-${String(Math.trunc(value)).padStart(6, '0')}`;
}

/**
 * «Número de operación» as typed: «OP-000123», «op 123» or «123» give 123; an empty field gives
 * `null`; anything else is `undefined`, an invalid field.
 */
export function parseOperationNumber(text: string): number | null | undefined {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  const match = /^(?:op[\s-]*)?(\d{1,9})$/i.exec(trimmed);
  if (!match) return undefined;
  const value = Number(match[1]);
  return value >= 1 ? value : undefined;
}

export interface ReportInput {
  reason: ReportReason | null;
  detail: string;
  operation: string;
}

export interface ReportErrors {
  reason?: true;
  detail?: true;
  operation?: true;
}

/** 9.11 and 9.15.5: a reason; a detail with «Otro» and never over 1000; a valid deal number. */
export function validateReport(input: ReportInput): ReportErrors {
  const errors: ReportErrors = {};
  if (input.reason === null || !REPORT_REASONS.includes(input.reason)) errors.reason = true;
  const detail = input.detail.trim();
  if ((input.reason === 'otro' && detail === '') || characterCount(detail) > REPORTE_DETALLE_MAX) {
    errors.detail = true;
  }
  if (input.reason === 'estafa' && parseOperationNumber(input.operation) === undefined) {
    errors.operation = true;
  }
  return errors;
}

/** A report as `onSubmit` receives it. */
export interface ReportPayload {
  reason: ReportReason;
  /** Trimmed; `null` when empty. */
  detail: string | null;
  /** The deal number of a scam report, or `null`. */
  operation: number | null;
}

/** What the server answered: sent, already reported, or the text of another failure. */
export type ReportOutcome =
  { kind: 'sent' } | { kind: 'duplicate' } | { kind: 'error'; text: string };

export interface ReportMessages {
  /** The title of the dialog and the text of its trigger, by target. */
  titles: { listing: string; seller: string; review: string };
  /** Legend of the reasons: «Motivo». */
  reason: string;
  reasons: {
    estafa: string;
    datos_personales: string;
    ofensivo: string;
    falso: string;
    otro: string;
  };
  /** Error of a missing reason: «Elige un motivo.». */
  reasonRequired: string;
  /** Label of the detail: «Detalle». */
  detail: string;
  /** Helper of the detail: «Obligatorio con «Otro». Hasta {max} caracteres.». */
  detailHelp: string;
  /** Error of a missing detail with «Otro»: «Escribe el detalle del reporte.». */
  detailRequired: string;
  /** Label of the deal number: «Número de operación». */
  operation: string;
  /** Helper of the deal number: «Opcional, como {example}.». */
  operationHelp: string;
  /** Error of a malformed deal number: «Escribe el número como {example}.». */
  operationInvalid: string;
  /** «Enviar reporte». */
  send: string;
  /** «Enviando…». */
  sending: string;
  /** «Reporte enviado.». */
  sent: string;
  /** «Ya reportaste esto.». */
  duplicate: string;
  /** «Cancelar». */
  cancel: string;
}

function reasonLabel(reason: ReportReason, messages: Pick<ReportMessages, 'reasons'>): string {
  switch (reason) {
    case 'estafa':
      return messages.reasons.estafa;
    case 'datos_personales':
      return messages.reasons.datos_personales;
    case 'ofensivo':
      return messages.reasons.ofensivo;
    case 'falso':
      return messages.reasons.falso;
    case 'otro':
      return messages.reasons.otro;
  }
}

/** The title of the dialog and of its trigger for a target type. */
export function reportTitle(type: ReportTargetType, messages: ReportMessages): string {
  switch (type) {
    case 'listing':
      return messages.titles.listing;
    case 'seller':
      return messages.titles.seller;
    case 'review':
      return messages.titles.review;
  }
}

/** The label of a reason, for the moderation queue too. */
export { reasonLabel as reportReasonLabel };

/** The example of the deal number field, one past the first deal. */
const OPERATION_EXAMPLE = formatOperationNumber(123);

export interface ReportDialogProps {
  open: boolean;
  /** Runs once the dialog has closed, whatever closed it. */
  onClose: () => void;
  locale: Locale;
  messages: ReportMessages;
  /** `ui.close`. */
  closeLabel: string;
  /** `ui.dismiss`. */
  dismissLabel: string;
  targetType: ReportTargetType;
  /** Sends the report and resolves to what the server answered. */
  onSubmit: (report: ReportPayload) => Promise<ReportOutcome>;
  /** Called after a report was sent, before the dialog closes. */
  onSent: () => void;
}

export function ReportDialog({
  open,
  onClose,
  locale,
  messages,
  closeLabel,
  dismissLabel,
  targetType,
  onSubmit,
  onSent,
}: ReportDialogProps) {
  const uid = useId().replace(/[^A-Za-z0-9_-]/g, '');
  const reasonId = `ac-report-${uid}-reason`;
  const operationId = `ac-report-${uid}-operation`;
  const detailId = `ac-report-${uid}-detail`;
  const wasOpen = useRef(false);

  const [reason, setReason] = useState<ReportReason | null>(null);
  const [detail, setDetail] = useState('');
  const [operation, setOperation] = useState('');
  const [errors, setErrors] = useState<ReportErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // Each opening starts empty.
  useEffect(() => {
    if (open && !wasOpen.current) {
      setReason(null);
      setDetail('');
      setOperation('');
      setErrors({});
      setFailure(null);
      setSending(false);
    }
    wasOpen.current = open;
  }, [open]);

  async function submit() {
    if (sending) return;
    const found = validateReport({ reason, detail, operation });
    setErrors(found);
    // The focus goes to the first invalid field, in the order of the dialog.
    const invalid = found.reason
      ? `${reasonId}-0`
      : found.operation
        ? operationId
        : found.detail
          ? detailId
          : null;
    if (invalid !== null) {
      document.getElementById(invalid)?.focus();
      return;
    }
    setSending(true);
    setFailure(null);
    try {
      const trimmed = detail.trim();
      const outcome = await onSubmit({
        reason: reason as ReportReason,
        detail: trimmed === '' ? null : trimmed,
        operation: reason === 'estafa' ? (parseOperationNumber(operation) ?? null) : null,
      });
      if (outcome.kind === 'sent') {
        onSent();
        onClose();
      } else {
        setFailure(outcome.kind === 'duplicate' ? messages.duplicate : outcome.text);
      }
    } finally {
      setSending(false);
    }
  }

  const actions = (
    <>
      <Button onClick={onClose}>{messages.cancel}</Button>
      <Button variant="solid" onClick={() => void submit()} disabled={sending}>
        {sending ? messages.sending : messages.send}
      </Button>
    </>
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={reportTitle(targetType, messages)}
      closeLabel={closeLabel}
      actions={actions}
    >
      <RadioGroup
        id={reasonId}
        legend={messages.reason}
        options={REPORT_REASONS.map((value) => ({
          value,
          label: reasonLabel(value, messages),
        }))}
        value={reason}
        onChange={(value) => {
          setReason(value as ReportReason);
          setErrors({});
        }}
        helper={errors.reason ? messages.reasonRequired : undefined}
        required
      />
      {reason === 'estafa' ? (
        <TextField
          id={operationId}
          label={messages.operation}
          value={operation}
          onChange={(value) => {
            setOperation(value);
            if (errors.operation) setErrors((current) => ({ ...current, operation: undefined }));
          }}
          helper={fill(errors.operation ? messages.operationInvalid : messages.operationHelp, {
            example: OPERATION_EXAMPLE,
          })}
          inputProps={{
            autoComplete: 'off',
            maxLength: 16,
            spellCheck: false,
            'aria-invalid': errors.operation ? true : undefined,
          }}
        />
      ) : null}
      <Textarea
        id={detailId}
        label={messages.detail}
        helper={
          errors.detail
            ? messages.detailRequired
            : fill(messages.detailHelp, { max: formatInteger(REPORTE_DETALLE_MAX, locale) })
        }
        value={detail}
        onChange={(value) => {
          setDetail(value);
          if (errors.detail) setErrors((current) => ({ ...current, detail: undefined }));
        }}
        rows={4}
        textareaProps={{
          maxLength: REPORTE_DETALLE_MAX,
          required: reason === 'otro',
          'aria-invalid': errors.detail ? true : undefined,
        }}
      />
      {failure !== null ? (
        <Notice open onClose={() => setFailure(null)} closeLabel={dismissLabel}>
          {failure}
        </Notice>
      ) : null}
    </Dialog>
  );
}

// ------------------------------------------------------------------------------ the control

export interface ReportActionProps {
  locale: Locale;
  messages: ReportMessages;
  /** `ui.close` and `ui.dismiss`. */
  ui: { close: string; dismiss: string };
  targetType: ReportTargetType;
  /** The id of the listing or the review, or the account id of the seller. */
  targetId: string;
}

/**
 * «Reportar anuncio» / «Reportar vendedor» / «Reportar reseña» for a page (9.6, 9.8): the button,
 * the dialog and the call. A report needs an account (9.15.2), so without a session the control
 * is not rendered at all (S11); the server checks the rest. After «Enviar reporte» the notice
 * «Reporte enviado.» stays next to the button. A second report of the same target answers
 * «Ya reportaste esto.» (the unique key of `trade_reports`, 23505).
 */
export function ReportAction({ locale, messages, ui, targetType, targetId }: ReportActionProps) {
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    getSupabaseBrowserClient().then(
      (loaded) => {
        if (!active || loaded === null) return;
        setClient(loaded);
        loaded.auth.getSession().then(
          ({ data }) => {
            if (active) setSignedIn(data.session !== null);
          },
          () => undefined,
        );
        const { data } = loaded.auth.onAuthStateChange((_event, next) => {
          if (active) setSignedIn(next !== null);
        });
        unsubscribe = () => data.subscription.unsubscribe();
      },
      () => undefined,
    );
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  async function submit(report: ReportPayload): Promise<ReportOutcome> {
    if (client === null) return { kind: 'error', text: mapSupabaseError(null, locale) };
    try {
      const { error } = await reportTradeTarget(client, { targetType, targetId, ...report });
      if (!error) return { kind: 'sent' };
      if (error.code === '23505') return { kind: 'duplicate' };
      return { kind: 'error', text: mapSupabaseError(error, locale) };
    } catch (caught) {
      return { kind: 'error', text: mapSupabaseError(caught, locale) };
    }
  }

  if (client === null || !signedIn) return null;
  return (
    <>
      <Button onClick={() => setOpen(true)}>{reportTitle(targetType, messages)}</Button>
      {sent ? (
        <Notice open onClose={() => setSent(false)} closeLabel={ui.dismiss}>
          {messages.sent}
        </Notice>
      ) : null}
      <ReportDialog
        open={open}
        onClose={() => setOpen(false)}
        locale={locale}
        messages={messages}
        closeLabel={ui.close}
        dismissLabel={ui.dismiss}
        targetType={targetType}
        onSubmit={submit}
        onSent={() => setSent(true)}
      />
    </>
  );
}
