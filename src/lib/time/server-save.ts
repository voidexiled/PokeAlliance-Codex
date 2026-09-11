import { Temporal } from '@js-temporal/polyfill';

export const SERVER_SAVE_ZONE = 'America/Sao_Paulo';
export const SERVER_SAVE_LOCAL_TIME = '00:00:00';

export interface ServerSavePreview {
  canonicalDate: string;
  canonicalZone: string;
  canonicalLocalTime: string;
  instant: string;
  visitorZone: string;
  visitorDate: string;
  visitorLocalTime: string;
}

export function getServerSavePreview(
  canonicalDate: string,
  visitorZone: string,
): ServerSavePreview {
  const date = Temporal.PlainDate.from(canonicalDate);
  const canonical = Temporal.ZonedDateTime.from({
    timeZone: SERVER_SAVE_ZONE,
    year: date.year,
    month: date.month,
    day: date.day,
    hour: 0,
    minute: 0,
    second: 0,
    millisecond: 0,
    microsecond: 0,
    nanosecond: 0,
  });
  const instant = canonical.toInstant();
  const visitor = instant.toZonedDateTimeISO(visitorZone);

  return {
    canonicalDate: date.toString(),
    canonicalZone: SERVER_SAVE_ZONE,
    canonicalLocalTime: SERVER_SAVE_LOCAL_TIME,
    instant: instant.toString(),
    visitorZone,
    visitorDate: visitor.toPlainDate().toString(),
    visitorLocalTime: visitor.toPlainTime().toString({ smallestUnit: 'minute' }),
  };
}

export function formatServerSaveForDisplay(
  canonicalDate: string,
  visitorZone: string,
  locale = 'es-MX',
): string {
  const preview = getServerSavePreview(canonicalDate, visitorZone);

  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: visitorZone,
  }).format(new Date(preview.instant));
}
