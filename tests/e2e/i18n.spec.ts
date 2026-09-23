// §14.3 i18n gate (§13.1). `<html lang>` of every route of §14.4, the `lang` marking of
// the English data phrases inside an `es` page (WCAG 3.1.2) and the language switcher,
// which keeps route, query and anchor.
//
// The routes come from tests/e2e/routes.ts, so the gate grows with the migration.
//
// Contract with tests/e2e/routes.ts (track C of M2): `testRoutes` is the §14.4 list and
// every entry carries `path` (site relative, with leading and trailing slash) and
// `locale` ('es' | 'en').

import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { testRoutes } from './routes';

/** §13.1: the two locales, and the only values a `lang` attribute may take. */
const LOCALES = ['es', 'en'];

/**
 * Whole words that do not exist in Spanish. Two or more of them in one text node mean an
 * English phrase, and §13.1 asks for it inside `[lang="en"]`. The game terms and proper
 * names §13.4 keeps in English carry none of them, so «Close Combat» or «Never-Melt Ice»
 * never trip this.
 */
const ENGLISH_MARKERS =
  /\b(the|and|with|your|you|from|this|these|their|when|while|without|into|after|before|each|every|other|than|then|they|there|which|what|about|between|during|because|through)\b/gi;

/** `/es/pokedex/` → `/en/pokedex/`, the path part of `getAlternatePath` (§13.1). */
function alternatePath(path: string, locale: string): string {
  const segments = path.split('/').filter((segment) => segment !== '');
  if (segments.length > 0 && LOCALES.includes(segments[0])) segments[0] = locale;
  else segments.unshift(locale);
  const last = segments[segments.length - 1];
  return `/${segments.join('/')}${last.includes('.') ? '' : '/'}`;
}

/** Text nodes outside `[lang="en"]` that read as an English phrase. */
async function unmarkedEnglish(page: Page, markers: string): Promise<string[]> {
  return page.evaluate((source) => {
    const pattern = new RegExp(source, 'gi');
    const found: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);

    while (walker.nextNode() !== null) {
      const parent = walker.currentNode.parentElement;
      if (parent === null) continue;
      if (parent.closest('script, style, template, noscript, [lang="en"]') !== null) continue;
      const text = (walker.currentNode.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (text === '') continue;
      const words = new Set((text.match(pattern) ?? []).map((word) => word.toLowerCase()));
      if (words.size >= 2) found.push(`${parent.localName} «${text.slice(0, 60)}»`);
    }

    return found;
  }, markers);
}

for (const route of testRoutes) {
  test(`the page declares its language on ${route.path}`, async ({ page }) => {
    await page.goto(route.path);

    await expect(page.locator('html')).toHaveAttribute('lang', route.locale);

    const declared = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[lang]'), (element) => element.getAttribute('lang')),
    );
    expect
      .soft(
        declared.filter((value) => value === null || !['es', 'en'].includes(value)),
        'every lang attribute is es or en (§13.1)',
      )
      .toEqual([]);

    if (route.locale !== 'es') return;
    expect
      .soft(
        await unmarkedEnglish(page, ENGLISH_MARKERS.source),
        'an English data phrase inside an es page carries lang="en" (WCAG 3.1.2)',
      )
      .toEqual([]);
  });

  test(`the language switcher keeps route, query and anchor on ${route.path}`, async ({ page }) => {
    const query = '?variante=shiny#drops';
    await page.goto(`${route.path}${query}`);

    const trigger = page.locator('button[popovertarget^="idioma"]').first();
    test.skip((await trigger.count()) === 0, 'This route has no LanguageMenu yet.');

    const listId = await trigger.getAttribute('popovertarget');
    await trigger.click();
    const list = page.locator(`#${listId}`);
    await expect(list).toBeVisible();

    // §13.1: «English» carries lang="en" and «Español», lang="es".
    await expect(list.locator('a[lang="en"]')).toContainText('English');
    await expect(list.locator('a[lang="es"]')).toContainText('Español');

    const other = route.locale === 'es' ? 'en' : 'es';
    const link = list.locator(`a[lang="${other}"]`);
    await expect(link).toHaveAttribute('hreflang', other);
    await link.click();

    // A 404 probe (§8.12) is a page in no language: its switcher goes to the Inicio of the
    // other locale, the one route there that answers 200 (WG5), and still keeps the query
    // and the anchor.
    const target = route.status === 404 ? `/${other}/` : alternatePath(route.path, other);
    await expect(page).toHaveURL(`${target}${query}`);
    await expect(page.locator('html')).toHaveAttribute('lang', other);
  });
}
