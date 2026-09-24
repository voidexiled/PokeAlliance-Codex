import { useId, useState } from 'react';
import type { SubmitEvent } from 'react';

import { CONTRASENA_MAX_BYTES, EMAIL_MAX } from '@/lib/account/registration';
import { classifySupabaseError, mapSupabaseError } from '@/lib/supabase/errors';

import { Button } from '@/components/controls/Button';
import { fieldId } from '@/components/controls/TextField';

import { CaptchaLine, useCaptcha } from './captcha';
import type { FormBaseProps } from './shared';
import { authTexts } from './texts';
import {
  AuthCard,
  AuthField,
  AuthFoot,
  AuthIcon,
  AuthInput,
  AuthNotice,
  PasswordInput,
  QuietButton,
} from './ui';

// «Iniciar sesión» (Cuenta-acceso 1): email, password with «Mostrar contraseña» and
// «¿Olvidaste tu contraseña?» on its label row, the invisible Turnstile check, «Entrar», and
// «¿No tienes cuenta? [Crear cuenta →]». A refused sign-in is the notice above the fields; an
// account whose code was never entered goes back to that step (`onUnconfirmed`). With
// `expired` the same card reads «Tu sesión caducó».

export interface SignInCardProps extends FormBaseProps {
  captchaSiteKey: string | null;
  /** Shared with the other cards, so the address survives «Crear cuenta» and back. */
  email: string;
  onEmail: (email: string) => void;
  onForgot: () => void;
  onSignUp: () => void;
  /** The account exists but its email was never confirmed: the code card, with this notice. */
  onUnconfirmed: (email: string, notice: string) => void;
  expired?: boolean;
}

export function SignInCard({
  client,
  locale,
  messages,
  captchaSiteKey,
  email,
  onEmail,
  onForgot,
  onSignUp,
  onUnconfirmed,
  expired = false,
}: SignInCardProps) {
  const { access } = messages;
  const texts = authTexts(messages);
  const uid = fieldId(useId());
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const captcha = useCaptcha(captchaSiteKey);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || captcha.missing) return;
    setPending(true);
    setNotice(null);
    const address = email.trim();
    try {
      const { error } = await client.auth.signInWithPassword({
        email: address,
        password,
        options: captcha.options,
      });
      if (error) {
        if (classifySupabaseError(error) === 'emailNotConfirmed') {
          setPassword('');
          onUnconfirmed(address, mapSupabaseError(error, locale));
        } else {
          setNotice(mapSupabaseError(error, locale));
        }
      }
    } catch (caught) {
      setNotice(mapSupabaseError(caught, locale));
    } finally {
      captcha.spend();
      setPending(false);
    }
  }

  return (
    <AuthCard
      id={`${uid}-title`}
      title={expired ? texts.expiredTitle : texts.signInTitle}
      lead={expired ? texts.expiredText : texts.signInText}
      leadSize={expired ? 'body' : 'small'}
    >
      <form className="ac-auth-form" onSubmit={submit}>
        {notice === null ? null : <AuthNotice lead={notice} />}
        <AuthField id={`${uid}-email`} label={access.email}>
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
        <AuthField
          id={`${uid}-password`}
          label={access.password}
          right={<QuietButton onClick={onForgot}>{access.forgot}</QuietButton>}
        >
          <PasswordInput
            id={`${uid}-password`}
            name="password"
            value={password}
            onChange={setPassword}
            showLabel={texts.showPassword}
            autoComplete="current-password"
            required
            maxLength={CONTRASENA_MAX_BYTES}
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
          {pending ? access.signingIn : access.signIn}
        </Button>
        <CaptchaLine captcha={captcha} messages={messages} />
      </form>
      <AuthFoot question={texts.noAccount}>
        <Button onClick={onSignUp} className="ac-auth-secondary">
          {access.signUp}
          <AuthIcon name="arrow" size={12} />
        </Button>
      </AuthFoot>
    </AuthCard>
  );
}
