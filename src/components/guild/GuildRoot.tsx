import { Temporal } from '@js-temporal/polyfill';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import '@/styles/components/guild-page.css';

import { EmptyState } from '@/components/content/EmptyState';
import { FactLines } from '@/components/content/FactLine';
import type { FactLineData } from '@/components/content/FactLine';
import { Notice } from '@/components/content/Notice';
import { Button } from '@/components/controls/Button';
import { Select } from '@/components/controls/Select';
import { TextLink } from '@/components/controls/TextLink';
import {
  defaultGuildSettings,
  GoalsDialog,
  isGuildGoalDraft,
  readGuildGoalDraft,
  readGuildSettings,
  toGuildGoalDraft,
} from '@/components/guild/GoalsDialog';
import { GuildDays } from '@/components/guild/GuildDays';
import { formatGuildLastActivity, GuildMembers } from '@/components/guild/GuildMembers';
import { GuildSummary } from '@/components/guild/GuildSummary';
import { GuildWeeks } from '@/components/guild/GuildWeeks';
import { ImportDialog } from '@/components/guild/ImportDialog';
import type {
  GuildImportItem,
  GuildImportResult,
  GuildSnapshotRow,
} from '@/components/guild/ImportDialog';
import { guildBandLabel } from '@/components/guild/MemberDialog';
import type { GuildMemberDay, GuildMemberDetail } from '@/components/guild/MemberDialog';
import { PeriodFilter } from '@/components/guild/PeriodFilter';
import type { GuildRange } from '@/components/guild/PeriodFilter';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import type { BreadcrumbItem } from '@/components/layout/Breadcrumb';
import { PageTitle } from '@/components/layout/PageTitle';
import type { Locale } from '@/i18n/config';
import type { Messages } from '@/i18n/messages/en';
import { GUILD_EMPTY } from '@/i18n/messages/guild-empty';
import { fill, plural } from '@/i18n/messages/types';
import { formatDateRange, formatDayMonth, formatServerTime, formatTime } from '@/lib/format/dates';
import { formatInteger, formatPercent } from '@/lib/format/numbers';
import { UNKNOWN } from '@/lib/format/unknown';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { mapSupabaseError } from '@/lib/supabase/errors';
import {
  deleteGuildDailyExport,
  getGuildAccessSummary,
  getGuildSettings,
  GUILD_EXPORT_DATE_ERRORS,
  listGuildDailySnapshots,
  listUserGuilds,
  replaceUserGuildDailyExport,
  saveGuildSettings,
  sha256Hex,
} from '@/lib/supabase/guilds';
import type {
  GuildAccessSummary,
  GuildSettings,
  RemoteGuildDailySnapshot,
  SupabaseFailure,
  SupabaseGuild,
} from '@/lib/supabase/guilds';
import { SERVER_SAVE_ZONE } from '@/lib/time/server-save';
import {
  buildGuildMembersCsv,
  getGuildDailyGoals,
  getGuildDayScales,
  getGuildDays,
  getGuildDifficultyOverrideKey,
  getGuildExportFileName,
  getGuildHead,
  getGuildHistoryFrom,
  getGuildImageGoals,
  getGuildMemberDays,
  getGuildMembers,
  getGuildSummary,
  getGuildToday,
  getGuildTrendMax,
  getGuildWeekOf,
  getGuildWeeks,
  formatGuildDateInput,
  normalizeGuildInactivityDays,
  resolveGuildPeriod,
  validateGuildRange,
} from '@/lib/tools/guild-analytics';
import type {
  GuildDay,
  GuildDaysScale,
  GuildHead,
  GuildMemberRow,
  GuildMetric,
  GuildPeriod,
  GuildPeriodSelection,
  GuildResolvedPeriod,
  GuildSummaryData,
  GuildWeeksData,
} from '@/lib/tools/guild-analytics';
import {
  calculateGuildDailyHistory,
  createGuildDailySnapshot,
  replaceGuildDailySnapshot,
} from '@/lib/tools/guild-daily-history';
import type { GuildDailyHistory, GuildDailySnapshot } from '@/lib/tools/guild-daily-history';
import type { GuildDifficultyAllocation } from '@/lib/tools/guild-difficulty';
import {
  getGuildGoalWeeklyValue,
  parseGuildExport,
  parseGuildExportedAt,
} from '@/lib/tools/guild-ranking';
import { createGuildRankingPng } from '@/lib/tools/guild-ranking-image';
import type { GuildRankingImageRow } from '@/lib/tools/guild-ranking-image';

// GuildRoot (spec 10.4, 10.5; `Lienzo:Guild`): the island of /{l}/herramientas/guild/, mounted
// `client:load`. It owns everything with state on the page — the mode (browser or account),
// the snapshots and the settings of the workspace, the period of «Resumen», the import flow,
// the two dialogs and the files of «Exportar» — and draws the crumbs, the h1 and the region
// below them.
//
// Render (10.5, CA-10.13). The server and the first client render are the same: the crumbs
// «Herramientas › Guild», the h1 «Guild» and the empty region with `aria-busy="true"`; no data
// row, no empty state, no dialog. The sentence of the empty state is not even among the props
// (they are written into the HTML): it comes from src/i18n/messages/guild-empty.ts. Once
// hydrated the island reads the browser workspace and the session:
//   - without Supabase, without a session or with a session that has no guild, it is local
//     mode and paints the browser snapshots, or «Sin cortes», at once;
//   - with a session it paints the single line «Cargando la guild…» until the guilds and the
//     snapshots answer, never «Sin cortes» before that; an error is a `Notice` with the text of
//     `mapSupabaseError` and «Reintentar», with the browser analysis under it when there is one.
// `aria-busy` goes away as soon as the region shows something.
//
// Modes and roles (10.4). Local mode keeps up to 120 snapshots and the settings in
// `localStorage` (the key the tool has always used). Account mode reads the guild from the
// Monday of the week of D−34 (10.13), further back when the period compares with earlier days,
// and writes through the RPCs of src/lib/supabase/guilds.ts; `owner` and `officer` import,
// delete snapshots and edit the goals, `member` only reads, so it sees neither button. Signed
// in with snapshots in the browser, an owner or officer is offered to upload them to the guild.
// The manual dailies split of the member dialog stays in the browser in both modes.
//
// Calculation (10.3). The island runs the current engine (`calculateGuildDailyHistory`) and
// hands its history to `analyzeGuild`, which only calls src/lib/tools/guild-analytics.ts; the
// sections receive what it returns and format it. Nothing here computes a figure.

const WORKSPACE_KEY = 'alliance-codex:guild-workspace:v1';
/** 30 days plus 5 weeks of daily snapshots (10.4). */
const MAX_LOCAL_SNAPSHOTS = 120;
const OVERRIDE_KEY = /^\d{4}-\d{2}-\d{2}:.+$/;

type DifficultyOverrides = Record<string, GuildDifficultyAllocation | undefined>;

/** What the browser keeps (local mode) and what it keeps in both modes (the overrides). */
export interface GuildLocalWorkspace {
  /** Oldest first, one per Server Save date, at most 120. */
  snapshots: GuildDailySnapshot[];
  settings: GuildSettings;
  /** Manual dailies split of the member dialog, by `{date}:{member}` (10.9). */
  overrides: DifficultyOverrides;
}

/** What the sections read: the engine's history, the settings, D and the period (10.3). */
interface GuildAnalysisInput {
  history: GuildDailyHistory;
  settings: GuildSettings;
  /** D, the Server Save date of today (the client's clock in America/Sao_Paulo). */
  today: Temporal.PlainDate;
  /** The period of «Resumen». */
  selection: GuildPeriodSelection;
}

/** Everything the sections draw, computed by src/lib/tools/guild-analytics.ts. */
interface GuildAnalysis {
  head: GuildHead | null;
  summary: GuildSummaryData;
  days: GuildDay[];
  scales: Record<GuildMetric, GuildDaysScale>;
  /** Weekly points goal per member of the normal goals, for the formula line of «Por día». */
  weeklyGoal: number | null;
  weeks: GuildWeeksData;
  members: GuildMemberRow[];
  inactivityDays: number;
}

/** The seam of 10.3: every value of the page, from the functions of guild-analytics.ts. */
function analyzeGuild({ history, settings, today, selection }: GuildAnalysisInput): GuildAnalysis {
  const goals = settings.goals;
  const inactivityDays = normalizeGuildInactivityDays(settings.inactivityDays);
  const days = getGuildDays(history, today);
  return {
    head: getGuildHead(history, today),
    summary: getGuildSummary(history, goals, today, selection, inactivityDays),
    days,
    scales: getGuildDayScales(days, getGuildDailyGoals(history, goals, today)),
    weeklyGoal: getGuildGoalWeeklyValue(goals.standard.totalPoints),
    weeks: getGuildWeeks(history, goals, today),
    members: getGuildMembers(history, goals, today, inactivityDays),
    inactivityDays,
  };
}

export interface GuildRootProps {
  locale: Locale;
  /** The `guild` namespace without `empty`, which the island reads itself (CA-10.13). */
  messages: Omit<Messages['guild'], 'empty'>;
  ui: Pick<
    Messages['ui'],
    | 'close'
    | 'dismiss'
    | 'decrease'
    | 'increase'
    | 'pinHint'
    | 'inactive'
    | 'pagination'
    | 'prev'
    | 'next'
    | 'page'
  >;
  /** `search.empty`: «Sin resultados para «{q}».», for «Buscar miembro». */
  searchEmpty: string;
  /** The trail of 8.0.4 and the name of its landmark (`shell.breadcrumb`). */
  breadcrumb: { label: string; tools: string; toolsHref: string; guildHref: string };
  /** The worlds of content/mundos.json in the page language, for «Mundo:» (account mode). */
  worlds: { id: string; nombre: string }[];
  /** `/{l}/cuenta/`, or null when the build has no account mode and the route does not exist. */
  accountHref: string | null;
}

// --------------------------------------------------------------------------------- helpers

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAllocation(value: unknown): value is GuildDifficultyAllocation {
  return (
    isRecord(value) &&
    (['normal', 'wildscape', 'primal'] as const).every((difficulty) => {
      const count = value[difficulty];
      return typeof count === 'number' && Number.isInteger(count) && count >= 0;
    })
  );
}

/** A Server Save date written as the calendar day it names, whatever the zone of the reader. */
function isoDay(date: Temporal.PlainDate | string): Date {
  return new Date(`${date.toString()}T00:00:00Z`);
}

/**
 * The browser workspace, read as untrusted input: every snapshot is parsed again by the
 * engine and dropped when its export date cannot be placed; settings fall back field by field.
 */
export function parseGuildWorkspace(serialized: string | null): GuildLocalWorkspace {
  const workspace: GuildLocalWorkspace = {
    snapshots: [],
    settings: defaultGuildSettings(),
    overrides: {},
  };
  if (!serialized) return workspace;
  let stored: unknown;
  try {
    stored = JSON.parse(serialized);
  } catch {
    return workspace;
  }
  if (!isRecord(stored)) return workspace;

  let snapshots: GuildDailySnapshot[] = [];
  for (const entry of Array.isArray(stored.snapshots) ? stored.snapshots : []) {
    if (!isRecord(entry)) continue;
    const parsed = parseGuildExport(entry.payload);
    if (!parsed.ok || parseGuildExportedAt(parsed.payload.exportedAt) === null) continue;
    const id =
      typeof entry.snapshotId === 'string' && entry.snapshotId
        ? entry.snapshotId
        : `local-${parsed.payload.exportedAt}`;
    snapshots = replaceGuildDailySnapshot(
      snapshots,
      createGuildDailySnapshot(id, parsed.payload, SERVER_SAVE_ZONE),
    );
  }
  workspace.snapshots = snapshots.slice(-MAX_LOCAL_SNAPSHOTS);

  workspace.settings = readGuildSettings({
    goals: isGuildGoalDraft(stored.draft) ? readGuildGoalDraft(stored.draft) : null,
    difficultyTiers: stored.difficultyTiers,
    transitionPolicy: stored.transitionPolicy,
    inactivityDays: stored.inactivityDays,
  });

  if (isRecord(stored.difficultyOverrides)) {
    for (const [key, allocation] of Object.entries(stored.difficultyOverrides)) {
      if (OVERRIDE_KEY.test(key) && isAllocation(allocation)) {
        workspace.overrides[key] = allocation;
      }
    }
  }
  return workspace;
}

/** The stored form, the one the tool has always written (goals as the text of their fields). */
export function serializeGuildWorkspace(workspace: GuildLocalWorkspace): string {
  return JSON.stringify({
    snapshots: workspace.snapshots.map((snapshot) => ({
      snapshotId: snapshot.snapshotId,
      payload: snapshot.payload,
    })),
    draft: toGuildGoalDraft(workspace.settings.goals),
    difficultyTiers: workspace.settings.difficultyTiers,
    difficultyOverrides: workspace.overrides,
    transitionPolicy: workspace.settings.transitionPolicy,
    inactivityDays: workspace.settings.inactivityDays,
  });
}

function readStoredWorkspace(): GuildLocalWorkspace {
  try {
    return parseGuildWorkspace(window.localStorage.getItem(WORKSPACE_KEY));
  } catch {
    return parseGuildWorkspace(null);
  }
}

/** False when the browser refused to keep it (storage full or blocked). */
function storeWorkspace(workspace: GuildLocalWorkspace): boolean {
  try {
    window.localStorage.setItem(WORKSPACE_KEY, serializeGuildWorkspace(workspace));
    return true;
  } catch {
    return false;
  }
}

/** The digest an account keeps with a snapshot: of the parsed export, so both paths agree. */
function exportDigest(snapshot: { payload: GuildDailySnapshot['payload'] }): Promise<string> {
  return sha256Hex(JSON.stringify(snapshot.payload));
}

/** Saves a file the island wrote: a data URL or an object URL. */
function saveFile(href: string, name: string): void {
  const link = document.createElement('a');
  link.href = href;
  link.download = name;
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
}

interface RemoteGuild {
  guildId: string;
  /** Oldest first, from `from` on. */
  snapshots: RemoteGuildDailySnapshot[];
  from: string;
  settings: GuildSettings;
  /** Null when the summary could not be read: «Acceso:» shows «—». */
  access: GuildAccessSummary | null;
}

async function loadRemoteGuild(
  client: SupabaseClient,
  guild: SupabaseGuild,
  from: string,
): Promise<{ data: RemoteGuild; error: null } | { data: null; error: SupabaseFailure }> {
  const [snapshots, settings, access] = await Promise.all([
    listGuildDailySnapshots(client, guild, { from }),
    getGuildSettings(client, guild.guild_id),
    getGuildAccessSummary(client, guild.guild_id),
  ]);
  if (snapshots.error || snapshots.data === null) {
    return { data: null, error: snapshots.error ?? { code: null, network: false } };
  }
  if (settings.error) return { data: null, error: settings.error };
  return {
    data: {
      guildId: guild.guild_id,
      snapshots: snapshots.data,
      from,
      settings: settings.data ? readGuildSettings(settings.data) : defaultGuildSettings(),
      access: access.error ? null : access.data,
    },
    error: null,
  };
}

/** The workspace the page shows: the browser's or the guild's. */
interface Workspace {
  kind: 'local' | 'account';
  snapshots: GuildDailySnapshot[];
  settings: GuildSettings;
  /** Import, delete snapshots and edit goals: always in local mode, owner and officer else. */
  canEdit: boolean;
  /** The h1 and the current crumb: the `guild` of the export, or `display_name`. */
  name: string | null;
  guild: SupabaseGuild | null;
  access: GuildAccessSummary | null;
}

/** The days of the member dialog, with the notes of the engine's delta status (10.9). */
function memberDays(history: GuildDailyHistory, today: Temporal.PlainDate, key: string) {
  return getGuildMemberDays(history, today, key).map((day): GuildMemberDay => ({
    date: day.date,
    exported: day.exported,
    figures: day.figures,
    note:
      day.status === 'baseline'
        ? 'firstOfWeek'
        : day.status === 'decrease_detected'
          ? 'lowerTotal'
          : null,
  }));
}

// ------------------------------------------------------------------------------ component

export function GuildRoot({
  locale,
  messages,
  ui,
  searchEmpty,
  breadcrumb,
  worlds,
  accountHref,
}: GuildRootProps) {
  const [hydrated, setHydrated] = useState(false);
  const [today, setToday] = useState<Temporal.PlainDate | null>(null);
  const [local, setLocal] = useState<GuildLocalWorkspace>(() => parseGuildWorkspace(null));
  const [storageFull, setStorageFull] = useState(false);
  const [client, setClient] = useState<SupabaseClient | null>(null);
  // `undefined` while the session is unknown, `null` without one.
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [guilds, setGuilds] = useState<SupabaseGuild[] | null>(null);
  const [guildId, setGuildId] = useState<string | null>(null);
  const [extent, setExtent] = useState<{ guildId: string | null; from: string } | null>(null);
  const [remote, setRemote] = useState<RemoteGuild | null>(null);
  const [remoteError, setRemoteError] = useState<unknown>(null);
  const [errorHidden, setErrorHidden] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [period, setPeriod] = useState<GuildPeriod>('7d');
  const [range, setRange] = useState<GuildRange>({ from: '', to: '' });
  // The last «Rango» that `validateGuildRange` accepted: an invalid field keeps it (10.6).
  const [rangeDates, setRangeDates] = useState<{
    from: Temporal.PlainDate;
    to: Temporal.PlainDate;
  } | null>(null);
  const [rangeInvalid, setRangeInvalid] = useState<{ from?: boolean; to?: boolean }>({});
  const [importOpen, setImportOpen] = useState(false);
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadLines, setUploadLines] = useState<string[] | null>(null);
  const [uploadHidden, setUploadHidden] = useState(false);

  // Hydration: the browser workspace, D and the client. Nothing of this runs on the server,
  // so the prerendered HTML is the empty region (CA-10.13). The client (and supabase-js) only
  // loads when the build has account mode; until it answers the region stays busy, so a
  // session is never taken for local mode.
  useEffect(() => {
    setLocal(readStoredWorkspace());
    setToday(getGuildToday(Temporal.Now.instant()));
    let active = true;
    const ready = (supabase: SupabaseClient | null) => {
      if (!active) return;
      setClient(supabase);
      if (supabase === null) setSession(null);
      setHydrated(true);
    };
    // A client that cannot load leaves the page in local mode.
    getSupabaseBrowserClient().then(ready, () => ready(null));
    return () => {
      active = false;
    };
  }, []);

  // The session: read once, then followed (a sign-in or sign-out in another tab).
  useEffect(() => {
    if (client === null) return undefined;
    let active = true;
    client.auth.getSession().then(
      ({ data, error }) => {
        if (!active) return;
        if (error) {
          setRemoteError(error);
          setErrorHidden(false);
        } else setSession(data.session);
      },
      (error: unknown) => {
        if (!active) return;
        setRemoteError(error);
        setErrorHidden(false);
      },
    );
    const { data } = client.auth.onAuthStateChange((_event, next) => {
      if (active) setSession(next);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [client, attempt]);

  const userId = session?.user.id ?? null;

  // The guilds of the account.
  useEffect(() => {
    setGuilds(null);
    setRemote(null);
    if (client === null || userId === null) return undefined;
    let active = true;
    setRemoteError(null);
    setErrorHidden(false);
    listUserGuilds(client).then(
      (result) => {
        if (!active) return;
        if (result.error) {
          setRemoteError(result.error);
          setErrorHidden(false);
          return;
        }
        const list = result.data ?? [];
        setGuilds(list);
        setGuildId((current) =>
          current !== null && list.some((guild) => guild.guild_id === current)
            ? current
            : (list[0]?.guild_id ?? null),
        );
      },
      (error: unknown) => {
        if (!active) return;
        setRemoteError(error);
        setErrorHidden(false);
      },
    );
    return () => {
      active = false;
    };
  }, [client, userId, attempt]);

  // The period of «Resumen»: «Rango» keeps its last valid dates while a field is invalid.
  const selection = useMemo<GuildPeriodSelection>(() => {
    if (period !== 'rango') return { period };
    return rangeDates === null ? { period: '7d' } : { period: 'rango', ...rangeDates };
  }, [period, rangeDates]);
  const resolved = useMemo<GuildResolvedPeriod | null>(
    () => (today === null ? null : resolveGuildPeriod(selection, today)),
    [selection, today],
  );

  // How far back the account reads (10.13 «Carga»): the Monday of the week of D−34, or the
  // Monday of the week where the previous period of «Resumen» starts, when that is earlier,
  // so the engine has the base export of that week. It only grows while the guild stays.
  const periodStart = resolved?.start ?? null;
  const periodDays = resolved?.days ?? null;
  useEffect(() => {
    if (today === null || periodStart === null || periodDays === null) return;
    const base = getGuildHistoryFrom(today);
    const previous = getGuildWeekOf(
      Temporal.PlainDate.from(periodStart).subtract({ days: periodDays }),
    ).start;
    const want = previous < base ? previous : base;
    setExtent((current) =>
      current !== null && current.guildId === guildId && current.from <= want
        ? current
        : { guildId, from: want },
    );
  }, [today, guildId, periodStart, periodDays]);

  // The snapshots, settings and access of the chosen guild. A reload of the same guild keeps
  // what is on screen until the answer; a new guild shows «Cargando la guild…».
  const loadFrom = extent !== null && extent.guildId === guildId ? extent.from : null;
  useEffect(() => {
    const guild = guilds?.find((candidate) => candidate.guild_id === guildId) ?? null;
    if (client === null || guild === null || loadFrom === null) return undefined;
    let active = true;
    loadRemoteGuild(client, guild, loadFrom).then(
      (result) => {
        if (!active) return;
        if (result.error) {
          setRemoteError(result.error);
          setErrorHidden(false);
        } else {
          setRemoteError(null);
          setRemote(result.data);
        }
      },
      (error: unknown) => {
        if (!active) return;
        setRemoteError(error);
        setErrorHidden(false);
      },
    );
    return () => {
      active = false;
    };
  }, [client, guilds, guildId, loadFrom, attempt, refresh]);

  const guild = guilds?.find((candidate) => candidate.guild_id === guildId) ?? null;
  const signedIn = session !== undefined && session !== null;
  const pending = !hydrated || (client !== null && session === undefined && remoteError === null);
  // Signed in and not yet known to have no guild.
  const accountMode = signedIn && (guilds === null || guilds.length > 0);
  const remoteReady = remote !== null && guild !== null && remote.guildId === guild.guild_id;
  const loading = accountMode && !remoteReady && remoteError === null;
  const failed = remoteError !== null;

  function commitLocal(next: GuildLocalWorkspace): boolean {
    setLocal(next);
    const stored = storeWorkspace(next);
    setStorageFull(!stored);
    return stored;
  }

  const workspace = useMemo<Workspace | null>(() => {
    if (pending || loading) return null;
    if (accountMode && remoteReady && guild !== null) {
      return {
        kind: 'account',
        snapshots: remote.snapshots,
        settings: remote.settings,
        canEdit: guild.role === 'owner' || guild.role === 'officer',
        name: guild.display_name?.trim() || guild.guild_key,
        guild,
        access: remote.access,
      };
    }
    // Local mode, and the browser analysis under an account error (10.5): with no browser
    // snapshot the error stands alone until it is dismissed.
    if (accountMode && local.snapshots.length === 0 && !errorHidden) return null;
    const latest = local.snapshots.at(-1);
    return {
      kind: 'local',
      snapshots: local.snapshots,
      settings: local.settings,
      canEdit: true,
      name: latest?.payload.guild?.trim() || null,
      guild: null,
      access: null,
    };
  }, [accountMode, errorHidden, guild, loading, local, pending, remote, remoteReady]);

  const history = useMemo<GuildDailyHistory | null>(() => {
    if (workspace === null || workspace.snapshots.length === 0) return null;
    return calculateGuildDailyHistory(
      workspace.snapshots,
      workspace.settings.goals,
      SERVER_SAVE_ZONE,
      {
        difficultyTiers: workspace.settings.difficultyTiers,
        transitionPolicy: workspace.settings.transitionPolicy,
        difficultyOverrides: local.overrides,
      },
    );
  }, [local.overrides, workspace]);

  const analysis = useMemo<GuildAnalysis | null>(() => {
    if (history === null || workspace === null || today === null) return null;
    return analyzeGuild({ history, settings: workspace.settings, today, selection });
  }, [history, selection, today, workspace]);

  // The member dialog (10.9): built once per member and analysis, because `GuildMembers`
  // asks for it while it renders.
  const memberDetail = useMemo(() => {
    const cache = new Map<string, GuildMemberDetail | null>();
    return (key: string): GuildMemberDetail | null => {
      if (analysis === null || history === null || today === null) return null;
      const cached = cache.get(key);
      if (cached !== undefined) return cached;
      const row = analysis.members.find((member) => member.key === key);
      let detail: GuildMemberDetail | null = null;
      if (row) {
        const { week } = row;
        const lastLogin = parseGuildExportedAt(row.lastLogin, SERVER_SAVE_ZONE);
        detail = {
          key: row.key,
          name: row.name,
          rank: row.rank,
          level: row.level,
          lastLogin: lastLogin
            ? formatServerTime(lastLogin.epochMilliseconds, locale)
            : row.lastLogin,
          week:
            week === null
              ? null
              : {
                  points: week.figures.points,
                  goal: week.expected,
                  band: week.band,
                  prorated: week.prorated,
                },
          days: memberDays(history, today, row.key),
          split:
            week === null || week.split === null
              ? null
              : {
                  date: week.split.date,
                  dailies: week.split.dailies,
                  allocation: week.split.allocation,
                  manual: week.split.confidence === 'manual',
                },
        };
      }
      cache.set(key, detail);
      return detail;
    };
  }, [analysis, history, locale, today]);

  // ------------------------------------------------------------------------ writes

  function dayMonth(date: string): string {
    return formatDayMonth(isoDay(date), locale, 'UTC');
  }

  function remoteFailureText(error: SupabaseFailure): string {
    if (error.code === GUILD_EXPORT_DATE_ERRORS.missing) return messages.importDialog.errors.noDate;
    if (error.code === GUILD_EXPORT_DATE_ERRORS.invalid) {
      return messages.importDialog.errors.invalidDate;
    }
    return mapSupabaseError(error, locale);
  }

  async function importExports(items: GuildImportItem[]): Promise<GuildImportResult> {
    const result: GuildImportResult = { imported: [], replaced: [], failed: [] };

    if (workspace?.kind === 'account' && client !== null && remote !== null) {
      const known = new Set(remote.snapshots.map((snapshot) => snapshot.observationDate));
      for (const item of items) {
        const saved = await replaceUserGuildDailyExport(client, {
          guildId: remote.guildId,
          payload: item.payload,
          payloadDigest: await exportDigest(item),
        });
        if (saved.error || saved.data === null) {
          result.failed.push({
            name: item.name,
            message: remoteFailureText(saved.error ?? { code: null, network: false }),
          });
          continue;
        }
        const date = saved.data.observation_date;
        // Dates before the loaded ones are not on screen: the counter of the row tells.
        if (known.has(date) || (date < remote.from && saved.data.replaced_count > 0)) {
          result.replaced.push(date);
        }
        known.add(date);
        result.imported.push(date);
      }
      if (result.imported.length) setRefresh((value) => value + 1);
      return result;
    }

    let snapshots = local.snapshots;
    for (const item of items) {
      const snapshot = createGuildDailySnapshot(
        `local-${item.payload.exportedAt ?? ''}`,
        item.payload,
        SERVER_SAVE_ZONE,
      );
      if (snapshots.some((stored) => stored.observationDate === snapshot.observationDate)) {
        result.replaced.push(snapshot.observationDate);
      }
      snapshots = replaceGuildDailySnapshot(snapshots, snapshot);
      result.imported.push(snapshot.observationDate);
    }
    if (!commitLocal({ ...local, snapshots: snapshots.slice(-MAX_LOCAL_SNAPSHOTS) })) {
      result.failed.push({ name: null, message: messages.storageFull });
    }
    return result;
  }

  async function deleteSnapshot(observationDate: string): Promise<string | null> {
    if (workspace?.kind === 'account' && client !== null && remote !== null) {
      const deleted = await deleteGuildDailyExport(client, remote.guildId, observationDate);
      if (deleted.error) return mapSupabaseError(deleted.error, locale);
      setRefresh((value) => value + 1);
      return null;
    }
    const snapshots = local.snapshots.filter(
      (snapshot) => snapshot.observationDate !== observationDate,
    );
    return commitLocal({ ...local, snapshots }) ? null : messages.storageFull;
  }

  async function saveSettings(settings: GuildSettings): Promise<string | null> {
    if (workspace?.kind === 'account' && client !== null && remote !== null) {
      const saved = await saveGuildSettings(client, remote.guildId, settings);
      if (saved.error) return mapSupabaseError(saved.error, locale);
      setRemote({ ...remote, settings });
      return null;
    }
    return commitLocal({ ...local, settings }) ? null : messages.storageFull;
  }

  /** «Guardar desglose» of the member dialog: the manual split of one export (10.9). */
  function saveSplit(key: string, date: string, allocation: GuildDifficultyAllocation) {
    commitLocal({
      ...local,
      overrides: { ...local.overrides, [getGuildDifficultyOverrideKey(date, key)]: allocation },
    });
  }

  /** «Volver a automático»: the engine estimates that export's split again. */
  function resetSplit(key: string, date: string) {
    const overrides = { ...local.overrides };
    delete overrides[getGuildDifficultyOverrideKey(date, key)];
    commitLocal({ ...local, overrides });
  }

  /** «Exportar CSV» (10.12): the rows of the search and the filter, in their order. */
  function exportCsv(rows: readonly GuildMemberRow[]) {
    if (today === null) return;
    const csv = buildGuildMembersCsv(rows, messages.members.csv);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    saveFile(url, getGuildExportFileName(workspace?.name, today.toString(), 'csv'));
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  /** «Exportar PNG» (10.12): the same rows as the table writes them, under the head. */
  function exportPng(rows: readonly GuildMemberRow[]) {
    if (today === null || analysis === null || workspace === null) {
      throw new Error('Guild analysis not ready');
    }
    const number = (value: number | null) =>
      value === null ? UNKNOWN : formatInteger(value, locale);
    const week = analysis.head?.week ?? getGuildWeekOf(today);
    const exportedAt = analysis.head?.lastExport.exportedAt ?? null;
    const goals = getGuildImageGoals(workspace.settings.goals, today);
    // «Meta hoy: …», «Dailies: …», «Meta premium: …»; an empty goal is left out (10.12).
    const goalLines: string[] = [];
    const goalLine = (label: string, value: number | null) => {
      if (value !== null) goalLines.push(`${label}: ${formatInteger(value, locale)}`);
    };
    goalLine(messages.image.todayGoal, goals.todayPoints);
    goalLine(messages.image.dailies, goals.dailies);
    goalLine(messages.image.premiumGoal, goals.premiumPoints);
    const imageRows = rows.map((row): GuildRankingImageRow => ({
      name: row.name,
      rank: row.rank ?? UNKNOWN,
      level: number(row.level),
      today: number(row.today),
      days7: number(row.days7),
      days30: number(row.days30),
      trend: row.trend,
      change: formatPercent(row.change, locale, { decimals: 1, signed: true }),
      lastActivity: formatGuildLastActivity(row.lastActivity, locale, messages.members.activity),
      week: row.week === null ? UNKNOWN : guildBandLabel(row.week.band, messages.member.bands),
      inactive: row.inactive,
    }));
    const png = createGuildRankingPng({
      title: workspace.name ?? messages.title,
      lines: [
        fill(messages.image.week, {
          range: formatDateRange(isoDay(week.start), isoDay(week.end), locale, 'UTC'),
          k: formatInteger(week.day, locale),
        }),
        fill(messages.image.lastExport, {
          date: exportedAt === null ? UNKNOWN : formatServerTime(exportedAt, locale),
        }),
      ],
      goals: goalLines,
      columns: { ...messages.members.columns, week: messages.member.week },
      inactive: ui.inactive,
      footer: messages.image.footer,
      rows: imageRows,
      trendMax: getGuildTrendMax(analysis.members),
    });
    if (png === null) throw new Error('No 2D canvas');
    saveFile(png, getGuildExportFileName(workspace.name, today.toString(), 'png'));
  }

  /**
   * «Subir a {guild}» (10.4): every browser snapshot goes to the guild, except one whose date
   * the guild already has with the same digest; a different digest replaces the guild's and
   * the notice says so. What reached the guild leaves the browser.
   */
  async function uploadLocal() {
    if (client === null || guild === null || remote === null || uploading) return;
    const first = local.snapshots[0];
    if (!first) return;
    setUploading(true);
    try {
      const stored = await listGuildDailySnapshots(client, guild, {
        from: first.observationDate < remote.from ? first.observationDate : remote.from,
      });
      if (stored.error || stored.data === null) {
        setUploadLines([mapSupabaseError(stored.error ?? { code: null, network: false }, locale)]);
        return;
      }
      const digests = new Map(
        stored.data.map((snapshot) => [snapshot.observationDate, snapshot.payloadDigest]),
      );
      const imported: string[] = [];
      const replaced: string[] = [];
      const lines: string[] = [];
      const moved = new Set<string>();
      for (const snapshot of local.snapshots) {
        const digest = await exportDigest(snapshot);
        const existing = digests.get(snapshot.observationDate);
        if (existing === digest) {
          moved.add(snapshot.snapshotId);
          continue;
        }
        const saved = await replaceUserGuildDailyExport(client, {
          guildId: guild.guild_id,
          payload: snapshot.payload,
          payloadDigest: digest,
        });
        if (saved.error) {
          lines.push(
            fill(messages.importDialog.fileError, {
              file: fill(messages.importDialog.snapshotName, {
                date: dayMonth(snapshot.observationDate),
              }),
              message: remoteFailureText(saved.error),
            }),
          );
          continue;
        }
        if (existing !== undefined) replaced.push(snapshot.observationDate);
        imported.push(snapshot.observationDate);
        moved.add(snapshot.snapshotId);
      }
      const summary: string[] = [];
      if (imported.length) {
        summary.push(
          fill(messages.importDialog.imported, { dates: imported.map(dayMonth).join(', ') }),
        );
      }
      if (replaced.length) {
        summary.push(
          fill(messages.importDialog.replaced, { dates: replaced.map(dayMonth).join(', ') }),
        );
      }
      commitLocal({
        ...local,
        snapshots: local.snapshots.filter((snapshot) => !moved.has(snapshot.snapshotId)),
      });
      setUploadLines([...(summary.length ? [summary.join(' ')] : []), ...lines]);
      if (imported.length) setRefresh((value) => value + 1);
    } finally {
      setUploading(false);
    }
  }

  function retry() {
    setRemoteError(null);
    setErrorHidden(false);
    setAttempt((value) => value + 1);
  }

  function choosePeriod(next: GuildPeriod) {
    if (next === 'rango' && resolved !== null) {
      // «Rango» opens on the period on screen, written in its fields.
      const from = Temporal.PlainDate.from(resolved.start);
      const to = Temporal.PlainDate.from(resolved.end);
      setRange({ from: formatGuildDateInput(from), to: formatGuildDateInput(to) });
      setRangeDates({ from, to });
      setRangeInvalid({});
    }
    setPeriod(next);
  }

  function editRange(next: GuildRange) {
    setRange(next);
    if (today === null) return;
    const checked = validateGuildRange(next.from, next.to, today);
    if (checked.ok) {
      setRangeDates({ from: checked.from, to: checked.to });
      setRangeInvalid({});
    } else {
      setRangeInvalid(checked.invalid);
    }
  }

  // ------------------------------------------------------------------------ render

  const name = workspace?.name ?? null;
  const trail: BreadcrumbItem[] =
    name === null
      ? [{ label: breadcrumb.tools, href: breadcrumb.toolsHref }, { label: messages.title }]
      : [
          { label: breadcrumb.tools, href: breadcrumb.toolsHref },
          { label: messages.title, href: breadcrumb.guildHref },
          { label: name },
        ];

  const guildOptions =
    accountMode && guilds !== null && guilds.length > 1
      ? guilds.map((option) => ({
          value: option.guild_id,
          label: option.display_name?.trim() || option.guild_key,
        }))
      : [];

  const signInLink =
    !signedIn && client !== null && accountHref !== null ? (
      <p className="ac-guild__account">
        <TextLink href={accountHref}>{messages.signInHint}</TextLink>
      </p>
    ) : null;

  const notices: ReactNode[] = [];
  if (failed && !errorHidden) {
    notices.push(
      <Notice key="error" open closeLabel={ui.dismiss} onClose={() => setErrorHidden(true)}>
        {mapSupabaseError(remoteError, locale)} <Button onClick={retry}>{messages.retry}</Button>
      </Notice>,
    );
  }
  if (storageFull) {
    notices.push(
      <Notice key="storage" open closeLabel={ui.dismiss} onClose={() => setStorageFull(false)}>
        {messages.storageFull}
      </Notice>,
    );
  }
  const offerUpload =
    workspace?.kind === 'account' &&
    workspace.canEdit &&
    local.snapshots.length > 0 &&
    !uploadHidden;
  if (offerUpload && name !== null) {
    const count = local.snapshots.length;
    notices.push(
      <Notice key="upload" open closeLabel={ui.dismiss} onClose={() => setUploadHidden(true)}>
        {fill(plural(locale, count, messages.localSnapshots), { n: formatInteger(count, locale) })}{' '}
        <Button disabled={uploading} onClick={() => void uploadLocal()}>
          {fill(messages.upload, { guild: name })}
        </Button>
      </Notice>,
    );
  }
  if (uploadLines !== null && uploadLines.length > 0) {
    notices.push(
      <Notice key="uploaded" open closeLabel={ui.dismiss} onClose={() => setUploadLines(null)}>
        {uploadLines.map((line, index) => (
          <span key={index} className="ac-guild__line">
            {line}
          </span>
        ))}
      </Notice>,
    );
  }

  function openImport() {
    setImportOpen(true);
  }

  let body: ReactNode = null;
  if (loading) {
    body = (
      <p className="ac-guild__loading" role="status">
        {messages.loading}
      </p>
    );
  } else if (workspace !== null && workspace.snapshots.length === 0) {
    body = (
      <div className="ac-guild__top">
        {notices}
        <div className="ac-guild__empty">
          <EmptyState
            action={
              workspace.canEdit ? (
                <Button onClick={openImport}>{messages.emptyAction}</Button>
              ) : undefined
            }
          >
            {GUILD_EMPTY[locale]}
          </EmptyState>
          {workspace.canEdit ? <p className="ac-guild__hint">{messages.importHint}</p> : null}
          {signInLink}
        </div>
      </div>
    );
  } else if (workspace !== null && today !== null && analysis !== null && resolved !== null) {
    body = (
      <>
        <div className="ac-guild__top">
          {notices}
          <HeadRow
            locale={locale}
            messages={messages}
            workspace={workspace}
            head={analysis.head}
            today={today}
            worlds={worlds}
            signInLink={signInLink}
            onImport={openImport}
            onGoals={() => setGoalsOpen(true)}
          />
        </div>
        <GuildSummary
          locale={locale}
          messages={messages.summary}
          data={analysis.summary}
          filter={
            <PeriodFilter
              value={period}
              onChange={choosePeriod}
              range={range}
              onRangeChange={editRange}
              invalid={rangeInvalid}
              rangeText={periodText(
                period,
                resolved,
                workspace.snapshots,
                locale,
                messages.summary,
              )}
              labels={{
                group: messages.summary.period,
                today: messages.summary.periods.today,
                days7: messages.summary.periods.days7,
                days30: messages.summary.periods.days30,
                range: messages.summary.periods.range,
                from: messages.summary.from,
                to: messages.summary.to,
              }}
            />
          }
        />
        <GuildDays
          locale={locale}
          messages={messages}
          pinHint={ui.pinHint}
          days={analysis.days}
          scales={analysis.scales}
          tiers={workspace.settings.difficultyTiers}
          weeklyGoal={analysis.weeklyGoal}
        />
        <GuildWeeks locale={locale} messages={messages.weeks} data={analysis.weeks} />
        <GuildMembers
          locale={locale}
          messages={messages}
          ui={ui}
          rows={analysis.members}
          inactivityDays={analysis.inactivityDays}
          memberDetail={memberDetail}
          onExportCsv={exportCsv}
          onExportPng={exportPng}
          onSaveSplit={saveSplit}
          onResetSplit={resetSplit}
          noMatch={searchEmpty}
        />
      </>
    );
  } else if (notices.length > 0) {
    body = <div className="ac-guild__top">{notices}</div>;
  }

  const snapshotRows: GuildSnapshotRow[] = (workspace?.snapshots ?? []).map((snapshot) => ({
    observationDate: snapshot.observationDate,
    members: snapshot.payload.members.length,
  }));

  return (
    <>
      <Breadcrumb items={trail} ariaLabel={breadcrumb.label} />
      <div className="ac-guild">
        <div className="ac-guild__heading">
          <PageTitle title={name ?? messages.title} />
          {guildOptions.length > 0 && guildId !== null ? (
            <Select
              className="ac-guild__switch"
              label={messages.title}
              labelHidden
              options={guildOptions}
              value={guildId}
              width={240}
              onChange={(value) => setGuildId(value)}
            />
          ) : null}
        </div>
        <div className="ac-guild__region" aria-busy={body === null ? 'true' : undefined}>
          {body}
        </div>
      </div>
      {hydrated && workspace !== null && workspace.canEdit ? (
        <>
          <ImportDialog
            open={importOpen}
            onClose={() => setImportOpen(false)}
            locale={locale}
            messages={messages}
            ui={{ close: ui.close, dismiss: ui.dismiss }}
            onImport={importExports}
            snapshots={snapshotRows}
            onDelete={deleteSnapshot}
          />
          <GoalsDialog
            open={goalsOpen}
            onClose={() => setGoalsOpen(false)}
            locale={locale}
            messages={messages}
            ui={{
              close: ui.close,
              dismiss: ui.dismiss,
              decrease: ui.decrease,
              increase: ui.increase,
            }}
            settings={workspace.settings}
            onSave={saveSettings}
          />
        </>
      ) : null}
    </>
  );
}

/**
 * The period written out next to the filter (DS:PeriodFilter): «12/09 a 18/09»; «Hoy, 18/09
 * hasta las 14:32 (hora de Brasilia)», with the time of the last export of D; «01/09 a 18/09,
 * 18 días».
 */
function periodText(
  period: GuildPeriod,
  resolved: GuildResolvedPeriod,
  snapshots: GuildDailySnapshot[],
  locale: Locale,
  messages: Messages['guild']['summary'],
): string {
  const range = formatDateRange(isoDay(resolved.start), isoDay(resolved.end), locale, 'UTC');
  if (period === 'rango') {
    return fill(messages.rangeDays, { range, n: formatInteger(resolved.days, locale) });
  }
  if (period !== 'hoy') return range;
  const date = formatDayMonth(isoDay(resolved.end), locale, 'UTC');
  const last = snapshots.findLast((snapshot) => snapshot.observationDate === resolved.end);
  const instant = last ? parseGuildExportedAt(last.payload.exportedAt, last.sourceTimeZone) : null;
  if (instant === null) return date;
  return fill(messages.today, { date, time: formatTime(instant.epochMilliseconds, locale) });
}

interface HeadRowProps {
  locale: Locale;
  messages: GuildRootProps['messages'];
  workspace: Workspace;
  /** From `getGuildHead`; null without an export dated on or before D. */
  head: GuildHead | null;
  today: Temporal.PlainDate;
  worlds: GuildRootProps['worlds'];
  signInLink: ReactNode;
  onImport: () => void;
  onGoals: () => void;
}

/** The data row of 10.5 step 3 and, on the right, «Importar export» and «Metas». */
function HeadRow({
  locale,
  messages,
  workspace,
  head,
  today,
  worlds,
  signInLink,
  onImport,
  onGoals,
}: HeadRowProps) {
  const text = messages.head;
  const week = head?.week ?? getGuildWeekOf(today);
  const exportedAt = head?.lastExport.exportedAt ?? null;
  const access =
    workspace.kind === 'local'
      ? text.accessLocal
      : workspace.access === null
        ? UNKNOWN
        : fill(plural(locale, workspace.access.officers, text.accessAccount), {
            n: formatInteger(workspace.access.officers, locale),
          });

  const lines: FactLineData[] = [];
  if (workspace.guild !== null) {
    const worldKey = workspace.guild.world_key;
    lines.push({
      key: 'world',
      label: text.world,
      values: [worlds.find((world) => world.id === worldKey)?.nombre ?? UNKNOWN],
    });
  }
  lines.push(
    {
      key: 'members',
      label: text.members,
      values: [head ? formatInteger(head.members, locale) : UNKNOWN],
    },
    {
      key: 'export',
      label: text.lastExport,
      values: [exportedAt ? formatServerTime(exportedAt, locale) : UNKNOWN],
    },
    {
      key: 'week',
      label: text.week,
      values: [
        fill(text.weekValue, {
          range: formatDateRange(isoDay(week.start), isoDay(week.end), locale, 'UTC'),
          k: formatInteger(week.day, locale),
        }),
      ],
    },
    { key: 'access', label: text.access, values: [access] },
  );

  return (
    <div className="ac-guild-head">
      <div className="ac-guild-head__facts">
        <FactLines lines={lines} />
        {workspace.kind === 'local' ? signInLink : null}
      </div>
      {workspace.canEdit ? (
        <div className="ac-guild-head__actions">
          <div className="ac-guild-head__buttons">
            <Button onClick={onImport}>{messages.import}</Button>
            <Button onClick={onGoals}>{messages.goals}</Button>
          </div>
          <p className="ac-guild__hint">{messages.importHint}</p>
        </div>
      ) : null}
    </div>
  );
}
