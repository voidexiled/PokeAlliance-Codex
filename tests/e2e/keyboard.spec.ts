// §14.3 keyboard gate (§13.7 «Foco» and «Teclado»). Walks every route of §14.4 with Tab
// and Shift+Tab, at most 400 stops, and checks on each stop that the focus ring is the
// one §13.7 fixes (2 px of `ring`), that nothing covers the focused element once the
// scroll it caused has settled (WCAG 2.4.11) and that it has no `aria-hidden` ancestor.
// A second test checks that Escape closes the tooltip, the sheet, the language list, every
// dialog, select and combobox list of the page (S13), and gives the focus back to the
// trigger; a dialog also has to take the focus when it opens, on the element it marks for
// it when it marks one (§7.2.8).
//
// The routes come from tests/e2e/routes.ts, so the gate grows with the migration.
//
// Contract with tests/e2e/routes.ts (track C of M2): `testRoutes` is the §14.4 list and
// every entry carries `path` (site relative, with leading and trailing slash) and
// `locale` ('es' | 'en').

import type { Locator, Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { queryRoutes, testRoutes } from './routes';

/** §14.3: the walk stops here even if the page has more focusable elements. */
const MAX_STOPS = 400;

/** §13.7: `outline: 2px solid ring`. */
const MIN_OUTLINE_WIDTH = 2;

/**
 * A focus stop that lies outside the window scrolls into view, and with
 * `scroll-behavior: smooth` (base.css, §6.4) that scroll lasts up to a second. Measured
 * in the middle of it, the element is still below the fold or under the sticky header
 * and the hit test reports it as covered when it is not. So the walk waits until the
 * page stops moving before it measures.
 *
 * Chromium moves the first pixel on the second animation frame after Tab, and the tail
 * of the easing repeats a position for one frame before its last pixel. The page is
 * still once nothing has moved for STILL_FRAMES frames in a row and at least
 * MIN_SETTLE_FRAMES have passed, which leaves two frames of margin on the start.
 */
const STILL_FRAMES = 3;
const MIN_SETTLE_FRAMES = 4;

/**
 * About three seconds at 60 Hz; the longest smooth scroll measured on a long page takes
 * under a second. Counted in frames like the rest of the wait, so it does not depend on
 * the clock the fixtures fix (fixtures.ts).
 */
const MAX_SETTLE_FRAMES = 180;

type FocusStop = {
  path: string;
  label: string;
  outlineWidth: number;
  outlineStyle: string;
  outlineColor: string;
  ariaHiddenAncestor: boolean;
  obscured: boolean;
};

/**
 * The computed `ring` token as the browser serializes a color, so the outline color can
 * be compared with it. A page without the token never loaded the new stylesheet.
 */
async function ringColor(page: Page): Promise<string> {
  return page.evaluate(() => {
    const token = getComputedStyle(document.documentElement).getPropertyValue('--ring').trim();
    if (token === '') return '';
    const probe = document.createElement('span');
    probe.style.color = token;
    document.body.append(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  });
}

/**
 * Resolves once scrolling has settled: the scroll offsets of the window and of every
 * ancestor of the focused element (the sidebar and the sheet scroll on their own) are
 * the same on STILL_FRAMES consecutive frames. Only offsets count, not boxes: an infinite
 * animation (the bounce of §6.2) never settles. After MAX_SETTLE_FRAMES it gives up and
 * lets the stop be measured where it is.
 */
async function settle(page: Page): Promise<void> {
  await page.evaluate(
    ({ stillFrames, minFrames, maxFrames }) =>
      new Promise<void>((resolve) => {
        const snapshot = (): string => {
          const values: number[] = [window.scrollX, window.scrollY];
          const active = document.activeElement;
          for (let node = active?.parentElement ?? null; node !== null; node = node.parentElement) {
            values.push(node.scrollLeft, node.scrollTop);
          }
          return values.join(',');
        };

        let last = snapshot();
        let frames = 0;
        let still = 0;
        const tick = (): void => {
          const now = snapshot();
          frames += 1;
          still = now === last ? still + 1 : 0;
          last = now;
          const settled = still >= stillFrames && frames >= minFrames;
          if (settled || frames >= maxFrames) resolve();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    { stillFrames: STILL_FRAMES, minFrames: MIN_SETTLE_FRAMES, maxFrames: MAX_SETTLE_FRAMES },
  );
}

/** Reads the element that has the focus now; null once the focus left the document. */
async function readFocus(page: Page): Promise<FocusStop | null> {
  return page.evaluate(() => {
    const active = document.activeElement;
    if (active === null || active === document.body || active === document.documentElement) {
      return null;
    }

    const domPath = (element: Element): string => {
      const parts: string[] = [];
      let node: Element | null = element;
      while (node !== null && node !== document.documentElement) {
        const parent: Element | null = node.parentElement;
        const index = parent === null ? 0 : Array.from(parent.children).indexOf(node) + 1;
        parts.unshift(`${node.localName}:nth-child(${index})`);
        node = parent;
      }
      return parts.join('>');
    };

    const style = getComputedStyle(active);

    // The centre of the part of each box of the element that is inside the viewport: an
    // element wider than the window still has a point to hit-test (WCAG 2.4.11). A link that
    // wraps onto two lines has one box per line, and the centre of the rectangle around both
    // can fall between the lines, on its parent; so every line box is tested on its own, and
    // the element counts as covered when any of them is.
    const centres = Array.from(active.getClientRects()).flatMap((rect) => {
      const left = Math.max(rect.left, 0);
      const top = Math.max(rect.top, 0);
      const right = Math.min(rect.right, window.innerWidth);
      const bottom = Math.min(rect.bottom, window.innerHeight);
      return right > left && bottom > top ? [[(left + right) / 2, (top + bottom) / 2]] : [];
    });
    const obscured =
      centres.length === 0 ||
      centres.some(([x, y]) => {
        const hit = document.elementFromPoint(x, y);
        return hit === null || !active.contains(hit);
      });

    return {
      path: domPath(active),
      label: `${active.localName}${active.id === '' ? '' : `#${active.id}`} «${(
        active.textContent ?? ''
      )
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 40)}»`,
      outlineWidth: Number.parseFloat(style.outlineWidth),
      outlineStyle: style.outlineStyle,
      outlineColor: style.outlineColor,
      ariaHiddenAncestor: active.closest('[aria-hidden="true"]') !== null,
      obscured,
    };
  });
}

/** Presses `key` up to MAX_STOPS times and returns every stop it visited. */
async function walk(page: Page, key: 'Tab' | 'Shift+Tab'): Promise<FocusStop[]> {
  const stops: FocusStop[] = [];
  let first = '';

  for (let step = 0; step < MAX_STOPS; step += 1) {
    await page.keyboard.press(key);
    await settle(page);
    const stop = await readFocus(page);
    if (stop === null) break;
    if (step === 0) first = stop.path;
    else if (stop.path === first) break;
    stops.push(stop);
  }

  return stops;
}

function ringFailures(stops: FocusStop[], ring: string): string[] {
  return stops
    .filter(
      (stop) =>
        stop.outlineStyle === 'none' ||
        stop.outlineWidth < MIN_OUTLINE_WIDTH ||
        stop.outlineColor.replaceAll(' ', '') !== ring.replaceAll(' ', ''),
    )
    .map(
      (stop) =>
        `${stop.label} · outline ${stop.outlineWidth}px ${stop.outlineStyle} ${stop.outlineColor}`,
    );
}

/** The trigger the overlay must give the focus back to (§13.7). */
async function expectFocused(trigger: Locator, label: string): Promise<void> {
  const focused = await trigger.evaluate((element) => element === document.activeElement);
  expect(focused, `Escape returns the focus to ${label}`).toBe(true);
}

/**
 * A control inside an island does nothing until React has hydrated it: Astro removes the
 * `ssr` attribute of the `astro-island` then. A control outside any island is ready once
 * the page has loaded.
 */
async function hydrated(control: Locator): Promise<void> {
  const island = control.locator('xpath=ancestor::astro-island[1]');
  if ((await island.count()) > 0) await expect(island).not.toHaveAttribute('ssr');
}

/** The dialog attribute that names the element taking the focus on open (Dialog.tsx). */
const DIALOG_INITIAL_FOCUS = '[data-ac-dialog-initial]';

// The routes of §14.4 and the results page of Buscar with a query (M10, `queryRoutes`).
for (const route of [...testRoutes, ...queryRoutes]) {
  test(`focus ring, hit test and aria-hidden hold along ${route.path}`, async ({ page }) => {
    // Every stop now waits at least MIN_SETTLE_FRAMES, about 100 ms with the two reads
    // around it, so a page with a few hundred stops each way outlasts the default 30 s.
    test.slow();
    await page.goto(route.path);
    if (route.ready) await page.locator(route.ready).waitFor();

    const ring = await ringColor(page);
    expect(ring, '--ring is defined: the page loads src/styles/tokens.css').not.toBe('');

    // Start from the top of the document without clicking anything: a click at the top
    // left corner would land on the skip link or the brand and navigate away.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    const forward = await walk(page, 'Tab');
    expect(forward.length, 'Tab reaches at least one element').toBeGreaterThan(0);

    const backward = await walk(page, 'Shift+Tab');
    const stops = [...forward, ...backward];

    expect.soft(ringFailures(stops, ring), `focus ring is 2px solid ${ring} (§13.7)`).toEqual([]);
    expect
      .soft(
        stops.filter((stop) => stop.obscured).map((stop) => stop.label),
        'nothing covers the focused element (WCAG 2.4.11)',
      )
      .toEqual([]);
    expect
      .soft(
        stops.filter((stop) => stop.ariaHiddenAncestor).map((stop) => stop.label),
        'no focused element has an aria-hidden ancestor',
      )
      .toEqual([]);
  });

  test(`Escape closes every overlay and returns the focus on ${route.path}`, async ({ page }) => {
    await page.goto(route.path);
    let checked = 0;

    const tooltipTrigger = page.locator('[data-ac-tt] a, [data-ac-tt] button').first();
    if ((await tooltipTrigger.count()) > 0) {
      await tooltipTrigger.focus();
      const panel = page.locator('[role="tooltip"][data-open]').first();
      await expect(panel).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.locator('[role="tooltip"][data-open]')).toHaveCount(0);
      await expectFocused(tooltipTrigger, 'the tooltip trigger');
      checked += 1;
    }

    // `:visible`, like the dialog trigger below: below 1280 the header selector is
    // hidden and the language list lives inside the phone sheet (§5.8), so the first
    // match in the DOM is a button nobody can click.
    const languageTrigger = page.locator('button[popovertarget^="idioma"]:visible').first();
    if ((await languageTrigger.count()) > 0) {
      const target = await languageTrigger.getAttribute('popovertarget');
      await languageTrigger.click();
      await expect(page.locator(`#${target}`)).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.locator(`#${target}`)).toBeHidden();
      await expectFocused(languageTrigger, 'the language button');
      checked += 1;
    }

    const menuTrigger = page.locator('[aria-controls="menu-movil"]').first();
    if ((await menuTrigger.count()) > 0 && (await menuTrigger.isVisible())) {
      await menuTrigger.click();
      await expect(page.locator('dialog#menu-movil')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.locator('dialog#menu-movil')).toBeHidden();
      await expectFocused(menuTrigger, 'the menu button');
      checked += 1;
    }

    // Every dialog trigger, not only the first: the header's search trigger comes first on
    // every page, and a page that composes a `Dialog` (§7.2.8) has more. The dialog takes
    // the focus when it opens — the element it marks for it, «Cancelar» in a confirmation
    // (§9.9, §10.4), or its first control — and gives it back on Escape.
    const dialogTriggers = page.locator('button[aria-haspopup="dialog"]:visible');
    const dialogCount = await dialogTriggers.count();
    for (let index = 0; index < dialogCount; index += 1) {
      const dialogTrigger = dialogTriggers.nth(index);
      const text =
        (await dialogTrigger.getAttribute('aria-label')) ?? (await dialogTrigger.innerText());
      const name = `the dialog trigger «${text.trim()}»`;
      await hydrated(dialogTrigger);
      await dialogTrigger.click();
      const dialog = page.locator('dialog[open]').first();
      await expect(dialog).toBeVisible();
      const focus = await dialog.evaluate(
        (element, initial) => ({
          inside: element.contains(document.activeElement),
          onInitial:
            element.querySelector(initial) === null ||
            document.activeElement === element.querySelector(initial),
        }),
        DIALOG_INITIAL_FOCUS,
      );
      expect(focus.inside, `${name} opens a dialog that takes the focus`).toBe(true);
      expect(focus.onInitial, `${name} opens with the focus on its marked element`).toBe(true);
      await page.keyboard.press('Escape');
      await expect(page.locator('dialog[open]')).toHaveCount(0);
      await expectFocused(dialogTrigger, name);
      checked += 1;
    }

    // Select and SortSelect (§7.2.2, S13): the keyboard opens the list, Escape closes it,
    // and the focus never leaves the trigger.
    const selectTriggers = page.locator('button[role="combobox"][aria-haspopup="listbox"]:visible');
    const selectCount = await selectTriggers.count();
    for (let index = 0; index < selectCount; index += 1) {
      const selectTrigger = selectTriggers.nth(index);
      const list = page.locator(`[id="${await selectTrigger.getAttribute('aria-controls')}"]`);
      await hydrated(selectTrigger);
      await selectTrigger.focus();
      await page.keyboard.press('ArrowDown');
      await expect(selectTrigger).toHaveAttribute('aria-expanded', 'true');
      await expect(list).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(selectTrigger).toHaveAttribute('aria-expanded', 'false');
      await expect(list).toBeHidden();
      await expectFocused(selectTrigger, `the select «${await selectTrigger.innerText()}»`);
      checked += 1;
    }

    // Combobox (§7.2.8): typing opens its list, Escape closes it, the focus stays in the field.
    // The list shows the suggestions that match the text, and with none it stays closed
    // (Combobox.tsx), so a letter that matches nothing of a field's data opens nothing. Each
    // field gets «a» first, with the default wait so its data can arrive, and then the other
    // vowels, a second each, until one opens the list. A field that no vowel opens fails.
    const comboboxFields = page.locator('input[role="combobox"]:visible');
    const comboboxCount = await comboboxFields.count();
    for (let index = 0; index < comboboxCount; index += 1) {
      const field = comboboxFields.nth(index);
      const list = page.locator(`[id="${await field.getAttribute('aria-controls')}"]`);
      await hydrated(field);
      let opened = false;
      for (const [attempt, letter] of [...'aeiou'].entries()) {
        await field.fill('');
        await field.focus();
        await page.keyboard.type(letter);
        opened = await expect(field)
          .toHaveAttribute('aria-expanded', 'true', attempt === 0 ? {} : { timeout: 1_000 })
          .then(
            () => true,
            () => false,
          );
        if (opened) break;
      }
      expect(
        opened,
        `typing opens the list of the combobox #${await field.getAttribute('id')}`,
      ).toBe(true);
      await expect(list).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(field).toHaveAttribute('aria-expanded', 'false');
      await expect(list).toBeHidden();
      await expectFocused(field, 'the combobox field');
      checked += 1;
    }

    test.skip(checked === 0, 'This route has no tooltip, sheet, language list or dialog yet.');
  });
}
