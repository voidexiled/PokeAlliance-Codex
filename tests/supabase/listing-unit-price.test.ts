// Price per unit and the buyer's world (owner rules of 2026-09-24,
// supabase/migrations/20260924200000_listing_unit_price.sql) against the LOCAL Supabase stack:
// the database stores the unit price the seller wrote and the totals it computes exactly as
// src/lib/trade/unit-price.ts does, a new quantity gives new totals, a Pokémon or «A convenir»
// takes no unit price, and «Contactar al vendedor» needs a character of the buyer in the
// listing's world, except for Pokédólares. The keys and the database address come from
// `supabase status` and must be loopback ones, so this file never reaches the remote project.
// It skips, with the reason in its title, when the local stack does not answer or the migration
// is not applied.
import { execFileSync } from 'node:child_process';
import { randomInt, randomUUID } from 'node:crypto';

import mundos from '@content/mundos.json';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { toAnuncio } from '@/lib/supabase/trade';
import * as limits from '@/lib/trade/limits';
import { fiatTotal, gameTotal } from '@/lib/trade/unit-price';

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
  sql(
    "select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'trade_listings' and column_name = 'unit_quantity') as present",
  )[0]?.present === true;
const title =
  typeof detected === 'string'
    ? `unit price and buyer world, skipped: ${detected}`
    : ready
      ? 'unit price and buyer world (owner rules 2026-09-24)'
      : 'unit price and buyer world, skipped: the listing_unit_price migration is not applied';

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

const run = randomUUID().slice(0, 8);
const password = `Local-${randomUUID()}`;
const [moon, sun] = mundos.mundos.map((world) => world.id);
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

describe.skipIf(!ready)(title, { timeout: 240_000 }, () => {
  const admin = stack ? createClient(stack.url, stack.serviceRoleKey, clientOptions) : null!;
  const anon = stack ? createClient(stack.url, stack.anonKey, clientOptions) : null!;
  const accounts: Account[] = [];

  let seller: Account;
  let buyer: Account;
  let sellerSun: string;

  async function createAccount(label: string): Promise<Account> {
    const email = `unit-${label}-${run}@example.com`;
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error || !created.data.user) throw created.error ?? new Error('No user');
    const account: Account = {
      id: created.data.user.id,
      email,
      username: `u-${run}-${label}`,
      player: `Unit ${run} ${label}`,
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
    expect((await account.client.rpc('trade_sync_oauth_channels')).error).toBeNull();
    const shared = await account.client.rpc('trade_upsert_channel', {
      p_kind: 'email',
      p_platform: null,
      p_value: account.email,
      p_shared: true,
    });
    expect(shared.error).toBeNull();
    return account;
  }

  /** «Vendes como» is required: the payload goes as the main character unless it names one. */
  async function asCharacter(account: Account, payload: Row): Promise<Row> {
    if ('character_id' in payload) return payload;
    const listed = await account.client.rpc('account_characters_list');
    expect(listed.error).toBeNull();
    const main = (listed.data as { id: string; is_main: boolean }[]).find((row) => row.is_main)!;
    return { ...payload, character_id: main.id };
  }

  async function publish(account: Account, payload: Row) {
    return account.client.rpc('trade_publish_listing', {
      p_listing: await asCharacter(account, payload),
      p_device_id: account.device,
    });
  }

  async function update(account: Account, id: string, payload: Row) {
    return account.client.rpc('trade_update_listing', {
      p_listing_id: id,
      p_listing: await asCharacter(account, payload),
      p_device_id: account.device,
    });
  }

  function stored(id: string): Row {
    return sql(
      `select fiat_amount::text as fiat, game_prices as game, unit_quantity as unit, unit_fiat_amount::text as unit_fiat, unit_game_prices as unit_game, world_key from public.trade_listings where listing_id = ${literal(id)}`,
    )[0];
  }

  beforeAll(async () => {
    [seller, buyer] = await Promise.all([createAccount('seller'), createAccount('buyer')]);
    const added = await seller.client.rpc('account_character_add', {
      p_player_name: `Unit ${run} seller sun`,
      p_world_key: sun,
    });
    expect(added.error).toBeNull();
    sellerSun = (added.data as { id: string; world_key: string }[]).find(
      (character) => character.world_key === sun,
    )!.id;
  }, 180_000);

  afterAll(async () => {
    if (!stack) return;
    const ids = accounts.map((account) => account.id);
    if (ids.length > 0) {
      const list = uuidList(ids);
      sql(
        `do $$ begin
          delete from public.trade_flags where user_ids && ${list};
          delete from public.trade_transactions where seller_id = any (${list}) or buyer_id = any (${list});
          delete from public.trade_listings where seller_id = any (${list});
          delete from public.trade_action_evidence where user_id = any (${list});
          delete from public.trade_evidence_holds where user_id = any (${list});
        end $$`,
      );
    }
    for (const id of ids) await admin.auth.admin.deleteUser(id);
  }, 180_000);

  it('keeps the unit price and stores the totals unit-price.ts computes', async () => {
    const diamonds = await publish(seller, {
      asset_type: 'diamonds',
      asset: { cantidad: 120 },
      fiat_currency: 'MXN',
      fiat_amount: '10',
      game_prices: [{ tipo: 'pokedolares', cantidad: 300_000 }],
      negotiable: false,
      unit_quantity: 10,
    });
    expect(diamonds.error).toBeNull();
    expect(fiatTotal('10', 120, 10)).toBe('120');
    expect(gameTotal(300_000, 120, 10)).toBe(3_600_000);
    expect(stored(diamonds.data as string)).toMatchObject({
      fiat: '120.00',
      game: [{ tipo: 'pokedolares', cantidad: 3_600_000 }],
      unit: 10,
      unit_fiat: '10.00',
      unit_game: [{ tipo: 'pokedolares', cantidad: 300_000 }],
    });

    // 50kk at MX$ 1.80 per 1kk and 3 Diamonds per 1kk.
    const pokedolares = await publish(seller, {
      asset_type: 'pokedolares',
      asset: { cantidad: 50_000_000 },
      fiat_currency: 'MXN',
      fiat_amount: '1.80',
      game_prices: [{ tipo: 'diamonds', cantidad: 3 }],
      negotiable: false,
      unit_quantity: 1_000_000,
    });
    expect(pokedolares.error).toBeNull();
    expect(fiatTotal('1.80', 50_000_000, 1_000_000)).toBe('90');
    expect(stored(pokedolares.data as string)).toMatchObject({
      fiat: '90.00',
      game: [{ tipo: 'diamonds', cantidad: 150 }],
    });

    // Half up: 125 × 3.33 / 10 = 41.625 → 41.63; 125 × 7 / 10 = 87.5 → 88.
    const rounded = await publish(seller, {
      asset_type: 'items',
      asset: { item: 'fire-stone', cantidad: 125 },
      fiat_currency: 'USD',
      fiat_amount: '3.33',
      game_prices: [{ tipo: 'diamonds', cantidad: 7 }],
      negotiable: false,
      unit_quantity: 10,
    });
    expect(rounded.error).toBeNull();
    expect(fiatTotal('3.33', 125, 10)).toBe('41.63');
    expect(gameTotal(7, 125, 10)).toBe(88);
    expect(stored(rounded.data as string)).toMatchObject({
      fiat: '41.63',
      game: [{ tipo: 'diamonds', cantidad: 88 }],
    });

    // The public reads it, and the site maps it to `porUnidad` beside the totals.
    const read = await anon
      .from('trade_listings')
      .select(
        'listing_id,asset_type,world_key,status,asset,fiat_currency,fiat_amount,game_prices,negotiable,created_at,published_at,expires_at,unit_quantity,unit_fiat_amount,unit_game_prices',
      )
      .eq('listing_id', pokedolares.data as string);
    expect(read.error).toBeNull();
    const anuncio = toAnuncio((read.data as Row[])[0], seller.username);
    expect(anuncio?.precio).toEqual({
      real: { moneda: 'MXN', importe: '90' },
      juego: [{ tipo: 'diamonds', cantidad: 150 }],
      aConvenir: false,
      porUnidad: {
        cantidad: 1_000_000,
        real: { moneda: 'MXN', importe: '1.80' },
        juego: [{ tipo: 'diamonds', cantidad: 3 }],
      },
    });
  });

  it('a new quantity gives new totals; a total price clears the unit price', async () => {
    const payload = {
      asset_type: 'diamonds',
      asset: { cantidad: 120 },
      fiat_currency: 'MXN',
      fiat_amount: '10',
      game_prices: [],
      negotiable: false,
      unit_quantity: 10,
    };
    const published = await publish(seller, payload);
    expect(published.error).toBeNull();
    const id = published.data as string;

    // Sold 60 of 120: the seller lowers the quantity.
    const lowered = await update(seller, id, { ...payload, asset: { cantidad: 60 } });
    expect(lowered.error).toBeNull();
    expect(stored(id)).toMatchObject({ fiat: '60.00', unit: 10, unit_fiat: '10.00' });

    const total = await update(seller, id, {
      asset_type: 'diamonds',
      asset: { cantidad: 60 },
      fiat_currency: 'MXN',
      fiat_amount: '55',
      game_prices: [],
      negotiable: false,
    });
    expect(total.error).toBeNull();
    expect(stored(id)).toMatchObject({
      fiat: '55.00',
      unit: null,
      unit_fiat: null,
      unit_game: null,
    });
  });

  it('refuses a unit price on a Pokémon, with «A convenir» or with a total under 1', async () => {
    const pokemon = await publish(seller, {
      asset_type: 'pokemon',
      asset: { pokemon: 'charizard' },
      fiat_currency: 'USD',
      fiat_amount: '5',
      negotiable: false,
      unit_quantity: 1,
    });
    expect(pokemon.error).toMatchObject({ code: '22023', message: 'price_invalid' });

    const negotiable = await publish(seller, {
      asset_type: 'diamonds',
      asset: { cantidad: 10 },
      negotiable: true,
      unit_quantity: 1,
    });
    expect(negotiable.error).toMatchObject({ code: '22023', message: 'price_invalid' });

    // 1 Diamond per 1000 of 10 rounds to 0: no total.
    const zero = await publish(seller, {
      asset_type: 'items',
      asset: { item: 'fire-stone', cantidad: 10 },
      game_prices: [{ tipo: 'diamonds', cantidad: 1 }],
      negotiable: false,
      unit_quantity: 1000,
    });
    expect(gameTotal(1, 10, 1000)).toBeNull();
    expect(zero.error).toMatchObject({ code: '22023', message: 'price_invalid' });

    expect(
      sqlError(
        `update public.trade_listings set unit_quantity = 5 where seller_id = ${literal(seller.id)} and asset_type = 'diamonds' and unit_quantity is null`,
      ),
    ).toContain('trade_listings_unit_price_shape');
  });

  it('«Contactar» needs a character of the buyer in the world, except for Pokédólares', async () => {
    const items = await publish(seller, {
      character_id: sellerSun,
      asset_type: 'items',
      asset: { item: 'fire-stone', cantidad: 1 },
      game_prices: [{ tipo: 'diamonds', cantidad: 5 }],
      negotiable: false,
    });
    expect(items.error).toBeNull();
    const coins = await publish(seller, {
      character_id: sellerSun,
      asset_type: 'pokedolares',
      asset: { cantidad: 1_000_000 },
      game_prices: [{ tipo: 'diamonds', cantidad: 5 }],
      negotiable: false,
    });
    expect(coins.error).toBeNull();
    expect(stored(items.data as string).world_key).toBe(sun);

    const contact = (id: string) =>
      buyer.client.rpc('trade_start_transaction', {
        p_listing_id: id,
        p_device_id: buyer.device,
      });

    // The buyer has only a Moon character.
    const refused = await contact(items.data as string);
    expect(refused.error).toMatchObject({ code: '42501', message: 'buyer_world_required' });
    const anyWorld = await contact(coins.data as string);
    expect(anyWorld.error).toBeNull();

    const added = await buyer.client.rpc('account_character_add', {
      p_player_name: `Unit ${run} buyer sun`,
      p_world_key: sun,
    });
    expect(added.error).toBeNull();
    const opened = await contact(items.data as string);
    expect(opened.error).toBeNull();
    expect(typeof opened.data).toBe('string');
  });
});
