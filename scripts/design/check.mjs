#!/usr/bin/env node
// The eleven verifiable rules of the redesign (spec §3.11). No new dependencies:
// plain Node, a small CSS walker and a class-attribute reader. Rule 4 also carries the
// two utility rules of §5.3 — spacing on the twelve steps, fixed widths and heights on
// the layout, size and grid tokens — since both say the same: a length is a token.
//
// Usage:
//   node scripts/design/check.mjs        prints `archivo:línea  [regla N] motivo` and exits 1
//                                        when a rule is broken, 0 when none is.
//
// Scope. The rules cover every file of src/ (§3.11). The migration exclusions of §3.10
// (the legacy stylesheets, AppLayout and the pages that rendered with it) went away with
// step 4 (M15), together with the files they covered.

import { readFileSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, posix, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { generate } from './tokens.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

// --------------------------------------------------------------------------- scope

const SOURCE_ROOT = 'src';
const EXTENSIONS = ['.css', '.astro', '.ts', '.tsx'];

const TOKENS_JSON = 'src/design/tokens.json';
const TOKENS_CSS = 'src/styles/tokens.css';
const THEME_CSS = 'src/styles/theme.css';
const TOKENS_TS = 'src/lib/design/tokens.ts';
const SHELL_TOKENS_TS = 'src/lib/design/shell-tokens.ts';
const FONTS_CSS = 'src/styles/fonts.css';
const PAGE_LAYOUT = 'src/layouts/PageLayout.astro';
const GLOBAL_CSS = 'src/styles/global.css';
const GLYPH = 'src/components/icons/Glyph.tsx';
const SPRITE_RESOLVE = 'src/lib/sprites/resolve.ts';
const COMPONENTS_DIR = 'src/styles/components/';

/** src/design/tokens.json and the four files scripts/design/tokens.mjs writes (§3.2). */
const GENERATED = [TOKENS_CSS, THEME_CSS, TOKENS_TS, SHELL_TOKENS_TS];
const TOKEN_FILES = new Set([TOKENS_JSON, ...GENERATED]);

// -------------------------------------------------------------------- allowed values

const ALLOWED_FONT_FAMILIES = new Set([
  'var(--font-sans)',
  'var(--font-game)',
  'var(--font-mono)',
  'inherit',
]);
const ALLOWED_FONT_WEIGHTS = new Set(['400', '500', '600', '700', 'inherit']);

/** The five layers of §3.6, in cascade order. */
const LAYERS = new Set(['properties', 'theme', 'base', 'components', 'utilities']);

/** Lengths a component stylesheet may write without a token (§3.7). */
const ALLOWED_RAW_LENGTHS = new Set(['0', '1px', '-1px', '2px']);

/** Rule 6: an arbitrary value that carries a literal, `w-[13px]` or `bg-[#fff]`. */
const ARBITRARY_LITERAL = /-\[\s*(?:#|-?\d+(?:\.\d+)?[a-z%])/i;

/**
 * §5.3, first rule: the utilities whose number is a step of the spacing scale — padding,
 * margin, gap, space between, inset and its sides, scroll margin and padding, and text
 * indent. With `--spacing: 1px` the number is the length in px, so Tailwind compiles
 * `p-13` to 13 px although 13 is no step. Group 1 is the value after the name.
 */
const SPACING_UTILITY =
  /^(?:p[xytrblse]?|m[xytrblse]?|gap(?:-[xy])?|space-[xy]|inset(?:-[xy])?|top|right|bottom|left|start|end|scroll-[mp][xytrblse]?|indent)-(.+)$/;

/** §5.3, second rule: fixed widths and heights. Group 1 is the value after the name. */
const SIZE_UTILITY = /^(?:(?:min-|max-)?[wh]|size|basis)-(.+)$/;

/**
 * The values §5.3 lets a width or a height take besides a token: 0 and the 1 px hairline,
 * `100%` (`full`), `auto`, and the keywords of Tailwind — the viewport units, the
 * intrinsic sizes, `none` for a max and `lh` for one line. A fraction (`w-1/2`) is a
 * percentage and passes too.
 */
const SIZE_KEYWORDS = new Set([
  '0',
  'px',
  'full',
  'auto',
  'screen',
  'svw',
  'lvw',
  'dvw',
  'svh',
  'lvh',
  'dvh',
  'min',
  'max',
  'fit',
  'none',
  'lh',
]);

/** §5.3: the token families a fixed width or height is written with, as `w-(--token)`. */
const SIZE_FAMILIES = ['layout', 'size', 'grid'];

/**
 * The parity routes of §14.5. They lay a board out as its sample sheet so that a crop
 * measures the same box on both sides, and some of those boxes are measurements of the
 * board, not sizes of the site, that no token holds. `PARITY_WIDTHS` lists them, and a
 * parity route may write those and only those as plain width utilities: 872 for a
 * two-column block and 822 for the Section specimen of the Componentes board (D-016), 358
 * for the phone column of the Tarjetas board («Móvil · 390», 390 less two gutters of 16).
 * Any other fixed width in these files follows §5.3 like in any other file, and so does
 * everything else of rules 2 to 11, spacing steps included. The routes never ship
 * (`seo:check`).
 */
const PARITY_ROUTES = 'src/routes/_paridad/';
const PARITY_WIDTHS = new Set(['358', '822', '872']);

/** Width breakpoints of §5.4; the three exceptions are keyed by file name. */
const ALLOWED_BREAKPOINTS = new Set(['48rem', '80rem']);
const BREAKPOINT_EXCEPTIONS = new Map([
  ['info-banner.css', '64rem'],
  ['breadcrumb.css', '36rem'],
  ['page-title.css', '28.75rem'],
]);

/** The three veils of rule 10; each one follows the `overlay` token. */
const BACKDROP_FILES = new Set([
  `${COMPONENTS_DIR}mobile-menu.css`,
  `${COMPONENTS_DIR}search-palette.css`,
  `${COMPONENTS_DIR}dialog.css`,
]);

const RETIRED_IMPORTS = new Set([
  '@base-ui/react',
  'class-variance-authority',
  'cn',
  'tw-animate-css',
]);

const COLOR_PROPERTY =
  /^(?:-webkit-|-moz-)?(?:color|background|background-color|background-image|border-color|border-(?:top|right|bottom|left|block|inline)(?:-(?:start|end))?-color|outline-color|text-decoration-color|text-emphasis-color|caret-color|accent-color|column-rule-color|fill|stroke|box-shadow|text-shadow|stop-color|flood-color|lighting-color|scrollbar-color)$/;

// The CSS named colours. `transparent`, `currentColor` and `inherit` are allowed
// by rule 2 and are not in the list.
const NAMED_COLORS = new Set(
  `aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet
   brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue
   darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange
   darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise
   darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen
   fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred
   indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan
   lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen
   lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta
   maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue
   mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin
   navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen
   paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple
   red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue
   slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet
   wheat white whitesmoke yellow yellowgreen`
    .split(/\s+/)
    .filter(Boolean),
);

// ---------------------------------------------------------------------- text helpers

/** Repo-relative path with forward slashes, the shape every message uses. */
function repoPath(absolute) {
  return relative(ROOT, absolute).split(sep).join(posix.sep);
}

function isUnder(path, prefix) {
  return prefix.endsWith('/') ? path.startsWith(prefix) : path === prefix;
}

/** Maps a character offset to a 1-based line number. */
function lineCounter(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '\n') starts.push(i + 1);
  }
  return (offset) => {
    let low = 0;
    let high = starts.length - 1;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      if (starts[mid] <= offset) low = mid;
      else high = mid - 1;
    }
    return low + 1;
  };
}

/**
 * Blanks out comments while keeping every offset and newline, so a colour or a
 * duration named in prose never trips a rule. Block comments go in every file;
 * `//` only takes a whole line, which leaves string contents such as `https://`
 * alone.
 */
function maskComments(text) {
  let masked = text.replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, ' '));
  masked = masked.replace(
    /^([ \t]*)\/\/[^\n]*/gm,
    (match, indent) => indent + ' '.repeat(match.length - indent.length),
  );
  return masked;
}

/** The `<style>` blocks of an .astro file, with the offset each one starts at. */
function styleBlocks(text) {
  const blocks = [];
  for (const match of text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) {
    blocks.push({ css: match[1], offset: match.index + match[0].indexOf('>') + 1 });
  }
  return blocks;
}

/**
 * Walks a CSS source and yields every statement with the prelude stack it sits
 * in. Quotes are respected so a `;` inside `url("a;b")` does not split a
 * statement. `kind` is `at` for `@…` statements and `declaration` otherwise.
 */
function* cssStatements(css) {
  const at = lineCounter(css);
  const stack = [];
  let buffer = '';
  let start = 0;
  let quote = null;

  const flush = (extra) => {
    const text = buffer.trim();
    buffer = '';
    if (!text) return null;
    return {
      text,
      line: at(start),
      kind: text.startsWith('@') ? 'at' : 'declaration',
      stack: extra ? [...stack, extra] : [...stack],
    };
  };

  for (let i = 0; i < css.length; i += 1) {
    const char = css[i];
    if (quote) {
      buffer += char;
      if (char === '\\') {
        buffer += css[i + 1] ?? '';
        i += 1;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      buffer += char;
      continue;
    }
    if (char === '{') {
      const prelude = buffer.trim();
      buffer = '';
      stack.push({ prelude, line: at(start) });
      start = i + 1;
      continue;
    }
    if (char === '}') {
      const trailing = flush();
      if (trailing) yield trailing;
      stack.pop();
      start = i + 1;
      continue;
    }
    if (char === ';') {
      const statement = flush();
      if (statement) yield statement;
      start = i + 1;
      continue;
    }
    if (buffer === '' && /\s/.test(char)) {
      start = i + 1;
      continue;
    }
    buffer += char;
  }
}

/** `color: red` -> `['color', 'red']`; anything else -> null. */
function splitDeclaration(text) {
  const colon = text.indexOf(':');
  if (colon < 0) return null;
  return [text.slice(0, colon).trim().toLowerCase(), text.slice(colon + 1).trim()];
}

function findStringEnd(text, start) {
  const quote = text[start];
  for (let i = start + 1; i < text.length; i += 1) {
    if (text[i] === '\\') i += 1;
    else if (text[i] === quote) return i;
  }
  return text.length;
}

function findBraceEnd(text, start) {
  let depth = 0;
  for (let i = start; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"' || char === "'" || char === '`') i = findStringEnd(text, i);
    else if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return text.length;
}

/** Every string literal of a JSX expression, with `${…}` holes dropped. */
function stringLiterals(expression) {
  const found = [];
  for (let i = 0; i < expression.length; i += 1) {
    const char = expression[i];
    if (char !== '"' && char !== "'" && char !== '`') continue;
    const end = findStringEnd(expression, i);
    const raw = expression.slice(i + 1, end);
    found.push(char === '`' ? raw.replace(/\$\{[^}]*\}/g, ' ') : raw);
    i = end;
  }
  return found;
}

/**
 * Every class list written in the markup: `class="…"`, `className="…"` and the
 * string literals of `class={…}` / `class:list={…}` expressions. Rule 6 reads
 * classes here and in `@apply`, which is where a Tailwind utility can appear.
 */
function classLists(text) {
  const at = lineCounter(text);
  const lists = [];
  const re = /\b(?:class|className|class:list)\s*=\s*/g;
  let match;
  while ((match = re.exec(text)) !== null) {
    const start = match.index + match[0].length;
    const char = text[start];
    if (char === '"' || char === "'" || char === '`') {
      const end = findStringEnd(text, start);
      lists.push({ value: text.slice(start + 1, end), line: at(start) });
      re.lastIndex = end + 1;
    } else if (char === '{') {
      const end = findBraceEnd(text, start);
      for (const literal of stringLiterals(text.slice(start + 1, end))) {
        lists.push({ value: literal, line: at(start) });
      }
      re.lastIndex = end + 1;
    }
  }
  return lists;
}

/** `md:motion-safe:duration-fast` -> `{ variants: ['md', 'motion-safe'], base: 'duration-fast' }`. */
function splitCandidate(candidate) {
  const parts = candidate.split(':');
  const base = parts.pop() ?? '';
  return { variants: parts, base };
}

/**
 * Every utility a file writes, with its line: the words of its class lists and of its
 * `@apply` rules, which is where a Tailwind utility can appear (rules 4 and 6).
 */
function utilityCandidates(file) {
  const at = lineCounter(file.masked);
  const candidates = [];
  for (const { value, line } of file.classLists) {
    for (const candidate of value.split(/\s+/)) if (candidate) candidates.push({ candidate, line });
  }
  for (const match of file.masked.matchAll(/@apply\s+([^;{}]+)/g)) {
    const line = at(match.index);
    for (const candidate of match[1].trim().split(/\s+/)) {
      if (candidate) candidates.push({ candidate, line });
    }
  }
  return candidates;
}

/** Import specifiers of a source file: ESM, dynamic, `require` and CSS `@import`. */
function importSpecifiers(masked) {
  const found = [];
  const at = lineCounter(masked);
  const patterns = [
    // A side-effect import (`import './x.css';`) on its own: the pattern below would run on
    // to the `from` of the next statement and report that one instead.
    /\bimport\s*['"]([^'"]+)['"]/g,
    /\b(?:import|export)\s+(?:[\s\S]*?\sfrom\s*)?['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /@import\s+(?:url\(\s*)?['"]([^'"]+)['"]/g,
  ];
  // `@import 'x'` also matches the ESM pattern, so specifiers are keyed by the
  // offset of the string itself and reported once.
  const seen = new Set();
  for (const pattern of patterns) {
    for (const match of masked.matchAll(pattern)) {
      const offset = match.index + match[0].lastIndexOf(match[1]);
      if (seen.has(offset)) continue;
      seen.add(offset);
      found.push({ specifier: match[1], line: at(offset) });
    }
  }
  return found;
}

// ----------------------------------------------------------------------- collection

async function collectSources(dir, out = []) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const absolute = resolve(dir, entry.name);
    if (entry.isDirectory()) await collectSources(absolute, out);
    else if (EXTENSIONS.some((extension) => entry.name.endsWith(extension))) out.push(absolute);
  }
  return out;
}

// ----------------------------------------------------------------------------- rules

class Report {
  constructor() {
    this.violations = [];
  }

  add(rule, path, line, message) {
    this.violations.push({ rule, path, line, message });
  }
}

/** Rule 1 — a generated file is out of date (§3.2, `tokens.mjs --check`). */
async function ruleGeneratedFiles(report) {
  let tokensJson;
  try {
    tokensJson = JSON.parse(await readFile(resolve(ROOT, TOKENS_JSON), 'utf8'));
  } catch (error) {
    report.add(1, TOKENS_JSON, 1, `no se puede leer: ${error.message}`);
    return;
  }
  let files;
  try {
    files = generate(tokensJson);
  } catch (error) {
    report.add(1, TOKENS_JSON, 1, error.message);
    return;
  }
  for (const [path, contents] of Object.entries(files)) {
    let current;
    try {
      current = await readFile(resolve(ROOT, path), 'utf8');
    } catch {
      report.add(1, path, 1, 'falta el archivo generado; ejecuta pnpm design:tokens');
      continue;
    }
    if (current !== contents) {
      report.add(1, path, 1, 'generado desfasado; ejecuta pnpm design:tokens');
    }
  }
}

/**
 * The bare words of a colour value that could name a colour. A token read is not one:
 * `var(--white)` and `var(--black)` are the `white` and `black` tokens of tokens.json, so
 * every custom property name (`--white`, `--ac-chip-ink`) is dropped before the words are
 * read, and so are quoted strings and `url(…)`, where a word is a file name or text.
 */
function colorWords(value) {
  const bare = value
    .toLowerCase()
    .replace(/url\(\s*(?:"[^"]*"|'[^']*'|[^)]*)\s*\)/g, ' ')
    .replace(/"[^"]*"|'[^']*'/g, ' ')
    .replace(/--[a-z0-9_-]+/g, ' ');
  return [...bare.matchAll(/[a-z]+/g)];
}

/** Rule 2 — colour literals outside tokens.json and its three generated files. */
function ruleColorLiterals(report, file) {
  if (TOKEN_FILES.has(file.path)) return;
  const at = lineCounter(file.masked);
  const functions = /\b(?:rgba?|hsla?|oklch|color-mix)\(/g;
  const hex = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![0-9a-zA-Z_-])/g;
  for (const pattern of [functions, hex]) {
    for (const match of file.masked.matchAll(pattern)) {
      report.add(2, file.path, at(match.index), `literal de color «${match[0]}»: usa un token`);
    }
  }
  for (const { text, line } of file.declarations) {
    const declaration = splitDeclaration(text);
    if (!declaration) continue;
    const [property, value] = declaration;
    if (!COLOR_PROPERTY.test(property)) continue;
    for (const word of colorWords(value)) {
      if (NAMED_COLORS.has(word[0])) {
        report.add(
          2,
          file.path,
          line,
          `color con nombre «${word[0]}» en ${property}: usa un token`,
        );
      }
    }
  }
}

/** Rule 3 — typography only through theme.css and the three families. */
function ruleTypography(report, file) {
  for (const { text, line } of file.declarations) {
    const declaration = splitDeclaration(text);
    if (!declaration) continue;
    const [property, value] = declaration;
    if (property === 'font-size' || property === 'line-height') {
      if (file.path !== THEME_CSS) {
        report.add(3, file.path, line, `${property} fuera de theme.css: usa @apply type-<estilo>`);
      }
      continue;
    }
    if (property === 'letter-spacing' && value !== 'normal' && file.path !== THEME_CSS) {
      report.add(3, file.path, line, 'letter-spacing fuera de theme.css: usa @apply type-<estilo>');
      continue;
    }
    if (property === 'font-family' && file.path !== TOKENS_CSS && file.path !== FONTS_CSS) {
      if (!ALLOWED_FONT_FAMILIES.has(value)) {
        report.add(3, file.path, line, `font-family «${value}»: solo var(--font-sans|game|mono)`);
      }
      continue;
    }
    if (property === 'font-weight' && !ALLOWED_FONT_WEIGHTS.has(value)) {
      report.add(3, file.path, line, `font-weight «${value}»: solo 400, 500, 600, 700 o inherit`);
    }
  }
}

/**
 * Rule 4 — every length of src/styles/components/*.css is a token or is explained. The
 * utilities of every file follow in `ruleUtilityScale` (§5.3).
 */
function ruleComponentLengths(report, file) {
  if (!isUnder(file.path, COMPONENTS_DIR) || !file.path.endsWith('.css')) return;
  const lengths =
    /(?<![\w.#-])-?\d+(?:\.\d+)?(px|rem|em|ch|ex|vw|vh|vmin|vmax|svh|lvh|dvh|pt|pc|cm|mm|in|q)(?![\w-])/gi;
  file.lines.forEach((raw, index) => {
    const line = index + 1;
    const masked = file.maskedLines[index];
    if (raw.includes('/* sin token:')) return;
    if (masked.trimStart().startsWith('@media')) return; // rule 5 owns breakpoints
    const colon = masked.indexOf(':');
    const value = colon < 0 ? '' : masked.slice(colon + 1);
    for (const match of value.matchAll(lengths)) {
      if (ALLOWED_RAW_LENGTHS.has(match[0])) continue;
      report.add(
        4,
        file.path,
        line,
        `longitud «${match[0]}» sin token; añade /* sin token: … */ en la misma línea`,
      );
    }
  });
}

/**
 * What §5.3 lets a utility write, read from src/design/tokens.json so that a new token
 * needs no edit here: the numbers of the spacing steps (`space-16` -> `16`) and the names
 * of the fixed-size tokens (`layout-*`, `size-*`, `grid-*`). Null when the file cannot be
 * read or has no steps: rule 1 reports that, and the utility checks below stay off
 * instead of flagging every utility of the tree.
 */
let scale;
function spacingScale() {
  if (scale !== undefined) return scale;
  try {
    const tokens = JSON.parse(readFileSync(resolve(ROOT, TOKENS_JSON), 'utf8'));
    const names = (group) => (tokens[group]?.tokens ?? []).map((token) => String(token.name));
    const steps = new Set(
      names('spacing')
        .map((name) => /^space-(\d+(?:\.\d+)?)$/.exec(name)?.[1])
        .filter((step) => step !== undefined),
    );
    const sizes = new Set(SIZE_FAMILIES.flatMap(names));
    scale = steps.size === 0 ? null : { steps, sizes };
  } catch {
    scale = null;
  }
  return scale;
}

/**
 * Rule 4, second part — §5.3 on the utilities of every file: a spacing utility takes a
 * step of the scale (`p-16`, `gap-6`; `p-13` is refused although Tailwind compiles it),
 * and a fixed width or height is a `layout-*`, `size-*` or `grid-*` token written
 * `w-(--token)`, or `0`, `px`, a fraction, `full`, `auto` or a Tailwind keyword
 * (`w-full`, `h-dvh`). Arbitrary values with a literal belong to rule 6 and are not
 * reported twice. The parity routes keep the widths of their board (`PARITY_WIDTHS`).
 */
function ruleUtilityScale(report, file) {
  const allowed = spacingScale();
  if (allowed === null) return;
  const families = SIZE_FAMILIES.map((family) => `${family}-*`);
  const tokens = `${families.slice(0, -1).join(', ')} o ${families[families.length - 1]}`;

  for (const { candidate, line } of utilityCandidates(file)) {
    const { base } = splitCandidate(candidate);
    // `-mt-8` is the negative of `mt-8`; `!` is the important modifier, which rule 6
    // does not see in a class and which does not change the length.
    const bare = base.replace(/^!|!$/g, '').replace(/^-/, '');

    const spacing = SPACING_UTILITY.exec(bare);
    if (spacing !== null) {
      const value = spacing[1];
      if (/^\d+(?:\.\d+)?$/.test(value) && value !== '0' && !allowed.steps.has(value)) {
        report.add(
          4,
          file.path,
          line,
          `«${candidate}»: el espaciado solo usa los pasos ${[...allowed.steps].join(', ')} (§5.3)`,
        );
      }
      continue;
    }

    const size = SIZE_UTILITY.exec(bare);
    if (size === null) continue;
    const value = size[1];
    if (isUnder(file.path, PARITY_ROUTES) && PARITY_WIDTHS.has(value)) continue;
    if (SIZE_KEYWORDS.has(value) || /^\d+\/\d+$/.test(value)) continue;
    if (value.startsWith('[') && ARBITRARY_LITERAL.test(base)) continue; // rule 6
    const token = /^\((?:[a-z-]+:)?--([a-z0-9-]+)\)$/.exec(value)?.[1];
    if (token !== undefined) {
      if (allowed.sizes.has(token)) continue;
      report.add(
        4,
        file.path,
        line,
        `«${candidate}»: --${token} no es un token ${tokens} de tokens.json (§5.3)`,
      );
      continue;
    }
    report.add(
      4,
      file.path,
      line,
      `«${candidate}»: un ancho o alto fijo es un token ${tokens} con w-(--token), o full, auto o una palabra clave (§5.3)`,
    );
  }
}

/** Rule 5 — width media queries: range syntax and the breakpoints of §5.4. */
function ruleMediaQueries(report, file) {
  const at = lineCounter(file.masked);
  const name = file.path.slice(file.path.lastIndexOf('/') + 1);
  const allowed = new Set(ALLOWED_BREAKPOINTS);
  const exception = BREAKPOINT_EXCEPTIONS.get(name);
  if (exception) allowed.add(exception);

  for (const match of file.masked.matchAll(/@media[^{;]*/g)) {
    const query = match[0];
    if (!/\bwidth\b/.test(query)) continue;
    const line = at(match.index);
    if (/\b(?:min|max)-width\s*:/.test(query)) {
      report.add(5, file.path, line, 'usa la sintaxis de rango: width < 80rem, width >= 48rem');
    }
    for (const value of query.matchAll(/(-?\d+(?:\.\d+)?(?:rem|px|em))/g)) {
      if (!allowed.has(value[1])) {
        report.add(
          5,
          file.path,
          line,
          `punto de corte «${value[1]}»: solo ${[...allowed].join(', ')}`,
        );
      }
    }
  }
}

/** Rule 6 — what may never appear in the CSS or in a class. */
function ruleForbiddenSyntax(report, file) {
  const at = lineCounter(file.masked);

  for (const match of file.masked.matchAll(/!important/g)) {
    report.add(6, file.path, at(match.index), '!important: el CSS del corte no lo usa (T6)');
  }
  for (const match of file.masked.matchAll(/@layer\s+([^;{]+)/g)) {
    for (const name of match[1].split(',')) {
      const layer = name.trim();
      if (layer && !LAYERS.has(layer)) {
        report.add(6, file.path, at(match.index), `capa «${layer}»: solo las cinco de §3.6`);
      }
    }
  }

  for (const { candidate, line } of utilityCandidates(file)) {
    const { variants, base } = splitCandidate(candidate);
    const bare = base.replace(/^-/, '');
    if (variants.includes('dark')) {
      report.add(6, file.path, line, `«${candidate}»: la variante dark: no existe (un solo tema)`);
    }
    if (/^ring(?:-|$)/.test(bare)) {
      report.add(6, file.path, line, `«${candidate}»: usa shadow-ring-selected u outline`);
    }
    if (ARBITRARY_LITERAL.test(base)) {
      report.add(6, file.path, line, `«${candidate}»: valor arbitrario con literal; usa un token`);
    }
    if (
      /^(?:bg|text|border|outline|fill|stroke|decoration|caret|accent|placeholder|divide|shadow|from|via|to)-[^/\s]+\/\d+$/.test(
        bare,
      )
    ) {
      report.add(6, file.path, line, `«${candidate}»: el modificador de opacidad no es un token`);
    }
    if (
      /^(?:transition(?:-|$)|animate-|duration-)/.test(bare) &&
      !variants.includes('motion-safe')
    ) {
      report.add(6, file.path, line, `«${candidate}»: necesita la variante motion-safe: (§6.4)`);
    }
  }
}

/** Rule 7 — movement only inside `@media (prefers-reduced-motion: no-preference)`. */
function ruleMotionGuard(report, file) {
  const guard = /@media[^{]*prefers-reduced-motion\s*:\s*no-preference/;
  for (const statement of file.declarations) {
    const declaration = splitDeclaration(statement.text);
    if (!declaration) continue;
    const [property] = declaration;
    if (!/^(?:animation|transition)(?:-[a-z-]+)?$/.test(property)) continue;
    if (statement.stack.some((frame) => guard.test(frame.prelude))) continue;
    report.add(
      7,
      file.path,
      statement.line,
      `«${property}» fuera de @media (prefers-reduced-motion: no-preference) (§6.4)`,
    );
  }
}

/**
 * The component sheets that global.css pulls into the shared sheet, as repo paths, read
 * once. `null` when global.css cannot be read: then every sheet counts as shared, which is
 * the strict reading of rule 8.
 */
let sharedSheets;
function sharedComponentSheets() {
  if (sharedSheets !== undefined) return sharedSheets;
  try {
    const text = readFileSync(resolve(ROOT, GLOBAL_CSS), 'utf8');
    sharedSheets = new Set(
      importSpecifiers(maskComments(text)).map(({ specifier }) =>
        posix.normalize(posix.join(posix.dirname(GLOBAL_CSS), specifier)),
      ),
    );
  } catch {
    sharedSheets = null;
  }
  return sharedSheets;
}

/** The repo path an import of the file `from` names, or `null` for a package. */
function importedPath(specifier, from) {
  if (specifier.startsWith('@/')) return posix.join(SOURCE_ROOT, specifier.slice(2));
  if (specifier.startsWith('.')) return posix.normalize(posix.join(posix.dirname(from), specifier));
  return null;
}

/**
 * Rule 8 — only PageLayout.astro imports the site stylesheet (§3.6). The one exception is
 * a per-page sheet (§13.6, D-018): a file of src/styles/components/ that global.css does
 * not import, which the page or the component of its family imports itself, so it never
 * reaches the shared sheet of S17. A sheet that global.css carries, or CSS from anywhere
 * else, is still refused.
 */
function ruleStylesheetImports(report, file) {
  if (file.path.endsWith('.css') || file.path === PAGE_LAYOUT) return;
  for (const { specifier, line } of file.imports) {
    if (!specifier.endsWith('.css')) continue;
    const target = importedPath(specifier, file.path);
    const shared = sharedComponentSheets();
    if (target?.startsWith(COMPONENTS_DIR) && shared !== null && !shared.has(target)) continue;
    report.add(8, file.path, line, `importa «${specifier}»: la única hoja la importa PageLayout`);
  }
}

/** Rule 9 — retired libraries, and lucide-react only behind Glyph.tsx (§3.8). */
function ruleRetiredImports(report, file) {
  for (const { specifier, line } of file.imports) {
    const packageName = specifier.startsWith('@')
      ? specifier.split('/').slice(0, 2).join('/')
      : specifier.split('/')[0];
    if (packageName === 'lucide-react' && file.path !== GLYPH) {
      report.add(9, file.path, line, 'lucide-react solo se importa desde Glyph.tsx (C-R7)');
    }
    if (RETIRED_IMPORTS.has(packageName)) {
      report.add(9, file.path, line, `«${packageName}» es una dependencia retirada (§3.8)`);
    }
  }
}

/** Rule 10 — backdrop-filter only on the three `::backdrop` veils. */
function ruleBackdropFilter(report, file) {
  for (const statement of file.declarations) {
    const declaration = splitDeclaration(statement.text);
    if (!declaration) continue;
    const [property] = declaration;
    if (property !== 'backdrop-filter' && property !== '-webkit-backdrop-filter') continue;
    const onBackdrop = statement.stack.some((frame) => frame.prelude.includes('::backdrop'));
    if (BACKDROP_FILES.has(file.path) && onBackdrop) continue;
    report.add(
      10,
      file.path,
      statement.line,
      'backdrop-filter solo en el velo ::backdrop de MobileMenu, la paleta y Dialog',
    );
  }
}

/** Rule 11 — literal durations and curves only in the token files. */
function ruleMotionLiterals(report, file) {
  if (TOKEN_FILES.has(file.path)) return;
  // Sprite animations are written from `duracionMs` of the registry (§3.11, rule 11).
  if (file.path === SPRITE_RESOLVE) return;
  const at = lineCounter(file.masked);
  const patterns = [/(?<![\w.$#-])\d+(?:\.\d+)?m?s(?![\w%])/g, /cubic-bezier\(/g];
  for (const pattern of patterns) {
    for (const match of file.masked.matchAll(pattern)) {
      report.add(11, file.path, at(match.index), `«${match[0]}» fuera de los archivos de tokens`);
    }
  }
}

// ------------------------------------------------------------------------------ main

/**
 * Everything rules 2 to 11 need from one source, derived in a single pass.
 * `path` is repo-relative because several rules key on it (theme.css owns the
 * typography, Glyph.tsx owns lucide-react, and so on).
 */
export function analyze(path, text) {
  const masked = maskComments(text);
  const isCss = path.endsWith('.css');

  // The CSS of a file: the whole thing for .css, the <style> blocks for .astro.
  const declarations = [];
  const pushStatements = (css, offset) => {
    const before = masked.slice(0, offset);
    const lineOffset = before.length === 0 ? 0 : (before.match(/\n/g) ?? []).length;
    for (const statement of cssStatements(css)) {
      if (statement.kind === 'declaration') {
        declarations.push({ ...statement, line: statement.line + lineOffset });
      }
    }
  };
  if (isCss) pushStatements(masked, 0);
  else for (const block of styleBlocks(masked)) pushStatements(block.css, block.offset);

  return {
    path,
    text,
    masked,
    lines: text.split('\n'),
    maskedLines: masked.split('\n'),
    declarations,
    classLists: isCss ? [] : classLists(masked),
    imports: importSpecifiers(masked),
  };
}

/** Rules 2 to 11 over one analysed source. Rule 1 is global and runs on its own. */
export function runFileRules(report, file) {
  ruleColorLiterals(report, file);
  ruleTypography(report, file);
  ruleComponentLengths(report, file);
  ruleUtilityScale(report, file);
  ruleMediaQueries(report, file);
  ruleForbiddenSyntax(report, file);
  ruleMotionGuard(report, file);
  ruleStylesheetImports(report, file);
  ruleRetiredImports(report, file);
  ruleBackdropFilter(report, file);
  ruleMotionLiterals(report, file);
}

async function main() {
  const sources = await collectSources(resolve(ROOT, SOURCE_ROOT));
  const report = new Report();

  await ruleGeneratedFiles(report);

  const files = [];
  for (const absolute of sources) {
    files.push(analyze(repoPath(absolute), await readFile(absolute, 'utf8')));
  }

  for (const file of files) runFileRules(report, file);

  const violations = report.violations.sort(
    (a, b) => a.path.localeCompare(b.path) || a.line - b.line || a.rule - b.rule,
  );
  if (violations.length > 0) {
    for (const { rule, path, line, message } of violations) {
      process.stderr.write(`${path}:${line}  [regla ${rule}] ${message}\n`);
    }
    process.stderr.write(`\n${violations.length} violaciones de §3.11\n`);
    return 1;
  }
  process.stdout.write(`design:check sin violaciones (11 reglas, ${files.length} archivos)\n`);
  return 0;
}

// Only run when executed directly; tests import the rules through this module.
if (process.argv[1] && resolve(process.argv[1]) === resolve(ROOT, 'scripts/design/check.mjs')) {
  process.exitCode = await main();
}

export { main, Report };
