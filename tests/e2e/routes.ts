// The §14.4 test-route list, read from the production build instead of being written
// by hand, so it grows with the site and never goes stale.
//
// Where the routes come from. Every prerendered page of the build, in both locales,
// walked from `.vercel/output/static/{es,en}/**/index.html`. The 910 Pokémon pages are
// replaced by the fixed sample of six §14.4 names, and the 404 of each locale is added.
// The list needs a build: run `pnpm build` before any Playwright project, which is also
// what the second `webServer` of playwright.config.ts needs.
//
// Two lists, not one:
//
// - `buildRoutes` is every route of §14.4. `smoke.spec.ts` walks it (§14.3).
// - `testRoutes` is `buildRoutes` trimmed by scripts/lib/rutas-migradas.mjs, plus the parity
//   routes of §14.5, and it is what the gates of §14.3 (a11y, keyboard, contract,
//   content-sentinel, i18n) import. The trim kept every page that still rendered with
//   AppLayout out of those gates while §3.10 lasted; since M15 the list is `'*'` and it keeps
//   every route: every route of §8 in both locales, the six Pokémon pages of the sample and
//   the 404 of each locale, which answers from the on-demand `src/pages/404.astro`
//   (`PLANTILLA_404`).
//
// This module also carries the two per-page setups §14.3 asks every project for. They
// are functions and not `use` options because Playwright 1.63 has no config option for
// either: `PlaywrightTestOptions` carries no `clock` and no route handler, and an auto
// fixture has to live in the module a spec imports `test` from. A spec calls
// `stubRemoteArt` and `freezeClock` in its own `beforeEach`.

import { deflateSync } from 'node:zlib';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import {
  esRutaMigrada,
  esRutaParidad,
  idiomas,
  PLANTILLA_404,
  rutasParidad,
} from '../../scripts/lib/rutas-migradas.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const STATIC = resolve(ROOT, '.vercel', 'output', 'static');

export type Locale = 'es' | 'en';

export type TestRoute = {
  /** Path as `page.goto` takes it: leading slash, trailing slash, no origin. */
  path: string;
  locale: Locale;
  /** What the route answers: 200, or 404 for the two §14.4 adds. */
  status: number;
  /**
   * Set on the Guild route, which §14.4 also visits with this export already
   * imported. A spec that does not know the flow ignores it and tests the empty page.
   */
  guildExport?: string;
  /** True once scripts/lib/rutas-migradas.mjs covers this route. */
  migrated: boolean;
  /**
   * Set on a page state (`queryRoutes`): what the page shows once that state is drawn. A
   * spec that walks the state waits for it after `page.goto`.
   */
  ready?: string;
};

/** §14.4: the six Pokémon pages that stand in for the 910 of the build. */
export const POKEMON_SAMPLE = [
  'charizard',
  'shiny-charizard',
  'mime-jr',
  'unown-a',
  'smeargle',
  'shiny-mimikyu',
] as const;

/** §14.4: the route each locale answers with its 404 page. */
export const NOT_FOUND_SLUG = 'no-existe';

/** §14.4 and §10: the Guild export the Guild route is visited with. */
export const GUILD_EXPORT = 'tests/fixtures/guild-export.sample.json';

/** §12.20 point 1 (M10): the query the results page of Buscar is visited with. */
export const SEARCH_QUERY = 'bulba';

/** §14.3: the remote art every project answers locally. */
export const REMOTE_ART_PATTERN = 'https://wiki.pokealliance.com/**';
const REMOTE_ART_SIZE = 140;

/** §14.3: 14:32 in Brasilia, the instant every spec with dates reads. */
export const FIXED_TIME = '2026-09-18T17:32:00Z';

/**
 * G12, WG5: the retired routes of §8.0.1 and §13.1, each with the route it answers a 302
 * towards, `{l}` standing for each locale. A link to one of them is a link to a route the
 * site no longer has, even though its redirection would still land on a page that answers
 * 200, so the 302 alone does not make such a link pass. tests/e2e/links.spec.ts walks the
 * deployed output with it, and the page specs of §8 their own links.
 */
export const RETIRED_ROUTES = [
  // A1, R-03: goes away with the map placeholder (§8.11, PZ-04).
  { pattern: /\/mapa\/aportar\b/, from: '/{l}/mapa/aportar/', to: '/{l}/mapa/' },
  // E1, R15: the tiers moved into the Tier list of §8.8 (M9).
  { pattern: /\/rotaciones\b/, from: '/{l}/rotaciones/', to: '/{l}/pokedex/tiers/' },
  // E2, A7: the quests live in the Actividades of §8.9 (M11); `/guias/` comes back with the
  // first editorial guide (§15).
  { pattern: /\/guias\b/, from: '/{l}/guias/', to: '/{l}/actividades/' },
] as const;

function readOutput(): string[] {
  if (!existsSync(STATIC)) {
    throw new Error(
      `${relative(ROOT, STATIC)} is missing: the §14.4 route list is read from the build. ` +
        'Run `pnpm build` before any Playwright project.',
    );
  }
  const pages: string[] = [];
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const full = join(directory, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name === 'index.html') pages.push(full);
    }
  };
  for (const locale of idiomas) {
    const directory = join(STATIC, locale);
    if (existsSync(directory)) walk(directory);
  }
  return pages;
}

/** `…/static/es/pokedex/charizard/index.html` -> `/es/pokedex/charizard/`. */
function toRoute(file: string): string {
  const segments = relative(STATIC, file).split(sep);
  segments.pop();
  return `/${segments.join('/')}/`;
}

/**
 * The ids of content/pokemon.json. A route under `/{l}/pokedex/` is a Pokémon page when its
 * slug is one of them; the static pages beside `[slug]` (the Tier list of §8.8, M9) are not,
 * and `pnpm content:check` refuses a Pokémon whose id would collide with one (8.0.1).
 */
const POKEMON_IDS: ReadonlySet<string> = new Set(
  (
    JSON.parse(readFileSync(resolve(ROOT, 'content', 'pokemon.json'), 'utf8')) as {
      pokemon: { id: string }[];
    }
  ).pokemon.map((record) => record.id),
);

/**
 * §14.4: a Pokémon page survives only when it is one of the six samples. Every other
 * route of the build is kept as it is.
 */
function inSample(route: string): boolean {
  const segments = route.split('/').filter((segment) => segment.length > 0);
  if (segments.length !== 3 || segments[1] !== 'pokedex' || !POKEMON_IDS.has(segments[2])) {
    return true;
  }
  return (POKEMON_SAMPLE as readonly string[]).includes(segments[2]);
}

function describe(path: string, status: number, migrated = esRutaMigrada(path)): TestRoute {
  const locale = (path.split('/')[1] ?? 'es') as Locale;
  const route: TestRoute = { path, locale, status, migrated };
  if (/^\/[a-z]{2}\/herramientas\/guild\/$/.test(path)) route.guildExport = GUILD_EXPORT;
  return route;
}

/** Every route of §14.4, sorted, in both locales. The smoke gate walks this one. */
export const buildRoutes: TestRoute[] = [
  ...readOutput()
    .map(toRoute)
    .filter(inSample)
    .sort()
    .map((path) => describe(path, 200)),
  // The two 404 probes of §14.4 are paths that match nothing, not routes of §8, so no
  // milestone will ever list them: what decides whether the gates measure them is the
  // 404 template they land on (`src/pages/404.astro`, migrated by M11). Keying them on
  // their own path would leave NF1 (§14.3, §13.5) without a single test forever.
  ...idiomas.map((locale) =>
    describe(`/${locale}/${NOT_FOUND_SLUG}/`, 404, esRutaMigrada(PLANTILLA_404)),
  ),
];

/**
 * The parity routes of §14.5. They exist only in the visual build and on the development
 * server (`astro.config.mjs` injects them there and nowhere else), so `readOutput` — which
 * walks the production build — never finds them.
 */
const parityRoutes: TestRoute[] = [...rutasParidad]
  .sort()
  .map((path: string) => describe(path, 200, true));

/**
 * The routes the gates of §14.3 measure: §14.4 trimmed by scripts/lib/rutas-migradas.mjs,
 * plus the parity routes the development server serves. It grew one milestone at a time
 * from M3 on, which is what kept `pnpm ci` green while §3.10 lasted; since M15 it holds
 * every route of §14.4 (see the head of this file).
 */
export const testRoutes: TestRoute[] = [
  ...buildRoutes.filter((route) => route.migrated),
  ...parityRoutes,
];

/**
 * Page states the gates of §14.3 also walk, the way §14.4 adds the Guild route with its
 * export: the results page of Buscar with a query (§8.6, M10), one per locale while
 * `/{l}/buscar/` is migrated. The route of the build is the page without one, which shows
 * Destacados; with `q` the island draws what the index answers — the count, the groups of
 * §8.6 and their cards — once it has hydrated and read the index, which is what `ready`
 * waits for. They are not in `testRoutes`: the `prod` specs read the prerendered HTML, which
 * never carries a query (PR2), and each gate that walks them says so.
 */
export const queryRoutes: TestRoute[] = testRoutes
  .filter((route) => /^\/[a-z]{2}\/buscar\/$/.test(route.path))
  .map((route) => ({
    ...route,
    path: `${route.path}?q=${SEARCH_QUERY}`,
    ready: '.ac-search-results:not([data-ac-pending]) [data-ac-list="buscar"]',
  }));

/**
 * `testRoutes` without the parity routes: what the `prod` project measures. Its specs
 * (`prod`, `seo`, `links`, `money`) read `.vercel/output` over
 * scripts/test/serve-vercel-output.mjs, where a `/_paridad/` route answers 404 by design
 * (§14.5, §13.5) — `seo:check` fails if one ever reaches the deployed output.
 */
export const outputRoutes: TestRoute[] = testRoutes.filter((route) => !esRutaParidad(route.path));

// --- the local art of §14.3, built here so no binary fixture has to be versioned.

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Buffer): number {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, checksum]);
}

/** An opaque square, so the stand-in is as much of an LCP candidate as the art it replaces. */
function solidPng(size: number): Buffer {
  const stride = size * 3 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y += 1) {
    const row = y * stride;
    raw[row] = 0;
    for (let x = 0; x < size; x += 1) {
      const at = row + 1 + x * 3;
      raw[at] = 0x1c;
      raw[at + 1] = 0x21;
      raw[at + 2] = 0x2b;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const REMOTE_ART_PNG = solidPng(REMOTE_ART_SIZE);

/**
 * §14.3: the art of wiki.pokealliance.com answers with a local 140 × 140 PNG, so no
 * test depends on a third-party host. Without it a run with many workers queues dozens
 * of cross-origin image requests and the slow ones look like page failures.
 */
export async function stubRemoteArt(page: Page): Promise<void> {
  await page.route(REMOTE_ART_PATTERN, (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: REMOTE_ART_PNG }),
  );
}

/** §14.3: the instant every spec with dates reads. Call it before the first navigation. */
export async function freezeClock(page: Page): Promise<void> {
  await page.clock.setFixedTime(FIXED_TIME);
}

/**
 * V7: a query of the `pokedex` list that no record matches, from the registry (U3). The
 * filters only take the values the registry has (U4), so an empty result is a combination
 * of two of them: the first generation, in ascending order, with an element none of its
 * Pokémon has, the element taken in the order of 8.0.5.
 */
export function pokedexEmptyQuery(): string {
  const read = <T>(file: string): T => JSON.parse(readFileSync(resolve(ROOT, file), 'utf8')) as T;
  const { pokemon } = read<{ pokemon: { generacion: number | null; elementos: string[] }[] }>(
    'content/pokemon.json',
  );
  const { elementos } = read<{ elementos: { id: string }[] }>('content/elementos.json');
  const generations = [
    ...new Set(
      pokemon.flatMap((record) => (record.generacion === null ? [] : [record.generacion])),
    ),
  ].sort((a, b) => a - b);
  for (const generation of generations) {
    for (const { id } of elementos) {
      const found = pokemon.some(
        (record) => record.generacion === generation && record.elementos.includes(id),
      );
      if (!found) return `?gen=${generation}&elemento=${id}`;
    }
  }
  throw new Error('content/pokemon.json: every generation has every element; V7 needs a gap.');
}
