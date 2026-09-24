import { Suspense, lazy, useState } from 'react';
import type { ReactNode } from 'react';

import type { RegistrationStep } from '@/lib/account/registration';
import { registrationSteps } from '@/lib/account/registration';

import { SignInCard } from './auth/SignIn';
import type { RegistrationStepsProps } from './auth/Registration';
import { confirmationReturn, type FormBaseProps } from './auth/shared';
import { authTexts } from './auth/texts';
import { AuthNotice, AuthStack, StepBar, requestCardFocus } from './auth/ui';

// The access and registration of `/{l}/cuenta/` (spec 9.9 «Acceso», 9.15.1), which AccountPanel
// composes, drawn as the Direction D cards (Cuenta-acceso.dc.html, Cuenta-paginas.dc.html,
// auth.css). Registration applies to every account (9.15.1): until its steps are done the page
// shows only the steps.
//
// - `AccessForm`: without a session, one centred card at a time: «Iniciar sesión», «Crear
//   cuenta» (step 1 and its code, auth/SignUp.tsx) and «¿Olvidaste tu contraseña?»
//   (auth/Forgot.tsx). The address typed in one card follows to the others. `#crear` and
//   `#recuperar` open those cards directly. A return from the confirmation link without a
//   session says «Correo confirmado…» or «Ese enlace ya no sirve…» above the card.
// - `RegistrationSteps`: the steps a signed-in account has not done (auth/Registration.tsx).
// - `ProfileForm` (auth/ProfileForm.tsx): step 3 and «Perfil».
// - `PhoneForm` / `PhoneVerification` (auth/phone.tsx): only with TELEFONO_OBLIGATORIO.
// - `NewPasswordForm`: the new password in the recovery state of the page; the mail link of
//   «¿Olvidaste tu contraseña?» now lands on /{l}/cuenta/restablecer/ (auth/ResetPassword.tsx).
//
// Only «Iniciar sesión» is in the first paint; every other card loads when it is needed (13.6).
// Every limit comes from src/lib/trade/limits.ts and the database enforces it again (9.12.3).
// Every error is shown with `mapSupabaseError` (12.14.1); the few codes that name a field get
// their own dictionary line, decided by code, never by message (auth/shared.tsx).

export {
  Field,
  accountUrl,
  focusField,
  invalidProps,
  linkProvider,
  takeLinkingProvider,
  type LinkProvider,
} from './auth/shared';
export {
  PhoneForm,
  PhoneVerification,
  dialCodeOf,
  maskPhone,
  type PhoneFormProps,
  type PhoneVerificationProps,
} from './auth/phone';
export { isCountryCode } from './auth/countries';
export { confirmationReturn } from './auth/arrival';
export { AuthReturnNotice, type AuthReturnNoticeProps } from './auth/ReturnNotice';
export { RegistrationDone, type RegistrationDoneProps } from './auth/Done';
export {
  ProfileForm,
  type EditProfileFormProps,
  type NewProfileValues,
  type ProfileField,
  type ProfileRefusal,
  type ProfileSaveOutcome,
  type ProfileValues,
  type RegisterProfileFormProps,
} from './auth/ProfileForm';
export type { RegistrationStep, RegistrationStepsProps };

const SignUpFlow = lazy(() => import('./auth/SignUp'));
const ForgotFlow = lazy(() => import('./auth/Forgot'));
const EmailCodeCard = lazy(() => import('./auth/EmailCode'));
const RegistrationFlow = lazy(() => import('./auth/Registration'));
const NewPasswordCard = lazy(() => import('./auth/NewPassword'));

// --------------------------------------------------------------------- «Acceso» cards

type AccessView = 'signIn' | 'signUp' | 'forgot';

/** `#crear` and `#recuperar` (the «Pedir otro enlace» of restablecer) open their card. */
function initialView(): AccessView {
  if (typeof window === 'undefined') return 'signIn';
  if (window.location.hash === '#crear') return 'signUp';
  if (window.location.hash === '#recuperar') return 'forgot';
  return 'signIn';
}

export interface AccessFormProps extends FormBaseProps {
  /** PUBLIC_TURNSTILE_SITE_KEY; null renders no check and sends no token (S11). */
  captchaSiteKey: string | null;
  /** TELEFONO_OBLIGATORIO: the phone is a step of the bar. */
  phoneRequired: boolean;
  /** The header kept an account whose session is gone: «Tu sesión caducó». */
  expired?: boolean;
}

export function AccessForm({
  client,
  locale,
  messages,
  ui,
  captchaSiteKey,
  phoneRequired,
  expired = false,
}: AccessFormProps) {
  const texts = authTexts(messages);
  const [view, setView] = useState<AccessView>(initialView);
  const [email, setEmail] = useState('');
  // Step 1 of 9.15.1: an account whose code was never entered, back from «Entrar».
  const [confirming, setConfirming] = useState<{ email: string; notice: string } | null>(null);
  const [arrival, setArrival] = useState(() => confirmationReturn());
  const common = { client, locale, messages, ui, captchaSiteKey };

  function go(next: AccessView) {
    requestCardFocus();
    setConfirming(null);
    setView(next);
  }

  let card: ReactNode;
  if (confirming !== null) {
    card = (
      <EmailCodeCard
        {...common}
        email={confirming.email}
        phoneRequired={phoneRequired}
        initialNotice={{ lead: confirming.notice }}
        onCancel={() => go('signUp')}
      />
    );
  } else if (view === 'signUp') {
    card = (
      <SignUpFlow
        {...common}
        phoneRequired={phoneRequired}
        email={email}
        onEmail={setEmail}
        onSignIn={() => go('signIn')}
        onForgot={() => go('forgot')}
      />
    );
  } else if (view === 'forgot') {
    card = <ForgotFlow {...common} email={email} onEmail={setEmail} onBack={() => go('signIn')} />;
  } else {
    card = (
      <SignInCard
        {...common}
        email={email}
        onEmail={setEmail}
        onForgot={() => go('forgot')}
        onSignUp={() => go('signUp')}
        onUnconfirmed={(address, notice) => {
          requestCardFocus();
          setConfirming({ email: address, notice });
        }}
        expired={expired}
      />
    );
  }

  return (
    <AuthStack>
      {arrival === 'confirmed' ? (
        <AuthNotice
          ok
          lead={texts.confirmedElsewhereLead}
          text={texts.confirmedElsewhereText}
          onClose={() => setArrival(null)}
          closeLabel={ui.dismiss}
        />
      ) : null}
      {arrival === 'linkUsed' ? (
        <AuthNotice
          lead={texts.linkUsedLead}
          text={texts.linkUsedText}
          onClose={() => setArrival(null)}
          closeLabel={ui.dismiss}
        />
      ) : null}
      <Suspense fallback={null}>{card}</Suspense>
    </AuthStack>
  );
}

// ------------------------------------------------------------ steps of a session

export function RegistrationSteps(props: RegistrationStepsProps) {
  return (
    <AuthStack>
      <Suspense fallback={<div aria-busy="true" />}>
        <RegistrationFlow {...props} />
      </Suspense>
    </AuthStack>
  );
}

/** The step bar alone (9.15.1), for a page that shows where a registration stands. */
export function StepList({
  messages,
  phoneRequired,
  current,
}: {
  messages: FormBaseProps['messages'];
  phoneRequired: boolean;
  current: RegistrationStep;
}) {
  return (
    <StepBar
      steps={registrationSteps({ phoneRequired })}
      current={current}
      messages={messages}
      texts={authTexts(messages)}
    />
  );
}

// ------------------------------------------------------------- after a password link

export interface NewPasswordFormProps extends FormBaseProps {
  /** The password was changed: the page leaves the recovery state. */
  onDone: () => void;
}

/** The new password of a «¿Olvidaste tu contraseña?» link (`PASSWORD_RECOVERY`). */
export function NewPasswordForm(props: NewPasswordFormProps) {
  return (
    <AuthStack>
      <Suspense fallback={null}>
        <NewPasswordCard {...props} />
      </Suspense>
    </AuthStack>
  );
}
