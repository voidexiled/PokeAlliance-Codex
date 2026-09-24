// §8.8 acceptance (M9): the Tier list (`/{l}/pokedex/tiers/`, the route that takes over
// «Rotaciones») against the real page, over the registries the development server reads.
//
// What it measures, by the ids of the spec:
//
//  - TL1 to TL4 (§8.8). TL2 is the 302 of `/{l}/rotaciones/`, which `astro.config.mjs`
//    declares and the development server answers with its own middleware; the deployed
//    configuration is tests/e2e/links.spec.ts's, on the Vercel output.
//  - The protocol of §8.0.7: WG1 (the frame of §5.5 at 1440 and 390, no sideways scroll at
//    390), WG4 (the columns of the `pokedex` family of `CGS §4` at the five widths of
//    `DS:guias/30`; §8.8 has no board), WG5 (every internal link answers 200, or 302
//    towards a page that does, and none points at a retired route), WA1 (axe in the three
//    views, with a tooltip open and with the phone sheet open), WA2 (one h1, no
//    skipped heading level, named landmarks, a caption on every table), WA3 (`aria-pressed`
//    on every toggle and the `aria-current` of the menu and of the pagination), WA4 (the
//    rotations registry writes English only, so on `es` its text carries `lang="en"`) and
//    WD1 (the count and the number of pages are the ones the registry gives).
//  - S4 (TL4): the three views of a page show the same 48 variants, and the variants of a
//    tier keep their order in every view.
//  - U3: `?elemento=fire&variante=shiny&view=slots&page=2` means the same in `es` and in
//    `en`, because the values are registry ids and not words of a dictionary.
//  - WL1 with the rows of §12.11 (T-01 to T-05), S-24 of §12.2 and the old crumbs of B-04.
//
// The list controller itself (U1–U6, H1–H7, V1–V8, PR1–PR5) is tests/e2e/lists.spec.ts; the
// Pokédex, whose rows, filters and views this page reuses, is tests/e2e/pokedex.spec.ts.
//
// S19 with the data: every expectation below is computed from `content/` when the spec loads,
// never copied from a board (X4), so changing a test record changes the figure the spec
// expects.
//
// Runs in the `desktop` project. The 390 checks are viewport overrides of this spec, as in
// tests/e2e/frame.spec.ts, with a touch-free pointer: the touch target sizes are
// contract.spec.ts's.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import AxeBuilder from '@axe-core/playwright';
import type { Locator, Page } from '@playwright/test';

import { en } from '../../src/i18n/messages/en';
import type { Messages } from '../../src/i18n/messages/en';
import { es } from '../../src/i18n/messages/es';
import { idiomas } from '../../scripts/lib/rutas-migradas.mjs';
import { expect, test } from './fixtures';
import { RETIRED_ROUTES } from './routes';

// ------------------------------------------------------------------------------ registries

type Locale = 'es' | 'en';
type Localized = Record<Locale, string>;

interface PokemonRecord {
  id: string;
  nombre: string;
  numero: number | null;
  generacion: number | null;
  variante: string;
  nivel: number | null;
  tier: number | string | null;
  funcion: string | null;
  elementos: string[];
}

interface ElementRecord {
  id: string;
  nombre: Localized;
}

interface RotationRecord {
  id: string;
  nombre: string;
  tipo: string;
  disponibilidad: string | null;
  condicion: string | null;
  excluye: string[];
  comparacion: string[];
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(resolve(ROOT, file), 'utf8')) as T;
}

const POKEMON = readJson<{ pokemon: PokemonRecord[] }>('content/pokemon.json').pokemon;
const BY_ID = new Map(POKEMON.map((record) => [record.id, record]));
const ELEMENTS = readJson<{ elementos: ElementRecord[] }>('content/elementos.json').elementos;
const ROTATIONS = readJson<{ rotaciones: RotationRecord[] }>('content/rotations.json').rotaciones;

const MESSAGES: Record<Locale, Messages> = { es, en };
const LOCALES = idiomas as Locale[];

/** 8.0.3: the labels of the «Pokémon» group and of its «Tier list» entry, in both locales. */
const GROUP_TITLE: Localized = { es: 'Pokémon', en: 'Pokémon' };
const TITLE = 'Tier list';

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

/** `formatTier` of src/lib/content/format.ts: 3 → «T3», «Legendary» as it is. */
function tierText(tier: number | string): string {
  return typeof tier === 'number' ? `T${tier}` : tier;
}

/** The URL and group id of a tier (8.0.6, U3): 3 → `t3`, «Super Rare» → `super-rare`. */
function tierId(tier: number | string | null): string | null {
  if (tier === null) return null;
  return typeof tier === 'number' ? `t${tier}` : tier.toLowerCase().replace(/\s+/g, '-');
}

/**
 * 8.8 step 5: the special tiers in the order of `$defs.tierEspecial` of the schema — the
 * order, not a ranking — which is `SPECIAL_TIERS` of src/components/pokedex/config.ts.
 */
const SPECIAL_TIERS = ['super-rare', 'ultra-rare', 'legendary', 'mythic', 'ultimate'];

/** Where a tier goes: the numbered ones first, then the special ones, then any other. */
function tierPlace(record: PokemonRecord): [number, number, string] {
  if (typeof record.tier === 'number') return [0, record.tier, ''];
  const id = tierId(record.tier) ?? '';
  const special = SPECIAL_TIERS.indexOf(id);
  return special < 0 ? [2, 0, id] : [1, special, ''];
}

/** 8.0.5: `numero` ascending (unknown last), `normal` before `shiny`, then `nombre`. */
function pokemonOrder(locale: Locale): (a: PokemonRecord, b: PokemonRecord) => number {
  const collator = new Intl.Collator(locale);
  const rank = (record: PokemonRecord) =>
    record.variante === 'normal' ? 0 : record.variante === 'shiny' ? 1 : 2;
  return (a, b) => {
    if (a.numero !== b.numero) {
      if (a.numero === null) return 1;
      if (b.numero === null) return -1;
      return a.numero - b.numero;
    }
    return rank(a) - rank(b) || collator.compare(a.nombre, b.nombre);
  };
}

/**
 * The rows of the list (8.8 steps 4 and 5): only the variants with a tier, in tier order and,
 * inside a tier, in the order of 8.0.5.
 */
function tiersRows(locale: Locale): PokemonRecord[] {
  return [...POKEMON]
    .filter((record) => record.tier !== null)
    .sort(pokemonOrder(locale))
    .sort((a, b) => {
      const [bucketA, placeA, idA] = tierPlace(a);
      const [bucketB, placeB, idB] = tierPlace(b);
      if (bucketA !== bucketB) return bucketA - bucketB;
      if (placeA !== placeB) return placeA - placeB;
      return idA < idB ? -1 : idA > idB ? 1 : 0;
    });
}

/** 8.0.6: rows a page of the Tier list. */
const PAGE_SIZE = 48;

type TiersFilters = { gen?: string; elemento?: string; variante?: string };

/** The URL order of the filters (U1, src/components/tiers/config.ts). */
const FILTER_KEYS = ['gen', 'elemento', 'variante'] as const;

function matches(record: PokemonRecord, filters: TiersFilters): boolean {
  if (filters.gen !== undefined && record.generacion !== Number(filters.gen)) return false;
  if (filters.elemento !== undefined && !record.elementos.includes(filters.elemento)) return false;
  if (filters.variante !== undefined && record.variante !== filters.variante) return false;
  return true;
}

function query(filters: TiersFilters, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    const value = filters[key];
    if (value !== undefined) params.set(key, value);
  }
  for (const [key, value] of Object.entries(extra)) params.set(key, value);
  const text = params.toString();
  return text === '' ? '' : `?${text}`;
}

/** The rows a page of the list shows, after the filters (7.7.4: page first, group after). */
function pageRows(locale: Locale, filters: TiersFilters = {}, page = 1): PokemonRecord[] {
  const rows = tiersRows(locale).filter((record) => matches(record, filters));
  return rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
}

/** The tier groups of a page, in the order of the list; the rows of a tier are contiguous. */
function groupsOf(rows: PokemonRecord[]): { key: string; title: string; items: PokemonRecord[] }[] {
  const groups: { key: string; title: string; items: PokemonRecord[] }[] = [];
  for (const record of rows) {
    const key = tierId(record.tier) as string;
    const last = groups[groups.length - 1];
    if (last !== undefined && last.key === key) last.items.push(record);
    else groups.push({ key, title: tierText(record.tier as number | string), items: [record] });
  }
  return groups;
}

/** 8.2 step 4, reused by 8.8: the count follows Variante; `n` is the filtered total. */
function countFor(locale: Locale, n: number, variante: string | undefined): string {
  const copy = MESSAGES[locale].pokedex;
  if (variante === 'shiny') return counted(copy.countShiny, n, locale);
  if (variante === 'normal') return counted(copy.countNormal, n, locale);
  return counted(copy.count, n, locale);
}

const TIERS_PATH = (locale: Locale) => `/${locale}/pokedex/tiers/`;

// --------------------------------------------------------------------------- page helpers

/** The dev server compiles a page on its first request: the first hydration may be slow. */
const READY_TIMEOUT = 30_000;

type ViewName = 'cards' | 'slots' | 'list';

const VIEW_ATTRIBUTE: Record<ViewName, string> = {
  cards: 'data-card-grid',
  slots: 'data-slots',
  list: 'data-list',
};

/** 7.7.1: the key of the saved view of the `tiers` list (U6). */
const SAVED_VIEW = 'ac:vista:tiers';

function listRoot(page: Page): Locator {
  return page.locator('.ac-entity-list[data-ac-list="tiers"]');
}

/** The island hydrated and applied the state of the URL (PR1, PR4). */
async function listReady(page: Page, root: Locator): Promise<void> {
  await root.scrollIntoViewIfNeeded();
  await expect(page.locator('astro-island[ssr]').filter({ has: root })).toHaveCount(0, {
    timeout: READY_TIMEOUT,
  });
  await expect(root).not.toHaveAttribute('data-ac-pending', { timeout: READY_TIMEOUT });
}

async function openTiers(page: Page, locale: Locale, search = ''): Promise<Locator> {
  const path = `${TIERS_PATH(locale)}${search}`;
  const response = await page.goto(path);
  expect(response?.status(), `${path} answers 200`).toBe(200);
  const root = listRoot(page);
  await listReady(page, root);
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

/** The ids the active view shows, from the anchor `pokemon-{id}` every view writes (H7). */
async function shownIds(root: Locator, view: ViewName): Promise<string[]> {
  const selector = {
    cards: '[data-card-grid] article[id^="pokemon-"]',
    slots: '[data-slots] [id^="pokemon-"]',
    list: '[data-list] tr[id^="pokemon-"]',
  }[view];
  return root
    .locator(selector)
    .evaluateAll((nodes) => nodes.map((node) => (node.getAttribute('id') ?? '').slice(8)));
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

/** §5.5, CGS §3: x and width of the main column; §8.8 is template B without `Toc`. */
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
    // 8.8: template B without `Toc`, so the rail's place is the spacer.
    expect.soft(frame.spacer?.shown ?? false, `${label}: spacer, no Toc rail`).toBe(true);
    expect.soft(frame.rail?.shown ?? false, `${label}: no Toc (8.8)`).toBe(false);
  } else {
    expect.soft(frame.sidebar?.shown ?? false, `${label}: no sidebar below 1280`).toBe(false);
  }
  expect
    .soft(frame.scrollWidth, `${label}: documentElement.scrollWidth ≤ ${width} (WG1)`)
    .toBeLessThanOrEqual(width);
}

/** CGS §4, family `pokedex`: min card 260, 2 to 4 columns, 8 px gap below 480. */
const POKEDEX_FAMILY = { min: 260, minCols: 2, maxCols: 4, phone: 8 };

/** CGS §4: `clamp(floor((W + gap) / (min + gap)), minCols, maxCols)`. */
function expectedColumns(width: number): number {
  const { min, minCols, maxCols, phone } = POKEDEX_FAMILY;
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
      hasToc: document.querySelector('aside.ac-toc') !== null,
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
  // 8.8: the page has no `Toc`, because its groups depend on the page of the list.
  expect.soft(report.hasToc, `${label}: no Toc (8.8)`).toBe(false);
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
 * §12.11, rows BORRAR of `ROT` with their «Actual» text, plus S-24 of §12.2 (the menu entry
 * «Rotaciones» against the h1 «Rotaciones y tiers»). «Disponibilidad» goes with T-05: the text
 * is the paragraph, so the label disappears. The old crumbs of B-04 are not a text rule —
 * «Inicio» is the menu entry of the home page and a legitimate text of every page — but the
 * crumbs themselves, which `expectNoRemovedText` reads below.
 */
const REMOVED: Record<Locale, Rule[]> = {
  es: [
    'Wiki Core',
    'Rotaciones',
    'Rotaciones y tiers',
    'Explorar tiers',
    'Conjunto comparado',
    'Disponibilidad',
    'Disponibilidad:',
    /^Dónde aparece cada categoría/,
    /availability_scope/,
  ],
  en: [
    'Wiki Core',
    'Rotations',
    'Rotations and tiers',
    'Explore tiers',
    'Compared set',
    'Availability',
    'Availability:',
    /availability_scope/,
  ],
};

async function expectNoRemovedText(page: Page, locale: Locale, label: string): Promise<void> {
  const found = await harvest(page);
  expect
    .soft(
      REMOVED[locale].flatMap((rule) => hits(found, rule)),
      `${label}: no text of a BORRAR row of §12.11 (WL1)`,
    )
    .toEqual([]);
  // B-04: the crumbs are «Pokémon › Tier list», not «Inicio / Rotaciones y tiers».
  expect
    .soft(
      await page.locator('nav.ac-breadcrumb .ac-breadcrumb__item').allTextContents(),
      `${label}: the crumbs of 8.0.4 (B-04)`,
    )
    .toEqual([GROUP_TITLE[locale], TITLE]);
  // G1: the eyebrow of the old page is gone with T-01 and T-05.
  expect.soft(await page.locator('.eyebrow').count(), `${label}: 0 eyebrow (G1)`).toBe(0);
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

// ================================================================================ tests

test.describe('Tier list (8.8)', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const locale of LOCALES) {
    test(`${locale}: migas, título, filtros, barra y paginación (8.8 pasos 1 a 6, WD1)`, async ({
      page,
    }) => {
      const { ui, pokedex } = MESSAGES[locale];
      const root = await openTiers(page, locale);
      const rows = tiersRows(locale);

      // 1. «Pokémon › Tier list»: the group is text, the page is the current crumb (8.0.4).
      const crumbs = page.locator('nav.ac-breadcrumb .ac-breadcrumb__item');
      await expect(crumbs).toHaveText([GROUP_TITLE[locale], TITLE]);
      await expect(crumbs.nth(0).locator('a')).toHaveCount(0);
      await expect(crumbs.nth(1).locator('[aria-current="page"]')).toHaveText(TITLE);

      // 2. «Tier list» without a subtitle; the game term reads the same in both (T23).
      await expect(page.locator('h1')).toHaveText(TITLE);
      await expect(page.locator('.ac-page-title__sub')).toHaveCount(0);

      // 3. FilterBar: «Generación», «Elemento» and the «Variante» toggle, and no «Tier»:
      //    the groups are the tiers (8.8 step 3).
      const selects = root.locator('.ac-filter-bar [data-ac-select]');
      await expect(selects.locator('.ac-select__label')).toHaveText([
        pokedex.filters.generation,
        pokedex.filters.element,
      ]);
      await expect(selects.locator('[role="combobox"]')).toHaveText([
        (pokedex.filters as unknown as Record<string, string>).allGenerations,
        (pokedex.filters as unknown as Record<string, string>).allElements,
      ]);
      const variant = root.locator('.ac-filter-bar .ac-toggle-group');
      await expect(variant).toContainText(pokedex.filters.variant);
      await expect(variant.getByRole('button').first()).toHaveAttribute('aria-pressed', 'true');
      // No «Tier» control: the groups are the tiers (8.8 step 3). The text is matched whole,
      // because «Tierra» — the element — holds it as a substring.
      await expect(selects).toHaveCount(2);
      await expect(
        root.locator('.ac-filter-bar').getByText(pokedex.filters.tier, { exact: true }),
      ).toHaveCount(0);
      await expect(page.locator('main input, main [role="search"]')).toHaveCount(0);

      // The options of each select: the values of the rows with a tier (U4).
      const generations = [...new Set(rows.flatMap((r) => r.generacion ?? []))].sort(
        (a, b) => a - b,
      );
      await expect(selects.nth(0).locator('[role="option"]')).toHaveText([
        (pokedex.filters as unknown as Record<string, string>).allGenerations,
        ...generations.map((n) => fill(ui.cards.generation, { n: String(n) })),
      ]);
      const used = new Set(rows.flatMap((record) => record.elementos));
      await expect(selects.nth(1).locator('[role="option"]')).toHaveText([
        (pokedex.filters as unknown as Record<string, string>).allElements,
        ...ELEMENTS.filter((element) => used.has(element.id)).map(
          (element) => element.nombre[locale],
        ),
      ]);

      // 4. The count of the variants with a tier (WD1) and the view toggle, Cards pressed.
      await expect(countOf(root)).toHaveText(countFor(locale, rows.length, undefined));
      await expect(viewButton(root, locale, 'cards')).toHaveAttribute('aria-pressed', 'true');

      // 5. The first page: 48 rows in tier order.
      expect(await shownIds(root, 'cards')).toEqual(pageRows(locale).map((record) => record.id));

      // 6. Pagination, as many pages as the registry fills (WD1).
      expect(await pageCountOf(root)).toBe(Math.ceil(rows.length / PAGE_SIZE));
      await expect(root.locator('.ac-pagination__nav')).toHaveAttribute(
        'aria-label',
        ui.pagination,
      );
      await expect(root.locator('.ac-pagination [aria-current="page"]')).toHaveText('1');
    });
  }

  test('TL1: el conteo son las variantes con tier, la página 1 es solo «T1» y ninguna sin tier', async ({
    page,
  }) => {
    const rows = tiersRows('es');
    const withoutTier = POKEMON.filter((record) => record.tier === null);
    expect(rows.length, 'the registry has variants with a tier').toBeGreaterThan(PAGE_SIZE);
    const root = await openTiers(page, 'es');

    await expect(countOf(root)).toHaveText(countFor('es', rows.length, undefined));
    const groups = groupsOf(pageRows('es'));
    // The page is cut first and grouped after (7.7.4): while the first tier has more than 48
    // variants, page 1 holds that group alone.
    await expect(root.locator('[data-card-grid] .ac-card-group__head')).toHaveText(
      groups.map((group) => new RegExp(`^${group.title}`)),
    );
    for (const [index, group] of groups.entries()) {
      await expect(
        root.locator('[data-card-grid] .ac-card-group__count').nth(index),
        `${group.title}: the count of this page`,
      ).toHaveText(figure(group.items.length, 'es'));
    }
    const shown = await shownIds(root, 'cards');
    expect(shown).toEqual(pageRows('es').map((record) => record.id));
    expect(
      shown.every((id) => (BY_ID.get(id)?.tier ?? null) !== null),
      'TL1: no variant without a tier is on the page',
    ).toBe(true);
    // And none of them is in the whole list either.
    expect(rows.some((record) => withoutTier.includes(record))).toBe(false);
  });

  test('TL2: /{l}/rotaciones/ responde 302 a la Tier list', async ({ page }) => {
    for (const locale of LOCALES) {
      for (const path of [`/${locale}/rotaciones`, `/${locale}/rotaciones/`]) {
        const response = await page.request.get(path, { maxRedirects: 0 });
        expect.soft(response.status(), `${path} answers 302 (E1, 8.0.1)`).toBe(302);
        expect
          .soft(response.headers()['location'], `${path} → the Tier list`)
          .toBe(TIERS_PATH(locale));
      }
      const landed = await page.request.get(TIERS_PATH(locale));
      expect(landed.status(), `${TIERS_PATH(locale)} answers 200`).toBe(200);
    }
  });

  test('TL3: las rotaciones van después de la lista, en inglés marcado y sin el modelo de datos', async ({
    page,
  }) => {
    test.skip(ROTATIONS.length === 0, 'El registro de rotaciones está vacío (8.8 paso 7).');
    for (const locale of LOCALES) {
      const { tiers } = MESSAGES[locale];
      await openTiers(page, locale);
      const sections = page.locator('main section.ac-section');
      await expect(sections).toHaveCount(ROTATIONS.length);

      // After the list: the first section starts below the root of the island.
      const order = await page.evaluate(() => {
        const list = document.querySelector('.ac-entity-list[data-ac-list="tiers"]');
        const section = document.querySelector('main section.ac-section');
        if (list === null || section === null) return null;
        return list.compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING;
      });
      expect(order, 'TL3: the rotations come after the list').toBeTruthy();

      for (const [index, record] of ROTATIONS.entries()) {
        const section = sections.nth(index);
        await expect(section.locator('.ac-section__title')).toHaveText(record.nombre);
        if (record.disponibilidad !== null) {
          // The paragraph of the section, not the `FactLine`s, which are `p.ac-fact-line`.
          await expect(section.locator('p:not(.ac-fact-line)')).toHaveText(record.disponibilidad);
        }
        const lines: string[] = [];
        if (record.condicion !== null) lines.push(`${tiers.condition}:`);
        if (record.excluye.length > 0) lines.push(`${tiers.notFoundIn}:`);
        await expect(section.locator('.ac-fact-line__label')).toHaveText(lines);
        if (record.excluye.length > 0) {
          await expect(section.locator('.ac-fact-line').last()).toContainText(
            record.excluye.join(', '),
          );
        }
        // T-04: the section holds its title, its paragraph and its data lines and nothing
        // else — no «Conjunto comparado», no list of `comparacion` and no `tipo`, which all
        // describe the data model instead of the game. A value of `comparacion` is not
        // searched as text: `excluye` may hold the same words.
        await expect(section).not.toContainText(record.tipo);
        await expect(section.locator('ul, ol, table')).toHaveCount(0);
        // DS:FactLine: two lines stack in one `FactLines` column, a `dl` with one `div` per
        // line; a single line is a paragraph of its own.
        const grouped = lines.length > 1;
        await expect(section.locator('dl')).toHaveCount(grouped ? 1 : 0);
        if (grouped) {
          await expect(
            section.locator('dl.ac-fact-lines--column > div.ac-fact-line > dt'),
          ).toHaveText(lines);
        }
        await expect(section.locator('p')).toHaveCount(
          (record.disponibilidad === null ? 0 : 1) + (grouped ? 0 : lines.length),
        );
      }

      // T-03, WA4: on `es` the registry's English carries `lang="en"`.
      if (locale === 'es') {
        for (const record of ROTATIONS) {
          await expect(
            page.locator('[lang="en"]', { hasText: record.nombre }),
            `T-03: «${record.nombre}» is marked as English`,
          ).not.toHaveCount(0);
        }
      }
    }
  });

  test('TL4 y S4: las tres vistas muestran las mismas variantes en el mismo orden', async ({
    page,
  }) => {
    const root = await openTiers(page, 'es');
    const expected = pageRows('es').map((record) => record.id);
    const cards = await shownIds(root, 'cards');
    await chooseView(root, 'es', 'slots');
    const slots = await shownIds(root, 'slots');
    // The Slots groups are the tiers of the page, in the order of the list (8.8 step 5).
    await expect(root.locator('[data-slots] .ac-slots-panel__label')).toHaveText(
      groupsOf(pageRows('es')).map((group) => group.title),
    );
    await chooseView(root, 'es', 'list');
    const list = await shownIds(root, 'list');
    // The Lista is one table captioned with the h1 (8.8 step 5).
    await expect(root.locator('[data-list] table caption')).toHaveText(TITLE);
    await expect(root.locator('[data-list] table')).toHaveCount(1);
    await chooseView(root, 'es', 'cards');

    expect(cards, 'TL4: Cards shows the page of the list').toEqual(expected);
    expect(slots, 'TL4: Slots shows the same, in the same order').toEqual(expected);
    expect(list, 'TL4: Lista shows the same, in the same order').toEqual(expected);
    await forgetView(page);
  });

  test('U3: ?elemento=fire&variante=shiny&view=slots&page=2 sirve igual en es y en en', async ({
    page,
  }) => {
    const filters: TiersFilters = { elemento: 'fire', variante: 'shiny' };
    const search = query(filters, { view: 'slots', page: '2' });
    const rows = tiersRows('es').filter((record) => matches(record, filters));
    // U4: a page past the last one falls to the last one. While the registry does not fill
    // two pages with this filter, the URL asks for page 2 and both locales serve page 1.
    const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    const served = Math.min(2, pages);
    const seen: string[][] = [];
    for (const locale of LOCALES) {
      const root = await openTiers(page, locale, search);
      await expect(countOf(root)).toHaveText(countFor(locale, rows.length, 'shiny'));
      await expect(viewButton(root, locale, 'slots')).toHaveAttribute('aria-pressed', 'true');
      if (pages > 1) {
        await expect(root.locator('.ac-pagination [aria-current="page"]')).toHaveText(
          String(served),
        );
      } else {
        await expect(root.locator('.ac-pagination')).toHaveCount(0);
      }
      // U4: once applied, the URL takes its canonical form, with the page it serves.
      await expect
        .poll(() => new URL(page.url()).searchParams.get('page'), { timeout: READY_TIMEOUT })
        .toBe(served > 1 ? String(served) : null);
      seen.push(await shownIds(root, 'slots'));
    }
    expect(seen[0]).toEqual(pageRows('es', filters, served).map((record) => record.id));
    expect(seen[1], 'U3: the ids of the registry mean the same in both locales').toEqual(seen[0]);
    await forgetView(page);
  });

  test('Cards: un grupo por tier con títulos h2 y tarjetas h3 (8.8 paso 5, 7.6.2)', async ({
    page,
  }) => {
    const root = await openTiers(page, 'es');
    const groups = groupsOf(pageRows('es'));
    const heads = root.locator('[data-card-grid] .ac-card-group__head');
    await expect(heads).toHaveCount(groups.length);
    expect(
      await heads.evaluateAll((nodes) => nodes.map((node) => node.localName)),
      '7.6.2: the group heading is an h2',
    ).toEqual(groups.map(() => 'h2'));
    const titles = root.locator('[data-card-grid] article .ac-card__title');
    expect(
      await titles.evaluateAll((nodes) => [...new Set(nodes.map((node) => node.localName))]),
      '7.6.2: the card titles are one level below',
    ).toEqual(['h3']);
    // A card opens no tooltip (the three-view rule): only its nested entities do.
    await expect(root.locator('[data-card-grid] article > [data-ac-tt]')).toHaveCount(0);
  });

  test('Slots: grupos por tier, slots de 72 y el panel del Pokémon (8.8 paso 5)', async ({
    page,
  }) => {
    const root = await openTiers(page, 'es', '?view=slots');
    const slots = root.locator('[data-slots] .ac-entity-slot');
    await expect(slots).toHaveCount(pageRows('es').length);
    const box = await slots.first().boundingBox();
    expect(box?.width).toBeCloseTo(72, 0);
    expect(box?.height).toBeCloseTo(72, 0);

    const panel = await openTooltip(page, root.locator('[data-slots]'));
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

      test(`la Tier list en sus tres vistas a ${size.width}`, async ({ page }) => {
        for (const view of ['cards', 'slots', 'list'] as ViewName[]) {
          await openTiers(page, 'es', `?view=${view}`);
          await expectFrame(page, size.width, `/es/pokedex/tiers/?view=${view}`);
        }
        await forgetView(page);
      });
    });
  }
});

test.describe('WG4: rejillas a 1440, 1280, 1024, 768 y 390 (CGS §4)', () => {
  for (const size of [
    { width: 1440, height: 900 },
    { width: 1280, height: 900 },
    { width: 1024, height: 900 },
    { width: 768, height: 900 },
    { width: 390, height: 844 },
  ]) {
    test.describe(`${size.width} px`, () => {
      test.use({ viewport: size });

      test(`columnas de cada grupo de tier a ${size.width}`, async ({ page }) => {
        const root = await openTiers(page, 'es');
        const grids = root.locator('.ac-card-grid__grid');
        const total = await grids.count();
        expect(total, 'the page draws a grid per tier').toBeGreaterThan(0);
        for (let index = 0; index < total; index += 1) {
          const grid = await readGrid(grids.nth(index));
          expect
            .soft(Math.abs(grid.width - MAIN_COLUMN[size.width][1]), 'the grid spans the column')
            .toBeLessThanOrEqual(1);
          expect
            .soft(grid.columns, `tier ${index + 1} columns for ${grid.width}`)
            .toBe(expectedColumns(grid.width));
          expect.soft(grid.spread, `tier ${index + 1}: no ragged row (S2)`).toBe(0);
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

  test('la Tier list, con cada enlace de la paginación y de las tarjetas', async ({ page }) => {
    test.setTimeout(180_000);
    for (const search of ['', '?page=2', '?view=slots', '?view=list']) {
      await openTiers(page, 'es', search);
      await expectLinks(page, `/es/pokedex/tiers/${search}`);
    }
    await forgetView(page);
  });
});

test.describe('WA1: axe en las tres vistas, con un tooltip y con la hoja móvil', () => {
  for (const locale of LOCALES) {
    test.describe(`${locale} a 1440`, () => {
      test.use({ viewport: { width: 1440, height: 900 } });

      test(`${locale}: la Tier list con un tooltip abierto`, async ({ page }) => {
        test.setTimeout(180_000);
        for (const view of ['cards', 'slots', 'list'] as ViewName[]) {
          const root = await openTiers(page, locale, `?view=${view}`);
          const label = `${TIERS_PATH(locale)}?view=${view}`;
          await expectAxeClean(page, label);
          if ((await root.locator('[data-ac-tt] a, [data-ac-tt] button').count()) === 0) continue;
          await openTooltip(page, root);
          await expectAxeClean(page, `${label} with a tooltip open`);
          await page.keyboard.press('Escape');
        }
        await forgetView(page);
      });
    });

    test.describe(`${locale} a 390`, () => {
      test.use({ viewport: { width: 390, height: 844 } });

      test(`${locale}: la Tier list con la hoja móvil abierta`, async ({ page }) => {
        await page.goto(TIERS_PATH(locale));
        const trigger = page.locator('[aria-controls="menu-movil"]').first();
        await trigger.click();
        await expect(page.locator('dialog#menu-movil')).toBeVisible();
        await expectAxeClean(page, `${TIERS_PATH(locale)} with the phone sheet open`);
        await page.keyboard.press('Escape');
        await expect(page.locator('dialog#menu-movil')).toBeHidden();
      });
    });
  }
});

test.describe('WA2, WA3 y WA4: estructura, estado de los controles e idioma', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const locale of LOCALES) {
    test(`${locale}: la Tier list en sus tres vistas`, async ({ page }) => {
      test.setTimeout(120_000);
      for (const view of ['cards', 'slots', 'list'] as ViewName[]) {
        const root = await openTiers(page, locale, `?view=${view}`);
        await expectStructure(page, locale, `${TIERS_PATH(locale)}?view=${view}`);
        // WA3: the menu entry of the route and the current page of the pagination. The entry
        // is the one of its group: the pinned «Destacados» may link the page too (E10, M10).
        await expect(
          page.locator(`.ac-page-layout__sidebar details a[href="${TIERS_PATH(locale)}"]`),
        ).toHaveAttribute('aria-current', 'page');
        await expect(root.locator('.ac-pagination [aria-current="page"]')).toHaveCount(1);
      }
      await forgetView(page);
    });
  }
});

test.describe('WL1: sin relleno (§12.11, §12.2, §12.22)', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const locale of LOCALES) {
    test(`${locale}: la Tier list en sus vistas`, async ({ page }) => {
      const { pokedex, ui, tiers } = MESSAGES[locale];
      for (const search of ['', '?view=slots', '?view=list']) {
        await openTiers(page, locale, search);
        await expectNoRemovedText(page, locale, `${TIERS_PATH(locale)}${search}`);
      }

      // The final texts of the REESCRIBIR rows (T-05) and of the controls.
      await openTiers(page, locale);
      const found = await harvest(page);
      const texts = new Set(found.texts);
      for (const text of [
        TITLE,
        pokedex.filters.generation,
        pokedex.filters.element,
        pokedex.filters.variant,
        ui.views.cards,
      ]) {
        expect.soft(texts.has(text), `WL1: «${text}» is on ${TIERS_PATH(locale)}`).toBe(true);
      }
      if (ROTATIONS.some((record) => record.condicion !== null)) {
        expect.soft(texts.has(`${tiers.condition}:`), 'T-05: «Condición:»').toBe(true);
      }
      if (ROTATIONS.some((record) => record.excluye.length > 0)) {
        expect.soft(texts.has(`${tiers.notFoundIn}:`), 'T-05: «No aparece en:»').toBe(true);
      }
      await forgetView(page);
    });
  }
});

test.describe('Índice de búsqueda: la Tier list en el grupo Páginas (8.6, BU6)', () => {
  interface Entry {
    kind: string;
    id: string;
    name: string;
    href: string;
  }

  for (const locale of LOCALES) {
    test(`${locale}: «Tier list» es una página del índice y responde`, async ({ page }) => {
      const response = await page.request.get(`/${locale}/buscar/indice.json`);
      expect(response.status()).toBe(200);
      const entries = (await response.json()) as Entry[];
      const pages = entries.filter((entry) => entry.kind === 'pagina');
      const tiers = pages.find((entry) => entry.href === TIERS_PATH(locale));
      expect(tiers, `${locale}: the Tier list is in the index (8.6)`).toBeDefined();
      expect(tiers?.name).toBe(TITLE);
      // 8.6: it comes right after the Pokédex, the order of the table of that section.
      const order = pages.map((entry) => entry.href);
      expect(order.indexOf(TIERS_PATH(locale))).toBe(order.indexOf(`/${locale}/pokedex/`) + 1);
      const status = (await page.request.get(TIERS_PATH(locale))).status();
      expect(status, `BU6: ${TIERS_PATH(locale)}`).toBe(200);
    });
  }
});
