// «Exportar PNG» (spec §10.12): the members table of the current filter and order, every
// row, under the guild, its week and its last export. 1200 px wide, drawn at 2× with the
// colours, type styles and Verdana of the design tokens (src/lib/design/tokens.ts), so no
// colour is written here. Every text arrives written: the island formats the rows with the
// §4.3 formatters and the `guild` messages. The «Semana» column is the band of each row's
// week from guild-analytics.ts, the one the member dialog shows, so both evaluate the goal
// with the same pacing (CA-10.8).
// The groups by name, never the `tokens` aggregate: every page loads this module for its
// theme colour and its layout, and the aggregate would keep every group in that shared chunk.
import { color, fontFamily, radius, size, spacing, type as text } from '@/lib/design/tokens';

type TextStyle = (typeof text)[keyof typeof text];

/** The columns of «Miembros» (§10.9) and the member's week band. */
export type GuildRankingImageColumn =
  'member' | 'rank' | 'level' | 'today' | 'days7' | 'days30' | 'trend' | 'lastActivity' | 'week';

export type GuildRankingImageRow = {
  name: string;
  rank: string;
  level: string;
  today: string;
  days7: string;
  days30: string;
  /** The 14 values of the row's `Sparkline`, oldest first; null is a day without export. */
  trend: readonly (number | null)[];
  /** The variation next to it, already formatted («−13,3%», «—»). */
  change: string;
  lastActivity: string;
  /** The band of the member's week («En meta», «Bajo meta», …) or «—». */
  week: string;
  inactive: boolean;
};

export type GuildRankingImageInput = {
  /** The guild's name, or the fallback «Guild». */
  title: string;
  /** Lines under the title: «Semana: …», «Último export: … (hora de Brasilia)». */
  lines: readonly string[];
  /** «Meta hoy: …», «Dailies: …», «Meta premium: …»; an empty goal is left out. */
  goals: readonly string[];
  columns: Readonly<Record<GuildRankingImageColumn, string>>;
  /** Text of the chip of an inactive row: «Inactivo». */
  inactive: string;
  footer: string;
  rows: readonly GuildRankingImageRow[];
  /** The value that fills a sparkline, the same for the table (`getGuildTrendMax`). */
  trendMax: number;
};

const px = (value: string): number => Number.parseFloat(value);

const WIDTH = 1200;
const SCALE = 2;
const PAGE = px(spacing.space40);
const CELL = px(spacing.space12);
const GAP = px(spacing.space8);
/** `DataTable`: 40 px rows and a 40 px header in bg-tertiary. */
const ROW = px(size.sizeControl);
const SPARK_W = px(size.sizeSparkW);
const SPARK_H = px(size.sizeSparkH);
/** `Sparkline`: a 3 px bar every 5 px, 18 px at most and 2 px at least. */
const BAR = 3;
const BAR_STEP = 5;
const BAR_MAX = 18;
const BAR_MIN = 2;

const COLUMNS: ReadonlyArray<{
  key: GuildRankingImageColumn;
  width: number;
  align: CanvasTextAlign;
  style: TextStyle;
}> = [
  { key: 'member', width: 226, align: 'left', style: text.body },
  { key: 'rank', width: 110, align: 'left', style: text.body },
  { key: 'level', width: 64, align: 'right', style: text.body },
  { key: 'today', width: 80, align: 'right', style: text.body },
  { key: 'days7', width: 90, align: 'right', style: text.body },
  { key: 'days30', width: 100, align: 'right', style: text.body },
  { key: 'trend', width: 150, align: 'left', style: text.ui },
  { key: 'lastActivity', width: 190, align: 'left', style: text.ui },
  { key: 'week', width: 110, align: 'left', style: text.ui },
];

function font(style: TextStyle, weight: number = style.fontWeight): string {
  return `${weight} ${style.fontSize} ${fontFamily[style.fontFamily]}`;
}

function lineHeight(style: TextStyle): number {
  return px(style.lineHeight);
}

function fit(context: CanvasRenderingContext2D, value: string, maxWidth: number): string {
  if (context.measureText(value).width <= maxWidth) return value;
  let result = value;
  while (result.length > 1 && context.measureText(`${result}…`).width > maxWidth) {
    result = result.slice(0, -1);
  }
  return `${result}…`;
}

/** Round half to even, as the design system's sparkline rounds its bars. */
function roundEven(value: number): number {
  return Math.abs(value % 1) === 0.5 ? 2 * Math.round(value / 2) : Math.round(value);
}

function drawSparkline(
  context: CanvasRenderingContext2D,
  values: readonly (number | null)[],
  max: number,
  x: number,
  y: number,
) {
  values.forEach((value, index) => {
    const left = x + index * BAR_STEP;
    if (value !== null && value > 0) {
      const height = Math.min(Math.max(roundEven((BAR_MAX * value) / max), BAR_MIN), BAR_MAX);
      context.fillStyle = color.textQuaternary;
      context.fillRect(left, y + SPARK_H - height, BAR, height);
    } else {
      context.fillStyle = color.borderPrimary;
      context.fillRect(left, y + SPARK_H - 1, BAR, 1);
    }
  });
}

/**
 * The PNG as a data URL, or null when the browser gives no 2D canvas. Only the Guild island
 * calls it, in the browser.
 */
export function createGuildRankingPng(input: GuildRankingImageInput): string | null {
  const tableWidth = WIDTH - PAGE * 2;
  const titleHeight = lineHeight(text.h1);
  const bodyHeight = lineHeight(text.body);
  const headTop = PAGE;
  const linesTop = headTop + titleHeight + GAP;
  const goalsTop = linesTop + input.lines.length * bodyHeight + (input.goals.length ? GAP : 0);
  const tableTop = goalsTop + (input.goals.length ? bodyHeight : 0) + px(spacing.space24);
  const tableHeight = ROW * (input.rows.length + 1);
  const footerTop = tableTop + tableHeight + px(spacing.space24);
  const height = footerTop + lineHeight(text.ui) + PAGE;

  const canvas = document.createElement('canvas');
  canvas.width = WIDTH * SCALE;
  canvas.height = height * SCALE;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.scale(SCALE, SCALE);
  context.textBaseline = 'middle';

  context.fillStyle = color.bgPrimary;
  context.fillRect(0, 0, WIDTH, height);

  // Head: the guild, then its week and last export, then the goals.
  context.textAlign = 'left';
  context.fillStyle = color.textPrimary;
  context.font = font(text.h1);
  context.fillText(fit(context, input.title, tableWidth), PAGE, headTop + titleHeight / 2);
  context.font = font(text.body);
  context.fillStyle = color.textTertiary;
  input.lines.forEach((line, index) => {
    context.fillText(
      fit(context, line, tableWidth),
      PAGE,
      linesTop + index * bodyHeight + bodyHeight / 2,
    );
  });
  context.fillStyle = color.textSecondary;
  let goalX = PAGE;
  for (const goal of input.goals) {
    context.fillText(goal, goalX, goalsTop + bodyHeight / 2);
    goalX += context.measureText(goal).width + px(spacing.space24);
  }

  // Table: header row in bg-tertiary, rows divided by border-secondary, a 1 px frame.
  context.fillStyle = color.bgTertiary;
  context.fillRect(PAGE, tableTop, tableWidth, ROW);
  let x = PAGE;
  for (const column of COLUMNS) {
    context.font = font(text.uiStrong);
    context.fillStyle = color.textTertiary;
    context.textAlign = column.align;
    const label = fit(context, input.columns[column.key], column.width - CELL * 2);
    context.fillText(
      label,
      column.align === 'right' ? x + column.width - CELL : x + CELL,
      tableTop + ROW / 2,
    );
    x += column.width;
  }

  input.rows.forEach((row, index) => {
    const top = tableTop + ROW * (index + 1);
    const middle = top + ROW / 2;
    if (row.inactive) {
      context.fillStyle = color.inactiveRow;
      context.fillRect(PAGE, top, tableWidth, ROW);
    }
    context.fillStyle = color.borderSecondary;
    context.fillRect(PAGE, top, tableWidth, 1);

    let left = PAGE;
    for (const column of COLUMNS) {
      const inner = column.width - CELL * 2;
      context.textAlign = column.align;
      if (column.key === 'member') {
        context.font = font(column.style, row.inactive ? 700 : column.style.fontWeight);
        context.fillStyle = color.textPrimary;
        const chip = row.inactive ? chipWidth(context, input.inactive) : 0;
        const name = fit(context, row.name, inner - (chip ? chip + GAP : 0));
        context.fillText(name, left + CELL, middle);
        if (chip) {
          const nameWidth = context.measureText(name).width;
          drawChip(context, input.inactive, left + CELL + nameWidth + GAP, middle);
        }
      } else if (column.key === 'trend') {
        drawSparkline(context, row.trend, input.trendMax, left + CELL, middle - SPARK_H / 2);
        context.font = font(column.style);
        context.fillStyle = color.textSecondary;
        context.textAlign = 'right';
        context.fillText(
          fit(context, row.change, inner - SPARK_W - GAP),
          left + column.width - CELL,
          middle,
        );
      } else {
        context.font = font(column.style);
        context.fillStyle =
          column.key === 'rank' || column.key === 'lastActivity' || column.key === 'week'
            ? color.textSecondary
            : color.textPrimary;
        context.fillText(
          fit(context, row[column.key], inner),
          column.align === 'right' ? left + column.width - CELL : left + CELL,
          middle,
        );
      }
      left += column.width;
    }
  });

  context.strokeStyle = color.borderSecondary;
  context.lineWidth = 1;
  context.strokeRect(PAGE + 0.5, tableTop + 0.5, tableWidth - 1, tableHeight - 1);

  context.textAlign = 'left';
  context.font = font(text.ui);
  context.fillStyle = color.textQuinary;
  context.fillText(input.footer, PAGE, footerTop + lineHeight(text.ui) / 2);

  return canvas.toDataURL('image/png');
}

/** The inactive chip of `DataTable`: 12/16 in white on banner, 2 × 8 padding, round ends. */
function chipWidth(context: CanvasRenderingContext2D, label: string): number {
  const previous = context.font;
  context.font = font(text.ui);
  const width = context.measureText(label).width + px(spacing.space8) * 2;
  context.font = previous;
  return width;
}

function drawChip(context: CanvasRenderingContext2D, label: string, x: number, middle: number) {
  const previousFont = context.font;
  const previousAlign = context.textAlign;
  const width = chipWidth(context, label);
  const chipHeight = lineHeight(text.ui) + px(spacing.space2) * 2;
  context.fillStyle = color.banner;
  context.beginPath();
  context.roundRect(x, middle - chipHeight / 2, width, chipHeight, px(radius.radiusFull));
  context.fill();
  context.font = font(text.ui);
  context.fillStyle = color.white;
  context.textAlign = 'left';
  context.fillText(label, x + px(spacing.space8), middle);
  context.font = previousFont;
  context.textAlign = previousAlign;
}
