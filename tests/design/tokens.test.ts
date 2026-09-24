// V3-1, V3-2, V3-3 and V3-7 of the spec (§3.14), the four checks of §3 that a
// unit test can settle without a browser.
//
// V3-2 and V3-7 are written against the compiled stylesheet rather than against
// `getComputedStyle`: the entry of §3.6 is compiled with the `@tailwindcss/node`
// of the repo and the custom properties of `:root` and the cascade layers are
// read from the result. The browser-measured halves (the computed value on /es/
// and a real `Button`) belong to the Playwright specs of §14.3.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const stylesDir = path.join(repoRoot, 'src/styles');
const globalCss = path.join(stylesDir, 'global.css');

const tokensJson = JSON.parse(
  readFileSync(path.join(repoRoot, 'src/design/tokens.json'), 'utf8'),
) as TokensJson;

// --------------------------------------------------------------------- tokens.json

/** The ten token groups of §3.2 and §3.3: the eight of the DS plus zIndex and motion. */
const TOKEN_GROUPS = [
  'color',
  'spacing',
  'radius',
  'shadow',
  'layout',
  'size',
  'grid',
  'opacity',
  'zIndex',
  'motion',
] as const;

/** 110 tokens of the design system, the 10 of §3.3 and the plan's additions (shiny glow, tier tooltip, tier-list rows). */
const TOKEN_COUNT = 146;

type Token = { name: string; value: string; usage: string };
type TokensJson = Record<(typeof TOKEN_GROUPS)[number], { tokens: Token[] }> & {
  type: { families: Record<string, string>; groups: { family: string; styles: unknown[] }[] };
};

function everyToken(): Token[] {
  return TOKEN_GROUPS.flatMap((group) => tokensJson[group].tokens);
}

// ------------------------------------------------------------------- compiled CSS

type CompiledCss = { build(candidates: string[]): string };
type Compile = (
  css: string,
  options: { base: string; onDependency: (file: string) => void },
) => Promise<CompiledCss>;

/**
 * `@tailwindcss/node` is not hoisted: the repo depends on `@tailwindcss/vite`,
 * which carries it. Resolving it through that package needs no new dependency.
 */
function loadCompile(): Compile {
  const requireHere = createRequire(import.meta.url);
  const requireFromVite = createRequire(requireHere.resolve('@tailwindcss/vite'));
  const tailwindNode = requireFromVite('@tailwindcss/node') as { compile: Compile };
  return tailwindNode.compile;
}

/**
 * The entry of §3.6. The real `src/styles/global.css` is used as soon as it
 * exists; until then, the same imports it declares for tokens and utilities.
 */
function entrySource(): string {
  if (existsSync(globalCss)) return readFileSync(globalCss, 'utf8');
  return [
    '@layer properties, theme, base, components, utilities;',
    "@import 'tailwindcss';",
    "@import './tokens.css';",
    "@import './theme.css';",
    '',
  ].join('\n');
}

/** Compiles the entry from scratch and builds it with `candidates`. */
async function build(candidates: string[], extra = ''): Promise<string> {
  const compile = loadCompile();
  const compiled = await compile(entrySource() + extra, {
    base: stylesDir,
    onDependency: () => {},
  });
  return compiled.build(candidates);
}

/** `md:flex` -> `.md\:flex`, the selector Tailwind writes. */
function selectorFor(candidate: string): string {
  return `.${candidate.replace(/[^\w-]/g, (character) => `\\${character}`)}`;
}

/** Every custom property declared in a `:root` rule, with its declared values. */
function rootCustomProperties(css: string): Map<string, string[]> {
  const properties = new Map<string, string[]>();
  for (const rule of css.matchAll(/([^{}]*:root[^{}]*)\{([^{}]*)\}/g)) {
    for (const declaration of rule[2].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
      const values = properties.get(declaration[1]) ?? [];
      values.push(declaration[2].trim());
      properties.set(declaration[1], values);
    }
  }
  return properties;
}

/** The cascade layer a rule sits in, or null when it sits outside every layer. */
function layerOf(css: string, selector: string): string | null {
  const stack: string[] = [];
  let buffer = '';
  for (const character of css) {
    if (character === '{') {
      const prelude = buffer.trim();
      buffer = '';
      if (prelude === selector) {
        for (let index = stack.length - 1; index >= 0; index -= 1) {
          const layer = /^@layer\s+([\w-]+)$/.exec(stack[index]);
          if (layer) return layer[1];
        }
        return null;
      }
      stack.push(prelude);
    } else if (character === '}') {
      stack.pop();
      buffer = '';
    } else if (character === ';') {
      buffer = '';
    } else {
      buffer += character;
    }
  }
  return null;
}

/**
 * The layer order the stylesheet declares, as the cascade reads it: a layer takes its place
 * the first time a `@layer a, b, …;` statement names it. Tailwind prints its own
 * `@layer properties;` ahead of the entry's statement as soon as a utility registers a
 * custom property (the `leading-[inherit]` of kpi-card.css does), which puts the same layer
 * first and changes no order.
 */
function layerOrder(css: string): string[] {
  const order: string[] = [];
  for (const statement of css.matchAll(/@layer\s+([^;{]+);/g)) {
    for (const name of statement[1].split(',').map((entry) => entry.trim())) {
      if (!order.includes(name)) order.push(name);
    }
  }
  return order;
}

// --------------------------------------------------------------------------- V3-1

describe('V3-1: el generador y la fuente única de tokens', () => {
  it('sale con 0 en modo --check', () => {
    expect(() =>
      execFileSync(process.execPath, ['scripts/design/tokens.mjs', '--check'], {
        cwd: repoRoot,
        encoding: 'utf8',
        stdio: 'pipe',
      }),
    ).not.toThrow();
  });

  it('tiene los grupos del sistema de diseño más motion', () => {
    for (const group of TOKEN_GROUPS) {
      expect(Array.isArray(tokensJson[group]?.tokens), `falta el grupo ${group}`).toBe(true);
      expect(tokensJson[group].tokens.length).toBeGreaterThan(0);
    }
    expect(tokensJson.motion.tokens.map((token) => token.name)).toEqual([
      'duration-fast',
      'duration-sprite-in',
      'duration-sheet',
      'duration-pulse',
      'duration-bounce',
      'ease-standard',
      'ease-pulse',
      'ease-bounce',
    ]);
    expect(everyToken()).toHaveLength(TOKEN_COUNT);
  });

  it('da a cada token name, value y usage', () => {
    for (const token of everyToken()) {
      for (const field of ['name', 'value', 'usage'] as const) {
        expect(typeof token[field], `${token.name ?? '?'} sin ${field}`).toBe('string');
        expect(token[field].length, `${token.name ?? '?'} con ${field} vacío`).toBeGreaterThan(0);
      }
    }
  });

  it('declara las tres familias y los 22 estilos de texto', () => {
    expect(Object.keys(tokensJson.type.families)).toEqual(['sans', 'game', 'mono']);
    expect(tokensJson.type.groups.flatMap((group) => group.styles)).toHaveLength(22);
  });
});

// --------------------------------------------------------------------------- V3-2

describe('V3-2: los tokens llegan a :root', () => {
  it('declara los 120 tokens y las 3 familias con el valor de tokens.json', async () => {
    const properties = rootCustomProperties(await build([]));
    const expected: [string, string][] = [
      ...everyToken().map((token): [string, string] => [`--${token.name}`, token.value]),
      ...Object.entries(tokensJson.type.families).map(([family, value]): [string, string] => [
        `--font-${family}`,
        value,
      ]),
    ];
    expect(expected).toHaveLength(TOKEN_COUNT + 3);
    for (const [property, value] of expected) {
      expect(properties.get(property), `${property} no está en :root`).toBeDefined();
      expect(properties.get(property), `${property} con otro valor`).toContain(value);
    }
  }, 20_000);

  it('declara --radius-12: 12px una sola vez', async () => {
    const properties = rootCustomProperties(await build([]));
    expect(properties.get('--radius-12')).toEqual(['12px']);
  }, 20_000);

  it('no deja ningún token del tema por defecto de Tailwind', async () => {
    const properties = rootCustomProperties(await build([]));
    for (const property of ['--color-red-500', '--text-sm', '--font-weight-bold', '--radius-lg']) {
      expect(properties.has(property), `${property} sobrevive al reinicio --*: initial`).toBe(
        false,
      );
    }
  }, 20_000);
});

// --------------------------------------------------------------------------- V3-3

const GENERATE = [
  'bg-primary',
  'text-quinary',
  'border-selected',
  'shadow-ring-selected',
  'rounded-11',
  'type-tt-title',
  'md:flex',
  'xl:grid',
];

const DO_NOT_GENERATE = [
  'text-sm',
  'font-bold',
  'rounded-lg',
  'shadow-sm',
  'sm:flex',
  'lg:flex',
  'bg-red-500',
];

describe('V3-3: qué utilidades existen', () => {
  it('genera las ocho utilidades del reparto de §3.4', async () => {
    const css = await build(GENERATE);
    for (const candidate of GENERATE) {
      expect(css, `${candidate} no genera CSS`).toContain(selectorFor(candidate));
    }
  }, 20_000);

  it('no genera ninguna de las siete de la paleta por defecto', async () => {
    const [base, css] = await Promise.all([build([]), build(DO_NOT_GENERATE)]);
    for (const candidate of DO_NOT_GENERATE) {
      expect(css, `${candidate} genera CSS`).not.toContain(selectorFor(candidate));
    }
    expect(css).toBe(base);
  }, 20_000);
});

// --------------------------------------------------------------------------- V3-7

// The `Button` of §7.2 fixes radius-11 in its `ac-button` rule; an instance that
// asks for `rounded-12` has to win without merging classes (§3.8).
const BUTTON_RULE = `
@layer components {
  .ac-button {
    border-radius: var(--radius-11);
  }
}
`;

describe('V3-7: una utilidad gana a la regla del componente', () => {
  it('coloca la utilidad en una capa posterior a la del componente', async () => {
    const css = await build(['rounded-12'], BUTTON_RULE);
    const order = layerOrder(css);
    expect(order).toEqual(['properties', 'theme', 'base', 'components', 'utilities']);
    expect(layerOf(css, '.ac-button')).toBe('components');
    expect(layerOf(css, '.rounded-12')).toBe('utilities');
    expect(order.indexOf('components')).toBeLessThan(order.indexOf('utilities'));
  }, 20_000);

  it('hace que rounded-12 calcule 12px sobre el radius-11 del componente', async () => {
    const css = await build(['rounded-12'], BUTTON_RULE);
    expect(css).toMatch(/\.ac-button\s*\{\s*border-radius:\s*var\(--radius-11\)/);
    expect(css).toMatch(/\.rounded-12\s*\{\s*border-radius:\s*var\(--radius-12\)/);
    expect(rootCustomProperties(css).get('--radius-12')).toEqual(['12px']);
  }, 20_000);
});

// ---------------------------------------------------------------- contraste (S12, §13.7)

// §13.7 fixes the minimums (text 4,5:1; meaningful borders, icons and rings 3:1), requires
// this file to compute every pair *from tokens.css* rather than from the prose, and requires
// the pairs the approved design system keeps below the minimum to be listed «como excepciones
// con su razón exacta». Which pairs occur is not invented here either: each one comes from
// the `usage` field its token carries in src/design/tokens.json, which names the surfaces the
// ink actually lands on.

type Rgb = { r: number; g: number; b: number; a: number };

/** Every custom property declared in src/styles/tokens.css, value verbatim. */
function tokensCssValues(): Map<string, string> {
  const css = readFileSync(path.join(stylesDir, 'tokens.css'), 'utf8');
  const values = new Map<string, string>();
  for (const declaration of css.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    values.set(declaration[1].slice(2), declaration[2].trim());
  }
  return values;
}

const TOKENS_CSS_VALUES = tokensCssValues();

function tokenValue(name: string): string {
  const value = TOKENS_CSS_VALUES.get(name);
  if (value === undefined) throw new Error(`--${name} no está en tokens.css`);
  return value;
}

/** `#rgb`, `#rrggbb`, `#rrggbbaa` and `rgba(r, g, b, a)`: the shapes tokens.css uses. */
function parseColor(value: string): Rgb {
  const hex = /^#([0-9a-f]{3,8})$/i.exec(value);
  if (hex) {
    const digits =
      hex[1].length <= 4
        ? [...hex[1]].map((digit) => digit + digit).join('')
        : hex[1].padEnd(8, 'f');
    const channel = (index: number): number =>
      parseInt(digits.slice(index * 2, index * 2 + 2), 16) / 255;
    return { r: channel(0), g: channel(1), b: channel(2), a: channel(3) };
  }
  const rgb = /^rgba?\(([^)]+)\)$/i.exec(value);
  if (rgb) {
    const parts = rgb[1]
      .split(/[\s,/]+/)
      .filter(Boolean)
      .map(Number);
    return { r: parts[0] / 255, g: parts[1] / 255, b: parts[2] / 255, a: parts[3] ?? 1 };
  }
  throw new Error(`«${value}» no es un color que esta prueba sepa leer`);
}

function colorOf(token: string): Rgb {
  return parseColor(tokenValue(token));
}

/**
 * Source-over composite of `ink` on an opaque `surface`, quantised to 8 bits per
 * channel because that is the pixel the reader's eye actually meets: the browser
 * writes the blend into an sRGB buffer before anything measures it.
 */
function composite(ink: Rgb, surface: Rgb): Rgb {
  const blend = (over: number, under: number): number =>
    Math.round((over * ink.a + under * (1 - ink.a)) * 255) / 255;
  return {
    r: blend(ink.r, surface.r),
    g: blend(ink.g, surface.g),
    b: blend(ink.b, surface.b),
    a: 1,
  };
}

/** WCAG 2.2 relative luminance. */
function luminance({ r, g, b }: Rgb): number {
  const linear = [r, g, b].map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

/** WCAG 2.2 contrast ratio, rounded to the two decimals the spec writes. */
function contrast(ink: Rgb, surface: Rgb): number {
  const [high, low] = [luminance(ink), luminance(surface)].sort((a, b) => b - a);
  return Math.round(((high + 0.05) / (low + 0.05)) * 100) / 100;
}

type Pair = {
  /** Token that carries the ink. */
  fg: string;
  /** Opaque surface token underneath. */
  bg: string;
  /** Translucent token painted on `bg` before the ink (Guild's inactive row). */
  wash?: string;
  /** Opacity token applied to the ink before compositing (the current-day bar). */
  alpha?: string;
  /** Where the pair occurs, from the token's `usage` in src/design/tokens.json. */
  where: string;
};

function surfaceOf(pair: Pair): Rgb {
  const base = colorOf(pair.bg);
  return pair.wash ? composite(colorOf(pair.wash), base) : base;
}

function ratioOf(pair: Pair): number {
  const surface = surfaceOf(pair);
  const ink = colorOf(pair.fg);
  const alpha = pair.alpha ? ink.a * Number(tokenValue(pair.alpha)) : ink.a;
  return contrast(composite({ ...ink, a: alpha }, surface), surface);
}

function nameOf(pair: Pair): string {
  const ink = pair.alpha ? `${pair.fg} a ${pair.alpha}` : pair.fg;
  return `${ink} sobre ${pair.wash ? `${pair.wash} sobre ${pair.bg}` : pair.bg}`;
}

const TEXT_MINIMUM = 4.5;
const NON_TEXT_MINIMUM = 3;

/** Text pairs, WCAG 1.4.3: 4,5:1 or more. */
const TEXT_PAIRS: Pair[] = [
  { fg: 'text-primary', bg: 'bg-primary', where: 'Texto y títulos' },
  { fg: 'text-primary', bg: 'bg-secondary', where: 'Texto y títulos' },
  { fg: 'text-primary', bg: 'bg-tertiary', where: 'Texto y títulos' },
  { fg: 'text-primary', bg: 'bg-quaternary', where: 'Texto y títulos' },
  {
    fg: 'text-primary',
    bg: 'bg-primary',
    wash: 'inactive-row',
    where: 'Celdas de un miembro inactivo en la tabla de Guild',
  },
  { fg: 'text-secondary', bg: 'bg-primary', where: 'Enlaces del panel de índice, TOC y ejes' },
  { fg: 'text-secondary', bg: 'bg-secondary', where: 'Enlaces del panel de índice, TOC y ejes' },
  { fg: 'text-tertiary', bg: 'bg-primary', where: 'Etiquetas de hechos, conteos y pie' },
  { fg: 'text-tertiary', bg: 'bg-secondary', where: 'Etiquetas de hechos, conteos y pie' },
  { fg: 'text-tertiary', bg: 'bg-tertiary', where: 'Cabecera de tabla y chips' },
  { fg: 'text-quaternary', bg: 'bg-primary', where: 'Migas, placeholder y conteos de grupo' },
  { fg: 'text-quaternary', bg: 'bg-secondary', where: 'Migas, placeholder y conteos de grupo' },
  { fg: 'helper', bg: 'bg-primary', where: 'Texto de ayuda bajo campos' },
  { fg: 'link', bg: 'bg-primary', where: 'Enlace de entidad y de dato' },
  { fg: 'link', bg: 'bg-secondary', where: 'Enlace de entidad y de dato' },
  { fg: 'link', bg: 'tt-panel', where: 'Enlaces del tooltip' },
  { fg: 'link-prose', bg: 'bg-primary', where: 'Enlace dentro de un párrafo' },
  { fg: 'link-prose', bg: 'bg-secondary', where: 'Enlace dentro de un párrafo' },
  { fg: 'white', bg: 'banner', where: 'Texto del banner de datos y del chip «Inactivo»' },
  { fg: 'black', bg: 'white', where: 'Texto del botón sólido' },
  { fg: 'tt-label', bg: 'tt-panel', where: 'Etiquetas del tooltip' },
  { fg: 'tt-value', bg: 'tt-panel', where: 'Valores y nombre de la entidad en el tooltip' },
  { fg: 'tt-muted', bg: 'tt-panel', where: 'Valor de progreso del entrenamiento' },
  { fg: 'tt-hint', bg: 'tt-panel', where: 'Chevrones de las secciones plegables' },
  { fg: 'tt-hint', bg: 'tt-panel-deep', where: '«Mantén Shift para fijar»' },
];

/** Non-text pairs that carry meaning, WCAG 1.4.11: 3:1 or more. */
const NON_TEXT_PAIRS: Pair[] = [
  { fg: 'ring', bg: 'bg-primary', where: 'Anillo de foco visible' },
  { fg: 'selected', bg: 'bg-primary', where: 'Borde de toggles, pestañas y conmutador de vista' },
  {
    fg: 'selected',
    bg: 'bg-tertiary',
    where: 'Relleno del medidor de entrenamiento de la tarjeta',
  },
  { fg: 'amber', bg: 'bg-primary', where: 'Barra del gráfico de Guild en hover y foco' },
  { fg: 'tt-label', bg: 'tt-track', where: 'Relleno de la barra de entrenamiento del tooltip' },
  { fg: 'tt-shiny', bg: 'bg-primary', where: 'Marca Shiny en tarjetas y slots' },
  { fg: 'tt-shiny', bg: 'bg-secondary', where: 'Marca Shiny sobre el escenario de sprite' },
  { fg: 'tt-shiny', bg: 'bg-tertiary', where: 'Marca Shiny en chips' },
  { fg: 'tt-shiny', bg: 'tt-panel', where: 'Marca Shiny en el tooltip' },
  { fg: 'text-quinary', bg: 'bg-primary', where: 'Separadores « · » y «–» entre enlaces' },
];

type Exception = Pair & { minimum: number; ratio: number; reason: string };

/** The pairs §13.7 keeps below the minimum, each with the reason §13.7 gives. */
const EXCEPTIONS: Exception[] = [
  {
    fg: 'ring',
    bg: 'bg-secondary',
    where: 'Anillo de foco sobre nota, aviso, panel de Slots o fila de Lista en hover',
    minimum: NON_TEXT_MINIMUM,
    ratio: 2.96,
    reason:
      'El sistema de diseño aprobado conserva el anillo en este valor; con ring #5b64f0 daría 3,91:1. Incumple WCAG 1.4.11 y 1.4.3 hasta que el propietario responda Q10.',
  },
  {
    fg: 'ring',
    bg: 'bg-tertiary',
    where: 'Anillo de foco sobre cualquier superficie en hover',
    minimum: NON_TEXT_MINIMUM,
    ratio: 2.48,
    reason:
      'El sistema de diseño aprobado conserva el anillo en este valor; con ring #5b64f0 daría 3,26:1. Incumple WCAG 1.4.11 y 1.4.3 hasta que el propietario responda Q10.',
  },
  {
    fg: 'ring',
    bg: 'tt-panel',
    where: 'Anillo de foco dentro del tooltip del juego',
    minimum: NON_TEXT_MINIMUM,
    ratio: 2.51,
    reason:
      'El sistema de diseño aprobado conserva el anillo en este valor; con ring #5b64f0 daría 3,31:1.',
  },
  {
    fg: 'text-quaternary',
    bg: 'bg-tertiary',
    where: 'Solo el texto del disparador de búsqueda, y solo en hover',
    minimum: TEXT_MINIMUM,
    ratio: 4.26,
    reason: 'Ningún otro texto va sobre bg-tertiary; con text-quaternary #8a8d93 daría 4,55:1.',
  },
  {
    fg: 'border-primary',
    bg: 'bg-primary',
    where: 'Borde de botones, pestañas, toggles sin seleccionar y campo numérico',
    minimum: NON_TEXT_MINIMUM,
    ratio: 1.7,
    reason: 'El texto del control lo identifica: el borde no es su única señal.',
  },
  {
    fg: 'selected',
    bg: 'bg-primary',
    alpha: 'opacity-partial',
    where: 'Barra del día en curso del gráfico de Guild',
    minimum: NON_TEXT_MINIMUM,
    ratio: 2.08,
    reason: 'El eje nombra la barra «en curso»: el color no es su única señal.',
  },
];

/** Decorative, outside WCAG 1.4.11; the design system records the figure anyway. */
const DECORATIVE: (Pair & { ratio: number; reason: string })[] = [
  {
    fg: 'border-secondary',
    bg: 'bg-primary',
    where: 'Borde por defecto de 1 px de tarjetas, paneles, tablas, campos y pie',
    ratio: 1.28,
    reason: 'Decorativo: nunca es la única señal de un control.',
  },
];

describe('S12: contraste de los tokens de color', () => {
  it('lee los 31 colores desde tokens.css', () => {
    const colors = tokensJson.color.tokens;
    expect(colors).toHaveLength(55);
    for (const token of colors) {
      expect(tokenValue(token.name), `--${token.name} difiere de tokens.json`).toBe(token.value);
      expect(() => colorOf(token.name), `--${token.name} no se pudo leer`).not.toThrow();
    }
  });

  it('da 4,5:1 o más a todo par de texto', () => {
    for (const pair of TEXT_PAIRS) {
      expect(ratioOf(pair), `${nameOf(pair)} — ${pair.where}`).toBeGreaterThanOrEqual(TEXT_MINIMUM);
    }
  });

  it('da 3:1 o más a todo borde, icono y anillo con significado', () => {
    for (const pair of NON_TEXT_PAIRS) {
      expect(ratioOf(pair), `${nameOf(pair)} — ${pair.where}`).toBeGreaterThanOrEqual(
        NON_TEXT_MINIMUM,
      );
    }
  });

  it('mantiene las seis excepciones de §13.7 en su valor exacto y con su razón', () => {
    expect(EXCEPTIONS).toHaveLength(6);
    for (const pair of EXCEPTIONS) {
      expect(ratioOf(pair), `${nameOf(pair)} cambió de valor`).toBe(pair.ratio);
      expect(pair.reason.length, `${nameOf(pair)} sin razón`).toBeGreaterThan(0);
      // A pair that now clears its minimum stops being an exception: it moves to the
      // table that demands it instead of staying on a list that excuses it.
      expect(pair.ratio, `${nameOf(pair)} ya cumple ${pair.minimum}:1`).toBeLessThan(pair.minimum);
    }
  });

  it('no excusa ningún par que también esté en las tablas que sí se exigen', () => {
    const required = new Set([...TEXT_PAIRS, ...NON_TEXT_PAIRS].map(nameOf));
    for (const pair of EXCEPTIONS) {
      expect(required.has(nameOf(pair)), `${nameOf(pair)} está en dos tablas`).toBe(false);
    }
  });

  it('mantiene el borde decorativo en el valor que documenta el sistema de diseño', () => {
    for (const pair of DECORATIVE) {
      expect(ratioOf(pair), `${nameOf(pair)} cambió de valor`).toBe(pair.ratio);
      expect(pair.reason.length, `${nameOf(pair)} sin razón`).toBeGreaterThan(0);
    }
  });
});
