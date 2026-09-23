// §14.3 content sentinel (S10, §12.19, §12.22). Reads the visible text, `alt`, `title`,
// `aria-label`, `placeholder`, `<title>` and `meta[name=description]` of every route of
// §14.4 and fails on the forbidden list of §12.22, in the default state and in the
// states a11y.spec.ts opens.
//
// Comparison rules of §12.22: substring and case-insensitive, except the entries this
// file marks `caseSensitive`; the entries marked `whole` are compared as a complete text
// node or attribute value, because they are words that also appear inside game names;
// and on `es` pages everything inside `[lang="en"]` is out of the «Solo es» list.
//
// The routes come from tests/e2e/routes.ts, so the sentinel grew with the migration. From M12 on
// it read every route of §14.4 but the Guild page, which still rendered with AppLayout; M13
// rewrote it, so from M13 on it reads all of them — every route of §8 in both locales, the six
// Pokémon pages of the sample, the 404 of each locale, the two Comercio pages of a production
// build, the list and the publish form, which the development server of §14.3 fills with the
// sample registry, and Guild — plus the results page of Buscar with a query (`queryRoutes`).
//
// Contract with tests/e2e/routes.ts (track C of M2): `testRoutes` is the §14.4 list and
// every entry carries `path` (site relative, with leading and trailing slash) and
// `locale` ('es' | 'en').

import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { queryRoutes, testRoutes } from './routes';
import { forEachDialog, STATES } from './states';

type Sentinel = { label: string; pattern: RegExp };

type Harvested = { value: string; source: string; inEnglish: boolean };

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** A string of §12.22 as a pattern: substring and case-insensitive unless said. */
function literal(
  value: string,
  options: { whole?: boolean; caseSensitive?: boolean } = {},
): Sentinel {
  const escaped = escapeRegExp(value);
  const body = options.whole === true ? `^${escaped}$` : escaped;
  return { label: value, pattern: new RegExp(body, options.caseSensitive === true ? '' : 'i') };
}

/** §12.22, «Ambos idiomas». */
const BOTH: Sentinel[] = [
  literal('Wiki Core'),
  literal('Supabase'),
  literal('Temporal', { caseSensitive: true }),
  literal('America/Sao_Paulo'),
  literal('America/Mexico_City'),
  literal('flagId'),
  literal('OTMM'),
  literal('Minimap.flags'),
  literal('availability_scope'),
  literal('training_charger'),
  literal('pending_review'),
  literal('exportedAt'),
  literal('manual-paste'),
  literal('Family One'),
  literal('Membro'),
  literal('Vice-Líder'),
  literal('roster'),
  literal('snapshot OTMM'),
  literal('Provenance'),
  literal('Procedencia'),
  literal('Fuente:'),
  literal('Fuentes'),
  literal('Source:'),
  literal('Sources'),
  literal('Verificado el'),
  literal('Verified on'),
  literal('Dato confirmado'),
  literal('Según la hoja'),
  literal('evidencia'),
  literal('evidence'),
  literal('Próximamente'),
  literal('Coming soon'),
  literal('hoja de ruta'),
  literal('roadmap'),
  literal('Preview disponible'),
  literal('Disponible en local'),
  literal('Borrador local'),
  literal('Local draft'),
  literal('Ctrl K'),
  literal('Lorem'),
  literal('undefined'),
  literal('NaN'),
  literal('[object Object]'),
  literal('Invalid Date'),
  { label: '\\bKKs?\\b', pattern: /\bKKs?\b/ },
  { label: '\\bgold\\b', pattern: /\bgold\b/ },
  { label: '\\bTODO\\b', pattern: /\bTODO\b/ },
  {
    label: '\\bT(Legendary|Mythic|ULTIMATE|Super Rare|Ultra Rare)\\b',
    pattern: /\bT(Legendary|Mythic|ULTIMATE|Super Rare|Ultra Rare)\b/,
  },
  { label: '[↗✦]', pattern: /[↗✦]/ },
  { label: '\\b\\d+\\s?px\\b', pattern: /\b\d+\s?px\b/ },
];

/** §12.22, «Solo es»: ignored inside `[lang="en"]`. */
const ES_ONLY: Sentinel[] = [
  literal('Datos de la ficha'),
  literal('Archivo de campo'),
  literal('registros normalizados'),
  literal('Delta calculado'),
  literal('Training skills'),
  literal('Cambiar a English'),
  literal('Outfit del juego'),
  literal('Precio NPC: aún no'),
  literal('Objetos de sistema'),
  literal('Hold Shift to pin'),
  literal('Search...'),
  literal('Open menu'),
  literal('Skip to content'),
  literal('Breadcrumb', { whole: true }),
  literal('Close', { whole: true }),
];

/** §12.22, «Solo en»: includes the Spanish defaults of the design system. */
const EN_ONLY: Sentinel[] = [
  literal('Record data'),
  literal('Local draft'),
  literal('Field archive'),
  literal('Game outfit'),
  literal('normalized records'),
  literal('Client map'),
  literal('Switch to Español'),
  literal('Mantén Shift para fijar'),
  literal('Buscar...'),
  literal('Cambiar a tema claro'),
  literal('Abrir menú'),
  literal('Cerrar menú'),
  literal('Saltar al contenido'),
  literal('Migas de pan'),
  literal('Paginación', { whole: true }),
  literal('Idioma:'),
  literal('Vista', { whole: true }),
  literal('Lista', { whole: true }),
  literal('Resumen', { whole: true }),
  literal('Cerrar aviso'),
  literal('es un proyecto comunitario'),
];

/** §12.22 and §9.9: only on the `es` routes of Comercio and of the account. */
const TRADE_ES_ONLY: Sentinel[] = [
  { label: 'confiable', pattern: /\bconfiable\b/i },
  { label: 'seguro', pattern: /\bseguro\b/i },
  { label: 'garantizado', pattern: /\bgarantizado\b/i },
];

/** Every string §12.22 reads, with the `[lang="en"]` flag of §13.1. */
async function harvest(page: Page): Promise<Harvested[]> {
  return page.evaluate(() => {
    const entries: { value: string; source: string; inEnglish: boolean }[] = [];

    const visible = (element: Element): boolean => {
      if (typeof element.checkVisibility === 'function') {
        return element.checkVisibility({
          contentVisibilityAuto: true,
          opacityProperty: true,
          visibilityProperty: true,
        });
      }
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };

    const label = (element: Element): string => {
      const id = element.id === '' ? '' : `#${element.id}`;
      const classes = (element.getAttribute('class') ?? '').trim().split(/\s+/).filter(Boolean);
      return `${element.localName}${id}${classes.length === 0 ? '' : `.${classes[0]}`}`;
    };

    const push = (value: string | null, source: string, inEnglish: boolean): void => {
      const text = (value ?? '').replace(/\s+/g, ' ').trim();
      if (text !== '') entries.push({ value: text, source, inEnglish });
    };

    // §13.1: a data phrase in English inside an `es` page carries `lang="en"`.
    const isEnglish = (element: Element): boolean => element.closest('[lang="en"]') !== null;

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode() !== null) {
      const parent = walker.currentNode.parentElement;
      if (parent === null) continue;
      if (parent.closest('script, style, template, noscript') !== null) continue;
      if (!visible(parent)) continue;
      push(walker.currentNode.textContent, `text · ${label(parent)}`, isEnglish(parent));
    }

    for (const element of document.querySelectorAll(
      '[alt], [title], [aria-label], [placeholder]',
    )) {
      for (const attribute of ['alt', 'title', 'aria-label', 'placeholder']) {
        if (!element.hasAttribute(attribute)) continue;
        push(
          element.getAttribute(attribute),
          `${attribute} · ${label(element)}`,
          isEnglish(element),
        );
      }
    }

    push(document.title, '<title>', false);
    push(
      document.querySelector('meta[name="description"]')?.getAttribute('content') ?? '',
      'meta description',
      false,
    );

    return entries;
  });
}

function failures(entries: Harvested[], sentinels: Sentinel[], skipEnglish: boolean): string[] {
  const found: string[] = [];
  for (const entry of entries) {
    if (skipEnglish && entry.inEnglish) continue;
    for (const sentinel of sentinels) {
      if (sentinel.pattern.test(entry.value)) {
        found.push(`«${sentinel.label}» · ${entry.source} · «${entry.value}»`);
      }
    }
  }
  return found;
}

async function expectClean(
  page: Page,
  route: { path: string; locale: string },
  state: string,
): Promise<void> {
  const entries = await harvest(page);
  const isTrade = route.path.includes('/comercio/') || route.path.includes('/cuenta/');

  expect.soft(failures(entries, BOTH, false), `§12.22 (both locales) · ${state}`).toEqual([]);

  if (route.locale === 'es') {
    expect.soft(failures(entries, ES_ONLY, true), `§12.22 (es) · ${state}`).toEqual([]);
    if (isTrade) {
      expect.soft(failures(entries, TRADE_ES_ONLY, true), `§9.9 · ${state}`).toEqual([]);
    }
  } else {
    expect.soft(failures(entries, EN_ONLY, false), `§12.22 (en) · ${state}`).toEqual([]);
  }
}

// The routes of §14.4 and the results page of Buscar with a query (M10, `queryRoutes`).
for (const route of [...testRoutes, ...queryRoutes]) {
  test(`no forbidden content on ${route.path}`, async ({ page }) => {
    await page.goto(route.path);
    if (route.ready) await page.locator(route.ready).waitFor();
    await expectClean(page, route, 'default state');

    for (const state of STATES) {
      if (!(await state.open(page))) continue;
      await expectClean(page, route, state.name);
      await state.close(page);
    }

    await forEachDialog(page, (label) => expectClean(page, route, label));
  });
}
