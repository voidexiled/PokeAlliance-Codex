// @ts-check
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel';

import { comercioFases } from './src/integrations/comercio-fases.ts';

// The visual build of spec 14.5. `VISUAL` exists only there: it swaps the
// registries for the board fixtures, injects the parity routes, marks every
// page `noindex` and turns Comercio's demo switch on. A production build never
// sees it, so none of this reaches the deployed site.
const isVisualBuild = process.env.VISUAL === '1';

// Spec 13.5: the origin of every canonical URL, of the hreflang links and of the sitemap.
// scripts/seo/check-dist.mjs carries the same string and compares both.
const SITE = 'https://pokealliance-codex.vercel.app';

// The registries the site reads are resolved through the `@content` alias so a
// build can point them somewhere else without touching a single import. The
// visual build (VISUAL=1) swaps in the board fixtures of tests/visual/content/.
const contentDir = isVisualBuild ? './tests/visual/content' : './content';
const contentRoot = fileURLToPath(new URL(contentDir, import.meta.url)).replace(/[\\/]$/, '');

// The JSON Schemas never move with the data. Spec 14.5 requires the visual build
// to validate the board fixtures "con los mismos esquemas", so `@content/schemas`
// stays on the real content/schemas/ even under VISUAL=1. Vite and TypeScript both
// pick the longer, more specific prefix, so this entry has to come first below.
const schemasRoot = fileURLToPath(new URL('./content/schemas', import.meta.url)).replace(
  /[\\/]$/,
  '',
);

// Spec 3.13: VISUAL implies COMERCIO_DEMO, and point 2 of 14.5 makes Comercio
// read tests/visual/fixtures/comercio.json instead of content/comercio/*. Both
// travel as environment variables, like OCULTAR_BORRADORES and COMERCIO_PUBLICO,
// so the phase A registry reads them with the same helper in the build and on
// the server. `COMERCIO_FIXTURE` is the absolute path of the fixture file.
if (isVisualBuild) {
  process.env.COMERCIO_DEMO = '1';
  process.env.COMERCIO_FIXTURE = fileURLToPath(
    new URL('./tests/visual/fixtures/comercio.json', import.meta.url),
  );
}

const parityDir = new URL('./src/routes/_paridad/', import.meta.url);

/**
 * Parity routes that one file serves under more than one name. `marco.astro` is the
 * frame of M3 and answers two of them, because 5.5 gives a different main column to a
 * page with rail (896 at 1440) and to one without (944), and V5-1 measures both; the
 * page picks its rail from `Astro.url.pathname`.
 *
 * Key: the file, without extension. Value: the extra route names beside its own.
 *
 * @type {Record<string, string[]>}
 */
const PARITY_ALIASES = {
  marco: ['marco-sin-rail'],
};

/**
 * The parity routes of 14.5 live in src/routes/, outside src/pages/, so the
 * production build never publishes them (seo:check fails if it does). The
 * visual build injects every page found in src/routes/_paridad/ as
 * `/[locale]/_paridad/<name>/`, so a later milestone only has to drop its file
 * in that folder for the route to exist.
 *
 * @returns {import('astro').InjectedRoute[]}
 */
function parityRoutes() {
  const dir = fileURLToPath(parityDir);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((entry) => entry.endsWith('.astro'))
    .sort()
    .flatMap((entry) => {
      const name = basename(entry, '.astro');
      const entrypoint = new URL(entry, parityDir);
      return [name, ...(PARITY_ALIASES[name] ?? [])].map((route) => ({
        pattern: `/[locale]/_paridad/${route}`,
        entrypoint,
        prerender: true,
      }));
    });
}

const NOINDEX_MODULE_ID = 'virtual:ac-visual-noindex';
const NOINDEX_RESOLVED_ID = '\0' + NOINDEX_MODULE_ID;

// Point 4 of 14.5: every page of the visual build is `noindex`. The tag is added
// to the rendered HTML rather than to a layout so it also covers the routes a
// milestone has not migrated yet, and so it cannot leak into production: the
// middleware is only registered when VISUAL=1. A page that already declares a
// robots tag keeps its own.
const NOINDEX_MIDDLEWARE = `
export const onRequest = async (context, next) => {
  const response = await next();
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('text/html')) return response;

  const html = await response.text();
  const tagged = /<meta\\s[^>]*name=["']robots["']/i.test(html)
    ? html
    : html.replace(/<head(\\s[^>]*)?>/i, (head) => head + '<meta name="robots" content="noindex">');

  const headers = new Headers(response.headers);
  headers.delete('content-length');
  return new Response(tagged, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};
`;

/**
 * Serves the noindex middleware as a virtual module so the visual build needs
 * no source file of its own.
 */
function visualNoindexModule() {
  return {
    name: 'alliance-codex:visual-noindex',
    /** @param {string} id */
    resolveId(id) {
      return id === NOINDEX_MODULE_ID ? NOINDEX_RESOLVED_ID : null;
    },
    /** @param {string} id */
    load(id) {
      return id === NOINDEX_RESOLVED_ID ? NOINDEX_MIDDLEWARE : null;
    },
  };
}

const MONEY_SPRITES_MODULE_ID = 'virtual:ac-money-sprites';
const MONEY_SPRITES_RESOLVED_ID = '\0' + MONEY_SPRITES_MODULE_ID;

/** The fixed keys the money components draw before every amount (7.8, S8). */
const MONEY_SPRITE_KEYS = ['ui/pokedolares', 'ui/diamond'];

const spriteRegistryFile = fileURLToPath(new URL('./public/sprites/sprites.json', import.meta.url));

/**
 * `PokedolaresAmount` and `DiamondsAmount` resolve their sprite on their own (DP2), and
 * they render inside islands: the game tooltip of every card reaches them. Importing
 * src/lib/sprites/registry.ts there would put the whole registry in the first load of
 * every list (D-015, 13.6). This module is the registry cut down in the build to the two
 * entries they read, with the same shape, so `spriteOrNull` treats it as the registry: a
 * key the owner has not added yet is simply absent and answers `null`. The file is
 * watched, so an edit of the registry reaches the development server.
 */
function moneySpritesModule() {
  return {
    name: 'alliance-codex:money-sprites',
    /** @param {string} id */
    resolveId(id) {
      return id === MONEY_SPRITES_MODULE_ID ? MONEY_SPRITES_RESOLVED_ID : null;
    },
    /**
     * @this {{ addWatchFile: (file: string) => void }}
     * @param {string} id
     */
    load(id) {
      if (id !== MONEY_SPRITES_RESOLVED_ID) return null;
      this.addWatchFile(spriteRegistryFile);
      const { sprites } = JSON.parse(
        readFileSync(spriteRegistryFile, 'utf8').replace(/^\uFEFF/, ''),
      );
      const entries = MONEY_SPRITE_KEYS.filter((key) => Object.hasOwn(sprites, key)).map((key) => [
        key,
        sprites[key],
      ]);
      return `export default ${JSON.stringify(Object.fromEntries(entries))};`;
    },
  };
}

/**
 * Spec 13.6: the initial JS of the list pages (110 KB) and of the content pages (90 KB), with the
 * list kit in one chunk, as D-018 to D-021 measured it. Every list island draws its first page
 * with the same modules — the list controller, the frame of `EntityList`, the card kit, the game
 * layer and the amounts — and while those islands were the only entries to reach them, automatic
 * chunking kept them together, because it gives one chunk to the modules one set of entries
 * reaches. M12 brought entries that reach a part of them: the publish form of Comercio draws
 * sprites, glyphs and a `ToggleGroup`, its lazy preview a `ListingCard`. Each new set of entries
 * became a chunk of its own, nine chunks where there were two, and every list page gained 3.5 to
 * 3.9 KB gzip (Buscar at 111.0 KB of 110). The two groups of `CLIENT_CHUNKS` put them back:
 *
 * - `list-kit`: the modules below and what only they import (the lucide icon behind `Glyph`, the
 *   money sprites of `virtual:ac-money-sprites`), in one chunk that an entry reaching any of them
 *   loads whole. The list pages need all of it. The publish form of Comercio loads it whole too,
 *   within its 140 KB, and its preview finds it loaded.
 * - `shared`: what the kit shares with the islands of every page — React and its JSX runtime, the
 *   preload helper of the dynamic imports, `normalize` and the dictionary helpers — taken first
 *   (higher priority), so the kit never pulls them in: the search palette of every page imports
 *   them, and through them it would load the whole kit (content pages at 97.9 KB of 90). Every
 *   page loads all of them anyway, so one chunk is also one request instead of five.
 *
 * `pnpm perf:budget` measures the result on every page. A module of this list that moves or is
 * renamed fails the build here instead of falling back to automatic chunking in silence. A module
 * the kit starts to import that the content pages also load has to join `shared`, or those pages
 * pick up the whole kit and fail their 90 KB.
 */
const LIST_KIT_MODULES = [
  'src/components/lists/useListState.ts',
  'src/components/lists/EntityList.tsx',
  'src/lib/lists/state.ts',
  'src/components/controls/Pagination.tsx',
  'src/components/controls/ViewToggle.tsx',
  'src/components/controls/ToggleGroup.tsx',
  'src/components/content/EmptyState.tsx',
  'src/components/content/Count.tsx',
  'src/components/cards/CardGrid.tsx',
  'src/components/cards/Card.tsx',
  'src/components/cards/FactList.tsx',
  'src/lib/cards/layout.ts',
  'src/components/game/Sprite.tsx',
  'src/components/game/ShinyMark.tsx',
  'src/components/game/SpriteStage.tsx',
  'src/components/game/ElementChip.tsx',
  'src/components/game/GameTooltip.tsx',
  'src/components/game/NestedEntity.tsx',
  'src/lib/sprites/resolve.ts',
  'src/components/money/PokedolaresAmount.tsx',
  'src/components/money/DiamondsAmount.tsx',
  'src/components/money/PriceOptions.tsx',
  'src/components/money/TrainingMeter.tsx',
  'src/components/money/PlusN.tsx',
  'src/components/icons/Glyph.tsx',
  'src/lib/format/numbers.ts',
  'src/lib/format/unknown.ts',
];

for (const module of LIST_KIT_MODULES) {
  if (!existsSync(new URL(`./${module}`, import.meta.url))) {
    throw new Error(
      `astro.config.mjs: ${module} is in LIST_KIT_MODULES and does not exist; ` +
        'update the list of the list-kit chunk (spec 13.6).',
    );
  }
}

/** The modules of `shared` that are files of this repository. */
const SHARED_MODULES = ['src/lib/search/normalize.ts', 'src/i18n/messages/types.ts'];

/** A module id with `/` on every system; Rolldown hands them as the file system writes them. */
const posixId = (/** @type {string} */ id) => id.replaceAll('\\', '/');

/** @param {string} id */
function inSharedChunk(id) {
  const path = posixId(id);
  return (
    /\/node_modules\/react\//.test(path) ||
    path.includes('vite/preload-helper') ||
    SHARED_MODULES.some((module) => path.endsWith(`/${module}`))
  );
}

/** @param {string} id */
function inListKit(id) {
  const path = posixId(id);
  return (
    path.includes(MONEY_SPRITES_MODULE_ID) ||
    LIST_KIT_MODULES.some((module) => path.endsWith(`/${module}`))
  );
}

/** The client chunks of spec 13.6 (see `LIST_KIT_MODULES`): `shared` first, then `list-kit`. */
const CLIENT_CHUNKS = [
  { name: 'shared', test: inSharedChunk, priority: 2 },
  { name: 'list-kit', test: inListKit, priority: 1 },
];

/**
 * The parity routes and, in the visual build alone, the noindex tag.
 *
 * `VISUAL=1` is what 14.5 asks for, and the development server needs the same routes:
 * the `desktop`, `mobile` and `reduced-motion` projects of 14.3 run against
 * `astro dev` with no such variable, and tests/e2e/frame.spec.ts measures the frame at
 * `/{l}/_paridad/marco/`. Without this the whole S1 gate would measure a 404.
 *
 * A production build (`command === 'build'` without VISUAL) injects nothing, which is
 * what keeps `/_paridad/` out of the deployed output; `seo:check` checks it.
 *
 * @returns {import('astro').AstroIntegration}
 */
function parityBuild() {
  return {
    name: 'alliance-codex:paridad',
    hooks: {
      'astro:config:setup': ({ command, injectRoute, addMiddleware }) => {
        if (!isVisualBuild && command !== 'dev') return;
        for (const route of parityRoutes()) injectRoute(route);
        // The middleware is served by a Vite plugin that only the visual build loads.
        if (isVisualBuild) addMiddleware({ order: 'post', entrypoint: NOINDEX_MODULE_ID });
      },
    },
  };
}

/** The locales every `[locale]` route is generated for (src/i18n/config.ts, spec 8.0.1). */
const LOCALES = ['es', 'en'];

/** The default locale (spec 13.1): `es`, the first of `locales` in src/i18n/config.ts. */
const [DEFAULT_LOCALE] = LOCALES;

/**
 * Spec 8.0.1: the retired routes and where they go, `{l}` standing for each locale. All of
 * them are 302, temporary, because the old route may come back with other content, and they
 * answer with and without the trailing slash, with no page in between.
 */
const RETIRED_ROUTES = [
  // A1, R-03: «Aportar al mapa» had no channel to send anything; the map is the
  // placeholder of 8.11.
  { from: '/{l}/mapa/aportar', to: '/{l}/mapa/' },
  // E1, R15: the tiers live in the Tier list of 8.8.
  { from: '/{l}/rotaciones', to: '/{l}/pokedex/tiers/' },
  // E2, A7: the quests live in Actividades (8.9); `/guias/` comes back with the first
  // editorial guide (15).
  { from: '/{l}/guias', to: '/{l}/actividades/' },
];

/**
 * The `redirects` of the config: the root, then one key per locale for each retired route.
 *
 * The root (8.13, T16, R-01) answers 302 towards the Inicio of the default locale from
 * here, not from a page: the prerendered `Astro.redirect` of the old `src/pages/index.astro`
 * wrote an HTML with a meta refresh, and the build now carries no HTML for `/` (RZ1).
 *
 * A retired route takes one key per locale. A `[locale]` key would not work: its
 * destination, `/[locale]/pokedex/tiers/`, ends in the canonical trailing slash (13.5) and
 * so is not a route key, and @astrojs/vercel 11.0.10 writes such a destination into
 * `Location` as it reads, brackets included.
 *
 * @type {Record<string, { status: 302; destination: string }>}
 */
const REDIRECTS = {
  '/': { status: /** @type {const} */ (302), destination: `/${DEFAULT_LOCALE}/` },
  ...Object.fromEntries(
    LOCALES.flatMap((locale) =>
      RETIRED_ROUTES.map(({ from, to }) => [
        from.replaceAll('{l}', locale),
        { status: /** @type {const} */ (302), destination: to.replaceAll('{l}', locale) },
      ]),
    ),
  ),
};

/**
 * Spec 13.5, 8.11, 8.14 and 9.3: the prerendered `noindex` pages with a route of their own, `{l}`
 * standing for each locale: the placeholders of the map and of Comparar Pokémon while they are
 * placeholders (MP3, CP1), and the publish page of Comercio. A noindex page never goes in the
 * sitemap (scripts/seo/check-dist.mjs, rule 7); the 404 of 8.12 is rendered on demand and never
 * reaches it, and the parity routes are filtered below on their own.
 */
const NOINDEX_ROUTES = new Set(
  [
    '/{l}/mapa/',
    '/{l}/herramientas/pokemon/',
    '/{l}/comercio/publicar/',
    // Prerendered only with COMERCIO_PUBLICO or the public Supabase settings (9.3, 9.16.3).
    '/{l}/comercio/operaciones/',
    '/{l}/cuenta/',
    '/{l}/cuenta/perfil/',
  ].flatMap((route) => LOCALES.map((locale) => route.replaceAll('{l}', locale))),
);

/**
 * Spec 9.3: the `noindex` pages with one route per record, by their folder — the detail of a
 * Comercio listing and the profile of a seller. Only a build that reads the sample registry
 * (COMERCIO_DEMO) writes them in phase A; a production build has none (CA-9.1), and phase B
 * renders them on demand, which the sitemap never lists.
 */
const NOINDEX_FOLDERS = ['/{l}/comercio/anuncio/', '/{l}/comercio/vendedor/'].flatMap((folder) =>
  LOCALES.map((locale) => folder.replaceAll('{l}', locale)),
);

/**
 * Whether a page of the sitemap is indexable: not a parity route and not a `noindex` page.
 *
 * @param {string} page The absolute URL @astrojs/sitemap passes.
 */
function inSitemap(page) {
  const { pathname } = new URL(page);
  return (
    !pathname.includes('/_paridad/') &&
    !NOINDEX_ROUTES.has(pathname) &&
    !NOINDEX_FOLDERS.some((folder) => pathname.startsWith(folder))
  );
}

/**
 * The redirection of a request path, with or without its trailing slash.
 *
 * @param {string} pathname
 */
function redirectFor(pathname) {
  const path = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname;
  return Object.hasOwn(REDIRECTS, path) ? REDIRECTS[path] : undefined;
}

/**
 * Makes every entry of `REDIRECTS` answer its 302 for both forms of the path. Astro and
 * the adapter alone do not:
 *
 * - @astrojs/vercel writes each one as a route of `.vercel/output/config.json` whose `src`
 *   ends at the last segment (`^/es/rotaciones$`). The path with its slash misses it,
 *   falls through to the function and Astro answers there with a 301: it keeps the
 *   configured status only when the destination is a route of the project
 *   (`computeRedirectStatus`, astro/dist/core/redirects/render.js). After the adapter
 *   writes the file (Astro puts the adapter first among the integrations), this gives
 *   each of those routes an optional trailing slash, and fails the build if one is not
 *   there as expected, with its status and its `Location`, so an adapter update cannot
 *   turn them back into 301 unnoticed. The root has a single form, `^/$`: it is checked
 *   and left as the adapter writes it.
 * - The development server answers them through that same Astro code, with 301 too; a
 *   middleware answers them first, with the configured 302.
 *
 * @returns {import('astro').AstroIntegration}
 */
function redirects302() {
  /** @type {URL | undefined} */
  let vercelConfig;
  return {
    name: 'alliance-codex:redirects-302',
    hooks: {
      'astro:config:done': ({ config }) => {
        vercelConfig = new URL('./.vercel/output/config.json', config.root);
      },
      'astro:server:setup': ({ server }) => {
        server.middlewares.use((request, response, next) => {
          const redirect = redirectFor(new URL(request.url ?? '/', 'http://localhost').pathname);
          if (!redirect) {
            next();
            return;
          }
          response.writeHead(redirect.status, { Location: redirect.destination });
          response.end();
        });
      },
      'astro:build:done': async () => {
        if (!vercelConfig || !existsSync(vercelConfig)) {
          throw new Error(
            'redirects302: @astrojs/vercel did not write .vercel/output/config.json.',
          );
        }
        /**
         * @type {{ routes: Array<{ src?: string, status?: number, headers?: Record<string, string> }> }}
         */
        const output = JSON.parse(await readFile(vercelConfig, 'utf8'));
        for (const [from, { status, destination }] of Object.entries(REDIRECTS)) {
          const route = output.routes.find(
            (candidate) =>
              candidate.src === `^${from}$` &&
              candidate.status === status &&
              candidate.headers?.Location === destination,
          );
          if (!route) {
            throw new Error(
              `redirects302: .vercel/output/config.json has no route «^${from}$» answering ` +
                `${status} towards ${destination}; the adapter changed how it writes the redirects.`,
            );
          }
          // The root has a single form; every other path answers with and without its slash.
          if (from !== '/') route.src = `^${from}/?$`;
        }
        // The same serialisation as the adapter's writeJson.
        await writeFile(vercelConfig, JSON.stringify(output, null, '\t'), 'utf8');
      },
    },
  };
}

export default defineConfig({
  site: SITE,
  output: 'server',
  adapter: vercel(),
  // Spec 8.0.1, 8.13 and 3.13: the 302 of the root and of the retired routes, declared here
  // with no page in between. The 404 of 8.12 (`src/pages/404.astro`) is the one page rendered
  // on demand: it declares `prerender = false` itself, so @astrojs/vercel sends every path
  // that no file and no route answers to the server function with status 404.
  redirects: REDIRECTS,
  integrations: [
    parityBuild(),
    redirects302(),
    // Spec 13.5: one sitemap per locale group, excluding the noindex routes. The parity
    // routes only exist with VISUAL=1, and they are noindex, so they never belong in it; the
    // placeholders of the map and of Comparar Pokémon and the publish, detail and profile pages
    // of Comercio are noindex too (`inSitemap`).
    sitemap({
      i18n: { defaultLocale: 'es', locales: { es: 'es', en: 'en' } },
      filter: inSitemap,
    }),
    // Spec 9.3: the render mode of the Comercio pages by phase (COMERCIO_PUBLICO), the build
    // failing on a Comercio page that exports `prerender`, and `/{l}/comercio/datos.json` with
    // the sample registry of phase A (COMERCIO_DEMO). Registered before the renderer, as §9.3
    // and the plan (M12) ask.
    comercioFases(),
    react(),
  ],
  // Spec 6.1: native document navigation, no view transitions. Only a link that asks for
  // it (`data-astro-prefetch`: the sidebar and the entity lists) is prefetched, on hover.
  prefetch: { prefetchAll: false, defaultStrategy: 'hover' },
  // Spec 14.3: axe must not audit Astro's own toolbar.
  devToolbar: { enabled: false },
  vite: {
    plugins: isVisualBuild
      ? [tailwindcss(), moneySpritesModule(), visualNoindexModule()]
      : [tailwindcss(), moneySpritesModule()],
    resolve: {
      alias: {
        '@content/schemas': schemasRoot,
        '@content': contentRoot,
      },
    },
    // Spec 13.6 and S17 on the 404 of 8.12, the one page rendered on demand. Astro bundles the
    // pages rendered on demand in an environment of their own (`ssr`), apart from the
    // prerendered ones, and with a single page there every stylesheet the 404 reaches — the
    // shared sheet of PageLayout included — went into one `404.*.css` of 101,130 B that no other
    // page shares. This group gives the shared sheet a chunk of its own in that environment too,
    // named as its prerendered chunk is (`PageLayout`), so the 404 links the same
    // `PageLayout.*.css` every other page loads, cached and within S17, and keeps only its own
    // few rules, which Astro inlines. The test names `src/styles/global.css` alone, the one
    // stylesheet PageLayout imports (3.6, design:check rule 8).
    environments: {
      // Spec 13.6: the list kit in one chunk, fenced off from what every page loads
      // (`CLIENT_CHUNKS`, `LIST_KIT_MODULES`).
      client: {
        build: {
          rolldownOptions: {
            output: {
              codeSplitting: { groups: CLIENT_CHUNKS },
            },
          },
        },
      },
      ssr: {
        build: {
          rolldownOptions: {
            output: {
              codeSplitting: {
                groups: [{ name: 'PageLayout', test: /[\\/]src[\\/]styles[\\/]global\.css$/ }],
              },
            },
          },
        },
      },
    },
    // The dev server must not watch the build output (thousands of files rewritten by
    // every build) or the local client files, whose lstat errors crash the watcher.
    server: {
      watch: {
        ignored: ['**/.vercel/**', '**/dist/**', '**/research-inbox/**', '**/playwright-report/**'],
      },
    },
  },
});
