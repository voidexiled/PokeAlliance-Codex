import type { ReactNode } from 'react';

import '@/styles/components/guild-summary.css';

import { CardGrid } from '@/components/cards/CardGrid';
import { KpiCard } from '@/components/cards/KpiCard';
import { EmptyState } from '@/components/content/EmptyState';
import { Section } from '@/components/layout/Section';
import type { Locale } from '@/i18n/config';
import type { Messages } from '@/i18n/messages/en';
import { fill } from '@/i18n/messages/types';
import { formatDate } from '@/lib/format/dates';
import { formatInteger, formatPercent } from '@/lib/format/numbers';
import { UNKNOWN } from '@/lib/format/unknown';

// «Resumen» of the Guild tool (spec 10.6, `Lienzo:Guild`): the PeriodFilter and, under it, the
// four `KpiCard` of the period in a `CardGrid family="kpi"` — Miembros con actividad, Dailies,
// Contribución and Puntos —, or one `EmptyState` line when the period has no export.
//
// Presentational: the figures arrive computed by src/lib/tools/guild-analytics.ts (the
// interface does not calculate, 10.3) and this component only writes them with the formats of
// 13.3 and the texts of `messages.guild.summary`. The PeriodFilter (DS:PeriodFilter) is a
// slot, because the island owns the period that governs these figures.
//
// Contribution is a grouped integer without sprite until Q15 says it is an amount of
// Pokédólares (10.3). No figure is coloured by its sign (DS:KpiCard).

/** The period a comparison is made against (10.6): «7 días anteriores», «Ayer»… */
export type GuildComparisonBase =
  | { kind: 'days7' }
  | { kind: 'days30' }
  | { kind: 'yesterday' }
  /** A «Rango» of `days` days compares with the `days` days before it. */
  | { kind: 'days'; days: number };

/**
 * The comparison line of a KPI (10.6, CA-10.4). `complete`: both periods have an export on
 * every day, so the previous value is shown, with its variation in percent units (−5.3 for
 * «−5,3 %») unless it was 0 (`percent` null). Otherwise only how many of the `days` days of
 * the previous period had an export.
 */
export type GuildKpiComparison =
  | { complete: true; previous: number; percent: number | null }
  | { complete: false; covered: number; days: number };

export interface GuildSummaryFigures {
  base: GuildComparisonBase;
  /** Members of the last snapshot of the period with dailies or contribution in it. */
  active: {
    value: number;
    /** Members of the last snapshot of the period. */
    of: number;
    /** Inactive members of 10.9 and the threshold of 10.11 they are counted with. */
    inactive: number;
    threshold: number;
  };
  /** `of` is null when the daily goal of dailies is empty: the «de» is omitted. */
  dailies: { value: number; of: number | null; comparison: GuildKpiComparison };
  contribution: { value: number; comparison: GuildKpiComparison };
  points: { value: number; comparison: GuildKpiComparison };
}

export interface GuildSummaryData {
  /** The four figures, or null when the period has no snapshot. */
  figures: GuildSummaryFigures | null;
  /** Server Save date (ISO, `YYYY-MM-DD`) of the latest snapshot, for the empty period. */
  lastExportDate: string | null;
}

export interface GuildSummaryProps {
  locale: Locale;
  messages: Messages['guild']['summary'];
  /** The PeriodFilter of the section, with its period text (DS:PeriodFilter). */
  filter: ReactNode;
  data: GuildSummaryData;
}

/** A Server Save date written as the calendar day it names, whatever the zone of the reader. */
function isoDay(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

function baseLabel(base: GuildComparisonBase, messages: GuildSummaryProps['messages']): string {
  switch (base.kind) {
    case 'days7':
      return messages.previous.days7;
    case 'days30':
      return messages.previous.days30;
    case 'yesterday':
      return messages.previous.yesterday;
    case 'days':
      return fill(messages.previous.days, { n: base.days });
  }
}

function comparisonText(
  comparison: GuildKpiComparison,
  label: string,
  locale: Locale,
  messages: GuildSummaryProps['messages'],
): string {
  if (!comparison.complete) {
    return fill(messages.coverage, {
      label,
      c: formatInteger(comparison.covered, locale),
      n: formatInteger(comparison.days, locale),
    });
  }
  const value = formatInteger(comparison.previous, locale);
  if (comparison.percent === null) return fill(messages.comparisonPlain, { label, value });
  return fill(messages.comparison, {
    label,
    value,
    delta: formatPercent(comparison.percent, locale, { decimals: 1, signed: true }),
  });
}

export function GuildSummary({ locale, messages, filter, data }: GuildSummaryProps) {
  const { figures } = data;
  const label = figures ? baseLabel(figures.base, messages) : '';

  return (
    <Section id="resumen" title={messages.title}>
      {filter}
      {figures ? (
        <CardGrid family="kpi">
          <KpiCard
            label={messages.kpi.active}
            value={formatInteger(figures.active.value, locale)}
            of={fill(messages.of, { n: formatInteger(figures.active.of, locale) })}
            comparison={fill(messages.inactive, {
              k: formatInteger(figures.active.inactive, locale),
              x: formatInteger(figures.active.threshold, locale),
            })}
          />
          <KpiCard
            label={messages.kpi.dailies}
            value={formatInteger(figures.dailies.value, locale)}
            of={
              figures.dailies.of === null
                ? undefined
                : fill(messages.of, { n: formatInteger(figures.dailies.of, locale) })
            }
            comparison={comparisonText(figures.dailies.comparison, label, locale, messages)}
          />
          <KpiCard
            label={messages.kpi.contribution}
            value={formatInteger(figures.contribution.value, locale)}
            comparison={comparisonText(figures.contribution.comparison, label, locale, messages)}
          />
          <KpiCard
            label={messages.kpi.points}
            value={formatInteger(figures.points.value, locale)}
            comparison={comparisonText(figures.points.comparison, label, locale, messages)}
          />
        </CardGrid>
      ) : (
        <EmptyState>
          {fill(messages.emptyPeriod, {
            date: data.lastExportDate
              ? formatDate(isoDay(data.lastExportDate), locale, 'UTC')
              : UNKNOWN,
          })}
        </EmptyState>
      )}
    </Section>
  );
}
