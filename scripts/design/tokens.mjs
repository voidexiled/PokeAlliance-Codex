#!/usr/bin/env node
// Generates the three artifacts derived from src/design/tokens.json (spec §3.2).
//
//   src/styles/tokens.css   — the token custom properties, split per §3.4.
//   src/styles/theme.css    — the Tailwind aliases and the 22 type utilities, per §3.5.
//   src/lib/design/tokens.ts — the same values for code that cannot read CSS.
//
// Usage:
//   node scripts/design/tokens.mjs           writes the three files
//   node scripts/design/tokens.mjs --check   regenerates in memory, compares byte for byte
//                                            and exits 1 naming every stale file
//
// No dependencies: plain Node. src/design/tokens.json is the only place where a design
// value is written; nothing here invents one.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SOURCE = 'src/design/tokens.json';
const GENERATOR = 'scripts/design/tokens.mjs';

const HEADER_CSS = `/* GENERADO por ${GENERATOR} desde ${SOURCE}. No editar. */`;
const HEADER_TS = `// GENERADO por ${GENERATOR} desde ${SOURCE}. No editar.`;

// The radius, family and ease tokens already carry a Tailwind 4 theme namespace in their DS
// name, so they go to `@theme static`, where the namespace builds the utility from a literal
// value instead of a self-referencing variable. The only shadow token in that position is
// text-shadow-game; the other three stay in `@layer theme` and get an alias in theme.css (§3.4).
const STATIC_SHADOW = 'text-shadow-game';

// `text-transform: uppercase` is a CSS-only trait of two text styles (§3.5, §4.1); the DS
// records it in prose ("en mayúsculas (text-transform en CSS)"), not as a token value.
const UPPERCASE_STYLES = new Set(['ui-caps', 'tt-title']);

// Breakpoint tokens whose value, divided by 16, becomes a Tailwind `--breakpoint-*` (§3.4).
const BREAKPOINTS = [
  ['md', 'layout-bp-md'],
  ['xl', 'layout-bp-xl'],
];

/** Turns a DS token name into its identifier in tokens.ts: `bg-primary` -> `bgPrimary`. */
function camel(name) {
  return name.replace(/-([a-z0-9])/g, (_, char) => char.toUpperCase());
}

/** Emits a JavaScript string literal with the repo's single-quote style. */
function quote(value) {
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

/** `768px` -> `48rem`, for the two breakpoint tokens. */
function toRem(value) {
  const px = Number.parseFloat(value);
  if (!Number.isFinite(px)) throw new Error(`Breakpoint sin valor en px: ${value}`);
  return `${String(px / 16)}rem`;
}

function byName(tokens) {
  const map = new Map();
  for (const token of tokens) map.set(token.name, token);
  return map;
}

/** Every text style of tokens.json, carrying the family of its group. */
function textStyles(tokensJson) {
  return tokensJson.type.groups.flatMap((group) =>
    group.styles.map((style) => ({ ...style, family: group.family })),
  );
}

function assertShape(tokensJson) {
  const groups = ['color', 'spacing', 'radius', 'shadow', 'layout', 'size', 'grid', 'opacity'];
  for (const group of [...groups, 'zIndex', 'motion']) {
    const list = tokensJson[group]?.tokens;
    if (!Array.isArray(list) || list.length === 0) {
      throw new Error(`${SOURCE}: falta el grupo «${group}»`);
    }
    for (const token of list) {
      if (!token.name || !token.value || !token.usage) {
        throw new Error(`${SOURCE}: el token «${token.name ?? '?'}» de «${group}» está incompleto`);
      }
    }
  }
  for (const family of ['sans', 'game', 'mono']) {
    if (!tokensJson.type?.families?.[family]) {
      throw new Error(`${SOURCE}: falta la familia «${family}»`);
    }
  }
  for (const style of textStyles(tokensJson)) {
    if (!style.name || !style.fontSize || !style.lineHeight || !style.fontWeight) {
      throw new Error(`${SOURCE}: el estilo de texto «${style.name ?? '?'}» está incompleto`);
    }
  }
}

// ---------------------------------------------------------------------------- tokens.css

function buildTokensCss(tokensJson) {
  const layout = byName(tokensJson.layout.tokens);
  const lines = [];
  const push = (line = '') => lines.push(line);

  push(HEADER_CSS);
  push();
  push('/* Tokens del sistema de diseño (§3.4). Un solo tema, «Oscuro»: todo vive en :root. */');
  push();
  push('@theme static {');
  push('  /* Ningún token del tema por defecto de Tailwind sobrevive. */');
  push('  --*: initial;');
  push();
  push('  /* El número de una utilidad de espacio es su valor en píxeles: p-16 son 16px. */');
  push('  --spacing: 1px;');
  push();
  push('  /* Puntos de corte, de layout-bp-md y layout-bp-xl ÷ 16. */');
  for (const [alias, token] of BREAKPOINTS) {
    push(`  --breakpoint-${alias}: ${toRem(layout.get(token).value)};`);
  }
  push();
  push('  /* Valores por defecto de Tailwind. */');
  push('  --default-transition-duration: var(--duration-fast);');
  push('  --default-transition-timing-function: var(--ease-standard);');
  push('  --default-font-family: var(--font-sans);');
  push('  --default-mono-font-family: var(--font-mono);');
  push();
  push('  /* Radios: el nombre del token ya es el espacio de nombres --radius-* de Tailwind. */');
  for (const token of tokensJson.radius.tokens) {
    push(`  --${token.name}: ${token.value};`);
  }
  push();
  push('  /* Familias (type.families). */');
  for (const [family, value] of Object.entries(tokensJson.type.families)) {
    push(`  --font-${family}: ${value};`);
  }
  push();
  push('  /* Sombra de texto: espacio de nombres --text-shadow-* de Tailwind. */');
  for (const token of tokensJson.shadow.tokens) {
    if (token.name === STATIC_SHADOW) push(`  --${token.name}: ${token.value};`);
  }
  push();
  push('  /* Curvas: espacio de nombres --ease-* de Tailwind. */');
  for (const token of tokensJson.motion.tokens) {
    if (token.name.startsWith('ease-')) push(`  --${token.name}: ${token.value};`);
  }
  push('}');
  push();
  push('@layer theme {');
  push('  :root {');

  const blocks = [
    ['Color', tokensJson.color.tokens],
    ['Espaciado', tokensJson.spacing.tokens],
    ['Sombras y anillos', tokensJson.shadow.tokens.filter((t) => t.name !== STATIC_SHADOW)],
    ['Marco', tokensJson.layout.tokens],
    ['Tamaños', tokensJson.size.tokens],
    ['Rejillas', tokensJson.grid.tokens],
    ['Opacidades', tokensJson.opacity.tokens],
    ['Capas z', tokensJson.zIndex.tokens],
    ['Duraciones', tokensJson.motion.tokens.filter((t) => t.name.startsWith('duration-'))],
  ];
  blocks.forEach(([title, tokens], index) => {
    if (index > 0) push();
    push(`    /* ${title} */`);
    for (const token of tokens) push(`    --${token.name}: ${token.value};`);
  });

  push('  }');
  push('}');
  push();
  return lines.join('\n');
}

// ----------------------------------------------------------------------------- theme.css

/** The Tailwind alias a colour token maps to (§3.5). */
function colorAlias(name) {
  if (name.startsWith('bg-')) return `--background-color-${name.slice(3)}`;
  if (name.startsWith('text-')) return `--text-color-${name.slice(5)}`;
  if (name.startsWith('border-')) return `--border-color-${name.slice(7)}`;
  return `--color-${name}`;
}

function buildThemeCss(tokensJson) {
  const colors = tokensJson.color.tokens;
  const lines = [];
  const push = (line = '') => lines.push(line);

  const group = (title, tokens, alias) => {
    push(`  /* ${title} */`);
    for (const token of tokens) push(`  ${alias(token.name)}: var(--${token.name});`);
  };

  push(HEADER_CSS);
  push();
  push('/* Utilidades del sistema de diseño (§3.5). */');
  push();
  push('@theme inline {');
  group(
    'Fondo',
    colors.filter((t) => t.name.startsWith('bg-')),
    colorAlias,
  );
  push();
  group(
    'Texto',
    colors.filter((t) => t.name.startsWith('text-')),
    colorAlias,
  );
  push();
  group(
    'Borde',
    colors.filter((t) => t.name.startsWith('border-')),
    colorAlias,
  );
  push();
  push('  /* Resto de colores, con cualquier prefijo de color */');
  for (const token of colors) {
    const plain =
      !token.name.startsWith('bg-') &&
      !token.name.startsWith('text-') &&
      !token.name.startsWith('border-');
    if (plain) push(`  ${colorAlias(token.name)}: var(--${token.name});`);
  }
  push();
  group(
    'Sombras',
    tokensJson.shadow.tokens.filter((t) => t.name !== STATIC_SHADOW),
    (name) => `--shadow-${name}`,
  );
  push('}');
  push();
  push('/* Estilos de texto (§4.1): los únicos 22 del sitio. */');

  for (const style of textStyles(tokensJson)) {
    push();
    push(`@utility type-${style.name} {`);
    push(`  font-size: ${style.fontSize};`);
    push(`  line-height: ${style.lineHeight};`);
    push(`  font-weight: ${style.fontWeight};`);
    if (style.family !== 'sans') push(`  font-family: var(--font-${style.family});`);
    if (style.fontStyle) push(`  font-style: ${style.fontStyle};`);
    if (style.letterSpacing) push(`  letter-spacing: ${style.letterSpacing};`);
    if (UPPERCASE_STYLES.has(style.name)) push('  text-transform: uppercase;');
    push('}');
  }

  push();
  return lines.join('\n');
}

// ----------------------------------------------------------------------------- tokens.ts

function buildTokensTs(tokensJson) {
  const lines = [];
  const push = (line = '') => lines.push(line);

  const record = (exportName, comment, tokens) => {
    push(`/** ${comment} */`);
    push(`export const ${exportName} = {`);
    for (const token of tokens) push(`  ${camel(token.name)}: ${quote(token.value)},`);
    push('} as const;');
    push();
  };

  push(HEADER_TS);
  push();
  push('// Los mismos valores que src/styles/tokens.css, para el código que no lee CSS');
  push('// (<meta name="theme-color"> y el PNG del ranking de Guild).');
  push();

  record('color', 'Colores del tema «Oscuro».', tokensJson.color.tokens);

  push('/** Familias tipográficas (type.families). */');
  push('export const fontFamily = {');
  for (const [family, value] of Object.entries(tokensJson.type.families)) {
    push(`  ${family}: ${quote(value)},`);
  }
  push('} as const;');
  push();

  push('/** Los 22 estilos de texto (§4.1). */');
  push('export const type = {');
  for (const style of textStyles(tokensJson)) {
    push(`  ${camel(style.name)}: {`);
    push(`    fontSize: ${quote(style.fontSize)},`);
    push(`    lineHeight: ${quote(style.lineHeight)},`);
    push(`    fontWeight: ${style.fontWeight},`);
    push(`    fontFamily: ${quote(style.family)},`);
    if (style.fontStyle) push(`    fontStyle: ${quote(style.fontStyle)},`);
    if (style.letterSpacing) push(`    letterSpacing: ${quote(style.letterSpacing)},`);
    if (UPPERCASE_STYLES.has(style.name)) push(`    textTransform: ${quote('uppercase')},`);
    push('  },');
  }
  push('} as const;');
  push();

  const spacingNote = 'Escala de espaciado; el número del nombre es el valor en px.';
  const shadowNote = 'Anillos y sombras de texto; no hay sombras de elevación.';
  record('spacing', spacingNote, tokensJson.spacing.tokens);
  record('radius', 'Radios de esquina.', tokensJson.radius.tokens);
  record('shadow', shadowNote, tokensJson.shadow.tokens);
  record('layout', 'Medidas del marco.', tokensJson.layout.tokens);
  record('size', 'Cajas fijas de sprites y controles.', tokensJson.size.tokens);
  record('grid', 'Ancho mínimo de tarjeta por familia de rejilla.', tokensJson.grid.tokens);
  record('opacity', 'Opacidades.', tokensJson.opacity.tokens);
  record('zIndex', 'Capas z.', tokensJson.zIndex.tokens);
  record('motion', 'Duraciones y curvas del movimiento.', tokensJson.motion.tokens);

  push('/** Todos los grupos de src/design/tokens.json en un solo objeto. */');
  push('export const tokens = {');
  for (const name of [
    'color',
    'fontFamily',
    'type',
    'spacing',
    'radius',
    'shadow',
    'layout',
    'size',
    'grid',
    'opacity',
    'zIndex',
    'motion',
  ]) {
    push(`  ${name},`);
  }
  push('} as const;');
  push();
  push('export type Tokens = typeof tokens;');
  push();

  return lines.join('\n');
}

// ----------------------------------------------------------------------- shell-tokens.ts

/**
 * The two groups the shell scripts of every page read (the search palette and the mobile
 * menu), apart from tokens.ts: a chunk carries every export any of its importers uses, and the
 * Guild PNG reads most of tokens.ts, so the shell importing tokens.ts put every group in the
 * first load of every page (spec 13.6).
 */
function buildShellTokensTs(tokensJson) {
  const lines = [HEADER_TS, ''];
  lines.push(
    '// Los grupos `layout` y `spacing` de src/lib/design/tokens.ts, para los scripts del',
  );
  lines.push('// marco de toda página (la paleta de búsqueda y el menú móvil).');
  lines.push('');
  const record = (exportName, comment, tokens) => {
    lines.push(`/** ${comment} */`);
    lines.push(`export const ${exportName} = {`);
    for (const token of tokens) lines.push(`  ${camel(token.name)}: ${quote(token.value)},`);
    lines.push('} as const;');
    lines.push('');
  };
  record(
    'spacing',
    'Escala de espaciado; el número del nombre es el valor en px.',
    tokensJson.spacing.tokens,
  );
  record('layout', 'Medidas del marco.', tokensJson.layout.tokens);
  return lines.join('\n');
}

// --------------------------------------------------------------------------------- main

/** The four artifacts, as `{ [path]: contents }`. */
export function generate(tokensJson) {
  assertShape(tokensJson);
  return {
    'src/styles/tokens.css': buildTokensCss(tokensJson),
    'src/styles/theme.css': buildThemeCss(tokensJson),
    'src/lib/design/tokens.ts': buildTokensTs(tokensJson),
    'src/lib/design/shell-tokens.ts': buildShellTokensTs(tokensJson),
  };
}

async function main(argv) {
  const check = argv.includes('--check');
  const tokensJson = JSON.parse(await readFile(resolve(ROOT, SOURCE), 'utf8'));
  const files = generate(tokensJson);

  if (!check) {
    for (const [path, contents] of Object.entries(files)) {
      const target = resolve(ROOT, path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, contents, 'utf8');
      process.stdout.write(`escrito ${path}\n`);
    }
    return 0;
  }

  const stale = [];
  for (const [path, contents] of Object.entries(files)) {
    let current = null;
    try {
      current = await readFile(resolve(ROOT, path), 'utf8');
    } catch {
      stale.push(`${path}: falta; ejecuta pnpm design:tokens`);
      continue;
    }
    if (current !== contents) stale.push(`${path}: desfasado; ejecuta pnpm design:tokens`);
  }
  if (stale.length > 0) {
    for (const line of stale) process.stderr.write(`${line}\n`);
    return 1;
  }
  process.stdout.write(`${Object.keys(files).length} archivos generados al día\n`);
  return 0;
}

// Only run when executed directly; tests import `generate`.
if (process.argv[1] && resolve(process.argv[1]) === resolve(ROOT, GENERATOR)) {
  process.exitCode = await main(process.argv.slice(2));
}
