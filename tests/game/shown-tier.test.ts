import { describe, expect, it } from 'vitest';

import { shownTier, shownTierLabel } from '@/components/game/TierBadge';
import { pokemonUnknownSize } from '@/lib/content/pokemon-media';

describe('shownTier / shownTierLabel (plan «Tier tooltip»: ULTIMATE hidden)', () => {
  it('writes a visible tier as the game does', () => {
    expect(shownTier(3)).toBe('t3');
    expect(shownTierLabel(3)).toBe('T3');
    expect(shownTier('Legendary')).toBe('legendary');
    expect(shownTierLabel('Legendary')).toBe('Legendary');
  });

  it('hides ULTIMATE (content/tiers.json `visible: false`) and unknown tiers', () => {
    expect(shownTier('ULTIMATE')).toBeNull();
    expect(shownTierLabel('ULTIMATE')).toBeNull();
    expect(shownTierLabel(null)).toBeNull();
    expect(shownTierLabel(undefined)).toBeNull();
  });
});

describe('pokemonUnknownSize (plan «?»)', () => {
  it('draws the «?» at three quarters of the art, never under 16', () => {
    expect(pokemonUnknownSize(64)).toBe(48);
    expect(pokemonUnknownSize(40)).toBe(30);
    expect(pokemonUnknownSize(8)).toBe(16);
  });
});
