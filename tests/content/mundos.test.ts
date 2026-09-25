// The worlds of the Inicio (spec 3.13, 8.1): the JSON Schema of content/mundos.json, its Zod
// mirror, the readers `getMundos` and `sortMundos` and the checks of `pnpm content:check`.
//
// content/mundos.json is the owner's (D-011): it may be missing or empty (8.1 step 4), and the
// owner adds, renames or removes worlds. So the real file is read only when it exists, and only
// against the rules every valid file follows; the order and the checks are measured on worlds
// written here.
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

import { getMundos, sortMundos } from '@/lib/content/registry';
import { mundosFileSchema, type Mundo } from '@/lib/content/registry-schema';
import { checkContent } from '../../scripts/content/lib/check-content.mjs';
import { validateSchema } from '../../scripts/content/lib/json-schema.mjs';
import { copyPublicForCheck } from './public-copy';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const readJson = (file: string) => JSON.parse(readFileSync(path.join(repoRoot, file), 'utf8'));
const schema = readJson('content/schemas/mundos.schema.json');
/** The owner's file, or `null` without it (§3.13 allows it to be missing). */
const file: { mundos: Mundo[] } | null = existsSync(path.join(repoRoot, 'content', 'mundos.json'))
  ? readJson('content/mundos.json')
  : null;
/** The worlds of the file; none without it. */
const fileWorlds: Mundo[] = file?.mundos ?? [];

const world = (id: string, nombre: string): Mundo => ({ id, nombre });
const documentOf = (mundos: unknown[]) => ({ $schema: './schemas/mundos.schema.json', mundos });

describe('mundos.schema.json and its Zod mirror', () => {
  const accepts = (data: unknown) => {
    expect(validateSchema(data, schema), JSON.stringify(data)).toEqual([]);
    expect(mundosFileSchema.safeParse(data).success, JSON.stringify(data)).toBe(true);
  };

  it('both accept content/mundos.json and an empty list', () => {
    if (file !== null) accepts(file);
    accepts(documentOf([]));
  });

  // Each case breaks one thing of a valid document; both must reject it.
  const broken: [string, unknown][] = [
    ['a file without mundos', { $schema: './schemas/mundos.schema.json' }],
    ['mundos as an object', { mundos: { moon: 'Moon' } }],
    ['a field beside mundos', { mundos: [], orden: ['moon'] }],
    ['a world as a string', { mundos: ['Moon'] }],
    ['a world without id', { mundos: [{ nombre: 'Moon' }] }],
    ['a world without nombre', { mundos: [{ id: 'moon' }] }],
    ['an id with a space', { mundos: [world('titan 1', 'Titan 1')] }],
    ['an id in capitals', { mundos: [world('Titan-1', 'Titan 1')] }],
    ['an id with an underscore', { mundos: [world('titan_1', 'Titan 1')] }],
    ['an empty nombre', { mundos: [world('moon', '')] }],
    ['a nombre of spaces', { mundos: [world('moon', '   ')] }],
    ['a nombre per language', { mundos: [{ id: 'moon', nombre: { es: 'Luna', en: 'Moon' } }] }],
    // PZ-05, X3: no source gives the population, so no world carries one.
    ['players online', { mundos: [{ ...world('moon', 'Moon'), online: 1911 }] }],
    ['a population', { mundos: [{ ...world('moon', 'Moon'), poblacion: null }] }],
    ['a provenance field', { mundos: [{ ...world('moon', 'Moon'), fuente: 'launcher' }] }],
    ['a draft flag', { mundos: [{ ...world('moon', 'Moon'), borrador: true }] }],
  ];

  it.each(broken)('both reject %s', (_, data) => {
    const document = JSON.parse(JSON.stringify(data));
    expect(validateSchema(document, schema).length, JSON.stringify(data)).toBeGreaterThan(0);
    expect(mundosFileSchema.safeParse(document).success, JSON.stringify(data)).toBe(false);
  });
});

describe('getMundos and sortMundos', () => {
  it('list every world of the file, sorted by name for each locale (§8.1, §3.13)', () => {
    for (const locale of ['es', 'en'] as const) {
      expect(getMundos(locale)).toEqual(sortMundos(fileWorlds, locale));
    }
  });

  it('read every world of the file and nothing else: no population (PZ-05)', () => {
    expect(getMundos('es')).toHaveLength(fileWorlds.length);
    for (const mundo of getMundos('es'))
      expect(Object.keys(mundo).sort()).toEqual(['id', 'nombre']);
  });

  it('sort by name with the numbers in order, Titan 2 before Titan 10, into a new array', () => {
    const records = [
      world('titan-10', 'Titan 10'),
      world('titan-2', 'Titan 2'),
      world('sun', 'Sun'),
      world('moon', 'Moon'),
      world('titan-1', 'Titan 1'),
    ];
    const before = structuredClone(records);
    for (const locale of ['es', 'en'] as const)
      expect(sortMundos(records, locale).map((mundo) => mundo.nombre)).toEqual([
        'Moon',
        'Sun',
        'Titan 1',
        'Titan 2',
        'Titan 10',
      ]);
    expect(records).toEqual(before);
  });

  it('sort with the collation of the locale: Ñ is a letter of its own in es', () => {
    const records = [world('na', 'Ña'), world('nz', 'Nz')];
    expect(sortMundos(records, 'es').map((mundo) => mundo.nombre)).toEqual(['Nz', 'Ña']);
    expect(sortMundos(records, 'en').map((mundo) => mundo.nombre)).toEqual(['Ña', 'Nz']);
  });
});

describe('pnpm content:check on content/mundos.json', () => {
  const scratch = mkdtempSync(path.join(tmpdir(), 'content-mundos-'));
  afterAll(() => rmSync(scratch, { recursive: true, force: true }));

  // The copy leaves out the sample data of Comercio (content/comercio/, §9.4): its listings name
  // worlds of the owner's file, so the worlds each case writes here would fail them, and that
  // folder has its own checks (tests/trade/registry.test.ts). content:check accepts a repository
  // without it (§9.2).
  const comercio = path.join(repoRoot, 'content', 'comercio');
  function copyRepo() {
    const root = path.join(scratch, `repo-${Math.random().toString(36).slice(2)}`);
    cpSync(path.join(repoRoot, 'content'), path.join(root, 'content'), {
      recursive: true,
      filter: (source) => path.relative(comercio, source).startsWith('..'),
    });
    copyPublicForCheck(repoRoot, root);
    return root;
  }
  const writeMundos = (root: string, data: unknown) =>
    writeFileSync(path.join(root, 'content', 'mundos.json'), JSON.stringify(data, null, 2));
  const errorsOf = (root: string) =>
    checkContent(root).errors.map(
      (problem: { file: string; path?: string; message: string }) =>
        `${problem.file} · ${problem.path ?? ''} · ${problem.message}`,
    );

  it('passes on the repository and counts the worlds', () => {
    const result = checkContent(repoRoot);
    expect(result.errors).toEqual([]);
    const files = result.summary.map((row: { file: string }) => row.file);
    if (file === null) {
      expect(files).not.toContain('content/mundos.json');
      return;
    }
    expect(result.summary).toContainEqual({
      file: 'content/mundos.json',
      registros: `${fileWorlds.length} mundos`,
      borradores: null,
    });
  });

  it('reports a repeated id and a repeated name, each once, where it repeats', () => {
    const root = copyRepo();
    writeMundos(
      root,
      documentOf([
        world('moon', 'Moon'),
        world('sun', 'Sun'),
        world('moon', 'Luna'),
        world('sol', ' sun'),
      ]),
    );
    expect(errorsOf(root)).toEqual([
      expect.stringMatching(
        /^content\/mundos\.json · mundos\[2\]\.id · id repetido: "moon" \(también en mundos\[0\]\)$/,
      ),
      expect.stringMatching(
        /^content\/mundos\.json · mundos\[3\]\.nombre · nombre repetido: " sun" \(también en mundos\[1\]\)$/,
      ),
    ]);
  });

  it('reports a field the schema does not take', () => {
    const root = copyRepo();
    writeMundos(root, documentOf([{ ...world('moon', 'Moon'), online: 1911 }]));
    expect(errorsOf(root)).toEqual([
      expect.stringMatching(
        /^content\/mundos\.json · mundos\[0\]\.online · campo no permitido: "online"$/,
      ),
    ]);
  });

  it('accepts an empty list and a repository without the file', () => {
    const root = copyRepo();
    writeMundos(root, documentOf([]));
    let result = checkContent(root);
    expect(result.errors).toEqual([]);
    expect(result.summary).toContainEqual({
      file: 'content/mundos.json',
      registros: '0 mundos',
      borradores: null,
    });

    rmSync(path.join(root, 'content', 'mundos.json'), { force: true });
    result = checkContent(root);
    expect(result.errors).toEqual([]);
    expect(result.summary.map((row: { file: string }) => row.file)).not.toContain(
      'content/mundos.json',
    );
  });
});
