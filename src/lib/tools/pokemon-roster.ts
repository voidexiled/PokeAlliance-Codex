import rosterSnapshot from '../../../data/staging/pka-admin-wiki.pokemon-roster.json';

export type RosterElement = {
  name: string;
  icon: string;
};

export type PublicPokemonRecord = {
  path: string;
  route: string;
  generation: string;
  number: string;
  name: string;
  displayName: string;
  image: string;
  level: number | null;
  tier: number | string | null;
  displayTier: number | string | null;
  role: string | null;
  elements: RosterElement[];
  variant: string;
  detailAvailable: boolean;
};

type RosterSnapshot = {
  status: string;
  sourceId: string;
  sourceUrl: string;
  retrieval: {
    sha256: string;
    recordCount: number;
  };
  records: PublicPokemonRecord[];
};

const snapshot = rosterSnapshot as unknown as RosterSnapshot;

export const publicPokemonRoster = snapshot.records;

export const publicPokemonRosterMeta = {
  status: snapshot.status,
  sourceId: snapshot.sourceId,
  sourceUrl: snapshot.sourceUrl,
  sourceSnapshot: snapshot.retrieval.sha256,
  recordCount: snapshot.retrieval.recordCount,
};

export function getRosterTierLabel(record: PublicPokemonRecord): string {
  const value = record.displayTier ?? record.tier;
  if (value === null || value === undefined || value === '') return '—';
  return typeof value === 'number' ? `T${value}` : String(value);
}

export function getRosterVariantLabel(record: PublicPokemonRecord, locale: 'es' | 'en'): string {
  const labels = {
    es: { normal: 'Normal', shiny: 'Shiny' },
    en: { normal: 'Normal', shiny: 'Shiny' },
  } as const;

  return labels[locale][record.variant as 'normal' | 'shiny'] ?? (record.variant || '—');
}

export function getRosterRoleLabel(record: PublicPokemonRecord): string {
  return record.role?.trim() || '—';
}

export function getRosterElementsLabel(record: PublicPokemonRecord): string {
  return record.elements.map((element) => element.name).join(' · ') || '—';
}
