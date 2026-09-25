// The parameters of Comercio and of the accounts (spec 9.12.6 and 9.15.8), with their default
// values, and the few rules that depend on nothing else. The database holds the same values in
// the SQL parameter module of the migrations and enforces every one of them (9.12.3): the
// interface reads them here only to say a limit before the server refuses it (a field message,
// a disabled action, the state of a transaction). The owner may change them (D-B6); a change goes
// here and in the SQL module together.
//
// Client-safe: no imports, so an island, a script or the server read it alike.

// ------------------------------------------------------------------------------ 9.12.6

/** Days a listing stays published after publishing or renewing it (`ANUNCIO_DIAS_VIGENCIA`). */
export const ANUNCIO_DIAS_VIGENCIA = 14;
/** Listings a seller may have `publicado` or `reservado` at once. */
export const ANUNCIOS_ACTIVOS_MAX = 20;
/** New listings a seller may publish in 24 h. */
export const ANUNCIOS_NUEVOS_24H = 10;
/** New transactions a buyer may start in 24 h. */
export const OPERACIONES_NUEVAS_24H = 20;
/** Reports an account may send in 24 h. */
export const REPORTES_24H = 10;
/** Days after a transaction is `confirmada` during which each party may review the other (`RESENA_DIAS`). */
export const RESENA_DIAS = 30;
/** Days during which the author may edit a review. */
export const RESENA_EDICION_DIAS = 7;
/** Days without a change after which a transaction not yet `confirmada` is `caducada`. */
export const OPERACION_CADUCIDAD_DIAS = 30;

// ------------------------------------------------------------------------------ 9.15.8

/** Minimum age of an account (`EDAD_MINIMA_CUENTA`); the wiki asks for no account. */
export const EDAD_MINIMA_CUENTA = 13;
/** Minimum age for every Comercio action (`EDAD_MINIMA_COMERCIO`). */
export const EDAD_MINIMA_COMERCIO = 18;
/** Minimum age, in days, of the linked Discord account (`DISCORD_EDAD_MIN_DIAS`). */
export const DISCORD_EDAD_MIN_DIAS = 60;
/** Minimum length of a password (`CONTRASENA_MIN`). */
export const CONTRASENA_MIN = 10;
/** Whether a verified phone is step 2b of the registration (`TELEFONO_OBLIGATORIO`): off while SMS cannot be paid. */
export const TELEFONO_OBLIGATORIO = false;
/** Confirmed transactions of the same two accounts, in any role, that admit reviews per 24 h (`RESENAS_PAR_DIA`). */
export const RESENAS_PAR_DIA = 3;
/** Days the IP and device evidence of a Comercio action is kept (`EVIDENCIA_DIAS`). */
export const EVIDENCIA_DIAS = 90;
/** Minutes without a heartbeat after which an account is `desconectado` (`PRESENCIA_SIN_SENAL_MIN`). */
export const PRESENCIA_SIN_SENAL_MIN = 10;
/** Hours without keyboard or pointer input after which «En el juego» shows as `ausente` (`PRESENCIA_INACTIVO_HORAS`). */
export const PRESENCIA_INACTIVO_HORAS = 6;
/** Game characters (player name + world) one account may hold (`PERSONAJES_MAX`, owner rule 2026-09-24). */
export const PERSONAJES_MAX = 10;

// ------------------------------------------------------------------ fixed by 9.9 to 9.15

/** Seconds between two heartbeats of a signed-in, visible tab (9.15.6, egress 9.16.4). */
export const PRESENCIA_LATIDO_S = 120;
/** Stars of a review: 1 to 5, whole (9.15.4). */
export const PUNTUACION_MIN = 1;
export const PUNTUACION_MAX = 5;
/** Longest review comment, in characters (9.10). */
export const RESENA_COMENTARIO_MAX = 1000;
/** Longest report detail, in characters (9.11). */
export const REPORTE_DETALLE_MAX = 1000;
/** «Nombre de usuario», the public handle: 3 to 24 of `[a-z0-9_-]` (9.9, 9.15.1). */
export const NOMBRE_USUARIO_MIN = 3;
export const NOMBRE_USUARIO_MAX = 24;
/** «Nombre del jugador», the game character: 1 to 32 characters (9.15.1). */
export const NOMBRE_JUGADOR_MAX = 32;
/** Name of another contact platform, in characters (9.9). */
export const PLATAFORMA_MAX = 32;
/**
 * The «Reputación» order (9.15.4): `(media × contrapartes + 3,5 × 5) / (contrapartes + 5)`, a mean
 * pulled towards 3.5 as if every account started with 5 counterparts at that mean.
 */
export const REPUTACION_MEDIA_PREVIA = 3.5;
export const REPUTACION_PESO_PREVIO = 5;

/**
 * Versions of the texts an account accepts (9.15.1, 9.15.2). The account sends the version it was
 * shown and the database stores it with the date; the database refuses a version that is not its
 * current one, and a new version asks again. Changing a text changes its version here and in the
 * SQL module together.
 */
export const TERMINOS_VERSION = '2026-09-23';
export const CONSENTIMIENTO_DINERO_REAL_VERSION = '2026-09-23';

// ------------------------------------------------------------------------------- rules

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** A moment: a `Date`, epoch milliseconds or an ISO 8601 instant, so tests inject the clock (14). */
export type Moment = Date | number | string;

/** Epoch milliseconds of a moment; `NaN` when a string cannot be read. */
function epoch(value: Moment): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Date.parse(value);
  return value.getTime();
}

/** When a listing published or renewed at `publishedAt` stops being listed (9.7.8). */
export function listingExpiry(publishedAt: Moment): Date {
  return new Date(epoch(publishedAt) + ANUNCIO_DIAS_VIGENCIA * DAY_MS);
}

/** Whether a party may still review a transaction confirmed at `confirmedAt` (9.15.4). */
export function reviewWindowOpen(confirmedAt: Moment, now: Moment): boolean {
  const elapsed = epoch(now) - epoch(confirmedAt);
  return elapsed >= 0 && elapsed <= RESENA_DIAS * DAY_MS;
}

/** Whether the author may still edit a review written at `createdAt` (9.10). */
export function reviewEditable(createdAt: Moment, now: Moment): boolean {
  const elapsed = epoch(now) - epoch(createdAt);
  return elapsed >= 0 && elapsed <= RESENA_EDICION_DIAS * DAY_MS;
}

/** Whether a transaction not yet `confirmada`, last changed at `changedAt`, is `caducada` (9.10). */
export function transactionLapsed(changedAt: Moment, now: Moment): boolean {
  return epoch(now) - epoch(changedAt) > OPERACION_CADUCIDAD_DIAS * DAY_MS;
}

/** The online states (9.15.6): what an account chooses and what the others see. */
export const ESTADOS_PRESENCIA = ['en_juego', 'ausente', 'desconectado'] as const;
export type EstadoPresencia = (typeof ESTADOS_PRESENCIA)[number];

export function isEstadoPresencia(value: unknown): value is EstadoPresencia {
  return ESTADOS_PRESENCIA.includes(value as EstadoPresencia);
}

/** One row of `trade_presence` (9.15.6). */
export interface PresenceRecord {
  /** The state the account chose. */
  estado: EstadoPresencia;
  /** The last heartbeat; `null` before the first one. */
  lastSeenAt: Moment | null;
  /** The last heartbeat that reported keyboard or pointer input; `null` before the first one. */
  lastInputAt: Moment | null;
}

/**
 * The state the others see at `now` (9.15.6), the rule of `trade_effective_presence`:
 * `desconectado` when the last heartbeat is more than `PRESENCIA_SIN_SENAL_MIN` minutes old (or
 * there is none), `ausente` when the account chose «En el juego» but sent no input for more than
 * `PRESENCIA_INACTIVO_HORAS` hours, and otherwise the state it chose. Whether the account still
 * has a session only the server knows; it answers `desconectado` without one.
 */
export function effectivePresence(record: PresenceRecord, now: Moment): EstadoPresencia {
  const at = epoch(now);
  const seen = record.lastSeenAt === null ? NaN : epoch(record.lastSeenAt);
  if (Number.isNaN(seen) || at - seen > PRESENCIA_SIN_SENAL_MIN * MINUTE_MS) return 'desconectado';
  if (record.estado === 'en_juego') {
    const input = record.lastInputAt === null ? NaN : epoch(record.lastInputAt);
    if (Number.isNaN(input) || at - input > PRESENCIA_INACTIVO_HORAS * HOUR_MS) return 'ausente';
  }
  return record.estado;
}

/**
 * The key of the «Reputación» order (9.15.4) for an account with `media` over `contrapartes`
 * distinct reviewing counterparts; without reviews it is the prior, 3.5. Ties are broken by the
 * number of confirmed transactions, which the caller compares.
 */
export function reputationScore(media: number | null, contrapartes: number): number {
  const weight = media === null ? 0 : Math.max(0, contrapartes);
  const mean = media ?? 0;
  return (
    (mean * weight + REPUTACION_MEDIA_PREVIA * REPUTACION_PESO_PREVIO) /
    (weight + REPUTACION_PESO_PREVIO)
  );
}

/**
 * `TELEFONO_OBLIGATORIO` of a build (9.15.1, 9.15.7): «1» or «true» switch the phone step on;
 * anything else keeps the default.
 */
export function telefonoObligatorio(raw: string | undefined): boolean {
  const value = raw?.trim().toLowerCase();
  if (value === '1' || value === 'true') return true;
  if (value === '0' || value === 'false') return false;
  return TELEFONO_OBLIGATORIO;
}

/**
 * Cache-Control of the public Comercio pages rendered on the server (list, detail, seller).
 * Their HTML holds nothing personal, so the Vercel CDN reads Supabase at most once every 30 s per
 * address (egress, 9.16.4).
 */
export const COMERCIO_CACHE_CONTROL = 'public, s-maxage=30, stale-while-revalidate=300';
