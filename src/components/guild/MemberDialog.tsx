import { useId, useState } from 'react';

import '@/styles/components/guild-members.css';

import { FactList } from '@/components/cards/FactList';
import type { FactRow } from '@/components/cards/FactList';
import { Chip } from '@/components/content/Chip';
import { DataTable } from '@/components/content/DataTable';
import type { DataTableColumn, DataTableRow } from '@/components/content/DataTable';
import { Button } from '@/components/controls/Button';
import { Dialog } from '@/components/controls/Dialog';
import { NumberField } from '@/components/controls/NumberField';
import type { Locale } from '@/i18n/config';
import type { Messages } from '@/i18n/messages/en';
import { fill } from '@/i18n/messages/types';
import { formatWeekday } from '@/lib/format/dates';
import { formatInteger } from '@/lib/format/numbers';
import type { GuildDifficulty, GuildDifficultyAllocation } from '@/lib/tools/guild-difficulty';
import type { GuildMemberBand } from '@/lib/tools/guild-ranking';
import { formatGuildRank } from '@/lib/tools/guild-ranking';

// MemberDialog (spec 10.9, 7.2.8): the dialog a name of the Guild «Miembros» table opens, the
// evaluation of one member. Its title is the name; under it the FactList «Rango», «Nivel»,
// «Último acceso» and «Semana» («{p} de {meta} puntos» and the band of `getGuildMemberBand`,
// the same band the PNG gives, CA-10.8), the table of the last 14 days and, when the week's
// dailies split is estimated or was corrected by hand, the «Reparto de dailies» editor that
// the old tool had (X10).
//
// Presentational: the figures, the band and the estimated split arrive computed by the island
// (`guild-analytics.ts`, `guild-difficulty.ts`); this component writes them and keeps only the
// draft of the split editor. «Guardar desglose» hands the new split to the island, which
// persists it and recomputes the week; «Volver a automático» drops the manual split.
//
// The rank is the client's term without the export's article, the same in es and en (E13):
// `formatGuildRank` is idempotent, so a rank the island already formatted stays as it is.
// The difficulty names are game terms written as the client writes them (13.4), like the
// goals dialog does. Every other text is the dictionary's (`guild.member`, DP1).

/** One day of the member's last 14 (10.9). */
export interface GuildMemberDay {
  /** ISO date `YYYY-MM-DD` of the Server Save day. */
  date: string;
  /** The guild has an export dated that day; without one the day says «sin export». */
  exported: boolean;
  /** The member's `Δd`, `Δc` and `P` in the export dated that day; `null`: none («—»). */
  figures: { dailies: number; contribution: number; points: number } | null;
  /** The export is the base of its week, or its accumulated total went down. */
  note?: 'firstOfWeek' | 'lowerTotal' | null;
}

/** The dailies split of one export, when the week's split is estimated (10.9). */
export interface GuildMemberSplit {
  /** ISO date of the export whose dailies are split. */
  date: string;
  /** Dailies of that export: the sum the split must reach. */
  dailies: number;
  /** The split in force: the estimate, or the manual one saved before. */
  allocation: GuildDifficultyAllocation;
  /** A manual split is saved, so «Volver a automático» applies. */
  manual: boolean;
}

/** Everything the dialog shows about one member. */
export interface GuildMemberDetail {
  /** Stable key of the member, the one of its row. */
  key: string;
  /** Name as the export writes it: the title of the dialog. */
  name: string;
  /** `rank` of the last export («the Leader» or already «Leader»). */
  rank: string | null;
  /** `level` of the last export. */
  level: number | null;
  /** `lastLogin` of the last export, as the island writes it. */
  lastLogin: string | null;
  /**
   * The week so far: its points, the weekly points goal prorated by the member's eligible days
   * (`null` without a weekly goal), the band of `getGuildMemberBand` and whether the goal was
   * prorated (a member who joined this week). `null` while the week has no export with the
   * member: «Semana» shows «—».
   */
  week: { points: number; goal: number | null; band: GuildMemberBand; prorated: boolean } | null;
  /** The 14 days `[D−13, D]`, oldest first. */
  days: readonly GuildMemberDay[];
  /** The split editor; `null` hides it (the week's split is exact). */
  split: GuildMemberSplit | null;
}

export interface MemberDialogProps {
  open: boolean;
  /** Runs after every close; it must set `open` back to false (Dialog). */
  onClose: () => void;
  locale: Locale;
  member: GuildMemberDetail;
  /** `guild.member` of the dictionary. */
  messages: Messages['guild']['member'];
  /** `guild.days.noExport`: «sin export» / «no export». */
  noExport: string;
  /** `ui.close`, `ui.decrease` and `ui.increase`. */
  ui: Pick<Messages['ui'], 'close' | 'decrease' | 'increase'>;
  /** «Guardar desglose»: the new split of the export dated `date`. */
  onSaveSplit?: (date: string, allocation: GuildDifficultyAllocation) => void;
  /** «Volver a automático»: drop the manual split of the export dated `date`. */
  onResetSplit?: (date: string) => void;
}

const DIFFICULTIES: readonly GuildDifficulty[] = ['normal', 'wildscape', 'primal'];

/** Names of the difficulties, game terms written as the client writes them (13.4). */
const DIFFICULTY_NAMES: Record<GuildDifficulty, string> = {
  normal: 'Normal',
  wildscape: 'Wildscape',
  primal: 'Primal',
};

type SplitDraft = Record<GuildDifficulty, number | null>;

/** A calendar day of the history as the instant the formatters read in UTC. */
function calendarDay(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

/** The name of a goal band, the same in the dialog and in the PNG (CA-10.8). */
export function guildBandLabel(
  band: GuildMemberBand,
  bands: Messages['guild']['member']['bands'],
): string {
  switch (band) {
    case 'premium':
      return bands.premium;
    case 'goal':
      return bands.onTrack;
    case 'below':
      return bands.below;
    case 'neutral':
      return bands.none;
  }
}

function SplitEditor({
  split,
  locale,
  messages,
  ui,
  onSave,
  onReset,
}: {
  split: GuildMemberSplit;
  locale: Locale;
  messages: Messages['guild']['member'];
  ui: MemberDialogProps['ui'];
  onSave?: MemberDialogProps['onSaveSplit'];
  onReset?: MemberDialogProps['onResetSplit'];
}) {
  const headingId = useId();
  const [draft, setDraft] = useState<SplitDraft>(() => ({ ...split.allocation }));
  const values = DIFFICULTIES.map((difficulty) => draft[difficulty]);
  const complete = values.every((value): value is number => value !== null);
  const sum = values.reduce<number>((total, value) => total + (value ?? 0), 0);
  const changed = DIFFICULTIES.some(
    (difficulty) => draft[difficulty] !== split.allocation[difficulty],
  );

  return (
    <section className="ac-member-dialog__split" aria-labelledby={headingId}>
      <h3 id={headingId} className="ac-member-dialog__heading">
        {messages.split}
      </h3>
      {split.dailies === 0 ? (
        <p className="ac-member-dialog__text">{messages.splitNone}</p>
      ) : (
        <>
          <p className="ac-member-dialog__help">{messages.splitHelp}</p>
          <FactList
            zone={null}
            rows={[
              {
                label: messages.columns.day,
                value: formatWeekday(calendarDay(split.date), locale, 'UTC'),
              },
              { label: messages.columns.dailies, value: formatInteger(split.dailies, locale) },
            ]}
          />
          <div className="ac-member-dialog__fields">
            {DIFFICULTIES.map((difficulty) => {
              const name = DIFFICULTY_NAMES[difficulty];
              return (
                <NumberField
                  key={difficulty}
                  label={name}
                  value={draft[difficulty]}
                  min={0}
                  max={split.dailies}
                  step={1}
                  onChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      [difficulty]: value === null ? null : Math.round(value),
                    }))
                  }
                  decrementLabel={fill(ui.decrease, { label: name })}
                  incrementLabel={fill(ui.increase, { label: name })}
                />
              );
            })}
          </div>
          <div className="ac-member-dialog__actions">
            {onSave ? (
              <Button
                disabled={!complete || sum !== split.dailies || !changed}
                onClick={() => {
                  if (!complete) return;
                  onSave(split.date, {
                    normal: draft.normal ?? 0,
                    wildscape: draft.wildscape ?? 0,
                    primal: draft.primal ?? 0,
                  });
                }}
              >
                {messages.saveSplit}
              </Button>
            ) : null}
            {split.manual && onReset ? (
              <Button onClick={() => onReset(split.date)}>{messages.autoSplit}</Button>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}

export function MemberDialog({
  open,
  onClose,
  locale,
  member,
  messages,
  noExport,
  ui,
  onSaveSplit,
  onResetSplit,
}: MemberDialogProps) {
  const daysHeadingId = useId();
  const number = (value: number) => formatInteger(value, locale);
  const { week } = member;
  const band = week === null ? null : <Chip>{guildBandLabel(week.band, messages.bands)}</Chip>;

  const facts: FactRow[] = [
    { label: messages.rank, value: formatGuildRank(member.rank) },
    { label: messages.level, value: member.level === null ? null : number(member.level) },
    { label: messages.lastLogin, value: member.lastLogin },
    {
      label: messages.week,
      mode: 'node',
      value:
        week === null ? null : week.goal === null ? (
          band
        ) : (
          <span className="ac-member-dialog__week">
            {fill(messages.weekValue, { p: number(week.points), goal: number(week.goal) })}
            {band}
          </span>
        ),
    },
  ];

  const columns: DataTableColumn[] = [
    { key: 'day', label: messages.columns.day, align: 'left', rowHeader: true },
    { key: 'dailies', label: messages.columns.dailies, numeric: true },
    { key: 'contribution', label: messages.columns.contribution, numeric: true },
    { key: 'points', label: messages.columns.points, numeric: true },
  ];

  // The most recent day first: the dialog answers «what did this member do lately».
  const rows: DataTableRow[] = [...member.days].reverse().map((day) => {
    const name = formatWeekday(calendarDay(day.date), locale, 'UTC');
    const sub = !day.exported
      ? noExport
      : day.figures === null
        ? undefined
        : day.note === 'firstOfWeek'
          ? messages.firstOfWeek
          : day.note === 'lowerTotal'
            ? messages.lowerTotal
            : undefined;
    return {
      key: day.date,
      cells: {
        day: sub === undefined ? name : { value: name, sub },
        dailies: day.figures === null ? null : number(day.figures.dailies),
        contribution: day.figures === null ? null : number(day.figures.contribution),
        points: day.figures === null ? null : number(day.figures.points),
      },
    };
  });

  const split = member.split;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={member.name}
      closeLabel={ui.close}
      className="ac-member-dialog"
    >
      <FactList zone={null} rows={facts} />
      {week?.prorated ? <p className="ac-member-dialog__help">{messages.prorated}</p> : null}
      <section className="ac-member-dialog__days" aria-labelledby={daysHeadingId}>
        <h3 id={daysHeadingId} className="ac-member-dialog__heading">
          {messages.days}
        </h3>
        <DataTable caption={messages.days} columns={columns} rows={rows} locale={locale} dense />
      </section>
      {split ? (
        <SplitEditor
          key={`${member.key}:${split.date}:${DIFFICULTIES.map((d) => split.allocation[d]).join('-')}`}
          split={split}
          locale={locale}
          messages={messages}
          ui={ui}
          onSave={onSaveSplit}
          onReset={onResetSplit}
        />
      ) : null}
    </Dialog>
  );
}
