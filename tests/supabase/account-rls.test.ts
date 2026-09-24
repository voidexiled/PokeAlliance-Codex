// §9.15.9 items 1-4, 8 and 9 (accounts and trust) against the LOCAL Supabase stack, with real
// local accounts. The keys and the database address come from `supabase status` and must be
// loopback ones, so this file never reaches the remote project. What the API cannot do (writing
// `auth.identities` to simulate Discord and Google, moving the clock of a row, calling a helper
// the trade functions call) runs as the database owner through `supabase db query --db-url`.
// It skips, with the reason in its title, only when the local stack does not answer.
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
    return health.ok ? found : `the local stack answered ${health.status}`;
  } catch {
    return `the local stack at ${found.url} does not answer`;
  }
}

const detected = await detectLocalStack();
const stack = typeof detected === 'string' ? null : detected;
const title =
  typeof detected === 'string'
    ? `accounts and trust (§9.15), skipped: ${detected}`
    : 'accounts and trust (§9.15)';

type Row = Record<string, unknown>;

/** One SQL statement on the local database, as its owner; the rows it returns. */
function sql(statement: string): Row[] {
  const output = execFileSync(
    'supabase',
    ['db', 'query', '--db-url', stack!.dbUrl, '--output-format', 'json', statement],
    { encoding: 'utf8', timeout: 60_000, stdio: ['ignore', 'pipe', 'pipe'] },
  ).trim();
  return output.startsWith('{') ? ((JSON.parse(output) as { rows?: Row[] }).rows ?? []) : [];
}

/** The error message of a statement that must fail. */
function sqlError(statement: string): string {
  try {
    sql(statement);
  } catch (error) {
    const failure = error as { stdout?: string; stderr?: string };
    const output = `${failure.stdout ?? ''}\n${failure.stderr ?? ''}`;
    const json = /\{"_tag":"Error".*\}/.exec(output)?.[0];
    return json ? (JSON.parse(json) as { error: { message: string } }).error.message : output;
  }
  throw new Error(`The statement did not fail: ${statement}`);
}

const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;

// Cloudflare's dummy token: the Turnstile test secret accepts it, and Auth ignores it while the
// local CAPTCHA is off (supabase/config.toml).
const captcha = { captchaToken: 'XXXX.DUMMY.TOKEN.XXXX' };

const clientOptions = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
};

type Account = { id: string; email: string; client: SupabaseClient };

const run = randomUUID().slice(0, 8);
const password = `Local-${randomUUID()}`;
const worldId = mundos.mundos[0].id;
const DAY_MS = 86_400_000;
const DISCORD_EPOCH = 1_420_070_400_000n;

/** A Discord id (snowflake) of an account created `days` days ago. */
function discordId(days: number): string {
  const created = BigInt(Date.now() - days * DAY_MS);
  return (((created - DISCORD_EPOCH) << 22n) | BigInt(randomInt(0, 4_194_304))).toString();
}

const googleId = () => `1${Array.from({ length: 20 }, () => randomInt(0, 10)).join('')}`;

/** The birth date of someone who turned `years` yesterday. */
function birthDate(years: number): string {
  const date = new Date(Date.now() - DAY_MS);
  date.setUTCFullYear(date.getUTCFullYear() - years);
  return date.toISOString().slice(0, 10);
}

describe.skipIf(stack === null)(title, { timeout: 120_000 }, () => {
  const admin = stack ? createClient(stack.url, stack.serviceRoleKey, clientOptions) : null!;
  const anon = stack ? createClient(stack.url, stack.anonKey, clientOptions) : null!;
  const moderatorsTable =
    stack !== null &&
    sql("select to_regclass('public.trade_moderators') is not null as present")[0]?.present ===
      true;
  const accounts: Account[] = [];

  let first: Account;
  let incomplete: Account;
  let googleOnly: Account;
  let teen: Account;
  let newDiscord: Account;
  let trader: Account;
  let banned: Account;

  async function createAccount(label: string, email = `acct-${label}-${run}@example.com`) {
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error || !created.data.user) throw created.error ?? new Error('No user');
    const account = {
      id: created.data.user.id,
      email,
      client: createClient(stack!.url, stack!.anonKey, clientOptions),
    };
    accounts.push(account);
    const signedIn = await account.client.auth.signInWithPassword({
      email,
      password,
      options: captcha,
    });
    if (signedIn.error) throw signedIn.error;
    return account;
  }

  function link(account: Account, provider: 'discord' | 'google', providerId: string) {
    sql(
      `insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at) values (${literal(providerId)}, ${literal(account.id)}, jsonb_build_object('sub', ${literal(providerId)}, 'email', ${literal(account.email)}, 'email_verified', true), ${literal(provider)}, now(), now(), now())`,
    );
  }

  function profileOf(label: string, overrides: Record<string, unknown> = {}) {
    return {
      p_username: `t-${run}-${label}`,
      p_player_name: `Player ${run} ${label}`,
      p_world_key: worldId,
      p_country_code: 'MX',
      p_birth_date: birthDate(30),
      p_terms_version: limits.TERMINOS_VERSION,
      ...overrides,
    };
  }

  async function saveProfile(account: Account, label: string, overrides = {}) {
    return account.client.rpc('account_save_profile', profileOf(label, overrides));
  }

  async function state(account: Account) {
    const result = await account.client.rpc('account_registration_state');
    expect(result.error).toBeNull();
    return result.data as {
      steps: Record<string, boolean>;
      complete: boolean;
      profile: Record<string, unknown> | null;
      comercio: Record<string, unknown>;
      presence: { estado: string; efectivo: string };
    };
  }

  /** What a Comercio function of the trade migration does first, for `account`, from `ip`. */
  function authorizeAs(account: Account, action: string, realMoney: boolean, deviceId: string) {
    return `do $$ begin perform set_config('request.jwt.claims', json_build_object('sub', ${literal(account.id)}, 'role', 'authenticated')::text, true); perform set_config('request.headers', json_build_object('x-forwarded-for', '198.51.100.23, 10.0.0.1')::text, true); perform public.trade_authorize(${literal(action)}, ${realMoney}, ${literal(deviceId)}::uuid); end $$`;
  }

  beforeAll(async () => {
    first = await createAccount('first', `ab${run}@gmail.com`);
    incomplete = await createAccount('incomplete');
    googleOnly = await createAccount('google');
    teen = await createAccount('teen');
    newDiscord = await createAccount('new');
    trader = await createAccount('trader');
    banned = await createAccount('banned', `ban.${run}@example.com`);

    link(googleOnly, 'google', googleId());
    link(teen, 'discord', discordId(400));
    link(newDiscord, 'discord', discordId(59));
    link(trader, 'discord', discordId(400));
    link(banned, 'discord', discordId(400));
    link(banned, 'google', googleId());

    for (const [account, label, overrides] of [
      [googleOnly, 'google', {}],
      [teen, 'teen', { p_birth_date: birthDate(15) }],
      [trader, 'trader', {}],
      [banned, 'banned', {}],
    ] as const) {
      expect({ label, error: (await saveProfile(account, label, overrides)).error }).toEqual({
        label,
        error: null,
      });
    }
  }, 180_000);

  afterAll(async () => {
    if (!stack) return;
    const ids = sql(`select id from auth.users where email like ${literal(`%${run}%`)}`).map(
      (row) => String(row.id),
    );
    for (const id of new Set([...ids, ...accounts.map((account) => account.id)])) {
      await admin.auth.admin.deleteUser(id);
    }
    if (accounts.length === 0) return;
    const list = accounts.map((account) => literal(account.id)).join(', ');
    sql(
      `with evidence as (delete from public.trade_action_evidence where user_id in (${list}) returning 1), holds as (delete from public.trade_evidence_holds where user_id in (${list}) returning 1) select (select count(*) from evidence) + (select count(*) from holds) as removed`,
    );
  }, 120_000);

  it('the SQL parameters are those of src/lib/trade/limits.ts', () => {
    const rows = sql('select name, value from public.app_parameters order by name');
    const values = Object.fromEntries(rows.map((row) => [row.name, row.value]));
    expect(values).toMatchObject({
      EDAD_MINIMA_CUENTA: limits.EDAD_MINIMA_CUENTA,
      EDAD_MINIMA_COMERCIO: limits.EDAD_MINIMA_COMERCIO,
      DISCORD_EDAD_MIN_DIAS: limits.DISCORD_EDAD_MIN_DIAS,
      CONTRASENA_MIN: limits.CONTRASENA_MIN,
      TELEFONO_OBLIGATORIO: limits.TELEFONO_OBLIGATORIO,
      RESENAS_PAR_DIA: limits.RESENAS_PAR_DIA,
      EVIDENCIA_DIAS: limits.EVIDENCIA_DIAS,
      PRESENCIA_SIN_SENAL_MIN: limits.PRESENCIA_SIN_SENAL_MIN,
      PRESENCIA_INACTIVO_HORAS: limits.PRESENCIA_INACTIVO_HORAS,
      TERMINOS_VERSION: limits.TERMINOS_VERSION,
      CONSENTIMIENTO_DINERO_REAL_VERSION: limits.CONSENTIMIENTO_DINERO_REAL_VERSION,
    });
  });

  it('1: the same normalized e-mail or a disposable domain does not register again', async () => {
    const hook = sql(
      `select public.hook_before_user_created(jsonb_build_object('user', jsonb_build_object('email', ${literal(`A.B${run}+Y@GoogleMail.com`)}))) as taken, public.hook_before_user_created(jsonb_build_object('user', jsonb_build_object('email', ${literal(`x${run}@eu.mailinator.com`)}))) as disposable, public.hook_before_user_created(jsonb_build_object('user', jsonb_build_object('email', ${literal(`fresh-${run}@example.com`)}))) as fresh`,
    )[0];
    expect(hook).toEqual({
      taken: { error: { http_code: 409, message: 'email_taken' } },
      disposable: { error: { http_code: 403, message: 'email_domain_blocked' } },
      fresh: {},
    });

    // Through Auth: the hook refuses when Auth runs it; the trigger on auth.users refuses
    // either way, also for the admin API, which creates confirmed accounts.
    for (const email of [`a.b${run}+x@gmail.com`, `x${run}@mailinator.com`]) {
      const signedUp = await anon.auth.signUp({ email, password, options: captcha });
      expect({ email, refused: signedUp.error !== null }).toEqual({ email, refused: true });
      const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      expect({ email, refused: created.error !== null }).toEqual({ email, refused: true });
    }
    const left = sql(
      `select count(*)::int as users from auth.users where email in (${literal(`a.b${run}+x@gmail.com`)}, ${literal(`x${run}@mailinator.com`)})`,
    );
    expect(left).toEqual([{ users: 0 }]);

    // Only Auth runs the hook.
    const called = await anon.rpc('hook_before_user_created', { event: {} });
    expect(called.error?.code).toBe('42501');
    const privileges = sql(
      "select has_function_privilege('supabase_auth_admin', 'public.hook_before_user_created(jsonb)', 'EXECUTE') as auth, has_function_privilege('authenticated', 'public.hook_before_user_created(jsonb)', 'EXECUTE') as authenticated",
    );
    expect(privileges).toEqual([{ auth: true, authenticated: false }]);
  });

  it('2: a Discord or Google identity links to one account only', () => {
    const discord = discordId(400);
    const google = googleId();
    link(first, 'discord', discord);
    link(first, 'google', google);
    for (const [provider, id] of [
      ['discord', discord],
      ['google', google],
    ] as const) {
      const message = sqlError(
        `insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at) values (${literal(id)}, ${literal(incomplete.id)}, jsonb_build_object('sub', ${literal(id)}), ${literal(provider)}, now(), now())`,
      );
      expect(message).toContain('identities_provider_id_provider_unique');
    }
  });

  it('3: without the three steps no account or Comercio function answers', async () => {
    expect(await state(incomplete)).toMatchObject({
      steps: { email: true, identity: false, phone: true, profile: false },
      complete: false,
      profile: null,
      comercio: { eligible: false, reason: 'account_incomplete' },
    });

    const { client } = incomplete;
    const calls = [
      client.rpc('trade_check_eligibility'),
      client.rpc('trade_heartbeat', { p_activo: true }),
      client.rpc('trade_set_presence', { p_estado: 'en_juego' }),
      client.rpc('trade_accept_consent', { p_version: limits.CONSENTIMIENTO_DINERO_REAL_VERSION }),
    ];
    for (const call of calls) {
      expect((await call).error).toMatchObject({ code: '42501', message: 'account_incomplete' });
    }
    // Step 3 waits for step 2.
    expect((await saveProfile(incomplete, 'incomplete')).error).toMatchObject({
      code: '42501',
      message: 'identity_missing',
    });
  });

  it('3: at 15 and with a Discord account of 59 days the Comercio functions fail', async () => {
    expect(await state(teen)).toMatchObject({
      complete: true,
      comercio: { eligible: false, reason: 'underage', adult: false },
    });
    for (const call of [
      teen.client.rpc('trade_check_eligibility'),
      teen.client.rpc('trade_heartbeat', { p_activo: true }),
      teen.client.rpc('trade_accept_consent', {
        p_version: limits.CONSENTIMIENTO_DINERO_REAL_VERSION,
      }),
    ]) {
      expect((await call).error).toMatchObject({ code: '42501', message: 'underage' });
    }

    // Under EDAD_MINIMA_CUENTA there is no account at all.
    expect(
      (await saveProfile(newDiscord, 'new', { p_birth_date: birthDate(12) })).error,
    ).toMatchObject({ code: '22023', message: 'birth_date_underage' });
    expect((await saveProfile(newDiscord, 'new')).error).toBeNull();
    expect((await newDiscord.client.rpc('trade_check_eligibility')).error).toMatchObject({
      code: '42501',
      message: 'discord_too_new',
    });
    sql(
      `update auth.identities set provider_id = ${literal(discordId(61))} where user_id = ${literal(newDiscord.id)} and provider = 'discord'`,
    );
    expect(await newDiscord.client.rpc('trade_check_eligibility')).toMatchObject({
      data: true,
      error: null,
    });

    // Google completes the registration, but Comercio needs Discord.
    expect((await googleOnly.client.rpc('trade_check_eligibility')).error).toMatchObject({
      code: '42501',
      message: 'discord_missing',
    });
    expect((await googleOnly.client.rpc('trade_heartbeat', { p_activo: false })).error).toBeNull();
  });

  it('every profile write is validated and only the owner reads its row', async () => {
    const taken = [
      { p_username: `T-${run}-TEEN` },
      { p_player_name: `PLAYER ${run} teen`, p_username: `t-${run}-google` },
    ];
    const takenErrors: unknown[] = [];
    for (const overrides of taken) {
      takenErrors.push((await saveProfile(googleOnly, 'google', overrides)).error);
    }
    expect(takenErrors).toMatchObject([
      { code: '23505', message: 'username_taken' },
      { code: '23505', message: 'player_name_taken' },
    ]);

    const invalid: [Record<string, unknown>, string][] = [
      [{ p_username: 'ab' }, 'username_invalid'],
      [{ p_player_name: '  ' }, 'player_name_invalid'],
      [{ p_world_key: 'Moon!' }, 'world_invalid'],
      [{ p_country_code: 'mex' }, 'country_invalid'],
      [{ p_terms_version: '2020-01-01' }, 'terms_version_invalid'],
      [{ p_birth_date: birthDate(40) }, 'birth_date_locked'],
    ];
    for (const [overrides, message] of invalid) {
      expect({ message, error: (await saveProfile(teen, 'teen', overrides)).error }).toMatchObject({
        message,
        error: { code: '22023', message },
      });
    }

    const own = await teen.client.from('account_profiles').select('user_id, username');
    expect(own.data).toEqual([{ user_id: teen.id, username: `t-${run}-teen` }]);
    expect((await teen.client.from('account_profiles').select('birth_date')).error?.code).toBe(
      '42501',
    );
    expect((await anon.from('account_profiles').select('username')).error?.code).toBe('42501');

    const writes = [
      teen.client.from('account_profiles').update({ country_code: 'BR' }).eq('user_id', teen.id),
      teen.client.from('account_profiles').delete().eq('user_id', teen.id),
      teen.client.from('trade_presence').insert({ user_id: teen.id }),
      teen.client.from('trade_consents').insert({ user_id: teen.id, version: 'x' }),
      teen.client.from('trade_action_evidence').insert({ user_id: teen.id, action: 'publicar' }),
      teen.client.from('blocked_email_domains').delete().neq('domain', ''),
      teen.client.from('app_parameters').update({ value: 1 }).eq('name', 'EDAD_MINIMA_COMERCIO'),
    ];
    for (const write of writes) {
      expect((await write).error?.code).toBe('42501');
    }
  });

  it('4: real money needs the current consent; the evidence is only for moderators', async () => {
    const device = randomUUID();
    const evidenceOf = (account: Account) =>
      sql(
        `select action, host(ip) as ip, device_id from public.trade_action_evidence where user_id = ${literal(account.id)} order by evidence_id`,
      );

    expect(
      (await trader.client.rpc('trade_check_eligibility', { p_real_money: true })).error,
    ).toMatchObject({ code: '42501', message: 'consent_required' });
    expect(sqlError(authorizeAs(trader, 'contactar', true, device))).toContain('consent_required');
    // Without the consent a Comercio action stores no evidence.
    sql(authorizeAs(trader, 'contactar', false, device));
    expect(evidenceOf(trader)).toEqual([]);

    const wrong = await trader.client.rpc('trade_accept_consent', { p_version: '2020-01-01' });
    expect(wrong.error).toMatchObject({ code: '22023', message: 'consent_version_invalid' });
    const accepted = await trader.client.rpc('trade_accept_consent', {
      p_version: limits.CONSENTIMIENTO_DINERO_REAL_VERSION,
    });
    expect(accepted.error).toBeNull();
    expect(
      await trader.client.rpc('trade_check_eligibility', { p_real_money: true }),
    ).toMatchObject({ data: true, error: null });

    sql(authorizeAs(trader, 'contactar', true, device));
    expect(evidenceOf(trader)).toEqual([
      { action: 'contactar', ip: '198.51.100.23', device_id: device },
    ]);

    // Nobody but a moderator reads it: not its account, not another one, not anon.
    for (const account of [trader, newDiscord]) {
      const read = await account.client.from('trade_action_evidence').select('evidence_id');
      expect(read).toMatchObject({ data: [], error: null });
    }
    expect((await anon.from('trade_action_evidence').select('evidence_id')).error?.code).toBe(
      '42501',
    );
    expect((await trader.client.from('trade_consents').select('version')).data).toEqual([
      { version: limits.CONSENTIMIENTO_DINERO_REAL_VERSION },
    ]);
    expect((await newDiscord.client.from('trade_consents').select('version')).data).toEqual([]);

    // The lazy purge keeps what an open report holds, and nothing older than EVIDENCIA_DIAS else.
    // The hold comes first: another test file's actions run the lazy purge at any moment, so
    // aged rows without a hold may already be gone.
    sql(
      `select public.trade_hold_evidence('report', ${literal(`test-${run}`)}, array[${literal(trader.id)}]::uuid[])`,
    );
    sql(
      `update public.trade_action_evidence set created_at = now() - make_interval(days => ${limits.EVIDENCIA_DIAS + 1}) where user_id = ${literal(trader.id)}`,
    );
    sql('select public.trade_purge_evidence()');
    expect(evidenceOf(trader)).toHaveLength(1);
    sql(`select public.trade_release_evidence('report', ${literal(`test-${run}`)})`);
    sql(authorizeAs(trader, 'reportar', false, device));
    expect(evidenceOf(trader)).toMatchObject([{ action: 'reportar' }]);
  });

  it.skipIf(!moderatorsTable)('4: a moderator reads the evidence of every account', async () => {
    sql(`insert into public.trade_moderators (user_id) values (${literal(googleOnly.id)})`);
    try {
      const read = await googleOnly.client
        .from('trade_action_evidence')
        .select('user_id, action')
        .eq('user_id', trader.id);
      expect(read.data).toEqual([{ user_id: trader.id, action: 'reportar' }]);
      expect((await state(googleOnly)).comercio.moderator).toBe(true);
    } finally {
      sql(`delete from public.trade_moderators where user_id = ${literal(googleOnly.id)}`);
    }
  });

  it('8: a ban keeps the e-mail, the identities and the player name taken, also after deleting the account', async () => {
    expect(
      sql(`select public.trade_suspend_account(${literal(banned.id)}, null)::text as until`),
    ).toEqual([{ until: 'infinity' }]);
    expect(await state(banned)).toMatchObject({
      complete: true,
      comercio: { eligible: false, reason: 'suspended', suspended_until: 'infinity' },
    });
    expect((await banned.client.rpc('trade_check_eligibility')).error).toMatchObject({
      code: '42501',
      message: 'suspended',
    });

    // While suspended, none of the three can be freed.
    const renamed = await saveProfile(banned, 'banned', { p_player_name: `Other ${run}` });
    expect(renamed.error).toMatchObject({ code: '42501', message: 'suspended' });
    expect(
      sqlError(
        `delete from auth.identities where user_id = ${literal(banned.id)} and provider = 'discord'`,
      ),
    ).toContain('suspended');
    expect(
      sqlError(
        `update auth.users set email = ${literal(`moved-${run}@example.com`)} where id = ${literal(banned.id)}`,
      ),
    ).toContain('suspended');

    expect(await banned.client.rpc('account_delete')).toMatchObject({
      data: 'reserved',
      error: null,
    });
    const [kept] = sql(
      `select account.banned_until > now() + interval '99 years' as blocked, (select count(*)::int from auth.sessions where user_id = account.id) as sessions, (select count(*)::int from auth.identities where user_id = account.id and provider in ('discord', 'google')) as identities, profile.username, profile.player_name, profile.deleted_at is not null as deleted, (select count(*)::int from public.account_email_keys where user_id = account.id) as email_keys from auth.users as account join public.account_profiles as profile on profile.user_id = account.id where account.id = ${literal(banned.id)}`,
    );
    expect(kept).toEqual({
      blocked: true,
      sessions: 0,
      identities: 2,
      username: null,
      player_name: `Player ${run} banned`,
      deleted: true,
      email_keys: 1,
    });

    const signIn = await createClient(
      stack!.url,
      stack!.anonKey,
      clientOptions,
    ).auth.signInWithPassword({ email: banned.email, password, options: captcha });
    expect(signIn.error).not.toBeNull();

    // The same person cannot come back with the same e-mail, identity or player name.
    const again = `ban.${run}+again@example.com`;
    expect(
      (await anon.auth.signUp({ email: again, password, options: captcha })).error,
    ).not.toBeNull();
    const created = await admin.auth.admin.createUser({
      email: again,
      password,
      email_confirm: true,
    });
    expect(created.error).not.toBeNull();

    const [discord] = sql(
      `select provider_id from auth.identities where user_id = ${literal(banned.id)} and provider = 'discord'`,
    );
    expect(
      sqlError(
        `insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at) values (${literal(String(discord.provider_id))}, ${literal(first.id)}, '{}'::jsonb, 'discord', now(), now())`,
      ),
    ).toContain('identities_provider_id_provider_unique');

    const claimed = await saveProfile(googleOnly, 'google', {
      p_player_name: `player ${run} BANNED`,
    });
    expect(claimed.error).toMatchObject({ code: '23505', message: 'player_name_taken' });
  });

  it('an account without a suspension deletes itself completely', async () => {
    expect(await incomplete.client.rpc('account_delete')).toMatchObject({
      data: 'deleted',
      error: null,
    });
    expect(
      sql(`select count(*)::int as users from auth.users where id = ${literal(incomplete.id)}`),
    ).toEqual([{ users: 0 }]);
  });

  it('9: the state others see goes offline after 10 min and away after 6 h, clock injected', async () => {
    const { client } = trader;
    const seen = async () =>
      (await anon.rpc('trade_effective_presence', { p_user_ids: [trader.id] })).data;
    const move = (lastSeen: string, lastInput: string) =>
      sql(
        `update public.trade_presence set last_seen_at = now() - interval ${literal(lastSeen)}, last_input_at = now() - interval ${literal(lastInput)} where user_id = ${literal(trader.id)}`,
      );

    expect(await client.rpc('trade_set_presence', { p_estado: 'en_juego' })).toMatchObject({
      data: 'en_juego',
      error: null,
    });
    const unknown = randomUUID();
    const both = await anon.rpc('trade_effective_presence', { p_user_ids: [trader.id, unknown] });
    expect(both.data).toEqual(
      expect.arrayContaining([
        { user_id: trader.id, estado: 'en_juego' },
        { user_id: unknown, estado: 'desconectado' },
      ]),
    );

    move('10 minutes 5 seconds', '1 minute');
    expect(await seen()).toEqual([{ user_id: trader.id, estado: 'desconectado' }]);
    move('1 minute', '6 hours 5 seconds');
    expect(await seen()).toEqual([{ user_id: trader.id, estado: 'ausente' }]);
    // A heartbeat without input keeps it away; one with input brings it back.
    expect((await client.rpc('trade_heartbeat', { p_activo: false })).data).toBe('ausente');
    expect((await client.rpc('trade_heartbeat', { p_activo: true })).data).toBe('en_juego');
    expect(await seen()).toEqual([{ user_id: trader.id, estado: 'en_juego' }]);

    // The rule itself, at the edges, with the clock as an argument.
    const [edges] = sql(
      "select public.trade_presence_effective_state('en_juego', t, t, true, t + interval '10 minutes') as at_ten, public.trade_presence_effective_state('en_juego', t, t, true, t + interval '10 minutes 1 second') as after_ten, public.trade_presence_effective_state('en_juego', t + interval '6 hours', t, true, t + interval '6 hours') as at_six, public.trade_presence_effective_state('en_juego', t + interval '6 hours 1 second', t, true, t + interval '6 hours 1 second') as after_six, public.trade_presence_effective_state('ausente', t, null, true, t) as away, public.trade_presence_effective_state('en_juego', t, t, false, t) as no_session from (select timestamptz '2026-09-23 12:00:00+00' as t) as clock",
    );
    expect(edges).toEqual({
      at_ten: 'en_juego',
      after_ten: 'desconectado',
      at_six: 'en_juego',
      after_six: 'ausente',
      away: 'ausente',
      no_session: 'desconectado',
    });

    expect((await anon.rpc('trade_heartbeat', { p_activo: true })).error?.code).toBe('42501');
    const many = Array.from({ length: 101 }, () => randomUUID());
    expect((await anon.rpc('trade_effective_presence', { p_user_ids: many })).error).toMatchObject({
      code: '22023',
      message: 'too_many_accounts',
    });

    // «Desconectado» from the menu, and signing out, end it.
    expect((await client.rpc('trade_set_presence', { p_estado: 'desconectado' })).data).toBe(
      'desconectado',
    );
    expect(await seen()).toEqual([{ user_id: trader.id, estado: 'desconectado' }]);
    expect((await client.rpc('trade_set_presence', { p_estado: 'en_juego' })).data).toBe(
      'en_juego',
    );
    expect((await client.auth.signOut()).error).toBeNull();
    expect(await seen()).toEqual([{ user_id: trader.id, estado: 'desconectado' }]);
  });
});
