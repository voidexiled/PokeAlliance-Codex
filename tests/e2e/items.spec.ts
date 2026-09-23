// §8.5 acceptance (M9): Ítems por categoría del Market — `/{l}/items/` («Todo») and each
// `/{l}/items/c/{categoria}/` — against the real pages, over the registries the development
// server reads.
//
// What it measures, by the ids of the spec:
//
//  - IT1 to IT6 (§8.5). IT2 only means something in a run with `OCULTAR_BORRADORES=1`, and
//    IT3 only when the registry gives an item a price: both are skipped, never passed, in a
//    run that cannot reach them. The half of IT2 about the Ítems panel of the Inicio page is
//    not here: that page arrives with M10.
//  - The protocol of §8.0.7 on both pages: WG1 (the frame of §5.5 at 1440 and 390, no
//    sideways scroll at 390), WG4 (the columns of the `loot` family of `CGS §4` at the five
//    widths of `DS:guias/30`; §8.5 has no board), WG5 (every internal link answers 200, or
//    302 towards a page that does, and none points at a retired route), WA1 (axe in the
//    three views, with a tooltip open and with the phone sheet open), WA2 (one
//    h1, no skipped heading level, named landmarks, a caption on every table), WA3 (the
//    `aria-current` of the menu, of the pagination and of the current category tab, and
//    `aria-pressed` on every toggle — never on a tab, IT6), WA4 (`lang` of a text that only
//    the other language has) and WD1 (every count is the one the registry gives, in «Todo»
//    and by category).
//  - S4: the three views of a page show the same items, and the items of a group keep their
//    order in every view.
//  - U3: the category is a registry id, not a word of a dictionary, so the same route and the
//    same query serve `es` and `en` with the same items.
//
// The list controller itself (U1–U6, H1–H7, V1–V8, PR1–PR5) is tests/e2e/lists.spec.ts; the
// island and the data endpoint are src/components/items/ and
// src/pages/[locale]/items/datos.json.ts.
//
// S19 with the data: every expectation below is computed from `content/` when the spec loads,
// never copied from a board (X4), so changing a test record changes the figure the spec
// expects. Run with `OCULTAR_BORRADORES=1` and no server on 4321 — Playwright passes its
// environment to the server it starts — and the spec expects no `borrador` item on any page:
//
//   OCULTAR_BORRADORES=1 pnpm exec playwright test --project=desktop tests/e2e/items.spec.ts
//
// Runs in the `desktop` project. The 390 checks are viewport overrides of this spec, as in
// tests/e2e/frame.spec.ts, with a touch-free pointer: the touch target sizes are
// contract.spec.ts's.

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import AxeBuilder from '@axe-core/playwright';
import type { Locator, Page } from '@playwright/test';

import { en } from '../../src/i18n/messages/en';
import type { Messages } from '../../src/i18n/messages/en';
import { es } from '../../src/i18n/messages/es';
import { formatPokedolares, formatPokedolaresLabel } from '../../src/lib/format/numbers';
import { idiomas } from '../../scripts/lib/rutas-migradas.mjs';
import { expect, test } from './fixtures';
import { RETIRED_ROUTES } from './routes';

// ------------------------------------------------------------------------------ registries

type Locale = 'es' | 'en';
type Localized = Record<Locale, string>;

/** A record of `content/items/categorias.json` (§3.13). */
interface CategoryRecord {
  id: string;
  nombre: Localized;
  icono: string;
  orden: number;
  /** «Todo», the only one without a file of its own. */
  virtual?: boolean;
}

/** A record of `content/items/<categoria>.json`, with the optional fields of §3.13. */
interface ItemRecord {
  id: string;
  nombre: string;
  categoria: string;
  sprite: string | null;
  precioNpc: { vende: number | null; compra: number | null };
  elemento?: string | null;
  uso?: Partial<Localized> | null;
  borrador?: boolean;
}

interface PokemonRecord {
  id: string;
  nombre: string;
  numero: number | null;
  variante: string;
  drops?: { item: string }[];
}

interface ElementRecord {
  id: string;
  nombre: Localized;
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(resolve(ROOT, file), 'utf8')) as T;
}

/** `hideDrafts` of src/lib/content/registry.ts, read from the environment of this run. */
const HIDE_DRAFTS = /^(?:1|true)$/i.test(process.env.OCULTAR_BORRADORES ?? '');

/** The 14 categories of the Market, in the order of the registry (`orden`, 8.5). */
const CATEGORIES = readJson<{ categorias: CategoryRecord[] }>('content/items/categorias.json')
  .categorias.slice()
  .sort((a, b) => a.orden - b.orden);

/** «Todo», the virtual category: `/{l}/items/`. */
const ALL_CATEGORY = CATEGORIES.find((category) => category.virtual === true) as CategoryRecord;
/** The 13 real ones, each with its page `/{l}/items/c/{id}/`. */
const REAL_CATEGORIES = CATEGORIES.filter((category) => category.virtual !== true);

/**
 * The items of each real category, in the order of its file (8.5), without the drafts this
 * build hides (`getItems`, IT2).
 */
const ITEMS_BY_CATEGORY = new Map<string, ItemRecord[]>(
  REAL_CATEGORIES.map((category) => {
    const items = readJson<{ items: ItemRecord[] }>(`content/items/${category.id}.json`).items;
    return [category.id, HIDE_DRAFTS ? items.filter((item) => item.borrador !== true) : items];
  }),
);

/** Every item, in the Market order: the rows of «Todo» and of `/{l}/items/datos.json`. */
const ROWS: ItemRecord[] = REAL_CATEGORIES.flatMap(
  (category) => ITEMS_BY_CATEGORY.get(category.id) ?? [],
);

const POKEMON = readJson<{ pokemon: PokemonRecord[] }>('content/pokemon.json').pokemon;
const ELEMENTS = readJson<{ elementos: ElementRecord[] }>('content/elementos.json').elementos;
const ELEMENT_BY_ID = new Map(ELEMENTS.map((element) => [element.id, element]));

/** The files of `content/items/` hold every id of the registry, drafts included. */
const ALL_ITEMS = readdirSync(resolve(ROOT, 'content/items'))
  .filter((file) => file.endsWith('.json') && file !== 'categorias.json')
  .flatMap((file) => readJson<{ items: ItemRecord[] }>(`content/items/${file}`).items);

/** S19: the names a build with `OCULTAR_BORRADORES=1` must not show anywhere. */
const DRAFT_NAMES = ALL_ITEMS.filter((item) => item.borrador === true).map((item) => item.nombre);

const MESSAGES: Record<Locale, Messages> = { es, en };
const LOCALES = idiomas as Locale[];

/**
 * 8.0.3: the label of the «Ítems» group of the menu, which src/lib/nav/groups.ts owns — it is
 * not in the dictionaries — and which both pages write as the h1 and the crumb of the index
 * (8.5 steps 1 and 2).
 */
const GROUP_TITLE: Localized = { es: 'Ítems', en: 'Items' };

// ----------------------------------------------------------------------- the registry's text

const NUMBER_LOCALE: Record<Locale, string> = { es: 'es-ES', en: 'en-US' };

/** §13.3: grouped thousands in both locales («1.700», «1,700»). */
function figure(value: number, locale: Locale): string {
  return new Intl.NumberFormat(NUMBER_LOCALE[locale], { useGrouping: 'always' }).format(value);
}

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => values[key] ?? whole);
}

type Leaf = string | { one: string; other: string };

/** A count as the dictionary writes it, the figure already formatted (§13.2, §13.3). */
function counted(leaf: Leaf, n: number, locale: Locale): string {
  const template =
    typeof leaf === 'string'
      ? leaf
      : new Intl.PluralRules(NUMBER_LOCALE[locale]).select(n) === 'one'
        ? leaf.one
        : leaf.other;
  return fill(template, { n: figure(n, locale) });
}

/** 8.0.6: rows a page of an item list. */
const PAGE_SIZE = 24;

/** The route of a category: «Todo» is the index of the group (8.5 «Rutas»). */
function itemsPath(locale: Locale, category: string): string {
  return category === ALL_CATEGORY.id ? `/${locale}/items/` : `/${locale}/items/c/${category}/`;
}

/** The items of a category page, or every item in «Todo». */
function rowsOf(category: string): ItemRecord[] {
  return category === ALL_CATEGORY.id ? ROWS : (ITEMS_BY_CATEGORY.get(category) ?? []);
}

/** The items a page of the list shows, in the order of the rows (8.5). */
function pageOf(category: string, page = 1): ItemRecord[] {
  return rowsOf(category).slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
}

/** 8.5 step 5: in «Todo», the categories a page holds, in the Market order. */
function groupsOf(category: string, page = 1): { category: CategoryRecord; items: ItemRecord[] }[] {
  if (category !== ALL_CATEGORY.id) return [];
  const shown = pageOf(category, page);
  return REAL_CATEGORIES.flatMap((entry) => {
    const items = shown.filter((item) => item.categoria === entry.id);
    return items.length === 0 ? [] : [{ category: entry, items }];
  });
}

/** «Drop de» of an item (7.5.3): the Pokémon whose `drops` name it, in the order of the file. */
function droppersOf(id: string): PokemonRecord[] {
  return POKEMON.filter((record) => (record.drops ?? []).some((drop) => drop.item === id));
}

/**
 * The categories this spec opens a page of, besides «Todo»: the longest one — the only one
 * that can fill a grid — the shortest and the last of the Market, so the sample covers a
 * page with items and the two ends of the navigation without walking the 13 of them.
 */
const SAMPLE_CATEGORIES = [
  ...new Set(
    [
      [...REAL_CATEGORIES].sort(
        (a, b) => rowsOf(b.id).length - rowsOf(a.id).length || a.orden - b.orden,
      )[0],
      [...REAL_CATEGORIES].sort(
        (a, b) => rowsOf(a.id).length - rowsOf(b.id).length || a.orden - b.orden,
      )[0],
      REAL_CATEGORIES[REAL_CATEGORIES.length - 1],
    ]
      .filter((category): category is CategoryRecord => category !== undefined)
      .map((category) => category.id),
  ),
];

/** The category with the most items: the one whose page has something to measure. */
const BIGGEST = SAMPLE_CATEGORIES[0] ?? ALL_CATEGORY.id;

// --------------------------------------------------------------------------- page helpers

/** The dev server compiles a page on its first request: the first hydration may be slow. */
const READY_TIMEOUT = 30_000;

type ViewName = 'cards' | 'slots' | 'list';

const VIEW_ATTRIBUTE: Record<ViewName, string> = {
  cards: 'data-card-grid',
  slots: 'data-slots',
  list: 'data-list',
};

/** 7.7.1: the key of the saved view of the `items` list, one for both pages (U6). */
const SAVED_VIEW = 'ac:vista:items';

function listRoot(page: Page): Locator {
  return page.locator('.ac-entity-list[data-ac-list="items"]');
}

/** The island hydrated and applied the state of the URL (PR1, PR4). */
async function listReady(page: Page, root: Locator): Promise<void> {
  await root.scrollIntoViewIfNeeded();
  await expect(page.locator('astro-island[ssr]').filter({ has: root })).toHaveCount(0, {
    timeout: READY_TIMEOUT,
  });
  await expect(root).not.toHaveAttribute('data-ac-pending', { timeout: READY_TIMEOUT });
}

async function openItems(
  page: Page,
  locale: Locale,
  category: string,
  search = '',
): Promise<Locator> {
  const path = `${itemsPath(locale, category)}${search}`;
  const response = await page.goto(path);
  expect(response?.status(), `${path} answers 200`).toBe(200);
  const root = listRoot(page);
  if (rowsOf(category).length > 0) await listReady(page, root);
  return root;
}

function viewButton(root: Locator, locale: Locale, view: ViewName): Locator {
  return root
    .locator('.ac-view-toggle')
    .getByRole('button', { name: MESSAGES[locale].ui.views[view], exact: true });
}

/** The rows of a view, which arrive after its container: Slots and Lista are a deferred
 * chunk of the island (13.6), so the container is there before anything is inside it. */
const VIEW_ROWS: Record<ViewName, string> = {
  cards: '[data-card-grid] article',
  slots: '[data-slots] .ac-entity-slot',
  list: '[data-list] tbody tr',
};

async function chooseView(root: Locator, locale: Locale, view: ViewName): Promise<void> {
  await viewButton(root, locale, view).click();
  await expect(viewButton(root, locale, view)).toHaveAttribute('aria-pressed', 'true');
  await expect(root.locator(`[${VIEW_ATTRIBUTE[view]}]`)).toHaveCount(1, {
    timeout: READY_TIMEOUT,
  });
  await expect(root.locator(VIEW_ROWS[view]).first()).toBeAttached({ timeout: READY_TIMEOUT });
}

function countOf(root: Locator): Locator {
  return root.locator('.ac-entity-list__bar [aria-live="polite"]');
}

/** The number of pages `Pagination` offers: its last page number, or 1 without it. */
async function pageCountOf(root: Locator): Promise<number> {
  const numbers = await root
    .locator('.ac-pagination__list')
    .evaluateAll((lists) =>
      lists.flatMap((list) =>
        [...list.querySelectorAll('a, span, button')]
          .map((node) => Number((node.textContent ?? '').trim()))
          .filter((value) => Number.isInteger(value) && value > 0),
      ),
    );
  return numbers.length === 0 ? 1 : Math.max(...numbers);
}

/** The ids the active view shows, from the anchor `item-{id}` every view writes (H7). */
async function shownIds(root: Locator, view: ViewName): Promise<string[]> {
  const selector = {
    cards: '[data-card-grid] article[id^="item-"]',
    slots: '[data-slots] [id^="item-"]',
    list: '[data-list] tr[id^="item-"]',
  }[view];
  return root
    .locator(selector)
    .evaluateAll((nodes) => nodes.map((node) => (node.getAttribute('id') ?? '').slice(5)));
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

async function saveView(page: Page, view: ViewName): Promise<void> {
  await page.evaluate(
    ({ key, value }) => {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        // U6: storage may be blocked; the list then keeps its default view.
      }
    },
    { key: SAVED_VIEW, value: view },
  );
}

/** Opens the first game tooltip under `scope` by hovering its trigger (7.5.4). */
async function openTooltip(page: Page, scope: Locator): Promise<Locator> {
  const trigger = scope.locator('[data-ac-tt] a, [data-ac-tt] button').first();
  await page.mouse.move(0, 0);
  await trigger.hover();
  const panel = page.locator('[role="tooltip"][data-open]').first();
  await expect(panel).toBeVisible();
  // The 150 ms entry of the panel (6.2): axe reads a fading panel at partial opacity and
  // reports a contrast the settled one does not have, as tests/e2e/states.ts explains.
  await panel.evaluate((element) =>
    Promise.all(
      element
        .getAnimations({ subtree: true })
        .filter((animation) => animation.effect?.getComputedTiming().endTime !== Infinity)
        .map((animation) => animation.finished),
    ),
  );
  return panel;
}

// ------------------------------------------------------- the category navigation (8.5 step 3)

function navigationOf(page: Page, locale: Locale): Locator {
  return page.locator(`nav[aria-label="${MESSAGES[locale].items.categoriesLabel}"]`);
}

/** Every tab of the navigation: its href, its text and the two attributes of IT6. */
async function tabsOf(page: Page, locale: Locale) {
  return navigationOf(page, locale)
    .locator('.ac-toggle-group__items > *')
    .evaluateAll((nodes) =>
      nodes.map((node) => ({
        tag: node.localName,
        href: node.getAttribute('href'),
        text: (node.querySelector('.ac-toggle-group__text')?.textContent ?? '').trim(),
        current: node.getAttribute('aria-current'),
        pressed: node.getAttribute('aria-pressed'),
        sprites: node.querySelectorAll('img, svg').length,
      })),
    );
}

// -------------------------------------------------------------------------- frame and grids

type Box = { x: number; y: number; w: number; h: number; shown: boolean };

async function readFrame(page: Page) {
  return page.evaluate(() => {
    const box = (selector: string): Box | null => {
      const element = document.querySelector(selector);
      if (element === null) return null;
      const rect = element.getBoundingClientRect();
      return {
        x: rect.x,
        y: rect.y,
        w: rect.width,
        h: rect.height,
        shown: element.checkVisibility({ visibilityProperty: true }),
      };
    };
    return {
      header: box('.ac-header'),
      sidebar: box('.ac-page-layout__sidebar'),
      main: box('.ac-page-layout__main'),
      rail: box('.ac-page-layout__rail'),
      spacer: box('.ac-page-layout__spacer'),
      scrollWidth: document.documentElement.scrollWidth,
    };
  });
}

/** §5.5, CGS §3: x and width of the main column; §8.5 is template B, so always the spacer. */
const MAIN_COLUMN: Record<number, [number, number]> = {
  1440: [248, 944],
  1280: [248, 784],
  1024: [16, 992],
  768: [16, 736],
  390: [16, 358],
};

/** WG1 (S1): the frame of §5.5 and no sideways scroll, at the width of the window. */
async function expectFrame(page: Page, width: number, label: string) {
  await page.evaluate(() => window.scrollTo(0, 0));
  const frame = await readFrame(page);
  const [x, w] = MAIN_COLUMN[width];
  expect.soft(frame.header?.y ?? NaN, `${label}: header at y 0`).toBeCloseTo(0, 0);
  expect.soft(frame.header?.h ?? NaN, `${label}: header 64 tall`).toBeCloseTo(64, 0);
  expect
    .soft(frame.header?.w ?? NaN, `${label}: header as wide as the window`)
    .toBeCloseTo(width, 0);
  expect.soft(Math.abs((frame.main?.x ?? NaN) - x), `${label}: main x ${x}`).toBeLessThanOrEqual(1);
  expect
    .soft(Math.abs((frame.main?.w ?? NaN) - w), `${label}: main width ${w}`)
    .toBeLessThanOrEqual(1);
  expect.soft(Math.abs((frame.main?.y ?? NaN) - 96), `${label}: main y 96`).toBeLessThanOrEqual(1);
  if (width >= 1280) {
    expect.soft(frame.sidebar?.x ?? NaN, `${label}: sidebar at x 0`).toBeCloseTo(0, 0);
    expect.soft(frame.sidebar?.w ?? NaN, `${label}: sidebar 208 wide`).toBeCloseTo(208, 0);
    // Template B has no `Toc`: the rail's place is the spacer (8.0.2).
    expect.soft(frame.spacer?.shown ?? false, `${label}: spacer, no Toc rail`).toBe(true);
  } else {
    expect.soft(frame.sidebar?.shown ?? false, `${label}: no sidebar below 1280`).toBe(false);
  }
  expect
    .soft(frame.scrollWidth, `${label}: documentElement.scrollWidth ≤ ${width} (WG1)`)
    .toBeLessThanOrEqual(width);
}

/** CGS §4, family `loot`: min card 240, 1 to 4 columns, 12 px gap below 480. */
const LOOT = { min: 240, minCols: 1, maxCols: 4, phone: 12 };

/** CGS §4: `clamp(floor((W + gap) / (min + gap)), minCols, maxCols)`. */
function expectedColumns(width: number): number {
  const gap = width < 480 ? LOOT.phone : 16;
  return Math.min(
    LOOT.maxCols,
    Math.max(LOOT.minCols, Math.floor((width + gap) / (LOOT.min + gap))),
  );
}

async function readGrid(grid: Locator) {
  return grid.evaluate((element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    const tops = new Map<number, number[]>();
    for (const child of element.children) {
      const box = child.getBoundingClientRect();
      const top = Math.round(box.top);
      tops.set(top, [...(tops.get(top) ?? []), Math.round(box.height)]);
    }
    const spread = Math.max(0, ...[...tops.values()].map((h) => Math.max(...h) - Math.min(...h)));
    return {
      width: rect.width,
      columns: style.gridTemplateColumns.split(' ').filter(Boolean).length,
      spread,
    };
  });
}

// ------------------------------------------------------------------------------ axe (WA1)

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const BLOCKING = new Set(['serious', 'critical']);

/** §13.7: the only contrast pairs axe may report, as in tests/e2e/a11y.spec.ts. */
const CONTRAST_EXCEPTIONS = ['.ac-search-trigger', '.ac-bar-chart__bar--partial'];

async function expectAxeClean(page: Page, state: string): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  const blocking: string[] = [];
  for (const violation of results.violations) {
    for (const node of violation.nodes) {
      const impact = node.impact ?? violation.impact ?? '';
      if (!BLOCKING.has(impact)) continue;
      const target = String(node.target[node.target.length - 1]);
      const excused =
        violation.id.startsWith('color-contrast') &&
        (await page.evaluate(
          ({ selector, exceptions }) => {
            const element = document.querySelector(selector);
            return element !== null && exceptions.some((pair) => element.closest(pair) !== null);
          },
          { selector: target, exceptions: CONTRAST_EXCEPTIONS },
        ));
      if (!excused) blocking.push(`${violation.id} (${impact}) · ${target} · ${violation.help}`);
    }
  }
  expect.soft(blocking, `WA1, axe ${WCAG_TAGS.join(' ')} · ${state}`).toEqual([]);
}

// --------------------------------------------------------------------- structure (WA2–WA4)

async function expectStructure(page: Page, locale: Locale, label: string): Promise<void> {
  const report = await page.evaluate(() => {
    const visibleHeadings = [...document.querySelectorAll('h1, h2, h3, h4, h5, h6')].filter(
      (heading) =>
        heading.closest('[role="tooltip"], [popover], dialog:not([open]), [hidden]') === null,
    );
    const levels = visibleHeadings.map((heading) => Number(heading.localName.slice(1)));
    const skips: string[] = [];
    levels.forEach((level, index) => {
      const before = index === 0 ? 0 : levels[index - 1];
      if (level > before + 1) {
        skips.push(`h${before} → h${level} «${(visibleHeadings[index].textContent ?? '').trim()}»`);
      }
    });
    const main = document.querySelector('main');
    const skip = document.querySelector('a.ac-skip-link');
    return {
      h1: document.querySelectorAll('h1').length,
      skips,
      mainId: main?.id ?? null,
      skipHref: skip?.getAttribute('href') ?? null,
      breadcrumb: document.querySelector('nav.ac-breadcrumb')?.getAttribute('aria-label') ?? null,
      captionless: [...document.querySelectorAll('main table')].filter(
        (table) => (table.querySelector(':scope > caption')?.textContent ?? '').trim() === '',
      ).length,
      unpressed: [
        ...document.querySelectorAll('main .ac-view-toggle button, main .ac-toggle-group button'),
      ]
        .filter((button) => !button.hasAttribute('aria-pressed'))
        .map((button) => (button.textContent ?? '').trim()),
      htmlLang: document.documentElement.lang,
      foreignLangs: [...document.querySelectorAll('main [lang]')].map((node) =>
        node.getAttribute('lang'),
      ),
    };
  });
  const shell = MESSAGES[locale].shell;
  expect.soft(report.h1, `${label}: one h1 (WA2)`).toBe(1);
  expect.soft(report.skips, `${label}: no skipped heading level (WA2)`).toEqual([]);
  expect.soft(report.mainId, `${label}: main#contenido (WA2)`).toBe('contenido');
  expect
    .soft(report.skipHref, `${label}: the skip link targets #contenido (WA2)`)
    .toBe('#contenido');
  expect
    .soft(report.breadcrumb, `${label}: the breadcrumb nav is named (WA2)`)
    .toBe(shell.breadcrumb);
  expect.soft(report.captionless, `${label}: every table has a caption (WA2)`).toBe(0);
  expect.soft(report.unpressed, `${label}: every toggle carries aria-pressed (WA3)`).toEqual([]);
  expect.soft(report.htmlLang, `${label}: <html lang> (WA4)`).toBe(locale);
  const other = locale === 'es' ? 'en' : 'es';
  expect
    .soft(
      report.foreignLangs.filter((lang) => lang !== other),
      `${label}: a lang inside main only marks the other language (WA4, 8.0.5)`,
    )
    .toEqual([]);
}

// ----------------------------------------------------------------------------- WL1 (§12)

type Harvest = { texts: string[]; attributes: { name: string; value: string }[] };

async function harvest(page: Page): Promise<Harvest> {
  return page.evaluate(() => {
    const texts: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      const parent = node.parentElement;
      if (parent === null || parent.closest('script, style, template') !== null) continue;
      const text = (node.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (text !== '') texts.push(text);
    }
    const attributes: { name: string; value: string }[] = [];
    for (const element of document.querySelectorAll('*')) {
      for (const name of ['aria-label', 'alt', 'title', 'placeholder']) {
        const value = element.getAttribute(name);
        if (value !== null) attributes.push({ name, value: value.trim() });
      }
    }
    return { texts, attributes };
  });
}

type Rule = string | RegExp;

function hits(found: Harvest, rule: Rule): string[] {
  const test = (value: string) => (typeof rule === 'string' ? value === rule : rule.test(value));
  return [
    ...found.texts.filter(test),
    ...found.attributes
      .filter((entry) => test(entry.value))
      .map((entry) => `${entry.name}=${entry.value}`),
  ];
}

/**
 * §8.5 «Se quita»: the 13 files of `content/items/` have no page today, so no row of §12
 * names this one. What WL1 leaves for it is the general rules: none of the forbidden strings
 * of §12.22 that a list could write by itself, no icon outside the utility glyphs (S7) and no
 * text invented for the page (the count, the tabs and the columns are the dictionary's).
 */
const FORBIDDEN: Rule[] = [
  /^Precio NPC: aún no$/,
  /^Objetos de sistema$/,
  /\bKKs?\b/,
  /^\d+\s?px$/,
  /^(undefined|NaN|\[object Object\]|Invalid Date)$/,
  /Próximamente|Coming soon|Wiki Core|Borrador local|Local draft/,
];

async function expectNoRemovedText(page: Page, label: string): Promise<void> {
  const found = await harvest(page);
  expect
    .soft(
      FORBIDDEN.flatMap((rule) => hits(found, rule)),
      `${label}: no filler text (WL1, §12.22)`,
    )
    .toEqual([]);
  // D-08: no inline `onerror` on an image.
  expect.soft(await page.locator('img[onerror]').count(), `${label}: D-08`).toBe(0);
  // S7: no lucide icon outside the utility glyphs, which carry the bare `lucide` class.
  expect
    .soft(await page.locator('svg[class*="lucide-"]').count(), `${label}: no lucide icon (S7)`)
    .toBe(0);
  // WG5: a link that goes nowhere is filler too.
  expect
    .soft(await page.locator('a[href="#"], a[href=""]').count(), `${label}: no empty link (WG5)`)
    .toBe(0);
}

// -------------------------------------------------------------------------------- IT5

/** IT5, H7: `target.href` of the index leaves its item in view and focused in `view`. */
async function expectAnchored(
  page: Page,
  target: { id: string; href: string },
  view: ViewName,
): Promise<void> {
  await page.goto('about:blank');
  if (view === 'cards') await forgetView(page);
  await page.goto('/es/items/');
  await saveView(page, view);
  const response = await page.goto(target.href);
  expect(response?.status(), `${target.href} answers 200`).toBe(200);
  const root = listRoot(page);
  await listReady(page, root);

  const anchor = page.locator(`#item-${target.id}`);
  await expect(anchor, `H7: ${target.href} names an element of the ${view} view`).toHaveCount(1);
  const placed = await anchor.evaluate((element, which) => {
    const box = element.getBoundingClientRect();
    const active = document.activeElement;
    // H7: the trigger of the title in Cards — an item title is text (§15), so the card
    // itself — the slot in Slots and the name in Lista. Never an entity nested in the
    // card's facts («Drop de», «Elemento»): that is another entity (7.5.10).
    const wanted =
      which === 'cards'
        ? (element.querySelector('.ac-card__title a[href], .ac-card__title button') ?? element)
        : which === 'slots'
          ? element.querySelector('.ac-entity-slot')
          : element.querySelector('.ac-list-row__name a[href], .ac-list-row__name button');
    return {
      top: box.top,
      inside: box.top >= 0 && box.bottom <= window.innerHeight + 1,
      focused: active !== null && active === wanted,
      active: active === null ? null : active.outerHTML.slice(0, 120),
      end: window.scrollY >= document.documentElement.scrollHeight - window.innerHeight - 1,
    };
  }, view);
  expect(
    placed.focused,
    `IT5 (${view}): the focus lands on the title, the slot or the name, not on ${placed.active}`,
  ).toBe(true);
  if (view === 'cards') {
    // IT4: a card opens no panel, and the anchor focused nothing that would.
    await expect(page.locator('[role="tooltip"][data-open]')).toHaveCount(0);
  }
  expect(placed.inside, `IT5 (${view}): the item is inside the window, at ${placed.top}`).toBe(
    true,
  );
  expect(
    placed.top >= 63 || placed.end,
    `IT5 (${view}): its top edge is under the header, at ${placed.top}`,
  ).toBe(true);
}

// ================================================================================ tests

test.describe('Ítems (8.5)', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const locale of LOCALES) {
    test(`${locale}: «Todo» — migas, título, navegación, barra y paginación (8.5 pasos 1 a 6, WD1)`, async ({
      page,
    }) => {
      test.skip(ROWS.length === 0, 'Sin ítems visibles la página es el vacío de IT2.');
      const { ui, items } = MESSAGES[locale];
      const root = await openItems(page, locale, ALL_CATEGORY.id);

      // 1 and 2. One crumb, the current one, and the h1: both are the label of the «Ítems»
      // group of the menu, which src/lib/nav/groups.ts owns (8.0.3, 8.0.4, T15). The page
      // has no subtitle.
      const crumbs = page.locator('nav.ac-breadcrumb .ac-breadcrumb__item');
      await expect(crumbs).toHaveCount(1);
      await expect(crumbs.nth(0).locator('[aria-current="page"]')).toHaveText(GROUP_TITLE[locale]);
      await expect(page.locator('h1')).toHaveText(GROUP_TITLE[locale]);
      await expect(page.locator('.ac-page-title__sub')).toHaveCount(0);

      // 3. The category navigation: the 14 entries of the registry, in its order, each one a
      //    link with its sprite and its name; «Todo» is the current page (8.5 step 3).
      const tabs = await tabsOf(page, locale);
      expect(tabs.map((tab) => tab.tag)).toEqual(CATEGORIES.map(() => 'a'));
      expect(tabs.map((tab) => tab.text)).toEqual(
        CATEGORIES.map((category) => category.nombre[locale]),
      );
      expect(tabs.map((tab) => tab.href)).toEqual(
        CATEGORIES.map((category) => itemsPath(locale, category.id)),
      );
      expect(tabs.map((tab) => tab.current)).toEqual(
        CATEGORIES.map((category) => (category.id === ALL_CATEGORY.id ? 'page' : null)),
      );

      // 4. The count of every item of the registry (WD1) and the view toggle, Cards pressed.
      await expect(countOf(root)).toHaveText(counted(items.count, ROWS.length, locale));
      await expect(viewButton(root, locale, 'cards')).toHaveAttribute('aria-pressed', 'true');

      // 5. The first page: 24 items in the Market order, grouped by category.
      expect(await shownIds(root, 'cards')).toEqual(pageOf(ALL_CATEGORY.id).map((row) => row.id));
      const groups = groupsOf(ALL_CATEGORY.id);
      const heads = root.locator('[data-card-grid] .ac-card-group__head');
      await expect(heads).toHaveCount(groups.length);
      for (const [index, group] of groups.entries()) {
        await expect(heads.nth(index)).toContainText(group.category.nombre[locale]);
        await expect(heads.nth(index).locator('.ac-card-group__count')).toHaveText(
          figure(group.items.length, locale),
        );
      }

      // 6. Pagination, as many pages as the registry fills (WD1).
      expect(await pageCountOf(root)).toBe(Math.max(1, Math.ceil(ROWS.length / PAGE_SIZE)));
      await expect(root.locator('.ac-pagination__nav')).toHaveAttribute(
        'aria-label',
        ui.pagination,
      );
      await expect(root.locator('.ac-pagination [aria-current="page"]')).toHaveText('1');
    });

    test(`${locale}: una categoría — migas, título y conteo (8.5 pasos 1 a 6, WD1)`, async ({
      page,
    }) => {
      const category = REAL_CATEGORIES.find((entry) => entry.id === BIGGEST) as CategoryRecord;
      test.skip(rowsOf(category.id).length === 0, 'Sin ítems la categoría es el vacío de IT2.');
      const { items } = MESSAGES[locale];
      const root = await openItems(page, locale, category.id);

      // 1. «Ítems › {categoría}»: the group crumb links its index (8.0.4).
      const crumbs = page.locator('nav.ac-breadcrumb .ac-breadcrumb__item');
      await expect(crumbs).toHaveCount(2);
      await expect(crumbs.nth(0).locator('a')).toHaveAttribute('href', `/${locale}/items/`);
      await expect(crumbs.nth(1).locator('[aria-current="page"]')).toHaveText(
        category.nombre[locale],
      );

      // 2. The h1 is the `nombre` of the registry in the page's language.
      await expect(page.locator('h1')).toHaveText(category.nombre[locale]);

      // 3. Its tab is the current one, and only its tab.
      const tabs = await tabsOf(page, locale);
      expect(tabs.map((tab) => tab.current)).toEqual(
        CATEGORIES.map((entry) => (entry.id === category.id ? 'page' : null)),
      );

      // 4 to 6. The count and the pages of the category alone (WD1); no groups (8.5 step 5).
      const rows = rowsOf(category.id);
      await expect(countOf(root)).toHaveText(counted(items.count, rows.length, locale));
      expect(await shownIds(root, 'cards')).toEqual(pageOf(category.id).map((row) => row.id));
      await expect(root.locator('[data-card-grid] .ac-card-group')).toHaveCount(0);
      expect(await pageCountOf(root)).toBe(Math.max(1, Math.ceil(rows.length / PAGE_SIZE)));
    });
  }

  test('IT1: «Todo» agrupa en el orden del Market; una categoría lista solo su archivo', async ({
    page,
  }) => {
    test.skip(ROWS.length === 0, 'Sin ítems visibles no hay nada que agrupar (IT2).');
    const root = await openItems(page, 'es', ALL_CATEGORY.id);
    const groups = groupsOf(ALL_CATEGORY.id);
    await expect(root.locator('[data-card-grid] .ac-card-group__head')).toHaveText(
      groups.map(
        (group) =>
          new RegExp(`^${group.category.nombre.es.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
      ),
    );
    // Every grid of «Todo» carries only the items of its category, in the order of its file.
    const grids = root.locator('[data-card-grid] .ac-card-group');
    for (const [index, group] of groups.entries()) {
      const ids = await grids
        .nth(index)
        .locator('article[id^="item-"]')
        .evaluateAll((nodes) => nodes.map((node) => (node.getAttribute('id') ?? '').slice(5)));
      expect(ids, `${group.category.id}: its items, in the order of its file`).toEqual(
        group.items.map((item) => item.id),
      );
    }

    for (const category of SAMPLE_CATEGORIES) {
      const rows = rowsOf(category);
      if (rows.length === 0) continue;
      const only = await openItems(page, 'es', category);
      expect(await shownIds(only, 'cards'), `${category}: only its file`).toEqual(
        pageOf(category).map((row) => row.id),
      );
    }
  });

  test('IT2: con OCULTAR_BORRADORES=1 cada categoría muestra el vacío, sin conteo ni vista', async ({
    page,
  }) => {
    test.skip(!HIDE_DRAFTS, 'Solo con OCULTAR_BORRADORES=1 (REG:48-55).');
    test.skip(ROWS.length > 0, 'El registro deja ítems visibles: no hay categoría vacía.');
    for (const locale of LOCALES) {
      const { items } = MESSAGES[locale];
      for (const category of [ALL_CATEGORY.id, ...REAL_CATEGORIES.map((entry) => entry.id)]) {
        const path = itemsPath(locale, category);
        const response = await page.goto(path);
        expect(response?.status(), `${path} answers 200`).toBe(200);
        // The list has no filter, so its empty state is the line alone, with no action:
        // `EmptyState` without one is the `p.ac-empty-state` itself (8.5 «Estados»).
        const empty = page.locator('.ac-empty-state');
        await expect(empty, `${path}: the empty state`).toHaveText(items.empty);
        await expect(empty.locator('a, button')).toHaveCount(0);
        // The navigation stays; the count, the views and the pagination do not (8.5 «Estados»).
        await expect(navigationOf(page, locale)).toHaveCount(1);
        await expect(page.locator('.ac-entity-list__bar')).toHaveCount(0);
        await expect(page.locator('.ac-view-toggle')).toHaveCount(0);
        await expect(page.locator('.ac-pagination')).toHaveCount(0);
        // S19: no draft name anywhere on the page.
        const found = await harvest(page);
        expect
          .soft(
            DRAFT_NAMES.filter((name) => found.texts.includes(name)),
            `${path}: no draft with OCULTAR_BORRADORES=1`,
          )
          .toEqual([]);
      }
    }
  });

  test('IT3: un precio se escribe en forma corta con su sprite y la cifra exacta accesible (S8)', async ({
    page,
  }) => {
    const priced = ROWS.find((row) => row.precioNpc.vende !== null);
    test.skip(
      priced === undefined,
      'Ningún ítem del registro tiene precio todavía: aquí IT3 no puede medirse sin inventar uno ' +
        '(X4); la isla lo cumple con una fila sintética en tests/components/contracts.test.tsx.',
    );
    const item = priced as ItemRecord;
    const amount = item.precioNpc.vende as number;
    const root = await openItems(page, 'es', item.categoria);
    const card = root.locator(`article[id="item-${item.id}"]`);
    await expect(card).toHaveCount(1);
    const money = card.locator('.ac-pokedolares-amount').first();
    // G6, S8: the sprite comes before the figure, the short form is hidden from the reader
    // and the exact figure with its currency word is the accessible text (§13.3).
    await expect(money.locator('.ac-pokedolares-amount__sprite img')).toHaveCount(1);
    await expect(money.locator('.sr-only')).toHaveText(formatPokedolaresLabel(amount, 'es'));
    await expect(money.locator('[aria-hidden="true"]').last()).toHaveText(
      formatPokedolares(amount, 'es'),
    );
  });

  test('IT4: ninguna tarjeta es disparador; cada slot y cada nombre de la Lista lo es', async ({
    page,
  }) => {
    test.skip(ROWS.length === 0, 'Sin ítems visibles no hay tarjetas (IT2).');
    const root = await openItems(page, 'es', BIGGEST);
    // 7.5.10, IT4: a card is not wrapped in a trigger; only what is nested inside it can be.
    const cards = root.locator('[data-card-grid] article[id^="item-"]');
    await expect(cards.locator(':scope > [data-ac-tt]')).toHaveCount(0);
    expect(
      await root.locator('[data-card-grid] [data-ac-tt] article').count(),
      'IT4: no card sits inside a tooltip trigger',
    ).toBe(0);

    await chooseView(root, 'es', 'slots');
    const slots = root.locator('[data-slots] .ac-entity-slot');
    await expect(slots).toHaveCount(pageOf(BIGGEST).length);
    // Every slot is a button with the panel it describes (7.5.1).
    const described = await slots.evaluateAll((nodes) =>
      nodes.map((node) => ({
        tag: node.localName,
        describedby: node.getAttribute('aria-describedby') !== null,
      })),
    );
    expect(described.every((slot) => slot.tag === 'button' && slot.describedby)).toBe(true);

    await chooseView(root, 'es', 'list');
    const names = root.locator('[data-list] tbody .ac-list-row__name-in [data-ac-tt] button');
    await expect(names).toHaveCount(pageOf(BIGGEST).length);
    expect(
      await names.evaluateAll((nodes) =>
        nodes.every((node) => node.getAttribute('aria-describedby') !== null),
      ),
      'IT4: every name of the Lista describes its panel',
    ).toBe(true);
    await chooseView(root, 'es', 'cards');
    await forgetView(page);
  });

  test('IT5: el URL del índice deja el ítem bajo la cabecera y con el foco, en Cards y en la vista guardada', async ({
    page,
  }) => {
    test.skip(ROWS.length === 0, 'Sin ítems visibles no hay ancla (IT2).');
    const entries = (await (await page.request.get('/es/buscar/indice.json')).json()) as {
      kind: string;
      id: string;
      href: string;
    }[];
    const market = entries.filter(
      (candidate) => candidate.kind === 'item' && candidate.href.includes('/items/c/'),
    );
    expect(market.length, 'the search index carries the Market items (8.6)').toBeGreaterThan(0);
    // The first entry of the index, and the last item of the first page of the longest
    // category: the one that sits furthest down its page, so the anchor has to scroll.
    const deepest = pageOf(BIGGEST).at(-1)?.id;
    const targets = [
      ...new Set([market[0], market.find((candidate) => candidate.id === deepest) ?? market[0]]),
    ];

    for (const target of targets) {
      for (const view of ['cards', 'slots', 'list'] as ViewName[]) {
        await expectAnchored(page, target, view);
      }
    }
    await forgetView(page);
  });

  test('IT6: la pestaña actual lleva aria-current, el fondo bg-tertiary y ninguna selección ámbar', async ({
    page,
  }) => {
    for (const locale of LOCALES) {
      for (const category of [ALL_CATEGORY.id, BIGGEST]) {
        await openItems(page, locale, category);
        // The pointer away: the hover of a link is the same `bg-tertiary` as «Actual».
        await page.mouse.move(0, 0);
        const measured = await navigationOf(page, locale)
          .locator('.ac-toggle-group__items > *')
          .evaluateAll(
            (nodes, expected) => {
              const tertiary = getComputedStyle(document.documentElement)
                .getPropertyValue('--bg-tertiary')
                .trim();
              const probe = document.createElement('span');
              probe.style.color = tertiary;
              document.body.append(probe);
              const wanted = getComputedStyle(probe).color;
              probe.remove();
              return {
                wanted,
                tabs: nodes.map((node) => {
                  const style = getComputedStyle(node);
                  return {
                    id: node.getAttribute('href') ?? '',
                    current: node.getAttribute('aria-current'),
                    pressed: node.getAttribute('aria-pressed'),
                    background: style.backgroundColor,
                    shadow: style.boxShadow,
                    tag: node.localName,
                  };
                }),
                expected,
              };
            },
            itemsPath(locale, category),
          );
        const current = measured.tabs.filter((tab) => tab.current === 'page');
        expect(
          current.map((tab) => tab.id),
          `${locale} ${category}: one current tab`,
        ).toEqual([measured.expected]);
        expect(current[0]?.tag, 'IT6: the tab is a link, not a button (7.2.8)').toBe('a');
        expect(current[0]?.pressed, 'IT6: a link never carries aria-pressed (T9)').toBeNull();
        expect(current[0]?.background, 'IT6: the «Actual» background is bg-tertiary').toBe(
          measured.wanted,
        );
        expect(current[0]?.shadow, 'IT6: no amber selection ring').toBe('none');
        expect(
          measured.tabs.every((tab) => tab.pressed === null),
          'IT6: no tab of the navigation carries aria-pressed',
        ).toBe(true);
      }
    }
  });

  test('S4: las tres vistas muestran el mismo conjunto en el mismo orden', async ({ page }) => {
    test.skip(ROWS.length === 0, 'Sin ítems visibles no hay vistas (IT2).');
    for (const category of [ALL_CATEGORY.id, BIGGEST]) {
      const root = await openItems(page, 'es', category);
      const expected = pageOf(category).map((row) => row.id);
      const cards = await shownIds(root, 'cards');
      await chooseView(root, 'es', 'slots');
      const slots = await shownIds(root, 'slots');
      await chooseView(root, 'es', 'list');
      const list = await shownIds(root, 'list');
      await chooseView(root, 'es', 'cards');
      expect(cards, `${category}: Cards shows the page of the list`).toEqual(expected);
      expect(slots, `${category}: Slots shows the same, in the same order`).toEqual(expected);
      expect(list, `${category}: Lista shows the same, in the same order`).toEqual(expected);
    }
    await forgetView(page);
  });

  test('U3: la categoría y el estado de la URL sirven igual en es y en en', async ({ page }) => {
    test.skip(ROWS.length === 0, 'Sin ítems visibles no hay lista (IT2).');
    const seen: string[][] = [];
    for (const locale of LOCALES) {
      const root = await openItems(page, locale, BIGGEST, '?view=slots');
      await expect(viewButton(root, locale, 'slots')).toHaveAttribute('aria-pressed', 'true');
      seen.push(await shownIds(root, 'slots'));
      await expect(countOf(root)).toHaveText(
        counted(MESSAGES[locale].items.count, rowsOf(BIGGEST).length, locale),
      );
    }
    expect(seen[1], 'U3: the same route and the same query give the same items').toEqual(seen[0]);
    await forgetView(page);
  });

  test('Lista: caption y columnas en el orden de 8.5 (paso 5)', async ({ page }) => {
    test.skip(ROWS.length === 0, 'Sin ítems visibles no hay tabla (IT2).');
    const { items, ui } = es;
    const category = REAL_CATEGORIES.find((entry) => entry.id === BIGGEST) as CategoryRecord;
    const cases: [string, string, boolean][] = [
      [ALL_CATEGORY.id, items.captionAll, true],
      [category.id, fill(items.caption, { category: category.nombre.es }), false],
    ];
    for (const [id, caption, grouped] of cases) {
      const root = await openItems(page, 'es', id, '?view=list');
      await expect(root.locator('table caption')).toHaveText(caption);
      const headers = (await root.locator('table thead th').allTextContents()).map((text) =>
        text.trim(),
      );
      // 8.5 step 5: Sprite · Ítem · (in «Todo») Categoría · the keys of the union, which only
      // holds the ones some item of the page has a value for (7.6.3).
      const order: string[] = [
        items.columnSprite,
        items.columnItem,
        ...(grouped ? [ui.tooltip.category] : []),
        ui.tooltip.droppedBy,
        ui.tooltip.element,
        ui.tooltip.use,
        ui.tooltip.npcPrice,
        ui.tooltip.shopPrice,
      ];
      expect(headers.slice(0, grouped ? 3 : 2)).toEqual(order.slice(0, grouped ? 3 : 2));
      expect(headers.every((header) => order.includes(header))).toBe(true);
      expect(headers.map((header) => order.indexOf(header))).toEqual(
        [...headers.map((header) => order.indexOf(header))].sort((a, b) => a - b),
      );
      await expect(root.locator('table tbody tr')).toHaveCount(pageOf(id).length);
    }
    await forgetView(page);
  });

  test('Slots: en «Todo» una columna de etiqueta por categoría y slots de 40 (8.5 paso 5)', async ({
    page,
  }) => {
    test.skip(ROWS.length === 0, 'Sin ítems visibles no hay slots (IT2).');
    const root = await openItems(page, 'es', ALL_CATEGORY.id, '?view=slots');
    await expect(root.locator('[data-slots] .ac-slots-panel__label')).toHaveText(
      groupsOf(ALL_CATEGORY.id).map((group) => group.category.nombre.es),
    );
    const box = await root.locator('[data-slots] .ac-entity-slot').first().boundingBox();
    expect(box?.width).toBeCloseTo(40, 0);
    expect(box?.height).toBeCloseTo(40, 0);

    // The panel of the first slot: «Categoría:» and the rows of 8.5 with a value (T32).
    const panel = await openTooltip(page, root.locator('[data-slots]'));
    const item = pageOf(ALL_CATEGORY.id)[0];
    const category = REAL_CATEGORIES.find((entry) => entry.id === item.categoria) as CategoryRecord;
    const labels = es.ui.tooltip;
    const rows: [string, boolean][] = [
      [labels.category, true],
      [labels.droppedBy, droppersOf(item.id).length > 0],
      [labels.element, item.elemento != null && ELEMENT_BY_ID.has(item.elemento)],
      [labels.use, (item.uso?.es ?? '') !== ''],
      [labels.npcPrice, item.precioNpc.vende !== null],
      [labels.shopPrice, item.precioNpc.compra !== null],
    ];
    await expect(panel.locator('.ac-game-tooltip__label')).toHaveText(
      rows.filter(([, present]) => present).map(([label]) => `${label}:`),
    );
    // «Categoría:» carries the name of its Market category in the page's language.
    await expect(panel.locator('.ac-game-tooltip__value').first()).toHaveText(category.nombre.es);
    await expect(panel).not.toContainText('—');
    await page.keyboard.press('Escape');
    await expect(page.locator('[role="tooltip"][data-open]')).toHaveCount(0);
    await forgetView(page);
  });
});

test.describe('WG1: el marco de §5.5 a 1440 y a 390', () => {
  for (const size of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    test.describe(`${size.width} px`, () => {
      test.use({ viewport: size });

      test(`«Todo» en sus tres vistas y una categoría a ${size.width}`, async ({ page }) => {
        for (const view of ['cards', 'slots', 'list'] as ViewName[]) {
          await openItems(page, 'es', ALL_CATEGORY.id, `?view=${view}`);
          await expectFrame(page, size.width, `/es/items/?view=${view}`);
        }
        for (const category of SAMPLE_CATEGORIES) {
          await openItems(page, 'es', category);
          await expectFrame(page, size.width, itemsPath('es', category));
        }
        await forgetView(page);
      });
    });
  }
});

test.describe('WG4: la rejilla `loot` a 1440, 1280, 1024, 768 y 390 (CGS §4)', () => {
  for (const size of [
    { width: 1440, height: 900 },
    { width: 1280, height: 900 },
    { width: 1024, height: 900 },
    { width: 768, height: 900 },
    { width: 390, height: 844 },
  ]) {
    test.describe(`${size.width} px`, () => {
      test.use({ viewport: size });

      test(`columnas de los ítems a ${size.width}`, async ({ page }) => {
        test.skip(ROWS.length === 0, 'Sin ítems visibles no hay rejilla (IT2).');
        const root = await openItems(page, 'es', BIGGEST);
        const grid = await readGrid(root.locator('.ac-card-grid__grid').first());
        expect
          .soft(Math.abs(grid.width - MAIN_COLUMN[size.width][1]), 'the grid spans the column')
          .toBeLessThanOrEqual(1);
        expect
          .soft(grid.columns, `loot columns for ${grid.width}`)
          .toBe(expectedColumns(grid.width));
        expect.soft(grid.spread, 'no ragged row (S2)').toBe(0);

        // In «Todo» every group is a grid of its own, with the same columns (7.6.3).
        const all = await openItems(page, 'es', ALL_CATEGORY.id);
        const grids = all.locator('.ac-card-grid__grid');
        const total = await grids.count();
        for (let index = 0; index < total; index += 1) {
          const group = await readGrid(grids.nth(index));
          expect
            .soft(group.columns, `group ${index + 1} columns for ${group.width}`)
            .toBe(expectedColumns(group.width));
          expect.soft(group.spread, `group ${index + 1}: no ragged row (S2)`).toBe(0);
        }
      });
    });
  }
});

test.describe('WG5: cada enlace interno responde 200', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  /** Where each internal link ends, shared by the tests of the worker. */
  const resolved = new Map<string, string>();

  /**
   * WG5: an internal link answers 200, or 302 (§8.0.1) towards a route that answers 200. It
   * follows that one redirection and describes where the link ends; `200` when it is fine.
   */
  async function endOf(page: Page, href: string): Promise<string> {
    const first = await page.request.get(href, { maxRedirects: 0 });
    if (first.status() === 200) return '200';
    if (first.status() !== 302) return `${first.status()}`;
    const target = first.headers()['location'];
    if (target === undefined) return '302 without Location';
    const second = await page.request.get(target, { maxRedirects: 0 });
    return second.status() === 200 ? '200' : `302 to ${target}, which answers ${second.status()}`;
  }

  async function expectLinks(page: Page, label: string): Promise<void> {
    const { hrefs, nowhere } = await page.evaluate(() => {
      for (const group of document.querySelectorAll('details')) group.open = true;
      const anchors = [...document.querySelectorAll('a[href]')];
      const hrefOf = (anchor: Element) => (anchor.getAttribute('href') ?? '').trim();
      return {
        hrefs: anchors.map(hrefOf).filter((href) => href.startsWith('/') && !href.startsWith('//')),
        nowhere: anchors.filter((anchor) => ['', '#'].includes(hrefOf(anchor))).length,
      };
    });
    expect.soft(nowhere, `${label}: no href="#" or href="" (WG5)`).toBe(0);
    // WG5, G12: a link to a retired route fails although its 302 still lands on a page.
    expect
      .soft(
        hrefs.filter((href) => RETIRED_ROUTES.some(({ pattern }) => pattern.test(href))),
        `${label}: no link to a retired route (WG5)`,
      )
      .toEqual([]);
    const broken: string[] = [];
    for (const href of [...new Set(hrefs.map((href) => href.split('#')[0]))]) {
      let end = resolved.get(href);
      if (end === undefined) {
        end = await endOf(page, href);
        resolved.set(href, end);
      }
      if (end !== '200') broken.push(`${href} → ${end}`);
    }
    expect.soft(broken, `${label}: every internal link answers (WG5)`).toEqual([]);
  }

  test('«Todo» con cada enlace de la paginación y las categorías de la muestra', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    for (const search of ['', '?page=2', '?view=slots', '?view=list']) {
      await openItems(page, 'es', ALL_CATEGORY.id, search);
      await expectLinks(page, `/es/items/${search}`);
    }
    for (const category of SAMPLE_CATEGORIES) {
      await openItems(page, 'es', category);
      await expectLinks(page, itemsPath('es', category));
    }
    await forgetView(page);
  });

  test('un id de categoría desconocido responde 404 (8.5 «Rutas»)', async ({ page }) => {
    for (const locale of LOCALES) {
      const path = `/${locale}/items/c/no-existe/`;
      const response = await page.goto(path);
      expect(response?.status(), `${path} answers 404 (8.12)`).toBe(404);
    }
  });
});

test.describe('WA1: axe en las tres vistas, con un tooltip y con la hoja móvil', () => {
  for (const locale of LOCALES) {
    test.describe(`${locale} a 1440`, () => {
      test.use({ viewport: { width: 1440, height: 900 } });

      test(`${locale}: «Todo» y una categoría, con un tooltip abierto`, async ({ page }) => {
        test.setTimeout(180_000);
        for (const category of [ALL_CATEGORY.id, BIGGEST]) {
          for (const view of ['cards', 'slots', 'list'] as ViewName[]) {
            const root = await openItems(page, locale, category, `?view=${view}`);
            const label = `${itemsPath(locale, category)}?view=${view}`;
            await expectAxeClean(page, label);
            if ((await root.locator('[data-ac-tt] a, [data-ac-tt] button').count()) === 0) continue;
            await openTooltip(page, root);
            await expectAxeClean(page, `${label} with a tooltip open`);
            await page.keyboard.press('Escape');
          }
        }
        await forgetView(page);
      });
    });

    test.describe(`${locale} a 390`, () => {
      test.use({ viewport: { width: 390, height: 844 } });

      test(`${locale}: «Todo» y una categoría con la hoja móvil abierta`, async ({ page }) => {
        for (const category of [ALL_CATEGORY.id, BIGGEST]) {
          await page.goto(itemsPath(locale, category));
          const trigger = page.locator('[aria-controls="menu-movil"]').first();
          await trigger.click();
          await expect(page.locator('dialog#menu-movil')).toBeVisible();
          await expectAxeClean(page, `${itemsPath(locale, category)} with the phone sheet open`);
          await page.keyboard.press('Escape');
          await expect(page.locator('dialog#menu-movil')).toBeHidden();
        }
      });
    });
  }
});

test.describe('WA2, WA3 y WA4: estructura, estado de los controles e idioma', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const locale of LOCALES) {
    test(`${locale}: «Todo» en sus tres vistas y una categoría`, async ({ page }) => {
      test.setTimeout(120_000);
      for (const view of ['cards', 'slots', 'list'] as ViewName[]) {
        const root = await openItems(page, locale, ALL_CATEGORY.id, `?view=${view}`);
        await expectStructure(page, locale, `/${locale}/items/?view=${view}`);
        // WA3: the menu entry of the route and the current page of the pagination. The entry
        // is the one of its group: the pinned «Destacados» may link the page too (E10, M10).
        await expect(
          page.locator(`.ac-page-layout__sidebar details a[href="/${locale}/items/"]`),
        ).toHaveAttribute('aria-current', 'page');
        if (ROWS.length > PAGE_SIZE) {
          await expect(root.locator('.ac-pagination [aria-current="page"]')).toHaveCount(1);
        }
      }
      for (const category of SAMPLE_CATEGORIES) {
        await openItems(page, locale, category);
        await expectStructure(page, locale, itemsPath(locale, category));
        await expect(
          page.locator(`.ac-page-layout__sidebar details a[href="${itemsPath(locale, category)}"]`),
        ).toHaveAttribute('aria-current', 'page');
        // WA4 with the data: a `uso` that only the other language has carries its lang.
        const other = locale === 'es' ? 'en' : 'es';
        for (const item of pageOf(category)) {
          const use = item.uso;
          if (!use || use[locale] || !use[other]) continue;
          await expect(
            page.locator(`[lang="${other}"]`, { hasText: use[other] as string }),
          ).not.toHaveCount(0);
        }
      }
      await forgetView(page);
    });
  }
});

test.describe('WL1: sin relleno (§12.22)', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const locale of LOCALES) {
    test(`${locale}: «Todo» en sus vistas y una categoría`, async ({ page }) => {
      const { items, ui } = MESSAGES[locale];
      for (const search of ['', '?view=slots', '?view=list']) {
        await openItems(page, locale, ALL_CATEGORY.id, search);
        await expectNoRemovedText(page, `/${locale}/items/${search}`);
      }
      for (const category of SAMPLE_CATEGORIES) {
        await openItems(page, locale, category);
        await expectNoRemovedText(page, itemsPath(locale, category));
      }

      // The texts the page does write come from the dictionary and the registry.
      await openItems(page, locale, ALL_CATEGORY.id);
      const found = await harvest(page);
      const texts = new Set(found.texts);
      for (const category of CATEGORIES) {
        expect
          .soft(texts.has(category.nombre[locale]), `WL1: the tab «${category.nombre[locale]}»`)
          .toBe(true);
      }
      if (ROWS.length > 0) {
        expect
          .soft(texts.has(counted(items.count, ROWS.length, locale)), 'WL1: the count')
          .toBe(true);
        expect.soft(texts.has(ui.views.cards), 'WL1: the view toggle').toBe(true);
      }
      await forgetView(page);
    });
  }
});

test.describe('Índice de búsqueda: el grupo Ítems y la página de Ítems (8.6, BU6)', () => {
  interface Entry {
    kind: string;
    id: string;
    name: string;
    href: string;
    meta?: string;
    terms?: string[];
  }

  for (const locale of LOCALES) {
    test(`${locale}: un ítem por registro, con su categoría y su página`, async ({ page }) => {
      const response = await page.request.get(`/${locale}/buscar/indice.json`);
      expect(response.status()).toBe(200);
      const entries = (await response.json()) as Entry[];
      const market = entries.filter(
        (entry) => entry.kind === 'item' && entry.href.includes('/items/c/'),
      );
      expect(
        market.map((entry) => entry.id),
        `${locale}: every item of the build`,
      ).toEqual(ROWS.map((row) => row.id));

      const seen = new Map<string, number>();
      for (const [index, entry] of market.entries()) {
        const row = ROWS[index];
        const position = seen.get(row.categoria) ?? 0;
        seen.set(row.categoria, position + 1);
        const number = Math.floor(position / PAGE_SIZE) + 1;
        const query = number > 1 ? `?page=${number}` : '';
        expect
          .soft(entry.href, `${row.id}: its category page, page ${number} (8.6)`)
          .toBe(`${itemsPath(locale, row.categoria)}${query}#item-${row.id}`);
        expect.soft(entry.name, `${row.id}: its name (13.4)`).toBe(row.nombre);
        const category = REAL_CATEGORIES.find((entry_) => entry_.id === row.categoria);
        expect
          .soft(entry.meta, `${row.id}: the name of its category`)
          .toBe(category?.nombre[locale]);
      }

      // BU6: the Ítems index is a page of the `pagina` group, and every one of them answers.
      const pages = entries.filter((entry) => entry.kind === 'pagina');
      expect(pages.map((entry) => entry.href)).toContain(`/${locale}/items/`);
      for (const entry of pages) {
        const status = (await page.request.get(entry.href, { maxRedirects: 0 })).status();
        expect.soft(status, `BU6: ${entry.href}`).toBe(200);
      }
      for (const entry of market.slice(0, 5)) {
        const status = (await page.request.get(entry.href.split('#')[0])).status();
        expect.soft(status, `BU6: ${entry.href}`).toBe(200);
      }
    });
  }
});
