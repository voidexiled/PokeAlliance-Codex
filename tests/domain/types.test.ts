import { describe, expect, it } from 'vitest';

import { claimStatuses, entityTypes } from '@/lib/domain/types';

describe('canonical domain contract', () => {
  it('keeps the application entity taxonomy aligned with the Phase 2 model', () => {
    expect(entityTypes).toContain('pokemon_species');
    expect(entityTypes).toContain('pokemon_variant');
    expect(entityTypes).toContain('guide');
    expect(entityTypes).not.toContain('map_feature');
  });

  it('keeps uncertainty explicit', () => {
    expect(claimStatuses).toEqual(
      expect.arrayContaining(['confirmed', 'supported', 'inferred', 'unknown', 'conflicted']),
    );
  });
});
