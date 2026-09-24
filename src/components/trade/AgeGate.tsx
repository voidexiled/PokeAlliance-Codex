import { useEffect, useState } from 'react';

import { Button } from '@/components/controls/Button';
import { Dialog } from '@/components/controls/Dialog';
import type { Locale } from '@/i18n/config';
import { readStoredSession } from '@/lib/account/session-cache';

// AgeGate (spec 9.15.2): Comercio is for people 18 and older. Every Comercio route renders this
// island, in phase A and in phase B alike (the owner looked for it in the phase A preview):
//
//   - Without a session, the first visit opens a `Dialog` titled «Comercio es solo para mayores
//     de 18 años.» with «Tengo 18 años o más» and «Soy menor de edad»; the second leads to
//     `/{l}/`. The answer is remembered in `localStorage` (every read and write in `try/catch`)
//     and never goes to the server: the next Comercio route passes an adult and sends a minor
//     home again. Closing the dialog with its cross or Escape answers nothing, so the next route
//     asks again.
//   - With a session the account's birth date decides and nothing is asked: an account under 18
//     goes back to `/{l}/`, which shows the `Notice` «Comercio es solo para mayores de 18 años.»
//     (the notice of `src/pages/[locale]/index.astro`). The session is the one supabase-js keeps in `localStorage`, read without
//     loading it (`readStoredSession`, 9.16.4); only then are supabase-js and the client module
//     loaded, on demand (D-025), to read the account (`getMyAccount`, whose `adult` comes from
//     the stored birth date, never the date itself). An account whose age is not on file yet
//     (registration not finished), or a failed read, falls back to the question of a visitor
//     without session.
//
// The gate is a notice the visitor answers, not an access control: every Comercio action checks
// the age again on the server (9.15.2, `EDAD_MINIMA_COMERCIO`). The server markup is the closed
// dialog; the island opens it once it hydrates, so a page never ships an open modal (Dialog).

/** Where a visitor without session keeps the answer (9.15.2). */
export const AGE_ANSWER_KEY = 'alliance-codex:comercio:edad:v1';

/**
 * Set in `sessionStorage` right before the gate sends someone under 18 home, where the home page
 * shows the notice once and clears it.
 */
export const AGE_NOTICE_KEY = 'alliance-codex:comercio:aviso-edad';

/** The two answers of the dialog, as stored. */
export const AGE_ANSWERS = ['adulto', 'menor'] as const;
export type AgeAnswer = (typeof AGE_ANSWERS)[number];

/** A Web Storage that may be missing, or throw on every access (private windows, blocked data). */
export type GateStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null | undefined;

/** The remembered answer; `null` when there is none, it is not one of the two, or storage fails. */
export function readAgeAnswer(storage: GateStorage): AgeAnswer | null {
  try {
    const value = storage?.getItem(AGE_ANSWER_KEY) ?? null;
    return AGE_ANSWERS.find((answer) => answer === value) ?? null;
  } catch {
    return null;
  }
}

/** Remembers an answer. Without storage the gate simply asks again on the next route. */
export function writeAgeAnswer(storage: GateStorage, answer: AgeAnswer): void {
  try {
    storage?.setItem(AGE_ANSWER_KEY, answer);
  } catch {
    // Nothing to do: the answer holds for this page.
  }
}

/** What the gate does: let the visitor in, ask, or send them home. */
export type AgeGateAction = 'pass' | 'ask' | 'home';

/**
 * The decision of 9.15.2. `adult` is what the account's birth date says (`null` without a session
 * or without a known age), and it wins over any answer the browser remembers; otherwise that
 * answer decides, and with none the dialog asks.
 */
export function ageGateAction(adult: boolean | null, answer: AgeAnswer | null): AgeGateAction {
  if (adult !== null) return adult ? 'pass' : 'home';
  if (answer === 'adulto') return 'pass';
  if (answer === 'menor') return 'home';
  return 'ask';
}

/** `window.localStorage`, or `null` where reading the property itself throws. */
function localStore(): GateStorage {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Leaves a note for the notice of the home page. */
function flagNotice(): void {
  try {
    window.sessionStorage.setItem(AGE_NOTICE_KEY, '1');
  } catch {
    // The home page opens without the notice.
  }
}

/**
 * The account's side of the gate: `true` 18 or older, `false` under 18, `null` when the age is not
 * on file or cannot be read. supabase-js and the client module load here, on demand (D-025).
 */
async function accountIsAdult(): Promise<boolean | null> {
  const [{ getSupabaseBrowserClient }, { getMyAccount }] = await Promise.all([
    import('@/lib/supabase/client'),
    import('@/lib/supabase/trade'),
  ]);
  const client = await getSupabaseBrowserClient();
  if (client === null) return null;
  const { data, error } = await getMyAccount(client);
  return error === null && data !== null ? data.adult : null;
}

/** The texts of the gate (DP1). */
export interface AgeGateLabels {
  /** «Comercio es solo para mayores de 18 años.»: the title of the dialog. */
  title: string;
  /** «Tengo 18 años o más». */
  adult: string;
  /** «Soy menor de edad». */
  minor: string;
}

export interface AgeGateProps {
  locale: Locale;
  labels: AgeGateLabels;
  /** `ui.close`: the accessible name of the cross of the dialog. */
  closeLabel: string;
}

/** The 18+ gate of every Comercio route (9.15.2). */
export function AgeGate({ locale, labels, closeLabel }: AgeGateProps) {
  const [open, setOpen] = useState(false);
  const home = `/${locale}/`;

  useEffect(() => {
    let active = true;
    const storage = localStore();
    const answer = readAgeAnswer(storage);
    const act = (action: AgeGateAction) => {
      if (!active) return;
      if (action === 'ask') setOpen(true);
      else if (action === 'home') {
        flagNotice();
        window.location.replace(home);
      }
    };
    if (readStoredSession() === null) {
      act(ageGateAction(null, answer));
    } else {
      accountIsAdult().then(
        (adult) => act(ageGateAction(adult, answer)),
        () => act(ageGateAction(null, answer)),
      );
    }
    return () => {
      active = false;
    };
  }, [home]);

  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      title={labels.title}
      closeLabel={closeLabel}
      alert
      actions={
        <>
          <Button
            href={home}
            onClick={() => {
              writeAgeAnswer(localStore(), 'menor');
              flagNotice();
            }}
          >
            {labels.minor}
          </Button>
          <Button
            variant="solid"
            onClick={() => {
              writeAgeAnswer(localStore(), 'adulto');
              setOpen(false);
            }}
          >
            {labels.adult}
          </Button>
        </>
      }
    />
  );
}
