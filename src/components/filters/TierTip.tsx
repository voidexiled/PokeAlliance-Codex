import '@/styles/components/filter-tip.css';

import { UNKNOWN } from '@/lib/format/unknown';

// TierTip (the Tier menu of the filter bar and the Tier list labels): a CSS tooltip in the game
// tooltip style — the tier name spaced in capitals and «Max brokes:» in the label gold — shown
// on hover or focus of its trigger, with no «Mantén Shift» strip. «Max brokes» is `—` until the
// tiers registry has it. Neither place clips it; the Tier value of a card or a Lista row, whose
// overflow could, is `TierValue` of src/components/game/TierBadge.tsx (a top-layer popover).

export interface TierTipData {
  /** The tier's name as the game writes it («Legendary», «T3»). */
  name: string;
  /** `null` = unknown, shown as «—». */
  maxBrokes: number | null;
}

export interface TierTipProps extends TierTipData {
  id: string;
  /** «Max brokes» (`ui.filterBar.maxBrokes`). */
  label: string;
  /** Where it opens from its trigger: over it, at its right (Tier list) or under it (cards). */
  placement?: 'up' | 'right' | 'down';
}

export function TierTip({ id, name, maxBrokes, label, placement = 'up' }: TierTipProps) {
  return (
    <span id={id} role="tooltip" className={`ac-tier-tip ac-tier-tip--${placement}`}>
      <span className="ac-tier-tip__title">{name}</span>
      <span className="ac-tier-tip__row">
        <span className="ac-tier-tip__label">{label}:</span>
        <span className="ac-tier-tip__value">{maxBrokes ?? UNKNOWN}</span>
      </span>
    </span>
  );
}
