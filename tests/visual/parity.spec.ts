// Step 2 of §14.5: the crops of a site route against the render of its approved board.
//
// The `visual` Playwright project runs this file (playwright.config.ts: `testDir`
// ./tests/visual, `testMatch` *.spec.ts) over scripts/test/serve-vercel-output.mjs, which
// serves the VISUAL=1 build that `pnpm test:visual` makes before calling it. Stage 1 of
// scripts/visual/run.mjs has already checked the manifest and every golden, so this file
// trusts both.
//
// One test per crop, titled `<case id> · <crop name>`, which is what makes
// `pnpm test:visual -- --grep "marco"` select the two frame cases of M3.
//
// Where each side comes from:
//
// - the board crop is rendered by the versioned harness, `design/render/render.mjs`, with
//   the arguments scripts/visual/goldens.mjs uses plus `--selector`. It is not cut out of
//   `<id>.png`, because a golden carries no per-selector rectangle: only the grids are
//   measured, and the box of a `header` or a `footer` is not among them. The harness is
//   the single definition of what a board looks like (§14.5), so asking it is the same
//   answer the golden was made from — and the CI job that runs this is the Windows one
//   the goldens themselves require (§14.6).
// - the site crop is an element screenshot of `siteSelector`, after the fonts and the
//   images of the page have settled and after the `siteState` steps of the case.
//
// Then both are masked with the approved deviations of the case (§14.5 DV table) and
// compared with tests/visual/compare.ts: `threshold` 0.15 and ≤ 0.5 % differing pixels on
// a `/_paridad/` route, ≤ 1 % elsewhere.
//
// The other steps of §14.5, for the cases that ask for them:
//
// - Step 1, geometry (WG2), for a case with `geometry`: one test, `<case id> · geometría`,
//   that compares to ±1 px each anchor of the case (the header, the sidebar, the main
//   column, the h1, the view switch, the footer) and each card grid of its golden — the
//   grid's box, columns, children and the height of every row and card, and its first card —
//   with the same boxes on the site. The golden gives the grids (its measure.json); the
//   anchors and the first card of each grid are asked of the harness with `--boxes`, like
//   the crops. Each anchor is a soft assertion, so a report lists every box that moved. The
//   frame is also measured at every width of §5.5 in tests/e2e/frame.spec.ts (S1, V5-1).
// - Step 3, full page: a case that reproduces a whole board (`fullPage`) is compared against
//   its golden, at 2 %.
// - Step 4, the 390 baselines of the site itself (`baselines` of the manifest): the whole
//   page at 390, with every island hydrated, against tests/visual/baselines/<route>--390.png
//   at 0.1 %. A baseline is written, never compared, when the run sets
//   `VISUAL_BASELINES=update`, and every new or changed baseline needs the owner's approval
//   in the PR (§14.5).

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test, type Page } from '@playwright/test';

import {
  baselinePngPath,
  compareGridRows,
  comparePngs,
  compareRect,
  cropLimit,
  formatFailures,
  goldenPngPath,
  loadGoldenMeasure,
  loadManifest,
  MAX_DIFF_RATIO,
  readPng,
  type CaseGeometry,
  type Rect,
  type SiteAction,
  type SiteGrid,
  type VisualCase,
} from './compare';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const RENDER = path.join(ROOT, 'design', 'render', 'render.mjs');
const BOARDS = path.join(ROOT, 'design', 'boards');
const WORK = path.join(ROOT, 'test-results', 'visual');

/**
 * §14.5 «Cómo se captura el sitio»: the fixed clock of §14.3, 14:32 in Brasília on the day the
 * boards draw, the instant `FIXED_TIME` of tests/e2e/routes.ts (not imported: that module reads
 * the route list of the output as it loads). The boards write their times against it («hace 12
 * min» in `Lienzo:Comercio`), and the Comercio islands filter and date their listings by the
 * visitor's clock (9.4, 9.5.8).
 */
const FIXED_TIME = '2026-09-18T17:32:00Z';

/** The board crop of a case, rendered with the arguments of scripts/visual/goldens.mjs. */
function renderBoardCrop(c: VisualCase, selector: string, name: string): string {
  fs.mkdirSync(WORK, { recursive: true });
  const out = path.join(WORK, `${c.id}--${name}--board.png`);
  execFileSync(
    process.execPath,
    [
      RENDER,
      path.join(BOARDS, `${c.board}.dc.html`),
      '--state',
      JSON.stringify(c.state),
      '--width',
      String(c.width),
      '--height',
      String(c.height),
      '--scale',
      '1',
      '--selector',
      selector,
      '--out',
      out,
      '--quiet',
    ],
    { cwd: ROOT, stdio: 'pipe' },
  );
  return out;
}

/** The key of the first card of a grid among the boxes the harness measures. */
const firstCard = (gridPath: string) => `${gridPath} :: primera tarjeta`;

/**
 * The boxes of the anchors of a case and of the first card of each of its grids, asked of
 * the harness with the arguments of scripts/visual/goldens.mjs plus `--boxes`.
 */
function renderBoardBoxes(c: VisualCase, geometry: CaseGeometry): Record<string, Rect | null> {
  fs.mkdirSync(WORK, { recursive: true });
  const out = path.join(WORK, `${c.id}--boxes.json`);
  const boxes: Record<string, string> = {};
  for (const anchor of geometry.anchors) boxes[anchor.name] = anchor.boardSelector;
  for (const grid of geometry.grids) boxes[firstCard(grid.path)] = `${grid.path} > :nth-child(1)`;
  execFileSync(
    process.execPath,
    [
      RENDER,
      path.join(BOARDS, `${c.board}.dc.html`),
      '--state',
      JSON.stringify(c.state),
      '--width',
      String(c.width),
      '--height',
      String(c.height),
      '--scale',
      '1',
      '--measure',
      out,
      '--boxes',
      JSON.stringify(boxes),
      '--quiet',
    ],
    { cwd: ROOT, stdio: 'pipe' },
  );
  const measured = JSON.parse(fs.readFileSync(out, 'utf8')) as {
    boxes?: Record<string, Rect | null>;
  };
  return measured.boxes ?? {};
}

/** The box of the first element `selector` matches on the site, in document coordinates. */
async function siteBox(page: Page, selector: string): Promise<Rect | null> {
  const target = page.locator(selector).first();
  if ((await target.count()) === 0) return null;
  const box = await target.boundingBox();
  if (box === null) return null;
  const scroll = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
  return { x: box.x + scroll.x, y: box.y + scroll.y, w: box.width, h: box.height };
}

/**
 * A card grid of the site measured the way design/render/render.mjs measures one: its box,
 * its column tracks, its children in flow, and the rows they form (tops within 2 px), each
 * with the height of every card, left to right.
 */
async function siteGrid(page: Page, selector: string): Promise<SiteGrid | null> {
  return page.evaluate((css) => {
    const grid = document.querySelector(css);
    if (grid === null) return null;
    const round = (value: number) => Math.round(value * 10) / 10;
    const items = [...grid.children].filter((child) => {
      const style = getComputedStyle(child);
      if (style.display === 'none' || style.position === 'absolute' || style.position === 'fixed')
        return false;
      const box = child.getBoundingClientRect();
      return box.width > 0 || box.height > 0;
    });
    const rows: { top: number; boxes: DOMRect[] }[] = [];
    for (const box of items
      .map((item) => item.getBoundingClientRect())
      .sort((a, b) => a.top - b.top)) {
      const row = rows.find((entry) => Math.abs(entry.top - box.top) <= 2);
      if (row) row.boxes.push(box);
      else rows.push({ top: box.top, boxes: [box] });
    }
    const measured = rows.map((row) => ({
      y: round(row.top + window.scrollY),
      heights: row.boxes.sort((a, b) => a.left - b.left).map((box) => round(box.height)),
    }));
    const box = grid.getBoundingClientRect();
    return {
      rect: {
        x: round(box.left + window.scrollX),
        y: round(box.top + window.scrollY),
        w: round(box.width),
        h: round(box.height),
      },
      columns: getComputedStyle(grid)
        .gridTemplateColumns.replace(/\[[^\]]*\]/g, ' ')
        .trim()
        .split(/\s+/)
        .filter(Boolean).length,
      children: items.length,
      rows: measured,
      maxSpread: Math.max(
        0,
        ...measured.map((row) => round(Math.max(...row.heights) - Math.min(...row.heights))),
      ),
    };
  }, selector);
}

/** The page is settled when its web fonts are in and no image is still loading. */
async function settle(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.evaluate(async () => {
    const pending = [...document.images]
      .filter((image) => !image.complete)
      .map(
        (image) =>
          new Promise<void>((resolve) => {
            image.addEventListener('load', () => resolve(), { once: true });
            image.addEventListener('error', () => resolve(), { once: true });
          }),
      );
    await Promise.all(pending);
  });
}

/** §14.5: the steps that bring the site to the state the board draws. */
async function applyState(page: Page, steps: SiteAction[]): Promise<void> {
  for (const step of steps) {
    if (step.action === 'press') {
      if (step.selector === undefined) await page.keyboard.press(step.key);
      else await page.locator(step.selector).first().press(step.key);
      continue;
    }
    const target = page.locator(step.selector).first();
    if (step.action === 'click') await target.click();
    else if (step.action === 'hover') await target.hover();
    else if (step.action === 'focus') await target.focus();
    else await target.waitFor();
  }
}

async function openRoute(page: Page, c: VisualCase): Promise<void> {
  await page.clock.setFixedTime(FIXED_TIME);
  const response = await page.goto(c.route as string);
  expect(response?.status(), `${c.route} answers 200 in the VISUAL build`).toBe(200);
  await settle(page);
  await applyState(page, c.siteState);
}

function masksFor(c: VisualCase, crop: string | null): Rect[] {
  return c.masks.filter((mask) => (mask.crop ?? null) === crop).map((mask) => mask.rect);
}

const siteCases = loadManifest().cases.filter(
  (c): c is VisualCase & { route: string } => typeof c.route === 'string',
);

for (const c of siteCases) {
  test.describe(c.id, () => {
    // The same window the golden was rendered in, so anything that reads the viewport
    // reads the same numbers on both sides.
    test.use({ viewport: { width: c.width, height: c.height } });

    for (const crop of c.crops) {
      test(`${c.id} · ${crop.name}`, async ({ page }) => {
        // A known difference waiting on the owner's data still runs, expected to fail.
        test.fail(crop.pending !== undefined, crop.pending);
        const board = readPng(renderBoardCrop(c, crop.boardSelector, crop.name));

        await openRoute(page, c);
        const target = page.locator(crop.siteSelector);
        await expect(target, `${crop.siteSelector} is on ${c.route}`).toHaveCount(1);

        const sitePng = path.join(WORK, `${c.id}--${crop.name}--site.png`);
        await target.screenshot({ path: sitePng, animations: 'disabled', caret: 'hide' });
        const site = readPng(sitePng);

        const result = comparePngs(board, site, {
          limit: cropLimit(c.route),
          masks: masksFor(c, crop.name),
          diffPath: path.join(WORK, `${c.id}--${crop.name}--diff.png`),
        });

        expect(result.sizeError, `§14.5: the crop has the size of the board`).toBeNull();
        expect(
          result.ratio,
          `§14.5: ${crop.name} of ${c.id} differs in ${result.diffPixels} px ` +
            `(${(result.ratio * 100).toFixed(3)} %, limit ${(result.limit * 100).toFixed(1)} %)`,
        ).toBeLessThanOrEqual(result.limit);
      });
    }

    const geometry = c.geometry;
    if (geometry !== undefined) {
      test(`${c.id} · geometría`, async ({ page }) => {
        test.fail(c.pending !== undefined, c.pending);
        const board = renderBoardBoxes(c, geometry);
        const golden = loadGoldenMeasure(c.id);
        await openRoute(page, c);

        for (const anchor of geometry.anchors) {
          const expected = board[anchor.name] ?? null;
          expect(expected, `the board has ${anchor.name} (${anchor.boardSelector})`).not.toBeNull();
          const found = await siteBox(page, anchor.siteSelector);
          expect
            .soft(found, `${anchor.name}: ${anchor.siteSelector} is on ${c.route}`)
            .not.toBeNull();
          if (expected === null || found === null) continue;
          const failures = compareRect(anchor.name, expected, found, undefined, anchor.fields);
          expect
            .soft(failures, `§14.5 step 1, ${anchor.name}:\n${formatFailures(failures)}`)
            .toEqual([]);
        }

        for (const grid of geometry.grids) {
          const measured = golden.grids.find((entry) => entry.path === grid.path);
          expect(measured, `the golden measures ${grid.path}`).toBeDefined();
          const found = await siteGrid(page, grid.siteSelector);
          expect.soft(found, `${grid.siteSelector} is on ${c.route}`).not.toBeNull();
          if (measured === undefined || found === null) continue;
          const failures = compareGridRows('rejilla', measured, found);
          expect
            .soft(failures, `WG2, ${grid.siteSelector}:\n${formatFailures(failures)}`)
            .toEqual([]);

          const first = board[firstCard(grid.path)] ?? null;
          const card = await siteBox(page, `${grid.siteSelector} > :nth-child(1)`);
          if (first === null || card === null) {
            expect.soft(card, `the first card of ${grid.siteSelector}`).not.toBeNull();
            continue;
          }
          const cardFailures = compareRect('primera tarjeta', first, card);
          expect
            .soft(cardFailures, `WG2, primera tarjeta:\n${formatFailures(cardFailures)}`)
            .toEqual([]);
        }
      });
    }

    if (c.fullPage === true) {
      test(`${c.id} · página completa`, async ({ page }) => {
        const golden = readPng(goldenPngPath(c.id));

        await openRoute(page, c);
        const sitePng = path.join(WORK, `${c.id}--pagina--site.png`);
        await page.screenshot({
          path: sitePng,
          fullPage: true,
          animations: 'disabled',
          caret: 'hide',
        });
        const site = readPng(sitePng);

        const result = comparePngs(golden, site, {
          limit: MAX_DIFF_RATIO.fullPage,
          masks: masksFor(c, null),
          size: 'exact',
          diffPath: path.join(WORK, `${c.id}--pagina--diff.png`),
        });

        expect(result.sizeError, '§14.5: the page has the size of the board').toBeNull();
        expect(
          result.ratio,
          `§14.5: ${c.id} differs in ${result.diffPixels} px ` +
            `(${(result.ratio * 100).toFixed(3)} %, limit ${(result.limit * 100).toFixed(1)} %)`,
        ).toBeLessThanOrEqual(result.limit);
      });
    }
  });
}

// ------------------------------------------------------------------ step 4: 390 baselines

/**
 * `client:visible` islands hydrate when they reach the window, and a full-page capture of a
 * phone page would take some of them halfway: the page is walked from top to bottom first,
 * until no island is left to hydrate, and then brought back to the top.
 */
async function hydrateAll(page: Page): Promise<void> {
  const { height, step } = await page.evaluate(() => ({
    height: document.documentElement.scrollHeight,
    step: Math.max(1, Math.floor(window.innerHeight / 2)),
  }));
  for (let y = 0; y <= height; y += step) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.evaluate(
      () =>
        new Promise<void>((done) =>
          requestAnimationFrame(() => requestAnimationFrame(() => done())),
        ),
    );
  }
  await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await settle(page);
}

for (const baseline of loadManifest().baselines ?? []) {
  test.describe(baseline.id, () => {
    test.use({ viewport: { width: baseline.width, height: baseline.height } });

    test(`${baseline.id} · línea base ${baseline.width}`, async ({ page }) => {
      // 200, or 404 for a probe of the on-demand 404 of §8.12 (`status` of the manifest).
      const status = baseline.status ?? 200;
      await page.clock.setFixedTime(FIXED_TIME);
      const response = await page.goto(baseline.route);
      expect(response?.status(), `${baseline.route} answers ${status} in the VISUAL build`).toBe(
        status,
      );
      await settle(page);
      await applyState(page, baseline.siteState);
      await hydrateAll(page);

      const file = baselinePngPath(baseline.route);
      const sitePng = path.join(WORK, `${baseline.id}--site.png`);
      await page.screenshot({
        path: sitePng,
        fullPage: true,
        animations: 'disabled',
        caret: 'hide',
      });

      if (process.env.VISUAL_BASELINES === 'update') {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.copyFileSync(sitePng, file);
        test.info().annotations.push({ type: 'baseline', description: `written: ${file}` });
        return;
      }
      expect(
        fs.existsSync(file),
        `§14.5 step 4: ${path.relative(ROOT, file)} is missing; write it with VISUAL_BASELINES=update ` +
          'and have the owner approve it',
      ).toBe(true);

      const result = comparePngs(readPng(file), readPng(sitePng), {
        limit: MAX_DIFF_RATIO.baseline,
        size: 'exact',
        diffPath: path.join(WORK, `${baseline.id}--diff.png`),
      });
      expect(result.sizeError, '§14.5: the page has the size of its baseline').toBeNull();
      expect(
        result.ratio,
        `§14.5: ${baseline.id} differs in ${result.diffPixels} px ` +
          `(${(result.ratio * 100).toFixed(3)} %, limit ${(result.limit * 100).toFixed(1)} %)`,
      ).toBeLessThanOrEqual(result.limit);
    });
  });
}
