import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';

import type { Locale } from '@/i18n/config';
import { clearCachedAccount } from '@/lib/account/session-cache';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { mapSupabaseError } from '@/lib/supabase/errors';
import { refreshCachedAccount, type AccountSummary } from '@/lib/supabase/trade';

import { EmptyState } from '@/components/content/EmptyState';
import { Button } from '@/components/controls/Button';

import type { AccountWorld, UiLabels } from './AccountPanel';
import { AccountFrame, useWide, type FrameTexts } from './panel/AccountFrame';
import { availableEntries, pageHref, visibleGroups } from './panel/model';
import { ErrorNotice } from './panel/notices';
import type { AccountPageBody, PageContext } from './pages/types';

// The island of the Comercio pages of the account (spec 9.16.3, 9.10; Cuenta-panel.dc.html):
// «Mi perfil» (`/{l}/cuenta/perfil/`), «Mis anuncios» (`/{l}/cuenta/anuncios/`) and «Mis
// operaciones» (`/{l}/cuenta/operaciones/`). Each is drawn in the frame of `/{l}/cuenta/`
// (AccountFrame.tsx: the header card and the section nav, where the page is the current entry),
// so the header menu's «Mi perfil», «Mis anuncios», «Mis operaciones» and «Ajustes de la cuenta»
// all open the one interface.
//
// - Until the session and the account are known the region paints nothing and carries
//   `aria-busy` (9.9). Without a session: the page's line and «Iniciar sesión»; with an
//   unfinished registration: «Completar registro»; under 18, by the stored birth date, the line
//   of 9.15.2 and the link back to the account.
// - The account is read with `refreshCachedAccount`, which also writes the header cache (9.16.4).
// - The body of each page is a chunk of its own, loaded on mount beside supabase-js (13.6).
// - «Mi perfil» once had tabs in `?pestana=`: an old link goes on to the page that has it now.

const loaders = {
  reputacion: () => import('./pages/ProfilePage'),
  anuncios: () => import('./pages/ListingsPage'),
  operaciones: () => import('./pages/OperationsPage'),
} as const;

const ProfilePage = lazy(loaders.reputacion);
const ListingsPage = lazy(loaders.anuncios);
const OperationsPage = lazy(loaders.operaciones);

export interface AccountPageTexts {
  /** The page's line without a session: «Inicia sesión para ver tu perfil.» */
  signInNotice: string;
  /** «Iniciar sesión». */
  signIn: string;
  /** «Registro sin terminar». */
  unfinished: string;
  /** «Completar registro». */
  finish: string;
  /** «Reintentar». */
  retry: string;
  /** 9.15.2: «Comercio es solo para mayores de 18 años.» */
  adultsOnly: string;
}

export interface AccountPageProps {
  locale: Locale;
  /** content/mundos.json in the page's language: the card's «{jugador} · {mundo}». */
  worlds: AccountWorld[];
  frame: FrameTexts;
  texts: AccountPageTexts;
  ui: UiLabels;
  /** COMERCIO_PUBLICO of the build: the pages exist only with it. */
  comercio: boolean;
  body: AccountPageBody;
}

/** Where an old `?pestana=` link of «Mi perfil» goes now; null when it stays. */
function legacyTarget(locale: Locale): string | null {
  const params = new URLSearchParams(window.location.search);
  const tab = params.get('pestana');
  if (tab === null) return null;
  if (tab === 'anuncios') return pageHref('anuncios', locale);
  if (tab === 'operaciones') return pageHref('operaciones', locale);
  params.delete('pestana');
  if (tab === 'hechas') params.set('resenas', 'hechas');
  const query = params.toString();
  return `${window.location.pathname}${query === '' ? '' : `?${query}`}`;
}

type AccountLoad =
  | { state: 'loading' }
  | { state: 'error'; error: unknown }
  | { state: 'ready'; account: AccountSummary | null };

const busy = <div className="ac-account-busy" aria-busy="true" />;

export function AccountPage(props: AccountPageProps) {
  const { locale, texts, ui, body } = props;
  // `undefined` while supabase-js loads (client.ts loads it on demand).
  const [client, setClient] = useState<SupabaseClient | null | undefined>(undefined);
  // `undefined` while the session is unknown, `null` without one.
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [failure, setFailure] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (body.page === 'reputacion') {
      const target = legacyTarget(locale);
      if (target !== null) {
        window.location.replace(target);
        return;
      }
    }
    // The body's chunk starts loading now, in parallel with supabase-js.
    void loaders[body.page]().catch(() => undefined);
  }, [body.page, locale]);

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
        else {
          setSession(data.session);
          if (data.session === null) clearCachedAccount();
        }
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

  const loading = (client === undefined || session === undefined) && failure === null;
  const accountHref = `/${locale}/cuenta/`;

  let content = null;
  if (failure !== null) {
    content = (
      <ErrorNotice
        text={mapSupabaseError(failure, locale)}
        onClose={() => setFailure(null)}
        onRetry={() => {
          setFailure(null);
          setAttempt((value) => value + 1);
        }}
        retryLabel={texts.retry}
        closeLabel={ui.dismiss}
      />
    );
  } else if (client !== undefined && session !== undefined) {
    content =
      client === null || session === null ? (
        <EmptyState action={<Button href={accountHref}>{texts.signIn}</Button>}>
          {texts.signInNotice}
        </EmptyState>
      ) : (
        <SignedInPage key={session.user.id} {...props} client={client} session={session} />
      );
  }

  return (
    <div className="ac-account" aria-busy={loading ? 'true' : undefined}>
      {content}
    </div>
  );
}

interface SignedInPageProps extends AccountPageProps {
  client: SupabaseClient;
  session: Session;
}

function SignedInPage(props: SignedInPageProps) {
  const { client, locale } = props;
  const [load, setLoad] = useState<AccountLoad>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let active = true;
    setLoad({ state: 'loading' });
    setDismissed(false);
    // Also writes the header cache (9.16.4) and ends on this browser a session the server no
    // longer accepts.
    refreshCachedAccount(client).then(
      ({ data, error }) => {
        if (!active) return;
        if (error !== null) setLoad({ state: 'error', error });
        else setLoad({ state: 'ready', account: data });
      },
      (error: unknown) => {
        if (active) setLoad({ state: 'error', error });
      },
    );
    return () => {
      active = false;
    };
  }, [client, attempt]);

  if (load.state === 'loading') return busy;
  if (load.state === 'error') {
    if (dismissed) return null;
    return (
      <ErrorNotice
        text={mapSupabaseError(load.error, locale)}
        onClose={() => setDismissed(true)}
        onRetry={() => setAttempt((value) => value + 1)}
        retryLabel={props.texts.retry}
        closeLabel={props.ui.dismiss}
      />
    );
  }
  const account = load.account;
  const accountHref = `/${locale}/cuenta/`;
  if (account === null || !account.registrationComplete || account.username === null) {
    return (
      <EmptyState action={<Button href={accountHref}>{props.texts.finish}</Button>}>
        {props.texts.unfinished}
      </EmptyState>
    );
  }
  // 9.15.2: Comercio is for 18 or more, by the birth date the account stored.
  if (!props.comercio || account.adult !== true) {
    return (
      <EmptyState action={<Button href={accountHref}>{props.frame.title}</Button>}>
        {props.texts.adultsOnly}
      </EmptyState>
    );
  }
  return <FramedPage {...props} account={account} />;
}

function FramedPage(props: SignedInPageProps & { account: AccountSummary }) {
  const { client, session, locale, worlds, frame, ui, body, account } = props;
  const wide = useWide();
  const groups = useMemo(
    () => visibleGroups(availableEntries({ comercio: true, presence: true })),
    [],
  );
  const context: PageContext = {
    client,
    userId: session.user.id,
    locale,
    account,
    ui,
    retry: props.texts.retry,
    heading: frame.panel.sections[body.page],
  };

  let page: ReactNode;
  switch (body.page) {
    case 'reputacion':
      page = <ProfilePage {...context} texts={body.texts} />;
      break;
    case 'anuncios':
      page = <ListingsPage {...context} texts={body.texts} data={body.data} />;
      break;
    default:
      page = <OperationsPage {...context} texts={body.texts} />;
  }

  return (
    <AccountFrame
      locale={locale}
      texts={frame}
      worlds={worlds}
      identities={session.user.identities}
      account={account}
      presenceOn
      groups={groups}
      current={body.page}
      wide={wide}
      onRoot={false}
      back={{ href: `/${locale}/cuenta/` }}
    >
      <Suspense fallback={busy}>{page}</Suspense>
    </AccountFrame>
  );
}
