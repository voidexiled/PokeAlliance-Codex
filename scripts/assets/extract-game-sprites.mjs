// Extracts the game sprites of every item and every Pokémon of content/ from the owner's
// already-decrypted client, registers them in public/sprites/sprites.json and wires them:
//
//   Items    `sprite` of each record of content/items/*.json that has a `clientId` and still
//            shows a placeholder (`ui/comercio/item` or a sprite marked `borrador`) becomes
//            `items/cliente/<clientId>`: the first frame of the item as the inventory draws it
//            (pattern 0, the single-count frame of a stackable item, phase 0, every layer,
//            the visible `exactSize` square). A sprite the owner set is never replaced. An
//            `apilable` still null becomes the DAT's `stackable` flag of that item.
//   Pokémon  each record of content/pokemon.json without an outfit gets one in
//            content/outfits.json, from the lookType of the client's cyclopedia export (and,
//            for the forms it does not list, the lookType the other exports name with the same
//            Pokémon name). Its south-facing idle frame (phase 0, layer 0) is registered as
//            `outfits/<outfitId>` with one file, `outfits/<outfitId>/sur.png`; an outfit the
//            client animates while standing (`animateAlways`) gets the strip of its phases,
//            `modo: animacion`, 1000 / phases ms each. An outfit the owner registered with its
//            four directions is kept as it is.
//   Portraits a record whose `imagen` is null gets the client's Pokédex portrait when
//            data/images/pokemons has one that no other record uses (NNN.png, NNN.1.png for a
//            shiny, and the forms of FORM_PORTRAITS); run scripts/assets/pokemon-thumbs.py
//            afterwards to build its WebP thumbnails.
//   Balls    each record of content/items/*.json whose sprite is an `items/poke-balls/<id>` key
//            and that has a `clientId` gets that key re-rendered from the DAT: a stackable item
//            with 4 × 2 count patterns becomes the strip of its eight count frames (pattern 0 to
//            7, phase 0, every layer), `modo: cantidad` with the thresholds of OTClient's
//            `Item::calculatePatterns` (COUNT_THRESHOLDS); any other item, its inventory frame.
//            The key and the file name stay, so no record or page changes.
//
// Rerunning after a client update re-renders every sprite this script owns (the keys
// `items/cliente/*` and the one-file `outfits/<id>` entries) and drops the ones nothing uses.
//
// Read-only on the client: the files are only read, a file with the protected PKA1 signature
// is refused and nothing is written outside this repository's public/sprites/ and content/.
//
// Usage:
//   node scripts/assets/extract-game-sprites.mjs --client <decrypted client root>
//        --datamine <datamine folder | run folder> [--solo items,pokemon,retratos,balls]
//        [--dry-run]
//   --client     folder with data/things/things.{dat,spr,otfi} and data/images/pokemons/
//   --things     the things folder, when it is not <client>/data/things
//   --datamine   the game_datamine export (needed for the Pokémon step)

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

import { formatJson } from '../content/lib/format-json.mjs';
import {
  DEFAULT_THINGS_FORMAT,
  SpriteFile,
  TILE_SIZE,
  assertNotProtected,
  composeFrame,
  crc32,
  encodePng,
  isFullyTransparent,
  parseDat,
  parseOtfi,
} from './lib/otclient-things.mjs';
import { stringifyRegistry } from './lib/sprite-registry.mjs';
import { isPathInside } from './lib/things-cli.mjs';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const spritesDir = path.join(repoRoot, 'public', 'sprites');
const registryPath = path.join(spritesDir, 'sprites.json');
const itemsDir = path.join(repoRoot, 'content', 'items');
const pokemonPath = path.join(repoRoot, 'content', 'pokemon.json');
const outfitsPath = path.join(repoRoot, 'content', 'outfits.json');

const PLACEHOLDER = 'ui/comercio/item';
const ITEM_PREFIX = 'items/cliente/';
const BALL_PREFIX = 'items/poke-balls/';
const SOUTH = 2;

/**
 * The count a stackable item with 4 × 2 patterns needs to show each pattern, as OTClient's
 * `Item::calculatePatterns` picks it: 1–4 → patterns 0–3, 5–9 → 4, 10–24 → 5, 25–49 → 6,
 * 50 or more → 7. They are the `umbrales` of a `modo: cantidad` entry.
 */
const COUNT_THRESHOLDS = [1, 2, 3, 4, 5, 10, 25, 50];
const STEPS = ['items', 'pokemon', 'retratos', 'balls'];

/**
 * Pokédex portraits of forms that do not follow NNN.png / NNN.1.png. Each one was checked by
 * eye against the client image (2026-09-24).
 */
const FORM_PORTRAITS = {
  'mega-clefable': '036.2.png',
  'mega-ampharos': '181.2.png',
  'mega-lucario': '448.2.png',
  'mega-abomasnow': '460.2.png',
};

/**
 * Outfits of Pokémon the exports do not name (the client cyclopedia stops at ~449 species).
 * Each one was found in the client DAT and checked by eye against the client's own Pokédex
 * portrait of that Pokémon (2026-09-24); they follow the DAT's runs (dex + 1605 up to
 * Bronzong, + 1604 from Mime Jr., + 1598 from Carnivine). Used only while the exports give no
 * lookType for the name. Bonsly has no outfit in that run and stays without one.
 */
const VERIFIED_OUTFITS = {
  piplup: 1998,
  prinplup: 1999,
  bidoof: 2004,
  bibarel: 2005,
  kricketot: 2006,
  kricketune: 2007,
  budew: 2011,
  roserade: 2012,
  burmy: 2017,
  wormadam: 2018,
  mothim: 2019,
  buizel: 2023,
  floatzel: 2024,
  cherubi: 2025,
  cherrim: 2026,
  shellos: 2027,
  gastrodon: 2028,
  ambipom: 2029,
  drifloon: 2030,
  drifblim: 2031,
  buneary: 2032,
  honchkrow: 2035,
  glameow: 2036,
  purugly: 2037,
  chingling: 2038,
  stunky: 2039,
  skuntank: 2040,
  bronzor: 2041,
  bronzong: 2042,
  'mime-jr': 2043,
  happiny: 2044,
  chatot: 2045,
  spiritomb: 2046,
  munchlax: 2050,
  carnivine: 2053,
  finneon: 2054,
  lumineon: 2055,
  mantyke: 2056,
  weavile: 2059,
  magnezone: 2060,
  lickilicky: 2061,
  togekiss: 2066,
  mamoswine: 2071,
  'porygon-z': 2072,
  froslass: 2076,
  rotom: 2077,
  uxie: 2078,
  mesprit: 2079,
  azelf: 2080,
  dialga: 2081,
  palkia: 2082,
  heatran: 2083,
  regigigas: 2084,
  giratina: 2085,
  cresselia: 2086,
  phione: 2087,
  manaphy: 2088,
  darkrai: 2089,
  shaymin: 2090,
  arceus: 2091,
  hippopotas: 2092,
  hippowdon: 2093,
  bunnelby: 2587,
  diggersby: 2588,
};

const HELP = `Uso: node scripts/assets/extract-game-sprites.mjs --client <carpeta> --datamine <carpeta> [opciones]

  --client <carpeta>    Cliente descifrado (con data/things y data/images/pokemons).
  --things <carpeta>    Carpeta del things.dat/things.spr si no es <client>/data/things.
  --datamine <carpeta>  Exportación de game_datamine (carpeta con run_* o una run_*).
  --solo <lista>        items, pokemon, retratos, balls (por defecto, los cuatro).
  --dry-run             Informa sin escribir nada.
`;

class CliError extends Error {}

// ------------------------------------------------------------------------------ arguments

function parseArgs(argv) {
  const options = { solo: new Set(STEPS), dryRun: false };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    const value = () => {
      const next = argv[++index];
      if (next === undefined || next === '') throw new CliError(`${arg} necesita un valor.`);
      return next;
    };
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--client') options.client = path.resolve(value());
    else if (arg === '--things') options.things = path.resolve(value());
    else if (arg === '--datamine') options.datamine = path.resolve(value());
    else if (arg === '--solo') {
      const list = value()
        .split(/[,\s]+/)
        .filter(Boolean);
      for (const step of list)
        if (!STEPS.includes(step)) throw new CliError(`Paso desconocido en --solo: ${step}`);
      options.solo = new Set(list);
    } else throw new CliError(`Opción desconocida: ${arg}`);
  }
  return options;
}

// ------------------------------------------------------------------------------ PNG

/**
 * Smallest lossless PNG of an RGBA buffer: indexed (with tRNS) when it has at most 256
 * colours, at the lowest bit depth that holds them; RGBA otherwise. Fully transparent pixels
 * are one colour.
 */
function encodeSmallPng(pixels, width, height) {
  const clean = Buffer.from(pixels);
  for (let i = 0; i < clean.length; i += 4) if (clean[i + 3] === 0) clean.writeUInt32LE(0, i);
  const colours = new Map();
  for (let i = 0; i < clean.length; i += 4) {
    const key = clean.readUInt32BE(i);
    if (!colours.has(key)) {
      if (colours.size === 256) return encodePng(clean, width, height);
      colours.set(key, colours.size);
    }
  }
  // Translucent entries first, so tRNS stays short.
  const palette = [...colours.keys()].sort((a, b) => (a & 0xff) - (b & 0xff) || a - b);
  const index = new Map(palette.map((key, i) => [key, i]));
  const depth = palette.length <= 2 ? 1 : palette.length <= 4 ? 2 : palette.length <= 16 ? 4 : 8;
  const rowBytes = Math.ceil((width * depth) / 8);
  const raw = Buffer.alloc((rowBytes + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (rowBytes + 1);
    for (let x = 0; x < width; x++) {
      const value = index.get(clean.readUInt32BE((y * width + x) * 4));
      const bit = x * depth;
      raw[row + 1 + (bit >> 3)] |= value << (8 - depth - (bit & 7));
    }
  }
  const plte = Buffer.alloc(palette.length * 3);
  const alphas = [];
  palette.forEach((key, i) => {
    plte[i * 3] = key >>> 24;
    plte[i * 3 + 1] = (key >>> 16) & 0xff;
    plte[i * 3 + 2] = (key >>> 8) & 0xff;
    alphas.push(key & 0xff);
  });
  while (alphas.length && alphas[alphas.length - 1] === 255) alphas.pop();
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = depth;
  ihdr[9] = 3;
  const chunks = [
    chunk('IHDR', ihdr),
    chunk('PLTE', plte),
    ...(alphas.length ? [chunk('tRNS', Buffer.from(alphas))] : []),
    chunk('IDAT', deflateSync(raw, { level: 9, memLevel: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ];
  const indexed = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), ...chunks]);
  const rgba = encodePng(clean, width, height);
  return indexed.length <= rgba.length ? indexed : rgba;
}

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(head.subarray(4), data), 0);
  return Buffer.concat([head, data, crc]);
}

// ------------------------------------------------------------------------------ rendering

/** Alpha-over of `top` onto `base` (both RGBA, same size). */
function blendOver(base, top) {
  for (let i = 0; i < base.length; i += 4) {
    const a = top[i + 3];
    if (a === 0) continue;
    if (a === 255 || base[i + 3] === 0) {
      top.copy(base, i, i, i + 4);
      continue;
    }
    const ab = base[i + 3] / 255;
    const at = a / 255;
    const out = at + ab * (1 - at);
    for (let c = 0; c < 3; c++)
      base[i + c] = Math.round((top[i + c] * at + base[i + c] * ab * (1 - at)) / out);
    base[i + 3] = Math.round(out * 255);
  }
}

/** Crops the bottom-right `w`×`h` block of an RGBA canvas. */
function cropBottomRight(pixels, width, height, w, h) {
  if (w === width && h === height) return pixels;
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++)
    pixels.copy(
      out,
      y * w * 4,
      ((height - h + y) * width + (width - w)) * 4,
      ((height - h + y) * width + width) * 4,
    );
  return out;
}

/**
 * The item as the inventory draws it (UIItem): first frame, every layer, exactSize square. `x`
 * and `y` pick another pattern (the count patterns of a stackable item).
 */
function renderItem(thing, readSprite, x = 0, y = 0) {
  const group = thing.frameGroups[0];
  let frame = null;
  for (let layer = 0; layer < group.layers; layer++) {
    const composed = composeFrame(group, { layer, x, y, z: 0, phase: 0 }, readSprite);
    if (!frame) frame = composed;
    else blendOver(frame.pixels, composed.pixels);
  }
  const size = Math.max(TILE_SIZE, group.exactSize);
  const w = Math.min(size, frame.width);
  const h = Math.min(size, frame.height);
  return {
    pixels: cropBottomRight(frame.pixels, frame.width, frame.height, w, h),
    width: w,
    height: h,
  };
}

/**
 * A stackable item with 4 × 2 count patterns as the strip of its eight count frames, in the
 * order of COUNT_THRESHOLDS; `null` for any other item.
 */
function renderCountStrip(thing, readSprite) {
  const group = thing.frameGroups[0];
  const stackable = thing.attributes.some((attribute) => attribute.name === 'stackable');
  if (!stackable || group.patternX !== 4 || group.patternY !== 2) return null;
  const frames = COUNT_THRESHOLDS.map((_, pattern) =>
    renderItem(thing, readSprite, pattern % 4, Math.floor(pattern / 4)),
  );
  const { width, height } = frames[0];
  const pixels = Buffer.alloc(width * frames.length * height * 4);
  frames.forEach((frame, index) => {
    for (let y = 0; y < height; y++)
      frame.pixels.copy(
        pixels,
        (y * width * frames.length + index * width) * 4,
        y * width * 4,
        (y + 1) * width * 4,
      );
  });
  return { pixels, width, height, frames: frames.length };
}

/** South-facing idle frame of an outfit (phase 0, layer 0, no addon, no mount). */
function renderOutfitSouth(thing, readSprite, phase = 0) {
  const group = thing.frameGroups[0];
  const x = group.patternX >= 4 ? SOUTH : 0;
  return composeFrame(group, { layer: 0, x, y: 0, z: 0, phase }, readSprite);
}

/**
 * The outfit as the client draws it standing still, facing south. Without frame groups the
 * client stands a creature on phase 0, unless its type is `animateAlways`: then it cycles every
 * phase, each for 1000 / phases ms (OTClient `Creature::internalDrawOutfit`). That idle
 * animation becomes a horizontal strip of the phases.
 */
function renderOutfitIdle(thing, readSprite) {
  const group = thing.frameGroups[0];
  const animated =
    group.phases > 1 && thing.attributes.some((attribute) => attribute.name === 'animateAlways');
  const phases = animated ? group.phases : 1;
  const frames = Array.from({ length: phases }, (_, phase) =>
    renderOutfitSouth(thing, readSprite, phase),
  );
  const { width, height } = frames[0];
  const pixels = Buffer.alloc(width * phases * height * 4);
  frames.forEach((frame, index) => {
    for (let y = 0; y < height; y++)
      frame.pixels.copy(
        pixels,
        (y * width * phases + index * width) * 4,
        y * width * 4,
        (y + 1) * width * 4,
      );
  });
  return { pixels, width, height, phases, first: frames[0].pixels };
}

// ------------------------------------------------------------------------------ helpers

const stripBom = (text) => (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
const readJson = (file) => JSON.parse(stripBom(readFileSync(file, 'utf8')));

/** Name key: lower case, only a-z and 0-9 (the export writes accents in another encoding). */
const nameKey = (name) => name.toLowerCase().replace(/[^a-z0-9]/g, '');

function writeText(file, text, dryRun) {
  if (dryRun) return;
  const current = existsSync(file) ? readFileSync(file, 'utf8') : null;
  if (current === text) return;
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, text);
}

function writeBinary(file, data, dryRun) {
  if (dryRun) return;
  if (existsSync(file) && readFileSync(file).equals(data)) return;
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, data);
}

/** An outfit entry this script wrote: one file, no directions. */
const isOwnOutfitEntry = (key, entry) =>
  /^outfits\/\d+$/.test(key) && !entry.direcciones && entry.archivo === `${key}/sur.png`;

// ------------------------------------------------------------------------------ lookTypes

function runFolders(root) {
  if (/^run_/.test(path.basename(root))) return [root];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('run_'))
    .map((entry) => path.join(root, entry.name))
    .sort();
}

function* jsonLines(file) {
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      yield JSON.parse(line);
    } catch {
      // A line cut by a stopped sweep: skip it.
    }
  }
}

/**
 * Name key → lookType. The newest cyclopedia wins; a name it does not list (or lists with
 * lookType 0) takes the lookType the other exports give it, when they all agree.
 */
function readLookTypes(datamine) {
  const runs = runFolders(datamine);
  if (!runs.length) throw new CliError(`No hay carpetas run_* en ${datamine}.`);
  const cyclopedia = new Map();
  const cycloRun = [...runs]
    .reverse()
    .find((run) => readdirSync(run).some((file) => file.startsWith('cyclopedia.')));
  if (cycloRun) {
    for (const file of readdirSync(cycloRun).filter((f) => f.startsWith('cyclopedia.')))
      for (const record of jsonLines(path.join(cycloRun, file))) {
        if (record.lookType > 0) cyclopedia.set(nameKey(record.name), record.lookType);
        if (record.shiny?.lookType > 0)
          cyclopedia.set(nameKey(record.shiny.name), record.shiny.lookType);
      }
  }
  const others = new Map();
  const walk = (value) => {
    if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === 'object') {
      if (
        Number.isInteger(value.lookType) &&
        value.lookType > 0 &&
        typeof value.name === 'string'
      ) {
        const key = nameKey(value.name);
        if (!others.has(key)) others.set(key, new Set());
        others.get(key).add(value.lookType);
      }
      Object.values(value).forEach(walk);
    }
  };
  for (const run of runs)
    for (const file of readdirSync(run))
      if (file.endsWith('.jsonl') && !file.startsWith('cyclopedia.'))
        for (const record of jsonLines(path.join(run, file))) walk(record);
  return { cyclopedia, others };
}

// ------------------------------------------------------------------------------ main

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(HELP);
    return;
  }
  if (!options.client && !options.things) throw new CliError('Falta --client <carpeta>.\n' + HELP);
  const thingsDir = options.things ?? path.join(options.client, 'data', 'things');
  for (const input of [options.client, thingsDir, options.datamine].filter(Boolean))
    if (isPathInside(repoRoot, input) || isPathInside(input, repoRoot))
      throw new CliError(`La entrada no puede contener ni estar dentro del repositorio: ${input}`);
  const datPath = path.join(thingsDir, 'things.dat');
  const sprPath = path.join(thingsDir, 'things.spr');
  for (const file of [datPath, sprPath]) {
    if (!existsSync(file)) throw new CliError(`No existe ${file}`);
    assertNotProtected(file);
  }
  const otfiPath = path.join(thingsDir, 'things.otfi');
  const format = existsSync(otfiPath)
    ? { ...DEFAULT_THINGS_FORMAT, ...parseOtfi(readFileSync(otfiPath, 'utf8')).format }
    : DEFAULT_THINGS_FORMAT;
  const dryRun = options.dryRun;

  console.log(`DAT: ${datPath}`);
  const dat = parseDat(readFileSync(datPath), { format, keep: ['items', 'outfits'] });
  if (dat.trailingBytes !== 0)
    throw new CliError(`El DAT no se leyó hasta el final (${dat.trailingBytes} bytes sobrantes).`);
  const spr = SpriteFile.open(sprPath, format);
  const cache = new Map();
  const readSprite = (id) => {
    let sprite = cache.get(id);
    if (!sprite) {
      sprite = spr.readSprite(id);
      if (cache.size > 20000) cache.clear();
      cache.set(id, sprite);
    }
    return sprite;
  };

  const registryText = readFileSync(registryPath, 'utf8');
  const registry = JSON.parse(stripBom(registryText));
  const sprites = registry.sprites;
  const isPlaceholder = (key) =>
    key === PLACEHOLDER || key.startsWith(ITEM_PREFIX) || sprites[key]?.borrador === true;
  const report = { bytes: 0, files: 0 };
  const usedKeys = new Set();

  try {
    // ---------------------------------------------------------------- items
    if (options.solo.has('items')) {
      const files = readdirSync(itemsDir).filter(
        (file) => file.endsWith('.json') && file !== 'categorias.json',
      );
      const rendered = new Map();
      const notFound = [];
      const empty = [];
      let wired = 0;
      let kept = 0;
      let noClientId = 0;
      let stacked = 0;
      for (const file of files) {
        const full = path.join(itemsDir, file);
        const data = readJson(full);
        let changed = false;
        for (const item of data.items ?? []) {
          // `apilable` while unknown: whether the DAT item stacks. A value the owner wrote stays.
          if (item.apilable == null && item.clientId != null) {
            const thing = dat.things.items.get(item.clientId);
            if (thing) {
              item.apilable = thing.attributes.some((attribute) => attribute.name === 'stackable');
              stacked++;
              changed = true;
            }
          }
          if (!isPlaceholder(item.sprite)) {
            kept++;
            continue;
          }
          if (item.clientId == null) {
            noClientId++;
            continue;
          }
          const key = `${ITEM_PREFIX}${item.clientId}`;
          if (!rendered.has(item.clientId)) {
            const thing = dat.things.items.get(item.clientId);
            if (!thing) {
              rendered.set(item.clientId, null);
              notFound.push(`${item.id} (${item.clientId})`);
            } else {
              const frame = renderItem(thing, readSprite);
              if (isFullyTransparent(frame.pixels)) {
                rendered.set(item.clientId, null);
                empty.push(`${item.id} (${item.clientId})`);
              } else {
                const png = encodeSmallPng(frame.pixels, frame.width, frame.height);
                writeBinary(path.join(spritesDir, `${key}.png`), png, dryRun);
                report.bytes += png.length;
                report.files++;
                sprites[key] = {
                  archivo: `${key}.png`,
                  frame: [frame.width, frame.height],
                  frames: 1,
                  modo: 'estatico',
                };
                rendered.set(item.clientId, key);
              }
            }
          }
          const target = rendered.get(item.clientId);
          if (target === null) {
            // No image: an old sprite of this script falls back to the placeholder.
            if (item.sprite.startsWith(ITEM_PREFIX)) {
              item.sprite = PLACEHOLDER;
              changed = true;
            }
            continue;
          }
          usedKeys.add(target);
          if (item.sprite !== target) {
            item.sprite = target;
            changed = true;
          }
          wired++;
        }
        if (changed) writeText(full, formatJson(data), dryRun);
      }
      console.log(
        `Items: ${wired} con sprite del cliente (${[...rendered.values()].filter(Boolean).length} imágenes), ` +
          `${kept} con sprite propio sin tocar, ${noClientId} sin clientId; ` +
          `${stacked} con apilable leído del DAT.`,
      );
      if (notFound.length)
        console.log(
          `  clientId que no existe en el DAT (${notFound.length}): ${notFound.join(', ')}`,
        );
      if (empty.length)
        console.log(`  clientId sin píxeles visibles (${empty.length}): ${empty.join(', ')}`);
    }

    // ---------------------------------------------------------------- balls
    if (options.solo.has('balls')) {
      const files = readdirSync(itemsDir).filter(
        (file) => file.endsWith('.json') && file !== 'categorias.json',
      );
      const done = [];
      const missing = [];
      for (const file of files)
        for (const item of readJson(path.join(itemsDir, file)).items ?? []) {
          if (!item.sprite.startsWith(BALL_PREFIX) || item.clientId == null) continue;
          const thing = dat.things.items.get(item.clientId);
          if (!thing) {
            missing.push(`${item.id} (${item.clientId})`);
            continue;
          }
          const strip = renderCountStrip(thing, readSprite);
          const frame = strip ?? { ...renderItem(thing, readSprite), frames: 1 };
          const png = encodeSmallPng(frame.pixels, frame.width * frame.frames, frame.height);
          writeBinary(path.join(spritesDir, `${item.sprite}.png`), png, dryRun);
          report.bytes += png.length;
          report.files++;
          sprites[item.sprite] = {
            archivo: `${item.sprite}.png`,
            frame: [frame.width, frame.height],
            frames: frame.frames,
            ...(strip
              ? { modo: 'cantidad', umbrales: [...COUNT_THRESHOLDS] }
              : { modo: 'estatico' }),
          };
          done.push(`${item.id}${strip ? '' : ' (sin hoja de cantidad)'}`);
        }
      console.log(`Balls: ${done.length} sprites del cliente: ${done.join(', ')}`);
      if (missing.length)
        console.log(
          `  clientId que no existe en el DAT (${missing.length}): ${missing.join(', ')}`,
        );
    }

    // ---------------------------------------------------------------- pokémon outfits
    const pokemon = readJson(pokemonPath);
    if (options.solo.has('pokemon')) {
      if (!options.datamine) throw new CliError('El paso pokemon necesita --datamine <carpeta>.');
      const { cyclopedia, others } = readLookTypes(options.datamine);
      const outfitsData = readJson(outfitsPath);
      const byPokemon = new Map(outfitsData.outfits.map((record) => [record.pokemon, record]));
      const unresolved = [];
      const ambiguous = [];
      const differs = [];
      const sameAsNormal = [];
      let added = 0;
      for (const record of pokemon.pokemon) {
        const key = nameKey(record.nombre);
        let lookType = cyclopedia.get(key) ?? null;
        if (lookType === null && others.has(key)) {
          const values = [...others.get(key)];
          if (values.length === 1) lookType = values[0];
          else ambiguous.push(`${record.id} (${values.join('/')})`);
        }
        if (lookType === null && !others.has(key)) lookType = VERIFIED_OUTFITS[record.id] ?? null;
        // A shiny the cyclopedia gives no outfit, which the other exports name with its normal
        // form's outfit, would look like the normal form: leave it without one.
        if (lookType !== null && !cyclopedia.has(key) && record.variante === 'shiny') {
          const base = pokemon.pokemon.find(
            (other) => other.id === record.id.replace(/^shiny-/, ''),
          );
          if (base && cyclopedia.get(nameKey(base.nombre)) === lookType) {
            sameAsNormal.push(record.id);
            lookType = null;
          }
        }
        const existing = byPokemon.get(record.id);
        if (existing) {
          if (lookType !== null && existing.outfitId !== lookType)
            differs.push(
              `${record.id}: ${existing.outfitId} en outfits.json, ${lookType} en el cliente`,
            );
          continue;
        }
        if (lookType === null) {
          if (!sameAsNormal.includes(record.id) && (!others.has(key) || others.get(key).size === 1))
            unresolved.push(record.id);
          continue;
        }
        const thing = dat.things.outfits.get(lookType);
        if (!thing || isFullyTransparent(renderOutfitSouth(thing, readSprite).pixels)) {
          unresolved.push(`${record.id} (outfit ${lookType} vacío o inexistente)`);
          continue;
        }
        const entry = { pokemon: record.id, outfitId: lookType, addons: [] };
        outfitsData.outfits.push(entry);
        byPokemon.set(record.id, entry);
        added++;
      }
      writeText(outfitsPath, formatJson(outfitsData), dryRun);

      // Register the south frame of every outfit a Pokémon uses.
      const outfitIds = new Set(
        outfitsData.outfits.filter((record) => !record.borrador).map((record) => record.outfitId),
      );
      let registered = 0;
      let animated = 0;
      let ownerKept = 0;
      for (const outfitId of [...outfitIds].sort((a, b) => a - b)) {
        const key = `outfits/${outfitId}`;
        const entry = sprites[key];
        if (entry && !entry.borrador && !isOwnOutfitEntry(key, entry)) {
          ownerKept++;
          usedKeys.add(key);
          continue;
        }
        const thing = dat.things.outfits.get(outfitId);
        if (!thing) continue;
        const frame = renderOutfitIdle(thing, readSprite);
        if (isFullyTransparent(frame.first)) continue;
        const png = encodeSmallPng(frame.pixels, frame.width * frame.phases, frame.height);
        writeBinary(path.join(spritesDir, key, 'sur.png'), png, dryRun);
        report.bytes += png.length;
        report.files++;
        sprites[key] = {
          archivo: `${key}/sur.png`,
          frame: [frame.width, frame.height],
          frames: frame.phases,
          ...(frame.phases > 1
            ? {
                modo: 'animacion',
                duracionMs: Array(frame.phases).fill(Math.floor(1000 / frame.phases)),
              }
            : { modo: 'estatico' }),
        };
        if (frame.phases > 1) animated++;
        usedKeys.add(key);
        registered++;
      }
      const withOutfit = pokemon.pokemon.filter((record) => byPokemon.has(record.id)).length;
      console.log(
        `Pokémon: ${withOutfit} de ${pokemon.pokemon.length} con outfit (${added} nuevos en ` +
          `content/outfits.json); ${registered} outfits registrados con su frame sur (${animated} animados), ` +
          `${ownerKept} ya registrados por el propietario.`,
      );
      if (unresolved.length)
        console.log(
          `  Sin lookType en el cliente (${unresolved.length}): ${unresolved.join(', ')}`,
        );
      if (ambiguous.length)
        console.log(`  lookType ambiguo (${ambiguous.length}): ${ambiguous.join(', ')}`);
      if (sameAsNormal.length)
        console.log(
          `  Shiny con el outfit de su forma normal, sin outfit (${sameAsNormal.length}): ${sameAsNormal.join(', ')}`,
        );
      if (differs.length) console.log(`  Distintos (no se cambian): ${differs.join('; ')}`);
    }

    // ---------------------------------------------------------------- portraits
    if (options.solo.has('retratos')) {
      if (!options.client) throw new CliError('El paso retratos necesita --client <carpeta>.');
      const portraits = path.join(options.client, 'data', 'images', 'pokemons');
      if (!existsSync(portraits)) throw new CliError(`No existe ${portraits}`);
      const available = new Set(readdirSync(portraits));
      const used = new Set(
        pokemon.pokemon.filter((r) => r.imagen).map((r) => path.posix.basename(r.imagen)),
      );
      const claims = new Map();
      for (const record of pokemon.pokemon) {
        if (record.imagen != null || record.numero == null) continue;
        const dex = String(record.numero).padStart(3, '0');
        const file =
          FORM_PORTRAITS[record.id] ??
          (record.variante === 'shiny' ? `${dex}.1.png` : `${dex}.png`);
        if (!available.has(file) || used.has(file)) continue;
        if (!claims.has(file)) claims.set(file, []);
        claims.get(file).push(record);
      }
      let set = 0;
      const missing = [];
      for (const [file, records] of claims) {
        if (records.length !== 1) continue; // two records would share one portrait: leave both
        records[0].imagen = `/pokemon/${file}`;
        set++;
      }
      for (const record of pokemon.pokemon) if (record.imagen == null) missing.push(record.id);
      if (set) writeText(pokemonPath, formatJson(pokemon), dryRun);
      console.log(
        `Retratos: ${set} registros con imagen nueva; siguen sin imagen (${missing.length}): ${missing.join(', ')}`,
      );
      if (set)
        console.log(
          `  Genera sus miniaturas: python scripts/assets/pokemon-thumbs.py "${portraits}"`,
        );
    }

    // ---------------------------------------------------------------- prune + registry
    let pruned = 0;
    for (const key of Object.keys(sprites)) {
      const own = key.startsWith(ITEM_PREFIX)
        ? options.solo.has('items')
        : isOwnOutfitEntry(key, sprites[key]) && options.solo.has('pokemon');
      if (!own || usedKeys.has(key)) continue;
      const file = path.join(spritesDir, sprites[key].archivo);
      if (!dryRun && existsSync(file)) rmSync(file);
      delete sprites[key];
      pruned++;
    }
    const eol = registryText.includes('\r\n') ? '\r\n' : '\n';
    writeText(registryPath, stringifyRegistry(registry).replace(/\n/g, eol), dryRun);
    console.log(
      `${dryRun ? '[dry-run] ' : ''}Sprites escritos: ${report.files} ` +
        `(${(report.bytes / 1024).toFixed(1)} KiB); entradas retiradas: ${pruned}.`,
    );
  } finally {
    spr.close();
  }
}

try {
  main();
} catch (error) {
  if (error instanceof CliError || error?.name === 'ThingsFormatError') {
    console.error(error.message);
    process.exit(1);
  }
  throw error;
}
