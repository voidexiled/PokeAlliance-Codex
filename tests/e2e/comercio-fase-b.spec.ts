// Comercio phase B (§9.9–§9.12, §9.15, §9.16; M14): one smoke of the whole path on the account-mode
// development server (COMERCIO_PUBLICO and COMERCIO_DEMO, playwright.config.ts) over the LOCAL
// Supabase stack (tests/e2e/local-supabase.ts). It skips without a local stack.
//
// A buyer registers in the page through the three steps of §9.15.1: the 6-digit code of the
// confirmation mail (read from Mailpit), a Discord identity older than 60 days (written to
// auth.identities, as no OAuth app exists locally) and the profile. The 18+ gate, the header entry,
// the real-money consent, «Contactar al vendedor», both confirmations, the two reviews, a report,
// the moderation queue, the online status, «Mi perfil» and «Cerrar sesión» follow. The seller and
// the moderator are prepared through the API; what the API cannot do runs as the database owner
// through `supabase db query --db-url` on the loopback address. Every account is deleted after.
//
// The clock. Unlike the other specs this one does not freeze the page clock (§14.3): the deal,
// the review window and the session are dated by the database with the real time, and a page
// that believes it is days earlier would see them in the future.
import { execFileSync } from 'node:child_process';
import { randomInt, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { test as base, expect, type Page } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { es } from '../../src/i18n/messages/es';
import { fill } from '../../src/i18n/messages/types';
import { CONSENTIMIENTO_DINERO_REAL_VERSION, TERMINOS_VERSION } from '../../src/lib/trade/limits';
import { ACCOUNT_ORIGIN, localSupabase } from './local-supabase';
import { stubRemoteArt } from './routes';

const test = base.extend({
  page: async ({ page }, use) => {
    await stubRemoteArt(page);
    await use(page);
  },
});

const stack = localSupabase();
test.skip(stack === null, 'needs the local Supabase stack (supabase start)');
// The 18+ gate is part of the path: this spec starts with no stored answer.
test.use({ baseURL: ACCOUNT_ORIGIN, storageState: { cookies: [], origins: [] } });
test.setTimeout(240_000);

const { account, trade, shell, profile } = es;
const WORLD = (
  JSON.parse(readFileSync(new URL('../../content/mundos.json', import.meta.url), 'utf8')) as {
    mundos: { id: string; nombre: string }[];
  }
).mundos[0];

const MAILPIT = 'http://127.0.0.1:54324';
const DAY_MS = 86_400_000;
const DISCORD_EPOCH = 1_420_070_400_000n;
const run = randomUUID().slice(0, 8);
const password = `Local-${randomUUID()}`;
const emails = {
  buyer: `m14-buyer-${run}@example.com`,
  seller: `m14-seller-${run}@example.com`,
  moderator: `m14-mod-${run}@example.com`,
};
const buyerHandle = `b-${run}`;
const clientOptions = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
};

function admin(): SupabaseClient {
  if (stack === null) throw new Error('No local stack');
  return createClient(stack.url, stack.serviceRoleKey, clientOptions);
}

/** The database URL of the local stack (loopback only, as local-supabase.ts checks the API). */
function dbUrl(): string {
  const output = execFileSync('supabase', ['status', '-o', 'env'], { encoding: 'utf8' });
  const url = /^DB_URL="?([^"\r\n]*)"?$/m.exec(output)?.[1] ?? '';
  if (!['127.0.0.1', 'localhost'].includes(new URL(url).hostname)) {
    throw new Error('The database is not on a loopback address');
  }
  return url;
}

function sql(statement: string): void {
  execFileSync('supabase', ['db', 'query', '--db-url', dbUrl(), statement], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 60_000,
  });
}

const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;

/** A Discord id (snowflake) of an account created `days` ago. */
function discordId(days: number): string {
  const created = BigInt(Date.now() - days * DAY_MS);
  return (((created - DISCORD_EPOCH) << 22n) | BigInt(randomInt(0, 4_194_304))).toString();
}

/** Links a simulated Discord identity to an account, as registration step 2 would. */
function linkDiscord(userId: string, name: string): void {
  sql(
    `insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at) select id, ${literal(userId)}, jsonb_build_object('sub', id, 'name', ${literal(name)}), 'discord', now(), now(), now() from (select ${literal(discordId(400))} as id) as snowflake`,
  );
}

type ApiAccount = { id: string; client: SupabaseClient; device: string };

/** An account with the three steps done, the consent given and its e-mail shared (API only). */
async function apiAccount(email: string, handle: string): Promise<ApiAccount> {
  const created = await admin().auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) throw created.error ?? new Error('No user');
  const id = created.data.user.id;
  const client = createClient(stack!.url, stack!.anonKey, clientOptions);
  expect((await client.auth.signInWithPassword({ email, password })).error).toBeNull();
  linkDiscord(id, handle);
  const saved = await client.rpc('account_save_profile', {
    p_username: handle,
    p_player_name: `Player ${handle}`,
    p_world_key: WORLD.id,
    p_country_code: 'MX',
    p_birth_date: '1990-01-01',
    p_terms_version: TERMINOS_VERSION,
  });
  expect(saved.error).toBeNull();
  const consent = await client.rpc('trade_accept_consent', {
    p_version: CONSENTIMIENTO_DINERO_REAL_VERSION,
  });
  expect(consent.error).toBeNull();
  await shareEmail(client, email);
  return { id, client, device: randomUUID() };
}

async function shareEmail(client: SupabaseClient, email: string): Promise<void> {
  expect((await client.rpc('trade_sync_oauth_channels')).error).toBeNull();
  const shared = await client.rpc('trade_upsert_channel', {
    p_kind: 'email',
    p_platform: null,
    p_value: email,
    p_shared: true,
  });
  expect(shared.error).toBeNull();
}

async function publish(owner: ApiAccount, listing: Record<string, unknown>): Promise<string> {
  const published = await owner.client.rpc('trade_publish_listing', {
    p_listing: {
      asset_type: 'items',
      world_key: WORLD.id,
      asset: { item: null, nombre: 'Fire Stone', cantidad: 3 },
      game_prices: [],
      negotiable: false,
      ...listing,
    },
    p_device_id: owner.device,
  });
  expect(published.error).toBeNull();
  return published.data as string;
}

/** The 6-digit code of the newest confirmation mail sent to `email`. */
async function mailedCode(email: string): Promise<string> {
  let code: string | undefined;
  await expect
    .poll(
      async () => {
        const search = await fetch(
          `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
        );
        const found = (await search.json()) as { messages?: { ID: string }[] };
        const id = found.messages?.[0]?.ID;
        if (id === undefined) return null;
        const message = (await (await fetch(`${MAILPIT}/api/v1/message/${id}`)).json()) as {
          Text?: string;
          HTML?: string;
        };
        code = /code[^\d]*(\d{6})\b/i.exec(`${message.Text ?? ''} ${message.HTML ?? ''}`)?.[1];
        return code ?? null;
      },
      { timeout: 30_000 },
    )
    .not.toBeNull();
  return code!;
}

/** A `Dialog` of the site, an alert dialog or a plain one, by its title. */
function dialog(page: Page, name?: string) {
  const options = name === undefined ? {} : { name };
  return page.getByRole('alertdialog', options).or(page.getByRole('dialog', options));
}

/** Waits until the island around `control` hydrated: a click before that is lost. */
async function hydrated(page: Page, control: ReturnType<Page['getByRole']>) {
  await expect(page.locator('astro-island', { has: control }).first()).not.toHaveAttribute(
    'ssr',
    /.*/,
  );
  return control;
}

/** The header entry on screen at 1440 (the full group, §9.16.1). */
function entry(page: Page) {
  return page.locator('[data-ac-account="full"]');
}

test.afterAll(async () => {
  if (stack === null) return;
  const { data } = await admin().auth.admin.listUsers({ perPage: 1000 });
  for (const user of data.users) {
    if (Object.values(emails).includes(user.email ?? '')) {
      await admin().auth.admin.deleteUser(user.id);
    }
  }
});

test('registration, contact, confirmations, reviews, report, moderation and «Mi perfil»', async ({
  page,
  browser,
}) => {
  if (stack === null) return;

  // The seller, its real-money listing and its status «En el juego» (§9.15.6).
  const seller = await apiAccount(emails.seller, `s-${run}`);
  const listingId = await publish(seller, { fiat_currency: 'USD', fiat_amount: 5 });
  expect((await seller.client.rpc('trade_heartbeat', { p_activo: true })).error).toBeNull();
  expect(
    (await seller.client.rpc('trade_set_presence', { p_estado: 'en_juego' })).error,
  ).toBeNull();

  // Signed out, the header offers «Iniciar sesión» (§9.16.1).
  await page.goto('/es/');
  await expect(entry(page).getByRole('link', { name: shell.account.signIn })).toBeVisible();

  // The 18+ gate on the first Comercio route (§9.15.2).
  await page.goto('/es/comercio/');
  const gate = dialog(page, trade.adultsOnly);
  await expect(gate).toBeVisible();
  await gate.getByRole('button', { name: trade.ageGate.adult }).click();
  await expect(gate).toBeHidden();

  // Registration step 1: e-mail and password, then the code of the confirmation mail.
  await page.goto('/es/cuenta/');
  await page.getByRole('button', { name: account.access.signUp, exact: true }).click();
  await page.getByLabel(account.access.email, { exact: true }).fill(emails.buyer);
  await page.getByLabel(account.access.password, { exact: true }).fill(password);
  await page.locator('form.ac-account-form button[type="submit"]').click();
  await expect(page.getByText(account.auth.codeSentTo)).toBeVisible();
  await page
    .getByLabel(account.register.code, { exact: true })
    .fill(await mailedCode(emails.buyer));
  await page.getByRole('button', { name: account.register.verify, exact: true }).click();

  // Step 2: Discord, older than 60 days (simulated), then the page reads the account again.
  await expect(page.getByText(account.auth.identityText)).toBeVisible();
  const { data: users } = await admin().auth.admin.listUsers({ perPage: 1000 });
  const buyerId = users.users.find((user) => user.email === emails.buyer)?.id;
  expect(buyerId).toBeDefined();
  linkDiscord(buyerId!, buyerHandle);
  await page.reload();

  // Step 3: the profile.
  await page.getByLabel(account.register.username, { exact: true }).fill(buyerHandle);
  await page.getByLabel(account.register.player, { exact: true }).fill(`Player ${buyerHandle}`);
  await page.getByRole('combobox', { name: account.register.world }).click();
  await page.getByRole('option', { name: WORLD.nombre, exact: true }).click();
  await page.getByRole('combobox', { name: account.register.country }).click();
  await page.getByRole('option', { name: 'México', exact: true }).click();
  await page.getByLabel(account.register.birthDate, { exact: true }).fill('1990-01-01');
  await page.getByLabel(account.register.terms).check();
  await page
    .getByRole('main')
    .getByRole('button', { name: account.register.finish, exact: true })
    .click();
  await expect(page.getByText(account.auth.doneTitle, { exact: true })).toBeVisible();

  // The header chip with the account's status dot.
  const chip = entry(page).locator('[data-ac-account-chip]');
  await expect(chip).toBeVisible();
  await expect(chip).toHaveAccessibleName(new RegExp(buyerHandle));

  // The detail: the seller «En el juego», then «Contactar al vendedor» with the consent.
  await page.goto(`/es/comercio/anuncio/${listingId}/`);
  await expect(page.getByText(trade.presence.en_juego).first()).toBeVisible();
  await (
    await hydrated(page, page.getByRole('button', { name: trade.contactSeller, exact: true }))
  ).click();
  const consent = dialog(page, trade.realMoney.title);
  await expect(consent).toBeVisible({ timeout: 15_000 });
  await consent.getByRole('button', { name: trade.realMoney.accept, exact: true }).click();
  await expect(page.getByText(/Operación OP-\d{6} iniciada\./)).toBeVisible();

  // «Reportar anuncio».
  await (
    await hydrated(
      page,
      page.getByRole('button', { name: trade.report.titles.listing, exact: true }),
    )
  ).click();
  const report = dialog(page, trade.report.titles.listing);
  await report.getByRole('radio', { name: trade.report.reasons.estafa }).check();
  await report.getByRole('button', { name: trade.report.send, exact: true }).click();
  await expect(page.getByText(trade.report.sent, { exact: true })).toBeVisible();

  // Both confirmations: the seller through the API, the buyer in «Mis operaciones».
  const deals = await seller.client.rpc('trade_my_transactions');
  expect(deals.error).toBeNull();
  const deal = (deals.data as { transaction_id: string; listing_id: string }[]).find(
    (row) => row.listing_id === listingId,
  );
  expect(deal).toBeDefined();
  const confirmed = await seller.client.rpc('trade_confirm_transaction', {
    p_transaction_id: deal!.transaction_id,
    p_device_id: seller.device,
  });
  expect(confirmed.error).toBeNull();

  await page.goto('/es/comercio/operaciones/');
  await (
    await hydrated(
      page,
      page.getByRole('button', { name: trade.operations.actions.confirm, exact: true }),
    )
  ).click();
  const confirm = dialog(page);
  await confirm
    .getByRole('button', { name: trade.operations.actions.confirm, exact: true })
    .click();
  await expect(page.getByText(trade.operations.states.confirmada, { exact: true })).toBeVisible();

  // The buyer's review in the page, the seller's through the API (§9.15.4, both ways).
  await page.getByRole('button', { name: trade.operations.actions.review, exact: true }).click();
  const review = dialog(page);
  await review.getByRole('radio', { name: fill(trade.review.star.other, { n: '5' }) }).check();
  await review.getByRole('button', { name: trade.review.submit, exact: true }).click();
  await expect(page.getByText(trade.review.sent, { exact: true })).toBeVisible();
  const sellerReview = await seller.client.rpc('trade_submit_review', {
    p_transaction_id: deal!.transaction_id,
    p_score: 4,
    p_comment: null,
    p_device_id: seller.device,
  });
  expect(sellerReview.error).toBeNull();

  // An online status from the account menu (§9.16.2).
  await chip.click();
  await page.getByRole('menuitemradio', { name: trade.presence.ausente }).click();
  await expect(chip).toHaveAccessibleName(new RegExp(trade.presence.ausente));

  // «Mi perfil»: the own listing and the review received.
  const buyer: ApiAccount = {
    id: buyerId!,
    client: createClient(stack.url, stack.anonKey, clientOptions),
    device: randomUUID(),
  };
  expect(
    (await buyer.client.auth.signInWithPassword({ email: emails.buyer, password })).error,
  ).toBeNull();
  await shareEmail(buyer.client, emails.buyer);
  await publish(buyer, { game_prices: [{ tipo: 'pokedolares', cantidad: 5_000_000 }] });
  await page.goto('/es/cuenta/perfil/');
  await expect(page.getByRole('heading', { name: profile.title, level: 1 })).toBeVisible();
  // «Anuncios» is the first tab.
  await expect(page.getByRole('main').getByText('Fire Stone').first()).toBeVisible();
  await page
    .getByRole('main')
    .getByRole('button', { name: profile.tabs.received, exact: true })
    .click();
  await expect(page.getByText(fill(trade.seller.reviewScore, { n: '4' })).first()).toBeVisible();

  // The moderator sees the report in the queue (§9.11).
  const moderator = await apiAccount(emails.moderator, `m-${run}`);
  sql(`insert into public.trade_moderators (user_id) values (${literal(moderator.id)})`);
  const modContext = await browser.newContext({
    baseURL: ACCOUNT_ORIGIN,
    storageState: {
      cookies: [],
      origins: [
        {
          origin: ACCOUNT_ORIGIN,
          localStorage: [{ name: 'alliance-codex:comercio:edad:v1', value: 'adulto' }],
        },
      ],
    },
  });
  const modPage = await modContext.newPage();
  await stubRemoteArt(modPage);
  await modPage.goto('/es/cuenta/');
  await modPage.getByLabel(account.access.email, { exact: true }).fill(emails.moderator);
  await modPage.getByLabel(account.access.password, { exact: true }).fill(password);
  await modPage.locator('form.ac-account-form button[type="submit"]').click();
  await expect(
    modPage.getByText(fill(account.access.signedIn, { email: emails.moderator })),
  ).toBeVisible();
  await modPage.goto('/es/comercio/moderacion/');
  await expect(modPage.getByText(trade.report.reasons.estafa).first()).toBeVisible();
  await modContext.close();

  // «Cerrar sesión» from the menu.
  await chip.click();
  await page.getByRole('menuitem', { name: shell.account.signOut }).click();
  await expect(entry(page).getByRole('link', { name: shell.account.signIn })).toBeVisible();
});
