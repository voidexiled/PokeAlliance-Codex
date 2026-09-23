import { describe, expect, it } from 'vitest';

import { entityTypes } from '@/lib/domain/types';

describe('domain contract', () => {
  it('keeps the application entity taxonomy aligned with the database enum', () => {
    expect(entityTypes).toContain('pokemon_species');
    expect(entityTypes).toContain('pokemon_variant');
    expect(entityTypes).toContain('guide');
    expect(entityTypes).not.toContain('map_feature');
  });
});
