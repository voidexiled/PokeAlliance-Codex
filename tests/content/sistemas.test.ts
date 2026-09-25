// System pages (spec 3.13, 8.4): the JSON Schema of content/sistemas/<id>.json
// and the block-by-block checks of `pnpm content:check`.
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

import { checkContent } from '../../scripts/content/lib/check-content.mjs';
import { validateSchema } from '../../scripts/content/lib/json-schema.mjs';
import { copyPublicForCheck } from './public-copy';

type Json = Record<string, unknown>;

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const readJson = (file: string) => JSON.parse(readFileSync(path.join(repoRoot, file), 'utf8'));
const schema = readJson('content/schemas/sistemas.schema.json');
const sistemaFiles = readdirSync(path.join(repoRoot, 'content', 'sistemas')).filter((name) =>
  name.endsWith('.json'),
);

/** A `Texto`: the same string in both languages. */
const t = (value: string) => ({ es: value, en: value });
/** A block text: the same pieces in both languages, as two arrays. */
const inline = (pieces: unknown[]) => ({ es: pieces, en: structuredClone(pieces) });

/** A record that uses every block type, every inline form and every cell form. */
function fullRecord(id = 'boost'): Json {
  return {
    $schema: '../schemas/sistemas.schema.json',
    id,
    titulo: t('Boost'),
    subtitulo: { es: '(Potenciación)', en: '(Enhancement)' },
    sprite: 'ui/diamond',
    orden: 1,
    tooltip: [{ etiqueta: { es: 'Límite:', en: 'Limit:' }, valor: t('+50') }],
    intro: [
      {
        tipo: 'parrafo',
        texto: inline(['Se aplica con ', { entidad: { tipo: 'item', id: 'fire-stone' } }, '.']),
      },
    ],
    banner: { sprite: 'ui/diamond', datos: { es: ['Límite: +50'], en: ['Limit: +50'] } },
    secciones: [
      {
        id: 'uno',
        titulo: { es: 'Uno', en: 'One' },
        bloques: [
          {
            tipo: 'parrafo',
            texto: inline([
              'Mira ',
              { ancla: 'dos', texto: 'dos' },
              ', ',
              { ruta: '/pokedex/tiers/', texto: 'Tier list' },
              ', ',
              { entidad: { tipo: 'pokemon', id: 'charizard' }, texto: 'Charizard' },
              ', ',
              { entidad: { tipo: 'sistema', id: 'helds' } },
              ', ',
              { pd: 150000 },
              ' y ',
              { dia: 20 },
              '.',
            ]),
          },
          { tipo: 'subtitulo', texto: { es: 'Detalle', en: 'Detail' } },
          {
            tipo: 'pasos',
            pasos: [
              { sprite: null, texto: inline(['Consigue la piedra.']) },
              { sprite: 'ui/diamond', texto: inline(['Úsala.']), chips: [inline(['+1 de Boost'])] },
            ],
          },
          {
            tipo: 'tabla',
            caption: t('Stones por elemento'),
            columnas: [
              { titulo: t('Elemento'), ancho: 150 },
              { titulo: t('Stone'), ancho: 210, conSprite: true },
              { titulo: t('Cantidad') },
            ],
            filas: [
              [{ elemento: 'fire' }, inline([{ entidad: { tipo: 'item', id: 'fire-stone' } }]), 12],
              [{ elemento: 'water' }, null, 2.5],
            ],
            variasLineas: true,
          },
          { tipo: 'nota', texto: inline(['el sistema antiguo ya no existe.']) },
        ],
      },
      {
        id: 'dos',
        titulo: { es: 'Dos', en: 'Two' },
        bloques: [
          {
            tipo: 'tarjetas',
            tarjetas: [
              { titulo: t('Si acierta'), sprite: null, texto: inline(['Gana +1.']) },
              { titulo: t('Si falla'), sprite: 'ui/diamond', texto: inline(['No pierde nada.']) },
            ],
          },
          {
            tipo: 'chips',
            etiqueta: { es: 'Ejemplo con una piedra de 20%:', en: 'Example with a 20% stone:' },
            chips: [inline(['1.er intento: 20%']), inline([{ pd: 1000 }])],
          },
          {
            tipo: 'lista',
            puntos: [
              inline(['que es la Poké Ball correcta;']),
              inline([{ ruta: '/sistemas/helds/', texto: 'Held Items' }, '.']),
            ],
          },
        ],
      },
    ],
  };
}

type SystemRecord = ReturnType<typeof fullRecord> & {
  secciones: { bloques: Json[] }[];
  intro: Json[];
};
const firstBlock = (record: SystemRecord) => record.secciones[0].bloques[0] as Json;
const firstText = (record: SystemRecord) => (firstBlock(record).texto as { es: unknown[] }).es;
const table = (record: SystemRecord) => record.secciones[0].bloques[3] as Json;

describe('sistemas.schema.json', () => {
  it('accepts every file of content/sistemas/', () => {
    expect(sistemaFiles.length).toBeGreaterThan(0);
    for (const name of sistemaFiles)
      expect(validateSchema(readJson(`content/sistemas/${name}`), schema), name).toEqual([]);
  });

  it('accepts every block type, inline form and cell form', () => {
    expect(validateSchema(fullRecord(), schema)).toEqual([]);
    const record = fullRecord() as SystemRecord;
    delete record.subtitulo;
    delete record.banner;
    record.borrador = true;
    expect(validateSchema(record, schema)).toEqual([]);
  });

  it('names the 18 elements of elementos.schema.json, in order', () => {
    const slots = readJson('content/schemas/elementos.schema.json').properties.elementos
      .prefixItems as { properties: { id: { const: string } } }[];
    expect(schema.$defs.elemento.enum).toEqual(slots.map((slot) => slot.properties.id.const));
  });

  // Each case breaks one thing of a valid record; the schema must reject it.
  const broken: [string, (record: SystemRecord) => void][] = [
    ['an unknown block', (r) => (r.secciones[0].bloques[0] = { tipo: 'video', texto: t('x') })],
    ['a block without tipo', (r) => (r.secciones[0].bloques[0] = { texto: inline(['x']) })],
    ['a block with an extra field', (r) => (firstBlock(r).lang = 'en')],
    ['a block text as a plain Texto', (r) => (firstBlock(r).texto = t('x'))],
    ['a block text without en', (r) => (firstBlock(r).texto = { es: ['x'] })],
    ['a block text with no pieces', (r) => (firstBlock(r).texto = { es: [], en: ['x'] })],
    ['an inline object of no known form', (r) => (firstText(r)[1] = { enlace: '/x/' })],
    [
      'an inline with two forms',
      (r) => (firstText(r)[1] = { ancla: 'dos', ruta: '/x/', texto: 'y' }),
    ],
    ['an empty inline string', (r) => (firstText(r)[0] = '')],
    ['an inline number', (r) => (firstText(r)[0] = 5)],
    ['an anchor that is not a slug', (r) => (firstText(r)[1] = { ancla: 'Dos', texto: 'dos' })],
    ['an anchor with #', (r) => (firstText(r)[1] = { ancla: '#dos', texto: 'dos' })],
    ['an anchor without texto', (r) => (firstText(r)[1] = { ancla: 'dos' })],
    ['a route without leading slash', (r) => (firstText(r)[3] = { ruta: 'pokedex/', texto: 'x' })],
    ['a route without final slash', (r) => (firstText(r)[3] = { ruta: '/pokedex', texto: 'x' })],
    ['a route with a fragment', (r) => (firstText(r)[3] = { ruta: '/pokedex/#a', texto: 'x' })],
    [
      'an entity of unknown tipo',
      (r) => (firstText(r)[5] = { entidad: { tipo: 'mapa', id: 'x' } }),
    ],
    ['an entity without id', (r) => (firstText(r)[5] = { entidad: { tipo: 'item' } })],
    [
      'an entity with empty texto',
      (r) => (firstText(r)[5] = { entidad: { tipo: 'item', id: 'x' }, texto: '' }),
    ],
    ['an amount as text', (r) => (firstText(r)[9] = { pd: '60kk' })],
    ['a fractional amount', (r) => (firstText(r)[9] = { pd: 1.5 })],
    ['a zero amount', (r) => (firstText(r)[11] = { dia: 0 })],
    ['an amount with a label', (r) => (firstText(r)[9] = { pd: 1000, texto: '1k' })],
    [
      'a subtitle of spaces',
      (r) => (r.secciones[0].bloques[1] = { tipo: 'subtitulo', texto: t(' ') }),
    ],
    [
      'a step without sprite',
      (r) => delete (r.secciones[0].bloques[2] as { pasos: Json[] }).pasos[0].sprite,
    ],
    ['steps without steps', (r) => ((r.secciones[0].bloques[2] as Json).pasos = [])],
    ['a table without caption', (r) => delete table(r).caption],
    ['a table without rows', (r) => (table(r).filas = [])],
    ['a string cell', (r) => ((table(r).filas as unknown[][])[0][2] = '12')],
    [
      'a cell of an unknown element',
      (r) => ((table(r).filas as unknown[][])[0][0] = { elemento: 'lava' }),
    ],
    ['a column without titulo', (r) => ((table(r).columnas as Json[])[2] = { ancho: 10 })],
    ['a note with a lead', (r) => (r.secciones[0].bloques[4].lead = t('Nota:'))],
    ['a single card', (r) => (r.secciones[1].bloques[0].tarjetas as unknown[]).pop()],
    [
      'a card without sprite',
      (r) => delete (r.secciones[1].bloques[0].tarjetas as Json[])[0].sprite,
    ],
    ['a chips label without colon', (r) => (r.secciones[1].bloques[1].etiqueta = t('Ejemplo'))],
    ['plain strings in a list', (r) => (r.secciones[1].bloques[2].puntos = ['uno'])],
    ['a list block in intro', (r) => (r.intro[0] = r.secciones[1].bloques[2])],
    ['a section without blocks', (r) => (r.secciones[0].bloques = [])],
    ['a section id that is not a slug', (r) => ((r.secciones[0] as Json).id = 'Cómo aplicar')],
    [
      'five banner facts',
      (r) => ((r.banner as { datos: Json }).datos.es = ['a', 'b', 'c', 'd', 'e']),
    ],
    ['a banner without sprite', (r) => delete (r.banner as Json).sprite],
    ['a tooltip value without en', (r) => ((r.tooltip as Json[])[0].valor = { es: '+50' })],
    ['borrador false', (r) => (r.borrador = false)],
    ['orden 0', (r) => (r.orden = 0)],
    ['a missing sprite key', (r) => delete r.sprite],
    ['a provenance field', (r) => (r.fuente = 'wiki')],
  ];

  it.each(broken)('rejects %s', (_, change) => {
    const record = fullRecord() as SystemRecord;
    change(record);
    expect(validateSchema(JSON.parse(JSON.stringify(record)), schema).length).toBeGreaterThan(0);
  });

  it('reports a malformed block at its own path', () => {
    const record = fullRecord() as SystemRecord;
    record.secciones[1].bloques[0] = { tipo: 'video' };
    (firstText(record) as unknown[])[1] = { enlace: '/x/' };
    expect(validateSchema(record, schema)).toEqual([
      { path: 'secciones[0].bloques[0].texto.es[1]', message: 'no se permite este valor' },
      {
        path: 'secciones[1].bloques[0].tipo',
        message: expect.stringMatching(/^debe ser uno de: "parrafo", "subtitulo", "pasos"/),
      },
    ]);
  });
});

describe('pnpm content:check on content/sistemas/', () => {
  const scratch = mkdtempSync(path.join(tmpdir(), 'content-sistemas-'));
  afterAll(() => rmSync(scratch, { recursive: true, force: true }));

  function copyRepo() {
    const root = path.join(scratch, `repo-${Math.random().toString(36).slice(2)}`);
    cpSync(path.join(repoRoot, 'content'), path.join(root, 'content'), { recursive: true });
    copyPublicForCheck(repoRoot, root);
    return root;
  }
  const write = (root: string, id: string, record: Json) =>
    writeFileSync(
      path.join(root, 'content', 'sistemas', `${id}.json`),
      JSON.stringify(record, null, 2),
    );
  const read = (root: string, id: string): SystemRecord =>
    JSON.parse(readFileSync(path.join(root, 'content', 'sistemas', `${id}.json`), 'utf8'));
  const errorsOf = (root: string) =>
    checkContent(root).errors.map(
      (entry: { file: string; path?: string; message: string }) =>
        `${entry.file} · ${entry.path ?? ''} · ${entry.message}`,
    );

  it('passes on the repository: boost published, the other systems as drafts', () => {
    const result = checkContent(repoRoot);
    expect(result.errors).toEqual([]);
    const records = sistemaFiles.map((name) => readJson(`content/sistemas/${name}`));
    expect(result.summary).toContainEqual({
      file: 'content/sistemas/',
      registros: `${records.length} sistemas`,
      borradores: records.length - 1,
    });
    expect(records.filter((record) => record.borrador !== true).map((record) => record.id)).toEqual(
      ['boost'],
    );
    for (const [index, name] of sistemaFiles.entries())
      expect(records[index].id).toBe(path.basename(name, '.json'));
    // A draft carries its menu title, its sprite and the rows of its tooltip (D-011, D-031),
    // and no page body yet.
    for (const record of records.filter((entry) => entry.borrador === true)) {
      expect(record).toMatchObject({ intro: [], secciones: [] });
      expect(record.tooltip.length, record.id).toBeGreaterThan(0);
    }
  });

  it('accepts links, entities, amounts, element cells and the item anchors of a system', () => {
    const root = copyRepo();
    write(root, 'boost', fullRecord());
    // punching-bag-training owns «Normal charger» in content/system-items.json:
    // its page has the «Ítems» section and one anchor per item (8.4.2, H7).
    write(root, 'punching-bag-training', {
      ...read(root, 'punching-bag-training'),
      borrador: undefined,
      intro: [
        {
          tipo: 'parrafo',
          texto: inline([
            'Carga el Punching Bag con ',
            { ancla: 'item-normal-training-charger', texto: 'Normal charger' },
            '; ',
            { ancla: 'items', texto: 'ítems' },
            '. Ver ',
            { ruta: '/items/c/stones/', texto: 'Stones' },
            ', ',
            { ruta: '/pokedex/charizard/', texto: 'Charizard' },
            ', ',
            { ruta: '/', texto: 'Inicio' },
            '. 10 kills, 150 niveles, Nivel 200, T1 a T7, 50 / 100 / 200, 20%.',
          ]),
        },
      ],
    });
    expect(errorsOf(root)).toEqual([]);
  });

  it('reports every broken system page in Spanish, block by block', () => {
    const root = copyRepo();
    const boost = fullRecord();
    const record = boost as SystemRecord;
    record.id = 'potenciacion';
    record.sprite = 'ui/nope';
    (record.banner as { datos: Json }).datos = { es: ['a', 'b'], en: ['a'] };
    (record.tooltip as Json[])[0].valor = t('20 Diamonds');
    const text = firstText(record);
    text[1] = { ancla: 'nada', texto: 'nada' };
    text[3] = { ruta: '/es/pokedex/', texto: 'Pokédex' };
    text[5] = { entidad: { tipo: 'item', id: 'no-such-item' } };
    text[7] = { entidad: { tipo: 'sistema', id: 'nada' } };
    text[12] = ' cuesta 60kk.';
    (firstBlock(record).texto as { en: unknown[] }).en = text.map((piece, index) =>
      index === 9 ? { pd: 15000 } : piece,
    );
    (table(record).filas as unknown[][])[1].pop();
    record.secciones[0].bloques.push({ tipo: 'nota', texto: inline(['otra nota.']) });
    record.secciones[1].bloques[2].puntos = [
      inline([{ ruta: '/foros/', texto: 'Foros' }]),
      inline([{ ruta: '/pokedex/missingno/', texto: 'MissingNo.' }]),
      inline(['Precio: 5.000 Pokédólares']),
    ];
    record.secciones.push({ id: 'items', titulo: t('Ítems'), bloques: [] } as never);
    record.secciones.push({ ...record.secciones[1] } as never);
    write(root, 'boost', boost);
    write(root, 'helds', { ...read(root, 'helds'), orden: 1 });
    write(root, 'prey', { ...read(root, 'prey'), borrador: undefined });

    const messages = errorsOf(root);
    const expected = [
      /boost\.json · id · el id debe ser igual al nombre del archivo: "boost"/,
      /helds\.json · orden · orden 1 repetido \(también en content\/sistemas\/boost\.json\)/,
      /boost\.json · sprite · el sprite "ui\/nope" no existe/,
      /boost\.json · banner\.datos · el banner tiene 2 datos en es y 1 en en/,
      /boost\.json · secciones\[2\]\.id · "items" es un id reservado de la página/,
      /boost\.json · secciones\[2\]\.bloques · necesita al menos 1 elemento/,
      /boost\.json · secciones\[3\]\.id · sección repetida: "dos"/,
      /secciones\[0\]\.bloques\[0\]\.texto\.es\[1\]\.ancla · el ancla "#nada" no es una sección de esta página/,
      /secciones\[0\]\.bloques\[0\]\.texto\.es\[3\]\.ruta · la ruta va sin idioma: "\/pokedex\/"/,
      /secciones\[0\]\.bloques\[0\]\.texto\.es\[5\]\.entidad\.id · "no-such-item" no existe en content\/items\//,
      /secciones\[0\]\.bloques\[0\]\.texto\.es\[7\]\.entidad\.id · "nada" no existe en content\/sistemas\//,
      /secciones\[0\]\.bloques\[0\]\.texto · es y en deben nombrar las mismas entidades, enlaces e importes \(es: .*pd 150000.*; en: .*pd 15000[,;)]/,
      /secciones\[0\]\.bloques\[0\]\.texto\.es\[12\] · importe del juego en texto libre \(«60kk»\)/,
      /secciones\[0\]\.bloques\[3\]\.filas\[1\] · la fila tiene 2 celdas y la tabla 3 columnas/,
      /secciones\[0\]\.bloques\[5\] · una sección lleva como mucho una nota/,
      /secciones\[1\]\.bloques\[2\]\.puntos\[0\]\.es\[0\]\.ruta · la ruta \/foros\/ no es una página del sitio/,
      /secciones\[1\]\.bloques\[2\]\.puntos\[1\]\.es\[0\]\.ruta · "missingno" no existe en content\/pokemon\.json/,
      /secciones\[1\]\.bloques\[2\]\.puntos\[2\]\.es\[0\] · importe del juego en texto libre \(«5\.000 Pokédólares»\)/,
      /tooltip\[0\]\.valor\.es · importe del juego en texto libre \(«20 Diamonds»\)/,
      /prey\.json · {2}· un sistema publicado necesita "intro", "banner" o "secciones"/,
    ];
    for (const pattern of expected)
      expect(
        messages.some((line) => pattern.test(line)),
        `${pattern}\n${messages.join('\n')}`,
      ).toBe(true);
    // Each problem is reported once, in the file that has it.
    expect(messages.filter((line) => /«60kk»/.test(line))).toHaveLength(2);
    expect(
      messages.every((line) => /^content\/sistemas\/(boost|helds|prey)\.json/.test(line)),
    ).toBe(true);
  });

  it('reports an unknown block through the schema, at the block', () => {
    const root = copyRepo();
    const record = read(root, 'boost');
    record.secciones[1].bloques[0] = { tipo: 'video', texto: t('x') };
    write(root, 'boost', record);
    expect(errorsOf(root)).toEqual([
      expect.stringMatching(
        /^content\/sistemas\/boost\.json · secciones\[1\]\.bloques\[0\]\.tipo · debe ser uno de: "parrafo"/,
      ),
    ]);
  });

  it('resolves the sprite and the system page of each system item (E16)', () => {
    const root = copyRepo();
    const file = path.join(root, 'content', 'system-items.json');
    const data = JSON.parse(readFileSync(file, 'utf8'));
    const [first] = data.objetos;
    data.objetos = [
      { ...first, sprite: 'items/nope' },
      { ...first, id: 'otro-cargador', sistema: 'nada' },
    ];
    writeFileSync(file, JSON.stringify(data, null, 2));
    expect(errorsOf(root)).toEqual([
      expect.stringMatching(
        /^content\/system-items\.json · objetos\[0\]\.sprite · el sprite "items\/nope" no existe/,
      ),
      expect.stringMatching(
        /^content\/system-items\.json · objetos\[1\]\.sistema · "nada" no existe en content\/sistemas\//,
      ),
    ]);
  });

  it('keeps the element list of sistemas.schema.json equal to elementos.schema.json', () => {
    const root = copyRepo();
    const file = path.join(root, 'content', 'schemas', 'sistemas.schema.json');
    const edited = JSON.parse(readFileSync(file, 'utf8'));
    edited.$defs.elemento.enum.reverse();
    writeFileSync(file, JSON.stringify(edited, null, 2));
    expect(errorsOf(root)).toContainEqual(
      expect.stringMatching(
        /sistemas\.schema\.json · \$defs\.elemento\.enum · la lista de "elemento"/,
      ),
    );
  });
});
