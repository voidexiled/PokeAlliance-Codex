import { useState } from 'react';

import { fill } from '@/i18n/messages/types';
import {
  ESTADOS_PRESENCIA,
  PRESENCIA_INACTIVO_HORAS,
  PRESENCIA_SIN_SENAL_MIN,
  type EstadoPresencia,
} from '@/lib/trade/limits';

import { Notice } from '@/components/content/Notice';
import { Section } from '@/components/layout/Section';

import type { PanelContext } from './types';

// «Estado en línea» (9.15.6, Cuenta-panel.dc.html): the three states as toggles with their dot,
// the chosen one with the `selected` ring, and what the others see. The header dot follows at
// once; a refusal puts the old state back and says why.

interface PresenceSectionProps extends PanelContext {
  value: EstadoPresencia;
  /** Saves the state; the error to show, or null. */
  onChoose: (value: EstadoPresencia) => Promise<string | null>;
}

export default function PresenceSection({
  panel,
  trade,
  ui,
  value,
  onChoose,
}: PresenceSectionProps) {
  const [error, setError] = useState<string | null>(null);

  async function choose(next: EstadoPresencia) {
    if (next === value) return;
    setError(null);
    setError(await onChoose(next));
  }

  return (
    <Section id="cuenta-estado" title={panel.sections.estado}>
      <div className="ac-panel-box">
        <div className="ac-panel-toggles" role="group" aria-label={trade.presence.label}>
          {ESTADOS_PRESENCIA.map((state) => (
            <button
              key={state}
              type="button"
              className="ac-panel-toggle"
              aria-pressed={state === value}
              onClick={() => void choose(state)}
            >
              <span className="ac-panel-presence" data-presence={state}>
                <span className="ac-panel-presence__dot" aria-hidden="true" />
                {trade.presence[state]}
              </span>
            </button>
          ))}
        </div>
        <p className="ac-panel-setting__help ac-panel-toggles__help">
          {fill(panel.presenceHelp, {
            hours: PRESENCIA_INACTIVO_HORAS,
            minutes: PRESENCIA_SIN_SENAL_MIN,
          })}
        </p>
      </div>
      {error !== null ? (
        <Notice open onClose={() => setError(null)} closeLabel={ui.dismiss}>
          {error}
        </Notice>
      ) : null}
    </Section>
  );
}
