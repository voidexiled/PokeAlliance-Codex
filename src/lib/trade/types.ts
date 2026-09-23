// The model of a Comercio listing (spec 9.4): the types every module of src/lib/trade/ and every
// Comercio page reads, the constants the model fixes and the few rules that only depend on it.
// In phase A the sample registry of content/comercio/ fills them (./registry.ts, read only with
// COMERCIO_DEMO=1, 9.2); in phase B the rows of 9.12.1 will.
//
// Client-safe on purpose: nothing here imports code, so an island (the list, the form) takes its
// types, its constants and its rules without Zod or the file system (AGENTS.md, «Zod stays on the
// server»). content/schemas/comercio.schema.json repeats the lists and limits for VS Code and
// `pnpm content:check`: registry.ts refuses to load if the two disagree, and
// tests/trade/registry.test.ts checks them too.
//
// The lists live here and not only in the JSON Schema because spec 9.7.4 makes the currencies a
// constant of this file (Q9) and every consumer switches on these literal unions.
import type { RealCurrency } from '@/lib/format/numbers';

/** Asset types, in the fixed order of the tabs, the groups and Slots (R4). */
export const TIPOS_ACTIVO = ['pokemon', 'items', 'diamonds', 'pokedolares'] as const;
export type TipoActivo = (typeof TIPOS_ACTIVO)[number];

/**
 * Real-money currencies of a price (9.4, 9.7.4). Q9 is open: until the owner answers, R$, US$ and
 * MX$. `formatRealMoney` of src/lib/format/numbers.ts writes the symbol of each one, so a currency
 * it does not know is a type error here.
 */
export const MONEDAS_REALES = ['BRL', 'USD', 'MXN'] as const satisfies readonly RealCurrency[];
export type MonedaReal = (typeof MONEDAS_REALES)[number];

/** The symbol each currency shows: «R$», «US$», «MX$» (9.4), the options of the «Moneda» filter. */
export const SIMBOLOS_MONEDA: Readonly<Record<MonedaReal, string>> = {
  BRL: 'R$',
  USD: 'US$',
  MXN: 'MX$',
};

/** The two game currencies an in-game price option is written in (9.4). */
export const MONEDAS_JUEGO = ['pokedolares', 'diamonds'] as const;
export type MonedaJuego = (typeof MONEDAS_JUEGO)[number];

/** One in-game price option: a whole amount of at least 1 in base units (R5: 50kk is 50000000). */
export type OpcionJuego = { tipo: MonedaJuego; cantidad: number };

/** The states of a listing (9.4, 9.7.8). */
export const ESTADOS_ANUNCIO = [
  'publicado',
  'reservado',
  'completado',
  'expirado',
  'retirado',
] as const;
export type EstadoAnuncio = (typeof ESTADOS_ANUNCIO)[number];

/** The real-money part of a price: the amount as stored, a decimal with a point and at most 2 decimals («90», «35.50»). */
export type PrecioReal = { moneda: MonedaReal; importe: string };

/**
 * The price of a listing (9.4, 9.7.4): real money, 0 to 2 in-game options of different types, or
 * «A convenir», which leaves both parts empty.
 */
export type Precio = {
  real: PrecioReal | null;
  juego: OpcionJuego[];
  aConvenir: boolean;
};

/**
 * The eight training skills, in the order of the form and of the card (9.4).
 * Game terms, written in English in both languages (T23).
 */
export const HABILIDADES = [
  'Attack',
  'Critical Damage',
  'Critical Chance',
  'Critical Resistance',
  'Defense',
  'HP',
  'Precision',
  'Evasion',
] as const;
export type Habilidad = (typeof HABILIDADES)[number];

/** Held items of one Pokémon: the two fields Held X and Held Y of the old composer (9.4). */
export const HELDS_MAX = 2;
/** Highest tier of a held item: a limit of the field, not a fact of the game (Q8). */
export const HELD_TIER_MAX = 99;
/** Highest Boost (9.7.2, `docs/CONTENT_PLAN.md:207`). */
export const BOOST_MAX = 50;
/** Highest Star Level (9.7.2, `docs/CONTENT_PLAN.md:540`). */
export const STAR_LEVEL_MAX = 5;
/** Memory Slots of a Ditto or a Shiny Ditto: 1 to 6 (9.7.2). */
export const MEMORY_SLOTS_MAX = 6;
/** Highest training level: up to 6 digits (9.7.2). */
export const NIVEL_ENTRENAMIENTO_MAX = 999_999;
/** Longest nickname and longest declared name of a Ball or a held item, in characters (9.7.2). */
export const NOMBRE_MAX = 40;
/** Longest declared name of a traded item (9.7.3). */
export const NOMBRE_ITEM_MAX = 80;
/** Largest amount of anything a listing counts: 15 digits (9.4), under `Number.MAX_SAFE_INTEGER`. */
export const CANTIDAD_MAX = 999_999_999_999_999;

/**
 * An entity the seller declares by name (9.4): `item` (or `id`) is the registry id when the name
 * matches a record exactly, ignoring case and accents, and `null` otherwise; then the name is shown
 * as text, without panel or sprite (R2).
 */
export type BallDeclarada = { item: string | null; nombre: string };
export type HeldDeclarado = { item: string | null; nombre: string; tier: number };
export type AddonDeclarado = { id: string | null; nombre: string };
export type ItemDeclarado = { item: string | null; nombre: string; cantidad: number };

/** One declared training skill: its level and its progress to the next one («0» to «100»). */
export type EntrenamientoDeclarado = {
  habilidad: Habilidad;
  nivel: number | null;
  progreso: string | null;
};

/** NPC Price as the seller declares it: «Unsellable» or an amount of Pokédólares (9.7.2). */
export type PrecioNpc = { tipo: 'unsellable' } | { tipo: 'pokedolares'; cantidad: number };

/**
 * The Pokémon a listing sells, as its seller declares it (9.4). The catalogue values (Requisito,
 * Tier, Elementos) are never stored: they are read from content/pokemon.json when shown. `null` is
 * «not declared».
 */
export type UnidadPokemon = {
  /** `id` of content/pokemon.json. */
  pokemon: string;
  ball: BallDeclarada | null;
  /** `id` of content/auras.json. */
  aura: string | null;
  /** 0 to `BOOST_MAX`. */
  boost: number | null;
  /** 0 to `STAR_LEVEL_MAX`. */
  starLevel: number | null;
  /** At most `NOMBRE_MAX` characters, inner spaces kept («S U S A N O O»). */
  nickname: string | null;
  /** 1 to `MEMORY_SLOTS_MAX`, only for Ditto and Shiny Ditto. */
  memorySlots: number | null;
  /** One entry per Memory Slot: an `id` of content/pokemon.json, or `null` for an empty slot. */
  memorias: (string | null)[];
  /** At most `HELDS_MAX`, each with a tier of 1 to `HELD_TIER_MAX`. */
  helds: HeldDeclarado[];
  addon: AddonDeclarado | null;
  /** «0» to «100», at most 2 decimals. */
  nextBoostChance: string | null;
  /** At most one entry per skill. */
  entrenamiento: EntrenamientoDeclarado[];
  precioNpc: PrecioNpc | null;
};

/**
 * A listing (9.4). `pokemon` exists only for the type `pokemon`, `item` only for `items` and
 * `cantidad` only for `diamonds` and `pokedolares`, in base units.
 */
export type Anuncio = {
  /** kebab-case; the `[id]` of `/{l}/comercio/anuncio/[id]/`. */
  id: string;
  tipo: TipoActivo;
  /** The seller's handle: the `id` of a record of content/comercio/vendedores.json. */
  vendedor: string;
  /** `id` of content/mundos.json. */
  mundo: string;
  /** ISO 8601 instant with its zone. */
  publicado: string;
  /** ISO 8601 instant with its zone. */
  expira: string;
  estado: EstadoAnuncio;
  precio: Precio;
  pokemon?: UnidadPokemon;
  item?: ItemDeclarado;
  cantidad?: number;
  /** Every record of the phase A registry carries it (9.4). */
  borrador?: true;
};

/**
 * Contact channel types (9.9), with the keys of the registry in Spanish (R7). Phase B keeps them in
 * `trade_contact_channels.kind` as `email`, `phone`, `discord`, `twitch` and `other`.
 */
export const TIPOS_CANAL = ['correo', 'telefono', 'discord', 'twitch', 'otra'] as const;
export type TipoCanal = (typeof TIPOS_CANAL)[number];

/**
 * A verified contact channel as the public sees it (9.9): only its label, never the address, the
 * number or the user behind it (R13). `etiqueta` holds the part of the label the dictionary cannot
 * write: the country calling code of a phone («+55») and the name of another platform; it is
 * `null` for `correo`, `discord` and `twitch`.
 */
export type Canal = { tipo: TipoCanal; etiqueta: string | null };

/** A review of one confirmed trade (9.10): 0 to 5, an optional comment of up to 1000 characters. */
export type Resena = {
  puntuacion: number;
  comentario: string | null;
  /** ISO 8601 instant with its zone. */
  fecha: string;
  /** `id` of the listing of the trade, a listing of the same seller. */
  anuncio: string;
  /** The buyer's handle. */
  comprador: string;
};

/**
 * A seller of the phase A registry (9.4, 9.8). The rating is never stored: `sellerRating`
 * computes it from `resenas`.
 */
export type Vendedor = {
  /** The handle (9.9): 3 to 24 of `[a-z0-9_-]`; the `[handle]` of `/{l}/comercio/vendedor/[handle]/`. */
  id: string;
  /** The name shown, 1 to 32 characters. */
  nombre: string;
  /** Since when the seller has an account, ISO 8601 instant; `null` while unknown. */
  desde: string | null;
  canales: Canal[];
  resenas: Resena[];
  /** Every record of the phase A registry carries it (9.4). */
  borrador?: true;
};

// ------------------------------------------------------------------------------ rules

/** A moment for the rules below: a `Date` or epoch milliseconds, so tests inject the clock (14). */
export type Instant = Date | number;

function epoch(value: Instant): number {
  return typeof value === 'number' ? value : value.getTime();
}

/**
 * The state a visitor sees at `now` (9.4, 9.7.8): a `publicado` or `reservado` listing whose
 * `expira` is past is `expirado`, with no scheduled task. So is one whose `expira` cannot be read,
 * which is never listed. Any other state is the stored one.
 */
export function visibleStatus(
  anuncio: Pick<Anuncio, 'estado' | 'expira'>,
  now: Instant,
): EstadoAnuncio {
  if (anuncio.estado !== 'publicado' && anuncio.estado !== 'reservado') return anuncio.estado;
  const expira = Date.parse(anuncio.expira);
  return !Number.isNaN(expira) && expira > epoch(now) ? anuncio.estado : 'expirado';
}

/**
 * Whether the list (9.5) and a seller's profile (9.8) show a listing at `now`: only `publicado`
 * and `reservado` listings whose `expira` is still ahead (9.4).
 */
export function isListed(anuncio: Pick<Anuncio, 'estado' | 'expira'>, now: Instant): boolean {
  const status = visibleStatus(anuncio, now);
  return status === 'publicado' || status === 'reservado';
}

/** Whether a listing has a public detail (9.6): every state but `retirado`, a 404 to the public. */
export function hasPublicDetail(anuncio: Pick<Anuncio, 'estado'>): boolean {
  return anuncio.estado !== 'retirado';
}

/** A seller's standing (9.8, 9.10), computed from the reviews. */
export interface SellerRating {
  /**
   * The mean of the reviews rounded half up to one decimal; `null` without reviews, because a
   * score with no trade behind it is not shown (DS:Rating).
   */
  valoracion: number | null;
  /** Number of reviews. */
  resenas: number;
  /** Reviews per score, index 0 to 5: the table «Reseñas por puntuación» of the profile (9.8). */
  distribucion: [number, number, number, number, number, number];
  /**
   * «Operaciones confirmadas». The phase A registry records only the trades that carry a review,
   * and every review belongs to one confirmed trade (9.10), so it is the number of reviews. Phase B
   * reads `confirmed_transactions` of `trade_seller_stats` (9.8, 9.12.3).
   */
  operaciones: number;
}

/**
 * The rating of a seller from its reviews (9.10). The rounding works on the integer sum, so a mean
 * of 4.35 is 4.4 and never 4.3 through a binary fraction. A score outside 0 to 5 does not count.
 */
export function sellerRating(resenas: readonly Pick<Resena, 'puntuacion'>[]): SellerRating {
  const distribucion: SellerRating['distribucion'] = [0, 0, 0, 0, 0, 0];
  let count = 0;
  let sum = 0;
  for (const { puntuacion } of resenas) {
    if (!Number.isInteger(puntuacion) || puntuacion < 0 || puntuacion > 5) continue;
    distribucion[puntuacion] += 1;
    count += 1;
    sum += puntuacion;
  }
  // round(sum / count, 1) half up = floor((10 · sum / count) + 1/2) / 10, on integers only.
  const valoracion = count === 0 ? null : Math.floor((20 * sum + count) / (2 * count)) / 10;
  return { valoracion, resenas: count, distribucion, operaciones: count };
}

/** The labels of the channel types, `trade.channels` of the dictionary: «Teléfono {code}»… */
export type ChannelLabels = Readonly<Record<Exclude<TipoCanal, 'otra'>, string>>;

/**
 * The label of a channel type. Each one is read by its name, so `pnpm i18n:check` sees every key
 * of `trade.channels` used (13.2).
 */
function channelTemplate(tipo: Exclude<TipoCanal, 'otra'>, labels: ChannelLabels): string {
  switch (tipo) {
    case 'correo':
      return labels.correo;
    case 'telefono':
      return labels.telefono;
    case 'discord':
      return labels.discord;
    case 'twitch':
      return labels.twitch;
  }
}

/**
 * The public label of a channel (9.9): «Correo», «Teléfono +55», «Discord», «Twitch», or the
 * platform of an `otra` channel as the seller wrote it.
 */
export function channelLabel(canal: Canal, labels: ChannelLabels): string {
  if (canal.tipo === 'otra') return canal.etiqueta ?? '';
  return channelTemplate(canal.tipo, labels)
    .replace('{code}', canal.etiqueta ?? '')
    .trim();
}
