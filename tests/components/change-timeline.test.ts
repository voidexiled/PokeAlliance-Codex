import { getContainerRenderer } from '@astrojs/react/container-renderer';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { loadRenderers } from 'astro:container';
import { beforeAll, describe, expect, it } from 'vitest';

import ChangeTimeline, {
  type ChangeEntry,
  type ChangeTimelineLabels,
} from '@/components/changes/ChangeTimeline.astro';
import type { Locale } from '@/i18n/config';
import { en } from '@/i18n/messages/en';
import { es } from '@/i18n/messages/es';
import { itemTip, pokemonTip, systemTip } from '@/lib/game/tips';

// ChangeTimeline (spec 8.7 step 4, 7.2.8): the steps of one month of content/cambios.json on its
// rendered markup (§14.2, Container API), with synthetic entries and panels, so the test does not
// depend on what the owner has published: the node sprite, the date with its colon read as a
// calendar day, the points under the text and the chips of R2.

let container: AstroContainer;

beforeAll(async () => {
  container = await AstroContainer.create({
    renderers: await loadRenderers([getContainerRenderer()]),
  });
});

const LABELS: Record<Locale, ChangeTimelineLabels> = {
  es: {
    dateLabel: es.changes.dateLabel,
    pinHint: es.ui.pinHint,
    shiny: es.ui.shiny,
    or: es.ui.or,
  },
  en: {
    dateLabel: en.changes.dateLabel,
    pinHint: en.ui.pinHint,
    shiny: en.ui.shiny,
    or: en.ui.or,
  },
};

const charizard = pokemonTip(
  {
    id: 'charizard',
    nombre: 'Charizard',
    variante: 'normal',
    nivel: 80,
    tier: 3,
    generacion: 1,
    funcion: 'PVE',
    imagen: null,
    elementos: [{ nombre: { es: 'Fuego', en: 'Fire' } }],
  },
  'es',
  es.ui.tooltip,
);

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

/** A system panel with no row: R2 leaves the chip as text. */
const emptySystem = systemTip(
  { id: 'boost', titulo: { es: 'Boost', en: 'Boost' }, sprite: null, tooltip: [] },
  'es',
);

const sprite = { src: '/sprites/x.png', size: [32, 32] as [number, number] };
const art = { src: '/sprites/icon.png', size: [100, 80] as [number, number], smooth: true };

function entries(): ChangeEntry[] {
  return [
    {
      id: 'b',
      date: '2026-09-01',
      title: 'Nuevo Boost',
      points: ['Punto uno', 'Punto dos'],
      sprite,
      entities: [
        { text: 'Charizard', tip: charizard, href: '/es/pokedex/charizard/' },
        { text: 'Fire Stone', tip: stone },
        { text: 'Boost', tip: emptySystem, href: '/es/sistemas/boost/' },
        { text: 'Porygon Quest: Dr. Vektor', tip: null },
      ],
    },
    { id: 'a', date: '2026-09-18', title: 'Sin puntos', points: [], sprite: null, entities: [] },
    { id: 'c', date: '2026-09-30', title: 'Arte', points: [], sprite: art, entities: [] },
  ];
}

async function render(locale: Locale): Promise<string> {
  return container.renderToString(ChangeTimeline, {
    props: { entries: entries(), locale, labels: LABELS[locale] },
  });
}

describe('ChangeTimeline', () => {
  it('writes one step per entry, in the given order, with the date and its colon', async () => {
    const html = await render('es');
    expect(html.match(/class="ac-timeline__step/g)).toHaveLength(3);
    const labels = [...html.matchAll(/<p class="ac-timeline__label">([^<]*)<\/p>/g)].map(
      (match) => match[1],
    );
    // A calendar day is read in UTC: 1 September never becomes 31 August in Brasília time.
    expect(labels).toEqual(['01/09/2026:', '18/09/2026:', '30/09/2026:']);
    expect(html).toMatch(/ac-timeline__step--last/);
  });

  it('writes the English date in en', async () => {
    const html = await render('en');
    const labels = [...html.matchAll(/<p class="ac-timeline__label">([^<]*)<\/p>/g)].map(
      (match) => match[1],
    );
    expect(labels).toEqual(['Sep 1, 2026:', 'Sep 18, 2026:', 'Sep 30, 2026:']);
  });

  it('puts the points in a plain list under the text, before the chips (7.2.8)', async () => {
    const html = await render('es');
    expect(html).toMatch(
      /<p class="ac-timeline__text">Nuevo Boost<\/p><ul><li>Punto uno<\/li><li>Punto dos<\/li><\/ul><ul class="ac-timeline__chips">/,
    );
    // A change without points has no list.
    expect(html).toMatch(/<p class="ac-timeline__text">Sin puntos<\/p><\/div>/);
  });

  it('opens a panel from an entity chip and leaves the others as text (R2)', async () => {
    const html = await render('es');
    const chips = /<ul class="ac-timeline__chips">([\s\S]*?)<\/ul><\/div><\/li>/.exec(html)?.[1];
    expect(chips).toBeDefined();
    // Charizard: a link with its panel.
    expect(chips).toMatch(
      /<a href="\/es\/pokedex\/charizard\/" class="ac-nested-entity__trigger ac-nested-entity__trigger--chip-text" aria-describedby="[^"]+">Charizard<\/a>/,
    );
    // Fire Stone: an item has no page, so its trigger is a button.
    expect(chips).toMatch(
      /<button type="button" class="ac-nested-entity__trigger ac-nested-entity__trigger--chip-text" aria-describedby="[^"]+">Fire Stone<\/button>/,
    );
    expect(chips?.match(/role="tooltip"/g)).toHaveLength(2);
    // A panel with no row and an activity: text chips with no link and no button.
    expect(chips).toMatch(/<span class="ac-chip">Boost<\/span>/);
    expect(chips).toMatch(/<span class="ac-chip">Porygon Quest: Dr\. Vektor<\/span>/);
    expect(chips).not.toContain('/es/sistemas/boost/');
    expect(chips).toContain(es.ui.pinHint);
  });

  it('draws the node sprite at 1x, the missing mark for null and an illustration at 20', async () => {
    const html = await render('es');
    const nodes = [...html.matchAll(/<div class="ac-timeline__node">([\s\S]*?)<\/div>/g)].map(
      (match) => match[1] ?? '',
    );
    expect(nodes).toHaveLength(3);
    expect(nodes[0]).toMatch(/<img[^>]*src="\/sprites\/x\.png"[^>]*width="32"[^>]*height="32"/);
    expect(nodes[1]).toContain('ac-missing-sprite');
    expect(nodes[2]).toMatch(/<img[^>]*ac-sprite--smooth[^>]*width="20"[^>]*height="16"/);
  });

  it('draws nothing without entries', async () => {
    const html = await container.renderToString(ChangeTimeline, {
      props: { entries: [], locale: 'es', labels: LABELS.es },
    });
    expect(html.trim()).toBe('');
  });
});
