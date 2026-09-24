import { getContainerRenderer } from '@astrojs/react/container-renderer';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { loadRenderers } from 'astro:container';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeAll, describe, expect, it } from 'vitest';

import type { SpriteProps } from '@/components/game/Sprite';
import { FeaturedCard, featuredScale } from '@/components/home/FeaturedCard';
import { FeaturedSection, type FeaturedEntry } from '@/components/home/FeaturedSection';
import HomeIntro from '@/components/home/HomeIntro.astro';
import IndexPanel, { type IndexPanelLink } from '@/components/home/IndexPanel.astro';
import { WorldsTable, sortWorlds, type World } from '@/components/home/WorldsTable';
import { getCategorias, getElementos, getSistemas } from '@/lib/content/registry';
import type { TipData } from '@/lib/game/tips';

// The home pieces of spec 7.2.7 and 8.1 (M10, track D): HomeIntro, FeaturedCard,
// FeaturedSection, IndexPanel and WorldsTable, on their rendered markup (§14.2). Their `ac-*`
// classes against the reference are tests/components/home-classes.test.tsx (C7-02).
//
// - PZ-04, WD1: the count of a panel is the number of links it draws, grouped and followed by
//   the word for the screen reader, and a panel with no link is not drawn (WG5). The counts of
//   the home are the sizes of the registries the panels list (8.1 step 4).
// - PZ-05, X3: the worlds table has the «Mundo» column alone, no sort button and no focusable
//   element, and orders the names numerically.
// - DS:guias/20 and S7: a sprite of «Destacados» is drawn at the largest integer scale within
//   32, and the sprite of HomeIntro within 48, never above 3x.
// - DP1: no component carries a Spanish default into the `en` markup.

let container: AstroContainer;

beforeAll(async () => {
  container = await AstroContainer.create({
    renderers: await loadRenderers([getContainerRenderer()]),
  });
});

const sprite = (size: [number, number], extra: Partial<SpriteProps> = {}): SpriteProps => ({
  src: `/sprites/prueba-${size[0]}x${size[1]}.png`,
  size,
  ...extra,
});

const tip: TipData = {
  key: 'sistema:boost',
  title: 'Boost',
  width: 282,
  head: { type: 'sprite', sprite: null },
  rows: [{ label: 'Uso', value: 'Prueba' }],
};

const link = (id: string, extra: Partial<IndexPanelLink> = {}): IndexPanelLink => ({
  id,
  label: `Enlace ${id}`,
  href: `/es/sistemas/${id}/`,
  icon: null,
  ...extra,
});

function panel(props: Record<string, unknown>): Promise<string> {
  return container.renderToString(IndexPanel, {
    props: {
      id: 'indice-prueba',
      title: 'Sistemas',
      sprite: null,
      countLabel: 'páginas',
      locale: 'es',
      hint: 'Mantén Shift para fijar',
      links: [],
      ...props,
    },
  });
}

/** The text of the count: the figure and the hidden word. */
function countOf(html: string): { figure: string; word: string } | null {
  const match = /class="ac-index-panel__count">([^<]*)<span class="sr-only">([^<]*)<\/span>/.exec(
    html,
  );
  return match ? { figure: match[1], word: match[2] } : null;
}

/** Every `<a>` of a markup, in document order. */
function anchors(html: string): string[] {
  return [...html.matchAll(/<a\b[^>]*>/g)].map((match) => match[0]);
}

describe('IndexPanel (7.2.7, 8.1, PZ-04, WD1)', () => {
  it('draws nothing without links (WG5)', async () => {
    expect((await panel({ links: [] })).trim()).toBe('');
  });

  it('counts the links it draws, grouped, with the hidden word', async () => {
    const links = Array.from({ length: 14 }, (_, index) => link(`s${index}`));
    const html = await panel({ links });

    expect(countOf(html)).toEqual({ figure: '14', word: ' páginas' });
    expect(anchors(html)).toHaveLength(14);
    expect((html.match(/class="ac-index-panel__item"/g) ?? []).length).toBe(14);

    const many = await panel({
      links: Array.from({ length: 1200 }, (_, index) => link(`m${index}`)),
      locale: 'en',
      countLabel: ' pages',
    });
    expect(countOf(many)).toEqual({ figure: '1,200', word: ' pages' });
  });

  it('takes the plural form of a plural entry for the same count', async () => {
    const entry = { one: 'página', other: 'páginas' };
    expect(countOf(await panel({ links: [link('uno')], countLabel: entry }))?.word).toBe(' página');
    expect(
      countOf(await panel({ links: [link('uno'), link('dos')], countLabel: entry }))?.word,
    ).toBe(' páginas');
  });

  it('names the section with its heading and marks its bento cell', async () => {
    const html = await panel({ links: [link('boost')], area: 'sistemas', level: 3 });

    expect(html).toMatch(/<section class="ac-index-panel" aria-labelledby="indice-prueba"/);
    expect(html).toContain('data-area="sistemas"');
    expect(html).toMatch(/<h3 id="indice-prueba" class="ac-index-panel__title">Sistemas<\/h3>/);
    expect(html).not.toMatch(/style="[^"]*grid-(row|column|area)/);
  });

  it('keeps two link columns per spanned column in a class, never an inline span', async () => {
    const html = await panel({ links: [link('fire')], span: 2 });

    expect(html).toContain('class="ac-index-panel ac-index-panel--span-2"');
    expect(await panel({ links: [link('fire')] })).not.toContain('ac-index-panel--span');
  });

  it('opens the panel of a link with tooltip rows, and only of that one (R2)', async () => {
    const html = await panel({
      links: [
        link('boost', { tip }),
        link('helds', { tip: { ...tip, key: 'sistema:helds', rows: [] } }),
        link('prey'),
      ],
    });

    const describedBy = [...html.matchAll(/aria-describedby="([^"]+)"/g)].map((m) => m[1]);
    expect(describedBy).toHaveLength(1);
    expect(html).toContain(`id="${describedBy[0]}"`);
    expect(html).toMatch(/role="tooltip"/);
    expect(html).toContain('data-ac-tt-placement="up"');
    expect(html).toContain('data-ac-tt-align="start"');
    expect(anchors(html)).toHaveLength(3);
    // The body of the trigger is the icon cell and the label, with nothing Astro adds between.
    expect(html).not.toContain('astro-static-slot');
    expect(html).not.toContain('astro-slot');
  });

  it('asks for the strip of the panels as soon as one link opens a panel', async () => {
    await expect(panel({ links: [link('boost', { tip })], hint: undefined })).rejects.toThrow(
      /hint/,
    );
  });

  it('keeps the cell of 32 without a sprite, a pixel sprite in its cell, an icon at 24', async () => {
    const html = await panel({
      links: [
        link('vacio'),
        link('pixel', { icon: sprite([22, 30]) }),
        link('icono', { icon: sprite([100, 100], { smooth: true }) }),
      ],
    });

    expect(html).toMatch(/<span class="ac-index-panel__icon" aria-hidden="true"><\/span>/);
    expect(html).toMatch(/class="ac-sprite-cell"[^>]*style="width:32px;height:32px"/);
    expect(html).toMatch(/class="ac-sprite ac-sprite--smooth"[^>]*width="24" height="24"/);
  });

  it('marks a label that exists only in the other language (WA4)', async () => {
    const html = await panel({ links: [link('quest', { labelLang: 'en' })] });

    expect(html).toMatch(/<span class="ac-index-panel__label" lang="en">Enlace quest<\/span>/);
  });

  it('counts the registries the home lists (WD1): systems, 14 Market pages, 18 elements', async () => {
    const systems = getSistemas().map((record) => link(record.id));
    const categories = getCategorias().map((record) => link(record.id));
    const elements = getElementos().map((record) => link(record.id));

    expect(countOf(await panel({ links: systems }))?.figure ?? '').toBe(
      systems.length === 0 ? '' : String(systems.length),
    );
    expect(countOf(await panel({ links: categories }))?.figure).toBe('14');
    expect(countOf(await panel({ links: elements }))?.figure).toBe('18');
  });
});

describe('FeaturedCard and FeaturedSection (7.2.7, 8.1 step 3)', () => {
  const items: FeaturedEntry[] = [
    { label: 'Pokédex', href: '/es/pokedex/', sprite: sprite([16, 16]) },
    { label: 'Tier list', href: '/es/pokedex/tiers/', sprite: sprite([15, 15]) },
    { label: 'Comercio', href: '/es/comercio/', sprite: null },
  ];

  it('draws nothing without entries (8.1 «Estados»)', () => {
    expect(renderToStaticMarkup(<FeaturedSection title="Destacados" items={[]} />)).toBe('');
  });

  it('draws one card per entry, in order, under the h2 that names the section', () => {
    const html = renderToStaticMarkup(
      <FeaturedSection title="Destacados" id="destacados" items={items} />,
    );

    expect(html).toContain('<section id="destacados" class="ac-featured-section"');
    expect(html).toContain('aria-labelledby="destacados-t"');
    expect(html).toContain('<h2 id="destacados-t" class="ac-featured-section__title">');
    expect((html.match(/class="ac-featured-section__item"/g) ?? []).length).toBe(3);
    expect(anchors(html).map((a) => /href="([^"]+)"/.exec(a)?.[1])).toEqual([
      '/es/pokedex/',
      '/es/pokedex/tiers/',
      '/es/comercio/',
    ]);
  });

  it('draws the sprite up to 32 at integer scale (DS:guias/20)', () => {
    expect(featuredScale([16, 16])).toBe(2);
    expect(featuredScale([15, 15])).toBe(2);
    expect(featuredScale([20, 26])).toBe(1);
    expect(featuredScale([32, 32])).toBe(1);
    expect(featuredScale([8, 10])).toBe(3);
    // S7: 1x, 2x or 3x, even when a smaller sprite would fit a larger scale.
    expect(featuredScale([8, 8])).toBe(3);
    expect(featuredScale([4, 6])).toBe(3);
    expect(() => featuredScale([64, 64])).toThrow(/Destacados/);

    const html = renderToStaticMarkup(
      <FeaturedCard label="Tier list" href="/es/pokedex/tiers/" sprite={sprite([15, 15])} />,
    );
    expect(html).toMatch(/width="30" height="30"/);
  });

  it('bounces the wrapper of the sprite, never the image, and keeps the box without one', () => {
    const withSprite = renderToStaticMarkup(
      <FeaturedCard label="Pokédex" href="/es/pokedex/" sprite={sprite([16, 16])} />,
    );
    const without = renderToStaticMarkup(
      <FeaturedCard label="Comercio" href="/es/comercio/" sprite={null} />,
    );

    expect(withSprite).toContain('<span class="ac-featured-card__bounce ac-bounce">');
    expect(withSprite).not.toMatch(/<img[^>]*ac-bounce/);
    expect(without).toContain('<span class="ac-featured-card__sprite" aria-hidden="true"></span>');
    expect(without).not.toContain('ac-bounce');
  });

  it('fits an illustration to 32', () => {
    const html = renderToStaticMarkup(
      <FeaturedCard
        label="Pokédex"
        href="/es/pokedex/"
        sprite={sprite([140, 100], { smooth: true })}
      />,
    );

    expect(html).toMatch(/width="32" height="23"/);
  });

  it('ends each card with the arrow glyph and no description', () => {
    const html = renderToStaticMarkup(
      <FeaturedCard label="Pokédex" href="/es/pokedex/" sprite={null} />,
    );

    expect(html).toMatch(/<svg[^>]*class="lucide ac-featured-card__arrow"/);
    expect(html).toMatch(/<span class="ac-featured-card__label">Pokédex<\/span><svg/);
  });
});

describe('HomeIntro (7.2.7, 8.1 step 1, DS:HomeIntro)', () => {
  const intro = (image: SpriteProps | null) =>
    container.renderToString(HomeIntro, {
      props: { title: 'Bienvenido a PokeAlliance Wiki', description: 'Línea', sprite: image },
    });

  /** The drawn size of the sprite: its `width` and `height` attributes. */
  const drawn = (html: string) => {
    const match = /<img[^>]*width="(\d+)" height="(\d+)"/.exec(html);
    return match ? [Number(match[1]), Number(match[2])] : null;
  };

  it('draws a pixel sprite at the largest integer scale within 48, never above 3x (S7)', async () => {
    expect(drawn(await intro(sprite([16, 16])))).toEqual([48, 48]);
    expect(drawn(await intro(sprite([15, 15])))).toEqual([45, 45]);
    expect(drawn(await intro(sprite([20, 26])))).toEqual([20, 26]);
    // 48 / 12 is 4 and 48 / 8 is 6: S7 stops both at 3x.
    expect(drawn(await intro(sprite([12, 12])))).toEqual([36, 36]);
    expect(drawn(await intro(sprite([8, 10])))).toEqual([24, 30]);
    await expect(intro(sprite([49, 49]))).rejects.toThrow(/HomeIntro/);
  });

  it('fits an illustration to 48 and keeps the empty box without a sprite', async () => {
    expect(drawn(await intro(sprite([140, 100], { smooth: true })))).toEqual([48, 34]);
    const html = await intro(null);
    expect(html).toContain('<span class="ac-home-intro__sprite" aria-hidden="true"></span>');
    expect(html).toContain('<h1 class="ac-home-intro__title">Bienvenido a PokeAlliance Wiki</h1>');
  });
});

describe('WorldsTable (7.2.7, X3, PZ-05)', () => {
  const worlds: World[] = [
    { id: 'titan-10', name: 'Titan 10' },
    { id: 'titan-2', name: 'Titan 2' },
    { id: 'sun', name: 'Sun' },
    { id: 'titan-1', name: 'Titan 1' },
    { id: 'moon', name: 'Moon' },
    { id: 'titan-3', name: 'Titan 3' },
  ];

  const render = (list: World[], locale: 'es' | 'en' = 'es') =>
    renderToStaticMarkup(
      <WorldsTable
        worlds={list}
        title={locale === 'es' ? 'Mundos' : 'Worlds'}
        labels={{ world: locale === 'es' ? 'Mundo' : 'World' }}
        locale={locale}
        area="mundos"
      />,
    );

  it('orders the names numerically in both languages (§3.13)', () => {
    const order = ['Moon', 'Sun', 'Titan 1', 'Titan 2', 'Titan 3', 'Titan 10'];
    expect(sortWorlds(worlds, 'es').map((world) => world.name)).toEqual(order);
    expect(sortWorlds(worlds, 'en').map((world) => world.name)).toEqual(order);
    expect(worlds[0].name).toBe('Titan 10');

    const rows = [
      ...render(worlds).matchAll(/<td class="ac-worlds-table__name">([^<]*)<\/td>/g),
    ].map((match) => match[1]);
    expect(rows).toEqual(order);
  });

  it('has the «Mundo» column alone, with no button and nothing to focus (X3)', () => {
    const html = render(worlds);

    expect((html.match(/<th\b/g) ?? []).length).toBe(1);
    expect(html).toContain(
      '<th scope="col" class="ac-worlds-table__th ac-worlds-table__th--name">',
    );
    expect(html).toContain('>Mundo</th>');
    expect((html.match(/<td\b/g) ?? []).length).toBe(worlds.length);
    expect(html).not.toMatch(/<(button|a|input|select)\b/);
    expect(html).not.toMatch(/tabindex|aria-sort|<colgroup/);
  });

  it('names the section with a hidden h2 and gives the table its caption (8.1, WA2)', () => {
    const html = render(worlds, 'en');
    const id = /aria-labelledby="([^"]+)"/.exec(html)?.[1];

    expect(id).toBeTruthy();
    expect(html).toContain(`<h2 id="${id}" class="sr-only">Worlds</h2>`);
    expect(html).toContain('<caption class="sr-only">Worlds</caption>');
    expect(html).toContain('data-area="mundos"');
    expect(html).not.toContain('Mundo');
  });

  it('draws nothing without worlds (8.1 step 4)', () => {
    expect(render([])).toBe('');
  });
});
