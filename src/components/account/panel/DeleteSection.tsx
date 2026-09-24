import { useState } from 'react';

import { fill, plural } from '@/i18n/messages/types';
import { formatInteger } from '@/lib/format/numbers';
import { listUserGuilds } from '@/lib/supabase/account';
import { mapSupabaseError } from '@/lib/supabase/errors';
import { deleteAccount } from '@/lib/supabase/trade';

import { Notice } from '@/components/content/Notice';
import { Button } from '@/components/controls/Button';
import { Dialog, initialFocus } from '@/components/controls/Dialog';
import { Section } from '@/components/layout/Section';

import type { PanelContext } from './types';

// «Eliminar cuenta» (9.9, 9.15.5; the danger zone of Cuenta-panel.dc.html): a card with the
// banner border that says what goes, and the alert dialog with the count of the guilds the
// account owns (read again when it opens, so it is never stale), the Comercio line with
// COMERCIO_PUBLICO and the line of a suspended account, «Cancelar» first. `account_delete`
// deletes the owned guilds and the account; a suspended one keeps its email, identities and
// player name taken and its Auth user blocked, without sessions.

interface DeleteSectionProps extends PanelContext {
  /** The guilds the account owns, as the page read them; undefined while unknown. */
  ownedGuilds: string[] | undefined;
  onDeleted: () => void;
}

export default function DeleteSection({
  client,
  locale,
  messages,
  panel,
  ui,
  config,
  account,
  ownedGuilds,
  onDeleted,
}: DeleteSectionProps) {
  const text = messages.delete;
  const [owned, setOwned] = useState<number | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const guildsLine = (count: number) =>
    count > 0
      ? fill(plural(locale, count, text.withGuilds), { n: formatInteger(count, locale) })
      : text.withoutGuilds;

  async function open() {
    if (preparing) return;
    setPreparing(true);
    setNotice(null);
    try {
      const { data, error } = await listUserGuilds(client);
      if (error || data === null) {
        setNotice(mapSupabaseError(error, locale));
        return;
      }
      setDialogError(null);
      setOwned(data.filter((guild) => guild.role === 'owner').length);
    } catch (caught) {
      setNotice(mapSupabaseError(caught, locale));
    } finally {
      setPreparing(false);
    }
  }

  async function confirm() {
    if (deleting) return;
    setDeleting(true);
    setDialogError(null);
    try {
      // It also ends the session on this browser and clears the header cache.
      const { error } = await deleteAccount(client);
      if (error) {
        setDialogError(mapSupabaseError(error, locale));
        return;
      }
      setOwned(null);
      onDeleted();
    } catch (caught) {
      setDialogError(mapSupabaseError(caught, locale));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Section id="cuenta-eliminar" title={panel.sections.eliminar}>
      <div className="ac-panel-danger">
        <div className="ac-panel-danger__text">
          {ownedGuilds !== undefined ? <p>{guildsLine(ownedGuilds.length)}</p> : null}
          {config.comercio ? <p>{text.trade}</p> : null}
        </div>
        <button
          type="button"
          className="ac-panel-button ac-panel-button--danger"
          aria-haspopup="dialog"
          onClick={() => void open()}
          disabled={preparing}
        >
          {text.title}
        </button>
      </div>
      {notice !== null ? (
        <Notice open onClose={() => setNotice(null)} closeLabel={ui.dismiss}>
          {notice}
        </Notice>
      ) : null}
      <Dialog
        open={owned !== null}
        onClose={() => {
          if (deleting) return;
          setOwned(null);
          setDialogError(null);
        }}
        title={text.dialogTitle}
        closeLabel={ui.close}
        alert
        actions={
          <>
            <Button {...initialFocus} onClick={() => setOwned(null)} disabled={deleting}>
              {messages.cancel}
            </Button>
            <button
              type="button"
              className="ac-panel-button ac-panel-button--danger"
              onClick={() => void confirm()}
              disabled={deleting}
            >
              {deleting ? text.deleting : text.title}
            </button>
          </>
        }
      >
        <p>{guildsLine(owned ?? 0)}</p>
        {config.comercio ? <p>{text.trade}</p> : null}
        {account.suspendedUntil !== null ? <p>{text.banned}</p> : null}
        {dialogError !== null ? (
          <Notice open onClose={() => setDialogError(null)} closeLabel={ui.dismiss}>
            {dialogError}
          </Notice>
        ) : null}
      </Dialog>
    </Section>
  );
}
