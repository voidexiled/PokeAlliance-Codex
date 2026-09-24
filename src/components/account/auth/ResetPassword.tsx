import { Suspense, lazy, useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Locale } from '@/i18n/config';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { mapSupabaseError } from '@/lib/supabase/errors';

import type { AccountMessages, UiLabels } from '../AccountPanel';
import { authTexts } from './texts';
import { AuthCard, AuthNotice, AuthStack, QuietButton } from './ui';

// The island of `/{l}/cuenta/restablecer/`, where the «¿Olvidaste tu contraseña?» mail lands
// (`resetPasswordForEmail` with this `redirectTo`). supabase-js turns the link into a recovery
// session (PKCE `code` in the query); with it the card asks for the new password and then goes
// to `/{l}/cuenta/`. A link that expired, was used, or opened without its session (another
// browser) shows «Ese enlace venció o ya se usó» with «Pedir otro enlace». Until the session is
// known the region paints nothing and carries `aria-busy`.

const NewPasswordCard = lazy(() => import('./NewPassword'));

const RETURN_ERROR_KEYS = ['error', 'error_code', 'error_description'];

/** Whether the link came back with an error (removed from the address once read). */
function takeLinkError(): boolean {
  const url = new URL(window.location.href);
  const hash = new URLSearchParams(url.hash.slice(1));
  const failed = RETURN_ERROR_KEYS.some((key) => url.searchParams.has(key) || hash.has(key));
  if (!failed) return false;
  for (const key of RETURN_ERROR_KEYS) url.searchParams.delete(key);
  url.hash = '';
  window.history.replaceState(window.history.state, '', url.toString());
  return true;
}

type State =
  | { kind: 'loading' }
  | { kind: 'expired' }
  | { kind: 'failed'; error: unknown }
  | { kind: 'ready'; client: SupabaseClient; email: string | null };

export interface ResetPasswordPanelProps {
  locale: Locale;
  messages: AccountMessages;
  ui: UiLabels;
}

export function ResetPasswordPanel({ locale, messages, ui }: ResetPasswordPanelProps) {
  const texts = authTexts(messages);
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (takeLinkError()) {
      setState({ kind: 'expired' });
      return undefined;
    }
    let active = true;
    let unsubscribe: (() => void) | null = null;
    getSupabaseBrowserClient().then(
      async (client) => {
        if (!active) return;
        if (client === null) {
          setState({ kind: 'expired' });
          return;
        }
        // supabase-js announces the recovery session right after it reads the link.
        const { data } = client.auth.onAuthStateChange((_event, session) => {
          if (active && session !== null) {
            setState({ kind: 'ready', client, email: session.user.email ?? null });
          }
        });
        unsubscribe = () => data.subscription.unsubscribe();
        const { data: current, error } = await client.auth.getSession();
        if (!active) return;
        if (!error && current.session !== null) {
          setState({ kind: 'ready', client, email: current.session.user.email ?? null });
        } else {
          setState((previous) => (previous.kind === 'ready' ? previous : { kind: 'expired' }));
        }
      },
      (error: unknown) => {
        if (active) setState({ kind: 'failed', error });
      },
    );
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [attempt]);

  const account = `/${locale}/cuenta/`;

  return (
    <div className="ac-auth-page" aria-busy={state.kind === 'loading' ? 'true' : undefined}>
      <AuthStack>
        {state.kind === 'failed' ? (
          <AuthNotice
            lead={mapSupabaseError(state.error, locale)}
            action={
              <QuietButton onClick={() => setAttempt((value) => value + 1)}>
                {messages.retry}
              </QuietButton>
            }
          />
        ) : null}
        {state.kind === 'expired' ? (
          <AuthCard id="restablecer-titulo" headingLevel={1} title={texts.resetTitle}>
            <AuthNotice
              lead={texts.linkExpiredLead}
              text={texts.linkExpiredText}
              action={
                <a className="ac-auth-quiet" href={`${account}#recuperar`}>
                  {texts.requestAnother}
                </a>
              }
            />
          </AuthCard>
        ) : null}
        {state.kind === 'ready' ? (
          <Suspense fallback={null}>
            <NewPasswordCard
              client={state.client}
              locale={locale}
              messages={messages}
              ui={ui}
              email={state.email}
              headingLevel={1}
              onDone={() => window.location.assign(account)}
            />
          </Suspense>
        ) : null}
      </AuthStack>
    </div>
  );
}
