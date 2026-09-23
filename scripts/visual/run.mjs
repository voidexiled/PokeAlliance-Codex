#!/usr/bin/env node
// `pnpm test:visual` (§14.1, §14.5).
//
// Two stages, in this order:
//
// 1. Manifest and goldens gate. Reads tests/visual/manifest.json, the single list of
//    cases, checks its shape and checks every golden the manifest declares: the render
//    matches the case it belongs to and meets the §14.5 criteria (`overflow: false`,
//    `brokenImages: []` and `maxSpread: 0` on every card grid), and a case that measures
//    its geometry (§14.5 step 1, WG2) names a site selector for every card grid of its
//    golden. This stage needs no browser and no build, so it also runs on a machine
//    without a site build.
// 2. Site comparison. Only when the manifest has at least one case with a `route`, or a
//    390 baseline (§14.5 step 4): builds with VISUAL=1 (§14.5 "Datos de paridad") and runs
//    the Playwright `visual` project, forwarding any extra argument (`pnpm test:visual --
//    --grep "marco"`), then rebuilds without VISUAL so the tree is left with the
//    production output.
//
// The manifest starts with no site cases, so until a milestone adds a `route` this
// command is the goldens gate alone. Regenerating goldens is `pnpm visual:goldens`.

import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '..', '..');
export const MANIFEST_PATH = path.join(ROOT, 'tests', 'visual', 'manifest.json');
export const GOLDENS_DIR = path.join(ROOT, 'tests', 'visual', 'goldens');
export const BASELINES_DIR = path.join(ROOT, 'tests', 'visual', 'baselines');
export const BOARDS_DIR = path.join(ROOT, 'design', 'boards');

// Approved deviations, §14.5. A mask may only carry one of these ids: a new mask needs
// a new row in that table first.
const DEVIATION_IDS = new Set(['DV1', 'DV2', 'DV3', 'DV4', 'DV5', 'DV6', 'DV7', 'DV8', 'DV9']);

// Playwright actions a case may use to bring the site to the board's state (§14.5).
const SITE_ACTIONS = new Set(['click', 'hover', 'focus', 'press', 'waitFor']);

const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// §14.5 step 1: the sides of a box an anchor compares.
const RECT_FIELDS = new Set(['x', 'y', 'w', 'h']);

const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const isPositiveInt = (v) => Number.isInteger(v) && v > 0;

// Key order must not decide whether two states are the same.
function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (!isObject(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((k) => [k, sortKeys(value[k])]),
  );
}
const stable = (v) => JSON.stringify(sortKeys(v));

export function goldenPaths(id) {
  return {
    png: path.join(GOLDENS_DIR, `${id}.png`),
    measure: path.join(GOLDENS_DIR, `${id}.measure.json`),
  };
}

export function boardPath(board) {
  return path.join(BOARDS_DIR, `${board}.dc.html`);
}

export function readManifest() {
  const raw = fs.readFileSync(MANIFEST_PATH, 'utf8');
  return JSON.parse(raw);
}

function validateRect(rect, where, errors) {
  if (!isObject(rect)) {
    errors.push(`${where}: rect must be an object {x, y, w, h}`);
    return;
  }
  for (const key of ['x', 'y', 'w', 'h']) {
    if (typeof rect[key] !== 'number') errors.push(`${where}: rect.${key} must be a number`);
  }
}

function validateSiteState(steps, where, errors) {
  if (!Array.isArray(steps)) {
    errors.push(`${where}: siteState must be an array`);
    return;
  }
  for (const [i, step] of steps.entries()) {
    if (!isObject(step) || !SITE_ACTIONS.has(step.action)) {
      errors.push(
        `${where}: siteState[${i}].action must be one of ${[...SITE_ACTIONS].join(', ')}`,
      );
      continue;
    }
    if (step.action === 'press' && typeof step.key !== 'string') {
      errors.push(`${where}: siteState[${i}] needs a key`);
    }
    if (step.action !== 'press' && typeof step.selector !== 'string') {
      errors.push(`${where}: siteState[${i}] needs a selector`);
    }
  }
}

// §14.5 step 1 (WG2): the anchors of a case and the site selector of each card grid.
function validateGeometry(geometry, where, errors) {
  if (!isObject(geometry)) {
    errors.push(`${where}: geometry must be an object`);
    return;
  }
  const names = new Set();
  if (!Array.isArray(geometry.anchors)) errors.push(`${where}: geometry.anchors must be an array`);
  else {
    for (const [i, anchor] of geometry.anchors.entries()) {
      if (
        !isObject(anchor) ||
        typeof anchor.name !== 'string' ||
        typeof anchor.boardSelector !== 'string' ||
        typeof anchor.siteSelector !== 'string'
      ) {
        errors.push(`${where}: geometry.anchors[${i}] needs name, boardSelector and siteSelector`);
        continue;
      }
      if (names.has(anchor.name)) errors.push(`${where}: duplicate anchor ${anchor.name}`);
      names.add(anchor.name);
      if (
        anchor.fields !== undefined &&
        (!Array.isArray(anchor.fields) ||
          anchor.fields.length === 0 ||
          anchor.fields.some((field) => !RECT_FIELDS.has(field)))
      ) {
        errors.push(`${where}: geometry.anchors[${i}].fields must be a list of x, y, w, h`);
      }
    }
  }
  if (!Array.isArray(geometry.grids)) errors.push(`${where}: geometry.grids must be an array`);
  else {
    for (const [i, grid] of geometry.grids.entries()) {
      if (
        !isObject(grid) ||
        typeof grid.path !== 'string' ||
        typeof grid.siteSelector !== 'string'
      ) {
        errors.push(`${where}: geometry.grids[${i}] needs path and siteSelector`);
      }
    }
  }
}

function validateCase(c, index, seen, errors) {
  const where = `case ${typeof c.id === 'string' ? c.id : `#${index}`}`;
  if (typeof c.id !== 'string' || !ID_RE.test(c.id)) {
    errors.push(`${where}: id must be kebab-case`);
  } else if (seen.has(c.id)) {
    errors.push(`${where}: duplicate id`);
  } else {
    seen.add(c.id);
  }
  if (typeof c.board !== 'string' || !c.board) errors.push(`${where}: board is required`);
  else if (!fs.existsSync(boardPath(c.board))) {
    errors.push(`${where}: board file not found: ${path.relative(ROOT, boardPath(c.board))}`);
  }
  if (!isObject(c.state)) errors.push(`${where}: state must be an object`);
  if (!isPositiveInt(c.width)) errors.push(`${where}: width must be a positive integer`);
  if (!isPositiveInt(c.height)) errors.push(`${where}: height must be a positive integer`);

  const isSiteCase = typeof c.route === 'string';
  if (!isSiteCase && c.route !== null) errors.push(`${where}: route must be a string or null`);
  if (isSiteCase && !c.route.startsWith('/')) errors.push(`${where}: route must start with "/"`);

  validateSiteState(c.siteState, where, errors);
  if (c.geometry !== undefined) {
    validateGeometry(c.geometry, where, errors);
    if (!isSiteCase) errors.push(`${where}: geometry needs a route`);
  }
  if (c.pending !== undefined && (typeof c.pending !== 'string' || c.pending === '')) {
    errors.push(`${where}: pending must be a non-empty string`);
  }
  if (c.pending !== undefined && c.geometry === undefined) {
    errors.push(`${where}: pending applies to geometry, which this case does not have`);
  }

  const cropNames = new Set();
  if (!Array.isArray(c.crops)) errors.push(`${where}: crops must be an array`);
  else {
    for (const [i, crop] of c.crops.entries()) {
      if (!isObject(crop) || typeof crop.name !== 'string') {
        errors.push(`${where}: crops[${i}].name is required`);
        continue;
      }
      if (cropNames.has(crop.name)) errors.push(`${where}: duplicate crop ${crop.name}`);
      cropNames.add(crop.name);
      if (typeof crop.boardSelector !== 'string' || typeof crop.siteSelector !== 'string') {
        errors.push(`${where}: crops[${i}] needs boardSelector and siteSelector`);
      }
      if (crop.pending !== undefined && (typeof crop.pending !== 'string' || crop.pending === '')) {
        errors.push(`${where}: crops[${i}].pending must be a non-empty string`);
      }
    }
  }

  if (!Array.isArray(c.masks)) errors.push(`${where}: masks must be an array`);
  else {
    for (const [i, mask] of c.masks.entries()) {
      if (!isObject(mask) || !DEVIATION_IDS.has(mask.id)) {
        errors.push(`${where}: masks[${i}].id must be an approved deviation (§14.5 DV table)`);
        continue;
      }
      if (mask.crop != null && !cropNames.has(mask.crop)) {
        errors.push(`${where}: masks[${i}].crop names no crop of this case: ${mask.crop}`);
      }
      validateRect(mask.rect, `${where}: masks[${i}]`, errors);
    }
  }

  if (c.fullPage !== undefined && typeof c.fullPage !== 'boolean') {
    errors.push(`${where}: fullPage must be a boolean`);
  }
  if (c.gridExceptions !== undefined) {
    if (!Array.isArray(c.gridExceptions)) errors.push(`${where}: gridExceptions must be an array`);
    else {
      for (const [i, ex] of c.gridExceptions.entries()) {
        if (!isObject(ex) || typeof ex.path !== 'string' || !ex.path) {
          errors.push(`${where}: gridExceptions[${i}].path is required`);
          continue;
        }
        if (typeof ex.maxSpread !== 'number') {
          errors.push(`${where}: gridExceptions[${i}].maxSpread must be a number`);
        }
        if (typeof ex.reason !== 'string' || !ex.reason) {
          errors.push(`${where}: gridExceptions[${i}].reason is required`);
        }
      }
    }
  }

  if (!isSiteCase) {
    if (Array.isArray(c.crops) && c.crops.length) {
      errors.push(`${where}: crops need a route`);
    }
    if (Array.isArray(c.masks) && c.masks.length) errors.push(`${where}: masks need a route`);
    if (Array.isArray(c.siteState) && c.siteState.length) {
      errors.push(`${where}: siteState needs a route`);
    }
  }
}

export function validateManifest(manifest) {
  const errors = [];
  if (!isObject(manifest)) return ['manifest must be an object'];
  if (manifest.version !== 1) errors.push('manifest.version must be 1');
  if (!Array.isArray(manifest.cases) || manifest.cases.length === 0) {
    errors.push('manifest.cases must be a non-empty array');
    return errors;
  }
  const seen = new Set();
  manifest.cases.forEach((c, i) => validateCase(c, i, seen, errors));
  // §14.5 step 4: the site's own 390 baselines, for the widths no board draws.
  if (manifest.baselines !== undefined) {
    if (!Array.isArray(manifest.baselines)) errors.push('manifest.baselines must be an array');
    else {
      for (const [i, b] of manifest.baselines.entries()) {
        const where = `baseline ${typeof b?.id === 'string' ? b.id : `#${i}`}`;
        if (typeof b?.id !== 'string' || !ID_RE.test(b.id))
          errors.push(`${where}: id must be kebab-case`);
        else if (seen.has(b.id)) errors.push(`${where}: duplicate id`);
        else seen.add(b.id);
        if (typeof b?.route !== 'string' || !b.route.startsWith('/')) {
          errors.push(`${where}: route must start with "/"`);
        }
        // 200 by default; 404 only for a probe of the on-demand 404 of §8.12.
        if (b?.status !== undefined && b.status !== 200 && b.status !== 404) {
          errors.push(`${where}: status must be 200 or 404`);
        }
        if (!isPositiveInt(b?.width)) errors.push(`${where}: width must be a positive integer`);
        if (!isPositiveInt(b?.height)) errors.push(`${where}: height must be a positive integer`);
        validateSiteState(b?.siteState, where, errors);
      }
    }
  }
  return errors;
}

// Width and height from the IHDR chunk, without decoding the image.
export function pngSize(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const head = Buffer.alloc(24);
    const read = fs.readSync(fd, head, 0, 24, 0);
    if (read < 24 || head.toString('ascii', 12, 16) !== 'IHDR') return null;
    return { width: head.readUInt32BE(16), height: head.readUInt32BE(20) };
  } finally {
    fs.closeSync(fd);
  }
}

// §14.5: every golden meets `overflow: false`, `brokenImages: []` and `maxSpread: 0` on
// every card grid. A render that lost a blob, printed a console error or left a raw
// `{{hole}}` is a broken reference, so those count as failures too.
export function checkGolden(c) {
  const { png, measure: measurePath } = goldenPaths(c.id);
  const failures = [];
  if (!fs.existsSync(png)) failures.push(`missing ${path.relative(ROOT, png)}`);
  if (!fs.existsSync(measurePath)) {
    failures.push(`missing ${path.relative(ROOT, measurePath)}`);
    return failures;
  }
  const m = JSON.parse(fs.readFileSync(measurePath, 'utf8'));

  if (m.board !== `${c.board}.dc.html`) failures.push(`measured board is ${m.board}`);
  if (stable(m.state) !== stable(c.state)) {
    failures.push(`measured state ${JSON.stringify(m.state)} ≠ ${JSON.stringify(c.state)}`);
  }
  if (!m.viewport || m.viewport.width !== c.width || m.viewport.height !== c.height) {
    failures.push(
      `measured viewport ${m.viewport && `${m.viewport.width}×${m.viewport.height}`} ≠ ${c.width}×${c.height}`,
    );
  }
  if (fs.existsSync(png)) {
    // The full-page shot is as wide as the viewport and as tall as the document, which
    // rounds up when the layout ends on a half pixel: same ±1 px as §14.5's geometry.
    const size = pngSize(png);
    if (!size) failures.push('golden is not a PNG');
    else if (size.width !== c.width || Math.abs(size.height - c.height) > 1) {
      failures.push(`golden is ${size.width}×${size.height}, expected ${c.width}×${c.height}`);
    }
  }

  if (m.overflow !== false)
    failures.push(`overflow: content ${m.contentHeight} > ${m.declaredHeight}`);
  for (const [key, label] of [
    ['brokenImages', 'broken images'],
    ['missingBlobs', 'missing blobs'],
    ['consoleErrors', 'console errors'],
    ['rawHoles', 'unfilled holes'],
  ]) {
    const list = m[key];
    if (Array.isArray(list) && list.length) failures.push(`${label}: ${list.join(', ')}`);
  }

  const exceptions = (c.gridExceptions || []).map((ex) => ({ ...ex, used: false }));
  for (const grid of m.grids || []) {
    // §14.5 asks for `maxSpread: 0` «en toda rejilla de tarjetas», with no exception for
    // the ones inside a tooltip panel. None of the nine boards has one today, so this is
    // the gate being ready for the tooltip cases M4 adds to the manifest.
    if (!grid.cards) continue;
    if (grid.maxSpread === 0) continue;
    const ex = exceptions.find((e) => e.path === grid.path);
    if (ex && ex.maxSpread === grid.maxSpread) {
      ex.used = true;
      continue;
    }
    failures.push(`card grid ${grid.path} has maxSpread ${grid.maxSpread}`);
  }
  for (const ex of exceptions) {
    if (!ex.used) failures.push(`stale gridExceptions entry: ${ex.path}`);
  }

  // WG2 (§8.0.7): every card grid the harness measures is compared with the site, so a case
  // that measures its geometry names the site selector of each one, and of none other.
  if (c.geometry) {
    const excluded = new Set((c.gridExceptions || []).map((ex) => ex.path));
    const mapped = new Set(c.geometry.grids.map((grid) => grid.path));
    const cardGrids = (m.grids || []).filter(
      (grid) => grid.cards && !grid.inTooltip && !excluded.has(grid.path),
    );
    for (const grid of cardGrids) {
      if (!mapped.has(grid.path)) failures.push(`card grid ${grid.path} has no site selector`);
    }
    for (const path of mapped) {
      if (!cardGrids.some((grid) => grid.path === path)) {
        failures.push(`geometry.grids names ${path}, which is no card grid of the golden`);
      }
    }
  }
  return failures;
}

export function checkGoldens(manifest) {
  const report = [];
  for (const c of manifest.cases) {
    report.push({ id: c.id, failures: checkGolden(c) });
  }
  return report;
}

function runNode(args, env) {
  const merged = { ...process.env, ...env };
  // An explicit `undefined` unsets the variable for the child: the restore build below
  // has to run without VISUAL even when the caller exported it.
  for (const key of Object.keys(merged)) {
    if (merged[key] === undefined) delete merged[key];
  }
  const result = spawnSync(process.execPath, args, { cwd: ROOT, stdio: 'inherit', env: merged });
  return result.status ?? 1;
}

const ASTRO_CLI = path.join('node_modules', 'astro', 'bin', 'astro.mjs');

function main(argv) {
  const manifest = readManifest();
  const shapeErrors = validateManifest(manifest);
  if (shapeErrors.length) {
    console.error('tests/visual/manifest.json is invalid:');
    for (const e of shapeErrors) console.error(`  ${e}`);
    return 1;
  }

  let failed = 0;
  for (const { id, failures } of checkGoldens(manifest)) {
    if (failures.length) {
      failed += 1;
      console.error(`FAIL ${id}`);
      for (const f of failures) console.error(`  ${f}`);
    } else {
      console.log(`ok   ${id}`);
    }
  }
  if (failed) {
    console.error(
      `\n${failed} of ${manifest.cases.length} goldens fail §14.5. ` +
        'Regenerate with `pnpm visual:goldens` after an approved board change.',
    );
    return 1;
  }
  console.log(`${manifest.cases.length} goldens meet §14.5.`);

  const siteCases = [
    ...manifest.cases.filter((c) => typeof c.route === 'string'),
    ...(manifest.baselines ?? []),
  ];
  if (!siteCases.length) {
    console.log('No site cases in the manifest yet: nothing to compare against the site.');
    return 0;
  }

  console.log(`\nBuilding with VISUAL=1 for ${siteCases.length} site cases…`);
  const build = runNode([ASTRO_CLI, 'build'], { VISUAL: '1' });
  if (build !== 0) return build;

  const requireFromHere = createRequire(import.meta.url);
  const playwrightCli = requireFromHere.resolve('@playwright/test/cli');
  // `pnpm test:visual -- --grep x` hands this script a leading `--` (pnpm 11 passes it on),
  // and Playwright reads everything after a `--` as file filters, so `--grep` would be
  // ignored and every case would run.
  const forwarded = argv[0] === '--' ? argv.slice(1) : argv;
  const visual = runNode([playwrightCli, 'test', '--project=visual', ...forwarded], {
    VISUAL: '1',
  });

  // The parity build is still in .vercel/output, and every other gate reads that
  // directory as the production output: `seo:check` fails on the `/_paridad/` routes it
  // carries (§14.5, §13.5) and `perf:budget` would measure the parity registries instead
  // of `content/`. Leave the tree with the production build so this command composes with
  // `pnpm run ci` and with the `prod` Playwright project. To look at the parity build
  // again, run `VISUAL=1 pnpm build`.
  console.log('\nRebuilding without VISUAL so .vercel/output holds the production output…');
  const restored = runNode([ASTRO_CLI, 'build'], { VISUAL: undefined });
  if (restored !== 0) {
    console.error(
      '.vercel/output still holds the VISUAL build: run `pnpm build` before any other gate.',
    );
    return restored;
  }
  return visual;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  process.exitCode = main(process.argv.slice(2));
}
