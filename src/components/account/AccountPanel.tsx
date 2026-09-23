import { useEffect, useState } from 'react';
import type { SubmitEvent } from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';

import type { Locale } from '@/i18n/config';
import type { Messages } from '@/i18n/messages/en';
import { fill } from '@/i18n/messages/types';
import { formatDate } from '@/lib/format/dates';
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
import { classifySupabaseError, mapSupabaseError } from '@/lib/supabase/errors';

import { DataTable } from '@/components/content/DataTable';
import { FactLine, FactLines } from '@/components/content/FactLine';
import { Notice } from '@/components/content/Notice';
import { Button } from '@/components/controls/Button';
import { Dialog, initialFocus } from '@/components/controls/Dialog';
import { Select } from '@/components/controls/Select';
import { TextField } from '@/components/controls/TextField';
import { ToggleGroup } from '@/components/controls/ToggleGroup';
import { Section } from '@/components/layout/Section';

// The island of `/{l}/cuenta/` (spec 9.9 without Comercio, 10.4): «Acceso» (sign in, create an
// account, sign out) and «Guilds» (the account's guilds with their role, «Crear guild», and for
// an owner the invitations, the accounts with «Quitar» and «Eliminar guild»).
//
// - Until the session is known the region paints nothing and carries `aria-busy` (9.9).
// - Every Supabase error is shown with `mapSupabaseError` (12.14.1), never its raw message;
//   a failed read offers «Reintentar».
// - The confirmations are alert dialogs whose initial focus is «Cancelar»; an error of the
//   operation stays inside the dialog without closing it (10.4, CA-10.14).
// - An invitation link opens this page with `#invitacion=<token>`. The fragment never reaches
//   a server log; the token is only sent to `accept_guild_invitation` after the account presses
//   «Aceptar invitación», and is removed from the address once accepted.
// - The server enforces every permission (RLS and the security definer functions); the
//   owner-only controls are hidden for other roles, never trusted.
// - The data calls come from src/lib/supabase/account.ts, never from guilds.ts: that module
//   loads the Temporal polyfill, which only the Guild island may ship (3.13).

type AccountMessages = Messages['account'];

interface UiLabels {
  /** `ui.close`: the close button of the dialogs. */
  close: string;
  /** `ui.dismiss`: the close button of the notices. */
  dismiss: string;
}

export interface AccountWorld {
  id: string;
  nombre: string;
}

export interface AccountPanelProps {
  locale: Locale;
  /** content/mundos.json in the page's language: the «Mundo» Select and each guild's world. */
  worlds: AccountWorld[];
  messages: AccountMessages;
  ui: UiLabels;
}

/** 9.9: the minimum length of a new password. */
const PASSWORD_MIN = 8;
/** GoTrue rejects passwords over 72 bytes (bcrypt). */
const PASSWORD_MAX = 72;
/** RFC 5321: the longest address a mailbox can have. */
const EMAIL_MAX = 254;
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

export function AccountPanel({ locale, worlds, messages, ui }: AccountPanelProps) {
  // `undefined` while supabase-js loads (it is loaded on demand, client.ts).
  const [client, setClient] = useState<SupabaseClient | null | undefined>(undefined);
  // `undefined` while the session is unknown, `null` without one.
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [sessionError, setSessionError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  const [invitation, setInvitation] = useState<string | null>(null);

  useEffect(() => {
    setInvitation(readInvitation());
  }, []);

  useEffect(() => {
    // Loaded, or no account mode in this build: nothing to load. A failed load retries.
    if (client !== undefined) return undefined;
    let active = true;
    getSupabaseBrowserClient().then(
      (loaded) => {
        if (active) setClient(loaded);
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
        if (error) setSessionError(error);
        else setSession(data.session);
      },
      (error: unknown) => {
        if (active) setSessionError(error);
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
      {client !== undefined && client !== null && session !== undefined ? (
        <>
          <Section id="acceso" title={messages.access.title}>
            {session ? (
              <SignedIn
                client={client}
                session={session}
                locale={locale}
                messages={messages}
                ui={ui}
              />
            ) : (
              <>
                {invitation ? (
                  <p className="ac-account-line">{messages.guilds.invitationSignIn}</p>
                ) : null}
                <AccessForm client={client} locale={locale} messages={messages} ui={ui} />
              </>
            )}
          </Section>
          {session ? (
            <GuildsSection
              key={session.user.id}
              client={client}
              locale={locale}
              worlds={worlds}
              messages={messages}
              ui={ui}
              invitation={invitation}
              onInvitationDone={() => {
                clearInvitation();
                setInvitation(null);
              }}
            />
          ) : null}
        </>
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

type AccessMode = 'signIn' | 'signUp';

function AccessForm({ client, locale, messages, ui }: ClientProps) {
  const [mode, setMode] = useState<AccessMode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const { access } = messages;

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setNotice(null);
    const credentials = { email: email.trim(), password };
    try {
      if (mode === 'signIn') {
        const { error } = await client.auth.signInWithPassword(credentials);
        if (error) setNotice(mapSupabaseError(error, locale));
      } else {
        const { data, error } = await client.auth.signUp({
          ...credentials,
          // A confirmation link, when the project asks for one, comes back to this page.
          options: { emailRedirectTo: accountPage(locale).toString() },
        });
        if (error) {
          setNotice(mapSupabaseError(error, locale));
        } else if (data.session === null) {
          // The project asks for a confirmed email: the session arrives after the link.
          setPassword('');
          setNotice(access.created);
        }
      }
    } catch (caught) {
      setNotice(mapSupabaseError(caught, locale));
    } finally {
      setPending(false);
    }
  }

  const signIn = mode === 'signIn';
  let submitLabel = signIn ? access.signIn : access.signUp;
  if (pending) submitLabel = signIn ? access.signingIn : messages.creating;

  return (
    <form className="ac-account-form" onSubmit={submit}>
      <ToggleGroup
        label={access.title}
        options={[
          { value: 'signIn', label: access.signIn },
          { value: 'signUp', label: access.signUp },
        ]}
        value={mode}
        onChange={(value) => {
          setMode(value === 'signUp' ? 'signUp' : 'signIn');
          setNotice(null);
        }}
      />
      <TextField
        label={access.email}
        type="email"
        name="email"
        value={email}
        onChange={setEmail}
        inputProps={{ autoComplete: 'email', required: true, maxLength: EMAIL_MAX }}
      />
      <TextField
        label={access.password}
        type="password"
        name="password"
        value={password}
        onChange={setPassword}
        helper={signIn ? undefined : access.passwordHelp}
        inputProps={{
          autoComplete: signIn ? 'current-password' : 'new-password',
          required: true,
          minLength: signIn ? undefined : PASSWORD_MIN,
          maxLength: PASSWORD_MAX,
        }}
      />
      <Button type="submit" variant="solid" disabled={pending}>
        {submitLabel}
      </Button>
      {notice !== null ? (
        <Notice open onClose={() => setNotice(null)} closeLabel={ui.dismiss}>
          {notice}
        </Notice>
      ) : null}
    </form>
  );
}

function SignedIn({ client, session, locale, messages, ui }: ClientProps & { session: Session }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signOut() {
    setPending(true);
    setError(null);
    try {
      const result = await client.auth.signOut();
      if (result.error) setError(mapSupabaseError(result.error, locale));
    } catch (caught) {
      setError(mapSupabaseError(caught, locale));
    } finally {
      setPending(false);
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
      {error !== null ? (
        <Notice open onClose={() => setError(null)} closeLabel={ui.dismiss}>
          {error}
        </Notice>
      ) : null}
    </>
  );
}

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
