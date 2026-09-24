import { ChipChoice } from '@/components/controls/ChipChoice';
import type { ChipOption } from '@/components/controls/ChipChoice';
import { ShinyMark } from '@/components/game/ShinyMark';
import { TierBadge } from '@/components/game/TierBadge';
import type { FilterOption } from '@/components/filters/model';
import { visibleTiers } from '@/lib/content/tiers';
import type { PokemonTier } from '@/lib/content/types';
import { sortedTierKeys } from '@/lib/pickers/options';
import { elementSprite } from '@/lib/pickers/sprites';

// Filter chips of the pickers and of the lists (spec 16.3.3, 16.4): every filter is a ChipChoice,
// so any chosen value matches (OR) and the page combines filters with AND. A filter with fewer
// than two values present is not drawn (C-R5). The chip builders are shared with the picker
// panels, which take them as `PickerFilter.options`.
//
// Plan «Dirección C»: the lists and the picker move to the filter toolbar of
// src/components/filters/ (`FilterToolbar` with one `FilterDef` per button). `elementOptions`
// and `tierOptions` give its options from the same inputs as the chips; a tier the tiers
// registry hides (ULTIMATE for now) is never an option, here or in `tierChips`.

export { FilterToolbar } from '@/components/filters/FilterToolbar';
export type { FilterDef, FilterOption } from '@/components/filters/model';

/** The visible tiers of content/tiers.json by id (`t3`, `legendary`). */
const shownTiers = new Map(visibleTiers.map((tier) => [tier.id, tier]));

export interface NamedElement {
  id: string;
  /** Localised name from content/elementos.json. */
  name: string;
}

/** Element chips, in the order given, for the ids present. */
export function elementChips(
  elements: readonly NamedElement[],
  present?: readonly string[],
): ChipOption[] {
  return elements
    .filter((element) => !present || present.includes(element.id))
    .map((element) => ({
      value: element.id,
      label: element.name,
      sprite: elementSprite(element.id),
    }));
}

/** Tier chips best first, each a TierBadge; the value is `tierKey`. Hidden tiers are left out. */
export function tierChips(tiers: readonly (PokemonTier | null)[]): ChipOption[] {
  return sortedTierKeys(tiers)
    .filter(({ key }) => shownTiers.has(key))
    .map(({ key, tier }) => ({
      value: key,
      label: typeof tier === 'number' ? `T${tier}` : String(tier),
      badge: <TierBadge tier={tier} />,
      badgeOnly: true,
    }));
}

/** The options of an element menu (Tipo, Tipo de moveset) for the ids present, in order. */
export function elementOptions(
  elements: readonly NamedElement[],
  present?: readonly string[],
): FilterOption[] {
  return elements
    .filter((element) => !present || present.includes(element.id))
    .map((element) => ({ id: element.id, label: element.name }));
}

/**
 * The options of the Tier ladder: the visible tiers present, best first (the named tiers,
 * then T1 … T7), each with its «Max brokes» from content/tiers.json; the id is `tierKey`.
 */
export function tierOptions(tiers: readonly (PokemonTier | null)[]): FilterOption[] {
  return sortedTierKeys(tiers).flatMap(({ key }) => {
    const shown = shownTiers.get(key);
    return shown ? [{ id: key, label: shown.nombre, maxBrokes: shown.maxBrokes }] : [];
  });
}

/** Normal / Shiny; "Shiny" is a game term in both locales. */
export function variantChips(normalLabel: string): ChipOption[] {
  return [
    { value: 'normal', label: normalLabel },
    { value: 'shiny', label: 'Shiny', badge: <ShinyMark /> },
  ];
}

export function generationChips(generations: readonly number[]): ChipOption[] {
  return [...new Set(generations)]
    .sort((a, b) => a - b)
    .map((g) => ({ value: String(g), label: String(g) }));
}

/** Held tiers 1…8 present. */
export function heldTierChips(tiers: readonly number[]): ChipOption[] {
  return [...new Set(tiers)]
    .sort((a, b) => a - b)
    .map((t) => ({ value: String(t), label: `T${t}` }));
}

interface FilterProps {
  label: string;
  value: readonly string[];
  onChange: (value: string[]) => void;
  className?: string;
}

export function ElementFilter({
  elements,
  present,
  ...rest
}: FilterProps & { elements: readonly NamedElement[]; present?: readonly string[] }) {
  return <ChipChoice {...rest} options={elementChips(elements, present)} />;
}

export function TierFilter({
  tiers,
  ...rest
}: FilterProps & { tiers: readonly (PokemonTier | null)[] }) {
  return <ChipChoice {...rest} options={tierChips(tiers)} />;
}

/** Drawn only when both variants are present. */
export function VariantFilter({
  normalLabel,
  present,
  ...rest
}: FilterProps & { normalLabel: string; present: readonly ('normal' | 'shiny')[] }) {
  return (
    <ChipChoice
      {...rest}
      options={variantChips(normalLabel).filter((chip) => present.includes(chip.value as 'normal'))}
    />
  );
}

export function GenerationFilter({
  generations,
  ...rest
}: FilterProps & { generations: readonly number[] }) {
  return <ChipChoice {...rest} options={generationChips(generations)} />;
}
