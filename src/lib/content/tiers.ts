// Client-safe access to content/tiers.json (owner registry, spec 16.2.1): the canonical name,
// rank, maxBrokes and visibility of every tier. Read directly with no Zod, like
// src/lib/sprites/registry.ts reads sprites.json; pnpm content:check and the Zod mirror of
// registry-schema.ts (tiersFileSchema) validate the file at build time, so a React island can
// import this module without bundling Zod. Everything that shows a tier's maxBrokes (the tier
// tooltip) or needs the tiers a Tier filter or a Tier list may offer (ULTIMATE hidden, spec
// 16.2.1) reads this module instead of content/tiers.json directly.
import tiersFile from '@content/tiers.json';

import { tierKey } from './tier-rank';
import type { PokemonTier } from './types';
import type { TierRecord } from './registry-schema';

const tiers = tiersFile.tiers as unknown as TierRecord[];

/** content/tiers.json indexed by id (`t3`, `super-rare`, `ultimate`…), tierKey()'s own keys. */
const byId = new Map(tiers.map((tier) => [tier.id, tier]));

/**
 * Every tier with `visible: true` (every tier but ULTIMATE today), best first by `orden`. The
 * Tier filter and the Tier list read this instead of content/tiers.json so a hidden tier never
 * reaches either one, while a Pokémon of that tier keeps its data (spec 16.2.1).
 */
export const visibleTiers: TierRecord[] = tiers
  .filter((tier) => tier.visible)
  .slice()
  .sort((a, b) => a.orden - b.orden);

/**
 * The content/tiers.json record a Pokémon's `tier` maps to, or `null` while the value is empty
 * or unrecognised. Used for the tier tooltip's «Max brokes» row and to tell a hidden tier
 * (`visible: false`) from a shown one wherever a tier is drawn.
 */
export function tierInfo(tier: PokemonTier | null | undefined): TierRecord | null {
  const key = tierKey(tier);
  return key === null ? null : (byId.get(key) ?? null);
}
