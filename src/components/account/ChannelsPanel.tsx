import { useEffect, useId, useState } from 'react';
import type { SubmitEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Locale } from '@/i18n/config';
import { fill } from '@/i18n/messages/types';
import { mapSupabaseError, type SupabaseOperation } from '@/lib/supabase/errors';
import {
  deleteChannel,
  listMyChannels,
  requestChannelCode,
  syncOauthChannels,
  upsertChannel,
  type TradeChannel,
} from '@/lib/supabase/trade';
import { PLATAFORMA_MAX } from '@/lib/trade/limits';

import { Notice } from '@/components/content/Notice';
import { Button } from '@/components/controls/Button';
import { Checkbox } from '@/components/controls/Checkbox';
import { TextField, fieldId } from '@/components/controls/TextField';
import { Section } from '@/components/layout/Section';
import { ContactChip } from '@/components/money/ContactChip';

import type { AccountMessages, AccountTradeTexts, UiLabels } from './AccountPanel';
import { Field, dialCodeOf, focusField, invalidProps } from './RegistrationSteps';

// «Canales de contacto» of `/{l}/cuenta/` (spec 9.9, 9.15.1), only with COMERCIO_PUBLICO: one row
// per channel with its `ContactChip`, its value (only the account sees it here), «Verificado» or
// «Pendiente» and, once verified, «Mostrar en mis anuncios».
//
// - Email and phone come verified from the account; Discord, Google and Twitch from the linked
//   identities, which `trade_sync_oauth_channels` turns into channels when the section opens
//   (after a link the browser comes back to this page).
// - «Añadir otra plataforma»: the platform (up to PLATAFORMA_MAX) and the user; the database
//   gives a code the account puts on its public profile there, and the channel stays «Pendiente»
//   and hidden until a moderator finds it (9.11, D-B5). «Generar código» gives a new one; the
//   database keeps only its hash, so a code shows once.
// - The public label is composed here from the kind: «Correo», «Teléfono +55», «Discord»… or
//   the platform (9.9); a phone never shows its number in public.
// - Every call goes through src/lib/supabase/trade.ts; each write is a database function that
//   checks the owner again (9.12.3). Errors are shown with `mapSupabaseError` (12.14.1).

/** The longest user an `other` channel takes. */
const CHANNEL_VALUE_MAX = 64;

/** The public label of a channel (9.9): the kind in the page's language, or the platform. */
export function channelLabel(
  channel: Pick<TradeChannel, 'kind' | 'platform' | 'value' | 'label'>,
  labels: AccountTradeTexts['channels'],
): string {
  switch (channel.kind) {
    case 'email':
      return labels.correo;
    case 'phone':
      // The owner reads the number itself: its calling code, else the one the database keeps.
      return fill(labels.telefono, {
        code: dialCodeOf(channel.value) ?? channel.label ?? '',
      }).trim();
    case 'discord':
      return labels.discord;
    case 'google':
      return labels.google;
    case 'twitch':
      return labels.twitch;
    default:
      return channel.platform ?? channel.label ?? '—';
  }
}

export interface ChannelsPanelProps {
  client: SupabaseClient;
  locale: Locale;
  messages: AccountMessages;
  labels: AccountTradeTexts['channels'];
  ui: UiLabels;
}

export function ChannelsPanel({ client, locale, messages, labels, ui }: ChannelsPanelProps) {
  const text = messages.channels;
  const [channels, setChannels] = useState<TradeChannel[] | undefined>(undefined);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [version, setVersion] = useState(0);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // The code of a channel, shown once after «Generar código».
  const [codes, setCodes] = useState<Readonly<Record<string, string>>>({});
  const reload = () => setVersion((value) => value + 1);

  useEffect(() => {
    let active = true;
    setLoadError(null);
    (async () => {
      // The identities linked since the last visit become channels; a refusal here still
      // lets the account see and change the channels it has.
      await syncOauthChannels(client).catch(() => null);
      return listMyChannels(client);
    })().then(
      ({ data, error }) => {
        if (!active) return;
        if (error || data === null) setLoadError(error);
        else setChannels(data);
      },
      (error: unknown) => {
        if (active) setLoadError(error);
      },
    );
    return () => {
      active = false;
    };
  }, [client, version]);

  async function run(action: () => Promise<SupabaseOperation<unknown>>, after: () => void) {
    if (pending) return;
    setPending(true);
    setNotice(null);
    try {
      const { error } = await action();
      if (error) setNotice(mapSupabaseError(error, locale));
      else after();
    } catch (caught) {
      setNotice(mapSupabaseError(caught, locale));
    } finally {
      setPending(false);
    }
  }

  function share(channel: TradeChannel, shared: boolean) {
    void run(
      () =>
        upsertChannel(client, {
          kind: channel.kind,
          platform: channel.platform,
          value: channel.value,
          shared,
        }),
      () =>
        setChannels((current) =>
          current?.map((row) => (row.id === channel.id ? { ...row, shared } : row)),
        ),
    );
  }

  async function newCode(channel: TradeChannel) {
    if (pending) return;
    setPending(true);
    setNotice(null);
    try {
      const { data, error } = await requestChannelCode(client, channel.id);
      if (error || data === null) setNotice(mapSupabaseError(error, locale));
      else setCodes((current) => ({ ...current, [channel.id]: data }));
    } catch (caught) {
      setNotice(mapSupabaseError(caught, locale));
    } finally {
      setPending(false);
    }
  }

  function remove(channel: TradeChannel) {
    void run(() => deleteChannel(client, channel.id), reload);
  }

  return (
    <Section id="canales" title={text.title}>
      {loadError !== null ? (
        <Notice open onClose={() => setLoadError(null)} closeLabel={ui.dismiss}>
          {mapSupabaseError(loadError, locale)} <Button onClick={reload}>{messages.retry}</Button>
        </Notice>
      ) : null}
      <div aria-busy={channels === undefined && loadError === null ? 'true' : undefined}>
        {channels !== undefined && channels.length > 0 ? (
          <ul className="ac-account-channels">
            {channels.map((channel) => {
              const code = codes[channel.id];
              return (
                <li key={channel.id} className="ac-account-channel">
                  <div className="ac-account-channel__head">
                    <ContactChip
                      label={channelLabel(channel, labels)}
                      verified={channel.verified}
                    />
                    <span className="ac-account-channel__value">{channel.value}</span>
                    <span className="ac-account-channel__state">
                      {channel.verified ? text.verified : text.pending}
                    </span>
                  </div>
                  {channel.verified ? (
                    <Checkbox
                      label={text.show}
                      checked={channel.shared}
                      onChange={(checked) => share(channel, checked)}
                      disabled={pending}
                    />
                  ) : null}
                  {channel.kind === 'other' ? (
                    <div className="ac-account-row">
                      {channel.verified ? null : (
                        <Button onClick={() => void newCode(channel)} disabled={pending}>
                          {text.requestCode}
                        </Button>
                      )}
                      <Button onClick={() => remove(channel)} disabled={pending}>
                        {text.remove}
                      </Button>
                    </div>
                  ) : null}
                  {code !== undefined && !channel.verified ? (
                    <p className="ac-account-line">
                      {fill(text.codeLine, { platform: channel.platform ?? '', code })}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
      {notice !== null ? (
        <Notice open onClose={() => setNotice(null)} closeLabel={ui.dismiss}>
          {notice}
        </Notice>
      ) : null}
      <OtherPlatformForm
        client={client}
        locale={locale}
        messages={messages}
        ui={ui}
        onAdded={(id, code) => {
          if (code !== null) setCodes((current) => ({ ...current, [id]: code }));
          reload();
        }}
      />
    </Section>
  );
}

interface OtherPlatformFormProps {
  client: SupabaseClient;
  locale: Locale;
  messages: AccountMessages;
  ui: UiLabels;
  /** The channel exists; `code` is null when it could not be generated yet. */
  onAdded: (id: string, code: string | null) => void;
}

/** «Añadir otra plataforma» (9.9, D-B5): the platform and the user, then its code. */
function OtherPlatformForm({ client, locale, messages, ui, onAdded }: OtherPlatformFormProps) {
  const text = messages.channels;
  const uid = fieldId(useId());
  const ids = { platform: `${uid}-platform`, user: `${uid}-user` };
  const [platform, setPlatform] = useState('');
  const [user, setUser] = useState('');
  const [shown, setShown] = useState(false);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const trimmedPlatform = platform.trim();
  const trimmedUser = user.trim();
  const errors = {
    platform:
      shown && (trimmedPlatform.length === 0 || trimmedPlatform.length > PLATAFORMA_MAX)
        ? text.platformInvalid
        : undefined,
    user:
      shown && (trimmedUser.length === 0 || trimmedUser.length > CHANNEL_VALUE_MAX)
        ? text.userInvalid
        : undefined,
  };

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setShown(true);
    if (trimmedPlatform.length === 0 || trimmedPlatform.length > PLATAFORMA_MAX) {
      focusField(ids.platform);
      return;
    }
    if (trimmedUser.length === 0 || trimmedUser.length > CHANNEL_VALUE_MAX) {
      focusField(ids.user);
      return;
    }
    setPending(true);
    setNotice(null);
    try {
      const added = await upsertChannel(client, {
        kind: 'other',
        platform: trimmedPlatform,
        value: trimmedUser,
        shared: false,
      });
      if (added.error || added.data === null) {
        setNotice(mapSupabaseError(added.error, locale));
        return;
      }
      const code = await requestChannelCode(client, added.data);
      if (code.error) setNotice(mapSupabaseError(code.error, locale));
      setPlatform('');
      setUser('');
      setShown(false);
      onAdded(added.data, code.data);
    } catch (caught) {
      setNotice(mapSupabaseError(caught, locale));
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="ac-account-form" onSubmit={submit} noValidate>
      <h3 className="ac-account-subtitle">{text.addOther}</h3>
      <Field id={ids.platform} error={errors.platform}>
        <TextField
          id={ids.platform}
          label={text.platform}
          name="platform"
          value={platform}
          onChange={setPlatform}
          inputProps={{
            autoComplete: 'off',
            maxLength: PLATAFORMA_MAX,
            ...invalidProps(errors.platform, ids.platform),
          }}
        />
      </Field>
      <Field id={ids.user} error={errors.user}>
        <TextField
          id={ids.user}
          label={text.user}
          name="platform-user"
          value={user}
          onChange={setUser}
          inputProps={{
            autoComplete: 'off',
            spellCheck: false,
            maxLength: CHANNEL_VALUE_MAX,
            ...invalidProps(errors.user, ids.user),
          }}
        />
      </Field>
      <Button type="submit" variant="solid" disabled={pending}>
        {text.requestCode}
      </Button>
      {notice !== null ? (
        <Notice open onClose={() => setNotice(null)} closeLabel={ui.dismiss}>
          {notice}
        </Notice>
      ) : null}
    </form>
  );
}
