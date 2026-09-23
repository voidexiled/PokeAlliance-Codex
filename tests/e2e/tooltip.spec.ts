// §14.3 tooltip gate: S3 (§2), C7-06, C7-07 and C7-08 (§7.14) over the game tooltip of
// §7.5 — the owner's signature element and the one piece of the site with its own
// delegated controller.
//
// Three suites, because the three criteria ask for different things:
//
//  - «wiring» walks every route of tests/e2e/routes.ts and reads the markup alone
//    (C7-08, and the «ningún article es disparador» half of S3). It needs no
//    interaction, so it grows with the migration for free.
//  - «behaviour» stays on the frame parity route and drives TT1–TT13 with mouse,
//    keyboard and emulated touch (C7-06), including the bridge of §7.5.6 and the panel
//    that scrolls inside itself when it does not fit (S3).
//  - «placement» opens every trigger of every route in turn (C7-07): the final side
//    agrees with the declared placement, the panel stays 8 px inside the window (16
//    below `layout-bp-md`) and it never covers the head zone of its own card.
//
// C7-07 names `Lienzo:Comercio`, `Lienzo:Pokedex` and the Pokémon sheet, and none of
// the three exists in this milestone. The placement suite is keyed on `testRoutes` and
// on the markup of §7.5.5 (`data-ac-tt-placement`, `article[data-anat]`,
// `[data-zone="head"]`) rather than on those three pages, so M6, M7 and M13 bring them
// under the same measurement by adding their route to scripts/lib/rutas-migradas.mjs,
// with no change here. `avoidHead` is measured on whatever cards a route carries, so it
// starts answering from M6.
//
// Contract with track A of M4 (`src/routes/_paridad/marco.astro`). The page keeps
// everything tests/e2e/frame.spec.ts asks of it and adds a section with entities:
//
//  1. at least three `[data-ac-tt]` wrappers, so TT9 can be measured (one pinned, one
//     unpinned, and a third that has to close);
//  2. at least one `<a href>` trigger and at least one `<button type="button">`
//     trigger, the two forms of §7.5.7 — TT5 ends differently on each;
//  3. every wrapper built as §7.5.1 says: the trigger and, inside the same wrapper, its
//     `GameTooltip` panel with `id`, `role="tooltip"` and `popover="manual"`;
//  4. a `PlusN` (§7.5.8) that is not 200 px under the first trigger, where the scroll of
//     TT13 would bring it under a still pointer. The Lista row of TT10 is built by the test
//     itself from one of the page's wrappers, until `ListRow` arrives with M6.
//
// Contract with tracks D, E and F, all of it from §7.5.4 and §7.5.5: the wrapper carries
// `data-ac-tt` plus `data-ac-tt-placement` and `data-ac-tt-align`; an open panel carries
// `data-open` and `data-side` with the final side, and `data-pinned` when Shift pinned
// it; `ac:modal-open` bubbles to the document (src/scripts/mobile-menu.ts already
// dispatches it that way).

import type { Locator, Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { testRoutes } from './routes';
import { idiomas } from '../../scripts/lib/rutas-migradas.mjs';

const [MAIN_LOCALE] = idiomas;

/** The page of the contract above; §14.5 injects it in the development server. */
const FRAME_ROUTE = `/${MAIN_LOCALE}/_paridad/marco/`;

const TRIGGER = '[data-ac-tt] :is(a, button)[aria-describedby]';
/** §7.5.4 TT10 and §7.5.8: a Lista row and a «+N» button. */
const ROW = 'tr[data-ac-tt-row]';
const PLUSN = '[data-ac-plusn]';
const OPEN = '[role="tooltip"][data-open]';
const PINNED = '[role="tooltip"][data-open][data-pinned]';
const UNPINNED = '[role="tooltip"][data-open]:not([data-pinned])';

/** §7.5.4, TT2: the close is scheduled 100 ms after the pointer leaves. */
const CLOSE_DELAY = 100;

/** §7.5.4, TT8: a Shift held longer than this never pins. */
const PIN_WINDOW = 400;

/** §7.5.5: the panel stays this far inside the window, 16 below `layout-bp-md` (§5.4). */
const EDGE_PADDING = 8;
const PHONE_EDGE_PADDING = 16;
const PHONE_MAX_WIDTH = 768;

/** §7.5.5: `size` never writes a `max-height` below this, however little room there is. */
const MIN_PANEL_HEIGHT = 120;

/** §7.5.6: the bridge is measured by crossing the gap in ten straight steps. */
const BRIDGE_STEPS = 10;

/** TT13: how far the page is scrolled to check that `autoUpdate` follows the trigger. */
const SCROLL_STEP = 200;

/** Geometry is compared to half a pixel: a subpixel layout is not a placement bug. */
const TOLERANCE = 0.5;

/**
 * The placement suite opens one panel at a time, so a long list would dominate the run.
 * Twenty-four triggers cover every zone of the §7.5.5 table on any one page; a page with
 * more repeats zones it has already answered for.
 */
const PLACEMENT_SAMPLE = 24;

/** §7.5.5: the sides each `data-ac-tt-placement` may end on, `flip` included. */
const SIDES: Record<string, string[]> = {
  // `flip` only goes to the opposite vertical side, and `avoidHead` only pushes down.
  up: ['top', 'bottom'],
  down: ['bottom', 'top'],
  'above-center': ['top', 'bottom'],
  // `side-right` flips to `side-left`, and below 768 it opens under the slot.
  side: ['right', 'left', 'bottom'],
  // Never to the left, over the sprite: right, or under the name cell, and above the row
  // when a low row has no room below, so the panel never hides the focused name (S13,
  // D-018).
  row: ['right', 'bottom', 'top'],
};

/** §7.5.5, default: a wrapper that writes no placement is `up`. */
const DEFAULT_PLACEMENT = 'up';

type Box = { x: number; y: number; width: number; height: number };

function edgePadding(page: Page): number {
  const viewport = page.viewportSize();
  return viewport !== null && viewport.width < PHONE_MAX_WIDTH ? PHONE_EDGE_PADDING : EDGE_PADDING;
}

function centre(box: Box): { x: number; y: number } {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** The box of a locator, with a message that names it when it has none. */
async function boxOf(locator: Locator, what: string): Promise<Box> {
  const box = await locator.boundingBox();
  expect(box, `${what} has to be laid out to be measured`).not.toBeNull();
  return box as Box;
}

/** The visible text of a trigger, for the failure messages of the placement suite. */
async function nameOf(trigger: Locator): Promise<string> {
  const text = ((await trigger.textContent()) ?? '').trim().replace(/\s+/g, ' ');
  if (text.length > 0) return text.slice(0, 40);
  return (await trigger.getAttribute('aria-label')) ?? '(sin nombre)';
}

/**
 * Opens a route and checks what it answers: 200, or the 404 of the two §14.4 probes
 * (`route.status`, tests/e2e/routes.ts), which land on the page of §8.12 with its frame.
 */
async function goTo(page: Page, path: string, status = 200): Promise<void> {
  const response = await page.goto(path);
  expect(
    response?.status(),
    `${path} has to answer ${status}: the parity routes of §14.5 are injected with VISUAL=1 ` +
      'and the development server of §14.3 needs the same injection',
  ).toBe(status);
}

/** The frame parity route with the contract above checked, so a failure names the cause. */
async function openFrame(page: Page): Promise<Locator[]> {
  await goTo(page, FRAME_ROUTE);
  const found = await page.locator(TRIGGER).all();
  expect(
    found.length,
    `${FRAME_ROUTE} carries at least three [data-ac-tt] triggers, so TT9 can be ` +
      'measured with one pinned, one unpinned and a third that has to close (M4, track A)',
  ).toBeGreaterThanOrEqual(3);
  return found;
}

/** Puts the pointer somewhere no wrapper covers, which is what TT2 and TT6 need. */
async function movePointerAway(page: Page): Promise<void> {
  await page.mouse.move(2, 2);
}

/** §7.5.4, TT8: one Shift press inside the 400 ms window pins or releases `active`. */
async function pressShift(page: Page): Promise<void> {
  await page.keyboard.down('Shift');
  await page.keyboard.up('Shift');
}

// ------------------------------------------------------------------ C7-08: the wiring

type Wiring = {
  wrappers: number;
  /** A `[data-ac-tt]` with no `<a>`/`<button>` carrying `aria-describedby`. */
  noTrigger: string[];
  /** A trigger whose `aria-describedby` reaches nothing, or something not a tooltip. */
  noPanel: string[];
  /** A panel that is not `popover="manual"` (§7.5.1). */
  notManual: string[];
  /** A panel outside its own wrapper, which would break the bridge of §7.5.6. */
  outsideWrapper: string[];
  /** Two panels sharing an id: `aria-describedby` would reach the wrong one. */
  duplicateIds: string[];
  /** §7.5.10: a card, an `article` or a whole row used as a trigger. */
  cardTriggers: string[];
};

/**
 * Everything C7-08 asks of a page, read in one pass. It runs in the browser because the
 * check is «does this `aria-describedby` reach a `role="tooltip"`», which is a question
 * about the document and not about the HTML source.
 */
async function readWiring(page: Page): Promise<Wiring> {
  return page.evaluate(() => {
    const label = (element: Element): string => {
      const text = (element.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40);
      const id = element.id === '' ? '' : `#${element.id}`;
      return `${element.localName}${id}${text === '' ? '' : ` «${text}»`}`;
    };
    const describedPanel = (element: Element): Element | null => {
      const id = element.getAttribute('aria-describedby');
      if (id === null || id === '') return null;
      const panel = document.getElementById(id);
      return panel !== null && panel.getAttribute('role') === 'tooltip' ? panel : null;
    };

    const wrappers = Array.from(document.querySelectorAll('[data-ac-tt]'));
    const noTrigger: string[] = [];
    const noPanel: string[] = [];
    const notManual: string[] = [];
    const outsideWrapper: string[] = [];

    for (const wrapper of wrappers) {
      const trigger = wrapper.querySelector('a[aria-describedby], button[aria-describedby]');
      if (trigger === null) {
        noTrigger.push(label(wrapper));
        continue;
      }
      const panel = describedPanel(trigger);
      if (panel === null) {
        noPanel.push(label(trigger));
        continue;
      }
      if (panel.getAttribute('popover') !== 'manual') notManual.push(label(panel));
      if (!wrapper.contains(panel)) outsideWrapper.push(label(panel));
    }

    const seen = new Set<string>();
    const duplicateIds: string[] = [];
    for (const panel of document.querySelectorAll('[role="tooltip"]')) {
      if (panel.id === '') continue;
      if (seen.has(panel.id)) duplicateIds.push(panel.id);
      else seen.add(panel.id);
    }

    // §7.5.10: «Nunca una tarjeta completa, `article` ni fila entera como disparador.»
    // `tr[data-ac-tt-row]` is not one of these: TT10 opens the panel of the name cell,
    // and the row carries a different attribute.
    const cardTriggers = Array.from(document.querySelectorAll('article, tr, [data-anat]'))
      .filter((element) => element.hasAttribute('data-ac-tt') || describedPanel(element) !== null)
      .map(label);

    return {
      wrappers: wrappers.length,
      noTrigger,
      noPanel,
      notManual,
      outsideWrapper,
      duplicateIds,
      cardTriggers,
    };
  });
}

test.describe('every trigger is wired to its panel (C7-08, S3)', () => {
  for (const route of testRoutes) {
    test(`${route.path} wires its tooltips`, async ({ page }) => {
      await goTo(page, route.path, route.status);
      const wiring = await readWiring(page);

      expect
        .soft(wiring.noTrigger, 'a [data-ac-tt] wrapper without its <a>/<button> (§7.5.7)')
        .toEqual([]);
      expect
        .soft(wiring.noPanel, 'aria-describedby has to reach a role="tooltip" (C7-08)')
        .toEqual([]);
      expect.soft(wiring.notManual, 'the panel is popover="manual" (§7.5.1)').toEqual([]);
      expect
        .soft(wiring.outsideWrapper, 'the panel lives inside its own wrapper (§7.5.6)')
        .toEqual([]);
      expect.soft(wiring.duplicateIds, 'two panels with the same id (§7.5.2, `key`)').toEqual([]);
      expect
        .soft(wiring.cardTriggers, 'no card, article or whole row is a trigger (§7.5.10)')
        .toEqual([]);
    });
  }
});

// ------------------------------------------------------- C7-06: TT1–TT13 and the bridge

test.describe('the tooltip controller (C7-06)', () => {
  test('hover opens the panel and the pointer crosses into it (TT1, §7.5.6)', async ({ page }) => {
    const [trigger] = await openFrame(page);
    await trigger.hover();

    const panel = page.locator(OPEN);
    await expect(panel, 'TT1: the pointer entering the wrapper opens its panel').toHaveCount(1);

    // §7.5.6: ten straight steps from the centre of the trigger to the centre of the
    // panel. The transparent `::before` of the panel covers the gap, so the pointer
    // never leaves the wrapper and no close is ever scheduled.
    const target = centre(await boxOf(panel, 'the open panel'));
    await page.mouse.move(target.x, target.y, { steps: BRIDGE_STEPS });
    await page.waitForTimeout(CLOSE_DELAY * 2);
    await expect(panel, 'the panel is hoverable: crossing the gap keeps it open').toHaveCount(1);
  });

  test('the pointer leaving closes the panel (TT2)', async ({ page }) => {
    const [trigger] = await openFrame(page);
    await trigger.hover();
    await expect(page.locator(OPEN)).toHaveCount(1);

    await movePointerAway(page);
    await expect(page.locator(OPEN), 'TT2: the close is scheduled at 100 ms').toHaveCount(0);
  });

  test('focus opens it and keeps it open, focusout closes it (TT3, TT4)', async ({ page }) => {
    const [trigger] = await openFrame(page);
    await movePointerAway(page);

    // A Tab first, so the focus that follows is a keyboard focus and the trigger matches
    // `:focus-visible` — which is what TT3 keys the «stays open» half on.
    await page.keyboard.press('Tab');
    await trigger.focus();
    expect(
      await trigger.evaluate((element) => element.matches(':focus-visible')),
      'TT3 reads a keyboard focus, so the trigger has to match :focus-visible',
    ).toBe(true);
    await expect(page.locator(OPEN), 'TT3: the focus opens the panel').toHaveCount(1);

    await page.mouse.move(4, 4);
    await page.waitForTimeout(CLOSE_DELAY * 2);
    await expect(
      page.locator(OPEN),
      'TT3: with a keyboard focus the panel stays open although the pointer is elsewhere',
    ).toHaveCount(1);

    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await expect(page.locator(OPEN), 'TT4: the focus leaving closes it').toHaveCount(0);
  });

  test('a pointerdown outside closes what is not pinned (TT6)', async ({ page }) => {
    const [trigger] = await openFrame(page);
    await trigger.hover();
    await expect(page.locator(OPEN)).toHaveCount(1);

    // The h1 of the page: outside every wrapper and not a control, so the press is the
    // «pointerdown fuera» of TT6 and nothing else.
    await page.locator('h1').first().click();
    await expect(page.locator(OPEN), 'TT6: a press outside closes the unpinned').toHaveCount(0);
  });

  test('after Escape the pointer moving inside the trigger does not reopen it (TT7)', async ({
    page,
  }) => {
    const triggers = await openFrame(page);
    // The first slot is an <a> with the Pokémon art; the first <button> is an item slot
    // with a pixel sprite. Both have an element inside the trigger the pointer can cross.
    const button = page.locator('[data-ac-tt] button[aria-describedby]').first();
    for (const trigger of [triggers[0], button]) {
      const box = await boxOf(trigger, 'the trigger');
      await movePointerAway(page);
      // The corner of the frame, then the sprite in the middle: the second move crosses
      // from the trigger into its image, which fires `pointerover` inside the wrapper.
      await page.mouse.move(box.x + 2, box.y + 2);
      await expect(page.locator(OPEN)).toHaveCount(1);
      await page.keyboard.press('Escape');
      await expect(page.locator(OPEN)).toHaveCount(0);

      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 5 });
      await page.waitForTimeout(CLOSE_DELAY * 2);
      await expect(
        page.locator(OPEN),
        'TT7, WCAG 1.4.13: a dismissed panel stays shut until the pointer enters again',
      ).toHaveCount(0);

      await movePointerAway(page);
      await trigger.hover();
      await expect(page.locator(OPEN), 'TT1: a new entry opens it again').toHaveCount(1);
      await page.keyboard.press('Escape');
    }
  });

  test('a focusin or pointerover that React replays after hydrating opens nothing (TT3, TT7)', async ({
    page,
  }) => {
    const [trigger] = await openFrame(page);
    await trigger.focus();
    await expect(page.locator(OPEN)).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(page.locator(OPEN)).toHaveCount(0);

    // React dispatches a copy of the events that reached an island before it hydrated, once
    // it has: untrusted events on the same trigger, which are not the focus or the pointer
    // arriving now (D-018).
    await trigger.evaluate((element) => {
      element.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      element.dispatchEvent(
        new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }),
      );
    });
    await page.waitForTimeout(CLOSE_DELAY * 2);
    await expect(
      page.locator(OPEN),
      'TT7: a replayed event does not reopen the panel Escape closed',
    ).toHaveCount(0);
  });

  test('Escape closes every panel, the pinned one included (TT7)', async ({ page }) => {
    const [first, second] = await openFrame(page);

    await first.hover();
    await expect(page.locator(OPEN)).toHaveCount(1);
    await pressShift(page);
    await expect(page.locator(PINNED), 'TT8: one Shift pins `active`').toHaveCount(1);

    await second.hover();
    await expect(page.locator(OPEN), 'TT9: the pinned one plus the new one').toHaveCount(2);

    await page.keyboard.press('Escape');
    await expect(page.locator(OPEN), 'TT7: Escape closes the pinned one too').toHaveCount(0);
  });

  test('one Shift pins and releases; Shift+Tab does not (TT8)', async ({ page }) => {
    const [trigger] = await openFrame(page);
    await trigger.hover();
    await expect(page.locator(OPEN)).toHaveCount(1);

    await pressShift(page);
    await expect(page.locator(PINNED), 'TT8: one Shift pins it').toHaveCount(1);

    await pressShift(page);
    await expect(page.locator(PINNED), 'TT8: the next one releases it').toHaveCount(0);
    await expect(
      page.locator(OPEN),
      'releasing leaves the panel open under the pointer',
    ).toHaveCount(1);

    await page.keyboard.press('Shift+Tab');
    await expect(page.locator(PINNED), 'TT8: Shift+Tab never pins').toHaveCount(0);
  });

  test('a long Shift and a press while Shift is down do not pin (TT8)', async ({ page }) => {
    const [trigger] = await openFrame(page);
    await trigger.hover();
    await expect(page.locator(OPEN)).toHaveCount(1);

    // Over 400 ms: the press is no longer a «pulsación sola» and never pins.
    await page.keyboard.down('Shift');
    await page.waitForTimeout(PIN_WINDOW + CLOSE_DELAY);
    await page.keyboard.up('Shift');
    await expect(page.locator(PINNED), 'TT8: a Shift held past 400 ms does not pin').toHaveCount(0);

    // A pointerdown between the two halves of the Shift invalidates it. It lands on the
    // panel, which is inside the wrapper, so TT6 does not close anything either.
    const target = centre(await boxOf(page.locator(OPEN), 'the open panel'));
    await page.keyboard.down('Shift');
    await page.mouse.move(target.x, target.y);
    await page.mouse.down();
    await page.mouse.up();
    await page.keyboard.up('Shift');
    await expect(page.locator(PINNED), 'TT8: Shift+click never pins').toHaveCount(0);
  });

  test('at most one unpinned and one pinned panel are open (TT9)', async ({ page }) => {
    const [first, second, third] = await openFrame(page);

    await first.hover();
    await pressShift(page);
    const pinnedId = await page.locator(PINNED).getAttribute('id');
    expect(pinnedId, 'the pinned panel carries the id its trigger describes').not.toBeNull();

    await second.hover();
    await expect(page.locator(PINNED)).toHaveCount(1);
    await expect(page.locator(UNPINNED)).toHaveCount(1);

    await third.hover();
    await expect(page.locator(PINNED), 'TT9: the pinned one survives a new opening').toHaveCount(1);
    await expect(page.locator(UNPINNED), 'TT9: at most one unpinned panel').toHaveCount(1);

    // Pinning the third releases and closes the first: one pinned panel, nothing else.
    await pressShift(page);
    await expect(page.locator(PINNED), 'TT9: pinning a second releases the first').toHaveCount(1);
    await expect(
      page.locator(OPEN),
      'the panel that was pinned is closed, not just released',
    ).toHaveCount(1);
    expect(
      await page.locator(PINNED).getAttribute('id'),
      'TT9: the panel now pinned is the third one, not the first',
    ).not.toBe(pinnedId);
  });

  test('ac:modal-open closes every panel (TT12)', async ({ page }) => {
    const [trigger] = await openFrame(page);
    await trigger.hover();
    await pressShift(page);
    await expect(page.locator(PINNED)).toHaveCount(1);

    // §7.5.4: the palette, the phone sheet and `Dialog` announce themselves with this
    // event; src/scripts/mobile-menu.ts dispatches it bubbling, so the document sees it.
    await page.evaluate(() =>
      document.body.dispatchEvent(new CustomEvent('ac:modal-open', { bubbles: true })),
    );
    await expect(page.locator(OPEN), 'TT12: a modal closes the pinned panel too').toHaveCount(0);
  });

  test('scrolling keeps the panel open and moves it with its trigger (TT13)', async ({ page }) => {
    const [trigger] = await openFrame(page);
    await trigger.hover();
    const panel = page.locator(OPEN);
    await expect(panel).toHaveCount(1);

    const sideBefore = await panel.getAttribute('data-side');
    const gapBefore =
      (await boxOf(panel, 'the open panel')).y - (await boxOf(trigger, 'the trigger')).y;

    const scrollBefore = await page.evaluate(() => window.scrollY);
    await page.mouse.wheel(0, SCROLL_STEP);
    // `mouse.wheel` returns before the page has scrolled: until it has, the gap below
    // would compare two positions of the same unscrolled page and prove nothing.
    await expect
      .poll(() => page.evaluate(() => window.scrollY), { message: 'TT13 needs the page to scroll' })
      .toBeGreaterThan(scrollBefore);
    await expect(panel, 'TT13: a scroll repositions, it does not close').toHaveCount(1);

    // The panel is `position: fixed` (§7.5.4), so without `autoUpdate` it would stay
    // where it was while its trigger moved the whole scroll. Comparing the gap catches
    // that; when the scroll gave `flip` a reason to change side, the distance changes
    // for a good reason and only the «it did not close» half of TT13 is measured.
    // `autoUpdate` repositions on the next frame, so the gap is polled, not read once.
    await expect
      .poll(
        async () => {
          if ((await panel.getAttribute('data-side')) !== sideBefore) return 0;
          const gapAfter =
            (await boxOf(panel, 'the open panel after the scroll')).y -
            (await boxOf(trigger, 'the trigger after the scroll')).y;
          return Math.abs(gapAfter - gapBefore);
        },
        { message: 'TT13: `autoUpdate` keeps the panel with its trigger' },
      )
      .toBeLessThan(SCROLL_STEP / 2);

    // The scroll left the pointer outside the wrapper without the pointer moving. The
    // first real movement is the pointer leaving, and TT2 closes the panel: a scroll
    // must not leave behind a panel that nothing closes any more.
    await movePointerAway(page);
    await expect(panel, 'TT2 after TT13: the next movement outside closes it').toHaveCount(0);
  });

  test('a trigger that leaves the DOM leaves no panel behind (TT11)', async ({ page }) => {
    const triggers = await openFrame(page);
    await triggers[0].hover();
    await expect(page.locator(OPEN)).toHaveCount(1);

    // What an island repainting does to the controller: the wrapper — panel included —
    // disappears under it. The next opening has to work, which is what TT11 protects.
    await triggers[0].evaluate((element) => element.closest('[data-ac-tt]')?.remove());
    await movePointerAway(page);
    await expect(page.locator(OPEN), 'TT11: no orphan panel survives the removal').toHaveCount(0);

    const survivor = page.locator(TRIGGER).first();
    await survivor.hover();
    await expect(page.locator(OPEN), 'TT11: the controller still opens the next panel').toHaveCount(
      1,
    );
  });

  test('the panel scrolls inside itself when it does not fit (S3)', async ({ page }) => {
    // A window this short leaves less room than the 120 px floor of §7.5.5, so every
    // panel of the page has to clamp and scroll: the case does not depend on the parity
    // page carrying one unusually tall tooltip.
    await page.setViewportSize({ width: 390, height: 320 });
    const [trigger] = await openFrame(page);
    await trigger.hover();

    const panel = page.locator(OPEN);
    await expect(panel).toHaveCount(1);

    const metrics = await panel.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
        maxHeight: style.maxHeight,
        overflowY: style.overflowY,
        overscroll: `${style.overscrollBehaviorY} ${style.overscrollBehavior}`,
      };
    });

    expect(
      Number.parseFloat(metrics.maxHeight),
      '§7.5.5: `size` writes a max-height, and never below 120',
    ).toBeGreaterThanOrEqual(MIN_PANEL_HEIGHT - TOLERANCE);
    expect(
      metrics.scrollHeight,
      'the panel of this page is taller than the room the window leaves',
    ).toBeGreaterThan(metrics.clientHeight);
    expect(['auto', 'scroll'], 'S3: it scrolls inside itself').toContain(metrics.overflowY);
    expect(metrics.overscroll, '§7.5.5: `overscroll-behavior: contain`').toContain('contain');

    const moved = await panel.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
      return element.scrollTop;
    });
    expect(moved, 'the content of the panel really moves').toBeGreaterThan(0);
  });

  test('a panel taller than a short desktop window scrolls inside itself too (S3)', async ({
    page,
  }) => {
    // S3 is not a phone rule: at 1280 × 200 the room left is under the 120 px floor as
    // well, and a panel that keeps `overflow: visible` there draws its last rows and its
    // strip over the page, outside its own background.
    await page.setViewportSize({ width: 1280, height: 200 });
    const [trigger] = await openFrame(page);
    await trigger.hover();

    const panel = page.locator(OPEN);
    await expect(panel).toHaveCount(1);
    await expect(panel, '§7.5.5: the clamped panel is marked').toHaveAttribute(
      'data-ac-tt-scroll',
      '',
    );

    const metrics = await panel.evaluate((element) => {
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return {
        bottom: box.bottom,
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
        overflowY: style.overflowY,
        overscroll: style.overscrollBehaviorY,
      };
    });
    expect(metrics.scrollHeight, 'the content does not fit the window').toBeGreaterThan(
      metrics.clientHeight,
    );
    expect(['auto', 'scroll'], 'S3: it scrolls inside itself').toContain(metrics.overflowY);
    expect(metrics.overscroll, '§7.5.5: `overscroll-behavior: contain`').toBe('contain');
    expect(metrics.bottom, 'the panel stays 8 px inside the window').toBeLessThanOrEqual(
      200 - EDGE_PADDING + TOLERANCE,
    );

    // The strip is the end of the scrollable content: scrolled to the bottom, it lies
    // inside the panel's own box.
    const strip = await panel.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
      const footer = element.querySelector('.ac-game-tooltip__footer');
      return footer === null
        ? null
        : footer.getBoundingClientRect().bottom - element.getBoundingClientRect().bottom;
    });
    expect(strip, 'the panel carries its strip').not.toBeNull();
    expect(strip as number, 'the strip is reached inside the panel').toBeLessThanOrEqual(TOLERANCE);

    // A window that grows back gives the panel its room, and its bridge (§7.5.6).
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(panel, 'a panel that fits again is no longer clamped').not.toHaveAttribute(
      'data-ac-tt-scroll',
    );
    expect(await panel.evaluate((element) => getComputedStyle(element).overflowY)).toBe('visible');
  });
});

// --------------------------------------------------- C7-06: Lista rows and «+N» (TT10, 7.5.8)

/** Id of the panel of the Lista row the TT10 test builds. */
const ROW_PANEL = 'tt10-panel';

/**
 * A Lista row, `tr[data-ac-tt-row]`, built in the page from one of its own wrappers. The
 * Lista view and its `ListRow` arrive with the three views (M6); what TT10 measures here is
 * the controller, which reads nothing but the markup contract of §7.5.4 and §7.5.5: the
 * row, and inside it the wrapper of the name with `data-ac-tt-placement="row"` and its
 * server-rendered panel. The row goes above the first section, inside the first screen.
 */
async function buildListRow(page: Page): Promise<Locator> {
  await page.evaluate((panelId) => {
    const trigger = document.querySelector('[data-ac-tt] button[aria-describedby]');
    const source = trigger?.closest('[data-ac-tt]');
    const section = document.querySelector('main section');
    if (!source || !section) throw new Error('the parity page has no button trigger');

    const wrapper = source.cloneNode(true) as HTMLElement;
    wrapper.setAttribute('data-ac-tt-placement', 'row');
    wrapper.querySelector('[role="tooltip"]')?.setAttribute('id', panelId);
    wrapper.querySelector('button[aria-describedby]')?.setAttribute('aria-describedby', panelId);

    const table = document.createElement('table');
    const row = table.createTBody().insertRow();
    row.setAttribute('data-ac-tt-row', '');
    const lead = row.insertCell();
    lead.style.cssText = 'width: 64px; height: 48px';
    row.insertCell().append(wrapper);
    const tail = row.insertCell();
    tail.style.cssText = 'width: 160px';
    section.before(table);
  }, ROW_PANEL);
  return page.locator(ROW);
}

/** A point of a cell of the row that is not the name: its left edge, halfway down. */
async function quietPointOf(cell: Locator): Promise<{ x: number; y: number }> {
  const box = await boxOf(cell, 'a cell of the row');
  return { x: box.x + 2, y: box.y + box.height / 2 };
}

test.describe('Lista rows and «+N» share the controller (C7-06)', () => {
  test('the row opens the panel of its name and keeps it inside the row (TT10)', async ({
    page,
  }) => {
    await openFrame(page);
    const row = await buildListRow(page);
    const cells = row.locator('td');
    const name = row.locator(TRIGGER);

    await movePointerAway(page);
    const inRow = await quietPointOf(cells.last());
    await page.mouse.move(inRow.x, inRow.y);
    const panel = page.locator(OPEN);
    await expect(panel, 'TT10: entering the row opens one panel').toHaveCount(1);
    expect(await panel.getAttribute('id'), 'TT10: the panel of the name of the row').toBe(
      ROW_PANEL,
    );
    expect(['right', 'bottom'], '§7.5.5 `row`: never to the left, over the sprite').toContain(
      await panel.getAttribute('data-side'),
    );

    // Walking from one cell to another stays inside the row, so nothing closes.
    const lead = await quietPointOf(cells.first());
    await page.mouse.move(lead.x, lead.y, { steps: 5 });
    await page.waitForTimeout(CLOSE_DELAY * 2);
    await expect(panel, 'TT10: the panel belongs to the row, not to the name').toHaveCount(1);

    // TT7: Escape closes it and the row stays shut, even on its name, until it is left.
    await page.keyboard.press('Escape');
    const nameBox = await boxOf(name, 'the name of the row');
    await page.mouse.move(nameBox.x + nameBox.width / 2, nameBox.y + nameBox.height / 2, {
      steps: 5,
    });
    await page.waitForTimeout(CLOSE_DELAY * 2);
    await expect(
      page.locator(OPEN),
      'TT7: the row Escape closed does not reopen by hover until the pointer leaves it',
    ).toHaveCount(0);

    await movePointerAway(page);
    await page.mouse.move(inRow.x, inRow.y, { steps: 3 });
    await expect(page.locator(OPEN), 'TT10: entering the row again opens it').toHaveCount(1);

    await movePointerAway(page);
    await expect(page.locator(OPEN), 'TT10: leaving the row closes it').toHaveCount(0);
  });

  test('«+N» opens on hover and click, shares TT9 and closes with Escape (7.5.8)', async ({
    page,
  }) => {
    const [trigger] = await openFrame(page);
    const plus = page.locator(PLUSN).first();
    expect(
      await plus.count(),
      `${FRAME_ROUTE} carries a «+N» after its item slots (M4, track A)`,
    ).toBeGreaterThan(0);
    const listId = await plus.getAttribute('aria-controls');
    expect(listId, 'the button names its list with aria-controls').not.toBeNull();
    const list = page.locator(`[id="${listId}"]`);

    // Opened by hover, it closes when the pointer leaves.
    await movePointerAway(page);
    await plus.hover();
    await expect(plus, 'hover opens the list').toHaveAttribute('aria-expanded', 'true');
    await expect(list).toBeVisible();
    await movePointerAway(page);
    await expect(plus, 'a hover opening closes on leaving').toHaveAttribute(
      'aria-expanded',
      'false',
    );
    await expect(list).toBeHidden();

    // Opened by a click, it stays after the pointer leaves…
    await plus.click();
    await expect(plus).toHaveAttribute('aria-expanded', 'true');
    await movePointerAway(page);
    await page.waitForTimeout(CLOSE_DELAY * 2);
    await expect(plus, 'a click keeps the list open').toHaveAttribute('aria-expanded', 'true');

    // …until a panel opens: one list or unpinned panel at a time (TT9).
    await trigger.hover();
    await expect(page.locator(OPEN)).toHaveCount(1);
    await expect(plus, 'TT9: opening a panel closes the list').toHaveAttribute(
      'aria-expanded',
      'false',
    );
    await page.keyboard.press('Escape');

    // Escape and a press outside close a list a click opened.
    await plus.click();
    await expect(plus).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await expect(plus, 'Escape closes the list').toHaveAttribute('aria-expanded', 'false');
    await expect(list).toBeHidden();

    await plus.click();
    await expect(plus).toHaveAttribute('aria-expanded', 'true');
    await page.locator('h1').first().click();
    await expect(plus, 'a press outside closes it').toHaveAttribute('aria-expanded', 'false');
  });
});

// ------------------------------------------------------------------------ S7: sprites

type SpriteReading = {
  src: string;
  ratio: number;
  rendering: string;
  inMenu: boolean;
};

/** Every pixel sprite drawn right now: its shown height over its natural height (S7). */
async function readSprites(page: Page, scope: string): Promise<SpriteReading[]> {
  return page.evaluate((selector) => {
    const readings: SpriteReading[] = [];
    for (const image of document.querySelectorAll<HTMLImageElement>(selector)) {
      if (image.classList.contains('ac-sprite--smooth')) continue;
      const box = image.getBoundingClientRect();
      if (box.height === 0 || image.naturalHeight === 0) continue;
      readings.push({
        src: image.getAttribute('src') ?? '',
        ratio: box.height / image.naturalHeight,
        rendering: getComputedStyle(image).imageRendering,
        inMenu: image.closest('.ac-sidebar') !== null,
      });
    }
    return readings;
  }, scope);
}

test.describe('sprites (S7, C7-05)', () => {
  test('every pixel sprite is an integer scale, pixelated and loaded', async ({ page }) => {
    const triggers = await openFrame(page);

    // 0 broken images: every sprite of the page, the ones inside closed panels included,
    // has to decode. A lazy one is asked for first, so the check does not depend on the
    // scroll position.
    const broken = await page.evaluate(async () => {
      const images = Array.from(
        document.querySelectorAll<HTMLImageElement>('img.ac-sprite'),
      ).filter((image) => !image.classList.contains('ac-sprite--smooth'));
      for (const image of images) image.loading = 'eager';
      const results = await Promise.all(
        images.map((image) =>
          image.decode().then(
            () => null,
            () => image.getAttribute('src') ?? '(sin src)',
          ),
        ),
      );
      return results.filter((result): result is string => result !== null);
    });
    expect(broken, 'S7: 0 broken sprites').toEqual([]);

    const readings = await readSprites(page, 'img.ac-sprite');
    // Every panel draws its head at 2x, so each one is opened and read in turn.
    for (const trigger of triggers.slice(0, PLACEMENT_SAMPLE)) {
      if (!(await trigger.isVisible())) continue;
      await trigger.hover();
      await expect(page.locator(OPEN)).toHaveCount(1);
      // The 150 ms entry scales the panel from 0.95 (§6.2): the size is read once it ends.
      // Only animations that end — an animated sprite in the head loops for ever.
      await page.locator(OPEN).evaluate((panel) =>
        Promise.all(
          panel
            .getAnimations({ subtree: true })
            .filter((animation) => animation.effect?.getComputedTiming().endTime !== Infinity)
            .map((animation) => animation.finished),
        ),
      );
      readings.push(...(await readSprites(page, `${OPEN} img.ac-sprite`)));
      await page.keyboard.press('Escape');
      await expect(page.locator(OPEN)).toHaveCount(0);
    }

    expect(readings.length, 'the parity page draws pixel sprites').toBeGreaterThan(0);
    // §2 S7: 1, 2 or 3 times the natural height; the one exception is the Diamond of
    // the menu, at half (R11).
    const offScale = readings
      .filter((reading) => {
        const allowed = reading.inMenu ? [0.5, 1, 2, 3] : [1, 2, 3];
        return !allowed.some((scale) => Math.abs(reading.ratio - scale) < 0.01);
      })
      .map((reading) => `${reading.src} × ${reading.ratio.toFixed(3)}`);
    expect(offScale, 'S7: shown height / natural height ∈ {1, 2, 3}').toEqual([]);
    expect(
      readings.filter((reading) => reading.rendering !== 'pixelated').map((reading) => reading.src),
      '§7.4.2: a pixel sprite is drawn with image-rendering: pixelated',
    ).toEqual([]);
  });

  test('the game layer draws no SVG but the utility glyphs (S7, C-R7)', async ({ page }) => {
    await openFrame(page);
    const strays = await page.evaluate(() =>
      Array.from(
        document.querySelectorAll(
          ':is([data-ac-tt], [role="tooltip"], .ac-entity-slot, .ac-element-chip, .ac-plus-n) svg',
        ),
      )
        .filter((svg) => !svg.classList.contains('lucide'))
        .map((svg) => svg.outerHTML.slice(0, 80)),
    );
    expect(strays, 'C-R7: every SVG of the game layer is a Glyph').toEqual([]);
  });
});

test.describe('touch (C7-06, TT5)', () => {
  test.skip(({ hasTouch }) => !hasTouch, 'TT5 needs the emulated touch of the mobile project');

  test('the first tap opens and a tap outside closes (TT5, TT6)', async ({ page }) => {
    const [trigger] = await openFrame(page);
    const before = page.url();

    await trigger.tap();
    await expect(page.locator(OPEN), 'TT5: the first tap opens the panel').toHaveCount(1);
    expect(page.url(), 'TT5: the first tap does not follow the link').toBe(before);

    await page.touchscreen.tap(4, 4);
    await expect(page.locator(OPEN), 'TT6: a tap outside closes it').toHaveCount(0);
  });

  test('the second tap follows the link of an <a> trigger (TT5)', async ({ page }) => {
    await openFrame(page);
    const link = page.locator('[data-ac-tt] a[aria-describedby][href]').first();
    expect(
      await link.count(),
      `${FRAME_ROUTE} carries at least one <a href> trigger (M4, track A)`,
    ).toBeGreaterThan(0);
    const href = await link.getAttribute('href');
    const target = new URL(href as string, page.url()).toString();

    await link.tap();
    await expect(page.locator(OPEN)).toHaveCount(1);
    await link.tap();
    await expect(page, 'TT5: the second tap on an <a> navigates').toHaveURL(target);
  });

  test('the second tap closes a <button> trigger (TT5)', async ({ page }) => {
    await openFrame(page);
    const button = page.locator('[data-ac-tt] button[aria-describedby]').first();
    expect(
      await button.count(),
      `${FRAME_ROUTE} carries at least one <button> trigger (M4, track A)`,
    ).toBeGreaterThan(0);

    await button.tap();
    await expect(page.locator(OPEN)).toHaveCount(1);
    await button.tap();
    await expect(page.locator(OPEN), 'TT5: the second tap on a <button> closes it').toHaveCount(0);
  });
});

// --------------------------------------------------------------- C7-07: where it opens

type Placement = {
  side: string | null;
  declared: string;
  panel: Box;
  /** The head zone of the card the trigger sits in, when it sits in one (`avoidHead`). */
  head: Box | null;
};

async function openAndMeasure(page: Page, trigger: Locator): Promise<Placement> {
  await trigger.hover();
  const panel = page.locator(OPEN);
  await expect(panel, 'the hovered trigger opens exactly one panel').toHaveCount(1);

  const declared = await trigger.evaluate((element) => {
    const wrapper = element.closest('[data-ac-tt]');
    return wrapper?.getAttribute('data-ac-tt-placement') ?? '';
  });
  const head = await trigger.evaluate((element) => {
    const card = element.closest('article[data-anat]');
    const zone = card?.querySelector('[data-zone="head"]');
    if (!zone) return null;
    const rect = zone.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });

  return {
    side: await panel.getAttribute('data-side'),
    declared: declared === '' ? DEFAULT_PLACEMENT : declared,
    panel: await boxOf(panel, 'the open panel'),
    head,
  };
}

function overlaps(a: Box, b: Box): boolean {
  return (
    a.x < b.x + b.width - TOLERANCE &&
    b.x < a.x + a.width - TOLERANCE &&
    a.y < b.y + b.height - TOLERANCE &&
    b.y < a.y + a.height - TOLERANCE
  );
}

test.describe('the panel opens where §7.5.5 says (C7-07, S3)', () => {
  for (const route of testRoutes) {
    test(`${route.path} places its panels`, async ({ page }) => {
      await goTo(page, route.path, route.status);
      const viewport = page.viewportSize();
      expect(viewport, 'the projects of §14.3 all fix a viewport').not.toBeNull();
      const { width, height } = viewport as { width: number; height: number };
      const padding = edgePadding(page);

      const triggers = (await page.locator(TRIGGER).all()).slice(0, PLACEMENT_SAMPLE);

      for (const trigger of triggers) {
        if (!(await trigger.isVisible())) continue;
        const what = `${route.path} · ${await nameOf(trigger)}`;
        // The placement a reader meets: the trigger in the middle of the window, where
        // `flip` and `avoidHead` both have room. A hover leaves it wherever the scroll
        // happens to put it, down to the last pixel of the window, where §7.5.5 lets
        // `shift` and the 120 px floor decide and no side is left for `avoidHead` to pick
        // (the panel then stays in the window above: keyboard.spec.ts reaches that edge).
        // `instant`: without reduced motion the document scrolls smoothly (6.4), and the
        // hover would then find the trigger still out of view and scroll it back to the edge.
        await trigger.evaluate((element) =>
          element.scrollIntoView({ block: 'center', behavior: 'instant' }),
        );
        const { side, declared, panel, head } = await openAndMeasure(page, trigger);
        const allowed = SIDES[declared] ?? [];

        expect
          .soft(allowed, `${what}: «${declared}» is a placement of the §7.5.5 table`)
          .not.toEqual([]);
        expect
          .soft(allowed, `${what}: a «${declared}» panel never ends on «${side}»`)
          .toContain(side ?? '');

        expect
          .soft(panel.x, `${what}: the left edge stays ${padding} px inside the window`)
          .toBeGreaterThanOrEqual(padding - TOLERANCE);
        expect
          .soft(panel.x + panel.width, `${what}: the right edge stays inside`)
          .toBeLessThanOrEqual(width - padding + TOLERANCE);
        expect
          .soft(panel.y, `${what}: the top edge stays inside`)
          .toBeGreaterThanOrEqual(padding - TOLERANCE);
        expect
          .soft(panel.y + panel.height, `${what}: the bottom edge stays inside`)
          .toBeLessThanOrEqual(height - padding + TOLERANCE);

        if (head !== null) {
          expect
            .soft(
              overlaps(panel, head),
              `${what}: «avoidHead» — the panel never covers [data-zone="head"] of its card`,
            )
            .toBe(false);
        }

        await page.keyboard.press('Escape');
        await expect(page.locator(OPEN)).toHaveCount(0);
      }
    });
  }
});
