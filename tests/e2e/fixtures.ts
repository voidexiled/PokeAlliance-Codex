// The two per-page setups §14.3 asks of every project, applied once for every spec.
//
// Playwright 1.63 has no configuration option for either — `PlaywrightTestOptions`
// carries no clock and no route handler — so playwright.config.ts cannot declare them
// and a fixture only reaches a spec through the module that spec imports `test` from.
// This is that module: a spec imports `test` and `expect` from here instead of from
// `@playwright/test` and gets the remote-art stub and the fixed clock with no
// `beforeEach` of its own.
//
// It overrides the `page` fixture rather than declaring an automatic one, so a test that
// only asks for `request` (seo.spec.ts, the link walk of links.spec.ts) never opens a
// browser page just to set up a page it does not use.
//
// Exceptions, both deliberate:
//
// - `seo.spec.ts` reads the output through `request` alone and stays on `@playwright/test`.
// - `perf.spec.ts` installs the stub itself, because it also has to install its
//   instrumentation through `addInitScript` before the first navigation and measures a
//   page it builds by hand (§13.6).

import { test as base, expect } from '@playwright/test';

import { freezeClock, stubRemoteArt } from './routes';

export const test = base.extend({
  page: async ({ page }, use) => {
    // §14.3: the art of wiki.pokealliance.com never leaves this machine.
    await stubRemoteArt(page);
    // §14.3: every spec that reads a date reads the same instant, so a Server Save line,
    // a Guild cut or an ad age is the same at any hour of any day.
    await freezeClock(page);
    await use(page);
  },
});

export { expect };
