// Checks every JSON file under content/ and public/sprites/sprites.json: JSON
// Schemas, unique ids, references between files (categories, sprites, Pokémon,
// elements, items, evolutions and the entities a Pokémon page links to), drop
// quantities, evolution chains, the blocks of the system pages, the element and
// use of the items, the `moneda` of the Diamonds, the sprites and texts of the
// activities, the Destacados and the worlds of the Inicio, the entries of
// Cambios, the sample listings and sellers of Comercio, image files, PNG sizes
// and provenance keys.
// Pure apart from reading files under `root`; used by scripts/content/check.mjs
// and the tests.

import {
  closeSync,
  existsSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  statSync,
} from 'node:fs';
import path from 'node:path';

import { validateSchema } from './json-schema.mjs';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Reads width and height from a PNG's IHDR chunk, or null if it is not a PNG. */
export function readPngSize(file) {
  const header = Buffer.alloc(24);
  const fd = openSync(file, 'r');
  try {
    if (readSync(fd, header, 0, 24, 0) < 24) return null;
  } finally {
    closeSync(fd);
  }
  if (!header.subarray(0, 8).equals(PNG_SIGNATURE)) return null;
  if (header.toString('latin1', 12, 16) !== 'IHDR') return null;
  return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
}

function listFiles(directory, extension) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { recursive: true })
    .map((entry) => path.join(directory, String(entry)))
    .filter((file) => file.toLowerCase().endsWith(extension) && statSync(file).isFile());
}

const toPosix = (file) => file.split(path.sep).join('/');
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isPositiveInteger = (value) => Number.isInteger(value) && value >= 1;
const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;

/**
 * The id in content/tiers.json a Pokémon's `tier` maps to (spec 16.2.1): `t1`…`t7` for a numeric
 * tier, the kebab-case of a special tier's name otherwise (`ULTIMATE` -> `ultimate`, `Super Rare`
 * -> `super-rare`). Mirrors tierKey() of src/lib/content/tier-rank.ts, which this plain script
 * cannot import; tests/content/tiers.test.ts checks both give the same answer for every case
 * content/pokemon.json actually uses.
 * @param {unknown} tier
 */
function tierRecordId(tier) {
  if (typeof tier === 'number') return Number.isInteger(tier) && tier >= 1 ? `t${tier}` : null;
  if (typeof tier !== 'string') return null;
  const trimmed = tier.trim();
  if (!trimmed) return null;
  const numeric = /^t?(\d+)$/i.exec(trimmed);
  if (numeric) return `t${Number(numeric[1])}`;
  return trimmed.toLowerCase().replace(/\s+/g, '-');
}

/**
 * Keys that would bring provenance into the wiki. The site never shows where a
 * number comes from, so no schema declares one of these as a field and no
 * record carries one.
 */
const PROVENANCE_KEYS = new Set([
  'fuente',
  'fuentes',
  'source',
  'sources',
  'evidencia',
  'verificado',
  'verificadoEl',
  'obtenidoEl',
]);

/**
 * Every provenance key a record carries, at any depth, as { key, path }.
 * @param {unknown} data Parsed content file.
 */
function provenanceInData(data) {
  /** @type {{ key: string, path: string }[]} */
  const found = [];
  const walk = (value, at) => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, `${at}[${index}]`));
      return;
    }
    if (!isObject(value)) return;
    for (const [key, child] of Object.entries(value)) {
      const where = at ? `${at}.${key}` : key;
      if (PROVENANCE_KEYS.has(key)) found.push({ key, path: where });
      walk(child, where);
    }
  };
  walk(data, '');
  return found;
}

/**
 * Every provenance key a JSON Schema declares as a field, as { key, path }.
 * Reads "properties", "patternProperties" and "required" at any depth: the
 * records are closed with additionalProperties: false, so a provenance field
 * can only come back by being declared.
 * @param {unknown} schema Parsed schema of content/schemas/.
 */
function provenanceInSchema(schema) {
  /** @type {{ key: string, path: string }[]} */
  const found = [];
  const walk = (node, at) => {
    if (Array.isArray(node)) {
      node.forEach((item, index) => walk(item, `${at}[${index}]`));
      return;
    }
    if (!isObject(node)) return;
    for (const [keyword, value] of Object.entries(node)) {
      const where = at ? `${at}.${keyword}` : keyword;
      if ((keyword === 'properties' || keyword === 'patternProperties') && isObject(value))
        for (const field of Object.keys(value))
          if (PROVENANCE_KEYS.has(field)) found.push({ key: field, path: `${where}.${field}` });
      if (keyword === 'required' && Array.isArray(value))
        for (const field of value)
          if (PROVENANCE_KEYS.has(field)) found.push({ key: field, path: where });
      walk(value, where);
    }
  };
  walk(schema, '');
  return found;
}

/**
 * Game data files the site reads besides the registries. `key` is the array
 * inside the file and `id` the field that must be unique in it.
 */
const CONTENT_FILES = [
  {
    file: 'elementos.json',
    schema: 'elementos',
    key: 'elementos',
    id: 'id',
    label: ['elemento', 'elementos'],
  },
  {
    file: 'tiers.json',
    schema: 'tiers',
    key: 'tiers',
    id: 'id',
    label: ['tier', 'tiers'],
  },
  {
    file: 'pokemon.json',
    schema: 'pokemon',
    key: 'pokemon',
    id: 'id',
    label: ['Pokémon', 'Pokémon'],
  },
  {
    file: 'moves.json',
    schema: 'moves',
    key: 'movimientos',
    id: 'id',
    label: ['movimiento', 'movimientos'],
  },
  {
    file: 'quests.json',
    schema: 'quests',
    key: 'misiones',
    id: 'id',
    label: ['misión', 'misiones'],
  },
  {
    file: 'locations.json',
    schema: 'locations',
    key: 'ubicaciones',
    id: 'id',
    label: ['ubicación', 'ubicaciones'],
  },
  {
    file: 'rotations.json',
    schema: 'rotations',
    key: 'rotaciones',
    id: 'id',
    label: ['rotación', 'rotaciones'],
  },
  {
    file: 'system-items.json',
    schema: 'system-items',
    key: 'objetos',
    id: 'id',
    label: ['objeto', 'objetos'],
  },
  {
    file: 'map/markers.json',
    schema: 'map-markers',
    key: 'marcadores',
    id: 'id',
    label: ['marcador', 'marcadores'],
  },
  {
    file: 'map/floors.json',
    schema: 'map-floors',
    key: 'pisos',
    id: 'z',
    label: ['piso', 'pisos'],
  },
];

const SCHEMA_NAMES = [
  'categorias',
  'items',
  'outfits',
  'auras',
  'sprites',
  'sistemas',
  'destacados',
  'mundos',
  'cambios',
  'comercio',
  ...CONTENT_FILES.map((entry) => entry.schema),
];

/**
 * Site routes a system page may link to with `ruta` (spec 8.0.1 and the fixed
 * links of the menu, 8.0.3), without the locale. The routes with a parameter
 * (a Pokémon, a system, an activity, a Market category) are resolved against
 * their registry in `checkContent`. Exported for tests/nav/groups.test.ts: the
 * menu links every one of them whose page the build writes when a «Destacados»
 * entry names it (WG5).
 */
export const STATIC_ROUTES = new Set([
  '/',
  '/pokedex/',
  '/pokedex/tiers/',
  '/sistemas/',
  '/items/',
  '/buscar/',
  '/cambios/',
  '/actividades/',
  '/herramientas/',
  '/herramientas/guild/',
  '/herramientas/pokemon/',
  '/mapa/',
  '/comercio/',
]);

/**
 * The page file of a route with a parameter under src/pages/[locale]/:
 * `pokedex/[slug].astro`, `sistemas/[id].astro`, `items/c/[categoria].astro`.
 */
const PAGE_TEMPLATE = /^\[[a-z]+\]\.astro$/;

/**
 * Section ids a system page cannot use: the automatic «Ítems» section and the
 * anchors of its items (spec 8.4.2 step 6, H7), and the fixed ids of the page
 * frame (`<main id="contenido">` of src/layouts/PageLayout.astro and the
 * `<dialog id="menu-movil">` of src/components/layout/MobileMenu.astro).
 */
const RESERVED_SECTION_IDS = new Set(['items', 'contenido', 'menu-movil']);
const RESERVED_SECTION_PREFIX = 'item-';

/**
 * A game amount written as free text: «60kk», «2,5k», «$500», «5.000
 * Pokédólares», «20 Diamonds». In a system page it is an inline `{ "pd" }` or
 * `{ "dia" }` (spec 8.4), so the page draws its sprite and its exact accessible
 * name (R5, S8).
 */
const FREE_AMOUNT =
  /\$\s?\d|\d[\d.,]*\s?kk?(?![\p{L}\p{N}])|\d[\d.,]*\s?(?:pok[eé]d[oó]lar(?:es)?|pok[eé]dollars?|diamonds?|diamantes?)(?!\p{L})/iu;

/** Keys of a system record whose strings are identifiers, never prose. */
const NOT_PROSE = new Set(['$schema', 'id', 'sprite', 'ancla', 'ruta', 'entidad', 'tipo']);

/**
 * @param {string} root Repository root (the folder that holds content/ and public/).
 */
export function checkContent(root) {
  /** @type {{ file: string, path?: string, message: string }[]} */
  const errors = [];
  /** @type {{ file: string, path?: string, message: string }[]} */
  const warnings = [];
  /** @type {{ file: string, registros: string, borradores: number | null }[]} */
  const summary = [];
  const rel = (file) => toPosix(path.relative(root, file));
  const error = (file, message, at) => errors.push({ file: rel(file), path: at, message });
  const warn = (file, message, at) => warnings.push({ file: rel(file), path: at, message });
  const contentDir = path.join(root, 'content');

  const schemaDir = path.join(contentDir, 'schemas');
  const schemas = {};
  const unreadable = new Set();
  for (const name of SCHEMA_NAMES) {
    const file = path.join(schemaDir, `${name}.schema.json`);
    try {
      schemas[name] = JSON.parse(readFileSync(file, 'utf8'));
    } catch (cause) {
      error(file, `no se pudo leer el esquema: ${cause.message}`);
      unreadable.add(name);
    }
  }

  // No schema of content/schemas/ accepts a source, evidence, verification or
  // capture-date field, including the ones no registry uses yet.
  for (const file of listFiles(schemaDir, '.json')) {
    const name = path.basename(file).replace(/\.schema\.json$/, '');
    if (unreadable.has(name)) continue;
    let schema = schemas[name];
    if (!schema) {
      try {
        schema = JSON.parse(readFileSync(file, 'utf8'));
      } catch (cause) {
        error(file, `no se pudo leer el esquema: ${cause.message}`);
        continue;
      }
    }
    for (const entry of provenanceInSchema(schema))
      error(
        file,
        `el esquema no puede declarar el campo de procedencia "${entry.key}"`,
        entry.path,
      );
  }

  /**
   * Reads, parses and schema-validates one file. `data` is the parsed JSON
   * (undefined when the file is missing or is not JSON); `valid` is true only
   * when it also passes its schema.
   */
  function read(file, schemaName) {
    if (!existsSync(file)) {
      error(file, 'el archivo no existe');
      return { data: undefined, valid: false };
    }
    let data;
    try {
      data = JSON.parse(readFileSync(file, 'utf8'));
    } catch (cause) {
      error(file, `JSON inválido: ${cause.message}`);
      return { data: undefined, valid: false };
    }
    for (const entry of provenanceInData(data))
      error(file, `clave de procedencia no permitida: "${entry.key}"`, entry.path);
    const expected = path.join(schemaDir, `${schemaName}.schema.json`);
    const expectedRef = toPosix(path.relative(path.dirname(file), expected));
    const ref = isObject(data) ? data.$schema : undefined;
    if (typeof ref !== 'string') {
      error(file, `falta "$schema": "${expectedRef.startsWith('.') ? '' : './'}${expectedRef}"`);
    } else if (path.resolve(path.dirname(file), ref) !== path.resolve(expected)) {
      error(file, `"$schema" debe apuntar a ${expectedRef}`, '$schema');
    } else if (Object.keys(data)[0] !== '$schema') {
      error(file, '"$schema" debe ser la primera clave del archivo', '$schema');
    }
    const schema = schemas[schemaName];
    if (!schema) return { data, valid: false };
    const problems = validateSchema(data, schema);
    for (const problem of problems) error(file, problem.message, problem.path);
    return { data, valid: problems.length === 0 };
  }

  const drafts = (records) => records.filter((record) => record.borrador === true).length;

  // The Market categories are fixed in categorias.schema.json; the "categoria"
  // list in items.schema.json (VS Code autocompletion) must name the same ones.
  const fixedCategories = schemas.categorias?.properties?.categorias?.prefixItems;
  const itemCategoryEnum = schemas.items?.$defs?.item?.properties?.categoria?.enum;
  if (Array.isArray(fixedCategories) && Array.isArray(itemCategoryEnum)) {
    const realIds = fixedCategories
      .filter((entry) => entry?.properties?.virtual?.const !== true)
      .map((entry) => entry?.properties?.id?.const);
    if (JSON.stringify(realIds) !== JSON.stringify(itemCategoryEnum))
      error(
        path.join(schemaDir, 'items.schema.json'),
        `la lista de "categoria" debe ser igual a las categorías de categorias.schema.json ` +
          `sin "todo", en el mismo orden: ${realIds.join(', ')}`,
        '$defs.item.properties.categoria.enum',
      );
  }

  // elementos.schema.json fixes the 18 element ids and their order (spec 8.0.5);
  // the "elemento" lists of pokemon.schema.json, moves.schema.json,
  // sistemas.schema.json and items.schema.json (VS Code autocompletion) must
  // name the same ones, in the same order.
  const elementSlots = schemas.elementos?.properties?.elementos?.prefixItems;
  const fixedElements = Array.isArray(elementSlots)
    ? elementSlots.map((entry) => entry?.properties?.id?.const)
    : null;
  if (fixedElements)
    for (const name of ['pokemon', 'moves', 'sistemas', 'items']) {
      const list = schemas[name]?.$defs?.elemento?.enum;
      if (Array.isArray(list) && JSON.stringify(list) !== JSON.stringify(fixedElements))
        error(
          path.join(schemaDir, `${name}.schema.json`),
          `la lista de "elemento" debe ser igual a los elementos de elementos.schema.json, ` +
            `en el mismo orden: ${fixedElements.join(', ')}`,
          '$defs.elemento.enum',
        );
    }

  // Sprites first: everything else references them. A schema error in one
  // entry is reported once; the other entries and every key reference are
  // still checked.
  const spritesRoot = path.join(root, 'public', 'sprites');
  const spritesFile = path.join(spritesRoot, 'sprites.json');
  const spriteFile = read(spritesFile, 'sprites');
  const spritesKnown = isObject(spriteFile.data) && isObject(spriteFile.data.sprites);
  const sprites = spritesKnown ? spriteFile.data.sprites : {};
  const usedImages = new Set();

  for (const [key, entry] of Object.entries(sprites)) {
    if (!isObject(entry)) continue;
    const at = `sprites["${key}"]`;
    const frameOk =
      Array.isArray(entry.frame) &&
      entry.frame.length === 2 &&
      entry.frame.every(isPositiveInteger);
    const framesOk = isPositiveInteger(entry.frames);
    const [frameWidth, frameHeight] = frameOk ? entry.frame : [0, 0];
    const checkImage = (archivo, width, height, where) => {
      if (typeof archivo !== 'string' || archivo === '') return;
      const file = path.join(spritesRoot, ...archivo.split('/'));
      usedImages.add(path.resolve(file));
      if (!existsSync(file) || !statSync(file).isFile()) {
        error(spritesFile, `la imagen public/sprites/${archivo} no existe`, where);
        return;
      }
      const size = readPngSize(file);
      if (!size) {
        error(spritesFile, `public/sprites/${archivo} no es un PNG válido`, where);
      } else if (width && height && (size.width !== width || size.height !== height)) {
        error(
          spritesFile,
          `public/sprites/${archivo} mide ${size.width}×${size.height} y se esperaba ${width}×${height} ` +
            `(frame ${frameWidth}×${frameHeight} × ${entry.frames} frame(s))`,
          where,
        );
      }
    };
    const sheetSize = frameOk && framesOk;
    checkImage(
      entry.archivo,
      sheetSize ? frameWidth * entry.frames : 0,
      sheetSize ? frameHeight : 0,
      `${at}.archivo`,
    );
    if (isObject(entry.direcciones))
      for (const [direction, archivo] of Object.entries(entry.direcciones))
        checkImage(archivo, frameWidth, frameHeight, `${at}.direcciones.${direction}`);
    if (Array.isArray(entry.umbrales)) {
      if (framesOk && entry.umbrales.length !== entry.frames)
        error(
          spritesFile,
          `umbrales tiene ${entry.umbrales.length} valores y la hoja ${entry.frames} frames`,
          `${at}.umbrales`,
        );
      if (entry.umbrales.some((value, index) => index > 0 && value <= entry.umbrales[index - 1]))
        error(spritesFile, 'umbrales debe ir de menor a mayor, sin repetir', `${at}.umbrales`);
    }
    if (Array.isArray(entry.duracionMs) && framesOk && entry.duracionMs.length !== entry.frames)
      error(
        spritesFile,
        `duracionMs tiene ${entry.duracionMs.length} valores y la hoja ${entry.frames} frames`,
        `${at}.duracionMs`,
      );
  }
  if (spritesKnown) {
    for (const image of listFiles(spritesRoot, '.png')) {
      if (!usedImages.has(path.resolve(image)))
        warn(image, 'imagen que ningún sprite de sprites.json usa');
    }
    const entries = Object.values(sprites).filter(isObject);
    summary.push({
      file: rel(spritesFile),
      registros: plural(entries.length, 'sprite', 'sprites'),
      borradores: drafts(entries),
    });
  }

  const requireSprite = (file, key, at) => {
    if (spritesKnown && typeof key === 'string' && !Object.hasOwn(sprites, key))
      error(file, `el sprite "${key}" no existe en public/sprites/sprites.json`, at);
  };

  // Reads a file and returns its record array even when some records break
  // the schema (those errors are already reported), so the checks below still
  // run on everything that can be read. null when the file or array is missing.
  const recordsOf = (file, schemaName, key) => {
    const { data } = read(file, schemaName);
    return isObject(data) && Array.isArray(data[key]) ? data[key] : null;
  };
  const text = (value) => (typeof value === 'string' ? value : null);

  // Categories and one item file per real category. categorias.schema.json
  // fixes the 14 ids and their order.
  const itemsDir = path.join(contentDir, 'items');
  const categoriasFile = path.join(itemsDir, 'categorias.json');
  const categoriaRecords = recordsOf(categoriasFile, 'categorias', 'categorias');
  const categorias = (categoriaRecords ?? []).filter(
    (categoria) => isObject(categoria) && text(categoria.id),
  );
  categoriaRecords?.forEach((categoria, index) => {
    if (!isObject(categoria) || !text(categoria.id)) return;
    const at = `categorias[${index}]`;
    requireSprite(categoriasFile, categoria.icono, `${at}.icono`);
    const itemFile = path.join(itemsDir, `${categoria.id}.json`);
    if (categoria.virtual === true && existsSync(itemFile))
      error(itemFile, `"${categoria.id}" es virtual y no debe tener archivo de items`);
    if (categoria.virtual !== true && !existsSync(itemFile))
      error(itemFile, `falta el archivo de items de la categoría "${categoria.id}"`);
  });
  if (categoriaRecords)
    summary.push({
      file: rel(categoriasFile),
      registros: `${categoriaRecords.length} categorías`,
      borradores: null,
    });

  const itemIds = new Map();
  /** @type {Map<string, { nombre: unknown, categoria: string, held?: unknown, mega?: unknown }>} item id -> its name and the file it is in. */
  const itemRecords = new Map();
  /** @type {Array<{ file: string, at: string, pokemon: unknown[] }>} `mega.pokemon` of every item with one (§16.2.3), checked once Pokémon ids are known. */
  const megaChecks = [];
  /** @type {Map<string, { file: string, at: string }>} element id -> the first item that names it. */
  const itemElements = new Map();
  // The `moneda` object of content/items/diamantes.json (spec 3.13): its two lists name the same
  // places in both languages, and an amount written in them would be drawn without the sprite
  // of its currency (R5, S8). Any other items file has no currency to describe.
  const checkMoneda = (file, name, moneda) => {
    if (name !== 'diamantes') {
      error(file, '"moneda" solo va en content/items/diamantes.json', 'moneda');
      return;
    }
    if (!isObject(moneda)) return;
    for (const field of ['seCompranEn', 'seUsanEn']) {
      const lists = moneda[field];
      if (!isObject(lists) || !Array.isArray(lists.es) || !Array.isArray(lists.en)) continue;
      if (lists.es.length !== lists.en.length)
        error(
          file,
          `"${field}" tiene ${plural(lists.es.length, 'entrada', 'entradas')} en es y ${lists.en.length} en en: son las mismas en los dos idiomas`,
          `moneda.${field}`,
        );
      for (const lang of ['es', 'en'])
        lists[lang].forEach((value, index) => {
          const match = typeof value === 'string' ? FREE_AMOUNT.exec(value) : null;
          if (match)
            error(
              file,
              `importe del juego en texto libre («${match[0].trim()}»): las listas de "moneda" no llevan importes`,
              `moneda.${field}.${lang}[${index}]`,
            );
        });
    }
  };
  const orderOf = (file) => {
    const orden = categorias.find((entry) => entry.id === path.basename(file, '.json'))?.orden;
    return Number.isInteger(orden) ? orden : Number.MAX_SAFE_INTEGER;
  };
  const itemFiles = listFiles(itemsDir, '.json')
    .filter((file) => path.resolve(file) !== path.resolve(categoriasFile))
    .sort((a, b) => orderOf(a) - orderOf(b) || a.localeCompare(b));
  for (const file of itemFiles) {
    const name = path.basename(file, '.json');
    const categoria = categorias.find((entry) => entry.id === name);
    if (categoriaRecords && (!categoria || categoria.virtual === true))
      error(file, `no hay una categoría "${name}" en content/items/categorias.json`);
    const { data: itemsData } = read(file, 'items');
    if (isObject(itemsData) && itemsData.moneda !== undefined)
      checkMoneda(file, name, itemsData.moneda);
    const items = isObject(itemsData) && Array.isArray(itemsData.items) ? itemsData.items : null;
    if (!items) continue;
    items.forEach((item, index) => {
      if (!isObject(item)) return;
      const at = `items[${index}]`;
      if (text(item.id)) {
        if (itemIds.has(item.id))
          error(file, `id repetido: "${item.id}" (también en ${itemIds.get(item.id)})`, `${at}.id`);
        else {
          itemIds.set(item.id, rel(file));
          itemRecords.set(item.id, { nombre: item.nombre, categoria: name, held: item.held, mega: item.mega });
        }
      }
      if (text(item.categoria) && item.categoria !== name)
        error(
          file,
          `categoria "${item.categoria}" no coincide con el archivo (${name})`,
          `${at}.categoria`,
        );
      requireSprite(file, item.sprite, `${at}.sprite`);
      // Mega Stone (§16.2.3): its `pokemon` ids are checked once content/pokemon.json is read.
      if (isObject(item.mega) && Array.isArray(item.mega.pokemon))
        megaChecks.push({ file, at: `${at}.mega.pokemon`, pokemon: item.mega.pokemon });
      // «Elemento» (spec 3.13, 8.5): its name is checked once the elements are read.
      const elemento = text(item.elemento);
      if (elemento && !itemElements.has(elemento))
        itemElements.set(elemento, { file, at: `${at}.elemento` });
      // «Uso» is plain text in both locales: a game amount in it would be drawn
      // without the Pokédólares sprite and its exact name (R5, S8). The prices
      // of an item are its "precioNpc".
      if (isObject(item.uso))
        for (const lang of ['es', 'en']) {
          const match =
            typeof item.uso[lang] === 'string' ? FREE_AMOUNT.exec(item.uso[lang]) : null;
          if (match)
            error(
              file,
              `importe del juego en texto libre («${match[0].trim()}»): "uso" no lleva importes; los precios del item van en "precioNpc"`,
              `${at}.uso.${lang}`,
            );
        }
    });
    summary.push({
      file: rel(file),
      registros: plural(items.length, 'item', 'items'),
      borradores: drafts(items.filter(isObject)),
    });
  }

  // Game data: Pokémon, moves, quests, locations, rotations, system items and
  // the map. Ids are unique inside each file.
  const contentRecords = {};
  for (const entry of CONTENT_FILES) {
    const file = path.join(contentDir, ...entry.file.split('/'));
    const records = recordsOf(file, entry.schema, entry.key);
    if (!records) continue;
    contentRecords[entry.schema] = records;
    const seen = new Map();
    records.forEach((record, index) => {
      if (!isObject(record) || record[entry.id] === undefined) return;
      const value = record[entry.id];
      if (seen.has(value))
        error(
          file,
          `${entry.id} repetido: ${JSON.stringify(value)} (también en ${entry.key}[${seen.get(value)}])`,
          `${entry.key}[${index}].${entry.id}`,
        );
      else seen.set(value, index);
    });
    summary.push({
      file: rel(file),
      registros: plural(records.length, ...entry.label),
      borradores: null,
    });
  }

  const pokemonIds = contentRecords.pokemon
    ? new Set(contentRecords.pokemon.filter(isObject).map((record) => record.id))
    : null;
  // Mega Stone (§16.2.3): every id of `mega.pokemon` must exist in content/pokemon.json.
  if (pokemonIds)
    for (const { file, at, pokemon } of megaChecks)
      pokemon.forEach((id, index) => {
        if (text(id) && !pokemonIds.has(id))
          error(file, `"${id}" no existe en content/pokemon.json`, `${at}[${index}]`);
      });
  const movesFile = path.join(contentDir, 'moves.json');
  contentRecords.moves?.forEach((move, index) => {
    if (!isObject(move) || !Array.isArray(move.pokemon)) return;
    move.pokemon.forEach((id, pokemonIndex) => {
      if (pokemonIds && text(id) && !pokemonIds.has(id))
        error(
          movesFile,
          `"${id}" no existe en content/pokemon.json`,
          `movimientos[${index}].pokemon[${pokemonIndex}]`,
        );
    });
  });

  /**
   * Reports a game amount written as free text in `value`, a text of a record:
   * the page would draw it without the sprite of its currency and its exact
   * name (R5, S8), and these texts have no inline amount to hold it.
   */
  const refuseFreeAmount = (file, value, at, what) => {
    const match = typeof value === 'string' ? FREE_AMOUNT.exec(value) : null;
    if (match)
      error(
        file,
        `importe del juego en texto libre («${match[0].trim()}»): ${what} no lleva importes, ` +
          'porque el sitio muestra cada importe del juego con el sprite de su moneda',
        at,
      );
  };

  // Activities (spec 3.13, 8.9): the sprite of the index entry and of the
  // banner, and the texts of the page, in each language they are written in.
  const questsFile = path.join(contentDir, 'quests.json');
  contentRecords.quests?.forEach((quest, index) => {
    if (!isObject(quest)) return;
    const at = `misiones[${index}]`;
    requireSprite(questsFile, quest.sprite, `${at}.sprite`);
    for (const field of [
      'resumen',
      'instrucciones',
      'requisitos',
      'pasos',
      'recompensas',
      'notas',
    ]) {
      const value = quest[field];
      const texts = Array.isArray(value)
        ? value.map((texto, textIndex) => ({ texto, where: `${at}.${field}[${textIndex}]` }))
        : [{ texto: value, where: `${at}.${field}` }];
      for (const { texto, where } of texts) {
        if (!isObject(texto)) continue;
        for (const lang of ['es', 'en'])
          refuseFreeAmount(
            questsFile,
            texto[lang],
            `${where}.${lang}`,
            'el texto de una actividad',
          );
      }
    }
  });

  // Elements. content/elementos.json is the only place where an element has a
  // name in each language, an icon and its Stone and Fragment (spec 8.0.5); the
  // schema fixes the 18 ids and their order. Here: its own references, and the
  // elements that Pokémon and moves name resolve to one of its entries.
  const elementosFile = path.join(contentDir, 'elementos.json');
  const elementos = contentRecords.elementos;
  /** @type {Map<string, unknown>} id of an element -> its `nombre`. */
  const elementNames = new Map();
  elementos?.forEach((elemento, index) => {
    if (!isObject(elemento) || !text(elemento.id)) return;
    const at = `elementos[${index}]`;
    elementNames.set(elemento.id, elemento.nombre);
    requireSprite(elementosFile, elemento.icono, `${at}.icono`);
    // Stone and Fragment are item ids; null while the owner has not filled them.
    for (const field of ['stone', 'fragment']) {
      const id = text(elemento[field]);
      if (id && itemIds.size > 0 && !itemIds.has(id))
        error(elementosFile, `"${id}" no existe en content/items/`, `${at}.${field}`);
    }
  });

  // Every element a Pokémon carries, in "elementos" or as "elementoMoveset", has
  // a name in both languages (spec 3.13), reported once per element and not
  // once per Pokémon.
  const named = (id) => {
    const nombre = elementNames.get(id);
    return isObject(nombre) && Boolean(text(nombre.es)) && Boolean(text(nombre.en));
  };
  const pokemonFile = path.join(contentDir, 'pokemon.json');
  if (elementos && contentRecords.pokemon) {
    /** @type {Map<string, string>} id of an element -> where it first appears. */
    const used = new Map();
    contentRecords.pokemon.forEach((pokemon, index) => {
      if (!isObject(pokemon)) return;
      if (Array.isArray(pokemon.elementos))
        pokemon.elementos.forEach((id, elementIndex) => {
          if (text(id) && !used.has(id))
            used.set(id, `pokemon[${index}].elementos[${elementIndex}]`);
        });
      const moveset = text(pokemon.elementoMoveset);
      if (moveset && !used.has(moveset)) used.set(moveset, `pokemon[${index}].elementoMoveset`);
    });
    for (const [id, at] of used) {
      if (named(id)) continue;
      error(
        pokemonFile,
        elementNames.has(id)
          ? `el elemento "${id}" necesita "nombre" en los dos idiomas en content/elementos.json`
          : `el elemento "${id}" no existe en content/elementos.json`,
        at,
      );
    }
  }

  // Every Pokémon's "tier" (a number 1…7 or a special name, spec 16.2.1) maps to a record of
  // content/tiers.json, reported once per tier and not once per Pokémon. A hidden tier
  // (ULTIMATE, `visible: false`) still needs its record: its data stays even while it is not
  // shown in the Tier list or the Tier filter.
  const tierRecords = contentRecords.tiers;
  const tierRecordIds = tierRecords
    ? new Set(tierRecords.filter(isObject).map((record) => record.id))
    : null;
  if (tierRecordIds && contentRecords.pokemon) {
    /** @type {Map<string, string>} id de content/tiers.json -> dónde aparece primero. */
    const usedTiers = new Map();
    contentRecords.pokemon.forEach((pokemon, index) => {
      if (!isObject(pokemon) || pokemon.tier === null || pokemon.tier === undefined) return;
      const id = tierRecordId(pokemon.tier);
      if (id && !usedTiers.has(id)) usedTiers.set(id, `pokemon[${index}].tier`);
    });
    for (const [id, at] of usedTiers) {
      if (!tierRecordIds.has(id))
        error(pokemonFile, `el tier "${id}" no existe en content/tiers.json`, at);
    }
  }

  // A move names its element by its id in content/elementos.json (spec 3.13),
  // and the Ataques table of the Pokémon page shows that element's name. An id
  // outside the 18 is already a schema error of moves.json.
  if (elementos)
    contentRecords.moves?.forEach((move, index) => {
      const id = isObject(move) ? text(move.elemento) : null;
      if (id === null || !elementNames.has(id) || named(id)) return;
      error(
        movesFile,
        `el elemento "${id}" necesita "nombre" en los dos idiomas en content/elementos.json`,
        `movimientos[${index}].elemento`,
      );
    });

  // The same for the «Elemento» of an item (spec 3.13, 8.5): its card, its row
  // and its panel show the element's name. Reported once per element, at the
  // first item that names it; an id outside the 18 is a schema error.
  if (elementos)
    for (const [id, where] of itemElements) {
      if (!elementNames.has(id) || named(id)) continue;
      error(
        where.file,
        `el elemento "${id}" necesita "nombre" en los dos idiomas en content/elementos.json`,
        where.at,
      );
    }

  // What the Pokémon page reads besides the Pokédex fields (spec 3.13, 8.3): the
  // id the Tier list route takes, the items of drops and evolutions, drop
  // quantities, evolution targets and chains, and the entities "donde" links.
  const itemsKnown = itemIds.size > 0;
  const questIds = contentRecords.quests
    ? new Set(contentRecords.quests.filter(isObject).map((quest) => quest.id))
    : null;
  // A system page is content/sistemas/<id>.json (spec 3.13, 8.4); while that
  // registry does not exist, no reference to a system resolves. The file name
  // is the id: the system pages below report a record whose id differs.
  const sistemasDir = path.join(contentDir, 'sistemas');
  const sistemaFiles = listFiles(sistemasDir, '.json')
    .filter((file) => path.dirname(file) === sistemasDir)
    .sort((a, b) => a.localeCompare(b));
  const sistemaIds = new Set(sistemaFiles.map((file) => path.basename(file, '.json')));
  /** The registry each `Ref.tipo` resolves in; `ids` is null when it could not be read. */
  const refTargets = new Map([
    ['pokemon', { ids: pokemonIds, where: 'content/pokemon.json' }],
    ['item', { ids: itemsKnown ? itemIds : null, where: 'content/items/' }],
    ['sistema', { ids: sistemaIds, where: 'content/sistemas/' }],
    ['actividad', { ids: questIds, where: 'content/quests.json' }],
  ]);
  const requireItem = (id, at) => {
    if (itemsKnown && text(id) && !itemIds.has(id))
      error(pokemonFile, `"${id}" no existe en content/items/`, at);
  };
  /** @type {Map<string, { to: string, at: string }[]>} Pokémon id -> the evolutions that leave it. */
  const evolutions = new Map();

  contentRecords.pokemon?.forEach((pokemon, index) => {
    if (!isObject(pokemon)) return;
    const at = `pokemon[${index}]`;

    // /pokedex/tiers/ is the Tier list (spec 8.8): a Pokémon page there would
    // never be reached, whatever milestone ships the route.
    if (pokemon.id === 'tiers')
      error(
        pokemonFile,
        '"tiers" no puede ser el id de un Pokémon: /pokedex/tiers/ es la Tier list',
        `${at}.id`,
      );

    if (Array.isArray(pokemon.drops)) {
      const seen = new Set();
      pokemon.drops.forEach((drop, dropIndex) => {
        if (!isObject(drop)) return;
        const dropAt = `${at}.drops[${dropIndex}]`;
        const item = text(drop.item);
        if (item) {
          // One entry per item: the Drops list anchors each one by its id.
          if (seen.has(item)) error(pokemonFile, `drop repetido: "${item}"`, `${dropAt}.item`);
          seen.add(item);
          requireItem(item, `${dropAt}.item`);
        }
        const { cantidad } = drop;
        if (
          isObject(cantidad) &&
          Number.isInteger(cantidad.min) &&
          Number.isInteger(cantidad.max) &&
          cantidad.max < cantidad.min
        )
          error(
            pokemonFile,
            `cantidad.max (${cantidad.max}) no puede ser menor que cantidad.min (${cantidad.min})`,
            `${dropAt}.cantidad.max`,
          );
      });
    }

    if (Array.isArray(pokemon.evolucion)) {
      const targets = new Set();
      pokemon.evolucion.forEach((step, stepIndex) => {
        if (!isObject(step)) return;
        const stepAt = `${at}.evolucion[${stepIndex}]`;
        const target = text(step.a);
        if (target) {
          if (targets.has(target))
            error(pokemonFile, `evolución repetida: "${target}"`, `${stepAt}.a`);
          else if (pokemonIds && !pokemonIds.has(target))
            error(pokemonFile, `"${target}" no existe en content/pokemon.json`, `${stepAt}.a`);
          else if (text(pokemon.id)) {
            const edges = evolutions.get(pokemon.id) ?? [];
            edges.push({ to: target, at: `${stepAt}.a` });
            evolutions.set(pokemon.id, edges);
          }
          targets.add(target);
        }
        if (Array.isArray(step.items))
          step.items.forEach((entry, itemIndex) => {
            if (isObject(entry)) requireItem(entry.item, `${stepAt}.items[${itemIndex}].item`);
          });
      });
    }

    if (isObject(pokemon.donde))
      for (const key of ['hunts', 'linkedTasks', 'equiposNpc']) {
        const links = pokemon.donde[key];
        if (!Array.isArray(links)) continue;
        links.forEach((link, linkIndex) => {
          const ref = isObject(link) ? link.ref : undefined;
          if (!isObject(ref) || !text(ref.id)) return;
          const target = refTargets.get(ref.tipo);
          if (!target?.ids || target.ids.has(ref.id)) return;
          error(
            pokemonFile,
            `"${ref.id}" no existe en ${target.where}`,
            `${at}.donde.${key}[${linkIndex}].ref.id`,
          );
        });
      }
  });

  // No evolution chain comes back to one of its own Pokémon (spec 3.13): the
  // chain starts at the stage no record names in "a", and a circle has none.
  // Each circle is reported once, at the evolution that closes it.
  const visiting = new Set();
  const visited = new Set();
  const trail = [];
  const circles = new Set();
  const walk = (id) => {
    visiting.add(id);
    trail.push(id);
    for (const edge of evolutions.get(id) ?? []) {
      if (visiting.has(edge.to)) {
        const circle = trail.slice(trail.indexOf(edge.to));
        const key = [...circle].sort().join(' ');
        if (circles.has(key)) continue;
        circles.add(key);
        error(
          pokemonFile,
          `cadena de evolución circular: ${[...circle, edge.to].join(' → ')}`,
          edge.at,
        );
      } else if (!visited.has(edge.to)) {
        walk(edge.to);
      }
    }
    trail.pop();
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of evolutions.keys()) if (!visited.has(id)) walk(id);

  // System pages (spec 3.13, 8.4). The schema fixes the shape of every block
  // and inline piece; here, block by block, what a schema cannot see: the id
  // is the file name, `orden` does not repeat, sprites, entities, anchors and
  // routes resolve, tables have one cell per column, a section has one note at
  // most, both languages name the same links and amounts, and no game amount
  // is written as free text.
  const realCategories = categoriaRecords
    ? new Set(categorias.filter((entry) => entry.virtual !== true).map((entry) => entry.id))
    : null;
  /** Why `ruta` (a route without locale) is not a page of the site, or null. */
  const routeProblem = (ruta) => {
    const parts = ruta.split('/').filter(Boolean);
    if (parts[0] === 'es' || parts[0] === 'en')
      return `la ruta va sin idioma: "/${parts.slice(1).join('/')}${parts.length > 1 ? '/' : ''}"`;
    if (STATIC_ROUTES.has(ruta)) return null;
    const [first, second, third] = parts;
    const missing = (ids, where) =>
      ids && !ids.has(parts.at(-1)) ? `"${parts.at(-1)}" no existe en ${where}` : null;
    if (parts.length === 2 && first === 'pokedex')
      return missing(pokemonIds, 'content/pokemon.json');
    if (parts.length === 2 && first === 'sistemas') return missing(sistemaIds, 'content/sistemas/');
    if (parts.length === 2 && first === 'actividades')
      return missing(questIds, 'content/quests.json');
    if (parts.length === 3 && first === 'items' && second === 'c' && text(third))
      return missing(realCategories, 'las categorías de content/items/categorias.json');
    return `la ruta ${ruta} no es una página del sitio`;
  };
  /** System item ids per system (`sistema` of content/system-items.json). */
  const itemsOfSystem = new Map();
  const systemItemsFile = path.join(contentDir, 'system-items.json');
  contentRecords['system-items']?.forEach((objeto, index) => {
    if (!isObject(objeto)) return;
    // Its slot, its row and its panel draw this sprite (E16, 7.4.1).
    requireSprite(systemItemsFile, objeto.sprite, `objetos[${index}].sprite`);
    // `sistema` is the page whose «Ítems» section lists it (8.4.2 step 6).
    if (text(objeto.sistema) && !sistemaIds.has(objeto.sistema))
      error(
        systemItemsFile,
        `"${objeto.sistema}" no existe en content/sistemas/`,
        `objetos[${index}].sistema`,
      );
    if (!text(objeto.sistema) || !text(objeto.id)) return;
    const ids = itemsOfSystem.get(objeto.sistema) ?? [];
    ids.push(objeto.id);
    itemsOfSystem.set(objeto.sistema, ids);
  });
  /** The link or amount an inline piece carries, as one comparable string. */
  const inlineKey = (piece) => {
    if (!isObject(piece)) return null;
    if (isObject(piece.entidad)) return `entidad ${piece.entidad.tipo}:${piece.entidad.id}`;
    if (text(piece.ancla)) return `#${piece.ancla}`;
    if (text(piece.ruta)) return piece.ruta;
    if (piece.pd !== undefined) return `pd ${piece.pd}`;
    if (piece.dia !== undefined) return `dia ${piece.dia}`;
    return null;
  };

  const ordenes = new Map();
  let sistemaCount = 0;
  let sistemaDrafts = 0;
  /** Ids of the draft system pages: a build with OCULTAR_BORRADORES=1 writes none of them. */
  const draftSistemaIds = new Set();
  for (const file of sistemaFiles) {
    const { data: sistema } = read(file, 'sistemas');
    if (!isObject(sistema)) continue;
    sistemaCount++;
    const fileId = path.basename(file, '.json');
    if (sistema.borrador === true) {
      sistemaDrafts++;
      draftSistemaIds.add(fileId);
    }
    if (text(sistema.id) && sistema.id !== fileId)
      error(file, `el id debe ser igual al nombre del archivo: "${fileId}"`, 'id');
    if (Number.isInteger(sistema.orden)) {
      const other = ordenes.get(sistema.orden);
      if (other) error(file, `orden ${sistema.orden} repetido (también en ${other})`, 'orden');
      else ordenes.set(sistema.orden, rel(file));
    }
    requireSprite(file, sistema.sprite, 'sprite');
    if (isObject(sistema.banner)) {
      requireSprite(file, sistema.banner.sprite, 'banner.sprite');
      const { datos } = sistema.banner;
      if (isObject(datos) && Array.isArray(datos.es) && Array.isArray(datos.en))
        if (datos.es.length !== datos.en.length)
          error(
            file,
            `el banner tiene ${datos.es.length} datos en es y ${datos.en.length} en en: son los mismos datos en los dos idiomas`,
            'banner.datos',
          );
    }

    const secciones = Array.isArray(sistema.secciones) ? sistema.secciones : [];
    const intro = Array.isArray(sistema.intro) ? sistema.intro : [];
    if (
      sistema.borrador !== true &&
      intro.length === 0 &&
      secciones.length === 0 &&
      !isObject(sistema.banner)
    )
      error(
        file,
        'un sistema publicado necesita "intro", "banner" o "secciones"; mientras no los tenga, lleva "borrador": true',
      );

    // Anchors of this page: its sections, and the automatic «Ítems» section
    // with one anchor per item when the system has items (spec 8.4.2, H7).
    const anchors = new Set();
    const systemItems = itemsOfSystem.get(fileId) ?? [];
    if (systemItems.length > 0) {
      anchors.add('items');
      for (const id of systemItems) anchors.add(`item-${id}`);
    }
    secciones.forEach((seccion, index) => {
      if (!isObject(seccion) || !text(seccion.id)) return;
      const at = `secciones[${index}].id`;
      if (RESERVED_SECTION_IDS.has(seccion.id) || seccion.id.startsWith(RESERVED_SECTION_PREFIX))
        error(
          file,
          `"${seccion.id}" es un id reservado de la página y no puede ser una sección`,
          at,
        );
      else if (anchors.has(seccion.id)) error(file, `sección repetida: "${seccion.id}"`, at);
      else anchors.add(seccion.id);
    });

    /** Checks the links of one block text ({ es: EnLinea[], en: EnLinea[] }). */
    const checkInline = (value, at) => {
      if (!isObject(value)) return;
      for (const lang of ['es', 'en']) {
        if (!Array.isArray(value[lang])) continue;
        value[lang].forEach((piece, index) => {
          if (!isObject(piece)) return;
          const where = `${at}.${lang}[${index}]`;
          if (text(piece.ancla) && !anchors.has(piece.ancla))
            error(
              file,
              `el ancla "#${piece.ancla}" no es una sección de esta página`,
              `${where}.ancla`,
            );
          if (text(piece.ruta)) {
            const problem = routeProblem(piece.ruta);
            if (problem) error(file, problem, `${where}.ruta`);
          }
          if (isObject(piece.entidad) && text(piece.entidad.id)) {
            const target = refTargets.get(piece.entidad.tipo);
            if (target?.ids && !target.ids.has(piece.entidad.id))
              error(
                file,
                `"${piece.entidad.id}" no existe en ${target.where}`,
                `${where}.entidad.id`,
              );
          }
        });
      }
      if (!Array.isArray(value.es) || !Array.isArray(value.en)) return;
      const keys = (pieces) => pieces.map(inlineKey).filter(Boolean).sort();
      const [es, en] = [keys(value.es), keys(value.en)];
      if (JSON.stringify(es) !== JSON.stringify(en))
        error(
          file,
          `es y en deben nombrar las mismas entidades, enlaces e importes ` +
            `(es: ${es.join(', ') || 'ninguno'}; en: ${en.join(', ') || 'ninguno'})`,
          at,
        );
    };

    /** Checks one block; `at` is its path in the file. */
    const checkBlock = (bloque, at, notes) => {
      if (!isObject(bloque)) return;
      switch (bloque.tipo) {
        case 'parrafo':
        case 'nota':
          checkInline(bloque.texto, `${at}.texto`);
          if (bloque.tipo === 'nota' && notes.count++ > 0)
            error(file, 'una sección lleva como mucho una nota', at);
          break;
        case 'pasos':
          if (Array.isArray(bloque.pasos))
            bloque.pasos.forEach((paso, index) => {
              if (!isObject(paso)) return;
              const pasoAt = `${at}.pasos[${index}]`;
              requireSprite(file, paso.sprite, `${pasoAt}.sprite`);
              checkInline(paso.texto, `${pasoAt}.texto`);
              if (Array.isArray(paso.chips))
                paso.chips.forEach((chip, chipIndex) =>
                  checkInline(chip, `${pasoAt}.chips[${chipIndex}]`),
                );
            });
          break;
        case 'tabla': {
          const columns = Array.isArray(bloque.columnas) ? bloque.columnas.length : null;
          if (!Array.isArray(bloque.filas)) break;
          bloque.filas.forEach((fila, rowIndex) => {
            if (!Array.isArray(fila)) return;
            const rowAt = `${at}.filas[${rowIndex}]`;
            if (columns !== null && fila.length !== columns)
              error(
                file,
                `la fila tiene ${plural(fila.length, 'celda', 'celdas')} y la tabla ${plural(columns, 'columna', 'columnas')}`,
                rowAt,
              );
            fila.forEach((celda, cellIndex) => {
              const cellAt = `${rowAt}[${cellIndex}]`;
              if (!isObject(celda)) return;
              if (text(celda.elemento)) {
                if (elementos && elementNames.has(celda.elemento) && !named(celda.elemento))
                  error(
                    file,
                    `el elemento "${celda.elemento}" necesita "nombre" en los dos idiomas en content/elementos.json`,
                    `${cellAt}.elemento`,
                  );
              } else checkInline(celda, cellAt);
            });
          });
          break;
        }
        case 'tarjetas':
          if (Array.isArray(bloque.tarjetas))
            bloque.tarjetas.forEach((tarjeta, index) => {
              if (!isObject(tarjeta)) return;
              requireSprite(file, tarjeta.sprite, `${at}.tarjetas[${index}].sprite`);
              checkInline(tarjeta.texto, `${at}.tarjetas[${index}].texto`);
            });
          break;
        case 'chips':
          if (Array.isArray(bloque.chips))
            bloque.chips.forEach((chip, index) => checkInline(chip, `${at}.chips[${index}]`));
          break;
        case 'lista':
          if (Array.isArray(bloque.puntos))
            bloque.puntos.forEach((punto, index) => checkInline(punto, `${at}.puntos[${index}]`));
          break;
        default:
          break;
      }
    };

    intro.forEach((bloque, index) => checkBlock(bloque, `intro[${index}]`, { count: 0 }));
    secciones.forEach((seccion, index) => {
      if (!isObject(seccion) || !Array.isArray(seccion.bloques)) return;
      const notes = { count: 0 };
      seccion.bloques.forEach((bloque, blockIndex) =>
        checkBlock(bloque, `secciones[${index}].bloques[${blockIndex}]`, notes),
      );
    });

    // Every prose string of the record: titles, labels, banner facts, tooltip
    // rows and the text pieces of every block.
    const walkProse = (value, at) => {
      if (typeof value === 'string') {
        const match = FREE_AMOUNT.exec(value);
        if (match)
          error(
            file,
            `importe del juego en texto libre («${match[0].trim()}»): en el texto de un bloque va como { "pd": entero } o { "dia": entero }`,
            at,
          );
        return;
      }
      if (Array.isArray(value)) {
        value.forEach((item, index) => walkProse(item, `${at}[${index}]`));
        return;
      }
      if (!isObject(value)) return;
      for (const [key, child] of Object.entries(value))
        if (!NOT_PROSE.has(key)) walkProse(child, at ? `${at}.${key}` : key);
    };
    walkProse(sistema, '');
  }
  if (sistemaFiles.length > 0)
    summary.push({
      file: `${rel(sistemasDir)}/`,
      registros: plural(sistemaCount, 'sistema', 'sistemas'),
      borradores: sistemaDrafts,
    });

  const floorsFile = path.join(contentDir, 'map', 'floors.json');
  contentRecords['map-floors']?.forEach((floor, index) => {
    if (!isObject(floor) || !text(floor.imagen)?.startsWith('/')) return;
    const at = `pisos[${index}].imagen`;
    const image = path.join(root, 'public', ...floor.imagen.split('/').filter(Boolean));
    if (!existsSync(image) || !statSync(image).isFile()) {
      error(floorsFile, `la imagen public${floor.imagen} no existe`, at);
      return;
    }
    const size = readPngSize(image);
    if (!size) error(floorsFile, `public${floor.imagen} no es un PNG válido`, at);
    else if (size.width !== floor.ancho || size.height !== floor.alto)
      error(
        floorsFile,
        `public${floor.imagen} mide ${size.width}×${size.height} y el piso dice ${floor.ancho}×${floor.alto}`,
        at,
      );
  });

  // Outfits and addons.
  const outfitsFile = path.join(contentDir, 'outfits.json');
  const outfits = recordsOf(outfitsFile, 'outfits', 'outfits');
  if (outfits) {
    const seenPokemon = new Set();
    const seenAddons = new Set();
    const outfitOwners = new Map();
    let addonCount = 0;
    let draftCount = 0;
    outfits.forEach((outfit, index) => {
      if (!isObject(outfit)) return;
      const at = `outfits[${index}]`;
      if (text(outfit.pokemon)) {
        if (seenPokemon.has(outfit.pokemon))
          error(outfitsFile, `Pokémon repetido: "${outfit.pokemon}"`, `${at}.pokemon`);
        seenPokemon.add(outfit.pokemon);
        if (pokemonIds && !pokemonIds.has(outfit.pokemon))
          error(
            outfitsFile,
            `"${outfit.pokemon}" no existe en content/pokemon.json`,
            `${at}.pokemon`,
          );
      }
      if (isPositiveInteger(outfit.outfitId)) {
        const key = `outfits/${outfit.outfitId}`;
        if (spritesKnown && !Object.hasOwn(sprites, key))
          error(
            outfitsFile,
            `el sprite "${key}" no existe; regístralo con pnpm assets:outfits -- --id ${outfit.outfitId} --registrar`,
            `${at}.outfitId`,
          );
        else if (spritesKnown && !isObject(sprites[key]?.direcciones))
          error(outfitsFile, `el sprite "${key}" necesita "direcciones"`, `${at}.outfitId`);
        const owner = outfitOwners.get(outfit.outfitId);
        if (owner)
          warn(
            outfitsFile,
            `el outfit ${outfit.outfitId} también es de "${owner}"`,
            `${at}.outfitId`,
          );
        else outfitOwners.set(outfit.outfitId, outfit.pokemon);
      }
      if (outfit.borrador === true) draftCount++;
      if (!Array.isArray(outfit.addons)) return;
      outfit.addons.forEach((addon, addonIndex) => {
        if (!isObject(addon)) return;
        const addonAt = `${at}.addons[${addonIndex}]`;
        addonCount++;
        if (addon.borrador === true) draftCount++;
        if (text(addon.id)) {
          if (seenAddons.has(addon.id))
            error(outfitsFile, `id de addon repetido: "${addon.id}"`, `${addonAt}.id`);
          seenAddons.add(addon.id);
        }
        requireSprite(outfitsFile, addon.sprite, `${addonAt}.sprite`);
      });
    });
    summary.push({
      file: rel(outfitsFile),
      registros: `${plural(outfits.length, 'outfit', 'outfits')}, ${plural(addonCount, 'addon', 'addons')}`,
      borradores: draftCount,
    });
  }

  // Auras.
  const aurasFile = path.join(contentDir, 'auras.json');
  const auras = recordsOf(aurasFile, 'auras', 'auras');
  if (auras) {
    const seen = new Set();
    auras.forEach((aura, index) => {
      if (!isObject(aura)) return;
      const at = `auras[${index}]`;
      if (text(aura.id)) {
        if (seen.has(aura.id)) error(aurasFile, `id repetido: "${aura.id}"`, `${at}.id`);
        seen.add(aura.id);
      }
      requireSprite(aurasFile, aura.icono, `${at}.icono`);
    });
    summary.push({
      file: rel(aurasFile),
      registros: plural(auras.length, 'aura', 'auras'),
      borradores: drafts(auras.filter(isObject)),
    });
  }

  // Whether the build writes the page of a route that `routeProblem` accepts. The
  // routes of spec 8.0.1 arrive with the milestone that builds their page (the
  // Actividades pages with M11), so a route of the site whose record exists may
  // still have no page. The pages are the files of src/pages/[locale]/: a static
  // route is `<ruta>.astro` or `<ruta>/index.astro`; a route with a parameter (a
  // Pokémon, a system, an activity, a Market category), whose value
  // `routeProblem` already resolved against its registry, is the template
  // `[name].astro` of its folder. A copy of the registries without src/pages/ (the
  // tests of this check copy content/ and public/ alone) resolves routes against
  // the registries only.
  const pagesDir = path.join(root, 'src', 'pages', '[locale]');
  const pagesKnown = existsSync(pagesDir) && statSync(pagesDir).isDirectory();
  const isFile = (file) => existsSync(file) && statSync(file).isFile();
  /** Why the build writes no page for `ruta`, or null. */
  const pageProblem = (ruta) => {
    if (!pagesKnown) return null;
    const parts = ruta.split('/').filter(Boolean);
    const folder = path.join(pagesDir, ...parts.slice(0, -1));
    const last = parts.at(-1);
    const found = STATIC_ROUTES.has(ruta)
      ? (last === undefined ? ['index.astro'] : [`${last}.astro`, path.join(last, 'index.astro')])
          .map((page) => path.join(folder, page))
          .some(isFile)
      : existsSync(folder) &&
        statSync(folder).isDirectory() &&
        readdirSync(folder).some(
          (name) => PAGE_TEMPLATE.test(name) && isFile(path.join(folder, name)),
        );
    return found ? null : `la página ${ruta} aún no existe: no está en src/pages/[locale]/`;
  };

  // The Destacados of the Inicio (spec 3.13, 8.1): 1 to 4 pages that the Inicio,
  // Buscar and the 404 feature and that the menu pins (8.0.3). The file is the
  // owner's and may be missing: then there are no Destacados (8.1, «Estados»).
  // When it exists, each entry leads to a page the build writes, no two entries
  // lead to the same page (G10) and each sprite is a key of the sprite registry.
  // A build with OCULTAR_BORRADORES=1 writes no page for a draft system, so a
  // published entry cannot lead to one; a draft entry can, since that build hides
  // both.
  const destacadosFile = path.join(contentDir, 'destacados.json');
  if (existsSync(destacadosFile)) {
    const destacados = recordsOf(destacadosFile, 'destacados', 'destacados');
    // A route that breaks the pattern of its schema is reported by the schema, once.
    const pattern = schemas.destacados?.$defs?.destacado?.properties?.ruta?.pattern;
    const routeShape = typeof pattern === 'string' ? new RegExp(pattern, 'u') : null;
    const seen = new Map();
    destacados?.forEach((destacado, index) => {
      if (!isObject(destacado)) return;
      const at = `destacados[${index}]`;
      requireSprite(destacadosFile, destacado.sprite, `${at}.sprite`);
      const ruta = text(destacado.ruta);
      if (!ruta || (routeShape && !routeShape.test(ruta))) return;
      if (seen.has(ruta)) {
        error(
          destacadosFile,
          `ruta repetida: "${ruta}" (también en destacados[${seen.get(ruta)}])`,
          `${at}.ruta`,
        );
        return;
      }
      seen.set(ruta, index);
      const [first, id, extra] = ruta.split('/').filter(Boolean);
      const draftPage =
        destacado.borrador !== true &&
        first === 'sistemas' &&
        extra === undefined &&
        draftSistemaIds.has(id);
      const problem =
        routeProblem(ruta) ??
        pageProblem(ruta) ??
        (draftPage
          ? `${ruta} es la página de un sistema en borrador, que OCULTAR_BORRADORES=1 no escribe: marca también este destacado con "borrador": true o publica el sistema`
          : null);
      if (problem) error(destacadosFile, problem, `${at}.ruta`);
    });
    if (destacados)
      summary.push({
        file: rel(destacadosFile),
        registros: plural(destacados.length, 'destacado', 'destacados'),
        borradores: drafts(destacados.filter(isObject)),
      });
  }

  // The worlds of the Inicio (spec 3.13, 8.1): the owner's list, which may be
  // missing or empty (then the Inicio draws no Worlds table). The id is unique,
  // as in every registry, and so is the name: the table shows the name alone.
  const mundosFile = path.join(contentDir, 'mundos.json');
  /** @type {Set<string> | null} The world ids a Comercio listing may name; null without the file. */
  let mundoIds = null;
  if (existsSync(mundosFile)) {
    const mundos = recordsOf(mundosFile, 'mundos', 'mundos');
    const ids = new Map();
    const names = new Map();
    mundos?.forEach((mundo, index) => {
      if (!isObject(mundo)) return;
      const at = `mundos[${index}]`;
      const id = text(mundo.id);
      if (id) {
        if (ids.has(id))
          error(mundosFile, `id repetido: "${id}" (también en mundos[${ids.get(id)}])`, `${at}.id`);
        else ids.set(id, index);
      }
      const nombre = text(mundo.nombre);
      const key = nombre?.trim().toLocaleLowerCase('en');
      if (key) {
        if (names.has(key))
          error(
            mundosFile,
            `nombre repetido: "${nombre}" (también en mundos[${names.get(key)}])`,
            `${at}.nombre`,
          );
        else names.set(key, index);
      }
    });
    mundoIds = new Set(ids.keys());
    if (mundos)
      summary.push({
        file: rel(mundosFile),
        registros: plural(mundos.length, 'mundo', 'mundos'),
        borradores: null,
      });
  }

  // Cambios (spec 3.13, 8.7): the owner's list, written by hand (R10), which may
  // be missing or empty (then the page shows its empty state). The schema fixes
  // the shape and the day of the calendar of `fecha`; here, what it cannot see:
  // the id is unique, each entity resolves in its registry (a missing one stops
  // the check, 8.7) and is named once per entry, since each one is a chip of the
  // step; the sprite is a key of the sprite registry; the points are the same in
  // both languages; and no game amount is written as free text.
  const cambiosFile = path.join(contentDir, 'cambios.json');
  if (existsSync(cambiosFile)) {
    const cambios = recordsOf(cambiosFile, 'cambios', 'cambios');
    const ids = new Map();
    cambios?.forEach((cambio, index) => {
      if (!isObject(cambio)) return;
      const at = `cambios[${index}]`;
      const id = text(cambio.id);
      if (id) {
        if (ids.has(id))
          error(
            cambiosFile,
            `id repetido: "${id}" (también en cambios[${ids.get(id)}])`,
            `${at}.id`,
          );
        else ids.set(id, index);
      }
      requireSprite(cambiosFile, cambio.sprite, `${at}.sprite`);

      if (Array.isArray(cambio.entidades)) {
        const named = new Map();
        cambio.entidades.forEach((ref, refIndex) => {
          if (!isObject(ref) || !text(ref.tipo) || !text(ref.id)) return;
          const where = `${at}.entidades[${refIndex}]`;
          const key = `${ref.tipo} ${ref.id}`;
          if (named.has(key)) {
            error(
              cambiosFile,
              `entidad repetida: ${ref.tipo} "${ref.id}" (también en entidades[${named.get(key)}])`,
              where,
            );
            return;
          }
          named.set(key, refIndex);
          const target = refTargets.get(ref.tipo);
          if (target?.ids && !target.ids.has(ref.id))
            error(cambiosFile, `"${ref.id}" no existe en ${target.where}`, `${where}.id`);
        });
      }

      const { titulo, puntos } = cambio;
      if (
        isObject(puntos) &&
        Array.isArray(puntos.es) &&
        Array.isArray(puntos.en) &&
        puntos.es.length !== puntos.en.length
      )
        error(
          cambiosFile,
          `el cambio tiene ${plural(puntos.es.length, 'punto', 'puntos')} en es y ${puntos.en.length} en en: son los mismos puntos en los dos idiomas`,
          `${at}.puntos`,
        );
      for (const lang of ['es', 'en']) {
        if (isObject(titulo))
          refuseFreeAmount(
            cambiosFile,
            titulo[lang],
            `${at}.titulo.${lang}`,
            'el texto de un cambio',
          );
        if (isObject(puntos) && Array.isArray(puntos[lang]))
          puntos[lang].forEach((punto, pointIndex) =>
            refuseFreeAmount(
              cambiosFile,
              punto,
              `${at}.puntos.${lang}[${pointIndex}]`,
              'el texto de un cambio',
            ),
          );
      }
    });
    if (cambios)
      summary.push({
        file: rel(cambiosFile),
        registros: plural(cambios.length, 'cambio', 'cambios'),
        borradores: drafts(cambios.filter(isObject)),
      });
  }

  // Comercio, phase A (spec 9.2, 9.4): the sample listings and sellers of content/comercio/.
  // Only COMERCIO_DEMO=1 reads them (the dev server of the tests, a demo or a visual build) and
  // never a production build (CA-9.1). They are demo data, not offers, so every record carries
  // "borrador": true, whatever OCULTAR_BORRADORES says. The folder may be missing; when one of its
  // two files exists, so does the other. The schema fixes the shape, the ranges and «A convenir»;
  // here, what it cannot see: unique ids; the sellers, worlds, Pokémon, auras, items, addons and
  // listings the records name; the name of a declared entity against the id it stores (9.4); the
  // other price rules of 9.7.4; the Ditto Memory (9.7.2); one entry per training skill; the days
  // of the calendar; one channel per type; and the reviews (9.10).
  const comercioDir = path.join(contentDir, 'comercio');
  const anunciosFile = path.join(comercioDir, 'anuncios.json');
  const vendedoresFile = path.join(comercioDir, 'vendedores.json');
  if (existsSync(anunciosFile) || existsSync(vendedoresFile)) {
    /** The records of one of the two files, or null. The schema accepts either list in either file. */
    const comercioRecords = (file, key) => {
      const { data } = read(file, 'comercio');
      if (!isObject(data)) return null;
      if (!Object.hasOwn(data, key)) error(file, `este archivo lleva la lista "${key}"`);
      return Array.isArray(data[key]) ? data[key] : null;
    };
    const anuncios = comercioRecords(anunciosFile, 'anuncios');
    const vendedores = comercioRecords(vendedoresFile, 'vendedores');

    /** A name as 9.4 compares it with a record: without case and without accents. */
    const fold = (value) => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
    const instantPattern = schemas.comercio?.$defs?.instante?.pattern;
    const instantShape =
      typeof instantPattern === 'string' ? new RegExp(instantPattern, 'u') : null;
    /**
     * The epoch milliseconds of an instant the schema accepts, reporting a day the calendar does
     * not have («2026-02-30»); NaN for anything else, which the schema already reports.
     */
    const instantOf = (file, value, at) => {
      if (typeof value !== 'string' || !instantShape?.test(value)) return Number.NaN;
      const [year, month, day] = value.slice(0, 10).split('-').map(Number);
      const date = new Date(Date.UTC(year, month - 1, day));
      if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
        error(file, `"${value}" no es un día del calendario`, at);
        return Number.NaN;
      }
      return Date.parse(value);
    };
    const requireDraft = (file, record, at) => {
      if (record.borrador !== true)
        error(
          file,
          'un registro de Comercio lleva "borrador": true: es un dato de demostración, no una oferta (§9.4)',
          `${at}.borrador`,
        );
    };
    const auraIds = auras ? new Set(auras.filter(isObject).map((aura) => aura.id)) : null;
    /** The addons content/outfits.json gives this Pokémon: never those of its base species. */
    const addonsOf = (pokemon) => {
      const outfit = outfits?.find((entry) => isObject(entry) && entry.pokemon === pokemon);
      return isObject(outfit) && Array.isArray(outfit.addons) ? outfit.addons.filter(isObject) : [];
    };
    /**
     * An equipment id chosen in a picker (16.2.5): it exists in content/items/ and, for a slot,
     * is of the category of that slot.
     */
    const checkItemId = (at, id, categoria, what) => {
      if (!itemsKnown || !text(id)) return null;
      const record = itemRecords.get(id);
      if (!record) {
        error(anunciosFile, `"${id}" no existe en content/items/`, at);
        return null;
      }
      if (categoria !== null && record.categoria !== categoria) {
        error(
          anunciosFile,
          `"${id}" es de la categoría "${record.categoria}" y ${what} es de "${categoria}"`,
          at,
        );
        return null;
      }
      return record;
    };
    /** Reports repeated ids of a list (auras, addons). */
    const checkUnique = (list, at) => {
      const seen = new Set();
      list.forEach((id, i) => {
        if (seen.has(id)) error(anunciosFile, `id repetido: "${id}"`, `${at}[${i}]`);
        seen.add(id);
      });
    };

    /** @type {Map<string, number>} handle -> index in vendedores. */
    const sellers = new Map();
    vendedores?.forEach((vendedor, index) => {
      if (!isObject(vendedor) || !text(vendedor.id)) return;
      if (sellers.has(vendedor.id))
        error(
          vendedoresFile,
          `id repetido: "${vendedor.id}" (también en vendedores[${sellers.get(vendedor.id)}])`,
          `vendedores[${index}].id`,
        );
      else sellers.set(vendedor.id, index);
    });

    /** @type {Map<string, { index: number, vendedor: unknown, publicado: number }>} */
    const listings = new Map();
    anuncios?.forEach((anuncio, index) => {
      if (!isObject(anuncio)) return;
      const at = `anuncios[${index}]`;
      requireDraft(anunciosFile, anuncio, at);
      const publicado = instantOf(anunciosFile, anuncio.publicado, `${at}.publicado`);
      const expira = instantOf(anunciosFile, anuncio.expira, `${at}.expira`);
      if (!Number.isNaN(publicado) && !Number.isNaN(expira) && expira <= publicado)
        error(anunciosFile, 'expira debe ser posterior a publicado', `${at}.expira`);
      if (text(anuncio.id)) {
        const other = listings.get(anuncio.id);
        if (other)
          error(
            anunciosFile,
            `id repetido: "${anuncio.id}" (también en anuncios[${other.index}])`,
            `${at}.id`,
          );
        else listings.set(anuncio.id, { index, vendedor: anuncio.vendedor, publicado });
      }
      if (vendedores && text(anuncio.vendedor) && !sellers.has(anuncio.vendedor))
        error(
          anunciosFile,
          `"${anuncio.vendedor}" no existe en content/comercio/vendedores.json`,
          `${at}.vendedor`,
        );
      if (text(anuncio.mundo)) {
        if (mundoIds === null)
          error(
            anunciosFile,
            'falta content/mundos.json: el mundo de un anuncio es un id de ese registro',
            `${at}.mundo`,
          );
        else if (!mundoIds.has(anuncio.mundo))
          error(anunciosFile, `"${anuncio.mundo}" no existe en content/mundos.json`, `${at}.mundo`);
      }

      // 9.7.4: two in-game options are of different currencies, and a listing of Diamonds or of
      // Pokédólares is not paid in its own currency.
      const precio = anuncio.precio;
      if (isObject(precio) && Array.isArray(precio.juego)) {
        const tipos = precio.juego.filter(isObject).map((option) => option.tipo);
        if (tipos.length === 2 && tipos[0] === tipos[1])
          error(
            anunciosFile,
            'las dos opciones del precio en el juego son de la misma moneda (§9.7.4)',
            `${at}.precio.juego`,
          );
        if (
          (anuncio.tipo === 'diamonds' || anuncio.tipo === 'pokedolares') &&
          tipos.includes(anuncio.tipo)
        )
          error(
            anunciosFile,
            `un anuncio de ${anuncio.tipo === 'diamonds' ? 'Diamonds' : 'Pokédólares'} no se paga con su propia moneda (§9.7.4)`,
            `${at}.precio.juego`,
          );
      }

      if (anuncio.tipo === 'items' && isObject(anuncio.item)) {
        if (!text(anuncio.item.item)) error(anunciosFile, 'falta el item', `${at}.item.item`);
        else checkItemId(`${at}.item.item`, anuncio.item.item, null, 'el item');
      }
      if (anuncio.tipo !== 'pokemon' || !isObject(anuncio.pokemon)) return;
      const unit = anuncio.pokemon;
      const where = `${at}.pokemon`;
      if (pokemonIds && text(unit.pokemon) && !pokemonIds.has(unit.pokemon))
        error(
          anunciosFile,
          `"${unit.pokemon}" no existe en content/pokemon.json`,
          `${where}.pokemon`,
        );
      checkItemId(`${where}.ball`, unit.ball, 'poke-balls', 'una Ball');
      for (const slot of ['x', 'y']) {
        const key = slot === 'x' ? 'heldX' : 'heldY';
        const record = checkItemId(`${where}.${key}`, unit[key], null, 'un held');
        if (record && (!isObject(record.held) || record.held.ranura !== slot))
          error(anunciosFile, `"${unit[key]}" no es un held de la ranura ${slot.toUpperCase()}`, `${where}.${key}`);
      }
      const mega = checkItemId(`${where}.mega`, unit.mega, null, 'una Mega Stone');
      if (mega && !isObject(mega.mega))
        error(anunciosFile, `"${unit.mega}" no es una Mega Stone`, `${where}.mega`);
      const unitAuras = Array.isArray(unit.auras) ? unit.auras.filter(text) : [];
      checkUnique(unitAuras, `${where}.auras`);
      if (auraIds)
        unitAuras.forEach((id, i) => {
          if (!auraIds.has(id))
            error(anunciosFile, `"${id}" no existe en content/auras.json`, `${where}.auras[${i}]`);
        });
      // The addons are this Pokémon's in content/outfits.json (9.7.2).
      const unitAddons = Array.isArray(unit.addons) ? unit.addons.filter(text) : [];
      checkUnique(unitAddons, `${where}.addons`);
      if (text(unit.pokemon)) {
        const addons = addonsOf(unit.pokemon);
        unitAddons.forEach((id, i) => {
          if (!addons.some((entry) => entry.id === id))
            error(
              anunciosFile,
              `"${id}" no es un addon de "${unit.pokemon}" en content/outfits.json`,
              `${where}.addons[${i}]`,
            );
        });
      }

      // Ditto Memory (9.7.2): Memory Slots and the memories are only for Ditto and Shiny Ditto,
      // which declare their slots, with one memory per slot (`null` for an empty one).
      const ditto = unit.pokemon === 'ditto' || unit.pokemon === 'shiny-ditto';
      const memorias = Array.isArray(unit.memorias) ? unit.memorias : [];
      if (!ditto) {
        if (unit.memorySlots !== null && unit.memorySlots !== undefined)
          error(
            anunciosFile,
            'Memory Slots solo va con Ditto y Shiny Ditto (§9.7.2)',
            `${where}.memorySlots`,
          );
        if (memorias.length > 0)
          error(
            anunciosFile,
            'las memorias solo van con Ditto y Shiny Ditto (§9.7.2)',
            `${where}.memorias`,
          );
      } else if (!Number.isInteger(unit.memorySlots)) {
        error(
          anunciosFile,
          'un Ditto declara sus Memory Slots, de 1 a 6 (§9.7.2)',
          `${where}.memorySlots`,
        );
      } else if (memorias.length !== unit.memorySlots) {
        error(
          anunciosFile,
          `memorias tiene ${plural(memorias.length, 'entrada', 'entradas')} y Memory Slots es ${unit.memorySlots}: una por slot, null si está vacío`,
          `${where}.memorias`,
        );
      }
      memorias.forEach((id, memoryIndex) => {
        if (pokemonIds && text(id) && !pokemonIds.has(id))
          error(
            anunciosFile,
            `"${id}" no existe en content/pokemon.json`,
            `${where}.memorias[${memoryIndex}]`,
          );
      });

      // One entry per training skill, each with its level, its progress or both (9.7.2).
      if (Array.isArray(unit.entrenamiento)) {
        const skills = new Map();
        unit.entrenamiento.forEach((entry, entryIndex) => {
          if (!isObject(entry)) return;
          const entryAt = `${where}.entrenamiento[${entryIndex}]`;
          if (text(entry.habilidad)) {
            if (skills.has(entry.habilidad))
              error(
                anunciosFile,
                `habilidad repetida: "${entry.habilidad}" (también en entrenamiento[${skills.get(entry.habilidad)}])`,
                `${entryAt}.habilidad`,
              );
            else skills.set(entry.habilidad, entryIndex);
          }
          if (entry.nivel === null && entry.progreso === null)
            error(
              anunciosFile,
              'una habilidad declarada lleva su nivel, su progreso o los dos',
              entryAt,
            );
        });
      }
    });

    vendedores?.forEach((vendedor, index) => {
      if (!isObject(vendedor)) return;
      const at = `vendedores[${index}]`;
      requireDraft(vendedoresFile, vendedor, at);
      instantOf(vendedoresFile, vendedor.desde, `${at}.desde`);

      // One channel per type, and another platform once per name (9.12.1).
      if (Array.isArray(vendedor.canales)) {
        const channels = new Map();
        vendedor.canales.forEach((canal, channelIndex) => {
          if (!isObject(canal) || !text(canal.tipo)) return;
          const key =
            canal.tipo === 'otra' && typeof canal.etiqueta === 'string'
              ? `otra ${fold(canal.etiqueta)}`
              : canal.tipo;
          if (channels.has(key))
            error(
              vendedoresFile,
              `canal repetido: "${canal.tipo === 'otra' ? canal.etiqueta : canal.tipo}" (también en canales[${channels.get(key)}])`,
              `${at}.canales[${channelIndex}]`,
            );
          else channels.set(key, channelIndex);
        });
      }

      // A review belongs to a trade of this seller's listing, never to the seller themself, and
      // comes after the listing (9.10). Its comment has no free game amount (R5, S8).
      if (!Array.isArray(vendedor.resenas)) return;
      vendedor.resenas.forEach((resena, reviewIndex) => {
        if (!isObject(resena)) return;
        const where = `${at}.resenas[${reviewIndex}]`;
        if (text(resena.comprador) && resena.comprador === vendedor.id)
          error(
            vendedoresFile,
            'un vendedor no se reseña a sí mismo (§9.10)',
            `${where}.comprador`,
          );
        const fecha = instantOf(vendedoresFile, resena.fecha, `${where}.fecha`);
        if (anuncios && text(resena.anuncio)) {
          const listing = listings.get(resena.anuncio);
          if (!listing)
            error(
              vendedoresFile,
              `"${resena.anuncio}" no existe en content/comercio/anuncios.json`,
              `${where}.anuncio`,
            );
          else if (listing.vendedor !== vendedor.id)
            error(
              vendedoresFile,
              `"${resena.anuncio}" es un anuncio de "${listing.vendedor}": una reseña es de una operación de este vendedor`,
              `${where}.anuncio`,
            );
          else if (
            !Number.isNaN(fecha) &&
            !Number.isNaN(listing.publicado) &&
            fecha < listing.publicado
          )
            error(
              vendedoresFile,
              'la reseña es anterior a la publicación de su anuncio',
              `${where}.fecha`,
            );
        }
        refuseFreeAmount(
          vendedoresFile,
          resena.comentario,
          `${where}.comentario`,
          'el comentario de una reseña',
        );
      });
    });

    if (anuncios)
      summary.push({
        file: rel(anunciosFile),
        registros: plural(anuncios.length, 'anuncio', 'anuncios'),
        borradores: drafts(anuncios.filter(isObject)),
      });
    if (vendedores)
      summary.push({
        file: rel(vendedoresFile),
        registros: plural(vendedores.length, 'vendedor', 'vendedores'),
        borradores: drafts(vendedores.filter(isObject)),
      });
  }

  return { errors, warnings, summary };
}

/** Readable Spanish report. */
export function formatReport({ errors, warnings, summary }) {
  const lines = ['Contenido (content/ y public/sprites/)', ''];
  const width = Math.max(...summary.map((row) => row.file.length), 7);
  const countWidth = Math.max(...summary.map((row) => row.registros.length), 9);
  lines.push(`  ${'Archivo'.padEnd(width)}  ${'Registros'.padEnd(countWidth)}  Borradores`);
  for (const row of summary)
    lines.push(
      `  ${row.file.padEnd(width)}  ${row.registros.padEnd(countWidth)}  ${row.borradores ?? '—'}`,
    );
  const where = (entry) => `${entry.file}${entry.path ? ` · ${entry.path}` : ''}`;
  if (errors.length) {
    lines.push('', `Errores (${errors.length}):`);
    for (const entry of errors) lines.push(`  ERROR  ${where(entry)}: ${entry.message}`);
  }
  if (warnings.length) {
    lines.push('', `Avisos (${warnings.length}):`);
    for (const entry of warnings) lines.push(`  AVISO  ${where(entry)}: ${entry.message}`);
  }
  lines.push(
    '',
    errors.length
      ? `Resultado: ${plural(errors.length, 'error', 'errores')}, ${plural(warnings.length, 'aviso', 'avisos')}. Corrige los errores y vuelve a ejecutar pnpm content:check.`
      : `Resultado: sin errores, ${plural(warnings.length, 'aviso', 'avisos')}.`,
  );
  return lines.join('\n');
}
