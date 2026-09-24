import { Notice } from '@/components/content/Notice';
import { Button } from '@/components/controls/Button';

/** A notice whose text is an error, with «Reintentar» when the read can be repeated. */
export function ErrorNotice({
  text,
  onClose,
  onRetry,
  retryLabel,
  closeLabel,
}: {
  text: string;
  onClose: () => void;
  onRetry?: () => void;
  retryLabel?: string;
  closeLabel: string;
}) {
  return (
    <Notice open onClose={onClose} closeLabel={closeLabel}>
      {text}
      {onRetry && retryLabel ? (
        <>
          {' '}
          <Button onClick={onRetry}>{retryLabel}</Button>
        </>
      ) : null}
    </Notice>
  );
}
