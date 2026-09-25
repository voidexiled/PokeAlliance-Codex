// PZ-06 and WD1 (§12.21, §8.0.7) as a unit test: every figure the Inicio prints, and the counts
// the Pokédex bar prints by Variante, are the ones the registries give; and «Destacados» shows
// the entries of the pinned group of the menu (8.1 step 3). The page is rendered
// whole with the Astro container (§14.2), in both locales, over the `content/` the build reads;
// each expectation is computed here from the registries and never copied from a board (X4,
// S19), so a change of a record changes the figure this file expects. tests/e2e/home.spec.ts
// and tests/e2e/pokedex.spec.ts check the same figures in the browser.
//
//  - «{n} variantes» of HomeIntro (8.1 step 1, X12): `n` is `getPokemon().length`, formatted
//    for the locale, and `{lista}` names the collections that have a published record.
//  - «N páginas» / «N elementos» of each IndexPanel (8.1 step 4, PZ-04): the figure is the
//    number of links the panel draws, which is the size of its registry — one per system page,
//    «Todo» plus the 13 Market categories, one per activity whose page the build writes and the
//    18 elements — followed by the word of the dictionary for that figure.
//  - «{a} normales» and «{b} Shiny» of the Pokédex (8.2 step 4): the totals of the `pokedex`
//    list filtered by Variante, which are the variants of the registry of each kind. The bar
//    writes them after hydration, from the URL, so the words around each figure are
//    tests/e2e/pokedex.spec.ts's; here, the figures the list computes.

import { getContainerRenderer } from '@astrojs/react/container-renderer';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { loadRenderers } from 'astro:container';
import { beforeAll, describe, expect, it } from 'vitest';

import { decodePokedex, pokedexConfig } from '@/components/pokedex/config';
import type { Locale } from '@/i18n/config';
import type { Messages } from '@/i18n/messages/en';
import { en } from '@/i18n/messages/en';
import { es } from '@/i18n/messages/es';
import { fill, isPluralMessage, plural, type MessageLeaf } from '@/i18n/messages/types';
import {
  getCategorias,
  getElementos,
  getItems,
  getMundos,
  getSistemas,
} from '@/lib/content/registry';
import { getPokemon, getQuests } from '@/lib/content/repository';
import { formatInteger } from '@/lib/format/numbers';
import { applyListState, parseListState } from '@/lib/lists/state';
import { buildFeatured } from '@/lib/nav/groups';
import HomePage from '@/pages/[locale]/index.astro';
import { buildPokedexData, pokedexIds } from '../../src/pages/[locale]/pokedex/datos.json';
import { esRutaDelSitio } from '../../scripts/lib/rutas-migradas.mjs';

const MESSAGES: Record<Locale, Messages> = { es, en };
const LOCALES: Locale[] = ['es', 'en'];

/**
 * What the container renders. A page types its props from `getStaticPaths`, and the Inicio's
 * give it params alone, so its factory takes `never` and has to be named as a component.
 */
type AstroComponent = Parameters<AstroContainer['renderToString']>[0];

let container: AstroContainer;
const pages = new Map<Locale, string>();

beforeAll(async () => {
  container = await AstroContainer.create({
    renderers: await loadRenderers([getContainerRenderer()]),
    astroConfig: { site: 'https://pokealliancewiki.com' },
  });
  for (const locale of LOCALES) {
    pages.set(
      locale,
      await container.renderToString(HomePage as unknown as AstroComponent, {
        params: { locale },
        request: new Request(`https://pokealliancewiki.com/${locale}/`),
      }),
    );
  }
});

function page(locale: Locale): string {
  const html = pages.get(locale);
  if (html === undefined) throw new Error(`/${locale}/ was not rendered`);
  return html;
}

/** Text of an HTML fragment: tags out, the entities the renderer writes decoded. */
function text(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .trim();
}

/** The markup of the bento panel whose heading has this id, or null when it is not drawn. */
function panel(html: string, id: string): string | null {
  const start = html.indexOf(`aria-labelledby="${id}"`);
  if (start < 0) return null;
  const end = html.indexOf('</section>', start);
  return html.slice(start, end);
}

/** The figure and the hidden word of a panel's count. */
function countOf(markup: string): { figure: string; word: string } {
  const match = /class="ac-index-panel__count">([^<]*)<span class="sr-only">([^<]*)<\/span>/.exec(
    markup,
  );
  if (match === null) throw new Error('the panel has no count');
  return { figure: match[1] ?? '', word: match[2] ?? '' };
}

/** The word a plural or plain dictionary leaf gives for `n`, as the panel writes it. */
function word(leaf: MessageLeaf, n: number, locale: Locale): string {
  return ` ${(isPluralMessage(leaf) ? plural(locale, n, leaf) : leaf).trim()}`;
}

/** 8.9.2, WG5: the activities whose page the build writes (none until M11). */
function activities(locale: Locale) {
  return getQuests().filter((quest) => esRutaDelSitio(`/${locale}/actividades/${quest.id}/`));
}

describe('PZ-06: the line of HomeIntro (8.1 step 1, X12)', () => {
  it.each(LOCALES)('%s: «{n} variantes» is the registry, with its published collections', (l) => {
    const home = MESSAGES[l].home;
    const collections = [
      getItems().length > 0 ? home.collections.items : null,
      getSistemas().length > 0 ? home.collections.systems : null,
      activities(l).length > 0 ? home.collections.activities : null,
    ].filter((entry): entry is string => entry !== null);
    const last = collections.at(-1) ?? '';
    const list =
      collections.length < 2 ? last : `${collections.slice(0, -1).join(', ')} ${home.and} ${last}`;
    const n = formatInteger(getPokemon().length, l);
    const expected =
      collections.length > 0 ? fill(home.intro, { n, list }) : fill(home.introBare, { n });

    const line = /<p class="ac-home-intro__description">([\s\S]*?)<\/p>/.exec(page(l))?.[1];
    expect(text(line ?? '')).toBe(expected);
    expect(page(l)).toMatch(new RegExp(`<h1[^>]*class="ac-home-intro__title"[^>]*>${home.title}<`));
  });
});

describe('WD1: each count of the bento is the links its panel draws (8.1 step 4, PZ-04)', () => {
  it.each(LOCALES)('%s: Sistemas, Ítems, Actividades and Pokédex', (l) => {
    const home = MESSAGES[l].home;
    const expected: [string, number, MessageLeaf][] = [
      ['inicio-sistemas', getSistemas().length, home.pageCount],
      ['inicio-items', getCategorias().length, home.pageCount],
      ['inicio-actividades', activities(l).length, home.pageCount],
      ['inicio-pokedex', getElementos().length, home.elementCount],
    ];
    for (const [id, n, leaf] of expected) {
      const markup = panel(page(l), id);
      if (n === 0) {
        // A panel with no link is not drawn, nor is its heading (8.1 step 4, IN3).
        expect(markup, `${id} is not drawn`).toBeNull();
        expect(page(l)).not.toContain(`id="${id}"`);
        continue;
      }
      expect(markup, `${id} is drawn`).not.toBeNull();
      const links = (markup ?? '').match(/<a\b[^>]*class="[^"]*ac-index-panel__link/g) ?? [];
      expect(links, `${id}: one link per record`).toHaveLength(n);
      expect(countOf(markup ?? ''), id).toEqual({
        figure: formatInteger(n, l),
        word: word(leaf, n, l),
      });
    }
    // «Todo», the 13 categories of the Market, the 4 of the site and «Otros», which the schema
    // fixes (8.5).
    expect(getCategorias()).toHaveLength(19);
    expect(getElementos()).toHaveLength(18);
  });

  it.each(LOCALES)('%s: the worlds, names only, in numeric order (X3, PZ-05)', (l) => {
    const worlds = getMundos(l).map((world) => world.nombre);
    const rows = [...page(l).matchAll(/<td class="ac-worlds-table__name">([^<]*)<\/td>/g)].map(
      (match) => match[1],
    );
    expect(rows).toEqual(worlds);
    const collator = new Intl.Collator(l, { numeric: true });
    expect(rows).toEqual([...rows].sort((a, b) => collator.compare(a ?? '', b ?? '')));
  });
});

describe('8.1 step 3: «Destacados» shows the entries of the pinned group of the menu', () => {
  it.each(LOCALES)('%s: the same links, in the same order, in the section and in the menu', (l) => {
    const html = page(l);
    const cards = [...html.matchAll(/<a class="ac-featured-card" href="([^"]+)"/g)].map(
      (match) => match[1],
    );
    expect(cards).toEqual(buildFeatured(l).map((link) => link.href));

    // Each sidebar of the page (the column and the phone sheet) names its pinned group by the
    // id of its heading.
    const lists = [
      ...html.matchAll(
        /<ul class="ac-sidebar__list" aria-labelledby="[^"]*-destacados-t">(.*?)<\/ul>/gs,
      ),
    ];
    expect(lists.length, 'the pinned group is drawn').toBe(cards.length > 0 ? 2 : 0);
    for (const [, list] of lists) {
      const links = [...(list ?? '').matchAll(/<a class="ac-sidebar__link" href="([^"]+)"/g)].map(
        (match) => match[1],
      );
      expect(links).toEqual(cards);
    }
  });
});

describe('PZ-06: «{a} normales» and «{b} Shiny» of the Pokédex bar (8.2 step 4)', () => {
  it.each(LOCALES)('%s: the totals of each Variante are the registry’s', (l) => {
    const data = buildPokedexData(l);
    const rows = decodePokedex(data);
    const sortLabels = { numero: '', nombre: '', tier: '', requisito: '' };
    const config = pokedexConfig(
      `/${l}/pokedex/datos.json`,
      pokedexIds(rows, data.refs.elementos),
      l,
      sortLabels,
    );
    const cases: [string, number][] = [
      ['', getPokemon().length],
      ['?variante=normal', getPokemon().filter((record) => record.variante === 'normal').length],
      ['?variante=shiny', getPokemon().filter((record) => record.variante === 'shiny').length],
    ];
    for (const [search, n] of cases) {
      const total = applyListState(config, rows, parseListState(config, search)).total;
      expect(total, search || 'no filter').toBe(n);
    }
    // The two kinds cover the registry: nothing is counted twice or left out.
    const normal = getPokemon().filter((record) => record.variante === 'normal').length;
    const shiny = getPokemon().filter((record) => record.variante === 'shiny').length;
    expect(normal + shiny).toBe(getPokemon().length);
  });
});
