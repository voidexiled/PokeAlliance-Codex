import '@/styles/components/filter-toolbar.css';

import { Suspense, lazy } from 'react';
import type { ReactNode } from 'react';

import { Glyph } from '@/components/icons/Glyph';

import { FilterMenuButton } from './FilterMenuButton';
import { splitValues } from './model';
import type { FilterDef } from './model';
import type { FilterText } from './text';

// FilterToolbar (plan «Dirección C», boards Main, Pokedex-Cards, Pokedex-movil, Tier-list and
// Selector-Pokemon): one calm row — the search field, then one 40 px button per filter that
// shows only a small count while it has values — and, under it, the active filters as
// removable tokens that spell their rule («Tipo [Volador] y [Psíquico] ×»). Each button opens
// its menu panel, loaded with `import()` on the first open; on a phone the buttons wrap and
// each menu opens as a bottom sheet. The tokens are a chunk of their own too: the prerendered
// page has no filter, so they are only asked for once one is chosen.
//
// The toolbar is controlled: `values` is the list controller's `filters` (one comma-joined
// value per key) and `onChange(key, value | null)` its `setFilter`. The Pokédex, the Tier list,
// Comercio and the Pokémon picker draw the same component with their own `FilterDef`s.

const ActiveFilterTokens = lazy(() => import('./ActiveFilterTokens'));

export interface FilterSearch {
  value: string;
  onChange: (value: string) => void;
  /** The accessible name of the field («Buscar en la Pokédex»). */
  label: string;
  placeholder: string;
}

export interface FilterToolbarProps {
  filters: readonly FilterDef[];
  values: Readonly<Record<string, string>>;
  onChange: (key: string, value: string | null) => void;
  /** Empties every filter (and the search): «Limpiar filtros». */
  onClearAll: () => void;
  text: FilterText;
  search?: FilterSearch;
  /** The list's count as the results bar writes it («37 variantes»), for the phone sheet. */
  count?: string;
  /** Anything the caller adds at the end of the row. */
  children?: ReactNode;
}

export function FilterToolbar({
  filters,
  values,
  onChange,
  onClearAll,
  text,
  search,
  count,
  children,
}: FilterToolbarProps) {
  // A filter with fewer than two options has nothing to choose (C-R5): no button.
  const shown = filters.filter((filter) => filter.options.length > 1);
  const active = shown.filter((filter) => splitValues(values[filter.key]).length > 0);
  return (
    <div className="ac-filter-toolbar">
      <div role="toolbar" aria-label={text.toolbar} className="ac-filter-toolbar__row">
        {search ? (
          <label className="ac-filter-search">
            <Glyph name="search" size={16} />
            <input
              type="search"
              className="ac-filter-search__input"
              aria-label={search.label}
              placeholder={search.placeholder}
              value={search.value}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => search.onChange(event.currentTarget.value)}
            />
          </label>
        ) : null}
        {shown.map((filter) => (
          <FilterMenuButton
            key={filter.key}
            filter={filter}
            values={splitValues(values[filter.key])}
            onChange={(value) => onChange(filter.key, value)}
            text={text}
            count={count}
          />
        ))}
        {children}
      </div>
      {active.length > 0 ? (
        <Suspense fallback={null}>
          <ActiveFilterTokens
            filters={active}
            values={values}
            onRemove={(key) => onChange(key, null)}
            onClearAll={onClearAll}
            text={text}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
