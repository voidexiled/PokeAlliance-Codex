import { useState } from 'react';

import { fill } from '@/i18n/messages/types';
import { readCachedAccount } from '@/lib/account/session-cache';
import { orUnknown } from '@/lib/format/unknown';

import { Glyph } from '@/components/icons/Glyph';
import { Section } from '@/components/layout/Section';

import { ProfileForm } from './auth-flow';
import { characterLine } from './characters';
import { updateAccountProfile } from './profile-save';
import { readCharacterTexts } from './texts';
import type { PanelContext } from './types';

// «Perfil» (9.16.3, Cuenta-panel.dc.html): the country and the username until the first
// listing, with the profile form of the registration flow in its `edit` mode. The main character
// is one row that links to «Personajes» (Personajes.dc.html), where the characters change; the
// birth date never changes once saved, so it is not there.

export default function ProfileSection({
  client,
  locale,
  messages,
  panel,
  ui,
  worlds,
  account,
  reload,
}: PanelContext) {
  const text = readCharacterTexts();
  // How many characters the account has, as the header cache last saw it.
  const [total] = useState(() => readCachedAccount()?.characters ?? null);
  const others = total === null ? 0 : total - 1;
  const main =
    account.player === null
      ? null
      : characterLine({ playerName: account.player, worldKey: account.world ?? '' }, worlds);

  const mainCharacter =
    text === null ? null : (
      <div className="ac-panel-main-character">
        <p className="ac-panel-main-character__label">{text.profileRow}</p>
        <p className="ac-panel-main-character__value">
          {orUnknown(main)}
          {others > 0 ? (
            <span className="ac-panel-main-character__more">
              {fill(text.profileMore, { n: new Intl.NumberFormat(locale).format(others) })}
            </span>
          ) : null}
        </p>
        <a className="ac-panel-arrow" href="#personajes">
          {panel.sections.personajes}
          <Glyph name="arrow-right" size={12} />
        </a>
      </div>
    );

  return (
    <Section id="cuenta-perfil" title={panel.sections.perfil}>
      <p className="ac-panel-intro">{panel.profileIntro}</p>
      <div className="ac-panel-box ac-panel-form">
        <ProfileForm
          mode="edit"
          locale={locale}
          messages={messages}
          ui={ui}
          worlds={worlds}
          initial={{
            username: account.username ?? '',
            player: account.player ?? '',
            world: account.world ?? '',
            country: account.country ?? '',
          }}
          mainCharacter={mainCharacter}
          usernameLocked={account.usernameLocked}
          onSubmit={(values) => updateAccountProfile(client, values)}
          onSaved={reload}
        />
      </div>
    </Section>
  );
}
