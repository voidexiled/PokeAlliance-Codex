import '@/styles/components/tier-badge.css';

import { useId } from 'react';
import type { ReactNode } from 'react';

import type { NestedEntityAlign, NestedEntityPlacement } from '@/components/game/NestedEntity';
import type { Locale } from '@/i18n/config';
import { formatTier } from '@/lib/content/format';
import { tierKey } from '@/lib/content/tier-rank';
import { tierInfo } from '@/lib/content/tiers';
import type { PokemonTier } from '@/lib/content/types';
import { formatInteger } from '@/lib/format/numbers';
import { UNKNOWN } from '@/lib/format/unknown';

// The tier of a Pokémon as the site draws it (spec 16.2.1, 16.3.6; plan «Tier tooltip»).
//
// - `shownTier` / `shownTierLabel`: a tier the site shows. content/tiers.json hides ULTIMATE
//   (`visible: false`) for now, so a Pokémon of a hidden tier shows «—» everywhere a tier is
//   written, while its data stays. Every tier value, badge and tooltip goes through them.
// - `TierBadge`: the pill in the colour of its step of the hierarchy, kept only where the
//   boards keep it (a held item's corner mark). A grid or picker slot never carries one, and
//   the Cards and Lista facts write the tier as text (`TierValue`).
// - `TierTipPanel`: the tier tooltip in the game tooltip style — the name spaced in capitals
//   and one «Max brokes:» row, `—` until content/tiers.json has the figure — 184 wide, with
//   no «Mantén Shift» strip. It is the `popover="manual"` panel of the delegated controller
//   of 7.5.4 (src/scripts/game-tooltip.ts), so it opens on hover and keyboard focus of its
//   trigger, closes on Escape and sits in the top layer, out of any card or table overflow.
// - `TierValue`: the Tier value of a card, a Lista row or a Tier list label — its text with a
//   dotted underline, a button described by its `TierTipPanel`. The Tier menu of the filter
//   bar can wrap its own tier slot the same way (see `TierTipTrigger`).

const SHORT: Record<string, string> = {
  ultimate: 'ULT',
  mythic: 'MY',
  legendary: 'LG',
  'ultra-rare': 'UR',
  'super-rare': 'SR',
};

/** The `tierKey` of a tier the site shows, or `null`: unknown, or hidden by content/tiers.json. */
export function shownTier(tier: PokemonTier | null | undefined): string | null {
  const key = tierKey(tier);
  if (key === null) return null;
  return tierInfo(tier)?.visible === false ? null : key;
}

/** «T3», «Legendary» for a tier the site shows; `null` for an unknown or hidden one («—»). */
export function shownTierLabel(tier: PokemonTier | null | undefined): string | null {
  return shownTier(tier) === null ? null : formatTier(tier);
}

interface TierBadgeProps {
  tier: PokemonTier | null | undefined;
  size?: 'md' | 'mini';
  className?: string;
}

export function TierBadge({ tier, size = 'md', className }: TierBadgeProps) {
  const key = shownTier(tier);
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

export interface TierTipText {
  /** «Max brokes», a game term (13.4): the label of the tooltip's one row, colon added here. */
  maxBrokesLabel: string;
  /** Picks the format of the figure once content/tiers.json has it (C-R3). */
  locale: Locale;
}

export interface TierTipPanelProps extends TierTipText {
  /** Id the trigger's `aria-describedby` points at. */
  id: string;
  tier: PokemonTier | null | undefined;
}

/**
 * The tier tooltip. Phrasing content only, so it may sit in a `dd`, a `td` or next to a
 * button of a menu. It draws nothing for a tier the site does not show.
 */
export function TierTipPanel({ id, tier, maxBrokesLabel, locale }: TierTipPanelProps) {
  const label = shownTierLabel(tier);
  if (label === null) return null;
  const max = tierInfo(tier)?.maxBrokes;
  const value = typeof max === 'number' ? formatInteger(max, locale) : UNKNOWN;
  const rowLabel = /:\s*$/.test(maxBrokesLabel) ? maxBrokesLabel : `${maxBrokesLabel}:`;
  return (
    <span
      id={id}
      role="tooltip"
      popover="manual"
      className="ac-game-tooltip ac-game-tooltip--tier ac-game-tooltip--animate"
    >
      <span className="ac-game-tooltip__title">{label}</span>
      <span className="ac-game-tooltip__rows">
        <span className="ac-game-tooltip__row">
          <span className="ac-game-tooltip__label">{rowLabel}</span>
          <span className="ac-game-tooltip__value">{value}</span>
        </span>
      </span>
    </span>
  );
}

export interface TierTipTriggerProps extends TierTipText {
  tier: PokemonTier | null | undefined;
  /**
   * The trigger, which receives `aria-describedby`: a function of the panel's id, so the caller
   * keeps its own element (the `aria-pressed` tier slot of the Tier menu).
   */
  children: (tipId: string) => ReactNode;
  /** Where the panel opens (7.5.5): `down` in facts, `above-center` in a menu, `side` in the Tier list. */
  placement?: NestedEntityPlacement;
  align?: NestedEntityAlign;
  className?: string;
}

/** Any trigger with the tier tooltip: the wrapper the controller of 7.5.4 reads. */
export function TierTipTrigger({
  tier,
  children,
  placement = 'down',
  align = 'end',
  className,
  maxBrokesLabel,
  locale,
}: TierTipTriggerProps) {
  const id = useId();
  const classes = ['ac-nested-entity', 'ac-tier-tip-wrap'];
  if (className) classes.push(className);
  return (
    <span
      className={classes.join(' ')}
      data-ac-tt=""
      data-ac-tt-placement={placement}
      data-ac-tt-align={align}
    >
      {children(id)}
      <TierTipPanel id={id} tier={tier} maxBrokesLabel={maxBrokesLabel} locale={locale} />
    </span>
  );
}

export interface TierValueProps extends TierTipText {
  tier: PokemonTier | null | undefined;
  /** The visible text; the tier's name when absent (a Tier list label adds its count apart). */
  children?: ReactNode;
  placement?: NestedEntityPlacement;
  align?: NestedEntityAlign;
  className?: string;
}

/**
 * The Tier value of the Cards and Lista facts and of the Tier list labels: the tier as text
 * with a dotted underline that opens its tooltip. `null` for an unknown or hidden tier, which
 * the caller writes as «—».
 */
export function TierValue({ tier, children, className, ...rest }: TierValueProps) {
  const label = shownTierLabel(tier);
  if (label === null) return null;
  return (
    <TierTipTrigger tier={tier} {...rest}>
      {(id) => (
        <button
          type="button"
          className={['ac-nested-entity__trigger', 'ac-tier-value', className]
            .filter(Boolean)
            .join(' ')}
          aria-describedby={id}
        >
          {children ?? label}
        </button>
      )}
    </TierTipTrigger>
  );
}
