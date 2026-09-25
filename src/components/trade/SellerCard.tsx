import { Fragment, useLayoutEffect, useMemo, useRef } from 'react';
import type { MouseEvent, ReactNode } from 'react';

import { SellerPresence } from '@/components/cards/ListingCard';
import type { SellerPresenceData } from '@/components/cards/ListingCard';
import { DataTable } from '@/components/content/DataTable';
import type { DataTableRow } from '@/components/content/DataTable';
import { FactLine } from '@/components/content/FactLine';
import type { FactLinePart } from '@/components/content/FactLine';
import { Pagination } from '@/components/controls/Pagination';
import { TextLink } from '@/components/controls/TextLink';
import { useListState } from '@/components/lists/useListState';
import type { Locale } from '@/i18n/config';
import type { Messages } from '@/i18n/messages/en';
import type { MessageLeaf } from '@/i18n/messages/types';
import { fill, isPluralMessage, plural } from '@/i18n/messages/types';
import { formatDate } from '@/lib/format/dates';
import { formatInteger, formatRating } from '@/lib/format/numbers';
import type { TipData } from '@/lib/game/tips';
import { PENDING_ATTRIBUTE, pendingScript } from '@/lib/lists/state';
import type { ListConfig } from '@/lib/lists/state';
import type { SellerReputation } from '@/lib/trade/types';

// The seller's side of Comercio (spec 9.6, 9.8, 9.10, 9.15.4, 9.15.6):
//
//   - `SellerCard`, the «Vendedor» section of a listing detail (9.6): the seller's name, linked
//     to the profile, with its online status (9.15.6), and its reputation as a `FactLine`,
//     «Valoración: ★ 4.8 · 50 operaciones · 5 compradores distintos» (9.15.4). A server
//     component: the detail page renders it with no client directive.
//   - `reputationValues`, the values of that line, which the profile's data row repeats (9.8).
//   - `SellerReviews`, the «Reseñas» section of a profile (9.8 step 6): the `DataTable`
//     «Reseñas por puntuación» with the rows 5 to 1 (9.15.4) and their counts (0 is a real
//     figure), then the reviews from the newest to the oldest, 10 a page. Each review is an
//     `article`: «{n} de 5» in 700, the buyer's handle and the date, then «Operación: {título}»,
//     where the traded Pokémon or item is a `NestedEntity` with its panel and links to the
//     listing's detail (9.4: reviews link to those details), and the comment when there is one.
//     No evidence is ever shown in public (9.10).
//
// The reviews are a paginated list with the controller of 7.7 (`useListState`): its page lives
// in the URL under the `resenas` prefix (U1), because the profile's «Anuncios» list owns the
// plain `page`; a page link is a real `?resenas.page=N` (H6) whose click the controller turns
// into a history entry (H1), and the list takes the focus after it (H4). PR4 is kept as
// `EntityList` keeps it: the inline script hides the block before the first paint when the URL
// asks for another page. The reviews are not entities with three views (7.7.4), so this block
// draws its own articles and pagination instead of `EntityList`.
//
// Data (9.8 «Fase A»): tests/fixtures/comercio/vendedores.json, read only with COMERCIO_DEMO=1 (9.2).
// The page computes the reputation from the reviews (`sellerReputation`, 9.15.4) and hands over
// each traded listing once, in `operations`, with its title (9.4) and the panel of its asset
// (7.5.3), built in the build. Every visible text arrives by props (DP1).

// ------------------------------------------------------------------------ reputation

/** The texts of a reputation (DP1). */
export interface ReputationLabels {
  /** `ui.money.outOf`, «de 5»: what a screen reader hears after the score. */
  outOf: string;
  /** «{n} operación» / «{n} operaciones». */
  deals: MessageLeaf;
  /** «{n} comprador distinto» / «{n} compradores distintos». */
  buyers: MessageLeaf;
  /** «sin reseñas»: the value of a seller nobody reviewed yet. */
  noReviews: string;
}

/** A plural or a plain template, filled with the figure already formatted (13.2, 13.3). */
function counted(template: MessageLeaf, n: number, locale: Locale): string {
  const chosen = isPluralMessage(template) ? plural(locale, n, template) : template;
  return fill(chosen, { n: formatInteger(n, locale) });
}

/**
 * The values of «Valoración» (9.15.4): «★ 4.8», «50 operaciones» and «5 compradores distintos»,
 * which `FactLine` joins with « · ». The score is the «media», written as every score of the site
 * with one decimal and a point in both languages (`formatRating`, X5), so the card, the row and
 * the detail show the same figure; the star is `aria-hidden` and a screen reader hears «4.8 de
 * 5». A seller nobody reviewed yet is «sin reseñas», followed by its confirmed trades when it has
 * some.
 */
export function reputationValues(
  reputation: Pick<SellerReputation, 'valoracion' | 'operaciones' | 'contrapartes'>,
  locale: Locale,
  labels: ReputationLabels,
): ReactNode[] {
  const { valoracion, operaciones, contrapartes } = reputation;
  const deals = counted(labels.deals, operaciones, locale);
  if (valoracion === null) return operaciones > 0 ? [labels.noReviews, deals] : [labels.noReviews];
  return [
    <span key="score" className="ac-reputation__score">
      <span aria-hidden="true">★ </span>
      {formatRating(valoracion)}
      <span className="sr-only">{` ${labels.outOf}`}</span>
    </span>,
    deals,
    counted(labels.buyers, contrapartes, locale),
  ];
}

// ------------------------------------------------------------------------ SellerCard

/** The texts of the seller block of a detail (DP1). */
export interface SellerCardLabels extends ReputationLabels {
  /** «Valoración», without the colon `FactLine` adds. */
  rating: string;
}

export interface SellerCardProps {
  /** The seller's name, the text of the link. */
  name: string;
  /** The profile (9.8). */
  href: string;
  /** Its online status with its label (9.15.6); `null` draws none. */
  presence: SellerPresenceData | null;
  /** Its reputation as seller (9.15.4). */
  reputation: Pick<SellerReputation, 'valoracion' | 'operaciones' | 'contrapartes'>;
  locale: Locale;
  labels: SellerCardLabels;
}

/** The «Vendedor» section of a listing detail (9.6, 9.15.4, 9.15.6). */
export function SellerCard({ name, href, presence, reputation, locale, labels }: SellerCardProps) {
  return (
    <div className="ac-seller-card">
      <p className="ac-seller-card__name">
        <TextLink href={href}>{name}</TextLink>
        {presence === null ? null : (
          <SellerPresence state={presence.state} label={presence.label} />
        )}
      </p>
      <FactLine label={labels.rating} values={reputationValues(reputation, locale, labels)} />
    </div>
  );
}

// --------------------------------------------------------------------- SellerReviews

/** One review of `tests/fixtures/comercio/vendedores.json` (9.4), as the profile shows it. */
export interface SellerReview {
  /** 1 to 5 (9.15.4). */
  puntuacion: number;
  comentario: string | null;
  /** ISO 8601 instant. */
  fecha: string;
  /** The buyer's handle. */
  comprador: string;
  /** Id of the listing of the trade: a key of `operations`. */
  anuncio: string;
}

/** The listing of a trade, as «Operación: {título}» names it (9.8). */
export interface SellerOperation {
  /** `listingTitle(…).texto` (9.4). */
  titulo: string;
  /** `listingTitle(…).accesible`: what a screen reader hears (R5). */
  accesible: string;
  /** Its detail; `null` for a listing withdrawn from the public (9.4). */
  href: string | null;
  /** The panel of its Pokémon or item (7.5.3); `null` for Diamonds and Pokédólares. */
  tip: TipData | null;
}

/** The texts of the reviews (DP1). */
export interface SellerReviewsLabels {
  /** «Reseñas por puntuación»: the hidden caption of the table. */
  caption: string;
  /** «Puntuación» and «Reseñas»: the two headers of the table. */
  score: string;
  reviews: string;
  /** «{n} de 5»: the score of one review. */
  outOf: string;
  /** «Operación», without the colon `FactLine` adds. */
  operation: string;
  /** The name of the reviews' pagination: the profile has another one (WA2). */
  pagination: string;
}

export interface SellerReviewsProps {
  locale: Locale;
  /** The profile without a query: the base of the page links (H6, PR2). */
  path: string;
  /** Every review of the seller, the newest first. */
  reviews: readonly SellerReview[];
  /** The traded listings by id. */
  operations: Readonly<Record<string, SellerOperation>>;
  /** `messages.ui`: the pagination and the strip of the panels. */
  ui: Messages['ui'];
  labels: SellerReviewsLabels;
}

/** Reviews per page (9.8). */
export const REVIEWS_PAGE_SIZE = 10;

/** The rows of the table, from the top score down: 1 to 5 stars (9.8, 9.15.4). */
const SCORES = [5, 4, 3, 2, 1] as const;

/** The newest first; a date that does not read goes last. */
function newestFirst(a: SellerReview, b: SellerReview): number {
  const first = Date.parse(a.fecha);
  const second = Date.parse(b.fecha);
  if (Number.isNaN(first) || Number.isNaN(second)) {
    return Number.isNaN(first) === Number.isNaN(second) ? 0 : Number.isNaN(first) ? 1 : -1;
  }
  return second - first;
}

/** 7.7.1: the reviews of a profile, a page of 10 under the `resenas` prefix (U1). */
const REVIEWS: ListConfig<SellerReview> = {
  id: 'resenas',
  prefix: 'resenas',
  pageSize: REVIEWS_PAGE_SIZE,
  sorts: [{ id: 'recientes', label: '', compare: newestFirst }],
  filters: [],
};

/** «Operación: {título}»: the asset with its panel when it has one, else a link or text. */
function operationValue(operation: SellerOperation | undefined): FactLinePart {
  if (operation === undefined) return null;
  const title: ReactNode =
    operation.accesible === operation.titulo ? (
      operation.titulo
    ) : (
      <>
        <span aria-hidden="true">{operation.titulo}</span>
        <span className="sr-only">{operation.accesible}</span>
      </>
    );
  const shows =
    operation.tip !== null &&
    (operation.tip.rows.length > 0 || Boolean(operation.tip.sections?.length));
  if (shows && operation.tip !== null && operation.accesible === operation.titulo) {
    return {
      text: operation.titulo,
      tip: operation.tip,
      ...(operation.href === null ? {} : { href: operation.href }),
    };
  }
  return operation.href === null ? title : <TextLink href={operation.href}>{title}</TextLink>;
}

/** The «Reseñas» section of a profile (9.8 step 6). */
export function SellerReviews({
  locale,
  path,
  reviews,
  operations,
  ui,
  labels,
}: SellerReviewsProps) {
  const controller = useListState(REVIEWS, { items: reviews, path });
  const { page, ready } = controller;
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // PR4, as `EntityList` does it: printed first inside the root, before any review is parsed.
  const script = useMemo(
    () => pendingScript(REVIEWS, controller.defaultPageCount),
    [controller.defaultPageCount],
  );
  useLayoutEffect(() => {
    if (ready) rootRef.current?.removeAttribute(PENDING_ATTRIBUTE);
  }, [ready]);

  // H4: after a page change the reviews take the focus and come under the header.
  const focusPage = useRef<number | null>(null);
  useLayoutEffect(() => {
    const wanted = focusPage.current;
    if (wanted === null || !ready || page.state.page !== wanted) return;
    focusPage.current = null;
    const list = listRef.current;
    if (list === null) return;
    list.focus({ preventScroll: true });
    list.scrollIntoView({ block: 'start' });
  });

  function onPage(target: number, event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    if (target === page.state.page) return;
    focusPage.current = target;
    controller.goToPage(target);
  }

  const rows: DataTableRow[] = SCORES.map((score) => ({
    key: score,
    cells: {
      score: formatInteger(score, locale),
      reviews: formatInteger(
        reviews.filter((review) => review.puntuacion === score).length,
        locale,
      ),
    },
  }));

  return (
    <div
      ref={rootRef}
      className="ac-seller-reviews"
      data-ac-list={REVIEWS.id}
      suppressHydrationWarning
    >
      <span hidden dangerouslySetInnerHTML={{ __html: `<script>${script}</script>` }} />
      <DataTable
        caption={labels.caption}
        columns={[
          { key: 'score', label: labels.score, rowHeader: true },
          { key: 'reviews', label: labels.reviews, numeric: true },
        ]}
        rows={rows}
        locale={locale}
      />
      {page.items.length > 0 ? (
        <div ref={listRef} className="ac-seller-reviews__list" tabIndex={-1}>
          {page.items.map((review, index) => (
            // The reviews are the seller's fixed sequence: position and date are identity.
            <article key={`${review.fecha}-${index}`} className="ac-seller-review">
              <p className="ac-seller-review__head">
                <span className="ac-seller-review__score">
                  {fill(labels.outOf, { n: formatInteger(review.puntuacion, locale) })}
                </span>
                {[
                  review.comprador,
                  <time dateTime={review.fecha}>{formatDate(review.fecha, locale)}</time>,
                ].map((part, position) => (
                  <Fragment key={position}>
                    <span className="ac-fact-line__sep" aria-hidden="true">
                      {' · '}
                    </span>
                    {part}
                  </Fragment>
                ))}
              </p>
              <FactLine
                label={labels.operation}
                values={[operationValue(operations[review.anuncio])]}
                locale={locale}
                hint={ui.pinHint}
                shinyLabel={ui.shiny}
                orLabel={ui.or}
              />
              {review.comentario === null ? null : (
                <p className="ac-seller-review__comment">{review.comentario}</p>
              )}
            </article>
          ))}
        </div>
      ) : null}
      <Pagination
        page={page.state.page}
        pageCount={page.pageCount}
        hrefFor={controller.hrefFor}
        onPage={onPage}
        labels={{ prev: ui.prev, next: ui.next, page: ui.page }}
        ariaLabel={labels.pagination}
      />
    </div>
  );
}
