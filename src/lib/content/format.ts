// Display helpers for content values. Unknown values show as "—". Safe for
// React islands (no data, no Zod).
import type { PokemonTier } from './types';

export function formatTier(tier: PokemonTier | null | undefined): string {
  if (tier === null || tier === undefined || tier === '') return '—';
  return typeof tier === 'number' ? `T${tier}` : tier;
}

export function formatList(values: string[]): string {
  return values.length ? values.join(', ') : '—';
}
