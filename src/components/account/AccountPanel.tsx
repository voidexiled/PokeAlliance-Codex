import { useEffect, useRef, useState } from 'react';
import type { SubmitEvent } from 'react';
import type {
  PostgrestError,
  Session,
  SupabaseClient,
  User,
  UserIdentity,
} from '@supabase/supabase-js';

import type { Locale } from '@/i18n/config';
import type { Messages } from '@/i18n/messages/en';
import { fill, plural } from '@/i18n/messages/types';
import { isAnchorProvider, registrationState } from '@/lib/account/registration';
import { clearCachedAccount, writeCachedAccount } from '@/lib/account/session-cache';
import { formatDate } from '@/lib/format/dates';
import { formatInteger } from '@/lib/format/numbers';
import { orUnknown } from '@/lib/format/unknown';
import {
  acceptGuildInvitation,
  createGuildInvitation,
  createUserGuild,
  deleteUserGuild,
  listGuildAccounts,
  listUserGuilds,
  removeGuildMember,
  type GuildAccount,
  type GuildInvitationRole,
  type GuildRole,
  type SupabaseGuild,
} from '@/lib/supabase/account';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { classifySupabaseError, mapSupabaseError, toSupabaseFailure } from '@/lib/supabase/errors';
import {
  TRADE_RPC,
  cachedAccountFrom,
  deleteAccount,
  getMyAccount,
  registrationFactsFrom,
  setPresenceState,
  signOutAccount,
  type AccountSummary,
} from '@/lib/supabase/trade';
import {
  DISCORD_EDAD_MIN_DIAS,
  ESTADOS_PRESENCIA,
  TERMINOS_VERSION,
  isEstadoPresencia,
  type EstadoPresencia,
} from '@/lib/trade/limits';

import { DataTable } from '@/components/content/DataTable';
import { FactLine, FactLines } from '@/components/content/FactLine';
import { Notice } from '@/components/content/Notice';
import { Button } from '@/components/controls/Button';
import { Dialog, initialFocus } from '@/components/controls/Dialog';
import { Select } from '@/components/controls/Select';
import { TextField } from '@/components/controls/TextField';
import { ToggleGroup } from '@/components/controls/ToggleGroup';
import { Section } from '@/components/layout/Section';

import { ChannelsPanel } from './ChannelsPanel';
import {
  AccessForm,
  NewPasswordForm,
  PhoneVerification,
  ProfileForm,
  RegistrationSteps,
  linkProvider,
  takeLinkingProvider,
  type LinkProvider,
  type NewProfileValues,
  type ProfileField,
  type ProfileRefusal,
  type ProfileSaveOutcome,
  type ProfileValues,
  type RegistrationStep,
} from './RegistrationSteps';

// The island of `/{l}/cuenta/` (spec 9.9 with the owner decisions of 9.15 and 9.16, 10.4).
//
// - Without a session: «Acceso» (sign in, create an account with step 1 of 9.15.1, «¿Olvidaste
//   tu contraseña?»). A password link opens the page in the recovery state: only the new
//   password.
// - Registration applies to every account (9.15.1): until its steps are done the page shows
//   only the session line and the next step (RegistrationSteps.tsx).
// - A complete account: «Acceso» (the session, «Cerrar sesión» and, with COMERCIO_PUBLICO, the
//   online status of 9.15.6), «Verificación» (the email, the linked identities and, with
//   TELEFONO_OBLIGATORIO, the phone), «Perfil» (9.16.3), «Canales de contacto» (only with
//   COMERCIO_PUBLICO, ChannelsPanel.tsx), «Guilds» (M13, unchanged) and «Eliminar cuenta».
// - After each read or change of the account it writes the profile cache the header entry reads
//   (9.16.4, src/lib/account/session-cache.ts); signing out or deleting the account clears it.
// - Until the session is known the region paints nothing and carries `aria-busy` (9.9).
// - Every Supabase error is shown with `mapSupabaseError` (12.14.1), never its raw message; a
//   failed read offers «Reintentar».
// - The confirmations are alert dialogs whose initial focus is «Cancelar»; an error of the
//   operation stays inside the dialog without closing it (10.4, CA-10.14).
// - An invitation link opens this page with `#invitacion=<token>`. The fragment never reaches
//   a server log; the token is only sent to `accept_guild_invitation` after the account presses
//   «Aceptar invitación», and is removed from the address once accepted.
// - The server enforces every permission (RLS and the security definer functions); what a
//   role or a state may not do is hidden, never trusted.
// - The guild calls come from src/lib/supabase/account.ts, never from guilds.ts: that module
//   loads the Temporal polyfill, which only the Guild island may ship (3.13).

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
  /** TELEFONO_OBLIGATORIO: the phone is step 2b and a row of «Verificación». */
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
  messages: AccountMessages;
  trade: AccountTradeTexts;
  ui: UiLabels;
  config: AccountConfig;
}

/** `create_guild` accepts 1 to 64 printable characters. */
const GUILD_NAME_MAX = 64;
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

function accountPage(locale: Locale): URL {
  return new URL(`/${locale}/cuenta/`, window.location.origin);
}

function invitationLink(locale: Locale, token: string): string {
  const url = accountPage(locale);
  url.hash = `invitacion=${encodeURIComponent(token)}`;
  return url.toString();
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

/** Guilds created before M13 may have no display name: their key is what the account typed. */
function guildName(guild: SupabaseGuild): string {
  return guild.display_name ?? guild.guild_key;
}

function roleLabel(role: GuildRole, roles: AccountMessages['guilds']['roles']): string {
  switch (role) {
    case 'owner':
      return roles.owner;
    case 'officer':
      return roles.officer;
    default:
      return roles.member;
  }
}

// ------------------------------------------------------------------- the account

/** Discord or Google anchor an account (9.15.1). */
function isAnchor(identity: UserIdentity): boolean {
  return isAnchorProvider(identity.provider);
}

/** The name an identity shows in its row: its user name at the provider, else its address. */
function identityName(identity: UserIdentity): string | null {
  const data = identity.identity_data ?? {};
  for (const key of ['user_name', 'preferred_username', 'full_name', 'name', 'email']) {
    const value: unknown = data[key];
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
  }
  return null;
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

/** What step 3 saved and «Perfil» edits; null before step 3. */
interface OwnProfile extends ProfileValues {
  /** 9.9: the username does not change after the first listing. */
  usernameLocked: boolean;
  /** The birth date is kept (never read back): it is not asked again. */
  birthDateSaved: boolean;
}

function ownProfile(account: AccountSummary): OwnProfile | null {
  if (account.username === null) return null;
  return {
    username: account.username,
    player: account.player ?? '',
    world: account.world ?? '',
    country: account.country ?? '',
    usernameLocked: account.usernameLocked,
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

/** A notice whose text is an error, with «Reintentar» when the read can be repeated. */
function ErrorNotice({
  text,
  onClose,
  onRetry,
  retryLabel,
  closeLabel,
}: {
  text: string;
  onClose: () => void;
  onRetry?: () => void;
  retryLabel?: string;
  closeLabel: string;
}) {
  return (
    <Notice open onClose={onClose} closeLabel={closeLabel}>
      {text}
      {onRetry && retryLabel ? (
        <>
          {' '}
          <Button onClick={onRetry}>{retryLabel}</Button>
        </>
      ) : null}
    </Notice>
  );
}

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

  useEffect(() => {
    setInvitation(readInvitation());
    // A provider that refused a link sends the browser back here with the reason.
    const returned = takeReturnError();
    const provider = takeLinkingProvider();
    // `access_denied` is the account's own «Cancel» at the provider: nothing to say.
    if (returned === null || returned === 'access_denied') return;
    setNotice(
      returned === 'identity_already_exists' && provider !== null
        ? fill(messages.identities.taken, { provider: trade.channels[provider] })
        : mapSupabaseError({ code: returned, network: false }, locale),
    );
  }, [locale, messages, trade]);

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

  const busy = (client === undefined || session === undefined) && sessionError === null;

  return (
    <div className="ac-account" aria-busy={busy ? 'true' : undefined}>
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
          <Section id="acceso" title={messages.access.title}>
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
          </Section>
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
            invitation={invitation}
            onInvitationDone={() => {
              clearInvitation();
              setInvitation(null);
            }}
            onDeleted={() => setNotice(messages.delete.deleted)}
          />
        ) : (
          <Section id="acceso" title={messages.access.title}>
            {invitation ? (
              <p className="ac-account-line">{messages.guilds.invitationSignIn}</p>
            ) : null}
            <AccessForm
              client={client}
              locale={locale}
              messages={messages}
              ui={ui}
              captchaSiteKey={config.captchaSiteKey}
              phoneRequired={config.phoneRequired}
            />
          </Section>
        )
      ) : null}
    </div>
  );
}

interface ClientProps {
  client: SupabaseClient;
  locale: Locale;
  messages: AccountMessages;
  ui: UiLabels;
}

interface SignedInAccountProps extends ClientProps {
  session: Session;
  worlds: AccountWorld[];
  trade: AccountTradeTexts;
  config: AccountConfig;
  invitation: string | null;
  onInvitationDone: () => void;
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
  invitation,
  onInvitationDone,
  onDeleted,
}: SignedInAccountProps) {
  const [loaded, setLoaded] = useState<LoadedAccount | undefined>(undefined);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [version, setVersion] = useState(0);
  // «Registro completo.» once, when a read finds the last step done in this visit.
  const [finished, setFinished] = useState(false);
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
  const profile = loaded === undefined ? null : ownProfile(loaded.account);

  return (
    <>
      <Section id="acceso" title={messages.access.title}>
        <SessionBar
          client={client}
          session={session}
          locale={locale}
          messages={messages}
          ui={ui}
          offlineOnSignOut={config.comercio}
          presence={
            // The online status is Comercio's: a complete account of 18 or more (9.15.6).
            config.comercio && complete && loaded !== undefined && loaded.account.adult === true
              ? { value: loaded.account.presence, labels: trade.presence, onChange: changePresence }
              : null
          }
        />
        {finished ? (
          <Notice open onClose={() => setFinished(false)} closeLabel={ui.dismiss}>
            {messages.register.done}
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
        {loaded === undefined && loadError === null ? <div aria-busy="true" /> : null}
        {loaded !== undefined && loaded.stage !== 'complete' ? (
          <RegistrationSteps
            key={loaded.stage}
            client={client}
            locale={locale}
            messages={messages}
            ui={ui}
            user={loaded.user}
            stage={loaded.stage}
            providers={config.providers}
            captchaSiteKey={config.captchaSiteKey}
            worlds={worlds}
            legal={config.legal}
            phoneRequired={config.phoneRequired || loaded.account.phoneRequired}
            savedProfile={ownProfile(loaded.account)}
            onCompleteProfile={(values) => completeAccountProfile(client, values)}
            onChanged={reload}
          />
        ) : null}
      </Section>
      {loaded !== undefined && complete ? (
        <>
          <Section id="verificacion" title={messages.verification.title}>
            {/* A complete account has confirmed its email (step 1): an address still waiting
                for its code is a registration step, with «Reenviar código». */}
            <FactLines>
              <FactLine label={messages.verification.email}>
                {loaded.user.email_confirmed_at
                  ? messages.verification.verified
                  : messages.verification.unverified}
              </FactLine>
            </FactLines>
            <IdentityList
              client={client}
              locale={locale}
              messages={messages}
              ui={ui}
              user={loaded.user}
              providers={config.providers}
              names={trade.channels}
              discordTooNew={config.comercio && loaded.account.comercioBlock === 'discord_too_new'}
              onChanged={reload}
            />
            {config.phoneRequired || loaded.account.phoneRequired ? (
              <PhoneVerification
                client={client}
                locale={locale}
                messages={messages}
                ui={ui}
                user={loaded.user}
                onVerified={reload}
              />
            ) : null}
          </Section>
          {profile !== null ? (
            <Section id="perfil" title={messages.profile.title}>
              <ProfileForm
                mode="edit"
                locale={locale}
                messages={messages}
                ui={ui}
                worlds={worlds}
                initial={profile}
                usernameLocked={profile.usernameLocked}
                onSubmit={(values) => updateAccountProfile(client, values)}
                onSaved={reload}
              />
            </Section>
          ) : null}
          {config.comercio ? (
            <ChannelsPanel
              client={client}
              locale={locale}
              messages={messages}
              labels={trade.channels}
              ui={ui}
            />
          ) : null}
          <GuildsSection
            client={client}
            locale={locale}
            worlds={worlds}
            messages={messages}
            ui={ui}
            invitation={invitation}
            onInvitationDone={onInvitationDone}
          />
          <DeleteAccountSection
            client={client}
            locale={locale}
            messages={messages}
            ui={ui}
            comercio={config.comercio}
            suspended={loaded.account.suspendedUntil !== null}
            onDeleted={onDeleted}
          />
        </>
      ) : null}
    </>
  );
}

interface PresenceProps {
  /** The state the account chose. */
  value: EstadoPresencia;
  labels: AccountTradeTexts['presence'];
  onChange: (value: EstadoPresencia) => void;
}

/**
 * The session line with «Cerrar sesión» and, for a complete account of 18 or more with
 * COMERCIO_PUBLICO, the online status of 9.15.6. With COMERCIO_PUBLICO signing out sets
 * `desconectado` first, while the session can still write it (9.16.2).
 */
function SessionBar({
  client,
  session,
  locale,
  messages,
  ui,
  offlineOnSignOut,
  presence,
}: ClientProps & {
  session: Session;
  offlineOnSignOut: boolean;
  presence: PresenceProps | null;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signOut() {
    setPending(true);
    setError(null);
    try {
      // `desconectado` first (best effort), then the session and the header cache.
      const { error: failure } = await signOutAccount(client, { presence: offlineOnSignOut });
      if (failure) setError(mapSupabaseError(failure, locale));
    } catch (caught) {
      setError(mapSupabaseError(caught, locale));
    } finally {
      setPending(false);
    }
  }

  async function choose(value: string) {
    if (presence === null || !isEstadoPresencia(value) || value === presence.value) return;
    const previous = presence.value;
    // The dot of the header follows at once (9.16.2); a refusal puts the old state back.
    presence.onChange(value);
    setError(null);
    try {
      const { error: failure } = await setPresenceState(client, value);
      if (failure) {
        presence.onChange(previous);
        setError(mapSupabaseError(failure, locale));
      }
    } catch (caught) {
      presence.onChange(previous);
      setError(mapSupabaseError(caught, locale));
    }
  }

  return (
    <>
      <div className="ac-account-row">
        <p className="ac-account-line">
          {fill(messages.access.signedIn, { email: orUnknown(session.user.email) })}
        </p>
        <Button onClick={signOut} disabled={pending}>
          {messages.access.signOut}
        </Button>
      </div>
      {presence !== null ? (
        <ToggleGroup
          label={presence.labels.label}
          options={ESTADOS_PRESENCIA.map((state) => ({
            value: state,
            label: presence.labels[state],
          }))}
          value={presence.value}
          onChange={(value) => void choose(value)}
        />
      ) : null}
      {error !== null ? (
        <Notice open onClose={() => setError(null)} closeLabel={ui.dismiss}>
          {error}
        </Notice>
      ) : null}
    </>
  );
}

const PROVIDERS: readonly LinkProvider[] = ['discord', 'google', 'twitch'];

interface IdentityListProps extends ClientProps {
  user: User;
  providers: AuthProviders;
  /** Provider names, from `trade.channels`. */
  names: AccountTradeTexts['channels'];
  /** COMERCIO_PUBLICO and the database says the Discord account is too new (9.15.2). */
  discordTooNew: boolean;
  onChanged: () => void;
}

/**
 * «Cuentas vinculadas» (9.15.1): Discord, Google and Twitch, each linked with its name and
 * «Desvincular», or «Vincular …» when the build switches the provider on (S11). Discord or
 * Google anchor the account, so the last of them has no «Desvincular»; with COMERCIO_PUBLICO a
 * Discord account younger than `DISCORD_EDAD_MIN_DIAS` says Comercio does not take it yet.
 */
function IdentityList({
  client,
  locale,
  messages,
  ui,
  user,
  providers,
  names,
  discordTooNew,
  onChanged,
}: IdentityListProps) {
  const text = messages.identities;
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const identities = user.identities ?? [];
  const anchors = identities.filter(isAnchor).length;
  const rows = PROVIDERS.flatMap((provider) => {
    const identity = identities.find((candidate) => candidate.provider === provider);
    return identity !== undefined || providers[provider] ? [{ provider, identity }] : [];
  });
  if (rows.length === 0) return null;

  const linkLabel: Record<LinkProvider, string> = {
    discord: text.linkDiscord,
    google: text.linkGoogle,
    twitch: text.linkTwitch,
  };

  async function link(provider: LinkProvider) {
    if (pending) return;
    setPending(true);
    setNotice(null);
    try {
      const error = await linkProvider(client, provider, locale);
      // Without an error the browser is already on its way to the provider.
      if (error) {
        setNotice(mapSupabaseError(error, locale));
        setPending(false);
      }
    } catch (caught) {
      setNotice(mapSupabaseError(caught, locale));
      setPending(false);
    }
  }

  async function unlink(identity: UserIdentity) {
    if (pending) return;
    setPending(true);
    setNotice(null);
    try {
      const { error } = await client.auth.unlinkIdentity(identity);
      if (error) setNotice(mapSupabaseError(error, locale));
      else onChanged();
    } catch (caught) {
      setNotice(mapSupabaseError(caught, locale));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="ac-account-block">
      <h3 className="ac-account-subtitle">{text.title}</h3>
      <ul className="ac-account-identities">
        {rows.map(({ provider, identity }) => {
          const unlinkable = identity !== undefined && (!isAnchor(identity) || anchors > 1);
          return (
            <li key={provider} className="ac-account-identity">
              <span className="ac-account-identity__provider">{names[provider]}</span>
              {identity !== undefined ? (
                <span className="ac-account-identity__name">
                  {fill(text.linked, { name: orUnknown(identityName(identity)) })}
                </span>
              ) : (
                <Button onClick={() => link(provider)} disabled={pending}>
                  {linkLabel[provider]}
                </Button>
              )}
              {unlinkable ? (
                <Button onClick={() => unlink(identity)} disabled={pending}>
                  {text.unlink}
                </Button>
              ) : null}
              {discordTooNew && provider === 'discord' && identity !== undefined ? (
                <p className="ac-account-help ac-account-identity__note">
                  {fill(text.discordTooNew, { days: formatInteger(DISCORD_EDAD_MIN_DIAS, locale) })}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
      {anchors === 1 ? <p className="ac-account-help">{text.anchorRequired}</p> : null}
      {notice !== null ? (
        <Notice open onClose={() => setNotice(null)} closeLabel={ui.dismiss}>
          {notice}
        </Notice>
      ) : null}
    </div>
  );
}

interface DeleteAccountSectionProps extends ClientProps {
  comercio: boolean;
  /** Suspended in Comercio (9.15.5): its identifiers stay taken after the deletion. */
  suspended: boolean;
  onDeleted: () => void;
}

/**
 * «Eliminar cuenta» (9.9, 9.15.5): an alert dialog with the count of the guilds the account owns,
 * the Comercio line with COMERCIO_PUBLICO and the line of a suspended account, «Cancelar» first.
 * `account_delete` deletes the owned guilds and the account; a suspended one keeps its email,
 * identities and player name taken and its Auth user blocked, without sessions.
 */
function DeleteAccountSection({
  client,
  locale,
  messages,
  ui,
  comercio,
  suspended,
  onDeleted,
}: DeleteAccountSectionProps) {
  const text = messages.delete;
  const [owned, setOwned] = useState<number | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);

  // The guild count of the dialog is read when it opens, so it is never stale.
  async function open() {
    if (preparing) return;
    setPreparing(true);
    setNotice(null);
    try {
      const { data, error } = await listUserGuilds(client);
      if (error || data === null) {
        setNotice(mapSupabaseError(error, locale));
        return;
      }
      setDialogError(null);
      setOwned(data.filter((guild) => guild.role === 'owner').length);
    } catch (caught) {
      setNotice(mapSupabaseError(caught, locale));
    } finally {
      setPreparing(false);
    }
  }

  async function confirm() {
    if (deleting) return;
    setDeleting(true);
    setDialogError(null);
    try {
      // It also ends the session on this browser and clears the header cache.
      const { error } = await deleteAccount(client);
      if (error) {
        setDialogError(mapSupabaseError(error, locale));
        return;
      }
      setOwned(null);
      onDeleted();
    } catch (caught) {
      setDialogError(mapSupabaseError(caught, locale));
    } finally {
      setDeleting(false);
    }
  }

  const guildsLine =
    owned !== null && owned > 0
      ? fill(plural(locale, owned, text.withGuilds), { n: formatInteger(owned, locale) })
      : text.withoutGuilds;

  return (
    <Section id="eliminar" title={text.title}>
      <div className="ac-account-row">
        <Button aria-haspopup="dialog" onClick={open} disabled={preparing}>
          {text.title}
        </Button>
      </div>
      {notice !== null ? (
        <Notice open onClose={() => setNotice(null)} closeLabel={ui.dismiss}>
          {notice}
        </Notice>
      ) : null}
      <Dialog
        open={owned !== null}
        onClose={() => {
          if (deleting) return;
          setOwned(null);
          setDialogError(null);
        }}
        title={text.dialogTitle}
        closeLabel={ui.close}
        alert
        actions={
          <>
            <Button {...initialFocus} onClick={() => setOwned(null)} disabled={deleting}>
              {messages.cancel}
            </Button>
            <Button variant="solid" onClick={confirm} disabled={deleting}>
              {deleting ? text.deleting : text.title}
            </Button>
          </>
        }
      >
        <p>{guildsLine}</p>
        {comercio ? <p>{text.trade}</p> : null}
        {suspended ? <p>{text.banned}</p> : null}
        {dialogError !== null ? (
          <Notice open onClose={() => setDialogError(null)} closeLabel={ui.dismiss}>
            {dialogError}
          </Notice>
        ) : null}
      </Dialog>
    </Section>
  );
}

// ------------------------------------------------------------------------ «Guilds» (M13)

interface GuildsSectionProps extends ClientProps {
  worlds: AccountWorld[];
  invitation: string | null;
  /** The link was used or cannot be used: its token leaves the address. */
  onInvitationDone: () => void;
}

function GuildsSection({
  client,
  locale,
  worlds,
  messages,
  ui,
  invitation,
  onInvitationDone,
}: GuildsSectionProps) {
  const [guilds, setGuilds] = useState<SupabaseGuild[] | undefined>(undefined);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [version, setVersion] = useState(0);
  const [accepting, setAccepting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const { guilds: text } = messages;

  useEffect(() => {
    let active = true;
    setLoadError(null);
    listUserGuilds(client).then(
      ({ data, error }) => {
        if (!active) return;
        if (error) setLoadError(error);
        else setGuilds(data ?? []);
      },
      (error: unknown) => {
        if (active) setLoadError(error);
      },
    );
    return () => {
      active = false;
    };
  }, [client, version]);

  const reload = () => setVersion((value) => value + 1);

  async function accept() {
    if (invitation === null || accepting) return;
    setAccepting(true);
    setNotice(null);
    try {
      const { data, error } = await acceptGuildInvitation(client, invitation);
      if (error || !data) {
        setNotice(mapSupabaseError(error, locale));
        // An unknown, used or expired link (P0002) never works again: only a failed
        // connection keeps «Aceptar invitación» for another try.
        if (classifySupabaseError(error) !== 'network') onInvitationDone();
        return;
      }
      setNotice(fill(text.joined, { guild: orUnknown(data.displayName) }));
      onInvitationDone();
      reload();
    } catch (caught) {
      setNotice(mapSupabaseError(caught, locale));
    } finally {
      setAccepting(false);
    }
  }

  const worldName = (id: string): string =>
    orUnknown(worlds.find((world) => world.id === id)?.nombre);

  return (
    <Section id="guilds" title={text.title}>
      {invitation !== null ? (
        <div className="ac-account-row">
          <p className="ac-account-line">{text.invitation}</p>
          <Button variant="solid" onClick={accept} disabled={accepting}>
            {text.accept}
          </Button>
        </div>
      ) : null}
      {notice !== null ? (
        <Notice open onClose={() => setNotice(null)} closeLabel={ui.dismiss}>
          {notice}
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
      <div aria-busy={guilds === undefined && loadError === null ? 'true' : undefined}>
        {guilds === undefined ? null : guilds.length === 0 ? (
          <p className="ac-account-line">{text.none}</p>
        ) : (
          <ul className="ac-account-guilds">
            {guilds.map((guild) => (
              <li key={guild.guild_id}>
                <GuildBlock
                  client={client}
                  locale={locale}
                  messages={messages}
                  ui={ui}
                  guild={guild}
                  world={worldName(guild.world_key)}
                  onDeleted={reload}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
      <CreateGuildForm
        client={client}
        locale={locale}
        messages={messages}
        ui={ui}
        worlds={worlds}
        onCreated={reload}
      />
    </Section>
  );
}

interface GuildBlockProps extends ClientProps {
  guild: SupabaseGuild;
  world: string;
  onDeleted: () => void;
}

interface Invite {
  role: GuildInvitationRole;
  link: string;
  expiresAt: string;
}

type Confirmation = { kind: 'remove'; account: GuildAccount } | { kind: 'delete' };

function GuildBlock({ client, locale, messages, ui, guild, world, onDeleted }: GuildBlockProps) {
  const { guilds: text } = messages;
  const owner = guild.role === 'owner';
  const name = guildName(guild);
  const headingId = `guild-${guild.guild_id}`;
  const [accounts, setAccounts] = useState<GuildAccount[] | undefined>(undefined);
  const [accountsError, setAccountsError] = useState<unknown>(null);
  const [version, setVersion] = useState(0);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [inviting, setInviting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  useEffect(() => {
    if (!owner) return undefined;
    let active = true;
    setAccountsError(null);
    listGuildAccounts(client, guild.guild_id).then(
      ({ data, error }) => {
        if (!active) return;
        if (error) setAccountsError(error);
        else setAccounts(data ?? []);
      },
      (error: unknown) => {
        if (active) setAccountsError(error);
      },
    );
    return () => {
      active = false;
    };
  }, [client, guild.guild_id, owner, version]);

  async function createInvite(role: GuildInvitationRole) {
    if (inviting) return;
    setInviting(true);
    setNotice(null);
    try {
      const { data, error } = await createGuildInvitation(client, guild.guild_id, role);
      if (error || !data) {
        setNotice(mapSupabaseError(error, locale));
        return;
      }
      setInvite({ role, link: invitationLink(locale, data.token), expiresAt: data.expiresAt });
    } catch (caught) {
      setNotice(mapSupabaseError(caught, locale));
    } finally {
      setInviting(false);
    }
  }

  async function copyLink() {
    if (invite === null) return;
    try {
      await navigator.clipboard.writeText(invite.link);
      setNotice(text.copied);
    } catch {
      setNotice(text.copyFailed);
    }
  }

  async function confirm() {
    if (confirmation === null || confirming) return;
    setConfirming(true);
    setConfirmError(null);
    try {
      const { error } =
        confirmation.kind === 'remove'
          ? await removeGuildMember(client, guild.guild_id, confirmation.account.userId)
          : await deleteUserGuild(client, guild.guild_id);
      if (error) {
        setConfirmError(mapSupabaseError(error, locale));
        return;
      }
      const done = confirmation.kind;
      setConfirmation(null);
      if (done === 'remove') setVersion((value) => value + 1);
      else onDeleted();
    } catch (caught) {
      setConfirmError(mapSupabaseError(caught, locale));
    } finally {
      setConfirming(false);
    }
  }

  const removing = confirmation?.kind === 'remove' ? confirmation.account : null;

  return (
    <article className="ac-account-guild" aria-labelledby={headingId}>
      <h3 id={headingId} className="ac-account-guild__title">
        {name}
      </h3>
      <FactLines>
        <FactLine label={text.world}>{world}</FactLine>
        <FactLine label={text.role}>{roleLabel(guild.role, text.roles)}</FactLine>
      </FactLines>
      {owner ? (
        <>
          <div className="ac-account-row">
            <Button onClick={() => createInvite('officer')} disabled={inviting}>
              {text.inviteOfficer}
            </Button>
            <Button onClick={() => createInvite('member')} disabled={inviting}>
              {text.inviteMember}
            </Button>
          </div>
          {invite !== null ? (
            <div className="ac-account-link">
              <TextField
                label={text.link}
                value={invite.link}
                helper={fill(text.linkHelp, {
                  role: roleLabel(invite.role, text.roles),
                  date: formatDate(invite.expiresAt, locale),
                })}
                inputProps={{ readOnly: true, onFocus: (event) => event.currentTarget.select() }}
              />
              <Button onClick={copyLink}>{text.copy}</Button>
            </div>
          ) : null}
        </>
      ) : null}
      {notice !== null ? (
        <Notice open onClose={() => setNotice(null)} closeLabel={ui.dismiss}>
          {notice}
        </Notice>
      ) : null}
      {owner && accountsError !== null ? (
        <ErrorNotice
          text={mapSupabaseError(accountsError, locale)}
          onClose={() => setAccountsError(null)}
          onRetry={() => setVersion((value) => value + 1)}
          retryLabel={messages.retry}
          closeLabel={ui.dismiss}
        />
      ) : null}
      {owner && accounts !== undefined && accounts.length > 0 ? (
        <DataTable
          caption={fill(text.accounts, { guild: name })}
          locale={locale}
          columns={[
            { key: 'account', label: text.account, align: 'left', rowHeader: true },
            { key: 'role', label: text.role, align: 'left', nowrap: true },
            { key: 'action', label: text.remove, align: 'right', srOnly: true },
          ]}
          rows={accounts.map((account) => ({
            key: account.userId,
            cells: {
              // A null label (an account without an address) shows «—».
              account: account.accountLabel,
              role: roleLabel(account.role, text.roles),
              action:
                account.role === 'owner' ? (
                  ''
                ) : (
                  <Button
                    aria-haspopup="dialog"
                    onClick={() => setConfirmation({ kind: 'remove', account })}
                  >
                    {text.remove}
                  </Button>
                ),
            },
          }))}
        />
      ) : null}
      {owner ? (
        <div className="ac-account-row">
          <Button aria-haspopup="dialog" onClick={() => setConfirmation({ kind: 'delete' })}>
            {text.delete}
          </Button>
        </div>
      ) : null}
      {owner ? (
        <Dialog
          open={confirmation !== null}
          onClose={() => {
            setConfirmation(null);
            setConfirmError(null);
          }}
          title={
            removing !== null
              ? fill(text.removeTitle, { account: orUnknown(removing.accountLabel), guild: name })
              : fill(text.deleteTitle, { guild: name })
          }
          closeLabel={ui.close}
          alert
          actions={
            <>
              <Button {...initialFocus} onClick={() => setConfirmation(null)}>
                {messages.cancel}
              </Button>
              <Button variant="solid" onClick={confirm} disabled={confirming}>
                {removing !== null ? text.remove : text.delete}
              </Button>
            </>
          }
        >
          <p>{removing !== null ? text.removeText : text.deleteText}</p>
          {confirmError !== null ? (
            <Notice open onClose={() => setConfirmError(null)} closeLabel={ui.dismiss}>
              {confirmError}
            </Notice>
          ) : null}
        </Dialog>
      ) : null}
    </article>
  );
}

interface CreateGuildFormProps extends ClientProps {
  worlds: AccountWorld[];
  onCreated: () => void;
}

function CreateGuildForm({
  client,
  locale,
  messages,
  ui,
  worlds,
  onCreated,
}: CreateGuildFormProps) {
  const { guilds: text } = messages;
  const [name, setName] = useState('');
  const [world, setWorld] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // `create_guild` collapses runs of spaces too; the form only trims.
  const trimmed = name.trim();
  const ready =
    trimmed.length > 0 &&
    trimmed.length <= GUILD_NAME_MAX &&
    worlds.some((option) => option.id === world);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await createUserGuild(client, { name: trimmed, worldId: world });
      if (result.error) {
        // 23505 here is the same name twice in one world (12.14.1).
        setError(mapSupabaseError(result.error, locale, 'createGuild'));
        return;
      }
      setName('');
      setWorld('');
      onCreated();
    } catch (caught) {
      setError(mapSupabaseError(caught, locale, 'createGuild'));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <form className="ac-account-create" onSubmit={submit}>
        <TextField
          label={text.name}
          name="guild"
          value={name}
          onChange={setName}
          inputProps={{ required: true, autoComplete: 'off', maxLength: GUILD_NAME_MAX }}
        />
        <Select
          label={text.world}
          options={worlds.map((option) => ({ value: option.id, label: option.nombre }))}
          value={world}
          onChange={setWorld}
        />
        <Button type="submit" variant="solid" disabled={!ready || pending}>
          {pending ? messages.creating : text.create}
        </Button>
      </form>
      {error !== null ? (
        <Notice open onClose={() => setError(null)} closeLabel={ui.dismiss}>
          {error}
        </Notice>
      ) : null}
    </>
  );
}

// ------------------------------------------------------------------------ data calls
//
// Every account call goes through src/lib/supabase/trade.ts but the profile save: its refusals
// name the field in a fixed message (`username_taken`, `player_name_taken`… of
// account_save_profile, 9.12.3) that the reduced failure of trade.ts does not keep, and the form
// needs it to put the line under the right field. The function name still comes from TRADE_RPC.

/** The fields and reasons of the refusals of `account_save_profile` and its table guard. */
const PROFILE_REFUSALS: Readonly<Record<string, { field: ProfileField; reason: ProfileRefusal }>> =
  {
    username_invalid: { field: 'username', reason: 'invalid' },
    username_taken: { field: 'username', reason: 'taken' },
    username_locked: { field: 'username', reason: 'locked' },
    player_name_invalid: { field: 'player', reason: 'invalid' },
    player_name_taken: { field: 'player', reason: 'taken' },
    world_invalid: { field: 'world', reason: 'invalid' },
    country_invalid: { field: 'country', reason: 'invalid' },
    birth_date_required: { field: 'birthDate', reason: 'invalid' },
    birth_date_invalid: { field: 'birthDate', reason: 'invalid' },
    birth_date_underage: { field: 'birthDate', reason: 'underage' },
    birth_date_locked: { field: 'birthDate', reason: 'locked' },
    terms_required: { field: 'terms', reason: 'invalid' },
    terms_version_invalid: { field: 'terms', reason: 'invalid' },
  };

function profileOutcome(error: PostgrestError | null, status: number): ProfileSaveOutcome {
  if (error === null) return { ok: true };
  const refusal = Object.hasOwn(PROFILE_REFUSALS, error.message)
    ? PROFILE_REFUSALS[error.message]
    : null;
  return {
    ok: false,
    failure: toSupabaseFailure(error, status),
    field: refusal?.field ?? null,
    reason: refusal?.reason ?? 'invalid',
  };
}

/** Step 3 with the terms of this build (`TERMINOS_VERSION`); the database refuses any other. */
async function completeAccountProfile(
  client: SupabaseClient,
  values: NewProfileValues,
): Promise<ProfileSaveOutcome> {
  const { error, status } = await client.rpc(TRADE_RPC.saveProfile, {
    p_username: values.username,
    p_player_name: values.player,
    p_world_key: values.world,
    p_country_code: values.country,
    p_birth_date: values.birthDate,
    p_terms_version: TERMINOS_VERSION,
  });
  return profileOutcome(error, status);
}

/** «Perfil»: the birth date and the terms keep their saved values (null). */
async function updateAccountProfile(
  client: SupabaseClient,
  values: ProfileValues,
): Promise<ProfileSaveOutcome> {
  const { error, status } = await client.rpc(TRADE_RPC.saveProfile, {
    p_username: values.username,
    p_player_name: values.player,
    p_world_key: values.world,
    p_country_code: values.country,
    p_birth_date: null,
    p_terms_version: null,
  });
  return profileOutcome(error, status);
}
