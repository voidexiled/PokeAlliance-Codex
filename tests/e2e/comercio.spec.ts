// §9.14 acceptance of phase A (M12): Comercio — the list `/{l}/comercio/`, the detail of a listing
// `/{l}/comercio/anuncio/{id}/`, the profile of a seller `/{l}/comercio/vendedor/{handle}/` and the
// form `/{l}/comercio/publicar/` — over the sample registry of content/comercio/, which the
// development server of §14.3 reads because it runs with COMERCIO_DEMO=1 (playwright.config.ts).
//
// What it measures, by the ids of §9.14:
//
//  - CA-9.1 on the production output that the second server of §14.3 serves (`.vercel/output`
//    after `pnpm build`, without COMERCIO_DEMO): the list is the empty state alone and the
//    detail, the profile and `datos.json` answer 404. scripts/test/build-comercio-fases.mjs builds
//    the phases and checks the rest of CA-9.1 on the files (no listing id and no seller name in
//    any of them) and CA-9.18.
//  - CA-9.2 to CA-9.13, CA-9.17, CA-9.19 and CA-9.20 on the development server, and PR5 of the
//    data file `/{l}/comercio/datos.json` that src/integrations/comercio-fases.ts injects there.
//    CA-9.14 to CA-9.16 are phase B (M14). CA-9.4, CA-9.6, CA-9.12 and CA-9.19 have their unit
//    tests in tests/trade/; here they are measured on the pages that use those functions.
//
// S19 with the data: every expectation is computed from content/ when the spec loads — the
// listings the list shows, their order, their titles and prices, the sellers and the worlds —
// and never copied from a board (X4), so editing the sample registry changes what the spec
// expects. The browser clock is the fixed instant of §14.3 (tests/e2e/fixtures.ts) unless a test
// moves it, and the server writes its pages with the real clock: a listing is shown when it is
// public at both (9.4).
//
// Runs in the `desktop` project (1440 × 900). The 390 checks are viewport overrides of this spec.

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import AxeBuilder from '@axe-core/playwright';
import type { Locator, Page } from '@playwright/test';

import { en } from '../../src/i18n/messages/en';
import type { Messages } from '../../src/i18n/messages/en';
import { es } from '../../src/i18n/messages/es';
import {
  formatDiamonds,
  formatInteger,
  formatPokedolares,
  formatPokedolaresLabel,
  formatRealMoney,
} from '../../src/lib/format/numbers';
import type { Anuncio, Vendedor } from '../../src/lib/trade/types';
import { expect, test } from './fixtures';
import { FIXED_TIME } from './routes';

// ------------------------------------------------------------------------------ registries

type Locale = 'es' | 'en';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

function readJson<T>(file: string): T {
  const text = readFileSync(resolve(ROOT, file), 'utf8');
  return JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text) as T;
}

/** `hideDrafts` of src/lib/content/registry.ts, read from the environment of this run. */
const HIDE_DRAFTS = /^(?:1|true)$/i.test(process.env.OCULTAR_BORRADORES ?? '');

const ANUNCIOS = readJson<{ anuncios: Anuncio[] }>('content/comercio/anuncios.json').anuncios;
const VENDEDORES = readJson<{ vendedores: Vendedor[] }>(
  'content/comercio/vendedores.json',
).vendedores;
const SELLER = new Map(VENDEDORES.map((vendedor) => [vendedor.id, vendedor]));

const POKEMON_NAME = new Map(
  readJson<{ pokemon: { id: string; nombre: string }[] }>('content/pokemon.json').pokemon.map(
    (record) => [record.id, record.nombre],
  ),
);

type ItemRecord = { id: string; nombre: string; borrador?: boolean };

/** Every item of content/items/, drafts included: a listing names one by its id (9.4). */
const ITEM_NAME = new Map(
  readdirSync(resolve(ROOT, 'content', 'items'))
    .filter((file) => file.endsWith('.json') && file !== 'categorias.json')
    .flatMap((file) => readJson<{ items?: ItemRecord[] }>(`content/items/${file}`).items ?? [])
    .map((item) => [item.id, item.nombre]),
);

const WORLD_NAME = new Map(
  readJson<{ mundos: { id: string; nombre: string }[] }>('content/mundos.json').mundos.map(
    (world) => [world.id, world.nombre],
  ),
);

type OutfitRecord = { pokemon: string; addons: { id: string; borrador?: boolean }[] };

/** 9.7.2: the Pokémon whose outfit record has an addon this build keeps. */
const WITH_ADDONS = new Set(
  readJson<{ outfits: OutfitRecord[] }>('content/outfits.json')
    .outfits.filter((outfit) =>
      outfit.addons.some((addon) => !(HIDE_DRAFTS && addon.borrador === true)),
    )
    .map((outfit) => outfit.pokemon),
);

type MonedaList = Record<Locale, string[]> | null;

/** §3.13: the `moneda` object of content/items/diamantes.json, the rows of the Diamonds panel. */
const MONEDA = readJson<{ moneda?: { seCompranEn: MonedaList; seUsanEn: MonedaList } }>(
  'content/items/diamantes.json',
).moneda;

/**
 * 8.5, R2: the Diamonds panel has a row in `locale` when one list of `moneda` has an entry there;
 * with none, a mention of Diamonds is not a trigger.
 */
function diamondsPanelHasRows(locale: Locale): boolean {
  return [MONEDA?.seCompranEn, MONEDA?.seUsanEn].some((list) => (list?.[locale].length ?? 0) > 0);
}

const MESSAGES: Record<Locale, Messages> = { es, en };
const LOCALES: Locale[] = ['es', 'en'];

/** 9.4, R4: the fixed order of the asset types, of their tabs and of their groups. */
const TYPES = ['pokemon', 'items', 'diamonds', 'pokedolares'] as const;

/** 9.4: the real currencies, in the order of «Moneda» and of «Precio, menor primero». */
const REAL_CURRENCIES = ['BRL', 'USD', 'MXN'] as const;
/** The price groups of 9.5.5: the real currencies, then Pokédólares and Diamonds. */
const PRICE_GROUPS = [...REAL_CURRENCIES, 'pokedolares', 'diamonds'] as const;

/** 9.5.6: listings a page. */
const PAGE_SIZE = 24;

/** The instant the browser reads (§14.3). */
const FIXED = Date.parse(FIXED_TIME);

/** 9.4: public at `instant` — `publicado` or `reservado` and not yet expired. */
function publicAt(anuncio: Anuncio, instant: number): boolean {
  return (
    (anuncio.estado === 'publicado' || anuncio.estado === 'reservado') &&
    Date.parse(anuncio.expira) > instant
  );
}

/**
 * 9.4 and 9.5.5: what the list shows at a browser instant, in the default order «Recientes»
 * (`publicado` descending; equal instants keep the order of the file). The server wrote the
 * page with the real clock, so a listing is shown when it is public at both.
 */
function listedAt(instant: number): Anuncio[] {
  const now = Date.now();
  return ANUNCIOS.filter((anuncio) => publicAt(anuncio, now) && publicAt(anuncio, instant)).sort(
    (a, b) => Date.parse(b.publicado) - Date.parse(a.publicado),
  );
}

/** The listings of the list under the fixed clock, in the default order. */
const LISTED = listedAt(FIXED);

// ----------------------------------------------------------------------- texts of the data

const NUMBER_LOCALE: Record<Locale, string> = { es: 'es-ES', en: 'en-US' };

type Leaf = string | { one: string; other: string };

/** A count as the dictionary writes it, the figure formatted as §13.3 (13.2). */
function counted(leaf: Leaf, n: number, locale: Locale): string {
  const template =
    typeof leaf === 'string'
      ? leaf
      : new Intl.PluralRules(NUMBER_LOCALE[locale]).select(n) === 'one'
        ? leaf.one
        : leaf.other;
  return template.replace('{n}', formatInteger(n, locale));
}

function countText(n: number, locale: Locale): string {
  return counted(MESSAGES[locale].trade.list.count, n, locale);
}

/**
 * 9.4 `listingTitle(…).accesible`: the Pokémon's registry name, the item's registry name or the
 * declared one, the grouped Diamonds, or the exact figure of the Pokédólares.
 */
function accessibleTitle(anuncio: Anuncio, locale: Locale): string {
  if (anuncio.tipo === 'pokemon') return POKEMON_NAME.get(anuncio.pokemon?.pokemon ?? '') ?? '—';
  if (anuncio.tipo === 'items') {
    const item = anuncio.item;
    if (item === undefined) return '—';
    return ITEM_NAME.get(item.item) ?? item.item;
  }
  if (anuncio.tipo === 'diamonds') return formatDiamonds(anuncio.cantidad ?? null, locale);
  return formatPokedolaresLabel(anuncio.cantidad ?? null, locale);
}

/**
 * 9.5.8, the price of a slot's name: the real money; without it, the in-game options with their
 * exact figures joined with « o »; without either, «A convenir».
 */
function priceText(anuncio: Anuncio, locale: Locale): string {
  const { precio } = anuncio;
  if (precio.real !== null) {
    return formatRealMoney(Number(precio.real.importe), precio.real.moneda, locale);
  }
  if (precio.juego.length > 0) {
    return precio.juego
      .map((option) =>
        option.tipo === 'pokedolares'
          ? formatPokedolaresLabel(option.cantidad, locale)
          : formatDiamonds(option.cantidad, locale),
      )
      .join(` ${MESSAGES[locale].ui.or} `);
  }
  return MESSAGES[locale].trade.listing.negotiable;
}

/** 9.9: the public label of each channel of a seller, in the order of the registry. */
function channelLabels(handle: string, locale: Locale): string[] {
  const channels = MESSAGES[locale].trade.channels;
  return (SELLER.get(handle)?.canales ?? []).map((canal) => {
    if (canal.tipo === 'otra') return canal.etiqueta ?? '';
    return channels[canal.tipo].replace('{code}', canal.etiqueta ?? '').trim();
  });
}

/** A real amount as stored («90», «35.50»), in cents, so two amounts compare exactly. */
function cents(importe: string): number {
  const [whole, fraction = ''] = importe.split(/[.,]/);
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

/**
 * The amount of a listing in a currency of «Moneda» (9.5.4): its real money when the currency is
 * that one, or the in-game option of that currency; `null` when the listing has no such price.
 */
function amountIn(anuncio: Anuncio, currency: string): number | null {
  const { precio } = anuncio;
  if (precio.real !== null && precio.real.moneda === currency) return cents(precio.real.importe);
  const option = precio.juego.find((entry) => entry.tipo === currency);
  return option === undefined ? null : option.cantidad;
}

/** The exact short form of an amount of Pokédólares, as the copied text writes it (E12). */
function compact(units: number): string | null {
  if (units >= 1_000_000 && units % 1_000_000 === 0) return `${units / 1_000_000}kk`;
  if (units >= 1_000 && units % 1_000 === 0) return `${units / 1_000}k`;
  return null;
}

/** NFD without diacritics and in lower case, as the search of 9.5.2 compares. */
function folded(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

// --------------------------------------------------------------------------- page helpers

/** The development server compiles a page on its first request: its first hydration is slow. */
const READY_TIMEOUT = 30_000;

type ViewName = 'cards' | 'slots' | 'list';

/** The rows of each view, which carry the anchor `anuncio-{id}` (H7). */
const VIEW_ROWS: Record<ViewName, string> = {
  cards: '[data-card-grid] article[id^="anuncio-"]',
  slots: '[data-slots] li[id^="anuncio-"]',
  list: '[data-list] tr[id^="anuncio-"]',
};

/** 7.7.1: the key of the saved view of the `comercio` list (U6). */
const SAVED_VIEW = 'ac:vista:comercio';

function listRoot(page: Page, id: 'comercio' | 'comercio-vendedor' = 'comercio'): Locator {
  return page.locator(`.ac-entity-list[data-ac-list="${id}"]`);
}

/** The island hydrated and applied the state of the URL (PR1, PR4). */
async function listReady(page: Page, root: Locator): Promise<void> {
  await root.scrollIntoViewIfNeeded();
  await expect(page.locator('astro-island[ssr]').filter({ has: root })).toHaveCount(0, {
    timeout: READY_TIMEOUT,
  });
  await expect(root).not.toHaveAttribute('data-ac-pending', { timeout: READY_TIMEOUT });
}

async function openList(page: Page, locale: Locale, search = ''): Promise<Locator> {
  const path = `/${locale}/comercio/${search}`;
  const response = await page.goto(path);
  expect(response?.status(), `${path} answers 200`).toBe(200);
  const root = listRoot(page);
  await listReady(page, root);
  return root;
}

async function forgetView(page: Page): Promise<void> {
  await page.evaluate((key) => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // U6: storage may be blocked; nothing was saved then.
    }
  }, SAVED_VIEW);
}

function viewButton(root: Locator, locale: Locale, view: ViewName): Locator {
  return root
    .locator('.ac-view-toggle')
    .getByRole('button', { name: MESSAGES[locale].ui.views[view], exact: true });
}

async function chooseView(root: Locator, locale: Locale, view: ViewName): Promise<void> {
  await viewButton(root, locale, view).click();
  await expect(viewButton(root, locale, view)).toHaveAttribute('aria-pressed', 'true');
  await expect(root.locator(VIEW_ROWS[view]).first()).toBeAttached({ timeout: READY_TIMEOUT });
}

/** The ids the active view shows, in the order of the page. */
async function shownIds(root: Locator, view: ViewName): Promise<string[]> {
  return root
    .locator(VIEW_ROWS[view])
    .evaluateAll((nodes) => nodes.map((node) => node.id.replace(/^anuncio-/, '')));
}

function countOf(root: Locator): Locator {
  return root.locator('.ac-entity-list__bar .ac-count');
}

/** The Select of the FilterBar or of the results bar whose visible label is `label`. */
function selectNamed(root: Locator, label: string): Locator {
  return root
    .locator('[data-ac-select]')
    .filter({ has: root.page().locator('.ac-select__label', { hasText: label }) });
}

async function chooseOption(select: Locator, option: string): Promise<void> {
  await select.locator('[role="combobox"]').click();
  await select.locator('[role="option"]', { hasText: option }).first().click();
  await expect(select.locator('[role="combobox"]')).toHaveText(option);
}

/** Waits for the entry of an open panel to end (150 ms, §6.2), as tests/e2e/states.ts does. */
async function settled(panel: Locator): Promise<void> {
  await panel.evaluate((element) =>
    Promise.all(
      element
        .getAnimations({ subtree: true })
        .filter((animation) => animation.effect?.getComputedTiming().endTime !== Infinity)
        .map((animation) => animation.finished),
    ),
  );
}

/** Opens the game tooltip of `trigger` with the pointer, from outside it (7.5.4). */
async function hoverOpen(page: Page, trigger: Locator): Promise<Locator> {
  await page.mouse.move(0, 0);
  await trigger.hover();
  const panel = page.locator('[role="tooltip"][data-open]').first();
  await expect(panel).toBeVisible();
  await settled(panel);
  return panel;
}

async function closeTooltips(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
  await expect(page.locator('[role="tooltip"][data-open]')).toHaveCount(0);
}

// ---------------------------------------------------------------------------------- axe

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/** The pairs §13.7 keeps below the minimum contrast, as tests/e2e/a11y.spec.ts lists them. */
const CONTRAST_EXCEPTIONS = ['.ac-search-trigger', '.ac-bar-chart__bar--partial'];

/** CA-9.17, S12: axe finds no `serious` or `critical` violation. */
async function expectAxeClean(page: Page, where: string): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  const blocking: string[] = [];
  for (const violation of results.violations) {
    for (const node of violation.nodes) {
      const impact = node.impact ?? violation.impact ?? '';
      if (impact !== 'serious' && impact !== 'critical') continue;
      const target = node.target[node.target.length - 1];
      const selector = Array.isArray(target) ? target[target.length - 1] : String(target);
      if (violation.id.startsWith('color-contrast')) {
        const excepted = await page.evaluate(
          ({ css, pairs }) => {
            const element = document.querySelector(css);
            return element !== null && pairs.some((pair) => element.closest(pair) !== null);
          },
          { css: selector, pairs: CONTRAST_EXCEPTIONS },
        );
        if (excepted) continue;
      }
      blocking.push(`${violation.id} (${impact}) · ${selector} · ${violation.help}`);
    }
  }
  expect.soft(blocking, `CA-9.17, axe ${WCAG_TAGS.join(' ')} · ${where}`).toEqual([]);
}

// ------------------------------------------------------------------------ the data it needs

/** A listing of each kind the tests below read, from the sample registry. */
const POKEDOLARES_LISTING = LISTED.find((anuncio) => anuncio.tipo === 'pokedolares');
const NICKNAMED = LISTED.find(
  (anuncio) => anuncio.tipo === 'pokemon' && (anuncio.pokemon?.nickname ?? '').includes(' '),
);
const FIRST_DETAIL = LISTED[0];
const FIRST_SELLER = VENDEDORES[0];

test.beforeAll(() => {
  // §9.4 asks the sample registry for one listing of each type and a Pokémon with a nickname,
  // among others; without them these tests would measure nothing.
  expect(LISTED.length, 'content/comercio/anuncios.json has public listings').toBeGreaterThan(0);
  expect(
    new Set(LISTED.map((anuncio) => anuncio.tipo)).size,
    'the sample registry lists every asset type (9.4)',
  ).toBe(TYPES.length);
});

// ================================================================================ CA-9.1

/**
 * Server 2 of §14.3 (playwright.config.ts): scripts/test/serve-vercel-output.mjs over
 * `.vercel/output`, the production build, which runs without COMERCIO_DEMO.
 */
const OUTPUT_ORIGIN = 'http://127.0.0.1:4322';

test('CA-9.1: sin COMERCIO_DEMO la lista es el estado vacío y no existen detalle, perfil ni datos', async ({
  page,
  request,
}) => {
  for (const locale of LOCALES) {
    const { trade } = MESSAGES[locale];
    const response = await page.goto(`${OUTPUT_ORIGIN}/${locale}/comercio/`);
    expect(response?.status(), `/${locale}/comercio/ answers 200 in the production output`).toBe(
      200,
    );
    const main = page.locator('main#contenido');
    for (const [selector, what] of [
      ['astro-island', 'an island'],
      ['[data-ac-list]', 'a list'],
      ['.ac-listing-card', 'a ListingCard'],
      ['.ac-entity-slot', 'an EntitySlot'],
      ['.ac-list-row', 'a listing row'],
      ['input[type="search"]', 'the search'],
      ['.ac-toggle-group', 'the type tabs'],
      ['.ac-filter-bar', 'the filters'],
      ['.ac-count', 'the results bar'],
      ['.ac-view-toggle', 'the view switch'],
      ['.ac-pagination', 'the pagination'],
    ] as const) {
      await expect(
        main.locator(selector),
        `CA-9.1: /${locale}/comercio/ has no ${what}`,
      ).toHaveCount(0);
    }
    await expect(page.locator('.ac-info-banner'), 'CA-9.1: no InfoBanner (R12)').toHaveCount(0);
    await expect(main.locator('.ac-empty-state__text')).toHaveText(trade.list.empty);
    const create = main.getByRole('link', { name: trade.create, exact: true });
    await expect(create).toHaveAttribute('href', `/${locale}/comercio/publicar/`);

    for (const path of [
      `/${locale}/comercio/anuncio/${ANUNCIOS[0].id}/`,
      `/${locale}/comercio/vendedor/${VENDEDORES[0].id}/`,
      `/${locale}/comercio/datos.json`,
    ]) {
      const answer = await request.get(`${OUTPUT_ORIGIN}${path}`, { maxRedirects: 0 });
      expect(answer.status(), `CA-9.1: ${path} does not exist in production`).toBe(404);
    }
  }
});

// =================================================================================== PR5

test('PR5: /{l}/comercio/datos.json lleva cada anuncio público una vez, en el orden por defecto', async ({
  request,
}) => {
  // The endpoint writes the list with the clock of the request (9.4), in «Recientes» (9.5.5).
  const now = Date.now();
  const expected = ANUNCIOS.filter((anuncio) => publicAt(anuncio, now))
    .sort((a, b) => Date.parse(b.publicado) - Date.parse(a.publicado))
    .map((anuncio) => anuncio.id);
  for (const locale of LOCALES) {
    const answer = await request.get(`/${locale}/comercio/datos.json`);
    expect(answer.status(), `/${locale}/comercio/datos.json exists with COMERCIO_DEMO`).toBe(200);
    const data = (await answer.json()) as { v: number; campos: string[]; filas: unknown[][] };
    expect(data.v).toBe(1);
    const id = data.campos.indexOf('id');
    expect(id, 'the rows carry the id of each listing').toBeGreaterThanOrEqual(0);
    expect(data.filas.map((fila) => fila[id])).toEqual(expected);
  }
});

// ================================================================================ CA-9.2

/** S2: in every card grid of the list, each row has one height and each zone one start. */
async function gridSpreads(root: Locator) {
  return root.locator('.ac-card-grid__grid').evaluateAll((grids) =>
    grids.map((grid) => {
      const cards = [...grid.children] as HTMLElement[];
      const rows: { top: number; cards: HTMLElement[] }[] = [];
      for (const card of cards) {
        const top = card.getBoundingClientRect().top;
        let row = rows.find((entry) => Math.abs(entry.top - top) < 1);
        if (!row) rows.push((row = { top, cards: [] }));
        row.cards.push(card);
      }
      let rowSpread = 0;
      let zoneSpread = 0;
      for (const row of rows) {
        const heights = row.cards.map((card) => card.getBoundingClientRect().height);
        rowSpread = Math.max(rowSpread, Math.max(...heights) - Math.min(...heights));
        const starts = new Map<number, number[]>();
        for (const card of row.cards) {
          const top = card.getBoundingClientRect().top;
          [...card.children].forEach((zone, index) => {
            const list = starts.get(index) ?? [];
            list.push(zone.getBoundingClientRect().top - top);
            starts.set(index, list);
          });
        }
        for (const list of starts.values()) {
          if (list.length === row.cards.length) {
            zoneSpread = Math.max(zoneSpread, Math.max(...list) - Math.min(...list));
          }
        }
      }
      return { cards: cards.length, rowSpread, zoneSpread };
    }),
  );
}

/** The groups of the Cards view with «Todos»: the name of each head and the ids of its cards. */
async function cardGroups(root: Locator) {
  return root.locator('[data-card-grid] .ac-card-group').evaluateAll((groups) =>
    groups.map((group) => {
      const head = group.querySelector('.ac-card-group__head');
      const count = head?.querySelector('.ac-card-group__count')?.textContent ?? '';
      const name = [...(head?.childNodes ?? [])]
        .filter((node) => !(node instanceof Element && node.matches('.ac-card-group__count')))
        .map((node) => node.textContent ?? '')
        .join('')
        .trim();
      return {
        name,
        count: count.trim(),
        ids: [...group.querySelectorAll('article[id^="anuncio-"]')].map((article) =>
          article.id.replace(/^anuncio-/, ''),
        ),
      };
    }),
  );
}

/** The groups the first page of `listings` draws: the types in the fixed order, none empty. */
function expectedGroups(listings: Anuncio[], locale: Locale) {
  const page = listings.slice(0, PAGE_SIZE);
  return TYPES.flatMap((type) => {
    const ids = page.filter((anuncio) => anuncio.tipo === type).map((anuncio) => anuncio.id);
    return ids.length === 0
      ? []
      : [
          {
            name: MESSAGES[locale].trade.types[type],
            count: formatInteger(ids.length, locale),
            ids,
          },
        ];
  });
}

test('CA-9.2: en Cards con «Todos» los grupos van en el orden fijo, sin grupos vacíos, y cada rejilla cumple S2', async ({
  page,
}) => {
  test.setTimeout(120_000);
  // A currency whose listings leave out at least one type, so a group is missing from the page.
  const partial = PRICE_GROUPS.map((currency) => ({
    currency,
    listings: LISTED.filter((anuncio) => amountIn(anuncio, currency) !== null),
  })).find(
    ({ listings }) =>
      listings.length > 0 && new Set(listings.map((anuncio) => anuncio.tipo)).size < TYPES.length,
  );

  for (const locale of LOCALES) {
    const root = await openList(page, locale);
    await forgetView(page);
    expect(await cardGroups(root), `CA-9.2 in ${locale}`).toEqual(expectedGroups(LISTED, locale));
    for (const grid of await gridSpreads(root)) {
      expect.soft(grid.rowSpread, 'S2: one height per row').toBeLessThanOrEqual(0.5);
      expect.soft(grid.zoneSpread, 'S2: one start per zone').toBeLessThanOrEqual(0.5);
    }

    expect(partial, 'the sample registry has a currency that leaves a type out').toBeDefined();
    if (partial === undefined) continue;
    const filtered = await openList(page, locale, `?moneda=${partial.currency}`);
    expect(
      await cardGroups(filtered),
      `CA-9.2: with ?moneda=${partial.currency} only the types it has`,
    ).toEqual(expectedGroups(partial.listings, locale));
  }
});

// ================================================================================ CA-9.3

test('CA-9.3: «Pokémon» escribe ?tipo=pokemon sin entrada nueva, cuenta el registro y cierra el tooltip', async ({
  page,
}) => {
  const { trade } = MESSAGES.es;
  const root = await openList(page, 'es');
  const pokemon = LISTED.filter((anuncio) => anuncio.tipo === 'pokemon');

  // A tooltip open in a card: its Ball, a held item or an element.
  await hoverOpen(page, root.locator('[data-card-grid] [data-ac-tt] :is(a, button)').first());
  const before = await page.evaluate(() => history.length);

  await root
    .locator('.ac-toggle-group--tab')
    .getByRole('button', { name: trade.types.pokemon, exact: true })
    .click();

  await expect.poll(() => new URL(page.url()).searchParams.get('tipo')).toBe('pokemon');
  expect(await page.evaluate(() => history.length), 'H1: no new history entry').toBe(before);
  await expect(countOf(root)).toHaveText(countText(pokemon.length, 'es'));
  await expect(page.locator('[role="tooltip"][data-open]'), 'the tooltip closed').toHaveCount(0);
  expect(await shownIds(root, 'cards')).toEqual(
    pokemon.slice(0, PAGE_SIZE).map((anuncio) => anuncio.id),
  );
});

// ================================================================================ CA-9.4

/** 9.5.5 «Precio, menor primero», computed on its own: group, amount, then the newest first. */
function byPrice(listings: Anuncio[]): Anuncio[] {
  const key = (anuncio: Anuncio): [number, number] | null => {
    const { precio } = anuncio;
    if (precio.aConvenir) return null;
    if (precio.real !== null) {
      return [PRICE_GROUPS.indexOf(precio.real.moneda), cents(precio.real.importe)];
    }
    const first = precio.juego[0];
    return first === undefined ? null : [PRICE_GROUPS.indexOf(first.tipo), first.cantidad];
  };
  return [...listings].sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    if (ka === null || kb === null) {
      if (ka !== kb) return ka === null ? 1 : -1;
    } else if (ka[0] !== kb[0]) return ka[0] - kb[0];
    else if (ka[1] !== kb[1]) return ka[1] - kb[1];
    return Date.parse(b.publicado) - Date.parse(a.publicado);
  });
}

test('CA-9.4: «Precio, menor primero» agrupa por moneda, sube dentro de cada una y deja «A convenir» al final', async ({
  page,
}) => {
  const { trade } = MESSAGES.es;
  const root = await openList(page, 'es', '?view=list');
  await expect(root.locator(VIEW_ROWS.list).first()).toBeAttached({ timeout: READY_TIMEOUT });
  await chooseOption(selectNamed(root, MESSAGES.es.ui.sortBy), trade.list.sort.precio);
  await expect.poll(() => new URL(page.url()).searchParams.get('sort')).toBe('precio');

  const expected = byPrice(LISTED).slice(0, PAGE_SIZE);
  // The Lista follows the chosen order and never groups (9.5.8).
  expect(await shownIds(root, 'list')).toEqual(expected.map((anuncio) => anuncio.id));
  const negotiable = expected.filter((anuncio) => anuncio.precio.aConvenir);
  if (negotiable.length > 0) {
    expect(expected.slice(-negotiable.length), '«A convenir» goes last').toEqual(negotiable);
  }
});

// ================================================================================ CA-9.5

test('CA-9.5: sin moneda el precio está desactivado; con Pokédólares «Mín 50kk» deja fuera lo que cuesta menos', async ({
  page,
}) => {
  const { trade } = MESSAGES.es;
  const root = await openList(page, 'es');
  const range = root.locator('.ac-range-field');
  await expect(range.locator('legend')).toHaveText(trade.filters.priceNeedsCurrency);
  await expect(range.locator('input')).toHaveCount(2);
  for (const input of await range.locator('input').all()) await expect(input).toBeDisabled();

  await chooseOption(selectNamed(root, trade.currency), MESSAGES.es.ui.tooltip.pokedolares);
  await expect.poll(() => new URL(page.url()).searchParams.get('moneda')).toBe('pokedolares');
  for (const input of await range.locator('input').all()) await expect(input).toBeEnabled();
  const inPokedolares = LISTED.filter((anuncio) => amountIn(anuncio, 'pokedolares') !== null);
  await expect(countOf(root)).toHaveText(countText(inPokedolares.length, 'es'));

  await range.locator('input').first().fill('50kk');
  await expect.poll(() => new URL(page.url()).searchParams.get('min')).toBe('50kk');
  const atLeast = inPokedolares.filter(
    (anuncio) => (amountIn(anuncio, 'pokedolares') ?? 0) >= 50_000_000,
  );
  await expect(countOf(root)).toHaveText(countText(atLeast.length, 'es'));
  expect((await shownIds(root, 'cards')).sort()).toEqual(
    atLeast.map((anuncio) => anuncio.id).sort(),
  );
});

// ================================================================================ CA-9.6

test('CA-9.6: la búsqueda encuentra el Boost, el nickname sin espacios, la forma corta exacta y la Ball o el aura', async ({
  page,
}) => {
  const withBoost = LISTED.find((anuncio) => typeof anuncio.pokemon?.boost === 'number');
  const shortForms = (anuncio: Anuncio): string[] => {
    const amounts = [
      ...(anuncio.tipo === 'pokedolares' && anuncio.cantidad !== undefined
        ? [anuncio.cantidad]
        : []),
      ...anuncio.precio.juego
        .filter((option) => option.tipo === 'pokedolares')
        .map((option) => option.cantidad),
    ];
    return amounts.flatMap((units) => compact(units) ?? []);
  };
  const withShort = LISTED.find((anuncio) => shortForms(anuncio).length > 0);
  const nickname = NICKNAMED?.pokemon?.nickname ?? null;

  const queries: { query: string; expected: Anuncio[] }[] = [];
  if (withBoost !== undefined) {
    const boost = withBoost.pokemon?.boost as number;
    queries.push({
      query: `+${boost}`,
      expected: LISTED.filter((anuncio) => anuncio.pokemon?.boost === boost),
    });
  }
  if (nickname !== null) {
    const query = folded(nickname.replace(/\s+/g, ''));
    queries.push({
      query,
      expected: LISTED.filter((anuncio) =>
        folded((anuncio.pokemon?.nickname ?? '').replace(/\s+/g, '')).includes(query),
      ),
    });
  }
  if (withShort !== undefined) {
    const query = shortForms(withShort)[0];
    queries.push({
      query,
      expected: LISTED.filter((anuncio) =>
        shortForms(anuncio).some((form) => form.includes(query)),
      ),
    });
  }
  const premier = (anuncio: Anuncio): boolean =>
    (anuncio.pokemon?.ball ?? '').includes('premier') ||
    (anuncio.pokemon?.auras ?? []).includes('premier');
  if (LISTED.some(premier)) queries.push({ query: 'premier', expected: LISTED.filter(premier) });
  expect(queries.length, 'the sample registry gives every query of CA-9.6').toBe(4);

  for (const { query, expected } of queries) {
    const root = await openList(page, 'es', `?q=${encodeURIComponent(query)}`);
    await expect(countOf(root), `CA-9.6: «${query}»`).toHaveText(countText(expected.length, 'es'));
    expect((await shownIds(root, 'cards')).sort(), `CA-9.6: «${query}»`).toEqual(
      expected.map((anuncio) => anuncio.id).sort(),
    );
  }
});

// ================================================================================ CA-9.7

/**
 * 9.5.8: the eight Lista columns at 944 (`canvas-v2/gen/gen_comercio.py:362`, `:367-369`) as the
 * board resolves them at 1440, measured with design/render/render.mjs on `Lienzo:Comercio` in
 * `{"view":"list"}`, like the Pokédex Lista (D-018): the table fills the 942 px inside the 1 px
 * border of its scroll box, the sprite column carries its 1 px divider (72 + 1) and «Anuncio» takes
 * what the fixed ones leave.
 */
const LIST_WIDTHS = [73, 156.9, 110, 74.1, 100, 176, 152, 100];

test('CA-9.7: las tres vistas muestran el mismo conjunto y orden; los slots se llaman «título, precio»; la Lista tiene sus 8 columnas', async ({
  page,
}) => {
  test.setTimeout(120_000);
  for (const locale of LOCALES) {
    const root = await openList(page, locale);
    await forgetView(page);
    const cards = await shownIds(root, 'cards');
    await chooseView(root, locale, 'slots');
    const slots = await shownIds(root, 'slots');
    await chooseView(root, locale, 'list');
    const list = await shownIds(root, 'list');

    const page1 = LISTED.slice(0, PAGE_SIZE).map((anuncio) => anuncio.id);
    expect(list, 'CA-9.7: the Lista follows «Recientes» and never groups').toEqual(page1);
    const grouped = TYPES.flatMap((type) =>
      LISTED.slice(0, PAGE_SIZE)
        .filter((anuncio) => anuncio.tipo === type)
        .map((anuncio) => anuncio.id),
    );
    expect(cards, 'CA-9.7: Cards groups by type, each in the order chosen').toEqual(grouped);
    expect(slots, 'CA-9.7: Slots groups by type, each in the order chosen').toEqual(grouped);

    // 9.5.8: the Lista has 8 columns with the widths of the spec at 1440, and only scrolls
    // sideways below 944, so here the table fits its box.
    const table = await root.locator('[data-list] .ac-data-table').evaluate((box) => ({
      box: box.clientWidth,
      table: box.scrollWidth,
      widths: [...box.querySelectorAll('thead th')].map(
        (cell) => cell.getBoundingClientRect().width,
      ),
    }));
    expect(table.widths, 'CA-9.7: 8 columns').toHaveLength(LIST_WIDTHS.length);
    expect
      .soft(table.table, `CA-9.7: the Lista fits its ${table.box} px at 1440 and does not scroll`)
      .toBeLessThanOrEqual(table.box);
    LIST_WIDTHS.forEach((width, index) => {
      expect
        .soft(table.widths[index], `CA-9.7: column ${index + 1} is ${width} px wide (±1)`)
        .toBeGreaterThanOrEqual(width - 1);
      expect
        .soft(table.widths[index], `CA-9.7: column ${index + 1} is ${width} px wide (±1)`)
        .toBeLessThanOrEqual(width + 1);
    });

    // The accessible name of each slot (9.5.8): «{título accesible}, {precio}».
    await chooseView(root, locale, 'slots');
    const names = await root
      .locator('[data-slots] li[id^="anuncio-"] .ac-entity-slot')
      .evaluateAll((slotsFound) =>
        slotsFound.map((slot) => [
          slot.closest('li')?.id.replace(/^anuncio-/, '') ?? '',
          slot.getAttribute('aria-label') ?? '',
        ]),
      );
    const byId = new Map(LISTED.map((anuncio) => [anuncio.id, anuncio]));
    for (const [id, name] of names) {
      const anuncio = byId.get(id) as Anuncio;
      expect(name, `CA-9.7: the name of the slot of ${id}`).toBe(
        `${accessibleTitle(anuncio, locale)}, ${priceText(anuncio, locale)}`,
      );
    }
    await forgetView(page);
  }
});

// ================================================================================ CA-9.8

test('CA-9.8: la tarjeta no abre tooltip; su Ball, un held, un elemento y un importe de Diamonds sí', async ({
  page,
}) => {
  const root = await openList(page, 'es');
  const grid = root.locator('[data-card-grid]');

  // No card is a trigger (R3, S3): hovering its head, its facts and its footer opens nothing.
  expect(
    await grid
      .locator('article')
      .evaluateAll((articles) =>
        articles.filter((article) => article.closest('[data-ac-tt]') !== null).map((a) => a.id),
      ),
    'CA-9.8: no article is inside a trigger',
  ).toEqual([]);
  const card = grid.locator('article').first();
  for (const part of ['.ac-card__meta', '.ac-fact-list__label', '[data-zone="footer"]']) {
    const target = card.locator(part).first();
    if ((await target.count()) === 0) continue;
    await page.mouse.move(0, 0);
    await target.hover();
    await page.waitForTimeout(400);
    await expect(
      page.locator('[role="tooltip"][data-open]'),
      `CA-9.8: hovering ${part} of a card opens no tooltip`,
    ).toHaveCount(0);
  }

  // Its nested entities do (S3), each with its own panel. `NestedEntity` wraps the trigger of
  // each one in a `[data-ac-tt]` (7.5.4), and the trigger carries the class of what it draws.
  const ballRow = grid
    .locator('.ac-fact-list__row')
    .filter({ has: page.locator('.ac-fact-list__label', { hasText: /^Ball$/ }) });
  const triggers: [string, Locator][] = [
    ['la Ball', ballRow.locator('[data-ac-tt] > :is(a, button)').first()],
    ['un held', grid.locator('.ac-held-strip [data-ac-tt] > :is(a, button)').first()],
    ['un elemento', grid.locator('[data-ac-tt] > :is(a, button).ac-element-chip').first()],
  ];

  // The Diamonds of a price open the Diamonds panel, whose rows are the lists of the `moneda`
  // object of content/items/diamantes.json (§3.13, 9.5.8). With no row that panel has nothing to
  // show and the amount is plain text, not a trigger (8.5, R2).
  const diamonds = grid.locator('.ac-price-options .ac-diamonds-amount');
  await expect(
    diamonds.first(),
    'a card of the sample registry has a price in Diamonds',
  ).toBeVisible();
  if (diamondsPanelHasRows('es')) {
    triggers.push([
      'un importe de Diamonds',
      grid.locator('.ac-price-options [data-ac-tt] > :is(a, button).ac-diamonds-amount').first(),
    ]);
  } else {
    expect(
      await diamonds.evaluateAll(
        (amounts) => amounts.filter((amount) => amount.closest('[data-ac-tt]') !== null).length,
      ),
      'R2: without a row in `moneda`, no amount of Diamonds is a trigger',
    ).toBe(0);
  }

  for (const [what, trigger] of triggers) {
    if (what === 'un elemento' && (await trigger.count()) === 0) {
      // An element with neither Stone nor Fragment draws a plain chip (R2, D-021): the sample
      // registry may have no element with a panel.
      continue;
    }
    await expect(trigger, `CA-9.8: ${what} of a card is a trigger`).toHaveCount(1);
    const panel = await hoverOpen(page, trigger);
    await expect(panel, `CA-9.8: ${what} opens its panel`).toBeVisible();
    await closeTooltips(page);
  }
});

// ================================================================================ CA-9.9

test('CA-9.9: el tooltip de un Pokémon con nickname lleva el nickname de título, «Pokémon:» primero y solo etiquetas de contacto', async ({
  page,
}) => {
  expect(NICKNAMED, 'the sample registry has a Pokémon with a spaced nickname (9.4)').toBeDefined();
  if (NICKNAMED === undefined) return;
  for (const locale of LOCALES) {
    const root = await openList(page, locale, '?view=slots');
    const slot = root.locator(`[data-slots] li#anuncio-${NICKNAMED.id} .ac-entity-slot`);
    const panel = await hoverOpen(page, slot);
    await expect(panel.locator('.ac-game-tooltip__title')).toHaveText(
      NICKNAMED.pokemon?.nickname as string,
    );
    const labels = panel.locator('dt');
    await expect(labels.first()).toHaveText(`${MESSAGES[locale].trade.types.pokemon}:`);
    await expect(panel.locator('dd').first()).toHaveText(
      POKEMON_NAME.get(NICKNAMED.pokemon?.pokemon ?? '') as string,
    );
    const contact = panel
      .locator('dt', { hasText: `${MESSAGES[locale].trade.tip.contact}:` })
      .locator('xpath=following-sibling::dd[1]');
    await expect(contact, 'CA-9.9: only the public labels, never a value').toHaveText(
      channelLabels(NICKNAMED.vendedor, locale).join(', '),
    );
    await closeTooltips(page);
  }
});

// =============================================================================== CA-9.10

/** Every visible amount of Pokédólares under `scope`, as money.spec.ts reads one (§13.3). */
async function pokedolaresAmounts(scope: Locator) {
  return scope.locator('.ac-pokedolares-amount').evaluateAll((blocks) =>
    blocks
      .filter((block) => {
        const box = block.getBoundingClientRect();
        return box.width > 0 && box.height > 0;
      })
      .map((block) => {
        const squash = (text: string | null) => (text ?? '').replace(/\s+/g, ' ').trim();
        const number = [...block.children].find(
          (child) =>
            child.getAttribute('aria-hidden') === 'true' &&
            child.querySelector('img') === null &&
            squash(child.textContent) !== '',
        );
        const previous = number?.previousElementSibling ?? null;
        return {
          visible: squash(number?.textContent ?? null),
          spoken: squash(
            [...block.childNodes]
              .filter(
                (node) => !(node instanceof Element && node.getAttribute('aria-hidden') === 'true'),
              )
              .map((node) => node.textContent ?? '')
              .join(''),
          ),
          sprite: block.querySelector('img')?.getAttribute('src') ?? null,
          spriteFirst:
            previous !== null &&
            (previous.matches('img') || previous.querySelector('img') !== null),
        };
      }),
  );
}

async function expectMoney(scope: Locator, locale: Locale, where: string): Promise<number> {
  const amounts = await pokedolaresAmounts(scope);
  const separator = locale === 'es' ? '.' : ',';
  for (const amount of amounts) {
    expect(amount.sprite, `CA-9.10: the sprite of «${amount.visible}» on ${where}`).toMatch(
      /\/sprites\/ui\/pokedolares\.png$/,
    );
    expect(amount.spriteFirst, `CA-9.10: the sprite goes before «${amount.visible}»`).toBe(true);
    const figure = /^([\d.,]+) /.exec(amount.spoken)?.[1] ?? '';
    const units = Number(figure.split(separator).join(''));
    expect(Number.isSafeInteger(units), `CA-9.10: «${amount.spoken}» is an exact figure`).toBe(
      true,
    );
    expect(amount.spoken, `CA-9.10: the accessible name on ${where}`).toBe(
      formatPokedolaresLabel(units, locale),
    );
    expect(amount.visible, `§4.3: the short form on ${where}`).toBe(
      formatPokedolares(units, locale),
    );
  }
  // S8: no «KK», «KKs» or «gold» as a word in the text of the page.
  const words = await scope.evaluate((element) => {
    const found: string[] = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    while (walker.nextNode() !== null) {
      const text = walker.currentNode.textContent ?? '';
      if (/\bKKs?\b|\bgold\b/.test(text)) found.push(text.trim());
    }
    return found;
  });
  expect(words, `CA-9.10: no «KK», «KKs» or «gold» on ${where}`).toEqual([]);
  return amounts.length;
}

test('CA-9.10: cada importe de Pokédólares lleva antes su sprite y su cifra exacta en la lista, el detalle, el perfil y la vista previa', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const priced = LISTED.find((anuncio) =>
    anuncio.precio.juego.some((option) => option.tipo === 'pokedolares'),
  );
  expect(priced, 'a listing priced in Pokédólares').toBeDefined();
  if (priced === undefined || POKEDOLARES_LISTING === undefined) return;

  let seen = 0;
  for (const locale of LOCALES) {
    await openList(page, locale);
    seen += await expectMoney(page.locator('body'), locale, `/${locale}/comercio/`);

    for (const anuncio of [POKEDOLARES_LISTING, priced]) {
      await page.goto(`/${locale}/comercio/anuncio/${anuncio.id}/`);
      seen += await expectMoney(page.locator('body'), locale, `the detail of ${anuncio.id}`);
    }

    await page.goto(`/${locale}/comercio/vendedor/${priced.vendedor}/`);
    const profile = listRoot(page, 'comercio-vendedor');
    await listReady(page, profile);
    seen += await expectMoney(page.locator('body'), locale, `the profile of ${priced.vendedor}`);

    // 9.7.6: the preview is the real card of the draft.
    await page.goto(`/${locale}/comercio/publicar/`);
    await expect(page.locator('astro-island[ssr]')).toHaveCount(0, { timeout: READY_TIMEOUT });
    await page
      .locator('#lf-type')
      .getByRole('button', { name: MESSAGES[locale].trade.types.pokedolares, exact: true })
      .click();
    await page.locator('#lf-pokedolares').fill('50kk');
    const preview = page.locator('.ac-listing-form__preview');
    await expect(preview.locator('.ac-pokedolares-amount').first()).toBeVisible({
      timeout: READY_TIMEOUT,
    });
    seen += await expectMoney(preview, locale, `the preview of /${locale}/comercio/publicar/`);
  }
  expect(seen, 'the pages show amounts of Pokédólares').toBeGreaterThan(0);
});

// =============================================================================== CA-9.11

/** 9.7.7: the key of the visitor's draft, which the form restores when it opens. */
const DRAFT_KEY = 'alliance-codex:comercio:borrador:v1';

/** Opens the form with no draft of an earlier step, so each step starts from the empty form. */
async function openForm(page: Page, locale: Locale): Promise<void> {
  const path = `/${locale}/comercio/publicar/`;
  let response = await page.goto(path);
  const hadDraft = await page.evaluate((key) => {
    try {
      const saved = window.localStorage.getItem(key) !== null;
      window.localStorage.removeItem(key);
      return saved;
    } catch {
      return false; // storage blocked: the form restores nothing either (9.7.7)
    }
  }, DRAFT_KEY);
  if (hadDraft) response = await page.goto(path);
  expect(response?.status()).toBe(200);
  await expect(page.locator('astro-island[ssr]')).toHaveCount(0, { timeout: READY_TIMEOUT });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Picks the Pokémon `id` in the combobox of the form by its registry name, and only that one. */
async function choosePokemon(page: Page, id: string): Promise<void> {
  const name = POKEMON_NAME.get(id) as string;
  const field = page.locator('#lf-pokemon');
  await field.click();
  await field.fill(name);
  await page
    .locator('#lf-pokemon-list [role="option"]')
    .filter({
      has: page.locator('.ac-combobox__name', { hasText: new RegExp(`^${escapeRegExp(name)}$`) }),
    })
    .first()
    .click();
  await expect(field).toHaveValue(name);
}

test('CA-9.11: Memory Slots solo con Ditto, Boost 51 da su error, Addon según el Pokémon, la opción en Diamonds y el foco en el primer error', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const { trade } = MESSAGES.es;
  const errors = trade.form.errors;

  // Memory Slots and the memories exist only for Ditto and Shiny Ditto (9.7.2).
  await openForm(page, 'es');
  await expect(page.locator('#lf-memory-slots')).toHaveCount(0);
  const ditto = POKEMON_NAME.has('shiny-ditto') ? 'shiny-ditto' : 'ditto';
  await choosePokemon(page, ditto);
  await expect(page.locator('#lf-memory-slots')).toHaveValue('1');
  await expect(page.locator('#lf-memory-0')).toBeVisible();
  const other = [...POKEMON_NAME.keys()].find(
    (id) => id !== 'ditto' && id !== 'shiny-ditto' && !WITH_ADDONS.has(id),
  ) as string;
  await choosePokemon(page, other);
  await expect(page.locator('#lf-memory-slots')).toHaveCount(0);

  // «Addon» only with a Pokémon that has addons in content/outfits.json.
  await expect(page.locator('#lf-addon'), `${other} has no addon`).toHaveCount(0);
  const withAddon = [...WITH_ADDONS].find((id) => POKEMON_NAME.has(id));
  if (withAddon !== undefined) {
    await choosePokemon(page, withAddon);
    await expect(page.locator('#lf-addon'), `${withAddon} has an addon`).toHaveCount(1);
  }

  // Boost: after its first interaction, 51 is out of range and 50 is valid (9.7.5).
  const boost = page.locator('#lf-boost');
  await boost.click();
  await page.keyboard.press('Tab');
  await boost.click();
  await boost.fill('51');
  const message = errors.range.replace('{min}', '0').replace('{max}', '50');
  await expect(page.locator('#lf-boost-error')).toHaveText(message);
  await expect(boost).toHaveAttribute('aria-invalid', 'true');
  await expect(boost).toHaveAttribute('aria-describedby', /\blf-boost-error\b/);
  await boost.fill('50');
  await expect(page.locator('#lf-boost-error')).toHaveCount(0);
  await expect(boost).not.toHaveAttribute('aria-invalid', 'true');

  // The action with errors takes the focus to the first invalid field.
  await openForm(page, 'es');
  await page.locator('#lf-copy').click();
  await expect(page.locator('#lf-pokemon')).toBeFocused();
  await expect(page.locator('#lf-pokemon-error')).toHaveText(errors.pokemon);
  await expect(page.locator('#lf-pokemon')).toHaveAttribute('aria-invalid', 'true');

  // A listing of Diamonds takes no option in Diamonds (9.7.4, rule 3).
  await openForm(page, 'es');
  await page
    .locator('#lf-type')
    .getByRole('button', { name: trade.types.diamonds, exact: true })
    .click();
  await page.locator('#lf-diamonds').fill('300');
  await page.locator('#lf-game-0-kind').click();
  await page
    .locator('#lf-game-0-kind-list [role="option"]', { hasText: trade.types.diamonds })
    .click();
  await page.locator('#lf-game-0-amount').fill('10');
  await page.locator('#lf-world').click();
  await page.locator('#lf-world-list [role="option"]').first().click();
  await page.locator('#lf-copy').click();
  await expect(page.locator('#lf-game-0-kind-error')).toHaveText(errors.priceOption);
  await expect(page.locator('#lf-game-0-kind')).toBeFocused();
});

// ======================================================================= §12.16, §12.20

test('§12.16 y §12.20 (59–69): sin Ball estática, nada inválido antes de tocar, grupos de opción única y vista previa sin aria-live', async ({
  page,
}) => {
  const { trade } = MESSAGES.es;
  await openForm(page, 'es');
  const main = page.locator('main#contenido');

  // 9.7.5: a field validates after its first interaction, so a fresh form marks nothing.
  await expect(main.locator('.ac-listing-form__error')).toHaveCount(0);
  await expect(main.locator('[aria-invalid="true"]')).toHaveCount(0);

  // §12.16: no Ball, and no other picture, stands in the form as decoration. On a fresh form every
  // image is the sprite of an option of a single-choice group — the asset types of 9.5.1 and the
  // icons of content/auras.json — so the Ball field draws none until a Ball is declared.
  const images = await main.locator('img').evaluateAll((found) =>
    found.map((image) => ({
      src: image.getAttribute('src') ?? '',
      option: image.closest('button[aria-pressed]') !== null,
    })),
  );
  expect(images.length, 'the type tabs carry their sprites').toBeGreaterThan(0);
  expect(
    images.filter((image) => !image.option).map((image) => image.src),
    'images outside a single-choice option',
  ).toEqual([]);

  // §12.20: each single-choice group is a named `role="group"` of `aria-pressed` buttons with one
  // of them pressed (ToggleGroup, T10), and choosing another option moves the pressed state.
  for (const [id, label] of [
    ['lf-type', trade.typeLabel],
    ['lf-aura', trade.listing.keys.aura],
    ['lf-npc', trade.listing.keys.npcPrice],
  ] as const) {
    const group = main.locator(`#${id} [role="group"]`);
    await expect(group, `${id} is one group`).toHaveCount(1);
    await expect(group).toHaveAccessibleName(label);
    expect(await group.locator('button').count(), `${id} offers a choice`).toBeGreaterThan(1);
    await expect(group.locator('button:not([aria-pressed])')).toHaveCount(0);
    await expect(group.locator('button[aria-pressed="true"]')).toHaveCount(1);
  }
  const npc = main.locator('#lf-npc [role="group"]');
  const unsellable = npc.getByRole('button', { name: trade.unsellable, exact: true });
  await unsellable.click();
  await expect(unsellable).toHaveAttribute('aria-pressed', 'true');
  await expect(npc.locator('button[aria-pressed="true"]')).toHaveCount(1);

  // 9.7.6: the preview is not a live region, and nothing around it or inside it is one.
  const [first] = POKEMON_NAME.keys();
  await choosePokemon(page, first);
  const preview = main.locator('.ac-listing-form__preview');
  await expect(preview).toBeVisible();
  expect(
    await preview.evaluate(
      (region) =>
        region.closest('[aria-live]') === null && region.querySelector('[aria-live]') === null,
    ),
    'the preview is not aria-live',
  ).toBe(true);
});

// =============================================================================== CA-9.12

test('CA-9.12: «Copiar anuncio» copia el texto de §9.7.7 y el textarea solo aparece si la copia falla', async ({
  page,
}) => {
  const { trade } = MESSAGES.es;
  const origin = new URL(test.info().project.use.baseURL ?? 'http://127.0.0.1:4321').origin;
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
  await openForm(page, 'es');

  await page
    .locator('#lf-type')
    .getByRole('button', { name: trade.types.diamonds, exact: true })
    .click();
  await page.locator('#lf-diamonds').fill('300');
  await page.locator('#lf-real').fill('90');
  await page.locator('#lf-world').click();
  const world = (
    (await page.locator('#lf-world-list [role="option"]').first().textContent()) ?? ''
  ).trim();
  // 9.7.1: «Mundo» offers the worlds of content/mundos.json.
  expect([...WORLD_NAME.values()]).toContain(world);
  await page.locator('#lf-world-list [role="option"]').first().click();

  await page.locator('#lf-copy').click();
  await expect(page.locator('main .ac-notice')).toContainText(trade.form.copied);
  await expect(page.locator('#lf-text'), 'CA-9.12: no textarea while the copy works').toHaveCount(
    0,
  );
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  // §9.7.7: one line per declared fact, in the order of the sheet (Windows writes CRLF).
  expect(copied.replace(/\r\n/g, '\n')).toBe(
    [
      `${trade.copy.selling}: ${formatDiamonds(300, 'es')}`,
      `${trade.copy.fiat}: R$ 90`,
      `${trade.copy.world}: ${world}`,
    ].join('\n'),
  );

  // When the copy fails, the notice asks to copy by hand and the text is there, selected.
  await page.evaluate(() => {
    Object.defineProperty(navigator.clipboard, 'writeText', {
      configurable: true,
      value: () => Promise.reject(new Error('denied')),
    });
  });
  await page.locator('#lf-copy').click();
  await expect(page.locator('main .ac-notice')).toContainText(trade.form.copyFailed);
  const text = page.locator('#lf-text');
  await expect(text).toBeFocused();
  await expect(text).toHaveValue(copied.replace(/\r\n/g, '\n'));
});

// =============================================================================== CA-9.13

test('CA-9.13: sin COMERCIO_PUBLICO ninguna página de Comercio tiene acciones ni enlaces de la fase B', async ({
  page,
}) => {
  test.setTimeout(120_000);
  // The labels of the actions of phase B (9.6, 9.7.8, 9.11), as a control writes them: capital
  // first and a whole word, so «El comprador contacta al vendedor» of the banner is not one.
  const words: Record<Locale, RegExp[]> = {
    es: [/\bContactar al vendedor\b/, /\bReportar\b/, /\bPublicar\b/],
    en: [/\bContact (?:the )?seller\b/, /\bReport\b/, /\bPublish\b/],
  };
  for (const locale of LOCALES) {
    for (const path of [
      `/${locale}/comercio/`,
      `/${locale}/comercio/anuncio/${FIRST_DETAIL.id}/`,
      `/${locale}/comercio/vendedor/${FIRST_SELLER.id}/`,
      `/${locale}/comercio/publicar/`,
    ]) {
      const response = await page.goto(path);
      expect(response?.status(), `${path} answers 200`).toBe(200);
      await expect(page.locator('astro-island[ssr]')).toHaveCount(0, { timeout: READY_TIMEOUT });
      const text = await page.evaluate(() => document.body.innerText);
      for (const word of words[locale]) {
        expect(text, `CA-9.13: ${path} has no «${word.source}»`).not.toMatch(word);
      }
      await expect(
        page.locator(
          'a[href*="/cuenta/"], a[href*="/comercio/operaciones/"], a[href*="/comercio/moderacion/"]',
        ),
        `CA-9.13: ${path} links no page of phase B`,
      ).toHaveCount(0);
    }
  }
});

// =============================================================================== CA-9.17

test.describe('CA-9.17: axe en la lista, el detalle, el perfil y el formulario con errores', () => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    test(`a ${viewport.width}`, async ({ page }) => {
      test.setTimeout(180_000);
      await page.setViewportSize(viewport);
      const root = await openList(page, 'es');
      await forgetView(page);
      await expectAxeClean(page, `/es/comercio/ · Cards · ${viewport.width}`);
      for (const view of ['slots', 'list'] as const) {
        await chooseView(root, 'es', view);
        await expectAxeClean(page, `/es/comercio/ · ${view} · ${viewport.width}`);
      }
      await forgetView(page);

      await page.goto(`/es/comercio/anuncio/${FIRST_DETAIL.id}/`);
      await expectAxeClean(page, `the detail of ${FIRST_DETAIL.id} · ${viewport.width}`);

      await page.goto(`/es/comercio/vendedor/${FIRST_SELLER.id}/`);
      await listReady(page, listRoot(page, 'comercio-vendedor'));
      await expectAxeClean(page, `the profile of ${FIRST_SELLER.id} · ${viewport.width}`);

      await openForm(page, 'es');
      await page.locator('#lf-copy').click();
      await expect(page.locator('#lf-pokemon')).toBeFocused();
      await expectAxeClean(page, `/es/comercio/publicar/ with errors · ${viewport.width}`);
    });
  }
});

// =============================================================================== CA-9.19

test('CA-9.19: el h1 y el <title> del detalle de un anuncio de Pokédólares llevan la cifra exacta', async ({
  page,
}) => {
  expect(POKEDOLARES_LISTING, 'a listing of Pokédólares (9.4)').toBeDefined();
  if (POKEDOLARES_LISTING === undefined) return;
  for (const locale of LOCALES) {
    await page.goto(`/${locale}/comercio/anuncio/${POKEDOLARES_LISTING.id}/`);
    const exact = formatPokedolaresLabel(POKEDOLARES_LISTING.cantidad ?? null, locale);
    await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName(exact);
    await expect(page).toHaveTitle(`${exact} · PokeAlliance Wiki`);
  }
});

// =============================================================================== CA-9.20

test('CA-9.20: con el reloj después de `expira`, el anuncio sale de la lista y del perfil y su detalle dice «Expirado»', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const { trade } = MESSAGES.es;

  // Under the clock of §14.3: a `publicado` listing whose `expira` is behind it.
  const expired = ANUNCIOS.filter(
    (anuncio) => anuncio.estado === 'publicado' && Date.parse(anuncio.expira) <= FIXED,
  );
  for (const anuncio of expired) {
    const root = await openList(page, 'es');
    expect(await shownIds(root, 'cards'), `${anuncio.id} is not listed`).not.toContain(anuncio.id);
    await page.goto(`/es/comercio/vendedor/${anuncio.vendedor}/`);
    const profile = listRoot(page, 'comercio-vendedor');
    if ((await profile.count()) > 0) {
      await listReady(page, profile);
      expect(await shownIds(profile, 'cards')).not.toContain(anuncio.id);
    }
    await page.goto(`/es/comercio/anuncio/${anuncio.id}/`);
    await expect(page.locator('main')).toContainText(trade.states.expirado);
  }

  // With the visitor's clock after the `expira` the server still lists: the island drops the
  // listing once it hydrates and the detail writes the state again (9.4, 9.6).
  const target = LISTED[0];
  const late = new Date(Date.parse(target.expira) + 60_000);
  await page.clock.setFixedTime(late);
  const stillListed = listedAt(late.getTime());
  const root = await openList(page, 'es');
  await expect(countOf(root)).toHaveText(countText(stillListed.length, 'es'));
  expect(await shownIds(root, 'cards')).not.toContain(target.id);

  await page.goto(`/es/comercio/vendedor/${target.vendedor}/`);
  const profile = listRoot(page, 'comercio-vendedor');
  if ((await profile.count()) > 0) {
    await listReady(page, profile);
    expect(await shownIds(profile, 'cards')).not.toContain(target.id);
  }

  await page.goto(`/es/comercio/anuncio/${target.id}/`);
  await expect(page.locator('main')).toContainText(trade.states.expirado);
  for (const action of [/Contactar al vendedor/, /\bRenovar\b/, /\bEditar\b/, /Marcar como/]) {
    await expect(page.locator('main')).not.toContainText(action);
  }
});
