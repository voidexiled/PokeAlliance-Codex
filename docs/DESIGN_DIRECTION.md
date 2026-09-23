# Dirección de diseño — wiki fiel a RubinOT

Estado: diseño aprobado por el propietario el 2026-09-19 (D-014). Se implementa en el Corte 0, hitos M1–M15 de [docs/IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md); el avance de cada hito está en [docs/CURRENT_STATUS.md](CURRENT_STATUS.md). La aceptación visual es del propietario (S22).
Última actualización: 2026-09-23

Este documento describe la dirección aprobada y dice dónde vive cada parte. Los nombres y valores exactos están en `src/design/tokens.json` y en [DESIGN.md](../DESIGN.md), que los resume para agentes y herramientas.

## Fuentes de verdad

En este orden de precedencia (D-014):

| Orden | Fuente                                                                                                                                                                                      | En el repositorio                                                                         | Qué fija                                                                                                                                            |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | **Lienzo v5** — <https://claude.ai/artifact/AA7ujE9mRRKsMBWriyNxFH> (tableros: Main, Inicio-movil, Pokedex, Pokedex-Shiny-Charizard, Sistema-Boost, Comercio, Guild, Componentes, Tarjetas) | `design/boards/*.dc.html`; `design/render/render.mjs` dibuja un tablero                   | Geometría y composición de cada página con tablero. Sus textos y cifras son muestras, nunca datos.                                                  |
| 2     | **Sistema de diseño** — <https://claude.ai/artifact/RJoXBjrTVJHCyTZNFmKS5C> (110 tokens, 22 estilos de texto, 65 componentes, guías en español)                                             | `src/design/tokens.json`; los componentes en `src/components/` y `src/styles/components/` | Tokens, tipografía, componentes, estados y textos por defecto.                                                                                      |
| 3     | [docs/design/CARD_GRID_SYSTEM.md](design/CARD_GRID_SYSTEM.md)                                                                                                                               | —                                                                                         | Familias de rejilla, anatomía de tarjeta sobre subgrid, claves por unión y agrupación.                                                              |
| 4     | [Especificación del Corte 0](CORTE_0_CODEX_TOOLTIP_SPEC.md)                                                                                                                                 | —                                                                                         | Cómo se lleva todo lo anterior al código: arquitectura CSS, componentes, páginas, Comercio, Guild, i18n, SEO, rendimiento, accesibilidad y pruebas. |

Medidas y contexto: [docs/design/RUBINOT_DESIGN_REFERENCE.md](design/RUBINOT_DESIGN_REFERENCE.md) (valores medidos de RubinOT) y [docs/design/GAP_ANALYSIS.md](design/GAP_ANALYSIS.md) (el sitio anterior frente a esa referencia).

## El diseño

Lenguaje de interfaz fiel a RubinOT con contenido y sprites de PokeAlliance. No se copian la marca, los textos ni los assets de RubinOT.

- **Marco:** Verdana del sistema en 400 y 700, texto de 12 a 14 px y un solo tema, «Oscuro». Tres grises: `bg-primary` (#0c0e12), `bg-secondary` (#13161b) y `bg-tertiary` (#22262f), que es también el único hover. Bordes de 1 px `border-secondary` (#22262f) y `border-primary` (#373a41) en controles. Sin degradados, sombras de elevación ni brillos.
- **Medidas a 1440:** cabecera de 64 (`layout-header`), barra lateral de 208 (`layout-sidebar`), separación de 40, columna de 944 (`layout-main`) o de 896 con el rail «Resumen» de 256 (`layout-main-rail`, `layout-rail`) y pie de una línea. Por debajo de 1280 (`layout-bp-xl`) el menú pasa a una hoja de 288 y el contenido lleva gutters de 16; en teléfono los objetivos miden 44.
- **Color con significado:** enlaces de entidad en `link` (#93c5fd); foco con `ring` (#444ce7), 2 px con 1 px de separación; selección ámbar `selected` (#d97706) con anillo de 2 px, nunca en un enlace; `banner` (#991b1b) como único bloque de color sólido. El resto del color lo ponen los sprites.
- **Capa de juego:** el tooltip del juego (`tt-panel` #21252c, etiquetas `tt-label` #e8c66a, valores blancos, Poppins 500 y 600 autoalojada) es la única superficie con lenguaje de juego, y solo para entidades del juego. Cada mención de una entidad lo abre; una tarjeta no abre tooltip, pero sus entidades anidadas sí.
- **Listas:** Cards, Slots y Lista en toda lista de entidades, sobre rejillas de anatomía fija (fuente 3).
- **Iconografía:** sprites reales del registro `public/sprites/sprites.json`, a escala entera dentro de una celda de 32. Los SVG quedan para los glifos utilitarios de `src/components/icons/Glyph.tsx`. Sin emoji.
- **Dinero:** Pokédólares con su sprite y forma k/kk antes de cada importe del juego (D-013).
- **Contenido:** solo de los registros de `content/`, con «—» para lo desconocido. Sin relleno, texto decorativo o meta, controles falsos, cifras inventadas ni procedencia (D-010, D-012).
- **Movimiento:** 150 ms en hover y en la entrada del tooltip, rebote de sprites solo en Destacados y nada animado con `prefers-reduced-motion: reduce`.

El propietario rechazó el 2026-09-18 tres direcciones anteriores: el tooltip del juego en todo el sitio, la Pokédex «dispositivo» roja y el navy/bronce ornamentado. La corrección del 2026-09-15 («más personalidad visual») se resuelve con sprites reales y con la capa de juego del tooltip, no con decoración.

## Cómo se construye

- `src/design/tokens.json` es la fuente única de tokens. `pnpm design:tokens` escribe `src/styles/tokens.css`, `src/styles/theme.css` (utilidades de Tailwind y los 22 estilos `type-*`) y `src/lib/design/tokens.ts`; ninguno de los tres se edita a mano.
- `pnpm design:check` hace cumplir las once reglas de §3.11 de la especificación: sin literales de color, longitud, duración ni curva fuera de los tokens, tipografía solo desde `theme.css`, animaciones solo dentro de `prefers-reduced-motion: no-preference`, entre otras.
- Los componentes usan clases `ac-` y su CSS vive en `src/styles/components/`. `src/styles/global.css` es la hoja del sitio (≤ 100.000 B, S17) y los importa con `layer(components)`; el CSS de una sola familia de páginas lo importa su página o componente dentro de `@layer components` (D-018), y cada carpeta de páginas tiene su línea `@source` (D-017).
- `src/layouts/PageLayout.astro` es el layout de las páginas nuevas.

## Qué sustituye

- El contrato visual anterior de este documento (tokens propios, radios de 12, rail de 208, columna de 1536).
- La parte visual de D-010: nombre del sistema, prefijos de token propios y la tipografía de interfaz que proponía.
- Las cinco hojas anteriores (`src/styles/legacy/`, 10.151 líneas) y `src/layouts/AppLayout.astro`, que salen en el cierre del corte (M15) junto con sus clases y variables.

## Qué se conserva

Rutas `es`/`en`, registros de `content/`, búsqueda, mapa (marcador hasta su corte), importación e historial de Guild, exportaciones, autenticación, contratos de datos y límites de Supabase. El rediseño no quita funcionalidad.

## Aceptación

Los criterios S1–S22 de §2 de la especificación, con la tabla «Criterios por fase». Los checks automáticos demuestran el contrato técnico; no sustituyen a S22, la revisión página por página del propietario frente a su tablero. Hasta que la confirme, el estado correcto es «implementado y verificado técnicamente; aceptación visual pendiente».
