import { useEffect, useRef, useState } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';

import { fill } from '@/i18n/messages/types';
import type { RegistrationStep } from '@/lib/account/registration';

import type { AccountMessages } from '../AccountPanel';
import { CODE_LENGTH, codeDigits, secondsLeft } from './logic';
import type { AuthTexts } from './texts';

// The pieces of the Direction D cards (Cuenta-acceso.dc.html, auth.css): the centred 448 card,
// its footer row, the notices above a form, the field with its label row, the password box
// with «Mostrar contraseña», the error and check lines under a field, the horizontal step bar
// and the six code boxes over one real one-time-code input.

// ----------------------------------------------------------------------------- icons

const PATHS = {
  eye: (
    <>
      <path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M10.73 5.08a10.74 10.74 0 0 1 11.2 6.57 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-1.44 2.49" />
      <path d="M14.08 14.16a3 3 0 0 1-4.24-4.24" />
      <path d="M17.48 17.5a10.75 10.75 0 0 1-15.42-5.15 1 1 0 0 1 0-.7 10.75 10.75 0 0 1 4.45-5.14" />
      <path d="m2 2 20 20" />
    </>
  ),
  check: <path d="M20 6 9 17l-5-5" />,
  alert: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </>
  ),
  arrow: (
    <>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </>
  ),
  back: (
    <>
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </>
  ),
  close: (
    <>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </>
  ),
};

export type AuthIconName = keyof typeof PATHS;

export function AuthIcon({ name, size = 16 }: { name: AuthIconName; size?: 12 | 14 | 16 | 20 }) {
  return (
    <svg
      className="ac-auth-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={size <= 12 ? 2.5 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}

// ------------------------------------------------------------------------------ card

/** Set when a card replaces another one: the next card that mounts takes the focus. */
let focusNextCard = false;

/** The next card to mount focuses its title, so the focus never falls back to the page. */
export function requestCardFocus(): void {
  focusNextCard = true;
}

export interface AuthCardProps {
  id: string;
  title: ReactNode;
  /** The line under the title: `small` 12/16 (sign in, step 1) or `body` 14/22. */
  lead?: ReactNode;
  leadSize?: 'small' | 'body';
  /** A step bar or an art touch drawn above the title. */
  top?: ReactNode;
  /** Before the title: a provider tile or a check («Vinculando…», «Correo confirmado»). */
  mark?: ReactNode;
  /** After the title, on the right (the art of «Tu sesión caducó»). */
  aside?: ReactNode;
  /** h1 on a page of its own (restablecer), h2 under the page title. */
  headingLevel?: 1 | 2;
  children?: ReactNode;
}

export function AuthCard({
  id,
  title,
  lead,
  leadSize = 'body',
  top,
  mark,
  aside,
  headingLevel = 2,
  children,
}: AuthCardProps) {
  const Heading = headingLevel === 1 ? 'h1' : 'h2';
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!focusNextCard) return;
    focusNextCard = false;
    headingRef.current?.focus();
  }, []);
  return (
    <section className="ac-auth-card" aria-labelledby={id}>
      {top}
      <div className="ac-auth-card__head">
        {mark}
        <div className="ac-auth-card__heading">
          <Heading id={id} ref={headingRef} tabIndex={-1} className="ac-auth-card__title">
            {title}
          </Heading>
          {lead === undefined ? null : (
            <p className={`ac-auth-card__lead ac-auth-card__lead--${leadSize}`}>{lead}</p>
          )}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** The divider and the «¿No tienes cuenta? [Crear cuenta]» row at the foot of a card. */
export function AuthFoot({ question, children }: { question: ReactNode; children: ReactNode }) {
  return (
    <div className="ac-auth-foot">
      <p className="ac-auth-foot__question">{question}</p>
      {children}
    </div>
  );
}

/** The column of a page's cards and the notices above them. */
export function AuthStack({ children }: { children: ReactNode }) {
  return <div className="ac-auth">{children}</div>;
}

// --------------------------------------------------------------------------- notices

export interface AuthNoticeProps {
  lead: ReactNode;
  text?: ReactNode;
  action?: ReactNode;
  /** A check before the text (a link that worked). */
  ok?: boolean;
  onClose?: () => void;
  closeLabel?: string;
}

/** A status block above a form: its lead in bold, the rest quieter, an action at the end. */
export function AuthNotice({
  lead,
  text,
  action,
  ok = false,
  onClose,
  closeLabel,
}: AuthNoticeProps) {
  return (
    <div className="ac-auth-notice" role="status">
      {ok ? (
        <span className="ac-auth-ok">
          <AuthIcon name="check" size={12} />
        </span>
      ) : null}
      <p className="ac-auth-notice__text">
        <strong>{lead}</strong>
        {text === undefined ? null : <span className="ac-auth-notice__rest"> {text}</span>}
      </p>
      {action}
      {onClose ? (
        <button
          type="button"
          className="ac-auth-notice__close"
          aria-label={closeLabel}
          onClick={onClose}
        >
          <AuthIcon name="close" size={14} />
        </button>
      ) : null}
    </div>
  );
}

/** A quiet line under a button (the Turnstile check that did not pass). */
export function QuietLine({ children }: { children: ReactNode }) {
  return (
    <p className="ac-auth-quiet-line" role="status">
      {children}
    </p>
  );
}

/** A text button in the link colour («Reintentar», «Cambiar correo»). */
export function QuietButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button type="button" className="ac-auth-quiet" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

/** The error line under a field: an alert glyph and the text, joined by `aria-describedby`. */
export function ErrorLine({
  id,
  lead,
  text,
  action,
}: {
  id: string;
  lead: ReactNode;
  text?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <p id={id} className="ac-auth-error">
      <AuthIcon name="alert" size={14} />
      <span>
        <strong>{lead}</strong>
        {text === undefined ? null : <span className="ac-auth-error__rest"> {text}</span>}
        {action === undefined ? null : <> {action}</>}
      </span>
    </p>
  );
}

/** «✓ 10 caracteres o más», «✓ Disponible»: a met rule, in the success colour. */
export function OkLine({
  children,
  met = true,
  id,
}: {
  children: ReactNode;
  met?: boolean;
  id?: string;
}) {
  return (
    <p id={id} className={met ? 'ac-auth-check ac-auth-check--met' : 'ac-auth-check'}>
      <AuthIcon name="check" size={12} />
      {children}
    </p>
  );
}

/**
 * A dictionary line with one placeholder in bold («Si **kaiser@correo.com** tiene cuenta…»):
 * the template is split at `{name}`, so the order of the words stays the dictionary's.
 */
export function emphasize(template: string, name: string, value: ReactNode): ReactNode {
  const [before, ...after] = template.split(`{${name}}`);
  if (after.length === 0) return template;
  return (
    <>
      {before}
      <strong className="ac-auth-strong">{value}</strong>
      {after.join(`{${name}}`)}
    </>
  );
}

export function Helper({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className="ac-auth-helper">
      {children}
    </p>
  );
}

// ---------------------------------------------------------------------------- fields

export function AuthField({
  id,
  label,
  right,
  children,
  below,
}: {
  id: string;
  label: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  below?: ReactNode;
}) {
  return (
    <div className="ac-auth-field">
      <div className="ac-auth-field__label-row">
        <label htmlFor={id} className="ac-auth-field__label">
          {label}
        </label>
        {right}
      </div>
      {children}
      {below}
    </div>
  );
}

export function AuthInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className="ac-auth-input" />;
}

export interface PasswordInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'onChange'
> {
  id: string;
  value: string;
  onChange: (value: string) => void;
  /** `auth.showPassword`: the name of the eye button, which is a toggle (`aria-pressed`). */
  showLabel: string;
  invalid?: boolean;
}

/** The password box: the input and «Mostrar contraseña» inside one 11-radius frame. */
export function PasswordInput({
  id,
  value,
  onChange,
  showLabel,
  invalid = false,
  ...rest
}: PasswordInputProps) {
  const [shown, setShown] = useState(false);
  return (
    <div className={invalid ? 'ac-auth-box ac-auth-box--invalid' : 'ac-auth-box'}>
      <input
        {...rest}
        id={id}
        className="ac-auth-box__input"
        type={shown ? 'text' : 'password'}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={invalid ? true : undefined}
        spellCheck={false}
        autoCapitalize="off"
      />
      <button
        type="button"
        className="ac-auth-eye"
        aria-label={showLabel}
        aria-pressed={shown}
        aria-controls={id}
        onClick={() => setShown((value) => !value)}
      >
        <AuthIcon name={shown ? 'eyeOff' : 'eye'} />
      </button>
    </div>
  );
}

// -------------------------------------------------------------------------- step bar

/**
 * The horizontal steps of 9.15.1 (Correo · Identidad · Perfil, the phone between with
 * TELEFONO_OBLIGATORIO): done ones with a check, the current one ringed and `aria-current`.
 */
export function StepBar({
  steps,
  current,
  messages,
  texts,
}: {
  steps: RegistrationStep[];
  /** `done` once the last step is saved («¡Listo!»). */
  current: RegistrationStep | 'done';
  messages: AccountMessages;
  texts: AuthTexts;
}) {
  const labels: Record<RegistrationStep, string> = {
    credentials: messages.access.email,
    identity: texts.stepIdentity,
    phone: messages.register.phone,
    profile: messages.register.profile,
  };
  const at = current === 'done' ? steps.length : steps.indexOf(current);
  const label =
    current === 'done' ? texts.stepsDone : fill(texts.stepsAt, { n: at + 1, total: steps.length });
  return (
    <ol className="ac-auth-steps" aria-label={label}>
      {steps.map((step, index) => {
        const done = index < at;
        const now = index === at;
        let state = '';
        if (done) state = ' ac-auth-steps__item--done';
        else if (now) state = ' ac-auth-steps__item--current';
        return (
          <li
            key={step}
            className={`ac-auth-steps__item${state}`}
            aria-current={now ? 'step' : undefined}
          >
            <span className="ac-auth-steps__mark" aria-hidden="true">
              {done ? <AuthIcon name="check" size={12} /> : index + 1}
            </span>
            <span className="ac-auth-steps__name">
              {labels[step]}
              {done ? <span className="sr-only"> {texts.stepDone}</span> : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

// ------------------------------------------------------------------------ code boxes

/**
 * Six boxes drawn over one real input (`autocomplete="one-time-code"`), so a pasted or
 * autofilled code lands whole and a screen reader meets a single field.
 */
export function CodeInput({
  id,
  value,
  onChange,
  invalid = false,
  describedBy,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  describedBy?: string;
}) {
  const [focused, setFocused] = useState(false);
  const at = Math.min(value.length, CODE_LENGTH - 1);
  return (
    <div className={invalid ? 'ac-auth-code ac-auth-code--invalid' : 'ac-auth-code'}>
      <input
        id={id}
        className="ac-auth-code__input"
        type="text"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={CODE_LENGTH}
        value={value}
        onChange={(event) => onChange(codeDigits(event.target.value))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
      />
      <div className="ac-auth-code__boxes" aria-hidden="true">
        {Array.from({ length: CODE_LENGTH }, (_, index) => {
          const digit = value[index] ?? '';
          let state = '';
          if (focused && index === at) state = ' ac-auth-code__box--focus';
          else if (digit !== '') state = ' ac-auth-code__box--filled';
          // The boxes are a picture of one input: their order never changes.
          return (
            <span key={index} className={`ac-auth-code__box${state}`}>
              {digit}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** A countdown in whole seconds; `restart` starts it again. */
export function useCountdown(seconds: number) {
  const [until, setUntil] = useState(() => Date.now() + seconds * 1000);
  const [now, setNow] = useState(() => Date.now());
  const left = secondsLeft(until, now);
  const running = left > 0;
  useEffect(() => {
    if (!running) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [running, until]);
  return {
    left,
    restart: () => {
      const start = Date.now();
      setNow(start);
      setUntil(start + seconds * 1000);
    },
  };
}
