// Comercio phase B (§9.12.2, CA-9.14 to CA-9.16, §9.15.9 items 5-7) against the LOCAL Supabase
// stack, with the six personas of §9.12.2: anonymous, signed in without the three steps, seller,
// buyer with a transaction, verified third party and moderator. The keys and the database address
// come from `supabase status` and must be loopback ones, so this file never reaches the remote
// project. What the API cannot do (simulating Discord identities, adding a moderator, writing old
// rows for the patterns) runs as the database owner through `supabase db query --db-url`. It skips,
// with the reason in its title, only when the local stack does not answer.
import { execFileSync } from 'node:child_process';
import { randomInt, randomUUID } from 'node:crypto';

import mundos from '@content/mundos.json';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import * as limits from '@/lib/trade/limits';

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
  sql("select to_regclass('public.trade_listings') is not null as present")[0]?.present === true;
const title =
  typeof detected === 'string'
    ? `trade marketplace RLS (§9.12.2), skipped: ${detected}`
    : ready
      ? 'trade marketplace RLS (§9.12.2, §9.15.9)'
      : 'trade marketplace RLS (§9.12.2), skipped: the trade_marketplace migration is not applied';

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
  device: string;
  client: SupabaseClient;
};

const run = randomUUID().slice(0, 8);
const password = `Local-${randomUUID()}`;
const worldId = mundos.mundos[0].id;
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

/** A listing paid in Pokédólares only (no real money, so no consent is needed). */
const gameListing = {
  asset_type: 'items',
  world_key: worldId,
  asset: { item: null, nombre: 'Fire Stone', cantidad: 3 },
  fiat_currency: null,
  fiat_amount: null,
  game_prices: [{ tipo: 'pokedolares', cantidad: 50_000_000 }],
  negotiable: false,
};

const ITEMS_ASSET = `'{"item": null, "nombre": "Fire Stone", "cantidad": 1}'::jsonb`;

describe.skipIf(!ready)(title, { timeout: 240_000 }, () => {
  const admin = stack ? createClient(stack.url, stack.serviceRoleKey, clientOptions) : null!;
  const anon = stack ? createClient(stack.url, stack.anonKey, clientOptions) : null!;
  const accounts: Account[] = [];
  const extraUsers: string[] = [];
  const sharedIp = '203.0.113.7';

  // The six personas, plus the accounts of the alert patterns.
  let unverified: Account;
  let seller: Account;
  let buyer: Account;
  let third: Account;
  let moderator: Account;
  let listingId: string;
  let firstDeal: string;

  async function createAccount(
    label: string,
    options: { eligible?: boolean; device?: string; headers?: Record<string, string> } = {},
  ): Promise<Account> {
    const email = `trade-${label}-${run}@example.com`;
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error || !created.data.user) throw created.error ?? new Error('No user');
    const account: Account = {
      id: created.data.user.id,
      email,
      username: `t-${run}-${label}`,
      device: options.device ?? randomUUID(),
      client: createClient(stack!.url, stack!.anonKey, {
        ...clientOptions,
        global: { headers: options.headers ?? {} },
      }),
    };
    accounts.push(account);
    const signedIn = await account.client.auth.signInWithPassword({
      email,
      password,
      options: captcha,
    });
    if (signedIn.error) throw signedIn.error;
    if (options.eligible === false) return account;

    sql(
      `insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at) select id, ${literal(account.id)}, jsonb_build_object('sub', id, 'name', ${literal(`discord-${label}`)}), 'discord', now(), now(), now() from (select ${literal(discordId(400))} as id) as snowflake`,
    );
    const saved = await account.client.rpc('account_save_profile', {
      p_username: account.username,
      p_player_name: `Trader ${run} ${label}`,
      p_world_key: worldId,
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

  /** A seller shares its confirmed e-mail as a verified contact channel. */
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

  async function publish(account: Account, payload: Row = gameListing): Promise<string> {
    const published = await account.client.rpc('trade_publish_listing', {
      p_listing: payload,
      p_device_id: account.device,
    });
    expect(published.error).toBeNull();
    return published.data as string;
  }

  async function contact(account: Account, listing: string): Promise<string> {
    const started = await account.client.rpc('trade_start_transaction', {
      p_listing_id: listing,
      p_device_id: account.device,
    });
    expect(started.error).toBeNull();
    return started.data as string;
  }

  async function confirm(account: Account, deal: string) {
    const confirmed = await account.client.rpc('trade_confirm_transaction', {
      p_transaction_id: deal,
      p_device_id: account.device,
    });
    expect(confirmed.error).toBeNull();
    return confirmed.data as string;
  }

  async function confirmedDeal(sellerAccount: Account, buyerAccount: Account, listing: string) {
    const deal = await contact(buyerAccount, listing);
    await confirm(buyerAccount, deal);
    expect(await confirm(sellerAccount, deal)).toBe('confirmada');
    return deal;
  }

  function review(account: Account, deal: string, score: number, comment: string | null = null) {
    return account.client.rpc('trade_submit_review', {
      p_transaction_id: deal,
      p_score: score,
      p_comment: comment,
      p_device_id: account.device,
    });
  }

  function openFlags(kind: string, userIds: string[]): Row[] {
    return sql(
      `select flag_id, user_ids::text[] as user_ids, device_id::text as device_id from public.trade_flags where status = 'open' and kind = ${literal(kind)} and user_ids @> ${uuidList(userIds)}`,
    );
  }

  beforeAll(async () => {
    [unverified, seller, buyer, third, moderator] = await Promise.all([
      createAccount('unverified', { eligible: false }),
      createAccount('seller'),
      createAccount('buyer'),
      createAccount('third'),
      createAccount('moderator'),
    ]);
    sql(`insert into public.trade_moderators (user_id) values (${literal(moderator.id)})`);
    await shareEmail(seller);
    listingId = await publish(seller);
  }, 180_000);

  afterAll(async () => {
    if (!stack) return;
    const ids = [...accounts.map((account) => account.id), ...extraUsers];
    if (ids.length > 0) {
      const list = uuidList(ids);
      sql(
        `do $$ begin
          delete from public.trade_flags where user_ids && ${list};
          alter table public.trade_moderation_events disable trigger trade_moderation_events_append_only;
          delete from public.trade_moderation_events where moderator_id = any (${list}) or target_id = any (${list});
          alter table public.trade_moderation_events enable trigger trade_moderation_events_append_only;
          delete from public.trade_reports where reporter_id = any (${list})
            or transaction_id in (select transaction_id from public.trade_transactions where seller_id = any (${list}) or buyer_id = any (${list}));
          delete from public.trade_reviews where reviewer_id = any (${list}) or reviewee_id = any (${list});
          delete from public.trade_transactions where seller_id = any (${list}) or buyer_id = any (${list});
          delete from public.trade_listings where seller_id = any (${list});
          delete from public.trade_action_evidence where user_id = any (${list});
          delete from public.trade_evidence_holds where user_id = any (${list});
        end $$`,
      );
    }
    for (const id of ids) await admin.auth.admin.deleteUser(id);
  }, 180_000);

  it('the SQL parameters of §9.12.6 are those of src/lib/trade/limits.ts', () => {
    const rows = sql('select name, value from public.app_parameters order by name');
    expect(Object.fromEntries(rows.map((row) => [row.name, row.value]))).toMatchObject({
      ANUNCIO_DIAS_VIGENCIA: limits.ANUNCIO_DIAS_VIGENCIA,
      ANUNCIOS_ACTIVOS_MAX: limits.ANUNCIOS_ACTIVOS_MAX,
      ANUNCIOS_NUEVOS_24H: limits.ANUNCIOS_NUEVOS_24H,
      OPERACIONES_NUEVAS_24H: limits.OPERACIONES_NUEVAS_24H,
      REPORTES_24H: limits.REPORTES_24H,
      RESENA_DIAS: limits.RESENA_DIAS,
      RESENA_EDICION_DIAS: limits.RESENA_EDICION_DIAS,
      OPERACION_CADUCIDAD_DIAS: limits.OPERACION_CADUCIDAD_DIAS,
      RESENAS_PAR_DIA: limits.RESENAS_PAR_DIA,
    });
  });

  it('no API role writes a trade table, and every function has an empty search_path', () => {
    const writes = sql(
      "select count(*)::int as grants from information_schema.role_table_grants where table_schema = 'public' and table_name like 'trade\\_%' and grantee in ('anon', 'authenticated') and privilege_type <> 'SELECT'",
    );
    expect(writes).toEqual([{ grants: 0 }]);
    const unsafe = sql(
      "select count(*)::int as functions from pg_proc where pronamespace = 'public'::regnamespace and proname like 'trade\\_%' and not coalesce(proconfig @> array['search_path=\"\"'], false)",
    );
    expect(unsafe).toEqual([{ functions: 0 }]);
    const noRls = sql(
      "select count(*)::int as tables from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' and relname like 'trade\\_%' and not relrowsecurity",
    );
    expect(noRls).toEqual([{ tables: 0 }]);
  });

  it('anon reads public listings and channel labels, never a channel value', async () => {
    const listings = await anon
      .from('trade_listings')
      .select('listing_id')
      .eq('seller_id', seller.id);
    expect(listings.error).toBeNull();
    expect(listings.data).toEqual([{ listing_id: listingId }]);

    const labels = await anon
      .from('trade_contact_channels')
      .select('kind, public_label')
      .eq('user_id', seller.id);
    expect(labels.error).toBeNull();
    expect(labels.data).toEqual([{ kind: 'email', public_label: null }]);

    for (const client of [anon, third.client]) {
      const values = await client
        .from('trade_contact_channels')
        .select('value')
        .eq('user_id', seller.id);
      expect(values.error?.code).toBe('42501');
    }
  });

  it('anon reads no transaction or review directly', async () => {
    for (const table of ['trade_transactions', 'trade_reviews', 'trade_reports', 'trade_flags']) {
      const read = await anon.from(table).select('*').limit(1);
      expect({ table, code: read.error?.code }).toEqual({ table, code: '42501' });
    }
  });

  it('an account without the three steps cannot publish or contact (42501)', async () => {
    const published = await unverified.client.rpc('trade_publish_listing', {
      p_listing: gameListing,
      p_device_id: unverified.device,
    });
    expect(published.error).toMatchObject({ code: '42501', message: 'account_incomplete' });
    const started = await unverified.client.rpc('trade_start_transaction', {
      p_listing_id: listingId,
      p_device_id: unverified.device,
    });
    expect(started.error).toMatchObject({ code: '42501', message: 'account_incomplete' });
  });

  it('CA-9.16: after contacting, the buyer reads the seller values; a third party does not', async () => {
    firstDeal = await contact(buyer, listingId);
    expect(await contact(buyer, listingId)).toBe(firstDeal);

    const contacts = await buyer.client.rpc('trade_transaction_contacts', {
      p_transaction_id: firstDeal,
    });
    expect(contacts.error).toBeNull();
    expect(contacts.data).toEqual([
      { kind: 'email', platform: null, public_label: null, value: seller.email },
    ]);

    const foreign = await third.client.rpc('trade_transaction_contacts', {
      p_transaction_id: firstDeal,
    });
    expect(foreign.error).toMatchObject({ code: '42501', message: 'transaction_not_found' });

    const thirdView = await third.client.from('trade_transactions').select('transaction_id');
    expect(thirdView.data).toEqual([]);
    for (const party of [buyer, seller, moderator]) {
      const view = await party.client
        .from('trade_transactions')
        .select('transaction_id')
        .eq('transaction_id', firstDeal);
      expect(view.data).toEqual([{ transaction_id: firstDeal }]);
    }
    const number = sql(
      `select number from public.trade_transactions where transaction_id = ${literal(firstDeal)}`,
    )[0].number;
    expect(Number(number)).toBeGreaterThan(0);
  });

  it('no review before the transaction is confirmada', async () => {
    const early = await review(buyer, firstDeal, 5);
    expect(early.error).toMatchObject({ code: '42501', message: 'transaction_not_confirmed' });
  });

  it('item 5: buyer and seller review each other once, 1 to 5; the 4th deal of the day admits none', async () => {
    await confirm(buyer, firstDeal);
    expect(await confirm(seller, firstDeal)).toBe('confirmada');

    expect((await review(buyer, firstDeal, 5, 'Rápido.')).error).toBeNull();
    expect((await review(seller, firstDeal, 4)).error).toBeNull();
    expect((await review(buyer, firstDeal, 4)).error).toMatchObject({
      code: '23505',
      message: 'review_exists',
    });
    for (const score of [0, 6]) {
      expect((await review(seller, firstDeal, score)).error).toMatchObject({
        code: '22023',
        message: 'score_invalid',
      });
    }
    expect(
      sqlError(
        `update public.trade_reviews set score = 6 where transaction_id = ${literal(firstDeal)}`,
      ),
    ).toContain('trade_reviews_score_check');

    const second = await confirmedDeal(seller, buyer, listingId);
    const third_ = await confirmedDeal(seller, buyer, listingId);
    const fourth = await confirmedDeal(seller, buyer, listingId);
    expect((await review(buyer, second, 3)).error).toBeNull();
    expect((await review(buyer, third_, 4)).error).toBeNull();
    expect((await review(buyer, fourth, 5)).error).toMatchObject({
      code: '42501',
      message: 'review_cap_reached',
    });
    expect((await review(seller, fourth, 5)).error).toMatchObject({
      code: '42501',
      message: 'review_cap_reached',
    });

    const mine = await buyer.client.rpc('trade_my_transactions');
    expect(mine.error).toBeNull();
    const byId = new Map((mine.data as Row[]).map((row) => [row.transaction_id, row]));
    expect(byId.get(fourth)).toMatchObject({
      status: 'confirmada',
      reviewable: false,
      role: 'buyer',
    });
    expect(byId.get(firstDeal)).toMatchObject({
      review_score: 5,
      reviewable: false,
      counterpart_handle: seller.username,
    });
  });

  it('the seller cannot trade with or review itself', async () => {
    const own = await seller.client.rpc('trade_start_transaction', {
      p_listing_id: listingId,
      p_device_id: seller.device,
    });
    expect(own.error).toMatchObject({ code: '22023', message: 'self_trade' });
    expect(
      sqlError(
        `update public.trade_reviews set reviewee_id = reviewer_id where transaction_id = ${literal(firstDeal)}`,
      ),
    ).toContain('trade_reviews_not_self');
  });

  it('CA-9.15: public reviews and stats exclude hidden reviews and match the moderator view', async () => {
    const hiddenId = sql(
      `select review_id from public.trade_reviews where reviewee_id = ${literal(seller.id)} and reviewer_role = 'buyer' and score = 4`,
    )[0].review_id as string;
    const hidden = await moderator.client.rpc('trade_moderate', {
      p_action: 'hide_review',
      p_target_type: 'review',
      p_target_id: hiddenId,
      p_reason: 'Prueba local',
    });
    expect(hidden.error).toBeNull();

    const reviews = await anon.rpc('trade_public_reviews', {
      p_seller_id: seller.id,
      p_limit: 10,
      p_offset: 0,
    });
    expect(reviews.error).toBeNull();
    const rows = reviews.data as Row[];
    expect(rows.map((row) => row.score).sort()).toEqual([3, 5]);
    for (const row of rows) {
      expect(row.reviewer_handle).toBe(buyer.username);
      expect(row).not.toHaveProperty('reviewer_id');
      expect(row.asset_type).toBe('items');
    }

    const stats = await anon.rpc('trade_seller_stats', { p_seller_id: seller.id });
    expect(stats.error).toBeNull();
    const direct = await moderator.client
      .from('trade_reviews')
      .select('score')
      .eq('reviewee_id', seller.id)
      .eq('reviewer_role', 'buyer')
      .eq('hidden', false);
    const scores = (direct.data as { score: number }[]).map((row) => row.score);
    expect(stats.data).toEqual([
      {
        operaciones: 4,
        resenas: scores.length,
        contrapartes: 1,
        media: scores.reduce((sum, value) => sum + value, 0) / scores.length,
        d1: 0,
        d2: 0,
        d3: 1,
        d4: 0,
        d5: 1,
      },
    ]);

    const buyerStats = await anon.rpc('trade_buyer_stats', { p_buyer_id: buyer.id });
    expect(buyerStats.data).toMatchObject([
      { operaciones: 4, resenas: 1, contrapartes: 1, media: 4 },
    ]);

    // The reviewed seller still reads the hidden review; the public never does.
    const received = await seller.client.rpc('trade_my_reviews', {
      p_direction: 'received',
      p_limit: 10,
      p_offset: 0,
    });
    expect((received.data as Row[]).some((row) => row.hidden === true)).toBe(true);
  });

  it('item 6: the mean counts each counterpart once (40 × 5 and 1 × 1 give 3.0)', async () => {
    const rated = await createAccount('rated');
    const reviewers: string[] = [];
    for (const label of ['fan', 'critic']) {
      const created = await admin.auth.admin.createUser({
        email: `trade-${label}-${run}@example.com`,
        password,
        email_confirm: true,
      });
      if (created.error || !created.data.user) throw created.error ?? new Error('No user');
      reviewers.push(created.data.user.id);
      extraUsers.push(created.data.user.id);
    }
    const [fan, critic] = reviewers.map(literal);
    sql(
      `with listing as (
        insert into public.trade_listings (seller_id, asset_type, world_key, asset, game_prices, expires_at)
        values (${literal(rated.id)}, 'items', ${literal(worldId)}, ${ITEMS_ASSET}, '[{"tipo": "diamonds", "cantidad": 5}]', now() + interval '14 days')
        returning listing_id
      ), deals as (
        insert into public.trade_transactions (listing_id, seller_id, buyer_id, status, reviewable, closed_at)
        select listing.listing_id, ${literal(rated.id)}, case when n <= 40 then ${fan}::uuid else ${critic}::uuid end, 'confirmada', true, now()
        from listing, generate_series(1, 41) as n
        returning transaction_id, listing_id, buyer_id
      )
      insert into public.trade_reviews (transaction_id, listing_id, reviewer_id, reviewee_id, reviewer_role, score)
      select transaction_id, listing_id, buyer_id, ${literal(rated.id)}, 'buyer', case when buyer_id = ${critic}::uuid then 1 else 5 end
      from deals`,
    );
    const stats = await anon.rpc('trade_seller_stats', { p_seller_id: rated.id });
    expect(stats.error).toBeNull();
    expect(stats.data).toEqual([
      {
        operaciones: 41,
        resenas: 41,
        contrapartes: 2,
        media: 3,
        d1: 1,
        d2: 0,
        d3: 0,
        d4: 0,
        d5: 40,
      },
    ]);
  });

  it('only a moderator moderates or writes trade_moderation_events', async () => {
    const attempt = await third.client.rpc('trade_moderate', {
      p_action: 'warn',
      p_target_type: 'user',
      p_target_id: seller.id,
      p_reason: 'Prueba',
    });
    expect(attempt.error).toMatchObject({ code: '42501', message: 'moderator_required' });

    for (const account of [third, moderator]) {
      const inserted = await account.client.from('trade_moderation_events').insert({
        moderator_id: account.id,
        action: 'warn',
        target_type: 'user',
        target_id: seller.id,
        reason: 'Prueba',
      });
      expect(inserted.error?.code).toBe('42501');
    }

    const events = await moderator.client.from('trade_moderation_events').select('action');
    expect((events.data as Row[]).some((row) => row.action === 'hide_review')).toBe(true);
    expect((await third.client.from('trade_moderation_events').select('action')).data).toEqual([]);
    expect(
      sqlError(
        `update public.trade_moderation_events set reason = 'x' where moderator_id = ${literal(moderator.id)}`,
      ),
    ).toContain('append_only');
  });

  it('a suspended account cannot publish and leaves every public view until lifted', async () => {
    const suspended = await createAccount('suspended');
    await shareEmail(suspended);
    const listing = await publish(suspended);

    const suspend = await moderator.client.rpc('trade_moderate', {
      p_action: 'suspend',
      p_target_type: 'seller',
      p_target_id: suspended.id,
      p_reason: 'Prueba local',
      p_until: new Date(Date.now() + 7 * DAY_MS).toISOString(),
    });
    expect(suspend.error).toBeNull();

    expect(
      (await anon.from('trade_listings').select('listing_id').eq('listing_id', listing)).data,
    ).toEqual([]);
    expect(
      (await anon.rpc('trade_public_profile', { p_username: suspended.username })).data,
    ).toEqual([]);
    expect((await anon.rpc('trade_seller_stats', { p_seller_id: suspended.id })).data).toEqual([]);
    const published = await suspended.client.rpc('trade_publish_listing', {
      p_listing: gameListing,
      p_device_id: suspended.device,
    });
    expect(published.error).toMatchObject({ code: '42501', message: 'suspended' });
    const contacted = await buyer.client.rpc('trade_start_transaction', {
      p_listing_id: listing,
      p_device_id: buyer.device,
    });
    expect(contacted.error).toMatchObject({ code: '22023', message: 'listing_unavailable' });
    // The seller still reads its own listing.
    expect(
      (await suspended.client.from('trade_listings').select('listing_id').eq('listing_id', listing))
        .data,
    ).toEqual([{ listing_id: listing }]);

    const lift = await moderator.client.rpc('trade_moderate', {
      p_action: 'lift_suspension',
      p_target_type: 'seller',
      p_target_id: suspended.id,
      p_reason: 'Prueba local',
    });
    expect(lift.error).toBeNull();
    expect(
      (await anon.from('trade_listings').select('listing_id').eq('listing_id', listing)).data,
    ).toEqual([{ listing_id: listing }]);
  });

  it('reports: one per target, «Otro» needs a detail, the number must be the reporter’s', async () => {
    const withoutDetail = await third.client.rpc('trade_report', {
      p_target_type: 'listing',
      p_target_id: listingId,
      p_reason: 'otro',
      p_detail: null,
      p_transaction_number: null,
      p_device_id: third.device,
    });
    expect(withoutDetail.error).toMatchObject({ code: '22023', message: 'detail_required' });

    const number = Number(
      sql(
        `select number from public.trade_transactions where transaction_id = ${literal(firstDeal)}`,
      )[0].number,
    );
    const foreignNumber = await third.client.rpc('trade_report', {
      p_target_type: 'seller',
      p_target_id: seller.id,
      p_reason: 'estafa',
      p_detail: null,
      p_transaction_number: number,
      p_device_id: third.device,
    });
    expect(foreignNumber.error).toMatchObject({ code: '22023', message: 'transaction_invalid' });

    const report = await buyer.client.rpc('trade_report', {
      p_target_type: 'seller',
      p_target_id: seller.id,
      p_reason: 'estafa',
      p_detail: null,
      p_transaction_number: number,
      p_device_id: buyer.device,
    });
    expect(report.error).toBeNull();
    const again = await buyer.client.rpc('trade_report', {
      p_target_type: 'seller',
      p_target_id: seller.id,
      p_reason: 'ofensivo',
      p_detail: null,
      p_transaction_number: null,
      p_device_id: buyer.device,
    });
    expect(again.error).toMatchObject({ code: '23505', message: 'already_reported' });

    expect((await third.client.from('trade_reports').select('report_id')).data).toEqual([]);
    expect(
      (await third.client.rpc('trade_moderation_reports', { p_status: 'open' })).error?.code,
    ).toBe('42501');
    const open = await moderator.client.rpc('trade_moderation_reports', { p_status: 'open' });
    const row = (open.data as Row[]).find((entry) => entry.report_id === report.data);
    expect(row).toMatchObject({
      target_type: 'seller',
      owner_id: seller.id,
      owner_handle: seller.username,
      transaction_number: number,
      open_count: 1,
    });
    expect(
      sql(
        `select count(*)::int as held from public.trade_evidence_holds where case_kind = 'report' and case_id = ${literal(String(report.data))}`,
      ),
    ).toEqual([{ held: 2 }]);

    const dismissed = await moderator.client.rpc('trade_moderate', {
      p_action: 'dismiss',
      p_target_type: 'seller',
      p_target_id: seller.id,
      p_reason: 'Sin pruebas',
      p_report_id: report.data,
    });
    expect(dismissed.error).toBeNull();
    expect(
      sql(
        `select count(*)::int as held from public.trade_evidence_holds where case_kind = 'report' and case_id = ${literal(String(report.data))}`,
      ),
    ).toEqual([{ held: 0 }]);
  });

  it('the evidence of an action is readable only by moderators', async () => {
    const own = await buyer.client.from('trade_action_evidence').select('user_id').limit(1);
    expect(own.data).toEqual([]);
    const moderated = await moderator.client
      .from('trade_action_evidence')
      .select('action')
      .eq('user_id', buyer.id);
    expect((moderated.data as Row[]).map((row) => row.action)).toContain('contactar');
  });

  it('item 7.1: counterparts that share a device raise an alert when they become counterparts', async () => {
    const device = randomUUID();
    const [left, right] = await Promise.all([
      createAccount('dev-a', { device }),
      createAccount('dev-b', { device }),
    ]);
    await shareEmail(left);
    const listing = await publish(left);
    const deal = await contact(right, listing);
    expect(openFlags('dispositivo_contrapartes', [left.id, right.id])).toEqual([]);

    await confirm(right, deal);
    await confirm(left, deal);
    expect(openFlags('dispositivo_contrapartes', [left.id, right.id])).toMatchObject([
      { device_id: device },
    ]);
  });

  it('item 7.2: three accounts on one device raise an alert', async () => {
    const device = randomUUID();
    const members = await Promise.all(
      ['dev-1', 'dev-2', 'dev-3'].map((label) => createAccount(label, { device })),
    );
    await contact(members[0], listingId);
    await contact(members[1], listingId);
    expect(openFlags('dispositivo_cuentas', [members[0].id, members[1].id])).toEqual([]);
    await contact(members[2], listingId);
    const flags = openFlags(
      'dispositivo_cuentas',
      members.map((member) => member.id),
    );
    expect(flags).toMatchObject([{ device_id: device }]);

    const listed = await moderator.client.rpc('trade_moderation_flags');
    const flag = (listed.data as Row[]).find((entry) => entry.flag_id === flags[0].flag_id);
    expect(flag).toMatchObject({ kind: 'dispositivo_cuentas', device_id: device, count: 3 });
    expect((flag!.accounts as Row[]).map((account) => account.handle).sort()).toEqual(
      members.map((member) => member.username).sort(),
    );
    expect((await third.client.rpc('trade_moderation_flags')).error?.code).toBe('42501');
  });

  it('item 7.3: five reviews in 7 days from new accounts that only traded with it raise an alert', async () => {
    const reviewed = await createAccount('reviewed');
    const lastReviewer = await createAccount('newcomer');
    await shareEmail(reviewed);
    const listing = await publish(reviewed);

    const earlier: string[] = [];
    for (let index = 0; index < 4; index += 1) {
      const created = await admin.auth.admin.createUser({
        email: `trade-early${index}-${run}@example.com`,
        password,
        email_confirm: true,
      });
      if (created.error || !created.data.user) throw created.error ?? new Error('No user');
      earlier.push(created.data.user.id);
      extraUsers.push(created.data.user.id);
    }
    sql(
      `with deals as (
        insert into public.trade_transactions (listing_id, seller_id, buyer_id, status, reviewable, closed_at)
        select ${literal(listing)}, ${literal(reviewed.id)}, reviewer, 'confirmada', true, now() from unnest(${uuidList(earlier)}) as reviewer
        returning transaction_id, buyer_id
      )
      insert into public.trade_reviews (transaction_id, listing_id, reviewer_id, reviewee_id, reviewer_role, score)
      select transaction_id, ${literal(listing)}, buyer_id, ${literal(reviewed.id)}, 'buyer', 5 from deals`,
    );

    const deal = await confirmedDeal(reviewed, lastReviewer, listing);
    expect(openFlags('resenas_cuentas_nuevas', [reviewed.id])).toEqual([]);
    expect((await review(lastReviewer, deal, 5)).error).toBeNull();
    const flags = openFlags('resenas_cuentas_nuevas', [reviewed.id, lastReviewer.id, ...earlier]);
    expect(flags).toHaveLength(1);
  });

  it('item 7.4: a pair at the daily review cap three days in a row raises an alert', async () => {
    const [left, right] = await Promise.all([createAccount('cap-a'), createAccount('cap-b')]);
    await shareEmail(left);
    const listing = await publish(left);
    const cap = limits.RESENAS_PAR_DIA;
    sql(
      `insert into public.trade_transactions (listing_id, seller_id, buyer_id, status, reviewable, closed_at)
      select ${literal(listing)}, ${literal(left.id)}, ${literal(right.id)}, 'confirmada', false,
        (((now() at time zone 'UTC')::date - day)::timestamp at time zone 'UTC') + interval '12 hours'
      from generate_series(1, 2) as day, generate_series(1, ${cap}) as deal`,
    );
    for (let index = 1; index < cap; index += 1) await confirmedDeal(left, right, listing);
    expect(openFlags('tope_resenas', [left.id, right.id])).toEqual([]);
    await confirmedDeal(left, right, listing);
    expect(openFlags('tope_resenas', [left.id, right.id])).toHaveLength(1);
  });

  it('item 7: unrelated accounts behind one IP raise no alert', async () => {
    const headers = { 'x-forwarded-for': sharedIp };
    const [one, two] = await Promise.all([
      createAccount('ip-a', { headers }),
      createAccount('ip-b', { headers }),
    ]);
    await contact(one, listingId);
    await contact(two, listingId);
    const ips = sql(
      `select distinct host(ip) as ip from public.trade_action_evidence where user_id in (${literal(one.id)}, ${literal(two.id)})`,
    );
    expect(ips).toEqual([{ ip: sharedIp }]);
    expect(
      sql(
        `select count(*)::int as flags from public.trade_flags where user_ids && ${uuidList([one.id, two.id])}`,
      ),
    ).toEqual([{ flags: 0 }]);
  });
});
