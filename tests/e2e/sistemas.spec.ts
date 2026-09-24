// §8.4 acceptance (M8): the systems index (`/{l}/sistemas/`, template D) and the system page
// (`/{l}/sistemas/{id}/`, `Lienzo:Sistema-Boost` as the template of every page) against the real
// pages, over the registries the development server reads.
//
// What it measures, by the ids of the spec:
//
//  - 8.4.1 and 8.4.2 step by step, and SI1 to SI5. SI2 and SI3 are written against every
//    mention and every amount of the records, so they measure the board's Boost when the
//    registry carries it; a registry with no amount yet skips SI3 instead of passing it.
//  - E16: each system item has its entry in the «Ítems» section of its page in the three
//    views, opens `systemItemTip`, is in the search index with that page as its `href` and
//    the palette leads to it with its trigger focused (H7).
//  - The protocol of §8.0.7: WG1 (the frame of §5.5 at 1440 and 390, no sideways scroll at
//    390), WG4 for the index (4 link columns with a main column of 900 or more, 2 below,
//    rows of 40 and 44 with a coarse pointer, no description under a link), WG5 (every
//    internal link answers 200), WA1 (axe with a panel open and with the phone sheet open),
//    WA2 (one h1, no skipped heading level, named landmarks, a caption on every table),
//    WA3 (`aria-pressed` on every toggle, the `aria-current` of the menu and of the `Toc`),
//    WA4 (`lang` of a text that only exists in the other language), WL1 (the rows of §12.10
//    and the crumbs of B-04; the forbidden list of §12.22 is content-sentinel.spec.ts's,
//    which walks these routes too) and WD1 (every figure and count is the registry's).
//  - The sistema and item groups of the search index (8.6, BU6) and the Sistemas page of
//    its `pagina` group.
//
// S19 with the data: every expectation is computed from `content/` when the spec loads, never
// copied from a board (X4). Run with `OCULTAR_BORRADORES=1` and no server on 4321 — Playwright
// passes its environment to the server it starts — and the spec expects no draft system
// anywhere (SI4); without it, the drafts are shown like any other record (§8.0.5):
//
//      OCULTAR_BORRADORES=1 pnpm exec playwright test --project=desktop tests/e2e/sistemas.spec.ts
//
// The crops and the full page against the board are the `sistema-boost` case of
// tests/visual/manifest.json. Runs in the `desktop` project; the 390 and coarse-pointer checks
// are viewport and device overrides of this spec.

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import AxeBuilder from '@axe-core/playwright';
import type { Locator, Page } from '@playwright/test';

import { en } from '../../src/i18n/messages/en';
import type { Messages } from '../../src/i18n/messages/en';
import { es } from '../../src/i18n/messages/es';
import { idiomas } from '../../scripts/lib/rutas-migradas.mjs';
import { expect, test } from './fixtures';

// ------------------------------------------------------------------------------ registries

type Locale = 'es' | 'en';
type Texto = Record<Locale, string>;

interface Ref {
  tipo: 'pokemon' | 'item' | 'sistema' | 'actividad';
  id: string;
}

type EnLinea =
  | string
  | { ancla: string; texto: string }
  | { ruta: string; texto: string }
  | { entidad: Ref; texto?: string }
  | { pd: number }
  | { dia: number };

type TextoEnLinea = Record<Locale, EnLinea[]>;

type Celda = null | number | { elemento: string } | TextoEnLinea;

type Bloque =
  | { tipo: 'parrafo'; texto: TextoEnLinea }
  | { tipo: 'subtitulo'; texto: Texto }
  | {
      tipo: 'pasos';
      pasos: { sprite: string | null; texto: TextoEnLinea; chips?: TextoEnLinea[] }[];
    }
  | {
      tipo: 'tabla';
      caption: Texto;
      columnas: { titulo: Texto; ancho?: number; conSprite?: boolean }[];
      filas: Celda[][];
      variasLineas?: boolean;
    }
  | { tipo: 'nota'; texto: TextoEnLinea }
  | {
      tipo: 'tarjetas';
      tarjetas: { titulo: Texto; sprite: string | null; texto: TextoEnLinea }[];
    }
  | { tipo: 'chips'; etiqueta: Texto; chips: TextoEnLinea[] }
  | { tipo: 'lista'; puntos: TextoEnLinea[] };

interface Seccion {
  id: string;
  titulo: Texto;
  bloques: Bloque[];
}

/** A record of `content/sistemas/<id>.json` (§3.13). */
interface Sistema {
  id: string;
  titulo: Texto;
  subtitulo?: Texto;
  sprite: string | null;
  orden: number;
  tooltip: { etiqueta: Texto; valor: Texto }[];
  intro: Bloque[];
  banner?: { sprite: string | null; datos: Record<Locale, string[]> };
  secciones: Seccion[];
  borrador?: true;
}

interface SystemItem {
  id: string;
  nombre: string;
  descripcion: string | null;
  sistema: string | null;
  sprite?: string | null;
}

interface Draftable {
  borrador?: boolean;
}

interface ItemRecord extends Draftable {
  id: string;
  nombre: string;
}

interface PokemonRecord {
  id: string;
  nombre: string;
  nivel: number | null;
  tier: number | string | null;
  elementos: string[];
  generacion: number | null;
  funcion: string | null;
}

interface QuestRecord extends Draftable {
  id: string;
  nombre: string;
}

/** An entry of `/{l}/buscar/indice.json` (src/lib/search/rank.ts, `SearchEntry`). */
interface SearchEntry {
  kind: string;
  id: string;
  name: string;
  href: string;
  meta?: string;
  icon: unknown;
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(resolve(ROOT, file), 'utf8')) as T;
}

/** `hideDrafts` of src/lib/content/registry.ts, read from the environment of this run. */
const HIDE_DRAFTS = /^(?:1|true)$/i.test(process.env.OCULTAR_BORRADORES ?? '');

function shown<T extends Draftable>(records: T[]): T[] {
  return HIDE_DRAFTS ? records.filter((record) => record.borrador !== true) : records;
}

/** Every record of content/sistemas/, in the order of the registry (`orden`, then `id`). */
const ALL_SYSTEMS = readdirSync(resolve(ROOT, 'content/sistemas'))
  .filter((file) => file.endsWith('.json'))
  .map((file) => readJson<Sistema>(`content/sistemas/${file}`))
  .sort((a, b) => a.orden - b.orden || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
/** The system pages this build writes (§8.0.5, SI4). */
const SYSTEMS = shown(ALL_SYSTEMS);
const SYSTEM_BY_ID = new Map(SYSTEMS.map((system) => [system.id, system]));
/** The drafts a build with `OCULTAR_BORRADORES=1` leaves out (SI4). */
const HIDDEN_SYSTEMS = ALL_SYSTEMS.filter((system) => !SYSTEM_BY_ID.has(system.id));

const SYSTEM_ITEMS = readJson<{ objetos: SystemItem[] }>('content/system-items.json').objetos;

/** E16: the system items whose page exists in this build, with their system. */
const LISTED_ITEMS = SYSTEM_ITEMS.flatMap((item) => {
  const system = item.sistema === null ? undefined : SYSTEM_BY_ID.get(item.sistema);
  return system === undefined ? [] : [{ item, system }];
});

function itemsOf(system: Sistema): SystemItem[] {
  return SYSTEM_ITEMS.filter((item) => item.sistema === system.id);
}

const ALL_ITEMS = readdirSync(resolve(ROOT, 'content/items'))
  .filter((file) => file.endsWith('.json') && file !== 'categorias.json')
  .flatMap((file) => readJson<{ items: ItemRecord[] }>(`content/items/${file}`).items);
const ITEM_BY_ID = new Map(shown(ALL_ITEMS).map((item) => [item.id, item]));
const ANY_ITEM_BY_ID = new Map(ALL_ITEMS.map((item) => [item.id, item]));
const POKEMON_BY_ID = new Map(
  readJson<{ pokemon: PokemonRecord[] }>('content/pokemon.json').pokemon.map((record) => [
    record.id,
    record,
  ]),
);
const QUEST_BY_ID = new Map(
  shown(readJson<{ misiones: QuestRecord[] }>('content/quests.json').misiones).map((quest) => [
    quest.id,
    quest,
  ]),
);

const MESSAGES: Record<Locale, Messages> = { es, en };
const LOCALES = idiomas as Locale[];

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

/** The screen-reader name of an amount (S8): the exact figure with its unit (§13.3). */
function amountLabel(part: { pd: number } | { dia: number }, locale: Locale): string {
  if ('dia' in part) return `${figure(part.dia, locale)} Diamonds`;
  const plural = new Intl.PluralRules(NUMBER_LOCALE[locale]).select(part.pd);
  const word =
    locale === 'es'
      ? plural === 'one'
        ? 'Pokédólar'
        : 'Pokédólares'
      : plural === 'one'
        ? 'Pokédollar'
        : 'Pokédollars';
  return `${figure(part.pd, locale)} ${word}`;
}

/** What a value of the registry reads as when it has a value (X13): not blank, not «—». */
function present(value: string | undefined): boolean {
  return value !== undefined && value.trim() !== '' && value.trim() !== '—';
}

/** The rows of `systemTip` (7.5.3): the record's own, without the ones with no value. */
function tipRows(system: Sistema, locale: Locale): [string, string][] {
  return system.tooltip
    .filter((row) => present(row.valor[locale]))
    .map((row) => [row.etiqueta[locale], row.valor[locale]]);
}

/** The name a mention shows (8.0.5): its own `texto`, else the name of its record. */
function entityName(ref: Ref, locale: Locale): string | null {
  switch (ref.tipo) {
    case 'sistema':
      return ALL_SYSTEMS.find((system) => system.id === ref.id)?.titulo[locale] ?? null;
    case 'item':
      return ANY_ITEM_BY_ID.get(ref.id)?.nombre ?? null;
    case 'pokemon':
      return POKEMON_BY_ID.get(ref.id)?.nombre ?? null;
    case 'actividad':
      return QUEST_BY_ID.get(ref.id)?.nombre ?? null;
  }
}

/**
 * R2, 8.0.5: whether a mention on the page of `page` opens a panel — the entity has a record
 * in this build and its panel has at least one row. A system of the page itself is its own
 * entry of a list (text), an activity has no panel (8.9), an item's panel always carries its
 * category, and a Pokémon's the fields of 7.5.3 it has.
 */
function hasPanel(ref: Ref, page: Sistema, locale: Locale): boolean {
  switch (ref.tipo) {
    case 'sistema': {
      const target = SYSTEM_BY_ID.get(ref.id);
      return target !== undefined && target.id !== page.id && tipRows(target, locale).length > 0;
    }
    case 'item':
      return ITEM_BY_ID.has(ref.id);
    case 'pokemon': {
      const record = POKEMON_BY_ID.get(ref.id);
      return (
        record !== undefined &&
        (record.nivel !== null ||
          record.tier !== null ||
          record.elementos.length > 0 ||
          record.generacion !== null ||
          record.funcion !== null)
      );
    }
    case 'actividad':
      return false;
  }
}

/** Every run of inline parts of a record in one locale, in reading order (§3.13). */
function runsOf(system: Sistema, locale: Locale): EnLinea[][] {
  const runs: EnLinea[][] = [];
  const block = (value: Bloque) => {
    switch (value.tipo) {
      case 'parrafo':
      case 'nota':
        runs.push(value.texto[locale]);
        break;
      case 'subtitulo':
        break;
      case 'pasos':
        for (const step of value.pasos) {
          runs.push(step.texto[locale]);
          for (const chip of step.chips ?? []) runs.push(chip[locale]);
        }
        break;
      case 'tabla':
        for (const row of value.filas) {
          for (const cell of row) {
            if (cell !== null && typeof cell === 'object' && !('elemento' in cell)) {
              runs.push(cell[locale]);
            }
          }
        }
        break;
      case 'tarjetas':
        for (const card of value.tarjetas) runs.push(card.texto[locale]);
        break;
      case 'chips':
        for (const chip of value.chips) runs.push(chip[locale]);
        break;
      case 'lista':
        for (const point of value.puntos) runs.push(point[locale]);
        break;
    }
  };
  system.intro.forEach(block);
  for (const section of system.secciones) section.bloques.forEach(block);
  return runs;
}

/** The mentions of a record in one locale (SI2), each with the name it shows. */
function mentionsOf(system: Sistema, locale: Locale): { ref: Ref; name: string }[] {
  return runsOf(system, locale).flatMap((run) =>
    run.flatMap((part) => {
      if (typeof part === 'string' || !('entidad' in part)) return [];
      const name = part.texto ?? entityName(part.entidad, locale);
      return name === null ? [] : [{ ref: part.entidad, name }];
    }),
  );
}

/** The game amounts of a record in one locale (SI3). */
function amountsOf(system: Sistema, locale: Locale): ({ pd: number } | { dia: number })[] {
  return runsOf(system, locale).flatMap((run) =>
    run.filter(
      (part): part is { pd: number } | { dia: number } =>
        typeof part !== 'string' && ('pd' in part || 'dia' in part),
    ),
  );
}

/** A run as plain text when it is only text and links; `null` with an entity or an amount. */
function plainRun(run: EnLinea[]): string | null {
  const parts: string[] = [];
  for (const part of run) {
    if (typeof part === 'string') parts.push(part);
    else if ('ancla' in part || 'ruta' in part) parts.push(part.texto);
    else return null;
  }
  return parts.join('').replace(/\s+/g, ' ').trim();
}

/** The sections of a page in order, the automatic «Ítems» last (8.4.2 steps 5 and 6). */
function sectionsOf(system: Sistema, locale: Locale): { id: string; title: string }[] {
  return [
    ...system.secciones.map((section) => ({ id: section.id, title: section.titulo[locale] })),
    ...(itemsOf(system).length > 0 ? [{ id: 'items', title: MESSAGES[locale].systems.items }] : []),
  ];
}

const systemPath = (locale: Locale, id: string) => `/${locale}/sistemas/${id}/`;
const indexPath = (locale: Locale) => `/${locale}/sistemas/`;

/** The first page that draws a `Toc` (8.0.2 C: two sections or more), for SI1. */
const RAILED = SYSTEMS.find((system) => sectionsOf(system, 'es').length >= 2);
/** SI5: the page of the Normal charger, when its system record exists in this build. */
const TRAINING = SYSTEM_BY_ID.get('punching-bag-training');

// ------------------------------------------------------------------------------- page helpers

/** The dev server compiles a page on its first request: the first hydration may be slow. */
const READY_TIMEOUT = 30_000;

type ViewName = 'cards' | 'slots' | 'list';

const VIEW_ATTRIBUTE: Record<ViewName, string> = {
  cards: 'data-card-grid',
  slots: 'data-slots',
  list: 'data-list',
};

async function open(page: Page, path: string): Promise<void> {
  const response = await page.goto(path);
  expect(response?.status(), `${path} answers 200`).toBe(200);
}

function itemsList(page: Page): Locator {
  return page.locator('.ac-entity-list[data-ac-list="sistema-items"]');
}

/** The island hydrated and applied the state of the URL (PR1, PR4). */
async function listReady(page: Page, root: Locator): Promise<void> {
  await root.scrollIntoViewIfNeeded();
  await expect(page.locator('astro-island[ssr]').filter({ has: root })).toHaveCount(0, {
    timeout: READY_TIMEOUT,
  });
  await expect(root).not.toHaveAttribute('data-ac-pending', { timeout: READY_TIMEOUT });
}

function viewButton(root: Locator, locale: Locale, view: ViewName): Locator {
  return root
    .locator('.ac-view-toggle')
    .getByRole('button', { name: MESSAGES[locale].ui.views[view], exact: true });
}

async function chooseView(root: Locator, locale: Locale, view: ViewName): Promise<void> {
  await viewButton(root, locale, view).click();
  await expect(viewButton(root, locale, view)).toHaveAttribute('aria-pressed', 'true');
  await expect(root.locator(`[${VIEW_ATTRIBUTE[view]}]`)).toHaveCount(1, {
    timeout: READY_TIMEOUT,
  });
}

async function forgetView(page: Page): Promise<void> {
  await page.evaluate(() => {
    try {
      window.localStorage.removeItem('ac:vista:sistema-items');
    } catch {
      // U6: storage may be blocked; nothing was saved then.
    }
  });
}

/** Waits for the 150 ms entry of a panel (6.2), so axe never reads it half faded. */
async function settledPanel(page: Page): Promise<Locator> {
  const panel = page.locator('[role="tooltip"][data-open]').first();
  await expect(panel).toBeVisible();
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

/** Opens the panel of `trigger` by hovering it (7.5.4). */
async function hoverPanel(page: Page, trigger: Locator): Promise<Locator> {
  await page.mouse.move(0, 0);
  await trigger.scrollIntoViewIfNeeded();
  await trigger.hover();
  return settledPanel(page);
}

/** The rows of an open panel as «label» and value (DS:GameTooltip). */
async function panelRows(panel: Locator): Promise<[string, string][]> {
  return panel
    .locator('.ac-game-tooltip__row')
    .evaluateAll((rows) =>
      rows.map((row) => [
        (row.querySelector('dt')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
        (row.querySelector('dd')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
      ]),
    );
}

/** Text of an element without the panel a nested entity carries next to its trigger (7.5.1). */
async function textOf(target: Locator): Promise<string> {
  return target.evaluate((element) => {
    const copy = element.cloneNode(true) as Element;
    for (const panel of copy.querySelectorAll('[role="tooltip"], .sr-only')) panel.remove();
    return (copy.textContent ?? '').replace(/\s+/g, ' ').trim();
  });
}

async function textsOf(targets: Locator): Promise<string[]> {
  return targets.evaluateAll((elements) =>
    elements.map((element) => {
      const copy = element.cloneNode(true) as Element;
      for (const panel of copy.querySelectorAll('[role="tooltip"], .sr-only')) panel.remove();
      return (copy.textContent ?? '').replace(/\s+/g, ' ').trim();
    }),
  );
}

/** The accessible name of each amount: its hidden figure, or the visible text when it has none. */
async function textsOfNames(amounts: Locator): Promise<string[]> {
  return amounts.evaluateAll((elements) =>
    elements.map((element) => {
      const hidden = element.querySelector('.sr-only');
      const text = hidden?.textContent ?? element.textContent ?? '';
      return text.replace(/\s+/g, ' ').trim();
    }),
  );
}

// -------------------------------------------------------------------------- frame and grid

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

/** §5.5, CGS §3: x and width of the main column, with the `Toc` rail or the spacer. */
const MAIN_COLUMN: Record<number, { rail: [number, number]; spacer: [number, number] }> = {
  1440: { rail: [248, 896], spacer: [248, 944] },
  1280: { rail: [248, 736], spacer: [248, 784] },
  1024: { rail: [16, 992], spacer: [16, 992] },
  768: { rail: [16, 736], spacer: [16, 736] },
  390: { rail: [16, 358], spacer: [16, 358] },
};

/** WG1 (S1): the frame of §5.5 and no sideways scroll, at the width of the window. */
async function expectFrame(page: Page, width: number, railed: boolean, label: string) {
  await page.evaluate(() => window.scrollTo(0, 0));
  const frame = await readFrame(page);
  const [x, w] = MAIN_COLUMN[width][railed ? 'rail' : 'spacer'];
  expect.soft(frame.header?.y ?? NaN, `${label}: header at y 0`).toBeCloseTo(0, 0);
  expect.soft(frame.header?.h ?? NaN, `${label}: header 64 tall`).toBeCloseTo(64, 0);
  expect.soft(Math.abs((frame.main?.x ?? NaN) - x), `${label}: main x ${x}`).toBeLessThanOrEqual(1);
  expect
    .soft(Math.abs((frame.main?.w ?? NaN) - w), `${label}: main width ${w}`)
    .toBeLessThanOrEqual(1);
  expect.soft(Math.abs((frame.main?.y ?? NaN) - 96), `${label}: main y 96`).toBeLessThanOrEqual(1);
  if (width >= 1280) {
    expect.soft(frame.sidebar?.w ?? NaN, `${label}: sidebar 208 wide`).toBeCloseTo(208, 0);
    const side = railed ? frame.rail : frame.spacer;
    expect.soft(side?.shown ?? false, `${label}: ${railed ? 'Toc rail' : 'spacer'}`).toBe(true);
  } else {
    expect.soft(frame.sidebar?.shown ?? false, `${label}: no sidebar below 1280`).toBe(false);
  }
  expect
    .soft(frame.scrollWidth, `${label}: documentElement.scrollWidth ≤ ${width} (WG1)`)
    .toBeLessThanOrEqual(width);
}

/** 8.0.2 D: the link grid of the index, its columns and the height of every link. */
async function readLinks(page: Page) {
  return page.locator('.ac-index-links').evaluate((root) => {
    const list = root.querySelector('.ac-index-links__list') as Element;
    const links = [...root.querySelectorAll('.ac-index-links__link')];
    const tops = new Set(links.map((link) => Math.round(link.getBoundingClientRect().top)));
    return {
      width: root.getBoundingClientRect().width,
      columns: getComputedStyle(list).gridTemplateColumns.split(' ').filter(Boolean).length,
      heights: [...new Set(links.map((link) => Math.round(link.getBoundingClientRect().height)))],
      rows: tops.size,
      count: links.length,
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
    return {
      h1: document.querySelectorAll('h1').length,
      skips,
      mainId: document.querySelector('main')?.id ?? null,
      skipHref: document.querySelector('a.ac-skip-link')?.getAttribute('href') ?? null,
      breadcrumb: document.querySelector('nav.ac-breadcrumb')?.getAttribute('aria-label') ?? null,
      toc: document.querySelector('aside.ac-toc')?.getAttribute('aria-label') ?? null,
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
  if (report.hasToc) {
    expect.soft(report.toc, `${label}: the Toc is named (WA2)`).toBe(shell.tocLabel);
  }
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
      for (const name of ['aria-label', 'alt', 'title', 'placeholder', 'content']) {
        const value = element.getAttribute(name);
        if (value !== null) attributes.push({ name, value: value.trim() });
      }
    }
    return { texts, attributes };
  });
}

type Rule = string | RegExp;

function hits(found: Harvest, rule: Rule): string[] {
  const matches = (value: string) => (typeof rule === 'string' ? value === rule : rule.test(value));
  return [
    ...found.texts.filter(matches),
    ...found.attributes
      .filter((entry) => matches(entry.value))
      .map((entry) => `${entry.name}=${entry.value}`),
  ];
}

/**
 * §12.10, the BORRAR and REESCRIBIR rows of `SIS` with their «Actual» text (Y-01 to Y-11),
 * and B-04: the old crumbs «Inicio / Sistemas» under «Ruta de navegación». The counts
 * without a label of Y-06 are the bare figures of the index. The evidence counters of the
 * old cards go with them (D-012, no provenance).
 */
const REMOVED: Record<Locale, Rule[]> = {
  es: [
    'Objetos y movimientos que ayudan a entender los sistemas de PokeAlliance.',
    'Wiki Core / Sistemas',
    'Cada ficha conserva el estado del dato y el enlace a la evidencia que lo respalda.',
    'Objetos de sistema',
    'Movimientos',
    'Descripción',
    'training_charger',
    'item',
    'move',
    'Ruta de navegación',
    /^\d+ evidencias$/,
  ],
  en: [
    'Items and moves that explain the systems of PokeAlliance.',
    'Wiki Core / Systems',
    'Every entry keeps its data status and the evidence link behind it.',
    'System items',
    'Moves',
    'Description',
    'training_charger',
    'item',
    'move',
    /^\d+ evidence items$/,
  ],
};

async function expectNoRemovedText(page: Page, locale: Locale, label: string): Promise<void> {
  const found = await harvest(page);
  expect
    .soft(
      REMOVED[locale].flatMap((rule) => hits(found, rule)),
      `${label}: no text of a BORRAR row of §12.10 (WL1)`,
    )
    .toEqual([]);
  // B-04: the crumbs are «Sistemas» (› {titulo}); «Inicio» is not one of them.
  await expect
    .soft(
      page
        .locator('nav.ac-breadcrumb')
        .getByText(locale === 'es' ? 'Inicio' : 'Home', { exact: true }),
      `${label}: no «Inicio» crumb (B-04)`,
    )
    .toHaveCount(0);
  // S7: no lucide icon outside the utility glyphs, which carry the bare `lucide` class.
  const lucide = await page.locator('svg[class*="lucide-"]').count();
  expect.soft(lucide, `${label}: no lucide icon outside Glyph (WL1, S7)`).toBe(0);
}

// ================================================================================ tests

test.describe('Índice de Sistemas (8.4.1)', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const locale of LOCALES) {
    test(`${locale}: una miga, el título y un enlace por sistema en orden de registro (WD1)`, async ({
      page,
    }) => {
      const copy = MESSAGES[locale].systems;
      await open(page, indexPath(locale));

      // 8.0.4, T15: one crumb, the current one.
      const crumbs = page.locator('nav.ac-breadcrumb li.ac-breadcrumb__item');
      await expect(crumbs).toHaveCount(1);
      await expect(crumbs.first().locator('[aria-current="page"]')).toHaveText(copy.title);
      await expect(page.locator('main h1')).toHaveText(copy.title);

      // 13.5: «{h1} · PokeAlliance Wiki» and the description of the dictionary.
      await expect(page).toHaveTitle(`${copy.title} · PokeAlliance Wiki`);
      await expect(page.locator('meta[name="description"]')).toHaveAttribute(
        'content',
        copy.description,
      );

      if (SYSTEMS.length === 0) {
        await expect(page.locator('main .ac-empty-state')).toHaveText(copy.empty);
        await expect(page.locator('.ac-index-links')).toHaveCount(0);
        return;
      }

      // One link per system page, in the order of the registry, with its title (WD1).
      const links = page.locator('.ac-index-links .ac-index-links__link');
      await expect(links).toHaveCount(SYSTEMS.length);
      expect(await textsOf(links.locator('.ac-index-links__label'))).toEqual(
        SYSTEMS.map((system) => system.titulo[locale]),
      );
      expect(
        await links.evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute('href'))),
      ).toEqual(SYSTEMS.map((system) => systemPath(locale, system.id)));
      // The 32 px icon cell is always there (7.2.8), and nothing but the link is in a cell:
      // no description, state or count under it (8.0.2 D).
      await expect(links.locator('.ac-index-links__icon')).toHaveCount(SYSTEMS.length);
      expect(await textsOf(page.locator('.ac-index-links__item'))).toEqual(
        SYSTEMS.map((system) => system.titulo[locale]),
      );
      await expect(page.locator('main .ac-empty-state')).toHaveCount(0);

      // R2: a panel only on the systems whose record has tooltip rows.
      for (const system of SYSTEMS) {
        const item = page.locator('.ac-index-links__item').filter({
          has: page.locator(`a[href="${systemPath(locale, system.id)}"]`),
        });
        await expect
          .soft(item.locator('[role="tooltip"]'), `${system.id}: panel only with rows (R2)`)
          .toHaveCount(tipRows(system, locale).length > 0 ? 1 : 0);
      }
    });

    test(`${locale}: el panel de un sistema sale encima con las filas de su registro (8.4.1 paso 3)`, async ({
      page,
    }) => {
      const system = SYSTEMS.find((entry) => tipRows(entry, locale).length > 0);
      test.skip(system === undefined, 'Ningún sistema del registro tiene filas de tooltip.');
      if (system === undefined) return;
      await open(page, indexPath(locale));
      const link = page.locator(`.ac-index-links a[href="${systemPath(locale, system.id)}"]`);
      const panel = await hoverPanel(page, link);
      await expect(panel.locator('.ac-game-tooltip__title')).toHaveText(system.titulo[locale]);
      expect(await panelRows(panel)).toEqual(tipRows(system, locale));
      // Above the link, anchored to its left edge (DS:IndexPanel).
      const [linkBox, panelBox] = [await link.boundingBox(), await panel.boundingBox()];
      expect(panelBox && linkBox && panelBox.y + panelBox.height <= linkBox.y).toBe(true);
      await expect(panel.locator('.ac-game-tooltip__footer')).toHaveText(
        MESSAGES[locale].ui.pinHint,
      );
      await page.keyboard.press('Escape');
      await expect(panel).toBeHidden();
    });
  }
});

test.describe('WG4: la rejilla de enlaces del índice (8.0.2 D)', () => {
  test.skip(SYSTEMS.length === 0, 'Sin sistemas publicados el índice muestra el vacío.');

  for (const size of [
    { width: 1440, height: 900 },
    { width: 1280, height: 900 },
    { width: 1024, height: 900 },
    { width: 768, height: 900 },
    { width: 390, height: 844 },
  ]) {
    test.describe(`${size.width} px`, () => {
      test.use({ viewport: size });

      test(`columnas y filas de 40 a ${size.width}`, async ({ page }) => {
        await open(page, indexPath('es'));
        await expectFrame(page, size.width, false, `/es/sistemas/ a ${size.width}`);
        const grid = await readLinks(page);
        const main = MAIN_COLUMN[size.width].spacer[1];
        expect
          .soft(Math.abs(grid.width - main), 'the grid spans the main column')
          .toBeLessThanOrEqual(1);
        expect
          .soft(grid.columns, `link columns for a main column of ${main}`)
          .toBe(main >= 900 ? 4 : 2);
        expect
          .soft(grid.rows, 'every row filled in order')
          .toBe(Math.ceil(SYSTEMS.length / (main >= 900 ? 4 : 2)));
        expect.soft(grid.heights, 'rows of 40 with a fine pointer').toEqual([40]);
      });
    });
  }

  test.describe('puntero grueso', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

    test('filas de 44 (S14)', async ({ page }) => {
      await open(page, indexPath('es'));
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);
      const grid = await readLinks(page);
      expect(grid.columns).toBe(2);
      expect(grid.heights, 'rows of 44 with a coarse pointer').toEqual([44]);
    });
  });
});

test.describe('Página de sistema (8.4.2)', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const locale of LOCALES) {
    test(`${locale}: cada sistema, paso a paso desde su registro (WD1, SI1)`, async ({ page }) => {
      test.setTimeout(240_000);
      const copy = MESSAGES[locale].systems;
      const descriptions = new Map<string, string>();

      for (const system of SYSTEMS) {
        const path = systemPath(locale, system.id);
        const title = system.titulo[locale];
        await open(page, path);

        // Step 1: «Sistemas › {titulo}», the group crumb linking to the index (8.0.4).
        const crumbs = page.locator('nav.ac-breadcrumb li.ac-breadcrumb__item');
        await expect.soft(crumbs, `${path}: two crumbs`).toHaveCount(2);
        await expect
          .soft(crumbs.nth(0).locator('a'), `${path}: the group crumb`)
          .toHaveAttribute('href', indexPath(locale));
        await expect.soft(crumbs.nth(0)).toHaveText(copy.title);
        await expect
          .soft(crumbs.nth(1).locator('[aria-current="page"]'), `${path}: the current crumb`)
          .toHaveText(title);

        // Step 2: the title and its subtitle.
        await expect.soft(page.locator('main h1')).toHaveText(title);
        const subtitle = page.locator('.ac-page-title__sub');
        if (system.subtitulo) await expect.soft(subtitle).toHaveText(system.subtitulo[locale]);
        else await expect.soft(subtitle).toHaveCount(0);

        // Step 3: the lead paragraphs.
        const intro = page.locator('.ac-system-intro > p');
        await expect
          .soft(intro, `${path}: one paragraph per intro block`)
          .toHaveCount(system.intro.length);
        for (const [index, block] of system.intro.entries()) {
          if (block.tipo !== 'parrafo') continue;
          const plain = plainRun(block.texto[locale]);
          if (plain !== null) expect.soft(await textOf(intro.nth(index))).toBe(plain);
        }

        // Step 4: the banner and its facts.
        const banner = page.locator('main .ac-info-banner');
        if (system.banner) {
          expect
            .soft(await textsOf(banner.locator('.ac-info-banner__fact')), `${path}: banner`)
            .toEqual(system.banner.datos[locale]);
        } else {
          await expect.soft(banner).toHaveCount(0);
        }

        // Steps 5 and 6: one Section per record section, the automatic «Ítems» last.
        const sections = sectionsOf(system, locale);
        const drawn = page.locator('main > section.ac-section');
        expect
          .soft(
            await drawn.evaluateAll((elements) => elements.map((element) => element.id)),
            `${path}: sections in the order of the record`,
          )
          .toEqual(sections.map((section) => section.id));
        expect
          .soft(await textsOf(drawn.locator(':scope > .ac-section__head h2')), `${path}: h2`)
          .toEqual(sections.map((section) => section.title));

        // The blocks, figure by figure (WD1).
        for (const section of system.secciones) {
          const root = page.locator(`section#${section.id}`);
          const blocks = section.bloques;
          const count = (tipo: Bloque['tipo']) => blocks.filter((b) => b.tipo === tipo).length;
          const tables = blocks.filter(
            (block): block is Extract<Bloque, { tipo: 'tabla' }> => block.tipo === 'tabla',
          );
          const drawnTables = root.locator('table');
          await expect.soft(drawnTables, `#${section.id}: tables`).toHaveCount(tables.length);
          for (const [index, table] of tables.entries()) {
            const drawnTable = drawnTables.nth(index);
            await expect.soft(drawnTable.locator('caption')).toHaveText(table.caption[locale]);
            expect
              .soft(await textsOf(drawnTable.locator('thead th')), `#${section.id}: headers`)
              .toEqual(table.columnas.map((column) => column.titulo[locale]));
            await expect
              .soft(drawnTable.locator('tbody tr'), `#${section.id}: one row per record row`)
              .toHaveCount(table.filas.length);
          }
          await expect.soft(root.locator('.ac-note')).toHaveCount(count('nota'));
          if (count('nota') > 0) {
            await expect
              .soft(root.locator('.ac-note__lead'))
              .toHaveText(MESSAGES[locale].ui.noteLead);
          }
          const cards = blocks.flatMap((block) =>
            block.tipo === 'tarjetas' ? block.tarjetas : [],
          );
          expect
            .soft(await textsOf(root.locator('.ac-info-card__title')), `#${section.id}: cards`)
            .toEqual(cards.map((card) => card.titulo[locale]));
          const chipBlocks = blocks.filter(
            (block): block is Extract<Bloque, { tipo: 'chips' }> => block.tipo === 'chips',
          );
          expect
            .soft(await textsOf(root.locator('.ac-system-block__chips-label')))
            .toEqual(chipBlocks.map((block) => block.etiqueta[locale]));
          const lists = blocks.flatMap((block) => (block.tipo === 'lista' ? [block] : []));
          await expect
            .soft(root.locator('.ac-system-block__list > li'))
            .toHaveCount(lists.reduce((sum, list) => sum + list.puntos.length, 0));
          const steps = blocks.flatMap((block) => (block.tipo === 'pasos' ? block.pasos : []));
          await expect
            .soft(root.locator('.ac-timeline__step, .ac-system-block__steps > li'))
            .toHaveCount(steps.length);
          for (const [index, label] of (
            await textsOf(root.locator('.ac-timeline__label'))
          ).entries()) {
            // 8.4: the generated label of a step drawn as a Timeline.
            expect.soft(label).toBe(fill(MESSAGES[locale].systems.step, { n: String(index + 1) }));
          }
          await expect
            .soft(root.locator('.ac-system-block__subtitle'))
            .toHaveCount(count('subtitulo'));
        }

        // Step 7 (SI1): the Toc with the sections, in the same order and with the same titles;
        // with fewer than two there is no Toc and the spacer keeps the column at 944 (8.0.2 C).
        const toc = page.locator('aside.ac-toc');
        if (sections.length >= 2) {
          expect
            .soft(await textsOf(toc.locator('.ac-toc__link')), `${path}: Toc entries (SI1)`)
            .toEqual(sections.map((section) => section.title));
          expect
            .soft(
              await toc
                .locator('.ac-toc__link')
                .evaluateAll((links) => links.map((link) => link.getAttribute('href'))),
            )
            .toEqual(sections.map((section) => `#${section.id}`));
        } else {
          await expect.soft(toc, `${path}: no Toc with ${sections.length} sections`).toHaveCount(0);
        }

        // 13.5: «{titulo} · PokeAlliance Wiki», a description of 50 to 160 characters, unique.
        await expect.soft(page).toHaveTitle(`${title} · PokeAlliance Wiki`);
        const description =
          (await page.locator('meta[name="description"]').getAttribute('content')) ?? '';
        expect.soft(description.length, `${path}: description length`).toBeGreaterThanOrEqual(50);
        expect.soft(description.length, `${path}: description length`).toBeLessThanOrEqual(160);
        expect
          .soft(descriptions.get(description), `${path}: description unique (13.5)`)
          .toBeUndefined();
        descriptions.set(description, path);
      }
      expect(descriptions.has(copy.description), 'no page repeats the index').toBe(false);
    });
  }

  test('un id que no es un registro responde 404 (8.4.2)', async ({ page }) => {
    const unknown = 'no-es-un-sistema';
    expect(ALL_SYSTEMS.some((system) => system.id === unknown)).toBe(false);
    for (const locale of LOCALES) {
      const response = await page.request.get(systemPath(locale, unknown));
      expect(response.status()).toBe(404);
    }
  });

  test('SI1: la entrada del Toc de la sección visible lleva aria-current="location"', async ({
    page,
  }) => {
    test.skip(RAILED === undefined, 'Ningún sistema tiene dos secciones o más.');
    if (RAILED === undefined) return;
    await open(page, systemPath('es', RAILED.id));
    const sections = sectionsOf(RAILED, 'es');
    const current = () =>
      page.evaluate(
        () =>
          document
            .querySelector('aside.ac-toc .ac-toc__link[aria-current="location"]')
            ?.getAttribute('href') ?? null,
      );
    expect(await current(), 'the first entry on load (7.11)').toBe(`#${sections[0].id}`);
    // Each section brought to 70 px of the top, under the anchor line of 80 (7.11): the entry
    // of that section is the current one. A section the document cannot bring that high,
    // because the page ends first, is left to the end of the document, which marks the last.
    let measured = 0;
    for (const section of sections.slice(1, -1)) {
      const reachable = await page.evaluate((id) => {
        const target = document.getElementById(id);
        if (target === null) return false;
        const top = target.getBoundingClientRect().top + window.scrollY - 70;
        const end = document.documentElement.scrollHeight - window.innerHeight;
        if (top >= end - 1) return false;
        window.scrollTo({ top, behavior: 'instant' });
        return true;
      }, section.id);
      if (!reachable) continue;
      measured += 1;
      await expect.poll(current, { message: `#${section.id} is current` }).toBe(`#${section.id}`);
    }
    expect(measured, 'SI1 moves the mark at least once before the end').toBeGreaterThan(0);
    await page.evaluate(() =>
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }),
    );
    const last = sections[sections.length - 1];
    await expect.poll(current, { message: `the end marks #${last.id}` }).toBe(`#${last.id}`);
  });
});

test.describe('SI2 y SI3: menciones e importes', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const locale of LOCALES) {
    test(`${locale}: una mención es NestedEntity solo con panel (SI2, R2)`, async ({ page }) => {
      test.setTimeout(120_000);
      const withMentions = SYSTEMS.filter((system) => mentionsOf(system, locale).length > 0);
      test.skip(withMentions.length === 0, 'Ningún registro de sistema menciona una entidad.');
      for (const system of withMentions) {
        const path = systemPath(locale, system.id);
        await open(page, path);
        const scope = page.locator('main .ac-system-intro, main > section.ac-section');
        for (const mention of mentionsOf(system, locale)) {
          const triggers = scope.locator(
            '.ac-nested-entity__trigger, .ac-chip a, .ac-chip button',
            {
              hasText: mention.name,
            },
          );
          if (hasPanel(mention.ref, system, locale)) {
            const trigger = triggers.first();
            await expect
              .soft(trigger, `${path}: «${mention.name}» opens its panel (SI2)`)
              .toHaveAttribute('aria-describedby', /.+/);
            const id = await trigger.getAttribute('aria-describedby');
            if (id !== null) {
              await expect
                .soft(page.locator(`[id="${id}"] .ac-game-tooltip__row`).first())
                .toBeAttached();
            }
            continue;
          }
          // Without a panel the name is text: no href, no aria-describedby, no role="button".
          const controls = await scope.evaluateAll(
            (roots, name) =>
              roots.flatMap((root) =>
                [
                  ...root.querySelectorAll('a[href], button, [role="button"], [aria-describedby]'),
                ].filter((element) => (element.textContent ?? '').trim() === name),
              ).length,
            mention.name,
          );
          expect.soft(controls, `${path}: «${mention.name}» is text (SI2)`).toBe(0);
          await expect.soft(scope.getByText(mention.name).first()).toBeVisible();
        }
      }
    });

    test(`${locale}: cada importe lleva su sprite y la cifra exacta como nombre (SI3, S8)`, async ({
      page,
    }) => {
      const withAmounts = SYSTEMS.filter((system) => amountsOf(system, locale).length > 0);
      test.skip(withAmounts.length === 0, 'Ningún registro de sistema lleva importes todavía.');
      for (const system of withAmounts) {
        const path = systemPath(locale, system.id);
        await open(page, path);
        const scope = page.locator('main');
        const drawn = scope.locator('.ac-pokedolares-amount, .ac-diamonds-amount');
        const names = await textsOfNames(drawn);
        for (const amount of amountsOf(system, locale)) {
          expect
            .soft(names, `${path}: «${amountLabel(amount, locale)}» (S8)`)
            .toContain(amountLabel(amount, locale));
        }
        // Every amount draws its sprite box before the figure (R5).
        const spriteless = await drawn.evaluateAll(
          (amounts) =>
            amounts.filter(
              (amount) =>
                amount.querySelector(
                  '.ac-pokedolares-amount__sprite, .ac-diamonds-amount__sprite, .ac-diamonds-amount__frame',
                ) === null,
            ).length,
        );
        expect.soft(spriteless, `${path}: every amount has its sprite (R5)`).toBe(0);
      }
    });
  }
});

test.describe('SI4: borradores', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  // Without the flag the drafts are shown like any other record (8.0.5); with it they are
  // nowhere. Both runs check the same sets, computed from the registry.
  test('un borrador oculto no tiene página ni aparece en el índice, el menú, el Inicio ni la búsqueda', async ({
    page,
  }) => {
    for (const locale of LOCALES) {
      // The index.
      await open(page, indexPath(locale));
      expect(
        await page
          .locator('.ac-index-links .ac-index-links__link')
          .evaluateAll((links) => links.map((link) => link.getAttribute('href'))),
        `${locale}: the index lists the systems of this build`,
      ).toEqual(SYSTEMS.map((system) => systemPath(locale, system.id)));

      // The menu (8.0.3): the Sistemas group has the same entries, in the same order. The
      // pinned «Destacados» may link a system page too (M10): the group is its `<details>`.
      const menu = page.locator(`.ac-page-layout__sidebar details a[href^="/${locale}/sistemas/"]`);
      expect(
        await menu.evaluateAll((links) => links.map((link) => link.getAttribute('href'))),
        `${locale}: the menu lists the systems of this build`,
      ).toEqual(SYSTEMS.map((system) => systemPath(locale, system.id)));

      // The search index (8.6).
      const entries = (await (
        await page.request.get(`/${locale}/buscar/indice.json`)
      ).json()) as SearchEntry[];
      expect(
        entries.filter((entry) => entry.kind === 'sistema').map((entry) => entry.id),
        `${locale}: the search index lists the systems of this build`,
      ).toEqual(SYSTEMS.map((system) => system.id));

      // The hidden drafts: no page, and their name nowhere on the index, the menu or Inicio.
      for (const draft of HIDDEN_SYSTEMS) {
        const status = (await page.request.get(systemPath(locale, draft.id))).status();
        expect.soft(status, `${draft.id}: no page with OCULTAR_BORRADORES=1`).toBe(404);
      }
      if (HIDDEN_SYSTEMS.length === 0) continue;
      for (const path of [indexPath(locale), `/${locale}/`]) {
        await open(page, path);
        const found = await harvest(page);
        const leaked = HIDDEN_SYSTEMS.map((draft) => draft.titulo[locale]).filter((name) =>
          found.texts.includes(name),
        );
        expect.soft(leaked, `${path}: no hidden draft`).toEqual([]);
      }
    }
  });
});

test.describe('E16 y SI5: los ítems de sistema', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const locale of LOCALES) {
    test(`${locale}: cada ítem en la sección «Ítems» de su página, en las tres vistas (E16, WD1)`, async ({
      page,
    }) => {
      test.setTimeout(120_000);
      test.skip(LISTED_ITEMS.length === 0, 'Ningún ítem de sistema tiene página.');
      const copy = MESSAGES[locale].systems;
      for (const system of SYSTEMS.filter((entry) => itemsOf(entry).length > 0)) {
        const items = itemsOf(system);
        await open(page, systemPath(locale, system.id));
        const root = itemsList(page);
        await expect(page.locator('section#items h2')).toHaveText(copy.items);
        await listReady(page, root);
        await expect(root.locator('.ac-entity-list__bar [aria-live="polite"]')).toHaveText(
          counted(copy.itemCount, items.length, locale),
        );
        await expect(root.locator('.ac-view-toggle [role="group"]')).toHaveAttribute(
          'aria-label',
          copy.itemView,
        );

        // Cards: one loot card per item, `h3` titles (8.0.6), «Uso» with the description.
        const cards = root.locator('[data-card-grid] article');
        expect(await cards.evaluateAll((all) => all.map((card) => card.id))).toEqual(
          items.map((item) => `item-${item.id}`),
        );
        expect(await textsOf(cards.locator('h3'))).toEqual(items.map((item) => item.nombre));
        // A card opens nothing (7.5.10).
        await expect(cards.locator('[aria-describedby]')).toHaveCount(0);

        // Slots: one slot of 40 per item, a button with its name.
        await chooseView(root, locale, 'slots');
        const slots = root.locator('[data-slots] li[id^="item-"]');
        expect(await slots.evaluateAll((all) => all.map((slot) => slot.id))).toEqual(
          items.map((item) => `item-${item.id}`),
        );
        for (const item of items) {
          await expect(
            root.locator(`#item-${item.id} button`).first(),
            `${item.id}: its slot is a button`,
          ).toHaveAccessibleName(new RegExp(item.nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
        }

        // Lista: caption «Ítems de {titulo}», Sprite · Ítem · Uso, one row per item.
        await chooseView(root, locale, 'list');
        const table = root.locator('[data-list] table');
        await expect(table.locator('caption')).toHaveText(
          fill(copy.itemCaption, { title: system.titulo[locale] }),
        );
        const withUse = items.some((item) => item.descripcion !== null);
        // The sprite header is for screen readers only (`srOnly`): its text is still there.
        const headers = await table.locator('thead th').allTextContents();
        expect(headers.map((header) => header.trim())).toEqual([
          copy.columnSprite,
          copy.columnItem,
          ...(withUse ? [MESSAGES[locale].ui.tooltip.use] : []),
        ]);
        expect(
          await table.locator('tbody tr').evaluateAll((rows) => rows.map((r) => r.id)),
        ).toEqual(items.map((item) => `item-${item.id}`));
        await forgetView(page);
      }
    });

    test(`${locale}: SI5 — el slot y el nombre en Lista abren «Sistema:» y «Uso:»`, async ({
      page,
    }) => {
      const charger = SYSTEM_ITEMS.find((item) => item.id === 'normal-training-charger');
      test.skip(
        TRAINING === undefined || charger === undefined,
        'El registro no tiene la página de punching-bag-training o su Normal charger.',
      );
      if (TRAINING === undefined || charger === undefined) return;
      const labels = MESSAGES[locale].ui.tooltip;
      const expected: [string, string][] = [
        [`${labels.system}:`, TRAINING.titulo[locale]],
        ...(charger.descripcion === null
          ? []
          : ([[`${labels.use}:`, charger.descripcion]] as [string, string][])),
      ];

      for (const view of ['slots', 'list'] as const) {
        await open(page, `${systemPath(locale, TRAINING.id)}?view=${view}`);
        const root = itemsList(page);
        await listReady(page, root);
        await expect(root.locator(`[${VIEW_ATTRIBUTE[view]}]`)).toHaveCount(1);
        const trigger =
          view === 'slots'
            ? root.locator(`#item-${charger.id} button`).first()
            : root.locator(`#item-${charger.id} .ac-list-row__name button`).first();
        if (view === 'list') await expect(trigger).toHaveText(charger.nombre);
        const panel = await hoverPanel(page, trigger);
        await expect(panel.locator('.ac-game-tooltip__title')).toHaveText(charger.nombre);
        expect(await panelRows(panel), `${view}: systemItemTip (7.5.3)`).toEqual(expected);
        // T22, WA4: the description only exists in English.
        if (locale === 'es' && charger.descripcion !== null) {
          await expect(
            panel.locator('[lang="en"]', { hasText: charger.descripcion }),
          ).not.toHaveCount(0);
        }
        await page.keyboard.press('Escape');
        await expect(panel).toBeHidden();
        await forgetView(page);
      }
    });

    test(`${locale}: SI5 — la paleta encuentra «charger» y lleva al ítem enfocado (H7)`, async ({
      page,
    }) => {
      const charger = LISTED_ITEMS.find(({ item }) => item.id === 'normal-training-charger');
      test.skip(charger === undefined, 'El Normal charger no tiene página en este build.');
      if (charger === undefined) return;
      const anchor = `item-${charger.item.id}`;
      const href = `${systemPath(locale, charger.system.id)}#${anchor}`;

      await open(page, indexPath(locale));
      await page.keyboard.press('Control+k');
      await expect(page.locator('dialog#buscar-dialogo')).toBeVisible();
      await page.locator('#buscar-campo').fill('charger');
      const option = page.locator(`#buscar-opcion-item-${charger.item.id}`);
      await expect(option, 'the option is in the Ítems group').toBeVisible({
        timeout: READY_TIMEOUT,
      });
      await expect(option).toHaveAttribute('href', href);
      await expect(page.locator('#buscar-grupo-item'), 'its group is «Ítems» / «Items»').toHaveText(
        MESSAGES[locale].search.groups.item,
      );
      await option.click();
      await expect(page).toHaveURL(new RegExp(`${href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));

      const root = itemsList(page);
      await listReady(page, root);
      // H7: the element of the active view (Cards, the default) is in the window and holds
      // the focus — itself or its trigger.
      await expect
        .poll(
          () =>
            page.evaluate((id) => {
              const active = document.activeElement;
              return (
                active !== null && active !== document.body && active.closest(`#${id}`) !== null
              );
            }, anchor),
          { message: `H7: the focus is on #${anchor} or inside it` },
        )
        .toBe(true);
      await expect(page.locator(`#${anchor}`)).toBeInViewport();
      await forgetView(page);
    });

    test(`${locale}: H7 — el ancla de un ítem enfoca su slot en Slots y su nombre en Lista`, async ({
      page,
    }) => {
      test.skip(LISTED_ITEMS.length === 0, 'Ningún ítem de sistema tiene página.');
      const { item, system } = LISTED_ITEMS[0];
      const anchor = `item-${item.id}`;
      for (const view of ['slots', 'list'] as const) {
        await open(page, `${systemPath(locale, system.id)}?view=${view}#${anchor}`);
        const root = itemsList(page);
        await listReady(page, root);
        const trigger =
          view === 'slots'
            ? root.locator(`#${anchor} button`).first()
            : root.locator(`#${anchor} .ac-list-row__name button`).first();
        await expect(trigger, `${view}: the trigger of #${anchor} holds the focus`).toBeFocused();
        await expect(page.locator(`#${anchor}`)).toBeInViewport();
      }
      await forgetView(page);
    });
  }
});

test.describe('Índice de búsqueda: los grupos Sistemas e Ítems (8.6, E16, BU6)', () => {
  for (const locale of LOCALES) {
    test(`${locale}: una entrada por página de sistema y por ítem de sistema con página`, async ({
      page,
    }) => {
      const response = await page.request.get(`/${locale}/buscar/indice.json`);
      expect(response.status()).toBe(200);
      const entries = (await response.json()) as SearchEntry[];

      // `sistema`: each system page, in the order of the menu, its subtitle as `meta`.
      const systems = entries.filter((entry) => entry.kind === 'sistema');
      expect(systems.map((entry) => entry.id)).toEqual(SYSTEMS.map((system) => system.id));
      for (const entry of systems) {
        const system = SYSTEM_BY_ID.get(entry.id) as Sistema;
        expect.soft(entry.name).toBe(system.titulo[locale]);
        expect.soft(entry.href).toBe(systemPath(locale, system.id));
        expect.soft(entry.meta, `${entry.id}: its subtitle (8.6)`).toBe(system.subtitulo?.[locale]);
      }

      // `item`: each system item whose page exists, pointing at its entry (E16, H7).
      const items = entries.filter(
        (entry) => entry.kind === 'item' && entry.href.includes('/sistemas/'),
      );
      expect(items.map((entry) => entry.id)).toEqual(LISTED_ITEMS.map(({ item }) => item.id));
      for (const [index, entry] of items.entries()) {
        const { item, system } = LISTED_ITEMS[index];
        expect.soft(entry.name).toBe(item.nombre);
        expect.soft(entry.href).toBe(`${systemPath(locale, system.id)}#item-${item.id}`);
        expect
          .soft(entry.meta, `${entry.id}: the title of its system (8.6)`)
          .toBe(system.titulo[locale]);
      }

      // `pagina`: the systems index joins with its route, named as its h1.
      const index = entries.find((entry) => entry.kind === 'pagina' && entry.id === 'sistemas');
      expect(index?.href).toBe(indexPath(locale));
      expect(index?.name).toBe(MESSAGES[locale].systems.title);

      // BU6: every href answers, and the fragment of an item names an element of its page.
      for (const entry of [...systems, ...items, ...(index ? [index] : [])]) {
        const [path, fragment] = entry.href.split('#');
        const answer = await page.request.get(path, { maxRedirects: 0 });
        expect.soft(answer.status(), `BU6: ${entry.href}`).toBe(200);
        if (fragment !== undefined) {
          expect
            .soft(await answer.text(), `BU6: #${fragment} on ${path}`)
            .toContain(`id="${fragment}"`);
        }
      }
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

      test(`el índice y las páginas de sistema a ${size.width}`, async ({ page }) => {
        test.setTimeout(120_000);
        await open(page, indexPath('es'));
        await expectFrame(page, size.width, false, '/es/sistemas/');
        for (const system of SYSTEMS) {
          const path = systemPath('es', system.id);
          await open(page, path);
          await expectFrame(page, size.width, sectionsOf(system, 'es').length >= 2, path);
          // 8.4.2 «tablas con scroll», DS:DataTable «No hacer»: a table of one-line cells keeps
          // its rows of 40 (48 with a sprite column, plus the 1 px divider) at every width and
          // scrolls inside its border instead of breaking a cell in two.
          const tables = await page
            .locator('main > section.ac-section:not(#items) .ac-data-table')
            .evaluateAll((elements) =>
              elements
                .filter((element) => !element.classList.contains('ac-data-table--wrap'))
                .map((element) => ({
                  row: element.classList.contains('ac-data-table--rows-48') ? 48 : 40,
                  heights: [...element.querySelectorAll('tbody tr')].map((row) =>
                    Math.round(row.getBoundingClientRect().height),
                  ),
                })),
            );
          for (const table of tables) {
            for (const height of table.heights) {
              expect
                .soft(height, `${path}: a row of a one-line table at ${size.width}`)
                .toBeLessThanOrEqual(table.row + 1);
            }
          }
          if (itemsOf(system).length === 0) continue;
          // The three views of the items list stay inside the column; a table scrolls inside
          // its border (DataTable `scroll`).
          const root = itemsList(page);
          await listReady(page, root);
          for (const view of ['slots', 'list', 'cards'] as ViewName[]) {
            await chooseView(root, 'es', view);
            const frame = await readFrame(page);
            expect
              .soft(frame.scrollWidth, `${path} ${view}: no sideways scroll`)
              .toBeLessThanOrEqual(size.width);
          }
          await forgetView(page);
        }
      });
    });
  }
});

test.describe('WG5: cada enlace interno responde 200', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('el índice y cada página de sistema, en los dos idiomas', async ({ page }) => {
    test.setTimeout(240_000);
    const resolved = new Map<string, number>();
    for (const locale of LOCALES) {
      for (const path of [indexPath(locale), ...SYSTEMS.map((s) => systemPath(locale, s.id))]) {
        await open(page, path);
        const { hrefs, nowhere, fragments } = await page.evaluate(() => {
          for (const group of document.querySelectorAll('details')) group.open = true;
          const anchors = [...document.querySelectorAll('a[href]')];
          const hrefOf = (anchor: Element) => (anchor.getAttribute('href') ?? '').trim();
          return {
            hrefs: anchors
              .map(hrefOf)
              .filter((href) => href.startsWith('/') && !href.startsWith('//')),
            nowhere: anchors.filter((anchor) => ['', '#'].includes(hrefOf(anchor))).length,
            // An anchor of the same page names one of its elements (8.4 `ancla`).
            fragments: anchors
              .map(hrefOf)
              .filter((href) => href.startsWith('#') && href.length > 1)
              .filter((href) => document.getElementById(href.slice(1)) === null),
          };
        });
        expect.soft(nowhere, `${path}: no href="#" or href="" (WG5)`).toBe(0);
        expect.soft(fragments, `${path}: every #anchor names an element`).toEqual([]);
        const broken: string[] = [];
        for (const href of [...new Set(hrefs.map((href) => href.split('#')[0]))]) {
          let status = resolved.get(href);
          if (status === undefined) {
            status = (await page.request.get(href, { maxRedirects: 0 })).status();
            resolved.set(href, status);
          }
          if (status !== 200 && status !== 302) broken.push(`${href} → ${status}`);
        }
        expect.soft(broken, `${path}: every internal link answers (WG5)`).toEqual([]);
      }
    }
  });
});

test.describe('WA1: axe con un panel abierto y con la hoja móvil', () => {
  for (const locale of LOCALES) {
    test.describe(`${locale} a 1440`, () => {
      test.use({ viewport: { width: 1440, height: 900 } });

      test(`${locale}: el índice, con el panel de un sistema abierto`, async ({ page }) => {
        await open(page, indexPath(locale));
        await expectAxeClean(page, indexPath(locale));
        const tip = page.locator('.ac-index-links [data-ac-tt] a').first();
        if ((await tip.count()) === 0) return;
        await hoverPanel(page, tip);
        await expectAxeClean(page, `${indexPath(locale)} with a panel open`);
      });

      test(`${locale}: cada página de sistema, y un panel de la lista de ítems`, async ({
        page,
      }) => {
        test.setTimeout(240_000);
        for (const system of SYSTEMS) {
          const path = systemPath(locale, system.id);
          await open(page, path);
          await expectAxeClean(page, path);
          const mention = page.locator('main > section.ac-section [data-ac-tt] :is(a, button)');
          if ((await mention.count()) > 0) {
            await hoverPanel(page, mention.first());
            await expectAxeClean(page, `${path} with a mention open`);
            await page.keyboard.press('Escape');
          }
          if (itemsOf(system).length === 0) continue;
          const root = itemsList(page);
          await listReady(page, root);
          for (const view of ['slots', 'list'] as ViewName[]) {
            await chooseView(root, locale, view);
            await expectAxeClean(page, `${path}?view=${view}`);
            await hoverPanel(page, root.locator('[data-ac-tt] button').first());
            await expectAxeClean(page, `${path}?view=${view} with a panel open`);
            await page.keyboard.press('Escape');
          }
          await forgetView(page);
        }
      });
    });

    test.describe(`${locale} a 390`, () => {
      test.use({ viewport: { width: 390, height: 844 } });

      test(`${locale}: el índice y una página de sistema con la hoja móvil abierta`, async ({
        page,
      }) => {
        const paths = [indexPath(locale), ...(RAILED ? [systemPath(locale, RAILED.id)] : [])];
        for (const path of paths) {
          await open(page, path);
          await expectAxeClean(page, `${path} at 390`);
          await page.locator('[aria-controls="menu-movil"]').first().click();
          await expect(page.locator('dialog#menu-movil')).toBeVisible();
          await expectAxeClean(page, `${path} with the phone sheet open`);
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
    test(`${locale}: el índice`, async ({ page }) => {
      await open(page, indexPath(locale));
      await expectStructure(page, locale, indexPath(locale));
      // WA3: the index is no entry of the menu, so no entry is current (8.0.3).
      await expect(page.locator('.ac-page-layout__sidebar [aria-current]')).toHaveCount(0);
    });

    test(`${locale}: cada página de sistema`, async ({ page }) => {
      test.setTimeout(180_000);
      for (const system of SYSTEMS) {
        const path = systemPath(locale, system.id);
        await open(page, path);
        await expectStructure(page, locale, path);
        // WA3: the menu entry of the route is the current page, and its group starts open.
        // The entry is the one of its group: the pinned «Destacados» may link the page too
        // (E10, M10).
        const entry = page.locator(`.ac-page-layout__sidebar details a[href="${path}"]`);
        await expect.soft(entry).toHaveAttribute('aria-current', 'page');
        await expect
          .soft(page.locator('.ac-page-layout__sidebar [aria-current]'), `${path}: one current`)
          .toHaveCount(1);
        await expect
          .soft(
            page
              .locator('.ac-page-layout__sidebar details.ac-sidebar__group')
              .filter({ has: page.locator(`a[href="${path}"]`) }),
            `${path}: the Sistemas group starts open`,
          )
          .toHaveAttribute('open', '');
        // WA3: the Toc marks where the reader is with aria-current="location".
        if (sectionsOf(system, locale).length >= 2) {
          await expect.soft(page.locator('aside.ac-toc [aria-current="location"]')).toHaveCount(1);
        }
        // WA4 with the data: a description that only exists in English carries its lang in es
        // (T22, Y-08), and nothing is marked in en.
        const items = itemsOf(system);
        if (items.length === 0) continue;
        const root = itemsList(page);
        await listReady(page, root);
        for (const item of items) {
          if (item.descripcion === null) continue;
          const marked = root.locator('[lang="en"]', { hasText: item.descripcion });
          if (locale === 'es') await expect.soft(marked).not.toHaveCount(0);
          else await expect.soft(root.locator('[lang]')).toHaveCount(0);
        }
      }
    });
  }
});

test.describe('WL1: sin relleno (§12.10, B-04)', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const locale of LOCALES) {
    test(`${locale}: el índice y cada página de sistema`, async ({ page }) => {
      test.setTimeout(180_000);
      await open(page, indexPath(locale));
      await expectNoRemovedText(page, locale, indexPath(locale));
      // Y-06: no count without its label on the index.
      const found = await harvest(page);
      expect(
        found.texts.filter((text) => /^\d+$/.test(text)),
        'no bare count (Y-06)',
      ).toEqual([]);
      // Y-01: the description of 13.5 replaces the old one.
      await expect(page.locator('meta[name="description"]')).toHaveAttribute(
        'content',
        MESSAGES[locale].systems.description,
      );

      for (const system of SYSTEMS) {
        const path = systemPath(locale, system.id);
        await open(page, path);
        await expectNoRemovedText(page, locale, path);
        // Y-04: the items section is «Ítems» / «Items».
        if (itemsOf(system).length > 0) {
          await expect(page.locator('section#items h2')).toHaveText(MESSAGES[locale].systems.items);
        }
      }
    });
  }
});
