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
import { Glyph } from '@/components/icons/Glyph';
import { Section } from '@/components/layout/Section';

import type { AccountMessages, AccountTradeTexts, UiLabels } from './AccountPanel';
import { LetterTile, ProviderTile } from './panel/brand';
import type { AccountPanelTexts } from './panel/texts';
import { Field, dialCodeOf, focusField, invalidProps } from './RegistrationSteps';

// «Canales de contacto» of `/{l}/cuenta/` (spec 9.9, 9.15.1; Cuenta-panel.dc.html), only with
// COMERCIO_PUBLICO: one row per channel with its mark (the provider's, or a letter), its label,
// its value (only the account sees it here), «Verificado» or «Pendiente» and, once verified,
// «Mostrar en mis anuncios». The last row opens «Añadir otra plataforma».
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
  panel: AccountPanelTexts;
  labels: AccountTradeTexts['channels'];
  ui: UiLabels;
  /** A channel was added, removed or shown: the page reads the channels again. */
  onChanged: () => void;
}

/** The mark of a channel: the provider's, «@» for the email, «#» for the phone, else a letter. */
function ChannelTile({ channel }: { channel: TradeChannel }) {
  switch (channel.kind) {
    case 'discord':
    case 'google':
    case 'twitch':
      return <ProviderTile provider={channel.kind} size="md" />;
    case 'email':
      return <LetterTile letter="@" size="md" />;
    case 'phone':
      return <LetterTile letter="#" size="md" />;
    default:
      return (
        <LetterTile
          letter={(Array.from(channel.platform ?? '')[0] ?? '?').toLocaleUpperCase()}
          size="md"
        />
      );
  }
}

export function ChannelsPanel({
  client,
  locale,
  messages,
  panel,
  labels,
  ui,
  onChanged,
}: ChannelsPanelProps) {
  const text = messages.channels;
  const [adding, setAdding] = useState(false);
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
      () => {
        setChannels((current) =>
          current?.map((row) => (row.id === channel.id ? { ...row, shared } : row)),
        );
        onChanged();
      },
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
    void run(
      () => deleteChannel(client, channel.id),
      () => {
        reload();
        onChanged();
      },
    );
  }

  return (
    <Section id="cuenta-canales" title={panel.sections.canales}>
      <p className="ac-panel-intro">{panel.channelsIntro}</p>
      {loadError !== null ? (
        <Notice open onClose={() => setLoadError(null)} closeLabel={ui.dismiss}>
          {mapSupabaseError(loadError, locale)} <Button onClick={reload}>{messages.retry}</Button>
        </Notice>
      ) : null}
      {notice !== null ? (
        <Notice open onClose={() => setNotice(null)} closeLabel={ui.dismiss}>
          {notice}
        </Notice>
      ) : null}
      <ul
        className="ac-panel-list"
        aria-busy={channels === undefined && loadError === null ? 'true' : undefined}
      >
        {(channels ?? []).map((channel) => {
          const code = codes[channel.id];
          const label = channelLabel(channel, labels);
          return (
            <li key={channel.id} className="ac-panel-channel">
              <ChannelTile channel={channel} />
              <div className="ac-panel-channel__text">
                <span className="ac-panel-channel__name">{label}</span>
                <span className="ac-panel-channel__line">
                  <span className="ac-panel-channel__value">{channel.value}</span>
                  <span className="ac-panel-sep" aria-hidden="true">
                    ·
                  </span>
                  {channel.verified ? (
                    <span className="ac-panel-ok ac-panel-ok--quiet">
                      <span className="ac-panel-ok__mark">
                        <Glyph name="check" size={12} />
                      </span>
                      {text.verified}
                    </span>
                  ) : (
                    <span>{text.pending}</span>
                  )}
                </span>
                {code !== undefined && !channel.verified ? (
                  <p className="ac-panel-channel__code">
                    {fill(text.codeLine, { platform: channel.platform ?? '', code })}
                  </p>
                ) : null}
                {channel.kind === 'other' && !channel.verified ? (
                  <div className="ac-panel-channel__more">
                    <Button onClick={() => void newCode(channel)} disabled={pending}>
                      {text.requestCode}
                    </Button>
                  </div>
                ) : null}
              </div>
              <div className="ac-panel-channel__action">
                {channel.verified ? (
                  <Checkbox
                    label={text.show}
                    checked={channel.shared}
                    onChange={(checked) => share(channel, checked)}
                    disabled={pending}
                  />
                ) : null}
                {channel.kind === 'other' ? (
                  <Button
                    onClick={() => remove(channel)}
                    disabled={pending}
                    aria-label={`${text.remove} ${label}`}
                  >
                    {text.remove}
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
        <li className="ac-panel-channel ac-panel-channel--footer">
          <Button
            aria-expanded={adding}
            aria-controls="cuenta-canales-otra"
            onClick={() => setAdding((value) => !value)}
          >
            {text.addOther}
          </Button>
          <p className="ac-panel-setting__help">{panel.channelsFooter}</p>
        </li>
      </ul>
      {adding ? (
        <OtherPlatformForm
          client={client}
          locale={locale}
          messages={messages}
          ui={ui}
          onAdded={(id, code) => {
            if (code !== null) setCodes((current) => ({ ...current, [id]: code }));
            setAdding(false);
            reload();
            onChanged();
          }}
        />
      ) : null}
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
    <form
      id="cuenta-canales-otra"
      className="ac-account-form ac-panel-box"
      aria-label={text.addOther}
      onSubmit={submit}
      noValidate
    >
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
