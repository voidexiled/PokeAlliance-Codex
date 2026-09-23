// Regenerates the site's outfit sprites (phase-0 idle, four directions) for
// every Pokémon and addon in content/outfits.json: public/sprites/outfits/<id>/
// plus the "outfits/<id>" entries of public/sprites/sprites.json.
//
// Read-only input: the owner's already-decrypted local client files. The binary
// layout follows OTClient's ThingType/SpriteManager implementation (see
// ./lib/otclient-things.mjs). Usage: scripts/assets/README.md or --help.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_THINGS_FORMAT,
  SpriteFile,
  ThingsFormatError,
  parseDat,
  parseOtfi,
} from './lib/otclient-things.mjs';
import { validateMapping } from './lib/outfit-dump.mjs';
import {
  assertRegistrable,
  idleGroup,
  outfitSize,
  outfitSpriteKey,
  registerOutfitSprites,
} from './lib/sprite-registry.mjs';
import {
  CliError,
  assertSafeOutputDir,
  normalizeUserPath,
  parseArgv,
  resolveThingsInputs,
} from './lib/things-cli.mjs';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

const HELP = `Uso: node scripts/assets/extract-outfit-preview.mjs [opciones]

Regenera public/sprites/outfits/<id>/{norte,este,sur,oeste}.png y las entradas
"outfits/<id>" de public/sprites/sprites.json para los Pokémon y addons de
content/outfits.json (fase 0; los registros con "borrador": true se omiten).

  --things <carpeta>   Carpeta con el .dat y el .spr descifrados.
  --dat <archivo>      Archivo .dat exacto (prioridad sobre --things).
  --spr <archivo>      Archivo .spr exacto.
  --otml <archivo>     things.otml exacto (opcional).
  --otfi <archivo>     things.otfi exacto (opcional; define el formato).
  --out <carpeta>      Carpeta de sprites (por defecto public/sprites).
  --inspect            Solo imprime dimensiones de los outfits de content/outfits.json.
  --probe=<id>         Con --inspect, añade un outfit que no está en el archivo.
  --help               Muestra esta ayuda.

Prioridad de entrada: --dat/--spr/--otml/--otfi > --things > PKA_DECRYPTED_THINGS >
carpeta predeterminada (...\\PokeAlliance\\data\\things\\decrypted_objectbuilder).
`;

/** Outfit ids to publish: each Pokémon and each addon that is not a draft. */
function readTargets(data) {
  validateMapping(data);
  /** @type {Map<number, string[]>} */
  const targets = new Map();
  const add = (outfitId, label) => targets.set(outfitId, [...(targets.get(outfitId) ?? []), label]);
  for (const outfit of data.outfits) {
    if (outfit.borrador !== true) add(outfit.outfitId, outfit.pokemon);
    for (const addon of outfit.addons ?? []) {
      if (addon.borrador === true) continue;
      if (!Number.isSafeInteger(addon.outfitId) || addon.outfitId < 1)
        throw new CliError(`Addon inválido en content/outfits.json: ${addon.id}=${addon.outfitId}`);
      add(addon.outfitId, addon.id);
    }
  }
  return [...targets].map(([outfitId, labels]) => ({ outfitId, labels }));
}

async function main() {
  const options = parseArgv(process.argv.slice(2), {
    booleans: ['inspect', 'help'],
    values: ['out', 'probe', 'things', 'dat', 'spr', 'otml', 'otfi'],
  });
  if (options.help) {
    console.log(HELP);
    return;
  }
  const inspectOnly = options.inspect === true;
  const text = (name) => /** @type {string | undefined} */ (options[name]);
  const inputs = resolveThingsInputs(
    {
      things: text('things'),
      dat: text('dat'),
      spr: text('spr'),
      otml: text('otml'),
      otfi: text('otfi'),
    },
    { requireSpr: !inspectOnly },
  );
  console.error(`DAT: ${inputs.datPath} [${inputs.origins.dat}]`);
  if (inputs.sprPath) console.error(`SPR: ${inputs.sprPath} [${inputs.origins.spr}]`);
  if (inputs.otfiPath) console.error(`OTFI: ${inputs.otfiPath} [${inputs.origins.otfi}]`);
  const spritesDir =
    text('out') !== undefined
      ? normalizeUserPath(/** @type {string} */ (text('out')))
      : process.env.PKA_SPRITES_DIR
        ? normalizeUserPath(process.env.PKA_SPRITES_DIR)
        : path.join(repoRoot, 'public', 'sprites');
  if (!inspectOnly) {
    assertSafeOutputDir(spritesDir, { inputs, repoRoot, allowPublic: true });
    console.error(`Salida: ${spritesDir}`);
  }

  const mappingPath = process.env.PKA_OUTFIT_MAPPING
    ? normalizeUserPath(process.env.PKA_OUTFIT_MAPPING)
    : path.join(repoRoot, 'content', 'outfits.json');
  const targets = readTargets(JSON.parse(readFileSync(mappingPath, 'utf8')));
  if (options.probe !== undefined) {
    if (!inspectOnly) throw new CliError('--probe solo está disponible con --inspect');
    const outfitId = Number(options.probe);
    if (!Number.isSafeInteger(outfitId) || outfitId < 1)
      throw new CliError('ID de --probe inválido');
    targets.push({ outfitId, labels: [`_probe-${outfitId}`] });
  }

  const datBytes = readFileSync(inputs.datPath);
  const format = inputs.otfiPath
    ? parseOtfi(readFileSync(inputs.otfiPath, 'utf8')).format
    : { ...DEFAULT_THINGS_FORMAT };
  const dat = parseDat(datBytes, { format, keep: ['outfits'] });
  const found = targets.map((target) => {
    const thing = dat.things.outfits.get(target.outfitId);
    if (!thing)
      throw new CliError(
        `El outfit ${target.outfitId} (${target.labels.join(', ')}) no existe en el DAT (hay ${dat.counts.outfits}).`,
      );
    return { ...target, thing };
  });
  if (inspectOnly) {
    const summary = found.map(({ labels, outfitId, thing }) => {
      const group = idleGroup(thing);
      return {
        labels,
        outfitId,
        width: group.width,
        height: group.height,
        layers: group.layers,
        patternsX: group.patternX,
        patternsY: group.patternY,
        patternsZ: group.patternZ,
        phases: group.phases,
      };
    });
    const counts = [dat.counts.items, dat.counts.outfits, dat.counts.effects, dat.counts.missiles];
    console.log(JSON.stringify({ counts, outfits: summary }, null, 2));
    return;
  }

  const sprites = SpriteFile.open(/** @type {string} */ (inputs.sprPath), format);
  try {
    const readSprite = (id) => sprites.readSprite(id);
    for (const { thing, labels } of found)
      assertRegistrable(thing, readSprite, `El outfit ${thing.id} (${labels.join(', ')})`);
    const result = registerOutfitSprites({
      spritesDir,
      repoRoot,
      outfits: found.map(({ thing }) => ({ thing, readSprite })),
    });
    // Local absolute paths are deliberately not printed in the summary.
    console.log(
      JSON.stringify(
        {
          outfits: found.map(({ outfitId, labels, thing }) => ({
            outfitId,
            labels,
            sprite: outfitSpriteKey(outfitId),
            ...outfitSize(thing),
          })),
          changed: result.changes.map((change) => change.key),
        },
        null,
        2,
      ),
    );
  } finally {
    sprites.close();
  }
}

main().catch((error) => {
  if (error instanceof CliError || error instanceof ThingsFormatError) {
    console.error(`Error: ${error.message}`);
    if (error instanceof CliError && error.showHelp) console.error(`\n${HELP}`);
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});
