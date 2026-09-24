#!/usr/bin/env node
// The SEO and metadata checks of §13.5, over the build output after
// `pnpm build`. They run in `pnpm ci` as `pnpm seo:check`.
//
// Per page (§13.5, «En cada página»):
//
//   1. <title>, and it ends in « · PokeAlliance Wiki»; the Inicio, `/{l}/`, carries the
//      whole title of S-01 instead (§12.2, §13.5).
//   2. <meta name="description">, 50 to 160 characters, without «Alliance
//      Codex» (the title already says it), unique across indexable routes.
//   3. <link rel="canonical">: absolute, with trailing slash, no query and
//      equal to the URL of the route itself.
//   4. <link rel="alternate" hreflang="es|en|x-default">: absolute URLs of the
//      same route in each language, with x-default pointing at the es one.
//      A hreflang whose page is not in the build has no reciprocal.
//   5. Open Graph and Twitter: og:site_name, og:title, og:description, og:url,
//      og:type, og:locale, og:locale:alternate and twitter:card, with the
//      values of §13.5. No og:image and no JSON-LD: §15 leaves them out.
//   6. <meta name="theme-color" content="#0c0e12"> (S-11) and
//      <meta name="color-scheme" content="dark">.
//   7. A noindex route (§13.5) may not appear in the sitemap.
//
// A noindex page answers 1, 6 and 7, and whatever else it does carry has to be
// right: §13.5 gives the 404 and the map placeholder no description, and the
// uniqueness rule speaks of indexable routes only.
//
// Over the whole output, with no route to key on:
//
//   8. No /_paridad/ in the production build (§14.5).
//   9. No /comercio/datos.json and no prerendered /comercio/anuncio/* or
//      /comercio/vendedor/* (§9.2, CA-9.1): they only exist with COMERCIO_DEMO.
//
// Usage:
//   node scripts/seo/check-dist.mjs
//
// Scope. Checks 1 to 7 visit the routes that scripts/lib/rutas-migradas.mjs lists,
// which since M15 is `'*'`: every page of the output. Checks 8 and 9 always cover
// everything.

import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, posix, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** The Vercel output is what gets deployed; dist/client is the same tree without the adapter. */
const OUTPUT_ROOTS = ['.vercel/output/static', 'dist/client'];

/** §13.5: `site` of astro.config.mjs. */
const SITIO = 'https://pokealliancewiki.com';

const MARCA = 'PokeAlliance Wiki';
const SUFIJO_TITULO = ` · ${MARCA}`;

/**
 * S-01 (§12.2, §13.5): the Inicio of each locale has its own whole `<title>`, the
 * `documentTitle` of its dictionary, and not «{h1} · PokeAlliance Wiki».
 */
const TITULO_INICIO = {
  es: 'PokeAlliance Wiki · Pokédex, tier list e ítems',
  en: 'PokeAlliance Wiki · Pokédex, tier list and items',
};

const DESCRIPCION_MIN = 50;
const DESCRIPCION_MAX = 160;

/** §13.1: the two locales of the site; x-default points at the first one. */
const LOCALES = ['es', 'en'];

/** §13.5: og:locale per locale. */
const OG_LOCALE = { es: 'es_ES', en: 'en_US' };

const THEME_COLOR = '#0c0e12';
const COLOR_SCHEME = 'dark';

/** §9.2, CA-9.1: what a production build may never carry. */
const COMERCIO_PROHIBIDO = [
  /^(?:es|en)\/comercio\/datos\.json$/,
  /^(?:es|en)\/comercio\/anuncio\/.+\/index\.html$/,
  /^(?:es|en)\/comercio\/vendedor\/.+\/index\.html$/,
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

/** «1 ruta» / «3 rutas», so the summary line reads like Spanish. */
function plural(n, uno, varios) {
  return `${n} ${n === 1 ? uno : varios}`;
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

/** The five entities Astro writes in an attribute value. */
function decode(text) {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/**
 * The value of an attribute, closed by the same quote that opens it: a double-quoted value
 * may hold an apostrophe («Farfetch'd») and a single-quoted one a double quote.
 */
function attribute(tag, name) {
  const match = new RegExp(`\\b${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, 'i').exec(tag);
  return match ? decode(match[2]) : null;
}

/** `<meta name=…>` and `<meta property=…>` of a document, by key. */
function metas(html) {
  const byKey = new Map();
  for (const tag of html.matchAll(/<meta\b[^>]*>/gi)) {
    const key = attribute(tag[0], 'name') ?? attribute(tag[0], 'property');
    if (!key) continue;
    const content = attribute(tag[0], 'content');
    const lower = key.toLowerCase();
    if (!byKey.has(lower)) byKey.set(lower, []);
    byKey.get(lower).push(content ?? '');
  }
  return byKey;
}

/** `<link>` of a document, as `{ rel, href, hreflang }`. */
function links(html) {
  const out = [];
  for (const tag of html.matchAll(/<link\b[^>]*>/gi)) {
    const rel = attribute(tag[0], 'rel');
    if (!rel) continue;
    out.push({
      rel: rel.toLowerCase().trim(),
      href: attribute(tag[0], 'href') ?? '',
      hreflang: (attribute(tag[0], 'hreflang') ?? '').toLowerCase(),
    });
  }
  return out;
}

function title(html) {
  const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return match ? decode(match[1]).trim() : null;
}

/** `/es/pokedex/` in `en` -> `/en/pokedex/`. */
function rutaEnLocale(route, locale) {
  return route.replace(/^\/[a-z]{2}\//, `/${locale}/`);
}

function localeDeRuta(route) {
  const match = /^\/([a-z]{2})\//.exec(route);
  return match && LOCALES.includes(match[1]) ? match[1] : null;
}

/** Every `<loc>` of every sitemap of the output; null when there is no sitemap yet. */
async function sitemapLocs(absoluteRoot, files) {
  const sitemaps = files.filter((file) => /sitemap[^/]*\.xml$/i.test(toPosix(file)));
  if (sitemaps.length === 0) return null;
  const locs = new Set();
  for (const file of sitemaps) {
    const xml = await readFile(resolve(absoluteRoot, file), 'utf8');
    for (const match of xml.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)) locs.add(decode(match[1]).trim());
  }
  return locs;
}

/** Checks one page. Pushes its problems and returns its title and description. */
function revisarPagina(route, html, problems, htmlEnBuild) {
  const push = (text) => problems.push(`${route}: ${text}`);
  const meta = metas(html);
  const enlaces = links(html);
  const primero = (key) => {
    const values = meta.get(key);
    return values && values.length > 0 ? values[0].trim() : null;
  };

  const noindex = (meta.get('robots') ?? []).some((value) =>
    value
      .toLowerCase()
      .split(/[\s,]+/)
      .includes('noindex'),
  );

  // --- 1. title.
  const titulo = title(html);
  const inicio = /^\/([a-z]{2})\/$/.exec(route)?.[1];
  const tituloInicio = inicio === undefined ? undefined : TITULO_INICIO[inicio];
  if (!titulo) push('sin <title>');
  else if (tituloInicio !== undefined) {
    if (titulo !== tituloInicio) push(`el título es «${titulo}»; S-01 pide «${tituloInicio}»`);
  } else if (!titulo.endsWith(SUFIJO_TITULO)) {
    push(`el título «${titulo}» no termina en «${SUFIJO_TITULO.trim()}»`);
  }

  // --- 6. theme-color and color-scheme, on every page (S-11).
  if (primero('theme-color') !== THEME_COLOR) {
    push(`theme-color «${primero('theme-color') ?? ''}»; §13.5 pide ${THEME_COLOR}`);
  }
  if (primero('color-scheme') !== COLOR_SCHEME) {
    push(`color-scheme «${primero('color-scheme') ?? ''}»; §13.5 pide ${COLOR_SCHEME}`);
  }

  // --- 5. what §15 leaves out, on every page.
  if (meta.has('og:image')) push('lleva og:image; §15 lo deja fuera de este corte');
  if (/<script\b[^>]*type\s*=\s*["']application\/ld\+json["']/i.test(html)) {
    push('lleva JSON-LD; §15 lo deja fuera de este corte');
  }

  const locale = localeDeRuta(route);
  const canonicaEsperada = `${SITIO}${route}`;

  // --- 3. canonical.
  const canonicas = enlaces.filter((link) => link.rel === 'canonical');
  if (canonicas.length === 0) {
    if (!noindex) push('sin <link rel="canonical">');
  } else if (canonicas.length > 1) {
    push(`${canonicas.length} canónicas; §13.5 pide una`);
  } else {
    const href = canonicas[0].href;
    if (!href.startsWith('https://')) push(`la canónica «${href}» no es absoluta`);
    else if (/[?#]/.test(href)) push(`la canónica «${href}» lleva consulta o ancla`);
    else if (href !== canonicaEsperada) {
      push(`la canónica es «${href}» y la ruta es «${canonicaEsperada}»`);
    }
  }

  // --- 4. hreflang.
  const alternates = enlaces.filter((link) => link.rel === 'alternate' && link.hreflang);
  if (alternates.length === 0) {
    if (!noindex) push('sin <link rel="alternate" hreflang="…">');
  } else if (locale) {
    const esperadas = new Map(LOCALES.map((l) => [l, `${SITIO}${rutaEnLocale(route, l)}`]));
    esperadas.set('x-default', `${SITIO}${rutaEnLocale(route, LOCALES[0])}`);
    for (const [clave, esperada] of esperadas) {
      const declarada = alternates.find((link) => link.hreflang === clave);
      if (!declarada) push(`sin hreflang «${clave}»`);
      else if (declarada.href !== esperada) {
        push(`hreflang «${clave}» apunta a «${declarada.href}» y no a «${esperada}»`);
      }
    }
    for (const alternate of alternates) {
      if (!esperadas.has(alternate.hreflang)) {
        push(`hreflang «${alternate.hreflang}» de más; §13.5 lista es, en y x-default`);
        continue;
      }
      // Reciprocity: the page a hreflang names has to exist in the build.
      const destino = alternate.href.startsWith(SITIO) ? alternate.href.slice(SITIO.length) : null;
      if (destino && !htmlEnBuild.has(routeToHtml(destino))) {
        push(
          `hreflang «${alternate.hreflang}» no tiene recíproco: «${alternate.href}» no está en el build`,
        );
      }
    }
  }

  // --- 2. description.
  const descripcion = primero('description');
  if (!noindex) {
    if (!descripcion) push('sin <meta name="description">');
    else {
      const longitud = [...descripcion].length;
      if (longitud < DESCRIPCION_MIN || longitud > DESCRIPCION_MAX) {
        push(
          `descripción de ${longitud} caracteres; §13.5 pide de ${DESCRIPCION_MIN} a ${DESCRIPCION_MAX}`,
        );
      }
      if (descripcion.includes(MARCA))
        push(`la descripción repite «${MARCA}», que ya está en el título`);
    }
  }

  // --- 5. Open Graph and Twitter, on indexable pages.
  if (!noindex) {
    const iguales = [
      ['og:site_name', MARCA],
      ['og:type', 'website'],
      ['twitter:card', 'summary'],
      ['og:title', titulo],
      ['og:description', descripcion],
      ['og:url', canonicaEsperada],
    ];
    for (const [clave, esperado] of iguales) {
      if (esperado === null || esperado === undefined) continue;
      const valor = primero(clave);
      if (valor !== esperado) push(`${clave} es «${valor ?? ''}» y se espera «${esperado}»`);
    }
    if (locale) {
      const otro = LOCALES.find((l) => l !== locale);
      if (primero('og:locale') !== OG_LOCALE[locale]) {
        push(`og:locale es «${primero('og:locale') ?? ''}» y se espera «${OG_LOCALE[locale]}»`);
      }
      if (primero('og:locale:alternate') !== OG_LOCALE[otro]) {
        push(
          `og:locale:alternate es «${primero('og:locale:alternate') ?? ''}» y se espera «${OG_LOCALE[otro]}»`,
        );
      }
    }
  }

  return { titulo, descripcion, noindex, canonica: canonicaEsperada };
}

/**
 * @param {{ routes?: string[] }} [options] `routes` overrides the list read from
 * scripts/lib/rutas-migradas.mjs; tests use it to check a route on demand.
 */
async function main(options = {}) {
  const outputRoot = await findOutputRoot();
  if (!outputRoot) {
    process.stderr.write(`no existe ${OUTPUT_ROOTS.join(' ni ')}; ejecuta pnpm build\n`);
    return 1;
  }
  const absoluteRoot = resolve(ROOT, outputRoot);
  const todos = (await walk(absoluteRoot)).map((file) => toPosix(relative(absoluteRoot, file)));
  const htmlEnBuild = new Set(todos.filter((file) => file.endsWith('.html')));
  const problems = [];

  // --- 8. no parity routes in a production build (§14.5).
  for (const file of todos) {
    if (file.includes('_paridad/')) {
      problems.push(`${file}: /_paridad/ solo existe con VISUAL=1 (§14.5)`);
    }
  }

  // --- 9. no Comercio demo data or prerendered detail routes (§9.2, CA-9.1).
  for (const file of todos) {
    if (COMERCIO_PROHIBIDO.some((patron) => patron.test(file))) {
      problems.push(`${file}: el build de producción no lleva esta ruta de Comercio (CA-9.1)`);
    }
  }

  // --- the pages to check.
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
    rutas = [...htmlEnBuild].map((file) => htmlToRoute(file)).sort();
  } else {
    rutas = listadas;
  }
  rutas = rutas.filter((route) => !migradas.esRutaParidad(route));

  const porTitulo = new Map();
  const porDescripcion = new Map();
  const noindexados = [];
  let revisadas = 0;

  for (const route of rutas) {
    const htmlPath = routeToHtml(route);
    if (!htmlEnBuild.has(htmlPath)) {
      // A migrated route the build does not contain is the contract of
      // scripts/lib/rutas-migradas.mjs breaking, not a route to skip: a renamed
      // template or a build regression would otherwise take a page out of §13.5 and
      // leave nothing behind but a line of stdout. A page rendered on demand has no
      // HTML by design and belongs in `plantillasBajoDemanda`, which never gets here.
      problems.push(`${route}: ruta migrada sin HTML en el build`);
      continue;
    }
    revisadas += 1;
    const html = await readFile(resolve(absoluteRoot, htmlPath), 'utf8');
    const pagina = revisarPagina(route, html, problems, htmlEnBuild);
    if (pagina.noindex) {
      noindexados.push({ route, canonica: pagina.canonica });
      continue;
    }
    // --- 2. one title and one description per indexable route, «única por ruta
    // e idioma»: the two locales of the same route may share a title (the table
    // of §13.5 gives «Pokédex · PokeAlliance Wiki» for es and en), so the
    // comparison runs inside each language.
    const idioma = localeDeRuta(route) ?? '';
    for (const [mapa, valor, etiqueta] of [
      [porTitulo, pagina.titulo, 'título'],
      [porDescripcion, pagina.descripcion, 'descripción'],
    ]) {
      if (!valor) continue;
      const clave = JSON.stringify([idioma, valor]);
      const anterior = mapa.get(clave);
      if (anterior) problems.push(`${route}: repite el ${etiqueta} de ${anterior}`);
      else mapa.set(clave, route);
    }
  }

  // --- 7. a noindex route may not be in the sitemap.
  const locs = await sitemapLocs(absoluteRoot, todos);
  if (locs === null) {
    if (noindexados.length > 0) {
      process.stdout.write(
        'sin sitemap en el build; la comprobación 7 espera a @astrojs/sitemap\n',
      );
    }
  } else {
    for (const { route, canonica } of noindexados) {
      if (locs.has(canonica) || locs.has(canonica.replace(/\/$/, ''))) {
        problems.push(`${route}: es noindex y está en el sitemap`);
      }
    }
  }

  if (problems.length > 0) {
    for (const problem of problems) process.stderr.write(`${problem}\n`);
    process.stderr.write(`\n${plural(problems.length, 'problema', 'problemas')} de SEO (§13.5)\n`);
    return 1;
  }
  process.stdout.write(
    `seo:check sin problemas (${plural(revisadas, 'ruta revisada', 'rutas revisadas')}, ` +
      `${plural(todos.length, 'archivo', 'archivos')} en ${outputRoot})\n`,
  );
  return 0;
}

// Only run when executed directly; tests import `main`.
if (process.argv[1] && resolve(process.argv[1]) === resolve(ROOT, 'scripts/seo/check-dist.mjs')) {
  process.exitCode = await main();
}

export { SITIO, links, main, metas, revisarPagina, title };
