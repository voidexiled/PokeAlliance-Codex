// Keys the code reads with computed access — `messages.ui.views[view]`, a label
// picked by an enum — which `pnpm i18n:check` cannot see written as `.<key>` in
// any file (spec §13.2). Declaring one here is what keeps the check green.
//
// tests/i18n/messages.test.ts checks that every entry still exists in `es.ts`,
// so this list cannot hide a key that was deleted from the dictionary.
export const dynamicKeys = [
  // The list controller of spec §7.7 reads `messages.ui.views[view]` by the view
  // id (§13.2). `ViewToggle` itself spells `labels.cards`, `labels.slots` and
  // `labels.list`, so these three entries only matter once that controller reads
  // the labels with computed access.
  'ui.views.cards',
  'ui.views.slots',
  'ui.views.list',
  // `SearchPalette.tsx` writes `messages.groups[group.kind]`: the label of a
  // result group is picked by its `SearchKind`, so no file spells `.pokemon`,
  // `.sistema`, `.item`, `.actividad` or `.pagina` (spec §7.9.3, §8.6).
  'search.groups.pokemon',
  'search.groups.sistema',
  'search.groups.item',
  'search.groups.actividad',
  'search.groups.pagina',
  // The state of a listing is read by its value (`states[estado]`, `filters[estado]`): no
  // visible list shows a withdrawn listing, so only the seller's own views spell `.retirado`.
  'trade.states.retirado',
  'profile.listings.filters.retirado',
] as const satisfies readonly string[];
