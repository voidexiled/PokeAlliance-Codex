import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it, vi } from 'vitest';
import type { z } from 'zod';

import { getPokemonOutfit } from '@/lib/content/outfit-media';
import {
  getAuras,
  getCategorias,
  getElementos,
  getItem,
  getItemIncluidoBorrador,
  getItems,
  getOutfitForPokemon,
  getSistema,
  getSistemaIncluidoBorrador,
  getSistemas,
  getSpriteRegistry,
  hideDrafts,
  withoutDrafts,
} from '@/lib/content/registry';
import {
  locationsFileSchema,
  mapFloorsFileSchema,
  mapMarkersFileSchema,
  movesFileSchema,
  pokemonFileSchema,
  questsFileSchema,
  rotationsFileSchema,
  systemItemsFileSchema,
} from '@/lib/content/content-schema';
import {
  aurasFileSchema,
  categoriasFileSchema,
  elementIds,
  elementosFileSchema,
  itemCategoryIds,
  itemsFileSchema,
  marketCategories,
  outfitsFileSchema,
  spritesFileSchema,
} from '@/lib/content/registry-schema';
import { checkContent, formatReport } from '../../scripts/content/lib/check-content.mjs';
import { validateSchema } from '../../scripts/content/lib/json-schema.mjs';
import { copyPublicForCheck } from './public-copy';

// Several cases copy and parse the whole content tree; inside a full `pnpm run ci` on a busy
// machine one of them passes the default 5 s now and then, while alone they take under 1 s.
vi.setConfig({ testTimeout: 20_000 });

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const readJson = (file: string) => JSON.parse(readFileSync(path.join(repoRoot, file), 'utf8'));
const jsonSchema = (name: string) => readJson(`content/schemas/${name}.schema.json`);

describe('registry loaders', () => {
  it('lists the 14 Market categories in client order, then «Otros»', () => {
    const categorias = getCategorias();
    expect(categorias.map((categoria) => categoria.nombre.es)).toEqual([
      'Todo',
      'Diamantes',
      'Pokémon',
      'Poké Balls',
      'Stones',
      'Helds',
      'Orbs',
      'Creature Items',
      'General Items',
      'Utilities',
      'Addons',
      'Consumable',
      'Foods',
      'Furnitures',
      'Otros',
    ]);
    expect(categorias[0]).toMatchObject({ id: 'todo', virtual: true });
  });

  it('loads items per category and "todo" as every category', () => {
    expect(getItems('stones')).toHaveLength(37);
    expect(
      getItems('stones')
        .slice(0, 5)
        .map((item) => item.nombre),
    ).toEqual(['Fire Stone', 'Heart Stone', 'Leaf Stone', 'Thunder Stone', 'Water Stone']);
    expect(getItems('todo')).toEqual(getItems());
    expect(getItems().length).toBe(
      getCategorias().reduce((total, categoria) => total + getItems(categoria.id).length, 0) -
        getItems('todo').length,
    );
    // One Diamond: the client's item 3028 with the game's gem as its sprite (P3, P4).
    expect(getItem('diamond')).toMatchObject({
      nombre: 'Diamond',
      sprite: 'ui/diamond',
      clientId: 3028,
      mercado: true,
      precioNpc: { vende: null, compra: null },
    });
    expect(getItem('diamond-3028')).toBeUndefined();
    expect(getItems('diamantes')).toHaveLength(1);
  });

  it('reads outfits with their addons and the auras', () => {
    // The placeholder addon «Nombre del addon» is gone (P4): no record has addons yet.
    expect(getOutfitForPokemon('bulbasaur')).toMatchObject({ outfitId: 2, addons: [] });
    expect(getPokemonOutfit('shiny-charizard')).toEqual({
      slug: 'shiny-charizard',
      outfitId: 509,
      width: 64,
      height: 64,
      frames: {
        north: '/sprites/outfits/509/norte.png',
        east: '/sprites/outfits/509/este.png',
        south: '/sprites/outfits/509/sur.png',
        west: '/sprites/outfits/509/oeste.png',
      },
    });
    expect(getPokemonOutfit('shiny-bulbasaur')).toBeNull();
    expect(getAuras().map(({ nombre, shader }) => [nombre, shader])).toEqual([
      ['Alliance', 'outfit_alliance'],
      ['Premier', 'outfit_rainbow'],
      ['Christmas 2024', 'outfit_rainbow'],
      ['Halloween 2025', 'outfit_rainbow'],
      ['Solo Leveling', 'outfit_rainbow'],
      ['Digimon Red Aura', 'outfit_rainbow'],
      ['Killua God Speed', 'outfit_rainbow'],
    ]);
    // The game's current Diamond is the still gem of its Market (P3).
    expect(getSpriteRegistry()['ui/diamond']).toMatchObject({
      frame: [32, 32],
      frames: 1,
      modo: 'estatico',
    });
  });

  it('reads the 18 elements in the order of 8.0.5, with both names', () => {
    const elementos = getElementos();
    expect(elementos.map((elemento) => elemento.id)).toEqual([
      'normal',
      'fire',
      'water',
      'grass',
      'electric',
      'ice',
      'fighting',
      'poison',
      'ground',
      'flying',
      'psychic',
      'bug',
      'rock',
      'ghost',
      'dragon',
      'fairy',
      'dark',
      'steel',
    ]);
    expect(elementos.find((elemento) => elemento.id === 'fire')?.nombre).toEqual({
      es: 'Fuego',
      en: 'Fire',
    });
    expect(elementIds).toEqual(elementos.map((elemento) => elemento.id));
  });

  it('keeps drafts by default and drops them with OCULTAR_BORRADORES', () => {
    expect(hideDrafts({})).toBe(false);
    expect(hideDrafts({ OCULTAR_BORRADORES: '1' })).toBe(true);
    expect(hideDrafts({ OCULTAR_BORRADORES: 'TRUE' })).toBe(true);
    expect(hideDrafts({ OCULTAR_BORRADORES: '0' })).toBe(false);
    const records = [{ id: 'a' }, { id: 'b', borrador: true }, { id: 'c', borrador: false }];
    expect(withoutDrafts(records, false)).toHaveLength(3);
    expect(withoutDrafts(records, true).map((record) => record.id)).toEqual(['a', 'c']);
  });

  it('names a hidden draft only through the readers that include drafts (3.12, SI4)', () => {
    const draftSystem = getSistemas().find((sistema) => sistema.borrador === true);
    // content/items/ has no draft since the «Item de ejemplo» records went (P4): a real item is
    // seen by both readers, and a draft, when there is one, only by the one that includes drafts.
    const draftItem = getItems().find((item) => item.borrador === true);
    const realItem = getItems().find((item) => item.borrador !== true);
    expect(draftSystem, 'content/sistemas/ has a draft').toBeDefined();
    expect(realItem, 'content/items/ has a record').toBeDefined();
    if (draftSystem === undefined || realItem === undefined) return;

    vi.stubEnv('OCULTAR_BORRADORES', '1');
    try {
      expect(getSistema(draftSystem.id)).toBeUndefined();
      expect(getSistemaIncluidoBorrador(draftSystem.id)?.titulo).toEqual(draftSystem.titulo);
      expect(getItem(realItem.id)?.id).toBe(realItem.id);
      expect(getItemIncluidoBorrador(realItem.id)?.id).toBe(realItem.id);
      if (draftItem !== undefined) {
        expect(getItem(draftItem.id)).toBeUndefined();
        expect(getItemIncluidoBorrador(draftItem.id)?.nombre).toBe(draftItem.nombre);
      }
    } finally {
      vi.unstubAllEnvs();
    }
    expect(getSistemaIncluidoBorrador('no-existe')).toBeUndefined();
    expect(getItemIncluidoBorrador('no-existe')).toBeUndefined();
  });
});

describe('JSON Schemas and their Zod mirror', () => {
  const cases: [string, string, z.ZodType][] = [
    ['categorias', 'content/items/categorias.json', categoriasFileSchema],
    ['items', 'content/items/stones.json', itemsFileSchema],
    ['items', 'content/items/poke-balls.json', itemsFileSchema],
    ['outfits', 'content/outfits.json', outfitsFileSchema],
    ['auras', 'content/auras.json', aurasFileSchema],
    ['elementos', 'content/elementos.json', elementosFileSchema],
    ['sprites', 'public/sprites/sprites.json', spritesFileSchema],
    ['pokemon', 'content/pokemon.json', pokemonFileSchema],
    ['moves', 'content/moves.json', movesFileSchema],
    ['quests', 'content/quests.json', questsFileSchema],
    ['locations', 'content/locations.json', locationsFileSchema],
    ['rotations', 'content/rotations.json', rotationsFileSchema],
    ['system-items', 'content/system-items.json', systemItemsFileSchema],
    ['map-markers', 'content/map/markers.json', mapMarkersFileSchema],
    ['map-floors', 'content/map/floors.json', mapFloorsFileSchema],
  ];

  it('both accept the current files', () => {
    for (const [name, file, schema] of cases) {
      const data = readJson(file);
      expect(validateSchema(data, jsonSchema(name)), file).toEqual([]);
      expect(schema.safeParse(data).success, file).toBe(true);
    }
  });

  it('read the Market categories from categorias.schema.json only', () => {
    expect(marketCategories.map((categoria) => categoria.id)).toEqual(
      getCategorias().map((categoria) => categoria.id),
    );
    expect(marketCategories.filter((categoria) => categoria.virtual)).toEqual([
      { id: 'todo', orden: 0, virtual: true },
    ]);
    expect(itemCategoryIds).toEqual(jsonSchema('items').$defs.item.properties.categoria.enum);
  });

  it('both accept the optional Pokémon fields of 3.13 and a move element id', () => {
    const pokemon = readJson('content/pokemon.json').pokemon[0];
    const move = readJson('content/moves.json').movimientos[0];
    const full = {
      ...pokemon,
      hp: 120,
      experiencia: 0,
      drops: [
        { item: 'fire-stone', cantidad: { min: 1, max: 3 } },
        { item: 'water-stone', cantidad: null },
      ],
      evolucion: [{ a: 'ivysaur', nivel: 16, items: [{ item: 'leaf-stone', cantidad: 1 }] }],
      habilidades: ['Cut'],
      donde: {
        hunts: [{ texto: 'Charizard', ref: { tipo: 'pokemon', id: 'charizard' } }],
        linkedTasks: [{ texto: 'Tarea' }],
        equiposNpc: [],
      },
      elementoMoveset: 'grass',
    };
    const documents: [string, z.ZodType, unknown][] = [
      ['pokemon', pokemonFileSchema, { pokemon: [full] }],
      [
        'pokemon',
        pokemonFileSchema,
        { pokemon: [{ ...pokemon, hp: null, elementoMoveset: null }] },
      ],
      ['moves', movesFileSchema, { movimientos: [{ ...move, elemento: 'fire' }] }],
      ['moves', movesFileSchema, { movimientos: [{ ...move, elemento: null }] }],
      // The fields of the game's Pokédex the importer fills (importer_plan.md §2, §3).
      [
        'pokemon',
        pokemonFileSchema,
        {
          pokemon: [
            {
              ...pokemon,
              drops: [{ item: 'fire-stone', cantidad: { min: 2, max: 3 }, probabilidad: 40 }],
              dropsPorZona: {
                wildscape: [
                  { item: 'fire-stone', cantidad: null, probabilidad: null },
                  { item: 'water-stone', cantidad: null, probabilidad: null, muyRaro: true },
                ],
                primal: [],
              },
              movimientos: [
                { movimiento: 'scratch', slot: 'M1', cooldownPve: 12, cooldownPvp: null },
              ],
              efectividad: {
                muyDebil: [],
                debil: ['fire'],
                resiste: ['water'],
                muyResistente: ['grass'],
                inmune: [],
              },
              descripcion: { es: 'Texto del juego.' },
              rapido: true,
              pesado: null,
            },
          ],
        },
      ],
      [
        'moves',
        movesFileSchema,
        {
          movimientos: [
            {
              ...move,
              alcance: 'area',
              efectos: ['damage', 'paralyze'],
              descripcion: { en: 'Game text.' },
              icono: null,
            },
          ],
        },
      ],
    ];
    for (const [name, schema, data] of documents) {
      expect(validateSchema(data, jsonSchema(name)), JSON.stringify(data)).toEqual([]);
      expect(schema.safeParse(data).success, JSON.stringify(data)).toBe(true);
    }
  });

  it('both accept the item fields of 3.13, `elemento` and `uso`, missing or null (M9)', () => {
    // The mirror reads the element ids of an item from items.schema.json, and that list is
    // the one of elementos.schema.json, in its order (content:check keeps them equal).
    expect(jsonSchema('items').$defs.elemento.enum).toEqual(elementIds);

    const stone = readJson('content/items/stones.json').items[0];
    const uso = { es: 'Evoluciona Pokémon de fuego.', en: 'Evolves fire Pokémon.' };
    const documents = [
      { items: [stone] },
      { items: [{ ...stone, elemento: 'fire', uso }] },
      { items: [{ ...stone, elemento: null, uso: null }] },
      { items: [{ ...stone, elemento: 'steel' }] },
      {
        items: [
          {
            ...stone,
            descripcion: { en: 'You see nothing.' },
            obtencion: {
              tiendas: [{ tienda: 'Diamond Shop', precio: 10, moneda: 'Diamonds', cantidad: 1 }],
              pase: [{ temporada: 7, nivel: 12, pista: 'premium', cantidad: 2 }],
              calendario: [
                { mes: 9, dia: null, trasDia21: true, calendario: 'gratis', cantidad: null },
              ],
              tareas: [{ tipo: 'linked-task', nombre: 'Task', cantidad: 50 }],
              recetas: [
                {
                  taller: null,
                  cantidad: 1,
                  tiempoSegundos: 30,
                  materiales: [{ item: 'water-stone', cantidad: 2 }],
                },
              ],
            },
          },
        ],
      },
    ];
    for (const data of documents) {
      expect(validateSchema(data, jsonSchema('items')), JSON.stringify(data)).toEqual([]);
      expect(itemsFileSchema.safeParse(data).success, JSON.stringify(data)).toBe(true);
    }
    const [parsed] = itemsFileSchema.parse(documents[1]).items;
    expect(parsed?.elemento).toBe('fire');
    expect(parsed?.uso).toEqual(uso);
  });

  it('both accept and reject the same `ball` of a Poké Ball', () => {
    const [ball] = readJson('content/items/poke-balls.json').items;
    const facts = { tasa: null, elementos: [], condicion: null, aura: null };
    const accepted = [
      { items: [{ ...ball, ball: facts }] },
      {
        items: [
          {
            ...ball,
            ball: { tasa: 4.5, elementos: ['fire', 'ground'], condicion: null, aura: 'premier' },
          },
        ],
      },
      { items: [{ ...ball, ball: { ...facts, condicion: 'rapido' } }] },
      { items: [{ ...ball, ball: { ...facts, condicion: 'pesado' } }] },
    ];
    for (const data of accepted) {
      expect(validateSchema(data, jsonSchema('items')), JSON.stringify(data)).toEqual([]);
      expect(itemsFileSchema.safeParse(data).success, JSON.stringify(data)).toBe(true);
    }
    const rejected = [
      { items: [{ ...ball, ball: { ...facts, tasa: -1 } }] },
      { items: [{ ...ball, ball: { ...facts, elementos: ['Fire'] } }] },
      { items: [{ ...ball, ball: { ...facts, condicion: 'lento' } }] },
      { items: [{ ...ball, ball: { ...facts, aura: 'Premier Aura' } }] },
      { items: [{ ...ball, ball: { tasa: null, elementos: [], condicion: null } }] },
      { items: [{ ...ball, ball: { ...facts, fuente: 'faq' } }] },
    ];
    for (const data of rejected) {
      expect(validateSchema(data, jsonSchema('items')), JSON.stringify(data)).not.toEqual([]);
      expect(itemsFileSchema.safeParse(data).success, JSON.stringify(data)).toBe(false);
    }
  });

  it('both reject the same broken documents', () => {
    const stone = readJson('content/items/stones.json').items[0];
    // A real animation of the registry (the Diamond was one until it became the still gem).
    const animation = readJson('public/sprites/sprites.json').sprites['ui/sistemas/boost'];
    const { categorias } = readJson('content/items/categorias.json');
    const swapped = structuredClone(categorias);
    [swapped[1].orden, swapped[2].orden] = [swapped[2].orden, swapped[1].orden];
    const reordered = [categorias[0], categorias[2], categorias[1], ...categorias.slice(3)];
    const pokemon = readJson('content/pokemon.json').pokemon[0];
    const move = readJson('content/moves.json').movimientos[0];
    const quest = readJson('content/quests.json').misiones[0];
    const location = readJson('content/locations.json').ubicaciones[0];
    const rotation = readJson('content/rotations.json').rotaciones[0];
    const systemItem = readJson('content/system-items.json').objetos[0];
    const marker = readJson('content/map/markers.json').marcadores[0];
    const floor = readJson('content/map/floors.json').pisos[0];
    const { elementos } = readJson('content/elementos.json');
    const broken: [string, z.ZodType, unknown][] = [
      ['categorias', categoriasFileSchema, { categorias: swapped }],
      ['categorias', categoriasFileSchema, { categorias: reordered }],
      ['categorias', categoriasFileSchema, { categorias: categorias.slice(0, -1) }],
      [
        'categorias',
        categoriasFileSchema,
        { categorias: [...categorias, { ...categorias[13], id: 'extra', orden: 14 }] },
      ],
      [
        'categorias',
        categoriasFileSchema,
        { categorias: [{ ...categorias[0], virtual: undefined }, ...categorias.slice(1)] },
      ],
      [
        'categorias',
        categoriasFileSchema,
        {
          categorias: [categorias[0], { ...categorias[1], virtual: true }, ...categorias.slice(2)],
        },
      ],
      ['pokemon', pokemonFileSchema, { pokemon: [{ ...pokemon, fuente: 'wiki' }] }],
      ['pokemon', pokemonFileSchema, { pokemon: [{ ...pokemon, tier: 'six' }] }],
      ['pokemon', pokemonFileSchema, { pokemon: [{ ...pokemon, tier: 0 }] }],
      ['pokemon', pokemonFileSchema, { pokemon: [{ ...pokemon, variante: 'mega' }] }],
      ['pokemon', pokemonFileSchema, { pokemon: [{ ...pokemon, elementos: ['lava'] }] }],
      ['pokemon', pokemonFileSchema, { pokemon: [{ ...pokemon, imagen: '' }] }],
      ['pokemon', pokemonFileSchema, { pokemon: [{ ...pokemon, nivel: undefined }] }],
      ['pokemon', pokemonFileSchema, { pokemon: [{ ...pokemon, hp: 0 }] }],
      ['pokemon', pokemonFileSchema, { pokemon: [{ ...pokemon, experiencia: -1 }] }],
      [
        'pokemon',
        pokemonFileSchema,
        {
          pokemon: [{ ...pokemon, drops: [{ item: 'fire-stone', cantidad: { min: 0, max: 1 } }] }],
        },
      ],
      [
        'pokemon',
        pokemonFileSchema,
        { pokemon: [{ ...pokemon, drops: [{ item: 'fire-stone' }] }] },
      ],
      [
        'pokemon',
        pokemonFileSchema,
        { pokemon: [{ ...pokemon, evolucion: [{ a: 'ivysaur', nivel: 0, items: [] }] }] },
      ],
      ['pokemon', pokemonFileSchema, { pokemon: [{ ...pokemon, habilidades: [''] }] }],
      [
        'pokemon',
        pokemonFileSchema,
        { pokemon: [{ ...pokemon, donde: { hunts: [], linkedTasks: [] } }] },
      ],
      [
        'pokemon',
        pokemonFileSchema,
        {
          pokemon: [
            {
              ...pokemon,
              donde: {
                hunts: [{ texto: 'X', ref: { tipo: 'mapa', id: 'x' } }],
                linkedTasks: [],
                equiposNpc: [],
              },
            },
          ],
        },
      ],
      ['pokemon', pokemonFileSchema, { pokemon: [{ ...pokemon, elementoMoveset: 'Fire' }] }],
      ['pokemon', pokemonFileSchema, { pokemon: [{ ...pokemon, descripcion: {} }] }],
      ['pokemon', pokemonFileSchema, { pokemon: [{ ...pokemon, descripcion: 'Texto' }] }],
      [
        'pokemon',
        pokemonFileSchema,
        {
          pokemon: [
            { ...pokemon, drops: [{ item: 'fire-stone', cantidad: null, probabilidad: 101 }] },
          ],
        },
      ],
      [
        'pokemon',
        pokemonFileSchema,
        {
          pokemon: [
            {
              ...pokemon,
              drops: [{ item: 'fire-stone', cantidad: null, probabilidad: 0.99, muyRaro: true }],
            },
          ],
        },
      ],
      [
        'pokemon',
        pokemonFileSchema,
        {
          pokemon: [
            { ...pokemon, drops: [{ item: 'fire-stone', cantidad: null, muyRaro: false }] },
          ],
        },
      ],
      ['pokemon', pokemonFileSchema, { pokemon: [{ ...pokemon, dropsPorZona: { lava: [] } }] }],
      [
        'pokemon',
        pokemonFileSchema,
        { pokemon: [{ ...pokemon, movimientos: [{ movimiento: 'scratch', slot: 'M1' }] }] },
      ],
      [
        'pokemon',
        pokemonFileSchema,
        { pokemon: [{ ...pokemon, efectividad: { muyDebil: ['lava'] } }] },
      ],
      ['moves', movesFileSchema, { movimientos: [{ ...move, efectos: ['Damage'] }] }],
      ['items', itemsFileSchema, { items: [{ ...stone, descripcion: { pt: 'x' } }] }],
      [
        'items',
        itemsFileSchema,
        {
          items: [
            {
              ...stone,
              obtencion: { pase: [{ temporada: 1, nivel: 1, pista: 'vip', cantidad: 1 }] },
            },
          ],
        },
      ],
      [
        'items',
        itemsFileSchema,
        { items: [{ ...stone, obtencion: { recetas: [{ taller: null, materiales: [] }] } }] },
      ],
      ['moves', movesFileSchema, { movimientos: [{ ...move, elemento: 'Normal' }] }],
      ['moves', movesFileSchema, { movimientos: [{ ...move, evidencia: [] }] }],
      ['moves', movesFileSchema, { movimientos: [{ ...move, cooldownSegundos: -1 }] }],
      ['quests', questsFileSchema, { misiones: [{ ...quest, pasos: [''] }] }],
      ['locations', locationsFileSchema, { ubicaciones: [{ ...location, viajes: [{}] }] }],
      ['rotations', rotationsFileSchema, { rotaciones: [{ ...rotation, estado: 'verified' }] }],
      ['system-items', systemItemsFileSchema, { objetos: [{ ...systemItem, descripcion: '' }] }],
      ['map-markers', mapMarkersFileSchema, { marcadores: [{ ...marker, z: 16 }] }],
      ['map-markers', mapMarkersFileSchema, { marcadores: [{ ...marker, fuente: 'otmm' }] }],
      ['map-floors', mapFloorsFileSchema, { pisos: [{ ...floor, imagen: 'floor-1.png' }] }],
      ['items', itemsFileSchema, { items: [{ ...stone, precioNpc: { vende: 0 } }] }],
      ['items', itemsFileSchema, { items: [{ ...stone, precioNpc: { vende: -1, compra: null } }] }],
      ['items', itemsFileSchema, { items: [{ ...stone, categoria: 'todo' }] }],
      ['items', itemsFileSchema, { items: [{ ...stone, clientId: 0 }] }],
      ['items', itemsFileSchema, { items: [{ ...stone, id: 'Fire Stone' }] }],
      ['items', itemsFileSchema, { items: [{ ...stone, precio: 10 }] }],
      // `elemento` is an element id or null; `uso` is the same text in both languages.
      ['items', itemsFileSchema, { items: [{ ...stone, elemento: 'Fire' }] }],
      ['items', itemsFileSchema, { items: [{ ...stone, elemento: 'lava' }] }],
      ['items', itemsFileSchema, { items: [{ ...stone, elemento: 5 }] }],
      ['items', itemsFileSchema, { items: [{ ...stone, elemento: '' }] }],
      ['items', itemsFileSchema, { items: [{ ...stone, uso: 'Evoluciona' }] }],
      ['items', itemsFileSchema, { items: [{ ...stone, uso: { es: 'Evoluciona' } }] }],
      ['items', itemsFileSchema, { items: [{ ...stone, uso: { es: '', en: 'Evolves' } }] }],
      ['items', itemsFileSchema, { items: [{ ...stone, uso: { es: '   ', en: 'Evolves' } }] }],
      ['items', itemsFileSchema, { items: [{ ...stone, uso: { es: 'a', en: 'b', pt: 'c' } }] }],
      ['items', itemsFileSchema, { items: [{ ...stone, uso: [] }] }],
      ['categorias', categoriasFileSchema, { categorias: [] }],
      [
        'categorias',
        categoriasFileSchema,
        { categorias: [{ id: 'x', nombre: { es: 'X' }, icono: 'ui/x', orden: 0 }] },
      ],
      ['outfits', outfitsFileSchema, { outfits: [{ pokemon: 'bulbasaur', outfitId: 2 }] }],
      [
        'outfits',
        outfitsFileSchema,
        { outfits: [{ pokemon: 'bulbasaur', outfitId: 2, addons: [{ id: 'a', outfitId: 3 }] }] },
      ],
      [
        'auras',
        aurasFileSchema,
        { auras: [{ id: 'x', nombre: 'X', shader: 'outfit_fire', icono: 'ui/x' }] },
      ],
      [
        'elementos',
        elementosFileSchema,
        { elementos: [elementos[1], elementos[0], ...elementos.slice(2)] },
      ],
      ['elementos', elementosFileSchema, { elementos: elementos.slice(0, -1) }],
      [
        'elementos',
        elementosFileSchema,
        { elementos: [{ ...elementos[0], nombre: { es: 'Normal' } }, ...elementos.slice(1)] },
      ],
      [
        'elementos',
        elementosFileSchema,
        { elementos: [{ ...elementos[0], icono: 'Tipos/Normal' }, ...elementos.slice(1)] },
      ],
      ['sprites', spritesFileSchema, { sprites: { 'UI/Diamond': animation } }],
      [
        'sprites',
        spritesFileSchema,
        { sprites: { 'ui/x': { ...animation, duracionMs: undefined } } },
      ],
      [
        'sprites',
        spritesFileSchema,
        { sprites: { 'ui/x': { ...animation, modo: 'variante', duracionMs: [1] } } },
      ],
      ['sprites', spritesFileSchema, { sprites: { 'ui/x': { ...animation, modo: 'estatico' } } }],
      ['sprites', spritesFileSchema, { sprites: { 'ui/x': { ...animation, frame: [32] } } }],
      ['sprites', spritesFileSchema, { sprites: { 'ui/x': { ...animation, archivo: 'x.gif' } } }],
      [
        'sprites',
        spritesFileSchema,
        { sprites: { 'ui/x': { archivo: 'x.png', frame: [1, 1], frames: 1, modo: 'cantidad' } } },
      ],
    ];
    for (const [name, schema, data] of broken) {
      const document = JSON.parse(JSON.stringify(data));
      expect(
        validateSchema(document, jsonSchema(name)).length,
        JSON.stringify(data),
      ).toBeGreaterThan(0);
      expect(schema.safeParse(document).success, JSON.stringify(data)).toBe(false);
    }
  });
});

describe('pnpm content:check', () => {
  const scratch = mkdtempSync(path.join(tmpdir(), 'content-check-'));
  afterAll(() => rmSync(scratch, { recursive: true, force: true }));

  function copyRepo() {
    const root = path.join(scratch, `repo-${Math.random().toString(36).slice(2)}`);
    cpSync(path.join(repoRoot, 'content'), path.join(root, 'content'), { recursive: true });
    copyPublicForCheck(repoRoot, root);
    return root;
  }
  const lines = (entries: { file: string; path?: string; message: string }[]) =>
    entries.map((entry) => `${entry.file} · ${entry.path ?? ''} · ${entry.message}`);
  const edit = (root: string, file: string, change: (data: never) => void) => {
    const target = path.join(root, file);
    const data = JSON.parse(readFileSync(target, 'utf8'));
    change(data as never);
    writeFileSync(target, JSON.stringify(data, null, 2));
  };

  it('passes on the repository and counts drafts per file', () => {
    const result = checkContent(repoRoot);
    expect(result.errors).toEqual([]);
    expect(result.summary.find((row) => row.file === 'content/items/stones.json')).toEqual({
      file: 'content/items/stones.json',
      registros: '37 items',
      borradores: 0,
    });
    expect(formatReport(result)).toMatch(/Resultado: sin errores/);
  });

  it('reports schema, reference, id and image problems in Spanish', () => {
    const root = copyRepo();
    edit(root, 'public/sprites/sprites.json', (data: { sprites: Record<string, never> }) => {
      const sprites = data.sprites as Record<string, Record<string, unknown>>;
      sprites['ui/sistemas/boost'].frames = 8;
      sprites['ui/sistemas/boost'].duracionMs = [110, 110, 110, 110, 110, 110, 110, 110];
      sprites['items/poke-balls/alliance-ball'].umbrales = [1, 2, 3, 4, 5, 10, 10, 100];
      sprites['items/stones/fire-stone'].archivo = 'items/stones/missing.png';
    });
    edit(root, 'content/items/stones.json', (data: { items: Record<string, unknown>[] }) => {
      data.items[1].id = 'fire-stone';
      data.items[2].sprite = 'items/stones/nope';
    });
    edit(root, 'content/auras.json', (data: Record<string, unknown>) => {
      delete data.$schema;
    });
    rmSync(path.join(root, 'content', 'items', 'foods.json'));
    writeFileSync(
      path.join(root, 'public', 'sprites', 'ui', 'extra.png'),
      readFileSync(path.join(root, 'public', 'sprites', 'ui', 'diamond.png')),
    );

    const { errors, warnings } = checkContent(root);
    const messages = errors.map(
      (entry) => `${entry.file} · ${entry.path ?? ''} · ${entry.message}`,
    );
    const expected = [
      /sprites\.json · sprites\["ui\/sistemas\/boost"\]\.archivo · public\/sprites\/ui\/sistemas\/boost\.png mide 288×32 y se esperaba 256×32/,
      /umbrales debe ir de menor a mayor/,
      /la imagen public\/sprites\/items\/stones\/missing\.png no existe/,
      /stones\.json · items\[1\]\.id · id repetido: "fire-stone"/,
      /items\[2\]\.sprite · el sprite "items\/stones\/nope" no existe/,
      /auras\.json · {2}· falta "\$schema"/,
      /foods\.json · {2}· falta el archivo de items de la categoría "foods"/,
    ];
    for (const pattern of expected)
      expect(
        messages.some((line) => pattern.test(line)),
        String(pattern),
      ).toBe(true);
    expect(warnings.map((entry) => entry.file)).toContain('public/sprites/ui/extra.png');
    expect(formatReport({ errors, warnings, summary: [] })).toMatch(/Resultado: \d+ errores/);
  });

  it('validates the game data files too', () => {
    const root = copyRepo();
    edit(root, 'content/pokemon.json', (data: { pokemon: Record<string, unknown>[] }) => {
      data.pokemon[0].fuente = 'wiki';
      data.pokemon[1].tier = 'six';
      data.pokemon[2].id = data.pokemon[0].id;
    });
    edit(root, 'content/moves.json', (data: { movimientos: Record<string, unknown>[] }) => {
      data.movimientos[0].pokemon = ['missingno'];
    });
    edit(root, 'content/map/floors.json', (data: { pisos: Record<string, unknown>[] }) => {
      data.pisos[0].ancho = 100;
    });
    edit(root, 'content/quests.json', (data: Record<string, unknown>) => {
      delete data.$schema;
    });
    writeFileSync(path.join(root, 'content', 'map', 'markers.json'), '{ "marcadores": [');

    const messages = lines(checkContent(root).errors);
    const expected = [
      /pokemon\.json · pokemon\[0\]\.fuente · campo no permitido: "fuente"/,
      /pokemon\.json · pokemon\[1\]\.tier · debe ser uno de: "Super Rare"/,
      /pokemon\.json · pokemon\[2\]\.id · id repetido: "bulbasaur"/,
      /moves\.json · movimientos\[0\]\.pokemon\[0\] · "missingno" no existe en content\/pokemon\.json/,
      /floors\.json · pisos\[0\]\.imagen · public\/data\/map\/otmm\/floor-1\.png mide 832×648 y el piso dice 100×648/,
      /quests\.json · {2}· falta "\$schema": "\.\/schemas\/quests\.schema\.json"/,
      /markers\.json · {2}· JSON inválido/,
    ];
    for (const pattern of expected)
      expect(
        messages.some((line) => pattern.test(line)),
        `${pattern}\n${messages.join('\n')}`,
      ).toBe(true);
  });

  it('reports a broken content/pokemon.json instead of crashing', () => {
    const root = copyRepo();
    writeFileSync(path.join(root, 'content', 'pokemon.json'), '{ broken');
    const result = checkContent(root);
    expect(lines(result.errors)).toEqual([
      expect.stringMatching(/^content\/pokemon\.json · {2}· JSON inválido/),
    ]);
    expect(formatReport(result)).toMatch(/Resultado: 1 error, 0 avisos/);
  });

  it('reports one sprite schema error once and keeps checking the rest', () => {
    const root = copyRepo();
    edit(root, 'public/sprites/sprites.json', (data: { sprites: Record<string, never> }) => {
      const sprites = data.sprites as Record<string, Record<string, unknown>>;
      (sprites['items/poke-balls/alliance-ball'].umbrales as number[])[0] = 0;
    });
    let result = checkContent(root);
    expect(lines(result.errors)).toEqual([
      expect.stringMatching(
        /sprites\.json · sprites\.items\/poke-balls\/alliance-ball\.umbrales\[0\] · debe ser mayor o igual a 1/,
      ),
    ]);
    expect(result.warnings).toEqual([]);

    edit(root, 'content/items/stones.json', (data: { items: Record<string, unknown>[] }) => {
      data.items[0].sprite = 'items/stones/nope';
    });
    result = checkContent(root);
    expect(lines(result.errors)).toHaveLength(2);
    expect(lines(result.errors)[1]).toMatch(/el sprite "items\/stones\/nope" no existe/);
    expect(result.warnings).toEqual([]);
  });

  it('checks the Pokémon fields of 3.13: items, evolutions, «tiers», references (M7)', () => {
    type Record = { id: string } & { [key: string]: unknown };
    const byId = (data: { pokemon: Record[] }, id: string) =>
      data.pokemon.find((record) => record.id === id) as Record;

    // Valid values of every new field pass.
    let root = copyRepo();
    edit(root, 'content/pokemon.json', (data: { pokemon: Record[] }) => {
      const charmander = byId(data, 'charmander');
      charmander.hp = 100;
      charmander.experiencia = 0;
      charmander.drops = [
        { item: 'fire-stone', cantidad: { min: 1, max: 3 } },
        { item: 'water-stone', cantidad: null },
      ];
      charmander.evolucion = [
        { a: 'charmeleon', nivel: 16, items: [{ item: 'fire-stone', cantidad: 1 }] },
      ];
      byId(data, 'charmeleon').evolucion = [{ a: 'charizard', nivel: 36, items: [] }];
      charmander.habilidades = ['Fly'];
      charmander.donde = {
        hunts: [{ texto: 'Charizard', ref: { tipo: 'pokemon', id: 'charizard' } }],
        linkedTasks: [],
        equiposNpc: [],
      };
      charmander.elementoMoveset = 'fire';
    });
    expect(lines(checkContent(root).errors)).toEqual([]);

    // Every broken case is reported, each circle once.
    root = copyRepo();
    edit(root, 'content/pokemon.json', (data: { pokemon: Record[] }) => {
      const charmander = byId(data, 'charmander');
      charmander.drops = [
        { item: 'fire-stone', cantidad: { min: 3, max: 1 } },
        { item: 'fire-stone', cantidad: null },
        { item: 'missing-item', cantidad: { min: 1, max: 1 } },
      ];
      charmander.evolucion = [
        { a: 'charmeleon', nivel: 16, items: [{ item: 'nope-item', cantidad: 1 }] },
        { a: 'missingno', nivel: null, items: [] },
        { a: 'charmeleon', nivel: 16, items: [] },
      ];
      byId(data, 'charmeleon').evolucion = [{ a: 'charizard', nivel: 36, items: [] }];
      byId(data, 'charizard').evolucion = [{ a: 'charmander', nivel: null, items: [] }];
      byId(data, 'pikachu').evolucion = [{ a: 'pikachu', nivel: null, items: [] }];
      byId(data, 'bulbasaur').id = 'tiers';
      byId(data, 'squirtle').donde = {
        hunts: [{ texto: 'X', ref: { tipo: 'sistema', id: 'missing-system' } }],
        linkedTasks: [{ texto: 'Y', ref: { tipo: 'actividad', id: 'nada' } }],
        equiposNpc: [{ texto: 'Z', ref: { tipo: 'pokemon', id: 'missingno' } }],
      };
    });
    const messages = lines(checkContent(root).errors);
    const expected = [
      /drops\[0\]\.cantidad\.max · cantidad\.max \(1\) no puede ser menor que cantidad\.min \(3\)/,
      /drops\[1\]\.item · drop repetido: "fire-stone"/,
      /drops\[2\]\.item · "missing-item" no existe en content\/items\//,
      /evolucion\[0\]\.items\[0\]\.item · "nope-item" no existe en content\/items\//,
      /evolucion\[1\]\.a · "missingno" no existe en content\/pokemon\.json/,
      /evolucion\[2\]\.a · evolución repetida: "charmeleon"/,
      /evolucion\[0\]\.a · cadena de evolución circular: pikachu → pikachu/,
      /pokemon\[0\]\.id · "tiers" no puede ser el id de un Pokémon/,
      /donde\.hunts\[0\]\.ref\.id · "missing-system" no existe en content\/sistemas\//,
      /donde\.linkedTasks\[0\]\.ref\.id · "nada" no existe en content\/quests\.json/,
      /donde\.equiposNpc\[0\]\.ref\.id · "missingno" no existe en content\/pokemon\.json/,
    ];
    for (const pattern of expected)
      expect(
        messages.some((line) => pattern.test(line)),
        `${pattern}\n${messages.join('\n')}`,
      ).toBe(true);
    expect(messages.filter((line) => /circular/.test(line))).toHaveLength(2);

    // A move names its element by id, and that element needs a name in both languages.
    root = copyRepo();
    edit(root, 'content/moves.json', (data: { movimientos: Record[] }) => {
      data.movimientos[0].elemento = 'Normal';
    });
    expect(lines(checkContent(root).errors)).toEqual([
      expect.stringMatching(/movimientos\[0\]\.elemento · debe ser uno de: "normal"/),
    ]);
  });

  it('checks the item fields of 3.13, `elemento` and `uso` (M9)', () => {
    type ItemRecord = { [key: string]: unknown };

    // Both fields filled, and both null, pass.
    let root = copyRepo();
    edit(root, 'content/items/stones.json', (data: { items: ItemRecord[] }) => {
      data.items[0].elemento = 'fire';
      data.items[0].uso = { es: 'Evoluciona algunos Pokémon.', en: 'Evolves some Pokémon.' };
      data.items[1].elemento = null;
      data.items[1].uso = null;
    });
    expect(lines(checkContent(root).errors)).toEqual([]);

    // A game amount written in `uso` (prices go in `precioNpc`), an element out of the list
    // and an element list of items.schema.json that drifted from elementos.schema.json. A
    // plain number that is no amount («5 niveles») is not one.
    root = copyRepo();
    edit(root, 'content/items/stones.json', (data: { items: ItemRecord[] }) => {
      data.items[0].uso = { es: 'Se vende por 60kk.', en: 'Sells for 60kk.' };
      data.items[1].uso = { es: 'Cuesta 20 Diamonds.', en: 'Costs 20 Diamonds.' };
      data.items[2].elemento = 'lava';
      data.items[3].uso = { es: 'Sube 5 niveles.', en: 'Raises 5 levels.' };
    });
    edit(
      root,
      'content/schemas/items.schema.json',
      (schema: { $defs: { elemento: { enum: string[] } } }) => {
        schema.$defs.elemento.enum = schema.$defs.elemento.enum.slice(1);
      },
    );
    const messages = lines(checkContent(root).errors);
    const expected = [
      /stones\.json · items\[0\]\.uso\.es · importe del juego en texto libre \(«60kk»\)/,
      /stones\.json · items\[0\]\.uso\.en · importe del juego en texto libre \(«60kk»\)/,
      /stones\.json · items\[1\]\.uso\.es · importe del juego en texto libre \(«20 Diamonds»\)/,
      /stones\.json · items\[2\]\.elemento · debe ser uno de/,
      /items\.schema\.json · \$defs\.elemento\.enum · la lista de "elemento" debe ser igual/,
    ];
    for (const pattern of expected)
      expect(
        messages.some((line) => pattern.test(line)),
        `${pattern}\n${messages.join('\n')}`,
      ).toBe(true);
    expect(
      messages.filter((line) => /items\[3\]/.test(line)),
      'a number that is no amount',
    ).toEqual([]);

    // An element an item names needs its name in both languages, reported once per element.
    root = copyRepo();
    edit(root, 'content/items/stones.json', (data: { items: ItemRecord[] }) => {
      data.items[0].elemento = 'fire';
      data.items[1].elemento = 'fire';
    });
    edit(root, 'content/elementos.json', (data: { elementos: ItemRecord[] }) => {
      delete data.elementos[1].nombre;
    });
    const unnamed = lines(checkContent(root).errors).filter((line) =>
      /necesita "nombre"/.test(line),
    );
    expect(unnamed.filter((line) => line.startsWith('content/items/'))).toEqual([
      expect.stringMatching(
        /stones\.json · items\[0\]\.elemento · el elemento "fire" necesita "nombre"/,
      ),
    ]);
  });

  it('keeps the 14 Market categories, «Otros» and their order', () => {
    let root = copyRepo();
    edit(root, 'content/items/categorias.json', (data: { categorias: { orden: number }[] }) => {
      [data.categorias[1].orden, data.categorias[2].orden] = [
        data.categorias[2].orden,
        data.categorias[1].orden,
      ];
    });
    expect(lines(checkContent(root).errors)).toEqual([
      expect.stringMatching(/categorias\[1\]\.orden · debe ser 1/),
      expect.stringMatching(/categorias\[2\]\.orden · debe ser 2/),
    ]);

    root = copyRepo();
    edit(root, 'content/items/categorias.json', (data: { categorias: unknown[] }) => {
      data.categorias.pop();
    });
    // otros.json stays (its items are the loot of content/pokemon.json): the file then has no
    // category, which is reported as well.
    expect(lines(checkContent(root).errors)).toContainEqual(
      expect.stringMatching(/categorias\.json · categorias · necesita al menos 15 elemento/),
    );

    root = copyRepo();
    edit(
      root,
      'content/schemas/items.schema.json',
      (schema: { $defs: { item: { properties: { categoria: { enum: string[] } } } } }) => {
        schema.$defs.item.properties.categoria.enum.pop();
      },
    );
    expect(lines(checkContent(root).errors)).toContainEqual(
      expect.stringMatching(/items\.schema\.json · .* · la lista de "categoria" debe ser igual/),
    );
  });
});
