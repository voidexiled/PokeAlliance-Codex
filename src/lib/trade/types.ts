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

/** Highest Boost (9.7.2, `docs/CONTENT_PLAN.md:207`). */
export const BOOST_MAX = 50;
/** Highest Star Level (9.7.2, `docs/CONTENT_PLAN.md:540`). */
export const STAR_LEVEL_MAX = 5;
/** Memory Slots of a Ditto or a Shiny Ditto: 1 to 6 (9.7.2). */
export const MEMORY_SLOTS_MAX = 6;
/** Highest training level: up to 6 digits (9.7.2). */
export const NIVEL_ENTRENAMIENTO_MAX = 999_999;
/** Longest nickname, in characters (9.7.2). */
export const NOMBRE_MAX = 40;
/** Largest amount of anything a listing counts: 15 digits (9.4), under `Number.MAX_SAFE_INTEGER`. */
export const CANTIDAD_MAX = 999_999_999_999_999;

/** A traded item (16.2.5): the registry id and the amount, never a declared name. */
export type ItemAnunciado = { item: string; cantidad: number };
/** @deprecated The name of 9.4; the shape is `ItemAnunciado` since 16.2.5. */
export type ItemDeclarado = ItemAnunciado;

/** One declared training skill: its level and its progress to the next one («0» to «100»). */
export type EntrenamientoDeclarado = {
  habilidad: Habilidad;
  nivel: number | null;
  progreso: string | null;
};

/** NPC Price as the seller declares it: «Unsellable» or an amount of Pokédólares (9.7.2). */
export type PrecioNpc = { tipo: 'unsellable' } | { tipo: 'pokedolares'; cantidad: number };

/**
 * The Pokémon a listing sells (16.2.5). Every piece of equipment is a registry id, chosen in a
 * picker: the catalogue values (Requisito, Tier, Elementos, the tier of a held) are read from
 * content/ when shown, never stored. `null` is «not declared».
 */
export type UnidadPokemon = {
  /** `id` of content/pokemon.json. */
  pokemon: string;
  /** `id` of an item of the category `poke-balls`. */
  ball: string | null;
  /** `id`s of content/auras.json, without repeats. */
  auras: string[];
  /** `id`s of the addons of this Pokémon in content/outfits.json, without repeats. */
  addons: string[];
  /** `id` of an item whose `held.ranura` is `x`. */
  heldX: string | null;
  /** `id` of an item whose `held.ranura` is `y`. */
  heldY: string | null;
  /** `id` of an item with `mega`. */
  mega: string | null;
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
  /** «0» to «100», at most 2 decimals. */
  nextBoostChance: string | null;
  /** At most one entry per skill. */
  entrenamiento: EntrenamientoDeclarado[];
  precioNpc: PrecioNpc | null;
};

/** The equipment of a unit in the order of the game (16.4.5): ball, auras, addons, X, Y, Mega. */
export type Equipo = { kind: 'ball' | 'aura' | 'addon' | 'heldX' | 'heldY' | 'mega'; id: string };

export function equipmentOf(
  unit: Pick<UnidadPokemon, 'ball' | 'auras' | 'addons' | 'heldX' | 'heldY' | 'mega'>,
): Equipo[] {
  const list: Equipo[] = [];
  if (unit.ball) list.push({ kind: 'ball', id: unit.ball });
  for (const id of unit.auras) list.push({ kind: 'aura', id });
  for (const id of unit.addons) list.push({ kind: 'addon', id });
  if (unit.heldX) list.push({ kind: 'heldX', id: unit.heldX });
  if (unit.heldY) list.push({ kind: 'heldY', id: unit.heldY });
  if (unit.mega) list.push({ kind: 'mega', id: unit.mega });
  return list;
}

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
  item?: ItemAnunciado;
  cantidad?: number;
  /** Every record of the phase A registry carries it (9.4). */
  borrador?: true;
};

/**
 * Contact channel types (9.9), with the keys of the registry in Spanish (R7). Phase B keeps them in
 * `trade_contact_channels.kind` as `email`, `phone`, `discord`, `twitch` and `other`.
 */
export const TIPOS_CANAL = ['correo', 'telefono', 'discord', 'twitch', 'google', 'otra'] as const;
export type TipoCanal = (typeof TIPOS_CANAL)[number];

/**
 * A verified contact channel as the public sees it (9.9): only its label, never the address, the
 * number or the user behind it (R13). `etiqueta` holds the part of the label the dictionary cannot
 * write: the country calling code of a phone («+55») and the name of another platform; it is
 * `null` for `correo`, `discord`, `twitch` and `google` (Google counts as a channel once its owner
 * shows it, 9.15.1).
 */
export type Canal = { tipo: TipoCanal; etiqueta: string | null };

/**
 * The online status of an account (9.15.6), in the order of the `ToggleGroup` that chooses it:
 * «En el juego», «Ausente», «Desconectado». Phase B reads what others see from
 * `trade_effective_presence`; the sellers of the phase A registry carry a fixed one.
 */
export const ESTADOS_PRESENCIA = ['en_juego', 'ausente', 'desconectado'] as const;
export type EstadoPresencia = (typeof ESTADOS_PRESENCIA)[number];

/**
 * A review of one confirmed trade (9.15.4): 1 to 5 stars, an optional comment of up to 1000
 * characters. It replaced the 0 to 5 of 9.10.
 */
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
  /** The fixed online status of a sample seller (9.15.6). */
  presencia: EstadoPresencia;
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
 * A seller's reputation (9.15.4): the standing of `SellerRating`, whose `valoracion` is here the
 * «media», and the counterparts behind it.
 */
export interface SellerReputation extends SellerRating {
  /** Distinct buyers with at least one counted review: «5 compradores distintos». */
  contrapartes: number;
}

function greatestDivisor(a: bigint, b: bigint): bigint {
  let [x, y] = [a, b];
  while (y !== 0n) [x, y] = [y, x % y];
  return x;
}

/**
 * The reputation of a seller from its reviews (9.15.4). The «media» is the mean of the means of
 * each buyer, so a buyer counts once however many reviews it wrote, rounded half up to one decimal.
 * It is computed as one exact fraction (the means of the buyers share the least common multiple of
 * their counts as denominator), so a mean of 4.35 is 4.4 and never 4.3 through a binary fraction,
 * as `round(…, 1)` gives it in SQL. A score outside 0 to 5 does not count: the registry and the
 * database only hold 1 to 5, and `sellerRating` still reads the 0 of 9.10. «Operaciones» is the
 * number of counted reviews: the registry records only the trades that carry one (D-024); phase B
 * reads the confirmed trades of `trade_seller_stats`.
 */
export function sellerReputation(
  resenas: readonly Pick<Resena, 'puntuacion' | 'comprador'>[],
): SellerReputation {
  const distribucion: SellerRating['distribucion'] = [0, 0, 0, 0, 0, 0];
  const buyers = new Map<string, { sum: bigint; count: bigint }>();
  let count = 0;
  for (const { puntuacion, comprador } of resenas) {
    if (!Number.isInteger(puntuacion) || puntuacion < 0 || puntuacion > 5) continue;
    distribucion[puntuacion] += 1;
    count += 1;
    const buyer = buyers.get(comprador) ?? { sum: 0n, count: 0n };
    buyer.sum += BigInt(puntuacion);
    buyer.count += 1n;
    buyers.set(comprador, buyer);
  }
  let valoracion: number | null = null;
  if (buyers.size > 0) {
    // mean = Σ (sum_b / count_b) / B = numerator / denominator, with the counts' common multiple.
    let multiple = 1n;
    for (const { count: n } of buyers.values())
      multiple = (multiple / greatestDivisor(multiple, n)) * n;
    let numerator = 0n;
    for (const { sum, count: n } of buyers.values()) numerator += sum * (multiple / n);
    const denominator = multiple * BigInt(buyers.size);
    // round(mean, 1) half up = floor(10 · mean + 1/2) / 10 = floor((20·num + den) / (2·den)) / 10.
    valoracion = Number((20n * numerator + denominator) / (2n * denominator)) / 10;
  }
  return {
    valoracion,
    resenas: count,
    distribucion,
    operaciones: count,
    contrapartes: buyers.size,
  };
}

/**
 * The rating of a seller from its reviews (9.10), every review its own buyer: the mean of the
 * scores, rounded half up to one decimal. A score outside 0 to 5 does not count.
 */
export function sellerRating(resenas: readonly Pick<Resena, 'puntuacion'>[]): SellerRating {
  const {
    valoracion,
    resenas: count,
    distribucion,
    operaciones,
  } = sellerReputation(
    resenas.map(({ puntuacion }, index) => ({ puntuacion, comprador: String(index) })),
  );
  return { valoracion, resenas: count, distribucion, operaciones };
}

/**
 * The list order of 9.15.6 over another one: the sellers «En el juego» first, then everyone else,
 * each part in the order of `compare`. A listing whose seller has no status is not in the game.
 */
export function inGameFirst<T>(
  presenceOf: (item: T) => EstadoPresencia | null | undefined,
  compare: (a: T, b: T) => number,
): (a: T, b: T) => number {
  const rank = (item: T) => (presenceOf(item) === 'en_juego' ? 0 : 1);
  return (a, b) => rank(a) - rank(b) || compare(a, b);
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
    case 'google':
      return labels.google;
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
