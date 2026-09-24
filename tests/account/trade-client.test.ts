// The client of the account and Comercio functions (src/lib/supabase/trade.ts): the SQL names and
// arguments each call sends (the contract with the migrations), the browser id on the seven
// Comercio actions of 9.15.3 and nowhere else, the values refused before any request, and how
// the answers become the types the islands read. A fake client stands in for supabase-js.
import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ACCOUNT_CACHE_KEY } from '@/lib/account/session-cache';
import {
  TRADE_RPC,
  acceptRealMoneyConsent,
  cancelTransaction,
  completeAccountProfile,
  confirmTransaction,
  deleteAccount,
  disputeTransaction,
  getEffectivePresence,
  getSellerReputation,
  isTradeModerator,
  listMyListings,
  listMyReviews,
  listMyTransactions,
  listingPayload,
  moderateTrade,
  publishListing,
  refreshCachedAccount,
  refusalReason,
  reportTradeTarget,
  setPresenceState,
  signOutAccount,
  startTransaction,
  submitReview,
  toAccountSummary,
  toAnuncio,
  transactionContacts,
  updateAccountProfile,
  updateReview,
  type TradeListingInput,
} from '@/lib/supabase/trade';
import { DEVICE_ID_KEY } from '@/scripts/presence';

class MemoryStorage {
  readonly items = new Map<string, string>();
  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.items.set(key, String(value));
  }
  removeItem(key: string): void {
    this.items.delete(key);
  }
}

const USER = '8c7f1f3e-2a55-4d8e-9d0e-6f1b2c3d4e5f';
const ID = '1b2c3d4e-5f60-4a1b-8c2d-3e4f5a6b7c8d';
const DEVICE = '0f8c1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b';

/** An answer of `account_registration_state()` as the account_trust migration builds it. */
const STATE = {
  steps: { email: true, identity: true, phone: true, profile: true },
  phone_required: false,
  complete: true,
  identities: ['discord', 'email'],
  member_since: '2026-09-01T10:00:00+00:00',
  profile: {
    username: 'ash',
    player_name: 'Ash',
    world_key: 'kanto',
    country_code: 'BR',
    birth_date_saved: true,
    terms_version: '2026-09-23',
    terms_accepted_at: '2026-09-01T10:05:00+00:00',
    terms_current: true,
    username_locked: false,
  },
  comercio: {
    eligible: false,
    reason: 'discord_too_new',
    adult: true,
    consent_current: false,
    suspended_until: null,
    moderator: true,
  },
  presence: { estado: 'en_juego', efectivo: 'ausente' },
};

interface Call {
  name: string;
  args: Record<string, unknown>;
}

function fakeClient(answer: (name: string, args: Record<string, unknown>) => unknown = () => null) {
  const calls: Call[] = [];
  const auth = {
    getUser: vi.fn(async () => ({
      data: {
        user: {
          id: USER,
          identities: [
            {
              provider: 'discord',
              identity_data: { avatar_url: 'https://cdn.discordapp.com/avatars/1/a.png' },
            },
          ],
        },
      },
      error: null,
    })),
    signOut: vi.fn(async () => ({ error: null })),
  };
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(async () => ({ data: answer('trade_listings', {}), error: null, status: 200 })),
  };
  const client = {
    rpc: vi.fn(async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      return { data: answer(name, args), error: null, status: 200 };
    }),
    from: vi.fn(() => query),
    auth,
  };
  return { client: client as unknown as SupabaseClient, calls, auth, query };
}

let storage: MemoryStorage;

beforeEach(() => {
  storage = new MemoryStorage();
  storage.setItem(DEVICE_ID_KEY, DEVICE);
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('window', new EventTarget());
  vi.stubEnv('PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321');
  vi.stubEnv('PUBLIC_SUPABASE_ANON_KEY', 'sb_publishable_local_test');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const listing: TradeListingInput = {
  tipo: 'diamonds',
  mundo: 'kanto',
  cantidad: 500,
  precio: { real: { moneda: 'BRL', importe: '35.50' }, juego: [], aConvenir: false },
};

describe('evidence (9.15.3)', () => {
  it('sends the browser id with the seven Comercio actions', async () => {
    const { client, calls } = fakeClient((name) =>
      name.endsWith('_listing') ||
      name === 'trade_start_transaction' ||
      name === 'trade_submit_review'
        ? ID
        : null,
    );
    await publishListing(client, listing);
    await startTransaction(client, ID);
    await confirmTransaction(client, ID);
    await cancelTransaction(client, ID);
    await disputeTransaction(client, ID, '  ');
    await submitReview(client, ID, 5, ' Todo bien ');
    await reportTradeTarget(client, {
      targetType: 'listing',
      targetId: ID,
      reason: 'estafa',
      detail: null,
      operation: 123,
    });
    expect(calls.map(({ name }) => name)).toEqual([
      'trade_publish_listing',
      'trade_start_transaction',
      'trade_confirm_transaction',
      'trade_cancel_transaction',
      'trade_dispute_transaction',
      'trade_submit_review',
      'trade_report',
    ]);
    for (const call of calls) expect(call.args.p_device_id, call.name).toBe(DEVICE);
    expect(calls[4]?.args).toEqual({ p_transaction_id: ID, p_detail: null, p_device_id: DEVICE });
    expect(calls[5]?.args).toEqual({
      p_transaction_id: ID,
      p_score: 5,
      p_comment: 'Todo bien',
      p_device_id: DEVICE,
    });
    expect(calls[6]?.args).toEqual({
      p_target_type: 'listing',
      p_target_id: ID,
      p_reason: 'estafa',
      p_detail: null,
      p_transaction_number: 123,
      p_device_id: DEVICE,
    });
  });

  it('sends it nowhere else', async () => {
    const { client, calls } = fakeClient();
    await updateReview(client, ID, 4, null);
    await setPresenceState(client, 'ausente');
    await acceptRealMoneyConsent(client);
    await transactionContacts(client, ID);
    for (const call of calls) expect(call.args, call.name).not.toHaveProperty('p_device_id');
    expect(calls.map(({ name, args }) => [name, args])).toEqual([
      ['trade_update_review', { p_review_id: ID, p_score: 4, p_comment: null }],
      ['trade_set_presence', { p_estado: 'ausente' }],
      ['trade_accept_consent', { p_version: '2026-09-23' }],
      ['trade_transaction_contacts', { p_transaction_id: ID }],
    ]);
  });
});

describe('values refused before any request (22023)', () => {
  it('ids, scores, comments, reports and moderation reasons', async () => {
    const { client, calls } = fakeClient();
    const results = await Promise.all([
      confirmTransaction(client, 'not-a-uuid'),
      submitReview(client, ID, 0, null),
      submitReview(client, ID, 6, null),
      submitReview(client, ID, 4.5, null),
      submitReview(client, ID, 5, 'x'.repeat(1001)),
      reportTradeTarget(client, {
        targetType: 'seller',
        targetId: ID,
        reason: 'otro',
        detail: '   ',
        operation: null,
      }),
      reportTradeTarget(client, {
        targetType: 'review',
        targetId: ID,
        reason: 'estafa',
        detail: null,
        operation: 0,
      }),
      moderateTrade(client, {
        action: 'suspend',
        targetType: 'user',
        targetId: ID,
        reason: '  ',
        until: null,
        reportId: null,
        flagId: null,
      }),
      updateAccountProfile(client, {
        username: 'ash',
        player: '  ',
        world: 'kanto',
        country: 'BR',
      }),
      setPresenceState(client, 'online' as never),
    ]);
    for (const result of results) expect(result.error).toEqual({ code: '22023', network: false });
    expect(calls).toEqual([]);
  });
});

describe('account (account_trust)', () => {
  it('reads account_registration_state', () => {
    expect(toAccountSummary(STATE)).toEqual({
      steps: { email: true, identity: true, phone: true, profile: true },
      phoneRequired: false,
      registrationComplete: true,
      providers: ['discord', 'email'],
      memberSince: '2026-09-01T10:00:00+00:00',
      username: 'ash',
      player: 'Ash',
      world: 'kanto',
      country: 'BR',
      birthDateSaved: true,
      termsCurrent: true,
      usernameLocked: false,
      comercioEligible: false,
      comercioBlock: 'discord_too_new',
      adult: true,
      consentCurrent: false,
      suspendedUntil: null,
      moderator: true,
      presence: 'en_juego',
      effectivePresence: 'ausente',
    });
    expect(toAccountSummary({ ...STATE, profile: null })?.username).toBeNull();
    expect(toAccountSummary(null)).toBeNull();
  });

  it('saves step 3 and the later edits with account_save_profile', async () => {
    const { client, calls } = fakeClient(() => STATE);
    const saved = await completeAccountProfile(client, {
      username: 'ash',
      player: 'Ash',
      world: 'kanto',
      country: 'BR',
      birthDate: '2000-01-31',
    });
    expect(saved.data?.registrationComplete).toBe(true);
    await updateAccountProfile(client, {
      username: 'ash',
      player: ' Ash K ',
      world: 'johto',
      country: 'MX',
    });
    expect(calls).toEqual([
      {
        name: 'account_save_profile',
        args: {
          p_username: 'ash',
          p_player_name: 'Ash',
          p_world_key: 'kanto',
          p_country_code: 'BR',
          p_birth_date: '2000-01-31',
          p_terms_version: '2026-09-23',
        },
      },
      {
        name: 'account_save_profile',
        args: {
          p_username: 'ash',
          p_player_name: 'Ash K',
          p_world_key: 'johto',
          p_country_code: 'MX',
          p_birth_date: null,
          p_terms_version: null,
        },
      },
    ]);
  });

  it('keeps the fixed reason of a refusal, never a sentence (9.12.3)', async () => {
    const refusing = (message: string) =>
      ({
        rpc: async () => ({ data: null, error: { code: '23505', message }, status: 409 }),
      }) as unknown as SupabaseClient;
    const profile = {
      username: 'ash',
      player: 'Ash',
      world: 'kanto',
      country: 'BR',
      birthDate: '2000-01-31',
    };
    expect(await completeAccountProfile(refusing('username_taken'), profile)).toEqual({
      data: null,
      error: { code: '23505', network: false },
      reason: 'username_taken',
    });
    const sentence = await completeAccountProfile(
      refusing('duplicate key value violates unique constraint'),
      profile,
    );
    expect(sentence.reason).toBeNull();
    expect(refusalReason({ message: 'consent_required' })).toBe('consent_required');
    expect(refusalReason(new Error('Failed to fetch'))).toBeNull();
  });

  it('writes the header cache after loading the account', async () => {
    storage.setItem(
      'sb-127-auth-token',
      JSON.stringify({ access_token: 'x.y.z', expires_at: 1_790_000_000, user: { id: USER } }),
    );
    const { client, calls } = fakeClient(() => STATE);
    const result = await refreshCachedAccount(client);
    expect(result.data?.username).toBe('ash');
    expect(calls.map(({ name }) => name)).toEqual([TRADE_RPC.accountState]);
    expect(JSON.parse(storage.getItem(ACCOUNT_CACHE_KEY) ?? 'null')).toEqual({
      userId: USER,
      username: 'ash',
      player: 'Ash',
      world: 'kanto',
      avatar: 'https://cdn.discordapp.com/avatars/1/a.png',
      presence: 'en_juego',
      moderator: true,
      registrationComplete: true,
    });
  });

  it('closes a session the server refuses and clears the cache', async () => {
    storage.setItem(ACCOUNT_CACHE_KEY, JSON.stringify({ userId: USER }));
    const { client, auth, calls } = fakeClient();
    auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: { name: 'AuthApiError', status: 403, code: 'session_not_found' },
    } as never);
    expect(await refreshCachedAccount(client)).toEqual({ data: null, error: null, reason: null });
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(storage.getItem(ACCOUNT_CACHE_KEY)).toBeNull();
    expect(calls).toEqual([]);
  });

  it('keeps everything when the server cannot be reached', async () => {
    storage.setItem(ACCOUNT_CACHE_KEY, JSON.stringify({ userId: USER }));
    const { client, auth } = fakeClient();
    auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: { name: 'AuthRetryableFetchError', status: 0 },
    } as never);
    expect((await refreshCachedAccount(client)).error).toEqual({ code: null, network: true });
    expect(auth.signOut).not.toHaveBeenCalled();
    expect(storage.getItem(ACCOUNT_CACHE_KEY)).not.toBeNull();
  });

  it('signs out as «Desconectado» and clears the cache', async () => {
    storage.setItem(ACCOUNT_CACHE_KEY, JSON.stringify({ userId: USER }));
    const { client, auth, calls } = fakeClient();
    expect(await signOutAccount(client, { presence: true })).toEqual({
      data: true,
      error: null,
      reason: null,
    });
    expect(calls).toEqual([{ name: 'trade_set_presence', args: { p_estado: 'desconectado' } }]);
    expect(auth.signOut).toHaveBeenCalledTimes(1);
    expect(storage.getItem(ACCOUNT_CACHE_KEY)).toBeNull();
  });

  it('deletes the account and ends the session here', async () => {
    const { client, auth, calls } = fakeClient(() => 'reserved');
    expect(await deleteAccount(client)).toEqual({ data: 'reserved', error: null, reason: null });
    expect(calls.map(({ name }) => name)).toEqual(['account_delete']);
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('asks account_is_moderator', async () => {
    const { client, calls } = fakeClient(() => true);
    expect((await isTradeModerator(client)).data).toBe(true);
    expect(calls).toEqual([{ name: 'account_is_moderator', args: {} }]);
  });
});

describe('reads', () => {
  it('asks the presence of at most 100 accounts per call', async () => {
    const ids = Array.from(
      { length: 250 },
      (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    );
    const { client, calls } = fakeClient((_, args) =>
      (args.p_user_ids as string[]).map((user_id) => ({ user_id, estado: 'en_juego' })),
    );
    const result = await getEffectivePresence(client, [...ids, ids[0] ?? '', 'bad']);
    expect(calls.map(({ args }) => (args.p_user_ids as string[]).length)).toEqual([100, 100, 50]);
    expect(result.data?.size).toBe(250);
    expect(await getEffectivePresence(client, [])).toEqual({
      data: new Map(),
      error: null,
      reason: null,
    });
  });

  it('maps a reputation row, with either vocabulary', async () => {
    const { client } = fakeClient(() => [
      { operaciones: 50, contrapartes: 5, media: '4.8', d1: 0, d2: 1, d3: 0, d4: 9, d5: 40 },
    ]);
    expect((await getSellerReputation(client, ID)).data).toEqual({
      valoracion: 4.8,
      resenas: 50,
      distribucion: [0, 0, 1, 0, 9, 40],
      operaciones: 50,
      contrapartes: 5,
    });
    const { client: old } = fakeClient(() => [
      { reviews: 2, average: 3, confirmed_transactions: 3, counterparts: 2, d1: 1, d5: 1 },
    ]);
    expect((await getSellerReputation(old, ID)).data).toMatchObject({
      valoracion: 3,
      resenas: 2,
      operaciones: 3,
      contrapartes: 2,
    });
    const { client: none } = fakeClient(() => []);
    expect((await getSellerReputation(none, ID)).data).toBeNull();
  });

  it('maps the deals of the account', async () => {
    const { client, calls } = fakeClient(() => [
      {
        transaction_id: ID,
        number: 123,
        role: 'buyer',
        status: 'confirmada',
        listing_id: USER,
        asset_type: 'items',
        asset: { item: 'oran-berry', nombre: 'Oran Berry', cantidad: 50 },
        listing_public: true,
        counterpart_handle: 'misty',
        created_at: '2026-09-20T10:00:00Z',
        updated_at: '2026-09-21T10:00:00Z',
        confirmed_at: '2026-09-21T10:00:00Z',
        review_id: null,
        reviewable: true,
      },
      { transaction_id: 'broken' },
    ]);
    expect((await listMyTransactions(client)).data).toEqual([
      {
        id: ID,
        number: 123,
        role: 'buyer',
        status: 'confirmada',
        listing: {
          id: USER,
          tipo: 'items',
          pokemon: null,
          item: { item: 'oran-berry', nombre: 'Oran Berry' },
          cantidad: null,
          detail: true,
        },
        counterpart: 'misty',
        createdAt: '2026-09-20T10:00:00Z',
        changedAt: '2026-09-21T10:00:00Z',
        confirmedAt: '2026-09-21T10:00:00Z',
        review: null,
        reviewable: true,
      },
    ]);
    expect(calls).toEqual([{ name: 'trade_my_transactions', args: {} }]);
  });

  it('maps revealed contacts as text', async () => {
    const { client } = fakeClient(() => [
      { kind: 'phone', public_label: '+55', value: '+5511900001234' },
      { kind: 'other', platform: 'Telegram', public_label: null, value: '@ash' },
      { kind: 'discord', public_label: null, value: 'ash#0001' },
      { kind: 'email', value: null },
    ]);
    expect((await transactionContacts(client, ID)).data).toEqual([
      { kind: 'phone', label: '+55', value: '+5511900001234' },
      { kind: 'other', label: 'Telegram', value: '@ash' },
      { kind: 'discord', label: null, value: 'ash#0001' },
    ]);
  });

  it('pages the reviews of «Mi perfil» by 10', async () => {
    const review = (index: number) => ({
      review_id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      transaction_id: ID,
      transaction_number: index,
      role: 'seller',
      score: 5,
      comment: null,
      created_at: '2026-09-20T10:00:00Z',
      counterpart_handle: 'misty',
      editable: true,
    });
    const { client, calls } = fakeClient(() =>
      Array.from({ length: 11 }, (_, index) => review(index + 1)),
    );
    const page = await listMyReviews(client, 'received', 1);
    expect(calls).toEqual([
      { name: 'trade_my_reviews', args: { p_direction: 'received', p_limit: 11, p_offset: 10 } },
    ]);
    expect(page.data?.reviews).toHaveLength(10);
    expect(page.data?.more).toBe(true);
    // Only a review the account wrote can be edited.
    expect(page.data?.reviews.every(({ editable }) => !editable)).toBe(true);
  });

  it('lists the own listings of every state from the table, under RLS', async () => {
    const { client, query } = fakeClient((name) =>
      name === 'trade_listings'
        ? [
            {
              listing_id: ID,
              asset_type: 'diamonds',
              world_key: 'kanto',
              status: 'retirado',
              asset: { cantidad: 500 },
              fiat_currency: 'BRL',
              fiat_amount: 35.5,
              game_prices: [{ tipo: 'pokedolares', cantidad: 50_000_000 }],
              negotiable: false,
              created_at: '2026-09-20T10:00:00Z',
              published_at: '2026-09-20T10:00:00Z',
              expires_at: '2026-10-04T10:00:00Z',
            },
            { listing_id: USER, asset_type: 'cars', status: 'publicado' },
          ]
        : null,
    );
    const result = await listMyListings(client, { userId: USER, handle: 'ash' });
    expect(query.eq).toHaveBeenCalledWith('seller_id', USER);
    expect(result.data).toEqual([
      {
        id: ID,
        tipo: 'diamonds',
        vendedor: 'ash',
        mundo: 'kanto',
        publicado: '2026-09-20T10:00:00Z',
        expira: '2026-10-04T10:00:00Z',
        estado: 'retirado',
        precio: {
          real: { moneda: 'BRL', importe: '35.50' },
          juego: [{ tipo: 'pokedolares', cantidad: 50_000_000 }],
          aConvenir: false,
        },
        cantidad: 500,
      },
    ]);
  });
});

describe('listing payload (9.12.1)', () => {
  it('writes the columns of trade_listings and reads them back', () => {
    const payload = listingPayload(listing);
    expect(payload).toEqual({
      asset_type: 'diamonds',
      world_key: 'kanto',
      asset: { cantidad: 500 },
      fiat_currency: 'BRL',
      fiat_amount: '35.50',
      game_prices: [],
      negotiable: false,
    });
    const back = toAnuncio(
      { ...payload, listing_id: ID, status: 'publicado', created_at: '2026-09-20T10:00:00Z' },
      'ash',
    );
    expect(back).toMatchObject({ tipo: 'diamonds', cantidad: 500, precio: listing.precio });
  });
});
