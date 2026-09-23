// The single list of the routes the gates measure (§3.10, §3.11), with the route inventory
// of §8.0.1 and the parity routes of §14.5.
//
// Read by scripts/design/check-dist.mjs, scripts/perf/check-budgets.mjs,
// scripts/seo/check-dist.mjs, tests/e2e/routes.ts, src/lib/nav/groups.ts (WG5 of the menu)
// and the search index (src/pages/[locale]/buscar/indice.json.ts, BU6).
//
// Step 4 of §3.10 (M15) closed the migration: `plantillasMigradas` is `'*'` alone, so every
// gate that walks the output measures every page of it, and `esRutaMigrada` answers true for
// any route. The routes of §8.0.1 stay listed in `plantillasDelSitio`: `esRutaDelSitio` answers
// from it whether the build writes a page (WG5 of the menu, BU6 of the search index), and RZ3
// (tests/e2e/rutas.spec.ts) walks it one route per template. The parity routes are in
// `plantillasParidad`, which only the visual build and the development server carry.
//
// The same module loads in a Node script, in the Vite build (and in Vitest) and in a
// Playwright spec, and in the server functions of the deployed site too: `groups.ts` reads it
// on every page, the ones rendered on demand included, where `content/` does not exist. So no
// static `node:` import and no file read on a path the bundle cannot see. A route with a
// parameter expands to the ids the build writes a page for, so a list of routes names real
// pages and a static sibling of that route (`/{l}/pokedex/tiers/`, M9) is never taken for
// one of them. The ids come from the registries, read two ways:
//
//   - `/{l}/pokedex/{id}/` from the Pokémon registry, `/{l}/items/c/{categoria}/` from
//     `content/items/categorias.json` and `/{l}/actividades/{id}/` from `content/quests.json`,
//     one file each, as a JSON module with its import attribute, which all three load
//     natively;
//   - `/{l}/sistemas/{id}/` from `content/sistemas/`, one file per page (§3.13), which no
//     JSON import can list: under Vite `import.meta.glob` bundles the folder `@content`
//     points at (the board fixtures in the visual build, §14.5), so the answer is the one of
//     the build that loads it and it travels inside the server bundle; plain Node has no
//     `import.meta.glob`, and there the folder is read from disk with the `fs` module that
//     `process.getBuiltinModule` hands over at run time (see `leerSistemas`).
//
// How it grows. A new page needs no entry for the gates: `'*'` already covers it. The
// milestone that adds a route lists its template in `plantillasDelSitio` when the build
// writes its HTML, so the menu and the search index may link it and RZ3 measures it, or in
// `plantillasBajoDemanda` when the server renders it on demand (the §8.12 404 is the only
// one), with the requests the gates measure it at in `sondasBajoDemanda`.
//
// The root `/` is not a route of this module and never will be: it is a 302 of
// `astro.config.mjs` with no HTML (§8.13, T16); tests/e2e/rutas.spec.ts measures it (RZ1) on
// the emulator of §14.3.

import categoriasFile from '../../content/items/categorias.json' with { type: 'json' };
import pokemonFile from '../../content/pokemon.json' with { type: 'json' };
import questsFile from '../../content/quests.json' with { type: 'json' };

/** The entry that turns every gate on for the whole output (§3.10, step 4). */
const TODAS = '*';

const PARIDAD = '/_paridad/';

/** The locale segment of `/{l}/…`; mirrors `locales` of src/i18n/config.ts (§13.1). */
export const idiomas = ['es', 'en'];

/**
 * The routes every gate measures (§3.10, step 4): `'*'`, every page of the output. From M2
 * to M13 this was the list of the routes already moved from AppLayout to PageLayout, so no
 * gate measured a legacy page; M15 deleted AppLayout and left `'*'` as its only entry.
 *
 * @type {string[]}
 */
export const plantillasMigradas = [TODAS];

/**
 * The parity routes of §14.5, as the plan writes them: without `{l}`, which
 * `expandirIdiomas` adds (`/_paridad/marco/` -> `/es/_paridad/marco/`, `/en/_paridad/marco/`).
 * They exist in the visual build and in the development server, never in production: the
 * gates that walk the output never see them (`seo:check` fails if one is there, §13.5), and
 * tests/e2e/routes.ts adds them to the routes the gates of §14.3 visit on the development
 * server.
 *
 * M3 adds two, both served by `src/routes/_paridad/marco.astro`: §5.5 gives a different
 * main column to a page with rail and to one without (896 and 944 at 1440) and V5-1
 * measures the two, so one route cannot answer both. M5 adds `/_paridad/componentes/`
 * (`src/routes/_paridad/componentes.astro`), the controls and content of §7.2 over the board
 * samples of the Componentes board, and M6 `/_paridad/tarjetas/`
 * (`src/routes/_paridad/tarjetas.astro`), the cards, grids, three views and money of the
 * Tarjetas board, which the `tarjetas-paridad` case of tests/visual/manifest.json crops.
 *
 * @type {string[]}
 */
export const plantillasParidad = [
  '/_paridad/marco/',
  '/_paridad/marco-sin-rail/',
  '/_paridad/componentes/',
  '/_paridad/tarjetas/',
];

/**
 * The routes of §8.0.1 that the build writes as HTML, as the plan writes them: `{l}` stands
 * for the locale segment and expands to one route per locale, and any other entry is already
 * a whole route. `esRutaDelSitio` answers from this list whether the build writes a page, so
 * a route listed here that the build does not contain is a dead link in the menu and a problem
 * for RZ3, not a line of output it skips. A page that renders with PageLayout also names its file in
 * the `@source` lines of src/styles/global.css, or the utilities it writes are never
 * generated.
 *
 * M6 adds `/{l}/pokedex/`, the first public route on PageLayout: the prototype of §13.6
 * that closes F1 (`src/pages/[locale]/pokedex/index.astro`, template B, with the list
 * island and the real `DexCard`).
 *
 * M7 adds `/{l}/pokedex/{id}/`, the Pokémon page of §8.3
 * (`src/pages/[locale]/pokedex/[slug].astro`, template C): one HTML per record of
 * `content/pokemon.json` and per locale, 1.820 routes with the registry of today (FI1).
 * A parameter other than `{l}` expands to the values `PARAMETROS` gives that template, so
 * the list stays one of whole routes, the ones the build writes.
 *
 * M8 adds `/{l}/sistemas/`, the systems index of §8.4.1
 * (`src/pages/[locale]/sistemas/index.astro`, template D), and `/{l}/sistemas/{id}/`, the
 * system page of §8.4.2 (`src/pages/[locale]/sistemas/[id].astro`, template C with the first
 * real `Toc`): one HTML per record of `content/sistemas/` the build keeps and per locale.
 *
 * M9 adds three. `/{l}/pokedex/tiers/` is the Tier list of §8.8
 * (`src/pages/[locale]/pokedex/tiers.astro`, template B), a static route that wins over
 * `/{l}/pokedex/{id}/`: it is listed on its own, and `expandirParametros` never writes it
 * as a value of `{id}` because `pnpm content:check` refuses a Pokémon with that id.
 * `/{l}/items/` is «Todo» of §8.5 (`src/pages/[locale]/items/index.astro`, template B) and
 * `/{l}/items/c/{categoria}/` its 13 real categories
 * (`src/pages/[locale]/items/c/[categoria].astro`), one HTML per category of
 * `content/items/categorias.json` that is not the virtual one and per locale — 26 pages
 * with the registry of today.
 *
 * M10 adds two. `/{l}/` is the Inicio of §8.1 (`src/pages/[locale]/index.astro`, template A:
 * HomeIntro, the search trigger, Destacados and the bento), and `/{l}/buscar/` the results
 * page of §8.6 (`src/pages/[locale]/buscar/index.astro`, template B with the `buscar` list
 * island). The search index of that page, `/{l}/buscar/indice.json`, is a file of the build and
 * not a page: `perf:budget` measures it with the route (BU5).
 *
 * M11 adds the six routes of §8 that were left, which closes F2. `/{l}/cambios/` is Cambios
 * (§8.7, template C over `ChangeTimeline`); `/{l}/actividades/` the activities index (§8.9.1,
 * template D) and `/{l}/actividades/{id}/` one page per record of `content/quests.json` and per
 * locale (§8.9.2, template C); `/{l}/herramientas/` the tools index (§8.10, template D); and the
 * two placeholders of template E, both `noindex`: `/{l}/mapa/` (§8.11, R9) and
 * `/{l}/herramientas/pokemon/`, Comparar Pokémon until F5 (§8.14, E18).
 *
 * M12 adds the two routes of Comercio that every build of phase A writes (§9.3):
 * `/{l}/comercio/`, the list of §9.5 (`src/pages/[locale]/comercio/index.astro`, template B),
 * which src/integrations/comercio-fases.ts prerenders in phase A — in production it is the empty
 * state of §9.5.10 alone, «Aún no hay anuncios.» and «Crear anuncio» (CA-9.1) — and
 * `/{l}/comercio/publicar/`, the form of §9.7 (`src/pages/[locale]/comercio/publicar.astro`,
 * template G, `noindex`), which prerenders itself in both phases. The detail and the profile,
 * `/{l}/comercio/anuncio/{id}/` and `/{l}/comercio/vendedor/{handle}/`, are not here: their pages
 * exist only in a build that reads the sample registry (COMERCIO_DEMO), which is never the
 * production output (§9.2, CA-9.1), and their ids are the one thing of that registry this module
 * must never hold, because it travels in the server function of every build (see the head of
 * this file). tests/e2e/comercio.spec.ts visits them on the development server, which runs with
 * COMERCIO_DEMO (§14.3).
 *
 * M13 adds `/{l}/herramientas/guild/` (§10), the last page that rendered with AppLayout. Its
 * account page, `/{l}/cuenta/` (§9.9 without Comercio, §10.4; template H, `noindex`), is not
 * here: the build writes it only with the public Supabase settings (§9.3), and the build CI
 * and the gates read has none.
 *
 * A page rendered on demand has no HTML in the build and belongs in
 * `plantillasBajoDemanda` instead, never here.
 *
 * @type {string[]}
 */
export const plantillasDelSitio = [
  '/{l}/',
  '/{l}/pokedex/',
  '/{l}/pokedex/tiers/',
  '/{l}/pokedex/{id}/',
  '/{l}/sistemas/',
  '/{l}/sistemas/{id}/',
  '/{l}/items/',
  '/{l}/items/c/{categoria}/',
  '/{l}/buscar/',
  '/{l}/cambios/',
  '/{l}/actividades/',
  '/{l}/actividades/{id}/',
  '/{l}/herramientas/',
  '/{l}/mapa/',
  '/{l}/herramientas/pokemon/',
  '/{l}/comercio/',
  '/{l}/comercio/publicar/',
  '/{l}/herramientas/guild/',
];

/**
 * @typedef {{ id: string, borrador?: boolean }} RegistroSistema
 */

/**
 * The records of `content/sistemas/`, one file per system page, named after its `id`
 * (§3.13; `pnpm content:check` and src/lib/content/registry.ts both refuse a file whose `id`
 * is not its name).
 *
 * Under Vite (the Astro build, its development server, Vitest) `import.meta.glob` is compiled
 * into one import per file of the folder the `@content` alias points at, so a record the
 * owner adds is a route with no change here, the visual build lists the board fixtures it
 * renders, and a server function never touches the disk. Plain Node — the gates of
 * scripts/ and the Playwright specs — has no `import.meta.glob`: calling it throws a
 * `TypeError`, and the folder is then read from `content/`, which is what those gates
 * measure (they read the production output, never the visual one).
 *
 * @returns {RegistroSistema[]}
 */
function leerSistemas() {
  try {
    return Object.values(
      import.meta.glob('@content/sistemas/*.json', { eager: true, import: 'default' }),
    );
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
  }
  const fs = globalThis.process.getBuiltinModule('node:fs');
  const carpeta = new URL('../../content/sistemas/', import.meta.url);
  return fs
    .readdirSync(carpeta)
    .filter((archivo) => archivo.endsWith('.json'))
    .sort()
    .map((archivo) => JSON.parse(fs.readFileSync(new URL(archivo, carpeta), 'utf8')));
}

/**
 * `hideDrafts` of src/lib/content/registry.ts, with the same two sources: the `.env` files
 * under Vite (`import.meta.env`) and the environment of the shell or of Vercel. A build with
 * `OCULTAR_BORRADORES=1` writes no page for a draft (§8.0.5, SI4), so a gate must not ask
 * for one.
 *
 * @returns {boolean}
 */
function ocultarBorradores() {
  const valor = String(
    import.meta.env?.OCULTAR_BORRADORES ?? globalThis.process?.env?.OCULTAR_BORRADORES ?? '',
  ).toLowerCase();
  return valor === '1' || valor === 'true';
}

/**
 * The values of each parameter a template of this module carries besides `{l}`, by
 * template.
 *
 * - `/{l}/pokedex/{id}/` is one page per record of `content/pokemon.json` (`getStaticPaths`
 *   of `src/pages/[locale]/pokedex/[slug].astro`, §8.0.1). A Pokémon record has no
 *   `borrador` field (content/schemas/pokemon.schema.json), so `OCULTAR_BORRADORES` never
 *   takes one of these pages out of the build, and `pnpm content:check` refuses the id
 *   `tiers`, the static route that wins over this one.
 * - `/{l}/sistemas/{id}/` is one page per record of `content/sistemas/` that `getSistemas`
 *   keeps (`getStaticPaths` of `src/pages/[locale]/sistemas/[id].astro`): every one of
 *   them, or all but the drafts under `OCULTAR_BORRADORES=1`.
 * - `/{l}/items/c/{categoria}/` is one page per real category of
 *   `content/items/categorias.json` (`getStaticPaths` of
 *   `src/pages/[locale]/items/c/[categoria].astro`, §8.5): the 13 its schema fixes, without
 *   `todo`, the virtual category, whose page is `/{l}/items/` and is a route of its own. A
 *   category has no `borrador` field, so `OCULTAR_BORRADORES=1` never takes one of these
 *   pages out of the build: a category whose items are all drafts still has its page, with
 *   the `EmptyState` of §8.5 (IT2).
 * - `/{l}/actividades/{id}/` is one page per record of `content/quests.json`, in the order of
 *   the file (`getStaticPaths` of `src/pages/[locale]/actividades/[id].astro`, §8.9.2). An
 *   activity has no `borrador` field (content/schemas/quests.schema.json refuses it), so
 *   `OCULTAR_BORRADORES` never takes one of these pages out of the build, and an id that is
 *   not a record has no page and falls to the 404 of §8.12 (NF3). With no activity the list is
 *   empty and expands to no route, as the build writes none (8.9.1, «Sin actividades»).
 *
 * @type {Record<string, Record<string, string[]>>}
 */
const PARAMETROS = {
  '/{l}/pokedex/{id}/': { id: pokemonFile.pokemon.map((record) => record.id) },
  '/{l}/sistemas/{id}/': {
    id: leerSistemas()
      .filter((sistema) => !(ocultarBorradores() && sistema.borrador === true))
      .map((sistema) => sistema.id),
  },
  '/{l}/items/c/{categoria}/': {
    categoria: categoriasFile.categorias
      .filter((categoria) => categoria.virtual !== true)
      .map((categoria) => categoria.id),
  },
  '/{l}/actividades/{id}/': { id: questsFile.misiones.map((record) => record.id) },
};

const PARAMETRO = /\{([a-z]+)\}/g;

/**
 * The route of the on-demand 404 of §8.12, as `.vercel/output/config.json` maps it to
 * `_render`. The two 404 probes of §14.4 (`/es/no-existe/`, `/en/no-existe/`) are paths
 * that match nothing, not routes of §8, so they are measured as soon as this template
 * is migrated.
 */
export const PLANTILLA_404 = '/404/';

/**
 * Migrated routes the server renders on demand, so the build carries no HTML for them.
 * The e2e suites visit them (`esRutaMigrada` covers this list too), and the gates that walk
 * the output measure them at the requests of `sondasBajoDemanda`, which the server function
 * renders for them (scripts/lib/bajo-demanda.mjs).
 *
 * Empty from M2 to M10. M11 adds the §8.12 404 (`src/pages/404.astro`, `prerender = false`)
 * as `PLANTILLA_404`, which turns NF1 on for the `/{l}/no-existe/` probes of §14.4 in
 * tests/e2e/routes.ts. It is declared above this list because a `const` cannot be read before
 * its line runs.
 *
 * @type {string[]}
 */
export const plantillasBajoDemanda = [PLANTILLA_404];

/**
 * The requests that stand for each template of `plantillasBajoDemanda` in the gates that walk
 * the output: `check-dist.mjs` (the shared stylesheet of S17) and `check-budgets.mjs` (every
 * budget of §13.6). scripts/lib/bajo-demanda.mjs answers each one the way
 * `.vercel/output/config.json` routes it, with the server function, and the gate measures that
 * HTML like the file of any other route. `estado` is the status the page answers with. A
 * template of that list with no request here fails both gates: a page rendered on demand has no
 * file for them to read, and without this list it would stay out of §13.6 and S17 unnoticed, as
 * the 404 did while its CSS was one sheet of 101.130 B of its own (D-023).
 *
 * M11: the two 404 probes of §14.4, one per locale — the paths tests/e2e/routes.ts builds with
 * `NOT_FOUND_SLUG`. They match no route of §8.0.1, so the last route of `config.json` sends them
 * to the function with status 404.
 *
 * @type {{ plantilla: string, ruta: string, estado: number }[]}
 */
export const sondasBajoDemanda = idiomas.map((idioma) => ({
  plantilla: PLANTILLA_404,
  ruta: `/${idioma}/no-existe/`,
  estado: 404,
}));

/**
 * `/{l}/pokedex/{id}/` -> `/{l}/pokedex/bulbasaur/`, `/{l}/pokedex/shiny-bulbasaur/`…,
 * one template per value of each parameter other than `{l}`, in the order `PARAMETROS`
 * gives them. A template with no such parameter is returned as it is.
 *
 * A parameter this module has no list of values for throws when the module loads: a route
 * that no gate could name is a list that measures nothing, and that has to fail where it is
 * written, not later as a missing page. An empty list is a registry with no record yet — no
 * published system (§8.4.1, «Estados») — and expands to no route, as the build writes none.
 *
 * @param {string} plantilla
 * @returns {string[]}
 */
function expandirParametros(plantilla) {
  const nombres = [...plantilla.matchAll(PARAMETRO)]
    .map((coincidencia) => coincidencia[1])
    .filter((nombre) => nombre !== 'l');
  if (nombres.length === 0) return [plantilla];
  const valores = PARAMETROS[plantilla];
  let rutas = [plantilla];
  for (const nombre of new Set(nombres)) {
    const lista = valores?.[nombre];
    if (!Array.isArray(lista)) {
      throw new Error(`scripts/lib/rutas-migradas.mjs: no values for {${nombre}} of ${plantilla}`);
    }
    rutas = rutas.flatMap((ruta) => lista.map((valor) => ruta.replaceAll(`{${nombre}}`, valor)));
  }
  return rutas;
}

/**
 * `/{l}/pokedex/` -> `/es/pokedex/`, `/en/pokedex/`. A template without `{l}` is
 * returned unchanged, `'*'` included.
 *
 * One exception: the spec (§14.5) and the plan write a parity route without its locale
 * (`/_paridad/marco/`) while `astro.config.mjs` injects it as
 * `/[locale]/_paridad/<name>/`, so the build contains `/es/_paridad/marco/` and
 * `/en/_paridad/marco/`. Both spellings name the same two routes, so the short one
 * expands per locale as if it carried `{l}`. Without this a milestone that copies the
 * plan's string verbatim would list a route the build does not contain.
 *
 * A parameter other than `{l}` (`/{l}/pokedex/{id}/`) expands first, to one route per
 * value `PARAMETROS` gives that template (see `expandirParametros`).
 *
 * @param {string[]} plantillas
 * @returns {string[]}
 */
export function expandirIdiomas(plantillas) {
  const rutas = [];
  for (const plantilla of plantillas.flatMap(expandirParametros)) {
    if (plantilla.includes('{l}')) {
      for (const idioma of idiomas) rutas.push(plantilla.replaceAll('{l}', idioma));
      continue;
    }
    if (plantilla.startsWith(PARIDAD)) {
      for (const idioma of idiomas) rutas.push(`/${idioma}${plantilla}`);
      continue;
    }
    rutas.push(plantilla);
  }
  return rutas;
}

/**
 * The routes the gates that walk the build measure: `['*']`, every page of the output
 * (§3.10, step 4).
 *
 * @type {string[]}
 */
export const rutasMigradas = expandirIdiomas(plantillasMigradas);

/**
 * The parity routes of `plantillasParidad`, one per locale (`/es/_paridad/marco/`…).
 *
 * @type {string[]}
 */
export const rutasParidad = expandirIdiomas(plantillasParidad);

/**
 * The pages of `plantillasDelSitio`, one per locale and per value of each parameter: every
 * page the build writes, without the drafts that `OCULTAR_BORRADORES=1` hides.
 *
 * @type {string[]}
 */
export const rutasDelSitio = expandirIdiomas(plantillasDelSitio);

/**
 * The migrated routes the server renders on demand, one per locale. No gate that walks
 * the build reads this list; `esRutaMigrada` covers it for the e2e suites.
 *
 * @type {string[]}
 */
export const rutasBajoDemanda = expandirIdiomas(plantillasBajoDemanda);

/**
 * A route as the gates compare it: leading slash, trailing slash, without `index.html`,
 * query or hash. A last segment carrying an extension is a file (`indice.json`) and
 * keeps no trailing slash, the same rule `getAlternatePath` follows in
 * src/i18n/config.ts. A build path (`es\pokedex\index.html`) is accepted too, so a
 * caller that walked the output does not have to convert separators first.
 *
 * @param {string} ruta
 * @returns {string}
 */
export function normalizarRuta(ruta) {
  if (ruta === TODAS) return TODAS;
  const camino = ruta.split('#')[0].split('?')[0].replaceAll('\\', '/');
  const segmentos = camino.split('/').filter((segmento) => segmento.length > 0);
  if (segmentos[segmentos.length - 1] === 'index.html') segmentos.pop();
  if (segmentos.length === 0) return '/';
  const ultimo = segmentos[segmentos.length - 1];
  return `/${segmentos.join('/')}${ultimo.includes('.') ? '' : '/'}`;
}

const MIGRADAS = new Set(rutasMigradas.map(normalizarRuta));
const BAJO_DEMANDA = new Set(rutasBajoDemanda.map(normalizarRuta));
const DEL_SITIO = new Set(rutasDelSitio.map(normalizarRuta));

/**
 * True since step 4 of §3.10 (M15): `'*'` is the list, and the gates cover the whole
 * output.
 *
 * @returns {boolean}
 */
export function todasMigradas() {
  return MIGRADAS.has(TODAS);
}

/**
 * Whether a gate measures this route: any route since M15, when `'*'` became the list
 * (§3.10, step 4).
 *
 * @param {string} ruta
 * @returns {boolean}
 */
export function esRutaMigrada(ruta) {
  const normalizada = normalizarRuta(ruta);
  return todasMigradas() || MIGRADAS.has(normalizada) || BAJO_DEMANDA.has(normalizada);
}

/**
 * WG5 (§8.0.3) and BU6 (§8.6): whether the build writes this page, so a menu entry, a
 * Destacado, a panel of the Inicio or an entry of the search index may link it. `'*'` makes
 * every route a measured one, not a real one, so this answers from `plantillasDelSitio`, with
 * the values the registries give each parameter: an activity id that is no record, or a draft
 * system under `OCULTAR_BORRADORES=1`, has no page and gets no link.
 *
 * @param {string} ruta
 * @returns {boolean}
 */
export function esRutaDelSitio(ruta) {
  return DEL_SITIO.has(normalizarRuta(ruta));
}

/**
 * Whether the server renders this route on demand, so the build carries no HTML for it.
 * A gate that walks the output never reaches one of these: they are not in
 * `rutasMigradas`.
 *
 * @param {string} ruta
 * @returns {boolean}
 */
export function esRutaBajoDemanda(ruta) {
  return BAJO_DEMANDA.has(normalizarRuta(ruta));
}

/**
 * The `/_paridad/` routes exist only in the visual build (`VISUAL=1`), where they
 * compose the boards with the real components (§14.5). They are never deployed, and a
 * gate that reads the production output skips them: `seo:check` fails when one of them
 * is in it (§13.5).
 *
 * The match is on the whole path, not on its start: `astro.config.mjs` injects them as
 * `/[locale]/_paridad/<name>/`, so the built route is `/es/_paridad/marco/`. A
 * `startsWith` here would answer false for exactly the routes this predicate exists to
 * recognise, and both gates would then walk a route that only the visual build
 * contains. tests/visual/compare.ts already matched them this way.
 *
 * @param {string} ruta
 * @returns {boolean}
 */
export function esRutaParidad(ruta) {
  return normalizarRuta(ruta).includes(PARIDAD);
}
