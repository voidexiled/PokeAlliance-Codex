import { useId } from 'react';

import { fill } from '@/i18n/messages/types';
import { registrationSteps } from '@/lib/account/registration';
import { DISCORD_EDAD_MIN_DIAS } from '@/lib/trade/limits';

import { Button } from '@/components/controls/Button';
import { fieldId } from '@/components/controls/TextField';

import type { AccountMessages } from '../AccountPanel';
import { ProviderMark } from './providers';
import { authTexts } from './texts';
import { AuthCard, StepBar, emphasize } from './ui';

// «¡Listo!» (Cuenta-acceso 9): the last step saved. The finished step bar, one art touch (a
// Pokémon portrait the page resolves with `resolvePokemonImage`; optional), «Tu cuenta … está
// activa.», the Discord line when Comercio still needs it, «Volver a la wiki» and «Ir a mi
// cuenta».

export interface RegistrationDoneProps {
  messages: AccountMessages;
  username: string;
  phoneRequired: boolean;
  /** A portrait resolved on the server (content/pokemon.json `imagen`); null draws none. */
  art?: { src: string; alt: string } | null;
  /** Comercio is on and the account has no Discord: the line with «Vincular». */
  onLinkDiscord?: (() => void) | null;
  /** The wiki's home in the page's language. */
  wikiHref: string;
  /** «Ir a mi cuenta»: closes this card and shows the account. */
  onAccount: () => void;
}

export function RegistrationDone({
  messages,
  username,
  phoneRequired,
  art = null,
  onLinkDiscord = null,
  wikiHref,
  onAccount,
}: RegistrationDoneProps) {
  const texts = authTexts(messages);
  const uid = fieldId(useId());
  return (
    <AuthCard
      id={`${uid}-title`}
      top={
        <StepBar
          steps={registrationSteps({ phoneRequired })}
          current="done"
          messages={messages}
          texts={texts}
        />
      }
      title={
        <span className="ac-auth-done">
          {art === null ? null : (
            <img className="ac-auth-done__art" src={art.src} alt={art.alt} width={96} height={96} />
          )}
          {texts.doneTitle}
        </span>
      }
      lead={
        <span className="ac-auth-done__text">
          {emphasize(texts.doneText, 'username', username)}
        </span>
      }
    >
      {onLinkDiscord === null ? null : (
        <div className="ac-auth-done__discord">
          <p className="ac-auth-done__discord-text">
            {fill(texts.doneDiscord, { days: DISCORD_EDAD_MIN_DIAS })}
          </p>
          <button type="button" className="ac-auth-provider-outline" onClick={onLinkDiscord}>
            <ProviderMark provider="discord" outline />
            {texts.link}
          </button>
        </div>
      )}
      <div className="ac-auth-done__actions">
        <Button href={wikiHref} touch className="ac-auth-secondary">
          {texts.backToWiki}
        </Button>
        <Button variant="solid" touch className="ac-auth-primary" onClick={onAccount}>
          {texts.toAccount}
        </Button>
      </div>
    </AuthCard>
  );
}
