# Plan de implementación del Corte 0

**Estado:** plan de ejecución del rediseño especificado en [`docs/CORTE_0_CODEX_TOOLTIP_SPEC.md`](CORTE_0_CODEX_TOOLTIP_SPEC.md) (v2, 4.368 líneas). No añade ni cambia ninguna decisión: si este plan y la especificación se contradicen, manda la especificación.
**Fecha:** 2026-09-19 (revisión 2).
**Para qué sirve:** dividir el corte en hitos que un flujo de agentes ejecuta **de uno en uno**, cada uno de 5 a 12 agentes y cada uno entregable (el sitio arranca, `pnpm build` pasa y no hay regresión visible respecto al hito anterior).

## Cómo se lee

- **Alcance exacto:** cada hito lista los archivos que **crea**, **cambia** y **borra**. Un agente no toca ningún archivo fuera de esa lista. Si necesita otro, para y lo reporta.
- **Paralelo:** los carriles (A, B, C…) de un hito tienen conjuntos de archivos **disjuntos** y se lanzan a la vez. Los carriles marcados «serie» esperan al carril del que dependen dentro del mismo hito. Un archivo que cambian varios carriles pertenece a **un solo** carril, que es el que lo integra.
- **Aceptación:** son comandos. Un hito no cierra hasta que todos salen con código 0. Un hito **nunca** cita en su aceptación un archivo de prueba, un proyecto de Playwright o un script que cree un hito posterior. Los criterios `S1`–`S22`, `V*`, `C7-*`, `WG/WA/WL/WD`, `CA-9.x`, `CA-10.x` y `CA-11.x` son los de la especificación; la tabla «Criterios por fase» de §2 dice cuáles exige cada fase.
- **Rutas migradas.** `scripts/lib/rutas-migradas.mjs` (M2) es la única lista de rutas ya migradas a `PageLayout`. La leen `design:check`, `check-dist.mjs`, `check-budgets.mjs`, `check-dist.mjs` de SEO y `tests/e2e/routes.ts`. Una ruta que todavía usa `AppLayout` queda fuera de esas compuertas hasta el hito que la migra (§3.11 lo autoriza durante los pasos 1 a 3 de §3.10). Cada hito que migra una ruta añade su entrada en el carril que la migra.
- **Reglas de casa (valen para todo hito):** nunca `git commit`, `git push` ni despliegue; nunca se aplica una migración de Supabase en remoto; el árbol de trabajo sin commit del propietario se conserva; el idioma de la documentación y de los textos es español e inglés según §13.
- **Fases de la especificación:** F0 base, F1 componentes, F2 wiki, F3 Comercio, F4 Guild, cierre, F5 Comparar (§0).

---

## 1. Bloques de comandos reutilizables

Se citan por su id en la aceptación de cada hito. Todos se ejecutan desde la raíz del repositorio.

**G0 — Compuerta base.** Desde M2 equivale a `pnpm ci` (§14.1); en M1 los cuatro últimos comandos aún no existen y se omiten:

```
pnpm content:check
node scripts/design/tokens.mjs --check
pnpm design:check
pnpm format:check
pnpm lint
pnpm check
pnpm i18n:check
pnpm test
pnpm build
node scripts/design/check-dist.mjs
pnpm perf:budget
pnpm seo:check
```

`design:check`, `check-dist.mjs`, `perf:budget` y `seo:check` se limitan a las rutas y archivos de `scripts/lib/rutas-migradas.mjs`. Sin ese recorte fallarían desde el primer hito: el HTML de la Pokédex actual mide 519.525 B contra un límite de 450.000 B y la hoja compartida mide 203.705 B contra 100.000 B (§13.6, §3.1). En M15 la lista pasa a «todas» y el recorte desaparece.

**G1 — End-to-end** (§14.3):

```
pnpm test:e2e
```

Por proyecto, cuando un hito solo toca una superficie:

```
pnpm exec playwright test --project=desktop <spec>
pnpm exec playwright test --project=mobile --project=webkit-mobile <spec>
pnpm exec playwright test --project=reduced-motion tests/e2e/motion.spec.ts
pnpm exec playwright test --project=prod tests/e2e/prod.spec.ts tests/e2e/perf.spec.ts tests/e2e/seo.spec.ts tests/e2e/links.spec.ts tests/e2e/money.spec.ts
```

**G2 — Accesibilidad** (S12, S13, S14; axe con `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`, 0 violaciones `serious` o `critical`):

```
pnpm exec playwright test --project=desktop --project=mobile tests/e2e/a11y.spec.ts tests/e2e/keyboard.spec.ts tests/e2e/contract.spec.ts
```

**G3 — Sin relleno y sin procedencia** (S10, §12.19, §12.22):

```
pnpm exec vitest run tests/i18n/forbidden.test.ts
pnpm exec playwright test tests/e2e/content-sentinel.spec.ts
pnpm content:check
rg -n --no-heading -e "\"(fuente|fuentes|source|sources|evidencia|verificado|verificadoEl|obtenidoEl)\"\s*:" content src/lib/content
rg -n --no-heading -e "\bKKs?\b" -e "\bgold\b" -e "\bTODO\b" src
```

Las dos últimas líneas deben devolver **0 coincidencias** (código 1 de `rg`) en el alcance que cada hito declare. La procedencia **no** se busca como palabra suelta: «verificado» es vocabulario del producto en Comercio («contacto verificado», R6, R13) y «fuente» es la palabra española de *font* (§3.9). El barrido real son los esquemas cerrados de `content/schemas/`, la comprobación de claves de `pnpm content:check` (§12.19) y el centinela de §12.22.

**G4 — Visual contra los tableros aprobados** (§14.5). Desde M2, con el arnés versionado en `design/render/`:

```
pnpm test:visual
```

**Tolerancias de comparación (§14.5, no se relajan):** geometría |Δx|, |Δy|, |Δw|, |Δh| ≤ 1 px y `maxSpread` 0 por rejilla; recortes con `threshold: 0.15` y ≤ 1 % de píxeles distintos (≤ 0,5 % en recortes de `/_paridad/`); página completa ≤ 2 %; líneas base propias de 390 px ≤ 0,1 %. Anchos de captura: **1440 × 900** (tableros `Main`, `Pokedex`, `Pokedex-Shiny-Charizard`, `Sistema-Boost`, `Comercio`, `Guild`, `Componentes`, `Tarjetas`) y **390 × 844** (`Inicio-movil` y las líneas base del resto).

Para medir un tablero fuera del arnés (diagnóstico, no aceptación), `$ARNES` = `C:/Users/jalom/AppData/Local/Temp/claude/C--Users-jalom-Documents-ChatGPT-PokeAlliance-Codex/ad16e56a-0cd4-433d-aab8-9015e990e27d/scratchpad/design/render/render.mjs`:

```
node "$ARNES" <tablero> --state '{"tip":null}' --selector "<css>" --measure <json> --scale 1
```

**G5 — Presupuestos y rendimiento** (§13.6):

```
pnpm perf:budget
pnpm exec playwright test --project=prod tests/e2e/perf.spec.ts
```

---

## 2. Tabla de hitos

| Id | Título | Fase | Depende de | Agentes |
|---|---|---|---|---|
| M1 | Base de tokens, CSS, fuentes, formatos, diccionarios, datos y alias `@content` | F0 | — | 9 |
| M2 | Arnés de pruebas, compuertas, emulador de Vercel y CI | F0 | M1 | 10 |
| M3 | Marco: `PageLayout`, cabecera, barra lateral, hoja móvil, rail, pie y paleta Ctrl + K | F1 | M2 | 10 |
| M4 | Capa de juego: `Sprite`, `GameTooltip`, `NestedEntity` y entidades | F1 | M3 | 9 |
| M5 | Controles y contenido del sistema de diseño (`/_paridad/componentes/`) | F1 | M4 | 11 |
| M6 | Tarjetas, rejillas, tres vistas, dinero y **compuerta de presupuesto** (cierre F1) | F1 | M5 | 11 |
| M7 | Pokédex: índice y ficha de Pokémon | F2 | M6 | 10 |
| M8 | Sistemas: registro, índice y página de sistema | F2 | M6 | 8 |
| M9 | Ítems por categoría del Market y Tier list | F2 | M7, M8 | 9 |
| M10 | Inicio y Buscar | F2 | M7, M8 | 9 |
| M11 | Cambios, Actividades, Herramientas, Mapa, 404, raíz y marcador de Comparar | cierre F2 | M9, M10 | 10 |
| M12 | Comercio fase A: lista, detalle, publicar y perfil con datos de ejemplo | F3 | M11 | 11 |
| M13 | Cuenta y Guild: `/{l}/cuenta/` y analítica de administración | F4 | M11 | 12 |
| M14 | Comercio fase B: Supabase local, verificación, operaciones, reseñas y moderación | F3 | M12, M13 | 10 |
| M15 | Cierre del corte: borrado de CSS y componentes viejos, dependencias y documentación | cierre | M14 | 7 |
| M16 | Comparar Pokémon | F5 | M15 + tablero aprobado (OG-11) | 7 |

**Camino crítico:** M1 → M2 → M3 → M4 → M5 → M6 → M7/M8 → M9/M10 → M11 → M12 → M13 → M14 → M15. M16 no bloquea el cierre (E18).

**Por qué la cadena de F1 es serie y no paralela.** M3, M4, M5 y M6 escriben los mismos tres archivos de integración: `src/layouts/PageLayout.astro` (marco, `SpriteStyles`, bloque de scripts), `src/styles/global.css` (un `@import` por archivo de `src/styles/components/`, en el orden de `bundle.css`) y `scripts/lib/rutas-migradas.mjs`. Dos hitos a la vez sobre esos archivos se pisan.

**Por qué Guild va antes que la fase B de Comercio.** `/{locale}/cuenta/` es una sola página: su `Section` «Guilds» es de Guild (§10.4) y existe en cuanto Supabase está configurado; la fase B de Comercio le **añade** teléfono, perfil y canales (§9.3). M13 la crea con la parte de Guild y M14 la extiende. Ejecutarlos a la vez sería escribir el mismo archivo desde dos hitos.

---

## M1 — Base de tokens, CSS, fuentes, formatos, diccionarios, datos y alias `@content`

**Objetivo.** Construir la base de §3, §4 y §13.2–§13.3 sin cambiar ni un píxel del sitio actual: los cinco CSS de hoy se apartan a `src/styles/legacy/` y siguen sirviendo a `AppLayout`. Al terminar existen la hoja nueva, el generador de tokens, los formateadores, los diccionarios, las reglas de `pnpm design:check` y el alias `@content` que §14.5 necesita para los datos de paridad.

**Crear**

- `src/design/tokens.json` — copia byte a byte de `tokens.json` del sistema de diseño (110 tokens) más los 10 tokens de §3.3 (grupo `motion`, `z-header`, `layout-main-max`).
- `scripts/design/tokens.mjs` (genera y `--check`), `scripts/design/check.mjs` (11 reglas de §3.11), `scripts/design/check-dist.mjs`.
- Generados: `src/styles/tokens.css` (§3.4), `src/styles/theme.css` (§3.5), `src/lib/design/tokens.ts`.
- `src/styles/global.css` **nuevo** (§3.6, entrada única), `src/styles/base.css`, `src/styles/fonts.css`, `src/styles/motion.css`, directorio vacío `src/styles/components/`.
- `src/assets/fonts/poppins-latin-500-normal.woff2`, `poppins-latin-600-normal.woff2`, `OFL.txt` (§3.9).
- `src/lib/format/` — `numbers.ts` (`formatInteger`, `formatPokedolares`, `parsePokedolares`, `formatDiamonds`, `formatPercent`, `formatRating`, `formatMoney`), `dates.ts`, `unknown.ts` (§4.3, §4.4, §13.3).
- `src/i18n/messages/es.ts`, `src/i18n/messages/en.ts`, `src/i18n/messages/types.ts` (`MessageTree`, `fill`, `plural`), `src/i18n/dynamic-keys.ts`; `scripts/i18n/check.mjs`.
- Pruebas: `tests/format/numbers.test.ts`, `tests/format/dates.test.ts`, `tests/format/unknown.test.ts`, `tests/i18n/messages.test.ts`, `tests/i18n/forbidden.test.ts`, `tests/i18n/alternate-path.test.ts`, `tests/design/tokens.test.ts` (V3-1, V3-2, V3-3, V3-7).

**Cambiar**

- Mover a `src/styles/legacy/`: `global.css`, `wiki-reference.css`, `home.css`, `trade.css`, `guides.css` (10.151 líneas, medidas) y actualizar sus **cinco** imports: `src/layouts/AppLayout.astro:2-3`, `src/pages/[locale]/index.astro:3`, `src/pages/[locale]/comercio/index.astro:9`, `src/pages/[locale]/guias/index.astro:3` (§3.10 paso 1). El movimiento ocurre **antes** de crear la hoja nueva: las dos rutas se llaman `src/styles/global.css`.
- **Alias `@content` (§14.5).** `astro.config.mjs` y `vitest.config.ts` declaran `vite.resolve.alias` `@content` → `content/`, y `src/lib/content/repository.ts` y `src/lib/content/registry.ts` pasan de `'../../../content/…'` a `'@content/…'`. `registry.ts:58` usa `import.meta.glob('../../../content/items/*.json')`: si el patrón con alias no resuelve, el carril lo sustituye por un mapa explícito de las 14 rutas de `content/items/*.json` (`categorias`, `diamantes`, `pokemon`, `poke-balls`, `stones`, `helds`, `orbs`, `creature-items`, `general-items`, `utilities`, `addons`, `consumable`, `foods`, `furnitures`), que es lo único que hace falta para que `VISUAL=1` pueda apuntarlo a `tests/visual/content/`.
- `package.json`: `design:tokens`, `design:check`, `i18n:check`. `ci` pasa a `pnpm content:check && pnpm design:check && pnpm format:check && pnpm lint && pnpm check && pnpm i18n:check && pnpm test && pnpm build && node scripts/design/check-dist.mjs`; M2 le añade `perf:budget` y `seo:check` cuando esos scripts existen, y M2 cambia `preview`. Dependencias: `@floating-ui/dom` 1.8.0 y `@astrojs/sitemap`; desarrollo `@axe-core/playwright`, `pixelmatch`, `pngjs`, `@playwright/test` fijado a `1.63.0`.
- `src/i18n/config.ts`: se conservan `locales`, `localeLabels`, `isLocale`, `getLocale`, `getAlternateLocale`; se añade `getAlternatePath`. `localeCopy` y `localeLabels` siguen mientras exista `AppLayout.astro` (su único consumidor, verificado): se borran en M15.
- `vitest.config.ts`: pasa a `getViteConfig({ test: {…} })` de `astro/config` con `include: ['tests/**/*.test.{ts,tsx}']` (§14.2), más el alias `@content`.
- `tests/time/server-save.test.ts`: se amplía con la próxima medianoche de `America/Sao_Paulo` antes y después de las 00:00, desde UTC−6 y UTC+9, sin Temporal (§14.2).
- `content/schemas/*.json`: se cierran a claves de procedencia (§12.19); `scripts/content/lib/check-content.mjs` falla con `fuente`, `fuentes`, `source`, `sources`, `evidencia`, `verificado`, `verificadoEl`, `obtenidoEl` como **clave** de cualquier registro.
- `.prettierignore` y `eslint.config.js`: ignorar los tres archivos generados; `no-restricted-imports` para `lucide-react`, `@base-ui/react`, `class-variance-authority`, `cn`, `tw-animate-css` fuera de sus consumidores legados.

**Borrar.** Nada (el borrado es el paso 4 de §3.10, en M15).

**Dependencias.** Ninguna. Es el primer hito.

**Paralelo (carriles disjuntos)**

| Carril | Archivos |
|---|---|
| A | `src/design/tokens.json`, `scripts/design/tokens.mjs`, los tres generados |
| B (serie tras A) | `scripts/design/check.mjs`, `scripts/design/check-dist.mjs`, `tests/design/tokens.test.ts` |
| C | mover los cinco CSS a `legacy/` y sus cinco imports |
| D (serie tras C) | `src/styles/global.css` nuevo, `base.css`, `motion.css`, `src/styles/components/` |
| E | `src/assets/fonts/*`, `src/styles/fonts.css` |
| F | `src/lib/format/*`, `tests/format/*`, `tests/time/server-save.test.ts` |
| G | `src/i18n/messages/*`, `dynamic-keys.ts`, `scripts/i18n/check.mjs`, `tests/i18n/*`, `src/i18n/config.ts` |
| H | `astro.config.mjs`, `vitest.config.ts`, `src/lib/content/repository.ts`, `src/lib/content/registry.ts` (alias `@content`) |
| I | `package.json`, `eslint.config.js`, `.prettierignore`, `content/schemas/*`, `scripts/content/lib/check-content.mjs` |

**Aceptación**

```
node scripts/design/tokens.mjs && node scripts/design/tokens.mjs --check
pnpm design:check
pnpm i18n:check
pnpm content:check
pnpm exec vitest run tests/format tests/i18n tests/design tests/time tests/content
pnpm format:check && pnpm lint && pnpm check && pnpm test && pnpm build
pnpm exec playwright test tests/e2e/smoke.spec.ts
rg -n --no-heading -e "\.\./\.\./\.\./content/" src/lib/content
```

- La última línea devuelve **0 coincidencias**: `repository.ts` y `registry.ts` leen por `@content`.
- V3-1 a V3-3 y V3-7 en verde (`tests/design/tokens.test.ts`): `--radius-12` es `12px`; `bg-primary`, `text-quinary`, `border-selected`, `shadow-ring-selected`, `rounded-11`, `type-tt-title`, `md:flex`, `xl:grid` generan CSS y `text-sm`, `font-bold`, `rounded-lg`, `shadow-sm`, `sm:flex`, `lg:flex`, `bg-red-500` no.
- S8 y S9 (tablas de `DS:guias/40` y §13.3 en `es` y `en`) pasan en `tests/format/`.
- **Sin cambio visual:** el `smoke.spec.ts` actual sigue en verde con la configuración de Playwright actual y el diff del HTML de `/es/` y `/es/pokedex/` antes y después del hito es vacío salvo las rutas de los CSS movidos.

**Riesgos**

1. **Dos entradas de Tailwind conviven** (`src/styles/legacy/global.css` y la nueva `src/styles/global.css`) hasta M15. El reinicio `--*: initial` de `@theme static` solo afecta a la nueva. Mitigación: ninguna ruta carga las dos (§3.10 paso 3) y `check-dist.mjs` comprueba «una hoja por página» sobre las rutas migradas.
2. **Reparto `@theme static` / `@layer theme`**: un token mal clasificado crea una utilidad de Tailwind con el nombre de un token (`text-primary` como tamaño de letra). Lo detecta V3-3; el reparto exacto está en la tabla de §3.4.
3. **El alias en `import.meta.glob`.** Es el punto técnico del hito: si Vite no resuelve el alias dentro del patrón, todo el build de paridad de §14.5 se queda sin datos. Por eso el carril H tiene el mapa explícito como salida, y su aceptación es un build con `@content` apuntado a un directorio de prueba.
4. `--spacing: 1px` cambia el significado de toda utilidad numérica (`p-16` = 16 px). Solo aplica a la hoja nueva; ningún componente legado usa utilidades de la hoja nueva.
5. El subconjunto latin de Poppins (§3.9) no cubre un carácter de un registro futuro: cae a Verdana, no rompe. `unicode-range` copiado literal de `@fontsource/poppins` 5.3.0.

---

## M2 — Arnés de pruebas, compuertas, emulador de Vercel y CI

**Objetivo.** Poner en pie **todo** lo que mide, antes de construir nada que haya que medir: proyectos de Playwright, emulador de la salida de Vercel, las specs de §14.3, el arnés visual versionado con sus goldens, los presupuestos y las comprobaciones de SEO. Sin este hito, la aceptación de los hitos de F1 cita archivos que no existen.

**Crear**

- `scripts/lib/rutas-migradas.mjs` — lista única de rutas migradas a `PageLayout` y de archivos excluidos de §3.11 mientras dure la migración. Arranca vacía salvo las rutas `/_paridad/*`.
- `scripts/test/serve-vercel-output.mjs` — emulador del subconjunto de la Build Output API v3 de §14.3: recorre `routes` en orden, aplica `headers` y `continue`, responde las 3xx con `Location`, sirve `static/` con `{ "handle": "filesystem" }`, importa `functions/<dest>.func/` según su `.vc-config.json` y responde con `default.fetch(request)`; **falla al arrancar** nombrando cualquier propiedad de ruta que no conozca (`has`, `missing`, `check`, `middlewarePath`).
- `scripts/perf/check-budgets.mjs` (§13.6), `scripts/seo/check-dist.mjs` (§13.5). Los dos leen `rutas-migradas.mjs`.
- `tests/e2e/routes.ts` — genera la lista de rutas de prueba de §14.4 desde `.vercel/output/static/**` recortada por `rutas-migradas.mjs`, con la muestra fija de seis fichas (`charizard`, `shiny-charizard`, `mime-jr`, `unown-a`, `smeargle`, `shiny-mimikyu`) y las dos 404.
- Specs de §14.3, escritas contra `routes.ts` para que crezcan solas: `tests/e2e/a11y.spec.ts`, `keyboard.spec.ts`, `contract.spec.ts`, `content-sentinel.spec.ts`, `i18n.spec.ts`, `motion.spec.ts`, `links.spec.ts`, `seo.spec.ts`, `prod.spec.ts`, `money.spec.ts`, `perf.spec.ts`.
- `design/boards/` — los nueve `*.dc.html` y `canvas.json` del proyecto `canvas-v2/project`.
- `design/render/` — `render.mjs`, `design-type/artifact-type/dc-runtime.js`, `blobs/` y `blob-map.json` **reescrito a rutas relativas**.
- `tests/visual/manifest.json` (única lista de casos; arranca sin casos de sitio), `tests/visual/compare.ts` (`pixelmatch` y `pngjs`), `tests/visual/goldens/`, `tests/visual/baselines/`, `tests/visual/content/`, `tests/visual/fixtures/` (exportados una sola vez desde `canvas-v2/gen/*.py`).
- `scripts/visual/run.mjs`, `scripts/visual/goldens.mjs`.

**Cambiar**

- `playwright.config.ts`: `webServer` como lista (desarrollo con `COMERCIO_DEMO=1` + salida de Vercel) y los proyectos `desktop`, `mobile`, `webkit-mobile`, `reduced-motion`, `prod` y `visual` (§14.3); `retries: 0` en `visual` y `perf`; `page.route('https://wiki.pokealliance.com/**')` y reloj fijo en `2026-09-18T17:32:00Z`.
- `tests/e2e/smoke.spec.ts`: deja de buscar `#main-content` (`:20`, `:447`, `:559`) y pasa a recorrer `routes.ts`; mientras la lista de migradas esté vacía, recorre las rutas actuales (§14.3). M11 lo completa con conteos y vistas.
- `astro.config.mjs`: build visual con `VISUAL=1` (alias `@content` a `tests/visual/content/`, `injectRoute` de `/_paridad/*` desde `src/routes/_paridad/`, `noindex` global, fixture de Comercio); `devToolbar: { enabled: false }`.
- `package.json`: `perf:budget`, `seo:check`, `test:visual`, `visual:goldens`; `preview` pasa a `node scripts/test/serve-vercel-output.mjs --port 4322`; `ci` se completa con `pnpm perf:budget && pnpm seo:check`; `test:e2e` pasa a `playwright test --project=desktop --project=mobile --project=webkit-mobile --project=reduced-motion --project=prod`.
- `.github/workflows/ci.yml`: trabajos `quality`, `browser` (añade `webkit` a `playwright install`) y `visual` (`windows-latest`) de §14.6.
- `scripts/test/start-astro.ps1`: se borra (el contenedor de Playwright no trae `pwsh`, §14.3).

**Borrar.** `scripts/test/start-astro.ps1`.

**Dependencias.** M1.

**Paralelo**

| Carril | Archivos |
|---|---|
| A | `scripts/lib/rutas-migradas.mjs` |
| B | `scripts/test/serve-vercel-output.mjs` |
| C (serie tras B) | `playwright.config.ts`, `tests/e2e/routes.ts`, `tests/e2e/smoke.spec.ts` |
| D (serie tras C) | `prod.spec.ts`, `seo.spec.ts`, `links.spec.ts`, `money.spec.ts` |
| E | `a11y.spec.ts`, `keyboard.spec.ts`, `contract.spec.ts`, `content-sentinel.spec.ts`, `i18n.spec.ts`, `motion.spec.ts` |
| F | `design/boards/`, `design/render/`, `blob-map.json` relativo |
| G (serie tras F) | `tests/visual/manifest.json`, `compare.ts`, `scripts/visual/*` |
| H | `tests/visual/content/`, `tests/visual/fixtures/` |
| I | `scripts/perf/check-budgets.mjs`, `tests/e2e/perf.spec.ts`, `scripts/seo/check-dist.mjs` |
| J | `astro.config.mjs`, `package.json`, `.github/workflows/ci.yml` |

**Aceptación**

```
pnpm ci
pnpm build && pnpm preview   # sirve .vercel/output en :4322
pnpm test:e2e
pnpm visual:goldens && pnpm test:visual
```

- `pnpm ci` pasa con la lista de rutas migradas vacía: ninguna compuerta nueva mide una ruta legada.
- El emulador responde igual que el despliegue en una muestra de rutas actuales, y **falla con el nombre** de una propiedad de ruta desconocida (prueba con un `config.json` de mentira en `tests/`).
- Cada golden de los nueve tableros cumple en su `measure.json`: `overflow: false`, `brokenImages: []` y `maxSpread: 0` en toda rejilla.
- `pnpm test:visual` pasa sin casos de sitio (solo la comprobación de goldens); cada hito de F1 y F2 añade sus casos al manifiesto.
- `rg -n --no-heading "pwsh" playwright.config.ts scripts` → 0 coincidencias.

**Riesgos**

1. **Verdana en CI**: los goldens se generan en Windows con Verdana; Linux cae a DejaVu Sans. Por eso el trabajo `visual` corre en `windows-latest` y el resto en `ubuntu-latest` (§14.6). Una prueba visual movida a Linux produce diferencias falsas.
2. **`blob-map.json` con rutas absolutas del directorio temporal**: si no se reescribe a rutas relativas, el arnés versionado no funciona fuera de esta sesión. Se comprueba corriendo `visual:goldens` con el directorio temporal renombrado.
3. **Compuertas sobre código legado.** Si `check-budgets.mjs` o `check-dist.mjs` olvidan el recorte de `rutas-migradas.mjs`, `pnpm ci` queda roja desde M2 hasta M15 y el flujo se para. Es la primera aceptación del hito.
4. **`COMERCIO_DEMO=1` en el servidor de desarrollo** (§14.3) no debe filtrarse al build de producción: lo comprueba `seo:check` desde M12; aquí se fija solo en `playwright.config.ts`.

---

## M3 — Marco: `PageLayout`, cabecera, barra lateral, hoja móvil, rail, pie y paleta Ctrl + K

**Objetivo.** El marco de §5 y §7.10 sobre la hoja nueva, medido contra el tablero a ±1 px, más la paleta Ctrl + K funcionando (si no funcionara, el `SearchTrigger` sería un control falso, R12/S11). Ninguna ruta pública se migra todavía: el marco se prueba en `/_paridad/marco/`.

**Crear**

- `src/layouts/PageLayout.astro` (props de §7.2.1: `locale`, `title`, `description`, `alternates`, `breadcrumb?`, `toc?`, `rhythm?`, `preloadGameFont?`, `noindex?`; `<main id="contenido">` y `Footer` fijos; marcadores explícitos en el `<head>` y en el bloque de scripts para lo que añade M4).
- `src/components/layout/`: `SkipLink.astro`, `Header.astro`, `SearchTrigger.astro`, `LanguageMenu.astro`, `Sidebar.astro`, `MobileMenu.astro`, `Toc.astro`, `Breadcrumb.tsx`, `PageTitle.tsx`, `Section.tsx`, `Footer.astro`.
- `src/lib/nav/groups.ts` — datos del menú de §8.0.3, con la regla «un enlace solo existe si su ruta existe en el build» (WG5, PZ-04), leída de `scripts/lib/rutas-migradas.mjs`.
- `src/scripts/`: `mobile-menu.ts`, `popover-anchor.ts`, `toc-spy.ts`, `search-shortcut.ts`.
- `src/components/search/SearchPalette.tsx`; `src/lib/search/normalize.ts`, `src/lib/search/rank.ts`; `src/pages/[locale]/buscar/indice.json.ts` — **solo con los grupos cuyas rutas existen en el build** (BU6): al cerrar M3, `pokemon` y `pagina` recortado a las rutas vivas. M8 añade `sistema`, M9 `item`, M11 `actividad` y el resto de `pagina`.
- `src/styles/components/`: `page-layout.css`, `skip-link.css`, `header.css`, `search-trigger.css`, `language-menu.css`, `sidebar.css`, `mobile-menu.css`, `toc.css`, `breadcrumb.css`, `page-title.css`, `section.css`, `footer.css`, `search-palette.css`.
- `src/routes/_paridad/marco.astro` — ruta de prueba con `PageLayout`, **fuera de `src/pages/`**: la inyecta `astro.config.mjs` solo con `VISUAL=1` (§14.5). Una página en `src/pages/_paridad/` se publicaría en producción y haría fallar `seo:check`.
- `scripts/build/check-toc.mjs` — comprobación de build de §7.11 y §14: ids, títulos y orden del `Toc` de cada página iguales a sus `Section`.
- Pruebas: `tests/e2e/frame.spec.ts` (S1 y §5.5 a 1440, 1280, 1024, 768 y 390), `tests/e2e/mobile-menu.spec.ts`, `tests/search/rank.test.ts`, `tests/search/normalize.test.ts`, `tests/components/contracts.test.tsx` (parte de marco: `Footer`, `Header`, `SearchTrigger` en `en` sin textos por defecto en español, con la Container API de §14.2).

**Cambiar**

- `src/styles/global.css`: un `@import` por archivo nuevo de `src/styles/components/`, con `layer(components)` y en el orden de `bundle.css`.
- `astro.config.mjs`: `site`, `@astrojs/sitemap`, `prefetch: { prefetchAll: false, defaultStrategy: 'hover' }` y la inyección de `/_paridad/marco/` (§3.13).
- `src/i18n/messages/{es,en}.ts`: espacios `shell` y `ui` completos (tabla de §13.2).
- `public/robots.txt` (nuevo o actualizado, §13.5).
- `scripts/lib/rutas-migradas.mjs`: añade `/_paridad/marco/`.
- `package.json`: `check-toc.mjs` entra en `ci` tras `pnpm build`.
- `tests/visual/manifest.json`: caso de marco (cabecera, barra lateral, columna, pie) contra `Main` e `Inicio-movil`.

**Borrar.** Nada. `src/components/wiki/AllianceWordmark.astro` es de `AppLayout` y se borra con él en M15 (es su único consumidor, verificado).

**Dependencias.** M2 (proyectos de Playwright, arnés visual, emulador).

**Paralelo**

| Carril | Archivos |
|---|---|
| A (integra, serie al final) | `PageLayout.astro`, `page-layout.css`, `src/styles/global.css`, `astro.config.mjs`, `src/routes/_paridad/marco.astro`, `scripts/lib/rutas-migradas.mjs` |
| B | `SkipLink.astro`, `Section.tsx`, `Footer.astro` + CSS |
| C | `Header.astro`, `SearchTrigger.astro`, `LanguageMenu.astro` + CSS + `popover-anchor.ts` |
| D | `Sidebar.astro`, `MobileMenu.astro` + CSS + `mobile-menu.ts` + `src/lib/nav/groups.ts` |
| E | `Toc.astro`, `toc-spy.ts`, `Breadcrumb.tsx`, `PageTitle.tsx` + CSS |
| F | `SearchPalette.tsx`, `search-shortcut.ts`, `src/lib/search/*`, `indice.json.ts`, `search-palette.css` |
| G | `scripts/build/check-toc.mjs`, `package.json` |
| H | diccionarios `shell`/`ui` + `tests/components/contracts.test.tsx` |
| I | `tests/e2e/frame.spec.ts`, `tests/e2e/mobile-menu.spec.ts`, `tests/search/*` |
| J | `public/robots.txt`, `tests/visual/manifest.json` |

**Aceptación**

- G0, G2 sobre `/_paridad/marco/` en `es` y `en`.
- **S1 (geometría del marco), medido, ±1 px**, a 1440 × 900: cabecera 64 de alto; barra lateral x 0–208; columna principal desde x 248 con 944 sin rail o 896 con rail en x 1184 ancho 256. A 1280, 1024, 768 y 390, la tabla de §5.5. A 390: sin barra lateral, márgenes 16, `documentElement.scrollWidth ≤ 390`.

```
pnpm exec playwright test --project=desktop --project=mobile tests/e2e/frame.spec.ts
pnpm test:visual -- --grep "marco"
```

- V5-1 a V5-7 (§5.10) y C7-11, C7-12, C7-13 (§7.14).
- `pnpm exec playwright test --project=mobile --project=webkit-mobile tests/e2e/mobile-menu.spec.ts` (V5-4: hoja, foco atrapado, Escape, color calculado del velo `::backdrop`).
- `pnpm exec playwright test --project=reduced-motion tests/e2e/motion.spec.ts` (S15 sobre hoja y paleta).
- `pnpm exec vitest run tests/search tests/components/contracts.test.tsx`.
- `node scripts/build/check-toc.mjs` en verde.
- G3 limitado a los archivos del hito.
- Ninguna ruta pública cambió: `pnpm exec playwright test tests/e2e/smoke.spec.ts` sigue en verde.
- `rg -n --no-heading "_paridad" src/pages` → 0 coincidencias (las rutas de paridad viven en `src/routes/`).

**Riesgos**

1. **`::backdrop` y propiedades personalizadas**: `var(--overlay)` dentro de `::backdrop` depende de que herede las propiedades del documento. V5-4 lo mide en Chromium **y** WebKit; si WebKit falla, el velo se pinta en un elemento propio dentro del `<dialog>` (§5.8).
2. **La paleta y el disparador deben llegar juntos**: si `SearchPalette` se retrasa, `SearchTrigger` es un control falso (S11). `search-shortcut.ts` guarda la petición en `dataset.acSearchPending` para el clic previo a la hidratación (C7-11).
3. **El menú lateral enlaza rutas que aún no existen** (Tier list, categorías de ítems, actividades, sistemas). Regla WG5: un enlace solo existe si su ruta existe en el build; hasta entonces el grupo no se renderiza y la prueba visual enmascara DV2. El índice de búsqueda sigue la misma regla (BU6).
4. `@astrojs/sitemap` con `output: 'server'` puede incluir rutas SSR: se excluyen las `noindex` (§13.5) y lo comprueba `seo:check`.
5. **Un solo carril escribe `PageLayout.astro` y `global.css`.** Los demás entregan componentes y CSS; el carril A los conecta al final. Dos carriles sobre `global.css` dejan imports perdidos.

---

## M4 — Capa de juego: `Sprite`, `GameTooltip`, `NestedEntity` y entidades

**Objetivo.** La única capa de juego del sitio (§7.4, §7.5): sprite a escala entera con animación generada en el build, tooltip del juego con su controlador delegado y las entidades anidadas.

**Crear**

- `src/components/game/`: `Sprite.tsx`, `SpriteStyles.astro`, `ShinyMark.tsx`, `SpriteStage.tsx` (con `MissingSprite`), `GameTooltip.tsx`, `NestedEntity.tsx`, `EntitySlot.tsx`, `ElementChip.tsx`.
- `src/components/icons/Glyph.tsx` — único consumidor de `lucide-react` (C-R7, C7-15), con la lista de glifos utilitarios de `DS:README §Iconografía`; sin `moon` mientras no haya tema claro (X2).
- `src/lib/game/tips.ts` — constructores `pokemonTip`, `itemTip`, `systemTip`, `systemItemTip`, `elementTip`, `diamondsTip`, `pokedolaresTip` (§7.5.3), con la regla de desconocidos de X13/T32: en el tooltip la fila sin valor **se omite** y nunca se escribe «—».
- `src/scripts/game-tooltip.ts` (TT1–TT13, §7.5.4–§7.5.7, con `@floating-ui/dom`), `src/scripts/art-loading.ts` (§7.4.4).
- `content/elementos.json` + `content/schemas/elementos.schema.json` (§3.13, orden e `id` de la tabla de §8.0.5).
- `src/styles/components/`: `sprite.css`, `shiny-mark.css`, `sprite-stage.css`, `game-tooltip.css`, `nested-entity.css`, `entity-slot.css`, `element-chip.css`, `plus-n.css`.
- `src/components/money/PlusN.tsx` (lo atiende el mismo controlador, §7.5.8).
- Pruebas: `tests/e2e/tooltip.spec.ts`, `tests/game/tips.test.ts`, ampliación de `tests/sprites/resolve.test.ts` (nombres de keyframes de §7.4.2, hoy en `:134-157`).

**Cambiar**

- `src/lib/sprites/resolve.ts`: `spriteOrNull(clave)` para las claves fijas de §3.13; sprites de ilustración con `image-rendering: smooth` y de píxel con `pixelated` (hoy siempre `pixelated`, `Sprite.tsx:37`, `Sprite.astro:35`).
- `src/layouts/PageLayout.astro`: incluye `SpriteStyles` una sola vez en el `<head>` y los scripts `game-tooltip.ts` y `art-loading.ts`, en los marcadores que dejó M3.
- `src/styles/global.css`: `@import` de los ocho archivos nuevos de `src/styles/components/`.
- `src/routes/_paridad/marco.astro` → añade una sección con entidades para probar el tooltip.
- `scripts/content/lib/check-content.mjs`: valida `content/elementos.json` y las referencias a entidades.
- `tests/visual/manifest.json`: caso de tooltip abierto y fijado.

**Borrar.** Nada todavía: `src/components/sprites/*` sigue en uso por `AppLayout` y por las páginas no migradas (se borra en M15, §7.4.5).

**Dependencias.** M3 (`PageLayout` y `global.css` existen y tienen marcadores).

**Paralelo**

| Carril | Archivos |
|---|---|
| A (integra, serie al final) | `PageLayout.astro`, `src/styles/global.css`, `src/routes/_paridad/marco.astro`, `tests/visual/manifest.json` |
| B | `Sprite.tsx`, `SpriteStyles.astro`, `sprite.css`, `src/lib/sprites/resolve.ts`, `tests/sprites/resolve.test.ts` |
| C | `SpriteStage.tsx`, `ShinyMark.tsx`, `art-loading.ts` + CSS |
| D | `GameTooltip.tsx` + `game-tooltip.css` |
| E (serie tras D) | `NestedEntity.tsx`, `EntitySlot.tsx`, `PlusN.tsx` + CSS |
| F | `src/scripts/game-tooltip.ts` |
| G | `src/lib/game/tips.ts`, `tests/game/tips.test.ts` |
| H | `content/elementos.json`, su esquema, `ElementChip.tsx`, `element-chip.css`, `check-content.mjs` |
| I | `src/components/icons/Glyph.tsx`, `tests/e2e/tooltip.spec.ts` |

**Aceptación**

- G0; G2 con **tooltip abierto y tooltip fijado** (S12 lo exige en esos estados).
- `pnpm exec playwright test --project=desktop --project=mobile tests/e2e/tooltip.spec.ts` — C7-06, C7-07, C7-08 y **S3** completos: hover, foco y primer toque abren; el puntero cruza al panel sin cerrarlo; Escape cierra incluso fijado; Shift solo fija y suelta, Shift+Tab y Shift+clic no; como máximo un panel sin fijar y uno fijado; ningún `article` de tarjeta es disparador; el panel queda a 8 px del borde (16 en teléfono) y se desplaza por dentro si no cabe.
- **S7 (sprites)**: `alto mostrado / alto natural ∈ {1, 2, 3}`, única excepción el Diamond del menú (0,5); 0 imágenes rotas; 0 iconos SVG fuera de los glifos utilitarios. `pnpm exec vitest run tests/sprites` + C7-05.
- `pnpm exec playwright test --project=reduced-motion tests/e2e/motion.spec.ts` — C7-14, S15: 0 animaciones 50 ms tras abrir un tooltip; Diamond en el fotograma 0.
- `rg -n --no-heading "lucide-react" src/components/game src/components/money src/components/layout src/components/search` → 0 coincidencias (C7-15; los legados quedan fuera hasta M15, §3.11).
- `rg -n --no-heading "sprites.json" src/components` → 0 coincidencias (C7-15).

**Riesgos**

1. **Keyframes en el build, no en el cliente** (E9): la hoja desplazada del sistema de diseño escribe sus keyframes con `ensureKeyframes` en el cliente y faltarían en el HTML prerenderizado. `SpriteStyles.astro` las genera desde `duracionMs` del registro; si un registro cambia el número de fotogramas, cambia la animación sin tocar código (§6.3).
2. **Un solo controlador delegado** para tooltips, «+N», `Select` y la paleta: un error de captura de eventos deja tooltips huérfanos. TT8/TT9 se prueban explícitamente (dos paneles como máximo).
3. **Carga de Poppins sin precarga inútil** (§3.9): el controlador pide los dos pesos en el primer `pointerover`/`focusin` o en `requestIdleCallback`; V3-6 comprueba que no hay avisos de precarga sin usar.
4. `content/elementos.json` lo rellena el propietario (D-011). Mientras falte un `icono`, `spriteOrNull` devuelve `null` y el chip se pinta sin icono; el build no falla. Las claves `ui/indice/*`, `ui/inicio`, `ui/herramientas/*` y `ui/cambios` tampoco están hoy en `sprites.json` (comprobado) y por eso pasan por `spriteOrNull`; `ui/categorias/*`, `ui/pokedolares`, `ui/diamond` y `ui/comercio/*` sí están.

---

## M5 — Controles y contenido del sistema de diseño (`/_paridad/componentes/`)

**Objetivo.** Los **21** componentes de §7.2.2 (11 controles) y §7.2.3 (10 de contenido) más las cinco piezas nativas de §7.2.8 (`Dialog`, `Combobox`, `Checkbox`, `RadioGroup`, `Textarea`) — 26 archivos — con las clases `ac-*` exactas de la referencia, y el tablero `Componentes` reproducido con los componentes reales.

**Crear**

- `src/components/controls/`: `Button.tsx`, `TextLink.tsx`, `TextField.tsx`, `NumberField.tsx`, `RangeField.tsx`, `Select.tsx`, `SortSelect.tsx`, `ToggleGroup.tsx`, `ViewToggle.tsx`, `Pagination.tsx`, `FilterBar.tsx`, `Dialog.tsx`, `Combobox.tsx`, `Checkbox.tsx`, `RadioGroup.tsx`, `Textarea.tsx`.
- `src/components/content/`: `Chip.tsx`, `Count.tsx`, `Note.astro`, `InfoBanner.astro`, `Notice.tsx`, `EmptyState.tsx`, `DataTable.tsx`, `Timeline.astro` (con `steps[].points`, §7.2.8), `FactLine.tsx`, `InfoCard.astro`.
- `src/styles/components/` — un archivo por componente, con los nombres de `bundle.css`.
- `src/routes/_paridad/componentes.astro`.
- Pruebas: `tests/components/classes.test.tsx` (C7-02: comparación de clases por componente contra la referencia, con la tabla de excepciones de C-R2), ampliación de `tests/components/contracts.test.tsx` (`ViewToggle` emite `aria-pressed` y los textos del diccionario).

**Cambiar**

- `src/styles/global.css`: un `@import` por archivo nuevo, con `layer(components)` y en el orden de `bundle.css`.
- `src/i18n/messages/{es,en}.ts`: claves `ui.*` que consumen estos componentes (DP1).
- `astro.config.mjs`: inyección de `/_paridad/componentes/`; `scripts/lib/rutas-migradas.mjs`: su entrada.
- `tests/visual/manifest.json` + `tests/visual/goldens/`: caso `componentes`.
- Textos del tooltip (franja «Mantén Shift para fijar», «o», etiquetas de filas) a `ui.tooltip.*` en los diccionarios; `src/routes/_paridad/marco.astro` deja de escribirlos (pendiente de M4).
- SVG propios del marco a `Glyph` (C-R7): `Breadcrumb`, `Header`, `LanguageMenu`, `MobileMenu`, `SearchTrigger`, `Sidebar`, `SearchPalette` (pendiente de M4).
- `tests/e2e/keyboard.spec.ts`: la comprobación de «foco tapado» espera a que termine el desplazamiento suave antes de medir (falsos fallos en páginas largas).

**Borrar.** Nada (los 9 archivos de `src/components/ui/`, 757 líneas medidas, se borran con sus consumidores en M10, M13 y M15, §7.12).

**Dependencias.** M4 (`Chip` y `FactLine` con `tip` son `NestedEntity`).

**Paralelo**

| Carril | Archivos |
|---|---|
| A (integra, serie al final) | `src/styles/global.css`, `astro.config.mjs`, `scripts/lib/rutas-migradas.mjs`, `src/routes/_paridad/componentes.astro` |
| B | `Button`, `TextLink`, `ToggleGroup`, `ViewToggle` + CSS |
| C | `TextField`, `NumberField`, `RangeField`, `Textarea`, `Checkbox`, `RadioGroup` + CSS |
| D | `Select`, `SortSelect`, `Combobox` + CSS (`@floating-ui/dom` y `popover="manual"`) |
| E | `Pagination`, `FilterBar` + CSS |
| F | `Dialog` + CSS (`<dialog>` con `showModal()`, emite `ac:modal-open`, TT12) |
| G | `Chip`, `Count`, `Notice`, `EmptyState` + CSS |
| H | `Note.astro`, `InfoBanner.astro`, `InfoCard.astro`, `Timeline.astro` + CSS |
| I | `DataTable`, `FactLine` + CSS |
| J | `tests/components/*` |
| K | claves `ui.*` de los diccionarios, `tests/visual/manifest.json` + goldens |

**Aceptación**

- G0, G2 sobre `/_paridad/componentes/`.
- **C7-01 y C7-02**: cada componente existe en su ruta, su render coincide con la columna «Render» de §7.2 y sus clases `ac-*` coinciden con la referencia salvo las excepciones de C-R2. `pnpm exec vitest run tests/components`.
- **Visual contra el tablero `Componentes`** (recorte de `/_paridad/componentes/`, umbral de `/_paridad/`, ≤ 0,5 %; página completa ≤ 2 %):

```
pnpm test:visual -- --grep "componentes"
```

- **S6 (tokens)**: `pnpm design:check` con 0 violaciones; 0 literales de color, 0 `!important`, 0 degradados, 0 sombras de elevación; `backdrop-filter` solo en los velos de `MobileMenu`, paleta y `Dialog`.
- **S11 (sin controles falsos)** sobre la ruta de paridad: cada `button`, `a[href]`, `[role="button"]` y `[role="tab"]` visible y habilitado produce un efecto comprobable; 0 elementos con aspecto de control y `aria-hidden="true"`.
- `pnpm exec playwright test --project=desktop tests/e2e/contract.spec.ts` (chevrones dentro de controles con `aria-expanded`, G8; sin botón de tema, X2/PZ-01).

**Riesgos**

1. **`popover="manual"` en la capa superior** con `@floating-ui/dom`: en WebKit la capa superior y el `anchor` se comportan distinto. `Select` y `Combobox` se prueban en `desktop` y `webkit-mobile`.
2. **`Dialog` nativo y foco**: `showModal()` deja el resto inerte pero el foco inicial debe ir a «Cancelar» en los diálogos de confirmación (§10.4, §9.9). Se prueba en M13 y M14; aquí se prueba el contrato genérico.
3. **Deriva de clases**: escribir a mano 26 componentes invita a inventar clases. C7-02 compara con la referencia y falla nombrando el componente.
4. `RangeField` acepta «50kk»: lo interpreta `parsePokedolares` (§4.3), no el componente.

---

## M6 — Tarjetas, rejillas, tres vistas, dinero y compuerta de presupuesto (cierre F1)

**Objetivo.** La anatomía de tarjeta sobre subgrid, las rejillas de `CGS`, el controlador de listas con las tres vistas y los componentes de dinero. Cierra F1 **midiendo el prototipo de `/es/pokedex/`** que §13.6 exige antes de empezar F2: si una medida supera su límite, el hito no cierra y F2 no empieza.

**Crear**

- `src/components/cards/`: `CardGrid.tsx`, `Card.tsx` (exporta `cardKit`: `Card`, `Zone`, `Head`, `Title`, `Meta`, `ShinyLine`, `tipHead`), `CardGroup.tsx`, `FactList.tsx`, `ListingCard.tsx`, `DexCard.tsx`, `LootCard.tsx`, `KpiCard.tsx`, `ListRow.tsx`, `SlotsPanel.tsx`.
- `src/lib/cards/layout.ts`: `listingLayout`, `gridKeys`, `listingKeys`, `lootKeys`, `lootValues`, `trackCount(family, layout)`.
- `src/lib/lists/state.ts` (`ListConfig`, `ListState`, `parseListState`, `serializeListState`, `applyListState`), `src/components/lists/useListState.ts`, `src/components/lists/EntityList.tsx`.
- `src/components/money/`: `PokedolaresAmount.tsx`, `DiamondsAmount.tsx`, `PriceOptions.tsx`, `Rating.tsx`, `ContactChip.tsx`, `ChipRow.tsx`, `HeldStrip.tsx`, `TrainingMeter.tsx`.
- `src/styles/components/` — un archivo por pieza (`card-grid.css`, `card.css`, `dex-card.css`, `loot-card.css`, `listing-card.css`, `slots-panel.css`, `list-row.css`, `entity-list.css`, `money.css`…).
- `src/routes/_paridad/tarjetas.astro`.
- **Prototipo (compuerta de F1):** `src/pages/[locale]/pokedex/datos.json.ts` y `src/components/pokedex/PokedexRoot.tsx` en su forma mínima (PR5) sobre el `DexCard` real, con `/{l}/pokedex/index.astro` migrado a `PageLayout` plantilla B. M7 los completa con el tablero.
- Pruebas: `tests/cards/layout.test.ts` (C7-04), `tests/lists/state.test.ts` (U1–U6), `tests/e2e/lists.spec.ts` (C7-10), `tests/format/unknown.test.ts` ampliada con `gridKeys`/`listingLayout`.

**Cambiar**

- `src/styles/global.css`: imports nuevos.
- `src/i18n/messages/{es,en}.ts`: `ui.views.*`, `ui.pagination`, `ui.dataError`; `src/i18n/dynamic-keys.ts` con `ui.views.cards|slots|list`.
- `astro.config.mjs` (inyección de `/_paridad/tarjetas/`), `scripts/lib/rutas-migradas.mjs` (`/_paridad/tarjetas/` y `/{l}/pokedex/`).
- `tests/visual/manifest.json` + goldens: caso `tarjetas`.
- `src/components/game/GameTooltip.tsx`: los importes llevan el sprite de Pokédólares o Diamond (S8) y la sección de entrenamiento usa `TrainingMeter` (pendiente de M4).
- `tests/e2e/contract.spec.ts`: S14 mide la zona táctil efectiva (la caja del control ampliada por su `::before` de 44 px), no solo la caja visible; el «+N» de 32/36 px y la píldora cumplen así en táctil.
- **`docs/CORTE_0_CODEX_TOOLTIP_SPEC.md` §13.6**: se escriben los valores medidos del prototipo junto a la línea base. Es el único cambio autorizado de la especificación en este plan. Un límite **solo baja** con la medida; subirlo es decisión del propietario (OG-10) y ningún agente lo hace.

**Borrar.** Nada.

**Dependencias.** M5 (`ViewToggle`, `Pagination`, `Select`, `FilterBar`, `Count`, `EmptyState`).

**Paralelo**

| Carril | Archivos |
|---|---|
| A | `CardGrid.tsx`, `Card.tsx`, `card-grid.css`, `card.css` |
| B (serie tras A) | `DexCard.tsx`, `LootCard.tsx` + CSS |
| C (serie tras A) | `ListingCard.tsx`, `KpiCard.tsx`, `CardGroup.tsx`, `FactList.tsx` + CSS |
| D | `src/lib/cards/layout.ts`, `tests/cards/layout.test.ts` |
| E | `SlotsPanel.tsx`, `ListRow.tsx` + CSS |
| F | `src/lib/lists/state.ts`, `tests/lists/state.test.ts` |
| G (serie tras F) | `useListState.ts`, `EntityList.tsx`, `entity-list.css` |
| H | `src/components/money/*`, `money.css` |
| I | diccionarios, `dynamic-keys.ts` |
| J (integra, serie) | `src/styles/global.css`, `astro.config.mjs`, `rutas-migradas.mjs`, `src/routes/_paridad/tarjetas.astro`, `tests/e2e/lists.spec.ts`, `tests/visual/manifest.json` |
| K (serie, bloqueante, al final) | prototipo: `pokedex/index.astro`, `PokedexRoot.tsx`, `datos.json.ts`, medida y escritura de §13.6 |

**Aceptación**

- G0, G2 sobre `/_paridad/tarjetas/`.
- **S2 (rejillas)**, a 1440, 1280, 1024, 768 y 390: columnas y anchos de `DS:guias/30 §Responsive`; **por fila, dispersión de alturas = 0 y dispersión del inicio de cada zona = 0 (±0,5 px)**; con las sobrescrituras de WCAG 1.4.12, 0 textos fuera de su tarjeta y 0 filas de hechos solapadas.
- **S4 (tres vistas)**: `ViewToggle` con Cards, Slots y Lista; las tres muestran el mismo conjunto; dos elementos del mismo grupo conservan su orden relativo; la vista elegida sobrevive a una recarga.
- **Visual contra el tablero `Tarjetas`** (≤ 0,5 %): `pnpm test:visual -- --grep "tarjetas"`.
- **C7-04, C7-09, C7-10** en verde: `gridKeys`, `listingLayout`, `lootKeys` y `trackCount` pasan los ejemplos de `DS:guias/30` y `CGS §5.3`; todas las tarjetas de una rejilla comparten `grid-row`; `DexCard` a 358 de contenedor usa la anatomía compacta **sin JS** (container query), con tope 6 en drops y «+N» cuadrado, y ningún elemento oculto es enfocable; U1–U6, H1–H7, V1–V8 y PR1–PR5.
- **S8 (dinero)**: `pnpm exec vitest run tests/format/numbers.test.ts` con la tabla de `DS:guias/40` (850; 2.500; 150.000; 1.500.000; 150.000.000; 1.200.000.000) en `es` y `en`; cada importe visible lleva antes el sprite y su nombre accesible es la cifra exacta.
- **Compuerta de F1 (§13.6)**, sobre el prototipo `/es/pokedex/` con el registro actual (910 variantes, 12 tarjetas por página): HTML ≤ 80 KB gzip y ≤ 450 KB sin comprimir; props de la isla ≤ 20 KB sin comprimir; `datos.json` ≤ 60 KB gzip y ≤ 400 KB sin comprimir; JS inicial ≤ 110 KB gzip; CSS por página ≤ 30 KB gzip; hoja compartida ≤ 100.000 B sin comprimir (S17, sobre la hoja nueva). **Si alguno falla, el hito no cierra**: se reduce el HTML (menos paneles en el servidor, datos de tooltip en `refs`) hasta cumplirlo.

```
pnpm build && pnpm perf:budget
pnpm exec playwright test --project=prod tests/e2e/perf.spec.ts
```

- LCP ≤ 2,5 s, CLS de página ≤ 0,02, CLS en rejillas = 0, INP ≤ 200 ms con el perfil de red y CPU de §13.6, también en los dos casos de primer render con estado (PR4).

**Riesgos**

1. **El prototipo puede no caber en el presupuesto**: es el riesgo con más impacto del plan. Mitigación prevista en §13.6: mover los datos de tooltip a `refs` y renderizar menos paneles en el servidor. La decisión de **subir** un límite es del propietario (OG-10).
2. **Subgrid**: la anatomía depende de `grid-template-rows` heredadas por la tarjeta. Respaldo y prohibiciones en §7.6.5; nunca `content-visibility: auto` en tarjetas con subgrid (`CGS §14`).
3. **Primer render con estado (PR4)**: con vista guardada o URL con `view`/`page`, la raíz lleva `data-ac-pending` y ningún resultado del estado por defecto puede llegar a verse. Se mide con capturas antes de que la raíz pierda el atributo.
4. **Container query para la anatomía compacta**: depende del ancho del **contenedor**, no de la ventana. C7-09 mide a 358 de contenedor.
5. **El prototipo migra una ruta pública antes de F2.** `/{l}/pokedex/` queda con el marco y `DexCard` reales pero sin las tres vistas completas ni el tablero: M7 lo cierra. Hasta entonces la ruta entra en `rutas-migradas.mjs` y responde a WG1 y a S2, no a los criterios PX* de §8.2.
6. `EntityList` debe funcionar sin JavaScript para la paginación (`<a href>`, P-28): un `onPage` que sustituya al `href` rompe WG5.

---

## M7 — Pokédex: índice y ficha de Pokémon

**Objetivo.** Las dos primeras páginas con tablero (`Lienzo:Pokedex` y `Lienzo:Pokedex-Shiny-Charizard`), con tres vistas, tooltip en cada entidad y las tres listas secundarias de la ficha.

**Crear**

- `src/components/pokedex/config.ts` (`ListConfig` de §8.0.6: `pageSize` 12, filtros `gen`, `tier`, `elemento`, `variante`, `groupBy` generación solo en Slots).
- `src/components/pokemon/EvolutionChain.astro`, `src/components/pokemon/DropsList.tsx` (lista `drops`, `client:visible`), `src/components/pokemon/FamilyList.tsx` (lista `familia`, `defaultView: 'list'`, E15).
- `src/styles/components/evolution-chain.css`, `drops.css`.
- Pruebas: `tests/e2e/pokedex.spec.ts`, casos `pokedex` y `ficha` en `tests/visual/manifest.json`.

**Cambiar**

- `src/pages/[locale]/pokedex/index.astro` y `src/components/pokedex/PokedexRoot.tsx`: del prototipo de M6 a la página completa (tres vistas, filtros, agrupación).
- `src/pages/[locale]/pokedex/datos.json.ts` (definitivo, PR5).
- `src/pages/[locale]/pokedex/[slug].astro` → `PageLayout` plantilla C con rail `Toc`, `preloadGameFont`, ficha fija de `size-tt` (282) y secciones de §8.3.
- `src/components/wiki/OutfitPreview.tsx`: se conserva la lógica WebGL; su interfaz pasa a `ToggleGroup variant="sprite"` (Aura) y a componentes del sistema de diseño; estados separados `imageError` y `auraError` (v1 punto 18).
- `content/schemas/pokemon.schema.json` + `scripts/content/lib/check-content.mjs`: campos nuevos `hp`, `experiencia`, `drops`, `evolucion`, `habilidades`, `donde`, `elementoMoveset`; validaciones de §3.13 (`drops[].cantidad.max ≥ min`, `evolucion[].a` existe y sin ciclos, ningún `id` igual a `tiers`, nombre en los dos idiomas para cada elemento presente).
- `content/schemas/moves.schema.json`: `elemento` pasa de texto a `id` de elemento.
- `src/i18n/messages/{es,en}.ts`: espacios `pokedex` y `pokemon`.
- `src/pages/[locale]/buscar/indice.json.ts`: el grupo `pokemon` pasa a la forma definitiva (`href` a la ficha, `meta` «Nivel {n} · {tier}») y `pagina` añade Pokédex.
- `scripts/lib/rutas-migradas.mjs`: `/{l}/pokedex/{id}/`.

**Borrar**

- `src/components/wiki/PokedexGrid.tsx` (371 líneas medidas) — lo sustituyen `EntityList`, `DexCard`, `EntitySlot` y `ListRow`. Con él se va el atajo «/» de `:102-117` y el `<kbd>/</kbd>` de `:196` (A22).

**Dependencias.** M6 (compuerta de presupuesto cerrada).

**Paralelo**

| Carril | Archivos |
|---|---|
| A | `pokedex/index.astro`, `PokedexRoot.tsx`, `config.ts`, borrado de `PokedexGrid.tsx` |
| B | `pokedex/datos.json.ts` |
| C | `pokedex/[slug].astro` (marco, ficha fija, secciones) |
| D | `EvolutionChain.astro` + CSS |
| E | `DropsList.tsx`, `FamilyList.tsx` + CSS |
| F | `OutfitPreview.tsx` |
| G | esquemas de `content/` y `check-content.mjs` |
| H | diccionarios `pokedex`/`pokemon` |
| I | `tests/e2e/pokedex.spec.ts` |
| J (integra, serie) | `indice.json.ts`, `rutas-migradas.mjs`, `tests/visual/manifest.json` + goldens |

**Aceptación**

- G0, G1, G2, G3, G5.
- **Visual (WG2 geometría bloqueante + WG3 imagen)** contra `Pokedex` y `Pokedex-Shiny-Charizard` a 1440, y línea base propia a 390:

```
pnpm test:visual -- --grep "pokedex|ficha"
```

Geometría ±1 px en cabecera, barra lateral, columna principal, `h1`, cada rejilla y su primera tarjeta, conmutador de vista y pie; recortes ≤ 1 %; máscaras DV4 (conteos globales) y DV5 (glifos de Poppins).

- **Criterios de página de §8.2 y §8.3** (PX*, FI*) más WG1, WG4, WG5, WA1–WA4, WL1, WD1.
- **S19 (datos)**: `pnpm content:check` en verde; cambiar un registro de prueba cambia la cifra o el conteo que lo muestra; con `OCULTAR_BORRADORES=1` ningún registro `borrador` aparece.
- **Muestra fija de fichas** (§14.4): `charizard`, `shiny-charizard`, `mime-jr`, `unown-a`, `smeargle`, `shiny-mimikyu` responden 200, tienen un `h1` y pasan axe.
- **BU6**: cada `href` del índice de búsqueda responde 200 (`tests/e2e/links.spec.ts`).
- `rg -n --no-heading -e "view-transition-name" src/components src/pages` → 0 (T4, §6.1; los de `wiki-reference.css` se van en M15).

**Riesgos**

1. **La Pokédex es la página más pesada del sitio** (hoy 519.525 B de HTML, de los que 457.633 B son el atributo `props`). PR5 y la compuerta de M6 ya fijan la forma; cualquier regresión la detecta `perf:budget`.
2. **`pokedex/tiers` gana a `pokedex/[slug]`**: `pnpm content:check` rechaza un `id` de Pokémon igual a `tiers` (se añade en este hito aunque la ruta llegue en M9).
3. **X11 y Q11**: la ficha sigue el tablero (frame idle sur, sin selector de dirección ni paginador) y contradice D-008. Si el propietario responde Q11, se añade un `ToggleGroup` de dirección.
4. **X13 y Q16**: la regla de desconocidos del sistema de diseño. Si el propietario pide «—» en toda fila, cambian T32, FI3 y `GameTooltip`.

---

## M8 — Sistemas: registro, índice y página de sistema

**Objetivo.** El tablero `Sistema-Boost` como plantilla de toda página de sistema, el registro `content/sistemas/` con sus bloques y el índice con la plantilla D.

**Crear**

- `content/sistemas/<id>.json` (estructura completa de §3.13: `tooltip`, `intro`, `banner?`, `secciones` con `Bloque` de tipo `parrafo`, `subtitulo`, `pasos`, `tabla`, `nota`, `tarjetas`, `chips`, `lista`) y `content/schemas/sistemas.schema.json`. Los registros los rellena el propietario (D-011); el hito entrega uno completo (`boost`, el del tablero) y el resto como `borrador: true`.
- `src/pages/[locale]/sistemas/[id].astro` (plantilla C con rail `Toc`).
- `src/components/systems/Block.astro` — despachador de bloques; `src/components/systems/SystemItemsList.tsx` (lista `sistema-items`, E16).
- `src/components/home/IndexLinks.tsx` (rejilla de enlaces sin franja de título; §7.2.8, la usa la plantilla D).
- `src/styles/components/index-links.css`, `system-block.css`.
- Pruebas: `tests/e2e/sistemas.spec.ts`, caso `sistema` en `tests/visual/manifest.json`, `tests/content/sistemas.test.ts`.

**Cambiar**

- `src/pages/[locale]/sistemas/index.astro` → `PageLayout` plantilla D.
- `src/lib/content/registry.ts` / `repository.ts`: lectura de `content/sistemas/` y de `content/system-items.json` con `sprite` y `tooltip`, siempre por `@content`.
- `content/schemas/system-items.schema.json`: campo `sprite` opcional (E16).
- `src/pages/[locale]/buscar/indice.json.ts`: añade el grupo `sistema` y, en `item`, los ítems de sistema cuya página existe (E16).
- `src/lib/nav/groups.ts`: el grupo «Sistemas» se llena desde el registro, en su orden.
- `src/i18n/messages/{es,en}.ts`: espacio `systems`.
- `src/styles/global.css`, `scripts/lib/rutas-migradas.mjs`.

**Borrar.** Nada.

**Dependencias.** M6. Es independiente de M7 (conjuntos de archivos disjuntos salvo `indice.json.ts`, `groups.ts` y `rutas-migradas.mjs`): si se ejecutan a la vez, esos tres archivos son de M7 y M8 los toma ya cerrados.

**Paralelo**

| Carril | Archivos |
|---|---|
| A | `content/schemas/sistemas.schema.json` + `check-content.mjs` |
| B (serie tras A) | `content/sistemas/boost.json` y los borradores |
| C | `sistemas/[id].astro` |
| D | `src/components/systems/Block.astro` + CSS |
| E | `SystemItemsList.tsx`, `system-items.schema.json` |
| F | `sistemas/index.astro`, `IndexLinks.tsx` + CSS |
| G | `registry.ts`, `repository.ts` |
| H (integra, serie) | `indice.json.ts`, `groups.ts`, `src/styles/global.css`, `rutas-migradas.mjs`, diccionarios `systems`, `tests/*` |

**Aceptación**

- G0, G1, G2, G3.
- **Visual contra `Sistema-Boost`** (1440; página completa ≤ 2 %): `pnpm test:visual -- --grep "sistema"`.
- **Criterios de §8.4** (SI*) más WG1–WG5, WA1–WA4, WL1, WD1; WG4 para el índice (plantilla D: 4 columnas de enlaces con columna principal de 900 o más, 2 por debajo, filas de 40 / 44 con puntero grueso, sin descripciones).
- **E16**: cada ítem de sistema abre `systemItemTip`, aparece en Buscar y su lista tiene las tres vistas.
- `pnpm exec vitest run tests/content/sistemas.test.ts` — el esquema rechaza un bloque desconocido y un `EnLinea` mal formado.
- `node scripts/build/check-toc.mjs` (la página de sistema es la primera con `Toc` real).
- `pnpm i18n:check` (el espacio `systems` no deja claves huérfanas).

**Riesgos**

1. **El registro de sistemas es el más complejo del corte** (`Bloque` con 8 tipos y `EnLinea` con 5 formas). Si el esquema es laxo, la página renderiza basura. `content:check` valida bloque a bloque.
2. **Depende del propietario** (D-011): sin registros, el grupo «Sistemas» del menú no se renderiza (WG5) y el índice queda vacío. No bloquea el hito: se entrega con `boost` y borradores.
3. Los textos de un sistema que solo existan en inglés se muestran en `es` con `lang="en"` (T22, WA4).

---

## M9 — Ítems por categoría del Market y Tier list

**Objetivo.** Las dos listas que faltan de la wiki: `/{l}/items/` con sus 13 categorías reales y `/{l}/pokedex/tiers/`, que absorbe «Explorar tiers» (E1, R15).

**Crear**

- `src/pages/[locale]/items/index.astro`, `src/pages/[locale]/items/c/[categoria].astro`, `src/pages/[locale]/items/datos.json.ts`.
- `src/pages/[locale]/pokedex/tiers.astro` (ruta estática que gana a `[slug]`).
- `src/components/items/ItemsRoot.tsx` + `config.ts` (`pageSize` 24, sin filtros, `groupBy` categoría solo en «Todo»).
- `src/components/tiers/TiersRoot.tsx` + `config.ts` (`pageSize` 48, filtros `gen`, `elemento`, `variante`, `groupBy` tier en Cards y Slots).
- `src/styles/components/tab-link.css` (variante `href` de `ToggleGroup variant="tab"`, §7.2.8).
- Pruebas: `tests/e2e/items.spec.ts`, `tests/e2e/tiers.spec.ts`.

**Cambiar**

- `content/schemas/items.schema.json`: campos `elemento` y `uso` opcionales.
- `src/lib/nav/groups.ts`: grupo «Ítems» con «Todo» + las 13 categorías de `content/items/categorias.json` (14 entradas con `todo`, comprobado); grupo «Pokémon» con «Tier list».
- `astro.config.mjs`: redirección 302 `/{l}/rotaciones/` → `/{l}/pokedex/tiers/`, con y sin barra final.
- `src/pages/[locale]/buscar/indice.json.ts`: el grupo `item` con su `href` a `/{l}/items/c/{categoria}/?page={p}#item-{id}`; `pagina` añade Ítems y Tier list.
- `src/i18n/messages/{es,en}.ts`: espacios `items` y `tiers`.
- `src/styles/global.css`, `scripts/lib/rutas-migradas.mjs`.

**Borrar**

- `src/pages/[locale]/rotaciones/index.astro` (su ruta redirige).

**Dependencias.** M7 (la lista `pokedex` y `DexCard` ya probados) y M8 (`IndexLinks`, `tab-link`).

**Paralelo**

| Carril | Archivos |
|---|---|
| A | `items/index.astro`, `items/c/[categoria].astro` |
| B | `ItemsRoot.tsx`, `config.ts`, `items/datos.json.ts` |
| C | `pokedex/tiers.astro`, `TiersRoot.tsx`, `config.ts` |
| D | `tab-link.css` + variante `href` de `ToggleGroup` |
| E | `items.schema.json`, `check-content.mjs` |
| F | `astro.config.mjs` (redirección), borrado de `rotaciones/` |
| G | diccionarios `items`/`tiers` |
| H | `tests/e2e/items.spec.ts`, `tests/e2e/tiers.spec.ts` |
| I (integra, serie) | `groups.ts`, `indice.json.ts`, `src/styles/global.css`, `rutas-migradas.mjs` |

**Aceptación**

- G0, G1, G2, G3, G5.
- **Criterios de §8.5 y §8.8** (IT*, TL*) más WG1–WG5, WA1–WA4, WL1, WD1.
- **IT6 / WA3**: la pestaña actual de Ítems lleva `aria-current="page"` y el estado «Actual» (fondo `bg-tertiary`), **nunca** la selección ámbar ni `aria-pressed` (T9).
- **S4** en las dos listas; `?elemento=fire&variante=shiny&view=slots&page=2` sirve igual en `es` y en `en` (U3).
- **CA-11.8**: la Tier list de §8.8 existe, y solo por eso M11 puede retirar «Explorar tiers» con `PokemonExplorer`.
- `pnpm exec playwright test --project=prod tests/e2e/links.spec.ts` — `/es/rotaciones/` responde 302 a `/es/pokedex/tiers/` y ningún enlace apunta a la ruta retirada.
- `rg -n --no-heading "rotaciones" src` → solo la redirección de `astro.config.mjs`.

**Riesgos**

1. **Colisión de rutas** `pokedex/tiers` vs `pokedex/[slug]`: si un registro trae `id: "tiers"`, la ficha gana. Lo rechaza `content:check` desde M7.
2. **13 categorías prerenderizadas** × 2 idiomas = 26 HTML más: cuentan en el presupuesto de HTML por página y en el sitemap.
3. **E5**: en Buscar, los grupos Sistemas, Actividades y Páginas son listas de enlaces iguales en las tres vistas. No aplica aquí pero sí a M10: el `ListConfig` compartido se coordina allí.

---

## M10 — Inicio y Buscar

**Objetivo.** El tablero `Main` a 1440 y `Inicio-movil` a 390, y la página de resultados de búsqueda. Es el hito con más piezas propias del Inicio (bento, Destacados, paneles de índice, tabla de Mundos).

**Crear**

- `src/components/home/`: `HomeIntro.astro`, `FeaturedCard.tsx`, `FeaturedSection.tsx`, `IndexPanel.astro`, `WorldsTable.tsx`.
- `src/styles/components/home-intro.css`, `featured.css`, `index-panel.css`, `worlds-table.css`, `home-bento.css`.
- `content/destacados.json` + `content/schemas/destacados.schema.json`; `content/mundos.json` + `content/schemas/mundos.schema.json` (los rellena el propietario, D-011).
- `src/components/search/SearchResultsRoot.tsx` + `config.ts` (`pageSize` 24, filtro `q`, `groupBy` grupo del índice).
- Pruebas: `tests/e2e/home.spec.ts`, `tests/e2e/buscar.spec.ts`, casos `main` y `movil` en `tests/visual/manifest.json`.

**Cambiar**

- `src/pages/[locale]/index.astro` → `PageLayout` plantilla A, `rhythm="home"`, sin migas, con el bento de `grid-template-areas` de E17 (3, 2 o 1 columnas según el ancho del contenedor, `CGS §6.5`; el DOM sigue el orden de una columna).
- `src/pages/[locale]/buscar/index.astro` → `PageLayout` plantilla B, sin migas (E4).
- `src/lib/nav/groups.ts`: grupo «Destacados» desde `content/destacados.json`, con sprites de 16 que rebotan.
- `src/i18n/messages/{es,en}.ts`: espacios `home` y `search`.
- `scripts/content/lib/check-content.mjs`: las rutas de Destacados existen en el build.
- `src/styles/global.css`, `scripts/lib/rutas-migradas.mjs`, `src/pages/[locale]/buscar/indice.json.ts` (`pagina` añade Comercio, Guild y Cambios cuando sus rutas ya existen).

**Borrar**

- `src/components/wiki/WikiSearch.tsx` (lo sustituyen `SearchTrigger` + `SearchPalette`; su único consumidor es `index.astro`, comprobado).
- `src/components/wiki/ContentSearch.tsx` (lo sustituyen `src/lib/search` + `EntityList`; su único consumidor es `buscar/index.astro`).
- `src/components/phase3/ServerSaveStatus.tsx` sale del Inicio (A17, Q7); el archivo se borra en M11 si Q7 no lo reubica.

**Dependencias.** M7 y M8 (el Inicio enlaza y cuenta Pokédex, sistemas, ítems y actividades; el índice de Buscar necesita los grupos ya publicados).

**Paralelo**

| Carril | Archivos |
|---|---|
| A | `index.astro` (bento y ritmo) + `home-bento.css` |
| B | `HomeIntro.astro` + CSS |
| C | `FeaturedCard.tsx`, `FeaturedSection.tsx` + CSS, `content/destacados.json` + esquema |
| D | `IndexPanel.astro` + CSS |
| E | `WorldsTable.tsx` + CSS, `content/mundos.json` + esquema |
| F | `buscar/index.astro`, `SearchResultsRoot.tsx`, `config.ts`, borrado de `ContentSearch.tsx` y `WikiSearch.tsx` |
| G | `check-content.mjs` |
| H | diccionarios `home`/`search` |
| I (integra, serie) | `groups.ts`, `indice.json.ts`, `src/styles/global.css`, `rutas-migradas.mjs`, `tests/visual/manifest.json` + goldens |

**Aceptación**

- G0, G1, G2, G3, G5.
- **Visual contra `Main` (1440) e `Inicio-movil` (390)**: `pnpm test:visual -- --grep "main|movil"`, con las máscaras DV1 (botón de tema), DV2 (enlaces del menú sin ruta y «Aportar al mapa»), DV3 (columna «En línea»), DV4 (conteos globales) y DV6 (línea de `HomeIntro`, Q13).
- **Criterios de §8.1 y §8.6** (IN*, BU1–BU6) más WG1–WG5, WA1–WA4, WL1, WD1.
- **PZ-05 / X3**: la tabla de Mundos tiene **solo** la columna «Mundo», sin botón de orden y sin isla, con orden numérico por nombre.
- **PZ-06 / WD1**: «{n} variantes», «{a} normales», «{b} Shiny» y cada «N páginas» son iguales a los valores calculados desde `content/` (prueba unitaria + e2e).
- **v1 punto 9**: el Inicio no lleva buscador en la cabecera; hay un solo `role="search"` por página (`contract.spec.ts`).
- `pnpm exec playwright test --project=prod tests/e2e/prod.spec.ts` — `/es/buscar/?q=bulba` abre con el campo lleno y la consulta en la URL (v1 punto 1).

**Riesgos**

1. **E17 (bento)**: es una rejilla de maquetación con `grid-template-areas`, no una rejilla de tarjetas. Las prohibiciones de `order` y de colocación explícita de R4 y §7.6.5 **no** se le aplican, pero su DOM debe seguir el orden de una columna (S13, orden de foco).
2. **DV6 / Q13**: la línea de `HomeIntro` dice «actividades» y el tablero aprobado dice «guías». Es un cambio de un texto aprobado: la máscara lo cubre hasta que el propietario responda.
3. **`content/destacados.json` y `content/mundos.json` los escribe el propietario**. Sin ellos, el grupo «Destacados» y la tabla de Mundos no se renderizan (WG5, G7); el hito se entrega con 1 a 4 entradas de marcador `borrador: true`.
4. `ServerSaveStatus` sale del Inicio: si Q7 lo reubica, vuelve calculado en el cliente, con el HTML prerenderizado llevando solo la hora canónica (v1 punto 8).

---

## M11 — Cambios, Actividades, Herramientas, Mapa, 404, raíz y marcador de Comparar (cierre de F2)

**Objetivo.** Migrar las rutas de wiki que quedan, dejar **ninguna ruta de §8 importando `AppLayout`** y publicar los marcadores de Mapa y Comparar con las redirecciones de §8.0.1.

**Crear**

- `src/pages/404.astro` (SSR, estado 404, idioma por el prefijo de la ruta pedida, `noindex`).
- `src/pages/[locale]/actividades/index.astro` y `src/pages/[locale]/actividades/[id].astro`.
- `content/cambios.json` + `content/schemas/cambios.schema.json`.
- `src/components/changes/ChangeTimeline.astro` (sobre `DS:Timeline`, con `steps[].points`).
- Pruebas: `tests/e2e/rutas.spec.ts` (RZ1–RZ3, NF1–NF3, MP1–MP3, CP1), `tests/visual/baselines/*--390.png` de las rutas sin tablero.

**Cambiar**

- `src/pages/[locale]/cambios/index.astro` → plantilla C.
- `src/pages/[locale]/herramientas/index.astro` → plantilla D.
- `src/pages/[locale]/mapa/index.astro` → plantilla E, marcador, `noindex` (R9); `MapExplorer` deja de renderizarse.
- `src/pages/[locale]/herramientas/pokemon.astro` → plantilla E, marcador, `noindex` (E18).
- `src/lib/tools/pokemon-roster.ts`: se reescribe el comentario de `:1`, que nombra `PokemonExplorer` (comprobado), y sus ayudas de formato ceden a `src/lib/format/` (§11.7). El módulo se conserva mientras lo importe otra isla.
- `astro.config.mjs`: redirecciones 302 `/` → `/es/`, `/{l}/mapa/aportar/` → `/{l}/mapa/`, `/{l}/guias/` → `/{l}/actividades/`, con y sin barra final; `src/pages/404.astro` sin `prerender`.
- `content/schemas/quests.schema.json`: campo `sprite` opcional; textos a `Texto` (`{es, en}`).
- `src/i18n/config.ts`: `getLocale` deja de caer en `es` con un valor desconocido (`:76-78`); `/xx/…` llega al 404. `localeCopy` y `localeLabels` **no** se borran aquí: los usa `AppLayout.astro`, que vive hasta M15 (comprobado).
- `src/lib/nav/groups.ts`: grupo «Actividades» desde `content/quests.json`; grupo «Comunidad» con Comercio y Cambios; grupo «Herramientas» con Guild y Mapa.
- `src/pages/[locale]/buscar/indice.json.ts`: grupo `actividad` y el `pagina` completo de §8.6.
- `tests/e2e/smoke.spec.ts`: forma final de §14.3 (conteos, tres vistas, filtros en la URL).
- `src/i18n/messages/{es,en}.ts`: espacios `changes`, `activities`, `tools`, `map`, `errors`.
- `src/styles/global.css`, `scripts/lib/rutas-migradas.mjs` (todas las rutas de §8).

**Borrar**

- `src/pages/index.astro` (la raíz redirige desde configuración, T16).
- `src/pages/[locale]/guias/index.astro` y `src/pages/[locale]/mapa/aportar.astro` (sus rutas redirigen). `herramientas/pokemon.astro` no se borra: se reescribe como marcador.
- `src/pages/[locale]/fuentes/` — directorio vacío que dejó el `index.astro` ya borrado en el árbol de trabajo. `/{l}/fuentes/` no está en §8.0.1 y debe responder 404, no 500.
- `src/components/tools/PokemonExplorer.tsx` (399 líneas medidas) — §12.13: sus filas no pueden reaparecer.
- `src/components/phase3/ServerSaveStatus.tsx` (si Q7 sigue sin respuesta).

**Dependencias.** M9 y M10.

**Paralelo**

| Carril | Archivos |
|---|---|
| A | `src/pages/404.astro` + `astro.config.mjs` (render y redirecciones) |
| B | `actividades/index.astro`, `actividades/[id].astro`, `quests.schema.json` |
| C | `cambios/index.astro`, `ChangeTimeline.astro`, `content/cambios.json` + esquema |
| D | `herramientas/index.astro` |
| E | `mapa/index.astro` + borrado de `mapa/aportar.astro` |
| F | `herramientas/pokemon.astro` (marcador), `pokemon-roster.ts` + borrado de `PokemonExplorer.tsx` |
| G | borrado de `src/pages/index.astro`, `guias/index.astro`, `src/pages/[locale]/fuentes/`, `ServerSaveStatus.tsx`; `src/i18n/config.ts` |
| H | diccionarios |
| I | `tests/e2e/rutas.spec.ts`, `tests/e2e/smoke.spec.ts`, líneas base de 390 px |
| J (integra, serie) | `groups.ts`, `indice.json.ts`, `src/styles/global.css`, `rutas-migradas.mjs` |

**Aceptación**

- G0, G1, G2, G3, G4, G5 **sobre todas las rutas de §8** en `es` y `en` (la tabla «Criterios por fase» exige aquí S1–S16 sobre las rutas de la fase).
- **RZ1–RZ3, NF1–NF3, MP1–MP3, CP1** (§8.11–§8.14), sobre el emulador de la salida de Vercel:

```
pnpm build && pnpm exec playwright test --project=prod tests/e2e/rutas.spec.ts tests/e2e/seo.spec.ts tests/e2e/links.spec.ts
```

- `GET /` → 302 a `/es/` **sin** cuerpo con `http-equiv="refresh"`; `/es/mapa/aportar` y `/es/mapa/aportar/` → 302 a `/es/mapa/`; `/es/no-existe/` y `/es/fuentes/` → 404 con la página `es` y `noindex`; `/xx/` y `/xx/pokedex/` → 404 en `es`.

```
rg -n --no-heading "AppLayout" src/pages --glob '!**/comercio/index.astro' --glob '!**/herramientas/guild.astro'
rg -n --no-heading "PokemonExplorer" src
```

Las dos devuelven **0 coincidencias** (`comercio/index.astro` y `herramientas/guild.astro` siguen con `AppLayout` hasta M12 y M13).

- `pnpm exec playwright test tests/e2e/content-sentinel.spec.ts` sobre todas las rutas de §14.4 — la lista prohibida de §12.22 con 0 coincidencias.

**Riesgos**

1. **404 bajo demanda**: `@astrojs/vercel` añade `{ "src": "/.*", "dest": "_render", "status": 404 }` al final de `config.json`. Si el emulador no ejecuta esa función, NF1 pasa en falso. El emulador de M2 la ejecuta.
2. **Escapado de la ruta pedida en la 404** (NF2): `/es/<script>alert(1)</script>/` debe mostrarse como texto, recortado a 120 caracteres.
3. **`getLocale` sin respaldo** afecta también a las dos rutas que siguen con `AppLayout`: se comprueba que `/es/comercio/` y `/es/herramientas/guild/` siguen respondiendo 200 antes de cerrar.
4. Las líneas base de 390 px de las rutas sin tablero **exigen aprobación del propietario** (OG-9): mientras no las apruebe, la prueba visual de esas rutas queda como informativa, no bloqueante.

---

## M12 — Comercio fase A: lista, detalle, publicar y perfil con datos de ejemplo

**Objetivo.** Todo el front de Comercio del tablero `Lienzo:Comercio` sobre **datos estáticos de ejemplo**, sin Supabase, sin cuentas y sin contactar. En producción, la página muestra el estado vacío y «Crear anuncio» (CA-9.1).

**Crear**

- `content/comercio/anuncios.json`, `content/comercio/vendedores.json` + `content/schemas/comercio.schema.json`.
- `src/lib/trade/types.ts` (modelo de §9.4), `src/lib/trade/registry.ts` (solo lee con `COMERCIO_DEMO=1`), `src/lib/trade/search.ts` (`searchText`, `matches`), `src/lib/trade/sort.ts` (`sortListings`), `src/lib/trade/title.ts` (`listingTitle`), `src/lib/trade/text.ts` (`listingText`).
- `src/integrations/comercio-fases.ts` (§9.3: `astro:route:setup` fija `prerender` por fase y **falla el build** si una página de Comercio exporta `prerender`).
- `src/pages/[locale]/comercio/anuncio/[id].astro` (plantilla F), `src/pages/[locale]/comercio/vendedor/[handle].astro` (plantilla H), `src/pages/[locale]/comercio/publicar.astro` (plantilla G).
- `src/routes/comercio/datos.json.ts` (inyectada solo con `COMERCIO_DEMO` y sin `COMERCIO_PUBLICO`).
- `src/components/trade/`: `TradeListRoot.tsx` (`ListConfig` de §9.5), `ListingForm.tsx`, `ListingPreview.tsx`, `SellerCard.tsx`.
- `src/styles/components/listing-*.css`, `trade-*.css`.
- Pruebas: `tests/trade/search.test.ts`, `sort.test.ts`, `title.test.ts`, `text.test.ts`; `tests/e2e/comercio.spec.ts`; caso `comercio` en `tests/visual/manifest.json`; `scripts/test/build-comercio-fases.mjs`.

**Cambiar**

- `src/pages/[locale]/comercio/index.astro` → `PageLayout` plantilla B; se retira `export const prerender = true` de `:11` (§9.3).
- `src/lib/trade/draft.ts`: se conservan `parsePositiveWhole` (adaptada al separador de miles del idioma: punto en `es`, coma en `en`, límite de 15 cifras), `isDittoSlug`, `isValidOptionalPercent`, `isValidPrice` (monedas de §9.4) y `compactKks` (solo para el texto copiado, E12). `formatWhole` y `formatPokedolares` ceden a `src/lib/format/`.
- `tests/trade/draft.test.ts`: se actualiza a esas firmas.
- `astro.config.mjs`: registra `comercio-fases.ts` antes de `react()`.
- `content/items/diamantes.json`: objeto `moneda` con `seCompranEn` y `seUsanEn` (§3.13).
- `src/i18n/messages/{es,en}.ts`: espacio `trade`.
- `src/styles/global.css`, `scripts/lib/rutas-migradas.mjs`.

**Borrar**

- `src/components/trade/TradeDesk.tsx` (801 líneas medidas).

**Dependencias.** M11 (F2 cerrada).

**Paralelo**

| Carril | Archivos |
|---|---|
| A | `src/lib/trade/types.ts`, `registry.ts`, `content/comercio/*` + esquema |
| B | `src/lib/trade/search.ts`, `sort.ts`, `title.ts`, `text.ts` + sus pruebas |
| C | `comercio/index.astro`, `TradeListRoot.tsx`, borrado de `TradeDesk.tsx` |
| D | `comercio/anuncio/[id].astro` (plantilla F) |
| E | `comercio/vendedor/[handle].astro` (plantilla H), `SellerCard.tsx` |
| F | `comercio/publicar.astro`, `ListingForm.tsx`, `ListingPreview.tsx` |
| G | `src/integrations/comercio-fases.ts`, `src/routes/comercio/datos.json.ts` |
| H | `src/lib/trade/draft.ts` + `tests/trade/draft.test.ts` |
| I | diccionarios `trade`, `content/items/diamantes.json` |
| J | `tests/e2e/comercio.spec.ts`, `scripts/test/build-comercio-fases.mjs` |
| K (integra, serie) | `astro.config.mjs`, `src/styles/global.css`, `rutas-migradas.mjs`, `tests/visual/manifest.json` + goldens |

**Aceptación**

- G0, G1, G2, G3, G4, G5. Las pruebas de lista, detalle, perfil y formulario corren con `COMERCIO_DEMO=1` (servidor de desarrollo de §14.3).
- **Visual contra `Comercio`** con la máscara DV9 («Crear anuncio» frente a «Publicar anuncio»): `pnpm test:visual -- --grep "comercio"`.
- **CA-9.1 a CA-9.13 y CA-9.17, CA-9.18, CA-9.19, CA-9.20** (las de fase B —CA-9.14, 9.15, 9.16— son de M14; CA-9.13 se comprueba aquí con la fase B ausente).
- **CA-9.1, la más importante del hito**: sin `COMERCIO_DEMO` y sin `COMERCIO_PUBLICO`, `/es/comercio/` y `/en/comercio/` no tienen ninguna tarjeta, slot, fila, búsqueda, pestaña, filtro, banner ni barra de resultados; solo «Aún no hay anuncios.» y «Crear anuncio». No existen rutas `/comercio/anuncio/*`, `/comercio/vendedor/*` ni `/comercio/datos.json`, y **ningún archivo de `.vercel/output/` contiene un `id` de `anuncios.json` ni un nombre de `vendedores.json`**.

```
node scripts/test/build-comercio-fases.mjs
pnpm seo:check
```

- **CA-9.18**: dos builds (con y sin `COMERCIO_PUBLICO`, los dos con `COMERCIO_DEMO=1`) producen la tabla de rutas esperada en `config.json`; una página de Comercio que exporte `prerender` hace fallar el build.
- **CA-9.10 / S8**: 0 «KK», «KKs» ni «gold» en las páginas de Comercio; cada importe lleva su sprite y la cifra exacta como texto accesible.
- **§12.16 y §12.20 puntos 59–69**: sin slot de ball estático; validación tras la primera interacción; `aria-invalid` y mensaje enlazado por campo; la vista previa no es `aria-live`; grupos de opción única con semántica de `ToggleGroup`.

**Riesgos**

1. **Fuga de datos de demostración a producción**: es el riesgo con más consecuencias reputacionales (D-007, R12). Triple red: `registry.ts` solo lee con `COMERCIO_DEMO`, `seo:check` inspecciona `.vercel/output/` y CA-9.1 busca literalmente los `id` del registro en la salida.
2. **`prerender` por fase**: Astro solo acepta un literal en `export const prerender`; la integración lee el archivo y **falla** si alguna página de Comercio lo exporta, para que el hook no gane en silencio. Hoy `comercio/index.astro:11` lo exporta: retirarlo es parte del hito.
3. **Q8 y Q9** (tier máximo de held item y monedas admitidas) quedan con sus valores por defecto: `HELD_TIER_MAX = 99` y R$, US$, MX$.
4. `parsePositiveWhole` hoy rechaza «1.500» en `es` (`draft.ts:9-16`): el cambio de separador afecta a filtros de precio y al formulario; sus pruebas se amplían antes de tocarlo.

---

## M13 — Cuenta y Guild: `/{l}/cuenta/` y analítica de administración

**Objetivo.** Reescribir la interfaz de Guild como `Lienzo:Guild` (resumen, por día, por semana, miembros, inactividad), conservando el motor de cálculo actual y añadiendo `guild-analytics.ts`, **y crear `/{locale}/cuenta/` con su `Section` «Guilds»** (§10.4), que es lo que da acceso al modo cuenta y sin la cual CA-10.11 y CA-10.14 no se pueden probar.

**Crear**

- `src/pages/[locale]/cuenta/index.astro` (plantilla H, sin miga de grupo; existe solo si `getSupabasePublicConfig()` no es `null`, §9.3) y `src/components/account/AccountPanel.tsx` con la `Section` «Guilds» de §10.4: lista de guilds con su rol, «Crear guild» con `Select` «Mundo» de `content/mundos.json`, «Invitar oficial»/«Invitar miembro» con enlace de un solo uso de 7 días y «Copiar enlace», lista de cuentas con «Quitar», «Eliminar guild» y los diálogos de confirmación con el foco inicial en «Cancelar».
- `src/lib/supabase/account.ts`, `src/lib/supabase/errors.ts` (`mapSupabaseError`, §12.14.1).
- `src/lib/tools/guild-analytics.ts` — funciones puras sobre `GuildDailyHistory`, las metas y `hoy: Temporal.PlainDate` (inyectable).
- `src/components/guild/`: `GuildRoot.tsx` (isla `client:load`), `BarChart.tsx`, `Sparkline.tsx`, `PeriodFilter.tsx`, `MemberDialog.tsx`, `GoalsDialog.tsx`, `ImportDialog.tsx`.
- `src/styles/components/bar-chart.css`, `sparkline.css`, `period-filter.css`, `guild-*.css`, `account-*.css`.
- `supabase/migrations/<AAAAMMDDhhmmss>_guild_admin.sql` — `guild_settings`, `guild_invitations`, RPC `set_guild_settings`, `create_guild_invitation`, `accept_guild_invitation`, `revoke_guild_invitation`, `set_guild_member_role`, `remove_guild_member`, `guild_access_summary`, `delete_guild_daily_export`; `create_guild` con el id de mundo de `content/mundos.json`.
- Pruebas: `tests/tools/guild-analytics.test.ts` (historial sintético de 35 días), `tests/supabase/guild-rls.test.ts`, `tests/supabase/errors.test.ts`, `tests/e2e/guild.spec.ts`, `tests/e2e/cuenta.spec.ts`, caso `guild` en `tests/visual/manifest.json`.

**Cambiar**

- `src/pages/[locale]/herramientas/guild.astro` → `PageLayout` plantilla H, columna 944 sin rail; HTML prerenderizado solo con migas, `h1` «Guild» y la región de la isla con `aria-busy="true"`.
- `src/lib/tools/guild-ranking-image.ts`: los 11 literales de color pasan a `src/lib/design/tokens.ts`; la banda de meta usa el mismo `goalPacing` que la interfaz (v1 punto 44).
- `src/lib/supabase/guilds.ts`: `listGuildDailySnapshots` recibe `{ from }`; se añaden las llamadas a los RPC nuevos. El reintento `LEGACY_SOURCE_LOCATOR` de `:179-188` **se conserva** hasta OG-1.
- `src/lib/supabase/env.ts`, `src/lib/supabase/client.ts`: un solo módulo de cliente para Guild y Cuenta; M14 lo reutiliza sin cambiarlo.
- `src/lib/tools/guild-ranking.ts`: se borran `buildGuildWhatsAppText` y `buildGuildDiscordText`; `formatGuildNumber` en `pt-BR` cede a `formatInteger`; rangos con los términos del cliente (Leader, Vice-Leader, Member, E13).
- `tests/tools/guild-ranking.test.ts`, `tests/supabase/guilds.test.ts`: se actualizan.
- `src/i18n/messages/{es,en}.ts`: espacios `guild` y `account`.
- `.env.example`: `OCULTAR_BORRADORES` y las variables de Supabase locales.
- `src/styles/global.css`, `scripts/lib/rutas-migradas.mjs`.

**Borrar**

- `src/components/tools/GuildRankingTool.tsx` (2.217 líneas medidas), `src/components/tools/guild/GuildWorkspaceChrome.tsx`, `src/components/tools/GuildPersistencePanel.tsx`.
- Los 9 archivos de `src/components/ui/` (757 líneas medidas), `src/lib/utils.ts` y `components.json`: tras este hito no queda consumidor (los otros eran `WikiSearch` y `ContentSearch`, borrados en M10; `src/lib/utils.ts` ya no tiene ninguno, comprobado). Si alguno sobrevive, se borran en M15.

**Dependencias.** M11. No se ejecuta a la vez que M12: los dos tocan `src/i18n/messages/*` y `rutas-migradas.mjs`, y M14 extiende la página de cuenta que crea este hito.

**Paralelo**

| Carril | Archivos |
|---|---|
| A | `src/lib/tools/guild-analytics.ts` + `tests/tools/guild-analytics.test.ts` |
| B | `herramientas/guild.astro`, `GuildRoot.tsx` |
| C (serie tras A) | Resumen y Por semana (`KpiCard`, `DataTable`) |
| D (serie tras A) | Por día (`BarChart.tsx`, `PeriodFilter.tsx`) + CSS |
| E (serie tras A) | Miembros (`DataTable`, `Sparkline.tsx`, `MemberDialog.tsx`) |
| F | `GoalsDialog.tsx`, `ImportDialog.tsx` |
| G | migración SQL + `tests/supabase/guild-rls.test.ts` |
| H | `src/lib/supabase/guilds.ts`, `env.ts`, `client.ts`, `errors.ts` + `tests/supabase/errors.test.ts` |
| I | `cuenta/index.astro`, `AccountPanel.tsx`, `src/lib/supabase/account.ts` + `tests/e2e/cuenta.spec.ts` |
| J | `guild-ranking-image.ts`, `guild-ranking.ts` + sus pruebas |
| K | diccionarios `guild`/`account`, `.env.example` |
| L (integra, serie) | `src/styles/global.css`, `rutas-migradas.mjs`, `tests/e2e/guild.spec.ts`, `tests/visual/manifest.json` + goldens, borrados |

**Aceptación**

```
supabase start
supabase db reset
pnpm exec vitest run tests/supabase tests/tools/guild-analytics.test.ts
pnpm exec playwright test tests/e2e/guild.spec.ts tests/e2e/cuenta.spec.ts
```

- G0, G1, G2, G3, G4, G5.
- **Visual contra `Guild`** con las máscaras DV7 (datos de cabecera: «Mundo:» y «Acceso:») y DV8 (botón «Metas»): `pnpm test:visual -- --grep "guild"`.
- **CA-10.1 a CA-10.14** completos. En particular:
  - **CA-10.2**: las cifras del historial sintético de 35 días coinciden con valores calculados a mano en la prueba, con `hoy` fijo; `niceTicks(10536)` = tope 12.000.
  - **CA-10.3**: un día sin corte no tiene barra y dice «sin export»; ninguna barra se dibuja con valor 0 por falta de datos (G7).
  - **CA-10.9**: la interfaz no tiene selector de zona horaria, «Ver JSON», WhatsApp ni Discord; todas las horas llevan «(hora de Brasilia)».
  - **CA-10.10**: «Leader», «Vice-Leader», «Member» en `es` y en `en`, nunca «Líder» ni «Membro».
  - **CA-10.11**: pruebas RLS de §10.13 con `supabase start` local; «Importar export» no aparece para un `member`.
  - **CA-10.13**: el HTML prerenderizado **no** contiene «Importa un export de guild para ver el análisis.»; en modo cuenta se ve «Cargando la guild…» y nunca el vacío antes de la respuesta.
  - **CA-10.14**: «Quitar», «Eliminar guild» abren su `Dialog` con los textos de §10.4 y el foco en «Cancelar» («Eliminar cuenta» llega en M14 con §9.9).
- **Presupuesto de Guild** ≤ 200 KB gzip con el polyfill de Temporal incluido: `pnpm perf:budget`.
- `pnpm exec playwright test tests/e2e/content-sentinel.spec.ts` — 0 «Temporal», «exportedAt», «Membro», «Vice-Líder», «roster», «snapshot OTMM» (§12.22).
- **Nunca se ejecuta `supabase db push` ni `supabase link` contra el proyecto remoto** (OG-1).

**Riesgos**

1. **El polyfill de Temporal (45,3 KB gzip)** es la mitad del presupuesto de la página. Solo la isla de Guild lo importa; `prod.spec.ts` comprueba que no aparece en ningún otro chunk (§3.13).
2. **Semanas, altas y cambios de tramo**: `guild-analytics.ts` debe reproducir las reglas que hoy viven repartidas en `guild-daily-history.ts` (dailies desde el día siguiente al alta, contribución desde dos días después, un corte por fecha, semana lunes–domingo con Server Save 00:00 `America/Sao_Paulo`). CA-10.2 usa un historial que incluye los cuatro casos.
3. **`/{l}/cuenta/` solo existe con Supabase configurado.** Sin `supabase start` y sin `.env.local`, la ruta no se genera y Guild queda en modo local: el hito entrega y prueba los dos modos, y el modo cuenta se verifica solo en local (OG-1).
4. **Q15**: si `contribution` es un importe de Pokédólares, cada importe de §10.6–§10.12 pasa a `PokedolaresAmount` con sprite y forma k/kk (R5). Mientras tanto, entero agrupado sin sprite.
5. **Q14**: el tooltip compacto del gráfico conserva el aspecto del tooltip del juego (`tt-panel`, Poppins, oro) por R2; si el propietario dice que no, pasa a panel `bg-tertiary`, borde `border-primary`, radio 8 y Verdana.

---

## M14 — Comercio fase B: Supabase local, verificación, operaciones, reseñas y moderación

**Objetivo.** Construir la fase B completa **solo en local**: migraciones escritas y probadas con `supabase start`, RLS verificada, y todo detrás de `COMERCIO_PUBLICO`. El lanzamiento público no ocurre en este hito (gate de §9.2, OG-1 a OG-6).

**Crear**

- `supabase/migrations/<AAAAMMDDhhmmss>_trade_phase_b.sql` — tablas de §9.12.1, RLS de §9.12.2, funciones de §9.12.3, vistas `trade_public_reviews` y `trade_seller_stats`, parámetros de §9.12.6.
- `src/routes/comercio/operaciones.astro`, `src/routes/comercio/moderacion.astro` (inyectadas solo con `COMERCIO_PUBLICO`; `moderacion` con `prerender: false`).
- `src/lib/supabase/trade.ts`.
- `src/components/trade/`: `ChannelsPanel.tsx`, `OperationsPanel.tsx`, `ReviewForm.tsx`, `ReportDialog.tsx`, `ModerationQueue.tsx`.
- Pruebas: `tests/supabase/trade-rls.test.ts` (seis personas de §9.12.2), `tests/e2e/comercio-fase-b.spec.ts`.

**Cambiar**

- `src/integrations/comercio-fases.ts`: inyección de `operaciones` y `moderacion`, y modo SSR de lista, detalle y perfil con `COMERCIO_PUBLICO`.
- `src/pages/[locale]/cuenta/index.astro` y `src/components/account/AccountPanel.tsx`: añaden teléfono verificado, perfil de Comercio, canales (`ChannelsPanel`) y «Eliminar cuenta» con su `Dialog` (§9.9). La `Section` «Guilds» de M13 no cambia.
- `supabase/config.toml`: `[auth.sms.test_otp]` para el OTP local (D-B1 sin responder).
- `src/i18n/messages/{es,en}.ts`: claves de verificación, operaciones, reseñas y moderación.
- `.env.example`: `COMERCIO_PUBLICO`, `COMERCIO_DEMO`.
- `src/styles/global.css`.

**Borrar.** Nada.

**Dependencias.** M12 (front de Comercio) y M13 (`/{l}/cuenta/` y el módulo de cliente de Supabase).

**Paralelo**

| Carril | Archivos |
|---|---|
| A | migración SQL: tablas y RLS |
| B (serie tras A) | migración SQL: funciones, vistas y parámetros |
| C (serie tras B) | `tests/supabase/trade-rls.test.ts` |
| D | `src/lib/supabase/trade.ts` |
| E | `cuenta/index.astro`, `AccountPanel.tsx`, `ChannelsPanel.tsx` |
| F | `src/routes/comercio/operaciones.astro`, `OperationsPanel.tsx`, `ReviewForm.tsx` |
| G | `src/routes/comercio/moderacion.astro`, `ModerationQueue.tsx`, `ReportDialog.tsx` |
| H | `comercio-fases.ts`, `supabase/config.toml`, `.env.example` |
| I | diccionarios |
| J (integra, serie) | `src/styles/global.css`, `tests/e2e/comercio-fase-b.spec.ts` |

**Aceptación**

```
supabase start
supabase db reset
pnpm exec vitest run tests/supabase
COMERCIO_PUBLICO=1 COMERCIO_DEMO=1 pnpm build
pnpm exec playwright test tests/e2e/comercio-fase-b.spec.ts
node scripts/test/build-comercio-fases.mjs
```

- G0, G1, G2, G3 con la fase B **desactivada** (el build de producción no cambia respecto a M12).
- **CA-9.14**: todas las pruebas RLS de §9.12.2 con las seis personas.
- **CA-9.15**: una reseña solo se crea con la operación `confirmada`, por el comprador y dentro de 30 días; la media, la distribución y «Operaciones confirmadas» coinciden con `trade_seller_stats` y excluyen reseñas ocultas; cada reseña muestra el handle de `trade_public_reviews`.
- **CA-9.16**: tras «Contactar al vendedor», el comprador ve los valores de los canales visibles; un tercero autenticado solo ve etiquetas.
- **CA-9.13**: con `COMERCIO_PUBLICO` desactivado, el HTML de todas las rutas de Comercio no contiene «Contactar al vendedor», «Reportar», «Publicar» ni enlaces a `/cuenta/`, `/comercio/operaciones/` o `/comercio/moderacion/`.
- **CA-9.9 / §9.9**: el bloque de mercado del tooltip tiene «Contacto:» con etiquetas públicas y **nunca** un valor (correo, número o usuario).
- **CA-10.14** se repite con «Eliminar cuenta».
- G3 con la lista extra de §12.22 para Comercio y cuenta en `es`: 0 «confiable», «seguro», «garantizado» como palabra.
- **Nunca se ejecuta `supabase db push` ni `supabase link` contra el proyecto remoto** (OG-1).

**Riesgos**

1. **RLS mal escrita = fuga de datos de contacto**. Las pruebas de las seis personas son bloqueantes y corren sobre `supabase start` local antes de cerrar el hito.
2. **El lanzamiento público depende de siete decisiones del propietario** (D-B1–D-B7, OG-3 a OG-6). El hito entrega la fase B lista y probada; la activación no es parte del hito.
3. **Sin apps OAuth (OG-5)**, «Vincular Discord», «Vincular Twitch» y «Añadir otra plataforma» no se renderizan (S11): el panel de canales se entrega con correo y teléfono.
4. **`@supabase/supabase-js` en el cliente** cuenta contra el presupuesto de 140 KB gzip de Comercio (§13.6).

---

## M15 — Cierre del corte: borrado de CSS y componentes viejos, dependencias y documentación

**Objetivo.** Ejecutar el paso 4 de §3.10 y cumplir S18 y S20. A partir de aquí, `pnpm design:check` cubre **todo** `src/`, `check-dist.mjs` todo `dist/client` y `scripts/lib/rutas-migradas.mjs` devuelve «todas».

**Borrar**

- `src/layouts/AppLayout.astro` (256 líneas medidas) y `src/styles/legacy/` (los cinco archivos, 10.151 líneas medidas).
- `src/components/wiki/AllianceWordmark.astro` (su único consumidor es `AppLayout`, comprobado) y `localeCopy` y `localeLabels` de `src/i18n/config.ts` (mismos consumidores).
- Con ellos, todas las variables viejas: alias de shadcn (`--background`, `--foreground`, `--card*`, `--popover*`, `--primary*`, `--secondary*`, `--muted*`, `--accent*`, `--destructive`, `--border`, `--input`), `--signal`, `--panel*`, `--link`, `--font-body`, `--font-display`, `--font-code`, las 25 `--wiki-*`, las 6 `--trade-*`, las 6 `--dex-*` y `--home-pokemon-color`. `--ring` sobrevive con el valor del sistema de diseño (`#444ce7`).
- Todas las clases `wiki-*`, `trade-*`, `guild-*`, `pokemon-*`, `map-*`, `tool-*`, `compare-*`, `eyebrow`, `display-title`, `section-title` y `skip-link`.
- Lo que quede de `src/components/ui/`, `src/lib/utils.ts`, `components.json` y `src/components/sprites/*` (§7.4.5).
- `@view-transition` y los nombres de transición en línea que queden (`wiki-reference.css:1549-1556`, `pokedex/[slug].astro` si sobrevive alguno).
- `src/components/map/MapExplorer.tsx` **no** se borra: se conserva sin usar para el corte del mapa (R9, §15), igual que `content/map/*`, `src/lib/map/*` y `tests/map/client-map.test.ts`.

**Cambiar**

- `scripts/lib/rutas-migradas.mjs`: pasa a «todas»; `scripts/design/check.mjs` y `check-dist.mjs` pierden las exclusiones de migración (§3.11).
- `package.json`: se retiran `tw-animate-css`, `@base-ui/react`, `class-variance-authority`, `cn` y `shadcn`.
- `DESIGN.md` (front matter y reglas visuales) y `.impeccable/design.json`: describen este diseño con los nombres y valores de `src/design/tokens.json`. Hoy el front matter usa nombres propios (`night-canvas`, `raised-surface`, `quiet-border`, `alliance-gold`) que no existen en el sistema de diseño.
- `docs/DESIGN_DIRECTION.md`: describe este diseño (S20 lo nombra explícitamente).
- `docs/CURRENT_STATUS.md` y `docs/ROADMAP.md`: al día con el corte cerrado.
- `docs/CONTENT_PLAN.md`: se retiran las **115** etiquetas de cita de fuente `[W:…]` en 82 líneas (medido; D-012, §12.19). El texto que dependa de una cita se reescribe o se borra.
- `docs/DECISION_LOG.md`: **D-014 ya existe** (`:111`, «accepted by owner (diseño); implementación pendiente del Corte 0»). Se actualiza su estado a implementado con la aceptación visual pendiente; no se crea una decisión nueva.
- `docs/CORTE_0_CODEX_TOOLTIP_SPEC.md`: estado a «implementado y verificado técnicamente; aceptación visual pendiente» (S22).
- `.github/workflows/ci.yml`: sin pasos temporales de migración.

**Dependencias.** M14 (ninguna ruta puede importar `AppLayout`).

**Paralelo**

| Carril | Archivos |
|---|---|
| A | borrado de `AppLayout.astro`, `AllianceWordmark.astro`, `src/styles/legacy/`, `src/i18n/config.ts` |
| B (serie tras A) | barrido de clases y variables viejas en `src/`; `rutas-migradas.mjs`, `scripts/design/check.mjs`, `check-dist.mjs` sin exclusiones |
| C | borrado de `src/components/ui/*`, `src/lib/utils.ts`, `components.json`, `src/components/sprites/*` |
| D | `package.json` (dependencias) + `pnpm install` |
| E | `DESIGN.md`, `.impeccable/design.json`, `docs/DESIGN_DIRECTION.md` |
| F | `docs/CURRENT_STATUS.md`, `docs/ROADMAP.md`, `docs/DECISION_LOG.md`, `docs/CORTE_0_CODEX_TOOLTIP_SPEC.md`, `.github/workflows/ci.yml` |
| G | `docs/CONTENT_PLAN.md` (`[W:…]`) |

**Aceptación**

```
pnpm ci
pnpm test:e2e
pnpm test:visual
rg -n --no-heading -e "AppLayout" -e "src/styles/legacy" -e "localeCopy" -e "AllianceWordmark" src
rg -n --no-heading -e "\bwiki-[a-z]" -e "\btrade-[a-z]" -e "\bguild-[a-z]" -e "\bcompare-[a-z]" -e "\beyebrow\b" src
rg -n --no-heading -e "--cx-" -e "Codex Tooltip" -e "night-canvas" -e "alliance-gold" -e "raised-surface" DESIGN.md .impeccable/design.json docs/DESIGN_DIRECTION.md
rg -n --no-heading -e "\[W:" docs/CONTENT_PLAN.md
rg -n --no-heading -e "tw-animate-css" -e "@base-ui/react" -e "class-variance-authority" -e "\"shadcn\"" package.json src
```

Las cinco últimas devuelven **0 coincidencias**. La búsqueda de `[W:` se limita a `docs/CONTENT_PLAN.md`: este plan cita el patrón y `rg … docs` nunca daría cero.

- **S18**: no existen `src/styles/legacy/`, `wiki-reference.css`, `home.css`, `trade.css` ni `guides.css`; `src/styles/global.css` es solo la entrada de §3.6; 0 clases `wiki-*` o `trade-*` en `src/`.
- **S17**: la hoja compartida mide ≤ 100.000 B sin comprimir (hoy 203.705 B) y el CSS por página ≤ 30 KB gzip. `node scripts/design/check-dist.mjs`.
- **S6 sobre todo `src/`**: `pnpm design:check` con las 11 reglas ya sin exclusiones de migración.
- **S20** (revisión): `DESIGN.md`, `.impeccable/design.json` y `docs/DESIGN_DIRECTION.md` describen este diseño con los tokens del sistema de diseño; `docs/DECISION_LOG.md` cierra D-014; `docs/CURRENT_STATUS.md` y `docs/ROADMAP.md` al día.
- **Todos los criterios S1–S21 pasan sobre todas las rutas**, Comparar incluido como marcador (tabla «Criterios por fase», columna «Cierre del corte»).
- **S22 queda abierto**: es la aceptación del propietario (OG-8), y ninguna prueba automática la sustituye.

**Riesgos**

1. **El borrado masivo es el momento de mayor riesgo de regresión**: se ejecuta en un solo cambio y con `pnpm ci` + `pnpm test:e2e` + `pnpm test:visual` completos antes de cerrar. Si algo falla, se revierte el carril, no el hito entero.
2. **Clases vivas con nombre legado**: un `rg` de clases `wiki-*` puede dar falsos positivos en `content/` (texto de registros). El barrido se limita a `src/`.
3. **`[W:…]` en `docs/CONTENT_PLAN.md`**: quitar la etiqueta sin reescribir la frase deja una afirmación sin sujeto. Cada línea se reescribe o se borra; no se sustituye la etiqueta por otra forma de cita (D-012).
4. `src/components/sprites/*` tiene consumidores en pruebas: `tests/sprites/resolve.test.ts` apunta a `src/lib/sprites/`, que se conserva.

---

## M16 — Comparar Pokémon

**Aplazado por el propietario (2026-09-23).** Comparar no es prioritario por ahora: `/{l}/herramientas/pokemon/` sigue como el marcador de §8.14 hasta que el propietario retome este hito.

**Objetivo.** Sustituir el marcador de `/{l}/herramientas/pokemon/` por la herramienta de §11, reconstruida desde cero: de 2 a 4 Pokémon, sin puntuaciones ni «mejor», sin `ViewToggle` (no es una lista de entidades).

**Crear**

- `src/components/compare/CompareRoot.tsx` (isla `client:load`), `src/components/compare/CompareTable.tsx`, `src/components/compare/AddPokemon.tsx` (sobre `Combobox`).
- `src/lib/compare/state.ts` (`?p=`, `?add=`, `localStorage['alliance-codex:comparar:v1']` en `try/catch`), `src/lib/compare/rows.ts` (filas de §11.5 y «Solo diferencias»).
- `src/styles/components/compare-table.css`.
- Pruebas: `tests/compare/state.test.ts`, `tests/compare/rows.test.ts`, `tests/e2e/comparar.spec.ts`, caso `comparar` en `tests/visual/manifest.json` (contra el tablero que apruebe el propietario).

**Cambiar**

- `src/pages/[locale]/herramientas/pokemon.astro`: del marcador (plantilla E, `noindex`) a la herramienta; HTML prerenderizado con migas, `h1` y el estado vacío; la isla lee la URL al hidratar. Se retira `noindex` y la ruta entra en el sitemap.
- `src/lib/tools/pokemon-roster.ts`: se conserva solo si otra isla lo importa.
- `src/i18n/messages/{es,en}.ts`: espacio `compare`.
- `src/styles/global.css`.
- `docs/CORTE_0_CODEX_TOOLTIP_SPEC.md` §13.5: descripción SEO de la ruta, escrita con las reglas de §13.5.

**Borrar.** `src/lib/tools/pokemon-roster.ts` si queda sin consumidor.

**Dependencias.** M15 y **el tablero de Comparar aprobado por el propietario** (R15, OG-11). Sin tablero, el hito no empieza y el marcador de E18 se mantiene: el cierre del corte no espera.

**Paralelo**

| Carril | Archivos |
|---|---|
| A | `src/lib/compare/state.ts` + `tests/compare/state.test.ts` |
| B | `src/lib/compare/rows.ts` + `tests/compare/rows.test.ts` |
| C (serie tras A, B) | `CompareRoot.tsx`, `CompareTable.tsx` + CSS |
| D | `AddPokemon.tsx` |
| E | `herramientas/pokemon.astro`, `pokemon-roster.ts` |
| F | diccionarios `compare`, SEO de §13.5 |
| G (integra, serie) | `src/styles/global.css`, `tests/e2e/comparar.spec.ts`, `tests/visual/manifest.json` |

**Aceptación**

- G0, G1, G2, G3, G4, G5 sobre la ruta de Comparar (la tabla «Criterios por fase», columna F5, exige S1, S3, S5, S6, S7, S9, S10, S11, S12, S13, S14, S15, S16).
- **CA-11.1 a CA-11.9** (CA-11.8 ya quedó cubierta en M9: la Tier list existe):
  - sin parámetros ni almacenamiento, «Elige al menos dos Pokémon para compararlos.» y el control de añadir; **ningún Pokémon preseleccionado**;
  - `?p=bulbasaur,shiny-charizard,zzz,bulbasaur` da exactamente 2 columnas y reescribe la URL;
  - con 4 columnas el control de añadir no existe; `?add=` con 4 muestra el `Notice` y no cambia la tabla;
  - las filas y los valores coinciden con `content/pokemon.json`; un campo `null` se ve «—» y una fila sin valor en ninguna columna no existe;
  - «Solo diferencias» con Bulbasaur y Shiny Bulbasaur oculta Número, Generación, Rol y Elementos y conserva Variante, Requisito y Tier;
  - cada nombre y cada elemento abren su tooltip (S3);
  - a 390, la tabla se desplaza dentro de su región, la primera columna queda visible y la página no se desborda (S1);
  - **CA-11.9**: axe sin violaciones `serious` ni `critical` con 0, 1 y 4 columnas y con el combobox abierto.
- **§12.13**: las filas de `PokemonExplorer` no pueden reaparecer — `rg -n "PokemonExplorer" src` → 0; sin puntuaciones, «mejor», daño calculado ni colores de ventaja.
- **Presupuesto de Comparar** ≤ 120 KB gzip.

**Riesgos**

1. **Sin tablero aprobado no hay fidelidad medible** (WG2/WG3): la prueba visual se limita a la línea base propia hasta que exista tablero.
2. **`?add=` no tiene origen**: hoy ninguna página enlaza así. El tablero fija desde dónde se entra; hasta entonces el parámetro existe pero no se enlaza (no es un control falso: no hay control).
3. La tabla con 4 columnas a 390 px es el caso más apretado de S14 (objetivos de 44 × 44) y de desplazamiento dentro de la región.

---

## 3. Elementos bloqueados por el propietario (fuera del camino crítico)

Ninguno de estos bloquea un hito. Cada fila dice **qué desbloquea**, **qué se hace mientras tanto** y **dónde queda el hueco**. Un agente nunca los ejecuta por su cuenta.

| Id | Elemento | Desbloquea | Mientras tanto | Hito afectado |
|---|---|---|---|---|
| **OG-1** | **Aplicar migraciones de Supabase en remoto**, incluida `supabase/migrations/20260918220000_remove_provenance.sql` | Borrar el reintento heredado `LEGACY_SOURCE_LOCATOR` de `src/lib/supabase/guilds.ts:179-188`; poner en producción las tablas de Guild admin y de Comercio fase B | Todo se escribe y se prueba con `supabase start` **en local**. El reintento sigue; no es visible (§12.19) | M13, M14, M15 |
| **OG-2** | Aprobación de la especificación del Corte 0 (hoy «borrador para revisión del propietario») | Empezar M1 con el alcance firmado | El plan es ejecutable tal cual; un cambio de la especificación reabre los hitos afectados | M1 |
| **OG-3** | **Proveedor de SMS para verificar el teléfono y su presupuesto** (D-B1) | Verificación de teléfono real en Comercio fase B | `[auth.sms.test_otp]` en `supabase/config.toml`, solo local. Sin lanzamiento público | M14 |
| **OG-4** | **SMTP de los correos de Auth** (D-B2) y **CAPTCHA** (D-B3) | Registro y recuperación por correo en producción | Solo local | M14 |
| **OG-5** | **Apps OAuth de Discord y Twitch** (D-B4) y política de «otras plataformas» (D-B5) | Canales de contacto verificados por OAuth | Sin «Vincular Discord», «Vincular Twitch» ni «Añadir otra plataforma»: el botón no se renderiza (S11) | M14 |
| **OG-6** | **Moderadores, parámetros de §9.12.6 y términos de la comunidad** (D-B6, D-B7), más la revalidación de los términos de PokeAlliance (D-009) | Gate de lanzamiento público de la fase B (§9.2) | Valores por defecto; la fase B queda tras `COMERCIO_PUBLICO`, desactivada | M14 |
| **OG-7** | **Despliegue y dominio**: confirmar `site: 'https://pokealliance-codex.vercel.app'` o el dominio definitivo | Canónicas, `hreflang`, sitemap y `robots.txt` definitivos | Se usa el valor de §13.5; un cambio de dominio es una línea de `astro.config.mjs` y una regeneración de `seo:check` | M3 |
| **OG-8** | **Estrategia de commits y ramas** (nada está commiteado todavía) y **S22, aceptación visual página por página** | Publicar el trabajo y cerrar el corte como «aceptado» | Los agentes nunca hacen commit ni push. El estado tras M15 es «implementado y verificado técnicamente; aceptación visual pendiente» | todos |
| **OG-9** | **Aprobación de las líneas base de 390 px** de las rutas sin tablero y de **cualquier regeneración de goldens** (§14.5) | Que esas comparaciones visuales sean bloqueantes | Se generan y se comparan como informativas | M11 en adelante |
| **OG-10** | **Subir un presupuesto de §13.6** si el prototipo medido de la Pokédex no cabe | Continuar F2 sin reducir el HTML | Un límite **solo baja** con la medida; si no cabe, se reduce el HTML hasta cumplirlo. Ningún agente sube un límite | M6 |
| **OG-11** | **Tablero de Comparar Pokémon** (R15) | Empezar M16 con fidelidad medible | La ruta es un marcador con la plantilla E (E18); el corte cierra sin F5 | M16 |
| **OG-12** | **Registros que escribe el propietario** (D-011): `content/destacados.json`, `content/mundos.json`, `content/elementos.json`, `content/cambios.json`, `content/sistemas/*.json`, `content/comercio/*`, los campos nuevos de Pokémon (`hp`, `experiencia`, `drops`, `evolucion`, `habilidades`, `donde`, `elementoMoveset`), de ítems (`elemento`, `uso`), de ítems de sistema y de actividades (`sprite`), y las claves fijas de `public/sprites/sprites.json` que hoy faltan: `ui/inicio`, `ui/indice/*`, `ui/herramientas/*` y `ui/cambios` (comprobado; `ui/categorias/*`, `ui/pokedolares`, `ui/diamond` y `ui/comercio/*` ya están) | Contenido real en cada página | Marcadores `borrador: true`; `null` se muestra «—» o se omite según X13; una clave fija ausente da `null` sin fallar el build (`spriteOrNull`) | M4, M8, M9, M10, M12 |
| **OG-13** | **Publicar en el sistema de diseño los 10 tokens nuevos de §3.3** (grupo `motion`, `z-header`, `layout-main-max`) y cualquier cambio de valor (R16) | Que `src/design/tokens.json` y el `tokens.json` publicado coincidan | El repositorio los lleva; la revisión del cambio comprueba la coincidencia a mano (el sistema de diseño no vive en el repositorio, así que CI no puede compararlos) | M1 |

### Preguntas abiertas que no bloquean (§1.7)

Q6 tema claro · Q7 cuenta regresiva del Server Save · Q8 tier máximo de held item · Q9 monedas reales · Q10 contraste de `ring` y `text-quaternary` · Q11 direcciones del outfit · Q12 etiquetas de precio NPC · Q13 «actividades» frente a «guías» en el Inicio · Q14 aspecto del tooltip del gráfico de Guild · Q15 `contribution` como Pokédólares · Q16 regla de desconocidos.

Cada una tiene su valor por defecto en §1.7 y el hito que cambiaría si llega la respuesta: Q6 → M3 y M5 (botón de tema, tokens claros); Q7 → M10; Q8 y Q9 → M12; Q10 → M1 y M2 (declaración de conformidad); Q11 → M7; Q12 → M9; Q13 → M10 (máscara DV6); Q14 y Q15 → M13; Q16 → M4 y M7.
