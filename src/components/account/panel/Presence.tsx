import type { EstadoPresencia } from '@/lib/trade/limits';

/** The online status as a dot and its label (9.15.6). */
export function Presence({ value, label }: { value: EstadoPresencia; label: string }) {
  return (
    <span className="ac-panel-presence" data-presence={value}>
      <span className="ac-panel-presence__dot" aria-hidden="true" />
      {label}
    </span>
  );
}
