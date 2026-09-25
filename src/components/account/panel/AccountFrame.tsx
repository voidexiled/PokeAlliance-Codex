import { useEffect, useState } from 'react';
import type { MouseEvent, ReactNode, RefObject } from 'react';

import type { Locale } from '@/i18n/config';
import { fill } from '@/i18n/messages/types';
import { identityAvatar, type IdentityLike } from '@/lib/account/registration';
import { GAME_ZONE } from '@/lib/format/dates';
import type { AccountSummary } from '@/lib/supabase/trade';

import { Glyph } from '@/components/icons/Glyph';

import type { AccountTradeTexts, AccountWorld } from '../AccountPanel';
import { Presence } from './Presence';
import { countryName, monthYear } from './format';
import { entryHref, initialOf, type PanelEntry, type PanelGroup } from './model';
import type { AccountPanelTexts } from './texts';

// The frame of every account page (Cuenta-panel.dc.html and its phone board): the header card,
// the grouped nav and the main column. `/{l}/cuenta/` (AccountShell.tsx) shows its sections in
// it, one at a time by the address fragment; «Mi perfil», «Mis anuncios» and «Mis operaciones»
// (AccountPage.tsx) are pages of their own drawn in the same frame, so the account never leaves
// the one interface.
//
// - From 768 the nav is a sticky column beside the card and the main column; the current entry
//   carries `aria-current="page"`. Section entries are fragments on `/{l}/cuenta/` and
//   `/{l}/cuenta/#perfil` from a page; page entries are their routes (model.ts, `entryHref`).
// - Below 768 the index (`current` null, `/{l}/cuenta/` only) is the card over the grouped rows,
//   each with its short value; anything else fills the view under «‹ Cuenta».
// - The card's button is «Ver perfil público», the seller page of the account, with Comercio (an
//   account of 18 or more); «Mi perfil» itself is an entry of the nav.
// It reads nothing from Supabase: the page that mounts it has the account.

/** The width from which the nav is a column (the `md` breakpoint, 48rem). */
const WIDE_QUERY = '(min-width: 48rem)';

/** Whether the viewport is 48rem or wider; only for islands that render after hydration. */
export function useWide(): boolean {
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

/** The texts the frame reads: the nav, the card, «Cuenta» and the online status labels. */
export interface FrameTexts {
  /** `account.title`: «Cuenta», the back link on a phone. */
  title: string;
  panel: Pick<AccountPanelTexts, 'nav' | 'groups' | 'sections' | 'card'>;
  presence: AccountTradeTexts['presence'];
}

export interface AccountFrameProps {
  locale: Locale;
  texts: FrameTexts;
  worlds: readonly AccountWorld[];
  /** The linked identities: the avatar of the card. */
  identities: readonly IdentityLike[] | null | undefined;
  account: AccountSummary;
  /** COMERCIO_PUBLICO and an account of 18 or more: the status and «Ver perfil público». */
  presenceOn: boolean;
  /** The nav groups with the entries this build and this account have. */
  groups: readonly { group: PanelGroup; sections: readonly PanelEntry[] }[];
  /** The entry the main column shows; null only for the phone index of `/{l}/cuenta/`. */
  current: PanelEntry | null;
  wide: boolean;
  /** The frame is `/{l}/cuenta/` itself: its sections are fragments of the page. */
  onRoot: boolean;
  /** The short value of a row of the phone index. */
  indexValue?: (entry: PanelEntry) => ReactNode;
  /** «‹ Cuenta» on a phone. */
  back: { href: string; onClick?: (event: MouseEvent<HTMLAnchorElement>) => void };
  mainRef?: RefObject<HTMLDivElement | null>;
  children?: ReactNode;
}

export function AccountFrame({
  locale,
  texts,
  worlds,
  identities,
  account,
  presenceOn,
  groups,
  current,
  wide,
  onRoot,
  indexValue,
  back,
  mainRef,
  children,
}: AccountFrameProps) {
  const { panel } = texts;
  const worldName = worlds.find((world) => world.id === account.world)?.nombre ?? null;
  const playerLine = [account.player, worldName].filter(Boolean).join(' · ') || null;
  const since =
    account.memberSince === null ? null : monthYear(account.memberSince, locale, GAME_ZONE);
  const avatar = identityAvatar(identities);
  const meta: ReactNode[] = [];
  if (presenceOn) {
    meta.push(
      <Presence key="p" value={account.presence} label={texts.presence[account.presence]} />,
    );
  }
  if (account.country) meta.push(<span key="c">{countryName(account.country, locale)}</span>);
  if (since !== null && wide) {
    meta.push(<span key="s">{fill(panel.card.memberSince, { date: since })}</span>);
  }
  const publicProfile =
    presenceOn && account.username !== null
      ? `/${locale}/comercio/vendedor/${encodeURIComponent(account.username)}/`
      : null;

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
      {publicProfile !== null ? (
        <a className="ac-panel-link-button" href={publicProfile}>
          {panel.card.publicProfile}
          <Glyph name="arrow-right" size={12} />
        </a>
      ) : null}
    </section>
  );

  const link = (entry: PanelEntry, className: string, content: ReactNode) => (
    <a
      className={className}
      href={entryHref(entry, locale, onRoot)}
      aria-current={wide && entry === current ? 'page' : undefined}
    >
      {content}
    </a>
  );

  function indexRow(entry: PanelEntry) {
    const value = indexValue?.(entry) ?? null;
    return link(
      entry,
      'ac-panel-index__row',
      <>
        <span className="ac-panel-index__label">{panel.sections[entry]}</span>
        {value !== null ? <span className="ac-panel-index__value">{value}</span> : null}
        <span className="ac-panel-index__chevron">
          <Glyph name="chevron-right" size={16} />
        </span>
      </>,
    );
  }

  const nav = wide ? (
    <nav className="ac-panel-nav" aria-label={panel.nav}>
      {groups.map(({ group, sections }) => (
        <div key={group} className="ac-panel-nav__group">
          <p className="ac-panel-nav__title" id={`cuenta-nav-${group}`}>
            {panel.groups[group]}
          </p>
          <ul className="ac-panel-nav__list" aria-labelledby={`cuenta-nav-${group}`}>
            {sections.map((entry) => (
              <li key={entry}>{link(entry, 'ac-panel-nav__link', panel.sections[entry])}</li>
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
            {sections.map((entry) => (
              <li key={entry}>{indexRow(entry)}</li>
            ))}
          </ul>
        </div>
      ))}
      <ul className="ac-panel-index__list">
        <li>{indexRow('eliminar')}</li>
      </ul>
    </nav>
  );

  return (
    <div className={wide ? 'ac-panel ac-panel--wide' : 'ac-panel'}>
      {wide || current === null ? card : null}
      {wide || current === null ? (
        nav
      ) : (
        <a className="ac-panel-back" href={back.href} onClick={back.onClick}>
          <span className="ac-panel-back__glyph">
            <Glyph name="chevron-right" size={18} />
          </span>
          {texts.title}
        </a>
      )}
      {current !== null ? (
        <div ref={mainRef} className="ac-panel__main" tabIndex={-1}>
          {children}
        </div>
      ) : null}
    </div>
  );
}
