import { useEffect, useId, useMemo, useRef, useState } from 'react';

import '@/styles/components/guild-dialogs.css';

import { Notice } from '@/components/content/Notice';
import { Button } from '@/components/controls/Button';
import { Dialog } from '@/components/controls/Dialog';
import { NumberField } from '@/components/controls/NumberField';
import { Select } from '@/components/controls/Select';
import { TextField } from '@/components/controls/TextField';
import type { Locale } from '@/i18n/config';
import type { Messages } from '@/i18n/messages/en';
import { fill, plural } from '@/i18n/messages/types';
import { formatInteger } from '@/lib/format/numbers';
import type { GuildSettings } from '@/lib/supabase/guilds';
import {
  DEFAULT_GUILD_INACTIVITY_DAYS as GUILD_INACTIVITY_DEFAULT,
  GUILD_INACTIVITY_DAYS_MAX as GUILD_INACTIVITY_MAX,
  GUILD_INACTIVITY_DAYS_MIN as GUILD_INACTIVITY_MIN,
  normalizeGuildInactivityDays,
} from '@/lib/tools/guild-analytics';
import type { GuildDifficultyPolicy, GuildDifficultyTier } from '@/lib/tools/guild-difficulty';
import { DEFAULT_GUILD_DIFFICULTY_TIERS } from '@/lib/tools/guild-difficulty';
import type { GuildGoalMetric, GuildPacingSettings } from '@/lib/tools/guild-ranking';
import { DEFAULT_GUILD_PACING, normalizePacingSettings } from '@/lib/tools/guild-ranking';

// «Metas y cálculo» (spec 10.11, A14, X10): the dialog behind the «Metas» button of the Guild
// head. Everything the calculation takes from the guild is edited here at once — the goal
// matrix of D-005 (normal and premium; points, dailies and contribution; per day and per
// week), the points of a daily per level tier, the policy for a level change inside a week
// and the inactivity threshold of 10.9 — and «Guardar» persists all of it: in the browser in
// local mode, in `guild_settings` in account mode (the island decides where, `onSave`).
//
// Footer (A14): «Guardar» is disabled while nothing changed and while a field is invalid, and
// then the footer counts the invalid fields; «Cancelar» — like Escape and the close button —
// throws the draft away, so the next opening starts again from the saved values (CA-10.6).
// An error of the save is written inside the dialog, which stays open (10.4).
//
// Fields: a goal is empty (not evaluated) or a number from 0 to 10^12, whole for dailies, as
// the current engine reads it; the points of a tier are a whole number from 1 to 10^6; the
// threshold is the 1–30 `NumberField` of 10.11. The bounds are the ones `set_guild_settings`
// checks, so a value this dialog accepts is never refused by the database.
//
// The settings type is the one `guild_settings` keeps (src/lib/supabase/guilds.ts): local mode
// stores the same values in the browser.

export type { GuildSettings };
export type GuildGoalKind = 'standard' | 'premium';
export type GuildGoalPeriod = 'daily' | 'weekly';

/** The goal matrix as the text of its fields, the shape the browser has always stored. */
export type GuildGoalDraft = Record<
  GuildGoalKind,
  Record<GuildGoalMetric, Record<GuildGoalPeriod, string>>
>;

const GOAL_MAX = 1_000_000_000_000;
const TIER_POINTS_MAX = 1_000_000;

const KINDS: GuildGoalKind[] = ['standard', 'premium'];
const METRICS: GuildGoalMetric[] = ['totalPoints', 'dailies', 'contribution'];
const PERIODS: GuildGoalPeriod[] = ['daily', 'weekly'];
const POLICIES: GuildDifficultyPolicy[] = ['current', 'previous', 'review'];

/** Names of the difficulties, game terms written as the client writes them (13.4). */
const DIFFICULTY_NAMES: Record<GuildDifficultyTier['difficulty'], string> = {
  normal: 'Normal',
  wildscape: 'Wildscape',
  primal: 'Primal',
};

export function defaultGuildSettings(): GuildSettings {
  return {
    goals: DEFAULT_GUILD_PACING,
    difficultyTiers: DEFAULT_GUILD_DIFFICULTY_TIERS.map((tier) => ({ ...tier })),
    transitionPolicy: 'current',
    inactivityDays: GUILD_INACTIVITY_DEFAULT,
  };
}

export function isGuildDifficultyPolicy(value: unknown): value is GuildDifficultyPolicy {
  return value === 'current' || value === 'previous' || value === 'review';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Settings read from the browser or from `guild_settings`, both untrusted: every field is
 * checked and a field that fails falls back to its default. Only the points of a tier are
 * taken from the source; its levels are the fixed tiers of D-005.
 */
export function readGuildSettings(source: {
  goals: unknown;
  difficultyTiers: unknown;
  transitionPolicy: unknown;
  inactivityDays: unknown;
}): GuildSettings {
  const stored = Array.isArray(source.difficultyTiers) ? source.difficultyTiers : [];
  return {
    goals: isRecord(source.goals)
      ? normalizePacingSettings(source.goals as Partial<GuildPacingSettings>)
      : DEFAULT_GUILD_PACING,
    difficultyTiers: DEFAULT_GUILD_DIFFICULTY_TIERS.map((tier) => {
      const candidate: unknown = stored.find(
        (entry) => isRecord(entry) && entry.difficulty === tier.difficulty,
      );
      const points = isRecord(candidate) ? candidate.points : undefined;
      return {
        ...tier,
        points:
          typeof points === 'number' &&
          Number.isInteger(points) &&
          points >= 1 &&
          points <= TIER_POINTS_MAX
            ? points
            : tier.points,
      };
    }),
    transitionPolicy: isGuildDifficultyPolicy(source.transitionPolicy)
      ? source.transitionPolicy
      : 'current',
    inactivityDays: normalizeGuildInactivityDays(source.inactivityDays),
  };
}

export function isGuildGoalDraft(value: unknown): value is GuildGoalDraft {
  if (!value || typeof value !== 'object') return false;
  const draft = value as Partial<GuildGoalDraft>;
  return KINDS.every((kind) =>
    METRICS.every((metric) =>
      PERIODS.every((period) => typeof draft[kind]?.[metric]?.[period] === 'string'),
    ),
  );
}

export function toGuildGoalDraft(goals: GuildPacingSettings): GuildGoalDraft {
  const text = (value: number | null) => (value === null ? '' : String(value));
  const draft = {} as GuildGoalDraft;
  for (const kind of KINDS) {
    draft[kind] = {} as GuildGoalDraft[GuildGoalKind];
    for (const metric of METRICS) {
      draft[kind][metric] = {
        daily: text(goals[kind][metric].daily),
        weekly: text(goals[kind][metric].weekly),
      };
    }
  }
  return draft;
}

/** A goal field: empty, or a number from 0 to 10^12 (whole for dailies). `undefined` if invalid. */
function readGoal(text: string, metric: GuildGoalMetric): number | null | undefined {
  const normalized = text.replace(',', '.').trim();
  if (normalized === '') return null;
  if (!/^\d+(\.\d+)?$/.test(normalized)) return undefined;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value > GOAL_MAX) return undefined;
  if (metric === 'dailies' && !Number.isInteger(value)) return undefined;
  return value;
}

/** Reads a stored or edited matrix; an invalid field reads as not evaluated. */
export function readGuildGoalDraft(draft: GuildGoalDraft): GuildPacingSettings {
  const goals = {} as GuildPacingSettings;
  for (const kind of KINDS) {
    goals[kind] = {} as GuildPacingSettings[GuildGoalKind];
    for (const metric of METRICS) {
      goals[kind][metric] = {
        daily: readGoal(draft[kind][metric].daily, metric) ?? null,
        weekly: readGoal(draft[kind][metric].weekly, metric) ?? null,
      };
    }
  }
  return goals;
}

/** Points of a tier: a whole number from 1 to 10^6. */
function readTierPoints(text: string): number | undefined {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return undefined;
  const value = Number(trimmed);
  return value >= 1 && value <= TIER_POINTS_MAX ? value : undefined;
}

interface SettingsDraft {
  goals: GuildGoalDraft;
  tiers: string[];
  policy: GuildDifficultyPolicy;
  inactivity: number | null;
}

function draftOf(settings: GuildSettings): SettingsDraft {
  return {
    goals: toGuildGoalDraft(settings.goals),
    tiers: settings.difficultyTiers.map((tier) => String(tier.points)),
    policy: settings.transitionPolicy,
    inactivity: settings.inactivityDays,
  };
}

interface GoalsDialogProps {
  open: boolean;
  /** Runs after every close; the island sets `open` back to false. */
  onClose: () => void;
  locale: Locale;
  messages: Pick<Messages['guild'], 'goalsDialog' | 'cancel'>;
  ui: Pick<Messages['ui'], 'close' | 'dismiss' | 'decrease' | 'increase'>;
  /** The saved values, which every opening starts from. */
  settings: GuildSettings;
  /** Persists the new values; resolves with the error text of a failed save, or null. */
  onSave: (settings: GuildSettings) => Promise<string | null>;
}

export function GoalsDialog({
  open,
  onClose,
  locale,
  messages,
  ui,
  settings,
  onSave,
}: GoalsDialogProps) {
  const text = messages.goalsDialog;
  const baseId = useId();
  const [draft, setDraft] = useState<SettingsDraft>(() => draftOf(settings));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Every opening starts from the saved values: a closed draft is never resumed (A14). Only
  // the opening resets it, so a refresh of the saved values never wipes what is being typed.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) {
      setDraft(draftOf(settings));
      setError(null);
    }
    wasOpen.current = open;
  }, [open, settings]);

  const initial = useMemo(() => JSON.stringify(draftOf(settings)), [settings]);
  const changed = JSON.stringify(draft) !== initial;

  const invalidGoals = new Set<string>();
  for (const kind of KINDS) {
    for (const metric of METRICS) {
      for (const period of PERIODS) {
        if (readGoal(draft.goals[kind][metric][period], metric) === undefined) {
          invalidGoals.add(`${kind}.${metric}.${period}`);
        }
      }
    }
  }
  const invalidTiers = draft.tiers.map((points) => readTierPoints(points) === undefined);
  const inactivityInvalid =
    draft.inactivity === null ||
    draft.inactivity < GUILD_INACTIVITY_MIN ||
    draft.inactivity > GUILD_INACTIVITY_MAX;
  const invalidCount =
    invalidGoals.size + invalidTiers.filter(Boolean).length + (inactivityInvalid ? 1 : 0);

  function setGoal(kind: GuildGoalKind, metric: GuildGoalMetric, period: GuildGoalPeriod) {
    return (value: string) =>
      setDraft((current) => ({
        ...current,
        goals: {
          ...current.goals,
          [kind]: {
            ...current.goals[kind],
            [metric]: { ...current.goals[kind][metric], [period]: value },
          },
        },
      }));
  }

  async function save() {
    if (!changed || invalidCount > 0 || saving || draft.inactivity === null) return;
    const next: GuildSettings = {
      goals: readGuildGoalDraft(draft.goals),
      difficultyTiers: settings.difficultyTiers.map((tier, index) => ({
        ...tier,
        points: readTierPoints(draft.tiers[index] ?? '') ?? tier.points,
      })),
      transitionPolicy: draft.policy,
      inactivityDays: draft.inactivity,
    };
    setSaving(true);
    setError(null);
    const failure = await onSave(next);
    setSaving(false);
    if (failure === null) onClose();
    else setError(failure);
  }

  const metricLabel: Record<GuildGoalMetric, string> = {
    totalPoints: text.rows.points,
    dailies: text.rows.dailies,
    contribution: text.rows.contribution,
  };
  const periodLabel: Record<GuildGoalPeriod, string> = {
    daily: text.perDay,
    weekly: text.perWeek,
  };
  const kindLabel: Record<GuildGoalKind, string> = {
    standard: text.normal,
    premium: text.premium,
  };
  const policyLabel: Record<GuildDifficultyPolicy, string> = {
    current: text.transitions.current,
    previous: text.transitions.previous,
    review: text.transitions.review,
  };

  function tierRange(tier: GuildDifficultyTier): string {
    // 10.7: the tier that starts at 0 is written from 1.
    const from = formatInteger(Math.max(1, tier.minimumLevel), locale);
    return tier.maximumLevel === null
      ? fill(text.tierOpen, { from })
      : fill(text.tier, { from, to: formatInteger(tier.maximumLevel, locale) });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={text.title}
      closeLabel={ui.close}
      className="ac-guild-dialog"
      actions={
        <>
          {invalidCount > 0 ? (
            <p className="ac-guild-dialog__invalid" role="status">
              {fill(plural(locale, invalidCount, text.invalid), {
                n: formatInteger(invalidCount, locale),
              })}
            </p>
          ) : null}
          <Button onClick={onClose}>{messages.cancel}</Button>
          <Button
            variant="solid"
            disabled={!changed || invalidCount > 0 || saving}
            onClick={() => void save()}
          >
            {saving ? text.saving : text.save}
          </Button>
        </>
      }
    >
      {error !== null ? (
        <Notice closeLabel={ui.dismiss} onClose={() => setError(null)}>
          {error}
        </Notice>
      ) : null}

      {KINDS.map((kind) => (
        <fieldset key={kind} className="ac-guild-dialog__group">
          <legend className="ac-guild-dialog__legend">{kindLabel[kind]}</legend>
          <table className="ac-guild-dialog__matrix">
            <thead>
              <tr>
                <td />
                {PERIODS.map((period) => (
                  <th key={period} scope="col">
                    {periodLabel[period]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {METRICS.map((metric) => (
                <tr key={metric}>
                  <th scope="row">{metricLabel[metric]}</th>
                  {PERIODS.map((period) => {
                    const invalid = invalidGoals.has(`${kind}.${metric}.${period}`);
                    return (
                      <td key={period}>
                        <TextField
                          id={`${baseId}-${kind}-${metric}-${period}`}
                          label={`${kindLabel[kind]} · ${metricLabel[metric]} · ${periodLabel[period]}`}
                          labelHidden
                          inputMode={metric === 'dailies' ? 'numeric' : 'decimal'}
                          value={draft.goals[kind][metric][period]}
                          onChange={setGoal(kind, metric, period)}
                          inputProps={{ autoComplete: 'off', 'aria-invalid': invalid || undefined }}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </fieldset>
      ))}
      <p className="ac-guild-dialog__helper">{text.emptyHelp}</p>

      <fieldset className="ac-guild-dialog__group">
        <legend className="ac-guild-dialog__legend">{text.dailyValue}</legend>
        <table className="ac-guild-dialog__matrix">
          <tbody>
            {settings.difficultyTiers.map((tier, index) => (
              <tr key={tier.difficulty}>
                <th scope="row">{DIFFICULTY_NAMES[tier.difficulty]}</th>
                <td className="ac-guild-dialog__range">{tierRange(tier)}</td>
                <td>
                  <TextField
                    id={`${baseId}-tier-${tier.difficulty}`}
                    label={`${DIFFICULTY_NAMES[tier.difficulty]} · ${text.dailyValue}`}
                    labelHidden
                    inputMode="numeric"
                    value={draft.tiers[index] ?? ''}
                    onChange={(value) =>
                      setDraft((current) => ({
                        ...current,
                        tiers: current.tiers.map((points, position) =>
                          position === index ? value : points,
                        ),
                      }))
                    }
                    inputProps={{
                      autoComplete: 'off',
                      'aria-invalid': invalidTiers[index] || undefined,
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </fieldset>

      <Select
        id={`${baseId}-policy`}
        label={text.transition}
        options={POLICIES.map((policy) => ({ value: policy, label: policyLabel[policy] }))}
        value={draft.policy}
        onChange={(value) => {
          if (isGuildDifficultyPolicy(value)) {
            setDraft((current) => ({ ...current, policy: value }));
          }
        }}
      />

      <NumberField
        id={`${baseId}-inactivity`}
        label={text.inactivity}
        min={GUILD_INACTIVITY_MIN}
        max={GUILD_INACTIVITY_MAX}
        value={draft.inactivity}
        onChange={(value) => setDraft((current) => ({ ...current, inactivity: value }))}
        decrementLabel={fill(ui.decrease, { label: text.inactivity })}
        incrementLabel={fill(ui.increase, { label: text.inactivity })}
        width={160}
      />
    </Dialog>
  );
}
