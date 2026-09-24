import { useEffect, useId, useState } from 'react';
import type { ReactNode } from 'react';
import type { User, UserIdentity } from '@supabase/supabase-js';

import { fill } from '@/i18n/messages/types';
import { registrationSteps, type RegistrationStep } from '@/lib/account/registration';
import { mapSupabaseError } from '@/lib/supabase/errors';
import { DISCORD_EDAD_MIN_DIAS } from '@/lib/trade/limits';

import { Button } from '@/components/controls/Button';
import { fieldId } from '@/components/controls/TextField';

import type { AccountWorld, AuthProviders, LegalLinks } from '../AccountPanel';
import EmailCodeCard from './EmailCode';
import { SLOW_LINK_MS } from './logic';
import { PhoneForm } from './phone';
import {
  ProfileForm,
  type NewProfileValues,
  type ProfileSaveOutcome,
  type RegisterProfileFormProps,
} from './ProfileForm';
import { ProviderButton, ProviderTile } from './providers';
import {
  confirmationReturn,
  forgetConfirmationReturn,
  forgetReturnedProvider,
  linkProvider,
  returnedProvider,
  type FormBaseProps,
  type LinkProvider,
} from './shared';
import { PROVIDER_NAME, authTexts, type AuthTexts } from './texts';
import { AuthCard, AuthIcon, AuthNotice, Helper, QuietButton, StepBar, emphasize } from './ui';

// The steps of a signed-in account that has not finished 9.15.1 (Cuenta-acceso 5–8 and the flow
// pages of Cuenta-paginas): the code when the session came without a confirmed email;
// «Correo confirmado» when the page was opened from the confirmation link; step 2 with the
// Discord and Google buttons (only the providers the build switches on, S11), «Vinculando…»
// while the browser leaves for the provider and the linked row once it is back; the phone with
// TELEFONO_OBLIGATORIO; and step 3, the profile. AccountPanel remounts this per stage.

type AnchorProvider = 'discord' | 'google';

export interface RegistrationStepsProps extends FormBaseProps {
  user: User;
  /** The first step the account has not done (AccountPanel reads it from the account). */
  stage: RegistrationStep;
  providers: AuthProviders;
  captchaSiteKey: string | null;
  /** content/mundos.json in the page's language: the «Mundo» slots. */
  worlds: AccountWorld[];
  legal: LegalLinks | null;
  /** TELEFONO_OBLIGATORIO: the phone is step 2b. */
  phoneRequired: boolean;
  /** What step 3 saved before, when the account has to accept new terms. */
  savedProfile: RegisterProfileFormProps['saved'];
  /** Step 3: the account's profile function (AccountPanel). */
  onCompleteProfile: (values: NewProfileValues) => Promise<ProfileSaveOutcome>;
  /** A step was done: the page reads the account again. */
  onChanged: () => void;
}

interface Linked {
  provider: AnchorProvider;
  identity: UserIdentity;
}

/** The name an identity shows: its user name at the provider, else its address. */
function identityName(identity: UserIdentity): string | null {
  const data = identity.identity_data ?? {};
  for (const key of ['user_name', 'preferred_username', 'full_name', 'name', 'email']) {
    const value: unknown = data[key];
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
  }
  return null;
}

/** Step 2 just came back linked: the provider of the return, if the account now has it. */
function justLinked(stage: RegistrationStep, user: User): Linked | null {
  const provider = returnedProvider();
  if (stage === 'credentials' || stage === 'identity') return null;
  if (provider !== 'discord' && provider !== 'google') return null;
  const identity = user.identities?.find((item) => item.provider === provider);
  return identity === undefined ? null : { provider, identity };
}

export default function RegistrationFlow(props: RegistrationStepsProps) {
  const { client, locale, messages, ui, user, stage, providers, phoneRequired, onChanged } = props;
  const texts = authTexts(messages);
  const uid = fieldId(useId());
  const steps = registrationSteps({ phoneRequired });
  const [confirmed, setConfirmed] = useState(
    () => stage === 'identity' && confirmationReturn() === 'confirmed',
  );
  const [linked, setLinked] = useState<Linked | null>(() => justLinked(stage, user));
  const bar = (current: RegistrationStep) => (
    <StepBar steps={steps} current={current} messages={messages} texts={texts} />
  );

  if (stage === 'credentials') {
    const used = confirmationReturn() === 'linkUsed';
    return (
      <EmailCodeCard
        client={client}
        locale={locale}
        messages={messages}
        ui={ui}
        email={user.email ?? ''}
        captchaSiteKey={props.captchaSiteKey}
        phoneRequired={phoneRequired}
        initialNotice={used ? { lead: texts.linkUsedLead, text: texts.linkUsedText } : null}
        onVerified={onChanged}
      />
    );
  }

  if (confirmed) {
    return (
      <AuthCard
        id={`${uid}-title`}
        top={bar('identity')}
        mark={
          <span className="ac-auth-done-mark" aria-hidden="true">
            <AuthIcon name="check" size={14} />
          </span>
        }
        title={texts.confirmedTitle}
      >
        <p className="ac-auth-card__text">
          {emphasize(texts.confirmedText, 'email', user.email ?? '')}
        </p>
        <Button
          variant="solid"
          touch
          className="ac-auth-primary"
          onClick={() => {
            forgetConfirmationReturn();
            setConfirmed(false);
          }}
        >
          {texts.continue}
        </Button>
      </AuthCard>
    );
  }

  if (linked !== null) {
    return (
      <LinkedCard
        {...props}
        id={`${uid}-title`}
        texts={texts}
        top={bar('identity')}
        linked={linked}
        onContinue={() => {
          forgetReturnedProvider();
          setLinked(null);
        }}
      />
    );
  }

  if (stage === 'identity') {
    return (
      <IdentityCard
        {...props}
        id={`${uid}-title`}
        texts={texts}
        top={bar('identity')}
        providers={providers}
      />
    );
  }

  if (stage === 'phone') {
    return (
      <AuthCard id={`${uid}-title`} top={bar('phone')} title={messages.register.phone}>
        <PhoneForm
          client={client}
          locale={locale}
          messages={messages}
          ui={ui}
          onVerified={onChanged}
        />
      </AuthCard>
    );
  }

  return (
    <AuthCard
      id={`${uid}-title`}
      top={bar('profile')}
      title={texts.profileTitle}
      lead={texts.profileText}
      leadSize="small"
    >
      <ProfileForm
        mode="register"
        locale={locale}
        messages={messages}
        ui={ui}
        worlds={props.worlds}
        legal={props.legal}
        saved={props.savedProfile}
        onSubmit={props.onCompleteProfile}
        onSaved={onChanged}
      />
    </AuthCard>
  );
}

interface CardProps {
  id: string;
  texts: AuthTexts;
  top: ReactNode;
}

/**
 * Step 2: Discord or Google, one is enough (9.15.1). `linkIdentity` leaves for the provider and
 * comes back to the account page, where AccountPanel reads a refused link from the address.
 * While the browser leaves the card reads «Vinculando con …»; after SLOW_LINK_MS it offers to
 * go back to the step.
 */
function IdentityCard({
  client,
  locale,
  messages,
  providers,
  id,
  texts,
  top,
}: RegistrationStepsProps & CardProps) {
  const [leaving, setLeaving] = useState<LinkProvider | null>(null);
  const [slow, setSlow] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (leaving === null) return undefined;
    const timer = window.setTimeout(() => setSlow(true), SLOW_LINK_MS);
    return () => window.clearTimeout(timer);
  }, [leaving]);

  async function link(provider: AnchorProvider) {
    if (leaving !== null) return;
    setLeaving(provider);
    setSlow(false);
    setNotice(null);
    try {
      const error = await linkProvider(client, provider, locale);
      // Without an error the browser is already on its way to the provider.
      if (error) {
        setNotice(mapSupabaseError(error, locale));
        setLeaving(null);
      }
    } catch (caught) {
      setNotice(mapSupabaseError(caught, locale));
      setLeaving(null);
    }
  }

  if (leaving !== null) {
    return (
      <>
        {slow ? (
          <AuthNotice
            lead={texts.slowLead}
            text={texts.slowText}
            action={
              <QuietButton
                onClick={() => {
                  setLeaving(null);
                  setSlow(false);
                }}
              >
                {texts.backToStep}
              </QuietButton>
            }
          />
        ) : null}
        <AuthCard
          id={id}
          top={top}
          mark={<ProviderTile provider={leaving} large />}
          title={fill(texts.linkingTitle, { provider: PROVIDER_NAME[leaving] })}
          lead={
            <span className="ac-auth-waiting" role="status">
              <span className="ac-auth-spinner" aria-hidden="true" />
              {texts.linkingText}
            </span>
          }
        />
      </>
    );
  }

  return (
    <AuthCard id={id} top={top} title={texts.identityTitle} lead={texts.identityText}>
      <div className="ac-auth-form ac-auth-form--tight">
        {notice === null ? null : <AuthNotice lead={notice} />}
        {providers.discord ? (
          <div className="ac-auth-field">
            <ProviderButton provider="discord" onClick={() => void link('discord')}>
              {messages.register.linkDiscord}
            </ProviderButton>
            <Helper>{fill(texts.discordHint, { days: DISCORD_EDAD_MIN_DIAS })}</Helper>
          </div>
        ) : null}
        {providers.discord && providers.google ? (
          <div className="ac-auth-or" role="none">
            {texts.or}
          </div>
        ) : null}
        {providers.google ? (
          <ProviderButton provider="google" onClick={() => void link('google')}>
            {texts.continueGoogle}
          </ProviderButton>
        ) : null}
      </div>
    </AuthCard>
  );
}

/** Back from the provider with the identity linked: its row, «Quitar» and «Continuar». */
function LinkedCard({
  client,
  locale,
  providers,
  onChanged,
  id,
  texts,
  top,
  linked,
  onContinue,
}: RegistrationStepsProps & CardProps & { linked: Linked; onContinue: () => void }) {
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const name = identityName(linked.identity);
  const other: AnchorProvider = linked.provider === 'discord' ? 'google' : 'discord';

  async function remove() {
    if (pending) return;
    setPending(true);
    setNotice(null);
    try {
      const { error } = await client.auth.unlinkIdentity(linked.identity);
      if (error) {
        setNotice(mapSupabaseError(error, locale));
        return;
      }
      forgetReturnedProvider();
      onChanged();
    } catch (caught) {
      setNotice(mapSupabaseError(caught, locale));
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthCard id={id} top={top} title={texts.identityTitle} lead={texts.identityText}>
      <div className="ac-auth-form ac-auth-form--tight">
        {notice === null ? null : <AuthNotice lead={notice} />}
        <div className="ac-auth-linked">
          <ProviderTile provider={linked.provider} />
          <div className="ac-auth-linked__text">
            <span className="ac-auth-linked__name">{PROVIDER_NAME[linked.provider]}</span>
            <span className="ac-auth-linked__detail">
              <span className="ac-auth-ok">
                <AuthIcon name="check" size={12} />
              </span>
              {name === null ? texts.linked : fill(texts.linkedAs, { name })}
            </span>
          </div>
          <button
            type="button"
            className="ac-auth-linked__remove"
            onClick={() => void remove()}
            disabled={pending}
          >
            {texts.remove}
          </button>
        </div>
        {providers[other] ? (
          <Helper>{fill(texts.addLater, { provider: PROVIDER_NAME[other] })}</Helper>
        ) : null}
        <Button
          variant="solid"
          touch
          className="ac-auth-primary"
          onClick={onContinue}
          disabled={pending}
        >
          {texts.continue}
        </Button>
      </div>
    </AuthCard>
  );
}
