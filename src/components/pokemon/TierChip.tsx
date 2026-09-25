import { TierBadge, TierTipTrigger, shownTierLabel } from '@/components/game/TierBadge';
import type { Locale } from '@/i18n/config';
import type { PokemonTier } from '@/lib/content/types';

// TierChip (design «Pokemon-pagina»): the tier of the Pokémon page hero, the `TierBadge` pill
// as a button described by its tier tooltip (`TierTipPanel`, «Max brokes»), which the
// delegated controller of 7.5.4 opens on hover and focus. Nothing for an unknown or hidden
// tier: the caller writes «—». A server component with no JavaScript of its own.

interface TierChipProps {
  tier: PokemonTier | null | undefined;
  /** «Max brokes» (13.4), `ui.filterBar.maxBrokes`. */
  maxBrokesLabel: string;
  locale: Locale;
}

export function TierChip({ tier, maxBrokesLabel, locale }: TierChipProps) {
  if (shownTierLabel(tier) === null) return null;
  return (
    <TierTipTrigger tier={tier} maxBrokesLabel={maxBrokesLabel} locale={locale} align="start">
      {(id) => (
        <button
          type="button"
          className="ac-nested-entity__trigger ac-tier-chip"
          aria-describedby={id}
        >
          <TierBadge tier={tier} />
        </button>
      )}
    </TierTipTrigger>
  );
}
