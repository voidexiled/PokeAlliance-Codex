import { getContainerRenderer } from '@astrojs/react/container-renderer';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { loadRenderers } from 'astro:container';
import { beforeAll, describe, expect, it } from 'vitest';

import Block, { type BlockContext, type BlockEntity } from '@/components/systems/Block.astro';
import { es } from '@/i18n/messages/es';
import type { Bloque, Ref } from '@/lib/content/registry-schema';
import { formatPokedolaresLabel } from '@/lib/format/numbers';
import { itemTip } from '@/lib/game/tips';

// Block (spec 8.4, 3.13; `Lienzo:Sistema-Boost`) on its rendered markup (§14.2), for what the
// system pages of the registry cannot show yet: no record of content/sistemas/ carries an
// amount, a step with a sprite or a table of mentions. SI3 (an amount of the game carries its
// sprite and its exact figure as its name), R2 (a mention without a panel is text, without a
// link or a button), the text of a step or a point inside a paragraph (the exception of 13.7
// to the 44 × 44 of S14) and the column rules of `tabla`, including the cells of a one-line
// table, which never break so that a phone scrolls the table (8.4.2, DS:DataTable).

let container: AstroContainer;

beforeAll(async () => {
  container = await AstroContainer.create({
    renderers: await loadRenderers([getContainerRenderer()]),
  });
});

const stone = itemTip(
  {
    id: 'fire-stone',
    nombre: 'Fire Stone',
    categoria: 'stones',
    sprite: null,
    precioNpc: { vende: 1500, compra: null },
  },
  'es',
  es.ui.tooltip,
);

/** One item with a panel; any other reference has no record in this build. */
const entities: Record<string, BlockEntity> = {
  'item:fire-stone': { text: 'Fire Stone', tip: stone, sprite: null },
};

const context: BlockContext = {
  locale: 'es',
  entity: (ref: Ref) => entities[`${ref.tipo}:${ref.id}`] ?? null,
  element: () => null,
  sprite: () => null,
  labels: {
    step: es.systems.step,
    note: es.ui.noteLead,
    pinHint: es.ui.pinHint,
    shiny: es.ui.shiny,
    or: es.ui.or,
  },
};

const both = <T>(value: T) => ({ es: value, en: value });

async function render(block: Bloque): Promise<string> {
  return container.renderToString(Block, { props: { block, context } });
}

describe('Block', () => {
  it('draws an amount with its sprite and the exact figure as its name (SI3, S8)', async () => {
    const html = await render({
      tipo: 'parrafo',
      texto: both(['Cuesta ', { pd: 150000 }, '.']),
    });

    expect(html).toContain('ac-pokedolares-amount__sprite');
    expect(html).toContain(`<span class="sr-only">${formatPokedolaresLabel(150000, 'es')}</span>`);
    // The stop travels with the amount, on its line.
    expect(html).toMatch(/class="ac-system-block__glue"><span class="ac-pokedolares-amount"/);
  });

  it('opens the panel of a mention with a record, and leaves any other one as text (R2)', async () => {
    const html = await render({
      tipo: 'parrafo',
      texto: both([
        { entidad: { tipo: 'item', id: 'fire-stone' } },
        ' y ',
        { entidad: { tipo: 'item', id: 'nada' }, texto: 'Enhanced Normal Stone' },
        '.',
      ]),
    });

    expect(html).toContain('ac-nested-entity');
    expect(html).toContain('role="tooltip"');
    // The second mention is plain text in the sentence.
    expect(html).toContain(' y Enhanced Normal Stone.');
    expect(html.match(/aria-describedby=/g) ?? []).toHaveLength(1);
  });

  it('writes the text of a step without sprite and of a point inside a paragraph (13.7)', async () => {
    const steps = await render({
      tipo: 'pasos',
      pasos: [
        { sprite: null, texto: both(['La ', { ancla: 'bandas', texto: 'banda' }, '.']) },
        { sprite: null, texto: both(['Usa la piedra.']) },
      ],
    });
    const points = await render({
      tipo: 'lista',
      puntos: [both(['Ver ', { ruta: '/pokedex/', texto: 'Pokédex' }, '.'])],
    });

    expect(steps).toContain('<ol class="ac-system-block__steps">');
    expect(steps).toMatch(
      /<li><p class="ac-system-block__item-text">La <a class="ac-text-link ac-text-link--prose" href="#bandas">banda<\/a>\.<\/p><\/li>/,
    );
    expect(points).toMatch(
      /<li><p class="ac-system-block__item-text">Ver <a [^>]*href="\/es\/pokedex\/">Pokédex<\/a>\.<\/p><\/li>/,
    );
  });

  it('draws the Timeline only when every step has a sprite, with the generated label', async () => {
    const withSprites: BlockContext = {
      ...context,
      sprite: (key) => (key === null ? null : { src: `/sprites/${key}.png`, size: [32, 32] }),
    };
    const html = await container.renderToString(Block, {
      props: {
        block: {
          tipo: 'pasos',
          pasos: [
            { sprite: 'a', texto: both(['Uno.']) },
            { sprite: 'b', texto: both(['Dos.']), chips: [both(['+1 de Boost'])] },
          ],
        },
        context: withSprites,
      },
    });

    expect(html).toContain('<ol class="ac-timeline">');
    expect(html).toContain('<p class="ac-timeline__label">Paso 1:</p>');
    expect(html).toContain('<p class="ac-timeline__label">Paso 2:</p>');
    expect(html).toContain('ac-timeline__step--last');
    expect(html).toContain('+1 de Boost');
  });

  it('reads the column rules of a table from its cells', async () => {
    const mention = (id: string, texto: string) => ({
      entidad: { tipo: 'item' as const, id },
      texto,
    });
    const html = await render({
      tipo: 'tabla',
      caption: both('Stones por elemento'),
      columnas: [
        { titulo: both('Stone'), ancho: 210, conSprite: true },
        { titulo: both('Ítems') },
        { titulo: both('Probabilidad') },
      ],
      filas: [
        [
          both([{ entidad: { tipo: 'item', id: 'fire-stone' } }]),
          both([mention('cow-tail', 'Cow Tail'), ', ', mention('bull-tail', 'Bull Tail')]),
          50,
        ],
        [both([mention('ice-stone', 'Ice Stone')]), null, 40],
      ],
      variasLineas: true,
    });

    expect(html).toMatch(/<caption id="[^"]+" class="sr-only">Stones por elemento<\/caption>/);
    // A table with a sprite column has rows of 48, and `variasLineas` is `wrap`.
    expect(html).toContain('ac-data-table--rows-48');
    expect(html).toContain('ac-data-table--wrap');
    // Every entity of the sprite column keeps its 32 cell; one without a record, the missing mark.
    expect(html.match(/class="ac-system-block__sprite"/g) ?? []).toHaveLength(2);
    expect(html).toContain('ac-missing-sprite');
    // Names without a panel never break inside, and the comma stays with the name before it.
    expect(html).toContain(
      '<span class="ac-system-block__glue"><span class="ac-system-block__entity-static">Cow Tail</span>,</span>',
    );
    // A column of lists of links is 12/20 from the start of the cell; an unknown cell is «—».
    expect(html).toContain(
      'ac-data-table__cell ac-data-table__cell--left ac-data-table__cell--ui-loose">—</td>',
    );
    // A column of figures has tabular figures; the cells of a multi-line table may break.
    expect(html).toContain('<td class="ac-data-table__cell ac-data-table__cell--num">50</td>');
    expect(html).not.toContain('ac-data-table__cell--nowrap');
  });

  it('keeps every cell of a one-line table on its line, so a phone scrolls it (8.4.2)', async () => {
    const html = await render({
      tipo: 'tabla',
      caption: both('Bandas de Boost'),
      columnas: [{ titulo: both('Boost') }, { titulo: both('Probabilidad inicial') }],
      filas: [
        [{ es: ['+0 a +5'], en: ['+0 to +5'] }, both(['50%'])],
        [{ es: ['+5 a +10'], en: ['+5 to +10'] }, both(['40%'])],
      ],
    });

    const cells = html.match(/<td class="[^"]*"/g) ?? [];
    expect(cells).toHaveLength(4);
    for (const cell of cells) expect(cell).toContain('ac-data-table__cell--nowrap');
    expect(html).toContain('ac-data-table--scroll');
    expect(html).not.toContain('ac-data-table--wrap');
  });
});
