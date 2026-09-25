// The Comercio registry of phase A (spec 9.2, 9.4; D-007, R12, CA-9.1): the sample listings and
// sellers of tests/fixtures/comercio/ are read only with COMERCIO_DEMO, so a production build, which never
// sets it, has none of them. Also here: the JSON Schema content/schemas/comercio.schema.json and its
// Zod mirror, the lists of src/lib/trade/types.ts against that schema, the rules of the model, the
// fixture of the visual build (14.5), what `pnpm content:check` adds for tests/fixtures/comercio/, the
// minimum content of 9.4, the `trade` namespace against the model, and the `moneda` object of
// content/items/diamantes.json (3.13).
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';

import { en } from '@/i18n/messages/en';
import { es } from '@/i18n/messages/es';
import { listingKeys } from '@/lib/cards/layout';
import { itemsFileSchema, monedaSchema } from '@/lib/content/registry-schema';
import { formatRealMoney } from '@/lib/format/numbers';
import {
  anuncioSchema,
  anunciosFileSchema,
  comercioDemo,
  comercioFileSchema,
  comercioPublico,
  getAnuncio,
  getAnuncios,
  getVendedor,
  getVendedores,
  readTradeRegistry,
  vendedorSchema,
  vendedoresFileSchema,
  type ReadJson,
} from '@/lib/trade/registry';
import {
  BOOST_MAX,
  CANTIDAD_MAX,
  ESTADOS_ANUNCIO,
  HABILIDADES,
  MEMORY_SLOTS_MAX,
  MONEDAS_JUEGO,
  MONEDAS_REALES,
  NIVEL_ENTRENAMIENTO_MAX,
  SIMBOLOS_MONEDA,
  STAR_LEVEL_MAX,
  TIPOS_ACTIVO,
  TIPOS_CANAL,
  channelLabel,
  hasPublicDetail,
  isListed,
  sellerRating,
  visibleStatus,
  type Anuncio,
  type Vendedor,
} from '@/lib/trade/types';
import { checkContent } from '../../scripts/content/lib/check-content.mjs';
import { validateSchema } from '../../scripts/content/lib/json-schema.mjs';
import { copyPublicForCheck } from '../content/public-copy';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const readJson = (file: string) => JSON.parse(readFileSync(path.join(repoRoot, file), 'utf8'));
const schema = readJson('content/schemas/comercio.schema.json');
const anunciosDoc: { $schema: string; anuncios: Anuncio[] } = readJson(
  'tests/fixtures/comercio/anuncios.json',
);
const vendedoresDoc: { $schema: string; vendedores: Vendedor[] } = readJson(
  'tests/fixtures/comercio/vendedores.json',
);
const { anuncios } = anunciosDoc;
const { vendedores } = vendedoresDoc;

/** The clock of the e2e specs with dates (14.3): 14:32 in Brasília on 2026-09-18. */
const TEST_CLOCK = Date.parse('2026-09-18T17:32:00Z');

/** The hard space `formatRealMoney` writes between a currency symbol and its figure. */
const NO_BREAK = String.fromCharCode(0xa0);

const scratch = mkdtempSync(path.join(tmpdir(), 'comercio-registry-'));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

/** A new empty folder under the scratch one. */
function folder(): string {
  const dir = path.join(scratch, `dir-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Writes tests/fixtures/comercio/ under a new folder and returns that folder, the `root` of the reader. */
function demoRoot(anunciosData: unknown, vendedoresData: unknown): string {
  const root = folder();
  const dir = path.join(root, 'tests', 'fixtures', 'comercio');
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'anuncios.json'), JSON.stringify(anunciosData));
  writeFileSync(path.join(dir, 'vendedores.json'), JSON.stringify(vendedoresData));
  return root;
}

type Key = string | number;

/** A copy of `document` with `value` at `at`; `undefined` removes the key. */
function withValue(document: unknown, at: readonly Key[], value: unknown): unknown {
  const copy = structuredClone(document);
  let node = copy as Record<Key, unknown>;
  for (const key of at.slice(0, -1)) node = node[key] as Record<Key, unknown>;
  const last = at[at.length - 1];
  if (value === undefined) delete node[last];
  else node[last] = value;
  return copy;
}

const indexWhere = (test: (anuncio: Anuncio) => boolean) => {
  const index = anuncios.findIndex(test);
  if (index === -1) throw new Error('The demo registry lacks a listing this test needs.');
  return index;
};
const POKEMON = indexWhere((anuncio) => anuncio.tipo === 'pokemon');
const DITTO = indexWhere((anuncio) => anuncio.pokemon?.memorySlots != null);
const ITEMS = indexWhere((anuncio) => anuncio.tipo === 'items');
const DIAMONDS = indexWhere((anuncio) => anuncio.tipo === 'diamonds');
const POKEDOLARES = indexWhere((anuncio) => anuncio.tipo === 'pokedolares');

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('the switches of 9.2', () => {
  it('read `1` and `true`, in any case, and nothing else', () => {
    for (const value of ['1', 'true', 'TRUE', 'True', 1]) {
      expect(comercioDemo({ COMERCIO_DEMO: value }), String(value)).toBe(true);
      expect(comercioPublico({ COMERCIO_PUBLICO: value }), String(value)).toBe(true);
    }
    for (const value of [undefined, null, '', '0', 'false', 'yes', 'on', 0]) {
      expect(comercioDemo({ COMERCIO_DEMO: value }), String(value)).toBe(false);
      expect(comercioPublico({ COMERCIO_PUBLICO: value }), String(value)).toBe(false);
    }
  });

  it('are two switches: the phase never turns the demo on', () => {
    expect(comercioDemo({ COMERCIO_PUBLICO: '1' })).toBe(false);
    expect(comercioPublico({ COMERCIO_DEMO: '1' })).toBe(false);
  });
});

describe('without COMERCIO_DEMO the registry is empty (CA-9.1)', () => {
  const productionLike = [
    {},
    { COMERCIO_DEMO: '0' },
    { COMERCIO_DEMO: 'false' },
    { COMERCIO_PUBLICO: '1' },
    { OCULTAR_BORRADORES: '1' },
    { OCULTAR_BORRADORES: '0' },
    { COMERCIO_FIXTURE: path.join(repoRoot, 'tests', 'visual', 'fixtures', 'comercio.json') },
  ];

  it('returns no listing and no seller, and opens no file', () => {
    for (const env of productionLike) {
      const read = vi.fn<ReadJson>();
      expect(readTradeRegistry(env, repoRoot, read), JSON.stringify(env)).toEqual({
        anuncios: [],
        vendedores: [],
      });
      // A folder that does not exist cannot fail a registry that reads nothing.
      expect(readTradeRegistry(env, path.join(scratch, 'no-such-folder'), read)).toEqual({
        anuncios: [],
        vendedores: [],
      });
      expect(read).not.toHaveBeenCalled();
    }
  });

  it('gives the pages nothing through the readers', () => {
    vi.stubEnv('COMERCIO_DEMO', '');
    vi.stubEnv('COMERCIO_FIXTURE', '');
    vi.stubEnv('OCULTAR_BORRADORES', '0');
    expect(getAnuncios()).toEqual([]);
    expect(getVendedores()).toEqual([]);
    for (const anuncio of anuncios) expect(getAnuncio(anuncio.id)).toBeUndefined();
    for (const vendedor of vendedores) expect(getVendedor(vendedor.id)).toBeUndefined();
  });

  it('never imports tests/fixtures/comercio/: a build would bundle it even unread', () => {
    const source = readFileSync(path.join(repoRoot, 'src', 'lib', 'trade', 'registry.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    const imports = [...source.matchAll(/^import\s[^;]*?from\s+'([^']+)'/gms)].map(
      (match) => match[1],
    );
    expect(imports.filter((specifier) => specifier.endsWith('.json'))).toEqual([
      '@content/schemas/comercio.schema.json',
    ]);
    expect(source).not.toMatch(/import\.meta\.glob|import\(\s*['"`]|\?raw|\?url/);
    expect(source).not.toMatch(/['"`][^'"`]*content\/comercio/);
  });
});

describe('with COMERCIO_DEMO', () => {
  it('reads the two files of tests/fixtures/comercio/', () => {
    const registry = readTradeRegistry({ COMERCIO_DEMO: '1' }, repoRoot);
    expect(registry.anuncios).toEqual(anuncios);
    expect(registry.vendedores).toEqual(vendedores);
  });

  it('serves them to the pages through the readers, as copies', () => {
    vi.stubEnv('COMERCIO_DEMO', '1');
    vi.stubEnv('COMERCIO_FIXTURE', '');
    const first = getAnuncios();
    expect(first).toEqual(anuncios);
    expect(getVendedores()).toEqual(vendedores);
    expect(getAnuncio(anuncios[ITEMS].id)).toEqual(anuncios[ITEMS]);
    expect(getVendedor(vendedores[0].id)).toEqual(vendedores[0]);
    expect(getAnuncio('no-such-listing')).toBeUndefined();
    expect(getVendedor('no-such-seller')).toBeUndefined();
    first.pop();
    expect(getAnuncios()).toHaveLength(anuncios.length);
  });

  it('keeps them whatever OCULTAR_BORRADORES says (9.2)', () => {
    const registry = readTradeRegistry({ COMERCIO_DEMO: '1', OCULTAR_BORRADORES: '1' }, repoRoot);
    expect(registry.anuncios).toHaveLength(anuncios.length);
  });

  it('names the file that is missing, broken or out of its schema', () => {
    expect(() => readTradeRegistry({ COMERCIO_DEMO: '1' }, folder())).toThrow(/anuncios\.json/);

    const broken = demoRoot(anunciosDoc, vendedoresDoc);
    writeFileSync(
      path.join(broken, 'tests', 'fixtures', 'comercio', 'vendedores.json'),
      '{ "vendedores": ',
    );
    expect(() => readTradeRegistry({ COMERCIO_DEMO: '1' }, broken)).toThrow(/vendedores\.json/);

    const invalid = demoRoot(
      withValue(anunciosDoc, ['anuncios', POKEMON, 'pokemon', 'boost'], BOOST_MAX + 1),
      vendedoresDoc,
    );
    expect(() => readTradeRegistry({ COMERCIO_DEMO: '1' }, invalid)).toThrow(
      /anuncios\.json no es válido/,
    );
  });

  it('refuses two records with one id', () => {
    const twice = demoRoot(
      { anuncios: [...anuncios, anuncios[ITEMS]] },
      { vendedores: [...vendedores, vendedores[0]] },
    );
    expect(() => readTradeRegistry({ COMERCIO_DEMO: '1' }, twice)).toThrow(/está repetido/);
  });
});

describe('the fixture of the visual build (14.5)', () => {
  const pokemonListing = anuncios[POKEMON];
  const itemsListing = anuncios[ITEMS];
  /** A listing the board draws and no listing may hold: the held items of M14. */
  const unholdable = withValue(
    { ...pokemonListing, id: 'tablero-otro' },
    ['pokemon', 'helds'],
    [0, 1, 2].map((tier) => ({ item: null, nombre: `Held ${tier + 1}`, tier: tier + 1 })),
  );
  const fixture = {
    anuncios: [pokemonListing, unholdable, itemsListing],
    vendedores,
    tableros: { Comercio: [itemsListing.id, pokemonListing.id], Tarjetas: ['tablero-otro'] },
  };

  function write(data: unknown): string {
    const file = path.join(folder(), 'comercio.json');
    writeFileSync(file, JSON.stringify(data));
    return file;
  }

  it('gives the listings of the Comercio board, in its order, and parses no other', () => {
    const file = write(fixture);
    const registry = readTradeRegistry({ COMERCIO_DEMO: '1', COMERCIO_FIXTURE: file }, folder());
    expect(registry.anuncios.map((anuncio) => anuncio.id)).toEqual([
      itemsListing.id,
      pokemonListing.id,
    ]);
    expect(registry.vendedores).toEqual(vendedores);
  });

  it('is read through the readers when the visual build sets both variables', () => {
    const file = write(fixture);
    vi.stubEnv('COMERCIO_DEMO', '1');
    vi.stubEnv('COMERCIO_FIXTURE', file);
    expect(getAnuncios().map((anuncio) => anuncio.id)).toEqual([
      itemsListing.id,
      pokemonListing.id,
    ]);
    vi.stubEnv('COMERCIO_DEMO', '');
    expect(getAnuncios()).toEqual([]);
  });

  it('parses every listing without the list of the board, and names what fails', () => {
    const file = write({ ...fixture, tableros: undefined });
    expect(() => readTradeRegistry({ COMERCIO_DEMO: '1', COMERCIO_FIXTURE: file })).toThrow(
      /anuncios\[1\]/,
    );
    const missing = write({ ...fixture, tableros: { Comercio: ['no-such-listing'] } });
    expect(() => readTradeRegistry({ COMERCIO_DEMO: '1', COMERCIO_FIXTURE: missing })).toThrow(
      /no-such-listing/,
    );
  });
});

describe('the model of 9.4 (src/lib/trade/types.ts)', () => {
  const defs = schema.$defs;

  it('has the lists and limits of the JSON Schema', () => {
    expect(defs.anuncio.properties.tipo.enum).toEqual([...TIPOS_ACTIVO]);
    expect(defs.anuncio.properties.estado.enum).toEqual([...ESTADOS_ANUNCIO]);
    expect(defs.precioReal.properties.moneda.enum).toEqual([...MONEDAS_REALES]);
    expect(defs.opcionJuego.properties.tipo.enum).toEqual([...MONEDAS_JUEGO]);
    expect(defs.entrenamiento.properties.habilidad.enum).toEqual([...HABILIDADES]);
    expect(defs.canal.properties.tipo.enum).toEqual([...TIPOS_CANAL]);

    const unit = defs.unidadPokemon.properties;
    expect(unit.boost.maximum).toBe(BOOST_MAX);
    expect(unit.starLevel.maximum).toBe(STAR_LEVEL_MAX);
    expect(unit.memorySlots.maximum).toBe(MEMORY_SLOTS_MAX);
    expect(unit.memorias.maxItems).toBe(MEMORY_SLOTS_MAX);
    expect(unit.auras.maxItems).toBe(32);
    expect(unit.addons.maxItems).toBe(32);
    expect(unit.entrenamiento.maxItems).toBe(HABILIDADES.length);
    expect(Object.keys(defs.itemAnunciado.properties)).toEqual(['item', 'cantidad']);
    expect(defs.entrenamiento.properties.nivel.maximum).toBe(NIVEL_ENTRENAMIENTO_MAX);
    expect(defs.cantidad.maximum).toBe(CANTIDAD_MAX);
    expect(CANTIDAD_MAX).toBeLessThan(Number.MAX_SAFE_INTEGER);
    // Q9 keeps its default until the owner answers.
    expect([...MONEDAS_REALES]).toEqual(['BRL', 'USD', 'MXN']);
  });

  it('shows each currency with the symbol the formatter of 13.3 writes', () => {
    for (const moneda of MONEDAS_REALES) {
      expect(formatRealMoney(90, moneda, 'es')).toBe(`${SIMBOLOS_MONEDA[moneda]}${NO_BREAK}90`);
    }
  });

  it('sees a published or reserved listing past its expira as expired (9.4, 9.7.8)', () => {
    const at = (estado: Anuncio['estado'], expira: string) => ({ estado, expira });
    const future = '2026-09-18T17:32:01Z';
    const past = '2026-09-18T17:32:00Z';
    expect(visibleStatus(at('publicado', future), TEST_CLOCK)).toBe('publicado');
    expect(visibleStatus(at('reservado', future), new Date(TEST_CLOCK))).toBe('reservado');
    expect(visibleStatus(at('publicado', past), TEST_CLOCK)).toBe('expirado');
    expect(visibleStatus(at('reservado', past), TEST_CLOCK)).toBe('expirado');
    expect(visibleStatus(at('publicado', 'no es una fecha'), TEST_CLOCK)).toBe('expirado');
    expect(visibleStatus(at('completado', future), TEST_CLOCK)).toBe('completado');
    expect(visibleStatus(at('retirado', future), TEST_CLOCK)).toBe('retirado');

    expect(isListed(at('publicado', future), TEST_CLOCK)).toBe(true);
    expect(isListed(at('reservado', future), TEST_CLOCK)).toBe(true);
    expect(isListed(at('publicado', past), TEST_CLOCK)).toBe(false);
    for (const estado of ['completado', 'expirado', 'retirado'] as const)
      expect(isListed(at(estado, future), TEST_CLOCK)).toBe(false);

    for (const estado of ESTADOS_ANUNCIO)
      expect(hasPublicDetail({ estado })).toBe(estado !== 'retirado');
  });

  it('rates a seller half up to one decimal, from the integer sum (9.10)', () => {
    const scores = (...values: number[]) => values.map((puntuacion) => ({ puntuacion }));
    expect(sellerRating([])).toEqual({
      valoracion: null,
      resenas: 0,
      distribucion: [0, 0, 0, 0, 0, 0],
      operaciones: 0,
    });
    // 87 / 20 = 4.35 is 4.4, not the 4.3 of Math.round(4.35 * 10) / 10.
    const twenty = sellerRating(scores(...Array(13).fill(4), ...Array(7).fill(5)));
    expect(twenty.valoracion).toBe(4.4);
    expect(twenty.resenas).toBe(20);
    expect(sellerRating(scores(4, 4, 5, 4)).valoracion).toBe(4.3);
    expect(sellerRating(scores(0, 0, 0)).valoracion).toBe(0);
    const mixed = sellerRating(scores(5, 0, 3, 3, 6, -1, 2.5));
    expect(mixed).toEqual({
      valoracion: 2.8,
      resenas: 4,
      distribucion: [1, 0, 0, 2, 0, 1],
      operaciones: 4,
    });
  });

  it('writes the public label of each channel in each language (9.9)', () => {
    const cases: [Parameters<typeof channelLabel>[0], string, string][] = [
      [{ tipo: 'correo', etiqueta: null }, 'Correo', 'Email'],
      [{ tipo: 'telefono', etiqueta: '+55' }, 'Teléfono +55', 'Phone +55'],
      [{ tipo: 'discord', etiqueta: null }, 'Discord', 'Discord'],
      [{ tipo: 'twitch', etiqueta: null }, 'Twitch', 'Twitch'],
      [{ tipo: 'otra', etiqueta: 'Facebook' }, 'Facebook', 'Facebook'],
    ];
    for (const [canal, spanish, english] of cases) {
      expect(channelLabel(canal, es.trade.channels)).toBe(spanish);
      expect(channelLabel(canal, en.trade.channels)).toBe(english);
    }
  });

  it('matches the trade namespace of the dictionaries', () => {
    for (const messages of [es, en]) {
      expect(Object.keys(messages.trade.types)).toEqual(['all', ...TIPOS_ACTIVO]);
      expect(Object.keys(messages.trade.typeNames)).toEqual([...TIPOS_ACTIVO]);
      expect(Object.keys(messages.trade.channels)).toEqual(
        TIPOS_CANAL.filter((tipo) => tipo !== 'otra'),
      );
      for (const estado of Object.keys(messages.trade.states))
        expect(ESTADOS_ANUNCIO as readonly string[]).toContain(estado);
      // `ListingCard` reads one label per fact key of every asset type (DP1).
      expect(Object.keys(messages.trade.listing.keys).sort()).toEqual(
        [...new Set(Object.values(listingKeys).flat())].sort(),
      );
    }
    // «KK», «KKs» and «gold» are not the name of the currency (S8, CA-9.10).
    expect(JSON.stringify(es.trade) + JSON.stringify(en.trade)).not.toMatch(/\bKKs?\b|\bgold\b/);
  });
});

describe('the JSON Schema and its Zod mirror', () => {
  const both = (document: unknown) => ({
    schema: validateSchema(document, schema),
    zod: comercioFileSchema.safeParse(document).success,
  });

  it('both accept the two files, and each file its own mirror', () => {
    expect(both(anunciosDoc)).toEqual({ schema: [], zod: true });
    expect(both(vendedoresDoc)).toEqual({ schema: [], zod: true });
    expect(anunciosFileSchema.safeParse(anunciosDoc).success).toBe(true);
    expect(vendedoresFileSchema.safeParse(vendedoresDoc).success).toBe(true);
    for (const anuncio of anuncios) expect(anuncioSchema.safeParse(anuncio).success).toBe(true);
    for (const vendedor of vendedores)
      expect(vendedorSchema.safeParse(vendedor).success).toBe(true);
  });

  it('both accept the other valid shapes of 9.4', () => {
    const valid: unknown[] = [
      { anuncios: [] },
      { vendedores: [] },
      withValue(anunciosDoc, ['anuncios', POKEMON, 'borrador'], undefined),
      withValue(anunciosDoc, ['anuncios', POKEMON, 'pokemon', 'precioNpc'], {
        tipo: 'pokedolares',
        cantidad: 1,
      }),
      withValue(anunciosDoc, ['anuncios', POKEMON, 'pokemon', 'nickname'], 'A  B'),
      withValue(anunciosDoc, ['anuncios', ITEMS, 'precio'], {
        real: { moneda: 'MXN', importe: '0.05' },
        juego: [],
        aConvenir: false,
      }),
      withValue(anunciosDoc, ['anuncios', DIAMONDS, 'cantidad'], CANTIDAD_MAX),
      withValue(anunciosDoc, ['anuncios', POKEDOLARES, 'publicado'], '2026-09-18T14:32:00-03:00'),
      withValue(vendedoresDoc, ['vendedores', 0, 'desde'], null),
      withValue(
        vendedoresDoc,
        ['vendedores', 0, 'canales'],
        [
          { tipo: 'otra', etiqueta: 'Kick' },
          { tipo: 'telefono', etiqueta: '+1' },
        ],
      ),
      withValue(vendedoresDoc, ['vendedores', 0, 'resenas', 0, 'comentario'], 'Una\nlínea más.'),
    ];
    for (const document of valid)
      expect(both(document), JSON.stringify(document).slice(0, 200)).toEqual({
        schema: [],
        zod: true,
      });
  });

  it('both reject the same broken documents', () => {
    const listing = (index: number, at: readonly Key[], value: unknown) =>
      withValue(anunciosDoc, ['anuncios', index, ...at], value);
    const seller = (at: readonly Key[], value: unknown) =>
      withValue(vendedoresDoc, ['vendedores', 0, ...at], value);
    const broken: [string, unknown][] = [
      ['both lists', { ...anunciosDoc, vendedores: [] }],
      ['no list', { $schema: anunciosDoc.$schema }],
      ['an unknown field', listing(POKEMON, ['intencion'], 'comprar')],
      ['an unknown type', listing(POKEMON, ['tipo'], 'kks')],
      ['an unknown state', listing(POKEMON, ['estado'], 'borrador')],
      ['a draft mark that is not true', listing(POKEMON, ['borrador'], false)],
      ['no price', listing(POKEMON, ['precio'], undefined)],
      ['a Pokémon listing with a quantity', listing(POKEMON, ['cantidad'], 5)],
      ['a Pokémon listing without its Pokémon', listing(POKEMON, ['pokemon'], undefined)],
      ['an items listing without its item', listing(ITEMS, ['item'], undefined)],
      ['a Diamonds listing with an item', listing(DIAMONDS, ['item'], anuncios[ITEMS].item)],
      ['a Pokédólares listing without its amount', listing(POKEDOLARES, ['cantidad'], undefined)],
      ['an amount of 0', listing(DIAMONDS, ['cantidad'], 0)],
      ['an amount of 16 digits', listing(DIAMONDS, ['cantidad'], CANTIDAD_MAX + 1)],
      ['a fractional amount', listing(DIAMONDS, ['cantidad'], 1.5)],
      ['Boost 51', listing(POKEMON, ['pokemon', 'boost'], BOOST_MAX + 1)],
      ['Star Level 6', listing(POKEMON, ['pokemon', 'starLevel'], STAR_LEVEL_MAX + 1)],
      ['Memory Slots 7', listing(DITTO, ['pokemon', 'memorySlots'], MEMORY_SLOTS_MAX + 1)],
      [
        'the declared held items of M14',
        listing(POKEMON, ['pokemon', 'helds'], [{ item: null, nombre: 'X', tier: 1 }]),
      ],
      ['a declared Ball name', listing(POKEMON, ['pokemon', 'ball'], { item: null, nombre: 'X' })],
      ['a held X that is no id', listing(POKEMON, ['pokemon', 'heldX'], 'X Attack')],
      [
        'a declared item name',
        listing(ITEMS, ['item'], { item: 'fire-stone', nombre: 'Fire Stone', cantidad: 1 }),
      ],
      ['a nickname of 41 characters', listing(POKEMON, ['pokemon', 'nickname'], 'x'.repeat(41))],
      ['a nickname with an outer space', listing(POKEMON, ['pokemon', 'nickname'], ' Nube')],
      ['an empty nickname', listing(POKEMON, ['pokemon', 'nickname'], '')],
      [
        'an unknown skill',
        listing(
          POKEMON,
          ['pokemon', 'entrenamiento'],
          [{ habilidad: 'Speed', nivel: 1, progreso: null }],
        ),
      ],
      [
        'a progress over 100',
        listing(
          POKEMON,
          ['pokemon', 'entrenamiento'],
          [{ habilidad: 'HP', nivel: 1, progreso: '100.5' }],
        ),
      ],
      ['a chance with a leading zero', listing(POKEMON, ['pokemon', 'nextBoostChance'], '05')],
      [
        'an Unsellable NPC Price with an amount',
        listing(POKEMON, ['pokemon', 'precioNpc'], { tipo: 'unsellable', cantidad: 5 }),
      ],
      [
        'an NPC Price amount without its amount',
        listing(POKEMON, ['pokemon', 'precioNpc'], { tipo: 'pokedolares' }),
      ],
      ['a real amount of 0', listing(ITEMS, ['precio', 'real'], { moneda: 'BRL', importe: '0' })],
      [
        'a real amount with 3 decimals',
        listing(ITEMS, ['precio', 'real'], { moneda: 'BRL', importe: '1.234' }),
      ],
      [
        'a real amount with a comma',
        listing(ITEMS, ['precio', 'real'], { moneda: 'BRL', importe: '1,5' }),
      ],
      [
        'a real amount of 11 digits',
        listing(ITEMS, ['precio', 'real'], { moneda: 'BRL', importe: '12345678901' }),
      ],
      ['an unknown currency', listing(ITEMS, ['precio', 'real'], { moneda: 'EUR', importe: '10' })],
      ['«A convenir» with real money', listing(POKEMON, ['precio', 'aConvenir'], true)],
      [
        '«A convenir» with an option',
        listing(POKEMON, ['precio'], {
          real: null,
          juego: [{ tipo: 'diamonds', cantidad: 1 }],
          aConvenir: true,
        }),
      ],
      [
        'a price with nothing',
        listing(POKEMON, ['precio'], { real: null, juego: [], aConvenir: false }),
      ],
      [
        'three in-game options',
        listing(
          POKEMON,
          ['precio', 'juego'],
          [1, 2, 3].map((cantidad) => ({ tipo: 'diamonds', cantidad })),
        ),
      ],
      ['a date without its time', listing(POKEMON, ['publicado'], '2026-09-18')],
      ['a date without its zone', listing(POKEMON, ['expira'], '2030-12-31T12:00:00')],
      ['a listing id in capitals', listing(POKEMON, ['id'], 'Ejemplo')],
      ['a short handle', seller(['id'], 'ab')],
      ['a handle in capitals', seller(['id'], 'Ejemplo-Norte')],
      ['a name of 33 characters', seller(['nombre'], 'n'.repeat(33))],
      ['a phone without its code', seller(['canales'], [{ tipo: 'telefono', etiqueta: null }])],
      [
        'a phone written as a label',
        seller(['canales'], [{ tipo: 'telefono', etiqueta: 'Teléfono +55' }]),
      ],
      ['an email with a label', seller(['canales'], [{ tipo: 'correo', etiqueta: 'Correo' }])],
      ['another platform without a name', seller(['canales'], [{ tipo: 'otra', etiqueta: null }])],
      ['an unknown channel', seller(['canales'], [{ tipo: 'whatsapp', etiqueta: null }])],
      ['a score of 6', seller(['resenas', 0, 'puntuacion'], 6)],
      ['an empty comment', seller(['resenas', 0, 'comentario'], ' ')],
      ['a comment of 1001 characters', seller(['resenas', 0, 'comentario'], 'c'.repeat(1001))],
      ['a review without its buyer', seller(['resenas', 0, 'comprador'], undefined)],
    ];
    for (const [name, document] of broken) {
      const result = both(document);
      expect(result.schema.length, `${name}: the JSON Schema accepts it`).toBeGreaterThan(0);
      expect(result.zod, `${name}: the Zod mirror accepts it`).toBe(false);
    }
  });
});

describe('the minimum content of the demo registry (9.4)', () => {
  const listed = anuncios.filter((anuncio) => isListed(anuncio, TEST_CLOCK));
  const pokemon = anuncios.flatMap((anuncio) => (anuncio.pokemon ? [anuncio.pokemon] : []));

  it('covers every branch the pages and the tests take', () => {
    for (const tipo of TIPOS_ACTIVO)
      expect(
        listed.some((anuncio) => anuncio.tipo === tipo),
        `a listed ${tipo} listing`,
      ).toBe(true);
    expect(
      pokemon.some(
        (unit) =>
          unit.pokemon === 'shiny-ditto' &&
          unit.memorySlots !== null &&
          unit.memorias.some((id) => id !== null),
      ),
    ).toBe(true);
    expect(pokemon.some((unit) => unit.heldX !== null && unit.entrenamiento.length > 0)).toBe(true);
    expect(
      anuncios.some((anuncio) => anuncio.precio.real !== null && anuncio.precio.juego.length === 2),
    ).toBe(true);
    expect(listed.some((anuncio) => anuncio.precio.aConvenir)).toBe(true);
    expect(listed.some((anuncio) => anuncio.estado === 'reservado')).toBe(true);
    expect(anuncios.some((anuncio) => anuncio.estado === 'expirado')).toBe(true);
    expect(vendedores.some((vendedor) => vendedor.resenas.length === 0)).toBe(true);
    // CA-9.20: a published listing already past its expira.
    expect(
      anuncios.some(
        (anuncio) =>
          anuncio.estado === 'publicado' && visibleStatus(anuncio, TEST_CLOCK) === 'expirado',
      ),
    ).toBe(true);
    // Every real currency and both game currencies price some listed listing (9.5.4, 9.5.5).
    for (const moneda of MONEDAS_REALES)
      expect(
        listed.some((anuncio) => anuncio.precio.real?.moneda === moneda),
        moneda,
      ).toBe(true);
    for (const tipo of MONEDAS_JUEGO)
      expect(
        listed.some((anuncio) => anuncio.precio.juego.some((opcion) => opcion.tipo === tipo)),
      ).toBe(true);
  });

  it('writes every date before the clock of the e2e specs, and every listed expira after the real one', () => {
    for (const anuncio of anuncios) expect(Date.parse(anuncio.publicado)).toBeLessThan(TEST_CLOCK);
    for (const anuncio of listed) expect(Date.parse(anuncio.expira)).toBeGreaterThan(Date.now());
  });

  it('keeps its ids and names out of everything a production build carries (CA-9.1)', () => {
    // CA-9.1 searches the whole output for these strings: none may be a word of the wiki.
    const needles = [
      ...anuncios.map((anuncio) => anuncio.id),
      ...vendedores.map((vendedor) => vendedor.nombre),
    ];
    const haystacks = [
      JSON.stringify(es),
      JSON.stringify(en),
      readFileSync(path.join(repoRoot, 'content', 'pokemon.json'), 'utf8'),
      readFileSync(path.join(repoRoot, 'content', 'mundos.json'), 'utf8'),
      readFileSync(path.join(repoRoot, 'content', 'outfits.json'), 'utf8'),
      readFileSync(path.join(repoRoot, 'content', 'auras.json'), 'utf8'),
      readFileSync(path.join(repoRoot, 'public', 'sprites', 'sprites.json'), 'utf8'),
    ];
    for (const needle of needles)
      for (const haystack of haystacks) expect(haystack.includes(needle), needle).toBe(false);
    // Fictional sellers: every name says it is a sample.
    for (const vendedor of vendedores) expect(vendedor.nombre).toMatch(/^Ejemplo /);
  });

  it('gives each seller the rating its reviews compute', () => {
    const rated = vendedores
      .map((vendedor) => ({ id: vendedor.id, ...sellerRating(vendedor.resenas) }))
      .filter((entry) => entry.valoracion !== null);
    // «Mejor valorados» has a tie on the score to break by the number of reviews (9.5.5).
    const scores = rated.map((entry) => entry.valoracion);
    expect(new Set(scores).size).toBeLessThan(scores.length);
  });
});

describe('pnpm content:check on tests/fixtures/comercio/', () => {
  function copyRepo(): string {
    const root = folder();
    cpSync(path.join(repoRoot, 'content'), path.join(root, 'content'), { recursive: true });
    const fixtures = path.join('tests', 'fixtures', 'comercio');
    cpSync(path.join(repoRoot, fixtures), path.join(root, fixtures), { recursive: true });
    copyPublicForCheck(repoRoot, root);
    return root;
  }
  const edit = <T>(root: string, file: string, change: (data: T) => void) => {
    const target = path.join(root, file);
    const data = JSON.parse(readFileSync(target, 'utf8')) as T;
    change(data);
    writeFileSync(target, JSON.stringify(data, null, 2));
  };
  const lines = (entries: { file: string; path?: string; message: string }[]) =>
    entries.map((entry) => `${entry.file} · ${entry.path ?? ''} · ${entry.message}`);
  const comercioErrors = (root: string) =>
    lines(checkContent(root).errors).filter(
      (line) => line.startsWith('tests/fixtures/comercio/') || line.startsWith('content/items/'),
    );

  it('passes on the repository and counts every record as a draft', () => {
    const result = checkContent(repoRoot);
    expect(result.errors).toEqual([]);
    expect(result.summary).toContainEqual({
      file: 'tests/fixtures/comercio/anuncios.json',
      registros: `${anuncios.length} anuncios`,
      borradores: anuncios.length,
    });
    expect(result.summary).toContainEqual({
      file: 'tests/fixtures/comercio/vendedores.json',
      registros: `${vendedores.length} vendedores`,
      borradores: vendedores.length,
    });
  });

  it('checks nothing of Comercio without the folder, and both files with it', () => {
    const root = copyRepo();
    rmSync(path.join(root, 'tests', 'fixtures', 'comercio'), { recursive: true });
    expect(comercioErrors(root)).toEqual([]);

    const half = copyRepo();
    rmSync(path.join(half, 'tests', 'fixtures', 'comercio', 'vendedores.json'));
    expect(comercioErrors(half)).toContain(
      'tests/fixtures/comercio/vendedores.json ·  · el archivo no existe',
    );
  });

  it('reports every rule the schema cannot see', () => {
    const root = copyRepo();
    type Listings = { anuncios: Anuncio[] };
    type Sellers = { vendedores: Vendedor[] };
    edit<Listings>(root, 'tests/fixtures/comercio/anuncios.json', (data) => {
      const unit = (index: number) =>
        data.anuncios[index].pokemon as NonNullable<Anuncio['pokemon']>;
      delete data.anuncios[ITEMS].borrador;
      data.anuncios[DIAMONDS].vendedor = 'nadie-conocido';
      data.anuncios[DIAMONDS].mundo = 'mundo-inexistente';
      data.anuncios[DIAMONDS].precio.juego = [{ tipo: 'diamonds', cantidad: 5 }];
      data.anuncios[POKEDOLARES].expira = data.anuncios[POKEDOLARES].publicado;
      data.anuncios[POKEDOLARES].precio.juego = [
        { tipo: 'diamonds', cantidad: 1 },
        { tipo: 'diamonds', cantidad: 2 },
      ];
      data.anuncios[ITEMS].publicado = '2026-02-30T10:00:00Z';
      data.anuncios[ITEMS].item = { item: 'no-existe', cantidad: 1 };
      const ditto = unit(DITTO);
      ditto.memorias = ditto.memorias.slice(1);
      ditto.ball = 'fire-stone';
      ditto.auras = ['aura-inexistente'];
      ditto.entrenamiento = [
        { habilidad: 'HP', nivel: 1, progreso: null },
        { habilidad: 'HP', nivel: null, progreso: null },
      ];
      const other = data.anuncios.findIndex(
        (anuncio, index) =>
          anuncio.tipo === 'pokemon' && index !== DITTO && anuncio.pokemon?.memorySlots == null,
      );
      const plain = unit(other);
      plain.memorySlots = 2;
      plain.memorias = ['missingno', null];
      plain.heldX = 'fire-stone';
      plain.addons = ['bulbasaur-addon-1'];
      plain.pokemon = plain.pokemon === 'bulbasaur' ? 'ivysaur' : plain.pokemon;
      data.anuncios.push({ ...data.anuncios[ITEMS], borrador: true });
    });
    edit<Sellers>(root, 'tests/fixtures/comercio/vendedores.json', (data) => {
      const first = data.vendedores[0];
      delete first.borrador;
      first.canales = [
        { tipo: 'discord', etiqueta: null },
        { tipo: 'discord', etiqueta: null },
        { tipo: 'otra', etiqueta: 'Kick' },
        { tipo: 'otra', etiqueta: 'KICK' },
      ];
      const own = anuncios.find((anuncio) => anuncio.vendedor === first.id) as Anuncio;
      const foreign = anuncios.find((anuncio) => anuncio.vendedor !== first.id) as Anuncio;
      first.resenas = [
        {
          puntuacion: 5,
          comentario: 'Pagó 50kk al momento.',
          fecha: '2030-01-01T00:00:00Z',
          anuncio: own.id,
          comprador: first.id,
        },
        {
          puntuacion: 4,
          comentario: null,
          fecha: '2030-01-01T00:00:00Z',
          anuncio: foreign.id,
          comprador: 'comprador-x',
        },
        {
          puntuacion: 4,
          comentario: null,
          fecha: '2030-01-01T00:00:00Z',
          anuncio: 'no-such-listing',
          comprador: 'comprador-x',
        },
        {
          puntuacion: 4,
          comentario: null,
          fecha: '2020-01-01T00:00:00Z',
          anuncio: own.id,
          comprador: 'comprador-x',
        },
      ];
      data.vendedores.push({ ...data.vendedores[1] });
    });

    const errors = comercioErrors(root);
    const expected = [
      /anuncios\.json · anuncios\[\d+\]\.borrador · un registro de Comercio lleva "borrador": true/,
      /anuncios\.json · anuncios\[\d+\]\.id · id repetido/,
      /anuncios\.json · anuncios\[\d+\]\.vendedor · "nadie-conocido" no existe/,
      /anuncios\.json · anuncios\[\d+\]\.mundo · "mundo-inexistente" no existe en content\/mundos\.json/,
      /anuncios\.json · anuncios\[\d+\]\.precio\.juego · un anuncio de Diamonds no se paga con su propia moneda/,
      /anuncios\.json · anuncios\[\d+\]\.precio\.juego · las dos opciones del precio en el juego son de la misma moneda/,
      /anuncios\.json · anuncios\[\d+\]\.expira · expira debe ser posterior a publicado/,
      /anuncios\.json · anuncios\[\d+\]\.publicado · "2026-02-30T10:00:00Z" no es un día del calendario/,
      /anuncios\.json · anuncios\[\d+\]\.item\.item · "no-existe" no existe en content\/items\//,
      /anuncios\.json · anuncios\[\d+\]\.pokemon\.memorias · memorias tiene \d+ entradas y Memory Slots es \d+/,
      /anuncios\.json · anuncios\[\d+\]\.pokemon\.ball · "fire-stone" es de la categoría "stones" y una Ball es de "poke-balls"/,
      /anuncios\.json · anuncios\[\d+\]\.pokemon\.auras\[0\] · "aura-inexistente" no existe en content\/auras\.json/,
      /anuncios\.json · anuncios\[\d+\]\.pokemon\.entrenamiento\[1\]\.habilidad · habilidad repetida: "HP"/,
      /anuncios\.json · anuncios\[\d+\]\.pokemon\.entrenamiento\[1\] · una habilidad declarada lleva su nivel, su progreso o los dos/,
      /anuncios\.json · anuncios\[\d+\]\.pokemon\.memorySlots · Memory Slots solo va con Ditto y Shiny Ditto/,
      /anuncios\.json · anuncios\[\d+\]\.pokemon\.memorias · las memorias solo van con Ditto y Shiny Ditto/,
      /anuncios\.json · anuncios\[\d+\]\.pokemon\.memorias\[0\] · "missingno" no existe en content\/pokemon\.json/,
      /anuncios\.json · anuncios\[\d+\]\.pokemon\.heldX · "fire-stone" /,
      /anuncios\.json · anuncios\[\d+\]\.pokemon\.addons\[0\] · "bulbasaur-addon-1" no es un addon de/,
      /vendedores\.json · vendedores\[0\]\.borrador · un registro de Comercio lleva "borrador": true/,
      /vendedores\.json · vendedores\[\d+\]\.id · id repetido/,
      /vendedores\.json · vendedores\[0\]\.canales\[1\] · canal repetido: "discord"/,
      /vendedores\.json · vendedores\[0\]\.canales\[3\] · canal repetido: "KICK"/,
      /vendedores\.json · vendedores\[0\]\.resenas\[0\]\.comprador · un vendedor no se reseña a sí mismo/,
      /vendedores\.json · vendedores\[0\]\.resenas\[0\]\.comentario · importe del juego en texto libre \(«50kk»\)/,
      /vendedores\.json · vendedores\[0\]\.resenas\[1\]\.anuncio · ".+" es un anuncio de ".+": una reseña es de una operación de este vendedor/,
      /vendedores\.json · vendedores\[0\]\.resenas\[2\]\.anuncio · "no-such-listing" no existe en tests\/fixtures\/comercio\/anuncios\.json/,
      /vendedores\.json · vendedores\[0\]\.resenas\[3\]\.fecha · la reseña es anterior a la publicación de su anuncio/,
    ];
    for (const pattern of expected)
      expect(
        errors.some((line) => pattern.test(line)),
        `${pattern}\n${errors.join('\n')}`,
      ).toBe(true);
  });

  it('asks a Ditto for its Memory Slots and refuses the other list in a file', () => {
    const root = copyRepo();
    edit<{ anuncios: Anuncio[] }>(root, 'tests/fixtures/comercio/anuncios.json', (data) => {
      const ditto = data.anuncios[DITTO].pokemon as NonNullable<Anuncio['pokemon']>;
      ditto.memorySlots = null;
      ditto.memorias = [];
    });
    writeFileSync(
      path.join(root, 'tests', 'fixtures', 'comercio', 'vendedores.json'),
      JSON.stringify({ $schema: '../schemas/comercio.schema.json', anuncios: [] }),
    );
    const errors = comercioErrors(root);
    expect(errors).toContainEqual(
      expect.stringMatching(/\.pokemon\.memorySlots · un Ditto declara sus Memory Slots, de 1 a 6/),
    );
    expect(errors).toContain(
      'tests/fixtures/comercio/vendedores.json ·  · este archivo lleva la lista "vendedores"',
    );
  });
});

describe('the `moneda` object of content/items/diamantes.json (3.13)', () => {
  const itemsSchema = readJson('content/schemas/items.schema.json');
  const diamantes = readJson('content/items/diamantes.json');
  const lists = { es: ['Tienda'], en: ['Store'] };

  it('is in the file, with its two lists unknown until the owner fills them', () => {
    expect(diamantes.moneda).toEqual({ seCompranEn: null, seUsanEn: null });
    expect(Object.keys(diamantes)).toEqual(['$schema', 'moneda', 'items']);
  });

  it('passes the JSON Schema and its Zod mirror with lists, empty lists and nulls', () => {
    const valid = [
      diamantes,
      { ...diamantes, moneda: { seCompranEn: lists, seUsanEn: { es: [], en: [] } } },
      { ...diamantes, moneda: { seCompranEn: null, seUsanEn: lists } },
      { ...diamantes, moneda: undefined },
    ];
    for (const document of valid) {
      expect(validateSchema(JSON.parse(JSON.stringify(document)), itemsSchema)).toEqual([]);
      expect(itemsFileSchema.safeParse(document).success).toBe(true);
    }
    expect(monedaSchema.parse({ seCompranEn: lists, seUsanEn: null })).toEqual({
      seCompranEn: lists,
      seUsanEn: null,
    });
  });

  it('fails both on the same broken objects', () => {
    const broken = [
      { seCompranEn: null },
      { seCompranEn: null, seUsanEn: null, extra: [] },
      { seCompranEn: { es: ['Tienda'] }, seUsanEn: null },
      { seCompranEn: { es: [''], en: ['Store'] }, seUsanEn: null },
      { seCompranEn: { es: 'Tienda', en: 'Store' }, seUsanEn: null },
      { seCompranEn: [], seUsanEn: null },
    ];
    for (const moneda of broken) {
      const document = { ...diamantes, moneda };
      expect(validateSchema(document, itemsSchema).length, JSON.stringify(moneda)).toBeGreaterThan(
        0,
      );
      expect(itemsFileSchema.safeParse(document).success, JSON.stringify(moneda)).toBe(false);
    }
  });

  it('is refused by pnpm content:check anywhere else, with amounts or with uneven languages', () => {
    const root = folder();
    cpSync(path.join(repoRoot, 'content'), path.join(root, 'content'), { recursive: true });
    copyPublicForCheck(repoRoot, root);
    const write = (file: string, change: (data: Record<string, unknown>) => void) => {
      const target = path.join(root, 'content', 'items', file);
      const data = JSON.parse(readFileSync(target, 'utf8'));
      change(data);
      writeFileSync(target, JSON.stringify(data, null, 2));
    };
    write('stones.json', (data) => {
      const { items, ...rest } = data;
      for (const key of Object.keys(data)) delete data[key];
      Object.assign(data, rest, { moneda: { seCompranEn: null, seUsanEn: null }, items });
    });
    write('diamantes.json', (data) => {
      data.moneda = {
        seCompranEn: { es: ['Tienda', 'NPC'], en: ['Store'] },
        seUsanEn: { es: ['500 Diamonds de bono'], en: ['Bonus'] },
      };
    });
    const errors = lines(checkContent(root).errors);
    expect(errors).toContain(
      'content/items/stones.json · moneda · "moneda" solo va en content/items/diamantes.json',
    );
    expect(errors).toContainEqual(
      expect.stringMatching(
        /diamantes\.json · moneda\.seCompranEn · "seCompranEn" tiene 2 entradas en es y 1 en en/,
      ),
    );
    expect(errors).toContainEqual(
      expect.stringMatching(
        /diamantes\.json · moneda\.seUsanEn\.es\[0\] · importe del juego en texto libre \(«500 Diamonds»\)/,
      ),
    );
  });

  function lines(entries: { file: string; path?: string; message: string }[]) {
    return entries.map((entry) => `${entry.file} · ${entry.path ?? ''} · ${entry.message}`);
  }
});
