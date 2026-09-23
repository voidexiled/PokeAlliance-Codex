// Cambios (spec 8.7) on the rendered page (§14.2, Container API): CA1 to CA3, the order of 8.7
// steps 3 and 4 and the stop on an entity with no record. content/cambios.json is the owner's
// (R10) and may hold no change at all, so every case gives the page its own synthetic list
// through `getCambios`; the entities it names are the first records of the registries the build
// reads, so a case never depends on one record the owner may rename or drop.
// tests/e2e/rutas.spec.ts measures the same criteria in the browser over the registry as it is
// (CA2 while it is empty).

import { getContainerRenderer } from '@astrojs/react/container-renderer';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { loadRenderers } from 'astro:container';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import type { Locale } from '@/i18n/config';
import type { Messages } from '@/i18n/messages/en';
import { en } from '@/i18n/messages/en';
import { es } from '@/i18n/messages/es';
import { getItems, getSistemas, getSpriteRegistry } from '@/lib/content/registry';
import type * as Registry from '@/lib/content/registry';
import type { Cambio } from '@/lib/content/registry-schema';
import { getPokemon, getQuests } from '@/lib/content/repository';
import type { ContentRef } from '@/lib/content/types';
import { spriteOrNull } from '@/lib/sprites/resolve';

const state = vi.hoisted(() => ({ cambios: [] as unknown[] }));

vi.mock('@/lib/content/registry', async (importOriginal) => {
  const actual = await importOriginal<typeof Registry>();
  return { ...actual, getCambios: () => actual.sortCambios(state.cambios as Cambio[]) };
});

/**
 * What the container renders. A page types its props from `getStaticPaths`, so its factory does
 * not match the container's parameter and has to be named as a component (home-page.test.ts).
 */
type AstroComponent = Parameters<AstroContainer['renderToString']>[0];

const MESSAGES: Record<Locale, Messages> = { es, en };
const SITE = 'https://pokealliance-codex.vercel.app';

let container: AstroContainer;
let Cambios: AstroComponent;

beforeAll(async () => {
  container = await AstroContainer.create({
    renderers: await loadRenderers([getContainerRenderer()]),
    astroConfig: { site: SITE },
  });
  Cambios = (await import('@/pages/[locale]/cambios/index.astro'))
    .default as unknown as AstroComponent;
});

async function render(locale: Locale): Promise<string> {
  return container.renderToString(Cambios, {
    params: { locale },
    request: new Request(`${SITE}/${locale}/cambios/`),
  });
}

/** `main#contenido` without the footer PageLayout puts inside it (CA2). */
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

/** A name as the page writes it, as a pattern. */
function written(name: string): string {
  return name
    .replace(/&/g, '&amp;')
    .replace(/'/g, '&#39;')
    .replace(/"/g, '&quot;')
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Every `<p>` of a fragment, never an SVG `<path>`. */
const PARAGRAPH = /<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/g;

function change(id: string, fecha: string, extra: Partial<Cambio> = {}): Cambio {
  return { id, fecha, titulo: { es: `Cambio ${id}`, en: `Change ${id}` }, ...extra };
}

describe('Cambios (8.7)', () => {
  it('CA1: three changes in two months give two h2, newest first, three steps and a Toc', async () => {
    const pokemon = getPokemon()[0];
    const item = getItems()[0];
    const system = getSistemas()[0];
    const quest = getQuests()[0];
    const entidades: ContentRef[] = [
      ...(pokemon ? [{ tipo: 'pokemon' as const, id: pokemon.id }] : []),
      ...(item ? [{ tipo: 'item' as const, id: item.id }] : []),
      ...(system ? [{ tipo: 'sistema' as const, id: system.id }] : []),
      ...(quest ? [{ tipo: 'actividad' as const, id: quest.id }] : []),
    ];
    state.cambios = [
      change('a', '2026-08-30'),
      change('c', '2026-09-18', { puntos: { es: ['Uno', 'Dos'], en: ['One', 'Two'] }, entidades }),
      change('b', '2026-09-18'),
    ];
    const html = await render('es');
    const main = column(html);

    expect(texts(main, /<h2[^>]*>([\s\S]*?)<\/h2>/g)).toEqual([
      'Septiembre de 2026',
      'Agosto de 2026',
    ]);
    expect(main).toMatch(/<section id="2026-09"[^>]*aria-labelledby="2026-09-t"/);
    expect(main.match(/class="ac-timeline__step/g)).toHaveLength(3);
    // The same day: by id.
    expect(texts(main, /<p class="ac-timeline__text">([\s\S]*?)<\/p>/g)).toEqual([
      'Cambio b',
      'Cambio c',
      'Cambio a',
    ]);
    expect(texts(main, /<p class="ac-timeline__label">([\s\S]*?)<\/p>/g)).toEqual([
      '18/09/2026:',
      '18/09/2026:',
      '30/08/2026:',
    ]);
    // The rail is the Toc of the two months, with their titles and ids (7.11).
    const rail = /<div class="ac-page-layout__rail">([\s\S]*?)<\/aside>/.exec(html)?.[1] ?? '';
    expect(texts(rail, /<a class="ac-toc__link" href="#[^"]+"[^>]*>([\s\S]*?)<\/a>/g)).toEqual([
      'Septiembre de 2026',
      'Agosto de 2026',
    ]);
    expect(rail).toContain('href="#2026-09"');
    expect(rail).toContain('href="#2026-08"');

    // The points under the text, and one chip per entity with the name of its record: a
    // Pokémon and a system link their page when they open a panel, an item has no page (§15)
    // and an activity is text (R2).
    expect(main).toContain('<ul><li>Uno</li><li>Dos</li></ul>');
    if (pokemon) {
      expect(main).toMatch(
        new RegExp(
          `(<a href="/es/pokedex/${pokemon.id}/"[^>]*>|<span class="ac-chip">)${written(pokemon.nombre)}<`,
        ),
      );
    }
    if (item) {
      expect(main).toMatch(
        new RegExp(`(<button type="button"[^>]*>|<span class="ac-chip">)${written(item.nombre)}<`),
      );
    }
    if (system) {
      expect(main).toMatch(
        new RegExp(
          `(<a href="/es/sistemas/${system.id}/"[^>]*>|<span class="ac-chip">)${written(system.titulo.es)}<`,
        ),
      );
    }
    if (quest) {
      expect(main).toMatch(new RegExp(`<span class="ac-chip">${written(quest.nombre)}</span>`));
    }

    // The node of a change without a sprite is the fixed key `ui/cambios` (3.13), or the
    // missing mark while the sprite registry lacks it.
    const fixed = spriteOrNull(getSpriteRegistry(), 'ui/cambios');
    if (fixed === null) expect(main).toContain('ac-missing-sprite');
    else expect(main).toContain(`src="${fixed.src}"`);
  });

  it('CA1: one month has no Toc and keeps the spacer (944)', async () => {
    state.cambios = [change('a', '2026-09-01'), change('b', '2026-09-30')];
    const html = await render('en');
    expect(html).not.toContain('ac-page-layout__rail');
    expect(html).toContain('class="ac-page-layout__spacer"');
    expect(texts(column(html), /<h2[^>]*>([\s\S]*?)<\/h2>/g)).toEqual(['September 2026']);
    expect(texts(column(html), /<p class="ac-timeline__label">([\s\S]*?)<\/p>/g)).toEqual([
      'Sep 30, 2026:',
      'Sep 1, 2026:',
    ]);
  });

  it.each<Locale>(['es', 'en'])(
    'CA2 %s: without changes, crumbs, h1 and exactly one <p> with the empty line',
    async (locale) => {
      state.cambios = [];
      const html = await render(locale);
      const main = column(html);
      expect(main).toContain('class="ac-breadcrumb"');
      expect(main.match(/<h1[\s>]/g)).toHaveLength(1);
      expect(main.match(/<p[\s>]/g)).toHaveLength(1);
      expect(texts(main, PARAGRAPH)).toEqual([MESSAGES[locale].changes.empty]);
      expect(main).not.toContain('<h2');
      expect(html).not.toContain('ac-toc');
    },
  );

  it('CA3 and 8.0.4: indexable, marked in the menu, «Comunidad › Cambios» with a text crumb', async () => {
    state.cambios = [];
    const html = await render('es');
    expect(html).not.toMatch(/<meta name="robots"/);
    expect(html).toMatch(/<a[^>]*href="\/es\/cambios\/"[^>]*aria-current="page"/);
    const crumbs = /<nav class="ac-breadcrumb"[\s\S]*?<\/nav>/.exec(html)?.[0] ?? '';
    expect(texts(crumbs, /<li class="ac-breadcrumb__item">([\s\S]*?)<\/li>/g)).toEqual([
      'Comunidad',
      'Cambios',
    ]);
    expect(crumbs).not.toContain('<a ');
    expect(html).toContain('<title>Cambios · Alliance Codex</title>');
    expect(html).toContain(`<meta name="description" content="${es.changes.description}">`);
  });

  it('stops the build on an entity with no record (8.7 «Estados»)', async () => {
    state.cambios = [change('x', '2026-09-01', { entidades: [{ tipo: 'item', id: 'no-existe' }] })];
    await expect(render('es')).rejects.toThrow(/item:no-existe/);
  });
});
