import { useId, useState } from 'react';
import type { SubmitEvent } from 'react';

import { fill } from '@/i18n/messages/types';
import { registrationSteps } from '@/lib/account/registration';
import { mapSupabaseError, toSupabaseFailure } from '@/lib/supabase/errors';

import { Button } from '@/components/controls/Button';
import { fieldId } from '@/components/controls/TextField';

import { CaptchaLine, useCaptcha } from './captcha';
import { CODE_LENGTH, RESEND_SECONDS, formatCountdown } from './logic';
import { confirmationUrl, errorId, type FormBaseProps } from './shared';
import { authTexts } from './texts';
import {
  AuthCard,
  AuthField,
  AuthNotice,
  CodeInput,
  ErrorLine,
  Helper,
  QuietButton,
  StepBar,
  useCountdown,
  type AuthNoticeProps,
} from './ui';

// Step 1, second card (9.15.1, Cuenta-acceso «Confirma tu correo»): the 6-digit code of the
// confirmation mail (`verifyOtp` type `email`), six boxes over one one-time-code input, «Reenviar
// código» after a countdown (`resend` type `signup`, with a fresh Turnstile token) and the spam
// hint. A wrong or expired code (`otp_expired`) is the line under the boxes; any other failure,
// «No pudimos enviar el correo de confirmación» included, is the notice above the form.

export interface EmailCodeCardProps extends FormBaseProps {
  /** The address the code went to. */
  email: string;
  captchaSiteKey: string | null;
  phoneRequired: boolean;
  /** A notice to show from the start (the refused sign-in of an unconfirmed account). */
  initialNotice?: AuthNoticeProps | null;
  /** «Cambiar correo»: back to step 1; absent for a signed-in account. */
  onCancel?: () => void;
  /** The code was accepted: the session that follows moves the page on by itself. */
  onVerified?: () => void;
}

export default function EmailCodeCard({
  client,
  locale,
  messages,
  ui,
  email,
  captchaSiteKey,
  phoneRequired,
  initialNotice = null,
  onCancel,
  onVerified,
}: EmailCodeCardProps) {
  const texts = authTexts(messages);
  const text = messages.register;
  const uid = fieldId(useId());
  const codeId = `${uid}-code`;
  const [code, setCode] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<AuthNoticeProps | null>(initialNotice);
  const captcha = useCaptcha(captchaSiteKey);
  const countdown = useCountdown(RESEND_SECONDS);

  async function verify(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || code.length !== CODE_LENGTH) return;
    setInvalid(false);
    setPending(true);
    setNotice(null);
    try {
      const { error } = await client.auth.verifyOtp({ email, token: code, type: 'email' });
      if (error) {
        if (toSupabaseFailure(error).code === 'otp_expired') setInvalid(true);
        else setNotice({ lead: mapSupabaseError(error, locale) });
        return;
      }
      onVerified?.();
    } catch (caught) {
      setNotice({ lead: mapSupabaseError(caught, locale) });
    } finally {
      setPending(false);
    }
  }

  async function resend() {
    if (pending || captcha.missing) return;
    setPending(true);
    setNotice(null);
    try {
      const { error } = await client.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: confirmationUrl(locale), ...captcha.options },
      });
      if (error) {
        setNotice({
          lead: mapSupabaseError(error, locale),
          action: <QuietButton onClick={() => void resend()}>{messages.retry}</QuietButton>,
        });
      } else {
        setInvalid(false);
        setCode('');
        countdown.restart();
        setNotice({ lead: text.resent, ok: true });
      }
    } catch (caught) {
      setNotice({ lead: mapSupabaseError(caught, locale) });
    } finally {
      captcha.spend();
      setPending(false);
    }
  }

  const canResend = countdown.left === 0 && !pending && !captcha.missing;
  const resendButton = (
    <QuietButton onClick={() => void resend()} disabled={!canResend}>
      {text.resend}
    </QuietButton>
  );

  return (
    <AuthCard
      id={`${uid}-title`}
      top={
        <StepBar
          steps={registrationSteps({ phoneRequired })}
          current="credentials"
          messages={messages}
          texts={texts}
        />
      }
      title={texts.confirmTitle}
      lead={texts.codeSentTo}
    >
      <div className="ac-auth-email-row">
        <strong className="ac-auth-email-row__address">{email}</strong>
        {onCancel ? <QuietButton onClick={onCancel}>{texts.changeEmail}</QuietButton> : null}
      </div>
      <form className="ac-auth-form ac-auth-form--tight" onSubmit={verify} noValidate>
        {notice === null ? null : (
          <AuthNotice {...notice} onClose={() => setNotice(null)} closeLabel={ui.dismiss} />
        )}
        <AuthField
          id={codeId}
          label={text.code}
          below={
            <>
              {invalid ? (
                <ErrorLine id={errorId(codeId)} lead={texts.codeInvalid} action={resendButton} />
              ) : null}
              {countdown.left > 0 ? (
                <Helper>{fill(texts.resendIn, { time: formatCountdown(countdown.left) })}</Helper>
              ) : null}
              {countdown.left === 0 && !invalid ? <div>{resendButton}</div> : null}
              <Helper>{texts.codeSpam}</Helper>
            </>
          }
        >
          <CodeInput
            id={codeId}
            value={code}
            onChange={(value) => {
              setCode(value);
              if (invalid) setInvalid(false);
            }}
            invalid={invalid}
            describedBy={invalid ? errorId(codeId) : undefined}
          />
        </AuthField>
        {captcha.widget(locale)}
        <Button
          type="submit"
          variant="solid"
          touch
          className="ac-auth-primary"
          disabled={pending || code.length !== CODE_LENGTH}
        >
          {texts.confirm}
        </Button>
        <CaptchaLine captcha={captcha} messages={messages} />
      </form>
    </AuthCard>
  );
}
