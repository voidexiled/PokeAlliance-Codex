import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { DexCard } from '@/components/cards/DexCard';
import type { DexCardDrop, DexCardEntry, DexCardLabels } from '@/components/cards/DexCard';
import { es } from '@/i18n/messages/es';
import { dexLayout } from '@/lib/cards/layout';
import type { TipData } from '@/lib/game/tips';

// C7-09, the half the rendered markup answers (spec 7.6.4): one DOM serves both anatomies of
// the Pokédex card, so each drop carries the form it takes in each one, and the two «+N» are
// there with their own lists. tests/e2e/lists.spec.ts checks the other half — the container
// query at 358 without JavaScript, the caps a reader sees and that nothing hidden takes the
// focus — over the drops of the board, none of which has more than six.

const labels: DexCardLabels = {
  ...es.ui.cards,
  requirement: es.ui.tooltip.requirement,
  level: es.ui.tooltip.level,
  tier: es.ui.tooltip.tier,
  role: es.ui.tooltip.role,
  shiny: es.ui.shiny,
};

function tip(name: string): TipData {
  return {
    key: `item:${name}`,
    title: name,
    width: 282,
    head: { type: 'sprite', sprite: null },
    rows: [{ label: es.ui.tooltip.droppedBy, value: '1 Pokémon' }],
  };
}

function drop(name: string, withSprite: boolean): DexCardDrop {
  return {
    name,
    sprite: withSprite ? { src: `/sprites/items/${name}.png`, size: [32, 32], frames: 1 } : null,
    tip: tip(name),
  };
}

interface Li {
  regular: string | null;
  compact: string | null;
  variant: string | null;
  /** The first accessible name inside the item: the drop's trigger, or the «+N» button. */
  label: string | null;
  html: string;
}

/** The items of the drop strip, read from the markup (the unit tests run without a DOM). */
function render(drops: DexCardDrop[]): Li[] {
  const entry: DexCardEntry = {
    name: 'Charizard',
    href: '/es/pokedex/charizard/',
    number: 6,
    generation: 1,
    art: null,
    level: 80,
    tier: 'T3',
    role: 'PVE',
    variant: 'normal',
    drops,
  };
  const html = renderToStaticMarkup(
    <DexCard entry={entry} layout={dexLayout([entry])} labels={labels} locale="es" hint="" />,
  );
  return html
    .split('<li class="ac-dex-card__li"')
    .slice(1)
    .map((chunk) => {
      const head = chunk.slice(0, chunk.indexOf('>'));
      const attribute = (name: string) => new RegExp(`${name}="([^"]*)"`).exec(head)?.[1] ?? null;
      return {
        regular: attribute('data-regular'),
        compact: attribute('data-compact'),
        variant: attribute('data-variant'),
        label: /aria-label="([^"]*)"/.exec(chunk)?.[1] ?? null,
        html: chunk,
      };
    });
}

const count = (items: Li[], test: (item: Li) => boolean) => items.filter(test).length;

describe('DexCard drops (C7-09, 7.6.4)', () => {
  // Three drops with a sprite and six without: past every cap of both anatomies.
  const many = [
    drop('fire-stone', true),
    drop('Essence of Fire', false),
    drop('feather-stone', true),
    drop('Straw', false),
    drop('Fire Wing', false),
    drop('Dark Wing', false),
    drop('thunder-stone', true),
    drop('Mythic Fire Orb', false),
    drop('Screw', false),
  ];

  it('regular: every drop with a sprite is a slot and at most 3 named chips, 2 and «+N» past it', () => {
    const items = render(many);
    expect(count(items, (li) => li.regular === 'slot')).toBe(3);
    expect(count(items, (li) => li.regular === 'chip')).toBe(2);
    expect(count(items, (li) => li.regular === 'hidden')).toBe(4);
    const more = items.find((li) => li.variant === 'regular');
    expect(more?.html).toContain('>+4</button>');
    expect(more?.label).toBe('4 drops más: Fire Wing, Dark Wing, Mythic Fire Orb, Screw');
  });

  it('compact: slots only, 5 and a square «+N» of 36 past 6', () => {
    const items = render(many);
    expect(count(items, (li) => li.compact === 'slot')).toBe(5);
    expect(count(items, (li) => li.compact === 'hidden')).toBe(4);
    const more = items.find((li) => li.variant === 'compact');
    expect(more?.html).toContain('class="ac-plus-n ac-plus-n--square ac-plus-n--s36"');
    expect(more?.html).toContain('>+4</button>');
  });

  it('one order serves both: the drops with a sprite first, then the rest', () => {
    const names = render(many)
      .filter((li) => li.variant === null)
      .map((li) => li.label);
    expect(names).toEqual([
      'fire-stone',
      'feather-stone',
      'thunder-stone',
      'Essence of Fire',
      'Straw',
      'Fire Wing',
      'Dark Wing',
      'Mythic Fire Orb',
      'Screw',
    ]);
  });

  it('up to 6 drops and 3 named ones need no «+N» in either anatomy', () => {
    const items = render(many.slice(0, 5));
    expect(count(items, (li) => li.compact === 'slot')).toBe(5);
    expect(count(items, (li) => li.regular === 'chip')).toBe(3);
    expect(count(items, (li) => li.variant !== null)).toBe(0);
  });

  it('every trigger names its drop, a slot included', () => {
    for (const li of render(many).filter((item) => item.variant === null)) {
      expect(li.html).toContain('aria-describedby=');
      expect(li.label).toBeTruthy();
    }
  });
});
