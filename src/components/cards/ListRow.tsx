import { isValidElement } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';

import { NestedEntity } from '@/components/game/NestedEntity';
import { PokemonArt } from '@/components/game/ShinyMark';
import type { Locale } from '@/i18n/config';
import { formatInteger } from '@/lib/format/numbers';
import { UNKNOWN, present } from '@/lib/format/unknown';
import type { TipData } from '@/lib/game/tips';

// ListRow (spec 7.2.6, 7.5.5, 7.5.10, 7.7.4 V4; DS:ListRow): one row of the Lista view,
// inside a `DataTable` with `hover` and `caption`: the sprite cell, the name, which opens
// the in-game tooltip of the entity, and the columns of the grid.
//
// Markup and `ac-list-row*` classes are the reference's (`bundle.js` ListRow), so
// list-row.css ports `bundle.css` unchanged. What the site does differently:
//
//   - The tooltip belongs to the delegated controller of 7.5.4 (src/scripts/game-tooltip.ts),
//     not to this row. The name is a `NestedEntity` with the `row` placement and the row
//     carries `data-ac-tt-row`: hovering the row opens the panel of its name (TT10), which
//     is why no cell before the name may hold another entity, and the panel opens 12 px to
//     the right of the name cell, never to the left over the sprite. The DS's `up` does not
//     exist: the controller lines the panel up with the row bottom on the low rows (7.5.5).
//   - `tip` is `TipData` (DP3), and the texts of the panel arrive by props (DP1): `hint`
//     is `ui.pinHint`, `shinyLabel` is `ui.shiny`, `orLabel` is `ui.or`.
//   - Without a `tip` the name is a plain link to the entity's page (R2), and without a
//     page either it is text. There is no `#` fallback (WG5).
//   - A cell with no value shows «—» (C-R5, 8.0.5): a column of the grid is a key some
//     other row has, and a table cell is one of the two places the dash exists.
//   - `id` lands on the `tr`: the anchor of the entity in this view (H7).
//   - `lead` holds the cells a family writes between the sprite and the name, such as the
//     «Nº» of the Pokédex (8.2: Sprite · Nº · Nombre · …). The DS row has no such cells, so
//     a table that put the number in `cells` would print it under the «Nombre» header.
//     Only text goes there: a lead cell never holds another entity (TT10).
//   - `defaultOpen` is a preview prop and is not implemented (DP5).
//   - `art` (plan «Shiny» and «?»): the Pokémon art of the sprite cell, drawn by this row at
//     40 — the golden glow when shiny, the client Pokédex «?» without art or when it fails —
//     so the Lista draws a Pokémon exactly as its slot and its card do. The Tier and element
//     cells of the Pokédex Lista are `TierValue` and `ElementIcon`, passed in `cells`.
//
// The whole row is never a link and never a trigger (7.5.10): the name is.

/** A cell that differs from the centred default: `{ content, align, nowrap, small }`. */
export interface ListRowCell {
  content: ReactNode;
  align?: 'left';
  /** Never wraps («Titan 1», «hace 12 min»). */
  nowrap?: boolean;
  /** 12/16 («Publicado»). */
  small?: boolean;
}

interface ListRowBaseProps extends Omit<HTMLAttributes<HTMLTableRowElement>, 'children'> {
  /**
   * Content of the sprite cell, centred: a `SpriteStage` of 40 (drops), the art at 40
   * (Pokédex), or inside the 48 box of a listing with `frame`.
   */
  sprite?: ReactNode;
  /**
   * Pokémon art for the sprite cell, drawn at 40 with `PokemonArt`: the URL
   * (`resolvePokemonImage`) or `null` for the «?», and the Shiny glow. It replaces `sprite`.
   */
  art?: { src: string | null; shiny?: boolean; loading?: 'lazy' | 'eager' };
  /** `framed`: the 48 box of a listing, with its frame and stack count. `box`: the same box unframed. */
  frame?: 'framed' | 'box';
  /** Stack count in the framed box; 0 and an empty text draw nothing. */
  qty?: number | string | null;
  /** The name of the entity. */
  name: ReactNode;
  /** Page of the entity. Without it the trigger is a button, or plain text without `tip`. */
  href?: string;
  /** 12/16 line under the name in `text-tertiary`, two lines at most. */
  sub?: ReactNode;
  /** Cells between the sprite and the name, in the order of their columns («Nº», 8.2). */
  lead?: (ReactNode | ListRowCell)[];
  /** The other cells, after the name, in the order of the columns of the `DataTable`. */
  cells?: (ReactNode | ListRowCell)[];
  /** A last row that is not the last child of its table body. */
  last?: boolean;
  /** `drops` (the default): cells 0 16, row 48. `pokedex`: sprite cell 4 12. `listing`: cells 0 12, row 64. */
  variant?: 'drops' | 'pokedex' | 'listing';
  nameAlign?: 'left' | 'center';
  /** Picks the format of the stack count and of the amounts of the panel (C-R3). */
  locale: Locale;
}

interface ListRowTipProps {
  /** The in-game tooltip of the entity, built by `src/lib/game/tips.ts` (7.5.3). */
  tip: TipData;
  /** Strip of the panel, `ui.pinHint`: «Mantén Shift para fijar» / «Hold Shift to pin». */
  hint: string;
  /** Accessible name of the Shiny mark in the panel head (13.4). */
  shinyLabel?: string;
  /** The word between two price options in the panel, `ui.or` (13.3). */
  orLabel?: string;
}

interface ListRowPlainProps {
  tip?: undefined;
  hint?: undefined;
  shinyLabel?: undefined;
  orLabel?: undefined;
}

export type ListRowProps = ListRowBaseProps & (ListRowTipProps | ListRowPlainProps);

const VARIANTS = ['drops', 'pokedex', 'listing'] as const;

function classes(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(' ');
}

function isCellObject(cell: ReactNode | ListRowCell): cell is ListRowCell {
  return (
    cell !== null &&
    typeof cell === 'object' &&
    !isValidElement(cell) &&
    !Array.isArray(cell) &&
    'content' in cell
  );
}

/** The dash for a value the row does not have (8.0.5); any node is kept as it is. */
function orDash(value: ReactNode): ReactNode {
  if (value === null || value === undefined) return UNKNOWN;
  if (typeof value === 'string' && !present(value)) return UNKNOWN;
  return value;
}

/** One data cell: centred by default, «—» when it has no value. */
function Cell({ cell }: { cell: ReactNode | ListRowCell }) {
  const object = isCellObject(cell);
  return (
    <td
      className={classes(
        'ac-list-row__cell',
        object && cell.align === 'left' && 'ac-list-row__cell--left',
        object && cell.nowrap && 'ac-list-row__cell--nowrap',
        object && cell.small && 'ac-list-row__cell--small',
      )}
    >
      {orDash(object ? cell.content : cell)}
    </td>
  );
}

/** Size of the Pokémon art in the sprite cell (the 40 of the row). */
const ART = 40;

export function ListRow({
  sprite,
  art: pokemon,
  frame,
  qty,
  name,
  href,
  sub,
  tip,
  hint,
  shinyLabel,
  orLabel,
  lead = [],
  cells = [],
  last = false,
  variant = 'drops',
  nameAlign = 'left',
  locale,
  className,
  ...rest
}: ListRowProps) {
  let trigger: ReactNode;
  if (tip !== undefined) {
    if (hint === undefined) throw new Error('ListRow: a row with `tip` needs `hint` (DP1).');
    trigger = (
      <NestedEntity
        tip={tip}
        href={href}
        variant="link"
        placement="row"
        locale={locale}
        hint={hint}
        shinyLabel={shinyLabel}
        orLabel={orLabel}
      >
        {name}
      </NestedEntity>
    );
  } else if (href !== undefined) {
    trigger = (
      <a href={href} className="ac-list-row__link">
        {name}
      </a>
    );
  } else {
    trigger = name;
  }

  // `framed`: the 48 listing box with its stack count; `box`: the same box without a frame.
  let art: ReactNode =
    pokemon === undefined ? (
      sprite
    ) : (
      <PokemonArt src={pokemon.src} size={ART} shiny={pokemon.shiny} loading={pokemon.loading} />
    );
  if (frame === 'framed' || frame === 'box') {
    const count = typeof qty === 'number' ? formatInteger(qty, locale) : qty;
    const stack = qty === undefined || qty === null || qty === '' || qty === 0 ? null : count;
    art = (
      <span
        className={frame === 'framed' ? 'ac-list-row__frame' : 'ac-list-row__box'}
        aria-hidden="true"
      >
        {art}
        {frame === 'framed' && stack !== null ? (
          <span className="ac-list-row__qty">{stack}</span>
        ) : null}
      </span>
    );
  }

  const kind = (VARIANTS as readonly string[]).includes(variant) ? variant : 'drops';

  return (
    <tr
      {...rest}
      className={classes(
        'ac-list-row',
        `ac-list-row--${kind}`,
        last && 'ac-list-row--last',
        className,
      )}
      data-ac-tt-row={tip !== undefined ? '' : undefined}
    >
      <td className="ac-list-row__cell ac-list-row__sprite">
        <span className="ac-list-row__sprite-in">{art}</span>
      </td>
      {lead.map((cell, index) => (
        <Cell key={`l${index}`} cell={cell} />
      ))}
      <td
        className={classes(
          'ac-list-row__cell',
          'ac-list-row__name',
          nameAlign === 'center' && 'ac-list-row__name--center',
        )}
      >
        <div className="ac-list-row__name-in">
          {trigger}
          {sub !== undefined && sub !== null && sub !== '' ? (
            <span className="ac-list-row__sub">{sub}</span>
          ) : null}
        </div>
      </td>
      {cells.map((cell, index) => (
        <Cell key={`c${index}`} cell={cell} />
      ))}
    </tr>
  );
}
