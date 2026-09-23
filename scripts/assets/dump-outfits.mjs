// Owner tool: dumps PokeAlliance outfit frames and metadata from the owner's
// already-decrypted things DAT/SPR into a private research folder.
//
// Read-only on the client files: never modifies, executes or decrypts them.
// Usage and safety notes: scripts/assets/README.md (`pnpm assets:outfits -- --help`).

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_THINGS_FORMAT,
  SpriteFile,
  TILE_SIZE,
  ThingsFormatError,
  blitPixels,
  composeFrame,
  encodePng,
  encodePngStream,
  indexOtmlSection,
  isFullyTransparent,
  parseDat,
  parseOtfi,
  parseOtml,
  scalePixels,
  sha256,
  sha256File,
} from './lib/otclient-things.mjs';
import {
  CliError,
  assertReusableOutputDir,
  assertSafeOutputDir,
  formatBytes,
  isPathInside,
  normalizeUserPath,
  resolveThingsInputs,
} from './lib/things-cli.mjs';
import {
  TOOL_NAME,
  TOOL_VERSION,
  formatMappingDiff,
  frameFileName,
  layerSuffix,
  layoutSheet,
  listCells,
  outputFingerprint,
  parseDumpArgs,
  planFrames,
  resolveSelection,
  slugsByOutfit,
  summarizeOutfit,
  updateMappingText,
  validateMapping,
} from './lib/outfit-dump.mjs';
import {
  MAX_REGISTER,
  assertRegistrable,
  outfitSize,
  outfitSpriteKey,
  registerOutfitSprites,
} from './lib/sprite-registry.mjs';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const privateInbox = path.join(repoRoot, 'research-inbox', 'client-files');
const defaultOut = path.join(privateInbox, 'outfits-dump');

const PRIVATE_NOTICE =
  'Salida privada de investigación generada desde archivos things descifrados por el propietario. ' +
  'Los derechos de redistribución no están establecidos: no hacer commit ni publicar sin revisión.';

/** First line of README.txt; also marks a folder as an earlier dump of this tool. */
const README_FIRST_LINE = 'Volcado privado de outfits de PokeAlliance (Alliance Codex)';

const README_TEXT = `${README_FIRST_LINE}
===========================================================

Esta carpeta es salida PRIVADA de investigación generada por
scripts/assets/dump-outfits.mjs a partir de los archivos things (.dat/.spr) que
el propietario ya descifró en su equipo.

- Los derechos de redistribución de estos sprites y datos NO están establecidos.
- No hagas commit, no publiques ni subas este contenido sin una revisión explícita.
- La herramienta solo lee los archivos del cliente: nunca los modifica, ejecuta
  ni descifra.
- Cada outfit-<id>/outfit.json registra la estructura del DAT/SPR, las opciones
  usadas y el SHA-256 de cada archivo emitido.
- manifest.json indexa todos los outfits volcados en esta carpeta.
`;

const HELP = `Uso: pnpm assets:outfits -- <selección> [opciones]
     node scripts/assets/dump-outfits.mjs <selección> [opciones]

Vuelca sprites y datos de outfits desde los archivos things (.dat/.spr) ya
descifrados por el propietario. Solo lee los archivos del cliente.

Selección (al menos una, salvo con --list o --map):
  --all                    Todos los outfits del DAT.
  --id 7,509               IDs concretos (repetible). Los addons se eligen por su ID.
  --range 1-120            Rango de IDs (repetible).
  --slug charizard,...     Pokémon de content/outfits.json (repetible).
  --mapped                 Todos los Pokémon de content/outfits.json.

Archivos de entrada (carpeta del things del cliente):
  --things <carpeta>       Carpeta con el .dat y el .spr descifrados. Detecta
                           things_objectbuilder.dat > things.dat > un único *.dat,
                           things.spr > un único *.spr, y things.otml / things.otfi.
  --dat <archivo>          Archivo .dat exacto (prioridad sobre --things). Sin --things,
                           el .spr, .otml y .otfi se buscan junto a este .dat.
  --spr <archivo>          Archivo .spr exacto.
  --otml <archivo>         things.otml exacto (opcional: opacidad, desplazamientos).
  --otfi <archivo>         things.otfi exacto (opcional: define el formato del DAT/SPR).
  Prioridad: --dat/--spr/--otml/--otfi > --things > variable PKA_DECRYPTED_THINGS >
  carpeta predeterminada (...\\PokeAlliance\\data\\things\\decrypted_objectbuilder).

Acciones:
  --list [--json]          Lista outfits: tamaño, capas, patrones, fases, grupos, slugs.
  --map slug=id            Añade/actualiza el outfit de un Pokémon en content/outfits.json
                           (repetible). Nunca elimina registros ni addons.
  --registrar              Tras el volcado, publica en el sitio los frames idle (fase 0) de las
                           cuatro direcciones de cada outfit elegido en
                           public/sprites/outfits/<id>/ y añade o actualiza "outfits/<id>" en
                           public/sprites/sprites.json. Máximo ${MAX_REGISTER} outfits; no acepta --all.
  --preview                Atajo de --mapped --registrar.
  --dry-run                Muestra qué se escribiría sin escribir nada.

Salida:
  --out <carpeta>          Por defecto research-inbox/client-files/outfits-dump (ignorada por Git).
                           Debe estar vacía, no existir o ser un volcado anterior.
  --frames idle|all        idle = fase 0 de cada dirección/addon/montura; all (defecto) = todo.
  --layers                 Escribe también la máscara de color (_mask) y capas extra (_layerN).
  --sheet                  Escribe sheet.png + atlas.json por outfit.
  --scale N                Escala entera de 1 a 8 (vecino más cercano).
  --keep-empty             Escribe también los frames (y hojas) totalmente transparentes.
  --force                  Regenera aunque outfit.json indique que ya está al día.
  --help                   Muestra esta ayuda.

Ejemplos:
  pnpm assets:outfits -- --things "C:\\ruta\\a\\data\\things" --list
  pnpm assets:outfits -- --things "C:\\ruta\\a\\data\\things" --slug shiny-charizard
  pnpm assets:outfits -- --dat "D:\\x\\things.dat" --spr "D:\\x\\things.spr" --id 7,509 --sheet
  pnpm assets:outfits -- --things "C:\\ruta\\a\\data\\things" --all --frames idle
  pnpm assets:outfits -- --things "C:\\ruta\\a\\data\\things" --map <slug>=<id> --slug <slug> --registrar
  pnpm assets:outfits -- --things "C:\\ruta\\a\\data\\things" --id 1005 --registrar
`;

/** Informational output; goes to stderr when stdout carries JSON. */
let info = (...parts) => console.log(...parts);

/** JSON with arrays of numbers kept on one line (sprite ID lists stay readable). */
function stringifyJson(value) {
  return `${JSON.stringify(value, null, 2).replace(
    /\[\s*(-?\d+(?:\.\d+)?(?:,\s*-?\d+(?:\.\d+)?)*)\s*\]/g,
    (_, list) => `[${list.split(/,\s*/).join(', ')}]`,
  )}\n`;
}

function readJsonIfPresent(file) {
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function displayPath(file) {
  return isPathInside(file, repoRoot) ? path.relative(repoRoot, file) : file;
}

function idleGroup(thing) {
  return thing.frameGroups.find((group) => group.type === 0) ?? thing.frameGroups[0];
}

function hasSprites(thing) {
  return thing.frameGroups.some((group) => group.spriteIds.some(Boolean));
}

/** Removes a file this tool generated earlier (plain file names only). */
function removeGenerated(directory, file) {
  if (typeof file !== 'string' || path.basename(file) !== file || !/\.(png|json)$/i.test(file))
    return;
  rmSync(path.join(directory, file), { force: true });
}

/**
 * True when an outfit folder already holds this exact output: same fingerprint
 * (tool version, input hashes, options, slugs) and every recorded file present.
 */
function isUpToDate(directory, previous, fingerprint) {
  return (
    previous?.fingerprint === fingerprint &&
    Boolean(previous.summary) &&
    Array.isArray(previous.files) &&
    previous.files.every(
      (file) => typeof file?.file === 'string' && existsSync(path.join(directory, file.file)),
    )
  );
}

function printInputs(inputs, format, otfi, sprOptional) {
  info('Archivos de entrada (solo lectura):');
  if (inputs.folder) info(`  carpeta: ${inputs.folder} [${inputs.folderOrigin}]`);
  info(`  DAT:  ${inputs.datPath} [${inputs.origins.dat}]`);
  info(
    `  SPR:  ${inputs.sprPath ?? `(no seleccionado${sprOptional ? '; no hace falta para --list' : ''})`}` +
      `${inputs.sprPath ? ` [${inputs.origins.spr}]` : ''}`,
  );
  info(
    `  OTML: ${inputs.otmlPath ?? '(no encontrado)'}${inputs.otmlPath ? ` [${inputs.origins.otml}]` : ''}`,
  );
  info(
    `  OTFI: ${inputs.otfiPath ?? '(no encontrado)'}${inputs.otfiPath ? ` [${inputs.origins.otfi}]` : ''}`,
  );
  info(
    `  formato: extended=${format.extended} transparency=${format.transparency} ` +
      `frame-durations=${format.frameDurations} frame-groups=${format.frameGroups}` +
      (otfi ? '' : ' (predeterminado, sin .otfi)'),
  );
}

/**
 * Hashes the inputs for the output fingerprint (a changed client re-renders its
 * outfits) and returns the client structure recorded in every output.
 */
async function describeInputs({ inputs, dat, datBuffer, format, spriteFile }) {
  info(`Leyendo las entradas${inputs.sprPath ? ' (el SPR puede tardar unos segundos)' : ''}...`);
  return {
    hashes: {
      dat: sha256(datBuffer),
      spr: inputs.sprPath ? await sha256File(inputs.sprPath) : null,
      otml: inputs.otmlPath ? sha256(readFileSync(inputs.otmlPath)) : null,
      otfi: inputs.otfiPath ? sha256(readFileSync(inputs.otfiPath)) : null,
    },
    client: {
      format,
      datCounts: dat.counts,
      sprSpriteCount: spriteFile?.count ?? null,
    },
  };
}

/**
 * Validates the --map entries against the DAT/SPR and computes the new mapping
 * text. Nothing is written here: the caller writes only after every other
 * option has been validated.
 */
function planMapping(options, context) {
  const { outfits, outfitCount, mapping, mappingText, sprites } = context;
  const index = slugsByOutfit(mapping);
  const warnings = [];
  for (const { slug, id } of options.map) {
    const thing = outfits.get(id);
    if (!thing)
      throw new CliError(
        `--map ${slug}=${id}: el outfit ${id} no existe en el DAT (hay ${outfitCount}).`,
      );
    const group = idleGroup(thing);
    if (group.patternX < 4)
      throw new CliError(
        `--map ${slug}=${id}: el outfit tiene ${group.patternX} dirección(es); la vista previa del sitio necesita 4.`,
      );
    const spriteFile = sprites();
    const visible =
      hasSprites(thing) &&
      [0, 1, 2, 3].some(
        (x) =>
          !isFullyTransparent(
            composeFrame(group, { x }, (sprite) => spriteFile.readSprite(sprite)).pixels,
          ),
      );
    if (!visible)
      throw new CliError(`--map ${slug}=${id}: el outfit ${id} está vacío (sin píxeles visibles).`);
    const others = (index.get(id) ?? []).filter((other) => other !== slug);
    if (others.length)
      warnings.push(`el outfit ${id} también está mapeado a ${others.join(', ')}.`);
  }
  return { ...updateMappingText(mappingText, options.map), warnings };
}

function writeMapping(plan, { mappingPath, dryRun, registrar }) {
  for (const warning of plan.warnings) info(`Aviso: ${warning}`);
  if (!plan.changes.length) {
    info(`Mapeo sin cambios en ${displayPath(mappingPath)}.`);
    return;
  }
  info(`Cambios en ${displayPath(mappingPath)}:`);
  for (const line of formatMappingDiff(plan.changes)) info(`  ${line}`);
  if (dryRun) info('  (--dry-run: no se escribió el archivo)');
  else writeFileSync(mappingPath, plan.text);
  if (!registrar) info('  Usa --registrar para publicar en el sitio los frames del outfit nuevo.');
}

function listOutfits(options, { ids, outfits, outfitCount, mapping, otmlIndex, input }) {
  const slugIndex = slugsByOutfit(mapping);
  const rows = ids.map((id) => {
    const thing = outfits.get(id);
    return {
      ...summarizeOutfit(thing),
      slugs: slugIndex.get(id) ?? [],
      attributes: thing.attributes.map((attribute) => attribute.name),
      otml: otmlIndex.get(id) ?? null,
    };
  });
  if (options.json) {
    console.log(
      stringifyJson({
        tool: TOOL_NAME,
        toolVersion: TOOL_VERSION,
        client: input.client,
        outfits: rows,
      }),
    );
    return;
  }
  const header = [
    'id',
    'tamaño',
    'exacto',
    'capas',
    'dir(X)',
    'addon(Y)',
    'montura(Z)',
    'fases',
    'grupos',
    'slugs',
  ];
  const lines = rows.map((row) => {
    const cells = listCells(row);
    return [
      String(row.id),
      cells.size,
      cells.exactSize,
      cells.layers,
      cells.patternX,
      cells.patternY,
      cells.patternZ,
      cells.phases,
      cells.frameGroups,
      `${row.slugs.join(', ')}${row.emptySpriteIds ? ' (sin sprites)' : ''}`,
    ];
  });
  const widths = header.map((title, column) =>
    Math.max(title.length, ...lines.map((line) => line[column].length)),
  );
  const format = (cells) =>
    cells
      .map((cell, column) => (column === cells.length - 1 ? cell : cell.padStart(widths[column])))
      .join('  ');
  console.log(format(header));
  for (const line of lines) console.log(format(line));
  const count = (predicate) => rows.filter(predicate).length;
  console.log(
    `Total: ${rows.length} outfits listados (de ${outfitCount} en el DAT); ` +
      `${count((row) => row.emptySpriteIds)} sin sprites, ${count((row) => row.hasMask)} con capa de máscara, ` +
      `${count((row) => row.hasAddons)} con addons, ${count((row) => row.hasMount)} con montura.`,
  );
}

/**
 * Writes one outfit folder. Returns its manifest summary and counters.
 */
async function dumpOutfit(thing, context) {
  const { outDir, sprites, input, renderOptions, slugs, otml, force } = context;
  const directory = path.join(outDir, `outfit-${thing.id}`);
  const recordPath = path.join(directory, 'outfit.json');
  const fingerprint = outputFingerprint({
    toolVersion: TOOL_VERSION,
    ...input.hashes,
    options: renderOptions,
    slugs,
  });
  const previous = readJsonIfPresent(recordPath);
  if (!force && isUpToDate(directory, previous, fingerprint)) {
    return { skipped: true, summary: previous.summary, written: 0, empty: 0, extra: 0, bytes: 0 };
  }
  if (Array.isArray(previous?.files))
    for (const file of previous.files) removeGenerated(directory, file?.file);
  mkdirSync(directory, { recursive: true });

  const { scale, keepEmpty } = renderOptions;
  const readSprite = (id) => sprites.readSprite(id);
  const files = [];
  const frames = [];
  const sheetFrames = [];
  let written = 0;
  let empty = 0;
  let extra = 0;
  let bytes = 0;
  const writeFile = (name, data, entry) => {
    writeFileSync(path.join(directory, name), data);
    const record = { file: name, ...entry, bytes: data.length, sha256: sha256(data) };
    files.push(record);
    bytes += data.length;
    return record;
  };
  const writePng = (name, pixels, width, height, kind) =>
    writeFile(name, encodePng(pixels, width, height), { kind, width, height });

  for (const planned of planFrames(thing, renderOptions.frames)) {
    const group = thing.frameGroups[planned.groupIndex];
    const position = { x: planned.x, y: planned.y, z: planned.z, phase: planned.phase };
    const composed = composeFrame(group, { ...position, layer: 0 }, readSprite);
    const isEmpty = isFullyTransparent(composed.pixels);
    const width = composed.width * scale;
    const height = composed.height * scale;
    const name = frameFileName(planned);
    let entry = null;
    if (!isEmpty || keepEmpty) {
      entry = writePng(
        name,
        scalePixels(composed.pixels, composed.width, composed.height, scale),
        width,
        height,
        'frame',
      );
      written++;
    }
    if (isEmpty) empty++;
    const layers = [];
    if (renderOptions.layers) {
      for (let layer = 1; layer < group.layers; layer++) {
        const layerFrame = composeFrame(group, { ...position, layer }, readSprite);
        const layerEmpty = isFullyTransparent(layerFrame.pixels);
        let layerEntry = null;
        if (!layerEmpty || keepEmpty) {
          layerEntry = writePng(
            frameFileName(planned, layerSuffix(layer)),
            scalePixels(layerFrame.pixels, layerFrame.width, layerFrame.height, scale),
            width,
            height,
            layer === 1 ? 'mask' : 'layer',
          );
          extra++;
        }
        layers.push({
          layer,
          role: layer === 1 ? 'colour template mask' : 'extra layer',
          file: layerEntry?.file ?? null,
          empty: layerEmpty,
          sha256: layerEntry?.sha256 ?? null,
          spriteIds: layerFrame.spriteIds,
        });
      }
    }
    frames.push({
      name,
      file: entry?.file ?? null,
      group: planned.group,
      groupIndex: planned.groupIndex,
      direction: planned.direction,
      x: planned.x,
      addon: planned.y,
      mount: planned.z,
      phase: planned.phase,
      width,
      height,
      empty: isEmpty,
      sha256: entry?.sha256 ?? null,
      bytes: entry?.bytes ?? null,
      spriteIds: composed.spriteIds,
      layers,
    });
    // Sheets keep unscaled pixels; the encoder upscales row by row.
    if (renderOptions.sheet)
      sheetFrames.push({
        ...planned,
        width: composed.width,
        height: composed.height,
        pixels: composed.pixels,
        empty: isEmpty,
      });
  }

  let sheet = null;
  if (renderOptions.sheet && sheetFrames.length) {
    if (!keepEmpty && sheetFrames.every((frame) => frame.empty)) {
      sheet = {
        image: null,
        atlas: null,
        skipped: 'Every frame is fully transparent; use --keep-empty to write the sheet anyway.',
      };
    } else {
      const base = layoutSheet(sheetFrames);
      const canvas = Buffer.alloc(base.width * base.height * 4);
      sheetFrames.forEach((frame, index) =>
        blitPixels(
          canvas,
          base.width,
          frame.pixels,
          frame.width,
          frame.height,
          base.rects[index].x,
          base.rects[index].y,
        ),
      );
      // Same layout in output pixels (it scales linearly) for the atlas.
      const layout = layoutSheet(
        sheetFrames.map((frame) => ({
          ...frame,
          width: frame.width * scale,
          height: frame.height * scale,
        })),
      );
      writeFile('sheet.png', await encodePngStream(canvas, base.width, base.height, { scale }), {
        kind: 'sheet',
        width: layout.width,
        height: layout.height,
      });
      const atlas = {
        schemaVersion: 1,
        outfitId: thing.id,
        image: 'sheet.png',
        scale,
        width: layout.width,
        height: layout.height,
        cellWidth: layout.cellWidth,
        cellHeight: layout.cellHeight,
        columns: layout.columns,
        columnMeaning: 'animation phase',
        anchor: 'bottom-right of each cell (OTClient tile anchoring)',
        rows: layout.rows,
        frames: sheetFrames.map((frame, index) => ({
          name: frameFileName(frame),
          group: frame.group,
          direction: frame.direction,
          addon: frame.y,
          mount: frame.z,
          phase: frame.phase,
          ...layout.rects[index],
          empty: frame.empty,
        })),
      };
      writeFile('atlas.json', Buffer.from(stringifyJson(atlas)), { kind: 'atlas' });
      sheet = {
        image: 'sheet.png',
        atlas: 'atlas.json',
        width: layout.width,
        height: layout.height,
        rows: layout.rows.length,
        columns: layout.columns,
      };
    }
  }

  const primary = thing.frameGroups[0];
  const generatedAt = new Date().toISOString();
  const displacement =
    thing.attributes.find((attribute) => attribute.name === 'displacement')?.value ?? null;
  const summary = {
    id: thing.id,
    slugs,
    dir: `outfit-${thing.id}`,
    widthPx: primary.width * TILE_SIZE,
    heightPx: primary.height * TILE_SIZE,
    tiles: { width: primary.width, height: primary.height },
    exactSize: primary.exactSize,
    layers: primary.layers,
    patternX: primary.patternX,
    patternY: primary.patternY,
    patternZ: primary.patternZ,
    phases: primary.phases,
    frameGroups: thing.frameGroups.length,
    hasAddons: thing.frameGroups.some((group) => group.patternY > 1),
    hasMount: thing.frameGroups.some((group) => group.patternZ > 1),
    frames: frames.length,
    framesWritten: written,
    emptyFrames: empty,
    extraLayerFiles: extra,
    sheet: Boolean(sheet?.image),
    empty: frames.every((frame) => frame.empty),
    generatedAt,
  };
  const record = {
    schemaVersion: 1,
    tool: TOOL_NAME,
    toolVersion: TOOL_VERSION,
    generatedAt,
    notice: PRIVATE_NOTICE,
    id: thing.id,
    category: 'outfits',
    mappedSlugs: slugs,
    dimensions: {
      tilesWide: primary.width,
      tilesHigh: primary.height,
      widthPx: primary.width * TILE_SIZE,
      heightPx: primary.height * TILE_SIZE,
      realSize: primary.realSize,
      exactSize: primary.exactSize,
      scale,
      outputWidthPx: primary.width * TILE_SIZE * scale,
      outputHeightPx: primary.height * TILE_SIZE * scale,
    },
    patterns: {
      patternX: primary.patternX,
      patternY: primary.patternY,
      patternZ: primary.patternZ,
      meaning: {
        patternX:
          primary.patternX === 1
            ? 'single direction: the same sprite is used for every facing (files use "any")'
            : 'direction (0 north, 1 east, 2 south, 3 west)',
        patternY: 'addon (0 = base outfit)',
        patternZ: 'mount (0 = not mounted)',
      },
    },
    phases: primary.phases,
    animation: thing.frameGroups.some((group) => group.animation)
      ? thing.frameGroups.map((group) => ({ group: group.name, ...group.animation }))
      : {
          present: false,
          note: 'The DAT format (frame-durations=false) stores no phase durations or loop data; the client uses its default timing.',
        },
    layers: {
      count: primary.layers,
      note:
        primary.layers > 1
          ? 'Layer 0 is composited in the frames; layer 1 is the colour template mask (written with --layers).'
          : 'Single layer.',
    },
    render: {
      displacement,
      otml: otml ?? null,
      opacity: otml?.opacity ?? null,
      nameDisplacement: otml?.['name-displacement'] ?? null,
    },
    attributes: thing.attributes,
    frameGroups: thing.frameGroups,
    dat: { offset: thing.offset, byteLength: thing.byteLength },
    frames,
    sheet,
    files,
    summary,
    client: input.client,
    options: renderOptions,
    fingerprint,
  };
  // Written last: an interrupted run leaves no matching fingerprint and is redone.
  writeFileSync(recordPath, stringifyJson(record));
  return { skipped: false, summary, written, empty, extra, bytes };
}

function writeManifest(outDir, entries, client) {
  const manifestPath = path.join(outDir, 'manifest.json');
  const previous = readJsonIfPresent(manifestPath);
  const merged = new Map(
    (Array.isArray(previous?.outfits) ? previous.outfits : []).map((entry) => [entry.id, entry]),
  );
  for (const [id, entry] of entries) merged.set(id, entry);
  const outfits = [...merged.values()].sort((a, b) => a.id - b.id);
  const manifest = {
    schemaVersion: 1,
    tool: TOOL_NAME,
    toolVersion: TOOL_VERSION,
    updatedAt: new Date().toISOString(),
    notice: PRIVATE_NOTICE,
    client,
    outfitCount: outfits.length,
    frameFiles: outfits.reduce((total, entry) => total + (entry.framesWritten ?? 0), 0),
    outfits,
  };
  writeFileSync(manifestPath, stringifyJson(manifest));
}

async function dump(options, context) {
  const { ids, outDir, outfits, mapping, otmlIndex, input, spriteFile, started } = context;
  info(`Salida: ${outDir}`);
  if (isPathInside(outDir, repoRoot) && !isPathInside(outDir, privateInbox)) {
    info(
      'Aviso: la salida está dentro del repositorio pero fuera de research-inbox/client-files (ignorada por Git). ' +
        'No hagas commit de estos sprites.',
    );
  }
  const renderOptions = {
    frames: options.frames,
    layers: options.layers,
    sheet: options.sheet,
    scale: options.scale,
    keepEmpty: options.keepEmpty,
  };
  const slugIndex = slugsByOutfit(mapping);

  if (options.dryRun) {
    let frames = 0;
    let extra = 0;
    let upToDate = 0;
    for (const id of ids) {
      const thing = outfits.get(id);
      const planned = planFrames(thing, options.frames);
      frames += planned.length;
      if (options.layers)
        extra += planned.reduce(
          (total, frame) => total + thing.frameGroups[frame.groupIndex].layers - 1,
          0,
        );
      const directory = path.join(outDir, `outfit-${id}`);
      const fingerprint = outputFingerprint({
        toolVersion: TOOL_VERSION,
        ...input.hashes,
        options: renderOptions,
        slugs: slugIndex.get(id) ?? [],
      });
      const previous = readJsonIfPresent(path.join(directory, 'outfit.json'));
      if (!options.force && isUpToDate(directory, previous, fingerprint)) upToDate++;
    }
    const preview = ids.length > 12 ? `${ids.slice(0, 12).join(', ')}, ...` : ids.join(', ');
    const sheets = options.sheet ? ids.length * 2 : 0;
    info(`--dry-run: ${ids.length} outfits seleccionados (${preview}).`);
    info(
      `  Se escribirían hasta ${frames} frames` +
        (options.layers ? ` + ${extra} capas extra` : '') +
        (sheets ? ` + ${sheets} archivos de hoja (sheet.png/atlas.json)` : '') +
        ` + ${ids.length} outfit.json + manifest.json + README.txt ` +
        `(≈ ${frames + extra + sheets + ids.length + 2} archivos como máximo).`,
    );
    info(
      `  ${upToDate} outfits se omitirían por estar al día.` +
        (options.keepEmpty
          ? ''
          : ' Los frames totalmente transparentes no se escriben (quedan marcados en outfit.json).'),
    );
    info('  No se escribió nada.');
    return;
  }

  mkdirSync(outDir, { recursive: true });
  const readmePath = path.join(outDir, 'README.txt');
  if (!existsSync(readmePath) || readFileSync(readmePath, 'utf8') !== README_TEXT)
    writeFileSync(readmePath, README_TEXT);

  const totals = { outfits: 0, skipped: 0, frames: 0, empty: 0, extra: 0, bytes: 0 };
  const entries = new Map();
  const every = Math.max(1, Math.ceil(ids.length / 20));
  info(
    `Volcando ${ids.length} outfits (frames=${options.frames}${options.layers ? ', capas' : ''}${options.sheet ? ', hojas' : ''}${options.scale > 1 ? `, escala x${options.scale}` : ''})...`,
  );
  for (const [index, id] of ids.entries()) {
    const result = await dumpOutfit(outfits.get(id), {
      outDir,
      sprites: spriteFile,
      input,
      renderOptions,
      slugs: slugIndex.get(id) ?? [],
      otml: otmlIndex.get(id) ?? null,
      force: options.force,
    });
    entries.set(id, result.summary);
    if (result.skipped) totals.skipped++;
    else totals.outfits++;
    totals.frames += result.written;
    totals.empty += result.empty;
    totals.extra += result.extra;
    totals.bytes += result.bytes;
    if ((index + 1) % every === 0 || index + 1 === ids.length) {
      const seconds = ((performance.now() - started) / 1000).toFixed(1);
      info(
        `  [${index + 1}/${ids.length}] outfit ${id} · ${totals.frames} frames · ${formatBytes(totals.bytes)} · ${seconds} s`,
      );
    }
  }
  writeManifest(outDir, entries, input.client);
  const seconds = ((performance.now() - started) / 1000).toFixed(1);
  info(
    `Listo en ${seconds} s: ${totals.outfits} outfits escritos, ${totals.skipped} omitidos (al día), ` +
      `${totals.frames} frames, ${totals.extra} capas extra, ${totals.empty} frames vacíos ` +
      `${options.keepEmpty ? '(escritos)' : '(no escritos)'}, ${formatBytes(totals.bytes)} ` +
      `(memoria máx. ${formatBytes(process.resourceUsage().maxRSS * 1024)}).`,
  );
  info(`Salida: ${outDir} (manifest.json, README.txt, outfit-<id>/outfit.json)`);
}

/**
 * Publishes the idle frames of the selected outfits in public/sprites and
 * updates sprites.json. Runs after the dump; everything was validated before.
 */
function register(ids, { outfits, spriteFile, spritesDir, dryRun }) {
  info(`Registrando ${ids.length} outfit(s) en ${displayPath(spritesDir)}...`);
  const result = registerOutfitSprites({
    spritesDir,
    repoRoot,
    dryRun,
    outfits: ids.map((id) => ({
      thing: outfits.get(id),
      readSprite: (sprite) => spriteFile.readSprite(sprite),
    })),
  });
  for (const id of ids) {
    const { width, height } = outfitSize(outfits.get(id));
    const change = result.changes.find((entry) => entry.key === outfitSpriteKey(id));
    const state = change ? (change.added ? 'nuevo' : 'actualizado') : 'sin cambios';
    info(`  ${outfitSpriteKey(id)} · ${width}×${height} · norte, este, sur, oeste · ${state}`);
  }
  if (dryRun) info('  (--dry-run: no se escribió nada)');
  else info(`  sprites.json: ${displayPath(result.registryPath)}`);
}

async function main() {
  // Timings include reading and hashing the inputs.
  const started = performance.now();
  const options = parseDumpArgs(process.argv.slice(2));
  if (options.help) {
    console.log(HELP);
    return 0;
  }
  if (options.json) info = (...parts) => console.error(...parts);

  // --list only reads the DAT; the SPR is hashed when present but not required.
  const needsSprites = (options.hasSelection && !options.list) || options.map.length > 0;
  const inputs = resolveThingsInputs(options, { requireSpr: needsSprites });
  const datBuffer = readFileSync(inputs.datPath);
  const otfi = inputs.otfiPath ? parseOtfi(readFileSync(inputs.otfiPath, 'utf8')) : null;
  const format = otfi?.format ?? { ...DEFAULT_THINGS_FORMAT };
  printInputs(inputs, format, otfi, !needsSprites);
  let dat;
  try {
    dat = parseDat(datBuffer, { format, keep: ['outfits'] });
  } catch (error) {
    if (error instanceof ThingsFormatError) {
      throw new ThingsFormatError(
        `${error.message}\nNo se pudo leer el DAT con el formato indicado. Usa el things.dat compatible con ` +
          'ObjectBuilder (no el DAT original sin convertir) y revisa el .otfi (extended, frame-groups, frame-durations).',
      );
    }
    throw error;
  }
  info(
    `  DAT: firma ${dat.signature}, ${dat.counts.outfits} outfits, ${dat.counts.items} items, ` +
      `${dat.counts.effects} efectos, ${dat.counts.missiles} proyectiles`,
  );
  if (dat.trailingBytes)
    info(
      `Aviso: quedan ${dat.trailingBytes} bytes sin leer al final del DAT; el formato podría no coincidir.`,
    );

  const outfits = dat.things.outfits;
  const outfitCount = dat.counts.outfits;
  const otmlIndex = inputs.otmlPath
    ? indexOtmlSection(parseOtml(readFileSync(inputs.otmlPath, 'utf8')), 'creatures')
    : new Map();
  const mappingPath = process.env.PKA_OUTFIT_MAPPING
    ? normalizeUserPath(process.env.PKA_OUTFIT_MAPPING)
    : path.join(repoRoot, 'content', 'outfits.json');
  const mappingText = readFileSync(mappingPath, 'utf8');
  const spritesDir = process.env.PKA_SPRITES_DIR
    ? normalizeUserPath(process.env.PKA_SPRITES_DIR)
    : path.join(repoRoot, 'public', 'sprites');
  let mapping = validateMapping(JSON.parse(mappingText));

  /** @type {SpriteFile | null} */
  let spriteFile = null;
  const sprites = () =>
    (spriteFile ??= SpriteFile.open(/** @type {string} */ (inputs.sprPath), format));
  try {
    // Validate everything before the first write: mapping entries, selection,
    // output folder and mapping file location.
    const mappingPlan = options.map.length
      ? planMapping(options, { outfits, outfitCount, mapping, mappingText, sprites })
      : null;
    if (mappingPlan) mapping = mappingPlan.mapping;
    const selection = options.hasSelection
      ? resolveSelection(options, { mapping, outfitCount })
      : null;
    let outDir = null;
    if (options.list) {
      if (options.out != null) info('Aviso: --out no se usa con --list (no se escriben archivos).');
    } else if (selection) {
      outDir = options.out != null ? normalizeUserPath(options.out) : defaultOut;
      assertSafeOutputDir(outDir, { inputs, repoRoot });
      assertReusableOutputDir(outDir, { readmeFirstLine: README_FIRST_LINE, tool: TOOL_NAME });
    }
    if (mappingPlan) {
      assertSafeOutputDir(path.dirname(mappingPath), {
        inputs,
        repoRoot,
        label: 'Archivo de mapeo no permitido',
        hint: 'indica otro archivo en PKA_OUTFIT_MAPPING.',
      });
    }
    if (options.registrar && selection) {
      if (selection.ids.length > MAX_REGISTER)
        throw new CliError(
          `--registrar publica como máximo ${MAX_REGISTER} outfits por ejecución y la selección tiene ${selection.ids.length}.`,
        );
      for (const id of selection.ids)
        assertRegistrable(
          outfits.get(id),
          (sprite) => sprites().readSprite(sprite),
          `--registrar ${id}`,
        );
      assertSafeOutputDir(spritesDir, {
        inputs,
        repoRoot,
        allowPublic: true,
        label: 'Carpeta de sprites no permitida',
        hint: 'indica otra carpeta en PKA_SPRITES_DIR.',
      });
    }
    for (const warning of selection?.warnings ?? []) info(`Aviso: ${warning}`);
    if (options.preview) info('--preview equivale a --mapped --registrar.');
    if (mappingPlan)
      writeMapping(mappingPlan, {
        mappingPath,
        dryRun: options.dryRun,
        registrar: options.registrar,
      });

    if (options.list) {
      const input = await describeInputs({
        inputs,
        dat,
        datBuffer,
        format,
        spriteFile: inputs.sprPath ? sprites() : null,
      });
      const ids = selection?.ids ?? Array.from({ length: outfitCount }, (_, index) => index + 1);
      listOutfits(options, { ids, outfits, outfitCount, mapping, otmlIndex, input });
    } else if (selection && outDir) {
      const input = await describeInputs({
        inputs,
        dat,
        datBuffer,
        format,
        spriteFile: sprites(),
      });
      await dump(options, {
        ids: selection.ids,
        outDir,
        outfits,
        mapping,
        otmlIndex,
        input,
        spriteFile: sprites(),
        started,
      });
      if (options.registrar)
        register(selection.ids, {
          outfits,
          spriteFile: sprites(),
          spritesDir,
          dryRun: options.dryRun,
        });
    }
  } finally {
    /** @type {SpriteFile | null} */ (spriteFile)?.close();
  }
  return 0;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error) => {
    if (error instanceof CliError || error instanceof ThingsFormatError) {
      console.error(`Error: ${error.message}`);
      if (error instanceof CliError && error.showHelp) console.error(`\n${HELP}`);
    } else {
      console.error(error);
    }
    process.exitCode = 1;
  },
);
