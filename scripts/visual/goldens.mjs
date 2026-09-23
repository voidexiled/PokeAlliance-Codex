#!/usr/bin/env node
// `pnpm visual:goldens` (§14.1, §14.5). Local only.
//
// Renders every case of tests/visual/manifest.json with the versioned harness and writes
// tests/visual/goldens/<id>.png and <id>.measure.json, then checks each render against
// the §14.5 criteria with the same gate `pnpm test:visual` uses.
//
// Per case it runs, exactly as §14.5 spells it out:
//   node design/render/render.mjs design/boards/<board>.dc.html --state '<json>' \
//        --width <w> --height <h> --scale 1 \
//        --out tests/visual/goldens/<id>.png --measure tests/visual/goldens/<id>.measure.json
//
// Goldens are only regenerated when a board changes, and that change needs the owner's
// approval in the PR (§14.5). Run it on Windows with the Chromium of @playwright/test:
// the boards use the system Verdana, which falls back to DejaVu Sans on Linux, and they
// fetch Poppins from Google Fonts, so the machine needs network access.
//
// Usage: node scripts/visual/goldens.mjs [--only <id>[,<id>…]]

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  ROOT,
  checkGolden,
  goldenPaths,
  boardPath,
  readManifest,
  validateManifest,
} from './run.mjs';

const RENDER = path.join(ROOT, 'design', 'render', 'render.mjs');

function parseArgs(argv) {
  const opts = { only: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--only') opts.only = new Set((argv[++i] || '').split(',').filter(Boolean));
    else return { error: `unknown argument: ${argv[i]}` };
  }
  return opts;
}

export function renderArgs(c) {
  const { png, measure } = goldenPaths(c.id);
  return [
    RENDER,
    boardPath(c.board),
    '--state',
    JSON.stringify(c.state),
    '--width',
    String(c.width),
    '--height',
    String(c.height),
    '--scale',
    '1',
    '--out',
    png,
    '--measure',
    measure,
  ];
}

function renderCase(c) {
  // spawnSync with an argument array: the state JSON never goes through a shell.
  const result = spawnSync(process.execPath, renderArgs(c), { cwd: ROOT, stdio: 'inherit' });
  return result.status ?? 1;
}

function main(argv) {
  const opts = parseArgs(argv);
  if (opts.error) {
    console.error(opts.error);
    console.error('usage: node scripts/visual/goldens.mjs [--only <id>[,<id>…]]');
    return 2;
  }

  const manifest = readManifest();
  const shapeErrors = validateManifest(manifest);
  if (shapeErrors.length) {
    console.error('tests/visual/manifest.json is invalid:');
    for (const e of shapeErrors) console.error(`  ${e}`);
    return 1;
  }

  const cases = opts.only
    ? manifest.cases.filter((c) => opts.only.has(c.id))
    : manifest.cases.slice();
  if (opts.only) {
    for (const id of opts.only) {
      if (!cases.some((c) => c.id === id)) {
        console.error(`no case with id ${id} in tests/visual/manifest.json`);
        return 1;
      }
    }
  }

  let failed = 0;
  for (const c of cases) {
    const status = renderCase(c);
    if (status !== 0) {
      console.error(`FAIL ${c.id}: render.mjs exited with ${status}`);
      failed += 1;
      continue;
    }
    const failures = checkGolden(c);
    if (failures.length) {
      failed += 1;
      console.error(`FAIL ${c.id}`);
      for (const f of failures) console.error(`  ${f}`);
    } else {
      console.log(`ok   ${c.id}`);
    }
  }

  if (failed) {
    console.error(`\n${failed} of ${cases.length} goldens fail §14.5.`);
    return 1;
  }
  const written = cases.length === 1 ? '1 golden' : `${cases.length} goldens`;
  console.log(`\n${written} written to tests/visual/goldens/ and meeting §14.5.`);
  return 0;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  process.exitCode = main(process.argv.slice(2));
}
