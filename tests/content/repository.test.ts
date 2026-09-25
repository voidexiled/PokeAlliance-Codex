import { describe, expect, it } from 'vitest';
import { formatTier, getCatalogMetrics, getPokemonById } from '../../src/lib/content/repository';

describe('content repository', () => {
  it('loads a Pokémon record from content/', () => {
    const record = getPokemonById('chimchar');

    expect(record?.nombre).toBe('Chimchar');
    expect(record?.numero).toBe(390);
    expect(record?.elementos).toContain('fire');
  });

  it('keeps unknown values as null and renders them as a dash', () => {
    const withoutTier = getPokemonById('piplup');

    expect(withoutTier?.tier).toBeNull();
    expect(formatTier(withoutTier?.tier)).toBe('—');
    expect(formatTier(6)).toBe('T6');
    expect(formatTier('ULTIMATE')).toBe('ULTIMATE');
  });

  it('reports the catalog shape', () => {
    const metrics = getCatalogMetrics();

    expect(metrics.collections).toBe(6);
    expect(metrics.records).toBe(1669);
  });
});
