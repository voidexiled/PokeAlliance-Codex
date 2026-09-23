// The page states §14.3 asks the accessibility gate and the content sentinel to scan,
// besides the default one: every disclosure expanded, a tooltip open and pinned, a «+N»
// popover open, a select open (the list of S12), the language list open, the mobile sheet
// open, and each dialog open in turn.
//
// One list, two consumers. a11y.spec.ts and content-sentinel.spec.ts scan the same
// states with different assertions, so the states live here and each spec passes what it
// does with them. A state that only one of the two knew about would mean the sentinel
// and axe disagree on what the page is.
//
// `open` returns false when the route has no such trigger — most routes have no tooltip
// and the sheet only exists below 768 px — and the caller skips the state instead of
// failing. The selectors are the ones the spec fixes: `[data-ac-tt]` triggers with a
// sibling `[role="tooltip"][data-open]` (§7.5), `button[data-ac-plusn]` with the list it
// controls (§7.5.8), the `role="combobox"` trigger of a `[data-ac-select]` with its listbox
// (§7.2.2), `button[popovertarget^="idioma"]` (§5.3), `dialog#menu-movil` with its
// `[aria-controls]` trigger (§5.6) and, for the dialogs, `button[aria-haspopup="dialog"]` —
// which M12 and M13 have to keep on their triggers or their dialogs go unscanned.

import { expect, type Locator, type Page } from '@playwright/test';

export type PageState = {
  /** Shown in the failure message, so a report says which state broke. */
  name: string;
  /** Opens the state; false when this route has no such trigger. */
  open: (page: Page) => Promise<boolean>;
  close: (page: Page) => Promise<void>;
};

/**
 * Waits for the entry of an open panel to end (150 ms, §6.2). A scan taken during the fade
 * reads the text at partial opacity — the gold label as #71623a — and reports a contrast
 * the settled panel does not have. Under reduced motion there is no animation to wait for.
 */
async function settleAnimations(panel: Locator): Promise<void> {
  // Only animations that end: an animated sprite in the head loops for ever.
  await panel.evaluate((element) =>
    Promise.all(
      element
        .getAnimations({ subtree: true })
        .filter((animation) => animation.effect?.getComputedTiming().endTime !== Infinity)
        .map((animation) => animation.finished),
    ),
  );
}

/** The states of §14.3, in the order they are applied. Disclosures stay expanded. */
export const STATES: PageState[] = [
  {
    name: 'disclosures expanded',
    open: async (page) =>
      page.evaluate(() => {
        const closed = Array.from(
          document.querySelectorAll<HTMLDetailsElement>('details:not([open])'),
        );
        for (const details of closed) details.open = true;
        return closed.length > 0;
      }),
    close: async () => {},
  },
  {
    name: 'tooltip open',
    open: async (page) => {
      const trigger = page.locator('[data-ac-tt] a, [data-ac-tt] button').first();
      if ((await trigger.count()) === 0) return false;
      await trigger.hover();
      const panel = page.locator('[role="tooltip"][data-open]').first();
      await expect(panel).toBeVisible();
      await settleAnimations(panel);
      return true;
    },
    close: async (page) => {
      await page.keyboard.press('Escape');
      await expect(page.locator('[role="tooltip"][data-open]')).toHaveCount(0);
    },
  },
  {
    // S12 names the pinned tooltip as a state of its own: a lone Shift pins the panel under
    // the pointer (TT8), and it has to stay on screen with the pointer somewhere else.
    name: 'tooltip pinned',
    open: async (page) => {
      const trigger = page.locator('[data-ac-tt] a, [data-ac-tt] button').first();
      if ((await trigger.count()) === 0) return false;
      // The previous state may have left the pointer on this trigger, and a pointer that
      // does not move fires no `pointerover`: it leaves first and comes back (TT7).
      await page.mouse.move(0, 0);
      await trigger.hover();
      await expect(page.locator('[role="tooltip"][data-open]').first()).toBeVisible();
      await page.keyboard.press('Shift');
      const panel = page.locator('[role="tooltip"][data-open][data-pinned]').first();
      await expect(panel).toBeVisible();
      await page.mouse.move(0, 0);
      await expect(panel).toBeVisible();
      await settleAnimations(panel);
      return true;
    },
    close: async (page) => {
      // TT7: Escape closes a pinned panel too.
      await page.keyboard.press('Escape');
      await expect(page.locator('[role="tooltip"][data-open]')).toHaveCount(0);
    },
  },
  {
    // S12 names the open «+N» popover as a state of its own: its list is a `popover="manual"`
    // of the tooltip controller (7.5.8), in the top layer and only while it is open. A press
    // opens it and keeps it open with the pointer away, which is what a reader on a phone
    // gets from a tap.
    name: 'plus-n open',
    open: async (page) => {
      const trigger = page.locator('button[data-ac-plusn]:visible').first();
      if ((await trigger.count()) === 0) return false;
      const listId = await trigger.getAttribute('aria-controls');
      if (listId === null) return false;
      await page.mouse.move(0, 0);
      await trigger.click();
      await expect(trigger).toHaveAttribute('aria-expanded', 'true');
      await page.mouse.move(0, 0);
      const list = page.locator(`[id="${listId}"]`);
      await expect(list).toBeVisible();
      await settleAnimations(list);
      return true;
    },
    close: async (page) => {
      // TT7: Escape closes every panel of the controller, the «+N» lists included.
      await page.keyboard.press('Escape');
      await expect(page.locator('button[data-ac-plusn][aria-expanded="true"]')).toHaveCount(0);
    },
  },
  {
    // S12 names the open select («select abierto») as a state of its own: the listbox is a
    // `popover="manual"` that src/scripts/select.ts shows in the top layer, so its options,
    // the check of the chosen one and the active option are only on screen while it is
    // open. The first visible, enabled trigger is opened with a press, as a reader would.
    name: 'select open',
    open: async (page) => {
      const trigger = page.locator('[data-ac-select] [role="combobox"]:visible:enabled').first();
      if ((await trigger.count()) === 0) return false;
      const listId = await trigger.getAttribute('aria-controls');
      if (listId === null) return false;
      await trigger.click();
      await expect(trigger).toHaveAttribute('aria-expanded', 'true');
      const list = page.locator(`[id="${listId}"]`);
      await expect(list).toBeVisible();
      await settleAnimations(list);
      return true;
    },
    close: async (page) => {
      // DS:Select: Escape closes the list and leaves the focus on its trigger.
      await page.keyboard.press('Escape');
      await expect(page.locator('[data-ac-select] [aria-expanded="true"]')).toHaveCount(0);
    },
  },
  {
    // Below 1280 the language selector is not in the header: §5.8 moves it into the
    // phone sheet, where the page renders a second trigger with the same shape. Picking
    // the first one in the DOM would click the hidden header button and wait for ever,
    // so the state looks for a visible trigger and, finding none, opens the sheet to
    // reach the one inside it. That is where the list lives at that width, and S12 asks
    // for it to be scanned open on every route.
    name: 'language list open',
    open: async (page) => {
      const visibleTrigger = page.locator('button[popovertarget^="idioma"]:visible');
      if ((await visibleTrigger.count()) === 0) {
        const menu = page.locator('[aria-controls="menu-movil"]:visible').first();
        if ((await menu.count()) === 0) return false;
        await menu.click();
        await expect(page.locator('dialog#menu-movil')).toBeVisible();
        if ((await visibleTrigger.count()) === 0) return false;
      }
      const trigger = visibleTrigger.first();
      const target = await trigger.getAttribute('popovertarget');
      await trigger.click();
      await expect(page.locator(`#${target}`)).toBeVisible();
      return true;
    },
    close: async (page) => {
      // The first Escape closes the list; the sheet, when this state opened one, needs
      // its own, so the next state starts from the page and not from the sheet.
      await page.keyboard.press('Escape');
      const sheet = page.locator('dialog#menu-movil[open]');
      if ((await sheet.count()) > 0) {
        await page.keyboard.press('Escape');
        await expect(page.locator('dialog#menu-movil')).toBeHidden();
      }
    },
  },
  {
    name: 'mobile menu open',
    open: async (page) => {
      const trigger = page.locator('[aria-controls="menu-movil"]').first();
      if ((await trigger.count()) === 0 || !(await trigger.isVisible())) return false;
      await trigger.click();
      await expect(page.locator('dialog#menu-movil')).toBeVisible();
      return true;
    },
    close: async (page) => {
      await page.keyboard.press('Escape');
      await expect(page.locator('dialog#menu-movil')).toBeHidden();
    },
  },
];

/**
 * Opens every dialog reachable from a button, one at a time, and runs `scan` on each with
 * a label that names the dialog. Escape has to close it, which is itself S14.
 */
export async function forEachDialog(
  page: Page,
  scan: (label: string) => Promise<void>,
): Promise<void> {
  const triggers = page.locator('button[aria-haspopup="dialog"]');
  const count = await triggers.count();

  for (let index = 0; index < count; index += 1) {
    const trigger = triggers.nth(index);
    if (!(await trigger.isVisible())) continue;
    await trigger.click();
    const dialog = page.locator('dialog[open]').first();
    await expect(dialog).toBeVisible();
    const id = (await dialog.getAttribute('id')) ?? `dialog ${index + 1}`;
    await scan(`dialog #${id} open`);
    await page.keyboard.press('Escape');
    await expect(page.locator('dialog[open]')).toHaveCount(0);
  }
}
