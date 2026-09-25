// The packed search index (src/lib/search/index-file.ts): the file the build writes unpacks to
// exactly the entries the build made, in their order, and stays within BU5 (60 KB gzip).
import { gzipSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import { decodeSearchIndex } from '@/components/search/config';
import {
  expandSearchIndex,
  nameSlug,
  packSearchIndex,
  type SearchIndexFile,
} from '@/lib/search/index-file';
import type { SearchEntry } from '@/lib/search/rank';

import { slugify } from '../../scripts/content/lib/datamine.mjs';
import { buildSearchIndex } from '../../src/pages/[locale]/buscar/indice.json';

describe('the packed search index (7.9.1, 13.6)', () => {
  for (const locale of ['es', 'en'] as const) {
    it(`${locale}: unpacks to the entries the build made, in their order`, () => {
      const entries = buildSearchIndex(locale);
      const file = JSON.parse(JSON.stringify(packSearchIndex(entries))) as SearchIndexFile;
      expect(file.v).toBe(2);
      // Most items travel as rows.
      expect(file.entradas.filter((entry) => Array.isArray(entry)).length).toBeGreaterThan(2000);
      expect(expandSearchIndex(file)).toEqual(entries);
      expect(decodeSearchIndex(file)).toEqual(entries);
    });

    it(`${locale}: stays within BU5 (60 KB gzip)`, () => {
      const body = JSON.stringify(packSearchIndex(buildSearchIndex(locale)));
      expect(gzipSync(body, { level: 9 }).byteLength).toBeLessThanOrEqual(60_000);
    });
  }

  it('keeps as they are the entries that are not items of a category page', () => {
    const odd: SearchEntry = {
      kind: 'item',
      id: 'some-item',
      name: 'Some Item',
      // Not the anchor of its own id: it is written whole.
      href: '/es/items/c/toys/#item-other',
      icon: null,
      meta: 'Toys',
      terms: ['toys'],
    };
    const file = packSearchIndex([odd]);
    expect(file.entradas).toEqual([odd]);
    expect(expandSearchIndex(file)).toEqual([odd]);
  });

  it('derives an id from its name the way the importer does', () => {
    for (const name of ['Pikachu toy', "Farfetch'd toy", 'Flabébé toy', 'Type: Null toy'])
      expect(nameSlug(name)).toBe(slugify(name));
  });
});
