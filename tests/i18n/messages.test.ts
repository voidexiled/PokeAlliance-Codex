import { describe, expect, it, vi } from 'vitest';

import { dynamicKeys } from '@/i18n/dynamic-keys';
import { en } from '@/i18n/messages/en';
import { es } from '@/i18n/messages/es';
import type { MessageLeaf, MessageTree } from '@/i18n/messages/types';
import { fill, isPluralMessage, messageAt, messageKeys, plural } from '@/i18n/messages/types';

const esTree = es as MessageTree;
const enTree = en as MessageTree;

/** Every string a leaf renders: one for a plain message, two for a plural. */
function leafStrings(leaf: MessageLeaf): string[] {
  return isPluralMessage(leaf) ? [leaf.one, leaf.other] : [leaf];
}

function placeholders(leaf: MessageLeaf): string[] {
  const names = new Set<string>();
  for (const value of leafStrings(leaf)) {
    for (const match of value.matchAll(/\{(\w+)\}/g)) {
      names.add(match[1]);
    }
  }
  return [...names].sort();
}

describe('the dictionaries of es and en', () => {
  it('declare the same keys', () => {
    expect(messageKeys(enTree)).toEqual(messageKeys(esTree));
  });

  it('declare the namespaces of the spec', () => {
    expect(Object.keys(es)).toEqual([
      'ui',
      'shell',
      'home',
      'search',
      'picker',
      'pokedex',
      'pokemon',
      'tiers',
      'items',
      'item',
      'systems',
      'activities',
      'changes',
      'tools',
      'compare',
      'guild',
      'account',
      'profile',
      'trade',
      'map',
      'errors',
      'format',
      'seo',
    ]);
    expect(Object.keys(en)).toEqual(Object.keys(es));
  });

  it('have no empty leaf', () => {
    const empty: string[] = [];
    for (const key of messageKeys(esTree)) {
      for (const [locale, tree] of [
        ['es', esTree],
        ['en', enTree],
      ] as const) {
        const leaf = messageAt(tree, key);
        if (leaf === undefined || leafStrings(leaf).some((value) => value.trim() === '')) {
          empty.push(`${locale}: ${key}`);
        }
      }
    }
    expect(empty).toEqual([]);
  });

  it('carry the same placeholders in each pair', () => {
    const mismatched: string[] = [];
    for (const key of messageKeys(esTree)) {
      const source = placeholders(messageAt(esTree, key) as MessageLeaf);
      const target = placeholders(messageAt(enTree, key) as MessageLeaf);
      if (source.join(',') !== target.join(',')) {
        mismatched.push(`${key}: es {${source}} vs en {${target}}`);
      }
    }
    expect(mismatched).toEqual([]);
  });

  it('declare a plural in both languages or in neither', () => {
    const mismatched: string[] = [];
    for (const key of messageKeys(esTree)) {
      const source = messageAt(esTree, key) as MessageLeaf;
      const target = messageAt(enTree, key) as MessageLeaf;
      if (isPluralMessage(source) !== isPluralMessage(target)) {
        mismatched.push(key);
      }
    }
    expect(mismatched).toEqual([]);
  });

  it('only declare dynamic keys that still exist', () => {
    for (const key of dynamicKeys as readonly string[]) {
      expect(messageAt(esTree, key), `${key} is gone from es.ts`).toBeDefined();
    }
  });
});

describe('fill', () => {
  it('replaces every placeholder', () => {
    expect(fill('{n} variantes', { n: '20' })).toBe('20 variantes');
    expect(fill('{a} normales · {b} Shiny', { a: '10', b: '10' })).toBe('10 normales · 10 Shiny');
  });

  it('accepts numbers and repeated placeholders', () => {
    expect(fill('{n} de {n}', { n: 3 })).toBe('3 de 3');
  });

  it('leaves a message without placeholders untouched', () => {
    expect(fill('Cerrar', {})).toBe('Cerrar');
  });

  it('fails in development when a variable is missing', () => {
    expect(() => fill('{n} variantes', {})).toThrow(/missing variable "n"/);
  });

  it('keeps the raw placeholder in production instead of rendering nothing', () => {
    vi.stubEnv('DEV', false);
    try {
      expect(fill('{n} variantes', {})).toBe('{n} variantes');
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe('plural', () => {
  const variants = { one: '{n} variante', other: '{n} variantes' };

  it('picks the form with Intl.PluralRules', () => {
    expect(plural('es', 1, variants)).toBe('{n} variante');
    expect(plural('es', 0, variants)).toBe('{n} variantes');
    expect(plural('es', 20, variants)).toBe('{n} variantes');
    expect(plural('en', 1, variants)).toBe('{n} variante');
    expect(plural('en', 2, variants)).toBe('{n} variantes');
  });

  it('returns the template so the caller fills the formatted number', () => {
    expect(fill(plural('es', 1200, variants), { n: '1.200' })).toBe('1.200 variantes');
  });
});

describe('messageKeys and messageAt', () => {
  const tree = {
    ui: { close: 'Cerrar', views: { cards: 'Cards' } },
    pokedex: { variants: { one: '{n} variante', other: '{n} variantes' } },
  } as const satisfies MessageTree;

  it('walks the tree down to the leaves, plurals included', () => {
    expect(messageKeys(tree)).toEqual(['ui.close', 'ui.views.cards', 'pokedex.variants']);
  });

  it('reads a leaf by its dotted path', () => {
    expect(messageAt(tree, 'ui.views.cards')).toBe('Cards');
    expect(messageAt(tree, 'pokedex.variants')).toEqual({
      one: '{n} variante',
      other: '{n} variantes',
    });
  });

  it('returns undefined for a namespace or a path that does not exist', () => {
    expect(messageAt(tree, 'ui.views')).toBeUndefined();
    expect(messageAt(tree, 'ui.missing')).toBeUndefined();
    expect(messageAt(tree, 'ui.close.deeper')).toBeUndefined();
  });
});
