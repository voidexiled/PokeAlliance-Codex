import { describe, expect, it } from 'vitest';

import {
  formatDate,
  formatDateRange,
  formatDateTime,
  formatDayMonth,
  formatRelative,
  formatServerTime,
  formatTime,
  formatWeekday,
  GAME_ZONE,
} from '@/lib/format/dates';
import { UNKNOWN } from '@/lib/format/unknown';

// 14:32 in Brasília time.
const MOMENT = new Date('2026-09-18T17:32:00Z');
const TAG = { es: 'es-MX', en: 'en-US' } as const;

// V4-3: every formatter is compared with the same Intl it is built on, not with
// a literal, because the exact output moves with the ICU version.
function intl(locale: 'es' | 'en', options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(TAG[locale], { ...options, timeZone: GAME_ZONE });
}

describe('formatDate', () => {
  it('matches its own Intl options in both languages', () => {
    expect(formatDate(MOMENT, 'es')).toBe(
      intl('es', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(MOMENT),
    );
    expect(formatDate(MOMENT, 'en')).toBe(
      intl('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(MOMENT),
    );
  });

  it('writes day before month in es', () => {
    expect(formatDate(MOMENT, 'es')).toBe('18/09/2026');
  });

  it('accepts an ISO string and returns the dash for an unknown date', () => {
    expect(formatDate('2026-09-18T17:32:00Z', 'es')).toBe('18/09/2026');
    expect(formatDate(null, 'es')).toBe(UNKNOWN);
    expect(formatDate('not a date', 'es')).toBe(UNKNOWN);
  });
});

describe('formatTime', () => {
  it('matches its own Intl options in both languages', () => {
    expect(formatTime(MOMENT, 'es')).toBe(
      intl('es', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(MOMENT),
    );
    expect(formatTime(MOMENT, 'en')).toBe(
      intl('en', { hour: 'numeric', minute: '2-digit' }).format(MOMENT),
    );
  });

  it('uses a 24 h clock in es and a 12 h clock in en', () => {
    expect(formatTime(MOMENT, 'es')).toBe('14:32');
    expect(formatTime(MOMENT, 'es')).not.toMatch(/[ap]\.?\s?m/i);
    expect(formatTime(MOMENT, 'en')).toMatch(/2:32/);
  });
});

describe('formatDateTime', () => {
  it('matches its own Intl options in both languages', () => {
    expect(formatDateTime(MOMENT, 'es')).toBe(
      intl('es', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).format(MOMENT),
    );
    expect(formatDateTime(MOMENT, 'en')).toBe(
      intl('en', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(MOMENT),
    );
  });

  it('writes the date then the time in es, 24 h', () => {
    expect(formatDateTime(MOMENT, 'es')).toBe('18/09/2026, 14:32');
  });

  it('reads another time zone when one is given', () => {
    expect(formatDateTime(MOMENT, 'es', 'UTC')).toBe('18/09/2026, 17:32');
  });
});

describe('formatServerTime', () => {
  it('reads the clock in Brasília time and names it', () => {
    expect(formatServerTime(MOMENT, 'es')).toBe('18/09/2026, 14:32 (hora de Brasilia)');
    expect(formatServerTime(MOMENT, 'en')).toBe(`${formatDateTime(MOMENT, 'en')} (Brasília time)`);
  });

  it('ignores the reader time zone: the game clock is always Brasília', () => {
    expect(formatServerTime(MOMENT, 'es')).toContain(formatDateTime(MOMENT, 'es', GAME_ZONE));
  });

  it('returns the dash for an unknown moment', () => {
    expect(formatServerTime(null, 'es')).toBe(UNKNOWN);
  });
});

describe('formatDayMonth', () => {
  it('matches its own Intl options in both languages', () => {
    expect(formatDayMonth(MOMENT, 'es')).toBe(
      intl('es', { day: '2-digit', month: '2-digit' }).format(MOMENT),
    );
    expect(formatDayMonth(MOMENT, 'en')).toBe(
      intl('en', { month: 'short', day: 'numeric' }).format(MOMENT),
    );
  });

  it('writes day before month in es, with two digits', () => {
    expect(formatDayMonth(MOMENT, 'es')).toBe('18/09');
  });
});

describe('formatWeekday', () => {
  it('writes the weekday with its initial capital in es', () => {
    const weekday = intl('es', { weekday: 'long' }).format(MOMENT);
    expect(formatWeekday(MOMENT, 'es')).toBe(
      `${weekday.charAt(0).toLocaleUpperCase('es-MX')}${weekday.slice(1)} 18/09`,
    );
    expect(formatWeekday(MOMENT, 'es')).toBe('Viernes 18/09');
  });

  it('uses the Intl weekday format in en', () => {
    expect(formatWeekday(MOMENT, 'en')).toBe(
      intl('en', { weekday: 'long', month: 'short', day: 'numeric' }).format(MOMENT),
    );
  });

  it('returns the dash for an unknown date', () => {
    expect(formatWeekday(null, 'en')).toBe(UNKNOWN);
  });
});

describe('formatDateRange', () => {
  const from = new Date('2026-09-14T12:00:00Z');
  const to = new Date('2026-09-20T12:00:00Z');

  it('joins the two day/month figures in es', () => {
    expect(formatDateRange(from, to, 'es')).toBe('14/09 a 20/09');
  });

  it('uses formatRange in en', () => {
    expect(formatDateRange(from, to, 'en')).toBe(
      intl('en', { month: 'short', day: 'numeric' }).formatRange(from, to),
    );
  });

  it('returns the dash when an end is unknown', () => {
    expect(formatDateRange(from, null, 'es')).toBe(UNKNOWN);
  });
});

describe('formatRelative', () => {
  const now = MOMENT;
  const relative = (locale: 'es' | 'en') =>
    new Intl.RelativeTimeFormat(TAG[locale], { style: 'short' });

  it('matches its own Intl.RelativeTimeFormat under 24 h', () => {
    const twelveMinutesAgo = new Date(now.getTime() - 12 * 60_000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60_000);

    expect(formatRelative(twelveMinutesAgo, 'es', now)).toBe(relative('es').format(-12, 'minute'));
    expect(formatRelative(oneHourAgo, 'es', now)).toBe(relative('es').format(-1, 'hour'));
    expect(formatRelative(twelveMinutesAgo, 'en', now)).toBe(relative('en').format(-12, 'minute'));
    expect(formatRelative(oneHourAgo, 'en', now)).toBe(relative('en').format(-1, 'hour'));
  });

  it('says "hace" in es', () => {
    const twelveMinutesAgo = new Date(now.getTime() - 12 * 60_000);
    expect(formatRelative(twelveMinutesAgo, 'es', now)).toContain('hace');
  });

  it('falls back to the date from 24 h on', () => {
    const twoDaysAgo = new Date(now.getTime() - 2 * 86_400_000);
    expect(formatRelative(twoDaysAgo, 'es', now)).toBe(formatDate(twoDaysAgo, 'es'));
    expect(formatRelative(twoDaysAgo, 'es', now)).toBe('16/09/2026');
  });

  it('counts seconds under a minute and stays relative just under 24 h', () => {
    const halfMinuteAgo = new Date(now.getTime() - 30_000);
    const almostADayAgo = new Date(now.getTime() - (86_400_000 - 60_000));

    expect(formatRelative(halfMinuteAgo, 'es', now)).toBe(relative('es').format(-30, 'second'));
    expect(formatRelative(almostADayAgo, 'es', now)).toBe(relative('es').format(-23, 'hour'));
  });

  it('returns the dash for an unknown moment', () => {
    expect(formatRelative(null, 'es', now)).toBe(UNKNOWN);
  });
});
