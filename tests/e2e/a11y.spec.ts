// §14.3 accessibility gate (S12, S13, S14). Runs axe-core over every route of §14.4 in
// the default state and in each state the spec repeats: a tooltip open, the mobile sheet
// open, the language list open, every Guild or Comercio dialog open and every disclosure
// expanded. A violation of impact `serious` or `critical` fails; the only admitted
// exceptions are the contrast pairs §13.7 documents.
//
// The routes come from tests/e2e/routes.ts, so the gate grows with the migration: while
// scripts/lib/rutas-migradas.mjs is empty the list is empty and no new gate measures a
// legacy page (§3.11).
//
// Contract with tests/e2e/routes.ts (track C of M2): `testRoutes` is the §14.4 list and
// every entry carries `path` (site relative, with leading and trailing slash) and
// `locale` ('es' | 'en').

import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { queryRoutes, testRoutes } from './routes';
import { forEachDialog, STATES } from './states';

type AxeResults = Awaited<ReturnType<AxeBuilder['analyze']>>;
type AxeViolation = AxeResults['violations'][number];
type AxeNode = AxeViolation['nodes'][number];

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/** Impacts that fail the gate (§14.3). */
const BLOCKING_IMPACTS = new Set(['serious', 'critical']);

const CONTRAST_RULES = new Set(['color-contrast', 'color-contrast-enhanced']);

/**
 * The four pairs §13.7 keeps below the minimum, as selectors. Only a contrast node
 * inside one of them is forgiven, and only with the reason §13.7 gives it.
 *
 * Two of the four pairs have no selector because axe never reports them: `ring` over
 * bg-secondary, bg-tertiary and tt-panel is the focus ring (WCAG 1.4.11, which axe does
 * not evaluate) and `border-primary` as a control border is a non-text border of the
 * same rule.
 */
const CONTRAST_EXCEPTIONS = [
  {
    selector: '.ac-search-trigger',
    reason: 'text-quaternary over bg-tertiary (4.26:1), the search trigger on hover (§13.7)',
  },
  {
    selector: '.ac-bar-chart__bar--partial',
    reason: 'the running day at opacity-partial (2.08:1); the axis reads «en curso» (§13.7)',
  },
];

/** The selector axe reports for a node, without the frame chain it never uses here. */
function nodeSelector(node: AxeNode): string {
  const target = node.target[node.target.length - 1];
  return Array.isArray(target) ? target[target.length - 1] : String(target);
}

/** True when the node is inside one of the pairs §13.7 documents. */
async function isDocumentedException(page: Page, violation: AxeViolation, node: AxeNode) {
  if (!CONTRAST_RULES.has(violation.id)) return false;
  const selector = nodeSelector(node);
  return page.evaluate(
    ({ selector: target, exceptions }) => {
      const element = document.querySelector(target);
      return element !== null && exceptions.some((pair) => element.closest(pair) !== null);
    },
    { selector, exceptions: CONTRAST_EXCEPTIONS.map((pair) => pair.selector) },
  );
}

async function expectAxeClean(page: Page, state: string): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  const blocking: string[] = [];

  for (const violation of results.violations) {
    for (const node of violation.nodes) {
      const impact = node.impact ?? violation.impact ?? '';
      if (!BLOCKING_IMPACTS.has(impact)) continue;
      if (await isDocumentedException(page, violation, node)) continue;
      blocking.push(`${violation.id} (${impact}) · ${nodeSelector(node)} · ${violation.help}`);
    }
  }

  expect.soft(blocking, `axe ${WCAG_TAGS.join(' ')} · ${state}`).toEqual([]);
}

// The routes of §14.4 and the results page of Buscar with a query (M10, `queryRoutes`).
for (const route of [...testRoutes, ...queryRoutes]) {
  test(`axe reports no serious or critical violation on ${route.path}`, async ({ page }) => {
    await page.goto(route.path);
    if (route.ready) await page.locator(route.ready).waitFor();
    await expectAxeClean(page, 'default state');

    for (const state of STATES) {
      if (!(await state.open(page))) continue;
      await expectAxeClean(page, state.name);
      await state.close(page);
    }

    await forEachDialog(page, (label) => expectAxeClean(page, label));
  });
}
