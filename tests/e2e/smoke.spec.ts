import { expect, test } from '@playwright/test';

test('Spanish foundation shell renders and navigates', async ({ page }) => {
  const browserErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text());
  });
  page.on('pageerror', (error) => browserErrors.push(error.message));

  await page.goto('/es/');

  await expect(page).toHaveTitle(/Inicio · Alliance Codex/);
  await expect(page.locator('body')).not.toBeEmpty();
  await expect(page.locator('[data-nextjs-dialog], .vite-error-overlay')).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'Bienvenido a la wiki de PokeAlliance' }),
  ).toBeVisible();
  await expect(page.getByTestId('server-save-status')).toBeVisible();

  await page.getByRole('link', { name: 'Pokédex', exact: true }).click();
  await expect(page).toHaveURL(/\/es\/pokedex\/$/);
  await expect(page.getByRole('heading', { name: 'Pokédex', exact: true })).toBeVisible();
  await page
    .getByRole('searchbox', { name: 'Buscar Pokémon, misión, objeto o sistema…' })
    .fill('Chimchar');
  await expect(page.getByRole('link', { name: /Chimchar/ })).toBeVisible();
  await page.getByRole('link', { name: /Chimchar/ }).click();
  await expect(page).toHaveURL(/\/es\/pokedex\/chimchar\/$/);
  await expect(page.getByRole('heading', { name: 'Chimchar', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'De dónde sale este dato' })).toBeVisible();
  expect(browserErrors).toEqual([]);
});

test('English locale is a real route, not a browser preference', async ({ page }) => {
  const browserErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text());
  });
  page.on('pageerror', (error) => browserErrors.push(error.message));

  await page.goto('/en/');

  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('body')).not.toBeEmpty();
  await expect(page.locator('[data-nextjs-dialog], .vite-error-overlay')).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'Welcome to the PokeAlliance wiki' }),
  ).toBeVisible();
  await expect(page.locator('a.locale-link')).toHaveAttribute('href', '/es/');
  expect(browserErrors).toEqual([]);
});

test('Guild history detects joins, level gains and Server Save access windows', async ({
  page,
}) => {
  await page.goto('/es/herramientas/guild/');
  await expect(page.getByTestId('guild-ranking-tool')).toHaveAttribute('data-hydrated', 'true');
  const jsonInput = page.getByRole('textbox', {
    name: 'O pega aquí el contenido del JSON',
  });
  const monday = {
    exportedAt: '2026-09-14 23:00:00',
    guild: 'Semana Test',
    members: [
      {
        name: 'Alpha Player',
        rank: 'a Member',
        level: 120,
        dailiesCompleted: 0,
        contribution: 0,
      },
    ],
  };
  const tuesday = {
    exportedAt: '2026-09-15 23:00:00',
    guild: 'Semana Test',
    members: [
      {
        name: 'Alpha Player',
        rank: 'a Member',
        level: 122,
        dailiesCompleted: 2,
        contribution: 300,
      },
      {
        name: 'New Player',
        rank: 'a Member',
        level: 200,
        dailiesCompleted: 0,
        contribution: 0,
      },
    ],
  };

  await jsonInput.fill(JSON.stringify(monday));
  await page.getByRole('button', { name: 'Cargar datos', exact: true }).click();
  await page.getByRole('button', { name: /Añadir cálculo de lunes/ }).click();

  await jsonInput.fill(JSON.stringify(tuesday));
  await page.getByRole('button', { name: 'Cargar datos', exact: true }).click();

  const activity = page.getByTestId('guild-member-activity');
  await expect(activity).toContainText('Alta observada');
  await expect(activity).toContainText('New Player');
  await expect(activity).toContainText('Dailies desde 16/09/2026');
  await expect(activity).toContainText('Donación desde 17/09/2026');
  await expect(activity).toContainText('Niveles ganados+2');
  await expect(page.getByRole('columnheader', { name: 'Progreso y acceso' })).toBeVisible();
  await expect(page.getByRole('row', { name: /New Player/ })).toContainText(
    'Meta ajustada a días habilitados',
  );
});

test('Wiki Core collection routes expose reviewed content', async ({ page }) => {
  await page.goto('/es/guias/');
  await expect(page.getByRole('heading', { name: 'Guías', exact: true })).toBeVisible();
  await expect(page.getByText('Porygon Quest: Dr. Vektor')).toBeVisible();

  await page.goto('/es/fuentes/');
  await expect(
    page.getByRole('heading', { name: 'Fuentes y procedencia', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Alliance PokeTibia Wiki')).toBeVisible();
  await expect(page.locator('[data-slot="card"].wiki-source-card')).toHaveCount(10);
  await expect(page.locator('[data-slot="card-footer"].wiki-source-card-footer')).toHaveCount(10);

  await page.goto('/es/buscar/');
  await page
    .getByRole('searchbox', { name: 'Buscar Pokémon, misión, objeto o sistema…' })
    .fill('Scratch');
  await expect(page.getByRole('link', { name: /Scratch/ })).toBeVisible();

  await page.goto('/es/herramientas/');
  await expect(page.getByRole('heading', { name: 'Herramientas', exact: true })).toBeVisible();
  await expect(page.getByText('Mapa interactivo')).toBeVisible();
  await expect(page.getByText('Ranking de guild')).toBeVisible();

  await page.goto('/es/herramientas/guild/');
  await expect(page.getByRole('heading', { name: 'Ranking de guild', exact: true })).toBeVisible();
  await expect(page.getByTestId('guild-ranking-tool')).toHaveAttribute('data-hydrated', 'true');
  await page.locator('input[type="file"]').setInputFiles('tests/fixtures/guild-export.sample.json');
  await expect(page.getByText('guild-export.sample.json', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cargar datos', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Test Guild', exact: true })).toBeVisible();
  await expect(page.getByTestId('guild-history-overview')).toContainText('1 registro');
  const difficultyAction = page.getByRole('button', { name: 'Desglose', exact: true }).first();
  await expect(difficultyAction).toBeVisible();
  await difficultyAction.click();
  await expect(page.getByTestId('guild-difficulty-editor')).toBeVisible();
  await page.getByRole('spinbutton', { name: 'normal · Dailies asignadas' }).fill('2');
  await page.getByRole('spinbutton', { name: 'wildscape · Dailies asignadas' }).fill('2');
  await page.getByRole('spinbutton', { name: 'primal · Dailies asignadas' }).fill('0');
  await page.getByRole('button', { name: 'Guardar desglose', exact: true }).click();
  await expect(
    page.getByText('Desglose manual guardado para este día.', { exact: true }),
  ).toBeVisible();
  const addCalculation = page.getByRole('button', { name: /Añadir cálculo de jueves/ });
  await expect(addCalculation).toBeVisible();
  await addCalculation.click();
  await expect(page.getByText('Cálculo añadido al historial.', { exact: true })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: /Contribución/ })).toBeVisible();
  await expect(
    page.getByTestId('guild-ranking-tool').getByText('700', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Día de control: 4/7')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Copiar resumen para WhatsApp', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Copiar anuncio para Discord', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Copiar resumen para WhatsApp', exact: true }).click();
  await expect(
    page.getByText('Resumen en español copiado para WhatsApp.', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Copiar anuncio para Discord', exact: true }).click();
  await expect(
    page.getByText('Anuncio Markdown copiado para Discord. Se separa en bloques si hace falta.', {
      exact: true,
    }),
  ).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles('tests/fixtures/guild-export.sample.json');
  await page.getByRole('button', { name: 'Cargar datos', exact: true }).click();
  await expect(page.getByRole('button', { name: /Actualizar cálculo de jueves/ })).toBeVisible();

  await page.goto('/es/herramientas/pokemon/');
  await expect(page.getByRole('heading', { name: 'Comparar Pokémon', exact: true })).toBeVisible();
  await expect(page.getByTestId('pokemon-explorer')).toBeVisible();
  await expect(
    page.getByTestId('pokemon-explorer').getByText('910 variantes registradas'),
  ).toBeVisible();
  await page.getByRole('tab', { name: 'Explorar tiers' }).click();
  await expect(page.getByRole('heading', { name: 'Explorar por tier', exact: true })).toBeVisible();
  await expect(page.getByText('910 resultados', { exact: true })).toBeVisible();

  await page.goto('/es/cambios/');
  await expect(page.getByRole('heading', { name: 'Cambios', exact: true })).toBeVisible();

  await page.goto('/es/mapa/');
  await expect(page.getByRole('heading', { name: 'Mapa del cliente', exact: true })).toBeVisible();
  await expect(page.getByTestId('map-explorer')).toBeVisible();
  await expect(page.getByText('119 marcadores extraídos de Minimap.flags.')).toBeVisible();
  await expect(page.locator('.map-base-layer')).toHaveAttribute('data-base-loaded', 'true');
  await expect(page.locator('.map-base-layer')).toHaveAttribute('style', /floor-7\.png/);
  await expect(page.getByTestId('map-layer-Other client flag')).toBeVisible();
  await page.getByRole('button', { name: 'Piso 1' }).click();
  await expect(page.getByRole('region', { name: /Piso 1/ })).toBeVisible();
  await expect(page.locator('.map-base-layer')).toHaveAttribute('style', /floor-1\.png/);
  await expect(page.getByTestId('map-zoom-level')).toHaveText('100%');
  await page.getByTestId('map-zoom-in').click();
  await expect(page.getByTestId('map-zoom-level')).toHaveText('125%');
  await page.getByTestId('map-center').click();
  await expect(page.getByTestId('map-zoom-level')).toHaveText('100%');
  await page.getByTestId('map-layer-Poke Mart').click();
  await expect(page.getByTestId('map-layer-Poke Mart')).toHaveAttribute('aria-pressed', 'false');
  await page.locator('.map-marker').first().click();
  await expect(page.getByTestId('map-explorer').getByText('flagId', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: /Aportar al mapa/ }).click();
  await expect(page.getByRole('heading', { name: 'Aportar al mapa', exact: true })).toBeVisible();
  await expect(page.getByText('pending_review', { exact: true })).toBeVisible();
});
