import { FilterBar } from '@/components/controls/FilterBar';
import {
  ElementFilter,
  GenerationFilter,
  TierFilter,
  VariantFilter,
} from '@/components/pickers/filters';
import type { PokedexIds, PokedexOption } from '@/components/pokedex/config';
import type { Messages } from '@/i18n/messages/en';
import type { PokemonTier } from '@/lib/content/types';

// The filter chips of the Pokédex and of the Tier list (§16.4.2, §16.4.3): the chips of
// `PokemonPicker`'s panel, in its order — «Tipo», «Tipo de moveset», «Tier», «Variante» and
// «Generación» — each of several values (OR within a filter, AND between them). A filter with
// fewer than two values is not drawn. The Tier list passes no tiers: its rows are the tiers.
//
// Both roots load this module with `lazy` (13.6): the server renders the chips into the page and
// the island hydrates them once the chunk is here, so the chips stay out of the initial JS.

export interface PokedexFiltersProps {
  ids: Omit<PokedexIds, 'tiers'> & { tiers?: PokedexIds['tiers'] };
  /** The list state's filters, a comma-joined value per key. */
  filters: Readonly<Record<string, string>>;
  onChange: (key: string, value: string | null) => void;
  text: Messages['pokedex']['filters'];
  /** «Normal» (`ui.cards.normal`). */
  normalLabel: string;
}

/** A tier id of the URL (`t3`, `legendary`) with its text back to the stored tier. */
function tierOf([id, label]: PokedexOption): PokemonTier {
  const number = /^t(\d+)$/.exec(id);
  return number ? Number(number[1]) : label;
}

export default function PokedexFilters({
  ids,
  filters,
  onChange,
  text,
  normalLabel,
}: PokedexFiltersProps) {
  const chosen = (key: string): string[] => filters[key]?.split(',') ?? [];
  const onChips = (key: string) => (value: string[]) =>
    onChange(key, value.length > 0 ? value.join(',') : null);
  const named = (options: readonly PokedexOption[]) => options.map(([id, name]) => ({ id, name }));
  const tiers = ids.tiers ?? [];
  return (
    <FilterBar layout="fill">
      {ids.elements.length > 1 ? (
        <ElementFilter
          label={text.element}
          elements={named(ids.elements)}
          value={chosen('tipo')}
          onChange={onChips('tipo')}
        />
      ) : null}
      {ids.movesets.length > 1 ? (
        <ElementFilter
          label={text.movesetType}
          elements={named(ids.movesets)}
          value={chosen('moveset')}
          onChange={onChips('moveset')}
        />
      ) : null}
      {tiers.length > 1 ? (
        <TierFilter
          label={text.tier}
          tiers={tiers.map(tierOf)}
          value={chosen('tier')}
          onChange={onChips('tier')}
        />
      ) : null}
      {ids.variants.length > 1 ? (
        <VariantFilter
          label={text.variant}
          normalLabel={normalLabel}
          present={ids.variants as readonly ('normal' | 'shiny')[]}
          value={chosen('variante')}
          onChange={onChips('variante')}
        />
      ) : null}
      {ids.generations.length > 1 ? (
        <GenerationFilter
          label={text.generation}
          generations={ids.generations.map(Number)}
          value={chosen('gen')}
          onChange={onChips('gen')}
        />
      ) : null}
    </FilterBar>
  );
}
