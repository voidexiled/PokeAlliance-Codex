import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';

import { CardGrid } from '@/components/cards/CardGrid';
import { CardGroup } from '@/components/cards/CardGroup';
import { ListingCard } from '@/components/cards/ListingCard';
import type { ListingCardLabels, ListingCardListing } from '@/components/cards/ListingCard';
import { Chip } from '@/components/content/Chip';
import { EmptyState } from '@/components/content/EmptyState';
import { Notice } from '@/components/content/Notice';
import { Button } from '@/components/controls/Button';
import { Pagination } from '@/components/controls/Pagination';
import type { PaginationLabels } from '@/components/controls/Pagination';
import { ToggleGroup } from '@/components/controls/ToggleGroup';
import type { SpriteProps } from '@/components/game/Sprite';
import { Section } from '@/components/layout/Section';
import { decodeItems, decodeItemsRefs } from '@/components/items/config';
import { decodePokedex, decodeRefs } from '@/components/pokedex/config';
import { previewListing } from '@/components/trade/ListingPreview';
import type {
  ListingPreviewData,
  ListingPreviewDiamonds,
  ListingPreviewSprites,
} from '@/components/trade/ListingPreview';
import { reputationValues } from '@/components/trade/SellerCard';
import type { Locale } from '@/i18n/config';
import { fill, isPluralMessage, plural } from '@/i18n/messages/types';
import type { MessageLeaf } from '@/i18n/messages/types';
import { identityAvatar } from '@/lib/account/registration';
import { writeCachedAccount } from '@/lib/account/session-cache';
import { listingLayout, trackCount } from '@/lib/cards/layout';
import { formatDate, formatRelative } from '@/lib/format/dates';
import { formatInteger } from '@/lib/format/numbers';
import type { TipLabels } from '@/lib/game/tips';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { mapSupabaseError } from '@/lib/supabase/errors';
import type { SupabaseFailure } from '@/lib/supabase/errors';
import {
  cachedAccountFrom,
  getBuyerReputation,
  getSellerReputation,
  listMyListings,
  listMyReviews,
  listMyTransactions,
  refreshCachedAccount,
  setListingStatus,
  setPresenceState,
  summarizeTransactions,
} from '@/lib/supabase/trade';
import type { AccountSummary, MyReview, ReviewDirection } from '@/lib/supabase/trade';
import { ESTADOS_PRESENCIA } from '@/lib/trade/limits';
import type { EstadoPresencia } from '@/lib/trade/limits';
import { ESTADOS_ANUNCIO, TIPOS_ACTIVO, visibleStatus } from '@/lib/trade/types';
import type { Anuncio, EstadoAnuncio, SellerReputation, TipoActivo } from '@/lib/trade/types';

// «Mi perfil» (spec 9.16.3; 9.15.4, 9.15.6, 9.7.8): the island of `/{l}/cuenta/perfil/`. There is
// no board for it: the blocks are design-system components and tokens (R16), laid out by
// profile-hub.css.
//
// - Until the session is known the island paints nothing and carries `aria-busy` (9.9). Without
//   a session: the Notice «Inicia sesión para ver tu perfil.» and «Iniciar sesión». With an
//   unfinished registration: the «Completar registro» button to the account page.
// - The header card: avatar, username, «{jugador} · {mundo}», the country by its name
//   (`Intl.DisplayNames`), «Miembro desde 09/2026», the linked identities as chips and, with
//   COMERCIO_PUBLICO, the status `ToggleGroup` of 9.15.6, which writes the header cache too, so
//   the chip of the header changes at once. Actions: «Editar perfil» (the «Perfil» section of the
//   account page) and «Ver perfil público» (Comercio) or «Mis guilds» (without Comercio).
// - With COMERCIO_PUBLICO, the reputation as seller and as buyer (9.15.4) with the 1 to 5
//   distribution, and four tabs whose choice lives in `?pestana=`:
//     «Anuncios»: every own listing, newest first, filtered by state with the count of each; the
//       cards of 9.5.8 (`ListingCard`, one `CardGroup` per asset type) built with the preview
//       builder of the publish page from the two PR5 data files, and under each card its state and
//       the actions 9.7.8 allows in it. «Editar» waits for the composer of the next milestone.
//     «Reseñas recibidas» and «Reseñas hechas»: 10 a page (`?pagina=`); a review the account
//       wrote still in its edit window links to «Mis operaciones», where the deal is edited.
//     «Operaciones»: the pending and confirmed counts and the link to «Mis operaciones».
// - Every call goes through src/lib/supabase/trade.ts; the database decides every permission.
//   A failure is a Notice with `mapSupabaseError` and «Reintentar».

type Tab = 'anuncios' | 'recibidas' | 'hechas' | 'operaciones';

const TABS: readonly Tab[] = ['anuncios', 'recibidas', 'hechas', 'operaciones'];

/** The value of the state filter that keeps every listing. */
const ALL = 'todos';

/** A listing state the seller sets (9.7.8). */
type SetStatus = Exclude<EstadoAnuncio, 'expirado'>;

/** The actions of 9.7.8 by the state a listing is shown in. */
type ActionKey = 'reserve' | 'release' | 'complete' | 'withdraw' | 'renew';

const ACTIONS: Readonly<Record<EstadoAnuncio, readonly (readonly [ActionKey, SetStatus])[]>> = {
  publicado: [
    ['reserve', 'reservado'],
    ['complete', 'completado'],
    ['withdraw', 'retirado'],
  ],
  reservado: [
    ['release', 'publicado'],
    ['complete', 'completado'],
    ['withdraw', 'retirado'],
  ],
  expirado: [['renew', 'publicado']],
  completado: [],
  retirado: [],
};

/** Cards from this index on load their art lazily (7.4.2). */
const EAGER_CARDS = 4;

/** Every text of the island (DP1), gathered by the page from the dictionary. */
export interface ProfileHubMessages {
  /** «Inicia sesión para ver tu perfil.» */
  signInNotice: string;
  /** «Iniciar sesión». */
  signIn: string;
  /** «Registro sin terminar». */
  unfinished: string;
  /** «Completar registro». */
  finish: string;
  /** «Reintentar». */
  retry: string;
  /** «Miembro desde {date}». */
  memberSince: string;
  /** «País», before the country's name. */
  country: string;
  /** Accessible name of the list of linked identities: «Cuentas vinculadas». */
  identities: string;
  /** The chip of each linked identity. */
  providers: { discord: string; google: string; twitch: string };
  /** «Editar perfil». */
  editProfile: string;
  /** «Ver perfil público». */
  publicProfile: string;
  /** «Mis guilds». */
  guilds: string;
  /** The status `ToggleGroup` (9.15.6): its name and one label per state. */
  presence: { label: string } & Record<EstadoPresencia, string>;
  reputation: {
    /** «Reputación», the heading of the two blocks. */
    title: string;
    /** «Como vendedor». */
    asSeller: string;
    /** «Como comprador». */
    asBuyer: string;
    /** `ui.money.outOf`: «de 5», after the score. */
    outOf: string;
    /** «{n} operación» / «{n} operaciones». */
    deals: MessageLeaf;
    /** «{n} comprador distinto» / «{n} compradores distintos». */
    buyers: MessageLeaf;
    /** «{n} vendedor distinto» / «{n} vendedores distintos». */
    sellers: MessageLeaf;
    /** «Sin reseñas todavía.» */
    none: string;
    /** Name of the distribution: «Reseñas por puntuación». */
    distribution: string;
    /** «{n} estrella» / «{n} estrellas». */
    stars: MessageLeaf;
  };
  tabs: { label: string } & Record<Tab, string>;
  listings: {
    /** Name of the state filter: «Estado del anuncio». */
    filter: string;
    /** «Todos». */
    all: string;
    /** The filter options: «Publicados», «Reservados»… */
    states: Record<EstadoAnuncio, string>;
    /** The state under a card that is not published: «Reservado», «Expirado»… */
    state: Record<Exclude<EstadoAnuncio, 'publicado'>, string>;
    /** «Aún no publicaste anuncios.» */
    none: string;
    /** «Ningún anuncio en este estado.» */
    noneInState: string;
    /** «Crear anuncio». */
    create: string;
    /** The actions of 9.7.8. */
    actions: Record<ActionKey, string>;
    /** The name of each asset type, the title of its group. */
    types: Record<TipoActivo, string>;
  };
  reviews: {
    /** «{n} de 5». */
    score: string;
    /** «como vendedor» / «como comprador»: the account's role in the deal. */
    role: { seller: string; buyer: string };
    /** «Operación {number}». */
    deal: string;
    /** «Editar». */
    edit: string;
    /** «Oculta por moderación». */
    hidden: string;
    /** «Cuenta eliminada»: a counterpart whose account no longer exists. */
    deletedAccount: string;
    /** «Aún no recibiste reseñas.» */
    noneReceived: string;
    /** «Aún no hiciste reseñas.» */
    noneGiven: string;
  };
  deals: {
    /** «{n} operación pendiente» / «{n} operaciones pendientes». */
    pending: MessageLeaf;
    /** «{n} operación confirmada» / «{n} operaciones confirmadas». */
    confirmed: MessageLeaf;
    /** «Ver mis operaciones». */
    link: string;
  };
}

/** The leaves of `ui` the island reads (13.2). */
export interface ProfileHubUi {
  dismiss: string;
  dataError: string;
  pagination: string;
  pages: PaginationLabels;
  pinHint: string;
  or: string;
  tooltip: TipLabels;
}

/** What the cards of the own listings are built from (9.7.6), only with COMERCIO_PUBLICO. */
export interface ProfileListingsData {
  /** `/{l}/pokedex/datos.json` (PR5). */
  pokedexUrl: string;
  /** `/{l}/items/datos.json` (PR5). */
  itemsUrl: string;
  /** `nombre` of each Market category, by id. */
  categories: Readonly<Record<string, string>>;
  /** `nombre` of each aura, by id. */
  auras: Readonly<Record<string, string>>;
  sprites: ListingPreviewSprites;
  diamonds: ListingPreviewDiamonds;
  /** The sprite of each asset type, beside the title of its group (DP2). */
  typeSprites: Readonly<Record<TipoActivo, SpriteProps | null>>;
  /** Every text of `ListingCard`. */
  card: ListingCardLabels;
  /** «Unsellable», a game term. */
  unsellable: string;
}

export interface ProfileHubProps {
  locale: Locale;
  /** COMERCIO_PUBLICO of the build. */
  comercio: boolean;
  /** `nombre` of each world of content/mundos.json, by id. */
  worlds: Readonly<Record<string, string>>;
  messages: ProfileHubMessages;
  ui: ProfileHubUi;
  listings: ProfileListingsData | null;
}

// ------------------------------------------------------------------------------ helpers

type Load<T> =
  { state: 'loading' } | { state: 'error'; error: unknown } | { state: 'ready'; data: T };

function counted(template: MessageLeaf, n: number, locale: Locale): string {
  const chosen = isPluralMessage(template) ? plural(locale, n, template) : template;
  return fill(chosen, { n: formatInteger(n, locale) });
}

function operationNumber(value: number): string {
  return `OP-${String(Math.trunc(value)).padStart(6, '0')}`;
}

function initialOf(name: string | null): string {
  const first = name?.trim().codePointAt(0);
  return first === undefined ? '' : String.fromCodePoint(first).toLocaleUpperCase();
}

function countryName(code: string | null, locale: Locale): string | null {
  if (code === null) return null;
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

function readParam(name: string): string | null {
  return new URLSearchParams(window.location.search).get(name);
}

function isTab(value: string | null): value is Tab {
  return TABS.includes(value as Tab);
}

/** The URL of the page with `pestana` (and `pagina` above 1). */
function tabHref(tab: Tab, page = 1): string {
  const params = new URLSearchParams(window.location.search);
  params.set('pestana', tab);
  if (page > 1) params.set('pagina', String(page));
  else params.delete('pagina');
  return `${window.location.pathname}?${params.toString()}`;
}

function ErrorNotice({
  error,
  locale,
  retry,
  dismiss,
  onRetry,
}: {
  error: unknown;
  locale: Locale;
  retry: string;
  dismiss: string;
  onRetry: () => void;
}) {
  return (
    <Notice closeLabel={dismiss}>
      {mapSupabaseError(error, locale)}{' '}
      <Button className="ac-profile__retry" onClick={onRetry}>
        {retry}
      </Button>
    </Notice>
  );
}

// ---------------------------------------------------------------------------- the island

export function ProfileHub(props: ProfileHubProps) {
  const { locale, messages, ui } = props;
  // `undefined` while supabase-js loads (client.ts loads it on demand, D-025).
  const [client, setClient] = useState<SupabaseClient | null | undefined>(undefined);
  // `undefined` while the session is unknown, `null` without one.
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [failure, setFailure] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (client !== undefined) return undefined;
    let active = true;
    getSupabaseBrowserClient().then(
      (loaded) => {
        if (active) setClient(loaded);
      },
      (error: unknown) => {
        if (active) setFailure(error);
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
    setFailure(null);
    client.auth.getSession().then(
      ({ data, error }) => {
        if (!active) return;
        if (error) setFailure(error);
        else setSession(data.session);
      },
      (error: unknown) => {
        if (active) setFailure(error);
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

  const accountHref = `/${locale}/cuenta/`;
  const busy = (client === undefined || session === undefined) && failure === null;

  let body: ReactNode = null;
  if (failure !== null) {
    body = (
      <ErrorNotice
        error={failure}
        locale={locale}
        retry={messages.retry}
        dismiss={ui.dismiss}
        onRetry={() => {
          setFailure(null);
          setAttempt((value) => value + 1);
        }}
      />
    );
  } else if (client !== undefined && session !== undefined) {
    body =
      client === null || session === null ? (
        <div className="ac-profile__signed-out">
          <Notice closeLabel={ui.dismiss}>{messages.signInNotice}</Notice>
          <Button href={accountHref}>{messages.signIn}</Button>
        </div>
      ) : (
        <SignedIn key={session.user.id} client={client} user={session.user} {...props} />
      );
  }

  return (
    <div className="ac-profile" aria-busy={busy ? 'true' : undefined}>
      {body}
    </div>
  );
}

// ------------------------------------------------------------------------------ signed in

interface SignedInProps extends ProfileHubProps {
  client: SupabaseClient;
  user: User;
}

function SignedIn(props: SignedInProps) {
  const { client, user, locale, comercio, messages, ui } = props;
  const [account, setAccount] = useState<Load<AccountSummary | null>>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setAccount({ state: 'loading' });
    // `refreshCachedAccount` also writes the header cache (9.16.4) and ends on this browser a
    // session the server no longer accepts; an unfinished registration answers no summary.
    void refreshCachedAccount(client).then(({ data, error }) => {
      if (!active) return;
      if (error !== null) setAccount({ state: 'error', error });
      else setAccount({ state: 'ready', data });
    });
    return () => {
      active = false;
    };
  }, [client, user, attempt]);

  if (account.state === 'loading') return <div aria-busy="true" />;
  if (account.state === 'error') {
    return (
      <ErrorNotice
        error={account.error}
        locale={locale}
        retry={messages.retry}
        dismiss={ui.dismiss}
        onRetry={() => setAttempt((value) => value + 1)}
      />
    );
  }

  const summary = account.data;
  if (summary === null || !summary.registrationComplete || summary.username === null) {
    return (
      <EmptyState action={<Button href={`/${locale}/cuenta/`}>{messages.finish}</Button>}>
        {messages.unfinished}
      </EmptyState>
    );
  }

  return (
    <>
      <HeaderCard
        {...props}
        summary={summary}
        onPresence={(presence) => setAccount({ state: 'ready', data: { ...summary, presence } })}
      />
      {comercio ? (
        <>
          <Reputation
            client={client}
            userId={user.id}
            locale={locale}
            messages={messages}
            ui={ui}
          />
          <Tabs {...props} handle={summary.username} />
        </>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------- header card

interface HeaderCardProps extends SignedInProps {
  summary: AccountSummary;
  onPresence: (presence: EstadoPresencia) => void;
}

const PROVIDERS = ['discord', 'google', 'twitch'] as const;

function HeaderCard({
  client,
  user,
  locale,
  comercio,
  worlds,
  messages,
  ui,
  summary,
  onPresence,
}: HeaderCardProps) {
  const [presenceError, setPresenceError] = useState<SupabaseFailure | null>(null);
  const avatar = identityAvatar(user.identities);
  const world = summary.world === null ? null : (worlds[summary.world] ?? summary.world);
  const player = [summary.player, world].filter((part) => part !== null).join(' · ');
  const since =
    summary.memberSince === null
      ? null
      : fill(messages.memberSince, { date: formatDate(summary.memberSince, 'es').slice(3) });
  const country = countryName(summary.country, locale);
  const facts = [country === null ? null : `${messages.country}: ${country}`, since].filter(
    (part) => part !== null,
  );
  const providers = new Set((user.identities ?? []).map((identity) => identity.provider));
  const linked = PROVIDERS.filter((provider) => providers.has(provider));
  const presence = summary.presence ?? 'desconectado';

  async function choose(value: string) {
    const next = ESTADOS_PRESENCIA.find((state) => state === value);
    if (next === undefined) return;
    const previous = summary.presence;
    setPresenceError(null);
    onPresence(next);
    writeCachedAccount(cachedAccountFrom(user.id, { ...summary, presence: next }, user.identities));
    const { error } = await setPresenceState(client, next);
    if (error !== null) {
      setPresenceError(error);
      if (previous !== null) onPresence(previous);
      writeCachedAccount(cachedAccountFrom(user.id, summary, user.identities));
    }
  }

  return (
    <div className="ac-profile__card">
      <div className="ac-profile__identity">
        <span className="ac-profile__avatar" aria-hidden="true">
          {avatar === null ? initialOf(summary.username) : <img src={avatar} alt="" />}
        </span>
        <div className="ac-profile__who">
          <h2 className="ac-profile__name">{summary.username}</h2>
          {player === '' ? null : <p className="ac-profile__line">{player}</p>}
          {facts.length === 0 ? null : <p className="ac-profile__line">{facts.join(' · ')}</p>}
          {linked.length === 0 ? null : (
            <ul className="ac-profile__chips" aria-label={messages.identities}>
              {linked.map((provider) => (
                <li key={provider}>
                  <Chip>{messages.providers[provider]}</Chip>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {comercio ? (
        <div className="ac-profile__presence">
          <ToggleGroup
            label={messages.presence.label}
            labelHidden={false}
            value={presence}
            options={ESTADOS_PRESENCIA.map((state) => ({
              value: state,
              label: messages.presence[state],
            }))}
            onChange={(value) => void choose(value)}
          />
          {presenceError === null ? null : (
            <Notice closeLabel={ui.dismiss} onClose={() => setPresenceError(null)} open>
              {mapSupabaseError(presenceError, locale)}
            </Notice>
          )}
        </div>
      ) : null}
      <div className="ac-profile__actions">
        <Button href={`/${locale}/cuenta/#perfil`}>{messages.editProfile}</Button>
        {comercio ? (
          <Button
            href={`/${locale}/comercio/vendedor/${encodeURIComponent(summary.username ?? '')}/`}
          >
            {messages.publicProfile}
          </Button>
        ) : (
          <Button href={`/${locale}/cuenta/#guilds`}>{messages.guilds}</Button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------- reputation

interface ReputationProps {
  client: SupabaseClient;
  userId: string;
  locale: Locale;
  messages: ProfileHubMessages;
  ui: ProfileHubUi;
}

function Reputation({ client, userId, locale, messages, ui }: ReputationProps) {
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

  if (load.state === 'loading') return <div className="ac-profile__reputation" aria-busy="true" />;
  if (load.state === 'error') {
    return (
      <ErrorNotice
        error={load.error}
        locale={locale}
        retry={messages.retry}
        dismiss={ui.dismiss}
        onRetry={() => setAttempt((value) => value + 1)}
      />
    );
  }

  const { reputation } = messages;
  return (
    <Section id="reputacion" title={reputation.title}>
      <div className="ac-profile__reputation">
        <ReputationBlock
          id="reputacion-vendedor"
          title={reputation.asSeller}
          data={load.data.seller}
          counterparts={reputation.buyers}
          locale={locale}
          messages={messages}
        />
        <ReputationBlock
          id="reputacion-comprador"
          title={reputation.asBuyer}
          data={load.data.buyer}
          counterparts={reputation.sellers}
          locale={locale}
          messages={messages}
        />
      </div>
    </Section>
  );
}

function ReputationBlock({
  id,
  title,
  data,
  counterparts,
  locale,
  messages,
}: {
  id: string;
  title: string;
  data: SellerReputation | null;
  counterparts: MessageLeaf;
  locale: Locale;
  messages: ProfileHubMessages;
}) {
  const { reputation } = messages;
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
    <section className="ac-profile__block" aria-labelledby={`${id}-t`}>
      <h3 id={`${id}-t`} className="ac-profile__block-title">
        {title}
      </h3>
      {reviewed ? (
        <>
          <p className="ac-profile__score">
            {values.map((value, index) => (
              <span key={index}>
                {index > 0 ? ' · ' : null}
                {value}
              </span>
            ))}
          </p>
          <dl className="ac-profile__bars" aria-label={reputation.distribution}>
            {[5, 4, 3, 2, 1].map((stars) => {
              const n = data.distribucion[stars] ?? 0;
              return (
                <div key={stars} className="ac-profile__bar">
                  <dt>{counted(reputation.stars, stars, locale)}</dt>
                  <dd>
                    <span
                      className="ac-profile__bar-fill"
                      aria-hidden="true"
                      style={
                        { '--ac-share': `${top === 0 ? 0 : (n / top) * 100}%` } as CSSProperties
                      }
                    />
                    <span className="ac-profile__bar-count">{formatInteger(n, locale)}</span>
                  </dd>
                </div>
              );
            })}
          </dl>
        </>
      ) : (
        <p className="ac-profile__line">{reputation.none}</p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------------- tabs

interface TabsProps extends SignedInProps {
  /** The account's username, the seller of its listings. */
  handle: string;
}

function Tabs(props: TabsProps) {
  const { messages } = props;
  const [tab, setTab] = useState<Tab>('anuncios');
  const [page, setPage] = useState(1);

  // The state of the URL (7.7.2): `?pestana=` and, on the review tabs, `?pagina=`.
  useEffect(() => {
    const read = () => {
      const wanted = readParam('pestana');
      setTab(isTab(wanted) ? wanted : 'anuncios');
      const n = Number(readParam('pagina'));
      setPage(Number.isInteger(n) && n > 1 ? n : 1);
    };
    read();
    window.addEventListener('popstate', read);
    return () => window.removeEventListener('popstate', read);
  }, []);

  function go(next: Tab, nextPage = 1) {
    setTab(next);
    setPage(nextPage);
    window.history.pushState(null, '', tabHref(next, nextPage));
  }

  return (
    <div className="ac-profile__tabs">
      <ToggleGroup
        variant="tab"
        label={messages.tabs.label}
        value={tab}
        options={TABS.map((value) => ({ value, label: messages.tabs[value] }))}
        onChange={(value) => {
          if (isTab(value)) go(value);
        }}
      />
      <div className="ac-profile__panel">
        {tab === 'anuncios' ? <ListingsPanel {...props} /> : null}
        {tab === 'recibidas' || tab === 'hechas' ? (
          <ReviewsPanel
            key={tab}
            {...props}
            direction={tab === 'recibidas' ? 'received' : 'given'}
            page={page}
            onPage={(n) => go(tab, n)}
          />
        ) : null}
        {tab === 'operaciones' ? <DealsPanel {...props} /> : null}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------ listings

/** The two data files the cards read, fetched once per page (PR5). */
function useCatalogue(data: ProfileListingsData | null, wanted: boolean) {
  const [catalogue, setCatalogue] = useState<Load<Omit<ListingPreviewData, 'worlds'>>>({
    state: 'loading',
  });
  useEffect(() => {
    if (!wanted || data === null) return undefined;
    let active = true;
    const read = (url: string) =>
      fetch(url).then((response) => {
        if (!response.ok) throw new Error(`${url}: ${response.status}`);
        return response.json() as Promise<unknown>;
      });
    Promise.all([read(data.pokedexUrl), read(data.itemsUrl)]).then(
      ([pokedex, items]) => {
        if (!active) return;
        setCatalogue({
          state: 'ready',
          data: {
            pokemon: new Map(decodePokedex(pokedex).map((row) => [row.id, row])),
            elements: decodeRefs(pokedex).elementos,
            items: new Map(decodeItems(items).map((row) => [row.id, row])),
            itemRefs: decodeItemsRefs(items),
            categories: data.categories,
            auras: data.auras,
            sprites: data.sprites,
            diamonds: data.diamonds,
          },
        });
      },
      (error: unknown) => {
        if (active) setCatalogue({ state: 'error', error });
      },
    );
    return () => {
      active = false;
    };
  }, [data, wanted]);
  return catalogue;
}

interface OwnListing {
  anuncio: Anuncio;
  /** The state it is shown in: `publicado` or `reservado` past `expira` are `expirado` (9.7.8). */
  state: EstadoAnuncio;
  card: ListingCardListing;
}

function ListingsPanel({
  client,
  user,
  handle,
  locale,
  worlds,
  messages,
  ui,
  listings,
}: TabsProps) {
  const [load, setLoad] = useState<Load<Anuncio[]>>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [filter, setFilter] = useState<string>(ALL);
  const [pending, setPending] = useState<string | null>(null);
  const [actionError, setActionError] = useState<SupabaseFailure | null>(null);
  const hasListings = load.state === 'ready' && load.data.length > 0;
  const catalogue = useCatalogue(listings, hasListings);
  // The moment the list was read: states and «hace 12 min» are relative to it.
  const [now, setNow] = useState(() => Date.now());

  const reload = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    setLoad({ state: 'loading' });
    void listMyListings(client, { userId: user.id, handle }).then(({ data, error }) => {
      if (!active) return;
      setNow(Date.now());
      if (error !== null || data === null) setLoad({ state: 'error', error });
      else setLoad({ state: 'ready', data });
    });
    return () => {
      active = false;
    };
  }, [client, user.id, handle, attempt]);

  const own = useMemo<OwnListing[] | null>(() => {
    if (load.state !== 'ready' || catalogue.state !== 'ready' || listings === null) return null;
    const data: ListingPreviewData = { ...catalogue.data, worlds };
    const labels = {
      card: listings.card,
      tooltip: ui.tooltip,
      now: '',
      unsellable: listings.unsellable,
    };
    return load.data.flatMap((anuncio) => {
      const card = previewListing(
        { draft: anuncio, data, labels, locale, hint: ui.pinHint, orLabel: ui.or },
        {
          datetime: anuncio.publicado,
          text: formatRelative(anuncio.publicado, locale, new Date(now)),
        },
      );
      if (card === null) return [];
      const state = visibleStatus(anuncio, now);
      return [
        {
          anuncio,
          state,
          card: {
            ...card,
            href:
              anuncio.estado === 'retirado'
                ? undefined
                : `/${locale}/comercio/anuncio/${encodeURIComponent(anuncio.id)}/`,
            reserved: state === 'reservado',
          },
        },
      ];
    });
  }, [load, catalogue, listings, worlds, locale, ui, now]);

  async function act(listing: OwnListing, status: SetStatus) {
    setPending(listing.anuncio.id);
    setActionError(null);
    const { error } = await setListingStatus(client, listing.anuncio.id, status);
    setPending(null);
    if (error !== null) setActionError(error);
    else reload();
  }

  if (listings === null) return null;
  if (load.state === 'loading') return <div aria-busy="true" />;
  if (load.state === 'error') {
    return (
      <ErrorNotice
        error={load.error}
        locale={locale}
        retry={messages.retry}
        dismiss={ui.dismiss}
        onRetry={reload}
      />
    );
  }

  const create = <Button href={`/${locale}/comercio/publicar/`}>{messages.listings.create}</Button>;
  if (load.data.length === 0) {
    return <EmptyState action={create}>{messages.listings.none}</EmptyState>;
  }
  if (catalogue.state === 'loading') return <div aria-busy="true" />;
  if (catalogue.state === 'error' || own === null) {
    return <Notice closeLabel={ui.dismiss}>{ui.dataError}</Notice>;
  }

  const counts = new Map<EstadoAnuncio, number>();
  for (const listing of own) counts.set(listing.state, (counts.get(listing.state) ?? 0) + 1);
  const shown = own.filter((listing) => filter === ALL || listing.state === filter);
  const text = messages.listings;

  return (
    <div className="ac-profile__listings">
      <ToggleGroup
        label={text.filter}
        value={filter}
        options={[
          { value: ALL, label: countLabel(text.all, own.length, locale) },
          ...ESTADOS_ANUNCIO.map((state) => ({
            value: state,
            label: countLabel(text.states[state], counts.get(state) ?? 0, locale),
          })),
        ]}
        onChange={setFilter}
      />
      {actionError === null ? null : (
        <Notice closeLabel={ui.dismiss} open onClose={() => setActionError(null)}>
          {mapSupabaseError(actionError, locale)}
        </Notice>
      )}
      {shown.length === 0 ? (
        <EmptyState>{text.noneInState}</EmptyState>
      ) : (
        TIPOS_ACTIVO.map((tipo) => {
          const group = shown.filter((listing) => listing.card.type === tipo);
          if (group.length === 0) return null;
          const layout = listingLayout(group.map((listing) => listing.card));
          const span = trackCount('listing', layout) + 1;
          return (
            <CardGroup
              key={tipo}
              label={text.types[tipo]}
              count={group.length}
              sprite={listings.typeSprites[tipo]}
              level={2}
              locale={locale}
            >
              <CardGrid family="listing">
                {group.map((listing, index) => (
                  <div
                    key={listing.anuncio.id}
                    className="ac-profile-listing"
                    style={{ gridRow: `span ${span}` }}
                  >
                    <ListingCard
                      listing={listing.card}
                      layout={layout}
                      labels={listings.card}
                      locale={locale}
                      hint={ui.pinHint}
                      orLabel={ui.or}
                      diamonds={{ tip: listings.diamonds.tip }}
                      loading={index < EAGER_CARDS ? 'eager' : 'lazy'}
                    />
                    <div className="ac-profile-listing__actions">
                      {listing.state === 'publicado' ? null : (
                        <Chip>{text.state[listing.state]}</Chip>
                      )}
                      {ACTIONS[listing.state].map(([key, status]) => (
                        <Button
                          key={key}
                          disabled={pending !== null}
                          onClick={() => void act(listing, status)}
                        >
                          {text.actions[key]}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </CardGrid>
            </CardGroup>
          );
        })
      )}
    </div>
  );
}

/** «Publicados 3»: the option of a filter with its count. */
function countLabel(label: string, n: number, locale: Locale): ReactNode {
  return (
    <>
      {label} <span className="ac-profile__count">{formatInteger(n, locale)}</span>
    </>
  );
}

// ------------------------------------------------------------------------------- reviews

interface ReviewsPanelProps extends TabsProps {
  direction: ReviewDirection;
  /** From 1. */
  page: number;
  onPage: (page: number) => void;
}

function ReviewsPanel({
  client,
  locale,
  messages,
  ui,
  direction,
  page,
  onPage,
}: ReviewsPanelProps) {
  const [load, setLoad] = useState<Load<{ reviews: MyReview[]; more: boolean }>>({
    state: 'loading',
  });
  const [attempt, setAttempt] = useState(0);

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

  if (load.state === 'loading') return <div aria-busy="true" />;
  if (load.state === 'error') {
    return (
      <ErrorNotice
        error={load.error}
        locale={locale}
        retry={messages.retry}
        dismiss={ui.dismiss}
        onRetry={() => setAttempt((value) => value + 1)}
      />
    );
  }

  const text = messages.reviews;
  const { reviews, more } = load.data;
  if (reviews.length === 0 && page === 1) {
    return <EmptyState>{direction === 'received' ? text.noneReceived : text.noneGiven}</EmptyState>;
  }
  const tab: Tab = direction === 'received' ? 'recibidas' : 'hechas';

  return (
    <div className="ac-profile__reviews">
      {reviews.map((review) => (
        <article key={review.id} className="ac-profile-review">
          <p className="ac-profile-review__head">
            <strong>{fill(text.score, { n: formatInteger(review.score, locale) })}</strong>
            {' · '}
            {review.counterpart ?? text.deletedAccount}
            {' · '}
            {text.role[review.role]}
            {' · '}
            {fill(text.deal, { number: operationNumber(review.number) })}
            {' · '}
            <time dateTime={review.createdAt}>{formatDate(review.createdAt, locale)}</time>
          </p>
          {review.hidden ? <Chip>{text.hidden}</Chip> : null}
          {review.comment === null ? null : (
            <p className="ac-profile-review__comment">{review.comment}</p>
          )}
          {review.editable ? (
            <Button href={`/${locale}/comercio/operaciones/`}>{text.edit}</Button>
          ) : null}
        </article>
      ))}
      <Pagination
        page={page}
        pageCount={more ? page + 1 : page}
        hrefFor={(n) => tabHref(tab, n)}
        onPage={(n, event) => {
          event.preventDefault();
          onPage(n);
        }}
        labels={ui.pages}
        ariaLabel={messages.tabs[tab]}
      />
    </div>
  );
}

// --------------------------------------------------------------------------------- deals

function DealsPanel({ client, locale, messages, ui }: TabsProps) {
  const [load, setLoad] = useState<Load<{ pending: number; confirmed: number }>>({
    state: 'loading',
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoad({ state: 'loading' });
    void listMyTransactions(client).then(({ data, error }) => {
      if (!active) return;
      if (error !== null || data === null) setLoad({ state: 'error', error });
      else setLoad({ state: 'ready', data: summarizeTransactions(data) });
    });
    return () => {
      active = false;
    };
  }, [client, attempt]);

  if (load.state === 'loading') return <div aria-busy="true" />;
  if (load.state === 'error') {
    return (
      <ErrorNotice
        error={load.error}
        locale={locale}
        retry={messages.retry}
        dismiss={ui.dismiss}
        onRetry={() => setAttempt((value) => value + 1)}
      />
    );
  }

  const text = messages.deals;
  return (
    <div className="ac-profile__deals">
      <p className="ac-profile__line">{counted(text.pending, load.data.pending, locale)}</p>
      <p className="ac-profile__line">{counted(text.confirmed, load.data.confirmed, locale)}</p>
      <Button href={`/${locale}/comercio/operaciones/`}>{text.link}</Button>
    </div>
  );
}
