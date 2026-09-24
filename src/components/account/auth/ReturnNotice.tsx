import { useState } from 'react';

import { fill } from '@/i18n/messages/types';
import { mapSupabaseError } from '@/lib/supabase/errors';

import { classifyReturn } from './logic';
import { linkProvider, type FormBaseProps, type LinkProvider } from './shared';
import { PROVIDER_NAME, authTexts } from './texts';
import { AuthNotice, QuietButton } from './ui';

// The notice above the account page after a provider or a mail link sent the browser back with
// an error (Cuenta-paginas «Otros estados»): the provider account is on another account, the
// person cancelled at the provider, the provider did not answer («Reintentar» links again), or
// a mail link expired or was used. Any other code is the §12.14.1 text.

export interface AuthReturnNoticeProps extends FormBaseProps {
  /** `error_code` (or `error`) of the address. */
  code: string;
  /** The provider of the pending link (`takeLinkingProvider`), null for a mail link. */
  provider: LinkProvider | null;
  onClose: () => void;
}

export function AuthReturnNotice({
  client,
  locale,
  messages,
  ui,
  code,
  provider,
  onClose,
}: AuthReturnNoticeProps) {
  const texts = authTexts(messages);
  const [pending, setPending] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const kind = classifyReturn(code, provider);
  const name = provider === null ? '' : PROVIDER_NAME[provider];
  const close = { onClose, closeLabel: ui.dismiss };

  if (retryError !== null) return <AuthNotice lead={retryError} {...close} />;
  switch (kind) {
    case 'taken':
      return (
        <AuthNotice
          lead={fill(texts.takenLead, { provider: name })}
          text={texts.takenText}
          {...close}
        />
      );
    case 'cancelled':
      return (
        <AuthNotice
          lead={fill(texts.cancelledLead, { provider: name })}
          text={texts.cancelledText}
          {...close}
        />
      );
    case 'linkUsed':
      return <AuthNotice lead={texts.linkUsedLead} text={texts.linkUsedText} {...close} />;
    case 'down':
      return (
        <AuthNotice
          lead={fill(texts.providerDownLead, { provider: name })}
          text={texts.providerDownText}
          action={
            <QuietButton
              disabled={pending || provider === null}
              onClick={() => {
                if (provider === null) return;
                setPending(true);
                void linkProvider(client, provider, locale).then((error) => {
                  if (error) {
                    setRetryError(mapSupabaseError(error, locale));
                    setPending(false);
                  }
                });
              }}
            >
              {messages.retry}
            </QuietButton>
          }
          {...close}
        />
      );
    case null:
      return null;
    default:
      return <AuthNotice lead={mapSupabaseError({ code, network: false }, locale)} {...close} />;
  }
}
