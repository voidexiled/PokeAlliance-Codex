// The parameters of Comercio and of the accounts (9.12.6, 9.15.8) and the rules that depend on
// them alone: validity, review windows, lapsed deals, the online status of 9.15.6 with the clock
// injected (9.15.9 item 9) and the «Reputación» order of 9.15.4. The values must match the SQL
// parameter module of the migrations, which the owner changes together with this one (D-B6).
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import * as limits from '@/lib/trade/limits';
import {
  effectivePresence,
  isEstadoPresencia,
  listingExpiry,
  reputationScore,
  reviewEditable,
  reviewWindowOpen,
  telefonoObligatorio,
  transactionLapsed,
} from '@/lib/trade/limits';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const T0 = Date.parse('2026-09-23T12:00:00Z');

describe('parameters (9.12.6, 9.15.8)', () => {
  it('hold the values of the spec', () => {
    expect({
      ANUNCIO_DIAS_VIGENCIA: limits.ANUNCIO_DIAS_VIGENCIA,
      ANUNCIOS_ACTIVOS_MAX: limits.ANUNCIOS_ACTIVOS_MAX,
      ANUNCIOS_NUEVOS_24H: limits.ANUNCIOS_NUEVOS_24H,
      OPERACIONES_NUEVAS_24H: limits.OPERACIONES_NUEVAS_24H,
      REPORTES_24H: limits.REPORTES_24H,
      RESENA_DIAS: limits.RESENA_DIAS,
      RESENA_EDICION_DIAS: limits.RESENA_EDICION_DIAS,
      OPERACION_CADUCIDAD_DIAS: limits.OPERACION_CADUCIDAD_DIAS,
      EDAD_MINIMA_CUENTA: limits.EDAD_MINIMA_CUENTA,
      EDAD_MINIMA_COMERCIO: limits.EDAD_MINIMA_COMERCIO,
      DISCORD_EDAD_MIN_DIAS: limits.DISCORD_EDAD_MIN_DIAS,
      CONTRASENA_MIN: limits.CONTRASENA_MIN,
      TELEFONO_OBLIGATORIO: limits.TELEFONO_OBLIGATORIO,
      RESENAS_PAR_DIA: limits.RESENAS_PAR_DIA,
      EVIDENCIA_DIAS: limits.EVIDENCIA_DIAS,
      PRESENCIA_SIN_SENAL_MIN: limits.PRESENCIA_SIN_SENAL_MIN,
      PRESENCIA_INACTIVO_HORAS: limits.PRESENCIA_INACTIVO_HORAS,
    }).toEqual({
      ANUNCIO_DIAS_VIGENCIA: 14,
      ANUNCIOS_ACTIVOS_MAX: 20,
      ANUNCIOS_NUEVOS_24H: 10,
      OPERACIONES_NUEVAS_24H: 20,
      REPORTES_24H: 10,
      RESENA_DIAS: 30,
      RESENA_EDICION_DIAS: 7,
      OPERACION_CADUCIDAD_DIAS: 30,
      EDAD_MINIMA_CUENTA: 13,
      EDAD_MINIMA_COMERCIO: 18,
      DISCORD_EDAD_MIN_DIAS: 60,
      CONTRASENA_MIN: 10,
      TELEFONO_OBLIGATORIO: false,
      RESENAS_PAR_DIA: 3,
      EVIDENCIA_DIAS: 90,
      PRESENCIA_SIN_SENAL_MIN: 10,
      PRESENCIA_INACTIVO_HORAS: 6,
    });
  });

  it('match every parameter row the migrations seed', () => {
    const dir = join(process.cwd(), 'supabase', 'migrations');
    const seeded = new Map<string, unknown>();
    for (const file of readdirSync(dir).filter((name) => name.endsWith('.sql'))) {
      const sql = readFileSync(join(dir, file), 'utf8');
      for (const insert of sql.matchAll(/insert into public\.app_parameters[^;]*;/gi)) {
        for (const [, name, value] of insert[0].matchAll(
          /\(\s*'([A-Z][A-Z0-9_]*)'\s*,\s*'([^']*)'/g,
        )) {
          seeded.set(name ?? '', JSON.parse(value ?? 'null'));
        }
      }
    }
    const exported = limits as unknown as Record<string, unknown>;
    for (const [name, value] of seeded) {
      expect(exported[name], name).toEqual(value);
    }
  });
});

describe('listing and review windows (9.7.8, 9.10, 9.15.4)', () => {
  it('a listing is valid for 14 days from publishing or renewing', () => {
    expect(listingExpiry(T0).getTime()).toBe(T0 + 14 * DAY);
    expect(listingExpiry('2026-09-23T12:00:00Z').toISOString()).toBe('2026-10-07T12:00:00.000Z');
  });

  it('a confirmed deal admits reviews for 30 days', () => {
    expect(reviewWindowOpen(T0, T0 + 30 * DAY)).toBe(true);
    expect(reviewWindowOpen(T0, T0 + 30 * DAY + 1)).toBe(false);
    expect(reviewWindowOpen(T0, T0 - 1)).toBe(false);
  });

  it('a review can be edited for 7 days', () => {
    expect(reviewEditable(T0, T0 + 7 * DAY)).toBe(true);
    expect(reviewEditable(T0, T0 + 7 * DAY + 1)).toBe(false);
  });

  it('a deal without a change for 30 days lapses', () => {
    expect(transactionLapsed(T0, T0 + 30 * DAY)).toBe(false);
    expect(transactionLapsed(T0, T0 + 30 * DAY + 1)).toBe(true);
  });
});

describe('online status (9.15.6, 9.15.9 item 9)', () => {
  const beatAt = T0;

  it('is the chosen state while the heartbeat is recent', () => {
    for (const estado of ['en_juego', 'ausente', 'desconectado'] as const) {
      expect(
        effectivePresence({ estado, lastSeenAt: beatAt, lastInputAt: beatAt }, T0 + MINUTE),
      ).toBe(estado);
    }
  });

  it('is «Desconectado» after 10 minutes without a beat, or before the first one', () => {
    const record = { estado: 'en_juego' as const, lastSeenAt: beatAt, lastInputAt: beatAt };
    expect(effectivePresence(record, beatAt + 10 * MINUTE)).toBe('en_juego');
    expect(effectivePresence(record, beatAt + 10 * MINUTE + 1)).toBe('desconectado');
    expect(effectivePresence({ ...record, lastSeenAt: null }, beatAt)).toBe('desconectado');
  });

  it('is «Ausente» after 6 hours without input while «En el juego»', () => {
    const now = T0 + 6 * HOUR;
    const record = { estado: 'en_juego' as const, lastSeenAt: now - MINUTE, lastInputAt: T0 };
    expect(effectivePresence(record, now)).toBe('en_juego');
    expect(effectivePresence(record, now + 1)).toBe('ausente');
    expect(effectivePresence({ ...record, lastInputAt: null }, now)).toBe('ausente');
    // Only «En el juego» decays: «Desconectado» chosen stays as it is.
    expect(effectivePresence({ ...record, estado: 'desconectado' }, now + HOUR)).toBe(
      'desconectado',
    );
  });

  it('knows its three states', () => {
    expect(isEstadoPresencia('en_juego')).toBe(true);
    expect(isEstadoPresencia('online')).toBe(false);
    expect(isEstadoPresencia(null)).toBe(false);
  });
});

describe('«Reputación» order (9.15.4)', () => {
  it('pulls a mean towards 3.5 as if with 5 counterparts at that mean', () => {
    expect(reputationScore(null, 0)).toBe(3.5);
    expect(reputationScore(5, 5)).toBe(4.25);
    expect(reputationScore(4.8, 50)).toBeCloseTo((4.8 * 50 + 17.5) / 55, 10);
    // Many counterparts weigh more than one perfect review.
    expect(reputationScore(4.6, 40)).toBeGreaterThan(reputationScore(5, 1));
  });
});

describe('TELEFONO_OBLIGATORIO of a build', () => {
  it('reads «1» and «true», and keeps the default otherwise', () => {
    expect(telefonoObligatorio('1')).toBe(true);
    expect(telefonoObligatorio(' TRUE ')).toBe(true);
    expect(telefonoObligatorio('0')).toBe(false);
    expect(telefonoObligatorio('')).toBe(false);
    expect(telefonoObligatorio(undefined)).toBe(false);
  });
});
