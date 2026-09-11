import type { Locale } from '@/i18n/config';

export type ContentFact = {
  value: unknown;
  status: string;
  evidenceIds: string[];
};

export type ContentRecord = {
  id: string;
  entityId?: string;
  canonicalSlug: string;
  canonicalName: string;
  pokedexNumber?: number;
  variant?: string;
  kind?: string;
  itemKind?: string;
  assertionId?: string;
  facts: Record<string, ContentFact>;
  aliases?: string[];
  searchKeywords?: Partial<Record<Locale, string[]>>;
};

export type NormalizedDataset = {
  schemaVersion: string;
  generatedAt: string;
  status: string;
  records: ContentRecord[];
};

export type SourceRecord = {
  id: string;
  name: string;
  url: string;
  sourceType: string;
  authority: string;
  scope: string[];
  language: string[];
  lastCheckedAt: string;
  lastSuccessfulAt: string | null;
  freshness: string;
  notes: string;
};

export type EvidenceRecord = {
  id: string;
  sourceId: string;
  url: string;
  retrievedAt: string;
  locator: string;
  claims: string[];
  contentDigest: string | null;
};

export type ContentCollection = {
  key: string;
  label: string;
  description: string;
  href: string;
  count: number;
};

export type SearchResult = {
  record: ContentRecord;
  collection: string;
  href: string;
};
