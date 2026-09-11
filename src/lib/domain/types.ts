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
] as const;

export type EntityType = (typeof entityTypes)[number];

export const claimStatuses = [
  'confirmed',
  'supported',
  'inferred',
  'unknown',
  'conflicted',
  'deprecated',
  'rejected',
] as const;

export type ClaimStatus = (typeof claimStatuses)[number];

export interface CanonicalFact<T = unknown> {
  value: T;
  status: ClaimStatus;
  evidenceIds: string[];
  normalizerVersion: string;
  observedAt?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  confidence?: number;
  rationale?: string;
}

export interface CanonicalEntityRecord {
  id: string;
  entityType: EntityType;
  canonicalSlug: string;
  canonicalName: string;
  facts: Record<string, CanonicalFact>;
}
