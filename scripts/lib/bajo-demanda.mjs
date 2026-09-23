// The pages the server renders on demand, rendered for the gates that walk the build output:
// scripts/design/check-dist.mjs (the shared stylesheet of S17) and scripts/perf/check-budgets.mjs
// (§13.6). Those gates read the HTML files of the output, and a page rendered on demand has
// none: the §8.12 404 is what the server function writes for every request that no file and no
// route answers. While only the browser suites visited it, its budgets went unmeasured — a build
// once gave it a stylesheet of 101.130 B of its own, over S17, and no gate failed (D-023).
//
// Each request of `sondasBajoDemanda` (scripts/lib/rutas-migradas.mjs) is answered the way
// `.vercel/output/config.json` answers it on the deployment, which is also how the emulator of
// §14.3 (scripts/test/serve-vercel-output.mjs) serves it to the `prod` project:
//
//   1. the `routes` are walked in order, and `{ "handle": "filesystem" }` gives the file of
//      `static/` that answers the path, when one does (`x/` as `x/index.html`);
//   2. otherwise the first route whose `src` matches and that answers decides: a redirection
//      (a 3xx `status`) or a `dest`, which names the function;
//   3. the function is imported through its `.vc-config.json` (`handler`) and answers
//      `default.fetch(request)`, with the `status` of the route when it carries one.
//
// A request that a file or a redirection answers is not a page rendered on demand, one that no
// route answers is no page at all, and one that answers another status than its `estado` is
// another page: each is reported, and none is measured as if it were the page it stands for.
//
// Node only: the gates of scripts/ import it, and nothing of the site does.

import { readFile, stat } from 'node:fs/promises';
import { dirname, posix, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Web global of Node 22. Reading it from `globalThis` keeps the file valid for a linter whose
// globals for `**/*.mjs` are listed by hand (eslint.config.js), as the emulator does.
const { Request } = globalThis;

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** The Vercel output: the only one that carries the server function. */
const OUTPUT_DIR = resolve(ROOT, '.vercel', 'output');

/** §13.5: `site` of astro.config.mjs, the origin the deployment answers on. */
const SITIO = 'https://pokealliance-codex.vercel.app';

/**
 * @typedef {{ plantilla: string, ruta: string, estado: number }} Sonda
 * @typedef {Sonda & { html: string }} PaginaBajoDemanda
 */

/** A path inside the repository as the gates print it: relative and with `/`. */
function mostrar(path) {
  return relative(ROOT, path).split(sep).join(posix.sep);
}

async function esArchivo(path) {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

/** The file of `static/` that answers a path, as the emulator finds it; null when none does. */
async function archivoEstatico(staticDir, pathname) {
  let decodificada;
  try {
    decodificada = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const relativa = posix.normalize(decodificada).replace(/^\/+/, '');
  const candidatos =
    relativa === '' || decodificada.endsWith('/')
      ? [posix.join(relativa, 'index.html')]
      : [relativa, `${relativa}.html`, posix.join(relativa, 'index.html')];
  for (const candidato of candidatos) {
    const absoluta = resolve(staticDir, candidato);
    if (await esArchivo(absoluta)) return absoluta;
  }
  return null;
}

/**
 * What `config.json` answers a path with: the file of `static/`, a redirection, the function a
 * `dest` names (with the `status` of its route) or nothing.
 *
 * @returns {Promise<
 *   | { tipo: 'archivo', archivo: string }
 *   | { tipo: 'redireccion', estado: number }
 *   | { tipo: 'funcion', nombre: string, estado: number | undefined }
 *   | { tipo: 'ninguna' }
 * >}
 */
async function responder(routes, outputDir, pathname) {
  for (const route of routes) {
    if (route?.handle !== undefined) {
      if (route.handle !== 'filesystem') {
        throw new Error(`config.json tiene la fase «handle: ${route.handle}», que no se emula`);
      }
      const archivo = await archivoEstatico(resolve(outputDir, 'static'), pathname);
      if (archivo !== null) return { tipo: 'archivo', archivo };
      continue;
    }
    if (typeof route?.src !== 'string' || !new RegExp(route.src).test(pathname)) continue;
    if (Number.isInteger(route.status) && route.status >= 300 && route.status < 400) {
      return { tipo: 'redireccion', estado: route.status };
    }
    if (typeof route.dest === 'string') {
      return { tipo: 'funcion', nombre: route.dest.replace(/^\/+/, ''), estado: route.status };
    }
  }
  return { tipo: 'ninguna' };
}

/** Modules of `functions/<name>.func/`, imported once per process. */
const funciones = new Map();

function cargarFuncion(outputDir, nombre) {
  const clave = `${outputDir}|${nombre}`;
  if (!funciones.has(clave)) {
    funciones.set(
      clave,
      (async () => {
        const carpeta = resolve(outputDir, 'functions', `${nombre}.func`);
        const vcConfigPath = resolve(carpeta, '.vc-config.json');
        let vcConfig;
        try {
          vcConfig = JSON.parse(await readFile(vcConfigPath, 'utf8'));
        } catch {
          throw new Error(`«dest: ${nombre}» no nombra ninguna función de functions/`);
        }
        if (typeof vcConfig.handler !== 'string') {
          throw new Error(`${mostrar(vcConfigPath)} no declara «handler»`);
        }
        const modulo = await import(pathToFileURL(resolve(carpeta, vcConfig.handler)).href);
        if (typeof modulo?.default?.fetch !== 'function') {
          throw new Error(`functions/${nombre}.func no exporta «default.fetch(request)»`);
        }
        return modulo;
      })(),
    );
  }
  return funciones.get(clave);
}

/**
 * The templates of `plantillas` that no request of `sondas` stands for: a gate that walks the
 * output would never measure them.
 *
 * @param {string[]} plantillas
 * @param {Sonda[]} sondas
 * @returns {string[]}
 */
export function plantillasSinSonda(plantillas, sondas) {
  const cubiertas = new Set(sondas.map((sonda) => sonda.plantilla));
  return plantillas.filter((plantilla) => !cubiertas.has(plantilla));
}

/**
 * Renders every request of `sondas` through the server function of the output, in their order.
 * `paginas` holds the HTML of each one that answered as the page it stands for; `problemas`,
 * one line for the gate to print per request that did not, and for an output it cannot read.
 *
 * @param {Sonda[]} sondas
 * @param {string} [outputDir] `.vercel/output` of the repository unless a caller names another.
 * @returns {Promise<{ paginas: PaginaBajoDemanda[], problemas: string[] }>}
 */
export async function renderizarBajoDemanda(sondas, outputDir = OUTPUT_DIR) {
  const paginas = [];
  const problemas = [];
  if (sondas.length === 0) return { paginas, problemas };

  const configPath = resolve(outputDir, 'config.json');
  let routes;
  try {
    routes = JSON.parse(await readFile(configPath, 'utf8')).routes;
  } catch (error) {
    problemas.push(`${mostrar(configPath)} no se pudo leer (${error.message}); ejecuta pnpm build`);
    return { paginas, problemas };
  }
  if (!Array.isArray(routes)) {
    problemas.push(`${mostrar(configPath)} no tiene la lista «routes»`);
    return { paginas, problemas };
  }

  for (const sonda of sondas) {
    const etiqueta = `${sonda.ruta} (${sonda.plantilla}, bajo demanda)`;
    try {
      const respuesta = await responder(routes, outputDir, sonda.ruta);
      if (respuesta.tipo === 'archivo') {
        problemas.push(`${etiqueta}: la responde ${mostrar(respuesta.archivo)}, no el servidor`);
        continue;
      }
      if (respuesta.tipo === 'redireccion') {
        problemas.push(`${etiqueta}: config.json la redirige con ${respuesta.estado}`);
        continue;
      }
      if (respuesta.tipo === 'ninguna') {
        problemas.push(`${etiqueta}: ninguna ruta de config.json la responde`);
        continue;
      }
      const modulo = await cargarFuncion(outputDir, respuesta.nombre);
      const response = await modulo.default.fetch(new Request(new URL(sonda.ruta, SITIO)));
      const html = await response.text();
      const estado = respuesta.estado ?? response.status;
      if (estado !== sonda.estado) {
        problemas.push(`${etiqueta}: responde ${estado} y su página responde ${sonda.estado}`);
        continue;
      }
      paginas.push({ ...sonda, html });
    } catch (error) {
      problemas.push(`${etiqueta}: no se pudo renderizar (${error.message})`);
    }
  }
  return { paginas, problemas };
}
