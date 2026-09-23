import { Children, createContext, Fragment, isValidElement, useContext } from 'react';
import type { HTMLAttributes, Key, ReactNode } from 'react';

import { NestedEntity } from '@/components/game/NestedEntity';
import type { Locale } from '@/i18n/config';
import type { TipData } from '@/lib/game/tips';

// FactLine and FactLines (spec 7.2.3, 7.5.5, 7.5.10, T33; DS:FactLine): the 14/32 data line
// «Etiqueta: valor · valor». The label is bold and carries the colon (T33); several values
// are joined by « · » in `text-quinary`, hidden from screen readers. `FactLines` groups
// lines as a `dl`, in a row 24 px apart (Guild head) or in a column («Dónde encontrarlo»).
// Markup and `ac-fact-line*` classes are the reference's (`bundle.js` FactLine), so
// fact-line.css ports `bundle.css` unchanged.
//
// A value that is a game entity is a `NestedEntity` (spec 7.2.3) with the placement of
// its zone, `up` + `start` (7.5.5): pass it as a `FactLineEntity`, `{ text, tip, href? }`,
// and this component draws the trigger and its panel. R2: a `tip` with nothing to show
// below its title is plain text, as in `Chip` and `ElementChip`.
//
// Two ways to give the values, because the component renders from `.astro` pages and from
// islands (C-R1):
//   - `children`, as in the design system: each child is one value. Only from TSX — an
//     island, or another TSX component. From an `.astro` page, Astro hands the whole slot
//     over as one opaque HTML child, so there would be nothing to put the separator between.
//   - `values`, the site's prop: an array of nodes, strings or `FactLineEntity` objects. It
//     is what an `.astro` page uses (Dónde encontrarlo, §8.3), and islands may use it too.
// For the same reason `FactLines` takes `lines` as data: under an `.astro` page each
// `<FactLine>` child would be a separate React root that cannot see its `dl`, and Astro's
// slot wrapper element would sit between the `dl` and its groups.
//
// A line with no value renders nothing (spec 8.0.5): a label with nothing after it is not
// a fact, and the dash belongs to card facts and table cells only (C-R5). A standalone line
// is a `<p>`, so an entity inside it gets the phrasing-only panel (`inline`, 7.5.2); inside
// `FactLines` it is a `div > dt + dd` and the panel is the regular one.
//
// Every visible text comes from the composer (DP1): the label, the values, and the text of
// the tooltips of entity values (`hint`, `shinyLabel`, `orLabel`), which `FactLines` can
// pass once for all its lines.

/** An entity value: a `NestedEntity` that opens the game tooltip (7.5.10). */
export interface FactLineEntity {
  /** Name of the entity, as the registry writes it. */
  text: string;
  /** Panel to open, built by a constructor of `src/lib/game/tips.ts` (7.5.3). */
  tip: TipData;
  /** Page of the entity; without it the trigger is a button (7.5.7). */
  href?: string;
  /** `en` for an English name inside a Spanish page (spec 8.0.5, T22). */
  lang?: string;
}

/** One value, or one piece of a label: a node or an entity. */
export type FactLinePart = ReactNode | FactLineEntity;

/** The text of the tooltips of entity values (DP1). */
export interface FactLineTipText {
  /** Picks the format of the amounts inside the panels. It never picks a text (C-R3). */
  locale?: Locale;
  /** Strip of the panel, `ui.pinHint`: «Mantén Shift para fijar» / «Hold Shift to pin». */
  hint?: string;
  /** Accessible name of the Shiny mark in the panel head (13.4). */
  shinyLabel?: string;
  /** The word between two price options in the panel, `ui.or`: «o» / «or» (13.3). */
  orLabel?: string;
}

export interface FactLineProps
  extends FactLineTipText, Omit<HTMLAttributes<HTMLElement>, 'children'> {
  /**
   * Bold label without the colon, which the component adds («Mundo» → «Mundo:»). An array
   * mixes text and entities: `['Hunts de ', { text: 'Charizard', tip }]`.
   */
  label: FactLinePart | FactLinePart[];
  /** Values from TSX, one per child (text, `TextLink` or `NestedEntity`). */
  children?: ReactNode;
  /** Values as data; used instead of `children` when given. */
  values?: FactLinePart[];
  /** Divider between values, hidden from screen readers. Default « · ». */
  separator?: ReactNode;
}

/** One line of `FactLines.lines`. */
export interface FactLineData {
  key?: Key;
  label: FactLinePart | FactLinePart[];
  values: FactLinePart[];
  separator?: ReactNode;
  className?: string;
}

export interface FactLinesProps
  extends FactLineTipText, Omit<HTMLAttributes<HTMLDListElement>, 'children'> {
  /** `row` wraps the lines 24 px apart; `column` stacks them. Default `row`. */
  layout?: 'row' | 'column';
  /** `FactLine` elements, from TSX. */
  children?: ReactNode;
  /** The lines as data; used instead of `children` when given (the `.astro` form). */
  lines?: FactLineData[];
}

/** Set by `FactLines`: its lines are `div > dt + dd` and share the tooltip text. */
const FactLinesContext = createContext<FactLineTipText | null>(null);

const SEPARATOR = ' · ';

function isEntity(part: FactLinePart): part is FactLineEntity {
  return (
    part !== null &&
    typeof part === 'object' &&
    !Array.isArray(part) &&
    !isValidElement(part) &&
    'tip' in part &&
    'text' in part
  );
}

/** R2: a panel with nothing to show below its title is not a tooltip. */
function hasContent(tip: TipData): boolean {
  return tip.rows.length > 0 || Boolean(tip.sections?.length) || Boolean(tip.market?.length);
}

/** A value that draws nothing does not get a separator either. */
function isEmpty(part: FactLinePart): boolean {
  return part === null || part === undefined || typeof part === 'boolean' || part === '';
}

function renderPart(part: FactLinePart, text: FactLineTipText, inline: boolean): ReactNode {
  if (!isEntity(part)) return part as ReactNode;
  const name = part.lang ? <span lang={part.lang}>{part.text}</span> : part.text;
  if (!hasContent(part.tip)) return name;
  if (!text.locale || !text.hint) {
    throw new Error(
      'FactLine: an entity value needs `locale` and `hint` (ui.pinHint), on the line or on FactLines (DP1).',
    );
  }
  return (
    <NestedEntity
      tip={part.tip}
      href={part.href}
      placement="up"
      align="start"
      inline={inline}
      locale={text.locale}
      hint={text.hint}
      shinyLabel={text.shinyLabel}
      orLabel={text.orLabel}
    >
      {name}
    </NestedEntity>
  );
}

/** «Mundo» → «Mundo:»; a text label that already ends in a colon keeps it. */
function renderLabel(
  label: FactLinePart | FactLinePart[],
  text: FactLineTipText,
  inline: boolean,
): ReactNode {
  if (typeof label === 'string') return /:\s*$/.test(label) ? label : `${label}:`;
  const parts = Array.isArray(label) ? label : [label];
  return (
    <>
      {parts.map((part, index) => (
        <Fragment key={index}>{renderPart(part, text, inline)}</Fragment>
      ))}
      :
    </>
  );
}

export function FactLine({
  label,
  children,
  values,
  separator = SEPARATOR,
  locale,
  hint,
  shinyLabel,
  orLabel,
  className,
  ...rest
}: FactLineProps) {
  const list = useContext(FactLinesContext);
  const inList = list !== null;
  // A standalone line is a <p>: its panels must be phrasing content (7.5.2).
  const inline = !inList;
  const text: FactLineTipText = {
    locale: locale ?? list?.locale,
    hint: hint ?? list?.hint,
    shinyLabel: shinyLabel ?? list?.shinyLabel,
    orLabel: orLabel ?? list?.orLabel,
  };

  const source: FactLinePart[] = values ?? Children.toArray(children);
  const parts = source.filter((part) => !isEmpty(part));
  if (parts.length === 0) return null;

  const joined = parts.map((part, index) => (
    <Fragment key={index}>
      {index > 0 ? (
        <span className="ac-fact-line__sep" aria-hidden="true">
          {separator}
        </span>
      ) : null}
      {renderPart(part, text, inline)}
    </Fragment>
  ));
  const lineClass = className ? `ac-fact-line ${className}` : 'ac-fact-line';

  if (inList) {
    return (
      <div {...rest} className={lineClass}>
        <dt className="ac-fact-line__label">{renderLabel(label, text, false)}</dt>{' '}
        <dd className="ac-fact-line__value">{joined}</dd>
      </div>
    );
  }
  return (
    <p {...rest} className={lineClass}>
      <span className="ac-fact-line__label">{renderLabel(label, text, true)}</span>{' '}
      <span className="ac-fact-line__value">{joined}</span>
    </p>
  );
}

export function FactLines({
  layout = 'row',
  children,
  lines,
  locale,
  hint,
  shinyLabel,
  orLabel,
  className,
  ...rest
}: FactLinesProps) {
  const drawn = lines?.filter((line) => line.values.some((part) => !isEmpty(part)));
  if (drawn ? drawn.length === 0 : Children.count(children) === 0) return null;

  return (
    <dl
      {...rest}
      className={[
        'ac-fact-lines',
        layout === 'column' ? 'ac-fact-lines--column' : 'ac-fact-lines--row',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <FactLinesContext.Provider value={{ locale, hint, shinyLabel, orLabel }}>
        {drawn
          ? drawn.map((line, index) => (
              <FactLine
                key={line.key ?? index}
                label={line.label}
                values={line.values}
                separator={line.separator}
                className={line.className}
              />
            ))
          : children}
      </FactLinesContext.Provider>
    </dl>
  );
}
