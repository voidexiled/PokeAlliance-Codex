// `src/lib/nav/groups.ts` (spec 8.0.3, 7.10.2): WG5 and the single `aria-current` of E10.
//
// WG5 leaves the sidebar with the links of §8.0.3 whose routes the build carries, and the
// groups the registries fill («Sistemas» from content/sistemas/, «Ítems» from
// content/items/categorias.json, «Actividades» from content/quests.json) follow their registry. The current-page half of the
// module — the exact match, the longest-section-prefix fallback of E10 and the `open` of
// C7-12 — is measured here with the routes §8.0.1 gives those entries, whatever routes a
// milestone has migrated.
//
// The set of links is deliberately read from the module and not written down twice: a
// test that repeated the table would pass while the table was wrong. What is asserted is
// the rule (a link exists only if its route exists; at most one link is current; the group
// of the current page starts open), not the inventory.

import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getContainerRenderer } from '@astrojs/react/container-renderer';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { loadRenderers } from 'astro:container';
import { describe, expect, it } from 'vitest';

import Sidebar from '@/components/layout/Sidebar.astro';

import {
  getCategorias,
  getDestacados,
  getSistemas,
  getSpriteRegistry,
} from '@/lib/content/registry';
import { getPokemon, getQuests } from '@/lib/content/repository';
import {
  buildFeatured,
  buildNav,
  enlazaDestacado,
  type SidebarLink,
  type SidebarNav,
} from '@/lib/nav/groups';
import { ARTE_EN_MARCO } from '@/lib/nav/menu-sprites';
import { spriteOrNull } from '@/lib/sprites/resolve';
import { STATIC_ROUTES } from '../../scripts/content/lib/check-content.mjs';
import { esRutaDelSitio, normalizarRuta } from '../../scripts/lib/rutas-migradas.mjs';

/** Every link of the menu, the top ones and the ones inside groups. */
function links(nav: SidebarNav): SidebarLink[] {
  return [...nav.top, ...nav.groups.flatMap((group) => group.items)];
}

/** The links that carry `aria-current` — at most one in the whole menu (E10). */
function current(nav: SidebarNav): SidebarLink[] {
  return links(nav).filter((link) => link.current !== undefined);
}

function groupOf(nav: SidebarNav, id: string) {
  return nav.groups.find((group) => group.id === id);
}

describe('WG5: a link exists only if its route exists in the build', () => {
  it('drops the entries whose route no milestone has built yet', () => {
    const nav = buildNav('es', '/es/');
    const ids = links(nav).map((link) => link.id);

    // M9 built `/{l}/pokedex/tiers/`, so the entry of §8.0.3 has a route and the menu
    // links it; the search index carries it too (BU6).
    expect(esRutaDelSitio('/es/pokedex/tiers/'), 'the tier list is built').toBe(true);
    expect(groupOf(nav, 'pokemon')?.items.map((link) => link.id)).toContain('tiers');

    // The entries the build does carry are linked, with the locale segment resolved.
    expect(ids).toContain('inicio');
    expect(ids).toContain('pokedex');
    const pokedex = links(nav).find((link) => link.id === 'pokedex');
    expect(pokedex?.href).toBe('/es/pokedex/');
  });

  it('does not render a group that has no link', () => {
    for (const locale of ['es', 'en'] as const) {
      const nav = buildNav(locale, `/${locale}/`);
      const rendered = nav.groups.map((group) => group.id);

      expect(nav.groups.every((group) => group.items.length > 0)).toBe(true);
      // A group filled from a registry exists only while its registry has a record.
      expect(rendered.includes('actividades'), 'Actividades follows content/quests.json').toBe(
        getQuests().length > 0,
      );
      // Since M11 every fixed entry of §8.0.3 has its route, so every fixed group is there.
      for (const fixed of ['pokemon', 'herramientas', 'comunidad']) {
        expect(rendered, `${fixed} (${locale})`).toContain(fixed);
      }
      expect(groupOf(nav, 'herramientas')?.items.map((link) => link.id)).toEqual(['guild', 'mapa']);
      expect(groupOf(nav, 'comunidad')?.items.map((link) => link.id)).toEqual([
        'comercio',
        'cambios',
      ]);
      expect(groupOf(nav, 'pokemon')?.items.map((link) => link.id)).toEqual([
        'pokedex',
        'tiers',
        'comparar',
      ]);
    }
  });

  it('fills «Sistemas» from the registry, in its order (8.0.3, 8.4)', () => {
    const sistemas = getSistemas();
    for (const locale of ['es', 'en'] as const) {
      const group = groupOf(buildNav(locale, `/${locale}/`), 'sistemas');
      expect(group?.items.map((link) => link.id)).toEqual(sistemas.map((sistema) => sistema.id));
      expect(group?.items.map((link) => link.label)).toEqual(
        sistemas.map((sistema) => sistema.titulo[locale]),
      );
      expect(group?.items.map((link) => link.href)).toEqual(
        sistemas.map((sistema) => `/${locale}/sistemas/${sistema.id}/`),
      );
    }

    // A system page marks its own entry and opens the group.
    const first = sistemas[0];
    if (!first) throw new Error('the registry has no system');
    const nav = buildNav('es', `/es/sistemas/${first.id}/`);
    expect(current(nav).map((link) => [link.id, link.current])).toEqual([[first.id, 'page']]);
    expect(groupOf(nav, 'sistemas')?.open).toBe(true);
  });

  it('fills «Ítems» from the registry, in its order (8.0.3, 8.5)', () => {
    const categorias = getCategorias();
    for (const locale of ['es', 'en'] as const) {
      const group = groupOf(buildNav(locale, `/${locale}/`), 'items');
      expect(group?.items.map((link) => link.id)).toEqual(
        categorias.map((categoria) => categoria.id),
      );
      expect(group?.items.map((link) => link.label)).toEqual(
        categorias.map((categoria) => categoria.nombre[locale]),
      );
      // The virtual category is the «Todo» page; every other one is a category page.
      expect(group?.items.map((link) => link.href)).toEqual(
        categorias.map((categoria) =>
          categoria.virtual === true ? `/${locale}/items/` : `/${locale}/items/c/${categoria.id}/`,
        ),
      );
    }

    // A category page marks its own entry and opens the group.
    const categoria = categorias.find((entry) => entry.virtual !== true);
    if (!categoria) throw new Error('the registry has no real category');
    const nav = buildNav('es', `/es/items/c/${categoria.id}/`);
    expect(current(nav).map((link) => [link.id, link.current])).toEqual([[categoria.id, 'page']]);
    expect(groupOf(nav, 'items')?.open).toBe(true);
  });

  it('fills «Actividades» from the registry, in its order (8.0.3, 8.9)', () => {
    const quests = getQuests();
    for (const locale of ['es', 'en'] as const) {
      const group = groupOf(buildNav(locale, `/${locale}/`), 'actividades');
      if (quests.length === 0) {
        // With no activity the group has no link and is not rendered (WG5).
        expect(group).toBeUndefined();
        continue;
      }
      expect(group?.label).toBe(locale === 'es' ? 'Actividades' : 'Activities');
      expect(group?.items.map((link) => link.id)).toEqual(quests.map((quest) => quest.id));
      // `nombre` is the name of the game, the same in both locales (T23, 13.4).
      expect(group?.items.map((link) => link.label)).toEqual(quests.map((quest) => quest.nombre));
      expect(group?.items.map((link) => link.href)).toEqual(
        quests.map((quest) => `/${locale}/actividades/${quest.id}/`),
      );
      // Each activity draws the sprite of its record (owner rule 2026-09-25).
      expect(group?.items.map((link) => link.sprite?.src ?? null)).toEqual(
        quests.map((quest) => spriteOrNull(getSpriteRegistry(), quest.sprite)?.src ?? null),
      );
    }

    const first = quests[0];
    if (!first) return;
    // An activity page marks its own entry and opens the group.
    const nav = buildNav('es', `/es/actividades/${first.id}/`);
    expect(current(nav).map((link) => [link.id, link.current])).toEqual([[first.id, 'page']]);
    expect(groupOf(nav, 'actividades')?.open).toBe(true);
    // The index is the page of the group, not an entry of it (8.0.3, 8.9.1), as `/{l}/sistemas/`
    // is for «Sistemas»: it marks no entry.
    expect(current(buildNav('es', '/es/actividades/'))).toEqual([]);
  });

  it('reads the labels and the routes of the locale', () => {
    const es = buildNav('es', '/es/');
    const en = buildNav('en', '/en/');

    expect(es.top[0]?.label).toBe('Inicio');
    expect(en.top[0]?.label).toBe('Home');
    expect(en.top[0]?.href).toBe('/en/');
    expect(links(en).every((link) => link.href.startsWith('/en/'))).toBe(true);

    // A game term reads the same in both locales (T23), and both menus have the same
    // shape: the routes that exist do not depend on the language.
    expect(links(en).map((link) => link.id)).toEqual(links(es).map((link) => link.id));
    expect(groupOf(en, 'herramientas')?.label).toBe('Tools');
  });
});

describe('«Destacados»: the pinned group of content/destacados.json (8.0.3, 7.10.2)', () => {
  const destacados = getDestacados();

  it('lists the entries of the registry, in the order of the file, first of all groups', () => {
    for (const locale of ['es', 'en'] as const) {
      const nav = buildNav(locale, `/${locale}/`);
      const group = groupOf(nav, 'destacados');
      if (destacados.length === 0) {
        // Without the file, or with every entry a hidden draft, there is no group (WG5).
        expect(group).toBeUndefined();
        continue;
      }
      expect(nav.groups[0]?.id).toBe('destacados');
      expect(group?.pinned).toBe(true);
      expect(group?.label).toBe(locale === 'es' ? 'Destacados' : 'Featured');
      expect(group?.items.map((link) => link.label)).toEqual(
        destacados.map((entry) => entry.etiqueta[locale]),
      );
      expect(group?.items.map((link) => link.href)).toEqual(
        destacados.map((entry) => `/${locale}${entry.ruta}`),
      );
      // Two entries never share a route (G10), so the ids built from them never collide.
      const ids = group?.items.map((link) => link.id) ?? [];
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('gives each entry the sprite of its record at rest (6.3)', () => {
    const registry = getSpriteRegistry();
    const group = groupOf(buildNav('es', '/es/'), 'destacados');
    for (const [index, entry] of destacados.entries()) {
      const link = group?.items[index];
      const expected = spriteOrNull(registry, entry.sprite);
      if (expected === null) {
        // A record with no sprite yet keeps the box, empty (D-011).
        expect(link?.sprite, entry.ruta).toBeNull();
      } else {
        expect(link?.sprite?.src, entry.ruta).toBe(expected.src);
        expect(link?.sprite?.size, entry.ruta).toEqual(expected.size);
        // Frame 0 and no animation in the menu, the Diamond included (6.3).
        expect(link?.sprite?.durations, entry.ruta).toBeUndefined();
      }
    }
    // Every other link and every heading carries its sprite too (owner rule 2026-09-25).
    const nav = buildNav('es', '/es/');
    const others = [
      ...nav.top,
      ...nav.groups,
      ...nav.groups.filter((g) => !g.pinned).flatMap((g) => g.items),
    ];
    expect(others.every((entry) => entry.sprite !== undefined)).toBe(true);
  });

  it('draws art up to 20 at 1x and scales larger art down to 18 (owner rule 2026-09-25)', () => {
    const nav = buildNav('es', '/es/');
    const all = [...nav.top, ...nav.groups, ...nav.groups.flatMap((g) => g.items)];
    for (const entry of all) {
      const sprite = entry.sprite;
      if (sprite === null || sprite.smooth === true) continue;
      if (sprite.width === undefined) {
        // At 1x: the frame itself, or a frame whose measured art is at most 20.
        expect(sprite.height, entry.label).toBeUndefined();
      } else {
        // Scaled: never larger than the frame, and in the frame's proportions.
        expect(sprite.width, entry.label).toBeLessThan(sprite.size[0]);
        expect(
          Math.abs(sprite.width / sprite.size[0] - (sprite.height ?? 0) / sprite.size[1]),
          entry.label,
        ).toBeLessThan(0.05);
      }
    }
  });

  it('measures the art of the padded menu frames as the PNG draws it', () => {
    // `ARTE_EN_MARCO`: the longest side of the visible art of frame 0. A new PNG under one of
    // these keys fails here until its figure changes.
    const registry = getSpriteRegistry();
    for (const [key, side] of Object.entries(ARTE_EN_MARCO)) {
      const entry = registry[key];
      if (!entry) continue;
      const png = PNG.sync.read(
        readFileSync(
          fileURLToPath(new URL(`../../public/sprites/${entry.archivo}`, import.meta.url)),
        ),
      );
      const [frameWidth, frameHeight] = entry.frame;
      let [left, top, right, bottom] = [frameWidth, frameHeight, -1, -1];
      for (let y = 0; y < frameHeight; y += 1) {
        for (let x = 0; x < frameWidth; x += 1) {
          if (png.data[(y * png.width + x) * 4 + 3] === 0) continue;
          left = Math.min(left, x);
          right = Math.max(right, x);
          top = Math.min(top, y);
          bottom = Math.max(bottom, y);
        }
      }
      expect(Math.max(right - left + 1, bottom - top + 1), key).toBe(side);
    }
  });

  it('gives a page «Destacados» links the sprite of its record everywhere in the menu', () => {
    const nav = buildNav('es', '/es/');
    const pinnedGroup = nav.groups.find((g) => g.pinned);
    for (const link of pinnedGroup?.items ?? []) {
      const copies = nav.groups
        .filter((g) => !g.pinned)
        .flatMap((g) => g.items)
        .filter((other) => other.href === link.href);
      for (const copy of copies) {
        if (link.sprite === null) continue;
        expect(copy.sprite, link.href).toEqual(link.sprite);
      }
    }
  });

  it('marks the entry of the page’s own group, never its pinned copy (E10)', () => {
    for (const entry of destacados) {
      const path = `/es${entry.ruta}`;
      const nav = buildNav('es', path);
      const marked = current(nav);
      expect(marked, `${path}: one mark at most`).toHaveLength(1);
      const pinned = groupOf(nav, 'destacados');
      const shared = nav.groups.some(
        (group) =>
          !group.pinned &&
          group.items.some((link) => normalizarRuta(link.href) === normalizarRuta(path)),
      );
      if (shared) {
        expect(
          pinned?.items.some((link) => link.current !== undefined),
          path,
        ).toBe(false);
        const owner = nav.groups.find((group) =>
          group.items.some((link) => link.current !== undefined),
        );
        expect(owner?.pinned, path).toBe(false);
        expect(owner?.open, `${path}: its group opens`).toBe(true);
      } else {
        expect(marked[0]?.href, path).toBe(path);
      }
    }
  });
});

describe('«Destacados» of the pages: the entries of the pinned group (8.1 step 3)', () => {
  const PAGES = fileURLToPath(new URL('../../src/pages/[locale]/', import.meta.url));

  /** Whether src/pages/[locale]/ holds the page of a static route, as `pnpm content:check` asks. */
  function writesPage(ruta: string): boolean {
    const parts = ruta.split('/').filter(Boolean);
    const last = parts.at(-1);
    const folder = path.join(PAGES, ...parts.slice(0, -1));
    const pages = last === undefined ? ['index.astro'] : [`${last}.astro`, `${last}/index.astro`];
    return pages.some((page) => existsSync(path.join(folder, page)));
  }

  it('gives the Inicio, Buscar and the 404 the links of the pinned group, in its order', () => {
    for (const locale of ['es', 'en'] as const) {
      const pinned = groupOf(buildNav(locale, `/${locale}/`), 'destacados')?.items ?? [];
      expect(
        buildFeatured(locale).map(({ label, href }) => ({ label, href })),
        `${locale}: the page and the menu show the same entries`,
      ).toEqual(pinned.map(({ label, href }) => ({ label, href })));
    }
  });

  it('turns an animated sheet in the cards, where the menu keeps it on frame 0 (6.3)', () => {
    const registry = getSpriteRegistry();
    const featured = buildFeatured('es');
    for (const entry of getDestacados().filter((item) => enlazaDestacado(item.ruta, 'es'))) {
      const card = featured.find((link) => link.href === `/es${entry.ruta}`);
      const still = spriteOrNull(registry, entry.sprite);
      const expected =
        still?.mode === 'animacion'
          ? spriteOrNull(registry, entry.sprite, { animado: true })
          : still;
      expect(card?.sprite, entry.ruta).toEqual(expected);
    }
  });

  it('links every static page that `pnpm content:check` accepts as a Destacado, and no other (WG5)', () => {
    for (const ruta of STATIC_ROUTES as Set<string>) {
      for (const locale of ['es', 'en'] as const) {
        expect(enlazaDestacado(ruta, locale), `${ruta} (${locale})`).toBe(writesPage(ruta));
      }
    }
  });

  it('links the page of a record through the template of its folder (WG5)', () => {
    const pokemon = getPokemon()[0];
    const sistema = getSistemas()[0];
    const categoria = getCategorias().find((entry) => entry.virtual !== true);
    if (pokemon === undefined || sistema === undefined || categoria === undefined)
      throw new Error('the registries need a Pokémon, a system page and a Market category');
    for (const locale of ['es', 'en'] as const) {
      expect(enlazaDestacado(`/pokedex/${pokemon.id}/`, locale)).toBe(true);
      expect(enlazaDestacado(`/sistemas/${sistema.id}/`, locale)).toBe(true);
      expect(enlazaDestacado(`/items/c/${categoria.id}/`, locale)).toBe(true);
      // One page per activity of the registry (8.9.2), and none for an id it does not have.
      for (const quest of getQuests()) {
        expect(enlazaDestacado(`/actividades/${quest.id}/`, locale), quest.id).toBe(true);
      }
      expect(enlazaDestacado('/actividades/nada/', locale)).toBe(false);
    }
  });
});

// pngjs ships no type declarations: the one call used here is declared locally, as
// tests/visual/compare.ts does.
const { PNG } = createRequire(import.meta.url)('pngjs') as {
  PNG: { sync: { read(buffer: Buffer): { width: number; data: Buffer } } };
};

describe('Sidebar.astro: the sprites of the pinned group on whole pixels (DS:Sidebar, §3.7)', () => {
  /** A pinned group with one link per sprite, as `buildNav` returns it. */
  const pinned = (sprites: [string, SidebarLink['sprite']][]): SidebarNav => ({
    top: [],
    groups: [
      {
        id: 'destacados',
        label: 'Destacados',
        sprite: null,
        pinned: true,
        open: false,
        items: sprites.map(([id, sprite]) => ({
          id,
          label: id,
          href: `/es/${id}/`,
          sprite,
        })),
      },
    ],
  });

  it('names the odd sides in `data-snap` and keeps lengths out of `style`', async () => {
    const container = await AstroContainer.create({
      renderers: await loadRenderers([getContainerRenderer()]),
    });
    const frame = (size: [number, number]) => ({
      src: `/sprites/prueba-${size[0]}.png`,
      size,
      frames: 1,
      mode: 'estatico' as const,
    });
    const html = await container.renderToString(Sidebar, {
      props: {
        locale: 'es',
        nav: pinned([
          ['par', frame([16, 16])],
          ['impar', frame([15, 15])],
          ['alto', frame([16, 13])],
          ['ancho', frame([13, 16])],
          ['escalado', { ...frame([32, 32]), width: 18, height: 18 }],
          ['escalado-impar', { ...frame([28, 28]), width: 17, height: 17 }],
          ['vacio', null],
        ]),
      },
    });
    const boxes = [...html.matchAll(/<span class="ac-sidebar__sprite ac-bounce"([^>]*)>/g)].map(
      (match) => /data-snap="([^"]*)"/.exec(match[1] ?? '')?.[1] ?? null,
    );
    // 16 × 16 and a scaled 18 × 18 are even; the box without a sprite has none.
    expect(boxes).toEqual([null, 'x y', 'y', 'x', null, 'x y', null]);
    // §3.7: the one `style` of the group is the geometry of each sprite image (C-R2).
    const styles = [...html.matchAll(/<(\w+)[^>]*\sstyle="([^"]*)"/g)];
    expect(styles.every(([, tag]) => tag === 'img')).toBe(true);
    expect(styles.map(([, , style]) => style).join(';')).not.toMatch(/margin|display/);
  });

  it('gives each odd side its 1 px in sidebar.css (spriteNode of DS:Sidebar)', () => {
    const css = readFileSync(
      fileURLToPath(new URL('../../src/styles/components/sidebar.css', import.meta.url)),
      'utf8',
    );
    expect(css).toMatch(
      /\.ac-sidebar__sprite\[data-snap~='x'\] > \.ac-sprite \{\s*margin-right: 1px;\s*\}/,
    );
    expect(css).toMatch(
      /\.ac-sidebar__sprite\[data-snap~='y'\] > \.ac-sprite \{\s*margin-bottom: 1px;\s*\}/,
    );
  });
});

describe('E10 and C7-12: the entry the page marks, and the group that opens', () => {
  it('marks the route itself with `page` and opens its group', () => {
    const nav = buildNav('es', '/es/pokedex/');

    expect(current(nav)).toHaveLength(1);
    expect(current(nav)[0]?.id).toBe('pokedex');
    expect(current(nav)[0]?.current).toBe('page');
    expect(groupOf(nav, 'pokemon')?.open, 'the group of the current page starts open').toBe(true);
    for (const group of nav.groups) {
      if (group.id !== 'pokemon') expect(group.open, `${group.id} stays closed`).toBe(false);
    }
  });

  it('marks the section of a child route with `true`, not `page` (E10)', () => {
    // A Pokémon page has no entry of its own, so it marks the Pokédex entry with the
    // same look and a different value: `page` is the page itself.
    const nav = buildNav('es', '/es/pokedex/charizard/');

    expect(current(nav)).toHaveLength(1);
    expect(current(nav)[0]?.id).toBe('pokedex');
    expect(current(nav)[0]?.current).toBe('true');
    expect(groupOf(nav, 'pokemon')?.open).toBe(true);
  });

  it('gives the longest section prefix the mark, and only one entry gets it', () => {
    // Comercio is a section too (§8.0.3): its listing, its seller profile and its publish
    // page hang from it.
    const nav = buildNav('es', '/es/comercio/anuncio/algo/');

    expect(current(nav)).toHaveLength(1);
    expect(current(nav)[0]?.id).toBe('comercio');
    expect(current(nav)[0]?.current).toBe('true');
    expect(groupOf(nav, 'comunidad')?.open).toBe(true);
  });

  it('marks an exact route over any section that is a prefix of it', () => {
    // `/{l}/` is an entry and a prefix of every route; nothing but the home marks it.
    const nav = buildNav('es', '/es/');

    expect(current(nav)).toHaveLength(1);
    expect(current(nav)[0]?.id).toBe('inicio');
    expect(current(nav)[0]?.current).toBe('page');
    expect(nav.groups.every((group) => !group.open)).toBe(true);
  });

  it('marks nothing on a page that hangs from no entry', () => {
    // Buscar, the 404 and the account pages belong to no section (§8.0.3).
    for (const path of ['/es/buscar/', '/es/no-existe/', '/es/_paridad/marco/']) {
      const nav = buildNav('es', path);
      expect(current(nav), `${path} marks no entry`).toEqual([]);
      expect(
        nav.groups.every((group) => !group.open),
        `${path} opens no group`,
      ).toBe(true);
    }
  });

  it('marks nothing for the empty path the 404 passes (S1, WA3)', () => {
    // A 404 under a section's path (`/es/pokedex/no-existe/`) would mark that section as a
    // child route: `PageLayout` passes the empty path for an `unlisted` page instead, which
    // matches no entry and no section.
    for (const locale of ['es', 'en'] as const) {
      const nav = buildNav(locale, '');
      expect(current(nav), locale).toEqual([]);
      expect(
        nav.groups.every((group) => !group.open),
        locale,
      ).toBe(true);
    }
  });

  it('reads a path with a query or a hash as its route', () => {
    const nav = buildNav('es', '/es/pokedex/?q=char#lista');

    expect(current(nav)).toHaveLength(1);
    expect(current(nav)[0]?.current).toBe('page');
  });
});
