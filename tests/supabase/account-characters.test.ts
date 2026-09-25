// Multi-character accounts (owner rule of 2026-09-24,
// supabase/migrations/20260924190000_account_characters.sql) against the LOCAL Supabase stack,
// with real local accounts: only the owner sees its characters, at most PERSONAJES_MAX per
// account, a player name is unique per world across accounts, a character with listings is not
// removed, a listing is published as one of the seller's own characters and takes its world, and
// Pokédólares stay under every world. The keys and the database address come from
// `supabase status` and must be loopback ones, so this file never reaches the remote project.
// What the API cannot do (simulating Discord, suspending, direct writes) runs as the database
// owner through `supabase db query --db-url`. It skips, with the reason in its title, only when
// the local stack does not answer or the migration is not applied.
import { execFileSync } from 'node:child_process';
import { randomInt, randomUUID } from 'node:crypto';

import mundos from '@content/mundos.json';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { toAnuncio } from '@/lib/supabase/trade';
import * as limits from '@/lib/trade/limits';
import { listedInWorld } from '@/lib/trade/types';

type LocalStack = { url: string; anonKey: string; serviceRoleKey: string; dbUrl: string };

const LOOPBACK = ['127.0.0.1', 'localhost', '[::1]'];

function readLocalStack(): LocalStack | string {
  let output: string;
  try {
    output = execFileSync('supabase', ['status', '-o', 'env'], {
      encoding: 'utf8',
      timeout: 30_000,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return 'no local stack reported by `supabase status` (run `supabase start`)';
  }
  const values = new Map<string, string>();
  for (const line of output.split(/\r?\n/)) {
    const match = /^([A-Z_]+)="?([^"]*)"?$/.exec(line.trim());
    if (match) values.set(match[1], match[2]);
  }
  const url = values.get('API_URL');
  const anonKey = values.get('ANON_KEY');
  const serviceRoleKey = values.get('SERVICE_ROLE_KEY');
  const dbUrl = values.get('DB_URL');
  if (!url || !anonKey || !serviceRoleKey || !dbUrl) {
    return '`supabase status` printed no API_URL, ANON_KEY, SERVICE_ROLE_KEY or DB_URL';
  }
  for (const address of [url, dbUrl]) {
    if (!LOOPBACK.includes(new URL(address).hostname)) {
      return `${new URL(address).host} is not a loopback address`;
    }
  }
  return { url, anonKey, serviceRoleKey, dbUrl };
}

async function detectLocalStack(): Promise<LocalStack | string> {
  const found = readLocalStack();
  if (typeof found === 'string') return found;
  try {
    const health = await fetch(`${found.url}/auth/v1/health`, {
      headers: { apikey: found.anonKey },
      signal: AbortSignal.timeout(5_000),
    });
    if (!health.ok) return `the local stack answered ${health.status}`;
  } catch {
    return `the local stack at ${found.url} does not answer`;
  }
  return found;
}

const detected = await detectLocalStack();
const stack = typeof detected === 'string' ? null : detected;

type Row = Record<string, unknown>;

/** One SQL statement on the local database, as its owner; the rows it returns. */
function sql(statement: string): Row[] {
  const output = execFileSync(
    'supabase',
    ['db', 'query', '--db-url', stack!.dbUrl, '--output-format', 'json', statement],
    { encoding: 'utf8', timeout: 60_000, stdio: ['ignore', 'pipe', 'pipe'] },
  ).trim();
  const json = output.slice(output.indexOf('{'));
  return json.startsWith('{') ? ((JSON.parse(json) as { rows?: Row[] }).rows ?? []) : [];
}

/** The error message of a statement that must fail. */
function sqlError(statement: string): string {
  try {
    sql(statement);
  } catch (error) {
    const failure = error as { stdout?: string; stderr?: string };
    return `${failure.stdout ?? ''}\n${failure.stderr ?? ''}`;
  }
  throw new Error(`The statement did not fail: ${statement}`);
}

const ready =
  stack !== null &&
  sql("select to_regclass('public.account_characters') is not null as present")[0]?.present ===
    true;
const title =
  typeof detected === 'string'
    ? `account characters, skipped: ${detected}`
    : ready
      ? 'account characters (owner rule 2026-09-24)'
      : 'account characters, skipped: the account_characters migration is not applied';

const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;
const uuidList = (ids: string[]) => `array[${ids.map(literal).join(', ')}]::uuid[]`;

const captcha = { captchaToken: 'XXXX.DUMMY.TOKEN.XXXX' };
const clientOptions = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
};

type Account = {
  id: string;
  email: string;
  username: string;
  player: string;
  device: string;
  client: SupabaseClient;
};

type Character = {
  id: string;
  player_name: string;
  world_key: string;
  is_main: boolean;
  listings: number;
};

const run = randomUUID().slice(0, 8);
const password = `Local-${randomUUID()}`;
const [moon, sun, titan1, titan2] = mundos.mundos.map((world) => world.id);
const DAY_MS = 86_400_000;
const DISCORD_EPOCH = 1_420_070_400_000n;

function discordId(days: number): string {
  const created = BigInt(Date.now() - days * DAY_MS);
  return (((created - DISCORD_EPOCH) << 22n) | BigInt(randomInt(0, 4_194_304))).toString();
}

function birthDate(years: number): string {
  const date = new Date(Date.now() - DAY_MS);
  date.setUTCFullYear(date.getUTCFullYear() - years);
  return date.toISOString().slice(0, 10);
}

/** An Items listing paid in Diamonds (no real money). */
function itemsListing(extra: Row = {}): Row {
  return {
    asset_type: 'items',
    asset: { item: 'fire-stone', cantidad: 1 },
    game_prices: [{ tipo: 'diamonds', cantidad: 5 }],
    negotiable: false,
    ...extra,
  };
}

/** A Pokédólares listing paid in Diamonds. */
function pokedolaresListing(extra: Row = {}): Row {
  return {
    asset_type: 'pokedolares',
    asset: { cantidad: 1_000_000 },
    game_prices: [{ tipo: 'diamonds', cantidad: 5 }],
    negotiable: false,
    ...extra,
  };
}

describe.skipIf(!ready)(title, { timeout: 240_000 }, () => {
  const admin = stack ? createClient(stack.url, stack.serviceRoleKey, clientOptions) : null!;
  const anon = stack ? createClient(stack.url, stack.anonKey, clientOptions) : null!;
  const accounts: Account[] = [];
  const orphanListings: string[] = [];

  let seller: Account;
  let other: Account;
  let collector: Account;
  let leaver: Account;
  let banned: Account;
  let sunCharacter: string;
  let sunListing: string;
  let pokedolaresListingId: string;

  async function createAccount(label: string): Promise<Account> {
    const email = `chars-${label}-${run}@example.com`;
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error || !created.data.user) throw created.error ?? new Error('No user');
    const account: Account = {
      id: created.data.user.id,
      email,
      username: `c-${run}-${label}`,
      player: `Char ${run} ${label}`,
      device: randomUUID(),
      client: createClient(stack!.url, stack!.anonKey, clientOptions),
    };
    accounts.push(account);
    const signedIn = await account.client.auth.signInWithPassword({
      email,
      password,
      options: captcha,
    });
    if (signedIn.error) throw signedIn.error;
    sql(
      `insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at) select id, ${literal(account.id)}, jsonb_build_object('sub', id, 'name', ${literal(`discord-${label}`)}), 'discord', now(), now(), now() from (select ${literal(discordId(400))} as id) as snowflake`,
    );
    const saved = await account.client.rpc('account_save_profile', {
      p_username: account.username,
      p_player_name: account.player,
      p_world_key: moon,
      p_country_code: 'MX',
      p_birth_date: birthDate(30),
      p_terms_version: limits.TERMINOS_VERSION,
    });
    expect({ label, error: saved.error }).toEqual({ label, error: null });
    const consent = await account.client.rpc('trade_accept_consent', {
      p_version: limits.CONSENTIMIENTO_DINERO_REAL_VERSION,
    });
    expect({ label, error: consent.error }).toEqual({ label, error: null });
    return account;
  }

  async function shareEmail(account: Account) {
    expect((await account.client.rpc('trade_sync_oauth_channels')).error).toBeNull();
    const shared = await account.client.rpc('trade_upsert_channel', {
      p_kind: 'email',
      p_platform: null,
      p_value: account.email,
      p_shared: true,
    });
    expect(shared.error).toBeNull();
  }

  async function characters(account: Account): Promise<Character[]> {
    const listed = await account.client.rpc('account_characters_list');
    expect(listed.error).toBeNull();
    return listed.data as Character[];
  }

  function publish(account: Account, payload: Row) {
    return account.client.rpc('trade_publish_listing', {
      p_listing: payload,
      p_device_id: account.device,
    });
  }

  function listingRow(id: string): Row {
    return sql(
      `select listing.world_key, listing.status::text as status, listing.character_id::text as character_id, owned.player_name from public.trade_listings as listing left join public.account_characters as owned on owned.id = listing.character_id where listing.listing_id = ${literal(id)}`,
    )[0];
  }

  beforeAll(async () => {
    [seller, other, collector, leaver, banned] = await Promise.all([
      createAccount('seller'),
      createAccount('other'),
      createAccount('collector'),
      createAccount('leaver'),
      createAccount('banned'),
    ]);
    await Promise.all([shareEmail(seller), shareEmail(leaver)]);
  }, 180_000);

  afterAll(async () => {
    if (!stack) return;
    const ids = accounts.map((account) => account.id);
    if (ids.length > 0) {
      const list = uuidList(ids);
      sql(
        `do $$ begin
          delete from public.trade_flags where user_ids && ${list};
          delete from public.trade_listings where seller_id = any (${list})${
            orphanListings.length > 0 ? ` or listing_id = any (${uuidList(orphanListings)})` : ''
          };
          delete from public.trade_action_evidence where user_id = any (${list});
          delete from public.trade_evidence_holds where user_id = any (${list});
        end $$`,
      );
    }
    for (const id of ids) await admin.auth.admin.deleteUser(id);
  }, 180_000);

  it('PERSONAJES_MAX is that of src/lib/trade/limits.ts; the table is RLS deny-by-default', () => {
    expect(
      sql("select value from public.app_parameters where name = 'PERSONAJES_MAX'")[0]?.value,
    ).toBe(limits.PERSONAJES_MAX);
    expect(
      sql(
        "select count(*)::int as grants from information_schema.role_table_grants where table_schema = 'public' and table_name = 'account_characters' and grantee in ('anon', 'authenticated') and privilege_type <> 'SELECT'",
      ),
    ).toEqual([{ grants: 0 }]);
    expect(
      sql(
        "select relrowsecurity as rls from pg_class where oid = 'public.account_characters'::regclass",
      ),
    ).toEqual([{ rls: true }]);
    expect(
      sql(
        "select count(*)::int as functions from pg_proc where pronamespace = 'public'::regnamespace and (proname like 'account\\_character%' or proname in ('trade_resolve_character', 'trade_listing_character')) and not coalesce(proconfig @> array['search_path=\"\"'], false)",
      ),
    ).toEqual([{ functions: 0 }]);
  });

  it('registration step 3 creates the main character, which the profile mirrors', async () => {
    expect(await characters(seller)).toMatchObject([
      { player_name: seller.player, world_key: moon, is_main: true, listings: 0 },
    ]);
    const profile = sql(
      `select player_name, world_key from public.account_profiles where user_id = ${literal(seller.id)}`,
    );
    expect(profile).toEqual([{ player_name: seller.player, world_key: moon }]);
  });

  it('only the owner reads its characters; nobody writes the table directly', async () => {
    const own = await seller.client.from('account_characters').select('player_name');
    expect(own.error).toBeNull();
    expect(own.data).toEqual([{ player_name: seller.player }]);

    const foreign = await other.client
      .from('account_characters')
      .select('player_name')
      .eq('user_id', seller.id);
    expect(foreign.error).toBeNull();
    expect(foreign.data).toEqual([]);

    const anonymous = await anon.from('account_characters').select('player_name').limit(1);
    expect(anonymous.error?.code).toBe('42501');
    const anonymousList = await anon.rpc('account_characters_list');
    expect(anonymousList.error).not.toBeNull();
    expect(anonymousList.data).toBeNull();

    const inserted = await seller.client
      .from('account_characters')
      .insert({ user_id: seller.id, player_name: `Forged ${run}`, world_key: sun });
    expect(inserted.error?.code).toBe('42501');
    const updated = await seller.client
      .from('account_characters')
      .update({ player_name: `Forged ${run}` })
      .eq('user_id', seller.id)
      .select();
    expect(updated.error?.code).toBe('42501');
  });

  it('a player name is unique per world across accounts, without regard to case', async () => {
    const taken = await other.client.rpc('account_character_add', {
      p_player_name: seller.player.toUpperCase(),
      p_world_key: moon,
    });
    expect(taken.error).toMatchObject({ code: '23505', message: 'player_name_taken' });

    const elsewhere = await other.client.rpc('account_character_add', {
      p_player_name: seller.player,
      p_world_key: titan2,
    });
    expect(elsewhere.error).toBeNull();
    expect(elsewhere.data as Character[]).toMatchObject([
      { player_name: other.player, is_main: true },
      { player_name: seller.player, world_key: titan2, is_main: false },
    ]);

    const invalid = await other.client.rpc('account_character_add', {
      p_player_name: '   ',
      p_world_key: moon,
    });
    expect(invalid.error).toMatchObject({ code: '22023', message: 'player_name_invalid' });
    const world = await other.client.rpc('account_character_add', {
      p_player_name: `Char ${run} bad world`,
      p_world_key: 'Titan 1',
    });
    expect(world.error).toMatchObject({ code: '22023', message: 'world_invalid' });
  });

  it('an account holds at most PERSONAJES_MAX characters', async () => {
    for (let index = 1; index < limits.PERSONAJES_MAX; index += 1) {
      const added = await collector.client.rpc('account_character_add', {
        p_player_name: `Char ${run} collected ${index}`,
        p_world_key: mundos.mundos[index % mundos.mundos.length].id,
      });
      expect({ index, error: added.error }).toEqual({ index, error: null });
    }
    expect(await characters(collector)).toHaveLength(limits.PERSONAJES_MAX);
    const eleventh = await collector.client.rpc('account_character_add', {
      p_player_name: `Char ${run} collected ${limits.PERSONAJES_MAX}`,
      p_world_key: moon,
    });
    expect(eleventh.error).toMatchObject({ code: '42501', message: 'character_limit' });
    // The limit holds for any insert, not only through the API.
    expect(
      sqlError(
        `insert into public.account_characters (user_id, player_name, world_key) values (${literal(collector.id)}, ${literal(`Char ${run} forced`)}, ${literal(moon)})`,
      ),
    ).toContain('character_limit');
  });

  it('«Principal» moves the header name and world; the profile mirrors it', async () => {
    const added = await seller.client.rpc('account_character_add', {
      p_player_name: `Char ${run} seller sun`,
      p_world_key: sun,
    });
    expect(added.error).toBeNull();
    const list = added.data as Character[];
    sunCharacter = list.find((character) => character.world_key === sun)!.id;
    expect(list.filter((character) => character.is_main)).toHaveLength(1);

    const moved = await seller.client.rpc('account_character_set_main', { p_id: sunCharacter });
    expect(moved.error).toBeNull();
    expect((moved.data as Character[])[0]).toMatchObject({ id: sunCharacter, is_main: true });
    const state = await seller.client.rpc('account_registration_state');
    expect((state.data as { profile: Row }).profile).toMatchObject({
      player_name: `Char ${run} seller sun`,
      world_key: sun,
    });

    const back = (await characters(seller)).find((character) => character.world_key === moon)!;
    expect((await seller.client.rpc('account_character_set_main', { p_id: back.id })).error).toBe(
      null,
    );
    const foreign = await other.client.rpc('account_character_set_main', { p_id: sunCharacter });
    expect(foreign.error).toMatchObject({ code: '42501', message: 'character_not_found' });
  });

  it('a listing is published as one of the seller’s own characters and takes its world', async () => {
    // The character decides the world: no world_key needed.
    const bySun = await publish(seller, itemsListing({ character_id: sunCharacter }));
    expect(bySun.error).toBeNull();
    sunListing = bySun.data as string;
    expect(listingRow(sunListing)).toMatchObject({
      world_key: sun,
      status: 'publicado',
      character_id: sunCharacter,
      player_name: `Char ${run} seller sun`,
    });

    // A world that is not the character's is refused, not silently moved.
    const mismatch = await publish(
      seller,
      itemsListing({ character_id: sunCharacter, world_key: moon }),
    );
    expect(mismatch.error).toMatchObject({ code: '22023', message: 'world_mismatch' });

    // Someone else's character is refused.
    const [foreign] = await characters(other);
    const stolen = await publish(seller, itemsListing({ character_id: foreign.id }));
    expect(stolen.error).toMatchObject({ code: '42501', message: 'character_not_found' });
    const malformed = await publish(seller, itemsListing({ character_id: 'main' }));
    expect(malformed.error).toMatchObject({ code: '22023', message: 'character_invalid' });
  });

  it('«Vendes como» is required for every type, Pokédólares included (20260924200000)', async () => {
    const main = (await characters(seller)).find((character) => character.is_main)!;
    // Without character_id nothing is published, whatever the world.
    const noCharacter = await publish(seller, itemsListing({ world_key: moon }));
    expect(noCharacter.error).toMatchObject({ code: '22023', message: 'character_required' });
    const noCharacterGold = await publish(seller, pokedolaresListing({ world_key: titan1 }));
    expect(noCharacterGold.error).toMatchObject({ code: '22023', message: 'character_required' });

    const bySun = await publish(seller, itemsListing({ character_id: sunCharacter }));
    expect(bySun.error).toBeNull();
    expect(listingRow(bySun.data as string)).toMatchObject({
      world_key: sun,
      character_id: sunCharacter,
    });

    // Pokédólares go as the chosen character, in its world; the list shows them under every one.
    const gold = await publish(seller, pokedolaresListing({ character_id: main.id }));
    expect(gold.error).toBeNull();
    pokedolaresListingId = gold.data as string;
    expect(listingRow(pokedolaresListingId)).toMatchObject({
      world_key: moon,
      character_id: main.id,
    });
  });

  it('«Editar» may move a listing to another own character; the world follows it', async () => {
    const main = (await characters(seller)).find((character) => character.is_main)!;
    const moved = await seller.client.rpc('trade_update_listing', {
      p_listing_id: sunListing,
      p_listing: itemsListing({ character_id: main.id }),
      p_device_id: seller.device,
    });
    expect(moved.error).toBeNull();
    expect(listingRow(sunListing)).toMatchObject({ world_key: moon, character_id: main.id });

    // Without character_id an edit is refused too.
    const bare = await seller.client.rpc('trade_update_listing', {
      p_listing_id: sunListing,
      p_listing: itemsListing({ world_key: sun }),
      p_device_id: seller.device,
    });
    expect(bare.error).toMatchObject({ code: '22023', message: 'character_required' });
    const back = await seller.client.rpc('trade_update_listing', {
      p_listing_id: sunListing,
      p_listing: itemsListing({ character_id: sunCharacter }),
      p_device_id: seller.device,
    });
    expect(back.error).toBeNull();
    expect(listingRow(sunListing)).toMatchObject({ world_key: sun, character_id: sunCharacter });

    // A direct write cannot pair a listing with a stranger's character either.
    const [foreign] = await characters(other);
    expect(
      sqlError(
        `update public.trade_listings set character_id = ${literal(foreign.id)} where listing_id = ${literal(sunListing)}`,
      ),
    ).toContain('character_not_found');
  });

  it('the public reads each listing with its character; Pokédólares are under every world', async () => {
    const read = await anon
      .from('trade_listings')
      .select(
        'listing_id,asset_type,world_key,status,asset,fiat_currency,fiat_amount,game_prices,negotiable,created_at,published_at,expires_at,character_id,character:trade_listing_character',
      )
      .eq('seller_id', seller.id);
    expect(read.error).toBeNull();
    const listings = (read.data as Row[]).map((row) => toAnuncio(row, seller.username)!);
    const sunOne = listings.find((listing) => listing.id === sunListing)!;
    expect(sunOne.character).toEqual({
      id: sunCharacter,
      playerName: `Char ${run} seller sun`,
      worldKey: sun,
    });
    const gold = listings.find((listing) => listing.id === pokedolaresListingId)!;
    expect(gold).toMatchObject({ tipo: 'pokedolares', mundo: moon });
    for (const world of mundos.mundos.map((entry) => entry.id)) {
      const shown = listings.filter((listing) => listedInWorld(listing, world));
      expect({ world, gold: shown.some((listing) => listing.id === gold.id) }).toEqual({
        world,
        gold: true,
      });
      expect({ world, sun: shown.some((listing) => listing.id === sunListing) }).toEqual({
        world,
        sun: world === sun,
      });
    }

    // Through /rpc, a forged row shows nothing: the function reads the stored listing again.
    const forged = await anon.rpc('trade_listing_character', {
      p_listing: { listing_id: randomUUID(), character_id: sunCharacter },
    });
    expect(forged.error).toBeNull();
    expect(forged.data).toBeNull();
  });

  it('a character with listings is not removed or renamed; the main one is not removed', async () => {
    const refused = await seller.client.rpc('account_character_remove', { p_id: sunCharacter });
    expect(refused.error).toMatchObject({ code: '22023', message: 'character_has_listings' });
    expect(
      (await characters(seller)).find((character) => character.id === sunCharacter),
    ).toMatchObject({ listings: 2 });

    // Not even the database owner deletes or renames it while the account exists.
    expect(
      sqlError(`delete from public.account_characters where id = ${literal(sunCharacter)}`),
    ).toContain('character_has_listings');
    expect(
      sqlError(
        `update public.account_characters set player_name = ${literal(`Renamed ${run}`)} where id = ${literal(sunCharacter)}`,
      ),
    ).toContain('character_has_listings');

    const main = (await characters(other)).find((character) => character.is_main)!;
    const mainRemoved = await other.client.rpc('account_character_remove', { p_id: main.id });
    expect(mainRemoved.error).toMatchObject({ code: '22023', message: 'character_is_main' });

    const spare = (await characters(other)).find((character) => !character.is_main)!;
    const foreign = await seller.client.rpc('account_character_remove', { p_id: spare.id });
    expect(foreign.error).toMatchObject({ code: '42501', message: 'character_not_found' });
    const removed = await other.client.rpc('account_character_remove', { p_id: spare.id });
    expect(removed.error).toBeNull();
    expect(removed.data as Character[]).toMatchObject([{ id: main.id, is_main: true }]);
  });

  it('«Editar perfil» with a new name adds a main character when the main one has listings', async () => {
    const before = await characters(seller);
    const main = before.find((character) => character.is_main)!;
    expect(main.listings).toBeGreaterThan(0);
    const saved = await seller.client.rpc('account_save_profile', {
      p_username: seller.username,
      p_player_name: `Char ${run} seller renamed`,
      p_world_key: moon,
      p_country_code: 'MX',
      p_birth_date: null,
      p_terms_version: null,
    });
    expect(saved.error).toBeNull();
    const after = await characters(seller);
    expect(after).toHaveLength(before.length + 1);
    expect(after[0]).toMatchObject({ player_name: `Char ${run} seller renamed`, is_main: true });
    expect(after.find((character) => character.id === main.id)).toMatchObject({
      player_name: main.player_name,
      is_main: false,
    });

    // A single-character account without listings renames its character in place, as before.
    const renamed = await other.client.rpc('account_save_profile', {
      p_username: other.username,
      p_player_name: `Char ${run} other renamed`,
      p_world_key: sun,
      p_country_code: 'MX',
      p_birth_date: null,
      p_terms_version: null,
    });
    expect(renamed.error).toBeNull();
    expect(await characters(other)).toMatchObject([
      { player_name: `Char ${run} other renamed`, world_key: sun, is_main: true },
    ]);
  });

  it('a suspended account keeps its characters: no add, remove or «Principal»', async () => {
    sql(`select public.trade_suspend_account(${literal(banned.id)}, null)`);
    const added = await banned.client.rpc('account_character_add', {
      p_player_name: `Char ${run} banned alt`,
      p_world_key: sun,
    });
    expect(added.error).toMatchObject({ code: '42501', message: 'suspended' });
    const [main] = await characters(banned);
    const removed = await banned.client.rpc('account_character_remove', { p_id: main.id });
    expect(removed.error).toMatchObject({ code: '42501', message: 'suspended' });
  });

  it('deleting an account with listings still works; its listings are withdrawn', async () => {
    const [leaverMain] = await characters(leaver);
    const published = await publish(leaver, itemsListing({ character_id: leaverMain.id }));
    expect(published.error).toBeNull();
    const listingId = published.data as string;
    orphanListings.push(listingId);

    const deleted = await leaver.client.rpc('account_delete');
    expect(deleted).toMatchObject({ data: 'deleted', error: null });
    expect(listingRow(listingId)).toMatchObject({ status: 'retirado', character_id: null });
    expect(
      sql(
        `select count(*)::int as characters from public.account_characters where user_id = ${literal(leaver.id)}`,
      ),
    ).toEqual([{ characters: 0 }]);
  });
});
