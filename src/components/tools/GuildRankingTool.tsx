import { useEffect, useMemo, useRef, useState } from 'react';
import {
  calculateGuildDailyHistory,
  createGuildDailySnapshot,
  replaceGuildDailySnapshot,
  summarizeGuildMemberWeek,
  summarizeGuildDailyHistory,
  type GuildDailySnapshot,
} from '@/lib/tools/guild-daily-history';
import {
  DEFAULT_GUILD_DIFFICULTY_TIERS,
  emptyGuildDifficultyAllocation,
  isValidGuildDifficultyAllocation,
  pointsForGuildDifficultyAllocation,
  sumGuildDifficultyAllocation,
  type GuildDifficulty,
  type GuildDifficultyAllocation,
  type GuildDifficultyPolicy,
  type GuildDifficultyTier,
  type GuildDifficultyTransition,
} from '@/lib/tools/guild-difficulty';
import {
  buildGuildDiscordText,
  buildGuildWhatsAppText,
  calculateGuildRanking,
  DEFAULT_GUILD_PACING,
  formatGuildNumber,
  formatGuildRank,
  getGuildDerivedContributionPerDay,
  GUILD_DAILY_VALUE_TIERS,
  getGuildMemberBand,
  parseGuildExportText,
  sortGuildMembers,
  type GuildPacingSettings,
  type GuildGoalMetric,
  type GuildGoalSet,
  type GuildGoalTarget,
  type GuildDiscordHistorySummary,
  type GuildExportPayload,
  type GuildRanking,
  type GuildSortDirection,
  type GuildSortKey,
} from '@/lib/tools/guild-ranking';
import { createGuildRankingPng } from '@/lib/tools/guild-ranking-image';
import { SERVER_SAVE_ZONE } from '@/lib/time/server-save';
import { GuildPersistencePanel } from './GuildPersistencePanel';

type Locale = 'es' | 'en';

type Props = {
  locale: Locale;
};

type GoalKind = 'standard' | 'premium';
type GoalPeriod = 'daily' | 'weekly';
type GoalDraft = Record<GoalKind, Record<GuildGoalMetric, Record<GoalPeriod, string>>>;
type PendingCalculation = {
  snapshot: GuildDailySnapshot;
  replacesExisting: boolean;
};

type DifficultyDraft = GuildDifficultyAllocation;

const GOAL_METRICS: GuildGoalMetric[] = ['totalPoints', 'dailies', 'contribution'];
const GOAL_PERIODS: GoalPeriod[] = ['daily', 'weekly'];

function createGoalDraft(settings: GuildPacingSettings): GoalDraft {
  return {
    standard: createGoalSetDraft(settings.standard),
    premium: createGoalSetDraft(settings.premium),
  };
}

function createGoalSetDraft(
  goals: GuildGoalSet,
): Record<GuildGoalMetric, Record<GoalPeriod, string>> {
  return Object.fromEntries(
    GOAL_METRICS.map((metric) => [
      metric,
      {
        daily: goals[metric].daily === null ? '' : String(goals[metric].daily),
        weekly: goals[metric].weekly === null ? '' : String(goals[metric].weekly),
      },
    ]),
  ) as Record<GuildGoalMetric, Record<GoalPeriod, string>>;
}

function normalizeGuildMemberKey(value: string): string {
  return value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase();
}

function difficultyOverrideKey(observationDate: string, memberName: string): string {
  return `${observationDate}:${normalizeGuildMemberKey(memberName)}`;
}

const copy = {
  es: {
    eyebrow: 'Herramienta de comunidad',
    title: 'Ranking de guild',
    intro:
      'Carga el JSON exportado por el cliente para ver la semana actual, separar dailies y donaciones, y compartir un resumen completo.',
    importTitle: 'Cargar exportación',
    importDescription:
      'El archivo se procesa localmente. Primero se prepara una vista previa; el historial solo cambia cuando confirmas el cálculo.',
    chooseFile: 'Seleccionar JSON(s)',
    paste: 'O pega aquí el contenido del JSON',
    pastePlaceholder: '{ "members": [...], "guild": "..." }',
    load: 'Cargar datos',
    clear: 'Limpiar',
    settingsTitle: 'Metas y valores',
    settingsDescription:
      'Los puntos de cada daily se calculan automáticamente con el nivel del jugador. Deja una casilla vacía para no activar esa meta; si completas día y semana, se comprueban ambas.',
    valueRules: 'Valor automático de cada daily',
    valueRulesDetail: 'Normal 0–149: 150 · Wildscape 150–349: 300 · Primal 350+: 600',
    difficultyTitle: 'Dificultad de las dailies',
    difficultyDescription:
      'El nivel define la dificultad por defecto. Si un jugador cambia de rango durante la semana, el reparto se marca como estimado hasta que lo revises.',
    difficultyPolicy: 'Cambios de nivel',
    difficultyPolicyCurrent: 'Estimar con la dificultad actual',
    difficultyPolicyPrevious: 'Estimar con la dificultad anterior',
    difficultyPolicyReview: 'Marcar para revisar',
    difficultyPoints: 'Puntos por daily',
    difficultyRange: 'Rango de nivel',
    difficultyActions: 'Acciones',
    difficultyBreakdown: 'Desglose',
    difficultyAutomatic: 'Automático',
    difficultyEstimated: 'Estimado',
    difficultyExact: 'Calculado',
    difficultyManual: 'Corrección manual',
    difficultyEditorTitle: 'Reparto de dailies',
    difficultyEditorHelp:
      'El total debe coincidir con las dailies de este intervalo. El JSON no conserva la hora de cada task, por eso los cambios de nivel son estimaciones.',
    difficultyTotal: 'Dailies asignadas',
    difficultySave: 'Guardar desglose',
    difficultyCancel: 'Cancelar',
    difficultyReset: 'Volver a automático',
    difficultySaved: 'Desglose manual guardado para este día.',
    difficultyInvalid: 'La suma debe coincidir con las dailies del intervalo.',
    standardGoals: 'Metas normales',
    premiumGoals: 'Metas premium',
    totalGoal: 'Puntos totales',
    dailiesGoal: 'Dailies',
    contributionGoal: 'Contribución (dinero)',
    dailyPeriod: 'Por día',
    weeklyPeriod: 'Por semana',
    goalEmpty: 'Vacío = desactivada',
    derivedContribution: 'Contribución calculada',
    derivedContributionHelp:
      'Cuando existe una meta de puntos totales y una meta de dailies, la parte restante se calcula por nivel. No es un valor global.',
    derivedContributionNone: 'Se mostrará al activar metas de puntos totales y dailies.',
    sourceZone: 'Zona horaria del export',
    sourceZoneHelp: 'Se usa cuando exportedAt no trae offset horario.',
    serverSaveZone: 'Server Save BR',
    calculate: 'Recalcular con estas metas',
    recalculate: 'Recalcular cálculo',
    addCalculation: 'Añadir cálculo de',
    updateCalculation: 'Actualizar cálculo de',
    addedCalculation: 'Cálculo añadido al historial.',
    updatedCalculation: 'Cálculo actualizado. Se recalcularon los deltas de la semana.',
    readyToAdd: 'Registro listo para añadir al historial.',
    readyToUpdate: 'Registro listo para actualizar el historial.',
    source: 'Ciclo calculado desde exportedAt y el Server Save canónico.',
    week: 'Semana',
    day: 'Día de control',
    elapsed: 'Días transcurridos',
    remaining: 'Días restantes',
    members: 'Miembros',
    totalPoints: 'Puntos totales',
    totalContribution: 'Donación total',
    expected: 'Meta acumulada hoy',
    premium: 'Premium',
    ranking: 'Clasificación',
    name: 'Nombre',
    rank: 'Rango',
    level: 'Nivel',
    lastLogin: 'Último acceso',
    contribution: 'Contribución',
    dailies: 'Dailies',
    dailyPoints: 'Pts. dailies',
    total: 'Total',
    online: 'En línea',
    noRecord: 'Sin registro',
    exportTitle: 'Exportar datos',
    exportDescription:
      'WhatsApp incluye el detalle completo. Discord usa Markdown y se divide en bloques cuando el ranking supera el límite de un mensaje.',
    copyWhatsApp: 'Copiar resumen para WhatsApp',
    copyDiscord: 'Copiar anuncio para Discord',
    downloadPng: 'Descargar imagen PNG',
    copiedWhatsApp: 'Resumen en español copiado para WhatsApp.',
    copiedDiscord: 'Anuncio Markdown copiado para Discord. Se separa en bloques si hace falta.',
    imageReady: 'Imagen PNG generada con la contribución incluida.',
    emptyTitle: 'Todavía no hay una guild cargada',
    emptyDescription: 'Selecciona el JSON exportado por el cliente o pégalo en el campo anterior.',
    historyTitle: 'Historial de snapshots',
    historyDescription:
      'Una fecha admite un solo export. Si vuelves a cargarla, el registro se reemplaza y se recalculan los deltas de esa semana.',
    historyStatus: 'Histórico cargado',
    historyPreview: 'Vista previa pendiente',
    historyPending: 'Pendiente de confirmar',
    historyDate: 'Fecha',
    historyDailies: 'Dailies del día',
    historyContribution: 'Contribución del día',
    historyPoints: 'Puntos del día',
    historyDailyPoints: 'Puntos por dailies',
    historyCumulativeDailies: 'Dailies acumuladas',
    historyCumulativeContribution: 'Contribución acumulada',
    historyCumulativePoints: 'Puntos acumulados',
    historyBaseline: 'Base de semana',
    historyDelta: 'Delta calculado',
    historyDecrease: 'Disminución detectada',
    calculationTitle: 'Control del cálculo',
    calculationNew: 'Nuevo registro',
    calculationReplace: 'Reemplazo de registro',
    calculationNewHelp:
      'Este día todavía no existe en el histórico. Al confirmar, se añadirá como una nueva observación.',
    calculationReplaceHelp:
      'Ya existe un registro para este día. Al confirmar, se reemplazará y se recalculará el delta de la semana.',
    calculationCurrentHelp:
      'El día ya está en el histórico. Puedes aplicar cambios de metas y recalcularlo.',
    historyOverviewTitle: 'Resumen del histórico',
    historyOverviewDescription:
      'Las cifras usan únicamente los snapshots cargados. El primer export de cada semana es una base acumulada; los siguientes se calculan como delta.',
    records: 'Registros',
    weeksCovered: 'Semanas',
    monthsCovered: 'Meses',
    period: 'Periodo',
    currentWeek: 'Semana actual',
    currentMonth: 'Mes actual',
    observedDays: 'días observados',
    complete: 'Completa',
    inProgress: 'En curso',
    noRange: 'Sin rango',
    weeks: 'Semanas cargadas',
    months: 'Meses cargados',
    activityTitle: 'Actividad de miembros',
    activityDescription:
      'Compara cada export con el anterior para registrar niveles, altas, bajas y reingresos. Las metas se ajustan a los días en que cada miembro ya puede participar.',
    levelsGained: 'Niveles ganados',
    membersJoined: 'Altas y reingresos',
    membersLeft: 'Bajas observadas',
    waitingMembers: 'Con acceso pendiente',
    noMembershipChanges: 'No hay movimientos de miembros en los snapshots de esta semana.',
    joined: 'Alta observada',
    returned: 'Reingreso observado',
    left: 'Baja observada',
    observedInterval: 'Detectado al comparar snapshots',
    baselineMembership:
      'Los miembros del primer snapshot se consideran anteriores al histórico. No se inventa su fecha de ingreso y sus metas conservan el ciclo completo.',
    memberProgress: 'Progreso y acceso',
    noLevelChange: 'Sin cambio de nivel',
    dailiesFrom: 'Dailies desde',
    contributionFrom: 'Donación desde',
    fullAccess: 'Dailies y donación habilitadas',
    previousAccess: 'Miembro previo al histórico',
    eligibilityAdjusted: 'Meta ajustada a días habilitados',
    errors: {
      invalid_json: 'El contenido no es un JSON válido.',
      invalid_root: 'El JSON debe contener un objeto principal.',
      members_missing: 'El JSON no contiene una lista members válida.',
      member_name_missing: 'Cada miembro debe tener un nombre.',
      member_number_invalid: 'Hay un nivel, daily o contribución con valor inválido.',
      duplicate_member: 'Hay dos miembros con el mismo nombre normalizado.',
    },
  },
  en: {
    eyebrow: 'Community tool',
    title: 'Guild ranking',
    intro:
      'Load the client export to see the current week, separate dailies from donations and share a complete summary.',
    importTitle: 'Load export',
    importDescription:
      'The file is processed locally. A preview is prepared first; history changes only when you confirm the calculation.',
    chooseFile: 'Choose JSON file(s)',
    paste: 'Or paste the JSON contents here',
    pastePlaceholder: '{ "members": [...], "guild": "..." }',
    load: 'Load data',
    clear: 'Clear',
    settingsTitle: 'Goals and values',
    settingsDescription:
      'Daily points are calculated automatically from each player level. Leave a cell empty to disable that goal; filling both day and week checks both targets.',
    valueRules: 'Automatic daily value',
    valueRulesDetail: 'Normal 0–149: 150 · Wildscape 150–349: 300 · Primal 350+: 600',
    difficultyTitle: 'Daily difficulty',
    difficultyDescription:
      'Level sets the default difficulty. If a player crosses a tier during the week, the split stays estimated until you review it.',
    difficultyPolicy: 'Level changes',
    difficultyPolicyCurrent: 'Estimate with the current difficulty',
    difficultyPolicyPrevious: 'Estimate with the previous difficulty',
    difficultyPolicyReview: 'Flag for review',
    difficultyPoints: 'Points per daily',
    difficultyRange: 'Level range',
    difficultyActions: 'Actions',
    difficultyBreakdown: 'Breakdown',
    difficultyAutomatic: 'Automatic',
    difficultyEstimated: 'Estimated',
    difficultyExact: 'Calculated',
    difficultyManual: 'Manual correction',
    difficultyEditorTitle: 'Daily breakdown',
    difficultyEditorHelp:
      'The total must match the dailies in this interval. The JSON has no timestamp per task, so level changes are estimates.',
    difficultyTotal: 'Assigned dailies',
    difficultySave: 'Save breakdown',
    difficultyCancel: 'Cancel',
    difficultyReset: 'Return to automatic',
    difficultySaved: 'Manual breakdown saved for this date.',
    difficultyInvalid: 'The sum must match the dailies in this interval.',
    standardGoals: 'Standard goals',
    premiumGoals: 'Premium goals',
    totalGoal: 'Total points',
    dailiesGoal: 'Dailies',
    contributionGoal: 'Contribution (money)',
    dailyPeriod: 'Per day',
    weeklyPeriod: 'Per week',
    goalEmpty: 'Empty = disabled',
    derivedContribution: 'Calculated contribution',
    derivedContributionHelp:
      'When total-points and dailies goals exist, the remaining amount is calculated by level. It is not one global value.',
    derivedContributionNone: 'It appears after total-points and dailies goals are enabled.',
    sourceZone: 'Export time zone',
    sourceZoneHelp: 'Used when exportedAt has no time-zone offset.',
    serverSaveZone: 'BR Server Save',
    calculate: 'Recalculate with these goals',
    recalculate: 'Recalculate calculation',
    addCalculation: 'Add calculation for',
    updateCalculation: 'Update calculation for',
    addedCalculation: 'Calculation added to history.',
    updatedCalculation: 'Calculation updated. Weekly deltas were recalculated.',
    readyToAdd: 'Record ready to add to history.',
    readyToUpdate: 'Record ready to update history.',
    source: 'Cycle calculated from exportedAt and the canonical Server Save.',
    week: 'Week',
    day: 'Control day',
    elapsed: 'Days elapsed',
    remaining: 'Days remaining',
    members: 'Members',
    totalPoints: 'Total points',
    totalContribution: 'Total donation',
    expected: 'Accumulated goal today',
    premium: 'Premium',
    ranking: 'Ranking',
    name: 'Name',
    rank: 'Rank',
    level: 'Level',
    lastLogin: 'Last access',
    contribution: 'Contribution',
    dailies: 'Dailies',
    dailyPoints: 'Daily pts.',
    total: 'Total',
    online: 'Online',
    noRecord: 'No record',
    exportTitle: 'Export data',
    exportDescription:
      'WhatsApp includes the full detail. Discord uses Markdown and splits into blocks when the ranking exceeds one message.',
    copyWhatsApp: 'Copy WhatsApp summary',
    copyDiscord: 'Copy Discord announcement',
    downloadPng: 'Download PNG image',
    copiedWhatsApp: 'Summary copied for WhatsApp.',
    copiedDiscord: 'Markdown announcement copied for Discord. It is split into blocks when needed.',
    imageReady: 'PNG image generated with contribution included.',
    emptyTitle: 'No guild loaded yet',
    emptyDescription: 'Choose the JSON exported by the client or paste it above.',
    historyTitle: 'Snapshot history',
    historyDescription:
      'Each date accepts one export. Loading it again replaces the record and recalculates that week’s deltas.',
    historyStatus: 'History loaded',
    historyPreview: 'Pending preview',
    historyPending: 'Pending confirmation',
    historyDate: 'Date',
    historyDailies: 'Daily dailies',
    historyContribution: 'Daily contribution',
    historyPoints: 'Daily points',
    historyDailyPoints: 'Daily points from dailies',
    historyCumulativeDailies: 'Cumulative dailies',
    historyCumulativeContribution: 'Cumulative contribution',
    historyCumulativePoints: 'Cumulative points',
    historyBaseline: 'Week baseline',
    historyDelta: 'Calculated delta',
    historyDecrease: 'Decrease detected',
    calculationTitle: 'Calculation control',
    calculationNew: 'New record',
    calculationReplace: 'Record replacement',
    calculationNewHelp:
      'This date is not in the history yet. Confirming will add it as a new observation.',
    calculationReplaceHelp:
      'A record already exists for this date. Confirming will replace it and recalculate the week delta.',
    calculationCurrentHelp:
      'This date is already in the history. You can apply goal changes and recalculate it.',
    historyOverviewTitle: 'History overview',
    historyOverviewDescription:
      'These figures use only loaded snapshots. The first export of each week is a cumulative baseline; later exports are calculated as deltas.',
    records: 'Records',
    weeksCovered: 'Weeks',
    monthsCovered: 'Months',
    period: 'Period',
    currentWeek: 'Current week',
    currentMonth: 'Current month',
    observedDays: 'days observed',
    complete: 'Complete',
    inProgress: 'In progress',
    noRange: 'No range',
    weeks: 'Loaded weeks',
    months: 'Loaded months',
    activityTitle: 'Member activity',
    activityDescription:
      'Each export is compared with the previous one to record levels, joins, departures and returns. Goals are adjusted to the days each member is allowed to participate.',
    levelsGained: 'Levels gained',
    membersJoined: 'Joins and returns',
    membersLeft: 'Observed departures',
    waitingMembers: 'Waiting for access',
    noMembershipChanges: 'No member changes appear in this week’s loaded snapshots.',
    joined: 'Observed join',
    returned: 'Observed return',
    left: 'Observed departure',
    observedInterval: 'Detected by comparing snapshots',
    baselineMembership:
      'Members in the first snapshot predate this history. No join date is invented, and their goals retain the full cycle.',
    memberProgress: 'Progress and access',
    noLevelChange: 'No level change',
    dailiesFrom: 'Dailies from',
    contributionFrom: 'Contribution from',
    fullAccess: 'Dailies and contribution enabled',
    previousAccess: 'Member predates history',
    eligibilityAdjusted: 'Goal adjusted to eligible days',
    errors: {
      invalid_json: 'The contents are not valid JSON.',
      invalid_root: 'The JSON must contain a root object.',
      members_missing: 'The JSON does not contain a valid members list.',
      member_name_missing: 'Every member must have a name.',
      member_number_invalid: 'A level, daily or contribution value is invalid.',
      duplicate_member: 'Two members have the same normalized name.',
    },
  },
} as const;

const TIME_ZONE_OPTIONS = [SERVER_SAVE_ZONE, 'America/Mexico_City', 'UTC'];

function formatSourceDate(value: string | null | undefined): string {
  if (!value) return '—';
  const match = value.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  return match ? `${match[3].padStart(2, '0')}/${match[2].padStart(2, '0')}/${match[1]}` : value;
}

function formatGuildDay(value: string | null | undefined, locale: Locale): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-MX' : 'en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${value}T12:00:00Z`));
}

function formatNullableGuildNumber(value: number | null): string {
  return value === null ? '—' : formatGuildNumber(value);
}

function goalMetricLabel(
  metric: GuildGoalMetric,
  strings: { totalGoal: string; dailiesGoal: string; contributionGoal: string },
): string {
  return metric === 'totalPoints'
    ? strings.totalGoal
    : metric === 'dailies'
      ? strings.dailiesGoal
      : strings.contributionGoal;
}

export function GuildRankingTool({ locale }: Props) {
  const strings = copy[locale];
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [jsonText, setJsonText] = useState('');
  const [fileName, setFileName] = useState('');
  const [dailySnapshots, setDailySnapshots] = useState<GuildDailySnapshot[]>([]);
  const [pendingSnapshots, setPendingSnapshots] = useState<GuildDailySnapshot[]>([]);
  const [pendingCalculation, setPendingCalculation] = useState<PendingCalculation | null>(null);
  const [sourceTimeZone, setSourceTimeZone] = useState(SERVER_SAVE_ZONE);
  const [payload, setPayload] = useState<GuildExportPayload | undefined>();
  const [settings, setSettings] = useState<GuildPacingSettings>(DEFAULT_GUILD_PACING);
  const [draft, setDraft] = useState<GoalDraft>(() => createGoalDraft(DEFAULT_GUILD_PACING));
  const [difficultyTiers, setDifficultyTiers] = useState<GuildDifficultyTier[]>(() =>
    DEFAULT_GUILD_DIFFICULTY_TIERS.map((tier) => ({ ...tier })),
  );
  const [transitionPolicy, setTransitionPolicy] = useState<GuildDifficultyPolicy>('current');
  const [difficultyOverrides, setDifficultyOverrides] = useState<
    Record<string, GuildDifficultyAllocation | undefined>
  >({});
  const [activeDifficultyKey, setActiveDifficultyKey] = useState<string | null>(null);
  const [difficultyDraft, setDifficultyDraft] = useState<DifficultyDraft>(() =>
    emptyGuildDifficultyAllocation(),
  );
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [sortKey, setSortKey] = useState<GuildSortKey>('total');
  const [sortDirection, setSortDirection] = useState<GuildSortDirection>('desc');

  useEffect(() => {
    setHydrated(true);
  }, []);

  const baseRanking = useMemo<GuildRanking | null>(
    () =>
      payload
        ? calculateGuildRanking(payload, settings, sourceTimeZone, {
            difficultyTiers,
            difficultyOverrides,
          })
        : null,
    [difficultyOverrides, difficultyTiers, payload, settings, sourceTimeZone],
  );
  const analysisSnapshots = useMemo(() => {
    let merged = dailySnapshots;
    for (const snapshot of pendingSnapshots) {
      merged = replaceGuildDailySnapshot(merged, snapshot);
    }
    return merged;
  }, [dailySnapshots, pendingSnapshots]);
  const dailyHistory = useMemo(
    () =>
      calculateGuildDailyHistory(analysisSnapshots, settings, sourceTimeZone, {
        difficultyTiers,
        transitionPolicy,
        difficultyOverrides,
      }),
    [
      analysisSnapshots,
      difficultyOverrides,
      difficultyTiers,
      settings,
      sourceTimeZone,
      transitionPolicy,
    ],
  );
  const historyOverview = useMemo(() => summarizeGuildDailyHistory(dailyHistory), [dailyHistory]);
  const dailySummaries = useMemo(
    () => dailyHistory.weeks.flatMap((week) => week.summaries),
    [dailyHistory],
  );
  const discordHistory = useMemo<GuildDiscordHistorySummary[]>(
    () =>
      dailySummaries.map((summary) => ({
        observationDate: summary.snapshot.observationDate,
        weekStartDate: summary.snapshot.weekStartDate,
        dayIndex: summary.snapshot.dayIndex,
        dailyDailies: summary.dailyDailies,
        dailyContribution: summary.dailyContribution,
        dailyPoints: summary.dailyPoints,
        levelsGained: summary.levelsGained,
        membersJoined: summary.membershipEvents.filter(
          (event) => event.kind === 'joined' || event.kind === 'returned',
        ).length,
        membersLeft: summary.membershipEvents.filter((event) => event.kind === 'left').length,
      })),
    [dailySummaries],
  );
  const activeObservationDate =
    pendingCalculation?.snapshot.observationDate ??
    baseRanking?.week.sourceLocalDateTime.slice(0, 10) ??
    null;
  const activeDifficultySummary = useMemo(
    () =>
      dailySummaries.find((summary) => summary.snapshot.observationDate === activeObservationDate),
    [activeObservationDate, dailySummaries],
  );
  const memberWeekActivity = useMemo(
    () =>
      baseRanking
        ? summarizeGuildMemberWeek(
            dailyHistory,
            baseRanking.week.weekStartDate,
            activeObservationDate,
          )
        : [],
    [activeObservationDate, baseRanking, dailyHistory],
  );
  const memberActivityByKey = useMemo(
    () => new Map(memberWeekActivity.map((member) => [member.memberKey, member])),
    [memberWeekActivity],
  );
  const ranking = useMemo<GuildRanking | null>(() => {
    if (!baseRanking) return null;
    const summaries =
      dailyHistory.weeks
        .find((week) => week.weekStartDate === baseRanking.week.weekStartDate)
        ?.summaries.filter(
          (summary) =>
            !activeObservationDate || summary.snapshot.observationDate <= activeObservationDate,
        ) ?? [];
    const aggregateByMember = new Map<
      string,
      {
        dailyPoints: number;
        allocation: GuildDifficultyAllocation;
        confidence: 'estimated' | 'exact' | 'manual';
        transition: GuildDifficultyTransition | null;
      }
    >();
    for (const summary of summaries) {
      for (const delta of summary.memberDeltas) {
        const previous = aggregateByMember.get(delta.memberKey) ?? {
          dailyPoints: 0,
          allocation: emptyGuildDifficultyAllocation(),
          confidence: 'exact' as const,
          transition: null,
        };
        previous.dailyPoints += delta.dailyPoints;
        previous.allocation.normal += delta.difficultyAllocation.normal;
        previous.allocation.wildscape += delta.difficultyAllocation.wildscape;
        previous.allocation.primal += delta.difficultyAllocation.primal;
        if (delta.difficultyConfidence === 'manual') previous.confidence = 'manual';
        else if (delta.difficultyConfidence === 'estimated' && previous.confidence !== 'manual') {
          previous.confidence = 'estimated';
        }
        previous.transition ??= delta.difficultyTransition;
        aggregateByMember.set(delta.memberKey, previous);
      }
    }
    const members = baseRanking.members
      .map((member) => {
        const memberKey = normalizeGuildMemberKey(member.name);
        const aggregate = aggregateByMember.get(memberKey);
        const activity = memberActivityByKey.get(memberKey);
        const lifecycle = activity
          ? {
              levelsGained: activity.levelsGained,
              goalPacing: {
                totalPoints: activity.eligibleDailyDays,
                dailies: activity.eligibleDailyDays,
                contribution: activity.eligibleContributionDays,
              },
            }
          : {};
        if (!aggregate) return { ...member, ...lifecycle };
        return {
          ...member,
          ...lifecycle,
          dailyPoints: aggregate.dailyPoints,
          difficultyAllocation: aggregate.allocation,
          difficultyConfidence: aggregate.confidence,
          difficultyTransition: aggregate.transition,
          total: aggregate.dailyPoints + member.contribution,
        };
      })
      .sort(
        (a, b) =>
          b.total - a.total || b.contribution - a.contribution || a.name.localeCompare(b.name),
      );
    members.forEach((member, index) => {
      member.position = index + 1;
    });
    return {
      ...baseRanking,
      members,
      totalPoints: members.reduce((total, member) => total + member.total, 0),
      totalDailyPoints: members.reduce((total, member) => total + member.dailyPoints, 0),
    };
  }, [activeObservationDate, baseRanking, dailyHistory, difficultyOverrides, memberActivityByKey]);
  const activeMembershipEvents = useMemo(
    () =>
      baseRanking
        ? (dailyHistory.weeks
            .find((week) => week.weekStartDate === baseRanking.week.weekStartDate)
            ?.summaries.filter(
              (summary) =>
                !activeObservationDate || summary.snapshot.observationDate <= activeObservationDate,
            )
            .flatMap((summary) => summary.membershipEvents)
            .sort((a, b) => b.observationDate.localeCompare(a.observationDate)) ?? [])
        : [],
    [activeObservationDate, baseRanking, dailyHistory],
  );
  const currentWeekLevelsGained = memberWeekActivity.reduce(
    (total, member) => total + member.levelsGained,
    0,
  );
  const waitingMemberCount = memberWeekActivity.filter(
    (member) =>
      member.dailyEligibility === 'waiting' || member.contributionEligibility === 'waiting',
  ).length;
  const joinedMemberCount = activeMembershipEvents.filter(
    (event) => event.kind === 'joined' || event.kind === 'returned',
  ).length;
  const leftMemberCount = activeMembershipEvents.filter((event) => event.kind === 'left').length;
  const sortedMembers = useMemo(
    () => (ranking ? sortGuildMembers(ranking.members, sortKey, sortDirection) : []),
    [ranking, sortDirection, sortKey],
  );
  const activeDayLabel = formatGuildDay(activeObservationDate, locale);
  const recordsCountLabel = `${historyOverview.snapshotCount} ${historyOverview.snapshotCount === 1 ? (locale === 'es' ? 'registro' : 'record') : strings.records.toLowerCase()}`;
  const weeksCountLabel = `${historyOverview.weekCount} ${historyOverview.weekCount === 1 ? (locale === 'es' ? 'semana' : 'week') : locale === 'es' ? 'semanas' : 'weeks'}`;
  const monthsCountLabel = `${historyOverview.monthCount} ${historyOverview.monthCount === 1 ? (locale === 'es' ? 'mes' : 'month') : locale === 'es' ? 'meses' : 'months'}`;
  const calculationActionLabel = pendingCalculation
    ? `${pendingCalculation.replacesExisting ? strings.updateCalculation : strings.addCalculation} ${activeDayLabel}`
    : settingsDirty
      ? strings.recalculate
      : strings.calculate;

  function mergeRemoteHistory(remoteSnapshots: GuildDailySnapshot[]) {
    if (!remoteSnapshots.length) return;

    setDailySnapshots((current) => {
      let merged = current;
      for (const snapshot of remoteSnapshots) {
        merged = replaceGuildDailySnapshot(merged, snapshot);
      }
      return merged;
    });
    setPendingSnapshots([]);
    setPendingCalculation(null);

    const latestSnapshot = [...remoteSnapshots]
      .sort((a, b) => a.observationDate.localeCompare(b.observationDate))
      .at(-1);
    setPayload((current) => current ?? latestSnapshot?.payload);
    setJsonText((current) => current || JSON.stringify(latestSnapshot?.payload ?? {}, null, 2));
  }

  function parseDraftNumber(value: string, allowDecimal: boolean): number | null {
    const normalized = value.replace(',', '.').trim();
    if (!normalized) return null;
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed) || parsed < 0) return null;
    return allowDecimal ? parsed : Math.round(parsed);
  }

  function readGoalTarget(
    target: Record<GoalPeriod, string>,
    metric: GuildGoalMetric,
  ): GuildGoalTarget {
    const allowDecimal = metric !== 'dailies';
    return {
      daily: parseDraftNumber(target.daily, allowDecimal),
      weekly: parseDraftNumber(target.weekly, allowDecimal),
    };
  }

  function readGoalSet(kind: GoalKind): GuildGoalSet {
    return {
      totalPoints: readGoalTarget(draft[kind].totalPoints, 'totalPoints'),
      dailies: readGoalTarget(draft[kind].dailies, 'dailies'),
      contribution: readGoalTarget(draft[kind].contribution, 'contribution'),
    };
  }

  function updateGoalDraft(
    kind: GoalKind,
    metric: GuildGoalMetric,
    period: GoalPeriod,
    value: string,
  ) {
    setDraft((current) => ({
      ...current,
      [kind]: {
        ...current[kind],
        [metric]: {
          ...current[kind][metric],
          [period]: value,
        },
      },
    }));
    setSettingsDirty(true);
  }

  function updateDifficultyPoints(difficulty: GuildDifficulty, value: string) {
    const parsed = Number(value.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed < 0) return;
    setDifficultyTiers((current) =>
      current.map((tier) => (tier.difficulty === difficulty ? { ...tier, points: parsed } : tier)),
    );
    setSettingsDirty(true);
  }

  function updateCalculation() {
    const nextSettings = { standard: readGoalSet('standard'), premium: readGoalSet('premium') };
    setSettings(nextSettings);
    if (pendingSnapshots.length) {
      setDailySnapshots((current) => {
        let next = current;
        for (const snapshot of pendingSnapshots) {
          next = replaceGuildDailySnapshot(next, snapshot);
        }
        return next;
      });
      setNotice(
        pendingCalculation?.replacesExisting
          ? strings.updatedCalculation
          : strings.addedCalculation,
      );
      setPendingSnapshots([]);
      setPendingCalculation(null);
    } else {
      setNotice(strings.recalculate);
    }
    setSettingsDirty(false);
  }

  function clearDifficultyOverridesForDate(observationDate: string) {
    setDifficultyOverrides((current) => {
      const next = { ...current };
      for (const key of Object.keys(next)) {
        if (key.startsWith(`${observationDate}:`)) delete next[key];
      }
      return next;
    });
  }

  async function readFiles(fileList: FileList) {
    const files = [...fileList];
    const loaded = await Promise.all(
      files.map(async (file) => ({ file, result: parseGuildExportText(await file.text()) })),
    );
    const invalid = loaded.find(({ result }) => !result.ok);
    const invalidCode = invalid && !invalid.result.ok ? invalid.result.code : null;
    const importedSnapshots = loaded.flatMap(({ file, result }) =>
      result.ok
        ? [
            createGuildDailySnapshot(
              `${file.name}-${result.payload.exportedAt ?? 'unknown'}`,
              result.payload,
              sourceTimeZone,
            ),
          ]
        : [],
    );

    if (!importedSnapshots.length) {
      setError(invalidCode ? strings.errors[invalidCode] : '');
      setNotice('');
      return;
    }

    const stagedSnapshots = importedSnapshots.reduce<GuildDailySnapshot[]>(
      (current, snapshot) => replaceGuildDailySnapshot(current, snapshot),
      [],
    );
    const latestSnapshot = [...stagedSnapshots]
      .sort((a, b) => a.observationDate.localeCompare(b.observationDate))
      .at(-1);
    if (!latestSnapshot) return;

    const replacesExisting = dailySnapshots.some(
      (snapshot) => snapshot.observationDate === latestSnapshot.observationDate,
    );
    setPendingSnapshots(stagedSnapshots);
    setPendingCalculation({ snapshot: latestSnapshot, replacesExisting });
    clearDifficultyOverridesForDate(latestSnapshot.observationDate);
    setPayload(latestSnapshot.payload);
    setJsonText(JSON.stringify(latestSnapshot.payload, null, 2));
    setFileName(files.length === 1 ? files[0].name : `${stagedSnapshots.length} exports listos`);
    setNotice(replacesExisting ? strings.readyToUpdate : strings.readyToAdd);
    setError(invalidCode ? strings.errors[invalidCode] : '');
  }

  function stageSnapshot(snapshot: GuildDailySnapshot, serialized: string) {
    const replacesExisting = dailySnapshots.some(
      (current) => current.observationDate === snapshot.observationDate,
    );
    setPendingSnapshots([snapshot]);
    setPendingCalculation({ snapshot, replacesExisting });
    clearDifficultyOverridesForDate(snapshot.observationDate);
    setPayload(snapshot.payload);
    setJsonText(serialized);
    setError('');
    setSortKey('total');
    setSortDirection('desc');
    setNotice(replacesExisting ? strings.readyToUpdate : strings.readyToAdd);
  }

  function loadData() {
    const result = parseGuildExportText(jsonText);
    if (!result.ok) {
      setError(strings.errors[result.code]);
      setNotice('');
      return;
    }

    const snapshot = createGuildDailySnapshot(
      `paste-${Date.now()}`,
      result.payload,
      sourceTimeZone,
    );
    if (pendingSnapshots.length > 1 && fileName) {
      setPayload(snapshot.payload);
      setJsonText(JSON.stringify(snapshot.payload, null, 2));
      setError('');
      setNotice(pendingCalculation?.replacesExisting ? strings.readyToUpdate : strings.readyToAdd);
      return;
    }
    stageSnapshot(snapshot, JSON.stringify(result.payload, null, 2));
  }

  function clearData() {
    setJsonText('');
    setFileName('');
    setDailySnapshots([]);
    setPendingSnapshots([]);
    setPendingCalculation(null);
    setDifficultyOverrides({});
    setActiveDifficultyKey(null);
    setPayload(undefined);
    setError('');
    setNotice('');
    setSettingsDirty(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function toggleSort(key: GuildSortKey) {
    if (sortKey === key) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDirection(key === 'name' ? 'asc' : 'desc');
  }

  async function copyText(text: string, successMessage: string) {
    try {
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          copyWithTextarea(text);
        }
      } else {
        copyWithTextarea(text);
      }
      setError('');
      setNotice(successMessage);
    } catch {
      setError(locale === 'es' ? 'No se pudo copiar el texto.' : 'The text could not be copied.');
    }
  }

  function copyWithTextarea(text: string) {
    const fallback = document.createElement('textarea');
    fallback.value = text;
    fallback.style.position = 'fixed';
    fallback.style.opacity = '0';
    document.body.appendChild(fallback);
    try {
      fallback.select();
      document.execCommand('copy');
    } finally {
      fallback.remove();
    }
  }

  async function copyWhatsApp() {
    if (!ranking) return;
    await copyText(
      buildGuildWhatsAppText(ranking, locale, difficultyTiers),
      strings.copiedWhatsApp,
    );
  }

  async function copyDiscord() {
    if (!ranking) return;
    await copyText(
      buildGuildDiscordText(ranking, discordHistory, locale, difficultyTiers),
      strings.copiedDiscord,
    );
  }

  function downloadPng() {
    if (!ranking) return;
    const image = createGuildRankingPng(ranking, sortedMembers, locale);
    if (!image) return;
    const anchor = document.createElement('a');
    const safeGuild = (ranking.payload.guild || 'guild')
      .toLocaleLowerCase()
      .replace(/[^a-z0-9]+/gi, '-');
    anchor.download = `ranking-${safeGuild}-${formatSourceDate(ranking.payload.exportedAt).replaceAll('/', '-')}.png`;
    anchor.href = image;
    anchor.click();
    setNotice(strings.imageReady);
  }

  function lastLoginLabel(member: (typeof sortedMembers)[number]): string {
    if (member.status === 'online') return strings.online;
    return member.lastLogin || strings.noRecord;
  }

  function openDifficultyEditor(memberName: string) {
    if (!activeObservationDate) return;
    const key = difficultyOverrideKey(activeObservationDate, memberName);
    const delta = activeDifficultySummary?.memberDeltas.find(
      (candidate) => candidate.memberKey === normalizeGuildMemberKey(memberName),
    );
    const existing = difficultyOverrides[key];
    setDifficultyDraft({
      ...(existing ?? delta?.difficultyAllocation ?? emptyGuildDifficultyAllocation()),
    });
    setActiveDifficultyKey(key);
  }

  function saveDifficultyOverride() {
    if (!activeDifficultyKey || !activeDifficultySummary) return;
    const memberKey = activeDifficultyKey.split(':').slice(1).join(':');
    const delta = activeDifficultySummary.memberDeltas.find(
      (candidate) => candidate.memberKey === memberKey,
    );
    if (!delta || !isValidGuildDifficultyAllocation(difficultyDraft, delta.dailyDailies)) {
      setError(strings.difficultyInvalid);
      return;
    }
    setDifficultyOverrides((current) => ({
      ...current,
      [activeDifficultyKey]: { ...difficultyDraft },
    }));
    setActiveDifficultyKey(null);
    setNotice(strings.difficultySaved);
    setError('');
  }

  function resetDifficultyOverride() {
    if (!activeDifficultyKey) return;
    setDifficultyOverrides((current) => {
      const next = { ...current };
      delete next[activeDifficultyKey];
      return next;
    });
    setActiveDifficultyKey(null);
    setNotice(strings.difficultyReset);
  }

  const sortIndicator = (key: GuildSortKey) =>
    sortKey === key ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : '';
  const activeDifficultyDelta = activeDifficultyKey
    ? activeDifficultySummary?.memberDeltas.find(
        (candidate) => candidate.memberKey === activeDifficultyKey.split(':').slice(1).join(':'),
      )
    : null;
  const difficultyDraftTotal = sumGuildDifficultyAllocation(difficultyDraft);
  const difficultyDraftPoints = pointsForGuildDifficultyAllocation(
    difficultyDraft,
    difficultyTiers,
  );

  return (
    <div
      className="guild-ranking-tool"
      data-testid="guild-ranking-tool"
      data-hydrated={hydrated ? 'true' : 'false'}
    >
      <GuildPersistencePanel
        locale={locale}
        payload={payload}
        serializedPayload={jsonText}
        sourceLocator={fileName || 'manual-paste'}
        sourceTimeZone={sourceTimeZone}
        onRemoteHistoryLoaded={mergeRemoteHistory}
      />

      <section className="guild-import-panel wiki-panel">
        <div className="guild-tool-heading">
          <div>
            <p className="eyebrow">{strings.importTitle}</p>
            <h2>{strings.importTitle}</h2>
          </div>
          <span className="status-label" data-status="supported">
            JSON local
          </span>
        </div>
        <p className="guild-tool-description">{strings.importDescription}</p>
        <div className="guild-import-controls">
          <label className="guild-file-button">
            <span>{strings.chooseFile}</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              multiple
              onChange={(event) => {
                if (event.target.files?.length) void readFiles(event.target.files);
              }}
            />
          </label>
          <span className="guild-file-name">{fileName || strings.paste}</span>
        </div>
        <label className="guild-field guild-json-field">
          <span>{strings.paste}</span>
          <textarea
            value={jsonText}
            onChange={(event) => setJsonText(event.target.value)}
            placeholder={strings.pastePlaceholder}
            rows={7}
          />
        </label>
        <div className="guild-actions">
          <button className="guild-primary-button" type="button" onClick={loadData}>
            {strings.load}
          </button>
          <button className="guild-secondary-button" type="button" onClick={clearData}>
            {strings.clear}
          </button>
        </div>
        {error ? <p className="guild-message guild-message-error">{error}</p> : null}
        {notice ? <p className="guild-message">{notice}</p> : null}
      </section>

      <section className="guild-settings-panel wiki-panel" aria-labelledby="guild-settings-heading">
        <div className="guild-tool-heading">
          <div>
            <p className="eyebrow">{strings.settingsTitle}</p>
            <h2 id="guild-settings-heading">{strings.settingsTitle}</h2>
          </div>
          <span className="status-label">{strings.source}</span>
        </div>
        <p className="guild-tool-description">{strings.settingsDescription}</p>
        <div className="guild-value-rules">
          <strong>{strings.valueRules}</strong>
          <span>{strings.valueRulesDetail}</span>
        </div>
        <div className="guild-difficulty-settings">
          <div className="guild-difficulty-settings-heading">
            <div>
              <strong>{strings.difficultyTitle}</strong>
              <span>{strings.difficultyDescription}</span>
            </div>
            <label className="guild-field guild-difficulty-policy">
              <span>{strings.difficultyPolicy}</span>
              <select
                value={transitionPolicy}
                onChange={(event) => {
                  setTransitionPolicy(event.target.value as GuildDifficultyPolicy);
                  setSettingsDirty(true);
                }}
              >
                <option value="current">{strings.difficultyPolicyCurrent}</option>
                <option value="previous">{strings.difficultyPolicyPrevious}</option>
                <option value="review">{strings.difficultyPolicyReview}</option>
              </select>
            </label>
          </div>
          <div className="guild-difficulty-grid">
            {difficultyTiers.map((tier) => (
              <label className="guild-difficulty-setting" key={tier.difficulty}>
                <span className="guild-difficulty-setting-label">
                  <span
                    className={`guild-difficulty-icon guild-difficulty-icon-${tier.difficulty}`}
                  />
                  <strong>
                    {tier.difficulty === 'normal'
                      ? 'Normal'
                      : tier.difficulty === 'wildscape'
                        ? 'Wildscape'
                        : 'Primal'}
                  </strong>
                  <small>
                    {tier.minimumLevel}–{tier.maximumLevel === null ? '∞' : tier.maximumLevel}
                  </small>
                </span>
                <span className="sr-only">{strings.difficultyPoints}</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={tier.points}
                  aria-label={`${tier.difficulty} · ${strings.difficultyPoints}`}
                  onChange={(event) => updateDifficultyPoints(tier.difficulty, event.target.value)}
                />
                <small>{strings.difficultyPoints}</small>
              </label>
            ))}
          </div>
        </div>
        <div className="guild-goal-groups">
          {(['standard', 'premium'] as GoalKind[]).map((kind) => (
            <fieldset className="guild-goal-group" key={kind}>
              <legend>{kind === 'standard' ? strings.standardGoals : strings.premiumGoals}</legend>
              <div className="guild-goal-header" aria-hidden="true">
                <span />
                <span>{strings.dailyPeriod}</span>
                <span>{strings.weeklyPeriod}</span>
              </div>
              {GOAL_METRICS.map((metric) => (
                <div className="guild-goal-row" key={metric}>
                  <span className="guild-goal-label">{goalMetricLabel(metric, strings)}</span>
                  {GOAL_PERIODS.map((period) => (
                    <label className="guild-goal-input" key={period}>
                      <span className="sr-only">
                        {goalMetricLabel(metric, strings)} ·{' '}
                        {period === 'daily' ? strings.dailyPeriod : strings.weeklyPeriod}
                      </span>
                      <input
                        inputMode={metric === 'dailies' ? 'numeric' : 'decimal'}
                        value={draft[kind][metric][period]}
                        onChange={(event) =>
                          updateGoalDraft(kind, metric, period, event.target.value)
                        }
                        placeholder="—"
                        aria-label={`${goalMetricLabel(metric, strings)} · ${period === 'daily' ? strings.dailyPeriod : strings.weeklyPeriod}`}
                      />
                    </label>
                  ))}
                </div>
              ))}
              <small>{strings.goalEmpty}</small>
            </fieldset>
          ))}
        </div>
        <div className="guild-derived-note">
          <strong>{strings.derivedContribution}</strong>
          <span>{strings.derivedContributionHelp}</span>
          {ranking ? (
            <div className="guild-derived-values">
              {GUILD_DAILY_VALUE_TIERS.map((tier) => {
                const derived = getGuildDerivedContributionPerDay(
                  tier.minimumLevel,
                  ranking.settings,
                  difficultyTiers,
                );
                return (
                  <span key={tier.band}>
                    {tier.band === 'standard'
                      ? '0–149'
                      : tier.band === 'wildscape'
                        ? '150–349'
                        : '350+'}{' '}
                    <b>{derived === null ? '—' : `${formatGuildNumber(derived)}/día`}</b>
                  </span>
                );
              })}
            </div>
          ) : (
            <span>{strings.derivedContributionNone}</span>
          )}
        </div>
        <div className="guild-source-zone-field">
          <label className="guild-field">
            <span>{strings.sourceZone}</span>
            <select
              value={sourceTimeZone}
              onChange={(event) => {
                const nextTimeZone = event.target.value;
                setSourceTimeZone(nextTimeZone);
                setPendingSnapshots((current) =>
                  current.map((snapshot) =>
                    createGuildDailySnapshot(snapshot.snapshotId, snapshot.payload, nextTimeZone),
                  ),
                );
                setPendingCalculation((current) =>
                  current
                    ? {
                        ...current,
                        snapshot: createGuildDailySnapshot(
                          current.snapshot.snapshotId,
                          current.snapshot.payload,
                          nextTimeZone,
                        ),
                      }
                    : null,
                );
                setSettingsDirty(true);
              }}
            >
              {TIME_ZONE_OPTIONS.map((timeZone) => (
                <option key={timeZone} value={timeZone}>
                  {timeZone === SERVER_SAVE_ZONE ? strings.serverSaveZone : timeZone}
                </option>
              ))}
            </select>
            <small>{strings.sourceZoneHelp}</small>
          </label>
        </div>
        <button
          className={
            pendingCalculation
              ? 'guild-primary-button guild-settings-submit'
              : 'guild-secondary-button guild-settings-submit'
          }
          type="button"
          onClick={updateCalculation}
        >
          {calculationActionLabel}
        </button>
      </section>

      {ranking ? (
        <>
          <section
            className="guild-calculation-panel wiki-panel"
            data-testid="guild-calculation-status"
          >
            <div className="guild-tool-heading">
              <div>
                <p className="eyebrow">{strings.calculationTitle}</p>
                <h2>
                  {pendingCalculation
                    ? pendingCalculation.replacesExisting
                      ? strings.calculationReplace
                      : strings.calculationNew
                    : strings.historyStatus}
                </h2>
              </div>
              <span
                className="status-label"
                data-status={pendingCalculation ? 'pending' : 'supported'}
              >
                {pendingCalculation ? strings.historyPending : strings.historyStatus}
              </span>
            </div>
            <p className="guild-tool-description">
              {pendingCalculation
                ? pendingCalculation.replacesExisting
                  ? strings.calculationReplaceHelp
                  : strings.calculationNewHelp
                : strings.calculationCurrentHelp}
            </p>
            <div className="guild-calculation-meta">
              <strong>{activeDayLabel}</strong>
              <span>
                {pendingSnapshots.length > 1
                  ? `${pendingSnapshots.length} ${pendingSnapshots.length === 1 ? (locale === 'es' ? 'registro' : 'record') : strings.records.toLowerCase()} ${locale === 'es' ? 'pendientes' : 'pending'}`
                  : `${strings.period}: ${formatSourceDate(activeObservationDate)}`}
              </span>
            </div>
          </section>

          <section
            className="guild-analytics-panel wiki-panel"
            data-testid="guild-history-overview"
          >
            <div className="guild-table-heading">
              <div>
                <p className="eyebrow">{strings.historyOverviewTitle}</p>
                <h2>{recordsCountLabel}</h2>
              </div>
              <span className="status-label">
                {weeksCountLabel} · {monthsCountLabel}
              </span>
            </div>
            <p className="guild-tool-description">{strings.historyOverviewDescription}</p>
            <div className="guild-coverage-grid">
              <div className="guild-coverage-stat">
                <span>{strings.records}</span>
                <strong>{historyOverview.snapshotCount}</strong>
              </div>
              <div className="guild-coverage-stat">
                <span>{strings.weeksCovered}</span>
                <strong>{historyOverview.weekCount}</strong>
              </div>
              <div className="guild-coverage-stat">
                <span>{strings.monthsCovered}</span>
                <strong>{historyOverview.monthCount}</strong>
              </div>
              <div className="guild-coverage-stat guild-coverage-stat-wide">
                <span>{strings.period}</span>
                <strong>
                  {historyOverview.firstObservationDate && historyOverview.lastObservationDate
                    ? `${formatSourceDate(historyOverview.firstObservationDate)} → ${formatSourceDate(historyOverview.lastObservationDate)}`
                    : strings.noRange}
                </strong>
              </div>
            </div>
            <div className="guild-period-columns">
              {[
                { title: strings.weeks, periods: historyOverview.weeks.slice(-4), month: false },
                { title: strings.months, periods: historyOverview.months.slice(-3), month: true },
              ].map(({ title, periods, month }) => (
                <div className="guild-period-group" key={title}>
                  <h3>{title}</h3>
                  {periods.length ? (
                    periods.map((period) => (
                      <div className="guild-period-row" key={period.key}>
                        <div>
                          <strong>
                            {formatSourceDate(period.startDate)} →{' '}
                            {formatSourceDate(period.endDate)}
                          </strong>
                          <span>
                            {period.daysObserved}{' '}
                            {period.daysObserved === 1
                              ? locale === 'es'
                                ? 'día observado'
                                : 'day observed'
                              : strings.observedDays}{' '}
                            · {formatGuildNumber(period.dailyPoints)} pts
                          </span>
                        </div>
                        <span
                          className="status-label"
                          data-status={period.complete ? 'supported' : 'pending'}
                        >
                          {month
                            ? `${formatGuildNumber(period.dailyContribution)} ${strings.contribution.toLowerCase()}`
                            : period.complete
                              ? strings.complete
                              : strings.inProgress}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="guild-muted-line">{strings.noRange}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        </>
      ) : null}

      {ranking ? (
        <>
          <section className="guild-summary" aria-label={strings.ranking}>
            <div className="guild-summary-heading">
              <div>
                <p className="eyebrow">{strings.ranking}</p>
                <h2>{ranking.payload.guild || 'Guild'}</h2>
              </div>
              <p className="guild-summary-date">{formatSourceDate(ranking.payload.exportedAt)}</p>
            </div>
            <div className="guild-summary-grid">
              <div>
                <span>{strings.members}</span>
                <strong>{ranking.members.length}</strong>
              </div>
              <div>
                <span>{strings.totalPoints}</span>
                <strong>{formatGuildNumber(ranking.totalPoints)}</strong>
              </div>
              <div>
                <span>{strings.totalContribution}</span>
                <strong>{formatGuildNumber(ranking.totalContribution)}</strong>
              </div>
              <div>
                <span>{strings.expected}</span>
                <strong>{formatNullableGuildNumber(ranking.expectedMinimumPoints)}</strong>
              </div>
            </div>
            <div className="guild-week-line">
              <span>
                {strings.week}: {ranking.week.weekStartDate} → {ranking.week.weekEndDate}
              </span>
              <span>
                {strings.day}: {ranking.week.dayIndex}/7
              </span>
              <span>
                {strings.elapsed}: {ranking.week.elapsedDays}
              </span>
              <span>
                {strings.remaining}: {ranking.week.remainingDays}
              </span>
            </div>
          </section>

          {dailySummaries.length ? (
            <section className="guild-history-panel wiki-panel" data-testid="guild-history">
              <div className="guild-table-heading">
                <div>
                  <p className="eyebrow">{strings.historyTitle}</p>
                  <h2>
                    {dailySummaries.length}{' '}
                    {dailySummaries.length === 1
                      ? locale === 'es'
                        ? 'día'
                        : 'day'
                      : locale === 'es'
                        ? 'días'
                        : 'days'}
                  </h2>
                </div>
                <span className="status-label">
                  {pendingSnapshots.length ? strings.historyPreview : strings.historyStatus}
                </span>
              </div>
              <p className="guild-tool-description">{strings.historyDescription}</p>
              <div className="guild-history-list">
                {dailySummaries.map((summary) => {
                  const isPending = pendingSnapshots.some(
                    (snapshot) => snapshot.observationDate === summary.snapshot.observationDate,
                  );
                  const isBaseline = summary.comparisonStatus === 'baseline';
                  const statusLabel = isPending
                    ? strings.historyPending
                    : summary.comparisonStatus === 'baseline'
                      ? strings.historyBaseline
                      : summary.comparisonStatus === 'decrease_detected'
                        ? strings.historyDecrease
                        : strings.historyDelta;
                  return (
                    <div className="guild-history-row" key={summary.snapshot.snapshotId}>
                      <strong>{formatSourceDate(summary.snapshot.observationDate)}</strong>
                      <span>
                        {strings.day} {summary.snapshot.dayIndex}/7
                      </span>
                      <span>
                        {isBaseline ? strings.historyCumulativeDailies : strings.historyDailies}:{' '}
                        {formatGuildNumber(summary.dailyDailies)}
                      </span>
                      <span>
                        {isBaseline
                          ? strings.historyCumulativeContribution
                          : strings.historyContribution}
                        : {formatGuildNumber(summary.dailyContribution)}
                      </span>
                      <span>
                        {isBaseline ? strings.historyCumulativePoints : strings.historyDailyPoints}:{' '}
                        {formatGuildNumber(summary.dailyPoints - summary.dailyContribution)}
                      </span>
                      <span>
                        {strings.levelsGained}: +{formatGuildNumber(summary.levelsGained)}
                      </span>
                      {summary.membershipEvents.length ? (
                        <span>
                          +
                          {
                            summary.membershipEvents.filter(
                              (event) => event.kind === 'joined' || event.kind === 'returned',
                            ).length
                          }{' '}
                          / -
                          {summary.membershipEvents.filter((event) => event.kind === 'left').length}{' '}
                          {locale === 'es' ? 'miembros' : 'members'}
                        </span>
                      ) : null}
                      <span className="status-label">{statusLabel}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          <section className="guild-lifecycle-panel wiki-panel" data-testid="guild-member-activity">
            <div className="guild-table-heading">
              <div>
                <p className="eyebrow">{strings.currentWeek}</p>
                <h2>{strings.activityTitle}</h2>
              </div>
              <span className="status-label" data-status="supported">
                {SERVER_SAVE_ZONE}
              </span>
            </div>
            <p className="guild-tool-description">{strings.activityDescription}</p>
            <div className="guild-lifecycle-stats">
              <div>
                <span>{strings.levelsGained}</span>
                <strong>+{formatGuildNumber(currentWeekLevelsGained)}</strong>
              </div>
              <div>
                <span>{strings.membersJoined}</span>
                <strong>{joinedMemberCount}</strong>
              </div>
              <div>
                <span>{strings.membersLeft}</span>
                <strong>{leftMemberCount}</strong>
              </div>
              <div>
                <span>{strings.waitingMembers}</span>
                <strong>{waitingMemberCount}</strong>
              </div>
            </div>
            {activeMembershipEvents.length ? (
              <div className="guild-membership-events">
                {activeMembershipEvents.map((event) => (
                  <div
                    className="guild-membership-event"
                    key={`${event.observationDate}:${event.memberKey}:${event.kind}`}
                    data-kind={event.kind}
                  >
                    <div>
                      <strong>{event.displayName}</strong>
                      <span>
                        {event.kind === 'joined'
                          ? strings.joined
                          : event.kind === 'returned'
                            ? strings.returned
                            : strings.left}
                      </span>
                    </div>
                    <div className="guild-membership-event-dates">
                      <span>
                        {strings.observedInterval}:{' '}
                        {formatSourceDate(event.previousObservationDate)} →{' '}
                        {formatSourceDate(event.observationDate)}
                      </span>
                      {event.dailyEligibleDate ? (
                        <span>
                          {strings.dailiesFrom} {formatSourceDate(event.dailyEligibleDate)} ·{' '}
                          {strings.contributionFrom}{' '}
                          {formatSourceDate(event.contributionEligibleDate)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="guild-muted-line">{strings.noMembershipChanges}</p>
            )}
            <p className="guild-lifecycle-note">{strings.baselineMembership}</p>
          </section>

          <section className="guild-export-panel wiki-panel" aria-labelledby="guild-export-heading">
            <div className="guild-tool-heading">
              <div>
                <p className="eyebrow">{strings.exportTitle}</p>
                <h2 id="guild-export-heading">{strings.exportTitle}</h2>
              </div>
              <span className="status-label">
                {strings.contribution}: {formatGuildNumber(ranking.totalContribution)}
              </span>
            </div>
            <p className="guild-tool-description">{strings.exportDescription}</p>
            <div className="guild-export-actions">
              <button
                className="guild-primary-button"
                type="button"
                onClick={() => void copyWhatsApp()}
              >
                {strings.copyWhatsApp}
              </button>
              <button
                className="guild-secondary-button"
                type="button"
                onClick={() => void copyDiscord()}
              >
                {strings.copyDiscord}
              </button>
              <button className="guild-secondary-button" type="button" onClick={downloadPng}>
                {strings.downloadPng}
              </button>
            </div>
          </section>

          <section className="guild-table-panel wiki-panel" aria-labelledby="guild-table-heading">
            <div className="guild-table-heading">
              <div>
                <p className="eyebrow">{strings.ranking}</p>
                <h2 id="guild-table-heading">
                  {ranking.members.length} {strings.members.toLowerCase()}
                </h2>
              </div>
              <span className="status-label">
                {strings.sourceZone}: {ranking.week.sourceTimeZone}
              </span>
            </div>
            <div className="guild-table-wrap">
              <table className="guild-table">
                <thead>
                  <tr>
                    {(
                      [
                        ['position', '#'],
                        ['name', strings.name],
                        ['rank', strings.rank],
                        ['level', strings.level],
                        ['lastLogin', strings.lastLogin],
                        ['contribution', strings.contribution],
                        ['dailiesCompleted', strings.dailies],
                        ['dailyPoints', strings.dailyPoints],
                        ['total', strings.total],
                      ] as [GuildSortKey, string][]
                    ).map(([key, label]) => (
                      <th
                        key={key}
                        scope="col"
                        aria-sort={
                          sortKey === key
                            ? sortDirection === 'asc'
                              ? 'ascending'
                              : 'descending'
                            : 'none'
                        }
                      >
                        <button type="button" onClick={() => toggleSort(key)}>
                          {label}
                          {sortIndicator(key)}
                        </button>
                      </th>
                    ))}
                    <th scope="col">{strings.memberProgress}</th>
                    <th scope="col">{strings.difficultyActions}</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedMembers.map((member) => {
                    const activity = memberActivityByKey.get(normalizeGuildMemberKey(member.name));
                    const band = getGuildMemberBand(
                      member,
                      ranking,
                      activity
                        ? {
                            totalPoints: activity.eligibleDailyDays,
                            dailies: activity.eligibleDailyDays,
                            contribution: activity.eligibleContributionDays,
                          }
                        : undefined,
                    );
                    const statusLabel =
                      member.difficultyConfidence === 'manual'
                        ? strings.difficultyManual
                        : member.difficultyConfidence === 'estimated'
                          ? strings.difficultyEstimated
                          : strings.difficultyExact;
                    return (
                      <tr key={member.name} data-band={band}>
                        <td className="guild-position">{member.position}</td>
                        <th scope="row">{member.name}</th>
                        <td>{formatGuildRank(member.rank)}</td>
                        <td className="guild-number">{member.level ?? '—'}</td>
                        <td>{lastLoginLabel(member)}</td>
                        <td className="guild-number">{formatGuildNumber(member.contribution)}</td>
                        <td className="guild-number">{member.dailiesCompleted}</td>
                        <td className="guild-number guild-daily-points">
                          +{formatGuildNumber(member.dailyPoints)}
                          <span className="guild-difficulty-inline" title={statusLabel}>
                            {statusLabel}
                          </span>
                        </td>
                        <td className="guild-number guild-total">
                          {formatGuildNumber(member.total)}
                        </td>
                        <td className="guild-member-progress">
                          <strong>
                            {activity?.levelsGained
                              ? `+${formatGuildNumber(activity.levelsGained)} ${strings.levelsGained.toLocaleLowerCase()}`
                              : strings.noLevelChange}
                          </strong>
                          <span>
                            {!activity || activity.dailyEligibility === 'assumed_eligible'
                              ? strings.previousAccess
                              : activity.dailyEligibility === 'waiting'
                                ? `${strings.dailiesFrom} ${formatSourceDate(activity.dailyEligibleDate)} · ${strings.contributionFrom} ${formatSourceDate(activity.contributionEligibleDate)}`
                                : activity.contributionEligibility === 'waiting'
                                  ? `${strings.contributionFrom} ${formatSourceDate(activity.contributionEligibleDate)}`
                                  : strings.fullAccess}
                          </span>
                          {activity && activity.dailyEligibility !== 'assumed_eligible' ? (
                            <small>{strings.eligibilityAdjusted}</small>
                          ) : null}
                        </td>
                        <td className="guild-member-actions">
                          <button
                            className="guild-table-action"
                            type="button"
                            data-testid={`guild-difficulty-action-${normalizeGuildMemberKey(member.name)}`}
                            onClick={() => openDifficultyEditor(member.name)}
                          >
                            <span
                              className={`guild-difficulty-icon guild-difficulty-icon-${member.difficultyAllocation.primal > 0 ? 'primal' : member.difficultyAllocation.wildscape > 0 ? 'wildscape' : 'normal'}`}
                              aria-hidden="true"
                            />
                            {strings.difficultyBreakdown}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {activeDifficultyKey && activeDifficultyDelta ? (
              <div className="guild-difficulty-editor" data-testid="guild-difficulty-editor">
                <div className="guild-difficulty-editor-heading">
                  <div>
                    <p className="eyebrow">{strings.difficultyTitle}</p>
                    <h3>
                      {strings.difficultyEditorTitle}: {activeDifficultyDelta.displayName}
                    </h3>
                  </div>
                  <span className="status-label">
                    {formatSourceDate(activeDifficultySummary?.snapshot.observationDate)} ·{' '}
                    {strings.difficultyTotal}: {activeDifficultyDelta.dailyDailies}
                  </span>
                </div>
                <p className="guild-tool-description">{strings.difficultyEditorHelp}</p>
                <div className="guild-difficulty-editor-grid">
                  {(['normal', 'wildscape', 'primal'] as GuildDifficulty[]).map((difficulty) => (
                    <label className="guild-difficulty-input" key={difficulty}>
                      <span>
                        <span
                          className={`guild-difficulty-icon guild-difficulty-icon-${difficulty}`}
                          aria-hidden="true"
                        />
                        {difficulty === 'normal'
                          ? 'Normal'
                          : difficulty === 'wildscape'
                            ? 'Wildscape'
                            : 'Primal'}
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={difficultyDraft[difficulty]}
                        aria-label={`${difficulty} · ${strings.difficultyTotal}`}
                        onChange={(event) =>
                          setDifficultyDraft((current) => ({
                            ...current,
                            [difficulty]: Math.max(0, Math.round(Number(event.target.value) || 0)),
                          }))
                        }
                      />
                    </label>
                  ))}
                </div>
                <div className="guild-difficulty-editor-total">
                  <span>
                    {strings.difficultyTotal}: <strong>{difficultyDraftTotal}</strong> /{' '}
                    {activeDifficultyDelta.dailyDailies}
                  </span>
                  <span>
                    {strings.dailyPoints}:{' '}
                    <strong>{formatGuildNumber(difficultyDraftPoints)}</strong>
                  </span>
                </div>
                <div className="guild-actions">
                  <button
                    className="guild-primary-button"
                    type="button"
                    onClick={saveDifficultyOverride}
                    disabled={difficultyDraftTotal !== activeDifficultyDelta.dailyDailies}
                  >
                    {strings.difficultySave}
                  </button>
                  <button
                    className="guild-secondary-button"
                    type="button"
                    onClick={() => setActiveDifficultyKey(null)}
                  >
                    {strings.difficultyCancel}
                  </button>
                  <button
                    className="guild-secondary-button"
                    type="button"
                    onClick={resetDifficultyOverride}
                  >
                    {strings.difficultyReset}
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        </>
      ) : (
        <section className="guild-empty wiki-empty-state">
          <p className="eyebrow">{strings.ranking}</p>
          <h2>{strings.emptyTitle}</h2>
          <p>{strings.emptyDescription}</p>
        </section>
      )}
    </div>
  );
}
