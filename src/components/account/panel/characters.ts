// The pure pieces of «Personajes» (Personajes.dc.html): the line a refusal of the character
// functions shows, why «Quitar» is not offered, and the «jugador · mundo» line of «Perfil». No
// React, no supabase-js: tests/account/characters-panel.test.ts reads them as they are.
import { fill } from '@/i18n/messages/types';
import type { AccountCharacter } from '@/lib/supabase/trade';
import { PERSONAJES_MAX } from '@/lib/trade/limits';

import type { CharacterTexts } from './texts';

/** The refusals the section explains in its own words; anything else goes to `mapSupabaseError`. */
const KNOWN = [
  'player_name_taken',
  'character_limit',
  'character_not_found',
  'profile_required',
  'suspended',
  'player_name_invalid',
  'world_invalid',
  'character_has_listings',
  'character_is_main',
] as const;
export type CharacterReason = (typeof KNOWN)[number];

export function isCharacterReason(reason: string | null): reason is CharacterReason {
  return reason !== null && (KNOWN as readonly string[]).includes(reason);
}

/** The line of a refusal: its lead and, for a claimed name, the sentence after it. */
export function characterRefusal(
  reason: CharacterReason,
  texts: CharacterTexts,
): { lead: string; text: string | null } {
  if (reason === 'player_name_taken') {
    return { lead: texts.errors.player_name_taken, text: texts.errors.player_name_taken_text };
  }
  return { lead: fill(texts.errors[reason], { max: PERSONAJES_MAX }), text: null };
}

/** Why «Quitar» is not offered for a character; null when it is. */
export function removeBlock(
  character: Pick<AccountCharacter, 'isMain' | 'listings'>,
): 'listings' | 'main' | null {
  if (character.listings > 0) return 'listings';
  return character.isMain ? 'main' : null;
}

/** «Void Exiled · Titan 1»: a character and the name of its world. */
export function characterLine(
  character: Pick<AccountCharacter, 'playerName' | 'worldKey'>,
  worlds: readonly { id: string; nombre: string }[],
): string {
  const world = worlds.find((option) => option.id === character.worldKey)?.nombre;
  return world === undefined ? character.playerName : `${character.playerName} · ${world}`;
}

/** The characters with the main one first, as the database returns them; stable otherwise. */
export function mainFirst<T extends Pick<AccountCharacter, 'isMain'>>(list: readonly T[]): T[] {
  return [...list].sort((a, b) => Number(b.isMain) - Number(a.isMain));
}
