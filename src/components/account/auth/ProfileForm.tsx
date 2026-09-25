import { useEffect, useId, useMemo, useState } from 'react';
import type { ReactNode, SubmitEvent } from 'react';

import type { Locale } from '@/i18n/config';
import { fill } from '@/i18n/messages/types';
import { birthDateProblem, playerNameProblem, usernameProblem } from '@/lib/account/registration';
import { mapSupabaseError } from '@/lib/supabase/errors';
import type { SupabaseFailure } from '@/lib/supabase/errors';
import {
  EDAD_MINIMA_CUENTA,
  NOMBRE_JUGADOR_MAX,
  NOMBRE_USUARIO_MAX,
  PERSONAJES_MAX,
} from '@/lib/trade/limits';

import { Button } from '@/components/controls/Button';
import { Checkbox } from '@/components/controls/Checkbox';
import { Select } from '@/components/controls/Select';
import type { SelectOption } from '@/components/controls/Select';
import { fieldId } from '@/components/controls/TextField';
import { TextLink } from '@/components/controls/TextLink';

import type { AccountMessages, AccountWorld, LegalLinks, UiLabels } from '../AccountPanel';
import { countryNames, isCountryCode } from './countries';
import { composeBirthDate } from './logic';
import { errorId, focusField, markSelect } from './shared';
import { authTexts } from './texts';
import { AuthField, AuthInput, AuthNotice, ErrorLine, Helper } from './ui';

// Step 3 (9.15.1, Cuenta-acceso 8) and «Perfil» (9.16.3). Step 3 asks the public «Nombre de
// usuario» (the handle of 9.9), «Tu personaje principal» — «Nombre del jugador» and «Mundo»,
// unique together among all accounts, the worlds as slots, one per world of
// content/mundos.json (Personajes.dc.html, registration step 3) —, «País» by its name, «Fecha de
// nacimiento» as day / month / year (kept, never shown) and the terms, with the non-affiliation
// line of 9.15.2. «Perfil» changes the country and the username until the first listing; the main
// character stands there as one row that links to «Personajes», and the birth date never changes
// once saved, so it is not there. There is no
// availability call for the username: a used one is the server's refusal, under its field.

/** The oldest birth date the form accepts. */
const BIRTH_MIN = '1900-01-01';

export type ProfileField = 'username' | 'player' | 'world' | 'country' | 'birthDate' | 'terms';

const PROFILE_FIELDS: readonly ProfileField[] = [
  'username',
  'player',
  'world',
  'country',
  'birthDate',
  'terms',
];

/** What «Perfil» may change (9.16.3). */
export interface ProfileValues {
  username: string;
  player: string;
  /** World id of content/mundos.json. */
  world: string;
  /** ISO 3166-1 alpha-2. */
  country: string;
}

/**
 * Step 3 (9.15.1): the profile, the birth date (kept, never shown; null once saved, since it
 * does not change) and the accepted terms.
 */
export interface NewProfileValues extends ProfileValues {
  /** `YYYY-MM-DD`, or null when the account saved it before. */
  birthDate: string | null;
}

/** Why the server refused a field: used by another account, invalid, fixed, or under the age. */
export type ProfileRefusal = 'taken' | 'invalid' | 'locked' | 'underage';

/**
 * The answer of a profile save. A refusal names the field it concerns when the server says
 * which, else only the failure.
 */
export type ProfileSaveOutcome =
  | { ok: true }
  | {
      ok: false;
      failure: SupabaseFailure;
      field: ProfileField | null;
      reason: ProfileRefusal;
    };

interface ProfileDraft extends ProfileValues {
  day: string;
  month: string;
  year: string;
  terms: boolean;
}

interface ProfileRules {
  /** Step 3: the terms, and the birth date unless it was saved before. */
  register: boolean;
  /** Step 3 asks the main character; «Perfil» leaves it to «Personajes». */
  character: boolean;
  birthDate: boolean;
  usernameLocked: boolean;
}

function birthDateOf(draft: ProfileDraft): string {
  return composeBirthDate(draft.day, draft.month, draft.year) ?? '';
}

function profileErrors(
  draft: ProfileDraft,
  rules: ProfileRules,
  worlds: AccountWorld[],
  now: number,
  messages: AccountMessages,
): Partial<Record<ProfileField, string>> {
  const text = messages.register.errors;
  const errors: Partial<Record<ProfileField, string>> = {};
  if (!rules.usernameLocked && usernameProblem(draft.username) !== null) {
    errors.username = text.username;
  }
  if (rules.character) {
    if (playerNameProblem(draft.player) !== null) errors.player = text.player;
    if (!worlds.some((world) => world.id === draft.world)) errors.world = text.world;
  }
  if (!isCountryCode(draft.country)) errors.country = text.country;
  if (rules.birthDate) {
    // The database counts the age on its own (UTC) date; the form does the same (9.15.1).
    const value = birthDateOf(draft);
    const birth = value < BIRTH_MIN ? 'invalid' : birthDateProblem(value, now);
    if (birth === 'young') errors.birthDate = fill(text.age, { n: EDAD_MINIMA_CUENTA });
    else if (birth !== null) errors.birthDate = text.birthDate;
  }
  if (rules.register && !draft.terms) errors.terms = text.terms;
  return errors;
}

/** The line of a field the server refused. */
function refusedMessage(
  field: ProfileField,
  reason: ProfileRefusal,
  messages: AccountMessages,
): string {
  const text = messages.register.errors;
  switch (field) {
    case 'username':
      if (reason === 'taken') return text.usernameTaken;
      return reason === 'locked' ? messages.profile.usernameLocked : text.username;
    case 'player':
      return reason === 'taken' ? text.playerTaken : text.player;
    case 'world':
      return text.world;
    case 'country':
      return text.country;
    case 'birthDate':
      if (reason === 'underage') return fill(text.age, { n: EDAD_MINIMA_CUENTA });
      return reason === 'locked' ? messages.profile.birthDateLocked : text.birthDate;
    default:
      return text.terms;
  }
}

/** The twelve months in the page's language, «1» to «12» as values. */
function monthOptions(locale: Locale): { value: string; label: string }[] {
  const format = new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' });
  return Array.from({ length: 12 }, (_, index) => {
    const name = format.format(new Date(Date.UTC(2000, index, 1)));
    return {
      value: String(index + 1),
      label: name.charAt(0).toLocaleUpperCase(locale) + name.slice(1),
    };
  });
}

interface ProfileFormBaseProps {
  locale: Locale;
  messages: AccountMessages;
  ui: UiLabels;
  worlds: AccountWorld[];
  onSaved: () => void;
}

export interface RegisterProfileFormProps extends ProfileFormBaseProps {
  mode: 'register';
  legal: LegalLinks | null;
  /**
   * What the account saved before, when step 3 is asked again (new terms, 9.15.1): the fields
   * start from it and a saved birth date is not asked again.
   */
  saved: (ProfileValues & { birthDateSaved: boolean }) | null;
  onSubmit: (values: NewProfileValues) => Promise<ProfileSaveOutcome>;
}

export interface EditProfileFormProps extends ProfileFormBaseProps {
  mode: 'edit';
  initial: ProfileValues;
  /**
   * The row that stands where step 3 asks the main character: «Personaje principal» and its link
   * to «Personajes», where the characters change. The player and the world are saved as they are.
   */
  mainCharacter: ReactNode;
  /** 9.9: the username does not change after the first listing. */
  usernameLocked: boolean;
  onSubmit: (values: ProfileValues) => Promise<ProfileSaveOutcome>;
}

export function ProfileForm(props: RegisterProfileFormProps | EditProfileFormProps) {
  const { locale, messages, worlds, onSaved } = props;
  const texts = authTexts(messages);
  const register = props.mode === 'register';
  const usernameLocked = props.mode === 'edit' && props.usernameLocked;
  const rules: ProfileRules = {
    register,
    character: register,
    birthDate: props.mode === 'register' && !(props.saved?.birthDateSaved ?? false),
    usernameLocked,
  };
  const text = messages.register;
  const uid = fieldId(useId());
  const ids: Record<ProfileField, string> = {
    username: `${uid}-username`,
    player: `${uid}-player`,
    world: `${uid}-world`,
    country: `${uid}-country`,
    birthDate: `${uid}-birth`,
    terms: `${uid}-terms`,
  };
  const initial = props.mode === 'edit' ? props.initial : null;
  const start = props.mode === 'edit' ? props.initial : props.saved;
  const [draft, setDraft] = useState<ProfileDraft>({
    username: start?.username ?? '',
    player: start?.player ?? '',
    world: start?.world ?? '',
    country: start?.country ?? '',
    day: '',
    month: '',
    year: '',
    terms: false,
  });
  // Errors show once the form was sent, then follow every change (9.7.5, A16).
  const [shown, setShown] = useState(false);
  const [refused, setRefused] = useState<{ field: ProfileField; message: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const countries = useMemo<SelectOption[]>(
    () => countryNames(locale).map((country) => ({ value: country.code, label: country.name })),
    [locale],
  );
  const months = useMemo(
    () => (rules.birthDate ? monthOptions(locale) : []),
    [locale, rules.birthDate],
  );

  const errors = shown ? profileErrors(draft, rules, worlds, now, messages) : {};
  if (refused !== null && errors[refused.field] === undefined) {
    errors[refused.field] = refused.message;
  }

  useEffect(() => {
    markSelect(ids.country, errors.country);
  });

  const changed =
    initial === null ||
    draft.player.trim() !== initial.player ||
    draft.world !== initial.world ||
    draft.country !== initial.country ||
    (!usernameLocked && draft.username !== initial.username);

  function update<K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    const field: ProfileField | null =
      key === 'day' || key === 'month' || key === 'year' ? 'birthDate' : (key as ProfileField);
    if (refused?.field === field) setRefused(null);
    setNotice(null);
  }

  /** Whether the form draws a field: the birth date and the terms only belong to step 3. */
  function drawn(field: ProfileField): boolean {
    if (field === 'birthDate') return rules.birthDate;
    if (field === 'terms') return register;
    if (field === 'player' || field === 'world') return register;
    return true;
  }

  /** The element that takes the focus for a field: the chosen world, or the first one. */
  function focusTarget(field: ProfileField): string {
    if (field !== 'world') return ids[field];
    const at = Math.max(
      0,
      worlds.findIndex((world) => world.id === draft.world),
    );
    return `${ids.world}-${String(at)}`;
  }

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setShown(true);
    const found = profileErrors(draft, rules, worlds, now, messages);
    const first = PROFILE_FIELDS.find((field) => found[field] !== undefined);
    if (first !== undefined) {
      focusField(focusTarget(first));
      return;
    }
    setPending(true);
    setNotice(null);
    setRefused(null);
    const values: ProfileValues = {
      username: usernameLocked && initial !== null ? initial.username : draft.username,
      player: draft.player.trim(),
      world: draft.world,
      country: draft.country,
    };
    try {
      const outcome =
        props.mode === 'register'
          ? await props.onSubmit({
              ...values,
              birthDate: rules.birthDate ? birthDateOf(draft) : null,
            })
          : await props.onSubmit(values);
      if (outcome.ok) {
        if (!register) setNotice(messages.saved);
        onSaved();
        return;
      }
      if (outcome.field === null) {
        setNotice(mapSupabaseError(outcome.failure, locale));
        return;
      }
      const message = refusedMessage(outcome.field, outcome.reason, messages);
      // A field this form does not draw (the birth date of «Perfil») is said in the notice.
      if (!drawn(outcome.field)) {
        setNotice(message);
        return;
      }
      setRefused({ field: outcome.field, message });
      focusField(focusTarget(outcome.field));
    } catch (caught) {
      setNotice(mapSupabaseError(caught, locale));
    } finally {
      setPending(false);
    }
  }

  let submitLabel = register ? text.finish : messages.save;
  if (pending && !register) submitLabel = messages.saving;

  function errorLine(field: ProfileField) {
    const message = errors[field];
    return message === undefined ? null : <ErrorLine id={errorId(ids[field])} lead={message} />;
  }

  function described(field: ProfileField, helper?: string) {
    const parts = [errors[field] === undefined ? undefined : errorId(ids[field]), helper];
    const value = parts.filter(Boolean).join(' ');
    return {
      'aria-invalid': errors[field] === undefined ? undefined : (true as const),
      'aria-describedby': value === '' ? undefined : value,
    };
  }

  return (
    <form className="ac-auth-form" onSubmit={submit} noValidate>
      {notice === null ? null : (
        <AuthNotice lead={notice} onClose={() => setNotice(null)} closeLabel={props.ui.dismiss} />
      )}
      <AuthField
        id={ids.username}
        label={text.username}
        below={
          <>
            <Helper id={`${ids.username}-help`}>
              {usernameLocked ? messages.profile.usernameLocked : text.usernameHelp}
            </Helper>
            {errorLine('username')}
          </>
        }
      >
        <AuthInput
          id={ids.username}
          name="username"
          value={draft.username}
          // The handle is lowercase (9.9): typed capitals become lowercase as they come.
          onChange={(event) => update('username', event.target.value.toLowerCase())}
          autoComplete="username"
          autoCapitalize="none"
          maxLength={NOMBRE_USUARIO_MAX}
          spellCheck={false}
          readOnly={usernameLocked}
          {...described('username', `${ids.username}-help`)}
        />
      </AuthField>
      {props.mode === 'edit' ? (
        props.mainCharacter
      ) : (
        <section className="ac-auth-character" aria-labelledby={`${uid}-character`}>
          <h3 className="ac-auth-character__title" id={`${uid}-character`}>
            {texts.mainCharacterTitle}
          </h3>
          <p className="ac-auth-character__text">
            {fill(texts.mainCharacterText, { max: PERSONAJES_MAX })}
          </p>
          <div className="ac-auth-character__box">
            <AuthField id={ids.player} label={text.player} below={errorLine('player')}>
              <AuthInput
                id={ids.player}
                name="player"
                value={draft.player}
                onChange={(event) => update('player', event.target.value)}
                autoComplete="off"
                maxLength={NOMBRE_JUGADOR_MAX}
                spellCheck={false}
                {...described('player')}
              />
            </AuthField>
            <fieldset
              className="ac-auth-fieldset"
              aria-invalid={errors.world === undefined ? undefined : true}
              aria-describedby={errors.world === undefined ? undefined : errorId(ids.world)}
            >
              <legend className="ac-auth-field__label">{text.world}</legend>
              <div className="ac-auth-slots">
                {worlds.map((world, index) => (
                  <label key={world.id} className="ac-auth-slot">
                    <input
                      id={`${ids.world}-${String(index)}`}
                      className="ac-auth-slot__input"
                      type="radio"
                      name={ids.world}
                      value={world.id}
                      checked={draft.world === world.id}
                      onChange={() => update('world', world.id)}
                    />
                    <span className="ac-auth-slot__name">{world.nombre}</span>
                  </label>
                ))}
              </div>
              {errorLine('world')}
            </fieldset>
          </div>
        </section>
      )}
      <div className="ac-auth-field">
        <Select
          id={ids.country}
          label={text.country}
          options={countries}
          value={draft.country}
          width="100%"
          onChange={(value) => update('country', value)}
        />
        {errorLine('country')}
      </div>
      {rules.birthDate ? (
        <fieldset
          className="ac-auth-fieldset"
          aria-describedby={[
            `${ids.birthDate}-help`,
            errors.birthDate === undefined ? '' : errorId(ids.birthDate),
          ]
            .join(' ')
            .trim()}
        >
          <legend className="ac-auth-field__label">{text.birthDate}</legend>
          <div className="ac-auth-date">
            <label className="sr-only" htmlFor={ids.birthDate}>
              {texts.day}
            </label>
            <AuthInput
              id={ids.birthDate}
              name="bday-day"
              value={draft.day}
              onChange={(event) => update('day', event.target.value.replace(/\D/g, '').slice(0, 2))}
              inputMode="numeric"
              autoComplete="bday-day"
              placeholder={texts.day}
              maxLength={2}
              aria-invalid={errors.birthDate === undefined ? undefined : true}
            />
            <label className="sr-only" htmlFor={`${ids.birthDate}-month`}>
              {texts.month}
            </label>
            <span className="ac-auth-native-select">
              <select
                id={`${ids.birthDate}-month`}
                name="bday-month"
                className="ac-auth-input"
                value={draft.month}
                onChange={(event) => update('month', event.target.value)}
                autoComplete="bday-month"
                aria-invalid={errors.birthDate === undefined ? undefined : true}
              >
                <option value="" disabled>
                  {texts.month}
                </option>
                {months.map((month) => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>
            </span>
            <label className="sr-only" htmlFor={`${ids.birthDate}-year`}>
              {texts.year}
            </label>
            <AuthInput
              id={`${ids.birthDate}-year`}
              name="bday-year"
              value={draft.year}
              onChange={(event) =>
                update('year', event.target.value.replace(/\D/g, '').slice(0, 4))
              }
              inputMode="numeric"
              autoComplete="bday-year"
              placeholder={texts.year}
              maxLength={4}
              aria-invalid={errors.birthDate === undefined ? undefined : true}
            />
          </div>
          <Helper id={`${ids.birthDate}-help`}>{text.birthDateHelp}</Helper>
          {errorLine('birthDate')}
        </fieldset>
      ) : null}
      {props.mode === 'register' ? (
        <div className="ac-auth-field">
          <Checkbox
            id={ids.terms}
            label={text.terms}
            checked={draft.terms}
            onChange={(checked) => update('terms', checked)}
            helper={
              props.legal === null ? undefined : (
                <>
                  <TextLink href={props.legal.terms} variant="prose">
                    {text.termsLink}
                  </TextLink>
                  {' · '}
                  <TextLink href={props.legal.privacy} variant="prose">
                    {text.privacyLink}
                  </TextLink>
                </>
              )
            }
            inputProps={described('terms')}
          />
          {errorLine('terms')}
          <p className="ac-auth-legal">{text.nonAffiliation}</p>
        </div>
      ) : null}
      <Button
        type="submit"
        variant="solid"
        touch
        className={register ? 'ac-auth-primary' : undefined}
        disabled={pending || !changed}
      >
        {submitLabel}
      </Button>
    </form>
  );
}
