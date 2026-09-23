// §14.3 link gate (G12, PZ-04). Over the Vercel output, every `a[href^="/"]` of
// the routes of §14.4 and of the whole menu answers 200, or 302 towards a route
// that answers 200. No link points at a retired route — `/mapa/aportar/` (A1) and
// `/rotaciones/` (E1) — although its 302 would still land somewhere, and no group
// of the menu is left without a real destination.
//
// It also counts the two zero-rules of WG5 — «0 `href="#"`, 0 `href=""`» — which the
// §14.3 row leaves implicit because it names `a[href^="/"]` and that filter drops
// them. WG5 is the acceptance criterion of every page of §8 and no other spec of
// §14.3 reads an href, so they are measured here.
//
// Runs in the `prod` project: only the emulator of §14.3 knows the redirections of
// `.vercel/output/config.json`, so «302 towards a route that answers 200» is the
// deployed table and not a copy of it. On the development server those routes do
// not exist and every 302 of §8.0.1 would read as a broken link.
//
// Contract with tests/e2e/routes.ts (track C of M2): `outputRoutes` is the §14.4
// list trimmed by scripts/lib/rutas-migradas.mjs and by the `/_paridad/` routes,
// which only the development server serves (§14.5), each entry carries `path`,
// `locale` and `status`. The two per-page setups §14.3 asks every project for —
// the remote-art stub and the fixed clock — arrive with `test`, which comes from
// tests/e2e/fixtures.ts.
//
// Scope. The gate walks `outputRoutes`, every route of §14.4 in the output.

import type { APIRequestContext } from '@playwright/test';

import { idiomas } from '../../scripts/lib/rutas-migradas.mjs';
import { expect, test } from './fixtures';
import { outputRoutes, RETIRED_ROUTES } from './routes';

/**
 * G12: the retired routes of §8.0.1 and §13.1 (tests/e2e/routes.ts). A link to one of them
 * fails although its 302 would still land on a page that answers 200.
 */
const RETIRED = RETIRED_ROUTES;

/** §8.0.1: the redirections of the site are temporary, so 302 and nothing else. */
const REDIRECT_STATUS = 302;

/**
 * What a link may answer. 404 is not on the list even for a route §14.4 visits as a
 * 404: G12 is about what the site links to, and it never links to its own 404.
 */
const OK = 200;

/**
 * The status each href ends on, shared by every test of the worker. A menu link
 * repeats on every page of the site, so without this each route would re-request
 * the same forty destinations.
 */
const resolved = new Map<string, Promise<string>>();

/** Follows at most one redirection (RZ3) and describes where the link ends. */
async function endOf(request: APIRequestContext, href: string): Promise<string> {
  const first = await request.get(href, { maxRedirects: 0 });
  if (first.status() === OK) return `${OK}`;
  if (first.status() !== REDIRECT_STATUS) return `${first.status()}`;

  const target = first.headers()['location'];
  if (target === undefined) return `${REDIRECT_STATUS} without Location`;

  const second = await request.get(target, { maxRedirects: 0 });
  return second.status() === OK
    ? `${OK}`
    : `${REDIRECT_STATUS} to ${target}, which answers ${second.status()}`;
}

function resolve(request: APIRequestContext, href: string): Promise<string> {
  const cached = resolved.get(href);
  if (cached !== undefined) return cached;
  const pending = endOf(request, href);
  resolved.set(href, pending);
  return pending;
}

/**
 * §14.3, `prod` row: the project runs «Desktop Chrome **y** 390 × 844». A Playwright
 * project carries one viewport, so the second width lives in the specs whose result
 * depends on it, the way tests/e2e/perf.spec.ts already does it. This is one of them: at
 * 390 the whole menu lives in the sheet of §5.8 and not in the sidebar, so the links G12
 * and PZ-04 walk are not the same set.
 */
const VENTANAS = [
  { nombre: '1440 × 900', viewport: { width: 1440, height: 900 } },
  { nombre: '390 × 844', viewport: { width: 390, height: 844 } },
];

for (const ventana of VENTANAS) {
  test.describe(`a ${ventana.nombre}`, () => {
    test.use({ viewport: ventana.viewport });

    for (const route of outputRoutes) {
      test(`every internal link answers on ${route.path}`, async ({ page, request }) => {
        const response = await page.goto(route.path);
        expect(response?.status(), `${route.path} answers ${route.status}`).toBe(route.status);

        // The whole menu: the collapsible groups of `Sidebar` are `<details>` (§3.8), so
        // their links are already in the DOM closed. Opening them covers a group that a
        // later milestone builds with a button and `hidden` instead.
        await page.evaluate(() => {
          for (const group of document.querySelectorAll('details')) group.open = true;
        });

        const { hrefs, nowhere } = await page.evaluate(() => {
          const anchors = [...document.querySelectorAll('a[href]')];
          const hrefOf = (anchor: Element): string => anchor.getAttribute('href') ?? '';
          return {
            // Site-relative only: `//host/…` is another origin and `#`, `mailto:` and
            // `https://` are not this site's routing.
            hrefs: anchors
              .map(hrefOf)
              .filter((href) => href.startsWith('/') && !href.startsWith('//')),
            // WG5 counts these separately, because the filter above drops them: an empty
            // href and a bare `#` are links that go nowhere, not links to another origin.
            // `#contenido` of the skip link is a real destination and is not one of them.
            nowhere: anchors
              .filter((anchor) => {
                const href = hrefOf(anchor).trim();
                return href === '' || href === '#';
              })
              .map(
                (anchor) =>
                  (anchor.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40) ||
                  anchor.outerHTML.slice(0, 80),
              ),
          };
        });

        // WG5, S11: «0 `href="#"`, 0 `href=""`». A link that goes nowhere is a fake
        // control, and §8 asks this of every page (§8.0.2, «Nunca `href="#"`»).
        expect(nowhere, 'WG5: no link with an empty href or a bare #').toEqual([]);

        expect(
          hrefs.filter((href) => RETIRED.some(({ pattern }) => pattern.test(href))),
          'G12, PZ-04, A1, E1: no link points at a retired route',
        ).toEqual([]);

        // The anchor of §7.7.3, H7 travels with the route; what G12 checks is the page.
        const destinations = [...new Set(hrefs.map((href) => href.split('#')[0]))].filter(
          (href) => href !== '',
        );

        const broken: string[] = [];
        for (const href of destinations) {
          const end = await resolve(request, href);
          if (end !== `${OK}`) broken.push(`${href} → ${end}`);
        }

        expect(broken, 'G12: every link answers 200, or 302 towards a route that does').toEqual([]);
      });

      test(`no menu group is left without a destination on ${route.path}`, async ({ page }) => {
        await page.goto(route.path);

        // G12, PZ-04: «Un grupo sin rutas no se muestra». A group of the menu is a
        // `<details>` of a `<nav>` (§3.8, 7.10.2); if it is on the page it paints at
        // least one real link.
        const empty = await page.evaluate(() =>
          [...document.querySelectorAll('nav details')]
            .filter((group) => group.querySelector('a[href]') === null)
            .map((group) => (group.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40)),
        );

        expect(empty, 'PZ-04: a group with no routes is not shown').toEqual([]);
      });
    }
  });
}

// G12 and §8.0.1: a retired route is not a dead end either. The old route answers 302
// towards the page that took it over, with and without the trailing slash, so a
// bookmark or a link from outside the site still lands on a page that answers 200.
for (const { from, to } of RETIRED) {
  test.describe(`the retired ${from}`, () => {
    for (const locale of idiomas) {
      const source = from.replaceAll('{l}', locale);
      const target = to.replaceAll('{l}', locale);

      test(`${source} answers 302 to ${target}, which answers 200`, async ({ request }) => {
        for (const path of [source, source.replace(/\/$/, '')]) {
          const response = await request.get(path, { maxRedirects: 0 });
          expect(response.status(), `${path} answers a 302`).toBe(REDIRECT_STATUS);
          expect(response.headers()['location'], `${path} goes to ${target}`).toBe(target);
        }
        const landing = await request.get(target, { maxRedirects: 0 });
        expect(landing.status(), `${target} answers 200`).toBe(OK);
      });
    }
  });
}
