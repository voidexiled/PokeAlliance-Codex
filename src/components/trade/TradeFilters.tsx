import { useId } from 'react';
import type { ReactNode } from 'react';

import { Glyph } from '@/components/icons/Glyph';
import { Sprite } from '@/components/game/Sprite';
import type { SpriteData } from '@/lib/sprites/resolve';
import type { Locale } from '@/i18n/config';
import type { MessageLeaf } from '@/i18n/messages/types';
import { fill } from '@/i18n/messages/types';
import { formatInteger } from '@/lib/format/numbers';
import { TIPOS_ACTIVO } from '@/lib/trade/types';
import type { TipoActivo } from '@/lib/trade/types';

// The filters of the Comercio list, board Comercio-filtros «Variante 2» (owner decision
// 2026-09-24) and its phone board (Comercio-filtros-movil):
//
//   - `TypeRail`: the asset type in a rail on the left, «Todos» first, each option with the count
//     of the listings it would show under the other filters. On a phone it is a row of chips that
//     scrolls sideways (trade-list.css).
//   - `FiltersButton`: one «Filtros» button with the number of active filters, beside the search.
//   - the panel of «Filtros» is TradeFiltersPanel.tsx, a chunk of its own that loads on the first
//     press (13.6);
//   - `FilterTokens`: one token per active group («Mundo Titan 1 ×») and «Limpiar filtros» from
//     two tokens on; none of them touches the order or the view.
//
// Every text arrives by props (DP1).

/**
 * The texts the list needs before «Filtros» opens (DP1): the button, the tokens and «Limpiar
 * filtros», and the names the tokens and the panel share.
 */
export interface TradeFilterLabels {
  /** «Filtros». */
  open: string;
  /** «Limpiar filtros», after the tokens. */
  clearAll: string;
  /** «Quitar filtro {name}»: the name of a token's cross. */
  remove: string;
  /** «desde {min}», «hasta {max}»: a price token with one end. */
  from: string;
  upTo: string;
  /** The groups: «Mundo», «Precio», «Vendedor»; the pickers' tokens: «Pokémon», «Item». */
  world: string;
  price: string;
  seller: string;
  pokemon: string;
  item: string;
  /** «4.5 o más»… by threshold. */
  ratings: Readonly<Record<string, string>>;
}

/**
 * The texts only the open panel reads (TradeFiltersPanel.tsx). They travel in a JSON script of the
 * page (`TRADE_PANEL_TEXTS_ID`), not in the island's props (13.6: 20 KB), and are read when the
 * panel first opens.
 */
export interface TradePanelLabels {
  /** «Limpiar», the panel's own. */
  clear: string;
  /** «Todos los mundos», «tu personaje», the note of the Pokédólares. */
  allWorlds: string;
  yourCharacter: string;
  worldNote: string;
  /** «Moneda», «Todas», «Mín», «Máx», their hidden labels, the help and the line without currency. */
  currency: string;
  allCurrencies: string;
  min: string;
  max: string;
  minLabel: string;
  maxLabel: string;
  amountHelp: string;
  pickCurrency: string;
  /** «Valoración», «Todas», the note of the thresholds, «Solo en el juego» and its note. */
  rating: string;
  allRatings: string;
  ratingNote: string;
  onlyInGame: string;
  inGameNote: string;
  /** «Ver {n} anuncios»: the foot of the phone sheet. */
  show: MessageLeaf;
  /** `ui.close`. */
  close: string;
}

/** The id of the page's JSON script with the panel's texts. */
export const TRADE_PANEL_TEXTS_ID = 'ac-comercio-filtros-textos';

// ------------------------------------------------------------------------------ the rail

export interface TypeRailProps {
  /** «Tipo de activo», «Todos» and the name of each type. */
  labels: { type: string; allTypes: string; types: Readonly<Record<TipoActivo, string>> };
  /** The chosen type, or `null` for «Todos». */
  value: TipoActivo | null;
  /** Listings each option would show; `all` is «Todos». */
  counts: Readonly<Record<TipoActivo | 'all', number>>;
  sprites: Readonly<Record<TipoActivo, SpriteData | null>>;
  locale: Locale;
  onChange: (value: TipoActivo | null) => void;
}

/** The asset type rail (Variante 2): a group of pressed buttons with their counts. */
export function TypeRail({ labels, value, counts, sprites, locale, onChange }: TypeRailProps) {
  const nameId = useId();
  const options: { key: TipoActivo | null; label: string; count: number }[] = [
    { key: null, label: labels.allTypes, count: counts.all },
    ...TIPOS_ACTIVO.map((tipo) => ({ key: tipo, label: labels.types[tipo], count: counts[tipo] })),
  ];
  return (
    <div className="ac-trade-rail" role="group" aria-labelledby={nameId}>
      <p id={nameId} className="ac-trade-rail__label">
        {labels.type}
      </p>
      <ul className="ac-trade-rail__list">
        {options.map((option) => {
          const sprite = option.key === null ? null : sprites[option.key];
          return (
            <li key={option.key ?? 'all'}>
              <button
                type="button"
                className="ac-trade-rail__option"
                aria-pressed={value === option.key}
                onClick={() => onChange(option.key)}
              >
                <span className="ac-trade-rail__sprite" aria-hidden="true">
                  {sprite !== null ? (
                    <Sprite {...sprite} alt="" />
                  ) : option.key === null ? null : (
                    <span className="ac-trade-rail__missing" />
                  )}
                </span>
                <span className="ac-trade-rail__name">{option.label}</span>
                <span className="ac-trade-rail__count">{formatInteger(option.count, locale)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------- the button

export interface FiltersButtonProps {
  label: string;
  /** Active filter groups: the number on the button. */
  count: number;
  locale: Locale;
  expanded: boolean;
  /** The panel's id, once it exists. */
  controls?: string;
  onClick: () => void;
}

export function FiltersButton({
  label,
  count,
  locale,
  expanded,
  controls,
  onClick,
}: FiltersButtonProps) {
  return (
    <button
      type="button"
      className="ac-trade-filters__button"
      aria-expanded={expanded}
      aria-controls={controls}
      onClick={onClick}
    >
      {label}
      {count > 0 ? (
        <span className="ac-trade-filters__badge">{formatInteger(count, locale)}</span>
      ) : null}
      <Glyph name={expanded ? 'chevron-up' : 'chevron-down'} size={12} />
    </button>
  );
}

// ---------------------------------------------------------------------------- the tokens

/** One active group: its name, what it holds, and what removes it. */
export interface FilterToken {
  key: string;
  name: string;
  value: ReactNode;
  /** The value as text, for the name of the cross. */
  text: string;
  onRemove: () => void;
}

export interface FilterTokensProps {
  tokens: readonly FilterToken[];
  labels: Pick<TradeFilterLabels, 'remove' | 'clearAll'>;
  onClearAll: () => void;
}

export function FilterTokens({ tokens, labels, onClearAll }: FilterTokensProps) {
  if (tokens.length === 0) return null;
  return (
    <div className="ac-trade-tokens">
      <ul className="ac-trade-tokens__list">
        {tokens.map((token) => (
          <li key={token.key} className="ac-trade-tokens__token">
            <span className="ac-trade-tokens__name">{token.name}</span>
            <span className="ac-trade-tokens__value">{token.value}</span>
            <button
              type="button"
              className="ac-trade-tokens__remove"
              aria-label={fill(labels.remove, { name: `${token.name} ${token.text}` })}
              onClick={token.onRemove}
            >
              <Glyph name="close" size={12} />
            </button>
          </li>
        ))}
      </ul>
      {tokens.length > 1 ? (
        <button type="button" className="ac-trade-tokens__clear" onClick={onClearAll}>
          {labels.clearAll}
        </button>
      ) : null}
    </div>
  );
}
