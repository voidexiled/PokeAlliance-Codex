import { getContainerRenderer } from '@astrojs/react/container-renderer';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { loadRenderers } from 'astro:container';
import { beforeAll, describe, expect, it } from 'vitest';

import EvolutionChain, {
  type EvolutionStage,
  type EvolutionStep,
} from '@/components/pokemon/EvolutionChain.astro';
import { es } from '@/i18n/messages/es';
import { itemTip, pokemonTip } from '@/lib/game/tips';

// EvolutionChain (spec 7.2.7, 8.3; DS:EvolutionChain) on its rendered markup (§14.2): the
// current stage, the stages and items that open a panel and the ones that do not (R2), the
// missing mark of a stage without an outfit, and the hidden «Evoluciona con:» that only a
// connector with something to introduce carries. The Pokémon page draws it only for a
// registry with `evolucion`, which content/ does not have yet, so its page tests cannot.

let container: AstroContainer;

beforeAll(async () => {
  container = await AstroContainer.create({
    renderers: await loadRenderers([getContainerRenderer()]),
  });
});

const labels = es.ui.tooltip;
const texts = {
  labels: { evolvesWith: es.pokemon.evolvesWith },
  locale: 'es',
  hint: es.ui.pinHint,
};

const tipOf = (id: string, nombre: string, nivel: number | null) =>
  pokemonTip(
    {
      id,
      nombre,
      variante: 'normal',
      nivel,
      tier: null,
      generacion: null,
      funcion: null,
      imagen: null,
      elementos: [],
    },
    'es',
    labels,
  );

const stone = itemTip(
  {
    id: 'stone',
    nombre: 'Stone',
    categoria: 'stones',
    sprite: null,
    precioNpc: { vende: 1500, compra: null },
  },
  'es',
  labels,
);

const pixel = { src: '/sprites/outfits/frame.png', size: [32, 32] as [number, number] };

async function render(stages: EvolutionStage[], steps: EvolutionStep[]): Promise<string> {
  return container.renderToString(EvolutionChain, { props: { stages, steps, ...texts } });
}

describe('EvolutionChain', () => {
  it('draws nothing with fewer than two stages', async () => {
    const html = await render([{ name: 'Alpha', sprite: null, current: true }], []);
    expect(html).not.toContain('ac-evolution-chain');
  });

  it('marks the current stage on its name, with no link and no panel', async () => {
    const html = await render(
      [
        {
          name: 'Alpha',
          sprite: pixel,
          href: '/es/pokedex/alpha/',
          tip: tipOf('alpha', 'Alpha', 1),
        },
        { name: 'Beta', sprite: null, current: true, meta: 'Nivel 40' },
      ],
      [{ requirement: 'Nivel 40 del Pokémon', items: [] }],
    );
    const current = html.match(/<div[^>]*aria-current="page"[^>]*>([^<]*)<\/div>/);
    expect(current?.[1]).toBe('Beta');
    expect(html.match(/aria-current=/g)).toHaveLength(1);
    expect(html).not.toContain('href="/es/pokedex/beta/"');
    // The other stage opens its Pokémon panel from a link to its page (7.5.7).
    expect(html).toContain('href="/es/pokedex/alpha/"');
    expect(html).toContain('data-ac-tt');
    // A stage without an outfit keeps its frame with the missing mark (CGS §6.8).
    expect(html).toContain('ac-evolution-chain__missing');
    // A one-tile outfit fills the 64 cell at 2x (DS:guias/20).
    expect(html).toMatch(
      /<img[^>]*src="\/sprites\/outfits\/frame\.png"[^>]*width="64" height="64"/,
    );
  });

  it('writes «Evoluciona con:» only before a requirement or an item', async () => {
    const stages: EvolutionStage[] = [
      { name: 'Alpha', sprite: null, current: true },
      { name: 'Beta', sprite: null, href: '/es/pokedex/beta/' },
      { name: 'Gamma', sprite: null, href: '/es/pokedex/gamma/' },
    ];
    const withChips = await render(stages, [
      { requirement: null, items: [{ name: 'Stone', sprite: null, tip: stone }] },
      { requirement: 'Nivel 100 del Pokémon', items: [] },
    ]);
    expect(withChips.split(es.pokemon.evolvesWith)).toHaveLength(3);

    const bare = await render(stages, [
      { requirement: null, items: [] },
      { requirement: 'Nivel 100 del Pokémon', items: [] },
    ]);
    expect(bare.split(es.pokemon.evolvesWith)).toHaveLength(2);
    expect(bare.match(/ac-evolution-chain__step/g)).toHaveLength(2);
  });

  it('opens the panel of an item with rows and leaves a bare item as a plain chip (R2)', async () => {
    const empty = itemTip(
      {
        id: 'bare',
        nombre: 'Bare',
        categoria: 'stones',
        sprite: null,
        precioNpc: { vende: null, compra: null },
      },
      'es',
      labels,
    );
    const html = await render(
      [
        { name: 'Alpha', sprite: null, current: true },
        { name: 'Beta', sprite: null, href: '/es/pokedex/beta/' },
      ],
      [
        {
          requirement: null,
          items: [
            { name: 'Stone', sprite: null, tip: stone },
            { name: 'Bare', sprite: null, tip: empty },
          ],
        },
      ],
    );
    // An item has no page of its own (§15): its trigger is a button (7.5.7).
    expect(html).toMatch(/data-ac-tt[^>]*>\s*<button type="button"[^>]*>[\s\S]*?Stone/);
    expect(html).toMatch(/<span class="ac-chip">Bare<\/span>/);
    // A stage whose panel would be empty is a plain link to its page (R2).
    expect(html).toMatch(
      /<a class="ac-evolution-chain__link" href="\/es\/pokedex\/beta\/">Beta<\/a>/,
    );
  });
});
