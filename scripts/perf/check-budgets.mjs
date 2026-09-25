#!/usr/bin/env node
// The static performance budgets of §13.6, measured over the build output
// after `pnpm build`. The lab metrics of the same section (LCP, CLS, INP) are
// not here: they need a browser and live in tests/e2e/perf.spec.ts.
//
// What it measures, per page:
//
//   1. Initial JS: gzip -9 of every `script[type=module][src]` plus the
//      `component-url` and `renderer-url` of every `astro-island` with
//      `client:load` or `client:idle`, plus their static imports, followed
//      recursively. The limit depends on the page group (RUTAS_PRESUPUESTO).
//   2. Props of each `astro-island`: the bytes of the `props` attribute as the
//      HTML writes it (escaped), which is what the §13.6 baseline measured
//      (457.633 B of the 519.525 B of the Pokédex HTML).
//   3. CSS: gzip -9 of every same-origin `link[rel=stylesheet]`, added up.
//   4. HTML: the file, gzipped and plain.
//
// And once, over every measured page:
//
//   5. Deferred chunks: the `component-url` of every island that is not
//      load/idle, plus every dynamic `import()` target of the reachable graph,
//      each file on its own. A file that some page already loads initially is
//      not a deferred chunk and is measured in 1. The framework runtime
//      (`renderer-url`) is never a deferred chunk: §13.6 budgets it inside the
//      initial JS of the pages that hydrate on load.
//   6. The data files a list downloads (`datos.json`, the search index), each
//      one only when the route that owns it is measured.
//
// Fonts (the last row of §13.6) are measured over the network, in
// tests/e2e/prod.spec.ts.
//
// Usage:
//   node scripts/perf/check-budgets.mjs
//
// Scope. This gate visits the routes that scripts/lib/rutas-migradas.mjs lists,
// which since M15 is `'*'`: every page of the output. The /_paridad/ routes of
// §14.5 are skipped: they only exist in the visual build and are never deployed.
//
// Pages rendered on demand. The §8.12 404 is a content page of §13.6 with no file
// in the output: the server function writes it. It is measured at the requests of
// `sondasBajoDemanda` in that same module, which scripts/lib/bajo-demanda.mjs
// renders through the function of `.vercel/output` the way `config.json` routes
// them; its HTML then goes through 1 to 6 like a file of the output, under the
// page group of its template. A template rendered on demand with no request, or a
// request that does not answer as its page, is a failure, not a page to skip.

import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, posix, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

import { plantillasSinSonda, renderizarBajoDemanda } from '../lib/bajo-demanda.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** The Vercel output is what gets deployed; dist/client is the same tree without the adapter. */
const OUTPUT_ROOTS = ['.vercel/output/static', 'dist/client'];

// §13.6 writes its budgets in KB of 1.000 B: the Pokédex HTML of 519.525 B is
// «over the 450 KB limit» and the shared stylesheet of 203.705 B is over
// 100.000 B (§3.1, S17).
const KB = 1000;

/** Initial JS per page group, §13.6. */
const JS_INICIAL = {
  contenido: 90 * KB,
  lista: 110 * KB,
  comparar: 120 * KB,
  comercio: 140 * KB,
  guild: 200 * KB,
};

const PRESUPUESTO = {
  chunkDiferido: 60 * KB,
  indiceBusqueda: 60 * KB,
  datosGzip: 60 * KB,
  datosPlano: 400 * KB,
  propsIsla: 20 * KB,
  cssGzip: 30 * KB,
  htmlGzip: 80 * KB,
  htmlPlano: 450 * KB,
  entradaCuenta: 4 * KB,
};

/**
 * Page group of a route, by its path without the locale prefix (§13.6, over
 * the route table of §8.0.2 and the routes of §9, §10 and §11). The first
 * pattern that matches wins, so the specific routes come before the generic
 * ones. A route that no pattern matches is a failure, not a default: §13.6
 * decides the budgets and this script never invents one.
 */
const RUTAS_PRESUPUESTO = [
  [/^$/, 'contenido'], // /{l}/
  [/^sistemas\/(?:[^/]+\/)?$/, 'contenido'],
  [/^actividades\/(?:[^/]+\/)?$/, 'contenido'],
  [/^cambios\/$/, 'contenido'],
  [/^mapa\/$/, 'contenido'],
  [/^404\/$/, 'contenido'], // the §8.12 404, by its template (`grupoDePlantilla`)
  [/^pokedex\/$/, 'lista'],
  [/^pokedex\/tiers\/$/, 'lista'],
  [/^pokedex\/[^/]+\/$/, 'lista'],
  [/^items\/$/, 'lista'],
  [/^items\/c\/[^/]+\/$/, 'lista'],
  [/^items\/[^/]+\/$/, 'contenido'], // the page of one item: no island

  [/^buscar\/$/, 'lista'],
  [/^herramientas\/pokemon\/$/, 'comparar'],
  [/^herramientas\/guild\/$/, 'guild'],
  [/^herramientas\/$/, 'contenido'],
  [/^comercio\/(?:.*\/)?$/, 'comercio'],
  // /{l}/cuenta/, «Mi perfil» and the new password of a recovery link (§9.9, §9.16.3)
  [/^cuenta\/(?:perfil\/|restablecer\/)?$/, 'comercio'],
];

/**
 * The script of the header account entry (§9.16.1): Astro emits it as its own module, named
 * after the component. It only exists in a build with the public Supabase settings.
 */
const ENTRADA_CUENTA = /AccountEntry\.astro_astro_type_script/;

/**
 * Data files a route downloads after hydrating (PR5, §8.0.6 and §7.9.1), with
 * the budget row of §13.6 they answer to. `{l}` is the locale of the route.
 */
const DATOS_POR_RUTA = [
  ['pokedex/', '{l}/pokedex/datos.json', 'datos'],
  ['pokedex/tiers/', '{l}/pokedex/datos.json', 'datos'],
  ['items/', '{l}/items/datos.json', 'datos'],
  ['buscar/', '{l}/buscar/indice.json', 'indice'],
  ['comercio/', '{l}/comercio/datos.json', 'datos'],
];

/**
 * The single list of migrated routes (§3.10) and its predicates. A gate that cannot
 * read it would measure nothing and still exit 0, so a missing file, a renamed export
 * or a syntax error is a failure of this gate and not an empty list: from M15 that list
 * is `'*'` and the silent version would stop covering the whole site.
 */
async function cargarRutas() {
  const module = await import(pathToFileURL(resolve(ROOT, 'scripts/lib/rutas-migradas.mjs')).href);
  if (!Array.isArray(module.rutasMigradas)) {
    throw new Error('no exporta `rutasMigradas` como lista');
  }
  if (typeof module.esRutaParidad !== 'function') {
    throw new Error('no exporta `esRutaParidad`');
  }
  if (!Array.isArray(module.plantillasBajoDemanda)) {
    throw new Error('no exporta `plantillasBajoDemanda` como lista');
  }
  if (!Array.isArray(module.sondasBajoDemanda)) {
    throw new Error('no exporta `sondasBajoDemanda` como lista');
  }
  return module;
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function findOutputRoot() {
  for (const candidate of OUTPUT_ROOTS) {
    if (await exists(resolve(ROOT, candidate))) return candidate;
  }
  return null;
}

async function walk(dir, out = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const absolute = resolve(dir, entry.name);
    if (entry.isDirectory()) await walk(absolute, out);
    else out.push(absolute);
  }
  return out;
}

function toPosix(path) {
  return path.split(sep).join(posix.sep);
}

/** `/es/pokedex/` -> `es/pokedex/index.html`; a route already naming a file stays as is. */
function routeToHtml(route) {
  const clean = route.replace(/^\/+/, '');
  if (clean.endsWith('.html')) return clean;
  return `${clean.endsWith('/') || clean === '' ? clean : `${clean}/`}index.html`;
}

/** `es/pokedex/index.html` -> `/es/pokedex/`. */
function htmlToRoute(relativePath) {
  const clean = toPosix(relativePath);
  return `/${clean.replace(/index\.html$/, '')}`;
}

/** `/es/pokedex/tiers/` -> `{ locale: 'es', resto: 'pokedex/tiers/' }`. */
function partirRuta(route) {
  const match = /^\/([a-z]{2})\/(.*)$/.exec(route);
  if (!match) return null;
  return { locale: match[1], resto: match[2] };
}

function grupoDeRuta(route) {
  const partes = partirRuta(route);
  if (!partes) return null;
  for (const [patron, grupo] of RUTAS_PRESUPUESTO) {
    if (patron.test(partes.resto)) return grupo;
  }
  return null;
}

/**
 * Page group of a template rendered on demand (`plantillasBajoDemanda`), read like a route:
 * its path without the locale segment, so `/404/` is `404/` and `/{l}/x/` is `x/`. Its
 * requests are paths that no route of §8 matches, so they cannot give the group themselves.
 */
function grupoDePlantilla(plantilla) {
  const resto = plantilla.replace(/^\/(?:\{l\}\/)?/, '');
  for (const [patron, grupo] of RUTAS_PRESUPUESTO) {
    if (patron.test(resto)) return grupo;
  }
  return null;
}

/** «1 ruta» / «3 rutas», so the summary line reads like Spanish. */
function plural(n, uno, varios) {
  return `${n} ${n === 1 ? uno : varios}`;
}

function kb(bytes) {
  return `${(bytes / KB).toFixed(1).replace('.', ',')} KB`;
}

/** Same-origin stylesheet hrefs of an HTML document, in document order. */
function stylesheetHrefs(html) {
  const hrefs = [];
  for (const tag of html.matchAll(/<link\b[^>]*>/gi)) {
    const rel = /\brel\s*=\s*["']([^"']*)["']/i.exec(tag[0]);
    if (!rel || !rel[1].toLowerCase().split(/\s+/).includes('stylesheet')) continue;
    const href = /\bhref\s*=\s*["']([^"']*)["']/i.exec(tag[0]);
    if (!href) continue;
    if (/^(?:[a-z]+:)?\/\//i.test(href[1])) continue; // absolute URL: not a site sheet
    hrefs.push(href[1]);
  }
  return hrefs;
}

/** Same-origin `src` of every `<script type="module">` of an HTML document. */
function moduleScriptSrcs(html) {
  const srcs = [];
  for (const tag of html.matchAll(/<script\b[^>]*>/gi)) {
    const type = /\btype\s*=\s*["']([^"']*)["']/i.exec(tag[0]);
    if (!type || type[1].trim().toLowerCase() !== 'module') continue;
    const src = /\bsrc\s*=\s*["']([^"']*)["']/i.exec(tag[0]);
    if (!src) continue;
    if (/^(?:[a-z]+:)?\/\//i.test(src[1])) continue;
    srcs.push(src[1]);
  }
  return srcs;
}

/**
 * Every `<astro-island>` of an HTML document, with the attributes §13.6
 * measures. `props` keeps the escaped text the HTML carries.
 */
function astroIslands(html) {
  const islands = [];
  for (const tag of html.matchAll(/<astro-island\b[^>]*>/gi)) {
    const attribute = (name) => {
      const match = new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, 'i').exec(tag[0]);
      return match ? match[1] : null;
    };
    islands.push({
      client: (attribute('client') ?? '').trim().toLowerCase(),
      componentUrl: attribute('component-url'),
      rendererUrl: attribute('renderer-url'),
      componentExport: attribute('component-export'),
      props: attribute('props'),
    });
  }
  return islands;
}

/**
 * Module specifiers of a built chunk. Rollup and esbuild always write plain
 * string specifiers, so matching the statement forms is enough. A dynamic
 * `import()` may also take a template literal with no substitution, which Vite
 * writes for the deferred views of an island (import of `./SlotsPanel.x.js` between
 * backticks): the same specifier, followed like a quoted one.
 */
function imports(source) {
  const estaticos = new Set();
  const dinamicos = new Set();
  for (const match of source.matchAll(/(?:^|[;{}\s])import\s*["']([^"']+)["']/g)) {
    estaticos.add(match[1]);
  }
  for (const match of source.matchAll(
    /(?:^|[;{}\s])import[\s{*][^;]*?\bfrom\s*["']([^"']+)["']/g,
  )) {
    estaticos.add(match[1]);
  }
  for (const match of source.matchAll(
    /(?:^|[;{}\s])export\s*(?:\*|\{[^}]*\})\s*from\s*["']([^"']+)["']/g,
  )) {
    estaticos.add(match[1]);
  }
  for (const match of source.matchAll(/\bimport\s*\(\s*(["'`])([^"'`$]+)\1\s*\)/g)) {
    dinamicos.add(match[2]);
  }
  return { estaticos: [...estaticos], dinamicos: [...dinamicos] };
}

/** Resolves a specifier of `fromPath` (posix, relative to the output root); null if it leaves the site. */
function resolverEspecificador(especificador, fromPath) {
  if (/^(?:[a-z]+:)?\/\//i.test(especificador)) return null;
  if (especificador.startsWith('/')) return especificador.replace(/^\/+/, '');
  if (!especificador.startsWith('.')) return null; // bare specifier: not a file of the output
  return posix.normalize(posix.join(posix.dirname(fromPath), especificador));
}

/** Measures a file once and remembers it. */
function medidor(absoluteRoot) {
  const cache = new Map();
  return async function medir(relativePath) {
    if (cache.has(relativePath)) return cache.get(relativePath);
    const absolute = resolve(absoluteRoot, relativePath);
    let medida = null;
    if (await exists(absolute)) {
      const bytes = await readFile(absolute);
      medida = { plano: bytes.length, gzip: gzipSync(bytes, { level: 9 }).length };
    }
    cache.set(relativePath, medida);
    return medida;
  };
}

/**
 * Walks the import graph from `semillas`. Returns the files reached through
 * static imports and, apart, every dynamic `import()` target seen on the way.
 */
async function cierre(semillas, absoluteRoot) {
  const estaticos = new Set();
  const dinamicos = new Set();
  const pendientes = [...semillas];
  const vistos = new Set();
  while (pendientes.length > 0) {
    const file = pendientes.pop();
    if (vistos.has(file)) continue;
    vistos.add(file);
    const absolute = resolve(absoluteRoot, file);
    if (!(await exists(absolute))) continue;
    estaticos.add(file);
    if (!file.endsWith('.js')) continue;
    const source = await readFile(absolute, 'utf8');
    const { estaticos: e, dinamicos: d } = imports(source);
    for (const specifier of e) {
      const resolved = resolverEspecificador(specifier, file);
      if (resolved) pendientes.push(resolved);
    }
    for (const specifier of d) {
      const resolved = resolverEspecificador(specifier, file);
      if (resolved) dinamicos.add(resolved);
    }
  }
  return { estaticos, dinamicos };
}

/**
 * @param {{
 *   routes?: string[],
 *   sondas?: { plantilla: string, ruta: string, estado: number }[],
 * }} [options] `routes` overrides the list read from scripts/lib/rutas-migradas.mjs; tests use
 * it to measure a route on demand. `sondas` overrides `sondasBajoDemanda` of the same module;
 * with `routes` and no `sondas`, no page rendered on demand is measured.
 */
async function main(options = {}) {
  const outputRoot = await findOutputRoot();
  if (!outputRoot) {
    process.stderr.write(`no existe ${OUTPUT_ROOTS.join(' ni ')}; ejecuta pnpm build\n`);
    return 1;
  }
  const absoluteRoot = resolve(ROOT, outputRoot);
  const medir = medidor(absoluteRoot);
  const problems = [];
  const lines = [];

  // --- the pages to measure.
  let migradas;
  try {
    migradas = await cargarRutas();
  } catch (error) {
    process.stderr.write(`scripts/lib/rutas-migradas.mjs no se pudo leer: ${error.message}\n`);
    return 1;
  }
  const listadas = options.routes ?? migradas.rutasMigradas;
  let rutas;
  if (listadas.includes('*')) {
    const files = await walk(absoluteRoot);
    rutas = files
      .filter((file) => file.endsWith('.html'))
      .map((file) => htmlToRoute(relative(absoluteRoot, file)));
  } else {
    rutas = listadas;
  }
  // The parity routes of §14.5 only exist in the visual build and never ship. They are
  // built as `/{l}/_paridad/<name>/`, so the match is on the whole path.
  rutas = rutas.filter((route) => !migradas.esRutaParidad(route));

  const inicialGlobal = new Set();
  const diferidoGlobal = new Set();
  const datos = new Map(); // relative path -> budget row
  let medidas = 0;

  /**
   * 1 to 4 of one page, from its HTML and the measure of that HTML, and the seeds of 5 and 6.
   * `etiqueta` names the page in its problems and in its line.
   */
  const medirPagina = async ({ route, etiqueta, html, htmlMedida, grupo }) => {
    // --- 4. HTML.
    if (htmlMedida.plano > PRESUPUESTO.htmlPlano) {
      problems.push(
        `${etiqueta}: HTML ${htmlMedida.plano} B sin comprimir; el presupuesto es ${PRESUPUESTO.htmlPlano} B`,
      );
    }
    if (htmlMedida.gzip > PRESUPUESTO.htmlGzip) {
      problems.push(
        `${etiqueta}: HTML ${kb(htmlMedida.gzip)} gzip; el presupuesto es ${kb(PRESUPUESTO.htmlGzip)}`,
      );
    }

    // --- 3. CSS.
    let css = 0;
    for (const href of stylesheetHrefs(html)) {
      const medida = await medir(href.replace(/^\/+/, ''));
      if (!medida) {
        problems.push(`${etiqueta}: la hoja «${href}» no está en el build`);
        continue;
      }
      css += medida.gzip;
    }
    if (css > PRESUPUESTO.cssGzip) {
      problems.push(
        `${etiqueta}: CSS ${kb(css)} gzip; el presupuesto es ${kb(PRESUPUESTO.cssGzip)}`,
      );
    }

    // --- 2. props of each island, and the seeds of 1 and 5.
    const islands = astroIslands(html);
    const semillasIniciales = moduleScriptSrcs(html).map((src) => src.replace(/^\/+/, ''));
    const semillasDiferidas = [];
    for (const island of islands) {
      if (island.props !== null) {
        const bytes = Buffer.byteLength(island.props);
        if (bytes > PRESUPUESTO.propsIsla) {
          const nombre = island.componentExport ?? island.componentUrl ?? 'isla';
          problems.push(
            `${etiqueta}: props de ${nombre} ${bytes} B sin comprimir; el presupuesto es ${PRESUPUESTO.propsIsla} B`,
          );
        }
      }
      const inicial = island.client === 'load' || island.client === 'idle';
      for (const url of [island.componentUrl, island.rendererUrl]) {
        if (!url || /^(?:[a-z]+:)?\/\//i.test(url)) continue;
        if (inicial) semillasIniciales.push(url.replace(/^\/+/, ''));
      }
      if (!inicial && island.componentUrl && !/^(?:[a-z]+:)?\/\//i.test(island.componentUrl)) {
        semillasDiferidas.push(island.componentUrl.replace(/^\/+/, ''));
      }
    }

    // --- 1b. what the account entry adds to the initial JS of every page (§9.16.1): the files
    // its script reaches that no other initial seed of the page reaches.
    const semillasEntrada = semillasIniciales.filter((src) => ENTRADA_CUENTA.test(src));
    if (semillasEntrada.length > 0) {
      const resto = await cierre(
        semillasIniciales.filter((src) => !ENTRADA_CUENTA.test(src)),
        absoluteRoot,
      );
      const entrada = await cierre(semillasEntrada, absoluteRoot);
      let anadido = 0;
      for (const file of entrada.estaticos) {
        if (resto.estaticos.has(file)) continue;
        const medida = await medir(file);
        if (medida) anadido += medida.gzip;
      }
      if (anadido > PRESUPUESTO.entradaCuenta) {
        problems.push(
          `${etiqueta}: la entrada de cuenta añade ${kb(anadido)} gzip de JS inicial; el presupuesto es ${kb(PRESUPUESTO.entradaCuenta)}`,
        );
      }
    }

    // --- 1. initial JS.
    const inicial = await cierre(semillasIniciales, absoluteRoot);
    let js = 0;
    for (const file of inicial.estaticos) {
      const medida = await medir(file);
      if (medida) js += medida.gzip;
      inicialGlobal.add(file);
    }
    const limite = JS_INICIAL[grupo];
    if (js > limite) {
      problems.push(
        `${etiqueta}: JS inicial ${kb(js)} gzip; el presupuesto de «${grupo}» es ${kb(limite)}`,
      );
    }

    // --- 5. seeds of the deferred graph.
    const diferido = await cierre([...semillasDiferidas, ...inicial.dinamicos], absoluteRoot);
    for (const file of diferido.estaticos) diferidoGlobal.add(file);
    for (const file of diferido.dinamicos) diferidoGlobal.add(file);

    // --- 6. data files this route downloads.
    const partes = partirRuta(route);
    if (partes) {
      for (const [resto, plantilla, fila] of DATOS_POR_RUTA) {
        if (partes.resto === resto) datos.set(plantilla.replace('{l}', partes.locale), fila);
      }
    }

    lines.push(
      `${etiqueta}  HTML ${kb(htmlMedida.gzip)} gzip (${htmlMedida.plano} B)` +
        `  CSS ${kb(css)}  JS ${kb(js)} de ${kb(limite)} («${grupo}»)`,
    );
  };

  for (const route of rutas) {
    const htmlPath = routeToHtml(route);
    const htmlMedida = await medir(htmlPath);
    if (!htmlMedida) {
      // A migrated route the build does not contain is the contract of
      // scripts/lib/rutas-migradas.mjs breaking, not a route to skip: a renamed
      // template or a build regression would otherwise take a page out of §13.6 and
      // leave nothing behind but a line of stdout. A page rendered on demand has no
      // HTML by design and belongs in `plantillasBajoDemanda`, measured below.
      problems.push(`${route}: ruta migrada sin HTML en el build`);
      continue;
    }
    const grupo = grupoDeRuta(route);
    if (!grupo) {
      problems.push(
        `${route}: sin presupuesto de JS inicial en §13.6; añade su fila a RUTAS_PRESUPUESTO`,
      );
      continue;
    }
    medidas += 1;
    const html = await readFile(resolve(absoluteRoot, htmlPath), 'utf8');
    await medirPagina({ route, etiqueta: route, html, htmlMedida, grupo });
  }

  // --- the pages rendered on demand (the §8.12 404), at the requests of `sondasBajoDemanda`,
  // under the page group of their template.
  const sondas = options.sondas ?? (options.routes ? [] : migradas.sondasBajoDemanda);
  if (options.sondas === undefined && options.routes === undefined) {
    for (const plantilla of plantillasSinSonda(migradas.plantillasBajoDemanda, sondas)) {
      problems.push(
        `${plantilla}: plantilla bajo demanda sin petición en \`sondasBajoDemanda\` ` +
          '(scripts/lib/rutas-migradas.mjs); ninguna compuerta la mide',
      );
    }
  }
  const bajoDemanda = await renderizarBajoDemanda(sondas);
  problems.push(...bajoDemanda.problemas);
  let medidasBajoDemanda = 0;
  for (const pagina of bajoDemanda.paginas) {
    const etiqueta = `${pagina.ruta} (${pagina.plantilla}, bajo demanda)`;
    const grupo = grupoDePlantilla(pagina.plantilla);
    if (!grupo) {
      problems.push(
        `${etiqueta}: sin presupuesto de JS inicial en §13.6; añade su fila a RUTAS_PRESUPUESTO`,
      );
      continue;
    }
    medidasBajoDemanda += 1;
    const bytes = Buffer.from(pagina.html, 'utf8');
    const htmlMedida = { plano: bytes.length, gzip: gzipSync(bytes, { level: 9 }).length };
    await medirPagina({ route: pagina.ruta, etiqueta, html: pagina.html, htmlMedida, grupo });
  }

  // --- 5. each deferred chunk on its own.
  for (const file of [...diferidoGlobal].sort()) {
    if (inicialGlobal.has(file)) continue; // already counted as initial JS
    const medida = await medir(file);
    if (!medida) continue;
    if (medida.gzip > PRESUPUESTO.chunkDiferido) {
      problems.push(
        `${file}: chunk diferido de ${kb(medida.gzip)} gzip; el presupuesto es ${kb(PRESUPUESTO.chunkDiferido)}`,
      );
    }
  }

  // --- 6. the data of each measured list.
  for (const [file, fila] of [...datos].sort()) {
    const medida = await medir(file);
    if (!medida) continue; // the list may not have its data file yet
    const limiteGzip = fila === 'indice' ? PRESUPUESTO.indiceBusqueda : PRESUPUESTO.datosGzip;
    if (medida.gzip > limiteGzip) {
      problems.push(`${file}: ${kb(medida.gzip)} gzip; el presupuesto es ${kb(limiteGzip)}`);
    }
    if (fila === 'datos' && medida.plano > PRESUPUESTO.datosPlano) {
      problems.push(
        `${file}: ${medida.plano} B sin comprimir; el presupuesto es ${PRESUPUESTO.datosPlano} B`,
      );
    }
    lines.push(`${file}  ${kb(medida.gzip)} gzip (${medida.plano} B)`);
  }

  for (const line of lines) process.stdout.write(`${line}\n`);
  if (problems.length > 0) {
    for (const problem of problems) process.stderr.write(`${problem}\n`);
    process.stderr.write(
      `\n${plural(problems.length, 'presupuesto superado', 'presupuestos superados')} (§13.6)\n`,
    );
    return 1;
  }
  const bajoDemandaMedidas =
    medidasBajoDemanda > 0
      ? ` y ${plural(medidasBajoDemanda, 'página bajo demanda', 'páginas bajo demanda')}`
      : '';
  process.stdout.write(
    `perf:budget sin problemas (${plural(medidas, 'ruta medida', 'rutas medidas')}` +
      `${bajoDemandaMedidas} en ${outputRoot})\n`,
  );
  return 0;
}

// Only run when executed directly; tests import `main`.
if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(ROOT, 'scripts/perf/check-budgets.mjs')
) {
  process.exitCode = await main();
}

export { JS_INICIAL, PRESUPUESTO, astroIslands, grupoDeRuta, imports, main, moduleScriptSrcs };
