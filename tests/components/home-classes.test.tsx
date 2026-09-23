import { getContainerRenderer } from '@astrojs/react/container-renderer';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { loadRenderers } from 'astro:container';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeAll, describe, expect, it } from 'vitest';

import { FeaturedCard } from '@/components/home/FeaturedCard';
import { FeaturedSection } from '@/components/home/FeaturedSection';
import HomeIntro from '@/components/home/HomeIntro.astro';
import IndexPanel from '@/components/home/IndexPanel.astro';
import { WorldsTable } from '@/components/home/WorldsTable';
import type { TipData } from '@/lib/game/tips';

// C7-02 (spec 7.14, 14.2) for the Inicio components of 7.2.7 that M10 builds: `HomeIntro`,
// `FeaturedCard`, `FeaturedSection`, `IndexPanel` and `WorldsTable` carry the `ac-*` classes of
// the design system's reference, `components/bundle.js`, on the same elements and at the same
// depth, so the stylesheets ported from `bundle.css` apply unchanged (C-R2). The comparison is
// the one of tests/components/classes.test.tsx, which covers 7.2.2 and 7.2.3: each case renders
// the site component and reduces its markup to one line per element with an `ac-*` class (or
// `sr-only`, the port of `.ac-sr`), `tag.class.class` with the classes sorted, indented by the
// tracked elements around it.
//
// The reference side is frozen in REFERENCE below: the fingerprint of `bundle.js` rendered with
// the same props (a sprite as `AC.Sprite`, a panel as the tooltip the design system takes), with
// the translations of classes.test.tsx (`.ac-sr` is `sr-only`; the hidden panel of NestedEntity
// is the `role="tooltip"` popover next to its trigger, written `(tooltip)`) and the ones the
// spec fixes for these components, each written where the case is:
//   - HomeIntro without a sprite keeps its box, empty (8.1 step 1: «sin ella, la caja queda
//     vacía»), where the reference leaves it out;
//   - WorldsTable has the «Mundo» column alone (X3, PZ-05): no «En línea» column, so no sort
//     buttons and no `colgroup`; each name is a `td` and not the `th` of the reference, because
//     with no other column it heads no cell (D-022, axe `th-has-data-cells`); and the table
//     carries its hidden `caption` (WA2).

// ---------------------------------------------------------------------------------------------
// Reading the markup (as in tests/components/classes.test.tsx)

interface Node {
  tag: string;
  attrs: Record<string, string>;
  children: Node[];
}

const VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'source',
  'track',
  'wbr',
]);
const RAW_TEXT_TAGS = new Set(['script', 'style']);
const TAG_PATTERN =
  /<!--[\s\S]*?-->|<!doctype[^>]*>|<(\/?)([a-zA-Z][\w:-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*(\/?)>/gi;
const ATTRIBUTE_PATTERN = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

/** The element tree of server markup (React or Astro), which is always well formed. */
function parse(html: string): Node {
  const root: Node = { tag: '#root', attrs: {}, children: [] };
  const stack: Node[] = [root];
  const tags = new RegExp(TAG_PATTERN.source, 'gi');
  for (let match = tags.exec(html); match !== null; match = tags.exec(html)) {
    const [, closing, rawTag, rawAttributes = '', selfClosing] = match;
    if (rawTag === undefined) continue;
    const tag = rawTag.toLowerCase();
    if (closing) {
      const at = stack.map((node) => node.tag).lastIndexOf(tag);
      if (at > 0) stack.length = at;
      continue;
    }
    const attrs: Record<string, string> = {};
    const attributes = new RegExp(ATTRIBUTE_PATTERN.source, 'g');
    for (let a = attributes.exec(rawAttributes); a !== null; a = attributes.exec(rawAttributes)) {
      attrs[a[1].toLowerCase()] = a[2] ?? a[3] ?? a[4] ?? '';
    }
    const node: Node = { tag, attrs, children: [] };
    stack[stack.length - 1].children.push(node);
    if (RAW_TEXT_TAGS.has(tag)) {
      const end = html.indexOf(`</${tag}`, tags.lastIndex);
      tags.lastIndex = end < 0 ? html.length : end;
    } else if (!selfClosing && !VOID_TAGS.has(tag)) {
      stack.push(node);
    }
  }
  return root;
}

function classesOf(node: Node): string[] {
  return (node.attrs.class ?? '').split(/\s+/).filter(Boolean);
}

/** The classes the comparison follows: every `ac-*` one and `sr-only`, the port of `.ac-sr`. */
function tracked(node: Node): string[] {
  const list = classesOf(node).filter((name) => name.startsWith('ac-') || name === 'sr-only');
  return [...new Set(list)].sort();
}

/**
 * C-R2, NestedEntity: the panel of the site stands for the reference's hidden panel only when
 * it is a manual popover with an `id` that a sibling trigger names in `aria-describedby`.
 */
function panelToken(panel: Node, parent: Node): string {
  const id = panel.attrs.id;
  const named = parent.children.some(
    (sibling) => sibling !== panel && id !== undefined && sibling.attrs['aria-describedby'] === id,
  );
  return panel.attrs.popover === 'manual' && named
    ? '(tooltip)'
    : '(tooltip that is not a manual popover named by its trigger)';
}

/** One line per element with tracked classes, indented by the tracked elements around it. */
function fingerprint(html: string): string {
  const lines: string[] = [];
  const walk = (node: Node, depth: number, parent: Node) => {
    const indent = '  '.repeat(depth);
    if (node.attrs.role === 'tooltip') {
      lines.push(indent + panelToken(node, parent));
      return;
    }
    const classes = tracked(node);
    let inner = depth;
    if (classes.length > 0) {
      lines.push(`${indent}${node.tag}.${classes.join('.')}`);
      inner = depth + 1;
    }
    for (const child of node.children) walk(child, inner, node);
  };
  const root = parse(html);
  for (const child of root.children) walk(child, 0, root);
  return lines.join('\n');
}

/** A fingerprint written in the table, without the indentation of the source. */
function fp(strings: TemplateStringsArray): string {
  const lines = strings.raw
    .join('')
    .split('\n')
    .filter((line) => line.trim() !== '');
  const indent = Math.min(...lines.map((line) => line.length - line.trimStart().length));
  return lines.map((line) => line.slice(indent).trimEnd()).join('\n');
}

// ---------------------------------------------------------------------------------------------
// Rendering

let container: AstroContainer;

beforeAll(async () => {
  container = await AstroContainer.create({
    renderers: await loadRenderers([getContainerRenderer()]),
  });
});

type AstroComponent = Parameters<AstroContainer['renderToString']>[0];
type Render = () => string | Promise<string>;

function astro(component: AstroComponent, props: Record<string, unknown>): Render {
  return () => container.renderToString(component, { props });
}

function tsx(element: ReactElement): Render {
  return () => renderToStaticMarkup(element);
}

const tip: TipData = {
  key: 'sistema:boost',
  title: 'Boost',
  width: 282,
  head: { type: 'sprite', sprite: null },
  rows: [{ label: 'Uso', value: 'Prueba' }],
};

// ---------------------------------------------------------------------------------------------
// Cases and reference

const CASES: Record<string, Record<string, Render>> = {
  HomeIntro: {
    sprite: astro(HomeIntro, {
      title: 'Bienvenido a Alliance Codex',
      description: 'Línea',
      sprite: { src: '/sprites/prueba-16.png', size: [16, 16] },
    }),
    'no sprite': astro(HomeIntro, {
      title: 'Bienvenido a Alliance Codex',
      description: 'Línea',
      sprite: null,
    }),
  },
  FeaturedCard: {
    sprite: tsx(
      <FeaturedCard
        label="Pokédex"
        href="/es/pokedex/"
        sprite={{ src: '/sprites/prueba-16.png', size: [16, 16] }}
      />,
    ),
    'no sprite': tsx(<FeaturedCard label="Comercio" href="/es/comercio/" sprite={null} />),
  },
  FeaturedSection: {
    default: tsx(
      <FeaturedSection
        title="Destacados"
        id="destacados"
        items={[
          {
            label: 'Pokédex',
            href: '/es/pokedex/',
            sprite: { src: '/sprites/prueba-16.png', size: [16, 16] },
          },
          { label: 'Comercio', href: '/es/comercio/', sprite: null },
        ]}
      />,
    ),
  },
  IndexPanel: {
    'span, strip sprite and a panel': astro(IndexPanel, {
      id: 'indice-sistemas',
      title: 'Sistemas',
      sprite: { src: '/sprites/prueba-a.png', size: [27, 30] },
      countLabel: ' páginas',
      locale: 'es',
      hint: 'Mantén Shift para fijar',
      span: 2,
      links: [
        {
          id: 'boost',
          label: 'Boost',
          href: '/es/sistemas/boost/',
          icon: { src: '/sprites/prueba-b.png', size: [22, 30] },
          tip,
        },
        { id: 'helds', label: 'Held Items', href: '/es/sistemas/helds/', icon: null },
      ],
    }),
    plain: astro(IndexPanel, {
      id: 'indice-items',
      title: 'Ítems',
      sprite: null,
      countLabel: ' páginas',
      locale: 'es',
      links: [
        {
          id: 'stones',
          label: 'Stones',
          href: '/es/items/c/stones/',
          icon: { src: '/sprites/prueba.png', size: [32, 32] },
        },
      ],
    }),
  },
  WorldsTable: {
    default: tsx(
      <WorldsTable
        title="Mundos"
        labels={{ world: 'Mundo' }}
        locale="es"
        worlds={[
          { id: 'moon', name: 'Moon' },
          { id: 'sun', name: 'Sun' },
        ]}
      />,
    ),
  },
};

const REFERENCE: Record<string, Record<string, string>> = {
  HomeIntro: {
    sprite: fp`
      div.ac-home-intro
        span.ac-home-intro__sprite
          img.ac-sprite
        div.ac-home-intro__text
          h1.ac-home-intro__title
          p.ac-home-intro__description
    `,
    // 8.1 step 1: the empty box stays, so the h1 keeps its x; the reference drops it.
    'no sprite': fp`
      div.ac-home-intro
        span.ac-home-intro__sprite
        div.ac-home-intro__text
          h1.ac-home-intro__title
          p.ac-home-intro__description
    `,
  },
  FeaturedCard: {
    sprite: fp`
      a.ac-featured-card
        span.ac-featured-card__sprite
          span.ac-bounce.ac-featured-card__bounce
            img.ac-sprite
        span.ac-featured-card__label
        svg.ac-featured-card__arrow
    `,
    'no sprite': fp`
      a.ac-featured-card
        span.ac-featured-card__sprite
        span.ac-featured-card__label
        svg.ac-featured-card__arrow
    `,
  },
  FeaturedSection: {
    default: fp`
      section.ac-featured-section
        h2.ac-featured-section__title
        ul.ac-featured-section__grid
          li.ac-featured-section__item
            a.ac-featured-card
              span.ac-featured-card__sprite
                span.ac-bounce.ac-featured-card__bounce
                  img.ac-sprite
              span.ac-featured-card__label
              svg.ac-featured-card__arrow
          li.ac-featured-section__item
            a.ac-featured-card
              span.ac-featured-card__sprite
              span.ac-featured-card__label
              svg.ac-featured-card__arrow
    `,
  },
  IndexPanel: {
    'span, strip sprite and a panel': fp`
      section.ac-index-panel.ac-index-panel--span-2
        div.ac-index-panel__head
          span.ac-index-panel__sprite
            span.ac-sprite-cell
              span.ac-sprite-cell__at
                img.ac-sprite
          h2.ac-index-panel__title
          span.ac-index-panel__count
            span.sr-only
        ul.ac-index-panel__links
          li.ac-index-panel__item
            span.ac-index-panel__tip.ac-nested-entity.ac-nested-entity--block
              a.ac-index-panel__link.ac-nested-entity__trigger.ac-nested-entity__trigger--plain
                span.ac-index-panel__icon
                  span.ac-sprite-cell
                    span.ac-sprite-cell__at
                      img.ac-sprite
                span.ac-index-panel__label
              (tooltip)
          li.ac-index-panel__item
            a.ac-index-panel__link
              span.ac-index-panel__icon
              span.ac-index-panel__label
    `,
    plain: fp`
      section.ac-index-panel
        div.ac-index-panel__head
          span.ac-index-panel__sprite
          h2.ac-index-panel__title
          span.ac-index-panel__count
            span.sr-only
        ul.ac-index-panel__links
          li.ac-index-panel__item
            a.ac-index-panel__link
              span.ac-index-panel__icon
                span.ac-sprite-cell
                  span.ac-sprite-cell__at
                    img.ac-sprite
              span.ac-index-panel__label
    `,
  },
  WorldsTable: {
    // X3, PZ-05, D-022 and WA2: the «Mundo» column alone, `td` names and the hidden caption.
    default: fp`
      section.ac-worlds-table
        h2.sr-only
        table.ac-worlds-table__table
          caption.sr-only
          th.ac-worlds-table__th.ac-worlds-table__th--name
          td.ac-worlds-table__name
          td.ac-worlds-table__name
    `,
  },
};

/** The Inicio components of 7.2.7 that M10 builds. */
const COMPONENTS = ['HomeIntro', 'FeaturedCard', 'FeaturedSection', 'IndexPanel', 'WorldsTable'];

describe('the comparison', () => {
  it('covers every Inicio component, each with every case of its reference', () => {
    expect(Object.keys(CASES)).toEqual(COMPONENTS);
    expect(Object.keys(REFERENCE)).toEqual(COMPONENTS);
    for (const component of COMPONENTS) {
      expect(Object.keys(CASES[component]), component).toEqual(Object.keys(REFERENCE[component]));
    }
  });
});

for (const component of COMPONENTS) {
  describe(`${component} (C7-02)`, () => {
    for (const [name, render] of Object.entries(CASES[component])) {
      it(`${name}: has the ac-* classes of the reference`, async () => {
        expect(fingerprint(await render()), `${component} (${name})`).toBe(
          REFERENCE[component][name],
        );
      });
    }
  });
}
