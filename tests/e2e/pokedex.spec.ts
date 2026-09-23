// §8.2 and §8.3 acceptance (M7): the Pokédex index (`/{l}/pokedex/`, `Lienzo:Pokedex`) and the
// Pokémon page (`/{l}/pokedex/{id}/`, `Lienzo:Pokedex-Shiny-Charizard`) against the real
// pages, over the registries the development server reads.
//
// What it measures, by the ids of the spec:
//
//  - PX1 to PX5 (§8.2) and FI1 to FI5 (§8.3). PX5 starts on the Pokédex panel of the Home
//    page, which M10 builds: here it measures the half this milestone owns, that
//    `?elemento=fire` arrives with «Fuego» chosen in «Elemento».
//  - The protocol of §8.0.7 on both pages: WG1 (the frame of §5.5 at 1440 and 390, no
//    sideways scroll at 390), WG4 (the grid columns of `CGS §4` at the five widths of
//    `DS:guias/30`), WG5 (every internal link answers 200), WA1 (axe with a tooltip open
//    and with the phone sheet open), WA2 (one h1, no skipped heading level, named
//    landmarks, a caption on every table), WA3 (`aria-pressed` on every toggle and the
//    `aria-current` of the menu and of the pagination), WA4 (`lang` of a text in the other
//    language), WL1 (the rows of §12.7 and §12.8) and WD1 (every figure and count is the one
//    the registry gives).
//  - The fixed sample of Pokémon pages of §14.4 (`POKEMON_SAMPLE` of ./routes.ts): each one
//    answers 200, has one h1 and passes axe, in both locales.
//  - S19 with the data: every expectation below is computed from `content/` when the spec
//    loads, never copied from a board (X4), so changing a test record changes the figure the
//    spec expects. Run with `OCULTAR_BORRADORES=1` and no server on 4321 — Playwright passes
//    its environment to the server it starts — and the spec expects no `borrador` record on
//    either page; without it, the drafts are shown like any other record (§8.0.5):
//
//      OCULTAR_BORRADORES=1 pnpm exec playwright test --project=desktop tests/e2e/pokedex.spec.ts
//
// The list controller itself (U1–U6, H1–H7, V1–V8, PR1–PR5) is tests/e2e/lists.spec.ts; the
// crops against the boards are the `pokedex` and `ficha` cases of tests/visual/manifest.json.
//
// Runs in the `desktop` project. The 390 checks are viewport overrides of this spec, as in
// tests/e2e/frame.spec.ts, with a touch-free pointer: the touch target sizes are
// contract.spec.ts's.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import AxeBuilder from '@axe-core/playwright';
import type { Locator, Page } from '@playwright/test';

import { en } from '../../src/i18n/messages/en';
import type { Messages } from '../../src/i18n/messages/en';
import { es } from '../../src/i18n/messages/es';
import { idiomas } from '../../scripts/lib/rutas-migradas.mjs';
import { expect, test } from './fixtures';
import { POKEMON_SAMPLE, pokedexEmptyQuery } from './routes';

// ------------------------------------------------------------------------------ registries

type Locale = 'es' | 'en';
type Localized = Record<Locale, string>;

interface EnlaceDato {
  texto: string;
  ref?: { tipo: string; id: string };
}

/** A record of `content/pokemon.json`, with the optional fields of §3.13. */
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
  imagen: string | null;
  hp?: number | null;
  experiencia?: number | null;
  drops?: { item: string; cantidad: { min: number; max: number } | null }[];
  evolucion?: { a: string; nivel: number | null; items: { item: string; cantidad: number }[] }[];
  habilidades?: string[];
  donde?: { hunts: EnlaceDato[]; linkedTasks: EnlaceDato[]; equiposNpc: EnlaceDato[] };
  elementoMoveset?: string | null;
}

interface ElementRecord {
  id: string;
  nombre: Localized;
}

interface MoveRecord {
  id: string;
  nombre: string;
  elemento: string | null;
  slot: string | null;
  cooldownSegundos: number | null;
  pokemon: string[];
}

interface Draftable {
  borrador?: boolean;
}

interface AuraRecord extends Draftable {
  id: string;
  nombre: string;
}

interface OutfitRecord extends Draftable {
  pokemon: string;
  outfitId: number;
}

interface ItemRecord extends Draftable {
  id: string;
  nombre: string;
  uso?: Partial<Localized> | null;
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

const POKEMON = readJson<{ pokemon: PokemonRecord[] }>('content/pokemon.json').pokemon;
const BY_ID = new Map(POKEMON.map((record) => [record.id, record]));
const ELEMENTS = readJson<{ elementos: ElementRecord[] }>('content/elementos.json').elementos;
const ELEMENT_BY_ID = new Map(ELEMENTS.map((element) => [element.id, element]));
const MOVES = readJson<{ movimientos: MoveRecord[] }>('content/moves.json').movimientos;
const ALL_AURAS = readJson<{ auras: AuraRecord[] }>('content/auras.json').auras;
const AURAS = shown(ALL_AURAS);
const OUTFITS = shown(readJson<{ outfits: OutfitRecord[] }>('content/outfits.json').outfits);
const SPRITE_KEYS = new Set(
  Object.keys(
    readJson<{ sprites: Record<string, unknown> }>('public/sprites/sprites.json').sprites,
  ),
);
const ALL_ITEMS = readdirSync(resolve(ROOT, 'content/items'))
  .filter((file) => file.endsWith('.json') && file !== 'categorias.json')
  .flatMap((file) => readJson<{ items: ItemRecord[] }>(`content/items/${file}`).items);
const ITEMS = new Map(shown(ALL_ITEMS).map((item) => [item.id, item]));

/** S19: the names a build with `OCULTAR_BORRADORES=1` must not show anywhere. */
const DRAFT_NAMES = [...ALL_ITEMS, ...ALL_AURAS]
  .filter((record) => record.borrador === true)
  .map((record) => record.nombre);

/** V7: filters no record matches, from the registry (a value it lacks falls back, U4). */
const EMPTY_QUERY = pokedexEmptyQuery();

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

/** `formatTier` of src/lib/content/format.ts: 3 → «T3», «Legendary» as it is. */
function tierText(tier: number | string): string {
  return typeof tier === 'number' ? `T${tier}` : tier;
}

/** The URL id of a tier (8.0.6, U3): 3 → `t3`, «Super Rare» → `super-rare`. */
function tierId(tier: number | string | null): string | null {
  if (tier === null) return null;
  return typeof tier === 'number' ? `t${tier}` : tier.toLowerCase().replace(/\s+/g, '-');
}

function elementName(id: string, locale: Locale): string | null {
  return ELEMENT_BY_ID.get(id)?.nombre[locale] ?? null;
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

/** 8.0.6: 12 rows a page of the Pokédex. */
const PAGE_SIZE = 12;

type PokedexFilters = { gen?: string; tier?: string; elemento?: string; variante?: string };

/** The URL order of the filters (U1, src/components/pokedex/config.ts). */
const FILTER_KEYS = ['gen', 'tier', 'elemento', 'variante'] as const;

function matches(record: PokemonRecord, filters: PokedexFilters): boolean {
  if (filters.gen !== undefined && record.generacion !== Number(filters.gen)) return false;
  if (filters.tier !== undefined && tierId(record.tier) !== filters.tier) return false;
  if (filters.elemento !== undefined && !record.elementos.includes(filters.elemento)) return false;
  if (filters.variante !== undefined && record.variante !== filters.variante) return false;
  return true;
}

function query(filters: PokedexFilters, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    const value = filters[key];
    if (value !== undefined) params.set(key, value);
  }
  for (const [key, value] of Object.entries(extra)) params.set(key, value);
  const text = params.toString();
  return text === '' ? '' : `?${text}`;
}

/** 8.2 step 4: the count follows Variante; `n` is the filtered total. */
function countFor(locale: Locale, n: number, variante: string | undefined): string {
  const copy = MESSAGES[locale].pokedex;
  if (variante === 'shiny') return counted(copy.countShiny, n, locale);
  if (variante === 'normal') return counted(copy.countNormal, n, locale);
  return counted(copy.count, n, locale);
}

// ------------------------------------------------------------------ the Pokémon page, computed

const pokemonPath = (locale: Locale, id: string) => `/${locale}/pokedex/${id}/`;

function outfitOf(id: string): OutfitRecord | null {
  const outfit = OUTFITS.find((entry) => entry.pokemon === id);
  return outfit !== undefined && SPRITE_KEYS.has(`outfits/${outfit.outfitId}`) ? outfit : null;
}

/** «Tier list» (8.3, E15): the evolution line with its variants, or the records of one `numero`. */
function familyOf(record: PokemonRecord): PokemonRecord[] {
  const parents = new Map<string, PokemonRecord[]>();
  for (const entry of POKEMON) {
    for (const evolution of entry.evolucion ?? []) {
      parents.set(evolution.a, [...(parents.get(evolution.a) ?? []), entry]);
    }
  }
  const family = new Set<PokemonRecord>([record]);
  const queue = [record];
  for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
    const current = next;
    const neighbours = [
      ...(current.evolucion ?? []).flatMap((evolution) => BY_ID.get(evolution.a) ?? []),
      ...(parents.get(current.id) ?? []),
      ...POKEMON.filter((entry) => current.numero !== null && entry.numero === current.numero),
    ];
    for (const neighbour of neighbours) {
      if (family.has(neighbour)) continue;
      family.add(neighbour);
      queue.push(neighbour);
    }
  }
  return [...family];
}

function movesOf(record: PokemonRecord): MoveRecord[] {
  const collator = new Intl.Collator('es', { numeric: true });
  return MOVES.filter((move) => move.pokemon.includes(record.id)).sort((a, b) => {
    if (a.slot === b.slot) return 0;
    if (a.slot === null) return 1;
    if (b.slot === null) return -1;
    return collator.compare(a.slot, b.slot);
  });
}

type SectionId = 'drops' | 'tier-list' | 'evolucion' | 'ataques' | 'donde';

/** 8.3 step 4: the sections a record has data for, in page order. */
function sectionsOf(record: PokemonRecord): SectionId[] {
  const evolves =
    (record.evolucion ?? []).some((evolution) => BY_ID.has(evolution.a)) ||
    POKEMON.some((entry) => (entry.evolucion ?? []).some((evolution) => evolution.a === record.id));
  const where = record.donde;
  const sections: [SectionId, boolean][] = [
    ['drops', (record.drops ?? []).some((drop) => ITEMS.has(drop.item))],
    ['tier-list', familyOf(record).length > 1],
    ['evolucion', evolves],
    ['ataques', movesOf(record).length > 0 || (record.habilidades ?? []).some((a) => a !== '')],
    [
      'donde',
      where !== undefined &&
        where.hunts.length + where.linkedTasks.length + where.equiposNpc.length > 0,
    ],
  ];
  return sections.filter(([, present]) => present).map(([id]) => id);
}

/** 8.3 step 3 and FI3: the rows of the fixed sheet, in order and only with a value. */
function sheetRows(record: PokemonRecord, locale: Locale): [string, string][] {
  const { ui, pokemon } = MESSAGES[locale];
  const labels = ui.tooltip;
  const names = record.elementos.flatMap((id) => elementName(id, locale) ?? []);
  const rows: [string, string | null][] = [
    [
      labels.requirement,
      record.nivel === null ? null : fill(labels.level, { n: figure(record.nivel, locale) }),
    ],
    [labels.tier, record.tier === null ? null : tierText(record.tier)],
    [labels.elements, names.length > 0 ? names.join(' / ') : null],
    [labels.role, record.funcion],
    [pokemon.hp, record.hp == null ? null : figure(record.hp, locale)],
    [pokemon.experience, record.experiencia == null ? null : figure(record.experiencia, locale)],
    [labels.generation, record.generacion === null ? null : String(record.generacion)],
  ];
  return rows.flatMap(([label, value]) => (value === null ? [] : [[`${label}:`, value]]));
}

/** The Pokémon pages this spec opens: the fixed sample of §14.4 and the three of FI2. */
const FICHAS = [...new Set([...POKEMON_SAMPLE, 'articuno', 'charizard', 'chimchar'])].filter((id) =>
  BY_ID.has(id),
);

// --------------------------------------------------------------------------- page helpers

/** The dev server compiles a page on its first request: the first hydration may be slow. */
const READY_TIMEOUT = 30_000;

type ViewName = 'cards' | 'slots' | 'list';

const VIEW_ATTRIBUTE: Record<ViewName, string> = {
  cards: 'data-card-grid',
  slots: 'data-slots',
  list: 'data-list',
};

function listRoot(page: Page, id: string): Locator {
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

async function openPokedex(page: Page, locale: Locale, search = ''): Promise<Locator> {
  const response = await page.goto(`/${locale}/pokedex/${search}`);
  expect(response?.status(), `/${locale}/pokedex/${search} answers 200`).toBe(200);
  const root = listRoot(page, 'pokedex');
  await listReady(page, root);
  return root;
}

async function openPokemon(page: Page, locale: Locale, id: string): Promise<void> {
  const path = pokemonPath(locale, id);
  const response = await page.goto(path);
  expect(response?.status(), `${path} answers 200 (§14.4)`).toBe(200);
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

/** The ids of the Pokémon the Cards view shows, from the links of their titles. */
async function cardIds(root: Locator): Promise<string[]> {
  return root
    .locator('[data-card-grid] article .ac-card__title a[href]')
    .evaluateAll((links) =>
      links.map((link) => (link.getAttribute('href') ?? '').split('/').filter(Boolean).pop() ?? ''),
    );
}

async function forgetViews(page: Page): Promise<void> {
  await page.evaluate(() => {
    try {
      for (const key of ['ac:vista:pokedex', 'ac:vista:familia', 'ac:vista:drops']) {
        window.localStorage.removeItem(key);
      }
    } catch {
      // U6: storage may be blocked; nothing was saved then.
    }
  });
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

/**
 * The rows of a table as their cells read, without the panel a nested entity carries
 * next to its trigger (7.5.1): «Charizard», not «Charizard Charizard Requisito: …».
 */
async function tableRows(table: Locator): Promise<string[][]> {
  return table.locator('tbody tr').evaluateAll((rows) =>
    rows.map((row) =>
      [...row.querySelectorAll(':scope > td, :scope > th')].map((cell) => {
        const copy = cell.cloneNode(true) as Element;
        for (const panel of copy.querySelectorAll('[role="tooltip"]')) panel.remove();
        return (copy.textContent ?? '').replace(/\s+/g, ' ').trim();
      }),
    ),
  );
}

/** Text of the sheet rows (`GameTooltip variant="sheet"`), as label and value pairs. */
async function sheetOf(page: Page, name: string, locale: Locale): Promise<Locator> {
  const sheet = page.locator(
    `[role="group"][aria-label="${fill(MESSAGES[locale].ui.sheet, { name })}"]`,
  );
  await expect(sheet, `8.3: the fixed sheet of ${name}`).toHaveCount(1);
  return sheet;
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
      scrollX: window.scrollX,
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
  // The frame is measured from the top of the document: a list that became ready may have
  // scrolled into view.
  await page.evaluate(() => window.scrollTo(0, 0));
  const frame = await readFrame(page);
  const [x, w] = MAIN_COLUMN[width][railed ? 'rail' : 'spacer'];
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
    const side = railed ? frame.rail : frame.spacer;
    expect.soft(side?.shown ?? false, `${label}: ${railed ? 'Toc rail' : 'spacer'}`).toBe(true);
  } else {
    expect.soft(frame.sidebar?.shown ?? false, `${label}: no sidebar below 1280`).toBe(false);
  }
  expect
    .soft(frame.scrollWidth, `${label}: documentElement.scrollWidth ≤ ${width} (WG1)`)
    .toBeLessThanOrEqual(width);
}

type GridFamily = 'pokedex' | 'loot';

/** CGS §4: min card, columns and the phone gap of each family this milestone draws. */
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
      x: rect.x,
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

/** §12.7, rows BORRAR of `IDX` and `GRID`, with their «Actual» text. */
const REMOVED_INDEX: Record<Locale, Rule[]> = {
  es: [
    'Archivo de campo',
    'Encuentra una especie, reconoce su variante y abre su ficha.',
    /^Registro PokeAlliance/,
    'Buscar por nombre, número, tipo o rol',
    'Filtros de la Pokédex',
    'Todas las variantes',
    'Todas las generaciones',
    'Todos los tipos',
    'Número Pokédex',
    /Pokémon encontrados$/,
    'Mostrar más Pokémon',
    /^Abrir ficha de /,
    /^Outfit #\d+$/,
    /^#\d{3}$/,
    /✦/,
    /^\d+ \/ \d+$/,
  ],
  en: [
    'Field archive',
    /^PokeAlliance record/,
    'Search by name, number, type or role',
    'Pokédex filters',
    'All variants',
    'All generations',
    'All types',
    'Pokédex number',
    /Pokémon found$/,
    'Show more Pokémon',
    /^Open record for /,
    /^Outfit #\d+$/,
    /^#\d{3}$/,
    /✦/,
    /^\d+ \/ \d+$/,
  ],
};

/** §12.8, rows BORRAR of `DET` and `OUT`, with their «Actual» text. */
const REMOVED_POKEMON: Record<Locale, Rule[]> = {
  es: [
    'Volver a la Pokédex',
    /^Outfit del juego/,
    'La aura no está disponible en este navegador.',
    /, sprite de PokeAlliance$/,
    / · south$/,
    'Sin aura',
    /^#\d{3}$/,
    /^[←→✦]$/,
  ],
  en: ['Back to Pokédex', /, PokeAlliance sprite$/, / · south$/, /^#\d{3}$/, /^[←→✦]$/],
};

async function expectNoRemovedText(page: Page, rules: Rule[], label: string): Promise<void> {
  const found = await harvest(page);
  expect
    .soft(
      rules.flatMap((rule) => hits(found, rule)),
      `${label}: no text of a BORRAR row of §12 (WL1)`,
    )
    .toEqual([]);
  // P-06: no `<section aria-label="Pokédex">` repeating the h1. The name stays where it is a
  // name: the h1, the crumb, the menu entry and the Slots panel of the list (DS:SlotsPanel).
  expect
    .soft(await page.locator('section[aria-label="Pokédex"]').count(), `${label}: P-06`)
    .toBe(0);
  // D-08: no inline `onerror` on an image.
  expect.soft(await page.locator('img[onerror]').count(), `${label}: D-08`).toBe(0);
  // S7: no lucide icon outside the utility glyphs, which carry the bare `lucide` class.
  const lucide = await page.locator('svg[class*="lucide-"]').count();
  expect.soft(lucide, `${label}: no lucide icon outside Glyph (WL1, S7)`).toBe(0);
}

// ================================================================================ tests

test.describe('Pokédex (8.2)', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const locale of LOCALES) {
    test(`${locale}: migas, título, filtros, barra y paginación (8.2 pasos 1 a 6, WD1)`, async ({
      page,
    }) => {
      const { ui, pokedex } = MESSAGES[locale];
      const root = await openPokedex(page, locale);

      // 1. «Pokémon › Pokédex»: the group is text, the page is the current crumb (8.0.4).
      const crumbs = page.locator('nav.ac-breadcrumb .ac-breadcrumb__item');
      await expect(crumbs).toHaveText(['Pokémon', 'Pokédex']);
      await expect(crumbs.nth(0).locator('a')).toHaveCount(0);
      await expect(crumbs.nth(1).locator('[aria-current="page"]')).toHaveText('Pokédex');

      // 2. «Pokédex» without a subtitle.
      await expect(page.locator('h1')).toHaveText('Pokédex');
      await expect(page.locator('.ac-page-title__sub')).toHaveCount(0);

      // 3. FilterBar: the four filters of the board, in order, and no search field (E3, A22).
      const selects = root.locator('[data-ac-select]');
      await expect(selects.locator('.ac-select__label')).toHaveText([
        pokedex.filters.generation,
        pokedex.filters.tier,
        pokedex.filters.element,
      ]);
      await expect(selects.locator('[role="combobox"]')).toHaveText([
        pokedex.filters.allGenerations,
        pokedex.filters.allTiers,
        pokedex.filters.allElements,
      ]);
      const variant = root.locator('.ac-filter-bar .ac-toggle-group');
      await expect(variant).toContainText(pokedex.filters.variant);
      await expect(variant.getByRole('button')).toHaveText([
        pokedex.filters.allVariants,
        ui.cards.normal,
        ui.shiny,
      ]);
      await expect(variant.getByRole('button').first()).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('main input, main [role="search"]')).toHaveCount(0);

      // The options of each select: every value the registry has, in the order of 8.2.
      const generations = [...new Set(POKEMON.flatMap((r) => r.generacion ?? []))].sort(
        (a, b) => a - b,
      );
      await expect(selects.nth(0).locator('[role="option"]')).toHaveText([
        pokedex.filters.allGenerations,
        ...generations.map((n) => fill(ui.cards.generation, { n: String(n) })),
      ]);
      const elementOptions = ELEMENTS.map((element) => element.nombre[locale]);
      await expect(selects.nth(2).locator('[role="option"]')).toHaveText([
        pokedex.filters.allElements,
        ...elementOptions,
      ]);
      const numbered = [
        ...new Set(POKEMON.flatMap((r) => (typeof r.tier === 'number' ? [r.tier] : []))),
      ]
        .sort((a, b) => a - b)
        .map((tier) => tierText(tier));
      const tierOptions = await selects.nth(1).locator('[role="option"]').allTextContents();
      expect(tierOptions.slice(0, numbered.length + 1).map((text) => text.trim())).toEqual([
        pokedex.filters.allTiers,
        ...numbered,
      ]);

      // 4. The count of the whole registry (WD1) and the view toggle, Cards pressed.
      await expect(countOf(root)).toHaveText(countFor(locale, POKEMON.length, undefined));
      await expect(viewButton(root, locale, 'cards')).toHaveAttribute('aria-pressed', 'true');

      // 5. The first page: 12 cards in the Pokémon order of 8.0.5.
      const first = [...POKEMON].sort(pokemonOrder(locale)).slice(0, PAGE_SIZE);
      expect(await cardIds(root)).toEqual(first.map((record) => record.id));

      // 6. Pagination, centred, as many pages as the registry fills (WD1).
      expect(await pageCountOf(root)).toBe(Math.ceil(POKEMON.length / PAGE_SIZE));
      await expect(root.locator('.ac-pagination__nav')).toHaveAttribute(
        'aria-label',
        ui.pagination,
      );
      await expect(root.locator('.ac-pagination [aria-current="page"]')).toHaveText('1');
    });

    test(`${locale}: el conteo y las páginas siguen a Variante (8.2 paso 4, WD1)`, async ({
      page,
    }) => {
      for (const variante of [undefined, 'normal', 'shiny']) {
        const filters: PokedexFilters = variante === undefined ? {} : { variante };
        const expected = POKEMON.filter((record) => matches(record, filters));
        const root = await openPokedex(page, locale, query(filters));
        await expect(countOf(root)).toHaveText(countFor(locale, expected.length, variante));
        expect(await pageCountOf(root), `pages for ${variante ?? 'all'}`).toBe(
          Math.max(1, Math.ceil(expected.length / PAGE_SIZE)),
        );
        const ids = await cardIds(root);
        expect(ids.every((id) => matches(BY_ID.get(id) as PokemonRecord, filters))).toBe(true);
      }
    });
  }

  test('PX1: ?elemento=fire&variante=shiny muestra solo Shiny con Fuego', async ({ page }) => {
    const filters: PokedexFilters = { elemento: 'fire', variante: 'shiny' };
    const expected = POKEMON.filter((record) => matches(record, filters));
    for (const locale of LOCALES) {
      const root = await openPokedex(page, locale, '?elemento=fire&variante=shiny');
      await expect(countOf(root)).toHaveText(countFor(locale, expected.length, 'shiny'));
      const ids = await cardIds(root);
      expect(ids).toHaveLength(Math.min(PAGE_SIZE, expected.length));
      expect(ids.every((id) => matches(BY_ID.get(id) as PokemonRecord, filters))).toBe(true);
      expect(await pageCountOf(root)).toBe(Math.max(1, Math.ceil(expected.length / PAGE_SIZE)));
      // U3: the same ids serve both locales, and the controls show them chosen.
      await expect(root.locator('[data-ac-select] [role="combobox"]').nth(2)).toHaveText(
        elementName('fire', locale) ?? 'fire',
      );
      await expect(
        root
          .locator('.ac-filter-bar .ac-toggle-group')
          .getByRole('button', { name: MESSAGES[locale].ui.shiny }),
      ).toHaveAttribute('aria-pressed', 'true');
    }
  });

  test('PX2: con dos páginas de resultados, ?page=9 muestra la 2 y reescribe la URL', async ({
    page,
  }) => {
    // The filter of the registry closest to the 13 results of the spec that fills two pages.
    const candidates: PokedexFilters[] = [];
    const generations = [...new Set(POKEMON.flatMap((r) => r.generacion ?? []))];
    const tiers = [...new Set(POKEMON.flatMap((r) => tierId(r.tier) ?? []))];
    for (const variante of ['normal', 'shiny', undefined]) {
      for (const gen of generations) candidates.push({ gen: String(gen), variante });
      for (const tier of tiers) candidates.push({ tier, variante });
      for (const element of ELEMENTS) candidates.push({ elemento: element.id, variante });
      for (const gen of generations) {
        for (const tier of tiers) candidates.push({ gen: String(gen), tier, variante });
      }
    }
    const scored = candidates
      .map((filters) => ({
        filters: Object.fromEntries(
          Object.entries(filters).filter(([, value]) => value !== undefined),
        ) as PokedexFilters,
        n: POKEMON.filter((record) => matches(record, filters)).length,
      }))
      .filter(({ n }) => n > PAGE_SIZE && n <= 2 * PAGE_SIZE)
      .sort((a, b) => a.n - b.n);
    expect(scored.length, 'the registry has a filter that fills two pages').toBeGreaterThan(0);
    const { filters, n } = scored[0];

    const root = await openPokedex(page, 'es', query(filters, { page: '9' }));
    await expect(root.locator('.ac-pagination [aria-current="page"]')).toHaveText('2');
    await expect.poll(() => new URL(page.url()).searchParams.get('page')).toBe('2');
    const params = new URL(page.url()).searchParams;
    for (const key of FILTER_KEYS) expect(params.get(key)).toBe(filters[key] ?? null);
    expect(await pageCountOf(root)).toBe(2);
    expect(await cardIds(root)).toHaveLength(n - PAGE_SIZE);
  });

  test('PX3: la vista Slots sobrevive a una recarga', async ({ page }) => {
    let root = await openPokedex(page, 'es');
    await forgetViews(page);
    await chooseView(root, 'es', 'slots');
    await page.goto('/es/pokedex/');
    root = listRoot(page, 'pokedex');
    await listReady(page, root);
    await expect(viewButton(root, 'es', 'slots')).toHaveAttribute('aria-pressed', 'true');
    await expect(root.locator('[data-slots]')).toHaveCount(1);
    await forgetViews(page);
  });

  test('PX4: la tecla «/» no hace nada y no hay tecla visible (A22)', async ({ page }) => {
    await openPokedex(page, 'es');
    await page.locator('h1').click();
    const before = await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 80));
    await page.keyboard.press('/');
    const after = await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 80));
    expect(after, 'no «/» shortcut moves the focus').toBe(before);
    const prevented = await page.evaluate(() => {
      const event = new KeyboardEvent('keydown', { key: '/', bubbles: true, cancelable: true });
      document.body.dispatchEvent(event);
      return event.defaultPrevented;
    });
    expect(prevented, 'no keydown listener takes «/»').toBe(false);
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    await expect(page.locator('kbd').filter({ hasText: /^\/$/ })).toHaveCount(0);
  });

  test('PX5 (destino): ?elemento=fire llega con «Fuego» en Elemento', async ({ page }) => {
    const root = await openPokedex(page, 'es', '?elemento=fire');
    await expect(root.locator('[data-ac-select] [role="combobox"]').nth(2)).toHaveText(
      elementName('fire', 'es') ?? 'fire',
    );
    const expected = POKEMON.filter((record) => record.elementos.includes('fire'));
    await expect(countOf(root)).toHaveText(countFor('es', expected.length, undefined));
  });

  test('V7: sin resultados, «0 variantes», el vacío y «Limpiar filtros»', async ({ page }) => {
    for (const locale of LOCALES) {
      const { pokedex } = MESSAGES[locale];
      const root = await openPokedex(page, locale, EMPTY_QUERY);
      await expect(countOf(root)).toHaveText(countFor(locale, 0, undefined));
      await expect(root.locator('.ac-empty-state__text')).toHaveText(pokedex.empty);
      const clear = root.getByRole('link', { name: pokedex.clearFilters, exact: true });
      await expect(clear).toHaveAttribute('href', `/${locale}/pokedex/`);
      await expect(page.getByText(pokedex.clearFilters, { exact: true })).toHaveCount(1);
      await expect(root.locator('.ac-pagination')).toHaveCount(0);
    }
  });

  test('Cards: títulos h2 con enlace a la ficha y «Nº · Generación» (8.2 paso 5)', async ({
    page,
  }) => {
    const root = await openPokedex(page, 'es');
    const first = [...POKEMON].sort(pokemonOrder('es'))[0];
    const card = root.locator('[data-card-grid] article').first();
    await expect(card.locator('h2')).toHaveText(first.nombre);
    await expect(card.locator('h2 a')).toHaveAttribute('href', pokemonPath('es', first.id));
    const meta = [
      first.numero === null ? null : fill(es.ui.cards.number, { n: String(first.numero) }),
      first.generacion === null
        ? null
        : fill(es.ui.cards.generation, { n: String(first.generacion) }),
    ].filter((part): part is string => part !== null);
    // The meta holds the text of both anatomies (C7-09); the normal one comes first.
    await expect(card.locator('.ac-card__meta')).toContainText(meta.join(' · '));
    // A card opens no tooltip (the three-view rule): only its nested entities do.
    await expect(card.locator(':scope > [data-ac-tt]')).toHaveCount(0);
  });

  test('Slots: grupos por generación, slots de 72 y el tooltip del tablero (8.2 paso 5)', async ({
    page,
  }) => {
    const root = await openPokedex(page, 'es', '?view=slots');
    const shownIds = [...POKEMON].sort(pokemonOrder('es')).slice(0, PAGE_SIZE);
    const groups = [...new Set(shownIds.map((r) => r.generacion))];
    const groupLabels = groups.map((g) =>
      g === null ? '—' : fill(es.ui.cards.generation, { n: String(g) }),
    );
    await expect(root.locator('.ac-slots-panel__label')).toHaveText(groupLabels);
    const slots = root.locator('.ac-entity-slot');
    await expect(slots).toHaveCount(shownIds.length);
    const box = await slots.first().boundingBox();
    expect(box?.width).toBeCloseTo(72, 0);
    expect(box?.height).toBeCloseTo(72, 0);

    // The panel of the first slot: «Requisito:», «Tier:», «Elementos:», «Generación:», «Rol:»,
    // in the order of `Lienzo:Pokedex` and only the rows with a value (T32).
    const panel = await openTooltip(page, root.locator('[data-slots]'));
    const record = shownIds[0];
    const labels = es.ui.tooltip;
    const rows: [string, boolean][] = [
      [labels.requirement, record.nivel !== null],
      [labels.tier, record.tier !== null],
      [labels.elements, record.elementos.some((id) => ELEMENT_BY_ID.has(id))],
      [labels.generation, record.generacion !== null],
      [labels.role, record.funcion !== null],
    ];
    await expect(panel.locator('.ac-game-tooltip__label')).toHaveText(
      rows.filter(([, present]) => present).map(([label]) => `${label}:`),
    );
    await expect(panel).not.toContainText('—');
    await page.keyboard.press('Escape');
    await expect(page.locator('[role="tooltip"][data-open]')).toHaveCount(0);
  });

  test('Lista: caption por Variante y columnas en el orden de 8.2 (paso 5)', async ({ page }) => {
    const { pokedex, ui } = es;
    const captions: [string, string][] = [
      ['', pokedex.caption],
      ['&variante=normal', pokedex.captionNormal],
      ['&variante=shiny', pokedex.captionShiny],
    ];
    for (const [extra, caption] of captions) {
      const root = await openPokedex(page, 'es', `?view=list${extra}`);
      await expect(root.locator('table caption')).toHaveText(caption);
      const headers = (await root.locator('table thead th').allTextContents()).map((t) => t.trim());
      const order: string[] = [
        pokedex.columnSprite,
        pokedex.columnNumber,
        pokedex.columnName,
        ui.tooltip.elements,
        ui.tooltip.tier,
        ui.tooltip.requirement,
        ui.tooltip.role,
        ui.cards.variant,
      ];
      expect(headers.slice(0, 3)).toEqual(order.slice(0, 3));
      expect(headers.every((header) => order.includes(header))).toBe(true);
      expect(headers.map((header) => order.indexOf(header))).toEqual(
        [...headers.map((header) => order.indexOf(header))].sort((a, b) => a - b),
      );
      await expect(root.locator('table tbody tr')).toHaveCount(PAGE_SIZE);
    }
  });
});

test.describe('Ficha de Pokémon (8.3)', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('FI1: un HTML por registro y por idioma; un id desconocido responde 404', async ({
    page,
  }) => {
    for (const locale of LOCALES) {
      const response = await page.goto(`/${locale}/pokedex/no-existe/`);
      expect(response?.status(), `/${locale}/pokedex/no-existe/ answers 404 (8.12)`).toBe(404);
    }
    // The build of the other gates: one page per record and per locale, nothing else under
    // /{l}/pokedex/ but the static routes of 8.0.1.
    const staticRoot = resolve(ROOT, '.vercel/output/static');
    test.skip(!existsSync(staticRoot), 'FI1 counts the pages of the build: run `pnpm build`.');
    for (const locale of LOCALES) {
      const directory = resolve(staticRoot, locale, 'pokedex');
      const pages = readdirSync(directory, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .filter((entry) => existsSync(resolve(directory, entry.name, 'index.html')))
        .map((entry) => entry.name)
        .filter((name) => name !== 'tiers');
      expect(pages.sort(), `FI1: one page per record in ${locale}`).toEqual(
        POKEMON.map((record) => record.id).sort(),
      );
    }
  });

  for (const locale of LOCALES) {
    for (const id of FICHAS) {
      const record = BY_ID.get(id) as PokemonRecord;

      test(`${locale} ${id}: migas, título, ficha fija y secciones (8.3, FI2, FI3, §14.4)`, async ({
        page,
      }) => {
        const { ui, pokemon } = MESSAGES[locale];
        await openPokemon(page, locale, id);

        // 1. «Pokémon › Pokédex › {nombre}» (8.0.4).
        const crumbs = page.locator('nav.ac-breadcrumb .ac-breadcrumb__item');
        await expect(crumbs).toHaveText(['Pokémon', 'Pokédex', record.nombre]);
        await expect(crumbs.nth(0).locator('a')).toHaveCount(0);
        await expect(crumbs.nth(1).locator('a')).toHaveAttribute('href', `/${locale}/pokedex/`);
        await expect(crumbs.nth(2).locator('[aria-current="page"]')).toHaveText(record.nombre);

        // 2. The name and «Nº {numero}», without a subtitle when `numero` is null.
        await expect(page.locator('h1')).toHaveCount(1);
        await expect(page.locator('h1')).toHaveText(record.nombre);
        const subtitle = page.locator('.ac-page-title__sub');
        if (record.numero === null) await expect(subtitle).toHaveCount(0);
        else await expect(subtitle).toHaveText(fill(ui.cards.number, { n: String(record.numero) }));

        // 3. The art panel: the art with alt="", or the missing mark with no image.
        const art = page.locator('.ac-detail-head__art');
        if (record.imagen === null) {
          await expect(art.locator('img')).toHaveCount(0);
        } else {
          await expect(art.locator('img')).toHaveAttribute('alt', '');
        }

        // The fixed sheet: the rows of 8.3 in order and only with a value; no «—» (FI3).
        const sheet = await sheetOf(page, record.nombre, locale);
        const rows = sheetRows(record, locale);
        await expect(sheet.locator('.ac-game-tooltip__label')).toHaveText(rows.map(([l]) => l));
        await expect(sheet.locator('.ac-game-tooltip__value')).toHaveText(rows.map(([, v]) => v));
        await expect(sheet).not.toContainText('—');

        // The outfit panel and «Aura», only with an outfit in the registry (8.3 step 3).
        const outfit = outfitOf(id);
        await expect(page.locator('[data-testid="outfit-preview"]')).toHaveCount(
          outfit === null ? 0 : 1,
        );

        // 4. The sections with data, in page order, each with its entry in the Toc; with 0 or 1
        // there is no Toc and the column measures 944 (8.0.2, FI2).
        const expected = sectionsOf(record);
        const titles: Record<SectionId, string> = {
          drops: pokemon.sections.drops,
          'tier-list': pokemon.sections.tierList,
          evolucion: pokemon.sections.evolution,
          ataques: pokemon.sections.moves,
          donde: pokemon.sections.where,
        };
        const sections = page.locator('main section.ac-section:not(.ac-section .ac-section)');
        await expect(sections).toHaveCount(expected.length);
        for (const [index, section] of expected.entries()) {
          await expect(sections.nth(index)).toHaveAttribute('id', section);
          await expect(sections.nth(index).locator('h2').first()).toHaveText(titles[section]);
        }
        const toc = page.locator('aside.ac-toc');
        if (expected.length >= 2) {
          await expect(toc.locator('.ac-toc__link')).toHaveText(expected.map((s) => titles[s]));
        } else {
          await expect(toc).toHaveCount(0);
        }
        const main = await page.locator('main#contenido').boundingBox();
        expect(main?.width, 'template C column').toBeCloseTo(expected.length >= 2 ? 896 : 944, 0);

        // X11: no paginator between Pokémon and no «Volver a la Pokédex».
        await expect(page.locator('main .ac-pagination')).toHaveCount(0);

        // §14.4: the sample passes axe.
        await expectAxeClean(page, `${locale} ${id}`);
      });
    }
  }

  test('FI2: charizard tiene solo «Tier list» con sus variantes; chimchar solo «Ataques»', async ({
    page,
  }) => {
    const charizard = BY_ID.get('charizard');
    test.skip(charizard === undefined, 'charizard is not in the registry');
    const family = familyOf(charizard as PokemonRecord).sort(pokemonOrder('es'));
    const withEvolution = family.some((entry) => (entry.evolucion ?? []).length > 0);
    await openPokemon(page, 'es', 'charizard');
    const root = listRoot(page, 'familia');
    await listReady(page, root);
    await expect(root.locator('table caption')).toHaveText(
      withEvolution
        ? fill(es.pokemon.familyCaption, { name: family[0].nombre })
        : fill(es.pokemon.variantsCaption, { n: String(charizard?.numero) }),
    );
    const rows = await tableRows(root.locator('table'));
    expect(
      rows.map((cells) => cells.slice(0, 2)),
      'FI2: the variants of the record, «Charizard · T3» and «Shiny Charizard · T1» today',
    ).toEqual(
      family.map((entry) => [entry.nombre, entry.tier === null ? '—' : tierText(entry.tier)]),
    );
    await expect(countOf(root)).toHaveText(counted(es.pokemon.familyCount, family.length, 'es'));

    const chimchar = BY_ID.get('chimchar');
    const moves = chimchar === undefined ? [] : movesOf(chimchar);
    test.skip(moves.length === 0, 'chimchar has no move in the registry');
    await openPokemon(page, 'es', 'chimchar');
    const table = page.locator('#ataques table');
    await expect(table.locator('caption')).toHaveText(
      fill(es.pokemon.movesCaption, { name: 'Chimchar' }),
    );
    expect(
      await tableRows(table),
      'FI2: «M1 · Scratch · 12 s · Normal» with the registry of today',
    ).toEqual(
      moves.map((move) => [
        move.slot ?? '—',
        move.nombre,
        move.cooldownSegundos === null
          ? '—'
          : fill(es.pokemon.cooldown, { n: figure(move.cooldownSegundos, 'es') }),
        move.elemento === null ? '—' : (elementName(move.elemento, 'es') ?? '—'),
      ]),
    );
  });

  test('FI4: con movimiento reducido el aura queda quieta y no hay animaciones', async ({
    page,
  }) => {
    const id = FICHAS.find((candidate) => outfitOf(candidate) !== null && AURAS.length > 0);
    test.skip(id === undefined, 'no Pokémon of the sample has an outfit and an aura');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openPokemon(page, 'es', id as string);
    const preview = page.locator('[data-testid="outfit-preview"]');
    await preview.scrollIntoViewIfNeeded();
    await expect(page.locator('astro-island[ssr]').filter({ has: preview })).toHaveCount(0, {
      timeout: READY_TIMEOUT,
    });
    const canvas = preview.locator('canvas');
    const status = preview.locator('[role="status"]');
    await expect(canvas.or(status).first()).toBeVisible();
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => document.getAnimations().length), 'FI4, S15').toBe(0);
    if ((await canvas.count()) > 0) {
      const frame = () => canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL());
      const first = await frame();
      await page.waitForTimeout(400);
      expect(await frame(), 'FI4: the aura is drawn still').toBe(first);
    }
  });

  test('FI5: la Tier list abre en Lista, Cards y Slots muestran lo mismo y la vista se guarda', async ({
    page,
  }) => {
    const charizard = BY_ID.get('charizard');
    test.skip(charizard === undefined, 'charizard is not in the registry');
    const family = familyOf(charizard as PokemonRecord).sort(pokemonOrder('es'));
    await openPokemon(page, 'es', 'charizard');
    await forgetViews(page);
    await page.reload();
    let root = listRoot(page, 'familia');
    await listReady(page, root);
    await expect(viewButton(root, 'es', 'list')).toHaveAttribute('aria-pressed', 'true');
    await expect(root.getByRole('group', { name: es.pokemon.familyView })).toHaveCount(1);

    const names = family.map((entry) => entry.nombre);
    const listNames = (await tableRows(root.locator('table'))).map((cells) => cells[0]);
    expect(listNames).toEqual(names);

    await chooseView(root, 'es', 'cards');
    await expect(root.locator('[data-card-grid] article .ac-card__title')).toHaveText(names);
    await chooseView(root, 'es', 'slots');
    const slotNames = await root
      .locator('.ac-entity-slot')
      .evaluateAll((slots) =>
        slots.map(
          (slot) =>
            slot.getAttribute('aria-label') ??
            (slot.querySelector('.sr-only')?.textContent ?? '').trim(),
        ),
      );
    expect(slotNames).toEqual(names);

    await page.reload();
    root = listRoot(page, 'familia');
    await listReady(page, root);
    await expect(viewButton(root, 'es', 'slots')).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => window.localStorage.getItem('ac:vista:familia'))).toBe(
      'slots',
    );

    // The entry of the page itself: no link, no panel, no aria-describedby, in every view.
    for (const view of ['slots', 'cards', 'list'] as ViewName[]) {
      await chooseView(root, 'es', view);
      // 8.3: `aria-current="page"` on its name, in the three views — not on its row.
      const self = root.locator('[aria-current="page"]');
      await expect(self, `${view}: one current entry`).toHaveCount(1);
      await expect(self, `${view}: the attribute is on the name`).toHaveText('Charizard');
      expect(await self.evaluate((node) => node.tagName), `${view}: not on the row`).not.toBe('TR');
      const own = await root.evaluate(
        (element, name) =>
          [...element.querySelectorAll('a, [aria-describedby], [data-ac-tt]')].filter((node) => {
            const text = (node.getAttribute('aria-label') ?? node.textContent ?? '').trim();
            return text === name;
          }).length,
        'Charizard',
      );
      expect(own, `FI5: Charizard has no link or tooltip in ${view}`).toBe(0);
    }
    await forgetViews(page);
  });

  test('Outfit y Aura: opciones del registro, la primera elegida y la ball (8.3 paso 3, S19)', async ({
    page,
  }) => {
    const id = FICHAS.find((candidate) => outfitOf(candidate) !== null);
    test.skip(id === undefined || AURAS.length === 0, 'no outfit with auras in the sample');
    await openPokemon(page, 'es', id as string);
    const preview = page.locator('[data-testid="outfit-preview"]');
    await preview.scrollIntoViewIfNeeded();
    await expect(page.locator('astro-island[ssr]').filter({ has: preview })).toHaveCount(0, {
      timeout: READY_TIMEOUT,
    });
    await expect(preview.locator('[role="group"]').first()).toHaveAttribute(
      'aria-label',
      es.pokemon.outfit,
    );
    const options = preview.locator('.ac-toggle-group button');
    await expect(options).toHaveText([es.pokemon.auraNone, ...AURAS.map((aura) => aura.nombre)]);
    await expect(options.nth(1)).toHaveAttribute('aria-pressed', 'true');
    const record = BY_ID.get(id as string) as PokemonRecord;
    await expect(preview.locator('img').first()).toHaveAttribute(
      'alt',
      fill(es.pokemon.outfitAlt, { name: record.nombre }),
    );
    const unavailable = preview.locator('[role="status"]');
    if ((await unavailable.count()) === 0) {
      await expect(
        preview.getByRole('img', { name: fill(es.pokemon.auraBall, { name: AURAS[0].nombre }) }),
      ).toHaveCount(1);
    }
    await options.nth(0).click();
    await expect(options.nth(0)).toHaveAttribute('aria-pressed', 'true');
    await expect(preview.locator('.ac-outfit-preview__ball')).toHaveCount(0);
  });
});

test.describe('WG1: el marco de §5.5 a 1440 y a 390', () => {
  for (const size of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    test.describe(`${size.width} px`, () => {
      test.use({ viewport: size });

      test(`la Pokédex en sus tres vistas a ${size.width}`, async ({ page }) => {
        for (const view of ['cards', 'slots', 'list'] as ViewName[]) {
          await openPokedex(page, 'es', `?view=${view}`);
          await expectFrame(page, size.width, false, `/es/pokedex/?view=${view}`);
        }
      });

      test(`la muestra de fichas a ${size.width}`, async ({ page }) => {
        test.setTimeout(120_000);
        for (const id of FICHAS) {
          const record = BY_ID.get(id) as PokemonRecord;
          await openPokemon(page, 'es', id);
          await expectFrame(page, size.width, sectionsOf(record).length >= 2, `/es/pokedex/${id}/`);
        }
        // The Tier list of charizard in its three views: the table scrolls inside its border.
        if (
          BY_ID.has('charizard') &&
          sectionsOf(BY_ID.get('charizard') as PokemonRecord).includes('tier-list')
        ) {
          await openPokemon(page, 'es', 'charizard');
          const root = listRoot(page, 'familia');
          await listReady(page, root);
          for (const view of ['cards', 'slots', 'list'] as ViewName[]) {
            await chooseView(root, 'es', view);
            const frame = await readFrame(page);
            expect
              .soft(frame.scrollWidth, `charizard ${view}: no sideways scroll`)
              .toBeLessThanOrEqual(size.width);
          }
          await forgetViews(page);
        }
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

      test(`columnas de la Pokédex y de la Tier list a ${size.width}`, async ({ page }) => {
        const root = await openPokedex(page, 'es');
        const grid = await readGrid(root.locator('.ac-card-grid__grid').first());
        const main = MAIN_COLUMN[size.width].spacer;
        expect
          .soft(Math.abs(grid.width - main[1]), 'the grid spans the main column')
          .toBeLessThanOrEqual(1);
        expect
          .soft(grid.columns, `pokedex columns for ${grid.width}`)
          .toBe(expectedColumns('pokedex', grid.width));
        expect.soft(grid.spread, 'no ragged row (S2)').toBe(0);

        const charizard = BY_ID.get('charizard');
        if (charizard !== undefined && sectionsOf(charizard).includes('tier-list')) {
          await openPokemon(page, 'es', 'charizard');
          const family = listRoot(page, 'familia');
          await listReady(page, family);
          await chooseView(family, 'es', 'cards');
          const familyGrid = await readGrid(family.locator('.ac-card-grid__grid').first());
          expect
            .soft(familyGrid.columns, `Tier list columns for ${familyGrid.width}`)
            .toBe(expectedColumns('pokedex', familyGrid.width));
          expect.soft(familyGrid.spread, 'no ragged row in the Tier list (S2)').toBe(0);
          await forgetViews(page);
        }
        const withDrops = FICHAS.find((id) =>
          sectionsOf(BY_ID.get(id) as PokemonRecord).includes('drops'),
        );
        if (withDrops !== undefined) {
          await openPokemon(page, 'es', withDrops);
          const drops = listRoot(page, 'drops');
          await listReady(page, drops);
          await chooseView(drops, 'es', 'cards');
          const dropGrid = await readGrid(drops.locator('.ac-card-grid__grid').first());
          expect
            .soft(dropGrid.columns, `loot columns for ${dropGrid.width}`)
            .toBe(expectedColumns('loot', dropGrid.width));
          expect.soft(dropGrid.spread, 'no ragged row in the drops (S2)').toBe(0);
          await forgetViews(page);
        }
      });
    });
  }
});

test.describe('WG5: cada enlace interno responde 200', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  const resolved = new Map<string, number>();

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
    const broken: string[] = [];
    for (const href of [...new Set(hrefs.map((href) => href.split('#')[0]))]) {
      let status = resolved.get(href);
      if (status === undefined) {
        status = (await page.request.get(href, { maxRedirects: 0 })).status();
        resolved.set(href, status);
      }
      if (status !== 200 && status !== 302) broken.push(`${href} → ${status}`);
    }
    expect.soft(broken, `${label}: every internal link answers (WG5)`).toEqual([]);
  }

  test('la Pokédex, con cada enlace de la paginación', async ({ page }) => {
    test.setTimeout(180_000);
    for (const search of ['', '?page=2', '?view=slots', '?view=list']) {
      await openPokedex(page, 'es', search);
      await expectLinks(page, `/es/pokedex/${search}`);
    }
  });

  test('la muestra de fichas', async ({ page }) => {
    test.setTimeout(180_000);
    for (const id of FICHAS) {
      await openPokemon(page, 'es', id);
      await expectLinks(page, `/es/pokedex/${id}/`);
    }
  });
});

test.describe('WA1: axe con un tooltip abierto y con la hoja móvil', () => {
  for (const locale of LOCALES) {
    test.describe(`${locale} a 1440`, () => {
      test.use({ viewport: { width: 1440, height: 900 } });

      test(`${locale}: la Pokédex en Slots y Lista con un tooltip abierto`, async ({ page }) => {
        for (const view of ['cards', 'slots', 'list'] as ViewName[]) {
          const root = await openPokedex(page, locale, `?view=${view}`);
          await expectAxeClean(page, `/${locale}/pokedex/?view=${view}`);
          if ((await root.locator('[data-ac-tt]').count()) === 0) continue;
          await openTooltip(page, root);
          await expectAxeClean(page, `/${locale}/pokedex/?view=${view} with a tooltip open`);
          await page.keyboard.press('Escape');
        }
      });

      test(`${locale}: charizard con un tooltip de la Tier list abierto`, async ({ page }) => {
        const charizard = BY_ID.get('charizard');
        test.skip(
          charizard === undefined || !sectionsOf(charizard).includes('tier-list'),
          'no Tier list',
        );
        await openPokemon(page, locale, 'charizard');
        const root = listRoot(page, 'familia');
        await listReady(page, root);
        await openTooltip(page, root);
        await expectAxeClean(page, `/${locale}/pokedex/charizard/ with a tooltip open`);
      });
    });

    test.describe(`${locale} a 390`, () => {
      test.use({ viewport: { width: 390, height: 844 } });

      test(`${locale}: la Pokédex y una ficha con la hoja móvil abierta`, async ({ page }) => {
        for (const path of [`/${locale}/pokedex/`, pokemonPath(locale, FICHAS[0])]) {
          await page.goto(path);
          const trigger = page.locator('[aria-controls="menu-movil"]').first();
          await trigger.click();
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
    test(`${locale}: la Pokédex en sus tres vistas`, async ({ page }) => {
      for (const view of ['cards', 'slots', 'list'] as ViewName[]) {
        const root = await openPokedex(page, locale, `?view=${view}`);
        await expectStructure(page, locale, `/${locale}/pokedex/?view=${view}`);
        // WA3: the menu entry of the route and the current page of the pagination. The entry
        // is the one of its group: the pinned «Destacados» may link the page too (E10, M10).
        await expect(
          page.locator(`.ac-page-layout__sidebar details a[href="/${locale}/pokedex/"]`),
        ).toHaveAttribute('aria-current', 'page');
        await expect(root.locator('.ac-pagination [aria-current="page"]')).toHaveCount(1);
      }
    });

    test(`${locale}: la muestra de fichas`, async ({ page }) => {
      test.setTimeout(120_000);
      for (const id of FICHAS) {
        await openPokemon(page, locale, id);
        await expectStructure(page, locale, pokemonPath(locale, id));
        // E10: a Pokémon page marks the Pokédex entry of its section with "true", in its
        // group and not in the pinned «Destacados» (M10).
        await expect(
          page.locator(`.ac-page-layout__sidebar details a[href="/${locale}/pokedex/"]`),
        ).toHaveAttribute('aria-current', 'true');
        // WA4 with the data: a `uso` that only exists in the other language carries its lang.
        const other = locale === 'es' ? 'en' : 'es';
        for (const drop of BY_ID.get(id)?.drops ?? []) {
          const use = ITEMS.get(drop.item)?.uso;
          if (!use || use[locale] || !use[other]) continue;
          await expect(page.locator(`[lang="${other}"]`, { hasText: use[other] })).not.toHaveCount(
            0,
          );
        }
      }
    });
  }
});

test.describe('WL1: sin relleno (§12.7, §12.8, §12.22)', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const locale of LOCALES) {
    test(`${locale}: la Pokédex en sus vistas y en el vacío`, async ({ page }) => {
      const { pokedex, ui } = MESSAGES[locale];
      for (const search of ['', '?view=slots', '?view=list', EMPTY_QUERY]) {
        await openPokedex(page, locale, search);
        await expectNoRemovedText(page, REMOVED_INDEX[locale], `/${locale}/pokedex/${search}`);
      }
      // The final texts of the REESCRIBIR rows (P-10, P-11, P-15, P-18, P-21, P-28).
      const root = await openPokedex(page, locale);
      const found = await harvest(page);
      const texts = new Set(found.texts);
      for (const text of [
        pokedex.filters.generation,
        pokedex.filters.tier,
        pokedex.filters.element,
        pokedex.filters.variant,
        pokedex.filters.allGenerations,
        pokedex.filters.allTiers,
        ui.cards.normal,
        ui.shiny,
        ui.prev,
        ui.next,
      ]) {
        expect.soft(texts.has(text), `WL1: «${text}» is on /${locale}/pokedex/`).toBe(true);
      }
      await expect(root.locator('.ac-pagination__nav')).toHaveAttribute(
        'aria-label',
        ui.pagination,
      );
      await expect(root.locator(`[aria-label="${ui.page} 2"]`)).toHaveCount(1);
      const first = [...POKEMON].sort(pokemonOrder(locale))[0];
      if (first.numero !== null) {
        await expect(root.locator('.ac-card__meta').first()).toContainText(
          fill(ui.cards.number, { n: String(first.numero) }),
        );
      }
      // P-18: «Limpiar filtros» only in the empty state.
      await expect(page.getByText(pokedex.clearFilters, { exact: true })).toHaveCount(0);
    });

    test(`${locale}: la muestra de fichas`, async ({ page }) => {
      test.setTimeout(120_000);
      for (const id of FICHAS) {
        await openPokemon(page, locale, id);
        await expectNoRemovedText(page, REMOVED_POKEMON[locale], pokemonPath(locale, id));
        // D-09: the sheet is named «Ficha de {nombre}» and writes «Requisito:» and «Nivel {n}».
        const record = BY_ID.get(id) as PokemonRecord;
        const sheet = await sheetOf(page, record.nombre, locale);
        if (record.nivel !== null) {
          await expect(sheet).toContainText(`${MESSAGES[locale].ui.tooltip.requirement}:`);
        }
      }
    });
  }
});

test.describe('Índice de búsqueda: el grupo Pokémon y Páginas (8.6, BU6)', () => {
  interface Entry {
    kind: string;
    id: string;
    name: string;
    href: string;
    meta?: string;
    dex?: number;
    terms?: string[];
  }

  const normalize = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  for (const locale of LOCALES) {
    test(`${locale}: una entrada por registro con su ficha y «Nivel {n} · {tier}»`, async ({
      page,
    }) => {
      const response = await page.request.get(`/${locale}/buscar/indice.json`);
      expect(response.status()).toBe(200);
      const entries = (await response.json()) as Entry[];
      const pokemon = entries.filter((entry) => entry.kind === 'pokemon');
      expect(pokemon.map((entry) => entry.id)).toEqual(POKEMON.map((record) => record.id));
      const level = MESSAGES[locale].ui.tooltip.level;
      for (const entry of pokemon) {
        const record = BY_ID.get(entry.id) as PokemonRecord;
        expect.soft(entry.href, `${entry.id}: its page (8.6)`).toBe(pokemonPath(locale, entry.id));
        const meta = [
          record.nivel === null ? null : fill(level, { n: figure(record.nivel, locale) }),
          record.tier === null ? null : tierText(record.tier),
        ].filter((part): part is string => part !== null);
        expect
          .soft(entry.meta, `${entry.id}: «Nivel {n} · {tier}»`)
          .toBe(meta.length > 0 ? meta.join(' · ') : undefined);
        expect.soft(entry.dex, `${entry.id}: its number`).toBe(record.numero ?? undefined);
        const terms = new Set(entry.terms ?? []);
        for (const id of record.elementos) {
          expect.soft(terms.has(id), `${entry.id}: the id of ${id}`).toBe(true);
          const name = elementName(id, locale);
          if (name !== null) {
            expect.soft(terms.has(normalize(name)), `${entry.id}: «${name}»`).toBe(true);
          }
        }
        expect.soft(terms.has('shiny'), `${entry.id}: «shiny»`).toBe(record.variante === 'shiny');
      }

      // BU6: every page of the `pagina` group answers, and Pokédex is one of them; the
      // Pokémon pages are the ids of the registry, which FI1 already counts in the build.
      const pages = entries.filter((entry) => entry.kind === 'pagina');
      expect(pages.map((entry) => entry.href)).toContain(`/${locale}/pokedex/`);
      for (const entry of pages) {
        const status = (await page.request.get(entry.href, { maxRedirects: 0 })).status();
        expect.soft(status, `BU6: ${entry.href}`).toBe(200);
      }
      for (const id of FICHAS) {
        const status = (await page.request.get(pokemonPath(locale, id))).status();
        expect.soft(status, `BU6: ${pokemonPath(locale, id)}`).toBe(200);
      }
    });
  }
});

test.describe('S19: datos del registro y borradores', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('datos.json lleva cada registro, en el orden de 8.0.5', async ({ page }) => {
    for (const locale of LOCALES) {
      const response = await page.request.get(`/${locale}/pokedex/datos.json`);
      expect(response.status()).toBe(200);
      const data = (await response.json()) as { campos: string[]; filas: unknown[][] };
      const idColumn = data.campos.indexOf('id');
      expect(data.filas.map((row) => row[idColumn])).toEqual(
        [...POKEMON].sort(pokemonOrder(locale)).map((record) => record.id),
      );
    }
  });

  // Without the flag the drafts are shown like any other record (8.0.5), so the check below
  // only means something in a run with it; it is skipped, not passed, in the other one.
  test('con OCULTAR_BORRADORES=1 ningún borrador llega a la Pokédex ni a las fichas', async ({
    page,
  }) => {
    test.skip(!HIDE_DRAFTS, 'Solo con OCULTAR_BORRADORES=1 (REG:48-55).');
    expect(DRAFT_NAMES.length, 'the registries carry drafts to look for').toBeGreaterThan(0);
    const pages = [
      '/es/pokedex/',
      '/es/pokedex/?view=list',
      ...FICHAS.map((id) => pokemonPath('es', id)),
      ...OUTFITS.map((outfit) => pokemonPath('es', outfit.pokemon)).filter((path) =>
        BY_ID.has(path.split('/')[3]),
      ),
    ];
    for (const path of [...new Set(pages)]) {
      await page.goto(path);
      const found = await harvest(page);
      const leaked = DRAFT_NAMES.filter((name) => found.texts.includes(name));
      expect.soft(leaked, `${path}: no draft record with OCULTAR_BORRADORES=1`).toEqual([]);
    }
  });
});
