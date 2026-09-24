import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';

import type { Locale } from '@/i18n/config';
import type { Messages } from '@/i18n/messages/en';
import { fill } from '@/i18n/messages/types';
import { registrationState } from '@/lib/account/registration';
import {
  clearCachedAccount,
  readCachedAccount,
  writeCachedAccount,
} from '@/lib/account/session-cache';
import { orUnknown } from '@/lib/format/unknown';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { mapSupabaseError, toSupabaseFailure } from '@/lib/supabase/errors';
import {
  cachedAccountFrom,
  getMyAccount,
  registrationFactsFrom,
  signOutAccount,
  type AccountSummary,
} from '@/lib/supabase/trade';
import type { EstadoPresencia } from '@/lib/trade/limits';

import { Notice } from '@/components/content/Notice';

import { confirmationReturn } from './auth/arrival';
import { AccountShell } from './panel/AccountShell';
import { ErrorNotice } from './panel/notices';
import { completeAccountProfile } from './panel/profile-save';
import type { LinkReturn } from './panel/types';
import type { ProfileValues, RegistrationStep } from './RegistrationSteps';

// The island of `/{l}/cuenta/` (spec 9.9 with the owner decisions of 9.15 and 9.16, 10.4;
// Cuenta-panel.dc.html).
//
// - Without a session, with a password link, or until the steps of 9.15.1 are done, the page is
//   the access and registration flow (track AUTH), a chunk of its own (panel/auth-flow.ts).
// - A complete account gets the structured page of panel/AccountShell.tsx: the header card, the
//   grouped section nav and one section at a time.
// - After each read or change of the account it writes the profile cache the header entry reads
//   (9.16.4, src/lib/account/session-cache.ts); signing out or deleting the account clears it.
// - Until the session is known the region paints nothing and carries `aria-busy` (9.9).
// - Every Supabase error is shown with `mapSupabaseError` (12.14.1), never its raw message; a
//   failed read offers «Reintentar».
// - An invitation link opens this page with `#invitacion=<token>`. The fragment never reaches
//   a server log; the token is only sent to `accept_guild_invitation` after the account presses
//   «Aceptar invitación», and is removed from the address once accepted.

export type AccountMessages = Messages['account'];

export interface UiLabels {
  /** `ui.close`: the close button of the dialogs. */
  close: string;
  /** `ui.dismiss`: the close button of the notices. */
  dismiss: string;
}

export interface AccountWorld {
  id: string;
  nombre: string;
}

/** The OAuth providers the build switches on (PUBLIC_AUTH_*, S11). */
export interface AuthProviders {
  discord: boolean;
  google: boolean;
  twitch: boolean;
}

/** The published terms and privacy policy; null while they are drafts (D-B7). */
export interface LegalLinks {
  terms: string;
  privacy: string;
}

/** The leaves of `trade` the page reads (13.2). */
export interface AccountTradeTexts {
  /** 9.15.6: `label` and the three states. */
  presence: Pick<Messages['trade']['presence'], 'label' | EstadoPresencia>;
  /** The public labels of the contact channels and the provider names. */
  channels: Messages['trade']['channels'];
}

export interface AccountConfig {
  /** COMERCIO_PUBLICO: the contact channels, the online status and the Comercio lines. */
  comercio: boolean;
  /** TELEFONO_OBLIGATORIO: the phone is step 2b and a row of «Seguridad». */
  phoneRequired: boolean;
  /** PUBLIC_TURNSTILE_SITE_KEY; null renders no check (S11). */
  captchaSiteKey: string | null;
  providers: AuthProviders;
  legal: LegalLinks | null;
}

export interface AccountPanelProps {
  locale: Locale;
  /** content/mundos.json in the page's language: the «Mundo» Selects and each guild's world. */
  worlds: AccountWorld[];
  /** The `account` namespace; `panel` is the structured page and `auth` the flow cards. */
  messages: AccountMessages;
  trade: AccountTradeTexts;
  ui: UiLabels;
  config: AccountConfig;
}

// The access and registration flow: loaded on mount, while supabase-js loads, never in the
// initial JS (13.6).
const loadAuthFlow = () => import('./panel/auth-flow');
const AccessForm = lazy(() => loadAuthFlow().then((flow) => ({ default: flow.AccessForm })));
const NewPasswordForm = lazy(() =>
  loadAuthFlow().then((flow) => ({ default: flow.NewPasswordForm })),
);
const RegistrationSteps = lazy(() =>
  loadAuthFlow().then((flow) => ({ default: flow.RegistrationSteps })),
);
const AuthReturnNotice = lazy(() =>
  loadAuthFlow().then((flow) => ({ default: flow.AuthReturnNotice })),
);
const RegistrationDone = lazy(() =>
  loadAuthFlow().then((flow) => ({ default: flow.RegistrationDone })),
);

/** The fragment of an invitation link and the token shape `create_guild_invitation` gives. */
const INVITATION_FRAGMENT = /^#invitacion=(.+)$/;
const INVITATION_TOKEN = /^[a-f0-9]{64}$/;

function readInvitation(): string | null {
  const match = INVITATION_FRAGMENT.exec(window.location.hash);
  if (!match) return null;
  try {
    const token = decodeURIComponent(match[1]);
    return INVITATION_TOKEN.test(token) ? token : null;
  } catch {
    return null;
  }
}

function clearInvitation(): void {
  window.history.replaceState(
    window.history.state,
    '',
    window.location.pathname + window.location.search,
  );
}

const RETURN_ERROR_KEYS = ['error', 'error_code', 'error_description'];

/**
 * The error a provider sent back after `linkIdentity` (in the query with PKCE, in the fragment
 * otherwise), removed from the address once read. Null when the page came without one.
 */
function takeReturnError(): string | null {
  const url = new URL(window.location.href);
  const hash = new URLSearchParams(url.hash.slice(1));
  const code =
    url.searchParams.get('error_code') ??
    hash.get('error_code') ??
    url.searchParams.get('error') ??
    hash.get('error');
  if (code === null) return null;
  for (const key of RETURN_ERROR_KEYS) url.searchParams.delete(key);
  if (RETURN_ERROR_KEYS.some((key) => hash.has(key))) url.hash = '';
  window.history.replaceState(window.history.state, '', url.toString());
  return code;
}

/**
 * The first step of 9.15.1 the account has not done, or `complete`, from the steps the database
 * counts (`account_registration_state`: an outdated terms version or an age under 13 undo step
 * 3). The phone is a step when the build or the database asks for it.
 */
function stageOf(account: AccountSummary, phoneRequired: boolean): RegistrationStep | 'complete' {
  const state = registrationState(registrationFactsFrom(account), {
    phoneRequired: phoneRequired || account.phoneRequired,
  });
  return state.kind === 'incomplete' ? state.step : 'complete';
}

/** What step 3 saved, when it is asked again (new terms); null before it. */
function savedProfile(
  account: AccountSummary,
): (ProfileValues & { birthDateSaved: boolean }) | null {
  if (account.username === null) return null;
  return {
    username: account.username,
    player: account.player ?? '',
    world: account.world ?? '',
    country: account.country ?? '',
    birthDateSaved: account.birthDateSaved,
  };
}

interface LoadedAccount {
  user: User;
  account: AccountSummary;
  stage: RegistrationStep | 'complete';
}

/** Writes the profile cache of the header entry (9.16.4) from a loaded account. */
function cacheAccount({ user, account }: LoadedAccount): void {
  writeCachedAccount(cachedAccountFrom(user.id, account, user.identities));
}

const busy = <div className="ac-account-busy" aria-busy="true" />;

export function AccountPanel({ locale, worlds, messages, trade, ui, config }: AccountPanelProps) {
  // `undefined` while supabase-js loads (it is loaded on demand, client.ts).
  const [client, setClient] = useState<SupabaseClient | null | undefined>(undefined);
  // `undefined` while the session is unknown, `null` without one.
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [sessionError, setSessionError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  const [invitation, setInvitation] = useState<string | null>(null);
  // A password link opened the page: only the new password until it is saved.
  const [recovery, setRecovery] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [linkReturn, setLinkReturn] = useState<LinkReturn | null>(null);
  // The page came from the confirmation link: its cards say «Correo confirmado» or «Ese enlace
  // ya no sirve», so the return notice stays quiet.
  const [confirmationArrived, setConfirmationArrived] = useState(false);
  // The header kept an account when the page opened: a missing session means it expired
  // («Tu sesión caducó»), unless it ended here (signing out, deleting the account).
  const hadAccount = useRef(false);
  const hadSession = useRef(false);

  useEffect(() => {
    setInvitation(readInvitation());
    hadAccount.current = readCachedAccount() !== null;
    // Read before the provider error: a used confirmation link carries one too.
    setConfirmationArrived(confirmationReturn() !== null);
    // A provider that refused a link sends the browser back here with the reason.
    const code = takeReturnError();
    // The flow chunk starts loading now, in parallel with supabase-js; it also clears the
    // provider of a pending link, whatever the answer was.
    loadAuthFlow().then(
      (flow) => {
        const provider = flow.takeLinkingProvider();
        if (code !== null) setLinkReturn({ provider, code });
      },
      () => {
        if (code !== null) setLinkReturn({ provider: null, code });
      },
    );
  }, []);

  // The auth listener lives as long as the island: it is not tied to the effect that loads the
  // client, whose cleanup runs as soon as the client arrives.
  const listener = useRef<{ unsubscribe: () => void } | null>(null);
  useEffect(
    () => () => {
      listener.current?.unsubscribe();
      listener.current = null;
    },
    [],
  );

  useEffect(() => {
    // Loaded, or no account mode in this build: nothing to load. A failed load retries.
    if (client !== undefined) return undefined;
    let active = true;
    getSupabaseBrowserClient().then(
      (loaded) => {
        if (!active) return;
        if (loaded !== null && listener.current === null) {
          // Subscribed at once: supabase-js announces a password link right after it reads it.
          const { data } = loaded.auth.onAuthStateChange((event, next) => {
            if (next !== null) hadSession.current = true;
            else if (hadSession.current) hadAccount.current = false;
            setSession(next);
            if (event === 'PASSWORD_RECOVERY') setRecovery(true);
            if (event === 'SIGNED_OUT') {
              setRecovery(false);
              clearCachedAccount();
            }
          });
          listener.current = data.subscription;
        }
        setClient(loaded);
      },
      (error: unknown) => {
        if (active) setSessionError(error);
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
    setSessionError(null);
    client.auth.getSession().then(
      ({ data, error }) => {
        if (!active) return;
        if (error) {
          setSessionError(error);
          return;
        }
        if (data.session !== null) hadSession.current = true;
        setSession(data.session);
        // No session: whatever the header kept belongs to no one.
        if (data.session === null) clearCachedAccount();
      },
      (error: unknown) => {
        if (active) setSessionError(error);
      },
    );
    return () => {
      active = false;
    };
  }, [client, attempt]);

  const loading = (client === undefined || session === undefined) && sessionError === null;

  return (
    <div className="ac-account" aria-busy={loading ? 'true' : undefined}>
      {sessionError !== null ? (
        <ErrorNotice
          text={mapSupabaseError(sessionError, locale)}
          onClose={() => setSessionError(null)}
          onRetry={() => setAttempt((value) => value + 1)}
          retryLabel={messages.retry}
          closeLabel={ui.dismiss}
        />
      ) : null}
      {notice !== null ? (
        <Notice open onClose={() => setNotice(null)} closeLabel={ui.dismiss}>
          {notice}
        </Notice>
      ) : null}
      {client !== undefined && client !== null && session !== undefined ? (
        session !== null && recovery ? (
          <Suspense fallback={busy}>
            <NewPasswordForm
              client={client}
              locale={locale}
              messages={messages}
              ui={ui}
              onDone={() => {
                setRecovery(false);
                setNotice(messages.access.passwordSaved);
              }}
            />
          </Suspense>
        ) : session !== null ? (
          <SignedInAccount
            key={session.user.id}
            client={client}
            session={session}
            locale={locale}
            worlds={worlds}
            messages={messages}
            trade={trade}
            ui={ui}
            config={config}
            confirmationArrived={confirmationArrived}
            invitation={invitation}
            onInvitationDone={() => {
              clearInvitation();
              setInvitation(null);
            }}
            linkReturn={linkReturn}
            onLinkReturnDone={() => setLinkReturn(null)}
            onDeleted={() => setNotice(messages.delete.deleted)}
          />
        ) : (
          <>
            {invitation ? (
              <p className="ac-account-line">{messages.guilds.invitationSignIn}</p>
            ) : null}
            {linkReturn !== null && !confirmationArrived ? (
              <Suspense fallback={null}>
                <AuthReturnNotice
                  client={client}
                  locale={locale}
                  messages={messages}
                  ui={ui}
                  code={linkReturn.code}
                  provider={linkReturn.provider}
                  onClose={() => setLinkReturn(null)}
                />
              </Suspense>
            ) : null}
            <Suspense fallback={busy}>
              <AccessForm
                client={client}
                locale={locale}
                messages={messages}
                ui={ui}
                captchaSiteKey={config.captchaSiteKey}
                phoneRequired={config.phoneRequired}
                expired={hadAccount.current}
              />
            </Suspense>
          </>
        )
      ) : null}
    </div>
  );
}

interface SignedInAccountProps {
  client: SupabaseClient;
  session: Session;
  locale: Locale;
  worlds: AccountWorld[];
  messages: AccountMessages;
  trade: AccountTradeTexts;
  ui: UiLabels;
  config: AccountConfig;
  confirmationArrived: boolean;
  invitation: string | null;
  onInvitationDone: () => void;
  linkReturn: LinkReturn | null;
  onLinkReturnDone: () => void;
  onDeleted: () => void;
}

function SignedInAccount({
  client,
  session,
  locale,
  worlds,
  messages,
  trade,
  ui,
  config,
  confirmationArrived,
  invitation,
  onInvitationDone,
  linkReturn,
  onLinkReturnDone,
  onDeleted,
}: SignedInAccountProps) {
  const [loaded, setLoaded] = useState<LoadedAccount | undefined>(undefined);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [version, setVersion] = useState(0);
  // «Listo» once, when a read finds the last step done in this visit.
  const [finished, setFinished] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const lastStage = useRef<LoadedAccount['stage'] | null>(null);
  const reload = () => setVersion((value) => value + 1);

  useEffect(() => {
    let active = true;
    setLoadError(null);
    (async () => {
      // The user from the server: the identities of a link that just came back are there.
      const { data: userData, error: userError } = await client.auth.getUser();
      if (userError) throw userError;
      const { data: account, error } = await getMyAccount(client);
      if (error) throw error;
      // An answer the page cannot read is a failed read too («Reintentar»).
      if (account === null) throw toSupabaseFailure(null);
      const next: LoadedAccount = {
        user: userData.user,
        account,
        stage: stageOf(account, config.phoneRequired),
      };
      return next;
    })().then(
      (next) => {
        if (!active) return;
        const before = lastStage.current;
        lastStage.current = next.stage;
        if (before !== null && before !== 'complete' && next.stage === 'complete') {
          setFinished(true);
        }
        setLoaded(next);
        cacheAccount(next);
      },
      (error: unknown) => {
        if (active) setLoadError(error);
      },
    );
    return () => {
      active = false;
    };
  }, [client, version, config.phoneRequired]);

  function changePresence(presence: EstadoPresencia): void {
    if (loaded === undefined) return;
    const next = { ...loaded, account: { ...loaded.account, presence } };
    setLoaded(next);
    cacheAccount(next);
  }

  const complete = loaded?.stage === 'complete';
  const hasDiscord = loaded?.user.identities?.some((item) => item.provider === 'discord') ?? false;

  function linkDiscord(): void {
    setLinkError(null);
    void loadAuthFlow()
      .then((flow) => flow.linkProvider(client, 'discord', locale))
      .then(
        (error) => {
          if (error) setLinkError(mapSupabaseError(error, locale));
        },
        (error: unknown) => setLinkError(mapSupabaseError(error, locale)),
      );
  }

  return (
    <>
      {linkError !== null ? (
        <Notice open onClose={() => setLinkError(null)} closeLabel={ui.dismiss}>
          {linkError}
        </Notice>
      ) : null}
      {loadError !== null ? (
        <ErrorNotice
          text={mapSupabaseError(loadError, locale)}
          onClose={() => setLoadError(null)}
          onRetry={reload}
          retryLabel={messages.retry}
          closeLabel={ui.dismiss}
        />
      ) : null}
      {loaded === undefined && loadError === null ? busy : null}
      {loaded !== undefined && !complete ? (
        <div id="acceso" className="ac-auth-flow">
          {linkReturn !== null && !confirmationArrived ? (
            <Suspense fallback={null}>
              <AuthReturnNotice
                client={client}
                locale={locale}
                messages={messages}
                ui={ui}
                code={linkReturn.code}
                provider={linkReturn.provider}
                onClose={onLinkReturnDone}
              />
            </Suspense>
          ) : null}
          <Suspense fallback={busy}>
            <RegistrationSteps
              key={loaded.stage}
              client={client}
              locale={locale}
              messages={messages}
              ui={ui}
              user={loaded.user}
              stage={loaded.stage as RegistrationStep}
              providers={config.providers}
              captchaSiteKey={config.captchaSiteKey}
              worlds={worlds}
              legal={config.legal}
              phoneRequired={config.phoneRequired || loaded.account.phoneRequired}
              savedProfile={savedProfile(loaded.account)}
              onCompleteProfile={(values) => completeAccountProfile(client, values)}
              onChanged={reload}
            />
          </Suspense>
          <SessionLine
            client={client}
            session={session}
            locale={locale}
            messages={messages}
            ui={ui}
            offlineOnSignOut={config.comercio}
          />
        </div>
      ) : null}
      {loaded !== undefined && complete && finished ? (
        <Suspense fallback={busy}>
          <RegistrationDone
            messages={messages}
            username={loaded.account.username ?? ''}
            phoneRequired={config.phoneRequired || loaded.account.phoneRequired}
            onLinkDiscord={
              config.comercio && config.providers.discord && !hasDiscord ? linkDiscord : null
            }
            wikiHref={`/${locale}/`}
            onAccount={() => setFinished(false)}
          />
        </Suspense>
      ) : null}
      {loaded !== undefined && complete && !finished ? (
        <AccountShell
          client={client}
          locale={locale}
          messages={messages}
          panel={messages.panel}
          trade={trade}
          ui={ui}
          config={config}
          worlds={worlds}
          user={loaded.user}
          account={loaded.account}
          reload={reload}
          onPresence={changePresence}
          invitation={invitation}
          onInvitationDone={onInvitationDone}
          linkReturn={linkReturn}
          onLinkReturnDone={onLinkReturnDone}
          onDeleted={onDeleted}
        />
      ) : null}
    </>
  );
}

/**
 * The session line of an unfinished registration, with «Cerrar sesión». With COMERCIO_PUBLICO
 * signing out sets `desconectado` first, while the session can still write it (9.16.2).
 */
function SessionLine({
  client,
  session,
  locale,
  messages,
  ui,
  offlineOnSignOut,
}: {
  client: SupabaseClient;
  session: Session;
  locale: Locale;
  messages: AccountMessages;
  ui: UiLabels;
  offlineOnSignOut: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signOut() {
    setPending(true);
    setError(null);
    try {
      const { error: failure } = await signOutAccount(client, { presence: offlineOnSignOut });
      if (failure) setError(mapSupabaseError(failure, locale));
    } catch (caught) {
      setError(mapSupabaseError(caught, locale));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <p className="ac-auth ac-auth-session">
        <span>{fill(messages.access.signedIn, { email: orUnknown(session.user.email) })}</span>
        <button type="button" className="ac-auth-quiet" onClick={signOut} disabled={pending}>
          {messages.access.signOut}
        </button>
      </p>
      {error !== null ? (
        <Notice open onClose={() => setError(null)} closeLabel={ui.dismiss}>
          {error}
        </Notice>
      ) : null}
    </>
  );
}
