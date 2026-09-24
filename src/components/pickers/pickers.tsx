import { useCallback, useMemo } from 'react';

import { EntityPicker } from '@/components/pickers/EntityPicker';
import type { EntityPickerProps, PickerFilter } from '@/components/pickers/EntityPicker';
import { elementChips, heldTierChips, variantChips } from '@/components/pickers/filters';
import type { NamedElement } from '@/components/pickers/filters';
import { InlineSlotPicker } from '@/components/pickers/InlineSlotPicker';
import type { InlineSlotPickerProps } from '@/components/pickers/InlineSlotPicker';
import { visibleTiers } from '@/lib/content/tiers';
import { facetValues } from '@/lib/pickers/model';
import type { PickerOption } from '@/lib/pickers/model';
import { megaOptions } from '@/lib/pickers/options';
import type { ItemPickerOption } from '@/lib/pickers/options';
import { categorySprite } from '@/lib/pickers/sprites';

// One picker per game entity, the same across the site (spec 16.1.4, 16.3.3). Each one is
// EntityPicker (or the inline slot grid) with the filters and the order of its entity. Options
// come from the adapters of src/lib/pickers/options.ts.

type BaseProps = Omit<EntityPickerProps, 'filters' | 'layout' | 'held'>;

export interface PokemonFilterLabels {
  /** «Tier» */
  tier: string;
  /** «Tipo» / «Type» */
  tipo: string;
  /** «Tipo de moveset» / «Moveset type» */
  moveset: string;
  /** «Variante» / «Variant» */
  variante: string;
  /** «Normal» */
  normal: string;
  /** «Generación» / «Generation» (not a filter of the picker since Direction C). */
  generacion: string;
  /** «Hasta {max}; debe tener ambos.» / «Up to {max}; it must have both.» */
  tipoRule?: string;
  /** «Ataques en área; basta con uno.» / «Area attacks; one is enough.» */
  movesetRule?: string;
  /** «De mejor a peor.» / «Best to worst.» */
  tierRule?: string;
  /** «Max brokes»: the row of the tier tooltip, «Max brokes: —» until the data exists. */
  maxBrokes?: string;
  /** «Todas» / «All»: the leading slot of the Variante menu. */
  all?: string;
}

export interface PokemonPickerProps extends BaseProps {
  /** content/elementos.json in its order, with localised names. */
  elements: readonly NamedElement[];
  filterLabels: PokemonFilterLabels;
}

/**
 * Filters of `Lienzo:Selector-Pokemon` (Direction C): Tipo (AND, at most 2), Tipo de moveset
 * (OR; hidden without data), Tier (content/tiers.json best first: a hidden tier such as
 * ULTIMATE is not offered, each with its «Max brokes» tooltip) and Variante. The grid is of 72:
 * the art at 64.
 */
export function PokemonPicker({ elements, filterLabels, ...props }: PokemonPickerProps) {
  const filters = useCallback(
    (options: readonly PickerOption[]): PickerFilter[] => {
      const present = facetValues(options, 'tier');
      const tiers = visibleTiers.filter((tier) => present.includes(tier.id));
      const tips: Record<string, string> = {};
      if (filterLabels.maxBrokes) {
        for (const tier of tiers) {
          tips[tier.id] = `${filterLabels.maxBrokes}: ${tier.maxBrokes ?? '—'}`;
        }
      }
      return [
        {
          id: 'tipo',
          label: filterLabels.tipo,
          options: elementChips(elements, facetValues(options, 'tipo')),
          match: 'all',
          max: 2,
          rule: filterLabels.tipoRule,
        },
        {
          id: 'moveset',
          label: filterLabels.moveset,
          options: elementChips(elements, facetValues(options, 'moveset')),
          rule: filterLabels.movesetRule,
        },
        {
          id: 'tier',
          label: filterLabels.tier,
          options: tiers.map((tier) => ({ value: tier.id, label: tier.nombre })),
          rule: filterLabels.tierRule,
          tips,
        },
        {
          id: 'variante',
          label: filterLabels.variante,
          options: variantChips(filterLabels.normal).filter((chip) =>
            facetValues(options, 'variante').includes(chip.value),
          ),
          all: filterLabels.all,
        },
      ];
    },
    [elements, filterLabels],
  );
  return <EntityPicker slotSize={72} {...props} filters={filters} />;
}
export interface ItemPickerProps extends BaseProps {
  /** «Categoría» / «Category» */
  categoryLabel: string;
  /** Localised Market category names by id. */
  categoryNames: Readonly<Record<string, string>>;
}

/** Filter: Categoría, with the Market category sprites, when more than one is present. */
export function ItemPicker({ categoryLabel, categoryNames, ...props }: ItemPickerProps) {
  const filters = useCallback(
    (options: readonly PickerOption[]): PickerFilter[] => [
      {
        id: 'categoria',
        label: categoryLabel,
        options: facetValues(options, 'categoria').map((id) => ({
          value: id,
          label: categoryNames[id] ?? id,
          sprite: categorySprite(id),
        })),
      },
    ],
    [categoryLabel, categoryNames],
  );
  return <EntityPicker {...props} filters={filters} />;
}

export interface HeldPickerProps extends Omit<BaseProps, 'multiple' | 'options'> {
  /** Item options with `held` (itemOptions). */
  options: readonly ItemPickerOption[];
  /** The fixed slot of this field. */
  ranura: 'x' | 'y';
  /** «Tier» */
  tierLabel: string;
}

/** Single choice in an effect × tier matrix; a tier column without items is not drawn. */
export function HeldPicker({ options, ranura, tierLabel, ...props }: HeldPickerProps) {
  const slotOptions = useMemo(
    () => options.filter((option) => option.held?.ranura === ranura),
    [options, ranura],
  );
  const held = useCallback((option: PickerOption) => (option as ItemPickerOption).held ?? null, []);
  const filters = useCallback(
    (all: readonly PickerOption[]): PickerFilter[] => [
      {
        id: 'tier',
        label: tierLabel,
        options: heldTierChips(facetValues(all, 'tier').map(Number)),
      },
    ],
    [tierLabel],
  );
  return (
    <EntityPicker {...props} options={slotOptions} layout="matrix" held={held} filters={filters} />
  );
}

export interface MegaPickerProps extends Omit<BaseProps, 'multiple' | 'options'> {
  options: readonly ItemPickerOption[];
  /** The chosen Pokémon: its Mega Stones come first. */
  pokemonId: string | null;
}

export function MegaPicker({ options, pokemonId, ...props }: MegaPickerProps) {
  const megas = useMemo(() => megaOptions(options, pokemonId), [options, pokemonId]);
  if (megas.length === 0) return null;
  return <EntityPicker {...props} options={megas} />;
}

/** Auras of content/auras.json, inline, multiple. */
export function AuraPicker(props: InlineSlotPickerProps) {
  if (props.options.length === 0) return null;
  return <InlineSlotPicker {...props} />;
}

export interface AddonPickerProps extends InlineSlotPickerProps {
  /** Waits for a Pokémon: nothing is drawn without one. */
  pokemonId: string | null;
}

/** Addons of the chosen Pokémon, inline, multiple; hidden when it has none. */
export function AddonPicker({ pokemonId, ...props }: AddonPickerProps) {
  if (!pokemonId || props.options.length === 0) return null;
  return <InlineSlotPicker {...props} />;
}
