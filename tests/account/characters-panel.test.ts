// «Personajes» of the account page: the pure pieces of src/components/account/panel/characters.ts
// (the words of each refusal, why «Quitar» is not offered, the «jugador · mundo» line).
import { describe, expect, it } from 'vitest';

import {
  characterLine,
  characterRefusal,
  isCharacterReason,
  mainFirst,
  removeBlock,
} from '@/components/account/panel/characters';
import { en } from '@/i18n/messages/en';
import { es } from '@/i18n/messages/es';
import { CHARACTER_REFUSALS } from '@/lib/supabase/trade';

const texts = es.account.panel.characters;

describe('character refusals', () => {
  it('has words for every fixed reason of the character functions, in both languages', () => {
    for (const reason of [...CHARACTER_REFUSALS, 'profile_required', 'suspended'] as const) {
      expect(isCharacterReason(reason)).toBe(true);
      expect(characterRefusal(reason, texts).lead).not.toBe('');
      expect(characterRefusal(reason, en.account.panel.characters).lead).not.toBe('');
    }
    expect(isCharacterReason('authentication_required')).toBe(false);
    expect(isCharacterReason(null)).toBe(false);
  });

  it('says a claimed name in two parts and fills the limit', () => {
    expect(characterRefusal('player_name_taken', texts)).toEqual({
      lead: 'Ese personaje ya está en otra cuenta.',
      text: 'Si es tuyo, repórtalo.',
    });
    expect(characterRefusal('character_limit', texts).lead).toContain('10');
  });
});

describe('character rows', () => {
  it('offers «Quitar» only without listings on a character that is not the main one', () => {
    expect(removeBlock({ isMain: false, listings: 0 })).toBeNull();
    expect(removeBlock({ isMain: false, listings: 1 })).toBe('listings');
    expect(removeBlock({ isMain: true, listings: 4 })).toBe('listings');
    expect(removeBlock({ isMain: true, listings: 0 })).toBe('main');
  });

  it('writes the character with its world name and keeps the main one first', () => {
    const worlds = [{ id: 'titan-1', nombre: 'Titan 1' }];
    expect(characterLine({ playerName: 'Void Exiled', worldKey: 'titan-1' }, worlds)).toBe(
      'Void Exiled · Titan 1',
    );
    expect(characterLine({ playerName: 'Exiled', worldKey: 'gone' }, worlds)).toBe('Exiled');
    const list = [
      { id: 'a', isMain: false },
      { id: 'b', isMain: true },
      { id: 'c', isMain: false },
    ];
    expect(mainFirst(list).map(({ id }) => id)).toEqual(['b', 'a', 'c']);
  });
});
