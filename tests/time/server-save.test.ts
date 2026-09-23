import { describe, expect, it } from 'vitest';

import {
  getServerSavePreview,
  SERVER_SAVE_LOCAL_TIME,
  SERVER_SAVE_ZONE,
} from '@/lib/time/server-save';

// The assertions read the wall clock with Intl alone: no Temporal in the test,
// so it still holds once the adapter drops the polyfill (spec 13.6, 14.2).
function wallClock(instant: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(instant));
  const at = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${at('year')}-${at('month')}-${at('day')} ${at('hour')}:${at('minute')}`;
}

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

describe('the Sao Paulo midnight seen from other offsets', () => {
  const MIDNIGHT = '2026-09-09';

  it('is the same instant for every visitor, at 00:00 in Sao Paulo', () => {
    const west = getServerSavePreview(MIDNIGHT, 'America/Mexico_City');
    const east = getServerSavePreview(MIDNIGHT, 'Asia/Tokyo');

    expect(east.instant).toBe(west.instant);
    expect(wallClock(west.instant, SERVER_SAVE_ZONE)).toBe('2026-09-09 00:00');
  });

  it('falls before the visitor midnight at UTC−6, on the day before', () => {
    const preview = getServerSavePreview(MIDNIGHT, 'America/Mexico_City');

    expect(wallClock(preview.instant, 'America/Mexico_City')).toBe('2026-09-08 21:00');
    expect(preview.visitorDate).toBe('2026-09-08');
    expect(preview.visitorDate < MIDNIGHT).toBe(true);
  });

  it('falls after the visitor midnight at UTC+9, on the same day', () => {
    const preview = getServerSavePreview(MIDNIGHT, 'Asia/Tokyo');

    expect(wallClock(preview.instant, 'Asia/Tokyo')).toBe('2026-09-09 12:00');
    expect(preview.visitorDate).toBe(MIDNIGHT);
    expect(preview.visitorLocalTime).toBe('12:00');
  });

  it('keeps the −03:00 offset in the southern summer: Brazil has no DST', () => {
    const summer = getServerSavePreview('2027-01-15', SERVER_SAVE_ZONE);
    const winter = getServerSavePreview('2027-07-15', SERVER_SAVE_ZONE);

    expect(summer.instant).toBe('2027-01-15T03:00:00Z');
    expect(winter.instant).toBe('2027-07-15T03:00:00Z');
    expect(wallClock(summer.instant, SERVER_SAVE_ZONE)).toBe('2027-01-15 00:00');
    expect(wallClock(winter.instant, SERVER_SAVE_ZONE)).toBe('2027-07-15 00:00');
  });

  it('crosses to the next visitor day at UTC+9 but not at UTC−6', () => {
    const west = getServerSavePreview('2027-01-15', 'America/Mexico_City');
    const east = getServerSavePreview('2027-01-15', 'Asia/Tokyo');

    expect(west.visitorDate).toBe('2027-01-14');
    expect(east.visitorDate).toBe('2027-01-15');
  });
});
