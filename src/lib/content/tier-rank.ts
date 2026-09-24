// Tier hierarchy of PokeAlliance (spec 16.2.1), best to worst. Safe for React islands: no
// data and no Zod. Everything that sorts or groups by tier reads this list: the Tier list
// groups, the options of the «Tier» filter and the «Tier» order of the lists.
import type { PokemonTier } from './types';

/** Best to worst. Specials are canonical game names; numbers are the numeric tiers T1…T7. */
export const TIER_ORDER = [
  'ULTIMATE',
  'Mythic',
  'Legendary',
  'Ultra Rare',
  'Super Rare',
  1,
  2,
  3,
  4,
  5,
  6,
  7,
] as const;

export type RankedTier = (typeof TIER_ORDER)[number];

const SPECIAL_KEYS = new Map<string, number>(
  TIER_ORDER.flatMap((tier, index) =>
    typeof tier === 'string' ? [[tier.toLowerCase(), index] as [string, number]] : [],
  ),
);

/** The ranked tier a stored value stands for: `3`, `"3"` and `"T3"` are T3. */
export function normalizeTier(tier: PokemonTier | null | undefined): RankedTier | null {
  if (tier === null || tier === undefined || tier === '') return null;
  if (typeof tier === 'number') {
    return TIER_ORDER.includes(tier as RankedTier) ? (tier as RankedTier) : null;
  }
  const text = tier.trim();
  const numeric = /^t?(\d+)$/i.exec(text);
  if (numeric) return normalizeTier(Number(numeric[1]));
  const index = SPECIAL_KEYS.get(text.toLowerCase());
  return index === undefined ? null : TIER_ORDER[index];
}

/** 0 is the best tier; an unknown or unrecognised tier sorts after every known one. */
export function tierRank(tier: PokemonTier | null | undefined): number {
  const ranked = normalizeTier(tier);
  return ranked === null ? TIER_ORDER.length : TIER_ORDER.indexOf(ranked);
}

/** Array.sort comparator, best tier first. */
export function compareTierRank(
  a: PokemonTier | null | undefined,
  b: PokemonTier | null | undefined,
): number {
  return tierRank(a) - tierRank(b);
}

/** Stable kebab key of a tier (`t3`, `super-rare`, `ultimate`), used by CSS tokens and filters. */
export function tierKey(tier: PokemonTier | null | undefined): string | null {
  const ranked = normalizeTier(tier);
  if (ranked === null) return null;
  return typeof ranked === 'number' ? `t${ranked}` : ranked.toLowerCase().replace(/\s+/g, '-');
}
