// Unknown values (G7, spec 13.3). A value the data does not have shows as the
// em dash, never "0" and never "N/D". Inside the game tooltip the whole row is
// dropped before any formatter runs (T32), so the dash never reaches it.

/** The dash every formatter returns for an unknown value (U+2014). */
export const UNKNOWN = '—';

/**
 * Whether a value can be shown. The dash itself is not a value: a record that
 * already carries "—" is as unknown as an empty one.
 */
export function present(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') {
    const text = value.trim();
    return text !== '' && text !== UNKNOWN;
  }
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/** A known text value, or the dash when the grid keeps the key and this entity misses it. */
export function orUnknown(value: string | null | undefined): string {
  return present(value) ? (value as string) : UNKNOWN;
}

/**
 * The union rule of G7 and CARD_GRID_SYSTEM 5.3: a grid shows the canonical
 * keys, in canonical order, that at least one of the entities it renders has a
 * value for. A key no entity has disappears; a key some entity has stays and
 * shows the dash where it is missing.
 */
export function gridKeys<Key extends string>(
  canon: readonly Key[],
  results: readonly Readonly<Partial<Record<Key, unknown>>>[],
): Key[] {
  return canon.filter((key) => results.some((result) => present(result[key])));
}
