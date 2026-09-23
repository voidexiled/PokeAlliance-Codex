// Cuenta (§9.9 without Comercio, §10.4; M13): one short smoke of `/{l}/cuenta/` in account mode,
// on the development server of the LOCAL Supabase stack (tests/e2e/local-supabase.ts). The page
// exists only with Supabase configured, so this spec skips without a local stack. An account is
// created in the page, it creates a guild in a world of content/mundos.json and an invitation
// link, a second account joins through that link, and «Quitar» and «Eliminar guild» open their
// confirmation with the focus on «Cancelar» (CA-10.14). The test accounts are deleted after.
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

import { es } from '../../src/i18n/messages/es';
import { fill } from '../../src/i18n/messages/types';
import { expect, test } from './fixtures';
import { ACCOUNT_ORIGIN, localSupabase } from './local-supabase';

const stack = localSupabase();
test.skip(stack === null, 'needs the local Supabase stack (supabase start)');
test.use({ baseURL: ACCOUNT_ORIGIN });

const { account } = es;
const WORLD = (
  JSON.parse(readFileSync(new URL('../../content/mundos.json', import.meta.url), 'utf8')) as {
    mundos: { id: string; nombre: string }[];
  }
).mundos[0];

const run = randomUUID().slice(0, 8);
const password = `Local-${randomUUID()}`;
const ownerEmail = `m13-cuenta-owner-${run}@example.com`;
const memberEmail = `m13-cuenta-member-${run}@example.com`;
const guildName = `Cuenta ${run}`;

function admin(): SupabaseClient {
  if (stack === null) throw new Error('No local stack');
  return createClient(stack.url, stack.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

test.afterAll(async () => {
  if (stack === null) return;
  const { data } = await admin().auth.admin.listUsers({ perPage: 1000 });
  for (const user of data.users) {
    if (user.email === ownerEmail || user.email === memberEmail) {
      await admin().auth.admin.deleteUser(user.id);
    }
  }
});

test('an account creates a guild, invites, and «Quitar» and «Eliminar guild» ask first (CA-10.14)', async ({
  page,
}) => {
  if (stack === null) return;

  // «Acceso»: create the account in the page (the local stack confirms it at once).
  await page.goto('/es/cuenta/');
  await page.getByRole('button', { name: account.access.signUp, exact: true }).click();
  await page.getByLabel(account.access.email, { exact: true }).fill(ownerEmail);
  await page.getByLabel(account.access.password, { exact: true }).fill(password);
  await page.locator('form.ac-account-form button[type="submit"]').click();
  await expect(page.getByText(fill(account.access.signedIn, { email: ownerEmail }))).toBeVisible();

  // «Crear guild» with a world of the registry.
  const guilds = page.locator('#guilds');
  await expect(guilds.getByText(account.guilds.none, { exact: true })).toBeVisible();
  await guilds.getByLabel(account.guilds.name, { exact: true }).fill(guildName);
  await guilds.getByRole('combobox', { name: account.guilds.world }).click();
  await page.getByRole('option', { name: WORLD.nombre, exact: true }).click();
  await guilds.getByRole('button', { name: account.guilds.create, exact: true }).click();
  const block = guilds.locator('article').filter({ hasText: guildName });
  await expect(block.getByRole('heading', { name: guildName })).toBeVisible();
  await expect(block).toContainText(WORLD.nombre);

  // «Invitar miembro»: a one-use link to this page with the token in its fragment.
  await block.getByRole('button', { name: account.guilds.inviteMember, exact: true }).click();
  const link = await block.getByLabel(account.guilds.link, { exact: true }).inputValue();
  expect(link).toMatch(/\/es\/cuenta\/#invitacion=[a-f0-9]{64}$/);
  const token = decodeURIComponent(link.split('#invitacion=')[1] ?? '');

  // A second account accepts the link, so the owner has someone to «Quitar».
  const created = await admin().auth.admin.createUser({
    email: memberEmail,
    password,
    email_confirm: true,
  });
  expect(created.error).toBeNull();
  const member = createClient(stack.url, stack.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  expect((await member.auth.signInWithPassword({ email: memberEmail, password })).error).toBeNull();
  expect((await member.rpc('accept_guild_invitation', { p_token: token })).error).toBeNull();

  await page.reload();
  const cancel = account.cancel;

  // «Quitar»: an alert dialog with the texts of §10.4 and the focus on «Cancelar».
  await block.getByRole('button', { name: account.guilds.remove, exact: true }).click();
  let confirm = page.getByRole('alertdialog');
  await expect(confirm).toContainText(account.guilds.removeText);
  await expect(confirm.getByRole('button', { name: cancel, exact: true })).toBeFocused();
  await confirm.getByRole('button', { name: cancel, exact: true }).click();
  await expect(confirm).toBeHidden();

  // «Eliminar guild»: the same, and confirming it deletes the guild.
  await block.getByRole('button', { name: account.guilds.delete, exact: true }).click();
  confirm = page.getByRole('alertdialog');
  await expect(confirm).toContainText(fill(account.guilds.deleteTitle, { guild: guildName }));
  await expect(confirm.getByRole('button', { name: cancel, exact: true })).toBeFocused();
  await confirm.getByRole('button', { name: account.guilds.delete, exact: true }).click();
  await expect(guilds.getByText(account.guilds.none, { exact: true })).toBeVisible();
});
