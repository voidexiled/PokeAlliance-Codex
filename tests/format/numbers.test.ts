import { createElement } from 'react';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { GameTooltip } from '@/components/game/GameTooltip';
import { ChipRow } from '@/components/money/ChipRow';
import { DiamondsAmount } from '@/components/money/DiamondsAmount';
import { HeldStrip } from '@/components/money/HeldStrip';
import { PokedolaresAmount } from '@/components/money/PokedolaresAmount';
import { PriceOptions } from '@/components/money/PriceOptions';
import { Rating } from '@/components/money/Rating';
import { TrainingMeter } from '@/components/money/TrainingMeter';
import type { Locale } from '@/i18n/config';
import { en } from '@/i18n/messages/en';
import { es } from '@/i18n/messages/es';
import {
  formatDecimal,
  formatDiamonds,
  formatInteger,
  formatPercent,
  formatPokedolares,
  formatPokedolaresLabel,
  formatRating,
  formatRatingLabel,
  formatRealMoney,
  formatSigned,
  parsePokedolares,
} from '@/lib/format/numbers';
import { UNKNOWN } from '@/lib/format/unknown';
import type { TipData } from '@/lib/game/tips';
import { spriteRegistry } from '@/lib/sprites/registry';
import { spriteUrl } from '@/lib/sprites/resolve';

const MINUS = '\u2212';
const HARD_SPACE = '\u00a0';

// The k/kk table of spec 4.3, verified against formatKK of the design system bundle.
const POKEDOLARES_TABLE: [units: number, es: string, en: string][] = [
  [850, '850', '850'],
  [1_000, '1k', '1k'],
  [1_049, '1k', '1k'],
  [1_050, '1,1k', '1.1k'],
  [2_500, '2,5k', '2.5k'],
  [150_000, '150k', '150k'],
  [150_500, '150,5k', '150.5k'],
  [999_949, '999,9k', '999.9k'],
  [999_950, '1kk', '1kk'],
  [1_250_000, '1,3kk', '1.3kk'],
  [1_500_000, '1,5kk', '1.5kk'],
  [150_000_000, '150kk', '150kk'],
  [1_200_000_000, '1.200kk', '1,200kk'],
];

describe('formatInteger', () => {
  it('groups thousands with a dot in es, also with four digits', () => {
    expect(formatInteger(1800, 'es')).toBe('1.800');
    expect(formatInteger(57_960, 'es')).toBe('57.960');
    expect(formatInteger(150_000_000, 'es')).toBe('150.000.000');
    expect(formatInteger(850, 'es')).toBe('850');
  });

  it('groups thousands with a comma in en', () => {
    expect(formatInteger(1800, 'en')).toBe('1,800');
    expect(formatInteger(57_960, 'en')).toBe('57,960');
    expect(formatInteger(150_000_000, 'en')).toBe('150,000,000');
  });

  it('keeps every digit of a bigint beyond the safe integer range', () => {
    expect(formatInteger(999_999_999_999_999n, 'es')).toBe('999.999.999.999.999');
  });

  it('writes a negative with U+2212', () => {
    expect(formatInteger(-1800, 'es')).toBe(`${MINUS}1.800`);
    expect(formatInteger(-1800, 'es')).not.toContain('-');
  });

  it('returns the dash for an unknown value', () => {
    expect(formatInteger(null, 'es')).toBe(UNKNOWN);
    expect(formatInteger(undefined, 'en')).toBe(UNKNOWN);
    expect(formatInteger(Number.NaN, 'es')).toBe(UNKNOWN);
  });
});

describe('formatDecimal', () => {
  it('uses the decimal separator of the language', () => {
    expect(formatDecimal(1.5, 'es')).toBe('1,5');
    expect(formatDecimal(1.5, 'en')).toBe('1.5');
    expect(formatDecimal(2.5, 'es')).toBe('2,5');
    expect(formatDecimal(2.5, 'en')).toBe('2.5');
    expect(formatDecimal(89.9, 'es', 2)).toBe('89,90');
  });

  it('returns the dash for an unknown value', () => {
    expect(formatDecimal(null, 'es')).toBe(UNKNOWN);
  });
});

describe('formatPercent', () => {
  it('writes the figure and % with no space, in both languages', () => {
    expect(formatPercent(53, 'es')).toBe('53%');
    expect(formatPercent(53, 'en')).toBe('53%');
    expect(formatPercent(53, 'es')).not.toContain(' ');
    expect(formatPercent(53, 'es')).not.toContain(HARD_SPACE);
  });

  it('writes a variation with its sign and U+2212 for the negative', () => {
    expect(formatPercent(-8.4, 'es', { decimals: 1, signed: true })).toBe(`${MINUS}8,4%`);
    expect(formatPercent(-8.4, 'en', { decimals: 1, signed: true })).toBe(`${MINUS}8.4%`);
    expect(formatPercent(12, 'es', { decimals: 1, signed: true })).toBe('+12,0%');
    expect(formatPercent(12, 'en', { decimals: 1, signed: true })).toBe('+12.0%');
  });

  it('returns the dash for an unknown value', () => {
    expect(formatPercent(null, 'es')).toBe(UNKNOWN);
  });
});

describe('formatSigned', () => {
  it('always carries the sign, for a value and for a band', () => {
    expect(formatSigned(20, 'es')).toBe('+20');
    expect(formatSigned(20, 'en')).toBe('+20');
    expect(formatSigned([15, 20], 'es')).toBe('+15 a +20');
    expect(formatSigned([15, 20], 'en')).toBe('+15 to +20');
    expect(formatSigned(-5, 'es')).toBe(`${MINUS}5`);
  });

  it('returns the dash for an unknown value', () => {
    expect(formatSigned(null, 'es')).toBe(UNKNOWN);
  });
});

describe('formatPokedolares', () => {
  it.each(POKEDOLARES_TABLE)('formats %i as the players write it', (units, es, en) => {
    expect(formatPokedolares(units, 'es')).toBe(es);
    expect(formatPokedolares(units, 'en')).toBe(en);
  });

  it('promotes the k form to kk when the rounding reaches 1.000k', () => {
    expect(formatPokedolares(999_950, 'es')).toBe('1kk');
    expect(formatPokedolares(999_949, 'es')).toBe('999,9k');
  });

  it('rounds the tenth of a million half up (spec 7.8)', () => {
    expect(formatPokedolares(1_049_999, 'es')).toBe('1kk');
    expect(formatPokedolares(1_050_000, 'es')).toBe('1,1kk');
  });

  it('never leaves a trailing zero decimal', () => {
    expect(formatPokedolares(1_000, 'es')).toBe('1k');
    expect(formatPokedolares(150_000_000, 'es')).toBe('150kk');
  });

  it('keeps every digit of an amount past the safe integer range', () => {
    expect(formatPokedolares(999_999_999_999_999n, 'es')).toBe('1.000.000.000kk');
  });

  it('returns the dash without a sprite for an unknown amount', () => {
    expect(formatPokedolares(null, 'es')).toBe(UNKNOWN);
    expect(formatPokedolares(undefined, 'en')).toBe(UNKNOWN);
  });
});

describe('formatPokedolaresLabel', () => {
  it('says the exact grouped figure with the currency', () => {
    expect(formatPokedolaresLabel(150_000_000, 'es')).toBe('150.000.000 Pokédólares');
    expect(formatPokedolaresLabel(150_000_000, 'en')).toBe('150,000,000 Pokédollars');
  });

  it('says the singular for one unit', () => {
    expect(formatPokedolaresLabel(1, 'es')).toBe('1 Pokédólar');
    expect(formatPokedolaresLabel(1, 'en')).toBe('1 Pokédollar');
  });

  it('never says KK, KKs or gold', () => {
    const spoken = formatPokedolaresLabel(1_200_000_000, 'es');
    expect(spoken).toBe('1.200.000.000 Pokédólares');
    expect(spoken.toLowerCase()).not.toContain('kk');
    expect(spoken.toLowerCase()).not.toContain('gold');
  });

  it('returns the dash for an unknown amount', () => {
    expect(formatPokedolaresLabel(null, 'es')).toBe(UNKNOWN);
  });
});

describe('parsePokedolares', () => {
  it('accepts the short forms of each language', () => {
    expect(parsePokedolares('150kk', 'es')).toEqual({ ok: true, valor: 150_000_000 });
    expect(parsePokedolares('2,5k', 'es')).toEqual({ ok: true, valor: 2_500 });
    expect(parsePokedolares('1.200kk', 'es')).toEqual({ ok: true, valor: 1_200_000_000 });
    expect(parsePokedolares('850', 'es')).toEqual({ ok: true, valor: 850 });
    expect(parsePokedolares('150kk', 'en')).toEqual({ ok: true, valor: 150_000_000 });
    expect(parsePokedolares('2.5k', 'en')).toEqual({ ok: true, valor: 2_500 });
    expect(parsePokedolares('1,200kk', 'en')).toEqual({ ok: true, valor: 1_200_000_000 });
  });

  it('reads the grouped figure of each language', () => {
    expect(parsePokedolares('1.500', 'es')).toEqual({ ok: true, valor: 1_500 });
    expect(parsePokedolares('1,500', 'en')).toEqual({ ok: true, valor: 1_500 });
  });

  it('rejects the grouping of the other language', () => {
    expect(parsePokedolares('1,500', 'es')).toEqual({ ok: false, motivo: 'fraccion' });
    expect(parsePokedolares('1.500', 'en')).toEqual({ ok: false, motivo: 'fraccion' });
  });

  it('never rounds: a fraction of a unit is rejected', () => {
    expect(parsePokedolares('1,2345k', 'es')).toEqual({ ok: false, motivo: 'fraccion' });
    expect(parsePokedolares('2,5', 'es')).toEqual({ ok: false, motivo: 'fraccion' });
    expect(parsePokedolares('1.2345k', 'en')).toEqual({ ok: false, motivo: 'fraccion' });
    expect(parsePokedolares('2.5', 'en')).toEqual({ ok: false, motivo: 'fraccion' });
  });

  it('rejects zero and anything past 15 digits', () => {
    expect(parsePokedolares('0', 'es')).toEqual({ ok: false, motivo: 'rango' });
    expect(parsePokedolares('1000000000000000', 'es')).toEqual({ ok: false, motivo: 'rango' });
    expect(parsePokedolares('999999999999999', 'es')).toEqual({
      ok: true,
      valor: 999_999_999_999_999,
    });
  });

  it('rejects anything that is not an amount', () => {
    expect(parsePokedolares('abc', 'es')).toEqual({ ok: false, motivo: 'formato' });
    expect(parsePokedolares('', 'es')).toEqual({ ok: false, motivo: 'formato' });
    expect(parsePokedolares('1 500', 'es')).toEqual({ ok: false, motivo: 'formato' });
    expect(parsePokedolares('50kkk', 'es')).toEqual({ ok: false, motivo: 'formato' });
    expect(parsePokedolares('-5k', 'es')).toEqual({ ok: false, motivo: 'formato' });
  });

  it('reads back what it wrote, rounded to the shown tenth', () => {
    const samples = [
      1, 7, 99, 850, 999, 1_000, 1_049, 1_050, 2_500, 9_999, 57_960, 150_000, 150_500, 999_949,
      999_950, 1_250_000, 1_500_000, 150_000_000, 1_200_000_000, 999_999_999_999,
    ];
    expect(samples).toHaveLength(20);

    for (const locale of ['es', 'en'] as const) {
      for (const units of samples) {
        const written = formatPokedolares(units, locale);
        const read = parsePokedolares(written, locale);
        expect(read.ok, `${written} (${locale})`).toBe(true);
        if (!read.ok) continue;
        // The short form shows one decimal, so the value comes back at that step.
        const step = units < 1_000 ? 1 : units >= 1_000_000 ? 100_000 : 100;
        expect(read.valor, `${units} (${locale})`).toBe(Math.round(units / step) * step);
        expect(formatPokedolares(read.valor, locale)).toBe(written);
      }
    }
  });
});

describe('formatDiamonds', () => {
  it('groups the figure and keeps the game term in both languages', () => {
    expect(formatDiamonds(2_400, 'es')).toBe('2.400 Diamonds');
    expect(formatDiamonds(2_400, 'en')).toBe('2,400 Diamonds');
  });

  it('returns the dash for an unknown amount', () => {
    expect(formatDiamonds(null, 'es')).toBe(UNKNOWN);
  });
});

describe('formatRealMoney', () => {
  it('writes symbol, hard space and figure, without cents when they are zero', () => {
    expect(formatRealMoney(90, 'BRL', 'es')).toBe(`R$${HARD_SPACE}90`);
    expect(formatRealMoney(120, 'USD', 'es')).toBe(`US$${HARD_SPACE}120`);
    expect(formatRealMoney(1800, 'MXN', 'es')).toBe(`MX$${HARD_SPACE}1.800`);
    expect(formatRealMoney(1800, 'MXN', 'en')).toBe(`MX$${HARD_SPACE}1,800`);
  });

  it('writes the cents when they are not zero', () => {
    expect(formatRealMoney(90.5, 'BRL', 'es')).toBe(`R$${HARD_SPACE}90,50`);
    expect(formatRealMoney(90.5, 'BRL', 'en')).toBe(`R$${HARD_SPACE}90.50`);
  });

  it('returns the dash for an unknown price', () => {
    expect(formatRealMoney(null, 'BRL', 'es')).toBe(UNKNOWN);
  });
});

describe('formatRating', () => {
  it('writes one decimal with a point in both languages', () => {
    expect(formatRating(4.6)).toBe('4.6');
    expect(formatRating(5)).toBe('5.0');
    expect(formatRating(0)).toBe('0.0');
  });

  it('returns the dash for an unrated seller', () => {
    expect(formatRating(null)).toBe(UNKNOWN);
  });
});

describe('formatRatingLabel', () => {
  it('says the rating out of five with the number of reviews', () => {
    expect(formatRatingLabel(4.6, 23, 'es')).toBe('4.6 de 5 (23 reseñas de operaciones)');
    expect(formatRatingLabel(4.6, 23, 'en')).toBe('4.6 out of 5 (23 trade reviews)');
  });

  it('says the singular for one review', () => {
    expect(formatRatingLabel(4.6, 1, 'es')).toBe('4.6 de 5 (1 reseña de operaciones)');
    expect(formatRatingLabel(4.6, 1, 'en')).toBe('4.6 out of 5 (1 trade review)');
  });

  it('drops the count when the number of reviews is unknown', () => {
    expect(formatRatingLabel(4.6, null, 'es')).toBe('4.6 de 5');
    expect(formatRatingLabel(null, 23, 'es')).toBe(UNKNOWN);
  });
});

// ---------------------------------------------------------------------------------------------
// S8 (spec §2, §7.8, plan M6): the table of DS:guias/40 in both languages, and every in-game
// amount the money components of §7.2.5 write — the Pokédólares or Diamond sprite right before
// the figure, and the exact figure as what a screen reader hears.

/** DS:guias/40 «Pokédólares»: value, short form es / en, exact figure es / en. */
const GUIAS_40: [units: number, es: string, en: string, esExact: string, enExact: string][] = [
  [850, '850', '850', '850', '850'],
  [2_500, '2,5k', '2.5k', '2.500', '2,500'],
  [150_000, '150k', '150k', '150.000', '150,000'],
  [1_500_000, '1,5kk', '1.5kk', '1.500.000', '1,500,000'],
  [150_000_000, '150kk', '150kk', '150.000.000', '150,000,000'],
  [1_200_000_000, '1.200kk', '1,200kk', '1.200.000.000', '1,200,000,000'],
];

const CURRENCY: Record<Locale, string> = { es: 'Pokédólares', en: 'Pokédollars' };
const DICTIONARIES = { es, en } as const;

/** §7.8, D-013: the two fixed sprite keys of the money, as the adapter resolves them. */
const POKEDOLARES_SRC = spriteUrl(spriteRegistry['ui/pokedolares'].archivo);
const DIAMOND_SRC = spriteUrl(spriteRegistry['ui/diamond'].archivo);
const DIAMOND_FRAMES = spriteRegistry['ui/diamond'].frames;

/**
 * Server markup of an element. React 19 writes a `<link rel="preload">` before the images it
 * renders on the server; that hint is not part of the component, so it is left out.
 */
function markup(element: ReactElement): string {
  return renderToStaticMarkup(element).replace(/<link\b[^>]*>/g, '');
}

/** The text of a piece of markup, as it reads with the tags taken out. */
function text(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

/** Only what the eye reads: the visually hidden spans are taken out. */
function visibleText(html: string): string {
  return text(html.replace(/<span class="sr-only">[^<]*<\/span>/g, ''));
}

/**
 * Every `PokedolaresAmount` of `html`, in document order: the sprite (first), the short form
 * (`aria-hidden`, second) and the exact figure (visually hidden, last), the order that
 * tests/e2e/money.spec.ts reads in the browser.
 */
const AMOUNT =
  /<span class="ac-pokedolares-amount(?: [^"]*)?"><span class="ac-pokedolares-amount__sprite" aria-hidden="true"><img class="ac-pokedolares-amount__img" src="([^"]*)" alt="" width="(\d+)" height="(\d+)"[^>]*><\/span><span aria-hidden="true">([^<]*)<\/span><span class="sr-only">([^<]*)<\/span><\/span>/g;

function pokedolares(html: string) {
  return [...html.matchAll(AMOUNT)].map(([, src, width, height, visible, spoken]) => ({
    src,
    size: [Number(width), Number(height)],
    visible,
    spoken,
  }));
}

/** Every `DiamondsAmount` of `html`: its still Diamond (frame 0 of the sheet) before the figure. */
const DIAMONDS =
  /<(?:span|a|button)\b[^>]*\bclass="[^"]*\bac-diamonds-amount\b[^"]*"[^>]*><span class="ac-diamonds-amount__sprite" aria-hidden="true"><span class="ac-diamonds-amount__frame"><img class="ac-diamonds-amount__sheet" src="([^"]*)" alt="" width="(\d+)" height="(\d+)"[^>]*><\/span><\/span>([^<]*)(?:<span class="sr-only">([^<]*)<\/span>)?<\/(?:span|a|button)>/g;

function diamonds(html: string) {
  return [...html.matchAll(DIAMONDS)].map(([, src, width, height, visible, hidden]) => ({
    src,
    size: [Number(width), Number(height)],
    visible,
    spoken: `${visible}${hidden ?? ''}`,
  }));
}

/** A k/kk figure written as text outside a `PokedolaresAmount` (G6). */
function bareShortForms(html: string): string[] {
  const outside = html.replace(AMOUNT, '').replace(/<span class="sr-only">[^<]*<\/span>/g, '');
  return text(outside).match(/\d+(?:[.,]\d+)*kk?\b/g) ?? [];
}

/** The Diamonds panel of 7.5.3, with the two rows the registry would give it. */
const DIAMONDS_TIP: TipData = {
  key: 'moneda:diamonds',
  title: 'Diamonds',
  width: 240,
  head: { type: 'sprite', sprite: { src: DIAMOND_SRC, size: [32, 32], frames: DIAMOND_FRAMES } },
  rows: [
    { label: 'Se compran en', value: { list: ['Store'] } },
    { label: 'Se usan en', value: { list: ['VIP Account', 'Star Machine'] } },
  ],
};

describe('the table of DS:guias/40 (S8)', () => {
  it.each(GUIAS_40)(
    'writes %i as the players do and says the exact figure',
    (units, esShort, enShort, esExact, enExact) => {
      expect(formatPokedolares(units, 'es')).toBe(esShort);
      expect(formatPokedolares(units, 'en')).toBe(enShort);
      expect(formatPokedolaresLabel(units, 'es')).toBe(`${esExact} Pokédólares`);
      expect(formatPokedolaresLabel(units, 'en')).toBe(`${enExact} Pokédollars`);
    },
  );

  it.each(GUIAS_40)(
    'PokedolaresAmount draws %i after its sprite and names it with the exact figure',
    (units, esShort, enShort, esExact, enExact) => {
      const expected = { es: [esShort, esExact], en: [enShort, enExact] } as const;
      for (const locale of ['es', 'en'] as const) {
        const [short, exact] = expected[locale];
        const html = markup(createElement(PokedolaresAmount, { amount: units, locale }));

        expect(pokedolares(html), `${units} (${locale})`).toEqual([
          {
            src: POKEDOLARES_SRC,
            size: [32, 32],
            visible: short,
            spoken: `${exact} ${CURRENCY[locale]}`,
          },
        ]);
        // The short form is the only text the eye reads; the exact figure is for a reader.
        expect(visibleText(html)).toBe(short);
      }
    },
  );
});

describe('PokedolaresAmount', () => {
  it('says the singular for one unit', () => {
    const [spanish] = pokedolares(
      markup(createElement(PokedolaresAmount, { amount: 1, locale: 'es' })),
    );
    const [english] = pokedolares(
      markup(createElement(PokedolaresAmount, { amount: 1, locale: 'en' })),
    );
    expect(spanish.spoken).toBe('1 Pokédólar');
    expect(english.spoken).toBe('1 Pokédollar');
  });

  it('shows the dash without a sprite for an unknown amount', () => {
    for (const amount of [null, undefined, Number.NaN]) {
      const html = markup(createElement(PokedolaresAmount, { amount, locale: 'es' }));
      expect(html).toBe(`<span class="ac-pokedolares-amount">${UNKNOWN}</span>`);
    }
  });

  it('writes the strong modifier, and the caller class last', () => {
    const html = markup(
      createElement(PokedolaresAmount, {
        amount: 500_000_000,
        locale: 'es',
        strong: true,
        className: 'mt-8',
      }),
    );
    expect(html).toMatch(
      /^<span class="ac-pokedolares-amount ac-pokedolares-amount--strong mt-8">/,
    );
    expect(pokedolares(html)[0].visible).toBe('500kk');
  });

  it('never writes KK, KKs or gold', () => {
    const html = markup(createElement(PokedolaresAmount, { amount: 1_200_000_000, locale: 'es' }));
    expect(html).not.toMatch(/\bKKs?\b/);
    expect(html.toLowerCase()).not.toContain('gold');
  });
});

describe('DiamondsAmount', () => {
  it('draws frame 0 of the Diamond before the grouped figure and its game term', () => {
    const spanish = markup(createElement(DiamondsAmount, { amount: 2_400, locale: 'es' }));
    const english = markup(createElement(DiamondsAmount, { amount: 2_400, locale: 'en' }));

    expect(diamonds(spanish)).toEqual([
      {
        src: DIAMOND_SRC,
        size: [32 * DIAMOND_FRAMES, 32],
        visible: formatDiamonds(2_400, 'es'),
        spoken: '2.400 Diamonds',
      },
    ]);
    expect(diamonds(english).map((amount) => amount.visible)).toEqual(['2,400 Diamonds']);
  });

  it('keeps the word for screen readers only on the Cantidad of a Diamonds listing', () => {
    const html = markup(createElement(DiamondsAmount, { amount: 300, locale: 'es', word: false }));
    expect(diamonds(html)).toEqual([
      { src: DIAMOND_SRC, size: [32 * DIAMOND_FRAMES, 32], visible: '300', spoken: '300 Diamonds' },
    ]);
    expect(visibleText(html)).toBe('300');
  });

  it('shows the dash without a sprite for an unknown amount', () => {
    const html = markup(createElement(DiamondsAmount, { amount: null, locale: 'es' }));
    expect(html).toBe(`<span class="ac-diamonds-amount">${UNKNOWN}</span>`);
  });

  it('spins only when asked and its registry entry is an animation; the gem stays still', () => {
    const html = markup(
      createElement(DiamondsAmount, { amount: 10, locale: 'es', animated: true }),
    );
    if (spriteRegistry['ui/diamond'].modo === 'animacion') {
      expect(html).toMatch(/<img class="ac-sprite"[^>]*data-anim="ac-sprite-/);
      expect(html).not.toContain('ac-diamonds-amount__frame');
    } else {
      // The game's current Diamond is one still frame (P3): `animated` changes nothing.
      expect(html).not.toContain('data-anim');
      expect(html).toBe(markup(createElement(DiamondsAmount, { amount: 10, locale: 'es' })));
    }
  });

  it('is the price link of the Diamonds panel with `link`, and plain text without rows (R2)', () => {
    const linked = markup(
      createElement(DiamondsAmount, {
        amount: 400,
        locale: 'es',
        link: { tip: DIAMONDS_TIP, hint: es.ui.pinHint },
      }),
    );
    expect(linked).toMatch(
      /^<span class="ac-nested-entity" data-ac-tt="" data-ac-tt-placement="up" data-ac-tt-align="end">/,
    );
    const trigger =
      /<button type="button" class="ac-nested-entity__trigger ac-nested-entity__trigger--plain ac-diamonds-amount ac-diamonds-amount--link" aria-describedby="([^"]+)">/.exec(
        linked,
      );
    expect(trigger).not.toBeNull();
    expect(linked).toMatch(new RegExp(`<div id="${trigger?.[1]}"[^>]*role="tooltip"`));
    expect(diamonds(linked).map((amount) => amount.visible)).toEqual(['400 Diamonds']);

    const plain = markup(
      createElement(DiamondsAmount, {
        amount: 400,
        locale: 'es',
        link: { tip: null, hint: es.ui.pinHint },
      }),
    );
    expect(plain).not.toContain('data-ac-tt');
    expect(diamonds(plain).map((amount) => amount.visible)).toEqual(['400 Diamonds']);
  });
});

describe('PriceOptions', () => {
  const options = [
    { kind: 'pd', amount: 900_000_000 },
    { kind: 'dia', amount: 2_400 },
  ] as const;

  /** The markup of each option, in order. */
  function optionsOf(html: string): string[] {
    return html
      .replace(/^<span class="ac-price-options[^"]*">/, '')
      .replace(/<\/span>$/, '')
      .split('<span class="ac-price-options__option">')
      .filter(Boolean);
  }

  it('joins the options with the word of each language, each «o» with its option', () => {
    for (const locale of ['es', 'en'] as const) {
      const { or } = DICTIONARIES[locale].ui;
      const html = markup(createElement(PriceOptions, { options, locale, orLabel: or }));
      const [first, second] = optionsOf(html);

      expect(optionsOf(html), locale).toHaveLength(2);
      expect(first).not.toContain('ac-price-options__or');
      expect(second.startsWith(`<span class="ac-price-options__or">${or}</span>`)).toBe(true);
      expect(pokedolares(first).map((amount) => amount.visible)).toEqual(['900kk']);
      expect(diamonds(second).map((amount) => amount.visible)).toEqual([
        formatDiamonds(2_400, locale),
      ]);
    }
  });

  it('keeps every figure behind its sprite and writes no bare short form', () => {
    const html = markup(createElement(PriceOptions, { options, locale: 'es', orLabel: 'o' }));
    expect(pokedolares(html)).toHaveLength(1);
    expect(diamonds(html)).toHaveLength(1);
    expect(bareShortForms(html)).toEqual([]);
    expect(visibleText(html)).toBe('900kko2.400 Diamonds');
  });

  it('shows the dash with no options', () => {
    const html = markup(createElement(PriceOptions, { options: [], locale: 'es', orLabel: 'o' }));
    expect(html).toBe(`<span class="ac-price-options ac-price-options--empty">${UNKNOWN}</span>`);
  });

  it('links the Diamonds outside a tooltip only, and centres them in the Lista', () => {
    const link = { tip: DIAMONDS_TIP, hint: es.ui.pinHint };
    const card = markup(createElement(PriceOptions, { options, locale: 'es', orLabel: 'o', link }));
    const tooltip = markup(
      createElement(PriceOptions, {
        options,
        locale: 'es',
        orLabel: 'o',
        link,
        variant: 'tooltip',
      }),
    );
    const cell = markup(
      createElement(PriceOptions, { options, locale: 'es', orLabel: 'o', align: 'center' }),
    );

    expect(card).toContain('ac-diamonds-amount--link');
    expect(tooltip).not.toContain('data-ac-tt');
    expect(tooltip).toMatch(/^<span class="ac-price-options ac-price-options--tooltip">/);
    expect(cell).toMatch(/^<span class="ac-price-options ac-price-options--center">/);
  });
});

describe('GameTooltip paints its amounts with the money components (S8)', () => {
  const tip: TipData = {
    key: 'item:fire-stone',
    title: 'Fire Stone',
    width: 282,
    head: { type: 'sprite', sprite: null },
    rows: [
      { label: 'Precio NPC', value: { pd: 2_500 } },
      { label: 'Cantidad', value: { dia: 10 } },
      {
        label: 'En el juego',
        value: {
          price: [
            { kind: 'pd', amount: 150_000_000 },
            { kind: 'dia', amount: 400 },
          ],
        },
      },
    ],
  };

  it('puts the sprite before every figure and says each one exactly', () => {
    const html = markup(
      createElement(GameTooltip, { tip, locale: 'es', hint: es.ui.pinHint, orLabel: es.ui.or }),
    );

    expect(pokedolares(html)).toEqual([
      { src: POKEDOLARES_SRC, size: [32, 32], visible: '2,5k', spoken: '2.500 Pokédólares' },
      {
        src: POKEDOLARES_SRC,
        size: [32, 32],
        visible: '150kk',
        spoken: '150.000.000 Pokédólares',
      },
    ]);
    expect(diamonds(html).map((amount) => amount.visible)).toEqual(['10 Diamonds', '400 Diamonds']);
    expect(bareShortForms(html)).toEqual([]);
    // Inside a panel the Diamonds are never a link and the price is the tooltip variant.
    expect(html).not.toContain('data-ac-tt');
    expect(html).toContain('ac-price-options ac-price-options--tooltip');
    expect(text(html)).not.toContain(UNKNOWN);
  });

  it('drops a row whose amount is unknown instead of writing the dash (T32)', () => {
    const empty: TipData = {
      ...tip,
      rows: [
        { label: 'Precio NPC', value: { pd: Number.NaN } },
        { label: 'En el juego', value: { price: [] } },
      ],
    };
    const html = markup(
      createElement(GameTooltip, { tip: empty, locale: 'es', hint: es.ui.pinHint }),
    );
    expect(html).not.toContain('ac-game-tooltip__rows');
    expect(text(html)).not.toContain(UNKNOWN);
  });

  it('fails on two price options without the word that joins them (DP1)', () => {
    expect(() =>
      markup(createElement(GameTooltip, { tip, locale: 'es', hint: es.ui.pinHint })),
    ).toThrow(/orLabel/);
  });

  it('draws the training section as the tooltip shape of TrainingMeter', () => {
    const trained: TipData = {
      ...tip,
      rows: [],
      sections: [
        {
          kind: 'train',
          label: 'Entrenamiento: 1',
          skills: [{ stat: 'Attack', level: 16, percent: 53 }],
        },
      ],
    };
    const html = markup(
      createElement(GameTooltip, { tip: trained, locale: 'es', hint: es.ui.pinHint }),
    );

    expect(html).toContain('<div class="ac-training-meter ac-training-meter--tooltip">');
    expect(text(html)).toContain('Attack16 (53%)');
    const meter = /<div class="ac-training-meter__track" role="meter"([^>]*)>/.exec(html)?.[1];
    expect(meter).toContain('aria-valuenow="53"');
    // Without the dictionary the row names the meter: both ids are in the panel.
    const ids = /aria-labelledby="([^"]+)"/.exec(meter ?? '')?.[1].split(' ') ?? [];
    expect(ids).toHaveLength(2);
    for (const id of ids) expect(html).toContain(`id="${id}"`);
  });

  it('draws one meter per trained skill, in the order given (§9.5.9)', () => {
    const trained: TipData = {
      ...tip,
      rows: [],
      sections: [
        {
          kind: 'train',
          label: 'Entrenamiento: 2',
          skills: [
            { stat: 'Attack', level: 16, percent: 53 },
            { stat: 'Defense', level: 4, percent: 12 },
          ],
        },
      ],
    };
    const html = markup(
      createElement(GameTooltip, { tip: trained, locale: 'es', hint: es.ui.pinHint }),
    );

    expect(html.match(/role="meter"/g)).toHaveLength(2);
    const shown = text(html);
    expect(shown).toContain('Attack16 (53%)');
    expect(shown).toContain('Defense4 (12%)');
    expect(shown.indexOf('Attack')).toBeLessThan(shown.indexOf('Defense'));
  });
});

describe('the figures of the other money components (§13.3)', () => {
  it('Rating says the score out of five with its count, as formatRatingLabel does (X5)', () => {
    for (const locale of ['es', 'en'] as const) {
      for (const reviews of [23, 1, 1_250]) {
        const html = markup(
          createElement(Rating, {
            seller: 'Kaiser',
            href: `/${locale}/comercio/vendedor/kaiser/`,
            score: 4.6,
            reviews,
            locale,
            labels: DICTIONARIES[locale].ui.money,
          }),
        );
        const score = /<span class="ac-rating__score">([\s\S]*)<\/span><\/span>$/.exec(html)?.[1];

        expect(text(score ?? ''), `${reviews} (${locale})`).toBe(
          formatRatingLabel(4.6, reviews, locale),
        );
        expect(visibleText(score ?? '')).toBe(
          `${formatRating(4.6)} (${formatInteger(reviews, locale)})`,
        );
      }
    }
  });

  it('Rating shows the link alone without a score or without a confirmed trade', () => {
    const seller = {
      seller: 'Leafar',
      href: '/es/comercio/vendedor/leafar/',
      locale: 'es',
      labels: es.ui.money,
    } as const;
    for (const html of [
      markup(createElement(Rating, { ...seller, score: null, reviews: 9 })),
      markup(createElement(Rating, { ...seller, score: 4.2, reviews: 0 })),
    ]) {
      expect(html).toBe(
        '<span class="ac-rating"><a class="ac-rating__seller" href="/es/comercio/vendedor/leafar/">Leafar</a></span>',
      );
    }
  });

  it('TrainingMeter writes the level and the percent and names its meter from the dictionary', () => {
    for (const locale of ['es', 'en'] as const) {
      const { money } = DICTIONARIES[locale].ui;
      const html = markup(
        createElement(TrainingMeter, {
          stat: 'Attack',
          level: 16,
          percent: 53.4,
          locale,
          labels: money,
        }),
      );

      expect(text(html), locale).toBe(`${money.training}Attack 16 (53%)`);
      expect(html).toContain(
        locale === 'es'
          ? 'aria-label="Attack, progreso al nivel 17"'
          : 'aria-label="Attack, progress to level 17"',
      );
      expect(html).toContain('aria-valuenow="53"');
      expect(html).toContain('style="--ac-training-meter-percent:53%"');
    }
  });

  it('TrainingMeter shows the dash and no meter without training, and nothing in a tooltip', () => {
    const card = markup(createElement(TrainingMeter, { locale: 'es', labels: es.ui.money }));
    expect(text(card)).toBe(`${es.ui.money.training}${UNKNOWN}`);
    expect(card).not.toContain('role="meter"');
    expect(markup(createElement(TrainingMeter, { locale: 'es', variant: 'tooltip' }))).toBe('');
  });

  it('ChipRow counts what «+N» hides in the name of its button', () => {
    const channels = ['Discord', 'Twitch', 'Correo', 'Teléfono +55', 'Teléfono +1'];
    const five = markup(
      createElement(ChipRow, { items: channels, locale: 'es', labels: es.ui.money }),
    );
    expect(five).toContain('aria-label="3 canales más: Correo, Teléfono +55, Teléfono +1"');
    expect(five).toMatch(/>\+3<\/button>/);
    expect(five.match(/<span class="ac-contact-chip">/g)).toHaveLength(2);

    const english = markup(
      createElement(ChipRow, { items: channels.slice(0, 4), locale: 'en', labels: en.ui.money }),
    );
    expect(english).toContain('aria-label="2 more channels: Correo, Teléfono +55"');

    const fits = markup(
      createElement(ChipRow, {
        items: channels.slice(0, 3),
        locale: 'es',
        labels: es.ui.money,
      }),
    );
    expect(fits).not.toContain('data-ac-plusn');
    expect(fits.match(/<span class="ac-contact-chip">/g)).toHaveLength(3);
  });

  it('HeldStrip counts the held items over its line', () => {
    const held = {
      name: 'X-Attack',
      sprite: null,
      tip: {
        key: 'item:x-attack',
        title: 'X-Attack T5',
        width: 300,
        head: { type: 'sprite', sprite: null },
        rows: [{ label: 'Tier', value: 'T5' }],
      },
    } satisfies Parameters<typeof HeldStrip>[0]['items'][number];
    const strip = { locale: 'es', labels: es.ui.money, hint: es.ui.pinHint } as const;

    const two = markup(
      createElement(HeldStrip, {
        ...strip,
        items: [held, { ...held, name: 'X-Lucky' }],
      }),
    );
    expect(two).toContain('<p class="ac-held-strip__label">Held Items: 2</p>');
    // 16.4.5: the equipment slots let the tooltip place itself.
    expect([...two.matchAll(/data-ac-tt-align="(\w+)"/g)].map(([, align]) => align)).toEqual([
      'auto',
      'auto',
    ]);

    const none = markup(createElement(HeldStrip, { ...strip, items: [] }));
    expect(none).toBe(
      '<div class="ac-held-strip"><p class="ac-held-strip__label">Held Items: 0</p></div>',
    );
  });
});
