import { useEffect, useId, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';

import '@/styles/components/guild-dialogs.css';

import { DataTable } from '@/components/content/DataTable';
import type { DataTableColumn, DataTableRow } from '@/components/content/DataTable';
import { Notice } from '@/components/content/Notice';
import { Button } from '@/components/controls/Button';
import { Dialog, initialFocus } from '@/components/controls/Dialog';
import { Textarea } from '@/components/controls/Textarea';
import { Section } from '@/components/layout/Section';
import type { Locale } from '@/i18n/config';
import type { Messages } from '@/i18n/messages/en';
import { fill } from '@/i18n/messages/types';
import { formatDate, formatDayMonth } from '@/lib/format/dates';
import { formatInteger } from '@/lib/format/numbers';
import type { GuildExportPayload, GuildParseResult } from '@/lib/tools/guild-ranking';
import { parseGuildExportedAt, parseGuildExportText } from '@/lib/tools/guild-ranking';

// «Importar export» (spec 10.10, Q2): the dialog behind «Importar export» and the «Importar»
// of the empty page. Several `.json` files and/or the pasted JSON are read here, each one
// checked with the engine's parser (`parseGuildExportText`) and for its export date; what is
// valid goes to the island (`onImport`), which writes it to the browser or to the guild of the
// account (only `owner` and `officer` see this dialog there, 10.4). The result is one `Notice`
// inside the dialog — «Importados: 17/09, 18/09.», «Reemplazado: 18/09.» and one line
// «{archivo}: {mensaje}» per file that failed —, and the dialog stays open on it.
//
// The name of a file only ever appears in its error line and is never stored (R6); the text
// of a file is not kept either, only the export the engine parsed from it. There is no time
// zone selector (A12): an `exportedAt` without an offset is Brasília time.
//
// «Cortes» lists the snapshots of the workspace (date and members). «Eliminar» asks first in
// an alert dialog with the focus on «Cancelar» (10.4) and exists only when the island can
// delete (`onDelete`); an error of the deletion stays inside that dialog.

type ParseErrorCode = Extract<GuildParseResult, { ok: false }>['code'];

/** An export of a full guild is a few kilobytes; a larger file is not one and is not read. */
const MAX_FILE_BYTES = 1_000_000;

/** An export that passed the checks of this dialog, ready to be stored. */
export interface GuildImportItem {
  /** The export as the engine's parser returns it, with a readable `exportedAt`. */
  payload: GuildExportPayload;
  /** Name of the file, only to write its error line; null for the pasted JSON. */
  name: string | null;
}

export interface GuildImportResult {
  /** Server Save dates stored, including the replaced ones. */
  imported: string[];
  /** Dates that replaced a snapshot already stored for them. */
  replaced: string[];
  /** Items the island could not store, with the text of the error. */
  failed: { name: string | null; message: string }[];
}

export interface GuildSnapshotRow {
  /** Server Save date of the snapshot (ISO). */
  observationDate: string;
  members: number;
}

interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
  locale: Locale;
  messages: Pick<Messages['guild'], 'importDialog' | 'import' | 'cancel'>;
  ui: Pick<Messages['ui'], 'close' | 'dismiss'>;
  /** Stores the valid exports, in order: a later one of the same date replaces the earlier. */
  onImport: (items: GuildImportItem[]) => Promise<GuildImportResult>;
  /** The snapshots of the workspace, oldest first. */
  snapshots: GuildSnapshotRow[];
  /** Deletes the snapshot of a date; resolves with the error text, or null. Absent: no button. */
  onDelete?: (observationDate: string) => Promise<string | null>;
}

/** A Server Save date written as the calendar day it names, whatever the zone of the reader. */
function isoDay(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

/**
 * The export date must name an instant: with an offset as it comes, without one as Brasília
 * time (A12). The engine files an unreadable date under «now», so it is refused here.
 */
function exportDateError(exportedAt: string | null | undefined): 'noDate' | 'invalidDate' | null {
  if (!exportedAt?.trim()) return 'noDate';
  return parseGuildExportedAt(exportedAt.trim()) === null ? 'invalidDate' : null;
}

export function ImportDialog({
  open,
  onClose,
  locale,
  messages,
  ui,
  onImport,
  snapshots,
  onDelete,
}: ImportDialogProps) {
  const text = messages.importDialog;
  const baseId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [pasted, setPasted] = useState('');
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<{ lines: string[] } | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // A new opening starts clean: no files, no pasted text, no old result.
  useEffect(() => {
    if (!open) return;
    setFiles([]);
    setPasted('');
    setOutcome(null);
    if (fileRef.current) fileRef.current.value = '';
  }, [open]);

  function errorText(code: ParseErrorCode | 'noDate' | 'invalidDate'): string {
    switch (code) {
      case 'invalid_json':
        return text.errors.invalidJson;
      case 'duplicate_member':
        return text.errors.duplicateMember;
      case 'noDate':
        return text.errors.noDate;
      case 'invalidDate':
        return text.errors.invalidDate;
      default:
        return text.errors.invalidExport;
    }
  }

  function line(name: string | null, message: string): string {
    return name === null ? message : fill(text.fileError, { file: name, message });
  }

  function dates(list: string[]): string {
    return [...new Set(list)]
      .sort()
      .map((date) => formatDayMonth(isoDay(date), locale, 'UTC'))
      .join(', ');
  }

  async function submit() {
    if (busy) return;
    setBusy(true);
    try {
      const lines: string[] = [];
      const items: GuildImportItem[] = [];
      const sources: { name: string | null; read: () => Promise<string | null> }[] = files.map(
        (file) => ({
          name: file.name,
          read: () => (file.size > MAX_FILE_BYTES ? Promise.resolve(null) : file.text()),
        }),
      );
      if (pasted.trim()) sources.push({ name: null, read: () => Promise.resolve(pasted) });

      for (const source of sources) {
        let content: string | null;
        try {
          content = await source.read();
        } catch {
          lines.push(line(source.name, errorText('invalid_json')));
          continue;
        }
        if (content === null) {
          lines.push(line(source.name, errorText('invalid_root')));
          continue;
        }
        const parsed = parseGuildExportText(content);
        if (!parsed.ok) {
          lines.push(line(source.name, errorText(parsed.code)));
          continue;
        }
        const dateError = exportDateError(parsed.payload.exportedAt);
        if (dateError) {
          lines.push(line(source.name, errorText(dateError)));
          continue;
        }
        items.push({ payload: parsed.payload, name: source.name });
      }

      const result = items.length
        ? await onImport(items)
        : { imported: [], replaced: [], failed: [] };
      const summary: string[] = [];
      if (result.imported.length) {
        summary.push(fill(text.imported, { dates: dates(result.imported) }));
      }
      if (result.replaced.length) {
        summary.push(fill(text.replaced, { dates: dates(result.replaced) }));
      }
      for (const failure of result.failed) lines.push(line(failure.name, failure.message));

      setOutcome({ lines: [...(summary.length ? [summary.join(' ')] : []), ...lines] });
      if (result.imported.length) {
        setFiles([]);
        setPasted('');
        if (fileRef.current) fileRef.current.value = '';
      }
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (pending === null || !onDelete || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const failure = await onDelete(pending);
      if (failure === null) setPending(null);
      else setDeleteError(failure);
    } finally {
      setDeleting(false);
    }
  }

  const columns: DataTableColumn[] = [
    { key: 'date', label: text.columns.date, rowHeader: true, numeric: true },
    { key: 'members', label: text.columns.members, numeric: true },
  ];
  if (onDelete) columns.push({ key: 'delete', label: text.delete, srOnly: true });

  const rows: DataTableRow[] = [...snapshots].reverse().map((snapshot) => {
    const date = formatDate(isoDay(snapshot.observationDate), locale, 'UTC');
    return {
      key: snapshot.observationDate,
      cells: {
        date,
        members: formatInteger(snapshot.members, locale),
        ...(onDelete
          ? {
              delete: (
                <Button
                  ariaLabel={`${text.delete}, ${date}`}
                  onClick={() => {
                    setDeleteError(null);
                    setPending(snapshot.observationDate);
                  }}
                >
                  {text.delete}
                </Button>
              ),
            }
          : {}),
      },
    };
  });

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        title={messages.import}
        closeLabel={ui.close}
        className="ac-guild-dialog"
      >
        <div className="ac-guild-dialog__field">
          <label className="ac-guild-dialog__label" htmlFor={`${baseId}-files`}>
            {text.files}
          </label>
          <input
            ref={fileRef}
            id={`${baseId}-files`}
            className="ac-guild-dialog__file"
            type="file"
            accept=".json,application/json"
            multiple
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              setFiles(Array.from(event.target.files ?? []))
            }
          />
        </div>
        <Textarea
          id={`${baseId}-paste`}
          label={text.paste}
          rows={6}
          value={pasted}
          onChange={(value) => setPasted(value)}
          textareaProps={{ spellCheck: false, autoComplete: 'off' }}
        />
        <div className="ac-guild-dialog__submit">
          <Button
            variant="solid"
            disabled={busy || (files.length === 0 && pasted.trim() === '')}
            onClick={() => void submit()}
          >
            {text.submit}
          </Button>
        </div>
        {outcome !== null && outcome.lines.length > 0 ? (
          <Notice closeLabel={ui.dismiss} onClose={() => setOutcome(null)}>
            {outcome.lines.map((entry, index) => (
              <span key={index} className="ac-guild-dialog__line">
                {entry}
              </span>
            ))}
          </Notice>
        ) : null}
        {snapshots.length > 0 ? (
          <Section id={`${baseId}-cortes`} title={text.snapshots} level={3}>
            <DataTable caption={text.snapshots} columns={columns} rows={rows} locale={locale} />
          </Section>
        ) : null}
      </Dialog>

      {onDelete ? (
        <Dialog
          open={pending !== null}
          onClose={() => {
            setPending(null);
            setDeleteError(null);
          }}
          title={
            pending === null
              ? text.delete
              : fill(text.snapshotName, { date: formatDate(isoDay(pending), locale, 'UTC') })
          }
          closeLabel={ui.close}
          alert
          actions={
            <>
              <Button {...initialFocus} onClick={() => setPending(null)}>
                {messages.cancel}
              </Button>
              <Button variant="solid" disabled={deleting} onClick={() => void confirmDelete()}>
                {text.delete}
              </Button>
            </>
          }
        >
          <p>
            {pending === null
              ? null
              : fill(text.deleteConfirm, {
                  date: formatDayMonth(isoDay(pending), locale, 'UTC'),
                })}
          </p>
          {deleteError !== null ? (
            <Notice closeLabel={ui.dismiss} onClose={() => setDeleteError(null)}>
              {deleteError}
            </Notice>
          ) : null}
        </Dialog>
      ) : null}
    </>
  );
}
