#!/usr/bin/env node
// node scripts/test/serve-vercel-output.mjs — serves `.vercel/output` the way the
// deployment does, emulating the subset of the Build Output API v3 that
// `.vercel/output/config.json` uses (spec §14.3). It replaces `astro preview`,
// which `@astrojs/vercel` 11.0.10 cannot serve: the adapter has no
// `previewEntrypoint` and Astro rejects it (S22).
//
// It has no route table of its own: it walks the `routes` of the generated
// `config.json`, so the end-to-end tests check the configuration that ships
// (the redirects of `astro.config.mjs` included) and not a copy of it.
//
// What it emulates, in the order the spec fixes:
//   1. walks `routes` in order; a matching route contributes its `headers` and,
//      with `continue: true`, the walk goes on;
//   2. a route with a 3xx `status` and a `Location` header answers that redirect;
//   3. `{ "handle": "filesystem" }` serves the matching file of `static/`
//      (`x/` as `x/index.html`), and goes on with the next route when there is none;
//   4. a route whose `dest` names a function imports `functions/<dest>.func/`
//      through its `.vc-config.json` (`handler: "dist/server/entry.mjs"`) and
//      answers with `default.fetch(request)`, with the `status` of the route when
//      it carries one — that is how the on-demand 404 of §8.12 answers the page
//      of its language with status 404.
//
// Anything else fails at startup naming what it did not understand — an unknown
// route property (`has`, `missing`, `check`, `middlewarePath`…), an unknown
// `handle`, a `dest` that names nothing — so a change of the adapter cannot pass
// unnoticed and silently make the tests measure something the deployment does not do.
//
// Two notes on fidelity with the deployment:
//   - the walk is literal, so the `cache-control` route of `_astro` (which the
//     adapter writes AFTER `{ "handle": "filesystem" }`) only applies when no
//     static file matched, exactly as the generated `config.json` reads;
//   - responses are compressed (br, then gzip) when the client asks for it and
//     the type is compressible, because the budgets of §13.6 and the lab metrics
//     of `perf.spec.ts` are measured over compressed bytes, as on the CDN.
//
// Usage:
//   node scripts/test/serve-vercel-output.mjs [--port 4322] [--host 127.0.0.1]
//                                             [--dir .vercel/output] [--no-compress] [--verbose]

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import zlib from 'node:zlib';

// Web globals of Node 22. Reading them from `globalThis` keeps the file valid for
// a linter whose globals for `**/*.mjs` are listed by hand (eslint.config.js).
const { Headers, Request } = globalThis;

const brotliCompress = promisify(zlib.brotliCompress);
const gzipCompress = promisify(zlib.gzip);

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

const DEFAULT_PORT = 4322;
const DEFAULT_HOST = '127.0.0.1';

/** Paths inside the repository are printed relative to it; the rest, whole. */
function display(target) {
  const relative = path.relative(ROOT, target);
  return relative && !relative.startsWith('..') ? relative : target;
}

const USAGE =
  'Uso: node scripts/test/serve-vercel-output.mjs [--port 4322] [--host 127.0.0.1] ' +
  '[--dir .vercel/output] [--no-compress] [--verbose]';

// The route properties this emulator implements. Every other one stops the
// startup with its name: the spec requires it so a change of the adapter is seen.
const KNOWN_ROUTE_PROPERTIES = new Set(['src', 'dest', 'headers', 'continue', 'status', 'handle']);

// `filesystem` is the only phase the generated configuration uses. `rewrite`,
// `resource`, `miss`, `hit` and `error` would change which response wins.
const KNOWN_HANDLES = new Set(['filesystem']);

// Top-level keys of config.json. `images`, `framework` and `crons` do not change
// what is served locally, so they are read and ignored; `overrides` and
// `wildcard` would change it, so they stop the startup like an unknown key.
const KNOWN_CONFIG_PROPERTIES = new Set(['version', 'routes', 'images', 'framework', 'crons']);

const CONTENT_TYPES = new Map(
  Object.entries({
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
    '.webmanifest': 'application/manifest+json; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
    '.xml': 'application/xml; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.avif': 'image/avif',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.wasm': 'application/wasm',
    '.pdf': 'application/pdf',
  }),
);

const COMPRESSIBLE_TYPE =
  /^(?:text\/|image\/svg\+xml|application\/(?:json|javascript|xml|manifest\+json|xhtml\+xml|wasm))/;
const COMPRESSION_THRESHOLD = 1024;

// Headers that belong to one hop of the connection and must not travel into the
// Request the function receives, nor out of the Response it returns.
const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

// --------------------------------------------------------------------------- arguments

/** @param {string[]} argv */
function parseArguments(argv) {
  const options = {
    port: DEFAULT_PORT,
    host: DEFAULT_HOST,
    dir: null,
    compress: true,
    verbose: false,
    help: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--') continue;
    const equals = argument.indexOf('=');
    const name = equals === -1 ? argument : argument.slice(0, equals);
    const inlineValue = equals === -1 ? null : argument.slice(equals + 1);
    const readValue = () => {
      if (inlineValue !== null) return inlineValue;
      const next = argv[index + 1];
      if (next === undefined || next.startsWith('--')) {
        fail(`Falta el valor de «${name}».\n${USAGE}`);
      }
      index += 1;
      return next;
    };
    switch (name) {
      case '--help':
      case '-h':
        options.help = true;
        break;
      case '--port': {
        const value = Number(readValue());
        if (!Number.isInteger(value) || value < 0 || value > 65535) {
          fail(`Puerto no válido: «${argument}».\n${USAGE}`);
        }
        options.port = value;
        break;
      }
      case '--host':
        options.host = readValue();
        break;
      case '--dir':
      case '--output':
        options.dir = readValue();
        break;
      case '--no-compress':
        options.compress = false;
        break;
      case '--verbose':
        options.verbose = true;
        break;
      default:
        fail(`Opción desconocida: «${argument}».\n${USAGE}`);
    }
  }
  return options;
}

/** @param {string} message */
function fail(message) {
  console.error(message);
  process.exit(1);
}

// --------------------------------------------------------------------------- configuration

/**
 * Reads config.json and turns its routes into the form the walk uses. Collects
 * every problem instead of stopping at the first one, so one run names all of them.
 */
async function loadConfiguration(outputDir) {
  const configPath = path.join(outputDir, 'config.json');
  let raw;
  try {
    raw = await readFile(configPath, 'utf8');
  } catch {
    fail(
      `No se pudo leer ${display(configPath)}. ` +
        'Ejecuta «pnpm build» antes de servir la salida.',
    );
  }
  let config;
  try {
    config = JSON.parse(raw);
  } catch (error) {
    fail(`${configPath} no es JSON válido: ${error.message}`);
  }

  const problems = [];
  if (config === null || typeof config !== 'object' || Array.isArray(config)) {
    fail(`${configPath} no contiene un objeto de configuración.`);
  }
  if (config.version !== 3) {
    problems.push(
      `version ${JSON.stringify(config.version)}: el emulador solo implementa la versión 3 de la Build Output API.`,
    );
  }
  for (const property of Object.keys(config)) {
    if (!KNOWN_CONFIG_PROPERTIES.has(property)) {
      problems.push(
        `propiedad de configuración desconocida «${property}»: el emulador no la implementa ` +
          `(conocidas: ${[...KNOWN_CONFIG_PROPERTIES].join(', ')}).`,
      );
    }
  }
  if (!Array.isArray(config.routes)) {
    problems.push('routes: falta la lista de rutas o no es una lista.');
    report(problems, configPath);
  }

  const routes = [];
  for (const [index, route] of config.routes.entries()) {
    const label = `routes[${index}]`;
    if (route === null || typeof route !== 'object' || Array.isArray(route)) {
      problems.push(`${label}: no es un objeto de ruta.`);
      continue;
    }
    const where = route.src ? ` (src: ${route.src})` : '';
    for (const property of Object.keys(route)) {
      if (!KNOWN_ROUTE_PROPERTIES.has(property)) {
        problems.push(
          `${label}: propiedad de ruta desconocida «${property}»${where}. ` +
            'El emulador no la implementa; añádela a scripts/test/serve-vercel-output.mjs ' +
            'antes de seguir, o las pruebas medirán algo distinto del despliegue.',
        );
      }
    }

    const compiled = { index, label, src: route.src ?? null, regex: null };

    if (route.handle !== undefined) {
      if (!KNOWN_HANDLES.has(route.handle)) {
        problems.push(
          `${label}: fase «handle: ${route.handle}» desconocida ` +
            `(conocidas: ${[...KNOWN_HANDLES].join(', ')}).`,
        );
      }
      if (route.src !== undefined || route.dest !== undefined) {
        problems.push(`${label}: una ruta con «handle» no puede traer «src» ni «dest».`);
      }
      compiled.handle = route.handle;
      routes.push(compiled);
      continue;
    }

    if (typeof route.src !== 'string') {
      problems.push(`${label}: falta «src» o no es una cadena.`);
    } else {
      try {
        compiled.regex = new RegExp(route.src);
      } catch (error) {
        problems.push(`${label}: «src» no es una expresión regular válida: ${error.message}`);
      }
    }

    if (route.headers !== undefined) {
      if (
        route.headers === null ||
        typeof route.headers !== 'object' ||
        Array.isArray(route.headers)
      ) {
        problems.push(`${label}: «headers» no es un objeto${where}.`);
      } else {
        compiled.headers = Object.entries(route.headers);
      }
    }

    if (route.status !== undefined) {
      if (!Number.isInteger(route.status) || route.status < 100 || route.status > 599) {
        problems.push(`${label}: «status» no es un código HTTP${where}.`);
      } else {
        compiled.status = route.status;
      }
    }

    if (route.continue !== undefined) {
      if (typeof route.continue !== 'boolean') {
        problems.push(`${label}: «continue» no es booleano${where}.`);
      } else {
        compiled.continue = route.continue;
      }
    }

    if (route.dest !== undefined) {
      if (typeof route.dest !== 'string') {
        problems.push(`${label}: «dest» no es una cadena${where}.`);
      } else if (route.dest.includes('?')) {
        problems.push(
          `${label}: «dest» lleva consulta («${route.dest}»)${where}; el emulador no la reenvía.`,
        );
      } else {
        compiled.dest = route.dest;
      }
    }

    const headerLocation = compiled.headers?.find(([name]) => name.toLowerCase() === 'location');
    const isRedirect =
      compiled.status !== undefined && compiled.status >= 300 && compiled.status < 400;
    if (isRedirect) {
      if (!headerLocation) {
        problems.push(`${label}: «status ${compiled.status}» sin cabecera «Location»${where}.`);
      }
      compiled.redirect = true;
    } else if (route.dest === undefined && compiled.continue !== true) {
      // Neither a destination, nor a redirect, nor an order to go on: the walk
      // would not know what to answer, and Vercel would not either.
      problems.push(
        `${label}: la ruta no trae «dest», ni una redirección, ni «continue»${where}; ` +
          'el emulador no sabe qué responder.',
      );
    }
    if (compiled.dest !== undefined && compiled.continue === true) {
      problems.push(
        `${label}: «dest» con «continue» (reescritura encadenada) no está implementado${where}.`,
      );
    }

    routes.push(compiled);
  }

  return { routes, problems, configPath };
}

/** Prints the problems found at startup and stops with code 1. */
function report(problems, configPath) {
  fail(
    `El emulador de la salida de Vercel no entiende ${display(configPath)}:\n` +
      problems.map((problem) => `- ${problem}`).join('\n'),
  );
}

/**
 * Checks every `dest` at startup: it has to name a function of `functions/` with
 * a `.vc-config.json` the emulator can run, or a file of `static/`.
 */
async function resolveDestinations(routes, outputDir, problems) {
  const functionsDir = path.join(outputDir, 'functions');
  const staticDir = path.join(outputDir, 'static');
  /** @type {Map<string, { name: string, handler: string }>} */
  const functions = new Map();

  for (const route of routes) {
    if (route.dest === undefined) continue;
    const name = route.dest.replace(/^\/+/, '');
    if (route.dest.includes('$')) continue; // Resolved per request with the captures.

    const functionDir = path.join(functionsDir, `${name}.func`);
    const vcConfigPath = path.join(functionDir, '.vc-config.json');
    const vcConfigRaw = await readFile(vcConfigPath, 'utf8').catch(() => null);

    if (vcConfigRaw !== null) {
      let vcConfig;
      try {
        vcConfig = JSON.parse(vcConfigRaw);
      } catch (error) {
        problems.push(`${route.label}: ${vcConfigPath} no es JSON válido: ${error.message}`);
        continue;
      }
      if (vcConfig.launcherType !== undefined && vcConfig.launcherType !== 'Nodejs') {
        problems.push(
          `${route.label}: «launcherType: ${vcConfig.launcherType}» en ${name}.func; ` +
            'el emulador solo ejecuta funciones de Node.',
        );
      }
      if (typeof vcConfig.runtime === 'string' && !vcConfig.runtime.startsWith('nodejs')) {
        problems.push(
          `${route.label}: «runtime: ${vcConfig.runtime}» en ${name}.func; ` +
            'el emulador solo ejecuta funciones de Node.',
        );
      }
      if (typeof vcConfig.handler !== 'string') {
        problems.push(`${route.label}: ${vcConfigPath} no declara «handler».`);
        continue;
      }
      const handler = path.join(functionDir, vcConfig.handler);
      const handlerInfo = await stat(handler).catch(() => null);
      if (!handlerInfo?.isFile()) {
        problems.push(
          `${route.label}: no existe el «handler» ${vcConfig.handler} de ${name}.func.`,
        );
        continue;
      }
      functions.set(name, { name, handler });
      route.function = name;
      continue;
    }

    // Not a function: it has to be a file of static/ (the prerendered 404, for example).
    const file = path.resolve(staticDir, name);
    const info = await stat(file).catch(() => null);
    if (!info?.isFile()) {
      problems.push(
        `${route.label}: «dest: ${route.dest}» no nombra ninguna función de functions/ ` +
          'ni ningún archivo de static/.',
      );
    }
  }

  return functions;
}

// --------------------------------------------------------------------------- serving

const options = parseArguments(process.argv.slice(2));
if (options.help) {
  console.log(USAGE);
  process.exit(0);
}

const outputDir = options.dir ? path.resolve(options.dir) : path.join(ROOT, '.vercel', 'output');
const staticDir = path.join(outputDir, 'static');

const { routes, problems, configPath } = await loadConfiguration(outputDir);
const functions = await resolveDestinations(routes, outputDir, problems);
if (problems.length > 0) report(problems, configPath);

/** Modules of `functions/<name>.func/`, imported once and kept. */
const loadedFunctions = new Map();
/** Size and mtime of each handler when it was imported, to notice a rebuild. */
const loadedStamps = new Map();

const stampOf = (stats) => `${stats.size}:${stats.mtimeMs}`;

function loadFunction(name) {
  let loading = loadedFunctions.get(name);
  if (!loading) {
    const entry = functions.get(name);
    loading = import(pathToFileURL(entry.handler).href);
    loadedFunctions.set(name, loading);
  }
  return loading;
}

/** The stamp of `config.json`, under a key no function name can take. */
const CONFIG_KEY = ':config';

/**
 * A static file is read again on every request, but the rest of the build is not: the
 * route table is parsed once at startup, and the entry of `functions/<name>.func/`
 * pulls in the whole bundled graph, which ES modules cache by URL, so a rebuilt
 * function keeps answering with the code of the previous build. Either one silently
 * turns the `prod` project into a measurement of something that is no longer in
 * `.vercel/output` — the parity build of `VISUAL=1` against the production output, for
 * instance. Playwright starts its own server in CI, but `reuseExistingServer` hands a
 * run the server a person left open across a build, so the emulator names the problem
 * instead of serving the stale answer.
 */
async function assertFresh(key) {
  const file = key === CONFIG_KEY ? configPath : functions.get(key).handler;
  const stamp = stampOf(await stat(file));
  const loaded = loadedStamps.get(key);
  if (loaded === undefined) {
    loadedStamps.set(key, stamp);
    return;
  }
  if (loaded !== stamp) {
    const what = key === CONFIG_KEY ? 'config.json' : `functions/${key}.func`;
    throw new Error(
      `${what} cambió desde que el emulador leyó el build: las respuestas serían las ` +
        'del build anterior. Reinicia el emulador (`pnpm preview`) después de cada ' +
        '`pnpm build`.',
    );
  }
}

/**
 * Checked on every request, not only on the ones a function answers: Playwright's
 * `webServer` waits on a static page, and `isURLAvailable` takes any status under 404
 * as ready (`playwright-core/lib/coreBundle.js`). A stale server that still served
 * `/es/` would pass that check and `reuseExistingServer` would hand it a whole run.
 * Answering 500 everywhere is what keeps a build the emulator no longer holds from
 * being measured as if it were the one on disk.
 */
async function assertBuildFresh() {
  await assertFresh(CONFIG_KEY);
  for (const name of functions.keys()) await assertFresh(name);
}

// Bodies read from static/ and their compressed forms, keyed by path, size and
// mtime, so a file that the build rewrites is read again. The budget keeps a run
// of the suite from holding the whole output in memory; the oldest entries go first.
const bodyCache = new Map();
const BODY_CACHE_BYTES = 96 * 1024 * 1024;
const BODY_CACHE_MAX_ENTRY = 8 * 1024 * 1024;
let bodyCacheBytes = 0;

function cacheBody(key, value) {
  if (value.length > BODY_CACHE_MAX_ENTRY) return value;
  for (const [oldest, body] of bodyCache) {
    if (bodyCacheBytes + value.length <= BODY_CACHE_BYTES) break;
    bodyCache.delete(oldest);
    bodyCacheBytes -= body.length;
  }
  bodyCache.set(key, value);
  bodyCacheBytes += value.length;
  return value;
}

/** Replaces the `$1`, `$name` captures of a route in a `dest` or a header value. */
function substitute(value, match) {
  if (!value.includes('$')) return value;
  return value.replace(
    /\$(\d{1,2}|\{[A-Za-z_][A-Za-z0-9_]*\}|[A-Za-z_][A-Za-z0-9_]*)/g,
    (whole, token) => {
      if (/^\d+$/.test(token)) {
        const captured = match[Number(token)];
        return captured === undefined ? whole : captured;
      }
      const name = token.startsWith('{') ? token.slice(1, -1) : token;
      const captured = match.groups?.[name];
      return captured === undefined ? whole : captured;
    },
  );
}

/**
 * The file of static/ that answers a path: the file itself, the same path with
 * `.html`, or its `index.html` (`x/` as `x/index.html`).
 */
async function findStaticFile(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes('\0')) return null;
  const normalized = path.posix.normalize(decoded.replace(/\\/g, '/'));
  if (normalized === '..' || normalized.startsWith('../')) return null;
  const relative = normalized.replace(/^\/+/, '');

  const candidates =
    relative === '' || normalized.endsWith('/')
      ? [path.posix.join(relative, 'index.html')]
      : [relative, `${relative}.html`, path.posix.join(relative, 'index.html')];

  for (const candidate of candidates) {
    const absolute = path.resolve(staticDir, candidate);
    if (absolute !== staticDir && !absolute.startsWith(staticDir + path.sep)) continue;
    const info = await stat(absolute).catch(() => null);
    if (info?.isFile()) {
      return { absolute, size: info.size, mtimeMs: info.mtimeMs };
    }
  }
  return null;
}

function contentTypeOf(file) {
  return CONTENT_TYPES.get(path.extname(file).toLowerCase()) ?? 'application/octet-stream';
}

/** Compresses like the CDN does: brotli when the client takes it, gzip otherwise. */
function negotiateEncoding(acceptEncoding, contentType, length) {
  if (!options.compress) return null;
  if (length < COMPRESSION_THRESHOLD) return null;
  if (!COMPRESSIBLE_TYPE.test(contentType)) return null;
  const accepted = String(acceptEncoding ?? '').toLowerCase();
  if (/(^|,\s*)br\b/.test(accepted)) return 'br';
  if (/(^|,\s*)gzip\b/.test(accepted)) return 'gzip';
  return null;
}

async function compress(body, encoding) {
  if (encoding === 'br') {
    return brotliCompress(body, {
      params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]: 5,
        [zlib.constants.BROTLI_PARAM_SIZE_HINT]: body.length,
      },
    });
  }
  return gzipCompress(body, { level: 6 });
}

/** Writes the response, leaving out the body for HEAD. */
function send(req, res, status, headers, body) {
  const outgoing = {};
  for (const [name, value] of headers) outgoing[name] = value;
  if (headers.has('set-cookie')) outgoing['set-cookie'] = headers.getSetCookie();
  outgoing['content-length'] = String(body.length);
  res.writeHead(status, outgoing);
  if (req.method === 'HEAD') res.end();
  else res.end(body);
}

function sendPlain(req, res, status, text) {
  const headers = new Headers({ 'content-type': 'text/plain; charset=utf-8' });
  send(req, res, status, headers, Buffer.from(text, 'utf8'));
}

/** Merges the headers a route collected on top of the ones the response carries. */
function applyCollected(headers, collected) {
  for (const [name, value] of collected) {
    if (name.toLowerCase() === 'set-cookie') headers.append(name, value);
    else headers.set(name, value);
  }
  return headers;
}

async function sendStatic(req, res, file, collected, status) {
  const contentType = contentTypeOf(file.absolute);
  const key = `${file.absolute}|${file.size}|${file.mtimeMs}`;
  let body = bodyCache.get(key);
  if (!body) body = cacheBody(key, await readFile(file.absolute));

  const headers = new Headers({
    'content-type': contentType,
    'last-modified': new Date(file.mtimeMs).toUTCString(),
  });

  const encoding = negotiateEncoding(req.headers['accept-encoding'], contentType, body.length);
  if (COMPRESSIBLE_TYPE.test(contentType) && options.compress)
    headers.set('vary', 'accept-encoding');
  if (encoding) {
    const encodedKey = `${key}|${encoding}`;
    let encoded = bodyCache.get(encodedKey);
    if (!encoded) encoded = cacheBody(encodedKey, await compress(body, encoding));
    headers.set('content-encoding', encoding);
    body = encoded;
  }

  applyCollected(headers, collected);
  send(req, res, status ?? 200, headers, body);
}

/** Builds the `Request` the function receives, as the launcher of Vercel does. */
async function buildRequest(req) {
  const host = req.headers.host ?? `${options.host}:${options.port}`;
  const url = new URL(req.url ?? '/', `http://${host}`);
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (HOP_BY_HOP.has(name.toLowerCase()) || value === undefined) continue;
    if (Array.isArray(value)) for (const item of value) headers.append(name, item);
    else headers.set(name, value);
  }
  if (!headers.has('x-forwarded-for')) {
    headers.set('x-forwarded-for', req.socket.remoteAddress ?? '127.0.0.1');
  }

  const method = req.method ?? 'GET';
  let body;
  if (method !== 'GET' && method !== 'HEAD') {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    body = Buffer.concat(chunks);
  }
  return new Request(url, { method, headers, body, duplex: body ? 'half' : undefined });
}

async function sendFunction(req, res, name, collected, status) {
  // Freshness is checked once per request, in `handleRequest`.
  const module = await loadFunction(name);
  const handler = module?.default?.fetch;
  if (typeof handler !== 'function') {
    throw new Error(`functions/${name}.func no exporta «default.fetch(request)».`);
  }
  const response = await module.default.fetch(await buildRequest(req));
  const body = Buffer.from(await response.arrayBuffer());

  const headers = new Headers();
  for (const [headerName, value] of response.headers) {
    const lower = headerName.toLowerCase();
    if (HOP_BY_HOP.has(lower) || lower === 'content-length' || lower === 'set-cookie') continue;
    headers.set(headerName, value);
  }
  for (const cookie of response.headers.getSetCookie()) headers.append('set-cookie', cookie);
  applyCollected(headers, collected);

  let payload = body;
  const contentType = headers.get('content-type') ?? '';
  const encoding = headers.has('content-encoding')
    ? null
    : negotiateEncoding(req.headers['accept-encoding'], contentType, body.length);
  if (COMPRESSIBLE_TYPE.test(contentType) && options.compress)
    headers.set('vary', 'accept-encoding');
  if (encoding) {
    payload = await compress(body, encoding);
    headers.set('content-encoding', encoding);
  }

  send(req, res, status ?? response.status, headers, payload);
}

/** The walk of `routes` the spec fixes, route by route and in order. */
async function handleRequest(req, res) {
  await assertBuildFresh();
  const target = req.url ?? '/';
  const queryIndex = target.indexOf('?');
  const pathname = queryIndex === -1 ? target : target.slice(0, queryIndex);
  const collected = new Headers();

  for (const route of routes) {
    if (route.handle === 'filesystem') {
      const file = await findStaticFile(pathname);
      if (!file) continue;
      await sendStatic(req, res, file, collected, undefined);
      return;
    }

    const match = route.regex?.exec(pathname);
    if (!match) continue;

    if (route.headers) {
      for (const [name, value] of route.headers) {
        collected.set(name, substitute(String(value), match));
      }
    }

    if (route.redirect) {
      send(req, res, route.status, collected, Buffer.alloc(0));
      return;
    }

    if (route.dest !== undefined) {
      const dest = substitute(route.dest, match);
      const name = dest.replace(/^\/+/, '');
      if (functions.has(name)) {
        await sendFunction(req, res, name, collected, route.status);
        return;
      }
      const file = await findStaticFile(`/${name}`);
      if (file) {
        await sendStatic(req, res, file, collected, route.status);
        return;
      }
      throw new Error(
        `${route.label}: «dest: ${dest}» no nombra ninguna función ni ningún archivo de static/.`,
      );
    }

    if (route.continue) continue;
  }

  sendPlain(req, res, 404, 'Ninguna ruta de config.json responde a esta petición.');
}

const server = createServer((req, res) => {
  const started = Date.now();
  handleRequest(req, res)
    .then(() => {
      if (options.verbose) {
        console.log(`${req.method} ${req.url} → ${res.statusCode} (${Date.now() - started} ms)`);
      }
    })
    .catch((error) => {
      console.error(`${req.method} ${req.url} → 500: ${error?.stack ?? error}`);
      if (!res.headersSent) {
        sendPlain(req, res, 500, `Error del emulador: ${error?.message ?? error}`);
      } else {
        res.end();
      }
    });
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    fail(`El puerto ${options.port} ya está ocupado; usa «--port <otro>».`);
  }
  fail(`No se pudo arrancar el servidor: ${error.message}`);
});

server.listen(options.port, options.host, () => {
  const names = [...functions.keys()];
  console.log(
    `Sirviendo ${display(outputDir)} en http://${options.host}:${options.port}/ ` +
      `(${routes.length} rutas, ${names.length ? `funciones: ${names.join(', ')}` : 'sin funciones'}` +
      `${options.compress ? '' : ', sin compresión'}).`,
  );
  // Warms the function up so the first request does not pay for its import. The stamps
  // are taken here, with the module and the parsed route table, so a build between this
  // line and the first request is the rebuild `assertFresh` reports rather than the
  // state it takes for granted.
  assertFresh(CONFIG_KEY).catch(() => {});
  for (const name of names) {
    assertFresh(name).catch(() => {});
    loadFunction(name).catch((error) => {
      console.error(`No se pudo importar functions/${name}.func: ${error?.stack ?? error}`);
    });
  }
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
