import '@/styles/components/worlds-table.css';

import { useId } from 'react';

import type { Locale } from '@/i18n/config';

// WorldsTable (spec 7.2.7, 8.1 step 4, X3, PZ-05; DS:WorldsTable; CARD_GRID_SYSTEM §6.5): the
// worlds of the game in the bento of the home, one row per record of content/mundos.json with the
// name the game gives it, which reads the same in both languages (§3.13).
//
// X3 and PZ-05: the site has no source of players online until `/api/mundos` (§15), and a column
// with no value in any row would be filler (G7). So the table has the «Mundo» column alone, no
// sort button and no island: the rows are the names in numeric order (`Intl.Collator` with
// `numeric: true`, §3.13), «Moon, Sun, Titan 1, Titan 2, Titan 3», and «Titan 10» after «Titan 2».
// The header carries no `aria-sort`: as in `DataTable`, that attribute goes with a sort button, and
// here there is none to press. Nothing in the table takes focus, so the tab order of the bento is
// the one of its panels (8.1 step 4). When `online` arrives, the table grows its second column and
// its sort buttons in a `client:visible` island (7.3), and the bento revisits its placement.
//
// Markup and classes of the reference (`bundle.js` WorldsTable, C-R2), without what X3 takes out:
// a `section` named by its visually hidden h2 «Mundos» / «Worlds» (8.1), the table, and one row
// per world. In the reference the name is the header of its row (`th scope="row"`) because the
// row carries a figure; with the name alone, the name is the datum of its row, so it is a `td`
// under the «Mundo» column header, with the same class: a row header that heads no cell is what
// axe reports as `th-has-data-cells`. It goes back to a row header with the «En línea» column.
// The table also carries its title as its hidden caption: every table of the site has one (WA2),
// and a table the reader reaches by its own shortcut still has its name. With no world there is
// no table (8.1 step 4): its area of the bento stays empty and the other panels keep theirs.
//
// Texts come from the dictionary of the page (DP1); `locale` picks the collation of the names and
// never a text. `area` names the cell of the bento this table fills (`data-area`): home-bento.css
// places it there with `grid-template-areas`, never with an inline position (IN4). Styles:
// worlds-table.css, a per-page sheet this module imports (D-018). TSX, rendered on the server with
// no client directive: it ships no JavaScript.

/** A world of content/mundos.json: `id` in kebab-case, `nombre` as the game writes it. */
export interface World {
  id: string;
  name: string;
}

export interface WorldsTableProps {
  /** The worlds of the registry, in any order: the table sorts a copy. */
  worlds: readonly World[];
  /** The hidden h2 and caption: «Mundos» / «Worlds». */
  title: string;
  /** Column headers: `world` is «Mundo» / «World». */
  labels: { world: string };
  /** Language of the page: the collation of the names. */
  locale: Locale;
  /** Id of the hidden h2, which names the section; `useId` when absent (C-R4). */
  id?: string;
  /** Cell of the bento (`data-area`), e.g. `mundos`. */
  area?: string;
  /** Utilities added by the caller on the section, after the component's class (3.8). */
  className?: string;
}

/** The worlds by name in numeric order (§3.13): «Titan 2» before «Titan 10». */
export function sortWorlds(worlds: readonly World[], locale: Locale): World[] {
  const collator = new Intl.Collator(locale, { numeric: true });
  return [...worlds].sort((a, b) => collator.compare(a.name, b.name));
}

export function WorldsTable({
  worlds,
  title,
  labels,
  locale,
  id,
  area,
  className,
}: WorldsTableProps) {
  const autoId = useId();
  if (worlds.length === 0) return null;

  const titleId = id ?? autoId;
  return (
    <section
      className={className ? `ac-worlds-table ${className}` : 'ac-worlds-table'}
      aria-labelledby={titleId}
      data-area={area}
    >
      <h2 id={titleId} className="sr-only">
        {title}
      </h2>
      <table className="ac-worlds-table__table">
        <caption className="sr-only">{title}</caption>
        <thead>
          <tr>
            <th scope="col" className="ac-worlds-table__th ac-worlds-table__th--name">
              {labels.world}
            </th>
          </tr>
        </thead>
        <tbody>
          {sortWorlds(worlds, locale).map((world) => (
            <tr key={world.id}>
              <td className="ac-worlds-table__name">{world.name}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
