// The Supabase calls of the accounts and of Comercio phase B (spec 9.9 to 9.16): every database
// function of the account_trust and trade_marketplace migrations and the reads of «Mi perfil»
// (9.16.3). The database enforces every rule and every permission (9.12.2, 9.12.3, 9.15.2);
// nothing here is trusted for one. The few checks below only spare the server a call it would
// refuse anyway, and answer with the code it would give (22023).
//
// - A failure comes back reduced to its code by src/lib/supabase/errors.ts (12.14.1): the islands
//   show `mapSupabaseError` and decide the few codes that name a field by code, never by message.
// - `TRADE_RPC` holds the SQL name of every function and each call writes its arguments (the `p_`
//   style of the migrations) next to it: this module is the one place to reconcile them with the
//   migrations.
// - Evidence (9.15.3): the seven Comercio actions (publish, contact, confirm, cancel, dispute,
//   review, report) send `p_device_id`, the random id of this browser (src/scripts/presence.ts).
//   The database keeps it with the request IP only after the real-money consent and shows it to
//   moderators alone.
// - No provenance and no invented values: a column the database does not send is null.
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  identityAvatar,
  type IdentityLike,
  type RegistrationFacts,
} from '@/lib/account/registration';
import {
  clearCachedAccount,
  readCachedAccount,
  writeCachedAccount,
  type CachedAccount,
} from '@/lib/account/session-cache';
import { firstRow } from '@/lib/supabase/client';
import { operationFailed, toSupabaseFailure, type SupabaseOperation } from '@/lib/supabase/errors';
import {
  CONSENTIMIENTO_DINERO_REAL_VERSION,
  NOMBRE_JUGADOR_MAX,
  PERSONAJES_MAX,
  PLATAFORMA_MAX,
  PUNTUACION_MAX,
  PUNTUACION_MIN,
  REPORTE_DETALLE_MAX,
  RESENA_COMENTARIO_MAX,
  TERMINOS_VERSION,
  isEstadoPresencia,
  type EstadoPresencia,
} from '@/lib/trade/limits';
import {
  ESTADOS_ANUNCIO,
  MONEDAS_JUEGO,
  MONEDAS_REALES,
  TIPOS_ACTIVO,
  type Anuncio,
  type EstadoAnuncio,
  type ItemDeclarado,
  type ListingCharacter,
  type MonedaJuego,
  type MonedaReal,
  type OpcionJuego,
  type Precio,
  type SellerReputation,
  type TipoActivo,
  type UnidadPokemon,
} from '@/lib/trade/types';
import { HEARTBEAT_RPC, getDeviceId } from '@/scripts/presence';

export type { SupabaseFailure, SupabaseOperation } from '@/lib/supabase/errors';

/**
 * The result of every call here: a `SupabaseOperation` and, when the database refused it, the fixed
 * reason its function raised (`username_taken`, `consent_required`, `discord_too_new`…), which 9.12.3
 * lets the island translate («un mensaje fijo que la isla traduce»). Any other message is dropped:
 * the interface decides on the code and on these tokens, never on free text.
 */
export type TradeOperation<T> = SupabaseOperation<T> & { reason: string | null };

/** The database functions, by their SQL names. */
export const TRADE_RPC = {
  // account_trust (accounts, consent, presence)
  accountState: 'account_registration_state',
  saveProfile: 'account_save_profile',
  deleteAccount: 'account_delete',
  // account_characters
  listCharacters: 'account_characters_list',
  addCharacter: 'account_character_add',
  setMainCharacter: 'account_character_set_main',
  removeCharacter: 'account_character_remove',
  isModerator: 'account_is_moderator',
  acceptConsent: 'trade_accept_consent',
  setPresence: 'trade_set_presence',
  heartbeat: HEARTBEAT_RPC,
  effectivePresence: 'trade_effective_presence',
  // trade_marketplace
  sellerStats: 'trade_seller_stats',
  buyerStats: 'trade_buyer_stats',
  publicReviews: 'trade_public_reviews',
  publishListing: 'trade_publish_listing',
  updateListing: 'trade_update_listing',
  setListingStatus: 'trade_set_listing_status',
  startTransaction: 'trade_start_transaction',
  confirmTransaction: 'trade_confirm_transaction',
  cancelTransaction: 'trade_cancel_transaction',
  disputeTransaction: 'trade_dispute_transaction',
  transactionContacts: 'trade_transaction_contacts',
  myTransactions: 'trade_my_transactions',
  submitReview: 'trade_submit_review',
  updateReview: 'trade_update_review',
  myReviews: 'trade_my_reviews',
  myChannels: 'trade_my_channels',
  upsertChannel: 'trade_upsert_channel',
  deleteChannel: 'trade_delete_channel',
  syncOauthChannels: 'trade_sync_oauth_channels',
  requestChannelCode: 'trade_request_channel_code',
  report: 'trade_report',
  moderationReports: 'trade_moderation_reports',
  moderationFlags: 'trade_moderation_flags',
  pendingChannels: 'trade_pending_channels',
  moderate: 'trade_moderate',
  verifyChannel: 'trade_verify_channel',
} as const;

/** The table of listings, read under RLS: the owner sees its own in every state (9.12.2). */
export const TRADE_LISTINGS_TABLE = 'trade_listings';

// ------------------------------------------------------------------------------ helpers

type Row = Record<string, unknown>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

/** A call refused before it reaches the server, with the code the database gives a bad value. */
function invalidInput<T>(): TradeOperation<T> {
  return { data: null, error: { code: '22023', network: false }, reason: null };
}

/** The fixed reason of a database refusal: a lowercase token, never a sentence. */
export function refusalReason(error: unknown): string | null {
  const message =
    typeof error === 'object' && error !== null ? (error as { message?: unknown }).message : null;
  return typeof message === 'string' && /^[a-z][a-z0-9_]{2,63}$/.test(message) ? message : null;
}

/** A failed call, reduced by errors.ts (12.14.1), with its fixed reason. */
function failed<T>(error: unknown, status?: number): TradeOperation<T> {
  return { ...operationFailed<T>(error, status), reason: refusalReason(error) };
}

/** Calls a database function. */
async function rpc<T>(
  client: SupabaseClient,
  name: string,
  args: Record<string, unknown>,
  toData: (data: unknown) => T,
): Promise<TradeOperation<T>> {
  const { data, error, status } = await client.rpc(name, args);
  if (error) return failed(error, status);
  return { data: toData(data), error: null, reason: null };
}

/** The evidence argument of the seven Comercio actions (9.15.3). */
function evidence(): { p_device_id: string | null } {
  return { p_device_id: getDeviceId() };
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

function numberOf(value: unknown): number | null {
  const parsed = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : null;
}

function count(value: unknown): number {
  const parsed = numberOf(value);
  return parsed !== null && parsed >= 0 ? Math.trunc(parsed) : 0;
}

function rows(data: unknown): Row[] {
  return Array.isArray(data)
    ? data.filter((row): row is Row => typeof row === 'object' && row !== null)
    : [];
}

function characters(value: string): number {
  return Array.from(value).length;
}

/** A trimmed optional text: null when empty, `undefined` when longer than `max` (invalid). */
function optionalText(value: string | null | undefined, max: number): string | null | undefined {
  const trimmed = value?.trim() ?? '';
  if (trimmed === '') return null;
  return characters(trimmed) <= max ? trimmed : undefined;
}

function oneOf<T extends string>(list: readonly T[], value: unknown): T | null {
  return list.includes(value as T) ? (value as T) : null;
}

// ------------------------------------------------------------------------------ account

/** The first Comercio requirement an account misses (`trade_eligibility`, 9.15.2). */
export const COMERCIO_BLOCKS = [
  'account_incomplete',
  'suspended',
  'underage',
  'discord_missing',
  'discord_too_new',
] as const;
export type ComercioBlock = (typeof COMERCIO_BLOCKS)[number];

/**
 * The signed-in account as `account_registration_state()` describes it to its owner (9.15.1,
 * 9.15.2, 9.16): the steps, the profile (never the birth date), the Comercio requirements and the
 * online status. It answers before the registration is complete.
 */
export interface AccountSummary {
  /** Each step of 9.15.1; `phone` is true when the phone is not required. */
  steps: { email: boolean; identity: boolean; phone: boolean; profile: boolean };
  /** `TELEFONO_OBLIGATORIO` of the database. */
  phoneRequired: boolean;
  /** The three steps are done. */
  registrationComplete: boolean;
  /** Providers of the linked identities (`email`, `discord`, `google`, `twitch`…). */
  providers: string[];
  /** When the account was created: «Miembro desde 09/2026». */
  memberSince: string | null;
  /** «Nombre de usuario», the public handle; null before step 3. */
  username: string | null;
  /** «Nombre del jugador». */
  player: string | null;
  /** World id of content/mundos.json. */
  world: string | null;
  /** ISO 3166-1 alpha-2. */
  country: string | null;
  /** The birth date is saved; it never leaves the database and cannot change. */
  birthDateSaved: boolean;
  /** The accepted terms are the current version. */
  termsCurrent: boolean;
  /** The username can no longer change: a first listing exists (9.16.3). */
  usernameLocked: boolean;
  /** Every requirement of 9.15.2 but the consent: complete, adult, Discord old enough, not suspended. */
  comercioEligible: boolean;
  /** The first requirement missing; null when eligible. */
  comercioBlock: ComercioBlock | null;
  /** 18 or older by the stored birth date; null before step 3. */
  adult: boolean | null;
  /** The current real-money consent is accepted (9.15.2). */
  consentCurrent: boolean;
  /** The end of a Comercio suspension, `'infinity'` for a ban; null without one (9.15.5). */
  suspendedUntil: string | null;
  /** A row in `trade_moderators`. */
  moderator: boolean;
  /** The state the account chose (9.15.6). */
  presence: EstadoPresencia;
  /** The state the others see now. */
  effectivePresence: EstadoPresencia;
}

function record(value: unknown): Row {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Row) : {};
}

/** The jsonb of `account_registration_state()`, which `account_save_profile` returns too. */
export function toAccountSummary(data: unknown): AccountSummary | null {
  const state = record(firstRow<unknown>(data));
  if (typeof state.complete !== 'boolean') return null;
  const steps = record(state.steps);
  const profile =
    typeof state.profile === 'object' && state.profile !== null ? record(state.profile) : null;
  const comercio = record(state.comercio);
  const presence = record(state.presence);
  return {
    steps: {
      email: steps.email === true,
      identity: steps.identity === true,
      phone: steps.phone === true,
      profile: steps.profile === true,
    },
    phoneRequired: state.phone_required === true,
    registrationComplete: state.complete,
    providers: Array.isArray(state.identities)
      ? state.identities.filter((provider): provider is string => typeof provider === 'string')
      : [],
    memberSince: text(state.member_since),
    username: text(profile?.username),
    player: text(profile?.player_name),
    world: text(profile?.world_key),
    country: text(profile?.country_code),
    birthDateSaved: profile?.birth_date_saved === true,
    termsCurrent: profile?.terms_current === true,
    usernameLocked: profile?.username_locked === true,
    comercioEligible: comercio.eligible === true,
    comercioBlock: oneOf(COMERCIO_BLOCKS, comercio.reason),
    adult: typeof comercio.adult === 'boolean' ? comercio.adult : null,
    consentCurrent: comercio.consent_current === true,
    suspendedUntil: text(comercio.suspended_until),
    moderator: comercio.moderator === true,
    presence: isEstadoPresencia(presence.estado) ? presence.estado : 'desconectado',
    effectivePresence: isEstadoPresencia(presence.efectivo) ? presence.efectivo : 'desconectado',
  };
}

/** The signed-in account; 42501 without a session. */
export async function getMyAccount(
  client: SupabaseClient,
): Promise<TradeOperation<AccountSummary | null>> {
  return rpc<AccountSummary | null>(client, TRADE_RPC.accountState, {}, toAccountSummary);
}

/** The facts of the registration state machine (registration.ts) from the account. */
export function registrationFactsFrom(summary: AccountSummary): RegistrationFacts {
  return {
    signedIn: true,
    pendingEmail: null,
    emailConfirmed: summary.steps.email,
    providers: summary.providers,
    phoneConfirmed: summary.steps.phone,
    profileSaved: summary.steps.profile,
  };
}

export interface AccountProfileInput {
  /** Lowercased by the database too. */
  username: string;
  player: string;
  /** World id of content/mundos.json. */
  world: string;
  /** ISO 3166-1 alpha-2. */
  country: string;
  /** `YYYY-MM-DD`; it cannot change once saved. */
  birthDate: string;
}

/**
 * Step 3 of 9.15.1 with the current terms version (`account_save_profile`). A used username or
 * player answers 23505 and an invalid value 22023; the database checks steps 1 and 2 again.
 * Resolves to the account as it is after saving.
 */
export async function completeAccountProfile(
  client: SupabaseClient,
  profile: AccountProfileInput,
): Promise<TradeOperation<AccountSummary | null>> {
  return rpc<AccountSummary | null>(
    client,
    TRADE_RPC.saveProfile,
    {
      p_username: profile.username,
      p_player_name: profile.player,
      p_world_key: profile.world,
      p_country_code: profile.country,
      p_birth_date: profile.birthDate,
      p_terms_version: TERMINOS_VERSION,
    },
    toAccountSummary,
  );
}

/**
 * «Editar perfil» (9.16.3): country, player name and world. The username goes as it is (it changes
 * only until the first listing); the birth date and the terms keep their saved values.
 */
export async function updateAccountProfile(
  client: SupabaseClient,
  profile: { username: string; player: string; world: string; country: string },
): Promise<TradeOperation<AccountSummary | null>> {
  const player = profile.player.trim();
  if (player === '' || characters(player) > NOMBRE_JUGADOR_MAX) return invalidInput();
  return rpc<AccountSummary | null>(
    client,
    TRADE_RPC.saveProfile,
    {
      p_username: profile.username,
      p_player_name: player,
      p_world_key: profile.world,
      p_country_code: profile.country,
      p_birth_date: null,
      p_terms_version: null,
    },
    toAccountSummary,
  );
}

/**
 * The header cache of an account (9.16.4): the summary and the avatar of its identities.
 * `characters` is how many characters the account has; left out, the cached count of the same
 * account is kept.
 */
export function cachedAccountFrom(
  userId: string,
  summary: AccountSummary | null,
  identities: readonly IdentityLike[] | null | undefined,
  characters?: number | null,
): CachedAccount {
  const cached = characters === undefined ? readCachedAccount() : null;
  return {
    userId,
    username: summary?.username ?? null,
    player: summary?.player ?? null,
    world: summary?.world ?? null,
    characters: characters ?? (cached?.userId === userId ? cached.characters : null),
    avatar: identityAvatar(identities),
    presence: summary?.presence ?? null,
    moderator: summary?.moderator ?? false,
    registrationComplete: summary?.registrationComplete ?? false,
  };
}

/**
 * Loads the account and writes the header cache (9.16.4), for the account page and the account
 * menu. A session the server no longer accepts is closed on this browser and the cache cleared:
 * the header then shows «Iniciar sesión».
 */
export async function refreshCachedAccount(
  client: SupabaseClient,
): Promise<TradeOperation<AccountSummary | null>> {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    if (error && toSupabaseFailure(error).network) return failed(error);
    await client.auth.signOut({ scope: 'local' }).catch(() => undefined);
    clearCachedAccount();
    return { data: null, error: null, reason: null };
  }
  const summary = await getMyAccount(client);
  if (summary.error) return summary;
  // The characters exist from registration step 3; a failed list keeps the cached count.
  const hasProfile = (summary.data?.player ?? null) !== null;
  const list = hasProfile ? await listMyCharacters(client).catch(() => null) : null;
  const characters = list?.data?.length;
  writeCachedAccount(
    cachedAccountFrom(data.user.id, summary.data, data.user.identities, characters),
  );
  return summary;
}

/**
 * «Cerrar sesión» (9.16.2): the state becomes `desconectado` (with `presence`, the builds with
 * COMERCIO_PUBLICO), the session closes and the cache is cleared. A failed sign-out keeps both.
 */
export async function signOutAccount(
  client: SupabaseClient,
  options: { presence: boolean },
): Promise<TradeOperation<true>> {
  if (options.presence) await setPresenceState(client, 'desconectado').catch(() => undefined);
  const { error } = await client.auth.signOut();
  if (error) return failed(error);
  clearCachedAccount();
  return { data: true, error: null, reason: null };
}

/**
 * «Eliminar cuenta» (9.9, 9.15.5): `deleted`, or `reserved` for a suspended account, whose email,
 * identities and player name stay taken. The session ends on this browser either way.
 */
export async function deleteAccount(
  client: SupabaseClient,
): Promise<TradeOperation<'deleted' | 'reserved'>> {
  const result = await rpc<'deleted' | 'reserved' | null>(
    client,
    TRADE_RPC.deleteAccount,
    {},
    (data) => (data === 'deleted' || data === 'reserved' ? data : null),
  );
  if (result.error) return { data: null, error: result.error, reason: result.reason };
  await client.auth.signOut({ scope: 'local' }).catch(() => undefined);
  clearCachedAccount();
  return { data: result.data, error: null, reason: null };
}

// ---------------------------------------------------------------------------- characters

/**
 * A game character of the signed-in account (owner rule 2026-09-24): a player name and a world,
 * unique among all accounts. The main one is the header's and the profile's «Nombre del jugador» and
 * «Mundo»; each listing is published as one of them.
 */
export interface AccountCharacter {
  id: string;
  /** «Nombre del jugador», as the game shows it. */
  playerName: string;
  /** World id of content/mundos.json. */
  worldKey: string;
  isMain: boolean;
  /** Listings published as it, in any state: with one or more it cannot be removed or renamed. */
  listings: number;
  createdAt: string;
}

/**
 * The fixed reasons of the character functions, besides `authentication_required`,
 * `profile_required`, `account_deleted` and `suspended` (42501): `player_name_invalid` and
 * `world_invalid` (22023), `player_name_taken` (23505, in that world by any account),
 * `character_limit` (42501, more than `PERSONAJES_MAX`), `character_not_found` (42501),
 * `character_has_listings` and `character_is_main` (22023).
 */
export const CHARACTER_REFUSALS = [
  'player_name_invalid',
  'world_invalid',
  'player_name_taken',
  'character_limit',
  'character_not_found',
  'character_has_listings',
  'character_is_main',
] as const;
export type CharacterRefusal = (typeof CHARACTER_REFUSALS)[number];

const WORLD_KEY = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** The rows of `account_characters_list` (and of each character write), main first. */
export function toAccountCharacters(data: unknown): AccountCharacter[] {
  const list: AccountCharacter[] = [];
  for (const row of rows(data)) {
    const playerName = text(row.player_name);
    const worldKey = text(row.world_key);
    const createdAt = text(row.created_at);
    if (!isUuid(row.id) || playerName === null || worldKey === null || createdAt === null) continue;
    list.push({
      id: row.id,
      playerName,
      worldKey,
      isMain: row.is_main === true,
      listings: count(row.listings),
      createdAt,
    });
  }
  return list;
}

/** «Mis personajes»: the account's characters, the main one first. */
export async function listMyCharacters(
  client: SupabaseClient,
): Promise<TradeOperation<AccountCharacter[]>> {
  return rpc<AccountCharacter[]>(client, TRADE_RPC.listCharacters, {}, toAccountCharacters);
}

/**
 * «Añadir personaje»: a player name (spaces collapsed, 1 to 32 characters) and a world id of
 * content/mundos.json. The first character becomes the main one. Resolves to the new list.
 */
export async function addCharacter(
  client: SupabaseClient,
  character: { playerName: string; worldKey: string },
): Promise<TradeOperation<AccountCharacter[]>> {
  const playerName = character.playerName.trim().replace(/\s+/g, ' ');
  if (
    playerName === '' ||
    characters(playerName) > NOMBRE_JUGADOR_MAX ||
    !WORLD_KEY.test(character.worldKey)
  ) {
    return invalidInput();
  }
  return rpc<AccountCharacter[]>(
    client,
    TRADE_RPC.addCharacter,
    { p_player_name: playerName, p_world_key: character.worldKey },
    toAccountCharacters,
  );
}

/** «Principal»: the header chip and the profile show it from now on. Resolves to the new list. */
export async function setMainCharacter(
  client: SupabaseClient,
  characterId: string,
): Promise<TradeOperation<AccountCharacter[]>> {
  if (!isUuid(characterId)) return invalidInput();
  return rpc<AccountCharacter[]>(
    client,
    TRADE_RPC.setMainCharacter,
    { p_id: characterId },
    toAccountCharacters,
  );
}

/**
 * «Quitar personaje»: refused for the main one (`character_is_main`) and for one with any listing
 * (`character_has_listings`). There is no rename: the account adds another character. Resolves to
 * the new list.
 */
export async function removeCharacter(
  client: SupabaseClient,
  characterId: string,
): Promise<TradeOperation<AccountCharacter[]>> {
  if (!isUuid(characterId)) return invalidInput();
  return rpc<AccountCharacter[]>(
    client,
    TRADE_RPC.removeCharacter,
    { p_id: characterId },
    toAccountCharacters,
  );
}

/** Whether the account may add another character (`PERSONAJES_MAX`); the database decides. */
export function canAddCharacter(list: readonly Pick<AccountCharacter, 'id'>[]): boolean {
  return list.length < PERSONAJES_MAX;
}

/** Whether «Quitar» is offered for a character: not the main one, and no listing published as it. */
export function canRemoveCharacter(
  character: Pick<AccountCharacter, 'isMain' | 'listings'>,
): boolean {
  return !character.isMain && character.listings === 0;
}

// ------------------------------------------------------------------------------ consent

/**
 * «Entiendo y acepto» (9.15.2): stores the current version with its date (`trade_consents`), for a
 * complete adult account. Resolves to the moment it was accepted.
 */
export async function acceptRealMoneyConsent(
  client: SupabaseClient,
): Promise<TradeOperation<string | null>> {
  return rpc<string | null>(
    client,
    TRADE_RPC.acceptConsent,
    { p_version: CONSENTIMIENTO_DINERO_REAL_VERSION },
    (data) => text(data),
  );
}

// ----------------------------------------------------------------------------- presence

/**
 * The state the account chooses (9.15.6, 9.16.2): «En el juego», «Ausente», «Desconectado».
 * Resolves to the state the others see now. `desconectado` works for any signed-in account, so
 * signing out never fails on it.
 */
export async function setPresenceState(
  client: SupabaseClient,
  estado: EstadoPresencia,
): Promise<TradeOperation<EstadoPresencia>> {
  if (!isEstadoPresencia(estado)) return invalidInput();
  return rpc<EstadoPresencia>(client, TRADE_RPC.setPresence, { p_estado: estado }, (data) =>
    isEstadoPresencia(data) ? data : estado,
  );
}

/** Accounts per call of `trade_effective_presence`, which takes at most 100. */
const PRESENCE_BATCH = 100;

/**
 * What the others see of these accounts (`trade_effective_presence`, 9.15.6), readable by anyone.
 * An account missing from the answer is `desconectado`.
 */
export async function getEffectivePresence(
  client: SupabaseClient,
  userIds: readonly string[],
): Promise<TradeOperation<Map<string, EstadoPresencia>>> {
  const ids = [...new Set(userIds)].filter(isUuid);
  const states = new Map<string, EstadoPresencia>();
  for (let start = 0; start < ids.length; start += PRESENCE_BATCH) {
    const batch = await rpc<true>(
      client,
      TRADE_RPC.effectivePresence,
      { p_user_ids: ids.slice(start, start + PRESENCE_BATCH) },
      (data) => {
        for (const row of rows(data)) {
          if (isUuid(row.user_id) && isEstadoPresencia(row.estado)) {
            states.set(row.user_id, row.estado);
          }
        }
        return true;
      },
    );
    if (batch.error) return { data: null, error: batch.error, reason: batch.reason };
  }
  return { data: states, error: null, reason: null };
}

// ---------------------------------------------------------------------------- reputation

/**
 * A reputation row (9.15.4) as `SellerReputation`: `media` (the mean of the per-counterpart means,
 * one decimal), `contrapartes`, `operaciones` (confirmed deals) and the 1 to 5 distribution; the
 * index 0 of the distribution stays 0. The older names of 9.12.3 are read too.
 */
function toReputation(row: Row | null): SellerReputation | null {
  if (row === null) return null;
  const distribucion: SellerReputation['distribucion'] = [
    0,
    count(row.d1),
    count(row.d2),
    count(row.d3),
    count(row.d4),
    count(row.d5),
  ];
  const total = distribucion.reduce((sum, value) => sum + value, 0);
  const resenas = numberOf(row.resenas ?? row.reviews);
  const media = numberOf(row.media ?? row.average);
  return {
    valoracion: media,
    resenas: resenas === null ? total : Math.trunc(resenas),
    distribucion,
    operaciones: count(row.operaciones ?? row.confirmed_transactions),
    contrapartes: count(row.contrapartes ?? row.counterparts),
  };
}

/** The reputation of an account as seller; null when it has none to show (suspended). */
export async function getSellerReputation(
  client: SupabaseClient,
  userId: string,
): Promise<TradeOperation<SellerReputation | null>> {
  if (!isUuid(userId)) return invalidInput();
  return rpc<SellerReputation | null>(
    client,
    TRADE_RPC.sellerStats,
    { p_seller_id: userId },
    (data) => toReputation(firstRow<Row>(data)),
  );
}

/** The reputation of an account as buyer (the pair of `trade_seller_stats`, 9.15.4). */
export async function getBuyerReputation(
  client: SupabaseClient,
  userId: string,
): Promise<TradeOperation<SellerReputation | null>> {
  if (!isUuid(userId)) return invalidInput();
  return rpc<SellerReputation | null>(
    client,
    TRADE_RPC.buyerStats,
    { p_buyer_id: userId },
    (data) => toReputation(firstRow<Row>(data)),
  );
}

// ------------------------------------------------------------------------------ listings

/** What a transaction or a review needs of its listing to write its title (9.4) and link it. */
export interface TradeListingRef {
  id: string;
  tipo: TipoActivo;
  /** Registry id of the Pokémon of a Pokémon listing. */
  pokemon: string | null;
  /** The traded item: its registry id when it matched one, and the declared name. */
  item: { item: string | null; nombre: string } | null;
  /** Whole units of a Diamonds or Pokédólares listing. */
  cantidad: number | null;
  /** False when the listing has no public detail any more (withdrawn, 9.4). */
  detail: boolean;
}

function assetRecord(asset: unknown): Row {
  return typeof asset === 'object' && asset !== null ? (asset as Row) : {};
}

/** The reference of a listing from its id, type and `asset`; null for an unknown type. */
export function toListingRef(
  id: unknown,
  tipo: unknown,
  asset: unknown,
  detail: boolean,
): TradeListingRef | null {
  const kind = oneOf(TIPOS_ACTIVO, tipo);
  if (kind === null || typeof id !== 'string') return null;
  const record = assetRecord(asset);
  const nombre = text(record.nombre);
  return {
    id,
    tipo: kind,
    pokemon: kind === 'pokemon' ? text(record.pokemon) : null,
    item: kind === 'items' && nombre !== null ? { item: text(record.item), nombre } : null,
    cantidad: kind === 'diamonds' || kind === 'pokedolares' ? numberOf(record.cantidad) : null,
    detail,
  };
}

/**
 * The listing fields a seller writes (9.7): the type fixes which asset field is present.
 * `characterId` is the seller's character the listing is published as (`account_characters.id`);
 * without it the database takes the seller's character in `mundo` (the main one first), which is
 * how the composer before characters keeps working.
 */
export type TradeListingInput = Pick<Anuncio, 'tipo' | 'mundo' | 'precio'> &
  Partial<Pick<Anuncio, 'pokemon' | 'item' | 'cantidad'>> & { characterId?: string | null };

/**
 * The `jsonb` of `trade_publish_listing` and `trade_update_listing`, in the columns of 9.12.1 and
 * `character_id`. The database derives the world from the character and refuses a `world_key` that
 * is not its world (`world_mismatch`).
 */
export function listingPayload(input: TradeListingInput): Row {
  const asset =
    input.tipo === 'pokemon'
      ? (input.pokemon ?? null)
      : input.tipo === 'items'
        ? (input.item ?? null)
        : { cantidad: input.cantidad ?? null };
  // A price per unit sends the unit and the unit amounts; the database computes the totals
  // (20260924200000_listing_unit_price.sql).
  const unit = input.tipo === 'pokemon' ? null : (input.precio.porUnidad ?? null);
  const price = unit ?? input.precio;
  return {
    ...(isUuid(input.characterId) ? { character_id: input.characterId } : {}),
    asset_type: input.tipo,
    world_key: input.mundo,
    asset,
    fiat_currency: price.real?.moneda ?? null,
    fiat_amount: price.real?.importe ?? null,
    game_prices: price.juego,
    negotiable: input.precio.aConvenir,
    ...(unit === null ? {} : { unit_quantity: unit.cantidad }),
  };
}

/** A `numeric(12,2)` amount as the registry writes it: «90», «35.50». */
function formatImporte(value: unknown): string | null {
  const amount = numberOf(value);
  if (amount === null || amount <= 0) return null;
  const fixed = amount.toFixed(2);
  return fixed.endsWith('.00') ? fixed.slice(0, -3) : fixed;
}

function gameOptionsOf(value: unknown): OpcionJuego[] {
  const juego: OpcionJuego[] = [];
  for (const option of rows(value)) {
    const tipo = oneOf<MonedaJuego>(MONEDAS_JUEGO, option.tipo);
    const cantidad = numberOf(option.cantidad);
    if (tipo !== null && cantidad !== null && Number.isInteger(cantidad) && cantidad >= 1) {
      juego.push({ tipo, cantidad });
    }
  }
  return juego;
}

function toPrecio(row: Row): Precio {
  const moneda = oneOf<MonedaReal>(MONEDAS_REALES, row.fiat_currency);
  const importe = formatImporte(row.fiat_amount);
  const precio: Precio = {
    real: moneda !== null && importe !== null ? { moneda, importe } : null,
    juego: gameOptionsOf(row.game_prices),
    aConvenir: row.negotiable === true,
  };
  // The price per unit the seller wrote (20260924200000_listing_unit_price.sql).
  const unit = numberOf(row.unit_quantity);
  if (unit !== null && Number.isSafeInteger(unit) && unit >= 1) {
    const unitImporte = formatImporte(row.unit_fiat_amount);
    precio.porUnidad = {
      cantidad: unit,
      real: moneda !== null && unitImporte !== null ? { moneda, importe: unitImporte } : null,
      juego: gameOptionsOf(row.unit_game_prices),
    };
  }
  return precio;
}

/**
 * The `character` of a listing row (the computed field `trade_listing_character`, selected as
 * `character`): null when absent (a database without the characters migration) or malformed.
 */
export function toListingCharacter(value: unknown): ListingCharacter | null {
  const character = record(value);
  const playerName = text(character.player_name);
  const worldKey = text(character.world_key);
  if (!isUuid(character.id) || playerName === null || worldKey === null) return null;
  return { id: character.id, playerName, worldKey };
}

/**
 * The Pokémon of a listing row as the site reads it: the database keeps only the keys the seller
 * declared (`trade_asset_problem`), so an absent list is empty and an absent value `null` (G7).
 */
function toUnidad(asset: Row): UnidadPokemon {
  const list = (value: unknown) => (Array.isArray(value) ? value : []);
  const nullable = <T>(value: unknown) => (value === undefined ? null : (value as T));
  return {
    pokemon: text(asset.pokemon) ?? '',
    ball: nullable<string | null>(asset.ball),
    auras: list(asset.auras) as string[],
    addons: list(asset.addons) as string[],
    heldX: nullable<string | null>(asset.heldX),
    heldY: nullable<string | null>(asset.heldY),
    mega: nullable<string | null>(asset.mega),
    boost: nullable<number | null>(asset.boost),
    starLevel: nullable<number | null>(asset.starLevel),
    nickname: nullable<string | null>(asset.nickname),
    memorySlots: nullable<number | null>(asset.memorySlots),
    memorias: list(asset.memorias) as (string | null)[],
    nextBoostChance: nullable<string | null>(asset.nextBoostChance),
    entrenamiento: list(asset.entrenamiento) as UnidadPokemon['entrenamiento'],
    precioNpc: nullable<UnidadPokemon['precioNpc']>(asset.precioNpc),
  };
}

/**
 * A row of `trade_listings` as the listing of 9.4, `handle` being its seller's; null for a row
 * whose type or state the site does not know. The asset was validated by the database
 * (`trade_validate_asset`).
 */
export function toAnuncio(row: Row, handle: string): Anuncio | null {
  const tipo = oneOf(TIPOS_ACTIVO, row.asset_type);
  const estado = oneOf<EstadoAnuncio>(ESTADOS_ANUNCIO, row.status);
  const id = text(row.listing_id);
  const mundo = text(row.world_key);
  const publicado = text(row.published_at) ?? text(row.created_at);
  if (tipo === null || estado === null || id === null || mundo === null || publicado === null) {
    return null;
  }
  const anuncio: Anuncio = {
    id,
    tipo,
    vendedor: handle,
    mundo,
    publicado,
    expira: text(row.expires_at) ?? publicado,
    estado,
    precio: toPrecio(row),
  };
  const character = toListingCharacter(row.character);
  if (character !== null) anuncio.character = character;
  const asset = assetRecord(row.asset);
  if (tipo === 'pokemon') anuncio.pokemon = toUnidad(asset);
  else if (tipo === 'items') anuncio.item = asset as unknown as ItemDeclarado;
  else anuncio.cantidad = numberOf(asset.cantidad) ?? undefined;
  return anuncio;
}

/** The columns of a listing row, without its character (the database before characters). */
export const LISTING_BASE_COLUMNS =
  'listing_id,asset_type,world_key,status,asset,fiat_currency,fiat_amount,game_prices,negotiable,created_at,published_at,expires_at';

/**
 * The columns of a listing row with its character: `character_id` and the computed field
 * `trade_listing_character` as `character` (supabase/migrations/20260924190000_account_characters.sql).
 */
export const LISTING_CHARACTER_COLUMNS = 'character_id,character:trade_listing_character';

/** The price per unit of a listing (supabase/migrations/20260924200000_listing_unit_price.sql). */
export const LISTING_UNIT_COLUMNS = 'unit_quantity,unit_fiat_amount,unit_game_prices';

/**
 * The column sets a listing read tries, newest schema first: with the unit price and the
 * character, with the character only, then the base columns (see `isMissingColumn`).
 */
export const LISTING_COLUMN_SETS: readonly string[] = [
  `${LISTING_BASE_COLUMNS},${LISTING_UNIT_COLUMNS},${LISTING_CHARACTER_COLUMNS}`,
  `${LISTING_BASE_COLUMNS},${LISTING_CHARACTER_COLUMNS}`,
  LISTING_BASE_COLUMNS,
];

/**
 * PostgREST's answer to a column the database does not have: the characters migration is not
 * applied yet. The readers then select the base columns once more, so a deploy that reaches a
 * database without the migration keeps showing listings (without characters). Remove this with the
 * fallback once the migration is applied everywhere.
 */
export function isMissingColumn(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: unknown }).code === '42703'
  );
}

/**
 * «Mis anuncios» (9.16.3): every listing of the account in every state, newest first. `handle` is
 * the account's username, the seller of each one.
 */
export async function listMyListings(
  client: SupabaseClient,
  owner: { userId: string; handle: string },
): Promise<TradeOperation<Anuncio[]>> {
  if (!isUuid(owner.userId)) return invalidInput();
  const select = (columns: string) =>
    client
      .from(TRADE_LISTINGS_TABLE)
      .select(columns)
      .eq('seller_id', owner.userId)
      .order('created_at', { ascending: false });
  let data: unknown = null;
  let error: unknown = null;
  let status: number | undefined;
  for (const columns of LISTING_COLUMN_SETS) {
    ({ data, error, status } = await select(columns));
    if (!error || !isMissingColumn(error)) break;
  }
  if (error) return failed(error, status);
  const listings: Anuncio[] = [];
  for (const row of rows(data)) {
    const anuncio = toAnuncio(row, owner.handle);
    if (anuncio !== null) listings.push(anuncio);
  }
  return { data: listings, error: null, reason: null };
}

/**
 * One listing of the signed-in account, for «Editar» (owner rule 2026-09-24: the seller edits a
 * listing at any time, its quantity included). Null when it is not the account's or does not exist.
 */
export async function getMyListing(
  client: SupabaseClient,
  listingId: string,
): Promise<TradeOperation<Anuncio | null>> {
  if (!isUuid(listingId)) return invalidInput();
  const { data: session } = await client.auth.getUser();
  const userId = session.user?.id;
  if (!isUuid(userId)) return { data: null, error: null, reason: null };
  let data: unknown = null;
  let error: unknown = null;
  let status: number | undefined;
  for (const columns of LISTING_COLUMN_SETS) {
    ({ data, error, status } = await client
      .from(TRADE_LISTINGS_TABLE)
      .select(columns)
      .eq('listing_id', listingId)
      .eq('seller_id', userId)
      .limit(1));
    if (!error || !isMissingColumn(error)) break;
  }
  if (error) return failed(error, status);
  const [row] = rows(data);
  return { data: row === undefined ? null : toAnuncio(row, ''), error: null, reason: null };
}

/** «Publicar» (9.7.8): the id of the new listing. Evidence of 9.15.3. */
export async function publishListing(
  client: SupabaseClient,
  input: TradeListingInput,
): Promise<TradeOperation<string | null>> {
  return rpc<string | null>(
    client,
    TRADE_RPC.publishListing,
    { p_listing: listingPayload(input), ...evidence() },
    (data) => (isUuid(data) ? data : null),
  );
}

/** «Editar» (9.7.8): the type and the publication date do not change. */
export async function updateListing(
  client: SupabaseClient,
  listingId: string,
  input: TradeListingInput,
): Promise<TradeOperation<true>> {
  if (!isUuid(listingId)) return invalidInput();
  return rpc<true>(
    client,
    TRADE_RPC.updateListing,
    { p_listing_id: listingId, p_listing: listingPayload(input) },
    () => true,
  );
}

/**
 * The states a seller sets (9.7.8): `publicado` ↔ `reservado`, either → `completado` or `retirado`,
 * and `expirado` → `publicado` («Renovar», a new validity).
 */
export async function setListingStatus(
  client: SupabaseClient,
  listingId: string,
  status: Exclude<EstadoAnuncio, 'expirado'>,
): Promise<TradeOperation<true>> {
  if (!isUuid(listingId) || oneOf(ESTADOS_ANUNCIO, status) === null) return invalidInput();
  return rpc<true>(
    client,
    TRADE_RPC.setListingStatus,
    { p_listing_id: listingId, p_status: status },
    () => true,
  );
}

// -------------------------------------------------------------------------- transactions

/** The states of a deal (9.10). */
export const TRADE_TRANSACTION_STATUSES = [
  'contacto',
  'confirmada_vendedor',
  'confirmada_comprador',
  'confirmada',
  'cancelada',
  'disputada',
  'caducada',
] as const;
export type TradeTransactionStatus = (typeof TRADE_TRANSACTION_STATUSES)[number];

export type TradeRole = 'buyer' | 'seller';

/** A deal of the account (`trade_my_transactions`), as «Mis operaciones» reads it. */
export interface TradeTransaction {
  id: string;
  /** The sequence number of 9.15.4 (`OP-000123`). */
  number: number;
  /** The account's role in the deal. */
  role: TradeRole;
  status: TradeTransactionStatus;
  listing: TradeListingRef;
  /** Handle of the other party; null when that account no longer exists. */
  counterpart: string | null;
  createdAt: string;
  /** The last change of state, for the expiry of 9.10. */
  changedAt: string;
  /** When the second confirmation arrived; null before `confirmada`. */
  confirmedAt: string | null;
  /** The account's own review of this deal. */
  review: { id: string; score: number; comment: string | null; createdAt: string } | null;
  /** False when the pair already had `RESENAS_PAR_DIA` reviewable deals in 24 h (9.15.4). */
  reviewable: boolean;
}

function toTransaction(row: Row): TradeTransaction | null {
  const status = oneOf(TRADE_TRANSACTION_STATUSES, row.status);
  const role = oneOf<TradeRole>(['buyer', 'seller'], row.role);
  const number = numberOf(row.number);
  const createdAt = text(row.created_at);
  const listing = toListingRef(
    row.listing_id,
    row.asset_type,
    row.asset,
    row.listing_public === true,
  );
  if (
    !isUuid(row.transaction_id) ||
    status === null ||
    role === null ||
    number === null ||
    createdAt === null ||
    listing === null
  ) {
    return null;
  }
  const reviewScore = numberOf(row.review_score);
  const reviewCreatedAt = text(row.review_created_at);
  return {
    id: row.transaction_id,
    number,
    role,
    status,
    listing,
    counterpart: text(row.counterpart_handle),
    createdAt,
    changedAt: text(row.updated_at) ?? createdAt,
    confirmedAt: text(row.confirmed_at),
    review:
      isUuid(row.review_id) && reviewScore !== null && reviewCreatedAt !== null
        ? {
            id: row.review_id,
            score: reviewScore,
            comment: text(row.review_comment),
            createdAt: reviewCreatedAt,
          }
        : null,
    reviewable: row.reviewable === true,
  };
}

/** The account's deals as buyer and as seller, newest first. */
export async function listMyTransactions(
  client: SupabaseClient,
): Promise<TradeOperation<TradeTransaction[]>> {
  return rpc<TradeTransaction[]>(client, TRADE_RPC.myTransactions, {}, (data) =>
    rows(data)
      .map(toTransaction)
      .filter((row): row is TradeTransaction => row !== null),
  );
}

/** The counts of the «Operaciones» tab of «Mi perfil» (9.16.3). */
export function summarizeTransactions(transactions: readonly Pick<TradeTransaction, 'status'>[]): {
  pending: number;
  confirmed: number;
} {
  let pending = 0;
  let confirmed = 0;
  for (const { status } of transactions) {
    if (status === 'confirmada') confirmed += 1;
    else if (
      status === 'contacto' ||
      status === 'confirmada_vendedor' ||
      status === 'confirmada_comprador' ||
      status === 'disputada'
    ) {
      pending += 1;
    }
  }
  return { pending, confirmed };
}

/** «Contactar al vendedor» (9.10): the id of the new deal. Evidence of 9.15.3. */
export async function startTransaction(
  client: SupabaseClient,
  listingId: string,
): Promise<TradeOperation<string | null>> {
  if (!isUuid(listingId)) return invalidInput();
  return rpc<string | null>(
    client,
    TRADE_RPC.startTransaction,
    { p_listing_id: listingId, ...evidence() },
    (data) => (isUuid(data) ? data : null),
  );
}

/** «Operación completada». Evidence of 9.15.3. */
export async function confirmTransaction(
  client: SupabaseClient,
  transactionId: string,
): Promise<TradeOperation<true>> {
  if (!isUuid(transactionId)) return invalidInput();
  return rpc<true>(
    client,
    TRADE_RPC.confirmTransaction,
    { p_transaction_id: transactionId, ...evidence() },
    () => true,
  );
}

/** «Cancelar» before `confirmada`. Evidence of 9.15.3. */
export async function cancelTransaction(
  client: SupabaseClient,
  transactionId: string,
): Promise<TradeOperation<true>> {
  if (!isUuid(transactionId)) return invalidInput();
  return rpc<true>(
    client,
    TRADE_RPC.cancelTransaction,
    { p_transaction_id: transactionId, ...evidence() },
    () => true,
  );
}

/** «No se completó»: the deal goes to moderation, with an optional detail. Evidence of 9.15.3. */
export async function disputeTransaction(
  client: SupabaseClient,
  transactionId: string,
  detail: string | null,
): Promise<TradeOperation<true>> {
  const clean = optionalText(detail, REPORTE_DETALLE_MAX);
  if (!isUuid(transactionId) || clean === undefined) return invalidInput();
  return rpc<true>(
    client,
    TRADE_RPC.disputeTransaction,
    { p_transaction_id: transactionId, p_detail: clean, ...evidence() },
    () => true,
  );
}

// ----------------------------------------------------------------------------- channels

/** Contact channel kinds (9.9, 9.15.1): Google counts as one too. */
export const TRADE_CHANNEL_KINDS = [
  'email',
  'phone',
  'discord',
  'google',
  'twitch',
  'other',
] as const;
export type TradeChannelKind = (typeof TRADE_CHANNEL_KINDS)[number];

/** A value the other party of a deal sees (`trade_transaction_contacts`): text, never a link. */
export interface TradeContact {
  kind: TradeChannelKind;
  /** The part of the label the dictionary cannot write: «+55» of a phone, the other platform's name. */
  label: string | null;
  value: string;
}

function channelLabel(row: Row, kind: TradeChannelKind): string | null {
  return text(row.public_label) ?? (kind === 'other' ? text(row.platform) : null);
}

/** The values of the other party's visible channels, for the two parties of a deal alone (9.10). */
export async function transactionContacts(
  client: SupabaseClient,
  transactionId: string,
): Promise<TradeOperation<TradeContact[]>> {
  if (!isUuid(transactionId)) return invalidInput();
  return rpc<TradeContact[]>(
    client,
    TRADE_RPC.transactionContacts,
    { p_transaction_id: transactionId },
    (data) => {
      const contacts: TradeContact[] = [];
      for (const row of rows(data)) {
        const kind = oneOf(TRADE_CHANNEL_KINDS, row.kind) ?? 'other';
        const value = text(row.value);
        if (value !== null) contacts.push({ kind, label: channelLabel(row, kind), value });
      }
      return contacts;
    },
  );
}

/** A channel of the account (`trade_my_channels`), with its value: only its owner reads it. */
export interface TradeChannel {
  id: string;
  kind: TradeChannelKind;
  /** The platform of an `other` channel. */
  platform: string | null;
  value: string;
  label: string | null;
  /** «Mostrar en mis anuncios». */
  shared: boolean;
  /** «Verificado» or «Pendiente»; the verification date is never shown. */
  verified: boolean;
}

export async function listMyChannels(
  client: SupabaseClient,
): Promise<TradeOperation<TradeChannel[]>> {
  return rpc<TradeChannel[]>(client, TRADE_RPC.myChannels, {}, (data) => {
    const channels: TradeChannel[] = [];
    for (const row of rows(data)) {
      const kind = oneOf(TRADE_CHANNEL_KINDS, row.kind);
      const value = text(row.value);
      if (!isUuid(row.channel_id) || kind === null || value === null) continue;
      channels.push({
        id: row.channel_id,
        kind,
        platform: text(row.platform),
        value,
        label: channelLabel(row, kind),
        shared: row.shared === true,
        verified: row.verified === true || text(row.verified_at) !== null,
      });
    }
    return channels;
  });
}

/**
 * Adds a channel or changes whether it shows on the listings (9.9). An `other` channel needs its
 * platform (at most 32 characters) and stays «Pendiente» until a moderator checks its code.
 */
export async function upsertChannel(
  client: SupabaseClient,
  channel: { kind: TradeChannelKind; platform: string | null; value: string; shared: boolean },
): Promise<TradeOperation<string | null>> {
  const platform = optionalText(channel.platform, PLATAFORMA_MAX);
  const value = channel.value.trim();
  if (
    oneOf(TRADE_CHANNEL_KINDS, channel.kind) === null ||
    platform === undefined ||
    (channel.kind === 'other') !== (platform !== null) ||
    value === ''
  ) {
    return invalidInput();
  }
  return rpc<string | null>(
    client,
    TRADE_RPC.upsertChannel,
    { p_kind: channel.kind, p_platform: platform, p_value: value, p_shared: channel.shared },
    (data) => (isUuid(data) ? data : null),
  );
}

/** «Desvincular» of a channel of another platform. */
export async function deleteChannel(
  client: SupabaseClient,
  channelId: string,
): Promise<TradeOperation<true>> {
  if (!isUuid(channelId)) return invalidInput();
  return rpc<true>(client, TRADE_RPC.deleteChannel, { p_channel_id: channelId }, () => true);
}

/** After a return from Discord, Google or Twitch: the verified channels of the linked identities. */
export async function syncOauthChannels(client: SupabaseClient): Promise<TradeOperation<true>> {
  return rpc<true>(client, TRADE_RPC.syncOauthChannels, {}, () => true);
}

/** The code to put on the public profile of another platform (9.9, D-B5). */
export async function requestChannelCode(
  client: SupabaseClient,
  channelId: string,
): Promise<TradeOperation<string | null>> {
  if (!isUuid(channelId)) return invalidInput();
  return rpc<string | null>(
    client,
    TRADE_RPC.requestChannelCode,
    { p_channel_id: channelId },
    (data) => text(data),
  );
}

// ------------------------------------------------------------------------------ reviews

function validScore(score: number): boolean {
  return Number.isInteger(score) && score >= PUNTUACION_MIN && score <= PUNTUACION_MAX;
}

/**
 * A review of a confirmed deal, in either direction (9.15.4): 1 to 5 stars and an optional
 * comment. The id of the review. Evidence of 9.15.3.
 */
export async function submitReview(
  client: SupabaseClient,
  transactionId: string,
  score: number,
  comment: string | null,
): Promise<TradeOperation<string | null>> {
  const clean = optionalText(comment, RESENA_COMENTARIO_MAX);
  if (!isUuid(transactionId) || !validScore(score) || clean === undefined) return invalidInput();
  return rpc<string | null>(
    client,
    TRADE_RPC.submitReview,
    { p_transaction_id: transactionId, p_score: score, p_comment: clean, ...evidence() },
    (data) => (isUuid(data) ? data : null),
  );
}

/** «Editar reseña» while its window is open; the previous version is kept (9.10). */
export async function updateReview(
  client: SupabaseClient,
  reviewId: string,
  score: number,
  comment: string | null,
): Promise<TradeOperation<true>> {
  const clean = optionalText(comment, RESENA_COMENTARIO_MAX);
  if (!isUuid(reviewId) || !validScore(score) || clean === undefined) return invalidInput();
  return rpc<true>(
    client,
    TRADE_RPC.updateReview,
    { p_review_id: reviewId, p_score: score, p_comment: clean },
    () => true,
  );
}

/** A visible review on a public profile (`trade_public_reviews`): never who wrote it by id. */
export interface PublicReview {
  score: number;
  comment: string | null;
  createdAt: string;
  updatedAt: string | null;
  /** The author's handle; null when the account no longer exists or has no profile. */
  reviewerHandle: string | null;
  /** The listing of the deal, without a link (its id is not public). */
  listing: Omit<TradeListingRef, 'id' | 'detail'> | null;
}

/** Reviews per page of a profile (9.16.3: «10 por página»). */
export const REVIEWS_PAGE_SIZE = 10;

/** The visible reviews of a seller, newest first. */
export async function listPublicReviews(
  client: SupabaseClient,
  sellerId: string,
  page = 0,
): Promise<TradeOperation<PublicReview[]>> {
  if (!isUuid(sellerId) || !Number.isInteger(page) || page < 0) return invalidInput();
  return rpc<PublicReview[]>(
    client,
    TRADE_RPC.publicReviews,
    { p_seller_id: sellerId, p_limit: REVIEWS_PAGE_SIZE, p_offset: page * REVIEWS_PAGE_SIZE },
    (data) => {
      const reviews: PublicReview[] = [];
      for (const row of rows(data)) {
        const score = numberOf(row.score);
        const createdAt = text(row.created_at);
        if (score === null || createdAt === null) continue;
        const ref = toListingRef('', row.asset_type, row.asset, false);
        reviews.push({
          score,
          comment: text(row.comment),
          createdAt,
          updatedAt: text(row.updated_at),
          reviewerHandle: text(row.reviewer_handle),
          listing:
            ref === null
              ? null
              : { tipo: ref.tipo, pokemon: ref.pokemon, item: ref.item, cantidad: ref.cantidad },
        });
      }
      return reviews;
    },
  );
}

/** «Reseñas recibidas» or «Reseñas hechas» of «Mi perfil» (9.16.3). */
export type ReviewDirection = 'received' | 'given';

export interface MyReview {
  id: string;
  transactionId: string;
  /** The deal number of 9.15.4. */
  number: number;
  /** The account's role in that deal: «como vendedor» / «como comprador». */
  role: TradeRole;
  score: number;
  comment: string | null;
  createdAt: string;
  updatedAt: string | null;
  /** The other party's handle; null when that account no longer exists. */
  counterpart: string | null;
  /** A review the account wrote whose edit window is still open. */
  editable: boolean;
  /** Hidden by moderation: it does not count for the reputation. */
  hidden: boolean;
}

/** One page of the account's reviews, newest first, and whether another page follows. */
export async function listMyReviews(
  client: SupabaseClient,
  direction: ReviewDirection,
  page = 0,
): Promise<TradeOperation<{ reviews: MyReview[]; more: boolean }>> {
  if ((direction !== 'received' && direction !== 'given') || !Number.isInteger(page) || page < 0) {
    return invalidInput();
  }
  return rpc<{ reviews: MyReview[]; more: boolean }>(
    client,
    TRADE_RPC.myReviews,
    // One row more than a page says whether there is a next one.
    { p_direction: direction, p_limit: REVIEWS_PAGE_SIZE + 1, p_offset: page * REVIEWS_PAGE_SIZE },
    (data) => {
      const reviews: MyReview[] = [];
      for (const row of rows(data)) {
        const role = oneOf<TradeRole>(['buyer', 'seller'], row.role);
        const number = numberOf(row.transaction_number);
        const score = numberOf(row.score);
        const createdAt = text(row.created_at);
        if (
          !isUuid(row.review_id) ||
          !isUuid(row.transaction_id) ||
          role === null ||
          number === null ||
          score === null ||
          createdAt === null
        ) {
          continue;
        }
        reviews.push({
          id: row.review_id,
          transactionId: row.transaction_id,
          number,
          role,
          score,
          comment: text(row.comment),
          createdAt,
          updatedAt: text(row.updated_at),
          counterpart: text(row.counterpart_handle),
          editable: direction === 'given' && row.editable === true,
          hidden: row.hidden === true,
        });
      }
      return {
        reviews: reviews.slice(0, REVIEWS_PAGE_SIZE),
        more: reviews.length > REVIEWS_PAGE_SIZE,
      };
    },
  );
}

// ------------------------------------------------------------------------------ reports

/** The five reasons of 9.11, the values `trade_report` takes. */
export const TRADE_REPORT_REASONS = [
  'estafa',
  'datos_personales',
  'ofensivo',
  'falso',
  'otro',
] as const;
export type TradeReportReason = (typeof TRADE_REPORT_REASONS)[number];

/** What can be reported (9.11). */
export const TRADE_REPORT_TARGETS = ['listing', 'seller', 'review'] as const;
export type TradeReportTarget = (typeof TRADE_REPORT_TARGETS)[number];

export interface TradeReportInput {
  targetType: TradeReportTarget;
  targetId: string;
  reason: TradeReportReason;
  /** Required with «Otro»; at most 1000 characters. */
  detail: string | null;
  /** The deal number of a scam report (9.15.5), or null. */
  operation: number | null;
}

/**
 * «Enviar reporte» (9.11): one per account and target, the second answers 23505. Evidence of
 * 9.15.3.
 */
export async function reportTradeTarget(
  client: SupabaseClient,
  report: TradeReportInput,
): Promise<TradeOperation<true>> {
  const detail = optionalText(report.detail, REPORTE_DETALLE_MAX);
  const operation = report.operation;
  if (
    oneOf(TRADE_REPORT_TARGETS, report.targetType) === null ||
    !isUuid(report.targetId) ||
    oneOf(TRADE_REPORT_REASONS, report.reason) === null ||
    detail === undefined ||
    (report.reason === 'otro' && detail === null) ||
    (operation !== null && (!Number.isInteger(operation) || operation < 1))
  ) {
    return invalidInput();
  }
  return rpc<true>(
    client,
    TRADE_RPC.report,
    {
      p_target_type: report.targetType,
      p_target_id: report.targetId,
      p_reason: report.reason,
      p_detail: detail,
      p_transaction_number: operation,
      ...evidence(),
    },
    () => true,
  );
}

// ---------------------------------------------------------------------------- moderation

/** The four automatic alerts of 9.15.5, in its order. */
export const TRADE_FLAG_KINDS = [
  'dispositivo_contrapartes',
  'dispositivo_cuentas',
  'resenas_cuentas_nuevas',
  'tope_resenas',
] as const;
export type TradeFlagKind = (typeof TRADE_FLAG_KINDS)[number];

/** The moderation actions of 9.11 and 9.15.5. */
export const TRADE_MODERATION_ACTIONS = [
  'dismiss',
  'withdraw_listing',
  'hide_review',
  'restore_review',
  'warn',
  'suspend',
  'lift_suspension',
  // A disputed deal (9.11): «Dar por confirmada» / «Dar por cancelada».
  'confirm_deal',
  'cancel_deal',
] as const;
export type TradeModerationAction = (typeof TRADE_MODERATION_ACTIONS)[number];

/** The site's action names that `trade_moderate` spells differently. */
const MODERATION_ACTION_SQL: Partial<Record<TradeModerationAction, string>> = {
  confirm_deal: 'resolve_confirm',
  cancel_deal: 'resolve_cancel',
};

/** What the queue acts on: a reported target, or the deal a dispute opened (9.10, 9.11). */
export const TRADE_MODERATION_TARGETS = [...TRADE_REPORT_TARGETS, 'transaction'] as const;
export type TradeModerationTarget = (typeof TRADE_MODERATION_TARGETS)[number];

/** An account named by a report or an alert. */
export interface ModerationAccountRow {
  id: string;
  /** Its handle; null when the account has no profile any more. */
  handle: string | null;
  /** The end of its Comercio suspension: null without one, `'infinity'` for a ban. */
  suspendedUntil: string | null;
}

export interface ModerationReportRow {
  id: string;
  createdAt: string;
  targetType: TradeModerationTarget;
  targetId: string;
  /** The seller of a listing or the reported seller; the author of a reported review. */
  owner: ModerationAccountRow | null;
  /** The seller whose profile shows a reported review. */
  reviewedHandle: string | null;
  /** A reported review is hidden. */
  hidden: boolean;
  /** A reported listing still has a public detail. */
  listingPublic: boolean;
  /** Null for a dispute, which the database files with the reason `disputa`. */
  reason: TradeReportReason | null;
  detail: string | null;
  /** The deal number of a scam report (9.15.5). */
  operation: number | null;
  /** Open reports on the same target. */
  openCount: number;
  status: 'open' | 'resolved' | 'dismissed';
}

export interface ModerationFlagRow {
  id: string;
  kind: TradeFlagKind;
  createdAt: string;
  /** The accounts it names; in `resenas_cuentas_nuevas` the first one received the reviews. */
  accounts: ModerationAccountRow[];
  /** The matching device of the two device kinds. */
  device: string | null;
  /** The deals behind it, by number. */
  operations: number[];
  /** The first and the last action it counts. */
  from: string | null;
  to: string | null;
  /** The reviews it counts or the days in a row. */
  count: number | null;
}

export interface PendingChannelRow {
  id: string;
  createdAt: string;
  handle: string | null;
  platform: string;
  /** The user on that platform. */
  value: string;
  /** The code the account had to put on its public profile. */
  code: string | null;
}

function toModerationAccount(value: unknown): ModerationAccountRow | null {
  if (typeof value !== 'object' || value === null) return null;
  const row = value as Row;
  if (!isUuid(row.id)) return null;
  return { id: row.id, handle: text(row.handle), suspendedUntil: text(row.suspended_until) };
}

/** Whether the account moderates Comercio (a row in `trade_moderators`, `account_is_moderator`). */
export async function isTradeModerator(client: SupabaseClient): Promise<TradeOperation<boolean>> {
  return rpc<boolean>(client, TRADE_RPC.isModerator, {}, (data) => data === true);
}

/** The reports, «Abiertos» (`open`) or «Resueltos» (`closed`), newest first (moderators). */
export async function listModerationReports(
  client: SupabaseClient,
  filter: 'open' | 'closed',
): Promise<TradeOperation<ModerationReportRow[]>> {
  if (filter !== 'open' && filter !== 'closed') return invalidInput();
  return rpc<ModerationReportRow[]>(
    client,
    TRADE_RPC.moderationReports,
    { p_status: filter },
    (data) => {
      const reports: ModerationReportRow[] = [];
      for (const row of rows(data)) {
        const targetType = oneOf(TRADE_MODERATION_TARGETS, row.target_type);
        const dispute = targetType === 'transaction' && row.reason === 'disputa';
        const reason = dispute ? null : oneOf(TRADE_REPORT_REASONS, row.reason);
        const status = oneOf(['open', 'resolved', 'dismissed'] as const, row.status);
        const createdAt = text(row.created_at);
        if (
          !isUuid(row.report_id) ||
          !isUuid(row.target_id) ||
          targetType === null ||
          (reason === null && !dispute) ||
          status === null ||
          createdAt === null
        ) {
          continue;
        }
        reports.push({
          id: row.report_id,
          createdAt,
          targetType,
          targetId: row.target_id,
          owner: toModerationAccount({
            id: row.owner_id,
            handle: row.owner_handle,
            suspended_until: row.owner_suspended_until,
          }),
          reviewedHandle: text(row.reviewed_handle),
          hidden: row.hidden === true,
          listingPublic: row.listing_public === true,
          reason,
          detail: text(row.detail),
          operation: numberOf(row.transaction_number),
          openCount: count(row.open_count),
          status,
        });
      }
      return reports;
    },
  );
}

/** The open automatic alerts (9.15.5), newest first (moderators). */
export async function listModerationFlags(
  client: SupabaseClient,
): Promise<TradeOperation<ModerationFlagRow[]>> {
  return rpc<ModerationFlagRow[]>(client, TRADE_RPC.moderationFlags, {}, (data) => {
    const flags: ModerationFlagRow[] = [];
    for (const row of rows(data)) {
      const kind = oneOf(TRADE_FLAG_KINDS, row.kind);
      const createdAt = text(row.created_at);
      if (!isUuid(row.flag_id) || kind === null || createdAt === null) continue;
      const accounts = (Array.isArray(row.accounts) ? row.accounts : [])
        .map(toModerationAccount)
        .filter((account): account is ModerationAccountRow => account !== null);
      const operations = (Array.isArray(row.transaction_numbers) ? row.transaction_numbers : [])
        .map(numberOf)
        .filter((value): value is number => value !== null);
      flags.push({
        id: row.flag_id,
        kind,
        createdAt,
        accounts,
        device: text(row.device_id),
        operations,
        from: text(row.first_at),
        to: text(row.last_at),
        count: numberOf(row.count),
      });
    }
    return flags;
  });
}

/** The channels of other platforms waiting for a moderator (9.9, D-B5). */
export async function listPendingChannels(
  client: SupabaseClient,
): Promise<TradeOperation<PendingChannelRow[]>> {
  return rpc<PendingChannelRow[]>(client, TRADE_RPC.pendingChannels, {}, (data) => {
    const channels: PendingChannelRow[] = [];
    for (const row of rows(data)) {
      const createdAt = text(row.created_at);
      const platform = text(row.platform);
      const value = text(row.value);
      if (!isUuid(row.channel_id) || createdAt === null || platform === null || value === null) {
        continue;
      }
      channels.push({
        id: row.channel_id,
        createdAt,
        handle: text(row.handle),
        platform,
        value,
        code: text(row.code),
      });
    }
    return channels;
  });
}

export interface TradeModerationInput {
  action: TradeModerationAction;
  /** An action on an account names it (`user`); the others act on a report's target or an alert. */
  targetType: TradeModerationTarget | 'user' | 'flag';
  targetId: string;
  /** Required, at most 1000 characters (9.11). */
  reason: string;
  /** The end of a suspension, an ISO instant; null for the indefinite one (the ban of 9.15.5). */
  until: string | null;
  /** The report or the alert the action answers. */
  reportId: string | null;
  flagId: string | null;
}

/** One moderation action, written to `trade_moderation_events` by the database (9.11). */
export async function moderateTrade(
  client: SupabaseClient,
  input: TradeModerationInput,
): Promise<TradeOperation<true>> {
  const reason = optionalText(input.reason, REPORTE_DETALLE_MAX);
  const targetTypes: readonly string[] = [...TRADE_MODERATION_TARGETS, 'user', 'flag'];
  if (
    oneOf(TRADE_MODERATION_ACTIONS, input.action) === null ||
    !targetTypes.includes(input.targetType) ||
    !isUuid(input.targetId) ||
    reason === undefined ||
    reason === null ||
    (input.until !== null && Number.isNaN(Date.parse(input.until))) ||
    (input.reportId !== null && !isUuid(input.reportId)) ||
    (input.flagId !== null && !isUuid(input.flagId))
  ) {
    return invalidInput();
  }
  return rpc<true>(
    client,
    TRADE_RPC.moderate,
    {
      p_action: MODERATION_ACTION_SQL[input.action] ?? input.action,
      p_target_type: input.targetType,
      p_target_id: input.targetId,
      p_reason: reason,
      p_until: input.until,
      p_report_id: input.reportId,
      p_flag_id: input.flagId,
    },
    () => true,
  );
}

/** «Aprobar» or «Rechazar» a channel of another platform (9.9). */
export async function verifyTradeChannel(
  client: SupabaseClient,
  channelId: string,
  approve: boolean,
): Promise<TradeOperation<true>> {
  if (!isUuid(channelId)) return invalidInput();
  return rpc<true>(
    client,
    TRADE_RPC.verifyChannel,
    { p_channel_id: channelId, p_approve: approve },
    () => true,
  );
}
