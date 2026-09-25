import { assetSrc } from '@/lib/assets/version';
import { MissingSprite } from '@/components/game/SpriteStage';
import type { Locale } from '@/i18n/config';
import { formatPokedolares, formatPokedolaresLabel } from '@/lib/format/numbers';
import { UNKNOWN } from '@/lib/format/unknown';
import { spriteOrNull } from '@/lib/sprites/resolve';
import moneySprites from 'virtual:ac-money-sprites';

// PokedolaresAmount (spec 7.2.5, 7.8, 4.3, R5, S8; DS:PokedolaresAmount, DS:guias/40): an
// amount of the game's money with the Pokédólares sprite right before the figure, written
// the way the players write it — 850, 2,5k, 150kk, 1.200kk — while a screen reader hears
// the exact figure with its currency: «150.000.000 Pokédólares».
//
// Markup of the reference (`bundle.js` PokedolaresAmount), which tests/e2e/money.spec.ts
// reads: the sprite box `__sprite` first, then the short form in an `aria-hidden` span,
// then the exact figure visually hidden (`.ac-sr` of the reference is the `sr-only`
// utility, spec 3.7). The sprite is 32 at 1x with margins −8 2 −8 −3 (money.css), so the
// line stays 16 tall and the sprite sits 4 px from the figure.
//
// The sprite is the fixed registry key `ui/pokedolares`, which this component resolves
// through the adapter on its own (DP2, the `AC.assets` of the design system): no caller
// passes a URL. It is resolved once per bundle from `virtual:ac-money-sprites`, the
// registry cut down in the build to the two money entries (astro.config.mjs), so an
// island that shows an amount does not carry the whole registry (D-015, 13.6). A registry
// without the key gives `null` (FIXED_SPRITE_KEYS) and the missing mark takes the
// sprite's place, never another icon (R11).
//
// The short form and the spoken figure both come from src/lib/format/numbers.ts
// (`formatPokedolares`, `formatPokedolaresLabel`, spec 13.3): the currency word, singular
// included («1 Pokédólar»), is part of that formatter, and `locale` only picks it and the
// separators (C-R3). An unknown amount is the dash with no sprite (spec 4.3).

/** `ui/pokedolares` through the adapter (DP2): 32 × 32, one frame. */
const SPRITE = spriteOrNull(moneySprites, 'ui/pokedolares');

export interface PokedolaresAmountProps {
  /**
   * Whole units of the currency, as the registries keep them (R5): 150000000 is 150kk.
   * `null` or `undefined` is an unknown amount: «—», without a sprite.
   */
  amount: number | null | undefined;
  /** Picks the separators and the currency word the formatter writes (C-R3). */
  locale: Locale;
  /** The amount in 700. */
  strong?: boolean;
  /** Utilities added by the caller, after the component's own classes (3.8). */
  className?: string;
}

function classes(...values: (string | false | undefined)[]): string {
  return values.filter(Boolean).join(' ');
}

export function PokedolaresAmount({
  amount,
  locale,
  strong = false,
  className,
}: PokedolaresAmountProps) {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) {
    return <span className={classes('ac-pokedolares-amount', className)}>{UNKNOWN}</span>;
  }

  return (
    <span
      className={classes(
        'ac-pokedolares-amount',
        strong && 'ac-pokedolares-amount--strong',
        className,
      )}
    >
      <span className="ac-pokedolares-amount__sprite" aria-hidden="true">
        {SPRITE ? (
          <img
            className="ac-pokedolares-amount__img"
            src={assetSrc(SPRITE.src)}
            alt=""
            width={SPRITE.size[0]}
            height={SPRITE.size[1]}
            decoding="async"
            draggable={false}
          />
        ) : (
          <MissingSprite size={16} />
        )}
      </span>
      <span aria-hidden="true">{formatPokedolares(amount, locale)}</span>
      <span className="sr-only">{formatPokedolaresLabel(amount, locale)}</span>
    </span>
  );
}
