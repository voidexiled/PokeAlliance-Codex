// §14.3 smoke gate, in its final form (M11). Four parts:
//
// 1. The route walk of §14.4, one test per route, read from tests/e2e/routes.ts: every page of
//    the build in both locales — the six Pokémon pages of the sample instead of the 1.820, and
//    the 404 of each locale — answers its status, shows an `h1`, scrolls in one direction only
//    and loads every image it paints. The Guild route is also walked with the export of §14.4
//    imported.
// 2. The visible counts, computed from `content/` when the spec loads (S19, WD1): «{n}
//    variantes», «{a} normales» and «{b} Shiny» of the Pokédex, the count of the Tier list, the
//    line of the Inicio and the count of each of its panels («N páginas», «N elementos»).
// 3. The three views: Cards, Slots and Lista change what a list shows, and the chosen one
//    survives a reload (U6), on the Pokédex, the Tier list and Ítems; and the filters of the
//    Pokédex live in the URL (§12.20 point 3).
// 4. The flows of the site: the frame and its navigation, the pages that close F2 and Comercio
//    over the sample registry of the development server (M12). They are the desktop shape of the
//    pages, so they do not run on the phone viewport, where §14.3 gives the `mobile` project the
//    route walk. The flows of Guild live in tests/e2e/guild.spec.ts since M13 rewrote that page.
//
// Every page is reached through `main#contenido` or its content; `#main-content` of the retired
// layout is gone from this file (§14). The remote art of wiki.pokealliance.com and the fixed
// clock of §14.3 come from tests/e2e/fixtures.ts. Run with `OCULTAR_BORRADORES=1` and no server on
// 4321 — Playwright passes its environment to the server it starts — and the counts leave the
// drafts out, as the pages do.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Locator, Page } from '@playwright/test';

import { en } from '../../src/i18n/messages/en';
import type { Messages } from '../../src/i18n/messages/en';
import { es } from '../../src/i18n/messages/es';
import { formatPokedolaresLabel } from '../../src/lib/format/numbers';
import { esRutaDelSitio, idiomas } from '../../scripts/lib/rutas-migradas.mjs';
import { expect, test } from './fixtures';
import { buildRoutes, pokedexEmptyQuery } from './routes';

/** Below this width the phone projects run the route walk, not the desktop flows. */
const DESKTOP_WIDTH = 768;

/** The development server compiles a route the first time it is asked for it. */
const ROUTE_TIMEOUT = 60_000;

/**
 * Vite's development error overlay, which Astro shows when a module of the page throws
 * while compiling. It is the custom element `<vite-error-overlay>`
 * (`customElements.define` in `vite/dist/client/client.mjs`).
 */
const ERROR_OVERLAY = 'vite-error-overlay';

// ------------------------------------------------------------------------------ registries

type Locale = 'es' | 'en';
type Localized = Record<Locale, string>;

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(resolve(ROOT, file), 'utf8')) as T;
}

/** `hideDrafts` of src/lib/content/registry.ts, read from the environment of this run. */
const HIDE_DRAFTS = /^(?:1|true)$/i.test(process.env.OCULTAR_BORRADORES ?? '');

function published<T extends { borrador?: boolean }>(records: T[]): T[] {
  return HIDE_DRAFTS ? records.filter((record) => record.borrador !== true) : records;
}

interface PokemonRecord {
  id: string;
  variante: string;
  tier: number | string | null;
  elementos: string[];
}

interface CategoryRecord {
  id: string;
  virtual?: boolean;
}

const POKEMON = readJson<{ pokemon: PokemonRecord[] }>('content/pokemon.json').pokemon;

/** §8.4: the system pages this build keeps. */
const SISTEMAS = published(
  readdirSync(resolve(ROOT, 'content/sistemas'))
    .filter((file) => file.endsWith('.json'))
    .map((file) => readJson<{ id: string; borrador?: boolean }>(`content/sistemas/${file}`)),
);

/** §8.5: «Todo» and the 13 Market categories. */
const CATEGORIES = readJson<{ categorias: CategoryRecord[] }>(
  'content/items/categorias.json',
).categorias;

/** The Market items this build keeps: «ítems» joins the line of the Inicio with one of them. */
const ITEMS = published(
  CATEGORIES.filter((category) => category.virtual !== true).flatMap((category) => {
    const file = `content/items/${category.id}.json`;
    return existsSync(resolve(ROOT, file))
      ? readJson<{ items: { id: string; borrador?: boolean }[] }>(file).items
      : [];
  }),
);

const ELEMENTS = readJson<{ elementos: { id: string; nombre: Localized }[] }>(
  'content/elementos.json',
).elementos;

/** §8.9.2: the activities whose page the build writes (WG5). */
function activities(locale: Locale): { id: string; nombre: string }[] {
  return readJson<{ misiones: { id: string; nombre: string }[] }>(
    'content/quests.json',
  ).misiones.filter((quest) => esRutaDelSitio(`/${locale}/actividades/${quest.id}/`));
}

/** The sample registry of Comercio (§9.4), which the development server reads (§14.3). */
const COMERCIO_LISTINGS = readJson<{ anuncios: { id: string; vendedor: string }[] }>(
  'content/comercio/anuncios.json',
).anuncios;
const COMERCIO_SELLERS = readJson<{ vendedores: { id: string; nombre: string }[] }>(
  'content/comercio/vendedores.json',
).vendedores;

const MESSAGES: Record<Locale, Messages> = { es, en };
const LOCALES = idiomas as Locale[];

// ------------------------------------------------------------------------------ text of a count

const NUMBER_LOCALE: Record<Locale, string> = { es: 'es-ES', en: 'en-US' };

/** §13.3: grouped thousands in both locales («1.700», «1,700»). */
function figure(value: number, locale: Locale): string {
  return new Intl.NumberFormat(NUMBER_LOCALE[locale], { useGrouping: 'always' }).format(value);
}

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => values[key] ?? whole);
}

type Leaf = string | { one: string; other: string };

/** The plural form of a dictionary leaf for `n` (§13.2). */
function pick(leaf: Leaf, n: number, locale: Locale): string {
  if (typeof leaf === 'string') return leaf;
  return new Intl.PluralRules(NUMBER_LOCALE[locale]).select(n) === 'one' ? leaf.one : leaf.other;
}

/** A count as the dictionary writes it, the figure already formatted (§13.2, §13.3). */
function counted(leaf: Leaf, n: number, locale: Locale): string {
  return fill(pick(leaf, n, locale), { n: figure(n, locale) });
}

/**
 * 8.1 step 1 (X12): «{n} variantes de Pokémon, {lista} de PokeAlliance.», with «ítems»,
 * «sistemas» and «actividades» when their registry has a published record, in that order.
 */
function introLine(locale: Locale): string {
  const { home } = MESSAGES[locale];
  const words = [
    ITEMS.length > 0 ? home.collections.items : null,
    SISTEMAS.length > 0 ? home.collections.systems : null,
    activities(locale).length > 0 ? home.collections.activities : null,
  ].filter((word): word is string => word !== null);
  const n = figure(POKEMON.length, locale);
  if (words.length === 0) return fill(home.introBare, { n });
  const last = words[words.length - 1];
  const list = words.length === 1 ? last : `${words.slice(0, -1).join(', ')} ${home.and} ${last}`;
  return fill(home.intro, { n, list });
}

/**
 * 8.1 step 4: each panel of the bento with the links it draws (WD1) and the words its figure
 * carries for the screen reader. A panel with no link is not drawn.
 */
function panelCounts(locale: Locale): { title: string; count: string }[] {
  const { home } = MESSAGES[locale];
  const panels = [
    { title: home.panels.systems, n: SISTEMAS.length, words: home.pageCount },
    { title: home.panels.items, n: CATEGORIES.length, words: home.pageCount },
    { title: home.panels.activities, n: activities(locale).length, words: home.pageCount },
    { title: home.panels.pokedex, n: ELEMENTS.length, words: home.elementCount },
  ];
  return panels
    .filter((panel) => panel.n > 0)
    .map((panel) => ({
      title: panel.title,
      count: `${figure(panel.n, locale)} ${pick(panel.words, panel.n, locale).trim()}`,
    }));
}

// ------------------------------------------------------------------------------ page helpers

type Containment = {
  clientWidth: number;
  documentWidth: number;
  bodyWidth: number;
  brokenImages: string[];
};

function measure(page: Page): Promise<Containment> {
  return page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
    brokenImages: Array.from(document.images)
      .filter((image) => image.complete && image.naturalWidth === 0)
      .map((image) => image.currentSrc || image.src),
  }));
}

/**
 * Astro drops the `ssr` attribute of an island the moment it hydrates. Until then the
 * island paints its controls but nothing is listening and a click on one is lost.
 * `client:visible` is left out because it waits to be scrolled to; `hydrateInView` handles it.
 */
async function hydrated(page: Page): Promise<void> {
  await expect(page.locator('astro-island[ssr]:not([client="visible"])')).toHaveCount(0);
}

/** Go to a page and wait for its islands to be listening. */
async function visit(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await hydrated(page);
}

/** Scroll a `client:visible` island into view and wait for it to answer. */
async function hydrateInView(root: Locator): Promise<void> {
  const island = root.page().locator('astro-island').filter({ has: root });
  await island.scrollIntoViewIfNeeded();
  await expect(island).not.toHaveAttribute('ssr');
}

type ListId = 'pokedex' | 'tiers' | 'items' | 'comercio';
type ViewName = 'cards' | 'slots' | 'list';

/** What each view paints inside the list root (7.7.4). */
const VIEW_ATTRIBUTE: Record<ViewName, string> = {
  cards: 'data-card-grid',
  slots: 'data-slots',
  list: 'data-list',
};

function listRoot(page: Page, id: ListId): Locator {
  return page.locator(`.ac-entity-list[data-ac-list="${id}"]`);
}

/** The island hydrated and applied the state of the URL (PR1, PR4). */
async function listReady(page: Page, root: Locator): Promise<void> {
  await root.scrollIntoViewIfNeeded();
  await expect(page.locator('astro-island[ssr]').filter({ has: root })).toHaveCount(0);
  await expect(root).not.toHaveAttribute('data-ac-pending');
}

async function openList(page: Page, path: string, id: ListId): Promise<Locator> {
  const response = await page.goto(path);
  expect(response?.status(), `${path} answers 200`).toBe(200);
  const root = listRoot(page, id);
  await listReady(page, root);
  return root;
}

function viewButton(root: Locator, locale: Locale, view: ViewName): Locator {
  return root
    .locator('.ac-view-toggle')
    .getByRole('button', { name: MESSAGES[locale].ui.views[view], exact: true });
}

/** The count of the results bar (7.2.3 `Count`), announced politely (7.7.3). */
function countOf(root: Locator): Locator {
  return root.locator('.ac-entity-list__bar [aria-live="polite"]');
}

/** U6: the saved view of a list, removed so a test starts from the default one. */
async function forgetView(page: Page, id: ListId): Promise<void> {
  await page.evaluate((key) => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Storage may be blocked; nothing was saved then.
    }
  }, `ac:vista:${id}`);
}

// ------------------------------------------------------------------------------ 1. the route walk

for (const route of buildRoutes) {
  test(`${route.path} answers ${route.status}, renders, stays contained and loads its images`, async ({
    page,
  }) => {
    test.setTimeout(ROUTE_TIMEOUT);

    const response = await page.goto(route.path);
    expect(response?.status(), `${route.path} status`).toBe(route.status);
    await expect(page.locator('h1').first()).toBeVisible();
    await expect(page.locator(ERROR_OVERLAY)).toHaveCount(0);

    if (route.guildExport) {
      // §14.4 also visits the Guild route with its export already imported: the empty state's
      // «Importar» opens «Importar export», and the export's guild becomes the h1 (10.5).
      const { guild } = MESSAGES[route.locale];
      await page.getByRole('button', { name: guild.emptyAction, exact: true }).click();
      const dialog = page.getByRole('dialog');
      await dialog.locator('input[type="file"]').setInputFiles(route.guildExport);
      await dialog.getByRole('button', { name: guild.importDialog.submit, exact: true }).click();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('heading', { name: 'Test Guild', exact: true })).toBeVisible();
    }

    // The islands hydrate after `load`, so the width is read once it settles instead of
    // in the frame the navigation resolved in.
    await expect
      .poll(
        async () => {
          const settled = await measure(page);
          return settled.documentWidth - settled.clientWidth;
        },
        { message: `${route.path} scrolls horizontally` },
      )
      .toBe(0);

    const contained = await measure(page);
    expect(contained.bodyWidth, `${route.path} body overflow`).toBe(contained.clientWidth);
    expect(contained.brokenImages, `${route.path} broken images`).toEqual([]);
  });
}

// ------------------------------------------------------------------------------ 2. the counts

test.describe('the visible counts are the registry’s (S19, WD1)', () => {
  test.skip(
    ({ viewport }) => (viewport?.width ?? DESKTOP_WIDTH) < DESKTOP_WIDTH,
    'The counts do not depend on the width; the phone runs the route walk.',
  );

  for (const locale of LOCALES) {
    test(`Pokédex: «variantes», «normales» and «Shiny» (${locale}, 8.2 step 4)`, async ({
      page,
    }) => {
      const { pokedex } = MESSAGES[locale];
      const cases = [
        { search: '', expected: counted(pokedex.count, POKEMON.length, locale) },
        {
          search: '?variante=normal',
          expected: counted(
            pokedex.countNormal,
            POKEMON.filter((record) => record.variante === 'normal').length,
            locale,
          ),
        },
        {
          search: '?variante=shiny',
          expected: counted(
            pokedex.countShiny,
            POKEMON.filter((record) => record.variante === 'shiny').length,
            locale,
          ),
        },
      ];
      for (const { search, expected } of cases) {
        const root = await openList(page, `/${locale}/pokedex/${search}`, 'pokedex');
        await expect(countOf(root), `/${locale}/pokedex/${search}`).toHaveText(expected);
      }
    });

    test(`Tier list: the variants with a tier (${locale}, 8.8 step 4)`, async ({ page }) => {
      const root = await openList(page, `/${locale}/pokedex/tiers/`, 'tiers');
      await expect(countOf(root)).toHaveText(
        counted(
          MESSAGES[locale].pokedex.count,
          POKEMON.filter((record) => record.tier !== null).length,
          locale,
        ),
      );
    });

    test(`Inicio: the line and each panel count (${locale}, 8.1 steps 1 and 4)`, async ({
      page,
    }) => {
      const response = await page.goto(`/${locale}/`);
      expect(response?.status()).toBe(200);
      await expect(page.locator('.ac-home-intro__description')).toHaveText(introLine(locale));
      const panels = page.locator('main#contenido .ac-index-panel');
      const expected = panelCounts(locale);
      await expect(panels.locator('.ac-index-panel__title')).toHaveText(
        expected.map((panel) => panel.title),
      );
      await expect(panels.locator('.ac-index-panel__count')).toHaveText(
        expected.map((panel) => panel.count),
      );
    });
  }
});

// ------------------------------------------------------------------------------ 3. views and filters

test.describe('the three views and the URL of the lists (7.7, §12.20 point 3)', () => {
  test.skip(
    ({ viewport }) => (viewport?.width ?? DESKTOP_WIDTH) < DESKTOP_WIDTH,
    'lists.spec.ts measures the controller on the phone; this is the desktop flow.',
  );

  const LISTS: { id: ListId; path: string }[] = [
    { id: 'pokedex', path: '/es/pokedex/' },
    { id: 'tiers', path: '/es/pokedex/tiers/' },
    { id: 'items', path: '/es/items/' },
  ];

  for (const { id, path } of LISTS) {
    test(`${path}: Cards, Slots and Lista change the content and the choice survives a reload`, async ({
      page,
    }) => {
      // A locator is read again on every use, so it outlives the reloads below.
      const root = await openList(page, path, id);
      await forgetView(page, id);
      await page.reload();
      await listReady(page, root);
      // The default view (U6): Cards.
      await expect(viewButton(root, 'es', 'cards')).toHaveAttribute('aria-pressed', 'true');
      await expect(root.locator(`[${VIEW_ATTRIBUTE.cards}]`).first()).toBeVisible();

      for (const view of ['slots', 'list', 'cards'] as const) {
        await viewButton(root, 'es', view).click();
        await expect(viewButton(root, 'es', view)).toHaveAttribute('aria-pressed', 'true');
        // The view paints its own markup and none of the other two.
        await expect(root.locator(`[${VIEW_ATTRIBUTE[view]}]`).first()).toBeVisible();
        for (const other of ['cards', 'slots', 'list'] as const) {
          if (other !== view) {
            await expect(
              root.locator(`[${VIEW_ATTRIBUTE[other]}]`),
              `${view}: no ${other}`,
            ).toHaveCount(0);
          }
        }

        // U6: the chosen view survives a reload of the same address.
        await page.reload();
        await listReady(page, root);
        await expect(viewButton(root, 'es', view), `${view} after a reload`).toHaveAttribute(
          'aria-pressed',
          'true',
        );
        await expect(root.locator(`[${VIEW_ATTRIBUTE[view]}]`).first()).toBeVisible();
      }
      await forgetView(page, id);
    });
  }

  test('the Pokédex filters live in the URL and survive a reload', async ({ page }) => {
    const shinyFire = POKEMON.filter(
      (record) => record.variante === 'shiny' && record.elementos.includes('fire'),
    ).length;
    const fire = ELEMENTS.find((element) => element.id === 'fire')?.nombre.es ?? 'fire';

    // §12.20 point 3: the address carries the filters, and a reload keeps them.
    const root = await openList(page, '/es/pokedex/?elemento=fire&variante=shiny', 'pokedex');
    for (let reload = 0; reload < 2; reload += 1) {
      await expect(countOf(root)).toHaveText(counted(es.pokedex.countShiny, shinyFire, 'es'));
      await expect(root.locator('[data-ac-select] [role="combobox"]').nth(2)).toHaveText(fire);
      await expect(
        root.locator('.ac-filter-bar .ac-toggle-group').getByRole('button', { name: es.ui.shiny }),
      ).toHaveAttribute('aria-pressed', 'true');
      const params = new URL(page.url()).searchParams;
      expect(params.get('elemento')).toBe('fire');
      expect(params.get('variante')).toBe('shiny');
      if (reload === 0) {
        await page.reload();
        await listReady(page, root);
      }
    }

    // A filter chosen on the page writes the address (U5).
    await openList(page, '/es/pokedex/', 'pokedex');
    await root
      .locator('.ac-filter-bar .ac-toggle-group')
      .getByRole('button', { name: es.ui.cards.normal, exact: true })
      .click();
    await expect.poll(() => new URL(page.url()).searchParams.get('variante')).toBe('normal');
    await expect(countOf(root)).toHaveText(
      counted(
        es.pokedex.countNormal,
        POKEMON.filter((record) => record.variante === 'normal').length,
        'es',
      ),
    );
  });
});

// ------------------------------------------------------------------------------ 4. the flows

test.describe('flows of the site', () => {
  test.skip(
    ({ viewport }) => (viewport?.width ?? DESKTOP_WIDTH) < DESKTOP_WIDTH,
    'These are the desktop shape of the pages; §14.3 gives the phone the route walk.',
  );

  test('Spanish shell renders and navigates', async ({ page }) => {
    const browserErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') browserErrors.push(message.text());
    });
    page.on('pageerror', (error) => browserErrors.push(error.message));

    await visit(page, '/es/');

    // The Inicio (§8.1, template A): the whole title of S-01 and the h1 of HomeIntro, from the
    // dictionary; the Server Save panel left the page (H-11, A17, Q7).
    await expect(page).toHaveTitle(es.home.documentTitle);
    await expect(page.locator(ERROR_OVERLAY)).toHaveCount(0);
    await expect(
      page.getByRole('heading', { level: 1, name: es.home.title, exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId('server-save-status')).toHaveCount(0);

    // The Pokédex panel of the bento links every element to the Pokédex filtered by it
    // (8.1 step 4, `/{l}/pokedex/?elemento={id}`).
    const element = page
      .getByRole('region', { name: es.home.panels.pokedex, exact: true })
      .getByRole('link')
      .first();
    const elementHref = await element.getAttribute('href');
    expect(elementHref).toMatch(/^\/es\/pokedex\/\?elemento=[a-z]+$/);
    await element.click();
    await expect(page).toHaveURL((url) => `${url.pathname}${url.search}` === elementHref);
    await expect(page.getByRole('heading', { name: 'Pokédex', exact: true })).toBeVisible();
    // The Pokédex (§8.2): the `pokedex` list, 12 cards a page, a name found through its
    // generation in the URL (8.0.6) and opened from the title of its card.
    const list = listRoot(page, 'pokedex');
    await expect(list).toBeVisible();
    await expect(list).not.toHaveAttribute('data-ac-pending');
    await expect(list.locator('[data-card-grid] article img').first()).toBeVisible();
    await visit(page, '/es/pokedex/');
    await expect(list.locator('[data-card-grid] article')).toHaveCount(12);
    await visit(page, '/es/pokedex/?gen=4');
    await expect(list).not.toHaveAttribute('data-ac-pending');
    await expect(list.getByRole('link', { name: 'Chimchar', exact: true })).toBeVisible();
    await list.getByRole('link', { name: 'Chimchar', exact: true }).click();
    await expect(page).toHaveURL(/\/es\/pokedex\/chimchar\/$/);
    await expect(page.getByRole('heading', { name: 'Chimchar', exact: true })).toBeVisible();
    // The Pokémon page (§8.3): the art panel and the fixed sheet of the head row.
    await expect(page.locator('.ac-detail-head__art')).toBeVisible();
    await expect(page.getByRole('group', { name: 'Ficha de Chimchar' })).toContainText('T6');
    expect(browserErrors).toEqual([]);
  });

  test('Pokédex filters, empty state and pagination respond to input', async ({ page }) => {
    await visit(page, '/es/pokedex/?variante=shiny&elemento=fire');
    const list = listRoot(page, 'pokedex');
    await expect(list).not.toHaveAttribute('data-ac-pending');
    await expect(countOf(list)).toHaveText(/^\d+ Shiny$/);
    const cards = list.locator('[data-card-grid] article');
    await expect(cards.first().locator('.ac-dex-card__variant')).toContainText('Shiny');

    await visit(page, `/es/pokedex/${pokedexEmptyQuery()}`);
    await expect(list).not.toHaveAttribute('data-ac-pending');
    await expect(list.getByText(es.pokedex.empty)).toBeVisible();
    await list.getByRole('link', { name: es.pokedex.clearFilters }).click();
    await expect(page).toHaveURL(/\/es\/pokedex\/$/);
    await expect(cards).toHaveCount(12);

    const first = await cards.first().getAttribute('id');
    await list.locator('.ac-pagination').getByRole('link', { name: es.ui.next }).click();
    await expect(page).toHaveURL(/\/es\/pokedex\/\?page=2$/);
    await expect(cards).toHaveCount(12);
    await expect(cards.first()).not.toHaveAttribute('id', first ?? '');
  });

  test('Mapped outfits show the idle south frame while both auras animate', async ({ page }) => {
    // Six navigations and twenty animation reads: with several workers on one
    // development server this does not fit in the default budget.
    // The Pokédex cards of §8.2 show the art, not the outfit: the outfits are the panel of
    // each Pokémon page (8.3 step 3), which draws the idle south frame alone (X11, Q11).
    test.slow();
    for (const [slug, outfitId, size] of [
      ['bulbasaur', 2, 32],
      ['charmander', 5, 32],
      ['charizard', 7, 64],
      ['shiny-charizard', 509, 64],
      ['squirtle', 8, 32],
    ] as const) {
      await visit(page, `/es/pokedex/${slug}/`);
      const preview = page.getByTestId('outfit-preview');
      await expect(preview).toBeVisible();
      // A `client:visible` island: its buttons answer once it has been scrolled to and
      // hydrated.
      await hydrateInView(preview);
      const image = preview.locator('.ac-outfit-preview__stage img');
      await expect(image).toHaveAttribute('src', `/sprites/outfits/${outfitId}/sur.png`);
      await expect
        .poll(() => image.evaluate((node) => (node as HTMLImageElement).naturalWidth))
        .toBe(size);
      // No direction selector (X11): the frame stays the south one.
      await expect(preview.getByRole('button', { name: 'Norte' })).toHaveCount(0);

      // The first aura of the registry starts chosen, drawn by its shader (8.3 step 3).
      const alliance = preview.getByRole('button', { name: 'Alliance', exact: true });
      await expect(alliance).toHaveAttribute('aria-pressed', 'true');
      await expect(preview.locator('canvas')).toBeVisible();
      await expect(preview.locator('canvas')).toHaveAttribute('width', String(size + 2));
      await expect(preview.getByRole('status')).toHaveCount(0);
      const firstAlliance = await preview.locator('canvas').screenshot();
      await expect
        .poll(async () => !firstAlliance.equals(await preview.locator('canvas').screenshot()))
        .toBe(true);
      await preview.getByRole('button', { name: 'Premier', exact: true }).click();
      await expect(preview.getByRole('button', { name: 'Premier', exact: true })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      const firstPremier = await preview.locator('canvas').screenshot();
      await expect
        .poll(async () => !firstPremier.equals(await preview.locator('canvas').screenshot()))
        .toBe(true);
      await expect(image).toHaveAttribute('src', `/sprites/outfits/${outfitId}/sur.png`);
      await preview.getByRole('button', { name: 'Ninguna', exact: true }).click();
      await expect(preview.locator('canvas')).toHaveCount(0);
    }

    await visit(page, '/es/pokedex/shiny-bulbasaur/');
    await expect(page.getByTestId('outfit-preview')).toHaveCount(0);
  });

  test('English locale is a real route, not a browser preference', async ({ page }) => {
    const browserErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') browserErrors.push(message.text());
    });
    page.on('pageerror', (error) => browserErrors.push(error.message));

    await visit(page, '/en/');

    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page).toHaveTitle(en.home.documentTitle);
    await expect(page.locator(ERROR_OVERLAY)).toHaveCount(0);
    await expect(
      page.getByRole('heading', { level: 1, name: en.home.title, exact: true }),
    ).toBeVisible();
    // The language list of the header (7.10.1) links the same page in the other locale.
    await expect(page.locator('#idioma-cabecera a[hreflang="es"]')).toHaveAttribute('href', '/es/');
    expect(browserErrors).toEqual([]);
  });

  test('Wiki shell keeps its desktop geometry and visible entry points', async ({ page }) => {
    await page.setViewportSize({ width: 2518, height: 1376 });
    await visit(page, '/es/');

    const bodyFont = await page
      .locator('body')
      .evaluate((element) => getComputedStyle(element).fontFamily);
    expect(bodyFont).toContain('Verdana');

    // §5.5 past 1920: the main column stops at `layout-main-max` (1536) and the frame
    // spreads what is left around it, so at the reference width of RubinOT it sits at 491.
    const mainBox = await page.locator('main#contenido').boundingBox();
    expect(mainBox).not.toBeNull();
    expect(mainBox?.x).toBeCloseTo(491, 0);
    expect(mainBox?.width).toBeCloseTo(1536, 0);

    // The entry points of the Inicio (8.1): its search trigger and the panels of the bento,
    // each with one real 1 px border on its four sides and no shadow (5.1).
    for (const selector of ['.ac-home-search--wide .ac-search-trigger', '.ac-index-panel']) {
      const surface = page.locator(selector).first();
      await expect(surface).toBeVisible();
      const visualContract = await surface.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          borderTop: style.borderTopWidth,
          borderRight: style.borderRightWidth,
          borderBottom: style.borderBottomWidth,
          borderLeft: style.borderLeftWidth,
          shadow: style.boxShadow,
        };
      });
      expect(visualContract).toEqual({
        borderTop: '1px',
        borderRight: '1px',
        borderBottom: '1px',
        borderLeft: '1px',
        shadow: 'none',
      });
    }
  });

  test('The pages that close F2 answer with their content and their redirections', async ({
    page,
  }) => {
    // Actividades (§8.9): the index links each activity; its page shows the registry.
    await visit(page, '/es/actividades/');
    await expect(
      page.getByRole('heading', { level: 1, name: es.activities.title, exact: true }),
    ).toBeVisible();
    const quest = activities('es')[0];
    if (quest !== undefined) {
      await page
        .locator('main#contenido .ac-index-links')
        .getByRole('link', { name: quest.nombre })
        .click();
      await expect(page).toHaveURL(new RegExp(`/es/actividades/${quest.id}/$`));
      await expect(
        page.getByRole('heading', { level: 1, name: quest.nombre, exact: true }),
      ).toBeVisible();
    }

    // Herramientas (§8.10): Guild and Mapa, and the map is the placeholder of §8.11.
    await visit(page, '/es/herramientas/');
    await expect(
      page.getByRole('heading', { level: 1, name: es.tools.title, exact: true }),
    ).toBeVisible();
    await page
      .locator('main#contenido .ac-index-links')
      .getByRole('link', { name: es.map.title })
      .click();
    await expect(page).toHaveURL(/\/es\/mapa\/$/);
    await expect(
      page.getByRole('heading', { level: 1, name: es.map.title, exact: true }),
    ).toBeVisible();
    await expect(
      page.locator('main#contenido').getByText(es.map.empty, { exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId('map-explorer')).toHaveCount(0);

    // Comparar Pokémon until F5 (§8.14): the placeholder, with no explorer (§12.13).
    await visit(page, '/es/herramientas/pokemon/');
    await expect(
      page.getByRole('heading', { level: 1, name: es.compare.title, exact: true }),
    ).toBeVisible();
    await expect(
      page.locator('main#contenido').getByText(es.compare.empty, { exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId('pokemon-explorer')).toHaveCount(0);

    // Cambios (§8.7).
    await visit(page, '/es/cambios/');
    await expect(
      page.getByRole('heading', { level: 1, name: es.changes.title, exact: true }),
    ).toBeVisible();

    // Buscar (§8.6): the field is named by the h1 and filters the index as it is typed into.
    await visit(page, '/es/buscar/');
    await page.getByRole('searchbox', { name: es.search.title, exact: true }).fill('Charizard');
    await expect(
      page.locator('[data-ac-list="buscar"]').getByRole('link', { name: 'Charizard', exact: true }),
    ).toBeVisible();

    // §8.0.1: the retired routes land on the page that took them over.
    for (const [from, to] of [
      ['/es/guias/', /\/es\/actividades\/$/],
      ['/es/mapa/aportar/', /\/es\/mapa\/$/],
      ['/es/rotaciones/', /\/es\/pokedex\/tiers\/$/],
    ] as const) {
      await page.goto(from);
      await expect(page, `${from} redirects`).toHaveURL(to);
    }
  });

  test('Comercio lists the sample listings, opens a listing and its seller, and copies a draft', async ({
    page,
  }) => {
    // §9.5 to §9.8 in phase A, on the development server of §14.3, which reads the sample
    // registry (COMERCIO_DEMO=1): a listing is opened from the title of its card, its seller from
    // the detail, and the form's action copies the listing and never publishes it (§9.7.7). The
    // acceptance of §9.14 is tests/e2e/comercio.spec.ts; this is the path a reader walks.
    const { trade } = es;
    await visit(page, '/es/comercio/');
    await expect(page.locator(ERROR_OVERLAY)).toHaveCount(0);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Comercio', exact: true }),
    ).toBeVisible();
    const list = listRoot(page, 'comercio');
    await listReady(page, list);
    const create = page.locator('main').getByRole('link', { name: trade.create, exact: true });
    await expect(create).toHaveAttribute('href', '/es/comercio/publicar/');

    // The title of a card links to its detail (9.5.8), whose h1 is that title (9.6).
    const title = list
      .locator('[data-card-grid] article[id^="anuncio-"] .ac-card__title-link')
      .first();
    const name = (await title.innerText()).trim();
    await title.click();
    await expect(page).toHaveURL(/\/es\/comercio\/anuncio\/[a-z0-9-]+\/$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(name);
    await expect(page.getByRole('region', { name: trade.price, exact: true })).toBeVisible();

    // The seller of the detail links to the profile (9.6, 9.8), whose h1 is the seller's name,
    // both read from the sample registry by the id of the detail's route (S19).
    const id = new URL(page.url()).pathname.split('/').at(-2) ?? '';
    const handle = COMERCIO_LISTINGS.find((anuncio) => anuncio.id === id)?.vendedor;
    const sellerName = COMERCIO_SELLERS.find((vendedor) => vendedor.id === handle)?.nombre ?? '';
    expect(sellerName, `the seller of ${id} is in content/comercio/vendedores.json`).not.toBe('');
    await page
      .getByRole('region', { name: trade.listing.seller, exact: true })
      .getByRole('link', { name: sellerName, exact: true })
      .click();
    await expect(page).toHaveURL(`/es/comercio/vendedor/${handle}/`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(sellerName);

    // «Crear anuncio» (9.7): a Pokédólares amount shows its exact figure under the field, sprite
    // first (9.7.3, S8), and phase A has «Copiar anuncio» and no «Publicar» (9.2, CA-9.13).
    await visit(page, '/es/comercio/publicar/');
    await expect(
      page.getByRole('heading', { level: 1, name: trade.create, exact: true }),
    ).toBeVisible();
    await page
      .locator('#lf-type')
      .getByRole('button', { name: trade.types.pokedolares, exact: true })
      .click();
    await page.locator('#lf-pokedolares').fill('50kk');
    const exact = page.locator('.ac-listing-form__exact');
    await expect(exact).toHaveText(formatPokedolaresLabel(50_000_000, 'es'));
    await expect(exact.locator('img')).toHaveAttribute('src', /\/sprites\/ui\/pokedolares\.png$/);
    await expect(page.getByRole('button', { name: trade.form.copy, exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Publicar/ })).toHaveCount(0);
  });
});
