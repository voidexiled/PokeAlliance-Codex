import { useEffect, useId, useMemo, useState } from 'react';
import type { SubmitEvent } from 'react';
import type { User } from '@supabase/supabase-js';

import { fill } from '@/i18n/messages/types';
import { mapSupabaseError } from '@/lib/supabase/errors';

import { FactLine } from '@/components/content/FactLine';
import { Notice } from '@/components/content/Notice';
import { Button } from '@/components/controls/Button';
import { Select } from '@/components/controls/Select';
import type { SelectOption } from '@/components/controls/Select';
import { TextField, fieldId } from '@/components/controls/TextField';

import { countryNames } from './countries';
import { CODE_LENGTH, codeDigits } from './logic';
import {
  Field,
  codeError,
  focusField,
  invalidProps,
  markSelect,
  type FormBaseProps,
} from './shared';

// The phone of 9.9 and step 2b of 9.15.1, only with TELEFONO_OBLIGATORIO: the country Select with
// its calling code, «Número», «Enviar código» (`updateUser({ phone })`), «Código» and «Verificar»
// (`verifyOtp` with `phone_change`). Moved unchanged from RegistrationSteps.tsx.

/** E.164: at most 15 digits with the country code. */
const E164_DIGITS_MAX = 15;
/** The shortest national number the phone form accepts. */
const NATIONAL_DIGITS_MIN = 4;
const CODE = /^\d{6}$/;

/**
 * E.164 country calling codes by ISO code (ITU-T E.164 assignments), for the phone form of 9.9.
 * Bouvet Island and Heard Island have no telephone code and are absent; the countries of the
 * North American plan share `1` and dial their area code as part of the number.
 */
const DIAL_CODES =
  'AD376 AE971 AF93 AG1 AI1 AL355 AM374 AO244 AQ672 AR54 AS1 AT43 AU61 AW297 AX358 AZ994 BA387 BB1 BD880 BE32 BF226 BG359 BH973 BI257 BJ229 BL590 BM1 BN673 BO591 BQ599 BR55 BS1 BT975 BW267 BY375 BZ501 CA1 CC61 CD243 CF236 CG242 CH41 CI225 CK682 CL56 CM237 CN86 CO57 CR506 CU53 CV238 CW599 CX61 CY357 CZ420 DE49 DJ253 DK45 DM1 DO1 DZ213 EC593 EE372 EG20 EH212 ER291 ES34 ET251 FI358 FJ679 FK500 FM691 FO298 FR33 GA241 GB44 GD1 GE995 GF594 GG44 GH233 GI350 GL299 GM220 GN224 GP590 GQ240 GR30 GS500 GT502 GU1 GW245 GY592 HK852 HN504 HR385 HT509 HU36 ID62 IE353 IL972 IM44 IN91 IO246 IQ964 IR98 IS354 IT39 JE44 JM1 JO962 JP81 KE254 KG996 KH855 KI686 KM269 KN1 KP850 KR82 KW965 KY1 KZ7 LA856 LB961 LC1 LI423 LK94 LR231 LS266 LT370 LU352 LV371 LY218 MA212 MC377 MD373 ME382 MF590 MG261 MH692 MK389 ML223 MM95 MN976 MO853 MP1 MQ596 MR222 MS1 MT356 MU230 MV960 MW265 MX52 MY60 MZ258 NA264 NC687 NE227 NF672 NG234 NI505 NL31 NO47 NP977 NR674 NU683 NZ64 OM968 PA507 PE51 PF689 PG675 PH63 PK92 PL48 PM508 PN64 PR1 PS970 PT351 PW680 PY595 QA974 RE262 RO40 RS381 RU7 RW250 SA966 SB677 SC248 SD249 SE46 SG65 SH290 SI386 SJ47 SK421 SL232 SM378 SN221 SO252 SR597 SS211 ST239 SV503 SX1 SY963 SZ268 TC1 TD235 TF262 TG228 TH66 TJ992 TK690 TL670 TM993 TN216 TO676 TR90 TT1 TV688 TW886 TZ255 UA380 UG256 UM1 US1 UY598 UZ998 VA39 VC1 VE58 VG1 VI1 VN84 VU678 WF681 WS685 YE967 YT262 ZA27 ZM260 ZW263';

let dialTable: Map<string, string> | undefined;

function dialCodes(): Map<string, string> {
  dialTable ??= new Map(DIAL_CODES.split(' ').map((entry) => [entry.slice(0, 2), entry.slice(2)]));
  return dialTable;
}

/** The longest calling code a number in E.164 starts with, or ''. */
function longestDial(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  let code = '';
  for (const dial of dialCodes().values()) {
    if (dial.length > code.length && digits.startsWith(dial)) code = dial;
  }
  return code;
}

/**
 * «+55 ••• ••• 1234» (9.9): the calling code and the last four digits of a phone that GoTrue
 * keeps as E.164 without the plus. The calling code is the longest one the number starts with.
 */
export function maskPhone(phone: string): string {
  const code = longestDial(phone);
  const last = phone.replace(/\D/g, '').slice(-4);
  return code === '' ? `••• ••• ${last}` : `+${code} ••• ••• ${last}`;
}

/** The calling code of a phone in E.164 («+55»): the longest code it starts with, or null. */
export function dialCodeOf(phone: string): string | null {
  const code = longestDial(phone);
  return code === '' ? null : `+${code}`;
}

/** E.164 of a national number typed in any format, or null when it cannot be one. */
function toE164(dial: string | undefined, typed: string): string | null {
  if (!dial) return null;
  // The trunk prefix (0) of a national number is not dialled after the calling code.
  const national = typed.replace(/\D/g, '').replace(/^0+/, '');
  const total = dial.length + national.length;
  if (national.length < NATIONAL_DIGITS_MIN || total > E164_DIGITS_MAX) return null;
  return `+${dial}${national}`;
}

function PhoneNotice({
  text,
  onClose,
  label,
}: {
  text: string | null;
  onClose: () => void;
  label: string;
}) {
  if (text === null) return null;
  return (
    <Notice open onClose={onClose} closeLabel={label}>
      {text}
    </Notice>
  );
}

export interface PhoneFormProps extends FormBaseProps {
  /** The phone was verified: the page reads the account again. */
  onVerified: () => void;
}

/** Step 2b and «Cambiar teléfono» (9.9): a code by SMS to the new number, then the code. */
export function PhoneForm({ client, locale, messages, ui, onVerified }: PhoneFormProps) {
  const text = messages.verification;
  const uid = fieldId(useId());
  const ids = { country: `${uid}-country`, number: `${uid}-number`, code: `${uid}-code` };
  const countries = useMemo<SelectOption[]>(() => {
    const dial = dialCodes();
    return countryNames(locale)
      .filter((country) => dial.has(country.code))
      .map((country) => ({
        value: country.code,
        label: `${country.name} (+${dial.get(country.code)})`,
      }));
  }, [locale]);
  const [country, setCountry] = useState('');
  const [number, setNumber] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [invalid, setInvalid] = useState<'country' | 'number' | 'code' | null>(null);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const errors = {
    country: invalid === 'country' ? messages.register.errors.country : undefined,
    number: invalid === 'number' ? messages.register.errors.phone : undefined,
    code: invalid === 'code' ? messages.register.errors.code : undefined,
  };

  useEffect(() => {
    markSelect(ids.country, errors.country);
  });

  async function send() {
    if (pending) return;
    if (country === '') {
      setInvalid('country');
      focusField(ids.country);
      return;
    }
    const phone = toE164(dialCodes().get(country), number);
    if (phone === null) {
      setInvalid('number');
      focusField(ids.number);
      return;
    }
    setInvalid(null);
    setPending(true);
    setNotice(null);
    try {
      const { error } = await client.auth.updateUser({ phone });
      if (error) {
        setNotice(mapSupabaseError(error, locale));
        return;
      }
      setSentTo(phone);
      setCode('');
      setNotice(text.codeSent);
    } catch (caught) {
      setNotice(mapSupabaseError(caught, locale));
    } finally {
      setPending(false);
    }
  }

  async function verify() {
    if (pending || sentTo === null) return;
    if (!CODE.test(code)) {
      setInvalid('code');
      focusField(ids.code);
      return;
    }
    setInvalid(null);
    setPending(true);
    setNotice(null);
    try {
      const { error } = await client.auth.verifyOtp({
        phone: sentTo,
        token: code,
        type: 'phone_change',
      });
      if (error) {
        setNotice(codeError(error, locale, messages));
        return;
      }
      onVerified();
    } catch (caught) {
      setNotice(mapSupabaseError(caught, locale));
    } finally {
      setPending(false);
    }
  }

  // Enter sends the code until one was sent, and verifies it after.
  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sentTo === null) void send();
    else void verify();
  }

  return (
    <form className="ac-account-form" onSubmit={submit} noValidate>
      <Field id={ids.country} error={errors.country}>
        <Select
          id={ids.country}
          label={text.country}
          options={countries}
          value={country}
          onChange={(value) => {
            setCountry(value);
            if (invalid === 'country') setInvalid(null);
          }}
        />
      </Field>
      <Field id={ids.number} error={errors.number}>
        <TextField
          id={ids.number}
          label={text.number}
          type="tel"
          name="phone"
          value={number}
          onChange={setNumber}
          inputMode="tel"
          inputProps={{ autoComplete: 'tel-national', ...invalidProps(errors.number, ids.number) }}
        />
      </Field>
      <Button onClick={send} disabled={pending}>
        {text.sendCode}
      </Button>
      {sentTo === null ? null : (
        <>
          <Field id={ids.code} error={errors.code}>
            <TextField
              id={ids.code}
              label={text.code}
              name="code"
              value={code}
              onChange={(value) => setCode(codeDigits(value))}
              inputMode="numeric"
              inputProps={{
                autoComplete: 'one-time-code',
                maxLength: CODE_LENGTH,
                ...invalidProps(errors.code, ids.code),
              }}
            />
          </Field>
          <Button type="submit" variant="solid" disabled={pending}>
            {messages.register.verify}
          </Button>
        </>
      )}
      <PhoneNotice text={notice} onClose={() => setNotice(null)} label={ui.dismiss} />
    </form>
  );
}

export interface PhoneVerificationProps extends FormBaseProps {
  user: User;
  onVerified: () => void;
}

/**
 * The phone rows of «Verificación» (9.9), only with TELEFONO_OBLIGATORIO: «Teléfono: verificado
 * (+55 ••• ••• 1234)» with «Cambiar teléfono», or «Teléfono: sin verificar» with the form.
 */
export function PhoneVerification({
  client,
  locale,
  messages,
  ui,
  user,
  onVerified,
}: PhoneVerificationProps) {
  const text = messages.verification;
  const verified = Boolean(user.phone && user.phone_confirmed_at);
  const [changing, setChanging] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <div className="ac-account-block">
      <div className="ac-account-row">
        <FactLine label={text.phone}>
          {verified
            ? fill(text.phoneVerified, { number: maskPhone(user.phone ?? '') })
            : text.unverified}
        </FactLine>
        {verified && !changing ? (
          <Button
            onClick={() => {
              setNotice(null);
              setChanging(true);
            }}
          >
            {text.changePhone}
          </Button>
        ) : null}
      </div>
      {!verified || changing ? (
        <PhoneForm
          client={client}
          locale={locale}
          messages={messages}
          ui={ui}
          onVerified={() => {
            setChanging(false);
            setNotice(text.phoneSaved);
            onVerified();
          }}
        />
      ) : null}
      <PhoneNotice text={notice} onClose={() => setNotice(null)} label={ui.dismiss} />
    </div>
  );
}
