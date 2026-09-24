// Adapters from content records to picker options (spec 16.3.3). Island-safe. The page (or the
// entity's datos.json) hands over the records with their sprite and tip already resolved; these
// functions only add the facets the filters read and the order of each entity.
import type { SpriteProps } from '@/components/game/Sprite';
import { compareTierRank, tierKey } from '@/lib/content/tier-rank';
import type { PokemonTier } from '@/lib/content/types';
import type { TipData } from '@/lib/game/tips';

import type { HeldInfo, PickerOption } from './model';

export interface PokemonPickerRecord {
  id: string;
  name: string;
  aliases?: string[];
  number: number | null;
  /** Element ids of its types. */
  types: string[];
  elementoMoveset: string | null;
  tier: PokemonTier | null;
  shiny: boolean;
  generation: number | null;
  /** Outfit facing south when it has one, else its portrait (`smooth`). */
  sprite: SpriteProps | null;
  tip: TipData;
}

/** Facets: `tipo`, `moveset`, `tier` (tierKey), `variante` (normal | shiny), `generacion`. */
export function pokemonOptions(records: readonly PokemonPickerRecord[]): PickerOption[] {
  return [...records]
    .sort(
      (a, b) =>
        (a.number ?? Number.MAX_SAFE_INTEGER) - (b.number ?? Number.MAX_SAFE_INTEGER) ||
        Number(a.shiny) - Number(b.shiny),
    )
    .map((record) => {
      const tier = tierKey(record.tier);
      return {
        id: record.id,
        name: record.name,
        aliases: record.aliases,
        number: record.number,
        sprite: record.sprite,
        tip: record.tip,
        shiny: record.shiny,
        tier: record.tier,
        facets: {
          tipo: record.types,
          moveset: record.elementoMoveset ? [record.elementoMoveset] : [],
          tier: tier ? [tier] : [],
          variante: [record.shiny ? 'shiny' : 'normal'],
          generacion: record.generation === null ? [] : [String(record.generation)],
        },
      };
    });
}

export interface ItemPickerRecord {
  id: string;
  name: string;
  aliases?: string[];
  /** Market category id (`ui/categorias/<id>`). */
  categoria: string | null;
  sprite: SpriteProps | null;
  tip: TipData;
  held?: HeldInfo | null;
  /** Pokémon ids of a Mega Stone. */
  mega?: { pokemon: string[] } | null;
}

export type ItemPickerOption = PickerOption & {
  held?: HeldInfo | null;
  mega?: { pokemon: string[] } | null;
};

/** Facets: `categoria`, and `tier` (1…8 as text) for helds. Registry order is kept. */
export function itemOptions(records: readonly ItemPickerRecord[]): ItemPickerOption[] {
  return records.map((record) => ({
    id: record.id,
    name: record.name,
    aliases: record.aliases,
    sprite: record.sprite,
    tip: record.tip,
    held: record.held ?? null,
    mega: record.mega ?? null,
    facets: {
      categoria: record.categoria ? [record.categoria] : [],
      tier: record.held ? [String(record.held.tier)] : [],
    },
  }));
}

/** Mega Stones, those of `pokemonId` first, then the rest in registry order. */
export function megaOptions(
  options: readonly ItemPickerOption[],
  pokemonId: string | null,
): ItemPickerOption[] {
  const megas = options.filter((option) => option.mega);
  if (!pokemonId) return megas;
  const own = megas.filter((option) => option.mega?.pokemon.includes(pokemonId));
  return [...own, ...megas.filter((option) => !own.includes(option))];
}

/** Tier keys present, best first. */
export function sortedTierKeys(
  tiers: readonly (PokemonTier | null)[],
): { key: string; tier: PokemonTier }[] {
  const seen = new Map<string, PokemonTier>();
  for (const tier of [...tiers].sort(compareTierRank)) {
    const key = tierKey(tier);
    if (key && tier !== null && !seen.has(key)) seen.set(key, tier);
  }
  return [...seen].map(([key, tier]) => ({ key, tier }));
}
