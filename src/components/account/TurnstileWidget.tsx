import { useEffect, useRef, useState } from 'react';

import type { Locale } from '@/i18n/config';
import { loadTurnstile, type TurnstileApi } from '@/lib/account/turnstile';

// TurnstileWidget (spec 9.15.1, 9.15.7, D-B3): the Cloudflare Turnstile check of the account
// forms that Supabase Auth asks a token of (sign up, sign in, the password link and every
// resend), rendered only when the build has a site key (S11).
//
// - The check is invisible: `interaction-only` draws the widget only when Cloudflare asks the
//   person to act, and the widget reports that with its interactive callbacks. Until then the
//   box takes no room in the form (account.css).
// - A token works for one request and expires after 300 s: the caller bumps `resetKey` after
//   each request, and an expired token is refreshed by Turnstile itself (`refresh-expired`).
//   While there is no token the caller keeps its submit disabled.
// - The script loads on demand through src/lib/account/turnstile.ts, from
//   challenges.cloudflare.com (Cloudflare does not allow a copy), the first time a widget
//   mounts; a failed load is not kept, so remounting the widget (a new React `key`) tries again.
// - Locally the public test keys always pass (9.15.7); the site key is public by design, the
//   secret key lives only in Supabase Auth.

/** Below this width of the box the flexible widget would overflow it: use the compact one. */
const FLEXIBLE_MIN_WIDTH = 300;

export interface TurnstileWidgetProps {
  /** The public site key (`PUBLIC_TURNSTILE_SITE_KEY`). */
  siteKey: string;
  /** Language of the challenge, when Cloudflare shows one. */
  locale: Locale;
  /** Changing it throws the current token away and asks for a new one. */
  resetKey: number;
  /** The token, or null while there is none (loading, expired, spent or failed). */
  onToken: (token: string | null) => void;
  /** The script did not load or the check failed: the caller shows its notice. */
  onError: () => void;
}

export function TurnstileWidget({
  siteKey,
  locale,
  resetKey,
  onToken,
  onError,
}: TurnstileWidgetProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<TurnstileApi | null>(null);
  const widgetRef = useRef<string | null>(null);
  const lastReset = useRef(resetKey);
  const handlers = useRef({ onToken, onError });
  const [interactive, setInteractive] = useState(false);

  useEffect(() => {
    handlers.current = { onToken, onError };
  });

  useEffect(() => {
    const box = boxRef.current;
    if (box === null) return undefined;
    let active = true;
    loadTurnstile(siteKey).then((api) => {
      if (!active) return;
      if (api === null) {
        handlers.current.onError();
        return;
      }
      apiRef.current = api;
      widgetRef.current =
        api.render(box, {
          sitekey: siteKey,
          callback: (token) => handlers.current.onToken(token),
          'expired-callback': () => handlers.current.onToken(null),
          'timeout-callback': () => handlers.current.onToken(null),
          'error-callback': () => {
            handlers.current.onToken(null);
            handlers.current.onError();
            return true;
          },
          'before-interactive-callback': () => setInteractive(true),
          'after-interactive-callback': () => setInteractive(false),
          language: locale,
          theme: 'dark',
          size: box.clientWidth < FLEXIBLE_MIN_WIDTH ? 'compact' : 'flexible',
          appearance: 'interaction-only',
          retry: 'auto',
          'refresh-expired': 'auto',
        }) ?? null;
    });
    return () => {
      active = false;
      const widget = widgetRef.current;
      widgetRef.current = null;
      if (widget !== null) apiRef.current?.remove(widget);
    };
  }, [siteKey, locale]);

  useEffect(() => {
    if (lastReset.current === resetKey) return;
    lastReset.current = resetKey;
    handlers.current.onToken(null);
    const widget = widgetRef.current;
    if (widget !== null) apiRef.current?.reset(widget);
  }, [resetKey]);

  return (
    <div
      ref={boxRef}
      className={interactive ? 'ac-account-captcha ac-account-captcha--open' : 'ac-account-captcha'}
    />
  );
}
