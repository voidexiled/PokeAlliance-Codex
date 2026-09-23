import type { CSSProperties, HTMLAttributes, Key, ReactNode } from 'react';

import { UNKNOWN, present } from '@/lib/format/unknown';

// FactList (spec 7.2.6, 7.6.2, 7.6.3; CARD_GRID_SYSTEM §5.2, §5.4, §5.6; DS:FactList): the
// label/value facts of a card as a `dl` that spans one row track of the card per fact
// (`grid-template-rows: subgrid`), so a value that takes two lines grows that row in every
// card of the grid row, and every other fact keeps its height. The facts zone of the listing,
// Pokédex and loot cards is one, and the listing footer is another (`divided`, gap 8).
// Outside a card the subgrid has no parent grid and the list is plain rows with the same gap.
//
// Markup and `ac-fact-list*` classes are the reference's (`bundle.js` FactList), so
// fact-list.css ports `bundle.css` unchanged: `dl[data-zone] > div.ac-fact-list__row >
// dt + dd`, the `dd` always a flex box so inline links and sprites sit in the 16 px row
// instead of growing a text line box (CARD_GRID_SYSTEM §5.6). `grid-row: span N` is the
// one inline style, a value that depends on the data (C-R2).
//
// Value modes (DS:FactList): `clip` one line with an ellipsis (level, tier, counts); `pre`
// one line that keeps its spaces (spaced nicknames); `wrap` up to two lines with the label on
// the first; `node` a laid-out node (links, money, chips); `nodetop` a node that may wrap,
// the label on its first line (two price options); `below` the label over the node, 6 apart
// («Contacto verificado»).
//
// Unknown values (G7, CARD_GRID_SYSTEM §5.4): `null`, `undefined`, a boolean, the empty
// string, the dash itself and an empty list show «—» in the value colour, as a one-line
// clip. A key that no card of the grid has never reaches this list: the union of the layout
// drops it (7.6.3). One difference against the reference: there an unknown value also drops
// the mode of its row, so a «—» in a `wrap`, `nodetop` or `below` row sits centred in a track
// the other cards of the row fill with two lines, or on the label's line under
// «Contacto verificado». Here the row keeps the alignment of its mode, and its label stays
// where the labels of the other cards of the row are, as the approved board draws the
// «En el juego —» of a listing without an in-game price (`Lienzo:Tarjetas`). In a one-line
// track both are the same pixels.
//
// Every text is the caller's (DP1): labels and values arrive as props, already written.

/** How the value of a fact is laid out (DS:FactList «Modo»). */
export type FactMode = 'clip' | 'pre' | 'wrap' | 'node' | 'nodetop' | 'below';

/** One fact. */
export interface FactRow {
  /** «Requisito»: the label, without a colon. */
  label: ReactNode;
  /** The value; unknown (see above) shows «—». */
  value?: ReactNode;
  /** Default `clip`. */
  mode?: FactMode;
  /** React key; default the label, then the position. */
  key?: Key;
  /**
   * Language of the value when it is a phrase of the other locale: a registry text that only
   * exists in English shows with `lang="en"` on a Spanish page (spec 8.0.5, T22).
   */
  lang?: string;
  /**
   * The value is a target: an entity link or button, an element. Marked `data-target` on the
   * row, so the grid can keep two stacked targets 24 px apart (WCAG 2.5.8, fact-list.css).
   */
  target?: boolean;
}

export interface FactListProps extends Omit<HTMLAttributes<HTMLDListElement>, 'children'> {
  /** The facts, in the canonical order of the card family. */
  rows: readonly FactRow[];
  /** Gap between facts: 6 (facts) or 8 (listing footer). A coarse pointer always gets 8. */
  gap?: 6 | 8;
  /** Label over value, left-aligned: a narrow card. */
  stacked?: boolean;
  /** 1 px `border-secondary` line above and 12 px of padding: the listing footer. */
  divided?: boolean;
  /** `data-zone` of the list inside its card. Default `facts`; `null` leaves it out. */
  zone?: string | null;
}

const MODES: ReadonlySet<string> = new Set<FactMode>([
  'clip',
  'pre',
  'wrap',
  'node',
  'nodetop',
  'below',
]);

function classes(...values: (string | false | undefined)[]): string {
  return values.filter(Boolean).join(' ');
}

/** A value there is nothing to show for; React draws a boolean as nothing at all. */
function unknown(value: ReactNode): boolean {
  return typeof value === 'boolean' || !present(value);
}

interface FactProps {
  row: FactRow;
  stacked: boolean;
}

function Fact({ row, stacked }: FactProps) {
  const mode: FactMode = row.mode !== undefined && MODES.has(row.mode) ? row.mode : 'clip';
  const empty = unknown(row.value);
  const shown: FactMode = empty ? 'clip' : mode;

  let value: ReactNode;
  if (shown === 'clip' || shown === 'pre') {
    value = (
      <span className={classes('ac-fact-list__clip', shown === 'pre' && 'ac-fact-list__clip--pre')}>
        {empty ? UNKNOWN : row.value}
      </span>
    );
  } else if (shown === 'wrap') {
    value = (
      <span className={classes('ac-fact-list__wrap', stacked && 'ac-fact-list__wrap--start')}>
        {row.value}
      </span>
    );
  } else {
    value = row.value;
  }
  const lang = empty ? undefined : row.lang;
  const target = !empty && row.target === true ? '' : undefined;

  if (mode === 'below') {
    return (
      <div className="ac-fact-list__row ac-fact-list__row--below" data-target={target}>
        <dt className="ac-fact-list__label">{row.label}</dt>
        <dd className="ac-fact-list__below" lang={lang}>
          {value}
        </dd>
      </div>
    );
  }
  if (stacked) {
    return (
      <div className="ac-fact-list__row ac-fact-list__row--stacked" data-target={target}>
        <dt className="ac-fact-list__label">{row.label}</dt>
        <dd className="ac-fact-list__value ac-fact-list__value--start" lang={lang}>
          {value}
        </dd>
      </div>
    );
  }
  const top = mode === 'wrap' || mode === 'nodetop';
  return (
    <div
      className={classes('ac-fact-list__row', top && 'ac-fact-list__row--top')}
      data-target={target}
    >
      <dt className="ac-fact-list__label">{row.label}</dt>
      <dd className="ac-fact-list__value" lang={lang}>
        {value}
      </dd>
    </div>
  );
}

/** The facts of a card: one row track per fact. */
export function FactList({
  rows,
  gap = 6,
  stacked = false,
  divided = false,
  zone = 'facts',
  className,
  style,
  ...rest
}: FactListProps) {
  // The one inline style of the list (C-R2): the tracks it spans in its card.
  const box: CSSProperties = { ...style, gridRow: `span ${Math.max(rows.length, 1)}` };
  return (
    <dl
      {...rest}
      data-zone={zone ?? undefined}
      className={classes(
        'ac-fact-list',
        gap === 8 && 'ac-fact-list--gap8',
        divided && 'ac-fact-list--divided',
        stacked && 'ac-fact-list--stacked',
        className,
      )}
      style={box}
    >
      {rows.map((row, index) => (
        <Fact
          key={row.key ?? (typeof row.label === 'string' ? row.label : index)}
          row={row}
          stacked={stacked}
        />
      ))}
    </dl>
  );
}
