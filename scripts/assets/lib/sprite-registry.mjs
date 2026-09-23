// Writes outfit idle frames into public/sprites/outfits/<id>/ and keeps
// public/sprites/sprites.json up to date. Shared by dump-outfits.mjs
// (--registrar) and extract-outfit-preview.mjs. Only this module writes the
// site's sprite folder.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { TILE_SIZE, composeFrame, encodePng, isFullyTransparent } from './otclient-things.mjs';
import { CliError } from './things-cli.mjs';

/** OTClient patternX order (0 north, 1 east, 2 south, 3 west) with registry names. */
export const SPRITE_DIRECTIONS = Object.freeze([
  { x: 0, name: 'norte' },
  { x: 1, name: 'este' },
  { x: 2, name: 'sur' },
  { x: 3, name: 'oeste' },
]);

/** Most outfits one --registrar run may publish, so --all never floods public/. */
export const MAX_REGISTER = 50;

export function outfitSpriteKey(outfitId) {
  return `outfits/${outfitId}`;
}

/** Idle (or only) frame group of an outfit. */
export function idleGroup(thing) {
  return thing.frameGroups.find((group) => group.type === 0) ?? thing.frameGroups[0];
}

/**
 * Throws a Spanish CliError when an outfit cannot be registered: the site
 * needs four directions and at least one visible pixel.
 */
export function assertRegistrable(thing, readSprite, label = `el outfit ${thing.id}`) {
  const group = idleGroup(thing);
  if (group.patternX < 4)
    throw new CliError(
      `${label}: tiene ${group.patternX} dirección(es); el registro de sprites necesita 4.`,
    );
  const visible = SPRITE_DIRECTIONS.some(
    ({ x }) => !isFullyTransparent(composeFrame(group, { x, phase: 0 }, readSprite).pixels),
  );
  if (!visible) throw new CliError(`${label}: está vacío (sin píxeles visibles).`);
}

/**
 * Phase-0 idle frame of each direction as PNG bytes (mask layer, addon and
 * mount 0), identical to the frames the dump writes at scale 1.
 */
export function renderIdleFrames(thing, readSprite) {
  const group = idleGroup(thing);
  return SPRITE_DIRECTIONS.map(({ x, name }) => {
    const frame = composeFrame(group, { x, phase: 0 }, readSprite);
    return {
      direccion: name,
      width: frame.width,
      height: frame.height,
      png: encodePng(frame.pixels, frame.width, frame.height),
    };
  });
}

export function outfitSpriteEntry(outfitId, width, height) {
  const folder = `outfits/${outfitId}`;
  return {
    archivo: `${folder}/sur.png`,
    frame: [width, height],
    frames: 1,
    modo: 'estatico',
    direcciones: Object.fromEntries(
      SPRITE_DIRECTIONS.map(({ name }) => [name, `${folder}/${name}.png`]),
    ),
  };
}

/** JSON with arrays of numbers kept on one line ("frame": [32, 32]). */
export function stringifyRegistry(value, indent = '  ') {
  return `${JSON.stringify(value, null, indent).replace(
    /\[\s*(-?\d+(?:\.\d+)?(?:,\s*-?\d+(?:\.\d+)?)*)\s*\]/g,
    (_, list) => `[${list.split(/,\s*/).join(', ')}]`,
  )}\n`;
}

/**
 * Adds or replaces sprite entries in the registry text. Other entries and
 * their order are kept; new keys are appended. Line endings are preserved.
 * @param {string | null} text Current sprites.json, or null to start one.
 * @param {Record<string, object>} entries
 * @param {string} schemaRef `$schema` for a new file.
 */
export function upsertSpriteEntries(text, entries, schemaRef) {
  const eol = text?.includes('\r\n') ? '\r\n' : '\n';
  const data = text ? JSON.parse(text) : { $schema: schemaRef, sprites: {} };
  if (!data || typeof data !== 'object' || typeof data.sprites !== 'object' || !data.sprites)
    throw new CliError('public/sprites/sprites.json debe tener un objeto "sprites".');
  const changes = [];
  for (const [key, entry] of Object.entries(entries)) {
    const before = Object.hasOwn(data.sprites, key) ? data.sprites[key] : null;
    if (before && JSON.stringify(before) === JSON.stringify(entry)) continue;
    data.sprites[key] = entry;
    changes.push({ key, added: before === null });
  }
  const serialized = stringifyRegistry(data).replace(/\n/g, eol);
  return { text: changes.length || !text ? serialized : text, changes };
}

/**
 * Writes the idle frames of each outfit into <spritesDir>/outfits/<id>/ and
 * upserts their "outfits/<id>" entries in <spritesDir>/sprites.json.
 * @param {{ spritesDir: string, repoRoot: string, outfits: { thing: any, readSprite: (id: number) => Buffer }[], dryRun?: boolean }} options
 */
export function registerOutfitSprites({ spritesDir, repoRoot, outfits, dryRun = false }) {
  const registryPath = path.join(spritesDir, 'sprites.json');
  const schemaRef = path
    .relative(spritesDir, path.join(repoRoot, 'content', 'schemas', 'sprites.schema.json'))
    .split(path.sep)
    .join('/');
  const entries = {};
  const written = [];
  for (const { thing, readSprite } of outfits) {
    const frames = renderIdleFrames(thing, readSprite);
    const folder = path.join(spritesDir, 'outfits', String(thing.id));
    if (!dryRun) mkdirSync(folder, { recursive: true });
    for (const frame of frames) {
      const file = path.join(folder, `${frame.direccion}.png`);
      if (!dryRun) writeFileSync(file, frame.png);
      written.push(file);
    }
    const { width, height } = frames[0];
    entries[outfitSpriteKey(thing.id)] = outfitSpriteEntry(thing.id, width, height);
  }
  const current = existsSync(registryPath) ? readFileSync(registryPath, 'utf8') : null;
  const update = upsertSpriteEntries(current, entries, schemaRef);
  if (!dryRun && update.text !== current) writeFileSync(registryPath, update.text);
  return { registryPath, written, entries, changes: update.changes };
}

/** Pixel size of an outfit's idle frame. */
export function outfitSize(thing) {
  const group = idleGroup(thing);
  return { width: group.width * TILE_SIZE, height: group.height * TILE_SIZE };
}
