// The server validation of the listing asset (M17, §16.2.5) and the registry schema agree: the
// migration accepts exactly the keys of `unidadPokemon` and `itemAnunciado`, and it is a new file
// that replaces the M14 function instead of rewriting it.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import schema from '@content/schemas/comercio.schema.json';
import { describe, expect, it } from 'vitest';

const dir = join(process.cwd(), 'supabase', 'migrations');
const file = readdirSync(dir).find((name) => name.endsWith('_listing_asset_v2.sql'));
const sql = file ? readFileSync(join(dir, file), 'utf8') : '';

/** The quoted keys of the `array[...]` that follows `marker` in the migration. */
function keysAfter(marker: string): string[] {
  const start = sql.indexOf(marker);
  const open = sql.indexOf('array[', start);
  const close = sql.indexOf(']', open);
  return [...sql.slice(open, close).matchAll(/'([A-Za-z]+)'/g)].map((match) => match[1]).sort();
}

describe('listing asset v2 migration', () => {
  it('exists after the M14 marketplace migration', () => {
    expect(file).toBeDefined();
    expect(file! > '20260923150200_trade_marketplace.sql').toBe(true);
    expect(sql).toContain('create or replace function public.trade_asset_problem');
  });

  it('accepts exactly the keys of unidadPokemon', () => {
    const keys = Object.keys(schema.$defs.unidadPokemon.properties).sort();
    expect(keysAfter('-- pokemon')).toEqual(keys);
  });

  it('accepts exactly the keys of itemAnunciado', () => {
    const keys = Object.keys(schema.$defs.itemAnunciado.properties).sort();
    expect(keysAfter("if p_type = 'items' then")).toEqual(keys);
  });

  it('drops the declared names of M14', () => {
    expect(sql).not.toMatch(/'nombre'|'helds'|'aura'[,\]]|'addon'[,\]]/);
  });
});
