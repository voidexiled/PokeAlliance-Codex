import { useState } from 'react';
import type { UserIdentity } from '@supabase/supabase-js';

import { fill } from '@/i18n/messages/types';
import { orUnknown } from '@/lib/format/unknown';
import { mapSupabaseError } from '@/lib/supabase/errors';
import { DISCORD_EDAD_MIN_DIAS } from '@/lib/trade/limits';

import { Notice } from '@/components/content/Notice';
import { Button } from '@/components/controls/Button';
import { Glyph } from '@/components/icons/Glyph';
import { Section } from '@/components/layout/Section';

import { linkProvider } from './auth-flow';
import { ProviderButton, ProviderTile } from './brand';
import { accountAgeText } from './format';
import { linkReturnMessage } from './link-return';
import { connectionRows, type ConnectionRow, type PanelProvider } from './model';
import type { LinkReturn, PanelContext } from './types';

// «Conexiones» (Cuenta-panel.dc.html, 9.15.1): one row per provider that is linked or that the
// build switches on (PUBLIC_AUTH_*) — its mark, its name and role (Discord and Google anchor
// the account, Twitch is an optional badge), «Vinculado · name» with the age of the Discord
// account and whether it meets Comercio's DISCORD_EDAD_MIN_DIAS, and the action: «Desvincular»
// (shown disabled on the only anchor), «Vincular Discord» (#5865F2), «Continuar con Google»
// (dark, multicolour G) or «Vincular Twitch». A provider that sent the browser back with an
// error or a cancel says so at the top of the section.

interface ConnectionsSectionProps extends PanelContext {
  discordAgeDays: number | null;
  linkReturn: LinkReturn | null;
  onLinkReturnDone: () => void;
}

export default function ConnectionsSection({
  client,
  locale,
  messages,
  panel,
  trade,
  ui,
  config,
  user,
  account,
  reload,
  discordAgeDays,
  linkReturn,
  onLinkReturnDone,
}: ConnectionsSectionProps) {
  const text = panel.connections;
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const rows = connectionRows<UserIdentity>(user.identities, config.providers);
  const returned =
    linkReturn === null
      ? null
      : linkReturnMessage(linkReturn, { messages, panel, trade, locale, cancelled: true });
  const name = (provider: PanelProvider) => trade.channels[provider];

  async function link(provider: PanelProvider) {
    if (pending) return;
    setPending(true);
    setNotice(null);
    onLinkReturnDone();
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
      else reload();
    } catch (caught) {
      setNotice(mapSupabaseError(caught, locale));
    } finally {
      setPending(false);
    }
  }

  /** The other anchor: the one whose link would free this one. */
  const otherAnchor = (provider: PanelProvider): PanelProvider =>
    provider === 'discord' ? 'google' : 'discord';

  function status(row: ConnectionRow<UserIdentity>) {
    if (row.identity === null) {
      return <p className="ac-panel-conn__status">{text.notLinked}</p>;
    }
    const parts = [orUnknown(row.name)];
    if (row.provider === 'discord' && discordAgeDays !== null) {
      parts.push(accountAgeText(discordAgeDays, text, locale));
    }
    return (
      <p className="ac-panel-conn__status ac-panel-conn__status--on">
        <span className="ac-panel-ok__mark">
          <Glyph name="check" size={14} />
        </span>
        {fill(messages.auth.linkedAs, { name: parts.join(' · ') })}
      </p>
    );
  }

  function detail(row: ConnectionRow<UserIdentity>): string | null {
    if (row.provider === 'twitch') return text.twitchHint;
    if (row.identity !== null) {
      if (row.provider !== 'discord' || !config.comercio) return null;
      const tooNew =
        account.comercioBlock === 'discord_too_new' ||
        (discordAgeDays !== null && discordAgeDays < DISCORD_EDAD_MIN_DIAS);
      return fill(tooNew ? messages.identities.discordTooNew : text.discordOk, {
        days: DISCORD_EDAD_MIN_DIAS,
      });
    }
    const other = otherAnchor(row.provider);
    const otherLinked = rows.some(
      (candidate) => candidate.provider === other && candidate.identity,
    );
    return otherLinked
      ? fill(text.anchorHint, { provider: name(row.provider), other: name(other) })
      : null;
  }

  function action(row: ConnectionRow<UserIdentity>) {
    const { identity, provider } = row;
    if (identity !== null) {
      const noteId = `cuenta-conn-${provider}-nota`;
      const other = otherAnchor(provider);
      return (
        <>
          <Button
            onClick={() => void unlink(identity)}
            disabled={pending || !row.unlinkable}
            aria-describedby={row.onlyAnchor ? noteId : undefined}
          >
            {messages.identities.unlink}
          </Button>
          {row.onlyAnchor ? (
            <p id={noteId} className="ac-panel-conn__note">
              {config.providers[other]
                ? fill(text.onlyAnchorHelp, { provider: name(other) })
                : text.onlyAnchor}
            </p>
          ) : null}
        </>
      );
    }
    if (provider === 'discord') {
      return (
        <ProviderButton provider="discord" onClick={() => void link('discord')} disabled={pending}>
          {messages.identities.linkDiscord}
        </ProviderButton>
      );
    }
    if (provider === 'google') {
      return (
        <ProviderButton provider="google" onClick={() => void link('google')} disabled={pending}>
          {messages.auth.continueGoogle}
        </ProviderButton>
      );
    }
    return (
      <Button onClick={() => void link('twitch')} disabled={pending}>
        {messages.identities.linkTwitch}
      </Button>
    );
  }

  return (
    <Section id="cuenta-conexiones" title={panel.sections.conexiones}>
      <p className="ac-panel-intro">{text.intro}</p>
      {returned !== null ? (
        <Notice open onClose={onLinkReturnDone} closeLabel={ui.dismiss}>
          <strong>{returned.lead}</strong>
          {returned.rest !== null ? ` ${returned.rest}` : null}
        </Notice>
      ) : null}
      {notice !== null ? (
        <Notice open onClose={() => setNotice(null)} closeLabel={ui.dismiss}>
          {notice}
        </Notice>
      ) : null}
      {rows.length > 0 ? (
        <ul className="ac-panel-list">
          {rows.map((row) => {
            const hint = detail(row);
            return (
              <li key={row.provider} className="ac-panel-conn">
                <ProviderTile provider={row.provider} size="lg" />
                <div className="ac-panel-conn__text">
                  <p className="ac-panel-conn__head">
                    <span className="ac-panel-conn__name">{name(row.provider)}</span>
                    <span className="ac-panel-conn__role">
                      {row.anchor ? messages.auth.stepIdentity : text.badge}
                    </span>
                  </p>
                  {status(row)}
                  {hint !== null ? <p className="ac-panel-conn__detail">{hint}</p> : null}
                </div>
                <div className="ac-panel-conn__action">{action(row)}</div>
              </li>
            );
          })}
        </ul>
      ) : null}
      {config.comercio ? (
        <p className="ac-panel-footnote">
          {text.channelsHint}{' '}
          <a className="ac-panel-arrow" href="#canales">
            {panel.sections.canales}
            <Glyph name="arrow-right" size={12} />
          </a>
        </p>
      ) : null}
    </Section>
  );
}
