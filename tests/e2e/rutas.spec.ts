// M11 acceptance over the Vercel output: the routes that close F2, measured on the emulator of
// §14.3, which walks the `routes` of the real `.vercel/output/config.json` and runs the
// on-demand function of the 404 — so every redirection and every 404 here is the one that gets
// deployed, not a copy of `astro.config.mjs`.
//
// What it measures, by the ids of the spec:
//
//  - §8.13: RZ1 (`/` is a 302 to `/es/` with no meta refresh and no HTML of its own), RZ2 (`/es`
//    and `/en` end in the home of their locale after one redirection at most) and RZ3 (no route
//    of the §8.0.1 inventory, no retired route and no 404 answers with a chain of redirections).
//  - §8.12: NF1 (the 404 of each locale with the frame, the h1 of its language and the
//    `<title>` of §13.5, the menu and `noindex`; `/xx/` and `/xx/pokedex/` in `es`;
//    `/{l}/fuentes/`, the route of a deleted page, in its own locale and not a 500), NF2 (the
//    requested path is text, cut to 120 characters, and nothing it carries runs) and NF3 (an
//    unknown Pokémon, system or activity id answers the 404 itself, never a redirection), plus
//    WA3 of the 404: no menu entry is marked on it (7.10.2, E10). Its budgets of §13.6 and its
//    link to the shared stylesheet (S17) are gates of `pnpm ci`: `check-dist.mjs` and
//    `perf:budget` render it through the server function (scripts/lib/bajo-demanda.mjs).
//  - §8.11: MP1 (crumbs, h1 and one line in the main column; no canvas, image or button), MP2
//    (the 302 of `/{l}/mapa/aportar` and no HTML for it) and MP3 (`noindex`).
//  - §8.14: CP1 (crumbs, h1 and one line, no button and no island, `noindex`, out of the sitemap,
//    and no `PokemonExplorer.tsx` in the repository).
//  - The other criteria of the same milestone that only the built pages can show: CA1 to CA3 of
//    Cambios (§8.7), AV1 to AV3 of the activities (§8.9) and HT1 of Herramientas (§8.10), with
//    WA4 of the activity pages and WL1 of the six pages — the texts of §12.6, §12.9, §12.12,
//    §12.13 and §12.15 that were deleted.
//
// S19: every figure and text below is computed from `content/` and from the dictionaries when
// the spec loads, never copied from a board (X4). Cambios follows its registry: with no change
// published it is CA2, with changes it is CA1 over the months the registry gives. A build with
// `OCULTAR_BORRADORES=1` is read the same way, so run the spec with the variable the build had.
//
// Runs in the `prod` project, which serves `.vercel/output` (`pnpm build` first):
//
//   pnpm build && pnpm exec playwright test --project=prod tests/e2e/rutas.spec.ts

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { APIRequestContext, Page } from '@playwright/test';

import { en } from '../../src/i18n/messages/en';
import type { Messages } from '../../src/i18n/messages/en';
import { es } from '../../src/i18n/messages/es';
import { expandirIdiomas, idiomas, plantillasDelSitio } from '../../scripts/lib/rutas-migradas.mjs';
import { expect, test } from './fixtures';
import { NOT_FOUND_SLUG, RETIRED_ROUTES } from './routes';

// ------------------------------------------------------------------------------ registries

type Locale = 'es' | 'en';
type Texto = Partial<Record<Locale, string>>;

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** The two copies of the static output: the one the adapter deploys and Astro's own. */
const OUTPUTS = [resolve(ROOT, '.vercel', 'output', 'static'), resolve(ROOT, 'dist', 'client')];

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(resolve(ROOT, file), 'utf8')) as T;
}

/** `hideDrafts` of src/lib/content/registry.ts, read from the environment of this run. */
const HIDE_DRAFTS = /^(?:1|true)$/i.test(process.env.OCULTAR_BORRADORES ?? '');

interface QuestRecord {
  id: string;
  nombre: string;
  nivelRequerido: number | null;
  resumen: Texto | null;
  instrucciones: Texto | null;
  requisitos: Texto[];
  pasos: Texto[];
  recompensas: Texto[];
  npcs: string[];
  notas: Texto[];
}

interface CambioRecord {
  id: string;
  fecha: string;
  borrador?: boolean;
}

const QUESTS = readJson<{ misiones: QuestRecord[] }>('content/quests.json').misiones;

/** content/cambios.json is optional (§3.13): without it the page has no change. */
const CAMBIOS = (
  existsSync(resolve(ROOT, 'content', 'cambios.json'))
    ? readJson<{ cambios: CambioRecord[] }>('content/cambios.json').cambios
    : []
).filter((cambio) => !(HIDE_DRAFTS && cambio.borrador === true));

const MESSAGES: Record<Locale, Messages> = { es, en };
const LOCALES = idiomas as Locale[];

// ------------------------------------------------------------------------------ helpers

const NUMBER_LOCALE: Record<Locale, string> = { es: 'es-ES', en: 'en-US' };

/** §13.3: grouped thousands in both locales, as `formatInteger` writes them. */
function figure(value: number, locale: Locale): string {
  return new Intl.NumberFormat(NUMBER_LOCALE[locale], { useGrouping: 'always' }).format(value);
}

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => values[key] ?? whole);
}

/**
 * `textIn` of src/lib/content/content-schema.ts (8.0.5, T22): the text in the page's language,
 * or the one the record has, with the `lang` of that language.
 */
function shown(value: Texto, locale: Locale): { text: string; lang: Locale | null } {
  const own = value[locale];
  if (own !== undefined) return { text: own, lang: null };
  const other = LOCALES.find((option) => value[option] !== undefined);
  if (other === undefined) throw new Error('an activity text has no language (3.13)');
  return { text: value[other] as string, lang: other };
}

/** §8.0.1: the redirections of the site are temporary, so 302 and nothing else. */
const REDIRECT = 302;

function isRedirect(status: number): boolean {
  return status >= 300 && status < 400;
}

function forLocale(template: string, locale: string): string {
  return template.replaceAll('{l}', locale);
}

/** §8.0.1: «aceptan la ruta con y sin barra final». */
function withoutSlash(path: string): string {
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
}

/** Whether a page of the output exists as HTML: `x/` is `x/index.html` (§14.3). */
function hasHtml(route: string): boolean {
  const segments = route.split('/').filter((segment) => segment.length > 0);
  return OUTPUTS.some((output) => existsSync(resolve(output, ...segments, 'index.html')));
}

/** §13.5: the `content` of the robots tag of a document, or `null` without one. */
function robotsTag(html: string): string | null {
  const tag = /<meta\s[^>]*name=["']robots["'][^>]*>/i.exec(html);
  if (tag === null) return null;
  return /content=["']([^"']*)["']/i.exec(tag[0])?.[1] ?? '';
}

/** §13.5: `site` of astro.config.mjs, the origin of every URL of the sitemap. */
const SITE = 'https://pokealliance-codex.vercel.app';

let sitemap: Promise<string[]> | null = null;

/** Every `<loc>` of the sitemap index and of the sitemaps it lists, read once per worker. */
function sitemapUrls(request: APIRequestContext): Promise<string[]> {
  const locations = async (path: string): Promise<string[]> => {
    const response = await request.get(path);
    expect(response.status(), `${path} answers`).toBe(200);
    return [...(await response.text()).matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map(
      (match) => match[1],
    );
  };
  sitemap ??= (async () => {
    const urls: string[] = [];
    for (const child of await locations('/sitemap-index.xml')) {
      urls.push(...(await locations(new URL(child).pathname)));
    }
    return urls;
  })();
  return sitemap;
}

/** What the main column holds without the footer that PageLayout puts inside it (CA2, MP1). */
interface MainColumn {
  crumbs: string[];
  h1: string[];
  paragraphs: string[];
  canvas: number;
  img: number;
  buttons: number;
  islands: number;
  text: string;
}

/**
 * The main column as CA2, MP1 and CP1 read it: `main` without `.ac-page-layout__foot`, the
 * footer `DS:PageLayout` puts inside `main` (bundle.js:60-62).
 */
function mainColumn(page: Page): Promise<MainColumn> {
  return page.evaluate(() => {
    const main = document.querySelector('main#contenido');
    if (main === null) throw new Error('no main#contenido');
    const inColumn = (element: Element) => element.closest('.ac-page-layout__foot') === null;
    const all = (selector: string) => [...main.querySelectorAll(selector)].filter(inColumn);
    const words = (element: Element) => (element.textContent ?? '').replace(/\s+/g, ' ').trim();
    const clone = main.cloneNode(true) as Element;
    clone.querySelector('.ac-page-layout__foot')?.remove();
    return {
      crumbs: all('nav.ac-breadcrumb li.ac-breadcrumb__item').map(words),
      h1: all('h1').map(words),
      paragraphs: all('p').map(words),
      canvas: all('canvas').length,
      img: all('img').length,
      buttons: all('button, [role="button"]').length,
      islands: all('astro-island').length,
      text: words(clone),
    };
  });
}

/** The menu entries the page marks with `aria-current` (7.10.2, E10), sidebar and sheet. */
function markedMenuEntries(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [
      ...document.querySelectorAll(
        '.ac-page-layout__sidebar [aria-current], .ac-mobile-menu [aria-current]',
      ),
    ]
      .filter((element) => element.closest('.ac-language-menu') === null)
      .map(
        (element) => `${element.getAttribute('href')} (${element.getAttribute('aria-current')})`,
      ),
  );
}

/**
 * WL1 (§8.0.7): which of the texts a row BORRAR of §12 deleted are on the page. Each one is
 * looked for as the whole content of a text node, after trimming — hidden ones included, which
 * is stricter than WL1 — and as the whole value of `aria-label`, `alt`, `title` or
 * `placeholder`. The lists below hold interface texts only: a text of a registry does not count
 * for WL1.
 */
async function deletedTexts(page: Page, texts: readonly string[]): Promise<string[]> {
  return page.evaluate(
    (list) => {
      const found = new Set<string>();
      const set = new Set(list);
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (walker.nextNode() !== null) {
        const parent = walker.currentNode.parentElement;
        if (parent === null || parent.closest('script, style, template') !== null) continue;
        const text = (walker.currentNode.textContent ?? '').replace(/\s+/g, ' ').trim();
        if (set.has(text)) found.add(text);
      }
      for (const element of document.querySelectorAll(
        '[aria-label], [alt], [title], [placeholder]',
      )) {
        for (const name of ['aria-label', 'alt', 'title', 'placeholder']) {
          const value = element.getAttribute(name);
          if (value !== null && set.has(value.trim())) found.add(value.trim());
        }
      }
      return [...found];
    },
    [...texts],
  );
}

// ------------------------------------------------------------------------------ §8.13 root

test.describe('§8.13: la raíz y la raíz de cada idioma', () => {
  test('RZ1: / responde 302 a /es/ sin meta refresh y sin HTML propio', async ({ request }) => {
    const response = await request.get('/', { maxRedirects: 0 });
    expect(response.status(), 'RZ1: the root redirects').toBe(REDIRECT);
    expect(response.headers()['location'], 'RZ1: to the Spanish home').toBe('/es/');
    expect(await response.text(), 'RZ1: no body with http-equiv="refresh"').not.toMatch(
      /http-equiv/i,
    );
    // T16, R-01: the redirection is configuration, so the build writes no page for `/`.
    expect(hasHtml('/'), '8.13: the output has no HTML for /').toBe(false);
  });

  for (const locale of LOCALES) {
    test(`RZ2: /${locale} termina en el Inicio ${locale} con una redirección como mucho`, async ({
      request,
    }) => {
      const first = await request.get(`/${locale}`, { maxRedirects: 0 });
      expect(
        first.status() === 200 || isRedirect(first.status()),
        `RZ2: /${locale} answers ${first.status()}`,
      ).toBe(true);
      const final = isRedirect(first.status())
        ? await request.get(first.headers()['location'] ?? '', { maxRedirects: 0 })
        : first;
      expect(final.status(), 'RZ2: it ends in 200, not in a second redirection').toBe(200);
      const html = await final.text();
      expect(html, 'RZ2: the document of that locale').toContain(`<html lang="${locale}"`);
      expect(html, 'RZ2: the h1 of the Inicio').toContain(MESSAGES[locale].home.title);
    });
  }
});

// ------------------------------------------------------------------------------ RZ3

/**
 * RZ3: one route per template of the §8.0.1 inventory in each locale — the first value of a
 * template with a parameter (`/{l}/pokedex/{id}/` and the rest), taken from the route inventory
 * of scripts/lib/rutas-migradas.mjs (`plantillasDelSitio`), which holds no parity route: the
 * output never carries them (§14.5).
 */
const INVENTORY: string[] = plantillasDelSitio.flatMap((template: string) =>
  expandirIdiomas([template]).slice(0, LOCALES.length),
);

test.describe('RZ3: ninguna ruta encadena redirecciones', () => {
  test('las rutas de §8.0.1 responden sin redirección, y sin la barra final con una como mucho', async ({
    request,
  }) => {
    expect(INVENTORY.length, 'the inventory of §8.0.1 is read').toBeGreaterThan(0);
    for (const route of INVENTORY) {
      const canonical = await request.get(route, { maxRedirects: 0 });
      expect.soft(canonical.status(), `${route} answers straight away`).toBe(200);

      const bare = withoutSlash(route);
      if (bare === route) continue;
      const first = await request.get(bare, { maxRedirects: 0 });
      if (first.status() === 200) continue;
      expect.soft(isRedirect(first.status()), `${bare} answers or redirects once`).toBe(true);
      const second = await request.get(first.headers()['location'] ?? '', { maxRedirects: 0 });
      expect.soft(second.status(), `${bare}: no second redirection`).toBe(200);
    }
  });

  test('las rutas retiradas y la raíz llegan en un solo salto a una página que responde 200', async ({
    request,
  }) => {
    const sources = [
      { from: '/', to: '/es/' },
      ...RETIRED_ROUTES.flatMap(({ from, to }) =>
        LOCALES.flatMap((locale) => {
          const target = forLocale(to, locale);
          const source = forLocale(from, locale);
          return [
            { from: source, to: target },
            { from: withoutSlash(source), to: target },
          ];
        }),
      ),
    ];
    for (const { from, to } of sources) {
      const response = await request.get(from, { maxRedirects: 0 });
      expect.soft(response.status(), `${from} redirects`).toBe(REDIRECT);
      expect.soft(response.headers()['location'], `${from} lands on ${to}`).toBe(to);
      const landing = await request.get(to, { maxRedirects: 0 });
      expect.soft(landing.status(), `${to}: the end of the chain`).toBe(200);
    }
  });

  test('una ruta que no existe responde 404 sin redirección, con y sin barra final', async ({
    request,
  }) => {
    for (const locale of LOCALES) {
      const route = `/${locale}/${NOT_FOUND_SLUG}/`;
      for (const path of [route, withoutSlash(route)]) {
        const response = await request.get(path, { maxRedirects: 0 });
        expect.soft(response.status(), `${path} answers the 404 itself`).toBe(404);
      }
    }
  });
});

// ------------------------------------------------------------------------------ §8.0.1 302

test.describe('§8.0.1: las tres redirecciones 302', () => {
  for (const { from, to } of RETIRED_ROUTES) {
    for (const locale of LOCALES) {
      const source = forLocale(from, locale);
      const target = forLocale(to, locale);
      // MP2 for `/{l}/mapa/aportar/`, AV2 for `/{l}/guias/`, TL2 for `/{l}/rotaciones/`.
      test(`${source} y ${withoutSlash(source)} responden 302 a ${target}`, async ({ request }) => {
        for (const path of [source, withoutSlash(source)]) {
          const response = await request.get(path, { maxRedirects: 0 });
          expect(response.status(), `${path} answers a 302`).toBe(REDIRECT);
          expect(response.headers()['location'], `${path} goes to ${target}`).toBe(target);
        }
        // The retired route has no page of its own in the output (MP2: «dist/ no contiene HTML
        // de mapa/aportar»).
        expect(hasHtml(source), `${source} has no HTML in the output`).toBe(false);
      });
    }
  }
});

// ------------------------------------------------------------------------------ §8.12 404

test.describe('§8.12: la 404', () => {
  for (const locale of LOCALES) {
    const probe = locale === 'es' ? `/es/${NOT_FOUND_SLUG}/` : '/en/does-not-exist/';

    test(`NF1: ${probe} responde 404 con el marco, el h1 de ${locale}, el menú y noindex`, async ({
      page,
    }) => {
      const response = await page.goto(probe);
      expect(response?.status(), 'NF1: status 404').toBe(404);
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      await expect(page.locator('header.ac-header')).toBeVisible();
      await expect(page.locator('main#contenido h1')).toHaveText(MESSAGES[locale].errors.notFound);
      await expect(page.locator('h1')).toHaveCount(1);
      // §13.5: «Página no encontrada · Alliance Codex» / «Page not found · Alliance Codex».
      // `seo:check` reads the static output only, so the title of this page is measured here.
      await expect(page, '§13.5: the title of the 404').toHaveTitle(
        `${MESSAGES[locale].errors.notFound} · Alliance Codex`,
      );
      // The menu of 8.0.3: at 1440 the sidebar, with the links of every group (7.10.2).
      const menu = page.locator('.ac-page-layout__sidebar');
      await expect(menu).toBeVisible();
      await expect(menu.locator(`a[href="/${locale}/"]`)).toHaveCount(1);
      expect(await menu.locator('a[href]').count(), 'NF1: the whole menu').toBeGreaterThan(1);
      // 8.0.4, E4: no crumbs. 13.5: noindex.
      await expect(page.locator('nav.ac-breadcrumb')).toHaveCount(0);
      expect(robotsTag(await page.content()), '§13.5: the 404 is noindex').toBe('noindex');
      // 8.12 steps 2 to 4: the line with the path, the search trigger and Destacados.
      await expect(page.locator('main#contenido .ac-not-found__line')).toHaveText(
        fill(MESSAGES[locale].errors.notFoundLine, { path: probe }),
      );
      await expect(page.locator('main#contenido .ac-search-trigger:visible')).toHaveCount(1);
      // WA3 (7.10.2): the 404 hangs from no section and marks no entry.
      expect(await markedMenuEntries(page), 'WA3: the 404 marks no menu entry').toEqual([]);
    });
  }

  test('NF1: /xx/ y /xx/pokedex/ responden la 404 en es', async ({ request }) => {
    for (const path of ['/xx/', '/xx/pokedex/']) {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status(), `${path} answers 404`).toBe(404);
      const html = await response.text();
      expect(html, `${path} is the Spanish 404`).toContain('<html lang="es"');
      expect(html, `${path}: the h1 of es`).toContain(es.errors.notFound);
    }
  });

  test('/{l}/fuentes/, fuera de §8.0.1, responde la 404 de su idioma y no un 500', async ({
    request,
  }) => {
    // The plan of M11: the folder of the deleted «Fuentes» page is gone, and its route is one
    // more path that matches nothing.
    for (const locale of LOCALES) {
      const path = `/${locale}/fuentes/`;
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status(), `${path} answers 404`).toBe(404);
      const html = await response.text();
      expect(html, `${path}: the ${locale} 404`).toContain(`<html lang="${locale}"`);
      expect(robotsTag(html), `${path}: noindex`).toBe('noindex');
    }
  });

  test('NF2: la ruta pedida se muestra como texto y no ejecuta nada', async ({ page, request }) => {
    const dialogs: string[] = [];
    page.on('dialog', async (dialog) => {
      dialogs.push(dialog.message());
      await dialog.dismiss();
    });
    const path = '/es/<script>alert(1)</script>/';
    const response = await page.goto(path);
    expect(response?.status(), 'NF2: the 404').toBe(404);
    await expect(page.locator('main#contenido .ac-not-found__line')).toHaveText(
      fill(es.errors.notFoundLine, { path }),
    );
    expect(dialogs, 'NF2: nothing in the path runs').toEqual([]);
    await expect(page.locator('main#contenido script')).toHaveCount(0);

    // The HTML itself carries the path escaped, never as markup.
    const raw = await (await request.get(encodeURI(path), { maxRedirects: 0 })).text();
    expect(raw).not.toContain('<script>alert(1)</script>');
    expect(raw).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  test('NF2: una ruta de más de 120 caracteres se corta a 119 y «…»', async ({ page }) => {
    const path = `/es/${'a'.repeat(200)}/`;
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
    const line = page.locator('main#contenido .ac-not-found__line');
    await expect(line).toHaveText(fill(es.errors.notFoundLine, { path: `${path.slice(0, 119)}…` }));
    // WG1 at 390: a path is one word, and it breaks inside the column.
    await page.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(390);
  });

  for (const locale of LOCALES) {
    test(`NF3: una ficha, un sistema o una actividad desconocidos llegan a la 404 (${locale})`, async ({
      page,
    }) => {
      for (const section of ['pokedex', 'sistemas', 'actividades']) {
        const path = `/${locale}/${section}/${NOT_FOUND_SLUG}/`;
        const response = await page.goto(path);
        // `page.goto` follows redirections, so the status of the first answer is read too.
        expect.soft(response?.request().redirectedFrom(), `${path}: no redirection`).toBeNull();
        expect.soft(response?.status(), `${path}: status 404`).toBe(404);
        await expect
          .soft(page.locator('main#contenido h1'), `${path}: the 404 page`)
          .toHaveText(MESSAGES[locale].errors.notFound);
        // WA3: a 404 under a section is not a child page of it (E10, 7.10.2).
        expect.soft(await markedMenuEntries(page), `${path}: no menu entry marked`).toEqual([]);
      }
    });
  }
});

// ------------------------------------------------------------------------------ §8.11 Mapa

test.describe('§8.11: Mapa (marcador)', () => {
  for (const locale of LOCALES) {
    const { map, tools } = MESSAGES[locale];
    const route = `/${locale}/mapa/`;

    test(`MP1 y MP3: ${route} es migas, h1 y una línea, noindex`, async ({ page }) => {
      const response = await page.goto(route);
      expect(response?.status()).toBe(200);
      const column = await mainColumn(page);
      expect(column.crumbs, 'MP1: «Herramientas › Mapa»').toEqual([tools.title, map.title]);
      await expect(
        page.locator('nav.ac-breadcrumb a.ac-breadcrumb__link', { hasText: tools.title }),
      ).toHaveAttribute('href', `/${locale}/herramientas/`);
      expect(column.h1, 'MP1: the h1').toEqual([map.title]);
      expect(column.paragraphs, 'MP1: exactly one <p>, the EmptyState').toEqual([map.empty]);
      expect(column.canvas, 'MP1: no canvas').toBe(0);
      expect(column.img, 'MP1: no image').toBe(0);
      expect(column.buttons, 'MP1: no button').toBe(0);
      expect(column.islands, 'R9: MapExplorer is not rendered').toBe(0);
      expect(robotsTag(await page.content()), 'MP3').toBe('noindex');
    });
  }

  test('MP3 y §13.5: el marcador no está en el sitemap', async ({ request }) => {
    const urls = await sitemapUrls(request);
    for (const locale of LOCALES) {
      expect(urls, `/${locale}/mapa/ is noindex`).not.toContain(`${SITE}/${locale}/mapa/`);
    }
  });
});

// ------------------------------------------------------------------------------ §8.14 Comparar

test.describe('§8.14: Comparar Pokémon hasta F5 (marcador)', () => {
  for (const locale of LOCALES) {
    const { compare } = MESSAGES[locale];
    const route = `/${locale}/herramientas/pokemon/`;

    test(`CP1: ${route} es migas, h1 y una línea, sin botones ni isla, noindex`, async ({
      page,
    }) => {
      const response = await page.goto(route);
      expect(response?.status()).toBe(200);
      const column = await mainColumn(page);
      // 8.0.4: «Pokémon» has no index, so its crumb is text with no link.
      expect(column.crumbs, 'CP1: «Pokémon › Comparar Pokémon»').toEqual([
        'Pokémon',
        compare.title,
      ]);
      await expect(page.locator('nav.ac-breadcrumb a')).toHaveCount(0);
      expect(column.h1).toEqual([compare.title]);
      expect(column.paragraphs, 'CP1: exactly one <p>').toEqual([compare.empty]);
      expect(column.buttons, 'CP1: no button').toBe(0);
      expect(column.islands, 'CP1: no island').toBe(0);
      expect(robotsTag(await page.content()), 'CP1: noindex').toBe('noindex');
    });
  }

  test('CP1: fuera del sitemap y sin PokemonExplorer.tsx', async ({ request }) => {
    const urls = await sitemapUrls(request);
    for (const locale of LOCALES) {
      expect(urls, `/${locale}/herramientas/pokemon/ is noindex`).not.toContain(
        `${SITE}/${locale}/herramientas/pokemon/`,
      );
    }
    expect(
      existsSync(resolve(ROOT, 'src', 'components', 'tools', 'PokemonExplorer.tsx')),
      '§12.13: the explorer is deleted',
    ).toBe(false);
  });
});

// ------------------------------------------------------------------------------ §8.10 Herramientas

test.describe('§8.10: Herramientas', () => {
  /** HT1 and TI-04, TI-07, TI-10: the state words of the old index, in each locale. */
  const STATE_WORDS = /\b(?:Disponible|Próximamente|Preview|Available|Coming soon)\b/i;

  for (const locale of LOCALES) {
    const { tools } = MESSAGES[locale];
    const route = `/${locale}/herramientas/`;

    test(`HT1: ${route} tiene 2 enlaces de índice y ninguna palabra de estado`, async ({
      page,
    }) => {
      const response = await page.goto(route);
      expect(response?.status()).toBe(200);
      const column = await mainColumn(page);
      expect(column.crumbs, 'T15: one crumb').toEqual([tools.title]);
      expect(column.h1).toEqual([tools.title]);
      // 8.10 step 3: Guild and Mapa, the entries of the menu group, in its order.
      await expect(page.locator('main#contenido .ac-index-links__link')).toHaveCount(2);
      await expect(page.locator('main#contenido .ac-index-links__link').nth(0)).toHaveAttribute(
        'href',
        `/${locale}/herramientas/guild/`,
      );
      await expect(page.locator('main#contenido .ac-index-links__link').nth(1)).toHaveAttribute(
        'href',
        `/${locale}/mapa/`,
      );
      expect(column.text, 'HT1: no state word').not.toMatch(STATE_WORDS);
      // Template D (8.0.2): no description under a link.
      expect(column.paragraphs, 'template D: no paragraph').toEqual([]);
    });
  }
});

// ------------------------------------------------------------------------------ §8.7 Cambios

/** 8.7 steps 3 and 4: the months with changes, the most recent first, and their changes. */
function monthsOfChanges(): { id: string; count: number }[] {
  const months = new Map<string, number>();
  for (const cambio of CAMBIOS) {
    const id = cambio.fecha.slice(0, 7);
    months.set(id, (months.get(id) ?? 0) + 1);
  }
  return [...months.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([id, count]) => ({ id, count }));
}

/** 8.7 step 3: «Septiembre de 2026» / «September 2026». */
function monthTitle(id: string, locale: Locale): string {
  const text = new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${id}-01T00:00:00Z`));
  return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);
}

/** 8.0.3: the label of the menu group Cambios belongs to, the first crumb of the page. */
const COMMUNITY: Record<Locale, string> = { es: 'Comunidad', en: 'Community' };

test.describe('§8.7: Cambios', () => {
  const months = monthsOfChanges();

  for (const locale of LOCALES) {
    const { changes } = MESSAGES[locale];
    const route = `/${locale}/cambios/`;

    test(`CA3: ${route} es indexable y está en el menú`, async ({ page, request }) => {
      const response = await page.goto(route);
      expect(response?.status()).toBe(200);
      expect(robotsTag(await page.content()), 'CA3: no noindex').toBeNull();
      await expect(
        page.locator(`.ac-page-layout__sidebar details a[href="${route}"]`),
        'CA3: «Comunidad › Cambios» in the menu, marked as the page',
      ).toHaveAttribute('aria-current', 'page');
      expect(await sitemapUrls(request), 'A2: indexable').toContain(`${SITE}${route}`);
    });

    if (months.length === 0) {
      test(`CA2: sin cambios, ${route} es migas, h1 y una línea`, async ({ page }) => {
        await page.goto(route);
        const column = await mainColumn(page);
        expect(column.crumbs, '8.0.4: «Comunidad › Cambios»').toEqual([
          COMMUNITY[locale],
          changes.title,
        ]);
        expect(column.h1).toEqual([changes.title]);
        expect(column.paragraphs, 'CA2: exactly one <p>, the EmptyState').toEqual([changes.empty]);
        await expect(page.locator('.ac-toc__nav'), 'no Toc without months').toHaveCount(0);
        const main = await page.locator('main#contenido').boundingBox();
        expect(main?.width, '8.0.2: the column of 944 with the spacer').toBeCloseTo(944, 0);
      });
    } else {
      test(`CA1: ${route} tiene un h2 por mes, un paso por cambio y Toc con 2 meses o más`, async ({
        page,
      }) => {
        await page.goto(route);
        const sections = page.locator('main#contenido section.ac-section');
        await expect(sections).toHaveCount(months.length);
        for (const [index, month] of months.entries()) {
          const section = sections.nth(index);
          await expect(section).toHaveAttribute('id', month.id);
          await expect(section.locator('h2')).toHaveText(monthTitle(month.id, locale));
          await expect(section.locator('li.ac-timeline__step')).toHaveCount(month.count);
        }
        await expect(page.locator('.ac-toc__link')).toHaveCount(
          months.length >= 2 ? months.length : 0,
        );
        const main = await page.locator('main#contenido').boundingBox();
        expect(main?.width).toBeCloseTo(months.length >= 2 ? 896 : 944, 0);
      });
    }
  }
});

// ------------------------------------------------------------------------------ §8.9 Actividades

test.describe('§8.9: Actividades', () => {
  for (const locale of LOCALES) {
    const { activities, ui } = MESSAGES[locale];
    const index = `/${locale}/actividades/`;

    test(`8.9.1: ${index} enlaza cada actividad del registro, en su orden`, async ({ page }) => {
      const response = await page.goto(index);
      expect(response?.status()).toBe(200);
      const column = await mainColumn(page);
      expect(column.crumbs, 'T15: one crumb').toEqual([activities.title]);
      expect(column.h1).toEqual([activities.title]);
      const links = page.locator('main#contenido .ac-index-links__link');
      if (QUESTS.length === 0) {
        await expect(links).toHaveCount(0);
        expect(column.paragraphs).toEqual([activities.empty]);
        return;
      }
      await expect(links).toHaveCount(QUESTS.length);
      for (const [position, quest] of QUESTS.entries()) {
        const link = links.nth(position);
        await expect(link).toHaveAttribute('href', `/${locale}/actividades/${quest.id}/`);
        await expect(link).toHaveText(quest.nombre);
        // 8.9.1: no tooltip on an entry of the index.
        await expect(link).not.toHaveAttribute('aria-describedby', /.+/);
      }
    });

    for (const quest of QUESTS) {
      const route = `/${locale}/actividades/${quest.id}/`;

      test(`AV1, AV3 y WA4: ${route} muestra el registro`, async ({ page }) => {
        const response = await page.goto(route);
        expect(response?.status()).toBe(200);
        const column = await mainColumn(page);
        expect(column.crumbs, '8.0.4: «Actividades › {nombre}»').toEqual([
          activities.title,
          quest.nombre,
        ]);
        await expect(page.locator('nav.ac-breadcrumb a.ac-breadcrumb__link')).toHaveAttribute(
          'href',
          index,
        );
        expect(column.h1).toEqual([quest.nombre]);

        // 8.9.2 step 3: `resumen`, then `instrucciones`, each with its `lang` (T22, WA4).
        const lead = [quest.resumen, quest.instrucciones].flatMap((value) =>
          value === null ? [] : [shown(value, locale)],
        );
        const leadParagraphs = page.locator('main#contenido .ac-activity-intro > p');
        await expect(leadParagraphs).toHaveCount(lead.length);
        for (const [position, paragraph] of lead.entries()) {
          await expect(leadParagraphs.nth(position)).toHaveText(paragraph.text);
          if (paragraph.lang === null) {
            await expect(leadParagraphs.nth(position)).not.toHaveAttribute('lang', /.+/);
          } else {
            await expect(leadParagraphs.nth(position)).toHaveAttribute('lang', paragraph.lang);
          }
        }

        // 8.9.2 step 4, AV1: «Requisito: Nivel {n}» and «NPC: {npcs}», the ones with a value.
        const facts: string[] = [];
        if (quest.nivelRequerido !== null) {
          const level = fill(ui.tooltip.level, { n: figure(quest.nivelRequerido, locale) });
          facts.push(`${ui.tooltip.requirement}: ${level}`);
        }
        if (quest.npcs.length > 0) facts.push(`${activities.npc}: ${quest.npcs.join(', ')}`);
        await expect(page.locator('main#contenido .ac-info-banner__fact')).toHaveText(facts);

        // 8.9.2 step 5: a section per list with entries, in this order; «Pasos» is the <ol>.
        const sections = [
          { id: 'requisitos', title: activities.sections.requirements, list: quest.requisitos },
          { id: 'pasos', title: activities.sections.steps, list: quest.pasos },
          { id: 'recompensas', title: activities.sections.rewards, list: quest.recompensas },
          { id: 'observaciones', title: activities.sections.notes, list: quest.notas },
        ].filter((section) => section.list.length > 0);
        await expect(page.locator('main#contenido section.ac-section h2')).toHaveText(
          sections.map((section) => section.title),
        );
        for (const section of sections) {
          const tag = section.id === 'pasos' ? 'ol' : 'ul';
          const items = page.locator(`main#contenido section#${section.id} > ${tag} > li`);
          await expect(items, `${section.id}: one item per entry`).toHaveCount(section.list.length);
          for (const [position, value] of section.list.entries()) {
            const text = shown(value, locale);
            // AV3: the text of the registry alone, with no number written by hand.
            await expect(items.nth(position)).toHaveText(text.text);
            if (text.lang === null) {
              await expect(items.nth(position)).not.toHaveAttribute('lang', /.+/);
            } else {
              await expect(items.nth(position)).toHaveAttribute('lang', text.lang);
            }
          }
        }
        // 7.11: the Toc lists those sections with two or more.
        await expect(page.locator('.ac-toc__link')).toHaveCount(
          sections.length >= 2 ? sections.length : 0,
        );
      });
    }
  }
});

// ------------------------------------------------------------------------------ WL1

/**
 * WL1: the texts of the rows BORRAR of §12 that the six pages of this milestone name in their
 * «Se quita», in the form the old pages wrote them. Q-07 is measured apart: its «01»…«06»
 * were numbers, a pattern and not a text.
 */
const DELETED: { route: string; section: string; texts: string[] }[] = [
  {
    route: '/{l}/cambios/',
    section: '§12.6',
    texts: [
      'Historial de la wiki',
      'Sin entradas todavía',
      'El registro todavía no tiene entradas publicadas.',
      'Las novedades se incorporarán aquí cuando estén listas para consulta.',
    ],
  },
  {
    route: '/{l}/actividades/',
    section: '§12.9',
    texts: [
      'Misiones, recompensas y rutas disponibles en el archivo.',
      'Quest',
      'Nivel requerido',
      'Ruta de viaje',
      'Misiones',
      'Ubicaciones y viaje',
      'Guías',
      '✦',
    ],
  },
  {
    route: '/{l}/herramientas/',
    section: '§12.12',
    texts: [
      'Las herramientas forman parte del Codex.',
      'Sección del Codex',
      'Disponible',
      'Búsqueda del Codex',
      'Mapa interactivo',
      'Preview disponible',
      'Disponible en local',
      'Comparar Pokémon y tiers',
      'Ranking de guild',
      'Siguiente en la hoja de ruta',
      'Próximamente',
    ],
  },
  {
    route: '/{l}/herramientas/pokemon/',
    section: '§12.13',
    texts: [
      'Herramientas / Pokémon',
      'Comparación directa',
      'Elige dos variantes',
      'Filtrar opciones',
      'Resumen comparado',
      'Campo',
      'Nivel mostrado',
      'Displayed level',
      'Explorar por tier',
      'Explorar tiers',
      'Usar en comparar',
    ],
  },
  {
    route: '/{l}/mapa/',
    section: '§12.15',
    texts: [
      'Herramientas / Mapa',
      'Aportar al mapa',
      'Marcadores disponibles',
      'Sin etiqueta',
      'Marcador sin etiqueta',
      'Otro marcador',
      'Capas',
      'Arrastra el mapa para explorar',
      'Mapa base',
      'Mapa base no disponible',
      'Mapa interactivo',
    ],
  },
];

test.describe('WL1: los textos borrados de §12 no vuelven', () => {
  for (const { route, section, texts } of DELETED) {
    for (const locale of LOCALES) {
      const path = forLocale(route, locale);
      test(`${section}: ${path}`, async ({ page }) => {
        await page.goto(path);
        expect(await deletedTexts(page, texts), `WL1 (${section})`).toEqual([]);
      });
    }
  }

  for (const quest of QUESTS) {
    for (const locale of LOCALES) {
      const path = `/${locale}/actividades/${quest.id}/`;
      test(`§12.9: ${path}`, async ({ page }) => {
        await page.goto(path);
        const texts = DELETED.find((entry) => entry.section === '§12.9')?.texts ?? [];
        expect(await deletedTexts(page, texts), 'WL1 (§12.9)').toEqual([]);
        // Q-07: no «01»…«06» written by hand inside the steps.
        const numbers = await page
          .locator('main#contenido ol *')
          .evaluateAll((elements) =>
            elements
              .map((element) => (element.textContent ?? '').trim())
              .filter((text) => /^\d{1,2}$/.test(text)),
          );
        expect(numbers, 'Q-07').toEqual([]);
      });
    }
  }
});
