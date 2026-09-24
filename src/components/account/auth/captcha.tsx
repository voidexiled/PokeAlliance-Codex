import { useState } from 'react';

import type { Locale } from '@/i18n/config';

import type { AccountMessages } from '../AccountPanel';
import { TurnstileWidget } from '../TurnstileWidget';
import { QuietButton, QuietLine } from './ui';

/**
 * The Turnstile token of a form (D-B3): null while it loads, after each request (a token works
 * once) and without a site key, where no request needs one.
 */
export function useCaptcha(siteKey: string | null) {
  const [token, setToken] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  return {
    missing: siteKey !== null && token === null,
    failed,
    /** The `captchaToken` option of an Auth call. */
    options: token === null ? {} : { captchaToken: token },
    /** After a request: the token is spent, ask for another. */
    spend: () => {
      if (siteKey === null) return;
      setToken(null);
      setResetKey((value) => value + 1);
    },
    retry: () => {
      setFailed(false);
      setAttempt((value) => value + 1);
    },
    widget: (locale: Locale) =>
      siteKey === null ? null : (
        <TurnstileWidget
          key={attempt}
          siteKey={siteKey}
          locale={locale}
          resetKey={resetKey}
          onToken={(next) => {
            setToken(next);
            if (next !== null) setFailed(false);
          }}
          onError={() => setFailed(true)}
        />
      ),
  };
}

export type Captcha = ReturnType<typeof useCaptcha>;

/** «No se pudo completar la comprobación contra bots. [Reintentar]», under the button. */
export function CaptchaLine({
  captcha,
  messages,
}: {
  captcha: Captcha;
  messages: AccountMessages;
}) {
  if (!captcha.failed) return null;
  return (
    <QuietLine>
      {messages.access.captchaError}{' '}
      <QuietButton onClick={captcha.retry}>{messages.retry}</QuietButton>
    </QuietLine>
  );
}
