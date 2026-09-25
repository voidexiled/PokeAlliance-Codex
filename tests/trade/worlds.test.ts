// The world rule of Comercio (owner rule 2026-09-24): Pokémon, Items and Diamonds trade only
// inside the world of the seller's character; Pokédólares sell to every world, so the «Mundo»
// filter of the list keeps them under any world.
import mundos from '@content/mundos.json';
import { describe, expect, it } from 'vitest';

import { TIPOS_ACTIVO, listedInWorld, tradesAcrossWorlds } from '@/lib/trade/types';

describe('worlds of a listing', () => {
  it('only Pokédólares sell across worlds', () => {
    expect(TIPOS_ACTIVO.filter(tradesAcrossWorlds)).toEqual(['pokedolares']);
  });

  it('the «Mundo» filter shows that world and every Pokédólares listing', () => {
    const ids = mundos.mundos.map((world) => world.id);
    for (const world of ids) {
      expect(listedInWorld({ tipo: 'pokedolares', mundo: 'titan-1' }, world)).toBe(true);
      for (const tipo of ['pokemon', 'items', 'diamonds'] as const) {
        expect(listedInWorld({ tipo, mundo: 'titan-1' }, world)).toBe(world === 'titan-1');
      }
    }
  });
});
