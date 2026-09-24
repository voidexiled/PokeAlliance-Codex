import { useId, useState } from 'react';
import type { SubmitEvent } from 'react';

import { fill } from '@/i18n/messages/types';
import { CONTRASENA_MAX_BYTES, EMAIL_MAX, registrationSteps } from '@/lib/account/registration';
import { mapSupabaseError } from '@/lib/supabase/errors';
import { CONTRASENA_MIN } from '@/lib/trade/limits';

import { Button } from '@/components/controls/Button';
import { fieldId } from '@/components/controls/TextField';

import { CaptchaLine, useCaptcha } from './captcha';
import EmailCodeCard from './EmailCode';
import { passwordLength } from './logic';
import { confirmationUrl, errorId, signUpRefusal, type FormBaseProps } from './shared';
import { authTexts } from './texts';
import {
  AuthCard,
  AuthField,
  AuthFoot,
  AuthInput,
  AuthNotice,
  ErrorLine,
  Helper,
  OkLine,
  PasswordInput,
  QuietButton,
  StepBar,
} from './ui';

// «Crear cuenta», step 1 of 9.15.1 (Cuenta-acceso 4 and 5): email and password (10 or more,
// checked as it is typed) with the invisible Turnstile check, `signUp` with the confirmation
// link back to /{l}/cuenta/?confirmado=1, then the code card. An address that already has an
// account and a disposable domain are the line under «Correo», decided by code (shared.tsx);
// any other failure, «No pudimos enviar el correo de confirmación» included, is the notice.

export interface SignUpFlowProps extends FormBaseProps {
  captchaSiteKey: string | null;
  phoneRequired: boolean;
  email: string;
  onEmail: (email: string) => void;
  onSignIn: () => void;
  onForgot: () => void;
}

export default function SignUpFlow(props: SignUpFlowProps) {
  const [sentTo, setSentTo] = useState<string | null>(null);
  if (sentTo !== null) {
    return (
      <EmailCodeCard
        client={props.client}
        locale={props.locale}
        messages={props.messages}
        ui={props.ui}
        email={sentTo}
        captchaSiteKey={props.captchaSiteKey}
        phoneRequired={props.phoneRequired}
        onCancel={() => setSentTo(null)}
      />
    );
  }
  return <CredentialsCard {...props} onSent={setSentTo} />;
}

function CredentialsCard({
  client,
  locale,
  messages,
  captchaSiteKey,
  phoneRequired,
  email,
  onEmail,
  onSignIn,
  onForgot,
  onSent,
}: SignUpFlowProps & { onSent: (email: string) => void }) {
  const texts = authTexts(messages);
  const { access, register } = messages;
  const uid = fieldId(useId());
  const emailId = `${uid}-email`;
  const passwordId = `${uid}-password`;
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [refusal, setRefusal] = useState<'taken' | 'disposable' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const captcha = useCaptcha(captchaSiteKey);
  const longEnough = passwordLength(password) >= CONTRASENA_MIN;

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || captcha.missing) return;
    setPending(true);
    setNotice(null);
    setRefusal(null);
    const address = email.trim();
    try {
      const { data, error } = await client.auth.signUp({
        email: address,
        password,
        // A confirmation link in the same mail comes back to the account page with its mark.
        options: { emailRedirectTo: confirmationUrl(locale), ...captcha.options },
      });
      if (error) {
        const reason = signUpRefusal(error);
        if (reason === 'other') setNotice(mapSupabaseError(error, locale));
        else setRefusal(reason);
      } else if (data.session === null) {
        // With confirmations on, GoTrue answers an address it already has with a user
        // without identities instead of an error.
        if (data.user?.identities?.length === 0) {
          setRefusal('taken');
        } else {
          setPassword('');
          onSent(address);
        }
      }
      // With a session (confirmations off) the page moves to the next step by itself.
    } catch (caught) {
      setNotice(mapSupabaseError(caught, locale));
    } finally {
      captcha.spend();
      setPending(false);
    }
  }

  let emailBelow = <Helper id={`${emailId}-help`}>{texts.emailHelp}</Helper>;
  if (refusal === 'taken') {
    emailBelow = (
      <ErrorLine
        id={errorId(emailId)}
        lead={register.errors.emailTaken}
        action={
          <>
            <QuietButton onClick={onSignIn}>{texts.signInTitle}</QuietButton>
            {' · '}
            <QuietButton onClick={onForgot}>{access.forgot}</QuietButton>
          </>
        }
      />
    );
  } else if (refusal === 'disposable') {
    emailBelow = <ErrorLine id={errorId(emailId)} lead={register.errors.disposableEmail} />;
  }

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
      title={texts.signUpTitle}
      lead={texts.signUpText}
      leadSize="small"
    >
      <form className="ac-auth-form" onSubmit={submit}>
        {notice === null ? null : <AuthNotice lead={notice} />}
        <AuthField id={emailId} label={access.email} below={emailBelow}>
          <AuthInput
            id={emailId}
            type="email"
            name="email"
            value={email}
            onChange={(event) => {
              onEmail(event.target.value);
              setRefusal(null);
            }}
            autoComplete="email"
            required
            maxLength={EMAIL_MAX}
            aria-invalid={refusal === null ? undefined : true}
            aria-describedby={refusal === null ? `${emailId}-help` : errorId(emailId)}
          />
        </AuthField>
        <AuthField
          id={passwordId}
          label={access.password}
          below={
            <OkLine id={`${passwordId}-rule`} met={longEnough}>
              {fill(texts.passwordLength, { n: CONTRASENA_MIN })}
            </OkLine>
          }
        >
          <PasswordInput
            id={passwordId}
            name="password"
            value={password}
            onChange={setPassword}
            showLabel={texts.showPassword}
            autoComplete="new-password"
            required
            minLength={CONTRASENA_MIN}
            maxLength={CONTRASENA_MAX_BYTES}
            aria-describedby={`${passwordId}-rule`}
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
          {pending ? messages.creating : messages.verification.sendCode}
        </Button>
        <CaptchaLine captcha={captcha} messages={messages} />
      </form>
      <AuthFoot question={texts.haveAccount}>
        <Button onClick={onSignIn} className="ac-auth-secondary">
          {texts.signInTitle}
        </Button>
      </AuthFoot>
    </AuthCard>
  );
}
