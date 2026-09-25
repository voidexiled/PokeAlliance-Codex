#!/usr/bin/env node
// node scripts/test/build-comercio-fases.mjs — CA-9.1 and CA-9.18 (spec 9.14; plan M12): builds
// each phase of Comercio and checks what `.vercel/output` holds after it.
//
// The sample listings and sellers of tests/fixtures/comercio/ exist to try every branch of the pages and
// are never offers (9.2, D-007, R12): src/lib/trade/registry.ts reads them only with COMERCIO_DEMO,
// and src/integrations/comercio-fases.ts decides the render mode of each Comercio route by
// COMERCIO_PUBLICO (9.3). This script is the third net of the plan against the one failure with
// reputational consequences, demo data in a production build: it builds, in this order,
//
//   1. a Comercio page that exports `prerender` (a copy of the pages folder with that one page,
//      through `srcDir`, so no file of the repository changes): the build has to fail, naming the
//      page (CA-9.18, second sentence). It fails while Astro lists the routes, before anything
//      reaches `.vercel/output`;
//   2. phase A with the sample registry (COMERCIO_DEMO=1): the list, one detail per listing that is
//      not `retirado`, one profile per seller and `/{l}/comercio/datos.json` are files of `static/`,
//      and `config.json` sends none of them to the server function (CA-9.18);
//   3. phase B with the sample registry (COMERCIO_DEMO=1, COMERCIO_PUBLICO=1): none of those files
//      exists and `config.json` sends the list, the detail and the profile to the function
//      (CA-9.18); `moderacion` goes there too, once the milestone that builds it (M14) adds its
//      page to src/routes/comercio/. «Mis operaciones» is a page of the account,
//      `/{l}/cuenta/operaciones/`: a file of phase B when the build has the public Supabase
//      settings, and `/{l}/comercio/operaciones/` a 302 towards it in every build (9.16.3);
//   4. production with OCULTAR_BORRADORES=1 and 5. production without it (CA-9.1: «con o sin
//      OCULTAR_BORRADORES»): `/es/comercio/` and `/en/comercio/` are the empty state of 9.5.10
//      alone, «Aún no hay anuncios.» / «No listings yet.» with the link «Crear anuncio» /
//      «Create listing» to the publish page, with no card, slot, row, search, tab, filter, banner
//      or results bar; there is no detail, profile or `datos.json` route; and no file of
//      `.vercel/output`, the server function included, carries the id of a listing of
//      tests/fixtures/comercio/anuncios.json or the handle or the name of a seller of vendedores.json.
//
// The production build goes last, so the tree is left with the output `pnpm seo:check` and the
// `prod` project of Playwright read. The two switches and OCULTAR_BORRADORES are passed to every
// build, empty when off: the process environment wins over the `.env` files, both for the pages
// (`import.meta.env`) and for the integration, so a switch left on in a local `.env` cannot turn a
// build of this script into another phase.
//
// Where a build writes a route and how `config.json` answers a path is read the way the deployment
// reads it, and the way scripts/test/serve-vercel-output.mjs emulates it: the `routes` in order,
// `{ "handle": "filesystem" }` answering with the file of `static/` when there is one (`x/` as
// `x/index.html`), then the first route whose `src` matches, a redirection or the function its
// `dest` names, with the `status` of the route when it has one.
//
// Usage:
//   node scripts/test/build-comercio-fases.mjs
//
// Four builds of about half a minute and the failing one, plus a read of every file of the output
// after three of them: five minutes on Windows, where a file just written is scanned before it can
// be read. It overwrites `.vercel/output` and `dist/` like `pnpm build`.

import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const OUTPUT = path.join(ROOT, '.vercel', 'output');
const STATIC = path.join(OUTPUT, 'static');
const ASTRO_CLI = path.join(ROOT, 'node_modules', 'astro', 'bin', 'astro.mjs');

/** The locales of the site (src/i18n/config.ts, spec 13.1). */
const LOCALES = ['es', 'en'];

/**
 * CA-9.1 quotes the two texts of the empty list, and 9.5.10 and 9.7.1 name them: `trade.list.empty`
 * and `trade.create` of src/i18n/messages/{es,en}.ts. A script cannot import those TypeScript
 * files, so the spec's literals are written here.
 */
const EMPTY_LIST = {
  es: { line: 'Aún no hay anuncios.', action: 'Crear anuncio' },
  en: { line: 'No listings yet.', action: 'Create listing' },
};

/**
 * What the empty list of CA-9.1 never carries inside `<main>`: the list island, cards, slots, rows,
 * the search field, the type tabs, the filters, the banner, the results bar (count, order and
 * view) and the pagination (9.5.1, 9.5.10, S11), by the classes and attributes of their components.
 */
const FORBIDDEN_IN_EMPTY_LIST = [
  ['<astro-island', 'una isla'],
  ['data-ac-list=', 'una lista'],
  ['ac-entity-list', 'una lista'],
  ['ac-listing-card', 'una ListingCard'],
  ['ac-entity-slot', 'un EntitySlot'],
  ['ac-list-row', 'una fila de anuncio'],
  ['ac-card-grid', 'una rejilla de tarjetas'],
  ['type="search"', 'la búsqueda'],
  ['role="search"', 'la búsqueda'],
  ['ac-toggle-group', 'las pestañas'],
  ['ac-filter-bar', 'los filtros'],
  ['ac-info-banner', 'el InfoBanner'],
  ['ac-count', 'el conteo'],
  ['ac-sort-select', 'el orden'],
  ['ac-view-toggle', 'el conmutador de vista'],
  ['ac-pagination', 'la paginación'],
];

/** The routes of phase B under /{l}/comercio/ (9.11) and the pages that build them. */
const PHASE_B_PAGES = {
  moderacion: path.join(ROOT, 'src', 'routes', 'comercio', 'moderacion.astro'),
};

/**
 * The old route of «Mis operaciones» (9.10), a 302 of astro.config.mjs towards the page of the
 * account in every build (9.16.3).
 */
const OLD_OPERACIONES = 'comercio/operaciones/';

/** The shortest id or name the leak scan accepts: a shorter one would match unrelated text. */
const MIN_NEEDLE = 6;

const problems = [];
const notes = [];

function problem(text) {
  problems.push(text);
  process.stdout.write(`  ✗ ${text}\n`);
}

function ok(text) {
  process.stdout.write(`  ✓ ${text}\n`);
}

/** A path inside the repository as the gates print it: relative and with `/`. */
function shown(file) {
  return path.relative(ROOT, file).split(path.sep).join('/');
}

function readJson(file) {
  const text = readFileSync(file, 'utf8');
  return JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
}

// ---------------------------------------------------------------------- the sample registry

const anuncios = readJson(
  path.join(ROOT, 'tests', 'fixtures', 'comercio', 'anuncios.json'),
).anuncios;
const vendedores = readJson(
  path.join(ROOT, 'tests', 'fixtures', 'comercio', 'vendedores.json'),
).vendedores;

/** 9.4: every state but `retirado` has a public detail. */
const withDetail = anuncios.filter((anuncio) => anuncio.estado !== 'retirado');
const withdrawn = anuncios.filter((anuncio) => anuncio.estado === 'retirado');

/**
 * What CA-9.1 looks for in the production output: the id of every listing and the name of every
 * seller, and the handle of every seller, which is the route of its profile. A name is also looked
 * for as the HTML and the JSON of a page would escape it.
 */
function leakNeedles() {
  const needles = [];
  const add = (value, what) => {
    if (typeof value !== 'string' || value.length === 0) return;
    for (const form of new Set([
      value,
      value.replaceAll('&', '&amp;').replaceAll("'", '&#39;').replaceAll('"', '&quot;'),
      JSON.stringify(value).slice(1, -1),
    ])) {
      needles.push({ text: form, bytes: Buffer.from(form, 'utf8'), what });
    }
  };
  for (const anuncio of anuncios) add(anuncio.id, `el id del anuncio «${anuncio.id}»`);
  for (const vendedor of vendedores) {
    add(vendedor.id, `el handle del vendedor «${vendedor.id}»`);
    add(vendedor.nombre, `el nombre del vendedor «${vendedor.nombre}»`);
  }
  return needles;
}

// --------------------------------------------------------------------------------- builds

/**
 * The environment of a build: this process's, without VISUAL and COMERCIO_FIXTURE (the visual
 * build of 14.5, which turns the demo switch on by itself), and with the three switches set,
 * empty when off.
 */
function buildEnv({ demo = false, publico = false, ocultar = false } = {}) {
  const env = { ...process.env };
  delete env.VISUAL;
  delete env.COMERCIO_FIXTURE;
  env.COMERCIO_DEMO = demo ? '1' : '';
  env.COMERCIO_PUBLICO = publico ? '1' : '';
  env.OCULTAR_BORRADORES = ocultar ? '1' : '';
  return env;
}

/** The last lines of a build log, for a failure. */
function tail(text, lines = 30) {
  return text.split(/\r?\n/).filter(Boolean).slice(-lines).join('\n');
}

/** Runs `astro build`; true when it built. */
function build(label, switches) {
  process.stdout.write(`\n· ${label}\n`);
  const started = Date.now();
  const result = spawnSync(process.execPath, [ASTRO_CLI, 'build'], {
    cwd: ROOT,
    env: buildEnv(switches),
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });
  const seconds = ((Date.now() - started) / 1000).toFixed(0);
  if (result.status !== 0) {
    problem(`${label}: el build falló (código ${result.status ?? result.signal})`);
    process.stdout.write(`${tail(`${result.stdout ?? ''}\n${result.stderr ?? ''}`)}\n`);
    return false;
  }
  ok(`build terminado en ${seconds} s`);
  return true;
}

// ------------------------------------------------------------------ the output, as deployed

function isFile(file) {
  try {
    return statSync(file).isFile();
  } catch {
    return false;
  }
}

/** The file of `static/` that answers a path, as the deployment finds it; null when none does. */
function staticFile(pathname) {
  const relative = path.posix.normalize(decodeURIComponent(pathname)).replace(/^\/+/, '');
  const candidates = pathname.endsWith('/')
    ? [path.posix.join(relative, 'index.html')]
    : [relative, `${relative}.html`, path.posix.join(relative, 'index.html')];
  for (const candidate of candidates) {
    const file = path.join(STATIC, ...candidate.split('/'));
    if (isFile(file)) return file;
  }
  return null;
}

function readRoutes() {
  const file = path.join(OUTPUT, 'config.json');
  if (!isFile(file)) throw new Error('.vercel/output/config.json no existe');
  const config = readJson(file);
  if (!Array.isArray(config.routes))
    throw new Error('.vercel/output/config.json no tiene «routes»');
  return config.routes;
}

/**
 * What `config.json` answers a path with: the file of `static/`, a redirection, the function a
 * `dest` names (with the `status` of its route) or nothing.
 */
function answer(routes, pathname) {
  for (const route of routes) {
    if (route?.handle !== undefined) {
      if (route.handle !== 'filesystem') {
        throw new Error(`config.json tiene la fase «handle: ${route.handle}», que no se emula`);
      }
      const file = staticFile(pathname);
      if (file !== null) return { kind: 'file', file };
      continue;
    }
    if (typeof route?.src !== 'string' || !new RegExp(route.src).test(pathname)) continue;
    if (Number.isInteger(route.status) && route.status >= 300 && route.status < 400) {
      return { kind: 'redirect', status: route.status };
    }
    if (typeof route.dest === 'string') {
      return { kind: 'function', name: route.dest.replace(/^\/+/, ''), status: route.status };
    }
  }
  return { kind: 'none' };
}

function describe(result) {
  if (result.kind === 'file') return `el archivo ${shown(result.file)}`;
  if (result.kind === 'redirect') return `una redirección ${result.status}`;
  if (result.kind === 'function') {
    return `la función ${result.name}${result.status === undefined ? '' : ` con ${result.status}`}`;
  }
  return 'ninguna ruta';
}

/** A page of the list, the detail or the profile rendered on demand: the function, no 404. */
function expectFunction(routes, pathname) {
  const result = answer(routes, pathname);
  if (result.kind === 'function' && result.name === '_render' && result.status === undefined) {
    return true;
  }
  problem(`${pathname}: config.json responde con ${describe(result)}, no con la función _render`);
  return false;
}

/** A prerendered page: the file of `static/` answers it before any route of the function. */
function expectFile(routes, pathname) {
  const result = answer(routes, pathname);
  if (result.kind === 'file') return true;
  problem(
    `${pathname}: config.json responde con ${describe(result)}, no con su archivo de static/`,
  );
  return false;
}

/** A retired route: a redirection of `config.json`, never a file or a page. */
function expectRedirect(routes, pathname) {
  const result = answer(routes, pathname);
  if (result.kind === 'redirect' && result.status === 302) return true;
  problem(`${pathname}: config.json responde con ${describe(result)}, no con una redirección 302`);
  return false;
}

/** A path with no page: no file and the 404 of the function (8.12). */
function expectNotFound(routes, pathname) {
  const result = answer(routes, pathname);
  if (result.kind === 'function' && result.status === 404) return true;
  problem(
    `${pathname}: config.json responde con ${describe(result)}; esa ruta no existe en esta fase`,
  );
  return false;
}

/**
 * CA-9.18: `config.json` sends none of these paths to `_render` as a page. The last route of the
 * adapter sends every path to the 404 of the function, which a file of `static/` answers first.
 */
function expectNotRendered(routes, pathnames) {
  for (const pathname of pathnames) {
    const route = routes.find(
      (entry) =>
        typeof entry?.src === 'string' &&
        typeof entry.dest === 'string' &&
        entry.status !== 404 &&
        new RegExp(entry.src).test(pathname),
    );
    if (route) problem(`${pathname}: config.json lo envía a ${route.dest} («${route.src}»)`);
  }
}

function isInside(file, directory) {
  const relative = path.relative(directory, file);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

/**
 * Every file under `directory`. The server function carries the links of pnpm between its packages:
 * a link whose target is inside `.vercel/output` is walked where the target lives, and one that
 * leaves it is followed, because the deployment uploads what it points at.
 */
function walk(directory, out = []) {
  if (!existsSync(directory)) return out;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile()) out.push(full);
    else if (entry.isSymbolicLink()) {
      let target;
      try {
        target = realpathSync(full);
      } catch {
        continue; // a broken link uploads nothing
      }
      if (isInside(target, realpathSync(OUTPUT))) continue;
      if (statSync(target).isDirectory()) walk(target, out);
      else out.push(target);
    }
  }
  return out;
}

/** A text as a regular expression that matches it literally. */
function literal(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Every file of `.vercel/output` that carries one of the needles, with the needle it carries.
 * Each file is read once as bytes (`latin1` maps one byte to one character), so a binary never
 * throws and the UTF-8 of a needle is found in any file, whatever its type.
 */
function scanLeaks(needles) {
  const byBytes = new Map(needles.map((needle) => [needle.bytes.toString('latin1'), needle]));
  const pattern = new RegExp(
    [...byBytes.keys()]
      .sort((a, b) => b.length - a.length)
      .map(literal)
      .join('|'),
  );
  const found = [];
  for (const file of walk(OUTPUT)) {
    const match = pattern.exec(readFileSync(file).toString('latin1'));
    if (match) found.push({ file, needle: byBytes.get(match[0]) });
  }
  return found;
}

// -------------------------------------------------------------------------- 1. the export

/**
 * CA-9.18: a Comercio page that exports `prerender` fails the build. The page lives in a copy of
 * the pages folder that holds only it, and the build reads that folder as its `srcDir`, so the
 * working tree and a development server watching it never see the page. Astro lists the routes
 * before it writes anything, so the failing build leaves `.vercel/output` as it was.
 */
function checkPrerenderExport() {
  process.stdout.write('\n· Una página de Comercio que exporta `prerender`\n');
  const srcDir = mkdtempSync(path.join(tmpdir(), 'comercio-fases-'));
  try {
    const folder = path.join(srcDir, 'pages', '[locale]', 'comercio');
    mkdirSync(folder, { recursive: true });
    writeFileSync(
      path.join(folder, 'index.astro'),
      [
        '---',
        'export const prerender = true;',
        '',
        'export function getStaticPaths() {',
        "  return [{ params: { locale: 'es' } }];",
        '}',
        '---',
        '<p>Prueba de CA-9.18.</p>',
        '',
      ].join('\n'),
    );
    const result = spawnSync(process.execPath, [fileURLToPath(import.meta.url), CHILD, srcDir], {
      cwd: ROOT,
      env: buildEnv(),
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
    const log = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
    if (result.status === 0) {
      problem('el build terminó aunque una página de Comercio exporta `prerender`');
    } else if (
      !/exporta `prerender`/.test(log) ||
      !/\[locale\]\/comercio\/index\.astro/.test(log)
    ) {
      problem('el build falló, pero no por la exportación de `prerender`:');
      process.stdout.write(`${tail(log)}\n`);
    } else {
      ok('el build falla y nombra la página que exporta `prerender`');
    }
  } finally {
    rmSync(srcDir, { recursive: true, force: true });
  }
}

// --------------------------------------------------------------------------- 2. phase A

function checkPhaseA() {
  const routes = readRoutes();
  for (const locale of LOCALES) {
    const list = staticFile(`/${locale}/comercio/`);
    if (list === null) {
      problem(`/${locale}/comercio/: no está en static/`);
    } else if (!readFileSync(list, 'utf8').includes('data-ac-list="comercio"')) {
      problem(`/${locale}/comercio/: no tiene la lista de anuncios; el build no leyó el registro`);
    }
    const pages = [
      `/${locale}/comercio/`,
      `/${locale}/comercio/publicar/`,
      `/${locale}/comercio/datos.json`,
      ...withDetail.map((anuncio) => `/${locale}/comercio/anuncio/${anuncio.id}/`),
      ...vendedores.map((vendedor) => `/${locale}/comercio/vendedor/${vendedor.id}/`),
    ];
    const answered = pages.filter((pathname) => expectFile(routes, pathname)).length;
    expectNotRendered(routes, pages);
    for (const anuncio of withdrawn) {
      expectNotFound(routes, `/${locale}/comercio/anuncio/${anuncio.id}/`);
    }
    for (const name of Object.keys(PHASE_B_PAGES)) {
      expectNotFound(routes, `/${locale}/comercio/${name}/`);
    }
    expectRedirect(routes, `/${locale}/${OLD_OPERACIONES}`);
    if (answered === pages.length) {
      ok(
        `/${locale}/: la lista, la página de publicar, datos.json, ${withDetail.length} detalles y ` +
          `${vendedores.length} perfiles son archivos de static/ que config.json no envía a _render`,
      );
    }
  }
  // The scan of CA-9.1 has to see the ids when they are there, or its silence proves nothing.
  const found = scanLeaks(leakNeedles());
  if (found.length === 0) {
    problem('la búsqueda de ids y nombres no encuentra ninguno en el build con COMERCIO_DEMO');
  } else {
    ok(
      `la búsqueda de CA-9.1 encuentra los datos de ejemplo en ${found.length} archivos de este build`,
    );
  }
}

// --------------------------------------------------------------------------- 3. phase B

function checkPhaseB() {
  const routes = readRoutes();
  for (const locale of LOCALES) {
    let fine = true;
    const rendered = [
      `/${locale}/comercio/`,
      ...withDetail.slice(0, 1).map((anuncio) => `/${locale}/comercio/anuncio/${anuncio.id}/`),
      ...vendedores.slice(0, 1).map((vendedor) => `/${locale}/comercio/vendedor/${vendedor.id}/`),
    ];
    for (const pathname of rendered) {
      if (staticFile(pathname) !== null) {
        problem(`${pathname}: está en static/ con COMERCIO_PUBLICO`);
        fine = false;
      }
      fine = expectFunction(routes, pathname) && fine;
    }
    const files = walk(path.join(STATIC, locale, 'comercio')).map((file) => shown(file));
    for (const file of files) {
      if (!/\/comercio\/publicar\/index\.html$/.test(file)) {
        problem(`${file}: con COMERCIO_PUBLICO solo la página de publicar es un archivo`);
        fine = false;
      }
    }
    fine = expectFile(routes, `/${locale}/comercio/publicar/`) && fine;
    if (fine) {
      ok(
        `/${locale}/: la lista, el detalle y el perfil van a _render y ningún archivo los sustituye; ` +
          'la página de publicar sigue prerenderizada',
      );
    }
    if (existsSync(PHASE_B_PAGES.moderacion)) {
      if (expectFunction(routes, `/${locale}/comercio/moderacion/`)) {
        ok(`/${locale}/comercio/moderacion/ va a _render`);
      }
    } else if (locale === LOCALES[0]) {
      notes.push('moderacion: su página aún no existe (M14); CA-9.18 la comprobará cuando exista');
    }
    // «Mis operaciones» lives in the account (9.16.3): a file whenever the account page is one,
    // which needs the public Supabase settings, and the old route a 302 towards it.
    if (expectRedirect(routes, `/${locale}/${OLD_OPERACIONES}`)) {
      ok(`/${locale}/${OLD_OPERACIONES} es una redirección 302 a /${locale}/cuenta/operaciones/`);
    }
    if (staticFile(`/${locale}/cuenta/`) !== null) {
      if (expectFile(routes, `/${locale}/cuenta/operaciones/`)) {
        ok(`/${locale}/cuenta/operaciones/ existe`);
      }
    } else if (locale === LOCALES[0]) {
      notes.push('cuenta/operaciones: el build no tiene la configuración pública de Supabase');
    }
  }
}

// ------------------------------------------------------------------------ 4. and 5. CA-9.1

function checkEmptyList(locale) {
  const pathname = `/${locale}/comercio/`;
  const file = staticFile(pathname);
  if (file === null) {
    problem(`${pathname}: no está en static/`);
    return;
  }
  // The markup alone: a class named inside a stylesheet or a script is not an element.
  const html = readFileSync(file, 'utf8').replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
  const main = /<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(html)?.[1];
  if (main === undefined) {
    problem(`${pathname}: no tiene <main>`);
    return;
  }
  let fine = true;
  for (const [marker, what] of FORBIDDEN_IN_EMPTY_LIST) {
    if (main.includes(marker)) {
      problem(`${pathname}: la lista vacía tiene ${what} («${marker}»)`);
      fine = false;
    }
  }
  if (html.includes('ac-info-banner')) {
    problem(`${pathname}: tiene el InfoBanner`);
    fine = false;
  }
  const expected = EMPTY_LIST[locale];
  const text = main
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text.includes(expected.line)) {
    problem(`${pathname}: falta «${expected.line}»`);
    fine = false;
  }
  const link = [...main.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].find((match) =>
    new RegExp(`\\bhref=["']/${locale}/comercio/publicar/["']`).test(match[1]),
  );
  const label = link?.[2].replace(/<[^>]+>/g, '').trim();
  if (label !== expected.action) {
    problem(`${pathname}: falta el enlace «${expected.action}» a /${locale}/comercio/publicar/`);
    fine = false;
  }
  if (fine) {
    ok(
      `${pathname}: solo «${expected.line}» y el enlace «${expected.action}» a la página de publicar`,
    );
  }
}

function checkProduction() {
  const routes = readRoutes();
  for (const locale of LOCALES) {
    checkEmptyList(locale);
    expectFile(routes, `/${locale}/comercio/`);
    expectFile(routes, `/${locale}/comercio/publicar/`);
    const absent = [
      `/${locale}/comercio/datos.json`,
      ...anuncios.map((anuncio) => `/${locale}/comercio/anuncio/${anuncio.id}/`),
      ...vendedores.map((vendedor) => `/${locale}/comercio/vendedor/${vendedor.id}/`),
      ...Object.keys(PHASE_B_PAGES).map((name) => `/${locale}/comercio/${name}/`),
      `/${locale}/cuenta/operaciones/`,
    ];
    if (absent.every((pathname) => expectNotFound(routes, pathname))) {
      ok(`/${locale}/: no hay datos.json, detalles, perfiles ni rutas de la fase B`);
    }
    expectRedirect(routes, `/${locale}/${OLD_OPERACIONES}`);
    const files = walk(path.join(STATIC, locale, 'comercio')).map((file) => shown(file));
    for (const file of files) {
      if (!/\/comercio\/(?:publicar\/)?index\.html$/.test(file)) {
        problem(`${file}: el build de producción solo lleva la lista y la página de publicar`);
      }
    }
  }
  const needles = leakNeedles();
  for (const what of new Set(
    needles.filter((needle) => needle.text.length < MIN_NEEDLE).map((needle) => needle.what),
  )) {
    problem(
      `${what} mide menos de ${MIN_NEEDLE} caracteres: CA-9.1 no puede buscarlo sin confundirlo ` +
        'con otro texto; los datos de ejemplo llevan ids y nombres inconfundibles',
    );
  }
  const found = scanLeaks(needles.filter((needle) => needle.text.length >= MIN_NEEDLE));
  for (const { file, needle } of found) {
    problem(`${shown(file)} contiene ${needle.what} (CA-9.1)`);
  }
  if (found.length === 0) {
    const count = walk(OUTPUT).length;
    ok(
      `ningún archivo de .vercel/output (${count}) contiene un id de anuncios.json ni un handle o ` +
        'un nombre de vendedores.json',
    );
  }
}

// ------------------------------------------------------------------------------ the run

/** The argument that makes this script the child build of `checkPrerenderExport`. */
const CHILD = '--src-de-prueba';

async function child(srcDir) {
  const { build: astroBuild } = await import('astro');
  try {
    await astroBuild({ root: ROOT, srcDir, logLevel: 'silent' });
  } catch (error) {
    let cause = error;
    while (cause !== undefined && cause !== null) {
      process.stderr.write(`${cause instanceof Error ? cause.message : String(cause)}\n`);
      cause = cause instanceof Error ? cause.cause : undefined;
    }
    return 1;
  }
  return 0;
}

function main() {
  if (anuncios.length === 0 || vendedores.length === 0) {
    process.stderr.write(
      'tests/fixtures/comercio/ no tiene anuncios o vendedores de ejemplo: CA-9.1 y CA-9.18 no tienen ' +
        'nada que buscar.\n',
    );
    return 1;
  }

  /** A check that cannot read the output reports it and lets the next build run. */
  const check = (run) => {
    const started = Date.now();
    try {
      run();
    } catch (error) {
      problem(error instanceof Error ? error.message : String(error));
    }
    process.stdout.write(`  (${((Date.now() - started) / 1000).toFixed(0)} s)\n`);
  };

  check(checkPrerenderExport);

  if (build('Fase A con datos de ejemplo (COMERCIO_DEMO=1)', { demo: true })) check(checkPhaseA);
  if (
    build('Fase B con datos de ejemplo (COMERCIO_DEMO=1 COMERCIO_PUBLICO=1)', {
      demo: true,
      publico: true,
    })
  ) {
    check(checkPhaseB);
  }
  if (build('Producción con OCULTAR_BORRADORES=1', { ocultar: true })) check(checkProduction);
  const restored = build('Producción', {});
  if (restored) check(checkProduction);

  for (const note of notes) process.stdout.write(`\n  · ${note}`);
  if (notes.length > 0) process.stdout.write('\n');
  if (!restored) {
    process.stderr.write(
      '\n.vercel/output no tiene el build de producción: ejecuta `pnpm build` antes de otra compuerta.\n',
    );
  }
  if (problems.length > 0) {
    process.stderr.write(
      `\n${problems.length} ${problems.length === 1 ? 'problema' : 'problemas'} de CA-9.1 o CA-9.18.\n`,
    );
    return 1;
  }
  process.stdout.write('\nCA-9.1 y CA-9.18 sin problemas.\n');
  return 0;
}

process.exitCode = process.argv[2] === CHILD ? await child(process.argv[3]) : main();
