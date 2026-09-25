// Activities (spec 3.13, 8.9): the JSON Schema of content/quests.json and its Zod mirror, with
// the optional `sprite` and the texts by language (`Texto`), the `textIn` that gives a page the
// text of its language or the other one with its `lang` (T22, WA4), and the checks of
// `pnpm content:check` on the activities.
//
// content/quests.json is the owner's (D-011). Nothing here depends on what it holds today: the
// real file is only checked against the rules every valid file follows, and each case of
// `pnpm content:check` writes its own synthetic activity into a copy of the registries.
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

import { locales } from '@/i18n/config';
import { questsFileSchema, textIn, type Quest, type QuestText } from '@/lib/content/content-schema';
import { checkContent } from '../../scripts/content/lib/check-content.mjs';
import { validateSchema } from '../../scripts/content/lib/json-schema.mjs';
import { copyPublicForCheck } from './public-copy';

type Json = Record<string, unknown>;

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const readJson = (file: string) => JSON.parse(readFileSync(path.join(repoRoot, file), 'utf8'));
const schema = readJson('content/schemas/quests.schema.json');
const file: { misiones: Quest[] } = readJson('content/quests.json');

/** Every text of an activity: the ones its page draws (8.9.2 steps 3 and 5). */
function textsOf(quest: Quest): QuestText[] {
  return [
    quest.resumen,
    quest.instrucciones,
    ...quest.requisitos,
    ...quest.pasos,
    ...quest.recompensas,
    ...quest.notas,
  ].filter((texto): texto is QuestText => texto !== null);
}

/** A synthetic activity with every required field. */
const activity = (overrides: Json = {}): Json => ({
  id: 'actividad-de-prueba',
  nombre: 'Test Quest',
  nivelRequerido: 10,
  resumen: { es: 'Resumen de prueba.', en: 'Test summary.' },
  instrucciones: null,
  requisitos: [{ en: 'Test requirement' }],
  pasos: [{ es: 'Paso de prueba', en: 'Test step' }, { en: 'Second test step' }],
  recompensas: [{ en: '10 Test Ball' }],
  npcs: ['Test NPC'],
  lugares: [],
  pokemon: [],
  sistemas: [],
  notas: [],
  ...overrides,
});
const documentOf = (misiones: unknown[]) => ({ $schema: './schemas/quests.schema.json', misiones });

describe('quests.schema.json and its Zod mirror', () => {
  const accepts = (data: unknown) => {
    expect(validateSchema(data, schema), JSON.stringify(data)).toEqual([]);
    expect(questsFileSchema.safeParse(data).success, JSON.stringify(data)).toBe(true);
  };
  const rejects = (data: unknown) => {
    const document = JSON.parse(JSON.stringify(data));
    expect(validateSchema(document, schema).length, JSON.stringify(data)).toBeGreaterThan(0);
    expect(questsFileSchema.safeParse(document).success, JSON.stringify(data)).toBe(false);
  };

  it('both accept content/quests.json', () => {
    accepts(file);
  });

  it('both accept a text in both languages, in English only and in Spanish only', () => {
    accepts(documentOf([activity()]));
    accepts(documentOf([activity({ resumen: { en: 'Only in English.' } })]));
    accepts(documentOf([activity({ resumen: { es: 'Solo en español.' } })]));
    accepts(documentOf([activity({ resumen: null, instrucciones: null, requisitos: [] })]));
  });

  it('both accept the optional sprite of §3.13: a key, null or no key at all', () => {
    accepts(documentOf([activity({ sprite: 'ui/diamond' })]));
    accepts(documentOf([activity({ sprite: null })]));
    accepts(documentOf([activity()]));
  });

  // Each case breaks one thing of a valid document; both must reject it.
  const broken: [string, unknown][] = [
    // The shape before §3.13: every text a plain string.
    ['a summary as a plain string', documentOf([activity({ resumen: 'Test summary.' })])],
    ['a step as a plain string', documentOf([activity({ pasos: ['Test step'] })])],
    ['a text with no language', documentOf([activity({ resumen: {} })])],
    ['a text in a third language', documentOf([activity({ notas: [{ pt: 'Nota' }] })])],
    [
      'a text in a third language beside English',
      documentOf([activity({ notas: [{ en: 'Note', pt: 'Nota' }] })]),
    ],
    ['a text of spaces', documentOf([activity({ requisitos: [{ en: '   ' }] })])],
    ['an empty text', documentOf([activity({ recompensas: [{ es: '', en: 'Reward' }] })])],
    ['null inside a list of texts', documentOf([activity({ pasos: [null] })])],
    ['a summary as a list', documentOf([activity({ resumen: [{ en: 'Test summary.' }] })])],
    ['an NPC as a text by language', documentOf([activity({ npcs: [{ en: 'Test NPC' }] })])],
    ['a sprite key with capitals', documentOf([activity({ sprite: 'UI/Diamond' })])],
    ['a sprite path', documentOf([activity({ sprite: 'ui/diamond.png' })])],
    ['a draft activity', documentOf([activity({ borrador: true })])],
    ['a provenance field', documentOf([activity({ fuente: 'wiki' })])],
    [
      'an activity without steps',
      documentOf([
        Object.fromEntries(Object.entries(activity()).filter(([key]) => key !== 'pasos')),
      ]),
    ],
  ];

  it.each(broken)('both reject %s', (_, data) => {
    rejects(data);
  });
});

describe('textIn', () => {
  it('gives each page its own language, with no lang', () => {
    const texto = { es: 'Habla con el NPC', en: 'Speak with the NPC' };
    expect(textIn(texto, 'es')).toEqual({ text: 'Habla con el NPC' });
    expect(textIn(texto, 'en')).toEqual({ text: 'Speak with the NPC' });
  });

  it('gives a text that exists only in English to the Spanish page with lang="en" (T22)', () => {
    const texto = { en: 'Speak with the NPC' };
    expect(textIn(texto, 'es')).toEqual({ text: 'Speak with the NPC', lang: 'en' });
    expect(textIn(texto, 'en')).toEqual({ text: 'Speak with the NPC' });
  });

  it('gives a text that exists only in Spanish to the English page with lang="es"', () => {
    const texto = { es: 'Habla con el NPC' };
    expect(textIn(texto, 'en')).toEqual({ text: 'Habla con el NPC', lang: 'es' });
    expect(textIn(texto, 'es')).toEqual({ text: 'Habla con el NPC' });
  });

  it('fails on a text with no language, which no schema accepts', () => {
    expect(() => textIn({}, 'es')).toThrow(/ningún idioma/);
  });

  it('draws every text of content/quests.json on both pages, marked when it is not the page language (WA4)', () => {
    for (const quest of file.misiones)
      for (const texto of textsOf(quest))
        for (const locale of locales) {
          const shown = textIn(texto, locale);
          const written = texto[shown.lang ?? locale];
          expect(written, `${quest.id}: ${JSON.stringify(texto)} on ${locale}`).toBe(shown.text);
          // Marked exactly when the page's own language is missing.
          expect(shown.lang === undefined, `${quest.id} on ${locale}`).toBe(
            texto[locale] !== undefined,
          );
        }
  });
});

describe('pnpm content:check on content/quests.json', () => {
  const scratch = mkdtempSync(path.join(tmpdir(), 'content-quests-'));
  afterAll(() => rmSync(scratch, { recursive: true, force: true }));

  /** A copy of the registries and the sprites (as registry.test.ts). */
  function copyRepo() {
    const root = path.join(scratch, `repo-${Math.random().toString(36).slice(2)}`);
    cpSync(path.join(repoRoot, 'content'), path.join(root, 'content'), { recursive: true });
    copyPublicForCheck(repoRoot, root);
    return root;
  }
  const writeQuests = (root: string, data: unknown) =>
    writeFileSync(path.join(root, 'content', 'quests.json'), JSON.stringify(data, null, 2));
  const errorsOf = (root: string) =>
    checkContent(root).errors.map(
      (problem: { file: string; path?: string; message: string }) =>
        `${problem.file} · ${problem.path ?? ''} · ${problem.message}`,
    );

  it('passes on the repository', () => {
    const result = checkContent(repoRoot);
    expect(result.errors).toEqual([]);
    expect(result.summary).toContainEqual({
      file: 'content/quests.json',
      registros: `${file.misiones.length} ${file.misiones.length === 1 ? 'misión' : 'misiones'}`,
      borradores: null,
    });
  });

  it('checks the sprite of an activity against the sprite registry; null is no sprite yet', () => {
    const [sprite] = Object.keys(readJson('public/sprites/sprites.json').sprites);
    const root = copyRepo();
    writeQuests(
      root,
      documentOf([
        activity({ id: 'a', sprite }),
        activity({ id: 'b', sprite: null }),
        activity({ id: 'c', sprite: 'ui/nope' }),
      ]),
    );
    expect(errorsOf(root)).toEqual([
      'content/quests.json · misiones[2].sprite · el sprite "ui/nope" no existe en public/sprites/sprites.json',
    ]);
  });

  it('refuses a game amount written as free text in any text of an activity (S8)', () => {
    const root = copyRepo();
    writeQuests(
      root,
      documentOf([
        activity({
          resumen: { es: 'Entrega 50k al NPC.', en: 'Give 50k to the NPC.' },
          recompensas: [{ en: '5,000,000 experience' }, { en: '2 Diamonds' }],
          notas: [{ en: 'Level 200 only.' }],
        }),
      ]),
    );
    const refused = (at: string, amount: string) =>
      `content/quests.json · ${at} · importe del juego en texto libre («${amount}»): el texto de una actividad no lleva importes, porque el sitio muestra cada importe del juego con el sprite de su moneda`;
    expect(errorsOf(root)).toEqual([
      refused('misiones[0].resumen.es', '50k'),
      refused('misiones[0].resumen.en', '50k'),
      refused('misiones[0].recompensas[1].en', '2 Diamonds'),
    ]);
  });

  it('reports a text in the shape before §3.13 through the schema, with its path', () => {
    const root = copyRepo();
    writeQuests(root, documentOf([activity({ pasos: ['Test step'] })]));
    expect(errorsOf(root)).toEqual([
      'content/quests.json · misiones[0].pasos[0] · se esperaba object y hay "Test step"',
    ]);
  });

  it('walks every text field of the schema, and none of the names', () => {
    // The texts of an activity are the fields whose value is a text or a list of texts (8.9);
    // `nombre`, `npcs`, `lugares`, `pokemon` and `sistemas` are names of the game.
    const properties = schema.$defs.mision.properties as Record<string, { $ref?: string }>;
    const fields = Object.entries(properties).flatMap(([key, value]) =>
      value.$ref === '#/$defs/textoONulo'
        ? [{ key, list: false }]
        : value.$ref === '#/$defs/textos'
          ? [{ key, list: true }]
          : [],
    );
    expect(fields.map(({ key }) => key)).toEqual([
      'resumen',
      'instrucciones',
      'requisitos',
      'pasos',
      'recompensas',
      'notas',
    ]);

    const root = copyRepo();
    const paid = { en: 'Pay 50k' };
    writeQuests(
      root,
      documentOf([
        activity({
          ...Object.fromEntries(fields.map(({ key, list }) => [key, list ? [paid] : paid])),
          npcs: ['Pay 50k'],
        }),
      ]),
    );
    expect(errorsOf(root).map((line) => line.split(' · ')[1])).toEqual(
      fields.map(({ key, list }) => `misiones[0].${key}${list ? '[0]' : ''}.en`),
    );
  });
});
