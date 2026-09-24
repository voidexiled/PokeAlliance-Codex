import { useId, useState } from 'react';
import type { SubmitEvent } from 'react';

import { fill } from '@/i18n/messages/types';
import { EMAIL_MAX } from '@/lib/account/registration';
import { mapSupabaseError } from '@/lib/supabase/errors';

import { Button } from '@/components/controls/Button';
import { fieldId } from '@/components/controls/TextField';

import { CaptchaLine, useCaptcha } from './captcha';
import { RESEND_SECONDS, formatCountdown } from './logic';
import { resetUrl, type FormBaseProps } from './shared';
import { authTexts } from './texts';
import {
  AuthCard,
  AuthField,
  AuthFoot,
  AuthIcon,
  AuthInput,
  AuthNotice,
  Helper,
  QuietButton,
  emphasize,
  useCountdown,
} from './ui';

// «¿Olvidaste tu contraseña?» (Cuenta-acceso 2 and 2b): the address, «Enviar enlace»
// (`resetPasswordForEmail`, back to /{l}/cuenta/restablecer/), then «Revisa tu correo» with the
// spam hint, «Reenviar enlace» after a countdown and «Volver a iniciar sesión». The sent card
// reads the same whether or not an account has that address.

export interface ForgotFlowProps extends FormBaseProps {
  captchaSiteKey: string | null;
  email: string;
  onEmail: (email: string) => void;
  onBack: () => void;
}

export default function ForgotFlow({
  client,
  locale,
  messages,
  captchaSiteKey,
  email,
  onEmail,
  onBack,
}: ForgotFlowProps) {
  const texts = authTexts(messages);
  const uid = fieldId(useId());
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const captcha = useCaptcha(captchaSiteKey);
  const countdown = useCountdown(RESEND_SECONDS);

  async function send(address: string): Promise<boolean> {
    if (pending || captcha.missing) return false;
    setPending(true);
    setNotice(null);
    try {
      const { error } = await client.auth.resetPasswordForEmail(address, {
        redirectTo: resetUrl(locale),
        ...captcha.options,
      });
      if (error) {
        setNotice(mapSupabaseError(error, locale));
        return false;
      }
      countdown.restart();
      return true;
    } catch (caught) {
      setNotice(mapSupabaseError(caught, locale));
      return false;
    } finally {
      captcha.spend();
      setPending(false);
    }
  }

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const address = email.trim();
    if (await send(address)) setSentTo(address);
  }

  const back = (
    <Button onClick={onBack} className="ac-auth-secondary">
      <AuthIcon name="back" size={12} />
      {texts.backToSignIn}
    </Button>
  );

  if (sentTo !== null) {
    return (
      <AuthCard
        id={`${uid}-title`}
        title={texts.checkTitle}
        lead={emphasize(texts.checkText, 'email', sentTo)}
      >
        <div className="ac-auth-form ac-auth-form--tight">
          <Helper>{texts.spamHint}</Helper>
          {notice === null ? null : <AuthNotice lead={notice} />}
          {captcha.widget(locale)}
          <CaptchaLine captcha={captcha} messages={messages} />
        </div>
        <AuthFoot
          question={
            countdown.left > 0 ? (
              fill(texts.resendLinkIn, { time: formatCountdown(countdown.left) })
            ) : (
              <QuietButton onClick={() => void send(sentTo)} disabled={pending || captcha.missing}>
                {texts.resendLink}
              </QuietButton>
            )
          }
        >
          {back}
        </AuthFoot>
      </AuthCard>
    );
  }

  return (
    <AuthCard id={`${uid}-title`} title={texts.forgotTitle} lead={texts.forgotText}>
      <form className="ac-auth-form" onSubmit={submit}>
        {notice === null ? null : <AuthNotice lead={notice} />}
        <AuthField id={`${uid}-email`} label={messages.access.email}>
          <AuthInput
            id={`${uid}-email`}
            type="email"
            name="email"
            value={email}
            onChange={(event) => onEmail(event.target.value)}
            autoComplete="email"
            required
            maxLength={EMAIL_MAX}
          />
        </AuthField>
        {captcha.widget(locale)}
        <Button
          type="submit"
          variant="solid"
          touch
          className="ac-auth-primary"
          disabled={pending || captcha.missing}
        >
          {texts.sendLink}
        </Button>
        <CaptchaLine captcha={captcha} messages={messages} />
      </form>
      <AuthFoot question={texts.remembered}>
        <Button onClick={onBack} className="ac-auth-secondary">
          {texts.signInTitle}
        </Button>
      </AuthFoot>
    </AuthCard>
  );
}
