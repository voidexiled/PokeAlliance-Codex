import { Notice } from '@/components/content/Notice';
import { Button } from '@/components/controls/Button';
import type { Locale } from '@/i18n/config';
import { mapSupabaseError } from '@/lib/supabase/errors';

/**
 * A failed read of an account page: `mapSupabaseError` (12.14.1), never the raw message, and
 * «Reintentar». Closing it only hides it; a new failure shows it again.
 */
export function PageError({
  error,
  locale,
  retry,
  dismiss,
  onRetry,
}: {
  error: unknown;
  locale: Locale;
  retry: string;
  dismiss: string;
  onRetry: () => void;
}) {
  return (
    <Notice closeLabel={dismiss}>
      {mapSupabaseError(error, locale)} <Button onClick={onRetry}>{retry}</Button>
    </Notice>
  );
}
