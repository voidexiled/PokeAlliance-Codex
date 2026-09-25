// §8.6 acceptance (M10): Buscar — the index of the palette (`/{l}/buscar/indice.json`, 7.9.1)
// and the results page `/{l}/buscar/` — against the real pages, over the registries the
// development server reads.
//
// What it measures, by the ids of the spec:
//
//  - BU1 to BU6. The expected results are computed here from the index the server writes and
//    the scoring of src/lib/search/rank.ts, the one the palette and the island share (7.9.4):
//    what a query must find is the registry's (BU2 reads content/pokemon.json), and the order
//    and the page cut are the spec's (8.6 step 4). BU5 checks that no page asks for the index
//    before the palette opens, and its weight (§13.6, 60 KB gzip). BU6 asks every route of
//    the index, and checks that the `pagina` group follows the table of 8.6 with Comercio,
//    Guild and Cambios in it exactly while their routes answer.
//  - The steps of 8.6: the h1 «Buscar» (`buscar-t`) that names the field, the one search
//    region, Destacados without a query and under the empty line, the count with its plural
//    (B-08), the groups of the table in its order with h2 and card titles h3, 24 results a
//    page and `Pagination`, and the error line of a search that did not load (step 7).
//  - The protocol of §8.0.7 for a page with no board: WG1 (the frame of §5.5 at 1440 and 390,
//    no sideways scroll), WG4 (template B and the grids of CGS §4 at 1440, 1280, 1024, 768 and
//    390), WG5, WA1 (axe with and without a query, in the three views, with a panel open and
//    with the phone sheet open), WA2, WA3 (no mark in the menu, `aria-pressed`, the current
//    page of the pagination), WA4 and WL1 (B-01 to B-14 of §12.5, L-01 and L-02 of §12.18, and
//    the crumbs «Inicio / Buscar en el Codex» that E4 removes with no replacement).
//
// §12.20 point 1 (`/es/buscar/?q=bulba` opens with the field filled and the query in the URL)
// is tests/e2e/prod.spec.ts, over the deployed output. The list controller that every list
// shares (U1 to U6, H1 to H7, V1 to V8, PR1 to PR5) is tests/e2e/lists.spec.ts, on the Pokédex;
// what this list does on its own is measured here: a page change with its history entry, its
// focus and Back (H1, H2, H4, H6), the page the ranking bounds (U4), the saved view (U6), the
// root hidden before the first paint (PR4) and the 100 characters of the field for a `q` of the
// URL (8.6 step 2). Its configuration, its order and its inline script are
// tests/search/results.test.ts. The 390 baseline of this page is the `buscar-390` entry of
// tests/visual/manifest.json.
//
// Runs in the `desktop` project. The 390 checks are viewport overrides of this spec.

import { gzipSync } from 'node:zlib';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import AxeBuilder from '@axe-core/playwright';
import type { Locator, Page } from '@playwright/test';

import { en } from '../../src/i18n/messages/en';
import type { Messages } from '../../src/i18n/messages/en';
import { es } from '../../src/i18n/messages/es';
import { normalizeQuery } from '../../src/lib/search/normalize';
import { rankSearch, scoreEntry, searchKinds } from '../../src/lib/search/rank';
import type { SearchEntry, SearchKind } from '../../src/lib/search/rank';
import { idiomas } from '../../scripts/lib/rutas-migradas.mjs';
import { expandSearchIndex } from '../../src/lib/search/index-file';
import { expect, test } from './fixtures';
import { POKEMON_SAMPLE, RETIRED_ROUTES } from './routes';

// ------------------------------------------------------------------------------ registries

type Locale = 'es' | 'en';
type Localized = Record<Locale, string>;

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(resolve(ROOT, file), 'utf8')) as T;
}

/** `hideDrafts` of src/lib/content/registry.ts, read from the environment of this run. */
const HIDE_DRAFTS = /^(?:1|true)$/i.test(process.env.OCULTAR_BORRADORES ?? '');

interface PokemonRecord {
  id: string;
  nombre: string;
  numero: number | null;
  tier: string | number | null;
  elementos: string[];
}

interface DestacadoRecord {
  etiqueta: Localized;
  ruta: string;
  borrador?: boolean;
}

const POKEMON = readJson<{ pokemon: PokemonRecord[] }>('content/pokemon.json').pokemon;
const POKEMON_IDS = new Set(POKEMON.map((record) => record.id));

interface SistemaRecord {
  id: string;
  titulo: Localized;
  tooltip?: unknown[];
  borrador?: boolean;
}

/** The system pages this build writes (8.4), drafts out under OCULTAR_BORRADORES=1. */
const SISTEMAS = readdirSync(resolve(ROOT, 'content/sistemas'))
  .filter((file) => file.endsWith('.json'))
  .map((file) => readJson<SistemaRecord>(`content/sistemas/${file}`))
  .filter((record) => !(HIDE_DRAFTS && record.borrador === true));

const DESTACADOS = existsSync(resolve(ROOT, 'content/destacados.json'))
  ? readJson<{ destacados: DestacadoRecord[] }>('content/destacados.json').destacados.filter(
      (entry) => !(HIDE_DRAFTS && entry.borrador === true),
    )
  : [];

const MESSAGES: Record<Locale, Messages> = { es, en };
const LOCALES = idiomas as Locale[];

/**
 * 8.6, `pagina`: the pages of its table, in its order, with their route template. The labels of
 * the menu entries are those of 8.0.3 (src/lib/nav/groups.ts owns them).
 */
const PAGE_TABLE: { id: string; route: string }[] = [
  { id: 'pokedex', route: '/{l}/pokedex/' },
  { id: 'tiers', route: '/{l}/pokedex/tiers/' },
  { id: 'comparar', route: '/{l}/herramientas/pokemon/' },
  { id: 'items', route: '/{l}/items/' },
  { id: 'sistemas', route: '/{l}/sistemas/' },
  { id: 'actividades', route: '/{l}/actividades/' },
  { id: 'herramientas', route: '/{l}/herramientas/' },
  { id: 'guild', route: '/{l}/herramientas/guild/' },
  { id: 'comercio', route: '/{l}/comercio/' },
  { id: 'cambios', route: '/{l}/cambios/' },
];

/** 8.0.3: the labels of the three menu entries this milestone joins to the index. */
const COMMUNITY_LABELS: Record<string, Localized> = {
  guild: { es: 'Guild', en: 'Guild' },
  comercio: { es: 'Comercio', en: 'Trade' },
  cambios: { es: 'Cambios', en: 'Changes' },
};

// ----------------------------------------------------------------------- the registry's text

const NUMBER_LOCALE: Record<Locale, string> = { es: 'es-ES', en: 'en-US' };

/** §13.3: grouped thousands in both locales. */
function figure(value: number, locale: Locale): string {
  return new Intl.NumberFormat(NUMBER_LOCALE[locale], { useGrouping: 'always' }).format(value);
}

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => values[key] ?? whole);
}

type Leaf = string | { one: string; other: string };

/** A count as the dictionary writes it, the figure already formatted (§13.2, B-08). */
function counted(leaf: Leaf, n: number, locale: Locale): string {
  const template =
    typeof leaf === 'string'
      ? leaf
      : new Intl.PluralRules(NUMBER_LOCALE[locale]).select(n) === 'one'
        ? leaf.one
        : leaf.other;
  return fill(template, { n: figure(n, locale) });
}

// ------------------------------------------------------------------------------ the index

/** 8.0.6: results a page of the `buscar` list. */
const PAGE_SIZE = 24;

/** The index the palette and the page read (7.9.1), as the server writes it. */
async function indexOf(page: Page, locale: Locale): Promise<SearchEntry[]> {
  const response = await page.request.get(`/${locale}/buscar/indice.json`);
  expect(response.status(), `/${locale}/buscar/indice.json answers 200`).toBe(200);
  return expandSearchIndex(await response.json()) as SearchEntry[];
}

/**
 * The results of a query in the order of 7.9.4 (8.6 step 4): every match of `rankSearch`, with
 * no cap per group, by score, then by the order of the kinds, then by name. `rankSearch` gives
 * the groups in the order of the kinds, each sorted by score and name, so a stable sort of
 * their concatenation by the score alone is that order.
 */
function ranked(entries: readonly SearchEntry[], query: string, locale: Locale): SearchEntry[] {
  const normalized = normalizeQuery(query);
  const ordered = rankSearch(entries, query, locale, Number.POSITIVE_INFINITY).flatMap(
    (group) => group.entries,
  );
  const score = new Map(ordered.map((entry) => [entry, scoreEntry(entry, normalized) ?? 0]));
  return ordered.sort((a, b) => (score.get(a) ?? 0) - (score.get(b) ?? 0));
}

/** 8.0.6: the pages of a list of results, at least one. */
function pageCount(results: readonly SearchEntry[]): number {
  return Math.max(1, Math.ceil(results.length / PAGE_SIZE));
}

/** The groups of one page of results: after the cut, by kind, in the order of 8.6 (CGS §2.1). */
function groupsOfPage(results: readonly SearchEntry[], page = 1) {
  const shown = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  return searchKinds
    .map((kind) => ({ kind, entries: shown.filter((entry) => entry.kind === kind) }))
    .filter((group) => group.entries.length > 0);
}

// --------------------------------------------------------------------------- page helpers

/** The dev server compiles a page on its first request: the first hydration may be slow. */
const READY_TIMEOUT = 30_000;

function searchPath(locale: Locale, search = ''): string {
  return `/${locale}/buscar/${search}`;
}

function resultsRoot(page: Page): Locator {
  return page.locator('.ac-search-results');
}

function listOf(page: Page): Locator {
  return page.locator('.ac-entity-list[data-ac-list="buscar"]');
}

/** The island hydrated and applied the query of the URL (PR1, PR4). */
async function searchReady(page: Page): Promise<void> {
  const root = resultsRoot(page);
  await expect(root).toHaveCount(1);
  await expect(page.locator('astro-island[ssr]').filter({ has: root })).toHaveCount(0, {
    timeout: READY_TIMEOUT,
  });
  await expect(root).not.toHaveAttribute('data-ac-pending', { timeout: READY_TIMEOUT });
}

async function openSearch(page: Page, locale: Locale, search = ''): Promise<void> {
  const path = searchPath(locale, search);
  const response = await page.goto(path);
  expect(response?.status(), `${path} answers 200`).toBe(200);
  await searchReady(page);
}

function countOf(page: Page): Locator {
  return listOf(page).locator('.ac-entity-list__bar [aria-live="polite"]');
}

/** Every group of results the page draws: its label, its count and the names it lists. */
async function readGroups(page: Page) {
  return listOf(page)
    .locator('.ac-card-group')
    .evaluateAll((groups) =>
      groups.map((group) => {
        const head = group.querySelector(':scope > .ac-card-group__head');
        const label = [...(head?.childNodes ?? [])]
          .filter((node) => node.nodeType === Node.TEXT_NODE)
          .map((node) => node.textContent ?? '')
          .join('')
          .trim();
        return {
          level: head?.localName ?? null,
          label,
          count: (head?.querySelector('.ac-card-group__count')?.textContent ?? '').trim(),
          names: [...group.querySelectorAll('.ac-card__title, .ac-index-links__label')].map(
            (title) => (title.textContent ?? '').replace(/\s+/g, ' ').trim(),
          ),
          titleLevels: [...group.querySelectorAll('.ac-card__title')].map(
            (title) => title.localName,
          ),
          hrefs: [
            ...group.querySelectorAll('.ac-card__title a[href], a.ac-index-links__link[href]'),
          ].map((link) => link.getAttribute('href')),
        };
      }),
    );
}

/** What the groups of a page must be, from the index and the order of 7.9.4. */
function expectedGroups(results: readonly SearchEntry[], locale: Locale, page = 1) {
  const { search } = MESSAGES[locale];
  return groupsOfPage(results, page).map((group) => ({
    label: search.groups[group.kind],
    count: figure(group.entries.length, locale),
    names: group.entries.map((entry) => entry.name),
  }));
}

/** The page of the pagination that is the current one. */
function currentPage(page: Page): Locator {
  return listOf(page).locator('.ac-pagination [aria-current="page"]');
}

/** A button of `ViewToggle` in the results bar, by its label in `ui.views` (es). */
function viewButton(page: Page, label: 'Cards' | 'Slots' | 'Lista'): Locator {
  return listOf(page).locator('.ac-view-toggle').getByRole('button', { name: label, exact: true });
}

/**
 * Where an element rests once the page stops scrolling: without reduced motion the document
 * scrolls smoothly (6.4), so a scroll the controller started may still be moving.
 */
async function settledTop(target: Locator): Promise<number> {
  let last = Number.NaN;
  await expect
    .poll(
      async () => {
        const top = await target.evaluate((element) => element.getBoundingClientRect().top);
        const still = Math.abs(top - last) < 0.5;
        last = top;
        return still;
      },
      { intervals: [100, 100, 200, 200, 300, 500] },
    )
    .toBe(true);
  return last;
}

/** The palette island mounted: the shortcut and the triggers reach it (7.9.1, C7-11). */
async function paletteReady(page: Page): Promise<void> {
  await expect(page.locator('html[data-ac-search="ready"]')).toHaveCount(1, {
    timeout: READY_TIMEOUT,
  });
}

// -------------------------------------------------------------------------- frame (WG1)

/** §5.5: x and width of the main column; Buscar is template B, the 208 spacer at 1440. */
const MAIN_COLUMN: Record<number, [number, number]> = {
  1440: [248, 944],
  1280: [248, 784],
  1024: [16, 992],
  768: [16, 736],
  390: [16, 358],
};

async function readFrame(page: Page) {
  return page.evaluate(() => {
    const box = (selector: string) => {
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
      spacer: box('.ac-page-layout__spacer'),
      scrollWidth: document.documentElement.scrollWidth,
    };
  });
}

/** WG1 (S1): the frame of §5.5 and no sideways scroll, at the width of the window. */
async function expectFrame(page: Page, width: number, label: string): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, 0));
  const frame = await readFrame(page);
  const [x, w] = MAIN_COLUMN[width];
  expect.soft(frame.header?.y ?? NaN, `${label}: header at y 0`).toBeCloseTo(0, 0);
  expect.soft(frame.header?.h ?? NaN, `${label}: header 64 tall`).toBeCloseTo(64, 0);
  expect.soft(Math.abs((frame.main?.x ?? NaN) - x), `${label}: main x ${x}`).toBeLessThanOrEqual(1);
  expect
    .soft(Math.abs((frame.main?.w ?? NaN) - w), `${label}: main width ${w}`)
    .toBeLessThanOrEqual(1);
  expect.soft(Math.abs((frame.main?.y ?? NaN) - 96), `${label}: main y 96`).toBeLessThanOrEqual(1);
  if (width >= 1280) {
    expect.soft(frame.sidebar?.w ?? NaN, `${label}: sidebar 208 wide`).toBeCloseTo(208, 0);
    // Template B: `rail="spacer"` (8.0.2).
    expect.soft(frame.spacer?.shown ?? false, `${label}: spacer, no Toc rail`).toBe(true);
  } else {
    expect.soft(frame.sidebar?.shown ?? false, `${label}: no sidebar below 1280`).toBe(false);
  }
  expect
    .soft(frame.scrollWidth, `${label}: documentElement.scrollWidth ≤ ${width} (WG1)`)
    .toBeLessThanOrEqual(width);
}

type GridFamily = 'pokedex' | 'loot';

/** CGS §4: min card, columns and the phone gap of each family the results draw. */
const FAMILY: Record<GridFamily, { min: number; minCols: number; maxCols: number; phone: number }> =
  {
    pokedex: { min: 260, minCols: 2, maxCols: 4, phone: 8 },
    loot: { min: 240, minCols: 1, maxCols: 4, phone: 12 },
  };

/** CGS §4: `clamp(floor((W + gap) / (min + gap)), minCols, maxCols)`. */
function expectedColumns(family: GridFamily, width: number): number {
  const { min, minCols, maxCols, phone } = FAMILY[family];
  const gap = width < 480 ? phone : 16;
  return Math.min(maxCols, Math.max(minCols, Math.floor((width + gap) / (min + gap))));
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

/** Opens the first game tooltip of the results by hovering its trigger (7.5.4). */
async function openTooltip(page: Page): Promise<boolean> {
  const trigger = listOf(page).locator('[data-ac-tt] a, [data-ac-tt] button').first();
  if ((await trigger.count()) === 0) return false;
  await page.mouse.move(0, 0);
  await trigger.hover();
  const panel = page.locator('[role="tooltip"][data-open]').first();
  await expect(panel).toBeVisible();
  // The 150 ms entry of the panel (6.2): axe reads a fading panel at partial opacity.
  await panel.evaluate((element) =>
    Promise.all(
      element
        .getAnimations({ subtree: true })
        .filter((animation) => animation.effect?.getComputedTiming().endTime !== Infinity)
        .map((animation) => animation.finished),
    ),
  );
  return true;
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
      h1: [...document.querySelectorAll('h1')].map((h1) => ({
        id: h1.id,
        text: (h1.textContent ?? '').trim(),
      })),
      skips,
      mainId: main?.id ?? null,
      skipHref: skip?.getAttribute('href') ?? null,
      breadcrumbs: document.querySelectorAll('nav.ac-breadcrumb').length,
      searchRegions: document.querySelectorAll('[role="search"], search').length,
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
  const { search } = MESSAGES[locale];
  expect
    .soft(report.h1, `${label}: one h1, «Buscar», with the id of the field's name`)
    .toEqual([{ id: 'buscar-t', text: search.title }]);
  expect.soft(report.skips, `${label}: no skipped heading level (WA2)`).toEqual([]);
  expect.soft(report.mainId, `${label}: main#contenido (WA2)`).toBe('contenido');
  expect
    .soft(report.skipHref, `${label}: the skip link targets #contenido (WA2)`)
    .toBe('#contenido');
  expect.soft(report.breadcrumbs, `${label}: no breadcrumb (E4)`).toBe(0);
  expect.soft(report.searchRegions, `${label}: one role="search" (§14.3)`).toBe(1);
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
 * §12.5 and §12.18: the «Actual» of the rows BORRAR and REESCRIBIR, as the search page and
 * `ContentSearch` of 2026-09-19 wrote them in each locale, and the crumbs of that page, which
 * E4 removes with no replacement.
 */
const REMOVED: Record<Locale, Rule[]> = {
  es: [
    'Buscar en el Codex',
    /Wiki Core/,
    'Cada resultado lleva a su ficha o a su sección.',
    'Ruta de navegación',
    'Buscar Pokémon, misión, objeto o sistema…',
    'No hay registros que coincidan con esa búsqueda.',
    'Mostrar más',
    /^1 resultados$/,
    'Objetos',
    'training_charger',
    'availability_scope',
  ],
  en: [
    'Search the Codex',
    /Wiki Core/,
    'Every result links to its record or section.',
    'Search Pokémon, quest, item or system…',
    'No records match that search.',
    'Show more',
    /^1 results$/,
    'training_charger',
    'availability_scope',
  ],
};

/** §12.22: what a page could write by itself, in both locales. */
const FORBIDDEN: Rule[] = [
  /\bKKs?\b/,
  /\bgold\b/,
  /[↗✦]/,
  /\b\d+\s?px\b/,
  /^(undefined|NaN|\[object Object\]|Invalid Date)$/,
  /Próximamente|Coming soon|Borrador local|Local draft|Ctrl K\b/,
];

// ================================================================================ tests

test.describe('Buscar (8.6)', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const locale of LOCALES) {
    test(`${locale}: sin consulta — el campo con su nombre, Destacados y ni conteo ni lista (8.6 pasos 1 a 3)`, async ({
      page,
    }) => {
      const { search, shell, home } = MESSAGES[locale];
      await openSearch(page, locale);

      // 1. The h1 «Buscar» names the page and the field (`buscar-t`), and the title of §13.5.
      await expect(page.locator('h1#buscar-t')).toHaveText(search.title);
      await expect(page).toHaveTitle(`${search.title} · PokeAlliance Wiki`);
      await expect(page.locator('meta[name="description"]')).toHaveAttribute(
        'content',
        search.description,
      );

      // 2. One search region with the field of `TextField variant="search"`: named by the h1,
      // 100 characters at most, the placeholder of B-06 and no button (B-07).
      const region = page.locator('[role="search"]');
      await expect(region).toHaveCount(1);
      const field = region.locator('input[type="search"]');
      await expect(field).toHaveAttribute('aria-labelledby', 'buscar-t');
      await expect(field).toHaveAttribute('maxlength', '100');
      await expect(field).toHaveAttribute('placeholder', shell.searchHome);
      await expect(field).toHaveValue('');
      await expect(field).toBeEnabled();
      await expect(region.locator('button')).toHaveCount(0);

      // 3. No count and no list without a query (B-10); Destacados instead.
      await expect(listOf(page)).toHaveCount(0);
      await expect(page.locator('main .ac-count, main .ac-pagination')).toHaveCount(0);
      const featured = page.locator('main section.ac-featured-section');
      if (DESTACADOS.length === 0) {
        await expect(featured).toHaveCount(0);
      } else {
        await expect(featured.locator('h2')).toHaveText(home.featured);
        await expect(featured.locator('.ac-featured-card__label')).toHaveText(
          DESTACADOS.map((entry) => entry.etiqueta[locale]),
        );
        const hrefs = await featured
          .locator('a.ac-featured-card')
          .evaluateAll((links) => links.map((link) => link.getAttribute('href')));
        expect(hrefs).toEqual(DESTACADOS.map((entry) => `/${locale}${entry.ruta}`));
      }
    });

    test(`${locale}: BU1 — «charizard» encuentra Charizard y Shiny Charizard y nada que no coincida`, async ({
      page,
    }) => {
      const { search } = MESSAGES[locale];
      const results = ranked(await indexOf(page, locale), 'charizard', locale);
      for (const id of ['charizard', 'shiny-charizard']) {
        expect(
          results.some((entry) => entry.kind === 'pokemon' && entry.id === id),
          `BU1: ${id} matches «charizard»`,
        ).toBe(true);
      }

      await openSearch(page, locale, '?q=charizard');
      await expect(page.locator('[role="search"] input[type="search"]')).toHaveValue('charizard');
      await expect(countOf(page)).toHaveText(counted(search.count, results.length, locale));
      const groups = await readGroups(page);
      expect(
        groups.map(({ label, count, names }) => ({ label, count, names })),
        'BU1: the groups of 8.6, only what matches, in the order of 7.9.4',
      ).toEqual(expectedGroups(results, locale));
      const pokemon = groups.find((group) => group.label === search.groups.pokemon);
      expect(pokemon?.hrefs).toEqual(
        expect.arrayContaining([
          `/${locale}/pokedex/charizard/`,
          `/${locale}/pokedex/shiny-charizard/`,
        ]),
      );
      // 8.6 step 4: the group is an h2 and each card title an h3.
      expect(groups.every((group) => group.level === 'h2')).toBe(true);
      expect(groups.flatMap((group) => group.titleLevels).every((level) => level === 'h3')).toBe(
        true,
      );
    });

    test(`${locale}: BU1 — «zzzz» muestra la línea vacía y debajo Destacados (8.6 paso 6, V7)`, async ({
      page,
    }) => {
      const { search } = MESSAGES[locale];
      await openSearch(page, locale, '?q=zzzz');
      await expect(listOf(page).locator('.ac-empty-state')).toHaveText(
        fill(search.empty, { q: 'zzzz' }),
      );
      await expect(listOf(page).locator('.ac-card-group')).toHaveCount(0);
      await expect(page.locator('main .ac-pagination')).toHaveCount(0);
      await expect(page.locator('main section.ac-featured-section')).toHaveCount(
        DESTACADOS.length > 0 ? 1 : 0,
      );
      if (DESTACADOS.length > 0) {
        // «debajo»: Destacados comes after the empty line.
        const line = await listOf(page).locator('.ac-empty-state').boundingBox();
        const featured = await page.locator('main section.ac-featured-section').boundingBox();
        expect((featured?.y ?? 0) > (line?.y ?? 0), 'Destacados under the empty line').toBe(true);
      }
    });
  }

  test('BU2: «fuego», «fire», «006», «nº 6» y «legendary» encuentran los Pokémon del registro', async ({
    page,
  }) => {
    const entries = await indexOf(page, 'es');
    const legendary = (record: PokemonRecord) => String(record.tier).toLowerCase() === 'legendary';
    const cases: { query: string; expected: (record: PokemonRecord) => boolean }[] = [
      { query: 'fuego', expected: (record) => record.elementos.includes('fire') },
      { query: 'fire', expected: (record) => record.elementos.includes('fire') },
      { query: '006', expected: (record) => record.numero === 6 },
      { query: 'nº 6', expected: (record) => record.numero === 6 },
      { query: 'legendary', expected: legendary },
    ];
    for (const { query, expected } of cases) {
      const wanted = POKEMON.filter(expected).map((record) => record.id);
      expect(wanted.length, `the registry has Pokémon for «${query}»`).toBeGreaterThan(0);
      const normalized = normalizeQuery(query);
      const found = ranked(entries, query, 'es')
        .filter((entry) => entry.kind === 'pokemon')
        .map((entry) => entry.id);
      // Every expected Pokémon is found, and the only others are names or ids that hold the
      // query itself (7.9.4 rule 1 to 3).
      expect(found, `BU2: «${query}» finds every expected Pokémon`).toEqual(
        expect.arrayContaining(wanted),
      );
      const strays = found.filter((id) => {
        if (wanted.includes(id)) return false;
        const record = POKEMON.find((entry) => entry.id === id);
        const name = normalizeQuery(record?.nombre ?? '');
        return !(name.includes(normalized) || id.includes(normalized));
      });
      expect(strays, `BU2: «${query}» finds nothing else`).toEqual([]);
    }

    // The page counts the same results the index gives (8.6 step 4, B-08).
    const results = ranked(entries, 'fuego', 'es');
    await openSearch(page, 'es', '?q=fuego');
    await expect(countOf(page)).toHaveText(counted(es.search.count, results.length, 'es'));
    expect(
      (await readGroups(page)).map(({ label, count, names }) => ({ label, count, names })),
    ).toEqual(expectedGroups(results, 'es'));
  });

  test('B-08: una sola coincidencia se cuenta en singular', async ({ page }) => {
    const entries = await indexOf(page, 'es');
    const single = ['boost', 'bulbasaur', 'charizard']
      .map((query) => ({ query, results: ranked(entries, query, 'es') }))
      .find((candidate) => candidate.results.length === 1);
    test.skip(single === undefined, 'Ninguna consulta de la muestra da un solo resultado.');
    if (single === undefined) return;
    await openSearch(page, 'es', `?q=${encodeURIComponent(single.query)}`);
    await expect(countOf(page)).toHaveText(counted(es.search.count, 1, 'es'));
  });

  test('8.6 pasos 4 y 5: 24 por página, agrupados después de cortar, y la paginación', async ({
    page,
  }) => {
    const entries = await indexOf(page, 'es');
    const query = 'a';
    const results = ranked(entries, query, 'es');
    test.skip(results.length <= PAGE_SIZE, 'La consulta no llena dos páginas.');
    for (const number of [1, 2]) {
      await openSearch(page, 'es', `?q=${query}${number > 1 ? `&page=${number}` : ''}`);
      const groups = await readGroups(page);
      expect(
        groups.map(({ label, count, names }) => ({ label, count, names })),
        `page ${number}: the ranked results ${(number - 1) * PAGE_SIZE + 1} to ${number * PAGE_SIZE}`,
      ).toEqual(expectedGroups(results, 'es', number));
      await expect(page.locator('main .ac-pagination [aria-current="page"]')).toHaveText(
        String(number),
      );
    }
  });

  test('BU3: en la paleta, «char» + Intro abre la primera opción y la última lleva a /buscar/', async ({
    page,
  }) => {
    const { search } = MESSAGES.es;
    const groups = rankSearch(await indexOf(page, 'es'), 'char', 'es');
    expect(groups[0]?.kind, 'the Pokémon group comes first').toBe('pokemon');
    const first = groups[0]?.entries[0];
    expect(first).toBeDefined();
    if (first === undefined) return;

    const palette = page.locator('dialog#buscar-dialogo');
    const field = palette.locator('#buscar-campo');

    await page.goto('/es/');
    await paletteReady(page);
    await page.keyboard.press('Control+k');
    await expect(palette).toBeVisible();
    await field.fill('char');
    const options = palette.locator('[role="option"]');
    await expect(options.first()).toHaveAttribute('href', first.href);
    await expect(options.first()).toHaveAttribute('aria-selected', 'true');
    // The last option, outside the groups, goes to the results page (7.9.3).
    const all = options.last();
    await expect(all).toHaveText(fill(search.seeAll, { q: 'char' }));
    await expect(all).toHaveAttribute('href', '/es/buscar/?q=char');
    await expect(all, 'outside the groups, with no label').toHaveId('buscar-opcion-todos');
    await expect(palette.locator('[role="group"] #buscar-opcion-todos')).toHaveCount(0);

    await Promise.all([page.waitForURL(`**${first.href}`), field.press('Enter')]);
    expect(new URL(page.url()).pathname).toBe(first.href.split('?')[0]);

    // The last option with the keyboard: ↑ from the first wraps to it (7.9.4).
    await page.goto('/es/');
    await paletteReady(page);
    await page.keyboard.press('Control+k');
    await expect(palette).toBeVisible();
    await field.fill('char');
    await expect(options.first()).toHaveAttribute('aria-selected', 'true');
    await field.press('ArrowUp');
    await expect(options.last()).toHaveAttribute('aria-selected', 'true');
    await Promise.all([page.waitForURL('**/es/buscar/?q=char'), field.press('Enter')]);
    await searchReady(page);
    await expect(page.locator('[role="search"] input[type="search"]')).toHaveValue('char');
  });

  test('BU4: con el índice bloqueado, la paleta y la página dicen «No se pudo cargar la búsqueda.»', async ({
    page,
  }) => {
    const { search } = MESSAGES.es;
    await page.route('**/buscar/indice.json*', (route) => route.abort());

    await page.goto('/es/');
    await paletteReady(page);
    await page.keyboard.press('Control+k');
    const palette = page.locator('dialog#buscar-dialogo');
    await expect(palette).toBeVisible();
    await palette.locator('#buscar-campo').fill('char');
    await expect(palette.locator('.ac-search-palette__empty')).toHaveText(search.error);
    await page.keyboard.press('Escape');

    const response = await page.goto(searchPath('es', '?q=char'));
    expect(response?.status()).toBe(200);
    await expect(listOf(page).locator('.ac-empty-state')).toHaveText(search.error, {
      timeout: READY_TIMEOUT,
    });
    await expect(listOf(page).locator('.ac-card-group')).toHaveCount(0);
  });

  test('BU5: el índice pesa ≤ 60 KB gzip y ninguna página lo pide antes de abrir la paleta', async ({
    page,
  }) => {
    const asked: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.endsWith('/buscar/indice.json'))
        asked.push(request.url());
    });

    for (const path of ['/es/', '/es/pokedex/']) {
      await page.goto(path);
      await paletteReady(page);
      await page.waitForLoadState('load');
      // `client:idle` islands have mounted; give an idle prefetch the time it would take.
      await page.waitForTimeout(1_500);
      expect(asked, `BU5: ${path} does not ask for the index by itself`).toEqual([]);
    }

    // Opening the palette asks for it.
    await page.keyboard.press('Control+k');
    await expect(page.locator('dialog#buscar-dialogo')).toBeVisible();
    await expect
      .poll(() => asked.length, { message: 'the palette asks for the index' })
      .toBeGreaterThan(0);

    // The results page asks for it as it loads (8.6 step 7).
    asked.length = 0;
    await openSearch(page, 'es');
    await expect
      .poll(() => asked.length, { message: '/buscar/ asks for the index' })
      .toBeGreaterThan(0);

    // §13.6: 60 KB gzip for the index of each locale.
    for (const locale of LOCALES) {
      const body = await (await page.request.get(`/${locale}/buscar/indice.json`)).body();
      expect(
        gzipSync(body).byteLength,
        `BU5: /${locale}/buscar/indice.json gzip`,
      ).toBeLessThanOrEqual(60_000);
    }
  });

  for (const locale of LOCALES) {
    test(`${locale}: BU6 — cada entrada del índice lleva a una ruta que existe`, async ({
      page,
    }) => {
      test.setTimeout(240_000);
      const entries = await indexOf(page, locale);
      expect(entries.length).toBeGreaterThan(0);
      for (const entry of entries) {
        expect.soft(entry.href.startsWith(`/${locale}/`), `${entry.href}: its locale`).toBe(true);
        expect.soft(searchKinds.includes(entry.kind as SearchKind), `${entry.kind}`).toBe(true);
      }

      // Pokémon: each page is its record's (FI1 counts them in the build); the sample of §14.4
      // is asked.
      const pokemon = entries.filter((entry) => entry.kind === 'pokemon');
      for (const entry of pokemon) {
        expect.soft(POKEMON_IDS.has(entry.id), `${entry.id} is a record`).toBe(true);
        expect.soft(entry.href).toBe(`/${locale}/pokedex/${entry.id}/`);
      }
      for (const id of POKEMON_SAMPLE) {
        const status = (await page.request.get(`/${locale}/pokedex/${id}/`)).status();
        expect.soft(status, `BU6: /${locale}/pokedex/${id}/`).toBe(200);
      }

      // Everything else is asked, each route once.
      const routes = [
        ...new Set(
          entries
            .filter((entry) => entry.kind !== 'pokemon')
            .map((entry) => entry.href.split('#')[0]),
        ),
      ];
      for (const route of routes) {
        const status = (await page.request.get(route, { maxRedirects: 0 })).status();
        expect.soft(status, `BU6: ${route}`).toBe(200);
      }

      // `pagina` follows the table of 8.6, and Comercio, Guild and Cambios are in it exactly
      // while their routes answer (WG5).
      const pages = entries.filter((entry) => entry.kind === 'pagina');
      const order = pages.map((entry) => PAGE_TABLE.findIndex((row) => row.id === entry.id));
      expect(
        order.every((rank) => rank >= 0),
        'every page is a row of the table',
      ).toBe(true);
      expect(
        order.every((rank, index) => index === 0 || rank > order[index - 1]),
        'in the order of the table',
      ).toBe(true);
      for (const row of PAGE_TABLE) {
        const entry = pages.find((candidate) => candidate.id === row.id);
        if (entry !== undefined) {
          expect.soft(entry.href).toBe(row.route.replaceAll('{l}', locale));
        }
      }
      for (const id of ['guild', 'comercio', 'cambios']) {
        const row = PAGE_TABLE.find((candidate) => candidate.id === id);
        const route = (row?.route ?? '').replaceAll('{l}', locale);
        const exists = (await page.request.get(route, { maxRedirects: 0 })).status() === 200;
        const entry = pages.find((candidate) => candidate.id === id);
        expect.soft(entry !== undefined, `${id}: in the index while ${route} answers`).toBe(exists);
        if (entry !== undefined) expect.soft(entry.name).toBe(COMMUNITY_LABELS[id][locale]);
      }
    });
  }
});

test.describe('La lista `buscar` (7.7, 8.0.6): historia, foco, página, vista guardada y PR4', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  /** 7.7.1: the key of the saved view of this list, `ac:vista:buscar` (U6). */
  const SAVED = 'ac:vista:buscar';

  /** H4: the results land 16 px under the 64 px header (`scroll-padding-top`, 3.6). */
  const RESULTS_TOP = 80;

  /** A query of the index with more than one page of results, whatever the registries hold. */
  function longQuery(entries: readonly SearchEntry[]): string | undefined {
    return ['a', 'e', 'o', 'i'].find((query) => ranked(entries, query, 'es').length > PAGE_SIZE);
  }

  async function forgetView(page: Page): Promise<void> {
    await page.evaluate((key) => {
      try {
        window.localStorage.removeItem(key);
      } catch {
        // U6: storage may be blocked; nothing was saved then.
      }
    }, SAVED);
  }

  test('H1, H2, H4 y H6: cambiar de página añade una entrada, enfoca los resultados y Atrás vuelve', async ({
    page,
  }) => {
    const entries = await indexOf(page, 'es');
    const query = longQuery(entries);
    test.skip(query === undefined, 'Ninguna consulta de la muestra llena dos páginas.');
    if (query === undefined) return;
    const results = ranked(entries, query, 'es');

    await openSearch(page, 'es', `?q=${query}`);
    await expect(currentPage(page)).toHaveText('1');
    await page.evaluate(() => {
      (window as unknown as { acSamePage: boolean }).acSamePage = true;
    });
    const before = await page.evaluate(() => window.history.length);

    await listOf(page).locator('.ac-pagination a', { hasText: /^2$/ }).click();
    await expect(page).toHaveURL(new RegExp(`/es/buscar/\\?q=${query}&page=2$`));
    await expect(currentPage(page)).toHaveText('2');
    // H6: the click is the controller's: the document did not reload.
    expect(
      await page.evaluate(() => (window as unknown as { acSamePage?: boolean }).acSamePage),
    ).toBe(true);
    // H1: a page change is a new history entry.
    expect(await page.evaluate(() => window.history.length)).toBe(before + 1);
    // H4: the results take the focus and land 16 px under the header.
    const zone = listOf(page).locator('.ac-entity-list__results');
    await expect(zone).toBeFocused();
    const top = await settledTop(zone);
    expect(Math.abs(top - RESULTS_TOP), `H4: results at ${top}`).toBeLessThanOrEqual(2);
    // 8.6 step 4: the second page is the ranked results 25 to 48, grouped after the cut.
    expect(
      (await readGroups(page)).map(({ label, count, names }) => ({ label, count, names })),
    ).toEqual(expectedGroups(results, 'es', 2));

    // H2: Back reads the URL again and walks the visited pages only.
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`/es/buscar/\\?q=${query}$`));
    await expect(currentPage(page)).toHaveText('1');
    expect(
      (await readGroups(page)).map(({ label, count, names }) => ({ label, count, names })),
    ).toEqual(expectedGroups(results, 'es', 1));
  });

  test('U4: la página que no existe se corrige en la URL, también la que solo acota el ranking', async ({
    page,
  }) => {
    const entries = await indexOf(page, 'es');
    const cases: { search: string; results: SearchEntry[]; canonical: string }[] = [];
    const query = longQuery(entries);
    if (query !== undefined) {
      const results = ranked(entries, query, 'es');
      const last = pageCount(results);
      cases.push({ search: `?q=${query}&page=99`, results, canonical: `?q=${query}&page=${last}` });
    }
    // The list controller bounds `page` with its own text filter, which finds every fragment
    // of the query anywhere in an entry and so never fewer entries than the ranking (U4,
    // tests/search/results.test.ts); «shiny a» ranks far fewer. The page the controller would
    // keep comes down to the last one of the ranking, which is the island's own bound.
    const narrow = ranked(entries, 'shiny a', 'es');
    const lastNarrow = pageCount(narrow);
    cases.push({
      search: `?q=shiny+a&page=${lastNarrow + 1}`,
      results: narrow,
      canonical: lastNarrow > 1 ? `?q=shiny+a&page=${lastNarrow}` : '?q=shiny+a',
    });

    for (const { search, results, canonical } of cases) {
      await openSearch(page, 'es', search);
      await expect(page, search).toHaveURL(
        new RegExp(`/es/buscar/${canonical.replace(/[?+]/g, (sign) => `\\${sign}`)}$`),
      );
      const last = pageCount(results);
      if (results.length > PAGE_SIZE) await expect(currentPage(page)).toHaveText(String(last));
      else await expect(listOf(page).locator('.ac-pagination')).toHaveCount(0);
      expect(
        (await readGroups(page)).map(({ label, count, names }) => ({ label, count, names })),
        search,
      ).toEqual(expectedGroups(results, 'es', last));
    }

    // A page that is not a number and an unknown view fall back to their defaults, which U2
    // leaves out of the URL.
    await openSearch(page, 'es', '?q=char&page=abc&view=nada');
    await expect(page).toHaveURL(/\/es\/buscar\/\?q=char$/);
  });

  test('U6: la vista elegida sobrevive a una recarga sin `view` en la URL', async ({ page }) => {
    await openSearch(page, 'es', '?q=char');
    await viewButton(page, 'Lista').click();
    await expect(viewButton(page, 'Lista')).toHaveAttribute('aria-pressed', 'true');
    await expect(page).toHaveURL(/\/es\/buscar\/\?q=char&view=list$/);
    expect(
      await page.evaluate((key) => {
        try {
          return window.localStorage.getItem(key);
        } catch {
          return null;
        }
      }, SAVED),
    ).toBe('list');

    await openSearch(page, 'es', '?q=char');
    await expect(viewButton(page, 'Lista')).toHaveAttribute('aria-pressed', 'true');
    await expect(listOf(page).locator('[data-list]')).toHaveCount(1);
    await expect(listOf(page).locator('[data-card-grid]')).toHaveCount(0);
    // U2: the saved view is never written back to the URL on its own.
    await expect(page).toHaveURL(/\/es\/buscar\/\?q=char$/);

    await viewButton(page, 'Cards').click();
    await forgetView(page);
  });

  test('PR4: con una consulta en la URL la raíz se pinta oculta hasta aplicarla', async ({
    page,
  }) => {
    // The island never hydrates here, so what the page shows is what the inline script left
    // before the first paint.
    await page.route('**/components/search/SearchResultsRoot*', (route) => route.abort());

    // Without a query the prerendered page is the state it shows: nothing is hidden.
    await page.goto(searchPath('es'));
    await expect(resultsRoot(page)).not.toHaveAttribute('data-ac-pending');
    await expect(page.locator('main section.ac-featured-section')).toHaveCount(
      DESTACADOS.length > 0 ? 1 : 0,
    );
    await expect(page.locator('.ac-page-layout__foot')).toBeVisible();

    // A query hides the root (and Destacados, which the query replaces) and the footer under it.
    for (const search of ['?q=char', '?q=char&view=list&page=2']) {
      await page.goto(searchPath('es', search));
      const root = resultsRoot(page);
      await expect(root, search).toHaveAttribute('data-ac-pending', '');
      expect(await root.evaluate((element) => getComputedStyle(element).visibility)).toBe('hidden');
      await expect(root.locator('.ac-featured-card').filter({ visible: true })).toHaveCount(0);
      await expect(page.locator('.ac-page-layout__foot')).toBeHidden();
    }
    // The view and the page alone change nothing the prerendered page shows.
    await page.goto(searchPath('es', '?view=list&page=3'));
    await expect(resultsRoot(page)).not.toHaveAttribute('data-ac-pending');
  });

  test('8.6 paso 2: un `q` de la URL se corta a los 100 caracteres del campo', async ({ page }) => {
    const { search } = MESSAGES.es;
    const long = 'x'.repeat(150);
    const kept = long.slice(0, 100);

    await openSearch(page, 'es', `?q=${long}`);
    const field = page.locator('[role="search"] input[type="search"]');
    await expect(field).toHaveValue(kept);
    expect(new URL(page.url()).searchParams.get('q')).toBe(kept);
    await expect(listOf(page).locator('.ac-empty-state')).toHaveText(
      fill(search.empty, { q: kept }),
    );

    // WG1: the empty line quotes one long word and breaks it inside the column (13.7 reflow).
    await page.setViewportSize({ width: 390, height: 844 });
    await openSearch(page, 'es', `?q=${kept}`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      390,
    );
  });
});

test.describe('WG1: el marco de §5.5 a 1440 y a 390', () => {
  for (const size of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    test.describe(`${size.width} px`, () => {
      test.use({ viewport: size });

      test(`sin consulta, con resultados y sin coincidencias a ${size.width}`, async ({ page }) => {
        for (const search of [
          '',
          '?q=poke',
          '?q=poke&view=slots',
          '?q=poke&view=list',
          '?q=zzzz',
        ]) {
          await openSearch(page, 'es', search);
          await expectFrame(page, size.width, searchPath('es', search));
        }
      });
    });
  }
});

test.describe('WG4: plantilla B y las rejillas de CGS §4 a 1440, 1280, 1024, 768 y 390', () => {
  for (const size of [
    { width: 1440, height: 900 },
    { width: 1280, height: 900 },
    { width: 1024, height: 900 },
    { width: 768, height: 900 },
    { width: 390, height: 844 },
  ]) {
    test.describe(`${size.width} px`, () => {
      test.use({ viewport: size });

      test(`«poke» en Cards a ${size.width}: Pokémon, ítems y páginas`, async ({ page }) => {
        await openSearch(page, 'es', '?q=poke');

        // Template B without crumbs (E4): the h1, the search region, the results bar (Count
        // and ViewToggle), the groups and the footer, each after the one before it.
        const SEQUENCE = [
          'h1',
          '[role="search"]',
          '.ac-entity-list__bar',
          '.ac-entity-list__results',
          'footer',
        ];
        const placed = await page.evaluate((selectors) => {
          const main = document.querySelector('main');
          const nodes = selectors.map((selector) => main?.querySelector(selector) ?? null);
          return nodes.map((node, index) => {
            if (node === null) return `${selectors[index]} missing`;
            const before = index === 0 ? null : nodes[index - 1];
            if (before === null || before === undefined) return 'ok';
            const follows = before.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING;
            return follows ? 'ok' : `${selectors[index]} before ${selectors[index - 1]}`;
          });
        }, SEQUENCE);
        expect(placed, 'template B, top to bottom').toEqual(SEQUENCE.map(() => 'ok'));
        await expect(listOf(page).locator('.ac-entity-list__bar .ac-view-toggle')).toHaveCount(1);
        await expect(page.locator('main nav.ac-breadcrumb'), 'no crumbs (E4)').toHaveCount(0);

        // The families the first page draws: Pokémon cards (8.2), item cards (8.5) and the link
        // lists of the other kinds (E5).
        const kinds = groupsOfPage(ranked(await indexOf(page, 'es'), 'poke', 'es')).map(
          (group) => group.kind,
        );
        const drawn: Record<GridFamily, boolean> = {
          pokedex: kinds.includes('pokemon'),
          loot: kinds.includes('item'),
        };
        const width = MAIN_COLUMN[size.width][1];
        for (const family of ['pokedex', 'loot'] as GridFamily[]) {
          const grid = listOf(page).locator(
            `.ac-card-grid[data-family="${family}"] > .ac-card-grid__grid`,
          );
          await expect(grid, `${family}: one grid when its kind has results`).toHaveCount(
            drawn[family] ? 1 : 0,
          );
          if (!drawn[family]) continue;
          const read = await readGrid(grid.first());
          expect
            .soft(Math.abs(read.width - width), `${family}: the grid spans the column`)
            .toBeLessThanOrEqual(1);
          expect
            .soft(read.columns, `${family} columns for ${read.width}`)
            .toBe(expectedColumns(family, read.width));
          expect.soft(read.spread, `${family}: no ragged row (S2)`).toBe(0);
        }
        // E5, 8.0.2 D: the link lists take 4 columns with a column of 900 or more, 2 below.
        const links = listOf(page).locator('.ac-index-links__list');
        await expect(links, 'one link list per kind without a card family').toHaveCount(
          kinds.filter((kind) => kind !== 'pokemon' && kind !== 'item').length,
        );
        for (let index = 0; index < (await links.count()); index += 1) {
          const read = await readGrid(links.nth(index));
          expect.soft(read.columns, `links columns at ${width}`).toBe(width >= 900 ? 4 : 2);
        }
      });
    });
  }
});

test.describe('WG5: cada enlace interno responde 200', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

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

  test('sin consulta, en las tres vistas y con paginación', async ({ page }) => {
    test.setTimeout(300_000);
    const resolved = new Map<string, string>();
    for (const search of ['', '?q=poke', '?q=poke&view=slots', '?q=poke&view=list', '?q=a']) {
      await openSearch(page, 'es', search);
      const { hrefs, nowhere } = await page.evaluate(() => {
        for (const group of document.querySelectorAll('details')) group.open = true;
        const anchors = [...document.querySelectorAll('a[href]')];
        const hrefOf = (anchor: Element) => (anchor.getAttribute('href') ?? '').trim();
        return {
          hrefs: anchors
            .map(hrefOf)
            .filter((href) => href.startsWith('/') && !href.startsWith('//')),
          nowhere: anchors.filter((anchor) => ['', '#'].includes(hrefOf(anchor))).length,
        };
      });
      const label = searchPath('es', search);
      expect.soft(nowhere, `${label}: no href="#" or href="" (WG5)`).toBe(0);
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
  });
});

test.describe('WA1: axe con y sin consulta, en las tres vistas, con un panel y con la hoja móvil', () => {
  for (const locale of LOCALES) {
    test.describe(`${locale} a 1440`, () => {
      test.use({ viewport: { width: 1440, height: 900 } });

      test(`${locale}: los estados de la página`, async ({ page }) => {
        test.setTimeout(180_000);
        for (const search of [
          '',
          '?q=poke',
          '?q=poke&view=slots',
          '?q=poke&view=list',
          '?q=zzzz',
        ]) {
          await openSearch(page, locale, search);
          await expectAxeClean(page, searchPath(locale, search));
        }
        // A system with tooltip rows opens its panel from the link list (E5, 8.4).
        const system = SISTEMAS.find((record) => (record.tooltip ?? []).length > 0);
        if (system !== undefined) {
          const search = `?q=${encodeURIComponent(system.titulo[locale])}`;
          await openSearch(page, locale, search);
          expect(await openTooltip(page), `${system.id} opens its panel`).toBe(true);
          await expectAxeClean(page, `${searchPath(locale, search)} with a panel open`);
          await page.keyboard.press('Escape');
        }
      });
    });

    test.describe(`${locale} a 390`, () => {
      test.use({ viewport: { width: 390, height: 844 } });

      test(`${locale}: con y sin consulta y con la hoja móvil abierta`, async ({ page }) => {
        for (const search of ['', '?q=poke']) {
          await openSearch(page, locale, search);
          await expectAxeClean(page, `${searchPath(locale, search)} at 390`);
        }
        await page.locator('[aria-controls="menu-movil"]').first().click();
        await expect(page.locator('dialog#menu-movil')).toBeVisible();
        await expectAxeClean(page, `${searchPath(locale, '?q=poke')} with the phone sheet open`);
        await page.keyboard.press('Escape');
        await expect(page.locator('dialog#menu-movil')).toBeHidden();
      });
    });
  }
});

test.describe('WA2, WA3 y WA4: estructura, estado de los controles e idioma', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const locale of LOCALES) {
    test(`${locale}: sin consulta, con resultados en las tres vistas y con paginación`, async ({
      page,
    }) => {
      test.setTimeout(120_000);
      for (const search of ['', '?q=poke', '?q=poke&view=slots', '?q=poke&view=list', '?q=a']) {
        await openSearch(page, locale, search);
        const label = searchPath(locale, search);
        await expectStructure(page, locale, label);
        // WA3: Buscar hangs from no section of the menu, so nothing there is marked (8.0.7).
        await expect(
          page.locator('.ac-page-layout__sidebar [aria-current]'),
          `${label}: no entry of the menu is current`,
        ).toHaveCount(0);
      }
      // WA3: the current page of the pagination.
      await openSearch(page, locale, '?q=a&page=2');
      await expect(page.locator('main .ac-pagination [aria-current="page"]')).toHaveText('2');
    });
  }

  test('v1 punto 2 y B-14: el campo sale del HTML sin `disabled`', async ({ page }) => {
    for (const locale of LOCALES) {
      const html = await (await page.request.get(searchPath(locale))).text();
      const field = /<input[^>]*type="search"[^>]*>/.exec(html)?.[0] ?? '';
      expect(field, `${locale}: the prerendered field`).not.toBe('');
      expect(field, `${locale}: never disabled while the island hydrates`).not.toMatch(
        /\sdisabled/,
      );
    }
  });
});

test.describe('WL1: sin relleno (§12.5, §12.18, §12.22)', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const locale of LOCALES) {
    test(`${locale}: ni B-01 a B-14 ni la lista prohibida`, async ({ page }) => {
      for (const search of ['', '?q=poke', '?q=zzzz']) {
        await openSearch(page, locale, search);
        const label = searchPath(locale, search);
        const found = await harvest(page);
        expect
          .soft(
            REMOVED[locale].flatMap((rule) => hits(found, rule)),
            `${label}: no text of §12.5 or §12.18 comes back`,
          )
          .toEqual([]);
        expect
          .soft(
            FORBIDDEN.flatMap((rule) => hits(found, rule)),
            `${label}: none of the forbidden strings of §12.22`,
          )
          .toEqual([]);
        await expect(page.locator('.eyebrow'), `${label}: B-02, no eyebrow`).toHaveCount(0);
        await expect(page.locator('svg[class*="lucide-"]'), `${label}: S7`).toHaveCount(0);
        await expect(page.locator('a[href="#"], a[href=""]'), `${label}: WG5`).toHaveCount(0);
        // B-07: no submit button in the search region.
        await expect(page.locator('[role="search"] button')).toHaveCount(0);
      }
      // L-01: the Market group is «Ítems» / «Items», never «Objetos». The query is the name of
      // an item this build indexes: under OCULTAR_BORRADORES=1 every placeholder item of the
      // registry may be out, and then no page draws the group at all.
      const item = (await indexOf(page, locale)).find((entry) => entry.kind === 'item');
      if (item !== undefined) {
        await openSearch(page, locale, `?q=${encodeURIComponent(item.name)}`);
        const labels = (await readGroups(page)).map((group) => group.label);
        expect(labels).toContain(MESSAGES[locale].search.groups.item);
      }
    });
  }
});
