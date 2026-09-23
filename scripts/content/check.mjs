// pnpm content:check — validates every JSON file under content/ and
// public/sprites/sprites.json: JSON Schemas, unique ids, references between
// files, sprite keys, image files and PNG sizes. Prints a Spanish summary and
// exits with 1 when there are errors.
//
// Usage: node scripts/content/check.mjs [--root <carpeta del repositorio>]

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { checkContent, formatReport } from './lib/check-content.mjs';

const args = process.argv.slice(2).filter((arg) => arg !== '--');
const rootIndex = args.indexOf('--root');
if (args.includes('--help')) {
  console.log('Uso: pnpm content:check [--root <carpeta del repositorio>]');
  process.exit(0);
}
const root =
  rootIndex >= 0 && args[rootIndex + 1]
    ? path.resolve(args[rootIndex + 1])
    : fileURLToPath(new URL('../../', import.meta.url));

const result = checkContent(root);
console.log(formatReport(result));
process.exitCode = result.errors.length ? 1 : 0;
