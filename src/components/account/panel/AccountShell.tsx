import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

import { fill, plural } from '@/i18n/messages/types';
import { discordAccountAgeDays, discordIdOf, identityAvatar } from '@/lib/account/registration';
import { GAME_ZONE } from '@/lib/format/dates';
import { listUserGuilds, type SupabaseGuild } from '@/lib/supabase/account';
import { mapSupabaseError } from '@/lib/supabase/errors';
import { listMyChannels, setPresenceState, type TradeChannel } from '@/lib/supabase/trade';
import type { EstadoPresencia } from '@/lib/trade/limits';

import { Glyph } from '@/components/icons/Glyph';

import { ProviderTile } from './brand';
import { Presence } from './Presence';
import { countryName, guildName, monthYear } from './format';
import {
  availableSections,
  comercioReady,
  comercioRequirements,
  connectionRows,
  guildsSummary,
  initialOf,
  sectionFromHash,
  visibleGroups,
  type PanelSection,
} from './model';
import { SummarySection } from './SummarySection';
import type { LinkReturn, PanelContext } from './types';

// The structured account page of a complete account (Cuenta-panel.dc.html and its phone board):
// the header card, the grouped section nav (Cuenta, Comercio, Guild, then «Eliminar cuenta»
// apart) and one section at a time, chosen by the address fragment (`#perfil`, `#personajes`,
// `#conexiones`…).
//
// - From 768 the nav is a sticky column beside the card and the section, and no fragment means
//   «Resumen». Below 768 no fragment is the index (the card and the grouped rows, each with its
//   short value) and a section fills the screen under «‹ Cuenta».
// - A pending invitation opens «Guilds», and a provider that sent the browser back from a link
//   opens «Conexiones», until the account picks a section itself.
// - Only «Resumen» ships with the page; every other section is a chunk of its own (13.6).
// - The guilds and, with COMERCIO_PUBLICO, the contact channels are read here once: «Resumen»,
//   the index values and «Eliminar cuenta» all show them; the sections that change them ask
//   for a new read.

const ProfileSection = lazy(() => import('./ProfileSection'));
const CharactersSection = lazy(() => import('./CharactersSection'));
const ConnectionsSection = lazy(() => import('./ConnectionsSection'));
const SecuritySection = lazy(() => import('./SecuritySection'));
const ChannelsSection = lazy(() => import('./ChannelsSection'));
const PresenceSection = lazy(() => import('./PresenceSection'));
const GuildsSection = lazy(() => import('./GuildsSection'));
const DeleteSection = lazy(() => import('./DeleteSection'));

/** The width from which the nav is a column (the `md` breakpoint, 48rem). */
const WIDE_QUERY = '(min-width: 48rem)';

export interface AccountShellProps extends PanelContext {
  /** The chosen online status changed here: the page updates the account and the header cache. */
  onPresence: (value: EstadoPresencia) => void;
  invitation: string | null;
  onInvitationDone: () => void;
  linkReturn: LinkReturn | null;
  onLinkReturnDone: () => void;
  onDeleted: () => void;
}

function useWide(): boolean {
  const [wide, setWide] = useState(() => window.matchMedia(WIDE_QUERY).matches);
  useEffect(() => {
    const query = window.matchMedia(WIDE_QUERY);
    const update = () => setWide(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return wide;
}

/** A read the shell keeps: `undefined` while it runs, its error apart, and a way to repeat it. */
function useRead<T>(
  enabled: boolean,
  client: SupabaseClient,
  read: (client: SupabaseClient) => Promise<{ data: T | null; error: unknown }>,
): { data: T | undefined; error: unknown; reload: () => void } {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<unknown>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!enabled) return undefined;
    let active = true;
    setError(null);
    read(client).then(
      (result) => {
        if (!active) return;
        if (result.error || result.data === null) setError(result.error);
        else setData(result.data);
      },
      (caught: unknown) => {
        if (active) setError(caught);
      },
    );
    return () => {
      active = false;
    };
  }, [enabled, client, read, version]);
  return { data, error, reload: () => setVersion((value) => value + 1) };
}

const busy = <div className="ac-account-busy" aria-busy="true" />;

export function AccountShell(props: AccountShellProps) {
  const {
    client,
    locale,
    messages,
    panel,
    trade,
    ui,
    config,
    worlds,
    user,
    account,
    reload,
    onPresence,
    invitation,
    onInvitationDone,
    linkReturn,
    onLinkReturnDone,
    onDeleted,
  } = props;
  const context: PanelContext = {
    client,
    locale,
    messages,
    panel,
    trade,
    ui,
    config,
    worlds,
    user,
    account,
    reload,
  };

  // The online status is Comercio's: a complete account of 18 or more (9.15.6).
  const presenceOn = config.comercio && account.adult === true;
  const available = useMemo(
    () => availableSections({ comercio: config.comercio, presence: presenceOn }),
    [config.comercio, presenceOn],
  );
  const groups = useMemo(() => visibleGroups(available), [available]);
  const wide = useWide();

  // The fragment's section; a pending invitation opens «Guilds». It stays where it is when the
  // invitation is used, until the account picks another section.
  const [chosenSection, setChosenSection] = useState<PanelSection | null>(
    () =>
      sectionFromHash(window.location.hash, available) ?? (invitation !== null ? 'guilds' : null),
  );
  const navigated = useRef(false);
  useEffect(() => {
    const update = () => {
      navigated.current = true;
      setChosenSection(sectionFromHash(window.location.hash, available));
    };
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, [available]);

  // A provider that sent the browser back from a link opens «Conexiones», where it says why.
  const returned = linkReturn !== null;
  useEffect(() => {
    if (returned) setChosenSection((current) => current ?? 'conexiones');
  }, [returned]);

  const section: PanelSection | null = chosenSection ?? (wide ? 'resumen' : null);

  // After the account moves to another section, the focus follows it (and, on a phone, the view
  // starts at the top).
  const main = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!navigated.current) return;
    navigated.current = false;
    if (!wide) window.scrollTo(0, 0);
    main.current?.focus({ preventScroll: !wide });
  }, [section, wide]);

  function backToIndex(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    window.history.pushState(window.history.state, '', window.location.pathname);
    navigated.current = true;
    setChosenSection(null);
  }

  const guilds = useRead<SupabaseGuild[]>(true, client, listUserGuilds);
  const channels = useRead<TradeChannel[]>(config.comercio, client, listMyChannels);

  // The age of the Discord account, from its id, as the database computes it (9.15.2).
  const [now] = useState(() => Date.now());
  const discordId = discordIdOf(user.identities);
  const discordAgeDays = discordId === null ? null : discordAccountAgeDays(discordId, now);
  const requirements = comercioRequirements({
    registrationComplete: account.registrationComplete,
    adult: account.adult,
    suspendedUntil: account.suspendedUntil,
    consentCurrent: account.consentCurrent,
    comercioBlock: account.comercioBlock,
    discordAgeDays,
    visibleChannels:
      channels.data === undefined
        ? null
        : channels.data.filter((channel) => channel.verified && channel.shared).length,
  });
  const ready = comercioReady(requirements);

  async function choosePresence(value: EstadoPresencia): Promise<string | null> {
    const previous = account.presence;
    if (value === previous) return null;
    // The dot of the header follows at once (9.16.2); a refusal puts the old state back.
    onPresence(value);
    try {
      const { error } = await setPresenceState(client, value);
      if (!error) return null;
      onPresence(previous);
      return mapSupabaseError(error, locale);
    } catch (caught) {
      onPresence(previous);
      return mapSupabaseError(caught, locale);
    }
  }

  function sectionNode(current: PanelSection): ReactNode {
    switch (current) {
      case 'resumen':
        return (
          <SummarySection
            {...context}
            requirements={requirements}
            ready={ready}
            discordAgeDays={discordAgeDays}
            presenceOn={presenceOn}
            guilds={guilds.data}
            channels={channels.data}
          />
        );
      case 'perfil':
        return <ProfileSection {...context} />;
      case 'personajes':
        return <CharactersSection {...context} />;
      case 'conexiones':
        return (
          <ConnectionsSection
            {...context}
            discordAgeDays={discordAgeDays}
            linkReturn={linkReturn}
            onLinkReturnDone={onLinkReturnDone}
          />
        );
      case 'seguridad':
        return <SecuritySection {...context} />;
      case 'canales':
        return <ChannelsSection {...context} onChanged={channels.reload} />;
      case 'estado':
        return <PresenceSection {...context} value={account.presence} onChoose={choosePresence} />;
      case 'guilds':
        return (
          <GuildsSection
            {...context}
            guilds={guilds.data}
            error={guilds.error}
            onReload={guilds.reload}
            invitation={invitation}
            onInvitationDone={onInvitationDone}
          />
        );
      default:
        return (
          <DeleteSection
            {...context}
            ownedGuilds={guilds.data?.filter((guild) => guild.role === 'owner').map(guildName)}
            onDeleted={onDeleted}
          />
        );
    }
  }

  /** The short value of a row of the phone index. */
  function indexValue(current: PanelSection): ReactNode {
    switch (current) {
      case 'resumen':
        return config.comercio && ready ? (
          <>
            <span className="ac-panel-ok__mark">
              <Glyph name="check" size={12} />
            </span>
            {panel.summary.comercioReady}
          </>
        ) : null;
      case 'personajes':
        return playerLine;
      case 'conexiones': {
        const linked = connectionRows(user.identities, config.providers).find(
          (row) => row.identity !== null,
        );
        return linked ? (
          <>
            <ProviderTile provider={linked.provider} size="xs" />
            {trade.channels[linked.provider]}
          </>
        ) : null;
      }
      case 'canales': {
        if (channels.data === undefined) return null;
        const visible = channels.data.filter((channel) => channel.verified && channel.shared);
        return fill(plural(locale, visible.length, panel.summary.visibleChannels), {
          n: new Intl.NumberFormat(locale).format(visible.length),
        });
      }
      case 'estado':
        return <Presence value={account.presence} label={trade.presence[account.presence]} />;
      case 'guilds': {
        const summary = guildsSummary((guilds.data ?? []).map(guildName));
        if (summary === null) return null;
        return summary.more === 0
          ? summary.first
          : fill(panel.summary.guildsMore, {
              guild: summary.first,
              n: new Intl.NumberFormat(locale).format(summary.more),
            });
      }
      default:
        return null;
    }
  }

  const worldName = worlds.find((world) => world.id === account.world)?.nombre ?? null;
  const playerLine = [account.player, worldName].filter(Boolean).join(' · ') || null;
  const since =
    account.memberSince === null ? null : monthYear(account.memberSince, locale, GAME_ZONE);
  const avatar = identityAvatar(user.identities);
  const meta: ReactNode[] = [];
  if (presenceOn) {
    meta.push(
      <Presence key="p" value={account.presence} label={trade.presence[account.presence]} />,
    );
  }
  if (account.country) meta.push(<span key="c">{countryName(account.country, locale)}</span>);
  if (since !== null && wide) {
    meta.push(<span key="s">{fill(panel.card.memberSince, { date: since })}</span>);
  }

  const card = (
    <section className="ac-panel-card" aria-label={panel.card.label}>
      <div className="ac-panel-card__who">
        <span className="ac-panel-avatar" aria-hidden="true">
          {avatar !== null ? (
            <img
              className="ac-panel-avatar__image"
              src={avatar}
              alt=""
              referrerPolicy="no-referrer"
            />
          ) : (
            initialOf(account.username)
          )}
          {presenceOn ? (
            <span className="ac-panel-avatar__dot" data-presence={account.presence} />
          ) : null}
        </span>
        <div className="ac-panel-card__text">
          <h2 className="ac-panel-card__name">{account.username}</h2>
          {playerLine !== null ? <p className="ac-panel-card__player">{playerLine}</p> : null}
          {meta.length > 0 ? (
            <p className="ac-panel-card__meta">
              {meta.map((item, index) => (
                <span key={index} className="ac-panel-card__meta-item">
                  {index > 0 ? (
                    <span className="ac-panel-sep" aria-hidden="true">
                      ·
                    </span>
                  ) : null}
                  {item}
                </span>
              ))}
            </p>
          ) : null}
        </div>
      </div>
      <a className="ac-panel-link-button" href={`/${locale}/cuenta/perfil/`}>
        {panel.card.myProfile}
        <Glyph name="arrow-right" size={12} />
      </a>
    </section>
  );

  const link = (current: PanelSection, className: string, children: ReactNode) => (
    <a
      className={className}
      href={`#${current}`}
      aria-current={wide && current === section ? 'page' : undefined}
    >
      {children}
    </a>
  );

  const nav = wide ? (
    <nav className="ac-panel-nav" aria-label={panel.nav}>
      {groups.map(({ group, sections }) => (
        <div key={group} className="ac-panel-nav__group">
          <p className="ac-panel-nav__title" id={`cuenta-nav-${group}`}>
            {panel.groups[group]}
          </p>
          <ul className="ac-panel-nav__list" aria-labelledby={`cuenta-nav-${group}`}>
            {sections.map((current) => (
              <li key={current}>{link(current, 'ac-panel-nav__link', panel.sections[current])}</li>
            ))}
          </ul>
        </div>
      ))}
      <div role="none" className="ac-panel-nav__rule" />
      <ul className="ac-panel-nav__list">
        <li>{link('eliminar', 'ac-panel-nav__link', panel.sections.eliminar)}</li>
      </ul>
    </nav>
  ) : (
    <nav className="ac-panel-index" aria-label={panel.nav}>
      {groups.map(({ group, sections }) => (
        <div key={group} className="ac-panel-index__group">
          <p className="ac-panel-index__title" id={`cuenta-nav-${group}`}>
            {panel.groups[group]}
          </p>
          <ul className="ac-panel-index__list" aria-labelledby={`cuenta-nav-${group}`}>
            {sections.map((current) => (
              <li key={current}>{indexRow(current)}</li>
            ))}
          </ul>
        </div>
      ))}
      <ul className="ac-panel-index__list">
        <li>{indexRow('eliminar')}</li>
      </ul>
    </nav>
  );

  function indexRow(current: PanelSection) {
    const value = indexValue(current);
    return link(
      current,
      'ac-panel-index__row',
      <>
        <span className="ac-panel-index__label">{panel.sections[current]}</span>
        {value !== null ? <span className="ac-panel-index__value">{value}</span> : null}
        <span className="ac-panel-index__chevron">
          <Glyph name="chevron-right" size={16} />
        </span>
      </>,
    );
  }

  return (
    <div className={wide ? 'ac-panel ac-panel--wide' : 'ac-panel'}>
      {wide || section === null ? card : null}
      {wide || section === null ? (
        nav
      ) : (
        <a className="ac-panel-back" href={window.location.pathname} onClick={backToIndex}>
          <span className="ac-panel-back__glyph">
            <Glyph name="chevron-right" size={18} />
          </span>
          {messages.title}
        </a>
      )}
      {section !== null ? (
        <div ref={main} className="ac-panel__main" tabIndex={-1}>
          <Suspense fallback={busy}>{sectionNode(section)}</Suspense>
        </div>
      ) : null}
    </div>
  );
}
