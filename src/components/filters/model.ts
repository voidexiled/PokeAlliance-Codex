// The pure half of the filter toolbar (plan «Dirección C»): what a filter button declares and
// how its values travel. What only the menus need — a click, the arrow keys, the Tier ladder —
// is ./menu-model.ts, which loads with them (13.6). No DOM and no React, so
// tests/lists/filter-model.test.ts runs both as they are.
//
// A filter's values travel as the list controller keeps them: one comma-joined string per URL
// key (`?tipo=flying,psychic`, src/lib/lists/state.ts). `join` is the rule the list applies and
// the token spells: `all` («Tipo [Volador] y [Psíquico]», a row has every value) or `any`
// («Tipo de moveset [Psíquico] o [Agua]», one is enough).

/** How the values of one filter combine: every one (`all`, «y») or any one (`any`, «o»). */
export type FilterJoin = 'all' | 'any';

/**
 * The menu a filter opens: the 6 × 3 grid of element sprites (Tipo, Tipo de moveset), the Tier
 * ladder, or a row of text slots led by «Todas» (Variante, Generación).
 */
export type FilterKind = 'elements' | 'tiers' | 'segment';

/** A value of a filter: the id the URL writes and the text the registry gives it. */
export interface FilterOption {
  id: string;
  label: string;
  /** Tier only: «Max brokes» of content/tiers.json, `null` = «—». */
  maxBrokes?: number | null;
}

/** One button of the toolbar and the menu it opens. */
export interface FilterDef {
  /** The URL key of the list (`tipo`, `moveset`, `tier`, `variante`, `gen`). */
  key: string;
  /** The button's name («Tipo»), the menu title and the token's lead. */
  label: string;
  kind: FilterKind;
  options: readonly FilterOption[];
  join: FilterJoin;
  /** Most values it keeps (Tipo: 2); the other options dim with `aria-disabled` at the cap. */
  max?: number;
  /** The grey rule line under the menu title («Hasta 2; debe tener ambos.»). */
  hint?: string;
}

/** The chosen ids of a comma-joined value, in its order; `[]` for none. */
export function splitValues(raw: string | undefined | null): string[] {
  return raw ? raw.split(',').filter((value) => value !== '') : [];
}

/** The comma-joined value of a list of ids, `null` for none (the list controller clears it). */
export function joinValues(values: readonly string[]): string | null {
  return values.length === 0 ? null : values.join(',');
}
