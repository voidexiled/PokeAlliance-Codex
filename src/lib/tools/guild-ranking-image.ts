import {
  formatGuildNumber,
  formatGuildRank,
  getGuildMemberBand,
  getGuildGoalWeeklyValue,
  type GuildRanking,
  type RankedGuildMember,
} from './guild-ranking';

type Locale = 'es' | 'en';

function truncateCanvasText(
  context: CanvasRenderingContext2D,
  value: string,
  maxWidth: number,
): string {
  if (context.measureText(value).width <= maxWidth) return value;

  let result = value;
  while (result.length > 1 && context.measureText(`${result}…`).width > maxWidth) {
    result = result.slice(0, -1);
  }
  return `${result}…`;
}

function drawCanvasText(
  context: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  maxWidth: number,
  align: CanvasTextAlign = 'left',
) {
  context.textAlign = align;
  context.fillText(truncateCanvasText(context, value, maxWidth), x, y);
}

export function createGuildRankingPng(
  ranking: GuildRanking,
  sortedMembers: RankedGuildMember[],
  locale: Locale,
): string | null {
  const width = 1520;
  const rowHeight = 58;
  const headerHeight = 274;
  const tableHeaderHeight = 48;
  const footerHeight = 68;
  const outerInset = 20;
  const tableInset = 40;
  const tableWidth = width - tableInset * 2;
  const height =
    headerHeight + tableHeaderHeight + ranking.members.length * rowHeight + footerHeight;
  const canvas = document.createElement('canvas');
  canvas.width = width * 2;
  canvas.height = height * 2;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.scale(2, 2);

  const text =
    locale === 'es'
      ? {
          exported: 'Exportado',
          members: 'miembros',
          totalPoints: 'pts totales',
          week: 'Semana',
          day: 'día',
          zone: 'zona',
          goalToday: 'META HOY',
          dailies: 'DAILIES',
          contribution: 'DONACIÓN',
          premium: 'PREMIUM',
          byLevel: 'Por nivel',
          below: 'Por debajo de la meta',
          goal: 'Meta alcanzada',
          premiumBand: 'Meta premium',
          footer: 'Alliance Codex · Ranking de guild · contribución separada de puntos',
          online: 'En línea',
          noRecord: 'Sin registro',
        }
      : {
          exported: 'Exported',
          members: 'members',
          totalPoints: 'total pts',
          week: 'Week',
          day: 'day',
          zone: 'zone',
          goalToday: 'GOAL TODAY',
          dailies: 'DAILIES',
          contribution: 'DONATION',
          premium: 'PREMIUM',
          byLevel: 'By level',
          below: 'Below goal',
          goal: 'Goal reached',
          premiumBand: 'Premium goal',
          footer: 'Alliance Codex · Guild ranking · contribution separated from points',
          online: 'Online',
          noRecord: 'No record',
        };

  context.fillStyle = '#0b0e13';
  context.fillRect(0, 0, width, height);
  context.fillStyle = '#151a22';
  context.strokeStyle = '#303947';
  context.lineWidth = 1.5;
  context.beginPath();
  context.roundRect(outerInset, outerInset, width - outerInset * 2, height - outerInset * 2, 16);
  context.fill();
  context.stroke();

  context.fillStyle = '#d79a55';
  context.font = '700 34px Geist, Segoe UI, sans-serif';
  drawCanvasText(context, ranking.payload.guild || 'Guild ranking', 48, 70, 940);
  context.fillStyle = '#8d949d';
  context.font = '14px Geist, Segoe UI, sans-serif';
  context.textAlign = 'left';
  context.fillText(
    `${text.exported} ${formatSourceDate(ranking.payload.exportedAt)} · ${ranking.members.length} ${text.members} · ${formatGuildNumber(ranking.totalPoints)} ${text.totalPoints}`,
    48,
    101,
  );
  context.fillText(
    `${text.week} ${ranking.week.weekStartDate} → ${ranking.week.weekEndDate} · ${text.day} ${ranking.week.dayIndex}/7 · ${text.zone} ${ranking.week.sourceTimeZone}`,
    48,
    126,
  );

  context.fillStyle = '#1c232e';
  context.beginPath();
  context.roundRect(tableInset, 151, tableWidth, 70, 9);
  context.fill();

  const metrics = [
    {
      label: text.goalToday,
      value:
        ranking.expectedMinimumPoints === null
          ? '—'
          : `${formatGuildNumber(ranking.expectedMinimumPoints)} pts`,
      color: '#d5dde6',
    },
    {
      label: text.dailies,
      value: ranking.expectedDailies === null ? '—' : formatGuildNumber(ranking.expectedDailies),
      color: '#d5dde6',
    },
    {
      label: text.contribution,
      value:
        ranking.expectedContribution === null
          ? text.byLevel
          : formatGuildNumber(ranking.expectedContribution),
      color: '#d5dde6',
    },
    {
      label: text.premium,
      value:
        getGuildGoalWeeklyValue(ranking.settings.premium.totalPoints) === null
          ? '—'
          : `${formatGuildNumber(getGuildGoalWeeklyValue(ranking.settings.premium.totalPoints) ?? 0)} pts`,
      color: '#8eb8df',
    },
  ];
  const metricWidth = tableWidth / metrics.length;
  metrics.forEach((metric, index) => {
    const x = tableInset + index * metricWidth;
    if (index > 0) {
      context.strokeStyle = '#303947';
      context.beginPath();
      context.moveTo(x, 166);
      context.lineTo(x, 207);
      context.stroke();
    }
    context.fillStyle = '#858f9d';
    context.font = '600 10px Geist, Segoe UI, sans-serif';
    context.fillText(metric.label, x + 16, 177);
    context.fillStyle = metric.color;
    context.font = '700 17px Geist, Segoe UI, sans-serif';
    context.fillText(metric.value, x + 16, 201);
  });

  const legend = [
    { label: text.below, color: '#df7c82' },
    { label: text.goal, color: '#5ad9a6' },
    { label: text.premiumBand, color: '#80b8ff' },
  ];
  context.font = '600 11px Geist, Segoe UI, sans-serif';
  legend.forEach((item, index) => {
    const x = tableInset + index * 210;
    context.fillStyle = item.color;
    context.beginPath();
    context.arc(x + 5, 249, 5, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#9ca6b2';
    context.fillText(item.label, x + 18, 253);
  });

  const tableTop = headerHeight;
  const columns = [
    { label: '#', x: 48, width: 45, align: 'left' as const },
    { label: locale === 'es' ? 'NOMBRE' : 'NAME', x: 108, width: 250, align: 'left' as const },
    { label: locale === 'es' ? 'CARGO' : 'ROLE', x: 385, width: 170, align: 'left' as const },
    { label: locale === 'es' ? 'NIVEL' : 'LEVEL', x: 580, width: 80, align: 'right' as const },
    {
      label: locale === 'es' ? 'ÚLTIMO ACCESO' : 'LAST ACCESS',
      x: 700,
      width: 250,
      align: 'left' as const,
    },
    { label: text.dailies, x: 990, width: 90, align: 'right' as const },
    {
      label: locale === 'es' ? 'CONTRIBUCIÓN' : 'CONTRIBUTION',
      x: 1115,
      width: 150,
      align: 'right' as const,
    },
    { label: locale === 'es' ? 'PUNTOS' : 'POINTS', x: 1388, width: 90, align: 'right' as const },
  ];
  context.fillStyle = '#242c38';
  context.beginPath();
  context.roundRect(tableInset, tableTop, tableWidth, tableHeaderHeight, 8);
  context.fill();
  context.fillStyle = '#8e98a5';
  context.font = '650 10px Geist, Segoe UI, sans-serif';
  for (const column of columns) {
    context.textAlign = column.align;
    context.fillText(
      column.label,
      column.align === 'right' ? column.x + column.width : column.x,
      tableTop + 29,
    );
  }

  sortedMembers.forEach((member, index) => {
    const y = tableTop + tableHeaderHeight + index * rowHeight;
    const band = getGuildMemberBand(member, ranking);
    const background =
      band === 'below'
        ? '#38232c'
        : band === 'premium'
          ? '#203457'
          : band === 'goal'
            ? '#173d36'
            : index % 2 === 0
              ? '#151b24'
              : '#121820';
    const accent = band === 'below' ? '#df7c82' : band === 'premium' ? '#80b8ff' : '#5ad9a6';
    context.fillStyle = background;
    context.fillRect(tableInset, y, tableWidth, rowHeight);
    context.fillStyle = accent;
    context.fillRect(tableInset, y, 4, rowHeight);
    context.strokeStyle = '#2a3340';
    context.beginPath();
    context.moveTo(tableInset, y + rowHeight);
    context.lineTo(width - tableInset, y + rowHeight);
    context.stroke();

    context.fillStyle = '#87919e';
    context.font = '14px Geist, Segoe UI, sans-serif';
    drawCanvasText(context, String(member.position), 48, y + 36, 40);
    context.fillStyle = accent;
    context.font = '700 14px Geist, Segoe UI, sans-serif';
    drawCanvasText(context, member.name, 108, y + 36, 250);
    context.fillStyle = '#9da6b1';
    context.font = '13px Geist, Segoe UI, sans-serif';
    drawCanvasText(context, formatGuildRank(member.rank), 385, y + 36, 170);
    drawCanvasText(
      context,
      member.level === null ? '—' : String(member.level),
      660,
      y + 36,
      80,
      'right',
    );
    drawCanvasText(
      context,
      member.status === 'online' ? text.online : member.lastLogin || text.noRecord,
      700,
      y + 36,
      250,
    );
    drawCanvasText(context, String(member.dailiesCompleted), 1080, y + 36, 90, 'right');
    drawCanvasText(context, formatGuildNumber(member.contribution), 1265, y + 36, 150, 'right');
    context.fillStyle = accent;
    context.font = '700 14px Geist, Segoe UI, sans-serif';
    drawCanvasText(context, formatGuildNumber(member.total), 1478, y + 36, 90, 'right');
  });

  context.fillStyle = '#6f7884';
  context.font = '12px Geist, Segoe UI, sans-serif';
  context.textAlign = 'left';
  context.fillText(text.footer, 48, height - 32);

  return canvas.toDataURL('image/png');
}

function formatSourceDate(value: string | null | undefined): string {
  if (!value) return '—';
  const match = value.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  return match ? `${match[3].padStart(2, '0')}/${match[2].padStart(2, '0')}/${match[1]}` : value;
}
