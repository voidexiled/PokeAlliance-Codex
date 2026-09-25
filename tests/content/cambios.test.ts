// Cambios (spec 3.13, 8.7): the JSON Schema of content/cambios.json, its Zod mirror, the readers
// `getCambios`, `sortCambios` and `groupCambiosByMonth`, and the checks of `pnpm content:check`.
//
// content/cambios.json is the owner's, written by hand (D-011, R10): it may be missing or empty,
// and an entry is published by deleting its `borrador`. So nothing here depends on what the file
// holds today: the real file is read only when it exists, and only against the rules every valid
// file follows; each case of `pnpm content:check` writes its own synthetic entries into a copy of
// the registries, naming ids those registries have.
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it, vi } from 'vitest';

import { getCambios, groupCambiosByMonth, sortCambios } from '@/lib/content/registry';
import { cambiosFileSchema, type Cambio } from '@/lib/content/registry-schema';
import { checkContent } from '../../scripts/content/lib/check-content.mjs';
import { validateSchema } from '../../scripts/content/lib/json-schema.mjs';
import { copyPublicForCheck } from './public-copy';

type Json = Record<string, unknown>;

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const readJson = (file: string) => JSON.parse(readFileSync(path.join(repoRoot, file), 'utf8'));
const schema = readJson('content/schemas/cambios.schema.json');
/** The owner's file, or `null` without it (§3.13 allows it to be missing). */
const file: { cambios: Cambio[] } | null = existsSync(
  path.join(repoRoot, 'content', 'cambios.json'),
)
  ? readJson('content/cambios.json')
  : null;
/** The entries of the file; none without it. */
const records: Cambio[] = file?.cambios ?? [];

/** A synthetic entry with its three required fields. */
const entry = (id: string, fecha: string, overrides: Json = {}): Json => ({
  id,
  fecha,
  titulo: { es: `Cambio de prueba ${id}`, en: `Test change ${id}` },
  ...overrides,
});
const documentOf = (cambios: unknown[]) => ({ $schema: './schemas/cambios.schema.json', cambios });

/** One id of each registry an entity of an entry may name (§3.13, `Ref`). */
function registryIds() {
  const pokemon: string | undefined = readJson('content/pokemon.json').pokemon[0]?.id;
  const actividad: string | undefined = readJson('content/quests.json').misiones[0]?.id;
  const sistema = readdirSync(path.join(repoRoot, 'content', 'sistemas'))
    .find((name) => name.endsWith('.json'))
    ?.replace(/\.json$/, '');
  const item = readdirSync(path.join(repoRoot, 'content', 'items'))
    .filter((name) => name.endsWith('.json') && name !== 'categorias.json')
    .map((name) => readJson(`content/items/${name}`).items[0]?.id as string | undefined)
    .find((id) => id !== undefined);
  const [sprite] = Object.keys(readJson('public/sprites/sprites.json').sprites);
  if (!pokemon || !actividad || !sistema || !item || !sprite)
    throw new Error('the registries need a Pokémon, an item, a system, an activity and a sprite');
  return { pokemon, item, sistema, actividad, sprite };
}

describe('cambios.schema.json and its Zod mirror', () => {
  const accepts = (data: unknown) => {
    expect(validateSchema(data, schema), JSON.stringify(data)).toEqual([]);
    expect(cambiosFileSchema.safeParse(data).success, JSON.stringify(data)).toBe(true);
  };
  const rejects = (data: unknown) => {
    const document = JSON.parse(JSON.stringify(data));
    expect(validateSchema(document, schema).length, JSON.stringify(data)).toBeGreaterThan(0);
    expect(cambiosFileSchema.safeParse(document).success, JSON.stringify(data)).toBe(false);
  };

  it.runIf(file !== null)('both accept content/cambios.json', () => {
    accepts(file);
  });

  it('both accept an empty list, an entry with its required fields and a whole entry', () => {
    accepts(documentOf([]));
    accepts(documentOf([entry('a', '2026-09-18')]));
    accepts(
      documentOf([
        entry('b', '2026-09-18', {
          puntos: { es: ['Punto uno', 'Punto dos'], en: ['Point one', 'Point two'] },
          entidades: [
            { tipo: 'pokemon', id: 'charizard' },
            { tipo: 'item', id: 'fire-stone' },
            { tipo: 'sistema', id: 'boost' },
            { tipo: 'actividad', id: 'porygon-quest-dr-vektor' },
          ],
          sprite: 'ui/diamond',
          borrador: true,
        }),
      ]),
    );
  });

  it('take a day of the calendar as fecha, leap days included (AAAA-MM-DD)', () => {
    for (const fecha of ['2026-01-31', '2026-04-30', '2026-02-28', '2024-02-29', '2000-02-29'])
      accepts(documentOf([entry('a', fecha)]));
    for (const fecha of [
      '2026-02-29',
      '2100-02-29',
      '2026-02-30',
      '2026-04-31',
      '2026-13-01',
      '2026-00-10',
      '2026-09-00',
      '2026-9-18',
      '18/09/2026',
      '2026-09-18T12:00:00Z',
      '',
    ])
      rejects(documentOf([entry('a', fecha)]));
  });

  it('give a Ref the four tipos of the other registries (§3.13)', () => {
    const tipos = schema.$defs.ref.properties.tipo.enum;
    expect(tipos).toEqual(['pokemon', 'item', 'sistema', 'actividad']);
    for (const other of ['pokemon', 'sistemas'])
      expect(
        readJson(`content/schemas/${other}.schema.json`).$defs.ref.properties.tipo.enum,
      ).toEqual(tipos);
  });

  // Each case breaks one thing of a valid document; both must reject it.
  const broken: [string, unknown][] = [
    ['a file without cambios', { $schema: './schemas/cambios.schema.json' }],
    ['cambios as an object', { cambios: { a: entry('a', '2026-09-18') } }],
    ['a field beside cambios', { cambios: [], orden: 1 }],
    ['an entry without id', { cambios: [{ fecha: '2026-09-18', titulo: { es: 'a', en: 'a' } }] }],
    ['an entry without fecha', { cambios: [{ id: 'a', titulo: { es: 'a', en: 'a' } }] }],
    ['an entry without titulo', { cambios: [{ id: 'a', fecha: '2026-09-18' }] }],
    ['an id with capitals', { cambios: [entry('Cambio-1', '2026-09-18')] }],
    ['an id with spaces', { cambios: [entry('cambio 1', '2026-09-18')] }],
    ['a fecha as a number', { cambios: [entry('a', '2026-09-18', { fecha: 20260918 })] }],
    ['a titulo as a string', { cambios: [entry('a', '2026-09-18', { titulo: 'Cambio' })] }],
    ['a titulo without en', { cambios: [entry('a', '2026-09-18', { titulo: { es: 'a' } })] }],
    [
      'a titulo of spaces',
      { cambios: [entry('a', '2026-09-18', { titulo: { es: ' ', en: 'a' } })] },
    ],
    [
      'a titulo in a third language',
      { cambios: [entry('a', '2026-09-18', { titulo: { es: 'a', en: 'a', pt: 'a' } })] },
    ],
    ['puntos as a list', { cambios: [entry('a', '2026-09-18', { puntos: ['a'] })] }],
    ['puntos without en', { cambios: [entry('a', '2026-09-18', { puntos: { es: ['a'] } })] }],
    [
      'puntos with an empty language',
      { cambios: [entry('a', '2026-09-18', { puntos: { es: [], en: [] } })] },
    ],
    [
      'a point of spaces',
      { cambios: [entry('a', '2026-09-18', { puntos: { es: ['  '], en: ['a'] } })] },
    ],
    ['an empty list of entidades', { cambios: [entry('a', '2026-09-18', { entidades: [] })] }],
    [
      'an entity of another tipo',
      { cambios: [entry('a', '2026-09-18', { entidades: [{ tipo: 'mapa', id: 'x' }] })] },
    ],
    [
      'an entity without id',
      { cambios: [entry('a', '2026-09-18', { entidades: [{ tipo: 'pokemon' }] })] },
    ],
    [
      'an entity id with capitals',
      {
        cambios: [entry('a', '2026-09-18', { entidades: [{ tipo: 'pokemon', id: 'Charizard' }] })],
      },
    ],
    [
      'an entity with a text',
      {
        cambios: [
          entry('a', '2026-09-18', {
            entidades: [{ tipo: 'pokemon', id: 'charizard', texto: 'Charizard' }],
          }),
        ],
      },
    ],
    ['a sprite set to null', { cambios: [entry('a', '2026-09-18', { sprite: null })] }],
    [
      'a sprite key with capitals',
      { cambios: [entry('a', '2026-09-18', { sprite: 'UI/Diamond' })] },
    ],
    ['a sprite path', { cambios: [entry('a', '2026-09-18', { sprite: 'ui/diamond.png' })] }],
    ['borrador false', { cambios: [entry('a', '2026-09-18', { borrador: false })] }],
    ['a provenance field', { cambios: [entry('a', '2026-09-18', { fuente: 'Discord' })] }],
    [
      'a link to an outside page (R6)',
      { cambios: [entry('a', '2026-09-18', { enlace: 'https://example.com/' })] },
    ],
  ];

  it.each(broken)('both reject %s', (_, data) => {
    rejects(data);
  });
});

describe('the readers of Cambios', () => {
  const cambio = (id: string, fecha: string, extra: Partial<Cambio> = {}): Cambio => ({
    id,
    fecha,
    titulo: { es: `Cambio de prueba ${id}`, en: `Test change ${id}` },
    ...extra,
  });

  it('getCambios reads content/cambios.json in the order of the page, none without it', () => {
    expect(getCambios()).toEqual(sortCambios(records));
  });

  it('getCambios leaves the drafts out with OCULTAR_BORRADORES=1 (§8.0.5)', () => {
    vi.stubEnv('OCULTAR_BORRADORES', '1');
    try {
      expect(getCambios()).toEqual(sortCambios(records.filter((item) => item.borrador !== true)));
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('sortCambios orders by fecha, newest first, and one day by id (8.7 step 4)', () => {
    const input = [
      cambio('b', '2026-08-02'),
      cambio('c', '2026-09-18'),
      cambio('a', '2026-09-18'),
      cambio('d', '2025-12-31'),
      cambio('e', '2026-09-01'),
    ];
    const snapshot = structuredClone(input);
    expect(sortCambios(input).map((item) => item.id)).toEqual(['a', 'c', 'e', 'b', 'd']);
    expect(input).toEqual(snapshot);
  });

  it('groupCambiosByMonth gives one month per month with entries, newest first (CA1)', () => {
    // Three entries in two months: two sections, three steps.
    const months = groupCambiosByMonth([
      cambio('previo', '2026-08-30'),
      cambio('uno', '2026-09-02'),
      cambio('dos', '2026-09-18'),
    ]);
    expect(months.map((month) => month.id)).toEqual(['2026-09', '2026-08']);
    expect(months.map((month) => month.cambios.map((item) => item.id))).toEqual([
      ['dos', 'uno'],
      ['previo'],
    ]);
    expect(months.flatMap((month) => month.cambios)).toHaveLength(3);
  });

  it('groupCambiosByMonth keeps years apart and gives nothing for no entry', () => {
    const months = groupCambiosByMonth([
      cambio('a', '2025-09-30'),
      cambio('b', '2026-09-01'),
      cambio('c', '2026-01-15'),
      cambio('d', '2025-12-01'),
    ]);
    expect(months.map((month) => month.id)).toEqual(['2026-09', '2026-01', '2025-12', '2025-09']);
    expect(groupCambiosByMonth([cambio('a', '2026-09-18')])).toEqual([
      { id: '2026-09', cambios: [cambio('a', '2026-09-18')] },
    ]);
    expect(groupCambiosByMonth([])).toEqual([]);
  });
});

describe('pnpm content:check on content/cambios.json', () => {
  const scratch = mkdtempSync(path.join(tmpdir(), 'content-cambios-'));
  afterAll(() => rmSync(scratch, { recursive: true, force: true }));

  /** A copy of the registries and the sprites, without src/pages/ (as registry.test.ts). */
  function copyRepo() {
    const root = path.join(scratch, `repo-${Math.random().toString(36).slice(2)}`);
    cpSync(path.join(repoRoot, 'content'), path.join(root, 'content'), { recursive: true });
    copyPublicForCheck(repoRoot, root);
    return root;
  }
  const writeCambios = (root: string, data: unknown) =>
    writeFileSync(path.join(root, 'content', 'cambios.json'), JSON.stringify(data, null, 2));
  const errorsOf = (root: string) =>
    checkContent(root).errors.map(
      (problem: { file: string; path?: string; message: string }) =>
        `${problem.file} · ${problem.path ?? ''} · ${problem.message}`,
    );

  it('passes on the repository and counts the entries and their drafts', () => {
    const result = checkContent(repoRoot);
    expect(result.errors).toEqual([]);
    if (file === null) {
      expect(result.summary.map((row: { file: string }) => row.file)).not.toContain(
        'content/cambios.json',
      );
      return;
    }
    expect(result.summary).toContainEqual({
      file: 'content/cambios.json',
      registros: `${records.length} ${records.length === 1 ? 'cambio' : 'cambios'}`,
      borradores: records.filter((item) => item.borrador === true).length,
    });
  });

  it('accepts entries that name the registries, and counts the drafts', () => {
    const ids = registryIds();
    const root = copyRepo();
    writeCambios(
      root,
      documentOf([
        entry('a', '2026-09-18', {
          puntos: { es: ['Nivel 200', 'Punto dos'], en: ['Level 200', 'Point two'] },
          entidades: [
            { tipo: 'pokemon', id: ids.pokemon },
            { tipo: 'item', id: ids.item },
            { tipo: 'sistema', id: ids.sistema },
            { tipo: 'actividad', id: ids.actividad },
          ],
          sprite: ids.sprite,
        }),
        entry('b', '2026-08-01', { borrador: true }),
      ]),
    );
    const result = checkContent(root);
    expect(result.errors).toEqual([]);
    expect(result.summary).toContainEqual({
      file: 'content/cambios.json',
      registros: '2 cambios',
      borradores: 1,
    });
  });

  it('stops on an entity with no record, of any tipo (8.7)', () => {
    const root = copyRepo();
    writeCambios(
      root,
      documentOf([
        entry('a', '2026-09-18', {
          entidades: [
            { tipo: 'pokemon', id: 'missingno' },
            { tipo: 'item', id: 'nada' },
            { tipo: 'sistema', id: 'nada' },
            { tipo: 'actividad', id: 'nada' },
          ],
        }),
      ]),
    );
    expect(errorsOf(root)).toEqual([
      'content/cambios.json · cambios[0].entidades[0].id · "missingno" no existe en content/pokemon.json',
      'content/cambios.json · cambios[0].entidades[1].id · "nada" no existe en content/items/',
      'content/cambios.json · cambios[0].entidades[2].id · "nada" no existe en content/sistemas/',
      'content/cambios.json · cambios[0].entidades[3].id · "nada" no existe en content/quests.json',
    ]);
  });

  it('reports a repeated id, an entity named twice in an entry, a missing sprite and uneven points', () => {
    const ids = registryIds();
    const root = copyRepo();
    writeCambios(
      root,
      documentOf([
        entry('a', '2026-09-18', {
          entidades: [
            { tipo: 'pokemon', id: ids.pokemon },
            { tipo: 'pokemon', id: ids.pokemon },
          ],
        }),
        entry('a', '2026-09-17', { sprite: 'ui/nope' }),
        entry('b', '2026-09-16', { puntos: { es: ['Uno', 'Dos'], en: ['One'] } }),
      ]),
    );
    expect(errorsOf(root)).toEqual([
      `content/cambios.json · cambios[0].entidades[1] · entidad repetida: pokemon "${ids.pokemon}" (también en entidades[0])`,
      'content/cambios.json · cambios[1].id · id repetido: "a" (también en cambios[0])',
      'content/cambios.json · cambios[1].sprite · el sprite "ui/nope" no existe en public/sprites/sprites.json',
      'content/cambios.json · cambios[2].puntos · el cambio tiene 2 puntos en es y 1 en en: son los mismos puntos en los dos idiomas',
    ]);
  });

  it('refuses a game amount written as free text in the title or the points (S8)', () => {
    const root = copyRepo();
    writeCambios(
      root,
      documentOf([
        entry('a', '2026-09-18', {
          titulo: { es: 'El Diamond cuesta 45kk', en: 'The Diamond costs 45kk' },
          puntos: { es: ['Precio: 2,5k'], en: ['Price: 500 Pokédollars'] },
        }),
        entry('b', '2026-09-17', {
          titulo: { es: 'Nivel 200 y 5,000,000 de experiencia', en: 'Level 200, 20 Diamonds' },
        }),
      ]),
    );
    const refused = (at: string, amount: string) =>
      `content/cambios.json · ${at} · importe del juego en texto libre («${amount}»): el texto de un cambio no lleva importes, porque el sitio muestra cada importe del juego con el sprite de su moneda`;
    expect(errorsOf(root)).toEqual([
      refused('cambios[0].titulo.es', '45kk'),
      refused('cambios[0].puntos.es[0]', '2,5k'),
      refused('cambios[0].titulo.en', '45kk'),
      refused('cambios[0].puntos.en[0]', '500 Pokédollars'),
      refused('cambios[1].titulo.en', '20 Diamonds'),
    ]);
  });

  it('reports a date off the calendar once, through the schema', () => {
    const root = copyRepo();
    writeCambios(root, documentOf([entry('a', '2026-02-30')]));
    expect(errorsOf(root)).toEqual([
      'content/cambios.json · cambios[0].fecha · "2026-02-30" no tiene el formato esperado',
    ]);
  });

  it('accepts a repository without the file and asks for "$schema" in the file', () => {
    const root = copyRepo();
    rmSync(path.join(root, 'content', 'cambios.json'), { force: true });
    const result = checkContent(root);
    expect(result.errors).toEqual([]);
    expect(result.summary.map((row: { file: string }) => row.file)).not.toContain(
      'content/cambios.json',
    );

    writeCambios(root, { cambios: [] });
    expect(errorsOf(root)).toEqual([
      'content/cambios.json ·  · falta "$schema": "./schemas/cambios.schema.json"',
    ]);
  });
});
