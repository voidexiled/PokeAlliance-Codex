import '@/styles/components/filter-tip.css';

// TierTip (the Tier menu of the filter bar and the Tier list labels): a CSS tooltip in the game
// tooltip style — the tier name spaced in capitals and «Max brokes:» in the label gold — shown
// on hover or focus of its trigger, with no «Mantén Shift» strip. While the tiers registry does
// not have the «Max brokes» figure the tooltip would only repeat its trigger, so it is not drawn
// and the caller drops its `aria-describedby` and underline (`hasTierTip`). Neither
// place clips it; the Tier value of a card or a Lista row, whose
// overflow could, is `TierValue` of src/components/game/TierBadge.tsx (a top-layer popover).

export interface TierTipData {
  /** The tier's name as the game writes it («Legendary», «T3»). */
  name: string;
  /** `null` = unknown: there is then no tooltip. */
  maxBrokes: number | null;
}

export interface TierTipProps extends TierTipData {
  id: string;
  /** «Max brokes» (`ui.filterBar.maxBrokes`). */
  label: string;
  /** Where it opens from its trigger: over it, at its right (Tier list) or under it (cards). */
  placement?: 'up' | 'right' | 'down';
}

/** Whether a tier has a tooltip: only once its «Max brokes» is known. */
export function hasTierTip(maxBrokes: number | null | undefined): maxBrokes is number {
  return typeof maxBrokes === 'number' && Number.isFinite(maxBrokes);
}

export function TierTip({ id, name, maxBrokes, label, placement = 'up' }: TierTipProps) {
  if (!hasTierTip(maxBrokes)) return null;
  return (
    <span id={id} role="tooltip" className={`ac-tier-tip ac-tier-tip--${placement}`}>
      <span className="ac-tier-tip__title">{name}</span>
      <span className="ac-tier-tip__row">
        <span className="ac-tier-tip__label">{label}:</span>
        <span className="ac-tier-tip__value">{maxBrokes}</span>
      </span>
    </span>
  );
}
