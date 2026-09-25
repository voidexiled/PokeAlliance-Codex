// §14.3 lists and grids gate (M6): the list controller of §7.7 (C7-10: U1–U6, H1–H7,
// V1–V8, PR1–PR5), the three views (S4), the card grids of §7.6 (S2, C7-04), the compact
// anatomy of the Pokédex card (C7-09) and the money of the cards (S8).
//
// Where it measures:
//
//  - `/es/pokedex/`, the prototype of §13.6 and the first public list: the `pokedex` list
//    of 8.0.6 over the registry the development server reads (910 variants, 12 a page),
//    with `datos.json` (PR5) and the inline script of PR4;
//  - `/es/_paridad/tarjetas/`, the Tarjetas board with the real components: the `drops`
//    list of 8.0.6 (prefix `drops`, every row on one page) is the `EntityList` on a parity
//    route that S4 asks of F1, and its grids are the ones S2 and C7-09 measure.
//
// It runs in the `desktop` project and in `mobile`, whose touch pointer changes nothing the
// controller does; the grid widths of S2 are viewport overrides of this spec, as in
// tests/e2e/frame.spec.ts, so the whole table of `DS:guias/30` is measured in one run.

import type { Locator, Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { pokedexEmptyQuery, stubRemoteArt } from './routes';

const POKEDEX = '/es/pokedex/';
const TARJETAS = '/es/_paridad/tarjetas/';

/** 7.7.1: the key of the saved view of a list, `ac:vista:<id>`. */
const SAVED = { pokedex: 'ac:vista:pokedex', drops: 'ac:vista:drops' } as const;

/** H4: the results land 16 px under the 64 px header (`scroll-padding-top`, 3.6). */
const RESULTS_TOP = 80;

/** 8.0.6: rows a page of the Pokédex. */
const PAGE_SIZE = 12;

/** The dev server compiles on demand: the first hydration of a spec may be slow. */
const READY_TIMEOUT = 30_000;

/** The root of a list: `div.ac-entity-list[data-ac-list="<id>"]` (7.7.1). */
function listRoot(page: Page, id: string): Locator {
  return page.locator(`.ac-entity-list[data-ac-list="${id}"]`);
}

/** The island of the list has hydrated and its URL state is applied (PR1, PR4). */
async function listReady(page: Page, root: Locator): Promise<void> {
  await expect(page.locator('astro-island[ssr]').filter({ has: root })).toHaveCount(0, {
    timeout: READY_TIMEOUT,
  });
  await expect(root).not.toHaveAttribute('data-ac-pending', { timeout: READY_TIMEOUT });
}

async function openList(page: Page, url: string, id: string): Promise<Locator> {
  await page.goto(url);
  const root = listRoot(page, id);
  await listReady(page, root);
  return root;
}

/** V1, V8: the containers of the views the root holds right now. */
async function mountedViews(root: Locator): Promise<string[]> {
  return root.evaluate((element) =>
    ['data-card-grid', 'data-slots', 'data-list'].filter(
      (attribute) => element.querySelector(`[${attribute}]`) !== null,
    ),
  );
}

type ViewName = 'cards' | 'slots' | 'list';

/** The names a view shows, in its order, split by the groups it draws (V5). */
async function namesIn(root: Locator, view: ViewName): Promise<string[][]> {
  return root.evaluate((element, which) => {
    const text = (node: Element | null) => (node?.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (which === 'cards') {
      return [
        [...element.querySelectorAll('[data-card-grid] article')].map((card) =>
          text(card.querySelector('.ac-card__title')),
        ),
      ];
    }
    if (which === 'slots') {
      const groups = [...element.querySelectorAll('[data-slots] .ac-slots-panel__slots')];
      const lists = groups.length > 0 ? groups : [...element.querySelectorAll('[data-slots] ul')];
      return lists.map((list) =>
        [...list.querySelectorAll('.ac-entity-slot')].map(
          (slot) => slot.getAttribute('aria-label') ?? '',
        ),
      );
    }
    return [
      [...element.querySelectorAll('[data-list] tbody tr')].map((row) =>
        // The trigger of the name, not its panel, which lives beside it in the cell.
        text(
          row.querySelector(
            '.ac-list-row__name-in .ac-nested-entity__trigger, .ac-list-row__link',
          ) ?? row.querySelector('.ac-list-row__name-in'),
        ),
      ),
    ];
  }, view);
}

/** The buttons of `ViewToggle`, by their dictionary labels (`ui.views`, es). */
function viewButton(root: Locator, view: ViewName): Locator {
  const label = { cards: 'Cards', slots: 'Slots', list: 'Lista' }[view];
  return root.locator('.ac-view-toggle').getByRole('button', { name: label, exact: true });
}

async function chooseView(root: Locator, view: ViewName): Promise<void> {
  await viewButton(root, view).click();
  await expect(viewButton(root, view)).toHaveAttribute('aria-pressed', 'true');
  const attribute = { cards: 'data-card-grid', slots: 'data-slots', list: 'data-list' }[view];
  await expect(root.locator(`[${attribute}]`)).toHaveCount(1);
}

/**
 * S4, V5: the three views show the same set, and two items of one group keep their order
 * in every view. A view that groups (Slots of the Pokédex) orders inside each group; one
 * that does not follows the order of the list.
 */
async function expectSameSet(root: Locator): Promise<void> {
  await chooseView(root, 'cards');
  const [cards] = await namesIn(root, 'cards');
  await chooseView(root, 'slots');
  const groups = await namesIn(root, 'slots');
  await chooseView(root, 'list');
  const [list] = await namesIn(root, 'list');
  await chooseView(root, 'cards');

  expect(cards.length, 'S4: the page shows something').toBeGreaterThan(0);
  expect([...list].sort(), 'S4: Lista shows the set of Cards').toEqual([...cards].sort());
  expect(groups.flat().sort(), 'S4: Slots shows the set of Cards').toEqual([...cards].sort());
  expect(list, 'V5: Cards and Lista follow the order of the list').toEqual(cards);
  for (const group of groups) {
    const members = new Set(group);
    expect(
      cards.filter((name) => members.has(name)),
      'V5: the items of a group keep their order in every view',
    ).toEqual(group);
  }
}

async function savedView(page: Page, key: string): Promise<string | null> {
  return page.evaluate((storageKey) => {
    try {
      return window.localStorage.getItem(storageKey);
    } catch {
      return null;
    }
  }, key);
}

async function forgetView(page: Page, key: string): Promise<void> {
  await page.evaluate((storageKey) => {
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // U6: storage may be blocked; nothing was saved then.
    }
  }, key);
}

/**
 * Where an element rests once the page stops scrolling: without reduced motion the
 * document scrolls smoothly (6.4), so a scroll the controller started may still be moving.
 */
async function settledTop(target: Locator): Promise<number> {
  let last = Number.NaN;
  await expect
    .poll(
      async () => {
        const top = await target.evaluate((element) => element.getBoundingClientRect().top);
        const still = Math.abs(top - last) < 0.5;
        last = top;
        return still;
      },
      { intervals: [100, 100, 200, 200, 300, 500] },
    )
    .toBe(true);
  return last;
}

function currentPage(root: Locator): Locator {
  return root.locator('.ac-pagination [aria-current="page"]');
}

test.describe('Controlador de listas en /es/pokedex/ (C7-10)', () => {
  test('U2, V1, V6 y V8: la URL sin parámetros es el estado por defecto', async ({ page }) => {
    const root = await openList(page, POKEDEX, 'pokedex');
    await expect(page).toHaveURL(new RegExp(`${POKEDEX}$`));

    expect(await mountedViews(root), 'V1, V8: only the Cards view is mounted').toEqual([
      'data-card-grid',
    ]);
    await expect(root.locator('[data-card-grid] article')).toHaveCount(PAGE_SIZE);
    await expect(viewButton(root, 'cards')).toHaveAttribute('aria-pressed', 'true');
    await expect(currentPage(root)).toHaveText('1');

    // H5: the count is a polite live region; V6: it sits left of the view toggle.
    const count = root.locator('.ac-entity-list__bar [aria-live="polite"]');
    await expect(count).toHaveText(/^\d{1,3}(?:\.\d{3})* variantes$/);
    const [countBox, toggleBox] = await Promise.all([
      count.boundingBox(),
      root.locator('.ac-view-toggle').boundingBox(),
    ]);
    expect(countBox && toggleBox && countBox.x < toggleBox.x, 'V6: Count left, views right').toBe(
      true,
    );

    // H6: every page is a real link with the canonical URL of that page.
    await expect(root.locator('.ac-pagination a', { hasText: /^2$/ })).toHaveAttribute(
      'href',
      `${POKEDEX}?page=2`,
    );
  });

  test('U1, U3 y U4: la URL se reescribe a su forma canónica', async ({ page }) => {
    const root = await openList(
      page,
      `${POKEDEX}?variante=shiny&view=nada&foo=bar&gen=1&page=999&tier=t99`,
      'pokedex',
    );
    // U4: an invalid value falls back to its default; the page goes to the last one. U1:
    // parameters the list does not own keep their place, its own follow in their order.
    await expect(page).toHaveURL(/\?foo=bar&gen=1&variante=shiny&page=\d+$/);
    const last = new URL(page.url()).searchParams.get('page');
    await expect(currentPage(root)).toHaveText(last ?? '');
    await expect(root.locator('.ac-pagination a', { hasText: /^(Siguiente)$/ })).toHaveCount(0);
    const count = root.locator('.ac-entity-list__bar [aria-live="polite"]');
    await expect(count).toHaveText(/^\d+ Shiny$/);
    const shiny = await count.textContent();

    // U3: the values are registry ids, not words of a dictionary, so the same query serves
    // the English page: the same canonical URL, the same last page, the same count.
    const english = await openList(
      page,
      `/en/pokedex/?variante=shiny&view=nada&foo=bar&gen=1&page=999&tier=t99`,
      'pokedex',
    );
    await expect(page).toHaveURL(
      new RegExp(`/en/pokedex/\\?foo=bar&gen=1&variante=shiny&page=${last ?? ''}$`),
    );
    await expect(currentPage(english)).toHaveText(last ?? '');
    await expect(english.locator('.ac-entity-list__bar [aria-live="polite"]')).toHaveText(
      shiny ?? '',
    );
  });

  test('U6 y S4: la vista elegida sobrevive a una recarga sin `view` en la URL', async ({
    page,
  }) => {
    let root = await openList(page, POKEDEX, 'pokedex');
    await chooseView(root, 'slots');
    // H1: a view change replaces the entry; U6: it is saved.
    await expect(page).toHaveURL(new RegExp(`${POKEDEX}\\?view=slots$`));
    expect(await savedView(page, SAVED.pokedex)).toBe('slots');

    root = await openList(page, POKEDEX, 'pokedex');
    expect(await mountedViews(root)).toEqual(['data-slots']);
    await expect(viewButton(root, 'slots')).toHaveAttribute('aria-pressed', 'true');
    // U2: the saved view is never written back to the URL on its own.
    await expect(page).toHaveURL(new RegExp(`${POKEDEX}$`));

    await chooseView(root, 'cards');
    await forgetView(page, SAVED.pokedex);
  });

  test('U6: una URL que nombra la vista por defecto gana a la vista guardada', async ({ page }) => {
    let root = await openList(page, POKEDEX, 'pokedex');
    await chooseView(root, 'slots');
    expect(await savedView(page, SAVED.pokedex)).toBe('slots');

    // U2 leaves the default view out of the canonical URL, and the view stays the one the
    // URL named, not the saved one.
    root = await openList(page, `${POKEDEX}?view=cards`, 'pokedex');
    await expect(page).toHaveURL(new RegExp(`${POKEDEX}$`));
    await expect(viewButton(root, 'cards')).toHaveAttribute('aria-pressed', 'true');
    expect(await mountedViews(root)).toEqual(['data-card-grid']);
    // It is the view the reader now sees, so it is saved like any other (U6), and a reload
    // without `view` keeps it.
    expect(await savedView(page, SAVED.pokedex)).toBe('cards');
    root = await openList(page, POKEDEX, 'pokedex');
    expect(await mountedViews(root)).toEqual(['data-card-grid']);
    await forgetView(page, SAVED.pokedex);
  });

  test('V4: en Lista cada cabecera nombra la celda de su columna', async ({ page }) => {
    // 8.2: Sprite (solo lector) · Nº · Nombre · … The sprite and the name are cells of
    // `ListRow` of their own, so a header over the wrong one names another column.
    for (const [path, number, name] of [
      [POKEDEX, 'Nº', 'Nombre'],
      ['/en/pokedex/', 'No.', 'Name'],
    ] as const) {
      const root = await openList(page, `${path}?view=list`, 'pokedex');
      // The pieces of Lista arrive in a chunk of their own (§13.6).
      await expect(root.locator('[data-list] tbody tr')).toHaveCount(PAGE_SIZE);
      const table = await root.evaluate((element) => {
        const text = (node: Element) => (node.textContent ?? '').replace(/\s+/g, ' ').trim();
        const headers = [...element.querySelectorAll('[data-list] thead th')].map(text);
        const rows = [...element.querySelectorAll('[data-list] tbody tr')].map((row) =>
          [...row.children].map((cell) => ({
            sprite: cell.classList.contains('ac-list-row__sprite'),
            name: cell.classList.contains('ac-list-row__name'),
            text: text(cell),
          })),
        );
        return { headers, rows };
      });

      expect(table.rows.length, `${path}: a page of rows`).toBe(PAGE_SIZE);
      const numberAt = table.headers.indexOf(number);
      const nameAt = table.headers.indexOf(name);
      expect(numberAt, `${path}: «${number}» comes before «${name}»`).toBeGreaterThan(0);
      expect(nameAt, `${path}: «${name}» follows «${number}»`).toBe(numberAt + 1);
      for (const cells of table.rows) {
        expect(cells, `${path}: one cell per header`).toHaveLength(table.headers.length);
        expect(cells[0].sprite, `${path}: the first column is the sprite`).toBe(true);
        expect(cells[numberAt].text, `${path}: «${number}» holds the number`).toMatch(
          /^(?:\d+|—)$/,
        );
        expect(cells[nameAt].name, `${path}: «${name}» holds the name`).toBe(true);
      }
    }
    await forgetView(page, SAVED.pokedex);
  });

  test('S4 y V5: las tres vistas muestran el mismo conjunto en el mismo orden', async ({
    page,
  }) => {
    const root = await openList(page, `${POKEDEX}?page=13`, 'pokedex');
    await expectSameSet(root);
    await forgetView(page, SAVED.pokedex);
  });

  test('H1 a H4 y H6: cambiar de página añade una entrada y lleva el foco a los resultados', async ({
    page,
  }) => {
    const root = await openList(page, POKEDEX, 'pokedex');
    await page.evaluate(() => {
      (window as unknown as { acSamePage: boolean }).acSamePage = true;
    });
    const before = await page.evaluate(() => window.history.length);

    await root.locator('.ac-pagination a', { hasText: /^2$/ }).click();
    await expect(page).toHaveURL(new RegExp(`${POKEDEX}\\?page=2$`));
    await expect(currentPage(root)).toHaveText('2');
    // H6: the click is the controller's: the document did not reload.
    expect(
      await page.evaluate(() => (window as unknown as { acSamePage?: boolean }).acSamePage),
    ).toBe(true);
    // H1: a page change is a new history entry.
    expect(await page.evaluate(() => window.history.length)).toBe(before + 1);
    // H4: the results take the focus and land 16 px under the header.
    const results = root.locator('.ac-entity-list__results');
    await expect(results).toBeFocused();
    const top = await settledTop(results);
    expect(Math.abs(top - RESULTS_TOP), `H4: results at ${top}`).toBeLessThanOrEqual(2);

    // H3: a view change keeps the page; H1: and replaces the entry.
    await chooseView(root, 'list');
    await expect(page).toHaveURL(new RegExp(`${POKEDEX}\\?view=list&page=2$`));
    expect(await page.evaluate(() => window.history.length)).toBe(before + 1);

    // H2: Back reads the URL again and walks the visited pages only.
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`${POKEDEX}$`));
    await expect(currentPage(root)).toHaveText('1');

    await chooseView(root, 'cards');
    await forgetView(page, SAVED.pokedex);
  });

  test('H7: el ancla de la URL lleva a su elemento y enfoca su título', async ({ page }) => {
    const root = await openList(page, POKEDEX, 'pokedex');
    const id = await root.locator('[data-card-grid] article').nth(3).getAttribute('id');
    expect(id, 'H7: every card carries its anchor').toMatch(/^pokemon-/);

    await page.goto('about:blank');
    const anchored = await openList(page, `${POKEDEX}#${id}`, 'pokedex');
    const title = anchored.locator(`#${id} .ac-card__title a`);
    await expect(title).toBeFocused();
    // `scrollIntoView({ block: 'start' })` under the 64 px of `scroll-padding-top`, or as
    // far as the document scrolls when the card sits in its last screen.
    const top = await settledTop(anchored.locator(`#${id}`));
    const end = await page.evaluate(
      () => window.scrollY >= document.documentElement.scrollHeight - window.innerHeight - 1,
    );
    expect(
      Math.abs(top - 64) <= 2 || (end && top > 64),
      `H7: the card starts under the header, at ${top}`,
    ).toBe(true);
  });

  test('V7: sin resultados la barra se queda y la paginación desaparece', async ({ page }) => {
    const root = await openList(page, `${POKEDEX}${pokedexEmptyQuery()}`, 'pokedex');
    await expect(root.locator('.ac-entity-list__bar [aria-live="polite"]')).toHaveText(
      '0 variantes',
    );
    await expect(root.locator('.ac-empty-state')).toContainText(
      'No hay Pokémon que coincidan con estos filtros.',
    );
    await expect(root.getByRole('link', { name: 'Limpiar filtros' })).toHaveAttribute(
      'href',
      POKEDEX,
    );
    await expect(root.locator('.ac-pagination')).toHaveCount(0);
    expect(await mountedViews(root), 'V7: no view is mounted').toEqual([]);
  });

  test('PR1 y PR2: el HTML prerenderizado es el estado por defecto y se hidrata sin error', async ({
    page,
    request,
  }) => {
    const plain = await (await request.get(POKEDEX)).text();
    const withState = await (await request.get(`${POKEDEX}?view=list&page=3&gen=2`)).text();
    const firstCard = (html: string) => /<article[^>]*id="(pokemon-[^"]+)"/.exec(html)?.[1];
    expect(firstCard(plain), 'the prerendered page has cards').toBeTruthy();
    expect(firstCard(withState), 'PR2: the page never reads its query').toBe(firstCard(plain));
    expect(withState).toContain('data-card-grid');

    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error' && /hydrat|did not match/i.test(message.text())) {
        errors.push(message.text());
      }
    });
    const root = await openList(page, `${POKEDEX}?view=list&page=3`, 'pokedex');
    expect(await mountedViews(root)).toEqual(['data-list']);
    await expect(currentPage(root)).toHaveText('3');
    expect(errors, 'PR1: no hydration error').toEqual([]);
    await forgetView(page, SAVED.pokedex);
  });

  test('PR4: con estado en la URL o una vista guardada la raíz se pinta oculta', async ({
    page,
  }) => {
    // The island never hydrates here, so what the page shows is what the inline script
    // left before the first paint.
    await page.route('**/components/pokedex/PokedexRoot*', (route) => route.abort());

    const hidden = async (url: string) => {
      await page.goto(url);
      const root = listRoot(page, 'pokedex');
      await expect(root).toHaveAttribute('data-ac-pending', '');
      expect(await root.evaluate((element) => getComputedStyle(element).visibility)).toBe('hidden');
      // Nothing of the default state reaches the screen, and the footer waits with it.
      await expect(root.locator('article').filter({ visible: true })).toHaveCount(0);
      await expect(page.locator('.ac-page-layout__foot')).toBeHidden();
    };

    // The default state hides nothing.
    await page.goto(POKEDEX);
    await expect(listRoot(page, 'pokedex')).not.toHaveAttribute('data-ac-pending');
    await expect(page.locator('.ac-page-layout__foot')).toBeVisible();

    await hidden(`${POKEDEX}?view=list&page=2`);
    // The saved view is read before the first paint too. The init script runs on every
    // later load of this page, so this case goes last.
    await page.addInitScript((key) => {
      try {
        window.localStorage.setItem(key, 'slots');
      } catch {
        // PR4 reads the saved view in try/catch too.
      }
    }, SAVED.pokedex);
    await hidden(POKEDEX);
  });

  test('PR4: la raíz se muestra cuando el estado está aplicado', async ({ page }) => {
    const root = await openList(page, `${POKEDEX}?view=list&page=2`, 'pokedex');
    expect(await mountedViews(root)).toEqual(['data-list']);
    await expect(currentPage(root)).toHaveText('2');
    await expect(root.locator('[data-list] tbody tr')).toHaveCount(PAGE_SIZE);
    await expect(page.locator('.ac-page-layout__foot')).toBeVisible();
    await forgetView(page, SAVED.pokedex);
  });

  test('PR5: sin datos.json la primera página sigue y el error llega al pedir otra', async ({
    page,
  }) => {
    let requests = 0;
    await page.route('**/es/pokedex/datos.json*', (route) => {
      requests += 1;
      return route.abort();
    });
    const root = await openList(page, POKEDEX, 'pokedex');
    await expect(root.locator('[data-card-grid] article')).toHaveCount(PAGE_SIZE);

    await root.locator('.ac-pagination a', { hasText: /^2$/ }).click();
    await expect(root.locator('.ac-empty-state')).toHaveText('No se pudieron cargar los datos.');
    await expect(root.locator('.ac-pagination')).toHaveCount(0);
    expect(requests, 'PR5: the rows are asked for once').toBe(1);
  });
});

test.describe('Tres vistas en /_paridad/tarjetas/ (S4)', () => {
  test('los drops muestran el mismo conjunto en Cards, Slots y Lista', async ({ page }) => {
    const root = await openList(page, TARJETAS, 'drops');
    await expect(root.locator('.ac-entity-list__bar [aria-live="polite"]')).toHaveText(
      /^\d+ drops?$/,
    );
    await expectSameSet(root);
    // Every row on one page (8.0.6): no pagination.
    await expect(root.locator('.ac-pagination')).toHaveCount(0);
  });

  test('la vista de los drops sobrevive a una recarga con su prefijo', async ({ page }) => {
    let root = await openList(page, TARJETAS, 'drops');
    await chooseView(root, 'list');
    await expect(page).toHaveURL(/\?drops\.view=list$/);
    expect(await savedView(page, SAVED.drops)).toBe('list');

    root = await openList(page, TARJETAS, 'drops');
    expect(await mountedViews(root)).toEqual(['data-list']);
    // H7: the anchor of a drop is its row in Lista.
    await expect(root.locator('tr#item-fire-stone')).toHaveCount(1);
    await chooseView(root, 'cards');
    await forgetView(page, SAVED.drops);
  });

  test('H7: el ancla de una tarjeta con el título en texto la enfoca a ella, no a una entidad anidada', async ({
    page,
  }) => {
    // 7.5.10: an entity in the facts of a card — the one Pokémon of «Drop de» of Dark Wing,
    // the element of Fire Stone — is another entity. The title of an item is text (§15), so
    // the anchor focuses the card itself, and no panel opens (IT4, IT5).
    for (const id of ['item-dark-wing', 'item-fire-stone']) {
      await page.goto('about:blank');
      const root = await openList(page, `${TARJETAS}#${id}`, 'drops');
      const card = root.locator(`[data-card-grid] article#${id}`);
      await expect(
        card.locator('[data-ac-tt] a[href], [data-ac-tt] button'),
        `${id}: the card nests an entity`,
      ).not.toHaveCount(0);
      await expect(card).toBeFocused();
      await expect(page.locator('[role="tooltip"][data-open]')).toHaveCount(0);
    }

    // Slots and Lista keep their trigger: the slot, and the name of the row.
    for (const [view, trigger] of [
      ['slots', '.ac-entity-slot'],
      ['list', '.ac-list-row__name button'],
    ] as const) {
      await page.goto('about:blank');
      const root = await openList(page, `${TARJETAS}?drops.view=${view}#item-dark-wing`, 'drops');
      await expect(root.locator(`#item-dark-wing ${trigger}`)).toBeFocused();
    }
    await forgetView(page, SAVED.drops);
  });
});

// ------------------------------------------------------------------------------ S2, C7-04

/** 7.6.1: the base columns and gap of each family and the container widths of each step. */
const FAMILIES: Record<
  string,
  { base: number; steps: [number, number][]; gap: [number, number][] }
> = {
  listing: {
    base: 1,
    steps: [
      [576, 2],
      [872, 3],
      [1168, 4],
    ],
    gap: [
      [0, 12],
      [480, 16],
    ],
  },
  pokedex: {
    base: 2,
    steps: [
      [812, 3],
      [1088, 4],
    ],
    gap: [
      [0, 8],
      [480, 16],
    ],
  },
  loot: {
    base: 1,
    steps: [
      [496, 2],
      [752, 3],
      [1008, 4],
    ],
    gap: [
      [0, 12],
      [480, 16],
    ],
  },
  featured: {
    base: 1,
    steps: [
      [408, 2],
      [824, 4],
    ],
    gap: [[0, 8]],
  },
  index: {
    base: 1,
    steps: [
      [596, 2],
      [902, 3],
    ],
    gap: [[0, 16]],
  },
  kpi: {
    base: 1,
    steps: [
      [416, 2],
      [848, 4],
    ],
    gap: [[0, 16]],
  },
  info: { base: 1, steps: [[576, 2]], gap: [[0, 16]] },
};

function expected(family: string, width: number): { cols: number; gap: number } {
  const rule = FAMILIES[family];
  let cols = rule.base;
  for (const [from, value] of rule.steps) if (width >= from) cols = value;
  let gap = rule.gap[0][1];
  for (const [from, value] of rule.gap) if (width >= from) gap = value;
  return { cols, gap };
}

/**
 * `DS:guias/30 §Responsive` for the full-width grids of the page at each window: the main
 * column of CARD_GRID_SYSTEM §3 and the columns × width of Comercio and the Pokédex.
 */
const RESPONSIVE: {
  window: number;
  main: number;
  listing: [number, number];
  pokedex: [number, number];
}[] = [
  { window: 1440, main: 944, listing: [3, 304], pokedex: [3, 304] },
  { window: 1280, main: 784, listing: [2, 384], pokedex: [2, 384] },
  { window: 1024, main: 992, listing: [3, 320], pokedex: [3, 320] },
  { window: 768, main: 736, listing: [2, 360], pokedex: [2, 360] },
  { window: 390, main: 358, listing: [1, 358], pokedex: [2, 175] },
];

type GridReport = {
  where: string;
  family: string;
  width: number;
  /** Cards in the grid. */
  count: number;
  /** Columns the cards take: all of the rule's, or fewer when the grid has fewer cards. */
  cols: number;
  widths: number[];
  columnGap: number;
  rowGap: number;
  gridRows: string[];
  rowSpread: number;
  zoneSpread: number;
};

/** Every visible card grid of the page, measured as S2 reads it. */
async function measureGrids(page: Page): Promise<GridReport[]> {
  return page.evaluate(() => {
    const out: GridReport[] = [];
    for (const outer of document.querySelectorAll<HTMLElement>('.ac-card-grid')) {
      const grid = outer.querySelector<HTMLElement>(':scope > .ac-card-grid__grid');
      if (grid === null || outer.getBoundingClientRect().width === 0) continue;
      const cards = [...grid.children] as HTMLElement[];
      if (cards.length === 0) continue;
      const boxes = cards.map((card) => card.getBoundingClientRect());
      const lefts = new Set(boxes.map((box) => Math.round(box.left)));
      const rows: { top: number; items: { card: HTMLElement; box: DOMRect }[] }[] = [];
      cards.forEach((card, index) => {
        const box = boxes[index];
        let row = rows.find((candidate) => Math.abs(candidate.top - box.top) < 1);
        if (!row) rows.push((row = { top: box.top, items: [] }));
        row.items.push({ card, box });
      });
      let rowSpread = 0;
      let zoneSpread = 0;
      for (const row of rows) {
        const heights = row.items.map((item) => item.box.height);
        rowSpread = Math.max(rowSpread, Math.max(...heights) - Math.min(...heights));
        const starts = new Map<number, number[]>();
        for (const { card, box } of row.items) {
          [...card.children].forEach((zone, index) => {
            const list = starts.get(index) ?? [];
            list.push(zone.getBoundingClientRect().top - box.top);
            starts.set(index, list);
          });
        }
        for (const list of starts.values()) {
          if (list.length === row.items.length) {
            zoneSpread = Math.max(zoneSpread, Math.max(...list) - Math.min(...list));
          }
        }
      }
      const style = getComputedStyle(grid);
      const section = outer.closest('section[id]');
      out.push({
        where: `${section?.id ?? '?'} · ${outer.dataset.family ?? '?'} · ${Math.round(outer.getBoundingClientRect().width)}`,
        family: outer.dataset.family ?? '',
        width: Math.round(outer.getBoundingClientRect().width * 10) / 10,
        count: cards.length,
        cols: lefts.size,
        widths: [...new Set(boxes.map((box) => Math.round(box.width * 10) / 10))],
        columnGap: parseFloat(style.columnGap),
        rowGap: parseFloat(style.rowGap),
        gridRows: [
          ...new Set(
            cards.map(
              (card) =>
                `${getComputedStyle(card).gridRowStart}/${getComputedStyle(card).gridRowEnd}`,
            ),
          ),
        ],
        rowSpread: Math.round(rowSpread * 10) / 10,
        zoneSpread: Math.round(zoneSpread * 10) / 10,
      });
    }
    return out;
  });
}

function expectGrid(report: GridReport): void {
  const { cols, gap } = expected(report.family, report.width);
  const where = `${report.where} (${report.width} px)`;
  expect(report.cols, `7.6.1: columns of ${where}`).toBe(Math.min(cols, report.count));
  expect(report.columnGap, `7.6.1: gap of ${where}`).toBe(gap);
  expect(report.rowGap, `7.6.1: row gap of ${where}`).toBe(gap);
  const width = (report.width - (cols - 1) * gap) / cols;
  for (const measured of report.widths) {
    expect(Math.abs(measured - width), `7.6.1: card width of ${where}`).toBeLessThanOrEqual(0.5);
  }
  expect(report.gridRows, `C7-04: every card of ${where} spans the same tracks`).toHaveLength(1);
  expect(report.rowSpread, `S2: row heights of ${where}`).toBeLessThanOrEqual(0.5);
  expect(report.zoneSpread, `S2: zone starts of ${where}`).toBeLessThanOrEqual(0.5);
}

/** WCAG 1.4.12: the text-spacing overrides S2 measures with. */
const TEXT_SPACING =
  '* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; } p { margin-bottom: 2em !important; }';

/** S2: text outside its card and fact rows that overlap, with the overrides on. */
async function spills(page: Page): Promise<{ outside: string[]; overlaps: string[] }> {
  return page.evaluate(() => {
    const outside: string[] = [];
    const overlaps: string[] = [];
    for (const card of document.querySelectorAll<HTMLElement>('.ac-card-grid__grid > *')) {
      const box = card.getBoundingClientRect();
      if (box.width === 0) continue;
      const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const parent = node.parentElement;
        if (parent === null || !(node.nodeValue ?? '').trim()) continue;
        if (parent.closest('[popover]')) continue;
        const style = getComputedStyle(parent);
        if (style.display === 'none' || style.visibility === 'hidden') continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const rect of range.getClientRects()) {
          if (rect.width === 0) continue;
          // Text an ancestor inside the card clips (an ellipsis, a clamp) does not leave it.
          let clipped = false;
          for (
            let ancestor: Element | null = parent;
            ancestor && ancestor !== card;
            ancestor = ancestor.parentElement
          ) {
            const own = getComputedStyle(ancestor);
            if (own.overflowX !== 'visible' || own.overflowY !== 'visible') {
              const clip = ancestor.getBoundingClientRect();
              if (
                rect.right > clip.right + 0.5 ||
                rect.left < clip.left - 0.5 ||
                rect.bottom > clip.bottom + 0.5
              ) {
                clipped = true;
              }
            }
          }
          if (clipped) continue;
          if (
            rect.right > box.right + 0.5 ||
            rect.left < box.left - 0.5 ||
            rect.bottom > box.bottom + 0.5 ||
            rect.top < box.top - 0.5
          ) {
            outside.push(
              `${card.closest('section[id]')?.id}: «${(node.nodeValue ?? '').trim().slice(0, 30)}»`,
            );
          }
        }
      }
      for (const list of card.querySelectorAll('dl')) {
        const rows = [...list.children].map((row) => row.getBoundingClientRect());
        for (let index = 1; index < rows.length; index += 1) {
          if (rows[index].top < rows[index - 1].bottom - 0.5) {
            overlaps.push(`${card.closest('section[id]')?.id}: ${list.className} row ${index}`);
          }
        }
      }
    }
    return { outside, overlaps };
  });
}

test.describe('Rejillas de tarjetas (S2, C7-04)', () => {
  for (const size of RESPONSIVE) {
    test(`a ${size.window}: columnas, anchos, pistas y zonas de cada rejilla`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width: size.window, height: 900 });

      await openList(page, TARJETAS, 'drops');
      const reports = await measureGrids(page);
      expect(reports.length, 'the parity route draws its grids').toBeGreaterThanOrEqual(8);
      for (const report of reports) expectGrid(report);

      // DS:guias/30 §Responsive: the full-width grids of Comercio and the Pokédex.
      for (const [section, family] of [
        ['comercio', 'listing'],
        ['pokedex', 'pokedex'],
      ] as const) {
        const report = reports.find(
          (candidate) => candidate.where.startsWith(`${section} ·`) && candidate.family === family,
        );
        expect(report, `${section} has its grid`).toBeDefined();
        if (report === undefined) continue;
        const [cols, width] = size[family];
        expect(report.width, `CARD_GRID_SYSTEM §3: main column at ${size.window}`).toBe(size.main);
        expect([report.cols, report.widths], `DS:guias/30 at ${size.window}: ${section}`).toEqual([
          cols,
          [width],
        ]);
      }

      // The prototype of §13.6: its grid is the same family at the same widths.
      await openList(page, POKEDEX, 'pokedex');
      const [pokedex] = await measureGrids(page);
      expect(pokedex.width).toBe(size.main);
      expect([pokedex.cols, pokedex.widths]).toEqual([size.pokedex[0], [size.pokedex[1]]]);
      expectGrid(pokedex);

      // WCAG 1.4.12: with the text spacing of the criterion, tracks grow and nothing spills.
      for (const url of [TARJETAS, POKEDEX]) {
        await page.goto(url);
        await page.evaluate(() => document.fonts.ready);
        await page.addStyleTag({ content: TEXT_SPACING });
        const { outside, overlaps } = await spills(page);
        expect(outside, `S2: text outside its card on ${url}`).toEqual([]);
        expect(overlaps, `S2: overlapping fact rows on ${url}`).toEqual([]);
        for (const report of await measureGrids(page)) {
          expect(report.rowSpread, `S2 with text spacing: ${report.where}`).toBeLessThanOrEqual(
            0.5,
          );
          expect(report.zoneSpread, `S2 with text spacing: ${report.where}`).toBeLessThanOrEqual(
            0.5,
          );
        }
      }
    });
  }
});

// ------------------------------------------------------------------------------ C7-09

/** 7.6.4: the anatomy of the Pokédex cards of a grid, read from the rendered page. */
async function dexAnatomy(grid: Locator) {
  return grid.evaluate((element) =>
    [...element.querySelectorAll<HTMLElement>('article.ac-dex-card')].map((card) => {
      const visible = (node: Element) => getComputedStyle(node).display !== 'none';
      const items = [...card.querySelectorAll('.ac-dex-card__drops > li')].filter(visible);
      const drops = items.filter((li) => !li.hasAttribute('data-variant'));
      // A named chip shows its name; the compact anatomy keeps the name for screen readers
      // only, so there it takes no room.
      const named = drops.filter((li) => {
        const name = li.querySelector('.ac-dex-card__name');
        return name !== null && visible(name) && name.getBoundingClientRect().width > 2;
      }).length;
      return {
        name: card.querySelector('.ac-card__title')?.textContent?.trim() ?? '',
        head: getComputedStyle(card.querySelector('[data-zone="head"]') as Element).flexDirection,
        slots: drops.length - named,
        chips: named,
        more: items
          .filter((li) => li.hasAttribute('data-variant'))
          .map((li) => {
            const box = li.querySelector('button')?.getBoundingClientRect();
            return {
              variant: li.getAttribute('data-variant'),
              width: box?.width,
              height: box?.height,
            };
          }),
      };
    }),
  );
}

test.describe('Anatomía compacta de DexCard (C7-09)', () => {
  test('a 358 de contenedor, sin JavaScript: compacta, tope de 6 drops y «+N» cuadrado', async ({
    browser,
  }) => {
    const context = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();
    await stubRemoteArt(page);
    await page.goto(TARJETAS);
    const grid = page.locator('#movil .ac-card-grid[data-family="pokedex"]');
    expect(await grid.evaluate((element) => element.getBoundingClientRect().width)).toBe(358);
    for (const card of await dexAnatomy(grid)) {
      expect(card.head, `7.6.4: the head of ${card.name} stacks`).toBe('column');
      expect(card.chips, `7.6.4: no named chip in the compact ${card.name}`).toBe(0);
      expect(card.slots, `7.6.4: at most 6 drops in ${card.name}`).toBeLessThanOrEqual(6);
      for (const more of card.more) {
        expect(more.variant, `7.6.4: only the compact «+N» in ${card.name}`).toBe('compact');
        expect([more.width, more.height], `7.6.4: the «+N» of ${card.name} is square`).toEqual([
          36, 36,
        ]);
        expect(card.slots, `7.6.4: 5 slots and «+N» in ${card.name}`).toBe(5);
      }
    }
    await context.close();
  });

  test('a 944: tope de 3 chips con nombre y «+N» del resto', async ({ page }) => {
    // The Pokédex section is 944 wide at 1440, whatever the project's window.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(TARJETAS);
    const grid = page.locator('#pokedex .ac-card-grid');
    const cards = await dexAnatomy(grid);
    expect(cards).toHaveLength(12);
    let withMore = 0;
    for (const card of cards) {
      expect(card.head, `the regular head of ${card.name}`).toBe('row');
      expect(
        card.chips,
        `CARD_GRID_SYSTEM §9: at most 3 chips in ${card.name}`,
      ).toBeLessThanOrEqual(3);
      for (const more of card.more) {
        expect(more.variant, `only the regular «+N» in ${card.name}`).toBe('regular');
        expect(card.chips, `2 chips and «+N» in ${card.name}`).toBe(2);
        withMore += 1;
      }
    }
    expect(withMore, 'the board has entries with more than 3 named drops').toBeGreaterThan(0);
  });

  test('ningún elemento oculto por la anatomía es enfocable', async ({ page }) => {
    await page.goto(TARJETAS);
    const hiddenFocusable = await page.evaluate(() => {
      const focusable = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';
      return [...document.querySelectorAll<HTMLElement>(`.ac-dex-card ${focusable}`)]
        .filter((element) => element.getClientRects().length === 0 && element.tabIndex >= 0)
        .filter((element) => {
          // An element display:none takes no box; a focusable one without a box is a leak.
          element.focus();
          return document.activeElement === element;
        })
        .map((element) => element.outerHTML.slice(0, 80));
    });
    expect(hiddenFocusable).toEqual([]);
  });
});

// ------------------------------------------------------------------------------ S8

test.describe('Dinero de las tarjetas (S8)', () => {
  test('cada importe lleva su sprite antes y se lee con la cifra exacta', async ({ page }) => {
    await page.goto(TARJETAS);
    const amounts = await page.evaluate(() => {
      const squash = (text: string | null) => (text ?? '').replace(/\s+/g, ' ').trim();
      const read = (block: string) =>
        [...document.querySelectorAll(block)]
          .filter((element) => element.getBoundingClientRect().width > 0)
          .map((element) => {
            const number = [...element.children].find(
              (child) =>
                child.getAttribute('aria-hidden') === 'true' && squash(child.textContent) !== '',
            );
            const previous = number?.previousElementSibling ?? null;
            const image = element.querySelector('img');
            const first = element.firstElementChild;
            return {
              block,
              visible: squash(number?.textContent ?? null),
              spoken: squash(
                [...element.childNodes]
                  .filter(
                    (node) =>
                      !(node instanceof Element && node.getAttribute('aria-hidden') === 'true'),
                  )
                  .map((node) => node.textContent ?? '')
                  .join(''),
              ),
              text: squash(element.textContent),
              sprite: image?.getAttribute('src') ?? null,
              before:
                block === '.ac-pokedolares-amount'
                  ? previous !== null &&
                    (previous.matches('img') || previous.querySelector('img') !== null)
                  : first !== null &&
                    first.getAttribute('aria-hidden') === 'true' &&
                    first.querySelector('img') !== null,
            };
          });
      return [...read('.ac-pokedolares-amount'), ...read('.ac-diamonds-amount')];
    });

    expect(amounts.length, 'the listings show amounts').toBeGreaterThan(5);
    for (const amount of amounts) {
      if (amount.text === '—') continue;
      const where = `${amount.block} «${amount.text}»`;
      const pokedolares = amount.block === '.ac-pokedolares-amount';
      expect(amount.sprite, `S8: ${where} carries its sprite`).toContain(
        pokedolares ? '/sprites/ui/pokedolares.png' : '/sprites/ui/diamond.png',
      );
      expect(amount.before, `S8: the sprite comes before ${where}`).toBe(true);
      if (pokedolares) {
        expect(amount.spoken, `S8: ${where} is read as the exact figure`).toMatch(
          /^\d{1,3}(?:\.\d{3})* Pokédólar(?:es)?$/,
        );
      } else {
        expect(amount.spoken, `S8: ${where} is read as the exact figure`).toMatch(
          /^\d{1,3}(?:\.\d{3})* Diamonds?$/,
        );
      }
    }
  });
});
