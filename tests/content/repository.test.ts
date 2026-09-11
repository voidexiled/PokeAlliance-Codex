import { describe, expect, it } from 'vitest';
import {
  getCatalogMetrics,
  getRecord,
  getRecordEvidence,
  searchRecords,
} from '../../src/lib/content/repository';

describe('content repository', () => {
  it('loads a normalized Pokémon record with linked provenance', () => {
    const record = getRecord('pokemon', 'chimchar');

    expect(record?.canonicalName).toBe('Chimchar');
    expect(record?.pokedexNumber).toBe(390);
    expect(getRecordEvidence(record!)).toHaveLength(1);
  });

  it('searches across normalized collections without accents', () => {
    const results = searchRecords('PORYGON', 'es');

    expect(results.map((result) => result.record.canonicalSlug)).toContain(
      'porygon-quest-dr-vektor',
    );
  });

  it('reports the catalog shape instead of inventing coverage', () => {
    const metrics = getCatalogMetrics();

    expect(metrics.collections).toBe(6);
    expect(metrics.records).toBe(6);
    expect(metrics.sources).toBe(10);
    expect(metrics.evidence).toBe(20);
  });
});
