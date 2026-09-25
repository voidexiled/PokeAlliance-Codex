import { useEffect, useId, useMemo, useRef } from 'react';
import type { FocusEvent } from 'react';

import { Button } from '@/components/controls/Button';
import { RangeField } from '@/components/controls/RangeField';
import type { RangeFieldValue } from '@/components/controls/RangeField';
import { ToggleGroup } from '@/components/controls/ToggleGroup';
import type { ToggleGroupOption } from '@/components/controls/ToggleGroup';
import { Glyph } from '@/components/icons/Glyph';
import { ItemPicker, PokemonPicker } from '@/components/pickers/pickers';
import type { Locale } from '@/i18n/config';
import type { MessageLeaf } from '@/i18n/messages/types';
import { fill, isPluralMessage, plural } from '@/i18n/messages/types';
import { formatInteger } from '@/lib/format/numbers';
import { itemOptions, pokemonOptions } from '@/lib/pickers/options';
import type { SpriteData } from '@/lib/sprites/resolve';
import type { PriceCurrency } from '@/lib/trade/draft';
import { portraitSprite } from '@/lib/trade/pickers';

import type { TradeFilterLabels, TradePanelLabels } from './TradeFilters';
import {
  itemPanel,
  pokemonPanel,
  type TradeContext,
  type TradeListPickerLabels,
  type TradeRow,
} from './TradeListRoot';

// The «Filtros» panel of the Comercio list, board Comercio-filtros «Variante 2» and its phone
// board: Mundo, Precio (currency, then min and max) and Vendedor (rating and «Solo en el juego»)
// in one wide panel that pushes the list down, and the «Pokémon» and «Ítem» pickers of 16.4.6
// under them. Every choice acts at once, «Limpiar» empties the groups, Escape or the cross closes
// it. It is a `<dialog>`: opened with `show()` it stays in the flow of the page; on a phone (under
// 48rem) `showModal()` makes it the bottom sheet of the phone board, with its veil and «Ver N
// anuncios». A chunk of its own (13.6): TradeListRoot.tsx loads it on the first press of
// «Filtros», with the pickers, which the first paint never needs.

/** The «Pokémon» and «Ítem» pickers (16.4.6): their options are what the rows name. */
export interface PanelPickers {
  labels: TradeListPickerLabels;
  rows: readonly TradeRow[];
  context: TradeContext;
  value: { pokemon: string[]; item: string[] };
  onPokemon: (ids: string[]) => void;
  onItem: (ids: string[]) => void;
}

/** The value of the panel: the filters of the URL it edits. */
export interface FiltersValue {
  mundo: string | null;
  moneda: PriceCurrency | null;
  val: string | null;
  presencia: boolean;
}

/** What the page's JSON script holds: the panel's texts and the pickers'. */
export interface TradePanelTexts {
  labels: TradePanelLabels;
  pickers: TradeListPickerLabels | null;
}

export interface FiltersPanelProps {
  /** The pickers of 16.4.6, when the list has them. */
  pickers?: PanelPickers | null;
  id: string;
  open: boolean;
  onClose: () => void;
  labels: TradeFilterLabels & TradePanelLabels;
  locale: Locale;
  /** Active groups: the number beside the title. */
  count: number;
  value: FiltersValue;
  /** `[id, nombre]` of every world, in the order of content/mundos.json. */
  worlds: readonly (readonly [string, string])[];
  /** The world of the signed-in account's main character: «tu personaje». */
  myWorld: string | null;
  currencies: readonly { value: PriceCurrency; label: string; sprite: SpriteData | null }[];
  ratingFloors: readonly string[];
  /** The price range as typed, and its handlers (the root keeps the typing state). */
  range: RangeFieldValue;
  rangeId: string;
  onRange: (next: RangeFieldValue) => void;
  onRangeBlur: (event: FocusEvent<HTMLFieldSetElement>) => void;
  /** Listings shown now: «Ver N anuncios» on the phone sheet. */
  total: number;
  onWorld: (world: string | null) => void;
  onCurrency: (currency: PriceCurrency | null) => void;
  onRating: (floor: string | null) => void;
  onInGame: (only: boolean) => void;
  onClear: () => void;
}

/** Under this width the panel is the phone's bottom sheet (Comercio-filtros-movil). */
const PHONE = '(width < 48rem)';

function counted(template: MessageLeaf, n: number, locale: Locale): string {
  const text = isPluralMessage(template) ? plural(locale, n, template) : template;
  return fill(text, { n: formatInteger(n, locale) });
}

export function FiltersPanel(props: FiltersPanelProps) {
  const { id, open, onClose, labels, locale, value } = props;
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Open: in the flow on a wide screen, modal on a phone; the dialog's own `close` event (Escape
  // on a modal) reports back.
  useEffect(() => {
    const dialog = ref.current;
    if (dialog === null) return;
    if (open && !dialog.open) {
      if (window.matchMedia(PHONE).matches) dialog.showModal();
      else dialog.show();
      dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog === null) return undefined;
    const closed = () => onCloseRef.current();
    dialog.addEventListener('close', closed);
    return () => dialog.removeEventListener('close', closed);
  }, []);

  const extra = usePickers(props.pickers ?? null, locale);

  const worldOptions: ToggleGroupOption[] = [
    { value: '', label: labels.allWorlds },
    ...props.worlds.map(([world, name]) => ({
      value: world,
      label:
        world === props.myWorld ? (
          <>
            <span>{name}</span>
            <span className="ac-trade-filters__mine">{labels.yourCharacter}</span>
          </>
        ) : (
          name
        ),
      ariaLabel: world === props.myWorld ? `${name}, ${labels.yourCharacter}` : undefined,
    })),
  ];
  const currencyOptions: ToggleGroupOption[] = [
    { value: '', label: labels.allCurrencies },
    ...props.currencies.map((currency) =>
      currency.sprite === null
        ? { value: currency.value, label: currency.label }
        : { value: currency.value, label: currency.label, sprite: currency.sprite },
    ),
  ];
  const ratingOptions: ToggleGroupOption[] = [
    { value: '', label: labels.allRatings },
    ...props.ratingFloors.map((floor) => ({ value: floor, label: labels.ratings[floor] ?? floor })),
  ];

  return (
    <dialog
      ref={ref}
      id={id}
      className="ac-trade-filters"
      aria-labelledby={titleId}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && ref.current?.open && !ref.current.matches(':modal')) {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <div className="ac-trade-filters__head">
        <h2 id={titleId} className="ac-trade-filters__title">
          {labels.open}
          {props.count > 0 ? (
            <span className="ac-trade-filters__title-count">
              {formatInteger(props.count, locale)}
            </span>
          ) : null}
        </h2>
        {props.count > 0 ? (
          <button type="button" className="ac-trade-filters__link" onClick={props.onClear}>
            {labels.clear}
          </button>
        ) : null}
        <button
          type="button"
          className="ac-trade-filters__close"
          aria-label={labels.close}
          onClick={onClose}
          data-autofocus=""
        >
          <Glyph name="close" size={14} />
        </button>
      </div>
      <div className="ac-trade-filters__groups">
        <section className="ac-trade-filters__group" aria-label={labels.world}>
          <h3 className="ac-trade-filters__name">{labels.world}</h3>
          <ToggleGroup
            label={labels.world}
            direction="column"
            className="ac-trade-filters__worlds"
            options={worldOptions}
            value={value.mundo ?? ''}
            onChange={(next) => props.onWorld(next || null)}
          />
          <p className="ac-trade-filters__note">{labels.worldNote}</p>
        </section>
        <section className="ac-trade-filters__group" aria-label={labels.price}>
          <h3 className="ac-trade-filters__name">{labels.price}</h3>
          <ToggleGroup
            label={labels.currency}
            labelHidden={false}
            className="ac-trade-filters__currencies"
            options={currencyOptions}
            value={value.moneda ?? ''}
            onChange={(next) => props.onCurrency((next || null) as PriceCurrency | null)}
          />
          {value.moneda === null ? (
            <p className="ac-trade-filters__note">{labels.pickCurrency}</p>
          ) : (
            <>
              <RangeField
                id={props.rangeId}
                legend={labels.price}
                placeholders={[labels.min, labels.max]}
                labels={[labels.minLabel, labels.maxLabel]}
                inputMode={
                  value.moneda === 'pokedolares'
                    ? 'text'
                    : value.moneda === 'diamonds'
                      ? 'numeric'
                      : 'decimal'
                }
                value={props.range}
                onChange={props.onRange}
                onBlur={props.onRangeBlur}
              />
              <p className="ac-trade-filters__note">{labels.amountHelp}</p>
            </>
          )}
        </section>
        <section className="ac-trade-filters__group" aria-label={labels.seller}>
          <h3 className="ac-trade-filters__name">{labels.seller}</h3>
          <ToggleGroup
            label={labels.rating}
            labelHidden={false}
            direction="grid"
            columns={2}
            className="ac-trade-filters__ratings"
            options={ratingOptions}
            value={value.val ?? ''}
            onChange={(next) => props.onRating(next || null)}
          />
          <p className="ac-trade-filters__note">{labels.ratingNote}</p>
          <button
            type="button"
            className="ac-toggle-group__item ac-trade-filters__ingame"
            aria-pressed={value.presencia}
            onClick={() => props.onInGame(!value.presencia)}
          >
            <span className="ac-presence__dot" data-presence="en_juego" aria-hidden="true" />
            {labels.onlyInGame}
          </button>
          <p className="ac-trade-filters__note">{labels.inGameNote}</p>
        </section>
        {extra !== null ? <div className="ac-trade-filters__extra">{extra}</div> : null}
      </div>
      <div className="ac-trade-filters__foot">
        <Button variant="solid" onClick={onClose}>
          {counted(labels.show, props.total, locale)}
        </Button>
      </div>
    </dialog>
  );
}

/** The pickers of 16.4.6 for the Pokémon and the items the rows name, or null without two of either. */
function usePickers(pickers: PanelPickers | null, locale: Locale) {
  const rows = pickers?.rows;
  const context = pickers?.context;
  const refs = context?.refs;
  const pokemonChoices = useMemo(
    () =>
      refs === undefined || rows === undefined || context === undefined
        ? []
        : pokemonOptions(
            Object.entries(refs.pokemon)
              .filter(([id]) => rows.some((row) => row.pokemon?.pokemon === id))
              .map(([id, ref]) => ({
                id,
                name: ref.nombre,
                number: null,
                types: [...ref.elementos],
                elementoMoveset: null,
                tier: ref.tier,
                shiny: ref.variante === 'shiny',
                generation: ref.generacion,
                sprite: portraitSprite(ref.imagen),
                tip: pokemonPanel(id, ref, context),
              })),
          ),
    [refs, rows, context],
  );
  const itemChoices = useMemo(
    () =>
      refs === undefined || rows === undefined || context === undefined
        ? []
        : itemOptions(
            Object.entries(refs.items)
              .filter(([id]) => rows.some((row) => row.item?.item === id))
              .map(([id, ref]) => ({
                id,
                name: ref.nombre,
                categoria: ref.categoria,
                sprite: ref.sprite,
                tip: itemPanel(id, ref, context),
              })),
          ),
    [refs, rows, context],
  );
  if (pickers === null || context === undefined || refs === undefined) return null;
  if (pokemonChoices.length < 2 && itemChoices.length < 2) return null;
  const base = {
    locale,
    labels: pickers.labels.picker,
    hint: context.ui.pinHint,
    shinyLabel: context.ui.shiny,
    orLabel: context.ui.or,
    multiple: true,
    optional: true,
  };
  const categoryNames = Object.fromEntries(
    Object.values(refs.items).flatMap((ref) =>
      ref.nombreCategoria === null ? [] : [[ref.categoria, ref.nombreCategoria]],
    ),
  );
  return (
    <>
      {pokemonChoices.length > 1 ? (
        <PokemonPicker
          {...base}
          name="pokemon"
          label={pickers.labels.pokemon}
          placeholder={pickers.labels.choosePokemon}
          options={pokemonChoices}
          value={pickers.value.pokemon}
          elements={Object.entries(refs.elementos).map(([id, ref]) => ({ id, name: ref.nombre }))}
          filterLabels={pickers.labels.filters}
          onChange={pickers.onPokemon}
        />
      ) : null}
      {itemChoices.length > 1 ? (
        <ItemPicker
          {...base}
          name="item"
          label={pickers.labels.item}
          placeholder={pickers.labels.chooseItem}
          options={itemChoices}
          value={pickers.value.item}
          categoryLabel={pickers.labels.category}
          categoryNames={categoryNames}
          onChange={pickers.onItem}
        />
      ) : null}
    </>
  );
}
