// §14.3 reduced-motion gate (S15, C7-14, V6-2). With `prefers-reduced-motion: reduce`
// nothing animates: 50 ms after opening a tooltip, a «+N» popover, the mobile sheet and
// a dialog there is no running animation, every animated sprite stays on frame 0 and
// `scroll-behavior` is `auto`.
//
// Runs in the `reduced-motion` project (§14.3). The routes come from tests/e2e/routes.ts,
// so the gate grows with the migration.
//
// Contract with tests/e2e/routes.ts (track C of M2): `testRoutes` is the §14.4 list and
// every entry carries `path` (site relative, with leading and trailing slash) and
// `locale` ('es' | 'en').

import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { testRoutes } from './routes';

/** §7.4.2: frame 0 of a horizontal strip. */
const FIRST_FRAME = '0% 0%';

/** The sheet only exists below 1280 (§7.10.1). */
const PHONE = { width: 390, height: 844 };

/** §14.3 measures 50 ms after the opening. */
async function expectStill(page: Page, state: string): Promise<void> {
  await page.waitForTimeout(50);

  const running = await page.evaluate(() =>
    document.getAnimations().map((animation) => {
      const effect = animation.effect;
      const target = effect instanceof KeyframeEffect ? effect.target : null;
      const name =
        'animationName' in animation
          ? String(animation.animationName)
          : 'transitionProperty' in animation
            ? String(animation.transitionProperty)
            : 'animation';
      return `${name} · ${target === null ? 'no element' : target.localName}`;
    }),
  );

  expect.soft(running, `no animation runs with reduced motion · ${state}`).toEqual([]);
}

for (const route of testRoutes) {
  test(`reduced motion stops every animation on ${route.path}`, async ({ page }) => {
    await page.goto(route.path);

    expect
      .soft(
        await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior),
        'scroll-behavior is auto (§6.4)',
      )
      .toBe('auto');

    const sprites = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[data-anim]'), (element) => {
        const style = getComputedStyle(element);
        return {
          name: element.getAttribute('data-anim') ?? '',
          animation: style.animationName,
          position: style.objectPosition,
        };
      }),
    );

    expect
      .soft(
        sprites.filter((sprite) => sprite.animation !== 'none').map((sprite) => sprite.name),
        'an animated sprite computes animation-name: none (§6.3)',
      )
      .toEqual([]);
    expect
      .soft(
        sprites
          .filter((sprite) => sprite.position !== FIRST_FRAME)
          .map((sprite) => `${sprite.name} · ${sprite.position}`),
        `an animated sprite stays on frame 0 (${FIRST_FRAME})`,
      )
      .toEqual([]);

    await expectStill(page, 'default state');

    const tooltipTrigger = page.locator('[data-ac-tt] a, [data-ac-tt] button').first();
    if ((await tooltipTrigger.count()) > 0) {
      await tooltipTrigger.hover();
      await expect(page.locator('[role="tooltip"][data-open]').first()).toBeVisible();
      await expectStill(page, 'tooltip open');
      await page.keyboard.press('Escape');
      await expect(page.locator('[role="tooltip"][data-open]')).toHaveCount(0);
    }

    const plusN = page.locator('[data-ac-plusn]:visible').first();
    if ((await plusN.count()) > 0) {
      await plusN.click();
      await expect(plusN).toHaveAttribute('aria-expanded', 'true');
      await expectStill(page, '«+N» popover open');
      await page.keyboard.press('Escape');
    }

    const dialogTrigger = page.locator('button[aria-haspopup="dialog"]:visible').first();
    if ((await dialogTrigger.count()) > 0) {
      await dialogTrigger.click();
      await expect(page.locator('dialog[open]').first()).toBeVisible();
      await expectStill(page, 'dialog open');
      await page.keyboard.press('Escape');
      await expect(page.locator('dialog[open]')).toHaveCount(0);
    }

    const desktop = page.viewportSize() ?? PHONE;
    await page.setViewportSize(PHONE);
    const menuTrigger = page.locator('[aria-controls="menu-movil"]').first();
    if ((await menuTrigger.count()) > 0 && (await menuTrigger.isVisible())) {
      await menuTrigger.click();
      await expect(page.locator('dialog#menu-movil')).toBeVisible();
      await expectStill(page, 'mobile sheet open');
      await page.keyboard.press('Escape');
      await expect(page.locator('dialog#menu-movil')).toBeHidden();
    }
    await page.setViewportSize(desktop);
  });
}
