import { useId, useState } from 'react';
import type { SubmitEvent } from 'react';

import { fill } from '@/i18n/messages/types';
import { CONTRASENA_MAX_BYTES } from '@/lib/account/registration';
import { mapSupabaseError } from '@/lib/supabase/errors';
import { CONTRASENA_MIN } from '@/lib/trade/limits';

import { Button } from '@/components/controls/Button';
import { fieldId } from '@/components/controls/TextField';

import { passwordLength } from './logic';
import { errorId, focusField, type FormBaseProps } from './shared';
import { authTexts } from './texts';
import { AuthCard, AuthField, AuthNotice, ErrorLine, OkLine, PasswordInput, emphasize } from './ui';

// «Elige una contraseña nueva» (Cuenta-acceso 3): the new password twice, «10 caracteres o
// más» checked as it is typed, «Las contraseñas no coinciden.» under the second field once the
// form was sent, and `updateUser({ password })`. The recovery session of the link is the one
// that changes it.

export interface NewPasswordCardProps extends FormBaseProps {
  /** The address of the recovery session («Para kaiser@correo.com.»). */
  email?: string | null;
  headingLevel?: 1 | 2;
  /** The password was changed. */
  onDone: () => void;
}

export default function NewPasswordCard({
  client,
  locale,
  messages,
  email = null,
  headingLevel = 2,
  onDone,
}: NewPasswordCardProps) {
  const texts = authTexts(messages);
  const uid = fieldId(useId());
  const ids = { password: `${uid}-new`, repeat: `${uid}-repeat` };
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [checked, setChecked] = useState(false);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const longEnough = passwordLength(password) >= CONTRASENA_MIN;
  const mismatch = checked && repeat !== password;

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setChecked(true);
    if (!longEnough) {
      focusField(ids.password);
      return;
    }
    if (repeat !== password) {
      focusField(ids.repeat);
      return;
    }
    setPending(true);
    setNotice(null);
    try {
      const { error } = await client.auth.updateUser({ password });
      if (error) {
        setNotice(mapSupabaseError(error, locale));
        return;
      }
      setPassword('');
      setRepeat('');
      onDone();
    } catch (caught) {
      setNotice(mapSupabaseError(caught, locale));
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthCard
      id={`${uid}-title`}
      headingLevel={headingLevel}
      title={texts.resetTitle}
      lead={email === null ? undefined : emphasize(texts.resetFor, 'email', email)}
    >
      <form className="ac-auth-form" onSubmit={submit} noValidate>
        {notice === null ? null : <AuthNotice lead={notice} />}
        <AuthField
          id={ids.password}
          label={messages.access.newPassword}
          below={
            <OkLine id={`${ids.password}-rule`} met={longEnough}>
              {fill(texts.passwordLength, { n: CONTRASENA_MIN })}
            </OkLine>
          }
        >
          <PasswordInput
            id={ids.password}
            name="new-password"
            value={password}
            onChange={setPassword}
            showLabel={texts.showPassword}
            autoComplete="new-password"
            maxLength={CONTRASENA_MAX_BYTES}
            invalid={checked && !longEnough}
            aria-describedby={`${ids.password}-rule`}
          />
        </AuthField>
        <AuthField
          id={ids.repeat}
          label={texts.repeatPassword}
          below={mismatch ? <ErrorLine id={errorId(ids.repeat)} lead={texts.mismatch} /> : null}
        >
          <PasswordInput
            id={ids.repeat}
            name="repeat-password"
            value={repeat}
            onChange={setRepeat}
            showLabel={texts.showPassword}
            autoComplete="new-password"
            maxLength={CONTRASENA_MAX_BYTES}
            invalid={mismatch}
            aria-describedby={mismatch ? errorId(ids.repeat) : undefined}
          />
        </AuthField>
        <Button type="submit" variant="solid" touch className="ac-auth-primary" disabled={pending}>
          {texts.saveAndEnter}
        </Button>
      </form>
    </AuthCard>
  );
}
