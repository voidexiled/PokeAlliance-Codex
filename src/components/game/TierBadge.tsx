import '@/styles/components/tier-badge.css';

import { formatTier } from '@/lib/content/format';
import { tierKey } from '@/lib/content/tier-rank';
import type { PokemonTier } from '@/lib/content/types';

// TierBadge (spec 16.3.6): the tier as a pill in the colour of its step of the hierarchy
// (16.2.1). Numeric tiers go from light grey (T1) to dim grey (T7); every special tier has its
// own `--tier-*` token. `mini` is the corner mark of an EntitySlot: the short form, with the
// full tier as its accessible name. An unknown tier draws nothing.

const SHORT: Record<string, string> = {
  ultimate: 'ULT',
  mythic: 'MY',
  legendary: 'LG',
  'ultra-rare': 'UR',
  'super-rare': 'SR',
};

interface TierBadgeProps {
  tier: PokemonTier | null | undefined;
  size?: 'md' | 'mini';
  className?: string;
}

export function TierBadge({ tier, size = 'md', className }: TierBadgeProps) {
  const key = tierKey(tier);
  if (key === null) return null;
  const label = formatTier(tier);
  const classes = ['ac-tier-badge', `ac-tier-badge--${key}`];
  if (size === 'mini') classes.push('ac-tier-badge--mini');
  if (className) classes.push(className);
  if (size === 'mini') {
    return (
      <span className={classes.join(' ')} role="img" aria-label={label} title={label}>
        {SHORT[key] ?? label}
      </span>
    );
  }
  return <span className={classes.join(' ')}>{label}</span>;
}
