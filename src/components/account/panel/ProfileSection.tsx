import { Section } from '@/components/layout/Section';

import { ProfileForm } from './auth-flow';
import { updateAccountProfile } from './profile-save';
import type { PanelContext } from './types';

// «Perfil» (9.16.3, Cuenta-panel.dc.html): the country, the player and the world, and the
// username until the first listing, with the profile form of the registration flow in its
// `edit` mode. The birth date never changes once saved, so it is not there.

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
          usernameLocked={account.usernameLocked}
          onSubmit={(values) => updateAccountProfile(client, values)}
          onSaved={reload}
        />
      </div>
    </Section>
  );
}
