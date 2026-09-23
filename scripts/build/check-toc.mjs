#!/usr/bin/env node
// The build check of §7.11 and §14, over the build output after `pnpm build`. It
// runs in `pnpm ci` right after the build, before the other gates that walk the
// output.
//
// §7.11: «los `items` [del `Toc`] tienen los mismos ids, títulos y orden que los
// `Section` de la página (prueba de build en §14)». §14 repeats it: «una
// comprobación de build compara ids, títulos y orden del `Toc` de cada página con
// sus `Section`». So, per page that carries an index:
//
//   1. The index lists the ids of the page sections, all of them, once each and in
//      the same order.
//   2. Each entry reads exactly like the title of its section.
//   3. The index only exists with two or more sections (§7.11).
//   4. In the HTML the first link carries `aria-current="location"`, and only that
//      one (§7.11; the scroll-spy of scripts/toc-spy.ts moves it afterwards).
//
// Usage:
//   node scripts/build/check-toc.mjs
//
// What counts as the index of a page. DS:PageLayout renders the rail as a sibling
// of `<main>` (`.ac-page-layout__rail`), so the index of a page is an `.ac-toc`
// outside the main column. An `.ac-toc` inside `<main>` is a specimen of a gallery
// page (`/_paridad/componentes/`, M5) with items of its own, not the index of that
// page, and this check leaves it alone.
//
// What counts as a section of a page. A `section.ac-section` of the main column
// that is not inside another one: `Section level={3}` is a section within a
// section (DS:Section) and the `<ol>` of `DS:Toc` is flat, so only the outer ones
// are entries of the index.
//
// Scope. Every page of the output, with no list of routes: a page with neither
// `.ac-toc` nor `.ac-section` is measured as a page with no index and reports
// nothing. The visual build (`VISUAL=1`) also carries `/_paridad/marco/`.

import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, posix, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** The Vercel output is what gets deployed; dist/client is the same tree without the adapter. */
const OUTPUT_ROOTS = ['.vercel/output/static', 'dist/client'];

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

/** «1 sección» / «3 secciones», so the summary line reads like Spanish. */
function plural(n, uno, varios) {
  return `${n} ${n === 1 ? uno : varios}`;
}

/** Whether two lists carry the same values in the same order. */
function mismosEnOrden(a, b) {
  return a.length === b.length && a.every((valor, i) => valor === b[i]);
}

/** `«a», «b»`, the way the problem lines quote an id or a title. */
function lista(valores) {
  return valores.map((valor) => `«${valor}»`).join(', ');
}

/** `es/sistemas/boost/index.html` -> `/es/sistemas/boost/`. */
function htmlToRoute(relativePath) {
  return `/${toPosix(relativePath).replace(/index\.html$/, '')}`;
}

const NOMBRADAS = new Map([
  ['amp', '&'],
  ['lt', '<'],
  ['gt', '>'],
  ['quot', '"'],
  ['apos', "'"],
  ['nbsp', '\u00a0'],
]);

/** The entities Astro and react-dom/server write in text and in attribute values. */
function decode(text) {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entera, cuerpo) => {
    if (cuerpo[0] === '#') {
      const codigo =
        cuerpo[1] === 'x' || cuerpo[1] === 'X'
          ? Number.parseInt(cuerpo.slice(2), 16)
          : Number.parseInt(cuerpo.slice(1), 10);
      return Number.isFinite(codigo) ? String.fromCodePoint(codigo) : entera;
    }
    return NOMBRADAS.get(cuerpo.toLowerCase()) ?? entera;
  });
}

/** The value of an attribute, from a whole tag or from its attribute string alone. */
function attribute(tag, name) {
  const match = new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i').exec(tag);
  return match ? decode(match[1]) : null;
}

function tieneClase(tag, clase) {
  const clases = attribute(tag, 'class');
  return clases ? clases.trim().split(/\s+/).includes(clase) : false;
}

/** Tags out, entities decoded, runs of whitespace collapsed. */
function texto(html) {
  return decode(html.replace(/<[^>]*>/g, ''))
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Comments and the bodies of `<script>` and `<style>` blanked out: they are not page
 * content and they carry angle brackets that would break the tag scan. Every blank
 * keeps the length of what it replaces, so the indexes of the cleaned document are
 * still the indexes of the original one.
 */
function limpiar(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, (comentario) => ' '.repeat(comentario.length))
    .replace(
      /(<(script|style)\b[^>]*>)([\s\S]*?)(<\/\2\s*>)/gi,
      (_entero, apertura, _nombre, cuerpo, cierre) => apertura + ' '.repeat(cuerpo.length) + cierre,
    );
}

/**
 * The inner HTML of the element whose opening tag ends at `finApertura`, counting the
 * nested tags of the same name. Null when the document never closes it.
 */
function cuerpoDe(html, nombre, finApertura) {
  const re = new RegExp(`<(/?)${nombre}(?=[\\s/>])[^>]*>`, 'gi');
  re.lastIndex = finApertura;
  let profundidad = 1;
  let match;
  while ((match = re.exec(html)) !== null) {
    profundidad += match[1] === '/' ? -1 : 1;
    if (profundidad === 0) {
      return { interior: html.slice(finApertura, match.index), tras: re.lastIndex };
    }
  }
  return null;
}

/** The main column of the page, as a span of the document. Null when there is none. */
function columnaPrincipal(html) {
  const re = /<main(?=[\s/>])[^>]*>/gi;
  const match = re.exec(html);
  if (!match) return null;
  const cuerpo = cuerpoDe(html, 'main', re.lastIndex);
  if (!cuerpo) return null;
  return {
    inicio: re.lastIndex,
    fin: re.lastIndex + cuerpo.interior.length,
    interior: cuerpo.interior,
  };
}

/** The h2 or h3 of `.ac-section__head`; DS:Section gives it the id `${id}-t`. */
function tituloDeSeccion(interior) {
  const re = /<(h[1-6])(?=[\s/>])([^>]*)>([\s\S]*?)<\/\1\s*>/gi;
  let match;
  while ((match = re.exec(interior)) !== null) {
    if (tieneClase(match[2], 'ac-section__title')) {
      return { nivel: Number(match[1].slice(1)), texto: texto(match[3]) };
    }
  }
  return null;
}

/**
 * The sections of the main column, in document order: every `section.ac-section` that
 * is not inside another one.
 */
function seccionesDe(interior, push) {
  const out = [];
  const re = /<section(?=[\s/>])[^>]*>/gi;
  let match;
  while ((match = re.exec(interior)) !== null) {
    if (!tieneClase(match[0], 'ac-section')) continue;
    const cuerpo = cuerpoDe(interior, 'section', re.lastIndex);
    if (!cuerpo) {
      push('una `Section` del HTML no se cierra');
      break;
    }
    out.push({
      id: attribute(match[0], 'id'),
      titulo: tituloDeSeccion(cuerpo.interior),
    });
    // A `Section level={3}` lives inside its section and is no entry of the index.
    re.lastIndex = cuerpo.tras;
  }
  return out;
}

/** The entries of one index, in document order. */
function entradasDeToc(interior) {
  const out = [];
  const re = /<a(?=[\s/>])([^>]*)>([\s\S]*?)<\/a\s*>/gi;
  let match;
  while ((match = re.exec(interior)) !== null) {
    if (!tieneClase(match[1], 'ac-toc__link')) continue;
    const href = attribute(match[1], 'href') ?? '';
    out.push({
      href,
      id: href.startsWith('#') ? href.slice(1) : null,
      etiqueta: texto(match[2]),
      actual: (attribute(match[1], 'aria-current') ?? '').toLowerCase() === 'location',
    });
  }
  return out;
}

/** The indexes of a page: the `.ac-toc` outside the main column (see the header). */
function indicesDe(html, columna) {
  const out = [];
  const re = /<aside(?=[\s/>])[^>]*>/gi;
  let match;
  while ((match = re.exec(html)) !== null) {
    if (!tieneClase(match[0], 'ac-toc')) continue;
    const cuerpo = cuerpoDe(html, 'aside', re.lastIndex);
    if (!cuerpo) continue;
    re.lastIndex = cuerpo.tras;
    if (columna && match.index >= columna.inicio && match.index < columna.fin) continue;
    out.push({ entradas: entradasDeToc(cuerpo.interior) });
  }
  return out;
}

/**
 * Checks one page. Pushes its problems and says whether it carried an index and how
 * many of its sections were compared with an entry.
 */
function revisarPagina(route, html, problems) {
  const push = (text) => problems.push(`${route}: ${text}`);
  // A page with no `ac-toc` at all has no index to compare, and the output carries
  // 1.800 pages of the Pokédex: the class is the cheapest way to leave them be.
  if (!html.includes('ac-toc')) return { toc: false, comparadas: 0 };
  const limpio = limpiar(html);
  const columna = columnaPrincipal(limpio);
  const indices = indicesDe(limpio, columna);
  if (indices.length === 0) return { toc: false, comparadas: 0 };
  if (indices.length > 1) {
    push(`${indices.length} Toc fuera de la columna; §7.11 pide uno por página`);
  }

  const entradas = indices[0].entradas;
  if (!columna) {
    push('lleva un Toc y no tiene columna `<main>` con la que compararlo');
    return { toc: true, comparadas: 0 };
  }
  const secciones = seccionesDe(columna.interior, push);

  // --- §7.11: the index only exists with two or more sections.
  if (entradas.length < 2) {
    push(
      `el Toc lista ${plural(entradas.length, 'entrada', 'entradas')}; ` +
        '§7.11 solo lo usa con 2 o más secciones',
    );
  }
  if (secciones.length < 2) {
    push(
      `la página lleva Toc y tiene ${plural(secciones.length, 'Section', 'Section')}; ` +
        '§7.11 solo lo usa con 2 o más secciones',
    );
  }

  const sinId = secciones.filter((seccion) => !seccion.id).length;
  if (sinId > 0) push(`${sinId} Section sin id en la columna; el Toc ancla en el id`);
  const sinTitulo = secciones.filter((seccion) => !seccion.titulo).length;
  if (sinTitulo > 0) push(`${sinTitulo} Section sin título en la columna`);

  const idsSeccion = secciones.map((seccion) => seccion.id ?? '');
  const repetidos = idsSeccion.filter((id, i) => id && idsSeccion.indexOf(id) !== i);
  if (repetidos.length > 0) push(`ids de Section repetidos: ${lista([...new Set(repetidos)])}`);

  const idsToc = entradas.map((entrada) => entrada.id ?? entrada.href);
  const sinAncla = entradas.filter((entrada) => !entrada.id);
  if (sinAncla.length > 0) {
    push(`el Toc enlaza ${lista(sinAncla.map((entrada) => entrada.href))} y §7.11 pide «#id»`);
  }

  // --- ids and order.
  if (!mismosEnOrden(idsToc, idsSeccion)) {
    const mismos = mismosEnOrden([...idsToc].sort(), [...idsSeccion].sort());
    if (mismos) {
      push(`el Toc ordena ${lista(idsToc)} y la columna ${lista(idsSeccion)} (§7.11)`);
    } else {
      const sobran = idsToc.filter((id) => !idsSeccion.includes(id));
      const faltan = idsSeccion.filter((id) => !idsToc.includes(id));
      if (sobran.length > 0) {
        push(
          sobran.length === 1
            ? `el Toc lista ${lista(sobran)} y no es una Section de la página`
            : `el Toc lista ${lista(sobran)} y no son Section de la página`,
        );
      }
      if (faltan.length > 0) {
        push(
          faltan.length === 1
            ? `el Toc no lista ${lista(faltan)}, que es una Section de la página`
            : `el Toc no lista ${lista(faltan)}, que son Section de la página`,
        );
      }
      if (sobran.length === 0 && faltan.length === 0) {
        push(`el Toc lista ${lista(idsToc)} y la columna ${lista(idsSeccion)} (§7.11)`);
      }
    }
  }

  // --- titles, for every id the two sides share.
  const porId = new Map();
  for (const seccion of secciones) {
    if (seccion.id && !porId.has(seccion.id)) porId.set(seccion.id, seccion);
  }
  let comparadas = 0;
  for (const entrada of entradas) {
    const seccion = entrada.id ? porId.get(entrada.id) : undefined;
    if (!seccion || !seccion.titulo) continue;
    comparadas += 1;
    if (entrada.etiqueta !== seccion.titulo.texto) {
      push(
        `«#${entrada.id}»: el Toc dice «${entrada.etiqueta}» y la sección «${seccion.titulo.texto}» (§7.11)`,
      );
    }
  }

  // --- §7.11: in the HTML the first link is the current one.
  const actuales = entradas.filter((entrada) => entrada.actual);
  if (entradas.length > 0) {
    if (actuales.length !== 1) {
      push(
        `${plural(actuales.length, 'enlace', 'enlaces')} con aria-current="location"; ` +
          '§7.11 pide uno en el HTML',
      );
    } else if (!entradas[0].actual) {
      push(
        `aria-current="location" está en «#${actuales[0].id}» y §7.11 lo pone en el primer enlace`,
      );
    }
  }

  return { toc: true, comparadas };
}

/**
 * @param {{ root?: string }} [options] `root` overrides the build output directory;
 * a caller that wants to measure the visual build or a fixture passes it.
 */
async function main(options = {}) {
  const outputRoot = options.root ?? (await findOutputRoot());
  if (!outputRoot) {
    process.stderr.write(`no existe ${OUTPUT_ROOTS.join(' ni ')}; ejecuta pnpm build\n`);
    return 1;
  }
  const absoluteRoot = resolve(ROOT, outputRoot);
  if (!(await exists(absoluteRoot))) {
    process.stderr.write(`no existe ${outputRoot}; ejecuta pnpm build\n`);
    return 1;
  }

  const paginas = (await walk(absoluteRoot))
    .map((file) => toPosix(relative(absoluteRoot, file)))
    .filter((file) => file.endsWith('.html'));

  const problems = [];
  let conToc = 0;
  let comparadas = 0;
  for (const file of paginas) {
    const html = await readFile(resolve(absoluteRoot, file), 'utf8');
    const pagina = revisarPagina(htmlToRoute(file), html, problems);
    if (pagina.toc) conToc += 1;
    comparadas += pagina.comparadas;
  }

  if (problems.length > 0) {
    for (const problem of problems) process.stderr.write(`${problem}\n`);
    process.stderr.write(
      `\n${plural(problems.length, 'problema', 'problemas')} de índice de página (§7.11)\n`,
    );
    return 1;
  }
  process.stdout.write(
    `check-toc sin problemas (${plural(conToc, 'página con Toc', 'páginas con Toc')} ` +
      `de ${plural(paginas.length, 'página', 'páginas')} en ${outputRoot}, ` +
      `${plural(comparadas, 'sección comparada', 'secciones comparadas')})\n`,
  );
  return 0;
}

// Only run when executed directly; a test imports `main`.
if (process.argv[1] && resolve(process.argv[1]) === resolve(ROOT, 'scripts/build/check-toc.mjs')) {
  process.exitCode = await main();
}

export { entradasDeToc, indicesDe, main, revisarPagina, seccionesDe, texto };
