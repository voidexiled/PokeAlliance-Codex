import { useState } from 'react';
import type { SubmitEvent } from 'react';

import { passwordProblem } from '@/lib/account/registration';
import { orUnknown } from '@/lib/format/unknown';
import { mapSupabaseError } from '@/lib/supabase/errors';
import { signOutAccount } from '@/lib/supabase/trade';

import { Notice } from '@/components/content/Notice';
import { Button } from '@/components/controls/Button';
import { TextField } from '@/components/controls/TextField';
import { Glyph } from '@/components/icons/Glyph';
import { Section } from '@/components/layout/Section';

import { PhoneVerification } from './auth-flow';
import { readSectionTexts } from './texts';
import type { PanelContext } from './types';

// «Seguridad» (Cuenta-panel.dc.html): settings rows — the email and whether it is confirmed, a
// new password (CONTRASENA_MIN to 72 bytes, `updateUser`), the phone with TELEFONO_OBLIGATORIO,
// and «Cerrar sesión», which with COMERCIO_PUBLICO sets `desconectado` first (9.16.2).

export default function SecuritySection({
  client,
  locale,
  messages,
  panel,
  ui,
  config,
  user,
  account,
  reload,
}: PanelContext) {
  // The texts of «Seguridad» travel beside the island, not in its props (panel/texts.ts).
  const text = readSectionTexts()?.security ?? null;
  const [changing, setChanging] = useState(false);
  const [password, setPassword] = useState('');
  const [shown, setShown] = useState(false);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const problem = passwordProblem(password);
  const error = shown && problem !== null ? messages.access.passwordHelp : undefined;

  async function savePassword(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setShown(true);
    if (problem !== null) return;
    setPending(true);
    setNotice(null);
    try {
      const { error: failure } = await client.auth.updateUser({ password });
      if (failure) {
        setNotice(mapSupabaseError(failure, locale));
        return;
      }
      setPassword('');
      setShown(false);
      setChanging(false);
      setNotice(messages.access.passwordSaved);
    } catch (caught) {
      setNotice(mapSupabaseError(caught, locale));
    } finally {
      setPending(false);
    }
  }

  async function signOut() {
    if (pending) return;
    setPending(true);
    setNotice(null);
    try {
      const { error: failure } = await signOutAccount(client, { presence: config.comercio });
      if (failure) setNotice(mapSupabaseError(failure, locale));
    } catch (caught) {
      setNotice(mapSupabaseError(caught, locale));
    } finally {
      setPending(false);
    }
  }

  if (text === null) return null;

  return (
    <Section id="cuenta-seguridad" title={panel.sections.seguridad}>
      {notice !== null ? (
        <Notice open onClose={() => setNotice(null)} closeLabel={ui.dismiss}>
          {notice}
        </Notice>
      ) : null}
      <ul className="ac-panel-list">
        <li className="ac-panel-setting">
          <p className="ac-panel-setting__label">{messages.access.email}</p>
          <div className="ac-panel-setting__body">
            <p className="ac-panel-setting__value">{orUnknown(user.email)}</p>
            {user.email_confirmed_at ? (
              <p className="ac-panel-ok ac-panel-ok--quiet">
                <span className="ac-panel-ok__mark">
                  <Glyph name="check" size={12} />
                </span>
                {text.confirmed}
              </p>
            ) : (
              <p className="ac-panel-setting__help">{text.unconfirmed}</p>
            )}
          </div>
        </li>
        <li className="ac-panel-setting">
          <p className="ac-panel-setting__label">{messages.access.password}</p>
          <div className="ac-panel-setting__body">
            {changing ? (
              <form className="ac-panel-password" onSubmit={savePassword} noValidate>
                <div className="ac-panel-password__row">
                  <TextField
                    label={messages.access.newPassword}
                    type="password"
                    name="new-password"
                    value={password}
                    onChange={setPassword}
                    helper={error ?? messages.access.passwordHelp}
                    inputProps={{
                      autoComplete: 'new-password',
                      'aria-invalid': error !== undefined ? true : undefined,
                    }}
                  />
                  <Button type="submit" variant="solid" disabled={pending}>
                    {pending ? messages.saving : messages.save}
                  </Button>
                </div>
                <Button
                  onClick={() => {
                    setChanging(false);
                    setPassword('');
                    setShown(false);
                  }}
                  disabled={pending}
                >
                  {messages.cancel}
                </Button>
              </form>
            ) : (
              <div className="ac-panel-setting__actions">
                <Button onClick={() => setChanging(true)}>{text.changePassword}</Button>
              </div>
            )}
          </div>
        </li>
        {config.phoneRequired || account.phoneRequired ? (
          <li className="ac-panel-setting">
            <p className="ac-panel-setting__label">{messages.verification.phone}</p>
            <div className="ac-panel-setting__body">
              <PhoneVerification
                client={client}
                locale={locale}
                messages={messages}
                ui={ui}
                user={user}
                onVerified={reload}
              />
            </div>
          </li>
        ) : null}
        <li className="ac-panel-setting">
          <p className="ac-panel-setting__label">{text.sessions}</p>
          <div className="ac-panel-setting__body">
            <div className="ac-panel-setting__actions">
              <Button onClick={() => void signOut()} disabled={pending}>
                {messages.access.signOut}
              </Button>
            </div>
            {config.comercio ? <p className="ac-panel-setting__help">{text.signOutHelp}</p> : null}
          </div>
        </li>
      </ul>
    </Section>
  );
}
