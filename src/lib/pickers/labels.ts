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
}

export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.hasOwn(values, key) ? String(values[key]) : match,
  );
}
