// The parity data of spec 14.5: the registries the `@content` alias serves with
// VISUAL=1 (tests/visual/content/) and the board fixtures (tests/visual/fixtures/).
// The registries are checked against the same JSON Schemas and the same Zod mirrors
// as content/, because the visual build parses them with the very same loaders.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';

import {
  locationsFileSchema,
  movesFileSchema,
  pokemonFileSchema,
  questsFileSchema,
  rotationsFileSchema,
  systemItemsFileSchema,
} from '@/lib/content/content-schema';
import {
  aurasFileSchema,
  categoriasFileSchema,
  destacadosFileSchema,
  elementosFileSchema,
  itemCategoryIds,
  itemsFileSchema,
  mundosFileSchema,
  outfitsFileSchema,
  sistemaFileSchema,
} from '@/lib/content/registry-schema';
import { validateSchema } from '../../../scripts/content/lib/json-schema.mjs';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const readJson = (file: string) => JSON.parse(readFileSync(path.join(repoRoot, file), 'utf8'));
const parityDir = 'tests/visual/content';
const fixturesDir = 'tests/visual/fixtures';

/** Parity file, the schema it declares and the Zod mirror the build parses it with. */
const FILES: { file: string; schema: string; zod: z.ZodType }[] = [
  { file: 'pokemon.json', schema: 'pokemon', zod: pokemonFileSchema },
  { file: 'moves.json', schema: 'moves', zod: movesFileSchema },
  { file: 'locations.json', schema: 'locations', zod: locationsFileSchema },
  { file: 'quests.json', schema: 'quests', zod: questsFileSchema },
  { file: 'rotations.json', schema: 'rotations', zod: rotationsFileSchema },
  { file: 'system-items.json', schema: 'system-items', zod: systemItemsFileSchema },
  { file: 'auras.json', schema: 'auras', zod: aurasFileSchema },
  { file: 'outfits.json', schema: 'outfits', zod: outfitsFileSchema },
  { file: 'elementos.json', schema: 'elementos', zod: elementosFileSchema },
  { file: 'destacados.json', schema: 'destacados', zod: destacadosFileSchema },
  { file: 'mundos.json', schema: 'mundos', zod: mundosFileSchema },
  { file: 'items/categorias.json', schema: 'categorias', zod: categoriasFileSchema },
  ...itemCategoryIds.map((id) => ({
    file: `items/${id}.json`,
    schema: 'items',
    zod: itemsFileSchema,
  })),
];

const pokemonIds = new Set<string>(
  readJson(`${parityDir}/pokemon.json`).pokemon.map((record: { id: string }) => record.id),
);
const spriteKeys = new Set<string>(
  Object.keys(readJson('public/sprites/sprites.json').sprites as Record<string, unknown>),
);
const itemNames = new Map<string, string>(
  itemCategoryIds.flatMap((id) =>
    readJson(`${parityDir}/items/${id}.json`).items.map(
      (item: { id: string; nombre: string }) => [item.id, item.nombre] as const,
    ),
  ),
);
const itemIds = new Set<string>(itemNames.keys());

describe('registries of the visual build', () => {
  it.each(FILES)('$file passes its JSON Schema and its Zod mirror', ({ file, schema, zod }) => {
    const data = readJson(`${parityDir}/${file}`);
    const declared = path.resolve(path.dirname(path.join(repoRoot, parityDir, file)), data.$schema);

    expect(declared).toBe(path.join(repoRoot, 'content', 'schemas', `${schema}.schema.json`));
    expect(validateSchema(data, readJson(`content/schemas/${schema}.schema.json`))).toEqual([]);
    expect(zod.safeParse(data).error?.issues ?? []).toEqual([]);
  });

  // §14.5: the Pokémon of the Pokédex board, each with the fields of the Pokédex list as
  // content/ writes them — the board's figures for those fields are the registry's — and
  // with the board's §3.13 fields, from the fixture of that board, that the parity
  // registries can hold. What they cannot hold is left out, not invented:
  //  - a drop, an evolution item or an element Stone whose item has no sprite in
  //    public/sprites/sprites.json cannot be an item of the registry (§7.4.1), so only
  //    the items the parity registry has are named;
  //  - the rest of the Charmander family of the ficha board's «Tier list» and «Evolución»:
  //    its four records sort before Charizard (8.0.5), so with them the Pokédex board's
  //    first page, and its Normal and Shiny pages, could not be drawn.
  it('holds the entities of the boards, with the Pokédex fields of content/', () => {
    const parity = readJson(`${parityDir}/pokemon.json`).pokemon;
    const real = new Map(
      readJson('content/pokemon.json').pokemon.map((record: { id: string }) => [record.id, record]),
    );
    const board = readJson(`${fixturesDir}/pokedex.json`);
    const FIELDS = ['nombre', 'numero', 'generacion', 'variante', 'nivel', 'tier', 'funcion'];

    expect(parity.map((record: { id: string }) => record.id)).toEqual(
      readJson(`${fixturesDir}/tarjetas.json`).pokedex,
    );
    for (const record of parity) {
      const own = real.get(record.id) as Record<string, unknown>;
      for (const field of [...FIELDS, 'elementos', 'imagen'])
        expect(record[field]).toEqual(own[field]);

      const drops = board.drops.find((entry: { pokemon: string }) => entry.pokemon === record.id);
      const expected = (drops?.drops ?? [])
        .filter((drop: { item: string }) => itemIds.has(drop.item))
        .map((drop: { item: string; cantidad: unknown }) => ({
          item: drop.item,
          cantidad: drop.cantidad,
        }));
      expect(record.drops ?? []).toEqual(expected);

      const ficha = board.ficha;
      if (ficha.familia.includes(record.id))
        expect(record.elementoMoveset).toBe(ficha.elementoMoveset);
      if (record.id === ficha.pokemon) {
        expect(record.hp).toBe(ficha.hp);
        expect(record.experiencia).toBe(ficha.experiencia);
        expect(record.habilidades).toEqual(ficha.habilidades);
        for (const key of ['hunts', 'linkedTasks', 'equiposNpc'])
          expect(record.donde[key].map((link: { texto: string }) => link.texto)).toEqual(
            ficha.donde[key].map((link: { texto: string }) => link.texto),
          );
      }
    }
  });

  // §3.13 fields of the items (M9): the element and the use the boards give an item the
  // parity registries hold. The fixture of the Pokédex boards carries Fire Stone's; the Stones
  // of the Sistema-Boost table carry the ones of its panels (`tt-st*`), and Heart Stone, which
  // that board gives two elements, has only its use: `elemento` holds one.
  it('gives each item the element and the use of the boards, when the registry can hold them', () => {
    const board = readJson(`${fixturesDir}/pokedex.json`).items as {
      id: string;
      elemento: string | null;
      uso: string | null;
    }[];
    for (const item of board) {
      if (!itemIds.has(item.id)) continue;
      const record = itemCategoryIds
        .flatMap((id) => readJson(`${parityDir}/items/${id}.json`).items)
        .find((entry: { id: string }) => entry.id === item.id);
      expect(record.elemento ?? null, `${item.id}.elemento`).toBe(item.elemento);
      expect(record.uso?.es ?? null, `${item.id}.uso`).toBe(item.uso);
    }
    const stones = readJson(`${parityDir}/items/stones.json`).items as {
      id: string;
      elemento?: string | null;
      uso?: { es: string; en: string } | null;
    }[];
    const elementOf = new Map(stones.map((stone) => [stone.id, stone.elemento ?? null]));
    expect(Object.fromEntries(elementOf)).toEqual({
      'fire-stone': 'fire',
      'heart-stone': null,
      'leaf-stone': 'grass',
      'thunder-stone': 'electric',
      'water-stone': 'water',
    });
    for (const stone of stones) expect(stone.uso?.es, stone.id).toBe('Evolución y craft');
  });

  // §8.1 (M10): the worlds of the Main and Inicio-movil boards, as the board fixture names
  // them. The parity registry holds the name alone (X3, PZ-05): the board's «En línea» figures
  // have no field in content/mundos.json.
  it('holds the worlds of the boards, by id and name', () => {
    const board = readJson(`${fixturesDir}/mundos.json`).mundos as { id: string; nombre: string }[];
    expect(readJson(`${parityDir}/mundos.json`).mundos).toEqual(
      board.map(({ id, nombre }) => ({ id, nombre })),
    );
  });

  it('names the Stone and Fragment of each element as the board does, when the item exists', () => {
    const board = readJson(`${fixturesDir}/tarjetas.json`).elements;
    const byName = new Map([...itemNames].map(([id, nombre]) => [nombre, id]));
    for (const element of readJson(`${parityDir}/elementos.json`).elementos) {
      const named = board[element.id];
      expect(element.stone).toBe(named ? (byName.get(named.stone) ?? null) : null);
      expect(element.fragment).toBe(named ? (byName.get(named.fragment) ?? null) : null);
    }
  });

  it('resolves every reference to a Pokémon, to an item and to a sprite', () => {
    for (const move of readJson(`${parityDir}/moves.json`).movimientos)
      for (const id of move.pokemon) expect(pokemonIds).toContain(id);

    for (const record of readJson(`${parityDir}/pokemon.json`).pokemon) {
      for (const drop of record.drops ?? []) expect(itemIds).toContain(drop.item);
      for (const evolution of record.evolucion ?? []) {
        expect(pokemonIds).toContain(evolution.a);
        for (const item of evolution.items) expect(itemIds).toContain(item.item);
      }
    }

    for (const element of readJson(`${parityDir}/elementos.json`).elementos)
      for (const id of [element.stone, element.fragment])
        if (id !== null) expect(itemIds).toContain(id);

    for (const outfit of readJson(`${parityDir}/outfits.json`).outfits) {
      expect(pokemonIds).toContain(outfit.pokemon);
      expect(spriteKeys).toContain(`outfits/${outfit.outfitId}`);
      for (const addon of outfit.addons) expect(spriteKeys).toContain(addon.sprite);
    }

    for (const aura of readJson(`${parityDir}/auras.json`).auras)
      expect(spriteKeys).toContain(aura.icono);

    for (const categoria of readJson(`${parityDir}/items/categorias.json`).categorias)
      expect(spriteKeys).toContain(categoria.icono);

    for (const destacado of readJson(`${parityDir}/destacados.json`).destacados)
      if (destacado.sprite !== null) expect(spriteKeys).toContain(destacado.sprite);

    for (const id of itemCategoryIds)
      for (const item of readJson(`${parityDir}/items/${id}.json`).items) {
        expect(item.categoria).toBe(id);
        expect(spriteKeys).toContain(item.sprite);
      }
  });
});

// §8.4.2 acceptance: the Boost of the Sistema-Boost board in the shape of the registry, one
// file per system as content/sistemas/ has them. The board mentions entities the parity
// registries cannot hold (an item with no sprite in public/sprites/sprites.json is not an
// item of the registry, §7.4.1): such a mention carries its board name as `texto` and the
// page draws it as text (SI2), so no mention is left without a name.
describe('system pages of the visual build', () => {
  const sistemasDir = `${parityDir}/sistemas`;
  const files = readdirSync(path.join(repoRoot, sistemasDir)).filter((name) =>
    name.endsWith('.json'),
  );
  const records = files.map((name) => readJson(`${sistemasDir}/${name}`));
  const elementIds = new Set<string>(
    readJson(`${parityDir}/elementos.json`).elementos.map((element: { id: string }) => element.id),
  );
  const questIds = new Set<string>(
    readJson(`${parityDir}/quests.json`).misiones.map((quest: { id: string }) => quest.id),
  );

  it('holds the systems of content/sistemas/, in the same order', () => {
    const real = readdirSync(path.join(repoRoot, 'content', 'sistemas'))
      .filter((name) => name.endsWith('.json'))
      .map((name) => readJson(`content/sistemas/${name}`));
    const order = (list: { id: string; orden: number }[]) =>
      [...list].sort((a, b) => a.orden - b.orden).map((record) => record.id);
    expect(order(records)).toEqual(order(real));
  });

  it.each(files)('%s passes sistemas.schema.json and its Zod mirror', (name) => {
    const data = readJson(`${sistemasDir}/${name}`);
    const declared = path.resolve(path.join(repoRoot, sistemasDir), data.$schema);

    expect(declared).toBe(path.join(repoRoot, 'content', 'schemas', 'sistemas.schema.json'));
    expect(data.id).toBe(path.basename(name, '.json'));
    expect(validateSchema(data, readJson('content/schemas/sistemas.schema.json'))).toEqual([]);
    expect(sistemaFileSchema.safeParse(data).error?.issues ?? []).toEqual([]);
  });

  it('resolves every sprite, element and entity it names, or names it itself', () => {
    const sistemaIds = new Set(records.map((record: { id: string }) => record.id));
    const known: Record<string, Set<string>> = {
      pokemon: pokemonIds,
      item: itemIds,
      sistema: sistemaIds,
      actividad: questIds,
    };
    const walk = (value: unknown, at: string): void => {
      if (Array.isArray(value)) {
        value.forEach((child, index) => walk(child, `${at}[${index}]`));
        return;
      }
      if (value === null || typeof value !== 'object') return;
      const node = value as Record<string, unknown>;
      if (typeof node.sprite === 'string')
        expect(spriteKeys, `${at}.sprite`).toContain(node.sprite);
      if (typeof node.elemento === 'string')
        expect(elementIds, `${at}.elemento`).toContain(node.elemento);
      const entity = node.entidad as { tipo: string; id: string } | undefined;
      if (entity !== undefined && !known[entity.tipo]?.has(entity.id))
        expect(node.texto, `${at}: ${entity.tipo}:${entity.id} has no record`).toEqual(
          expect.any(String),
        );
      for (const [key, child] of Object.entries(node)) walk(child, `${at}.${key}`);
    };
    for (const record of records) walk(record, record.id);
  });
});

describe('board fixtures', () => {
  const comercio = readJson(`${fixturesDir}/comercio.json`);
  const mundoIds = new Set<string>(
    readJson(`${fixturesDir}/mundos.json`).mundos.map((mundo: { id: string }) => mundo.id),
  );
  const auraIds = new Set<string>(
    readJson(`${parityDir}/auras.json`).auras.map((aura: { id: string }) => aura.id),
  );
  const anuncioIds = new Set<string>(
    comercio.anuncios.map((anuncio: { id: string }) => anuncio.id),
  );
  const vendedorIds = new Set<string>(
    comercio.vendedores.map((vendedor: { id: string }) => vendedor.id),
  );

  it('resolves every reference of an ad', () => {
    for (const anuncio of comercio.anuncios) {
      expect(vendedorIds).toContain(anuncio.vendedor);
      expect(mundoIds).toContain(anuncio.mundo);
      expect(Date.parse(anuncio.expira)).toBeGreaterThan(Date.parse(anuncio.publicado));
      if (anuncio.pokemon) {
        expect(pokemonIds).toContain(anuncio.pokemon.pokemon);
        if (anuncio.pokemon.aura) expect(auraIds).toContain(anuncio.pokemon.aura);
        if (anuncio.pokemon.ball?.item) expect(itemIds).toContain(anuncio.pokemon.ball.item);
      }
      if (anuncio.item?.item) expect(itemIds).toContain(anuncio.item.item);
    }
  });

  it('names an ad of the set in every board and in every review', () => {
    for (const ids of Object.values(comercio.tableros) as string[][])
      for (const id of ids) expect(anuncioIds).toContain(id);

    for (const vendedor of comercio.vendedores)
      for (const resena of vendedor.resenas) {
        expect(anuncioIds).toContain(resena.anuncio);
        expect(resena.puntuacion).toBeGreaterThanOrEqual(0);
        expect(resena.puntuacion).toBeLessThanOrEqual(5);
      }
  });

  it('keeps the guild cuts weekly cumulative, one per day', () => {
    const { cortes } = readJson(`${fixturesDir}/guild/cortes.json`);
    const date = (corte: { exportedAt: string }) => corte.exportedAt.slice(0, 10);

    expect(new Set(cortes.map(date)).size).toBe(cortes.length);
    for (const [index, corte] of cortes.entries()) {
      expect(corte.members).toHaveLength(25);
      const monday = new Date(`${date(corte)}T00:00:00Z`).getUTCDay() === 1;
      const previous = monday ? undefined : cortes[index - 1];
      if (!previous) continue;
      const before = new Map(
        previous.members.map((member: { name: string }) => [member.name, member]),
      );
      for (const member of corte.members) {
        const past = before.get(member.name) as { dailiesCompleted: number; contribution: number };
        expect(member.dailiesCompleted).toBeGreaterThanOrEqual(past.dailiesCompleted);
        expect(member.contribution).toBeGreaterThanOrEqual(past.contribution);
      }
    }
  });
});

// §12.19: the wiki never says where a number comes from, so no parity file carries
// one of these keys either.
const PROVENANCE = [
  'fuente',
  'fuentes',
  'source',
  'sources',
  'evidencia',
  'verificado',
  'verificadoEl',
  'obtenidoEl',
];

function jsonFiles(dir: string): string[] {
  return readdirSync(path.join(repoRoot, dir), { recursive: true })
    .map((entry) => `${dir}/${String(entry).split(path.sep).join('/')}`)
    .filter((file) => file.endsWith('.json') && statSync(path.join(repoRoot, file)).isFile());
}

function keysIn(value: unknown, found = new Set<string>()): Set<string> {
  if (Array.isArray(value)) for (const item of value) keysIn(item, found);
  else if (value !== null && typeof value === 'object')
    for (const [key, child] of Object.entries(value)) {
      found.add(key);
      keysIn(child, found);
    }
  return found;
}

describe('no provenance', () => {
  it.each([...jsonFiles(parityDir), ...jsonFiles(fixturesDir)])('%s has no source key', (file) => {
    expect([...keysIn(readJson(file))].filter((key) => PROVENANCE.includes(key))).toEqual([]);
  });
});
