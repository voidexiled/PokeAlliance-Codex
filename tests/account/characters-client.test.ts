// The game characters of an account and the character of a listing (owner rule 2026-09-24,
// supabase/migrations/20260924190000_account_characters.sql) as src/lib/supabase/trade.ts sends
// and reads them: the SQL names and arguments, the values refused before any request, the list
// every write answers, `character_id` in the listing payload, the `character` of a listing row and
// the reads that still work on a database without the migration. A fake client stands in for
// supabase-js.
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

import * as limits from '@/lib/trade/limits';
import {
  CHARACTER_REFUSALS,
  LISTING_BASE_COLUMNS,
  LISTING_CHARACTER_COLUMNS,
  LISTING_UNIT_COLUMNS,
  TRADE_RPC,
  addCharacter,
  canAddCharacter,
  canRemoveCharacter,
  isMissingColumn,
  listMyCharacters,
  listMyListings,
  listingPayload,
  removeCharacter,
  setMainCharacter,
  toAccountCharacters,
  toAnuncio,
  toListingCharacter,
  type TradeListingInput,
} from '@/lib/supabase/trade';

const USER = '8c7f1f3e-2a55-4d8e-9d0e-6f1b2c3d4e5f';
const MAIN = '1b2c3d4e-5f60-4a1b-8c2d-3e4f5a6b7c8d';
const ALT = '2c3d4e5f-6071-4b2c-9d3e-4f5a6b7c8d9e';
const LISTING = '3d4e5f60-7182-4c3d-8e4f-5a6b7c8d9e0f';

/** The rows of account_characters_list as the migration returns them. */
const ROWS = [
  {
    id: MAIN,
    player_name: 'Void Exiled',
    world_key: 'titan-1',
    is_main: true,
    listings: 2,
    created_at: '2026-09-24T10:00:00+00:00',
  },
  {
    id: ALT,
    player_name: 'Void Moon',
    world_key: 'moon',
    is_main: false,
    listings: 0,
    created_at: '2026-09-24T11:00:00+00:00',
  },
];

interface Call {
  name: string;
  args: Record<string, unknown>;
}

function fakeClient(answer: (name: string) => unknown = () => ROWS) {
  const calls: Call[] = [];
  const client = {
    rpc: vi.fn(async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      return { data: answer(name), error: null, status: 200 };
    }),
  };
  return { client: client as unknown as SupabaseClient, calls };
}

describe('characters of the account (account_characters)', () => {
  it('calls the four functions of the migration by their SQL names', () => {
    expect({
      list: TRADE_RPC.listCharacters,
      add: TRADE_RPC.addCharacter,
      main: TRADE_RPC.setMainCharacter,
      remove: TRADE_RPC.removeCharacter,
    }).toEqual({
      list: 'account_characters_list',
      add: 'account_character_add',
      main: 'account_character_set_main',
      remove: 'account_character_remove',
    });
  });

  it('reads the list, main first, and drops malformed rows', () => {
    expect(
      toAccountCharacters([...ROWS, { id: 'nope', player_name: 'X', world_key: 'moon' }]),
    ).toEqual([
      {
        id: MAIN,
        playerName: 'Void Exiled',
        worldKey: 'titan-1',
        isMain: true,
        listings: 2,
        createdAt: '2026-09-24T10:00:00+00:00',
      },
      {
        id: ALT,
        playerName: 'Void Moon',
        worldKey: 'moon',
        isMain: false,
        listings: 0,
        createdAt: '2026-09-24T11:00:00+00:00',
      },
    ]);
    expect(toAccountCharacters(null)).toEqual([]);
  });

  it('sends the arguments of each function and answers the new list', async () => {
    const { client, calls } = fakeClient();
    expect((await listMyCharacters(client)).data).toHaveLength(2);
    const added = await addCharacter(client, { playerName: '  Void   Moon ', worldKey: 'moon' });
    expect(added.data?.[1]?.playerName).toBe('Void Moon');
    await setMainCharacter(client, ALT);
    await removeCharacter(client, ALT);
    expect(calls).toEqual([
      { name: 'account_characters_list', args: {} },
      { name: 'account_character_add', args: { p_player_name: 'Void Moon', p_world_key: 'moon' } },
      { name: 'account_character_set_main', args: { p_id: ALT } },
      { name: 'account_character_remove', args: { p_id: ALT } },
    ]);
  });

  it('refuses a blank or long name, a malformed world or id before any request (22023)', async () => {
    const { client, calls } = fakeClient();
    const refused = { data: null, error: { code: '22023', network: false }, reason: null };
    expect(await addCharacter(client, { playerName: '   ', worldKey: 'moon' })).toEqual(refused);
    expect(await addCharacter(client, { playerName: 'x'.repeat(33), worldKey: 'moon' })).toEqual(
      refused,
    );
    expect(await addCharacter(client, { playerName: 'Void', worldKey: 'Titan 1' })).toEqual(
      refused,
    );
    expect(await setMainCharacter(client, 'main')).toEqual(refused);
    expect(await removeCharacter(client, '')).toEqual(refused);
    expect(calls).toEqual([]);
  });

  it('keeps the fixed reason of a refusal', async () => {
    const client = {
      rpc: vi.fn(async () => ({
        data: null,
        error: { code: '22023', message: 'character_has_listings' },
        status: 400,
      })),
    } as unknown as SupabaseClient;
    const result = await removeCharacter(client, MAIN);
    expect(result).toMatchObject({ data: null, reason: 'character_has_listings' });
    expect(CHARACTER_REFUSALS).toContain(result.reason);
  });

  it('offers «Añadir» below PERSONAJES_MAX and «Quitar» only without listings, never for the main one', () => {
    expect(limits.PERSONAJES_MAX).toBe(10);
    const ids = (n: number) => Array.from({ length: n }, (_, index) => ({ id: String(index) }));
    expect(canAddCharacter(ids(9))).toBe(true);
    expect(canAddCharacter(ids(10))).toBe(false);
    expect(canRemoveCharacter({ isMain: false, listings: 0 })).toBe(true);
    expect(canRemoveCharacter({ isMain: false, listings: 1 })).toBe(false);
    expect(canRemoveCharacter({ isMain: true, listings: 0 })).toBe(false);
  });
});

describe('the character of a listing', () => {
  const input: TradeListingInput = {
    tipo: 'pokedolares',
    mundo: 'moon',
    cantidad: 1_000_000,
    precio: { real: null, juego: [{ tipo: 'diamonds', cantidad: 5 }], aConvenir: false },
  };

  it('sends character_id with the listing, and nothing without a valid one', () => {
    expect(listingPayload({ ...input, characterId: ALT })).toMatchObject({
      character_id: ALT,
      asset_type: 'pokedolares',
      world_key: 'moon',
    });
    expect(listingPayload(input)).not.toHaveProperty('character_id');
    expect(listingPayload({ ...input, characterId: null })).not.toHaveProperty('character_id');
    expect(listingPayload({ ...input, characterId: 'main' })).not.toHaveProperty('character_id');
  });

  it('reads the computed field as `character`', () => {
    const row = {
      listing_id: LISTING,
      asset_type: 'pokedolares',
      world_key: 'moon',
      status: 'publicado',
      asset: { cantidad: 1_000_000 },
      game_prices: [{ tipo: 'diamonds', cantidad: 5 }],
      negotiable: false,
      created_at: '2026-09-24T10:00:00Z',
      published_at: '2026-09-24T10:00:00Z',
      expires_at: '2026-10-08T10:00:00Z',
      character_id: ALT,
      character: { id: ALT, player_name: 'Void Moon', world_key: 'moon' },
    };
    expect(toAnuncio(row, 'void')?.character).toEqual({
      id: ALT,
      playerName: 'Void Moon',
      worldKey: 'moon',
    });
    // A database without the migration, or a listing the reader may not see: no character.
    expect(toAnuncio({ ...row, character: null }, 'void')).not.toHaveProperty('character');
    expect(toListingCharacter({ id: ALT, player_name: '', world_key: 'moon' })).toBeNull();
  });

  it('lists the own listings without the character on a database without the migration', async () => {
    const selected: string[] = [];
    const query = (columns: string) => ({
      eq: () => ({
        order: async () =>
          columns.includes('character')
            ? {
                data: null,
                error: { code: '42703', message: 'column does not exist' },
                status: 400,
              }
            : { data: [], error: null, status: 200 },
      }),
    });
    const client = {
      from: () => ({
        select: (columns: string) => {
          selected.push(columns);
          return query(columns);
        },
      }),
    } as unknown as SupabaseClient;
    expect(await listMyListings(client, { userId: USER, handle: 'void' })).toEqual({
      data: [],
      error: null,
      reason: null,
    });
    // Newest schema first: the unit price (20260924200000) and the character, then without them.
    expect(selected).toEqual([
      `${LISTING_BASE_COLUMNS},${LISTING_UNIT_COLUMNS},${LISTING_CHARACTER_COLUMNS}`,
      `${LISTING_BASE_COLUMNS},${LISTING_CHARACTER_COLUMNS}`,
      LISTING_BASE_COLUMNS,
    ]);
    expect(isMissingColumn({ code: '42501' })).toBe(false);
  });
});
