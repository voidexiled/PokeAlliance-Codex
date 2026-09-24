import { getContainerRenderer } from '@astrojs/react/container-renderer';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { loadRenderers } from 'astro:container';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeAll, describe, expect, it } from 'vitest';

import { ITEMS_FIELDS, type ItemsRow } from '@/components/items/config';
import { ItemsRoot } from '@/components/items/ItemsRoot';
import { ViewToggle } from '@/components/controls/ViewToggle';
import type { EntityView } from '@/components/controls/ViewToggle';
import Footer from '@/components/layout/Footer.astro';
import Header from '@/components/layout/Header.astro';
import SearchTrigger from '@/components/layout/SearchTrigger.astro';
import { PokedolaresAmount } from '@/components/money/PokedolaresAmount';
import type { Locale } from '@/i18n/config';
import { en } from '@/i18n/messages/en';
import { es } from '@/i18n/messages/es';

// Contracts of §7 that depend on text, checked on the rendered markup (§14.2).
// The frame components are `.astro`, so they render through Astro's Container
// API with the React renderer loaded, which is what lets them hold TSX; the
// TSX components render with `react-dom/server`. Later milestones append their
// own blocks here, as M6 did with `PokedolaresAmount`.

let container: AstroContainer;

beforeAll(async () => {
  container = await AstroContainer.create({
    renderers: await loadRenderers([getContainerRenderer()]),
  });
});

const alternates: Record<Locale, string> = {
  es: '/es/pokedex/',
  en: '/en/pokedex/',
};

/**
 * The Spanish defaults these three components carry in the design system
 * (`ds/project/components/<Comp>/README.md`, column «Por defecto»). DP1 says
 * the composer always passes the dictionary value, so none of them may reach
 * the `en` markup — a component that forgot a message would otherwise ship its
 * Spanish default and no other check would notice.
 */
const SPANISH_DEFAULTS = [
  'Alliance Codex es un proyecto comunitario independiente',
  'Buscar...',
  'Busca Pokémon, ítems, sistemas…',
  'Idioma',
  'Abrir menú',
  'Cerrar menú',
  'Saltar al contenido',
  'Cambiar a tema claro',
];

/** Every Spanish default present in `html`, so a failure names the string. */
function spanishDefaultsIn(html: string): string[] {
  return SPANISH_DEFAULTS.filter((value) => html.includes(value));
}

describe('Footer', () => {
  it('writes the notice of the dictionary in each locale', async () => {
    const spanish = await container.renderToString(Footer, { props: { locale: 'es' } });
    const english = await container.renderToString(Footer, { props: { locale: 'en' } });

    expect(spanish).toContain(es.shell.footer);
    expect(english).toContain(en.shell.footer);
  });

  it('carries no Spanish default in en', async () => {
    const html = await container.renderToString(Footer, { props: { locale: 'en' } });

    expect(spanishDefaultsIn(html)).toEqual([]);
  });
});

describe('Header', () => {
  it('writes the search placeholder and the language label of the dictionary', async () => {
    const spanish = await container.renderToString(Header, {
      props: { locale: 'es', alternates },
    });
    const english = await container.renderToString(Header, {
      props: { locale: 'en', alternates },
    });

    expect(spanish).toContain(es.shell.searchHeader);
    expect(spanish).toContain(es.shell.languageLabel);
    expect(english).toContain(en.shell.searchHeader);
    expect(english).toContain(en.shell.languageLabel);
  });

  it('names the menu button with the dictionary in each locale', async () => {
    const spanish = await container.renderToString(Header, {
      props: { locale: 'es', alternates },
    });
    const english = await container.renderToString(Header, {
      props: { locale: 'en', alternates },
    });

    expect(spanish).toContain(es.shell.menuOpen);
    expect(english).toContain(en.shell.menuOpen);
  });

  it('carries no Spanish default in en', async () => {
    const html = await container.renderToString(Header, {
      props: { locale: 'en', alternates },
    });

    expect(spanishDefaultsIn(html)).toEqual([]);
  });

  it('carries no Spanish default in en on the home variant either', async () => {
    const html = await container.renderToString(Header, {
      props: { locale: 'en', home: true, alternates },
    });

    expect(spanishDefaultsIn(html)).toEqual([]);
  });
});

describe('SearchTrigger', () => {
  const variants = ['header', 'home', 'mobile', 'icon'] as const;

  it('writes the placeholder of each variant from the dictionary', async () => {
    const header = await container.renderToString(SearchTrigger, {
      props: { variant: 'header', locale: 'en' },
    });
    const home = await container.renderToString(SearchTrigger, {
      props: { variant: 'home', locale: 'en' },
    });
    const icon = await container.renderToString(SearchTrigger, {
      props: { variant: 'icon', locale: 'en' },
    });

    expect(header).toContain(en.shell.searchHeader);
    expect(home).toContain(en.shell.searchHome);
    // The lens has no visible text: its accessible name is the only text.
    expect(icon).toContain(en.shell.searchIcon);
  });

  it('writes the same keycap in both locales (§13.2)', async () => {
    const spanish = await container.renderToString(SearchTrigger, {
      props: { variant: 'header', locale: 'es' },
    });
    const english = await container.renderToString(SearchTrigger, {
      props: { variant: 'header', locale: 'en' },
    });

    expect(spanish).toContain(es.shell.shortcut);
    expect(english).toContain(en.shell.shortcut);
  });

  it('carries no Spanish default in en, in any variant', async () => {
    const found: string[] = [];
    for (const variant of variants) {
      const html = await container.renderToString(SearchTrigger, {
        props: { variant, locale: 'en' },
      });
      found.push(...spanishDefaultsIn(html).map((value) => `${variant}: ${value}`));
    }

    expect(found).toEqual([]);
  });
});

describe('ViewToggle', () => {
  const dictionaries = { es, en } as const;

  function render(locale: Locale, value?: EntityView): string {
    const { views } = dictionaries[locale].ui;
    return renderToStaticMarkup(
      <ViewToggle labels={views} ariaLabel={views.label} value={value} />,
    );
  }

  /** Each button of the toggle: its visible text and its `aria-pressed`, in order. */
  function buttons(html: string): { text: string; pressed: string | null }[] {
    return [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map(
      ([, attributes, content]) => ({
        text: content.replace(/<[^>]*>/g, ''),
        pressed: /\baria-pressed="([^"]*)"/.exec(attributes)?.[1] ?? null,
      }),
    );
  }

  /** The accessible name of the `role="group"` that holds the buttons. */
  function groupName(html: string): string | undefined {
    const group = /<div\b[^>]*\brole="group"[^>]*>/.exec(html)?.[0] ?? '';
    return /\baria-label="([^"]*)"/.exec(group)?.[1];
  }

  it('writes the three views of the dictionary, in order, as aria-pressed buttons', () => {
    for (const locale of ['es', 'en'] as const) {
      const { views } = dictionaries[locale].ui;
      const drawn = buttons(render(locale));

      expect(
        drawn.map((button) => button.text),
        locale,
      ).toEqual([views.cards, views.slots, views.list]);
      expect(
        drawn.every((button) => button.pressed === 'true' || button.pressed === 'false'),
        locale,
      ).toBe(true);
    }
  });

  it('names its group with the dictionary in each locale', () => {
    expect(groupName(render('es'))).toBe(es.ui.views.label);
    expect(groupName(render('en'))).toBe(en.ui.views.label);
  });

  it('presses Cards by default and, given a view, that view alone', () => {
    const pressed = (html: string) => buttons(html).map((button) => button.pressed);

    expect(pressed(render('es'))).toEqual(['true', 'false', 'false']);
    expect(pressed(render('es', 'slots'))).toEqual(['false', 'true', 'false']);
    expect(pressed(render('en', 'list'))).toEqual(['false', 'false', 'true']);
  });

  it('carries no Spanish default in en', () => {
    // DS:ViewToggle's defaults that differ in English; «Cards» and «Slots» do not.
    const html = render('en');

    expect(['Vista', 'Lista'].filter((value) => html.includes(value))).toEqual([]);
  });
});

describe('PokedolaresAmount', () => {
  const render = (amount: number | null, locale: Locale) =>
    renderToStaticMarkup(<PokedolaresAmount amount={amount} locale={locale} />);

  it('shows the short form aria-hidden and the exact figure as accessible text (R5, §13.3)', () => {
    for (const [locale, short, exact] of [
      ['es', '150kk', '150.000.000 Pokédólares'],
      ['en', '150kk', '150,000,000 Pokédollars'],
      ['es', '2,5k', '2.500 Pokédólares'],
      ['en', '2.5k', '2,500 Pokédollars'],
    ] as const) {
      const amount = Number(exact.split(' ')[0].replace(/[.,]/g, ''));
      const html = render(amount, locale);
      expect(html, locale).toContain(`<span aria-hidden="true">${short}</span>`);
      expect(html, locale).toContain(`<span class="sr-only">${exact}</span>`);
    }
  });

  it('puts the sprite first, hidden from assistive technology (S8, §7.8)', () => {
    const html = render(850, 'es');
    const sprite = html.indexOf('ac-pokedolares-amount__sprite');
    expect(sprite).toBeGreaterThan(-1);
    expect(sprite).toBeLessThan(html.indexOf('<span aria-hidden="true">850</span>'));
    expect(html).toMatch(/class="ac-pokedolares-amount__sprite" aria-hidden="true"/);
  });

  it('says 1 Pokédólar in the singular and writes the dash with no sprite when unknown', () => {
    expect(render(1, 'es')).toContain('<span class="sr-only">1 Pokédólar</span>');
    expect(render(1, 'en')).toContain('<span class="sr-only">1 Pokédollar</span>');
    const unknown = render(null, 'es');
    expect(unknown).toContain('—');
    expect(unknown).not.toContain('<img');
  });
});

describe('ItemsRoot: the inventory of an item (8.5, 16.4.1)', () => {
  // A synthetic row, not a record of content/items/: no item of the registry has a price yet
  // and a price is never invented there (X4), so IT3 is measured on the island itself.
  const SYNTHETIC: ItemsRow = {
    id: 'it3-synthetic-item',
    nombre: 'IT3 synthetic item',
    categoria: 'stones',
    sprite: null,
    vende: 150_000_000,
    compra: null,
    elemento: null,
    uso: null,
    dropDe: null,
  };

  const render = (locale: Locale) => {
    const messages = locale === 'es' ? es : en;
    return renderToStaticMarkup(
      <ItemsRoot
        locale={locale}
        path={`/${locale}/items/c/stones/`}
        dataUrl={`/${locale}/items/datos.json`}
        category="stones"
        data={{
          v: 1,
          campos: [...ITEMS_FIELDS],
          filas: [ITEMS_FIELDS.map((field) => SYNTHETIC[field])],
          refs: { elementos: {}, pokemon: {} },
        }}
        total={1}
        categories={[{ id: 'stones', nombre: 'Stones', icono: null }]}
        elements={[]}
        droppers={{}}
        title="Stones"
        caption="Stones"
        ui={messages.ui}
        labels={{
          count: messages.items.count,
          sprite: messages.items.columnSprite,
          item: messages.items.columnItem,
          droppedByCount: messages.items.droppedByCount,
          search: messages.items.searchPlaceholder,
          noResults: messages.items.noResults,
        }}
      />,
    );
  };

  it('Ranuras (16.4.1): the item is a slot of 48 in the inventory, with no card around it', () => {
    for (const locale of ['es', 'en'] as const) {
      const html = render(locale);
      expect(html, locale).toContain('ac-inventory');
      expect(html, locale).toContain('ac-entity-slot--48');
      expect(html, locale).toContain('id="item-it3-synthetic-item"');
      expect(html, locale).not.toContain('ac-loot-card');
    }
  });
});
