// The Comercio registry of phase A (spec 9.2, 9.4; D-007, R12, E6): the sample listings and
// sellers of tests/fixtures/comercio/, which exist to try every branch of the pages and are never offers.
//
// Nothing of them may reach a production build (CA-9.1, PZ-08), so this module never imports them:
//
//   - without COMERCIO_DEMO (`1` or `true`) every reader returns an empty list and no file is
//     opened, whatever OCULTAR_BORRADORES says (9.2);
//   - with it, the files are read from disk when a page asks for them, in the dev server of the
//     tests (14.3) or in a demo or visual build. A static `import` or an `import.meta.glob` would
//     put the records in a bundle even when nothing reads them;
//   - the folder comes in as an argument (`projectRoot()` gives the default), because the tracer
//     of @astrojs/vercel follows any path written as a literal next to `process.cwd()` and would
//     copy tests/fixtures/comercio/ into the server function of a build that bundles this module.
//
// The visual build (VISUAL=1, 14.5) sets COMERCIO_DEMO and COMERCIO_FIXTURE, the absolute path of
// tests/visual/fixtures/comercio.json (astro.config.mjs): then the listings are those the
// «Comercio» board draws, `tableros.Comercio` of that file, and the sellers are all of its sellers.
//
// Every file is parsed with the Zod mirror of content/schemas/comercio.schema.json, which reads
// its patterns from that schema and refuses to load when a list of ./types.ts differs from it.
// `pnpm content:check` adds what a schema cannot see: references, price rules, Ditto Memory and
// `"borrador": true` on every record. Pages read tests/fixtures/comercio/ only through this module (3.12).
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import comercioJsonSchema from '@content/schemas/comercio.schema.json';
import { z } from 'zod';

import {
  BOOST_MAX,
  CANTIDAD_MAX,
  ESTADOS_ANUNCIO,
  ESTADOS_PRESENCIA,
  HABILIDADES,
  MEMORY_SLOTS_MAX,
  MONEDAS_JUEGO,
  MONEDAS_REALES,
  NIVEL_ENTRENAMIENTO_MAX,
  STAR_LEVEL_MAX,
  TIPOS_ACTIVO,
  TIPOS_CANAL,
  type Anuncio,
  type Vendedor,
} from './types';

/** The switches as `hideDrafts` reads its own (src/lib/content/registry.ts). */
export type TradeEnv = Record<string, unknown>;

/** The switches from .env files (import.meta.env) or the shell and Vercel (process.env). */
function tradeEnv(): TradeEnv {
  const shell = typeof process === 'undefined' ? undefined : process.env;
  return {
    COMERCIO_DEMO: import.meta.env.COMERCIO_DEMO ?? shell?.COMERCIO_DEMO,
    COMERCIO_PUBLICO: import.meta.env.COMERCIO_PUBLICO ?? shell?.COMERCIO_PUBLICO,
    COMERCIO_FIXTURE: import.meta.env.COMERCIO_FIXTURE ?? shell?.COMERCIO_FIXTURE,
  };
}

function isOn(value: unknown): boolean {
  const text = String(value ?? '').toLowerCase();
  return text === '1' || text === 'true';
}

/**
 * The demo switch (9.2): with COMERCIO_DEMO=1 (or `true`) the readers return the sample registry.
 * The dev server of the tests and the visual build set it; a production build never does.
 */
export function comercioDemo(env: TradeEnv = tradeEnv()): boolean {
  return isOn(env.COMERCIO_DEMO);
}

/** The phase switch (9.2): COMERCIO_PUBLICO=1 (or `true`) turns phase B on. */
export function comercioPublico(env: TradeEnv = tradeEnv()): boolean {
  return isOn(env.COMERCIO_PUBLICO);
}

// ------------------------------------------------------------------------------ Zod mirror

const defs = comercioJsonSchema.$defs;

/** The lists of ./types.ts must be the ones of the JSON Schema, in the same order. */
function sameList(name: string, fromSchema: readonly unknown[], own: readonly string[]): void {
  if (JSON.stringify(fromSchema) !== JSON.stringify(own)) {
    throw new Error(
      `content/schemas/comercio.schema.json: la lista de ${name} es ${JSON.stringify(fromSchema)} ` +
        `y src/lib/trade/types.ts dice ${JSON.stringify(own)}; cambia las dos a la vez.`,
    );
  }
}

sameList('tipo', defs.anuncio.properties.tipo.enum, TIPOS_ACTIVO);
sameList('estado', defs.anuncio.properties.estado.enum, ESTADOS_ANUNCIO);
sameList('moneda', defs.precioReal.properties.moneda.enum, MONEDAS_REALES);
sameList('opcionJuego.tipo', defs.opcionJuego.properties.tipo.enum, MONEDAS_JUEGO);
sameList('habilidad', defs.entrenamiento.properties.habilidad.enum, HABILIDADES);
sameList('canal.tipo', defs.canal.properties.tipo.enum, TIPOS_CANAL);
sameList('presencia', defs.vendedor.properties.presencia.enum, ESTADOS_PRESENCIA);

/** A pattern of the JSON Schema, compiled as `pnpm content:check` compiles it (flag `u`). */
function pattern(source: string): RegExp {
  return new RegExp(source, 'u');
}

const slug = z.string().regex(pattern(defs.slug.pattern));
const handle = z.string().regex(pattern(defs.handle.pattern));
const instante = z.string().regex(pattern(defs.instante.pattern));
const importe = z.string().regex(pattern(defs.importe.pattern));
const porcentaje = z.string().regex(pattern(defs.porcentaje.pattern));
const nombreDeclarado = z.string().regex(pattern(defs.nombreDeclarado.pattern));
const nombreVendedor = z.string().regex(pattern(defs.nombreVendedor.pattern));
const codigoPais = z.string().regex(pattern(defs.codigoPais.pattern));
const plataforma = z.string().regex(pattern(defs.plataforma.pattern));
const comentario = z.string().regex(pattern(defs.comentario.pattern));
const cantidad = z.number().int().min(1).max(CANTIDAD_MAX);
const borrador = z.literal(true).optional();
const schemaRef = z.string().optional();

const opcionJuego = z.strictObject({ tipo: z.enum(MONEDAS_JUEGO), cantidad });

/** «A convenir» leaves both parts empty; otherwise there is real money or an in-game option. */
const precio = z
  .strictObject({
    real: z.strictObject({ moneda: z.enum(MONEDAS_REALES), importe }).nullable(),
    juego: z.array(opcionJuego).max(2),
    aConvenir: z.boolean(),
  })
  .superRefine((value, context) => {
    const issue = (message: string, path: string) =>
      context.addIssue({ code: 'custom', message, path: [path] });
    if (value.aConvenir) {
      if (value.real !== null) issue('Un precio «A convenir» no lleva dinero real.', 'real');
      if (value.juego.length > 0) issue('Un precio «A convenir» no lleva opciones.', 'juego');
    } else if (value.real === null && value.juego.length === 0) {
      issue('Sin «A convenir», el precio lleva dinero real o una opción en el juego.', 'juego');
    }
  });

/** A list of registry ids without repeats. */
const idSet = z
  .array(slug)
  .max(32)
  .refine((ids) => new Set(ids).size === ids.length, 'ids repetidos');

const unidadPokemon = z.strictObject({
  pokemon: slug,
  ball: slug.nullable(),
  auras: idSet,
  addons: idSet,
  heldX: slug.nullable(),
  heldY: slug.nullable(),
  mega: slug.nullable(),
  boost: z.number().int().min(0).max(BOOST_MAX).nullable(),
  starLevel: z.number().int().min(0).max(STAR_LEVEL_MAX).nullable(),
  nickname: nombreDeclarado.nullable(),
  memorySlots: z.number().int().min(1).max(MEMORY_SLOTS_MAX).nullable(),
  memorias: z.array(slug.nullable()).max(MEMORY_SLOTS_MAX),
  nextBoostChance: porcentaje.nullable(),
  entrenamiento: z
    .array(
      z.strictObject({
        habilidad: z.enum(HABILIDADES),
        nivel: z.number().int().min(0).max(NIVEL_ENTRENAMIENTO_MAX).nullable(),
        progreso: porcentaje.nullable(),
      }),
    )
    .max(HABILIDADES.length),
  precioNpc: z
    .discriminatedUnion('tipo', [
      z.strictObject({ tipo: z.literal('unsellable') }),
      z.strictObject({ tipo: z.literal('pokedolares'), cantidad }),
    ])
    .nullable(),
});

const anuncioBase = {
  id: slug,
  vendedor: handle,
  mundo: slug,
  publicado: instante,
  expira: instante,
  estado: z.enum(ESTADOS_ANUNCIO),
  precio,
  borrador,
};

/** A listing (9.4): `pokemon`, `item` or `cantidad`, as its type asks, and nothing else. */
export const anuncioSchema: z.ZodType<Anuncio> = z.discriminatedUnion('tipo', [
  z.strictObject({ ...anuncioBase, tipo: z.literal('pokemon'), pokemon: unidadPokemon }),
  z.strictObject({
    ...anuncioBase,
    tipo: z.literal('items'),
    item: z.strictObject({ item: slug, cantidad }),
  }),
  z.strictObject({ ...anuncioBase, tipo: z.literal('diamonds'), cantidad }),
  z.strictObject({ ...anuncioBase, tipo: z.literal('pokedolares'), cantidad }),
]);

/** A channel shows its label only (9.9): the country code of a phone, the name of a platform. */
const canal = z.discriminatedUnion('tipo', [
  z.strictObject({ tipo: z.literal('telefono'), etiqueta: codigoPais }),
  z.strictObject({ tipo: z.literal('otra'), etiqueta: plataforma }),
  z.strictObject({ tipo: z.enum(['correo', 'discord', 'twitch', 'google']), etiqueta: z.null() }),
]);

const resena = z.strictObject({
  puntuacion: z
    .number()
    .int()
    .min(defs.resena.properties.puntuacion.minimum)
    .max(defs.resena.properties.puntuacion.maximum),
  comentario: comentario.nullable(),
  fecha: instante,
  anuncio: slug,
  comprador: handle,
});

/** A seller (9.4, 9.8). */
export const vendedorSchema: z.ZodType<Vendedor> = z.strictObject({
  id: handle,
  nombre: nombreVendedor,
  desde: instante.nullable(),
  presencia: z.enum(ESTADOS_PRESENCIA),
  canales: z.array(canal),
  resenas: z.array(resena),
  borrador,
});

/** tests/fixtures/comercio/anuncios.json. */
export const anunciosFileSchema = z.strictObject({
  $schema: schemaRef,
  anuncios: z.array(anuncioSchema),
});

/** tests/fixtures/comercio/vendedores.json. */
export const vendedoresFileSchema = z.strictObject({
  $schema: schemaRef,
  vendedores: z.array(vendedorSchema),
});

/** Either file: what content/schemas/comercio.schema.json accepts. */
export const comercioFileSchema = z.union([anunciosFileSchema, vendedoresFileSchema]);

/** The fixture of the visual build: the board's records and the listings each board draws. */
const fixtureFileSchema = z.looseObject({
  anuncios: z.array(z.unknown()),
  vendedores: z.array(z.unknown()),
  tableros: z.looseObject({ Comercio: z.array(z.string()).optional() }).optional(),
});

// ------------------------------------------------------------------------------ reading

/** The listings and sellers of the phase A registry. */
export interface TradeRegistry {
  anuncios: Anuncio[];
  vendedores: Vendedor[];
}

/** Reads one JSON file; tests pass their own. */
export type ReadJson = (file: string) => unknown;

/** The code unit of the byte order mark some editors write first, which JSON.parse refuses. */
const BYTE_ORDER_MARK = 0xfeff;

function readJsonFile(file: string): unknown {
  const text = readFileSync(file, 'utf8');
  return JSON.parse(text.charCodeAt(0) === BYTE_ORDER_MARK ? text.slice(1) : text);
}

/** The folder the build and the dev server run in: the repository, where content/ lives. */
function projectRoot(): string {
  return process.cwd();
}

/** The two files of tests/fixtures/comercio/ under `root`. */
function demoFiles(root: string): { anuncios: string; vendedores: string } {
  const folder = join(root, 'tests', 'fixtures', 'comercio');
  return { anuncios: join(folder, 'anuncios.json'), vendedores: join(folder, 'vendedores.json') };
}

function parse<T>(schema: z.ZodType<T>, value: unknown, where: string): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new Error(`${where} no es válido:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

/** Reads a file, naming it when it is missing or is not JSON. */
function load(read: ReadJson, file: string): unknown {
  try {
    return read(file);
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    throw new Error(`COMERCIO_DEMO lee ${file}, que no se pudo leer: ${reason}`, { cause });
  }
}

/** Two records with one id would make a detail or a profile ambiguous. */
function unique(ids: readonly string[], where: string): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) throw new Error(`${where}: el id "${id}" está repetido.`);
    seen.add(id);
  }
}

/** The `id` of a record of the fixture before it is parsed, or `undefined`. */
function idOf(value: unknown): unknown {
  return typeof value === 'object' && value !== null ? (value as { id?: unknown }).id : undefined;
}

/**
 * The fixture of the visual build: the listings the «Comercio» board draws, `tableros.Comercio`
 * in its order, or every listing of the file without that list. The listings of the other boards
 * stay out unparsed: the Tarjetas board draws things a listing cannot hold (three held items).
 */
function fromFixture(read: ReadJson, file: string): TradeRegistry {
  const fixture = parse(fixtureFileSchema, load(read, file), file);
  const drawn = fixture.tableros?.Comercio;
  const picked =
    drawn === undefined
      ? fixture.anuncios.map((value, index) => ({ value, index }))
      : drawn.map((id) => {
          const index = fixture.anuncios.findIndex((value) => idOf(value) === id);
          if (index === -1) {
            throw new Error(`${file}: tableros.Comercio nombra "${id}", que no está en anuncios.`);
          }
          return { value: fixture.anuncios[index], index };
        });
  const anuncios = picked.map(({ value, index }) =>
    parse(anuncioSchema, value, `${file} · anuncios[${index}]`),
  );
  const vendedores = fixture.vendedores.map((value, index) =>
    parse(vendedorSchema, value, `${file} · vendedores[${index}]`),
  );
  return { anuncios, vendedores };
}

function fromContent(read: ReadJson, root: string): TradeRegistry {
  const files = demoFiles(root);
  return {
    anuncios: parse(anunciosFileSchema, load(read, files.anuncios), files.anuncios).anuncios,
    vendedores: parse(vendedoresFileSchema, load(read, files.vendedores), files.vendedores)
      .vendedores,
  };
}

/** The files a registry reads with these switches, or none without COMERCIO_DEMO. */
function sourcesOf(env: TradeEnv, root: string): string[] {
  if (!comercioDemo(env)) return [];
  const fixture = String(env.COMERCIO_FIXTURE ?? '');
  if (fixture !== '') return [fixture];
  const files = demoFiles(root);
  return [files.anuncios, files.vendedores];
}

/**
 * The phase A registry for these switches: empty without COMERCIO_DEMO, without reading anything;
 * with it, the fixture of COMERCIO_FIXTURE or the two files of tests/fixtures/comercio/ under `root`.
 * Throws when a file is missing or does not follow content/schemas/comercio.schema.json.
 */
export function readTradeRegistry(
  env: TradeEnv,
  root: string = projectRoot(),
  read: ReadJson = readJsonFile,
): TradeRegistry {
  if (!comercioDemo(env)) return { anuncios: [], vendedores: [] };
  const fixture = String(env.COMERCIO_FIXTURE ?? '');
  const registry = fixture !== '' ? fromFixture(read, fixture) : fromContent(read, root);
  const files = fixture !== '' ? { anuncios: fixture, vendedores: fixture } : demoFiles(root);
  unique(
    registry.anuncios.map((anuncio) => anuncio.id),
    files.anuncios,
  );
  unique(
    registry.vendedores.map((vendedor) => vendedor.id),
    files.vendedores,
  );
  return registry;
}

let cached: { key: string; registry: TradeRegistry } | undefined;

/** The last modification of each source, so the dev server picks up an edit of the files. */
function versionOf(files: readonly string[]): string {
  return files
    .map((file) => {
      try {
        return `${file}@${statSync(file).mtimeMs}`;
      } catch {
        return `${file}@-`;
      }
    })
    .join('|');
}

/** The registry of this process, read again only when a source file changes. */
function current(): TradeRegistry {
  const env = tradeEnv();
  const root = projectRoot();
  const sources = sourcesOf(env, root);
  if (sources.length === 0) return { anuncios: [], vendedores: [] };
  const key = versionOf(sources);
  if (cached?.key !== key) cached = { key, registry: readTradeRegistry(env, root) };
  return cached.registry;
}

/**
 * Every listing of the registry, in every state and in the order of its file: the list keeps the
 * public ones (`isListed`), the detail every one with `hasPublicDetail` (./types.ts). Empty
 * without COMERCIO_DEMO.
 */
export function getAnuncios(): Anuncio[] {
  return current().anuncios.slice();
}

/** The listing with this `id`, or `undefined` (always without COMERCIO_DEMO). */
export function getAnuncio(id: string): Anuncio | undefined {
  return current().anuncios.find((anuncio) => anuncio.id === id);
}

/** Every seller of the registry, in the order of its file. Empty without COMERCIO_DEMO. */
export function getVendedores(): Vendedor[] {
  return current().vendedores.slice();
}

/** The seller with this handle, or `undefined` (always without COMERCIO_DEMO). */
export function getVendedor(handle: string): Vendedor | undefined {
  return current().vendedores.find((vendedor) => vendedor.id === handle);
}
