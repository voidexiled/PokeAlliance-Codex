// §7.9.4, the scoring and the order of the Ctrl + K palette and of the results page
// (C7-11): exact name 0, name prefix 1, prefix of a word of the name 2, substring of the
// name 3, and 4 for everything else §8.6 searches — `meta`, the Pokédex number, the `id`
// and the extra `terms` of the entry. Ties go by type order and then by name with
// `Intl.Collator(locale, { numeric: true })`, and §7.9.3 caps a group at eight rows.
//
// `scoreEntry` takes a query that is already normalised (`rankSearch` is what runs
// `normalizeQuery` over what the reader typed), so every query written here is in the
// form the module compares.

import { describe, expect, it } from 'vitest';

import {
  MAX_PER_KIND,
  parseDexNumber,
  rankSearch,
  searchKinds,
  scoreEntry,
} from '@/lib/search/rank';
import type { SearchEntry, SearchGroup, SearchKind } from '@/lib/search/rank';

function entry(kind: SearchKind, id: string, name: string, extra: Partial<SearchEntry> = {}) {
  return { kind, id, name, href: `/es/${kind}/${id}/`, icon: null, ...extra } satisfies SearchEntry;
}

const CHARIZARD = entry('pokemon', 'charizard', 'Charizard', { meta: 'Nivel 90 · T3', dex: 6 });
const SHINY_CHARIZARD = entry('pokemon', 'shiny-charizard', 'Shiny Charizard', {
  meta: 'Nivel 90 · T3',
  dex: 6,
});
const CHARJABUG = entry('pokemon', 'charjabug', 'Charjabug', { meta: 'Nivel 30 · T1' });
const POKEDEX = entry('pagina', 'pokedex', 'Pokédex');
const TIERS = entry('pagina', 'tiers', 'Tier list');
const BULBASAUR = entry('pokemon', 'bulbasaur', 'Bulbasaur', {
  dex: 1,
  terms: ['planta', 'grass'],
});

/** Every name of every group, flattened, in the order the palette paints them. */
const names = (groups: SearchGroup[]): string[] =>
  groups.flatMap((group) => group.entries.map((found) => found.name));

describe('scoreEntry', () => {
  it('gives 0 to the exact name, accents apart', () => {
    expect(scoreEntry(CHARIZARD, 'charizard')).toBe(0);
    expect(scoreEntry(POKEDEX, 'pokedex')).toBe(0);
  });

  it('gives 1 to a prefix of the name', () => {
    expect(scoreEntry(CHARIZARD, 'char')).toBe(1);
    expect(scoreEntry(CHARJABUG, 'charj')).toBe(1);
  });

  it('gives 2 to a prefix of a word of the name', () => {
    expect(scoreEntry(SHINY_CHARIZARD, 'char')).toBe(2);
    expect(scoreEntry(SHINY_CHARIZARD, 'charizard')).toBe(2);
  });

  it('gives 3 to a substring of the name', () => {
    expect(scoreEntry(CHARIZARD, 'riza')).toBe(3);
    expect(scoreEntry(SHINY_CHARIZARD, 'riza')).toBe(3);
  });

  it('gives 4 to a match in meta', () => {
    expect(scoreEntry(CHARIZARD, 'nivel')).toBe(4);
    expect(scoreEntry(CHARIZARD, 't3')).toBe(4);
  });

  it('gives 4 to the exact Pokédex number, however it is written (§8.6)', () => {
    for (const query of ['1', '001', '#1', 'nº 1', 'no. 1']) {
      expect(scoreEntry(BULBASAUR, query), `«${query}» finds Bulbasaur`).toBe(4);
    }
    expect(scoreEntry(BULBASAUR, '2'), 'another number finds nothing').toBeNull();
  });

  it('gives 4 to the id and to the extra terms of the entry (§8.6)', () => {
    // «tiers» is the id of the page, not a word of «Tier list».
    expect(scoreEntry(TIERS, 'tiers')).toBe(4);
    expect(scoreEntry(BULBASAUR, 'planta')).toBe(4);
    expect(scoreEntry(BULBASAUR, 'grass')).toBe(4);
  });

  it('answers null when nothing matches and when the query is empty', () => {
    expect(scoreEntry(CHARIZARD, 'zzzz')).toBeNull();
    expect(scoreEntry(CHARIZARD, '')).toBeNull();
    // An entry without `meta` cannot match through it.
    expect(scoreEntry(POKEDEX, 'nivel')).toBeNull();
  });
});

describe('parseDexNumber', () => {
  it('reads the four written forms of §8.6', () => {
    expect(parseDexNumber('6')).toBe(6);
    expect(parseDexNumber('006')).toBe(6);
    expect(parseDexNumber('#6')).toBe(6);
    expect(parseDexNumber('nº 6')).toBe(6);
    expect(parseDexNumber('no. 6')).toBe(6);
  });

  it('answers null to a query that is not a number', () => {
    expect(parseDexNumber('charizard')).toBeNull();
    expect(parseDexNumber('')).toBeNull();
    expect(parseDexNumber('6a')).toBeNull();
    expect(parseDexNumber('12345')).toBeNull();
  });
});

describe('rankSearch', () => {
  it('sorts by score and leaves out what does not match', () => {
    const groups = rankSearch([SHINY_CHARIZARD, CHARIZARD, CHARJABUG], 'charizard', 'es');
    // Charizard is the exact name (0) and Shiny Charizard a prefix of its second word (2);
    // Charjabug does not match.
    expect(names(groups)).toEqual(['Charizard', 'Shiny Charizard']);
  });

  it('normalises the query it is given', () => {
    expect(names(rankSearch([CHARIZARD], '  CHARIZARD  ', 'es'))).toEqual(['Charizard']);
    expect(names(rankSearch([BULBASAUR], 'Nº  1', 'es'))).toEqual(['Bulbasaur']);
  });

  it('puts the groups in the order of searchKinds and leaves out the empty ones', () => {
    const across: SearchEntry[] = [
      entry('pagina', 'token-pagina', 'Token page'),
      entry('pokemon', 'token', 'Token'),
      entry('item', 'token-item', 'Token piece'),
      entry('sistema', 'token-boost', 'Token boost'),
    ];
    const kinds = rankSearch(across, 'token', 'es').map((group) => group.kind);

    expect(kinds).toEqual(['pokemon', 'sistema', 'item', 'pagina']);
    // The order of the groups is the order of `searchKinds` with `actividad` left out,
    // because no entry of that kind matched.
    expect(kinds).toEqual(searchKinds.filter((kind) => kinds.includes(kind)));
  });

  it('breaks a tie by the order of the types before the name', () => {
    const item = entry('item', 'tier-token', 'Tier token');
    const groups = rankSearch([TIERS, item], 'tier', 'es');
    // Both score 1; `item` comes before `pagina`, even though «Tier list» sorts first.
    expect(names(groups)).toEqual(['Tier token', 'Tier list']);
  });

  it('breaks a tie of the same type by name, with numbers read as numbers', () => {
    const ten = entry('sistema', 'boost-10', 'Boost 10');
    const two = entry('sistema', 'boost-2', 'Boost 2');
    expect(names(rankSearch([ten, two], 'boost', 'es'))).toEqual(['Boost 2', 'Boost 10']);
  });

  it('keeps at most eight rows per group and holds the order inside one (§7.9.3)', () => {
    const many = Array.from({ length: 10 }, (_, index) =>
      entry('pokemon', `char-${index + 1}`, `Char ${index + 1}`),
    );
    const [group] = rankSearch(many, 'char', 'es');

    expect(MAX_PER_KIND).toBe(8);
    expect(group.kind).toBe('pokemon');
    expect(names([group])).toEqual([
      'Char 1',
      'Char 2',
      'Char 3',
      'Char 4',
      'Char 5',
      'Char 6',
      'Char 7',
      'Char 8',
    ]);
  });

  it('takes a cap of its own, which the results page of §8.6 needs', () => {
    const many = Array.from({ length: 10 }, (_, index) =>
      entry('pokemon', `char-${index + 1}`, `Char ${index + 1}`),
    );
    const [group] = rankSearch(many, 'char', 'es', Number.POSITIVE_INFINITY);

    expect(group.entries).toHaveLength(10);
  });

  it('answers an empty query and a query nothing matches with no group', () => {
    expect(rankSearch([CHARIZARD, POKEDEX], '', 'es')).toEqual([]);
    expect(rankSearch([CHARIZARD, POKEDEX], '   ', 'es')).toEqual([]);
    expect(rankSearch([CHARIZARD, POKEDEX], 'zzzz', 'es')).toEqual([]);
    expect(rankSearch([], 'char', 'es')).toEqual([]);
  });
});
