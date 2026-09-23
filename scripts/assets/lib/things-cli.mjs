// Shared command-line helpers for the things asset scripts: argv parsing,
// locating the owner-decrypted DAT/SPR/OTML/OTFI inputs and guarding output
// paths. User-facing messages are Spanish (owner tool); no side effects on import.

import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';

import { assertNotProtected } from './otclient-things.mjs';

/** Folder used when neither --things, --dat/--spr nor PKA_DECRYPTED_THINGS is given. */
export const DEFAULT_THINGS_DIR =
  'C:\\Users\\jalom\\AppData\\Local\\PokeAlliance Games\\PokeAlliance\\data\\things\\decrypted_objectbuilder';

/** Documented install root of the owner's client. */
export const CLIENT_INSTALL_DIR = 'C:\\Users\\jalom\\AppData\\Local\\PokeAlliance Games';

/** Folder names that belong to the installed client; outputs are never written inside them. */
const CLIENT_FOLDER_NAMES = ['pokealliance games'];

/** Error with a user-facing Spanish message; CLIs print it without a stack trace. */
export class CliError extends Error {
  /**
   * @param {string} message
   * @param {{ showHelp?: boolean }} [options]
   */
  constructor(message, { showHelp = false } = {}) {
    super(message);
    this.showHelp = showHelp;
  }
}

/**
 * @typedef {object} ArgvSpec
 * @property {string[]} [booleans]    Flags without value (`--force`).
 * @property {string[]} [values]      Options with a value (`--out dir` or `--out=dir`).
 * @property {string[]} [repeatable]  Value options that may appear several times.
 */

/**
 * Parses `--flag`, `--option value` and `--option=value`. A bare `--` (as
 * forwarded by some package managers) is ignored.
 * @param {string[]} argv
 * @param {ArgvSpec} spec
 * @returns {Record<string, boolean | string | string[]>}
 */
export function parseArgv(argv, { booleans = [], values = [], repeatable = [] }) {
  /** @type {Record<string, boolean | string | string[]>} */
  const options = {};
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (argument === '--') continue;
    if (!argument.startsWith('--')) {
      throw new CliError(`Argumento inesperado: "${argument}". Las opciones empiezan con --.`, {
        showHelp: true,
      });
    }
    const equals = argument.indexOf('=');
    const name = argument.slice(2, equals === -1 ? undefined : equals);
    if (booleans.includes(name)) {
      if (equals !== -1) throw new CliError(`La opción --${name} no lleva valor.`);
      options[name] = true;
      continue;
    }
    if (!values.includes(name) && !repeatable.includes(name))
      throw new CliError(`Opción desconocida: --${name}`, { showHelp: true });
    let value;
    if (equals !== -1) value = argument.slice(equals + 1);
    else {
      value = argv[index + 1];
      if (value === undefined || (value.startsWith('--') && value.length > 2))
        throw new CliError(`Falta el valor de --${name}.`);
      index++;
    }
    // An empty value (e.g. an unset PowerShell variable inside quotes) must not
    // silently fall back to a default folder.
    if (!value.replace(/["'\s]/g, ''))
      throw new CliError(`La opción --${name} tiene un valor vacío.`);
    if (repeatable.includes(name)) {
      const previous = options[name];
      options[name] = [...(Array.isArray(previous) ? previous : []), value];
    } else {
      if (options[name] !== undefined)
        throw new CliError(`La opción --${name} se indicó dos veces.`);
      options[name] = value;
    }
  }
  return options;
}

/**
 * Normalizes a user-supplied path: trims, drops wrapping quotes (and the stray
 * trailing quote Windows leaves after `"C:\dir\"`), accepts / or \ and resolves
 * it against `cwd`.
 * @param {string} value
 * @param {string} [cwd]
 */
export function normalizeUserPath(value, cwd = process.cwd()) {
  let cleaned = value.trim();
  if (/^(["']).*\1$/.test(cleaned)) cleaned = cleaned.slice(1, -1);
  cleaned = cleaned.replace(/["']+$/, '');
  if (!cleaned) throw new CliError('Se indicó una ruta vacía.');
  return path.resolve(cwd, cleaned);
}

/** Resolves symlinks/junctions of the longest existing prefix so containment checks are honest. */
export function canonicalPath(target) {
  const resolved = path.resolve(target);
  let existing = resolved;
  const rest = [];
  while (!existsSync(existing)) {
    const parent = path.dirname(existing);
    if (parent === existing) return resolved;
    rest.unshift(path.basename(existing));
    existing = parent;
  }
  try {
    return path.join(realpathSync.native(existing), ...rest);
  } catch {
    return resolved;
  }
}

/** True when `child` is `parent` or inside it (case-insensitive on Windows). */
export function isPathInside(child, parent) {
  const normalize = (value) => {
    const resolved = path.resolve(value);
    return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
  };
  const relative = path.relative(normalize(parent), normalize(child));
  // Only a leading `..` segment means "outside"; a folder named `..x` is inside.
  const outside =
    relative === '..' || relative.startsWith(`..${path.sep}`) || relative.startsWith('../');
  return !outside && !path.isAbsolute(relative);
}

/** Client install roots derived from the environment plus the documented default. */
export function clientInstallRoots(env = process.env) {
  const roots = [CLIENT_INSTALL_DIR];
  if (env.LOCALAPPDATA) roots.push(path.join(env.LOCALAPPDATA, 'PokeAlliance Games'));
  return [...new Set(roots)];
}

function listFiles(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name);
}

/**
 * Picks one input file inside a folder: preferred names first (case-insensitive),
 * then the single file with the extension. Several candidates abort, unless the
 * file is optional for this run (`ignoreAmbiguous`), in which case none is picked.
 * @param {string} directory
 * @param {{ kind: string, flag: string, preferred: string[], extension: string, required: boolean, ignoreAmbiguous?: boolean }} rule
 * @returns {string | null}
 */
export function pickThingsFile(
  directory,
  { kind, flag, preferred, extension, required, ignoreAmbiguous = false },
) {
  const files = listFiles(directory);
  for (const name of preferred) {
    const match = files.find((file) => file.toLowerCase() === name.toLowerCase());
    if (match) return path.join(directory, match);
  }
  const candidates = files.filter((file) => file.toLowerCase().endsWith(extension));
  if (candidates.length === 1) return path.join(directory, candidates[0]);
  if (candidates.length > 1 && ignoreAmbiguous) return null;
  if (candidates.length > 1) {
    throw new CliError(
      `Hay varios archivos ${extension} en ${directory}: ${candidates.join(', ')}.\n` +
        `Indica cuál usar con ${flag} "<archivo>" (por ejemplo --dat y --spr con las rutas exactas).`,
    );
  }
  if (!required) return null;
  const split = files.filter((file) => file.toLowerCase().includes(`${extension}.part`));
  const hint = split.length
    ? `\nSe encontraron partes (${split.join(', ')}): son los archivos protegidos del cliente. ` +
      'Esta herramienta solo lee el .spr ya descifrado y unido por el propietario.'
    : '';
  throw new CliError(
    `No se encontró ningún archivo ${kind} (${extension}) en ${directory}.${hint}\n` +
      `Indica la carpeta con --things "<carpeta>" o el archivo exacto con ${flag} "<archivo>".`,
  );
}

function assertDirectory(directory, origin) {
  if (!existsSync(directory)) {
    throw new CliError(
      `No existe la carpeta de things (${origin}): ${directory}\n` +
        'Indica la carpeta que contiene el .dat y el .spr descifrados con --things "<carpeta>", ' +
        'o los archivos exactos con --dat "<archivo.dat>" --spr "<archivo.spr>".',
    );
  }
  if (!statSync(directory).isDirectory())
    throw new CliError(`La ruta de things (${origin}) no es una carpeta: ${directory}`);
}

function assertFile(file, flag) {
  if (!existsSync(file)) throw new CliError(`No existe el archivo indicado con ${flag}: ${file}`);
  if (!statSync(file).isFile())
    throw new CliError(`La ruta indicada con ${flag} no es un archivo: ${file}`);
}

/**
 * @typedef {object} ThingsInputs
 * @property {string | null} folder        Folder used for auto-detection (null when not needed).
 * @property {string | null} folderOrigin  '--things', 'PKA_DECRYPTED_THINGS' or 'predeterminada'.
 * @property {string} datPath
 * @property {string | null} sprPath
 * @property {string | null} otmlPath
 * @property {string | null} otfiPath
 * @property {Record<string, string>} origins  How each path was chosen.
 */

/**
 * Resolves the input files. Precedence per file:
 * --dat/--spr/--otml/--otfi > --things > env PKA_DECRYPTED_THINGS > DEFAULT_THINGS_DIR.
 * Files not given exactly are auto-detected in --things; with --dat and no
 * --things they are looked up next to the DAT (the env/default folder is not
 * used then, so a DAT is never paired with another folder's SPR).
 * OTML/OTFI are optional. With `requireSpr: false` the SPR is optional too and
 * an ambiguous folder simply yields none.
 * Every resolved file is checked for existence and for the protected PKA1 signature.
 * @param {{ things?: string, dat?: string, spr?: string, otml?: string, otfi?: string }} options
 * @param {{ env?: Record<string, string | undefined>, cwd?: string, defaultDir?: string, requireSpr?: boolean }} [context]
 * @returns {ThingsInputs}
 */
export function resolveThingsInputs(options, context = {}) {
  const {
    env = process.env,
    cwd = process.cwd(),
    defaultDir = DEFAULT_THINGS_DIR,
    requireSpr = true,
  } = context;
  // `!= null` (not truthiness): an empty value reaches normalizeUserPath and is rejected.
  const exact = (value) => (value != null ? normalizeUserPath(value, cwd) : null);
  const explicit = {
    dat: exact(options.dat),
    spr: exact(options.spr),
    otml: exact(options.otml),
    otfi: exact(options.otfi),
  };
  const thingsGiven = options.things != null;
  /** @type {Record<string, string>} */
  const origins = {};
  let folder = null;
  let folderOrigin = null;
  if (thingsGiven || !explicit.dat) {
    if (thingsGiven) {
      folder = normalizeUserPath(/** @type {string} */ (options.things), cwd);
      folderOrigin = '--things';
    } else if (env.PKA_DECRYPTED_THINGS) {
      folder = normalizeUserPath(env.PKA_DECRYPTED_THINGS, cwd);
      folderOrigin = 'PKA_DECRYPTED_THINGS';
    } else {
      folder = path.resolve(defaultDir);
      folderOrigin = 'predeterminada';
    }
    assertDirectory(folder, folderOrigin);
  }

  let datPath;
  if (explicit.dat) {
    datPath = explicit.dat;
    origins.dat = '--dat';
  } else if (env.PKA_DAT_NAME && !thingsGiven) {
    // Legacy override from the first preview extractor; it only renamed the DAT
    // inside the env/default folder, so an explicit --things ignores it.
    datPath = path.join(/** @type {string} */ (folder), env.PKA_DAT_NAME);
    origins.dat = `carpeta ${folderOrigin} + PKA_DAT_NAME`;
  } else {
    datPath = /** @type {string} */ (
      pickThingsFile(/** @type {string} */ (folder), {
        kind: 'DAT',
        flag: '--dat',
        preferred: ['things_objectbuilder.dat', 'things.dat'],
        extension: '.dat',
        required: true,
      })
    );
    origins.dat = `carpeta ${folderOrigin}`;
  }
  // Checked first so an encrypted install folder is reported as such.
  assertFile(datPath, origins.dat);
  assertNotProtected(datPath, 'El DAT');

  // Files not given exactly come from --things/env/default, or from the DAT's
  // own folder when only --dat was given.
  const sideFolder = folder ?? path.dirname(datPath);
  const sideOrigin = folder ? `carpeta ${folderOrigin}` : 'junto al --dat';
  let sprPath = explicit.spr;
  if (sprPath) origins.spr = '--spr';
  else {
    sprPath = pickThingsFile(sideFolder, {
      kind: 'SPR',
      flag: '--spr',
      preferred: ['things.spr'],
      extension: '.spr',
      required: requireSpr,
      ignoreAmbiguous: !requireSpr,
    });
    if (sprPath) origins.spr = sideOrigin;
  }
  const pickSide = (kind, extension, flag, explicitPath) => {
    if (explicitPath) {
      origins[kind] = flag;
      return explicitPath;
    }
    if (!existsSync(sideFolder)) return null;
    const found = pickThingsFile(sideFolder, {
      kind: kind.toUpperCase(),
      flag,
      preferred: [`things${extension}`],
      extension,
      required: false,
    });
    if (found) origins[kind] = sideOrigin;
    return found;
  };
  const otmlPath = pickSide('otml', '.otml', '--otml', explicit.otml);
  const otfiPath = pickSide('otfi', '.otfi', '--otfi', explicit.otfi);

  if (sprPath) {
    assertFile(sprPath, origins.spr);
    assertNotProtected(sprPath, 'El SPR');
  }
  if (otmlPath) {
    assertFile(otmlPath, origins.otml);
    assertNotProtected(otmlPath, 'El OTML');
  }
  if (otfiPath) {
    assertFile(otfiPath, origins.otfi);
    assertNotProtected(otfiPath, 'El OTFI');
  }
  return { folder, folderOrigin, datPath, sprPath, otmlPath, otfiPath, origins };
}

/**
 * Refuses output folders inside the installed client, inside any input folder
 * and (unless allowed) inside the repository's public/ tree.
 * @param {string} outDir
 * @param {{ inputs: ThingsInputs, repoRoot: string, allowPublic?: boolean, env?: Record<string, string | undefined>, label?: string, hint?: string }} context
 *   `label`/`hint` adapt the message when the path is not an --out folder.
 */
export function assertSafeOutputDir(
  outDir,
  {
    inputs,
    repoRoot,
    allowPublic = false,
    env = process.env,
    label = 'Ruta de salida no permitida',
    hint = 'elige otra carpeta con --out.',
  },
) {
  const target = canonicalPath(outDir);
  const publicDir = path.join(repoRoot, 'public');
  const segments = target.split(/[\\/]+/).map((segment) => segment.toLowerCase());
  const forbidden = [
    ...clientInstallRoots(env).map((root) => ({
      root,
      reason: 'la carpeta de instalación del cliente',
    })),
    ...[inputs.folder, inputs.datPath, inputs.sprPath, inputs.otmlPath, inputs.otfiPath]
      .map((value, index) => (value && index > 0 ? path.dirname(value) : value))
      .filter((root) => typeof root === 'string')
      .map((root) => ({ root, reason: 'la carpeta de los archivos things de entrada' })),
  ];
  for (const { root, reason } of forbidden) {
    if (isPathInside(target, canonicalPath(root)) || isPathInside(outDir, root)) {
      throw new CliError(
        `${label}: ${outDir}\nEstá dentro de ${reason} (${root}). ` +
          `La herramienta nunca escribe junto a los archivos del cliente; ${hint}`,
      );
    }
  }
  if (segments.some((segment) => CLIENT_FOLDER_NAMES.includes(segment))) {
    throw new CliError(
      `${label}: ${outDir}\nParece estar dentro de la instalación del cliente de PokeAlliance.`,
    );
  }
  if (
    !allowPublic &&
    (isPathInside(target, canonicalPath(publicDir)) || isPathInside(outDir, publicDir))
  ) {
    throw new CliError(
      `${label}: ${outDir}\nEl volcado nunca se escribe en public/. ` +
        'Para publicar frames en el sitio usa --registrar.',
    );
  }
}

/**
 * Refuses to reuse a non-empty output folder that is not an earlier run of the
 * same tool, so somebody else's README.txt or manifest.json is never overwritten.
 * A folder counts as the tool's own when its README.txt starts with
 * `readmeFirstLine` or its manifest.json names `tool`.
 * @param {string} outDir
 * @param {{ readmeFirstLine: string, tool: string }} ownership
 */
export function assertReusableOutputDir(outDir, { readmeFirstLine, tool }) {
  if (!existsSync(outDir)) return;
  if (!statSync(outDir).isDirectory())
    throw new CliError(`La ruta de salida existe y no es una carpeta: ${outDir}`);
  if (!readdirSync(outDir).length) return;
  const readmePath = path.join(outDir, 'README.txt');
  const manifestPath = path.join(outDir, 'manifest.json');
  const readText = (file) => {
    try {
      return statSync(file).isFile() ? readFileSync(file, 'utf8').replace(/^\uFEFF/, '') : null;
    } catch {
      return null;
    }
  };
  const readme = existsSync(readmePath) ? (readText(readmePath) ?? '') : null;
  const manifest = existsSync(manifestPath) ? (readText(manifestPath) ?? '') : null;
  const ownReadme = readme !== null && readme.split(/\r?\n/, 1)[0] === readmeFirstLine;
  let ownManifest = false;
  if (manifest !== null) {
    try {
      ownManifest = JSON.parse(manifest)?.tool === tool;
    } catch {
      ownManifest = false;
    }
  }
  const foreign = [
    ...(readme !== null && !ownReadme ? ['README.txt'] : []),
    ...(manifest !== null && !ownManifest ? ['manifest.json'] : []),
  ];
  if (foreign.length) {
    throw new CliError(
      `La carpeta de salida ${outDir} ya contiene ${foreign.join(' y ')} de otro origen; ` +
        'no se sobrescriben. Elige con --out una carpeta vacía, nueva o de un volcado anterior.',
    );
  }
  if (!ownReadme && !ownManifest) {
    throw new CliError(
      `La carpeta de salida ${outDir} no está vacía y no parece un volcado anterior de esta ` +
        'herramienta (no tiene su README.txt ni su manifest.json). ' +
        'Elige con --out una carpeta vacía o nueva.',
    );
  }
}

/** Human-readable byte count. */
export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[unit]}`;
}
