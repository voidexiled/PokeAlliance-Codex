export const entityTypes = [
  'pokemon_species',
  'pokemon_variant',
  'move',
  'item',
  'location',
  'npc',
  'quest',
  'hunt',
  'system',
  'guide',
  'activity',
  'progression_milestone',
] as const;

export type EntityType = (typeof entityTypes)[number];
