// §14.3 money gate (G6, R5, §13.3). Every visible in-game amount carries the
// `ui/pokedolares` sprite right before the number, and what a screen reader hears
// is the exact figure with its currency word, not the k/kk short form.
//
// Runs in the `prod` project, over the Vercel output: the amounts of a page come
// from `content/` through the build, so what gets deployed is what is measured.
//
// How an amount is recognised. §3.7 fixes the class names of a design-system
// component («con los nombres exactos de `components/bundle.css`»), and
// `DS:PokedolaresAmount` emits `ac-pokedolares-amount` with the sprite in
// `__sprite`, the short form in an `aria-hidden` span and the exact figure in a
// visually hidden one. The accessible text is read as the browser builds it —
// everything that is not `aria-hidden` — so the port may hide it with the
// `sr-only` utility that replaces `.ac-sr` (§3.7) without touching this spec.
//
// Contract with tests/e2e/routes.ts (track C of M2): `outputRoutes` is the §14.4
// list trimmed by scripts/lib/rutas-migradas.mjs and by the `/_paridad/` routes,
// which only the development server serves (§14.5), each entry carries `path`,
// `locale` and `status`. The two per-page setups §14.3 asks every project for —
// the remote-art stub and the fixed clock — arrive with `test`, which comes from
// tests/e2e/fixtures.ts.
//
// Scope. The gate walks `outputRoutes`, so it measures nothing until the first page
// renders with PageLayout (§3.10) and grows one route at a time from M6 on.

import type { Page } from '@playwright/test';

import { en } from '../../src/i18n/messages/en';
import { es } from '../../src/i18n/messages/es';
import { expect, test } from './fixtures';
import { outputRoutes, type Locale } from './routes';

/** §3.7, `DS:PokedolaresAmount`: the block and its sprite element. */
const AMOUNT = '.ac-pokedolares-amount';
const SPRITE = '.ac-pokedolares-amount__sprite';

/** §7.8, D-013: the fixed sprite key of the money, resolved by `SPRITES_BASE_URL`. */
const SPRITE_FILE = '/sprites/ui/pokedolares.png';

/** §7.8: the sprite is 32 at 1x and is never reduced to 16. */
const SPRITE_SIZE = 32;

/**
 * §9.5.1, §9.5.8 and §9.7.1: the asset type «Pokédólares» of Comercio carries the money sprite as
 * its icon — the tab of the list and of the form, and the head of its group in Cards — beside the
 * name of the type and no amount. It names the currency, as the Pokémon tab names its asset with
 * `outfits/5`, so it is not a stray; any other money sprite without an amount still is.
 */
const TYPE_LABEL = '.ac-toggle-group__item, .ac-card-group__head';
const TYPE_NAME: Record<Locale, string> = {
  es: es.trade.types.pokedolares,
  en: en.trade.types.pokedolares,
};

/** §13.3: the em dash of an unknown value, never «0» nor «N/D». */
const DASH = '—';

/** §13.3: what a screen reader hears after the figure, in singular and plural. */
const CURRENCY: Record<Locale, { one: string; many: string }> = {
  es: { one: 'Pokédólar', many: 'Pokédólares' },
  en: { one: 'Pokédollar', many: 'Pokédollars' },
};

/** §4.3: the separators of each locale. */
const SEPARATORS: Record<Locale, { group: string; decimal: string }> = {
  es: { group: '.', decimal: ',' },
  en: { group: ',', decimal: '.' },
};

/**
 * A whole text node that is nothing but a k/kk figure. Free text like «Hasta 100k»
 * is not one, so this only catches an amount written by hand instead of through the
 * component (G6; `pnpm content:check` catches the registry side, §12.19).
 */
const BARE_SHORT_FORM = /^\d{1,3}(?:[.,]\d{3})*(?:[.,]\d)?kk?$/;

/** §4.3: `formatInteger`, the one grouped integer of each locale. */
function groupInteger(value: bigint, locale: Locale): string {
  const format =
    locale === 'en'
      ? new Intl.NumberFormat('en-US')
      : new Intl.NumberFormat('es-ES', { useGrouping: 'always' });
  return format.format(value);
}

/** §4.3: tenths as `{whole}{decimal}{tenth}{suffix}`, without a trailing «,0». */
function shortForm(tenths: bigint, suffix: string, locale: Locale): string {
  const whole = groupInteger(tenths / 10n, locale);
  const tenth = tenths % 10n;
  return tenth === 0n
    ? `${whole}${suffix}`
    : `${whole}${SEPARATORS[locale].decimal}${tenth}${suffix}`;
}

/**
 * §4.3: `formatPokedolares`, in integer arithmetic. Below 1.000 the integer as it
 * is; up to 1.000.000 tenths of a thousand rounded half up with «k», and a rounding
 * that reaches 1.000k becomes «1kk»; from there, tenths of a million with «kk».
 */
function formatPokedolares(value: bigint, locale: Locale): string {
  if (value < 1_000n) return groupInteger(value, locale);

  if (value < 1_000_000n) {
    const tenths = (value * 10n + 500n) / 1_000n;
    if (tenths < 10_000n) return shortForm(tenths, 'k', locale);
    return shortForm(10n, 'kk', locale);
  }

  return shortForm((value * 10n + 500_000n) / 1_000_000n, 'kk', locale);
}

type Amount = {
  /** The k/kk form the eye reads; `aria-hidden` per §13.3. */
  visible: string;
  /** What a screen reader hears: everything that is not `aria-hidden`. */
  spoken: string;
  /** The whole text of the block, for the failure message. */
  text: string;
  spriteSrc: string | null;
  spriteWidth: number;
  spriteHeight: number;
  /** §14.3: the element before the number is the sprite. */
  spriteBeforeNumber: boolean;
};

/** Reads every visible amount of the page, plus any stray money sprite. */
async function readAmounts(
  page: Page,
  locale: Locale,
): Promise<{ amounts: Amount[]; strays: string[]; bare: string[] }> {
  return page.evaluate(
    ({ block, sprite, file, shortFormSource, typeLabel, typeName }) => {
      const onScreen = (element: Element): boolean => {
        const box = element.getBoundingClientRect();
        return box.width > 0 && box.height > 0 && getComputedStyle(element).visibility !== 'hidden';
      };
      const squash = (text: string | null): string => (text ?? '').replace(/\s+/g, ' ').trim();
      const hidden = (node: Node): boolean =>
        node instanceof Element && node.getAttribute('aria-hidden') === 'true';

      const amounts: Amount[] = [];
      for (const element of document.querySelectorAll(block)) {
        if (!onScreen(element)) continue;

        const image = element.querySelector('img');
        const number = [...element.children].find(
          (child) =>
            child.getAttribute('aria-hidden') === 'true' &&
            child.querySelector('img') === null &&
            squash(child.textContent) !== '',
        );
        const previous = number?.previousElementSibling ?? null;
        const box = image?.getBoundingClientRect() ?? null;

        amounts.push({
          visible: squash(number?.textContent ?? null),
          spoken: squash(
            [...element.childNodes]
              .filter((node) => !hidden(node))
              .map((node) => node.textContent ?? '')
              .join(''),
          ),
          text: squash(element.textContent),
          spriteSrc: image?.getAttribute('src') ?? null,
          spriteWidth: Math.round(box?.width ?? 0),
          spriteHeight: Math.round(box?.height ?? 0),
          spriteBeforeNumber:
            previous !== null &&
            (previous.matches('img') || previous.querySelector('img') !== null),
        });
      }

      /** The label of the type «Pokédólares» that holds this sprite, its count left out. */
      const labelsType = (image: Element): boolean => {
        const label = image.closest(typeLabel);
        if (label === null) return false;
        const copy = label.cloneNode(true) as Element;
        for (const count of copy.querySelectorAll('.ac-card-group__count')) count.remove();
        return squash(copy.textContent) === typeName;
      };
      const strays = [...document.querySelectorAll('img')]
        .filter((image) => (image.getAttribute('src') ?? '').endsWith(file))
        .filter((image) => image.closest(sprite) === null && onScreen(image))
        .filter((image) => !labelsType(image))
        .map((image) => squash(image.parentElement?.textContent ?? null) || image.outerHTML);

      const pattern = new RegExp(shortFormSource);
      const bare: string[] = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (walker.nextNode() !== null) {
        const parent = walker.currentNode.parentElement;
        if (parent === null) continue;
        if (parent.closest(`${block}, .ac-diamonds-amount, script, style, template`) !== null)
          continue;
        const text = squash(walker.currentNode.textContent);
        if (text !== '' && pattern.test(text)) bare.push(`${parent.localName} «${text}»`);
      }

      return { amounts, strays, bare };
    },
    {
      block: AMOUNT,
      sprite: SPRITE,
      file: SPRITE_FILE,
      shortFormSource: BARE_SHORT_FORM.source,
      typeLabel: TYPE_LABEL,
      typeName: TYPE_NAME[locale],
    },
  );
}

/**
 * §14.3, `prod` row: the project runs «Desktop Chrome **y** 390 × 844». A Playwright
 * project carries one viewport, so the second width lives in the specs whose result
 * depends on it, the way tests/e2e/perf.spec.ts already does it. This is one of them:
 * the money sprite is 32 at 1x and the list of visible amounts depends on the layout.
 * `seo.spec.ts` never builds a page (it measures with `request`) and prod.spec.ts
 * measures font traffic and URL state, so neither changes with the width.
 */
const VENTANAS = [
  { nombre: '1440 × 900', viewport: { width: 1440, height: 900 } },
  { nombre: '390 × 844', viewport: { width: 390, height: 844 } },
];

for (const ventana of VENTANAS) {
  test.describe(`a ${ventana.nombre}`, () => {
    test.use({ viewport: ventana.viewport });

    for (const route of outputRoutes) {
      test(`every in-game amount carries its sprite and its exact figure on ${route.path}`, async ({
        page,
      }) => {
        const response = await page.goto(route.path);
        expect(response?.status(), `${route.path} answers ${route.status}`).toBe(route.status);

        const { amounts, strays, bare } = await readAmounts(page, route.locale);
        const words = CURRENCY[route.locale];
        const separator = SEPARATORS[route.locale].group;

        for (const amount of amounts) {
          const where = `«${amount.visible === '' ? amount.text : amount.visible}»`;

          // §13.3, G7: an unknown amount is the em dash, with no sprite.
          if (amount.text === DASH) {
            expect(amount.spriteSrc, `§7.8: ${where} shows no sprite`).toBeNull();
            continue;
          }

          expect(amount.spriteSrc, `G6: ${where} carries the ui/pokedolares sprite`).toContain(
            SPRITE_FILE,
          );
          expect(amount.spriteBeforeNumber, `§14.3: the element before ${where} is its img`).toBe(
            true,
          );
          expect(
            [amount.spriteWidth, amount.spriteHeight],
            `§7.8: the sprite of ${where} is 32 at 1x`,
          ).toEqual([SPRITE_SIZE, SPRITE_SIZE]);

          // §13.3: the visible short form is `aria-hidden` and the accessible text is the
          // exact figure with its currency word.
          expect(amount.visible, `§13.3: ${where} shows the k/kk form`).not.toBe('');

          const spoken = /^(.+) ([^\s]+)$/.exec(amount.spoken);
          expect(
            spoken,
            `§13.3: the accessible text of ${where} is «figure currency»`,
          ).not.toBeNull();
          if (spoken === null) continue;

          const [, figure, word] = spoken;
          const digits = figure.split(separator).join('');
          expect(digits, `§13.3: the accessible figure of ${where} is an integer`).toMatch(/^\d+$/);

          const exact = BigInt(digits);
          expect(figure, `§4.3: the accessible figure of ${where} is grouped`).toBe(
            groupInteger(exact, route.locale),
          );
          expect(word, `§13.3: the currency word of ${where}`).toBe(
            exact === 1n ? words.one : words.many,
          );
          expect(
            formatPokedolares(exact, route.locale),
            `§4.3: the short form of ${where} is the exact figure rounded`,
          ).toBe(amount.visible);
        }

        expect(
          strays,
          '§7.8: the money sprite never stands next to a mention without amount',
        ).toEqual([]);
        expect(bare, 'G6: no k/kk figure written outside PokedolaresAmount').toEqual([]);
      });
    }
  });
}
