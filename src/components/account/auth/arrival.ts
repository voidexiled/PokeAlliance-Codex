import { confirmationArrival, withoutConfirmedMark, type ConfirmationArrival } from './logic';

// The mark of the confirmation link (`?confirmado=1`, auth/shared.tsx `confirmationUrl`), read
// once while the address still has everything the link sent: the error of a link that expired
// or was used goes away as soon as the page reads it (AccountPanel), and supabase-js takes the
// `code`. This module is tiny on purpose: the account page may import it statically and call
// `confirmationReturn()` before it reads any other part of the address.

let arrival: ConfirmationArrival | undefined;

/** Whether the page was opened from the confirmation link (and whether that link worked). */
export function confirmationReturn(): ConfirmationArrival {
  if (arrival !== undefined) return arrival;
  if (typeof window === 'undefined') return null;
  arrival = confirmationArrival(window.location.href);
  if (arrival !== null) {
    window.history.replaceState(
      window.history.state,
      '',
      withoutConfirmedMark(window.location.href),
    );
  }
  return arrival;
}

/** «Continuar» of «Correo confirmado»: the card is not shown again in this visit. */
export function forgetConfirmationReturn(): void {
  arrival = null;
}

// Read as soon as this module runs in the browser.
confirmationReturn();
