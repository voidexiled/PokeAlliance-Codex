// pnpm i18n:check — the two build rules of the dictionaries (spec §13.2):
//
// 1. every leaf of `src/i18n/messages/es.ts` is read somewhere under `src/` as
//    `.<clave>`, or is declared in `src/i18n/dynamic-keys.ts`. A key nothing
//    reads is dead copy; a key read only with computed access is declared.
// 2. no file under `src/components`, `src/pages` or `src/layouts` chooses its
//    text with `locale === 'es'`: the text comes from the dictionary of the
//    page's locale.
//
// Prints a Spanish summary and exits with 1 when there are errors.
//
// Usage: node scripts/i18n/check.mjs [--root <carpeta del repositorio>]

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const args = process.argv.slice(2).filter((arg) => arg !== '--');
if (args.includes('--help')) {
  console.log('Uso: pnpm i18n:check [--root <carpeta del repositorio>]');
  process.exit(0);
}
const rootIndex = args.indexOf('--root');
const root =
  rootIndex >= 0 && args[rootIndex + 1]
    ? path.resolve(args[rootIndex + 1])
    : fileURLToPath(new URL('../../', import.meta.url));

// Files the dictionaries live in: they define the keys, they do not read them.
const DICTIONARY_DIR = path.join(root, 'src', 'i18n', 'messages');
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.astro', '.js', '.jsx', '.mjs', '.md', '.mdx']);
const LOCALE_BRANCH = /locale\s*(?:===|!==)\s*(['"])(?:es|en)\1/;

function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(full));
    } else if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(full);
    }
  }
  return files;
}

function relative(file) {
  return path.relative(root, file).split(path.sep).join('/');
}

// The dictionaries are TypeScript. Node loads them directly once type stripping
// is on by default; on an older Node the same import runs in a child process
// with the flag. Either way the leaf list comes from `messageKeys`, so this
// check and the tests share one definition of what a leaf is.
async function loadDictionary() {
  const modules = {
    es: pathToFileURL(path.join(DICTIONARY_DIR, 'es.ts')).href,
    types: pathToFileURL(path.join(DICTIONARY_DIR, 'types.ts')).href,
    dynamic: pathToFileURL(path.join(root, 'src', 'i18n', 'dynamic-keys.ts')).href,
  };
  try {
    const [{ es }, { messageKeys }, { dynamicKeys }] = await Promise.all([
      import(modules.es),
      import(modules.types),
      import(modules.dynamic),
    ]);
    return { keys: messageKeys(es), dynamicKeys: [...dynamicKeys] };
  } catch {
    const source = [
      `import { es } from ${JSON.stringify(modules.es)};`,
      `import { messageKeys } from ${JSON.stringify(modules.types)};`,
      `import { dynamicKeys } from ${JSON.stringify(modules.dynamic)};`,
      'process.stdout.write(JSON.stringify({ keys: messageKeys(es), dynamicKeys: [...dynamicKeys] }));',
    ].join('\n');
    const child = spawnSync(
      process.execPath,
      ['--experimental-strip-types', '--no-warnings', '--input-type=module', '-e', source],
      { encoding: 'utf8' },
    );
    if (child.status !== 0) {
      throw new Error(`No se pudieron leer los diccionarios:\n${child.stderr.trim()}`);
    }
    return JSON.parse(child.stdout);
  }
}

function checkOrphanKeys(keys, dynamicKeys, errors) {
  const declared = new Set(dynamicKeys);
  const sources = listFiles(path.join(root, 'src')).filter(
    (file) => !file.startsWith(DICTIONARY_DIR + path.sep),
  );
  const corpus = sources.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
  for (const key of keys) {
    if (declared.has(key)) continue;
    const leaf = key.slice(key.lastIndexOf('.') + 1);
    const read = new RegExp(`\\.${leaf.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w$])`);
    if (!read.test(corpus)) {
      errors.push(
        `Clave sin uso: «${key}». Ningún archivo de src/ la lee como «.${leaf}» ` +
          'y no está en src/i18n/dynamic-keys.ts.',
      );
    }
  }
  for (const key of dynamicKeys) {
    if (!keys.includes(key)) {
      errors.push(`src/i18n/dynamic-keys.ts declara «${key}», que no existe en es.ts.`);
    }
  }
}

function checkLocaleBranches(errors) {
  for (const dir of ['components', 'pages', 'layouts']) {
    for (const file of listFiles(path.join(root, 'src', dir))) {
      if (!LOCALE_BRANCH.test(fs.readFileSync(file, 'utf8'))) continue;
      errors.push(
        `${relative(file)} elige el texto con «locale === '…'». El texto sale del ` +
          'diccionario del idioma de la página (§13.2).',
      );
    }
  }
}

const errors = [];
const { keys, dynamicKeys } = await loadDictionary();
checkOrphanKeys(keys, dynamicKeys, errors);
checkLocaleBranches(errors);

console.log(`Claves en es.ts: ${keys.length} (${dynamicKeys.length} de acceso calculado).`);
if (errors.length) {
  console.log('');
  for (const error of errors) console.log(`- ${error}`);
  console.log(`\n${errors.length} error(es).`);
} else {
  console.log('Sin errores.');
}
process.exitCode = errors.length ? 1 : 0;
