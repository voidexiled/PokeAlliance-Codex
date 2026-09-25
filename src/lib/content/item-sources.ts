// What the Pokémon and item pages derive from the registries at build time, with no data of
// their own: the loot zones of a Pokémon, the Pokémon that drop an item (the inverse of
// `drops` and `dropsPorZona`), what an item is used for (evolutions, recipes, Mega Stones,
// element stones and fragments) and the effectiveness groups with their client multipliers.
// Pure functions over plain records, so tests can feed them fixtures.
import type { Item } from './registry-schema';
import type { PokemonDrop, PokemonEffectiveness, PokemonRecord } from './types';

/** The loot zones of the game's Pokédex, in its order. `base` is `drops`. */
export const LOOT_ZONES = ['base', 'wildscape', 'primal'] as const;
export type LootZone = (typeof LOOT_ZONES)[number];

/** The game's own names of the zones (13.4): the same in both locales. */
export const LOOT_ZONE_NAMES: Record<LootZone, string> = {
  base: 'Base',
  wildscape: 'Wildscape',
  primal: 'Primal',
};

export interface LootZoneDrops {
  zone: LootZone;
  drops: PokemonDrop[];
}

/**
 * The zones of a Pokémon that the registry has, in the game's order: Base while `drops`
 * exists, and each zone of `dropsPorZona` that exists (an empty list is «no drops there»,
 * which is data). A zone that is missing is unknown and is not returned.
 */
export function lootZonesOf(record: PokemonRecord): LootZoneDrops[] {
  const zones: LootZoneDrops[] = [];
  if (record.drops !== undefined) zones.push({ zone: 'base', drops: record.drops });
  const other = record.dropsPorZona;
  if (other?.wildscape !== undefined) zones.push({ zone: 'wildscape', drops: other.wildscape });
  if (other?.primal !== undefined) zones.push({ zone: 'primal', drops: other.primal });
  return zones;
}

/** One Pokémon that drops an item in one zone. */
export interface ItemLootRow {
  pokemon: PokemonRecord;
  zone: LootZone;
  probabilidad: number | null;
  /** The game shows «Muy Raro» (a hidden rate under 1%); `probabilidad` is then `null`. */
  muyRaro: boolean;
  cantidad: { min: number; max: number } | null;
}

/**
 * Where a drop's chance goes in an order by chance: 0 a known %, 1 «Muy raro», 2 unknown.
 * Every known % comes before «Muy raro» and unknown comes last, in either direction.
 */
export function chanceTier(drop: { probabilidad?: number | null; muyRaro?: boolean }): 0 | 1 | 2 {
  if (typeof drop.probabilidad === 'number') return 0;
  return drop.muyRaro === true ? 1 : 2;
}

/** Highest known chance first, then «Muy raro», then unknown (a stable sort keeps ties). */
export function compareChance(
  a: { probabilidad?: number | null; muyRaro?: boolean },
  b: { probabilidad?: number | null; muyRaro?: boolean },
): number {
  const tier = chanceTier(a) - chanceTier(b);
  if (tier !== 0) return tier;
  return (b.probabilidad ?? 0) - (a.probabilidad ?? 0);
}

/** Every Pokémon and zone that drops `itemId`, in the order of `pokemon`, then of the zones. */
export function itemLoot(itemId: string, pokemon: readonly PokemonRecord[]): ItemLootRow[] {
  const rows: ItemLootRow[] = [];
  for (const record of pokemon) {
    for (const { zone, drops } of lootZonesOf(record)) {
      const drop = drops.find((entry) => entry.item === itemId);
      if (drop === undefined) continue;
      rows.push({
        pokemon: record,
        zone,
        probabilidad: drop.probabilidad ?? null,
        muyRaro: drop.muyRaro === true,
        cantidad: drop.cantidad,
      });
    }
  }
  return rows;
}

/** An evolution that asks for the item. */
export interface ItemEvolutionUse {
  from: PokemonRecord;
  /** The target record, or `null` when the id is not in the registry. */
  to: PokemonRecord | null;
  nivel: number | null;
  cantidad: number;
}

/** A recipe of another item that takes this one as a material. */
export interface ItemRecipeUse {
  product: Item;
  recipeIndex: number;
}

export interface ItemUses {
  evolutions: ItemEvolutionUse[];
  recipes: ItemRecipeUse[];
  /** Ids of the elements whose `stone` / `fragment` is this item. */
  stoneOf: string[];
  fragmentOf: string[];
}

/** What `itemId` is used for, derived from the other registries. */
export function itemUses(
  itemId: string,
  pokemon: readonly PokemonRecord[],
  items: readonly Item[],
  elementos: readonly { id: string; stone: string | null; fragment: string | null }[],
): ItemUses {
  const byId = new Map(pokemon.map((record) => [record.id, record]));
  const evolutions: ItemEvolutionUse[] = [];
  for (const record of pokemon) {
    for (const step of record.evolucion ?? []) {
      const entry = step.items.find((use) => use.item === itemId);
      if (entry === undefined) continue;
      evolutions.push({
        from: record,
        to: byId.get(step.a) ?? null,
        nivel: step.nivel,
        cantidad: entry.cantidad,
      });
    }
  }
  const recipes: ItemRecipeUse[] = [];
  for (const product of items) {
    (product.obtencion?.recetas ?? []).forEach((recipe, recipeIndex) => {
      if (recipe.materiales.some((material) => material.item === itemId))
        recipes.push({ product, recipeIndex });
    });
  }
  return {
    evolutions,
    recipes,
    stoneOf: elementos.filter((element) => element.stone === itemId).map((element) => element.id),
    fragmentOf: elementos
      .filter((element) => element.fragment === itemId)
      .map((element) => element.id),
  };
}

/** The groups of «Efectividad», strongest first, with the client multiplier of each. */
export const EFFECTIVENESS_GROUPS = [
  { key: 'muyDebil', multiplier: 2 },
  { key: 'debil', multiplier: 1.5 },
  { key: 'neutro', multiplier: 1 },
  { key: 'resiste', multiplier: 0.5 },
  { key: 'muyResistente', multiplier: 0.4 },
  { key: 'inmune', multiplier: 0 },
] as const;

export type EffectivenessKey = (typeof EFFECTIVENESS_GROUPS)[number]['key'];

export interface EffectivenessRow {
  key: EffectivenessKey;
  multiplier: number;
  elements: string[];
}

/**
 * The six rows of «Efectividad»: the five groups of the registry and «Neutro», every element
 * of `allElements` (content/elementos.json, in its order) that no group names.
 */
export function effectivenessRows(
  groups: PokemonEffectiveness,
  allElements: readonly string[],
): EffectivenessRow[] {
  const listed = new Set(
    [groups.muyDebil, groups.debil, groups.resiste, groups.muyResistente, groups.inmune].flat(),
  );
  return EFFECTIVENESS_GROUPS.map(({ key, multiplier }) => ({
    key,
    multiplier,
    elements: key === 'neutro' ? allElements.filter((id) => !listed.has(id)) : [...groups[key]],
  }));
}
