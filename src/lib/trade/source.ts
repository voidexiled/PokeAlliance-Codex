// Where the Comercio pages read their listings and sellers (spec 9.2, 9.3). Server only: the
// list, the detail and the profile import it in their frontmatter, never an island.
//
// Phase A (no COMERCIO_PUBLICO) is the sample registry of src/lib/trade/registry.ts, empty
// without COMERCIO_DEMO. Phase B renders those pages on demand and reads `trade_listings`, the
// shared contact channels, `trade_public_profiles`, `trade_public_reviews` and
// `trade_effective_presence` with the anon key, so RLS and the public functions decide what a
// visitor sees (9.12.2): a suspended or deleted account's listings, profile and reviews are not
// returned. With COMERCIO_DEMO too, the sample registry is added after the database rows, so a
// local run keeps the demo listings next to the real ones; a production build has no
// COMERCIO_DEMO (13.5).
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { getSupabasePublicConfig } from '@/lib/supabase/env';
import { toAnuncio } from '@/lib/supabase/trade';

import {
  comercioDemo,
  comercioPublico,
  getAnuncio,
  getAnuncios,
  getVendedor,
  getVendedores,
} from './registry';
import {
  ESTADOS_PRESENCIA,
  type Anuncio,
  type Canal,
  type EstadoPresencia,
  type Resena,
  type TipoCanal,
  type Vendedor,
} from './types';

/** The listings and sellers a Comercio page composes. */
export interface ComercioData {
  anuncios: Anuncio[];
  vendedores: Vendedor[];
}

/** How many public listings the list renders on the server in phase B (9.3: the first page). */
const LISTADO_MAX = 200;

/** Reviews read per seller for its reputation and its table (9.8). */
const RESENAS_MAX = 100;

const LISTING_COLUMNS =
  'listing_id,seller_id,asset_type,world_key,status,asset,fiat_currency,fiat_amount,game_prices,negotiable,created_at,published_at,expires_at';

/** The channel kinds of `trade_contact_channels` as the channel types of the site (9.4). */
const CANAL_DE_KIND: Readonly<Record<string, TipoCanal>> = {
  email: 'correo',
  phone: 'telefono',
  discord: 'discord',
  google: 'google',
  twitch: 'twitch',
  other: 'otra',
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Row = Record<string, unknown>;

function rows(data: unknown): Row[] {
  return Array.isArray(data)
    ? data.filter((row): row is Row => typeof row === 'object' && row !== null)
    : [];
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

let serverClient: SupabaseClient | null | undefined;

/** An anon client without a session: the server reads only what any visitor may read. */
function anonClient(): SupabaseClient | null {
  if (serverClient === undefined) {
    const config = getSupabasePublicConfig();
    serverClient =
      config === null
        ? null
        : createClient(config.url, config.anonKey, {
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
          });
  }
  return serverClient;
}

/** Whether this render reads the database (phase B with the public settings). */
function readsDatabase(): boolean {
  return comercioPublico() && anonClient() !== null;
}

/** The sample registry, which phase B adds only with COMERCIO_DEMO. */
function demo(): ComercioData {
  if (comercioPublico() && !comercioDemo()) return { anuncios: [], vendedores: [] };
  return { anuncios: getAnuncios(), vendedores: getVendedores() };
}

interface Profile {
  userId: string;
  handle: string;
  since: string | null;
}

async function profilesOf(client: SupabaseClient, ids: readonly string[]): Promise<Profile[]> {
  const unique = [...new Set(ids.filter((id) => UUID.test(id)))];
  const profiles: Profile[] = [];
  for (let start = 0; start < unique.length; start += 100) {
    const { data, error } = await client.rpc('trade_public_profiles', {
      p_user_ids: unique.slice(start, start + 100),
    });
    if (error) throw new Error(`trade_public_profiles: ${error.code ?? 'error'}`);
    for (const row of rows(data)) {
      const userId = text(row.user_id);
      const handle = text(row.username);
      if (userId !== null && handle !== null) {
        profiles.push({ userId, handle, since: text(row.member_since) });
      }
    }
  }
  return profiles;
}

async function presenceOf(
  client: SupabaseClient,
  ids: readonly string[],
): Promise<Map<string, EstadoPresencia>> {
  const states = new Map<string, EstadoPresencia>();
  for (let start = 0; start < ids.length; start += 100) {
    const { data, error } = await client.rpc('trade_effective_presence', {
      p_user_ids: ids.slice(start, start + 100),
    });
    if (error) throw new Error(`trade_effective_presence: ${error.code ?? 'error'}`);
    for (const row of rows(data)) {
      const userId = text(row.user_id);
      const estado = (ESTADOS_PRESENCIA as readonly unknown[]).includes(row.estado)
        ? (row.estado as EstadoPresencia)
        : null;
      if (userId !== null && estado !== null) states.set(userId, estado);
    }
  }
  return states;
}

async function channelsOf(
  client: SupabaseClient,
  ids: readonly string[],
): Promise<Map<string, Canal[]>> {
  const channels = new Map<string, Canal[]>();
  if (ids.length === 0) return channels;
  const { data, error } = await client
    .from('trade_contact_channels')
    .select('user_id,kind,platform,public_label')
    .in('user_id', ids as string[]);
  if (error) throw new Error(`trade_contact_channels: ${error.code ?? 'error'}`);
  for (const row of rows(data)) {
    const userId = text(row.user_id);
    const kind = text(row.kind);
    if (userId === null || kind === null) continue;
    const tipo = CANAL_DE_KIND[kind];
    if (tipo === undefined) continue;
    const list = channels.get(userId) ?? [];
    list.push({ tipo, etiqueta: text(row.public_label) ?? text(row.platform) });
    channels.set(userId, list);
  }
  return channels;
}

async function reviewsOf(client: SupabaseClient, sellerId: string): Promise<Resena[]> {
  const { data, error } = await client.rpc('trade_public_reviews', {
    p_seller_id: sellerId,
    p_limit: RESENAS_MAX,
    p_offset: 0,
  });
  if (error) throw new Error(`trade_public_reviews: ${error.code ?? 'error'}`);
  const reviews: Resena[] = [];
  for (const row of rows(data)) {
    const score = typeof row.score === 'number' ? row.score : Number(row.score);
    const fecha = text(row.created_at);
    if (!Number.isInteger(score) || fecha === null) continue;
    reviews.push({
      puntuacion: score,
      comentario: text(row.comment),
      fecha,
      // The listing of a deal is not public (9.12.3): the review names no listing.
      anuncio: '',
      // Reviews of deleted accounts count together as one counterpart (9.15.4).
      comprador: text(row.reviewer_handle) ?? '',
    });
  }
  return reviews;
}

/** The sellers of these accounts with their channels, status and reviews. */
async function sellersOf(
  client: SupabaseClient,
  profiles: readonly Profile[],
  withReviews: boolean,
): Promise<Vendedor[]> {
  const ids = profiles.map((profile) => profile.userId);
  const [presence, channels] = await Promise.all([
    presenceOf(client, ids),
    channelsOf(client, ids),
  ]);
  const sellers: Vendedor[] = [];
  for (const profile of profiles) {
    sellers.push({
      id: profile.handle,
      nombre: profile.handle,
      desde: profile.since,
      presencia: presence.get(profile.userId) ?? 'desconectado',
      canales: channels.get(profile.userId) ?? [],
      resenas: withReviews ? await reviewsOf(client, profile.userId) : [],
    });
  }
  return sellers;
}

/** Listing rows as listings of 9.4, each with the handle of its visible seller. */
function listingsOf(data: unknown, profiles: readonly Profile[]): Anuncio[] {
  const handles = new Map(profiles.map((profile) => [profile.userId, profile.handle]));
  const listings: Anuncio[] = [];
  for (const row of rows(data)) {
    const handle = handles.get(String(row.seller_id));
    if (handle === undefined) continue;
    const anuncio = toAnuncio(row, handle);
    if (anuncio !== null) listings.push(anuncio);
  }
  return listings;
}

/** The list (9.5): the newest public listings and their sellers. */
export async function loadListado(): Promise<ComercioData> {
  const sample = demo();
  const client = anonClient();
  if (!readsDatabase() || client === null) return sample;
  const { data, error } = await client
    .from('trade_listings')
    .select(LISTING_COLUMNS)
    .order('published_at', { ascending: false })
    .limit(LISTADO_MAX);
  if (error) throw new Error(`trade_listings: ${error.code ?? 'error'}`);
  const profiles = await profilesOf(
    client,
    rows(data).map((row) => String(row.seller_id)),
  );
  return {
    anuncios: [...listingsOf(data, profiles), ...sample.anuncios],
    vendedores: [...(await sellersOf(client, profiles, true)), ...sample.vendedores],
  };
}

/** The detail (9.6): the listing, or undefined for one no visitor may see. */
export async function loadAnuncio(
  id: string,
): Promise<{ anuncio: Anuncio | undefined; vendedores: Vendedor[] }> {
  const client = anonClient();
  if (readsDatabase() && client !== null && UUID.test(id)) {
    const { data, error } = await client
      .from('trade_listings')
      .select(LISTING_COLUMNS)
      .eq('listing_id', id)
      .limit(1);
    if (error) throw new Error(`trade_listings: ${error.code ?? 'error'}`);
    const profiles = await profilesOf(
      client,
      rows(data).map((row) => String(row.seller_id)),
    );
    return {
      anuncio: listingsOf(data, profiles)[0],
      vendedores: await sellersOf(client, profiles, true),
    };
  }
  const sample = demo();
  return {
    anuncio: sample.anuncios.length > 0 ? getAnuncio(id) : undefined,
    vendedores: sample.vendedores,
  };
}

/** The profile (9.8): the seller and its listings, or undefined for a hidden account. */
export async function loadVendedor(
  handle: string,
): Promise<{ vendedor: Vendedor | undefined; anuncios: Anuncio[] }> {
  const client = anonClient();
  if (readsDatabase() && client !== null) {
    const { data, error } = await client.rpc('trade_public_profile', { p_username: handle });
    if (error) throw new Error(`trade_public_profile: ${error.code ?? 'error'}`);
    const row = rows(data)[0];
    const userId = row === undefined ? null : text(row.user_id);
    const name = row === undefined ? null : text(row.username);
    if (userId !== null && name !== null) {
      const profile: Profile = { userId, handle: name, since: text(row?.member_since) };
      const listings = await client
        .from('trade_listings')
        .select(LISTING_COLUMNS)
        .eq('seller_id', userId)
        .order('published_at', { ascending: false })
        .limit(LISTADO_MAX);
      if (listings.error) throw new Error(`trade_listings: ${listings.error.code ?? 'error'}`);
      const [vendedor] = await sellersOf(client, [profile], true);
      return { vendedor, anuncios: listingsOf(listings.data, [profile]) };
    }
  }
  const sample = demo();
  const vendedor = sample.vendedores.length > 0 ? getVendedor(handle) : undefined;
  return {
    vendedor,
    anuncios: vendedor === undefined ? [] : sample.anuncios.filter((a) => a.vendedor === handle),
  };
}
