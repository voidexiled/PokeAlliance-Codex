// The startup gate of the Vercel output emulator (§14.3, M2 acceptance).
//
// The emulator has no route table of its own: it walks the `routes` the adapter
// writes. That only measures the deployment while every property of every route is
// one the emulator implements. A new adapter version that starts writing `has`,
// `missing`, `check` or `middlewarePath` would silently change what the `prod`
// Playwright project measures, so the emulator refuses to start and names the
// property instead. This test keeps that refusal wired to a fake config.json, the
// way M2's acceptance asks.

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const EMULATOR = fileURLToPath(
  new URL('../../scripts/test/serve-vercel-output.mjs', import.meta.url),
);
const FAKE_OUTPUT = fileURLToPath(
  new URL('../fixtures/vercel-output-desconocido', import.meta.url),
);

function runEmulator(...args: string[]) {
  return spawnSync(process.execPath, [EMULATOR, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 30_000,
  });
}

describe('serve-vercel-output, startup gate', () => {
  const result = runEmulator('--dir', FAKE_OUTPUT);
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;

  it('exits 1 instead of serving a config it does not understand', () => {
    expect(result.status).toBe(1);
  });

  // The acceptance is that it names the property. A generic "invalid config" would
  // leave whoever bumps @astrojs/vercel guessing.
  it.each(['has', 'missing', 'check', 'middlewarePath'])(
    'names the unknown route property «%s»',
    (property) => {
      expect(output).toContain(`propiedad de ruta desconocida «${property}»`);
    },
  );

  it('reports every unknown property of the file in one run', () => {
    const lines = output
      .split('\n')
      .filter((line) => line.includes('propiedad de ruta desconocida'));
    expect(lines).toHaveLength(4);
  });

  it('points at the file it could not read', () => {
    expect(output).toContain('config.json');
  });
});

describe('serve-vercel-output, missing output', () => {
  it('fails when --dir has no config.json', () => {
    const result = runEmulator('--dir', fileURLToPath(new URL('../fixtures', import.meta.url)));
    expect(result.status).toBe(1);
    expect(`${result.stdout ?? ''}${result.stderr ?? ''}`).toContain('config.json');
  });
});
