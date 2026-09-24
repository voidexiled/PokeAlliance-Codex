// Herramientas (spec 8.10) and the two placeholders of template E, Mapa (8.11) and Comparar
// Pokémon until F5 (8.14), on the rendered page (§14.2, Container API), in both locales: HT1,
// MP1, MP3 and CP1 plus their crumbs (8.0.4). Nothing here reads a registry: the three pages
// show the menu's entries and the dictionaries' lines. tests/e2e/rutas.spec.ts measures the same
// criteria in the browser, over the deployed output with its sitemap.

import { getContainerRenderer } from '@astrojs/react/container-renderer';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { loadRenderers } from 'astro:container';
import { beforeAll, describe, expect, it } from 'vitest';

import type { Locale } from '@/i18n/config';
import type { Messages } from '@/i18n/messages/en';
import { en } from '@/i18n/messages/en';
import { es } from '@/i18n/messages/es';

/**
 * What the container renders. A page types its props from `getStaticPaths`, so its factory does
 * not match the container's parameter and has to be named as a component (home-page.test.ts).
 */
type AstroComponent = Parameters<AstroContainer['renderToString']>[0];

const MESSAGES: Record<Locale, Messages> = { es, en };
const SITE = 'https://pokealliancewiki.com';

let container: AstroContainer;
let Herramientas: AstroComponent;
let Mapa: AstroComponent;
let Comparar: AstroComponent;

beforeAll(async () => {
  container = await AstroContainer.create({
    renderers: await loadRenderers([getContainerRenderer()]),
    astroConfig: { site: SITE },
  });
  Herramientas = (await import('@/pages/[locale]/herramientas/index.astro'))
    .default as unknown as AstroComponent;
  Mapa = (await import('@/pages/[locale]/mapa/index.astro')).default as unknown as AstroComponent;
  Comparar = (await import('@/pages/[locale]/herramientas/pokemon.astro'))
    .default as unknown as AstroComponent;
});

async function render(page: AstroComponent, locale: Locale, route: string): Promise<string> {
  return container.renderToString(page, {
    params: { locale },
    request: new Request(`${SITE}/${locale}${route}`),
  });
}

/** `main#contenido` without the footer PageLayout puts inside it (MP1, CP1). */
function column(html: string): string {
  const main = /<main id="contenido"[^>]*>([\s\S]*)<\/main>/.exec(html)?.[1] ?? '';
  const foot = main.indexOf('<div class="ac-page-layout__foot">');
  return foot < 0 ? main : main.slice(0, foot);
}

/** The text of each match: tags out, the entities the renderer writes decoded. */
function texts(html: string, pattern: RegExp): string[] {
  return [...html.matchAll(pattern)].map((match) =>
    (match[1] ?? '')
      .replace(/<[^>]+>/g, '')
      .replace(/&#39;|&#x27;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .trim(),
  );
}

/** Every `<p>` of a fragment, never an SVG `<path>`. */
const PARAGRAPH = /<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/g;

/** The items of the crumbs (8.0.4). */
function crumbsOf(html: string): { items: string[]; markup: string } {
  const markup = /<nav class="ac-breadcrumb"[\s\S]*?<\/nav>/.exec(html)?.[0] ?? '';
  return { items: texts(markup, /<li class="ac-breadcrumb__item">([\s\S]*?)<\/li>/g), markup };
}

describe('Herramientas (8.10)', () => {
  it.each<Locale>(['es', 'en'])('HT1 %s: exactly the two links of the group', async (locale) => {
    const html = await render(Herramientas, locale, '/herramientas/');
    const main = column(html);
    const links = [...main.matchAll(/<a href="([^"]+)" class="ac-index-links__link">/g)].map(
      (match) => match[1],
    );
    expect(links).toEqual([`/${locale}/herramientas/guild/`, `/${locale}/mapa/`]);
    expect(texts(main, /<span class="ac-index-links__label">([\s\S]*?)<\/span>/g)).toEqual(
      locale === 'es' ? ['Guild', 'Mapa'] : ['Guild', 'Map'],
    );
    expect(main).not.toMatch(/Disponible|Próximamente|Preview|Available|Coming soon/);
    expect(main.match(/<h1[\s>]/g)).toHaveLength(1);
    // T15: the index of a group has a single crumb, the current one.
    expect(crumbsOf(html).items).toEqual([MESSAGES[locale].tools.title]);
    expect(html).not.toMatch(/<meta name="robots"/);
  });
});

describe('placeholders of template E (8.11, 8.14)', () => {
  const cases = [
    { name: 'Mapa', route: '/mapa/', key: 'map' as const },
    { name: 'Comparar', route: '/herramientas/pokemon/', key: 'compare' as const },
  ];

  for (const { name, route, key } of cases) {
    it.each<Locale>(['es', 'en'])(
      `${name} %s: crumbs, h1 and one <p>, with no canvas, image, button or island, noindex`,
      async (locale) => {
        const page = name === 'Mapa' ? Mapa : Comparar;
        const dictionary = MESSAGES[locale];
        const html = await render(page, locale, route);
        const main = column(html);
        expect(main).toContain('class="ac-breadcrumb"');
        expect(main.match(/<h1[\s>]/g)).toHaveLength(1);
        expect(texts(main, /<h1[^>]*>([\s\S]*?)<\/h1>/g)).toEqual([dictionary[key].title]);
        expect(texts(main, PARAGRAPH)).toEqual([dictionary[key].empty]);
        expect(main).not.toMatch(/<canvas|<img|<button|astro-island/);
        expect(html).toContain('<meta name="robots" content="noindex">');
      },
    );
  }

  it('Mapa: «Herramientas › Mapa» with the group crumb on its index', async () => {
    const html = await render(Mapa, 'es', '/mapa/');
    expect(crumbsOf(html).items).toEqual([es.tools.title, es.map.title]);
    expect(html).toMatch(
      /<a class="ac-breadcrumb__link" href="\/es\/herramientas\/">Herramientas<\/a>/,
    );
    expect(html).toContain('<title>Mapa · PokeAlliance Wiki</title>');
    expect(html).toMatch(/<a[^>]*href="\/es\/mapa\/"[^>]*aria-current="page"/);
  });

  it('Comparar: «Pokémon › Compare Pokémon» with a text group crumb', async () => {
    const html = await render(Comparar, 'en', '/herramientas/pokemon/');
    const crumbs = crumbsOf(html);
    expect(crumbs.items).toEqual(['Pokémon', en.compare.title]);
    expect(crumbs.markup).not.toContain('<a ');
    expect(html).toContain(`<title>${en.compare.title} · PokeAlliance Wiki</title>`);
    expect(html).toMatch(/<a[^>]*href="\/en\/herramientas\/pokemon\/"[^>]*aria-current="page"/);
  });
});
