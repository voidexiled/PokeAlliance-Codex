import { Fragment, useState } from 'react';
import type { ReactNode } from 'react';

import { ToggleGroup } from '@/components/controls/ToggleGroup';
import { NestedEntity } from '@/components/game/NestedEntity';
import { BarChart } from '@/components/guild/BarChart';
import type { BarChartDay } from '@/components/guild/BarChart';
import { Section } from '@/components/layout/Section';
import type { Locale } from '@/i18n/config';
import type { Messages } from '@/i18n/messages/en';
import { fill } from '@/i18n/messages/types';
import { formatDayMonth, formatWeekday } from '@/lib/format/dates';
import { formatInteger } from '@/lib/format/numbers';
import { UNKNOWN } from '@/lib/format/unknown';
import type { TipData } from '@/lib/game/tips';

// GuildDays (spec 10.7; `Lienzo:Guild` «Por día»): the «Métrica» ToggleGroup, the BarChart of
// the 14 days `[D−13, D]` and the formula line under it.
//
// Presentational (10.3: «La interfaz no calcula»): the island passes each day's figures, the
// scale and daily goal of each metric (`niceTicks` and the goal of 10.7, from
// `guild-analytics.ts`), the point tiers and the weekly goal of the settings (10.11). This
// component only chooses the metric and writes the figures: grouped integers (contribution too,
// Q15), dates as dd/mm read in UTC because a day of the history is a calendar date already
// placed on its Server Save day, and every text from the dictionary (`guild.days`, DP1).
//
// A day without an export has no bar and says «sin export» (CA-10.3, G7). D, the last day, is
// «en curso»: with an export its bar is at 45 % and its panel title ends in «, en curso». An
// export that covers more than one day keeps its bar on its own date and its panel adds
// «Desde» (the interval's first day, or «lunes dd/mm» when it is the base of the week).
//
// Each bar is named by its day («Viernes 18/09, en curso»); the figures are the description,
// the day panel that `NestedEntity` joins with `aria-describedby`, so no sentence is composed
// here. The hidden table of the chart carries the same figures.
//
// «dailies» in the formula is the mention of the «Dailies de guild» system (`content/sistemas/`,
// §8.4): a `NestedEntity` with the registry's panel at `size-tt-wide`, or plain text when the
// registry has no such system (R2).

export type GuildMetric = 'points' | 'dailies' | 'contribution';

/** Totals of the export dated on a day: the sums of its deltas `Δd`, `Δc` and `P`. */
export interface GuildDayFigures {
  points: number;
  dailies: number;
  contribution: number;
}

/** One column of the chart. */
export interface GuildDay {
  /** ISO date `YYYY-MM-DD` of the Server Save day. */
  date: string;
  /** Totals of the export dated that day; `null` when the day has no export. */
  figures: GuildDayFigures | null;
  /** Members of that export with `Δd + Δc > 0`, and its members; `null` without export. */
  active: { count: number; of: number } | null;
  /** First day (ISO) of the export's interval `I(s)` when it covers more than one day. */
  from: string | null;
  /** The export is the base of its week, so `from` is that Monday. */
  fromWeekStart: boolean;
}

/** Scale of one metric (10.7). */
export interface GuildDaysScale {
  /** From 0 to the top of the axis, `niceTicks(max(value, goal))`. */
  ticks: readonly number[];
  /** Daily goal of the guild in this metric, or `null`: no line. */
  goal: number | null;
}

/** A points tier of the settings (10.11, D-005): `GuildDifficultyTier` fits it. */
export interface GuildDailyTier {
  minimumLevel: number;
  maximumLevel: number | null;
  points: number;
}

export interface GuildDaysProps {
  locale: Locale;
  /** `guild` of the dictionary: `days`, and the «Día» header of `member.columns`. */
  messages: Pick<Messages['guild'], 'days' | 'member'>;
  /** `ui.pinHint`: the strip of the «dailies» panel. */
  pinHint: string;
  /** The 14 days `[D−13, D]`, oldest first; the last one is D. */
  days: readonly GuildDay[];
  /** Scale and daily goal of each metric. */
  scales: Readonly<Record<GuildMetric, GuildDaysScale>>;
  /** Points per daily by level tier (settings, 10.11). */
  tiers: readonly GuildDailyTier[];
  /** Weekly points goal per member of the normal goals; `null` drops «Meta semanal…». */
  weeklyGoal: number | null;
  /** Panel of the «Dailies de guild» system; without it «dailies» is text (R2). */
  dailiesTip?: TipData | null;
  /** Page of that system, when it has one. */
  dailiesHref?: string;
  /** Anchor of the section. */
  id?: string;
}

const METRICS: readonly GuildMetric[] = ['points', 'dailies', 'contribution'];

/** The Intl locale of each site locale, the one `src/lib/format/dates.ts` uses. */
const INTL_LOCALE: Record<Locale, string> = { es: 'es-MX', en: 'en-US' };

const SHORT_WEEKDAY = new Map<Locale, Intl.DateTimeFormat>();

/** A calendar day of the history as the instant the formatters read in UTC. */
function calendarDay(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

/** Two letters over the date, as the board draws them: «lu», «vi», «sá» / «Mo», «Fr». */
function weekdayShort(date: Date, locale: Locale): string {
  let format = SHORT_WEEKDAY.get(locale);
  if (!format) {
    format = new Intl.DateTimeFormat(INTL_LOCALE[locale], {
      weekday: 'short',
      timeZone: 'UTC',
    });
    SHORT_WEEKDAY.set(locale, format);
  }
  return Number.isNaN(date.getTime()) ? UNKNOWN : format.format(date).slice(0, 2);
}

/** A template whose placeholders may be nodes: «Puntos = {dailies} × …». */
function fillNodes(template: string, vars: Record<string, ReactNode>): ReactNode {
  return template
    .split(/\{(\w+)\}/)
    .map((part, index) =>
      index % 2 === 1 ? <Fragment key={index}>{vars[part] ?? `{${part}}`}</Fragment> : part,
    );
}

export function GuildDays({
  locale,
  messages,
  pinHint,
  days,
  scales,
  tiers,
  weeklyGoal,
  dailiesTip,
  dailiesHref,
  id = 'por-dia',
}: GuildDaysProps) {
  const text = messages.days;
  const [metric, setMetric] = useState<GuildMetric>('points');
  const scale = scales[metric];
  const number = (value: number) => formatInteger(value, locale);
  const dayMonth = (iso: string) => formatDayMonth(calendarDay(iso), locale, 'UTC');
  const withSince = days.some((day) => day.figures !== null && day.from !== null);
  const last = days.length - 1;

  const chartDays: BarChartDay[] = days.map((day, index) => {
    const date = calendarDay(day.date);
    const current = index === last;
    const long = formatWeekday(date, locale, 'UTC');
    const title = current ? fill(text.tipInProgress, { day: long }) : long;
    const { figures } = day;
    const active = day.active
      ? fill(text.activeValue, { a: number(day.active.count), n: number(day.active.of) })
      : null;
    const since =
      figures !== null && day.from !== null
        ? day.fromWeekStart
          ? fill(text.sinceMonday, { date: dayMonth(day.from) })
          : dayMonth(day.from)
        : null;
    const rows =
      figures === null
        ? []
        : [
            { label: text.tip.points, value: number(figures.points) },
            { label: text.tip.dailies, value: number(figures.dailies) },
            { label: text.tip.contribution, value: number(figures.contribution) },
            ...(active ? [{ label: text.tip.active, value: active }] : []),
            ...(since ? [{ label: text.tip.since, value: since }] : []),
          ];
    return {
      key: day.date,
      weekday: weekdayShort(date, locale),
      date: dayMonth(day.date),
      value: figures === null ? null : figures[metric],
      partial: current && figures !== null,
      current,
      note: figures === null ? text.noExport : current ? text.inProgress : undefined,
      weekStart:
        date.getUTCDay() === 1 ? fill(text.weekBand, { date: dayMonth(day.date) }) : undefined,
      ariaLabel: title,
      tip: figures === null ? null : { title, rows },
      cells:
        figures === null
          ? null
          : [
              number(figures.points),
              number(figures.dailies),
              number(figures.contribution),
              active ?? UNKNOWN,
              ...(withSince ? [since ?? ''] : []),
            ],
    };
  });

  // «nivel 1 a 149: 150; 150 a 349: 300; 350 o más: 600»: the tier that starts at 0 is
  // written from 1 (10.7).
  const tierText = tiers
    .map((tier) => {
      const from = number(Math.max(1, tier.minimumLevel));
      const points = number(tier.points);
      return tier.maximumLevel === null
        ? fill(text.formulaTierOpen, { from, points })
        : fill(text.formulaTier, { from, to: number(tier.maximumLevel), points });
    })
    .join('; ');

  const dailiesWord = dailiesTip ? (
    <NestedEntity
      tip={{ ...dailiesTip, width: 300 }}
      href={dailiesHref}
      placement="up"
      align="start"
      inline
      locale={locale}
      hint={pinHint}
    >
      {text.dailies}
    </NestedEntity>
  ) : (
    text.dailies
  );

  return (
    <Section id={id} title={text.title}>
      <ToggleGroup
        label={text.metric}
        value={metric}
        onChange={(next) => {
          const found = METRICS.find((candidate) => candidate === next);
          if (found) setMetric(found);
        }}
        options={METRICS.map((key) => ({ value: key, label: text.metrics[key] }))}
      />
      <div className="ac-guild-days__chart">
        <BarChart
          days={chartDays}
          ticks={scale.ticks}
          goal={
            scale.goal === null
              ? null
              : { value: scale.goal, text: fill(text.goal, { n: number(scale.goal) }) }
          }
          locale={locale}
          caption={text.caption}
          dayLabel={messages.member.columns.day}
          columns={[
            text.tip.points,
            text.tip.dailies,
            text.tip.contribution,
            text.tip.active,
            ...(withSince ? [text.tip.since] : []),
          ]}
          hint={pinHint}
        />
      </div>
      <p className="ac-guild-days__formula">
        {fillNodes(text.formula, { dailies: dailiesWord, tiers: tierText })}
        {weeklyGoal === null ? null : ` ${fill(text.formulaGoal, { goal: number(weeklyGoal) })}`}
        {` ${text.formulaDay}`}
      </p>
    </Section>
  );
}
