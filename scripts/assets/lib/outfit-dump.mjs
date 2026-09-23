// Pure helpers for scripts/assets/dump-outfits.mjs: option parsing, outfit
// selection, frame planning/naming, sprite-sheet layout and the
// content/outfits.json update. No side effects on import; no file access.

import { DIRECTION_NAMES, TILE_SIZE, sha256 } from './otclient-things.mjs';
import { CliError, parseArgv } from './things-cli.mjs';

export const TOOL_NAME = 'scripts/assets/dump-outfits.mjs';
export const TOOL_VERSION = '1.2.0';

/** Same rule as the preview extractor and the site's outfit mapping. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const DUMP_ARGV_SPEC = {
  booleans: [
    'all',
    'mapped',
    'list',
    'json',
    'layers',
    'sheet',
    'force',
    'dry-run',
    'preview',
    'registrar',
    'keep-empty',
    'help',
  ],
  values: ['out', 'frames', 'scale', 'things', 'dat', 'spr', 'otml', 'otfi'],
  repeatable: ['id', 'range', 'slug', 'map'],
};

/**
 * @typedef {object} DumpOptions
 * @property {boolean} help
 * @property {boolean} all
 * @property {boolean} mapped
 * @property {boolean} list
 * @property {boolean} json
 * @property {boolean} layers
 * @property {boolean} sheet
 * @property {boolean} force
 * @property {boolean} dryRun
 * @property {boolean} preview
 * @property {boolean} registrar
 * @property {boolean} keepEmpty
 * @property {number[]} ids
 * @property {{ from: number, to: number }[]} ranges
 * @property {string[]} slugs
 * @property {{ slug: string, id: number }[]} map
 * @property {'all' | 'idle'} frames
 * @property {number} scale
 * @property {string | null} out
 * @property {string | undefined} things
 * @property {string | undefined} dat
 * @property {string | undefined} spr
 * @property {string | undefined} otml
 * @property {string | undefined} otfi
 * @property {boolean} hasSelection
 */

/**
 * Splits list options on commas and whitespace. PowerShell turns an unquoted
 * `--id 7,509` into an array, and the pnpm shim forwards it as "7 509".
 * @param {string[]} values
 */
function splitList(values) {
  return values
    .flatMap((value) => value.split(/[\s,]+/))
    .map((value) => value.trim())
    .filter(Boolean);
}

function parsePositiveInteger(text, flag) {
  if (!/^\d+$/.test(text) || !Number.isSafeInteger(Number(text)) || Number(text) < 1)
    throw new CliError(`Valor inválido para ${flag}: "${text}". Se espera un ID entero positivo.`);
  return Number(text);
}

/** Validates a slug for the outfit mapping. */
export function validateSlug(slug, flag = '--slug') {
  if (!SLUG_PATTERN.test(slug))
    throw new CliError(
      `Slug inválido en ${flag}: "${slug}". Usa kebab-case: minúsculas, números y guiones.`,
    );
  if (/^\d+$/.test(slug))
    throw new CliError(`Slug inválido en ${flag}: "${slug}". No puede ser solo números.`);
  return slug;
}

/**
 * Parses and validates the dump CLI arguments.
 * @param {string[]} argv
 * @returns {DumpOptions}
 */
export function parseDumpArgs(argv) {
  const raw = parseArgv(argv, DUMP_ARGV_SPEC);
  const list = (name) => splitList(/** @type {string[] | undefined} */ (raw[name]) ?? []);
  const text = (name) => /** @type {string | undefined} */ (raw[name]);

  const ids = list('id').map((value) => parsePositiveInteger(value, '--id'));
  const ranges = list('range').map((value) => {
    const match = /^(\d+)\s*-\s*(\d+)$/.exec(value);
    if (!match)
      throw new CliError(
        `Rango inválido en --range: "${value}". Usa inicio-fin, por ejemplo 1-120.`,
      );
    const from = parsePositiveInteger(match[1], '--range');
    const to = parsePositiveInteger(match[2], '--range');
    if (from > to)
      throw new CliError(`Rango inválido en --range: "${value}". El inicio es mayor que el fin.`);
    return { from, to };
  });
  const slugs = list('slug').map((slug) => validateSlug(slug));
  const map = list('map').map((entry) => {
    const match = /^([^=]+)=(.+)$/.exec(entry);
    if (!match)
      throw new CliError(
        `Formato inválido en --map: "${entry}". Usa slug=id, por ejemplo mi-slug=123.`,
      );
    return {
      slug: validateSlug(match[1].trim(), '--map'),
      id: parsePositiveInteger(match[2].trim(), '--map'),
    };
  });

  const frames = text('frames') ?? 'all';
  if (frames !== 'all' && frames !== 'idle')
    throw new CliError(`Valor inválido para --frames: "${frames}". Usa idle o all.`);
  const scaleText = text('scale') ?? '1';
  if (!/^\d+$/.test(scaleText) || Number(scaleText) < 1 || Number(scaleText) > 8)
    throw new CliError(`Valor inválido para --scale: "${scaleText}". Usa un entero de 1 a 8.`);

  // --preview is shorthand for --mapped --registrar.
  const preview = raw.preview === true;
  const options = {
    help: raw.help === true,
    all: raw.all === true,
    mapped: raw.mapped === true || preview,
    list: raw.list === true,
    json: raw.json === true,
    layers: raw.layers === true,
    sheet: raw.sheet === true,
    force: raw.force === true,
    dryRun: raw['dry-run'] === true,
    preview,
    registrar: raw.registrar === true || preview,
    keepEmpty: raw['keep-empty'] === true,
    ids,
    ranges,
    slugs,
    map,
    frames: /** @type {'all' | 'idle'} */ (frames),
    scale: Number(scaleText),
    out: text('out') ?? null,
    things: text('things'),
    dat: text('dat'),
    spr: text('spr'),
    otml: text('otml'),
    otfi: text('otfi'),
    hasSelection: false,
  };
  options.hasSelection =
    options.all || options.mapped || ids.length > 0 || ranges.length > 0 || slugs.length > 0;
  if (options.help) return options;
  if (options.json && !options.list) throw new CliError('--json solo se usa junto con --list.');
  if (!options.hasSelection && !options.list && !options.map.length) {
    throw new CliError(
      'Indica qué outfits volcar: --all, --id, --range, --slug o --mapped (o usa --list para ver el catálogo).',
      { showHelp: true },
    );
  }
  if (options.registrar) {
    if (options.list) throw new CliError('--registrar no se usa con --list.');
    if (options.all)
      throw new CliError(
        '--registrar no acepta --all: indica los outfits con --id, --slug o --mapped.',
      );
    if (!options.hasSelection)
      throw new CliError('--registrar necesita outfits: indica --id, --range, --slug o --mapped.');
  }
  return options;
}

/**
 * Validates content/outfits.json and returns its Pokémon slug -> outfit ID
 * map (base outfits; addons are selected with --id).
 * @param {unknown} data
 * @returns {Record<string, number>}
 */
export function validateMapping(data) {
  const outfits = /** @type {{ outfits?: unknown }} */ (data)?.outfits;
  if (!data || typeof data !== 'object' || Array.isArray(data) || !Array.isArray(outfits))
    throw new CliError('content/outfits.json debe ser un objeto con una lista "outfits".');
  /** @type {Record<string, number>} */
  const mapping = {};
  for (const outfit of outfits) {
    const slug = outfit?.pokemon;
    const id = outfit?.outfitId;
    if (typeof slug !== 'string' || !SLUG_PATTERN.test(slug) || !Number.isSafeInteger(id) || id < 1)
      throw new CliError(`Entrada inválida en content/outfits.json: ${slug}=${id}`);
    mapping[slug] = id;
  }
  return mapping;
}

/** Inverts the mapping into outfit ID -> slugs (mapping order preserved). */
export function slugsByOutfit(mapping) {
  /** @type {Map<number, string[]>} */
  const result = new Map();
  for (const [slug, id] of Object.entries(mapping))
    result.set(id, [...(result.get(id) ?? []), slug]);
  return result;
}

/**
 * Resolves the selected outfit IDs (sorted, unique).
 * @param {Pick<DumpOptions, 'all' | 'mapped' | 'ids' | 'ranges' | 'slugs'>} options
 * @param {{ mapping: Record<string, number>, outfitCount: number }} context
 * @returns {{ ids: number[], warnings: string[] }}
 */
export function resolveSelection(options, { mapping, outfitCount }) {
  const selected = new Set();
  const warnings = [];
  const assertExists = (id, origin) => {
    if (id > outfitCount)
      throw new CliError(
        `El outfit ${id} (${origin}) no existe en el DAT: hay ${outfitCount} outfits.`,
      );
  };
  if (options.all) for (let id = 1; id <= outfitCount; id++) selected.add(id);
  for (const id of options.ids) {
    assertExists(id, '--id');
    selected.add(id);
  }
  for (const { from, to } of options.ranges) {
    assertExists(from, `--range ${from}-${to}`);
    const last = Math.min(to, outfitCount);
    if (last < to)
      warnings.push(`--range ${from}-${to} se recortó a ${from}-${last} (último outfit del DAT).`);
    for (let id = from; id <= last; id++) selected.add(id);
  }
  const known = Object.keys(mapping);
  for (const slug of options.slugs) {
    if (!Object.hasOwn(mapping, slug)) {
      throw new CliError(
        `Slug desconocido: ${slug}.\nSlugs conocidos: ${known.join(', ') || '(ninguno)'}.\n` +
          `Regístralo con --map ${slug}=<id> o usa --id.`,
      );
    }
    assertExists(mapping[slug], `--slug ${slug}`);
    selected.add(mapping[slug]);
  }
  if (options.mapped) {
    for (const [slug, id] of Object.entries(mapping)) {
      assertExists(id, `--mapped ${slug}`);
      selected.add(id);
    }
  }
  return { ids: [...selected].sort((a, b) => a - b), warnings };
}

/** Label used when an outfit has a single direction (patternX = 1). */
export const ANY_DIRECTION = 'any';

/**
 * Direction label for a patternX index. With a single direction the sprite does
 * not depend on facing (OTClient uses `direction % patternX`), so it is `any`.
 * @param {number} x
 * @param {number} [patternX]
 */
export function directionName(x, patternX) {
  if (patternX === 1) return ANY_DIRECTION;
  return DIRECTION_NAMES[x] ?? `x${x}`;
}

/** Suffix for extra layers: layer 1 is the colour template mask. */
export function layerSuffix(layer) {
  return layer === 1 ? 'mask' : `layer${layer}`;
}

/**
 * `<group>_<direction>_a<addon>_m<mount>_p<phase>[_suffix].png`
 * @param {{ group: string, x: number, y: number, z: number, phase: number, direction?: string }} frame
 * @param {string} [suffix]
 */
export function frameFileName({ group, x, y, z, phase, direction }, suffix) {
  const facing = direction ?? directionName(x);
  return `${group}_${facing}_a${y}_m${z}_p${phase}${suffix ? `_${suffix}` : ''}.png`;
}

/**
 * @typedef {object} PlannedFrame
 * @property {number} groupIndex
 * @property {string} group
 * @property {string} direction  north/east/south/west, or `any` when patternX = 1.
 * @property {number} x  Direction (patternX).
 * @property {number} y  Addon (patternY).
 * @property {number} z  Mount (patternZ).
 * @property {number} phase
 */

/**
 * Lists the frames to export, ordered group > mount > addon > direction > phase.
 * `idle` keeps phase 0 of the idle group (or the only group).
 * @param {{ frameGroups: import('./otclient-things.mjs').FrameGroup[] }} thing
 * @param {'all' | 'idle'} mode
 * @returns {PlannedFrame[]}
 */
export function planFrames(thing, mode) {
  let groups = thing.frameGroups;
  if (mode === 'idle') {
    const idle = groups.find((group) => group.type === 0);
    groups = [idle ?? groups[0]];
  }
  /** @type {PlannedFrame[]} */
  const frames = [];
  for (const group of groups) {
    const phases = mode === 'idle' ? 1 : group.phases;
    for (let z = 0; z < group.patternZ; z++)
      for (let y = 0; y < group.patternY; y++)
        for (let x = 0; x < group.patternX; x++)
          for (let phase = 0; phase < phases; phase++)
            frames.push({
              groupIndex: group.index,
              group: group.name,
              direction: directionName(x, group.patternX),
              x,
              y,
              z,
              phase,
            });
  }
  return frames;
}

/**
 * Sheet row key: one row per group x mount x addon x direction.
 * @param {{ group: string, x: number, y: number, z: number, direction?: string }} frame
 */
export function sheetRowKey({ group, x, y, z, direction }) {
  return `${group}_${direction ?? directionName(x)}_a${y}_m${z}`;
}

/**
 * Lays out frames on a grid: rows = group x mount x addon x direction (first
 * appearance order), columns = phases. Frames are anchored bottom-right in
 * their cell, matching how OTClient anchors multi-tile things.
 * @param {{ group: string, x: number, y: number, z: number, phase: number, width: number, height: number, direction?: string }[]} frames
 */
export function layoutSheet(frames) {
  const rows = [];
  const rowIndex = new Map();
  let cellWidth = 0;
  let cellHeight = 0;
  let columns = 0;
  for (const frame of frames) {
    const key = sheetRowKey(frame);
    if (!rowIndex.has(key)) {
      rowIndex.set(key, rows.length);
      rows.push({
        key,
        group: frame.group,
        direction: frame.direction ?? directionName(frame.x),
        addon: frame.y,
        mount: frame.z,
      });
    }
    cellWidth = Math.max(cellWidth, frame.width);
    cellHeight = Math.max(cellHeight, frame.height);
    columns = Math.max(columns, frame.phase + 1);
  }
  const rects = frames.map((frame) => {
    const row = /** @type {number} */ (rowIndex.get(sheetRowKey(frame)));
    return {
      row,
      column: frame.phase,
      x: frame.phase * cellWidth + (cellWidth - frame.width),
      y: row * cellHeight + (cellHeight - frame.height),
      w: frame.width,
      h: frame.height,
    };
  });
  return {
    width: columns * cellWidth,
    height: rows.length * cellHeight,
    cellWidth,
    cellHeight,
    columns,
    rows,
    rects,
  };
}

/**
 * Catalogue row for `--list`. The top-level numbers describe the idle group
 * (or the only one); `groups` details every frame group, and the mask, addon
 * and mount flags consider all of them.
 * @param {{ id: number, frameGroups: import('./otclient-things.mjs').FrameGroup[] }} thing
 */
export function summarizeOutfit(thing) {
  const groups = thing.frameGroups;
  const primary = groups.find((group) => group.type === 0) ?? groups[0];
  return {
    id: thing.id,
    width: primary.width,
    height: primary.height,
    widthPx: primary.width * TILE_SIZE,
    heightPx: primary.height * TILE_SIZE,
    exactSize: primary.exactSize,
    layers: primary.layers,
    patternX: primary.patternX,
    patternY: primary.patternY,
    patternZ: primary.patternZ,
    phases: primary.phases,
    frameGroups: groups.map((group) => group.name),
    groups: groups.map((group) => ({
      name: group.name,
      type: group.type,
      width: group.width,
      height: group.height,
      exactSize: group.exactSize,
      layers: group.layers,
      patternX: group.patternX,
      patternY: group.patternY,
      patternZ: group.patternZ,
      phases: group.phases,
      spriteCount: group.spriteCount,
      animation: group.animation ?? null,
    })),
    spriteCount: groups.reduce((total, group) => total + group.spriteCount, 0),
    emptySpriteIds: !groups.some((group) => group.spriteIds.some(Boolean)),
    hasMask: groups.some((group) => group.layers > 1),
    hasAddons: groups.some((group) => group.patternY > 1),
    hasMount: groups.some((group) => group.patternZ > 1),
  };
}

/**
 * Table cells for one `--list` row. When frame groups differ, the values of
 * every group are shown joined with `/` (e.g. layers `1/2`).
 * @param {ReturnType<typeof summarizeOutfit>} summary
 */
export function listCells(summary) {
  const distinct = (format) => [...new Set(summary.groups.map(format))].join('/');
  return {
    size: distinct(
      (group) =>
        `${group.width}x${group.height} (${group.width * TILE_SIZE}x${group.height * TILE_SIZE}px)`,
    ),
    exactSize: distinct((group) => String(group.exactSize)),
    layers: distinct((group) => String(group.layers)),
    patternX: distinct((group) => String(group.patternX)),
    patternY: distinct((group) => String(group.patternY)),
    patternZ: distinct((group) => String(group.patternZ)),
    phases: distinct((group) => String(group.phases)),
    frameGroups: summary.frameGroups.join('+'),
  };
}

/** Stable fingerprint of everything that determines an outfit's output. */
export function outputFingerprint(parts) {
  return sha256(JSON.stringify(parts));
}

/**
 * Applies slug=id entries to content/outfits.json, preserving indentation,
 * line endings, the trailing newline, addons and record order (new Pokémon
 * are appended with no addons). Records are never removed.
 * @param {string} text
 * @param {{ slug: string, id: number }[]} entries
 * @returns {{ text: string, mapping: Record<string, number>, changes: { slug: string, before: number | null, after: number }[] }}
 */
export function updateMappingText(text, entries) {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const indent = /\n([ \t]+)"/.exec(text)?.[1] ?? '  ';
  const trailingNewline = /\r?\n$/.test(text);
  const data = JSON.parse(text);
  const mapping = validateMapping(data);
  const changes = [];
  for (const { slug, id } of entries) {
    const before = Object.hasOwn(mapping, slug) ? mapping[slug] : null;
    if (before === id) continue;
    const record = data.outfits.find((outfit) => outfit.pokemon === slug);
    if (record) record.outfitId = id;
    else data.outfits.push({ pokemon: slug, outfitId: id, addons: [] });
    mapping[slug] = id;
    changes.push({ slug, before, after: id });
  }
  if (!changes.length) return { text, mapping, changes };
  const serialized = JSON.stringify(data, null, indent).replace(/\n/g, eol);
  return { text: serialized + (trailingNewline ? eol : ''), mapping, changes };
}

/** Unified-style lines describing mapping changes. */
export function formatMappingDiff(changes) {
  return changes.flatMap(({ slug, before, after }) => [
    ...(before === null ? [] : [`- "${slug}": ${before}`]),
    `+ "${slug}": ${after}`,
  ]);
}
