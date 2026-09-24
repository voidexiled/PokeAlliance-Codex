import { fill } from '@/i18n/messages/types';
import { orUnknown } from '@/lib/format/unknown';
import type { SupabaseGuild } from '@/lib/supabase/account';
import type { TradeChannel } from '@/lib/supabase/trade';
import { DISCORD_EDAD_MIN_DIAS, EDAD_MINIMA_COMERCIO } from '@/lib/trade/limits';

import { Glyph } from '@/components/icons/Glyph';
import { Section } from '@/components/layout/Section';

import { ProviderTile } from './brand';
import { accountAgeText, channelName, guildName, roleLabel } from './format';
import { connectionRows, type PanelSection, type Requirement } from './model';
import { Presence } from './Presence';
import type { PanelContext } from './types';

// «Resumen» (Cuenta-panel.dc.html): with COMERCIO_PUBLICO the requirements of 9.15.2 as a
// checklist under the headline «Puedes publicar y contactar», then three cards — the linked
// identities, the online status (Comercio, 18 or more) and the guilds — each with the link to
// its section. The one section in the initial JS: it is the first paint from 768.

/** Guilds a card lists before «Guilds →» takes over. */
const CARD_GUILDS = 3;

export interface SummarySectionProps extends PanelContext {
  requirements: Requirement[];
  ready: boolean;
  discordAgeDays: number | null;
  presenceOn: boolean;
  guilds: SupabaseGuild[] | undefined;
  channels: TradeChannel[] | undefined;
}

export function SummarySection({
  locale,
  messages,
  panel,
  trade,
  config,
  user,
  account,
  requirements,
  ready,
  discordAgeDays,
  presenceOn,
  guilds,
  channels,
}: SummarySectionProps) {
  const text = panel.summary;
  const rows = connectionRows(user.identities, config.providers);
  const discord = rows.find((row) => row.provider === 'discord' && row.identity !== null);
  const visible = (channels ?? []).filter((channel) => channel.verified && channel.shared);

  function requirementText(requirement: Requirement): { title: string; detail: string | null } {
    switch (requirement.key) {
      case 'registration':
        return { title: text.registration, detail: text.registrationDetail };
      case 'age':
        return { title: fill(text.age, { n: EDAD_MINIMA_COMERCIO }), detail: text.ageDetail };
      case 'discord':
        return {
          title: fill(text.discord, { days: DISCORD_EDAD_MIN_DIAS }),
          detail:
            discord === undefined
              ? panel.connections.notLinked
              : [
                  discord.name,
                  discordAgeDays === null
                    ? null
                    : accountAgeText(discordAgeDays, panel.connections, locale),
                ]
                  .filter(Boolean)
                  .join(' · ') || null,
        };
      case 'channel':
        return {
          title: text.channel,
          detail:
            visible.length > 0
              ? visible.map((channel) => channelName(channel, trade.channels)).join(', ')
              : null,
        };
      case 'suspension':
        return { title: text.suspension, detail: null };
      default:
        return { title: text.consent, detail: requirement.done ? null : text.consentDetail };
    }
  }

  const more = (target: PanelSection, label: string) => (
    <a className="ac-panel-arrow" href={`#${target}`}>
      {label}
      <Glyph name="arrow-right" size={12} />
    </a>
  );

  return (
    <Section id="cuenta-resumen" title={panel.sections.resumen}>
      {config.comercio ? (
        <section className="ac-panel-box ac-panel-reqs" aria-labelledby="cuenta-reqs-t">
          <div className="ac-panel-reqs__head">
            <h3 id="cuenta-reqs-t" className="ac-panel-box__title">
              {text.requirements}
            </h3>
            {ready ? (
              <p className="ac-panel-ok">
                <span className="ac-panel-ok__mark">
                  <Glyph name="check" size={14} />
                </span>
                {text.ready}
              </p>
            ) : (
              <p className="ac-panel-muted">{text.notReady}</p>
            )}
          </div>
          <ul className="ac-panel-reqs__list">
            {requirements.map((requirement) => {
              const { title, detail } = requirementText(requirement);
              return (
                <li key={requirement.key} className="ac-panel-req">
                  <span className="ac-panel-req__mark" aria-hidden="true">
                    {requirement.done ? (
                      <Glyph name="check" size={14} />
                    ) : (
                      <span className="ac-panel-req__ring" />
                    )}
                  </span>
                  <div className="ac-panel-req__text">
                    <p className="ac-panel-req__title">
                      {title}
                      {requirement.done ? null : <span className="sr-only"> ({text.pending})</span>}
                    </p>
                    {detail !== null ? <p className="ac-panel-req__detail">{detail}</p> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
      <div className="ac-panel-cards">
        <section className="ac-panel-box ac-panel-mini" aria-labelledby="cuenta-mini-con">
          <h3 id="cuenta-mini-con" className="ac-panel-box__title">
            {panel.sections.conexiones}
          </h3>
          <ul className="ac-panel-mini__list">
            {rows.map((row) => (
              <li key={row.provider} className="ac-panel-mini__row">
                <ProviderTile provider={row.provider} size="sm" />
                <span className="ac-panel-mini__name">{trade.channels[row.provider]}</span>
                <span
                  className={
                    row.identity !== null
                      ? 'ac-panel-mini__value ac-panel-mini__value--on'
                      : 'ac-panel-mini__value'
                  }
                >
                  {row.identity !== null ? orUnknown(row.name) : panel.connections.notLinked}
                </span>
              </li>
            ))}
          </ul>
          {more('conexiones', panel.sections.conexiones)}
        </section>
        {presenceOn ? (
          <section className="ac-panel-box ac-panel-mini" aria-labelledby="cuenta-mini-est">
            <h3 id="cuenta-mini-est" className="ac-panel-box__title">
              {panel.sections.estado}
            </h3>
            <div>
              <p className="ac-panel-mini__state">
                <Presence value={account.presence} label={trade.presence[account.presence]} />
              </p>
              <p className="ac-panel-mini__help">{text.presenceHelp}</p>
            </div>
            {more('estado', text.changePresence)}
          </section>
        ) : null}
        <section className="ac-panel-box ac-panel-mini" aria-labelledby="cuenta-mini-gui">
          <h3 id="cuenta-mini-gui" className="ac-panel-box__title">
            {panel.sections.guilds}
          </h3>
          <div aria-busy={guilds === undefined ? 'true' : undefined}>
            {guilds !== undefined && guilds.length === 0 ? (
              <p className="ac-panel-mini__help">{messages.guilds.none}</p>
            ) : null}
            {guilds !== undefined && guilds.length > 0 ? (
              <ul className="ac-panel-mini__list">
                {guilds.slice(0, CARD_GUILDS).map((guild) => (
                  <li key={guild.guild_id} className="ac-panel-mini__row">
                    <span className="ac-panel-mini__name">{guildName(guild)}</span>
                    <span className="ac-panel-mini__value">
                      {roleLabel(guild.role, messages.guilds.roles)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          {more('guilds', panel.sections.guilds)}
        </section>
      </div>
    </Section>
  );
}
