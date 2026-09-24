import { useEffect, useId, useRef, useState } from 'react';
import type { SubmitEvent } from 'react';

import type { Locale } from '@/i18n/config';
import { fill, plural, type PluralMessage } from '@/i18n/messages/types';
import { formatDate } from '@/lib/format/dates';
import { formatInteger } from '@/lib/format/numbers';
import { PUNTUACION_MAX, PUNTUACION_MIN, RESENA_COMENTARIO_MAX } from '@/lib/trade/limits';

import { Notice } from '@/components/content/Notice';
import { Button } from '@/components/controls/Button';
import { Dialog, initialFocus } from '@/components/controls/Dialog';
import { Textarea } from '@/components/controls/Textarea';

// The review of one confirmed deal (spec 9.10 with the owner's decisions of 9.15.4): both
// directions — the buyer reviews the seller and the seller the buyer —, once each per deal, with
// «Puntuación» from 1 to 5 stars (required) and an optional «Comentario» of up to 1000
// characters. No images (9.15.4 leaves the evidence bucket out). The author may edit it for 7
// days; the same dialog does it, filled with the review, and says until when.
//
// - The title names the other party, «Reseñar a {name}»; when that account no longer exists it
//   says the role, «Reseñar al vendedor» or «Reseñar al comprador».
// - The stars are a native radio group (`fieldset` + `legend`), so the browser gives it one tab
//   stop and the arrow keys. Each option is a «★» text mark with its own accessible name
//   («4 estrellas»); the marks up to the chosen one take the `selected` colour. There is no
//   star glyph in the icon set (C-R7) and the Rating of the design system draws no stars: the
//   star is a text character, as in «★ 4,8» of 9.15.4.
// - The pair cap (9.15.4, `RESENAS_PAR_DIA`): a confirmed deal of a pair that already has that
//   many reviewable deals in 24 h counts as a deal but takes no review. The server says so for
//   each deal; the operations table then shows `pairCapText` instead of «Reseñar», and this
//   dialog shows the same line instead of the form if it is opened for such a deal.
// - The server checks everything again (9.12.3): the deal is `confirmada`, the account is a
//   party, the window is open, the score is 1 to 5, the comment fits. A failure comes back as the
//   text of `onSubmit`, shown inside the dialog, which stays open (10.4).
//
// Styles: trade-operations.css (the stars and the deal line), imported by the operations page.

/** «Puntuación»: the whole stars from `PUNTUACION_MIN` to `PUNTUACION_MAX`, 1 to 5 (9.15.4). */
export const REVIEW_SCORES: readonly number[] = Array.from(
  { length: PUNTUACION_MAX - PUNTUACION_MIN + 1 },
  (_, index) => PUNTUACION_MIN + index,
);

export interface ReviewFormMessages {
  /** Title of a new review that names the other party: «Reseñar a {name}». */
  title: string;
  /** Title of a new review of the seller: «Reseñar al vendedor». */
  titleSeller: string;
  /** Title of a new review of the buyer: «Reseñar al comprador». */
  titleBuyer: string;
  /** Title while editing: «Editar reseña». */
  editTitle: string;
  /** The line under the title: «Operación {number}: {title}». */
  deal: string;
  /** Legend of the stars: «Puntuación». */
  score: string;
  /** Accessible name of each star: «{n} estrella» / «{n} estrellas». */
  star: PluralMessage;
  /** Error of a missing score: «Elige de 1 a 5 estrellas.». */
  scoreRequired: string;
  /** Label of the comment: «Comentario». */
  comment: string;
  /** Helper of the comment: «Opcional. Hasta {max} caracteres.». */
  commentHelp: string;
  /** Submit of a new review: «Publicar reseña». */
  submit: string;
  /** Submit of an edit: «Guardar cambios». */
  save: string;
  /** Submit while the call runs: «Enviando…». */
  sending: string;
  /** «Cancelar». */
  cancel: string;
  /** The pair cap line, `{n}` being `RESENAS_PAR_DIA`. */
  pairCap: string;
  /** While editing, the end of the edit window: «Puedes editarla hasta el {date}.». */
  editableUntil: string;
}

/** A review as the form reads and sends it. */
export interface ReviewValue {
  score: number;
  /** Trimmed; `null` when empty. */
  comment: string | null;
}

export interface ReviewErrors {
  score?: true;
  comment?: true;
}

/** Characters as Postgres `char_length` counts them: code points, not UTF-16 units. */
export function characterCount(text: string): number {
  return Array.from(text).length;
}

/** The comment as it is stored: trimmed, and `null` when nothing is left. */
export function normalizeReviewComment(text: string | null | undefined): string | null {
  const trimmed = (text ?? '').trim();
  return trimmed === '' ? null : trimmed;
}

/** 9.15.4: a whole score from 1 to 5, and a comment of at most `RESENA_COMENTARIO_MAX` characters. */
export function validateReview(
  score: number | null | undefined,
  comment: string | null | undefined,
): ReviewErrors {
  const errors: ReviewErrors = {};
  if (
    typeof score !== 'number' ||
    !Number.isInteger(score) ||
    score < PUNTUACION_MIN ||
    score > PUNTUACION_MAX
  ) {
    errors.score = true;
  }
  const normalized = normalizeReviewComment(comment);
  if (normalized !== null && characterCount(normalized) > RESENA_COMENTARIO_MAX) {
    errors.comment = true;
  }
  return errors;
}

/** The pair cap line of 9.15.4, with `RESENAS_PAR_DIA` written for the locale. */
export function pairCapText(
  messages: Pick<ReviewFormMessages, 'pairCap'>,
  cap: number,
  locale: Locale,
): string {
  return fill(messages.pairCap, { n: formatInteger(cap, locale) });
}

export interface ReviewFormProps {
  open: boolean;
  /** Runs once the dialog has closed, whatever closed it. */
  onClose: () => void;
  locale: Locale;
  messages: ReviewFormMessages;
  /** `ui.close`: the close button of the dialog, and its only button without a form. */
  closeLabel: string;
  /** `ui.dismiss`: the close button of the error notice. */
  dismissLabel: string;
  /** Who is reviewed: the other party of the deal. */
  subject: 'seller' | 'buyer';
  /** The handle of the other party; `null` when that account no longer exists. */
  name: string | null;
  /** The deal number, «OP-000123». */
  number: string;
  /** The title of the listing of the deal (9.4). */
  listingTitle: string;
  /** The review being edited, or `null` for a new one. */
  initial: ReviewValue | null;
  /** While editing: the last moment of the edit window (`RESENA_EDICION_DIAS`). */
  editableUntil: string | null;
  /** False when the pair reached the daily cap: the dialog shows the cap line, no form. */
  allowed: boolean;
  /** `RESENAS_PAR_DIA`, the `{n}` of the cap line. */
  pairCap: number;
  /** Sends the review; resolves to the text of the failure, or `null` once it is saved. */
  onSubmit: (review: ReviewValue) => Promise<string | null>;
}

export function ReviewForm({
  open,
  onClose,
  locale,
  messages,
  closeLabel,
  dismissLabel,
  subject,
  name,
  number,
  listingTitle,
  initial,
  editableUntil,
  allowed,
  pairCap,
  onSubmit,
}: ReviewFormProps) {
  const uid = useId().replace(/[^A-Za-z0-9_-]/g, '');
  const formId = `ac-review-${uid}`;
  const scoreErrorId = `${formId}-score-error`;
  const starsRef = useRef<HTMLDivElement>(null);
  const commentRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);

  const [score, setScore] = useState<number | null>(initial?.score ?? null);
  const [comment, setComment] = useState(initial?.comment ?? '');
  const [errors, setErrors] = useState<ReviewErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // Each opening starts from the review it edits, or from nothing.
  useEffect(() => {
    if (open && !wasOpen.current) {
      setScore(initial?.score ?? null);
      setComment(initial?.comment ?? '');
      setErrors({});
      setFailure(null);
      setSending(false);
    }
    wasOpen.current = open;
  }, [open, initial]);

  const title = initial
    ? messages.editTitle
    : name !== null
      ? fill(messages.title, { name })
      : subject === 'seller'
        ? messages.titleSeller
        : messages.titleBuyer;
  const starLabel = (n: number) =>
    fill(plural(locale, n, messages.star), { n: formatInteger(n, locale) });
  // The star the dialog focuses when it opens: the chosen one, or the first.
  const focusStar = initial?.score ?? PUNTUACION_MIN;

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    const found = validateReview(score, comment);
    setErrors(found);
    if (found.score) {
      starsRef.current?.querySelector<HTMLInputElement>('input')?.focus();
      return;
    }
    if (found.comment) {
      commentRef.current?.querySelector('textarea')?.focus();
      return;
    }
    setSending(true);
    setFailure(null);
    try {
      const text = await onSubmit({
        score: score as number,
        comment: normalizeReviewComment(comment),
      });
      if (text !== null) setFailure(text);
    } finally {
      setSending(false);
    }
  }

  const actions = allowed ? (
    <>
      <Button onClick={onClose}>{messages.cancel}</Button>
      <Button variant="solid" type="submit" form={formId} disabled={sending}>
        {sending ? messages.sending : initial ? messages.save : messages.submit}
      </Button>
    </>
  ) : (
    <Button {...initialFocus} onClick={onClose}>
      {closeLabel}
    </Button>
  );

  return (
    <Dialog open={open} onClose={onClose} title={title} closeLabel={closeLabel} actions={actions}>
      <p className="ac-review-form__deal">{fill(messages.deal, { number, title: listingTitle })}</p>
      {allowed ? (
        <form id={formId} className="ac-review-form" noValidate onSubmit={submit}>
          <fieldset
            className="ac-review-stars"
            aria-describedby={errors.score ? scoreErrorId : undefined}
          >
            <legend className="ac-review-stars__legend">{messages.score}</legend>
            <div ref={starsRef} className="ac-review-stars__options">
              {REVIEW_SCORES.map((n) => (
                <label
                  key={n}
                  className={
                    score !== null && n <= score
                      ? 'ac-review-stars__option ac-review-stars__option--on'
                      : 'ac-review-stars__option'
                  }
                >
                  <input
                    {...(n === focusStar ? initialFocus : {})}
                    className="ac-review-stars__input"
                    type="radio"
                    name={`${formId}-score`}
                    value={n}
                    checked={score === n}
                    aria-label={starLabel(n)}
                    aria-invalid={errors.score ? true : undefined}
                    onChange={() => {
                      setScore(n);
                      setErrors((current) => ({ ...current, score: undefined }));
                    }}
                  />
                  <span className="ac-review-stars__star" aria-hidden="true">
                    ★
                  </span>
                </label>
              ))}
            </div>
            {errors.score ? (
              <p id={scoreErrorId} className="ac-review-stars__error">
                {messages.scoreRequired}
              </p>
            ) : null}
          </fieldset>
          <div ref={commentRef}>
            <Textarea
              label={messages.comment}
              helper={fill(messages.commentHelp, {
                max: formatInteger(RESENA_COMENTARIO_MAX, locale),
              })}
              value={comment}
              onChange={(value) => {
                setComment(value);
                if (errors.comment) setErrors((current) => ({ ...current, comment: undefined }));
              }}
              rows={4}
              textareaProps={{
                maxLength: RESENA_COMENTARIO_MAX,
                'aria-invalid': errors.comment ? true : undefined,
              }}
            />
          </div>
          {initial && editableUntil !== null ? (
            <p className="ac-review-form__deal">
              {fill(messages.editableUntil, { date: formatDate(editableUntil, locale) })}
            </p>
          ) : null}
        </form>
      ) : (
        <p>{pairCapText(messages, pairCap, locale)}</p>
      )}
      {failure !== null ? (
        <Notice open onClose={() => setFailure(null)} closeLabel={dismissLabel}>
          {failure}
        </Notice>
      ) : null}
    </Dialog>
  );
}
