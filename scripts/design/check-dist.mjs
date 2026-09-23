#!/usr/bin/env node
// The two checks §3.11 runs over the build output, after `pnpm build`.
//
//   1. Every page links the site stylesheet exactly once, and that
//      stylesheet measures 100.000 B or less uncompressed (S17). The site
//      stylesheet is the one global.css builds, which PageLayout links on every
//      page: the sheet the most pages link. Any other same-origin sheet
//      of a page is a per-page sheet (§13.6, D-018): the CSS of one page family
//      that its page or components import so it never reaches the shared sheet;
//      `pnpm perf:budget` adds it to the 30 KB gzip of that page.
//   2. No .html, .css or .js of the output names fonts.googleapis.com or
//      fonts.gstatic.com: Poppins is self-hosted (§3.9, X8).
//
// Usage:
//   node scripts/design/check-dist.mjs
//
// Scope. Both checks cover the whole output (§3.11): step 4 of §3.10 (M15) closed the
// migration, and with it the list of routes check 1 was limited to.
//
// Check 1 also visits the pages rendered on demand, which have no file in the
// output: the §8.12 404, at the requests of `sondasBajoDemanda` in the same module,
// rendered through the server function of `.vercel/output` by
// scripts/lib/bajo-demanda.mjs. They are built apart from the prerendered pages
// (D-023), so their link to the site stylesheet is the one a bundler change can
// break without touching any other page.

import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, posix, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { plantillasSinSonda, renderizarBajoDemanda } from '../lib/bajo-demanda.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Astro writes here; with the Vercel adapter the same files land in .vercel/output/static. */
const OUTPUT_ROOTS = ['dist/client', '.vercel/output/static'];

/** S17: the single site stylesheet, uncompressed. */
const STYLESHEET_BUDGET = 100_000;

const GOOGLE_FONTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
const SCANNED_FOR_FONTS = ['.html', '.css', '.js'];

/**
 * The pages rendered on demand, at the requests of `sondasBajoDemanda`, with the problems of
 * rendering them. A list this gate cannot read is a problem and not an empty list: an empty
 * one would leave the 404 out of check 1 with no line to show for it.
 *
 * @param {{ sondas?: { plantilla: string, ruta: string, estado: number }[] }} options
 * @returns {Promise<{ paginas: { plantilla: string, ruta: string, html: string }[], problemas: string[] }>}
 */
async function onDemandPages(options) {
  if (options.sondas !== undefined) return renderizarBajoDemanda(options.sondas);
  let module;
  try {
    module = await import(pathToFileURL(resolve(ROOT, 'scripts/lib/rutas-migradas.mjs')).href);
  } catch (error) {
    return {
      paginas: [],
      problemas: [`scripts/lib/rutas-migradas.mjs no se pudo leer: ${error.message}`],
    };
  }
  if (!Array.isArray(module.sondasBajoDemanda) || !Array.isArray(module.plantillasBajoDemanda)) {
    return {
      paginas: [],
      problemas: [
        'scripts/lib/rutas-migradas.mjs no exporta `plantillasBajoDemanda` y `sondasBajoDemanda` como listas',
      ],
    };
  }
  const sinSonda = plantillasSinSonda(module.plantillasBajoDemanda, module.sondasBajoDemanda).map(
    (plantilla) =>
      `${plantilla}: plantilla bajo demanda sin petición en \`sondasBajoDemanda\` ` +
      '(scripts/lib/rutas-migradas.mjs); ninguna compuerta la mide',
  );
  const renderizadas = await renderizarBajoDemanda(module.sondasBajoDemanda);
  return {
    paginas: renderizadas.paginas,
    problemas: [...sinSonda, ...renderizadas.problemas],
  };
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

/**
 * @param {{
 *   sondas?: { plantilla: string, ruta: string, estado: number }[],
 * }} [options] `sondas` overrides `sondasBajoDemanda` of scripts/lib/rutas-migradas.mjs.
 */
async function main(options = {}) {
  const outputRoot = await findOutputRoot();
  if (!outputRoot) {
    process.stderr.write(`no existe ${OUTPUT_ROOTS.join(' ni ')}; ejecuta pnpm build\n`);
    return 1;
  }
  const absoluteRoot = resolve(ROOT, outputRoot);
  const files = await walk(absoluteRoot);
  const problems = [];

  // --- 1. one site stylesheet per page, within the S17 budget.
  const htmlFiles = files.filter((file) => file.endsWith('.html'));

  const pages = [];
  for (const file of htmlFiles) {
    pages.push({
      page: toPosix(relative(ROOT, file)),
      hrefs: stylesheetHrefs(await readFile(file, 'utf8')),
    });
  }
  const onDemand = await onDemandPages(options);
  problems.push(...onDemand.problemas);
  for (const { plantilla, ruta, html } of onDemand.paginas) {
    pages.push({ page: `${ruta} (${plantilla}, bajo demanda)`, hrefs: stylesheetHrefs(html) });
  }
  const sheetPath = (href) => resolve(absoluteRoot, href.replace(/^\/+/, ''));
  const sizeOf = async (href) =>
    (await exists(sheetPath(href))) ? (await stat(sheetPath(href))).size : -1;

  // The site stylesheet: the sheet linked by the most pages, the larger one on a tie.
  const linkedBy = new Map();
  for (const { hrefs } of pages) {
    for (const href of new Set(hrefs)) linkedBy.set(href, (linkedBy.get(href) ?? 0) + 1);
  }
  let siteSheet = null;
  for (const [href, count] of linkedBy) {
    const best = siteSheet === null ? -1 : linkedBy.get(siteSheet);
    if (count > best || (count === best && (await sizeOf(href)) > (await sizeOf(siteSheet)))) {
      siteSheet = href;
    }
  }

  for (const { page, hrefs } of pages) {
    const links = hrefs.filter((href) => href === siteSheet).length;
    if (links !== 1) {
      problems.push(`${page}: enlaza la hoja del sitio ${links} veces; §3.6 pide una`);
    }
    for (const href of new Set(hrefs)) {
      if (!(await exists(sheetPath(href)))) {
        problems.push(`${page}: la hoja «${href}» no está en el build`);
      }
    }
  }
  if (siteSheet !== null && (await exists(sheetPath(siteSheet)))) {
    const size = await sizeOf(siteSheet);
    if (size > STYLESHEET_BUDGET) {
      const path = toPosix(relative(ROOT, sheetPath(siteSheet)));
      problems.push(`${path}: ${size} B; el presupuesto de S17 es ${STYLESHEET_BUDGET} B`);
    }
  }

  // --- 2. no Google Fonts anywhere in the output (§3.9, X8).
  for (const file of files) {
    if (!SCANNED_FOR_FONTS.some((extension) => file.endsWith(extension))) continue;
    const contents = await readFile(file, 'utf8');
    for (const host of GOOGLE_FONTS) {
      if (contents.includes(host)) {
        problems.push(`${toPosix(relative(ROOT, file))}: contiene ${host}; Poppins se autoaloja`);
      }
    }
  }

  if (problems.length > 0) {
    for (const problem of problems) process.stderr.write(`${problem}\n`);
    process.stderr.write(`\n${problems.length} problemas en ${outputRoot}\n`);
    return 1;
  }
  const measured = `${htmlFiles.length} páginas`;
  const onDemandMeasured =
    onDemand.paginas.length === 0
      ? ''
      : ` y ${onDemand.paginas.length} ${onDemand.paginas.length === 1 ? 'página' : 'páginas'} bajo demanda`;
  process.stdout.write(
    `check-dist sin problemas (${measured}${onDemandMeasured}, ${files.length} archivos)\n`,
  );
  return 0;
}

// Only run when executed directly; tests import `main`.
if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(ROOT, 'scripts/design/check-dist.mjs')
) {
  process.exitCode = await main();
}

export { main, stylesheetHrefs };
