import { Fragment } from 'react';

import { Sprite } from '@/components/game/Sprite';
import { Glyph } from '@/components/icons/Glyph';
import { elementSprite } from '@/lib/pickers/sprites';

import { splitValues } from './model';
import type { FilterDef } from './model';
import type { FilterText } from './text';

// ActiveFilterTokens (plan «Dirección C»): under the toolbar, one rounded token per active
// filter that spells its rule — the filter's name, its values joined by «y» (every one, Tipo)
// or «o» (any one) and a × that removes the whole filter — then «Limpiar filtros». Element
// values are their 24 px sprites, named for assistive technology; the others their text. The
// default export is a chunk of its own (`FilterToolbar` loads it once a filter is active).

export interface ActiveFilterTokensProps {
  /** The filters with a value, in the toolbar's order. */
  filters: readonly FilterDef[];
  values: Readonly<Record<string, string>>;
  onRemove: (key: string) => void;
  onClearAll: () => void;
  text: FilterText;
}

export default function ActiveFilterTokens({
  filters,
  values,
  onRemove,
  onClearAll,
  text,
}: ActiveFilterTokensProps) {
  return (
    <div role="group" aria-label={text.active} className="ac-filter-tokens">
      {filters.map((filter) => {
        const names = new Map(filter.options.map((option) => [option.id, option.label]));
        const chosen = splitValues(values[filter.key]).filter((id) => names.has(id));
        if (chosen.length === 0) return null;
        const joiner = filter.join === 'all' ? text.and : text.or;
        return (
          <span key={filter.key} className="ac-filter-token">
            <span>{filter.label}</span>
            <span className="ac-filter-token__values">
              {chosen.map((id, index) => {
                const name = names.get(id) ?? id;
                const sprite = filter.kind === 'elements' ? elementSprite(id, 24) : null;
                return (
                  <Fragment key={id}>
                    {index > 0 ? <span className="ac-filter-token__joiner">{joiner}</span> : null}
                    {sprite ? (
                      <span
                        role="img"
                        aria-label={name}
                        title={name}
                        className="ac-filter-token__icon"
                      >
                        <Sprite {...sprite} alt="" />
                      </span>
                    ) : (
                      <span className="ac-filter-token__value">{name}</span>
                    )}
                  </Fragment>
                );
              })}
            </span>
            <button
              type="button"
              className="ac-filter-token__remove"
              aria-label={text.remove.replace('{label}', filter.label)}
              onClick={() => onRemove(filter.key)}
            >
              <Glyph name="close" size={12} />
            </button>
          </span>
        );
      })}
      <button type="button" className="ac-filter-tokens__clear" onClick={onClearAll}>
        {text.clearAll}
      </button>
    </div>
  );
}
