import { useEffect, useState } from 'react';
import type { SubmitEvent } from 'react';

import { fill } from '@/i18n/messages/types';
import { formatDate } from '@/lib/format/dates';
import { orUnknown } from '@/lib/format/unknown';
import {
  acceptGuildInvitation,
  createGuildInvitation,
  createUserGuild,
  deleteUserGuild,
  listGuildAccounts,
  removeGuildMember,
  type GuildAccount,
  type GuildInvitationRole,
  type SupabaseGuild,
} from '@/lib/supabase/account';
import { classifySupabaseError, mapSupabaseError } from '@/lib/supabase/errors';

import { Notice } from '@/components/content/Notice';
import { Button } from '@/components/controls/Button';
import { Dialog, initialFocus } from '@/components/controls/Dialog';
import { Select } from '@/components/controls/Select';
import { TextField } from '@/components/controls/TextField';
import { Glyph } from '@/components/icons/Glyph';
import { Section } from '@/components/layout/Section';

import { guildName, roleLabel } from './format';
import { ErrorNotice } from './notices';
import type { PanelContext } from './types';

// «Guilds» (M13, 10.4; Cuenta-panel.dc.html): one row per guild with its world and the
// account's role; an owner opens «Gestionar» for the invitation links, the accounts with access
// («Quitar») and «Eliminar guild». «Crear guild» closes the list. An invitation link
// (`#invitacion=<token>`) shows «Aceptar invitación» first.
//
// - The server enforces every permission (RLS and the security definer functions); what a role
//   may not do is hidden, never trusted.
// - The guild calls come from src/lib/supabase/account.ts, never from guilds.ts: that module
//   loads the Temporal polyfill, which only the Guild island may ship (3.13).
// - The confirmations are alert dialogs whose initial focus is «Cancelar»; an error of the
//   operation stays inside the dialog without closing it (10.4, CA-10.14).

/** `create_guild` accepts 1 to 64 printable characters. */
const GUILD_NAME_MAX = 64;

function accountPage(locale: string): URL {
  return new URL(`/${locale}/cuenta/`, window.location.origin);
}

function invitationLink(locale: string, token: string): string {
  const url = accountPage(locale);
  url.hash = `invitacion=${encodeURIComponent(token)}`;
  return url.toString();
}

interface GuildsSectionProps extends PanelContext {
  guilds: SupabaseGuild[] | undefined;
  error: unknown;
  onReload: () => void;
  invitation: string | null;
  /** The link was used or cannot be used: its token leaves the address. */
  onInvitationDone: () => void;
}

export default function GuildsSection(props: GuildsSectionProps) {
  const { client, locale, messages, panel, ui, worlds, guilds, error, onReload } = props;
  const { invitation, onInvitationDone } = props;
  const text = messages.guilds;
  const [accepting, setAccepting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  async function accept() {
    if (invitation === null || accepting) return;
    setAccepting(true);
    setNotice(null);
    try {
      const { data, error: failure } = await acceptGuildInvitation(client, invitation);
      if (failure || !data) {
        setNotice(mapSupabaseError(failure, locale));
        // An unknown, used or expired link (P0002) never works again: only a failed
        // connection keeps «Aceptar invitación» for another try.
        if (classifySupabaseError(failure) !== 'network') onInvitationDone();
        return;
      }
      setNotice(fill(text.joined, { guild: orUnknown(data.displayName) }));
      onInvitationDone();
      onReload();
    } catch (caught) {
      setNotice(mapSupabaseError(caught, locale));
    } finally {
      setAccepting(false);
    }
  }

  const worldName = (id: string): string =>
    orUnknown(worlds.find((world) => world.id === id)?.nombre);

  return (
    <Section id="cuenta-guilds" title={panel.sections.guilds}>
      {invitation !== null ? (
        <div className="ac-panel-box ac-panel-invite">
          <p className="ac-account-line">{text.invitation}</p>
          <Button variant="solid" onClick={() => void accept()} disabled={accepting}>
            {text.accept}
          </Button>
        </div>
      ) : null}
      {notice !== null ? (
        <Notice open onClose={() => setNotice(null)} closeLabel={ui.dismiss}>
          {notice}
        </Notice>
      ) : null}
      {error !== null && !dismissed ? (
        <ErrorNotice
          text={mapSupabaseError(error, locale)}
          onClose={() => setDismissed(true)}
          onRetry={() => {
            setDismissed(false);
            onReload();
          }}
          retryLabel={messages.retry}
          closeLabel={ui.dismiss}
        />
      ) : null}
      <ul
        className="ac-panel-list ac-panel-guilds"
        aria-busy={guilds === undefined && error === null ? 'true' : undefined}
      >
        {guilds !== undefined && guilds.length === 0 ? (
          <li className="ac-panel-guild__empty">{text.none}</li>
        ) : null}
        {(guilds ?? []).map((guild) => (
          <li key={guild.guild_id} className="ac-panel-guild">
            <GuildRow
              {...props}
              guild={guild}
              world={worldName(guild.world_key)}
              onDeleted={onReload}
            />
          </li>
        ))}
        <li className="ac-panel-guild ac-panel-guild--create">
          <CreateGuildForm {...props} onCreated={onReload} />
        </li>
      </ul>
    </Section>
  );
}

interface GuildRowProps extends PanelContext {
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

function GuildRow({ client, locale, messages, panel, ui, guild, world, onDeleted }: GuildRowProps) {
  const text = messages.guilds;
  const owner = guild.role === 'owner';
  const name = guildName(guild);
  const panelId = `cuenta-guild-${guild.guild_id}`;
  const [open, setOpen] = useState(false);
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
    if (!owner || !open) return undefined;
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
  }, [client, guild.guild_id, owner, open, version]);

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
    <article className="ac-panel-guild__card" aria-labelledby={`${panelId}-t`}>
      <div className="ac-panel-guild__head">
        <div className="ac-panel-guild__who">
          <h3 id={`${panelId}-t`} className="ac-panel-guild__name">
            {name}
          </h3>
          <p className="ac-panel-guild__meta">
            {world} · {roleLabel(guild.role, text.roles)}
          </p>
        </div>
        {owner ? (
          <Button
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((value) => !value)}
          >
            {panel.manage}
            <span className={open ? 'ac-panel-chevron ac-panel-chevron--open' : 'ac-panel-chevron'}>
              <Glyph name="chevron-down" size={12} />
            </span>
          </Button>
        ) : null}
      </div>
      {owner && open ? (
        <div id={panelId} className="ac-panel-guild__manage">
          <div className="ac-panel-guild__actions">
            <Button onClick={() => void createInvite('officer')} disabled={inviting}>
              {text.inviteOfficer}
            </Button>
            <Button onClick={() => void createInvite('member')} disabled={inviting}>
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
              <Button onClick={() => void copyLink()}>{text.copy}</Button>
            </div>
          ) : null}
          {notice !== null ? (
            <Notice open onClose={() => setNotice(null)} closeLabel={ui.dismiss}>
              {notice}
            </Notice>
          ) : null}
          {accountsError !== null ? (
            <ErrorNotice
              text={mapSupabaseError(accountsError, locale)}
              onClose={() => setAccountsError(null)}
              onRetry={() => setVersion((value) => value + 1)}
              retryLabel={messages.retry}
              closeLabel={ui.dismiss}
            />
          ) : null}
          {accounts !== undefined && accounts.length > 0 ? (
            <ul
              className="ac-panel-guild__accounts"
              aria-label={fill(text.accounts, { guild: name })}
            >
              {accounts.map((member) => (
                <li key={member.userId} className="ac-panel-guild__account">
                  <span className="ac-panel-guild__account-name">
                    {orUnknown(member.accountLabel)}
                  </span>
                  <span className="ac-panel-guild__account-role">
                    {roleLabel(member.role, text.roles)}
                  </span>
                  {member.role === 'owner' ? null : (
                    <Button
                      aria-haspopup="dialog"
                      onClick={() => setConfirmation({ kind: 'remove', account: member })}
                    >
                      {text.remove}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="ac-panel-guild__delete">
            <p className="ac-panel-setting__help">{text.deleteText}</p>
            <Button aria-haspopup="dialog" onClick={() => setConfirmation({ kind: 'delete' })}>
              {text.delete}
            </Button>
          </div>
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
              <Button variant="solid" onClick={() => void confirm()} disabled={confirming}>
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

function CreateGuildForm({
  client,
  locale,
  messages,
  ui,
  worlds,
  onCreated,
}: PanelContext & { onCreated: () => void }) {
  const text = messages.guilds;
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
