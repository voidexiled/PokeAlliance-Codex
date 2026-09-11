import { describe, expect, it } from 'vitest';

import {
  getServerSavePreview,
  SERVER_SAVE_LOCAL_TIME,
  SERVER_SAVE_ZONE,
} from '@/lib/time/server-save';

describe('Server Save Temporal adapter', () => {
  it('converts the canonical midnight to Mexico City local time', () => {
    const preview = getServerSavePreview('2026-09-09', 'America/Mexico_City');

    expect(preview.canonicalZone).toBe(SERVER_SAVE_ZONE);
    expect(preview.canonicalLocalTime).toBe(SERVER_SAVE_LOCAL_TIME);
    expect(preview.instant).toBe('2026-09-09T03:00:00Z');
    expect(preview.visitorDate).toBe('2026-09-08');
    expect(preview.visitorLocalTime).toBe('21:00');
  });

  it('keeps the canonical date in Sao Paulo', () => {
    const preview = getServerSavePreview('2026-12-12', SERVER_SAVE_ZONE);

    expect(preview.visitorDate).toBe('2026-12-12');
    expect(preview.visitorLocalTime).toBe('00:00');
  });
});
