import { useEffect, useState } from 'react';

import { getServerSavePreview, SERVER_SAVE_ZONE } from '@/lib/time/server-save';
import type { Locale } from '@/i18n/config';

interface ServerSaveStatusProps {
  canonicalDate: string;
  locale: Locale;
}

export function ServerSaveStatus({ canonicalDate, locale }: ServerSaveStatusProps) {
  const [visitorZone, setVisitorZone] = useState(SERVER_SAVE_ZONE);

  useEffect(() => {
    setVisitorZone(Intl.DateTimeFormat().resolvedOptions().timeZone || SERVER_SAVE_ZONE);
  }, []);

  const preview = getServerSavePreview(canonicalDate, visitorZone);
  const labels =
    locale === 'es'
      ? {
          title: 'Server Save',
          description: 'Hora canónica convertida a tu zona',
          date: 'Tu fecha local',
        }
      : {
          title: 'Server Save',
          description: 'Canonical time converted to your zone',
          date: 'Your local date',
        };

  return (
    <section className="wiki-panel p-4" data-testid="server-save-status">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">{labels.title}</h2>
        <span className="status-label" data-status="supported">
          Temporal
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{labels.description}</p>
      <div className="mt-4 flex flex-col gap-2">
        <p className="font-mono text-lg font-semibold tracking-[-0.04em] text-foreground">
          {preview.visitorDate} · {preview.visitorLocalTime}
        </p>
        <p className="text-xs text-muted-foreground">
          {labels.date}: <span className="font-mono text-foreground/80">{preview.visitorZone}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          00:00 · <span className="font-mono">{SERVER_SAVE_ZONE}</span>
        </p>
      </div>
    </section>
  );
}
