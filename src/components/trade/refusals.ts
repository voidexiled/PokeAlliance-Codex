// The reasons Comercio's database functions give (9.12.3: «un mensaje fijo que la isla traduce»)
// in the reader's words, `trade.refusals` of the dictionary: the composer writes them after «No se
// pudo publicar:» and the listing page under «Contactar al vendedor». Each key is read by name, so
// `pnpm i18n:check` sees every one used (13.2).
import type { Messages } from '@/i18n/messages/en';

export type RefusalLabels = Messages['trade']['refusals'];

/** A refusal: its text, and whether it points at «Mis anuncios» (the listing limit). */
export interface Refusal {
  text: string;
  /** The listing limit: the line ends with the link to «Mis anuncios». */
  toListings: boolean;
  /** A contact channel is missing: the line ends with the link to the account. */
  toAccount: boolean;
}

/**
 * The text of a known reason, or null for any other (the caller then writes the generic error
 * of src/lib/supabase/errors.ts). `limit` fills `{n}` of the listing limit.
 */
export function refusalFor(
  reason: string | null,
  labels: RefusalLabels,
  limit: string,
): Refusal | null {
  const plain = (text: string): Refusal => ({ text, toListings: false, toAccount: false });
  switch (reason) {
    case 'character_required':
      return plain(labels.characterRequired);
    case 'character_not_found':
    case 'character_invalid':
      return plain(labels.characterMissing);
    case 'world_mismatch':
      return plain(labels.worldMismatch);
    case 'buyer_world_required':
      return plain(labels.buyerWorld);
    case 'listing_limit':
      return {
        text: labels.listingLimit.replace('{n}', limit),
        toListings: true,
        toAccount: false,
      };
    case 'channel_required':
      return { text: labels.channel, toListings: false, toAccount: true };
    case 'rate_limited':
      return plain(labels.rateLimited);
    case 'price_invalid':
    case 'price_required':
      return plain(labels.price);
    case 'listing_state_invalid':
    case 'listing_not_found':
    case 'asset_type_locked':
      return plain(labels.state);
    default:
      return null;
  }
}

/** A failure the reader may simply try again: the network, or the server did not answer. */
export function retryable(
  error: { code?: string | null; network?: boolean } | null | undefined,
): boolean {
  if (error === null || error === undefined) return true;
  if (error.network === true) return true;
  return !['42501', '22023', '23505', 'P0001'].includes(error.code ?? '');
}
