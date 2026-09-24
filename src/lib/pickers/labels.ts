// UI text of the pickers, handed down as props from the page dictionaries (src/i18n/messages,
// `pickers.*`). Counts are templates with `{n}` and names with `{name}`, so the labels stay
// serialisable when an .astro page passes them to an island.
export interface PickerLabels {
  /** «Buscar» / «Search» */
  search: string;
  /** «{n} resultados» / «{n} results» */
  results: string;
  /** «{n} elegidas» / «{n} selected» */
  selectedCount: string;
  /** «Listo» / «Done» */
  done: string;
  /** «Quitar» / «Remove» (the × of the trigger) */
  clear: string;
  /** «Quitar {name}» / «Remove {name}» (a slot of the tray) */
  removeItem: string;
  /** «Limpiar filtros» / «Clear filters» */
  clearFilters: string;
  /** «Ninguno» / «None» */
  none: string;
  /** «No hay coincidencias.» / «No matches.» */
  noMatches: string;
  /** «Cerrar» / «Close» */
  close: string;
  /** «Elegir» / «Choose»: the button of the detail pane. Without it the pane has no button. */
  choose?: string;
  /** «Enter elige · Esc cierra» / «Enter chooses · Esc closes»: the strip under the pane. */
  keysHint?: string;
  /**
   * «Máx. {max}: quita uno primero.» / «Max {max}: remove one first.»: the tooltip of a filter
   * slot dimmed by the filter's maximum (`{n}` works too).
   */
  maxHint?: string;
  /** «Limpiar» / «Clear»: top-right of a filter menu with a value. */
  menuClear?: string;
  /** «{n} de {max}» / «{n} of {max}»: next to the name of a filter menu with a maximum. */
  ofMax?: string;
  /** «y» / «and»: joins the values of an `all` filter in its token («Tipo [A] y [B]»). */
  and?: string;
}

export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.hasOwn(values, key) ? String(values[key]) : match,
  );
}
