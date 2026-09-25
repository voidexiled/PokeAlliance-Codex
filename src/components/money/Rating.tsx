import type { Locale } from '@/i18n/config';
import type { MessageLeaf } from '@/i18n/messages/types';
import { isPluralMessage, plural } from '@/i18n/messages/types';
import { formatInteger, formatRating } from '@/lib/format/numbers';

// Rating (spec 7.2.5, 9.5.8, 13.3, X5, R13; DS:Rating, DS:guias/40): the seller of a
// listing with the score of their confirmed trades, «Kaiser 4.6 (23)». A screen reader
// hears «Kaiser 4.6 de 5 (23 reseñas de operaciones)».
//
// Markup of the reference (`bundle.js` Rating): the seller link, then the score with the
// visually hidden «de 5» and the count in `text-tertiary` between parentheses, whose
// hidden word says what it counts. The type is the row's (12/16 in a card footer, 14/22 in
// the Lista): the component sets no size of its own.
//
// The score is written with one decimal and a point in both locales, «4.6» and «5.0»
// (`formatRating`, X5): the one figure of the site with a decimal point in `es`. The count
// is grouped like every other integer (`formatInteger`). The two hidden phrases come from
// `ui.money` of the page's locale (DP1), the reviews one in singular and plural.
//
// No stars and no colours of score: the score is `text-primary` and the count
// `text-tertiary` (DS:Rating §No hacer). A seller without a score, or whose score no
// confirmed trade backs (zero reviews), shows the link alone.

/** The hidden phrases of the score, `ui.money` of the dictionary. */
export interface RatingLabels {
  /** «de 5» / «out of 5», after the score. */
  outOf: string;
  /** «reseña(s) de operaciones» / «trade review(s)», after the count. */
  tradeReviews: MessageLeaf;
}

export interface RatingProps {
  /** Name of the seller, the text of the link. */
  seller: string;
  /** Profile of the seller. Required: a link that leads nowhere is not a link (C-R5). */
  href: string;
  /**
   * The world of the seller's character, after the name: «Void Exiled · Titan 1» (Comercio,
   * owner rule 2026-09-24). None draws the name alone.
   */
  world?: string | null;
  /** Score from 0 to 5, computed from the confirmed trades (9.10). `null`: no score. */
  score?: number | null;
  /** Reviews tied to a confirmed trade. `null`: the count is not shown. */
  reviews?: number | null;
  /** Picks the grouping of the count and the plural form of its word (C-R3). */
  locale: Locale;
  labels: RatingLabels;
  /** Utilities added by the caller, after the component's own classes (3.8). */
  className?: string;
}

function known(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value);
}

export function Rating({
  seller,
  href,
  world,
  score,
  reviews,
  locale,
  labels,
  className,
}: RatingProps) {
  const count = known(reviews) ? Math.round(reviews) : null;
  // A score that no confirmed trade backs is not shown (DS:Rating §No hacer).
  const shown = known(score) && count !== 0;
  const word =
    count === null
      ? null
      : isPluralMessage(labels.tradeReviews)
        ? plural(locale, count, labels.tradeReviews)
        : labels.tradeReviews;

  return (
    <span className={className ? `ac-rating ${className}` : 'ac-rating'}>
      <a className="ac-rating__seller" href={href}>
        {seller}
      </a>
      {world ? <span className="ac-rating__world">{` · ${world}`}</span> : null}
      {shown ? (
        <span className="ac-rating__score">
          {formatRating(score)}
          <span className="sr-only">{` ${labels.outOf}`}</span>
          {count === null ? null : (
            <>
              {' '}
              <span className="ac-rating__reviews">
                ({formatInteger(count, locale)}
                <span className="sr-only">{` ${word}`}</span>)
              </span>
            </>
          )}
        </span>
      ) : null}
    </span>
  );
}
