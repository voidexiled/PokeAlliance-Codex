import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { es } from '../../src/i18n/messages/es';
import { freezeClock, stubRemoteArt } from './routes';

// The lab metrics of §13.6 — LCP, page CLS, grid CLS and INP — over the Vercel
// output served by the emulator of §14.3 (the `prod` project). The static
// budgets of the same section are measured without a browser, in
// scripts/perf/check-budgets.mjs.

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** §13.6: network and CPU profile of the measurement. */
const RED = {
  latencyMs: 150,
  bajadaBytesPorSegundo: (1.6 * 1000 * 1000) / 8,
  subidaBytesPorSegundo: (750 * 1000) / 8,
};
const CPU_THROTTLING = 4;

/** §13.6: the two viewports of the measurement. */
const VENTANAS = [
  { nombre: '1440', width: 1440, height: 900 },
  { nombre: '390', width: 390, height: 844 },
];

const UMBRAL = {
  lcpMs: 2500,
  clsPagina: 0.02,
  clsRejilla: 0,
  inpMs: 200,
};

/** §13.6, «Páginas». The Guild route is measured with its export already imported. */
const PAGINAS = [
  { id: 'inicio', ruta: '/es/' },
  { id: 'pokedex', ruta: '/es/pokedex/' },
  { id: 'ficha', ruta: '/es/pokedex/charizard/' },
  { id: 'comercio', ruta: '/es/comercio/' },
  {
    id: 'guild',
    ruta: '/es/herramientas/guild/',
    fixture: 'tests/fixtures/guild-export.sample.json',
  },
  { id: 'comparar', ruta: '/es/herramientas/pokemon/' },
];

/** §13.6 and PR4: the two first-render-with-state cases of the Pokédex. */
const PRIMER_RENDER = [
  {
    id: 'vista-guardada',
    ruta: '/es/pokedex/',
    almacenamiento: { clave: 'ac:vista:pokedex', valor: 'slots' },
  },
  { id: 'url-con-estado', ruta: '/es/pokedex/?view=list&page=2' },
];

/** V8: the containers whose layout shifts have to be exactly zero. */
const REJILLAS = '[data-card-grid],[data-slots],[data-list]';

type Desplazamiento = { valor: number; tiempo: number; enRejilla: boolean };
type Medidas = { lcp: number; desplazamientos: Desplazamiento[]; eventos: number[] };

declare global {
  interface Window {
    __acPerf: Medidas;
  }
}

// --- instrumentation. Installed before any script of the page, so the three
// observers see the entries of the first paint.

function observadores(selectorRejillas: string): void {
  const medidas: Medidas = { lcp: 0, desplazamientos: [], eventos: [] };
  window.__acPerf = medidas;

  new PerformanceObserver((lista) => {
    for (const entrada of lista.getEntries())
      medidas.lcp = Math.max(medidas.lcp, entrada.startTime);
  }).observe({ type: 'largest-contentful-paint', buffered: true });

  type Fuente = { node?: Node | null };
  type Salto = PerformanceEntry & {
    value: number;
    hadRecentInput: boolean;
    sources?: Fuente[];
  };
  new PerformanceObserver((lista) => {
    for (const entrada of lista.getEntries()) {
      const salto = entrada as Salto;
      if (salto.hadRecentInput) continue;
      const enRejilla = (salto.sources ?? []).some((fuente) => {
        const nodo = fuente.node ?? null;
        const elemento =
          nodo instanceof Element ? nodo : nodo instanceof Node ? nodo.parentElement : null;
        return Boolean(elemento?.closest(selectorRejillas));
      });
      medidas.desplazamientos.push({ valor: salto.value, tiempo: salto.startTime, enRejilla });
    }
  }).observe({ type: 'layout-shift', buffered: true });

  new PerformanceObserver((lista) => {
    for (const entrada of lista.getEntries()) medidas.eventos.push(entrada.duration);
  }).observe({
    type: 'event',
    buffered: true,
    durationThreshold: 16,
  } as PerformanceObserverInit & { durationThreshold: number });
}

/** §13.6: CLS is the worst session window (1 s gap, 5 s long) up to `corteMs`. */
function clsDeSesion(desplazamientos: Desplazamiento[], corteMs: number): number {
  const dentro = desplazamientos
    .filter((salto) => salto.tiempo <= corteMs)
    .sort((a, b) => a.tiempo - b.tiempo);
  let peor = 0;
  let ventana = 0;
  let inicio = 0;
  let ultimo = 0;
  for (const salto of dentro) {
    if (ventana > 0 && (salto.tiempo - ultimo > 1000 || salto.tiempo - inicio > 5000)) {
      peor = Math.max(peor, ventana);
      ventana = 0;
    }
    if (ventana === 0) inicio = salto.tiempo;
    ventana += salto.valor;
    ultimo = salto.tiempo;
  }
  return Math.max(peor, ventana);
}

async function prepararPagina(page: Page): Promise<void> {
  // The two per-page setups of §14.3. This spec calls them itself instead of taking
  // them from tests/e2e/fixtures.ts, because it also has to install its observers
  // through `addInitScript` and throttle the session before the first navigation.
  await stubRemoteArt(page);
  await freezeClock(page);
  await page.addInitScript(observadores, REJILLAS);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: RED.latencyMs,
    downloadThroughput: RED.bajadaBytesPorSegundo,
    uploadThroughput: RED.subidaBytesPorSegundo,
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLING });
}

/** Waits for the window §13.6 measures CLS in: `document.fonts.ready` + 2 s. */
async function esperarCorte(page: Page): Promise<number> {
  const fuentesListas = await page.evaluate(async () => {
    await document.fonts.ready;
    return performance.now();
  });
  await page.waitForTimeout(2000);
  return fuentesListas + 2000;
}

async function leerMedidas(page: Page): Promise<Medidas> {
  return page.evaluate(() => ({
    lcp: window.__acPerf.lcp,
    desplazamientos: window.__acPerf.desplazamientos,
    eventos: window.__acPerf.eventos,
  }));
}

/** Max `PerformanceEventTiming.duration` of one interaction (§13.6, INP). */
async function medirInp(page: Page, accion: () => Promise<void>): Promise<number> {
  await page.evaluate(() => {
    window.__acPerf.eventos.length = 0;
  });
  await accion();
  await page.waitForTimeout(500);
  const duraciones = await page.evaluate(() => window.__acPerf.eventos);
  return duraciones.length === 0 ? 0 : Math.max(...duraciones);
}

/** Clears the shift log, runs `accion` and watches the grids for 2 s (§13.6). */
async function saltosTrasAccion(
  page: Page,
  accion: () => Promise<void>,
): Promise<Desplazamiento[]> {
  await page.evaluate(() => {
    window.__acPerf.desplazamientos.length = 0;
  });
  await accion();
  await page.waitForTimeout(2000);
  const medidas = await leerMedidas(page);
  return medidas.desplazamientos;
}

// The throttled profile of §13.6 only measures what it should when nothing
// else runs beside it, so this file opts out of `fullyParallel`.
test.describe.configure({ mode: 'default' });

for (const ventana of VENTANAS) {
  test.describe(`rendimiento a ${ventana.nombre}`, () => {
    test.use({ viewport: { width: ventana.width, height: ventana.height } });

    for (const pagina of PAGINAS) {
      // The skip sits here, not in the body, so another browser costs no page:
      // Playwright decides it before it builds the `page` fixture.
      test.describe(pagina.id, () => {
        test.skip(
          ({ browserName }) => browserName !== 'chromium',
          'El perfil de red y CPU de §13.6 necesita CDP.',
        );

        test('LCP, CLS, CLS en rejillas e INP', async ({ page }) => {
          test.setTimeout(180_000);

          await prepararPagina(page);
          await page.goto(pagina.ruta, { waitUntil: 'load' });

          // The Guild route is measured with its export already imported (§13.6): «Importar»
          // of the empty state, the file in «Importar export», and a reload that paints it from
          // the browser workspace (M13).
          if (pagina.fixture) {
            await page.getByRole('button', { name: es.guild.emptyAction, exact: true }).click();
            const dialogo = page.getByRole('dialog');
            await dialogo.locator('input[type=file]').setInputFiles(resolve(ROOT, pagina.fixture));
            await dialogo
              .getByRole('button', { name: es.guild.importDialog.submit, exact: true })
              .click();
            await expect(page.locator('h1').first()).not.toHaveText(es.guild.title);
            await page.reload({ waitUntil: 'load' });
          }

          const corte = await esperarCorte(page);
          const medidas = await leerMedidas(page);

          // `medidas.lcp` starts at 0, so the strictest budget of §13.6 would pass on
          // its own if the observer never fired or `addInitScript` stopped running. A
          // page that paints anything has an LCP candidate: no entry means the
          // instrumentation broke, not that the page was instant.
          expect(medidas.lcp, 'se observó un LCP').toBeGreaterThan(0);
          expect(medidas.lcp, 'LCP').toBeLessThanOrEqual(UMBRAL.lcpMs);
          expect(clsDeSesion(medidas.desplazamientos, corte), 'CLS de página').toBeLessThanOrEqual(
            UMBRAL.clsPagina,
          );
          expect(
            medidas.desplazamientos.filter((salto) => salto.enRejilla && salto.tiempo <= corte),
            'saltos dentro de una rejilla',
          ).toHaveLength(UMBRAL.clsRejilla);

          // --- INP. Each interaction runs only where §13.6 puts it.
          const paleta = await medirInp(page, async () => {
            await page.keyboard.press('Control+KeyK');
            await page.keyboard.press('Escape');
          });
          expect(paleta, 'INP de la paleta con Ctrl + K').toBeLessThanOrEqual(UMBRAL.inpMs);

          const disparador = page
            .locator('a[aria-describedby], button[aria-describedby]')
            .filter({ visible: true })
            .first();
          if ((await disparador.count()) > 0) {
            const tooltip = await medirInp(page, async () => {
              await disparador.focus();
            });
            expect(tooltip, 'INP del tooltip con foco').toBeLessThanOrEqual(UMBRAL.inpMs);
          }

          const menu = page.locator('button[aria-controls="menu-movil"]').first();
          if (ventana.width < 1280 && (await menu.count()) > 0) {
            const movil = await medirInp(page, async () => {
              await menu.click();
            });
            expect(movil, 'INP del menú móvil').toBeLessThanOrEqual(UMBRAL.inpMs);
            await page.keyboard.press('Escape');
          }

          const slots = page.getByRole('button', { name: 'Slots', exact: true }).first();
          const lista = page.getByRole('button', { name: /^(Lista|List)$/ }).first();
          if ((await slots.count()) > 0) {
            const vista = await medirInp(page, async () => {
              await slots.click();
            });
            expect(vista, 'INP del cambio de vista').toBeLessThanOrEqual(UMBRAL.inpMs);
            // §13.6: the grids are watched again for 2 s after each view change.
            expect(
              (await saltosTrasAccion(page, () => lista.click())).filter(
                (salto) => salto.enRejilla,
              ),
              'saltos en rejilla al pasar a Lista',
            ).toHaveLength(UMBRAL.clsRejilla);
          }

          const filtro = page.getByRole('button', { name: 'Shiny', exact: true }).first();
          if ((await filtro.count()) > 0) {
            const cambio = await medirInp(page, async () => {
              await filtro.click();
            });
            expect(cambio, 'INP del cambio de filtro').toBeLessThanOrEqual(UMBRAL.inpMs);
          }

          const siguiente = page.getByRole('link', { name: /^(Siguiente|Next)$/ }).first();
          if ((await siguiente.count()) > 0) {
            expect(
              (await saltosTrasAccion(page, () => siguiente.click())).filter(
                (salto) => salto.enRejilla,
              ),
              'saltos en rejilla al cambiar de página',
            ).toHaveLength(UMBRAL.clsRejilla);
          }
        });
      });
    }

    for (const caso of PRIMER_RENDER) {
      test.describe(`primer render con estado: ${caso.id}`, () => {
        test.skip(
          ({ browserName }) => browserName !== 'chromium',
          'El perfil de red y CPU de §13.6 necesita CDP.',
        );

        test('PR4 y los umbrales de carga', async ({ page }) => {
          test.setTimeout(180_000);

          await prepararPagina(page);
          if (caso.almacenamiento) {
            const { clave, valor } = caso.almacenamiento;
            await page.addInitScript(
              ([k, v]) => {
                try {
                  window.localStorage.setItem(k, v);
                } catch {
                  // PR4 reads and writes the saved view inside try/catch too.
                }
              },
              [clave, valor],
            );
          }
          await page.goto(caso.ruta, { waitUntil: 'load' });

          // PR4: while the root is pending nothing of the default state is painted.
          const pendiente = page.locator('[data-ac-pending]').first();
          if (await pendiente.isVisible().catch(() => false)) {
            expect(
              await pendiente.locator('article').filter({ visible: true }).count(),
              'tarjetas visibles del estado por defecto mientras hay data-ac-pending',
            ).toBe(0);
          }
          await expect(page.locator('[data-ac-pending]')).toHaveCount(0, { timeout: 30_000 });

          const corte = await esperarCorte(page);
          const medidas = await leerMedidas(page);

          // `medidas.lcp` starts at 0, so the strictest budget of §13.6 would pass on
          // its own if the observer never fired or `addInitScript` stopped running. A
          // page that paints anything has an LCP candidate: no entry means the
          // instrumentation broke, not that the page was instant.
          expect(medidas.lcp, 'se observó un LCP').toBeGreaterThan(0);
          expect(medidas.lcp, 'LCP').toBeLessThanOrEqual(UMBRAL.lcpMs);
          expect(clsDeSesion(medidas.desplazamientos, corte), 'CLS de página').toBeLessThanOrEqual(
            UMBRAL.clsPagina,
          );
          expect(
            medidas.desplazamientos.filter((salto) => salto.enRejilla && salto.tiempo <= corte),
            'saltos dentro de una rejilla',
          ).toHaveLength(UMBRAL.clsRejilla);
        });
      });
    }
  });
}
