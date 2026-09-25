// The tier hierarchy of PokeAlliance (spec 16.2.1): the JSON Schema of content/tiers.json, its
// Zod mirror, the client-safe readers of src/lib/content/tiers.ts and the checks of
// `pnpm content:check`.
//
// content/tiers.json is fixed shape but owner-filled data (D-011): the 12 ids and their order
// never change, `maxBrokes` and `visible` do. So the schema/Zod section measures synthetic
// documents built from the fixed id list, and only the content:check section touches the real
// file (through a copy, never in place).
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

import { tierIds, tiersFileSchema, type TierRecord } from '@/lib/content/registry-schema';
import { tierInfo, visibleTiers } from '@/lib/content/tiers';
import { checkContent } from '../../scripts/content/lib/check-content.mjs';
import { validateSchema } from '../../scripts/content/lib/json-schema.mjs';
import { copyPublicForCheck } from './public-copy';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const readJson = (file: string) => JSON.parse(readFileSync(path.join(repoRoot, file), 'utf8'));
const schema = readJson('content/schemas/tiers.schema.json');

/** Canonical game name of each fixed id, exactly as tier-rank.ts and the real file spell it. */
const NOMBRE: Record<string, string> = {
  ultimate: 'ULTIMATE',
  mythic: 'Mythic',
  legendary: 'Legendary',
  'ultra-rare': 'Ultra Rare',
  'super-rare': 'Super Rare',
  t1: 'T1',
  t2: 'T2',
  t3: 'T3',
  t4: 'T4',
  t5: 'T5',
  t6: 'T6',
  t7: 'T7',
};

/** A valid 12-record array, best (ULTIMATE) first, ULTIMATE hidden as it is today. */
const validTiers = (): TierRecord[] =>
  tierIds.map((id, index) => ({
    id,
    nombre: NOMBRE[id],
    orden: index + 1,
    maxBrokes: null,
    visible: id !== 'ultimate',
  }));
const documentOf = (tiers: unknown[]) => ({ $schema: './schemas/tiers.schema.json', tiers });

describe('tiers.schema.json and its Zod mirror', () => {
  const accepts = (data: unknown) => {
    expect(validateSchema(data, schema), JSON.stringify(data)).toEqual([]);
    expect(tiersFileSchema.safeParse(data).success, JSON.stringify(data)).toBe(true);
  };
  const rejects = (data: unknown) => {
    expect(validateSchema(data, schema).length, JSON.stringify(data)).toBeGreaterThan(0);
    expect(tiersFileSchema.safeParse(data).success, JSON.stringify(data)).toBe(false);
  };

  it('both accept the 12 fixed tiers in order, ULTIMATE hidden', () => {
    accepts(documentOf(validTiers()));
  });

  it('both accept a maxBrokes the owner has filled', () => {
    const tiers = validTiers();
    tiers[5] = { ...tiers[5], maxBrokes: 40 };
    accepts(documentOf(tiers));
  });

  it('both accept ULTIMATE made visible again', () => {
    const tiers = validTiers();
    tiers[0] = { ...tiers[0], visible: true };
    accepts(documentOf(tiers));
  });

  // Each case breaks one thing of a valid document; both must reject it.
  const broken: [string, unknown][] = [
    ['11 tiers, one short', documentOf(validTiers().slice(0, 11))],
    ['13 tiers', documentOf([...validTiers(), { ...validTiers()[11], id: 'extra' }])],
    [
      'the wrong tier at a position',
      documentOf(
        validTiers().map((tier, index) => (index === 1 ? { ...tier, id: 'legendary' } : tier)),
      ),
    ],
    [
      'an id outside the 12',
      documentOf(validTiers().map((tier, index) => (index === 0 ? { ...tier, id: 'apex' } : tier))),
    ],
    [
      'a tier without nombre',
      documentOf(
        validTiers().map((tier, index) => {
          if (index !== 0) return tier;
          const clone: Record<string, unknown> = { ...tier };
          delete clone.nombre;
          return clone;
        }),
      ),
    ],
    [
      'an empty nombre',
      documentOf(validTiers().map((tier, index) => (index === 0 ? { ...tier, nombre: '' } : tier))),
    ],
    [
      'orden out of range',
      documentOf(validTiers().map((tier, index) => (index === 0 ? { ...tier, orden: 0 } : tier))),
    ],
    [
      'maxBrokes negative',
      documentOf(
        validTiers().map((tier, index) => (index === 5 ? { ...tier, maxBrokes: -1 } : tier)),
      ),
    ],
    [
      'maxBrokes as a string',
      documentOf(
        validTiers().map((tier, index) => (index === 5 ? { ...tier, maxBrokes: '40' } : tier)),
      ),
    ],
    [
      'visible as a string',
      documentOf(
        validTiers().map((tier, index) => (index === 0 ? { ...tier, visible: 'false' } : tier)),
      ),
    ],
    [
      'a field the schema does not take',
      documentOf(validTiers().map((tier, index) => (index === 0 ? { ...tier, orden2: 1 } : tier))),
    ],
    [
      'a provenance field',
      documentOf(
        validTiers().map((tier, index) =>
          index === 0 ? { ...tier, fuente: 'discord del propietario' } : tier,
        ),
      ),
    ],
  ];

  it.each(broken)('both reject %s', (_, data) => {
    const document = JSON.parse(JSON.stringify(data));
    rejects(document);
  });
});

describe('tierInfo and visibleTiers (src/lib/content/tiers.ts)', () => {
  it('lists every visible tier best to worst, ULTIMATE excluded (spec 16.2.1)', () => {
    expect(visibleTiers.map((tier) => tier.id)).toEqual([
      'mythic',
      'legendary',
      'ultra-rare',
      'super-rare',
      't1',
      't2',
      't3',
      't4',
      't5',
      't6',
      't7',
    ]);
    expect(visibleTiers.every((tier) => tier.visible)).toBe(true);
  });

  it('maps every shape a Pokémon\'s "tier" takes to its record', () => {
    expect(tierInfo(1)?.id).toBe('t1');
    expect(tierInfo(7)?.id).toBe('t7');
    expect(tierInfo('Mythic')?.id).toBe('mythic');
    expect(tierInfo('Super Rare')?.id).toBe('super-rare');
    expect(tierInfo('ULTIMATE')?.id).toBe('ultimate');
  });

  it('gives ULTIMATE a record even while it is hidden, so its data stays', () => {
    const ultimate = tierInfo('ULTIMATE');
    expect(ultimate).not.toBeNull();
    expect(ultimate?.visible).toBe(false);
  });

  it('returns null for an empty or unrecognised tier, never invents one', () => {
    expect(tierInfo(null)).toBeNull();
    expect(tierInfo(undefined)).toBeNull();
    expect(tierInfo('')).toBeNull();
    expect(tierInfo('Not A Tier')).toBeNull();
  });
});

describe('pnpm content:check on content/tiers.json', () => {
  const scratch = mkdtempSync(path.join(tmpdir(), 'content-tiers-'));
  afterAll(() => rmSync(scratch, { recursive: true, force: true }));

  function copyRepo() {
    const root = path.join(scratch, `repo-${Math.random().toString(36).slice(2)}`);
    cpSync(path.join(repoRoot, 'content'), path.join(root, 'content'), { recursive: true });
    copyPublicForCheck(repoRoot, root);
    return root;
  }
  const lines = (entries: { file: string; path?: string; message: string }[]) =>
    entries.map((entry) => `${entry.file} · ${entry.path ?? ''} · ${entry.message}`);

  it('passes on the repository and counts the 12 tiers', () => {
    const result = checkContent(repoRoot);
    expect(result.errors).toEqual([]);
    expect(result.summary).toContainEqual({
      file: 'content/tiers.json',
      registros: '12 tiers',
      borradores: null,
    });
  });

  it('reports a Pokémon tier that no longer has a content/tiers.json record', () => {
    const root = copyRepo();
    const file = path.join(root, 'content', 'tiers.json');
    const data = JSON.parse(readFileSync(file, 'utf8')) as { tiers: TierRecord[] };
    // content/pokemon.json has Pokémon at every numeric tier 1…7 today; dropping T7 leaves one
    // of them pointing at a tier that no longer exists, the same way a typo in either file would.
    data.tiers = data.tiers.filter((tier) => tier.id !== 't7');
    writeFileSync(file, JSON.stringify(data, null, 2));
    const messages = lines(checkContent(root).errors);
    expect(messages).toContainEqual(
      expect.stringMatching(
        /^content\/pokemon\.json · pokemon\[\d+\]\.tier · el tier "t7" no existe en content\/tiers\.json$/,
      ),
    );
  });

  it('reports a repeated tier id', () => {
    const root = copyRepo();
    const file = path.join(root, 'content', 'tiers.json');
    const data = JSON.parse(readFileSync(file, 'utf8')) as { tiers: TierRecord[] };
    data.tiers = data.tiers.map((tier) => (tier.id === 't7' ? { ...tier, id: 't6' } : tier));
    writeFileSync(file, JSON.stringify(data, null, 2));
    const messages = lines(checkContent(root).errors);
    expect(messages.some((line) => line.includes('id repetido: "t6"'))).toBe(true);
  });
});
