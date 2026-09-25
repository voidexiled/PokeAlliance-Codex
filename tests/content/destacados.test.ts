// The Destacados of the Inicio (spec 3.13, 8.1): the JSON Schema of content/destacados.json,
// its Zod mirror, the reader `getDestacados` and the checks of `pnpm content:check`.
//
// content/destacados.json is the owner's (D-011): it may be missing (8.1 «Estados»), and an entry
// is published by deleting its `borrador` (docs/REGISTROS.md). So nothing here depends on what
// the file holds today: the real file is read only when it exists, and only against the rules
// every valid file follows; each case of `pnpm content:check` writes its own entries into a copy
// of the registries, with ids those registries have.
import {
  cpSync,
  existsSync,
  mkdirSync,
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

import { getDestacados } from '@/lib/content/registry';
import { destacadosFileSchema } from '@/lib/content/registry-schema';
import { getPokemon, getQuests } from '@/lib/content/repository';
import { checkContent } from '../../scripts/content/lib/check-content.mjs';
import { validateSchema } from '../../scripts/content/lib/json-schema.mjs';
import { copyPublicForCheck } from './public-copy';

type Json = Record<string, unknown>;
type Entry = { etiqueta: { es: string; en: string }; ruta: string; sprite: string | null } & Json;

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const readJson = (file: string) => JSON.parse(readFileSync(path.join(repoRoot, file), 'utf8'));
const schema = readJson('content/schemas/destacados.schema.json');
/** The owner's file, or `null` without it (§3.13 allows it to be missing). */
const file: { destacados: Entry[] } | null = existsSync(
  path.join(repoRoot, 'content', 'destacados.json'),
)
  ? readJson('content/destacados.json')
  : null;
/** The entries of the file; none without it. */
const records: Entry[] = file?.destacados ?? [];

/** A published entry: a page of the build, with a sprite of the registry. */
const entry = (ruta = '/pokedex/', overrides: Json = {}): Entry => ({
  etiqueta: { es: 'Pokédex', en: 'Pokédex' },
  ruta,
  sprite: 'ui/balls/alliance-ball',
  ...overrides,
});
const documentOf = (destacados: unknown[]) => ({
  $schema: './schemas/destacados.schema.json',
  destacados,
});

describe('destacados.schema.json and its Zod mirror', () => {
  const accepts = (data: unknown) => {
    expect(validateSchema(data, schema), JSON.stringify(data)).toEqual([]);
    expect(destacadosFileSchema.safeParse(data).success, JSON.stringify(data)).toBe(true);
  };
  const rejects = (data: unknown) => {
    const document = JSON.parse(JSON.stringify(data));
    expect(validateSchema(document, schema).length, JSON.stringify(data)).toBeGreaterThan(0);
    expect(destacadosFileSchema.safeParse(document).success, JSON.stringify(data)).toBe(false);
  };

  it.runIf(file !== null)('both accept content/destacados.json', () => {
    accepts(file);
  });

  it('both accept a published entry, an entry without sprite and the route of the Inicio', () => {
    accepts(documentOf([entry()]));
    accepts(documentOf([entry('/sistemas/boost/', { sprite: null, borrador: true })]));
    accepts(documentOf([entry('/', { etiqueta: { es: 'Inicio', en: 'Home' } })]));
  });

  it('take from 1 to 4 entries (§3.13), the bounds the mirror reads from the schema', () => {
    expect(schema.properties.destacados).toMatchObject({ minItems: 1, maxItems: 4 });
    const routes = ['/pokedex/', '/pokedex/tiers/', '/items/', '/comercio/', '/sistemas/'];
    accepts(documentOf(routes.slice(0, 1).map((ruta) => entry(ruta))));
    accepts(documentOf(routes.slice(0, 4).map((ruta) => entry(ruta))));
    rejects(documentOf([]));
    rejects(documentOf(routes.map((ruta) => entry(ruta))));
  });

  // Each case breaks one thing of a valid document; both must reject it.
  const broken: [string, unknown][] = [
    ['a file without destacados', { $schema: './schemas/destacados.schema.json' }],
    ['destacados as an object', { destacados: { a: entry() } }],
    ['a field beside destacados', { destacados: [entry()], orden: 1 }],
    ['an entry without etiqueta', { destacados: [{ ruta: '/pokedex/', sprite: null }] }],
    ['an entry without ruta', { destacados: [{ etiqueta: { es: 'a', en: 'a' }, sprite: null }] }],
    ['an entry without sprite', { destacados: [{ etiqueta: { es: 'a', en: 'a' }, ruta: '/' }] }],
    ['an etiqueta as a string', { destacados: [entry('/pokedex/', { etiqueta: 'Pokédex' })] }],
    ['an etiqueta without en', { destacados: [entry('/pokedex/', { etiqueta: { es: 'a' } })] }],
    [
      'an etiqueta of spaces',
      { destacados: [entry('/pokedex/', { etiqueta: { es: ' ', en: 'a' } })] },
    ],
    [
      'an etiqueta in a third language',
      { destacados: [entry('/pokedex/', { etiqueta: { es: 'a', en: 'a', pt: 'a' } })] },
    ],
    ['a route without final slash', { destacados: [entry('/pokedex')] }],
    ['a route without leading slash', { destacados: [entry('pokedex/')] }],
    ['a route with a query', { destacados: [entry('/pokedex/?elemento=fire')] }],
    ['a route with a fragment', { destacados: [entry('/sistemas/boost/#stones')] }],
    ['a route in capitals', { destacados: [entry('/Pokedex/')] }],
    ['an absolute URL', { destacados: [entry('https://pokealliance-codex.vercel.app/es/')] }],
    ['a sprite key with capitals', { destacados: [entry('/pokedex/', { sprite: 'UI/Diamond' })] }],
    ['a sprite path', { destacados: [entry('/pokedex/', { sprite: 'ui/diamond.png' })] }],
    ['borrador false', { destacados: [entry('/pokedex/', { borrador: false })] }],
    ['a provenance field', { destacados: [entry('/pokedex/', { fuente: 'tablero' })] }],
    ['an id beside the route', { destacados: [entry('/pokedex/', { id: 'pokedex' })] }],
  ];

  it.each(broken)('both reject %s', (_, data) => {
    rejects(data);
  });
});

describe('getDestacados', () => {
  it('reads the entries of content/destacados.json in the order of the file, none without it', () => {
    expect(getDestacados()).toEqual(records);
  });

  it('leaves the drafts out with OCULTAR_BORRADORES=1 (§8.0.5)', () => {
    vi.stubEnv('OCULTAR_BORRADORES', '1');
    try {
      expect(getDestacados()).toEqual(records.filter((item) => item.borrador !== true));
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe('pnpm content:check on content/destacados.json', () => {
  const scratch = mkdtempSync(path.join(tmpdir(), 'content-destacados-'));
  afterAll(() => rmSync(scratch, { recursive: true, force: true }));

  /** A copy of the registries and the sprites, without src/pages/ (as registry.test.ts). */
  function copyRepo() {
    const root = path.join(scratch, `repo-${Math.random().toString(36).slice(2)}`);
    cpSync(path.join(repoRoot, 'content'), path.join(root, 'content'), { recursive: true });
    copyPublicForCheck(repoRoot, root);
    return root;
  }
  /** Empty page files under src/pages/[locale]/ of a copy: the pages its build writes. */
  const addPages = (root: string, pages: string[]) => {
    for (const page of pages) {
      const target = path.join(root, 'src', 'pages', '[locale]', ...page.split('/'));
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, '---\n---\n');
    }
  };
  const writeDestacados = (root: string, data: unknown) =>
    writeFileSync(path.join(root, 'content', 'destacados.json'), JSON.stringify(data, null, 2));
  /** The system pages of a copy, as its files hold them. */
  const sistemasOf = (root: string) => {
    const folder = path.join(root, 'content', 'sistemas');
    return readdirSync(folder)
      .filter((name) => name.endsWith('.json'))
      .map((name) => ({
        file: path.join(folder, name),
        record: JSON.parse(readFileSync(path.join(folder, name), 'utf8')) as Json & { id: string },
      }));
  };
  const errorsOf = (root: string) =>
    checkContent(root).errors.map(
      (problem: { file: string; path?: string; message: string }) =>
        `${problem.file} · ${problem.path ?? ''} · ${problem.message}`,
    );

  it('passes on the repository, whose src/pages/ has every page the entries lead to', () => {
    const result = checkContent(repoRoot);
    expect(result.errors).toEqual([]);
    const files = result.summary.map((row: { file: string }) => row.file);
    if (file === null) {
      expect(files).not.toContain('content/destacados.json');
      return;
    }
    expect(result.summary).toContainEqual({
      file: 'content/destacados.json',
      registros: `${records.length} destacados`,
      borradores: records.filter((item) => item.borrador === true).length,
    });
  });

  it('resolves each route against the routes of 8.0.1 and their registries', () => {
    const pokemon = getPokemon()[0];
    if (pokemon === undefined) throw new Error('content/pokemon.json has no record');
    const root = copyRepo();
    writeDestacados(
      root,
      documentOf([
        entry('/es/pokedex/'),
        entry('/foros/'),
        entry('/pokedex/missingno/'),
        entry('/rotaciones/'),
      ]),
    );
    expect(errorsOf(root)).toEqual([
      expect.stringMatching(
        /^content\/destacados\.json · destacados\[0\]\.ruta · la ruta va sin idioma: "\/pokedex\/"$/,
      ),
      expect.stringMatching(
        /^content\/destacados\.json · destacados\[1\]\.ruta · la ruta \/foros\/ no es una página del sitio$/,
      ),
      expect.stringMatching(
        /^content\/destacados\.json · destacados\[2\]\.ruta · "missingno" no existe en content\/pokemon\.json$/,
      ),
      expect.stringMatching(
        /^content\/destacados\.json · destacados\[3\]\.ruta · la ruta \/rotaciones\/ no es una página del sitio$/,
      ),
    ]);

    writeDestacados(
      root,
      documentOf([
        entry('/sistemas/nada/'),
        entry('/items/c/todo/'),
        entry('/actividades/nada/'),
        entry(`/pokedex/${pokemon.id}/`),
      ]),
    );
    expect(errorsOf(root)).toEqual([
      expect.stringMatching(/destacados\[0\]\.ruta · "nada" no existe en content\/sistemas\/$/),
      expect.stringMatching(
        /destacados\[1\]\.ruta · "todo" no existe en las categorías de content\/items\/categorias\.json$/,
      ),
      expect.stringMatching(/destacados\[2\]\.ruta · "nada" no existe en content\/quests\.json$/),
    ]);
  });

  it('needs the page of the route in src/pages/[locale]/ (routes of 8.0.1 that the build does not write yet)', () => {
    const pokemon = getPokemon()[0];
    const quest = getQuests()[0];
    if (pokemon === undefined || quest === undefined)
      throw new Error('content/pokemon.json and content/quests.json need a record');
    const root = copyRepo();
    const [sistema] = sistemasOf(root);
    if (sistema === undefined) throw new Error('content/sistemas/ has no page');
    addPages(root, [
      'pokedex/index.astro',
      'pokedex/[slug].astro',
      'sistemas/[id].astro',
      'items/c/[categoria].astro',
    ]);
    writeDestacados(
      root,
      documentOf([
        entry('/actividades/'),
        entry(`/actividades/${quest.id}/`),
        entry('/pokedex/tiers/'),
        entry('/'),
      ]),
    );
    // `/pokedex/tiers/` is a static route: the template of its folder is the page of a
    // Pokémon, not its page.
    expect(errorsOf(root)).toEqual([
      expect.stringMatching(
        /^content\/destacados\.json · destacados\[0\]\.ruta · la página \/actividades\/ aún no existe: no está en src\/pages\/\[locale\]\/$/,
      ),
      `content/destacados.json · destacados[1].ruta · la página /actividades/${quest.id}/ aún no existe: no está en src/pages/[locale]/`,
      expect.stringMatching(/destacados\[2\]\.ruta · la página \/pokedex\/tiers\/ aún no existe/),
      expect.stringMatching(/destacados\[3\]\.ruta · la página \/ aún no existe/),
    ]);

    addPages(root, [
      'index.astro',
      'pokedex/tiers.astro',
      'actividades/index.astro',
      'actividades/[id].astro',
    ]);
    expect(errorsOf(root)).toEqual([]);

    // A route with a parameter is the template of its folder; a static route, `<ruta>.astro`
    // or `<ruta>/index.astro`.
    // A draft entry, so the case holds whether or not the copy publishes that system.
    writeDestacados(
      root,
      documentOf([
        entry(`/pokedex/${pokemon.id}/`),
        entry(`/sistemas/${sistema.record.id}/`, { borrador: true }),
        entry('/items/c/stones/'),
        entry('/pokedex/'),
      ]),
    );
    expect(errorsOf(root)).toEqual([]);
  });

  it('keeps a published entry away from the page of a draft system (OCULTAR_BORRADORES=1)', () => {
    const root = copyRepo();
    // A draft page — one the copy already marks, or else one this case marks — and a published
    // one when the copy has it: the case holds whatever the owner has published by now.
    const sistemas = sistemasOf(root);
    const published = sistemas.find(({ record }) => record.borrador !== true);
    const draft =
      sistemas.find(({ record }) => record.borrador === true) ??
      sistemas.find((sistema) => sistema !== published);
    if (draft === undefined) throw new Error('content/sistemas/ needs two pages');
    writeFileSync(draft.file, JSON.stringify({ ...draft.record, borrador: true }, null, 2));
    const others = published === undefined ? [] : [entry(`/sistemas/${published.record.id}/`)];

    writeDestacados(
      root,
      documentOf([entry(`/sistemas/${draft.record.id}/`), ...others, entry('/pokedex/')]),
    );
    expect(errorsOf(root)).toEqual([
      `content/destacados.json · destacados[0].ruta · /sistemas/${draft.record.id}/ es la página ` +
        'de un sistema en borrador, que OCULTAR_BORRADORES=1 no escribe: marca también este ' +
        'destacado con "borrador": true o publica el sistema',
    ]);

    // A draft entry is hidden with the page it leads to.
    writeDestacados(
      root,
      documentOf([entry(`/sistemas/${draft.record.id}/`, { borrador: true }), ...others]),
    );
    expect(errorsOf(root)).toEqual([]);
  });

  it('reports a repeated route (G10) and a sprite missing from the registry', () => {
    const root = copyRepo();
    writeDestacados(
      root,
      documentOf([
        entry('/pokedex/'),
        entry('/pokedex/tiers/', { sprite: 'ui/nope' }),
        entry('/pokedex/', { etiqueta: { es: 'Todos los Pokémon', en: 'All Pokémon' } }),
      ]),
    );
    expect(errorsOf(root)).toEqual([
      expect.stringMatching(
        /^content\/destacados\.json · destacados\[1\]\.sprite · el sprite "ui\/nope" no existe en public\/sprites\/sprites\.json$/,
      ),
      expect.stringMatching(
        /^content\/destacados\.json · destacados\[2\]\.ruta · ruta repetida: "\/pokedex\/" \(también en destacados\[0\]\)$/,
      ),
    ]);
  });

  it('reports a malformed route once, through the schema, and a fifth entry', () => {
    const root = copyRepo();
    writeDestacados(root, documentOf([entry('/pokedex')]));
    expect(errorsOf(root)).toEqual([
      expect.stringMatching(
        /^content\/destacados\.json · destacados\[0\]\.ruta · "\/pokedex" no tiene el formato esperado$/,
      ),
    ]);

    const routes = ['/pokedex/', '/pokedex/tiers/', '/items/', '/comercio/', '/sistemas/'];
    writeDestacados(root, documentOf(routes.map((ruta) => entry(ruta))));
    expect(errorsOf(root)).toEqual([
      expect.stringMatching(
        /^content\/destacados\.json · destacados · admite como máximo 4 elemento\(s\)$/,
      ),
    ]);
  });

  it('accepts a repository without the file and asks for "$schema" in the file', () => {
    const root = copyRepo();
    // The owner's file may already be missing (§3.13).
    rmSync(path.join(root, 'content', 'destacados.json'), { force: true });
    const result = checkContent(root);
    expect(result.errors).toEqual([]);
    expect(result.summary.map((row: { file: string }) => row.file)).not.toContain(
      'content/destacados.json',
    );

    writeDestacados(root, { destacados: [entry()] });
    expect(errorsOf(root)).toEqual([
      expect.stringMatching(
        /^content\/destacados\.json · {2}· falta "\$schema": "\.\/schemas\/destacados\.schema\.json"$/,
      ),
    ]);
  });
});
