// Cloudflare Turnstile, the invisible CAPTCHA of the account forms (spec 9.15.1, 9.15.7, D-B3):
// Supabase Auth asks a token of `signUp`, `signInWithPassword`, `resetPasswordForEmail` and
// `resend` when its captcha is on.
//
// - Only with `PUBLIC_TURNSTILE_SITE_KEY`: without it nothing is loaded or rendered (S11) and the
//   calls go without a token. The site key is public by design; the secret key lives only in
//   Supabase Auth.
// - The script comes from challenges.cloudflare.com (Cloudflare does not allow a copy), on demand,
//   the first time a form needs it; a failed load is not kept, so the next attempt tries again.
// - A token works for one request and expires after 300 s: `takeToken` hands the current token
//   over and resets the widget at once, so the next request gets a fresh one.
// - Locally the public test keys always pass (9.15.7).
import type { Locale } from '@/i18n/config';

export const TURNSTILE_SCRIPT_URL =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

/** The render options of the widget this module uses (explicit rendering). */
export interface TurnstileRenderOptions {
  sitekey: string;
  callback: (token: string) => void;
  'expired-callback': () => void;
  'timeout-callback': () => void;
  /** Returning true tells Turnstile the error is handled. */
  'error-callback': (code: string) => boolean;
  'before-interactive-callback'?: () => void;
  'after-interactive-callback'?: () => void;
  language: string;
  theme: 'dark' | 'light' | 'auto';
  size: 'flexible' | 'compact' | 'normal';
  appearance: 'always' | 'execute' | 'interaction-only';
  retry: 'auto' | 'never';
  'refresh-expired': 'auto' | 'manual' | 'never';
}

/** The part of the Turnstile API this module calls. */
export interface TurnstileApi {
  render(container: HTMLElement, options: TurnstileRenderOptions): string | null | undefined;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
}

/** `window.turnstile`, read without a global declaration (the account widget may declare its own). */
function globalApi(): TurnstileApi | undefined {
  return (window as Window & { turnstile?: TurnstileApi }).turnstile;
}

/** A site key from the environment: trimmed, or null when blank. */
export function readTurnstileSiteKey(raw: string | undefined): string | null {
  const key = raw?.trim();
  return key ? key : null;
}

/** `PUBLIC_TURNSTILE_SITE_KEY` of the build, or null: then there is no CAPTCHA. */
export function getTurnstileSiteKey(): string | null {
  return readTurnstileSiteKey(import.meta.env.PUBLIC_TURNSTILE_SITE_KEY);
}

let loading: Promise<TurnstileApi> | undefined;

/**
 * The Turnstile API, loading the script once. Null without a site key, on the server, or when the
 * script cannot be loaded (the form then says the check failed and offers to retry).
 */
export async function loadTurnstile(siteKey = getTurnstileSiteKey()): Promise<TurnstileApi | null> {
  if (siteKey === null || typeof window === 'undefined') return null;
  const ready = globalApi();
  if (ready) return ready;
  if (loading === undefined) {
    loading = new Promise<TurnstileApi>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = TURNSTILE_SCRIPT_URL;
      script.async = true;
      script.addEventListener('load', () => {
        const api = globalApi();
        if (api) resolve(api);
        else reject(new Error('Turnstile did not start.'));
      });
      script.addEventListener('error', () => {
        script.remove();
        reject(new Error('Turnstile could not be loaded.'));
      });
      document.head.append(script);
    });
    // A failed load is not kept: the next call tries again.
    loading.catch(() => {
      loading = undefined;
    });
  }
  try {
    return await loading;
  } catch {
    return null;
  }
}

/** A mounted widget. */
export interface TurnstileHandle {
  /**
   * The token for the next Auth request, waiting for the check when there is none yet. The widget
   * resets at once, since a token works only once. Rejects when the check fails or times out.
   */
  takeToken(): Promise<string>;
  /** Throws the current token away and runs the check again. */
  reset(): void;
  /** Removes the widget from the page. */
  remove(): void;
}

export interface MountTurnstileOptions {
  locale: Locale;
  /** Defaults to `PUBLIC_TURNSTILE_SITE_KEY`. */
  siteKey?: string | null;
  /** Cloudflare needs the person to act: the box opens (true) and closes (false) around it. */
  onInteractive?: (open: boolean) => void;
  /** Below this width of the box the compact widget is used. */
  flexibleMinWidth?: number;
}

/**
 * Renders the invisible check in `container` and returns its handle; null without a site key or
 * when the script cannot be loaded.
 */
export async function mountTurnstile(
  container: HTMLElement,
  {
    locale,
    siteKey = getTurnstileSiteKey(),
    onInteractive,
    flexibleMinWidth = 300,
  }: MountTurnstileOptions,
): Promise<TurnstileHandle | null> {
  if (siteKey === null) return null;
  const api = await loadTurnstile(siteKey);
  if (api === null) return null;

  let token: string | null = null;
  let waiting: { resolve: (token: string) => void; reject: (error: Error) => void }[] = [];
  const settle = (outcome: { token: string } | { error: Error }) => {
    const pending = waiting;
    waiting = [];
    for (const waiter of pending) {
      if ('token' in outcome) waiter.resolve(outcome.token);
      else waiter.reject(outcome.error);
    }
  };

  const widgetId =
    api.render(container, {
      sitekey: siteKey,
      callback: (next) => {
        token = next;
        if (waiting.length > 0) {
          token = null;
          settle({ token: next });
          api.reset(widgetId);
        }
      },
      'expired-callback': () => {
        token = null;
      },
      'timeout-callback': () => {
        token = null;
        settle({ error: new Error('Turnstile timed out.') });
      },
      'error-callback': () => {
        token = null;
        settle({ error: new Error('Turnstile check failed.') });
        return true;
      },
      'before-interactive-callback': () => onInteractive?.(true),
      'after-interactive-callback': () => onInteractive?.(false),
      language: locale,
      theme: 'dark',
      size: container.clientWidth < flexibleMinWidth ? 'compact' : 'flexible',
      appearance: 'interaction-only',
      retry: 'auto',
      'refresh-expired': 'auto',
    }) ?? '';
  if (widgetId === '') return null;

  return {
    takeToken() {
      if (token !== null) {
        const current = token;
        token = null;
        api.reset(widgetId);
        return Promise.resolve(current);
      }
      return new Promise<string>((resolve, reject) => {
        waiting.push({ resolve, reject });
      });
    },
    reset() {
      token = null;
      api.reset(widgetId);
    },
    remove() {
      token = null;
      settle({ error: new Error('Turnstile removed.') });
      api.remove(widgetId);
    },
  };
}

/**
 * The options of an Auth call with the token: `{ ...options, captchaToken }`, or the options as
 * they are without a token (a build without Turnstile).
 */
export function withCaptcha<T extends object>(
  options: T,
  token: string | null,
): T & { captchaToken?: string } {
  return token === null ? options : { ...options, captchaToken: token };
}
