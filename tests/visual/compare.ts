// Comparison of a site capture against the render of an approved board (§14.5).
//
// `toHaveScreenshot` is not used: its mask only paints the capture, not the golden, so an
// approved deviation would still count as a difference. Here every mask is painted in the
// same color in both images before pixelmatch runs.
//
// The four steps of §14.5, in order:
//
// 1. Geometry (blocking): |Δx|, |Δy|, |Δw| and |Δh| ≤ 1 px against the golden's
//    measure.json, and every grid with the same number of columns and `maxSpread` 0.
// 2. Crops (blocking): `threshold` 0.15, ≤ 1 % of differing pixels, ≤ 0.5 % on crops of
//    a `/_paridad/` route.
// 3. Full page (Componentes, Tarjetas, Sistema-Boost): identical size, difference ≤ 2 %.
// 4. 390 px baselines (routes without a board): difference ≤ 0.1 %.
//
// The manifest shape below is checked by the gate in scripts/visual/run.mjs, which also
// verifies that each golden meets the §14.5 render criteria; this file trusts it. Step 1 runs
// for the cases with `geometry` (tests/visual/parity.spec.ts), step 4 for `baselines`.

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import pixelmatch from 'pixelmatch';

// pngjs ships no type declarations, so the part of its surface used here is declared
// locally rather than through an ambient module file.
export interface PngImage {
  width: number;
  height: number;
  data: Buffer;
}
interface PngStatic {
  new (options: { width: number; height: number }): PngImage;
  sync: { read(buffer: Buffer): PngImage; write(png: PngImage): Buffer };
}
const requireFromHere = createRequire(import.meta.url);
const { PNG } = requireFromHere('pngjs') as { PNG: PngStatic };

const HERE = path.dirname(fileURLToPath(import.meta.url));

export const MANIFEST_PATH = path.join(HERE, 'manifest.json');
export const GOLDENS_DIR = path.join(HERE, 'goldens');
export const BASELINES_DIR = path.join(HERE, 'baselines');

// ---------- manifest ----------

/** A box in CSS pixels at `deviceScaleFactor: 1`. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** One pair of selectors compared between the board render and the site capture. */
export interface Crop {
  name: string;
  boardSelector: string;
  siteSelector: string;
  /** Known difference that waits on the owner's data; the check still runs (see `pending`). */
  pending?: string;
}

/**
 * An approved deviation (§14.5 DV table). `rect` is in the coordinate space of the image
 * it is painted on: the crop named by `crop`, or the full image when `crop` is null.
 */
export interface Mask {
  id: string;
  crop?: string | null;
  rect: Rect;
}

/** Playwright actions that bring the site to the state the board draws. */
export type SiteAction =
  | { action: 'click' | 'hover' | 'focus' | 'waitFor'; selector: string }
  | { action: 'press'; key: string; selector?: string };

/** A box the geometry step compares between the board render and the site (§14.5 step 1). */
export interface GeometryAnchor {
  name: string;
  boardSelector: string;
  siteSelector: string;
  /** The sides compared, all four by default: a column whose height is the page's has three. */
  fields?: (keyof Rect)[];
}

/** A card grid of the golden (`path` of its measure.json) and where the site draws it (WG2). */
export interface GeometryGrid {
  path: string;
  siteSelector: string;
}

/** What the geometry step of a case measures (§14.5 step 1, WG2). */
export interface CaseGeometry {
  anchors: GeometryAnchor[];
  grids: GeometryGrid[];
}

/** A card grid of a board that is not a grid of the design and is measured apart. */
export interface GridException {
  path: string;
  maxSpread: number;
  reason: string;
}

export interface VisualCase {
  id: string;
  board: string;
  state: Record<string, unknown>;
  width: number;
  height: number;
  route: string | null;
  siteState: SiteAction[];
  crops: Crop[];
  masks: Mask[];
  fullPage?: boolean;
  gridExceptions?: GridException[];
  geometry?: CaseGeometry;
  /**
   * Why the geometry of this case cannot match its board yet: data the owner has not
   * filled in (sprites, fields). The test still runs and is expected to fail; once it
   * passes, Playwright reports it and the entry has to go.
   */
  pending?: string;
}

/** A 390 px baseline of the site itself, for a route no board draws at that width (step 4). */
export interface BaselineCase {
  id: string;
  route: string;
  /**
   * What the route answers: 200 when left out, or 404 for a probe of the on-demand 404 of §8.12,
   * a path that matches no route and still draws a whole page.
   */
  status?: 200 | 404;
  width: number;
  height: number;
  siteState: SiteAction[];
}

export interface VisualManifest {
  version: number;
  cases: VisualCase[];
  baselines?: BaselineCase[];
}

/** The single list of cases (§14.5). */
export function loadManifest(file: string = MANIFEST_PATH): VisualManifest {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as VisualManifest;
}

// ---------- goldens ----------

/** One multi-item container as design/render/render.mjs measures it. */
export interface GridMeasure {
  kind: 'grid' | 'flex-wrap';
  path: string;
  rect: Rect;
  columns: number;
  children: number;
  cards: boolean;
  inTooltip: boolean;
  label: string;
  maxSpread: number;
  rows: { y: number; children: number[]; heights: number[]; heightSpread: number }[];
}

/** The measure.json of a golden. */
export interface BoardMeasure {
  board: string;
  state: Record<string, unknown>;
  viewport: { width: number; height: number };
  declaredHeight: number;
  renderedHeight: number;
  width: number;
  contentHeight: number;
  overflow: boolean;
  rawHoles: string[];
  brokenImages: string[];
  missingBlobs: string[];
  consoleErrors: string[];
  webFontsLoaded: string[];
  grids: GridMeasure[];
  flexWraps: GridMeasure[];
  /** `--boxes` of design/render/render.mjs: the anchors, `null` when nothing matched. */
  boxes?: Record<string, Rect | null>;
}

export function goldenPngPath(id: string): string {
  return path.join(GOLDENS_DIR, `${id}.png`);
}

export function loadGoldenMeasure(id: string): BoardMeasure {
  return JSON.parse(fs.readFileSync(path.join(GOLDENS_DIR, `${id}.measure.json`), 'utf8'));
}

/** `/es/pokedex/` -> `es-pokedex`. */
export function routeSlug(route: string): string {
  const trimmed = route.replace(/^\/+|\/+$/g, '');
  return trimmed ? trimmed.replace(/\//g, '-') : 'raiz';
}

/** The 390 px baseline of a route without a board (§14.5, step 4). */
export function baselinePngPath(route: string): string {
  return path.join(BASELINES_DIR, `${routeSlug(route)}--390.png`);
}

// ---------- 1. geometry ----------

export const GEOMETRY_TOLERANCE_PX = 1;

export interface GeometryFailure {
  anchor: string;
  field: string;
  golden: number;
  site: number;
}

export function toRect(box: { x: number; y: number; width: number; height: number }): Rect {
  return { x: box.x, y: box.y, w: box.width, h: box.height };
}

export function compareRect(
  anchor: string,
  golden: Rect,
  site: Rect,
  tolerance = GEOMETRY_TOLERANCE_PX,
  fields: readonly (keyof Rect)[] = ['x', 'y', 'w', 'h'],
): GeometryFailure[] {
  const failures: GeometryFailure[] = [];
  for (const field of fields) {
    if (Math.abs(golden[field] - site[field]) > tolerance) {
      failures.push({ anchor, field, golden: golden[field], site: site[field] });
    }
  }
  return failures;
}

/** The card grids of a board render, minus the ones the case declares as exceptions. */
export function cardGrids(measure: BoardMeasure, exceptions: GridException[] = []): GridMeasure[] {
  const excluded = new Set(exceptions.map((e) => e.path));
  return measure.grids.filter((g) => g.cards && !g.inTooltip && !excluded.has(g.path));
}

/** Same box, same number of columns, and no ragged row on the site (§14.5, WG2). */
export function compareGrid(
  anchor: string,
  golden: GridMeasure,
  site: { rect: Rect; columns: number; maxSpread: number },
  tolerance = GEOMETRY_TOLERANCE_PX,
): GeometryFailure[] {
  const failures = compareRect(anchor, golden.rect, site.rect, tolerance);
  if (golden.columns !== site.columns) {
    failures.push({ anchor, field: 'columns', golden: golden.columns, site: site.columns });
  }
  if (site.maxSpread !== 0) {
    failures.push({ anchor, field: 'maxSpread', golden: 0, site: site.maxSpread });
  }
  return failures;
}

/** A card grid of the site as the geometry step reads it, the way render.mjs measures one. */
export interface SiteGrid {
  rect: Rect;
  columns: number;
  children: number;
  rows: { y: number; heights: number[] }[];
  maxSpread: number;
}

/**
 * WG2 (§8.0.7): the grid exists with the same box, columns and children, and each of its rows
 * sits at the same height with the same card heights, all to ±1 px.
 */
export function compareGridRows(
  anchor: string,
  golden: GridMeasure,
  site: SiteGrid,
  tolerance = GEOMETRY_TOLERANCE_PX,
): GeometryFailure[] {
  const failures = compareGrid(anchor, golden, site, tolerance);
  if (golden.children !== site.children) {
    failures.push({ anchor, field: 'children', golden: golden.children, site: site.children });
  }
  if (golden.rows.length !== site.rows.length) {
    failures.push({ anchor, field: 'rows', golden: golden.rows.length, site: site.rows.length });
  }
  golden.rows.forEach((row, index) => {
    const other = site.rows[index];
    if (other === undefined) return;
    const at = `${anchor}.row${index + 1}`;
    if (Math.abs(row.y - other.y) > tolerance) {
      failures.push({ anchor: at, field: 'y', golden: row.y, site: other.y });
    }
    row.heights.forEach((height, column) => {
      const measured = other.heights[column];
      if (measured === undefined || Math.abs(height - measured) > tolerance) {
        failures.push({
          anchor: at,
          field: `h${column + 1}`,
          golden: height,
          site: measured ?? -1,
        });
      }
    });
  });
  return failures;
}

export function formatFailures(failures: GeometryFailure[]): string {
  return failures
    .map((f) => `${f.anchor}.${f.field}: board ${f.golden}, site ${f.site}`)
    .join('\n');
}

// ---------- 2-4. pixels ----------

export const DIFF_THRESHOLD = 0.15;

/** Share of differing pixels allowed by §14.5. */
export const MAX_DIFF_RATIO = {
  crop: 0.01,
  paridadCrop: 0.005,
  fullPage: 0.02,
  baseline: 0.001,
} as const;

/** Crops of a parity route are held to the tighter limit. */
export function cropLimit(route: string): number {
  return route.includes('/_paridad/') ? MAX_DIFF_RATIO.paridadCrop : MAX_DIFF_RATIO.crop;
}

/** Opaque magenta: painted on both images, so a masked area can never differ. */
export const MASK_COLOR: [number, number, number, number] = [255, 0, 255, 255];

export function readPng(file: string): PngImage {
  return PNG.sync.read(fs.readFileSync(file));
}

export function writePng(file: string, png: PngImage): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, PNG.sync.write(png));
}

/** Paints the approved deviations, clipped to the image. */
export function fillRects(png: PngImage, rects: Rect[], color = MASK_COLOR): void {
  for (const rect of rects) {
    const left = Math.max(0, Math.round(rect.x));
    const top = Math.max(0, Math.round(rect.y));
    const right = Math.min(png.width, Math.round(rect.x + rect.w));
    const bottom = Math.min(png.height, Math.round(rect.y + rect.h));
    for (let y = top; y < bottom; y++) {
      for (let x = left; x < right; x++) {
        const i = (y * png.width + x) * 4;
        png.data[i] = color[0];
        png.data[i + 1] = color[1];
        png.data[i + 2] = color[2];
        png.data[i + 3] = color[3];
      }
    }
  }
}

function cropTo(png: PngImage, width: number, height: number): PngImage {
  const exact = png.width === width && png.height === height;
  if (exact && png.data.length === width * height * 4) return png;
  const out = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    png.data.copy(out.data, y * width * 4, y * png.width * 4, (y * png.width + width) * 4);
  }
  return out;
}

export interface CompareOptions {
  /** Share of differing pixels allowed, from MAX_DIFF_RATIO. */
  limit: number;
  masks?: Rect[];
  threshold?: number;
  /**
   * `exact` for a full page or a baseline (§14.5 steps 3 and 4); `tolerant` for a crop,
   * where the ±1 px of the geometry step may change the box by one row or column.
   */
  size?: 'exact' | 'tolerant';
  /** Where to write the diff image when the comparison fails. */
  diffPath?: string;
}

export interface CompareResult {
  pass: boolean;
  ratio: number;
  diffPixels: number;
  width: number;
  height: number;
  limit: number;
  sizeError: string | null;
}

/** Compares a golden crop or page against the site capture (§14.5, steps 2 to 4). */
export function comparePngs(
  golden: PngImage,
  site: PngImage,
  options: CompareOptions,
): CompareResult {
  const size = options.size ?? 'tolerant';
  const dw = Math.abs(golden.width - site.width);
  const dh = Math.abs(golden.height - site.height);
  const allowed = size === 'exact' ? 0 : GEOMETRY_TOLERANCE_PX;
  const base = {
    pass: false,
    ratio: 1,
    diffPixels: 0,
    width: golden.width,
    height: golden.height,
    limit: options.limit,
  };
  if (dw > allowed || dh > allowed) {
    return {
      ...base,
      sizeError: `board ${golden.width}×${golden.height}, site ${site.width}×${site.height}`,
    };
  }

  const width = Math.min(golden.width, site.width);
  const height = Math.min(golden.height, site.height);
  const a = cropTo(golden, width, height);
  const b = cropTo(site, width, height);
  if (options.masks?.length) {
    fillRects(a, options.masks);
    fillRects(b, options.masks);
  }

  const diff = new PNG({ width, height });
  const diffPixels = pixelmatch(a.data, b.data, diff.data, width, height, {
    threshold: options.threshold ?? DIFF_THRESHOLD,
  });
  const ratio = width * height === 0 ? 1 : diffPixels / (width * height);
  const pass = ratio <= options.limit;
  if (!pass && options.diffPath) writePng(options.diffPath, diff);
  return { pass, ratio, diffPixels, width, height, limit: options.limit, sizeError: null };
}
