import type { SupabaseClient, User } from '@supabase/supabase-js';

import type { Locale } from '@/i18n/config';
import type { AccountSummary } from '@/lib/supabase/trade';

import type {
  AccountConfig,
  AccountMessages,
  AccountTradeTexts,
  AccountWorld,
  UiLabels,
} from '../AccountPanel';
import type { AccountPanelTexts } from './texts';

/** What every section of a complete account reads. */
export interface PanelContext {
  client: SupabaseClient;
  locale: Locale;
  messages: AccountMessages;
  panel: AccountPanelTexts;
  trade: AccountTradeTexts;
  ui: UiLabels;
  config: AccountConfig;
  worlds: AccountWorld[];
  user: User;
  account: AccountSummary;
  /** Reads the account again (after a save, a link or an unlink). */
  reload: () => void;
}

/** A provider's answer to `linkIdentity` that brought the browser back to the page. */
export interface LinkReturn {
  provider: 'discord' | 'google' | 'twitch' | null;
  /** `error_code` (or `error`) of the address, e.g. `access_denied`. */
  code: string;
}
