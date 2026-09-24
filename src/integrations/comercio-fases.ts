// Spec 9.3: how each Comercio route renders in each phase, and the route of the list data that
// only phase A with its sample registry has. Registered in astro.config.mjs before react().
//
// 1. The list, the detail and the profile — every route whose component lives under
//    `src/pages/[locale]/comercio/`, except the publish page — export no `prerender`. In
//    `astro:route:setup` this integration sets `route.prerender = !comercioPublico()`: phase A
//    prerenders them (the detail and the profile from `getStaticPaths` over the sample registry,
//    which is empty without COMERCIO_DEMO, 9.2) and phase B renders them on demand. Astro runs
//    that hook after it reads the export of the file (node_modules/astro/dist/core/routing/
//    prerender.js), so the hook would override an export without a word: the integration reads
//    each of those files and fails the build, and the development server, when one exports
//    `prerender`.
// 2. `src/pages/[locale]/comercio/publicar.astro` prerenders its frame in both phases and says so
//    itself, `export const prerender = true`: the hook leaves it alone.
// 3. `/{l}/comercio/datos.json` (PR5), the whole public list of phase A that the list island asks
//    for when it has more than one page, lives outside src/pages/, in
//    src/routes/comercio/datos.json.ts, and is injected prerendered only with COMERCIO_DEMO and
//    without COMERCIO_PUBLICO. A production build has neither, so the route does not exist there
//    (CA-9.1); phase B reads the list from Supabase and has no such file.
//
// 4. `/{l}/comercio/operaciones/` and `/{l}/comercio/moderacion/`, the two routes of phase B
//    (9.10, 9.11), live outside src/pages/ too, in src/routes/comercio/, and are injected only
//    with COMERCIO_PUBLICO: without it they do not exist and answer 404 (S11, CA-9.13). A file
//    outside src/pages/ exports no `prerender`, so the injection sets it: «Mis operaciones» is a
//    prerendered frame whose island reads the session (one HTML per locale from its
//    `getStaticPaths`), and the moderation queue renders on demand, because it answers 404 to an
//    account that does not moderate (9.3).
//
// The switches (9.2) are read the way the pages read them (src/lib/trade/registry.ts, and
// `hideDrafts` of src/lib/content/registry.ts): the shell or Vercel first, then the `.env` files
// of the mode, which is what `import.meta.env` hands the pages. So a route never renders in one
// phase while its page composes the other. scripts/test/build-comercio-fases.mjs builds the
// phases and checks the output (CA-9.1, CA-9.18).

import { readFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

import type { AstroIntegration } from 'astro';

/** The two switches of 9.2. */
export interface ComercioSwitches {
  /** COMERCIO_DEMO: the pages read the sample registry of content/comercio/ (phase A). */
  demo: boolean;
  /** COMERCIO_PUBLICO: phase B. */
  publico: boolean;
}

const SWITCH_NAMES = ['COMERCIO_DEMO', 'COMERCIO_PUBLICO'] as const;

type SwitchName = (typeof SWITCH_NAMES)[number];

/** `1` or `true`, in any case, as `comercioDemo` and `comercioPublico` read them. */
function isOn(value: string | undefined): boolean {
  const text = (value ?? '').toLowerCase();
  return text === '1' || text === 'true';
}

/**
 * The switches as Vite's `loadEnv` gives them to `import.meta.env`: `.env`, `.env.local`,
 * `.env.{mode}` and `.env.{mode}.local` in that order, each over the one before, and the
 * environment of the process over all of them. A file that does not exist is skipped.
 */
export function readSwitches(
  envDir: string,
  mode: string,
  shell: Readonly<Record<string, string | undefined>> = process.env,
): ComercioSwitches {
  const values: Partial<Record<SwitchName, string>> = {};
  for (const name of ['.env', '.env.local', `.env.${mode}`, `.env.${mode}.local`]) {
    let text: string;
    try {
      text = readFileSync(join(envDir, name), 'utf8');
    } catch {
      continue;
    }
    const parsed = parseEnv(text);
    for (const key of SWITCH_NAMES) {
      const value = parsed[key];
      if (value !== undefined) values[key] = value;
    }
  }
  for (const key of SWITCH_NAMES) {
    const value = shell[key];
    if (value !== undefined) values[key] = value;
  }
  return { demo: isOn(values.COMERCIO_DEMO), publico: isOn(values.COMERCIO_PUBLICO) };
}

/**
 * Whether a page or endpoint exports `prerender`, whatever its value, as a declaration
 * (`export const prerender = …`) or in an export list (`export { prerender }`). In an `.astro`
 * file only the frontmatter can export, so only the frontmatter is read: a line of markup that
 * happens to spell the words is not an export.
 */
export function exportsPrerender(source: string): boolean {
  const text = source.charCodeAt(0) === 0xfeff ? source.slice(1) : source;
  const fence = /^\s*---[^\S\n]*\r?\n/.exec(text);
  let code = text;
  if (fence !== null) {
    const body = text.slice(fence[0].length);
    const close = /^---[^\S\n]*$/m.exec(body);
    code = close === null ? body : body.slice(0, close.index);
  }
  return (
    /^\s*export\s+(?:const|let|var)\s+prerender\b/m.test(code) ||
    /^\s*export\s*\{[^}]*\bprerender\b[^}]*\}/m.test(code)
  );
}

/** A path relative to the root, with `/` as Astro writes `route.component` on every system. */
function componentPath(rootPath: string, file: string): string {
  return relative(rootPath, file).split(sep).join('/');
}

/** The route of the list data of phase A (PR5), one prerendered file per locale. */
export const DATOS_PATTERN = '/[locale]/comercio/datos.json';

/** «Mis operaciones» (9.10), phase B only: a prerendered frame and an island with the session. */
export const OPERACIONES_PATTERN = '/[locale]/comercio/operaciones';

/** The moderation queue (9.11), phase B only, rendered on demand: 404 to a non-moderator. */
export const MODERACION_PATTERN = '/[locale]/comercio/moderacion';

export function comercioFases(): AstroIntegration {
  let rootPath = '';
  /** `src/pages/[locale]/comercio/`, as `route.component` starts for the pages of Comercio. */
  let pagesPrefix = '';
  let switches: ComercioSwitches = { demo: false, publico: false };

  return {
    name: 'alliance-codex:comercio-fases',
    hooks: {
      'astro:config:setup': ({ config, command, injectRoute }) => {
        rootPath = fileURLToPath(config.root);
        const comercioPages = join(fileURLToPath(config.srcDir), 'pages', '[locale]', 'comercio');
        pagesPrefix = `${componentPath(rootPath, comercioPages)}/`;
        const envDir = typeof config.vite?.envDir === 'string' ? config.vite.envDir : rootPath;
        switches = readSwitches(
          resolve(rootPath, envDir),
          command === 'dev' ? 'development' : 'production',
        );

        if (switches.demo && !switches.publico) {
          injectRoute({
            pattern: DATOS_PATTERN,
            entrypoint: new URL('routes/comercio/datos.json.ts', config.srcDir),
            prerender: true,
          });
        }

        if (switches.publico) {
          injectRoute({
            pattern: OPERACIONES_PATTERN,
            entrypoint: new URL('routes/comercio/operaciones.astro', config.srcDir),
            prerender: true,
          });
          injectRoute({
            pattern: MODERACION_PATTERN,
            entrypoint: new URL('routes/comercio/moderacion.astro', config.srcDir),
            prerender: false,
          });
        }
      },
      'astro:route:setup': ({ route }) => {
        if (!route.component.startsWith(pagesPrefix)) return;
        const rest = route.component.slice(pagesPrefix.length);
        if (rest === 'publicar.astro' || rest.startsWith('publicar/')) return;

        const source = readFileSync(resolve(rootPath, route.component), 'utf8');
        if (exportsPrerender(source)) {
          throw new Error(
            `${route.component} exporta \`prerender\`. Las páginas de Comercio no lo exportan: ` +
              'src/integrations/comercio-fases.ts fija su modo de render por fase (§9.3) y ' +
              'pisaría esa exportación sin avisar. Quita la exportación de la página.',
          );
        }
        route.prerender = !switches.publico;
      },
    },
  };
}
