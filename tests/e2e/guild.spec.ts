// Guild (§10, M13): one short smoke of the page. Local mode runs on the development server of
// every run, with Supabase off (playwright.config.ts). The member case of account mode
// (CA-10.11) runs on the server of the LOCAL stack and skips without one
// (tests/e2e/local-supabase.ts). The figures are the guild-analytics.ts unit tests' job.
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

import { es } from '../../src/i18n/messages/es';
import { GUILD_EMPTY } from '../../src/i18n/messages/guild-empty';
import { fill } from '../../src/i18n/messages/types';
import { expect, test } from './fixtures';
import { ACCOUNT_ORIGIN, localSupabase } from './local-supabase';

const PAGE = '/es/herramientas/guild/';
const { guild } = es;

/** A world of the registry (content/mundos.json), for `create_guild`. */
const WORLD = (
  JSON.parse(readFileSync(new URL('../../content/mundos.json', import.meta.url), 'utf8')) as {
    mundos: { id: string; nombre: string }[];
  }
).mundos[0];

/**
 * An export of the in-game guild window. The fixed clock of §14.3 is Friday 18/09/2026, 14:32
 * in Brasília: Wednesday's export is the base of the week, Friday's the delta, and Thursday
 * 17/09 has none.
 */
function exportOf(name: string, exportedAt: string, dailies: number, contribution: number) {
  return {
    exportedAt,
    guild: name,
    members: [
      {
        name: 'Alpha Player',
        rank: 'the Leader',
        level: 180,
        lastLogin: exportedAt,
        dailiesCompleted: dailies,
        contribution,
        status: 'online',
      },
      {
        name: 'Beta Player',
        rank: 'a Member',
        level: 90,
        lastLogin: exportedAt,
        dailiesCompleted: 1,
        contribution: 50,
        status: 'offline',
      },
    ],
  };
}

function jsonFile(name: string, content: unknown) {
  return { name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(content)) };
}

test('the prerendered page has the crumbs, the h1 and a busy region, never the empty state (CA-10.13)', async ({
  request,
}) => {
  for (const locale of ['es', 'en'] as const) {
    const response = await request.get(`/${locale}/herramientas/guild/`);
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).not.toContain(GUILD_EMPTY[locale]);
    expect(html).toContain('aria-busy="true"');
  }
});

test('local mode: an import draws the summary and the day chart, and a day without export says «sin export»', async ({
  page,
}) => {
  await page.goto(PAGE);
  await expect(page.getByText(GUILD_EMPTY.es, { exact: true })).toBeVisible();

  await page.getByRole('button', { name: guild.emptyAction, exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog
    .locator('input[type="file"]')
    .setInputFiles([
      jsonFile('miercoles.json', exportOf('Smoke Guild', '2026-09-16 23:30:00', 3, 400)),
      jsonFile('viernes.json', exportOf('Smoke Guild', '2026-09-18 12:00:00', 5, 900)),
    ]);
  await dialog.getByRole('button', { name: guild.importDialog.submit, exact: true }).click();
  await expect(
    dialog.getByText(fill(guild.importDialog.imported, { dates: '16/09, 18/09' })),
  ).toBeVisible();
  await page.keyboard.press('Escape');

  await expect(page.getByRole('heading', { level: 1, name: 'Smoke Guild' })).toBeVisible();
  await expect(page.locator('.ac-guild-head')).toContainText('(hora de Brasilia)');
  await expect(page.getByRole('button', { name: guild.import, exact: true })).toBeVisible();

  // «Resumen»: the period has exports, so its four KPIs are drawn.
  const summary = page.locator('#resumen');
  await expect(summary.getByText(guild.summary.kpi.active, { exact: true })).toBeVisible();
  await expect(summary.getByText(guild.summary.kpi.points, { exact: true })).toBeVisible();

  // «Por día»: two bars, and Thursday has none and says «sin export» (CA-10.3).
  const days = page.locator('#por-dia');
  await expect(days.getByRole('heading', { name: guild.days.title })).toBeVisible();
  await expect(days.locator('.ac-bar-chart__bar')).toHaveCount(2);
  await expect(days.locator('.ac-bar-chart__x-cell').filter({ hasText: '17/09' })).toContainText(
    guild.days.noExport,
  );

  await expect(
    page.locator('#miembros').getByRole('button', { name: 'Alpha Player' }),
  ).toBeVisible();
});

test.describe('account mode on the local stack (CA-10.11)', () => {
  const stack = localSupabase();
  test.skip(stack === null, 'needs the local Supabase stack (supabase start)');
  test.use({ baseURL: ACCOUNT_ORIGIN });

  const run = randomUUID().slice(0, 8);
  const password = `Local-${randomUUID()}`;
  const guildName = `E2E Guild ${run}`;
  const users: string[] = [];
  let owner: SupabaseClient | null = null;
  let guildId: string | null = null;

  function admin(): SupabaseClient {
    if (stack === null) throw new Error('No local stack');
    return createClient(stack.url, stack.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async function account(email: string): Promise<SupabaseClient> {
    if (stack === null) throw new Error('No local stack');
    const created = await admin().auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error || !created.data.user) throw created.error ?? new Error('createUser');
    users.push(created.data.user.id);
    const client = createClient(stack.url, stack.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const signed = await client.auth.signInWithPassword({ email, password });
    if (signed.error) throw signed.error;
    return client;
  }

  test.afterAll(async () => {
    if (stack === null) return;
    if (owner !== null && guildId !== null)
      await owner.rpc('delete_guild', { p_guild_id: guildId });
    for (const id of users) await admin().auth.admin.deleteUser(id);
  });

  test('a member reads the guild and sees neither «Importar export» nor «Metas»', async ({
    page,
  }) => {
    // The owner creates the guild, uploads one export and invites the member (§10.13 RPCs).
    owner = await account(`m13-owner-${run}@example.com`);
    const created = await owner.rpc('create_guild', {
      p_display_name: guildName,
      p_world_id: WORLD.id,
    });
    expect(created.error).toBeNull();
    guildId = (Array.isArray(created.data) ? created.data[0] : created.data).guild_id as string;
    const payload = exportOf(guildName, '2026-09-18 12:00:00', 5, 900);
    const uploaded = await owner.rpc('replace_guild_daily_export', {
      p_guild_id: guildId,
      p_exported_at: '2026-09-18T15:00:00Z',
      p_payload_digest: createHash('sha256').update(JSON.stringify(payload)).digest('hex'),
      p_members: payload.members,
    });
    expect(uploaded.error).toBeNull();
    const invited = await owner.rpc('create_guild_invitation', {
      p_guild_id: guildId,
      p_role: 'member',
    });
    expect(invited.error).toBeNull();
    const token = (Array.isArray(invited.data) ? invited.data[0] : invited.data).token as string;
    const memberEmail = `m13-member-${run}@example.com`;
    const member = await account(memberEmail);
    const accepted = await member.rpc('accept_guild_invitation', { p_token: token });
    expect(accepted.error).toBeNull();

    // The member signs in on /cuenta/ and opens Guild in account mode.
    await page.goto('/es/cuenta/');
    await page.getByLabel(es.account.access.email, { exact: true }).fill(memberEmail);
    await page.getByLabel(es.account.access.password, { exact: true }).fill(password);
    await page.locator('form.ac-account-form button[type="submit"]').click();
    await expect(
      page.getByText(fill(es.account.access.signedIn, { email: memberEmail })),
    ).toBeVisible();

    await page.goto(PAGE);
    await expect(page.getByRole('heading', { level: 1, name: guildName })).toBeVisible();
    await expect(page.locator('#resumen')).toBeVisible();
    await expect(page.getByRole('button', { name: guild.import, exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: guild.goals, exact: true })).toHaveCount(0);
  });
});
