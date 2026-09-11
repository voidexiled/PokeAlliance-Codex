import itemDataset from '../../../data/normalized/items.sample.json';
import locationDataset from '../../../data/normalized/locations.sample.json';
import moveDataset from '../../../data/normalized/moves.sample.json';
import pokemonDataset from '../../../data/normalized/pokemon.sample.json';
import questDataset from '../../../data/normalized/quests.sample.json';
import rotationDataset from '../../../data/normalized/rotation-tier-assertions.sample.json';
import evidenceRegistry from '../../../data/research/evidence.json';
import sourceRegistry from '../../../data/research/sources.json';
import type { Locale } from '@/i18n/config';
import type {
  ContentCollection,
  ContentFact,
  ContentRecord,
  EvidenceRecord,
  NormalizedDataset,
  SearchResult,
  SourceRecord,
} from './types';

const datasets = {
  items: itemDataset as unknown as NormalizedDataset,
  locations: locationDataset as unknown as NormalizedDataset,
  moves: moveDataset as unknown as NormalizedDataset,
  pokemon: pokemonDataset as unknown as NormalizedDataset,
  quests: questDataset as unknown as NormalizedDataset,
  rotations: rotationDataset as unknown as NormalizedDataset,
} as const;

const sources = sourceRegistry.sources as SourceRecord[];
const evidence = evidenceRegistry.evidence as EvidenceRecord[];

export type CollectionKey = keyof typeof datasets;

export function getRecords(collection: CollectionKey): ContentRecord[] {
  return datasets[collection].records;
}

export function getRecord(collection: CollectionKey, slug: string): ContentRecord | undefined {
  return getRecords(collection).find((record) => record.canonicalSlug === slug);
}

export function getFact<T>(
  record: ContentRecord,
  key: string,
): (ContentFact & { value: T }) | undefined {
  const fact = record.facts[key];
  return fact as (ContentFact & { value: T }) | undefined;
}

export function getFactValue<T>(record: ContentRecord, key: string): T | undefined {
  return getFact<T>(record, key)?.value;
}

export function getRecordEvidence(record: ContentRecord): EvidenceRecord[] {
  const evidenceIds = new Set(
    Object.values(record.facts).flatMap((fact) => fact.evidenceIds ?? []),
  );

  return evidence.filter((item) => evidenceIds.has(item.id));
}

export function getSource(sourceId: string): SourceRecord | undefined {
  return sources.find((source) => source.id === sourceId);
}

export function getSources(): SourceRecord[] {
  return sources;
}

export function getEvidence(): EvidenceRecord[] {
  return evidence;
}

export function getEvidenceForSource(sourceId: string): EvidenceRecord[] {
  return evidence.filter((item) => item.sourceId === sourceId);
}

export function formatFactValue(value: unknown): string {
  if (Array.isArray(value)) return value.map((item) => formatFactValue(item)).join(', ');
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value)
      .map(([key, item]) => `${key}: ${formatFactValue(item)}`)
      .join(' · ');
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value ?? '—');
}

export function getCollectionLabel(collection: CollectionKey, locale: Locale): string {
  const labels: Record<CollectionKey, { es: string; en: string }> = {
    pokemon: { es: 'Pokémon', en: 'Pokémon' },
    moves: { es: 'Movimientos', en: 'Moves' },
    locations: { es: 'Ubicaciones', en: 'Locations' },
    items: { es: 'Objetos', en: 'Items' },
    quests: { es: 'Misiones', en: 'Quests' },
    rotations: { es: 'Rotaciones y tiers', en: 'Rotations & tiers' },
  };

  return labels[collection][locale];
}

export function getCollectionHref(collection: CollectionKey, locale: Locale): string {
  const paths: Record<CollectionKey, string> = {
    pokemon: 'pokedex',
    moves: 'sistemas',
    locations: 'guias',
    items: 'sistemas',
    quests: 'guias',
    rotations: 'rotaciones',
  };

  return `/${locale}/${paths[collection]}/`;
}

export function getCollections(locale: Locale): ContentCollection[] {
  return (Object.keys(datasets) as CollectionKey[]).map((key) => ({
    key,
    label: getCollectionLabel(key, locale),
    description: getCollectionDescription(key, locale),
    href: getCollectionHref(key, locale),
    count: getRecords(key).length,
  }));
}

function getCollectionDescription(collection: CollectionKey, locale: Locale): string {
  const descriptions: Record<CollectionKey, { es: string; en: string }> = {
    pokemon: { es: 'Especies y variantes revisadas.', en: 'Reviewed species and variants.' },
    moves: { es: 'Movimientos con datos y evidencia.', en: 'Moves with facts and evidence.' },
    locations: { es: 'Lugares y rutas documentadas.', en: 'Documented places and routes.' },
    items: { es: 'Objetos conectados a sistemas.', en: 'Items connected to systems.' },
    quests: { es: 'Pasos, requisitos y recompensas.', en: 'Steps, requirements and rewards.' },
    rotations: { es: 'Afirmaciones de disponibilidad.', en: 'Availability assertions.' },
  };

  return descriptions[collection][locale];
}

function normalizeSearchValue(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase();
}

export function searchRecords(query: string, locale: Locale): SearchResult[] {
  const normalizedQuery = normalizeSearchValue(query.trim());
  const results: SearchResult[] = [];

  for (const collection of Object.keys(datasets) as CollectionKey[]) {
    for (const record of getRecords(collection)) {
      const searchable = [
        record.canonicalName,
        record.canonicalSlug,
        record.id,
        ...(record.aliases ?? []),
        ...(record.searchKeywords?.[locale] ?? []),
      ]
        .map(normalizeSearchValue)
        .join(' ');

      if (!normalizedQuery || searchable.includes(normalizedQuery)) {
        results.push({ record, collection, href: getRecordHref(collection, record, locale) });
      }
    }
  }

  return results;
}

export function getRecordHref(
  collection: CollectionKey,
  record: ContentRecord,
  locale: Locale,
): string {
  if (collection === 'pokemon') return `/${locale}/pokedex/${record.canonicalSlug}/`;
  return `${getCollectionHref(collection, locale)}#${record.canonicalSlug}`;
}

export function getCatalogMetrics() {
  return {
    collections: Object.keys(datasets).length,
    records: Object.values(datasets).reduce((total, dataset) => total + dataset.records.length, 0),
    sources: sources.length,
    evidence: evidence.length,
    datasetStatuses: [...new Set(Object.values(datasets).map((dataset) => dataset.status))],
  };
}
