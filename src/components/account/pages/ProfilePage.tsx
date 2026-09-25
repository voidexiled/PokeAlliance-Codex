import { useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';

import { Chip } from '@/components/content/Chip';
import { EmptyState } from '@/components/content/EmptyState';
import { Button } from '@/components/controls/Button';
import { Pagination } from '@/components/controls/Pagination';
import { TextLink } from '@/components/controls/TextLink';
import { ToggleGroup } from '@/components/controls/ToggleGroup';
import { Section } from '@/components/layout/Section';
import { reputationValues } from '@/components/trade/SellerCard';
import type { Locale } from '@/i18n/config';
import { fill, isPluralMessage, plural, type MessageLeaf } from '@/i18n/messages/types';
import { formatDate } from '@/lib/format/dates';
import { formatInteger } from '@/lib/format/numbers';
import {
  getBuyerReputation,
  getSellerReputation,
  listMyReviews,
  type MyReview,
  type ReviewDirection,
} from '@/lib/supabase/trade';
import type { SellerReputation } from '@/lib/trade/types';

import { pageHref } from '../panel/model';
import { PageError } from './PageError';
import type { PageContext, ProfilePageTexts } from './types';

// «Mi perfil» (spec 9.16.3, 9.15.4), the body of `/{l}/cuenta/perfil/` in the account frame, a
// chunk of its own:
//
// - «Reputación»: as a seller and as a buyer, each a box with the line «★ 4.8 · 50 operaciones ·
//   5 compradores distintos» and the bars from 5 to 1 stars, as long as the share of the largest.
// - «Reseñas»: «Recibidas» or «Hechas» (`?resenas=hechas`), 10 a page (`?pagina=`), newest first.
//   Each review: its stars, the other party (linked to its seller page), the account's role, the
//   deal number, the date and the comment; «Oculta por moderación» when moderation hid it, and
//   «Editar» while its author may still edit it, which opens «Mis operaciones», where the deal's
//   review is edited.
// Every call goes through src/lib/supabase/trade.ts; the database decides every permission.

type Load<T> =
  { state: 'loading' } | { state: 'error'; error: unknown } | { state: 'ready'; data: T };

interface ProfilePageProps extends PageContext {
  texts: ProfilePageTexts;
}

function counted(template: MessageLeaf, n: number, locale: Locale): string {
  const chosen = isPluralMessage(template) ? plural(locale, n, template) : template;
  return fill(chosen, { n: formatInteger(n, locale) });
}

function operationNumber(value: number): string {
  return `OP-${String(Math.trunc(value)).padStart(6, '0')}`;
}

function sellerHref(locale: Locale, handle: string): string {
  return `/${locale}/comercio/vendedor/${encodeURIComponent(handle)}/`;
}

export default function ProfilePage(props: ProfilePageProps) {
  return (
    <div className="ac-account-page">
      <Reputation {...props} />
      <Reviews {...props} />
    </div>
  );
}

// ---------------------------------------------------------------------------- reputation

function Reputation({ client, userId, locale, ui, retry, heading, texts }: ProfilePageProps) {
  const [load, setLoad] = useState<
    Load<{ seller: SellerReputation | null; buyer: SellerReputation | null }>
  >({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoad({ state: 'loading' });
    void Promise.all([
      getSellerReputation(client, userId),
      getBuyerReputation(client, userId),
    ]).then(([seller, buyer]) => {
      if (!active) return;
      const error = seller.error ?? buyer.error;
      if (error !== null) setLoad({ state: 'error', error });
      else setLoad({ state: 'ready', data: { seller: seller.data, buyer: buyer.data } });
    });
    return () => {
      active = false;
    };
  }, [client, userId, attempt]);

  return (
    <Section id="cuenta-reputacion" title={heading}>
      {load.state === 'loading' ? <div className="ac-account-busy" aria-busy="true" /> : null}
      {load.state === 'error' ? (
        <PageError
          error={load.error}
          locale={locale}
          retry={retry}
          dismiss={ui.dismiss}
          onRetry={() => setAttempt((value) => value + 1)}
        />
      ) : null}
      {load.state === 'ready' ? (
        <div className="ac-account-reputation">
          <ReputationBlock
            id="reputacion-vendedor"
            title={texts.reputation.asSeller}
            data={load.data.seller}
            counterparts={texts.reputation.buyers}
            locale={locale}
            texts={texts}
          />
          <ReputationBlock
            id="reputacion-comprador"
            title={texts.reputation.asBuyer}
            data={load.data.buyer}
            counterparts={texts.reputation.sellers}
            locale={locale}
            texts={texts}
          />
        </div>
      ) : null}
    </Section>
  );
}

function ReputationBlock({
  id,
  title,
  data,
  counterparts,
  locale,
  texts,
}: {
  id: string;
  title: string;
  data: SellerReputation | null;
  counterparts: MessageLeaf;
  locale: Locale;
  texts: ProfilePageTexts;
}) {
  const { reputation } = texts;
  const reviewed = data !== null && data.resenas > 0 && data.valoracion !== null;
  // «★ 4.8 · 50 operaciones · 5 compradores distintos» (9.15.4).
  const values = reviewed
    ? reputationValues(data, locale, {
        outOf: reputation.outOf,
        deals: reputation.deals,
        buyers: counterparts,
        noReviews: reputation.none,
      })
    : [];
  const top = reviewed ? Math.max(...data.distribucion.slice(1)) : 0;

  return (
    <section className="ac-panel-box ac-account-reputation__block" aria-labelledby={`${id}-t`}>
      <h3 id={`${id}-t`} className="ac-panel-box__title">
        {title}
      </h3>
      {reviewed ? (
        <>
          <p className="ac-account-reputation__score">
            {values.map((value, index) => (
              <span key={index}>
                {index > 0 ? (
                  <span className="ac-panel-sep" aria-hidden="true">
                    {' · '}
                  </span>
                ) : null}
                {value}
              </span>
            ))}
          </p>
          <dl className="ac-account-bars" aria-label={reputation.distribution}>
            {[5, 4, 3, 2, 1].map((stars) => {
              const n = data.distribucion[stars] ?? 0;
              return (
                <div key={stars} className="ac-account-bars__row">
                  <dt>{counted(reputation.stars, stars, locale)}</dt>
                  <dd>
                    <span className="ac-account-bars__track" aria-hidden="true">
                      <span
                        className="ac-account-bars__fill"
                        style={
                          { '--ac-share': `${top === 0 ? 0 : (n / top) * 100}%` } as CSSProperties
                        }
                      />
                    </span>
                    <span className="ac-account-bars__count">{formatInteger(n, locale)}</span>
                  </dd>
                </div>
              );
            })}
          </dl>
        </>
      ) : (
        <p className="ac-panel-muted">{reputation.none}</p>
      )}
    </section>
  );
}

// ------------------------------------------------------------------------------- reviews

/** `?resenas=hechas` and `?pagina=N` of the address. */
function readState(): { direction: ReviewDirection; page: number } {
  const params = new URLSearchParams(window.location.search);
  const n = Number(params.get('pagina'));
  return {
    direction: params.get('resenas') === 'hechas' ? 'given' : 'received',
    page: Number.isInteger(n) && n > 1 ? n : 1,
  };
}

function stateHref(direction: ReviewDirection, page: number): string {
  const params = new URLSearchParams(window.location.search);
  if (direction === 'given') params.set('resenas', 'hechas');
  else params.delete('resenas');
  if (page > 1) params.set('pagina', String(page));
  else params.delete('pagina');
  const query = params.toString();
  return `${window.location.pathname}${query === '' ? '' : `?${query}`}`;
}

function Reviews({ client, locale, ui, retry, texts }: ProfilePageProps) {
  const [state, setState] = useState(readState);
  const [load, setLoad] = useState<Load<{ reviews: MyReview[]; more: boolean }>>({
    state: 'loading',
  });
  const [attempt, setAttempt] = useState(0);
  const { direction, page } = state;
  const text = texts.reviews;

  useEffect(() => {
    const read = () => setState(readState());
    window.addEventListener('popstate', read);
    return () => window.removeEventListener('popstate', read);
  }, []);

  useEffect(() => {
    let active = true;
    setLoad({ state: 'loading' });
    void listMyReviews(client, direction, page - 1).then(({ data, error }) => {
      if (!active) return;
      if (error !== null || data === null) setLoad({ state: 'error', error });
      else setLoad({ state: 'ready', data });
    });
    return () => {
      active = false;
    };
  }, [client, direction, page, attempt]);

  function go(next: ReviewDirection, nextPage = 1) {
    setState({ direction: next, page: nextPage });
    window.history.pushState(window.history.state, '', stateHref(next, nextPage));
  }

  let list: ReactNode;
  if (load.state === 'loading') list = <div className="ac-account-busy" aria-busy="true" />;
  else if (load.state === 'error') {
    list = (
      <PageError
        error={load.error}
        locale={locale}
        retry={retry}
        dismiss={ui.dismiss}
        onRetry={() => setAttempt((value) => value + 1)}
      />
    );
  } else if (load.data.reviews.length === 0 && page === 1) {
    list = <EmptyState>{direction === 'received' ? text.noneReceived : text.noneGiven}</EmptyState>;
  } else {
    const { reviews, more } = load.data;
    list = (
      <>
        <ul className="ac-panel-list ac-account-reviews">
          {reviews.map((review) => (
            <li key={review.id} className="ac-account-review">
              <p className="ac-account-review__head">
                <strong className="ac-account-review__score">
                  {fill(text.score, { n: formatInteger(review.score, locale) })}
                </strong>
                <span className="ac-panel-sep" aria-hidden="true">
                  ·
                </span>
                {review.counterpart === null ? (
                  <span>{text.deletedAccount}</span>
                ) : (
                  <TextLink href={sellerHref(locale, review.counterpart)}>
                    {review.counterpart}
                  </TextLink>
                )}
                <span className="ac-panel-sep" aria-hidden="true">
                  ·
                </span>
                <span>{text.role[review.role]}</span>
                <span className="ac-panel-sep" aria-hidden="true">
                  ·
                </span>
                <span>{fill(text.deal, { number: operationNumber(review.number) })}</span>
                <span className="ac-panel-sep" aria-hidden="true">
                  ·
                </span>
                <time dateTime={review.createdAt}>{formatDate(review.createdAt, locale)}</time>
              </p>
              {review.hidden ? <Chip>{text.hidden}</Chip> : null}
              {review.comment === null ? null : (
                <p className="ac-account-review__comment">{review.comment}</p>
              )}
              {review.editable ? (
                <Button href={pageHref('operaciones', locale)}>{text.edit}</Button>
              ) : null}
            </li>
          ))}
        </ul>
        <Pagination
          page={page}
          pageCount={more ? page + 1 : page}
          hrefFor={(n) => stateHref(direction, n)}
          onPage={(n, event) => {
            event.preventDefault();
            go(direction, n);
          }}
          labels={texts.pages}
          ariaLabel={texts.pagination}
        />
      </>
    );
  }

  return (
    <Section id="cuenta-resenas" title={text.title}>
      <ToggleGroup
        label={text.filterLabel}
        value={direction === 'given' ? 'hechas' : 'recibidas'}
        options={[
          { value: 'recibidas', label: text.received },
          { value: 'hechas', label: text.given },
        ]}
        onChange={(value) => go(value === 'hechas' ? 'given' : 'received')}
      />
      {list}
    </Section>
  );
}
