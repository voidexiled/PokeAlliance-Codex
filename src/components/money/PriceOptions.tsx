import { DiamondsAmount } from '@/components/money/DiamondsAmount';
import type { DiamondsLink } from '@/components/money/DiamondsAmount';
import { PokedolaresAmount } from '@/components/money/PokedolaresAmount';
import type { Locale } from '@/i18n/config';
import { UNKNOWN } from '@/lib/format/unknown';

// PriceOptions (spec 7.2.5, 7.8, 9.5.8, 9.5.9, 13.3; DS:PriceOptions, DS:guias/40): the
// in-game price of a listing, one option per currency joined by «o» — «900kk o 2.400
// Diamonds». Each option is a `PokedolaresAmount` or a `DiamondsAmount`, so every figure
// carries its sprite (S8) and is heard as the exact amount (R5).
//
// Each «o» travels with the option it introduces (DS:guias/40 §Opciones de precio): the
// options wrap as whole units, so an alternative that drops to the next line starts it
// with its own «o», right-aligned, 6 px between options and 8 between lines (money.css).
// Nothing is ever converted between currencies or added up (7.8).
//
// Three places, as in the design system: the «En el juego» row of a listing card (right
// aligned, the default), the «En el juego» cell of the Comercio Lista (`align="center"`)
// and the «En el juego:» row of a listing tooltip (`variant="tooltip"`), where the «o» is
// a plain white value and the Diamonds are not links. Outside a tooltip a Diamonds option
// opens the Diamonds panel when the caller passes `link` (placed `up` + `end` by default,
// the price row of 7.5.5); without it, or while the registry has no Diamonds row, the
// option is plain text (R2).
//
// The joining word is `ui.or` of the page's locale (DP1, 13.3). No options is the dash of
// an unknown value in a card fact or a table cell (C-R5); a tooltip never gets here without
// options, because its row is dropped (T32).

/** One in-game price option: a currency and its amount in whole units (spec 9.4, R5). */
export interface PriceOption {
  kind: 'pd' | 'dia';
  amount: number;
}

export interface PriceOptionsProps {
  /** The options in the order the seller gave them; nothing is sorted, merged or converted. */
  options: readonly PriceOption[];
  /** Picks the separators of the amounts (C-R3). */
  locale: Locale;
  /** The word between two options, `ui.or`: «o» / «or» (13.3). */
  orLabel: string;
  /** `end` (default): the right-aligned value of a card; `center`: a Lista cell. */
  align?: 'end' | 'center';
  /** `tooltip`: a row of a game tooltip, with a white «o» and no links. */
  variant?: 'default' | 'tooltip';
  /** The Diamonds panel its Diamonds options open (not in the `tooltip` variant). */
  link?: DiamondsLink;
  /** Utilities added by the caller, after the component's own classes (3.8). */
  className?: string;
}

function classes(...values: (string | false | undefined)[]): string {
  return values.filter(Boolean).join(' ');
}

export function PriceOptions({
  options,
  locale,
  orLabel,
  align = 'end',
  variant = 'default',
  link,
  className,
}: PriceOptionsProps) {
  const tooltip = variant === 'tooltip';

  if (options.length === 0) {
    return (
      <span className={classes('ac-price-options', 'ac-price-options--empty', className)}>
        {UNKNOWN}
      </span>
    );
  }

  return (
    <span
      className={classes(
        'ac-price-options',
        align === 'center' && 'ac-price-options--center',
        tooltip && 'ac-price-options--tooltip',
        className,
      )}
    >
      {options.map((option, index) => (
        // The options are the seller's fixed sequence, so their position is their identity.
        <span key={index} className="ac-price-options__option">
          {index > 0 ? <span className="ac-price-options__or">{orLabel}</span> : null}
          {option.kind === 'dia' ? (
            <DiamondsAmount
              amount={option.amount}
              locale={locale}
              link={tooltip ? undefined : link}
            />
          ) : (
            <PokedolaresAmount amount={option.amount} locale={locale} />
          )}
        </span>
      ))}
    </span>
  );
}
