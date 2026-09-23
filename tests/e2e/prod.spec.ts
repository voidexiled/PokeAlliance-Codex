// §14.3 production-surface gate: the three things only the deployed build can
// show. The prerender regressions of §12.20 (points 1 and 3), where the fonts
// come from (§3.9) and what they weigh on the network (§13.6, row «Fuentes»).
//
// Runs in the `prod` project, over `.vercel/output` served by
// scripts/test/serve-vercel-output.mjs, so what it reads is the prerendered HTML
// that gets deployed and not a development render: on the development server the
// island hydrates from a module graph Vite rewrites, and a query the server baked
// into the HTML would be indistinguishable from one the client applied.
//
// Contract with tests/e2e/routes.ts (track C of M2): `outputRoutes` is the §14.4
// list trimmed by scripts/lib/rutas-migradas.mjs and by the `/_paridad/` routes,
// which only the development server serves (§14.5), each entry carries `path`,
// `locale` and `status`. The two per-page setups §14.3 asks every project for —
// the remote-art stub and the fixed clock — arrive with `test`, which comes from
// tests/e2e/fixtures.ts.
//
// Scope. The font budget walks `outputRoutes`, every route of §14.4 in the output. The
// two §12.20 cases are about one page each: `/{l}/pokedex/` (§8.2) and `/{l}/buscar/`
// (§8.6).

import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { outputRoutes } from './routes';

/** §12.20, point 3: the Pokédex URL of that row, filters and all. */
const POKEDEX = '/es/pokedex/';
const POKEDEX_FILTERED = '/es/pokedex/?elemento=fire&variante=shiny';

/** §7.7.2, U1: `view` and `page` are the two non-filter parameters of a list. */
const POKEDEX_LIST_PAGE_2 = '/es/pokedex/?view=list&page=2';

/** §12.20, point 1: the Buscar URL of that row. */
const SEARCH = '/es/buscar/';
const SEARCH_QUERY = 'bulba';

/** §7.7.4, V8: the container of each view. Only the active one is mounted (V1). */
const VIEWS = {
  cards: '[data-card-grid]',
  slots: '[data-slots]',
  list: '[data-list]',
};

/** §7.7.5, PR4: while this attribute is on the root the island has not applied the URL. */
const PENDING = '[data-ac-pending]';

/** §3.9, X8, S5: the two hosts the site never asks anything of. */
const GOOGLE_FONTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

/** A request for a font file, whichever `resourceType` the browser reports. */
const FONT_FILE = /\.(?:woff2|woff|ttf|otf|eot)$/i;

/**
 * §13.6, row «Fuentes»: 0 files for Verdana (it comes from the system) and at
 * most the two Poppins latin subsets, 500 and 600, adding up to 50 KB. Today they
 * measure 7.748 B and 8.000 B (§3.9).
 */
const FONT_BUDGET = { files: 2, bytes: 50 * 1024, family: /poppins/i };

/** §3.9: the only family the site self-hosts. Verdana would be a defect, not a file. */
const SYSTEM_FAMILIES = /verdana|dejavu|bitstream|system-ui/i;

/** Every font file the page asked for, and the two Google hosts if it asked them anything. */
type FontTraffic = { fonts: string[]; google: string[] };

async function loadAndWatchFonts(page: Page, path: string, status: number): Promise<FontTraffic> {
  const urls: string[] = [];
  page.on('request', (request) => urls.push(request.url()));

  const response = await page.goto(path);
  expect(response, `${path} answers`).not.toBeNull();
  expect(response?.status(), `${path} answers ${status}`).toBe(status);

  // `load` plus the font set: §3.9 loads Poppins on the first pointer or focus over a
  // tooltip trigger, or in `requestIdleCallback` after `load`, so waiting for the
  // document to settle is what puts a preloaded or eagerly loaded file on this list.
  await page.waitForLoadState('load');
  await page.evaluate(async () => {
    await document.fonts.ready;
  });

  const parsed = urls.map((url) => new URL(url));
  return {
    fonts: parsed.filter((url) => FONT_FILE.test(url.pathname)).map((url) => url.href),
    google: parsed.filter((url) => GOOGLE_FONTS.includes(url.hostname)).map((url) => url.href),
  };
}

for (const route of outputRoutes) {
  test(`the fonts come from this origin and fit the budget on ${route.path}`, async ({
    page,
    request,
    baseURL,
  }) => {
    const traffic = await loadAndWatchFonts(page, route.path, route.status);

    expect(traffic.google, '§3.9: 0 requests to fonts.googleapis.com or fonts.gstatic.com').toEqual(
      [],
    );

    const origin = baseURL === undefined ? '' : new URL(baseURL).origin;
    const crossOrigin = traffic.fonts.filter((url) => new URL(url).origin !== origin);
    expect(crossOrigin, '§3.9: every font file is served by this site').toEqual([]);

    const files = [...new Set(traffic.fonts)];
    expect(files.length, '§13.6: at most two font files').toBeLessThanOrEqual(FONT_BUDGET.files);

    for (const url of files) {
      const name = new URL(url).pathname;
      expect(name, '§3.9: the self-hosted family is Poppins').toMatch(FONT_BUDGET.family);
      expect(name, '§13.6: no file for a system family').not.toMatch(SYSTEM_FAMILIES);
      expect(name, '§3.9: subset latin as woff2').toMatch(/\.woff2$/);
    }

    let bytes = 0;
    for (const url of files) {
      const file = await request.get(url);
      expect(file.status(), `${url} answers`).toBe(200);
      bytes += (await file.body()).byteLength;
    }
    expect(bytes, '§13.6: the fonts add up to 50 KB at most').toBeLessThanOrEqual(
      FONT_BUDGET.bytes,
    );
  });
}

/** PR4: the island has read `location.search` and applied it. */
async function stateApplied(page: Page): Promise<void> {
  await page.waitForFunction((selector) => document.querySelector(selector) === null, PENDING);
}

/** The text of the mounted view (V1), which is what a filter, a view or a page changes. */
async function viewText(page: Page): Promise<string> {
  const container = page.locator(Object.values(VIEWS).join(', ')).first();
  await expect(container).toBeVisible();
  return (await container.innerText()).replace(/\s+/g, ' ').trim();
}

test.describe('§12.20, point 3: the Pokédex filters, view and page live in the URL', () => {
  test('reloading a filtered URL keeps the filters', async ({ page }) => {
    await page.goto(POKEDEX);
    await stateApplied(page);
    const unfiltered = await viewText(page);

    await page.goto(POKEDEX_FILTERED);
    await stateApplied(page);
    const filtered = await viewText(page);

    expect(filtered, 'the filters of the URL reach the list').not.toBe(unfiltered);

    await page.reload();
    await stateApplied(page);

    expect(new URL(page.url()).search, 'U4: the query survives the reload').toBe(
      new URL(POKEDEX_FILTERED, page.url()).search,
    );
    expect(await viewText(page), 'the same filters give the same list').toBe(filtered);
  });

  test('`view` and `page` mount the view of the URL', async ({ page }) => {
    await page.goto(POKEDEX);
    await stateApplied(page);
    await expect(page.locator(VIEWS.cards), 'V8: the default view is Cards').toBeVisible();
    const firstPage = await viewText(page);

    await page.goto(POKEDEX_LIST_PAGE_2);
    await stateApplied(page);

    // V1: only the active view is mounted, so the other two containers do not exist.
    await expect(page.locator(VIEWS.list), 'V8: `view=list` mounts Lista').toBeVisible();
    expect(await page.locator(VIEWS.cards).count(), 'V1: Cards is not mounted').toBe(0);
    expect(await page.locator(VIEWS.slots).count(), 'V1: Slots is not mounted').toBe(0);

    const secondPage = await viewText(page);
    expect(secondPage, '`page=2` is not the first page').not.toBe(firstPage);

    await page.reload();
    await stateApplied(page);

    await expect(page.locator(VIEWS.list), 'the view survives the reload').toBeVisible();
    expect(await viewText(page), 'the page survives the reload').toBe(secondPage);
  });
});

test.describe('§12.20, point 1: the search query lives in the URL', () => {
  test('opening the page with a query fills the field', async ({ page }) => {
    await page.goto(`${SEARCH}?q=${SEARCH_QUERY}`);
    await stateApplied(page);

    // §8.6: the page carries one `role="search"` region with a search field inside.
    const field = page.getByRole('search').getByRole('searchbox');
    await expect(field, '§12.20, point 1: the field carries the query of the URL').toHaveValue(
      SEARCH_QUERY,
    );
  });

  test('PR2: the prerendered HTML does not carry the query', async ({ request }) => {
    const response = await request.get(`${SEARCH}?q=${SEARCH_QUERY}`);
    expect(response.status(), `${SEARCH} answers`).toBe(200);

    // PR2: a prerendered page never reads `Astro.url.searchParams`, so the query only
    // exists in the browser. The server answers the same HTML with and without it.
    const withQuery = await response.text();
    const plain = await (await request.get(SEARCH)).text();
    expect(withQuery, 'PR2: the build does not render the query').toBe(plain);
    expect(withQuery, 'PR2: the query is not in the prerendered field').not.toContain(SEARCH_QUERY);
  });

  test('U5: typing rewrites the URL with replaceState', async ({ page }) => {
    await page.goto(SEARCH);
    await stateApplied(page);

    const entries = await page.evaluate(() => history.length);
    const field = page.getByRole('search').getByRole('searchbox');
    await field.fill(SEARCH_QUERY);

    // U5: the URL is written 300 ms after the last key.
    await page.waitForFunction(
      (query) => new URLSearchParams(location.search).get('q') === query,
      SEARCH_QUERY,
    );
    expect(await page.evaluate(() => history.length), 'H1: a query is replaceState, not push').toBe(
      entries,
    );
  });
});
