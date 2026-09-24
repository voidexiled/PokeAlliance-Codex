import type { Locale } from '@/i18n/config';
import { fill } from '@/i18n/messages/types';
import { mapSupabaseError } from '@/lib/supabase/errors';

import type { AccountMessages, AccountTradeTexts } from '../AccountPanel';
import type { AccountPanelTexts } from './texts';
import type { LinkReturn } from './types';

/**
 * What the page says when a provider sends the browser back from `linkIdentity` with an error:
 * the identity is on another account, or the account cancelled at the provider («Cancelaste la
 * vinculación con Google.», only inside «Conexiones»: `cancelled`), or the mapped error. Null
 * when there is nothing to say (a cancel outside «Conexiones», as before).
 */
export function linkReturnMessage(
  linkReturn: LinkReturn,
  options: {
    messages: AccountMessages;
    panel: AccountPanelTexts;
    trade: AccountTradeTexts;
    locale: Locale;
    cancelled: boolean;
  },
): { lead: string; rest: string | null } | null {
  const { provider, code } = linkReturn;
  const name = provider === null ? null : options.trade.channels[provider];
  if (code === 'access_denied') {
    if (!options.cancelled || name === null) return null;
    return {
      lead: fill(options.messages.auth.cancelledLead, { provider: name }),
      rest: options.messages.auth.providerDownText,
    };
  }
  if (code === 'identity_already_exists' && name !== null) {
    return { lead: fill(options.messages.identities.taken, { provider: name }), rest: null };
  }
  return { lead: mapSupabaseError({ code, network: false }, options.locale), rest: null };
}
