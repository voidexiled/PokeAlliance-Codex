// The profile saves of step 3 and «Perfil». Every account call goes through
// src/lib/supabase/trade.ts but these: the refusals of `account_save_profile` name the field in a
// fixed message (`username_taken`, `player_name_taken`…, 9.12.3) that the reduced failure of
// trade.ts does not keep, and the form needs it to put the line under the right field. The
// function name still comes from TRADE_RPC.
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';

import { toSupabaseFailure } from '@/lib/supabase/errors';
import { TRADE_RPC } from '@/lib/supabase/trade';
import { TERMINOS_VERSION } from '@/lib/trade/limits';

import type {
  NewProfileValues,
  ProfileField,
  ProfileRefusal,
  ProfileSaveOutcome,
  ProfileValues,
} from '../RegistrationSteps';

/** The fields and reasons of the refusals of `account_save_profile` and its table guard. */
const PROFILE_REFUSALS: Readonly<Record<string, { field: ProfileField; reason: ProfileRefusal }>> =
  {
    username_invalid: { field: 'username', reason: 'invalid' },
    username_taken: { field: 'username', reason: 'taken' },
    username_locked: { field: 'username', reason: 'locked' },
    player_name_invalid: { field: 'player', reason: 'invalid' },
    player_name_taken: { field: 'player', reason: 'taken' },
    world_invalid: { field: 'world', reason: 'invalid' },
    country_invalid: { field: 'country', reason: 'invalid' },
    birth_date_required: { field: 'birthDate', reason: 'invalid' },
    birth_date_invalid: { field: 'birthDate', reason: 'invalid' },
    birth_date_underage: { field: 'birthDate', reason: 'underage' },
    birth_date_locked: { field: 'birthDate', reason: 'locked' },
    terms_required: { field: 'terms', reason: 'invalid' },
    terms_version_invalid: { field: 'terms', reason: 'invalid' },
  };

function profileOutcome(error: PostgrestError | null, status: number): ProfileSaveOutcome {
  if (error === null) return { ok: true };
  const refusal = Object.hasOwn(PROFILE_REFUSALS, error.message)
    ? PROFILE_REFUSALS[error.message]
    : null;
  return {
    ok: false,
    failure: toSupabaseFailure(error, status),
    field: refusal?.field ?? null,
    reason: refusal?.reason ?? 'invalid',
  };
}

/** Step 3 with the terms of this build (`TERMINOS_VERSION`); the database refuses any other. */
export async function completeAccountProfile(
  client: SupabaseClient,
  values: NewProfileValues,
): Promise<ProfileSaveOutcome> {
  const { error, status } = await client.rpc(TRADE_RPC.saveProfile, {
    p_username: values.username,
    p_player_name: values.player,
    p_world_key: values.world,
    p_country_code: values.country,
    p_birth_date: values.birthDate,
    p_terms_version: TERMINOS_VERSION,
  });
  return profileOutcome(error, status);
}

/** «Perfil»: the birth date and the terms keep their saved values (null). */
export async function updateAccountProfile(
  client: SupabaseClient,
  values: ProfileValues,
): Promise<ProfileSaveOutcome> {
  const { error, status } = await client.rpc(TRADE_RPC.saveProfile, {
    p_username: values.username,
    p_player_name: values.player,
    p_world_key: values.world,
    p_country_code: values.country,
    p_birth_date: null,
    p_terms_version: null,
  });
  return profileOutcome(error, status);
}
