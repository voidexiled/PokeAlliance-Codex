import type { Messages } from '@/i18n/messages/en';

// The texts of the filter toolbar, gathered once by the root that draws it from `ui.filterBar`
// of the page's language (13.2). The toolbar never writes a word of its own: the filter names
// come in each `FilterDef`, the rest from here.

export interface FilterText {
  /** «Filtros»: the name of the toolbar. */
  toolbar: string;
  /** «Filtros activos»: the name of the token row. */
  active: string;
  /** «Limpiar», top-right of a menu with a value. */
  clear: string;
  /** «Limpiar filtros», after the tokens. */
  clearAll: string;
  /** «Quitar filtro: {label}». */
  remove: string;
  /** «{count} de {max}», the counter of a capped menu. */
  countOfMax: string;
  /** «{n} elegidos», or `''` to leave the count to its visible figure. */
  chosen: string;
  /** «Máx. {max}: quita uno.», the tooltip line of a dimmed option. */
  maxHint: string;
  /** «Todas», the first option of a segment menu. */
  all: string;
  and: string;
  or: string;
  /** «Max brokes», the tier tooltip row. */
  maxBrokes: string;
  /** «Por página». */
  perPage: string;
  /** «Cerrar filtros», the × of the phone sheet. */
  close: string;
  /** «Ver {count}», or `''` to show the count alone. */
  show: string;
  /** Rule lines of the menus, `{max}` already filled where it has one. */
  hints: { type: (max: number) => string; moveset: string; tier: string };
}

/** The toolbar texts of a page from its dictionaries. */
export function filterText(ui: Pick<Messages['ui'], 'filterBar'>): FilterText {
  const bar = ui.filterBar;
  return {
    toolbar: bar.label,
    active: bar.active,
    clear: bar.clear,
    clearAll: bar.clearAll,
    remove: bar.removeToken,
    countOfMax: bar.countOfMax,
    chosen: bar.chosen,
    maxHint: bar.maxHint,
    all: bar.all,
    and: bar.and,
    or: bar.or,
    maxBrokes: bar.maxBrokes,
    perPage: bar.perPage,
    close: bar.closeLabel,
    show: bar.show,
    hints: {
      type: (max) => bar.typeRuleHint.replace('{max}', String(max)),
      moveset: bar.movesetRuleHint,
      tier: bar.tierRuleHint,
    },
  };
}
