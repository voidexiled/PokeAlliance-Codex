// V5-4 (§5.10) and the sheet half of C7-12 (§7.14): the phone menu opens from the header
// button, traps the focus, closes with Escape, with its own button and with a click on
// the veil, gives the focus back, freezes the page behind it, paints the veil in
// `overlay` with a 4 px blur and disappears when the window reaches `layout-bp-xl`.
//
// §14.3 runs it in `mobile` (Chromium) and in `webkit-mobile` (WebKit): risk 1 of the
// milestone is that `::backdrop` does not inherit the custom properties of the document
// in WebKit, and that only shows in a second engine. The spec reads the veil wherever it
// is painted — the `::backdrop` of the dialog, or the own element inside it that §5.8
// allows as a fallback — so the measurement is the same in both engines.
//
// Contract with track A of M3: the parity route of the frame, `/{l}/_paridad/marco/`,
// served by the development server (tests/e2e/frame.spec.ts carries the whole contract).
// Contract with track D: `<dialog id="menu-movil">` opened with `showModal()` from the
// `[aria-controls="menu-movil"]` button of the header, and — §7.10.3, «un clic sobre el
// propio dialog fuera de la caja de la hoja» — a dialog box that reaches the left edge of
// the window, with the 288 sheet drawn inside it.

import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { idiomas } from '../../scripts/lib/rutas-migradas.mjs';

const [MAIN_LOCALE] = idiomas;
const FRAME_ROUTE = `/${MAIN_LOCALE}/_paridad/marco/`;

const SHEET = 'dialog#menu-movil';

/** What Tab can stop on inside the sheet. */
const FOCUSABLE =
  'a[href], button, summary, input:not([type="hidden"]), select, textarea,' +
  ' [tabindex]:not([tabindex="-1"])';
const TRIGGER = '[aria-controls="menu-movil"]';

/** §3.13 tokens: `--overlay` is `#000000cc`, that is black at 0.8. */
const OVERLAY = { r: 0, g: 0, b: 0, a: 0.8 };
const OVERLAY_BLUR = 'blur(4px)';

/** §5.4: from here the sheet does not exist. */
const DESKTOP = { width: 1280, height: 900 };

type Veil = { where: string; background: string; filter: string } | null;

async function open(page: Page): Promise<void> {
  const response = await page.goto(FRAME_ROUTE);
  expect(
    response?.status(),
    `${FRAME_ROUTE} has to answer 200: the parity routes of §14.5 are injected with ` +
      'VISUAL=1 and the development server of §14.3 needs the same injection',
  ).toBe(200);

  const trigger = page.locator(TRIGGER).first();
  await expect(trigger, 'the header carries the menu button below 1280 (§5.6)').toBeVisible();
  await trigger.click();
  await expect(page.locator(SHEET)).toBeVisible();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
}

/** Every `rgb()`/`rgba()` colour as four numbers, so no engine's spelling decides. */
function parseColor(value: string): { r: number; g: number; b: number; a: number } | null {
  const numbers = value.match(/[\d.]+/g);
  if (numbers === null || numbers.length < 3) return null;
  return {
    r: Number(numbers[0]),
    g: Number(numbers[1]),
    b: Number(numbers[2]),
    a: numbers.length > 3 ? Number(numbers[3]) : 1,
  };
}

test.describe('the phone menu sheet (V5-4)', () => {
  test('opens from the header button and puts the focus inside', async ({ page }) => {
    await open(page);

    const focus = await page.evaluate(() => {
      const sheet = document.querySelector('dialog#menu-movil');
      const active = document.activeElement;
      return {
        inside: sheet !== null && active !== null && sheet.contains(active),
        element: active === null ? 'none' : `${active.localName}.${active.className}`,
      };
    });

    expect(focus.inside, `the focus enters the sheet, not ${focus.element} (§7.10.3)`).toBe(true);
    await expect(
      page.locator(`${SHEET} button`).first(),
      'the focus lands on the close button (§7.10.3)',
    ).toBeFocused();
  });

  test('Tab does not leave the sheet', async ({ page, browserName }) => {
    await open(page);

    // Every group of the menu open, so the cycle crosses the whole menu: the link of a
    // closed group is not rendered, and so not a stop Tab can reach (§3.8, 7.10.2). The
    // stops are the focusable elements the sheet renders — the language list, a popover
    // that is not open, has none yet — and the page keeps the list, so each focus below is
    // matched to the stop it is. WebKit leaves a plain link out of the Tab order unless the
    // reader turns on Safari's «Press Tab to highlight each item», off by default, so there
    // the links are not stops.
    const stops = await page.evaluate(
      ([selector, withoutLinks]) => {
        const sheet = document.querySelector('dialog#menu-movil');
        if (sheet === null) return 0;
        for (const group of sheet.querySelectorAll('details')) group.open = true;
        const list = [...sheet.querySelectorAll<HTMLElement>(selector)].filter(
          (element) =>
            element.getClientRects().length > 0 &&
            !(withoutLinks && element.matches('a[href]:not([tabindex])')),
        );
        (window as unknown as { __sheetStops: HTMLElement[] }).__sheetStops = list;
        return list.length;
      },
      [FOCUSABLE, browserName === 'webkit'] as const,
    );
    expect(stops, 'the sheet carries focusable content').toBeGreaterThan(0);

    const outside: string[] = [];
    const reached = new Set<number>();

    // What V5-4 measures is that no element of the page behind the sheet ever takes the
    // focus. Inside a `showModal()` dialog the browser passes through its own chrome once
    // per cycle, and `document.activeElement` then reports `<body>` (or the root) — the
    // fallback the DOM returns when nothing is focused, not a page element that stole the
    // focus. Reading that as an escape would fail the test on correct behaviour, so the
    // pass-through is not counted; a focus that really left shows up in `outside`, and a
    // stop the cycle skips is missing from `reached`.
    const where = (): Promise<{ stop: number } | { escaped: string } | null> =>
      page.evaluate(() => {
        const sheet = document.querySelector('dialog#menu-movil');
        const active = document.activeElement;
        if (active === null || active === document.body || active === document.documentElement) {
          return null;
        }
        if (sheet !== null && sheet.contains(active)) {
          const list = (window as unknown as { __sheetStops: Element[] }).__sheetStops;
          return { stop: list.indexOf(active) };
        }
        return { escaped: `${active.localName}.${active.className}` };
      });

    const record = async (label: string): Promise<void> => {
      const at = await where();
      if (at === null) return;
      if ('escaped' in at) outside.push(`${label} → ${at.escaped}`);
      else reached.add(at.stop);
    };

    // One round past the last stop, so the wrap at the end is measured too.
    for (let step = 0; step < stops + 2; step += 1) {
      await page.keyboard.press('Tab');
      await record(`Tab ${step + 1}`);
    }
    for (let step = 0; step < 3; step += 1) {
      await page.keyboard.press('Shift+Tab');
      await record(`Shift+Tab ${step + 1}`);
    }

    expect(outside, 'the focus stays in the sheet while it is open (V5-4)').toEqual([]);
    // The trap is a cycle, not a dead end: Tab reaches every stop of the sheet, the first
    // one again after the wrap.
    const missed = Array.from({ length: stops }, (_, index) => index).filter(
      (index) => !reached.has(index),
    );
    expect(missed, 'every stop of the sheet is reachable by Tab (V5-4)').toEqual([]);
  });

  test('Escape closes it and gives the focus back', async ({ page }) => {
    await open(page);
    const trigger = page.locator(TRIGGER).first();

    await page.keyboard.press('Escape');

    await expect(page.locator(SHEET)).toBeHidden();
    await expect(trigger, 'aria-expanded goes back to false (§7.10.3)').toHaveAttribute(
      'aria-expanded',
      'false',
    );
    await expect(trigger, 'the focus returns to the menu button (V5-4)').toBeFocused();
  });

  test('its own button closes it and gives the focus back (C7-12)', async ({ page }) => {
    await open(page);
    const trigger = page.locator(TRIGGER).first();

    await page.locator(`${SHEET} button`).first().click();

    await expect(page.locator(SHEET)).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('a click on the veil closes it (C7-12)', async ({ page }) => {
    await open(page);

    const sheetBox = await page.evaluate(() => {
      const sheet = document.querySelector('dialog#menu-movil');
      if (sheet === null) return null;
      // §5.8: the sheet is `layout-sheet` wide and pinned to the right edge, so the
      // veil is everything left of it.
      const panel = sheet.querySelector('.ac-mobile-menu__body')?.parentElement ?? sheet;
      const rect = panel.getBoundingClientRect();
      return { left: rect.left, height: window.innerHeight };
    });
    expect(sheetBox, 'the sheet is on screen').not.toBeNull();
    expect(
      sheetBox?.left ?? 0,
      'the sheet leaves veil to its left at this width (§5.8)',
    ).toBeGreaterThan(8);

    await page.mouse.click(4, Math.round((sheetBox?.height ?? 844) / 2));

    await expect(page.locator(SHEET)).toBeHidden();
  });

  test('the page behind it does not scroll', async ({ page }) => {
    const rootOverflow = (): Promise<string> =>
      page.evaluate(() => getComputedStyle(document.documentElement).overflow);
    const scrollY = (): Promise<number> => page.evaluate(() => window.scrollY);

    await open(page);
    expect(await rootOverflow(), 'html:has(#menu-movil[open]) { overflow: hidden } (§5.8)').toBe(
      'hidden',
    );

    // And its effect, with a real gesture. `window.scrollBy` is deliberately not used:
    // CSS keeps an `overflow: hidden` scrollport scrollable by script, so a
    // programmatic scroll moves the page in Chromium and in WebKit even though the
    // lock is doing its job, and `scroll-behavior: smooth` (src/styles/base.css) makes
    // reading the result right afterwards a race on top of that.
    let wheeled = true;
    const before = await scrollY();
    try {
      await page.mouse.wheel(0, 600);
    } catch {
      // WebKit implements no wheel: there the assertions above are what V5-4 measures.
      wheeled = false;
    }
    if (wheeled) {
      // Long enough for a scroll that was not blocked to have landed.
      await page.waitForTimeout(400);
      expect(await scrollY(), `scrollY does not move with the sheet open (V5-4)`).toBe(before);
    }

    // The lock belongs to the open sheet, not to the page: it goes when the sheet does.
    await page.keyboard.press('Escape');
    await expect(page.locator(SHEET)).toBeHidden();
    expect(await rootOverflow(), 'the page scrolls again once the sheet closes (§5.8)').not.toBe(
      'hidden',
    );
  });

  test('the veil computes the overlay colour and a 4 px blur', async ({ page }) => {
    await open(page);

    const veil: Veil = await page.evaluate(() => {
      const sheet = document.querySelector('dialog#menu-movil');
      if (sheet === null) return null;
      // §5.8: the veil is the `::backdrop` of the dialog, or the own element inside it
      // that the section allows when `::backdrop` does not inherit the tokens.
      const own = sheet.querySelector('[class*="scrim"]');
      const style = own === null ? getComputedStyle(sheet, '::backdrop') : getComputedStyle(own);
      const filter =
        style.backdropFilter === '' || style.backdropFilter === 'none'
          ? ((style as unknown as { webkitBackdropFilter?: string }).webkitBackdropFilter ?? '')
          : style.backdropFilter;
      return {
        where: own === null ? '::backdrop' : 'element',
        background: style.backgroundColor,
        filter,
      };
    });

    expect(veil, 'the sheet is on screen').not.toBeNull();

    const colour = parseColor(veil?.background ?? '');
    expect(
      colour,
      `the veil (${veil?.where}) computes a colour, not «${veil?.background}»`,
    ).not.toBeNull();
    expect
      .soft(
        [colour?.r, colour?.g, colour?.b],
        `the veil (${veil?.where}) is the overlay token (V5-4)`,
      )
      .toEqual([OVERLAY.r, OVERLAY.g, OVERLAY.b]);
    expect
      .soft(Math.abs((colour?.a ?? 0) - OVERLAY.a), `the veil is ${OVERLAY.a} opaque (V5-4)`)
      .toBeLessThanOrEqual(0.01);
    expect
      .soft(veil?.filter ?? '', `the veil (${veil?.where}) blurs 4 px (V5-4)`)
      .toContain(OVERLAY_BLUR);
  });

  test('a window that reaches 1280 closes it (§5.8)', async ({ page }) => {
    await open(page);

    await page.setViewportSize(DESKTOP);

    await expect(page.locator(SHEET), 'from 1280 the sheet does not exist (§5.8)').toBeHidden();
    await expect(
      page.locator(TRIGGER).first(),
      'from 1280 the header has no menu button (§5.6)',
    ).toBeHidden();
  });
});
