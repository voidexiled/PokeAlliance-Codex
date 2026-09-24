// §8.1 acceptance (M10): Inicio — `/{l}/`, `Lienzo:Main` at 1440 and `Lienzo:Inicio-movil` at
// 390 — against the real page, over the registries the development server reads.
//
// What it measures, by the ids of the spec:
//
//  - The five steps of §8.1 with the data of `content/` (WD1, PZ-06): the h1 and the line of
//    HomeIntro with `{n}` = the Pokémon of the registry and `{lista}` = the collections with a
//    published record (X12), the `home` trigger, Destacados from content/destacados.json, the
//    bento of IndexPanel + WorldsTable with each count equal to the links the panel draws and
//    the words of the dictionary for the screen reader; the document title of S-01 and the
//    description of §13.5.
//  - IN1 to IN4. IN2 («con 3 entradas hay 3 FeaturedCard y una celda vacía») is measured with
//    the entries the registry has and, when it has 4, with the fourth card taken out of the
//    grid in the page: what IN2 checks is the grid's CSS, which keeps its 4 columns and never
//    stretches a card. IN3 follows the activities whose page the build writes (none until M11).
//  - PZ-05 / X3: the Worlds table has the «Mundo» column alone, no sort button, no island, and
//    the names in numeric order.
//  - v1 point 9 / A3: no search in the header of Inicio, and never two `role="search"`.
//  - The protocol of §8.0.7: WG1 (the frame of §5.5 at 1440 and 390, no sideways scroll at
//    390), WG2 (the numbers §8.1 gives for Main and Inicio-movil, computed here from the
//    registries with the measures of DS:IndexPanel, DS:WorldsTable and CGS §6.4-6.5), WG5,
//    WA1 (axe at 1440 and 390, with a panel open and with the phone sheet open), WA2, WA3 (the
//    `aria-current` of «Inicio» and the Tab order of S13), WA4 and WL1 (H-01 to H-11 of §12.4).
//  - The pinned «Destacados» group of the menu (8.0.3, 7.10.2), which src/lib/nav/groups.ts
//    fills from the same registry: its entries in the order of the file, each with its sprite
//    of 16 that bounces — the Diamond at half, on frame 0 — and the mark of E10 on the entry of
//    the page's own group, never on the pinned copy of it.
//
// WG3 (the image against the boards, with the masks DV1 and DV6) is the `main` and
// `inicio-movil` cases of tests/visual/manifest.json. The bento is WG2 here and the component
// tests of §7 (8.1, «Aceptación»).
//
// S19: every expectation below is computed from `content/` when the spec loads, never copied
// from a board (X4), so a change of a test record changes the figure the spec expects. Run
// with `OCULTAR_BORRADORES=1` and no server on 4321 — Playwright passes its environment to the
// server it starts — and the drafts leave the line, the panels, Destacados and the menu:
//
//   OCULTAR_BORRADORES=1 pnpm exec playwright test --project=desktop tests/e2e/home.spec.ts
//
// Runs in the `desktop` project. The 390 checks are viewport overrides of this spec, as in
// tests/e2e/items.spec.ts, with a touch-free pointer: the touch target sizes are
// contract.spec.ts's.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import AxeBuilder from '@axe-core/playwright';
import type { Locator, Page } from '@playwright/test';

import { en } from '../../src/i18n/messages/en';
import type { Messages } from '../../src/i18n/messages/en';
import { es } from '../../src/i18n/messages/es';
import { esRutaDelSitio, idiomas } from '../../scripts/lib/rutas-migradas.mjs';
import { expect, test } from './fixtures';
import { RETIRED_ROUTES } from './routes';

// ------------------------------------------------------------------------------ registries

type Locale = 'es' | 'en';
type Localized = Record<Locale, string>;

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(resolve(ROOT, file), 'utf8')) as T;
}

/** A JSON of `content/` that §3.13 allows to be missing (destacados, mundos). */
function readOptional<T>(file: string): T | null {
  return existsSync(resolve(ROOT, file)) ? readJson<T>(file) : null;
}

/** `hideDrafts` of src/lib/content/registry.ts, read from the environment of this run. */
const HIDE_DRAFTS = /^(?:1|true)$/i.test(process.env.OCULTAR_BORRADORES ?? '');

function published<T extends { borrador?: boolean }>(records: T[]): T[] {
  return HIDE_DRAFTS ? records.filter((record) => record.borrador !== true) : records;
}

interface SistemaRecord {
  id: string;
  orden: number;
  titulo: Localized;
  tooltip?: unknown[];
  borrador?: boolean;
}

interface CategoryRecord {
  id: string;
  nombre: Localized;
  orden: number;
  virtual?: boolean;
}

interface ItemRecord {
  id: string;
  borrador?: boolean;
}

interface ElementRecord {
  id: string;
  nombre: Localized;
}

interface QuestRecord {
  id: string;
  nombre: string;
}

interface DestacadoRecord {
  etiqueta: Localized;
  ruta: string;
  sprite: string | null;
  borrador?: boolean;
}

interface MundoRecord {
  id: string;
  nombre: string;
}

interface SpriteEntry {
  frame: [number, number];
  frames: number;
  modo: string;
}

const POKEMON = readJson<{ pokemon: { id: string }[] }>('content/pokemon.json').pokemon;

/** §8.4: the system pages in `orden`, ties by `id` (src/lib/content/registry.ts). */
const SISTEMAS = published(
  readdirSync(resolve(ROOT, 'content/sistemas'))
    .filter((file) => file.endsWith('.json'))
    .map((file) => readJson<SistemaRecord>(`content/sistemas/${file}`)),
).sort((a, b) => a.orden - b.orden || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

/** The 14 Market categories, «Todo» first (8.5). */
const CATEGORIES = readJson<{ categorias: CategoryRecord[] }>('content/items/categorias.json')
  .categorias.slice()
  .sort((a, b) => a.orden - b.orden);

/** Every item of the Market this build keeps: «ítems» joins the line with one of them. */
const ITEMS = published(
  CATEGORIES.filter((category) => category.virtual !== true).flatMap((category) => {
    const file = `content/items/${category.id}.json`;
    return existsSync(resolve(ROOT, file)) ? readJson<{ items: ItemRecord[] }>(file).items : [];
  }),
);

/** The 18 elements, in the order of 8.0.5. */
const ELEMENTS = readJson<{ elementos: ElementRecord[] }>('content/elementos.json').elementos;

const QUESTS = readJson<{ misiones: QuestRecord[] }>('content/quests.json').misiones;

const DESTACADOS = published(
  readOptional<{ destacados: DestacadoRecord[] }>('content/destacados.json')?.destacados ?? [],
);

const MUNDOS = readOptional<{ mundos: MundoRecord[] }>('content/mundos.json')?.mundos ?? [];

const SPRITES = readJson<{ sprites: Record<string, SpriteEntry> }>(
  'public/sprites/sprites.json',
).sprites;

const MESSAGES: Record<Locale, Messages> = { es, en };
const LOCALES = idiomas as Locale[];

/**
 * 8.1 step 4: an activity is in the panel when the build writes its page (8.9.2), which the
 * route inventory knows (WG5).
 */
function activitiesOf(locale: Locale): QuestRecord[] {
  return QUESTS.filter((quest) => esRutaDelSitio(`/${locale}/actividades/${quest.id}/`));
}

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

/** The plural form of a dictionary leaf for `n` (§13.2). */
function pick(leaf: Leaf, n: number, locale: Locale): string {
  if (typeof leaf === 'string') return leaf;
  return new Intl.PluralRules(NUMBER_LOCALE[locale]).select(n) === 'one' ? leaf.one : leaf.other;
}

/**
 * 8.1 step 1 (X12): «{n} variantes de Pokémon, {lista} de PokeAlliance.», where `{lista}`
 * names, in this order, «ítems», «sistemas» and «actividades» when their registry has a
 * published record, with «y» / «and» before the last; with none of them, `introBare`.
 */
function introLine(locale: Locale): string {
  const home = MESSAGES[locale].home;
  const words = [
    ITEMS.length > 0 ? home.collections.items : null,
    SISTEMAS.length > 0 ? home.collections.systems : null,
    activitiesOf(locale).length > 0 ? home.collections.activities : null,
  ].filter((word): word is string => word !== null);
  const n = figure(POKEMON.length, locale);
  if (words.length === 0) return fill(home.introBare, { n });
  const last = words[words.length - 1];
  const list = words.length === 1 ? last : `${words.slice(0, -1).join(', ')} ${home.and} ${last}`;
  return fill(home.intro, { n, list });
}

/** One link of a panel as §8.1 step 4 builds it from its registry. */
interface PanelLink {
  label: string;
  href: string;
}

type Area = 'sistemas' | 'items' | 'actividades' | 'pokedex' | 'mundos';

/** The DOM order of the bento: the order of one column (8.1 step 4, E17). */
const DOM_ORDER: Area[] = ['sistemas', 'items', 'actividades', 'pokedex', 'mundos'];

function panelLinks(area: Exclude<Area, 'mundos'>, locale: Locale): PanelLink[] {
  switch (area) {
    case 'sistemas':
      return SISTEMAS.map((sistema) => ({
        label: sistema.titulo[locale],
        href: `/${locale}/sistemas/${sistema.id}/`,
      }));
    case 'items':
      return CATEGORIES.map((category) => ({
        label: category.nombre[locale],
        href:
          category.virtual === true ? `/${locale}/items/` : `/${locale}/items/c/${category.id}/`,
      }));
    case 'actividades':
      return activitiesOf(locale).map((quest) => ({
        label: quest.nombre,
        href: `/${locale}/actividades/${quest.id}/`,
      }));
    case 'pokedex':
      return ELEMENTS.map((element) => ({
        label: element.nombre[locale],
        href: `/${locale}/pokedex/?elemento=${element.id}`,
      }));
  }
}

/** The areas the page renders: a panel with no link, or no world, has none (8.1 step 4). */
function presentAreas(locale: Locale): Area[] {
  return DOM_ORDER.filter((area) =>
    area === 'mundos' ? MUNDOS.length > 0 : panelLinks(area, locale).length > 0,
  );
}

/** 8.1 step 4 and CGS §6.5: the templates of areas with every panel present. */
const TEMPLATES: Record<2 | 3, Area[][]> = {
  3: [
    ['sistemas', 'items', 'mundos'],
    ['actividades', 'pokedex', 'pokedex'],
  ],
  2: [
    ['sistemas', 'items'],
    ['actividades', 'mundos'],
    ['pokedex', 'pokedex'],
  ],
};

/**
 * The cells of a template for the panels present: an absent one leaves an empty cell and the
 * others keep theirs; a row with no panel left goes away (8.1 step 4).
 */
function templateFor(columns: 2 | 3, present: readonly Area[]): (Area | null)[][] {
  return TEMPLATES[columns]
    .map((row) => row.map((area) => (present.includes(area) ? area : null)))
    .filter((row) => row.some((cell) => cell !== null));
}

/** The reading order of a template: row by row, left to right, each area once. */
function readingOrder(template: (Area | null)[][]): Area[] {
  const order: Area[] = [];
  for (const row of template) {
    for (const cell of row) if (cell !== null && !order.includes(cell)) order.push(cell);
  }
  return order;
}

/** Names of the worlds in the numeric order of §3.13, as `WorldsTable` sorts them (X3). */
function worldNames(locale: Locale): string[] {
  const collator = new Intl.Collator(locale, { numeric: true });
  return MUNDOS.map((world) => world.nombre).sort((a, b) => collator.compare(a, b));
}

// ------------------------------------------------------------------ measures of the design

/**
 * DS:IndexPanel and 8.1 WG2: strip of 44, its border of 1, the 8 + 8 of padding of the link
 * grid, rows of 40 (44 below 48rem) two apart, and the 1 + 1 of the section's border. Two
 * link columns per bento column: the Pokédex panel spans two and has four from 596 px.
 */
function panelHeight(links: number, columns: number, row: number): number {
  const rows = Math.ceil(links / columns);
  return 44 + 1 + 16 + rows * row + (rows - 1) * 2 + 2;
}

/** DS:WorldsTable at 390: a header of 45, rows of 44 and the 1 + 1 of the border. */
function worldsHeight(rows: number): number {
  return 45 + rows * 44 + 2;
}

/** DS:FeaturedCard: 12 + 36 + 12 and the 1 + 1 of the border; 8 between cards (CGS §6.4). */
const FEATURED_CARD = 62;
const FEATURED_GAP = 8;

/** §5.5: x and width of the main column; Inicio is template A, the 208 spacer at 1440. */
const MAIN_COLUMN: Record<number, [number, number]> = {
  1440: [248, 944],
  1280: [248, 784],
  1024: [16, 992],
  768: [16, 736],
  390: [16, 358],
};

/** DS:PageLayout `rhythm="home"`: 24 between the blocks from 1280, 16 below. */
function rhythm(width: number): number {
  return width >= 1280 ? 24 : 16;
}

/** The trigger of the width: `home` from 768 (with its keycap), `mobile` below (8.1). */
function triggerOf(page: Page, width: number): Locator {
  const slot = width >= 768 ? '.ac-home-search--wide' : '.ac-home-search--narrow';
  return page.locator(`${slot} .ac-search-trigger`);
}

// --------------------------------------------------------------------------- page helpers

function homePath(locale: Locale): string {
  return `/${locale}/`;
}

async function openHome(page: Page, locale: Locale): Promise<void> {
  const response = await page.goto(homePath(locale));
  expect(response?.status(), `${homePath(locale)} answers 200`).toBe(200);
}

/** The palette island mounted: the shortcut and the triggers reach it (7.9.1, C7-11). */
async function paletteReady(page: Page): Promise<void> {
  await expect(page.locator('html[data-ac-search="ready"]')).toHaveCount(1, { timeout: 30_000 });
}

function bento(page: Page): Locator {
  return page.locator('.ac-home-bento__grid');
}

function panel(page: Page, area: Area): Locator {
  return bento(page).locator(`:scope > [data-area="${area}"]`);
}

type Box = { x: number; y: number; w: number; h: number };

async function boxOf(locator: Locator): Promise<Box> {
  const box = await locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      x: rect.x + window.scrollX,
      y: rect.y + window.scrollY,
      w: rect.width,
      h: rect.height,
    };
  });
  return box;
}

/** A box to ±1 px (§14.5 step 1, WG2). */
function expectBox(found: Box, expected: Partial<Box>, label: string): void {
  for (const key of ['x', 'y', 'w', 'h'] as const) {
    const wanted = expected[key];
    if (wanted === undefined) continue;
    expect
      .soft(Math.abs(found[key] - wanted), `${label}: ${key} is ${found[key]}, not ${wanted} ± 1`)
      .toBeLessThanOrEqual(1);
  }
}

/** The number of column tracks of a grid, as the geometry step of §14.5 reads it. */
async function columnsOf(grid: Locator): Promise<number> {
  return grid.evaluate(
    (element) =>
      getComputedStyle(element)
        .gridTemplateColumns.replace(/\[[^\]]*\]/g, ' ')
        .trim()
        .split(/\s+/)
        .filter(Boolean).length,
  );
}

/**
 * Every child of the bento with its area, its box in the coordinates of the document and what
 * could place it besides its area.
 */
async function readBento(page: Page) {
  return bento(page).evaluate((grid) =>
    [...grid.children].map((child) => {
      const rect = child.getBoundingClientRect();
      const style = getComputedStyle(child);
      return {
        area: child.getAttribute('data-area'),
        x: rect.x + window.scrollX,
        y: rect.y + window.scrollY,
        w: rect.width,
        h: rect.height,
        order: style.order,
        inline: child.getAttribute('style') ?? '',
      };
    }),
  );
}

// -------------------------------------------------------------------------- frame (WG1)

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
      rail: box('.ac-page-layout__rail'),
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
    // Template A: `rail="spacer"` (8.0.2).
    expect.soft(frame.spacer?.shown ?? false, `${label}: spacer, no Toc rail`).toBe(true);
    expect.soft(frame.rail?.shown ?? false, `${label}: no rail`).toBe(false);
  } else {
    expect.soft(frame.sidebar?.shown ?? false, `${label}: no sidebar below 1280`).toBe(false);
  }
  expect
    .soft(frame.scrollWidth, `${label}: documentElement.scrollWidth ≤ ${width} (WG1)`)
    .toBeLessThanOrEqual(width);
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

/** Opens the panel of the first link of a system with tooltip rows, by hovering it (7.5.4). */
async function openPanelTooltip(page: Page): Promise<boolean> {
  const trigger = panel(page, 'sistemas').locator('[data-ac-tt] a').first();
  if ((await trigger.count()) === 0) return false;
  await page.mouse.move(0, 0);
  await trigger.hover();
  const open = page.locator('[role="tooltip"][data-open]').first();
  await expect(open).toBeVisible();
  // The 150 ms entry of the panel (6.2): axe reads a fading panel at partial opacity.
  await open.evaluate((element) =>
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
      h1: document.querySelectorAll('h1').length,
      skips,
      mainId: main?.id ?? null,
      skipHref: skip?.getAttribute('href') ?? null,
      breadcrumbs: document.querySelectorAll('nav.ac-breadcrumb').length,
      menu: document.querySelector('.ac-page-layout__sidebar nav')?.getAttribute('aria-label'),
      captionless: [...document.querySelectorAll('main table')].filter(
        (table) => (table.querySelector(':scope > caption')?.textContent ?? '').trim() === '',
      ).length,
      unnamedSections: [...document.querySelectorAll('main section')].filter(
        (section) =>
          !section.hasAttribute('aria-labelledby') ||
          document.getElementById(section.getAttribute('aria-labelledby') ?? '') === null,
      ).length,
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
  // E4, 8.0.4: Inicio belongs to no group of the menu and carries no crumbs.
  expect.soft(report.breadcrumbs, `${label}: no breadcrumb (E4)`).toBe(0);
  expect.soft(report.menu, `${label}: the menu landmark is named (WA2)`).toBe(shell.navLabel);
  expect.soft(report.captionless, `${label}: every table has a caption (WA2)`).toBe(0);
  expect.soft(report.unnamedSections, `${label}: every section is named by its heading`).toBe(0);
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

async function harvest(page: Page, scope = 'body'): Promise<Harvest> {
  return page.evaluate((selector) => {
    const root = document.querySelector(selector) ?? document.body;
    const texts: string[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      const parent = node.parentElement;
      if (parent === null || parent.closest('script, style, template') !== null) continue;
      const text = (node.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (text !== '') texts.push(text);
    }
    const attributes: { name: string; value: string }[] = [];
    for (const element of root.querySelectorAll('*')) {
      for (const name of ['aria-label', 'alt', 'title', 'placeholder']) {
        const value = element.getAttribute(name);
        if (value !== null) attributes.push({ name, value: value.trim() });
      }
    }
    return { texts, attributes };
  }, scope);
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
 * §12.4, H-01 to H-11: the «Actual» of every row BORRAR or REESCRIBIR, as the home page of
 * 2026-09-19 wrote it in each locale. H-01 and H-02 are the document title and the description,
 * checked apart; H-09 and H-10 are lucide icons, which the S7 check below counts.
 */
const REMOVED: Record<Locale, Rule[]> = {
  es: [
    'Encuentra lo que necesitas para jugar.',
    'Buscar Pokémon, items, misiones o sistemas',
    'Explorar Pokédex',
    'Pokédex de PokeAlliance',
    /^Ver todos los Pokémon/,
    'Explorar la wiki',
    'Especies, variantes y tipos',
    'Pisos, coordenadas y marcadores',
    'Misiones y ubicaciones',
    'Comparar Pokémon y gestionar tu guild',
    'Server Save',
    'Hora canónica convertida a tu zona',
    /^Tu fecha local/,
    /America\/Sao_Paulo/,
    'Temporal',
  ],
  en: [
    'Find what you need to play.',
    'Search Pokémon, items, quests or systems',
    'Explore Pokédex',
    'PokeAlliance Pokédex',
    /^View all Pokémon/,
    'Explore the wiki',
    'Species, variants and types',
    'Floors, coordinates and markers',
    'Quests and locations',
    'Compare Pokémon and manage your guild',
    'Server Save',
    'Canonical time converted to your zone',
    /^Your local date/,
    /America\/Sao_Paulo/,
    'Temporal',
  ],
};

/** §12.22: what a page could write by itself, in both locales. */
const FORBIDDEN: Rule[] = [
  /\bKKs?\b/,
  /\bgold\b/,
  /[↗✦]/,
  /\b\d+\s?px\b/,
  /^(undefined|NaN|\[object Object\]|Invalid Date)$/,
  /Próximamente|Coming soon|Wiki Core|Borrador local|Local draft|Ctrl K\b/,
];

// ================================================================================ tests

test.describe('Inicio (8.1)', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const locale of LOCALES) {
    test(`${locale}: HomeIntro, buscador, Destacados y bento con los datos del registro (8.1, WD1)`, async ({
      page,
    }) => {
      const { home, shell } = MESSAGES[locale];
      await openHome(page, locale);

      // S-01 and §13.5: the document title of Inicio and its description.
      await expect(page).toHaveTitle(home.documentTitle);
      await expect(page.locator('meta[name="description"]')).toHaveAttribute(
        'content',
        home.description,
      );

      // 1. HomeIntro: the h1 and the line of figures of the registries (X12, PZ-06). The box of
      // the sprite is `aria-hidden`, and empty while the registry has no `ui/inicio` (3.13).
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('.ac-home-intro h1.ac-home-intro__title')).toHaveText(home.title);
      await expect(page.locator('.ac-home-intro__description')).toHaveText(introLine(locale));
      const box = page.locator('.ac-home-intro__sprite');
      await expect(box).toHaveAttribute('aria-hidden', 'true');
      await expect(box.locator('img')).toHaveCount(Object.hasOwn(SPRITES, 'ui/inicio') ? 1 : 0);

      // 2. The `home` trigger, with the keycap, and the `mobile` one hidden at this width.
      const trigger = triggerOf(page, 1440);
      await expect(trigger).toBeVisible();
      await expect(trigger.locator('.ac-search-trigger__text')).toHaveText(shell.searchHome);
      await expect(trigger.locator('kbd')).toHaveText(shell.shortcut);
      await expect(triggerOf(page, 390)).toBeHidden();

      // 3. Destacados: one card per entry of the registry, in its order.
      const featured = page.locator('main section.ac-featured-section');
      if (DESTACADOS.length === 0) {
        await expect(featured, '8.1 «Estados»: no entry, no Destacados').toHaveCount(0);
      } else {
        await expect(featured.locator('h2')).toHaveText(home.featured);
        const cards = featured.locator('a.ac-featured-card');
        await expect(cards.locator('.ac-featured-card__label')).toHaveText(
          DESTACADOS.map((entry) => entry.etiqueta[locale]),
        );
        const hrefs = await cards.evaluateAll((links) =>
          links.map((link) => link.getAttribute('href')),
        );
        expect(hrefs).toEqual(DESTACADOS.map((entry) => `/${locale}${entry.ruta}`));
      }

      // 4. The bento, in the order of one column, each panel with its links and its count.
      const areas = presentAreas(locale);
      const dom = await bento(page).evaluate((grid) =>
        [...grid.children].map((child) => child.getAttribute('data-area')),
      );
      expect(dom, '8.1 step 4: the DOM keeps the order of one column').toEqual(areas);

      const titles: Record<Exclude<Area, 'mundos'>, string> = {
        sistemas: home.panels.systems,
        items: home.panels.items,
        actividades: home.panels.activities,
        pokedex: home.panels.pokedex,
      };
      for (const area of ['sistemas', 'items', 'actividades', 'pokedex'] as const) {
        const links = panelLinks(area, locale);
        const section = panel(page, area);
        if (links.length === 0) {
          await expect(section, `8.1 step 4: ${area} with no link is not drawn`).toHaveCount(0);
          continue;
        }
        await expect(section.locator('h2.ac-index-panel__title')).toHaveText(titles[area]);
        // WD1, PZ-04: the count is the number of links, with the word for a screen reader.
        const word = pick(
          area === 'pokedex' ? home.elementCount : home.pageCount,
          links.length,
          locale,
        );
        await expect(section.locator('.ac-index-panel__count')).toHaveText(
          `${figure(links.length, locale)} ${word.trim()}`,
        );
        await expect(section.locator('.ac-index-panel__count .sr-only')).toHaveText(word.trim());
        const drawn = section.locator('a.ac-index-panel__link');
        await expect(drawn.locator('.ac-index-panel__label')).toHaveText(
          links.map((link) => link.label),
        );
        const hrefs = await drawn.evaluateAll((anchors) =>
          anchors.map((anchor) => anchor.getAttribute('href')),
        );
        expect(hrefs, `${area}: the routes of its registry`).toEqual(
          links.map((link) => link.href),
        );
      }

      // A system with tooltip rows opens its panel (8.1 step 4, `systemTip`); the others are
      // plain links (R2).
      for (const [index, sistema] of SISTEMAS.entries()) {
        const item = panel(page, 'sistemas').locator('.ac-index-panel__item').nth(index);
        const rows = Array.isArray(sistema.tooltip) ? sistema.tooltip.length : 0;
        await expect(
          item.locator('[data-ac-tt]'),
          `${sistema.id}: panel when it has rows`,
        ).toHaveCount(rows > 0 ? 1 : 0);
      }
    });

    test(`${locale}: la tabla de Mundos lleva solo «Mundo», sin orden ni isla (PZ-05, X3)`, async ({
      page,
    }) => {
      test.skip(MUNDOS.length === 0, 'Sin content/mundos.json no hay tabla (8.1 «Estados»).');
      const { home } = MESSAGES[locale];
      await openHome(page, locale);
      const table = panel(page, 'mundos');
      await expect(table).toHaveCount(1);
      await expect(table).toHaveClass(/ac-worlds-table/);

      // The hidden h2 «Mundos» names the section, and the table has its caption (WA2).
      await expect(table.locator('h2.sr-only')).toHaveText(home.worlds);
      await expect(table.locator('caption')).toHaveText(home.worlds);

      // X3: one column, «Mundo», and nothing to press or sort.
      await expect(table.locator('thead th')).toHaveCount(1);
      await expect(table.locator('thead th')).toHaveText(home.world);
      await expect(table.locator('thead th')).toHaveAttribute('scope', 'col');
      await expect(table.locator('button, [aria-sort], a[href], [tabindex]')).toHaveCount(0);
      expect(
        await table.evaluate((element) => element.closest('astro-island') === null),
        'X3: the table is no island',
      ).toBe(true);

      // §3.13: the names in numeric order, «Titan 2» before «Titan 10».
      await expect(table.locator('tbody tr')).toHaveCount(MUNDOS.length);
      await expect(table.locator('tbody td')).toHaveText(worldNames(locale));
    });
  }

  test('IN1: Ctrl + K y Cmd + K abren la paleta con el foco en su campo; Escape devuelve el foco al disparador', async ({
    page,
  }) => {
    await openHome(page, 'es');
    await paletteReady(page);
    const trigger = triggerOf(page, 1440);
    const palette = page.locator('dialog#buscar-dialogo');
    const field = palette.locator('#buscar-campo');

    for (const shortcut of ['Control+k', 'Meta+k']) {
      await trigger.focus();
      await page.keyboard.press(shortcut);
      await expect(palette, `${shortcut} opens the palette`).toBeVisible();
      await expect(field, `${shortcut}: the focus is in the field`).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(palette, 'Escape closes it').toBeHidden();
      await expect(trigger, 'the focus goes back to the trigger').toBeFocused();
    }

    // The trigger itself, with the pointer.
    await trigger.click();
    await expect(palette).toBeVisible();
    await expect(field).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(palette).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('IN2: la rejilla de Destacados conserva sus 4 columnas y deja vacía la celda que falta', async ({
    page,
  }) => {
    test.skip(DESTACADOS.length === 0, 'Sin destacados no hay rejilla (8.1 «Estados»).');
    await openHome(page, 'es');
    const grid = page.locator('main .ac-featured-section__grid');
    const [x, width] = MAIN_COLUMN[1440];
    const card = (width - 3 * FEATURED_GAP) / 4;

    await expect(grid.locator(':scope > li')).toHaveCount(DESTACADOS.length);
    expect(await columnsOf(grid), 'CGS §6.4: 4 columns at 944').toBe(4);
    const expectCards = async (count: number, label: string) => {
      for (let index = 0; index < count; index += 1) {
        const found = await boxOf(grid.locator(':scope > li').nth(index));
        expectBox(
          found,
          { x: x + index * (card + FEATURED_GAP), w: card, h: FEATURED_CARD },
          `${label}, card ${index + 1}`,
        );
      }
    };
    await expectCards(DESTACADOS.length, `${DESTACADOS.length} entries`);

    // With one entry fewer, the grid keeps its 4 columns and the last cell of the row stays
    // empty: no card grows into it (CGS §4, IN2).
    if (DESTACADOS.length > 1) {
      await grid.evaluate((element) => element.lastElementChild?.remove());
      expect(await columnsOf(grid), 'still 4 columns').toBe(4);
      await expectCards(DESTACADOS.length - 1, `${DESTACADOS.length - 1} entries`);
      const last = await boxOf(grid.locator(':scope > li').last());
      expect(last.x + last.w, 'an empty cell closes the row').toBeLessThan(x + width - card);
    }
  });

  for (const locale of LOCALES) {
    test(`${locale}: IN3 — el panel Actividades existe solo con actividades publicadas`, async ({
      page,
    }) => {
      const { home } = MESSAGES[locale];
      await openHome(page, locale);
      const activities = activitiesOf(locale);
      const heading = page.locator('main h2', { hasText: home.panels.activities });
      if (activities.length === 0) {
        await expect(panel(page, 'actividades'), 'IN3: no panel').toHaveCount(0);
        await expect(heading, 'IN3: no h2 «Actividades»').toHaveCount(0);
      } else {
        await expect(panel(page, 'actividades').locator('a.ac-index-panel__link')).toHaveCount(
          activities.length,
        );
      }
    });
  }
});

test.describe('IN4: el orden visual del bento a 1440, 1280 y 390 (E17, CGS §6.5)', () => {
  for (const size of [
    { width: 1440, height: 900, columns: 3 as const },
    { width: 1280, height: 900, columns: 2 as const },
    { width: 390, height: 844, columns: 1 as const },
  ]) {
    test.describe(`${size.width} px`, () => {
      test.use({ viewport: { width: size.width, height: size.height } });

      test(`${size.columns} columnas, Mundos en su área y el DOM de una columna`, async ({
        page,
      }) => {
        await openHome(page, 'es');
        const areas = presentAreas('es');
        expect(await columnsOf(bento(page)), `${size.width}: bento columns`).toBe(size.columns);

        const children = await readBento(page);
        expect(
          children.map((child) => child.area),
          'the DOM order of one column',
        ).toEqual(areas);
        for (const child of children) {
          // IN4: the areas place the panels; no `order` and no inline position (E17, R4).
          expect.soft(child.order, `${child.area}: order`).toBe('0');
          expect
            .soft(child.inline, `${child.area}: no inline grid placement`)
            .not.toMatch(/grid-(?:row|column|area)|order/);
        }

        const visual = [...children]
          .sort((a, b) => (Math.abs(a.y - b.y) > 1 ? a.y - b.y : a.x - b.x))
          .map((child) => child.area);
        const expected =
          size.columns === 1 ? areas : readingOrder(templateFor(size.columns, areas));
        expect(visual, `${size.width}: the visual order of CGS §6.5`).toEqual(expected);

        // Every panel sits in the cell its area names: its column and its span.
        if (size.columns > 1) {
          const template = templateFor(size.columns as 2 | 3, areas);
          const grid = await boxOf(bento(page));
          const gap = 16;
          const track = (grid.w - gap * (size.columns - 1)) / size.columns;
          for (const child of children) {
            const row = template.find((cells) => cells.includes(child.area as Area)) ?? [];
            const first = row.indexOf(child.area as Area);
            const span = row.filter((cell) => cell === child.area).length;
            expect
              .soft(Math.abs(child.x - (grid.x + first * (track + gap))), `${child.area}: column`)
              .toBeLessThanOrEqual(1);
            expect
              .soft(Math.abs(child.w - (span * track + (span - 1) * gap)), `${child.area}: span`)
              .toBeLessThanOrEqual(1);
          }
        }
      });
    });
  }
});

test.describe('WG1: el marco de §5.5 a 1440 y a 390', () => {
  for (const size of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    test.describe(`${size.width} px`, () => {
      test.use({ viewport: size });

      test(`Inicio es y en a ${size.width}`, async ({ page }) => {
        for (const locale of LOCALES) {
          await openHome(page, locale);
          await expectFrame(page, size.width, homePath(locale));
        }
      });
    });
  }

  for (const width of [1280, 1024, 768]) {
    test.describe(`${width} px`, () => {
      test.use({ viewport: { width, height: 900 } });

      test(`sin desbordamiento a ${width}`, async ({ page }) => {
        await openHome(page, 'es');
        await expectFrame(page, width, `/es/ at ${width}`);
      });
    });
  }
});

test.describe('WG2: la geometría de Main (1440) e Inicio-movil (390), §8.1', () => {
  test.describe('1440 px', () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test('Destacados en (248, 268, 944 × 62) a 4 columnas; bento a 3 columnas con sus filas', async ({
      page,
    }) => {
      await openHome(page, 'es');
      const [x, width] = MAIN_COLUMN[1440];
      const gap = rhythm(1440);

      // HomeIntro: 58, the line of two rows at 320 under the h1 (Lienzo:Main).
      const intro = await boxOf(page.locator('.ac-home-intro'));
      expectBox(intro, { x, y: 96, w: width, h: 58 }, 'HomeIntro');
      const trigger = await boxOf(triggerOf(page, 1440));
      expectBox(trigger, { x, y: intro.y + intro.h + gap, w: width, h: 40 }, 'SearchTrigger home');

      let bentoTop = trigger.y + trigger.h + gap;
      if (DESTACADOS.length > 0) {
        const grid = page.locator('main .ac-featured-section__grid');
        const rows = Math.ceil(DESTACADOS.length / 4);
        // The h2 of 16 and the 10 under it (DS:FeaturedCard).
        const top = trigger.y + trigger.h + gap + 16 + 10;
        expectBox(
          await boxOf(grid),
          { x, y: top, w: width, h: rows * FEATURED_CARD + (rows - 1) * FEATURED_GAP },
          'Destacados',
        );
        expect(await columnsOf(grid), 'Destacados: 4 columns').toBe(4);
        bentoTop = top + rows * FEATURED_CARD + (rows - 1) * FEATURED_GAP + gap;
        // The board's numbers, with the line on two rows.
        expect.soft(top, '8.1 WG2: Destacados at y 268').toBe(268);
      }

      // The bento: x 248, 944 wide, 3 columns; a row as tall as its tallest panel.
      const areas = presentAreas('es');
      const template = templateFor(3, areas);
      const natural: Partial<Record<Area, number>> = {};
      for (const area of areas) {
        if (area === 'mundos') continue;
        natural[area] = panelHeight(panelLinks(area, 'es').length, area === 'pokedex' ? 4 : 2, 40);
      }
      const rowHeights = template.map((row) =>
        Math.max(...row.map((cell) => (cell === null ? 0 : (natural[cell] ?? 0)))),
      );
      const grid = await boxOf(bento(page));
      const total =
        rowHeights.reduce((sum, height) => sum + height, 0) + 16 * (rowHeights.length - 1);
      expectBox(grid, { x, y: bentoTop, w: width, h: total }, 'bento');
      expect(await columnsOf(bento(page)), 'bento: 3 columns').toBe(3);

      const children = await readBento(page);
      let top = grid.y;
      for (const [index, row] of template.entries()) {
        for (const area of new Set(row)) {
          if (area === null) continue;
          const child = children.find((entry) => entry.area === area);
          expect.soft(child, `${area} is drawn`).toBeDefined();
          if (child === undefined) continue;
          // A grid item stretches to its row (CGS §6.5, «Bento rule»).
          expectBox(child, { y: top, h: rowHeights[index] }, `row ${index + 1}, ${area}`);
        }
        top += rowHeights[index] + 16;
      }
      if (areas.join() === 'sistemas,items,pokedex,mundos' && SISTEMAS.length === 10) {
        // §8.1 WG2 with the registry of today: rows of 355 and 271, as the board's second one.
        expect.soft(rowHeights, '8.1 WG2: rows of 355 and 271').toEqual([355, 271]);
      }

      // Rows of links of 40.
      const heights = await bento(page)
        .locator('a.ac-index-panel__link')
        .evaluateAll((links) => links.map((link) => link.getBoundingClientRect().height));
      expect(
        heights.filter((height) => Math.abs(height - 40) > 0.5),
        'link rows of 40',
      ).toEqual([]);
    });
  });

  test.describe('390 px', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('Destacados en (16, 256, 358 × 272) a 1 columna; paneles con filas de 44', async ({
      page,
    }) => {
      await openHome(page, 'es');
      const [x, width] = MAIN_COLUMN[390];
      const gap = rhythm(390);

      // No sprite at 390: the text starts at the edge of the column (Lienzo:Inicio-movil).
      await expect(page.locator('.ac-home-intro__sprite')).toBeHidden();
      const intro = await boxOf(page.locator('.ac-home-intro'));
      expectBox(intro, { x, y: 96, w: width, h: 58 }, 'HomeIntro');
      const trigger = await boxOf(triggerOf(page, 390));
      expectBox(
        trigger,
        { x, y: intro.y + intro.h + gap, w: width, h: 44 },
        'SearchTrigger mobile',
      );
      await expect(triggerOf(page, 390).locator('kbd'), 'no keycap on a phone (PZ-02)').toHaveCount(
        0,
      );

      let bentoTop = trigger.y + trigger.h + gap;
      if (DESTACADOS.length > 0) {
        const grid = page.locator('main .ac-featured-section__grid');
        const top = trigger.y + trigger.h + gap + 16 + 10;
        const height = DESTACADOS.length * FEATURED_CARD + (DESTACADOS.length - 1) * FEATURED_GAP;
        expectBox(await boxOf(grid), { x, y: top, w: width, h: height }, 'Destacados');
        expect(await columnsOf(grid), 'Destacados: 1 column').toBe(1);
        bentoTop = top + height + gap;
        expect.soft(top, '8.1 WG2: Destacados at y 256').toBe(256);
      }

      // One column in the order of the DOM, each panel as tall as its rows of 44.
      const grid = await boxOf(bento(page));
      expectBox(grid, { x, y: bentoTop, w: width }, 'bento');
      expect(await columnsOf(bento(page)), 'bento: 1 column').toBe(1);
      for (const area of presentAreas('es')) {
        const expected =
          area === 'mundos'
            ? worldsHeight(MUNDOS.length)
            : panelHeight(panelLinks(area, 'es').length, 2, 44);
        expectBox(await boxOf(panel(page, area)), { x, w: width, h: expected }, area);
      }
      if (SISTEMAS.length === 10 && MUNDOS.length === 5) {
        // §8.1 WG2 with the registry of today.
        expect.soft((await boxOf(panel(page, 'sistemas'))).h, 'Sistemas 291').toBeCloseTo(291, 0);
        expect.soft((await boxOf(panel(page, 'items'))).h, 'Ítems 383').toBeCloseTo(383, 0);
        expect.soft((await boxOf(panel(page, 'pokedex'))).h, 'Pokédex 475').toBeCloseTo(475, 0);
        expect.soft((await boxOf(panel(page, 'mundos'))).h, 'Mundos 267').toBeCloseTo(267, 0);
      }

      // The Pokédex panel keeps two link columns in one bento column; rows of 44.
      const pokedexLinks = panel(page, 'pokedex').locator('.ac-index-panel__links');
      expect(await columnsOf(pokedexLinks), 'Pokédex: 2 link columns').toBe(2);
      const heights = await bento(page)
        .locator('a.ac-index-panel__link')
        .evaluateAll((links) => links.map((link) => link.getBoundingClientRect().height));
      expect(
        heights.filter((height) => Math.abs(height - 44) > 0.5),
        'link rows of 44',
      ).toEqual([]);
    });
  });
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

  for (const locale of LOCALES) {
    test(`${locale}: el menú completo, Destacados y los paneles`, async ({ page }) => {
      test.setTimeout(240_000);
      await openHome(page, locale);
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
      expect.soft(nowhere, 'no href="#" or href="" (WG5)').toBe(0);
      expect
        .soft(
          hrefs.filter((href) => RETIRED_ROUTES.some(({ pattern }) => pattern.test(href))),
          'no link to a retired route (WG5, G12)',
        )
        .toEqual([]);
      const broken: string[] = [];
      for (const href of [...new Set(hrefs.map((href) => href.split('#')[0]))]) {
        const end = await endOf(page, href);
        if (end !== '200') broken.push(`${href} → ${end}`);
      }
      expect.soft(broken, 'every internal link answers (WG5)').toEqual([]);
    });
  }
});

test.describe('WA1: axe a 1440 y a 390, con un panel abierto y con la hoja móvil', () => {
  for (const locale of LOCALES) {
    test.describe(`${locale} a 1440`, () => {
      test.use({ viewport: { width: 1440, height: 900 } });

      test(`${locale}: la página y un panel de sistema abierto`, async ({ page }) => {
        await openHome(page, locale);
        await expectAxeClean(page, homePath(locale));
        if (await openPanelTooltip(page)) {
          await expectAxeClean(page, `${homePath(locale)} with a system panel open`);
          await page.keyboard.press('Escape');
        }
      });
    });

    test.describe(`${locale} a 390`, () => {
      test.use({ viewport: { width: 390, height: 844 } });

      test(`${locale}: la página y la hoja móvil abierta`, async ({ page }) => {
        await openHome(page, locale);
        await expectAxeClean(page, `${homePath(locale)} at 390`);
        await page.locator('[aria-controls="menu-movil"]').first().click();
        await expect(page.locator('dialog#menu-movil')).toBeVisible();
        await expectAxeClean(page, `${homePath(locale)} with the phone sheet open`);
        await page.keyboard.press('Escape');
        await expect(page.locator('dialog#menu-movil')).toBeHidden();
      });
    });
  }
});

test.describe('WA2, WA3 y WA4: estructura, marca del menú, orden de tabulación e idioma', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const locale of LOCALES) {
    test(`${locale}: un h1, sin migas, «Inicio» marcada y el Tab de S13`, async ({ page }) => {
      await openHome(page, locale);
      await expectStructure(page, locale, homePath(locale));

      // WA3: «Inicio» carries `aria-current="page"`, and it is the only mark of the menu.
      const sidebar = page.locator('.ac-page-layout__sidebar');
      await expect(sidebar.locator('[aria-current]')).toHaveCount(1);
      await expect(sidebar.locator(`a[href="${homePath(locale)}"]`).first()).toHaveAttribute(
        'aria-current',
        'page',
      );

      // S13 (8.1 step 4): the Tab order of main is the DOM's — the trigger, Destacados, then
      // the links of Sistemas, Ítems, Actividades and Pokédex — and the table of worlds has
      // nothing that takes the focus (X3).
      const zones = await page.evaluate(() => {
        const zone = (element: Element): string => {
          if (element.closest('.ac-home-search')) return 'trigger';
          if (element.closest('.ac-featured-section')) return 'featured';
          const area = element.closest('[data-area]')?.getAttribute('data-area');
          return area ?? 'other';
        };
        const focusable = [
          ...document.querySelectorAll(
            'main a[href], main button, main input, main [tabindex]:not([tabindex="-1"])',
          ),
        ].filter((element) => element.checkVisibility({ visibilityProperty: true }));
        return focusable.map(zone);
      });
      const order = ['trigger', 'featured', 'sistemas', 'items', 'actividades', 'pokedex'];
      expect(
        zones.filter((zone) => !order.includes(zone)),
        'nothing else takes the focus',
      ).toEqual([]);
      const ranks = zones.map((zone) => order.indexOf(zone));
      expect(
        ranks.every((rank, index) => index === 0 || rank >= ranks[index - 1]),
        `S13: the focus follows the order of the DOM (${zones.join(', ')})`,
      ).toBe(true);

      // The keyboard walks that order from the trigger on.
      await triggerOf(page, 1440).focus();
      const walked: string[] = [];
      for (let step = 0; step < zones.length - 1; step += 1) {
        await page.keyboard.press('Tab');
        walked.push(
          await page.evaluate(() => {
            const active = document.activeElement;
            if (active === null || active.closest('main') === null) return 'outside';
            if (active.closest('.ac-featured-section')) return 'featured';
            return active.closest('[data-area]')?.getAttribute('data-area') ?? 'other';
          }),
        );
      }
      expect(walked, 'Tab walks main in the order of the DOM').toEqual(zones.slice(1));
    });
  }
});

test.describe('WL1: sin relleno (§12.4, §12.22)', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const locale of LOCALES) {
    test(`${locale}: ni H-01 a H-11 ni la lista prohibida`, async ({ page }) => {
      const { home } = MESSAGES[locale];
      await openHome(page, locale);
      const found = await harvest(page);

      // H-01, H-02: the title and the description are those of S-01 and §13.5.
      await expect(page).toHaveTitle(home.documentTitle);
      expect
        .soft(await page.title(), 'H-01: not «Inicio · PokeAlliance Wiki»')
        .not.toMatch(/^(Inicio|Home) · /);

      expect
        .soft(
          REMOVED[locale].flatMap((rule) => hits(found, rule)),
          'WL1: no text of §12.4 comes back',
        )
        .toEqual([]);
      // H-03: no kicker «PokeAlliance Wiki» inside the page (the brand of the header stays).
      expect
        .soft(hits(await harvest(page, 'main'), 'PokeAlliance Wiki'), 'H-03: no kicker')
        .toEqual([]);
      expect
        .soft(
          FORBIDDEN.flatMap((rule) => hits(found, rule)),
          'WL1: none of the forbidden strings of §12.22',
        )
        .toEqual([]);
      // H-07 (D-08): no inline `onerror`; H-09, H-10 (S7): no lucide icon but the utility
      // glyphs, which carry the bare `lucide` class; H-11: no Server Save panel (A17, Q7).
      await expect(page.locator('img[onerror]')).toHaveCount(0);
      await expect(page.locator('svg[class*="lucide-"]')).toHaveCount(0);
      await expect(page.locator('[data-testid="server-save-status"]')).toHaveCount(0);
      await expect(page.locator('.eyebrow')).toHaveCount(0);
      await expect(page.locator('a[href="#"], a[href=""]')).toHaveCount(0);
    });
  }
});

test.describe('v1 punto 9 y A3: el Inicio no lleva buscador en la cabecera', () => {
  for (const size of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    test.describe(`${size.width} px`, () => {
      test.use({ viewport: size });

      test(`sin disparador en la cabecera y nunca dos role="search" a ${size.width}`, async ({
        page,
      }) => {
        for (const locale of LOCALES) {
          await openHome(page, locale);
          await expect(page.locator('header.ac-header [data-ac-search-open]')).toHaveCount(0);
          await expect(page.locator('header.ac-header .ac-header__search')).toHaveCount(0);
          // The search of Inicio is the one visible trigger of its body.
          await expect(page.locator('[data-ac-search-open]:visible')).toHaveCount(1);
          expect(
            await page.locator('[role="search"], search').count(),
            '§14.3: never two role="search"',
          ).toBeLessThanOrEqual(1);
        }
      });
    });
  }
});

test.describe('Destacados en el menú (8.0.3, 7.10.2)', () => {
  /** What `Sprite` draws for an entry in the box of 16: its size, or nothing. */
  function drawnSprite(key: string | null): { width: number; height: number } | null {
    if (key === null) return null;
    const entry = SPRITES[key];
    if (entry === undefined) return null;
    const [width, height] = entry.frame;
    if (Math.max(width, height) > 64) {
      // An illustration, fitted to 16.
      const side = Math.max(width, height);
      return { width: Math.round((width * 16) / side), height: Math.round((height * 16) / side) };
    }
    // R11: the Diamond is the one sprite drawn at half; the others keep their 1x size.
    const factor = key === 'ui/diamond' ? 0.5 : 1;
    return { width: Math.round(width * factor), height: Math.round(height * factor) };
  }

  async function expectPinnedGroup(scope: Locator, locale: Locale, label: string): Promise<void> {
    const { home } = MESSAGES[locale];
    const heading = scope.locator('.ac-sidebar__heading');
    if (DESTACADOS.length === 0) {
      await expect(heading, `${label}: no entry, no pinned group (WG5)`).toHaveCount(0);
      return;
    }
    // A heading with no button and no chevron, always open (C7-12).
    await expect(heading).toHaveCount(1);
    await expect(heading).toHaveText(home.featured);
    // `has` takes a locator relative to the candidate, so it is built from the page.
    const group = scope
      .locator('.ac-sidebar__group')
      .filter({ has: scope.page().locator('.ac-sidebar__heading') });
    await expect(group).toHaveCount(1);
    await expect(group.locator('summary, button, svg')).toHaveCount(0);

    const links = group.locator('a.ac-sidebar__link');
    await expect(links).toHaveText(DESTACADOS.map((entry) => entry.etiqueta[locale]));
    for (const [index, entry] of DESTACADOS.entries()) {
      const link = links.nth(index);
      await expect(link).toHaveAttribute('href', `/${locale}${entry.ruta}`);
      // The box of 16 that bounces, hidden from assistive technology (6.2, DS:Sidebar).
      const box = link.locator(':scope > .ac-sidebar__sprite');
      await expect(box, `${label}: ${entry.ruta} has its sprite box`).toHaveCount(1);
      await expect(box).toHaveClass(/\bac-bounce\b/);
      await expect(box).toHaveAttribute('aria-hidden', 'true');
      // The layout box, which the bounce (a transform) does not change.
      const size = await box.evaluate((element) => {
        const html = element as HTMLElement;
        return [html.offsetWidth, html.offsetHeight];
      });
      expect.soft(size, `${label}: ${entry.ruta}: a box of 16`).toEqual([16, 16]);
      const drawn = drawnSprite(entry.sprite);
      const image = box.locator('img');
      if (drawn === null) {
        await expect(image, `${label}: ${entry.ruta} has no sprite yet`).toHaveCount(0);
        continue;
      }
      await expect(image).toHaveCount(1);
      await expect(image).toHaveAttribute('width', String(drawn.width));
      await expect(image).toHaveAttribute('height', String(drawn.height));
      // Frame 0 and no animation in the menu, the Diamond included (6.3).
      await expect(image).not.toHaveAttribute('data-anim', /.+/);
    }
  }

  test.describe('1440 px', () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    for (const locale of LOCALES) {
      test(`${locale}: las entradas de content/destacados.json con su sprite de 16`, async ({
        page,
      }) => {
        await openHome(page, locale);
        await expectPinnedGroup(page.locator('.ac-page-layout__sidebar'), locale, 'sidebar');
      });
    }

    test('E10: la entrada del grupo propio de la página lleva la marca, nunca su copia fijada', async ({
      page,
    }) => {
      const shared = DESTACADOS.filter((entry) => esRutaDelSitio(`/es${entry.ruta}`));
      test.skip(shared.length === 0, 'Ningún destacado lleva a una página migrada.');
      for (const entry of shared) {
        const path = `/es${entry.ruta}`;
        await page.goto(path);
        const sidebar = page.locator('.ac-page-layout__sidebar');
        await expect(sidebar.locator('[aria-current]'), `${path}: one mark`).toHaveCount(1);
        const pinned = sidebar
          .locator('.ac-sidebar__group')
          .filter({ has: page.locator('.ac-sidebar__heading') });
        await expect(pinned, `${path}: the pinned group`).toHaveCount(1);
        await expect(pinned.locator(`a[href="${path}"]`), `${path}: pinned in it`).toHaveCount(1);
        const others = await sidebar
          .locator(`a[href="${path}"]`)
          .evaluateAll(
            (links) => links.filter((link) => !link.closest('div.ac-sidebar__group')).length,
          );
        if (others > 0) {
          // Another group links the page: its entry is the marked one, and its group opens.
          await expect(
            pinned.locator('[aria-current]'),
            `${path}: not the pinned copy`,
          ).toHaveCount(0);
          await expect(sidebar.locator(`details a[href="${path}"]`)).toHaveAttribute(
            'aria-current',
            'page',
          );
          await expect(
            sidebar.locator('details[open]', { has: page.locator('[aria-current]') }),
          ).toHaveCount(1);
        } else {
          await expect(pinned.locator(`a[href="${path}"]`)).toHaveAttribute('aria-current', 'page');
        }
      }
    });
  });

  test.describe('390 px', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('es: la hoja móvil lleva el mismo grupo', async ({ page }) => {
      await openHome(page, 'es');
      await page.locator('[aria-controls="menu-movil"]').first().click();
      const sheet = page.locator('dialog#menu-movil');
      await expect(sheet).toBeVisible();
      await expectPinnedGroup(sheet, 'es', 'phone sheet');
      await page.keyboard.press('Escape');
    });
  });
});
